import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import { Http, parseResult } from '../../src/core/http.js';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

test('legacy success envelopes accept false and zero error sentinels', () => {
  for (const error of [false, 0, null, undefined]) {
    assert.deepEqual(parseResult({ result: { id: 7 }, error }), { id: 7 });
  }
  assert.throws(() => parseResult({ error: 'Rejected' }), /Rejected/);
  assert.throws(() => parseResult({ error: { message: 'Rejected' } }), /Rejected/);
  assert.throws(() => parseResult({ error: '' }), /Server error/);
  assert.deepEqual(parseResult({ id: 7 }), { id: 7 });
});

test('multipart requests honor custom file names without setting a boundary header', async () => {
  const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push({ url, options });
    return new Response('{"result":"ok","error":false}');
  };
  const http = new Http({ base: '/api/', headers: { 'X-Client': 'test', 'Content-Type': 'application/json' } });
  const files = [new File(['one'], 'one.txt'), new File(['two'], 'two.txt')];
  assert.equal(await http.request('upload', { method: 'POST', files, paramName: 'upload', data: { id: 4 } }), 'ok');
  const { url, options } = requests[0];
  assert.equal(url, '/api/upload');
  assert.deepEqual([...options.body.keys()], ['id', 'upload', 'upload']);
  assert.deepEqual(options.body.getAll('upload').map((file) => file.name), ['one.txt', 'two.txt']);
  assert.equal(options.headers.get('Content-Type'), null);
  assert.equal(options.headers.get('X-Client'), 'test');
  await http.request('upload', { method: 'POST', files: files[0] });
  assert.deepEqual([...requests[1].options.body.keys()], ['files']);
});

test('an already aborted caller prevents fetch and reports its reason', async () => {
  let fetched = false;
  globalThis.fetch = async () => { fetched = true; return new Response('{}'); };
  const controller = new AbortController();
  const reason = new Error('Canceled by caller');
  controller.abort(reason);
  const errors = [];
  await assert.rejects(new Http({ onError: (error) => errors.push(error) }).request('/unused', {
    signal: controller.signal
  }), (error) => error === reason);
  assert.equal(fetched, false);
  assert.deepEqual(errors, [reason]);
});

test('caller cancellation reaches the active fetch and releases its listener', async () => {
  const controller = new AbortController();
  let activeListeners = 0;
  const add = controller.signal.addEventListener.bind(controller.signal);
  const remove = controller.signal.removeEventListener.bind(controller.signal);
  controller.signal.addEventListener = (...args) => { activeListeners++; return add(...args); };
  controller.signal.removeEventListener = (...args) => { activeListeners--; return remove(...args); };
  let fetchSignal;
  globalThis.fetch = (_url, { signal }) => {
    fetchSignal = signal;
    return new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }));
  };
  const pending = new Http({ timeout: 0 }).request('/pending', { signal: controller.signal });
  controller.abort();
  assert.equal(fetchSignal.aborted, true);
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(activeListeners, 0);
});

test('timeouts are distinguishable from caller cancellation', async () => {
  globalThis.fetch = (_url, { signal }) => new Promise((_, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason), { once: true });
  });
  await assert.rejects(new Http({ timeout: 5 }).request('/slow'), { name: 'TimeoutError' });
});

test('success and request-construction errors remove caller abort listeners', async () => {
  globalThis.fetch = async () => new Response('{}');
  for (const broken of [false, true]) {
    const controller = new AbortController();
    const handlers = new Set();
    const add = controller.signal.addEventListener.bind(controller.signal);
    const remove = controller.signal.removeEventListener.bind(controller.signal);
    controller.signal.addEventListener = (type, fn, options) => { handlers.add(fn); add(type, fn, options); };
    controller.signal.removeEventListener = (type, fn, options) => { handlers.delete(fn); remove(type, fn, options); };
    const data = {};
    if (broken) data.self = data;
    const request = new Http({ timeout: 0 }).request('/data', { method: 'POST', data, signal: controller.signal });
    if (broken) await assert.rejects(request, TypeError);
    else await request;
    assert.equal(handlers.size, 0);
  }
});
