/**
 * Assembles the deployable documentation site into `site/`.
 *
 * The website is developed in place: `website/docs.html` loads `../styles/zx.css`, the demos
 * import `../../src/index.js`, and `docs.js` fetches `../docs/llms.md`. That keeps development
 * build-free, but it means the site cannot simply be served from `website/` — half of what it
 * needs lives above it.
 *
 * This script therefore flattens one level: the contents of `website/` become the site root, and
 * the directories it reaches into (`src/`, `styles/`, `docs/`, the repository markdown) are copied
 * in beside them. Every relative path that used to escape `website/` loses exactly one `../`;
 * paths that stayed inside it are left alone. Nothing is bundled or minified, so the JavaScript
 * tab keeps showing the same source the browser actually runs.
 */
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const websiteDir = join(root, 'website');
const outDir = join(root, 'site');

/**
 * Directories and files the website reaches into, copied in beside the flattened website as
 * `[source, destination]`. The agent skill is republished as `skills/` rather than `.claude/`:
 * dot-directories are handled inconsistently by static hosts, and a docs site should not depend
 * on any one of them serving hidden paths.
 */
const EXTRA_SOURCES = [
  ['src', 'src'],
  ['styles', 'styles'],
  ['docs', 'docs'],
  ['.claude/skills', 'skills'],
  ['README.md', 'README.md'],
  ['MIGRATION.md', 'MIGRATION.md'],
  ['AGENTS.md', 'AGENTS.md']
];

/**
 * Files inside `website/` that are not part of the deployed site. `website/README.md` documents
 * how to work on the website itself; the repository README is what the guides link to, and both
 * would land on `README.md` in the output.
 */
const WEBSITE_EXCLUDE = new Set(['README.md']);

/** Extensions whose contents get their escaping paths rewritten. */
const TEXT_EXTENSIONS = new Set(['.html', '.js', '.css', '.txt', '.md', '.json', '.svg']);

const domain = process.env.SITE_DOMAIN ?? 'zx.zeyos.com';

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

// 1. The website becomes the site root.
await cp(websiteDir, outDir, {
  recursive: true,
  filter: (source) => !WEBSITE_EXCLUDE.has(relative(websiteDir, source))
});

// 2. Everything it reaches into is copied in beside it. A copied-in tree must never land on a
//    file the website already provides: `assets/` exists at both levels with a `zx-logo.svg` in
//    each, and silently overwriting the website's copy with the repository's unstyled master
//    would ship a logo with no brand colour and no way to notice.
for (const [source, destination] of EXTRA_SOURCES) {
  const from = join(root, source);
  if (!(await exists(from))) continue;
  const to = join(outDir, destination);
  const clash = await firstClash(from, to);
  if (clash !== null) {
    throw new Error(
      `Refusing to build: copying ${source}/ into the site would overwrite ${clash}, `
      + 'which the website already provides. Rename one of them or drop the copy.'
    );
  }
  await cp(from, to, { recursive: true });
}

// 3. Rewrite the paths that used to escape `website/`.
let rewritten = 0;
for (const file of await walk(outDir)) {
  if (!TEXT_EXTENSIONS.has(extname(file).toLowerCase())) continue;
  const sourceDir = sourceDirOf(file);
  if (sourceDir === null) continue;

  const original = await readFile(file, 'utf8');
  const updated = original.replace(/(?<=['"(])\.\.\/[^'")\s]*/g, (reference) => {
    const target = resolve(sourceDir, reference);
    // A path that still lands inside `website/` keeps working unchanged.
    if (target === websiteDir || target.startsWith(websiteDir + sep)) return reference;
    if (!target.startsWith(root + sep)) return reference;
    // Keep the result explicitly relative. Stripping the last `../` from a file at the site root
    // would otherwise yield `src/index.js`, which an HTML attribute tolerates but a JS import
    // does not: bare specifiers are reserved for packages, so the module fails to resolve.
    const stripped = renamed(reference.replace('../', ''));
    return stripped.startsWith('.') || stripped.startsWith('/') ? stripped : `./${stripped}`;
  });
  if (updated !== original) {
    await writeFile(file, updated);
    rewritten += 1;
  }
}

// 4. Host-specific extras. Both are harmless on hosts that ignore them, which is what lets the
//    same output deploy to GitHub Pages or Netlify unchanged: Pages reads the custom domain from
//    a CNAME file and needs `.nojekyll` so it stops treating the output as a Jekyll source tree.
await writeFile(join(outDir, 'CNAME'), `${domain}\n`);
await writeFile(join(outDir, '.nojekyll'), '');

const files = await walk(outDir);
const bytes = (await Promise.all(files.map(async (file) => (await stat(file)).size)))
  .reduce((total, size) => total + size, 0);

console.log(`Zx site → ${relative(root, outDir)}/`);
console.log(`  ${files.length} files, ${(bytes / 1024 / 1024).toFixed(2)} MB`);
console.log(`  ${rewritten} files had escaping paths rewritten`);
console.log(`  CNAME: ${domain}`);

/**
 * Maps a file in the output tree back to the directory it was copied from, so its relative paths
 * can be resolved the way the browser resolved them during development.
 * @param {string} file Absolute path inside `site/`.
 * @returns {string|null} The source directory, or null when the file came from outside `website/`.
 */
function sourceDirOf(file) {
  const relativePath = relative(outDir, file);
  const [first] = relativePath.split(sep);
  // Copied-in directories keep their original relative paths; only the flattened website moved.
  if (EXTRA_SOURCES.some(([, destination]) => destination.split('/')[0] === first)) return null;
  return join(websiteDir, dirname(relativePath));
}

/**
 * Applies the source→destination renames to an already-flattened reference.
 * @param {string} reference Reference relative to the site.
 * @returns {string}
 */
function renamed(reference) {
  for (const [source, destination] of EXTRA_SOURCES) {
    if (source === destination) continue;
    if (reference === source) return destination;
    if (reference.startsWith(`${source}/`)) return `${destination}${reference.slice(source.length)}`;
  }
  return reference;
}

/**
 * Lists every file beneath a directory.
 * @param {string} directory Directory to walk.
 * @returns {Promise<string[]>}
 */
async function walk(directory) {
  const found = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) found.push(...await walk(path));
    else if (entry.isFile()) found.push(path);
  }
  return found;
}

/**
 * Returns the first path that copying `from` onto `to` would overwrite.
 * @param {string} from Source path.
 * @param {string} to Destination path inside the site.
 * @returns {Promise<string|null>} Site-relative path of the clash, or null when there is none.
 */
async function firstClash(from, to) {
  if (!(await exists(to))) return null;
  const source = await stat(from);
  if (source.isFile()) return relative(outDir, to);
  for (const entry of await readdir(from, { withFileTypes: true })) {
    const clash = await firstClash(join(from, entry.name), join(to, entry.name));
    if (clash !== null) return clash;
  }
  return null;
}

/** @param {string} path @returns {Promise<boolean>} */
async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}
