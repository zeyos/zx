import { getLanguage } from './i18n.js';

/**
 * @typedef {Object} NumberFormatOptions
 * @property {string} [locale=getLanguage()] BCP 47 language tag; defaults to the active language.
 * @property {number} [decimals] Shorthand setting both the minimum and maximum fraction digits.
 * @property {number} [minDecimals] Minimum fraction digits.
 * @property {number} [maxDecimals] Maximum fraction digits.
 * @property {boolean} [group=true] Whether to insert the locale's grouping separators.
 */

/**
 * @typedef {Object} CurrencyFormatOptions
 * @property {string} [locale=getLanguage()] BCP 47 language tag.
 * @property {number} [decimals] Fraction digits; defaults to the currency's own minor-unit count.
 */

/**
 * @typedef {Object} PercentFormatOptions
 * @property {string} [locale=getLanguage()] BCP 47 language tag.
 * @property {number} [decimals=0] Fraction digits.
 */

/**
 * @typedef {Object} FileSizeFormatOptions
 * @property {string} [locale=getLanguage()] BCP 47 language tag.
 * @property {number} [decimals=1] Maximum fraction digits; trailing zeros are dropped.
 * @property {'iec'|'si'} [standard='iec'] Binary KiB/MiB/GiB or decimal kB/MB/GB units.
 */

/**
 * @typedef {Object} RelativeTimeFormatOptions
 * @property {Date|number|string} [now=new Date()] Reference point the date is measured against.
 * @property {string} [locale=getLanguage()] BCP 47 language tag.
 * @property {'auto'|'always'} [numeric='auto'] `auto` produces "yesterday", `always` "1 day ago".
 */

/** Fraction-digit bounds accepted by `Intl.NumberFormat`. */
const MIN_DIGITS = 0;
const MAX_DIGITS = 20;
/** `Intl.NumberFormat`'s own default maximum for plain decimal formatting. */
const DEFAULT_MAX_DIGITS = 3;

const IEC_UNITS = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB'];
const SI_UNITS = ['B', 'kB', 'MB', 'GB', 'TB', 'PB', 'EB'];

/**
 * Largest-first units with their length in milliseconds and the threshold below which the unit is
 * still the sensible choice: 45 s, 45 min, 22 h, 6 d, 4 w, 11 months.
 */
const TIME_DIVISIONS = [
  { unit: 'second', ms: 1000, limit: 45 },
  { unit: 'minute', ms: 60000, limit: 45 },
  { unit: 'hour', ms: 3600000, limit: 22 },
  { unit: 'day', ms: 86400000, limit: 6 },
  { unit: 'week', ms: 604800000, limit: 4 },
  { unit: 'month', ms: 2629800000, limit: 11 },
  { unit: 'year', ms: 31557600000, limit: Infinity }
];

/**
 * Intl formatters are expensive to construct and tables call these helpers once per cell, so every
 * instance is cached under its locale and options.
 * @type {Map<string, Intl.NumberFormat>}
 */
const numberFormatters = new Map();
/** @type {Map<string, Intl.RelativeTimeFormat>} */
const relativeFormatters = new Map();

/**
 * Formats a number for the active language.
 * @param {number|string|null|undefined} value Value to format.
 * @param {NumberFormatOptions} [options={}] Formatting options.
 * @returns {string} Formatted number, or an empty string for null, undefined, and NaN.
 */
export function formatNumber(value, options = {}) {
  const number = toFiniteNumber(value);
  if (number === null) return '';
  const { locale = getLanguage(), decimals, minDecimals, maxDecimals, group = true } = options;
  return format(locale, digitOptions({ decimals, minDecimals, maxDecimals, group }), number);
}

/**
 * Formats a monetary amount, falling back to plain number formatting when the currency code is
 * missing or not shaped like an ISO 4217 code.
 * @param {number|string|null|undefined} value Amount to format.
 * @param {string|null|undefined} currency Three-letter ISO 4217 code such as `EUR`.
 * @param {CurrencyFormatOptions} [options={}] Formatting options.
 * @returns {string} Formatted amount, or an empty string for null, undefined, and NaN.
 */
export function formatCurrency(value, currency, options = {}) {
  const number = toFiniteNumber(value);
  if (number === null) return '';
  const { locale = getLanguage(), decimals } = options;
  const code = currencyCode(currency);
  if (code === null) return formatNumber(number, { locale, decimals });

  const digits = digitOptions({ decimals, group: true });
  return format(locale, { ...digits, style: 'currency', currency: code }, number);
}

/**
 * Formats a fraction as a percentage: `0.42` becomes `42%`.
 * @param {number|string|null|undefined} value Fraction to format.
 * @param {PercentFormatOptions} [options={}] Formatting options.
 * @returns {string} Formatted percentage, or an empty string for null, undefined, and NaN.
 */
export function formatPercent(value, options = {}) {
  const number = toFiniteNumber(value);
  if (number === null) return '';
  const { locale = getLanguage(), decimals = 0 } = options;
  return format(locale, { ...digitOptions({ decimals, group: true }), style: 'percent' }, number);
}

/**
 * Formats a byte count with binary (KiB) or decimal (kB) units.
 * @param {number|string|null|undefined} bytes Byte count.
 * @param {FileSizeFormatOptions} [options={}] Formatting options.
 * @returns {string} Formatted size, `'0 B'` for zero, or an empty string for null and NaN.
 */
