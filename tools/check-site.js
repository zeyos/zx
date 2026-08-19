/**
 * Verifies that every internal reference in the built site resolves to a file that exists.
 *
 * `tools/build-site.js` rewrites the relative paths that used to escape `website/`. That rewrite
 * is mechanical, so the failure mode is silent: a page still loads, but one stylesheet, module,
 * or fetched document 404s. This check walks the output and resolves every import, `href`, `src`,
 * and `url()` against the site root, plus the demo and layout ids `docs.js` imports dynamically.
 *
 * Absolute paths are skipped on purpose: the Getting started guides contain code samples with
 * paths like `/assets/zx.css`, which describe a consumer's deployment rather than this site.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const site = resolve(root, process.env.SITE_DIR ?? 'site');

if (!existsSync(site)) {
  console.error(`No site at ${relative(root, site)}/ — run \`npm run build:site\` first.`);
  process.exit(1);
}

/** Files whose references are checked. */
const CHECKED = new Set(['.html', '.js', '.css']);
/**
 * Where an ES module specifier can appear. `from` is anchored to a statement that starts a line,
 * with only the characters an import clause may contain in between: the documentation is full of
 * prose, and a sentence that happens to end a line with the word "from" before a quoted string is
 * otherwise indistinguishable from an import.
 */
const IMPORT_PATTERNS = [
  /^(?:import|export)\s[\w\s{},*]*?\bfrom\s*['"]([^'"]+)['"]/gm,
  /^import\s*['"]([^'"]+)['"]/gm,
  /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g
];

/** Reference positions: ES imports, HTML attributes, and CSS url(). */
const PATTERNS = [
  ...IMPORT_PATTERNS,
  /\b(?:href|src)\s*=\s*"([^"]+)"/g,
  /\burl\(\s*["']?([^"')]+)["']?\s*\)/g
];
/**
 * Quoted paths in scripts that name a real asset — `fetch()` targets and constants such as
 * `DOCS_URL` are references the patterns above cannot see, and they fail silently.
 *
 * Demos are full of file-shaped sample data ("Specification.md", "floorplan.svg"), so a match
 * only counts when its first segment is a real top-level entry of the site; those are resolved
 * against the site root rather than the file, which is how such constants are written.
 */
const SCRIPT_PATH = /['"]([\w][\w./-]*\.(?:js|css|md|txt|json|svg|html))['"]/g;
const SITE_ENTRIES = new Set(readdirSync(site).map((entry) => entry));

const problems = [];
/**
 * Every file whose references are checked. `v/<rev>/` is skipped: it is a verbatim copy of the
 * tree beside it, so checking it again would only duplicate every finding — and the copy is not
 * unverified, because the pages' own `/v/<rev>/…` references are resolved below.
 */
const files = walk(site).filter((file) => relative(site, file).split(sep)[0] !== 'v');

for (const file of files) {
  if (!CHECKED.has(extname(file).toLowerCase())) continue;
  // A vendored third-party bundle's internal strings are not references into this site.
  const vendored = relative(site, file).split(sep)[0] === 'vendor';
  const source = readFileSync(file, 'utf8');
  const patterns = extname(file) === '.js' && !vendored ? [...PATTERNS, SCRIPT_PATH] : PATTERNS;
  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    for (const [, reference] of source.matchAll(pattern)) {
      if (!isInternal(reference)) continue;
      const clean = reference.split('#')[0].split('?')[0];
      const rooted = !clean.startsWith('./') && !clean.startsWith('../');
      if (rooted && !SITE_ENTRIES.has(clean.split('/')[0])) continue;
      const target = resolve(rooted ? site : dirname(file), clean);
      if (!existsSync(target)) {
        problems.push(`${relative(site, file)} → ${reference}`);
      }
    }
  }
}

