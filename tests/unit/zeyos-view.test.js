import assert from 'node:assert/strict';
import test from 'node:test';

import { buildZeyosViewConfig, zeyosView } from '../../src/zeyos/view.js';

const TICKET_FIELDS = {
  ID: { type: 'integer', indexed: true },
  name: { type: 'text', indexed: true },
  status: { type: 'smallint', enum: { 0: 'Open', 1: 'Closed' } },
  priority: { type: 'smallint', enum: { 0: 'Low', 1: 'High' } },
  preview: { type: 'url' },
  ownergroup: { type: 'integer', fk: 'groups' }
};
const GROUP_FIELDS = { ID: { type: 'integer' }, name: { type: 'text' } };

test('ZeyOS view config shares typed fields and projects hidden grouping/media fields', () => {
  const config = buildZeyosViewConfig(fakeClient(), 'tickets', {
    fields: ['name', 'priority'],
    labels: { name: 'Ticket' },
    status: 'ignored',
    columnBy: 'status',
    swimlaneBy: 'ownergroup',
    preview: 'preview',
    hiddenFields: ['priority'],
    fieldOverrides: { priority: { id: 'replacement-is-ignored', label: 'Urgency', visible: false } }
  });
  assert.deepEqual(config.fields.map(({ id, label }) => ({ id, label })), [
    { id: 'name', label: 'Ticket' },
    { id: 'priority', label: 'Urgency' },
    { id: 'preview', label: 'Preview' },
    { id: 'status', label: 'Status' },
    { id: 'ownergroup', label: 'Ownergroup' }
  ]);
  assert.equal(config.projection.preview, 'preview');
  assert.equal(config.projection.status, 'status');
  assert.equal(config.projection.ownergroup_label, 'ownergroup.name');
  assert.deepEqual(config.fields.filter((field) => field.visible === false).map((field) => field.id),
    ['priority', 'preview', 'status', 'ownergroup']);
  assert.equal(config.viewOptions.sortMode, 'server');
  assert.equal(config.viewOptions.columnBy, 'status');
  assert.deepEqual(config.viewOptions.hiddenFields, ['priority']);
});

test('generic ZeyOS binding pages and reloads on common sortchange events', async () => {
  const client = fakeClient();
  const binding = zeyosView(client, 'tickets', FakeView, {
    fields: ['name', 'priority'], pageSize: 1, filters: { status: 0 }
  });
  const first = await binding.load();
  assert.equal(first.data[0].name, 'Printer');
  assert.equal(binding.hasMore, true);
  await binding.loadMore();
  assert.equal(binding.view.data.length, 2);
  binding.view.emitSort('priority', 'desc');
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(client.calls.at(-1).sort, ['-priority']);
  binding.view.emitSort(null, null);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(Object.prototype.hasOwnProperty.call(client.calls.at(-1), 'sort'), false);
  binding.destroy();
  assert.equal(binding.view.destroyed, true);
});

test('saved default state and query restore before the first server load', async () => {
  const client = fakeClient();
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const registry = new FakeSavedViews([
    {
      id: 'mine', name: 'My queue', type: 'card',
      state: { version: 1, sort: { id: 'priority', dir: 'desc' }, hiddenFields: ['priority'] },
      filters: { priority: 1 }, search: 'printer'
    }
  ], { defaultId: 'mine', gate });
  const binding = zeyosView(client, 'tickets', FakeCardView, {
    fields: ['name', 'priority'], savedViews: { controller: registry }
  });

  const loading = binding.load();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(client.calls.length, 0, 'server query raced saved-view restoration');
  release();
  const result = await loading;

  assert.equal((await binding.ready)?.status, 'applied');
  assert.deepEqual(binding.view.viewState.sort, { id: 'priority', dir: 'desc' });
  assert.deepEqual(result.query.sort, ['-priority']);
  assert.equal(result.query.query, 'printer');
  assert.equal(result.query.filters.priority, 1);
  binding.destroy();
  assert.equal(registry.destroyed, false, 'a supplied registry remains caller-owned');
});

