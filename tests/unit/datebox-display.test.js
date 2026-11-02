import assert from 'node:assert/strict';
import test from 'node:test';

import { formatDate, parseDate } from '../../src/core/date.js';
import { dateboxFormats } from '../../src/components/datebox/datebox.js';
import { formatRangeText, parseRangeText } from '../../src/components/datebox/date-range-box.js';

/*
 * A date field has two formats: `format`, which the reader types and the field shows while it has
 * focus, and `displayFormat`, which it shows at rest. The browser suite drives the focus swap; these
 * hold the rules that decide the two formats and the text each one produces.
 */

test('without a display format the field shows what the reader types', () => {
  assert.deepEqual(dateboxFormats(), { format: '%d.%m.%Y', display: '%d.%m.%Y' });
  assert.deepEqual(dateboxFormats({ format: '%m/%d/%Y' }), { format: '%m/%d/%Y', display: '%m/%d/%Y' });
  assert.deepEqual(dateboxFormats({ format: '%Y-%m-%d', displayFormat: null }),
    { format: '%Y-%m-%d', display: '%Y-%m-%d' });
  assert.deepEqual(dateboxFormats({ format: '', displayFormat: '' }),
    { format: '%d.%m.%Y', display: '%d.%m.%Y' }, 'empty strings fall back like missing ones');
});

test('a display format changes only what the field shows at rest', () => {
  assert.deepEqual(dateboxFormats({ displayFormat: '%e %b %Y' }),
    { format: '%d.%m.%Y', display: '%e %b %Y' });
  assert.deepEqual(dateboxFormats({ format: '%m/%d/%Y', displayFormat: '%A, %e %B %Y' }),
    { format: '%m/%d/%Y', display: '%A, %e %B %Y' });
});

test('with time, both formats carry the hour and minute unless they already name them', () => {
  assert.deepEqual(dateboxFormats({ time: true }),
    { format: '%d.%m.%Y %H:%M', display: '%d.%m.%Y %H:%M' });
  assert.deepEqual(dateboxFormats({ time: true, displayFormat: '%e %b %Y' }),
    { format: '%d.%m.%Y %H:%M', display: '%e %b %Y %H:%M' });
  assert.deepEqual(dateboxFormats({ time: true, displayFormat: '%a %e %b, %H:%M' }),
    { format: '%d.%m.%Y %H:%M', display: '%a %e %b, %H:%M' }, 'a display format with a time is kept');
  assert.deepEqual(dateboxFormats({ time: false, displayFormat: '%e %b %Y' }),
    { format: '%d.%m.%Y', display: '%e %b %Y' }, 'no time is added to a date-only field');
});

test('the display text may use names; the typing text is what parses back', () => {
  const date = new Date(2026, 10, 2, 9, 5);
  const { format, display } = dateboxFormats({ displayFormat: '%e %b %Y' });
  assert.equal(formatDate(date, display), '2 Nov 2026');
  const typed = formatDate(date, format);
  assert.equal(typed, '02.11.2026');
  const parsed = parseDate(typed, format);
  assert.ok(parsed);
  assert.equal(formatDate(parsed, display), '2 Nov 2026', 'a committed value redraws in the display format');
  // The display format is never parsed: month names are not a typing format.
  assert.equal(parseDate(formatDate(date, display), display), null);

  const withTime = dateboxFormats({ time: true, displayFormat: '%e %b %Y' });
  assert.equal(formatDate(date, withTime.display), '2 Nov 2026 09:05');
  assert.equal(formatDate(parseDate('02.11.2026 09:05', withTime.format), withTime.display), '2 Nov 2026 09:05');
});

test('a range reads in its display format at rest and parses in its typing format', () => {
  const range = { start: new Date(2026, 7, 3), end: new Date(2026, 7, 9) };
  assert.equal(formatRangeText(range, '%e %b %Y', ' – '), '3 Aug 2026 – 9 Aug 2026');
  assert.equal(formatRangeText({ start: range.start, end: null }, '%e %b %Y', ' – '), '3 Aug 2026',
    'a half-open range shows the endpoint it has');
  const typed = formatRangeText(range, '%d.%m.%Y', ' – ');
  assert.equal(typed, '03.08.2026 – 09.08.2026');
  const parsed = parseRangeText(typed, '%d.%m.%Y', ' – ');
  assert.equal(formatRangeText(parsed, '%e %b %Y', ' – '), '3 Aug 2026 – 9 Aug 2026');
});
