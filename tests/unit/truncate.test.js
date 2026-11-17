import assert from 'node:assert/strict';
import test from 'node:test';

import { isTruncated, truncate } from '../../src/components/truncate/truncate.js';

/**
 * The four box measurements `isTruncated` reads. A plain object is enough: the function is pure
 * arithmetic over them, and faking the numbers is the only way to cover fractional zoom.
 * @param {{scrollWidth?: number, clientWidth?: number, scrollHeight?: number, clientHeight?: number}} box
 * @returns {any}
 */
const box = ({ scrollWidth = 100, clientWidth = 100, scrollHeight = 20, clientHeight = 20 }) =>
  ({ scrollWidth, clientWidth, scrollHeight, clientHeight });

test('text that fits is not truncated', () => {
  assert.equal(isTruncated(box({})), false);
});

test('a single line running out of width is truncated', () => {
  assert.equal(isTruncated(box({ scrollWidth: 240, clientWidth: 100 })), true);
});

test('a clamped block running out of height is truncated', () => {
  assert.equal(isTruncated(box({ scrollHeight: 60, clientHeight: 40 })), true);
});

test('a sub-pixel difference is not treated as truncation', () => {
  // Fractional zoom leaves scroll and client sizes a fraction apart on text that fits exactly.
  assert.equal(isTruncated(box({ scrollWidth: 100.5, clientWidth: 100 })), false);
  assert.equal(isTruncated(box({ scrollHeight: 20.75, clientHeight: 20 })), false);
});

/**
 * Just enough of an element for `truncate()` to clamp and release: attributes, a class list, and
 * an inline style addressed through the CSSOM only. Writing `style` as an attribute throws, as a
 * strict `style-src` policy would refuse it.
 * @param {Record<string, string>} attributes Attributes the element starts with.
 * @param {Record<string, [string, string]>} properties Inline custom properties: value and priority.
 * @returns {any}
 */
function fakeElement(attributes = {}, properties = {}) {
  const attrs = new Map(Object.entries(attributes));
  const props = new Map(Object.entries(properties));
  const classes = new Set();
  return {
    nodeType: 1,
    textContent: 'A long value',
    scrollWidth: 100, clientWidth: 100, scrollHeight: 20, clientHeight: 20,
    classList: {
      contains: (name) => classes.has(name),
      add: (name) => classes.add(name),
      remove: (name) => classes.delete(name)
    },
    getAttribute: (name) => attrs.get(name) ?? null,
    setAttribute(name, value) {
      if (name === 'style') throw new Error('style written as an attribute');
      attrs.set(name, String(value));
    },
    removeAttribute: (name) => attrs.delete(name),
    style: {
      getPropertyValue: (name) => props.get(name)?.[0] ?? '',
      getPropertyPriority: (name) => props.get(name)?.[1] ?? '',
      setProperty: (name, value, priority = '') => props.set(name, [String(value), priority]),
      removeProperty: (name) => props.delete(name)
    },
    attrs,
    props
  };
}

test('destroy puts back a line count the element already had', () => {
  const element = fakeElement({ 'data-lines': '3' }, { '--zx-truncate-lines': ['3', 'important'] });
  const controller = truncate(element, { lines: 2 });
  assert.equal(element.attrs.get('data-lines'), '2');
  assert.deepEqual(element.props.get('--zx-truncate-lines'), ['2', '']);
  controller.destroy();
  assert.equal(element.attrs.get('data-lines'), '3');
  assert.deepEqual(element.props.get('--zx-truncate-lines'), ['3', 'important']);
});

test('destroy removes only the line count it set', () => {
  const bare = fakeElement();
  const controller = truncate(bare, { lines: 4 });
  controller.destroy();
  assert.equal(bare.attrs.has('data-lines'), false);
  assert.equal(bare.props.has('--zx-truncate-lines'), false);

  // A single line writes no count, so it leaves an existing one alone on the way out.
  const preset = fakeElement({ 'data-lines': '2' }, { '--zx-truncate-lines': ['2', ''] });
  truncate(preset, { lines: 1 }).destroy();
  assert.equal(preset.attrs.get('data-lines'), '2');
  assert.deepEqual(preset.props.get('--zx-truncate-lines'), ['2', '']);
});
