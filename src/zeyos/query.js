/** @typedef {{id?: string, field?: string, rawField?: string, dir?: 'asc'|'desc'}} ZxSort */

/**
 * @typedef {Object} ListQueryOptions
 * @property {string[]|Record<string, string>} [fields] Projection, including aliases and dot joins.
 * @property {ZxSort|ZxSort[]} [sort] Zx table sort state.
 * @property {Record<string, unknown>} [filters] ZeyOS field predicates.
 * @property {string} [search] Full-text query.
 * @property {string[]} [searchFields] UI search-field metadata; ZeyOS searches its indexed text fields.
 * @property {number} [limit] Page size.
 * @property {number} [offset] Page offset.
 * @property {number|null} [visibility=0] Visibility predicate; null is preserved deliberately.
 * @property {boolean} [count=false] Request a server-side count instead of counting a returned page.
 */

/**
 * @typedef {Object} ServerFilterDefinition
 * @property {string} id DataFilter state key.
 * @property {string} [field] Raw ZeyOS field.
 * @property {string} [rawField] Raw ZeyOS field when the UI id is an alias.
 * @property {string[]} [fields] Raw fields combined as an OR group.
 * @property {string} [operator] ZeyOS comparison operator such as `>=` or `IN`.
 * @property {string} [format] Semantic value format; date/datetime values become Unix seconds. With
 * a `timeZone` conversion option, a `date` (date-only) value is a calendar day and becomes that
 * day's midnight in the zone, like a ZeyOS form stores it; `datetime` values stay instants.
 * @property {string} [type] Semantic value type, read like `format`.
 * @property {boolean} [includeEmpty=false] Preserve an empty-string value instead of treating it as inactive UI state.
 * @property {boolean} [includeNull=false] Preserve null instead of treating it as inactive UI state.
 * @property {(value: unknown, state: Record<string, unknown>) => unknown} [transform] Value transform.
 * @property {(value: unknown, state: Record<string, unknown>) => Record<string, unknown>|undefined} [toFilter] Complete predicate transform.
 */

/**
 * Converts a Date to the Unix-second unit used by every ZeyOS timestamp.
 * Milliseconds are truncated because the server stores whole seconds.
 * @param {Date|null|undefined} date Date value.
 * @returns {number|null} Unix seconds, or null for a nullish input.
 */
export function dateToUnixSeconds(date) {
  if (date == null) return null;
  if (!(date instanceof Date)) throw new TypeError('Expected a Date');
  const milliseconds = date.getTime();
  if (!Number.isFinite(milliseconds)) throw new RangeError('Invalid Date');
  return Math.floor(milliseconds / 1000);
}

/**
 * Converts a ZeyOS Unix-second timestamp to a Date.
 * Numeric strings are accepted because some endpoints serialize bigint columns as strings.
 * @param {number|string|null|undefined} seconds Unix seconds.
 * @returns {Date|null} Date value, or null for a nullish input.
 */
export function unixSecondsToDate(seconds) {
  if (seconds == null) return null;
  const value = Number(seconds);
  if (!Number.isFinite(value)) throw new TypeError('Expected finite Unix seconds');
  return new Date(value * 1000);
}

/**
 * @typedef {Object} CalendarDay
 * @property {number} year Full year.
 * @property {number} month Zero-based month, as `Date` counts them.
 * @property {number} day Day of the month.
 */

/**
 * @typedef {Object} CalendarZone
 * @property {string|undefined} timeZone Canonical IANA zone, or undefined for the runtime's own zone.
 * @property {(milliseconds: number) => CalendarDay} dayOf Calendar day an instant falls on in the zone.
 * @property {(year: number, month: number, day: number) => number} midnightOf Epoch milliseconds of
 * the first moment of a calendar day in the zone (its midnight, or the first minute after a
 * daylight-saving gap that swallows midnight).
 */

/**
 * Reads a ZeyOS date-only value as the calendar day it names. Date-only fields — an invoice's
 * `date` and `duedate`, a contact's `birthdate` — hold Unix seconds at midnight of a day in the
 * instance's time zone: a calendar day, not an instant. The result is midnight of that same day in
 * the runtime's own zone, which is what Datebox and DatePicker edit, so the day survives a viewer in
 * another zone and a daylight-saving change.
 * @param {number|string|null|undefined} seconds Unix seconds; numeric strings are accepted.
 * @param {string} [timeZone] IANA zone of the instance, such as `Europe/Vienna`; the runtime's own
 * zone when omitted.
 * @returns {Date|null} Local midnight of the day, or null for a nullish or empty input.
 */
