import assert from 'node:assert/strict';
import test from 'node:test';

import { Field, coerceFloat, coerceInteger } from '../../src/components/field/field.js';

test('Field registry contains every built-in adapter', () => {
  for (const type of [
    'text', 'password', 'textarea', 'checkbox', 'int', 'float', 'select', 'optionlist',
    'hidden', 'html', 'custom'
  ]) {
    assert.equal(Field.has(type), true, `${type} should be registered`);
  }
  assert.equal(Field.has('not-a-field-type'), false);
});

test('Field.register adds and replaces adapters', () => {
  const first = () => ({});
  const replacement = () => ({});
  assert.equal(Field.register('unit-example', first), Field);
  assert.equal(Field.has('unit-example'), true);
  assert.doesNotThrow(() => Field.register('unit-example', replacement));
  assert.equal(Field.has(' UNIT-EXAMPLE '), true);
});

test('integer coercion accepts integers and preserves invalid input', () => {
  assert.deepEqual(coerceInteger('42'), { valid: true, value: 42 });
  assert.deepEqual(coerceInteger('-7'), { valid: true, value: -7 });
  assert.deepEqual(coerceInteger(''), { valid: true, value: '' });
  assert.deepEqual(coerceInteger('4.2'), { valid: false, value: '4.2' });
  assert.deepEqual(coerceInteger('twelve'), { valid: false, value: 'twelve' });
});

test('float coercion accepts decimal comma and localized grouping', () => {
  assert.deepEqual(coerceFloat('12,5'), { valid: true, value: 12.5 });
  assert.deepEqual(coerceFloat('1.234,56'), { valid: true, value: 1234.56 });
  assert.deepEqual(coerceFloat('1,234.56'), { valid: true, value: 1234.56 });
  assert.deepEqual(coerceFloat('-0.25'), { valid: true, value: -0.25 });
  assert.deepEqual(coerceFloat(''), { valid: true, value: '' });
});

test('float coercion rejects malformed and non-finite input', () => {
  assert.deepEqual(coerceFloat('1,2,3'), { valid: false, value: '1,2,3' });
  assert.deepEqual(coerceFloat('1.23,45'), { valid: false, value: '1.23,45' });
  assert.deepEqual(coerceFloat('NaN'), { valid: false, value: 'NaN' });
  assert.deepEqual(coerceFloat(Infinity), { valid: false, value: 'Infinity' });
});
