import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const componentRoot = resolve(root, 'src/components');
const baseFile = resolve(root, 'styles/base.css');
const componentFiles = findCssFiles(componentRoot);
const files = [...componentFiles, baseFile].filter(existsSync);
const violations = [];
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
  'white whitesmoke yellow yellowgreen transparent'
).split(/\s+/);
const namedColorPattern = new RegExp('\\b(?:' + namedColors.join('|') + ')\\b', 'gi');
const rawColorPatterns = [
  { label: 'hex color', pattern: /#[\da-f]{3,8}\b/gi },
  { label: 'rgb() color', pattern: /\brgba?\s*\(/gi },
  { label: 'hsl() color', pattern: /\bhsla?\s*\(/gi },
  { label: 'named color', pattern: namedColorPattern }
];

for (const file of files) {
  const source = readFileSync(file, 'utf8');
  const css = stripComments(source);

  for (const { label, pattern } of rawColorPatterns) {
    pattern.lastIndex = 0;
    for (const match of css.matchAll(pattern)) {
      addViolation(file, css, match.index, label + ' "' + match[0] + '"');
    }
  }

  const unsafeOutline = /outline\s*:\s*(?:none|0(?:\s*!important)?)\s*;?/i.exec(css);
  if (unsafeOutline && !/:focus-visible\b/i.test(css)) {
    addViolation(
      file,
      css,
      unsafeOutline.index,
      'outline suppression without a :focus-visible rule in the same file'
    );
  }

  if (file.startsWith(componentRoot)) {
    const tierOnePattern = /var\(\s*(--zx-(?:gray|green|red|amber|blue)-[^\s,)]+)/gi;
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
