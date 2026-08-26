import { Component } from '../../core/component.js';
import { h } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import {
  CALENDAR_VIEWS, addCalendarDays, calendarDayDifference, calendarDayKey,
  calendarEventIntersects, calendarEventSpansDays, calendarPageDate, calendarRange,
  cloneCalendarEvent, layoutCalendarSpans, layoutTimedCalendarEvents, normalizeCalendarEvents,
  shiftCalendarEvent, startOfCalendarDay
} from './calendar-model.js';

/** @typedef {import('./calendar-model.js').CalendarEvent} CalendarEvent */
/** @typedef {import('./calendar-model.js').CalendarView} CalendarView */
/** @typedef {import('./calendar-model.js').CalendarReader} CalendarReader */

/**
 * @typedef {Object} CalendarOptions
 * @property {Record<string, any>[]} [events=[]] Event records.
 * @property {Date|string|number|null} [date=null] Initial local anchor date; null uses today.
 * @property {CalendarView} [view='month'] Initial view.
 * @property {CalendarView[]} [views=['agenda','day','week','month','year']] Allowed views.
 * @property {string|string[]} [locale] Intl locale override.
 * @property {number} [weekStart=1] First weekday, 0 (Sunday) through 6 (Saturday).
 * @property {boolean} [weekNumbers=true] Show ISO week numbers in month view.
 * @property {boolean} [workweek=false] Show Monday–Friday in the week time grid.
 * @property {number} [agendaDays=14] Number of days in agenda view.
 * @property {number} [slotDuration=30] Time-grid snap interval in minutes.
 * @property {number} [slotMinTime=0] First visible minute of the day.
 * @property {number} [slotMaxTime=1440] Exclusive last visible minute of the day.
 * @property {number} [scrollTime=480] Minute initially scrolled into view.
 * @property {number} [eventLimit=3] Maximum visible month lanes before a More button.
 * @property {boolean} [selectable=false] Enable pointer time-range selection.
 * @property {boolean} [editable=false] Enable event moving and resizing.
 * @property {boolean|null} [eventStartEditable=null] Global move override; null inherits editable.
 * @property {boolean|null} [eventDurationEditable=null] Global resize override; null inherits editable.
 * @property {boolean} [optimistic=true] Apply event proposals locally before persistence confirms.
 * @property {boolean} [nowIndicator=true] Show the current-time line in day/week views.
 * @property {Date|(() => Date)|null} [now=null] Current-time override for deterministic rendering.
 * @property {boolean} [disabled=false] Disable toolbar, date, selection, and editing controls.
 * @property {CalendarReader} [eventId='id'] Event ID reader.
 * @property {CalendarReader} [eventTitle='title'] Event title reader.
 * @property {CalendarReader} [eventStart='start'] Event start reader.
 * @property {CalendarReader} [eventEnd='end'] Event end reader.
 * @property {CalendarReader} [eventAllDay='allDay'] Event all-day reader.
 * @property {CalendarReader} [eventColor='color'] Event colour reader.
 * @property {CalendarReader} [eventLocation='location'] Event location reader.
 * @property {CalendarReader} [eventEditable='editable'] Per-event move reader.
 * @property {CalendarReader} [eventDurationEditable='durationEditable'] Per-event resize reader.
 * @property {'milliseconds'|'seconds'} [dateUnit='milliseconds'] Unit for numeric event dates.
 * @property {Record<string, string>} [msg] Localized component messages.
 * @property {(event: CalendarEvent) => Node|string|null} [renderEvent] Optional safe event-content renderer.
 * @property {(event: CustomEvent<{events: CalendarEvent[]}>) => void} [oneventschange] Programmatic event-data listener.
 * @property {(event: CustomEvent<{view: CalendarView, oldView: CalendarView}>) => void} [onviewchange] View listener.
 * @property {(event: CustomEvent<{view: CalendarView, start: Date, end: Date}>) => void} [ondateschange] Visible-range listener.
 * @property {(event: CustomEvent<{event: CalendarEvent, jsEvent: Event}>) => void} [oneventclick] Event activation listener.
 * @property {(event: CustomEvent<{event: CalendarEvent, jsEvent: Event}>) => void} [oneventdblclick] Event double-activation listener.
 * @property {(event: CustomEvent<{date: Date, allDay: boolean, view: CalendarView, jsEvent: Event}>) => void} [ondateclick] Date/time activation listener.
 * @property {(event: CustomEvent<{start: Date, end: Date, allDay: boolean, view: CalendarView, jsEvent: Event}>) => void} [onselect] Range-selection listener.
 * @property {(event: CustomEvent<CalendarEventChangeDetail>) => void} [oneventchange] Move/resize proposal listener.
 * @property {(event: CustomEvent<{date: Date, view: CalendarView, jsEvent: Event}>) => void} [onnew] New-event command listener.
 * @property {(event: CustomEvent<{date: Date, count: number, jsEvent: Event}>) => void} [onmoreclick] Month-overflow listener.
 */

/**
 * @typedef {Object} CalendarEventChangeDetail
 * @property {CalendarEvent} event Proposed event.
 * @property {CalendarEvent} oldEvent Previous event.
 * @property {'move'|'resize'} action Edit action.
 * @property {{milliseconds: number, days: number, minutes: number, endMilliseconds: number}} delta Edit delta.
 * @property {Event} jsEvent Originating pointer or keyboard event.
 * @property {() => boolean} revert Idempotent optimistic revert callback.
 */

/** @typedef {{silent?: boolean}} CalendarSetOptions */

const DEFAULT_MESSAGES = {
  today: 'Today',
  new: 'New',
  agenda: 'Agenda',
  day: 'Day',
  week: 'Week',
  month: 'Month',
  year: 'Year',
  previous: 'Previous period',
  next: 'Next period',
  allDay: 'All day',
  noEvents: 'No events',
  more: '+%1 more',
  loading: 'Loading calendar…',
  move: 'Move %1',
  resize: 'Resize %1',
  moveStarted: 'Moving %1. Use arrow keys, Space to drop, or Escape to cancel.',
  resizeStarted: 'Resizing %1. Use arrow keys, Space to drop, or Escape to cancel.',
  editPreview: '%1, %2 to %3',
  editCancelled: 'Calendar edit cancelled.',
  editCommitted: '%1 updated.',
  calendar: 'Calendar',
  weekNumber: 'Week %1'
};

/**
 * Accessible, dependency-free agenda/day/week/month/year scheduling surface.
 * @fires Calendar#viewchange
 * @fires Calendar#dateschange
 * @fires Calendar#eventclick
 * @fires Calendar#eventdblclick
 * @fires Calendar#dateclick
 * @fires Calendar#select
 * @fires Calendar#eventchange
 * @fires Calendar#eventschange
 * @fires Calendar#new
 * @fires Calendar#moreclick
 * @extends {Component<CalendarOptions>}
 */
export class Calendar extends Component {
  static cssName = 'calendar';

  /** @type {CalendarOptions} */
  static defaults = {
    events: [],
    date: null,
    view: 'month',
    views: [...CALENDAR_VIEWS],
    weekStart: 1,
    weekNumbers: true,
    workweek: false,
    agendaDays: 14,
    slotDuration: 30,
    slotMinTime: 0,
    slotMaxTime: 1440,
    scrollTime: 480,
    eventLimit: 3,
    selectable: false,
    editable: false,
    eventStartEditable: null,
    eventDurationEditable: null,
    optimistic: true,
    nowIndicator: true,
    now: null,
    disabled: false,
    eventId: 'id',
    eventTitle: 'title',
    eventStart: 'start',
    eventEnd: 'end',
    eventAllDay: 'allDay',
    eventColor: 'color',
    eventLocation: 'location',
    eventEditable: 'editable',
    eventDurationEditable: 'durationEditable',
    dateUnit: 'milliseconds',
    msg: DEFAULT_MESSAGES
  };

