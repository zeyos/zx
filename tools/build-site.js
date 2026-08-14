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

/** Directories and files the website reaches into, copied in beside the flattened website. */
const EXTRA_SOURCES = [
  'src', 'styles', 'docs', 'assets', '.claude/skills',
  'README.md', 'MIGRATION.md', 'AGENTS.md'
];

/** Extensions whose contents get their escaping paths rewritten. */
const TEXT_EXTENSIONS = new Set(['.html', '.js', '.css', '.txt', '.md', '.json', '.svg']);

const domain = process.env.SITE_DOMAIN ?? 'zx.zeyos.com';

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

// 1. The website becomes the site root.
await cp(websiteDir, outDir, { recursive: true });

// 2. Everything it reaches into is copied in beside it.
for (const entry of EXTRA_SOURCES) {
  const from = join(root, entry);
  if (!(await exists(from))) continue;
  await cp(from, join(outDir, entry), { recursive: true });
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
    return reference.replace('../', '');
  });
  if (updated !== original) {
    await writeFile(file, updated);
    rewritten += 1;
  }
}

// 4. GitHub Pages serves the custom domain from a CNAME file at the site root, and `.nojekyll`
//    stops Jekyll from dropping the `.claude` directory and other underscore/dot paths.
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
  if (EXTRA_SOURCES.some((entry) => entry.split('/')[0] === first)) return null;
  return join(websiteDir, dirname(relativePath));
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

/** @param {string} path @returns {Promise<boolean>} */
async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}
