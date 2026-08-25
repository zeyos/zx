import assert from 'node:assert/strict';
import test from 'node:test';

import {
  formatTableCell, projectHierarchyRows, resolveEditable, sortHierarchyRows
} from '../../src/components/table/table.js';

const rows = [
  { id: 'invoice', parent: null, label: 'Invoice', amount: 1234.5, currency: 'EUR' },
  { id: 'labor', parent: 'invoice', label: 'Labor', amount: 6.25, unit: 'hours' },
  { id: 'parts', parent: 'invoice', label: 'Parts', amount: 3, unit: 'pcs' },
  { id: 'screw', parent: 'parts', label: 'Screws', amount: 24, unit: 'pcs' },
  { id: 'orphan', parent: 'missing', label: 'Orphan', amount: 1, unit: 'item' }
];

test('typed transaction cells format number, currency, percent, and row-specific units', () => {
  assert.equal(
    formatTableCell({ id: 'amount', type: 'number', locale: 'en-US', decimals: 2 }, rows[0]),
    '1,234.50'
  );
  assert.equal(
    formatTableCell({
      id: 'amount', type: 'currency', locale: 'en-US', decimals: 2,
      currency: (row) => row.currency
    }, rows[0]),
    new Intl.NumberFormat('en-US', {
      style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2
    }).format(1234.5)
  );
  assert.equal(
    formatTableCell({ id: 'amount', type: 'unit', locale: 'en-US', unit: (row) => row.unit }, rows[1]),
    '6.25\u00a0hours'
  );
  assert.equal(
    formatTableCell({ id: 'ratio', type: 'percent', locale: 'en-US', decimals: 1 }, { ratio: 0.125 }),
    '12.5%'
  );
});

test('nullish row-specific decimals preserve the formatter default instead of forcing integers', () => {
  const expected = new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'EUR'
  }).format(1234.5);
  for (const decimals of [() => null, () => undefined]) {
    assert.equal(formatTableCell({
      id: 'amount', type: 'currency', locale: 'en-US', currency: 'EUR', decimals
    }, rows[0]), expected);
  }
  assert.equal(
    formatTableCell({
      id: 'amount', type: 'currency', locale: 'en-US', currency: 'EUR', decimals: 0
    }, rows[0]),
    new Intl.NumberFormat('en-US', {
      style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0
    }).format(1234.5)
  );
});

test('custom renderers win and invalid typed values remain safely empty', () => {
  const node = { nodeType: 1 };
  assert.equal(formatTableCell({ id: 'amount', type: 'currency', render: () => node }, rows[0]), node);
  assert.equal(formatTableCell({ id: 'amount', type: 'number' }, { amount: Number.NaN }), '');
  assert.equal(formatTableCell({ id: 'amount', type: 'unit', unit: 'kg' }, { amount: null }), '');
});

test('editable true infers a numeric editor for billing column types', () => {
  for (const type of ['number', 'currency', 'percent', 'unit']) {
    assert.equal(resolveEditable({ id: 'amount', type, editable: true }, rows[0]), 'number');
  }
  assert.equal(resolveEditable({ id: 'label', type: 'text', editable: true }, rows[0]), 'text');
  assert.equal(resolveEditable({ id: 'amount', type: 'currency', editable: 'text' }, rows[0]), 'text');
});

test('hierarchy projection is stable, depth-first, and controlled by expansion ids', () => {
  assert.deepEqual(
    projectHierarchyRows(rows, 'id', 'parent').map(({ id, depth, hasChildren }) => ({ id, depth, hasChildren })),
    [
      { id: 'invoice', depth: 0, hasChildren: true },
      { id: 'orphan', depth: 0, hasChildren: false }
    ]
  );
  assert.deepEqual(
    projectHierarchyRows(rows, 'id', 'parent', new Set(['invoice', 'parts']))
      .map(({ id, depth }) => [id, depth]),
    [['invoice', 0], ['labor', 1], ['parts', 1], ['screw', 2], ['orphan', 0]]
  );
});

test('null and undefined parent values both project as hierarchy roots', () => {
  const roots = [{ id: 'null-root', parent: null }, { id: 'undefined-root' }];
  assert.deepEqual(projectHierarchyRows(roots, 'id', 'parent').map(({ id }) => id),
    ['null-root', 'undefined-root']);
});

test('orphans become roots and cyclic input is emitted exactly once', () => {
  const malformed = [
    { id: 'a', parent: 'b' },
    { id: 'b', parent: 'a' },
    { id: 'self', parent: 'self' },
    { id: 'orphan', parent: 'absent' }
  ];
  const result = projectHierarchyRows(malformed, 'id', 'parent', ['a', 'b', 'self', 'orphan']);
  assert.deepEqual(result.map(({ id }) => id), ['a', 'b', 'self', 'orphan']);
  assert.equal(new Set(result.map(({ id }) => id)).size, malformed.length);
});

test('hierarchical sorting reorders siblings without mixing parent and child levels', () => {
  const input = [
    { id: 'b', parent: null, label: 'Beta' },
    { id: 'b2', parent: 'b', label: 'Zulu' },
    { id: 'b1', parent: 'b', label: 'Alpha' },
    { id: 'a', parent: null, label: 'Alpha' },
    { id: 'a1', parent: 'a', label: 'Middle' }
  ];
  assert.deepEqual(
    sortHierarchyRows(input, 'id', 'parent', (row) => row.label, 'asc').map((row) => row.id),
    ['a', 'a1', 'b', 'b1', 'b2']
  );
  // The input is an application-owned collection and must remain untouched.
  assert.deepEqual(input.map((row) => row.id), ['b', 'b2', 'b1', 'a', 'a1']);
});
