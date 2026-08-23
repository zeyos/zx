import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { collectDependencies, maskLiterals, referencedNames, topLevelDeclarations }
  from '../../website/demo-source.js';

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));

/**
 * Reads every demo and layout module — the two directories whose helpers the documentation offers
 * to show beside an example.
 * @returns {Promise<{path: string, source: string}[]>}
 */
async function demoModules() {
  const modules = [];
  for (const directory of ['website/demos', 'website/layouts']) {
    for (const file of await readdir(join(root, directory))) {
      if (!file.endsWith('.js')) continue;
      modules.push({
        path: `${directory}/${file}`,
        source: await readFile(join(root, directory, file), 'utf8')
      });
    }
  }
  return modules;
}

/**
 * The declarations a reader can see for themselves: the demos put every one of them at column
 * zero. The extractor works from a masked scan instead, so this is an independent answer to
 * compare it against rather than the same rule written twice.
 * @param {string} source
 * @returns {string[]}
 */
function declaredNames(source) {
  return source.split('\n')
    .map((line) => /^(?:export\s+)?(?:(?:async\s+)?function\s+|(?:const|let|var)\s+)([A-Za-z_$][\w$]*)\s*[=(]/.exec(line))
    .filter(Boolean)
    .map((match) => match[1]);
}

test('masking keeps every offset and line where it was', async () => {
  for (const { path, source } of await demoModules()) {
    const masked = maskLiterals(source);
    assert.equal(masked.length, source.length, `${path} changed length`);
    assert.equal(masked.split('\n').length, source.split('\n').length, `${path} changed line count`);
  }
});

test('every top-level declaration in every demo is found, whole', async () => {
  let total = 0;
  for (const { path, source } of await demoModules()) {
    const declarations = topLevelDeclarations(source);
    assert.deepEqual([...declarations.keys()], declaredNames(source),
      `${path}: extracted declarations do not match the ones written at column zero`);

    for (const declaration of declarations.values()) {
      total += 1;
      // A declaration cut short — a missing closing brace, a string swallowed whole — parses as
      // nothing, and would be shown to a reader as code they cannot run.
      assert.doesNotThrow(() => new Function(declaration.code),
        `${path}: ${declaration.name} was not extracted as valid JavaScript:\n${declaration.code}`);
    }
  }
  assert.ok(total > 100, `expected the demo catalogue to declare more than a handful, found ${total}`);
});

test('a declaration arrives with the comment written above it', async () => {
  const source = await readFile(join(root, 'website/demos/tree.demo.js'), 'utf8');
  const { code, label } = topLevelDeclarations(source).get('catalogue');
  assert.equal(label, 'catalogue()');
  assert.match(code, /^\/\*\* @returns/, 'the JSDoc above the helper is what types the demo data');
  assert.match(code, /ID: 'archive'/, 'the declaration is cut short before its last entry');
  assert.match(code, /\n}$/);
});

test('a statement that spans lines without brackets ends at its semicolon', async () => {
  const source = await readFile(join(root, 'website/demos/truncate.demo.js'), 'utf8');
  const { code, label } = topLevelDeclarations(source).get('NOTE');
  assert.equal(label, 'NOTE', 'a string constant is not callable and gets no parentheses');
  assert.equal(code.split('\n').length, 3);
  assert.match(code, /;$/);
});

test('an example pulls in the helpers it uses, and the helpers those use', async () => {
  const table = await readFile(join(root, 'website/demos/table.demo.js'), 'utf8');
  // `editableColumns()` is the only name in the snippet; `isoDate()` is reached through it.
  const names = collectDependencies(table, 'new Table(null, { columns: editableColumns() });')
    .map((one) => one.label);
  assert.deepEqual(names, ['isoDate()', 'editableColumns()'],
    'dependencies come in the order the module declares them, transitive ones included');

  const tree = await readFile(join(root, 'website/demos/tree.demo.js'), 'utf8');
  assert.deepEqual(collectDependencies(tree, 'new TreeView(null, { items: catalogue() });')
    .map((one) => one.name), ['catalogue']);
  assert.deepEqual(collectDependencies(tree, 'new TreeView(null, { items: [] });'), [],
    'an example that builds its own data needs no second file');
});

test('a name is only a dependency where it is really read', () => {
  const module = [
    'const money = 1;',
    'const rows = [];',
    ''
  ].join('\n');

  assert.deepEqual(collectDependencies(module, 'log(row.money);'), [],
    'a property access names a field, not the helper it is spelled like');
  assert.deepEqual(collectDependencies(module, 'new Table(null, { money: 4 });'), [],
    'an option key names an option, not the helper it is spelled like');
  assert.deepEqual(collectDependencies(module, "log('rows and money');"), [],
    'prose in a string is not code');
  assert.deepEqual(collectDependencies(module, '// rows and money\nreturn 1;'), [],
    'a comment is not code either');
  assert.deepEqual(collectDependencies(module, 'const total = money;').map((one) => one.name), ['money']);
  assert.deepEqual(collectDependencies(module, 'log(`${rows.length}`);').map((one) => one.name), ['rows'],
    'an interpolation inside a template literal is code');
});

test('names are read out of code, not out of what surrounds it', () => {
  assert.deepEqual([...referencedNames('const a = b.c;')], ['const', 'a', 'b']);
  assert.deepEqual([...referencedNames('f(/gone/, "gone", `gone ${here}`)')], ['f', 'here']);
  assert.deepEqual([...referencedNames('x ? y : z')], ['x', 'y', 'z'],
    'a ternary is not an object literal');
});
