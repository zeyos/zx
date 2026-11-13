import { Component } from '../../core/component.js';
import { h, restoreTarget, snapshotTarget } from '../../core/dom.js';
import { formattingLocale } from '../../core/i18n.js';
import { icon } from '../../core/icons.js';

/**
 * @typedef {Object} NumberFieldOptions
 * @property {number|null} [value=null] Initial value, or null for empty.
 * @property {number|null} [min=null] Lowest accepted value.
 * @property {number|null} [max=null] Highest accepted value.
 * @property {number} [step=1] Increment applied by the buttons and arrow keys.
 * @property {number} [largeStep=10] Multiple of `step` applied by PageUp/PageDown.
 * @property {number|null} [precision=null] Decimal places; derived from `step` when null.
 * @property {boolean} [snap=true] Whether a typed or assigned value is moved onto the `step` grid.
 *   With `false` the value is kept exactly as entered — `step` is then only the increment of the
 *   buttons and arrow keys, and decimals are rounded only to an explicit `precision`. `min` and
 *   `max` still apply. Use it for values that are not multiples of anything: an identifier, a
 *   seed, a measurement.
 * @property {boolean} [wrap=false] Whether stepping past a bound wraps to the other one.
 * @property {string} [placeholder=''] Empty-state text.
 * @property {string|null} [label=null] Accessible name for the spinbutton.
 * @property {string|null} [unit=null] Suffix rendered inside the control (e.g. `%`, `kg`).
 * @property {boolean} [disabled=false] Whether interaction is disabled.
 * @property {boolean} [readonly=false] Whether the value is read-only.
 * @property {boolean} [required=false] Whether an empty value is invalid.
 * @property {string|null} [name=null] Native form field name.
 * @property {boolean} [group=false] Whether to render thousands separators while idle.
 * @property {string|null} [locale=null] Locale for formatting; defaults to the active language.
 * @property {Record<string, string>|Record<string, Record<string, string>>} [msg] Localized messages.
 * @property {(event: CustomEvent<{value: number|null}>) => void} [onchange] Committed-value listener.
 * @property {(event: CustomEvent<{value: number|null}>) => void} [oninput] Per-keystroke listener.
 */

/**
 * Numeric input with decrement and increment buttons, following the APG spinbutton pattern.
 *
 * The step buttons are pointer affordances only (`tabindex="-1"`, `aria-hidden`): the input
 * itself is the spinbutton, so keyboard and screen-reader users step with the arrow keys rather
 * than tabbing through two extra controls in every form row.
 *
 * @fires NumberField#change
 * @fires NumberField#input
 * @extends {Component<NumberFieldOptions>}
 */
export class NumberField extends Component {
  static cssName = 'number-field';

  /** @type {NumberFieldOptions} */
  static defaults = {
    value: null,
    min: null,
    max: null,
    step: 1,
    largeStep: 10,
    precision: null,
    snap: true,
    wrap: false,
    placeholder: '',
    label: null,
    unit: null,
    disabled: false,
    readonly: false,
    required: false,
    name: null,
    group: false,
    locale: null
  };

