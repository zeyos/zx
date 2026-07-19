import assert from 'node:assert/strict';
import test from 'node:test';

import { clamp, debounce, deepMerge, toArray, uid } from '../../src/core/util.js';

test('deepMerge recursively merges plain objects without mutating inputs', () => {
  const base = { nested: { left: 1, shared: 'base' }, list: [1, 2], keep: true };
  const override = { nested: { right: 2, shared: 'override' }, list: [3] };
  const result = deepMerge(base, override);
  assert.deepEqual(result, {
    nested: { left: 1, right: 2, shared: 'override' },
    list: [3],
    keep: true
  });
  assert.deepEqual(base.list, [1, 2]);
  assert.notEqual(result.nested, base.nested);
  assert.notEqual(result.list, override.list);
});

test('uid returns unique identifiers with the requested prefix', () => {
  const generated = new Set(Array.from({ length: 250 }, () => uid('test')));
  assert.equal(generated.size, 250);
  for (const value of generated) assert.match(value, /^test-/);
});

test('debounce invokes only the latest call with its context', async () => {
  const calls = [];
  const context = { name: 'context' };
  const wrapped = debounce(function (value) {
    calls.push([this.name, value]);
  }, 15);
  wrapped.call(context, 1);
  wrapped.call(context, 2);
  await new Promise((resolve) => setTimeout(resolve, 40));
  assert.deepEqual(calls, [['context', 2]]);
});

test('clamp and toArray normalize common values', () => {
  assert.equal(clamp(12, 0, 10), 10);
  assert.deepEqual(toArray(null), []);
  assert.deepEqual(toArray('value'), ['value']);
  assert.deepEqual(toArray(new Set([1, 2])), [1, 2]);
});
