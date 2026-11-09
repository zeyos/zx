import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';

import {
  defaultMessage, defaultMessages, getLanguage, hostMessage, printf, setLanguage, setTranslator, translate
} from '../../src/core/i18n.js';

afterEach(() => {
  setTranslator(null);
  setLanguage('en');
});

test('printf replaces numeric and named placeholders', () => {
  assert.equal(printf('%1 has %2 tasks', ['Ada', 3]), 'Ada has 3 tasks');
  assert.equal(printf('Hello %name%', { name: 'Grace' }), 'Hello Grace');
  assert.equal(printf('%arg% / %arg%', ['one', 'two']), 'one / two');
  assert.equal(printf('Keep %missing%', {}), 'Keep %missing%');
});

test('translate uses the injected translator then interpolates', () => {
  setTranslator((key) => key === 'greeting' ? 'Hello %1' : null);
  assert.equal(translate('greeting', ['Lin']), 'Hello Lin');
  assert.equal(translate('unknown'), 'unknown');
});

test('language can be set and read', () => {
  setLanguage('de-AT');
  assert.equal(getLanguage(), 'de-AT');
});

test('translate falls back to the default English catalogue, then to the key', () => {
  assert.equal(translate('dataFilter.clear'), 'Clear');
  assert.equal(translate('pagination.loaded', [1, 5]), '1 of 5');
  assert.equal(translate('date.month.0'), 'date.month.0', 'date names stay with Intl, not the catalogue');
  setTranslator((key) => (key === 'dataFilter.clear' ? 'Zurücksetzen' : null));
  assert.equal(translate('dataFilter.clear'), 'Zurücksetzen');
  assert.equal(translate('dataFilter.all'), 'All');
});

test('the catalogue is exported for hosts to copy as a starting locale', () => {
  assert.equal(defaultMessages['table.empty'], 'No records');
  assert.equal(defaultMessage('table.empty'), 'No records');
  assert.equal(defaultMessage('toString'), null, 'inherited properties are not entries');
  const german = { ...defaultMessages, 'table.empty': 'Keine Datensätze' };
  setTranslator((key) => german[key]);
  assert.equal(translate('table.empty'), 'Keine Datensätze');
});

test('hostMessage treats null, undefined, and an echoed key as no answer', () => {
  assert.equal(hostMessage('a.b'), null);
  setTranslator((key) => key);
  assert.equal(hostMessage('a.b'), null);
  setTranslator(() => 'Hallo');
  assert.equal(hostMessage('a.b'), 'Hallo');
});

test('a value written into the text is never read as a placeholder', () => {
  assert.equal(printf('Remove %1', ['50%off%sale.pdf']), 'Remove 50%off%sale.pdf');
  assert.equal(printf('%1 and %2', ['%2', 'b']), '%2 and b');
  assert.equal(printf('Hi %name%', { name: '%name% %1' }), 'Hi %name% %1');
  assert.equal(printf('%one% %two%', ['%two%', 'b']), '%two% b');
});

test('placeholders keep their reading in one pass', () => {
  assert.equal(printf('%1 %name%', ['a', 'b']), 'a a');
  assert.equal(printf('%foo%1', ['a']), '%fooa');
  assert.equal(printf('%1%', ['5']), '5%');
  assert.equal(printf('%name%', {}), '%name%');
  assert.equal(printf('%3', ['a']), '%3');
});

test('plural rules support Arabic, Russian, and French with an explicit numeric count', async () => {
  const { translatePlural } = await import('../../src/core/i18n.js');
  setTranslator((key) => key.startsWith('items.') ? `${key}: %1` : null);
  for (const [locale, cases] of [
    ['ar', [[0, 'zero'], [1, 'one'], [2, 'two'], [3, 'few'], [11, 'many'], [100, 'other']]],
    ['ru', [[1, 'one'], [2, 'few'], [5, 'many'], [1.5, 'other']]],
    ['fr', [[0, 'one'], [1, 'one'], [2, 'other']]]
  ]) {
    setLanguage(locale);
    for (const [count, category] of cases) {
      assert.equal(translatePlural('items', count, ['formatted 1,000']), `items.${category}: formatted 1,000`);
    }
  }
  assert.equal(translatePlural('items', 2, ['two'], { locale: 'ar' }), 'items.two: two');
  for (const count of ['2', NaN, Infinity, null]) assert.throws(() => translatePlural('items', count), TypeError);
});

