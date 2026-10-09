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
    id: 'status', type: 'optionlist', label: 'Status', options: { 0: 'Open', 1: 'Done' }
  });
  assert.equal(fieldToZxColumn({ id: 'status', enum: { 0: 'OPEN', 1: 'DONE' } }).render({ status: 1 }), 'Done');
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

test('enum constants read as sentence-case labels; labels the schema gives are kept', () => {
  const status = {
    id: 'status',
    type: 'smallint',
    enum: { 0: 'DRAFT', 13: 'PARTLYINVOICED', 16: 'INVOICED', 18: 'PARTLYPAID_CANCELLED', 30: 'BILLING_QUOTE' }
  };
  assert.deepEqual(fieldToZxField(status).options, {
    0: 'Draft', 13: 'Partly invoiced', 16: 'Invoiced', 18: 'Partly paid cancelled', 30: 'Billing quote'
  });
  assert.equal(fieldToZxColumn(status).render({ status: 16 }), 'Invoiced');
  assert.equal(fieldToZxColumn(status).render({ status: 99 }), '99', 'an unknown value shows as stored');

  // A schema label is the label, whatever its case; a value that is not a constant already reads.
  assert.deepEqual(fieldToZxField({
    id: 'kind', type: 'list', enum: [{ value: 'eu', label: 'EU VAT' }, { value: 'x', name: 'NOTSTARTED' }]
  }).options, { eu: 'EU VAT', x: 'Not started' });
  assert.deepEqual(fieldToZxField({ id: 'stage', type: 'list', enum: { a: 'In progress', b: 'Won' } }).options, {
    a: 'In progress', b: 'Won'
  });
  assert.equal(fieldToZxColumn({ id: 'priority', type: 'smallint' }).render({ priority: 3 }), 'High');
});

test('date-only timestamps are calendar days; instants keep their time', () => {
  const kind = (meta) => fieldToZxField({ type: 'bigint', ...meta }).type;
  assert.equal(kind({ id: 'date', indexed: true }), 'date');
  assert.equal(kind({ id: 'duedate' }), 'date');
  assert.equal(kind({ id: 'birthdate' }), 'date');
  assert.equal(kind({ id: 'datefrom', resource: 'contracts' }), 'date');
  assert.equal(kind({ id: 'datefrom', resource: 'appointments', indexed: true }), 'datetime');
  assert.equal(kind({ id: 'date', resource: 'comments', indexed: true }), 'datetime');
  assert.equal(kind({ id: 'date' }), 'datetime', 'an unindexed date records when something happened');
  assert.equal(kind({ id: 'lastmodified' }), 'datetime');
  assert.equal(kind({ id: 'creationdate' }), 'datetime');
  assert.equal(kind({ id: 'lastmodified', format: 'date' }), 'date', 'a semantic format wins');
});

test('a date-only column shows the day its stored midnight names, without a time', () => {
  // Midnight of 19 August and of 7 November 2026 in Vienna: summer time, then winter time.
  const august = Date.UTC(2026, 7, 18, 22) / 1000;
  const november = Date.UTC(2026, 10, 6, 23) / 1000;
  const vienna = fieldToZxColumn({ id: 'duedate', type: 'bigint', timeZone: 'Europe/Vienna' });
  const dayOf = (seconds) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeZone: 'UTC' })
    .format(new Date(Date.UTC(2026, ...seconds)));
  assert.equal(vienna.render({ duedate: august }), dayOf([7, 19]));
  assert.equal(vienna.render({ duedate: november }), dayOf([10, 7]));
  assert.equal(vienna.sortValue({ duedate: august }), august);

  // The same stored values in a UTC instance are the evening before.
  const utc = fieldToZxColumn({ id: 'duedate', type: 'bigint', timeZone: 'UTC' });
  assert.equal(utc.render({ duedate: august }), dayOf([7, 18]));
  assert.equal(utc.render({ duedate: Date.UTC(2026, 7, 19) / 1000 }), dayOf([7, 19]));
  assert.equal(utc.render({ duedate: null }), '');

  const stamp = fieldToZxColumn({ id: 'lastmodified', type: 'bigint' }).render({ lastmodified: august });
  assert.notEqual(stamp, vienna.render({ duedate: august }), 'a date-time column keeps its time');
});

test('resolveFields applies format overrides and validates the instance time zone', () => {
  const client = {
    schema: {
      fields: () => ['ID', 'senddate', 'duedate'],
      describe: () => ({ fields: { ID: { type: 'integer' }, senddate: { type: 'bigint' }, duedate: { type: 'bigint' } } })
    }
  };
  const fields = resolveFields(client, 'messages', { formats: { senddate: 'date' }, timeZone: 'Europe/Vienna' });
  assert.equal(fields[1].format, 'date');
  assert.equal(fieldToZxField(fields[1]).type, 'date');
  assert.ok(fields.every((field) => field.timeZone === 'Europe/Vienna'));
  assert.equal(resolveFields(client, 'messages')[2].timeZone, undefined);
  assert.throws(() => resolveFields(client, 'messages', { timeZone: 'Mars/Olympus' }), RangeError);
});
