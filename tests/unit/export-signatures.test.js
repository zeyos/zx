import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

/**
 * Every exported function under `src/` with the positional parameters it declared in the last
 * release. An exported function is passed around as a value (`files.map(normalizeFileItem)`), so a
 * caller can reach a new positional parameter without knowing it exists, and `index` or the array
 * then lands in it. A component that needs more than the public function takes calls an internal
 * one instead.
 * @type {Record<string, Record<string, number>>}
 */
const RELEASED = JSON.parse(readFileSync(new URL('./fixtures/export-parameters.json', import.meta.url), 'utf8'));

/**
 * The deliberate exceptions. Each is an options bag that reads a named property, which a stray
 * array index or array cannot be mistaken for.
 * @type {Record<string, number>}
 */
const OPTION_BAGS = { 'core/date.js#formatDate': 3 };

/**
 * Counts the parameters declared in a list that opens at `open`, so a default holding a comma, a
 * destructured parameter, or a parameter with a default all count once. `Function.length` stops at
 * the first default, which is exactly the kind of parameter this has to see.
 * @param {string} source Module source.
 * @param {number} open Index of the list's opening parenthesis.
 * @returns {number}
 */
function declaredParameters(source, open) {
  let depth = 0;
  let commas = 0;
  let filled = false;
  let quote = null;
  for (let index = open; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (char === '\\') index += 1;
      else if (char === quote) quote = null;
    } else if (char === '"' || char === "'" || char === '`') {
      quote = char;
      filled = true;
    } else if ('([{'.includes(char)) {
      depth += 1;
      if (depth > 1) filled = true;
    } else if (')]}'.includes(char)) {
      depth -= 1;
      if (depth === 0) return commas + (filled ? 1 : 0);
    } else if (char === ',' && depth === 1) {
      commas += 1;
      filled = false;
    } else if (!/\s/.test(char)) {
      filled = true;
    }
  }
  throw new Error('Unbalanced parameter list');
}

/**
 * @param {string} file Path under `src/`.
 * @returns {Map<string, number>} Exported function name to declared parameters.
 */
function exportedFunctions(file) {
  const source = readFileSync(new URL(`../../src/${file}`, import.meta.url), 'utf8');
  return new Map([...source.matchAll(/^export (?:async )?function\*? ?(\w+)\s*\(/gm)]
    .map((match) => [match[1], declaredParameters(source, match.index + match[0].length - 1)]));
}

test('the parameter count sees what Function.length does not', () => {
  const count = (list) => declaredParameters(`function f${list} {}`, 'function f'.length);
  assert.equal(count('()'), 0);
  assert.equal(count('(a)'), 1);
  assert.equal(count('(a = {}, b = "x, y")'), 2);
  assert.equal(count('({ a, b } = {}, [c, d] = [1, 2], e = f(1, 2))'), 3);
  assert.equal(count('(a, b,\n)'), 2);
});

test('no exported function has lost or changed a positional parameter since the last release', () => {
  const changed = [];
  for (const [file, functions] of Object.entries(RELEASED)) {
    assert.ok(existsSync(new URL(`../../src/${file}`, import.meta.url)), `src/${file} is gone`);
    const current = exportedFunctions(file);
    for (const [name, released] of Object.entries(functions)) {
      const key = `${file}#${name}`;
      const expected = OPTION_BAGS[key] ?? released;
      if (current.get(name) !== expected) changed.push(`${key}: ${released} → ${current.get(name) ?? 'gone'}`);
    }
  }
  assert.deepEqual(changed, []);
});
