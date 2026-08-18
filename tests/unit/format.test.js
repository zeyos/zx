import assert from 'node:assert/strict';
import test from 'node:test';

import {
  formatCurrency, formatFileSize, formatNumber, formatPercent, formatRelativeTime
} from '../../src/core/format.js';
import { getLanguage, setLanguage } from '../../src/core/i18n.js';

/** Every assertion pins its locale so a machine's default language cannot change the output. */
const EN = 'en';

test('formatNumber groups, rounds, and honours the decimals shorthand', () => {
  assert.equal(formatNumber(1234.5, { locale: EN }), '1,234.5');
  assert.equal(formatNumber(1234.5678, { locale: EN }), '1,234.568');
  assert.equal(formatNumber(1234, { locale: EN, decimals: 2 }), '1,234.00');
  assert.equal(formatNumber(1234.5678, { locale: EN, decimals: 1 }), '1,234.6');
  assert.equal(formatNumber(1234.5, { locale: EN, minDecimals: 1, maxDecimals: 3 }), '1,234.5');
});

test('formatNumber suppresses grouping with group: false', () => {
  assert.equal(formatNumber(1234567.5, { locale: EN, group: false }), '1234567.5');
  assert.equal(formatNumber(1234567.5, { locale: EN }), '1,234,567.5');
});

test('formatNumber returns an empty string for values that are not finite numbers', () => {
  assert.equal(formatNumber(null, { locale: EN }), '');
  assert.equal(formatNumber(undefined, { locale: EN }), '');
  assert.equal(formatNumber(NaN, { locale: EN }), '');
  assert.equal(formatNumber(Infinity, { locale: EN }), '');
  assert.equal(formatNumber('', { locale: EN }), '');
  assert.equal(formatNumber('not a number', { locale: EN }), '');
});

test('formatNumber formats zero, negatives, and numeric strings', () => {
  assert.equal(formatNumber(0, { locale: EN }), '0');
  assert.equal(formatNumber(-1234.5, { locale: EN }), '-1,234.5');
  assert.equal(formatNumber('1234.5', { locale: EN }), '1,234.5');
});

test('formatCurrency renders the currency symbol for a valid ISO code', () => {
  assert.equal(formatCurrency(1234.5, 'EUR', { locale: EN }), '€1,234.50');
  assert.equal(formatCurrency(1234.5, 'USD', { locale: EN }), '$1,234.50');
  // The code is normalised, so lowercase input still resolves.
  assert.equal(formatCurrency(1234.5, 'eur', { locale: EN }), '€1,234.50');
});

test('formatCurrency falls back to plain number formatting for a missing or malformed code', () => {
  assert.equal(formatCurrency(1234.5, null, { locale: EN }), '1,234.5');
  assert.equal(formatCurrency(1234.5, undefined, { locale: EN }), '1,234.5');
  assert.equal(formatCurrency(1234.5, '', { locale: EN }), '1,234.5');
  assert.equal(formatCurrency(1234.5, 'E', { locale: EN }), '1,234.5');
  assert.equal(formatCurrency(1234.5, 'EURO', { locale: EN }), '1,234.5');
  assert.equal(formatCurrency(1234.5, 123, { locale: EN }), '1,234.5');
});

test('formatCurrency never throws on an unknown but well-shaped code', () => {
  assert.doesNotThrow(() => formatCurrency(1234.5, 'XYZ', { locale: EN }));
  assert.match(formatCurrency(1234.5, 'XYZ', { locale: EN }), /1,234\.50/);
});

test('formatCurrency applies the decimals override and rejects unusable values', () => {
  assert.equal(formatCurrency(1234.5, 'EUR', { locale: EN, decimals: 0 }), '€1,235');
  assert.equal(formatCurrency(null, 'EUR', { locale: EN }), '');
  assert.equal(formatCurrency(NaN, 'EUR', { locale: EN }), '');
  assert.equal(formatCurrency(undefined, 'EUR', { locale: EN }), '');
});

