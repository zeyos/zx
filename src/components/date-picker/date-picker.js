import { Component } from '../../core/component.js';
import { addDays, addMonths, formatDate, getWeekStart, isSameDay, parseDate } from '../../core/date.js';
import { h } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { TimePicker } from './time-picker.js';

/**
 * @typedef {Object} DatePickerOptions
 * @property {Date|null} [value=null] Initially selected date.
 * @property {Date|null} [min=null] Earliest selectable local calendar day.
 * @property {Date|null} [max=null] Latest selectable local calendar day.
 * @property {number} [weekStart=1] First weekday, from 0 (Sunday) through 6 (Saturday).
 * @property {boolean} [showWeekNumbers=false] Show ISO week numbers.
 * @property {boolean} [time=false] Append a time picker below the calendar.
 * @property {(event: CustomEvent<{date: Date|null}>) => void} [onchange] Change listener.
 * @property {(event: CustomEvent<{year: number, month: number}>) => void} [onmonthchange] Visible-month listener.
 */
/** @typedef {{silent?: boolean}} DatePickerSetOptions */

/**
 * Accessible inline calendar following the APG date-picker grid pattern.
 * @fires DatePicker#change
 * @fires DatePicker#monthchange
 */
export class DatePicker extends Component {
  static cssName = 'date-picker';

  /** @type {DatePickerOptions} */
  static defaults = {
    value: null,
    min: null,
    max: null,
    weekStart: 1,
    showWeekNumbers: false,
    time: false
  };

  /** @returns {HTMLElement} */
  render() {
    const root = /** @type {HTMLElement} */ (this.el ?? h('div'));
    this._min = dayOnly(validDate(this.options.min));
    this._max = dayOnly(validDate(this.options.max));
    this._value = this._normalizeValue(validDate(this.options.value));
    this._focused = dayOnly(this._value) ?? this._clampFocus(dayOnly(new Date()));
    this._viewYear = this._focused.getFullYear();
    this._viewMonth = this._focused.getMonth();
    this._weekStart = normalizeWeekStart(this.options.weekStart);
    this._quickOpen = false;
    this._timePicker = null;

    const surface = h('div', { class: 'zx-date-picker__surface' },
      h('div', { class: 'zx-date-picker__header' },
        h('button', {
          ref: 'previous',
          class: 'zx-date-picker__nav',
          type: 'button',
          ariaLabel: 'Previous month'
        }, icon('chevron-left')),
        h('button', {
          ref: 'heading',
          class: 'zx-date-picker__heading',
          type: 'button',
          ariaExpanded: 'false',
          'aria-haspopup': 'grid'
        }),
        h('button', {
          ref: 'next',
          class: 'zx-date-picker__nav',
          type: 'button',
          ariaLabel: 'Next month'
        }, icon('chevron-right'))
      ),
      h('div', {
        ref: 'quickPanel',
        class: 'zx-date-picker__quick',
        hidden: true
      },
      h('div', { class: 'zx-date-picker__quick-header' },
        h('button', {
          ref: 'quickPrevious',
          class: 'zx-date-picker__nav',
          type: 'button',
          ariaLabel: 'Previous year'
        }, icon('chevron-left')),
        h('span', { ref: 'quickYear', class: 'zx-date-picker__quick-year', ariaLive: 'polite' }),
        h('button', {
          ref: 'quickNext',
          class: 'zx-date-picker__nav',
          type: 'button',
          ariaLabel: 'Next year'
        }, icon('chevron-right'))
      ),
      h('div', { ref: 'quickGrid', class: 'zx-date-picker__quick-grid', role: 'grid' })),
      h('table', {
        ref: 'grid',
        class: 'zx-date-picker__grid',
        role: 'grid',
        ariaLabel: 'Calendar'
      },
      h('thead', { ref: 'weekdays' }),
      h('tbody', { ref: 'days' }))
    );
    this._content = surface;
    root.append(surface);

    this.listen(this.refs.previous, 'click', () => this._pageMonth(-1));
    this.listen(this.refs.next, 'click', () => this._pageMonth(1));
    this.listen(this.refs.heading, 'click', () => this._toggleQuickPick());
    this.listen(this.refs.quickPrevious, 'click', () => this._stepQuickYear(-1));
    this.listen(this.refs.quickNext, 'click', () => this._stepQuickYear(1));
    this.listen(this.refs.quickGrid, 'click', (event) => this._onQuickClick(event));
    this.listen(this.refs.quickGrid, 'keydown', (event) => this._onQuickKeydown(event));
    this.listen(this.refs.days, 'click', (event) => this._onDayClick(event));
    this.listen(this.refs.days, 'keydown', (event) => this._onDayKeydown(event));

    this._renderWeekdays();
    this._renderCalendar();

    if (this.options.time) {
      this._timePicker = new TimePicker(null, { value: this._value, seconds: false });
      this._timePicker.on('change', (event) => {
        const time = event.detail.time;
        const base = this._value ?? this._focused;
        const date = new Date(base.getTime());
        date.setHours(time.h, time.m, time.s, 0);
        this.set(date);
      });
      surface.append(this._timePicker.el);
    }
    return root;
  }

