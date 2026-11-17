/**
 * Verifies that every internal reference in the built site resolves to a file that exists.
 *
 * `tools/build-site.js` rewrites the relative paths that used to escape `website/`. That rewrite
 * is mechanical, so the failure mode is silent: a page still loads, but one stylesheet, module,
 * or fetched document 404s. This check walks the output and resolves every import, `href`, `src`,
 * and `url()` against the site root, plus the demo ids `docs.js` and the layout ids
 * `layouts/index.js` name for dynamic import.
 *
 * It also holds the published site to the content rules: no private paths, no pointers into
 * internal material, and no names of the products the layout templates took their patterns from.
 * Every header navigation link must carry the `data-nav` attribute its glyph is chosen by.
 *
 * Absolute paths are skipped on purpose: the Getting started guides contain code samples with
 * paths like `/assets/zx.css`, which describe a consumer's deployment rather than this site. The
 * one exception is the revision tree: `/v/<rev>/…` is written only by `tools/build-site.js`, when it
 * repoints the pages at the versioned copy, so those references are resolved against the site root.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyClientVendor } from './build-client-vendor.js';

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
  /^[\t ]*(?:import|export)\s[\w\s{},*]*?\bfrom\s*['"]([^'"]+)['"]/gm,
  /^[\t ]*import\s*['"]([^'"]+)['"]/gm,
  /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g
];

/** Reference positions: ES imports, HTML attributes, CSS url(), and quoted CSS @import. */
const PATTERNS = [
  ...IMPORT_PATTERNS,
  /\b(?:href|src)\s*=\s*"([^"]+)"/g,
  /\burl\(\s*["']?([^"')]+)["']?\s*\)/g,
  /@import\s+["']([^"']+)["']/g
];
/** A reference into the revision-stamped copy the build points the root pages at. */
const REVISIONED = /^\/v\/[^/]+\//;
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
const vendorDirectories = [join(site, 'vendor')];
if (existsSync(join(site, 'v'))) {
  for (const entry of readdirSync(join(site, 'v'), { withFileTypes: true })) {
    if (entry.isDirectory()) vendorDirectories.push(join(site, 'v', entry.name, 'vendor'));
  }
}
for (const directory of vendorDirectories) {
  if (!existsSync(join(directory, 'zeyos-client.esm.js'))
    && !existsSync(join(directory, 'zeyos-client.manifest.json'))) continue;
  try { await verifyClientVendor(directory); }
  catch (error) { problems.push(`${relative(site, directory)}/zeyos-client.esm.js → ${error.message}`); }
}
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
      const revisioned = REVISIONED.test(clean);
      const rooted = revisioned || (!clean.startsWith('./') && !clean.startsWith('../'));
      if (rooted && !revisioned && !SITE_ENTRIES.has(clean.split('/')[0])) continue;
      const target = revisioned ? join(site, clean.slice(1)) : resolve(rooted ? site : dirname(file), clean);
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
        if (extension === '.html' && /(?:href|src)=["']\/v\/[^/]+\//.test(source)
          && /^(?:\.{1,2}\/|\/)/.test(specifier) && !specifier.startsWith('/v/')) {
          problems.push(`${relative(site, file)} → unversioned inline module import "${specifier}" alongside revisioned assets`);
        }
        if (/^(?:\.{1,2}\/|\/)/.test(specifier)) continue;
        problems.push(`${relative(site, file)} → bare module specifier "${specifier}"`);
      }
    }
  }
}

// The documentation app imports its demos by id, which the patterns above cannot see.
const docsSource = readFileSync(join(site, 'docs.js'), 'utf8');
const componentIds = readIdList(docsSource, 'COMPONENT_IDS');
if (componentIds.length === 0) problems.push('docs.js → COMPONENT_IDS is empty or unreadable');
for (const id of componentIds) {
  if (!existsSync(join(site, 'demos', `${id}.demo.js`))) {
    problems.push(`docs.js COMPONENT_IDS → demos/${id}.demo.js`);
  }
}
// And the other way round: a demo module no id names is published but unreachable — no page
// builds it, no search finds it, and nothing notices when the API it shows changes.
if (componentIds.length && existsSync(join(site, 'demos'))) {
  const registered = new Set(componentIds);
  for (const entry of readdirSync(join(site, 'demos'))) {
    if (!entry.endsWith('.demo.js')) continue;
    const id = entry.slice(0, -'.demo.js'.length);
    if (!registered.has(id)) problems.push(`demos/${entry} → not in docs.js COMPONENT_IDS (unreachable demo)`);
  }
}

