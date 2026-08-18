/**
 * @typedef {Object} StorageOptions
 * @property {'local'|'session'} [area='local'] Backing Web Storage area.
 */

/**
 * @typedef {Object} NamespacedStorage
 * @property {(key: string, fallback?: any) => any} get Reads and decodes a value.
 * @property {(key: string, value: unknown) => void} set Encodes and writes a value.
 * @property {(key: string) => void} remove Deletes a single key.
 * @property {() => string[]} keys Lists the namespace's keys without their prefix.
 * @property {() => void} clear Deletes every key in the namespace, leaving other namespaces alone.
 */

/** Every key written by this module carries this prefix plus its namespace. */
const PREFIX = 'zx:';
/** Written and removed once to detect an area that exists but refuses writes. */
const PROBE_KEY = 'zx:__probe__';

/**
 * Creates a namespaced, JSON-encoded view of `localStorage` or `sessionStorage`.
 *
 * Every key is stored as `zx:<namespace>:<key>`, so several features can share one origin without
 * colliding, and `clear()` only touches the namespace it belongs to. When the storage area is
 * unavailable or refuses a write — private browsing, a full quota, cookies disabled — the view
 * transparently falls back to an in-memory map that lives as long as the page, so callers never
 * need a try/catch and never see an exception.
 *
 * @param {string} namespace Namespace segment, typically an application or feature name.
 * @param {StorageOptions} [options={}] Area selection.
 * @returns {NamespacedStorage}
 */
export function storage(namespace, options = {}) {
  const { area = 'local' } = options;
  const prefix = `${PREFIX}${String(namespace ?? '')}:`;
  /** @type {Map<string, string>} */
  const memory = new Map();
  let backing = resolveArea(area);

  /** @param {string} key @returns {string|null} */
  const readRaw = (key) => {
    if (backing !== null) {
      try {
        return backing.getItem(key);
      } catch {
        backing = null;
      }
    }
    return memory.has(key) ? memory.get(key) : null;
  };

  /** @param {string} key @param {string} raw @returns {void} */
  const writeRaw = (key, raw) => {
    if (backing !== null) {
      try {
        backing.setItem(key, raw);
        return;
      } catch {
        // A quota error mid-session degrades this view to memory rather than throwing.
        backing = null;
      }
    }
    memory.set(key, raw);
  };

  /** @param {string} key @returns {void} */
  const removeRaw = (key) => {
    if (backing !== null) {
      try {
        backing.removeItem(key);
      } catch {
        backing = null;
      }
    }
    memory.delete(key);
  };

  /** @returns {string[]} */
  const rawKeys = () => {
    if (backing !== null) {
      try {
        const found = [];
        for (let index = 0; index < backing.length; index += 1) {
          const key = backing.key(index);
          if (typeof key === 'string' && key.startsWith(prefix)) found.push(key);
        }
        return found;
      } catch {
        backing = null;
      }
    }
    return [...memory.keys()].filter((key) => key.startsWith(prefix));
  };

  return {
    /**
     * Reads a value, returning the fallback for a missing key or unparseable JSON.
     * @param {string} key Key within the namespace.
     * @param {any} [fallback] Value returned when nothing usable is stored.
     * @returns {any}
     */
    get(key, fallback) {
      const raw = readRaw(prefix + key);
      if (raw === null || raw === undefined) return fallback;
      try {
        return JSON.parse(raw);
      } catch {
        return fallback;
      }
    },

    /**
     * Writes a JSON-encoded value. `undefined` and values JSON cannot represent remove the key.
     * @param {string} key Key within the namespace.
     * @param {unknown} value Value to store.
     * @returns {void}
     */
    set(key, value) {
      let raw;
      try {
        raw = JSON.stringify(value);
      } catch {
        // Circular structures and BigInt are not storable; dropping the key beats throwing.
        raw = undefined;
      }
      if (raw === undefined) removeRaw(prefix + key);
      else writeRaw(prefix + key, raw);
    },

    /**
     * Removes a single key.
     * @param {string} key Key within the namespace.
     * @returns {void}
     */
    remove(key) {
      removeRaw(prefix + key);
    },

    /**
     * Lists the namespace's keys with the prefix stripped.
     * @returns {string[]}
     */
    keys() {
      return rawKeys().map((key) => key.slice(prefix.length));
    },

    /**
     * Removes every key in the namespace and nothing else.
     * @returns {void}
     */
    clear() {
      for (const key of rawKeys()) removeRaw(key);
    }
  };
}

/**
 * Returns a usable Web Storage area, or null when it is missing or rejects writes.
 * @param {'local'|'session'} area Area name.
 * @returns {Storage|null}
 */
function resolveArea(area) {
  const name = area === 'session' ? 'sessionStorage' : 'localStorage';
  try {
    const candidate = globalThis[name];
    if (!candidate || typeof candidate.getItem !== 'function') return null;
    // Safari's private mode exposes the API and throws on write, so probe before trusting it.
    candidate.setItem(PROBE_KEY, '1');
    candidate.removeItem(PROBE_KEY);
    return candidate;
  } catch {
    return null;
  }
}
