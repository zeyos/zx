import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeItems } from '../../src/components/toolbar/toolbar.js';

/** Minimal stand-in for an Element: `isElement()` only looks at `nodeType`. @returns {object} */
function fakeElement(name = 'div') {
  return { nodeType: 1, tagName: name.toUpperCase() };
}

test('items are classified as separators, elements, and descriptors', () => {
  const element = fakeElement('button');
  assert.deepEqual(normalizeItems([{ label: 'Save' }, '-', element]), [
    { type: 'descriptor', descriptor: { label: 'Save' } },
    { type: 'separator' },
    { type: 'element', element }
  ]);
});

test('elements pass through by reference while descriptors are copied', () => {
  const element = fakeElement();
  const descriptor = { name: 'save', label: 'Save' };
  const [descriptorEntry, elementEntry] = normalizeItems([descriptor, element]);
  assert.equal(elementEntry.element, element);
  assert.notEqual(descriptorEntry.descriptor, descriptor);
  descriptorEntry.descriptor.label = 'Changed';
  assert.equal(descriptor.label, 'Save');
});

test('leading, trailing, and repeated separators collapse', () => {
  const entries = normalizeItems(['-', '-', { label: 'A' }, '-', '-', { label: 'B' }, '-', '-']);
  assert.deepEqual(entries.map((entry) => entry.type), ['descriptor', 'separator', 'descriptor']);
  assert.deepEqual(normalizeItems(['-', '-']), []);
});

test('nullish entries are dropped without disturbing separator collapsing', () => {
  const entries = normalizeItems([null, { label: 'A' }, undefined, '-', null, { label: 'B' }]);
  assert.deepEqual(entries.map((entry) => entry.type), ['descriptor', 'separator', 'descriptor']);
});

test('an empty or nullish list normalizes to no entries', () => {
  assert.deepEqual(normalizeItems([]), []);
  assert.deepEqual(normalizeItems(null), []);
  assert.deepEqual(normalizeItems(undefined), []);
});

test('unsupported list and item types are rejected', () => {
  assert.throws(() => normalizeItems('save'), TypeError);
  assert.throws(() => normalizeItems({ label: 'Save' }), TypeError);
  assert.throws(() => normalizeItems(['save']), TypeError);
  assert.throws(() => normalizeItems([42]), TypeError);
  assert.throws(() => normalizeItems([['nested']]), TypeError);
});