test('formatPercent scales a fraction and defaults to whole percentages', () => {
  assert.equal(formatPercent(0.42, { locale: EN }), '42%');
  assert.equal(formatPercent(1, { locale: EN }), '100%');
  assert.equal(formatPercent(0, { locale: EN }), '0%');
  assert.equal(formatPercent(-0.05, { locale: EN }), '-5%');
  assert.equal(formatPercent(0.4267, { locale: EN, decimals: 2 }), '42.67%');
  assert.equal(formatPercent(null, { locale: EN }), '');
  assert.equal(formatPercent(NaN, { locale: EN }), '');
});

test('formatFileSize uses binary units at the IEC boundaries', () => {
  assert.equal(formatFileSize(0, { locale: EN }), '0 B');
  assert.equal(formatFileSize(1, { locale: EN }), '1 B');
  assert.equal(formatFileSize(1023, { locale: EN }), '1,023 B');
  assert.equal(formatFileSize(1024, { locale: EN }), '1 KiB');
  assert.equal(formatFileSize(1048576, { locale: EN }), '1 MiB');
  assert.equal(formatFileSize(1073741824, { locale: EN }), '1 GiB');
});

test('formatFileSize uses decimal units for the SI standard', () => {
  assert.equal(formatFileSize(0, { locale: EN, standard: 'si' }), '0 B');
  assert.equal(formatFileSize(999, { locale: EN, standard: 'si' }), '999 B');
  assert.equal(formatFileSize(1000, { locale: EN, standard: 'si' }), '1 kB');
  // 1023 bytes is already past the SI kilobyte, unlike the IEC kibibyte.
  assert.equal(formatFileSize(1023, { locale: EN, standard: 'si' }), '1 kB');
  assert.equal(formatFileSize(1024, { locale: EN, standard: 'si' }), '1 kB');
  assert.equal(formatFileSize(1000000, { locale: EN, standard: 'si' }), '1 MB');
  assert.equal(formatFileSize(1048576, { locale: EN, standard: 'si' }), '1 MB');
});

test('formatFileSize drops trailing zeros and honours the decimals option', () => {
  assert.equal(formatFileSize(1536, { locale: EN }), '1.5 KiB');
  assert.equal(formatFileSize(1536, { locale: EN, decimals: 2 }), '1.5 KiB');
  assert.equal(formatFileSize(1587, { locale: EN, decimals: 2 }), '1.55 KiB');
  assert.equal(formatFileSize(1587, { locale: EN, decimals: 0 }), '2 KiB');
  // Whole bytes never gain fraction digits regardless of the option.
  assert.equal(formatFileSize(512, { locale: EN, decimals: 2 }), '512 B');
});

test('formatFileSize promotes a value that rounding pushes into the next unit', () => {
  assert.equal(formatFileSize(1048575, { locale: EN }), '1 MiB');
  assert.equal(formatFileSize(1023.6 * 1024, { locale: EN }), '1,023.6 KiB');
});

test('formatFileSize handles negatives and rejects unusable values', () => {
  assert.equal(formatFileSize(-2048, { locale: EN }), '-2 KiB');
  assert.equal(formatFileSize(null, { locale: EN }), '');
  assert.equal(formatFileSize(undefined, { locale: EN }), '');
  assert.equal(formatFileSize(NaN, { locale: EN }), '');
});

/** Pinned reference point: every relative-time expectation is computed against this instant. */
const NOW = new Date('2026-08-17T12:00:00Z');
const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

/** @param {number} offset Milliseconds relative to NOW. @returns {Date} */
function at(offset) {
  return new Date(NOW.getTime() + offset);
}

