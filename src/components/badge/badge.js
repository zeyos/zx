import { h } from '../../core/dom.js';
import { icon as createIcon } from '../../core/icons.js';

/**
 * @typedef {Object} BadgeOptions
 * @property {string} [label=''] Visible badge text.
 * @property {string|null} [icon=null] Icon name from `icons.js`, rendered before the label.
 * @property {'neutral'|'accent'|'success'|'warning'|'danger'|'info'} [kind='neutral'] Semantic intent.
 * @property {'soft'|'solid'|'outline'} [variant='soft'] Fill treatment.
 * @property {'md'|'sm'} [size='md'] Badge size.
 * @property {boolean} [dot=false] Renders a small leading status dot instead of an icon.
 * @property {string} [title] Native title text; also names an icon-only or dot-only badge.
 */

/** Badge intents, in the order they are documented. */
const KINDS = Object.freeze(['neutral', 'accent', 'success', 'warning', 'danger', 'info']);

/** Fill treatments. */
const VARIANTS = Object.freeze(['soft', 'solid', 'outline']);

/** @type {Readonly<BadgeOptions>} */
const defaults = Object.freeze({
  label: '',
  icon: null,
  kind: 'neutral',
  variant: 'soft',
  size: 'md',
  dot: false
});

/**
 * Creates a status pill: a small, non-interactive label carrying a semantic colour.
 *
 * The badge is plain text content, so it needs no ARIA of its own. A badge without a label but
 * with a `title` is named for assistive technology through `role="img"`.
 *
 * @param {BadgeOptions} [opts={}] Badge options.
 * @returns {HTMLSpanElement}
 */
export function badge(opts = {}) {
  const options = { ...defaults, ...opts };
  const element = /** @type {HTMLSpanElement} */ (h('span', {
    class: 'zx-badge',
    title: options.title,
    dataset: {
      kind: normalizeKind(options.kind),
      variant: normalizeVariant(options.variant),
      size: normalizeSize(options.size)
    }
  }));

  if (options.dot) {
    element.append(h('span', { class: 'zx-badge__dot', ariaHidden: 'true' }));
  } else if (options.icon) {
    element.append(createIcon(options.icon, { size: 12, class: 'zx-badge__icon' }));
  }
  if (options.label !== '' && options.label != null) {
    element.append(h('span', { class: 'zx-badge__label' }, String(options.label)));
  } else if (options.title) {
    element.setAttribute('role', 'img');
    element.setAttribute('aria-label', options.title);
  }
  return element;
}

/**
 * Groups badges into a wrapping row.
 * @param {HTMLSpanElement[]} badges Badges to group.
 * @returns {HTMLSpanElement}
 */
export function badgeGroup(badges) {
  const group = /** @type {HTMLSpanElement} */ (h('span', { class: 'zx-badge-group' }));
  group.append(...badges);
  return group;
}

/** @param {unknown} value @returns {'neutral'|'accent'|'success'|'warning'|'danger'|'info'} */
function normalizeKind(value) {
  return KINDS.includes(/** @type {string} */ (value)) ?
    /** @type {'neutral'|'accent'|'success'|'warning'|'danger'|'info'} */ (value) : 'neutral';
}

/** @param {unknown} value @returns {'soft'|'solid'|'outline'} */
function normalizeVariant(value) {
  return VARIANTS.includes(/** @type {string} */ (value)) ?
    /** @type {'soft'|'solid'|'outline'} */ (value) : 'soft';
}

/** @param {unknown} value @returns {'md'|'sm'} */
function normalizeSize(value) {
  return value === 'sm' ? 'sm' : 'md';
}
