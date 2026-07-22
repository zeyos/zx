import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildListQuery, dataFilterStateToFilters, dateToUnixSeconds,
  tableSortToQuery, unixSecondsToDate
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
