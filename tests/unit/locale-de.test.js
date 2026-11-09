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
  ['fileItem.kind.audio', 'shared word'],
  ['fileItem.kind.text', 'shared word'],
  ['fileItem.kind.video', 'shared word'],
  ['filter.conditionNoun', 'shared word'],
  ['kanbanView.assigneeOverflow', 'no words'],
  ['kanbanView.statusLabel', 'shared word'],
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
  ['viewSettings.typeUrl', 'established term'],
  ['zeyosModuleBar.weblets', 'established term']
]);

/**
 * `formatDate()` patterns, not printf templates. German writes them in its own order, so their
 * tokens are not placeholders; `%d.%` would even read as a named one.
 */
const DATE_PATTERNS = new Set([
  'approvalCard.dateTimeFormat', 'approvalCard.fullDateTimeFormat', 'datePicker.dayLabel', 'daterange.dayLabel',
  'daterange.span.day', 'daterange.span.full', 'daterange.span.month', 'runStatus.dateTimeFormat', 'runStatus.timeFormat'
]);

afterEach(() => {
  setTranslator(null);
  setLanguage('en');
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
  assert.equal(formatDate(date, de['daterange.span.full']), '5. März 2026');
  assert.equal(formatDate(date, de['daterange.span.month']), '5. März');
  assert.equal(formatDate(date, de['daterange.span.day']), '5.');
  assert.equal(formatDate(date, de['daterange.dayLabel']), 'Donnerstag, 5. März 2026');
  assert.equal(formatDate(date, de['approvalCard.dateTimeFormat']), '05.03., 09:07');
  assert.equal(formatDate(date, de['approvalCard.fullDateTimeFormat']), '05.03.2026, 09:07');
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
