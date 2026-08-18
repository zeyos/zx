import { Component } from '../../core/component.js';
import { formatDate, parseDate } from '../../core/date.js';
import { h } from '../../core/dom.js';
import { printf, translate } from '../../core/i18n.js';
import { icon } from '../../core/icons.js';
import { position } from '../../core/position.js';
import { escapeRegExp, uid } from '../../core/util.js';
import { DateRangePicker, clampRange, normalizeRange } from '../date-picker/date-range-picker.js';

/** @typedef {import('../date-picker/date-range-picker.js').DateRange} DateRange */
/** @typedef {import('../date-picker/date-range-picker.js').DateRangePreset} DateRangePreset */
/** @typedef {{start: number|null, end: number|null}} DateRangeSeconds */
/** @typedef {Date|number|string|null} DateRangeInput */

/**
 * @typedef {Object} DateRangeBoxOptions
 * @property {Date|number|string|null} [start=null] Initial start: Date, Unix seconds, or formatted text.
 * @property {Date|number|string|null} [end=null] Initial end: Date, Unix seconds, or formatted text.
 * @property {string} [format='%d.%m.%Y'] Kernel date format used for both endpoints.
 * @property {string} [separator=' – '] Text placed between the two formatted dates.
 * @property {string|null} [placeholder=null] Input placeholder; null derives one from the format.
 * @property {boolean} [clearable=true] Show a clear button while a range is present.
 * @property {Date|null} [min=null] Earliest selectable local calendar day.
 * @property {Date|null} [max=null] Latest selectable local calendar day.
 * @property {number} [months=2] Month panels in the popover; narrow ones show only the first.
 * @property {number} [weekStart=1] First weekday, from 0 (Sunday) through 6 (Saturday).
 * @property {boolean} [showWeekNumbers=false] Show ISO week numbers.
 * @property {number} [minNights=0] Smallest number of nights a complete range may span.
 * @property {number|null} [maxNights=null] Largest number of nights a complete range may span.
 * @property {DateRangePreset[]|boolean} [presets=[]] Preset buttons, or `true` for the built-in set.
 * @property {boolean} [disabled=false] Disable all controls.
 * @property {(event: CustomEvent<DateRange>) => void} [onchange] Change listener.
 * @property {(event: CustomEvent<{text: string}>) => void} [oninvalid] Invalid-input listener.
 * @property {(event: CustomEvent<Record<string, never>>) => void} [onopen] Open listener.
 * @property {(event: CustomEvent<Record<string, never>>) => void} [onclose] Close listener.
 */
/** @typedef {{silent?: boolean}} DateRangeBoxSetOptions */
/** @typedef {'date'|'seconds'} DateRangeBoxUnit */

const PLACEHOLDER_TOKENS = {
  '%d': 'DD',
  '%e': 'D',
  '%m': 'MM',
  '%Y': 'YYYY',
  '%y': 'YY'
};

/**
 * Parses `"<start><separator><end>"` into a range. A lone date is read as a one-day range, and a
 * trailing separator as a start-only range, so a half-typed value is not thrown away.
 * @param {string} text Input text.
 * @param {string} format Kernel date format for each endpoint.
 * @param {string} separator Separator between the two dates; surrounding spaces are optional.
 * @returns {DateRange|null} The parsed range, or null when the text does not match.
 */
export function parseRangeText(text, format, separator) {
  const source = String(text ?? '').trim();
  if (source === '') return { start: null, end: null };
  const raw = String(separator ?? ' – ');
  const core = raw.trim();
  // Spacing is optional unless the separator also occurs inside the format itself — a " - "
  // separator with a `%Y-%m-%d` format only splits where the spaces are, never on a date's dashes.
  const strict = core !== '' && String(format).includes(core) && /^\s|\s$/.test(raw);
  const lead = strict ? '\\s+' : '\\s*';
  const tail = strict ? '(?:\\s+|$)' : '\\s*';
  const parts = core === ''
    ? [source]
    : source.split(new RegExp(`${lead}${escapeRegExp(core)}${tail}`));
  if (parts.length > 2) return null;

  const first = parseDate(parts[0].trim(), format);
  if (!first) return null;
  if (parts.length === 1) return { start: first, end: new Date(first.getTime()) };
  if (parts[1].trim() === '') return { start: first, end: null };
  const second = parseDate(parts[1].trim(), format);
  if (!second) return null;
  return normalizeRange(first, second);
}

