import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MAX_FRAME_MS, normalizePhase, presenceOffset, presencePeriod, presencePhase, presencePose, trackPresence
} from '../../src/internal/presence-loop.js';

const REST = { y: 0, r: 0, s: 1, w: 0, blink: 0 };

/** Samples a pose over two minutes, ten times a second. @param {string} activity */
function samples(activity) {
  return Array.from({ length: 1200 }, (_, index) => presencePose(activity, index / 10));
}

test('offline, blocked, and anything unknown stay at rest', () => {
  for (const activity of ['offline', 'blocked', 'dancing', '', null, undefined]) {
    for (const t of [0, 0.4, 1.7, 12.3, 600]) {
      assert.deepEqual(presencePose(activity, t), REST, `${String(activity)} at ${t}s`);
    }
  }
});

test('every pose stays within a few pixels and degrees of rest', () => {
  for (const activity of ['idle', 'thinking', 'working', 'needs-you']) {
    for (const pose of samples(activity)) {
      assert.ok(Math.abs(pose.y) <= 2, `${activity} y ${pose.y}`);
      assert.ok(Math.abs(pose.r) <= 9, `${activity} r ${pose.r}`);
      assert.ok(pose.s >= 1 && pose.s <= 1.05, `${activity} s ${pose.s}`);
      assert.ok(pose.blink >= 0 && pose.blink <= 0.28, `${activity} blink ${pose.blink}`);
      assert.ok(pose.w === 0 || pose.w === 1, `${activity} w ${pose.w}`);
    }
  }
});

test('each moving activity moves the way it is meant to', () => {
  const moves = (activity, key) => new Set(samples(activity).map((pose) => pose[key].toFixed(3))).size > 1;
  assert.ok(moves('idle', 's') && !moves('idle', 'y') && !moves('idle', 'r'), 'idle breathes');
  assert.ok(moves('thinking', 'r') && !moves('thinking', 'y'), 'thinking sways');
  assert.ok(moves('working', 'y') && !moves('working', 'r'), 'working bobs');
  assert.ok(moves('needs-you', 'r'), 'needs-you leans');
});

test('needs-you blinks briefly once a cycle and is otherwise open-eyed', () => {
  assert.ok(Math.abs(presencePose('needs-you', 0.09).blink - 0.28) < 1e-9, 'the blink peaks mid-beat');
  assert.equal(presencePose('needs-you', 1).blink, 0);
  assert.equal(presencePose('needs-you', 3).blink, 0);
  assert.ok(presencePose('needs-you', 3.6 + 0.09).blink > 0.27, 'the blink repeats every 3.6 s');
  const closed = samples('needs-you').filter((pose) => pose.blink > 0).length;
  assert.ok(closed > 0 && closed < 120, `blinking ${closed} of 1200 samples`);
  assert.equal(presencePose('needs-you', 1).w, 1);
  assert.equal(presencePose('working', 1).w, 0);
});

test('a pose is a pure function of activity and time', () => {
  assert.deepEqual(presencePose('thinking', 2.5), presencePose('thinking', 2.5));
  assert.deepEqual(presencePose('working', Number.NaN), presencePose('working', 0));
  assert.ok(MAX_FRAME_MS > 0 && MAX_FRAME_MS <= 100);
});

test('a phase is stable per key and falls within one cycle', () => {
  assert.equal(presencePhase('Finance agent'), presencePhase('Finance agent'));
  for (const key of ['', 'a', 'Finance agent', 'Research', '山田', null]) {
    const phase = presencePhase(key);
    assert.ok(phase >= 0 && phase < 1, `${String(key)} → ${phase}`);
  }
  assert.notEqual(presencePhase('Finance agent'), presencePhase('Research agent'));
});

test('a given phase wraps into one cycle, and anything else is no phase', () => {
  assert.equal(normalizePhase(0), 0);
  assert.equal(normalizePhase(0.5), 0.5);
  assert.equal(normalizePhase(1), 0);
  assert.equal(normalizePhase(1.25), 0.25);
  assert.equal(normalizePhase(-0.25), 0.75);
  for (const value of [null, undefined, Number.NaN, Number.POSITIVE_INFINITY, '0.5', {}]) {
    assert.equal(normalizePhase(value), null, String(value));
  }
});

test('a phase is a fraction of the cycle of each activity', () => {
  for (const activity of ['idle', 'thinking', 'working', 'needs-you']) {
    const period = presencePeriod(activity);
    assert.ok(period > 0, activity);
    assert.equal(presenceOffset(activity, 0), 0);
    assert.ok(Math.abs(presenceOffset(activity, 0.5) - period / 2) < 1e-9, `${activity} half a cycle`);
    assert.ok(Math.abs(presenceOffset(activity, 1.5) - period / 2) < 1e-9, `${activity} wraps`);
    // A whole cycle later the pose is the same; half a cycle later it is not.
    const t = 0.7;
    const same = presencePose(activity, t + presenceOffset(activity, 0.9999999));
    assert.ok(Math.abs(same.s - presencePose(activity, t).s) < 1e-4 && Math.abs(same.y - presencePose(activity, t).y) < 1e-4,
      `${activity} at a full turn`);
    assert.notDeepEqual(presencePose(activity, t + presenceOffset(activity, 0.5)), presencePose(activity, t),
      `${activity} at half a turn`);
  }
  for (const activity of ['blocked', 'offline', 'dancing', null]) {
    assert.equal(presencePeriod(activity), 0, String(activity));
    assert.equal(presenceOffset(activity, 0.5), 0, String(activity));
  }
  assert.equal(presenceOffset('working', null), 0, 'no phase is no offset');
});

test('without a browser, tracking is inert and never throws', () => {
  const element = { ownerDocument: {}, style: { removeProperty() {} } };
  const handle = trackPresence(/** @type {any} */ (element), 'working', { phase: 0.5 });
  assert.doesNotThrow(() => handle.set('thinking'));
  assert.doesNotThrow(() => handle.set('idle', { phase: 0.25 }));
  assert.doesNotThrow(() => handle.untrack());
  assert.doesNotThrow(() => handle.untrack());
  assert.doesNotThrow(() => trackPresence(/** @type {any} */ (null), 'idle').untrack());
});
