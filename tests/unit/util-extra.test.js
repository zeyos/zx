import assert from 'node:assert/strict';
import test from 'node:test';

import { escapeRegExp, groupBy, sortBy, throttle, uniqueBy } from '../../src/core/util.js';

/** @param {number} ms Milliseconds to wait. @returns {Promise<void>} */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Throttle windows are deliberately short but every wait is three times the interval, so a slow
 * machine cannot turn a timing assertion into a flake.
 */
const INTERVAL = 40;
const SETTLE = 120;

test('throttle fires on both edges by default', async () => {
  const calls = [];
  const throttled = throttle((value) => calls.push(value), INTERVAL);

  throttled('a');
  throttled('b');
  throttled('c');
  // The leading call runs immediately; the burst collapses into one trailing call.
  assert.deepEqual(calls, ['a']);
  await sleep(SETTLE);
  assert.deepEqual(calls, ['a', 'c']);
});

test('throttle with trailing: false runs only the leading call of each window', async () => {
  const calls = [];
  const throttled = throttle((value) => calls.push(value), INTERVAL, { trailing: false });

  throttled('a');
  throttled('b');
  throttled('c');
  assert.deepEqual(calls, ['a']);
  await sleep(SETTLE);
  // Nothing is replayed when the window closes.
  assert.deepEqual(calls, ['a']);
  // The next call opens a fresh window and runs at once.
  throttled('d');
  assert.deepEqual(calls, ['a', 'd']);
});

test('throttle with leading: false runs only the trailing call', async () => {
  const calls = [];
  const throttled = throttle((value) => calls.push(value), INTERVAL, { leading: false });

  throttled('a');
  throttled('b');
  throttled('c');
  assert.deepEqual(calls, []);
  await sleep(SETTLE);
  assert.deepEqual(calls, ['c']);
});

test('throttle replays the latest arguments and context on the trailing edge', async () => {
  const calls = [];
  const context = { name: 'context' };
  const throttled = throttle(function (value) {
    calls.push([this.name, value]);
  }, INTERVAL);

  throttled.call(context, 1);
  throttled.call(context, 2);
  throttled.call(context, 3);
  await sleep(SETTLE);
  assert.deepEqual(calls, [['context', 1], ['context', 3]]);
});

test('groupBy groups by a property name in first-appearance order', () => {
  const people = [
    { name: 'bob', dept: 'eng' },
    { name: 'amy', dept: 'ops' },
    { name: 'cid', dept: 'eng' }
  ];
  const grouped = groupBy(people, 'dept');
  assert.deepEqual(Object.keys(grouped), ['eng', 'ops']);
  assert.deepEqual(grouped.eng.map((p) => p.name), ['bob', 'cid']);
  assert.deepEqual(grouped.ops.map((p) => p.name), ['amy']);
});

test('groupBy groups by an accessor function', () => {
  const grouped = groupBy([1, 2, 3, 4, 5], (n) => (n % 2 === 0 ? 'even' : 'odd'));
  assert.deepEqual(grouped, { odd: [1, 3, 5], even: [2, 4] });
});

test('groupBy returns a plain object even for a __proto__ group', () => {
  const grouped = groupBy([{ key: '__proto__' }, { key: 'safe' }], 'key');
  assert.equal(Object.getPrototypeOf(grouped), Object.prototype);
  assert.deepEqual(Object.keys(grouped), ['__proto__', 'safe']);
  assert.equal(Object.getOwnPropertyDescriptor(grouped, '__proto__').value.length, 1);
});

test('groupBy tolerates empty and nullish input', () => {
  assert.deepEqual(groupBy([], 'id'), {});
  assert.deepEqual(groupBy(null, 'id'), {});
  assert.deepEqual(groupBy(undefined, 'id'), {});
});

test('sortBy sorts ascending by a property name and returns a new array', () => {
  const input = [{ n: 'b' }, { n: 'a' }, { n: 'c' }];
  const sorted = sortBy(input, 'n');
  assert.deepEqual(sorted.map((o) => o.n), ['a', 'b', 'c']);
  // The input array keeps its original order and identity.
  assert.deepEqual(input.map((o) => o.n), ['b', 'a', 'c']);
  assert.notEqual(sorted, input);
});

test("sortBy reads a '-' prefix as descending", () => {
  const input = [{ n: 'b' }, { n: 'a' }, { n: 'c' }];
  assert.deepEqual(sortBy(input, '-n').map((o) => o.n), ['c', 'b', 'a']);
  assert.deepEqual(sortBy(input, '+n').map((o) => o.n), ['a', 'b', 'c']);
});

test('sortBy accepts the {key, dir} descriptor form', () => {
  const input = [{ n: 'b' }, { n: 'a' }, { n: 'c' }];
  assert.deepEqual(sortBy(input, { key: 'n', dir: 'desc' }).map((o) => o.n), ['c', 'b', 'a']);
  assert.deepEqual(sortBy(input, { key: 'n', dir: 'asc' }).map((o) => o.n), ['a', 'b', 'c']);
  assert.deepEqual(sortBy(input, { key: 'n' }).map((o) => o.n), ['a', 'b', 'c']);
});

