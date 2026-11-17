import assert from 'node:assert/strict';
import test from 'node:test';

import { STEP, STEP_LARGE, dragAxis } from '../../src/core/drag-axis.js';

/*
 * The event engine behind every one-axis drag: the keyboard map, pointer capture, one `onMove` per
 * frame, telling a click from a drag, and teardown. The handle is a plain EventTarget that records
 * pointer capture; frames are queued until a test flushes them, and `getComputedStyle` reports the
 * direction a test asks for.
 */

test('dragAxis refuses to run without a handle or an onMove callback', () => {
  assert.throws(() => dragAxis(/** @type {any} */ (null), { orientation: 'horizontal', onMove() {} }), TypeError);
  assert.throws(() => dragAxis(/** @type {any} */ (new FakeHandle()), /** @type {any} */ ({ orientation: 'horizontal' })), TypeError);
  assert.throws(() => dragAxis(/** @type {any} */ (new FakeHandle()), /** @type {any} */ (undefined)), TypeError);
});

test('the arrow steps are the documented sizes', () => {
  assert.equal(STEP, 16);
  assert.equal(STEP_LARGE, 64);
});

/* ------------------------------------------------------------------------ keyboard -- */

test('a horizontal handle steps with ArrowLeft and ArrowRight, large while Shift is held', () => {
  withEnvironment(() => {
    const { handle, calls } = setup();
    assert.equal(press(handle, 'ArrowRight'), true);
    assert.equal(press(handle, 'ArrowLeft'), true);
    assert.equal(press(handle, 'ArrowRight', { shiftKey: true }), true);
    assert.equal(press(handle, 'ArrowLeft', { shiftKey: true }), true);
    assert.deepEqual(calls.step, [[1, false], [-1, false], [1, true], [-1, true]]);
  });
});

test('a horizontal handle leaves the vertical arrows to the page', () => {
  withEnvironment(() => {
    const { handle, calls } = setup();
    assert.equal(press(handle, 'ArrowUp'), false, 'ArrowUp is not prevented');
    assert.equal(press(handle, 'ArrowDown'), false, 'ArrowDown is not prevented');
    assert.equal(press(handle, 'a'), false);
    assert.deepEqual(calls.step, []);
  });
});

test('a vertical handle steps with ArrowUp and ArrowDown, ArrowDown being positive', () => {
  withEnvironment(() => {
    const { handle, calls } = setup({ orientation: 'vertical' });
    assert.equal(press(handle, 'ArrowDown'), true);
    assert.equal(press(handle, 'ArrowUp', { shiftKey: true }), true);
    assert.equal(press(handle, 'ArrowLeft'), false);
    assert.equal(press(handle, 'ArrowRight'), false);
    assert.deepEqual(calls.step, [[1, false], [-1, true]]);
  });
});

test('under rtl a horizontal handle swaps ArrowLeft and ArrowRight, so the handle follows the arrow', () => {
  withEnvironment(() => {
    const { handle, calls } = setup();
    press(handle, 'ArrowLeft');
    press(handle, 'ArrowRight');
    assert.deepEqual(calls.step, [[1, false], [-1, false]], 'ArrowLeft is towards the inline end');
  }, { direction: 'rtl' });
});

test('the direction is read at every key press, so a handle follows a dir change', () => {
  const env = { direction: 'ltr' };
  withEnvironment(() => {
    const { handle, calls } = setup();
    press(handle, 'ArrowRight');
    env.direction = 'rtl';
    press(handle, 'ArrowRight');
    assert.deepEqual(calls.step, [[1, false], [-1, false]]);
  }, env);
});

test('rtl never touches a vertical handle', () => {
  withEnvironment(() => {
    const { handle, calls } = setup({ orientation: 'vertical' });
    press(handle, 'ArrowDown');
    press(handle, 'ArrowUp');
    assert.deepEqual(calls.step, [[1, false], [-1, false]]);
    assert.equal(press(handle, 'ArrowLeft'), false);
  }, { direction: 'rtl' });
});

