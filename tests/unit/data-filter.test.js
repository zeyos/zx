import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applyFilters, deriveSelectOptions, matchesText
} from '../../src/components/data-filter/filter-core.js';

const rows = [
  { id: 1, name: 'Äpfel Markt', notes: 'Fresh fruit', category: 'Food', amount: 80 },
  { id: 2, name: 'Zebra Büro', notes: 'Paper supplies', category: 'Office', amount: 140 },
  { id: 3, name: 'Birne', notes: 'Äpfel and pears', category: 'Food', amount: 220 }
];

test('text matching is case/diacritic-insensitive with multi-word AND semantics', () => {
  assert.equal(matchesText(['Äpfel Markt', 'Fresh fruit'], 'apfel FRESH'), true);
  assert.equal(matchesText(['Äpfel Markt', 'Fresh fruit'], 'apfel paper'), false);

  const filtered = applyFilters(rows, [
    { type: 'text', id: 'query', fields: ['name', 'notes'] },
    { type: 'select', id: 'category', field: 'category' }
  ], { query: 'apfel pears', category: 'Food' });
  assert.deepEqual(filtered.map((row) => row.id), [3]);
});

test('select filters support multiple fields with OR semantics', () => {
  const filtered = applyFilters([
    { id: 1, primary: 'A', secondary: 'B' },
    { id: 2, primary: 'C', secondary: 'D' }
  ], [{ type: 'select', id: 'tag', fields: ['primary', 'secondary'] }], { tag: 'B' });
  assert.deepEqual(filtered.map((row) => row.id), [1]);
});

test('select options are derived distinctly in first-seen order', () => {
  assert.deepEqual(deriveSelectOptions(rows, { field: 'category' }), [
    { value: 'Food', label: 'Food' },
    { value: 'Office', label: 'Office' }
  ]);
});

test('custom predicates combine with other filters using AND semantics', () => {
  const filtered = applyFilters(rows, [
    { type: 'select', id: 'category', field: 'category' },
    { type: 'custom', id: 'minimum', predicate: (row, value) => row.amount >= Number(value) }
  ], { category: 'Food', minimum: '100' });
  assert.deepEqual(filtered.map((row) => row.id), [3]);
});

test('empty state values leave the source unchanged without returning the same array', () => {
  const filtered = applyFilters(rows, [
    { type: 'text', id: 'query', fields: ['name'] }
  ], { query: '  ' });
  assert.deepEqual(filtered, rows);
  assert.notEqual(filtered, rows);
});
