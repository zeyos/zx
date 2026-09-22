import assert from 'node:assert/strict';
import test from 'node:test';

import { CardView } from '../../src/components/card-view/card-view.js';
import { tableOptionsForView } from '../../src/components/table-view/table-view.js';
import { normalizeViewFieldControls } from '../../src/components/view/record-view.js';

/*
 * `fieldControls` defaults to on, so every existing consumer depends on `true` and `false` meaning
 * exactly what they meant before the option grew a third shape. These tests drive the real
 * `CardView` render/destroy path against a small document stand-in — the chooser is built by
 * `RecordView`, so what holds here holds for every concrete view that mounts it.
 */

const FIELDS = [
  { id: 'name', label: 'Name', sortable: true },
  { id: 'stage', label: 'Stage' }
];

test('the three fieldControls shapes normalize to one decision', () => {
  assert.deepEqual(normalizeViewFieldControls(true),
    { enabled: true, custom: false, label: null, target: null });
  assert.deepEqual(normalizeViewFieldControls(false),
    { enabled: false, custom: false, label: null, target: null });
  assert.deepEqual(normalizeViewFieldControls(undefined),
    { enabled: false, custom: false, label: null, target: null });

  const target = { nodeType: 1 };
  assert.deepEqual(normalizeViewFieldControls({ label: 'Spalten', target }),
    { enabled: true, custom: true, label: 'Spalten', target });
  assert.deepEqual(normalizeViewFieldControls({}),
    { enabled: true, custom: true, label: null, target: null });
  // An object always enables the control; only its wording and mount point are configurable.
  assert.equal(normalizeViewFieldControls({ label: '' }).enabled, true);
  assert.equal(normalizeViewFieldControls({ label: '' }).label, '');
});

test('fieldControls true and false keep rendering exactly as they did', () => {
  withDocument(() => {
    const on = new CardView(null, { fields: FIELDS, data: [] });
    const toolbar = findClass(on.el, 'zx-card-view__toolbar');
    const controls = findClass(on.el, 'zx-record-view__field-controls');
    assert.ok(controls, 'the chooser is rendered by default');
    assert.equal(controls.parentNode, toolbar, 'and it sits in the view toolbar');
    assert.equal(textOf(findTag(controls, 'SUMMARY')), 'Fields');
    assert.equal('mounted' in controls.dataset, false);
    on.destroy();

    const off = new CardView(null, { fields: FIELDS, data: [], fieldControls: false });
    assert.equal(findClass(off.el, 'zx-record-view__field-controls'), null);
    off.destroy();
  });
});

test('an options object keeps the control in the view and customises its label', () => {
  withDocument(() => {
    const labelled = new CardView(null, {
      fields: FIELDS, data: [], fieldControls: { label: 'Spalten' }
    });
    const controls = findClass(labelled.el, 'zx-record-view__field-controls');
    assert.equal(controls.parentNode, findClass(labelled.el, 'zx-card-view__toolbar'));
    assert.equal(textOf(findTag(controls, 'SUMMARY')), 'Spalten');
    labelled.destroy();

    const bare = new CardView(null, { fields: FIELDS, data: [], fieldControls: {} });
    assert.equal(textOf(findTag(findClass(bare.el, 'zx-record-view__field-controls'), 'SUMMARY')),
      'Fields', 'an omitted label falls back to the built-in English text');
    bare.destroy();
  });
});

test('an omitted label reads the recordView.fields message', () => {
  withDocument(() => {
    const view = new CardView(null, {
      fields: FIELDS, data: [], fieldControls: {}, msg: { 'recordView.fields': 'Felder' }
    });
    assert.equal(textOf(findTag(findClass(view.el, 'zx-record-view__field-controls'), 'SUMMARY')),
      'Felder');
    view.destroy();

    // An explicit label still wins: a host that hard-codes one is not overruled by a translator.
    const explicit = new CardView(null, {
      fields: FIELDS, data: [], fieldControls: { label: 'Spalten' },
      msg: { 'recordView.fields': 'Felder' }
    });
    assert.equal(textOf(findTag(findClass(explicit.el, 'zx-record-view__field-controls'), 'SUMMARY')),
      'Spalten');
    explicit.destroy();
  });
});

