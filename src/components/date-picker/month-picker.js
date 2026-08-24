import { formatDate } from '../../core/date.js';
import { h } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { DatePicker } from './date-picker.js';

/**
 * @typedef {Object} MonthPickerOptions
 * @property {Date|null} [value=null] Initially selected month.
 * @property {Date|null} [min=null] Earliest selectable month.
 * @property {Date|null} [max=null] Latest selectable month.
 * @property {(event: CustomEvent<{date: Date|null}>) => void} [onchange] Change listener.
 */
/** @typedef {{silent?: boolean}} MonthPickerSetOptions */

/**
 * Twelve-month grid with a year stepper.
 * @fires MonthPicker#change
 */
export class MonthPicker extends DatePicker {
  static cssName = 'month-picker';

  /** @type {MonthPickerOptions} */
  static defaults = { value: null, min: null, max: null };

  /**
   * Creates a month picker with its narrower month-based option contract.
   * @param {Element|string|null} target Existing element, selector, or null.
   * @param {MonthPickerOptions} [options={}] Month-picker options.
   */
  constructor(target, options = {}) {
    super(target, options);
  }

  /** @returns {HTMLElement} */
  render() {
    const root = /** @type {HTMLElement} */ (this.el ?? h('div'));
    this._min = firstOfMonth(validDate(this.options.min));
    this._max = firstOfMonth(validDate(this.options.max));
    this._value = this._normalizeMonth(validDate(this.options.value));
    const initial = this._value ?? firstOfMonth(new Date());
    this._year = initial.getFullYear();
    this._focusedMonth = initial.getMonth();

    const content = h('div', { class: 'zx-month-picker__surface' },
      h('div', { class: 'zx-month-picker__header' },
        h('button', {
          ref: 'previousYear',
          class: 'zx-month-picker__nav',
          type: 'button',
          ariaLabel: 'Previous year'
        }, icon('chevron-left')),
        h('span', { ref: 'year', class: 'zx-month-picker__year', ariaLive: 'polite' }),
        h('button', {
          ref: 'nextYear',
          class: 'zx-month-picker__nav',
          type: 'button',
          ariaLabel: 'Next year'
        }, icon('chevron-right'))
      ),
      h('div', {
        ref: 'grid',
        class: 'zx-month-picker__grid',
        role: 'grid',
        ariaLabel: 'Choose month'
      })
    );
    this._content = content;
    root.append(content);
    this.listen(this.refs.previousYear, 'click', () => this._stepYear(-1));
    this.listen(this.refs.nextYear, 'click', () => this._stepYear(1));
    this.listen(this.refs.grid, 'click', (event) => this._onMonthClick(event));
    this.listen(this.refs.grid, 'keydown', (event) => this._onMonthKeydown(event));
    this._renderMonths();
    return root;
  }

  /** @returns {Date|null} */
  get() {
    return this._value ? new Date(this._value.getTime()) : null;
  }

  /**
   * Selects the first day of a month.
   * @param {Date|null} date Month to select, or null to clear.
   * @param {MonthPickerSetOptions} [options={}] Update behavior.
   * @returns {this}
   * @fires MonthPicker#change
   */
  set(date, { silent = false } = {}) {
    this._value = this._normalizeMonth(validDate(date));
    if (this._value) {
      this._year = this._value.getFullYear();
      this._focusedMonth = this._value.getMonth();
    }
    this._renderMonths();
    if (!silent) this.emit('change', { date: this.get() });
    return this;
  }

  /** @returns {this} */
  focus() {
    this._button(this._focusedMonth)?.focus();
    return this;
  }

  /** Removes generated content from an enhanced target. @returns {void} */
  destroy() {
    this._content?.remove();
    super.destroy();
  }

  /** @param {Date|null} date @returns {Date|null} */
  _normalizeMonth(date) {
    if (!date) return null;
    let result = firstOfMonth(date);
    if (this._min && result < this._min) result = new Date(this._min.getTime());
    if (this._max && result > this._max) result = new Date(this._max.getTime());
    return result;
  }

  /** @returns {void} */
  _renderMonths() {
    if (!this.refs?.grid) return;
    this.refs.year.textContent = String(this._year);
    const months = [];
    for (let month = 0; month < 12; month += 1) {
      const date = new Date(this._year, month, 1);
      const selected = Boolean(this._value && sameMonth(date, this._value));
      months.push(h('button', {
        class: 'zx-month-picker__month',
        type: 'button',
        role: 'gridcell',
        tabindex: month === this._focusedMonth ? 0 : -1,
        ariaSelected: String(selected),
        ariaDisabled: String(!this._inRange(date)),
        ariaLabel: formatDate(date, '%B %Y'),
        dataset: { month }
      }, formatDate(date, '%b')));
    }
    this.refs.grid.replaceChildren(...months);
  }

  /** @param {number} amount @returns {void} */
  _stepYear(amount) {
    this._year += amount;
    this._renderMonths();
  }

  /** @param {Event} event @returns {void} */
  _onMonthClick(event) {
    const button = event.target?.closest?.('[data-month]');
    if (!button || !this.refs.grid.contains(button)) return;
    this._selectMonth(Number(button.dataset.month));
  }

  /** @param {KeyboardEvent} event @returns {void} */
  _onMonthKeydown(event) {
    const button = event.target?.closest?.('[data-month]');
    if (!button || !this.refs.grid.contains(button)) return;
    const current = Number(button.dataset.month);
    let delta = null;
    if (event.key === 'ArrowLeft') delta = -1;
    else if (event.key === 'ArrowRight') delta = 1;
    else if (event.key === 'ArrowUp') delta = -3;
    else if (event.key === 'ArrowDown') delta = 3;
    else if (event.key === 'Home') delta = -(current % 3);
    else if (event.key === 'End') delta = 2 - (current % 3);
    else if (event.key === 'PageUp') {
      event.preventDefault();
      this._stepYear(-1);
      this.focus();
      return;
    } else if (event.key === 'PageDown') {
      event.preventDefault();
      this._stepYear(1);
      this.focus();
      return;
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this._selectMonth(current);
      return;
    }
    if (delta === null) return;
    event.preventDefault();
    const absolute = this._year * 12 + current + delta;
    this._year = Math.floor(absolute / 12);
    this._focusedMonth = ((absolute % 12) + 12) % 12;
    this._renderMonths();
    this.focus();
  }

  /** @param {number} month @returns {void} */
  _selectMonth(month) {
    const date = new Date(this._year, month, 1);
    if (!this._inRange(date)) return;
    this._focusedMonth = month;
    this._value = date;
    this._renderMonths();
    this.emit('change', { date: this.get() });
  }

  /** @param {Date} date @returns {boolean} */
  _inRange(date) {
    return !(this._min && date < this._min) && !(this._max && date > this._max);
  }

  /** @param {number} month @returns {HTMLButtonElement|null} */
  _button(month) {
    return this.refs.grid.querySelector(`[data-month="${month}"]`);
  }
}

/**
 * Fired when the selected month changes.
 * @event MonthPicker#change
 * @type {CustomEvent<{date: Date|null}>}
 */

/** @param {unknown} value @returns {Date|null} */
function validDate(value) {
  return value instanceof Date && !Number.isNaN(value.getTime()) ? new Date(value.getTime()) : null;
}

/** @param {Date|null} date @returns {Date|null} */
function firstOfMonth(date) {
  return date ? new Date(date.getFullYear(), date.getMonth(), 1) : null;
}

/** @param {Date} a @param {Date} b @returns {boolean} */
function sameMonth(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}
