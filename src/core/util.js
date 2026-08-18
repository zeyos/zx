/**
 * Returns a debounced wrapper that runs after calls have stopped for the delay.
 * @template {(...args: any[]) => any} T
 * @param {T} fn Function to debounce.
 * @param {number} ms Delay in milliseconds.
 * @returns {(...args: Parameters<T>) => void}
 */
export function debounce(fn, ms) {
  let timer = null;

  return function debounced(...args) {
    const context = this;
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn.apply(context, args);
    }, ms);
  };
}

/**
 * @typedef {Object} ThrottleOptions
 * @property {boolean} [leading=true] Whether the first call in a window runs immediately.
 * @property {boolean} [trailing=true] Whether a call made during a window runs when it closes.
 */

/**
 * Returns a throttled wrapper that runs at most once per interval, on the leading edge, the
 * trailing edge, or both. The trailing call replays the most recent arguments and context.
 * @template {(...args: any[]) => any} T
 * @param {T} fn Function to throttle.
 * @param {number} ms Interval in milliseconds.
 * @param {ThrottleOptions} [options={}] Edge behaviour.
 * @returns {(...args: Parameters<T>) => void}
 */
export function throttle(fn, ms, { leading = true, trailing = true } = {}) {
  const interval = Math.max(0, Number(ms) || 0);
  let timer = null;
  let previous = 0;
  /** @type {any[]|null} */
  let pendingArgs = null;
  let pendingContext = null;

  const runTrailing = () => {
    timer = null;
    // Without a leading edge the next call must start a fresh window rather than fire at once.
    previous = leading ? Date.now() : 0;
    const args = pendingArgs;
    const context = pendingContext;
    pendingArgs = null;
    pendingContext = null;
    if (args !== null) fn.apply(context, args);
  };

  return function throttled(...args) {
    const now = Date.now();
    if (previous === 0 && !leading) previous = now;
    const remaining = interval - (now - previous);

    if (remaining <= 0 || remaining > interval) {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      previous = now;
      pendingArgs = null;
      pendingContext = null;
      fn.apply(this, args);
      return;
    }

    if (!trailing) return;
    pendingArgs = args;
    pendingContext = this;
    if (timer === null) timer = setTimeout(runTrailing, remaining);
  };
}

let uidSequence = 0;

/**
 * Creates a process-unique identifier suitable for DOM IDs and CSS names.
 * @param {string} [prefix='zx'] Identifier prefix.
 * @returns {string}
 */
export function uid(prefix = 'zx') {
  uidSequence += 1;
  return `${prefix}-${Date.now().toString(36)}-${uidSequence.toString(36)}`;
}

/**
 * Recursively merges plain objects without mutating either input.
 * Arrays and other values are replaced rather than merged.
 * @template T
 * @template U
 * @param {T} a Base value.
 * @param {U} b Overriding value.
 * @returns {T & U}
 */
export function deepMerge(a, b) {
  const result = isPlainObject(a) ? clonePlainObject(a) : {};
  if (!isPlainObject(b)) return /** @type {T & U} */ (cloneValue(b));

  for (const [key, value] of Object.entries(b)) {
    if (isPlainObject(value) && isPlainObject(result[key])) {
      result[key] = deepMerge(result[key], value);
    } else {
      result[key] = cloneValue(value);
    }
  }
  return /** @type {T & U} */ (result);
}

/**
 * Reports whether a value is a DOM Element, including elements from another realm.
 * @param {unknown} value Value to inspect.
 * @returns {value is Element}
 */
export function isElement(value) {
  return Boolean(value && typeof value === 'object' && value.nodeType === 1);
}

/**
 * Restricts a number to an inclusive range.
 * @param {number} n Value to restrict.
 * @param {number} min Minimum value.
 * @param {number} max Maximum value.
 * @returns {number}
 */
export function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

/**
 * Normalizes a nullable, scalar, iterable, or array value to a new array.
 * @template T
 * @param {T|Iterable<T>|ArrayLike<T>|null|undefined} value Value to normalize.
 * @returns {T[]}
 */
export function toArray(value) {
  if (value == null) return [];
  if (Array.isArray(value)) return value.slice();
  if (typeof value !== 'string' && typeof value[Symbol.iterator] === 'function') {
    return Array.from(value);
  }
  if (typeof value !== 'string' && typeof value.length === 'number') {
    return Array.from(value);
  }
  return [/** @type {T} */ (value)];
}

/**
 * @template T
 * @typedef {string|((item: T) => unknown)} KeySelector A property name or an accessor function.
 */

/**
 * @template T
 * @typedef {KeySelector<T>|{key: KeySelector<T>, dir?: 'asc'|'desc'}} SortKey
 * A property name (prefix with `-` to sort descending), an accessor, or an explicit direction.
 */

/**
 * Groups items into a plain object of arrays, keyed by a property or accessor and ordered by first
 * appearance.
 * @template T
 * @param {Iterable<T>|ArrayLike<T>|null|undefined} items Items to group.
 * @param {KeySelector<T>} key Property name or accessor returning the group key.
 * @returns {Record<string, T[]>}
 */
