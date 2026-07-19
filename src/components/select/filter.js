/**
 * Returns items whose searchable values contain every query word.
 * Matching is case- and diacritic-insensitive.
 *
 * @template T
 * @param {T[]} items Items to search.
 * @param {string} query User-entered search text.
 * @param {Array<string|((item: T) => unknown)>} keys Searchable object keys or value readers.
 * @returns {T[]} Matching items in their original order.
 */
export function matchItems(items, query, keys) {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return items.slice();

  return items.filter((item) => {
    const values = searchableValues(item, keys).map(normalize);
    return words.every((word) => values.some((value) => value.includes(word)));
  });
}

/**
 * @template T
 * @param {T} item
 * @param {Array<string|((item: T) => unknown)>} keys
 * @returns {unknown[]}
 */
function searchableValues(item, keys) {
  if (item === null || typeof item !== 'object') return [item];
  if (!Array.isArray(keys) || keys.length === 0) return [item];
  return keys.map((key) => typeof key === 'function' ? key(item) : item[key]);
}

/** @param {unknown} value @returns {string} */
function normalize(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLocaleLowerCase();
}
