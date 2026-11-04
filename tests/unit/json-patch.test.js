import assert from 'node:assert/strict';
import test from 'node:test';

import {
  JsonPatchError, applyPatch, formatPointer, getPointer, hasPointer, jsonEqual, parsePointer,
  removePointer, setPointer
} from '../../src/internal/json-patch.js';

/**
 * Applies a patch and checks the input came through untouched.
 * @param {unknown} document @param {any[]} patch @returns {unknown}
 */
function patched(document, patch) {
  const before = JSON.stringify(document);
  const result = applyPatch(document, patch);
  assert.equal(JSON.stringify(document), before, 'the input document was mutated');
  return result;
}

/** @param {string} code @returns {(error: unknown) => boolean} */
const fails = (code) => (error) => error instanceof JsonPatchError && error.code === code;

// RFC 6901 §5: the example document and every pointer it lists.
const RFC6901 = { foo: ['bar', 'baz'], '': 0, 'a/b': 1, 'c%d': 2, 'e^f': 3, 'g|h': 4, 'i\\j': 5, 'k"l': 6, ' ': 7, 'm~n': 8 };

test('getPointer resolves every RFC 6901 example', () => {
  assert.deepEqual(getPointer(RFC6901, ''), RFC6901);
  assert.deepEqual(getPointer(RFC6901, '/foo'), ['bar', 'baz']);
  assert.equal(getPointer(RFC6901, '/foo/0'), 'bar');
  assert.equal(getPointer(RFC6901, '/'), 0);
  assert.equal(getPointer(RFC6901, '/a~1b'), 1);
  assert.equal(getPointer(RFC6901, '/c%d'), 2);
  assert.equal(getPointer(RFC6901, '/e^f'), 3);
  assert.equal(getPointer(RFC6901, '/g|h'), 4);
  assert.equal(getPointer(RFC6901, '/i\\j'), 5);
  assert.equal(getPointer(RFC6901, '/k"l'), 6);
  assert.equal(getPointer(RFC6901, '/ '), 7);
  assert.equal(getPointer(RFC6901, '/m~0n'), 8);
});

test('getPointer reads a missing path, a scalar path and "-" as undefined', () => {
  assert.equal(getPointer(RFC6901, '/nope'), undefined);
  assert.equal(getPointer(RFC6901, '/foo/2'), undefined);
  assert.equal(getPointer(RFC6901, '/foo/-'), undefined);
  assert.equal(getPointer(RFC6901, '/foo/01'), undefined);
  assert.equal(getPointer(RFC6901, '/foo/0/x'), undefined);
  assert.equal(getPointer({ a: { toString: 1 } }, '/a/hasOwnProperty'), undefined, 'inherited members are not read');
  assert.equal(hasPointer({ a: null }, '/a'), true);
  assert.equal(hasPointer({ a: null }, '/b'), false);
});

test('pointer escapes unescape ~1 before ~0, and format inverts parse', () => {
  assert.deepEqual(parsePointer('/~01'), ['~1']);
  assert.deepEqual(parsePointer('/~10'), ['/0']);
  assert.deepEqual(parsePointer(''), []);
  assert.deepEqual(parsePointer('/'), ['']);
  for (const segments of [['~1'], ['a/b', 'm~n'], [''], ['x', '0', '-']]) {
    assert.deepEqual(parsePointer(formatPointer(segments)), segments);
  }
  assert.equal(formatPointer(['a/b', 'm~n', 3]), '/a~1b/m~0n/3');
});

test('malformed pointers are refused', () => {
  assert.throws(() => parsePointer('foo'), fails('invalid-pointer'));
  assert.throws(() => parsePointer('/a~2'), fails('invalid-pointer'));
  assert.throws(() => parsePointer('/a~'), fails('invalid-pointer'));
  assert.throws(() => parsePointer(/** @type {any} */ (7)), fails('invalid-pointer'));
  assert.throws(() => getPointer({}, 'foo'), fails('invalid-pointer'));
});

test('__proto__, constructor and prototype segments are refused everywhere', () => {
  for (const segment of ['__proto__', 'constructor', 'prototype']) {
    assert.throws(() => getPointer({}, `/${segment}`), fails('forbidden-segment'));
    assert.throws(() => getPointer({}, `/a/${segment}/b`), fails('forbidden-segment'));
    assert.throws(() => setPointer({}, `/${segment}/polluted`, true), fails('forbidden-segment'));
    assert.throws(() => removePointer({ a: 1 }, `/${segment}`), fails('forbidden-segment'));
    for (const op of ['add', 'replace', 'test']) {
      assert.throws(() => applyPatch({}, [{ op, path: `/${segment}/polluted`, value: true }]), fails('forbidden-segment'));
    }
    assert.throws(() => applyPatch({ a: 1 }, [{ op: 'copy', from: `/${segment}`, path: '/a' }]), fails('forbidden-segment'));
  }
  assert.equal(/** @type {any} */ ({}).polluted, undefined);
  assert.equal(/** @type {any} */ (Object.prototype).polluted, undefined);
});