test('plural lookup respects each source before English and recomputes English cardinal rules', async () => {
  const { translatePlural } = await import('../../src/core/i18n.js');
  setLanguage('fr');
  assert.equal(translatePlural('rating.count', 0, ['zero']), 'zero ratings', 'French zero must not choose English singular');
  assert.equal(translatePlural('rating.count', 1, ['one']), 'one rating');
  setTranslator((key) => ({ 'rating.count': 'legacy %1', 'rating.count.other': 'other %1' })[key]);
  assert.equal(translatePlural('rating.count', 1, ['shown']), 'other shown', 'host other wins over English one and host base');
  setTranslator((key) => key === 'rating.count' ? 'legacy %1' : null);
  assert.equal(translatePlural('rating.count', 1, ['shown']), 'legacy shown');
  setTranslator((key) => key === 'today' ? 'legacy date' : null);
  assert.equal(translatePlural('calendar.today', 1), 'legacy date');
  const calls = [];
  setTranslator((key) => { calls.push(key); return key.endsWith('.one') ? 'selected' : null; });
  assert.equal(translatePlural('rating.count', 1), 'selected');
  assert.deepEqual(calls, ['rating.count.one'], 'stop as soon as a source answers');
});

test('plural locale fallback is deterministic and an intentional empty translation stays empty', async () => {
  const { translatePlural } = await import('../../src/core/i18n.js');
  setTranslator((key) => ({ 'items.one': 'one', 'items.few': 'few', 'items.other': 'other' })[key]);
  setLanguage('ru');
  assert.equal(translatePlural('items', 2, [], { locale: 'invalid tag' }), 'few');
  for (const language of ['invalid tag', 'zz-ZZ']) {
    setLanguage(language);
    assert.equal(translatePlural('items', 1), 'one');
    assert.equal(translatePlural('items', 2), 'other');
  }
  setTranslator((key) => ({ 'items.one': '', items: 'legacy' })[key]);
  assert.equal(translatePlural('items', 1), '');
  assert.equal(translate('items', [1]), 'legacy');
});

test('plural locale fallback uses PluralRules support rather than NumberFormat support', async (t) => {
  const { formattingLocale, translatePlural } = await import('../../src/core/i18n.js');
  // Some ICU builds support Bashkir numbers but have no Bashkir plural data. Keep that support
  // boundary explicit so the regression remains useful when the runtime's ICU data changes.
  const numbers = Intl.NumberFormat.supportedLocalesOf;
  const plurals = Intl.PluralRules.supportedLocalesOf;
  t.mock.method(Intl.NumberFormat, 'supportedLocalesOf', (requested) => requested.includes('ba')
    ? ['ba'] : numbers.call(Intl.NumberFormat, requested));
  t.mock.method(Intl.PluralRules, 'supportedLocalesOf', (requested) =>
    plurals.call(Intl.PluralRules, requested.filter((locale) => locale !== 'ba')));
  setLanguage('ru');
  setTranslator((key) => key.startsWith('items.') ? `chosen:${key}` : null);
  assert.equal(formattingLocale('ba'), 'ba', 'the locale really remains supported for numbers');
  assert.equal(translatePlural('items', 2, [], { locale: 'ba' }), 'chosen:items.few');
  setLanguage('ba');
  assert.equal(formattingLocale(undefined, Intl.PluralRules), 'en', 'unsupported active locale uses deterministic English');
  assert.equal(translatePlural('items', 2), 'chosen:items.other');
});
