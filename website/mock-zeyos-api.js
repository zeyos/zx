/**
 * Mock ZeyOS OpenAPI backend for the schema-driven invoices layout.
 *
 * A real injected @zeyos/client serializes list/create/update inputs as JSON request bodies and
 * places record IDs in GET/PATCH paths. This fetch patch mirrors those endpoints and implements
 * the list directives emitted by zx-zeyos: query, filters, sort, limit, offset, fields, and count.
 *
 * Requests that do not target `/api/v1/...` fall through to the original fetch untouched, so the
 * documentation page keeps loading its own sources normally.
 */

let installed = false;

/**
 * Patches `window.fetch` to serve the mocked ZeyOS endpoints. Calling it repeatedly is safe.
 * @returns {void}
 */
export function installMockZeyosApi() {
  if (installed) return;
  installed = true;
  const LATENCY_MS = 180;
  const DAY_SECONDS = 86_400;
  const statuses = [0, 1, 16, 20, 21];
  const customerNames = [
    'Alpine Works', 'Northstar GmbH', 'Atelier West', 'Danube Systems',
    'Lumen Office', 'Kraft & Partner', 'Helix Logistics', 'Vienna Foundry'
  ];

  const accounts = customerNames.map((lastname, index) => ({
    ID: 201 + index,
    customernum: 'C-' + String(201 + index).padStart(4, '0'),
    lastname,
    firstname: ['Anna', 'Benedikt', 'Clara', 'David'][index % 4],
    type: index % 5 === 0 ? 0 : 1
  }));

  const baseDate = Math.floor(Date.UTC(2026, 6, 20) / 1000);
  const transactions = Array.from({ length: 67 }, (_, index) => {
    const account = accounts[index % accounts.length];
    const date = baseDate - index * 4 * DAY_SECONDS;
    return {
      ID: 26_100 + index,
      transactionnum: 'INV-2026-' + String(index + 1).padStart(4, '0'),
      account: account.ID,
      account_label: account.lastname,
      date,
      duedate: date + 30 * DAY_SECONDS,
      netamount: Math.round((740 + index * 117.35) * 100) / 100,
      currency: 'EUR',
      status: statuses[index % statuses.length],
      type: 3
    };
  });

  let nextId = 27_000;
  const realFetch = window.fetch.bind(window);

  window.fetch = async function mockFetch(input, init = {}) {
    const url = typeof input === 'string' ? input : input.url;
    const method = (init.method || (typeof input === 'object' && input.method) || 'GET').toUpperCase();
    const match = /\/api\/v1\/(transactions|accounts)(?:\/(\d+))?(?:\?|$)/.exec(url || '');
    if (!match) return realFetch(input, init);

    const [, resource, id] = match;
    await delay(LATENCY_MS);

    if (resource === 'accounts') {
      if (method === 'POST') {
        return json(listResult(accounts, await readBody(input, init), 'accounts'));
      }
      if (method === 'GET' && id) {
        const row = accounts.find((account) => account.ID === Number(id));
        return row ? json({ ...row }) : json({ error: 'Account not found' }, 404);
      }
    }

    if (resource === 'transactions') {
      if (method === 'POST') {
        return json(listResult(transactions, await readBody(input, init), 'transactions'));
      }
      if (method === 'GET' && id) {
        const row = transactions.find((transaction) => transaction.ID === Number(id));
        return row ? json({ ...row }) : json({ error: 'Transaction not found' }, 404);
      }
      if (method === 'PUT') {
        const body = await readBody(input, init);
        const record = normalizeTransaction({ ...body, ID: nextId++ });
        transactions.unshift(record);
        return json({ ...record });
      }
      if (method === 'PATCH' && id) {
        const body = await readBody(input, init);
        const index = transactions.findIndex((transaction) => transaction.ID === Number(id));
        if (index < 0) return json({ error: 'Transaction not found' }, 404);
        const record = normalizeTransaction({ ...transactions[index], ...body, ID: Number(id) });
        transactions.splice(index, 1, record);
        return json({ ...record });
      }
    }

    return json({ error: 'Unsupported mock operation' }, 405);
  };

  function listResult(source, input, resource) {
    const query = input && typeof input === 'object' ? input : {};
    let rows = source.map((row) => ({ ...row }));
    rows = rows.filter((row) => matchesFilters(row, query.filters, resource));
    rows = searchRows(rows, query.query, resource);
    rows = sortRows(rows, query.sort, resource);

    const count = rows.length;
    const offset = nonNegativeInteger(query.offset, 0);
    const limit = positiveInteger(query.limit, count || 50);
    rows = rows.slice(offset, offset + limit).map((row) => projectRow(row, query.fields, resource));
    return { data: rows, count };
  }

  function matchesFilters(row, filters, resource) {
    if (!filters || typeof filters !== 'object' || Array.isArray(filters)) return true;
    return Object.entries(filters).every(([field, predicate]) => {
      if (/^\d+$/.test(field) && Array.isArray(predicate)) {
        return matchesFilterGroup(row, predicate, resource);
      }
      const value = resolveField(row, field, resource);
      // `visibility: 0` is the binding default; transactions do not expose that field.
      if (field === 'visibility' && value === undefined) return true;
      return matchesPredicate(value, predicate);
    });
  }

  function matchesFilterGroup(row, group, resource) {
    const [operator, ...predicates] = group;
    const matches = predicates.map((predicate) => matchesFilters(row, predicate, resource));
    return String(operator).toUpperCase() === 'OR' ? matches.some(Boolean) : matches.every(Boolean);
  }

  function matchesPredicate(value, predicate) {
    if (predicate && typeof predicate === 'object' && !Array.isArray(predicate)) {
      return Object.entries(predicate).every(([operator, expected]) => {
        if (operator === '>=') return Number(value) >= Number(expected);
        if (operator === '<=') return Number(value) <= Number(expected);
        if (operator === '>') return Number(value) > Number(expected);
        if (operator === '<') return Number(value) < Number(expected);
        if (operator.toUpperCase() === 'IN') {
          const values = Array.isArray(expected) ? expected : [expected];
          return values.some((candidate) => sameValue(value, candidate));
        }
        return sameValue(value, expected);
      });
    }
    if (Array.isArray(predicate)) return predicate.some((candidate) => sameValue(value, candidate));
    return sameValue(value, predicate);
  }

  function searchRows(rows, query, resource) {
    const term = String(query ?? '').trim().toLocaleLowerCase();
    if (!term) return rows;
    return rows.filter((row) => {
      const values = resource === 'transactions'
        ? [row.transactionnum, row.account_label]
        : [row.customernum, row.lastname, row.firstname];
      return values.some((value) => String(value ?? '').toLocaleLowerCase().includes(term));
    });
  }

  function sortRows(rows, sort, resource) {
    const definitions = Array.isArray(sort)
      ? sort
      : (typeof sort === 'string' ? sort.split(',').filter(Boolean) : []);
    if (!definitions.length) return rows;
    return rows.slice().sort((left, right) => {
      for (const definition of definitions) {
        const source = String(definition);
        const descending = source.startsWith('-') || /:desc$/i.test(source);
        const field = source.replace(/^[+-]/, '').replace(/:(?:asc|desc)$/i, '');
        const comparison = compareValues(
          resolveField(left, field, resource),
          resolveField(right, field, resource)
        );
        if (comparison) return descending ? -comparison : comparison;
      }
      return 0;
    });
  }

  function projectRow(row, fields, resource) {
    if (Array.isArray(fields)) {
      return Object.fromEntries(fields.map((field) => [field, resolveField(row, field, resource)]));
    }
    if (fields && typeof fields === 'object') {
      return Object.fromEntries(Object.entries(fields).map(([alias, field]) => [
        alias,
        resolveField(row, field, resource)
      ]));
    }
    return { ...row };
  }

  function resolveField(row, field, resource) {
    if (Object.prototype.hasOwnProperty.call(row, field)) return row[field];
    const path = String(field).split('.');
    if (resource === 'transactions' && path[0] === 'account') {
      const account = accounts.find((candidate) => candidate.ID === Number(row.account));
      return path.length === 1 ? row.account : account?.[path[1]];
    }
    let value = row;
    for (const part of path) {
      if (!value || typeof value !== 'object') return undefined;
      value = value[part];
    }
    return value;
  }

  function normalizeTransaction(input) {
    const account = accounts.find((candidate) => candidate.ID === Number(input.account));
    return {
      ID: Number(input.ID),
      transactionnum: String(input.transactionnum ?? ''),
      account: input.account == null || input.account === '' ? null : Number(input.account),
      account_label: account?.lastname ?? '',
      date: integerOrNull(input.date),
      duedate: integerOrNull(input.duedate),
      netamount: finiteNumber(input.netamount, 0),
      currency: String(input.currency ?? 'EUR').slice(0, 3).toUpperCase(),
      status: finiteNumber(input.status, 0),
      type: finiteNumber(input.type, 3)
    };
  }

  async function readBody(input, init) {
    let body = init?.body;
    if (body == null && typeof Request !== 'undefined' && input instanceof Request) {
      body = await input.clone().text();
    }
    if (body == null || body === '') return {};
    if (typeof body !== 'string') {
      if (body instanceof URLSearchParams) return formEntries(body);
      return {};
    }
    try {
      const parsed = JSON.parse(body);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return formEntries(new URLSearchParams(body));
    }
  }

  function formEntries(search) {
    const result = {};
    for (const [key, rawValue] of search.entries()) {
      const value = parseFormValue(rawValue);
      if (!Object.prototype.hasOwnProperty.call(result, key)) result[key] = value;
      else if (Array.isArray(result[key])) result[key].push(value);
      else result[key] = [result[key], value];
    }
    return result;
  }

  function parseFormValue(value) {
    if (/^[\[{]/.test(value)) {
      try { return JSON.parse(value); } catch { /* Keep the literal form value. */ }
    }
    return value;
  }

  function sameValue(left, right) {
    if (Object.is(left, right)) return true;
    if (left == null || right == null) return left === right;
    return String(left) === String(right);
  }

  function compareValues(left, right) {
    if (left == null && right == null) return 0;
    if (left == null) return -1;
    if (right == null) return 1;
    if (typeof left === 'number' && typeof right === 'number') return left - right;
    return String(left).localeCompare(String(right), undefined, { numeric: true });
  }

  function integerOrNull(value) {
    if (value == null || value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) ? Math.trunc(number) : null;
  }

  function finiteNumber(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function nonNegativeInteger(value, fallback) {
    const number = Number(value);
    return Number.isInteger(number) && number >= 0 ? number : fallback;
  }

  function positiveInteger(value, fallback) {
    const number = Number(value);
    return Number.isInteger(number) && number > 0 ? number : fallback;
  }

  function json(payload, status = 200) {
    return new Response(JSON.stringify(payload), {
      status,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