test('a "__proto__" member inside a value stays data', () => {
  const value = JSON.parse('{"__proto__": {"polluted": true}}');
  const result = /** @type {any} */ (applyPatch({}, [{ op: 'add', path: '/x', value }]));
  assert.ok(Object.hasOwn(result.x, '__proto__'));
  assert.equal(Object.getPrototypeOf(result.x), Object.prototype);
  assert.equal(result.x.polluted, undefined);
});

// RFC 6902 Appendix A, in order.
test('A.1 adding an object member', () => {
  assert.deepEqual(patched({ foo: 'bar' }, [{ op: 'add', path: '/baz', value: 'qux' }]), { baz: 'qux', foo: 'bar' });
});

test('A.2 adding an array element', () => {
  assert.deepEqual(patched({ foo: ['bar', 'baz'] }, [{ op: 'add', path: '/foo/1', value: 'qux' }]),
    { foo: ['bar', 'qux', 'baz'] });
});

test('A.3 removing an object member', () => {
  assert.deepEqual(patched({ baz: 'qux', foo: 'bar' }, [{ op: 'remove', path: '/baz' }]), { foo: 'bar' });
});

test('A.4 removing an array element', () => {
  assert.deepEqual(patched({ foo: ['bar', 'qux', 'baz'] }, [{ op: 'remove', path: '/foo/1' }]), { foo: ['bar', 'baz'] });
});

test('A.5 replacing a value', () => {
  assert.deepEqual(patched({ baz: 'qux', foo: 'bar' }, [{ op: 'replace', path: '/baz', value: 'boo' }]),
    { baz: 'boo', foo: 'bar' });
});

test('A.6 moving a value', () => {
  const document = { foo: { bar: 'baz', waldo: 'fred' }, qux: { corge: 'grault' } };
  assert.deepEqual(patched(document, [{ op: 'move', from: '/foo/waldo', path: '/qux/thud' }]),
    { foo: { bar: 'baz' }, qux: { corge: 'grault', thud: 'fred' } });
});

test('A.7 moving an array element', () => {
  assert.deepEqual(patched({ foo: ['all', 'grass', 'cows', 'eat'] }, [{ op: 'move', from: '/foo/1', path: '/foo/3' }]),
    { foo: ['all', 'cows', 'eat', 'grass'] });
});

test('A.8 testing a value: success', () => {
  const document = { baz: 'qux', foo: ['a', 2, 'c'] };
  assert.deepEqual(patched(document, [
    { op: 'test', path: '/baz', value: 'qux' },
    { op: 'test', path: '/foo/1', value: 2 }
  ]), document);
});

test('A.9 testing a value: error, and the patch applies all or nothing', () => {
  const document = { baz: 'qux' };
  assert.throws(() => patched(document, [{ op: 'test', path: '/baz', value: 'bar' }]), fails('test-failed'));
  assert.throws(() => patched(document, [
    { op: 'add', path: '/added', value: 1 },
    { op: 'replace', path: '/baz', value: 'changed' },
    { op: 'test', path: '/baz', value: 'qux' }
  ]), (error) => fails('test-failed')(error) && /** @type {JsonPatchError} */ (error).index === 2);
  assert.deepEqual(document, { baz: 'qux' });
});

test('A.10 adding a nested member object', () => {
  assert.deepEqual(patched({ foo: 'bar' }, [{ op: 'add', path: '/child', value: { grandchild: {} } }]),
    { foo: 'bar', child: { grandchild: {} } });
});

test('A.11 ignoring unrecognized elements', () => {
  assert.deepEqual(patched({ foo: 'bar' }, [{ op: 'add', path: '/baz', value: 'qux', xyz: 123 }]),
    { foo: 'bar', baz: 'qux' });
});

test('A.12 adding to a nonexistent target', () => {
  assert.throws(() => patched({ foo: 'bar' }, [{ op: 'add', path: '/baz/bat', value: 'qux' }]), fails('path-not-found'));
});

test('A.14 ~ escape ordering', () => {
  const document = { '/': 9, '~1': 10 };
  assert.deepEqual(patched(document, [{ op: 'test', path: '/~01', value: 10 }]), document);
});

test('A.15 comparing strings and numbers', () => {
  assert.throws(() => patched({ '/': 9, '~1': 10 }, [{ op: 'test', path: '/~01', value: '10' }]), fails('test-failed'));
});

test('A.16 adding an array value, and "-" appends', () => {
  assert.deepEqual(patched({ foo: ['bar'] }, [{ op: 'add', path: '/foo/-', value: ['abc', 'def'] }]),
    { foo: ['bar', ['abc', 'def']] });
});

test('copy duplicates without sharing, and the whole document can be added or replaced', () => {
  const result = /** @type {any} */ (patched({ a: { b: 1 } }, [{ op: 'copy', from: '/a', path: '/c' }]));
  assert.deepEqual(result, { a: { b: 1 }, c: { b: 1 } });
  assert.notEqual(result.a, result.c);
  assert.deepEqual(patched({ a: 1 }, [{ op: 'add', path: '', value: [1] }]), [1]);
  assert.deepEqual(patched({ a: 1 }, [{ op: 'replace', path: '', value: { b: 2 } }]), { b: 2 });
});

