import { h } from '../../core/dom.js';
import { icon as createIcon } from '../../core/icons.js';
import { kbd } from '../kbd/kbd.js';
import { spinner } from '../loading/spinner.js';

/**
 * @typedef {{label:string,keys:string}} ButtonShortcut Visible hint and ARIA key combination; the
 *   host binds the action. `label` is drawn as keycaps by `kbd()` — a chord such as `'Mod+K'`
 *   shows the platform's glyphs — and `keys` goes to `aria-keyshortcuts` as written.
 */

/**
 * @typedef {Object} ButtonOptions
 * @property {string} [label=''] Visible button label.
 * @property {string|null} [icon=null] Icon name from `icons.js`.
 * @property {'default'|'primary'|'danger'|'ghost'} [kind='default'] Visual intent.
 * @property {'md'|'sm'} [size='md'] Control size.
 * @property {boolean} [disabled=false] Whether the button is disabled.
 * @property {boolean} [busy=false] Whether the button is working on its action — see
 *   `setButtonBusy()`.
 * @property {string} [title] Native title text.
 * @property {ButtonShortcut} [shortcut] Keyboard hint; does not register a keyboard handler.
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
    title: options.title ?? (options.shortcut ? `${options.label} (${options.shortcut.label})` : undefined),
    ariaKeyshortcuts: options.shortcut?.keys,
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
  if (options.shortcut) element.append(shortcutHint(options.shortcut.label));
  if (!options.label && options.title) element.setAttribute('aria-label', options.title);
  if (typeof options.onclick === 'function') element.onclick = options.onclick;
  if (options.busy) setButtonBusy(element, true);
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

/**
 * Marks a button as working on its action, or done. A busy button shows a spinner before its
 * label, announces `aria-busy`, and ignores activation — but stays focusable, unlike a disabled
 * one, so focus does not fall to the page while the work runs and the reader hears it finish.
 * Works on any `.zx-btn`, including one the application built itself.
 * @param {HTMLButtonElement} element
 * @param {boolean} busy
 * @returns {HTMLButtonElement} The same button.
 */
export function setButtonBusy(element, busy) {
  // One guard per button, installed on first use: a busy button swallows clicks — keyboard
  // activation included — before any of the application's own listeners see them.
  if (!element.hasAttribute('data-busy-guard')) {
    element.setAttribute('data-busy-guard', '');
    element.addEventListener('click', (event) => {
      if (element.getAttribute('aria-busy') !== 'true') return;
      event.preventDefault();
      event.stopImmediatePropagation();
    }, { capture: true });
  }
  element.querySelector(':scope > .zx-btn__spinner')?.remove();
  if (busy) {
    element.setAttribute('aria-busy', 'true');
    element.setAttribute('aria-disabled', 'true');
    const ring = spinner({ size: 'sm', kind: 'current' });
    ring.classList.add('zx-btn__spinner');
    element.prepend(ring);
  } else {
    element.removeAttribute('aria-busy');
    element.removeAttribute('aria-disabled');
  }
  return element;
}

/**
 * The visible key hint: small keycaps, hidden from assistive technology because the button
 * already announces its shortcut through `aria-keyshortcuts` and its title.
 * @param {string} label Key or chord to draw.
 * @returns {HTMLElement}
 */
function shortcutHint(label) {
  const hint = kbd(String(label), { size: 'sm' });
  hint.classList.add('zx-btn__shortcut');
  hint.setAttribute('aria-hidden', 'true');
  return hint;
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
