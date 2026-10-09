import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  Launcher, findLauncherPage, isLauncherPage, launcherShortcutCaps, orderedLauncherSourceItems,
  rankLauncherItems
} from '../../src/components/launcher/launcher.js';
import { setTranslator } from '../../src/core/i18n.js';

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

/* ------------------------------------------------------------------------------------- pages -- */

const PAGES = [
  { id: 'new', label: 'New task' },
  {
    id: 'agents', label: 'Open agent', items: [
      { id: 'ada', label: 'Ada' },
      { id: 'workflows', label: 'Workflows', items: [{ id: 'deploy', label: 'Deploy', items: [] }] }
    ]
  },
  { id: 'models', label: 'Switch model', items: async () => [] }
];

test('a page is any item whose items are an array or a loader', () => {
  assert.equal(isLauncherPage(PAGES[0]), false);
  assert.equal(isLauncherPage(PAGES[1]), true);
  assert.equal(isLauncherPage(PAGES[2]), true);
  assert.equal(isLauncherPage({ id: 'x', label: 'X', items: 'nope' }), false);
  assert.equal(isLauncherPage(null), false);
});

test('findLauncherPage returns the path from the root to a page, through array pages only', () => {
  assert.deepEqual(findLauncherPage(PAGES, 'agents').map((item) => item.id), ['agents']);
  assert.deepEqual(findLauncherPage(PAGES, 'deploy').map((item) => item.id), ['agents', 'workflows', 'deploy']);
  assert.deepEqual(findLauncherPage(PAGES, 'models').map((item) => item.id), ['models']);
  // Not a page, unknown, or behind a loader the launcher has not run: nothing to open.
  assert.deepEqual(findLauncherPage(PAGES, 'new'), []);
  assert.deepEqual(findLauncherPage(PAGES, 'ada'), []);
  assert.deepEqual(findLauncherPage(PAGES, 'missing'), []);
  assert.deepEqual(findLauncherPage(PAGES, null), []);
  const cyclic = [{ id: 'loop', label: 'Loop', items: [] }];
  cyclic[0].items.push(...cyclic);
  assert.deepEqual(findLauncherPage(cyclic, 'elsewhere'), []);
});

test('shortcut labels normalize to the key caps a row draws', () => {
  assert.deepEqual(launcherShortcutCaps(['⌘', 'K']), ['⌘', 'K']);
  assert.deepEqual(launcherShortcutCaps('N'), ['N']);
  assert.deepEqual(launcherShortcutCaps([' G ', '', null, 'H']), ['G', 'H']);
  assert.deepEqual(launcherShortcutCaps(undefined), []);
  // Button's `{label, keys}` shape draws its label.
  assert.deepEqual(launcherShortcutCaps({ label: ['Ctrl', 'J'], keys: 'Control+J' }), ['Ctrl', 'J']);
  assert.deepEqual(launcherShortcutCaps({ label: '⌘K', keys: 'Meta+K' }), ['⌘K']);
});

/**
 * A Launcher without a DOM: the navigation state machine with its rendering stubbed out, so the
 * stack, the queries it keeps, and the events it reports can be checked in Node.
 * @param {Record<string, any>} [state={}] Overrides.
 * @returns {any}
 */
function pagedLauncher(state = {}) {
  const launcher = Object.create(Launcher.prototype);
  const calls = { render: 0, refresh: [], events: [] };
  Object.assign(launcher, {
    options: { minQuery: 0, debounce: 0, maxResults: 100 },
    refs: { input: { value: '', selectionStart: 0, selectionEnd: 0 } },
    _items: PAGES,
    _sources: [],
    _pages: [],
    _query: '',
    _results: [],
    _active: -1,
    _sourceItems: new Map(),
    _settled: true,
    _request: null,
    _queryTimer: null,
    _requestSequence: 0,
    _busy: false,
    _restoreActiveId: null,
    _announcePending: false,
    _label: 'Commands',
    calls,
    isOpen: () => true,
    // No layout in Node: rows are rows, so the arrows never move spatially.
    _spatialIndex: () => null,
    _syncPage() {},
    _setBusy(busy) { this._busy = busy; },
    _renderResults() { calls.render += 1; },
    _refresh(immediate = false) { calls.refresh.push(immediate); },
    emit(type, detail) {
      calls.events.push([type, detail]);
      return { defaultPrevented: false };
    },
    ...state
  });
  launcher.refs.input.value = launcher._query;
  return launcher;
}

