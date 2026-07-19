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
