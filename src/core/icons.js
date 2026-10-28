// @ts-check
/**
 * The icon layer. Two renderers sit behind one `icon()` call:
 *
 * - **built-in** (default) — the inline SVG outline glyphs below (Lucide), no network, no
 *   stylesheet, no font. Applications can add their own, filled or outlined, with `registerIcons()`.
 * - **Font Awesome** — `<i>` elements carrying Font Awesome classes, after an application opts in
 *   with `useFontAwesome()` or `loadFontAwesome(kit)`. Zx never loads a kit by itself.
 *
 * Both renderers put `zx-icon` on the element, so component CSS can style either.
 * @module zx/core/icons
 */

import { faIconClasses, kitUrl, loadFontAwesomeKit, parseIconSpec } from './fontawesome.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * @typedef {Object} IconOptions
 * @property {number|string} [size=16] Rendered width and height.
 * @property {string|null} [label=null] Accessible label; null marks the icon decorative.
 * @property {string|string[]} [class] Extra class names added to the element.
 * @property {string} [style] Font Awesome style for this icon only (`'solid'`, `'duotone'`, …).
 * @property {string} [family] Font Awesome family for this icon only (`'classic'`, `'sharp'`, …).
 * @property {boolean} [fixedWidth] Adds Font Awesome's `fa-fw` for column-aligned glyphs.
 * @property {boolean} [strict=false] Throws `RangeError` on a name the bundled glyph set does not
 *   carry, instead of returning the placeholder. For call sites that can afford to fail — a test,
 *   a build-time check — rather than a screen rendering server data.
 */

/**
 * How a glyph's path is painted. `'fill'` fills the shape — the form Font Awesome and other solid
 * sets ship in. `'stroke'` draws the outline with the icon pen: `currentColor`, round caps and
 * joins, and a width of 1.75 units in a 24-unit view box — the form the bundled set uses.
 * @typedef {'fill'|'stroke'} IconPaint
 */

/**
 * One inline SVG glyph: `[viewBox, path]` for a filled shape, or `[viewBox, path, 'stroke']` for
 * an outline. A path may hold any number of subpaths; the two-element form is the original format
 * and always renders filled.
 * @typedef {[string, string] | [string, string, IconPaint]} IconGlyph
 */

/** The view box every bundled glyph is drawn in: Lucide's 24-unit square. */
const VIEW_BOX = '0 0 24 24';

/**
 * Stroke width of an outline glyph, in units of a 24-unit view box. At the default 16px it draws
 * a line of about 1.2px — the stem weight of 13–14px interface text, so an icon sits beside a
 * label without outweighing it.
 */
const STROKE_WIDTH = 1.75;

/**
 * Thinnest line an outline glyph is drawn with, in CSS pixels. Below 16px the proportional width
 * would fall under a pixel and wash out (a 12px chevron, an 8px tick), so small glyphs keep one
 * full pixel instead.
 */
const MIN_STROKE_PX = 1;

/**
 * Wraps bundled path data as an outline glyph in the shared view box.
 * @param {string} path Path data.
 * @returns {IconGlyph}
 */
const outline = (path) => [VIEW_BOX, path, 'stroke'];

/*
 * @license Lucide 1.53.0 (ISC), including icons derived from Feather (MIT) — notices below.
 *
 * The bundled glyphs are Lucide 1.53.0 (https://lucide.dev), outline icons drawn on a 24-unit grid.
 * Each Lucide icon is stored as one path: its circles, rectangles, lines, and polylines are
 * rewritten as equivalent path data, which renders identically because every part shares the same
 * stroke. Where a Zx name differs from the Lucide one, the Lucide name is noted beside the glyph.
 *
 * ISC License
 *
 * Copyright (c) 2026 Lucide Icons and Contributors
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
 * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
 * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
 * OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 *
 * Lucide icons derived from the Feather project (Lucide's LICENSE lists them) are also covered by:
 *
 * The MIT License (MIT)
 *
 * Copyright (c) 2013-present Cole Bemis
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

/**
 * The bundled glyph set: outline icons from Lucide (ISC; see the notice above), embedded as path
 * data so the library carries no webfont, stylesheet, or package dependency. Every entry is
 * `[viewBox, path, 'stroke']` in a 24-unit view box. Extend the set with `registerIcons()`; read
 * every available name with `iconNames()`.
 * @type {Readonly<Record<string, IconGlyph>>}
 */
