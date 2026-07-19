import assert from 'node:assert/strict';
import test from 'node:test';

import {
  addDays, addMonths, clampDate, formatDate, getWeekStart, isSameDay, parseDate
} from '../../src/core/date.js';
import { setTranslator } from '../../src/core/i18n.js';

const ROUND_TRIPS = [
  [new Date(2026, 6, 19, 14, 35, 42), '%d.%m.%Y %H:%M'],
  [new Date(2024, 1, 29, 0, 0, 0), '%Y-%m-%d'],
  [new Date(1987, 10, 5, 0, 0, 0), '%d/%m/%y'],
  [new Date(2025, 0, 1, 23, 59, 58), '%Y%m%d-%H%M%S'],
  [new Date(2031, 8, 7, 6, 5, 4), '%H:%M:%S'],
  [new Date(2023, 3, 22, 10, 11, 12), '%s'],
  [new Date(2000, 0, 2, 3, 4, 5), '%m-%d %H:%M']
];

for (const [date, format] of ROUND_TRIPS) {
  test(`formatDate/parseDate round trip ${format}`, () => {
    const formatted = formatDate(date, format);
    const parsed = parseDate(formatted, format);
    assert.ok(parsed instanceof Date);
    assert.equal(formatDate(parsed, format), formatted);
  });
}

test('parseDate rejects mismatches and calendar overflow', () => {
  assert.equal(parseDate('31.02.2026', '%d.%m.%Y'), null);
  assert.equal(parseDate('2026/07/19', '%Y-%m-%d'), null);
});

test('date arithmetic does not mutate inputs and clamps month ends', () => {
  const januaryEnd = new Date(2024, 0, 31, 12, 30);
  const februaryEnd = addMonths(januaryEnd, 1);
  assert.equal(formatDate(februaryEnd, '%Y-%m-%d %H:%M'), '2024-02-29 12:30');
  assert.equal(formatDate(januaryEnd, '%Y-%m-%d'), '2024-01-31');
  assert.equal(formatDate(addDays(januaryEnd, 2), '%Y-%m-%d'), '2024-02-02');
});

test('clampDate and isSameDay compare dates', () => {
  const min = new Date(2024, 0, 10);
  const max = new Date(2024, 0, 20);
  assert.equal(clampDate(new Date(2024, 0, 1), min, max).getTime(), min.getTime());
  assert.equal(clampDate(new Date(2024, 0, 30), min, max).getTime(), max.getTime());
  assert.equal(isSameDay(new Date(2024, 0, 20, 1), new Date(2024, 0, 20, 23)), true);
});

test('getWeekStart defaults to Monday', () => {
  assert.equal(getWeekStart(), 1);
});

test('formatDate localizes month and weekday names with English fallbacks', () => {
  const sunday = new Date(2024, 0, 7);
  assert.equal(formatDate(sunday, '%A %B (%a %b)'), 'Sunday January (Sun Jan)');
  setTranslator((key) => ({
    'date.weekday.0': 'Sonntag',
    'date.month.0': 'Januar'
  })[key] ?? key);
  assert.equal(formatDate(sunday, '%A %B'), 'Sonntag Januar');
  setTranslator(null);
});
