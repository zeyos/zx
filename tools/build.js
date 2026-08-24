import { execFile } from 'node:child_process';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { dirname, resolve } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');

const assets = [
  { name: 'ESM', entry: 'src/index.js', file: 'zx.esm.js', format: 'esm' },
  { name: 'ZeyOS', entry: 'src/zeyos/index.js', file: 'zx-zeyos.esm.js', format: 'esm' },
  { name: 'Global', entry: 'src/index.js', file: 'zx.global.js', format: 'iife', globalName: 'zx' },
  { name: 'CSS', entry: 'styles/zx.css', file: 'zx.css' }
];

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await Promise.all(assets.flatMap((asset) => [false, true].map((minify) => {
  const extension = asset.file.endsWith('.css') ? '.css' : '.js';
  const outfile = minify ? asset.file.replace(extension, `.min${extension}`) : asset.file;
  return build({
    absWorkingDir: root,
    entryPoints: [asset.entry],
    outfile: resolve(dist, outfile),
    bundle: true,
    minify,
    format: asset.format,
    globalName: asset.globalName,
    platform: 'browser',
    target: 'es2022',
    legalComments: 'none',
    logLevel: 'silent'
  });
})));

const report = [];
for (const asset of assets) {
  const extension = asset.file.endsWith('.css') ? '.css' : '.js';
  const minFile = asset.file.replace(extension, `.min${extension}`);
  const [raw, minified] = await Promise.all([
    readFile(resolve(dist, asset.file)),
    readFile(resolve(dist, minFile))
  ]);
  report.push({
    asset: asset.name,
    raw: formatSize(raw.byteLength),
    minified: formatSize(minified.byteLength),
    gzip: formatSize(gzipSync(minified).byteLength)
  });
}

/*
 * Type declarations. Zx has no TypeScript in it — `tsc` reads the JSDoc that is already on every
 * public class, option object, and event, and writes `dist/types/**.d.ts`, which `exports` points
 * at. Consumers get completion and type checking without the library growing a compile step of its
 * own, and the types cannot drift from the documentation because they are the same text.
 */
// tsc must exit clean. Declarations that do not type-check are worse than none: a consumer who
// has not turned `skipLibCheck` on inherits the errors, in files they did not write.
try {
  await promisify(execFile)(
    process.execPath,
    [resolve(root, 'node_modules/typescript/bin/tsc'), '--project', resolve(root, 'tsconfig.json')],
    { cwd: root }
  );
} catch (error) {
  const output = [error.stdout, error.stderr].filter(Boolean).join('\n').trim();
  throw new Error(`tsc failed while emitting declarations:\n${output}`);
}

const declarations = await declarationCount(resolve(dist, 'types'));
if (declarations === 0) throw new Error('tsc emitted no declarations — dist/types is empty');

console.log('\nZx distribution sizes');
console.table(report);
console.log(`Type declarations: ${declarations} .d.ts files in dist/types`);

/** @param {string} directory @returns {Promise<number>} */
async function declarationCount(directory) {
  const { readdir } = await import('node:fs/promises');
  let total = 0;
  for (const entry of await readdir(directory, { withFileTypes: true, recursive: true })) {
    if (entry.isFile() && entry.name.endsWith('.d.ts')) total += 1;
  }
  return total;
}

/** @param {number} bytes @returns {string} */
function formatSize(bytes) {
  return `${(bytes / 1024).toFixed(1)} kB`;
}
