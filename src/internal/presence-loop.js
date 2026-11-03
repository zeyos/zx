// @ts-check
/**
 * The one animation loop every moving agent avatar on a page shares.
 *
 * An avatar joins with `trackPresence(element, activity)` and leaves with `untrack()`. The loop
 * lives on the avatar's document under a symbol-keyed property — never in module scope — and is
 * created with the first tracked avatar and torn down with the last. It moves only avatars on
 * screen (an `IntersectionObserver`), eases from one pose to the next when an activity changes,
 * clamps its frame step so a long frame never makes an avatar jump, and sleeps while the page is
 * hidden or nothing is moving. Under reduced motion — the system's, or a `data-zx-motion="reduced"`
 * region around an avatar, followed through `watchMotion()` — every avatar returns to rest and the
 * loop stops. It writes `transform` and nothing else.
 *
 * Motion is never the only signal: an avatar's activity is also its dot and its word.
 */
import { prefersReducedMotion, watchMotion } from '../core/motion.js';

/** @typedef {import('./agent-model.js').AgentActivity} AgentActivity */

/**
 * Where an avatar wants to be at one moment: a vertical offset in pixels, a rotation in degrees, a
 * scale, how much a blink may squash it (`w`, eased like the rest), and the blink's depth now.
 * @typedef {{y: number, r: number, s: number, w: number, blink: number}} PresencePose
 */

/**
 * @typedef {Object} PresenceHandle
 * @property {(activity: AgentActivity|string|null, options?: TrackOptions) => void} set Changes
 * what the avatar is doing, and its phase when `options.phase` is given; the loop eases it into
 * the new pose.
 * @property {() => void} untrack Leaves the loop and puts the avatar back at rest. Safe to call
 * more than once.
 */

/**
 * @typedef {Object} TrackOptions
 * @property {number} [phase=0] Where in its cycle this avatar moves, as a fraction of the cycle
 * from 0 up to 1 (whole turns wrap; anything that is not a finite number is 0). Avatars in the same
 * activity at different phases never move in step: 0.5 is half a cycle apart, whatever the
 * activity. `presencePhase(key)` derives one from a stable key.
 */

/** The longest step one frame may take, so a frame after a stall eases instead of jumping. */
export const MAX_FRAME_MS = 50;

/**
 * How long one cycle of each moving activity takes, in seconds. Needs-you counts its blink beat;
 * its lean runs on a shorter period of its own.
 */
const PERIODS = Object.freeze({ idle: 4.8, thinking: 3.4, working: 1.1, 'needs-you': 3.6 });

/** How quickly a pose follows its target: the fraction left after one second is e^-8. */
const EASE_RATE = 8;

/** The pose at rest. */
const REST = Object.freeze({ y: 0, r: 0, s: 1, w: 0, blink: 0 });

/** Where the shared loop is kept on its document. */
const LOOP = Symbol('zx.presenceLoop');

/** A handle that does nothing, for an environment the loop cannot run in. */
const INERT = Object.freeze({ set() {}, untrack() {} });

/**
 * The pose of an avatar doing `activity` at time `t`. Pure: the same input always gives the same
 * pose. Idle breathes, thinking sways, working bobs, and needs-you leans and blinks; blocked,
 * offline, and anything unknown stay at rest.
 * @param {AgentActivity|string|null|undefined} activity
 * @param {number} t Seconds.
 * @returns {PresencePose}
 */
export function presencePose(activity, t) {
  const time = Number.isFinite(t) ? t : 0;
  /** @param {number} period @returns {number} 0 → 1 → 0 over one period. */
  const cycle = (period) => 0.5 - 0.5 * Math.cos((2 * Math.PI * time) / period);
  switch (activity) {
    case 'idle': return { y: 0, r: 0, s: 1 + 0.035 * cycle(4.8), w: 0, blink: 0 };
    case 'thinking': return { y: 0, r: 4 * Math.sin((2 * Math.PI * time) / 3.4), s: 1, w: 0, blink: 0 };
    case 'working': return { y: -1.6 * cycle(1.1), r: 0, s: 1, w: 0, blink: 0 };
    case 'needs-you': {
      const beat = ((time % 3.6) + 3.6) % 3.6;
      const blink = beat < 0.18 ? Math.sin((Math.PI * beat) / 0.18) : 0;
      return { y: 0, r: -8 + Math.sin((2 * Math.PI * time) / 2.6), s: 1, w: 1, blink: 0.28 * blink };
    }
    default: return { ...REST };
  }
}

