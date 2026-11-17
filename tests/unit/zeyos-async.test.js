import assert from 'node:assert/strict';
import test from 'node:test';

import { connect } from '../../src/zeyos/connect.js';
import { zeyosForm } from '../../src/zeyos/form.js';
import { zeyosSelect } from '../../src/zeyos/select.js';

/*
 * The asynchronous edges of the ZeyOS binding: how the connection facade reports a failure, which
 * of two overlapping form loads wins, and when a select's initial-value lookup may still write to
 * the control. The client is a recorded stand-in whose requests resolve when a test says so; the
 * components mount against a small document stand-in.
 */

const TICKET_FIELDS = { ID: { type: 'integer', indexed: true }, name: { type: 'text', indexed: true } };

test('a resource without an operation is reported through onError like a failed request', async () => {
  const reported = [];
  const api = connect(fakeClient(), { onError: (error, context) => reported.push({ error, context }) });
  await assert.rejects(() => api.list('invoices'), RangeError);
  assert.equal(reported.length, 1, 'onError heard the failure');
  assert.ok(reported[0].error instanceof RangeError);
  assert.deepEqual(reported[0].context, { operation: 'list', resource: 'invoices' });
  await assert.rejects(() => api.get('', 1), TypeError);
  assert.equal(reported.length, 2, 'an empty resource name is reported as well');
});

test('only the latest of two overlapping form loads shows its record and is saved', async () => {
  await withDocument(async () => {
    const client = fakeClient();
    const binding = zeyosForm(client, 'tickets', { fields: ['name'], notify: false });
    const first = binding.load(1);
    const second = binding.load(2);
    client.resolve('getTicket', 2, { ID: 2, name: 'Second' });
    await second;
    client.resolve('getTicket', 1, { ID: 1, name: 'First' });
    const late = await first;
    assert.equal(late.name, 'First', 'the earlier call still resolves with its own record');
    assert.equal(binding.form.getValues().name, 'Second', 'but the form keeps the latest record');
    const saving = binding.save();
    await Promise.resolve();
    client.resolve('updateTicket', 2, { ID: 2, name: 'Second' });
    await saving;
    assert.equal(client.requests.find((request) => request.operation === 'updateTicket')?.input.ID, 2,
      'save() updates the record on screen');
    binding.destroy();
  });
});

test('a failed initial form load nobody awaits raises no unhandled rejection', async () => {
  await withDocument(async () => {
    const client = fakeClient();
    const binding = zeyosForm(client, 'tickets', { fields: ['name'], id: 9, notify: false });
    const unhandled = await collectUnhandled(() => client.reject('getTicket', 9, new Error('offline')));
    assert.deepEqual(unhandled, []);
    await assert.rejects(binding.ready, /offline/, 'ready still rejects for a caller that awaits it');
    binding.destroy();
  });
});

test('a selection made while the initial lookup runs wins over the initial id', async () => {
  await withDocument(async () => {
    const client = fakeClient();
    const select = zeyosSelect(client, 'tickets', { value: 1, items: [{ ID: 2, name: 'Two' }] });
    select.set(2);
    client.resolve('getTicket', 1, { ID: 1, name: 'One' });
    assert.equal(await select.ready, select);
    assert.equal(select.value, 2);
    select.destroy();
  });
});

test('the initial lookup leaves a destroyed select alone and its failure is not unhandled', async () => {
  await withDocument(async () => {
    const client = fakeClient();
    const select = zeyosSelect(client, 'tickets', { value: 1 });
    let writes = 0;
    select.setItems = () => { writes += 1; return select; };
    select.destroy();
    client.resolve('getTicket', 1, { ID: 1, name: 'One' });
    await select.ready;
    assert.equal(writes, 0, 'nothing was written to the destroyed select');

    const failing = zeyosSelect(client, 'tickets', { value: 3 });
    const unhandled = await collectUnhandled(() => client.reject('getTicket', 3, new Error('offline')));
    assert.deepEqual(unhandled, []);
    await assert.rejects(failing.ready, /offline/, 'ready still rejects for a caller that awaits it');
    failing.destroy();

    const hydrated = zeyosSelect(client, 'tickets', { value: 4 });
    client.resolve('getTicket', 4, { ID: 4, name: 'Four' });
    await hydrated.ready;
    assert.equal(hydrated.value, 4, 'an untouched select still shows its initial record');
    hydrated.destroy();
  });
});

/**
 * A ZeyOS client stand-in: every request waits until the test resolves or rejects it by operation
 * and record id.
 */
