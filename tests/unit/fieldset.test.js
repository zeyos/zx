import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CheckButton, CodeEditor, Datebox, Field, Fieldset, NumberField, Rating, Select, Slider, Timebox, Toggle
} from '../../src/index.js';
import {
  VALUE_METHODS, externalAdapter, readExternalDisabled, readExternalReadonly, readExternalValue
} from '../../src/components/fieldset/external-adapter.js';

/*
 * `Fieldset.addField(id, source)` adopts an element or a component that is not a registered field
 * type. The library's components speak four value dialects and three disabling ones, so the
 * adapter has to read, write, disable, and make read-only each through the component's own API,
 * and forward exactly one `change` per edit. The first half drives the adapter with small fakes of
 * each dialect; the second mounts the real components through a Fieldset against a document
 * stand-in, and checks the `slider` and `code` field types report one `change` per commit.
 */

/* --------------------------------------------------------------- dialect fakes -- */

/** A component-shaped object over a fake element, with whatever accessors a test gives it. */
function fake(methods = {}, tag = 'div') {
  return withDocument(() => Object.assign({ el: document.createElement(tag) }, methods));
}

test('the adapter knows the four value method pairs, in order', () => {
  assert.deepEqual(VALUE_METHODS.map((pair) => pair.join('/')),
    ['getValue/setValue', 'get/set', 'getValues/setValues', 'isChecked/setChecked']);
});

test('get/set components are read and written with the caller\'s silent option', () => {
  const calls = [];
  let value = 3;
  const source = fake({ get: () => value, set(next, options) { calls.push(options); value = next; } });
  const adapter = externalAdapter(source);
  assert.equal(readExternalValue(source), 3);
  adapter.set(5, { silent: false });
  assert.equal(adapter.get(), 5);
  adapter.set(6);
  adapter.set(7, { silent: true });
  assert.deepEqual(calls, [{ silent: false }, { silent: false }, { silent: true }],
    'a write is silent only when the caller asks for it');
});

test('getValue/setValue, getValues/setValues and isChecked/setChecked are each understood', () => {
  let text = 'a';
  const valueSource = fake({ getValue: () => text, setValue: (next) => { text = next; } });
  externalAdapter(valueSource).set('b');
  assert.equal(readExternalValue(valueSource), 'b');

  let list = [1];
  const listSource = fake({ getValues: () => list, setValues: (next) => { list = next; } });
  externalAdapter(listSource).set([2, 3]);
  assert.deepEqual(readExternalValue(listSource), [2, 3]);

  let checked = false;
  const checkSource = fake({ isChecked: () => checked, setChecked: (next) => { checked = next; } });
  externalAdapter(checkSource).set(true);
  assert.equal(readExternalValue(checkSource), true);
});

test('a reader that needs an argument is not a value reader', () => {
  // Fieldset and Form: getValue(id) and setValue(id, value) address one field, not the whole.
  let values = { a: 1 };
  const source = fake({
    getValue: (id) => values[id],
    setValue: (id, value) => { values[id] = value; },
    getValues: () => values,
    setValues: (next) => { values = next; }
  });
  assert.deepEqual(readExternalValue(source), { a: 1 });
  externalAdapter(source).set({ b: 2 });
  assert.deepEqual(values, { b: 2 });
});

test('a Toggle-shaped component reads getValue() and writes set()', () => {
  let on = false;
  const source = fake({ get: () => on, set: (next) => { on = Boolean(next); }, getValue: () => (on ? 'yes' : false) });
  const adapter = externalAdapter(source);
  assert.equal(adapter.get(), false);
  adapter.set('yes');
  assert.equal(on, true);
  assert.equal(adapter.get(), 'yes');
});

test('a value property is used when there are no methods', () => {
  const source = fake({ value: 'x' });
  const adapter = externalAdapter(source);
  adapter.set('y');
  assert.equal(source.value, 'y');
  assert.equal(adapter.get(), 'y');
});

test('native elements read value, or checked for checkboxes and radios', () => {
  withDocument(() => {
    const input = document.createElement('input');
    input.value = 'a';
    const adapter = externalAdapter(input);
    adapter.set('b');
    assert.equal(adapter.get(), 'b');
    adapter.set(null);
    assert.equal(input.value, '');

    const box = document.createElement('input');
    box.type = 'checkbox';
    const check = externalAdapter(box);
    assert.equal(check.get(), false);
    check.set(1);
    assert.equal(box.checked, true);
    check.destroy();
    assert.equal(box.checked, false, 'destroy restores the original checked state');

    assert.equal(readExternalValue(document.createElement('div')), null);
  });
});

