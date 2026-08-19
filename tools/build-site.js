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
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
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

// 4. Stamp the published version into the markup. The website carries a literal so development
//    shows something sensible, but package.json is the source of truth: whatever `npm version`
//    set is what the deployed site says, with no second place to remember to bump.
const { version } = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
let stamped = 0;
for (const file of await walk(outDir)) {
  if (extname(file).toLowerCase() !== '.html') continue;
  const original = await readFile(file, 'utf8');
  // Count the elements found, not the files rewritten: when the checked-in literal already
  // matches package.json nothing changes on disk, and "0 stamped" would read like a failure.
  const updated = original.replace(
    /(<([a-z]+)[^>]*\sdata-site-version[^>]*>)[^<]*(<\/\2>)/gi,
    (...match) => {
      stamped += 1;
      return `${match[1]}${version}${match[3]}`;
    }
  );
  if (updated !== original) await writeFile(file, updated);
}

// 4b. Publish a second, revision-stamped copy of the whole tree at `v/<rev>/`, and point the
//     pages at it.
//
//     The site is served through a CDN that rewrites Cache-Control to its own browser TTL, so the
//     headers in `netlify.toml` cannot be relied on to expire anything: the only way to guarantee
//     a visitor never pairs a new page with an old module is to give the new deploy different
//     URLs. A query string would do that for browsers, but a CDN can be configured to drop the
//     query from its cache key, and then the busting is silently gone. A path cannot be dropped.
//
//     Hashing each file into its own name would mean rewriting the `import` statements that name
//     it — and this site displays those statements as its documentation, so a reader would be
//     shown `from '../src/index.a1b2c3.js'`. Versioning one directory keeps every relative path
//     inside the tree byte-identical, which is why this needs no path rewriting at all: the copy
//     is complete, so every relative reference resolves to its versioned neighbour.
//
//     The root copy stays where it is. It is what serves the stable public URLs — `/docs/llms.md`,
//     `/llms.txt`, `/README.md` — and the duplication costs a couple of megabytes on a static
//     host, which is a fair price for a deploy that cannot go half-stale.
const rev = await revision();
const versionedDir = join(outDir, 'v', rev);
await mkdir(versionedDir, { recursive: true });
// Entry by entry: `cp` refuses to copy a directory into a subdirectory of itself, and `v/` is
// inside the tree being copied.
for (const entry of await readdir(outDir)) {
  if (entry === 'v') continue;
  await cp(join(outDir, entry), join(versionedDir, entry), { recursive: true });
}

// Only the pages at the root are repointed. The copies inside `v/<rev>/` keep their relative
// references, so that tree also works when opened directly — it simply stays on its own revision.
let repointed = 0;
for (const file of await walk(outDir)) {
  if (extname(file).toLowerCase() !== '.html') continue;
  if (relative(outDir, file).split(sep)[0] === 'v') continue;
  const original = await readFile(file, 'utf8');
  const updated = original.replace(
    /((?:href|src)=")([^"?#]+\.(?:css|js))(")/gi,
    (whole, lead, path, tail) => {
      // An absolute reference is rooted at the site, a relative one at the page holding it. A
      // target that is not in the output is documentation — the guides quote `<script
      // src="/assets/zx.global.js">` as installation advice — and must be left alone.
      const key = assetKey(file, path);
      if (!existsSync(join(versionedDir, key))) return whole;
      repointed += 1;
      return `${lead}/v/${rev}/${key}${tail}`;
    }
  );
  if (updated !== original) await writeFile(file, updated);
}

/**
 * Resolves a reference written inside `file` to its site-relative key.
 * @param {string} file Absolute path of the file holding the reference.
 * @param {string} reference Href or src target.
 * @returns {string}
 */
function assetKey(file, reference) {
  const target = reference.startsWith('/')
    ? join(outDir, reference.slice(1))
    : resolve(dirname(file), reference);
  return relative(outDir, target).split(sep).join('/');
}

/**
 * The revision the versioned directory is named after. The commit is what a reader would want to
 * map a deployed URL back to, and Netlify supplies it; a build from a tree with no git falls back
 * to hashing the output, which changes on exactly the same occasions.
 * @returns {Promise<string>}
 */
async function revision() {
  const supplied = process.env.SITE_REV ?? process.env.COMMIT_REF;
  if (supplied) return supplied.trim().slice(0, 8);
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim().slice(0, 8);
  } catch {
    const digest = createHash('sha256');
    for (const file of (await walk(outDir)).sort()) {
      digest.update(relative(outDir, file)).update(await readFile(file));
    }
    return digest.digest('hex').slice(0, 8);
  }
}

// 5. Host-specific extras. Both are harmless on hosts that ignore them, which is what lets the
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
console.log(`  version ${version} stamped into ${stamped} element(s)`);
console.log(`  revision ${rev}: ${repointed} reference(s) repointed at v/${rev}/`);
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
