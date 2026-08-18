import assert from 'node:assert/strict';
import test from 'node:test';

// A fixed zone makes the daylight-saving cases below reproducible. node:test runs every test file
// in its own process, so this cannot leak into the rest of the suite.
process.env.TZ = 'Europe/Berlin';

import {
  clampRange, normalizeRange, rangeNights, rangeStateOf
} from '../../src/components/date-picker/date-range-picker.js';
import { formatRangeText, parseRangeText } from '../../src/components/datebox/date-range-box.js';

const FORMAT = '%d.%m.%Y';
const SEPARATOR = ' – ';

/* ------------------------------------------------------------------ normalizeRange -- */

test('normalizeRange orders an inverted pair', () => {
  const range = normalizeRange(new Date(2026, 7, 14), new Date(2026, 7, 1));
  assert.equal(range.start.getTime(), new Date(2026, 7, 1).getTime());
  assert.equal(range.end.getTime(), new Date(2026, 7, 14).getTime());
});

test('normalizeRange keeps an already ordered pair', () => {
  const range = normalizeRange(new Date(2026, 7, 1), new Date(2026, 7, 14));
  assert.equal(range.start.getDate(), 1);
  assert.equal(range.end.getDate(), 14);
});

test('normalizeRange passes nulls and undefined through', () => {
  assert.deepEqual(normalizeRange(null, null), { start: null, end: null });
  assert.deepEqual(normalizeRange(undefined, undefined), { start: null, end: null });
  const half = normalizeRange(new Date(2026, 7, 3), null);
  assert.equal(half.start.getDate(), 3);
  assert.equal(half.end, null);
});

test('normalizeRange rejects invalid Dates and non-dates', () => {
  assert.deepEqual(normalizeRange(new Date('nope'), new Date('also nope')), { start: null, end: null });
  assert.deepEqual(normalizeRange('2026-08-01', 1754006400), { start: null, end: null });
  const mixed = normalizeRange(new Date(2026, 7, 5), new Date(NaN));
  assert.equal(mixed.start.getDate(), 5);
  assert.equal(mixed.end, null);
});

test('normalizeRange strips the time of day to local midnight', () => {
  const range = normalizeRange(new Date(2026, 7, 1, 23, 59, 59, 999), new Date(2026, 7, 14, 0, 30));
  assert.deepEqual(
    [range.start.getHours(), range.start.getMinutes(), range.start.getSeconds(), range.start.getMilliseconds()],
    [0, 0, 0, 0]
  );
  assert.deepEqual([range.end.getHours(), range.end.getMinutes()], [0, 0]);
  assert.equal(range.end.getDate(), 14);
});

test('normalizeRange returns copies, never the inputs', () => {
  const start = new Date(2026, 7, 1);
  const range = normalizeRange(start, new Date(2026, 7, 14));
  assert.notEqual(range.start, start);
  range.start.setFullYear(1999);
  assert.equal(start.getFullYear(), 2026);
});

/* --------------------------------------------------------------------- rangeNights -- */

test('rangeNights counts nights, not days', () => {
  assert.equal(rangeNights(new Date(2026, 7, 1), new Date(2026, 7, 14)), 13);
  assert.equal(rangeNights(new Date(2026, 7, 1), new Date(2026, 7, 2)), 1);
});

test('rangeNights returns 0 for the same day and for incomplete ranges', () => {
  assert.equal(rangeNights(new Date(2026, 7, 9), new Date(2026, 7, 9)), 0);
  assert.equal(rangeNights(new Date(2026, 7, 9, 8), new Date(2026, 7, 9, 22)), 0);
  assert.equal(rangeNights(new Date(2026, 7, 9), null), 0);
  assert.equal(rangeNights(null, null), 0);
});

test('rangeNights is unsigned: an inverted pair counts the same', () => {
  assert.equal(rangeNights(new Date(2026, 7, 14), new Date(2026, 7, 1)), 13);
});

test('rangeNights counts calendar days across both DST boundaries', () => {
  // Europe/Berlin loses an hour on 29 March 2026 (a 47-hour span) and gains one on 25 October
  // 2026 (a 49-hour span); both still cover exactly two nights.
  assert.equal(rangeNights(new Date(2026, 2, 28), new Date(2026, 2, 30)), 2);
  assert.equal(rangeNights(new Date(2026, 9, 24), new Date(2026, 9, 26)), 2);
  // A whole month containing a transition.
  assert.equal(rangeNights(new Date(2026, 2, 1), new Date(2026, 3, 1)), 31);
});

