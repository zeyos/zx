import assert from 'node:assert/strict';
import test from 'node:test';

import { storage } from '../../src/core/storage.js';

/**
 * Minimal Web Storage double backed by a Map, matching the parts `storage()` uses: the indexed
 * `key()`/`length` pair plus the three accessors.
 */
class FakeStorage {
  constructor() {
    /** @type {Map<string, string>} */
    this.map = new Map();
  }

  get length() {
    return this.map.size;
  }

  /** @param {number} index @returns {string|null} */
  key(index) {
    return [...this.map.keys()][index] ?? null;
  }

  /** @param {string} name @returns {string|null} */
  getItem(name) {
    return this.map.has(name) ? this.map.get(name) : null;
  }

  /** @param {string} name @param {string} value @returns {void} */
  setItem(name, value) {
    this.map.set(name, String(value));
  }

  /** @param {string} name @returns {void} */
  removeItem(name) {
    this.map.delete(name);
  }
}

/** A storage area that exists but rejects every operation, like Safari's private mode. */
const THROWING_AREA = {
  get length() {
    throw new Error('storage disabled');
  },
  key() {
    throw new Error('storage disabled');
  },
  getItem() {
    throw new Error('storage disabled');
  },
  setItem() {
    throw new Error('storage disabled');
  },
  removeItem() {
    throw new Error('storage disabled');
  }
};

/**
 * Installs a storage area on the global object for the duration of one callback and restores the
 * previous state afterwards, so tests cannot leak into each other.
 * @param {string} name Global property name.
 * @param {unknown} area Replacement area.
 * @param {(area: any) => void} run Callback executed with the stub installed.
 * @returns {void}
 */
function withArea(name, area, run) {
  const had = Object.prototype.hasOwnProperty.call(globalThis, name);
  const previous = globalThis[name];
  globalThis[name] = area;
  try {
    run(area);
  } finally {
    if (had) globalThis[name] = previous;
    else delete globalThis[name];
  }
}

test('storage round-trips JSON-encodable values', () => {
  withArea('localStorage', new FakeStorage(), () => {
    const store = storage('app');
    store.set('string', 'hello');
    store.set('number', 42);
    store.set('boolean', false);
    store.set('object', { nested: { list: [1, 2, 3] } });
    store.set('null', null);

    assert.equal(store.get('string'), 'hello');
    assert.equal(store.get('number'), 42);
    assert.equal(store.get('boolean'), false);
    assert.deepEqual(store.get('object'), { nested: { list: [1, 2, 3] } });
    assert.equal(store.get('null'), null);
  });
});

test('storage.get returns the fallback for a missing key', () => {
  withArea('localStorage', new FakeStorage(), () => {
    const store = storage('app');
    assert.equal(store.get('absent'), undefined);
    assert.equal(store.get('absent', 'default'), 'default');
    assert.deepEqual(store.get('absent', { a: 1 }), { a: 1 });
    // A stored value shadows the fallback, including a falsy one.
    store.set('present', 0);
    assert.equal(store.get('present', 'default'), 0);
  });
});

test('storage.get returns the fallback for unparseable JSON', () => {
  withArea('localStorage', new FakeStorage(), (area) => {
    const store = storage('app');
    // Something else wrote a raw, non-JSON value under our prefix.
    area.setItem('zx:app:broken', 'not json {');
    assert.equal(store.get('broken', 'fallback'), 'fallback');
    assert.equal(store.get('broken'), undefined);
  });
});

test('storage prefixes every key with zx:<namespace>:', () => {
  withArea('localStorage', new FakeStorage(), (area) => {
    const store = storage('invoices');
    store.set('filter', 'open');
    assert.equal(area.getItem('zx:invoices:filter'), '"open"');
    assert.deepEqual([...area.map.keys()], ['zx:invoices:filter']);
    // keys() reports the namespace-relative name.
    assert.deepEqual(store.keys(), ['filter']);
  });
});

