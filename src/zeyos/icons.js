/**
 * ZeyOS module icons: the Font Awesome kit that carries them, and the two renderers built on the
 * configuration in `./modules.js`.
 * @module zx/zeyos/icons
 */

import { h, icon, loadFontAwesome } from '../index.js';
import { moduleGlyphColor, moduleInfo, normalizeModuleName } from './modules.js';

/**
 * The ZeyOS Font Awesome kit. It carries the licensed Font Awesome styles plus the custom
 * `zeyos-*` module glyphs, which render as `<i class="fa-kit fa-zeyos-notes">`.
 * @type {string}
 */
export const ZEYOS_ICON_KIT = 'https://kit.fontawesome.com/ae8320b210.js';

/**
 * Loads the ZeyOS kit and makes Font Awesome the renderer for every Zx icon. Call it once at
 * startup; repeat calls reuse the first load.
 * @param {{kit?: string, style?: string, family?: string, fixedWidth?: boolean}} [options={}]
 *   Overrides — a different kit, or a different default style such as `'duotone'`.
 * @returns {Promise<object>} Resolves with the icon configuration once the kit has loaded.
 */
export function useZeyosIcons(options = {}) {
  return loadFontAwesome({ kit: ZEYOS_ICON_KIT, ...options });
}

/**
 * @typedef {Object} ModuleIconOptions
 * @property {number|string} [size=16] Rendered size.
 * @property {string|null} [label=null] Accessible label; null marks the icon decorative.
 * @property {boolean} [standard=false] Render the stock Font Awesome fallback instead of the
 *   kit's custom glyph — for pages running on a kit without the ZeyOS icon uploads.
 * @property {string|string[]} [class] Extra class names.
 */

/**
 * Creates a module's icon. Module, entity, and API resource names are all accepted
 * (`'notes'`, `'transactions.billing'`, `'invoices'`); unknown names fall back to the ZeyOS
 * default glyph.
 * @param {string} name Module, entity, or resource name.
 * @param {ModuleIconOptions} [options={}] Display and accessibility options.
 * @returns {HTMLElement} An `<i>` element carrying the Font Awesome classes.
 */
export function moduleIcon(name, options = {}) {
  const { standard = false, ...rest } = options;
  const info = moduleInfo(name);
  return icon(standard ? `fa:${info.fa}` : `kit:${info.icon}`, rest);
}

/**
 * @typedef {Object} ModuleChipOptions
 * @property {number|string} [size=24] Chip edge length.
 * @property {number|string} [iconSize='1em'] Glyph size; `1em` is 60% of the chip edge.
 * @property {string|null} [label=null] Accessible label; null marks the chip decorative.
 * @property {boolean} [title=false] Adds the module's display name as a `title` tooltip.
 * @property {boolean} [standard=false] Use the stock Font Awesome fallback glyph.
 * @property {string} [color] Override the module colour for a server-defined fork or weblet.
 * @property {string|string[]} [class] Extra class names.
 */

/**
 * Creates a module's icon chip: the glyph on the module's identity colour, the way ZeyOS draws
 * module icons in navigation and record headers. The glyph colour is whichever of ZeyOS's two
 * foregrounds contrasts better with the background.
 * @param {string} name Module, entity, or resource name.
 * @param {ModuleChipOptions} [options={}] Display and accessibility options.
 * @returns {HTMLElement} A `<span class="zx-module-icon">` wrapping the glyph.
 */
export function moduleChip(name, options = {}) {
  const {
    size = 24, iconSize = '1em', label = null, title = false, standard = false,
    color = null
  } = options;
  const key = normalizeModuleName(name);
  const info = moduleInfo(name);
  const background = color || info.color;

  const chip = h('span', {
    class: ['zx-module-icon', options.class].flat().filter(Boolean),
    dataset: { module: key },
    style: {
      '--zx-module-color': background,
      '--zx-module-glyph': moduleGlyphColor(background),
      '--zx-module-icon-size': typeof size === 'number' ? `${size}px` : String(size)
    },
    title: title ? info.label : null
  }, moduleIcon(name, { size: iconSize, standard }));

  if (label === null) {
    chip.setAttribute('aria-hidden', 'true');
  } else {
    chip.setAttribute('role', 'img');
    chip.setAttribute('aria-label', label);
  }
  return chip;
}
