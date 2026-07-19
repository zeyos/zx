import { Component } from '../../core/component.js';
import { h } from '../../core/dom.js';

/** @typedef {'minutes'|'seconds'|'hours'} TimeUnit */
/** @typedef {{hours: number, minutes: number, seconds: number, negative: boolean}} TimeParts */
/**
 * @typedef {Object} TimeboxOptions
 * @property {number} [value=0] Initial duration in `unit`.
 * @property {TimeUnit} [unit='minutes'] Default input and output unit.
 * @property {boolean} [seconds=false] Show a seconds segment.
 * @property {boolean} [signed=false] Show a positive/negative toggle.
 * @property {boolean} [disabled=false] Disable all controls.
 * @property {(event: CustomEvent<{value: number}>) => void} [onchange] Change listener.
 */
/** @typedef {{silent?: boolean}} TimeboxSetOptions */

/**
 * Splits a duration into unlimited hours and normalized minute/second segments.
 * @param {number} value Duration value.
 * @param {TimeUnit} [unit='minutes'] Unit of `value`.
 * @returns {TimeParts}
 */
export function splitTime(value, unit = 'minutes') {
  const seconds = Math.round(Math.abs(toSeconds(finiteNumber(value), unit)));
  return {
    hours: Math.floor(seconds / 3600),
    minutes: Math.floor(seconds / 60) % 60,
    seconds: seconds % 60,
    negative: finiteNumber(value) < 0
  };
}

/**
 * Joins duration segments and converts them to the requested unit.
 * Minute and second overflow is carried into the unlimited hours value.
 * @param {Partial<TimeParts>} parts Duration segments.
 * @param {TimeUnit} [unit='minutes'] Unit of the returned number.
 * @returns {number}
 */
export function joinTime(parts, unit = 'minutes') {
  assertUnit(unit);
  const hours = Math.abs(Math.trunc(finiteNumber(parts?.hours)));
  const minutes = Math.abs(Math.trunc(finiteNumber(parts?.minutes)));
  const seconds = Math.abs(Math.trunc(finiteNumber(parts?.seconds)));
  const sign = parts?.negative ? -1 : 1;
  return fromSeconds(sign * (hours * 3600 + minutes * 60 + seconds), unit);
}

/**
 * Segmented duration input supporting unlimited and signed hours.
 * @fires Timebox#change
 */
export class Timebox extends Component {
  static cssName = 'timebox';

  /** @type {TimeboxOptions} */
  static defaults = {
    value: 0,
    unit: 'minutes',
    seconds: false,
    signed: false,
    disabled: false
  };

  /** @returns {HTMLElement} */
  render() {
    assertUnit(this.options.unit);
    const root = /** @type {HTMLElement} */ (this.el ?? h('div'));
    this._originalAriaDisabled = root.getAttribute('aria-disabled');
    this._disabled = Boolean(this.options.disabled);
    this._parts = { hours: 0, minutes: 0, seconds: 0, negative: false };
    this._inputs = [];
    const content = h('div', {
      class: 'zx-timebox__content',
      role: 'group',
      ariaLabel: this.options.seconds ? 'Duration in hours, minutes, and seconds' : 'Duration in hours and minutes'
    });
    this._content = content;

    if (this.options.signed) {
      content.append(h('button', {
        ref: 'sign',
        class: 'zx-timebox__sign',
        type: 'button',
        ariaLabel: 'Toggle duration sign',
        ariaPressed: 'false'
      }, '+'));
      this.listen(this.refs.sign, 'click', () => {
        if (this._disabled) return;
        this._parts.negative = !this._parts.negative;
        this._writeParts();
        this._emitChange();
      });
    }

    this._addSegment(content, 'hours', 'Hours', false);
    content.append(h('span', { class: 'zx-timebox__separator', ariaHidden: 'true' }, ':'));
    this._addSegment(content, 'minutes', 'Minutes', true);
    if (this.options.seconds) {
      content.append(h('span', { class: 'zx-timebox__separator', ariaHidden: 'true' }, ':'));
      this._addSegment(content, 'seconds', 'Seconds', true);
    }
    root.append(content);
    this.set(this.options.value, this.options.unit, { silent: true });
    this._syncDisabled();
    return root;
  }

  /**
   * Returns the current duration.
   * @param {TimeUnit} [unit=this.options.unit] Output unit.
   * @returns {number}
   */
  get(unit = this.options.unit) {
    return joinTime(this._readParts(), unit);
  }