test('the result shares nothing with the input or the operation values', () => {
  const document = { list: [{ id: 1 }] };
  const value = { id: 2 };
  const result = /** @type {any} */ (applyPatch(document, [{ op: 'add', path: '/list/-', value }]));
  assert.notEqual(result.list, document.list);
  assert.notEqual(result.list[0], document.list[0]);
  assert.notEqual(result.list[1], value);
});

test('test compares objects regardless of member order and arrays in order', () => {
  assert.equal(jsonEqual({ a: 1, b: [1, 2] }, { b: [1, 2], a: 1 }), true);
  assert.equal(jsonEqual([1, 2], [2, 1]), false);
  assert.equal(jsonEqual(null, {}), false);
  assert.equal(jsonEqual({ a: 1 }, { a: 1, b: 2 }), false);
});

test('patch errors: malformed operations, missing targets, bad indexes, moves into a child', () => {
  assert.throws(() => applyPatch({}, /** @type {any} */ ({})), fails('invalid-operation'));
  assert.throws(() => applyPatch({}, [/** @type {any} */ ({ op: 'merge', path: '/a' })]), fails('invalid-operation'));
  assert.throws(() => applyPatch({}, [/** @type {any} */ ({ op: 'add' })]), fails('invalid-operation'));
  assert.throws(() => applyPatch({}, [/** @type {any} */ ({ op: 'add', path: '/a' })]), fails('invalid-operation'));
  assert.throws(() => applyPatch({ a: 1 }, [/** @type {any} */ ({ op: 'move', path: '/b' })]), fails('invalid-operation'));
  assert.throws(() => applyPatch({}, [{ op: 'remove', path: '/a' }]), fails('path-not-found'));
  assert.throws(() => applyPatch({}, [{ op: 'replace', path: '/a', value: 1 }]), fails('path-not-found'));
  assert.throws(() => applyPatch({}, [{ op: 'move', from: '/a', path: '/b' }]), fails('path-not-found'));
  assert.throws(() => applyPatch({ a: [] }, [{ op: 'add', path: '/a/1', value: 1 }]), fails('invalid-index'));
  assert.throws(() => applyPatch({ a: [] }, [{ op: 'add', path: '/a/01', value: 1 }]), fails('invalid-index'));
  assert.throws(() => applyPatch({ a: [1] }, [{ op: 'replace', path: '/a/-', value: 1 }]), fails('path-not-found'));
  assert.throws(() => applyPatch({ a: 'text' }, [{ op: 'add', path: '/a/b', value: 1 }]), fails('not-a-container'));
  assert.throws(() => applyPatch({ a: { b: {} } }, [{ op: 'move', from: '/a', path: '/a/b/c' }]), fails('invalid-operation'));
  assert.throws(() => applyPatch({}, [{ op: 'remove', path: '' }]), fails('invalid-operation'));
  assert.deepEqual(applyPatch({ a: 1 }, [{ op: 'move', from: '/a', path: '/a' }]), { a: 1 });
});

test('setPointer creates, replaces and appends, and reports a path through a non-object', () => {
  const document = { list: [1, 2], name: 'x' };
  assert.deepEqual(setPointer(document, '/name', 'y'), { list: [1, 2], name: 'y' });
  assert.deepEqual(setPointer(document, '/added', { z: 1 }), { list: [1, 2], name: 'x', added: { z: 1 } });
  assert.deepEqual(setPointer(document, '/list/0', 9), { list: [9, 2], name: 'x' });
  assert.deepEqual(setPointer(document, '/list/2', 3), { list: [1, 2, 3], name: 'x' });
  assert.deepEqual(setPointer(document, '/list/-', 3), { list: [1, 2, 3], name: 'x' });
  assert.deepEqual(setPointer(document, '', [1]), [1]);
  assert.deepEqual(document, { list: [1, 2], name: 'x' });
  assert.throws(() => setPointer(document, '/name/first', 'y'), fails('not-a-container'));
  assert.throws(() => setPointer(document, '/missing/first', 'y'), fails('path-not-found'));
  assert.throws(() => setPointer(document, '/list/5', 3), fails('invalid-index'));
  assert.throws(() => setPointer(null, '/a', 1), fails('not-a-container'));
});

test('removePointer removes members and splices elements', () => {
  const document = { list: [1, 2, 3], name: 'x' };
  assert.deepEqual(removePointer(document, '/name'), { list: [1, 2, 3] });
  assert.deepEqual(removePointer(document, '/list/1'), { list: [1, 3], name: 'x' });
  assert.deepEqual(document, { list: [1, 2, 3], name: 'x' });
  assert.throws(() => removePointer(document, '/missing'), fails('path-not-found'));
  assert.throws(() => removePointer(document, '/name/x'), fails('not-a-container'));
});
