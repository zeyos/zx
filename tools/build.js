import { mkdir, readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');

const assets = [
  { name: 'ESM', entry: 'src/index.js', file: 'zx.esm.js', format: 'esm' },
  { name: 'ZeyOS', entry: 'src/zeyos/index.js', file: 'zx-zeyos.esm.js', format: 'esm' },
  { name: 'Global', entry: 'src/index.js', file: 'zx.global.js', format: 'iife', globalName: 'zx' },
  { name: 'Compatibility', entry: 'src/compat-entry.js', file: 'zx-compat.global.js', format: 'iife' },
  { name: 'CSS', entry: 'styles/zx.css', file: 'zx.css' }
];

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

console.log('\nZx distribution sizes');
console.table(report);

/** @param {number} bytes @returns {string} */
function formatSize(bytes) {
  return `${(bytes / 1024).toFixed(1)} kB`;
}
