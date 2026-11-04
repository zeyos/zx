import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';

import { formatDate } from '../../src/core/date.js';
import { printf, setLanguage, setTranslator, translate } from '../../src/core/i18n.js';
import { defaultMessages } from '../../src/core/messages.js';
import { de } from '../../src/locales/de.js';

/*
 * The German catalogue is complete or this file fails: a new English key needs its German text in
 * the same change, and German never quietly drifts from the placeholders a component fills.
 */

/**
 * Entries that read the same in German: shared words and established software terms, and texts
 * that hold no language at all. Translating one of them fails too, so the list stays true.
 */
const SAME_AS_ENGLISH = new Map([
  ['agent.activity.offline', 'shared word'],
  ['agentThread.agent', 'shared word'],
  ['appSidebar.itemBadge', 'no words'],
  ['blockView.code', 'established term'],
  ['datebox.placeholder.hour', 'no words'],
  ['datebox.placeholder.minute', 'no words'],
  ['datebox.placeholder.month', 'no words'],
  ['datebox.placeholder.second', 'no words'],
  ['dialog.ok', 'shared word'],
  ['filter.conditionNoun', 'shared word'],
  ['listToolbar.toolBadge', 'no words'],
  ['listToolbar.viewBoard', 'established term'],
  ['moduleBar.itemBadge', 'no words'],
  ['runStatus.timeFormat', 'no words'],
  ['runStatus.tokens', 'established term'],
  ['runTrace.doing', 'no words'],
  ['status.backlog', 'established term'],
  ['stepper.optional', 'shared word'],
  ['timePicker.minute', 'shared word'],
  ['viewSettings.board', 'established term'],
  ['viewSettings.typeStatus', 'shared word'],
  ['viewSettings.typeTags', 'established term'],
  ['viewSettings.typeText', 'shared word'],
  ['viewSettings.typeUrl', 'established term']
]);

/**
 * `formatDate()` patterns, not printf templates. German writes them in its own order, so their
 * tokens are not placeholders; `%d.%` would even read as a named one.
 */
const DATE_PATTERNS = new Set(['datePicker.dayLabel', 'runStatus.dateTimeFormat', 'runStatus.timeFormat']);

/**
 * The placeholders `printf()` fills, sorted, so a repeated or a dropped one shows.
 * @param {string} text
 * @returns {string[]}
 */
function placeholders(text) {
  return [...text.matchAll(/%\d+|%[A-Za-z_][\w.-]*%/g)].map((match) => match[0]).sort();
}

afterEach(() => {
  setTranslator(null);
  setLanguage('en');
});

test('the keys are those of the English catalogue, in its order', () => {
  const english = Object.keys(defaultMessages);
  const german = Object.keys(de);
  assert.deepEqual(english.filter((key) => !Object.hasOwn(de, key)), [], 'missing from src/locales/de.js');
  assert.deepEqual(german.filter((key) => !Object.hasOwn(defaultMessages, key)), [], 'not in defaultMessages');
  assert.deepEqual(german, english);
});

test('the catalogue is frozen and every entry has text', () => {
  assert.ok(Object.isFrozen(de));
  for (const [key, text] of Object.entries(de)) {
    assert.equal(typeof text, 'string', key);
    assert.notEqual(text.trim(), '', key);
  }
});

test('every entry keeps the placeholders of its English text', () => {
  for (const [key, english] of Object.entries(defaultMessages)) {
    if (DATE_PATTERNS.has(key)) continue;
    assert.deepEqual(placeholders(de[key] ?? ''), placeholders(english), key);
  }
});

test('only the listed entries read the same as the English text', () => {
  const same = Object.keys(de).filter((key) => de[key] === defaultMessages[key]);
  assert.deepEqual(same.sort(), [...SAME_AS_ENGLISH.keys()].sort());
});

test('date patterns read as German dates and survive interpolation', () => {
  setLanguage('de');
  const date = new Date(2026, 2, 5, 9, 7);
  assert.equal(formatDate(date, de['runStatus.dateTimeFormat']), '05.03., 09:07');
  assert.equal(formatDate(date, de['runStatus.timeFormat']), '09:07');
  assert.equal(formatDate(date, de['datePicker.dayLabel']), '5. März 2026');
  for (const key of DATE_PATTERNS) assert.equal(printf(de[key], []), de[key], key);
});

test('the typography is German', () => {
  for (const [key, text] of Object.entries(de)) {
    assert.doesNotMatch(text, /\.\.\.|["'”—]/, key);
    assert.equal(text.split('„').length, text.split('“').length, `${key}: quotes open with „ and close with “`);
    assert.doesNotMatch(text, / …/, `${key}: the ellipsis follows its word`);
    assert.doesNotMatch(text, /(?:\d|%\d) [A-ZÄÖÜ%]/, `${key}: a number keeps its unit through a no-break space`);
  }
});

test('the address is formal', () => {
  for (const [key, text] of Object.entries(de)) {
    assert.doesNotMatch(text, /\b(?:du|dich|dir|dein\w*)\b/i, key);
  }
});

test('installed through the translator, it answers every key', () => {
  setTranslator((key) => de[key]);
  setLanguage('de');
  for (const key of Object.keys(defaultMessages)) assert.equal(translate(key), de[key], key);
  assert.equal(translate('pagination.summary', [1, 25, 300]), '1–25 von 300');
  assert.equal(translate('filter.fieldValueAt', ['Betrag', 2]), 'Wert 2 für Betrag');
});