test('an unreadable or missing computed style reads as left to right', () => {
  withEnvironment(() => {
    const { handle, calls } = setup();
    press(handle, 'ArrowRight');
    assert.deepEqual(calls.step, [[1, false]]);
  }, { direction: 'throw' });
  withEnvironment(() => {
    const { handle, calls } = setup();
    press(handle, 'ArrowRight');
    assert.deepEqual(calls.step, [[1, false]]);
  }, { direction: 'missing' });
});

test('Home and End jump to the minimum and the maximum', () => {
  withEnvironment(() => {
    const { handle, calls } = setup();
    assert.equal(press(handle, 'Home'), true);
    assert.equal(press(handle, 'End'), true);
    assert.deepEqual(calls.jump, ['min', 'max']);
  });
});

test('Enter and Space activate the handle', () => {
  withEnvironment(() => {
    const { handle, calls } = setup();
    assert.equal(press(handle, 'Enter'), true);
    assert.equal(press(handle, ' '), true);
    assert.equal(calls.activate, 2);
  });
});

test('a key with no callback for it is left alone, not swallowed', () => {
  withEnvironment(() => {
    const moves = [];
    const handle = new FakeHandle();
    const drag = dragAxis(/** @type {any} */ (handle), { orientation: 'horizontal', onMove: (delta) => moves.push(delta) });
    for (const key of ['ArrowLeft', 'ArrowRight', 'Home', 'End', 'Enter', ' ']) {
      assert.equal(press(handle, key), false, `${JSON.stringify(key)} should not be prevented`);
    }
    assert.deepEqual(moves, []);
    drag.destroy();
  });
});

test('disabled() is consulted before every key press', () => {
  withEnvironment(() => {
    let disabled = true;
    const { handle, calls } = setup({ disabled: () => disabled });
    for (const key of ['ArrowRight', 'Home', 'Enter']) assert.equal(press(handle, key), false);
    assert.deepEqual([calls.step, calls.jump, calls.activate], [[], [], 0]);
    disabled = false;
    press(handle, 'ArrowRight');
    assert.deepEqual(calls.step, [[1, false]]);
  });
});

/* ------------------------------------------------------------------------- pointer -- */

test('pointer-down captures the pointer and starts a drag', () => {
  withEnvironment(() => {
    const { handle, drag, calls } = setup();
    assert.equal(drag.isDragging(), false);
    pointer(handle, 'pointerdown', { clientX: 100, pointerId: 7 });
    assert.equal(drag.isDragging(), true);
    assert.deepEqual(handle.captured, [7]);
    assert.equal(calls.start.length, 1, 'onStart heard the pointer-down');
    assert.equal(calls.start[0].pointerId, 7);
    assert.equal(calls.start[0].defaultPrevented, false,
      'pointer-down is not cancelled: that would suppress the double-click a reset is built on');
  });
});

test('moves within one frame are reported once, with the latest distance', () => {
  withEnvironment((env) => {
    const { handle, calls } = setup();
    pointer(handle, 'pointerdown', { clientX: 100 });
    pointer(handle, 'pointermove', { clientX: 110 });
    pointer(handle, 'pointermove', { clientX: 120 });
    pointer(handle, 'pointermove', { clientX: 130 });
    assert.equal(env.frames.size, 1, 'one frame is scheduled however often the pointer reports');
    assert.deepEqual(calls.move, [], 'nothing is written before the frame');
    env.flush();
    assert.deepEqual(calls.move, [30]);
    pointer(handle, 'pointermove', { clientX: 90 });
    env.flush();
    assert.deepEqual(calls.move, [30, -10], 'the distance is always measured from pointer-down');
  });
});

test('a vertical handle measures clientY', () => {
  withEnvironment((env) => {
    const { handle, calls } = setup({ orientation: 'vertical' });
    pointer(handle, 'pointerdown', { clientX: 0, clientY: 50 });
    pointer(handle, 'pointermove', { clientX: 400, clientY: 80 });
    env.flush();
    pointer(handle, 'pointerup', { clientX: 500, clientY: 20 });
    assert.deepEqual(calls.move, [30]);
    assert.deepEqual(calls.end, [[-30, true]]);
  });
});

