import assert from 'node:assert/strict';
import test from 'node:test';

import * as zx from '../../src/index.js';
import { localeSelectOptions } from '../../src/components/select/locale.js';
import { countrySelectOptions } from '../../src/components/select/country.js';
import { COUNTRY_CODES } from '../../src/components/flag/flag.js';
import { matchItems } from '../../src/components/select/filter.js';

const { Select, canonicalLocale } = zx;

test('Select exposes locale and country factories and pure items, without dedicated picker exports', () => {
  for (const key of ['locale', 'country', 'localeItems', 'countryItems']) assert.equal(typeof Select[key], 'function');
  assert.equal('LocalePicker' in zx, false);
  assert.equal('CountryPicker' in zx, false);
});

test('canonicalLocale accepts underscores and case while retaining extensions and private subtags', () => {
  assert.equal(canonicalLocale(' DE_at '), 'de-AT');
  assert.equal(canonicalLocale('EN_us_u_ca_gregory'), 'en-US-u-ca-gregory');
  assert.equal(canonicalLocale('de_at_x_private'), 'de-AT-x-private');
  for (const value of [null, undefined, 7, {}, '', 'bad tag', 'x-private']) assert.equal(canonicalLocale(value), null);
});

test('locale items canonicalize, deduplicate, and keep extension/private values with readable names', () => {
  const items = Select.localeItems(['de_at', 'DE-AT', 'bad tag', 'en-US-u-ca-gregory', 'de-AT-x-private']);
  assert.deepEqual(items.map(item => item.ID), ['de-AT', 'en-US-u-ca-gregory', 'de-AT-x-private']);
  assert(items.every(item => item.name && item.nameLang === item.ID));
  assert.deepEqual(items.map(item => item.region), ['AT', 'US', 'AT']);
  assert.deepEqual(Select.localeItems(null), []);
});

test('locale items preserve naming modes, flag precedence, custom descriptions, and caller data', () => {
  const locales = Object.freeze(['de', 'en-US', 'en', Object.freeze({ code: 'fr', name: 'French custom', description: 'subtitle', region: null })]);
  const flagRegions = Object.freeze({ de: 'AT', en: 'GB', 'en-US': 'CA' });
  const items = Select.localeItems(locales, { displayLocale: 'en', flagRegions });
  assert.deepEqual(items.map(item => item.region), ['AT', 'CA', 'GB', null]);
  assert.equal(items[0].name, 'Deutsch'); assert.equal(items[0].description, 'German');
  assert.equal(items[3].name, 'French custom'); assert.equal(items[3].description, 'subtitle'); assert.equal(items[3].nameLang, null);
  assert.equal(Select.localeItems(['en-US'], { flagRegions: { en: 'GB' } })[0].region, 'US');
  assert.deepEqual(Select.localeItems(['de'], { display: 'localized', displayLocale: 'en' })[0], {
    ID: 'de', name: 'German', nameLang: 'en', description: '', region: 'DE', language: 'de'
  });
  assert.equal(Select.localeItems(['de'], { display: 'native' })[0].description, '');
  assert.deepEqual(Select.localeItems([{ code: 'de', name: 'Z' }, { code: 'en', name: 'A' }], { sort: true }).map(item => item.ID), ['en', 'de']);
});

test('country items normalize codes and expose localized and English names for search', () => {
  const countries = Object.freeze([' de ', 'DE', 'AT', 'invalid', Object.freeze({ code: 'us', name: 'Custom USA', description: 'Dollar' })]);
  const items = Select.countryItems(countries, { displayLocale: 'de', showCode: true, sort: false });
  assert.deepEqual(items, [
    { ID: 'DE', name: 'Deutschland', description: 'DE', alias: 'Germany' },
    { ID: 'AT', name: 'Österreich', description: 'AT', alias: 'Austria' },
    { ID: 'US', name: 'Custom USA', description: 'Dollar', alias: 'United States' }
  ]);
  assert.deepEqual(matchItems(items, 'germany', ['name', 'ID', 'alias', 'description']), [items[0]]);
  assert.deepEqual(matchItems(items, 'dollar', ['name', 'ID', 'alias', 'description']), [items[2]]);
  assert.deepEqual(Select.countryItems(null), []);
  const all = Select.countryItems();
  assert.equal(all.length, COUNTRY_CODES.length);
  assert.equal(new Set(all.map(item => item.ID)).size, COUNTRY_CODES.length);
  assert.deepEqual(Select.countryItems([{ code: 'de', name: 'Z' }, { code: 'at', name: 'A' }]).map(item => item.ID), ['AT', 'DE']);
});

test('preset builders preserve defaults, pinned order, message keys, and frozen options', () => {
  const locales = Object.freeze(['de', 'en']);
  const localeOptions = Object.freeze({ locales, preferred: Object.freeze(['fr', 'it']), preferredLabel: 'Pinned', value: 'DE', msg: Object.freeze({ 'localePicker.label': 'Choose language', 'localePicker.placeholder': 'Language' }) });
  const locale = localeSelectOptions(localeOptions);
  assert.equal(locale.label, 'Choose language'); assert.equal(locale.placeholder, 'Language');
  assert.equal(locale.value, 'de'); assert.equal(locale.filter, false); assert.equal(locale.fixedLabel, 'Pinned');
  assert.deepEqual(locale.fixedItems.map(item => item.ID), ['fr', 'it']);
  assert.notEqual(locale.items, locales); assert.equal(localeOptions.value, 'DE');
  assert.equal(localeSelectOptions({}).filter, 'local');
  const countryOptions = Object.freeze({ countries: Object.freeze(['de']), preferred: Object.freeze(['US', 'AT']), value: 'de', msg: Object.freeze({ 'countryPicker.label': 'Choose country', 'countryPicker.placeholder': 'Country' }) });
  const country = countrySelectOptions(countryOptions);
  assert.equal(country.label, 'Choose country'); assert.equal(country.placeholder, 'Country');
  assert.equal(country.value, 'DE'); assert.equal(country.filter, 'local');
  assert.deepEqual(country.fixedItems.map(item => item.ID), ['US', 'AT']); assert.equal(countryOptions.value, 'de');
  assert.equal(countrySelectOptions({}).items.length, COUNTRY_CODES.length);
});