  /** @returns {HTMLElement} */
  render() {
    const createdRoot = !this.el;
    const root = /** @type {HTMLElement} */ (this.el ?? h('section'));
    if (!this.el) this.el = root;
    this._createdRoot = createdRoot;
    this._original = this._createdRoot ? null : {
      attributes: Array.from(root.attributes).map(({ name, value }) => [name, value]),
      children: Array.from(root.childNodes)
    };
    this._views = normalizeViews(this.options.views);
    this._view = this._views.includes(this.options.view) ? this.options.view : this._views[0];
    this._date = normalizeAnchorDate(this.options.date, this.options.dateUnit, this._now());
    this._events = normalizeCalendarEvents(this.options.events, this._normalizeOptions());
    this._loading = false;
    this._destroyed = false;
    this._pointer = null;
    this._keyboardEdit = null;
    this._mutationVersions = new Map();
    this._mutationSerial = 0;
    this._suppressClickId = null;
    this._suppressDateClick = false;
    this._focusedSlot = null;
    this._selection = null;
    this._nowTimer = null;

    const navigation = h('div', { class: 'zx-calendar__navigation' },
      this._toolbarButton('previous', this.msg('previous'), 'chevron-left'),
      this._toolbarButton('today', this.msg('today')),
      this._toolbarButton('next', this.msg('next'), 'chevron-right'));
    const heading = h('h2', {
      ref: 'heading',
      class: 'zx-calendar__heading',
      ariaLive: 'polite'
    });
    const views = h('div', {
      ref: 'views',
      class: 'zx-calendar__views',
      role: 'group',
      ariaLabel: 'Calendar view'
    }, this._views.map((view) => h('button', {
      type: 'button',
      class: 'zx-calendar__view-button',
      dataset: { calendarAction: 'view', view },
      disabled: this.options.disabled
    }, this.msg(view))));
    const commands = h('div', { class: 'zx-calendar__commands' }, views,
      h('button', {
        type: 'button',
        class: 'zx-calendar__new',
        dataset: { calendarAction: 'new' },
        disabled: this.options.disabled
      }, icon('plus'), h('span', {}, this.msg('new'))));
    const toolbar = h('header', { class: 'zx-calendar__toolbar' }, navigation, heading, commands);
    const body = h('div', { ref: 'body', class: 'zx-calendar__body' });
    const loading = h('div', {
      ref: 'loading',
      class: 'zx-calendar__loading',
      role: 'status',
      hidden: true
    }, this.msg('loading'));
    const status = h('div', {
      ref: 'status',
      class: 'zx-calendar__status',
      role: 'status',
      ariaLive: 'polite',
      ariaAtomic: 'true'
    });
    root.replaceChildren(toolbar, body, loading, status);
    root.setAttribute('aria-label', this.msg('calendar'));
    root.dataset.view = this._view;
    root.dataset.state = 'ready';

    this.listen(root, 'click', (event) => this._onClick(event));
    this.listen(root, 'dblclick', (event) => this._onDoubleClick(event));
    this.listen(root, 'keydown', (event) => this._onKeydown(event));
    this.listen(root, 'pointerdown', (event) => this._onPointerDown(event));
    this.listen(root, 'pointermove', (event) => this._onPointerMove(event));
    this.listen(root, 'pointerup', (event) => this._onPointerUp(event));
    this.listen(root, 'pointercancel', (event) => this._cancelPointer(event));
    this.listen(root, 'dragstart', (event) => event.preventDefault());

    this._renderView({ emitDates: true, scroll: true });
    if (this.options.nowIndicator) {
      this._nowTimer = setInterval(() => this._refreshNowIndicator(), 60_000);
    }
    return root;
  }

  /** Returns defensive copies of every normalized event. @returns {CalendarEvent[]} */
  getEvents() {
    return this._events.map(cloneCalendarEvent);
  }

  /** Replaces all source records atomically. @param {Record<string, any>[]} events @param {CalendarSetOptions} [options={}] @returns {this} */
  setEvents(events, options = {}) {
    const normalized = normalizeCalendarEvents(events, this._normalizeOptions());
    this._events = normalized;
    this._mutationVersions.clear();
    this._renderView({ preserveFocus: true });
    if (!options.silent) this.emit('eventschange', { events: this.getEvents() });
    return this;
  }

  /** Adds one source event. @param {Record<string, any>} event @param {CalendarSetOptions} [options={}] @returns {this} */
  addEvent(event, options = {}) {
    const [normalized] = normalizeCalendarEvents([event], this._normalizeOptions());
    if (this._eventById(normalized.id)) throw new RangeError(`Duplicate Calendar event id: ${normalized.id}`);
    this._events = [...this._events, normalized];
    this._renderView({ preserveFocus: true });
    if (!options.silent) this.emit('eventschange', { events: this.getEvents() });
    return this;
  }

  /**
   * Updates one normalized event. Date changes accept valid Date objects, ISO strings, or numeric
   * values in the configured date unit.
   * @param {string|number} id Event id.
   * @param {Partial<CalendarEvent>} changes Normalized event changes.
   * @param {CalendarSetOptions} [options={}] Update behavior.
   * @returns {this}
   */
  updateEvent(id, changes, options = {}) {
    const index = this._eventIndex(id);
    if (index < 0) throw new RangeError(`Unknown Calendar event id: ${id}`);
    const current = this._events[index];
    const source = {
      id: current.id,
      title: changes.title ?? current.title,
      start: changes.start ?? current.start,
      end: changes.end ?? current.end,
      allDay: changes.allDay ?? current.allDay,
      color: Object.prototype.hasOwnProperty.call(changes, 'color') ? changes.color : current.color,
      location: changes.location ?? current.location,
      editable: Object.prototype.hasOwnProperty.call(changes, 'editable') ? changes.editable : current.editable,
      durationEditable: Object.prototype.hasOwnProperty.call(changes, 'durationEditable')
        ? changes.durationEditable : current.durationEditable,
      data: changes.data ?? current.data
    };
    // `source` is assembled from canonical keys, so the configured readers must not be reapplied
    // here — but `dateUnit` must, or a numeric change is read in the wrong unit.
    const [next] = normalizeCalendarEvents([source], { dateUnit: this.options.dateUnit });
    next.data = source.data;
    this._events = this._events.map((event, eventIndex) => eventIndex === index ? next : event);
    this._mutationVersions.delete(String(id));
    this._renderView({ preserveFocus: true });
    if (!options.silent) this.emit('eventschange', { events: this.getEvents() });
    return this;
  }

  /** Removes one event when present. @param {string|number} id Event id. @param {CalendarSetOptions} [options={}] @returns {this} */
  removeEvent(id, options = {}) {
    const key = String(id);
    const next = this._events.filter((event) => String(event.id) !== key);
    if (next.length === this._events.length) return this;
    this._events = next;
    this._mutationVersions.delete(key);
    this._renderView({ preserveFocus: true });
    if (!options.silent) this.emit('eventschange', { events: this.getEvents() });
    return this;
  }

  /** Returns a copy of the current anchor date. @returns {Date} */
  getDate() {
    return new Date(this._date.getTime());
  }

  /** Sets the anchor date and visible period. @param {Date|string|number} date @param {CalendarSetOptions} [options={}] @returns {this} */
  setDate(date, options = {}) {
    this._date = normalizeAnchorDate(date, this.options.dateUnit, this._now());
    this._renderView({ emitDates: !options.silent, preserveFocus: true, scroll: true });
    return this;
  }

  /** Returns the current view. @returns {CalendarView} */
  getView() {
    return this._view;
  }

  /** Changes view while retaining the anchor date. @param {CalendarView} view @param {CalendarSetOptions} [options={}] @returns {this} */
  setView(view, options = {}) {
    if (!this._views.includes(view)) throw new RangeError(`Calendar view is not enabled: ${view}`);
    if (view === this._view) return this;
    const oldView = this._view;
    this._view = view;
    this.el.dataset.view = view;
    this._renderView({ emitDates: true, preserveFocus: true, scroll: true });
    if (!options.silent) this.emit('viewchange', { view, oldView });
    return this;
  }

  /** Moves to the previous visible period. @returns {this} */
  prev() {
    return this._page(-1);
  }

  /** Moves to the next visible period. @returns {this} */
  next() {
    return this._page(1);
  }

  /** Moves to today. @returns {this} */
  today() {
    return this.setDate(this._now());
  }

  /** Toggles loading state without discarding the rendered calendar. @param {boolean} [loading=true] @returns {this} */
  setLoading(loading = true) {
    this._loading = Boolean(loading);
    this.el.dataset.state = this._loading ? 'loading' : 'ready';
    this.el.setAttribute('aria-busy', String(this._loading));
    this.refs.loading.hidden = !this._loading;
    return this;
  }

  /** Focuses an event in the current view when rendered. @param {string|number} id Event id. @returns {this} */
  focusEvent(id) {
    this.el.querySelector(`[data-event-action][data-event-id="${cssEscape(String(id))}"]`)?.focus();
    return this;
  }

