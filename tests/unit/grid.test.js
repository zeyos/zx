import assert from 'node:assert/strict';
import test from 'node:test';

import { Grid, billingColumns, billingItemsConfig, isBillingLine } from '../../src/components/grid/grid.js';
import { Table, reorderTableRows } from '../../src/components/table/table.js';

const fields = {
  id: 'key', parent: 'parentKey', item: 'description', kind: 'rowType',
  quantity: 'qty', unit: 'measure', unitPrice: 'price', currency: 'ccy', total: 'amount'
};

test('Grid is a Table specialization and keeps the Table CSS block', () => {
  assert.equal(Grid.prototype instanceof Table, true);
  assert.equal(Grid.cssName, 'table');
});

test('billing line detection keeps groups and subtotals read-only', () => {
  assert.equal(isBillingLine({ rowType: 'line' }, fields), true);
  assert.equal(isBillingLine({ rowType: 'group' }, fields), false);
  assert.equal(isBillingLine({ rowType: 'subtotal' }, fields), false);
});

test('billing columns apply field maps, choices, formatting, and immutable overrides', () => {
  const overrides = { quantity: { label: 'Hours' } };
  const columns = billingColumns(fields, {
    units: [{ value: 'h', label: 'Hours' }],
    currencies: { EUR: 'Euro' },
    currency: 'EUR',
    locale: 'de-DE',
    decimals: 2,
    columnOverrides: overrides
  });
  assert.deepEqual(columns.map((column) => column.id),
    ['description', 'qty', 'measure', 'price', 'ccy', 'amount']);
  assert.equal(columns[1].label, 'Hours');
  assert.equal(columns[2].editable({ rowType: 'line' }), 'select');
  assert.equal(columns[3].currency({ ccy: 'USD' }), 'USD');
  assert.deepEqual(overrides, { quantity: { label: 'Hours' } });
});

test('billing preset config merges Table options and calculates totals before caller listeners', () => {
  const calls = [];
  const source = {
    fields: { ...fields },
    selectable: 'multiple',
    columnOverrides: { item: { label: 'Service' } },
    lineTotal: (row, changes) => {
      calls.push(['calculate', { ...changes }]);
      return row.qty * row.price;
    },
    oneditcommit: (event) => calls.push(['listener', event.detail.changes.amount])
  };
  const config = billingItemsConfig(source);
  const changes = { qty: 3 };
  config.oneditcommit({ detail: {
    row: { rowType: 'line', qty: 2, price: 10, amount: 20 },
    changes
  } });

  assert.equal(config.rowId, 'key');
  assert.equal(config.hierarchy.parentId, 'parentKey');
  assert.equal(config.selectable, 'multiple');
  assert.equal(config.editTrigger, 'single');
  assert.equal(config.rowReorder, true);
  assert.equal(config.columnVisibility, true);
  assert.equal(config.columns[0].label, 'Service');
  assert.equal(changes.amount, 30);
  assert.deepEqual(calls, [['calculate', { qty: 3 }], ['listener', 30]]);
  assert.deepEqual(source.fields, fields);
  assert.deepEqual(source.columnOverrides, { item: { label: 'Service' } });
});

test('row reordering is immutable and supports both target edges', () => {
  const rows = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  assert.deepEqual(reorderTableRows(rows, 'id', 'c', 'a'), [{ id: 'c' }, { id: 'a' }, { id: 'b' }]);
  assert.deepEqual(reorderTableRows(rows, 'id', 'a', 'b', 'after'), [{ id: 'b' }, { id: 'a' }, { id: 'c' }]);
  assert.deepEqual(rows, [{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
});

test('hierarchical row reordering only moves siblings and keeps IDs authoritative', () => {
  const rows = [
    { id: 'one', parent: null }, { id: 'one-a', parent: 'one' },
    { id: 'two', parent: null }, { id: 'two-a', parent: 'two' }
  ];
  assert.equal(reorderTableRows(rows, 'id', 'one-a', 'two-a', 'before', 'parent'), null);
  assert.deepEqual(
    reorderTableRows(rows, 'id', 'two', 'one', 'before', 'parent').map((row) => row.id),
    ['two', 'two-a', 'one', 'one-a']
  );
  assert.equal(reorderTableRows(rows, 'id', 'missing', 'one'), null);
});

test('hierarchical row reordering moves a complete descendant branch after the target branch', () => {
  const rows = [
    { id: 'one', parent: null }, { id: 'one-a', parent: 'one' }, { id: 'one-a-i', parent: 'one-a' },
    { id: 'two', parent: null }, { id: 'two-a', parent: 'two' }
  ];
  assert.deepEqual(
    reorderTableRows(rows, 'id', 'one', 'two', 'after', 'parent').map((row) => row.id),
    ['two', 'two-a', 'one', 'one-a', 'one-a-i']
  );
});

test('hierarchical row reordering treats null and undefined parent values as the same root', () => {
  const rows = [{ id: 'one', parent: null }, { id: 'two' }];
  assert.deepEqual(
    reorderTableRows(rows, 'id', 'two', 'one', 'before', 'parent').map((row) => row.id),
    ['two', 'one']
  );
});

test('billing preset keeps group rows read-only and does not calculate their totals', () => {
  let calculated = false;
  const config = billingItemsConfig({
    lineTotal: () => { calculated = true; return 99; }
  });
  const changes = { quantity: 2 };
  config.oneditcommit({ detail: { row: { kind: 'subtotal', total: 10 }, changes } });
  assert.equal(calculated, false);
  assert.deepEqual(changes, { quantity: 2 });
  assert.match(config.rowClass({ kind: 'group' }), /zx-grid-billing__summary/);
});

test('billing preset does not turn missing operands into zero totals', () => {
  const config = billingItemsConfig();
  for (const field of ['quantity', 'unitPrice']) {
    for (const missing of [null, undefined, '', '   ']) {
      const changes = { item: 'Edited' };
      const row = { kind: 'line', quantity: 2, unitPrice: 12, total: null, [field]: missing };
      config.oneditcommit({ detail: { row, changes } });
      assert.deepEqual(changes, { item: 'Edited' }, `${field} ${String(missing)} created a total`);
    }
  }
  const changes = { quantity: 0 };
  config.oneditcommit({ detail: {
    row: { kind: 'line', quantity: 4, unitPrice: '12', total: 48 }, changes
  } });
  assert.equal(changes.total, 0);
});
