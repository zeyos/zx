import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { build } from 'esbuild';
import * as zx from '../../src/index.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));

test('side-effect source imports register component Field adapters after tree-shaking', async () => {
  const result = await build({
    absWorkingDir: root,
    stdin: { contents: "import './src/index.js'; import { Field } from './src/components/field/field.js'; export const registered = ['zxselect', 'rating', 'slider'].map(type => Field.has(type));", resolveDir: root, sourcefile: 'consumer.js' },
    bundle: true, treeShaking: true, write: false, format: 'esm', platform: 'node', target: 'es2022', logLevel: 'silent'
  });
  const consumer = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].contents).toString('base64')}`);
  assert.deepEqual(consumer.registered, [true, true, true]);
});

test('a distribution consumer retains adapters within its bundled entry', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'zx-package-consumer-'));
  try {
    const library = await build({ absWorkingDir: root, entryPoints: ['src/index.js'], bundle: true,
      write: false, format: 'esm', platform: 'browser', target: 'es2022', logLevel: 'silent' });
    await mkdir(join(directory, 'dist'));
    await writeFile(join(directory, 'dist/zx.esm.js'), library.outputFiles[0].contents);
    await writeFile(join(directory, 'package.json'), JSON.stringify({ type: 'module', sideEffects: pkg.sideEffects }));
    const result = await build({ stdin: {
      contents: "import './dist/zx.esm.js'; import { Field } from './dist/zx.esm.js'; export const registered = ['zxselect', 'rating', 'slider'].map(type => Field.has(type));",
      resolveDir: directory, sourcefile: 'consumer.js'
    }, bundle: true, treeShaking: true, write: false, format: 'esm', platform: 'node', target: 'es2022', logLevel: 'silent' });
    const consumer = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].contents).toString('base64')}`);
    assert.deepEqual(consumer.registered, [true, true, true]);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('public component classes are discoverable in the README', () => {
  const readme = readFileSync(new URL('../../README.md', import.meta.url), 'utf8');
  const missing = Object.entries(zx).filter(([name, value]) => typeof value === 'function'
    && value.prototype instanceof zx.Component && !readme.includes('`' + name + '`')).map(([name]) => name);
  assert.deepEqual(missing, []);
});

test('public Surface references ship and working material stays outside the package allowlist', () => {
  for (const path of ['docs/agent-surfaces.md', 'docs/agent-catalog.json']) assert(pkg.files.includes(path), path);
  assert(!pkg.dependencies, 'no runtime dependencies');
  for (const path of pkg.files) assert(!/^(specs|tests|tools|\.pi|AGENTS\.md)(?:\/|$)/.test(path), path);
});

test('build tools use exact existing lockfile versions and CI never falls back to install', () => {
  const lock = JSON.parse(readFileSync(new URL('../../package-lock.json', import.meta.url), 'utf8'));
  for (const [name, version] of Object.entries(pkg.devDependencies)) {
    assert.match(version, /^\d+\.\d+\.\d+$/);
    assert.equal(lock.packages[''].devDependencies[name], version);
    assert.equal(lock.packages[`node_modules/${name}`].version, version);
  }
  for (const name of ['ci', 'pages', 'publish']) {
    const workflow = readFileSync(new URL(`../../.github/workflows/${name}.yml`, import.meta.url), 'utf8');
    assert.match(workflow, /run: npm ci/);
    assert.doesNotMatch(workflow, /npm install/);
  }
});

test('both machine-readable discovery entry points carry the same public inventory', () => {
  const docs = readFileSync(new URL('../../docs/llms.txt', import.meta.url), 'utf8');
  const website = readFileSync(new URL('../../website/llms.txt', import.meta.url), 'utf8');
  assert.equal(website, docs);
});
