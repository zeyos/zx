import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

/*
 * The `exports` map is the package's public surface and nothing else checks it. A path that stops
 * resolving fails in a consumer's build, not here — and the granular route added for tree-shaking
 * is easy to break silently, because declarations and source modules live in different trees.
 */
const root = fileURLToPath(new URL('../../', import.meta.url));
const manifest = JSON.parse(readFileSync(root + 'package.json', 'utf8'));

test('every published file entry exists', () => {
  // `dist` is a build output; a clean checkout has not made it yet.
  const missing = manifest.files
    .filter((entry) => !entry.startsWith('!'))
    .filter((entry) => !entry.startsWith('dist'))
    .filter((entry) => !existsSync(root + entry));
  assert.deepEqual(missing, []);
});

test('public component source and styles ship, while compatibility source stays internal', () => {
  assert.ok(manifest.files.includes('src'), 'src/ must be published for component source imports');
  assert.ok(manifest.files.includes('styles'), 'styles/ must be published for ./styles/* to resolve');
  assert.ok(manifest.files.includes('!src/compat'));
  assert.ok(manifest.files.includes('!src/compat-entry.js'));
  assert.equal(manifest.exports['./compat'], undefined);
  assert.equal(manifest.exports['./compat-global'], undefined);
});

test('the granular source pattern carries types alongside the module', () => {
  const entry = manifest.exports['./src/components/*.js'];
  assert.ok(entry, 'the public component-source subpath is missing');
  assert.equal(entry.default, './src/components/*.js');
  assert.equal(entry.types, './dist/types/components/*.d.ts',
    'the declaration mirrors the source path with a .d.ts extension — see tsconfig outDir');
});

test('every non-pattern export target that is not a build output exists', () => {
  const targets = [];
  for (const value of Object.values(manifest.exports)) {
    const paths = typeof value === 'string' ? [value] : Object.values(value);
    targets.push(...paths.filter((path) => typeof path === 'string' && !path.includes('*')));
  }
  const missing = targets.filter((path) => !path.startsWith('./dist') && !existsSync(root + path));
  assert.deepEqual(missing, []);
});