export const icons = Object.freeze({
  // <lucide-glyphs>
  'arrow-up-wide-short': outline('M3 8l4-4 4 4M7 4v16M11 12h10M11 16h7M11 20h4'), // arrow-up-wide-narrow
  'arrow-down-wide-short': outline('M3 16l4 4 4-4M7 20V4M11 4h10M11 8h7M11 12h4'), // arrow-down-wide-narrow
  'chevron-down': outline('M6 9l6 6 6-6'),
  'chevron-up': outline('M18 15l-6-6-6 6'),
  'chevron-left': outline('M15 18l-6-6 6-6'),
  'chevron-right': outline('M9 18l6-6-6-6'),
  check: outline('M20 6 9 17l-5-5'),
  x: outline('M18 6 6 18M6 6l12 12'),
  plus: outline('M5 12h14M12 5v14'),
  minus: outline('M5 12h14'),
  search: outline('M21 21l-4.34-4.34M3 11a8 8 0 1 0 16 0a8 8 0 1 0-16 0z'),
  calendar: outline('M8 2v3M16 2v3M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-14a2 2 0 0 1-2-2v-14a2 2 0 0 1 2-2zM3 9h18'),
  clock: outline('M2 12a10 10 0 1 0 20 0a10 10 0 1 0-20 0zM12 6v6l4 2'),
  trash: outline('M10 11v6M14 11v6M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2'),
  gear: outline('M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915M9 12a3 3 0 1 0 6 0a3 3 0 1 0-6 0z'), // settings
  eye: outline('M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0M9 12a3 3 0 1 0 6 0a3 3 0 1 0-6 0z'),
  lock: outline('M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-14a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2zM7 11V7a5 5 0 0 1 10 0v4'),
  reload: outline('M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8M21 3v5h-5'), // rotate-cw
  list: outline('M3 5h.01M3 12h.01M3 19h.01M8 5h13M8 12h13M8 19h13'),
  filter: outline('M10 20a1 1 0 0 0 .553.895l2 1A1 1 0 0 0 14 21v-7a2 2 0 0 1 .517-1.341L21.74 4.67A1 1 0 0 0 21 3H3a1 1 0 0 0-.742 1.67l7.225 7.989A2 2 0 0 1 10 14z'), // funnel
  dots: outline('M11 12a1 1 0 1 0 2 0a1 1 0 1 0-2 0zM18 12a1 1 0 1 0 2 0a1 1 0 1 0-2 0zM4 12a1 1 0 1 0 2 0a1 1 0 1 0-2 0z'), // ellipsis
  info: outline('M2 12a10 10 0 1 0 20 0a10 10 0 1 0-20 0zM12 16v-4M12 8h.01'),
  warning: outline('M21.73 18l-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3M12 9v4M12 17h.01'), // triangle-alert
  error: outline('M2 12a10 10 0 1 0 20 0a10 10 0 1 0-20 0zM12 8V12M12 16H12.01'), // circle-alert
  success: outline('M2 12a10 10 0 1 0 20 0a10 10 0 1 0-20 0zM16 9l-5.5 5.5L8 12'), // circle-check
  upload: outline('M12 3v12M17 8l-5-5-5 5M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4'),
  drag: outline('M8 12a1 1 0 1 0 2 0a1 1 0 1 0-2 0zM8 5a1 1 0 1 0 2 0a1 1 0 1 0-2 0zM8 19a1 1 0 1 0 2 0a1 1 0 1 0-2 0zM14 12a1 1 0 1 0 2 0a1 1 0 1 0-2 0zM14 5a1 1 0 1 0 2 0a1 1 0 1 0-2 0zM14 19a1 1 0 1 0 2 0a1 1 0 1 0-2 0z'), // grip-vertical
  star: outline('M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z'),
  heart: outline('M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5'),
  tag: outline('M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42zM7 7.5a.5 .5 0 1 0 1 0a.5 .5 0 1 0-1 0z'),
  folder: outline('M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z'),
  'folder-open': outline('M6 14l1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2'),
  file: outline('M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2zM14 2v5a1 1 0 0 0 1 1h5'),
  copy: outline('M10 8h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-10a2 2 0 0 1-2-2v-10a2 2 0 0 1 2-2zM4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2'),
  square: outline('M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-14a2 2 0 0 1-2-2v-14a2 2 0 0 1 2-2z'),
  code: outline('M18 16l4-4-4-4M6 8l-4 4 4 4M14.5 4l-5 16'), // code-xml
  book: outline('M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20'),
  'table-cells-large': outline('M4 3h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1v-5a1 1 0 0 1 1-1zM15 3h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1v-5a1 1 0 0 1 1-1zM15 14h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1v-5a1 1 0 0 1 1-1zM4 14h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1v-5a1 1 0 0 1 1-1z'), // layout-grid
  table: outline('M12 3v18M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-14a2 2 0 0 1-2-2v-14a2 2 0 0 1 2-2zM3 9h18M3 15h18'),
  image: outline('M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-14a2 2 0 0 1-2-2v-14a2 2 0 0 1 2-2zM7 9a2 2 0 1 0 4 0a2 2 0 1 0-4 0zM21 15l-3.086-3.086a2 2 0 0 0-2.828 0L6 21'),
  columns: outline('M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-14a2 2 0 0 1-2-2v-14a2 2 0 0 1 2-2zM9 3v18M15 3v18'), // columns-3
  type: outline('M12 4v16M4 7V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2M9 20h6'),
  hash: outline('M4 9h16M4 15h16M10 3L8 21M16 3l-2 18'),
  mail: outline('M22 7l-8.991 5.727a2 2 0 0 1-2.009 0L2 7M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-16a2 2 0 0 1-2-2v-12a2 2 0 0 1 2-2z'),
  'link-2': outline('M9 17H7A5 5 0 0 1 7 7h2M15 7h2a5 5 0 1 1 0 10h-2M8 12h8'),
  'circle-chevron-down': outline('M2 12a10 10 0 1 0 20 0a10 10 0 1 0-20 0zM16 10l-4 4-4-4')
  // </lucide-glyphs>
});

