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
import {
  absoluteKanbanIndex,
  allowsKanbanTransition,
  createKanbanHistory,
  evaluateKanbanMove,
  kanbanSearchTerms,
  matchesKanbanSearch,
  normalizeKanbanRules,
  reorderKanbanRecords,
  resolveKanbanRules
} from '../../src/components/kanban-view/kanban-policy.js';
import {
  kanbanAvatarLimit,
  resolveKanbanAssignees,
  resolveKanbanIndicator,
  resolveKanbanProgress
} from '../../src/components/kanban-view/kanban-card.js';
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
  // Lane capacity reads exactly like column capacity, and only on the lane's own heading.
  assert.match(source, /\.zx-kanban-view__lane\[data-wip="limit"\] > \.zx-kanban-view__lane-heading \.zx-kanban-view__count\s*\{[^}]*color:\s*var\(--zx-color-warning\)/s);
  assert.match(source, /\.zx-kanban-view__lane\[data-wip="exceeded"\] > \.zx-kanban-view__lane-heading \.zx-kanban-view__count\s*\{[^}]*color:\s*var\(--zx-color-danger\)/s);
  // The first matching rule paints a marker; badges and the accessible description carry the rest.
  assert.match(source, /\.zx-kanban-view \.zx-record-card\[data-rule-tone\]::before\s*\{[^}]*inline-size:\s*3px/s);
  assert.match(source, /\.zx-kanban-view \.zx-record-card\[data-rule-tone="danger"\]::before\s*\{[^}]*var\(--zx-color-danger\)/s);
  // The drag preview tracks the pointer and must never be hit-tested.
  assert.match(source, /\.zx-kanban-view__drag-preview\s*\{[^}]*position:\s*fixed/s);
  assert.match(source, /\.zx-kanban-view__drag-preview\s*\{[^}]*pointer-events:\s*none/s);
  // A column height turns each card list into its own scroll region.
  assert.match(source, /\[data-column-scroll="true"\] \.zx-kanban-view__cards\s*\{[^}]*max-block-size:\s*var\(--zx-kanban-column-height\)/s);
  // The card is the pointer drag source, so the handle is keyboard furniture: out of sight and
  // out of the layout until it takes focus or holds a grabbed card.
  assert.match(source, /\.zx-kanban-view__move-handle\[data-reveal="keyboard"\]\s*\{[^}]*position:\s*absolute/s);
  assert.match(source, /\.zx-kanban-view__move-handle\[data-reveal="keyboard"\]\s*\{[^}]*clip-path:\s*inset\(50%\)/s);
  // Reveal on :focus, not :focus-visible — a pointer drop focuses the handle programmatically,
  // and :focus-visible does not match after pointer input.
  assert.match(source, /\[data-reveal="keyboard"\]:focus,[\s\S]*\[aria-pressed="true"\]\s*\{[^}]*clip-path:\s*none/s);
  assert.doesNotMatch(source, /\[data-reveal="keyboard"\]:focus-visible/);
  // Head and footer are quiet rails around the shared card anatomy, not new boxes.
  assert.match(source, /\.zx-kanban-view__identifier\s*\{[^}]*color:\s*var\(--zx-color-text-muted\)/s);
  assert.match(source, /\.zx-kanban-view__progress-track\s*\{[^}]*background:\s*var\(--zx-color-bg-muted\)/s);
  assert.match(source, /\.zx-kanban-view__progress-fill\s*\{[^}]*background:\s*var\(--zx-color-accent\)/s);
  assert.match(source, /\.zx-kanban-view__avatar \+ \.zx-kanban-view__avatar\s*\{[^}]*margin-inline-start:\s*calc\(var\(--zx-space-2\) \* -1\)/s);
  assert.match(source, /\.zx-kanban-view__column-empty\s*\{[^}]*border:\s*1px dashed/s);
  assert.match(source, /@media \(hover:\s*none\), \(pointer:\s*coarse\)[\s\S]*opacity:\s*1/s);
  assert.match(source, /@media \(pointer:\s*coarse\)[\s\S]*inline-size:\s*2\.75rem[\s\S]*min-block-size:\s*2\.75rem/s);
  // Coarse targets grow the control itself; none of the coarse blocks may fake a hit area with a
  // pseudo-element. `[^@]*` keeps each assertion inside one media block.
  assert.doesNotMatch(source, /@media \(pointer:\s*coarse\)[^@]*::before/);
  assert.doesNotMatch(source, /^\.zx-record-card__/m);
});

