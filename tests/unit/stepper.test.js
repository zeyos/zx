import assert from 'node:assert/strict';
import test from 'node:test';

import {
  completedByAdvance, normalizeSteps, resolveStepIndex, stepIndex, stepState
} from '../../src/components/stepper/steps.js';

/** @param {...Partial<{name: string, disabled: boolean}>} steps @returns {any[]} */
function rail(...steps) {
  return normalizeSteps(steps);
}

test('normalizeSteps fills in every documented default', () => {
  assert.deepEqual(normalizeSteps([{ name: 'cart', title: 'Cart' }]), [{
    name: 'cart',
    title: 'Cart',
    description: null,
    optional: false,
    disabled: false
  }]);
});

test('normalizeSteps coerces types and never mutates its input', () => {
  const input = [{ name: 'a', title: 7, description: 12, optional: 1, disabled: '' }];
  const [step] = normalizeSteps(input);
  assert.deepEqual(step, {
    name: 'a', title: '7', description: '12', optional: true, disabled: false
  });
  assert.deepEqual(input, [{ name: 'a', title: 7, description: 12, optional: 1, disabled: '' }]);
  assert.notEqual(step, input[0]);
});

test('normalizeSteps accepts an empty list and keeps order', () => {
  assert.deepEqual(normalizeSteps([]), []);
  assert.deepEqual(rail({ name: 'c' }, { name: 'a' }, { name: 'b' }).map((step) => step.name),
    ['c', 'a', 'b']);
});

test('normalizeSteps rejects malformed lists, steps, and names', () => {
  assert.throws(() => normalizeSteps(null), TypeError);
  assert.throws(() => normalizeSteps({ 0: { name: 'a' } }), TypeError);
  assert.throws(() => normalizeSteps([null]), TypeError);
  assert.throws(() => normalizeSteps([['a']]), TypeError);
  assert.throws(() => normalizeSteps([{ title: 'No name' }]), TypeError);
  assert.throws(() => normalizeSteps([{ name: '', title: 'Empty' }]), TypeError);
  assert.throws(() => normalizeSteps([{ name: 3, title: 'Numeric' }]), TypeError);
});

test('normalizeSteps rejects duplicate names', () => {
  assert.throws(
    () => normalizeSteps([{ name: 'a' }, { name: 'b' }, { name: 'a' }]),
    /Step already exists: a/
  );
});

test('stepIndex finds names and reports misses as -1', () => {
  const steps = rail({ name: 'a' }, { name: 'b' }, { name: 'c' });
  assert.equal(stepIndex(steps, 'a'), 0);
  assert.equal(stepIndex(steps, 'c'), 2);
  assert.equal(stepIndex(steps, 'missing'), -1);
  assert.equal(stepIndex(steps, null), -1);
  assert.equal(stepIndex([], 'a'), -1);
});

test('resolveStepIndex walks in from either end when starting outside the list', () => {
  const steps = rail({ name: 'a' }, { name: 'b' }, { name: 'c' });
  assert.equal(resolveStepIndex(steps, -1, 1), 0);
  assert.equal(resolveStepIndex(steps, -1, -1), 2);
  assert.equal(resolveStepIndex([], -1, 1), -1);
});

test('resolveStepIndex skips disabled steps in both directions', () => {
  const steps = rail(
    { name: 'a' },
    { name: 'b', disabled: true },
    { name: 'c', disabled: true },
    { name: 'd' }
  );
  assert.equal(resolveStepIndex(steps, 0, 1), 3);
  assert.equal(resolveStepIndex(steps, 3, -1), 0);
  assert.equal(resolveStepIndex(steps, 1, 1), 3);
  assert.equal(resolveStepIndex(steps, 2, -1), 0);
});

test('resolveStepIndex reports -1 when no enabled step lies that way', () => {
  const steps = rail({ name: 'a' }, { name: 'b', disabled: true });
  assert.equal(resolveStepIndex(steps, 0, 1), -1);
  assert.equal(resolveStepIndex(steps, 0, -1), -1);
  assert.equal(resolveStepIndex(rail({ name: 'a', disabled: true }), -1, 1), -1);
});

test('resolveStepIndex treats any positive or negative number as a direction', () => {
  const steps = rail({ name: 'a' }, { name: 'b' }, { name: 'c' });
  assert.equal(resolveStepIndex(steps, 0, 5), 1);
  assert.equal(resolveStepIndex(steps, 2, -5), 1);
  // Zero is not a backwards move, so it reads as "forward".
  assert.equal(resolveStepIndex(steps, 0, 0), 1);
});

test('completedByAdvance completes every step a forward move passed', () => {
  const steps = rail({ name: 'a' }, { name: 'b' }, { name: 'c' }, { name: 'd' });
  assert.deepEqual(completedByAdvance(steps, 0, 1), ['a']);
  assert.deepEqual(completedByAdvance(steps, 0, 3), ['a', 'b', 'c']);
  assert.deepEqual(completedByAdvance(steps, 2, 3), ['c']);
});

test('completedByAdvance completes nothing when standing still or going back', () => {
  const steps = rail({ name: 'a' }, { name: 'b' }, { name: 'c' });
  assert.deepEqual(completedByAdvance(steps, 2, 2), []);
  assert.deepEqual(completedByAdvance(steps, 2, 0), []);
  // The first activation has nothing behind it to complete.
  assert.deepEqual(completedByAdvance(steps, -1, 2), []);
});

test('stepState ranks error over active over complete over upcoming', () => {
  const [step] = rail({ name: 'a' });
  const errored = ['a'];
  const completed = ['a'];
  assert.equal(stepState(step, 0, { activeIndex: 0, completed, errored }), 'error');
  assert.equal(stepState(step, 0, { activeIndex: 0, completed }), 'active');
  assert.equal(stepState(step, 0, { activeIndex: 1, completed }), 'complete');
  assert.equal(stepState(step, 0, { activeIndex: 1 }), 'upcoming');
  assert.equal(stepState(step, 0), 'upcoming');
});

test('stepState accepts sets and arrays alike', () => {
  const [step] = rail({ name: 'a' });
  assert.equal(stepState(step, 1, { completed: new Set(['a']) }), 'complete');
  assert.equal(stepState(step, 1, { errored: new Set(['a']) }), 'error');
  assert.equal(stepState(step, 1, { completed: new Set(['b']) }), 'upcoming');
});
