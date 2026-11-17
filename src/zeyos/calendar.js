import { translate } from '../core/i18n.js';
import { Calendar, calendarDayDifference } from '../index.js';
import { calendarDayToUnixSeconds, calendarZone, dateToUnixSeconds, unixSecondsToDate } from './query.js';

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
 * @property {string} [timeZone] IANA time zone of the ZeyOS instance. An appointment running from
 * midnight to midnight in this zone is all-day and shows on the calendar days it names there, for a
 * viewer in any zone; defaults to the runtime's own zone.
 */

/**
 * @typedef {Object} ZeyosCalendarZoneOptions
 * @property {string} [timeZone] IANA time zone of the ZeyOS instance; the runtime's own zone when
 * omitted.
 */

/**
 * Maps one expanded ZeyOS appointment/event row to the product-neutral Calendar shape. Occurrence
 * identity includes the start timestamp because recurring rows intentionally share their base ID;
 * persistence callers keep using `event.data.ID`. A row without an `allDay` flag is all-day when it
 * runs from midnight to midnight, at least a day apart, in `options.timeZone`; with a zone given,
 * an all-day row's start and end become local midnight of the calendar days they name there.
 * @param {Record<string, any>} record ZeyOS row.
 * @param {ZeyosCalendarZoneOptions} [options={}] Instance time zone.
 * @returns {Record<string, any>} Generic Calendar event.
 * @throws {RangeError} When `options.timeZone` names a zone the runtime does not know.
 */
export function zeyosAppointmentToEvent(record, options = {}) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    throw new TypeError('ZeyOS appointment must be an object');
  }
  const baseId = record.ID ?? record.id;
  if (baseId == null || baseId === '') throw new TypeError('ZeyOS appointment requires ID');
  const timeZone = options?.timeZone;
  const zone = timeZone == null || timeZone === '' ? null : calendarZone(timeZone);
  let start = unixSecondsToDate(record.datefrom);
  let end = unixSecondsToDate(record.dateto ?? record.datefrom);
  if (!(start instanceof Date) || !(end instanceof Date)) throw new TypeError('ZeyOS appointment requires datefrom and dateto');
  const association = String(record.assoc_name ?? '').trim();
  const name = String(record.name ?? '').trim() || translate('zeyosCalendar.untitled');
  const title = record.entity && association ? `${association}: ${name}` : name;
  let allDay;
  if (zone) {
    // Midnight is read in the instance's zone, not the viewer's, and an all-day row is shown on
    // the days it names there.
    const startDay = zoneMidnightDay(start, zone);
    const endDay = zoneMidnightDay(end, zone);
    allDay = record.allDay != null ? Boolean(record.allDay)
      : Boolean(startDay && endDay && calendarDayDifference(startDay, endDay) >= 1);
    if (allDay && startDay && endDay) {
      start = startDay;
      end = endDay;
    }
  } else {
    allDay = record.allDay != null ? Boolean(record.allDay)
      : isMidnight(start) && isMidnight(end) && calendarDayDifference(start, end) >= 1;
  }
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

/**
 * Maps expanded ZeyOS appointment/event rows with {@link zeyosAppointmentToEvent}.
 * @param {Record<string, any>[]} records ZeyOS rows.
 * @param {ZeyosCalendarZoneOptions} [options={}] Instance time zone.
 * @returns {Record<string, any>[]} Generic Calendar events.
 */
export function zeyosAppointmentsToEvents(records, options = {}) {
  if (!Array.isArray(records)) throw new TypeError('ZeyOS appointments must be an array');
  return records.map((record) => zeyosAppointmentToEvent(record, options));
}

/**
 * Converts a proposed Calendar occurrence back to the current ZeyOS appointment update fields.
 * The base appointment identifier remains the source record's `ID`; date values become Unix
 * seconds and the adapter never adds recurrence or DAV fields. With `options.timeZone`, an all-day
 * event's days are stored as midnight in that zone, the way {@link zeyosAppointmentToEvent} reads
 * them.
 * @param {{start: Date, end: Date, allDay?: boolean, data?: Record<string, any>}} event Calendar event proposal.
 * @param {ZeyosCalendarZoneOptions} [options={}] Instance time zone.
 * @returns {{ID?: unknown, datefrom: number|null, dateto: number|null}}
 * @throws {RangeError} When the event is all-day and `options.timeZone` names a zone the runtime
 * does not know.
 */
export function calendarEventToZeyosPatch(event, options = {}) {
  if (!event || !(event.start instanceof Date) || !(event.end instanceof Date)) {
    throw new TypeError('Calendar event patch requires start and end Dates');
  }
  const timeZone = options?.timeZone;
  const days = event.allDay === true && timeZone != null && timeZone !== '';
  const patch = days
    ? {
      datefrom: calendarDayToUnixSeconds(event.start, timeZone),
      dateto: calendarDayToUnixSeconds(event.end, timeZone)
    }
    : {
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
  const { appointments, timeZone, ...calendarOptions } = options;
  return {
    weekStart: 1,
    optimistic: true,
    ...calendarOptions,
    events: appointments == null
      ? (Array.isArray(calendarOptions.events) ? calendarOptions.events : [])
      : zeyosAppointmentsToEvents(appointments, { timeZone })
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

/**
 * Local midnight of the calendar day an instant names in `zone`, or null when the instant is not
 * that day's midnight there.
 * @param {Date} date Instant.
 * @param {import('./query.js').CalendarZone} zone Instance zone.
 * @returns {Date|null}
 */
function zoneMidnightDay(date, zone) {
  const { year, month, day } = zone.dayOf(date.getTime());
  if (zone.midnightOf(year, month, day) !== date.getTime()) return null;
  const local = new Date(2000, 0, 1);
  local.setFullYear(year, month, day);
  local.setHours(0, 0, 0, 0);
  return local;
}