// The gallery and the documentation search import the layouts by id from their registry. Every
// layout needs its module and its stylesheet, which `layouts.css` imports.
const registrySource = existsSync(join(site, 'layouts', 'index.js'))
  ? readFileSync(join(site, 'layouts', 'index.js'), 'utf8') : '';
for (const [listName, files] of [
  ['TEMPLATE_IDS', ['.layout.js', '.layout.css']],
  ['PATTERN_IDS', ['.layout.js', '.layout.css']]
]) {
  const ids = readIdList(registrySource, listName);
  if (ids.length === 0) problems.push(`layouts/index.js → ${listName} is empty or unreadable`);
  for (const id of ids) {
    for (const suffix of files) {
      if (!existsSync(join(site, 'layouts', `${id}${suffix}`))) {
        problems.push(`layouts/index.js ${listName} → layouts/${id}${suffix}`);
      }
    }
  }
}

// The pages and what they cannot work without — among them the standalone layout page
// (`layout.html#<id>`), which every gallery tile and the gallery's popup link to.
for (const required of [
  'index.html', 'docs.html', 'layouts.html', 'layouts.js', 'layouts.css', 'layouts/kit.css',
  'layout.html', 'layout.js', 'layout-host.js', 'llms.txt', 'CNAME',
  'docs/llms.md'
]) {
  if (!existsSync(join(site, required))) problems.push(`missing required file: ${required}`);
}

// The agent documentation's tiers link each other by absolute address, which the reference check
// above skips. Every document `llms.txt` names under `/docs/` must be published — the small tier,
// the component index, the surface guide and catalogue — and so must every component file the
// small tier and the index name. Once the component files are published there must be one for
// every component page, since each page's "Copy prompt" points at its file, and the small tier is
// also served at the root, beside `/llms.txt`.
const SITE_ORIGIN = 'https://zx.zeyos.com/';
for (const tier of ['llms.txt', 'docs/llms-small.txt', 'docs/components/index.md']) {
  const path = join(site, tier);
  if (!existsSync(path)) continue;
  const text = readFileSync(path, 'utf8');
  const named = [
    ...[...text.matchAll(/https:\/\/zx\.zeyos\.com\/(docs\/[\w./-]+\.(?:md|txt|json))/g)].map(([, target]) => target),
    ...(tier === 'docs/components/index.md' ? [...text.matchAll(/\]\(([\w-]+\.md)\)/g)].map(([, file]) => `docs/components/${file}`) : [])
  ];
  for (const target of new Set(named)) {
    if (!existsSync(join(site, target))) problems.push(`${tier} → ${SITE_ORIGIN}${target}`);
  }
}
if (existsSync(join(site, 'docs', 'components', 'index.md'))) {
  for (const id of componentIds) {
    if (!existsSync(join(site, 'docs', 'components', `${id}.md`))) problems.push(`docs.js COMPONENT_IDS → docs/components/${id}.md`);
  }
}
if (existsSync(join(site, 'docs', 'llms-small.txt')) && !existsSync(join(site, 'llms-small.txt'))) {
  problems.push('missing required file: llms-small.txt (the small tier, beside llms.txt)');
}