  /** @returns {HTMLElement} */
  render() {
    // render() runs inside the base constructor, before class-field initializers would run.
    this._value = null;
    this._disabled = false;
    this._readonly = false;
    this._editing = false;
    this._createdRoot = this.el === null;
    this._snapshot = this._createdRoot ? null : snapshotTarget(this.el);

    const root = /** @type {HTMLElement} */ (this.el ?? h('div'));
    this.el = root;

    const step = normalizeStep(this.options.step);
    this._step = step;
    this._snap = this.options.snap !== false;
    const explicit = this.options.precision !== null && this.options.precision !== undefined;
    this._precision = explicit
      ? Math.max(0, Math.trunc(Number(this.options.precision) || 0))
      : decimalsOf(step);
    // Without snapping, only a precision the application asked for may round a value.
    this._fixedPrecision = this._snap || explicit;

    const down = this._stepButton('down', 'minus');
    const up = this._stepButton('up', 'plus');
    const input = h('input', {
      ref: 'input',
      class: 'zx-number-field__input',
      type: 'text',
      role: 'spinbutton',
      inputMode: this._precision > 0 || !this._fixedPrecision ? 'decimal' : 'numeric',
      autocomplete: 'off',
      spellcheck: false,
      placeholder: String(this.options.placeholder ?? ''),
      ariaLabel: this.options.label ?? undefined,
      name: this.options.name ?? undefined,
      required: Boolean(this.options.required)
    });
    const children = [down, input];
    if (this.options.unit !== null) {
      children.push(h('span', {
        ref: 'unit',
        class: 'zx-number-field__unit',
        ariaHidden: 'true'
      }, String(this.options.unit)));
    }
    children.push(up);
    root.replaceChildren(...children);

    this._disabled = Boolean(this.options.disabled);
    this._readonly = Boolean(this.options.readonly);

    this.listen(input, 'input', () => this._onInput());
    this.listen(input, 'keydown', (event) => this._onKeydown(/** @type {KeyboardEvent} */ (event)));
    // Grouped values are only shown while idle; editing always sees a plain, re-parseable number.
    this.listen(input, 'focus', () => {
      this._editing = true;
      this._syncInput();
    });
    this.listen(input, 'blur', () => {
      this._commit();
      this._editing = false;
      this._syncInput();
    });
    this.listen(down, 'click', () => this._stepBy(-1));
    this.listen(up, 'click', () => this._stepBy(1));
    // Pointer wheel only while focused, so scrolling a form never changes a value by accident.
    this.listen(input, 'wheel', (event) => {
      if (document.activeElement !== input || this._disabled || this._readonly) return;
      event.preventDefault();
      this._stepBy(event.deltaY < 0 ? 1 : -1);
    }, { passive: false });

    this.set(this.options.value, { silent: true });
    this._syncDisabled();
    return root;
  }

  /** Current value, or null when empty. @returns {number|null} */
  get value() {
    return this._value;
  }

  /** @param {number|null} next Next value. */
  set value(next) {
    this.set(next);
  }

  /**
   * Returns the current value.
   * @returns {number|null}
   */
  get() {
    return this._value;
  }

  /**
   * Sets the value, clamping it into `[min, max]` and — unless `snap` is off — moving it onto the
   * `step` grid.
   * @param {number|string|null} next Next value; empty strings and null clear the field.
   * @param {{silent?: boolean}} [options={}] Set `silent` to suppress `change`.
   * @returns {this}
   * @fires NumberField#change
   */
  set(next, { silent = false } = {}) {
    const parsed = this._coerce(next);
    const changed = parsed !== this._value;
    this._value = parsed;
    this._syncInput();
    if (changed && !silent) this.emit('change', { value: this._value });
    return this;
  }

  /**
   * Increases the value by `count` steps.
   * @param {number} [count=1] Number of steps.
   * @returns {this}
   * @fires NumberField#change
   */
  stepUp(count = 1) {
    return this._stepBy(count);
  }

  /**
   * Decreases the value by `count` steps.
   * @param {number} [count=1] Number of steps.
   * @returns {this}
   * @fires NumberField#change
   */
  stepDown(count = 1) {
    return this._stepBy(-count);
  }

  /**
   * Restores the configured initial value.
   * @param {{silent?: boolean}} [options={}] Reset behavior.
   * @returns {this}
   */
  reset({ silent = false } = {}) {
    return this.set(this.options.value, { silent });
  }

  /** Focuses the input. @returns {this} */
  focus() {
    this.refs.input.focus();
    return this;
  }

  /** Returns the underlying input element. @returns {HTMLInputElement} */
  getInput() {
    return /** @type {HTMLInputElement} */ (this.refs.input);
  }

  /** Enables user interaction. @returns {this} */
  enable() {
    this._disabled = false;
    this._syncDisabled();
    return this;
  }

  /** Disables user interaction. @returns {this} */
  disable() {
    this._disabled = true;
    this._syncDisabled();
    return this;
  }

  /**
   * Sets the read-only state.
   * @param {boolean} readonly Whether the value is read-only.
   * @returns {this}
   */
  setReadonly(readonly) {
    this._readonly = Boolean(readonly);
    this._syncDisabled();
    return this;
  }

  /**
   * Replaces the accepted range.
   * @param {number|null} min Lowest accepted value.
   * @param {number|null} max Highest accepted value.
   * @returns {this}
   */
  setRange(min, max) {
    this._min = min === null || min === undefined ? null : Number(min);
    this._max = max === null || max === undefined ? null : Number(max);
    return this.set(this._value, { silent: true });
  }

  /** @param {'down'|'up'} direction @param {string} glyph @returns {HTMLButtonElement} */
  _stepButton(direction, glyph) {
    return /** @type {HTMLButtonElement} */ (h('button', {
      ref: direction,
      class: 'zx-number-field__step',
      type: 'button',
      tabIndex: -1,
      ariaHidden: 'true',
      dataset: { step: direction }
    }, icon(glyph, { size: 13 })));
  }

