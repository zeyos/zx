import assert from 'node:assert/strict';
import test from 'node:test';

// Calendar-day arithmetic must retain local wall-clock semantics across both DST boundaries.
process.env.TZ = 'Europe/Vienna';

import {
  addCalendarDays, calendarDayDifference, calendarDayKey, calendarEventSpansDays, calendarRange,
  layoutCalendarSpans, layoutTimedCalendarEvents, normalizeCalendarEvents, shiftCalendarEvent,
  startOfCalendarWeek
} from '../../src/components/calendar/calendar-model.js';

const event = (id, start, end, options = {}) => normalizeCalendarEvents([{
  id, title: `Event ${id}`, start, end, ...options
}])[0];

test('calendarRange returns exclusive local windows for every supported view', () => {
  const anchor = new Date(2026, 7, 26, 14);
  const expected = {
    agenda: ['2026-08-26', '2026-09-09'],
    day: ['2026-08-26', '2026-08-27'],
    week: ['2026-08-24', '2026-08-31'],
    month: ['2026-07-27', '2026-09-07'],
    year: ['2026-01-01', '2027-01-01']
  };
  for (const [view, days] of Object.entries(expected)) {
    const range = calendarRange(view, anchor, { weekStart: 1, agendaDays: 14 });
    assert.deepEqual([calendarDayKey(range.start), calendarDayKey(range.end)], days, view);
  }
});

test('calendar local-day helpers ignore DST hour changes', () => {
  const spring = new Date(2026, 2, 28, 9, 30);
  const springNext = addCalendarDays(spring, 2);
  const autumn = new Date(2026, 9, 24, 9, 30);
  const autumnNext = addCalendarDays(autumn, 2);
  assert.equal(calendarDayDifference(spring, springNext), 2);
  assert.equal(calendarDayDifference(autumn, autumnNext), 2);
  assert.equal(springNext.getHours(), 9);
  assert.equal(autumnNext.getHours(), 9);
  assert.equal(calendarDayKey(startOfCalendarWeek(new Date(2026, 7, 30), 1)), '2026-08-24');
});

test('event normalization supports configurable readers, Unix seconds, and defensive Dates', () => {
  const source = {
    ID: 42,
    name: 'Warehouse inspection',
    datefrom: 1787734800,
    dateto: 1787738400,
    tint: '#0a7',
    room: 'Linz'
  };
  const [normalized] = normalizeCalendarEvents([source], {
    eventId: 'ID', eventTitle: 'name', eventStart: 'datefrom', eventEnd: 'dateto',
    eventColor: 'tint', eventLocation: (record) => record.room, dateUnit: 'seconds'
  });
  assert.equal(normalized.id, 42);
  assert.equal(normalized.title, 'Warehouse inspection');
  assert.equal(normalized.start.getTime(), source.datefrom * 1000);
  assert.equal(normalized.end.getTime(), source.dateto * 1000);
  assert.equal(normalized.color, '#0a7');
  assert.equal(normalized.location, 'Linz');
  assert.equal(normalized.data, source);
  normalized.start.setFullYear(2000);
  assert.equal(source.datefrom, 1787734800);
});

test('event normalization is atomic and rejects duplicates, inverted dates, and unsafe colors', () => {
  assert.throws(() => normalizeCalendarEvents([
    { id: 1, start: new Date(2026, 7, 1) },
    { id: 1, start: new Date(2026, 7, 2) }
  ]), /Duplicate/);
  assert.throws(() => normalizeCalendarEvents([
    { id: 2, start: new Date(2026, 7, 2), end: new Date(2026, 7, 1) }
  ]), /ends before/);
  const [safe] = normalizeCalendarEvents([{
    id: 3, start: new Date(2026, 7, 1), color: 'url(javascript:alert(1))'
  }]);
  assert.equal(safe.color, null);
});

test('timed layout creates the minimum collision columns per overlap cluster', () => {
  const day = new Date(2026, 7, 25);
  const layouts = layoutTimedCalendarEvents([
    event('a', new Date(2026, 7, 25, 9), new Date(2026, 7, 25, 11)),
    event('b', new Date(2026, 7, 25, 10), new Date(2026, 7, 25, 12)),
    event('c', new Date(2026, 7, 25, 11, 30), new Date(2026, 7, 25, 12, 30)),
    event('d', new Date(2026, 7, 25, 13), new Date(2026, 7, 25, 14))
  ], day);
  assert.deepEqual(layouts.map(({ event: item, column, columns }) => [item.id, column, columns]), [
    ['a', 0, 2], ['b', 1, 2], ['c', 0, 2], ['d', 0, 1]
  ]);
});

test('spanning layout clips events and reuses free lanes', () => {
  const start = new Date(2026, 7, 24);
  const spans = layoutCalendarSpans([
    event('a', new Date(2026, 7, 23), new Date(2026, 7, 26), { allDay: true }),
    event('b', new Date(2026, 7, 25), new Date(2026, 7, 27), { allDay: true }),
    event('c', new Date(2026, 7, 27), new Date(2026, 7, 28), { allDay: true })
  ], start, 7);
  assert.deepEqual(spans.map(({ event: item, start: from, end, lane }) => [item.id, from, end, lane]), [
    ['a', 0, 2, 0], ['b', 1, 3, 1], ['c', 3, 4, 0]
  ]);
});

test('event proposals are immutable and keep local clock time', () => {
  const source = event('move', new Date(2026, 2, 28, 9), new Date(2026, 2, 28, 10));
  const moved = shiftCalendarEvent(source, { days: 2, minutes: 30 });
  assert.equal(calendarDayKey(moved.start), '2026-03-30');
  assert.deepEqual([moved.start.getHours(), moved.start.getMinutes()], [9, 30]);
  assert.deepEqual([source.start.getDate(), source.start.getHours()], [28, 9]);
  assert.equal(calendarEventSpansDays(event('all', new Date(2026, 7, 1), new Date(2026, 7, 2), { allDay: true })), true);
});
