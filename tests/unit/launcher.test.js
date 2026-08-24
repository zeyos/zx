import assert from 'node:assert/strict';
import test from 'node:test';

import {
  Launcher, orderedLauncherSourceItems, rankLauncherItems
} from '../../src/components/launcher/launcher.js';

const items = [
  { id: 'crm', label: 'Customer Relations', keywords: ['accounts'] },
  { id: 'invoice', label: 'Invoices' },
  { id: 'reports', label: 'Überblick Reports' },
  { id: 'settings', label: 'System Settings' }
];

test('launcher ranking follows exact, prefix, word, substring, identifier, and acronym tiers', () => {
  assert.equal(rankLauncherItems(items, 'invoices')[0]._score, 0);
  assert.equal(rankLauncherItems(items, 'inv')[0]._score, 10);
  assert.equal(rankLauncherItems(items, 'rel')[0]._score, 20);
  assert.equal(rankLauncherItems(items, 'count')[0]._score, 30);
  assert.equal(rankLauncherItems(items, 'crm')[0]._score, 40);
  assert.equal(rankLauncherItems(items, 'ss')[0]._score, 50);
});

test('launcher matching is case- and diacritic-insensitive', () => {
  assert.equal(rankLauncherItems(items, 'UBERBLICK')[0].id, 'reports');
});

test('empty launcher query puts explicitly ordered pins first then alphabetizes', () => {
  const ranked = rankLauncherItems([
    { id: 'z', label: 'Zulu' },
    { id: 'b', label: 'Beta', pinned: 1 },
    { id: 'a', label: 'Alpha', pinned: 0 },
    { id: 'g', label: 'Gamma' }
  ], '');
  assert.deepEqual(ranked.map((item) => item.id), ['a', 'b', 'g', 'z']);
});

test('launcher ranking honors its maximum and does not mutate caller items', () => {
  const input = items.map((item) => ({ ...item }));
  assert.equal(rankLauncherItems(input, '', 2).length, 2);
  assert.deepEqual(input, items);
});

test('launcher ranking uses locale-independent tie ordering', () => {
  const ranked = rankLauncherItems([
    { id: 'z', label: 'z' },
    { id: 'a-umlaut', label: 'ä' }
  ], '');
  assert.deepEqual(ranked.map((item) => item.id), ['a-umlaut', 'z']);
});

test('launcher aborts an older source request and cannot publish its stale result', async () => {
  const signals = [];
  const launcher = Object.create(Launcher.prototype);
  Object.assign(launcher, {
    _queryTimer: null,
    _query: 'old',
    _sources: [{
      id: 'records',
      load(query, { signal }) {
        signals.push(signal);
        return new Promise((resolve, reject) => {
          const timer = setTimeout(() => resolve([{ id: query, label: query }]), query === 'old' ? 30 : 0);
          signal.addEventListener('abort', () => {
            clearTimeout(timer);
            reject(new DOMException('Aborted', 'AbortError'));
          }, { once: true });
        });
      }
    }],
    _sourceItems: new Map(),
    _request: null,
    _requestSequence: 0,
    _busy: false,
    options: { minQuery: 0 },
    _setBusy(busy) { this._busy = busy; },
    _renderResults() {},
    emit() {}
  });

  const oldRequest = launcher._loadSources();
  await Promise.resolve();
  launcher._abortRequest();
  launcher._query = 'current';
  const currentRequest = launcher._loadSources();
  await Promise.all([oldRequest, currentRequest]);

  assert.equal(signals[0].aborted, true);
  assert.equal(signals[1].aborted, false);
  assert.deepEqual([...launcher._sourceItems.values()].flat().map((item) => item.id), ['current']);
});

test('launcher source results retain configured order regardless of completion insertion order', () => {
  const sources = [{ id: 'first' }, { id: 'second' }];
  const completedSecondFirst = new Map([
    ['second', [{ id: 'second-result', label: 'Same' }]],
    ['first', [{ id: 'first-result', label: 'Same' }]]
  ]);
  const completedFirstSecond = new Map([...completedSecondFirst].reverse());
  const ids = (loaded) => orderedLauncherSourceItems(sources, loaded).map((item) => item.id);
  assert.deepEqual(ids(completedSecondFirst), ['first-result', 'second-result']);
  assert.deepEqual(ids(completedFirstSecond), ['first-result', 'second-result']);
});
