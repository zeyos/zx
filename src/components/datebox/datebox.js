import { Component } from '../../core/component.js';
import { clampDate, formatDate, parseDate } from '../../core/date.js';
import { h } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { position } from '../../core/position.js';
import { uid } from '../../core/util.js';
import { DatePicker } from '../date-picker/date-picker.js';

/**
 * @typedef {Object} DateboxOptions
 * @property {Date|number|string|null} [value=null] Date, Unix seconds, or formatted string.
 * @property {string} [format='%d.%m.%Y'] Kernel date format.
 * @property {boolean} [time=false] Append `%H:%M` and show time controls.
 * @property {Date|null} [min=null] Earliest selectable date.
 * @property {Date|null} [max=null] Latest selectable date.
 * @property {string|null} [placeholder=null] Input placeholder; null derives one from the format.
 * @property {boolean} [clearable=true] Show a clear button when a value is present.
 * @property {boolean} [disabled=false] Disable all controls.
 * @property {(event: CustomEvent<{date: Date|null}>) => void} [onchange] Change listener.
 * @property {(event: CustomEvent<{text: string}>) => void} [oninvalid] Invalid-input listener.
 * @property {(event: CustomEvent<Record<string, never>>) => void} [onopen] Open listener.
 * @property {(event: CustomEvent<Record<string, never>>) => void} [onclose] Close listener.
 */
/** @typedef {{silent?: boolean}} DateboxSetOptions */
/** @typedef {'date'|'seconds'} DateboxUnit */

/**
 * Formatted date input with an anchored calendar popover.
 * @fires Datebox#change
 * @fires Datebox#invalid
 * @fires Datebox#open
 * @fires Datebox#close
 */
export class Datebox extends Component {
  static cssName = 'datebox';

  /** @type {DateboxOptions} */
  static defaults = {
    value: null,
    format: '%d.%m.%Y',
    time: false,
    min: null,
    max: null,
    placeholder: null,
    clearable: true,
    disabled: false
  };

