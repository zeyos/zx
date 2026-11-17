import assert from 'node:assert/strict';
import test from 'node:test';

import { createServerPager, DEFAULT_SERVER_PAGE_SIZE } from '../../src/zeyos/table.js';

/*
 * `createServerPager` is the one loader behind `zeyosTable()` and `zeyosView()`. It is exercised
 * here without a DOM: the facade and the render target are recorded stand-ins.
 */

test('the pager requests limit/offset pages, replaces page zero, and appends later pages', async () => {
  const { pager, target, calls } = setup({ pageSize: 2 });
  const first = await pager.load();
  assert.deepEqual([calls[0].limit, calls[0].offset, calls[0].count], [2, 0, true]);
  assert.deepEqual(target.log, ['loading:true', 'set:2', 'loading:false']);
  assert.equal(first.hasMore, true);
  await pager.loadMore();
  assert.deepEqual([calls[1].limit, calls[1].offset], [2, 2]);
  assert.equal(target.log.at(-2), 'add:2');
  assert.equal(pager.page, 1);
});

test('replace and pageSize let a one-based numbered pager drive the zero-based binding', async () => {
  const { pager, target, calls } = setup({ pageSize: 50 });
  // Pagination change {page: 3, pageSize: 2} → offset (3 - 1) * 2 = 4.
  const result = await pager.load({ page: 3 - 1, pageSize: 2, replace: true });
  assert.deepEqual([calls[0].limit, calls[0].offset], [2, 4]);
  assert.equal(target.log.at(-2), 'set:2', 'a replace load swaps the rows instead of appending');
  assert.equal(pager.pageSize, 2, 'the new size sticks for later loads');
  assert.equal(result.count, 10);
});

test('a response that arrives after destroy() never reaches the target', async () => {
  const gate = deferred();
  const { pager, target } = setup({ list: () => gate.promise });
  const pending = pager.load();
  pager.destroy();
  gate.resolve({ data: [{ ID: 1 }], count: 1 });
  const result = await pending;
  assert.equal(result.data.length, 1, 'the caller still gets its data');
  assert.deepEqual(target.log, ['loading:true'], 'but nothing was rendered, not even loading:false');
  await assert.rejects(() => pager.load(), /destroyed/);
  await assert.rejects(() => pager.loadMore(), /destroyed/);
});

test('only the newest of two overlapping requests renders', async () => {
  const gates = [deferred(), deferred()];
  let index = 0;
  const { pager, target } = setup({ list: () => gates[index++].promise });
  const older = pager.load({ search: 'a' });
  const newer = pager.load({ search: 'ab' });
  gates[1].resolve({ data: [{ ID: 2 }], count: 1 });
  await newer;
  gates[0].resolve({ data: [{ ID: 1 }, { ID: 3 }], count: 2 });
  await older;
  assert.deepEqual(target.log.filter((entry) => entry.startsWith('set')), ['set:1']);
});

test('validation is strict and identical for both bindings', async () => {
  assert.throws(() => setup({ pageSize: 0 }), RangeError);
  assert.throws(() => setup({ pageSize: 2.5 }), RangeError);
  assert.throws(() => setup({ filters: [] }), TypeError);
  const { pager } = setup();
  assert.equal(pager.pageSize, DEFAULT_SERVER_PAGE_SIZE);
  assert.equal(DEFAULT_SERVER_PAGE_SIZE, 50);
  await assert.rejects(() => pager.load({ page: -1 }), RangeError);
  await assert.rejects(() => pager.load({ page: 1.5 }), RangeError);
  await assert.rejects(() => pager.load({ filters: 'status=1' }), TypeError);
});

test('sort and query replacements feed the next request', async () => {
  const { pager, calls } = setup();
  pager.setSort({ id: 'name', dir: 'desc' });
  pager.setQuery({ filters: { status: 1 }, search: 'printer' });
  await pager.load();
  assert.deepEqual(calls[0].sort, ['-name']);
  assert.equal(calls[0].query, 'printer');
  assert.equal(calls[0].filters.status, 1);
  assert.deepEqual(pager.filters, { status: 1 });
  pager.filters.status = 2;
  assert.equal(pager.filters.status, 1, 'filters are handed out as a copy');
});

