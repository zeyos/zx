import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SAVED_VIEWS_VERSION,
  SavedViewDuplicateNameError,
  SavedViewRegistry,
  SavedViewScopeMismatchError,
  createSavedViewRegistry,
  migrateSavedViewDocument,
  normalizeSavedViewDocument,
  normalizeSavedViewScope
} from '../../src/zeyos/saved-views.js';

const BASE_SCOPE = { userId: 'user-7', workspaceId: null, resource: 'tickets' };

test('scope normalization preserves a nullable base workspace and canonicalizes identifiers', () => {
  assert.deepEqual(normalizeSavedViewScope({
    userId: ' user-7 ', workspaceId: null, resource: ' tickets '
  }), BASE_SCOPE);
  assert.deepEqual(normalizeSavedViewScope({
    userId: 7, workspaceId: 42, resource: 'tickets'
  }), { userId: '7', workspaceId: '42', resource: 'tickets' });
  assert.throws(() => normalizeSavedViewScope({
    userId: 'user-7', resource: 'tickets'
  }), /workspaceId/);
  assert.throws(() => normalizeSavedViewScope({
    userId: '', workspaceId: null, resource: 'tickets'
  }), /userId/);
});

test('save writes one normalized document, supports atomic default, and returns defensive copies', async () => {
  const transport = memoryTransport();
  const registry = createSavedViewRegistry(transport, BASE_SCOPE, deterministicOptions());
  const input = {
    name: '  My   queue  ', type: 'table',
    state: { version: 1, hiddenFields: ['owner'] },
    filters: { status: ['open'] }, search: 'printer'
  };
  const saved = await registry.save(input, { setDefault: true });

  assert.equal(transport.saves.length, 1);
  assert.equal(transport.removes.length, 0);
  assert.equal(saved.id, 'id-my-queue');
  assert.equal(saved.name, 'My queue');
  assert.equal(saved.createdAt, '2026-01-01T00:00:00.000Z');
  assert.equal(saved.updatedAt, saved.createdAt);
  assert.deepEqual(transport.saves[0].scope, BASE_SCOPE);
  assert.equal(transport.saves[0].document.version, SAVED_VIEWS_VERSION);
  assert.deepEqual(transport.saves[0].document.scope, BASE_SCOPE);
  assert.equal(transport.saves[0].document.defaultId, saved.id);

  input.state.hiddenFields.push('status');
  saved.state.hiddenFields.push('priority');
  const confirmed = await registry.getDefault();
  assert.deepEqual(confirmed.state.hiddenFields, ['owner']);
  confirmed.filters.status.push('closed');
  assert.deepEqual((await registry.get(saved.id)).filters, { status: ['open'] });
});

test('list order and default ids are deterministic across normalized documents', async () => {
  const transport = memoryTransport();
  const registry = new SavedViewRegistry(transport, BASE_SCOPE, deterministicOptions());
  await registry.save({ name: 'zulu', type: 'card', state: { version: 1 } });
  await registry.save({ name: 'Alpha', type: 'table', state: { version: 1 } });
  await registry.save({ name: 'alpha 2', type: 'kanban', state: { version: 1 } });
  assert.deepEqual((await registry.list()).map(({ name }) => name), ['Alpha', 'alpha 2', 'zulu']);

  const normalized = normalizeSavedViewDocument(transport.document, BASE_SCOPE);
  assert.deepEqual(normalized, transport.document);
  assert.deepEqual(Object.keys(normalized.views[0].state), ['version']);
});

test('duplicate names reject by default and explicit replace preserves the stable entry identity', async () => {
  const transport = memoryTransport();
  const registry = new SavedViewRegistry(transport, BASE_SCOPE, deterministicOptions());
  const original = await registry.save({
    id: 'queue', name: 'Queue', type: 'table', state: { version: 1, density: 'compact' }
  }, { setDefault: true });

  await assert.rejects(registry.save({
    name: '  queue ', type: 'card', state: { version: 1 }
  }), SavedViewDuplicateNameError);
  assert.equal(transport.saves.length, 1, 'a rejected duplicate reached transport');

  const replaced = await registry.save({
    name: 'QUEUE', type: 'card', state: { version: 1, preview: 'photo' }
  }, { onDuplicate: 'replace' });
  assert.equal(replaced.id, original.id);
  assert.equal(replaced.createdAt, original.createdAt);
  assert.equal((await registry.getDefault()).id, original.id);
  assert.equal((await registry.list()).length, 1);
});

