(function () {
  'use strict';

  const latency = 250;
  const originalFetch = window.fetch.bind(window);
  const customers = [
    { ID: 1, name: 'Alpine Works' },
    { ID: 2, name: 'Northstar GmbH' },
    { ID: 3, name: 'Atelier West' },
    { ID: 4, name: 'Danube Systems' },
    { ID: 5, name: 'Lumen Office' },
    { ID: 6, name: 'Kraft & Partner' },
    { ID: 7, name: 'Helix Logistics' },
    { ID: 8, name: 'Vienna Foundry' }
  ];
  const statuses = ['Open', 'Paid', 'Draft', 'Overdue'];
  const notes = [
    'Quarterly services and support.',
    'Hardware delivery for the Vienna office.',
    'Annual platform subscription.',
    'Implementation workshop and follow-up.'
  ];
  const invoices = Array.from({ length: 25 }, (_item, index) => {
    const customer = customers[index % customers.length];
    const issued = addDays(new Date(2026, 6, 1), index * -4);
    return {
      ID: index + 1,
      number: 'INV-26' + String(1041 - index).padStart(3, '0'),
      customerId: customer.ID,
      customer: customer.name,
      issued: toDateString(issued),
      due: toDateString(addDays(issued, 30)),
      amount: Math.round((((index + 3) * 317.45) % 9800 + 240) * 100) / 100,
      status: statuses[index % statuses.length],
      notes: notes[index % notes.length],
      permission: index % 5 === 0 ? 102 : (index % 3 === 0 ? 'private' : 'public')
    };
  });

  window.fetch = async function mockFetch(input, init = {}) {
    const url = new URL(input instanceof Request ? input.url : String(input), window.location.href);
    const route = matchRoute(url);
    if (!route) return originalFetch(input, init);

    const signal = init.signal ?? (input instanceof Request ? input.signal : null);
    await wait(latency, signal);

    try {
      const body = await readBody(input, init);
      const query = Object.fromEntries(url.searchParams);
      const result = handle(route, { ...query, ...body });
      return jsonResponse({ result });
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      return jsonResponse({ error: message }, 400);
    }
  };

  /**
   * @param {URL} url
   * @returns {{kind: 'rest'|'flat', service: string, action: string}|null}
   */
  function matchRoute(url) {
    const rest = url.pathname.match(/\/remotecall\/(invoices|customers)(?::[^/]+)?\/(list|get|save)\/?$/);
    if (rest) return { kind: 'rest', service: rest[1], action: rest[2] };
    if (url.pathname.endsWith('/remotecall.php')) {
      return { kind: 'flat', service: 'invoices', action: '' };
    }
    return null;
  }

  /**
   * @param {{kind: 'rest'|'flat', service: string, action: string}} route
   * @param {Record<string, unknown>} data
   * @returns {unknown}
   */
  function handle(route, data) {
    const service = route.kind === 'flat' ? String(data.service ?? route.service) : route.service;
    const action = route.kind === 'flat' ? String(data.action ?? '') : route.action;

    if (service === 'customers' && action === 'list') {
      return customers.map((customer) => ({ ...customer }));
    }
    if (service !== 'invoices') throw new Error('Unknown mock service: ' + service);
    if (action === 'list') return invoices.map((invoice) => ({ ...invoice }));
    if (action === 'get') {
      const invoice = invoices.find((candidate) => candidate.ID === Number(data.ID ?? data.id));
      if (!invoice) throw new Error('Invoice not found.');
      return { ...invoice };
    }
    if (action === 'save') return saveInvoice(data);
    throw new Error('Unknown mock action: ' + (action || '(empty)'));
  }

  /**
   * @param {Record<string, unknown>} data
   * @returns {Record<string, unknown>}
   */
  function saveInvoice(data) {
    const customerId = Number(data.customerId);
    const customer = customers.find((candidate) => candidate.ID === customerId);
    if (!String(data.number ?? '').trim()) throw new Error('Invoice number is required.');
    if (!customer) throw new Error('Choose a valid customer.');

    const requestedId = Number(data.ID);
    const existingIndex = Number.isFinite(requestedId)
      ? invoices.findIndex((invoice) => invoice.ID === requestedId)
      : -1;
    const ID = existingIndex >= 0
      ? invoices[existingIndex].ID
      : Math.max(0, ...invoices.map((invoice) => invoice.ID)) + 1;
    const invoice = {
      ID,
      number: String(data.number).trim(),
      customerId,
      customer: customer.name,
      issued: normalizeDate(data.issued),
      due: normalizeDate(data.due),
      amount: Number(data.amount),
      status: statuses.includes(String(data.status)) ? String(data.status) : 'Draft',
      notes: String(data.notes ?? ''),
      permission: normalizePermission(data.permission)
    };
    if (!Number.isFinite(invoice.amount)) throw new Error('Enter a valid amount.');

    if (existingIndex >= 0) invoices.splice(existingIndex, 1, invoice);
    else invoices.unshift(invoice);
    return { ...invoice };
  }

  /**
   * @param {RequestInfo|URL} input
   * @param {RequestInit} init
   * @returns {Promise<Record<string, unknown>>}
   */
  async function readBody(input, init) {
    let body = init.body;
    if (body == null && input instanceof Request) {
      body = await input.clone().text();
    }
    if (body == null || body === '') return {};
    if (body instanceof URLSearchParams) return Object.fromEntries(body);
    if (body instanceof FormData) return Object.fromEntries(body.entries());
    if (body instanceof Blob) body = await body.text();
    if (typeof body === 'string') {
      try {
        const parsed = JSON.parse(body);
        return parsed && typeof parsed === 'object' ? parsed : {};
      } catch {
        return Object.fromEntries(new URLSearchParams(body));
      }
    }
    return {};
  }

  /**
   * @param {unknown} payload
   * @param {number} [status=200]
   * @returns {Response}
   */
  function jsonResponse(payload, status = 200) {
    return new Response(JSON.stringify(payload), {
      status,
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
  }

  /**
   * @param {number} milliseconds
   * @param {AbortSignal|null} signal
   * @returns {Promise<void>}
   */
  function wait(milliseconds, signal) {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) {
        reject(new DOMException('The operation was aborted.', 'AbortError'));
        return;
      }
      const timeout = window.setTimeout(resolve, milliseconds);
      signal?.addEventListener('abort', () => {
        window.clearTimeout(timeout);
        reject(new DOMException('The operation was aborted.', 'AbortError'));
      }, { once: true });
    });
  }

  /**
   * @param {Date} date
   * @param {number} amount
   * @returns {Date}
   */
  function addDays(date, amount) {
    const copy = new Date(date);
    copy.setDate(copy.getDate() + amount);
    return copy;
  }

  /**
   * @param {Date} date
   * @returns {string}
   */
  function toDateString(date) {
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0')
    ].join('-');
  }

  /**
   * @param {unknown} value
   * @returns {string}
   */
  function normalizeDate(value) {
    if (value instanceof Date && !Number.isNaN(value.getTime())) return toDateString(value);
    const text = String(value ?? '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new Error('Enter a valid date.');
    return text;
  }

  /**
   * @param {unknown} value
   * @returns {string|number}
   */
  function normalizePermission(value) {
    if (value === true || value === 'public') return 'public';
    if (value === false || value === 'private') return 'private';
    const group = Number(value);
    return Number.isFinite(group) ? group : 'public';
  }
}());
