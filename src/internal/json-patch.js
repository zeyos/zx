// @ts-check
/**
 * JSON Pointer (RFC 6901) and JSON Patch (RFC 6902) over plain JSON values.
 *
 * Every function here is pure: a document handed in is never mutated, and a function that changes
 * something returns a new document. Pointers may not walk through `__proto__`, `constructor` or
 * `prototype`, so a pointer written by a model or a server can never reach an object's prototype.
 *
 * The module touches no DOM and imports nothing, so it runs unchanged in a browser and on a server.
 */

/** Segments refused anywhere in a pointer. */
const FORBIDDEN_SEGMENTS = new Set(['__proto__', 'constructor', 'prototype']);

/** The six RFC 6902 operations. */
const OPERATIONS = new Set(['add', 'remove', 'replace', 'move', 'copy', 'test']);

/** An array index as RFC 6901 writes it: `0`, or digits without a leading zero. */
const ARRAY_INDEX = /^(?:0|[1-9][0-9]*)$/;

/**
 * Why a pointer or a patch operation could not be applied.
 * - `invalid-pointer`: the pointer is not a string, or is not empty and does not start with `/`,
 *   or carries a `~` that is not `~0` or `~1`.
 * - `forbidden-segment`: a segment is `__proto__`, `constructor` or `prototype`.
 * - `not-a-container`: the path runs through a value that is neither an object nor an array.
 * - `path-not-found`: the target, or its parent, does not exist.
 * - `invalid-index`: an array segment is not an index, is out of range, or is `-` where nothing
 *   is appended.
 * - `invalid-operation`: an operation is malformed or unknown, or moves a value into itself.
 * - `test-failed`: a `test` operation's value differs from the document's.
 * @typedef {'invalid-pointer'|'forbidden-segment'|'not-a-container'|'path-not-found'|'invalid-index'|'invalid-operation'|'test-failed'} JsonPatchErrorCode
 */

/**
 * One RFC 6902 operation. `value` is required by `add`, `replace` and `test`, `from` by `move`
 * and `copy`. Other members are ignored, as the RFC asks.
 * @typedef {Object} JsonPatchOperation
 * @property {'add'|'remove'|'replace'|'move'|'copy'|'test'} op Operation name.
 * @property {string} path RFC 6901 pointer to the target.
 * @property {unknown} [value] Value to add, replace with, or test against.
 * @property {string} [from] RFC 6901 pointer to the source of a `move` or `copy`.
 */

/**
 * The error every function in this module throws. `code` says what went wrong, `pointer` where,
 * and `index` which operation of a patch failed (`-1` outside a patch).
 */
export class JsonPatchError extends Error {
  /**
   * @param {string} message Human-readable description.
   * @param {JsonPatchErrorCode} code What went wrong.
   * @param {string} [pointer=''] The pointer involved.
   * @param {number} [index=-1] Position of the failing operation within a patch.
   */
  constructor(message, code, pointer = '', index = -1) {
    super(message);
    this.name = 'JsonPatchError';
    /** @type {JsonPatchErrorCode} */
    this.code = code;
    /** @type {string} */
    this.pointer = pointer;
    /** @type {number} */
    this.index = index;
  }
}

/**
 * Splits an RFC 6901 pointer into its unescaped segments. `''` is the whole document and yields no
 * segments; `'/'` yields one empty segment. `~1` becomes `/` and then `~0` becomes `~`, in that
 * order, so `~01` reads as the two characters `~1`.
 * @param {string} pointer RFC 6901 pointer.
 * @returns {string[]}
 * @throws {JsonPatchError} `invalid-pointer` when malformed, `forbidden-segment` for `__proto__`,
 *   `constructor` or `prototype`.
 */
export function parsePointer(pointer) {
  if (typeof pointer !== 'string') throw new JsonPatchError('A pointer must be a string', 'invalid-pointer');
  if (pointer === '') return [];
  if (pointer[0] !== '/') {
    throw new JsonPatchError(`A pointer must be empty or start with "/": ${pointer}`, 'invalid-pointer', pointer);
  }
  return pointer.slice(1).split('/').map((raw) => {
    if (/~(?![01])/.test(raw)) {
      throw new JsonPatchError(`A pointer may only escape "~0" and "~1": ${pointer}`, 'invalid-pointer', pointer);
    }
    const segment = raw.replace(/~1/g, '/').replace(/~0/g, '~');
    if (FORBIDDEN_SEGMENTS.has(segment)) {
      throw new JsonPatchError(`A pointer may not name "${segment}": ${pointer}`, 'forbidden-segment', pointer);
    }
    return segment;
  });
}

