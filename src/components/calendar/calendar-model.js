/** @typedef {'agenda'|'day'|'week'|'month'|'year'} CalendarView */
/** @typedef {string|((record: Record<string, any>) => unknown)} CalendarReader */

/**
 * @typedef {Object} CalendarEvent
 * @property {string|number} id Stable event identifier.
 * @property {string} title Visible event title.
 * @property {Date} start Local start date and time.
 * @property {Date} end Local end date and time; equal to start for an instant event.
 * @property {boolean} allDay Whether the event belongs in an all-day lane.
 * @property {string|null} color Optional application-supplied CSS colour.
 * @property {string} location Optional location.
 * @property {boolean|null} editable Per-event move policy, or null to inherit.
 * @property {boolean|null} durationEditable Per-event resize policy, or null to inherit.
 * @property {Record<string, any>} data Original application record.
 */

/**
 * @typedef {Object} CalendarNormalizeOptions
 * @property {CalendarReader} [eventId='id'] ID reader.
 * @property {CalendarReader} [eventTitle='title'] Title reader.
 * @property {CalendarReader} [eventStart='start'] Start reader.
 * @property {CalendarReader} [eventEnd='end'] End reader.
 * @property {CalendarReader} [eventAllDay='allDay'] All-day reader.
 * @property {CalendarReader} [eventColor='color'] Colour reader.
 * @property {CalendarReader} [eventLocation='location'] Location reader.
 * @property {CalendarReader} [eventEditable='editable'] Move-policy reader.
 * @property {CalendarReader} [eventDurationEditable='durationEditable'] Resize-policy reader.
 * @property {'milliseconds'|'seconds'} [dateUnit='milliseconds'] Unit used for numeric dates.
 */

/** @type {readonly CalendarView[]} */
export const CALENDAR_VIEWS = Object.freeze(['agenda', 'day', 'week', 'month', 'year']);

const DAY_MS = 86_400_000;

/**
 * Returns the complete local-date window rendered by a view. The end is exclusive.
 * @param {CalendarView} view View name.
 * @param {Date} anchor Date inside the requested period.
 * @param {{weekStart?: number, agendaDays?: number}} [options={}] Range options.
 * @returns {{start: Date, end: Date}}
 */
export function calendarRange(view, anchor, options = {}) {
  const date = validDate(anchor, 'Calendar date');
  const weekStart = normalizeWeekStart(options.weekStart ?? 1);
  let start;
  let end;

  if (view === 'agenda') {
    start = startOfCalendarDay(date);
    end = addCalendarDays(start, positiveInteger(options.agendaDays ?? 14, 'agendaDays'));
  } else if (view === 'day') {
    start = startOfCalendarDay(date);
    end = addCalendarDays(start, 1);
  } else if (view === 'week') {
    start = startOfCalendarWeek(date, weekStart);
    end = addCalendarDays(start, 7);
  } else if (view === 'month') {
    const first = new Date(date.getFullYear(), date.getMonth(), 1);
    const last = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    start = startOfCalendarWeek(first, weekStart);
    end = addCalendarDays(startOfCalendarWeek(last, weekStart), 7);
  } else if (view === 'year') {
    start = new Date(date.getFullYear(), 0, 1);
    end = new Date(date.getFullYear() + 1, 0, 1);
  } else {
    throw new RangeError(`Unknown calendar view: ${view}`);
  }
  return { start, end };
}

/**
 * Returns the anchor date one visible period away from `anchor`.
 *
 * Month and year steps clamp the day of month into the target month instead of letting it
 * overflow: `setMonth()` alone turns 31 January into 3 March, which makes February unreachable
 * from a month-end anchor and leaves `prev()` on 31 March landing back inside March.
 * @param {CalendarView} view Current view.
 * @param {Date} anchor Current anchor date.
 * @param {number} direction -1 for the previous period, 1 for the next.
 * @param {{agendaDays?: number}} [options={}] Paging options.
 * @returns {Date}
 */
export function calendarPageDate(view, anchor, direction, options = {}) {
  const date = validDate(anchor, 'Calendar date');
  const step = integer(direction, 'direction');
  if (view === 'day') date.setDate(date.getDate() + step);
  else if (view === 'agenda') {
    date.setDate(date.getDate() + step * positiveInteger(options.agendaDays ?? 14, 'agendaDays'));
  } else if (view === 'week') date.setDate(date.getDate() + step * 7);
  else if (view === 'month') return addCalendarMonths(date, step);
  else if (view === 'year') return addCalendarMonths(date, step * 12);
  else throw new RangeError(`Unknown calendar view: ${view}`);
  return date;
}

/**
 * Adds whole months, clamping the day of month to the last day the target month actually has.
 * @param {Date} value Local date.
 * @param {number} months Months to add.
 * @returns {Date}
 */