/* -------------------------------------------------------------------- rangeStateOf -- */

test('rangeStateOf labels the endpoints and the band between them', () => {
  const start = new Date(2026, 7, 1);
  const end = new Date(2026, 7, 5);
  assert.equal(rangeStateOf(start, start, end), 'start');
  assert.equal(rangeStateOf(new Date(2026, 7, 3), start, end), 'middle');
  assert.equal(rangeStateOf(end, start, end), 'end');
  assert.equal(rangeStateOf(new Date(2026, 6, 31), start, end), null);
  assert.equal(rangeStateOf(new Date(2026, 7, 6), start, end), null);
});

test('rangeStateOf ignores the time of day on every argument', () => {
  const start = new Date(2026, 7, 1, 18);
  const end = new Date(2026, 7, 5, 4);
  assert.equal(rangeStateOf(new Date(2026, 7, 1, 3), start, end), 'start');
  assert.equal(rangeStateOf(new Date(2026, 7, 5, 23), start, end), 'end');
});

test('rangeStateOf reports a one-day range as its start', () => {
  const day = new Date(2026, 7, 9);
  assert.equal(rangeStateOf(day, day, new Date(2026, 7, 9)), 'start');
});

test('rangeStateOf matches only the endpoint of a half-open range', () => {
  const start = new Date(2026, 7, 1);
  assert.equal(rangeStateOf(start, start, null), 'start');
  assert.equal(rangeStateOf(new Date(2026, 7, 2), start, null), null);
  assert.equal(rangeStateOf(start, null, start), 'end');
});

test('rangeStateOf normalizes an inverted range and rejects bad input', () => {
  assert.equal(rangeStateOf(new Date(2026, 7, 3), new Date(2026, 7, 5), new Date(2026, 7, 1)), 'middle');
  assert.equal(rangeStateOf(new Date('nope'), new Date(2026, 7, 1), new Date(2026, 7, 5)), null);
  assert.equal(rangeStateOf(new Date(2026, 7, 3), null, null), null);
});

/* ----------------------------------------------------------------------- clampRange -- */

test('clampRange pulls both endpoints inside min and max', () => {
  const range = clampRange(
    { start: new Date(2026, 6, 1), end: new Date(2026, 8, 30) },
    { min: new Date(2026, 7, 10), max: new Date(2026, 7, 20) }
  );
  assert.equal(range.start.getTime(), new Date(2026, 7, 10).getTime());
  assert.equal(range.end.getTime(), new Date(2026, 7, 20).getTime());
});

test('clampRange clamps a half-open range and leaves an empty one empty', () => {
  const half = clampRange({ start: new Date(2026, 6, 1), end: null }, { min: new Date(2026, 7, 10) });
  assert.equal(half.start.getTime(), new Date(2026, 7, 10).getTime());
  assert.equal(half.end, null);
  assert.deepEqual(clampRange(null), { start: null, end: null });
  assert.deepEqual(clampRange({ start: null, end: null }), { start: null, end: null });
});

test('clampRange stretches a too-short range forward to minNights', () => {
  const range = clampRange(
    { start: new Date(2026, 7, 1), end: new Date(2026, 7, 2) },
    { minNights: 3 }
  );
  assert.equal(rangeNights(range.start, range.end), 3);
  assert.equal(range.start.getDate(), 1);
  assert.equal(range.end.getDate(), 4);
});

test('clampRange pulls the start back when max blocks the minNights stretch', () => {
  const range = clampRange(
    { start: new Date(2026, 7, 19), end: new Date(2026, 7, 20) },
    { max: new Date(2026, 7, 20), minNights: 5 }
  );
  assert.equal(range.end.getTime(), new Date(2026, 7, 20).getTime());
  assert.equal(range.start.getTime(), new Date(2026, 7, 15).getTime());
  assert.equal(rangeNights(range.start, range.end), 5);
});

test('clampRange gives up when the min/max window is shorter than minNights', () => {
  assert.deepEqual(
    clampRange(
      { start: new Date(2026, 7, 10), end: new Date(2026, 7, 11) },
      { min: new Date(2026, 7, 10), max: new Date(2026, 7, 12), minNights: 5 }
    ),
    { start: null, end: null }
  );
});

test('clampRange shortens a too-long range to maxNights', () => {
  const range = clampRange(
    { start: new Date(2026, 7, 1), end: new Date(2026, 7, 30) },
    { maxNights: 6 }
  );
  assert.equal(range.start.getDate(), 1);
  assert.equal(range.end.getDate(), 7);
  assert.equal(rangeNights(range.start, range.end), 6);
});