/**
 * A stable phase for a key, as a fraction of the cycle from 0 up to 1, so two avatars never move in
 * step and the same avatar always moves the same way.
 * @param {unknown} key
 * @returns {number}
 */
export function presencePhase(key) {
  let hash = 0;
  for (const char of String(key ?? '')) hash = (hash * 31 + (char.codePointAt(0) ?? 0)) % 997;
  return hash / 997;
}

/**
 * Reads a phase: a finite number wrapped into a fraction from 0 up to 1 (`1.25` is `0.25`, `-0.25`
 * is `0.75`), or null for anything else.
 * @param {unknown} phase
 * @returns {number|null}
 */
export function normalizePhase(phase) {
  if (typeof phase !== 'number' || !Number.isFinite(phase)) return null;
  const turn = phase % 1;
  return turn < 0 ? turn + 1 : turn;
}

/**
 * How long one cycle of an activity takes, in seconds; 0 for one that stays at rest.
 * @param {AgentActivity|string|null|undefined} activity
 * @returns {number}
 */
export function presencePeriod(activity) {
  return typeof activity === 'string' && Object.hasOwn(PERIODS, activity) ? PERIODS[/** @type {keyof typeof PERIODS} */ (activity)] : 0;
}

/**
 * The seconds a phase moves an avatar along its activity's cycle.
 * @param {AgentActivity|string|null|undefined} activity
 * @param {unknown} phase A fraction of the cycle; see `normalizePhase()`.
 * @returns {number}
 */
export function presenceOffset(activity, phase) {
  return (normalizePhase(phase) ?? 0) * presencePeriod(activity);
}

/**
 * Whether a pose is at rest, to within what a screen can show.
 * @param {{y: number, r: number, s: number, w: number}} pose
 * @returns {boolean}
 */
function settled(pose) {
  return Math.abs(pose.y) < 0.01 && Math.abs(pose.r) < 0.01 && Math.abs(pose.s - 1) < 0.0005 && Math.abs(pose.w) < 0.01;
}

/**
 * @typedef {Object} Entry
 * @property {string|null} activity
 * @property {number} phase A fraction of the cycle.
 * @property {{y: number, r: number, s: number, w: number}} pose
 * @property {boolean} visible
 * @property {boolean} reduced
 * @property {boolean} moved Whether the loop has written a transform it has not cleared.
 * @property {() => void} unwatch
 */

/**
 * @typedef {Object} Loop
 * @property {Document} document
 * @property {Map<HTMLElement, Entry>} entries
 * @property {IntersectionObserver} observer
 * @property {AbortController} abort
 * @property {number} frame
 * @property {number} last
 * @property {number} time
 */

/**
 * Adds an element to its document's presence loop. The element's `transform` belongs to the loop
 * while it is tracked; `untrack()` clears it. Where `requestAnimationFrame` or
 * `IntersectionObserver` is missing the handle does nothing.
 * @param {HTMLElement} element What moves: the avatar's root.
 * @param {AgentActivity|string|null} activity What the avatar is doing.
 * @param {TrackOptions} [options={}]
 * @returns {PresenceHandle}
 */
export function trackPresence(element, activity, options = {}) {
  const doc = element?.ownerDocument;
  if (!doc || typeof globalThis.requestAnimationFrame !== 'function'
    || typeof globalThis.IntersectionObserver !== 'function') return INERT;
  const loop = loopOf(doc);
  const existing = loop.entries.get(element);
  if (existing) {
    existing.activity = activity ?? null;
    if (options && Object.hasOwn(options, 'phase')) existing.phase = normalizePhase(options.phase) ?? 0;
    schedule(loop);
    return handleFor(loop, element);
  }
  /** @type {Entry} */
  const entry = {
    activity: activity ?? null,
    phase: normalizePhase(options?.phase) ?? 0,
    pose: { y: 0, r: 0, s: 1, w: 0 },
    visible: false,
    reduced: prefersReducedMotion(element),
    moved: false,
    unwatch: () => {}
  };
  loop.entries.set(element, entry);
  entry.unwatch = watchMotion(element, (reduced) => {
    entry.reduced = reduced;
    if (reduced) rest(element, entry);
    else schedule(loop);
  });
  loop.observer.observe(element);
  return handleFor(loop, element);
}

/**
 * @param {Loop} loop
 * @param {HTMLElement} element
 * @returns {PresenceHandle}
 */
