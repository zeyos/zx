import assert from 'node:assert/strict';
import test from 'node:test';

import { Timebox, joinTime, splitTime } from '../../src/components/timebox/timebox.js';

test('Timebox splits and joins a duration across unlimited hours', () => {
  assert.deepEqual(splitTime(125, 'minutes'), { hours: 2, minutes: 5, seconds: 0, negative: false });
  assert.equal(joinTime({ hours: 2, minutes: 5 }, 'minutes'), 125);
  assert.equal(joinTime({ hours: 1, negative: true }, 'seconds'), -3600);
});

/*
 * Every other input has focus(); the timebox's goes to the hours segment, the first one a duration
 * is typed into, ahead of the sign toggle a signed timebox puts before it. A prototype probe with
 * stand-in segments drives it without a DOM.
 */
test('Timebox.focus() focuses the hours segment and returns the timebox', () => {
  const focused = [];
  const segment = (name) => ({ name, focus() { focused.push(name); } });
  const timebox = Object.create(Timebox.prototype);
  timebox._inputs = [segment('hours'), segment('minutes'), segment('seconds')];
  assert.equal(timebox.focus(), timebox);
  assert.deepEqual(focused, ['hours']);
});

test('Timebox.focus() without segments is a no-op that still chains', () => {
  const timebox = Object.create(Timebox.prototype);
  timebox._inputs = [];
  assert.equal(timebox.focus(), timebox);
});