test('pointer-up ends the drag, reports the final distance, and releases the capture', () => {
  withEnvironment((env) => {
    const { handle, drag, calls } = setup();
    pointer(handle, 'pointerdown', { clientX: 100, pointerId: 3 });
    pointer(handle, 'pointermove', { clientX: 140, pointerId: 3 });
    pointer(handle, 'pointerup', { clientX: 150, pointerId: 3 });
    assert.deepEqual(calls.end, [[50, true]]);
    assert.deepEqual(handle.released, [3]);
    assert.equal(drag.isDragging(), false);
    assert.equal(env.frames.size, 0, 'the pending frame was cancelled');
    env.flush();
    assert.deepEqual(calls.move, [], 'a frame pending at pointer-up never writes after the end');
  });
});

test('a press that never travelled is a click, not a drag', () => {
  withEnvironment(() => {
    const { handle, calls } = setup();
    pointer(handle, 'pointerdown', { clientX: 100 });
    pointer(handle, 'pointerup', { clientX: 100 });
    assert.deepEqual(calls.end, [[0, false]]);
    // A move event at the very same coordinate is not travel either.
    pointer(handle, 'pointerdown', { clientX: 100 });
    pointer(handle, 'pointermove', { clientX: 100 });
    pointer(handle, 'pointerup', { clientX: 100 });
    assert.deepEqual(calls.end[1], [0, false]);
  });
});

test('a drag that comes back to where it started is still a drag', () => {
  withEnvironment((env) => {
    const { handle, calls } = setup();
    pointer(handle, 'pointerdown', { clientX: 100 });
    pointer(handle, 'pointermove', { clientX: 160 });
    env.flush();
    pointer(handle, 'pointermove', { clientX: 100 });
    pointer(handle, 'pointerup', { clientX: 100 });
    assert.deepEqual(calls.end, [[0, true]], 'a zero-distance drag is told apart from a click');
  });
});

test('under rtl a horizontal drag reports logical distance: leftwards is positive', () => {
  withEnvironment((env) => {
    const { handle, calls } = setup();
    pointer(handle, 'pointerdown', { clientX: 100 });
    pointer(handle, 'pointermove', { clientX: 70 });
    env.flush();
    pointer(handle, 'pointerup', { clientX: 60 });
    assert.deepEqual(calls.move, [30]);
    assert.deepEqual(calls.end, [[40, true]]);
  }, { direction: 'rtl' });
});

test('the direction is fixed for the length of one drag', () => {
  const env = { direction: 'rtl' };
  withEnvironment((frames) => {
    const { handle, calls } = setup();
    pointer(handle, 'pointerdown', { clientX: 100 });
    env.direction = 'ltr';
    pointer(handle, 'pointermove', { clientX: 80 });
    frames.flush();
    assert.deepEqual(calls.move, [20]);
  }, env);
});

test('only the primary button starts a drag', () => {
  withEnvironment(() => {
    const { handle, drag, calls } = setup();
    pointer(handle, 'pointerdown', { clientX: 100, button: 2 });
    pointer(handle, 'pointerdown', { clientX: 100, button: 1 });
    assert.equal(drag.isDragging(), false);
    assert.deepEqual(handle.captured, []);
    assert.equal(calls.start.length, 0, 'onStart is not asked about a press that cannot drag');
  });
});

test('onStart returning false refuses the drag; any other answer lets it start', () => {
  withEnvironment(() => {
    let answer = /** @type {boolean|void} */ (false);
    const { handle, drag, calls } = setup({ onStart: () => answer });
    pointer(handle, 'pointerdown', { clientX: 100 });
    assert.equal(drag.isDragging(), false);
    assert.deepEqual(handle.captured, []);
    pointer(handle, 'pointerup', { clientX: 120 });
    assert.deepEqual(calls.end, [], 'a refused press reports no end');

    answer = undefined;
    pointer(handle, 'pointerdown', { clientX: 100 });
    assert.equal(drag.isDragging(), true);
  });
});

