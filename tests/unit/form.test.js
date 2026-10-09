import assert from 'node:assert/strict';
import test from 'node:test';

import { Component, Field, Fieldset, Form } from '../../src/index.js';

/*
 * A field key names a value, not an element. These tests mount real Forms, Fieldsets, and Fields
 * against a small document stand-in and check the ids, names, and labels they generate: a key
 * never becomes a DOM id by itself, a form mounted twice repeats no id, and `idPrefix` makes the
 * ids predictable when an application needs to address them.
 */

const CONTACT = {
  stage: { type: 'text', label: 'Stage', value: 'lead' },
  email: { type: 'text', label: 'Email' },
  channel: { type: 'optionlist', label: 'Channel', value: 'email', options: { email: 'Email', phone: 'Phone' } }
};

test('field keys are not DOM ids, and a form mounted twice repeats no id', () => {
  withDocument(() => {
    const first = new Form(null, { fieldsets: [{ fields: CONTACT }] });
    const second = new Form(null, { fieldsets: [{ fields: CONTACT }] });
    const ids = [...allIds(first.el), ...allIds(second.el)];
    assert.ok(ids.length > 0);
    assert.equal(new Set(ids).size, ids.length, `duplicate ids: ${ids.join(', ')}`);
    for (const key of Object.keys(CONTACT)) assert.ok(!ids.includes(key), `"${key}" became a DOM id`);

    const stage = first.getField('stage');
    assert.equal(stage.el.dataset.fieldId, 'stage', 'data-field-id keeps carrying the key');
    assert.equal(stage.name, 'stage', 'the key stays the field name');
    assert.equal(stage.getInput().name, 'stage', 'and the native control name');
    assert.equal(findTag(stage.el, 'LABEL').htmlFor, stage.getInput().id, 'the label still points at its control');
    assert.notEqual(stage.getInput().id, second.getField('stage').getInput().id);

    // The radios of one group share a name that belongs to this form instance alone.
    const radios = (form) => findAll(form.getField('channel').el, (node) => node.type === 'radio');
    const names = new Set(radios(first).map((radio) => radio.name));
    assert.equal(names.size, 1);
    assert.ok(!names.has('channel'), 'the key is not the radio group name');
    assert.ok(!radios(second).some((radio) => names.has(radio.name)), 'two mounts share a radio group');

    assert.deepEqual(first.getValues(), { stage: 'lead', email: '', channel: 'email' });
    first.destroy();
    second.destroy();
  });
});

test('idPrefix makes the generated ids predictable', () => {
  withDocument(() => {
    const form = new Form(null, {
      idPrefix: 'deal',
      fieldsets: [{ fields: { stage: CONTACT.stage } }, { idPrefix: 'owner', fields: { email: CONTACT.email } }]
    });
    const stage = form.getField('stage');
    assert.equal(stage.getInput().id, 'deal-stage');
    assert.equal(stage.getInput().getAttribute('aria-describedby'), null);
    assert.equal(findTag(stage.el, 'LABEL').id, 'deal-stage-label');
    assert.equal(form.getField('email').getInput().id, 'owner-email', "a fieldset's own prefix wins");
    form.destroy();

    const fieldset = new Fieldset(null, { idPrefix: 'contact', fields: { 'first name': { label: 'First name' } } });
    assert.equal(fieldset.getField('first name').getInput().id, 'contact-first-name');
    fieldset.destroy();
  });
});

test('an explicit id is honoured, a restated key is not', () => {
  withDocument(() => {
    const fieldset = new Fieldset(null, {
      idPrefix: 'p',
      fields: {
        stage: { id: 'stage', label: 'Stage' },
        owner: { id: 'deal-owner', label: 'Owner' }
      }
    });
    assert.equal(fieldset.getField('stage').getInput().id, 'p-stage');
    assert.equal(fieldset.getField('owner').getInput().id, 'deal-owner');
    assert.equal(fieldset.getField('owner').name, 'owner');
    fieldset.destroy();

    // A standalone field still takes its id as given, and falls back to it for its name.
    const field = new Field(null, { id: 'name', label: 'Name' });
    assert.equal(field.getInput().id, 'name');
    assert.equal(field.getInput().name, 'name');
    field.destroy();
    const anonymous = new Field(null, { label: 'Anonymous' });
    assert.equal(anonymous.name, '');
    assert.equal(anonymous.getInput().name, '');
    anonymous.destroy();
  });
});

test('a checklist inside a field takes its name from the field label and repeats no heading', () => {
  withDocument(() => {
    const field = new Field(null, {
      type: 'checklist', label: 'Permissions', value: ['read'],
      props: { items: [{ ID: 'read', name: 'Read' }, { ID: 'write', name: 'Write' }] }
    });
    const root = field.getInput();
    assert.equal(findAll(root, (node) => hasClass(node, 'zx-checklist__label')).length, 0,
      'the checklist heading is not drawn under the field label');
    const label = findTag(field.el, 'LABEL');
    assert.equal(root.getAttribute('aria-labelledby'), label.id);
    assert.equal(label.textContent, 'Permissions');
    assert.deepEqual(field.getValue(), ['read']);
    field.destroy();
  });
});

test('date fields keep no room for a clear button they cannot show', () => {
  withDocument(() => {
    const form = new Form(null, {
      fieldsets: [{
        fields: {
          due: { type: 'date', label: 'Due', value: new Date(2026, 0, 1), props: { clearable: false } },
          start: { type: 'date', label: 'Start', value: new Date(2026, 0, 1) },
          period: {
            type: 'daterange', label: 'Period', disabled: true,
            value: { start: new Date(2026, 0, 1), end: new Date(2026, 0, 5) }
          }
        }
      }]
    });
    const box = (key) => Component.from(form.getField(key).getInput());
    assert.equal(box('due').el.hasAttribute('data-clearable'), false, 'no clear padding without clearable');
    assert.equal(box('start').el.hasAttribute('data-clearable'), true);
    assert.equal(box('start').refs.clear.hidden, false);

    // A disabled box shows no clear button, and gets it back when enabled again.
    assert.equal(box('period').refs.clear.hidden, true);
    form.getField('start').setDisabled(true);
    assert.equal(box('start').refs.clear.hidden, true);
    form.getField('period').setDisabled(false);
    form.getField('start').setDisabled(false);
    assert.equal(box('period').refs.clear.hidden, false);
    assert.equal(box('start').refs.clear.hidden, false);
    form.destroy();
  });
});

/* ------------------------------------------------------------------ helpers -- */

/** @param {any} root @returns {string[]} */
function allIds(root) {
  return findAll(root, (node) => Boolean(node.id)).map((node) => node.id);
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

/** @param {any} root @param {string} tag @returns {any} */
function findTag(root, tag) {
  return findAll(root, (node) => node.tagName === tag)[0] ?? null;
}

/** @param {any} node @param {string} name @returns {boolean} */
function hasClass(node, name) {
  return String(node.className ?? '').split(/\s+/).includes(name);
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
 * Enough of a document to build and tear down form fields: element creation, the properties
 * `h()` writes, attribute reflection for ids, names, and data attributes, tree movement, a listener
 * store that honours `listen()`'s AbortSignal, and bubbling for the `zx-*` events.
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
    for (let node = this; node; node = event.bubbles ? node.parentNode : null) {
      for (const entry of [...node.listeners]) if (entry.type === event.type) entry.fn.call(node, event);
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
