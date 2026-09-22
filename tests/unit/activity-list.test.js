import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  groupActivityItems, normalizeActivityItems
} from '../../src/components/activity-list/activity-list.js';

test('activity grouping preserves first-seen group and source order without mutation', () => {
  const items = [
    { id: 1, group: 'Today', title: 'First', metadata: ['a'] },
    { id: 2, group: 'Yesterday', title: 'Second' },
    { id: 3, group: 'Today', title: 'Third' }
  ];
  const before = structuredClone(items);
  const groups = groupActivityItems(items, 'group');
  assert.deepEqual(groups.map((group) => [group.id, group.items.map((item) => item.id)]), [
    ['Today', [1, 3]],
    ['Yesterday', [2]]
  ]);
  assert.deepEqual(items, before);
  assert.notEqual(groups[0].items[0], items[0]);
  assert.notEqual(groups[0].items[0].metadata, items[0].metadata);
});

test('activity grouping supports injected resolvers and an explicit ungrouped collection', () => {
  const items = [{ id: 1, timestamp: '2026-08-31' }, { id: 2, timestamp: '2026-08-30' }];
  assert.deepEqual(groupActivityItems(items, (_item, index) => index % 2).map((group) => group.id), [0, 1]);
  const ungrouped = groupActivityItems(items, null);
  assert.equal(ungrouped.length, 1);
  assert.equal(ungrouped[0].id, null);
  assert.deepEqual(ungrouped[0].items.map((item) => item.id), [1, 2]);
  assert.deepEqual(groupActivityItems([], 'group'), []);
});

test('activity descriptors clone slot arrays and reject malformed collection data', () => {
  const source = [{
    id: 'a', metadata: ['meta'], attachments: [], actions: [{ id: 'open', label: 'Open' }]
  }];
  const normalized = normalizeActivityItems(source);
  assert.notEqual(normalized, source);
  assert.notEqual(normalized[0], source[0]);
  assert.notEqual(normalized[0].metadata, source[0].metadata);
  assert.notEqual(normalized[0].actions, source[0].actions);
  assert.throws(() => normalizeActivityItems(null), /must be an array/);
  assert.throws(() => normalizeActivityItems([null]), /descriptor objects/);
  assert.throws(() => normalizeActivityItems([{ id: 1, actions: {} }]), /actions must be an array/);
  assert.throws(() => normalizeActivityItems([{ id: 1 }, { id: 1 }]), /Duplicate ActivityList id/);
  assert.equal(normalizeActivityItems([{}, {}]).length, 2);
  assert.equal(normalizeActivityItems([{ id: 1 }, { id: '1' }]).length, 2);
  assert.throws(() => groupActivityItems([], /** @type {any} */ (false)), /groupBy/);
});

test('ActivityList uses ordered-list semantics and owns loading, empty, and incremental APIs', () => {
  const source = readFileSync(
    new URL('../../src/components/activity-list/activity-list.js', import.meta.url), 'utf8'
  );
  assert.match(source, /@extends \{Component<ActivityListOptions>\}/);
  assert.match(source, /h\('ol', \{ class: 'zx-activity-list__items' \}\)/);
  assert.match(source, /appendItems\(items, options = \{\}\)/);
  assert.match(source, /prependItems\(items, options = \{\}\)/);
  assert.match(source, /updateItem\(id, values, options = \{\}\)/);
  assert.match(source, /removeItem\(id, options = \{\}\)/);
  assert.match(source, /role: 'status'/);
  assert.match(source, /aria-busy/);
  assert.doesNotMatch(source, /\.addEventListener\s*\(/);
  assert.doesNotMatch(source, /\.innerHTML\s*=/);
});

test('activity CSS consumes only semantic tokens and scopes dividers to list-owned items', () => {
  const itemCss = readFileSync(
    new URL('../../src/components/activity-item/activity-item.css', import.meta.url), 'utf8'
  );
  const listCss = readFileSync(
    new URL('../../src/components/activity-list/activity-list.css', import.meta.url), 'utf8'
  );
  assert.match(listCss, /> \.zx-activity-item:not\(:last-child\)/);
  assert.doesNotMatch(`${itemCss}\n${listCss}`, /#[\da-f]{3,8}\b|rgba?\(|hsla?\(/i);
  assert.doesNotMatch(`${itemCss}\n${listCss}`, /var\(--zx-(?:gray|green|red|amber|blue)-/i);
});