export function unixSecondsToCalendarDay(seconds, timeZone) {
  if (seconds == null || seconds === '') return null;
  const value = Number(seconds);
  if (!Number.isFinite(value)) throw new TypeError('Expected finite Unix seconds');
  const { year, month, day } = calendarZone(timeZone).dayOf(value * 1000);
  return localMidnight(year, month, day);
}

/**
 * Converts the calendar day of a Date to the Unix seconds a ZeyOS date-only field stores: midnight
 * of that day in the instance's time zone. Only the Date's local year, month, and day count — its
 * time of day is ignored — so a Datebox value round-trips through {@link unixSecondsToCalendarDay}.
 * @param {Date|null|undefined} date Day to store.
 * @param {string} [timeZone] IANA zone of the instance; the runtime's own zone when omitted.
 * @returns {number|null} Unix seconds, or null for a nullish input.
 */
export function calendarDayToUnixSeconds(date, timeZone) {
  if (date == null) return null;
  if (!(date instanceof Date)) throw new TypeError('Expected a Date');
  if (!Number.isFinite(date.getTime())) throw new RangeError('Invalid Date');
  const midnight = calendarZone(timeZone).midnightOf(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.floor(midnight / 1000);
}

/**
 * Validates an IANA time-zone name.
 * @param {unknown} timeZone Zone name; nullish or empty selects the runtime's own zone.
 * @returns {string|undefined} The canonical zone name, or undefined for the runtime's own zone.
 * @throws {RangeError} When the runtime does not know the zone.
 */
export function normalizeTimeZone(timeZone) {
  if (timeZone == null || timeZone === '') return undefined;
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: String(timeZone) }).resolvedOptions().timeZone;
  } catch {
    throw new RangeError(`Unknown time zone "${String(timeZone)}"`);
  }
}

/**
 * Calendar arithmetic for one time zone. The `Intl` formatter is built once, so a table column can
 * hold one zone for all of its cells.
 * @param {string} [timeZone] IANA zone; the runtime's own zone when omitted.
 * @returns {CalendarZone} Day lookup and midnight construction for the zone.
 */
export function calendarZone(timeZone) {
  const zone = normalizeTimeZone(timeZone);
  if (!zone) {
    return {
      timeZone: undefined,
      dayOf: (milliseconds) => {
        const date = new Date(milliseconds);
        return { year: date.getFullYear(), month: date.getMonth(), day: date.getDate() };
      },
      midnightOf: (year, month, day) => localMidnight(year, month, day).getTime()
    };
  }

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric'
  });
  /** @param {number} milliseconds @returns {CalendarDay & {seconds: number}} */
  const wallClock = (milliseconds) => {
    const parts = {};
    for (const part of formatter.formatToParts(new Date(milliseconds))) parts[part.type] = Number(part.value);
    return {
      year: parts.year,
      month: parts.month - 1,
      day: parts.day,
      seconds: (parts.hour % 24) * 3600 + parts.minute * 60 + parts.second
    };
  };
  /** @param {number} milliseconds @returns {number} The zone's UTC offset at that instant, in milliseconds. */
  const offsetAt = (milliseconds) => {
    const wall = wallClock(milliseconds);
    return utcMidnight(wall.year, wall.month, wall.day) + wall.seconds * 1000
      - Math.floor(milliseconds / 1000) * 1000;
  };

  return {
    timeZone: zone,
    dayOf: (milliseconds) => {
      const { year, month, day } = wallClock(milliseconds);
      return { year, month, day };
    },
    midnightOf: (year, month, day) => {
      // Midnight is the instant whose wall clock reads the target day at 00:00. Two offset
      // corrections settle it on either side of a daylight-saving change; where a change skips
      // midnight altogether, the earlier candidate lands on the previous evening and the later one
      // on the first minute of the day, which is the one kept.
      const target = utcMidnight(year, month, day);
      const first = target - offsetAt(target);
      const second = target - offsetAt(first);
      let best = null;
      for (const candidate of [second, first]) {
        const wall = wallClock(candidate);
        if (wall.year !== year || wall.month !== month || wall.day !== day) continue;
        if (!best || wall.seconds < best.seconds) best = { candidate, seconds: wall.seconds };
      }
      return best ? best.candidate : second;
    }
  };
}

