/** Rebuilds or verifies the explicit, dependency-free browser copy of the ZeyOS client. */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build, version as esbuildVersion } from 'esbuild';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const vendor = resolve(root, 'website/vendor');
const bundleName = 'zeyos-client.esm.js';
const manifestName = 'zeyos-client.manifest.json';

/** @param {string|Uint8Array} bytes @returns {string} */
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

/**
 * Checks the committed artifact without a sibling checkout, credentials, or network access.
 * @param {string} [directory=vendor] Directory containing the bundle and manifest.
 * @returns {Promise<object>} Verified provenance manifest.
 */
export async function verifyClientVendor(directory = vendor) {
  const manifest = JSON.parse(await readFile(resolve(directory, manifestName), 'utf8'));
  if (manifest.schemaVersion !== 1 || manifest.package?.name !== '@zeyos/client'
    || !/^\d+\.\d+\.\d+(?:[-+].+)?$/.test(manifest.package?.version ?? '')
    || !/^[a-f0-9]{40,64}$/.test(manifest.source?.revision ?? '')
    || !/^[a-f0-9]{64}$/.test(manifest.source?.sha256 ?? '')
    || !Array.isArray(manifest.source?.files) || !manifest.source.files.length
    || manifest.build?.tool !== 'esbuild' || manifest.build?.version !== esbuildVersion
    || manifest.bundle?.file !== bundleName) throw new Error('Invalid or incompatible ZeyOS client provenance manifest');
  const entries = manifest.source.files;
  if (entries.some((entry) => typeof entry.path !== 'string' || entry.path.startsWith('/')
    || entry.path.split('/').includes('..') || !/^[a-f0-9]{64}$/.test(entry.sha256))) {
    throw new Error('Invalid ZeyOS client source fingerprint');
  }
  if (sha256(JSON.stringify(entries)) !== manifest.source.sha256) throw new Error('ZeyOS client source manifest checksum mismatch');
  const bundle = await readFile(resolve(directory, bundleName));
  if (bundle.byteLength !== manifest.bundle.bytes || sha256(bundle) !== manifest.bundle.sha256) {
    throw new Error('ZeyOS client bundle checksum mismatch; run the explicit vendor update command');
  }
  return manifest;
}

/** @param {string} source Absolute client checkout. @returns {Promise<void>} */
async function rebuild(source) {
  const pkg = JSON.parse(await readFile(resolve(source, 'package.json'), 'utf8'));
  if (pkg.name !== '@zeyos/client' || pkg.license !== 'MIT') throw new Error('Expected the MIT-licensed @zeyos/client checkout');
  const revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: source, encoding: 'utf8' }).trim();
  const license = await readFile(resolve(source, 'LICENSE'), 'utf8');
  // The website only needs the browser client factory; the package root also exports Node-only
  // filesystem loaders for OKF documents. Keep those out of the browser example entirely.
  const options = { entryPoints: ['src/runtime/client.js'], bundle: true, format: 'esm', platform: 'browser', target: 'es2022', legalComments: 'eof' };
  const result = await build({ ...options, absWorkingDir: source, write: false, metafile: true,
    banner: { js: `/*! @zeyos/client ${pkg.version}\n${license.trim()}\n*/` }, logLevel: 'silent' });
  if (result.outputFiles.length !== 1) throw new Error('Expected a single browser module');
  if (Object.values(result.metafile.outputs).some((output) => output.imports.length)) {
    throw new Error('Browser client must not retain runtime module imports');
  }
  const names = [...new Set([...Object.keys(result.metafile.inputs), 'package.json', 'LICENSE'])].sort();
  const files = [];
  for (const name of names) {
    const path = relative(source, resolve(source, name)).split(sep).join('/');
    if (path.startsWith('../')) throw new Error('Client build unexpectedly read outside its source checkout');
    files.push({ path, sha256: sha256(await readFile(resolve(source, name))) });
  }
  const bytes = result.outputFiles[0].contents;
  const manifest = {
    schemaVersion: 1,
    package: { name: pkg.name, version: pkg.version, license: pkg.license },
    source: { repository: 'https://github.com/zeyos/client', revision, sha256: sha256(JSON.stringify(files)), files },
    build: { tool: 'esbuild', version: esbuildVersion, options },
    bundle: { file: bundleName, bytes: bytes.byteLength, sha256: sha256(bytes) }
  };
  await writeFile(resolve(vendor, bundleName), bytes);
  await writeFile(resolve(vendor, manifestName), JSON.stringify(manifest, null, 2) + '\n');
  await verifyClientVendor();
  console.log(`Vendored ${pkg.name}@${pkg.version} from ${revision.slice(0, 8)} (${bytes.byteLength} bytes)`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === '--check') {
    const manifest = await verifyClientVendor();
    console.log(`Client vendor verified: ${manifest.package.name}@${manifest.package.version}`);
  } else if (args.length === 2 && args[0] === '--source') await rebuild(resolve(args[1]));
  else throw new Error('Usage: node tools/build-client-vendor.js --check | --source /path/to/client');
}
