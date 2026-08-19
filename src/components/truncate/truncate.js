import { resolveElement } from '../../core/dom.js';
import { clamp } from '../../core/util.js';

/**
 * @typedef {Object} TruncateOptions
 * @property {number} [lines=1] Lines to keep. One line ends in an ellipsis; more clamp the block.
 * @property {boolean} [title=true] Whether a native `title` tooltip is set — and kept up to date —
 *   while the text is actually cut off, so the full value stays reachable on hover.
 */

/**
 * @typedef {Object} TruncateController
 * @property {() => boolean} update Re-measures and returns whether the text is currently cut off.
 * @property {() => boolean} isTruncated Whether the text was cut off at the last measurement.
 * @property {() => void} destroy Removes the classes, the observer, and any title this set.
 */

/**
 * Clamps an element's text to a number of lines, and gives the cut-off text back on hover.
 *
 * The `title` half is what makes this more than a CSS class. A table cell that silently drops the
 * end of a value is a data-loss bug wearing a layout costume; a tooltip that is always present is
 * noise. Measuring on every resize means the tooltip appears exactly when the text is short of
 * room and disappears when the column is widened.
 *
 * @param {Element|string} target Element or selector to clamp.
 * @param {TruncateOptions} [options={}] Truncation options.
 * @returns {TruncateController}
 */
export function truncate(target, options = {}) {
  const element = resolveElement(target);
  if (!element) throw new TypeError('truncate() target could not be resolved');

  const lines = clamp(Math.trunc(Number(options.lines) || 1), 1, 10);
  const withTitle = options.title !== false;
  const hadClass = element.classList.contains('zx-truncate');
  const previousTitle = element.getAttribute('title');
  let truncated = false;
  let observer = null;

  element.classList.add('zx-truncate');
  if (lines > 1) {
    element.dataset.lines = String(lines);
    /** @type {HTMLElement} */ (element).style.setProperty('--zx-truncate-lines', String(lines));
  }

  const update = () => {
    truncated = isTruncated(element);
    if (withTitle) {
      if (truncated) element.setAttribute('title', element.textContent?.trim() ?? '');
      else if (previousTitle === null) element.removeAttribute('title');
      else element.setAttribute('title', previousTitle);
    }
    return truncated;
  };

  update();
  if (typeof ResizeObserver === 'function') {
    observer = new ResizeObserver(update);
    observer.observe(element);
  }

  return {
    update,
    isTruncated: () => truncated,
    destroy: () => {
      observer?.disconnect();
      observer = null;
      if (!hadClass) element.classList.remove('zx-truncate');
      delete element.dataset.lines;
      /** @type {HTMLElement} */ (element).style.removeProperty('--zx-truncate-lines');
      if (!withTitle) return;
      if (previousTitle === null) element.removeAttribute('title');
      else element.setAttribute('title', previousTitle);
    }
  };
}

/**
 * Whether an element's text overflows the box it is in.
 *
 * Both axes are checked because the two clamping modes overflow differently: a single line runs
 * out of width, a multi-line clamp runs out of height. The one-pixel tolerance absorbs the
 * sub-pixel difference between scroll and client sizes that fractional zoom levels produce.
 *
 * @param {Element} element Element to measure.
 * @returns {boolean}
 */
export function isTruncated(element) {
  return element.scrollWidth - element.clientWidth > 1
    || element.scrollHeight - element.clientHeight > 1;
}