export function addCalendarMonths(value, months) {
  const date = validDate(value, 'Calendar date');
  const day = date.getDate();
  date.setDate(1);
  date.setMonth(date.getMonth() + integer(months, 'month amount'));
  date.setDate(Math.min(day, daysInCalendarMonth(date.getFullYear(), date.getMonth())));
  return date;
}

/** @param {number} year @param {number} month @returns {number} */
function daysInCalendarMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

/**
 * Normalizes caller records atomically into the Calendar event contract.
 * @param {Record<string, any>[]} records Source records.
 * @param {CalendarNormalizeOptions} [options={}] Reader and date options.
 * @returns {CalendarEvent[]}
 */
export function normalizeCalendarEvents(records, options = {}) {
  if (!Array.isArray(records)) throw new TypeError('Calendar events must be an array');
  const readers = {
    id: options.eventId ?? 'id',
    title: options.eventTitle ?? 'title',
    start: options.eventStart ?? 'start',
    end: options.eventEnd ?? 'end',
    allDay: options.eventAllDay ?? 'allDay',
    color: options.eventColor ?? 'color',
    location: options.eventLocation ?? 'location',
    editable: options.eventEditable ?? 'editable',
    durationEditable: options.eventDurationEditable ?? 'durationEditable'
  };
  const unit = options.dateUnit === 'seconds' ? 'seconds' : 'milliseconds';
  const ids = new Set();
  return records.map((record, index) => {
    if (!record || typeof record !== 'object' || Array.isArray(record)) {
      throw new TypeError(`Calendar event at index ${index} must be an object`);
    }
    const id = readCalendarValue(record, readers.id);
    if (id == null || id === '') throw new TypeError(`Calendar event at index ${index} requires an id`);
    const key = String(id);
    if (ids.has(key)) throw new RangeError(`Duplicate Calendar event id: ${key}`);
    ids.add(key);

    const start = calendarDate(readCalendarValue(record, readers.start), unit, `event ${key} start`);
    const rawEnd = readCalendarValue(record, readers.end);
    const end = rawEnd == null || rawEnd === '' ? new Date(start.getTime())
      : calendarDate(rawEnd, unit, `event ${key} end`);
    if (end < start) throw new RangeError(`Calendar event ${key} ends before it starts`);

    const title = String(readCalendarValue(record, readers.title) ?? '').trim() || 'Untitled event';
    const location = String(readCalendarValue(record, readers.location) ?? '').trim();
    const editable = optionalBoolean(readCalendarValue(record, readers.editable));
    const durationEditable = optionalBoolean(readCalendarValue(record, readers.durationEditable));
    return {
      id,
      title,
      start,
      end,
      allDay: Boolean(readCalendarValue(record, readers.allDay)),
      color: normalizeCalendarColor(readCalendarValue(record, readers.color)),
      location,
      editable,
      durationEditable,
      data: record
    };
  });
}

/**
 * Returns defensive Date copies while retaining the caller's opaque source record.
 * @param {CalendarEvent} event Event to clone.
 * @returns {CalendarEvent}
 */
export function cloneCalendarEvent(event) {
  return { ...event, start: new Date(event.start.getTime()), end: new Date(event.end.getTime()) };
}

/**
 * Lays out timed events for one day into collision columns.
 * @param {CalendarEvent[]} events Normalized events.
 * @param {Date} day Local day.
 * @param {{minMinutes?: number, maxMinutes?: number, minimumMinutes?: number}} [options={}] Grid bounds.
 * @returns {Array<{event: CalendarEvent, start: Date, end: Date, startMinutes: number, endMinutes: number, column: number, columns: number}>}
 */
