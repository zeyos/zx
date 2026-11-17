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

test('public component source and styles ship, and no compatibility entry is exported', () => {
  assert.ok(manifest.files.includes('src'), 'src/ must be published for component source imports');
  assert.ok(manifest.files.includes('styles'), 'styles/ must be published for ./styles/* to resolve');
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

test('the core modules import by their package path, as the instances the components use', async () => {
  const entry = manifest.exports['./src/core/*.js'];
  assert.ok(entry, 'the public core-source subpath is missing');
  assert.equal(entry.default, './src/core/*.js');
  assert.equal(entry.types, './dist/types/core/*.d.ts');

  // A translator or an icon registered through the package path has to reach a component imported
  // by its own file, so both specifiers must resolve to one module instance.
  const i18n = await import('@zeyos/zx/src/core/i18n.js');
  const icons = await import('@zeyos/zx/src/core/icons.js');
  assert.equal(i18n, await import('../../src/core/i18n.js'));
  assert.equal(icons, await import('../../src/core/icons.js'));
  assert.equal(typeof i18n.setTranslator, 'function');
  assert.equal(typeof icons.registerIcons, 'function');
  assert.equal(typeof icons.icon, 'function');
});

test('a locale catalogue imports by its package path, with types beside it', async () => {
  const entry = manifest.exports['./locales/*.js'];
  assert.ok(entry, 'the locale subpath is missing');
  assert.equal(entry.default, './src/locales/*.js');
  assert.equal(entry.types, './dist/types/locales/*.d.ts');
  const { de } = await import('@zeyos/zx/locales/de.js');
  assert.equal(de['dialog.cancel'], 'Abbrechen');
});

test('the stylesheet routes resolve to what the build and the source provide', () => {
  const built = [...readFileSync(root + 'tools/build.js', 'utf8').matchAll(/file: '([^']+\.css)'/g)]
    .map((match) => match[1]);
  const routes = ['./zx.css', './zx.min.css', './zx.core.css', './zx.core.min.css', './zx.layered.css'];
  for (const route of routes) {
    assert.equal(manifest.exports[route], `./dist/${route.slice(2)}`, `${route} is not exported`);
    assert.ok(built.includes(route.slice(2).replace('.min.css', '.css')), `the build does not write ${route}`);
  }

  assert.equal(manifest.exports['./src/components/*.css'], './src/components/*.css');
  assert.ok(existsSync(root + 'src/components/select/select.css'));
  assert.ok(existsSync(root + 'styles/core.css'), './styles/core.css must resolve');
});

test('zx-css ships as a Node program with no dependencies', () => {
  const path = manifest.bin['zx-css'];
  assert.equal(path, 'bin/zx-css.js');
  assert.ok(manifest.files.includes('bin'), 'bin/ must be published for the command to exist');
  assert.ok(manifest.files.includes('src') && manifest.files.includes('styles'),
    'the command resolves subsets from the published source and stylesheets');

  const source = readFileSync(root + path, 'utf8');
  assert.ok(source.startsWith('#!/usr/bin/env node\n'));
  const specifiers = [...source.matchAll(/^import\s[^'"]*['"]([^'"]+)['"]/gm)].map((match) => match[1]);
  assert.ok(specifiers.length > 0, 'found no imports to check');
  assert.deepEqual(specifiers.filter((specifier) => !specifier.startsWith('node:')), []);
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
