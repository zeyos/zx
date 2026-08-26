import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  KanbanView,
  deriveKanbanDescriptors,
  normalizeKanbanDescriptors,
  reconcileKanbanOrder,
  reconcileKanbanPreference,
  reorderKanbanData
} from '../../src/components/kanban-view/kanban-view.js';
import { Component } from '../../src/core/component.js';
import { RecordView } from '../../src/components/view/record-view.js';

test('KanbanView extends the shared RecordView contract', () => {
  assert.equal(KanbanView.prototype instanceof RecordView, true);
  assert.equal(KanbanView.cssName, 'kanban-view');
});

test('board styling keeps rail hierarchy, progressive controls, and coarse targets scoped', () => {
  const source = readFileSync(new URL(
    '../../src/components/kanban-view/kanban-view.css', import.meta.url), 'utf8');
  assert.match(source, /--zx-kanban-column-width:\s*18\.5rem/);
  assert.match(source, /--zx-kanban-thumbnail-size:\s*2rem/);
  assert.match(source, /--zx-kanban-card-padding-block:\s*var\(--zx-space-2\)/);
  assert.match(source, /--zx-kanban-card-padding-inline:\s*var\(--zx-space-3\)/);
  assert.match(source, /--zx-kanban-card-gap:\s*var\(--zx-space-2\)/);
  // The board keeps horizontal scrolling but no longer renders a filled, bordered panel.
  assert.match(source, /\.zx-kanban-view__board\s*\{[^}]*overflow:\s*auto/s);
  assert.doesNotMatch(source, /\.zx-kanban-view__board\s*\{[^}]*border:/s);
  assert.doesNotMatch(source, /\.zx-kanban-view__board\s*\{[^}]*background:/s);
  // Columns are transparent rails separated by the grid gap, not nested boxes.
  assert.match(source, /\.zx-kanban-view__columns\s*\{[^}]*gap:\s*var\(--zx-space-4\)/s);
  assert.doesNotMatch(source, /\.zx-kanban-view__column\s*\{[^}]*border:/s);
  assert.doesNotMatch(source, /\.zx-kanban-view__column\s*\{[^}]*background:/s);
  // Compact headings keep title, count, and collapse control on one short row.
  assert.match(source, /\.zx-kanban-view__column-heading\s*\{[^}]*min-block-size:\s*2rem/s);
  // Counts stay quiet text; WIP limit/exceeded uses semantic colour, not a filled pill.
  assert.match(source, /\.zx-kanban-view__count\s*\{[^}]*color:\s*var\(--zx-color-text-muted\)/s);
  assert.match(source, /\.zx-kanban-view__column\[data-wip="limit"\] \.zx-kanban-view__count\s*\{[^}]*color:\s*var\(--zx-color-warning\)/s);
  assert.match(source, /\.zx-kanban-view__column\[data-wip="exceeded"\] \.zx-kanban-view__count\s*\{[^}]*color:\s*var\(--zx-color-danger\)/s);
  assert.doesNotMatch(source, /\.zx-kanban-view__column\[data-wip="limit"\] \.zx-kanban-view__count\s*\{[^}]*background:/s);
  // Empty card lists stay transparent but keep a usable drop height.
  assert.match(source, /\.zx-kanban-view__cards\s*\{[^}]*min-block-size:\s*4rem/s);
  assert.doesNotMatch(source, /\.zx-kanban-view__cards\s*\{[^}]*background:/s);
  assert.match(source, /\.zx-kanban-view__cards\s*\{[^}]*gap:\s*var\(--zx-space-2\)/s);
  assert.match(source, /\.zx-kanban-view__columns\[hidden\],[\s\S]*\.zx-kanban-view__cards\[hidden\]\s*\{[^}]*display:\s*none/s);
  // Cards remain the primary surfaces with a restrained radius and subtle shadow.
  assert.match(source, /\.zx-kanban-view__cards > \.zx-record-card\s*\{[^}]*border-radius:\s*var\(--zx-radius-md\)/s);
  assert.match(source, /\.zx-kanban-view \.zx-record-card:has\(> \.zx-record-card__preview\)/);
  assert.match(source, /\.zx-kanban-view :where\(\.zx-record-card\[data-variant="outlined"\]\)\s*\{[^}]*box-shadow:\s*var\(--zx-shadow-1\)/s);
  assert.match(source, /\.zx-kanban-view \.zx-record-card__eyebrow-group\[data-card-slot="eyebrow-start"\]/);
  assert.match(source, /\.zx-kanban-view \.zx-record-card__title-prefix \.zx-icon/);
  assert.match(source, /\.zx-kanban-view \.zx-record-card__actions\s*\{[^}]*opacity:\s*0[^}]*pointer-events:\s*none/s);
  assert.match(source, /\.zx-kanban-view \.zx-record-card:focus-within \.zx-record-card__actions/);
  assert.match(source, /\.zx-kanban-view \.zx-record-card\[data-selected="true"\] \.zx-record-card__actions/);
  assert.doesNotMatch(source, /\.zx-kanban-view \.zx-record-card\[aria-selected="true"\]/);
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

test('derived-axis preferences survive empty results and reconcile when descriptors arrive', () => {
  assert.deepEqual(reconcileKanbanPreference([], ['done', 'todo'], true), ['done', 'todo']);
  assert.deepEqual(reconcileKanbanPreference([{ id: 'todo' }], ['done', 'todo'], true),
    ['done', 'todo']);
  assert.deepEqual(reconcileKanbanPreference(
    [{ id: 'todo' }, { id: 'done' }, { id: 'review' }], ['done', 'todo'], true),
  ['done', 'todo', 'review']);
  assert.deepEqual(reconcileKanbanPreference([{ id: 'todo' }], ['done', 'todo'], false), ['todo']);
});

test('saved derived order and collapse state remain pending until records load', () => {
  const view = kanbanMethodFixture({ data: [], swimlaneBy: 'team' });
  view.setViewState({
    version: 1,
    columnOrder: ['done', 'todo'],
    swimlaneOrder: ['red', 'blue'],
    collapsedColumns: ['done'],
    collapsedSwimlanes: ['red']
  }, { silent: true });

  assert.deepEqual(view.getViewState().columnOrder, ['done', 'todo']);
  assert.deepEqual(view.getViewState().swimlaneOrder, ['red', 'blue']);
  assert.deepEqual(view.getViewState().collapsedColumns, ['done']);
  assert.deepEqual(view.getViewState().collapsedSwimlanes, ['red']);

  view._viewData = [
    { ID: 1, status: 'todo', team: 'blue' },
    { ID: 2, status: 'done', team: 'red' }
  ];
  assert.deepEqual(view.getColumnOrder(), ['done', 'todo']);
  assert.deepEqual(view.getSwimlaneOrder(), ['red', 'blue']);
  assert.deepEqual(view.getCollapsedColumns(), ['done']);
  assert.deepEqual(view.getCollapsedSwimlanes(), ['red']);
});

test('Component can honor mirrored DOM cancellation without changing ordinary emit behavior', () => {
  const component = /** @type {EventTarget & {el:EventTarget}} */ (new EventTarget());
  component.el = new EventTarget();
  component.el.addEventListener('zx-ordinary', (event) => event.preventDefault());
  component.el.addEventListener('zx-guarded', (event) => event.preventDefault());

  const ordinary = Component.prototype.emit.call(component, 'ordinary', {});
  const guarded = Component.prototype.emit.call(component, 'guarded', {}, { honorDomCancellation: true });
  assert.equal(ordinary.defaultPrevented, false);
  assert.equal(guarded.defaultPrevented, true);
});

test('component and mirrored-event cancellation veto local and external Kanban moves', () => {
  for (const moveMode of ['local', 'external']) {
    const view = kanbanMethodFixture({
      moveMode,
      data: [{ ID: 1, status: 'todo', title: 'Alpha' }, { ID: 2, status: 'done', title: 'Beta' }]
    });
    let emitOptions = null;
    view.emit = (type, _detail, options) => {
      if (type === 'recordmove') emitOptions = options;
      return /** @type {any} */ ({ defaultPrevented: type === 'recordmove' });
    };
    const before = view.getData();
    view.moveRecord(1, { column: 'done', index: 0 });
    assert.deepEqual(view.getData(), before);
    assert.deepEqual(emitOptions, { honorDomCancellation: true });
    assert.match(view._lastAnnouncement, /canceled/);
  }
});

test('an accepted manual local move clears local sort before publishing reordered data', () => {
  const view = kanbanMethodFixture({
    data: [{ ID: 1, status: 'todo', title: 'Alpha' }, { ID: 2, status: 'todo', title: 'Beta' }],
    sort: { id: 'title', dir: 'asc' }
  });
  const events = [];
  view.emit = (type) => {
    events.push(type);
    return /** @type {any} */ ({ defaultPrevented: false });
  };

  view.moveRecord(1, { column: 'todo', index: 1 });
  assert.deepEqual(view.getData().map((record) => record.ID), [2, 1]);
  assert.equal(view.getSort(), null);
  assert.ok(events.includes('sortchange'));
  assert.ok(events.includes('datachange'));
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

/**
 * Builds a DOM-free instance for public-method regression tests. Render hooks and announcements are
 * replaced, but all RecordView/Kanban data, state, sorting, acceptance, and move logic stays real.
 * @param {{data?:Record<string,any>[],moveMode?:'local'|'external',swimlaneBy?:string|null,sort?:{id:string,dir:'asc'|'desc'}|null}} [overrides]
 * @returns {KanbanView & {_lastAnnouncement:string}}
 */
function kanbanMethodFixture(overrides = {}) {
  const data = overrides.data ?? [{ ID: 1, status: 'todo', title: 'Alpha' }];
  const swimlaneBy = overrides.swimlaneBy ?? null;
  const fields = [{ id: 'title', label: 'Title', sortable: true }];
  const view = /** @type {KanbanView & {_lastAnnouncement:string}} */ (Object.create(KanbanView.prototype));
  Object.assign(view, {
    options: {
      ...KanbanView.defaults,
      fields,
      data,
      recordId: 'ID',
      columnBy: 'status',
      columns: null,
      swimlaneBy,
      swimlanes: null,
      moveMode: overrides.moveMode ?? 'local',
      sortMode: 'local'
    },
    _viewFields: fields,
    _viewFieldOrder: ['title'],
    _viewHidden: new Set(),
    _viewData: [...data],
    _viewSort: overrides.sort ?? null,
    _viewSelected: new Set(),
    _viewFieldList: null,
    _kanbanColumns: null,
    _kanbanSwimlanes: null,
    _kanbanColumnOrder: [],
    _kanbanSwimlaneOrder: [],
    _collapsedColumns: new Set(),
    _collapsedSwimlanes: new Set(),
    _board: null,
    _lastAnnouncement: ''
  });
  view._refreshView = () => {};
  view._announce = (message) => { view._lastAnnouncement = message; };
  view._moveHandle = () => null;
  return view;
}