test('disabled() is consulted before a drag starts', () => {
  withEnvironment(() => {
    let disabled = true;
    const { handle, drag, calls } = setup({ disabled: () => disabled });
    pointer(handle, 'pointerdown', { clientX: 100 });
    assert.equal(drag.isDragging(), false);
    assert.equal(calls.start.length, 0);
    disabled = false;
    pointer(handle, 'pointerdown', { clientX: 100 });
    assert.equal(drag.isDragging(), true);
  });
});

test('another pointer neither restarts nor moves nor ends the drag in flight', () => {
  withEnvironment((env) => {
    const { handle, drag, calls } = setup();
    pointer(handle, 'pointerdown', { clientX: 100, pointerId: 1 });
    pointer(handle, 'pointerdown', { clientX: 500, pointerId: 2 });
    assert.deepEqual(handle.captured, [1], 'a second finger does not take over');
    pointer(handle, 'pointermove', { clientX: 900, pointerId: 2 });
    assert.equal(env.frames.size, 0);
    pointer(handle, 'pointerup', { clientX: 900, pointerId: 2 });
    assert.equal(drag.isDragging(), true);
    assert.deepEqual(calls.end, []);
    pointer(handle, 'pointermove', { clientX: 110, pointerId: 1 });
    pointer(handle, 'pointerup', { clientX: 110, pointerId: 1 });
    assert.deepEqual(calls.end, [[10, true]]);
  });
});

test('moves and releases without a drag in flight are ignored', () => {
  withEnvironment((env) => {
    const { handle, calls } = setup();
    pointer(handle, 'pointermove', { clientX: 100 });
    pointer(handle, 'pointerup', { clientX: 100 });
    pointer(handle, 'pointercancel', { clientX: 100 });
    assert.equal(env.frames.size, 0);
    assert.deepEqual([calls.move, calls.end, handle.released], [[], [], []]);
  });
});

test('pointercancel ends the drag the way pointer-up does and releases the capture', () => {
  withEnvironment((env) => {
    const { handle, drag, calls } = setup();
    pointer(handle, 'pointerdown', { clientX: 100, pointerId: 4 });
    pointer(handle, 'pointermove', { clientX: 125, pointerId: 4 });
    pointer(handle, 'pointercancel', { clientX: 125, pointerId: 4 });
    assert.equal(drag.isDragging(), false);
    assert.deepEqual(calls.end, [[25, true]], 'consumers still hear the end, and clean up after it');
    assert.deepEqual(handle.released, [4]);
    env.flush();
    assert.deepEqual(calls.move, []);
  });
});

test('a capture that cannot be taken or released does not break the drag', () => {
  withEnvironment(() => {
    const { handle, drag, calls } = setup();
    handle.failCapture = true;
    pointer(handle, 'pointerdown', { clientX: 100 });
    assert.equal(drag.isDragging(), true, 'the drag runs without a capture');
    pointer(handle, 'pointermove', { clientX: 130 });
    assert.doesNotThrow(() => pointer(handle, 'pointerup', { clientX: 130 }));
    assert.deepEqual(calls.end, [[30, true]]);
    assert.equal(drag.isDragging(), false);
  });
});

test('an uncaptured drag released off the handle still ends, and the next press starts a new one', () => {
  withEnvironment(() => {
    const { handle, drag, calls } = setup();
    const page = new EventTarget();
    Object.defineProperty(handle, 'ownerDocument', { value: page, configurable: true });
    handle.failCapture = true;
    pointer(handle, 'pointerdown', { clientX: 100, pointerId: 7 });
    // Without a capture, the moves and the release go to whatever is under the pointer.
    pointer(page, 'pointermove', { clientX: 150, pointerId: 7 });
    pointer(page, 'pointerup', { clientX: 150, pointerId: 7 });
    assert.equal(drag.isDragging(), false, 'the drag stayed open after a release off the handle');
    assert.deepEqual(calls.end, [[50, true]]);
    // A touch's next press has a new id; it must be able to start a drag.
    pointer(handle, 'pointerdown', { clientX: 10, pointerId: 8 });
    assert.equal(drag.isDragging(), true);
    drag.destroy();
    pointer(page, 'pointerup', { clientX: 10, pointerId: 8 });
    assert.deepEqual(calls.end, [[50, true]], 'destroy() removed the document listeners');
  });
});

