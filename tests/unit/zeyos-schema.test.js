import assert from 'node:assert/strict';
import test from 'node:test';

import {
  fieldToZxColumn, fieldToZxField, resolveFields
} from '../../src/zeyos/schema.js';

test('maps entity, money, date, boolean, enum, and array metadata', () => {
  assert.deepEqual(fieldToZxField({ id: 'contact', type: 'integer', fk: 'contacts' }), {
    id: 'contact', type: 'zxselect', label: 'Contact', props: { entity: 'contacts' }
  });

  const moneyField = fieldToZxField({ id: 'amount', type: 'numeric', format: 'money' });
  assert.deepEqual(moneyField, { id: 'amount', type: 'float', label: 'Amount' });
  const moneyColumn = fieldToZxColumn({ id: 'amount', format: 'money' });
  assert.equal(moneyColumn.align, 'right');
  assert.equal(typeof moneyColumn.render, 'function');
  assert.match(moneyColumn.render({ amount: 1234.5 }), /1.*234/);

  assert.deepEqual(fieldToZxField({ id: 'date', type: 'bigint', indexed: true }), {
    id: 'date', type: 'date', label: 'Date'
  });
  const dateColumn = fieldToZxColumn({ id: 'date', type: 'bigint', indexed: true });
  assert.equal(dateColumn.sortValue({ date: 1_700_000_000 }), 1_700_000_000);
  assert.notEqual(dateColumn.render({ date: 1_700_000_000 }), '1700000000');

  assert.deepEqual(fieldToZxField({ id: 'checked', type: 'boolean' }), {
    id: 'checked', type: 'toggle', label: 'Checked'
  });
  assert.equal(fieldToZxColumn({ id: 'checked', type: 'boolean' }).render({ checked: 1 }), '✓');

  assert.deepEqual(fieldToZxField({ id: 'status', type: 'smallint', enum: { 0: 'OPEN', 1: 'DONE' } }), {
    id: 'status', type: 'optionlist', label: 'Status', options: { 0: 'OPEN', 1: 'DONE' }
  });
  assert.equal(fieldToZxColumn({ id: 'status', enum: { 0: 'OPEN', 1: 'DONE' } }).render({ status: 1 }), 'DONE');
  assert.deepEqual(fieldToZxField({ id: 'choice', type: 'list', options: '["First","Second"]' }).options, {
    0: 'First', 1: 'Second'
  });
  assert.deepEqual(fieldToZxField({ id: 'tags', type: 'text[]' }), {
    id: 'tags', type: 'valuelist', label: 'Tags'
  });
});

test('semantic formats win over DB types and typed text inputs are retained', () => {
  assert.equal(fieldToZxField({ id: 'priority', type: 'smallint' }).props.preset, 'priority');
  assert.deepEqual(fieldToZxField({ id: 'email', type: 'text', format: 'email' }), {
    id: 'email', type: 'text', label: 'Email', props: { type: 'email' }
  });
  assert.equal(fieldToZxField({ id: 'payload', type: 'json' }).type, 'textarea');
  assert.equal(fieldToZxField({ id: 'notes', type: 'text', maxLength: 500 }).type, 'textarea');
  assert.equal(fieldToZxField({ id: 'notes', type: 'character varying(500)' }).type, 'textarea');
});

test('unknown metadata falls back to text and warns once per type', () => {
  const originalWarn = console.warn;
  const warnings = [];
  console.warn = (message) => warnings.push(message);
  try {
    assert.equal(fieldToZxField({ id: 'one', type: 'mystery_type_for_test' }).type, 'text');
    assert.equal(fieldToZxField({ id: 'two', type: 'mystery_type_for_test' }).type, 'text');
  } finally {
    console.warn = originalWarn;
  }
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /mystery_type_for_test/);
});

test('resolveFields follows the runtime schema shape and honors fields order, exclude, labels, and enums()', () => {
  const client = {
    schema: {
      fields: (resource) => resource === 'tickets' ? ['ID', 'name', 'status', 'account'] : [],
      describe: () => ({
        name: 'tickets',
        type: 'table',
        fields: {
          ID: { type: 'integer', indexed: true },
          name: { type: 'text' },
          status: { type: 'smallint' },
          account: { type: 'integer', indexed: true, fk: 'accounts' }
        }
      }),
      enums: (_resource, field) => field === 'status' ? { 0: 'OPEN', 9: 'COMPLETED' } : null
    }
  };

  const fields = resolveFields(client, 'tickets', {
    fields: ['account', 'status', 'missing', 'name', 'ID'],
    exclude: ['name'],
    labels: { account: 'Customer' }
  });
  assert.deepEqual(fields.map((field) => field.id), ['account', 'status', 'ID']);
  assert.equal(fields[0].label, 'Customer');
  assert.equal(fields[0].fk, 'accounts');
  assert.deepEqual(fields[1].enums, { 0: 'OPEN', 9: 'COMPLETED' });
  assert.equal(fields[2].indexed, true);
});
