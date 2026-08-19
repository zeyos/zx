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
  const target = options.target ?? globalThis;
  const element = target instanceof Element ? target : null;
  let name = /** @type {BreakpointName} */ ('xs');
  let destroyed = false;
  let observer = null;

  const measure = () => (element
    ? element.getBoundingClientRect().width
    : Number(globalThis.innerWidth) || 0);

  const update = () => {
    if (destroyed) return;
    const width = measure();
    const next = breakpointOf(width);
    if (next === name) return;
    name = next;
    handler(name, width);
  };

  name = breakpointOf(measure());
  handler(name, measure());

  if (element && typeof ResizeObserver === 'function') {
    observer = new ResizeObserver(update);
    observer.observe(element);
  } else {
    globalThis.addEventListener?.('resize', update, { passive: true });
  }

  return {
    current: () => name,
    destroy: () => {
      if (destroyed) return;
      destroyed = true;
      observer?.disconnect();
      globalThis.removeEventListener?.('resize', update);
    }
  };
}