function fakeClient() {
  const requests = [];
  const settle = (operation, id, outcome) => {
    const request = requests.find((entry) => entry.operation === operation && entry.input.ID === id && !entry.settled);
    if (!request) throw new Error(`No pending ${operation} request for ${id}`);
    request.settled = true;
    outcome(request);
  };
  const pending = (operation) => (input) => new Promise((resolve, reject) => {
    requests.push({ operation, input, resolve, reject, settled: false });
  });
  return {
    requests,
    resolve: (operation, id, value) => settle(operation, id, (request) => request.resolve(value)),
    reject: (operation, id, error) => settle(operation, id, (request) => request.reject(error)),
    schema: {
      describe: (resource) => ({ name: resource, type: 'table', fields: resource === 'tickets' ? TICKET_FIELDS : {} }),
      fields: (resource) => resource === 'tickets' ? Object.keys(TICKET_FIELDS) : [],
      operations: (resource) => resource === 'tickets' ? ['listTickets', 'getTicket', 'updateTicket'] : []
    },
    api: {
      listTickets: async () => ({ data: [], count: 0 }),
      getTicket: pending('getTicket'),
      updateTicket: pending('updateTicket')
    }
  };
}

/**
 * Runs `settle`, lets the rejection it causes propagate, and returns the unhandled rejections seen.
 * @param {() => void} settle
 * @returns {Promise<unknown[]>}
 */
async function collectUnhandled(settle) {
  const seen = [];
  const listener = (reason) => { seen.push(reason); };
  process.on('unhandledRejection', listener);
  try {
    settle();
    await new Promise((resolve) => setTimeout(resolve, 10));
  } finally {
    process.off('unhandledRejection', listener);
  }
  return seen;
}

/**
 * Runs `run` with a fake `document` installed until the promise it returns settles.
 * @param {() => Promise<void>} run
 * @returns {Promise<void>}
 */
async function withDocument(run) {
  const previous = globalThis.document;
  globalThis.document = /** @type {any} */ (new FakeDocument());
  try {
    await run();
  } finally {
    if (previous === undefined) delete globalThis.document;
    else globalThis.document = previous;
  }
}

/** @param {any} root @param {(node: any) => boolean} predicate @returns {any[]} */
function findAll(root, predicate) {
  const found = [];
  for (const child of root.children ?? []) {
    if (child.nodeType !== 1) continue;
    if (predicate(child)) found.push(child);
    found.push(...findAll(child, predicate));
  }
  return found;
}

/** @param {any} node @param {string} name @returns {boolean} */
function hasClass(node, name) {
  return String(node.className ?? '').split(/\s+/).includes(name);
}

/*
 * Enough of a document to build and tear down form fields: element creation, the properties
 * `h()` writes, attribute reflection for ids, names, and data attributes, tree movement, a listener
 * store that honours `listen()`'s AbortSignal, and bubbling that honours stopPropagation and
 * stopImmediatePropagation, which the field adapters rely on.
 */
class FakeNode {
  /** @param {number} nodeType */
  constructor(nodeType) {
    this.nodeType = nodeType;
    /** @type {FakeNode[]} */
    this.children = [];
    /** @type {FakeNode|null} */
    this.parentNode = null;
    /** @type {{type: string, fn: Function}[]} */
    this.listeners = [];
  }

  /** @param {string} type @param {Function|{handleEvent: Function}} fn @param {any} [options] */
  addEventListener(type, fn, options = {}) {
    const entry = { type, fn: typeof fn === 'function' ? fn : (event) => fn.handleEvent(event) };
    const signal = options && typeof options === 'object' ? options.signal : null;
    if (signal?.aborted) return;
    this.listeners.push(entry);
    signal?.addEventListener('abort', () => {
      this.listeners = this.listeners.filter((candidate) => candidate !== entry);
    }, { once: true });
  }

  /** @param {string} type @param {Function} fn */
  removeEventListener(type, fn) {
    this.listeners = this.listeners.filter((entry) => entry.type !== type || entry.fn !== fn);
  }

  /** @param {Event} event @returns {boolean} */
  dispatchEvent(event) {
    Object.defineProperty(event, 'target', { configurable: true, value: this });
    let stopped = false;
    let halted = false;
    const stopPropagation = event.stopPropagation.bind(event);
    const stopImmediatePropagation = event.stopImmediatePropagation.bind(event);
    event.stopPropagation = () => { stopped = true; stopPropagation(); };
    event.stopImmediatePropagation = () => { stopped = true; halted = true; stopImmediatePropagation(); };
    for (let node = this; node && !stopped; node = event.bubbles ? node.parentNode : null) {
      Object.defineProperty(event, 'currentTarget', { configurable: true, value: node });
      for (const entry of [...node.listeners]) {
        if (halted) break;
        if (entry.type === event.type) entry.fn.call(node, event);
      }
    }
    return !event.defaultPrevented;
  }

  get childNodes() { return this.children; }
  get isConnected() { return this.parentNode !== null; }

  get nextSibling() {
    const siblings = this.parentNode?.children ?? [];
    return siblings[siblings.indexOf(this) + 1] ?? null;
  }

  /** @param {FakeNode} child @returns {FakeNode} */
  appendChild(child) {
    return this.insertBefore(child, null);
  }

