import assert from 'node:assert/strict';
import test from 'node:test';

import {
  astToFilters, filtersToAst, isDraftNode, mergeDrafts, resolveBoardAxes, withoutDrafts
} from '../../website/layouts/overview-filters.js';

const condition = (id, field, operator, value) => ({ kind: 'condition', id, field, operator, value });

test('chips become a flat root group and come back as the same chips', () => {
  const filters = {
    logic: 'or',
    conditions: [
      { field: 'stage', operator: 'neq', value: 'lost' },
      { id: 'kept', field: 'owner', operator: 'anyOf', value: ['nadine', 'tobias'] }
    ],
    advanced: null
  };
  const ast = filtersToAst(filters);
  assert.equal(ast.version, 1);
  assert.equal(ast.root.logic, 'or');
  assert.deepEqual(ast.root.children.map((child) => child.id), ['condition-0', 'kept']);
  assert.ok(ast.root.children.every((child) => child.kind === 'condition'));
  assert.notEqual(ast.root.children[1].value, filters.conditions[1].value, 'values are copied');

  const back = astToFilters(ast);
  assert.equal(back.advanced, null);
  assert.equal(back.logic, 'or');
  assert.deepEqual(back.conditions, [
    { id: 'condition-0', field: 'stage', operator: 'neq', value: 'lost' },
    { id: 'kept', field: 'owner', operator: 'anyOf', value: ['nadine', 'tobias'] }
  ]);
  assert.deepEqual(filtersToAst(back), ast, 'a second round trip changes nothing');
});

test('a nested expression is one advanced filter, kept whole both ways', () => {
  const nested = {
    version: 1,
    root: { kind: 'group', id: 'root', logic: 'and', children: [
      condition('a', 'stage', 'eq', 'proposal'),
      { kind: 'group', id: 'g', logic: 'or', children: [condition('b', 'owner', 'anyOf', ['nadine']), condition('c', 'stage', 'eq', 'won')] }
    ] }
  };
  const filters = astToFilters(nested);
  assert.deepEqual(filters.conditions, []);
  assert.deepEqual(filters.advanced, nested);
  assert.notEqual(filters.advanced, nested);
  assert.deepEqual(filtersToAst(filters), nested, 'the advanced expression is what the drawer gets back');
});

test('unfinished rows are drafts: no field, no operator, or no value its operator needs', () => {
  assert.equal(isDraftNode(condition('a', '', 'eq', 'x')), true);
  assert.equal(isDraftNode(condition('a', 'stage', '', 'x')), true);
  assert.equal(isDraftNode(condition('a', 'stage', 'eq', null)), true);
  assert.equal(isDraftNode(condition('a', 'company', 'contains', '  ')), true);
  assert.equal(isDraftNode(condition('a', 'owner', 'anyOf', [])), true);
  assert.equal(isDraftNode(condition('a', 'value', 'between', [1000, null])), true);
  assert.equal(isDraftNode(condition('a', 'value', 'gte', 0)), false, '0 is a value');
  assert.equal(isDraftNode(condition('a', 'tags', 'isEmpty', null)), false, 'no value needed');
  assert.equal(isDraftNode({ kind: 'group', id: 'g', logic: 'and', children: [] }), true);
  assert.equal(isDraftNode({ kind: 'group', id: 'g', logic: 'and', children: [condition('a', 'stage', 'eq', null)] }), true);
  assert.equal(isDraftNode({ kind: 'group', id: 'g', logic: 'and', children: [condition('a', 'stage', 'eq', 'won')] }), false);
});

test('the finished rows apply while an unfinished one waits', () => {
  const ast = {
    version: 1,
    root: { kind: 'group', id: 'root', logic: 'and', children: [
      condition('a', 'stage', 'eq', 'won'),
      condition('b', 'stage', 'eq', null),
      { kind: 'group', id: 'g', logic: 'or', children: [condition('c', 'owner', 'anyOf', ['nadine']), condition('d', '', '', null)] },
      { kind: 'group', id: 'empty', logic: 'and', children: [] }
    ] }
  };
  const applied = withoutDrafts(ast);
  assert.deepEqual(applied.root.children.map((child) => child.id), ['a', 'g']);
  assert.deepEqual(applied.root.children[1].children.map((child) => child.id), ['c']);
  assert.equal(ast.root.children.length, 4, 'the drawer value is left as it was');
});

