// @ts-check
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
 * @property {(keys: string[]) => string[]} migrateLegacy Copies listed valid legacy keys once if absent.
 */

/** Every key written by this module carries this prefix plus its namespace. */
const PREFIX = 'zx2:';
/** The previous format cannot distinguish namespace separators from key separators. */
const LEGACY_PREFIX = 'zx:';
/** Read once to detect an area that exists but refuses access altogether. */
const PROBE_KEY = 'zx:__probe__';

/*
 * The in-memory fallbacks, one per storage area, shared by every view of that area: a value a view
 * could not persist is still there for the next `storage()` call with the same namespace — a
 * component re-created on the same page reads back what its predecessor wrote. Module state is
 * deliberate here; the "no module-level mutable state" rule is for components. An area that exists
 * is keyed by its Storage object, so a replaced area starts with a clean fallback.
 */
/** @type {WeakMap<Storage, Map<string, string>>} */
const AREA_FALLBACKS = new WeakMap();
/** @type {Map<string, Map<string, string>>} */
const MISSING_AREA_FALLBACKS = new Map();

/**
 * Creates a namespaced, JSON-encoded view of `localStorage` or `sessionStorage`.
 *
 * Keys use `zx2:<namespace length>:<namespace>:<key>`, so namespaces cannot overlap. Existing
 * `zx:` keys are copied only when explicitly requested through `migrateLegacy(keys)`; they are
 * never deleted. `clear()` only touches the current namespace. When the storage area is
 * unavailable or refuses a write — private browsing, a full quota, cookies disabled — the value
 * goes to an in-memory map that lives as long as the page and is shared by every view of the same
 * area, so callers never need a try/catch and never see an exception. A refused write affects only
 * that value: everything else is still read from, and written to, the real storage area.
 *
 * @param {string} namespace Namespace segment, typically an application or feature name.
 * @param {StorageOptions} [options={}] Area selection.
 * @returns {NamespacedStorage}
 */
export function storage(namespace, options = {}) {
  const { area = 'local' } = options;
  const name = String(namespace ?? '');
  const prefix = `${PREFIX}${name.length}:${name}:`;
  const legacyPrefix = `${LEGACY_PREFIX}${name}:`;
  const migratedPrefix = `zx2m:${name.length}:${name}:`;
  let backing = resolveArea(area);
  const memory = fallbackFor(area, backing);
  /**
   * What this view last read from or wrote to the area, so values it has seen survive an area that
   * stops answering later in the session (access revoked, storage disabled).
   * @type {Map<string, string>}
   */
  const known = new Map();

  /** @param {string} key @returns {string|null} */
  const readRaw = (key) => {
    // A value held in memory is one the area refused: it is newer than whatever the area kept.
    if (memory.has(key)) return /** @type {string} */ (memory.get(key));
    if (backing !== null) {
      try {
        const raw = backing.getItem(key);
        if (raw === null) known.delete(key);
        else known.set(key, raw);
        return raw;
      } catch {
        backing = null;
      }
    }
    return known.has(key) ? /** @type {string} */ (known.get(key)) : null;
  };

  /** @param {string} key @param {string} raw @returns {void} */
  const writeRaw = (key, raw) => {
    if (backing !== null) {
      try {
        backing.setItem(key, raw);
        // Persisted, so an older refused value must not shadow it any longer.
        memory.delete(key);
        known.set(key, raw);
        return;
      } catch {
        // A full quota refuses this write only. The area stays in use for reads and later writes;
        // the refused value is kept in memory as the caller's intended value.
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
    known.delete(key);
  };

  /** @returns {string[]} */
  const rawKeys = () => {
    const found = new Set();
    if (backing !== null) {
      try {
        for (let index = 0; index < backing.length; index += 1) {
          const key = backing.key(index);
          if (typeof key === 'string' && key.startsWith(prefix)) found.add(key);
        }
      } catch {
        backing = null;
      }
    }
    if (backing === null) for (const key of known.keys()) if (key.startsWith(prefix)) found.add(key);
    for (const key of memory.keys()) if (key.startsWith(prefix)) found.add(key);
    return [...found];
  };

  return {
    /**
     * Copies exact legacy keys once without removing the originals. Existing current values win;
     * missing keys are also marked handled. Invalid legacy JSON remains eligible for a later retry.
     * Handled markers survive `remove()` and `clear()`, preventing a deleted value from returning.
     * @param {string[]} keys Legacy keys known to belong to this caller.
     * @returns {string[]} Names copied successfully.
     */
    migrateLegacy(keys) {
      const migrated = [];
      for (const key of new Set(Array.isArray(keys) ? keys.map(String) : [])) {
        const destination = prefix + key;
        const marker = migratedPrefix + key;
        if (readRaw(marker) != null) continue;
        if (readRaw(destination) != null) {
          writeRaw(marker, '1');
          continue;
        }
        const raw = readRaw(legacyPrefix + key);
        if (raw == null) {
          writeRaw(marker, '1');
          continue;
        }
        try { JSON.parse(raw); } catch { continue; }
        writeRaw(destination, raw);
        if (readRaw(destination) === raw) {
          writeRaw(marker, '1');
          migrated.push(key);
        }
      }
      return migrated;
    },

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
 * Returns a readable Web Storage area, or null when it is missing or refuses access.
 *
 * An area that reads but refuses writes — Safari's private mode, a quota already full — is still
 * returned: what it holds stays readable, and each refused write falls back on its own.
 * @param {'local'|'session'} area Area name.
 * @returns {Storage|null}
 */
function resolveArea(area) {
  const name = area === 'session' ? 'sessionStorage' : 'localStorage';
  try {
    const candidate = globalThis[name];
    if (!candidate || typeof candidate.getItem !== 'function') return null;
    candidate.getItem(PROBE_KEY);
    return candidate;
  } catch {
    return null;
  }
}

/**
 * The shared in-memory fallback for an area.
 * @param {'local'|'session'} area Area name.
 * @param {Storage|null} backing The resolved area, or null when there is none.
 * @returns {Map<string, string>}
 */
function fallbackFor(area, backing) {
  const table = backing === null ? MISSING_AREA_FALLBACKS : AREA_FALLBACKS;
  const key = backing ?? (area === 'session' ? 'session' : 'local');
  let memory = table.get(/** @type {any} */ (key));
  if (!memory) {
    memory = new Map();
    table.set(/** @type {any} */ (key), memory);
  }
  return memory;
}