/**
 * Joins segments into an RFC 6901 pointer, escaping `~` as `~0` and `/` as `~1`. The inverse of
 * `parsePointer()`.
 * @param {Array<string|number>} segments Unescaped segments.
 * @returns {string}
 */
export function formatPointer(segments) {
  return segments.map((segment) => `/${String(segment).replace(/~/g, '~0').replace(/\//g, '~1')}`).join('');
}

/**
 * Reads the value a pointer names. A path that does not exist, runs through a value that is not a
 * container, or ends in `-` reads as `undefined` rather than throwing, so a binding to data that
 * has not arrived yet is simply empty.
 * @param {unknown} document JSON value to read from.
 * @param {string} pointer RFC 6901 pointer.
 * @returns {unknown} The value, or `undefined` when there is none.
 * @throws {JsonPatchError} When the pointer itself is malformed or names a forbidden segment.
 */
export function getPointer(document, pointer) {
  let current = document;
  for (const segment of parsePointer(pointer)) {
    if (Array.isArray(current)) {
      if (!ARRAY_INDEX.test(segment)) return undefined;
      const index = Number(segment);
      if (index >= current.length) return undefined;
      current = current[index];
    } else if (isObject(current)) {
      if (!Object.hasOwn(current, segment)) return undefined;
      current = /** @type {Record<string, unknown>} */ (current)[segment];
    } else {
      return undefined;
    }
  }
  return current;
}

/**
 * Reports whether a pointer names an existing value, which `getPointer()` cannot tell from a
 * missing one when the value read is `undefined`.
 * @param {unknown} document JSON value to read from.
 * @param {string} pointer RFC 6901 pointer.
 * @returns {boolean}
 * @throws {JsonPatchError} When the pointer itself is malformed or names a forbidden segment.
 */
export function hasPointer(document, pointer) {
  let current = document;
  for (const segment of parsePointer(pointer)) {
    if (Array.isArray(current)) {
      if (!ARRAY_INDEX.test(segment) || Number(segment) >= current.length) return false;
      current = current[Number(segment)];
    } else if (isObject(current)) {
      if (!Object.hasOwn(current, segment)) return false;
      current = /** @type {Record<string, unknown>} */ (current)[segment];
    } else {
      return false;
    }
  }
  return true;
}

/**
 * Stores a value at a pointer and returns the new document: the simple "set" a data stream needs.
 * An object member is created or replaced; an array element at an existing index is replaced, and
 * one at the array's length or at `-` is appended. The empty pointer replaces the whole document.
 * Every parent on the path must already exist. The value is copied in, never shared.
 * @param {unknown} document JSON value to change. Not mutated.
 * @param {string} pointer RFC 6901 pointer.
 * @param {unknown} value JSON value to store.
 * @returns {unknown} The new document.
 * @throws {JsonPatchError} `not-a-container` when the path runs through a value that is not an
 *   object or array, `path-not-found` when a parent is missing, `invalid-index` for a bad array
 *   segment, or a pointer error.
 */
export function setPointer(document, pointer, value) {
  const segments = parsePointer(pointer);
  if (segments.length === 0) return cloneJson(value);
  const root = cloneJson(document);
  const { parent, key } = locateParent(root, segments, pointer);
  if (Array.isArray(parent)) {
    const index = key === '-' ? parent.length : arrayIndex(key, parent.length, pointer);
    parent[index] = cloneJson(value);
  } else {
    /** @type {Record<string, unknown>} */ (parent)[key] = cloneJson(value);
  }
  return root;
}

/**
 * Removes the value at a pointer and returns the new document. An array element is spliced out,
 * so the elements after it move up.
 * @param {unknown} document JSON value to change. Not mutated.
 * @param {string} pointer RFC 6901 pointer to an existing value; not the empty pointer.
 * @returns {unknown} The new document.
 * @throws {JsonPatchError} `path-not-found` when nothing is there, `not-a-container` when the path
 *   runs through a value that is not an object or array, `invalid-operation` for the empty
 *   pointer, or a pointer error.
 */