  /**
   * Sets the current duration.
   * @param {number} value Duration value.
   * @param {TimeUnit|TimeboxSetOptions} [unit=this.options.unit] Input unit, or options when omitted.
   * @param {TimeboxSetOptions} [options={}] Update behavior.
   * @returns {this}
   * @fires Timebox#change
   */
  set(value, unit = this.options.unit, options = {}) {
    if (unit && typeof unit === 'object') {
      options = unit;
      unit = this.options.unit;
    }
    assertUnit(unit);
    let numeric = finiteNumber(value);
    if (!this.options.signed && numeric < 0) numeric = 0;
    if (!this.options.seconds) {
      numeric = fromSeconds(Math.round(toSeconds(numeric, unit) / 60) * 60, unit);
    }
    this._parts = splitTime(numeric, unit);
    if (!this.options.signed) this._parts.negative = false;
    this._writeParts();
    if (!options.silent) this._emitChange();
    return this;
  }

  /** Enables the timebox. @returns {this} */
  enable() {
    this._disabled = false;
    this._syncDisabled();
    return this;
  }

  /** Disables the timebox. @returns {this} */
  disable() {
    this._disabled = true;
    this._syncDisabled();
    return this;
  }

  /** Removes generated content from an enhanced target. @returns {void} */
  destroy() {
    this._content?.remove();
    if (this._originalAriaDisabled === null) this.el.removeAttribute('aria-disabled');
    else this.el.setAttribute('aria-disabled', this._originalAriaDisabled);
    super.destroy();
  }

  /** @param {HTMLElement} parent @param {'hours'|'minutes'|'seconds'} name @param {string} label @param {boolean} bounded @returns {void} */
  _addSegment(parent, name, label, bounded) {
    const input = h('input', {
      class: 'zx-timebox__segment',
      type: 'text',
      inputMode: 'numeric',
      autocomplete: 'off',
      ariaLabel: label,
      maxLength: bounded ? 2 : null,
      dataset: { segment: name, bounded: String(bounded) }
    });
    this._inputs.push(input);
    parent.append(input);
    this.listen(input, 'focus', () => input.select());
    this.listen(input, 'input', () => {
      if (name === 'hours' && this.options.signed && input.value.trim().startsWith('-')) {
        this._parts.negative = true;
      }
      const digits = input.value.replace(/\D/g, '');
      input.value = bounded ? digits.slice(0, 2) : digits;
    });
    this.listen(input, 'change', () => this._commitSegments());
    this.listen(input, 'keydown', (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      this._commitSegments();
      input.select();
    });
  }

  /** @returns {TimeParts} */
  _readParts() {
    const parts = { ...this._parts };
    for (const input of this._inputs) {
      const name = input.dataset.segment;
      const maximum = input.dataset.bounded === 'true' ? 59 : Number.MAX_SAFE_INTEGER;
      parts[name] = Math.max(0, Math.min(maximum, Math.trunc(finiteNumber(input.value))));
    }
    return parts;
  }

  /** @returns {void} */
  _commitSegments() {
    this._parts = this._readParts();
    this._writeParts();
    this._emitChange();
  }

  /** @returns {void} */
  _writeParts() {
    for (const input of this._inputs) {
      const name = input.dataset.segment;
      input.value = name === 'hours' ? String(this._parts[name]) : pad(this._parts[name]);
    }
    if (this.refs.sign) {
      this.refs.sign.textContent = this._parts.negative ? '-' : '+';
      this.refs.sign.setAttribute('aria-pressed', String(this._parts.negative));
      this.refs.sign.dataset.state = this._parts.negative ? 'negative' : 'positive';
    }
  }

  /** @returns {void} */
  _syncDisabled() {
    for (const input of this._inputs) input.disabled = this._disabled;
    if (this.refs.sign) this.refs.sign.disabled = this._disabled;
    this.el.setAttribute('aria-disabled', String(this._disabled));
  }

  /** @returns {void} */
  _emitChange() {
    this.emit('change', { value: this.get(this.options.unit) });
  }
}

/** @event Timebox#change @type {CustomEvent<{value: number}>} */

/** @param {unknown} value @returns {number} */
function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

/** @param {number} value @param {TimeUnit} unit @returns {number} */
function toSeconds(value, unit) {
  assertUnit(unit);
  if (unit === 'hours') return value * 3600;
  if (unit === 'minutes') return value * 60;
  return value;
}

/** @param {number} value @param {TimeUnit} unit @returns {number} */
function fromSeconds(value, unit) {
  assertUnit(unit);
  if (unit === 'hours') return value / 3600;
  if (unit === 'minutes') return value / 60;
  return value;
}

/** @param {unknown} unit @returns {asserts unit is TimeUnit} */
function assertUnit(unit) {
  if (unit !== 'hours' && unit !== 'minutes' && unit !== 'seconds') {
    throw new RangeError(`Unknown time unit: ${unit}`);
  }
}

/** @param {number} value @returns {string} */
function pad(value) {
  return String(value).padStart(2, '0');
}
