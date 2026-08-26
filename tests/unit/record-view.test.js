import assert from 'node:assert/strict';
import test from 'node:test';

import {
  moveViewField, normalizeViewFields, normalizeViewState, readViewField,
  reconcileFieldOrder, renderViewField, sortViewRecords, viewRecordId
} from '../../src/components/view/record-view.js';

const fields = normalizeViewFields([
  { id: 'name', label: 'Name', sortable: true },
  { id: 'amount', sortable: true, sortValue: (record) => record.amount },
  { id: 'status', visible: false }
]);

test('view fields are cloned, validated, and humanized', () => {
  assert.equal(fields[1].label, 'Amount');
  assert.equal(fields[1].type, 'text');
  assert.throws(() => normalizeViewFields([{ id: 'x' }, { id: 'x' }]), /Duplicate/);
  assert.throws(() => normalizeViewFields([{}]), /requires an id/);
});

test('stale field orders reconcile and moves stay immutable', () => {
  assert.deepEqual(reconcileFieldOrder(fields, ['amount', 'gone']), ['amount', 'name', 'status']);
  const order = ['name', 'amount', 'status'];
  assert.deepEqual(moveViewField(order, 'status', 'name', 'before'), ['status', 'name', 'amount']);
  assert.deepEqual(order, ['name', 'amount', 'status']);
});

test('saved state ignores unknown fields and never hides every field', () => {
  const state = normalizeViewState({
    fieldOrder: ['gone', 'status', 'name'],
    hiddenFields: ['name', 'amount', 'status', 'gone'],
    sort: { id: 'amount', dir: 'desc' }
  }, fields);
  assert.deepEqual(state.fieldOrder, ['status', 'name', 'amount']);
  assert.deepEqual(state.hiddenFields.sort(), ['amount', 'status']);
  assert.deepEqual(state.sort, { id: 'amount', dir: 'desc' });
});

test('field access, rendering, ids, and sorting share one descriptor contract', () => {
  const records = [
    { ID: 1, name: 'Beta', amount: 20 },
    { ID: 2, name: 'Alpha', amount: 5 }
  ];
  assert.equal(viewRecordId(records[0], 'ID'), 1);
  assert.equal(readViewField(fields[0], records[0]), 'Beta');
  assert.equal(renderViewField(fields[0], records[0]), 'Beta');
  assert.deepEqual(sortViewRecords(records, fields, { id: 'amount', dir: 'asc' }).map((record) => record.ID), [2, 1]);
  assert.deepEqual(records.map((record) => record.ID), [1, 2]);
});