test('replace by id resolves a name collision and transfers a removed default atomically', async () => {
  const transport = memoryTransport();
  const registry = new SavedViewRegistry(transport, BASE_SCOPE, deterministicOptions());
  await registry.save({ id: 'first', name: 'First', type: 'table', state: { version: 1 } });
  await registry.save({ id: 'second', name: 'Second', type: 'card', state: { version: 1 } },
    { setDefault: true });
  const writes = transport.saves.length;

  const saved = await registry.save({ id: 'first', name: 'Second', state: { version: 2 } },
    { onDuplicate: 'replace' });
  assert.equal(transport.saves.length, writes + 1);
  assert.equal(saved.id, 'first');
  assert.deepEqual((await registry.list()).map(({ id }) => id), ['first']);
  assert.equal((await registry.getDefault()).id, 'first');
});

test('rename, default changes, and final removal preserve their explicit mutation semantics', async () => {
  const transport = memoryTransport();
  const registry = new SavedViewRegistry(transport, BASE_SCOPE, deterministicOptions());
  const first = await registry.save({ id: 'first', name: 'First', type: 'table', state: { version: 1 } });
  await registry.save({ id: 'second', name: 'Second', type: 'card', state: { version: 1 } });
  await registry.setDefault(first.id);
  const renamed = await registry.rename(first.id, 'Renamed');
  assert.equal(renamed.id, first.id);
  assert.equal(renamed.createdAt, first.createdAt);
  assert.equal((await registry.getDefault()).name, 'Renamed');

  assert.equal(await registry.remove('Renamed'), true);
  assert.equal(await registry.getDefault(), null);
  assert.equal(await registry.remove('absent'), false);
  assert.equal(await registry.remove('second'), true);
  assert.equal(transport.removes.length, 1);
  assert.deepEqual(await registry.list(), []);
});

test('capture persists only view state and apply is ordered after presentation validation', async () => {
  const transport = memoryTransport();
  const registry = new SavedViewRegistry(transport, BASE_SCOPE, deterministicOptions());
  let dataReads = 0;
  const source = {
    getViewState() { return { version: 1, sort: { id: 'priority', dir: 'desc' } }; },
    getData() { dataReads += 1; return [{ ID: 7 }]; }
  };
  const entry = await registry.capture(source, {
    name: 'Urgent', type: 'kanban', filters: { priority: 'high' }, search: 'late'
  }, { setDefault: true });
  assert.equal(dataReads, 0);
  assert.equal(transport.saves.length, 1);
  assert.equal(transport.document.defaultId, entry.id);

  const calls = [];
  const target = { setViewState(state) { calls.push(['state', state]); } };
  const mismatch = await registry.apply(entry.id, target, {
    type: 'table', onQuery() { calls.push(['query']); }
  });
  assert.deepEqual(mismatch, {
    status: 'type-mismatch', applied: false, entry,
    expectedType: 'kanban', currentType: 'table'
  });
  assert.deepEqual(calls, []);

  const applied = await registry.apply('urgent', target, {
    type: 'kanban', async onQuery(query) { calls.push(['query', query]); }
  });
  assert.equal(applied.status, 'applied');
  assert.equal(applied.applied, true);
  assert.deepEqual(calls.map(([kind]) => kind), ['state', 'query']);
  assert.deepEqual(calls[1][1].filters, { priority: 'high' });
  assert.equal(calls[1][1].search, 'late');
  assert.deepEqual(await registry.apply('missing', target), {
    status: 'missing', applied: false, entry: null
  });
});

