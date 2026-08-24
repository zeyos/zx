/**
 * Normalizes documentation search text without relying on the DOM. CamelCase symbols become
 * words, accents are folded, and punctuation is treated as a separator.
 * @param {unknown} value Searchable value.
 * @returns {string}
 */
export function normalizeDocsSearchText(value) {
  return String(value ?? '')
    .replace(/([\p{Ll}\p{N}])([\p{Lu}])/gu, '$1 $2')
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Ranks documentation destinations. Every query term must match; stronger label and symbol
 * matches sort ahead of aliases and prose, with source order as the final stable tie-breaker.
 * @param {Array<Record<string, any>>} records Search index records.
 * @param {unknown} query Query text.
 * @param {number} [limit=10] Maximum results.
 * @returns {Array<Record<string, any>>}
 */
export function rankDocsSearch(records, query, limit = 10) {
  if (!Array.isArray(records)) throw new TypeError('Documentation search records must be an array');
  const needle = normalizeDocsSearchText(query);
  if (!needle) return [];
  const terms = [...new Set(needle.split(' '))];
  const maximum = Math.max(0, Math.trunc(Number(limit) || 0));
  if (maximum === 0) return [];

  return records.map((record, order) => {
    const label = normalizeDocsSearchText(record.label);
    const aliases = normalizeDocsSearchText(
      Array.isArray(record.aliases) ? record.aliases.join(' ') : record.aliases);
    const prose = normalizeDocsSearchText([
      record.parent, record.category, record.description, record.keywords
    ].join(' '));
    const all = `${label} ${aliases} ${prose}`.trim();
    if (!terms.every((term) => all.includes(term))) return null;

    const words = label.split(' ');
    let score = 50;
    if (label === needle) score = 0;
    else if (label.startsWith(needle)) score = 10;
    else if (terms.every((term) => words.some((word) => word.startsWith(term)))) score = 20;
    else if (terms.every((term) => label.includes(term))) score = 30;
    else if (terms.every((term) => aliases.includes(term))) score = 40;
    return { record, order, score };
  }).filter(Boolean).sort((a, b) => a.score - b.score
    || compareText(a.record.label, b.record.label)
    || a.order - b.order).slice(0, maximum).map(({ record }) => record);
}

/** Locale-independent ordering keeps test and production results identical. */
function compareText(left, right) {
  const a = normalizeDocsSearchText(left);
  const b = normalizeDocsSearchText(right);
  return a < b ? -1 : a > b ? 1 : 0;
}
