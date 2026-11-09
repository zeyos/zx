import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(import.meta.dirname, '..');
const componentRoot = resolve(root, 'src/components');
/*
 * `styles/` is linted by file, not by directory, because `styles/tokens/` is where the palette
 * is DEFINED — a hex literal there is the point, and scanning the tree would flag every one.
 * Everything else under `styles/` consumes the semantic tier like a component does and is held
 * to the same rule. A new stylesheet here has to be added deliberately, which is the tradeoff:
 * `print.css` and `icons.css` both shipped without this line and nothing noticed — so the list is
 * also checked against the directory below, and a stylesheet missing from it fails the lint.
 */
const styleNames = ['base.css', 'prose.css', 'print.css', 'icons.css', 'core.css', 'zx.layered.css', 'zeyos.css'];
const styleFiles = styleNames.map((name) => resolve(root, 'styles', name));
const componentFiles = findCssFiles(componentRoot);
/*
 * The application layouts are public examples of how to style an application on Zx, so they are
 * held to the component rule too: the shared shell (`kit.css`) and every template stylesheet.
 */
const layoutRoot = resolve(root, 'website/layouts');
const layoutFiles = findCssFiles(layoutRoot);
const files = [...componentFiles, ...styleFiles, ...layoutFiles].filter(existsSync);
const namedColors = (
  'aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet ' +
  'brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue ' +
  'darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange ' +
  'darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise ' +
  'darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia ' +
  'gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory ' +
  'khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow ' +
  'lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray ' +
  'lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue ' +
  'mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred ' +
  'midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid ' +
  'palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple ' +
  'rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue ' +
  'slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat ' +
  'white whitesmoke yellow yellowgreen'
).split(/\s+/);
// `transparent` and `currentColor` are theme-neutral keywords, not banned color literals.
// Exclude hyphen-adjacent matches so property names like `white-space` are not misread as colors.
const namedColorPattern = new RegExp('(?<![\\w-])(?:' + namedColors.join('|') + ')(?![\\w-])', 'gi');
const rawColorPatterns = [
  { label: 'hex color', pattern: /#[\da-f]{3,8}\b/gi },
  { label: 'rgb() color', pattern: /\brgba?\s*\(/gi },
  { label: 'hsl() color', pattern: /\bhsla?\s*\(/gi },
  // The CSS Color 4 functions paint as surely as rgb(). `color-mix()` is not one of them: it
  // only mixes the colours it is given, which the other patterns already check.
  { label: 'colour function', pattern: /(?<![\w-])(?:oklch|oklab|lab|lch|hwb|color)\s*\(/gi },
  { label: 'named color', pattern: namedColorPattern }
];
/*
 * Tier-1 tokens a component or layout must not read. The accent ramp (`--zx-accent-300…700`) is
 * public API for applications, but components take the accent through the `--zx-color-accent*`
 * roles; the module palette is ZeyOS product data; the raw shadow steps sit behind
 * `--zx-surface-shadow` and `--zx-overlay-shadow`. `--zx-module-bar-*` is ModuleBar's own
 * component-local geometry, not the palette.
 */
const tierOnePattern = new RegExp(
  String.raw`var\(\s*(--zx-(?:(?:gray|green|red|amber|blue|emerald|tone)-|accent-\d|shadow-\d|module-(?!bar-))[^\s,)]*)`,
  'gi'
);
/*
 * Outline suppression. Forced-colors mode drops box-shadow, so a focus ring drawn with one
 * vanishes and the outline is all that is left; `outline: 0` or `outline: none` on a focusable
 * element removes that last indicator. Make the outline transparent instead (`outline-color:
 * transparent`), which forced colors repaints in a system colour. A rule that genuinely has no
 * focus to show (print) carries `/* lint: outline-ok *\/` on the same line.
 */
const outlinePattern = /\boutline(?:-style)?\s*:\s*(?:none|0(?:px)?)(?![\w.])|\boutline-width\s*:\s*0(?:px)?(?![\w.])/gi;
const outlineAllowMarker = /lint:\s*outline-ok/;

/**
 * Inspects consumer CSS without reading files or reporting to the console.
 * @param {string} source Stylesheet source.
 * @param {{checkTierOne?: boolean}} [options={}] Whether component/layout tier rules apply.
 * @returns {Array<{index: number, message: string}>} Violations at original source offsets.
 */
export function auditCss(source, { checkTierOne = false } = {}) {
  const violations = [];
  const addViolation = (index, message) => violations.push({ index, message });
  // Ordinary strings name attributes/content rather than paint. SVG data URLs are inspected
  // separately below; blank strings here while keeping original source offsets.
  const css = stripStrings(stripComments(source));

  const fallbacks = varFallbackRanges(css);
  for (const { label, pattern } of rawColorPatterns) {
    pattern.lastIndex = 0;
    for (const match of css.matchAll(pattern)) {
      // A raw colour as a `var()` fallback still paints whenever the token is missing — and it
      // is the one place a reviewer reads past, so say so.
      const where = fallbacks.some(([start, end]) => match.index >= start && match.index < end)
        ? ' in a var() fallback'
        : '';
      addViolation(match.index, label + ' "' + match[0] + '"' + where);
    }
  }

  const sourceLines = source.split('\n');
  for (const match of css.matchAll(outlinePattern)) {
    const line = css.slice(0, match.index).split('\n').length;
    if (outlineAllowMarker.test(sourceLines[line - 1] ?? '')) continue;
    addViolation(match.index,
      'outline suppression "' + match[0] + '" (use outline-color: transparent; see base.css)');
  }

  if (checkTierOne) {
    tierOnePattern.lastIndex = 0;
    for (const match of css.matchAll(tierOnePattern)) {
      addViolation(match.index, 'tier-1 token reference "' + match[1] + '"');
    }
  }
  for (const { index, value } of svgPaintValues(stripComments(source))) {
    // Fragment references inside SVG paint URLs name resources, not hexadecimal paint.
    const paint = stripStrings(value.replace(/url\([^)]*\)/gi, ''));
    for (const { label, pattern } of rawColorPatterns) {
      pattern.lastIndex = 0;
      for (const match of paint.matchAll(pattern)) addViolation(index, `SVG ${label} "${match[0]}"`);
    }
  }
  return violations;
}

/** Runs the repository lint when invoked as a command, while fixtures import only the scanner. */
function main() {
  const violations = [];
  for (const entry of readdirSync(resolve(root, 'styles'), { withFileTypes: true })) {
    // `zx.css` is only the @import list; everything else is a stylesheet that must be linted.
    if (entry.isFile() && entry.name.endsWith('.css') && entry.name !== 'zx.css' && !styleNames.includes(entry.name)) {
      violations.push('styles/' + entry.name + ' is not in the lint\'s style file list');
    }
  }

  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    for (const { index, message } of auditCss(source, {
      checkTierOne: file.startsWith(componentRoot) || file.startsWith(layoutRoot)
    })) {
      const line = source.slice(0, index).split('\n').length;
      violations.push(`${file.slice(root.length + 1)}:${line} ${message}`);
    }
  }
  if (violations.length) {
    console.error('Token lint found violations:\n');
    for (const violation of violations) console.error('- ' + violation);
    process.exitCode = 1;
  } else {
    console.log(`Token lint passed (${files.length} CSS files checked).`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();

/**
 * The source ranges of every `var()` fallback (from after the first top-level comma to the closing
 * parenthesis), nested ones included.
 * @param {string} css
 * @returns {Array<[number, number]>}
 */
function varFallbackRanges(css) {
  const ranges = [];
  for (const match of css.matchAll(/\bvar\(/g)) {
    let depth = 0;
    let comma = -1;
    for (let index = match.index + 3; index < css.length; index += 1) {
      const char = css[index];
      if (char === '(') depth += 1;
      else if (char === ')') {
        depth -= 1;
        if (depth === 0) {
          if (comma >= 0) ranges.push([comma + 1, index]);
          break;
        }
      } else if (char === ',' && depth === 1 && comma < 0) comma = index;
    }
  }
  return ranges;
}

/**
 * Recursively finds CSS files beneath a directory.
 * @param {string} directory
 * @returns {string[]}
 */
function findCssFiles(directory) {
  if (!existsSync(directory)) return [];
  const found = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) found.push(...findCssFiles(path));
    else if (entry.isFile() && entry.name.endsWith('.css')) found.push(path);
  }
  return found;
}

/**
 * Replaces the contents of quoted strings with spaces while preserving offsets and line positions.
 * @param {string} css
 * @returns {string}
 */
function stripStrings(css) {
  return css.replace(/(["'])(?:\\.|(?!\1)[^\\\n])*\1/g, (string) => string[0] + ' '.repeat(string.length - 2) + string[0]);
}

/**
 * Replaces comment contents with spaces while preserving line positions.
 * @param {string} source
 * @returns {string}
 */
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' '));
}

/**
 * Decodes SVG data URLs and yields paint attributes/declarations only. IDs, selectors and text
 * never become paint merely because their spelling resembles a colour.
 * @param {string} css Comment-free CSS retaining original offsets.
 * @returns {Array<{index: number, value: string}>}
 */
function svgPaintValues(css) {
  const paints = [];
  const urls = /url\(\s*(?:"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'|([^)]*))\s*\)/gi;
  const attributes = /([^\s=<>/]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  const paintAttributes = new Set(['fill', 'stroke', 'color', 'stop-color', 'flood-color', 'lighting-color']);
  for (const match of css.matchAll(urls)) {
    const url = (match[1] ?? match[2] ?? match[3] ?? '').trim()
      .replace(/\\([\da-f]{1,6})\s?|\\([^\r\n])/gi, (_all, hex, escaped) => hex ? codePoint(hex, 16) : escaped);
    if (!/^data:image\/svg\+xml(?:[;,])/i.test(url)) continue;
    const comma = url.indexOf(',');
    if (comma < 0) continue;
    let svg;
    try {
      const data = decodeURIComponent(url.slice(comma + 1));
      svg = /;base64/i.test(url.slice(0, comma)) ? Buffer.from(data, 'base64').toString('utf8') : data;
    } catch { continue; }
    const add = (value) => paints.push({ index: match.index, value });
    const declarations = (style) => {
      for (const declaration of style.split(';')) {
        const colon = declaration.indexOf(':');
        const property = declaration.slice(0, colon).trim();
        if (colon >= 0 && /^(?:--|fill\b|stroke\b|color\b|stop-color\b|flood-color\b|lighting-color\b|background\b|border\b|outline\b|box-shadow\b|text-shadow\b|filter\b)/i.test(property)) {
          add(declaration.slice(colon + 1));
        }
      }
    };
    for (const tag of svg.replace(/<!--[\s\S]*?-->/g, '').matchAll(/<[^>]*>/g)) {
      for (const attribute of tag[0].matchAll(attributes)) {
        const name = attribute[1].toLowerCase();
        const value = decodeXml(attribute[2] ?? attribute[3] ?? '');
        if (name === 'style') declarations(value);
        else if (paintAttributes.has(name)) add(value);
      }
    }
    for (const style of svg.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi)) {
      for (const rule of decodeXml(style[1]).matchAll(/\{([^{}]*)\}/g)) declarations(rule[1]);
    }
  }
  return paints;
}

/** @param {string} value @param {number} radix @returns {string} */
function codePoint(value, radix) {
  const point = parseInt(value, radix);
  return point > 0 && point <= 0x10ffff && !(point >= 0xd800 && point <= 0xdfff)
    ? String.fromCodePoint(point) : '\ufffd';
}

/** @param {string} value @returns {string} */
function decodeXml(value) {
  return value.replace(/&#(?:x([\da-f]+)|(\d+));|&(quot|apos|amp|lt|gt);/gi,
    (_entity, hex, decimal, named) => hex || decimal
      ? codePoint(hex || decimal, hex ? 16 : 10)
      : ({ quot: '"', apos: "'", amp: '&', lt: '<', gt: '>' })[named.toLowerCase()]);
}
