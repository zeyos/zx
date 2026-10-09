import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { isTreeTypeaheadKey } from '../../src/components/tree/tree.js';

/*
 * TreeView's type-ahead claims the keys it uses. Which keys those are is pure; that the claim is
 * made before the search runs is asserted on the source, and the behaviour in the browser.
 */

test('a single printable character without a command modifier is a type-ahead key', () => {
  for (const key of ['a', 'Z', '7', 'ä', '-', '.']) assert.equal(isTreeTypeaheadKey({ key }), true, key);
  assert.equal(isTreeTypeaheadKey({ key: 'A', shiftKey: true }), true, 'Shift only changes the case');
});

test('navigation keys, Space, and shortcuts are left alone', () => {
  for (const key of ['ArrowDown', 'Enter', 'Escape', 'Tab', 'F2', ' ', '', 'Dead']) {
    assert.equal(isTreeTypeaheadKey({ key }), false, JSON.stringify(key));
  }
  for (const modifier of ['ctrlKey', 'metaKey', 'altKey']) {
    assert.equal(isTreeTypeaheadKey({ key: 'a', [modifier]: true }), false, modifier);
  }
  assert.equal(isTreeTypeaheadKey(/** @type {any} */ (null)), false);
});

test('the type-ahead prevents the default action of the keys it consumes', () => {
  const source = readFileSync(new URL('../../src/components/tree/tree.js', import.meta.url), 'utf8');
  assert.match(source,
    /default:[\s\S]*?if \(!isTreeTypeaheadKey\(event\) \|\| isTextEntry\(event\.target\)\) return;\s*event\.preventDefault\(\);\s*this\._handleTypeahead\(event\);/);
});
