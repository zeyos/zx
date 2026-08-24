import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ZEYOS_LAUNCHER_APPLICATIONS,
  buildZeyosLauncherConfig,
  normalizeZeyosLauncherApplications,
  normalizeZeyosLauncherRecords,
  zeyosActiveIdentifier
} from '../../src/zeyos/launcher.js';
import { moduleInfo } from '../../src/zeyos/modules.js';

const modules = Object.fromEntries(ZEYOS_LAUNCHER_APPLICATIONS.map((id) => [id, moduleInfo(id).label]));

test('every prototype application has a direct module identity and launcher icon factory', () => {
  assert.equal(ZEYOS_LAUNCHER_APPLICATIONS.length, 29);
  const apps = normalizeZeyosLauncherApplications({
    modules,
    resolveApplication: (app) => ({ href: `#${app[0]}` })
  }, { standardIcons: true });
  assert.deepEqual(apps.map((app) => app.id).sort(), [...ZEYOS_LAUNCHER_APPLICATIONS].sort());
  for (const app of apps) {
    assert.equal(typeof app.icon, 'function', `${app.id} has no icon factory`);
    assert.match(moduleInfo(app._zeyos.module).color, /^#[\da-f]{6}$/i);
    assert.equal(app.disabled, false);
  }
});

test('menu applications win dedupe while permissions, pins, and current state remain explicit', () => {
  const apps = normalizeZeyosLauncherApplications({
    menuApps: [['accounts', 'Customer accounts'], ['42', 'North fork', 'projects', 'ff8800']],
    modules: { accounts: 'Accounts', billing: 'Billing', admin: 'Admin' },
    pinned: ['billing', 'accounts'],
    activeIdentifier: 'fork#42',
    canUseModule: (id) => id !== 'admin',
    resolveApplication: () => ({ href: '#app' })
  });
  assert.equal(apps.filter((app) => app.id === 'accounts').length, 1);
  assert.equal(apps.find((app) => app.id === 'accounts').label, 'Customer accounts');
  assert.equal(apps.find((app) => app.id === 'billing').pinned, 0);
  assert.equal(apps.find((app) => app.id === 'accounts').pinned, 1);
  assert.equal(apps.find((app) => app.id === 'fork#42').current, true);
  assert.equal(apps.some((app) => app.id === 'admin'), false);
  assert.equal(apps.find((app) => app.id === 'fork#42')._zeyos.color, '#ff8800');
});

test('recent and grouped search records preserve order and collision-safe identities', () => {
  const recent = normalizeZeyosLauncherRecords([
    { entity: 'accounts', ID: 7, fork: null, name: 'Acme', sec: 'Berlin' },
    { entity: 'contacts', ID: 7, fork: 2, name: 'Ada', sec: 'Acme' }
  ], { resolveRecord: () => ({ href: '#record' }) });
  assert.deepEqual(recent.map((item) => item.when), ['empty', 'empty']);
  assert.equal(new Set(recent.map((item) => item.id)).size, 2);

  const search = normalizeZeyosLauncherRecords({
    '': [[7, null, 'Top account', 'Berlin', 'accounts']],
    contacts: [[7, 2, 'Ada Lovelace', 'Acme']]
  }, {
    query: 'a',
    labels: { results: 'Top results', entities: { contacts: 'People' } },
    resolveRecord: () => ({ href: '#record' })
  });
  assert.deepEqual(search.map((item) => item.label), ['Top account', 'Ada Lovelace']);
  assert.deepEqual(search.map((item) => item.group), ['Top results', 'People']);
  assert.deepEqual(search.map((item) => item.itemOrder), [0, 1]);
});

test('ZeyOS launcher config keeps routing injected and forwards abortable search', async () => {
  let forwarded;
  const config = buildZeyosLauncherConfig({
    modules: { billing: 'Billing' },
    recent: [['accounts', 1, null, 'Acme', 'Berlin']],
    activeIdentifier: 'billing',
    resolveApplication: () => ({ href: '#billing' }),
    resolveRecord: () => ({ invoke() {} }),
    search(query, context) {
      forwarded = { query, signal: context.signal };
      return [{ group: '', entity: 'accounts', ID: 2, name: 'Alpine' }];
    }
  });
  assert.equal(config.items[0].current, true);
  assert.equal(config.items[1].when, 'empty');
  const controller = new AbortController();
  const records = await config.sources[0].load('alp', { signal: controller.signal });
  assert.equal(forwarded.query, 'alp');
  assert.equal(forwarded.signal, controller.signal);
  assert.equal(records[0].when, 'query');
  assert.equal(config.sources[0].order, 'source');
});

test('active identifier distinguishes modules, forks, and weblets', () => {
  assert.equal(zeyosActiveIdentifier({ module: 'billing' }), 'billing');
  assert.equal(zeyosActiveIdentifier({ module: 'projects', fork: 42 }), 'fork#42');
  assert.equal(zeyosActiveIdentifier({ module: 'main', weblet: 'clock' }), 'weblet#clock');
});
