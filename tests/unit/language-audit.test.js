import assert from 'node:assert/strict';
import test from 'node:test';
import { libraryEnglish } from '../../tools/check-language.js';

/** @param {string[]} strings @param {string[]} [generated=[]] @param {string[]} [shared=[]] */
function capture(strings, generated = [], shared = []) {
  return { strings: new Set(strings), generated: new Set(generated), shared: new Set(shared) };
}

test('generated preset item names and descriptions explain exact shared text', () => {
  const items = ['English (United Kingdom)', 'Français', 'Französisch', 'Deutschland', 'Customs declaration required', 'TLH'];
  const english = capture(items);
  const german = capture(items, items);
  assert.deepEqual(libraryEnglish(english, german, ''), []);
  // A name is not exempt merely because it looks like a country or language.
  assert.deepEqual(libraryEnglish(english, capture(items), ''), items);
});

test('preset item data does not exempt unchanged English interface prompts', () => {
  const items = ['English (United Kingdom)', 'Deutschland'];
  const prompts = ['Language', 'Choose a language', 'Country', 'Choose a country', 'Loading…', 'No results'];
  const strings = [...items, ...prompts];
  assert.deepEqual(libraryEnglish(capture(strings), capture(strings, items), ''), prompts);
});

test('generated item names are exact matches rather than shared substrings', () => {
  const strings = ['Français', 'Choose Français', 'Français unavailable', 'Deutschland status'];
  assert.deepEqual(libraryEnglish(capture(strings), capture(strings, ['Français', 'Deutschland']), ''), strings.slice(1));
});

test('generated data from the English run alone cannot hide German interface text', () => {
  const strings = ['Choose a country'];
  assert.deepEqual(libraryEnglish(capture(strings, strings), capture(strings), ''), strings);
});

test('date names retain their separate substring exemption', () => {
  const strings = ['November 2026', 'Choose November'];
  assert.deepEqual(libraryEnglish(capture(strings), capture(strings, [], ['November']), ''), ['Choose November']);
});