  /** @returns {HTMLElement} */
  render() {
    const root = /** @type {HTMLElement} */ (this.el ?? h('div'));
    this.el = root;
    this._originalState = root.getAttribute('data-state');
    this._originalAriaDisabled = root.getAttribute('aria-disabled');
    this._format = effectiveFormat(this.options.format, this.options.time);
    this._disabled = Boolean(this.options.disabled);
    this._open = false;
    this._position = null;
    this._min = validDate(this.options.min);
    this._max = validDate(this.options.max);
    this._value = this._normalizeValue(this.options.value);
    const popoverId = uid('zx-datebox-popover');

    const content = h('div', { class: 'zx-datebox__content' },
      h('div', { ref: 'control', class: 'zx-datebox__control' },
        h('input', {
          ref: 'input',
          class: 'zx-datebox__input',
          type: 'text',
          autocomplete: 'off',
          placeholder: this.options.placeholder ?? placeholderFromFormat(this._format),
          ariaHasPopup: 'grid',
          ariaControls: popoverId,
          ariaExpanded: 'false'
        }),
        h('button', {
          ref: 'clear',
          class: 'zx-datebox__clear',
          type: 'button',
          ariaLabel: 'Clear date'
        }, icon('x')),
        h('button', {
          ref: 'toggle',
          class: 'zx-datebox__toggle',
          type: 'button',
          ariaLabel: 'Choose date',
          ariaHasPopup: 'grid',
          ariaControls: popoverId,
          ariaExpanded: 'false'
        }, icon('calendar'))
      ),
      h('div', {
        ref: 'popover',
        id: popoverId,
        class: 'zx-datebox__popover',
        popover: 'manual',
        dataset: { state: 'closed' }
      })
    );
    this._content = content;
    root.append(content);

    this._picker = new DatePicker(null, {
      value: this._value,
      min: this._min,
      max: this._max,
      time: Boolean(this.options.time)
    });
    this.refs.popover.append(this._picker.el);
    this._picker.on('change', (event) => {
      this.set(event.detail.date);
      if (!this.options.time) this._close(true);
    });

    this.listen(this.refs.input, 'blur', () => this._commitText());
    this.listen(this.refs.input, 'keydown', (event) => this._onInputKeydown(event));
    this.listen(this.refs.toggle, 'click', () => this._open ? this.close() : this.open());
    this.listen(this.refs.toggle, 'keydown', (event) => {
      if (event.key !== 'ArrowDown') return;
      event.preventDefault();
      this.open();
    });
    this.listen(this.refs.clear, 'click', () => {
      this.set(null);
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
   * Returns the selected date or Unix timestamp.
   * @param {DateboxUnit} [unit='date'] Return unit.
   * @returns {Date|number|null}
   */
  get(unit = 'date') {
    if (!this._value) return null;
    if (unit === 'seconds') return Math.floor(this._value.getTime() / 1000);
    return new Date(this._value.getTime());
  }

  /**
   * Sets a Date, Unix-seconds number, formatted string, or null.
   * @param {Date|number|string|null} value Value to set.
   * @param {DateboxSetOptions} [options={}] Update behavior.
   * @returns {this}
   * @fires Datebox#change
   */
  set(value, { silent = false } = {}) {
    this._value = this._normalizeValue(value);
    this._picker?.set(this._value, { silent: true });
    this._setValid();
    this._syncDisplay();
    if (!silent) this.emit('change', { date: this._copyValue() });
    return this;
  }

  /**
   * Opens and positions the calendar popover, then moves focus into its grid.
   * @returns {this}
   * @fires Datebox#open
   */
  open() {
    if (this._disabled || this._open) return this;
    this._picker.set(this._value, { silent: true });
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
   * Closes the calendar popover.
   * @returns {this}
   * @fires Datebox#close
   */
  close() {
    this._close(false);
    return this;
  }

  /** Enables the datebox. @returns {this} */
  enable() {
    this._disabled = false;
    this._syncDisabled();
    return this;
  }

  /** Disables the datebox and closes its popover. @returns {this} */
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
    if (this._originalState === null) this.el.removeAttribute('data-state');
    else this.el.setAttribute('data-state', this._originalState);
    if (this._originalAriaDisabled === null) this.el.removeAttribute('aria-disabled');
    else this.el.setAttribute('aria-disabled', this._originalAriaDisabled);
    super.destroy();
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
    const text = this.refs.input.value.trim();
    if (text === '') {
      this.set(null);
      return;
    }
    const parsed = parseDate(text, this._format);
    if (!parsed) {
      this.el.dataset.state = 'invalid';
      this.refs.input.setAttribute('aria-invalid', 'true');
      this.emit('invalid', { text });
      return;
    }
    this.set(parsed);
  }

  /** @param {Date|number|string|null|unknown} value @returns {Date|null} */
  _normalizeValue(value) {
    let date = null;
    if (value instanceof Date && !Number.isNaN(value.getTime())) date = new Date(value.getTime());
    else if (typeof value === 'number' && Number.isFinite(value)) date = new Date(value * 1000);
    else if (typeof value === 'string') date = parseDate(value, this._format);
    if (!date || Number.isNaN(date.getTime())) return null;
    return clampDate(date, this._min, this._max);
  }

  /** @returns {void} */
  _syncDisplay() {
    this.refs.input.value = this._value ? formatDate(this._value, this._format) : '';
    this.refs.clear.hidden = !this.options.clearable || !this._value;
  }

  /** @returns {void} */
  _syncDisabled() {
    this.refs.input.disabled = this._disabled;
    this.refs.toggle.disabled = this._disabled;
    this.refs.clear.disabled = this._disabled;
    this.el.setAttribute('aria-disabled', String(this._disabled));
  }

  /** @returns {void} */
  _setValid() {
    if (this.el.dataset.state === 'invalid') {
      if (this._originalState === null) this.el.removeAttribute('data-state');
      else this.el.setAttribute('data-state', this._originalState);
    }
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

  /** @returns {Date|null} */
  _copyValue() {
    return this._value ? new Date(this._value.getTime()) : null;
  }
}

/**
 * Datebox factory with time selection enabled. It is callable with or without `new`.
 * @param {Element|string|null} target Existing component root, selector, or null.
 * @param {DateboxOptions} [options={}] Datebox options; `time` is always enabled.
 * @returns {Datebox}
 */
export const DateTimeBox = function DateTimeBox(target, options = {}) {
  return new Datebox(target, { ...options, time: true });
};

/** @event Datebox#change @type {CustomEvent<{date: Date|null}>} */
/** @event Datebox#invalid @type {CustomEvent<{text: string}>} */
/** @event Datebox#open @type {CustomEvent<Record<string, never>>} */
/** @event Datebox#close @type {CustomEvent<Record<string, never>>} */

/** @param {unknown} value @returns {Date|null} */
function validDate(value) {
  return value instanceof Date && !Number.isNaN(value.getTime()) ? new Date(value.getTime()) : null;
}

/** @param {unknown} format @param {unknown} time @returns {string} */
function effectiveFormat(format, time) {
  const value = String(format || '%d.%m.%Y');
  return time && !/%[HM]/.test(value) ? `${value} %H:%M` : value;
}

/** @param {string} format @returns {string} */
function placeholderFromFormat(format) {
  return format.replace(/%[demYyHMS]/g, (token) => ({
    '%d': 'DD',
    '%e': 'D',
    '%m': 'MM',
    '%Y': 'YYYY',
    '%y': 'YY',
    '%H': 'HH',
    '%M': 'MM',
    '%S': 'SS'
  })[token] ?? token);
}