/** Legacy gx Factory icon names mapped to their Zx equivalents. */
const aliases = Object.freeze({
  settings: 'gear',
  clear: 'x',
  checked: 'check',
  question: 'info',
  range: 'filter',
  fields: 'list',
  grid: 'table-cells-large'
});

/** @type {Record<string, IconGlyph>} Glyphs added at runtime by `registerIcons`. */
const extraGlyphs = Object.create(null);

/**
 * @typedef {Object} IconConfig
 * @property {'builtin'|'fontawesome'} provider Renderer used for bare icon names.
 * @property {string} style Default Font Awesome style (`'solid'`, `'regular'`, `'duotone'`, …).
 * @property {string} family Default Font Awesome family (`'classic'`, `'sharp'`, …).
 * @property {boolean} fixedWidth Whether Font Awesome icons get `fa-fw` by default.
 * @property {string|null} kit Kit token or URL passed to the last `loadFontAwesome()` call.
 */

/** @type {IconConfig} */
const config = {
  provider: 'builtin',
  style: 'solid',
  family: 'classic',
  fixedWidth: false,
  kit: null
};

/**
 * Reads the active icon configuration.
 * @returns {IconConfig} A copy — mutating it does not change the configuration.
 */
export function getIconConfig() {
  return { ...config };
}

