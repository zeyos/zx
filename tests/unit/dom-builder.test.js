import assert from 'node:assert/strict';
import test from 'node:test';

import {
  __, appendCompact, appendCompactChild, appendContent, applyCompactProperties,
  fireCompactEvent, fragment, offCompactEvent, onCompactEvent, parseCompactTag
} from '../../src/core/dom.js';
import { installGlobals } from '../../src/compat/globals.js';

test('compact tags preserve the established tag#id.class grammar', () => {
  assert.deepEqual(parseCompactTag('button#save.primary wide'), {
    tag: 'button', id: 'save', className: 'primary wide'
  });
  assert.deepEqual(parseCompactTag('.d-f fwr'), { tag: 'div', id: '', className: 'd-f fwr' });
  assert.deepEqual(parseCompactTag('#save.primary'), { tag: 'div', id: 'save', className: 'primary' });
  assert.deepEqual(parseCompactTag('button.primary#save'), {
    tag: 'button', id: '', className: 'primary#save'
  });
  assert.deepEqual(parseCompactTag('div.one.two'), { tag: 'div', id: '', className: 'one.two' });
  assert.deepEqual(parseCompactTag(''), { tag: 'div', id: '', className: '' });
  assert.throws(() => parseCompactTag(null), /must be a string/);
});

test('the builder applies ZeyOS property prefixes, safe text, and element defaults', () => {
  withFakeDocument(() => {
    const element = __('button#save.primary wide', {
      Daction: 'save',
      SfontSize: '12px',
      disabled: true,
      title: 'Save invoice',
      'aria-label': 'Save'
    }, '<strong>Save</strong>');

    assert.equal(element.tagName, 'BUTTON');
    assert.equal(element.id, 'save');
    assert.equal(element.className, 'primary wide');
    assert.equal(element.type, 'button');
    assert.equal(element.disabled, true);
    assert.equal(element.title, 'Save invoice');
    assert.equal(element.attributes.get('data-action'), 'save');
    assert.equal(element.attributes.get('aria-label'), 'Save');
    assert.equal(element.style.fontSize, '12px');
    assert.equal(element.textContent, '<strong>Save</strong>');

    const anchor = __('a', { href: '/invoices' }, 'Invoices');
    assert.equal(anchor.rel, 'noopener');
    assert.equal(anchor.tabIndex, -1);
    assert.equal(anchor.href, '/invoices');

    const input = __('input');
    assert.equal(input.autocomplete, 'off');
    assert.equal(input.autocorrect, 'off');
    assert.equal(input.autocapitalize, 'none');
    assert.equal(input.spellcheck, false);

    const textarea = __('textarea');
    assert.equal(textarea.autocomplete, 'off');

    const inherited = { lang: 'de' };
    const properties = Object.create(inherited);
    properties.Drecord = 42;
    applyCompactProperties(element, properties);
    assert.equal(element.lang, 'de');
    assert.equal(element.attributes.get('data-record'), '42');
    assert.throws(() => applyCompactProperties(element, { onclick: 'alert(1)' }), /must be a function/);
    assert.equal(element.attributes.has('onclick'), false);
  });
});

test('compact events share registration, removal, firing, arguments, and cancellation', () => {
  withFakeDocument(() => {
    const calls = [];
    const element = __('button');
    function first(event, target) { calls.push(['first', event.type, target, this]); }
    function second(event, target) {
      calls.push(['second', event.type, target, this]);
      return false;
    }
    applyCompactProperties(element, { onclick: first });
    onCompactEvent(element, 'click', second);
    onCompactEvent(element, 'click', second);

    const target = { marker: true };
    const event = fakeEvent('click', target);
    element.fire('click', event);
    assert.deepEqual(calls.map(([name, type]) => [name, type]), [
      ['second', 'click'], ['second', 'click'], ['first', 'click']
    ]);
    assert.equal(calls[0][2], target);
    assert.equal(calls[0][3], element);
    assert.equal(event.defaultPrevented, true);

    calls.length = 0;
    offCompactEvent(element, 'click', second);
    fireCompactEvent(element, 'click');
    assert.deepEqual(calls.map(([name]) => name), ['second', 'first']);

    let keyCode = null;
    onCompactEvent(element, 'keydown', (_event, which) => { keyCode = which; });
    fireCompactEvent(element, 'keydown', fakeEvent('keydown', element, 13));
    assert.equal(keyCode, 13);

    const routed = [];
    onCompactEvent(element, 'change', () => routed.push('change'));
    fireCompactEvent(element, 'click', fakeEvent('change', element));
    assert.deepEqual(routed, ['change']);
    fireCompactEvent(element, 'input', fakeEvent('change', element));
    assert.deepEqual(routed, ['change']);
  });
});

