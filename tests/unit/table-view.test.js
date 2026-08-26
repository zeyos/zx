import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  moveTableColumn, normalizeTableColumns, reconcileTableColumnOrder, Table
} from '../../src/components/table/table.js';
import {
  fieldsToTableColumns, tableOptionsForView, TableView
} from '../../src/components/table-view/table-view.js';
import { RecordView } from '../../src/components/view/record-view.js';

test('TableView is a RecordView specialization composed with Table', () => {
  assert.equal(TableView.prototype instanceof RecordView, true);
  assert.equal(TableView.cssName, 'table-view');
  assert.equal(typeof TableView.prototype.getTable, 'function');
});

test('the composed Table is not clobbered by a post-render instance class field', () => {
  const source = readFileSync(new URL('../../src/components/table-view/table-view.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /\n\s*table;\s*\n/,
    'render runs in super(); declaring `table;` would overwrite the composed instance afterwards');
});

test('shared fields map to text-safe Table renderers and retain advanced table properties', () => {
  const fields = [{
    id: 'customer',
    label: 'Customer',
    sortable: true,
    get: (record) => record.contact.name,
    render: (_record, index, value) => `${index + 1}. ${value}`,
    sortValue: (record) => record.contact.name.toLowerCase(),
    view: { table: { width: '2fr', editable: false, headerTitle: 'Account customer' } }
  }];
  const [column] = fieldsToTableColumns(fields);
  assert.equal(column.render({ contact: { name: 'Aurora' } }, 1), '2. Aurora');
  assert.equal(column.sortValue({ contact: { name: 'Aurora' } }), 'aurora');
  assert.equal(column.width, '2fr');
  assert.equal(column.headerTitle, 'Account customer');
  assert.equal('get' in column, false);
  assert.deepEqual(fields[0].view, {
    table: { width: '2fr', editable: false, headerTitle: 'Account customer' }
  });
});

test('shared TableView state wins over overlapping Table options while advanced options pass through', () => {
  const shared = {
    fields: [{ id: 'name', label: 'Name', sortable: true }],
    data: [{ key: 1, name: 'Aurora' }],
    recordId: 'key',
    sort: { id: 'name', dir: 'desc' },
    sortMode: 'server',
    selectable: 'multi',
    hiddenFields: [],
    fieldControls: true,
    emptyText: 'No accounts'
  };
  const config = tableOptionsForView({
    columns: [{ id: 'wrong', label: 'Wrong' }],
    data: [],
    rowId: 'wrong',
    selectable: false,
    columnVisibility: false,
    columnReorder: false,
    editMode: 'row',
    responsive: 'md',
    hierarchy: { parentId: 'parent' }
  }, shared);
  assert.deepEqual(config.columns.map((column) => column.id), ['name']);
  assert.notEqual(config.data, shared.data);
  assert.deepEqual(config.data, shared.data);
  assert.equal(config.rowId, 'key');
  assert.equal(config.selectable, 'multi');
  assert.equal(config.columnVisibility, true);
  assert.equal(config.columnReorder, true);
  assert.equal(config.editMode, 'row');
  assert.equal(config.responsive, 'md');
  assert.deepEqual(config.hierarchy, { parentId: 'parent' });
});

test('column normalization, stale-state reconciliation, and movement are immutable', () => {
  const source = [{ id: 'name', label: 'Name' }, { id: 'amount', label: 'Amount' }, { id: 'status' }];
  const columns = normalizeTableColumns(source);
  assert.deepEqual(columns.map((column) => column.label), ['Name', 'Amount', 'status']);
  assert.notEqual(columns[0], source[0]);
  assert.deepEqual(reconcileTableColumnOrder(columns, ['status', 'gone', 'status']),
    ['status', 'name', 'amount']);
  assert.deepEqual(moveTableColumn(['name', 'amount', 'status'], 'status', 'name'),
    ['status', 'name', 'amount']);
  assert.deepEqual(source, [{ id: 'name', label: 'Name' }, { id: 'amount', label: 'Amount' }, { id: 'status' }]);
  assert.throws(() => normalizeTableColumns([{ id: 'name' }, { id: 'name' }]), /Duplicate/);
});

test('Table column APIs preserve stable hidden ids and safely reconcile partial orders', () => {
  const table = Object.create(Table.prototype);
  table._columns = normalizeTableColumns([
    { id: 'name', label: 'Name' }, { id: 'amount', label: 'Amount' }, { id: 'status', label: 'Status' }
  ]);
  table._hiddenColumns = new Set(['amount']);
  table._sort = { id: 'name', dir: 'asc' };
  table._data = [];
  table._expanded = new Set();
  table.options = { hierarchy: false };
  table._abortEdit = () => {};
  table._reconcileExpanded = () => {};
  table._renderColumns = () => {};
  table._renderHeader = () => {};
  table._renderBody = () => {};
  table._renderColumnControls = () => {};
  table.emit = () => {};

  table.setColumnOrder(['status'], { silent: true });
  assert.deepEqual(table.getColumnOrder(), ['status', 'name', 'amount']);
  const returned = table.getColumns();
  returned[0].label = 'Changed outside';
  assert.equal(table.getColumns()[0].label, 'Status');

  table.setColumns([{ id: 'amount', label: 'Amount' }, { id: 'due', label: 'Due' }], { silent: true });
  assert.deepEqual(table.getColumnOrder(), ['amount', 'due']);
  assert.deepEqual(table.getHiddenColumns(), ['amount']);
  assert.equal(table.getSort(), null);
});

test('Table sort state has a defensive getter and a silent clear path', () => {
  const table = Object.create(Table.prototype);
  table._sort = { id: 'name', dir: 'desc' };
  table._abortEdit = () => { table.aborted = true; };
  table._syncSortHeader = () => { table.synced = true; };
  table.emit = () => { throw new Error('silent clear emitted'); };
  const sort = table.getSort();
  sort.dir = 'asc';
  assert.deepEqual(table.getSort(), { id: 'name', dir: 'desc' });
  assert.equal(table.clearSort({ silent: true }), table);
  assert.equal(table.aborted, true);
  assert.equal(table.synced, true);
  assert.equal(table.getSort(), null);
});