test('opening a page clears the query, keeps the level beneath, and reports the path', () => {
  const launcher = pagedLauncher({
    _query: 'age',
    _results: [{ id: 'agents', label: 'Open agent' }],
    _active: 0,
    _sourceItems: new Map([['records', [{ id: 'r1', label: 'Record' }]]])
  });
  const page = findLauncherPage(PAGES, 'agents')[0];
  launcher._openPage(page);

  assert.equal(launcher.getPage(), page);
  assert.equal(launcher.getQuery(), '');
  assert.equal(launcher.refs.input.value, '');
  assert.deepEqual(launcher._level().items.map((item) => item.id), ['ada', 'workflows']);
  assert.deepEqual(launcher.calls.refresh, [true], 'a page loads at once, not after the debounce');
  assert.deepEqual(launcher.calls.events.at(-1), ['page', { page, path: [page] }]);
  assert.equal(launcher._announcePending, true);
});

test('back restores the query, the highlighted option, and complete results beneath', () => {
  const launcher = pagedLauncher({
    _query: 'age',
    _results: [{ id: 'agents', label: 'Open agent' }],
    _active: 0,
    _sourceItems: new Map([['records', [{ id: 'r1', label: 'Record' }]]])
  });
  launcher._openPage(findLauncherPage(PAGES, 'agents')[0]);
  launcher._sourceItems.set('page', []);
  launcher.back();

  assert.equal(launcher.getPage(), null);
  assert.equal(launcher.getQuery(), 'age');
  assert.equal(launcher.refs.input.value, 'age');
  assert.equal(launcher._restoreActiveId, 'agents');
  assert.deepEqual([...launcher._sourceItems.keys()], ['records']);
  assert.equal(launcher.calls.render, 1, 'complete results come back without a reload');
  assert.deepEqual(launcher.calls.refresh, [true]);
  assert.deepEqual(launcher.calls.events.at(-1), ['page', { page: null, path: [] }]);
  assert.equal(launcher.back(), launcher, 'back on the root is a no-op');
  assert.equal(launcher.calls.events.length, 2);
});

test('back reloads a level whose sources had not finished when the page opened', () => {
  const launcher = pagedLauncher({ _settled: false });
  launcher._openPage(findLauncherPage(PAGES, 'agents')[0]);
  launcher.back();
  assert.deepEqual(launcher.calls.refresh, [true, true]);
  assert.equal(launcher._sourceItems.size, 0);
});

test('pages nest, and going to a path replaces the whole stack', () => {
  const launcher = pagedLauncher();
  launcher._goTo(findLauncherPage(PAGES, 'deploy'));
  assert.deepEqual(launcher._pages.map((entry) => entry.page.id), ['agents', 'workflows', 'deploy']);
  assert.deepEqual(launcher.calls.events.at(-1)[1].path.map((item) => item.id), ['agents', 'workflows', 'deploy']);
  launcher.back();
  assert.equal(launcher.getPage().id, 'workflows');
  launcher._goTo([]);
  assert.equal(launcher.getPage(), null);
  const reported = launcher.calls.events.length;
  launcher._goTo([]);
  assert.equal(launcher.calls.events.length, reported, 'staying on the same level reports nothing');
});

test('open({ page }) resolves an id or takes a page item as given', () => {
  const launcher = pagedLauncher();
  assert.deepEqual(launcher._pagePath('workflows').map((item) => item.id), ['agents', 'workflows']);
  const adHoc = launcher._pagePath({ label: 'Recent', items: [] });
  assert.equal(adHoc.length, 1);
  assert.equal(adHoc[0].id, 'Recent', 'a page item without an id is known by its label');
  assert.deepEqual(launcher._pagePath({ label: 'Not a page' }), []);
  assert.deepEqual(launcher._pagePath('new'), []);
});

