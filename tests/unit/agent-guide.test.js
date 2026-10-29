/*
 * The agent-facing surface — `docs/llms.md`'s "Choosing what to build with", both `llms.txt`
 * indexes, the README's layout section, and the repository skill — tells a coding agent to start
 * from a layout and which component does which job. A guide that names a layout the gallery no
 * longer has, or a component the library does not export, sends the agent to a dead end quietly,
 * so each of those names is checked against the registry and the public exports.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import * as zx from '../../src/index.js';
import { LAYOUT_IDS } from '../../website/layouts/index.js';

/** @param {string} path Repository-relative path. @returns {string} */
function read(path) {
  return readFileSync(fileURLToPath(new URL(`../../${path}`, import.meta.url)), 'utf8');
}

const reference = read('docs/llms.md');
const choosing = /^## Choosing what to build with[\s\S]*?(?=^## Theming)/m.exec(reference)?.[0] ?? '';

/** The documents that carry the layout list, and the sections of them that must name every id. */
const LAYOUT_LISTS = [
  ['docs/llms.md', choosing],
  ['docs/llms.txt', /^## Start here: choosing[\s\S]*?(?=^## )/m.exec(read('docs/llms.txt'))?.[0] ?? ''],
  ['website/llms.txt', /^## Start here: choosing[\s\S]*?(?=^## )/m.exec(read('website/llms.txt'))?.[0] ?? ''],
  ['README.md', /^## Start from a layout[\s\S]*?(?=^## )/m.exec(read('README.md'))?.[0] ?? ''],
  ['.claude/skills/zx/SKILL.md', /^## Start from a layout[\s\S]*?(?=^## )/m.exec(read('.claude/skills/zx/SKILL.md'))?.[0] ?? '']
];

test('the reference opens with the choosing guide and points at it from the preamble', () => {
  assert.ok(choosing.length > 0, 'docs/llms.md has no "Choosing what to build with" section before Theming');
  assert.match(reference.slice(0, 1200), /Choosing what to build with/, 'the preamble does not point at the guide');
  for (const heading of ['### Start from a layout', '### The component for the job', '### Theming decisions', '### Never']) {
    assert.ok(choosing.includes(heading), `the guide lacks ${heading}`);
  }
});

for (const [path, section] of LAYOUT_LISTS) {
  test(`${path} names every layout in the registry, and no other`, () => {
    assert.ok(section.length > 0, `${path}: the layout section is missing`);
    const missing = LAYOUT_IDS.filter((id) => !section.includes(`\`${id}\``));
    assert.deepEqual(missing, [], `${path} does not name: ${missing.join(', ')}`);
    // Every kebab-case id the section quotes must be a layout (or a file the guide points at).
    const quoted = [...section.matchAll(/`([a-z]+(?:-[a-z]+)+)`/g)].map(([, id]) => id)
      .filter((id) => !id.startsWith('zx-') && !id.startsWith('data-'));
    const unknown = [...new Set(quoted)].filter((id) => !LAYOUT_IDS.includes(id));
    assert.deepEqual(unknown, [], `${path} names layouts the registry lacks: ${unknown.join(', ')}`);
  });
}

test('every component and helper the job table names is a public export', () => {
  const table = /### The component for the job[\s\S]*?(?=### Theming decisions)/.exec(choosing)?.[0] ?? '';
  assert.ok(table.length > 0);
  // `Name`, `name()`, `Name.method()`; option snippets (`keyboard: …`) and tokens are not names.
  const names = [...table.matchAll(/`([A-Za-z]+)(?:\(\)|\.[a-zA-Z]+\(\))?`/g)].map(([, name]) => name);
  // Option names and the kit's own composition are not exports; statics are checked on their class.
  const skip = new Set(['editMode', 'title', 'groupBy', 'collapsibleGroups', 'filter', 'selector', 'kind', 'tone', 'createOverview']);
  const statics = [...table.matchAll(/`([A-Z][A-Za-z]+)\.([a-zA-Z]+)\(\)`/g)];
  for (const [, cls, method] of statics) {
    assert.equal(typeof zx[cls]?.[method], 'function', `${cls}.${method}() is not a static of an export`);
  }
  const unknown = [...new Set(names)].filter((name) => !skip.has(name) && !(name in zx)
    && !statics.some(([, , method]) => method === name));
  assert.deepEqual(unknown, [], `the job table names exports the library lacks: ${unknown.join(', ')}`);
});

test('the layout-first rule reaches the published indexes and the public helpers they cite exist', () => {
  for (const path of ['docs/llms.txt', 'website/llms.txt', 'README.md']) {
    const text = read(path);
    assert.match(text, /layouts\/kit\.js/, `${path} does not point at the shell kit`);
    assert.match(text, /layouts\/overview\.js/, `${path} does not point at the overview composition`);
    assert.match(text, /createOverview\(\)/, `${path} does not name createOverview()`);
  }
  for (const path of ['website/layouts/kit.js', 'website/layouts/kit.css', 'website/layouts/overview.js', 'website/layouts/overview.css']) {
    assert.ok(read(path).length > 0, `${path} is missing`);
  }
  assert.match(read('website/layouts/overview.js'), /^export \{[^}]*\bcreateOverview\b/m);
});
