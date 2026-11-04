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

test('English leaves the choice to the browser, so its output does not move', () => {
  for (const language of ['en', 'en-GB', 'EN-us']) {
    setLanguage(language);
    assert.equal(dateLocale(), undefined, language);
  }
});

test('a tag Intl cannot use leaves it to the browser rather than throwing while drawing', () => {
  setLanguage('not a tag');
  assert.equal(dateLocale(), undefined);
});
