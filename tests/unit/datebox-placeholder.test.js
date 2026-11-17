import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { placeholderTokens } from '../../src/components/datebox/placeholder.js';
import { defaultMessages } from '../../src/core/messages.js';
import { de } from '../../src/locales/de.js';

/*
 * What a date field's placeholder says for each numeric format token. Datebox replaces every token
 * in `%[demYyHMS]` and DateRangeBox the date subset; both look the token up in this table and keep
 * a token the table does not know.
 */

const TOKENS = {
  '%d': 'datebox.placeholder.day',
  '%e': 'datebox.placeholder.dayShort',
  '%m': 'datebox.placeholder.month',
  '%Y': 'datebox.placeholder.year',
  '%y': 'datebox.placeholder.yearShort',
  '%H': 'datebox.placeholder.hour',
  '%M': 'datebox.placeholder.minute',
  '%S': 'datebox.placeholder.second'
};

test('each numeric format token reads through its own message key', () => {
  const asked = [];
  const tokens = placeholderTokens((key) => { asked.push(key); return `<${key}>`; });
  assert.deepEqual(tokens, Object.fromEntries(Object.entries(TOKENS).map(([token, key]) => [token, `<${key}>`])));
  assert.deepEqual(asked.sort(), Object.values(TOKENS).sort(), 'every key is asked for exactly once');
});

test('the English placeholders are the familiar letters', () => {
  const tokens = placeholderTokens((key) => defaultMessages[key]);
  assert.deepEqual(tokens, {
    '%d': 'DD', '%e': 'D', '%m': 'MM', '%Y': 'YYYY', '%y': 'YY', '%H': 'HH', '%M': 'MM', '%S': 'SS'
  });
});

test('the German placeholders follow the German words: TT for Tag, JJJJ for Jahr', () => {
  const tokens = placeholderTokens((key) => de[key]);
  assert.deepEqual(tokens, {
    '%d': 'TT', '%e': 'T', '%m': 'MM', '%Y': 'JJJJ', '%y': 'JJ', '%H': 'HH', '%M': 'MM', '%S': 'SS'
  });
});

test('every placeholder message exists in both catalogues', () => {
  for (const key of Object.values(TOKENS)) {
    assert.equal(typeof defaultMessages[key], 'string', `${key} has no English text`);
    assert.ok(defaultMessages[key].length > 0);
    assert.equal(typeof de[key], 'string', `${key} has no German text`);
    assert.ok(de[key].length > 0);
  }
});

test('the table is built afresh each call, from whatever the resolver answers', () => {
  const first = placeholderTokens(() => 'x');
  const second = placeholderTokens(() => 'x');
  assert.notEqual(first, second, 'a caller may change its copy without touching another field’s');
  first['%d'] = 'changed';
  assert.equal(second['%d'], 'x');
  // A resolver with no answer leaves the gap visible rather than inventing text.
  assert.deepEqual(Object.values(placeholderTokens(() => /** @type {any} */ (undefined))), Array(8).fill(undefined));
});

test('a token the table does not cover is kept by the substitution the fields run', () => {
  const tokens = placeholderTokens((key) => defaultMessages[key]);
  // The exact replacement Datebox runs over its format string.
  const placeholder = (format) => format.replace(/%[demYyHMS]/g, (token) => tokens[token] ?? token);
  assert.equal(placeholder('%d.%m.%Y %H:%M:%S'), 'DD.MM.YYYY HH:MM:SS');
  assert.equal(placeholder('%e/%m/%y'), 'D/MM/YY');
  assert.equal(placeholder('%A, %d %B'), '%A, DD %B', 'textual tokens stay as they are');
  assert.equal(placeholder(''), '');
});

test('the tokens the fields substitute are exactly the tokens the table covers', () => {
  const source = (path) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
  const datebox = source('../../src/components/datebox/datebox.js');
  const range = source('../../src/components/datebox/date-range-box.js');
  const covered = new Set(Object.keys(TOKENS).map((token) => token[1]));
  const letters = (pattern) => new Set([...pattern]);
  // The character class of the replacement that looks its tokens up in this table.
  const substituted = (text) => /\.replace\(\/%\[([A-Za-z]+)\]\/g, \(token\) => tokens\[token\]/.exec(text)?.[1];

  const dateboxPattern = substituted(datebox);
  assert.ok(dateboxPattern, 'Datebox substitutes placeholder tokens');
  assert.deepEqual(letters(dateboxPattern), covered, 'Datebox replaces every token the table knows');

  const rangePattern = substituted(range);
  assert.ok(rangePattern, 'DateRangeBox substitutes placeholder tokens');
  for (const letter of rangePattern) assert.ok(covered.has(letter), `%${letter} has a placeholder`);
});