test('disabling prefers setDisabled, then enable/disable, then a disabled property', () => {
  const log = [];
  const both = fake({ setDisabled: (state) => log.push(`set ${state}`), enable: () => log.push('enable'), disable: () => log.push('disable') });
  externalAdapter(both).setDisabled(true);
  assert.deepEqual(log, ['set true']);

  log.length = 0;
  const pair = fake({ enable: () => log.push('enable'), disable: () => log.push('disable') });
  const adapter = externalAdapter(pair);
  adapter.setDisabled(true);
  adapter.setDisabled(false);
  assert.deepEqual(log, ['disable', 'enable']);

  const property = fake({ disabled: false });
  externalAdapter(property).setDisabled(true);
  assert.equal(property.disabled, true);
});

test('a plain wrapper is disabled through its controls and restored on destroy', () => {
  withDocument(() => {
    const wrapper = document.createElement('div');
    const first = document.createElement('input');
    const second = document.createElement('button');
    second.disabled = true;
    wrapper.append(first, second);
    assert.equal(readExternalDisabled(wrapper), false);
    const adapter = externalAdapter(wrapper);
    adapter.setDisabled(true);
    assert.equal(wrapper.getAttribute('aria-disabled'), 'true');
    assert.equal(first.disabled, true);
    assert.equal(readExternalDisabled(wrapper), true);
    adapter.setDisabled(false);
    assert.equal(first.disabled, false);
    assert.equal(second.disabled, true, 'a control disabled before stays disabled');
    adapter.setDisabled(true);
    adapter.destroy();
    assert.equal(first.disabled, false);
    assert.equal(second.disabled, true);
    assert.equal(wrapper.getAttribute('aria-disabled'), null);
  });
});

test('disabled state is read from isDisabled, the element, its attributes, or its controls', () => {
  assert.equal(readExternalDisabled(fake({ isDisabled: () => true })), true);
  assert.equal(readExternalDisabled(fake({ disabled: true })), true);
  withDocument(() => {
    const input = document.createElement('input');
    input.disabled = true;
    assert.equal(readExternalDisabled(input), true);
    const flagged = document.createElement('div');
    flagged.setAttribute('data-disabled', '');
    assert.equal(readExternalDisabled(flagged), true);
    flagged.setAttribute('data-disabled', 'false');
    assert.equal(readExternalDisabled(flagged), false);
    flagged.setAttribute('aria-disabled', 'true');
    assert.equal(readExternalDisabled(flagged), true);
  });
});

test('read-only goes through setReadonly, setReadOnly, a property, or the element', () => {
  const log = [];
  externalAdapter(fake({ setReadonly: (state) => log.push(`readonly ${state}`) })).setReadonly?.(true);
  externalAdapter(fake({ setReadOnly: (state) => log.push(`readOnly ${state}`) })).setReadonly?.(true);
  assert.deepEqual(log, ['readonly true', 'readOnly true']);
  const property = fake({ readonly: false });
  externalAdapter(property).setReadonly?.(true);
  assert.equal(property.readonly, true);
  assert.equal(externalAdapter(fake({ get: () => 1 })).setReadonly, undefined,
    'a component with no read-only state offers none');
  withDocument(() => {
    const input = document.createElement('input');
    const adapter = externalAdapter(input);
    adapter.setReadonly?.(true);
    assert.equal(input.readOnly, true);
    assert.equal(readExternalReadonly(input), true);
    adapter.destroy();
    assert.equal(input.readOnly, false, 'destroy restores the original read-only state');
  });
});

test('destroy undoes a disabled state set through the component', () => {
  let disabled = false;
  const source = fake({ enable: () => { disabled = false; }, disable: () => { disabled = true; }, isDisabled: () => disabled });
  const adapter = externalAdapter(source);
  adapter.setDisabled(true);
  assert.equal(disabled, true);
  adapter.destroy();
  assert.equal(disabled, false);
});

