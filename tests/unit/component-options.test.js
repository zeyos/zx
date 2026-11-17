import assert from 'node:assert/strict';
import test from 'node:test';

import { Chart } from '../../src/components/chart/chart.js';
import { Dialog } from '../../src/components/dialog/dialog.js';
import { Search } from '../../src/components/search/search.js';
import { Select } from '../../src/components/select/select.js';
import { Sheet } from '../../src/components/sheet/sheet.js';
import { Table } from '../../src/components/table/table.js';
import { Toggle } from '../../src/components/toggle/toggle.js';
import { Component } from '../../src/core/component.js';

/*
 * An option passed as `undefined` is an option not passed. A wrapper forwards
 * `{ value: props.value, label: props.label }` whether or not the prop was set, and the component
 * then has to read its declared default — not render the text "undefined", lose its row ids, or
 * stop answering Escape. These run the real constructor on a stand-in element, so what is tested
 * is the merge every component goes through.
 */

/** @returns {any} */
function fakeElement() {
  return { nodeType: 1, classList: { contains: () => false, add() {}, remove() {} } };
}

/**
 * Merges options the way a component's constructor does, against that component's own declared
 * defaults (and its ancestors'), without building its DOM.
 * @param {typeof Component} Class Component class whose defaults chain is used.
 * @param {Record<string, unknown>} [options] Options passed to the constructor.
 * @returns {Readonly<Record<string, any>>}
 */
function merged(Class, options) {
  class Probe extends Class {
    render() {
      return this.el;
    }
  }
  // Only the options are of interest: skip the subclass constructor's own DOM work.
  const instance = Reflect.construct(Component, [fakeElement(), options], Probe);
  return instance.options;
}

test('an option passed as undefined keeps the declared default', () => {
  class Base extends Component {
    static defaults = { value: '', size: 'md', closable: true, items: [1, 2] };
  }
  class Derived extends Base {
    static defaults = { size: 'lg', label: 'Derived' };
  }

  const options = merged(Derived, { value: undefined, size: undefined, closable: undefined, label: undefined });
  assert.deepEqual({ ...options }, { value: '', size: 'lg', closable: true, items: [1, 2], label: 'Derived' });

  // A key with no declared default is simply absent, as if it had not been passed.
  assert.equal(Object.hasOwn(merged(Derived, { unknown: undefined }), 'unknown'), false);
  assert.equal(merged(Derived, { unknown: 0 }).unknown, 0);
});

test('null, false, zero and the empty string are values and still override', () => {
  class Probe extends Component {
    static defaults = { value: 'x', closable: true, max: 5, label: 'Label' };
  }
  const options = merged(Probe, { value: null, closable: false, max: 0, label: '' });
  assert.deepEqual({ ...options }, { value: null, closable: false, max: 0, label: '' });
});

test('the options object passed in is not changed', () => {
  class Probe extends Component {
    static defaults = { value: '', msg: { 'probe.a': 'A', 'probe.b': 'B' } };
  }
  const msg = { 'probe.a': undefined, de: { 'probe.b': undefined } };
  const passed = { value: undefined, extra: 1, msg };
  merged(Probe, passed);
  assert.deepEqual(Object.keys(passed), ['value', 'extra', 'msg']);
  assert.equal(passed.value, undefined);
  assert.equal(passed.msg, msg);
  assert.deepEqual(Object.keys(msg), ['probe.a', 'de']);
  assert.deepEqual(Object.keys(msg.de), ['probe.b']);
});

test('an undefined entry inside msg keeps the declared message, at any depth', () => {
  class Probe extends Component {
    static defaults = { msg: { 'probe.a': 'A', 'probe.b': 'B', de: { 'probe.a': 'A (de)' } } };
  }
  const instance = Reflect.construct(Component, [fakeElement(), {
    msg: { 'probe.a': undefined, 'probe.b': 'Mine', de: { 'probe.a': undefined, 'probe.b': 'Meins' } }
  }], Probe);

  assert.deepEqual(instance.options.msg, {
    'probe.a': 'A', 'probe.b': 'Mine', de: { 'probe.a': 'A (de)', 'probe.b': 'Meins' }
  });
  assert.equal(instance.msg('probe.a'), 'A');
  assert.equal(instance.msg('probe.b'), 'Mine');

  // `msg: undefined` altogether leaves the declared table in place.
  const plain = Reflect.construct(Component, [fakeElement(), { msg: undefined }], Probe);
  assert.equal(plain.options.msg['probe.a'], 'A');
  assert.equal(plain.msg('probe.b'), 'B');

  // null inside msg is still a value: it replaces the declared text and reads as "no text here".
  const nulled = Reflect.construct(Component, [fakeElement(), { msg: { 'probe.a': null } }], Probe);
  assert.equal(nulled.options.msg['probe.a'], null);
});

