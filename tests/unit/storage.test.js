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
    area.setItem('zx2:3:app:broken', 'not json {');
    assert.equal(store.get('broken', 'fallback'), 'fallback');
    assert.equal(store.get('broken'), undefined);
  });
});

test('storage prefixes keys with a length-delimited namespace', () => {
  withArea('localStorage', new FakeStorage(), (area) => {
    const store = storage('invoices');
    store.set('filter', 'open');
    assert.equal(area.getItem('zx2:8:invoices:filter'), '"open"');
    assert.deepEqual([...area.map.keys()], ['zx2:8:invoices:filter']);
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
    assert.equal(area.getItem('zx2:8:contacts:filter'), '"active"');
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
      assert.equal(session.getItem('zx2:3:app:key'), '"value"');
      assert.equal(local.getItem('zx2:3:app:key'), null);
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
    assert.equal(area.getItem('zx2:3:app:before'), '"written"');

    // A full quota turns every later write into an exception.
    area.setItem = () => {
      throw new Error('QuotaExceededError');
    };
    assert.doesNotThrow(() => store.set('after', 'memory'));
    assert.equal(store.get('after'), 'memory');
    assert.equal(area.getItem('zx2:3:app:after'), null);
  });
});

test('storage tolerates an empty or nullish namespace', () => {
  withArea('localStorage', new FakeStorage(), (area) => {
    const store = storage(null);
    store.set('key', 'value');
    assert.equal(store.get('key'), 'value');
    assert.equal(area.getItem('zx2:0::key'), '"value"');
  });
});

test('colon-containing namespaces and keys remain distinct across clears', () => {
  withArea('localStorage', new FakeStorage(), () => {
    const short = storage('a'); const nested = storage('a:b');
    short.set('b:key', 'short'); nested.set('key', 'nested');
    assert.equal(short.get('b:key'), 'short'); assert.equal(nested.get('key'), 'nested');
    short.clear(); assert.equal(short.get('b:key'), undefined); assert.equal(nested.get('key'), 'nested');
  });
});

test('legacy migration copies exact valid keys once and never deletes the originals', () => {
  for (const areaName of ['localStorage', 'sessionStorage']) withArea(areaName, new FakeStorage(), (area) => {
    const options = { area: areaName === 'sessionStorage' ? 'session' : 'local' };
    const store = storage('a', options); const nested = storage('a:b', options);
    area.setItem('zx:a:b:key', JSON.stringify('legacy'));
    area.setItem('zx:a:invalid', '{');
    area.setItem('zx:a:existing', JSON.stringify('old'));
    store.set('existing', 'new');
    assert.equal(store.get('b:key'), undefined);
    assert.deepEqual(store.migrateLegacy(['b:key', 'invalid', 'existing', 'missing']), ['b:key']);
    assert.equal(store.get('b:key'), 'legacy'); assert.equal(store.get('existing'), 'new');
    assert.equal(area.getItem('zx:a:b:key'), '"legacy"');
    assert.deepEqual(nested.migrateLegacy(['key']), ['key']);
    store.remove('b:key'); store.clear();
    const fresh = storage('a', options);
    area.setItem('zx:a:missing', JSON.stringify('arrived later'));
    assert.deepEqual(fresh.migrateLegacy(['b:key', 'existing', 'missing']), []);
    assert.equal(fresh.get('b:key'), undefined); assert.equal(fresh.get('existing'), undefined);
    assert.equal(fresh.get('missing'), undefined); assert.equal(nested.get('key'), 'legacy');
    area.setItem('zx:a:invalid', JSON.stringify('repaired'));
    assert.deepEqual(fresh.migrateLegacy(['invalid']), ['invalid']);
    assert.equal(fresh.get('invalid'), 'repaired');
  });
});

test('migration uses the in-memory fallback if writes fail partway through', () => {
  const area = new FakeStorage();
  withArea('localStorage', area, () => {
    area.setItem('zx:app:one', '1');
    const store = storage('app');
    const write = area.setItem.bind(area);
    area.setItem = (key, value) => { if (key.startsWith('zx2:')) throw new Error('quota'); write(key, value); };
    assert.deepEqual(store.migrateLegacy(['one']), ['one']);
    assert.equal(store.get('one'), 1); assert.equal(area.getItem('zx:app:one'), '1');
    store.remove('one'); assert.deepEqual(store.migrateLegacy(['one']), []);
  });
});

test('legacy migration preserves falsy JSON and keeps local and session markers independent', () => {
  withArea('localStorage', new FakeStorage(), (local) => {
    withArea('sessionStorage', new FakeStorage(), (session) => {
      const values = { zero: 0, false: false, empty: '', null: null };
      for (const area of [local, session]) {
        for (const [key, value] of Object.entries(values)) area.setItem(`zx:app:${key}`, JSON.stringify(value));
      }
      for (const [areaName, backing] of [['local', local], ['session', session]]) {
        const store = storage('app', { area: areaName });
        assert.deepEqual(store.migrateLegacy(Object.keys(values)), Object.keys(values));
        for (const [key, value] of Object.entries(values)) {
          assert.equal(store.get(key, 'missing'), value);
          assert.equal(backing.getItem(`zx2:3:app:${key}`), JSON.stringify(value));
          assert.equal(backing.getItem(`zx:app:${key}`), JSON.stringify(value));
        }
      }
    });
  });
});

test('a failed migration-marker write keeps the copied value visible in memory', () => {
  const area = new FakeStorage();
  withArea('localStorage', area, () => {
    area.setItem('zx:app:key', '42');
    const store = storage('app');
    const write = area.setItem.bind(area);
    area.setItem = (key, value) => { if (key.startsWith('zx2m:')) throw new Error('quota'); write(key, value); };
    assert.deepEqual(store.migrateLegacy(['key']), ['key']);
    assert.equal(store.get('key'), 42); assert.equal(area.getItem('zx:app:key'), '42');
    store.remove('key'); assert.deepEqual(store.migrateLegacy(['key']), []);
  });
});

test('a failed migration marker preserves an existing persisted destination', () => {
  const area = new FakeStorage();
  withArea('localStorage', area, () => {
    area.setItem('zx2:3:app:key', '42'); area.setItem('zx:app:key', '7');
    const store = storage('app'); const write = area.setItem.bind(area);
    area.setItem = (key, value) => { if (key.startsWith('zx2m:')) throw new Error('quota'); write(key, value); };
    assert.deepEqual(store.migrateLegacy(['key']), []);
    assert.equal(store.get('key'), 42); assert.deepEqual(store.keys(), ['key']);
    assert.equal(area.getItem('zx:app:key'), '7');
  });
});

test('an externally removed cached value does not return after fallback', () => {
  for (const readAfterRemoval of [false, true]) {
    const area = new FakeStorage();
    withArea('localStorage', area, () => {
      area.setItem('zx2:3:app:seen', '42');
      const store = storage('app'); assert.equal(store.get('seen'), 42);
      area.removeItem('zx2:3:app:seen');
      if (readAfterRemoval) assert.equal(store.get('seen', 'missing'), 'missing');
      area.setItem = () => { throw new Error('quota'); };
      store.set('other', 1);
      assert.equal(store.get('seen', 'missing'), 'missing');
      assert.deepEqual(store.keys(), ['other']);
    });
  }
});