/** @param {number} year @param {number} month @param {number} day @returns {Date} */
function localMidnight(year, month, day) {
  const date = new Date(2000, 0, 1);
  date.setFullYear(year, month, day);
  date.setHours(0, 0, 0, 0);
  return date;
}

/** @param {number} year @param {number} month @param {number} day @returns {number} */
function utcMidnight(year, month, day) {
  const date = new Date(0);
  date.setUTCFullYear(year, month, day);
  return date.getTime();
}

/**
 * Converts one or more Zx Table sort records to the signed field notation used by ZeyOS.
 * A missing sort produces an empty array.
 * @param {ZxSort|ZxSort[]|null|undefined} sort Zx sort state.
 * @returns {string[]} Signed raw fields such as `+name` or `-lastmodified`.
 */
export function tableSortToQuery(sort) {
  const entries = Array.isArray(sort) ? sort : (sort ? [sort] : []);
  return entries.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const source = entry.rawField ?? entry.field ?? entry.id;
    if (source == null || String(source).trim() === '') return [];
    const field = String(source).trim().replace(/^[+-]/, '');
    return [`${entry.dir === 'desc' ? '-' : '+'}${field}`];
  });
}

/**
 * @typedef {Object} FilterConversionOptions
 * @property {string|null} [timeZone] IANA zone of the ZeyOS instance. When given, values of
 * `date` (date-only) definitions are calendar days: a `Date` counts by its local year, month, and
 * day, a `YYYY-MM-DD` string by its digits, and either becomes midnight of that day in the zone —
 * exactly what `calendarDayToUnixSeconds()` and `zeyosForm()` store, so a viewer in another zone
 * filters `duedate` by the day they picked. `null` names the runtime's own zone. Omitted, dates
 * convert as exact instants, as they always have.
 */

/**
 * Converts DataFilter state to ZeyOS field predicates. Definitions may rename UI ids,
 * add comparison operators, combine several fields with OR, or transform values. Blank/null
 * values are DataFilter's inactive sentinels by default; `includeEmpty`/`includeNull` opt in to
 * the distinct ZeyOS meanings. Zero and false are always retained.
 * @param {Record<string, unknown>} state DataFilter state keyed by definition id.
 * @param {ServerFilterDefinition[]|Record<string, string|ServerFilterDefinition>} [defs=[]] Server mappings.
 * @param {FilterConversionOptions} [options={}] Conversion options, such as the instance zone.
 * @returns {Record<string, unknown>} ZeyOS `filters` object (plural at the call site).
 * @throws {RangeError} When `options.timeZone` names a zone the runtime does not know.
 */
export function dataFilterStateToFilters(state, defs = [], options = {}) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) {
    throw new TypeError('DataFilter state must be an object');
  }
  const calendarDays = Boolean(options) && typeof options === 'object'
    && Object.prototype.hasOwnProperty.call(options, 'timeZone');
  const zone = calendarDays ? normalizeTimeZone(options.timeZone) : undefined;
  const definitions = normalizeDefinitions(state, defs);
  const filters = {};
  let groupIndex = 0;

  for (const definition of definitions) {
    if (!definition.id || !Object.prototype.hasOwnProperty.call(state, definition.id)) continue;
    const original = state[definition.id];
    if (original === undefined) continue;
    if (original === null && definition.includeNull !== true) continue;
    if (typeof original === 'string' && original.trim() === '' && definition.includeEmpty !== true) continue;

    if (typeof definition.toFilter === 'function') {
      const predicate = definition.toFilter(original, state);
      if (predicate && typeof predicate === 'object' && !Array.isArray(predicate)) {
        Object.assign(filters, predicate);
      }
      continue;
    }

    let value = typeof definition.transform === 'function'
      ? definition.transform(original, state)
      : normalizeFilterValue(original, definition, calendarDays ? { timeZone: zone } : null);
    if (value === undefined) continue;
    if (definition.operator) value = { [definition.operator]: value };

    const fields = Array.isArray(definition.fields)
      ? definition.fields.filter((field) => typeof field === 'string' && field)
      : [];
    if (fields.length > 1) {
      while (Object.prototype.hasOwnProperty.call(filters, String(groupIndex))) groupIndex += 1;
      filters[String(groupIndex)] = ['OR', ...fields.map((field) => ({ [field]: value }))];
      groupIndex += 1;
      continue;
    }
    const field = fields[0] ?? definition.rawField ?? definition.field ?? definition.id;
    if (typeof field === 'string' && field) filters[field] = value;
  }
  return filters;
}

