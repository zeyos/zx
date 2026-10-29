import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildListQuery, calendarDayToUnixSeconds, calendarZone, dataFilterStateToFilters, dateToUnixSeconds,
  tableSortToQuery, unixSecondsToCalendarDay, unixSecondsToDate
} from '../../src/zeyos/query.js';

test('buildListQuery emits the client query shape with plural filters and alias-aware dot sort', () => {
  const query = buildListQuery({
    fields: { Id: 'ID', Email: 'contact.email', Name: 'name' },
    sort: { id: 'Email', dir: 'desc' },
    filters: { account: 42 },
    search: '  server outage  ',
    searchFields: ['name', 'description'],
    limit: 25,
    offset: 50
  });

  assert.deepEqual(query, {
    fields: { Id: 'ID', Email: 'contact.email', Name: 'name' },
    filters: { account: 42, visibility: 0 },
    sort: ['-contact.email'],
    query: 'server outage',
    limit: 25,
    offset: 50
  });
  assert.equal(Object.prototype.hasOwnProperty.call(query, 'filter'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(query, 'searchFields'), false);
});

test('tableSortToQuery uses explicit signs and supports no sort', () => {
  assert.deepEqual(tableSortToQuery({ id: 'name', dir: 'asc' }), ['+name']);
  assert.deepEqual(tableSortToQuery({ id: 'lastmodified', dir: 'desc' }), ['-lastmodified']);
  assert.deepEqual(tableSortToQuery(null), []);
});

test('DataFilter state maps to predicates without dropping zero or false', () => {
  const date = new Date(1_700_000_000_000);
  assert.deepEqual(dataFilterStateToFilters({
    status: 0,
    archived: false,
    query: '  ',
    after: date,
    country: 'AT'
  }, [
    { id: 'status', field: 'status' },
    { id: 'archived', field: 'archived' },
    { id: 'query', field: 'name' },
    { id: 'after', field: 'date', format: 'datetime', operator: '>=' },
    { id: 'country', fields: ['contact.country', 'account.country'] }
  ]), {
    status: 0,
    archived: false,
    date: { '>=': 1_700_000_000 },
    0: ['OR', { 'contact.country': 'AT' }, { 'account.country': 'AT' }]
  });
});

test('DataFilter mappings can preserve ZeyOS null and empty-string predicates explicitly', () => {
  assert.deepEqual(dataFilterStateToFilters({ empty: '', missing: null }, [
    { id: 'empty', field: 'reference', includeEmpty: true },
    { id: 'missing', field: 'account', includeNull: true }
  ]), {
    reference: '',
    account: null
  });
});

test('count remains server-side and visibility can be overridden explicitly', () => {
  assert.deepEqual(buildListQuery({ count: true, visibility: 2 }), {
    filters: { visibility: 2 },
    count: true
  });
  assert.deepEqual(buildListQuery({ filters: { visibility: 1 } }), {
    filters: { visibility: 1 }
  });
});

test('Date and Unix-second helpers round-trip whole seconds', () => {
  const date = new Date('2026-07-22T10:15:30.000Z');
  const seconds = dateToUnixSeconds(date);
  assert.equal(seconds, 1_784_715_330);
  assert.equal(unixSecondsToDate(seconds).toISOString(), date.toISOString());
  assert.equal(unixSecondsToDate(String(seconds)).getTime(), date.getTime());
  assert.equal(dateToUnixSeconds(null), null);
  assert.equal(unixSecondsToDate(null), null);
});

test('date-only values are calendar days at midnight in the instance zone', () => {
  // 19 August 2026 (summer time) and 7 November 2026 (winter time) at midnight in Vienna.
  const august = Date.UTC(2026, 7, 18, 22) / 1000;
  const november = Date.UTC(2026, 10, 6, 23) / 1000;
  for (const [seconds, month, day] of [[august, 7, 19], [november, 10, 7]]) {
    const local = unixSecondsToCalendarDay(seconds, 'Europe/Vienna');
    assert.deepEqual([local.getFullYear(), local.getMonth(), local.getDate()], [2026, month, day]);
    assert.deepEqual([local.getHours(), local.getMinutes()], [0, 0], 'a local midnight, as Datebox edits');
    assert.equal(calendarDayToUnixSeconds(local, 'Europe/Vienna'), seconds);
  }
  // The time of day of the Date is not part of the stored day.
  assert.equal(calendarDayToUnixSeconds(new Date(2026, 7, 19, 17, 45), 'Europe/Vienna'), august);
  assert.equal(calendarDayToUnixSeconds(new Date(2026, 7, 19), 'UTC'), Date.UTC(2026, 7, 19) / 1000);
  assert.equal(calendarDayToUnixSeconds(new Date(2026, 7, 19), 'America/New_York'), Date.UTC(2026, 7, 19, 4) / 1000);
  assert.equal(unixSecondsToCalendarDay(String(august), 'UTC').getDate(), 18, 'numeric strings are seconds');

  assert.equal(unixSecondsToCalendarDay(null), null);
  assert.equal(unixSecondsToCalendarDay(''), null);
  assert.equal(calendarDayToUnixSeconds(null), null);
  assert.throws(() => calendarDayToUnixSeconds(august), TypeError);
  assert.throws(() => unixSecondsToCalendarDay('soon'), TypeError);
  assert.throws(() => calendarDayToUnixSeconds(new Date(2026, 0, 1), 'Nowhere/Special'), RangeError);
});

test('a zone midnight is the first moment of its day across every daylight-saving change', () => {
  for (const timeZone of ['Europe/Vienna', 'America/New_York', 'America/Santiago', 'Pacific/Auckland', 'Australia/Lord_Howe']) {
    const zone = calendarZone(timeZone);
    for (let time = Date.UTC(2025, 0, 1); time < Date.UTC(2027, 0, 1); time += 86_400_000) {
      const date = new Date(time);
      const [year, month, day] = [date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()];
      const midnight = zone.midnightOf(year, month, day);
      assert.deepEqual(zone.dayOf(midnight), { year, month, day }, `${timeZone} ${date.toISOString()}`);
      assert.notDeepEqual(zone.dayOf(midnight - 1000), { year, month, day }, `${timeZone} ${date.toISOString()}`);
    }
  }
  // Without a zone the runtime's own calendar applies, exactly as Date does.
  const local = calendarZone();
  assert.equal(local.midnightOf(2026, 2, 29), new Date(2026, 2, 29).getTime());
  assert.deepEqual(local.dayOf(new Date(2026, 9, 8, 23, 59).getTime()), { year: 2026, month: 9, day: 8 });
});

test('dataFilterStateToFilters counts date-only values in the instance zone when given one', async () => {
  const { dataFilterStateToFilters: convert, calendarDayToUnixSeconds: day } = await import('../../src/zeyos/query.js');
  const picked = new Date(2026, 0, 15);
  const defs = [
    { id: 'due', field: 'duedate', format: 'date', operator: '>=' },
    { id: 'range', field: 'date', format: 'date' },
    { id: 'changed', field: 'lastmodified', format: 'datetime', operator: '>=' }
  ];
  const state = { due: picked, range: [picked, '2026-01-31'], changed: picked };
  const viennaMidnight = Date.UTC(2026, 0, 14, 23) / 1000;

  const zoned = convert(state, defs, { timeZone: 'Europe/Vienna' });
  assert.deepEqual(zoned.duedate, { '>=': viennaMidnight }, 'the picked day, at Vienna midnight');
  assert.deepEqual(zoned.date, [viennaMidnight, Date.UTC(2026, 0, 30, 23) / 1000],
    'a YYYY-MM-DD string is a calendar day as well');
  assert.deepEqual(zoned.lastmodified, { '>=': Math.floor(picked.getTime() / 1000) },
    'a datetime stays an exact instant');
  assert.equal(zoned.duedate['>='], day(picked, 'Europe/Vienna'), 'the same rule forms store with');

  // Without the option nothing changes: instants, and strings passed through.
  const plain = convert(state, defs);
  assert.deepEqual(plain.duedate, { '>=': Math.floor(picked.getTime() / 1000) });
  assert.deepEqual(plain.date, [Math.floor(picked.getTime() / 1000), '2026-01-31']);
  // `timeZone: null` names the runtime zone: local midnight of the picked day.
  assert.deepEqual(convert({ due: new Date(2026, 0, 15, 15, 30) }, defs, { timeZone: null }).duedate,
    { '>=': Math.floor(picked.getTime() / 1000) });
  assert.throws(() => convert(state, defs, { timeZone: 'Nowhere/Special' }), RangeError);
});