test('a change in the chip bar keeps the drawer rows still being written', () => {
  const drawer = {
    version: 1,
    root: { kind: 'group', id: 'filter-root', logic: 'and', children: [
      condition('condition-0', 'stage', 'neq', 'lost'),
      condition('kept', 'value', 'gte', 50000),
      condition('draft', 'owner', 'anyOf', [])
    ] }
  };
  // The bar removes the Value chip.
  const committed = filtersToAst({ logic: 'and', conditions: [{ field: 'stage', operator: 'neq', value: 'lost' }], advanced: null });
  const merged = mergeDrafts(committed, drawer);
  assert.deepEqual(merged.root.children.map((child) => child.id), ['condition-0', 'draft']);
  assert.deepEqual(mergeDrafts(committed, null), committed);
  assert.equal(committed.root.children.length, 1, 'the committed expression is not changed');

  // A draft with an id the committed expression already uses is not added twice.
  const clash = { ...drawer, root: { ...drawer.root, children: [condition('condition-0', 'stage', 'eq', null)] } };
  assert.deepEqual(mergeDrafts(committed, clash).root.children.map((child) => child.id), ['condition-0']);
});

test('on the board the swim lanes are the grouping, and the axes swap rather than collide', () => {
  const axes = ['stage', 'owner'];
  // Lanes by owner beside stage columns.
  assert.deepEqual(resolveBoardAxes({ columnBy: 'stage', group: 'none' }, { group: 'owner' }, axes), { columnBy: 'stage', group: 'owner' });
  // Group by Stage with stage columns: the columns move to owner, the lanes are stage.
  assert.deepEqual(resolveBoardAxes({ columnBy: 'stage', group: 'none' }, { group: 'stage' }, axes), { columnBy: 'owner', group: 'stage' });
  // Columns to Owner while grouped by owner: the axes swap, the grouping follows the lanes.
  assert.deepEqual(resolveBoardAxes({ columnBy: 'stage', group: 'owner' }, { columnBy: 'owner' }, axes), { columnBy: 'owner', group: 'stage' });
  // Columns to Owner without a grouping: nothing else changes.
  assert.deepEqual(resolveBoardAxes({ columnBy: 'stage', group: 'none' }, { columnBy: 'owner' }, axes), { columnBy: 'owner', group: 'none' });
  // No lanes is no grouping.
  assert.deepEqual(resolveBoardAxes({ columnBy: 'stage', group: 'owner' }, { group: 'none' }, axes), { columnBy: 'stage', group: 'none' });
  // Entering the board grouped by the column field resolves like choosing it there.
  assert.deepEqual(resolveBoardAxes({ columnBy: 'stage', group: 'stage' }, {}, axes), { columnBy: 'owner', group: 'stage' });
  // With a single axis there is nothing to move to: the grouping is cleared.
  assert.deepEqual(resolveBoardAxes({ columnBy: 'stage', group: 'none' }, { group: 'stage' }, ['stage']), { columnBy: 'stage', group: 'none' });

  // Every combination ends with columns and lanes apart, and lanes equal to the grouping.
  for (const columnBy of axes) {
    for (const group of ['none', ...axes]) {
      for (const change of [{}, { group: 'none' }, ...axes.map((id) => ({ group: id })), ...axes.map((id) => ({ columnBy: id }))]) {
        const next = resolveBoardAxes({ columnBy, group }, change, axes);
        assert.notEqual(next.columnBy, next.group, `${columnBy}/${group} + ${JSON.stringify(change)}`);
        assert.ok(axes.includes(next.columnBy));
      }
    }
  }
});

