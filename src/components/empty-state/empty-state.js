import { h } from '../../core/dom.js';
import { icon as createIcon } from '../../core/icons.js';
import { isElement } from '../../core/util.js';
import { button } from '../button/button.js';

/** @typedef {import('../button/button.js').ButtonOptions} ButtonOptions */

/**
 * @typedef {Object} EmptyStateOptions
 * @property {string|null} [icon='folder-open'] Decorative icon name; null renders no icon.
 * @property {string} [title=''] Headline text, rendered as a paragraph so page outlines stay intact.
 * @property {string} [description=''] Supporting sentence below the headline.
 * @property {Array<Element|ButtonOptions>} [actions=[]] Buttons or button descriptors below the text.
 * @property {'md'|'sm'} [size='md'] Overall scale.
 * @property {'center'|'start'} [align='center'] Content alignment.
 */

/** Icon sizes per `size` option. */
const ICON_SIZE = Object.freeze({ md: 40, sm: 28 });

/** @type {Readonly<EmptyStateOptions>} */
const defaults = Object.freeze({
  icon: 'folder-open',
  title: '',
  description: '',
  actions: [],
  size: 'md',
  align: 'center'
});

/**
 * Creates the placeholder shown where a list, table, or panel has no content yet.
 *
 * Purely presentational: the icon is decorative, the headline is a paragraph rather than a heading
 * so dropping the element into a Table's empty slot or a Panel body never disturbs the page's
 * heading outline.
 *
 * @param {EmptyStateOptions} [opts={}] Empty-state options.
 * @returns {HTMLDivElement}
 */
export function emptyState(opts = {}) {
  const options = { ...defaults, ...opts };
  const size = normalizeSize(options.size);
  const element = /** @type {HTMLDivElement} */ (h('div', {
    class: 'zx-empty-state',
    dataset: { size, align: normalizeAlign(options.align) }
  }));

  if (options.icon) {
    element.append(h('div', { class: 'zx-empty-state__icon', ariaHidden: 'true' },
      createIcon(options.icon, { size: ICON_SIZE[size] })
    ));
  }
  if (options.title) {
    element.append(h('p', { class: 'zx-empty-state__title' }, String(options.title)));
  }
  if (options.description) {
    element.append(h('p', { class: 'zx-empty-state__description' }, String(options.description)));
  }

  const actions = buildActions(options.actions);
  if (actions.length > 0) {
    element.append(h('div', { class: 'zx-empty-state__actions' }, actions));
  }
  return element;
}

/**
 * Turns action descriptors into buttons, passing through any Element unchanged.
 * @param {Array<Element|ButtonOptions>} list Buttons or button descriptors.
 * @returns {Element[]}
 */
function buildActions(list) {
  if (!Array.isArray(list)) throw new TypeError('emptyState actions must be an array');
  return list.map((item) => {
    if (isElement(item)) return item;
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new TypeError('emptyState actions must be Elements or button descriptors');
    }
    return button(item);
  });
}

/** @param {unknown} value @returns {'md'|'sm'} */
function normalizeSize(value) {
  return value === 'sm' ? 'sm' : 'md';
}

/** @param {unknown} value @returns {'center'|'start'} */
function normalizeAlign(value) {
  return value === 'start' ? 'start' : 'center';
}