test('clampRange accepts maxNights 0 and ignores unusable night counts', () => {
  const solo = clampRange({ start: new Date(2026, 7, 1), end: new Date(2026, 7, 9) }, { maxNights: 0 });
  assert.equal(rangeNights(solo.start, solo.end), 0);
  const untouched = clampRange(
    { start: new Date(2026, 7, 1), end: new Date(2026, 7, 9) },
    { minNights: 'x', maxNights: null }
  );
  assert.equal(rangeNights(untouched.start, untouched.end), 8);
});

test('clampRange normalizes an inverted range before bounding it', () => {
  const range = clampRange({ start: new Date(2026, 7, 20), end: new Date(2026, 7, 4) }, { minNights: 2 });
  assert.equal(range.start.getDate(), 4);
  assert.equal(range.end.getDate(), 20);
});

/* ------------------------------------------------------------------ range text I/O -- */

test('formatRangeText and parseRangeText round-trip a complete range', () => {
  const range = { start: new Date(2026, 7, 1), end: new Date(2026, 7, 14) };
  const value = formatRangeText(range, FORMAT, SEPARATOR);
  assert.equal(value, '01.08.2026 – 14.08.2026');
  const parsed = parseRangeText(value, FORMAT, SEPARATOR);
  assert.equal(parsed.start.getTime(), range.start.getTime());
  assert.equal(parsed.end.getTime(), range.end.getTime());
});

test('formatRangeText renders incomplete ranges without a dangling separator', () => {
  assert.equal(formatRangeText({ start: null, end: null }, FORMAT, SEPARATOR), '');
  assert.equal(formatRangeText({ start: new Date(2026, 7, 1), end: null }, FORMAT, SEPARATOR), '01.08.2026');
  assert.equal(formatRangeText({ start: null, end: new Date(2026, 7, 1) }, FORMAT, SEPARATOR), '01.08.2026');
  assert.equal(formatRangeText(null, FORMAT, SEPARATOR), '');
});

test('parseRangeText tolerates loose spacing around the separator', () => {
  for (const value of ['01.08.2026–14.08.2026', '01.08.2026 –14.08.2026', '  01.08.2026  –  14.08.2026  ']) {
    const parsed = parseRangeText(value, FORMAT, SEPARATOR);
    assert.ok(parsed, `${value} should parse`);
    assert.equal(formatRangeText(parsed, FORMAT, SEPARATOR), '01.08.2026 – 14.08.2026');
  }
});

test('parseRangeText reads a lone date as a one-day range and empty text as no range', () => {
  const single = parseRangeText('09.08.2026', FORMAT, SEPARATOR);
  assert.equal(rangeNights(single.start, single.end), 0);
  assert.equal(single.start.getDate(), 9);
  assert.deepEqual(parseRangeText('', FORMAT, SEPARATOR), { start: null, end: null });
  assert.deepEqual(parseRangeText('   ', FORMAT, SEPARATOR), { start: null, end: null });
});

test('parseRangeText keeps a half-typed range open', () => {
  const half = parseRangeText('01.08.2026 – ', FORMAT, SEPARATOR);
  assert.equal(half.start.getDate(), 1);
  assert.equal(half.end, null);
});

test('parseRangeText orders an inverted range', () => {
  const parsed = parseRangeText('14.08.2026 – 01.08.2026', FORMAT, SEPARATOR);
  assert.equal(parsed.start.getDate(), 1);
  assert.equal(parsed.end.getDate(), 14);
});

test('parseRangeText rejects text that does not match the format', () => {
  assert.equal(parseRangeText('01.08.2026 – 31.02.2026', FORMAT, SEPARATOR), null);
  assert.equal(parseRangeText('yesterday – today', FORMAT, SEPARATOR), null);
  assert.equal(parseRangeText('2026-08-01 – 2026-08-14', FORMAT, SEPARATOR), null);
  assert.equal(parseRangeText('01.08.2026 – 05.08.2026 – 09.08.2026', FORMAT, SEPARATOR), null);
});

test('parseRangeText does not split a dashed format on its own dashes', () => {
  const parsed = parseRangeText('2026-08-01 - 2026-08-14', '%Y-%m-%d', ' - ');
  assert.ok(parsed);
  assert.equal(formatRangeText(parsed, '%Y-%m-%d', ' - '), '2026-08-01 - 2026-08-14');
});