test('a record is matched through the field reader, text "is" ignoring case', async () => {
  const { conditionMatches, nodeMatches, filterExpression } = await import('../../website/layouts/overview-filters.js');
  const record = { ID: 1, company: 'Helios Energie', owner: { id: 'nadine' }, tags: ['pilot'], value: 50000, close: '2026-10-12' };
  const read = (entry, field) => (field === 'owner' ? entry.owner.id : entry[field]);
  const type = (field) => (field === 'company' ? 'text' : undefined);
  const is = (field, operator, value) => conditionMatches(record, { field, operator, value }, { read, type });
  assert.equal(is('owner', 'anyOf', ['nadine', 'tobias']), true, 'read through the reader');
  assert.equal(is('owner', 'noneOf', ['nadine']), false);
  assert.equal(is('company', 'eq', 'helios energie'), true, 'text is case-blind');
  assert.equal(conditionMatches(record, { field: 'company', operator: 'eq', value: 'helios energie' }), false,
    'without a type, "is" is exact');
  assert.equal(is('company', 'contains', 'ENERG'), true);
  assert.equal(is('value', 'between', [40000, 60000]), true);
  assert.equal(is('value', 'notBetween', [40000, 60000]), false);
  assert.equal(is('close', 'before', '2026-11-01'), true, 'ISO dates compare as text');
  assert.equal(is('tags', 'containsAny', ['pilot', 'upsell']), true);
  assert.equal(is('tags', 'containsAll', ['pilot', 'upsell']), false);
  assert.equal(is('tags', 'isEmpty', null), false);

  const chips = { logic: 'or', conditions: [{ field: 'value', operator: 'gt', value: 90000 }, { field: 'tags', operator: 'containsAny', value: ['pilot'] }], advanced: null };
  assert.equal(nodeMatches(record, filterExpression(chips), { read, type }), true, 'any of the chips');
  assert.equal(nodeMatches(record, filterExpression({ ...chips, logic: 'and' }), { read, type }), false, 'all of the chips');
  assert.equal(nodeMatches(record, filterExpression({ logic: 'and', conditions: [], advanced: null })), true, 'no filter matches all');
  const advanced = { version: 1, root: { kind: 'group', id: 'r', logic: 'and', children: [{ kind: 'condition', id: 'a', field: 'value', operator: 'lt', value: 1 }] } };
  assert.equal(nodeMatches(record, filterExpression({ ...chips, advanced })), false, 'the advanced expression replaces the chips');
});

test('a fresh condition value follows its operator, carrying the previous one where it fits', async () => {
  const { valueFor, conditionCount } = await import('../../website/layouts/overview-filters.js');
  assert.equal(valueFor('eq'), null);
  assert.deepEqual(valueFor('anyOf', 'proposal'), ['proposal'], '"is" to "is any of" keeps the stage');
  assert.deepEqual(valueFor('anyOf', ['a', 'b']), ['a', 'b']);
  assert.equal(valueFor('eq', ['a', 'b']), 'a');
  assert.deepEqual(valueFor('between', 5), [5, null]);
  assert.equal(valueFor('isEmpty', 'x'), null);
  const nested = { kind: 'group', children: [{ kind: 'condition' }, { kind: 'group', children: [{ kind: 'condition' }, { kind: 'condition' }] }] };
  assert.equal(conditionCount(nested), 3);
});