/**
 * Renders a range as `"<start><separator><end>"`. An incomplete range yields the endpoint it has.
 * @param {DateRange|null} range Range to render.
 * @param {string} format Kernel date format for each endpoint.
 * @param {string} separator Separator between the two dates.
 * @returns {string}
 */
export function formatRangeText(range, format, separator) {
  const start = range?.start ?? null;
  const end = range?.end ?? null;
  if (!start && !end) return '';
  if (!end) return formatDate(start, format);
  if (!start) return formatDate(end, format);
  return `${formatDate(start, format)}${separator}${formatDate(end, format)}`;
}

/**
 * Formatted date-range input with an anchored two-month range calendar.
 * @fires DateRangeBox#change
 * @fires DateRangeBox#invalid
 * @fires DateRangeBox#open
 * @fires DateRangeBox#close
 */
export class DateRangeBox extends Component {
  static cssName = 'date-range-box';

  /** @type {DateRangeBoxOptions} */
  static defaults = {
    start: null,
    end: null,
    format: '%d.%m.%Y',
    separator: ' – ',
    placeholder: null,
    clearable: true,
    min: null,
    max: null,
    months: 2,
    weekStart: 1,
    showWeekNumbers: false,
    minNights: 0,
    maxNights: null,
    presets: [],
    disabled: false
  };

  // State used by render() is initialized inside it, never as class fields: render() runs from the
  // base constructor, before field initializers would reset it (see AGENTS.md).

  /** @returns {HTMLElement} */
  render() {
    const root = /** @type {HTMLElement} */ (this.el ?? h('div'));
    this.el = root;
    this._originalState = root.getAttribute('data-state');
    this._originalAriaDisabled = root.getAttribute('aria-disabled');
    this._format = String(this.options.format || '%d.%m.%Y');
    this._separator = String(this.options.separator ?? ' – ');
    this._disabled = Boolean(this.options.disabled);
    this._open = false;
    this._position = null;
    this._range = this._coerce({ start: this.options.start, end: this.options.end });
    const popoverId = uid('zx-date-range-box-popover');

    const content = h('div', { class: 'zx-date-range-box__content' },
      h('div', { ref: 'control', class: 'zx-date-range-box__control' },
        h('input', {
          ref: 'input',
          class: 'zx-date-range-box__input',
          type: 'text',
          autocomplete: 'off',
          placeholder: this.options.placeholder ?? this._placeholder(),
          'aria-haspopup': 'grid',
          ariaControls: popoverId,
          ariaExpanded: 'false'
        }),
        h('button', {
          ref: 'clear',
          class: 'zx-icon-btn zx-date-range-box__clear',
          type: 'button',
          ariaLabel: text('daterange.clear', 'Clear date range')
        }, icon('x', { size: 13 })),
        h('button', {
          ref: 'toggle',
          class: 'zx-date-range-box__toggle',
          type: 'button',
          ariaLabel: text('daterange.choose', 'Choose date range'),
          'aria-haspopup': 'grid',
          ariaControls: popoverId,
          ariaExpanded: 'false'
        }, icon('calendar'))
      ),
      h('div', {
        ref: 'popover',
        id: popoverId,
        class: 'zx-date-range-box__popover',
        popover: 'manual',
        dataset: { state: 'closed' }
      })
    );
    this._content = content;
    root.append(content);

    this._picker = new DateRangePicker(null, {
      start: this._range.start,
      end: this._range.end,
      min: this.options.min,
      max: this.options.max,
      months: this.options.months,
      weekStart: this.options.weekStart,
      showWeekNumbers: this.options.showWeekNumbers,
      minNights: this.options.minNights,
      maxNights: this.options.maxNights,
      presets: this.options.presets
    });
    this.refs.popover.append(this._picker.el);
    // `select` mirrors the half-open state into the input; `change` commits and closes.
    this._picker.on('select', (event) => {
      this._range = { start: event.detail.start, end: event.detail.end };
      this._setValid();
      this._syncDisplay();
    });
    this._picker.on('change', (event) => {
      this._apply({ start: event.detail.start, end: event.detail.end }, { push: false });
      if (event.detail.start && event.detail.end) this._close(true);
    });

    // Moving focus into the open calendar blurs the input; committing then would turn a
    // half-picked range into a one-day range behind the user's back.
    this.listen(this.refs.input, 'blur', () => {
      if (!this._open) this._commitText();
    });
    this.listen(this.refs.input, 'keydown', (event) => this._onInputKeydown(event));
    this.listen(this.refs.toggle, 'click', () => this._open ? this.close() : this.open());
    this.listen(this.refs.toggle, 'keydown', (event) => {
      if (event.key !== 'ArrowDown') return;
      event.preventDefault();
      this.open();
    });
    this.listen(this.refs.clear, 'click', () => {
      this.clear();
      this.focus();
    });
    this.listen(document, 'keydown', (event) => {
      if (!this._open || event.key !== 'Escape') return;
      event.preventDefault();
      this._close(true);
    });
    this.listen(document, 'pointerdown', (event) => {
      if (this._open && !root.contains(event.target)) this.close();
    });

    this._syncDisplay();
    this._syncDisabled();
    return root;
  }

