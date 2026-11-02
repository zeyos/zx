import { h } from '../../core/dom.js';

/**
 * @typedef {Object} KbdOptions
 * @property {'md'|'sm'} [size='md'] Keycap size; `sm` sits inside a button or a menu row.
 * @property {'neutral'|'inherit'} [tone='neutral'] `inherit` draws the keycaps in the surrounding
 * ink — on a solid primary button, a dark toast — instead of the neutral surface keycap.
 */

/** Key names that become a glyph on Apple platforms and a word elsewhere. */
const MODIFIERS = Object.freeze({
  mod: ['⌘', 'Ctrl'],
  meta: ['⌘', 'Meta'],
  cmd: ['⌘', 'Ctrl'],
  command: ['⌘', 'Ctrl'],
  ctrl: ['⌃', 'Ctrl'],
  control: ['⌃', 'Ctrl'],
  alt: ['⌥', 'Alt'],
  option: ['⌥', 'Alt'],
  shift: ['⇧', 'Shift'],
  backspace: ['⌫', 'Backspace'],
  delete: ['⌦', 'Del'],
  tab: ['⇥', 'Tab']
});

/** Key names that read the same on every platform. */
const KEYS = Object.freeze({
  enter: '↵',
  return: '↵',
  escape: 'Esc',
  esc: 'Esc',
  space: 'Space',
  arrowup: '↑',
  up: '↑',
  arrowdown: '↓',
  down: '↓',
  arrowleft: '←',
  left: '←',
  arrowright: '→',
  right: '→',
  pageup: 'PgUp',
  pagedown: 'PgDn',
  home: 'Home',
  end: 'End'
});

/** @returns {boolean} Whether the platform names its command modifier ⌘. */
function isApplePlatform() {
  const nav = globalThis.navigator;
  if (!nav) return false;
  const platform = /** @type {{userAgentData?: {platform?: string}}} */ (nav).userAgentData?.platform || nav.platform || '';
  return /mac|iphone|ipad|ios/i.test(platform);
}

/**
 * Splits a chord such as `'Mod+Shift+K'` into its keys. A literal plus is written as the last key
 * (`'Mod++'`) or on its own (`'+'`).
 * @param {string} chord
 * @returns {string[]}
 */
function splitChord(chord) {
  if (chord === '+') return ['+'];
  const keys = chord.split('+');
  if (chord.endsWith('++')) keys.splice(-2, 2, '+');
  return keys.map((key) => key.trim()).filter((key) => key !== '');
}

/**
 * The label a key is shown with: a platform glyph for a modifier or a named key, the upper-case
 * character for a letter, and anything else as written.
 * @param {string} key
 * @param {boolean} apple
 * @returns {string}
 */
function keyLabel(key, apple) {
  const name = key.toLowerCase();
  if (Object.hasOwn(MODIFIERS, name)) return MODIFIERS[name][apple ? 0 : 1];
  if (Object.hasOwn(KEYS, name)) return KEYS[name];
  return key.length === 1 ? key.toUpperCase() : key;
}

/**
 * The keycap labels `kbd()` draws for a chord or a list of keys, without building any DOM.
 * @example
 * keyLabels('Mod+Shift+K');                 // ['⌘', '⇧', 'K'] on macOS, ['Ctrl', 'Shift', 'K'] elsewhere
 * keyLabels('Mod+K', { apple: false });     // ['Ctrl', 'K']
 * @param {string|string[]} keys A chord (`'Mod+Shift+K'`) or the key labels, in order.
 * @param {{apple?: boolean}} [options] `apple` overrides the platform check.
 * @returns {string[]}
 */
export function keyLabels(keys, { apple = isApplePlatform() } = {}) {
  const list = Array.isArray(keys) ? keys.map(String) : splitChord(String(keys));
  return list.map((key) => keyLabel(key, apple));
}

/**
 * Renders a key or key combination as keycaps: one `<kbd class="zx-kbd">` holding a nested
 * `<kbd class="zx-kbd__key">` per key, which is how HTML marks up a combination. Every place that
 * shows a shortcut — a button, a menu, the launcher's hints, a shortcut sheet — uses it, so keys
 * look the same everywhere.
 *
 * The keycaps are presentation. A control that has a shortcut announces it with
 * `aria-keyshortcuts` on the control itself; mark a hint that repeats it `aria-hidden`.
 *
 * @example
 * kbd('Mod+K');               // ⌘ K on macOS, Ctrl K elsewhere
 * kbd(['g', 'h']);            // a sequence written as two caps
 * kbd('Enter', { size: 'sm' });
 * @param {string|string[]} keys A chord (`'Mod+Shift+K'`) or the key labels, in order.
 * @param {KbdOptions} [options]
 * @returns {HTMLElement}
 */
export function kbd(keys, options = {}) {
  return h('kbd', {
    class: 'zx-kbd',
    dataset: {
      size: options.size === 'sm' ? 'sm' : undefined,
      tone: options.tone === 'inherit' ? 'inherit' : undefined
    }
  }, keyLabels(keys).map((label) => h('kbd', { class: 'zx-kbd__key' }, label)));
}
