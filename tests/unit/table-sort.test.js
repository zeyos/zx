import assert from 'node:assert/strict';
import test from 'node:test';

import {
  compareDates, compareNumbers, compareStrings, compareValues, sortRows
} from '../../src/components/table/sort.js';

test('string comparison is locale-aware for umlauts', () => {
  const values = ['Zebra', 'Äpfel', 'Apfel', 'Öl'];
  assert.deepEqual(
    sortRows(values, (value) => value),
    [...values].sort((left, right) => compareStrings(left, right))
  );
  assert.equal(compareStrings('Äpfel', 'Zebra'), 'Äpfel'.localeCompare('Zebra'));
});

test('number and Date comparators use their native ordering', () => {
  assert.ok(compareNumbers(2, 10) < 0);
  assert.ok(compareDates(new Date('2024-01-01'), new Date('2025-01-01')) < 0);
  assert.deepEqual(sortRows([{ n: 12 }, { n: 2 }], (row) => row.n), [{ n: 2 }, { n: 12 }]);
});

test('descending comparison reverses values but keeps nulls last', () => {
  const rows = [{ n: null }, { n: 2 }, { n: 8 }, { n: undefined }];
  assert.deepEqual(sortRows(rows, (row) => row.n, 'desc').map((row) => row.n), [8, 2, null, undefined]);
  assert.ok(compareValues(null, 1, 'desc') > 0);
});

test('sorting is stable and does not mutate the input', () => {
  const rows = [
    { id: 'a', group: 1 },
    { id: 'b', group: 1 },
    { id: 'c', group: 0 },
    { id: 'd', group: 1 }
  ];
  const sorted = sortRows(rows, (row) => row.group);
  assert.deepEqual(sorted.map((row) => row.id), ['c', 'a', 'b', 'd']);
  assert.deepEqual(rows.map((row) => row.id), ['a', 'b', 'c', 'd']);
});
