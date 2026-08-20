import { Component } from '../../core/component.js';
import { addDays, addMonths, formatDate, getWeekStart, isSameDay } from '../../core/date.js';
import { h } from '../../core/dom.js';
import { printf, translate } from '../../core/i18n.js';
import { icon } from '../../core/icons.js';

/** @typedef {{start: Date|null, end: Date|null}} DateRange */
/** @typedef {'start'|'middle'|'end'} DateRangeState */

/**
 * @typedef {Object} DateRangeBounds
 * @property {Date|null} [min=null] Earliest selectable local calendar day.
 * @property {Date|null} [max=null] Latest selectable local calendar day.
 * @property {number} [minNights=0] Smallest number of nights a complete range may span.
 * @property {number|null} [maxNights=null] Largest number of nights a complete range may span.
 */

/**
 * @typedef {Object} DateRangePreset
 * @property {string} name Stable identifier, emitted on the preset button as `data-preset`.
 * @property {string} label Button text.
 * @property {() => DateRange} range Factory returning the range the preset applies.
 */

/**
 * @typedef {Object} DateRangePickerOptions
 * @property {Date|null} [start=null] Initially selected first day.
 * @property {Date|null} [end=null] Initially selected last day.
 * @property {Date|null} [min=null] Earliest selectable local calendar day.
 * @property {Date|null} [max=null] Latest selectable local calendar day.
 * @property {number} [months=2] Month panels to render; narrow containers show only the first.
 * @property {number} [weekStart=1] First weekday, from 0 (Sunday) through 6 (Saturday).
 * @property {boolean} [showWeekNumbers=false] Show ISO week numbers.
 * @property {number} [minNights=0] Smallest number of nights a complete range may span.
 * @property {number|null} [maxNights=null] Largest number of nights a complete range may span.
 * @property {DateRangePreset[]|boolean} [presets=[]] Preset buttons, or `true` for the built-in set.
 * @property {boolean} [disabled=false] Disable every control.
 * @property {(event: CustomEvent<DateRange>) => void} [onchange] Complete-range listener.
 * @property {(event: CustomEvent<DateRange>) => void} [onselect] Every-click listener.
 * @property {(event: CustomEvent<{year: number, month: number}>) => void} [onmonthchange] Visible-month listener.
 */
/** @typedef {{silent?: boolean}} DateRangePickerSetOptions */

const WEEK_ROWS = 6;
const DAY_MS = 86400000;

/**
 * Puts a start/end pair in chronological order at local midnight.
 * Values that are not usable `Date` instances become `null`.
 * @param {unknown} start Range start.
 * @param {unknown} end Range end.
 * @returns {DateRange}
 */
export function normalizeRange(start, end) {
  const first = dayOnly(validDate(start));
  const second = dayOnly(validDate(end));
  if (first && second && first.getTime() > second.getTime()) return { start: second, end: first };
  return { start: first, end: second };
}

/**
 * Counts the nights between two days. The same day spans zero nights, and the count is derived
 * from calendar days so daylight-saving transitions never add or drop a night.
 * @param {unknown} start Range start.
 * @param {unknown} end Range end.
 * @returns {number} Nights, or `0` when the range is incomplete.
 */
export function rangeNights(start, end) {
  const range = normalizeRange(start, end);
  if (!range.start || !range.end) return 0;
  return Math.round((utcDay(range.end) - utcDay(range.start)) / DAY_MS);
}

/**
 * Classifies one day against a range. A half-open range only matches its single endpoint, and a
 * one-day range reports `'start'`.
 * @param {unknown} day Day to classify.
 * @param {unknown} start Range start.
 * @param {unknown} end Range end.
 * @returns {DateRangeState|null} The day's role, or `null` when it is outside the range.
 */
export function rangeStateOf(day, start, end) {
  const date = dayOnly(validDate(day));
  if (!date) return null;
  const range = normalizeRange(start, end);
  if (!range.start && !range.end) return null;
  if (!range.end) return isSameDay(date, /** @type {Date} */ (range.start)) ? 'start' : null;
  if (!range.start) return isSameDay(date, range.end) ? 'end' : null;
  if (date.getTime() < range.start.getTime() || date.getTime() > range.end.getTime()) return null;
  if (isSameDay(date, range.start)) return 'start';
  if (isSameDay(date, range.end)) return 'end';
  return 'middle';
}