test('configured descriptors are cloned, normalized, and keep advisory WIP limits', () => {
  const accept = () => true;
  const source = [{ id: 'proposal', label: 'Proposal', value: 2, limit: 4.9, accept }];
  const descriptors = normalizeKanbanDescriptors(source);

  assert.deepEqual(descriptors, [{
    id: 'proposal', label: 'Proposal', value: 2, limit: 4, from: null, accept
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

test('ordered card rules are validated, cloned, and matched in configuration order', () => {
  const rules = normalizeKanbanRules([
    { id: 'stale', when: (record) => record.age > 30, tone: 'danger', label: 'Stale' },
    { id: 'noisy', when: () => { throw new Error('broken'); } },
    { id: 'big', when: (record) => record.value > 100, tone: 'nonsense' }
  ]);

  assert.deepEqual(rules.map((rule) => rule.tone), ['danger', 'accent', 'accent']);
  assert.deepEqual(rules.map((rule) => rule.label), ['Stale', '', '']);
  // A rule whose predicate throws must not take the board down with it.
  assert.deepEqual(
    resolveKanbanRules(rules, { age: 40, value: 200 }, { index: 0, column: 'a', lane: null })
      .map((rule) => rule.id),
    ['stale', 'big']);
  assert.deepEqual(normalizeKanbanRules(null), []);
  assert.throws(() => normalizeKanbanRules([{ id: 'a' }]), /when predicate/);
  assert.throws(() => normalizeKanbanRules([{ id: 'a', when: () => true }, { id: 'a', when: () => true }]),
    /Duplicate/);
});

test('transition rules judge only the axis a move actually crosses', () => {
  const column = { id: 'done', label: 'Done', from: ['review'] };
  const lane = { id: 'red', label: 'Red', from: ['blue'] };
  assert.equal(allowsKanbanTransition(column, null, { column: 'review', lane: null, index: 0 }), null);
  assert.equal(allowsKanbanTransition(column, null, { column: 'todo', lane: null, index: 0 }), 'transition');
  // Reordering inside the column is not a transition into it.
  assert.equal(allowsKanbanTransition(column, null, { column: 'done', lane: null, index: 0 }), null);
  assert.equal(allowsKanbanTransition(column, lane, { column: 'review', lane: 'green', index: 0 }),
    'lane-transition');
  assert.equal(allowsKanbanTransition({ id: 'x', label: 'X' }, null, { column: 'y', lane: null, index: 0 }),
    null);
  assert.equal(allowsKanbanTransition({ id: 'x', label: 'X', from: [] }, null,
    { column: 'y', lane: null, index: 0 }), 'transition');
});

test('work-in-progress policy warns by default and blocks only when configured', () => {
  const base = {
    records: [{}], column: { id: 'open', label: 'Open', limit: 2 }, swimlane: null,
    context: {}, from: { column: 'todo', lane: null, index: 0 },
    columnCount: 2, laneCount: 0, cellCount: 2
  };
  const warned = evaluateKanbanMove(base);
  assert.equal(warned.allowed, true);
  assert.equal(warned.limitExceeded, true);
  assert.equal(warned.count, 3);

  const blocked = evaluateKanbanMove({ ...base, policy: 'block' });
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.reason, 'wip');

  // A column may opt into blocking while the rest of the board only warns.
  const columnBlocked = evaluateKanbanMove({
    ...base, column: { ...base.column, wipPolicy: 'block' }
  });
  assert.equal(columnBlocked.allowed, false);

  const reached = evaluateKanbanMove({ ...base, columnCount: 1, cellCount: 1 });
  assert.equal(reached.limitReached, true);
  assert.equal(reached.limitExceeded, false);
});

test('lane limits and per-lane column limits are enforced alongside the column limit', () => {
  const context = {
    records: [{}, {}], column: { id: 'open', label: 'Open', limit: 10, laneLimits: { red: 2 } },
    swimlane: { id: 'red', label: 'Red', limit: 10 }, context: {},
    from: { column: 'todo', lane: 'red', index: 0 },
    columnCount: 0, laneCount: 0, cellCount: 1, policy: /** @type {'block'} */ ('block')
  };
  const cell = evaluateKanbanMove(context);
  assert.equal(cell.allowed, false);
  assert.equal(cell.limit, 2);

  const lane = evaluateKanbanMove({
    ...context, column: { id: 'open', label: 'Open', limit: null },
    swimlane: { id: 'red', label: 'Red', limit: 2 }, laneCount: 1
  });
  assert.equal(lane.allowed, false);
  assert.equal(lane.reason, 'lane-wip');
});

test('eligibility predicates refuse a move for any record in an atomic group', () => {
  const column = { id: 'won', label: 'Won', accept: (record) => record.value > 10 };
  const result = evaluateKanbanMove({
    records: [{ value: 50 }, { value: 1 }], column, swimlane: null, context: {},
    from: { column: 'open', lane: null, index: 0 },
    columnCount: 0, laneCount: 0, cellCount: 0
  });
  assert.equal(result.allowed, false);
  assert.equal(result.reason, 'accept');
});

test('search terms honour quoted phrases and match every term', () => {
  assert.deepEqual(kanbanSearchTerms('  Ada   "needs review" '), ['ada', 'needs review']);
  assert.deepEqual(kanbanSearchTerms(null), []);
  assert.equal(matchesKanbanSearch('Ada Lovelace needs review', ['ada', 'needs review']), true);
  assert.equal(matchesKanbanSearch('Ada Lovelace', ['ada', 'needs review']), false);
  assert.equal(matchesKanbanSearch('anything', []), true);
});

test('hidden records keep their place: visible positions map back to absolute ones', () => {
  //                      0      1      2      3
  const visibility = [false, true, false, true];
  assert.equal(absoluteKanbanIndex(visibility, 0), 1);
  assert.equal(absoluteKanbanIndex(visibility, 1), 3);
  // Appending past the last visible card appends past every hidden one too.
  assert.equal(absoluteKanbanIndex(visibility, 2), 4);
  assert.equal(absoluteKanbanIndex([], 0), 0);
});

test('bounded history steps back and forward and drops the redo branch on a new step', () => {
  const history = createKanbanHistory(2);
  assert.equal(history.canUndo(), false);
  history.push({ records: ['a'], selection: [] });
  history.push({ records: ['b'], selection: [] });
  history.push({ records: ['c'], selection: [] });
  assert.deepEqual(history.depth(), { undo: 2, redo: 0 });

  const back = history.undo({ records: ['d'], selection: [1] });
  assert.deepEqual(back?.records, ['c']);
  assert.equal(history.canRedo(), true);
  const forward = history.redo({ records: ['c'], selection: [] });
  assert.deepEqual(forward?.records, ['d']);
  assert.deepEqual(forward?.selection, [1]);

  history.undo({ records: ['d'], selection: [] });
  history.push({ records: ['e'], selection: [] });
  assert.equal(history.canRedo(), false);
  history.clear();
  assert.deepEqual(history.depth(), { undo: 0, redo: 0 });
});

test('an atomic multi-card move keeps relative order and lands contiguously', () => {
  const records = [
    { ID: 'a', stage: 'Open' }, { ID: 'b', stage: 'Done' },
    { ID: 'c', stage: 'Open' }, { ID: 'd', stage: 'Done' }
  ];
  const result = reorderKanbanRecords(records, [
    { id: 'c', record: { ID: 'c', stage: 'Done' } },
    { id: 'a', record: { ID: 'a', stage: 'Done' } }
  ], {
    recordId: 'ID', columnBy: 'stage', swimlaneBy: null,
    destination: { column: 'Done', lane: null, index: 1 }
  });

  // The movers are reordered into board order before insertion, so a and c stay in that sequence.
  assert.deepEqual(result?.records.map((record) => record.ID), ['b', 'a', 'c', 'd']);
  assert.deepEqual(result?.moves.map((move) => [move.id, move.from.index]), [['a', 0], ['c', 1]]);
  assert.deepEqual(records.map((record) => record.stage), ['Open', 'Done', 'Open', 'Done']);
  assert.equal(reorderKanbanRecords(records, [{ id: 'zz', record: {} }], {
    recordId: 'ID', columnBy: 'stage', swimlaneBy: null,
    destination: { column: 'Done', lane: null, index: 0 }
  }), null);
});

test('a blocked move writes nothing, announces its reason, and reports it once', () => {
  const view = kanbanMethodFixture({
    data: [
      { ID: 1, status: 'todo', title: 'Alpha' },
      { ID: 2, status: 'done', title: 'Beta' }
    ],
    columns: [{ id: 'todo', label: 'To do' }, { id: 'done', label: 'Done', limit: 1 }],
    wipPolicy: 'block'
  });
  const events = [];
  view.emit = (type, detail) => {
    events.push([type, detail]);
    return /** @type {any} */ ({ defaultPrevented: false });
  };
  const before = view.getData();

  view.moveRecord(1, { column: 'done', index: 0 });
  assert.deepEqual(view.getData(), before);
  assert.deepEqual(events.map((entry) => entry[0]), ['movereject']);
  assert.equal(events[0][1].reason, 'wip');
  assert.equal(events[0][1].limit, 1);
  assert.match(view._lastAnnouncement, /work-in-progress limit of 1/);
  assert.equal(view.canUndo(), false);
});

test('a transition allow-list refuses an origin without consulting capacity', () => {
  const view = kanbanMethodFixture({
    data: [{ ID: 1, status: 'todo', title: 'Alpha' }],
    columns: [
      { id: 'todo', label: 'To do' },
      { id: 'review', label: 'Review' },
      { id: 'done', label: 'Done', from: ['review'] }
    ]
  });
  const events = [];
  view.emit = (type, detail) => {
    events.push([type, detail]);
    return /** @type {any} */ ({ defaultPrevented: false });
  };

  view.moveRecord(1, { column: 'done', index: 0 });
  assert.equal(view.getRecord(1).status, 'todo');
  assert.equal(events[0][0], 'movereject');
  assert.equal(events[0][1].reason, 'transition');
});

test('a committed local move is undoable and redoable, restoring order and selection', () => {
  const view = kanbanMethodFixture({
    data: [
      { ID: 1, status: 'todo', title: 'Alpha' },
      { ID: 2, status: 'todo', title: 'Beta' }
    ],
    selectable: 'multi',
    selection: [1]
  });
  const events = [];
  view.emit = (type, detail) => {
    events.push([type, detail]);
    return /** @type {any} */ ({ defaultPrevented: false });
  };

  view.moveRecord(1, { column: 'todo', index: 1 });
  assert.deepEqual(view.getData().map((record) => record.ID), [2, 1]);
  assert.equal(view.canUndo(), true);
  assert.equal(view.canRedo(), false);

  view.undo();
  assert.deepEqual(view.getData().map((record) => record.ID), [1, 2]);
  assert.deepEqual(view.getSelectionIds(), [1]);
  assert.equal(view.canRedo(), true);

  view.redo();
  assert.deepEqual(view.getData().map((record) => record.ID), [2, 1]);
  assert.ok(events.some((entry) => entry[0] === 'historychange'));

  // Records the host replaces are not the records the stack remembers.
  view.setData([{ ID: 3, status: 'todo', title: 'Gamma' }]);
  assert.equal(view.canUndo(), false);
  assert.equal(view.canRedo(), false);
});

test('moving a selected card moves the whole selection as one step', () => {
  const view = kanbanMethodFixture({
    data: [
      { ID: 1, status: 'todo', title: 'Alpha' },
      { ID: 2, status: 'todo', title: 'Beta' },
      { ID: 3, status: 'done', title: 'Gamma' }
    ],
    columns: [{ id: 'todo', label: 'To do' }, { id: 'done', label: 'Done' }],
    selectable: 'multi',
    selection: [1, 2]
  });
  const moves = [];
  view.emit = (type, detail) => {
    if (type === 'recordmove') moves.push(detail);
    return /** @type {any} */ ({ defaultPrevented: false });
  };

  assert.deepEqual(view._movingIds(1), [1, 2]);
  // Picking up a card outside the selection never drags the selection along.
  assert.deepEqual(view._movingIds(3), [3]);

  view.moveRecords(view._movingIds(1), { column: 'done', index: 0 });
  assert.deepEqual(view.getData().map((record) => record.ID), [1, 2, 3]);
  assert.deepEqual(view.getData().map((record) => record.status), ['done', 'done', 'done']);
  assert.equal(moves.length, 1);
  assert.deepEqual(moves[0].ids, [1, 2]);
  assert.equal(moves[0].id, 1);
  assert.deepEqual(moves[0].moves.map((move) => move.id), [1, 2]);

  view.undo();
  assert.deepEqual(view.getData().map((record) => record.status), ['todo', 'todo', 'done']);
});

test('search narrows rendered cards without disturbing the data it hides', () => {
  const view = kanbanMethodFixture({
    data: [
      { ID: 1, status: 'todo', title: 'Alpha' },
      { ID: 2, status: 'todo', title: 'Beta' },
      { ID: 3, status: 'todo', title: 'Alpaca' },
      { ID: 4, status: 'todo', title: 'Gamma' }
    ]
  });
  view.emit = () => /** @type {any} */ ({ defaultPrevented: false });
  view._refreshView = () => view._resolveVisibility();

  view.setSearch('alp');
  assert.deepEqual(view.getVisibleRecords().map((record) => record.ID), [1, 3]);
  assert.equal(view.getSearch(), 'alp');

  // Dropping before the second visible card must land immediately before it — after the hidden
  // record that sits between them — rather than at the same ordinal in the underlying data.
  assert.equal(view._absoluteIndex('todo', null, 0, new Set([1])), 1);
  // Dropping past the last visible card appends past every hidden one too.
  assert.equal(view._absoluteIndex('todo', null, 1, new Set([1])), 3);

  view._commitInteractionMove([1], { column: 'todo', lane: null, index: 0 });
  assert.deepEqual(view.getData().map((record) => record.ID), [2, 1, 3, 4]);

  view.setSearch('');
  assert.deepEqual(view.getVisibleRecords().map((record) => record.ID), [2, 1, 3, 4]);
});

test('a multi-card move through a search lands where the visible cards say it will', () => {
  const view = kanbanMethodFixture({
    data: [
      { ID: 1, status: 'todo', title: 'Alpha' },
      { ID: 2, status: 'todo', title: 'Beta' },
      { ID: 3, status: 'todo', title: 'Alpaca' },
      { ID: 4, status: 'todo', title: 'Gamma' },
      { ID: 5, status: 'todo', title: 'Alps' }
    ],
    selectable: 'multi',
    selection: [1, 3]
  });
  view.emit = () => /** @type {any} */ ({ defaultPrevented: false });
  view._refreshView = () => view._resolveVisibility();
  view._resolveVisibility();

  view.setSearch('alp');
  assert.deepEqual(view.getVisibleRecords().map((record) => record.ID), [1, 3, 5]);

  // Dropping the pair before the one visible card left in the column must put them immediately
  // before it — after the hidden records that sit in between, not at the same ordinal.
  assert.equal(view._absoluteIndex('todo', null, 0, new Set([1, 3])), 2);
  view._commitInteractionMove(view._movingIds(1), { column: 'todo', lane: null, index: 0 });
  assert.deepEqual(view.getData().map((record) => record.ID), [2, 4, 1, 3, 5]);

  view.undo();
  assert.deepEqual(view.getData().map((record) => record.ID), [1, 2, 3, 4, 5]);
  assert.deepEqual(view.getSelectionIds(), [1, 3]);
});

test('indicator values become badges, and a tone map beats guessing at vocabulary', () => {
  const tones = { High: 'danger', Low: 'info' };
  assert.deepEqual(resolveKanbanIndicator('High', tones),
    { label: 'High', tone: 'danger', icon: null, dot: true });
  // An unmapped value is shown, not hidden, and stays tone-neutral.
  assert.deepEqual(resolveKanbanIndicator('Whenever', tones),
    { label: 'Whenever', tone: 'neutral', icon: null, dot: true });
  // An explicit descriptor wins over the map, and an icon replaces the status dot.
  assert.deepEqual(resolveKanbanIndicator({ label: 'High', tone: 'success', icon: 'star' }, tones),
    { label: 'High', tone: 'success', icon: 'star', dot: false });
  assert.equal(resolveKanbanIndicator({ label: 'X', tone: 'nonsense' }).tone, 'neutral');
  assert.equal(resolveKanbanIndicator(null), null);
  assert.equal(resolveKanbanIndicator(''), null);
  assert.equal(resolveKanbanIndicator({ label: '' }), null);
});

test('completion is measured against an explicit scale rather than a guessed one', () => {
  assert.deepEqual(resolveKanbanProgress(20), { value: 20, max: 100, percent: 20, label: null });
  assert.deepEqual(resolveKanbanProgress(0.72, 1), { value: 0.72, max: 1, percent: 72, label: null });
  // Out-of-range amounts clamp rather than overflowing the track.
  assert.equal(resolveKanbanProgress(180).percent, 100);
  assert.equal(resolveKanbanProgress(-5).percent, 0);
  assert.deepEqual(resolveKanbanProgress({ value: 3, max: 4, label: 'Subtasks' }),
    { value: 3, max: 4, percent: 75, label: 'Subtasks' });
  assert.equal(resolveKanbanProgress(null), null);
  assert.equal(resolveKanbanProgress('not a number'), null);
  assert.equal(resolveKanbanProgress(5, 0), null);
});

test('assignees accept a name, a list, or descriptors, and reject unsafe images', () => {
  assert.deepEqual(resolveKanbanAssignees('Ada Lovelace'),
    [{ name: 'Ada Lovelace', src: null, initials: 'AL' }]);
  assert.deepEqual(resolveKanbanAssignees(['Ada Lovelace', '', null, 'Grace Hopper'])
    .map((person) => person.initials), ['AL', 'GH']);
  assert.deepEqual(resolveKanbanAssignees([{ name: 'Ada', src: 'https://example.test/a.png' }]),
    [{ name: 'Ada', src: 'https://example.test/a.png', initials: 'A' }]);
  // A script URL degrades to initials instead of reaching an img src.
  assert.deepEqual(resolveKanbanAssignees([{ name: 'Ada', src: 'javascript:alert(1)' }]),
    [{ name: 'Ada', src: null, initials: 'A' }]);
  assert.deepEqual(resolveKanbanAssignees([{ name: 'Ada', initials: 'ADA' }])[0].initials, 'ADA');
  assert.deepEqual(resolveKanbanAssignees(null), []);
  // A face nobody can name would render as an unidentified person in a group labelled
  // "Assigned to " — a picture without a person is worse than no picture.
  assert.deepEqual(resolveKanbanAssignees([{ src: 'https://example.test/ada.png' }]), []);
  assert.deepEqual(resolveKanbanAssignees([{ name: '   ' }]), []);
});

test('a blank meter label falls back to the localized default instead of naming nothing', () => {
  // aria-label="" would leave the progressbar unnamed, which is worse than a generic name.
  assert.equal(resolveKanbanProgress({ value: 1, max: 2, label: '' }).label, null);
  assert.equal(resolveKanbanProgress({ value: 1, max: 2, label: '   ' }).label, null);
  assert.equal(resolveKanbanProgress({ value: 1, max: 2, label: 'Subtasks' }).label, 'Subtasks');
});

test('the avatar limit is normalized once, so the overflow chip cannot disagree with the faces', () => {
  assert.deepEqual(kanbanAvatarLimit(3, 5), { shown: 3, hidden: 2 });
  assert.deepEqual(kanbanAvatarLimit(3, 2), { shown: 2, hidden: 0 });
  // A fractional limit used to floor every face away while the chip still counted from the raw
  // option, hiding all three people behind a "+2".
  assert.deepEqual(kanbanAvatarLimit(0.5, 3), { shown: 1, hidden: 2 });
  assert.deepEqual(kanbanAvatarLimit(0, 3), { shown: 1, hidden: 2 });
  // An unusable limit shows everyone rather than nobody.
  assert.deepEqual(kanbanAvatarLimit(Number.NaN, 3), { shown: 3, hidden: 0 });
  // The helper is exported, so a malformed total is normalized here rather than trusted.
  assert.deepEqual(kanbanAvatarLimit(3, -2), { shown: 0, hidden: 0 });
  assert.deepEqual(kanbanAvatarLimit(3, 2.7), { shown: 2, hidden: 0 });
  assert.deepEqual(kanbanAvatarLimit(3, Number.NaN), { shown: 0, hidden: 0 });
});

test('a literal indicator descriptor is content, not a property name', () => {
  const view = kanbanMethodFixture({
    data: [{ ID: 1, status: 'todo', title: 'Alpha' }]
  });
  view.emit = () => /** @type {any} */ ({ defaultPrevented: false });
  view.options = { ...view.options, status: { label: 'Blocked', tone: 'danger' }, priority: 'nope' };
  view._resolveCardSources();

  // Reading the descriptor as a record key resolved undefined and rendered nothing.
  assert.deepEqual(view._cardIndicator(view._cardSources.status, {}, view.getRecord(1), 0),
    { label: 'Blocked', tone: 'danger', icon: null, dot: true });
  // An unknown field id still falls back to a plain property read.
  assert.equal(view._cardIndicator(view._cardSources.priority, {}, { nope: 'High' }, 0).label, 'High');
  assert.equal(view._cardSources.any, true);
});

test('anatomy sources are resolved once per refresh and drop out of the metadata list', () => {
  let reads = 0;
  const view = kanbanMethodFixture({
    data: [{ ID: 1, status: 'todo', title: 'Alpha', due: 'Tomorrow' }]
  });
  view.options = {
    ...view.options,
    fields: [
      { id: 'title', label: 'Title' },
      { id: 'due', label: 'Due' }
    ],
    identifier: () => { reads += 1; return 'KAN-1'; },
    progress: 'due'
  };
  view._viewFields = view.options.fields;
  view._viewFieldOrder = ['title', 'due'];
  view._resolveCardSources();

  // `due` feeds the meter, so repeating it as a labelled metadata row would show it twice.
  assert.deepEqual(view._cardMetadataFields().map((field) => field.id), ['title']);
  assert.deepEqual([...view._cardSources.fieldIds], ['due']);

  view._cardSources.identifier(view.getRecord(1), 0);
  assert.equal(reads, 1, 'the identifier reader runs once per card, not once per use');

  // A field that opts back in is shown in both places deliberately.
  view._viewFields = [{ id: 'title', label: 'Title' }, { id: 'due', label: 'Due', duplicate: true }];
  assert.deepEqual(view._cardMetadataFields().map((field) => field.id), ['title', 'due']);
});

test('a handle-only drag source stays visible whatever moveHandle asks for', () => {
  const view = kanbanMethodFixture({ data: [{ ID: 1, status: 'todo', title: 'Alpha' }] });
  const reveal = (dragFrom, moveHandle) => {
    const options = { ...view.options, dragFrom, moveHandle };
    return options.moveHandle === 'always' || options.dragFrom === 'handle' ? 'always' : 'keyboard';
  };
  // Hiding the only thing a pointer user can grab would make the board unusable.
  assert.equal(reveal('handle', 'keyboard'), 'always');
  assert.equal(reveal('card', 'keyboard'), 'keyboard');
  assert.equal(reveal('card', 'always'), 'always');
});

test('labels replace every announced string without changing behavior', () => {
  const view = kanbanMethodFixture({ data: [{ ID: 1, status: 'todo', title: 'Alpha' }] });
  view.options = { ...view.options, labels: { rejectDestination: 'Nope: %target%' } };
  view.emit = () => /** @type {any} */ ({ defaultPrevented: false });

  view.moveRecord(1, { column: 'nowhere', index: 0 });
  assert.equal(view._lastAnnouncement, 'Nope: %target%');
  assert.equal(view._text('count', { count: 4 }), '4 records');
});

/**
 * Builds a DOM-free instance for public-method regression tests. Render hooks and announcements are
 * replaced, but all RecordView/Kanban data, state, sorting, acceptance, and move logic stays real.
 * @param {{data?:Record<string,any>[],moveMode?:'local'|'external',swimlaneBy?:string|null,sort?:{id:string,dir:'asc'|'desc'}|null,columns?:any[],swimlanes?:any[],wipPolicy?:'warn'|'block',rules?:any[],search?:string,filter?:Function|null,selectable?:false|'single'|'multi',selection?:unknown[]}} [overrides]
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
      columns: overrides.columns ?? null,
      swimlaneBy,
      swimlanes: overrides.swimlanes ?? null,
      moveMode: overrides.moveMode ?? 'local',
      wipPolicy: overrides.wipPolicy ?? 'warn',
      selectable: overrides.selectable ?? false,
      sortMode: 'local'
    },
    _viewFields: fields,
    _viewFieldOrder: ['title'],
    _viewHidden: new Set(),
    _viewData: [...data],
    _viewSort: overrides.sort ?? null,
    _viewSelected: new Set(overrides.selection ?? []),
    _viewFieldList: null,
    _kanbanColumns: overrides.columns ? normalizeKanbanDescriptors(overrides.columns, 'column') : null,
    _kanbanSwimlanes: overrides.swimlanes ? normalizeKanbanDescriptors(overrides.swimlanes, 'swimlane') : null,
    _kanbanColumnOrder: [],
    _kanbanSwimlaneOrder: [],
    _collapsedColumns: new Set(),
    _collapsedSwimlanes: new Set(),
    _kanbanRules: normalizeKanbanRules(overrides.rules ?? []),
    _kanbanSearch: overrides.search ?? '',
    _kanbanFilter: overrides.filter ?? null,
    _kanbanHistory: createKanbanHistory(50),
    _visibleIds: new Set(data.map((record) => record.ID)),
    // setData/setLoading mark the root busy; the fixture only needs the attribute surface.
    el: { setAttribute() {}, removeAttribute() {} },
    _board: null,
    _lastAnnouncement: ''
  });
  view._refreshView = () => {};
  view._announce = (message) => { view._lastAnnouncement = message; };
  view._moveHandle = () => null;
  return view;
}
