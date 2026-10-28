import assert from 'node:assert/strict';
import test from 'node:test';

import {
  autoScrollDelta, dropGapIndex, groupingFieldIds, mergeViewField, isDiscreteFieldType, matchesFieldQuery, moveVisibleField,
  normalizeBoard, normalizeSections, normalizeViewSettingsFields, resolveFieldType, showFieldInOrder
} from '../../src/components/view-settings/view-settings.js';
import { icons } from '../../src/core/icons.js';

test('fields are cloned with string ids, derived labels, a default type, and boolean flags', () => {
  const source = [{ id: ' owner ', type: 'select', locked: 1 }, { id: 'closeDate' }, { id: 'stage', groupable: 0 }];
  const fields = normalizeViewSettingsFields(source);
  assert.deepEqual(fields.map((field) => field.id), ['owner', 'closeDate', 'stage']);
  assert.equal(fields[0].locked, true);
  assert.equal(fields[1].label, 'Close Date');
  assert.equal(fields[1].type, 'text');
  assert.equal(fields[2].groupable, false);
  assert.equal(Object.hasOwn(fields[0], 'groupable'), false, 'an omitted groupable stays omitted');
  assert.notEqual(fields[0], source[0], 'descriptors are copied, never mutated');
  assert.deepEqual(normalizeViewSettingsFields(null), []);
  assert.throws(() => normalizeViewSettingsFields([{ id: 'a' }, { id: 'a' }]), /Duplicate/);
  assert.throws(() => normalizeViewSettingsFields([{ label: 'No id' }]), /requires an id/);
  assert.throws(() => normalizeViewSettingsFields('fields'), TypeError);
});

test('sections follow the option order and drop what grouping or board turn off', () => {
  assert.deepEqual(normalizeSections(undefined, { grouping: true, board: false }), ['fields', 'grouping']);
  assert.deepEqual(normalizeSections(undefined, { grouping: true, board: { columnBy: 'stage' } }),
    ['fields', 'grouping', 'board']);
  assert.deepEqual(normalizeSections(['board', 'fields', 'board', 'nonsense'], { grouping: false, board: {} }),
    ['board', 'fields']);
  assert.deepEqual(normalizeSections(['grouping'], { grouping: false, board: false }), []);
});

test('board settings drop unknown fields and a swim lane equal to the column field', () => {
  const ids = ['stage', 'owner'];
  assert.equal(normalizeBoard(false), null);
  assert.deepEqual(normalizeBoard({ columnBy: 'stage', swimlaneBy: 'owner' }, ids),
    { columnBy: 'stage', swimlaneBy: 'owner', showEmptyColumns: true });
  assert.deepEqual(normalizeBoard({ columnBy: 'gone', swimlaneBy: 'owner', showEmptyColumns: false }, ids),
    { columnBy: null, swimlaneBy: 'owner', showEmptyColumns: false });
  assert.equal(normalizeBoard({ columnBy: 'stage', swimlaneBy: 'stage' }, ids).swimlaneBy, null);
  assert.equal(normalizeBoard({ columnBy: 'later' }, null).columnBy, 'later', 'no ids, no check');
});

test('types resolve through aliases and overrides, and an unknown type keeps its name', () => {
  assert.deepEqual(resolveFieldType('int'), { type: 'number', icon: 'hash', label: 'Number', key: 'viewSettings.typeNumber' });
  assert.equal(resolveFieldType('enum').type, 'select');
  assert.equal(resolveFieldType(undefined).type, 'text');
  assert.deepEqual(resolveFieldType('geo'), { type: 'geo', icon: 'type', label: 'Geo', key: null });
  assert.deepEqual(resolveFieldType('date', { date: { label: 'Day' } }),
    { type: 'date', icon: 'calendar', label: 'Day', key: null });
  assert.equal(resolveFieldType('rating', { rating: { icon: 'heart' } }).icon, 'heart');
  assert.equal(resolveFieldType('rating', { rating: { icon: 'heart' } }).key, 'viewSettings.typeRating');
});

test('every built-in type glyph is in the bundled icon set', () => {
  const types = ['text', 'number', 'money', 'date', 'datetime', 'time', 'boolean', 'select', 'status',
    'priority', 'entity', 'tags', 'url', 'email', 'image', 'file', 'rating', 'unknown-type'];
  for (const type of types) {
    const glyph = resolveFieldType(type).icon;
    assert.ok(Object.hasOwn(icons, glyph), `${type} uses ${glyph}, which is not bundled`);
  }
});

test('grouping offers discrete types unless restricted or opted out', () => {
  const fields = normalizeViewSettingsFields([
    { id: 'name' }, { id: 'stage', type: 'status' }, { id: 'value', type: 'money' },
    { id: 'owner', type: 'enum' }, { id: 'notes', type: 'text', groupable: false },
    { id: 'quarter', type: 'number', groupable: true }
  ]);
  assert.equal(isDiscreteFieldType('boolean'), true);
  assert.equal(isDiscreteFieldType('date'), false);
  assert.deepEqual(groupingFieldIds(fields, true), ['name', 'stage', 'owner', 'quarter']);
  assert.deepEqual(groupingFieldIds(fields, { fields: ['owner', 'value', 'gone', 'owner'] }), ['owner', 'value']);
});

