import assert from 'node:assert/strict';
import test from 'node:test';

import { Field, registerFieldAdapters } from '../../src/index.js';

test('public index registers every component-backed field adapter', () => {
  for (const type of [
    'zxselect', 'checklist', 'date', 'month', 'datetime', 'time', 'valuelist',
    'multivalueeditor', 'upload', 'toggle'
  ]) {
    assert.equal(Field.has(type), true, `${type} should be registered`);
  }
});

test('registerFieldAdapters can safely register the adapter set again', () => {
  assert.doesNotThrow(() => registerFieldAdapters());
  assert.equal(Field.has('zxselect'), true);
  assert.equal(Field.has('upload'), true);
});