  /** Restores an enhanced target or removes the owned root and releases timers. @returns {void} */
  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    if (this._nowTimer) clearInterval(this._nowTimer);
    this._nowTimer = null;
    const original = this._original;
    super.destroy();
    if (!this._createdRoot && original) {
      for (const attribute of Array.from(this.el.attributes)) this.el.removeAttribute(attribute.name);
      for (const [name, value] of original.attributes) this.el.setAttribute(name, value);
      this.el.replaceChildren(...original.children);
    }
  }

  /** @param {string} action @param {string} label @param {string|null} [iconName=null] @returns {HTMLButtonElement} */
  _toolbarButton(action, label, iconName = null) {
    return /** @type {HTMLButtonElement} */ (h('button', {
      type: 'button',
      class: 'zx-calendar__toolbar-button',
      dataset: { calendarAction: action },
      ariaLabel: iconName ? label : null,
      disabled: this.options.disabled
    }, iconName ? icon(iconName) : label));
  }

  /** @returns {import('./calendar-model.js').CalendarNormalizeOptions} */
  _normalizeOptions() {
    return {
      eventId: this.options.eventId,
      eventTitle: this.options.eventTitle,
      eventStart: this.options.eventStart,
      eventEnd: this.options.eventEnd,
      eventAllDay: this.options.eventAllDay,
      eventColor: this.options.eventColor,
      eventLocation: this.options.eventLocation,
      eventEditable: this.options.eventEditable,
      eventDurationEditable: this.options.eventDurationEditable,
      dateUnit: this.options.dateUnit
    };
  }

  /** @param {{emitDates?: boolean, preserveFocus?: boolean, scroll?: boolean}} [options={}] @returns {void} */
  _renderView(options = {}) {
    if (!this.refs?.body || this._destroyed) return;
    const focus = options.preserveFocus ? this._focusIdentity() : null;
    const range = calendarRange(this._view, this._date, {
      weekStart: this.options.weekStart,
      agendaDays: this.options.agendaDays
    });
    this._range = range;
    this.refs.heading.textContent = this._rangeTitle(range);
    for (const button of this.refs.views.querySelectorAll('[data-view]')) {
      button.setAttribute('aria-pressed', String(button.dataset.view === this._view));
    }
    const content = this._view === 'agenda' ? this._renderAgenda(range)
      : this._view === 'day' || this._view === 'week' ? this._renderTimeGrid(range)
        : this._view === 'month' ? this._renderMonth(range) : this._renderYear(range);
    this.refs.body.replaceChildren(content);
    if (options.scroll) this._scrollTimeGrid();
    if (focus) this._restoreFocus(focus);
    if (options.emitDates) this.emit('dateschange', {
      view: this._view,
      start: new Date(range.start.getTime()),
      end: new Date(range.end.getTime())
    });
  }

  /** @param {{start: Date, end: Date}} range @returns {HTMLElement} */
  _renderAgenda(range) {
    const grid = h('div', {
      class: 'zx-calendar__agenda',
      role: 'grid',
      ariaLabel: this._rangeTitle(range)
    });
    const days = calendarDayDifference(range.start, range.end);
    for (let index = 0; index < days; index += 1) {
      const day = addCalendarDays(range.start, index);
      const next = addCalendarDays(day, 1);
      const events = this._events.filter((event) => {
        if (!calendarEventIntersects(event, day, next)) return false;
        return event.start >= day || index === 0;
      }).sort(compareEvents);
      const row = h('section', {
        class: 'zx-calendar__agenda-day',
        role: 'row',
        dataset: { date: calendarDayKey(day) }
      },
        h('button', {
          type: 'button',
          class: 'zx-calendar__agenda-heading',
          role: 'rowheader',
          dataset: { calendarAction: 'date', date: calendarDayKey(day), dateCell: 'true' },
          ariaCurrent: sameCalendarDay(day, this._now()) ? 'date' : null,
          disabled: this.options.disabled
        }, this._format(day, { weekday: 'long', day: 'numeric', month: 'long' })));
      const entries = h('div', { class: 'zx-calendar__agenda-events', role: 'gridcell' });
      if (!events.length) {
        entries.append(h('p', { class: 'zx-calendar__agenda-empty' }, this.msg('noEvents')));
      } else {
        for (const event of events) entries.append(this._eventElement(event, { variant: 'agenda', day }));
      }
      row.append(entries);
      grid.append(row);
    }
    return grid;
  }

  /** @param {{start: Date, end: Date}} range @returns {HTMLElement} */
  _renderTimeGrid(range) {
    const allDays = Array.from({ length: calendarDayDifference(range.start, range.end) }, (_, index) =>
      addCalendarDays(range.start, index));
    const days = this._view === 'week' && this.options.workweek
      ? allDays.filter((date) => date.getDay() > 0 && date.getDay() < 6) : allDays;
    const min = normalizeMinute(this.options.slotMinTime, 0);
    const max = normalizeMinute(this.options.slotMaxTime, 1440, true);
    const slot = normalizeSlot(this.options.slotDuration);
    if (max <= min) throw new RangeError('slotMaxTime must exceed slotMinTime');
    const slotCount = Math.ceil((max - min) / slot);
    const surface = h('div', {
      class: 'zx-calendar__time-surface',
      style: { '--zx-calendar-day-count': String(days.length) }
    });
    const header = h('div', { class: 'zx-calendar__time-header' },
      h('span', { class: 'zx-calendar__time-corner', ariaHidden: 'true' }),
      h('div', { class: 'zx-calendar__day-headings', role: 'row' }, days.map((day) => h('button', {
        type: 'button',
        class: 'zx-calendar__day-heading',
        role: 'columnheader',
        dataset: { calendarAction: 'date', date: calendarDayKey(day), dateCell: 'true' },
        ariaCurrent: sameCalendarDay(day, this._now()) ? 'date' : null,
        disabled: this.options.disabled
      }, h('span', { class: 'zx-calendar__day-weekday' }, this._format(day, { weekday: 'short' })),
      h('span', { class: 'zx-calendar__day-number' }, this._format(day, { day: 'numeric', month: 'short' }))))));
    const allDay = this._renderAllDayRail(days);
    const scroller = h('div', { ref: 'timeScroller', class: 'zx-calendar__time-scroller' });
    const axis = h('div', { class: 'zx-calendar__time-axis', ariaHidden: 'true' });
    const grid = h('div', {
      class: 'zx-calendar__time-grid',
      role: 'grid',
      ariaLabel: this._rangeTitle(range),
      ariaRowcount: String(slotCount),
      ariaColcount: String(days.length),
      style: { '--zx-calendar-slot-count': String(slotCount) }
    });
    const slots = h('div', { ref: 'slots', class: 'zx-calendar__slots' });
    let firstTabStop = true;
    for (let row = 0; row < slotCount; row += 1) {
      const minutes = min + row * slot;
      axis.append(h('span', { class: 'zx-calendar__time-label' }, minutes % 60 === 0 ? formatTimeMinutes(minutes, this.options.locale) : ''));
      for (let column = 0; column < days.length; column += 1) {
        const date = dateWithMinutes(days[column], minutes);
        const key = String(date.getTime());
        const tabbable = this._focusedSlot ? this._focusedSlot === key : firstTabStop;
        if (tabbable) firstTabStop = false;
        slots.append(h('button', {
          type: 'button',
          class: 'zx-calendar__slot',
          role: 'gridcell',
          tabindex: tabbable ? 0 : -1,
          dataset: {
            calendarAction: 'date',
            slot: key,
            dateTime: key,
            dayIndex: String(column),
            rowIndex: String(row),
            major: minutes % 60 === 0 ? 'true' : null
          },
          ariaLabel: this._dateTimeLabel(date),
          disabled: this.options.disabled
        }));
      }
    }
    const eventsLayer = h('div', { class: 'zx-calendar__timed-events', ariaHidden: 'false' });
    days.forEach((day, dayIndex) => {
      const layouts = layoutTimedCalendarEvents(this._events, day, {
        minMinutes: min,
        maxMinutes: max,
        minimumMinutes: slot
      });
      for (const layout of layouts) {
        const top = ((layout.startMinutes - min) / (max - min)) * 100;
        const height = Math.max((slot / (max - min)) * 100,
          ((layout.endMinutes - layout.startMinutes) / (max - min)) * 100);
        const dayWidth = 100 / days.length;
        const width = dayWidth / layout.columns;
        const left = dayIndex * dayWidth + layout.column * width;
        const event = this._eventElement(layout.event, { variant: 'timed', day, resizable: true });
        event.style.insetInlineStart = `${left}%`;
        event.style.inlineSize = `${width}%`;
        event.style.insetBlockStart = `${top}%`;
        event.style.blockSize = `${height}%`;
        eventsLayer.append(event);
      }
    });
    grid.append(slots, eventsLayer, this._nowLine(days, min, max));
    scroller.append(axis, grid);
    surface.append(header, allDay, scroller);
    return surface;
  }

  /** @param {Date[]} days @returns {HTMLElement} */
  _renderAllDayRail(days) {
    const rail = h('div', { class: 'zx-calendar__all-day' },
      h('span', { class: 'zx-calendar__all-day-label' }, this.msg('allDay')));
    const layer = h('div', {
      class: 'zx-calendar__all-day-grid',
      role: 'row',
      style: { '--zx-calendar-day-count': String(days.length) }
    });
    for (const day of days) layer.append(h('span', {
      class: 'zx-calendar__all-day-cell',
      dataset: { date: calendarDayKey(day) },
      ariaHidden: 'true'
    }));
    const spans = layoutCalendarSpans(this._events, days[0], days.length);
    for (const span of spans) {
      const event = this._eventElement(span.event, { variant: 'span', day: days[span.start] });
      event.style.gridColumn = `${span.start + 1} / ${span.end + 1}`;
      event.style.gridRow = String(span.lane + 1);
      layer.append(event);
    }
    rail.append(layer);
    return rail;
  }

  /** @param {{start: Date, end: Date}} range @returns {HTMLElement} */
  _renderMonth(range) {
    const wrapper = h('div', { class: 'zx-calendar__month' });
    const weekdays = h('div', { class: 'zx-calendar__month-weekdays', role: 'row' });
    if (this.options.weekNumbers) weekdays.append(h('span', { class: 'zx-calendar__month-week-gutter', ariaHidden: 'true' }));
    for (let offset = 0; offset < 7; offset += 1) {
      const day = addCalendarDays(range.start, offset);
      weekdays.append(h('span', { class: 'zx-calendar__month-weekday', role: 'columnheader' },
        this._format(day, { weekday: 'short' })));
    }
    wrapper.append(weekdays);
    const weekCount = calendarDayDifference(range.start, range.end) / 7;
    for (let week = 0; week < weekCount; week += 1) {
      const start = addCalendarDays(range.start, week * 7);
      const spans = layoutCalendarSpans(this._events.map((event) => ({ ...event, allDay: true })), start, 7);
      const eventLimit = normalizeEventLimit(this.options.eventLimit);
      const visible = spans.filter((span) => span.lane < eventLimit);
      const hidden = spans.filter((span) => span.lane >= eventLimit);
      const row = h('div', {
        class: 'zx-calendar__month-week',
        role: 'row',
        dataset: { weekStart: calendarDayKey(start) }
      });
      if (this.options.weekNumbers) row.append(h('button', {
        type: 'button',
        class: 'zx-calendar__month-week-number',
        dataset: { calendarAction: 'week', date: calendarDayKey(start) },
        ariaLabel: this.msg('weekNumber', isoWeek(start)),
        disabled: this.options.disabled
      }, String(isoWeek(start))));
      const days = h('div', { class: 'zx-calendar__month-days' });
      for (let offset = 0; offset < 7; offset += 1) {
        const day = addCalendarDays(start, offset);
        const count = this._events.filter((event) => calendarEventIntersects(event, day, addCalendarDays(day, 1))).length;
        days.append(h('button', {
          type: 'button',
          class: 'zx-calendar__month-day',
          role: 'gridcell',
          dataset: {
            calendarAction: 'date',
            date: calendarDayKey(day),
            dateCell: 'true',
            otherMonth: day.getMonth() === this._date.getMonth() ? null : 'true',
            eventCount: String(count)
          },
          ariaCurrent: sameCalendarDay(day, this._now()) ? 'date' : null,
          ariaLabel: `${this._format(day, { dateStyle: 'full' })}, ${count} ${count === 1 ? 'event' : 'events'}`,
          disabled: this.options.disabled
        }, this._format(day, { day: 'numeric' })));
      }
      const lanes = h('div', { class: 'zx-calendar__month-events' });
      for (const span of visible) {
        const event = this._eventElement(span.event, { variant: 'month', day: addCalendarDays(start, span.start) });
        event.style.gridColumn = `${span.start + 1} / ${span.end + 1}`;
        event.style.gridRow = String(span.lane + 1);
        lanes.append(event);
      }
      const hiddenByDay = Array.from({ length: 7 }, (_, index) => hidden.filter((span) => span.start <= index && span.end > index).length);
      for (let index = 0; index < hiddenByDay.length; index += 1) {
        const count = hiddenByDay[index];
        if (!count) continue;
        const day = addCalendarDays(start, index);
        lanes.append(h('button', {
          type: 'button',
          class: 'zx-calendar__more',
          dataset: { calendarAction: 'more', date: calendarDayKey(day), count: String(count) },
          style: { gridColumn: String(index + 1), gridRow: String(eventLimit + 1) },
          disabled: this.options.disabled
        }, this.msg('more', count)));
      }
      row.append(days, lanes);
      wrapper.append(row);
    }
    wrapper.setAttribute('role', 'grid');
    wrapper.setAttribute('aria-label', this._rangeTitle(range));
    return wrapper;
  }

  /** @param {{start: Date, end: Date}} range @returns {HTMLElement} */
  _renderYear(range) {
    const year = range.start.getFullYear();
    const surface = h('div', { class: 'zx-calendar__year', ariaLabel: String(year) });
    for (let month = 0; month < 12; month += 1) {
      const first = new Date(year, month, 1);
      const offset = (first.getDay() - this.options.weekStart + 7) % 7;
      const start = addCalendarDays(first, -offset);
      const grid = h('div', { class: 'zx-calendar__year-grid', role: 'grid', ariaLabel: this._format(first, { month: 'long' }) },
        h('h3', { class: 'zx-calendar__year-heading' }, this._format(first, { month: 'long' })));
      for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
        const weekday = addCalendarDays(start, dayIndex);
        grid.append(h('span', { class: 'zx-calendar__year-weekday', role: 'columnheader' },
          this._format(weekday, { weekday: 'narrow' })));
      }
      for (let index = 0; index < 42; index += 1) {
        const day = addCalendarDays(start, index);
        if (day.getMonth() !== month) {
          grid.append(h('span', { class: 'zx-calendar__year-blank', role: 'gridcell', ariaHidden: 'true' }));
          continue;
        }
        const count = this._events.filter((event) => calendarEventIntersects(event, day, addCalendarDays(day, 1))).length;
        grid.append(h('button', {
          type: 'button',
          class: 'zx-calendar__year-day',
          role: 'gridcell',
          dataset: {
            calendarAction: 'date',
            date: calendarDayKey(day),
            dateCell: 'true',
            activity: String(Math.min(3, count))
          },
          ariaCurrent: sameCalendarDay(day, this._now()) ? 'date' : null,
          ariaLabel: `${this._format(day, { dateStyle: 'full' })}, ${count} ${count === 1 ? 'event' : 'events'}`,
          disabled: this.options.disabled
        }, String(day.getDate())));
      }
      surface.append(grid);
    }
    return surface;
  }

  /**
   * @param {CalendarEvent} event
   * @param {{variant: 'agenda'|'timed'|'span'|'month', day: Date, resizable?: boolean}} context
   * @returns {HTMLElement}
   */
  _eventElement(event, context) {
    const key = String(event.id);
    const wrapper = h('div', {
      class: 'zx-calendar__event',
      dataset: {
        eventId: key,
        variant: context.variant,
        allDay: event.allDay ? 'true' : null,
        draggable: this._canMove(event) ? 'true' : null
      },
      style: event.color ? { '--zx-calendar-event-color': event.color } : null
    });
    const button = h('button', {
      type: 'button',
      class: 'zx-calendar__event-action',
      dataset: { eventAction: 'activate', eventId: key },
      ariaLabel: this._eventLabel(event),
      disabled: this.options.disabled
    });
    const custom = typeof this.options.renderEvent === 'function'
      ? this.options.renderEvent(cloneCalendarEvent(event)) : null;
    if (custom instanceof Node) button.append(custom);
    else if (typeof custom === 'string') button.append(document.createTextNode(custom));
    else {
      const time = h('span', { class: 'zx-calendar__event-time' }, this._eventTime(event, context.day));
      const title = h('span', { class: 'zx-calendar__event-title' }, event.title);
      button.append(time, title);
      if (event.location) button.append(h('span', { class: 'zx-calendar__event-location' }, event.location));
    }
    wrapper.append(button);
    if (context.resizable && this._canResize(event)) {
      wrapper.append(h('button', {
        type: 'button',
        class: 'zx-calendar__event-resize',
        dataset: { eventAction: 'resize', eventId: key },
        ariaLabel: this.msg('resize', event.title),
        disabled: this.options.disabled
      }, h('span', { ariaHidden: 'true' })));
    }
    return wrapper;
  }

  /** @param {Date[]} days @param {number} min @param {number} max @returns {HTMLElement} */
  _nowLine(days, min, max) {
    const now = this._now();
    const dayIndex = days.findIndex((day) => sameCalendarDay(day, now));
    const minutes = now.getHours() * 60 + now.getMinutes();
    const visible = this.options.nowIndicator && dayIndex >= 0 && minutes >= min && minutes <= max;
    return h('div', {
      ref: 'nowLine',
      class: 'zx-calendar__now',
      hidden: !visible,
      ariaHidden: 'true',
      style: visible ? {
        insetBlockStart: `${((minutes - min) / (max - min)) * 100}%`,
        '--zx-calendar-now-day': String(dayIndex)
      } : null
    }, h('span', { class: 'zx-calendar__now-time' }, formatTimeMinutes(minutes, this.options.locale)));
  }

  /** @param {Event} event @returns {void} */
  _onClick(event) {
    const target = event.target?.closest?.('button');
    if (!target || !this.el.contains(target)) return;
    const eventId = target.dataset.eventId;
    if (eventId != null && this._suppressClickId === eventId) {
      this._suppressClickId = null;
      event.preventDefault();
      return;
    }
    if (target.dataset.eventAction === 'activate') {
      const item = this._eventById(eventId);
      if (item) this.emit('eventclick', { event: cloneCalendarEvent(item), jsEvent: event });
      return;
    }
    if (target.dataset.eventAction === 'resize') return;
    const action = target.dataset.calendarAction;
    if (!action) return;
    if (action === 'previous') this.prev();
    else if (action === 'next') this.next();
    else if (action === 'today') this.today();
    else if (action === 'view') this.setView(/** @type {CalendarView} */ (target.dataset.view));
    else if (action === 'new') this.emit('new', { date: this.getDate(), view: this._view, jsEvent: event });
    else if (action === 'week') {
      const date = parseDayKey(target.dataset.date);
      if (date) this.setDate(date).setView('week');
    } else if (action === 'more') {
      const date = parseDayKey(target.dataset.date);
      if (!date) return;
      const emitted = this.emit('moreclick', { date, count: Number(target.dataset.count), jsEvent: event });
      if (!emitted.defaultPrevented && this._views.includes('agenda')) this.setDate(date).setView('agenda');
    } else if (action === 'date') {
      if (this._suppressDateClick) {
        this._suppressDateClick = false;
        event.preventDefault();
        return;
      }
      const date = this._dateFromTarget(target);
      if (!date) return;
      this._rememberFocusedDate(target);
      this.emit('dateclick', {
        date,
        allDay: !target.dataset.dateTime,
        view: this._view,
        jsEvent: event
      });
    }
  }

  /** @param {Event} event @returns {void} */
  _onDoubleClick(event) {
    const eventTarget = event.target?.closest?.('[data-event-action="activate"]');
    if (eventTarget) {
      const item = this._eventById(eventTarget.dataset.eventId);
      if (item) this.emit('eventdblclick', { event: cloneCalendarEvent(item), jsEvent: event });
      return;
    }
    const dateTarget = event.target?.closest?.('[data-calendar-action="date"]');
    if (!dateTarget) return;
    const date = this._dateFromTarget(dateTarget);
    if (!date) return;
    const allDay = !dateTarget.dataset.dateTime;
    const end = allDay ? addCalendarDays(date, 1) : addMinutes(date, normalizeSlot(this.options.slotDuration));
    this.emit('select', { start: date, end, allDay, view: this._view, jsEvent: event });
  }

  /** @param {KeyboardEvent} event @returns {void} */
  _onKeydown(event) {
    const eventControl = event.target?.closest?.('[data-event-action]');
    if (eventControl) {
      this._onEventKeydown(event, eventControl);
      return;
    }
    const slot = event.target?.closest?.('[data-slot]');
    if (slot) {
      this._onSlotKeydown(event, slot);
      return;
    }
    const day = event.target?.closest?.('[data-date-cell]');
    if (day) this._onDayKeydown(event, day);
  }

  /** @param {KeyboardEvent} event @param {HTMLElement} control @returns {void} */
  _onEventKeydown(event, control) {
    const item = this._eventById(control.dataset.eventId);
    if (!item) return;
    const resize = control.dataset.eventAction === 'resize';
    if (event.key === 'Enter' && !this._keyboardEdit && !resize) {
      event.preventDefault();
      this.emit('eventclick', { event: cloneCalendarEvent(item), jsEvent: event });
      return;
    }
    if (event.key === ' ' && !this._keyboardEdit) {
      if (resize ? !this._canResize(item) : !this._canMove(item)) return;
      event.preventDefault();
      this._keyboardEdit = {
        oldEvent: cloneCalendarEvent(item),
        event: cloneCalendarEvent(item),
        action: resize ? 'resize' : 'move',
        control
      };
      control.setAttribute('aria-grabbed', 'true');
      control.closest('.zx-calendar__event')?.setAttribute('data-state', 'grabbed');
      this._announce(this.msg(resize ? 'resizeStarted' : 'moveStarted', item.title));
      return;
    }
    if (!this._keyboardEdit || String(this._keyboardEdit.event.id) !== String(item.id)) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      this._cancelKeyboardEdit();
      return;
    }
    if (event.key === ' ') {
      event.preventDefault();
      const edit = this._keyboardEdit;
      this._keyboardEdit = null;
      edit.control.removeAttribute('aria-grabbed');
      this._commitMutation(edit.oldEvent, edit.event, edit.action, event);
      return;
    }
    let days = 0;
    let minutes = 0;
    const timed = !calendarEventSpansDays(item) && (this._view === 'day' || this._view === 'week');
    if (event.key === 'ArrowLeft') days = -1;
    else if (event.key === 'ArrowRight') days = 1;
    else if (event.key === 'ArrowUp') timed ? minutes = -normalizeSlot(this.options.slotDuration) : days = -7;
    else if (event.key === 'ArrowDown') timed ? minutes = normalizeSlot(this.options.slotDuration) : days = 7;
    else return;
    event.preventDefault();
    const edit = this._keyboardEdit;
    if (edit.action === 'move') edit.event = shiftCalendarEvent(edit.event, { days, minutes });
    else {
      const proposed = shiftCalendarEvent(edit.event, { days: 0, minutes: 0, endDays: days, endMinutes: minutes });
      if (proposed.end > proposed.start) edit.event = proposed;
    }
    edit.control.closest('.zx-calendar__event')?.setAttribute('data-preview', this._eventTime(edit.event, edit.event.start));
    this._announce(this.msg('editPreview', edit.event.title,
      this._dateTimeLabel(edit.event.start), this._dateTimeLabel(edit.event.end)));
  }

  /** @param {KeyboardEvent} event @param {HTMLElement} slot @returns {void} */
  _onSlotKeydown(event, slot) {
    const row = Number(slot.dataset.rowIndex);
    const column = Number(slot.dataset.dayIndex);
    const grid = slot.closest('[role="grid"]');
    const columns = Number(grid?.getAttribute('aria-colcount')) || 1;
    const rows = Number(grid?.getAttribute('aria-rowcount')) || 1;
    let nextRow = row;
    let nextColumn = column;
    if (event.key === 'ArrowLeft') nextColumn -= 1;
    else if (event.key === 'ArrowRight') nextColumn += 1;
    else if (event.key === 'ArrowUp') nextRow -= 1;
    else if (event.key === 'ArrowDown') nextRow += 1;
    else if (event.key === 'Home') nextColumn = 0;
    else if (event.key === 'End') nextColumn = columns - 1;
    else if (event.key === 'PageUp') {
      event.preventDefault();
      this.prev();
      return;
    } else if (event.key === 'PageDown') {
      event.preventDefault();
      this.next();
      return;
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const date = this._dateFromTarget(slot);
      if (date) this.emit('dateclick', { date, allDay: false, view: this._view, jsEvent: event });
      return;
    } else return;
    event.preventDefault();
    nextRow = Math.max(0, Math.min(rows - 1, nextRow));
    nextColumn = Math.max(0, Math.min(columns - 1, nextColumn));
    const next = grid?.querySelector(`[data-row-index="${nextRow}"][data-day-index="${nextColumn}"]`);
    if (next) {
      slot.tabIndex = -1;
      next.tabIndex = 0;
      this._focusedSlot = next.dataset.slot;
      next.focus();
    }
  }

  /** @param {KeyboardEvent} event @param {HTMLElement} day @returns {void} */
  _onDayKeydown(event, day) {
    const date = parseDayKey(day.dataset.date);
    if (!date) return;
    let amount = 0;
    if (event.key === 'ArrowLeft') amount = -1;
    else if (event.key === 'ArrowRight') amount = 1;
    else if (event.key === 'ArrowUp') amount = -7;
    else if (event.key === 'ArrowDown') amount = 7;
    else if (event.key === 'Home') amount = -((date.getDay() - this.options.weekStart + 7) % 7);
    else if (event.key === 'End') amount = 6 - ((date.getDay() - this.options.weekStart + 7) % 7);
    else if (event.key === 'PageUp') {
      event.preventDefault();
      this.prev();
      return;
    } else if (event.key === 'PageDown') {
      event.preventDefault();
      this.next();
      return;
    } else return;
    event.preventDefault();
    const targetDate = addCalendarDays(date, amount);
    const target = this.el.querySelector(`[data-date-cell][data-date="${calendarDayKey(targetDate)}"]`);
    if (target) target.focus();
    else this.setDate(targetDate);
  }

  /** @param {PointerEvent} event @returns {void} */
  _onPointerDown(event) {
    if (this.options.disabled || event.button !== 0) return;
    const control = event.target?.closest?.('[data-event-action]');
    if (control) {
      const item = this._eventById(control.dataset.eventId);
      const action = control.dataset.eventAction === 'resize' ? 'resize' : 'move';
      if (!item || (action === 'move' ? !this._canMove(item) : !this._canResize(item))) return;
      event.preventDefault();
      this._capturePointer(event.pointerId);
      const offset = action === 'move' ? this._dragOffsetForEvent(item, event.clientX, event.clientY) : null;
      this._pointer = {
        type: 'event',
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        oldEvent: cloneCalendarEvent(item),
        event: cloneCalendarEvent(item),
        action,
        control,
        timeOffsetMinutes: offset?.minutes ?? 0,
        dayOffset: offset?.days ?? 0,
        moved: false
      };
      return;
    }
    const slot = event.target?.closest?.('[data-slot]');
    if (!slot || !this.options.selectable) return;
    const date = this._dateFromTarget(slot);
    if (!date) return;
    event.preventDefault();
    this._capturePointer(event.pointerId);
    this._pointer = {
      type: 'selection',
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      start: date,
      end: addMinutes(date, normalizeSlot(this.options.slotDuration)),
      control: slot,
      moved: false
    };
  }

  /** @param {PointerEvent} event @returns {void} */
  _onPointerMove(event) {
    const pointer = this._pointer;
    if (!pointer || pointer.pointerId !== event.pointerId) return;
    if (!pointer.moved && Math.hypot(event.clientX - pointer.startX, event.clientY - pointer.startY) < 5) return;
    pointer.moved = true;
    event.preventDefault();
    if (pointer.type === 'selection') {
      const date = this._timeAtPoint(event.clientX, event.clientY);
      if (!date) return;
      const slot = normalizeSlot(this.options.slotDuration);
      pointer.end = addMinutes(date, slot);
      this._previewSelection(pointer.start, pointer.end);
      return;
    }
    const proposed = this._proposalAtPoint(pointer.oldEvent, pointer.action, event.clientX, event.clientY);
    if (!proposed) return;
    pointer.event = proposed;
    const wrapper = pointer.control.closest('.zx-calendar__event');
    if (wrapper) {
      wrapper.dataset.state = 'dragging';
      if (pointer.action === 'resize') {
        wrapper.style.transform = '';
        const height = this._timedPreviewHeight(proposed);
        if (height) wrapper.style.blockSize = height;
      } else {
        wrapper.style.transform = `translate(${event.clientX - pointer.startX}px, ${event.clientY - pointer.startY}px)`;
      }
      wrapper.dataset.preview = this._eventTime(proposed, proposed.start);
    }
    this._announce(this.msg('editPreview', proposed.title,
      this._dateTimeLabel(proposed.start), this._dateTimeLabel(proposed.end)));
  }

  /** @param {PointerEvent} event @returns {void} */
  _onPointerUp(event) {
    const pointer = this._pointer;
    if (!pointer || pointer.pointerId !== event.pointerId) return;
    this._pointer = null;
    this._releasePointerCapture(pointer.pointerId);
    this._clearSelectionPreview();
    if (!pointer.moved) return;
    event.preventDefault();
    if (pointer.type === 'selection') {
      this._suppressDateClick = true;
      const start = pointer.start < pointer.end ? pointer.start : addMinutes(pointer.end, -normalizeSlot(this.options.slotDuration));
      const end = pointer.start < pointer.end ? pointer.end : addMinutes(pointer.start, normalizeSlot(this.options.slotDuration));
      this.emit('select', { start: new Date(start), end: new Date(end), allDay: false, view: this._view, jsEvent: event });
      return;
    }
    this._suppressClickId = String(pointer.oldEvent.id);
    this._commitMutation(pointer.oldEvent, pointer.event, pointer.action, event);
  }

  /** @param {PointerEvent} event @returns {void} */
  _cancelPointer(event) {
    if (!this._pointer || this._pointer.pointerId !== event.pointerId) return;
    const control = this._pointer.control;
    this._releasePointerCapture(this._pointer.pointerId);
    this._pointer = null;
    this._clearSelectionPreview();
    control.closest?.('.zx-calendar__event')?.removeAttribute('data-state');
    this._renderView({ preserveFocus: true });
  }

  /** @param {CalendarEvent} event @param {'move'|'resize'} action @param {number} x @param {number} y @returns {CalendarEvent|null} */
  _proposalAtPoint(event, action, x, y) {
    const resizeTimed = action === 'resize' && !calendarEventSpansDays(event);
    const timed = this._timeAtPoint(x, y, resizeTimed ? event.start : null);
    if (timed && !calendarEventSpansDays(event)) {
      if (action === 'move') {
        const duration = event.end.getTime() - event.start.getTime();
        const next = cloneCalendarEvent(event);
        next.start = addMinutes(timed, -Number(this._pointer?.timeOffsetMinutes ?? 0));
        next.end = new Date(next.start.getTime() + duration);
        return next;
      }
      const next = cloneCalendarEvent(event);
      next.end = addMinutes(timed, normalizeSlot(this.options.slotDuration));
      return next.end > next.start ? next : null;
    }
    const day = this._dayAtPoint(x, y);
    if (!day) return null;
    const targetDay = addCalendarDays(day, -Number(this._pointer?.dayOffset ?? 0));
    const difference = calendarDayDifference(startOfCalendarDay(event.start), targetDay);
    if (action === 'move') return shiftCalendarEvent(event, { days: difference, minutes: 0 });
    const next = cloneCalendarEvent(event);
    const endDay = addCalendarDays(day, 1);
    next.end = new Date(endDay.getTime());
    return next.end > next.start ? next : null;
  }

  /** @param {number} x @param {number} y @param {Date|null} [fixedDay=null] @returns {Date|null} */
  _timeAtPoint(x, y, fixedDay = null) {
    const slots = this.refs.body.querySelector('.zx-calendar__slots');
    if (!slots) return null;
    const rect = slots.getBoundingClientRect();
    const scroller = slots.closest('.zx-calendar__time-scroller');
    const viewport = scroller?.getBoundingClientRect();
    const left = viewport ? Math.max(rect.left, viewport.left) : rect.left;
    const right = viewport ? Math.min(rect.right, viewport.right) : rect.right;
    const top = viewport ? Math.max(rect.top, viewport.top) : rect.top;
    const bottom = viewport ? Math.min(rect.bottom, viewport.bottom) : rect.bottom;
    if (x < left || x > right || y < top || y > bottom || rect.width <= 0 || rect.height <= 0) return null;
    const columns = Number(slots.closest('[role="grid"]')?.getAttribute('aria-colcount')) || 1;
    const rows = Number(slots.closest('[role="grid"]')?.getAttribute('aria-rowcount')) || 1;
    const fixedColumn = fixedDay ? this._timeGridDayIndex(fixedDay) : -1;
    const column = fixedColumn >= 0 ? fixedColumn
      : Math.max(0, Math.min(columns - 1, Math.floor((x - rect.left) / rect.width * columns)));
    const row = Math.max(0, Math.min(rows - 1, Math.floor((y - rect.top) / rect.height * rows)));
    const target = slots.querySelector(`[data-row-index="${row}"][data-day-index="${column}"]`);
    return target ? this._dateFromTarget(target) : null;
  }

  /** @param {number} x @param {number} y @returns {Date|null} */
  _dayAtPoint(x, y) {
    const allDay = this.refs.body.querySelector('.zx-calendar__all-day-grid');
    if (allDay) {
      const rect = allDay.getBoundingClientRect();
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        const cells = allDay.querySelectorAll('[data-date]');
        const index = Math.max(0, Math.min(cells.length - 1, Math.floor((x - rect.left) / rect.width * cells.length)));
        return parseDayKey(cells[index]?.dataset.date);
      }
    }
    for (const monthEvents of this.refs.body.querySelectorAll('.zx-calendar__month-events')) {
      const rect = monthEvents.getBoundingClientRect();
      if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom || rect.width <= 0) continue;
      const start = parseDayKey(monthEvents.closest('.zx-calendar__month-week')?.dataset.weekStart);
      if (!start) continue;
      const index = Math.max(0, Math.min(6, Math.floor((x - rect.left) / rect.width * 7)));
      return addCalendarDays(start, index);
    }
    for (const agendaDay of this.refs.body.querySelectorAll('.zx-calendar__agenda-day')) {
      const rect = agendaDay.getBoundingClientRect();
      if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) continue;
      return parseDayKey(agendaDay.dataset.date);
    }
    const elements = typeof document.elementsFromPoint === 'function' ? document.elementsFromPoint(x, y) : [];
    for (const element of elements) {
      const dateTarget = element instanceof HTMLElement ? element.closest('[data-date]') : null;
      const date = dateTarget instanceof HTMLElement ? dateTarget.dataset.date : null;
      if (date) return parseDayKey(date);
    }
    return null;
  }

  /** @param {CalendarEvent} event @param {number} x @param {number} y @returns {{minutes: number, days: number}} */
  _dragOffsetForEvent(event, x, y) {
    if (!calendarEventSpansDays(event)) {
      const timed = this._timeAtPoint(x, y);
      if (timed) {
        const slot = normalizeSlot(this.options.slotDuration);
        const duration = Math.max(0, Math.round((event.end.getTime() - event.start.getTime()) / 60_000));
        const maxOffset = Math.max(0, duration - slot);
        const minutes = Math.round((timed.getTime() - event.start.getTime()) / 60_000);
        return { minutes: Math.max(0, Math.min(maxOffset, minutes)), days: 0 };
      }
    }
    const day = this._dayAtPoint(x, y);
    const days = day ? calendarDayDifference(startOfCalendarDay(event.start), day) : 0;
    return { minutes: 0, days: Math.max(0, days) };
  }

  /** @param {Date} day @returns {number} */
  _timeGridDayIndex(day) {
    const key = calendarDayKey(day);
    const headings = [...this.refs.body.querySelectorAll('.zx-calendar__day-heading')];
    return headings.findIndex((heading) => heading.dataset.date === key);
  }

  /** @param {CalendarEvent} event @returns {string|null} */
  _timedPreviewHeight(event) {
    const grid = this.refs.body.querySelector('.zx-calendar__time-grid');
    if (!grid || calendarEventSpansDays(event)) return null;
    const min = normalizeMinute(this.options.slotMinTime, 0);
    const max = normalizeMinute(this.options.slotMaxTime, 1440, true);
    const slot = normalizeSlot(this.options.slotDuration);
    const start = event.start.getHours() * 60 + event.start.getMinutes();
    const end = event.end.getHours() * 60 + event.end.getMinutes();
    const minutes = Math.max(slot, Math.min(max, end) - Math.max(min, start));
    return `${(minutes / (max - min)) * 100}%`;
  }

  /** @param {number} pointerId @returns {void} */
  _capturePointer(pointerId) {
    try {
      this.el.setPointerCapture?.(pointerId);
    } catch {
      // Synthetic PointerEvents used by smoke tests do not create an active pointer capture target.
    }
  }

  /** @param {number} pointerId @returns {void} */
  _releasePointerCapture(pointerId) {
    if (this.el.hasPointerCapture?.(pointerId)) this.el.releasePointerCapture?.(pointerId);
  }

  /** @param {Date} start @param {Date} end @returns {void} */
  _previewSelection(start, end) {
    const low = Math.min(start.getTime(), end.getTime());
    const high = Math.max(start.getTime(), end.getTime());
    for (const slot of this.refs.body.querySelectorAll('[data-slot]')) {
      const value = Number(slot.dataset.dateTime);
      slot.setAttribute('aria-selected', String(value >= low && value < high));
    }
  }

  /** @returns {void} */
  _clearSelectionPreview() {
    for (const slot of this.refs.body.querySelectorAll('[data-slot][aria-selected]')) slot.removeAttribute('aria-selected');
  }

  /** @returns {void} */
  _cancelKeyboardEdit() {
    const edit = this._keyboardEdit;
    if (!edit) return;
    edit.control.removeAttribute('aria-grabbed');
    edit.control.closest('.zx-calendar__event')?.removeAttribute('data-state');
    this._keyboardEdit = null;
    this._announce(this.msg('editCancelled'));
    this._renderView({ preserveFocus: true });
  }

  /** @param {CalendarEvent} oldEvent @param {CalendarEvent} proposed @param {'move'|'resize'} action @param {Event} jsEvent @returns {void} */
  _commitMutation(oldEvent, proposed, action, jsEvent) {
    const changed = oldEvent.start.getTime() !== proposed.start.getTime()
      || oldEvent.end.getTime() !== proposed.end.getTime();
    if (!changed) {
      this._renderView({ preserveFocus: true });
      return;
    }
    const key = String(oldEvent.id);
    const version = ++this._mutationSerial;
    let reverted = false;
    if (this.options.optimistic) {
      this._replaceNormalizedEvent(proposed);
      this._mutationVersions.set(key, version);
      this._renderView({ preserveFocus: true });
    } else {
      this._renderView({ preserveFocus: true });
    }
    const revert = () => {
      if (reverted || !this.options.optimistic || this._mutationVersions.get(key) !== version) return false;
      const current = this._eventById(key);
      if (!current || current.start.getTime() !== proposed.start.getTime()
        || current.end.getTime() !== proposed.end.getTime()) return false;
      reverted = true;
      this._replaceNormalizedEvent(oldEvent);
      this._mutationVersions.delete(key);
      this._renderView({ preserveFocus: true });
      this._announce(this.msg('editCancelled'));
      return true;
    };
    const detail = {
      event: cloneCalendarEvent(proposed),
      oldEvent: cloneCalendarEvent(oldEvent),
      action,
      delta: calendarDelta(oldEvent, proposed),
      jsEvent,
      revert
    };
    const emitted = this.emit('eventchange', detail);
    if (emitted.defaultPrevented) revert();
    else this._announce(this.msg('editCommitted', proposed.title));
  }

  /** @param {CalendarEvent} event @returns {void} */
  _replaceNormalizedEvent(event) {
    const key = String(event.id);
    this._events = this._events.map((current) => String(current.id) === key ? cloneCalendarEvent(event) : current);
  }

  /** @param {CalendarEvent} event @returns {boolean} */
  _canMove(event) {
    if (this.options.disabled) return false;
    if (event.editable != null) return event.editable;
    if (this.options.eventStartEditable != null) return Boolean(this.options.eventStartEditable);
    return Boolean(this.options.editable);
  }

  /** @param {CalendarEvent} event @returns {boolean} */
  _canResize(event) {
    if (this.options.disabled) return false;
    if (event.durationEditable != null) return event.durationEditable;
    if (this.options.eventDurationEditable != null) return Boolean(this.options.eventDurationEditable);
    return Boolean(this.options.editable);
  }

  /** @param {string|number} id @returns {CalendarEvent|null} */
  _eventById(id) {
    const index = this._eventIndex(id);
    return index < 0 ? null : this._events[index];
  }

  /** @param {string|number} id @returns {number} */
  _eventIndex(id) {
    const key = String(id);
    return this._events.findIndex((event) => String(event.id) === key);
  }

  /** @param {number} direction @returns {this} */
  _page(direction) {
    return this.setDate(calendarPageDate(this._view, this._date, direction, {
      agendaDays: this.options.agendaDays
    }));
  }

  /** @param {{start: Date, end: Date}} range @returns {string} */
  _rangeTitle(range) {
    if (this._view === 'day') return this._format(range.start, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    if (this._view === 'month') return this._format(this._date, { month: 'long', year: 'numeric' });
    if (this._view === 'year') return this._format(this._date, { year: 'numeric' });
    const last = addCalendarDays(range.end, -1);
    const formatter = new Intl.DateTimeFormat(this.options.locale, {
      day: 'numeric', month: 'long', year: 'numeric'
    });
    if (typeof formatter.formatRange === 'function') return formatter.formatRange(range.start, last);
    if (range.start.getFullYear() !== last.getFullYear()) {
      return `${this._format(range.start, { day: 'numeric', month: 'short', year: 'numeric' })} – ${this._format(last, { day: 'numeric', month: 'short', year: 'numeric' })}`;
    }
    if (range.start.getMonth() !== last.getMonth()) {
      return `${this._format(range.start, { day: 'numeric', month: 'short' })} – ${this._format(last, { day: 'numeric', month: 'short', year: 'numeric' })}`;
    }
    return `${this._format(range.start, { day: 'numeric' })}–${this._format(last, { day: 'numeric', month: 'long', year: 'numeric' })}`;
  }

  /** @param {CalendarEvent} event @param {Date} day @returns {string} */
  _eventTime(event, day) {
    if (event.allDay) return this.msg('allDay');
    if (calendarEventSpansDays(event)) {
      if (sameCalendarDay(event.start, day)) return `${formatDateTime(event.start, this.options.locale)} →`;
      if (sameCalendarDay(event.end, day)) return `→ ${formatDateTime(event.end, this.options.locale)}`;
      return this.msg('allDay');
    }
    const start = formatTimeDate(event.start, this.options.locale);
    if (event.end <= event.start) return start;
    return `${start}–${formatTimeDate(event.end, this.options.locale)}`;
  }

  /** @param {CalendarEvent} event @returns {string} */
  _eventLabel(event) {
    const location = event.location ? `, ${event.location}` : '';
    return `${event.title}, ${formatDateTime(event.start, this.options.locale)} to ${formatDateTime(event.end, this.options.locale)}${location}`;
  }

  /** @param {Date} date @returns {string} */
  _dateTimeLabel(date) {
    return formatDateTime(date, this.options.locale);
  }

  /** @param {Date} date @param {Intl.DateTimeFormatOptions} options @returns {string} */
  _format(date, options) {
    return new Intl.DateTimeFormat(this.options.locale, options).format(date);
  }

  /** @returns {Date} */
  _now() {
    const source = typeof this.options.now === 'function' ? this.options.now() : this.options.now;
    const date = source == null ? new Date() : source;
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) throw new TypeError('Calendar now must return a valid Date');
    return new Date(date.getTime());
  }

  /** @param {HTMLElement} target @returns {Date|null} */
  _dateFromTarget(target) {
    if (target.dataset.dateTime) {
      const date = new Date(Number(target.dataset.dateTime));
      return Number.isNaN(date.getTime()) ? null : date;
    }
    return parseDayKey(target.dataset.date);
  }

  /** @param {HTMLElement} target @returns {void} */
  _rememberFocusedDate(target) {
    if (target.dataset.slot) this._focusedSlot = target.dataset.slot;
  }

  /** @returns {{eventId?: string, eventAction?: string, date?: string, slot?: string}|null} */
  _focusIdentity() {
    const active = document.activeElement;
    if (!(active instanceof HTMLElement) || !this.el.contains(active)) return null;
    return {
      eventId: active.dataset.eventId,
      eventAction: active.dataset.eventAction,
      date: active.dataset.date,
      slot: active.dataset.slot
    };
  }

  /** @param {{eventId?: string, eventAction?: string, date?: string, slot?: string}} identity @returns {void} */
  _restoreFocus(identity) {
    let target = null;
    if (identity.eventId) target = this.el.querySelector(
      `[data-event-id="${cssEscape(identity.eventId)}"][data-event-action="${identity.eventAction ?? 'activate'}"]`);
    if (!target && identity.slot) target = this.el.querySelector(`[data-slot="${cssEscape(identity.slot)}"]`);
    if (!target && identity.date) target = this.el.querySelector(`[data-date-cell][data-date="${cssEscape(identity.date)}"]`);
    target?.focus?.();
  }

  /** @returns {void} */
  _scrollTimeGrid() {
    const scroller = this.refs.body.querySelector('.zx-calendar__time-scroller');
    if (!scroller) return;
    const min = normalizeMinute(this.options.slotMinTime, 0);
    const max = normalizeMinute(this.options.slotMaxTime, 1440, true);
    const scroll = normalizeMinute(this.options.scrollTime, 480, true);
    const ratio = Math.max(0, Math.min(1, (scroll - min) / (max - min)));
    requestAnimationFrame(() => {
      if (scroller.isConnected) scroller.scrollTop = Math.max(0, ratio * scroller.scrollHeight - scroller.clientHeight / 4);
    });
  }

  /** @returns {void} */
  _refreshNowIndicator() {
    if (this._destroyed || !this.options.nowIndicator || !['day', 'week'].includes(this._view)) return;
    const line = this.refs.body.querySelector('.zx-calendar__now');
    const headings = [...this.refs.body.querySelectorAll('.zx-calendar__day-heading')];
    if (!line || !headings.length) return;
    const now = this._now();
    const dayIndex = headings.findIndex((heading) => heading.dataset.date === calendarDayKey(now));
    const min = normalizeMinute(this.options.slotMinTime, 0);
    const max = normalizeMinute(this.options.slotMaxTime, 1440, true);
    const minutes = now.getHours() * 60 + now.getMinutes();
    const visible = dayIndex >= 0 && minutes >= min && minutes <= max;
    line.hidden = !visible;
    if (!visible) return;
    line.style.insetBlockStart = `${((minutes - min) / (max - min)) * 100}%`;
    line.style.setProperty('--zx-calendar-now-day', String(dayIndex));
    line.querySelector('.zx-calendar__now-time').textContent = formatTimeMinutes(minutes, this.options.locale);
  }

  /** @param {string} message @returns {void} */
  _announce(message) {
    this.refs.status.textContent = '';
    requestAnimationFrame(() => {
      if (!this._destroyed) this.refs.status.textContent = message;
    });
  }
}

