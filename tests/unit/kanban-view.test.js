import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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

test('board styling keeps hierarchy, progressive controls, and coarse targets scoped', () => {
  const source = readFileSync(new URL(
    '../../src/components/kanban-view/kanban-view.css', import.meta.url), 'utf8');
  assert.match(source, /--zx-kanban-column-width:\s*20rem/);
  assert.match(source, /--zx-kanban-thumbnail-size:\s*2rem/);
  assert.match(source, /--zx-kanban-card-padding-block:\s*var\(--zx-space-2\)/);
  assert.match(source, /--zx-kanban-card-padding-inline:\s*var\(--zx-space-3\)/);
  assert.match(source, /--zx-kanban-card-gap:\s*var\(--zx-space-2\)/);
  assert.match(source, /\.zx-kanban-view__column-heading\s*\{[^}]*min-block-size:\s*3rem/s);
  assert.match(source, /\.zx-kanban-view__column\s*\{[^}]*background:\s*var\(--zx-color-bg-muted\)/s);
  assert.match(source, /\.zx-kanban-view__cards\s*\{[^}]*gap:\s*var\(--zx-space-2\)/s);
  assert.match(source, /\.zx-kanban-view__columns\[hidden\],[\s\S]*\.zx-kanban-view__cards\[hidden\]\s*\{[^}]*display:\s*none/s);
  assert.match(source, /\.zx-kanban-view \.zx-record-card:has\(> \.zx-record-card__preview\)/);
  assert.match(source, /\.zx-kanban-view :where\(\.zx-record-card\[data-variant="outlined"\]\)\s*\{[^}]*box-shadow:\s*var\(--zx-shadow-1\)/s);
  assert.match(source, /\.zx-kanban-view \.zx-record-card__eyebrow-group\[data-card-slot="eyebrow-start"\]/);
  assert.match(source, /\.zx-kanban-view \.zx-record-card__title-prefix \.zx-icon/);
  assert.match(source, /\.zx-kanban-view \.zx-record-card__actions\s*\{[^}]*opacity:\s*0[^}]*pointer-events:\s*none/s);
  assert.match(source, /\.zx-kanban-view \.zx-record-card:focus-within \.zx-record-card__actions/);
  assert.match(source, /-webkit-line-clamp:\s*2/);
  assert.match(source, /@media \(hover:\s*none\), \(pointer:\s*coarse\)[\s\S]*opacity:\s*1/s);
  assert.match(source, /@media \(pointer:\s*coarse\)[\s\S]*inline-size:\s*2\.75rem[\s\S]*min-block-size:\s*2\.75rem/s);
  assert.doesNotMatch(source, /@media \(pointer:\s*coarse\)[\s\S]*::before/);
  assert.doesNotMatch(source, /^\.zx-record-card__/m);
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
