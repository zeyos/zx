import assert from 'node:assert/strict';
import test from 'node:test';

import { isTruncated } from '../../src/components/truncate/truncate.js';

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
