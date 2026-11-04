#!/usr/bin/env node
/**
 * Writes a stylesheet holding only the components an application uses.
 *
 * A subset is resolved from the source, not listed by hand. A component's subset is its own
 * stylesheet plus the stylesheet of every block it reaches: every component module in its static
 * import graph, and every `zx-<block>` class named by a module in that graph, because a component
 * may draw another's markup without importing it. The result keeps the order of `styles/zx.css`,
 * holds each file once, and starts with the core sheet.
 *
 * Runs on Node alone: the package has no runtime dependencies and this is part of the package.
 */
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ENTRY_SHEET = 'styles/zx.css';
const CORE_SHEET = 'styles/core.css';
const COMPONENT_SHEETS = 'src/components/';

const USAGE = `Usage:
  zx-css <component...> --out <file> [--min] [--layer]
  zx-css <component...> --list

  --out <file>  write the stylesheet to this file
  --min         strip comments and whitespace
  --layer       put everything in @layer zx, so unlayered application rules win
  --list        print the files the subset contains, in order, without writing`;

const SHEET_IMPORT = /@import url\("([^"]+)"\);/g;
const MODULE_IMPORT = /^[ \t]*(?:import\s+|(?:import|export)\b[^'"`;]*?\bfrom\s+)['"](\.{1,2}\/[^'"]+)['"]/gm;
// A preceding `-` rules out `--zx-*` properties and `data-zx-*` attributes.
const CLASS_NAME = /(?<![\w$-])zx-([a-z0-9-]+)/g;
// The class `Component` puts on a root from `static cssName`, which the source never spells out.
const ROOT_CLASS_NAME = /\bstatic cssName = '([a-z0-9-]+)'/g;
const CSS_CLASS = /\.zx-([a-z0-9-]+)/;
// `zx-<type>` also names the DOM event a component dispatches, and hearing one draws nothing.
const EVENT_NAMES = /\bfor \(const type of \[[^\]]*\]\)|\w*[Ll]isten\w*\([^,()]*,\s*'zx-[a-z-]+'/g;

/**
 * @typedef {Object} SubsetOptions
 * @property {string} [root] Package root holding `styles/` and `src/`. Defaults to this package.
 */

/**
 * @typedef {Object} BuildOptions
 * @property {string} [root] Package root holding `styles/` and `src/`. Defaults to this package.
 * @property {boolean} [min=false] Strip comments and whitespace.
 * @property {boolean} [layer=false] Put the stylesheet in `@layer zx`.
 */

/**
 * @param {string} root Package root.
 * @param {string} file File path relative to the root.
 * @returns {string} File contents.
 */
function read(root, file) {
  return readFileSync(resolve(root, file), 'utf8');
}

/**
 * @param {string} root Package root.
 * @param {string} sheet Stylesheet path relative to the root.
 * @returns {string[]} The sheets it imports, relative to the root, in order.
 */
function importsOf(root, sheet) {
  return [...read(root, sheet).matchAll(SHEET_IMPORT)]
    .map((match) => posix.join(posix.dirname(sheet), match[1]));
}

/**
 * @param {string} root Package root.
 * @returns {string[]} The component stylesheets, in `zx.css` order.
 */
function componentSheets(root) {
  const imports = importsOf(root, ENTRY_SHEET);
  if (imports[0] !== CORE_SHEET) throw new Error(`${ENTRY_SHEET} must import ${CORE_SHEET} first`);
  return imports.filter((sheet) => sheet.startsWith(COMPONENT_SHEETS));
}

/**
 * @param {string} sheet Stylesheet path.
 * @returns {string} The component name, which is the file's name.
 */
function nameOf(sheet) {
  return posix.basename(sheet, '.css');
}

/**
 * Lists the names `resolveSubset` accepts: one for each component stylesheet in `styles/zx.css`.
 * @param {SubsetOptions} [options] Package root.
 * @returns {string[]} Component names, sorted.
 */
export function componentNames({ root = PACKAGE_ROOT } = {}) {
  return componentSheets(root).map(nameOf).sort();
}

/**
 * Splits a stylesheet into its rule preludes and returns the block that opens each selector.
 * @param {string} css Stylesheet source.
 * @returns {Set<string>} Block names.
 */
function leadingBlocks(css) {
  const blocks = new Set();
  const tokens = css.replace(/\/\*[\s\S]*?\*\//g, '').split(/([{};])/);
  for (let index = 1; index < tokens.length; index += 2) {
    if (tokens[index] !== '{' || tokens[index - 1].trimStart().startsWith('@')) continue;
    for (const selector of tokens[index - 1].split(',')) {
      const block = CSS_CLASS.exec(selector)?.[1];
      if (block) blocks.add(block);
    }
  }
  return blocks;
}

/**
 * Maps each block to the component stylesheets that define it. A sheet named after a block is that
 * block's home; `.zx-grid` is the exception, since `grid.css` styles the Grid component and never
 * the class, which is why the sheet has to name the block to claim it. Any other block, such as
 * `.zx-btn` in `button.css`, belongs to the sheets whose selectors open with it, unless the core
 * sheet defines it, in which case every subset already has it. Sheets that only style a block in
 * context, like `.zx-field .zx-select`, do not claim it.
 * @param {string} root Package root.
 * @param {string[]} sheets Component stylesheets.
 * @returns {Map<string, string[]>} Block name to stylesheets.
 */
function blockHomes(root, sheets) {
  const core = new Set(importsOf(root, CORE_SHEET)
    .flatMap((sheet) => [...leadingBlocks(read(root, sheet))]));
  /** @type {Map<string, string[]>} */
  const homes = new Map();
  const sources = sheets.map((sheet) => ({ sheet, css: read(root, sheet) }));
  for (const { sheet, css } of sources) {
    const named = new RegExp(`\\.zx-${nameOf(sheet)}(?![a-z0-9-])`);
    if (named.test(css.replace(/\/\*[\s\S]*?\*\//g, ''))) homes.set(nameOf(sheet), [sheet]);
  }
  const named = new Set(homes.keys());
  for (const { sheet, css } of sources) {
    for (const block of leadingBlocks(css)) {
      if (named.has(block) || core.has(block)) continue;
      homes.set(block, [...(homes.get(block) ?? []), sheet]);
    }
  }
  return homes;
}

/**
 * @param {string} source Module source.
 * @returns {string} The source without its comment lines, which describe other blocks as often as
 *   they name this one's. Trailing comments stay: reaching too far costs bytes, not correctness.
 */
function withoutCommentLines(source) {
  return source.replace(/^\s*(?:\/\*|\*|\/\/).*$/gm, '');
}

/**
 * Walks the static import graph.
 * @param {string} root Package root.
 * @param {string[]} entries Entry modules.
 * @returns {Map<string, string>} Every module reached, with its source.
 */
function moduleGraph(root, entries) {
  const modules = new Map();
  const queue = [...entries];
  for (const module of queue) {
    if (modules.has(module)) continue;
    const source = withoutCommentLines(read(root, module));
    modules.set(module, source);
    for (const [, specifier] of source.matchAll(MODULE_IMPORT)) {
      const target = posix.join(posix.dirname(module), specifier);
      if (existsSync(resolve(root, target))) queue.push(target);
    }
  }
  return modules;
}

/**
 * @param {string} root Package root.
 * @param {string} sheet Component stylesheet.
 * @returns {string|null} Its module: the file beside it, or the presenter of the same name that
 *   several components share from `src/internal/`.
 */
function moduleOf(root, sheet) {
  const candidates = [sheet.replace(/\.css$/, '.js'), `src/internal/${nameOf(sheet)}.js`];
  return candidates.find((file) => existsSync(resolve(root, file))) ?? null;
}

/**
 * Resolves the stylesheets a set of components needs.
 * @param {string[]} names Component names, see `componentNames()`.
 * @param {SubsetOptions} [options] Package root.
 * @returns {string[]} Stylesheets relative to the root: the core sheet, then the components in
 *   `zx.css` order, each once.
 * @throws {Error} When a name is not a component, listing the ones that are.
 */
export function resolveSubset(names, { root = PACKAGE_ROOT } = {}) {
  const sheets = componentSheets(root);
  const sheetOf = new Map(sheets.map((sheet) => [nameOf(sheet), sheet]));
  const unknown = names.filter((name) => !sheetOf.has(name));
  if (unknown.length) {
    throw new Error(`Unknown component: ${unknown.join(', ')}\n`
      + `Known components: ${componentNames({ root }).join(', ')}`);
  }

  const requested = names.map((name) => /** @type {string} */ (sheetOf.get(name)));
  const reached = new Set(requested);
  const homes = blockHomes(root, sheets);
  const entries = requested.map((sheet) => moduleOf(root, sheet)).filter((module) => module !== null);
  for (const [module, source] of moduleGraph(root, entries)) {
    const own = module.replace(/\.js$/, '.css');
    if (sheets.includes(own)) reached.add(own);
    const code = source.replace(EVENT_NAMES, '');
    for (const pattern of [CLASS_NAME, ROOT_CLASS_NAME]) {
      for (const [, token] of code.matchAll(pattern)) {
        for (const sheet of homes.get(token.replace(/-+$/, '')) ?? []) reached.add(sheet);
      }
    }
  }
  return [CORE_SHEET, ...sheets.filter((sheet) => reached.has(sheet))];
}

/**
 * Inlines a stylesheet's imports.
 * @param {string} root Package root.
 * @param {string} sheet Stylesheet path relative to the root.
 * @returns {string} Stylesheet with no `@import` left.
 */
function inlineSheet(root, sheet) {
  return read(root, sheet).replace(SHEET_IMPORT, (statement, href) => (
    inlineSheet(root, posix.join(posix.dirname(sheet), href))
  ));
}

/**
 * Strips comments and the whitespace that means nothing, leaving strings as they are. Whitespace
 * inside a selector or value can be a combinator or a separator, so it collapses but stays.
 * @param {string} css Stylesheet.
 * @returns {string} Minified stylesheet.
 */
function minify(css) {
  let output = '';
  let space = false;
  for (let index = 0; index < css.length;) {
    const char = css[index];
    if (css.startsWith('/*', index)) {
      const end = css.indexOf('*/', index + 2);
      index = end < 0 ? css.length : end + 2;
      space = true;
    } else if (/\s/.test(char)) {
      index += 1;
      space = true;
    } else {
      let end = index + 1;
      if (char === '"' || char === "'") {
        while (end < css.length && css[end] !== char) end += css[end] === '\\' ? 2 : 1;
        end += 1;
      }
      if (space && output && !'{};,'.includes(output.at(-1)) && !'{};,'.includes(char)) output += ' ';
      if (char === '}' && output.endsWith(';')) output = output.slice(0, -1);
      output += css.slice(index, end);
      index = end;
      space = false;
    }
  }
  return output;
}

/**
 * Builds the stylesheet for a set of components.
 * @param {string[]} names Component names.
 * @param {BuildOptions} [options] Package root and output form.
 * @returns {string} Stylesheet with no `@import` left.
 * @throws {Error} When a name is not a component.
 */
export function buildSubset(names, { root = PACKAGE_ROOT, min = false, layer = false } = {}) {
  const css = resolveSubset(names, { root }).map((sheet) => inlineSheet(root, sheet)).join('\n');
  const output = layer ? `@layer zx {\n${css}\n}\n` : css;
  return min ? minify(output) : output;
}

/**
 * Runs the command line.
 * @param {string[]} args Arguments after the program name.
 * @returns {number} Exit code.
 */
function main(args) {
  try {
    const { values, positionals } = parseArgs({
      args,
      allowPositionals: true,
      options: {
        out: { type: 'string' },
        min: { type: 'boolean' },
        layer: { type: 'boolean' },
        list: { type: 'boolean' }
      }
    });
    if (!positionals.length || (!values.out && !values.list)) throw new Error(USAGE);
    if (values.list) {
      console.log(resolveSubset(positionals).join('\n'));
      return 0;
    }
    const out = resolve(/** @type {string} */ (values.out));
    const css = buildSubset(positionals, { min: values.min, layer: values.layer });
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, css);
    console.log(`${values.out}: ${positionals.join(', ')} (${(Buffer.byteLength(css) / 1000).toFixed(1)} kB)`);
    return 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