/** @param {unknown} value @returns {CalendarView[]} */
function normalizeViews(value) {
  if (!Array.isArray(value) || value.length === 0) throw new TypeError('Calendar views must be a non-empty array');
  const views = [...new Set(value.map(String))];
  for (const view of views) if (!CALENDAR_VIEWS.includes(/** @type {CalendarView} */ (view))) {
    throw new RangeError(`Unknown Calendar view: ${view}`);
  }
  return /** @type {CalendarView[]} */ (views);
}

/** @param {Date|string|number|null} value @param {'milliseconds'|'seconds'} unit @param {Date} fallback @returns {Date} */
function normalizeAnchorDate(value, unit, fallback) {
  if (value == null) return fallback;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) throw new TypeError('Calendar date must be valid');
    return new Date(value.getTime());
  }
  const numeric = typeof value === 'number' ? value : typeof value === 'string' && /^-?\d+(?:\.\d+)?$/.test(value.trim()) ? Number(value) : null;
  const date = numeric == null ? new Date(value) : new Date(numeric * (unit === 'seconds' ? 1000 : 1));
  if (Number.isNaN(date.getTime())) throw new TypeError('Calendar date must be valid');
  return date;
}

/** @param {unknown} value @returns {number} */
function normalizeSlot(value) {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0 || number > 720 || 1440 % number !== 0) {
    throw new RangeError('Calendar slotDuration must be a positive divisor of 1440');
  }
  return number;
}