/* ---------------------------------------------------------------- cancel / destroy -- */

test('cancel() ends a drag without reporting it and drops the pending frame', () => {
  withEnvironment((env) => {
    const { handle, drag, calls } = setup();
    pointer(handle, 'pointerdown', { clientX: 100, pointerId: 5 });
    pointer(handle, 'pointermove', { clientX: 140, pointerId: 5 });
    drag.cancel();
    assert.equal(drag.isDragging(), false);
    assert.deepEqual(handle.released, [5]);
    assert.equal(env.frames.size, 0);
    env.flush();
    pointer(handle, 'pointerup', { clientX: 140, pointerId: 5 });
    assert.deepEqual([calls.move, calls.end], [[], []], 'nothing is reported for a cancelled drag');

    // The handle is usable again straight away.
    pointer(handle, 'pointerdown', { clientX: 10, pointerId: 6 });
    pointer(handle, 'pointermove', { clientX: 30, pointerId: 6 });
    pointer(handle, 'pointerup', { clientX: 30, pointerId: 6 });
    assert.deepEqual(calls.end, [[20, true]]);
  });
});

test('cancel() without a drag in flight does nothing', () => {
  withEnvironment(() => {
    const { handle, drag } = setup();
    assert.doesNotThrow(() => drag.cancel());
    assert.deepEqual(handle.released, []);
  });
});

test('destroy() during a drag releases the capture, drops the frame, and removes every listener', () => {
  withEnvironment((env) => {
    const { handle, drag, calls } = setup();
    assert.ok(handle.listenerCount() > 0);
    pointer(handle, 'pointerdown', { clientX: 100, pointerId: 9 });
    pointer(handle, 'pointermove', { clientX: 150, pointerId: 9 });
    drag.destroy();
    assert.equal(drag.isDragging(), false);
    assert.deepEqual(handle.released, [9]);
    assert.equal(env.frames.size, 0);
    assert.equal(handle.listenerCount(), 0, 'no listener survives destroy()');

    env.flush();
    pointer(handle, 'pointermove', { clientX: 200, pointerId: 9 });
    pointer(handle, 'pointerup', { clientX: 200, pointerId: 9 });
    pointer(handle, 'pointerdown', { clientX: 100, pointerId: 10 });
    press(handle, 'ArrowRight');
    press(handle, 'Home');
    press(handle, 'Enter');
    assert.deepEqual([calls.move, calls.end, calls.step, calls.jump, calls.activate], [[], [], [], [], 0]);
    assert.deepEqual(handle.captured, [9]);
    assert.doesNotThrow(() => drag.destroy(), 'a second destroy() is harmless');
    assert.doesNotThrow(() => drag.cancel());
  });
});

test('two controllers on one handle tear down independently', () => {
  withEnvironment(() => {
    const first = setup();
    const handle = first.handle;
    const steps = [];
    const second = dragAxis(/** @type {any} */ (handle), {
      orientation: 'horizontal', onMove() {}, onStep: (direction) => steps.push(direction)
    });
    first.drag.destroy();
    press(handle, 'ArrowRight');
    assert.deepEqual(first.calls.step, []);
    assert.deepEqual(steps, [1]);
    second.destroy();
    assert.equal(handle.listenerCount(), 0);
  });
});

/* ------------------------------------------------------------------------- helpers -- */

/**
 * Builds a handle and a controller that records every callback.
 * @param {Partial<import('../../src/core/drag-axis.js').DragAxisOptions>} [overrides]
 */
function setup(overrides = {}) {
  const handle = new FakeHandle();
  const calls = {
    /** @type {any[]} */ start: [],
    /** @type {number[]} */ move: [],
    /** @type {[number, boolean][]} */ end: [],
    /** @type {[number, boolean][]} */ step: [],
    /** @type {string[]} */ jump: [],
    activate: 0
  };
  const drag = dragAxis(/** @type {any} */ (handle), {
    orientation: 'horizontal',
    onStart: (event) => { calls.start.push(event); },
    onMove: (delta) => { calls.move.push(delta); },
    onEnd: (delta, moved) => { calls.end.push([delta, moved]); },
    onStep: (direction, large) => { calls.step.push([direction, large]); },
    onJump: (edge) => { calls.jump.push(edge); },
    onActivate: () => { calls.activate += 1; },
    ...overrides
  });
  return { handle, drag, calls };
}

