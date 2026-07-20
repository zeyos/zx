import { parse } from '../globals.js';

/** Legacy utility namespace backed by dependency-free implementations. */
export const util = Object.freeze({
  initValue,
  initNum,
  formatTime,
  getMinutes,
  formatNum,
  getNumber,
  printf,
  parseResult,
  Parse: parse,
  isArray: Array.isArray,
  isObject: (value) => value !== null && typeof value === 'object' && !Array.isArray(value) &&
    !(typeof Node !== 'undefined' && value instanceof Node) && !(value instanceof Date),
  isFunction: (value) => typeof value === 'function',
  isString: (value) => typeof value === 'string',
  isNumber: (value) => typeof value === 'number' && Number.isFinite(value),
  isElement: (value) => typeof Element !== 'undefined' && value instanceof Element,
  isNode: (value) => typeof Node !== 'undefined' && value instanceof Node,
  Console: (source, message) => {
    if (typeof console === 'undefined') return;
    if (message instanceof Error) console.error(source, message.stack);
    else console.log(`${source}: ${message}`);
  }
});

/** @param {Record<string, unknown>} object @param {string} key @param {unknown} fallback @returns {unknown} */
export function initValue(object, key, fallback) {
  return object?.[key] == null ? fallback : object[key];
}

/** @param {unknown} value @returns {number} */
export function initNum(value) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number.parseFloat(value);
  return 0;
}

/** @param {unknown} value @returns {string} */
export function formatTime(value) {
  let minutes = value;
  if (typeof minutes === 'string') {
    if (/^[0-9]+:[0-9]{2}$/.test(minutes)) return minutes;
    if (/^[0-9]+:[0-9]{2,}$/.test(minutes)) {
      const digits = minutes.replace(/[^0-9]/g, '');
      return digits.replace(/([0-9]{2})$/, ':$1');
    }
    minutes = Number.parseInt(minutes.replace(/[^0-9]/g, ''), 10);
  }
  if (minutes == null || Number.isNaN(Number(minutes))) return '0:00';
  let number = Number(minutes);
  const prefix = number < 0 ? '-' : '';
  number = Math.abs(number);
  return `${prefix}${Math.floor(number / 60)}:${pad(number % 60)}`;
}

/** @param {unknown} value @returns {number} */
export function getMinutes(value) {
  const parts = String(value ?? '').replace(/[^0-9:]/, '').split(':');
  if (parts.length === 1) return Number.parseInt(parts[0], 10);
  return Number.parseInt(parts[0], 10) * 60 + Number.parseInt(parts[1], 10);
}

/** @param {unknown} value @param {string} [decimal='.'] @param {string} [thousands=','] @param {number} [decimals=2] @returns {string} */
export function formatNum(value, decimal = '.', thousands = ',', decimals = 2) {
  let number = value;
  if (typeof number === 'string') {
    number = Number.parseFloat(number.replace(new RegExp(`[^0-9${escapeRegExp(decimal)}]`), '').replace(decimal, '.'));
  }
  if (Number.isNaN(Number(number))) number = 0;
  const precision = typeof decimals === 'number' ? decimals : 2;
  let formatted = Math.round(Number(number) * (10 ** precision)).toString();
  for (let index = formatted.length; index <= precision; index += 1) formatted = `0${formatted}`;
  const position = formatted.length - precision;
  if (precision > 0) formatted = `${formatted.slice(0, position)}${decimal}${formatted.slice(position)}`;
  for (let index = position - 3; index > 0; index -= 3) {
    formatted = `${formatted.slice(0, index)}${thousands}${formatted.slice(index)}`;
  }
  return formatted;
}

/** @param {unknown} value @param {string} [decimal=','] @returns {number} */
export function getNumber(value, decimal = '.') {
  return Number.parseFloat(String(value ?? '').replace(new RegExp(`[^0-9${escapeRegExp(decimal)}]`), '').replace(decimal, '.'));
}

/** @param {unknown} template @param {unknown|unknown[]} [values=[]] @returns {string} */
export function printf(template, values = []) {
  const replacements = Array.isArray(values) ? values : [values];
  let index = 0;
  return String(template ?? '').replace(/%arg%/g, (match) => index < replacements.length ? String(replacements[index++]) : match);
}

/** @param {unknown} response @returns {unknown} */
export function parseResult(response) {
  const data = typeof response === 'string' ? JSON.parse(response) : response;
  if (!data || typeof data !== 'object') throw new Error('Invalid server response');
  if (data.error) throw new Error(String(data.error.message ?? data.error));
  if (!Object.hasOwn(data, 'result') || data.result == null) throw new Error('Undefined result');
  return data.result;
}

/** @param {number} value @returns {string} */
function pad(value) {
  return String(value).padStart(2, '0');
}

/** @param {string} value @returns {string} */
function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
