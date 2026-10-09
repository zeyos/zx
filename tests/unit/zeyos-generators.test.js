import assert from 'node:assert/strict';
import test from 'node:test';

import { buildZeyosFormConfig } from '../../src/zeyos/form.js';
import {
  buildZeyosEntitySelectConfig, buildZeyosSelectConfig
} from '../../src/zeyos/select.js';
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
  assert.equal(columns.status.render(row), 'Paid');
});

test('buildZeyosTableConfig shows date-only columns as calendar days in the instance zone', () => {
  const config = buildZeyosTableConfig(fakeClient(), 'transactions', {
    fields: ['date', 'duedate'],
    timeZone: 'UTC'
  });
  const [date, duedate] = config.columns;
  const day = (month, dayOfMonth) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeZone: 'UTC' })
    .format(new Date(Date.UTC(2026, month, dayOfMonth)));
  // Midnight UTC of 20 July and of 19 August 2026: no time, and no hour that moves with summer time.
  assert.equal(date.render({ date: 1_784_505_600 }), day(6, 20));
  assert.equal(duedate.render({ duedate: 1_787_097_600 }), day(7, 19));
  assert.ok(config.fieldMeta.every((meta) => meta.timeZone === 'UTC'));
});

test('buildZeyosTableConfig passes Table presentation options and listeners through', () => {
  const clicks = [];
  const emptyText = 'No invoices';
  const config = buildZeyosTableConfig(fakeClient(), 'transactions', {
    fields: ['transactionnum', 'status'],
    variant: 'plain',
    zebra: false,
    stickyHeader: false,
    responsive: 'md',
    emptyText,
    hiddenColumns: ['status'],
    columnVisibility: true,
    onRowClick: (row) => clicks.push(['callback', row.ID]),
    onrowclick: (event) => clicks.push(['listener', event.detail.row.ID]),
    // Owned by the binding, or never persisted by it: not passed on.
    columns: [],
    data: [{ ID: 1 }],
    sortMode: 'local',
    editMode: 'cell',
    rowReorder: true,
    hierarchy: { parentId: 'parent' }
  });
  const options = config.tableOptions;
  assert.equal(options.variant, 'plain');
  assert.equal(options.zebra, false);
  assert.equal(options.stickyHeader, false);
  assert.equal(options.responsive, 'md');
  assert.equal(options.emptyText, emptyText);
  assert.deepEqual(options.hiddenColumns, ['status']);
  assert.equal(options.columnVisibility, true);
  assert.equal(options.columns, config.columns);
  assert.deepEqual(options.data, []);
  assert.equal(options.sortMode, 'server');
  for (const key of ['editMode', 'rowReorder', 'hierarchy']) {
    assert.equal(Object.prototype.hasOwnProperty.call(options, key), false, `${key} is not passed through`);
  }
  options.onrowclick({ detail: { row: { ID: 7 } } });
  assert.deepEqual(clicks, [['listener', 7], ['callback', 7]]);

  const defaults = buildZeyosTableConfig(fakeClient(), 'transactions', { fields: ['status'] }).tableOptions;
  for (const key of ['variant', 'zebra', 'emptyText']) {
    assert.equal(Object.prototype.hasOwnProperty.call(defaults, key), false, `${key} keeps the Table default`);
  }
  assert.equal(defaults.onrowclick, undefined);
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
  assert.equal(config.fields.duedate.type, 'date');
  assert.deepEqual(config.fields.status.options, {
    0: 'Draft', 1: 'Booked', 16: 'Invoiced', 20: 'Paid', 21: 'Overpaid'
  });

  // Runtime zone: a stored local midnight comes back as the same Date and is stored unchanged.
  const issued = new Date(2026, 6, 21);
  const due = new Date(2026, 7, 20);
  const source = {
    transactionnum: 'INV-2026-0001',
    account: 201,
    date: issued.getTime() / 1000,
    duedate: due.getTime() / 1000,
    netamount: 1234.5,
    status: 20
  };
  const values = config.mapFromRecord(source);
  assert.equal(values.date.getTime(), issued.getTime());
  assert.equal(values.duedate.getTime(), due.getTime());
  const payload = config.mapToRecord({ ...values, status: '20' });
  assert.equal(payload.date, source.date);
  assert.equal(payload.duedate, source.duedate);
  assert.equal(payload.status, 20);
});

test('buildZeyosFormConfig reads and writes date-only fields as days in the instance zone', () => {
  const config = buildZeyosFormConfig(fakeClient(), 'transactions', {
    fields: ['date', 'duedate'],
    timeZone: 'UTC'
  });
  // Midnight UTC of 21 July and of 20 August 2026, as a UTC instance stores them.
  const source = { date: 1_784_592_000, duedate: 1_787_184_000 };
  const values = config.mapFromRecord(source);
  assert.deepEqual([values.date.getFullYear(), values.date.getMonth(), values.date.getDate()], [2026, 6, 21]);
  assert.deepEqual([values.duedate.getMonth(), values.duedate.getDate(), values.duedate.getHours()], [7, 20, 0]);
  assert.deepEqual(config.mapToRecord(values), source);

  // A day picked in the editor is stored as that day's midnight in the instance's zone.
  assert.equal(config.mapToRecord({ date: new Date(2026, 9, 8, 14, 30), duedate: null }).date, Date.UTC(2026, 9, 8) / 1000);
  assert.equal(config.mapToRecord({ date: '', duedate: null }).date, null);

  const vienna = buildZeyosFormConfig(fakeClient(), 'transactions', { fields: ['duedate'], timeZone: 'Europe/Vienna' });
  assert.equal(vienna.mapToRecord({ duedate: new Date(2026, 7, 19) }).duedate, Date.UTC(2026, 7, 18, 22) / 1000);
  assert.equal(vienna.mapToRecord({ duedate: new Date(2026, 10, 7) }).duedate, Date.UTC(2026, 10, 6, 23) / 1000);
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

test('buildZeyosEntitySelectConfig composes rich entity rows without changing the ID contract', async () => {
  const client = fakeClient();
  let action = null;
  const config = buildZeyosEntitySelectConfig(client, 'accounts', {
    labelKey: 'lastname',
    subtitleKey: 'customernum',
    groupKey: 'type',
    moduleKey: () => 'accounts',
    none: 'No account',
    create: {
      label: 'Create account…',
      oninvoke: (detail) => { action = detail; }
    }
  });

  assert.equal(config.valueKey, 'ID');
  assert.equal(config.clearable, true);
  assert.equal(config.noneLabel, 'No account');
  assert.equal(typeof config.renderItem, 'function');
  assert.equal(typeof config.renderValueAdornment, 'function');
  assert.deepEqual(config.actions.map(({ id, label, group }) => ({ id, label, group })), [
    { id: 'create', label: 'Create account…', group: 'New' }
  ]);

  await config.filter('alpine');
  assert.ok(client.calls[0].fields.includes('ID'));
  assert.ok(client.calls[0].fields.includes('lastname'));
  assert.ok(client.calls[0].fields.includes('customernum'));
  assert.ok(client.calls[0].fields.includes('type'));
  config.actions[0].invoke({ id: 'create', query: 'Alpine', select: null });
  assert.equal(action.resource, 'accounts');
  assert.equal(action.query, 'Alpine');
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