/**
 * Dispatches a key press and reports whether the handle claimed it.
 * @param {FakeHandle} handle
 * @param {string} key
 * @param {{shiftKey?: boolean}} [modifiers]
 * @returns {boolean} Whether `preventDefault()` was called.
 */
function press(handle, key, { shiftKey = false } = {}) {
  const event = Object.assign(new Event('keydown', { cancelable: true }), { key, shiftKey });
  handle.dispatchEvent(event);
  return event.defaultPrevented;
}

/**
 * Dispatches a pointer event.
 * @param {FakeHandle} handle
 * @param {string} type
 * @param {{clientX?: number, clientY?: number, pointerId?: number, button?: number}} init
 * @returns {Event}
 */
function pointer(handle, type, { clientX = 0, clientY = 0, pointerId = 1, button = 0 }) {
  const event = Object.assign(new Event(type, { cancelable: true }), { clientX, clientY, pointerId, button });
  handle.dispatchEvent(event);
  return event;
}

/**
 * Installs queued animation frames and a `getComputedStyle` reporting `options.direction` for the
 * length of `run`. `direction` may be `'throw'` or `'missing'` for a broken or absent CSSOM.
 * @param {(frames: {frames: Map<number, Function>, flush: () => void}) => void} run
 * @param {{direction?: string}} [options]
 */
function withEnvironment(run, options = {}) {
  const saved = {
    requestAnimationFrame: globalThis.requestAnimationFrame,
    cancelAnimationFrame: globalThis.cancelAnimationFrame,
    getComputedStyle: globalThis.getComputedStyle
  };
  /** @type {Map<number, Function>} */
  const frames = new Map();
  let next = 0;
  globalThis.requestAnimationFrame = /** @type {any} */ ((callback) => {
    next += 1;
    frames.set(next, callback);
    return next;
  });
  globalThis.cancelAnimationFrame = /** @type {any} */ ((id) => { frames.delete(id); });
  if (options.direction === 'missing') {
    delete globalThis.getComputedStyle;
  } else {
    globalThis.getComputedStyle = /** @type {any} */ (() => {
      if (options.direction === 'throw') throw new Error('no CSSOM here');
      return { direction: options.direction ?? 'ltr' };
    });
  }
  const flush = () => {
    const pending = [...frames.values()];
    frames.clear();
    for (const callback of pending) callback(0);
  };
  try {
    run({ frames, flush });
  } finally {
    for (const [name, value] of Object.entries(saved)) {
      if (value === undefined) delete globalThis[name];
      else globalThis[name] = value;
    }
  }
}

/** A handle: a real EventTarget, so `{ signal }` removal is the platform's, plus pointer capture. */
class FakeHandle extends EventTarget {
  constructor() {
    super();
    /** @type {number[]} */
    this.captured = [];
    /** @type {number[]} */
    this.released = [];
    this.failCapture = false;
    /** @type {Set<string>} */
    this.live = new Set();
  }

  /** Counts listeners still attached, tracking the AbortSignal each was added with. */
  listenerCount() {
    return this.live.size;
  }

  /** @param {string} type @param {any} fn @param {any} [options] */
  addEventListener(type, fn, options) {
    super.addEventListener(type, fn, options);
    const token = `${type}#${this.live.size}#${Math.random()}`;
    const signal = options && typeof options === 'object' ? options.signal : null;
    if (signal?.aborted) return;
    this.live.add(token);
    signal?.addEventListener('abort', () => this.live.delete(token), { once: true });
  }

  /** @param {number} id */
  setPointerCapture(id) {
    if (this.failCapture) throw new DOMException('No active pointer', 'NotFoundError');
    this.captured.push(id);
  }

  /** @param {number} id */
  releasePointerCapture(id) {
    if (this.failCapture) throw new DOMException('No active pointer', 'NotFoundError');
    this.released.push(id);
  }
}