test('a component change becomes one field change; the native change it already reported does not', () => {
  withDocument(() => {
    const target = new EventTarget();
    let value = 1;
    const source = Object.assign(target, {
      el: document.createElement('div'),
      get: () => value,
      set: (next) => { value = next; }
    });
    const input = document.createElement('input');
    source.el.append(input);
    const emitted = [];
    let generic = 0;
    // Field.listen(): every listener is tied to the field's signal, aborted by Field.destroy().
    const lifetime = new AbortController();
    const field = {
      emit: (type, detail) => emitted.push([type, detail]),
      listen: (element, type, fn) => element.addEventListener(type, fn, { signal: lifetime.signal })
    };
    const adapter = externalAdapter(source, /** @type {any} */ (field));
    // What Field registers after the adapter: its own listener for native changes.
    source.el.addEventListener('change', () => { generic += 1; });

    // The component reports the edit, then its input's native change bubbles out.
    value = 2;
    source.dispatchEvent(new CustomEvent('change', { detail: { value } }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    assert.deepEqual(emitted, [['change', { value: 2 }]]);
    assert.equal(generic, 0, 'the reported edit reached the Field a second time');

    // A component that never reports (Search, CopyInput): its input's change is the edit.
    value = 3;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    assert.equal(generic, 1);

    // A programmatic set never echoes back as a change.
    adapter.set(4);
    source.dispatchEvent(new CustomEvent('change', { detail: { value: 4 } }));
    assert.equal(emitted.length, 2, 'a change after set is a new edit');
    adapter.destroy();
    lifetime.abort();
    source.dispatchEvent(new CustomEvent('change', { detail: { value: 5 } }));
    assert.equal(emitted.length, 2, 'destroying the field unsubscribes from the component');
  });
});

/* -------------------------------------------------------- the real components -- */

test('Fieldset reads, writes, disables and releases every value component', () => {
  withDocument(() => {
    const due = new Date(2026, 6, 20);
    const later = new Date(2026, 6, 22);
    const sources = {
      count: new NumberField(null, { value: 1, min: 0, max: 10 }),
      owner: new Select(null, { items: [{ ID: 1, name: 'One' }, { ID: 2, name: 'Two' }], value: 1 }),
      share: new Slider(null, { label: 'Share', value: 10 }),
      score: new Rating(null, { value: 1 }),
      active: new Toggle(null, { label: 'Active', value: 'yes' }),
      pinned: new CheckButton(null, { label: 'Pinned' }),
      due: new Datebox(null, { value: due }),
      spent: new Timebox(null, { value: 60 }),
      notes: new CodeEditor(null, { value: 'a' })
    };
    const fieldset = new Fieldset(null, {});
    for (const [key, source] of Object.entries(sources)) fieldset.addField(key, source);

    const values = fieldset.getValues();
    assert.deepEqual({ ...values, due: undefined }, {
      count: 1, owner: 1, share: 10, score: 1, active: false, pinned: false, due: undefined, spent: 60, notes: 'a'
    });
    assert.equal(values.due.getTime(), due.getTime());

    fieldset.setValues({ count: 4, owner: 2, share: 30, score: 3, active: true, pinned: true, due: later, spent: 90, notes: 'b' });
    assert.equal(sources.count.get(), 4);
    assert.equal(sources.owner.get(), 2);
    assert.equal(sources.share.get(), 30);
    assert.equal(sources.score.get(), 3);
    assert.equal(sources.active.get(), true);
    assert.equal(fieldset.getValue('active'), 'yes', 'Toggle reads its on-value, as the toggle type does');
    assert.equal(sources.pinned.get(), true);
    assert.equal(sources.due.get().getTime(), later.getTime());
    assert.equal(sources.spent.get(), 90);
    assert.equal(sources.notes.getValue(), 'b');

    for (const field of Object.values(fieldset.getFields())) field.setDisabled(true);
    assert.equal(sources.count.refs.input.disabled, true);
    assert.equal(sources.owner.refs.input.disabled, true);
    assert.equal(sources.share.refs.input.disabled, true);
    assert.equal(sources.score.el.getAttribute('aria-disabled'), 'true');
    assert.equal(sources.active.el.hasAttribute('disabled'), true);
    assert.equal(sources.pinned.el.hasAttribute('disabled'), true);
    assert.equal(sources.due.refs.input.disabled, true);
    assert.equal(sources.spent.el.getAttribute('aria-disabled'), 'true');
    assert.equal(sources.notes.el.dataset.disabled, 'true');
    for (const source of Object.values(sources)) {
      assert.equal(readExternalDisabled(source), true, `${source.constructor.name} does not read back disabled`);
    }

    fieldset.getField('count').setReadonly(true);
    fieldset.getField('share').setReadonly(true);
    fieldset.getField('score').setReadonly(true);
    fieldset.getField('notes').setReadonly(true);
    assert.equal(sources.count.refs.input.readOnly, true);
    assert.equal(sources.share.el.hasAttribute('data-readonly'), true);
    assert.equal(sources.score.el.hasAttribute('data-readonly'), true);
    assert.equal(sources.notes.el.dataset.readonly, 'true');

    fieldset.destroy();
    for (const [key, source] of Object.entries(sources)) {
      assert.equal(readExternalDisabled(source), false, `${key} stayed disabled after release`);
      assert.equal(readExternalReadonly(source), false, `${key} stayed read-only after release`);
      assert.equal(source.el.parentNode, null, `${key} stayed in the fieldset`);
      source.destroy();
    }
  });
});

test('an adopted component reports one field change per edit', () => {
  withDocument(() => {
    const count = new NumberField(null, { value: 1, min: 0, max: 10 });
    const active = new Toggle(null, { label: 'Active' });
    const fieldset = new Fieldset(null, { fields: { count, active } });
    const changes = { count: [], active: [] };
    for (const key of ['count', 'active']) fieldset.getField(key).on('change', (event) => changes[key].push(event.detail.value));

    count.stepUp();
    count.refs.input.dispatchEvent(new Event('change', { bubbles: true }));
    active.toggle();
    fieldset.setValue('count', 5);
    assert.deepEqual(changes, { count: [2, 5], active: [true] });
    fieldset.destroy();
    active.toggle();
    assert.deepEqual(changes.active, [true], 'a released component still reported to the field');
    count.destroy();
    active.destroy();
  });
});

test('an adopted Select hears its own change when the fieldset sets it, unless silent', () => {
  withDocument(() => {
    const owner = new Select(null, { items: [{ ID: 1, name: 'One' }, { ID: 2, name: 'Two' }, { ID: 3, name: 'Three' }], value: 1 });
    const own = [];
    owner.on('change', (event) => own.push(event.detail.value));
    const fieldset = new Fieldset(null, { fields: { owner } });
    const field = [];
    fieldset.getField('owner').on('change', (event) => field.push(event.detail.value));

    fieldset.setValues({ owner: 2 });
    assert.deepEqual(own, [2], 'the Select\'s own listener missed the write');
    assert.deepEqual(field, [2], 'one field change per write');

    fieldset.setValues({ owner: 3 }, { silent: true });
    assert.equal(owner.get(), 3);
    assert.deepEqual(own, [2], 'a silent write reached the Select\'s listeners');
    assert.deepEqual(field, [2], 'a silent write emitted a field change');

    fieldset.setValue('owner', 1);
    assert.deepEqual(own, [2, 1]);
    assert.deepEqual(field, [2, 1]);

    fieldset.reset();
    assert.deepEqual(own, [2, 1], 'reset restores silently');
    assert.equal(owner.get(), 1);
    fieldset.destroy();
    owner.destroy();
  });
});

test('slider and code fields emit one change per commit, and input while editing', () => {
  withDocument(() => {
    const slider = new Field(null, { type: 'slider', label: 'Share', value: 10 });
    const code = new Field(null, { type: 'code', label: 'Source', value: '' });
    const counts = { slider: { change: 0, input: 0 }, code: { change: 0, input: 0 } };
    for (const [name, field] of [['slider', slider], ['code', code]]) {
      field.on('change', () => { counts[name].change += 1; });
      field.on('input', () => { counts[name].input += 1; });
    }

    const range = slider.getInput().querySelectorAll('input').find((input) => input.type === 'range');
    for (const step of ['20', '30']) {
      range.value = step;
      range.dispatchEvent(new Event('input', { bubbles: true }));
    }
    range.dispatchEvent(new Event('change', { bubbles: true }));
    assert.deepEqual(counts.slider, { change: 1, input: 2 });
    assert.equal(slider.getValue(), 30);

    const textarea = code.getInput().querySelector('textarea');
    for (const text of ['a', 'ab', 'abc']) {
      textarea.value = text;
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    }
    assert.deepEqual(counts.code, { change: 0, input: 3 }, 'code emitted change while typing');
    textarea.dispatchEvent(new Event('change', { bubbles: true }));
    assert.deepEqual(counts.code, { change: 1, input: 3 });
    assert.equal(code.getValue(), 'abc');

    code.setReadonly(true);
    assert.equal(textarea.readOnly, true);
    assert.equal(code.el.dataset.readonly, 'true');
    slider.destroy();
    code.destroy();
  });
});

/* ------------------------------------------------------------ document stand-in -- */

/**
 * Runs `run` with a fake `document` installed, returning what it returns.
 * @template T
 * @param {() => T} run
 * @returns {T}
 */
function withDocument(run) {
  const previous = globalThis.document;
  globalThis.document = /** @type {any} */ (new FakeDocument());
  try {
    return run();
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