/**
 * Sets how bare icon names are rendered. Explicitly prefixed names (`'fa:user'`,
 * `'builtin:check'`) and literal class lists (`'fa-solid fa-user'`) always ignore this.
 * @param {Partial<IconConfig>} options Values to change.
 * @returns {IconConfig} The configuration after the change.
 */
export function configureIcons(options = {}) {
  for (const key of ['provider', 'style', 'family', 'fixedWidth', 'kit']) {
    if (options[key] !== undefined) config[key] = options[key];
  }
  return getIconConfig();
}

/**
 * Switches bare icon names to Font Awesome. Use this when the kit, or a self-hosted Font Awesome
 * stylesheet, is already on the page; use `loadFontAwesome()` to inject a kit as well.
 * @param {Partial<Omit<IconConfig, 'provider'>>} [options={}] Default style, family, modifiers.
 * @returns {IconConfig} The configuration after the change.
 */
export function useFontAwesome(options = {}) {
  return configureIcons({ ...options, provider: 'fontawesome' });
}

/**
 * Switches bare icon names back to the inline SVG glyphs bundled with Zx.
 * @returns {IconConfig} The configuration after the change.
 */
export function useBuiltinIcons() {
  return configureIcons({ provider: 'builtin' });
}

/**
 * Loads a Font Awesome kit and renders bare icon names with it. The script is injected once per
 * URL; a kit the page already embeds is adopted instead of loaded again.
 * @param {string|(Partial<Omit<IconConfig, 'provider'>> & {kit: string, activate?: boolean})} options
 *   Kit token/URL, or an options object naming one.
 * @returns {Promise<IconConfig>} Resolves with the configuration once the kit has loaded.
 */
export async function loadFontAwesome(options) {
  const settings = typeof options === 'string' ? { kit: options } : { ...options };
  const { kit, activate = true, ...rest } = settings;
  if (!kit) throw new TypeError('loadFontAwesome() needs a kit token or URL');
  configureIcons({ ...rest, kit: kitUrl(kit) });
  await loadFontAwesomeKit(kit);
  return activate ? useFontAwesome() : getIconConfig();
}

/**
 * Adds inline SVG glyphs to the built-in set, or replaces existing ones.
 *
 * An entry is `[viewBox, path]` — a filled shape, the format Font Awesome path data comes in, and
 * how it always rendered — or `[viewBox, path, 'stroke']` — an outline drawn with the same pen as
 * the bundled set: `currentColor`, round caps and joins, and a stroke scaled to the view box, so a
 * glyph from a 24-unit outline set such as Lucide renders exactly like a bundled one.
 *
 *     registerIcons({ rocket: ['0 0 512 512', 'M…'] });           // filled
 *     registerIcons({ anchor: ['0 0 24 24', 'M12 6v16…', 'stroke'] });  // outline
 * @param {Record<string, IconGlyph>} glyphs Glyphs keyed by icon name.
 * @returns {void}
 * @throws {TypeError} When an entry is neither a `[viewBox, path]` pair nor a
 *   `[viewBox, path, 'fill'|'stroke']` triple.
 */
export function registerIcons(glyphs) {
  for (const [name, entry] of Object.entries(glyphs)) {
    if (!Array.isArray(entry) || (entry.length !== 2 && entry.length !== 3)
      || (entry.length === 3 && entry[2] !== 'fill' && entry[2] !== 'stroke')) {
      throw new TypeError(
        `Icon "${name}" must be a [viewBox, path] pair or a [viewBox, path, 'stroke'] triple`
      );
    }
    extraGlyphs[name] = entry[2] === 'stroke'
      ? [String(entry[0]), String(entry[1]), 'stroke']
      : [String(entry[0]), String(entry[1])];
  }
}

/**
 * Lists every inline SVG glyph name available, built-in and registered.
 * @returns {string[]} Sorted icon names.
 */
export function iconNames() {
  return [...new Set([...Object.keys(icons), ...Object.keys(extraGlyphs)])].sort();
}