export function removePointer(document, pointer) {
  const root = cloneJson(document);
  removeAt(root, parsePointer(pointer), pointer);
  return root;
}

/**
 * Applies an RFC 6902 patch and returns the new document. The input is never mutated, and the
 * patch applies all or nothing: when any operation fails — a failing `test` included — the error
 * is thrown and no partial result exists.
 * @param {unknown} document JSON value to patch. Not mutated.
 * @param {JsonPatchOperation[]} operations Operations, applied in order.
 * @returns {unknown} The patched document.
 * @throws {JsonPatchError} At the first failing operation; its `index` says which.
 */
export function applyPatch(document, operations) {
  if (!Array.isArray(operations)) {
    throw new JsonPatchError('A patch must be an array of operations', 'invalid-operation');
  }
  // One deep copy up front: every operation then works in place on a document nobody else holds.
  let root = cloneJson(document);
  operations.forEach((operation, index) => {
    try {
      root = applyOperation(root, operation);
    } catch (error) {
      if (error instanceof JsonPatchError) {
        error.index = index;
        error.message = `Operation ${index}: ${error.message}`;
      }
      throw error;
    }
  });
  return root;
}

/**
 * Applies one operation in place to a document this module owns, returning the root (which only
 * changes when the operation targets the whole document).
 * @param {unknown} root
 * @param {JsonPatchOperation} operation
 * @returns {unknown}
 */
function applyOperation(root, operation) {
  if (!isObject(operation) || typeof operation.op !== 'string' || !OPERATIONS.has(operation.op)) {
    throw new JsonPatchError('Unknown or missing "op"', 'invalid-operation');
  }
  const { op, path } = operation;
  if (typeof path !== 'string') throw new JsonPatchError(`"${op}" needs a string "path"`, 'invalid-operation');
  const segments = parsePointer(path);
  const needsValue = op === 'add' || op === 'replace' || op === 'test';
  if (needsValue && !Object.hasOwn(operation, 'value')) {
    throw new JsonPatchError(`"${op}" needs a "value"`, 'invalid-operation', path);
  }
  const needsFrom = op === 'move' || op === 'copy';
  if (needsFrom && typeof operation.from !== 'string') {
    throw new JsonPatchError(`"${op}" needs a string "from"`, 'invalid-operation', path);
  }

  switch (op) {
    case 'add':
      return addAt(root, segments, path, cloneJson(operation.value));
    case 'remove':
      removeAt(root, segments, path);
      return root;
    case 'replace':
      if (segments.length === 0) return cloneJson(operation.value);
      if (!hasPointer(root, path)) throw new JsonPatchError(`Nothing to replace at ${path}`, 'path-not-found', path);
      return addAt(root, segments, path, cloneJson(operation.value), true);
    case 'test': {
      if (!hasPointer(root, path)) throw new JsonPatchError(`Nothing to test at ${path}`, 'path-not-found', path);
      if (!jsonEqual(getPointer(root, path), operation.value)) {
        throw new JsonPatchError(`Test failed at ${path}`, 'test-failed', path);
      }
      return root;
    }
    default: {
      const from = /** @type {string} */ (operation.from);
      const source = parsePointer(from);
      if (!hasPointer(root, from)) throw new JsonPatchError(`Nothing to ${op} at ${from}`, 'path-not-found', from);
      if (op === 'copy') return addAt(root, segments, path, cloneJson(getPointer(root, from)));
      if (from === path) return root;
      if (source.length < segments.length && source.every((segment, index) => segment === segments[index])) {
        throw new JsonPatchError(`Cannot move ${from} into its own child ${path}`, 'invalid-operation', path);
      }
      const value = getPointer(root, from);
      removeAt(root, source, from);
      return addAt(root, segments, path, value);
    }
  }
}

/**
 * RFC 6902 `add` (or, with `replace`, an in-place overwrite) on a document this module owns.
 * @param {unknown} root @param {string[]} segments @param {string} pointer @param {unknown} value
 * @param {boolean} [replace=false]
 * @returns {unknown} The root.
 */
