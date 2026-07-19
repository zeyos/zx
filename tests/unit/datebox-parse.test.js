import assert from 'node:assert/strict';
import test from 'node:test';

import { formatDate, parseDate } from '../../src/core/date.js';
import { joinTime, splitTime } from '../../src/components/timebox/timebox.js';

test('datebox date formats round-trip through the kernel', () => {
  const date = new Date(2026, 6, 17, 14, 35, 0);
  for (const format of ['%d.%m.%Y', '%m/%d/%Y', '%d.%m.%Y %H:%M']) {
    const text = formatDate(date, format);
    const parsed = parseDate(text, format);
    assert.ok(parsed instanceof Date);
    assert.equal(formatDate(parsed, format), text);
  }
});

test('datebox parsing rejects mismatches and impossible dates', () => {
  assert.equal(parseDate('31.02.2026', '%d.%m.%Y'), null);
  assert.equal(parseDate('17/07/2026', '%d.%m.%Y'), null);
  assert.equal(parseDate('07/17/26', '%m/%d/%Y'), null);
  assert.equal(parseDate('17.07.2026 24:00', '%d.%m.%Y %H:%M'), null);
});

test('datebox parsing normalizes accepted short numeric fields', () => {
  const parsed = parseDate('7.1.2026 4:5', '%d.%m.%Y %H:%M');
  assert.ok(parsed instanceof Date);
  assert.equal(formatDate(parsed, '%d.%m.%Y %H:%M'), '07.01.2026 04:05');
  assert.equal(formatDate(parsed, '%e %B %Y'), '7 January 2026');
});

test('splitTime and joinTime preserve positive and negative durations', () => {
  assert.deepEqual(splitTime(95, 'minutes'), {
    hours: 1,
    minutes: 35,
    seconds: 0,
    negative: false
  });
  assert.deepEqual(splitTime(-3723, 'seconds'), {
    hours: 1,
    minutes: 2,
    seconds: 3,
    negative: true
  });
  assert.equal(joinTime(splitTime(-3723, 'seconds'), 'seconds'), -3723);
});

test('splitTime supports durations over 24 hours and every unit', () => {
  assert.deepEqual(splitTime(90061, 'seconds'), {
    hours: 25,
    minutes: 1,
    seconds: 1,
    negative: false
  });
  assert.equal(joinTime({ hours: 25, minutes: 1, seconds: 1 }, 'seconds'), 90061);
  assert.equal(joinTime({ hours: 1, minutes: 30 }, 'minutes'), 90);
  assert.equal(joinTime({ hours: 1, minutes: 30 }, 'hours'), 1.5);
});

test('joinTime carries minute and second overflow', () => {
  assert.equal(joinTime({ hours: 0, minutes: 61, seconds: 60 }, 'seconds'), 3720);
});