  /**
   * Returns a copy of the selected date.
   * @returns {Date|null}
   */
  get() {
    return cloneDate(this._value);
  }

  /**
   * Selects a date, clamped to the configured day bounds.
   * @param {Date|null} date Date to select, or null to clear.
   * @param {DatePickerSetOptions} [options={}] Update behavior.
   * @returns {this}
   * @fires DatePicker#change
   */
  set(date, { silent = false } = {}) {
    const normalized = this._normalizeValue(validDate(date));
    this._value = normalized;
    if (normalized) {
      this._focused = dayOnly(normalized);
      this._viewYear = normalized.getFullYear();
      this._viewMonth = normalized.getMonth();
    }
    this._timePicker?.set(normalized, { silent: true });
    this._renderCalendar();
    if (!silent) this.emit('change', { date: cloneDate(this._value) });
    return this;
  }

  /**
   * Moves focus to the currently roving calendar day.
   * @returns {this}
   */
  focus() {
    this._closeQuickPick();
    const button = this._buttonForDate(this._focused);
    button?.focus();
    return this;
  }

  /** Cleans up an appended time picker and generated host content. @returns {void} */
  destroy() {
    this._timePicker?.destroy();
    this._timePicker = null;
    this._content?.remove();
    super.destroy();
  }

  /** @param {Date|null} date @returns {Date|null} */
  _normalizeValue(date) {
    if (!date) return null;
    const result = new Date(date.getTime());
    const day = dayOnly(result);
    if (this._min && day < this._min) copyCalendarDate(result, this._min);
    if (this._max && day > this._max) copyCalendarDate(result, this._max);
    return result;
  }

  /** @param {Date} date @returns {Date} */
  _clampFocus(date) {
    if (this._min && date < this._min) return new Date(this._min.getTime());
    if (this._max && date > this._max) return new Date(this._max.getTime());
    return date;
  }

  /** @returns {void} */
  _renderWeekdays() {
    const row = h('tr');
    if (this.options.showWeekNumbers) {
      row.append(h('th', {
        class: 'zx-date-picker__week-heading',
        scope: 'col',
        ariaLabel: 'Week number'
      }, '#'));
    }
    const sunday = new Date(2023, 0, 1);
    for (let index = 0; index < 7; index += 1) {
      const weekday = addDays(sunday, (this._weekStart + index) % 7);
      row.append(h('th', {
        scope: 'col',
        ariaLabel: formatDate(weekday, '%A')
      }, formatDate(weekday, '%a')));
    }
    this.refs.weekdays.replaceChildren(row);
  }

  /** @returns {void} */
  _renderCalendar() {
    if (!this.refs?.days) return;
    const first = new Date(this._viewYear, this._viewMonth, 1);
    const offset = (first.getDay() - this._weekStart + 7) % 7;
    const start = addDays(first, -offset);
    this.refs.heading.textContent = formatDate(first, '%B %Y');
    this.refs.heading.setAttribute('aria-label', `Choose month and year, ${formatDate(first, '%B %Y')}`);
    const rows = [];

    for (let week = 0; week < 6; week += 1) {
      const rowStart = addDays(start, week * 7);
      const row = h('tr');
      if (this.options.showWeekNumbers) {
        row.append(h('th', {
          class: 'zx-date-picker__week',
          scope: 'row',
          ariaLabel: `Week ${isoWeekNumber(rowStart)}`
        }, String(isoWeekNumber(rowStart))));
      }
      for (let column = 0; column < 7; column += 1) {
        const date = addDays(rowStart, column);
        const selected = Boolean(this._value && isSameDay(date, this._value));
        const unavailable = !this._inRange(date);
        const button = h('button', {
          class: 'zx-date-picker__day',
          type: 'button',
          role: 'gridcell',
          tabindex: isSameDay(date, this._focused) ? 0 : -1,
          ariaSelected: String(selected),
          ariaDisabled: String(unavailable),
          ariaCurrent: isSameDay(date, new Date()) ? 'date' : null,
          ariaLabel: `${formatDate(date, '%e')} ${formatDate(date, '%B %Y')}`,
          dataset: {
            date: formatDate(date, '%Y-%m-%d'),
            otherMonth: date.getMonth() === this._viewMonth ? null : 'true'
          }
        }, formatDate(date, '%e'));
        row.append(h('td', { role: 'presentation' }, button));
      }
      rows.push(row);
    }
    this.refs.days.replaceChildren(...rows);
    if (this._quickOpen) this._renderQuickPick();
  }

