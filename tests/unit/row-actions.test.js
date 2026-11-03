import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  ROW_ACTION_LIMIT, isRowAction, isRowActionNode, menuEntries, planRowActions, rowActionLabel
} from '../../src/internal/row-actions.js';

/*
 * Row actions on TreeView rows and AppSidebar destinations share one model: which entries show,
 * which fold into the overflow menu, and what each control is called. Those decisions are pure;
 * the DOM, the Tab stops, and the context menu are exercised in the browser smoke suite.
 */

const action = (label, extra = {}) => ({ label, icon: 'plus', onSelect: () => {}, ...extra });
/** A stand-in for an application's own control: anything with a `nodeType`. */
const node = (name) => ({ nodeType: 1, name });

test('one or two actions all show, and none fold', () => {
  const one = [action('Add')];
  const two = [action('Add'), action('Rename')];
  assert.deepEqual(planRowActions(one), { inline: one, overflow: [] });
  assert.deepEqual(planRowActions(two), { inline: two, overflow: [] });
  assert.equal(ROW_ACTION_LIMIT, 2);
});

test('with more than two, the first shows and the rest fold into the menu', () => {
  const entries = [action('Add'), action('Rename'), action('Move'), action('Delete', { danger: true })];
  const plan = planRowActions(entries);
  assert.deepEqual(plan.inline, [entries[0]]);
  assert.deepEqual(plan.overflow, entries.slice(1));
});

test('an application node never folds, and keeps its place', () => {
  const own = node('toggle');
  const entries = [action('Add'), own, action('Move'), action('Delete')];
  const plan = planRowActions(entries);
  assert.deepEqual(plan.inline, [entries[0], own]);
  assert.deepEqual(plan.overflow, [entries[2], entries[3]]);
});

test('entries without a label or something to run are dropped before planning', () => {
  const kept = action('Add');
  const entries = [null, 'Add', { label: 'No handler' }, { label: '', onSelect() {} }, kept, 42];
  assert.deepEqual(planRowActions(entries), { inline: [kept], overflow: [] });
  assert.deepEqual(planRowActions(undefined), { inline: [], overflow: [] });
  assert.equal(isRowAction(node('x')), false, 'a node is not a descriptor');
  assert.equal(isRowActionNode({ label: 'x' }), false);
});

test('every control is named after its action and its row', () => {
  assert.equal(rowActionLabel('Add sub-page', 'Release checklist'), 'Add sub-page: Release checklist');
  assert.equal(rowActionLabel('More actions', ' Q3 plan '), 'More actions: Q3 plan');
  assert.equal(rowActionLabel('Rename', ''), 'Rename', 'a row without a name leaves the action alone');
});

test('menu entries keep the descriptor’s look and point back at it by index', () => {
  const entries = [action('Add'), action('Move', { icon: undefined }), action('Delete', { danger: true, disabled: true })];
  assert.deepEqual(menuEntries(entries), [
    { label: 'Add', icon: 'plus', value: 0, danger: false, disabled: false },
    { label: 'Move', icon: undefined, value: 1, danger: false, disabled: false },
    { label: 'Delete', icon: 'plus', value: 2, danger: true, disabled: true }
  ]);
  assert.deepEqual(menuEntries(entries, entries.slice(2)).map((entry) => entry.value), [2],
    'a folded subset keeps the indexes of the full list');
});

test('the strip is revealed by the base utility, and the row is its host', () => {
  const source = readFileSync(new URL('../../src/internal/row-actions.js', import.meta.url), 'utf8');
  assert.match(source, /'data-zx-reveal': ''/);
  for (const path of ['../../src/components/tree/tree.js', '../../src/components/app-sidebar/app-sidebar.js']) {
    assert.match(readFileSync(new URL(path, import.meta.url), 'utf8'), /data-zx-reveal-host/, path);
  }
});

test('row-action controls never hide with display, so they keep their room and their Tab stop', () => {
  for (const path of ['../../src/components/tree/tree.css', '../../src/components/app-sidebar/app-sidebar.css']) {
    const css = readFileSync(new URL(path, import.meta.url), 'utf8');
    for (const rule of css.matchAll(/([^{}]*__actions?[^{}]*)\{([^}]*)\}/g)) {
      // Rules about the strip or a control itself: the last compound selector names it.
      const targetsAction = rule[1].split(',').some((selector) => /__actions?\b[^\s>+~]*\s*$/.test(selector.trim()));
      if (!targetsAction) continue;
      assert.doesNotMatch(rule[2], /display:\s*none|visibility:\s*hidden/, `${path}: ${rule[1].trim()}`);
    }
  }
});