export function layoutTimedCalendarEvents(events, day, options = {}) {
  const minMinutes = calendarMinutes(options.minMinutes ?? 0, 'minMinutes');
  const maxMinutes = calendarMinutes(options.maxMinutes ?? 1440, 'maxMinutes', true);
  const minimumMinutes = positiveInteger(options.minimumMinutes ?? 30, 'minimumMinutes');
  if (maxMinutes <= minMinutes) throw new RangeError('Calendar maxMinutes must exceed minMinutes');
  const dayStart = startOfCalendarDay(day);
  const gridStart = dateAtMinutes(dayStart, minMinutes);
  const gridEnd = dateAtMinutes(dayStart, maxMinutes);
  const candidates = events.filter((event) => !calendarEventSpansDays(event)
    && eventIntersects(event, gridStart, gridEnd)).map((event) => {
    const start = new Date(Math.max(event.start.getTime(), gridStart.getTime()));
    let end = new Date(Math.min(event.end.getTime(), gridEnd.getTime()));
    if (end <= start) end = new Date(Math.min(gridEnd.getTime(), start.getTime() + minimumMinutes * 60_000));
    return {
      event,
      start,
      end,
      startMinutes: minutesSinceDay(dayStart, start),
      endMinutes: minutesSinceDay(dayStart, end),
      column: 0,
      columns: 1
    };
  }).sort((left, right) => left.start - right.start || right.end - left.end
    || String(left.event.id).localeCompare(String(right.event.id)));

  /** @type {typeof candidates} */
  let cluster = [];
  let clusterEnd = -Infinity;
  const finishCluster = () => {
    if (!cluster.length) return;
    /** @type {number[]} */
    const activeEnds = [];
    let columnCount = 1;
    for (const item of cluster) {
      let column = activeEnds.findIndex((end) => end <= item.start.getTime());
      if (column === -1) column = activeEnds.length;
      activeEnds[column] = item.end.getTime();
      item.column = column;
      columnCount = Math.max(columnCount, column + 1);
    }
    for (const item of cluster) item.columns = columnCount;
    cluster = [];
    clusterEnd = -Infinity;
  };

  for (const item of candidates) {
    if (cluster.length && item.start.getTime() >= clusterEnd) finishCluster();
    cluster.push(item);
    clusterEnd = Math.max(clusterEnd, item.end.getTime());
  }
  finishCluster();
  return candidates;
}

/**
 * Assigns clipped all-day/multi-day spans to non-overlapping lanes in a period.
 * @param {CalendarEvent[]} events Normalized events.
 * @param {Date} rangeStart First visible local day.
 * @param {number} days Number of visible days.
 * @returns {Array<{event: CalendarEvent, start: number, end: number, lane: number}>}
 */
export function layoutCalendarSpans(events, rangeStart, days) {
  const start = startOfCalendarDay(rangeStart);
  const end = addCalendarDays(start, positiveInteger(days, 'days'));
  const spans = events.filter((event) => calendarEventSpansDays(event)
    && eventIntersects(event, start, end)).map((event) => {
    const eventStart = startOfCalendarDay(event.start);
    const eventEnd = calendarEventEndDay(event);
    return {
      event,
      start: Math.max(0, calendarDayDifference(start, eventStart)),
      end: Math.min(days, calendarDayDifference(start, eventEnd)),
      lane: 0
    };
  }).filter((span) => span.end > span.start)
    .sort((left, right) => left.start - right.start || right.end - left.end
      || String(left.event.id).localeCompare(String(right.event.id)));

  /** @type {number[]} */
  const lanes = [];
  for (const span of spans) {
    let lane = lanes.findIndex((laneEnd) => laneEnd <= span.start);
    if (lane === -1) lane = lanes.length;
    span.lane = lane;
    lanes[lane] = span.end;
  }
  return spans;
}

/**
 * Creates an immutable local-time move/resize proposal.
 * @param {CalendarEvent} event Source event.
 * @param {{days?: number, minutes?: number, endDays?: number, endMinutes?: number}} delta Local delta.
 * @returns {CalendarEvent}
 */
export function shiftCalendarEvent(event, delta = {}) {
  const days = integer(delta.days ?? 0, 'days');
  const minutes = integer(delta.minutes ?? 0, 'minutes');
  const endDays = integer(delta.endDays ?? days, 'endDays');
  const endMinutes = integer(delta.endMinutes ?? minutes, 'endMinutes');
  const next = cloneCalendarEvent(event);
  next.start = shiftLocalDate(next.start, days, minutes);
  next.end = shiftLocalDate(next.end, endDays, endMinutes);
  if (next.end < next.start) throw new RangeError('Calendar event proposal ends before it starts');
  return next;
}