test('a target mounts the chooser in the host element and keeps driving the same view', () => {
  withDocument(() => {
    const host = document.createElement('div');
    host.append(document.createElement('button'));
    const before = [...host.childNodes];

    /** @type {string[][]} */
    const visibility = [];
    const view = new CardView(null, {
      fields: FIELDS,
      data: [],
      fieldControls: { label: 'Columns', target: host },
      onfieldvisibilitychange: ({ detail }) => visibility.push(detail.hidden)
    });

    const controls = findClass(host, 'zx-record-view__field-controls');
    assert.ok(controls, 'the disclosure is mounted into the host element');
    assert.equal(controls.dataset.mounted, 'external');
    assert.equal(findClass(view.el, 'zx-record-view__field-controls'), null,
      'and no longer into the view toolbar');
    assert.equal(textOf(findTag(controls, 'SUMMARY')), 'Columns');

    // The control is wired to the view it was created by, not to where it happens to sit.
    const toggle = findClass(controls, 'zx-record-view__field-toggle');
    assert.equal(toggle.value, 'name');
    const stage = [...controls.querySelectorAll('.zx-record-view__field-toggle')]
      .find((input) => input.value === 'stage');
    stage.checked = false;
    stage.dispatchEvent(new Event('change', { bubbles: true }));
    assert.deepEqual(view.getHiddenFields(), ['stage']);
    assert.deepEqual(visibility, [['stage']]);

    view.destroy();
    assert.equal(findClass(host, 'zx-record-view__field-controls'), null,
      'destroy() removes the disclosure from the host');
    assert.deepEqual([...host.childNodes], before, 'and leaves the target as it was found');
  });
});

test('destroying twice is safe and an unresolvable target falls back to the view', () => {
  withDocument(() => {
    const view = new CardView(null, {
      fields: FIELDS, data: [], fieldControls: { target: '#not-in-this-document' }
    });
    const controls = findClass(view.el, 'zx-record-view__field-controls');
    assert.ok(controls, 'an unresolvable target keeps the control usable in the view');
    assert.equal(controls.parentNode, findClass(view.el, 'zx-card-view__toolbar'));
    view.destroy();
    view.destroy();
  });
});

test('the card sort control routes its four literals through _message', () => {
  withDocument(() => {
    const plain = new CardView(null, { fields: FIELDS, data: [] });
    assert.equal(textOf(findClass(plain.el, 'zx-card-view__sort-label')), 'Sort');
    assert.deepEqual(optionTexts(plain), ['Unsorted', 'Name (ascending)', 'Name (descending)']);
    plain.destroy();

    const translated = new CardView(null, {
      fields: FIELDS,
      data: [],
      msg: {
        'cardView.sort': 'Sortierung',
        'cardView.unsorted': 'Unsortiert',
        'cardView.sortAscending': '%1 (aufsteigend)',
        'cardView.sortDescending': '%1 (absteigend)'
      }
    });
    assert.equal(textOf(findClass(translated.el, 'zx-card-view__sort-label')), 'Sortierung');
    assert.deepEqual(optionTexts(translated),
      ['Unsortiert', 'Name (aufsteigend)', 'Name (absteigend)']);
    translated.destroy();
  });
});

