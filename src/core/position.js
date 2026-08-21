// @ts-check
import { clamp, uid } from './util.js';

const PLACEMENTS = new Set([
  'bottom-start', 'bottom-end', 'top-start', 'top-end', 'bottom', 'top'
]);

/**
 * @typedef {Object} PositionOptions
 * @property {'bottom-start'|'bottom-end'|'top-start'|'top-end'|'bottom'|'top'} [placement='bottom-start']
 * @property {number} [offset=4] Gap between anchor and floating element.
 * @property {boolean} [flip=true] Flip vertically when the preferred side overflows.
 * @property {boolean} [matchWidth=false] Set the floating element's minimum width to the anchor width.
 */
/**
 * @typedef {Object} PositionController
 * @property {() => void} update Recompute coordinates and matched width.
 * @property {() => void} destroy Hide and clean up positioning resources.
 */

/**
 * Anchors and opens a manual popover, using CSS anchor positioning when available.
 * @param {Element} anchor Anchor element.
 * @param {HTMLElement} floating Floating popover element.
 * @param {PositionOptions} [options={}] Positioning behavior.
 * @returns {PositionController}
 */
export function position(anchor, floating, options = {}) {
  if (!(anchor instanceof Element) || !(floating instanceof HTMLElement)) {
    throw new TypeError('position() requires an Element anchor and HTMLElement floating element');
  }
  const placement = PLACEMENTS.has(options.placement) ? options.placement : 'bottom-start';
  const offset = Number(options.offset ?? 4);
  const flip = options.flip ?? true;
  const matchWidth = options.matchWidth ?? false;
  const anchorStyle = anchor.getAttribute('style');
  const floatingStyle = floating.getAttribute('style');
  const popover = floating.getAttribute('popover');
  let destroyed = false;
  let observer = null;
  let update = () => {};
  let cleanupMode = () => {};

  floating.setAttribute('popover', 'manual');
  const supportsAnchors = typeof CSS !== 'undefined' && CSS.supports?.('anchor-name: --zx-a');
  if (supportsAnchors) {
    const anchorName = `--${uid('zx-a')}`;
    /** @type {HTMLElement} */ (anchor).style.setProperty('anchor-name', anchorName);
    floating.style.position = 'fixed';
    floating.style.inset = 'auto';
    floating.style.margin = '0';
    floating.style.setProperty('position-anchor', anchorName);
    floating.style.setProperty('position-area', positionArea(placement));
    floating.style.setProperty('inset-area', positionArea(placement));
    floating.style.setProperty(
      'position-try-fallbacks',
      flip ? 'flip-block, flip-inline, flip-block flip-inline' : 'none'
    );
    floating.style.setProperty(placement.startsWith('top') ? 'margin-block-end' : 'margin-block-start', `${offset}px`);
    update = () => {
      if (matchWidth) floating.style.minWidth = `${anchor.getBoundingClientRect().width}px`;
    };
    if (typeof ResizeObserver === 'function') {
      observer = new ResizeObserver(update);
      observer.observe(anchor);
    }
  } else {
    floating.style.position = 'fixed';
    floating.style.inset = 'auto';
    floating.style.margin = '0';
    update = () => updateFallback(anchor, floating, { placement, offset, flip, matchWidth });
    window.addEventListener('scroll', update, { capture: true, passive: true });
    window.addEventListener('resize', update, { passive: true });
    if (typeof ResizeObserver === 'function') {
      observer = new ResizeObserver(update);
      observer.observe(anchor);
    }
    cleanupMode = () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }

  showPopover(floating);
  update();

  return {
    /** Recomputes fallback coordinates and matched width. @returns {void} */
    update() {
      if (!destroyed) update();
    },

    /** Hides the popover and restores changed attributes. @returns {void} */
    destroy() {
      if (destroyed) return;
      destroyed = true;
      observer?.disconnect();
      cleanupMode();
      hidePopover(floating);
      restoreAttribute(anchor, 'style', anchorStyle);
      restoreAttribute(floating, 'style', floatingStyle);
      restoreAttribute(floating, 'popover', popover);
    }
  };
}

/** @param {string} placement @returns {string} */
function positionArea(placement) {
  return {
    'bottom-start': 'block-end span-inline-end',
    'bottom-end': 'block-end span-inline-start',
    'top-start': 'block-start span-inline-end',
    'top-end': 'block-start span-inline-start',
    bottom: 'block-end',
    top: 'block-start'
  }[placement];
}

/**
 * @param {Element} anchor
 * @param {HTMLElement} floating
 * @param {Required<PositionOptions>} options
 * @returns {void}
 */
function updateFallback(anchor, floating, { placement, offset, flip, matchWidth }) {
  const anchorRect = anchor.getBoundingClientRect();
  if (matchWidth) floating.style.minWidth = `${anchorRect.width}px`;
  const floatingRect = floating.getBoundingClientRect();
  const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
  const viewportHeight = document.documentElement.clientHeight || window.innerHeight;
  let actualPlacement = placement;
  const prefersBottom = placement.startsWith('bottom');
  const bottomY = anchorRect.bottom + offset;
  const topY = anchorRect.top - offset - floatingRect.height;

  if (flip) {
    if (prefersBottom && bottomY + floatingRect.height > viewportHeight && topY >= 0) {
      actualPlacement = /** @type {typeof placement} */ (placement.replace('bottom', 'top'));
    } else if (!prefersBottom && topY < 0 && bottomY + floatingRect.height <= viewportHeight) {
      actualPlacement = /** @type {typeof placement} */ (placement.replace('top', 'bottom'));
    }
  }

  let left;
  if (actualPlacement.endsWith('-end')) left = anchorRect.right - floatingRect.width;
  else if (actualPlacement.endsWith('-start')) left = anchorRect.left;
  else left = anchorRect.left + (anchorRect.width - floatingRect.width) / 2;
  const top = actualPlacement.startsWith('bottom') ? bottomY : topY;
  floating.style.left = `${Math.round(clamp(left, 0, Math.max(0, viewportWidth - floatingRect.width)))}px`;
  floating.style.top = `${Math.round(clamp(top, 0, Math.max(0, viewportHeight - floatingRect.height)))}px`;
}

/** @param {HTMLElement} element @returns {void} */
function showPopover(element) {
  if (typeof element.showPopover !== 'function') return;
  try {
    element.showPopover();
  } catch {
    // A disconnected, already-open, or transitioning popover cannot be shown.
  }
}

/** @param {HTMLElement} element @returns {void} */
function hidePopover(element) {
  if (typeof element.hidePopover !== 'function') return;
  try {
    element.hidePopover();
  } catch {
    // A disconnected or already-hidden popover is absent from the top layer.
  }
}

/** @param {Element} element @param {string} name @param {string|null} value @returns {void} */
function restoreAttribute(element, name, value) {
  if (value === null) element.removeAttribute(name);
  else element.setAttribute(name, value);
}