test('sortBy applies several keys in order and mixes directions', () => {
  const rows = [
    { dept: 'ops', name: 'bob' },
    { dept: 'eng', name: 'cid' },
    { dept: 'ops', name: 'amy' },
    { dept: 'eng', name: 'amy' }
  ];
  assert.deepEqual(
    sortBy(rows, 'dept', 'name').map((r) => `${r.dept}:${r.name}`),
    ['eng:amy', 'eng:cid', 'ops:amy', 'ops:bob']
  );
  assert.deepEqual(
    sortBy(rows, '-dept', 'name').map((r) => `${r.dept}:${r.name}`),
    ['ops:amy', 'ops:bob', 'eng:amy', 'eng:cid']
  );
});

test('sortBy accepts an accessor function as a key', () => {
  const input = [{ v: 3 }, { v: 1 }, { v: 2 }];
  assert.deepEqual(sortBy(input, (row) => row.v).map((o) => o.v), [1, 2, 3]);
});

test('sortBy places null, undefined, and NaN last in both directions', () => {
  const rows = [{ a: 3 }, { a: null }, { a: 1 }, { a: undefined }, { a: NaN }, { a: 2 }];
  const present = (list) => list.map((r) => r.a).filter((v) => typeof v === 'number' && !Number.isNaN(v));
  const ascending = sortBy(rows, 'a');
  const descending = sortBy(rows, '-a');

  assert.deepEqual(present(ascending), [1, 2, 3]);
  assert.deepEqual(present(descending), [3, 2, 1]);
  // Whatever the direction, the three empty values occupy the last three slots.
  for (const list of [ascending, descending]) {
    const tail = list.slice(3).map((r) => r.a);
    assert.equal(tail.length, 3);
    for (const value of tail) {
      assert.ok(value == null || Number.isNaN(value), `expected an empty value, got ${value}`);
    }
  }
});

test('sortBy compares digit runs numerically and dates chronologically', () => {
  const names = [{ n: 'item10' }, { n: 'item2' }, { n: 'item1' }];
  assert.deepEqual(sortBy(names, 'n').map((o) => o.n), ['item1', 'item2', 'item10']);

  const dates = [
    { at: new Date('2026-03-01') },
    { at: new Date('2024-01-01') },
    { at: new Date('2025-02-01') }
  ];
  assert.deepEqual(
    sortBy(dates, 'at').map((o) => o.at.getUTCFullYear()),
    [2024, 2025, 2026]
  );
});

test('uniqueBy keeps the first occurrence of each key', () => {
  const rows = [
    { id: 1, tag: 'first' },
    { id: 2, tag: 'second' },
    { id: 1, tag: 'duplicate' }
  ];
  assert.deepEqual(uniqueBy(rows, 'id').map((r) => r.tag), ['first', 'second']);
});

test('uniqueBy compares the items themselves when no key is given', () => {
  assert.deepEqual(uniqueBy([1, 2, 2, 3, 1]), [1, 2, 3]);
  assert.deepEqual(uniqueBy(['a', 'a', 'b']), ['a', 'b']);
});

test('uniqueBy accepts an accessor function', () => {
  assert.deepEqual(uniqueBy(['Apple', 'apple', 'Bee'], (s) => s.toLowerCase()), ['Apple', 'Bee']);
});

test('uniqueBy returns a new array and tolerates nullish input', () => {
  const input = [1, 2];
  assert.notEqual(uniqueBy(input), input);
  assert.deepEqual(uniqueBy(null), []);
  assert.deepEqual(uniqueBy(undefined), []);
});

test('escapeRegExp escapes every regular-expression metacharacter', () => {
  assert.equal(escapeRegExp('a.b'), 'a\\.b');
  assert.equal(escapeRegExp('1+1'), '1\\+1');
  assert.equal(escapeRegExp('(a|b)[c]{d}'), '\\(a\\|b\\)\\[c\\]\\{d\\}');
  assert.equal(escapeRegExp('^a$'), '\\^a\\$');
  assert.equal(escapeRegExp('a\\b'), 'a\\\\b');
});

test('escapeRegExp round-trips through new RegExp as a literal pattern', () => {
  const needle = 'price: 1.5 (USD) [net] +tax?';
  const pattern = new RegExp(escapeRegExp(needle));
  assert.ok(pattern.test(`the price: 1.5 (USD) [net] +tax? here`));
  // The escaped dot must not behave as the any-character wildcard.
  assert.equal(new RegExp(escapeRegExp('a.c')).test('abc'), false);
  assert.equal(new RegExp(escapeRegExp('a.c')).test('a.c'), true);
});

test('escapeRegExp coerces non-string values', () => {
  assert.equal(escapeRegExp(42), '42');
  assert.equal(escapeRegExp(null), 'null');
});