  /** @param {FakeNode} child @param {FakeNode|null} reference @returns {FakeNode} */
  insertBefore(child, reference) {
    child.remove();
    child.parentNode = this;
    const index = reference ? this.children.indexOf(reference) : -1;
    if (index < 0) this.children.push(child);
    else this.children.splice(index, 0, child);
    return child;
  }

  /** @param {...FakeNode} children */
  append(...children) {
    for (const child of children) this.appendChild(child);
  }

  /** @param {...FakeNode} children */
  replaceChildren(...children) {
    for (const child of this.children) child.parentNode = null;
    this.children = [];
    this.append(...children);
  }

  remove() {
    const parent = this.parentNode;
    if (!parent) return;
    parent.children = parent.children.filter((child) => child !== this);
    this.parentNode = null;
  }

  /** @param {FakeNode} node @returns {boolean} */
  contains(node) {
    for (let current = node; current; current = current.parentNode) if (current === this) return true;
    return false;
  }
}

class FakeElement extends FakeNode {
  /** @param {string} tag */
  constructor(tag) {
    super(1);
    this.tagName = String(tag).toUpperCase();
    this.localName = String(tag).toLowerCase();
    Object.assign(this, {
      id: '', className: '', name: '', type: '', value: '', checked: false, disabled: false,
      required: false, readOnly: false, hidden: false, placeholder: '', htmlFor: '', inputMode: '',
      autocomplete: '', spellcheck: true, tabIndex: 0, title: ''
    });
    /** @type {Record<string, string>} */
    this.dataset = {};
    this.style = { setProperty() {}, removeProperty() {} };
    /** @type {Map<string, string>} */
    this.attributeMap = new Map();
    const element = this;
    this.classList = {
      contains: (name) => hasClass(element, name),
      add: (...names) => { for (const name of names) if (!hasClass(element, name)) element.className = `${element.className} ${name}`.trim(); },
      remove: (...names) => { element.className = element.className.split(/\s+/).filter((part) => part && !names.includes(part)).join(' '); },
      toggle: (name, force) => {
        const on = force ?? !hasClass(element, name);
        if (on) element.classList.add(name); else element.classList.remove(name);
        return on;
      }
    };
    this._text = '';
  }

  get attributes() {
    return [...this.attributeMap].map(([name, value]) => ({ name, value }));
  }

  get textContent() {
    return this.children.length ? this.children.map((child) => child.textContent).join('') : this._text;
  }

  set textContent(value) {
    this._text = String(value ?? '');
    this.replaceChildren();
  }

  /** @param {string} name @param {unknown} value */
  setAttribute(name, value) {
    const text = String(value);
    if (name.startsWith('data-')) this.dataset[camel(name.slice(5))] = text;
    else if (name === 'id' || name === 'name') this[name] = text;
    else if (name === 'class') this.className = text;
    else this.attributeMap.set(name, text);
  }

  /** @param {string} name @returns {string|null} */
  getAttribute(name) {
    if (name.startsWith('data-')) return this.dataset[camel(name.slice(5))] ?? null;
    if (name === 'id' || name === 'name') return this[name] || null;
    if (name === 'class') return this.className || null;
    return this.attributeMap.get(name) ?? null;
  }

  /** @param {string} name */
  removeAttribute(name) {
    if (name.startsWith('data-')) delete this.dataset[camel(name.slice(5))];
    else if (name === 'id' || name === 'name') this[name] = '';
    else if (name === 'class') this.className = '';
    else this.attributeMap.delete(name);
  }

  /** @param {string} name @returns {boolean} */
  hasAttribute(name) {
    return this.getAttribute(name) !== null;
  }

  /** @param {string} name @param {boolean} [force] @returns {boolean} */
  toggleAttribute(name, force) {
    const on = force ?? !this.hasAttribute(name);
    if (on) this.setAttribute(name, '');
    else this.removeAttribute(name);
    return on;
  }

  /** Tag lists and single classes only — what the adapters ask for. @param {string} selector */
  querySelectorAll(selector) {
    const parts = selector.split(',').map((part) => part.trim());
    return findAll(this, (node) => parts.some((part) => (part.startsWith('.')
      ? hasClass(node, part.slice(1))
      : node.localName === part)));
  }

  /** @param {string} selector */
  querySelector(selector) {
    return this.querySelectorAll(selector)[0] ?? null;
  }

  focus() {}
  blur() {}
}

class FakeText extends FakeNode {
  /** @param {unknown} value */
  constructor(value) {
    super(3);
    this.textContent = String(value);
  }
}

class FakeDocument {
  /** @param {string} tag */
  createElement(tag) { return new FakeElement(tag); }
  /** @param {string} _namespace @param {string} tag */
  createElementNS(_namespace, tag) { return new FakeElement(tag); }
  /** @param {unknown} value */
  createTextNode(value) { return new FakeText(value); }
  querySelector() { return null; }
  addEventListener() {}
  removeEventListener() {}
  get documentElement() { return null; }
}

/** @param {string} name @returns {string} */
function camel(name) {
  return name.replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase());
}