/**
 * Builds the body passed to a generated `client.api.list<Resource>()` operation. Predicates are
 * always emitted under `filters` (plural), which is required for indexed foreign-key matching.
 * Full-text `query` is server-scoped: `searchFields` describes the UI but is not an API parameter.
 * Set `count` to use ZeyOS's server-side count; there is no equivalent server-side SUM.
 * @param {ListQueryOptions} [options={}] Zx list state.
 * @returns {Record<string, unknown>} ZeyOS list request body.
 */
export function buildListQuery(options = {}) {
  const {
    fields, sort, filters = {}, search, limit, offset, visibility = 0, count = false
  } = options;
  if (!filters || typeof filters !== 'object' || Array.isArray(filters)) {
    throw new TypeError('ZeyOS filters must be an object');
  }

  const query = {};
  if (Array.isArray(fields)) query.fields = [...fields];
  else if (fields && typeof fields === 'object') query.fields = { ...fields };

  const fieldPredicates = { ...filters };
  const explicitVisibility = Object.prototype.hasOwnProperty.call(options, 'visibility');
  if (visibility !== undefined && (explicitVisibility || !Object.prototype.hasOwnProperty.call(fieldPredicates, 'visibility'))) {
    fieldPredicates.visibility = visibility;
  }
  if (Object.keys(fieldPredicates).length) query.filters = fieldPredicates;

  const mappedSort = mapSortAliases(sort, fields);
  const sortQuery = tableSortToQuery(mappedSort);
  if (sortQuery.length) query.sort = sortQuery;

  if (search != null && String(search).trim()) query.query = String(search).trim();
  if (limit != null) query.limit = limit;
  if (offset != null) query.offset = offset;
  if (count) query.count = true;
  return query;
}

/** @param {Record<string, unknown>} state @param {ServerFilterDefinition[]|Record<string, string|ServerFilterDefinition>} defs @returns {ServerFilterDefinition[]} */
function normalizeDefinitions(state, defs) {
  if (Array.isArray(defs) && defs.length) return defs.map((definition) => ({ ...definition }));
  if (defs && typeof defs === 'object' && !Array.isArray(defs) && Object.keys(defs).length) {
    return Object.entries(defs).map(([id, definition]) => typeof definition === 'string'
      ? { id, field: definition }
      : { ...definition, id });
  }
  return Object.keys(state).map((id) => ({ id, field: id }));
}

/**
 * @param {unknown} value Filter value.
 * @param {ServerFilterDefinition} definition Server mapping.
 * @param {{timeZone: string|undefined}|null} calendar Zone for date-only values, or null to convert
 * every date as an instant.
 * @returns {unknown}
 */
function normalizeFilterValue(value, definition, calendar = null) {
  const semantic = String(definition.format ?? definition.type ?? '').toLowerCase();
  if (!['date', 'datetime', 'date-time'].includes(semantic)) return value;
  /** @param {unknown} entry @returns {unknown} */
  const convert = (entry) => {
    if (calendar && semantic === 'date') {
      if (entry instanceof Date) return calendarDayToUnixSeconds(entry, calendar.timeZone);
      const day = typeof entry === 'string' ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(entry.trim()) : null;
      if (day) {
        const midnight = calendarZone(calendar.timeZone).midnightOf(Number(day[1]), Number(day[2]) - 1, Number(day[3]));
        return Math.floor(midnight / 1000);
      }
      return entry;
    }
    return entry instanceof Date ? dateToUnixSeconds(entry) : entry;
  };
  return Array.isArray(value) ? value.map(convert) : convert(value);
}

/** @param {ZxSort|ZxSort[]|undefined} sort @param {string[]|Record<string, string>|undefined} fields @returns {ZxSort|ZxSort[]|undefined} */
function mapSortAliases(sort, fields) {
  if (!sort || !fields || Array.isArray(fields) || typeof fields !== 'object') return sort;
  const mapOne = (entry) => {
    if (!entry || typeof entry !== 'object') return entry;
    const alias = entry.id;
    if (!alias || !Object.prototype.hasOwnProperty.call(fields, alias)) return entry;
    return { ...entry, rawField: fields[alias] };
  };
  return Array.isArray(sort) ? sort.map(mapOne) : mapOne(sort);
}
