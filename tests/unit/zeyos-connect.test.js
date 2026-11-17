import assert from 'node:assert/strict';
import test from 'node:test';

import { getLanguage, setLanguage } from '../../src/core/i18n.js';
import { connect, errorMessage } from '../../src/zeyos/connect.js';

/*
 * The synchronous edges of the ZeyOS connection facade: the text a failure is reported with, how a
 * resource name finds its operation, how each helper shapes its request, and the locale it applies.
 * The asynchronous edges — failure reporting order, overlapping loads — live in zeyos-async.test.js.
 */

const GENERIC = 'ZeyOS request failed';

/* -------------------------------------------------------------------- errorMessage -- */

test('errorMessage reports an error by its own message', () => {
  assert.equal(errorMessage(new Error('Ticket 42 is locked')), 'Ticket 42 is locked');
  assert.equal(errorMessage(new TypeError('bad input')), 'bad input');
  assert.equal(errorMessage({ message: 'Not found', status: 404 }), 'Not found', 'an error-like object');
  assert.equal(errorMessage('offline'), 'offline', 'a string rejection reason is its own message');
  assert.equal(errorMessage(503), '503');
});

test('errorMessage falls back to the generic sentence when there is no message', () => {
  for (const reason of [undefined, null]) assert.equal(errorMessage(reason), GENERIC);
});

test('errorMessage never reports an empty or blank message', () => {
  // An empty toast tells the reader nothing; the generic sentence at least says what failed.
  for (const reason of [new Error(''), new Error('   '), { message: '' }, { message: '\n\t' }, '', '  ']) {
    assert.equal(errorMessage(reason), GENERIC, `${JSON.stringify(String(reason?.message ?? reason))} is no message`);
  }
});

test('errorMessage never reports an object as [object Object]', () => {
  for (const reason of [{}, { status: 500 }, { error: 'Not found' }, [], Object.create(null)]) {
    assert.equal(errorMessage(reason), GENERIC);
  }
});

test('errorMessage reads a message that is not a string as text', () => {
  assert.equal(errorMessage({ message: 42 }), '42');
});

/* ------------------------------------------------------------------------- connect -- */

test('connect requires a client with an api namespace and a function for onError', () => {
  for (const client of [null, undefined, 'client', {}, { api: null }, { api: 'x' }]) {
    assert.throws(() => connect(/** @type {any} */ (client)), TypeError);
  }
  assert.throws(() => connect(apiClient({}), /** @type {any} */ ({ onError: 'log' })), TypeError);
  assert.doesNotThrow(() => connect(apiClient({}), { onError: undefined }));
  assert.doesNotThrow(() => connect(apiClient({}), /** @type {any} */ ({ onError: null })));
});

test('the facade exposes the injected client itself', () => {
  const client = apiClient({});
  assert.equal(connect(client).client, client);
});

test('a resource finds its operations by name, singular or plural, in any spelling', async () => {
  const client = apiClient({
    listTickets: echo('listTickets'), getTicket: echo('getTicket'),
    createTicket: echo('createTicket'), updateTicket: echo('updateTicket'),
    listCategories: echo('listCategories'), getCategory: echo('getCategory'),
    listMailinglists: echo('listMailinglists'), getAddress: echo('getAddress')
  });
  const api = connect(client);
  assert.equal((await api.list('tickets')).operation, 'listTickets');
  assert.equal((await api.list('Tickets')).operation, 'listTickets');
  assert.equal((await api.get('tickets', 1)).operation, 'getTicket');
  assert.equal((await api.get('ticket', 1)).operation, 'getTicket');
  assert.equal((await api.create('tickets', {})).operation, 'createTicket');
  assert.equal((await api.update('tickets', 1, {})).operation, 'updateTicket');
  assert.equal((await api.list('categories')).operation, 'listCategories');
  assert.equal((await api.get('categories', 1)).operation, 'getCategory', 'ies → y');
  assert.equal((await api.list('mailing-lists')).operation, 'listMailinglists');
  assert.equal((await api.list('  mailing_lists ')).operation, 'listMailinglists');
  assert.equal((await api.get('addresses', 1)).operation, 'getAddress', 'sses → ss');
});

test('an operation id passed as the resource is called as it is', async () => {
  const api = connect(apiClient({ listTickets: echo('listTickets'), listTicketsByProject: echo('listTicketsByProject') }));
  assert.equal((await api.list('listTicketsByProject')).operation, 'listTicketsByProject');
});

test('the schema’s operations for a resource win, the shortest first', async () => {
  const client = apiClient({
    listTickets: echo('listTickets'), listTicketsArchived: echo('listTicketsArchived'),
    getTicket: echo('getTicket'), getTicketHistory: echo('getTicketHistory'), getIssue: echo('getIssue')
  }, {
    operations: (resource) => resource === 'issues'
      ? ['listTicketsArchived', 'listTickets', 'getTicketHistory', 'getIssue']
      : []
  });
  const api = connect(client);
  assert.equal((await api.list('issues')).operation, 'listTickets');
  assert.equal((await api.get('issues', 3)).operation, 'getIssue');
});

test('without operations for the resource the schema’s operation ids are searched', async () => {
  const client = apiClient({ listTickets: echo('listTickets'), getTicket: echo('getTicket') }, {
    operations: () => [],
    operationIds: () => ['getTicket']
  });
  const api = connect(client);
  assert.equal((await api.get('tickets', 1)).operation, 'getTicket');
  // listTickets is on the client but not among the schema's ids, so it is found by its plain name.
  assert.equal((await api.list('tickets')).operation, 'listTickets');
});