/** @param {unknown} value @returns {number} */
function normalizeEventLimit(value) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > 20) {
    throw new RangeError('Calendar eventLimit must be an integer from 1 through 20');
  }
  return number;
}

/** @param {unknown} value @param {number} fallback @param {boolean} [allowEnd=false] @returns {number} */
function normalizeMinute(value, fallback, allowEnd = false) {
  const number = Number(value ?? fallback);
  const max = allowEnd ? 1440 : 1439;
  if (!Number.isInteger(number) || number < 0 || number > max) throw new RangeError(`Calendar minute must be from 0 through ${max}`);
  return number;
}

/** @param {Date} date @param {number} minutes @returns {Date} */
function dateWithMinutes(date, minutes) {
  const result = startOfCalendarDay(date);
  result.setMinutes(minutes);
  return result;
}

/** @param {Date} date @param {number} minutes @returns {Date} */
function addMinutes(date, minutes) {
  const result = new Date(date.getTime());
  result.setMinutes(result.getMinutes() + minutes);
  return result;
}

/** @param {Date} date @returns {string} */
function dayTimestamp(date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

/** @param {Date} left @param {Date} right @returns {boolean} */
function sameCalendarDay(left, right) {
  return dayTimestamp(left) === dayTimestamp(right);
}

/** @param {string|undefined} value @returns {Date|null} */
function parseDayKey(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? ''));
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return calendarDayKey(date) === value ? date : null;
}

