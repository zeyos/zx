import { Component } from '../../core/component.js';
import { h } from '../../core/dom.js';

/** @typedef {{h: number, m: number, s: number}} TimePickerValue */
/**
 * @typedef {Object} TimePickerOptions
 * @property {TimePickerValue|Date|null} [value=null] Initial local time.
 * @property {boolean} [seconds=false] Show the seconds spinbutton.
 * @property {number} [step=5] Minute increment used by arrow keys.
 * @property {(event: CustomEvent<{time: TimePickerValue}>) => void} [onchange] Change listener.
 */
/** @typedef {{silent?: boolean}} TimePickerSetOptions */

/**
 * Accessible segmented time picker made from spinbutton inputs.
 * @fires TimePicker#change
 */
export class TimePicker extends Component {
  static cssName = 'time-picker';

  /** @type {TimePickerOptions} */
  static defaults = { value: null, seconds: false, step: 5 };

  /** @returns {HTMLElement} */
  render() {
    const root = /** @type {HTMLElement} */ (this.el ?? h('div'));
    const initial = normalizeTime(this.options.value);
    this._value = initial;
    this._display = initial ?? { h: 0, m: 0, s: 0 };
    this._inputs = [];

    const content = h('div', {
      class: 'zx-time-picker__segments',
      role: 'group',
      ariaLabel: 'Time'
    });
    this._content = content;
    this._addSpin(content, 'h', 'Hour', 23);
    content.append(h('span', { class: 'zx-time-picker__separator', ariaHidden: 'true' }, ':'));
    this._addSpin(content, 'm', 'Minute', 59);
    if (this.options.seconds) {
      content.append(h('span', { class: 'zx-time-picker__separator', ariaHidden: 'true' }, ':'));
      this._addSpin(content, 's', 'Second', 59);
    }
    root.append(content);
    this._writeInputs();
    return root;
  }

  /**
   * Returns a copy of the selected time, or null when no initial value has been committed.
   * @returns {TimePickerValue|null}
   */
  get() {
    return this._value ? { ...this._value } : null;
  }

  /**
   * Sets the displayed local time.
   * @param {TimePickerValue|Date|null} value Time object, Date, or null.
   * @param {TimePickerSetOptions} [options={}] Update behavior.
   * @returns {this}
   * @fires TimePicker#change
   */
  set(value, { silent = false } = {}) {
    const normalized = normalizeTime(value);
    this._value = normalized;
    this._display = normalized ?? { h: 0, m: 0, s: 0 };
    this._writeInputs();
    if (!silent && normalized) this.emit('change', { time: { ...normalized } });
    return this;
  }

  /** Removes generated content from an enhanced target. @returns {void} */
  destroy() {
    this._content?.remove();
    super.destroy();
  }

  /** @param {HTMLElement} parent @param {'h'|'m'|'s'} segment @param {string} label @param {number} max @returns {void} */
  _addSpin(parent, segment, label, max) {
    const input = h('input', {
      class: 'zx-time-picker__spin',
      type: 'text',
      role: 'spinbutton',
      inputMode: 'numeric',
      maxLength: 2,
      autocomplete: 'off',
      ariaLabel: label,
      ariaValueMin: '0',
      ariaValueMax: String(max),
      dataset: { segment }
    });
    this._inputs.push(input);
    parent.append(input);
    this.listen(input, 'focus', () => input.select());
    this.listen(input, 'keydown', (event) => this._onKeydown(event, segment, max));
    this.listen(input, 'input', () => this._onInput(input, segment, max));
    this.listen(input, 'blur', () => this._commitFromInputs());
  }

  /** @param {KeyboardEvent} event @param {'h'|'m'|'s'} segment @param {number} max @returns {void} */
  _onKeydown(event, segment, max) {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
    event.preventDefault();
    const direction = event.key === 'ArrowUp' ? 1 : -1;
    const increment = segment === 'm' ? normalizeStep(this.options.step) : 1;
    const current = numberInRange(event.currentTarget.value, 0, max);
    const modulus = max + 1;
    const value = (current + direction * increment + modulus * increment) % modulus;
    event.currentTarget.value = pad(value);
    this._commitFromInputs();
  }

  /** @param {HTMLInputElement} input @param {'h'|'m'|'s'} segment @param {number} max @returns {void} */
  _onInput(input, segment, max) {
    input.value = input.value.replace(/\D/g, '').slice(0, 2);
    if (input.value.length < 2) return;
    input.value = pad(numberInRange(input.value, 0, max));
    this._commitFromInputs();
    const index = this._inputs.indexOf(input);
    this._inputs[index + 1]?.focus();
  }

  /** @returns {void} */
  _commitFromInputs() {
    const next = { h: 0, m: 0, s: 0 };
    for (const input of this._inputs) {
      const segment = input.dataset.segment;
      const max = segment === 'h' ? 23 : 59;
      next[segment] = numberInRange(input.value, 0, max);
    }
    const changed = !this._value || !sameTime(this._value, next);
    this._value = next;
    this._display = next;
    this._writeInputs();
    if (changed) this.emit('change', { time: { ...next } });
  }

  /** @returns {void} */
  _writeInputs() {
    for (const input of this._inputs) {
      const segment = input.dataset.segment;
      input.value = pad(this._display[segment]);
      input.setAttribute('aria-valuenow', String(this._display[segment]));
      input.setAttribute('aria-valuetext', input.value);
    }
  }
}

/**
 * Fired after a time is committed.
 * @event TimePicker#change
 * @type {CustomEvent<{time: TimePickerValue}>}
 */

/** @param {unknown} value @returns {TimePickerValue|null} */
function normalizeTime(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return { h: value.getHours(), m: value.getMinutes(), s: value.getSeconds() };
  }
  if (!value || typeof value !== 'object') return null;
  return {
    h: numberInRange(value.h, 0, 23),
    m: numberInRange(value.m, 0, 59),
    s: numberInRange(value.s, 0, 59)
  };
}

/** @param {unknown} value @param {number} min @param {number} max @returns {number} */
function numberInRange(value, min, max) {
  const number = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(number)) return min;
  return Math.max(min, Math.min(max, number));
}

/** @param {unknown} value @returns {number} */
function normalizeStep(value) {
  const number = Math.round(Number(value));
  return Number.isFinite(number) && number > 0 && number <= 59 ? number : 5;
}

/** @param {number} value @returns {string} */
function pad(value) {
  return String(value).padStart(2, '0');
}

/** @param {TimePickerValue} a @param {TimePickerValue} b @returns {boolean} */
function sameTime(a, b) {
  return a.h === b.h && a.m === b.m && a.s === b.s;
}
