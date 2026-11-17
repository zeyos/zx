import assert from 'node:assert/strict';
import test from 'node:test';

// Week numbers are calendar arithmetic on local days; pin a zone with a DST change to keep it honest.
process.env.TZ = 'Europe/Vienna';

const { isoWeekNumber, rowWeekNumber } = await import('../../src/components/date-picker/date-picker.js');
const { tabStop } = await import('../../src/components/date-picker/time-picker.js');

test('isoWeekNumber follows ISO 8601 across year boundaries', () => {
  assert.equal(isoWeekNumber(new Date(2026, 0, 1)), 1, 'Thu 1 Jan 2026 opens week 1');
  assert.equal(isoWeekNumber(new Date(2026, 0, 4)), 1, 'Sun 4 Jan 2026 closes week 1');
  assert.equal(isoWeekNumber(new Date(2026, 0, 5)), 2);
  assert.equal(isoWeekNumber(new Date(2021, 0, 3)), 53, 'Sun 3 Jan 2021 is in week 53 of 2020');
  assert.equal(isoWeekNumber(new Date(2024, 11, 30)), 1, 'Mon 30 Dec 2024 is in week 1 of 2025');
  assert.equal(isoWeekNumber(new Date(2026, 2, 29, 12)), 13, 'the DST change keeps its week');
});

test('a calendar row is labelled with the ISO week most of its days belong to', () => {
  // Monday start: the row is exactly one ISO week.
  assert.equal(rowWeekNumber(new Date(2026, 0, 5)), 2);
  // Sunday start: Sun 4 Jan is in week 1, but Mon 5 – Sat 10 Jan are week 2.
  assert.equal(rowWeekNumber(new Date(2026, 0, 4)), 2);
  assert.equal(rowWeekNumber(new Date(2025, 11, 28)), 1, 'Sun 28 Dec 2025 – Sat 3 Jan 2026');
  // Saturday start: Sat 3 and Sun 4 Jan are week 1, Mon 5 – Fri 9 Jan week 2.
  assert.equal(rowWeekNumber(new Date(2026, 0, 3)), 2);
  // Every start day labels the same seven days with the week holding at least four of them.
  for (let offset = 0; offset < 7; offset += 1) {
    const start = new Date(2026, 5, 1 + offset);
    const counts = new Map();
    for (let day = 0; day < 7; day += 1) {
      const week = isoWeekNumber(new Date(2026, 5, 1 + offset + day));
      counts.set(week, (counts.get(week) ?? 0) + 1);
    }
    const majority = [...counts].find(([, count]) => count >= 4)[0];
    assert.equal(rowWeekNumber(start), majority, `row starting ${start.toDateString()}`);
  }
});

test('the clock dial always has a Tab stop, on the checked mark or the nearest one', () => {
  const minutes = Array.from({ length: 12 }, (_, index) => ({ value: index * 5 }));
  assert.equal(tabStop(minutes, 15, 60), 15, 'an exact mark keeps the stop');
  assert.equal(tabStop(minutes, 7, 60), 5, '12:07 rests on the 05 mark');
  assert.equal(tabStop(minutes, 8, 60), 10);
  assert.equal(tabStop(minutes, 58, 60), 0, 'the dial wraps from 55 to 00');
  const hours = Array.from({ length: 24 }, (_, index) => ({ value: index }));
  for (let hour = 0; hour < 24; hour += 1) assert.equal(tabStop(hours, hour, 24), hour);
});
