import assert from 'node:assert/strict';
import test from 'node:test';

import { decimalsOf, snapNumber } from '../../src/components/number-field/number-field.js';
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

test('stepPrecision counts the mantissa decimals of an exponential step too', () => {
  assert.equal(stepPrecision(1.5e-7), 8);
  assert.equal(stepPrecision(2.25e-9), 11);
  assert.equal(stepPrecision(1e-7), 7);
});

test('Slider and NumberField read the precision of a step the same way', () => {
  for (const step of [1, 10, 0.5, 0.25, 0.001, 1e-4, 1e-7, 1.5e-7, 2.25e-9]) {
    assert.equal(stepPrecision(step), decimalsOf(step), `step ${step}`);
  }
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