/**
 * Normalizes a range and pulls it inside the configured bounds: endpoints are clamped into
 * `min`/`max`, an over-long range is shortened to `maxNights`, and a too-short one is stretched to
 * `minNights` — moving `end` forward, or `start` backward when `max` blocks the way. When the
 * `min`/`max` window itself is narrower than `minNights` the range cannot be honoured and both
 * endpoints come back `null`.
 * @param {DateRange|null|undefined} range Range to clamp.
 * @param {DateRangeBounds} [bounds={}] Selection bounds.
 * @returns {DateRange} A new range of new `Date` objects.
 */
export function clampRange(range, bounds = {}) {
  const min = dayOnly(validDate(bounds.min));
  const max = dayOnly(validDate(bounds.max));
  const least = normalizeNightCount(bounds.minNights) ?? 0;
  const most = normalizeNightCount(bounds.maxNights);
  let { start, end } = normalizeRange(range?.start, range?.end);

  if (start) start = clampDay(start, min, max);
  if (end) end = clampDay(end, min, max);
  if (!start || !end) return { start, end };

  if (most !== null && rangeNights(start, end) > most) end = addDays(start, most);
  if (least > 0 && rangeNights(start, end) < least) {
    end = addDays(start, least);
    if (max && end.getTime() > max.getTime()) {
      end = new Date(max.getTime());
      start = addDays(end, -least);
      if (min && start.getTime() < min.getTime()) return { start: null, end: null };
    }
  }
  return { start, end };
}

/**
 * Inline two-month range calendar following the APG date-picker grid pattern. Both grids form a
 * single roving-focus unit, so arrowing off the end of one month continues in the next.
 * @fires DateRangePicker#change
 * @fires DateRangePicker#select
 * @fires DateRangePicker#monthchange
 * @extends {Component<DateRangePickerOptions>}
 */
export class DateRangePicker extends Component {
  static cssName = 'date-range-picker';