test('only a fieldControls object stands Table down from rendering its own chooser', () => {
  const shared = {
    fields: [{ id: 'name', label: 'Name', sortable: true }],
    data: [],
    recordId: 'ID',
    sort: null,
    sortMode: 'local',
    selectable: false,
    hiddenFields: [],
    fieldControls: true,
    emptyText: null
  };
  const enabled = tableOptionsForView({}, shared);
  assert.equal(enabled.columnVisibility, true);
  assert.equal(enabled.columnReorder, true);

  const disabled = tableOptionsForView({}, { ...shared, fieldControls: false });
  assert.equal(disabled.columnVisibility, false);
  assert.equal(disabled.columnReorder, false);

  const custom = tableOptionsForView({}, { ...shared, fieldControls: { label: 'Spalten' } });
  assert.equal(custom.columnVisibility, false, 'TableView renders the shared chooser instead');
  assert.equal(custom.columnReorder, false);
});

/** @param {CardView} view @returns {string[]} */
function optionTexts(view) {
  return /** @type {any} */ (view.refs.sort).children.map((option) => textOf(option));
}

/** @param {any} node @returns {string} */
function textOf(node) {
  return node == null ? '' : String(node.textContent ?? '');
}

/** @param {any} node @param {string} className @returns {any|null} */
function findClass(node, className) {
  return findNode(node, (candidate) => String(candidate.className ?? '').split(/\s+/).includes(className));
}

/** @param {any} node @param {string} tagName @returns {any|null} */
function findTag(node, tagName) {
  return findNode(node, (candidate) => candidate.tagName === tagName);
}

/** @param {any} node @param {(node:any)=>boolean} predicate @returns {any|null} */
function findNode(node, predicate) {
  for (const child of node?.children ?? []) {
    if (predicate(child)) return child;
    const match = findNode(child, predicate);
    if (match) return match;
  }
  return null;
}

/** @param {() => void} run @returns {void} */
function withDocument(run) {
  const previous = globalThis.document;
  globalThis.document = /** @type {any} */ (new FakeDocument());
  try {
    run();
  } finally {
    if (previous === undefined) delete globalThis.document;
    else globalThis.document = previous;
  }
}

/*
 * Enough of a document to build and tear down a record view: element creation, the property
 * surface `h()` writes to, parent/child movement, and a listener store that honours both the
 * `AbortSignal` every `listen()` passes and the bubbling the chooser's delegation relies on.
 */
class FakeNode {
  /** @param {number} [nodeType=1] */
  constructor(nodeType = 1) {
    this.nodeType = nodeType;
    /** @type {FakeNode[]} */
    this.children = [];
    /** @type {FakeNode|null} */
    this.parentNode = null;
    /** @type {{type:string, fn:Function}[]} */
    this.listeners = [];
  }

  /** @param {string} type @param {Function} fn @param {any} [options={}] @returns {void} */
  addEventListener(type, fn, options = {}) {
    const entry = { type, fn };
    this.listeners.push(entry);
    const signal = options && typeof options === 'object' ? options.signal : null;
    signal?.addEventListener('abort', () => {
      this.listeners = this.listeners.filter((candidate) => candidate !== entry);
    }, { once: true });
  }

  /** @param {string} type @param {Function} fn @returns {void} */
  removeEventListener(type, fn) {
    this.listeners = this.listeners.filter((entry) => entry.type !== type || entry.fn !== fn);
  }

  /** @param {Event} event @returns {boolean} */
  dispatchEvent(event) {
    Object.defineProperty(event, 'target', { configurable: true, value: this });
    for (let node = this; node; node = event.bubbles ? node.parentNode : null) {
      Object.defineProperty(event, 'currentTarget', { configurable: true, value: node });
      for (const entry of [...node.listeners]) {
        if (entry.type === event.type) entry.fn.call(node, event);
      }
    }
    return !event.defaultPrevented;
  }

  /** @returns {FakeNode[]} */
  get childNodes() {
    return this.children;
  }

  /** @returns {boolean} */
  get isConnected() {
    return this.parentNode !== null;
  }