/**
 * Creates an icon element.
 *
 * Bare names (`'check'`) render through the active provider: the bundled inline SVG set by
 * default, or Font Awesome after `useFontAwesome()` / `loadFontAwesome()`. A name can also select
 * its renderer itself — `'fa:user'`, `'duotone:user'`, `'kit:zeyos-notes'`, `'builtin:check'`, or
 * a literal Font Awesome class list such as `'fa-solid fa-user'`.
 *
 * **A name this cannot resolve never throws.** Icon names routinely arrive from a server, and one
 * unconfigured name must not take down the screen it appears on. An inline glyph the bundled set
 * does not carry renders as the placeholder described in `missingIcon()` and is reported once per
 * distinct name through `console.warn`; pass `{ strict: true }` to get a `RangeError` instead.
 * Only the inline-SVG path can fail this way: Font Awesome resolves names in the browser at render
 * time, so a name under a loaded kit or stylesheet is never "unknown" here and never warns.
 *
 * @param {string} name Icon name or spec.
 * @param {IconOptions} [options={}] Display and accessibility options.
 * @returns {SVGSVGElement|HTMLElement} An `<svg>` for inline glyphs, an `<i>` for Font Awesome.
 * @throws {RangeError} With `{ strict: true }` only, when the bundled set has no such glyph.
 */
export function icon(name, options = {}) {
  const spec = parseIconSpec(name);
  if (spec.classes) return faIcon(spec.classes, options);

  const resolved = aliases[spec.name] ?? spec.name;
  if (spec.provider === 'builtin') return builtinIcon(resolved, options);
  if (spec.provider === 'fa') {
    return faIcon(faIconClasses(resolved, {
      style: spec.style ?? options.style ?? config.style,
      family: options.family ?? config.family,
      fixedWidth: options.fixedWidth ?? config.fixedWidth
    }), options);
  }

  if (config.provider === 'fontawesome') {
    return faIcon(faIconClasses(resolved, {
      style: options.style ?? config.style,
      family: options.family ?? config.family,
      fixedWidth: options.fixedWidth ?? config.fixedWidth
    }), options);
  }

  return builtinIcon(resolved, options);
}

/**
 * Renders one of the bundled inline SVG glyphs, or the placeholder when there is no such glyph.
 * @param {string} name Resolved glyph name.
 * @param {IconOptions} options Display and accessibility options.
 * @returns {SVGSVGElement}
 * @throws {RangeError} With `options.strict`, when no glyph carries that name.
 */
function builtinIcon(name, options) {
  const entry = extraGlyphs[name] ?? icons[name];
  if (!entry) {
    if (options.strict) throw new RangeError(`Unknown icon: ${name}`);
    warnMissingIcon(name);
    return missingIcon(name, options);
  }
  const [viewBox, pathData, paint = 'fill'] = entry;
  const svg = iconSvg(viewBox, paint, options);
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', pathData);
  svg.append(path);
  return svg;
}

/**
 * Builds the `<svg>` root every inline glyph shares, so the placeholder is the same element in
 * the same box as the icon it stands in for. The paint attributes sit on the root and the path
 * inherits them, so component CSS can restyle a glyph with `fill`, `stroke`, or `color` on the
 * `.zx-icon` element alone — `fill: currentColor` turns an outline into its solid form, for a set
 * star or a liked heart.
 * @param {string} viewBox The glyph's view box.
 * @param {IconPaint} paint Whether the glyph is filled or stroked.
 * @param {IconOptions} options Display and accessibility options.
 * @returns {SVGSVGElement}
 */
function iconSvg(viewBox, paint, options) {
  const { size = 16 } = options;
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', classList('zx-icon', options.class));
  svg.setAttribute('viewBox', viewBox);
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  if (paint === 'stroke') {
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', strokeWidth(viewBox, size));
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
  } else {
    svg.setAttribute('fill', 'currentColor');
  }
  svg.setAttribute('focusable', 'false');
  applyLabel(svg, options.label ?? null);
  return svg;
}