test('saved-view capture/save uses current query and component state', async () => {
  const registry = new FakeSavedViews();
  const binding = zeyosView(fakeClient(), 'tickets', FakeCardView, {
    fields: ['name', 'priority'], filters: { status: 0 }, search: 'keyboard',
    savedViews: { registry, type: 'card' }
  });
  await binding.ready;
  binding.view.setViewState({ version: 1, sort: { id: 'name', dir: 'asc' }, hiddenFields: ['priority'] });

  const capture = binding.captureView({ name: 'Keyboard queue' });
  assert.equal(capture.type, 'card');
  assert.equal(capture.search, 'keyboard');
  assert.deepEqual(capture.filters, { status: 0 });
  assert.deepEqual(capture.state.hiddenFields, ['priority']);

  const saved = await binding.saveView({ name: 'Keyboard queue', setDefault: true });
  assert.equal(saved.name, 'Keyboard queue');
  assert.equal(saved.type, 'card');
  assert.equal(registry.defaultId, saved.id);
  assert.deepEqual(saved.filters, { status: 0 });
  assert.equal(saved.search, 'keyboard');
  binding.destroy();
});

test('presentation mismatch is surfaced without changing query or view state', async () => {
  const client = fakeClient();
  const registry = new FakeSavedViews([{
    id: 'table', name: 'Dense', type: 'table',
    state: { version: 1, sort: { id: 'priority', dir: 'desc' }, hiddenFields: ['name'] },
    filters: { priority: 1 }, search: 'changed'
  }]);
  const binding = zeyosView(client, 'tickets', FakeCardView, {
    fields: ['name', 'priority'], filters: { status: 0 }, search: 'original',
    savedViews: registry
  });
  await binding.ready;
  const before = binding.view.getViewState();
  const result = await binding.applyView('table');

  assert.equal(result.status, 'type-mismatch');
  assert.equal(result.applied, false);
  assert.equal(result.expectedType, 'card');
  assert.deepEqual(binding.view.getViewState(), before);
  assert.equal(client.calls.length, 0, 'a mismatched presentation triggered a reload');
  const captured = binding.captureView({ name: 'Still current' });
  assert.equal(captured.search, 'original');
  assert.deepEqual(captured.filters, { status: 0 });
  binding.destroy();
});

test('a failed initial ready remains observable while later operations retry restoration', async () => {
  const client = fakeClient();
  const registry = new FakeSavedViews();
  let attempts = 0;
  registry.ready = async () => {
    attempts += 1;
    if (attempts === 1) throw new Error('saved storage unavailable');
  };
  const binding = zeyosView(client, 'tickets', FakeCardView, {
    fields: ['name'], savedViews: registry
  });
  await assert.rejects(binding.ready, /storage unavailable/);
  const loaded = await binding.load();
  assert.equal(loaded.data[0].name, 'Printer');
  assert.ok(attempts >= 2);
  binding.destroy();
});

test('applying a compatible named view reloads once and teardown removes binding listeners', async () => {
  const client = fakeClient();
  const registry = new FakeSavedViews([{
    id: 'urgent', name: 'Urgent', type: 'card',
    state: { version: 1, sort: { id: 'priority', dir: 'desc' } },
    filters: { priority: 1 }, search: ''
  }]);
  const binding = zeyosView(client, 'tickets', FakeCardView, {
    fields: ['name', 'priority'], savedViews: registry
  });
  await binding.ready;
  const result = await binding.applyView('urgent');
  assert.equal(result.status, 'applied');
  assert.equal(client.calls.length, 1);
  assert.deepEqual(client.calls[0].sort, ['-priority']);
  binding.destroy();
  binding.view.emitSort('name', 'asc');
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(client.calls.length, 1);
});

