import { h } from '../../core/dom.js';
import { icon as createIcon } from '../../core/icons.js';

/**
 * A categorical tone from the design system's tone palette (`--zx-color-tone-*`).
 * @typedef {'blue'|'teal'|'green'|'amber'|'orange'|'red'|'pink'|'violet'|'slate'} BadgeTone
 */

/**
 * @typedef {Object} BadgeOptions
 * @property {string} [label=''] Visible badge text.
 * @property {string|null} [icon=null] Icon name from `icons.js`, rendered before the label.
 * @property {'neutral'|'accent'|'success'|'warning'|'danger'|'info'} [kind='neutral'] Semantic intent.
 * @property {BadgeTone|null} [tone=null] Categorical colour — a project, a label, a module — from
 * the tone palette rather than the status set, so a tag never reads as a warning. When set it
 * decides the colour and `kind` is ignored for it; `variant` still applies. Unknown names are
 * ignored.
 * @property {'soft'|'solid'|'outline'} [variant='soft'] Fill treatment.
 * @property {'md'|'sm'} [size='md'] Badge size.
 * @property {boolean} [dot=false] Renders a small leading status dot instead of an icon.
 * @property {string} [title] Native title text; also names an icon-only or dot-only badge.
 */

/** Badge intents, in the order they are documented. */
const KINDS = Object.freeze(['neutral', 'accent', 'success', 'warning', 'danger', 'info']);

/** Fill treatments. */
const VARIANTS = Object.freeze(['soft', 'solid', 'outline']);

/**
 * Categorical tones, in the order they are documented.
 * @type {ReadonlyArray<BadgeTone>}
 */
export const BADGE_TONES = Object.freeze(['blue', 'teal', 'green', 'amber', 'orange', 'red', 'pink', 'violet', 'slate']);

/** @type {Readonly<BadgeOptions>} */
const defaults = Object.freeze({
  label: '',
  icon: null,
  kind: 'neutral',
  tone: null,
  variant: 'soft',
  size: 'md',
  dot: false
});

/**
 * Creates a status pill: a small, non-interactive label carrying a semantic colour — or, with
 * `tone`, a categorical one.
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
      size: normalizeSize(options.size),
      tone: normalizeBadgeTone(options.tone) ?? undefined
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

/**
 * Resolves a categorical tone name, or null for anything outside the palette.
 * @param {unknown} value Requested tone.
 * @returns {BadgeTone|null}
 */
export function normalizeBadgeTone(value) {
  return BADGE_TONES.includes(/** @type {BadgeTone} */ (value)) ? /** @type {BadgeTone} */ (value) : null;
}

/** @param {unknown} value @returns {'md'|'sm'} */
function normalizeSize(value) {
  return value === 'sm' ? 'sm' : 'md';
}