test('state and filters reject record/session data and non-JSON or prototype-polluting values', async () => {
  const registry = new SavedViewRegistry(memoryTransport(), BASE_SCOPE, deterministicOptions());
  await assert.rejects(registry.save({
    name: 'unversioned', type: 'table', state: {}
  }), /positive integer version/);
  for (const key of ['records', 'selection', 'page', 'offset', 'cursor', 'pagination']) {
    await assert.rejects(registry.save({
      name: key, type: 'table', state: { version: 1, [key]: [] }
    }), new RegExp(key));
  }
  await assert.rejects(registry.save({
    name: 'function', type: 'table', state: { version: 1, render() {} }
  }), /JSON-safe/);
  await assert.rejects(registry.save({
    name: 'node', type: 'card', state: { version: 1, preview: { nodeType: 1 } }
  }), /DOM nodes/);
  await assert.rejects(registry.save({
    name: 'number', type: 'table', state: { version: 1, width: Infinity }
  }), /non-finite/);
  await assert.rejects(registry.save({
    name: 'symbol value', type: 'table', state: { version: 1, field: Symbol('field') }
  }), /JSON-safe/);
  const symbolKeyState = { version: 1, [Symbol('draft')]: true };
  await assert.rejects(registry.save({
    name: 'symbol key', type: 'table', state: symbolKeyState
  }), /symbols/);
  await assert.rejects(registry.save({
    name: 'search symbol', type: 'table', state: { version: 1 }, search: Symbol('query')
  }), /search must be a string/);
  const cyclic = { version: 1 };
  cyclic.self = cyclic;
  await assert.rejects(registry.save({
    name: 'cycle', type: 'kanban', state: cyclic
  }), /cycles/);

  const pollutedState = JSON.parse('{"version":1,"nested":{"__proto__":{"polluted":true}}}');
  await assert.rejects(registry.save({
    name: 'pollution', type: 'table', state: pollutedState
  }), /prototype-pollution/);
  const pollutedFilters = JSON.parse('{"constructor":{"prototype":{"polluted":true}}}');
  await assert.rejects(registry.save({
    name: 'filters', type: 'table', state: { version: 1 }, filters: pollutedFilters
  }), /prototype-pollution/);
  assert.equal({}.polluted, undefined);
});

test('version-zero values migrate and corrupt duplicate entries normalize deterministically', () => {
  const migrated = normalizeSavedViewDocument({
    entries: [{
      label: 'Legacy', presentation: 'card', viewState: { version: 1 },
      filter: { status: 'open' }, query: 'printer'
    }],
    defaultView: 'missing-id'
  }, BASE_SCOPE);
  assert.equal(migrated.version, 1);
  assert.equal(migrated.views[0].name, 'Legacy');
  assert.equal(migrated.views[0].type, 'card');
  assert.deepEqual(migrated.views[0].filters, { status: 'open' });
  assert.equal(migrated.defaultId, null);

  const duplicate = normalizeSavedViewDocument({
    version: 1, scope: BASE_SCOPE, defaultId: 'old', views: [
      persistedEntry('old', 'Queue', '2026-01-01T00:00:00.000Z'),
      persistedEntry('new', 'queue', '2026-02-01T00:00:00.000Z')
    ]
  }, BASE_SCOPE);
  assert.deepEqual(duplicate.views.map(({ id }) => id), ['new']);
  assert.equal(duplicate.defaultId, 'new');
  assert.throws(() => migrateSavedViewDocument({ version: 99, views: [] }), /Unsupported/);
});

test('cross-scope documents reject, including null versus the literal string null', () => {
  const value = {
    version: 1,
    scope: { ...BASE_SCOPE, workspaceId: 'null' },
    defaultId: null,
    views: []
  };
  assert.throws(() => normalizeSavedViewDocument(value, BASE_SCOPE), SavedViewScopeMismatchError);
});

test('mutations serialize, a failed write preserves confirmed state, and the queue recovers', async () => {
  const transport = memoryTransport({ delaySaves: true });
  const registry = new SavedViewRegistry(transport, BASE_SCOPE, deterministicOptions());
  await registry.ready();
  const first = registry.save({ id: 'first', name: 'First', type: 'table', state: { version: 1 } });
  await transport.waitForSave();
  const second = registry.save({ id: 'second', name: 'Second', type: 'card', state: { version: 1 } });
  await Promise.resolve();
  assert.equal(transport.activeSaves, 1);
  assert.equal(transport.saves.length, 0);
  transport.releaseSave();
  await first;
  await transport.waitForSave();
  assert.equal(transport.activeSaves, 1);
  transport.releaseSave();
  await second;
  assert.equal(transport.maxActiveSaves, 1);
  assert.deepEqual((await registry.list()).map(({ id }) => id), ['first', 'second']);

  transport.failNextSave = true;
  const failed = registry.rename('first', 'Failed rename');
  await transport.waitForSave();
  transport.releaseSave();
  await assert.rejects(failed, /save failed/);
  assert.equal((await registry.get('first')).name, 'First');
  const recovering = registry.rename('first', 'Recovered');
  await transport.waitForSave();
  transport.releaseSave();
  const recovered = await recovering;
  assert.equal(recovered.name, 'Recovered');
});