/** @param {Date} value @returns {Date} */
export function startOfCalendarDay(value) {
  const date = validDate(value, 'Calendar date');
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** @param {Date} value @param {number} amount @returns {Date} */
export function addCalendarDays(value, amount) {
  const date = validDate(value, 'Calendar date');
  const next = new Date(date.getTime());
  next.setDate(next.getDate() + integer(amount, 'day amount'));
  return next;
}

/** @param {Date} value @param {number} weekStart @returns {Date} */
export function startOfCalendarWeek(value, weekStart = 1) {
  const date = startOfCalendarDay(value);
  const normalized = normalizeWeekStart(weekStart);
  return addCalendarDays(date, -((date.getDay() - normalized + 7) % 7));
}

/** @param {Date} start @param {Date} end @returns {number} */
export function calendarDayDifference(start, end) {
  const left = startOfCalendarDay(start);
  const right = startOfCalendarDay(end);
  const leftUtc = Date.UTC(left.getFullYear(), left.getMonth(), left.getDate());
  const rightUtc = Date.UTC(right.getFullYear(), right.getMonth(), right.getDate());
  return Math.round((rightUtc - leftUtc) / DAY_MS);
}

/** @param {Date} value @returns {string} */
export function calendarDayKey(value) {
  const date = validDate(value, 'Calendar date');
  const pad = (number) => String(number).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** @param {CalendarEvent} event @returns {boolean} */
export function calendarEventSpansDays(event) {
  if (event.allDay) return true;
  if (event.end <= event.start) return false;
  const lastInstant = new Date(event.end.getTime() - 1);
  return calendarDayKey(event.start) !== calendarDayKey(lastInstant);
}

/** @param {CalendarEvent} event @param {Date} start @param {Date} end @returns {boolean} */
export function calendarEventIntersects(event, start, end) {
  return eventIntersects(event, start, end);
}

/** @param {Date} value @param {number} days @param {number} minutes @returns {Date} */
function shiftLocalDate(value, days, minutes) {
  const result = new Date(value.getTime());
  result.setDate(result.getDate() + days);
  result.setMinutes(result.getMinutes() + minutes);
  return result;
}

/** @param {CalendarEvent} event @returns {Date} */
function calendarEventEndDay(event) {
  if (event.end <= event.start) return addCalendarDays(startOfCalendarDay(event.start), 1);
  const endDay = startOfCalendarDay(event.end);
  const exactlyMidnight = event.end.getTime() === endDay.getTime();
  return exactlyMidnight ? endDay : addCalendarDays(endDay, 1);
}

/** @param {CalendarEvent} event @param {Date} start @param {Date} end @returns {boolean} */
function eventIntersects(event, start, end) {
  const eventEnd = event.end > event.start ? event.end : new Date(event.start.getTime() + 1);
  return event.start < end && eventEnd > start;
}

/** @param {Record<string, any>} record @param {CalendarReader} reader @returns {unknown} */
function readCalendarValue(record, reader) {
  return typeof reader === 'function' ? reader(record) : record[reader];
}

/** @param {unknown} value @param {'milliseconds'|'seconds'} unit @param {string} label @returns {Date} */
function calendarDate(value, unit, label) {
  let date;
  if (value instanceof Date) date = new Date(value.getTime());
  else if (typeof value === 'number' || (typeof value === 'string' && /^-?\d+(?:\.\d+)?$/.test(value.trim()))) {
    const numeric = Number(value);
    date = new Date(numeric * (unit === 'seconds' ? 1000 : 1));
  } else date = new Date(/** @type {string} */ (value));
  return validDate(date, label);
}

/** @param {unknown} value @returns {boolean|null} */
function optionalBoolean(value) {
  return value == null ? null : Boolean(value);
}

/** @param {unknown} value @returns {string|null} */
function normalizeCalendarColor(value) {
  const color = String(value ?? '').trim();
  if (!color) return null;
  if (color.length > 100 || /[;{}]|url\s*\(|image\s*\(/i.test(color)) return null;
  if (/^#[\da-f]{3,8}$/i.test(color)
    || /^(?:rgb|hsl|hwb|lab|lch|oklab|oklch|color)\([^{};]+\)$/i.test(color)
    || /^var\(--[\w-]+\)$/i.test(color)
    || /^[a-z]+$/i.test(color)) return color;
  return null;
}

/** @param {Date} day @param {number} minutes @returns {Date} */
function dateAtMinutes(day, minutes) {
  const date = startOfCalendarDay(day);
  date.setMinutes(minutes);
  return date;
}

/** @param {Date} day @param {Date} value @returns {number} */
function minutesSinceDay(day, value) {
  return (value.getTime() - day.getTime()) / 60_000;
}

/** @param {unknown} value @param {string} label @returns {Date} */
function validDate(value, label) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) throw new TypeError(`${label} must be a valid Date`);
  return new Date(value.getTime());
}

/** @param {unknown} value @returns {number} */
function normalizeWeekStart(value) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0 || number > 6) throw new RangeError('weekStart must be from 0 through 6');
  return number;
}

/** @param {unknown} value @param {string} label @returns {number} */
function integer(value, label) {
  const number = Number(value);
  if (!Number.isInteger(number)) throw new TypeError(`${label} must be an integer`);
  return number;
}

/** @param {unknown} value @param {string} label @returns {number} */
function positiveInteger(value, label) {
  const number = integer(value, label);
  if (number <= 0) throw new RangeError(`${label} must be greater than zero`);
  return number;
}

/** @param {unknown} value @param {string} label @param {boolean} [allowEnd=false] @returns {number} */
function calendarMinutes(value, label, allowEnd = false) {
  const number = integer(value, label);
  const max = allowEnd ? 1440 : 1439;
  if (number < 0 || number > max) throw new RangeError(`${label} must be from 0 through ${max}`);
  return number;
}