test('transport/scope configuration constructs and owns a scoped saved-view registry', async () => {
  const calls = [];
  const transport = {
    load: async (scope) => {
      calls.push(['load', scope]);
      return null;
    },
    save: async (scope, document) => calls.push(['save', scope, document])
  };
  const binding = zeyosView(fakeClient(), 'tickets', FakeCardView, {
    fields: ['name'],
    savedViews: {
      transport,
      scope: { userId: 'user-1', workspaceId: 'fork-4' },
      options: { clock: () => '2026-08-25T12:00:00.000Z', idFactory: () => 'mine' }
    }
  });
  await binding.ready;
  assert.deepEqual(calls[0], ['load', {
    userId: 'user-1', workspaceId: 'fork-4', resource: 'tickets'
  }]);
  const saved = await binding.saveView({ name: 'Mine', setDefault: true });
  assert.equal(saved.id, 'mine');
  assert.equal(calls.filter(([type]) => type === 'save').length, 1);
  assert.equal(calls.find(([type]) => type === 'save')[2].defaultId, 'mine');
  const owned = binding.savedViews;
  binding.destroy();
  await assert.rejects(() => owned.list(), /destroyed/);
});

class FakeView extends EventTarget {
  constructor(_target, options) {
    super();
    this.options = options;
    this.data = [];
    this.destroyed = false;
    this.viewState = { version: 1, sort: options.sort ?? null, fieldOrder: [], hiddenFields: [] };
  }
  on(type, handler) { this.addEventListener(type, handler); return this; }
  setData(records) { this.data = [...records]; return this; }
  addData(records) { this.data.push(...records); return this; }
  setLoading(loading) { this.loading = loading; return this; }
  getViewState() { return structuredClone(this.viewState); }
  setViewState(state) { this.viewState = structuredClone(state); return this; }
  destroy() { this.destroyed = true; }
  emitSort(id, dir) {
    const event = new Event('sortchange');
    Object.defineProperty(event, 'detail', { value: { id, dir } });
    this.dispatchEvent(event);
  }
}

class FakeCardView extends FakeView {
  static cssName = 'card-view';
}

class FakeSavedViews {
  constructor(entries = [], { defaultId = null, gate = Promise.resolve() } = {}) {
    this.entries = entries.map((entry) => structuredClone(entry));
    this.defaultId = defaultId;
    this.gate = gate;
    this.destroyed = false;
    this.sequence = entries.length;
  }
  async ready() { await this.gate; }
  async getDefault() {
    await this.ready();
    return this.entries.find((entry) => entry.id === this.defaultId) ?? null;
  }
  async apply(idOrName, view, { type, onQuery } = {}) {
    await this.ready();
    const entry = this.entries.find((candidate) => candidate.id === idOrName || candidate.name === idOrName) ?? null;
    if (!entry) return { status: 'missing', applied: false, entry: null };
    if (entry.type !== type) {
      return { status: 'type-mismatch', applied: false, entry: structuredClone(entry), expectedType: type };
    }
    view.setViewState(structuredClone(entry.state));
    await onQuery?.({ filters: structuredClone(entry.filters), search: entry.search, entry: structuredClone(entry) });
    return { status: 'applied', applied: true, entry: structuredClone(entry) };
  }
  async capture(view, meta, options = {}) {
    const entry = {
      id: meta.id ?? `saved-${++this.sequence}`,
      name: meta.name,
      type: meta.type,
      state: view.getViewState(),
      filters: structuredClone(meta.filters),
      search: meta.search,
      createdAt: 1,
      updatedAt: 1
    };
    this.entries.push(entry);
    if (options.setDefault) this.defaultId = entry.id;
    return structuredClone(entry);
  }
  async setDefault(id) { this.defaultId = id; }
  destroy() { this.destroyed = true; }
}

function fakeClient() {
  const calls = [];
  const resources = { tickets: TICKET_FIELDS, groups: GROUP_FIELDS };
  return {
    calls,
    schema: {
      describe: (resource) => ({ fields: resources[resource] ?? {} }),
      fields: (resource) => Object.keys(resources[resource] ?? {}),
      operations: () => ['listTickets']
    },
    api: {
      listTickets: async (query) => {
        calls.push(query);
        const records = [
          { ID: 1, name: 'Printer', priority: 1, status: 0, ownergroup: 4, ownergroup_label: 'Support' },
          { ID: 2, name: 'Keyboard', priority: 0, status: 0, ownergroup: 4, ownergroup_label: 'Support' }
        ];
        return { data: records.slice(query.offset, query.offset + query.limit), count: records.length };
      }
    }
  };
}
