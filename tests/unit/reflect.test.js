import assert from 'node:assert/strict';
import test from 'node:test';

import {
  INVALID_ATTRIBUTE,
  coerceAttribute,
  serializeAttribute
} from '../../src/elements/reflect.js';

test('boolean attributes use presence semantics', () => {
  assert.equal(coerceAttribute(null, 'boolean'), false);
  assert.equal(coerceAttribute('', 'boolean'), true);
  assert.equal(coerceAttribute('false', 'boolean'), true);
});

test('number attributes coerce finite numeric text', () => {
  assert.equal(coerceAttribute('42.5', 'number'), 42.5);
  assert.equal(coerceAttribute('-3', 'number'), -3);
});

test('JSON attributes preserve structured values', () => {
  assert.deepEqual(coerceAttribute('[{"ID":1},{"ID":2}]', 'json'), [{ ID: 1 }, { ID: 2 }]);
  assert.deepEqual(coerceAttribute('{"enabled":true}', 'json'), { enabled: true });
});

test('invalid JSON warns and is ignored', () => {
  const warnings = [];
  const result = coerceAttribute('[invalid', 'json', (message) => warnings.push(message));

  assert.equal(result, INVALID_ATTRIBUTE);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /invalid JSON attribute/i);
});

test('invalid numbers warn and are ignored', () => {
  const warnings = [];
  const result = coerceAttribute('not-a-number', 'number', (message) => warnings.push(message));

  assert.equal(result, INVALID_ATTRIBUTE);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /invalid number attribute/i);
});

test('missing non-boolean attributes remain undefined', () => {
  assert.equal(coerceAttribute(null, 'string'), undefined);
  assert.equal(coerceAttribute(null, 'number'), undefined);
  assert.equal(coerceAttribute(null, 'json'), undefined);
});

test('property values serialize for attribute reflection', () => {
  assert.equal(serializeAttribute(true, 'boolean'), '');
  assert.equal(serializeAttribute(false, 'boolean'), null);
  assert.equal(serializeAttribute(12.5, 'number'), '12.5');
  assert.equal(serializeAttribute([{ ID: 'a' }], 'json'), '[{"ID":"a"}]');
  assert.equal(serializeAttribute(null, 'string'), null);
});