test('builder content is exact while providers and fragments are explicit extensions', () => {
  withFakeDocument(() => {
    const provided = __('span', null, 'component');
    assert.equal(__('span', null, false).textContent, 'false');
    assert.equal(__('span', null, 0).textContent, '0');
    assert.equal(__('span', null, { toElement: () => provided }).children[0], provided);
    const nativeWithProviderName = __('i', null, 'native');
    nativeWithProviderName.toElement = () => provided;
    assert.equal(__('span', null, nativeWithProviderName).children[0], nativeWithProviderName);
    assert.throws(() => __('span', null, ['not', 'flattened']), /Node/);
    assert.throws(() => __('span', null, { plain: true }), /Node/);

    const result = fragment('before', [__('b', null, 'bold'), { toElement: () => provided }], 7);
    assert.equal(result.children.length, 4);
    assert.equal(result.children[0].textContent, 'before');
    assert.equal(result.children[1].tagName, 'B');
    assert.equal(result.children[2], provided);
    assert.equal(result.children[3].textContent, '7');
  });
});

test('pure append helpers preserve parent and child return identities', () => {
  withFakeDocument(() => {
    const root = new FakeElement('div');
    assert.equal(appendCompact(root, 'span.item', null, 'one'), root);
    const second = appendCompactChild(root, 'span', { Dkind: 'second' }, 'two');
    assert.equal(second.parentNode, root);
    assert.equal(appendContent(root, 'tail'), root);
    assert.equal(root.children.length, 3);
  });
});

test('gx global installation never replaces an existing compact builder', () => {
  const builder = () => 'compact';
  const host = { __: builder, String, Array };
  installGlobals(/** @type {typeof globalThis} */ (host));
  assert.equal(host.__, builder);
});

/** @param {() => void} run */
function withFakeDocument(run) {
  const previous = globalThis.document;
  globalThis.document = new FakeDocument();
  try {
    run();
  } finally {
    if (previous === undefined) delete globalThis.document;
    else globalThis.document = previous;
  }
}

class FakeNode {
  constructor(nodeType = 1) {
    this.nodeType = nodeType;
    this.children = [];
    this.parentNode = null;
  }

  appendChild(child) {
    if (!(child instanceof FakeNode)) throw new TypeError('appendChild requires a Node');
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  append(...children) {
    for (const child of children) {
      this.appendChild(child instanceof FakeNode ? child : new FakeText(child));
    }
  }
}

class FakeElement extends FakeNode {
  constructor(tag) {
    super(1);
    this.tagName = String(tag).toUpperCase();
    this.id = '';
    this.className = '';
    this.style = {};
    this.attributes = new Map();
    this.listeners = new Map();
    this.rel = '';
    this.tabIndex = 0;
    this._textContent = '';
  }

  get textContent() {
    if (this.children.length) return this.children.map((child) => child.textContent).join('');
    return this._textContent;
  }

  set textContent(value) {
    this._textContent = String(value);
    this.children = [];
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  addEventListener(type, listener) {
    this.listeners.set(type, listener);
  }

  removeEventListener(type, listener) {
    if (this.listeners.get(type) === listener) this.listeners.delete(type);
  }

  fire(type, event) {
    this.listeners.get(type)?.call(this, event);
  }
}

class FakeText extends FakeNode {
  constructor(value) {
    super(3);
    this.textContent = String(value);
  }
}

class FakeDocument {
  createElement(tag) {
    return new FakeElement(tag);
  }

  createTextNode(value) {
    return new FakeText(value);
  }

  createDocumentFragment() {
    return new FakeNode(11);
  }
}

function fakeEvent(type, target, which = 0) {
  return {
    type,
    target,
    which,
    defaultPrevented: false,
    preventDefault() {
      this.defaultPrevented = true;
    }
  };
}
