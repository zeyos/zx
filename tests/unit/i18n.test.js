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
