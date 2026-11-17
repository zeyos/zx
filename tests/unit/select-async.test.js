import assert from 'node:assert/strict';
import test from 'node:test';

import { Select } from '../../src/components/select/select.js';

/*
 * An async `filter` receives `{signal}` as its second argument, as Filter's loadChoices does, and
 * the signal aborts once the answer would be ignored: a newer query, closing, destroying. Stale
 * results stay ignored whether or not the request honoured the signal. Prototype probes stand in
 * for the rendered list; tests/regression/followup-api.js drives close() and destroy() in a browser.
 */

/** A filter whose answers the test settles by hand. */
function deferredFilter() {
  const calls = [];
  const filter = (query, context) => new Promise((resolve, reject) => {
    calls.push({ query, signal: context?.signal, resolve, reject });
  });
  return { calls, filter };
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

function selectProbe(filter) {
  const select = Object.create(Select.prototype);
  select.options = { ...Select.defaults, filter, debounce: 0, minQuery: 0 };
  select._open = true;
  select._items = [];
  select._visibleItems = [];
  select._optionEntries = [];
  select._requestSequence = 0;
  select._queryTimer = null;
  select._queryController = null;
  select._position = null;
  select._matchFixed = () => [];
  select._setLoading = () => {};
  select._renderOptions = () => {};
  select._setActive = () => {};
  select.emitted = [];
  select.emit = (type, detail) => { select.emitted.push([type, detail]); };
  return select;
}

test('Select hands its async filter an AbortSignal that a newer query aborts', async () => {
  const { calls, filter } = deferredFilter();
  const select = selectProbe(filter);
  select._scheduleAsyncQuery('a');
  await tick();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].query, 'a');
  assert.ok(calls[0].signal instanceof AbortSignal, 'the second argument carries a signal');
  assert.equal(calls[0].signal.aborted, false);

  select._scheduleAsyncQuery('ab');
  assert.equal(calls[0].signal.aborted, true, 'typing on aborts the request in flight');
  await tick();
  assert.equal(calls.length, 2);
  assert.equal(calls[1].signal.aborted, false);

  // The superseded answer arrives anyway and is still ignored.
  calls[0].resolve([{ ID: 1, name: 'Stale' }]);
  await tick();
  assert.deepEqual(select._items, []);
  calls[1].resolve([{ ID: 2, name: 'Fresh' }]);
  await tick();
  assert.deepEqual(select._items, [{ ID: 2, name: 'Fresh' }]);
  assert.equal(select._queryController, null, 'a settled request leaves nothing to abort');
  assert.equal(calls[1].signal.aborted, false, 'a settled request is not aborted afterwards');
});

test('Select aborts the request in flight when it cancels the query (close, disable, destroy)', async () => {
  const { calls, filter } = deferredFilter();
  const select = selectProbe(filter);
  select._scheduleAsyncQuery('q');
  await tick();
  select._cancelQuery();
  assert.equal(calls[0].signal.aborted, true);
  // An abort usually ends in a rejection; it changes nothing.
  calls[0].reject(new DOMException('Aborted', 'AbortError'));
  await tick();
  assert.deepEqual(select._items, []);
  assert.deepEqual(select.emitted.map(([type]) => type), ['query']);
});

test('Select cancelling during the debounce never calls the filter', async () => {
  const { calls, filter } = deferredFilter();
  const select = selectProbe(filter);
  select.options = { ...select.options, debounce: 20 };
  select._scheduleAsyncQuery('q');
  select._cancelQuery();
  await new Promise((resolve) => setTimeout(resolve, 40));
  assert.equal(calls.length, 0);
});

test('a query listener that closes the Select keeps the filter from starting', async () => {
  const { calls, filter } = deferredFilter();
  const select = selectProbe(filter);
  select.emit = (type) => { if (type === 'query') select._cancelQuery(); };
  select._scheduleAsyncQuery('a');
  await tick();
  assert.equal(calls.length, 0, 'the filter ran for a query its listener had cancelled');
  assert.equal(select._queryController, null);
});

test('an abort listener that starts another query supersedes the one being scheduled', async () => {
  const { calls, filter } = deferredFilter();
  const select = selectProbe(filter);
  select._scheduleAsyncQuery('a');
  await tick();
  // Cancelling A makes the application start C from its abort listener, while B is being scheduled.
  calls[0].signal.addEventListener('abort', () => select._scheduleAsyncQuery('c'), { once: true });
  select._scheduleAsyncQuery('b');
  await tick();
  assert.deepEqual(calls.map((call) => call.query), ['a', 'c'], 'B was superseded by C and never ran');
  calls[1].resolve([{ ID: 3, name: 'C' }]);
  await tick();
  assert.deepEqual(select._items.map((item) => item.ID), [3]);
});