test('search ignores case and accents, needs every word, and also matches the type name', () => {
  const field = { id: 'closeDate', label: 'Fälligkeit Datum' };
  assert.equal(matchesFieldQuery(field, ''), true);
  assert.equal(matchesFieldQuery(field, 'falligkeit'), true);
  assert.equal(matchesFieldQuery(field, 'DATUM fäl'), true);
  assert.equal(matchesFieldQuery(field, 'datum owner'), false);
  assert.equal(matchesFieldQuery(field, 'closedate'), true, 'the id is searched too');
  assert.equal(matchesFieldQuery({ id: 'x', label: 'Created' }, 'date', 'Date'), true);
});

test('moving a field rearranges only the movable shown fields', () => {
  const order = ['name', 'stage', 'value', 'notes', 'owner'];
  // notes is hidden, name is locked: the movable shown list is stage, value, owner.
  assert.deepEqual(moveVisibleField(order, ['notes'], ['name'], 'owner', 0),
    ['name', 'owner', 'stage', 'notes', 'value']);
  assert.deepEqual(moveVisibleField(order, ['notes'], ['name'], 'stage', 99),
    ['name', 'value', 'owner', 'notes', 'stage'], 'the index is clamped');
  assert.deepEqual(moveVisibleField(order, [], [], 'value', 1), ['name', 'value', 'stage', 'notes', 'owner']);
  assert.deepEqual(moveVisibleField(order, ['notes'], ['name'], 'name', 2), order, 'a locked field does not move');
  assert.deepEqual(moveVisibleField(order, ['notes'], [], 'notes', 0), order, 'a hidden field does not move');
  assert.deepEqual(moveVisibleField(order, [], [], 'missing', 0), order);
});

test('a locked field in the middle keeps its slot', () => {
  const order = ['a', 'b', 'lock', 'c'];
  assert.deepEqual(moveVisibleField(order, [], ['lock'], 'a', 2), ['b', 'c', 'lock', 'a']);
});

test('showing a field puts it right after the last shown one', () => {
  assert.deepEqual(showFieldInOrder(['a', 'x', 'b', 'y'], ['x', 'y'], 'x'),
    { order: ['a', 'b', 'x', 'y'], hidden: ['y'] });
  assert.deepEqual(showFieldInOrder(['a', 'b'], [], 'a'), { order: ['a', 'b'], hidden: [] });
});

test('the drop gap is the first row whose middle is below the pointer', () => {
  assert.equal(dropGapIndex([10, 30, 50], 5), 0);
  assert.equal(dropGapIndex([10, 30, 50], 31), 2);
  assert.equal(dropGapIndex([10, 30, 50], 80), 3);
  assert.equal(dropGapIndex([], 0), 0);
});

test('a bound view\'s label and type win; the panel supplies only what the view lacks', () => {
  const own = { id: 'value', label: 'Amount', type: 'money', locked: true, groupable: false };
  assert.deepEqual(mergeViewField(own, { id: 'value', label: 'Deal value', type: 'number' }),
    { id: 'value', label: 'Deal value', type: 'number', locked: true, groupable: false });
  // A record view reports 'text' for a field declared without a type: the panel's own type stands.
  assert.equal(mergeViewField(own, { id: 'value', label: 'Value', type: 'text' }).type, 'money');
  assert.equal(mergeViewField({ id: 'a', label: 'A' }, { id: 'a', label: 'B', type: 'text' }).type, 'text');
  assert.deepEqual(mergeViewField(null, { id: 'x', label: 'X', type: 'date' }), { id: 'x', label: 'X', type: 'date' });
});

test('a drag scrolls only inside the edge bands, and only while the list continues that way', () => {
  const edges = { top: 100, bottom: 500 };
  const tall = { top: 40, bottom: 900 };
  assert.equal(autoScrollDelta(110, edges, tall, 32, 12), -12);
  assert.equal(autoScrollDelta(490, edges, tall, 32, 12), 12);
  assert.equal(autoScrollDelta(300, edges, tall, 32, 12), 0);
  assert.equal(autoScrollDelta(110, edges, { top: 120, bottom: 900 }, 32, 12), 0, 'nothing above to reveal');
  assert.equal(autoScrollDelta(490, edges, { top: 40, bottom: 480 }, 32, 12), 0, 'nothing below to reveal');
});

test('board choices take board.fields, else the grouping restriction', () => {
  const fields = normalizeViewSettingsFields([
    { id: 'stage', type: 'status' }, { id: 'owner', type: 'select' }, { id: 'region', type: 'text' }
  ]);
  assert.deepEqual(groupingFieldIds(fields, { fields: ['owner', 'stage'] }), ['owner', 'stage']);
  assert.deepEqual(groupingFieldIds(fields, false), ['stage', 'owner', 'region'],
    'with the Group section off, the default discrete rule still applies');
});
