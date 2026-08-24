import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeAppItems } from '../../src/internal/app-rail.js';

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

test('application navigation disables unsafe destinations but preserves explicit safe actions', () => {
  const invoke = () => {};
  const [unsafe, action, safe, branch] = normalizeAppItems([
    { id: 'unsafe', label: 'Unsafe', href: 'java\nscript:alert(1)' },
    { id: 'action', label: 'Action', href: 'data:text/html,unsafe', invoke },
    { id: 'safe', label: 'Safe', href: '#safe' },
    { id: 'branch', label: 'Branch', href: 'javascript:void 0', children: [
      { id: 'child', label: 'Child', href: '#child' }
    ] }
  ]);
  assert.equal(unsafe.href, undefined);
  assert.equal(unsafe.disabled, true);
  assert.equal(action.href, undefined);
  assert.equal(action.disabled, undefined);
  assert.equal(action.invoke, invoke);
  assert.equal(safe.href, '#safe');
  assert.equal(branch.href, undefined);
  assert.equal(branch.disabled, undefined);
  assert.equal(branch.children[0].href, '#child');
});
