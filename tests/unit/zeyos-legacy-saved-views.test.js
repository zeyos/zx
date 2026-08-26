import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createLegacySavedViewTransport, legacySavedViewRequest
} from '../../src/zeyos/legacy-saved-views.js';
import { createSavedViewRegistry } from '../../src/zeyos/saved-views.js';

const scope = { userId: 17, workspaceId: 4, resource: 'tickets' };

test('legacy saved-view transport isolates one namespaced userfields document', async () => {
  const calls = [];
  const request = async (params) => {
    calls.push(params);
    if (params.page === 'fields') {
      return [
        ['Ordinary fields', '__zx_record_views_v1__'],
        ['{"fields":["name"]}', '{"version":1,"defaultId":"mine","views":[]}']
      ];
    }
    return true;
  };
  const transport = createLegacySavedViewTransport(request);

  assert.deepEqual(await transport.load(scope), { version: 1, defaultId: 'mine', views: [] });
  assert.deepEqual(calls[0], {
    umi: '', page: 'fields', fork: 4, view: 'zx.record-views:tickets'
  });

  const document = { version: 1, defaultId: null, views: [{ id: 'all', name: 'All' }] };
  assert.deepEqual(await transport.save(scope, document), document);
  assert.equal(calls[1].page, 'fields_save');
  assert.equal(calls[1].name, '__zx_record_views_v1__');
  assert.deepEqual(JSON.parse(calls[1].data), document);
  assert.equal(Object.prototype.hasOwnProperty.call(calls[1], 'user'), false);

  await transport.remove(scope);
  assert.deepEqual(calls[2], {
    umi: '', page: 'fields_remove', fork: 4, view: 'zx.record-views:tickets',
    name: '__zx_record_views_v1__'
  });
});

test('legacy saved-view transport tolerates absent and corrupt reserved records', async () => {
  const missing = createLegacySavedViewTransport(async () => [['Other'], ['{}']]);
  assert.equal(await missing.load({ ...scope, workspaceId: null }), null);

  const corrupt = createLegacySavedViewTransport(async () => [
    ['__zx_record_views_v1__'], ['not json']
  ]);
  assert.equal(await corrupt.load(scope), null);
});

test('legacy saved-view transport validates scope and JSON data', async () => {
  const transport = createLegacySavedViewTransport(async () => true);
  await assert.rejects(() => transport.load({ workspaceId: 1, resource: 'tickets' }), /userId/);
  await assert.rejects(() => transport.load({ userId: 1, workspaceId: 1 }), /resource/);
  await assert.rejects(() => transport.save(scope, { value: 1n }), /JSON-serializable/);
  await assert.rejects(() => transport.save(scope, { resolver() {} }), /JSON-serializable/);
});

test('legacy saved-view request converts PG.load callbacks into a promise', async () => {
  const success = legacySavedViewRequest((_params, onLoad) => onLoad(['saved']));
  assert.deepEqual(await success({ page: 'fields' }), ['saved']);

  const failure = legacySavedViewRequest((_params, _onLoad, onCatch) => {
    assert.equal(onCatch('Denied', 'permission', { field: 'view' }), true);
  });
  await assert.rejects(failure({ page: 'fields_save' }), (error) => {
    assert.equal(error.message, 'Denied');
    assert.equal(error.type, 'permission');
    assert.deepEqual(error.info, { field: 'view' });
    return true;
  });
});

test('saved-view registry round-trips through the legacy base-workspace transport', async () => {
  let stored = null;
  const request = async (params) => {
    if (params.page === 'fields') {
      return stored == null ? [[], []] : [['__zx_record_views_v1__'], [stored]];
    }
    if (params.page === 'fields_save') stored = params.data;
    if (params.page === 'fields_remove') stored = null;
    return true;
  };
  const transport = createLegacySavedViewTransport(request);
  const baseScope = { userId: '17', workspaceId: null, resource: 'tickets' };
  const first = createSavedViewRegistry(transport, baseScope, {
    clock: () => '2026-08-25T12:00:00.000Z', idFactory: () => 'mine'
  });
  await first.save({
    name: 'My queue', type: 'table',
    state: { version: 1, fieldOrder: ['name'], hiddenFields: [], sort: null },
    filters: { assigneduser: 17 }, search: ''
  }, { setDefault: true });

  const restored = createSavedViewRegistry(transport, baseScope);
  assert.equal((await restored.getDefault()).name, 'My queue');
  assert.equal(JSON.parse(stored).scope.workspaceId, null);
});