  /** @returns {number|null} */
  get _rangeMin() {
    if (this._min !== undefined) return this._min;
    return this.options.min === null || this.options.min === undefined ? null : Number(this.options.min);
  }

  /** @returns {number|null} */
  get _rangeMax() {
    if (this._max !== undefined) return this._max;
    return this.options.max === null || this.options.max === undefined ? null : Number(this.options.max);
  }

  /**
   * Parses, snaps, and clamps an arbitrary input value.
   * @param {unknown} raw Value from an option, a method call, or the input element.
   * @returns {number|null}
   */
  _coerce(raw) {
    const parsed = parseNumber(raw, this.options.group ? this._separators() : null);
    if (parsed === null) return null;
    if (!this._snap) {
      // Past the digits a double can round to, rounding would only turn a tiny value into zero.
      if (this._decimalsFor(parsed) > ROUNDABLE_DECIMALS) return clampNumber(parsed, this._rangeMin, this._rangeMax);
      return snapNumber(parsed, {
        min: this._rangeMin,
        max: this._rangeMax,
        step: 0,
        precision: this._decimalsFor(parsed)
      });
    }
    return snapNumber(parsed, {
      min: this._rangeMin,
      max: this._rangeMax,
      step: this._step,
      precision: this._precision
    });
  }

  /**
   * Applies `count` steps relative to the current value.
   * @param {number} count Signed step count.
   * @returns {this}
   */
  _stepBy(count) {
    if (this._disabled || this._readonly) return this;
    const min = this._rangeMin;
    const max = this._rangeMax;
    // Step from whatever is in the field right now: typing 25 then pressing ArrowUp must give 26,
    // not commit-value + 1.
    const typed = parseNumber(this.refs.input.value, this.options.group ? this._separators(this._inputLocale) : null);
    const current = typed ?? this._value;
    const base = current === null ? (min ?? 0) : current;
    // An empty field steps to the lower bound first, so the first click lands on a real value.
    const start = current === null && count > 0 && min !== null ? min - this._step * count : base;
    const decimals = this._decimalsFor(start);
    let next = decimals > ROUNDABLE_DECIMALS ? start + this._step * count : round(start + this._step * count, decimals);

    if (this.options.wrap && min !== null && max !== null) {
      if (next > max) next = min;
      else if (next < min) next = max;
    }
    this.set(next);
    return this;
  }

  /**
   * The grouping and decimal separators of the effective formatting locale.
   * @param {string|string[]} [locale] Locale of the text being parsed.
   * @returns {{group: string, decimal: string, minus: string, digits: Record<string, string>}}
   */
  _separators(locale = formattingLocale(this.options.locale)) {
    const key = String(locale);
    if (this._localeSeparators && this._separatorLocale === key) return this._localeSeparators;
    this._separatorLocale = key;
    const parts = new Intl.NumberFormat(locale, {
      minimumFractionDigits: 1
    }).formatToParts(1234.5);
    const digitFormatter = new Intl.NumberFormat(locale, { useGrouping: false });
    this._localeSeparators = {
      group: parts.find((part) => part.type === 'group')?.value ?? ',',
      decimal: parts.find((part) => part.type === 'decimal')?.value ?? '.',
      minus: digitFormatter.formatToParts(-1).find((part) => part.type === 'minusSign')?.value ?? '-',
      digits: Object.fromEntries(Array.from({ length: 10 }, (_, value) => [
        digitFormatter.formatToParts(value).find((part) => part.type === 'integer')?.value ?? String(value),
        String(value)
      ]))
    };
    return this._localeSeparators;
  }

  /** @returns {void} */
  _onInput() {
    const parsed = parseNumber(this.refs.input.value, this.options.group ? this._separators(this._inputLocale) : null);
    this._syncAria(parsed);
    this.emit('input', { value: parsed });
  }

