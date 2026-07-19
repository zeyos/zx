import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';

import {
  getLanguage, printf, setLanguage, setTranslator, translate
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