/**
 * The stroke width an outline glyph is drawn with, in its own view-box units: `STROKE_WIDTH` per
 * 24 units, so outline sets drawn on another grid keep the same weight, and never thinner than
 * `MIN_STROKE_PX` at the rendered size. A size given as a CSS length other than pixels (`'1em'`)
 * cannot be measured here and keeps the proportional width.
 * @param {string} viewBox The glyph's view box.
 * @param {number|string} size The rendered size the caller asked for.
 * @returns {string}
 */
function strokeWidth(viewBox, size) {
  const [, , width, height] = viewBox.trim().split(/[\s,]+/).map(Number);
  const extent = Math.max(width, height) || 24;
  let units = STROKE_WIDTH * extent / 24;
  const pixels = typeof size === 'number' ? size
    : /^\d*\.?\d+(px)?$/.test(String(size).trim()) ? parseFloat(String(size)) : NaN;
  if (pixels > 0) units = Math.max(units, MIN_STROKE_PX * extent / pixels);
  return String(Math.round(units * 1000) / 1000);
}

/** View box the placeholder reserves — the square the bundled glyphs are drawn in. */
const PLACEHOLDER_VIEW_BOX = VIEW_BOX;

/**
 * The element an unresolvable name renders as: the ordinary `zx-icon` root at the requested size,
 * carrying no path.
 *
 * Empty rather than a fallback glyph on purpose. The box is what layout needs — a row of icons
 * keeps its alignment and nothing reflows — while a question mark or an outlined square would
 * read as an icon somebody chose, and would be the wrong one wherever colour or shape carries
 * meaning. The gap is addressed to the developer instead, through the `console.warn` and through
 * `data-zx-icon-missing`, which names it in devtools and lets a test or a page audit find every
 * one of them with a single selector.
 * @param {string} name Resolved glyph name that could not be found.
 * @param {IconOptions} options Display and accessibility options.
 * @returns {SVGSVGElement}
 */
function missingIcon(name, options) {
  const svg = iconSvg(PLACEHOLDER_VIEW_BOX, 'stroke', options);
  svg.setAttribute('data-zx-icon-missing', name);
  return svg;
}

/** @type {Set<string>} Names already reported, so each gap is warned about exactly once. */
const warnedMissing = new Set();

/**
 * Reports a missing glyph once per distinct name. A list of four hundred rows built from the same
 * unconfigured name is one gap to fix, so it is one line in the console, not four hundred.
 * @param {string} name Resolved glyph name that could not be found.
 * @returns {void}
 */
function warnMissingIcon(name) {
  if (warnedMissing.has(name)) return;
  warnedMissing.add(name);
  console.warn(`[zx.icon] Unknown icon "${name}" — rendered an empty placeholder. `
    + 'Add it with registerIcons(), or render Font Awesome with useFontAwesome().');
}

/**
 * Renders a Font Awesome icon element. The glyph itself comes from the kit or stylesheet the
 * application loaded; Zx only writes the classes.
 * @param {string[]} classes Font Awesome class names.
 * @param {IconOptions} options Display and accessibility options.
 * @returns {HTMLElement}
 */
function faIcon(classes, options) {
  const { size = 16 } = options;
  const element = document.createElement('i');
  element.className = classList('zx-icon', ...classes, options.class);
  element.style.fontSize = typeof size === 'number' ? `${size}px` : String(size);
  applyLabel(element, options.label ?? null);
  return element;
}

/**
 * Marks an icon decorative, or names it for assistive technology.
 * @param {Element} element Icon element.
 * @param {string|null} label Accessible label; null marks the icon decorative.
 * @returns {void}
 */
function applyLabel(element, label) {
  if (label === null) {
    element.setAttribute('aria-hidden', 'true');
    return;
  }
  element.setAttribute('role', 'img');
  element.setAttribute('aria-label', label);
}

/**
 * Joins class names, accepting strings, arrays, and nullish values.
 * @param {...(string|string[]|null|undefined)} values Class name sources.
 * @returns {string}
 */
function classList(...values) {
  return values.flat().filter(Boolean).join(' ');
}
