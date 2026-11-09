import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';

import { setLanguage } from '../../src/core/i18n.js';
import { dateLocale } from '../../src/internal/date-locale.js';

afterEach(() => setLanguage('en'));

test('a component\'s own locale wins over the language', () => {
  setLanguage('de');
  assert.equal(dateLocale('fr-FR'), 'fr-FR');
  assert.deepEqual(dateLocale(['fr', 'en']), ['fr', 'en']);
});

test('an unset locale follows a language other than English', () => {
  setLanguage('de');
  assert.equal(dateLocale(), 'de');
  assert.equal(dateLocale(null), 'de');
  setLanguage('de-AT');
  assert.equal(dateLocale(), 'de-AT');
});

test('regional English follows the active language instead of the browser default', () => {
  for (const language of ['en', 'en-GB', 'EN-us']) {
    setLanguage(language);
    assert.equal(dateLocale(), Intl.getCanonicalLocales(language)[0], language);
  }
});

test('unusable explicit locales fall through to the active language, then English', () => {
  setLanguage('de');
  assert.equal(dateLocale('not a tag'), 'de');
  assert.equal(dateLocale('xx'), 'de');
  setLanguage('not a tag');
  assert.equal(dateLocale(), 'en');
});

test('date consumers resolve locale support through DateTimeFormat', async (t) => {
  const { formatDate } = await import('../../src/core/date.js');
  const { fieldToZxColumn } = await import('../../src/zeyos/schema.js');
  const supported = Intl.DateTimeFormat.supportedLocalesOf;
  t.mock.method(Intl.DateTimeFormat, 'supportedLocalesOf', (requested) => supported.call(
    Intl.DateTimeFormat, Intl.getCanonicalLocales(requested).filter((locale) => locale !== 'en-GB')));
  assert.ok(Intl.NumberFormat.supportedLocalesOf('en-GB').length, 'numbers support the rejected date locale');
  setLanguage('ru');
  const date = new Date(2026, 2, 5);
  assert.equal(dateLocale('en-GB'), 'ru');
  assert.equal(formatDate(date, '%B', { locale: 'en-GB' }), new Intl.DateTimeFormat('ru', { month: 'long' }).format(date));
  const column = fieldToZxColumn({ id: 'date', format: 'date', locale: 'en-GB' });
  assert.equal(column.render({ date }), new Intl.DateTimeFormat('ru', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(Date.UTC(2026, 2, 5))));
  setLanguage('en-GB');
  assert.equal(dateLocale(), 'en', 'unsupported active date locale resolves deterministically to English');
});