// Zx has no runtime dependencies, so every module specifier in the site's own scripts must be
// explicitly relative. A bare specifier resolves as a package name and fails in the browser —
// which is exactly what stripping a `../` too eagerly produces.
const INLINE_MODULE = /<script\b[^>]*type=["']module["'][^>]*>([\s\S]*?)<\/script>/gi;
for (const file of files) {
  const extension = extname(file);
  if (extension !== '.js' && extension !== '.html') continue;
  if (relative(site, file).split(sep)[0] === 'vendor') continue;
  const source = readFileSync(file, 'utf8');
  // In HTML only the inline module scripts count: the guides' `<pre>` samples legitimately show
  // bare specifiers such as `@zeyos/client`, and those are not executed.
  const scripts = extension === '.js'
    ? [source]
    : [...source.matchAll(INLINE_MODULE)].map(([, body]) => body);
  for (const script of scripts) {
    for (const pattern of IMPORT_PATTERNS) {
      for (const [, specifier] of script.matchAll(pattern)) {
        if (/^(?:\.{1,2}\/|\/)/.test(specifier)) continue;
        problems.push(`${relative(site, file)} → bare module specifier "${specifier}"`);
      }
    }
  }
}

// The documentation app imports its entries by id, which the patterns above cannot see.
const docsSource = readFileSync(join(site, 'docs.js'), 'utf8');
for (const [listName, directory, suffix] of [
  ['COMPONENT_IDS', 'demos', '.demo.js'],
  ['LAYOUT_IDS', 'layouts', '.layout.js']
]) {
  const ids = readIdList(docsSource, listName);
  if (ids.length === 0) problems.push(`docs.js → ${listName} is empty or unreadable`);
  for (const id of ids) {
    const target = join(site, directory, `${id}${suffix}`);
    if (!existsSync(target)) problems.push(`docs.js ${listName} → ${directory}/${id}${suffix}`);
  }
}

for (const required of ['index.html', 'docs.html', 'llms.txt', 'CNAME', 'docs/llms.md']) {
  if (!existsSync(join(site, required))) problems.push(`missing required file: ${required}`);
}

if (problems.length > 0) {
  console.error(`Broken references in the built site (${problems.length}):\n`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}
console.log(`Site check passed (${files.length} files, no broken internal references).`);

/**
 * Reports whether a reference points at a file inside the site.
 * @param {string} reference Raw reference text.
 * @returns {boolean}
 */
function isInternal(reference) {
  if (reference === '' || reference.startsWith('#')) return false;
  // Template placeholders are resolved separately from the id lists.
  if (reference.includes('${') || reference.includes('$')) return false;
  if (/^[a-z][a-z0-9+.-]*:/i.test(reference)) return false;
  if (reference.startsWith('//')) return false;
  // Absolute paths in the guides describe a consumer's deployment, not this site.
  if (reference.startsWith('/')) return false;
  // Explicitly relative paths are always ours.
  if (reference.startsWith('./') || reference.startsWith('../')) return true;
  // Otherwise only treat it as a file if it actually names one: this skips the bare package
  // specifiers that appear in the guides' code samples, such as `@zeyos/client`.
  return /^[\w][\w./-]*\.\w+$/.test(reference.split('#')[0].split('?')[0]);
}

/**
 * Reads a flat array of string literals assigned to a const in the documentation app.
 * @param {string} source `docs.js` contents.
 * @param {string} name Constant name.
 * @returns {string[]}
 */
function readIdList(source, name) {
  const match = new RegExp(`const ${name}\\s*=\\s*\\[([\\s\\S]*?)\\]`).exec(source);
  if (!match) return [];
  return [...match[1].matchAll(/'([^']+)'/g)].map(([, id]) => id);
}

/**
 * Lists every file beneath a directory.
 * @param {string} directory Directory to walk.
 * @returns {string[]}
 */
function walk(directory) {
  const found = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) found.push(...walk(path));
    else if (statSync(path).isFile()) found.push(path);
  }
  return found;
}
