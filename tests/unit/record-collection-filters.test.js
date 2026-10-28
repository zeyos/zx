import assert from 'node:assert/strict';
import test from 'node:test';

import {
  astToFilters, filtersToAst, isDraftNode, mergeDrafts, resolveBoardAxes, withoutDrafts
} from '../../website/layouts/record-collection-filters.js';

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
