import assert from 'node:assert/strict';
import test from 'node:test';

import { snapNumber } from '../../src/components/number-field/number-field.js';
import { stepPrecision } from '../../src/components/slider/slider.js';

/** The snapping a Slider performs: the shared helper, given the precision its step implies. */
const snap = (value, { min = 0, max = 100, step = 1 }) =>
  snapNumber(value, { min, max, step, precision: stepPrecision(step) });

test('stepPrecision counts the decimals a step carries', () => {
  assert.equal(stepPrecision(1), 0);
  assert.equal(stepPrecision(10), 0);
  assert.equal(stepPrecision(0.5), 1);
  assert.equal(stepPrecision(0.25), 2);
  assert.equal(stepPrecision(0.001), 3);
});

test('stepPrecision reads a step written in exponential form', () => {
  assert.equal(stepPrecision(1e-4), 4);
});

test('a fractional step does not accumulate floating-point error', () => {
  assert.equal(snap(0.30000000000000004, { step: 0.1 }), 0.3);
  assert.equal(snap(0.7000000000000001, { step: 0.1 }), 0.7);
});

test('values snap to the grid anchored at min, not at zero', () => {
  assert.equal(snap(12, { min: 5, max: 95, step: 10 }), 15);
  assert.equal(snap(11, { min: 5, max: 95, step: 10 }), 15);
  assert.equal(snap(9, { min: 5, max: 95, step: 10 }), 5);
});

test('the bounds win over the grid, so a max off the grid stays reachable', () => {
  assert.equal(snap(999, { min: 0, max: 95, step: 10 }), 95);
  assert.equal(snap(-999, { min: 5, max: 95, step: 10 }), 5);
});