  /** @param {KeyboardEvent} event @returns {void} */
  _onKeydown(event) {
    if (this._disabled || this._readonly) return;
    // Chords belong to the page — Mod+Enter submits the form or dialog the field is in.
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const large = Math.max(1, Math.trunc(Number(this.options.largeStep) || 1));
    const actions = {
      ArrowUp: () => this._stepBy(1),
      ArrowDown: () => this._stepBy(-1),
      PageUp: () => this._stepBy(large),
      PageDown: () => this._stepBy(-large),
      Home: () => (this._rangeMin === null ? null : this.set(this._rangeMin)),
      End: () => (this._rangeMax === null ? null : this.set(this._rangeMax)),
      Enter: () => this._commit()
    };
    const action = actions[event.key];
    if (!action) return;
    // Home/End keep their text-caret meaning when the field has no bound to jump to.
    if ((event.key === 'Home' && this._rangeMin === null)
      || (event.key === 'End' && this._rangeMax === null)) return;
    event.preventDefault();
    action();
  }

  /** Parses whatever the user typed and normalizes the displayed text. @returns {void} */
  _commit() {
    this.set(parseNumber(this.refs.input.value, this.options.group ? this._separators(this._inputLocale) : null));
  }

  /** @returns {void} */
  _syncInput() {
    const input = /** @type {HTMLInputElement} */ (this.refs.input);
    this._inputLocale = formattingLocale(this.options.locale);
    const text = this._value === null ? '' : this._format(this._value, this._editing);
    if (input.value !== text) input.value = text;
    this._syncAria(this._value);
  }

  /**
   * @param {number|null} value Value to announce.
   * @returns {void}
   */
  _syncAria(value) {
    const input = this.refs.input;
    const min = this._rangeMin;
    const max = this._rangeMax;
    if (min === null) input.removeAttribute('aria-valuemin');
    else input.setAttribute('aria-valuemin', String(min));
    if (max === null) input.removeAttribute('aria-valuemax');
    else input.setAttribute('aria-valuemax', String(max));
    if (value === null) {
      // ARIA: omit aria-valuenow when the value is unknown, but still announce the empty state.
      input.removeAttribute('aria-valuenow');
      input.setAttribute('aria-valuetext', this._message('numberField.empty', 'Empty'));
    } else {
      input.setAttribute('aria-valuenow', String(value));
      const unit = this.options.unit === null ? '' : ` ${this.options.unit}`;
      input.setAttribute('aria-valuetext', `${this._format(value, false)}${unit}`);
    }
    this.el.toggleAttribute('data-empty', value === null);
  }

  /**
   * @param {number} value Value to render.
   * @param {boolean} editing Whether the field currently has focus.
   * @returns {string}
   */
  _format(value, editing) {
    // Ungrouped fields use a plain machine format, which `parseNumber` reads heuristically.
    const decimals = this._decimalsFor(value);
    if (!this.options.group) return value.toFixed(decimals);
    // Grouped fields stay in the locale's notation even while editing — only the thousands
    // separators drop away. Display and input therefore always use the same decimal character,
    // so a value the field rendered is always a value it can read back.
    return new Intl.NumberFormat(formattingLocale(this.options.locale), {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
      useGrouping: !editing
    }).format(value);
  }

  /**
   * Decimal places a value is held and shown at: the field's precision, widened to the value's
   * own decimals when nothing fixed the precision (`snap: false` without `precision`).
   * @param {number} value Value in question.
   * @returns {number}
   */
  _decimalsFor(value) {
    if (this._fixedPrecision) return this._precision;
    return Math.min(MAX_DECIMALS, Math.max(this._precision, decimalsOf(value)));
  }

  /**
   * @param {string} key Message key.
   * @param {string} fallback Text used when the host has no translation.
   * @returns {string}
   */
  _message(key, fallback) {
    const message = this.msg(key);
    return message === key ? fallback : message;
  }

  /** @returns {void} */
  _syncDisabled() {
    const input = /** @type {HTMLInputElement} */ (this.refs.input);
    input.disabled = this._disabled;
    input.readOnly = this._readonly;
    this.refs.up.disabled = this._disabled || this._readonly;
    this.refs.down.disabled = this._disabled || this._readonly;
    this.el.toggleAttribute('data-disabled', this._disabled);
    this.el.toggleAttribute('data-readonly', this._readonly);
    if (this._disabled) this.el.setAttribute('aria-disabled', 'true');
    else this.el.removeAttribute('aria-disabled');
  }

  /** Restores an enhanced target to the markup it had before the takeover. @returns {void} */
  destroy() {
    const root = this.el;
    super.destroy();
    if (!this._createdRoot && root) restoreTarget(root, this._snapshot);
  }
}

/**
 * Committed value change.
 * @event NumberField#change
 * @type {CustomEvent<{value: number|null}>}
 */