/** @param {CalendarEvent} left @param {CalendarEvent} right @returns {number} */
function compareEvents(left, right) {
  return left.start - right.start || right.end - left.end || left.title.localeCompare(right.title);
}

/** @param {number} minutes @param {string|string[]|undefined} locale @returns {string} */
function formatTimeMinutes(minutes, locale) {
  const date = new Date(2026, 0, 1);
  date.setHours(Math.floor(minutes / 60) % 24, minutes % 60, 0, 0);
  return formatTimeDate(date, locale);
}

/** @param {Date} date @param {string|string[]|undefined} locale @returns {string} */
function formatTimeDate(date, locale) {
  return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(date);
}

/** @param {Date} date @param {string|string[]|undefined} locale @returns {string} */
function formatDateTime(date, locale) {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
  }).format(date);
}

/** @param {Date} date @returns {number} */
function isoWeek(date) {
  const copy = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const weekday = copy.getUTCDay() || 7;
  copy.setUTCDate(copy.getUTCDate() + 4 - weekday);
  const yearStart = new Date(Date.UTC(copy.getUTCFullYear(), 0, 1));
  return Math.ceil((((copy - yearStart) / 86_400_000) + 1) / 7);
}

/** @param {CalendarEvent} oldEvent @param {CalendarEvent} event @returns {{milliseconds: number, days: number, minutes: number, endMilliseconds: number}} */
function calendarDelta(oldEvent, event) {
  const milliseconds = event.start.getTime() - oldEvent.start.getTime();
  return {
    milliseconds,
    days: calendarDayDifference(startOfCalendarDay(oldEvent.start), startOfCalendarDay(event.start)),
    minutes: Math.round(milliseconds / 60_000),
    endMilliseconds: event.end.getTime() - oldEvent.end.getTime()
  };
}