test('an action the resource’s operations lack falls back to the plain operation name', async () => {
  const client = apiClient({ listTickets: echo('listTickets'), getTicket: echo('getTicket') }, {
    operations: (resource) => resource === 'tickets' ? ['listTickets'] : []
  });
  assert.equal((await connect(client).get('tickets', 1)).operation, 'getTicket');
});

test('a resource without an operation, or without a name, is refused and reported', async () => {
  const reported = [];
  const api = connect(apiClient({ listTickets: echo('listTickets') }), {
    onError: (error, context) => { reported.push({ error, context }); }
  });
  await assert.rejects(() => api.get('tickets', 1), /No get operation found for ZeyOS resource "tickets"/);
  await assert.rejects(() => api.list('   '), TypeError);
  await assert.rejects(() => api.list(/** @type {any} */ (null)), TypeError);
  assert.deepEqual(reported.map(({ context }) => context), [
    { operation: 'get', resource: 'tickets' },
    { operation: 'list', resource: '   ' },
    { operation: 'list', resource: null }
  ]);
});

test('each helper shapes its request the way the operation expects', async () => {
  const api = connect(apiClient({
    listTickets: echo('listTickets'), getTicket: echo('getTicket'),
    createTicket: echo('createTicket'), updateTicket: echo('updateTicket')
  }));
  assert.deepEqual((await api.list('tickets')).input, {});
  assert.deepEqual((await api.list('tickets', { limit: 5 })).input, { limit: 5 });

  assert.deepEqual((await api.get('tickets', 7)).input, { ID: 7 });
  assert.deepEqual((await api.get('tickets', 7, { fields: ['name'] })).input, { ID: 7, fields: ['name'] });
  assert.deepEqual((await api.get('tickets', { ID: 7, fields: ['name'] })).input, { ID: 7, fields: ['name'] },
    'a parameter object is passed through');
  assert.deepEqual((await api.get('tickets', [7, 8])).input, { ID: [7, 8] }, 'an array is an id, not parameters');

  assert.deepEqual((await api.create('tickets', { name: 'New' })).input, { name: 'New' });

  assert.deepEqual((await api.update('tickets', 7, { name: 'Renamed' })).input, { ID: 7, body: { name: 'Renamed' } });
  assert.deepEqual((await api.update('tickets', 7)).input, { ID: 7, body: {} });
  assert.deepEqual((await api.update('tickets', 7, /** @type {any} */ (null))).input, { ID: 7, body: {} });
  assert.deepEqual((await api.update('tickets', { ID: 7, body: { name: 'x' } })).input, { ID: 7, body: { name: 'x' } },
    'a complete operation input is passed through');
});

test('a failed request is reported with its operation and rethrown unchanged', async () => {
  const failure = new Error('locked');
  const reported = [];
  const api = connect(apiClient({ getTicket: async () => { throw failure; } }), {
    onError: (error, context) => { reported.push({ error, context }); }
  });
  await assert.rejects(() => api.get('tickets', 1), (error) => error === failure);
  assert.deepEqual(reported, [{ error: failure, context: { operation: 'getTicket', resource: 'tickets' } }]);
});

test('a reporter that throws does not replace the API failure', async () => {
  const failure = new Error('locked');
  const api = connect(apiClient({ getTicket: async () => { throw failure; } }), {
    onError: () => { throw new Error('reporter broke'); }
  });
  await assert.rejects(() => api.get('tickets', 1), (error) => error === failure);
});

test('reportError hands an error to onError and returns its answer', () => {
  const api = connect(apiClient({}), { onError: (error, context) => ({ error, context }) });
  const failure = new Error('x');
  assert.deepEqual(api.reportError(failure, { resource: 'tickets' }), { error: failure, context: { resource: 'tickets' } });
});

/* -------------------------------------------------------------------------- locale -- */

test('connect applies the locale it is given, or the one the client carries', () => {
  withLanguage(() => {
    connect(apiClient({}), { locale: 'de-AT' });
    assert.equal(getLanguage(), 'de-AT');
  });
  for (const [shape, expected] of [
    [{ locale: 'de' }, 'de'],
    [{ language: 'fr' }, 'fr'],
    [{ config: { locale: 'it' } }, 'it'],
    [{ metadata: { locale: 'es' } }, 'es']
  ]) {
    withLanguage(() => {
      connect({ ...apiClient({}), ...shape });
      assert.equal(getLanguage(), expected, `derived from ${JSON.stringify(shape)}`);
    });
  }
  withLanguage(() => {
    connect({ ...apiClient({}), locale: 'de' }, { locale: 'en-GB' });
    assert.equal(getLanguage(), 'en-GB', 'the option wins over the client');
  });
});

test('connect leaves the language alone when there is no locale to apply', () => {
  withLanguage(() => {
    setLanguage('nl');
    connect(apiClient({}));
    assert.equal(getLanguage(), 'nl');
    connect(apiClient({}), { locale: '' });
    assert.equal(getLanguage(), 'nl', 'an empty locale is no locale');
  });
});

/* ------------------------------------------------------------------------- helpers -- */

/**
 * A client stand-in exposing `api` and, optionally, a schema.
 * @param {Record<string, Function>} api
 * @param {Record<string, Function>} [schema]
 */
function apiClient(api, schema) {
  return schema ? { api, schema } : { api };
}

/** An operation that answers with its own id and the input it received. @param {string} operation */
function echo(operation) {
  return async (input) => ({ operation, input });
}

/** Runs `run` and puts the active language back. @param {() => void} run */
function withLanguage(run) {
  const previous = getLanguage();
  try {
    run();
  } finally {
    setLanguage(previous);
  }
}
