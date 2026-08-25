import { Calendar, calendarDayDifference } from '../index.js';
import { dateToUnixSeconds, unixSecondsToDate } from './query.js';

/**
 * @typedef {Object} ZeyosCalendarOptions
 * @property {Record<string, any>[]} [appointments=[]] Current ZeyOS appointment/event occurrences.
 * @property {Record<string, any>[]} [events] Already-normalized generic Calendar records.
 * @property {string|number|Date|null} [date] Calendar anchor.
 * @property {'agenda'|'day'|'week'|'month'|'year'} [view='month'] Initial view.
 * @property {boolean} [optimistic=true] Apply move/resize proposals locally before persistence.
 * @property {boolean} [editable=false] Enable moving and resizing.
 * @property {number} [weekStart=1] User-preferred first weekday.
 * @property {boolean} [workweek=false] Show five days in week view.
 * @property {(event: CustomEvent<Record<string, any>>) => void} [oneventchange] Persistence listener.
 */

/**
 * Maps one expanded ZeyOS appointment/event row to the product-neutral Calendar shape. Occurrence
 * identity includes the start timestamp because recurring rows intentionally share their base ID;
 * persistence callers keep using `event.data.ID`.
 * @param {Record<string, any>} record ZeyOS row.
 * @returns {Record<string, any>} Generic Calendar event.
 */
export function zeyosAppointmentToEvent(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    throw new TypeError('ZeyOS appointment must be an object');
  }
  const baseId = record.ID ?? record.id;
  if (baseId == null || baseId === '') throw new TypeError('ZeyOS appointment requires ID');
  const start = unixSecondsToDate(record.datefrom);
  const end = unixSecondsToDate(record.dateto ?? record.datefrom);
  if (!(start instanceof Date) || !(end instanceof Date)) throw new TypeError('ZeyOS appointment requires datefrom and dateto');
  const association = String(record.assoc_name ?? '').trim();
  const name = String(record.name ?? '').trim() || 'Untitled appointment';
  const title = record.entity && association ? `${association}: ${name}` : name;
  const allDay = record.allDay != null ? Boolean(record.allDay)
    : isMidnight(start) && isMidnight(end) && calendarDayDifference(start, end) >= 1;
  return {
    id: String(record.occurrenceid ?? `${baseId}@${record.datefrom}`),
    title,
    start,
    end,
    allDay,
    color: zeyosCalendarColor(record.color),
    location: String(record.location ?? '').trim(),
    editable: record.editable == null ? null : Boolean(record.editable),
    durationEditable: record.durationEditable == null ? null : Boolean(record.durationEditable),
    data: record
  };
}

/** @param {Record<string, any>[]} records @returns {Record<string, any>[]} */
export function zeyosAppointmentsToEvents(records) {
  if (!Array.isArray(records)) throw new TypeError('ZeyOS appointments must be an array');
  return records.map(zeyosAppointmentToEvent);
}

/**
 * Converts a proposed Calendar occurrence back to the current ZeyOS appointment update fields.
 * The base appointment identifier remains the source record's `ID`; date values become Unix
 * seconds and the adapter never adds recurrence or DAV fields.
 * @param {{start: Date, end: Date, data?: Record<string, any>}} event Calendar event proposal.
 * @returns {{ID?: unknown, datefrom: number|null, dateto: number|null}}
 */
export function calendarEventToZeyosPatch(event) {
  if (!event || !(event.start instanceof Date) || !(event.end instanceof Date)) {
    throw new TypeError('Calendar event patch requires start and end Dates');
  }
  const patch = {
    datefrom: dateToUnixSeconds(event.start),
    dateto: dateToUnixSeconds(event.end)
  };
  if (event.data?.ID != null) return { ID: event.data.ID, ...patch };
  return patch;
}

/**
 * Builds Calendar options while preserving every explicit generic option. `appointments` is
 * mapped only when present; callers may instead pass already-normalized `events`.
 * @param {ZeyosCalendarOptions & Record<string, any>} [options={}] ZeyOS and Calendar options.
 * @returns {Record<string, any>} Plain Calendar options.
 */
export function buildZeyosCalendarOptions(options = {}) {
  const { appointments, ...calendarOptions } = options;
  return {
    weekStart: 1,
    optimistic: true,
    ...calendarOptions,
    events: appointments == null
      ? (Array.isArray(calendarOptions.events) ? calendarOptions.events : [])
      : zeyosAppointmentsToEvents(appointments)
  };
}

/**
 * Creates a Calendar that accepts current ZeyOS appointment/event occurrences directly.
 * @param {Element|string|null} target Existing target or null.
 * @param {ZeyosCalendarOptions & Record<string, any>} [options={}] Adapter and Calendar options.
 * @returns {Calendar}
 */
export function zeyosCalendar(target, options = {}) {
  return new Calendar(target, buildZeyosCalendarOptions(options));
}

/** @param {unknown} value @returns {string|null} */
function zeyosCalendarColor(value) {
  const color = String(value ?? '').trim();
  if (!color) return null;
  return /^[\da-f]{3,8}$/i.test(color) ? `#${color}` : color;
}

/** @param {Date} date @returns {boolean} */
function isMidnight(date) {
  return date.getHours() === 0 && date.getMinutes() === 0 && date.getSeconds() === 0 && date.getMilliseconds() === 0;
}