  /** @param {Event} event @returns {void} */
  _onDayClick(event) {
    const button = event.target?.closest?.('[data-date]');
    if (!button || !this.refs.days.contains(button)) return;
    const date = parseDate(button.dataset.date, '%Y-%m-%d');
    if (date && this._inRange(date)) this._selectDate(date);
  }

  /** @param {KeyboardEvent} event @returns {void} */
  _onDayKeydown(event) {
    const button = event.target?.closest?.('[data-date]');
    if (!button || !this.refs.days.contains(button)) return;
    const current = parseDate(button.dataset.date, '%Y-%m-%d');
    if (!current) return;
    let next = null;
    if (event.key === 'ArrowLeft') next = addDays(current, -1);
    else if (event.key === 'ArrowRight') next = addDays(current, 1);
    else if (event.key === 'ArrowUp') next = addDays(current, -7);
    else if (event.key === 'ArrowDown') next = addDays(current, 7);
    else if (event.key === 'PageUp') next = addMonths(current, event.shiftKey ? -12 : -1);
    else if (event.key === 'PageDown') next = addMonths(current, event.shiftKey ? 12 : 1);
    else if (event.key === 'Home') next = addDays(current, -((current.getDay() - this._weekStart + 7) % 7));
    else if (event.key === 'End') next = addDays(current, 6 - ((current.getDay() - this._weekStart + 7) % 7));
    else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (this._inRange(current)) this._selectDate(current);
      return;
    }
    if (!next) return;
    event.preventDefault();
    this._moveFocus(next);
  }

  /** @param {Date} date @returns {void} */
  _moveFocus(date) {
    const monthChanged = date.getFullYear() !== this._viewYear || date.getMonth() !== this._viewMonth;
    this._focused = dayOnly(date);
    this._viewYear = date.getFullYear();
    this._viewMonth = date.getMonth();
    this._renderCalendar();
    if (monthChanged) this._emitMonthChange();
    this._buttonForDate(date)?.focus();
  }

  /** @param {Date} date @returns {void} */
  _selectDate(date) {
    const selected = new Date(date.getTime());
    const time = this._timePicker?.get();
    if (time) selected.setHours(time.h, time.m, time.s, 0);
    else if (this._value) selected.setHours(
      this._value.getHours(), this._value.getMinutes(), this._value.getSeconds(), this._value.getMilliseconds()
    );
    const monthChanged = selected.getFullYear() !== this._viewYear || selected.getMonth() !== this._viewMonth;
    this._value = selected;
    this._focused = dayOnly(selected);
    this._viewYear = selected.getFullYear();
    this._viewMonth = selected.getMonth();
    this._timePicker?.set(selected, { silent: true });
    this._renderCalendar();
    if (monthChanged) this._emitMonthChange();
    this.emit('change', { date: cloneDate(selected) });
  }

  /** @param {number} amount @returns {void} */
  _pageMonth(amount) {
    this._closeQuickPick();
    const date = addMonths(this._focused, amount);
    this._focused = dayOnly(date);
    this._viewYear = date.getFullYear();
    this._viewMonth = date.getMonth();
    this._renderCalendar();
    this._emitMonthChange();
  }

  /** @returns {void} */
  _emitMonthChange() {
    this.emit('monthchange', { year: this._viewYear, month: this._viewMonth });
  }

  /** @returns {void} */
  _toggleQuickPick() {
    if (this._quickOpen) {
      this._closeQuickPick();
      this.refs.heading.focus();
      return;
    }
    this._quickOpen = true;
    this.refs.quickPanel.hidden = false;
    this.refs.heading.setAttribute('aria-expanded', 'true');
    this._renderQuickPick();
    this.refs.quickGrid.querySelector('[tabindex="0"]')?.focus();
  }

  /** @returns {void} */
  _closeQuickPick() {
    if (!this._quickOpen) return;
    this._quickOpen = false;
    this.refs.quickPanel.hidden = true;
    this.refs.heading.setAttribute('aria-expanded', 'false');
  }

  /** @returns {void} */
  _renderQuickPick() {
    this.refs.quickYear.textContent = String(this._viewYear);
    const months = [];
    for (let month = 0; month < 12; month += 1) {
      const date = new Date(this._viewYear, month, 1);
      months.push(h('button', {
        class: 'zx-date-picker__quick-month',
        type: 'button',
        role: 'gridcell',
        tabindex: month === this._viewMonth ? 0 : -1,
        ariaSelected: String(month === this._viewMonth),
        dataset: { month }
      }, formatDate(date, '%b')));
    }
    this.refs.quickGrid.replaceChildren(...months);
  }

  /** @param {number} amount @returns {void} */
  _stepQuickYear(amount) {
    this._viewYear += amount;
    this._renderQuickPick();
    this._emitMonthChange();
    this.refs.quickGrid.querySelector('[tabindex="0"]')?.focus();
  }

  /** @param {Event} event @returns {void} */
  _onQuickClick(event) {
    const button = event.target?.closest?.('[data-month]');
    if (!button || !this.refs.quickGrid.contains(button)) return;
    this._chooseQuickMonth(Number(button.dataset.month));
  }

  /** @param {KeyboardEvent} event @returns {void} */
  _onQuickKeydown(event) {
    const button = event.target?.closest?.('[data-month]');
    if (!button || !this.refs.quickGrid.contains(button)) return;
    const month = Number(button.dataset.month);
    let next = null;
    if (event.key === 'ArrowLeft') next = month - 1;
    else if (event.key === 'ArrowRight') next = month + 1;
    else if (event.key === 'ArrowUp') next = month - 3;
    else if (event.key === 'ArrowDown') next = month + 3;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = 11;
    else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this._chooseQuickMonth(month);
      return;
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this._closeQuickPick();
      this.refs.heading.focus();
      return;
    }
    if (next === null) return;
    event.preventDefault();
    next = Math.max(0, Math.min(11, next));
    const items = this.refs.quickGrid.querySelectorAll('[data-month]');
    for (const item of items) item.tabIndex = Number(item.dataset.month) === next ? 0 : -1;
    items[next]?.focus();
  }

  /** @param {number} month @returns {void} */
  _chooseQuickMonth(month) {
    const date = new Date(this._viewYear, month, Math.min(
      this._focused.getDate(), new Date(this._viewYear, month + 1, 0).getDate()
    ));
    this._focused = dayOnly(date);
    this._viewMonth = month;
    this._closeQuickPick();
    this._renderCalendar();
    this._emitMonthChange();
    this.focus();
  }

  /** @param {Date} date @returns {boolean} */
  _inRange(date) {
    const day = dayOnly(date);
    return !(this._min && day < this._min) && !(this._max && day > this._max);
  }

  /** @param {Date} date @returns {HTMLButtonElement|null} */
  _buttonForDate(date) {
    return this.refs.days.querySelector(`[data-date="${formatDate(date, '%Y-%m-%d')}"]`);
  }
}

/**
 * Fired when the selected date changes.
 * @event DatePicker#change
 * @type {CustomEvent<{date: Date|null}>}
 */
/**
 * Fired when the visible month changes. Month is zero-based.
 * @event DatePicker#monthchange
 * @type {CustomEvent<{year: number, month: number}>}
 */

/** @param {unknown} value @returns {Date|null} */
function validDate(value) {
  return value instanceof Date && !Number.isNaN(value.getTime()) ? new Date(value.getTime()) : null;
}

/** @param {Date|null} date @returns {Date|null} */
function dayOnly(date) {
  if (!date) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** @param {Date|null} date @returns {Date|null} */
function cloneDate(date) {
  return date ? new Date(date.getTime()) : null;
}

/** @param {Date} target @param {Date} source @returns {void} */
function copyCalendarDate(target, source) {
  target.setFullYear(source.getFullYear(), source.getMonth(), source.getDate());
}

/** @param {unknown} value @returns {number} */
function normalizeWeekStart(value) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 && number <= 6 ? number : getWeekStart();
}

/** @param {Date} date @returns {number} */
function isoWeekNumber(date) {
  const utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const weekday = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - weekday);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  return Math.ceil((((utc.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}
