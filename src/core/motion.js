// @ts-check
/**
 * Motion as a setting, for the code that animates in script.
 *
 * CSS motion needs nothing from here: `tokens/global.css` sets every `--zx-dur-*` to 0ms and
 * `base.css` stops animations and transitions both under the operating system's reduced-motion
 * preference and inside any `data-zx-motion="reduced"` region. A chart engine's own tweening, a
 * `requestAnimationFrame` loop, or `element.animate()` never sees those rules, so a component that
 * moves things itself asks `prefersReducedMotion()` before it starts and `watchMotion()` for the
 * moment the answer changes.
 *
 * There is no "full motion" value: a region can only ask for less. Someone who asked their system
 * for reduced motion gets it whatever an application or a region says.
 * @module zx/core/motion
 */

/** The attribute that marks a reduced-motion region. Its one meaningful value is `reduced`. */
export const MOTION_ATTRIBUTE = 'data-zx-motion';

const REDUCED_REGION = '[data-zx-motion="reduced"]';
const REDUCED_QUERY = '(prefers-reduced-motion: reduce)';

/**
 * Whether motion should stop where `element` is: true under the operating system's reduced-motion
 * preference, or when the element sits inside a `data-zx-motion="reduced"` region (the element
 * itself included). The region check crosses shadow-root boundaries.
 * @param {Element|null} [element] Where the motion would happen. Omitted, the document root is
 *   asked — which answers for an application that sets the attribute on `<html>`.
 * @returns {boolean}
 */
export function prefersReducedMotion(element) {
  if (systemPrefersReducedMotion()) return true;
  const target = element ?? globalThis.document?.documentElement ?? null;
  return inReducedRegion(target);
}

/**
 * @typedef {Object} WatchMotionOptions
 * @property {AbortSignal} [signal] Stops watching when aborted, exactly as calling the returned
 *   disposer does. A signal that is already aborted watches nothing.
 * @property {boolean} [immediate=false] Also calls back once, synchronously, with the current
 *   answer — convenient for a loop that starts or stays stopped in the same callback.
 */

/**
 * Calls back whenever `prefersReducedMotion(element)` changes: when the operating-system preference
 * flips, or when a `data-zx-motion` attribute is set, changed, or removed on the element or any
 * ancestor (in the document, or in the shadow root the element lives in). The callback receives
 * the new answer and runs only on a real change.
 *
 * Moving the element into or out of a reduced region is not observed — ask
 * `prefersReducedMotion()` again after re-parenting.
 * @param {Element|null} element Where the motion happens. Null watches the document root.
 * @param {(reduced: boolean) => void} fn Receives `true` when motion must stop, `false` when it may
 *   run again.
 * @param {WatchMotionOptions} [options={}]
 * @returns {() => void} Disposer: stops watching. Safe to call more than once.
 */
export function watchMotion(element, fn, options = {}) {
  if (typeof fn !== 'function') throw new TypeError('watchMotion requires a callback');
  const { signal, immediate = false } = options;
  if (signal?.aborted) return () => {};

  let current = prefersReducedMotion(element);
  let stopped = false;

  const check = () => {
    if (stopped) return;
    const next = prefersReducedMotion(element);
    if (next === current) return;
    current = next;
    fn(next);
  };

  const media = typeof globalThis.matchMedia === 'function' ? globalThis.matchMedia(REDUCED_QUERY) : null;
  media?.addEventListener?.('change', check);

  // One observer over every tree the element's ancestry passes through: the document, and each
  // shadow root on the way up. The attribute filter keeps it to the one attribute that matters.
  const observer = typeof MutationObserver === 'function' ? new MutationObserver(check) : null;
  if (observer) {
    for (const root of treesAbove(element)) {
      observer.observe(root, { attributes: true, attributeFilter: [MOTION_ATTRIBUTE], subtree: true });
    }
  }

  const stop = () => {
    if (stopped) return;
    stopped = true;
    media?.removeEventListener?.('change', check);
    observer?.disconnect();
    signal?.removeEventListener('abort', stop);
  };
  signal?.addEventListener('abort', stop, { once: true });

  if (immediate) fn(current);
  return stop;
}

/** @returns {boolean} Whether the operating system asks for reduced motion. */
function systemPrefersReducedMotion() {
  return typeof globalThis.matchMedia === 'function' && globalThis.matchMedia(REDUCED_QUERY).matches;
}

/**
 * @param {Element|null} element
 * @returns {boolean} Whether the element is inside a reduced region, across shadow boundaries.
 */
function inReducedRegion(element) {
  /** @type {Element|null} */
  let node = element;
  while (node && typeof node.closest === 'function') {
    if (node.closest(REDUCED_REGION)) return true;
    const root = node.getRootNode?.();
    node = isShadowRoot(root) ? root.host : null;
  }
  return false;
}

/**
 * The trees a region attribute could be set in: the shadow roots on the element's way up, and the
 * document element.
 * @param {Element|null} element
 * @returns {Node[]}
 */
function treesAbove(element) {
  const trees = [];
  /** @type {Element|null} */
  let node = element;
  while (node && typeof node.getRootNode === 'function') {
    const root = node.getRootNode();
    if (!isShadowRoot(root)) break;
    trees.push(root);
    node = root.host;
  }
  const documentElement = (element?.ownerDocument ?? globalThis.document)?.documentElement;
  if (documentElement) trees.push(documentElement);
  return trees;
}

/**
 * @param {unknown} node
 * @returns {node is ShadowRoot}
 */
function isShadowRoot(node) {
  return Boolean(node) && /** @type {Node} */ (node).nodeType === 11 && 'host' in /** @type {object} */ (node);
}
