// @ts-check
import { getLanguage, translate } from './i18n.js';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const ENGLISH_NAMES = { month: MONTHS, weekday: WEEKDAYS };
const TOKEN_PATTERN = /%[demYyHMSaAbBs]/g;

/**
 * `Intl` formatters for month and weekday names, under their locale and style, because a calendar
 * formats dozens of cells per render. A locale `Intl` cannot use is cached as null.
 * @type {Map<string, Intl.DateTimeFormat|null>}
 */
const nameFormatters = new Map();

/**
 * Formats a local Date using strftime-style kernel tokens.
 *
 * Month and weekday names come from the host translator's `date.month.*` and `date.weekday.*` keys
 * when it has them, and otherwise from `Intl` in `locale`. An English tag, or one `Intl` cannot
 * use, writes the English names.
 * @param {Date} date Date to format.
 * @param {string} fmt Format containing `%d %e %m %Y %y %H %M %S %a %A %b %B %s` tokens.
 * @param {{locale?: string}} [options={}] `locale` defaults to `getLanguage()`.
 * @returns {string}
 */
export function formatDate(date, fmt, { locale = getLanguage() } = {}) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  return String(fmt).replace(TOKEN_PATTERN, (token) => {
    switch (token) {
      case '%d': return pad(date.getDate());
      case '%e': return String(date.getDate());
      case '%m': return pad(date.getMonth() + 1);
      case '%Y': return String(date.getFullYear()).padStart(4, '0');
      case '%y': return pad(date.getFullYear() % 100);
      case '%H': return pad(date.getHours());
      case '%M': return pad(date.getMinutes());
      case '%S': return pad(date.getSeconds());
      case '%a': return localizedShortName('weekday', date, locale);
      case '%A': return localizedName('weekday', date, locale);
      case '%b': return localizedShortName('month', date, locale);
      case '%B': return localizedName('month', date, locale);
      case '%s': return String(Math.floor(date.getTime() / 1000));
      default: return token;
    }
  });
}

/**
 * Parses numeric date tokens from a string, returning null for mismatches or invalid dates.
 * Unspecified fields default to 1970-01-01 00:00:00 local time.
 * @param {string} str Date text.
 * @param {string} fmt Matching numeric format.
 * @returns {Date|null}
 */
export function parseDate(str, fmt) {
  const fields = [];
  let pattern = '^';
  let cursor = 0;

  for (const match of String(fmt).matchAll(TOKEN_PATTERN)) {
    pattern += escapeRegExp(String(fmt).slice(cursor, match.index));
    const token = match[0];
    const tokenPattern = numericPattern(token);
    if (tokenPattern === null) return null;
    pattern += `(${tokenPattern})`;
    fields.push(token);
    cursor = match.index + token.length;
  }
  pattern += escapeRegExp(String(fmt).slice(cursor)) + '$';

  const matched = new RegExp(pattern).exec(String(str));
  if (!matched) return null;
  const values = Object.create(null);
  fields.forEach((field, index) => {
    values[field] = Number(matched[index + 1]);
  });

  if (values['%s'] !== undefined) {
    const timestamp = values['%s'] * 1000;
    const parsed = new Date(timestamp);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const year = values['%Y'] ?? yearFromTwoDigits(values['%y']) ?? 1970;
  const month = (values['%m'] ?? 1) - 1;
  const day = values['%d'] ?? values['%e'] ?? 1;
  const hour = values['%H'] ?? 0;
  const minute = values['%M'] ?? 0;
  const second = values['%S'] ?? 0;
  const parsed = new Date(0);
  parsed.setHours(0, 0, 0, 0);
  parsed.setFullYear(year, month, day);
  parsed.setHours(hour, minute, second, 0);

  if (Number.isNaN(parsed.getTime())) return null;
  if (values['%Y'] !== undefined && parsed.getFullYear() !== values['%Y']) return null;
  if (values['%y'] !== undefined && parsed.getFullYear() % 100 !== values['%y']) return null;
  if (values['%m'] !== undefined && parsed.getMonth() !== month) return null;
  if (values['%d'] !== undefined && parsed.getDate() !== day) return null;
  if (values['%e'] !== undefined && parsed.getDate() !== day) return null;
  if (values['%H'] !== undefined && parsed.getHours() !== hour) return null;
  if (values['%M'] !== undefined && parsed.getMinutes() !== minute) return null;
  if (values['%S'] !== undefined && parsed.getSeconds() !== second) return null;
  return parsed;
}

/**
 * Clamps a date to optional inclusive bounds and returns a new Date.
 * @param {Date} date Date to clamp.
 * @param {Date|null|undefined} min Minimum date.
 * @param {Date|null|undefined} max Maximum date.
 * @returns {Date}
 */
export function clampDate(date, min, max) {
  const value = date.getTime();
  const minimum = min instanceof Date ? min.getTime() : -Infinity;
  const maximum = max instanceof Date ? max.getTime() : Infinity;
  return new Date(Math.min(maximum, Math.max(minimum, value)));
}

/**
 * Reports whether two dates share the same local calendar day.
 * @param {Date} a First date.
 * @param {Date} b Second date.
 * @returns {boolean}
 */
export function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

/**
 * Adds local calendar days without mutating the input.
 * @param {Date} date Base date.
 * @param {number} n Number of days.
 * @returns {Date}
 */
export function addDays(date, n) {
  const result = new Date(date.getTime());
  result.setDate(result.getDate() + n);
  return result;
}

/**
 * Adds local calendar months without mutating the input, clamping to the target month's end.
 * @param {Date} date Base date.
 * @param {number} n Number of months.
 * @returns {Date}
 */
export function addMonths(date, n) {
  const result = new Date(date.getTime());
  const day = result.getDate();
  result.setDate(1);
  result.setMonth(result.getMonth() + n);
  const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(day, lastDay));
  return result;
}