function addAt(root, segments, pointer, value, replace = false) {
  if (segments.length === 0) return value;
  const { parent, key } = locateParent(root, segments, pointer);
  if (Array.isArray(parent)) {
    if (replace) parent[arrayIndex(key, parent.length - 1, pointer)] = value;
    else if (key === '-') parent.push(value);
    else parent.splice(arrayIndex(key, parent.length, pointer), 0, value);
  } else {
    /** @type {Record<string, unknown>} */ (parent)[key] = value;
  }
  return root;
}

/** @param {unknown} root @param {string[]} segments @param {string} pointer @returns {void} */
function removeAt(root, segments, pointer) {
  if (segments.length === 0) {
    throw new JsonPatchError('The whole document cannot be removed', 'invalid-operation', pointer);
  }
  const { parent, key } = locateParent(root, segments, pointer);
  if (Array.isArray(parent)) {
    if (!ARRAY_INDEX.test(key) || Number(key) >= parent.length) {
      throw new JsonPatchError(`Nothing to remove at ${pointer}`, 'path-not-found', pointer);
    }
    parent.splice(Number(key), 1);
    return;
  }
  if (!Object.hasOwn(/** @type {object} */ (parent), key)) {
    throw new JsonPatchError(`Nothing to remove at ${pointer}`, 'path-not-found', pointer);
  }
  delete /** @type {Record<string, unknown>} */ (parent)[key];
}

/**
 * Walks to the container holding a pointer's last segment.
 * @param {unknown} root @param {string[]} segments @param {string} pointer
 * @returns {{parent: object, key: string}}
 */
function locateParent(root, segments, pointer) {
  let current = root;
  for (let step = 0; step < segments.length - 1; step += 1) {
    const segment = segments[step];
    const at = formatPointer(segments.slice(0, step + 1));
    if (Array.isArray(current)) {
      if (!ARRAY_INDEX.test(segment) || Number(segment) >= current.length) {
        throw new JsonPatchError(`No array element at ${at}`, 'path-not-found', pointer);
      }
      current = current[Number(segment)];
    } else if (isObject(current)) {
      if (!Object.hasOwn(current, segment)) throw new JsonPatchError(`Nothing at ${at}`, 'path-not-found', pointer);
      current = /** @type {Record<string, unknown>} */ (current)[segment];
    } else {
      throw new JsonPatchError(`The path runs through a value that is not an object at ${at}`,
        'not-a-container', pointer);
    }
  }
  if (!Array.isArray(current) && !isObject(current)) {
    const at = formatPointer(segments.slice(0, -1)) || '(the document)';
    throw new JsonPatchError(`The path runs through a value that is not an object at ${at}`,
      'not-a-container', pointer);
  }
  return { parent: /** @type {object} */ (current), key: segments[segments.length - 1] };
}

/**
 * @param {string} key @param {number} max Highest index allowed. @param {string} pointer
 * @returns {number}
 */
function arrayIndex(key, max, pointer) {
  if (!ARRAY_INDEX.test(key) || Number(key) > max) {
    throw new JsonPatchError(`Not a usable array index at ${pointer}`, 'invalid-index', pointer);
  }
  return Number(key);
}

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Deep-copies a JSON value. Members are defined rather than assigned, so a member that happens to
 * be called `__proto__` stays data and never becomes a prototype.
 * @param {unknown} value
 * @returns {any}
 */
function cloneJson(value) {
  if (Array.isArray(value)) return value.map(cloneJson);
  if (isObject(value)) {
    /** @type {Record<string, unknown>} */
    const copy = {};
    for (const key of Object.keys(value)) {
      Object.defineProperty(copy, key, { value: cloneJson(value[key]), enumerable: true, writable: true, configurable: true });
    }
    return copy;
  }
  return value;
}

/**
 * JSON equality as RFC 6902 `test` defines it: same type, numbers by value, strings by code
 * points, arrays element by element in order, objects by the same members regardless of order.
 * @param {unknown} a @param {unknown} b @returns {boolean}
 */
export function jsonEqual(a, b) {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((entry, index) => jsonEqual(entry, b[index]));
  }
  if (isObject(a) && isObject(b)) {
    const keys = Object.keys(a);
    if (keys.length !== Object.keys(b).length) return false;
    return keys.every((key) => Object.hasOwn(b, key) && jsonEqual(a[key], b[key]));
  }
  return false;
}
