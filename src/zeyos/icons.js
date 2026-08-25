/**
 * ZeyOS module icons: the Font Awesome kit that carries them, and the two renderers built on the
 * configuration in `./modules.js`.
 * @module zx/zeyos/icons
 */

import { icon, loadFontAwesome } from '../index.js';
import { appIcon } from '../components/app-icon/app-icon.js';
import { isCssColor } from '../core/util.js';
import { moduleInfo, normalizeModuleName } from './modules.js';

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
 * @property {number|string} [iconSize='52%'] Glyph size relative to the tile edge.
 * @property {string|null} [label=null] Accessible label; null marks the chip decorative.
 * @property {boolean} [title=false] Adds the module's display name as a `title` tooltip.
 * @property {boolean} [standard=false] Use the stock Font Awesome fallback glyph.
 * @property {string|Node|(()=>string|Node)|null} [icon] Explicit glyph override, useful for an offline fallback.
 * @property {string} [color] Override the module colour for a server-defined fork or weblet.
 * @property {false|'subtle'|'strong'} [glass='subtle'] AppIcon material treatment.
 * @property {string|string[]} [class] Extra class names.
 */

/**
 * Creates a module's icon chip: the glyph on the module's identity colour, the way ZeyOS draws
 * module icons in navigation and record headers. AppIcon identity glyphs stay white across every
 * module colour; material shading and the glyph shadow preserve their silhouette on light colours.
 * @param {string} name Module, entity, or resource name.
 * @param {ModuleChipOptions} [options={}] Display and accessibility options.
 * @returns {HTMLElement} A `<span class="zx-module-icon">` wrapping the glyph.
 */
export function moduleChip(name, options = {}) {
  const {
    size = 24, iconSize = '52%', label = null, title = false, standard = false,
    color = null
  } = options;
  const key = normalizeModuleName(name);
  const info = moduleInfo(name);
  const background = isCssColor(color) ? color : info.color;

  const chip = appIcon({
    // AppIcon owns glyph sizing. Keep the provider glyph at 1em so the percentage is not applied
    // once to the wrapper and a second time to a Font Awesome <i>.
    icon: options.icon ?? moduleIcon(name, { size: '1em', standard }),
    size,
    iconSize,
    color: background,
    label,
    glass: options.glass ?? 'subtle',
    class: ['zx-module-icon', options.class].flat().filter(Boolean)
  });
  chip.dataset.module = key;
  chip.style.setProperty('--zx-module-color', background);
  chip.style.setProperty('--zx-module-glyph', 'var(--zx-color-app-icon-glyph)');
  chip.style.setProperty('--zx-app-icon-glyph', 'var(--zx-color-app-icon-glyph)');
  if (title) chip.title = info.label;
  return chip;
}

/**
 * Creates the public ZeyOS AppIcon preset for any module, entity, fork, or weblet identity.
 * @param {string} name Module/entity identifier.
 * @param {ModuleChipOptions} [options={}] AppIcon options.
 * @returns {HTMLElement}
 */
export function zeyosAppIcon(name, options = {}) {
  return moduleChip(name, options);
}
