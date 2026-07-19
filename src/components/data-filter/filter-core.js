/** @typedef {Record<string, any>} FilterRow */
/** @typedef {Record<string, unknown>} FilterState */

/**
 * Normalizes searchable text for case- and diacritic-insensitive matching.
 * @param {unknown} value Value to normalize.
 * @returns {string} Normalized text.
 */
export function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase();
}

/**
 * Tests a text corpus with whitespace-delimited, multi-word AND semantics.
 * @param {unknown[]} values Searchable field values.
 * @param {unknown} query Query value.
 * @returns {boolean} Whether every query term occurs in the combined fields.
 */
export function matchesText(values, query) {
  // TODO(unify): share this tiny matcher with WP4's select filter once both branches merge.
  const terms = normalizeText(query).trim().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;
  const corpus = normalizeText(values.flat(Infinity).join(' '));
  return terms.every((term) => corpus.includes(term));
}

/**
 * Returns whether a filter state value represents an active filter.
 * @param {unknown} value Filter value.
 * @returns {boolean} Whether the value is active.
 */
export function isActiveFilterValue(value) {
  return value != null && !(typeof value === 'string' && value.trim() === '');
}

/**
 * Resolves all values addressed by a select or text filter definition.
 * @param {FilterRow} row Source row.
 * @param {Record<string, any>} definition Filter definition.
 * @returns {unknown[]} Resolved values.
 */
export function getFilterValues(row, definition) {
  if (typeof definition.get === 'function') return flattenValue(definition.get(row));
  const fields = definition.fields ?? definition.field ?? definition.id;
  const keys = Array.isArray(fields) ? fields : [fields];
  return keys.flatMap((field) => {
    if (typeof field === 'function') return flattenValue(field(row));
    return flattenValue(field == null ? undefined : row?.[field]);
  });
}

/**
 * Derives distinct native-select options in first-seen order.
 * Values shaped as `{value, label}` (or legacy `{field, label}`) retain their display label.
 * @param {FilterRow[]} rows Source rows.
 * @param {Record<string, any>} definition Select filter definition.
 * @returns {Array<{value: unknown, label: string}>} Distinct options.
 */
export function deriveSelectOptions(rows, definition) {
  const options = [];
  const seen = new Map();
  for (const row of rows) {
    for (const candidate of getFilterValues(row, definition)) {
      const normalized = normalizeOption(candidate);
      if (normalized.value == null || normalized.value === '' || seen.has(normalized.value)) continue;
      seen.set(normalized.value, true);
      options.push(normalized);
    }
  }
  return options;
}

/** Alias for the distinct-option derivation used by DataFilter. */
export const deriveOptions = deriveSelectOptions;

/**
 * Applies all active filter definitions to an array without mutating it.
 * Filters combine with AND; multiple fields inside one select filter combine with OR.
 * @param {FilterRow[]} rows Source rows.
 * @param {Array<Record<string, any>>} filterDefs Filter definitions.
 * @param {FilterState} state Values keyed by filter id.
 * @returns {FilterRow[]} Filtered copy.
 */
export function applyFilters(rows, filterDefs, state) {
  return rows.filter((row) => filterDefs.every((definition) => {
    const value = state?.[definition.id];
    if (!isActiveFilterValue(value)) return true;

    if (definition.type === 'custom') {
      return typeof definition.predicate !== 'function' || Boolean(definition.predicate(row, value));
    }

    const values = getFilterValues(row, definition);
    if (definition.type === 'text') return matchesText(values, value);
    if (definition.type === 'select') {
      return values.some((candidate) => sameValue(normalizeOption(candidate).value, value));
    }
    return true;
  }));
}

/** @param {unknown} value @returns {unknown[]} */
function flattenValue(value) {
  return Array.isArray(value) ? value.flat(Infinity) : [value];
}

/** @param {unknown} candidate @returns {{value: unknown, label: string}} */
function normalizeOption(candidate) {
  if (candidate && typeof candidate === 'object' && !(candidate instanceof Date)) {
    if (Object.prototype.hasOwnProperty.call(candidate, 'value')) {
      return { value: candidate.value, label: String(candidate.label ?? candidate.value ?? '') };
    }
    if (Object.prototype.hasOwnProperty.call(candidate, 'field')) {
      return { value: candidate.field, label: String(candidate.label ?? candidate.field ?? '') };
    }
  }
  return { value: candidate, label: String(candidate ?? '') };
}

/** @param {unknown} left @param {unknown} right @returns {boolean} */
function sameValue(left, right) {
  if (Object.is(left, right)) return true;
  if (left == null || right == null) return false;
  return String(left) === String(right);
}
