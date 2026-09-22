import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import * as zx from '../../src/index.js';
import { Component } from '../../src/core/component.js';

/*
 * `docs/llms.md` carries one `<!-- doc:<id> -->` … `<!-- /doc -->` block per component, and
 * `website/docs.js` renders that block as the component's Reference tab. A component registered
 * without one therefore ships a documentation page whose reference is silently empty — and
 * nothing caught it, because the page still builds and still renders its demo.
 *
 * That is the same failure mode `smoke-coverage.test.js` exists for, so it gets the same
 * treatment: the question "does a block exist" needs no DOM, so it is answered here, in CI, at
 * the moment the drift is introduced. Three components had reached the repository without one
 * before this test was written.
 */
const read = (path) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');

const reference = read('../../docs/llms.md');
const docsSource = read('../../website/docs.js');

/** The ids `website/docs.js` builds a component page for. */
function componentIds() {
  const match = /const COMPONENT_IDS = \[([\s\S]*?)\];/.exec(docsSource);
  assert.ok(match, 'COMPONENT_IDS not found in website/docs.js');
  return [...match[1].matchAll(/'([^']+)'/g)].map((entry) => entry[1]);
}

/** The ids `docs/llms.md` opens a reference block for. */
const documented = () => new Set(
  [...reference.matchAll(/<!--\s*doc:([\w-]+)\s*-->/g)].map((entry) => entry[1])
);

/*
 * Pages that are prose rather than a component — they own their whole page and have no
 * reference block. Anything else missing a block is a gap, not an exemption.
 */
const PROSE_PAGES = new Set(['tokens', 'kernel', 'icons', 'helpers', 'elements', 'form-widgets']);

/** Reference blocks that document a binding rather than a component page. */
const BINDING_BLOCKS = new Set(['zeyos']);

test('every documented component has a reference block in docs/llms.md', () => {
  const blocks = documented();
  const missing = componentIds()
    .filter((id) => !PROSE_PAGES.has(id))
    .filter((id) => !blocks.has(id));

  assert.deepEqual(missing, [], `add <!-- doc:<id> --> blocks to docs/llms.md for: ${missing.join(', ')}`);
});

test('no reference block names a page that is not built', () => {
  const ids = new Set(componentIds());
  // `zeyos` and the binding sections are reference material without a component page of their
  // own; they are addressed by the prose above them rather than by a page id.
  const stale = [...documented()]
    .filter((id) => !ids.has(id) && !PROSE_PAGES.has(id) && !BINDING_BLOCKS.has(id));
  assert.deepEqual(stale, [], `these reference blocks are unreachable from any page: ${stale.join(', ')}`);
});

test('every reference block is closed', () => {
  const opens = (reference.match(/<!--\s*doc:[\w-]+\s*-->/g) ?? []).length;
  const closes = (reference.match(/<!--\s*\/doc\s*-->/g) ?? []).length;
  // An unclosed block swallows every section after it into one Reference tab, which is the
  // kind of breakage that looks like a content problem rather than a syntax one.
  assert.equal(opens, closes, 'unbalanced doc markers in docs/llms.md');
});

/*
 * `llms.txt` is the machine index an agent reads before anything else, and `docs/llms.txt` ships
 * inside the package. A component missing from it is invisible to every reader that starts there
 * — which is a quieter failure than an empty Reference tab and was worth catching separately:
 * five components had reached the repository without an entry.
 */
const INDEXES = ['../../docs/llms.txt', '../../website/llms.txt'];

/** Every exported class that is a component, which is what an index is expected to name. */
function exportedComponents() {
  return Object.entries(zx)
    .filter(([name, value]) => name !== 'Component'
      && typeof value === 'function'
      && value.prototype instanceof Component)
    .map(([name]) => name);
}

/*
 * Matched on a word boundary, not as a substring. `includes()` looks right and is not: `Table`
 * is satisfied by `TableView`, `Filter` by `FilterPanel`, `Card` by `CardView` — so a substring
 * check passes for components the index never mentions. Verified by deleting an entry and
 * confirming the test goes red.
 */
const names = (text, name) => new RegExp(`\\b${name}\\b`).test(text);

for (const index of INDEXES) {
  test(`every exported component is named in ${index.replace('../../', '')}`, () => {
    const text = read(index);
    const missing = exportedComponents().filter((name) => !names(text, name));
    assert.deepEqual(missing, [], `add to ${index.replace('../../', '')}: ${missing.join(', ')}`);
  });
}