  /**
   * Returns the selected range as dates or as Unix timestamps.
   * @param {DateRangeBoxUnit} [unit='date'] Return unit.
   * @returns {DateRange|DateRangeSeconds}
   */
  get(unit = 'date') {
    if (unit === 'seconds') {
      return {
        start: this._range.start ? Math.floor(this._range.start.getTime() / 1000) : null,
        end: this._range.end ? Math.floor(this._range.end.getTime() / 1000) : null
      };
    }
    return {
      start: this._range.start ? new Date(this._range.start.getTime()) : null,
      end: this._range.end ? new Date(this._range.end.getTime()) : null
    };
  }

  /**
   * Sets a range. Each endpoint may be a Date, Unix seconds, or text in the configured format;
   * a whole formatted range string and `null` are accepted too.
   * @param {DateRange|{start: DateRangeInput, end: DateRangeInput}|string|null} range New range.
   * @param {DateRangeBoxSetOptions} [options={}] Update behavior.
   * @returns {this}
   * @fires DateRangeBox#change
   */
  set(range, { silent = false } = {}) {
    this._apply(this._coerce(range), { silent });
    return this;
  }

  /**
   * Clears the selection.
   * @param {DateRangeBoxSetOptions} [options={}] Update behavior.
   * @returns {this}
   * @fires DateRangeBox#change
   */
  clear({ silent = false } = {}) {
    return this.set({ start: null, end: null }, { silent });
  }

  /**
   * Opens and positions the range calendar, then moves focus into its grid.
   * @returns {this}
   * @fires DateRangeBox#open
   */
  open() {
    if (this._disabled || this._open) return this;
    this._picker.set(this._range, { silent: true });
    this._open = true;
    this.refs.popover.dataset.state = 'open';
    this.refs.input.setAttribute('aria-expanded', 'true');
    this.refs.toggle.setAttribute('aria-expanded', 'true');
    this._position = position(this.refs.control, this.refs.popover, {
      placement: 'bottom-start',
      flip: true
    });
    this._picker.focus();
    this.emit('open');
    return this;
  }

  /**
   * Closes the range calendar.
   * @returns {this}
   * @fires DateRangeBox#close
   */
  close() {
    this._close(false);
    return this;
  }

  /** Enables the box. @returns {this} */
  enable() {
    this._disabled = false;
    this._syncDisabled();
    return this;
  }

  /** Disables the box and closes its popover. @returns {this} */
  disable() {
    this._disabled = true;
    this.close();
    this._syncDisabled();
    return this;
  }

  /** Moves focus to the text input. @returns {this} */
  focus() {
    this.refs.input.focus();
    return this;
  }

  /** Cleans up the open popover, child picker, and generated host content. @returns {void} */
  destroy() {
    this._position?.destroy();
    this._position = null;
    this._open = false;
    this._picker?.destroy();
    this._picker = null;
    this._content?.remove();
    restoreAttribute(this.el, 'data-state', this._originalState);
    restoreAttribute(this.el, 'aria-disabled', this._originalAriaDisabled);
    super.destroy();
  }

  /* --------------------------------------------------------------------- internals -- */

  /**
   * Stores a range, optionally pushing it back into the picker, and reports it.
   * @param {DateRange} range Already-coerced range.
   * @param {{silent?: boolean, push?: boolean}} [options={}] Update behavior.
   * @returns {void}
   * @fires DateRangeBox#change
   */
  _apply(range, { silent = false, push = true } = {}) {
    this._range = range;
    if (push) this._picker?.set(this._range, { silent: true });
    this._setValid();
    this._syncDisplay();
    if (!silent) this.emit('change', this.get());
  }

