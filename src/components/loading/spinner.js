import { h } from '../../core/dom.js';

/**
 * @typedef {Object} SpinnerOptions
 * @property {'sm'|'md'|'lg'} [size='md'] Ring diameter: 16px, 24px, or 40px.
 * @property {string} [label=''] Accessible name. Empty renders a decorative ring that assistive
 *   technology skips — correct whenever a nearby element already announces the wait.
 * @property {boolean} [showLabel=false] Whether the label is also drawn beside the ring.
 * @property {'accent'|'current'} [kind='accent'] Ring colour: the accent token, or `currentColor`
 *   so the ring inherits the colour of the button or badge it sits in.
 */

/** @type {Readonly<SpinnerOptions>} */
const defaults = Object.freeze({
  size: 'md',
  label: '',
  showLabel: false,
  kind: 'accent'
});

const SIZES = Object.freeze({ sm: true, md: true, lg: true });

/**
 * Creates an indeterminate activity ring for a wait whose duration is unknown.
 *
 * Presentational and stateless: there is nothing to update and nothing to destroy, so this is a
 * factory rather than a component. Use `ProgressBar` when the share of work done is known, and
 * `InlineLoading` when the wait resolves into a success or error message in place.
 *
 * A spinner with a `label` announces itself through `role="status"`; without one it is marked
 * `aria-hidden`, which is what a ring inside an already-labelled button wants.
 *
 * @param {SpinnerOptions} [opts={}] Spinner options.
 * @returns {HTMLSpanElement}
 */
export function spinner(opts = {}) {
  const options = { ...defaults, ...opts };
  const label = String(options.label ?? '');
  const element = /** @type {HTMLSpanElement} */ (h('span', {
    class: 'zx-spinner',
    dataset: {
      size: SIZES[options.size] ? options.size : 'md',
      kind: options.kind === 'current' ? 'current' : 'accent'
    }
  }, h('span', { class: 'zx-spinner__ring', ariaHidden: 'true' })));

  if (label) {
    element.setAttribute('role', 'status');
    element.append(h('span', {
      class: 'zx-spinner__label',
      dataset: { visible: options.showLabel ? 'true' : null }
    }, label));
  } else {
    element.setAttribute('aria-hidden', 'true');
  }
  return element;
}
