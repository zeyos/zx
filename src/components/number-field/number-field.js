import { Component } from '../../core/component.js';
import { h, restoreTarget, snapshotTarget } from '../../core/dom.js';
import { icon } from '../../core/icons.js';

/**
 * @typedef {Object} NumberFieldOptions
 * @property {number|null} [value=null] Initial value, or null for empty.
 * @property {number|null} [min=null] Lowest accepted value.
 * @property {number|null} [max=null] Highest accepted value.
 * @property {number} [step=1] Increment applied by the buttons and arrow keys.
 * @property {number} [largeStep=10] Multiple of `step` applied by PageUp/PageDown.
 * @property {number|null} [precision=null] Decimal places; derived from `step` when null.
 * @property {boolean} [wrap=false] Whether stepping past a bound wraps to the other one.
 * @property {string} [placeholder=''] Empty-state text.
 * @property {string|null} [label=null] Accessible name for the spinbutton.
 * @property {string|null} [unit=null] Suffix rendered inside the control (e.g. `%`, `kg`).
 * @property {boolean} [disabled=false] Whether interaction is disabled.
 * @property {boolean} [readonly=false] Whether the value is read-only.
 * @property {boolean} [required=false] Whether an empty value is invalid.
 * @property {string|null} [name=null] Native form field name.
 * @property {boolean} [group=false] Whether to render thousands separators while idle.
 * @property {string|null} [locale=null] Locale for formatting; defaults to the document locale.
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
    this._precision = this.options.precision === null
      ? decimalsOf(step)
      : Math.max(0, Math.trunc(Number(this.options.precision) || 0));

    const down = this._stepButton('down', 'minus');
    const up = this._stepButton('up', 'plus');
    const input = h('input', {
      ref: 'input',
      class: 'zx-number-field__input',
      type: 'text',
      role: 'spinbutton',
      inputMode: this._precision > 0 ? 'decimal' : 'numeric',
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
   * Sets the value, snapping it to `step` and clamping it into `[min, max]`.
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
    const typed = parseNumber(this.refs.input.value);
    const current = typed ?? this._value;
    const base = current === null ? (min ?? 0) : current;
    // An empty field steps to the lower bound first, so the first click lands on a real value.
    const start = current === null && count > 0 && min !== null ? min - this._step * count : base;
    let next = round(start + this._step * count, this._precision);

    if (this.options.wrap && min !== null && max !== null) {
      if (next > max) next = min;
      else if (next < min) next = max;
    }
    this.set(next);
    return this;
  }

  /**
   * The grouping and decimal separators of the configured locale.
   * @returns {{group: string, decimal: string}}
   */
  _separators() {
    if (this._localeSeparators) return this._localeSeparators;
    const parts = new Intl.NumberFormat(this.options.locale ?? undefined, {
      minimumFractionDigits: 1
    }).formatToParts(1234.5);
    this._localeSeparators = {
      group: parts.find((part) => part.type === 'group')?.value ?? ',',
      decimal: parts.find((part) => part.type === 'decimal')?.value ?? '.'
    };
    return this._localeSeparators;
  }

  /** @returns {void} */
  _onInput() {
    const parsed = parseNumber(this.refs.input.value, this.options.group ? this._separators() : null);
    this._syncAria(parsed);
    this.emit('input', { value: parsed });
  }

  /** @param {KeyboardEvent} event @returns {void} */
  _onKeydown(event) {
    if (this._disabled || this._readonly) return;
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
    this.set(this.refs.input.value);
  }

  /** @returns {void} */
  _syncInput() {
    const input = /** @type {HTMLInputElement} */ (this.refs.input);
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
    if (!this.options.group) return value.toFixed(this._precision);
    // Grouped fields stay in the locale's notation even while editing — only the thousands
    // separators drop away. Display and input therefore always use the same decimal character,
    // so a value the field rendered is always a value it can read back.
    return new Intl.NumberFormat(this.options.locale ?? undefined, {
      minimumFractionDigits: this._precision,
      maximumFractionDigits: this._precision,
      useGrouping: !editing
    }).format(value);
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
 * @param {{group: string, decimal: string}|null} [separators=null] Known locale separators.
 * @returns {number|null} The number, or null when the input is empty or unparseable.
 */
export function parseNumber(raw, separators = null) {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  if (raw === null || raw === undefined) return null;
  const text = String(raw).trim();
  if (text === '') return null;

  let normalized;
  if (separators) {
    normalized = text
      .split(separators.group).join('')
      .replace(separators.decimal, '.')
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

/** @param {number} step @returns {number} */
function decimalsOf(step) {
  const text = String(step);
  const exponent = text.match(/e-(\d+)/i);
  if (exponent) return Number(exponent[1]);
  const fraction = text.split('.')[1];
  return fraction ? fraction.length : 0;
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