test('only the latest force load commits and stale malformed results are ignored', async () => {
  const initial = currentDocument([persistedEntry('initial', 'Initial')]);
  const transport = queuedLoadTransport(initial);
  const registry = new SavedViewRegistry(transport, BASE_SCOPE);
  await registry.ready();

  const older = registry.load({ force: true });
  const newer = registry.load({ force: true });
  transport.loads[2].resolve(currentDocument([persistedEntry('new', 'New')]));
  await newer;
  transport.loads[1].resolve({ version: 1, scope: { workspaceId: 'wrong' } });
  await older;
  assert.deepEqual((await registry.list()).map(({ id }) => id), ['new']);

  const failed = registry.load({ force: true });
  transport.loads[3].reject(new Error('refresh failed'));
  await assert.rejects(failed, /refresh failed/);
  assert.deepEqual((await registry.list()).map(({ id }) => id), ['new']);
});

test('destroy prevents pending load and save confirmations from changing local state', async () => {
  const loadTransport = queuedLoadTransport(currentDocument([persistedEntry('old', 'Old')]));
  const loadingRegistry = new SavedViewRegistry(loadTransport, BASE_SCOPE);
  await loadingRegistry.ready();
  const refresh = loadingRegistry.load({ force: true });
  loadingRegistry.destroy();
  loadTransport.loads[1].resolve(currentDocument([persistedEntry('new', 'New')]));
  await assert.rejects(refresh, /destroyed/);
  assert.equal(loadingRegistry._document.views[0].id, 'old');

  const saveTransport = memoryTransport({ delaySaves: true });
  const savingRegistry = new SavedViewRegistry(saveTransport, BASE_SCOPE, deterministicOptions());
  await savingRegistry.ready();
  const saving = savingRegistry.save({
    id: 'late', name: 'Late', type: 'table', state: { version: 1 }
  });
  await saveTransport.waitForSave();
  savingRegistry.destroy();
  saveTransport.releaseSave();
  await assert.rejects(saving, /destroyed/);
  assert.deepEqual(savingRegistry._document.views, []);
});

function deterministicOptions() {
  let tick = 0;
  return {
    clock: () => new Date(Date.UTC(2026, 0, 1, 0, 0, tick++)),
    idFactory: ({ name }) => `id-${name.toLowerCase().replace(/\s+/g, '-')}`
  };
}

function persistedEntry(id, name, updatedAt = '2026-01-01T00:00:00.000Z') {
  return {
    id, name, type: 'table', state: { version: 1 }, filters: {}, search: '',
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt
  };
}

function currentDocument(views = []) {
  return { version: 1, scope: BASE_SCOPE, defaultId: null, views };
}

function clone(value) {
  return structuredClone(value);
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function memoryTransport({ delaySaves = false } = {}) {
  const gates = [];
  const waiters = [];
  return {
    document: null,
    saves: [],
    removes: [],
    activeSaves: 0,
    maxActiveSaves: 0,
    failNextSave: false,
    load(scope) { this.loadedScope = clone(scope); return clone(this.document); },
    async save(scope, document) {
      this.activeSaves += 1;
      this.maxActiveSaves = Math.max(this.maxActiveSaves, this.activeSaves);
      if (delaySaves) {
        const gate = deferred();
        gates.push(gate);
        waiters.splice(0).forEach((resolve) => resolve());
        await gate.promise;
      }
      try {
        if (this.failNextSave) {
          this.failNextSave = false;
          throw new Error('save failed');
        }
        this.document = clone(document);
        this.saves.push({ scope: clone(scope), document: clone(document) });
      } finally {
        this.activeSaves -= 1;
      }
    },
    remove(scope) {
      this.document = null;
      this.removes.push(clone(scope));
    },
    async waitForSave() {
      if (gates.length > 0 && this.activeSaves > 0) return;
      await new Promise((resolve) => waiters.push(resolve));
    },
    releaseSave() {
      const gate = gates.shift();
      if (!gate) throw new Error('No pending save');
      gate.resolve();
    }
  };
}

function queuedLoadTransport(initial) {
  const loads = [];
  return {
    loads,
    load() {
      if (loads.length === 0) {
        loads.push({ resolve() {}, reject() {} });
        return clone(initial);
      }
      const request = deferred();
      loads.push(request);
      return request.promise;
    },
    save() {}
  };
}