/** @param {Record<string, any>} [overrides={}] */
function setup(overrides = {}) {
  const calls = [];
  const rows = Array.from({ length: 10 }, (_, index) => ({ ID: index + 1 }));
  const list = overrides.list ?? (async (_resource, query) => ({
    data: rows.slice(query.offset, query.offset + query.limit), count: rows.length
  }));
  const target = {
    log: [],
    setData(data) { this.log.push(`set:${data.length}`); },
    addData(data) { this.log.push(`add:${data.length}`); },
    setLoading(loading) { this.log.push(`loading:${loading}`); }
  };
  const pager = createServerPager({
    client: {},
    facade: { list: (resource, query) => { calls.push(query); return list(resource, query); } },
    resource: 'tickets',
    projection: { ID: 'ID' },
    target,
    pageSize: overrides.pageSize,
    filters: overrides.filters,
    label: 'Test'
  });
  return { pager, target, calls };
}

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

test('a rejected load changes nothing: every argument is checked before any is applied', async () => {
  const { pager, calls } = setup({ pageSize: 10 });
  await pager.load({ search: 'printer', filters: { status: 1 } });
  await assert.rejects(() => pager.load({ pageSize: 25, search: 'other', filters: 'x' }), TypeError);
  await assert.rejects(() => pager.load({ pageSize: 25, filters: { status: 2 }, page: -1 }), RangeError);
  await assert.rejects(() => pager.load({ search: 'other', pageSize: 0 }), RangeError);
  assert.equal(pager.pageSize, 10);
  assert.equal(pager.search, 'printer');
  assert.deepEqual(pager.filters, { status: 1 });
  assert.equal(calls.length, 1, 'no request was sent for a rejected call');
  assert.throws(() => pager.setQuery({ search: 'other', filters: [] }), TypeError);
  assert.equal(pager.search, 'printer', 'setQuery() is all-or-nothing as well');
});

test('loadMore() sends nothing while a page-zero reload is in flight', async () => {
  // Infinite scroll: page 1 of the old filter is on screen when setFilters() starts a page-zero
  // reload. A loadMore() fired meanwhile must not append the new filter's page 2 onto the old rows.
  let gate = null;
  const rows = Array.from({ length: 10 }, (_, index) => ({ ID: index + 1 }));
  const { pager, target, calls } = setup({
    pageSize: 2,
    list: (_resource, query) => {
      const response = { data: rows.slice(query.offset, query.offset + query.limit), count: rows.length };
      if (!gate) return Promise.resolve(response);
      return gate.promise.then(() => response);
    }
  });
  await pager.load();
  await pager.loadMore();
  assert.equal(pager.page, 1);
  gate = deferred();
  const reload = pager.load({ filters: { status: 1 }, page: 0 });
  const more = await pager.loadMore();
  assert.equal(calls.length, 3, 'loadMore() sent no request during the reload');
  assert.equal(more.data.length, 0);
  gate.resolve();
  await reload;
  assert.equal(target.log.filter((entry) => entry.startsWith('add')).length, 1, 'only the first loadMore appended');
  assert.equal(target.log.at(-2), 'set:2', 'the reload rendered page zero of the new filter');
  assert.equal(pager.page, 0);
  gate = null;
  await pager.loadMore();
  assert.deepEqual([calls.at(-1).offset, calls.at(-1).filters.status], [2, 1], 'loadMore() works again afterwards');
});

test('reset() retires requests in flight and clears the loading state', async () => {
  const gate = deferred();
  const { pager, target } = setup({ list: () => gate.promise });
  const pending = pager.load({ search: 'old' });
  pager.setQuery({ search: 'new' });
  pager.reset();
  assert.deepEqual(target.log, ['loading:true', 'loading:false'], 'reset() settled the loading state');
  gate.resolve({ data: [{ ID: 1 }, { ID: 2 }], count: 9 });
  const result = await pending;
  assert.equal(result.data.length, 2, 'the caller still gets its data');
  assert.deepEqual(target.log, ['loading:true', 'loading:false'], 'the stale response rendered nothing');
  assert.equal(pager.count, null);
  assert.equal(pager.hasMore, false);
  assert.equal(pager.search, 'new');
});

test('hasMore is computed with the page size each request was sent with', async () => {
  const gates = [deferred(), deferred()];
  let index = 0;
  const { pager } = setup({ list: () => gates[index++].promise });
  const older = pager.load({ pageSize: 2 });
  const newer = pager.load({ pageSize: 5 });
  // No count in the response: a full page of the size that was asked for means "more".
  gates[0].resolve({ data: [{ ID: 1 }, { ID: 2 }] });
  assert.equal((await older).hasMore, true);
  gates[1].resolve({ data: [{ ID: 1 }, { ID: 2 }, { ID: 3 }], count: 3 });
  assert.equal((await newer).hasMore, false);
  assert.equal(pager.pageSize, 5);
});
