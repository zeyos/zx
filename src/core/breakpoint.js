/**
 * Named width thresholds, and a way to react to one being crossed.
 *
 * The scale lives here rather than in the token layer because a CSS custom property cannot be
 * used inside a media query, so a `--zx-bp-*` token would be a value no stylesheet could read.
 * Zx's own layout utilities avoid the problem entirely — `.zx-grid` reflows on intrinsic track
 * widths, not on breakpoints — which leaves this module for the cases only script can decide:
 * rendering a Table as cards below a width, collapsing a MasterPanel, choosing a chart density.
 * @module zx/core/breakpoint
 */

import { isElement } from './util.js';

/** @typedef {'xs'|'sm'|'md'|'lg'|'xl'} BreakpointName */

/**
 * Lower bound of each named breakpoint, in pixels. A width below `sm` is `xs`.
 * @type {Readonly<Record<Exclude<BreakpointName, 'xs'>, number>>}
 */
export const breakpoints = Object.freeze({ sm: 480, md: 768, lg: 1024, xl: 1280 });

/** Names from widest to narrowest, which is the order a lookup has to test them in. */
const ORDER = /** @type {const} */ (['xl', 'lg', 'md', 'sm']);

/**
 * The breakpoint a width falls into.
 * @param {number} width Width in pixels.
 * @returns {BreakpointName}
 */
export function breakpointOf(width) {
  const value = Number(width);
  if (!Number.isFinite(value)) return 'xs';
  for (const name of ORDER) {
    if (value >= breakpoints[name]) return name;
  }
  return 'xs';
}

/**
 * Whether a width has reached a named breakpoint. `matchBreakpoint('md', 900)` is the script
 * equivalent of `@media (min-width: 768px)`.
 * @param {BreakpointName} name Breakpoint to test against.
 * @param {number} width Width in pixels.
 * @returns {boolean}
 */
export function matchBreakpoint(name, width) {
  if (name === 'xs') return true;
  const min = breakpoints[name];
  if (min === undefined) throw new RangeError(`Unknown breakpoint "${name}"`);
  return Number(width) >= min;
}

/**
 * @typedef {Object} BreakpointOptions
 * @property {Element|Window} [target=window] What to measure. An Element is watched with a
 *   `ResizeObserver`, which is what a component inside a split pane or a modal needs — the
 *   viewport width says nothing about the space it actually has.
 */

/**
 * @typedef {Object} BreakpointController
 * @property {() => BreakpointName} current The breakpoint as last measured.
 * @property {() => void} destroy Stops observing.
 */

/**
 * Calls back whenever the observed width crosses into another breakpoint, and once immediately
 * with the current one.
 * @param {(name: BreakpointName, width: number) => void} handler Called on every change.
 * @param {BreakpointOptions} [options={}] What to observe.
 * @returns {BreakpointController}
 */
export function onBreakpoint(handler, options = {}) {
  if (typeof handler !== 'function') throw new TypeError('onBreakpoint requires a handler');
  /*
   * An explicitly passed target that is not an element is a mistake worth shouting about. Falling
   * back to the window looks like it works — the callback fires, the values are plausible — while
   * measuring something entirely different from what the caller asked for. Table hit exactly this:
   * it passed `this.el` before the base constructor had assigned it, and quietly watched the
   * viewport instead of itself.
   */
  if ('target' in options && !isElement(options.target) && options.target !== globalThis) {
    throw new TypeError('onBreakpoint target must be an Element or the window');
  }
  const target = options.target ?? globalThis;
  const element = isElement(target) ? /** @type {Element} */ (target) : null;
  /** Null until the first real measurement — see `update()` on why 0 is not a band. */
  let name = /** @type {BreakpointName|null} */ (null);
  let destroyed = false;
  let observer = null;

  const measure = () => (element
    ? element.getBoundingClientRect().width
    : Number(globalThis.innerWidth) || 0);

  const update = () => {
    if (destroyed) return;
    const width = measure();
    /*
     * A zero width is not the `xs` band — it is no measurement at all, which is what an element
     * that has not been laid out yet reports. Recording it as a band silently disarms the whole
     * watcher: the next real width lands in the same band and never notifies. Table hit exactly
     * this, rendering before it was inserted, measuring 0, and then sitting at 154px inside a
     * narrow pane without ever being told it should stack.
     */
    if (element && width === 0) return;
    const next = breakpointOf(width);
    if (next === name) return;
    name = next;
    handler(name, width);
  };

  update();

  /*
   * Resize notifications are answered on the next frame rather than inside the observer callback.
   * A handler that reacts to a width by changing layout — which is the entire point of this
   * module; Table restyles itself — resizes the very element being observed, and the browser
   * reports that as "ResizeObserver loop completed with undelivered notifications". Deferring
   * breaks the cycle, and coalesces a burst of notifications into one.
   */
  let frame = 0;
  const schedule = () => {
    if (frame || destroyed) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      update();
    });
  };

  if (element && typeof ResizeObserver === 'function') {
    observer = new ResizeObserver(schedule);
    observer.observe(element);
  } else {
    globalThis.addEventListener?.('resize', update, { passive: true });
  }

  return {
    current: () => name ?? breakpointOf(measure()),
    destroy: () => {
      if (destroyed) return;
      destroyed = true;
      if (frame) cancelAnimationFrame(frame);
      observer?.disconnect();
      globalThis.removeEventListener?.('resize', update);
    }
  };
}
