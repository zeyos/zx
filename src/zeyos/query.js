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
 * @property {string} [format] Semantic value format; date/datetime values become Unix seconds.
 * @property {string} [type] Semantic value type; date/datetime values become Unix seconds.
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
 * Converts DataFilter state to ZeyOS field predicates. Definitions may rename UI ids,
 * add comparison operators, combine several fields with OR, or transform values. Blank/null
 * values are DataFilter's inactive sentinels by default; `includeEmpty`/`includeNull` opt in to
 * the distinct ZeyOS meanings. Zero and false are always retained.
 * @param {Record<string, unknown>} state DataFilter state keyed by definition id.
 * @param {ServerFilterDefinition[]|Record<string, string|ServerFilterDefinition>} [defs=[]] Server mappings.
 * @returns {Record<string, unknown>} ZeyOS `filters` object (plural at the call site).
 */
export function dataFilterStateToFilters(state, defs = []) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) {
    throw new TypeError('DataFilter state must be an object');
  }
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
      : normalizeFilterValue(original, definition);
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

/** @param {unknown} value @param {ServerFilterDefinition} definition @returns {unknown} */
function normalizeFilterValue(value, definition) {
  const semantic = String(definition.format ?? definition.type ?? '').toLowerCase();
  if (value instanceof Date && ['date', 'datetime', 'date-time'].includes(semantic)) {
    return dateToUnixSeconds(value);
  }
  if (Array.isArray(value) && ['date', 'datetime', 'date-time'].includes(semantic)) {
    return value.map((entry) => entry instanceof Date ? dateToUnixSeconds(entry) : entry);
  }
  return value;
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
