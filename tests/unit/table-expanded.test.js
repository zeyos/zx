import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { projectHierarchyRows, resolveExpandedChange } from '../../src/components/table/table.js';

/*
 * `Table.setExpanded()`: what replacing the expanded branches changes, kept apart from the DOM. The
 * single render, the events and the focus that survives it run in a real browser in
 * `tests/regression/wp82-table.js`.
 */

const source = readFileSync(new URL('../../src/components/table/table.js', import.meta.url), 'utf8');

/** Branches of a small tree, in data order. */
const branches = ['sales', 'ops', 'product', 'people'];

test('the new set holds only branches, whatever was asked for', () => {
  const change = resolveExpandedChange(branches, new Set(), ['ops', 'ghost', 'sales-leaf', 'people']);
  assert.deepEqual([...change.expanded], ['ops', 'people']);
  assert.deepEqual(change.opened, ['ops', 'people']);
  assert.deepEqual(change.closed, []);
});

test('branches that change state are reported in data order, not in the order given', () => {
  const change = resolveExpandedChange(branches, new Set(['people', 'sales']), ['product', 'ops', 'sales']);
  assert.deepEqual([...change.expanded], ['sales', 'ops', 'product']);
  assert.deepEqual(change.opened, ['ops', 'product']);
  assert.deepEqual(change.closed, ['people']);
});

test('an equal set changes nothing', () => {
  const change = resolveExpandedChange(branches, new Set(['ops', 'sales']), ['sales', 'ops', 'ops']);
  assert.deepEqual(change.opened, []);
  assert.deepEqual(change.closed, []);
  assert.deepEqual([...change.expanded], ['sales', 'ops']);
});

test('true expands every branch; false, null and an empty list collapse them all', () => {
  const all = resolveExpandedChange(branches, new Set(['ops']), true);
  assert.deepEqual([...all.expanded], branches);
  assert.deepEqual(all.opened, ['sales', 'product', 'people']);
  for (const none of [false, null, undefined, [], 'ops', 7]) {
    const change = resolveExpandedChange(branches, new Set(['ops', 'people']), none);
    assert.equal(change.expanded.size, 0, String(none));
    assert.deepEqual(change.closed, ['ops', 'people'], String(none));
  }
});

test('ids are compared as the row id accessor returns them, and any iterable is accepted', () => {
  const numeric = resolveExpandedChange([1, 2, 3], new Set(), ['1', 2]);
  assert.deepEqual([...numeric.expanded], [2], "'1' is not the row whose id is 1");
  assert.deepEqual([...resolveExpandedChange([1, 2, 3], new Set(), new Set([3, 1])).expanded], [1, 3]);
  // The current set is never mutated: the caller swaps it for the returned one.
  const current = new Set([1]);
  resolveExpandedChange([1, 2], current, [2]);
  assert.deepEqual([...current], [1]);
  assert.deepEqual(resolveExpandedChange(/** @type {any} */ (null), /** @type {any} */ (null), [1]),
    { expanded: new Set(), opened: [], closed: [] });
});

test('the resolved set projects the rows a restored view expects', () => {
  const rows = [
    { id: 'sales', parent: null }, { id: 'travel', parent: 'sales' },
    { id: 'ops', parent: null }, { id: 'logistics', parent: 'ops' }, { id: 'fleet', parent: 'logistics' }
  ];
  const { expanded } = resolveExpandedChange(['sales', 'ops', 'logistics'], new Set(['sales']), ['ops']);
  assert.deepEqual(projectHierarchyRows(rows, 'id', 'parent', expanded).map((entry) => entry.id),
    ['sales', 'ops', 'logistics']);
});

test('setExpanded renders once and fires the per-branch events only when not silent', () => {
  const body = /  setExpanded\(ids, options = \{\}\) \{([\s\S]*?)\n  \}\n/.exec(source)?.[1] ?? '';
  assert.equal(body.match(/this\._renderBody\(\)/g)?.length, 1);
  // Nothing to change: no render, no event.
  assert.match(body, /if \(change\.opened\.length === 0 && change\.closed\.length === 0\) return this;/);
  assert.match(body, /if \(!options\.silent\) \{\s*for \(const id of change\.closed\) this\._emitRowToggle\(id, false\);\s*for \(const id of change\.opened\) this\._emitRowToggle\(id, true\);/);
  assert.match(body, /if \(!this\._hierarchy\) return this;/);
});