/** @param {string} value @returns {string} */
function cssEscape(value) {
  return globalThis.CSS?.escape ? CSS.escape(value) : value.replace(/[^a-zA-Z0-9_-]/g, (character) => `\\${character}`);
}

/** @event Calendar#viewchange @type {CustomEvent<{view: CalendarView, oldView: CalendarView}>} */
/** @event Calendar#dateschange @type {CustomEvent<{view: CalendarView, start: Date, end: Date}>} */
/** @event Calendar#eventclick @type {CustomEvent<{event: CalendarEvent, jsEvent: Event}>} */
/** @event Calendar#eventdblclick @type {CustomEvent<{event: CalendarEvent, jsEvent: Event}>} */
/** @event Calendar#dateclick @type {CustomEvent<{date: Date, allDay: boolean, view: CalendarView, jsEvent: Event}>} */
/** @event Calendar#select @type {CustomEvent<{start: Date, end: Date, allDay: boolean, view: CalendarView, jsEvent: Event}>} */
/** @event Calendar#eventchange @type {CustomEvent<CalendarEventChangeDetail>} */
/** @event Calendar#eventschange @type {CustomEvent<{events: CalendarEvent[]}>} */
/** @event Calendar#new @type {CustomEvent<{date: Date, view: CalendarView, jsEvent: Event}>} */
/** @event Calendar#moreclick @type {CustomEvent<{date: Date, count: number, jsEvent: Event}>} */