  /** @type {DateRangePickerOptions} */
  static defaults = {
    start: null,
    end: null,
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

  // Every field below is initialized here rather than as a class field: render() runs inside the
  // base constructor, before class-field initializers would overwrite it (see AGENTS.md).

  /** @returns {HTMLElement} */
  render() {
    const root = /** @type {HTMLElement} */ (this.el ?? h('div'));
    this.el = root;
    this._rootAttributes = rememberAttributes(root, [
      'role', 'aria-label', 'aria-disabled', 'data-months', 'data-presets'
    ]);
    this._min = dayOnly(validDate(this.options.min));
    this._max = dayOnly(validDate(this.options.max));
    this._minNights = normalizeNightCount(this.options.minNights) ?? 0;
    this._maxNights = normalizeNightCount(this.options.maxNights);
    this._weekStart = normalizeWeekStart(this.options.weekStart);
    this._monthCount = normalizeMonthCount(this.options.months);
    this._presets = normalizePresets(this.options.presets);
    this._disabled = Boolean(this.options.disabled);
    this._hover = null;
    /** @type {{date: Date, cell: HTMLTableCellElement, button: HTMLButtonElement}[]} */
    this._dayCells = [];

    const initial = clampRange({ start: this.options.start, end: this.options.end }, this._bounds());
    this._start = initial.start;
    this._end = initial.end;
    // A start without an end is already the half-picked state, exactly as set() leaves it.
    this._picking = Boolean(initial.start && !initial.end);
    this._remember();
    this._focused = cloneDate(this._start) ?? this._clampFocus(dayOnly(new Date()));
    this._viewYear = this._focused.getFullYear();
    this._viewMonth = this._focused.getMonth();

    root.setAttribute('role', 'group');
    root.setAttribute('aria-label', text('daterange.label', 'Date range'));
    root.dataset.months = String(this._monthCount);
    if (this._presets.length) root.dataset.presets = 'true';

    const surface = h('div', { class: 'zx-date-range-picker__surface' },
      this._presets.length ? h('div', {
        ref: 'presets',
        class: 'zx-date-range-picker__presets',
        role: 'group',
        ariaLabel: text('daterange.presets', 'Date range presets')
      }, this._presets.map((preset) => h('button', {
        class: 'zx-date-range-picker__preset',
        type: 'button',
        dataset: { preset: preset.name }
      }, preset.label))) : null,
      h('div', { ref: 'calendars', class: 'zx-date-range-picker__calendars' })
    );
    const status = h('div', {
      ref: 'status',
      class: 'zx-date-range-picker__status',
      role: 'status',
      ariaLive: 'polite'
    });
    this._nodes = [surface, status];
    root.append(surface, status);

    if (this.refs.presets) this.listen(this.refs.presets, 'click', (event) => this._onPresetClick(event));
    this.listen(this.refs.calendars, 'click', (event) => this._onCalendarClick(event));
    this.listen(this.refs.calendars, 'keydown', (event) => this._onDayKeydown(event));
    this.listen(this.refs.calendars, 'mouseover', (event) => this._onDayHover(event));
    this.listen(this.refs.calendars, 'mouseleave', () => this._setHover(null));

    this._renderCalendars();
    this._announce();
    return root;
  }

  /**
   * Returns copies of the selected endpoints; the internal dates are never handed out.
   * @returns {DateRange}
   */
  get() {
    return { start: cloneDate(this._start), end: cloneDate(this._end) };
  }

  /**
   * Selects a range, clamped to the configured bounds, and scrolls the first visible month to the
   * range start.
   * @param {DateRange|null} [range={}] Range to select; omit either endpoint to clear it.
   * @param {DateRangePickerSetOptions} [options={}] Update behavior.
   * @returns {this}
   * @fires DateRangePicker#change
   * @fires DateRangePicker#monthchange
   */
  set(range = {}, { silent = false } = {}) {
    const next = clampRange({ start: range?.start ?? null, end: range?.end ?? null }, this._bounds());
    this._start = next.start;
    this._end = next.end;
    this._picking = Boolean(next.start && !next.end);
    this._remember();
    this._hover = null;
    if (next.start) {
      this._focused = cloneDate(next.start);
      this._setView(next.start);
    } else {
      this._paint();
    }
    this._announce();
    if (!silent) this.emit('change', this.get());
    return this;
  }

  /**
   * Clears the selection.
   * @param {DateRangePickerSetOptions} [options={}] Update behavior.
   * @returns {this}
   * @fires DateRangePicker#change
   */
  clear({ silent = false } = {}) {
    return this.set({ start: null, end: null }, { silent });
  }

  /**
   * Moves focus to the currently roving calendar day.
   * @returns {this}
   */
  focus() {
    this._buttonForDate(this._focused)?.focus();
    return this;
  }

  /** Enables every control. @returns {this} */
  enable() {
    this._disabled = false;
    this._paint();
    this._syncDisabled();
    return this;
  }

  /** Disables every control. @returns {this} */
  disable() {
    this._disabled = true;
    this._hover = null;
    this._paint();
    this._syncDisabled();
    return this;
  }

  /** Removes generated content and restores the host element's attributes. @returns {void} */
  destroy() {
    for (const node of this._nodes ?? []) node.remove();
    this._nodes = [];
    this._dayCells = [];
    restoreAttributes(this.el, this._rootAttributes ?? new Map());
    super.destroy();
  }

  /* --------------------------------------------------------------------- selection -- */

  /** @returns {DateRangeBounds} */
  _bounds() {
    return {
      min: this._min,
      max: this._max,
      minNights: this._minNights,
      maxNights: this._maxNights
    };
  }

  /**
   * Reports whether a day may be clicked. Days before the pending start always may — they restart
   * the range there instead of producing an inverted one.
   * @param {Date} date Day to test.
   * @returns {boolean}
   */
  _selectable(date) {
    const day = dayOnly(date);
    if (!day) return false;
    if (this._min && day.getTime() < this._min.getTime()) return false;
    if (this._max && day.getTime() > this._max.getTime()) return false;
    if (!this._picking || !this._start) return true;
    if (day.getTime() <= this._start.getTime()) return true;
    const nights = rangeNights(this._start, day);
    if (nights < this._minNights) return false;
    if (this._maxNights !== null && nights > this._maxNights) return false;
    return true;
  }

  /**
   * Applies one day click: the first sets the start, the second the end, and a click on or before
   * the pending start restarts the range there.
   * @param {Date} date Clicked day.
   * @returns {void}
   * @fires DateRangePicker#select
   * @fires DateRangePicker#change
   */
  _choose(date) {
    const day = dayOnly(date);
    if (this._disabled || !day || !this._selectable(day)) return;
    const extending = this._picking && this._start && day.getTime() > this._start.getTime();
    if (extending) {
      this._end = day;
      this._picking = false;
      this._remember();
    } else {
      this._start = day;
      this._end = null;
      this._picking = true;
    }
    this._focused = day;
    this._hover = null;
    this._paint();
    this._announce();
    this.emit('select', this.get());
    if (!this._picking) this.emit('change', this.get());
  }

  /**
   * Snapshots the selection Escape falls back to. Only a complete range is worth restoring, so a
   * half-open one is remembered as no selection at all.
   * @returns {void}
   */
  _remember() {
    const complete = Boolean(this._start && this._end);
    this._committedStart = complete ? cloneDate(this._start) : null;
    this._committedEnd = complete ? cloneDate(this._end) : null;
  }

  /**
   * Abandons a half-picked range, restoring the last complete selection.
   * @returns {boolean} Whether a half-picked range was discarded.
   * @fires DateRangePicker#select
   */
  _abandon() {
    if (!this._picking) return false;
    this._start = cloneDate(this._committedStart);
    this._end = cloneDate(this._committedEnd);
    this._picking = false;
    this._hover = null;
    this._paint();
    this._announce();
    this.emit('select', this.get());
    return true;
  }

  /* ------------------------------------------------------------------------ view -- */

  /** @param {Date} date @returns {Date} */
  _clampFocus(date) {
    return clampDay(date, this._min, this._max);
  }

  /**
   * Counts the month panels the container query is currently showing, falling back to the
   * configured count while the picker is not rendered.
   * @returns {number}
   */
  _visibleMonthCount() {
    const panels = this.refs.calendars?.children ?? [];
    let count = 0;
    for (const panel of panels) if (panel.getClientRects().length > 0) count += 1;
    return count || this._monthCount;
  }

  /**
   * Points the first visible month at a date's month.
   * @param {Date} date Day whose month becomes the leftmost panel.
   * @returns {void}
   * @fires DateRangePicker#monthchange
   */
  _setView(date) {
    const changed = date.getFullYear() !== this._viewYear || date.getMonth() !== this._viewMonth;
    this._viewYear = date.getFullYear();
    this._viewMonth = date.getMonth();
    // Repaint rather than rebuild when the months on screen stay the same, so a set() that lands
    // inside the current view does not drop the focused day cell.
    if (!changed) {
      this._paint();
      return;
    }
    this._renderCalendars();
    this._emitMonthChange();
  }

  /**
   * Shifts the view by the smallest number of months that brings a date into a visible panel.
   * @param {Date} date Day that must be visible.
   * @returns {boolean} Whether the view moved.
   */
  _ensureVisible(date) {
    const visible = this._visibleMonthCount();
    const offset = monthIndex(date) - (this._viewYear * 12 + this._viewMonth);
    if (offset >= 0 && offset < visible) return false;
    const shift = offset < 0 ? offset : offset - (visible - 1);
    const base = new Date(this._viewYear, this._viewMonth + shift, 1);
    this._viewYear = base.getFullYear();
    this._viewMonth = base.getMonth();
    return true;
  }

  /** @param {number} amount @returns {void} */
  _pageView(amount) {
    if (this._disabled) return;
    const base = new Date(this._viewYear, this._viewMonth + amount, 1);
    this._viewYear = base.getFullYear();
    this._viewMonth = base.getMonth();
    this._focused = this._focusInView(this._focused);
    this._renderCalendars();
    this._emitMonthChange();
  }

  /**
   * Keeps the roving tab stop inside the visible panels after the view moved on its own.
   * @param {Date} date Current roving day.
   * @returns {Date}
   */
  _focusInView(date) {
    const visible = this._visibleMonthCount();
    const offset = monthIndex(date) - (this._viewYear * 12 + this._viewMonth);
    if (offset >= 0 && offset < visible) return date;
    const lastDay = new Date(this._viewYear, this._viewMonth + 1, 0).getDate();
    return new Date(this._viewYear, this._viewMonth, Math.min(date.getDate(), lastDay));
  }

  /** @param {Date} date @returns {void} */
  _moveFocus(date) {
    const target = dayOnly(date);
    this._focused = target;
    if (this._ensureVisible(target)) {
      this._renderCalendars();
      this._emitMonthChange();
    } else {
      this._paint();
    }
    this._buttonForDate(target)?.focus();
  }

  /** @returns {void} */
  _emitMonthChange() {
    this.emit('monthchange', { year: this._viewYear, month: this._viewMonth });
  }

  /* ---------------------------------------------------------------------- events -- */

  /** @param {Event} event @returns {void} */
  _onPresetClick(event) {
    const button = /** @type {Element} */ (event.target)?.closest?.('[data-preset]');
    if (!button || this._disabled) return;
    const preset = this._presets.find((entry) => entry.name === button.dataset.preset);
    if (!preset) return;
    const range = preset.range();
    this.set({ start: range?.start ?? null, end: range?.end ?? null }, { silent: true });
    this.emit('select', this.get());
    this.emit('change', this.get());
  }

  /** @param {Event} event @returns {void} */
  _onCalendarClick(event) {
    const target = /** @type {Element} */ (event.target);
    const nav = target?.closest?.('[data-nav]');
    if (nav) {
      this._pageView(nav.dataset.nav === 'next' ? 1 : -1);
      return;
    }
    const day = this._cellFor(target);
    if (day) this._choose(day.date);
  }

  /** @param {Event} event @returns {void} */
  _onDayHover(event) {
    const day = this._cellFor(/** @type {Element} */ (event.target));
    this._setHover(day ? day.date : null);
  }

  /** @param {Date|null} date @returns {void} */
  _setHover(date) {
    if (this._disabled || !this._picking) return;
    const next = date ? dayOnly(date) : null;
    const same = (!next && !this._hover) || (next && this._hover && isSameDay(next, this._hover));
    if (same) return;
    this._hover = next;
    this._paint();
  }

  /** @param {KeyboardEvent} event @returns {void} */
  _onDayKeydown(event) {
    const day = this._cellFor(/** @type {Element} */ (event.target));
    if (!day) return;
    const current = day.date;
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
      this._choose(current);
      return;
    } else if (event.key === 'Escape') {
      // Only swallow Escape while a range is half picked; otherwise an enclosing popover closes.
      if (!this._abandon()) return;
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (!next || this._disabled) return;
    event.preventDefault();
    this._moveFocus(next);
  }

  /* ------------------------------------------------------------------ rendering -- */

  /** @returns {void} */
  _renderCalendars() {
    if (!this.refs?.calendars) return;
    this._dayCells = [];
    const panels = [];
    for (let index = 0; index < this._monthCount; index += 1) {
      panels.push(this._renderMonth(new Date(this._viewYear, this._viewMonth + index, 1)));
    }
    this.refs.calendars.replaceChildren(...panels);
    this._paint();
    this._syncDisabled();
  }

  /** @param {Date} first First day of the month to render. @returns {HTMLElement} */
  _renderMonth(first) {
    const caption = formatDate(first, '%B %Y');
    const offset = (first.getDay() - this._weekStart + 7) % 7;
    const gridStart = addDays(first, -offset);
    const rows = [];

    for (let week = 0; week < WEEK_ROWS; week += 1) {
      const rowStart = addDays(gridStart, week * 7);
      const row = h('tr');
      const inMonth = weekTouchesMonth(rowStart, first);
      if (this.options.showWeekNumbers) {
        row.append(h('th', {
          class: 'zx-date-range-picker__week',
          scope: 'row',
          ariaLabel: inMonth ? text('daterange.week', 'Week %1', [isoWeekNumber(rowStart)]) : null
        }, inMonth ? String(isoWeekNumber(rowStart)) : ''));
      }
      for (let column = 0; column < 7; column += 1) {
        const date = addDays(rowStart, column);
        const cell = h('td', { role: 'presentation' });
        if (date.getMonth() === first.getMonth() && date.getFullYear() === first.getFullYear()) {
          const button = h('button', {
            class: 'zx-date-range-picker__day',
            type: 'button',
            role: 'gridcell',
            tabindex: -1,
            dataset: { date: formatDate(date, '%Y-%m-%d') }
          }, formatDate(date, '%e'));
          cell.append(button);
          this._dayCells.push({ date, cell, button });
        }
        row.append(cell);
      }
      rows.push(row);
    }

    return h('div', { class: 'zx-date-range-picker__month' },
      h('div', { class: 'zx-date-range-picker__header' },
        h('button', {
          class: 'zx-date-range-picker__nav',
          type: 'button',
          dataset: { nav: 'previous' },
          ariaLabel: text('daterange.previousMonth', 'Previous month')
        }, icon('chevron-left')),
        h('div', { class: 'zx-date-range-picker__caption', ariaHidden: 'true' }, caption),
        h('button', {
          class: 'zx-date-range-picker__nav',
          type: 'button',
          dataset: { nav: 'next' },
          ariaLabel: text('daterange.nextMonth', 'Next month')
        }, icon('chevron-right'))),
      h('table', {
        class: 'zx-date-range-picker__grid',
        role: 'grid',
        ariaLabel: caption
      },
      h('thead', {}, this._weekdayRow()),
      h('tbody', {}, ...rows)));
  }

  /** @returns {HTMLTableRowElement} */
  _weekdayRow() {
    const row = h('tr');
    if (this.options.showWeekNumbers) {
      row.append(h('th', {
        class: 'zx-date-range-picker__week-heading',
        scope: 'col',
        ariaLabel: text('daterange.weekNumber', 'Week number')
      }, '#'));
    }
    const sunday = new Date(2023, 0, 1);
    for (let index = 0; index < 7; index += 1) {
      const weekday = addDays(sunday, (this._weekStart + index) % 7);
      row.append(h('th', { scope: 'col', ariaLabel: formatDate(weekday, '%A') }, formatDate(weekday, '%a')));
    }
    return /** @type {HTMLTableRowElement} */ (row);
  }

  /**
   * Refreshes every day cell's range, selection, and focus state without rebuilding the grids, so
   * hovering and arrowing never disturb the focused element.
   * @returns {void}
   */
  _paint() {
    const today = new Date();
    // Exactly one day carries the tab stop, across both grids: they are one roving-focus unit.
    let roving = null;
    for (const entry of this._dayCells) {
      if (isSameDay(entry.date, this._focused)) roving = entry;
    }
    if (!roving) roving = this._dayCells[0] ?? null;

    for (const entry of this._dayCells) {
      const { date, cell, button } = entry;
      const state = this._dayState(date);
      setDataset(cell, 'range', state.range);
      setDataset(cell, 'rangeEdge', state.edge);
      setDataset(button, 'range', state.range);
      button.tabIndex = entry === roving ? 0 : -1;
      button.setAttribute('aria-selected', String(state.range !== null && state.range !== 'preview'));
      button.setAttribute('aria-disabled', String(!this._selectable(date)));
      button.setAttribute('aria-label', this._dayLabel(date, state.range));
      if (isSameDay(date, today)) button.setAttribute('aria-current', 'date');
      else button.removeAttribute('aria-current');
    }
  }

  /**
   * Resolves how a day should paint: committed endpoints and band, or the live preview while an
   * end date is being picked.
   * @param {Date} date Day to classify.
   * @returns {{range: DateRangeState|'preview'|null, edge: 'start'|'end'|'both'|null}}
   */
  _dayState(date) {
    if (this._start && this._end) {
      const range = rangeStateOf(date, this._start, this._end);
      if (!range) return { range: null, edge: null };
      const solo = isSameDay(this._start, this._end);
      if (range === 'start') return { range, edge: solo ? 'both' : 'start' };
      if (range === 'end') return { range, edge: solo ? 'both' : 'end' };
      return { range, edge: null };
    }
    if (!this._start) return { range: null, edge: null };
    const preview = this._previewEnd();
    if (isSameDay(date, this._start)) return { range: 'start', edge: preview ? 'start' : 'both' };
    if (!preview) return { range: null, edge: null };
    if (date.getTime() > this._start.getTime() && date.getTime() <= preview.getTime()) {
      return { range: 'preview', edge: isSameDay(date, preview) ? 'end' : null };
    }
    return { range: null, edge: null };
  }

  /**
   * The day the range would end at right now — the hovered day, or the roving focus when the
   * pointer is elsewhere.
   * @returns {Date|null}
   */
  _previewEnd() {
    if (!this._picking || !this._start || this._disabled) return null;
    const candidate = this._hover ?? this._focused;
    if (!candidate) return null;
    const day = dayOnly(candidate);
    if (day.getTime() <= this._start.getTime()) return null;
    return this._selectable(day) ? day : null;
  }

  /** @param {Date} date @param {string|null} state @returns {string} */
  _dayLabel(date, state) {
    const base = formatDate(date, '%A, %e %B %Y');
    if (state === 'start') return `${base}, ${text('daterange.day.start', 'range start')}`;
    if (state === 'end') return `${base}, ${text('daterange.day.end', 'range end')}`;
    if (state === 'middle') return `${base}, ${text('daterange.day.middle', 'in selected range')}`;
    return base;
  }

  /** @returns {void} */
  _syncDisabled() {
    this.el.setAttribute('aria-disabled', String(this._disabled));
    for (const button of this.el.querySelectorAll('button')) button.disabled = this._disabled;
  }

  /** Writes the current selection into the visually hidden live region. @returns {void} */
  _announce() {
    if (!this.refs?.status) return;
    this.refs.status.textContent = this._selectionLabel();
  }

  /** @returns {string} */
  _selectionLabel() {
    if (!this._start) return text('daterange.status.empty', 'No date range selected');
    if (!this._end) {
      return text('daterange.status.start', '%1 selected, choose an end date',
        [formatDate(this._start, '%e %B %Y')]);
    }
    const nights = rangeNights(this._start, this._end);
    const spans = nights === 1
      ? text('daterange.night', '1 night')
      : text('daterange.nights', '%1 nights', [nights]);
    return `${spanLabel(this._start, this._end)}, ${spans}`;
  }

  /** @param {Element|null} target @returns {{date: Date, cell: Element, button: Element}|null} */
  _cellFor(target) {
    const button = target?.closest?.('[data-date]');
    if (!button) return null;
    return this._dayCells.find((cell) => cell.button === button) ?? null;
  }

  /** @param {Date} date @returns {HTMLButtonElement|null} */
  _buttonForDate(date) {
    return this._dayCells.find((cell) => isSameDay(cell.date, date))?.button ?? null;
  }
}

/**
 * Fired once a complete range is selected, and when the selection is cleared.
 * @event DateRangePicker#change
 * @type {CustomEvent<DateRange>}
 */
/**
 * Fired on every day click and preset, including the half-open state where `end` is still null,
 * and when Escape abandons a half-picked range.
 * @event DateRangePicker#select
 * @type {CustomEvent<DateRange>}
 */
/**
 * Fired when the first visible month changes. Month is zero-based.
 * @event DateRangePicker#monthchange
 * @type {CustomEvent<{year: number, month: number}>}
 */

/**
 * Builds the shipped preset set: Today, Yesterday, Last 7 days, Last 30 days, This month,
 * Last month, This quarter, This year.
 * @returns {DateRangePreset[]}
 */
export function defaultDateRangePresets() {
  return [
    { name: 'today', label: text('daterange.preset.today', 'Today'), range: () => soloRange(today()) },
    {
      name: 'yesterday',
      label: text('daterange.preset.yesterday', 'Yesterday'),
      range: () => soloRange(addDays(today(), -1))
    },
    {
      name: 'last7',
      label: text('daterange.preset.last7', 'Last 7 days'),
      range: () => ({ start: addDays(today(), -6), end: today() })
    },
    {
      name: 'last30',
      label: text('daterange.preset.last30', 'Last 30 days'),
      range: () => ({ start: addDays(today(), -29), end: today() })
    },
    {
      name: 'thisMonth',
      label: text('daterange.preset.thisMonth', 'This month'),
      range: () => monthRange(today(), 0)
    },
    {
      name: 'lastMonth',
      label: text('daterange.preset.lastMonth', 'Last month'),
      range: () => monthRange(today(), -1)
    },
    {
      name: 'thisQuarter',
      label: text('daterange.preset.thisQuarter', 'This quarter'),
      range: () => {
        const now = today();
        const first = Math.floor(now.getMonth() / 3) * 3;
        return {
          start: new Date(now.getFullYear(), first, 1),
          end: new Date(now.getFullYear(), first + 3, 0)
        };
      }
    },
    {
      name: 'thisYear',
      label: text('daterange.preset.thisYear', 'This year'),
      range: () => {
        const now = today();
        return { start: new Date(now.getFullYear(), 0, 1), end: new Date(now.getFullYear(), 11, 31) };
      }
    }
  ];
}

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

/**
 * Renders a range the way it is read aloud, collapsing the parts both endpoints share:
 * "1 – 14 August 2026", "1 August – 14 September 2026", "1 August 2026 – 14 January 2027".
 * @param {Date} start Range start.
 * @param {Date} end Range end.
 * @returns {string}
 */
function spanLabel(start, end) {
  if (isSameDay(start, end)) return formatDate(start, '%e %B %Y');
  const tail = formatDate(end, '%e %B %Y');
  if (start.getFullYear() !== end.getFullYear()) return `${formatDate(start, '%e %B %Y')} – ${tail}`;
  if (start.getMonth() !== end.getMonth()) return `${formatDate(start, '%e %B')} – ${tail}`;
  return `${formatDate(start, '%e')} – ${tail}`;
}

/** @param {unknown} value @returns {DateRangePreset[]} */
function normalizePresets(value) {
  if (value === true) return defaultDateRangePresets();
  if (!Array.isArray(value)) return [];
  return value
    .filter((preset) => preset && typeof preset.range === 'function')
    .map((preset, index) => ({
      name: String(preset.name ?? `preset-${index}`),
      label: String(preset.label ?? preset.name ?? ''),
      range: preset.range
    }));
}

/** @returns {Date} */
function today() {
  return dayOnly(new Date());
}

/** @param {Date} date @returns {DateRange} */
function soloRange(date) {
  return { start: date, end: new Date(date.getTime()) };
}

/** @param {Date} date @param {number} offset @returns {DateRange} */
function monthRange(date, offset) {
  return {
    start: new Date(date.getFullYear(), date.getMonth() + offset, 1),
    end: new Date(date.getFullYear(), date.getMonth() + offset + 1, 0)
  };
}

/** @param {unknown} value @returns {Date|null} */
function validDate(value) {
  return value instanceof Date && !Number.isNaN(value.getTime()) ? new Date(value.getTime()) : null;
}

/** @param {Date|null} date @returns {Date|null} */
function dayOnly(date) {
  if (!date || Number.isNaN(date.getTime())) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** @param {Date|null} date @returns {Date|null} */
function cloneDate(date) {
  return date ? new Date(date.getTime()) : null;
}

/** @param {Date} date @param {Date|null} min @param {Date|null} max @returns {Date} */
function clampDay(date, min, max) {
  if (min && date.getTime() < min.getTime()) return new Date(min.getTime());
  if (max && date.getTime() > max.getTime()) return new Date(max.getTime());
  return new Date(date.getTime());
}

/** @param {Date} date @returns {number} */
function utcDay(date) {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
}

/** @param {Date} date @returns {number} */
function monthIndex(date) {
  return date.getFullYear() * 12 + date.getMonth();
}

/** @param {unknown} value @returns {number|null} */
function normalizeNightCount(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Math.max(0, Math.trunc(number));
}

/** @param {unknown} value @returns {number} */
function normalizeWeekStart(value) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 && number <= 6 ? number : getWeekStart();
}

/** @param {unknown} value @returns {number} */
function normalizeMonthCount(value) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 1 && number <= 4 ? number : 2;
}

/** @param {Date} rowStart @param {Date} first @returns {boolean} */
function weekTouchesMonth(rowStart, first) {
  for (let index = 0; index < 7; index += 1) {
    const date = addDays(rowStart, index);
    if (date.getMonth() === first.getMonth() && date.getFullYear() === first.getFullYear()) return true;
  }
  return false;
}

/** @param {Date} date @returns {number} */
function isoWeekNumber(date) {
  const utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const weekday = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - weekday);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  return Math.ceil((((utc.getTime() - yearStart.getTime()) / DAY_MS) + 1) / 7);
}

/** @param {HTMLElement} element @param {string} name @param {string|null} value @returns {void} */
function setDataset(element, name, value) {
  if (value === null || value === undefined) delete element.dataset[name];
  else element.dataset[name] = value;
}

/** @param {Element} element @param {string[]} names @returns {Map<string, string|null>} */
function rememberAttributes(element, names) {
  return new Map(names.map((name) => [name, element.getAttribute(name)]));
}

/** @param {Element} element @param {Map<string, string|null>} attributes @returns {void} */
function restoreAttributes(element, attributes) {
  for (const [name, value] of attributes) {
    if (value === null) element.removeAttribute(name);
    else element.setAttribute(name, value);
  }
}
