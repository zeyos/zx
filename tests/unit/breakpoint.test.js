import assert from 'node:assert/strict';
import test from 'node:test';

import { breakpointOf, breakpoints, matchBreakpoint, onBreakpoint } from '../../src/core/breakpoint.js';

test('breakpointOf names the band a width falls into', () => {
  assert.equal(breakpointOf(0), 'xs');
  assert.equal(breakpointOf(479), 'xs');
  assert.equal(breakpointOf(480), 'sm');
  assert.equal(breakpointOf(767), 'sm');
  assert.equal(breakpointOf(768), 'md');
  assert.equal(breakpointOf(1023), 'md');
  assert.equal(breakpointOf(1024), 'lg');
  assert.equal(breakpointOf(1279), 'lg');
  assert.equal(breakpointOf(1280), 'xl');
  assert.equal(breakpointOf(4000), 'xl');
});

test('breakpointOf treats an unmeasurable width as the narrowest band', () => {
  assert.equal(breakpointOf(Number.NaN), 'xs');
  assert.equal(breakpointOf(undefined), 'xs');
  assert.equal(breakpointOf(-1), 'xs');
});

test('matchBreakpoint reads as a min-width query', () => {
  assert.equal(matchBreakpoint('md', 768), true);
  assert.equal(matchBreakpoint('md', 767), false);
  assert.equal(matchBreakpoint('xl', 1280), true);
  // Every width is at least `xs`, which is the band below the first threshold.
  assert.equal(matchBreakpoint('xs', 0), true);
});

test('matchBreakpoint rejects a name that is not on the scale', () => {
  assert.throws(() => matchBreakpoint('xxl', 2000), RangeError);
});

test('the scale is frozen and ascending', () => {
  const values = Object.values(breakpoints);
  assert.deepEqual(values, [...values].sort((a, b) => a - b));
  assert.equal(Object.isFrozen(breakpoints), true);
});

test('an explicit target that is not an element is rejected', () => {
  // Falling back to the window here looks like it works while measuring the wrong thing — which is
  // how Table came to watch the viewport instead of itself.
  assert.throws(() => onBreakpoint(() => {}, { target: null }), TypeError);
  assert.throws(() => onBreakpoint(() => {}, { target: 'main' }), TypeError);
});