/**
 * Per-keystroke value change; the value may still be unsnapped or out of range.
 * @event NumberField#input
 * @type {CustomEvent<{value: number|null}>}
 */

/**
 * Parses a user-entered number.
 *
 * With `separators` (from the field's locale) the grouping character is removed and the decimal
 * character is honoured, so a displayed `1,234` in en-US reads back as 1234 rather than 1.234.
 * Without them, the last of `.` or `,` is treated as the decimal point and the other as grouping,
 * which is the best available guess for free-form typing.
 *
 * @param {unknown} raw Value to parse.
 * @param {{group: string, decimal: string, minus?: string, digits?: Record<string, string>}|null} [separators=null] Known locale separators, minus sign, and digit mappings.
 * @returns {number|null} The number, or null when the input is empty or unparseable.
 */
export function parseNumber(raw, separators = null) {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  if (raw === null || raw === undefined) return null;
  const text = String(raw).trim();
  if (text === '') return null;

  let normalized;
  if (separators) {
    normalized = text;
    for (const [digit, ascii] of Object.entries(separators.digits ?? {})) {
      normalized = normalized.split(digit).join(ascii);
    }
    normalized = normalized
      .split(separators.group).join('')
      .replace(separators.decimal, '.')
      .replace(separators.minus ?? '-', '-')
      .replace(/[^\d.\-+eE]/g, '');
  } else {
    // Keep the last separator as the decimal point; everything before it is grouping.
    const cleaned = text.replace(/[^\d,.\-+eE]/g, '');
    const lastComma = cleaned.lastIndexOf(',');
    const lastDot = cleaned.lastIndexOf('.');
    normalized = cleaned;
    if (lastComma >= 0 && lastComma > lastDot) {
      normalized = cleaned.replace(/\./g, '').replace(',', '.');
    } else if (lastComma >= 0) {
      normalized = cleaned.replace(/,/g, '');
    }
  }
  // Stripping non-numeric characters can empty the string ("abc", "€", "-"); `Number('')` is 0,
  // which would silently turn junk into a valid zero.
  if (!/\d/.test(normalized)) return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

/**
 * Snaps a number onto the step grid and clamps it into the accepted range.
 * @param {number} value Raw value.
 * @param {{min: number|null, max: number|null, step: number, precision: number}} spec Constraints.
 * @returns {number}
 */
export function snapNumber(value, { min, max, step, precision }) {
  let result = value;
  if (step > 0) {
    // Snap relative to `min` so a range like 5…95 with step 10 yields 5, 15, 25 rather than 10, 20.
    const origin = min ?? 0;
    result = origin + Math.round((value - origin) / step) * step;
  }
  result = round(result, precision);
  // `min` and `max` are hard bounds and are applied last: rounding after the clamp could push the
  // value back outside the range (max 9.5 with precision 0 would round up to 10).
  if (min !== null && result < min) return min;
  if (max !== null && result > max) return max;
  return result;
}

/** @param {unknown} step @returns {number} */
function normalizeStep(step) {
  const value = Number(step);
  return Number.isFinite(value) && value > 0 ? value : 1;
}

/** Most decimals a value is displayed with (the limit of `toFixed`). */
const MAX_DECIMALS = 100;
/** Most decimals `round()` works to; an unsnapped value needing more is left unrounded. */
const ROUNDABLE_DECIMALS = 15;

/**
 * @param {number} value Value to bound.
 * @param {number|null} min Lower bound.
 * @param {number|null} max Upper bound.
 * @returns {number}
 */
function clampNumber(value, min, max) {
  if (min !== null && value < min) return min;
  if (max !== null && value > max) return max;
  return value;
}

/**
 * Decimal places in a number's shortest exact notation, exponent form included (`2.5e-7` has 8).
 * @param {number} value Number to measure.
 * @returns {number}
 */
function decimalsOf(value) {
  const [mantissa, exponent = '0'] = String(value).toLowerCase().split('e');
  const fraction = mantissa.split('.')[1]?.length ?? 0;
  return Math.max(0, fraction - Number(exponent));
}

/**
 * Rounds away the binary floating-point drift repeated stepping introduces
 * (0.1 + 0.2 → 0.30000000000000004).
 * @param {number} value Value to round.
 * @param {number} precision Decimal places.
 * @returns {number}
 */
function round(value, precision) {
  if (!Number.isFinite(value)) return value;
  return Number(value.toFixed(Math.min(15, Math.max(0, precision))));
}
