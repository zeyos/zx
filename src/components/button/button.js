import { h } from '../../core/dom.js';
import { icon as createIcon } from '../../core/icons.js';

/**
 * @typedef {Object} ButtonOptions
 * @property {string} [label=''] Visible button label.
 * @property {string|null} [icon=null] Icon name from `icons.js`.
 * @property {'default'|'primary'|'danger'|'ghost'} [kind='default'] Visual intent.
 * @property {'md'|'sm'} [size='md'] Control size.
 * @property {boolean} [disabled=false] Whether the button is disabled.
 * @property {string} [title] Native title text.
 * @property {(event: MouseEvent) => void} [onclick] Click callback.
 */

/** @type {Readonly<ButtonOptions>} */
const defaults = Object.freeze({
  label: '',
  icon: null,
  kind: 'default',
  size: 'md',
  disabled: false
});

/**
 * Creates a styled native button.
 * @param {ButtonOptions} [opts={}] Button options.
 * @returns {HTMLButtonElement}
 */
export function button(opts = {}) {
  const options = { ...defaults, ...opts };
  const element = /** @type {HTMLButtonElement} */ (h('button', {
    class: 'zx-btn',
    type: 'button',
    disabled: Boolean(options.disabled),
    title: options.title,
    dataset: {
      kind: normalizeKind(options.kind),
      size: normalizeSize(options.size)
    }
  }));

  if (options.icon) {
    element.append(createIcon(options.icon, { size: 16 }));
  }
  if (options.label !== '') {
    element.append(h('span', { class: 'zx-btn__label' }, String(options.label)));
  }
  if (!options.label && options.title) element.setAttribute('aria-label', options.title);
  if (typeof options.onclick === 'function') element.onclick = options.onclick;
  return element;
}

/**
 * Groups buttons into a joined control.
 * @param {HTMLButtonElement[]} buttons Buttons to group.
 * @returns {HTMLDivElement}
 */
export function buttonGroup(buttons) {
  const group = /** @type {HTMLDivElement} */ (h('div', {
    class: 'zx-btn-group',
    role: 'group'
  }));
  group.append(...buttons);
  return group;
}

/** @param {unknown} value @returns {'default'|'primary'|'danger'|'ghost'} */
function normalizeKind(value) {
  return ['primary', 'danger', 'ghost'].includes(String(value)) ?
    /** @type {'primary'|'danger'|'ghost'} */ (value) : 'default';
}

/** @param {unknown} value @returns {'md'|'sm'} */
function normalizeSize(value) {
  return value === 'sm' ? 'sm' : 'md';
}
