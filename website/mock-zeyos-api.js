/**
 * Mock ZeyOS OpenAPI backend for the kitchen-sink demo.
 *
 * The kitchen sink talks to a real @zeyos/client instance. This script patches window.fetch
 * (before the client is created) so the client's requests to the ZeyOS OpenAPI surface resolve
 * against in-memory data with a short, realistic latency — no live ZeyOS instance or credentials
 * required. Remove this script and point the client at a real `platform` to talk to a live server.
 *
 * Endpoints served (base `.../api/v1`):
 *   POST  /transactions        listTransactions   → { data, count }
 *   PUT   /transactions        createTransaction  → record
 *   GET   /transactions/{ID}   getTransaction     → record
 *   PATCH /transactions/{ID}   updateTransaction  → record
 *   POST  /accounts            listAccounts       → { data, count }
 */
(function installMockZeyosApi() {
  const LATENCY_MS = 260;
  const statuses = ['Draft', 'Open', 'Paid', 'Overdue'];
  const customerNames = [
    'Alpine Works', 'Northstar GmbH', 'Atelier West', 'Danube Systems', 'Lumen Office',
    'Kraft & Partner', 'Helix Logistics', 'Vienna Foundry'
  ];

  const accounts = customerNames.map((name, index) => ({ ID: 201 + index, name }));

  const transactions = Array.from({ length: 25 }, (_, index) => {
    const issued = addDays(new Date(2026, 6, 1), index * -4);
    const account = accounts[index % accounts.length];
    return {
      ID: 261041 - index,
      number: 'INV-' + (261041 - index),
      customerId: account.ID,
      customer: account.name,
      issued: toDateString(issued),
      due: toDateString(addDays(issued, 30)),
      amount: Math.round((900 + index * 105.35) * 100) / 100,
      status: statuses[index % statuses.length],
      notes: index % 3 === 0 ? 'Quarterly services and support.' : ''
    };
  });

  let nextId = 261100;
  const realFetch = window.fetch.bind(window);

  window.fetch = async function mockFetch(input, init = {}) {
    const url = typeof input === 'string' ? input : input.url;
    const method = (init.method || (typeof input === 'object' && input.method) || 'GET').toUpperCase();
    const match = /\/api\/v1\/(transactions|accounts)(?:\/(\d+))?(?:\?|$)/.exec(url || '');
    if (!match) return realFetch(input, init);

    const [, resource, id] = match;
    await delay(LATENCY_MS);

    if (resource === 'accounts' && method === 'POST') {
      return json({ data: accounts, count: accounts.length });
    }

    if (resource === 'transactions') {
      if (method === 'POST') {
        const rows = transactions.slice().sort((a, b) => b.issued.localeCompare(a.issued));
        return json({ data: rows, count: rows.length });
      }
      if (method === 'GET' && id) {
        const row = transactions.find((t) => t.ID === Number(id));
        return row ? json(row) : json({ error: 'Not found' }, 404);
      }
      if (method === 'PUT') {
        const body = await readBody(init);
        const record = { ...body, ID: nextId++ };
        record.customer = accountName(record.customerId) ?? record.customer ?? '';
        transactions.unshift(record);
        return json(record);
      }
      if (method === 'PATCH' && id) {
        const body = await readBody(init);
        const index = transactions.findIndex((t) => t.ID === Number(id));
        if (index < 0) return json({ error: 'Not found' }, 404);
        const record = { ...transactions[index], ...body, ID: Number(id) };
        record.customer = accountName(record.customerId) ?? record.customer ?? '';
        transactions.splice(index, 1, record);
        return json(record);
      }
    }

    return json({ error: 'Unsupported mock operation' }, 405);
  };

  function accountName(id) {
    return accounts.find((a) => a.ID === Number(id))?.name;
  }

  async function readBody(init) {
    if (!init || init.body == null) return {};
    if (typeof init.body === 'string') {
      try { return JSON.parse(init.body); } catch { /* not JSON */ }
      return Object.fromEntries(new URLSearchParams(init.body));
    }
    if (init.body instanceof URLSearchParams) return Object.fromEntries(init.body);
    return {};
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

  function addDays(date, days) {
    const copy = new Date(date);
    copy.setDate(copy.getDate() + days);
    return copy;
  }

  function toDateString(date) {
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0')
    ].join('-');
  }
})();
