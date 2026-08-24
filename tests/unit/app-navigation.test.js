import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeAppItems } from '../../src/components/app-rail/app-rail.js';

test('application navigation normalization is recursive and does not mutate input', () => {
  const input = [{ id: 1, label: 42, children: [{ id: 2, label: 'Child' }] }];
  const normalized = normalizeAppItems(input);
  assert.equal(normalized[0].label, '42');
  assert.equal(normalized[0].children[0].label, 'Child');
  normalized[0].children.push({ id: 3, label: 'New' });
  assert.equal(input[0].children.length, 1);
});

test('application navigation drops malformed entries', () => {
  assert.deepEqual(normalizeAppItems([null, {}, { id: 'x' }, { label: 'No id' }]), []);
});
