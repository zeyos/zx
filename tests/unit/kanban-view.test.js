import assert from 'node:assert/strict';
import test from 'node:test';

import {
  KanbanView,
  deriveKanbanDescriptors,
  normalizeKanbanDescriptors,
  reconcileKanbanOrder,
  reorderKanbanData
} from '../../src/components/kanban-view/kanban-view.js';
import { RecordView } from '../../src/components/view/record-view.js';

test('KanbanView extends the shared RecordView contract', () => {
  assert.equal(KanbanView.prototype instanceof RecordView, true);
  assert.equal(KanbanView.cssName, 'kanban-view');
});

test('configured descriptors are cloned, normalized, and keep advisory WIP limits', () => {
  const accept = () => true;
  const source = [{ id: 'proposal', label: 'Proposal', value: 2, limit: 4.9, accept }];
  const descriptors = normalizeKanbanDescriptors(source);

  assert.deepEqual(descriptors, [{
    id: 'proposal', label: 'Proposal', value: 2, limit: 4, accept
  }]);
  assert.notEqual(descriptors[0], source[0]);
  assert.deepEqual(source, [{ id: 'proposal', label: 'Proposal', value: 2, limit: 4.9, accept }]);
  assert.throws(() => normalizeKanbanDescriptors([{ id: 'a' }, { id: 'a' }]), /Duplicate/);
  assert.throws(() => normalizeKanbanDescriptors([{ id: 'a', limit: -1 }]), /non-negative/);
});

test('derived descriptors use stable first-seen values and an explicit unassigned bucket', () => {
  const records = [
    { stage: 'Proposal' }, { stage: null }, { stage: 'Proposal' }, { stage: 3 }, { stage: '' }
  ];
  assert.deepEqual(deriveKanbanDescriptors(records, 'stage'), [
    { id: 'Proposal', label: 'Proposal', value: 'Proposal', limit: null },
    { id: '', label: 'Unassigned', value: null, limit: null },
    { id: '3', label: '3', value: 3, limit: null }
  ]);
  assert.deepEqual(records, [
    { stage: 'Proposal' }, { stage: null }, { stage: 'Proposal' }, { stage: 3 }, { stage: '' }
  ]);
});

test('descriptor order reconciles stale ids and appends new values deterministically', () => {
  const descriptors = [{ id: 'qualified' }, { id: 'proposal' }, { id: 'won' }];
  assert.deepEqual(reconcileKanbanOrder(descriptors, ['won', 'missing', 'won']),
    ['won', 'qualified', 'proposal']);
  assert.deepEqual(reconcileKanbanOrder(descriptors, null), ['qualified', 'proposal', 'won']);
});

test('cross-column and cross-lane moves clone the record and use a bucket-relative index', () => {
  const records = [
    { ID: 1, stage: 'Qualified', owner: 'Ada' },
    { ID: 2, stage: 'Proposal', owner: 'Grace' },
    { ID: 3, stage: 'Proposal', owner: 'Ada' },
    { ID: 4, stage: 'Proposal', owner: 'Ada' }
  ];
  const moved = { ...records[0], stage: 'Proposal', owner: 'Ada' };
  const result = reorderKanbanData(records, 1, moved, {
    recordId: 'ID', columnBy: 'stage', swimlaneBy: 'owner',
    destination: { column: 'Proposal', lane: 'Ada', index: 1 }
  });

  assert.deepEqual(result?.records.map((record) => record.ID), [2, 3, 1, 4]);
  assert.deepEqual(result?.from, { column: 'Qualified', lane: 'Ada', index: 0 });
  assert.deepEqual(result?.to, { column: 'Proposal', lane: 'Ada', index: 1 });
  assert.equal(result?.records[2], moved);
  assert.equal(result?.records[2] === records[0], false);
  assert.deepEqual(records, [
    { ID: 1, stage: 'Qualified', owner: 'Ada' },
    { ID: 2, stage: 'Proposal', owner: 'Grace' },
    { ID: 3, stage: 'Proposal', owner: 'Ada' },
    { ID: 4, stage: 'Proposal', owner: 'Ada' }
  ]);
});

test('same-column moves support first and final positions without mutating host order', () => {
  const records = [
    { ID: 'a', stage: 'Open' }, { ID: 'b', stage: 'Open' }, { ID: 'c', stage: 'Open' }
  ];
  const last = reorderKanbanData(records, 'a', { ...records[0] }, {
    recordId: 'ID', columnBy: 'stage', swimlaneBy: null,
    destination: { column: 'Open', lane: null, index: 2 }
  });
  const first = reorderKanbanData(records, 'c', { ...records[2] }, {
    recordId: 'ID', columnBy: 'stage', swimlaneBy: null,
    destination: { column: 'Open', lane: null, index: 0 }
  });

  assert.deepEqual(last?.records.map((record) => record.ID), ['b', 'c', 'a']);
  assert.deepEqual(first?.records.map((record) => record.ID), ['c', 'a', 'b']);
  assert.deepEqual(records.map((record) => record.ID), ['a', 'b', 'c']);
});

test('movement accepts callback readers and clamps out-of-range destination indexes', () => {
  const records = [{ key: 1, axes: { stage: 'A' } }, { key: 2, axes: { stage: 'B' } }];
  const moved = { key: 1, axes: { stage: 'B' } };
  const result = reorderKanbanData(records, 1, moved, {
    recordId: (record) => record.key,
    columnBy: (record) => record.axes.stage,
    swimlaneBy: null,
    destination: { column: 'B', lane: null, index: 99 }
  });

  assert.deepEqual(result?.records.map((record) => record.key), [2, 1]);
  assert.equal(result?.to.index, 1);
  assert.equal(reorderKanbanData(records, 99, moved, {
    recordId: 'key', columnBy: (record) => record.axes.stage, swimlaneBy: null,
    destination: { column: 'B', lane: null, index: 0 }
  }), null);
});