test('records sort within their groups, and a page heads each group with its count', async () => {
  const { groupsOf, sortRecords, groupCount, withGroupRows } = await import('../../website/layouts/overview-filters.js');
  const axes = { stage: { label: 'Stage', buckets: [{ id: 'open', label: 'Open', tone: 'info' }, { id: 'won', label: 'Won' }] } };
  const rows = [
    { ID: 'a', stage: 'won', value: 3 }, { ID: 'b', stage: 'open', value: 1 }, { ID: 'c', stage: 'open', value: 9 },
    { ID: 'd', stage: 'won', value: 3 }, { ID: 'e', stage: 'open', value: 5 }
  ];
  assert.deepEqual(groupsOf(null, axes), []);
  const groups = groupsOf('stage', axes);
  assert.deepEqual(groups.map(({ id, label, tone }) => [id, label, tone]), [['open', 'Open', 'info'], ['won', 'Won', null]]);

  const sorted = sortRecords(rows, { id: 'value', dir: 'desc' }, { groups });
  assert.deepEqual(sorted.map((row) => row.ID), ['c', 'e', 'b', 'a', 'd'], 'group order first, ties keep their order');
  assert.deepEqual(sortRecords(rows, { id: 'value', dir: 'asc' }).map((row) => row.ID), ['b', 'a', 'd', 'e', 'c']);
  const byName = sortRecords([{ n: 'b' }, { n: 'a' }], { id: 'x', dir: 'asc' }, { value: (row) => row.n });
  assert.deepEqual(byName.map((row) => row.n), ['a', 'b'], 'the sort value reader decides');

  const page = sorted.slice(0, 2);
  assert.equal(groupCount(groups[0], page, sorted), '2 of 3', 'a group running on to the next page');
  assert.equal(groupCount(groups[1], sorted, sorted), '2');
  const table = withGroupRows(page, groups, sorted);
  assert.deepEqual(table.map((row) => row.ID), ['group:open', 'c', 'e'], 'only groups on the page get a heading');
  assert.deepEqual(table[0], { ID: 'group:open', kind: 'group', label: 'Open', tone: 'info', count: '2 of 3' });
  assert.equal(withGroupRows(page, [], sorted), page, 'ungrouped, the page as it is');
});

test('an axis can collect strays in an other bucket, and moves write the declared id back', async () => {
  const { axisChoices, bucketOf, bucketValue, groupsOf } = await import('../../website/layouts/overview-filters.js');
  const axis = { buckets: [{ id: 1, label: 'Low' }, { id: 4, label: 'Urgent', tone: 'danger' }], other: { id: 'none', label: 'No priority' } };
  assert.equal(bucketOf(4, axis), 4);
  assert.equal(bucketOf('4', axis), 4, 'a board reports a column id as a string');
  assert.equal(bucketOf(null, axis), 'none');
  assert.equal(bucketOf(7, axis), 'none', 'a value in no bucket falls in other');
  assert.equal(bucketOf(7, { buckets: axis.buckets }), 7, 'without other, the value stays itself');
  assert.equal(bucketValue('4', axis), 4, 'the declared id, not the string a board reports');
  assert.equal(bucketValue('none', axis), null, 'other stores no value');
  assert.deepEqual(axisChoices(axis), [{ value: 1, label: 'Low' }, { value: 4, label: 'Urgent' }, { value: 'none', label: 'No priority' }]);

  const groups = groupsOf('priority', { priority: axis });
  assert.deepEqual(groups.map((group) => group.id), ['1', '4', 'none']);
  const records = [{ priority: 4 }, { priority: null }, { priority: 1 }, { priority: 9 }];
  assert.deepEqual(groups.map((group) => records.filter(group.match).length), [1, 1, 2], 'nothing drops out');
});

test('the drop rule keeps a colliding grouping off the lanes and gives it back off the board', async () => {
  const { resolveBoardAxes, boardLane } = await import('../../website/layouts/overview-filters.js');
  const axes = ['status', 'assignee'];
  const chosen = resolveBoardAxes({ columnBy: 'status', group: 'none' }, { group: 'status' }, axes, 'drop');
  assert.deepEqual(chosen, { columnBy: 'status', group: 'status' }, 'nothing moves');
  assert.equal(boardLane(chosen), null, 'no lanes on the board');
  assert.deepEqual(resolveBoardAxes({ columnBy: 'status', group: 'assignee' }, { columnBy: 'assignee' }, axes, 'drop'),
    { columnBy: 'assignee', group: 'assignee' }, 'columns onto the grouping keep it, laneless');
  assert.deepEqual(resolveBoardAxes({ columnBy: 'status', group: 'status' }, {}, axes, 'drop'), { columnBy: 'status', group: 'status' },
    'entering the board changes nothing');
  assert.equal(boardLane({ columnBy: 'status', group: 'assignee' }), 'assignee');
  assert.equal(boardLane({ columnBy: 'status', group: 'none' }), null);
  // Swap stays the default.
  assert.deepEqual(resolveBoardAxes({ columnBy: 'status', group: 'none' }, { group: 'status' }, axes), { columnBy: 'assignee', group: 'status' });
});