export function groupBy(items, key) {
  const select = keySelector(key);
  /** @type {Map<string, T[]>} */
  const groups = new Map();

  for (const item of toArray(items)) {
    const name = String(select(item));
    const bucket = groups.get(name);
    if (bucket === undefined) groups.set(name, [item]);
    else bucket.push(item);
  }
  // fromEntries defines own properties, so a group named "__proto__" stays plain data.
  return Object.fromEntries(groups);
}

/**
 * Sorts items by one or more keys into a NEW array, leaving the input untouched. Strings compare
 * with `localeCompare` (digit runs compare numerically), numbers, booleans, and dates compare by
 * value, and null, undefined, and NaN always sort last regardless of direction.
 * @template T
 * @param {Iterable<T>|ArrayLike<T>|null|undefined} items Items to sort.
 * @param {...SortKey<T>} keys Sort keys applied in order.
 * @returns {T[]}
 */
export function sortBy(items, ...keys) {
  const list = toArray(items);
  const comparators = keys.map(toComparator);
  if (comparators.length === 0) return list;

  return list.sort((a, b) => {
    for (const compare of comparators) {
      const result = compare(a, b);
      if (result !== 0) return result;
    }
    return 0;
  });
}

/**
 * Removes duplicates, keeping the first occurrence, and returns a new array.
 * @template T
 * @param {Iterable<T>|ArrayLike<T>|null|undefined} items Items to filter.
 * @param {KeySelector<T>} [key] Property name or accessor; the item itself when omitted.
 * @returns {T[]}
 */
export function uniqueBy(items, key) {
  const select = key == null ? (/** @type {T} */ item) => item : keySelector(key);
  const seen = new Set();
  const result = [];

  for (const item of toArray(items)) {
    const identity = select(item);
    if (seen.has(identity)) continue;
    seen.add(identity);
    result.push(item);
  }
  return result;
}

/**
 * Escapes regular-expression metacharacters so a value can be used as a literal pattern.
 * @param {unknown} value Value to escape.
 * @returns {string}
 */
export function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** @template T @param {KeySelector<T>} key @returns {(item: T) => unknown} */
function keySelector(key) {
  if (typeof key === 'function') return key;
  const name = String(key);
  return (item) => (item == null ? undefined : item[name]);
}

/** @template T @param {SortKey<T>} key @returns {(a: T, b: T) => number} */
function toComparator(key) {
  let select;
  let direction = 1;

  if (typeof key === 'function') {
    select = key;
  } else if (key !== null && typeof key === 'object') {
    select = keySelector(key.key);
    if (String(key.dir).toLowerCase() === 'desc') direction = -1;
  } else {
    let name = String(key);
    if (name.startsWith('-')) {
      direction = -1;
      name = name.slice(1);
    } else if (name.startsWith('+')) {
      name = name.slice(1);
    }
    select = keySelector(name);
  }

  return (a, b) => {
    const left = select(a);
    const right = select(b);
    const leftEmpty = isEmptyValue(left);
    const rightEmpty = isEmptyValue(right);
    // Empties are placed outside the direction flip so they stay at the end either way.
    if (leftEmpty || rightEmpty) {
      if (leftEmpty && rightEmpty) return 0;
      return leftEmpty ? 1 : -1;
    }
    return direction * compareValues(left, right);
  };
}

/** @param {unknown} value @returns {boolean} */
function isEmptyValue(value) {
  return value == null || (typeof value === 'number' && Number.isNaN(value));
}

/** @param {any} a @param {any} b @returns {number} */
function compareValues(a, b) {
  if (a instanceof Date || b instanceof Date) {
    return sign(toTimestamp(a) - toTimestamp(b));
  }
  if (typeof a === 'boolean' || typeof b === 'boolean') {
    return sign(Number(a) - Number(b));
  }
  if (typeof a === 'number' && typeof b === 'number') {
    return sign(a - b);
  }
  return String(a).localeCompare(String(b), undefined, { numeric: true });
}

/** @param {any} value @returns {number} */
function toTimestamp(value) {
  if (value instanceof Date) return value.getTime();
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

/** @param {number} value @returns {number} */
function sign(value) {
  if (Number.isNaN(value)) return 0;
  return value < 0 ? -1 : (value > 0 ? 1 : 0);
}

/** @param {unknown} value @returns {value is Record<string, any>} */
function isPlainObject(value) {
  if (value === null || typeof value !== 'object') return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/** @param {Record<string, any>} value @returns {Record<string, any>} */
function clonePlainObject(value) {
  const result = {};
  for (const [key, item] of Object.entries(value)) result[key] = cloneValue(item);
  return result;
}

/** @param {any} value @returns {any} */
function cloneValue(value) {
  if (isPlainObject(value)) return clonePlainObject(value);
  if (Array.isArray(value)) return value.map(cloneValue);
  return value;
}