/**
 * Returns the locale's first weekday (`0` Sunday through `6` Saturday), Monday by default.
 * @param {string} [lang=getLanguage()] BCP 47 language tag.
 * @returns {number}
 */
export function getWeekStart(lang = getLanguage()) {
  if (!lang) return 1;
  if (lang.toLowerCase() === 'en') return 1;
  try {
    /** `getWeekInfo()` and `weekInfo` are newer Intl surface than the bundled lib types know. */
    const locale = /** @type {Intl.Locale & {getWeekInfo?: () => {firstDay?: number}, weekInfo?: {firstDay?: number}}} */
      (new Intl.Locale(lang));
    const weekInfo = locale.getWeekInfo?.() ?? locale.weekInfo;
    if (weekInfo?.firstDay) return weekInfo.firstDay % 7;
  } catch {
    // Invalid or unsupported locale data uses the APG-friendly Monday default.
  }
  return 1;
}

/** @param {number} value @returns {string} */
function pad(value) {
  return String(value).padStart(2, '0');
}

/** @param {'month'|'weekday'} type @param {Date} date @returns {number} */
function nameIndex(type, date) {
  return type === 'month' ? date.getMonth() : date.getDay();
}

/** @param {'month'|'weekday'} type @param {Date} date @param {string} locale @returns {string} */
function localizedName(type, date, locale) {
  const index = nameIndex(type, date);
  const key = `date.${type}.${index}`;
  const value = translate(key);
  if (value !== key) return value;
  return nameFormatter(type, 'long', locale)?.format(date) ?? ENGLISH_NAMES[type][index];
}

/** @param {'month'|'weekday'} type @param {Date} date @param {string} locale @returns {string} */
function localizedShortName(type, date, locale) {
  const index = nameIndex(type, date);
  const shortKey = `date.${type}.short.${index}`;
  const shortValue = translate(shortKey);
  if (shortValue !== shortKey) return shortValue;
  // A translator that answers the long key only keeps deriving the short name from it.
  const key = `date.${type}.${index}`;
  const value = translate(key);
  if (value !== key) return value.slice(0, 3);
  return nameFormatter(type, 'short', locale)?.format(date) ?? ENGLISH_NAMES[type][index].slice(0, 3);
}

/**
 * The cached `Intl` formatter for one kind of name, or null when the English constants answer.
 * English tags never reach `Intl`, whose `en-GB` writes `Sept` where these names write `Sep`, and
 * the calendar is fixed because `%d`, `%m` and `%Y` are Gregorian in every locale.
 * @param {'month'|'weekday'} type Kind of name.
 * @param {'long'|'short'} style Length of the name.
 * @param {string} locale BCP 47 language tag.
 * @returns {Intl.DateTimeFormat|null}
 */
function nameFormatter(type, style, locale) {
  if (/^en(?:-|$)/i.test(locale)) return null;
  const key = `${locale}\u0000${type}\u0000${style}`;
  let formatter = nameFormatters.get(key);
  if (formatter === undefined) {
    try {
      formatter = new Intl.DateTimeFormat(locale, { [type]: style, calendar: 'gregory' });
    } catch {
      formatter = null;
    }
    nameFormatters.set(key, formatter);
  }
  return formatter;
}

/** @param {string} token @returns {string|null} */
function numericPattern(token) {
  return {
    '%d': '\\d{1,2}',
    '%e': '\\d{1,2}',
    '%m': '\\d{1,2}',
    '%Y': '\\d{4}',
    '%y': '\\d{2}',
    '%H': '\\d{1,2}',
    '%M': '\\d{1,2}',
    '%S': '\\d{1,2}',
    '%s': '-?\\d+'
  }[token] ?? null;
}

/** @param {number|undefined} year @returns {number|undefined} */
function yearFromTwoDigits(year) {
  if (year === undefined) return undefined;
  return year >= 69 ? 1900 + year : 2000 + year;
}

/** @param {string} value @returns {string} */
function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