test('formatRelativeTime picks the largest sensible unit for past dates', () => {
  const relative = (offset) => formatRelativeTime(at(offset), { now: NOW, locale: EN });
  assert.equal(relative(0), 'now');
  assert.equal(relative(-30 * SECOND), '30 seconds ago');
  assert.equal(relative(-44 * SECOND), '44 seconds ago');
  assert.equal(relative(-45 * SECOND), '1 minute ago');
  assert.equal(relative(-44 * MINUTE), '44 minutes ago');
  assert.equal(relative(-45 * MINUTE), '1 hour ago');
  assert.equal(relative(-21 * HOUR), '21 hours ago');
  assert.equal(relative(-22 * HOUR), 'yesterday');
  assert.equal(relative(-2 * DAY), '2 days ago');
  assert.equal(relative(-5 * DAY), '5 days ago');
  assert.equal(relative(-6 * DAY), 'last week');
  assert.equal(relative(-3 * WEEK), '3 weeks ago');
  assert.equal(relative(-4 * WEEK), 'last month');
  assert.equal(relative(-60 * DAY), '2 months ago');
  assert.equal(relative(-330 * DAY), '11 months ago');
  assert.equal(relative(-365 * DAY), 'last year');
  assert.equal(relative(-730 * DAY), '2 years ago');
});

test('formatRelativeTime phrases future dates forwards', () => {
  const relative = (offset) => formatRelativeTime(at(offset), { now: NOW, locale: EN });
  assert.equal(relative(30 * SECOND), 'in 30 seconds');
  assert.equal(relative(5 * MINUTE), 'in 5 minutes');
  assert.equal(relative(3 * HOUR), 'in 3 hours');
  assert.equal(relative(DAY), 'tomorrow');
  assert.equal(relative(2 * DAY), 'in 2 days');
  assert.equal(relative(365 * DAY), 'next year');
});

test('formatRelativeTime numeric: always suppresses the idiomatic phrasing', () => {
  const options = { now: NOW, locale: EN, numeric: 'always' };
  assert.equal(formatRelativeTime(at(-DAY), options), '1 day ago');
  assert.equal(formatRelativeTime(at(DAY), options), 'in 1 day');
});

test('formatRelativeTime accepts Date, Unix seconds, and ISO string inputs', () => {
  const yesterday = at(-DAY);
  const options = { now: NOW, locale: EN };
  assert.equal(formatRelativeTime(yesterday, options), 'yesterday');
  assert.equal(formatRelativeTime(yesterday.getTime() / 1000, options), 'yesterday');
  assert.equal(formatRelativeTime(yesterday.toISOString(), options), 'yesterday');
  assert.equal(formatRelativeTime(String(yesterday.getTime() / 1000), options), 'yesterday');
  // The reference point accepts the same input forms.
  assert.equal(formatRelativeTime(yesterday, { now: NOW.getTime() / 1000, locale: EN }), 'yesterday');
});

test('formatRelativeTime returns an empty string for unreadable dates', () => {
  const options = { now: NOW, locale: EN };
  assert.equal(formatRelativeTime(null, options), '');
  assert.equal(formatRelativeTime(undefined, options), '');
  assert.equal(formatRelativeTime('', options), '');
  assert.equal(formatRelativeTime('not a date', options), '');
  assert.equal(formatRelativeTime(new Date('nope'), options), '');
  assert.equal(formatRelativeTime(at(-DAY), { now: 'not a date', locale: EN }), '');
});

test('every formatter follows setLanguage when no locale is passed', () => {
  const previous = getLanguage();
  try {
    setLanguage('de');
    assert.equal(formatNumber(1234.5), '1.234,5');
    // German separates value from unit with a non-breaking space, spelled out as an escape so
    // the expectation cannot be silently 'corrected' to a plain space by an editor.
    assert.equal(formatCurrency(1234.5, 'EUR'), '1.234,50\u00a0€');
    assert.equal(formatPercent(0.42), '42\u00a0%');
    assert.equal(formatRelativeTime(at(-DAY), { now: NOW }), 'gestern');

    setLanguage('en');
    assert.equal(formatNumber(1234.5), '1,234.5');
    assert.equal(formatRelativeTime(at(-DAY), { now: NOW }), 'yesterday');
  } finally {
    setLanguage(previous);
  }
});

test('formatters survive an unusable locale instead of throwing', () => {
  assert.doesNotThrow(() => formatNumber(1234.5, { locale: 'not a locale' }));
  assert.doesNotThrow(() => formatRelativeTime(at(-DAY), { now: NOW, locale: 'not a locale' }));
  assert.match(formatNumber(1234.5, { locale: 'not a locale' }), /1/);
});