  /** @param {FakeNode} child @returns {FakeNode} */
  appendChild(child) {
    if (!(child instanceof FakeNode)) throw new TypeError('appendChild requires a Node');
    child.remove();
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  /** @param {...FakeNode} children @returns {void} */
  append(...children) {
    for (const child of children) this.appendChild(child);
  }

  /** @param {...FakeNode} children @returns {void} */
  replaceChildren(...children) {
    for (const child of this.children) child.parentNode = null;
    this.children = [];
    this.append(...children);
  }

  /** @returns {void} */
  remove() {
    const parent = this.parentNode;
    if (!parent) return;
    parent.children = parent.children.filter((child) => child !== this);
    this.parentNode = null;
  }
}

class FakeElement extends FakeNode {
  /** @param {string} tag */
  constructor(tag) {
    super(1);
    this.tagName = String(tag).toUpperCase();
    this.className = '';
    this.id = '';
    this.value = '';
    this.type = '';
    this.checked = false;
    this.selected = false;
    this.disabled = false;
    this.hidden = false;
    /** @type {Record<string, string>} */
    this.dataset = {};
    this.style = { setProperty() {}, removeProperty() {} };
    /** @type {Map<string, string>} */
    this.attributeMap = new Map();
    this.classList = createClassList(this);
    this._textContent = '';
  }

  /** @returns {{name:string,value:string}[]} */
  get attributes() {
    return [...this.attributeMap].map(([name, value]) => ({ name, value }));
  }

  /** @returns {string} */
  get textContent() {
    return this.children.length
      ? this.children.map((child) => /** @type {any} */ (child).textContent).join('')
      : this._textContent;
  }

  /** @param {unknown} value */
  set textContent(value) {
    this._textContent = String(value);
    this.replaceChildren();
  }

  /** @param {string} name @param {unknown} value @returns {void} */
  setAttribute(name, value) {
    this.attributeMap.set(name, String(value));
  }

  /** @param {string} name @returns {string|null} */
  getAttribute(name) {
    return this.attributeMap.get(name) ?? null;
  }

  /** @param {string} name @returns {void} */
  removeAttribute(name) {
    this.attributeMap.delete(name);
  }

  /** @param {string} selector @returns {FakeElement|null} */
  querySelector(selector) {
    return this.querySelectorAll(selector)[0] ?? null;
  }

  /** Supports the one selector shape the views use internally. @param {string} selector @returns {FakeElement[]} */
  querySelectorAll(selector) {
    if (!selector.startsWith('.') || /[\s:[>]/.test(selector)) return [];
    const className = selector.slice(1);
    /** @type {FakeElement[]} */
    const found = [];
    for (const child of this.children) {
      if (!(child instanceof FakeElement)) continue;
      if (String(child.className ?? '').split(/\s+/).includes(className)) found.push(child);
      found.push(...child.querySelectorAll(selector));
    }
    return found;
  }

  /** @returns {void} */
  focus() {}
}

class FakeText extends FakeNode {
  /** @param {unknown} value */
  constructor(value) {
    super(3);
    this.textContent = String(value);
  }
}

class FakeDocument {
  /** @param {string} tag @returns {FakeElement} */
  createElement(tag) {
    return new FakeElement(tag);
  }

  /** @param {string} _namespace @param {string} tag @returns {FakeElement} */
  createElementNS(_namespace, tag) {
    return new FakeElement(tag);
  }

  /** @param {unknown} value @returns {FakeText} */
  createTextNode(value) {
    return new FakeText(value);
  }

  /** @returns {null} */
  querySelector() {
    return null;
  }
}

/** @param {FakeElement} element @returns {{add:(...names:string[])=>void,remove:(...names:string[])=>void,contains:(name:string)=>boolean}} */
function createClassList(element) {
  const names = () => String(element.className ?? '').split(/\s+/).filter(Boolean);
  return {
    add(...added) {
      element.className = [...new Set([...names(), ...added])].join(' ');
    },
    remove(...removed) {
      element.className = names().filter((name) => !removed.includes(name)).join(' ');
    },
    contains(name) {
      return names().includes(name);
    }
  };
}
