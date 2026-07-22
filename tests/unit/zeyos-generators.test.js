import assert from 'node:assert/strict';
import test from 'node:test';

import { buildZeyosFormConfig } from '../../src/zeyos/form.js';
import { buildZeyosSelectConfig } from '../../src/zeyos/select.js';
import { buildZeyosTableConfig } from '../../src/zeyos/table.js';

const TRANSACTION_FIELDS = {
  ID: { type: 'integer', indexed: true },
  transactionnum: { type: 'text', indexed: true },
  account: { type: 'integer', indexed: true, fk: 'accounts' },
  date: { type: 'bigint', indexed: true },
  duedate: { type: 'bigint' },
  netamount: { type: 'double precision' },
  currency: { type: 'character varying(3)' },
  status: {
    type: 'smallint',
    enum: { 0: 'DRAFT', 1: 'BOOKED', 16: 'INVOICED', 20: 'PAID', 21: 'OVERPAID' }
  }
};

const ACCOUNT_FIELDS = {
  ID: { type: 'integer', indexed: true },
  customernum: { type: 'text', indexed: true },
  lastname: { type: 'text', indexed: true },
  firstname: { type: 'text', indexed: true },
  type: {
    type: 'smallint',
    enum: { 0: 'PROSPECT', 1: 'CUSTOMER', 2: 'SUPPLIER' }
  },
  visibility: { type: 'smallint', enum: { 0: 'REGULAR', 1: 'ARCHIVED', 2: 'DELETED' } }
};

test('buildZeyosTableConfig assembles typed transaction columns and joined entity labels', () => {
  const client = fakeClient();
  const config = buildZeyosTableConfig(client, 'transactions', {
    fields: ['transactionnum', 'account', 'date', 'netamount', 'status'],
    labels: { transactionnum: 'Invoice number', account: 'Customer' }
  });

  assert.deepEqual(config.columns.map(({ id, label, align }) => ({ id, label, align })), [
    { id: 'transactionnum', label: 'Invoice number', align: undefined },
    { id: 'account', label: 'Customer', align: undefined },
    { id: 'date', label: 'Date', align: undefined },
    { id: 'netamount', label: 'Netamount', align: 'right' },
    { id: 'status', label: 'Status', align: undefined }
  ]);
  assert.equal(config.tableOptions.sortMode, 'server');
  assert.equal(config.projection.account_label, 'account.lastname');
  assert.equal(config.projection.currency, 'currency');
  assert.equal(config.projection.ID, 'ID');

  const columns = Object.fromEntries(config.columns.map((column) => [column.id, column]));
  const row = {
    account: 201,
    account_label: 'Alpine Works',
    date: 1_784_582_400,
    netamount: 1234.5,
    currency: 'EUR',
    status: 20
  };
  assert.equal(columns.account.render(row), 'Alpine Works');
  assert.notEqual(columns.date.render(row), String(row.date));
  assert.match(columns.netamount.render(row), /1.*234/);
  assert.match(columns.netamount.render(row), /€|EUR/);
  assert.equal(columns.status.render(row), 'PAID');
});

test('buildZeyosFormConfig assembles entity, enum, and Unix-second date descriptors', () => {
  const config = buildZeyosFormConfig(fakeClient(), 'transactions', {
    fields: ['transactionnum', 'account', 'date', 'duedate', 'netamount', 'status'],
    title: 'Invoice details',
    columns: 2
  });

  assert.equal(config.formOptions.fieldsets[0].title, 'Invoice details');
  assert.equal(config.formOptions.fieldsets[0].columns, 2);
  assert.equal(config.fields.account.type, 'zxselect');
  assert.equal(config.fields.account.props.valueKey, 'ID');
  assert.equal(config.fields.account.props.labelKey, 'lastname');
  assert.equal(typeof config.fields.account.props.filter, 'function');
  assert.equal(config.fields.date.type, 'date');
  assert.equal(config.fields.duedate.type, 'datetime');
  assert.deepEqual(config.fields.status.options, {
    0: 'DRAFT', 1: 'BOOKED', 16: 'INVOICED', 20: 'PAID', 21: 'OVERPAID'
  });

  const source = {
    transactionnum: 'INV-2026-0001',
    account: 201,
    date: 1_784_582_400,
    duedate: 1_787_174_400,
    netamount: 1234.5,
    status: 20
  };
  const values = config.mapFromRecord(source);
  assert.ok(values.date instanceof Date);
  assert.ok(values.duedate instanceof Date);
  const payload = config.mapToRecord({ ...values, status: '20' });
  assert.equal(payload.date, source.date);
  assert.equal(payload.duedate, source.duedate);
  assert.equal(payload.status, 20);
});

test('buildZeyosSelectConfig sends the buildListQuery shape to the generated list operation', async () => {
  const client = fakeClient();
  const config = buildZeyosSelectConfig(client, 'accounts', {
    fields: ['ID', 'customernum', 'lastname'],
    labelKey: 'lastname',
    searchFields: ['customernum', 'lastname'],
    filters: { type: 1 },
    limit: 25
  });

  const rows = await config.filter('  alpine  ');
  assert.deepEqual(rows, [{ ID: 201, customernum: 'C-0201', lastname: 'Alpine Works' }]);
  assert.deepEqual(client.calls[0], {
    fields: ['ID', 'customernum', 'lastname'],
    filters: { type: 1, visibility: 0 },
    query: 'alpine',
    limit: 25
  });
  assert.equal(Object.prototype.hasOwnProperty.call(client.calls[0], 'filter'), false);
});

function fakeClient() {
  const calls = [];
  const resources = { transactions: TRANSACTION_FIELDS, accounts: ACCOUNT_FIELDS };
  return {
    calls,
    schema: {
      describe: (resource) => ({ name: resource, type: 'table', fields: resources[resource] ?? {} }),
      fields: (resource) => Object.keys(resources[resource] ?? {}),
      operations: (resource) => resource === 'accounts'
        ? ['listAccounts', 'getAccount']
        : ['listTransactions', 'getTransaction', 'createTransaction', 'updateTransaction']
    },
    api: {
      listAccounts: async (query) => {
        calls.push(query);
        return { data: [{ ID: 201, customernum: 'C-0201', lastname: 'Alpine Works' }], count: 1 };
      },
      getAccount: async ({ ID }) => ({ ID, customernum: `C-${ID}`, lastname: 'Alpine Works' }),
      listTransactions: async (query) => {
        calls.push(query);
        return { data: [], count: 0 };
      },
      getTransaction: async ({ ID }) => ({ ID }),
      createTransaction: async (record) => ({ ID: 1, ...record }),
      updateTransaction: async (record) => record
    }
  };
}
