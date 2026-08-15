/**
 * Font Awesome knowledge for the icon layer: style/family class names, the built-in glyph
 * name → Font Awesome name map, icon-spec parsing, and kit loading.
 *
 * Nothing here is imported by a component. `icons.js` uses it only after an application opts in
 * with `useFontAwesome()` / `loadFontAwesome()`, so the zero-dependency default is untouched: Zx
 * never fetches a kit, a stylesheet, or a webfont on its own.
 */

/**
 * Font Awesome style names mapped to their CSS class. `kit` is the pseudo-style for custom icons
 * uploaded to a kit (`fa-kit fa-zeyos-notes`).
 * @type {Readonly<Record<string, string>>}
 */
export const faStyles = Object.freeze({
  solid: 'fa-solid',
  regular: 'fa-regular',
  light: 'fa-light',
  thin: 'fa-thin',
  duotone: 'fa-duotone',
  brands: 'fa-brands',
  kit: 'fa-kit'
});

/**
 * Font Awesome families mapped to their CSS class. `classic` is the default and adds no class.
 * @type {Readonly<Record<string, string>>}
 */
export const faFamilies = Object.freeze({
  classic: '',
  sharp: 'fa-sharp',
  'sharp-duotone': 'fa-sharp-duotone'
});

/** Short prefixes accepted in an icon spec (`fas:user`), mapped to a style name. */
const stylePrefixes = Object.freeze({
  fa: null, fas: 'solid', far: 'regular', fal: 'light', fat: 'thin', fad: 'duotone',
  fab: 'brands', fak: 'kit', solid: 'solid', regular: 'regular', light: 'light', thin: 'thin',
  duotone: 'duotone', brands: 'brands', kit: 'kit', custom: 'kit'
});

/**
 * Built-in Zx glyph names mapped to their Font Awesome 6/7 counterpart, so the same component
 * code renders either provider. Names not listed here are passed to Font Awesome unchanged.
 * @type {Readonly<Record<string, string>>}
 */
export const faNames = Object.freeze({
  x: 'xmark',
  search: 'magnifying-glass',
  calendar: 'calendar-days',
  reload: 'arrows-rotate',
  dots: 'ellipsis',
  info: 'circle-info',
  warning: 'triangle-exclamation',
  error: 'circle-exclamation',
  success: 'circle-check',
  drag: 'grip-vertical'
});

/** @type {Map<string, Promise<void>>} In-flight and settled kit loads, keyed by URL. */
const kitLoads = new Map();

/**
 * @typedef {Object} IconSpec
 * @property {'fa'|'builtin'|null} provider Renderer the spec named, null when it named none.
 * @property {string} name Bare icon name (`'user'`, `'zeyos-notes'`), empty for literal specs.
 * @property {string|null} style Style named by the spec, if any.
 * @property {string[]|null} classes Literal class list when the spec was already CSS classes.
 */

/**
 * Parses an icon spec into the renderer it names and the icon name it carries. Recognised forms:
 *
 * - `'fa-solid fa-user'`, `'fa-kit fa-zeyos-notes'` — a literal class list, used as given.
 * - `'fa:user'`, `'fas:user'`, `'duotone:user'`, `'kit:zeyos-notes'` — prefix plus icon name.
 * - `'builtin:check'` — forces one of the bundled inline SVG glyphs.
 * - `'user'` — a bare name, left for the caller's active provider to interpret.
 *
 * @param {string} spec Icon spec.
 * @returns {IconSpec}
 */
export function parseIconSpec(spec) {
  const text = String(spec).trim();
  if (/\s/.test(text) || text.startsWith('fa-')) {
    const classes = text.split(/\s+/).filter(Boolean);
    return { provider: 'fa', name: '', style: null, classes };
  }

  const separator = text.indexOf(':');
  if (separator > 0) {
    const prefix = text.slice(0, separator).toLowerCase();
    const name = text.slice(separator + 1);
    if (prefix === 'builtin' || prefix === 'zx') {
      return { provider: 'builtin', name, style: null, classes: null };
    }
    if (Object.hasOwn(stylePrefixes, prefix)) {
      return { provider: 'fa', name, style: stylePrefixes[prefix], classes: null };
    }
  }

  return { provider: null, name: text, style: null, classes: null };
}

/**
 * @typedef {Object} FaClassOptions
 * @property {string} [style='solid'] Style name from `faStyles`.
 * @property {string} [family='classic'] Family name from `faFamilies`.
 * @property {boolean} [fixedWidth=false] Adds `fa-fw` for column-aligned glyphs.
 * @property {boolean} [translate=true] Maps built-in Zx glyph names through `faNames`.
 */

/**
 * Builds the Font Awesome class list for an icon name.
 * @param {string} name Font Awesome icon name, with or without the `fa-` prefix.
 * @param {FaClassOptions} [options={}] Style, family, and modifiers.
 * @returns {string[]} Class names, style/family first.
 */
export function faIconClasses(name, options = {}) {
  const { style = 'solid', family = 'classic', fixedWidth = false, translate = true } = options;
  const bare = String(name).replace(/^fa-/, '');
  const resolved = translate ? faNames[bare] ?? bare : bare;
  const classes = [];
  const familyClass = faFamilies[family];
  if (familyClass) classes.push(familyClass);
  classes.push(faStyles[style] ?? faStyles.solid, `fa-${resolved}`);
  if (fixedWidth) classes.push('fa-fw');
  return classes;
}

/**
 * Expands a kit token into its script URL. Full URLs and paths are returned unchanged.
 * @param {string} kit Kit token (`'ae8320b210'`) or script URL.
 * @returns {string}
 */
export function kitUrl(kit) {
  const value = String(kit).trim();
  if (/^(https?:)?\/\//.test(value) || value.startsWith('/') || value.endsWith('.js')) return value;
  if (!/^[a-z0-9]+$/.test(value)) throw new RangeError(`Invalid Font Awesome kit token: ${kit}`);
  return `https://kit.fontawesome.com/${value}.js`;
}

/**
 * Loads a Font Awesome kit script once per URL. Repeat calls return the first promise, and a kit
 * the host page already embedded is adopted rather than loaded twice.
 * @param {string} kit Kit token or script URL.
 * @returns {Promise<void>} Resolves when the kit has loaded.
 */
export function loadFontAwesomeKit(kit) {
  const url = kitUrl(kit);
  const pending = kitLoads.get(url);
  if (pending) return pending;

  const promise = new Promise((resolve, reject) => {
    const absolute = new URL(url, document.baseURI).href;
    const existing = [...document.scripts].find((script) => script.src === absolute);
    if (existing && globalThis.FontAwesomeKitConfig) {
      resolve();
      return;
    }

    const script = existing ?? document.createElement('script');
    script.addEventListener('load', () => resolve(), { once: true });
    script.addEventListener('error', () => {
      kitLoads.delete(url);
      reject(new Error(`Font Awesome kit failed to load: ${url}`));
    }, { once: true });
    if (existing) return;
    script.src = url;
    script.async = true;
    script.crossOrigin = 'anonymous';
    document.head.append(script);
  });

  kitLoads.set(url, promise);
  return promise;
}
