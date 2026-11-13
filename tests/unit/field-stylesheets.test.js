/*
 * A Form field type is registered at run time, so `zx-css` cannot follow it from `form` to the
 * component that draws it, and `docs/llms.md` lists the stylesheet name to pass for each type
 * ("Field widget types"). That list is checked here against the registrations themselves: every
 * `field-adapter.js` module is run with `Field.register` observed, and the name is taken from the
 * component module the adapter imports, as `zx-css` knows it.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { glob } from 'node:fs/promises';
import { basename, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

import { componentNames, resolveSubset } from '../../bin/zx-css.js';
import { Field } from '../../src/components/field/field.js';
import * as zx from '../../src/index.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const reference = readFileSync(`${root}docs/llms.md`, 'utf8');
const section = /<!-- doc:form-widgets -->([\s\S]*?)<!-- \/doc -->/.exec(reference)?.[1] ?? '';

/** The documented table: field type → [component, stylesheet name]. */
function documented() {
  return new Map([...section.matchAll(/^- `([a-z]+)` — (\w+) — `([a-z-]+)`$/gm)]
    .map(([, type, component, name]) => [type, { component, name }]));
}

/**
 * Runs every adapter module's registration and reports what each registered.
 * @returns {Promise<Map<string, {component: string, name: string}>>} By field type.
 */
async function registered() {
  const names = new Set(componentNames());
  const found = new Map();
  const register = Field.register;
  for await (const file of glob('src/components/*/*field-adapter.js', { cwd: root })) {
    const source = readFileSync(root + file, 'utf8');
    // The component the adapter draws: its one import that is not Field.
    const imports = [...source.matchAll(/^import \{ ([^}]+) \} from '([^']+)';$/gm)]
      .filter(([, , specifier]) => !specifier.endsWith('/field/field.js'));
    assert.equal(imports.length, 1, `${file}: expected one component import`);
    const [, imported, specifier] = imports[0];
    const classes = imported.split(',').map((name) => name.trim());
    const module = basename(specifier, '.js');
    // The stylesheet of that module where it has one of its own, else its directory's.
    const directory = specifier.startsWith('./') ? basename(dirname(file)) : basename(dirname(specifier));
    const name = names.has(module) ? module : directory;
    assert.ok(names.has(name), `${file}: ${name} is not a zx-css name`);

    const types = [];
    Field.register = function (type, adapter) {
      types.push(type);
      return register.call(this, type, adapter);
    };
    try {
      const exports = await import(pathToFileURL(root + file).href);
      for (const run of Object.values(exports)) if (typeof run === 'function') run();
    } finally {
      Field.register = register;
    }
    assert.ok(types.length > 0, `${file} registered nothing`);
    for (const type of types) found.set(type, { classes, name });
  }
  return found;
}

test('the documented field types are the registered ones, each with its stylesheet name', async () => {
  const table = documented();
  const actual = await registered();
  assert.ok(table.size > 0, 'the table is missing from the form-widgets block of docs/llms.md');
  assert.deepEqual([...table.keys()].sort(), [...actual.keys()].sort(),
    'docs/llms.md "Stylesheet names for zx-css" and the field adapters name different types');
  for (const [type, { component, name }] of table) {
    const adapter = actual.get(type);
    assert.equal(name, adapter.name, `${type}: documented as \`${name}\`, registered from \`${adapter.name}\``);
    assert.ok(adapter.classes.includes(component),
      `${type}: documented as ${component}, the adapter imports ${adapter.classes.join(', ')}`);
    assert.ok(component in zx, `${type}: ${component} is not a public export`);
  }
});

test('every adapter the package entry registers is in the table', () => {
  // The adapters are found by file name above; one registered from a file named otherwise would
  // be missed there, and is caught here through the registry.
  const index = readFileSync(`${root}src/index.js`, 'utf8');
  const imported = [...index.matchAll(/from '\.\/components\/([\w-]+\/[\w-]*field-adapter)\.js'/g)].length;
  const called = /export function registerFieldAdapters\(\) \{([\s\S]*?)\n\}/.exec(index)[1]
    .split('\n').filter((line) => line.trim()).length;
  assert.equal(imported, called, 'registerFieldAdapters() calls something that is not a field-adapter module');
  for (const type of documented().keys()) assert.ok(Field.has(type), `${type} is not registered`);
});

test('naming the stylesheet beside form brings the component styles in', () => {
  for (const [type, { name }] of documented()) {
    const sheets = resolveSubset(['form', name]);
    assert.ok(sheets.some((sheet) => sheet.endsWith(`/${name}.css`)), `${type}: ${name}.css is not in the subset`);
    assert.ok(sheets.some((sheet) => sheet.endsWith('/field.css')), `${type}: field.css is not in the subset`);
  }
});

test('the built-in types the reference lists are Field\'s own', () => {
  const builtin = /The built-in types — ([^—]+) — are drawn by Field itself/.exec(section.replace(/\n/g, ' '))?.[1] ?? '';
  const types = [...builtin.matchAll(/`([a-z]+)`/g)].map(([, type]) => type);
  const source = readFileSync(`${root}src/components/field/field.js`, 'utf8');
  const own = [...source.matchAll(/^Field\.register\('([a-z]+)'/gm)].map(([, type]) => type);
  assert.deepEqual(types.sort(), own.sort());
});