export function formatFileSize(bytes, options = {}) {
  const number = toFiniteNumber(bytes);
  if (number === null) return '';
  const { locale = getLanguage(), decimals = 1, standard = 'iec' } = options;
  if (number === 0) return `${formatNumber(0, { locale, decimals: 0 })} B`;

  const units = standard === 'si' ? SI_UNITS : IEC_UNITS;
  const base = standard === 'si' ? 1000 : 1024;
  const absolute = Math.abs(number);
  let exponent = Math.min(units.length - 1, Math.max(0, Math.floor(Math.log(absolute) / Math.log(base))));
  let scaled = absolute / base ** exponent;
  // Rounding can push a value up into the next unit (1023.9 KiB at one decimal is 1024.0 KiB).
  // Whole bytes never get fraction digits, so the check runs against the digits actually used.
  if (roundTo(scaled, exponent === 0 ? 0 : decimals) >= base && exponent < units.length - 1) {
    exponent += 1;
    scaled = absolute / base ** exponent;
  }

  const signed = number < 0 ? -scaled : scaled;
  const digits = exponent === 0 ? 0 : decimals;
  const text = formatNumber(signed, { locale, minDecimals: 0, maxDecimals: digits });
  return `${text} ${units[exponent]}`;
}

/**
 * Formats a date relative to a reference point, picking the largest sensible unit.
 * @param {Date|number|string|null|undefined} date Date, Unix timestamp in seconds, or ISO string.
 * @param {RelativeTimeFormatOptions} [options={}] Formatting options.
 * @returns {string} Formatted phrase, or an empty string when the date cannot be read.
 */
export function formatRelativeTime(date, options = {}) {
  const target = toDate(date);
  if (target === null) return '';
  const { now = new Date(), locale = getLanguage(), numeric = 'auto' } = options;
  const reference = toDate(now);
  if (reference === null) return '';

  const diff = target.getTime() - reference.getTime();
  const division = TIME_DIVISIONS.find(({ ms, limit }) => Math.abs(diff) / ms < limit)
    ?? TIME_DIVISIONS[TIME_DIVISIONS.length - 1];
  const value = Math.round(diff / division.ms);
  return relativeFormatter(locale, numeric).format(value, division.unit);
}

/**
 * Returns a cached `Intl.NumberFormat`, falling back to the runtime default for unusable locales.
 * @param {string} locale BCP 47 language tag.
 * @param {Intl.NumberFormatOptions} options Formatter options.
 * @param {number} value Number to format.
 * @returns {string}
 */
function format(locale, options, value) {
  const key = `${locale}\u0000${JSON.stringify(options)}`;
  let formatter = numberFormatters.get(key);
  if (formatter === undefined) {
    formatter = createNumberFormat(locale, options);
    numberFormatters.set(key, formatter);
  }
  return formatter.format(value);
}

/**
 * @param {string} locale BCP 47 language tag.
 * @param {Intl.NumberFormatOptions} options Formatter options.
 * @returns {Intl.NumberFormat}
 */
function createNumberFormat(locale, options) {
  try {
    return new Intl.NumberFormat(locale, options);
  } catch {
    try {
      return new Intl.NumberFormat(undefined, options);
    } catch {
      // Unusable options (an unsupported currency style, say) still have to produce digits.
      return new Intl.NumberFormat();
    }
  }
}

/**
 * @param {string} locale BCP 47 language tag.
 * @param {'auto'|'always'} numeric Numeric-phrasing mode.
 * @returns {Intl.RelativeTimeFormat}
 */
function relativeFormatter(locale, numeric) {
  const key = `${locale}\u0000${numeric}`;
  let formatter = relativeFormatters.get(key);
  if (formatter === undefined) {
    try {
      formatter = new Intl.RelativeTimeFormat(locale, { numeric });
    } catch {
      formatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
    }
    relativeFormatters.set(key, formatter);
  }
  return formatter;
}

/**
 * Turns the decimals shorthand and its explicit siblings into `Intl.NumberFormat` digit options.
 * @param {{decimals?: number, minDecimals?: number, maxDecimals?: number, group?: boolean}} options
 * @returns {Intl.NumberFormatOptions}
 */
function digitOptions({ decimals, minDecimals, maxDecimals, group = true }) {
  /** @type {Intl.NumberFormatOptions} */
  const result = { useGrouping: group !== false };
  const min = digitCount(minDecimals ?? decimals);
  const max = digitCount(maxDecimals ?? decimals);

  if (min !== null) result.minimumFractionDigits = min;
  if (max !== null) {
    result.maximumFractionDigits = max;
    // Intl throws when the minimum exceeds the maximum, so the pair is reconciled here instead.
    if (min !== null && min > max) result.minimumFractionDigits = max;
  } else if (min !== null) {
    result.maximumFractionDigits = Math.max(min, DEFAULT_MAX_DIGITS);
  }
  return result;
}

/** @param {unknown} value @returns {number|null} */
function digitCount(value) {
  if (value == null) return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Math.min(MAX_DIGITS, Math.max(MIN_DIGITS, Math.round(number)));
}

/** @param {unknown} value @returns {number|null} */
function toFiniteNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

/** @param {unknown} value @returns {string|null} */
function currencyCode(value) {
  if (typeof value !== 'string') return null;
  const code = value.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(code) ? code : null;
}

/** @param {Date|number|string|null|undefined} value @returns {Date|null} */
function toDate(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'number') return Number.isFinite(value) ? new Date(value * 1000) : null;
  if (typeof value === 'string') {
    const text = value.trim();
    if (text === '') return null;
    // Unix seconds arrive as strings from ZeyOS kernel payloads often enough to accept them here.
    const parsed = /^-?\d+$/.test(text) ? new Date(Number(text) * 1000) : new Date(text);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

/** @param {number} value @param {number} digits @returns {number} */
function roundTo(value, digits) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