  /** @param {KeyboardEvent} event @returns {void} */
  _onInputKeydown(event) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.open();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      this._commitText();
    } else if (event.key === 'Escape' && this._open) {
      event.preventDefault();
      this._close(true);
    }
  }

  /** @returns {void} */
  _commitText() {
    if (this._disabled) return;
    const value = this.refs.input.value.trim();
    if (value === '') {
      this.set({ start: null, end: null });
      return;
    }
    const parsed = parseRangeText(value, this._format, this._separator);
    if (!parsed) {
      this.el.dataset.state = 'invalid';
      this.refs.input.setAttribute('aria-invalid', 'true');
      this.emit('invalid', { text: value });
      return;
    }
    this._apply(this._clamp(parsed));
  }

  /**
   * Coerces any accepted input shape into a bounded range of local dates.
   * @param {unknown} value Range-ish input.
   * @returns {DateRange}
   */
  _coerce(value) {
    if (value === null || value === undefined) return { start: null, end: null };
    if (typeof value === 'string') {
      return this._clamp(parseRangeText(value, this._format, this._separator) ?? { start: null, end: null });
    }
    if (Array.isArray(value)) {
      return this._clamp({ start: this._toDate(value[0]), end: this._toDate(value[1]) });
    }
    if (typeof value !== 'object') return { start: null, end: null };
    return this._clamp({
      start: this._toDate(/** @type {Record<string, unknown>} */ (value).start),
      end: this._toDate(/** @type {Record<string, unknown>} */ (value).end)
    });
  }

  /** @param {unknown} value @returns {Date|null} */
  _toDate(value) {
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : new Date(value.getTime());
    if (typeof value === 'number' && Number.isFinite(value)) return new Date(value * 1000);
    if (typeof value === 'string' && value.trim() !== '') return parseDate(value.trim(), this._format);
    return null;
  }

  /** @param {DateRange} range @returns {DateRange} */
  _clamp(range) {
    return clampRange(range, {
      min: this.options.min,
      max: this.options.max,
      minNights: this.options.minNights,
      maxNights: this.options.maxNights
    });
  }

  /** @returns {string} */
  _placeholder() {
    const one = this._format.replace(/%[demYy]/g, (token) => PLACEHOLDER_TOKENS[token] ?? token);
    return `${one}${this._separator}${one}`;
  }

  /** @returns {void} */
  _syncDisplay() {
    this.refs.input.value = formatRangeText(this._range, this._format, this._separator);
    this.refs.clear.hidden = !this.options.clearable || !(this._range.start || this._range.end);
  }

  /** @returns {void} */
  _syncDisabled() {
    this.refs.input.disabled = this._disabled;
    this.refs.toggle.disabled = this._disabled;
    this.refs.clear.disabled = this._disabled;
    this.el.setAttribute('aria-disabled', String(this._disabled));
    if (this._disabled) this._picker?.disable();
    else this._picker?.enable();
  }

  /** @returns {void} */
  _setValid() {
    if (this.el.dataset.state === 'invalid') restoreAttribute(this.el, 'data-state', this._originalState);
    this.refs.input.removeAttribute('aria-invalid');
  }

  /** @param {boolean} returnFocus @returns {void} */
  _close(returnFocus) {
    if (!this._open) return;
    this._position?.destroy();
    this._position = null;
    this._open = false;
    this.refs.popover.dataset.state = 'closed';
    this.refs.input.setAttribute('aria-expanded', 'false');
    this.refs.toggle.setAttribute('aria-expanded', 'false');
    if (returnFocus) this.focus();
    this.emit('close');
  }
}

/** @event DateRangeBox#change @type {CustomEvent<DateRange>} */
/** @event DateRangeBox#invalid @type {CustomEvent<{text: string}>} */
/** @event DateRangeBox#open @type {CustomEvent<Record<string, never>>} */
/** @event DateRangeBox#close @type {CustomEvent<Record<string, never>>} */

/**
 * Resolves a built-in string through the host translator, falling back to the English original.
 * @param {string} key Translation key.
 * @param {string} fallback English text used when the key is untranslated.
 * @param {unknown[]} [args] Interpolation values for `%1`, `%2`, …
 * @returns {string}
 */
function text(key, fallback, args) {
  const translated = translate(key);
  return printf(translated === key ? fallback : translated, args);
}

/** @param {Element} element @param {string} name @param {string|null} value @returns {void} */
function restoreAttribute(element, name, value) {
  if (value === null) element.removeAttribute(name);
  else element.setAttribute(name, value);
}