function handleFor(loop, element) {
  return {
    set(activity, options) {
      const entry = loop.entries.get(element);
      if (!entry) return;
      entry.activity = activity ?? null;
      if (options && Object.hasOwn(options, 'phase')) entry.phase = normalizePhase(options.phase) ?? 0;
      schedule(loop);
    },
    untrack() {
      const entry = loop.entries.get(element);
      if (!entry) return;
      loop.entries.delete(element);
      entry.unwatch();
      loop.observer.unobserve(element);
      rest(element, entry);
      if (loop.entries.size === 0) teardown(loop);
    }
  };
}

/**
 * The document's loop, created on first use.
 * @param {Document} doc
 * @returns {Loop}
 */
function loopOf(doc) {
  const host = /** @type {Document & {[LOOP]?: Loop}} */ (doc);
  const current = host[LOOP];
  if (current) return current;
  /** @type {Loop} */
  const loop = {
    document: doc,
    entries: new Map(),
    observer: new IntersectionObserver((records) => {
      for (const record of records) {
        const entry = loop.entries.get(/** @type {HTMLElement} */ (record.target));
        if (!entry) continue;
        entry.visible = record.isIntersecting;
        // An avatar built before it was attached could not see the region it landed in.
        if (entry.visible) entry.reduced = prefersReducedMotion(record.target);
        if (entry.reduced) rest(/** @type {HTMLElement} */ (record.target), entry);
      }
      schedule(loop);
    }),
    abort: new AbortController(),
    frame: 0,
    last: 0,
    time: 0
  };
  doc.addEventListener('visibilitychange', () => {
    if (doc.hidden) cancel(loop);
    else schedule(loop);
  }, { signal: loop.abort.signal });
  host[LOOP] = loop;
  return loop;
}

/** @param {Loop} loop @returns {void} */
function teardown(loop) {
  cancel(loop);
  loop.observer.disconnect();
  loop.abort.abort();
  const host = /** @type {Document & {[LOOP]?: Loop}} */ (loop.document);
  if (host[LOOP] === loop) delete host[LOOP];
}

/** @param {Loop} loop @returns {boolean} Whether any avatar could move now. */
function runnable(loop) {
  if (loop.document.hidden) return false;
  for (const entry of loop.entries.values()) {
    if (entry.visible && !entry.reduced) return true;
  }
  return false;
}

/** Starts the loop unless it is running or has nothing to move. @param {Loop} loop @returns {void} */
function schedule(loop) {
  if (loop.frame || !runnable(loop)) return;
  loop.last = performance.now();
  loop.frame = requestAnimationFrame((now) => step(loop, now));
}

/** @param {Loop} loop @returns {void} */
function cancel(loop) {
  if (loop.frame) cancelAnimationFrame(loop.frame);
  loop.frame = 0;
}

/**
 * Puts one avatar back at rest at once.
 * @param {HTMLElement} element
 * @param {Entry} entry
 * @returns {void}
 */
function rest(element, entry) {
  entry.pose = { y: 0, r: 0, s: 1, w: 0 };
  if (entry.moved) element.style.removeProperty('transform');
  entry.moved = false;
}

/**
 * One frame: every visible avatar eases toward its pose; the loop goes on only while one moves.
 * @param {Loop} loop
 * @param {number} now
 * @returns {void}
 */
function step(loop, now) {
  loop.frame = 0;
  if (loop.document.hidden) return;
  const dt = Math.min(Math.max(now - loop.last, 0), MAX_FRAME_MS) / 1000;
  loop.last = now;
  loop.time += dt;
  const ease = 1 - Math.exp(-dt * EASE_RATE);
  let moving = false;
  for (const [element, entry] of loop.entries) {
    if (!entry.visible || entry.reduced) continue;
    const target = presencePose(entry.activity, loop.time + presenceOffset(entry.activity, entry.phase));
    const pose = entry.pose;
    pose.y += (target.y - pose.y) * ease;
    pose.r += (target.r - pose.r) * ease;
    pose.s += (target.s - pose.s) * ease;
    pose.w += (target.w - pose.w) * ease;
    if (settled(target) && settled(pose)) {
      rest(element, entry);
      continue;
    }
    moving = true;
    entry.moved = true;
    const squash = 1 - pose.w * target.blink;
    element.style.transform = `translateY(${pose.y.toFixed(2)}px) rotate(${pose.r.toFixed(2)}deg) `
      + `scale(${pose.s.toFixed(4)}, ${(pose.s * squash).toFixed(4)})`;
  }
  if (moving) loop.frame = requestAnimationFrame((next) => step(loop, next));
}