test('storage namespaces are isolated and clear() spares its neighbours', () => {
  withArea('localStorage', new FakeStorage(), (area) => {
    const invoices = storage('invoices');
    const contacts = storage('contacts');
    invoices.set('filter', 'open');
    invoices.set('sort', 'date');
    contacts.set('filter', 'active');

    assert.deepEqual(invoices.keys().sort(), ['filter', 'sort']);
    assert.deepEqual(contacts.keys(), ['filter']);
    // The same key name in two namespaces holds two independent values.
    assert.equal(invoices.get('filter'), 'open');
    assert.equal(contacts.get('filter'), 'active');

    invoices.clear();
    assert.deepEqual(invoices.keys(), []);
    assert.deepEqual(contacts.keys(), ['filter']);
    assert.equal(area.getItem('zx:contacts:filter'), '"active"');
  });
});

test('storage.remove deletes one key and set(undefined) removes it too', () => {
  withArea('localStorage', new FakeStorage(), () => {
    const store = storage('app');
    store.set('a', 1);
    store.set('b', 2);

    store.remove('a');
    assert.equal(store.get('a', 'gone'), 'gone');
    assert.deepEqual(store.keys(), ['b']);

    // undefined has no JSON representation, so the key is dropped rather than stored.
    store.set('b', undefined);
    assert.deepEqual(store.keys(), []);
  });
});

test('storage.set drops values JSON cannot represent instead of throwing', () => {
  withArea('localStorage', new FakeStorage(), () => {
    const store = storage('app');
    const circular = { name: 'loop' };
    circular.self = circular;

    assert.doesNotThrow(() => store.set('circular', circular));
    assert.equal(store.get('circular', 'fallback'), 'fallback');
    assert.deepEqual(store.keys(), []);
  });
});

test('storage selects the session area when asked', () => {
  withArea('localStorage', new FakeStorage(), (local) => {
    withArea('sessionStorage', new FakeStorage(), (session) => {
      const store = storage('app', { area: 'session' });
      store.set('key', 'value');
      assert.equal(session.getItem('zx:app:key'), '"value"');
      assert.equal(local.getItem('zx:app:key'), null);
    });
  });
});

test('storage degrades to memory when the area throws on every call', () => {
  withArea('localStorage', THROWING_AREA, () => {
    const store = storage('app');
    // The whole API keeps working without ever surfacing an exception.
    assert.doesNotThrow(() => store.set('key', { a: 1 }));
    assert.deepEqual(store.get('key'), { a: 1 });
    assert.deepEqual(store.keys(), ['key']);
    assert.equal(store.get('absent', 'fallback'), 'fallback');

    store.remove('key');
    assert.deepEqual(store.keys(), []);

    store.set('x', 1);
    store.clear();
    assert.deepEqual(store.keys(), []);
  });
});

test('storage degrades to memory when the area is missing entirely', () => {
  withArea('localStorage', undefined, () => {
    const store = storage('app');
    store.set('key', 'value');
    assert.equal(store.get('key'), 'value');
    assert.deepEqual(store.keys(), ['key']);
  });
});

test('storage degrades to memory when writes start failing mid-session', () => {
  const area = new FakeStorage();
  withArea('localStorage', area, () => {
    const store = storage('app');
    store.set('before', 'written');
    assert.equal(area.getItem('zx:app:before'), '"written"');

    // A full quota turns every later write into an exception.
    area.setItem = () => {
      throw new Error('QuotaExceededError');
    };
    assert.doesNotThrow(() => store.set('after', 'memory'));
    assert.equal(store.get('after'), 'memory');
    assert.equal(area.getItem('zx:app:after'), null);
  });
});

test('storage tolerates an empty or nullish namespace', () => {
  withArea('localStorage', new FakeStorage(), (area) => {
    const store = storage(null);
    store.set('key', 'value');
    assert.equal(store.get('key'), 'value');
    assert.equal(area.getItem('zx::key'), '"value"');
  });
});