test('Backspace and ArrowLeft on an empty query go back; ArrowRight opens a page row', () => {
  const launcher = pagedLauncher();
  /** @param {string} key @param {Record<string, any>} [extra] */
  const press = (key, extra = {}) => {
    let prevented = false;
    launcher._onKeydown({ key, repeat: false, preventDefault: () => { prevented = true; }, ...extra });
    return prevented;
  };

  // The root: nothing to go back to, so Backspace and ArrowLeft keep their editing meaning.
  assert.equal(press('Backspace'), false);
  assert.equal(press('ArrowLeft'), false);

  const agents = findLauncherPage(PAGES, 'agents')[0];
  launcher._results = [{ ...agents }];
  launcher._active = 0;
  assert.equal(press('ArrowRight'), true);
  assert.equal(launcher.getPage().id, 'agents');

  launcher._results = [{ id: 'workflows', label: 'Workflows', items: [] }];
  launcher._active = 0;
  launcher._query = 'wo';
  launcher.refs.input.value = 'wo';
  launcher.refs.input.selectionStart = launcher.refs.input.selectionEnd = 1;
  assert.equal(press('ArrowRight'), false, 'mid-query, ArrowRight moves the caret');
  launcher.refs.input.selectionStart = launcher.refs.input.selectionEnd = 2;
  assert.equal(press('ArrowRight', { shiftKey: true }), false, 'Shift+ArrowRight extends the selection');
  assert.equal(press('ArrowRight'), true, 'at the end of the query, ArrowRight opens the page');
  assert.equal(launcher.getPage().id, 'workflows');

  launcher._results = [];
  assert.equal(press('Backspace', { repeat: true }), false, 'a held Backspace stops at the empty query');
  assert.equal(press('Backspace'), true);
  assert.equal(launcher.getPage().id, 'agents');
  assert.equal(launcher.getQuery(), 'wo', 'the query of the level beneath comes back');

  launcher._query = '';
  assert.equal(press('ArrowLeft'), true);
  assert.equal(launcher.getPage(), null);
});

test('a page loader runs on the empty query, under its own source, without the global minimum', async () => {
  const calls = [];
  const loader = (query, { signal }) => {
    calls.push({ query, aborted: signal.aborted });
    return [{ id: 'ada', label: 'Ada' }, { id: 'lin', label: 'Lin' }];
  };
  const launcher = pagedLauncher({ options: { minQuery: 3, debounce: 0, maxResults: 100 } });
  launcher._pushPage({ id: 'agents', label: 'Agents', items: loader });
  await launcher._loadSources();

  assert.deepEqual(calls, [{ query: '', aborted: false }]);
  const loaded = launcher._sourceItems.get('page:agents');
  assert.deepEqual(loaded.map((item) => item.id), ['ada', 'lin']);
  assert.equal(loaded[0]._source, null, 'page results are not attributed to a root source');
  assert.equal(launcher._settled, true);
});

test('a failing page loader reports its page', async () => {
  const launcher = pagedLauncher();
  const page = { id: 'agents', label: 'Agents', items: () => Promise.reject(new Error('offline')) };
  launcher._pushPage(page);
  await launcher._loadSources();
  const [type, detail] = launcher.calls.events.at(-1);
  assert.equal(type, 'error');
  assert.equal(detail.source.id, 'page:agents');
  assert.equal(detail.page, page);
  assert.equal(detail.error.message, 'offline');
});

test('a page change is announced with where it landed and how many results are there', () => {
  try {
    setTranslator(null);
    const launcher = pagedLauncher();
    launcher._results = Array.from({ length: 7 }, (_, index) => ({ id: index, label: String(index) }));
    assert.equal(launcher._pageStatus(), 'Commands, 7 results');
    launcher._pushPage({ id: 'agents', label: 'Agents', items: [] });
    assert.equal(launcher._pageStatus(), 'Agents, 7 results');
    launcher._results = [{ id: 1, label: 'One' }];
    assert.equal(launcher._pageStatus(), 'Agents, 1 result');
    launcher._results = [];
    assert.equal(launcher._pageStatus(), 'Agents, no results');

    setTranslator((key) => (key === 'launcher.pageResults' ? '%2 Treffer in %1' : null));
    launcher._results = [{ id: 1, label: 'One' }, { id: 2, label: 'Two' }];
    assert.equal(launcher._pageStatus(), '2 Treffer in Agents');
  } finally {
    setTranslator(null);
  }
});

test('page strings keep their English text and reach the host translator', () => {
  const source = readFileSync(new URL('../../src/components/launcher/launcher.js', import.meta.url), 'utf8');
  const messages = [
    ['launcher.back', 'Back to %1'],
    ['launcher.pageLabel', 'Search %1'],
    ['launcher.pagePlaceholder', 'Search'],
    ['launcher.hintBack', 'Back'],
    ['launcher.pageEmpty', '%1, no results'],
    ['launcher.pageResult', '%1, 1 result'],
    ['launcher.pageResults', '%1, %2 results']
  ];
  const probe = Object.assign(Object.create(Launcher.prototype), { options: {} });
  try {
    setTranslator(null);
    for (const [key, english] of messages) {
      assert.ok(source.includes(`'${key}', '${english}'`), `${key} must resolve with its English fallback`);
      assert.equal(probe._message(key, english, 'Agents', 3), english.replace('%1', 'Agents').replace('%2', '3'));
    }
    setTranslator((key) => `de:${key}`);
    for (const [key, english] of messages) assert.equal(probe._message(key, english), `de:${key}`);
  } finally {
    setTranslator(null);
  }
});