// Every header link names its glyph with `data-nav`. `site.css` picks the icon from that attribute
// because the host serves the pages at clean URLs (`/docs`), so a link's `href` is not something
// the stylesheet can rely on; a link without the attribute shows no glyph at all.
const SITE_NAV = /<nav\b[^>]*\bclass="[^"]*\bsite-nav\b[^"]*"[^>]*>([\s\S]*?)<\/nav>/gi;
for (const file of files) {
  if (extname(file).toLowerCase() !== '.html') continue;
  for (const [, nav] of readFileSync(file, 'utf8').matchAll(SITE_NAV)) {
    for (const [tag] of nav.matchAll(/<a\b[^>]*>/gi)) {
      if (!/\sdata-nav="[^"\s]+"/.test(tag)) problems.push(`${relative(site, file)} → header link without data-nav: ${tag}`);
    }
  }
}

// Compatibility and operating material may remain in the repository/package for supported
// consumers, but it is deliberately not documentation-site content.
for (const privatePath of [
  'MIGRATION.md',
  'AGENTS.md',
  'DESIGN-SYSTEM.md',
  'skills',
  'compat.html',
  'aurora.html',
  'aurora.css',
  'aurora.js',
  'aurora-preview.html',
  'aurora-preview.css',
  'demos/gx-compat.demo.js',
  'src/compat',
  'src/compat-entry.js',
  'docs/DESIGN-NOTES.md',
  'docs/RELEASING.md',
  // Work packages are the contributor contract's planning material: binding on whoever
  // implements them, and meaningless to a consumer reading the site.
  'specs',
  // Contributor tooling, including the layout harness and the screenshot tool.
  'tests',
  'tools'
]) {
  if (existsSync(join(site, privatePath))) problems.push(`private path published: ${privatePath}`);
}

/*
 * The other half of the same rule, and the half a path check cannot see.
 *
 * Not publishing a file is not the same as not publishing its CONTENT. A release note that
 * opens "Implements `specs/WP-35-…`" ships a dangling pointer into internal planning material
 * even though `specs/` itself never leaves the repository — and the existing checks pass,
 * because it is prose rather than a resolvable reference. That mistake has been made, which is
 * why it is checked.
 *
 * Scoped to documentation output — `.md`, `.html`, `.txt` (the agent indexes) and the demo
 * modules, whose source every component page shows as its example code — and not to published
 * library source. A code comment saying "see AGENTS.md" is a pointer for a contributor reading a
 * file that ships in the package anyway; a sentence in the release notes or an example is the site
 * telling a customer to read something they cannot have.
 */
const INTERNAL_MENTIONS = ['specs/', 'AGENTS.md', 'DESIGN-NOTES.md', 'RELEASING.md', 'DESIGN-SYSTEM.md'];
const DOCUMENTATION = new Set(['.md', '.html', '.txt']);

for (const file of files) {
  const relativePath = relative(site, file);
  const demo = relativePath.split(sep)[0] === 'demos' && extname(file) === '.js';
  if (!DOCUMENTATION.has(extname(file)) && !demo) continue;
  // Published source carries its own contributor comments; only prose is in scope here.
  if (relativePath.split(sep)[0] === 'src') continue;

  const text = readFileSync(file, 'utf8');
  for (const mention of INTERNAL_MENTIONS) {
    if (text.includes(mention)) {
      problems.push(`internal path named in published documentation: ${relativePath} mentions ${mention}`);
    }
  }
}

/*
 * The application templates take their information architecture from well-known products, and
 * the public website must never say which. Matched case-sensitively on the names as those
 * products write them, across every published text file, the vendored bundles included.
 */
const REFERENCE_PRODUCTS = [
  'Superhuman', 'linear.app', 'Docmost', 'TypingMind', 'easybill', 'ERPNext', 'Frappe',
  'rhythms.ai', 'NetBox', 'Attio'
];
const TEXT = new Set(['.html', '.js', '.mjs', '.css', '.md', '.txt', '.json', '.svg', '.xml']);

for (const file of files) {
  if (!TEXT.has(extname(file).toLowerCase())) continue;
  const text = readFileSync(file, 'utf8');
  for (const name of REFERENCE_PRODUCTS) {
    if (text.includes(name)) problems.push(`reference product named in published file: ${relative(site, file)} mentions ${name}`);
  }
}

if (problems.length > 0) {
  console.error(`Broken references in the built site (${problems.length}):\n`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}
console.log(`Site check passed (${files.length} files, no broken references, private paths, or reference product names).`);

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
  // The build's own revision-stamped references are this site's, and must resolve.
  if (REVISIONED.test(reference)) return true;
  // Any other absolute path in the guides describes a consumer's deployment, not this site.
  if (reference.startsWith('/')) return false;
  // Explicitly relative paths are always ours.
  if (reference.startsWith('./') || reference.startsWith('../')) return true;
  // Otherwise only treat it as a file if it actually names one: this skips the bare package
  // specifiers that appear in the guides' code samples, such as `@zeyos/client`.
  return /^[\w][\w./-]*\.\w+$/.test(reference.split('#')[0].split('?')[0]);
}

/**
 * Reads a flat array of string literals assigned to a const: a list of ids in `docs.js` or in the
 * layout registry.
 * @param {string} source Module text.
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
