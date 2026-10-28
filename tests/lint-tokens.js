import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

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
const styleNames = ['base.css', 'print.css', 'icons.css'];
const styleFiles = styleNames.map((name) => resolve(root, 'styles', name));
const componentFiles = findCssFiles(componentRoot);
/*
 * The application layouts are public examples of how to style an application on Zx, so they are
 * held to the component rule too: the shared shell (`kit.css`) and every template stylesheet.
 */
const layoutRoot = resolve(root, 'website/layouts');
const layoutFiles = findCssFiles(layoutRoot);
const files = [...componentFiles, ...styleFiles, ...layoutFiles].filter(existsSync);
const violations = [];
for (const entry of readdirSync(resolve(root, 'styles'), { withFileTypes: true })) {
  // `zx.css` is only the @import list; everything else is a stylesheet that must be linted.
  if (entry.isFile() && entry.name.endsWith('.css') && entry.name !== 'zx.css' && !styleNames.includes(entry.name)) {
    violations.push('styles/' + entry.name + ' is not in the lint\'s style file list');
  }
}
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

for (const file of files) {
  const source = readFileSync(file, 'utf8');
  // Quoted strings are attribute values and content, never colours: `[data-tone="blue"]` names a
  // tone, it does not paint one. Blank them out (keeping offsets) before looking for literals.
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
      addViolation(file, css, match.index, label + ' "' + match[0] + '"' + where);
    }
  }

  const sourceLines = source.split('\n');
  for (const match of css.matchAll(outlinePattern)) {
    const line = css.slice(0, match.index).split('\n').length;
    if (outlineAllowMarker.test(sourceLines[line - 1] ?? '')) continue;
    addViolation(file, css, match.index,
      'outline suppression "' + match[0] + '" (use outline-color: transparent; see base.css)');
  }

  if (file.startsWith(componentRoot) || file.startsWith(layoutRoot)) {
    tierOnePattern.lastIndex = 0;
    for (const match of css.matchAll(tierOnePattern)) {
      addViolation(file, css, match.index, 'tier-1 token reference "' + match[1] + '"');
    }
  }
}

if (violations.length > 0) {
  console.error('Token lint found violations:\n');
  for (const violation of violations) console.error('- ' + violation);
  process.exitCode = 1;
} else {
  const suffix = files.length === 1 ? '' : 's';
  console.log('Token lint passed (' + files.length + ' CSS file' + suffix + ' checked).');
}

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
 * Adds a violation with its repository-relative location.
 * @param {string} file
 * @param {string} source
 * @param {number} index
 * @param {string} message
 * @returns {void}
 */
function addViolation(file, source, index, message) {
  const line = source.slice(0, index).split('\n').length;
  violations.push(file.slice(root.length + 1) + ':' + line + ' ' + message);
}
