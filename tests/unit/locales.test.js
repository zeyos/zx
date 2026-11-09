import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultMessages } from '../../src/core/messages.js';
import { en, locales } from '../../src/locales/index.js';

const DATE_PATTERNS = new Set([
  'approvalCard.dateTimeFormat', 'approvalCard.fullDateTimeFormat', 'datePicker.dayLabel', 'daterange.dayLabel',
  'daterange.span.day', 'daterange.span.full', 'daterange.span.month', 'runStatus.dateTimeFormat', 'runStatus.timeFormat'
]);
const placeholders = (text) => [...text.matchAll(/%\d+|%[A-Za-z_][\w.-]*%/g)].map((match) => match[0]).sort();

test('the opt-in locale manifest reuses the English catalogue and is frozen', () => {
  assert.equal(en, defaultMessages);
  assert.equal(locales.en, defaultMessages);
  assert.ok(Object.isFrozen(locales));
});

for (const [locale, catalogue] of Object.entries(locales)) {
  test(`${locale} has every English key, in catalogue order, and frozen nonempty text`, () => {
    assert.deepEqual(Object.keys(catalogue), Object.keys(defaultMessages));
    assert.ok(Object.isFrozen(catalogue));
    for (const [key, text] of Object.entries(catalogue)) {
      assert.equal(typeof text, 'string', key);
      assert.notEqual(text.trim(), '', key);
    }
  });
  test(`${locale} keeps interpolation placeholders, including every plural variant`, () => {
    for (const [key, english] of Object.entries(defaultMessages)) {
      if (!DATE_PATTERNS.has(key)) assert.deepEqual(placeholders(catalogue[key]), placeholders(english), key);
      if (/\.(?:zero|one|two|few|many)$/.test(key) && Object.hasOwn(catalogue, key.replace(/\.[^.]+$/, ''))) {
        const base = key.replace(/\.[^.]+$/, '');
        assert.ok(Object.hasOwn(catalogue, base), key);
        assert.ok(Object.hasOwn(catalogue, `${base}.other`), key);
        assert.deepEqual(placeholders(catalogue[key]), placeholders(catalogue[base]), key);
      }
    }
  });
}
