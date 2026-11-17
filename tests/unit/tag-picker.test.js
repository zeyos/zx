import assert from 'node:assert/strict';
import test from 'node:test';

import { TagPicker } from '../../src/components/tag-picker/tag-picker.js';

test('TagPicker publishes native icon/color readers without preempting custom renderers', () => {
  assert.equal(TagPicker.defaults.iconKey, 'icon');
  assert.equal(TagPicker.defaults.colorKey, 'color');
  assert.equal(TagPicker.defaults.renderItem, null);
  assert.equal(TagPicker.defaults.renderTag, null);
});

test('TagPicker reads a categorical tone per item, beside its colour', () => {
  assert.equal(TagPicker.defaults.toneKey, 'tone');
  // Without a DOM the readers are exercised on a bare receiver: the same calls the tags make.
  const picker = { options: { ...TagPicker.defaults }, _readItem: TagPicker.prototype._readItem };
  const toneOf = (item) => TagPicker.prototype._toneOf.call(picker, item);
  const colorOf = (item) => TagPicker.prototype._colorOf.call(picker, item);
  assert.equal(toneOf({ tone: 'violet' }), 'violet');
  assert.equal(toneOf({ tone: 'warning' }), null, 'a status kind is not a categorical tone');
  assert.equal(toneOf({ name: 'No tone' }), null);
  assert.equal(colorOf({ color: 'var(--zx-color-tone-teal-fg)' }), 'var(--zx-color-tone-teal-fg)');
  assert.equal(colorOf({ color: '#d97706' }), '#d97706');
  assert.equal(colorOf({ color: 'var(--zx-color-tone-teal-fg, red)' }), null);
});

/*
 * An async `filter` receives `{signal}` as its second argument; the signal aborts once the answer
 * would be ignored (a newer query, close(), setItems(), destroy()). Stale results stay ignored
 * whether or not the request honoured it. A prototype probe stands in for the rendered list;
 * tests/regression/followup-api.js drives close() and destroy() in a browser.
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

function pickerProbe(filter) {
  const picker = Object.create(TagPicker.prototype);
  picker.options = { ...TagPicker.defaults, filter, debounce: 0, minQuery: 0 };
  picker.el = { toggleAttribute() {} };
  picker._open = true;
  picker._items = [];
  picker._visible = [];
  picker._entries = [];
  picker._requestSequence = 0;
  picker._queryTimer = null;
  picker._queryController = null;
  picker._position = null;
  picker._renderOptions = () => {};
  picker._setActive = () => {};
  picker.emitted = [];
  picker.emit = (type, detail) => { picker.emitted.push([type, detail]); };
  return picker;
}

test('TagPicker hands its async filter an AbortSignal that a newer query aborts', async () => {
  const { calls, filter } = deferredFilter();
  const picker = pickerProbe(filter);
  picker._scheduleAsyncQuery('a');
  await tick();
  assert.equal(calls.length, 1);
  assert.ok(calls[0].signal instanceof AbortSignal);
  assert.equal(calls[0].signal.aborted, false);

  picker._scheduleAsyncQuery('ab');
  assert.equal(calls[0].signal.aborted, true);
  await tick();
  calls[0].resolve([{ ID: 1, name: 'Stale' }]);
  await tick();
  assert.deepEqual(picker._items, []);
  calls[1].resolve([{ ID: 2, name: 'Fresh' }]);
  await tick();
  assert.deepEqual(picker._items, [{ ID: 2, name: 'Fresh' }]);
  assert.equal(picker._queryController, null);
});

test('TagPicker aborts on cancel and does not report the aborted request as an error', async () => {
  const { calls, filter } = deferredFilter();
  const picker = pickerProbe(filter);
  picker._scheduleAsyncQuery('q');
  await tick();
  // close(), destroy() and setItems() all cancel the query this way.
  picker._cancelQuery();
  assert.equal(calls[0].signal.aborted, true);
  calls[0].reject(new DOMException('Aborted', 'AbortError'));
  await tick();
  assert.deepEqual(picker.emitted.map(([type]) => type), ['query'], 'no error event for an abort');

  // A current request that fails is still reported.
  picker._scheduleAsyncQuery('r');
  await tick();
  calls[1].reject(new Error('Server down'));
  await tick();
  assert.deepEqual(picker.emitted.map(([type]) => type), ['query', 'query', 'error']);
});

test('TagPicker: a query listener that cancels keeps the filter from starting, and an abort listener supersedes', async () => {
  const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
  {
    const { calls, filter } = deferredFilter();
    const picker = pickerProbe(filter);
    picker.emit = (type) => { if (type === 'query') picker._cancelQuery(); };
    picker._scheduleAsyncQuery('a');
    await tick();
    assert.equal(calls.length, 0, 'the filter ran for a query its listener had cancelled');
  }
  {
    const { calls, filter } = deferredFilter();
    const picker = pickerProbe(filter);
    picker._scheduleAsyncQuery('a');
    await tick();
    calls[0].signal.addEventListener('abort', () => picker._scheduleAsyncQuery('c'), { once: true });
    picker._scheduleAsyncQuery('b');
    await tick();
    assert.deepEqual(calls.map((call) => call.query), ['a', 'c'], 'B was superseded by C and never ran');
  }
});