test('the reported options keep their defaults on the components they were reported against', () => {
  const reported = [
    [Search, 'value'],
    [Toggle, 'label'],
    [Table, 'rowId'],
    [Select, 'valueKey'],
    [Dialog, 'closable'],
    [Sheet, 'closeButton'],
    [Chart, 'aspectRatio']
  ];
  for (const [Class, option] of reported) {
    const defaults = merged(Class);
    assert.ok(Object.hasOwn(defaults, option), `${Class.name} declares a default for ${option}`);
    assert.notEqual(defaults[option], undefined);
    assert.deepEqual(merged(Class, { [option]: undefined })[option], defaults[option],
      `${Class.name}: ${option}: undefined keeps the default`);
  }
  assert.equal(merged(Dialog, { closable: undefined }).closable, true);
  assert.equal(merged(Dialog, { closable: null }).closable, null, 'null still overrides');
});

test('an on<event> option passed as undefined registers nothing and leaves no key behind', () => {
  class Probe extends Component {
    static defaults = { value: '' };
  }
  const options = merged(Probe, { onchange: undefined });
  assert.equal(Object.hasOwn(options, 'onchange'), false);
});

test('symbol-keyed options are kept, as a plain assignment kept them', () => {
  class Probe extends Component {
    static defaults = { value: '' };
  }
  const KEY = Symbol('private option');
  const UNSET = Symbol('unset private option');
  const options = merged(Probe, { [KEY]: 1, [UNSET]: undefined });
  assert.equal(options[KEY], 1);
  assert.equal(Object.hasOwn(options, UNSET), false);
});

test('listen() with a signal removes the listener when that signal aborts or the component goes', () => {
  class Probe extends Component {
    render() {
      return this.el;
    }
  }
  const target = new EventTarget();
  const component = new Probe(fakeElement());
  const calls = [];
  const part = new AbortController();
  component.listen(target, 'ping', () => calls.push('part'), { signal: part.signal });
  component.listen(target, 'ping', () => calls.push('life'));
  target.dispatchEvent(new Event('ping'));
  part.abort();
  target.dispatchEvent(new Event('ping'));
  assert.deepEqual(calls, ['part', 'life', 'life'], 'the part listener went with its signal');

  // An already aborted signal adds nothing; destroying the component removes the rest.
  component.listen(target, 'ping', () => calls.push('late'), { signal: part.signal });
  const kept = new AbortController();
  component.listen(target, 'ping', () => calls.push('kept'), { signal: kept.signal });
  component.destroy();
  target.dispatchEvent(new Event('ping'));
  assert.deepEqual(calls, ['part', 'life', 'life']);
});

test('a once listener with a signal unlinks itself from that signal after it runs', () => {
  class Probe extends Component {
    render() {
      return this.el;
    }
  }
  const target = new EventTarget();
  const component = new Probe(fakeElement());
  const part = new AbortController();
  // Count the abort callbacks the part signal holds.
  let held = 0;
  const add = part.signal.addEventListener.bind(part.signal);
  part.signal.addEventListener = (type, listener, options) => {
    held += 1;
    options?.signal?.addEventListener('abort', () => { held -= 1; }, { once: true });
    return add(type, listener, options);
  };
  const calls = [];
  component.listen(target, 'ping', function (event) { calls.push([this === target, event.type]); }, { once: true, signal: part.signal });
  assert.equal(held, 1);
  target.dispatchEvent(new Event('ping'));
  target.dispatchEvent(new Event('ping'));
  assert.deepEqual(calls, [[true, 'ping']], 'ran once, with the target as this');
  assert.equal(held, 0, 'the part signal no longer holds the listener');
  component.destroy();
});
