import assert from 'node:assert/strict';
import test from 'node:test';

import { matchItems } from '../../src/components/select/filter.js';

const items = [
  { ID: 1, name: 'Crème Brûlée', city: 'Paris' },
  { ID: 2, name: 'Apple Strudel', city: 'Wien' },
  { ID: 3, name: 'CREAM TART', city: 'Lisbon' }
];

test('matchItems matches without regard to case', () => {
  assert.deepEqual(matchItems(items, 'cream', ['name']), [items[2]]);
});

test('matchItems matches without regard to diacritics', () => {
  assert.deepEqual(matchItems(items, 'creme brulee', ['name']), [items[0]]);
});

test('matchItems applies multi-word queries with AND semantics across keys', () => {
  assert.deepEqual(matchItems(items, 'paris brulee', ['name', 'city']), [items[0]]);
  assert.deepEqual(matchItems(items, 'paris apple', ['name', 'city']), []);
});

test('matchItems supports key readers and primitive items', () => {
  assert.deepEqual(matchItems(items, 'wien', [(item) => item.city]), [items[1]]);
  assert.deepEqual(matchItems(['Alpha', 'Béta'], 'beta', ['ignored']), ['Béta']);
});

test('matchItems returns a copy for an empty query', () => {
  const result = matchItems(items, '   ', ['name']);
  assert.deepEqual(result, items);
  assert.notEqual(result, items);
});
