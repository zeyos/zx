// @ts-check
import { clamp, uid } from './util.js';

const PLACEMENTS = new Set([
  'bottom-start', 'bottom-end', 'top-start', 'top-end', 'bottom', 'top',
  'right-start', 'right-end', 'left-start', 'left-end', 'right', 'left'
]);

/** @typedef {'bottom-start'|'bottom-end'|'top-start'|'top-end'|'bottom'|'top'|'right-start'|'right-end'|'left-start'|'left-end'|'right'|'left'} Placement */

/**
 * @typedef {Object} PositionOptions
 * @property {'bottom-start'|'bottom-end'|'top-start'|'top-end'|'bottom'|'top'|'right-start'|'right-end'|'left-start'|'left-end'|'right'|'left'} [placement='bottom-start']
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
    const area = positionArea(placement, getComputedStyle(anchor).direction === 'rtl');
    floating.style.setProperty('position-area', area);
    floating.style.setProperty('inset-area', area);
    floating.style.setProperty(
      'position-try-fallbacks',
      flip ? 'flip-block, flip-inline, flip-block flip-inline' : 'none'
    );
    const margin = placement.startsWith('top') ? 'margin-bottom'
      : placement.startsWith('bottom') ? 'margin-top'
        : placement.startsWith('left') ? 'margin-right' : 'margin-left';
    floating.style.setProperty(margin, `${offset}px`);
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

/** @param {string} placement @param {boolean} rtl @returns {string} */
function positionArea(placement, rtl) {
  return {
    'bottom-start': rtl ? 'bottom span-left' : 'bottom span-right',
    'bottom-end': rtl ? 'bottom span-right' : 'bottom span-left',
    'top-start': rtl ? 'top span-left' : 'top span-right',
    'top-end': rtl ? 'top span-right' : 'top span-left',
    'right-start': 'right span-bottom',
    'right-end': 'right span-top',
    'left-start': 'left span-bottom',
    'left-end': 'left span-top',
    bottom: 'bottom',
    top: 'top',
    right: 'right',
    left: 'left'
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
  const side = placementSide(placement);
  const bottomY = anchorRect.bottom + offset;
  const topY = anchorRect.top - offset - floatingRect.height;
  const rightX = anchorRect.right + offset;
  const leftX = anchorRect.left - offset - floatingRect.width;

  if (flip) {
    if (side === 'bottom' && bottomY + floatingRect.height > viewportHeight && topY >= 0) {
      actualPlacement = flipPlacement(placement, 'bottom', 'top');
    } else if (side === 'top' && topY < 0 && bottomY + floatingRect.height <= viewportHeight) {
      actualPlacement = flipPlacement(placement, 'top', 'bottom');
    } else if (side === 'right' && rightX + floatingRect.width > viewportWidth && leftX >= 0) {
      actualPlacement = flipPlacement(placement, 'right', 'left');
    } else if (side === 'left' && leftX < 0 && rightX + floatingRect.width <= viewportWidth) {
      actualPlacement = flipPlacement(placement, 'left', 'right');
    }
  }

  const actualSide = placementSide(actualPlacement);
  let left;
  let top;
  if (actualSide === 'bottom' || actualSide === 'top') {
    const rtl = getComputedStyle(anchor).direction === 'rtl';
    if (actualPlacement.endsWith('-end')) {
      left = rtl ? anchorRect.left : anchorRect.right - floatingRect.width;
    } else if (actualPlacement.endsWith('-start')) {
      left = rtl ? anchorRect.right - floatingRect.width : anchorRect.left;
    } else left = anchorRect.left + (anchorRect.width - floatingRect.width) / 2;
    top = actualSide === 'bottom' ? bottomY : topY;
  } else {
    left = actualSide === 'right' ? rightX : leftX;
    if (actualPlacement.endsWith('-end')) top = anchorRect.bottom - floatingRect.height;
    else if (actualPlacement.endsWith('-start')) top = anchorRect.top;
    else top = anchorRect.top + (anchorRect.height - floatingRect.height) / 2;
  }
  floating.style.left = `${Math.round(clamp(left, 0, Math.max(0, viewportWidth - floatingRect.width)))}px`;
  floating.style.top = `${Math.round(clamp(top, 0, Math.max(0, viewportHeight - floatingRect.height)))}px`;
}

/** @param {string} placement @returns {'top'|'bottom'|'left'|'right'} */
function placementSide(placement) {
  return /** @type {'top'|'bottom'|'left'|'right'} */ (placement.split('-')[0]);
}

/**
 * @param {string} placement
 * @param {'top'|'bottom'|'left'|'right'} from
 * @param {'top'|'bottom'|'left'|'right'} to
 * @returns {Placement}
 */
function flipPlacement(placement, from, to) {
  return /** @type {Placement} */ (placement.replace(from, to));
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
