import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import {
  attributes, bool, createCallQueue, data, flag, forward, forwardedResult, isDomCall, normalizeAttributes,
  prop, records, recordsPatch, reflectPlain, text
} from '../../src/elements/definitions.js';
import { KIT_ELEMENTS } from '../../src/elements/kit.js';
import { INVALID_ATTRIBUTE, coerceAttribute, serializeAttribute } from '../../src/elements/reflect.js';

/** @param {string} name @returns {string} `headingLevel` as `heading-level`. */
function kebab(name) {
  return name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

/**
 * The option defaults a component class resolves to, base class first.
 * @param {any} constructor Component class.
 * @returns {Record<string, unknown>}
 */
function defaultsOf(constructor) {
  const chain = [];
  for (let current = constructor; current && current !== Function.prototype; current = Object.getPrototypeOf(current)) {
    if (Object.hasOwn(current, 'defaults')) chain.unshift(current.defaults);
  }
  return Object.assign({}, ...chain);
}

/** Where a kit component's own events are written, next to the view base they inherit from. */
const SOURCES = {
  'agent-thread': ['agent-thread/agent-thread'],
  composer: ['composer/composer'],
  'block-view': ['block-view/block-view'],
  'run-trace': ['run-trace/run-trace'],
  'approval-card': ['approval-card/approval-card'],
  'source-list': ['source-list/source-list'],
  'run-status': ['run-status/run-status'],
  'card-view': ['card-view/card-view', 'view/record-view'],
  'kanban-view': ['kanban-view/kanban-view', 'view/record-view'],
  tree: ['tree/tree'],
  chart: ['chart/chart']
};

/** @param {string} path Component path. @returns {string[]} Every event the source documents or emits. */
function firedEvents(path) {
  const source = readFileSync(fileURLToPath(new URL(`../../src/components/${path}.js`, import.meta.url)), 'utf8');
  return [
    ...[...source.matchAll(/this\.emit\('([a-z]+)'/g)].map((match) => match[1]),
    ...[...source.matchAll(/@fires \w+#([a-z]+)/g)].map((match) => match[1])
  ];
}

test('a flag keeps its default while absent and reads "false" as off', () => {
  assert.equal(coerceAttribute(null, 'flag'), undefined);
  assert.equal(coerceAttribute('false', 'flag'), false);
  assert.equal(coerceAttribute('', 'flag'), true);
  assert.equal(coerceAttribute('true', 'flag'), true);
  assert.equal(serializeAttribute(true, 'flag'), '');
  assert.equal(serializeAttribute(false, 'flag'), 'false');
  assert.equal(serializeAttribute(null, 'flag'), null);
});

test('a data definition reads its attribute and never writes it', () => {
  const [definition] = Object.values(attributes({ items: data({ default: [] }) }));
  assert.equal(definition.type, 'json');
  assert.equal(definition.reflect, false);
  assert.equal(definition.observed, true);
});

test('a property definition has no attribute at all', () => {
  const [definition] = Object.values(attributes({ 'format-time': prop() }));
  assert.equal(definition.property, 'formatTime');
  assert.equal(definition.observed, false);
  assert.equal(definition.reflect, false);
});

test('a scalar definition reflects, as it always has', () => {
  const [definition] = Object.values(attributes({ label: text() }));
  assert.equal(definition.reflect, true);
  assert.equal(definition.observed, true);
});

test('normalizing a normalized map changes nothing', () => {
  const once = attributes({ items: data({ rebuild: true }), label: text(), now: prop(), open: bool(), wide: flag() });
  assert.deepEqual({ ...normalizeAttributes(once) }, { ...once });
});

test('a value markup cannot write stays off the attribute', () => {
  const reflect = reflectPlain('string');
  assert.equal(reflect('title'), 'title');
  assert.equal(reflect(null), null);
  assert.equal(reflect(() => 'title'), INVALID_ATTRIBUTE);
  assert.equal(reflect(new Date(0)), INVALID_ATTRIBUTE);
  assert.equal(reflectPlain('flag')({ placement: 'toolbar' }), INVALID_ATTRIBUTE);
  assert.equal(reflectPlain('boolean')(() => true), INVALID_ATTRIBUTE);
  assert.equal(reflectPlain('boolean')(true), '');
});

test('queued calls run in order, each once', () => {
  const queue = createCallQueue();
  const seen = [];
  queue.push('upsert', [{ id: 1 }]);
  queue.push('appendText', ['1', 'Hello']);
  queue.push('appendText', ['1', ' world']);
  assert.equal(queue.size, 3);

  queue.drain((name, args) => seen.push([name, ...args]));
  assert.deepEqual(seen, [
    ['upsert', { id: 1 }],
    ['appendText', '1', 'Hello'],
    ['appendText', '1', ' world']
  ]);
  assert.equal(queue.size, 0);

  queue.drain(() => assert.fail('a drained queue ran a call twice'));
});

test('a drain stops when the component goes, and the rest waits for the next one', () => {
  const queue = createCallQueue();
  queue.push('a', []);
  queue.push('b', []);
  queue.push('c', []);
  const seen = [];
  queue.drain((name) => seen.push(name), () => seen.length < 1);
  assert.deepEqual(seen, ['a']);
  assert.equal(queue.size, 2);

  queue.drain((name) => seen.push(name));
  assert.deepEqual(seen, ['a', 'b', 'c']);
});

test('a call that throws stops the run and leaves what follows it queued', () => {
  const queue = createCallQueue();
  queue.push('fails', []);
  queue.push('next', []);
  assert.throws(() => queue.drain((name) => {
    if (name === 'fails') throw new Error('refused');
  }), /refused/);
  assert.equal(queue.size, 1);
});

test('a forwarded call answers with the element where the component answered with itself', async () => {
  const component = {};
  const host = /** @type {HTMLElement} */ ({});
  assert.equal(forwardedResult(component, component, host), host);
  assert.equal(forwardedResult(true, component, host), true);
  assert.equal(forwardedResult(undefined, component, host), undefined);
  assert.deepEqual(forwardedResult([1], component, host), [1]);
  assert.equal(await forwardedResult(Promise.resolve(component), component, host), host);
  assert.equal(await forwardedResult(Promise.resolve(7), component, host), 7);
});

test('a call the DOM also defines stays the DOM\'s for the DOM\'s arguments', () => {
  assert.equal(isDomCall('remove', []), true);
  assert.equal(isDomCall('remove', ['item-1']), false);
  assert.equal(isDomCall('append', [{ nodeType: 1 }]), true);
  assert.equal(isDomCall('append', ['text']), true);
  assert.equal(isDomCall('append', []), true);
  assert.equal(isDomCall('append', [{ nodeType: 1 }, { nodeType: 1 }]), true);
  assert.equal(isDomCall('append', [null]), true);
  assert.equal(isDomCall('append', [{ type: 'p', text: 'Hello' }]), false);
  assert.equal(isDomCall('focus', []), false);
});

test('method declarations say what they record', () => {
  assert.deepEqual(forward('a', 'b'), { a: null, b: null });
  assert.deepEqual(records('hint')(['Press Enter']), { hint: 'Press Enter' });
  assert.deepEqual(recordsPatch([{ state: 'running' }]), { state: 'running' });
  assert.equal(recordsPatch([null]), null);
  assert.equal(recordsPatch(['text']), null);
});

test('the elements are exactly the kit and the data views, in the order they are documented', () => {
  assert.deepEqual(KIT_ELEMENTS.map(([suffix]) => suffix), [
    'agent-thread', 'composer', 'block-view', 'run-trace', 'approval-card', 'source-list', 'run-status',
    'card-view', 'kanban-view', 'tree', 'chart'
  ]);
});

test('no kit element is form-associated', () => {
  for (const [suffix, , wrapper] of KIT_ELEMENTS) assert.ok(!wrapper.formAssociated, suffix);
});

for (const [suffix, Component, wrapper] of KIT_ELEMENTS) {
  const defaults = defaultsOf(Component);
  const definitions = Object.values(wrapper.attrs);

  test(`<zx-${suffix}>: every option is reachable, under its own name`, () => {
    const options = new Set(definitions.map((definition) => definition.option));
    const unreachable = Object.keys(defaults).filter((name) => !options.has(name));
    assert.deepEqual(unreachable, []);
    for (const { attribute, option, property } of definitions) {
      assert.equal(property, option);
      assert.equal(attribute, kebab(option));
    }
  });

  test(`<zx-${suffix}>: every default is the component's`, () => {
    for (const { option, default: value } of definitions) {
      if (option === 'msg') continue;
      assert.deepEqual(value, defaults[option], option);
    }
  });

  test(`<zx-${suffix}>: every definition either applies live or rebuilds`, () => {
    for (const { option, rebuild, set } of definitions) {
      assert.ok(rebuild || set, `${option} would change nothing on a live element`);
    }
  });

  test(`<zx-${suffix}>: data never travels through an attribute`, () => {
    for (const { option, reflect, type } of definitions) {
      if (type === 'json') assert.equal(reflect, false, option);
    }
  });

  test(`<zx-${suffix}>: every forwarded method exists`, () => {
    for (const name of Object.keys(wrapper.methods)) {
      assert.equal(typeof Component.prototype[name], 'function', name);
    }
  });

  test(`<zx-${suffix}>: every event its component fires is declared`, () => {
    const fired = new Set(SOURCES[suffix].flatMap(firedEvents));
    assert.deepEqual([...fired].filter((name) => !wrapper.events.includes(name)), []);
    assert.equal(new Set(wrapper.events).size, wrapper.events.length);
  });
}

test('the thread forwards everything a stream needs', () => {
  const [, , { methods }] = KIT_ELEMENTS.find(([suffix]) => suffix === 'agent-thread');
  for (const name of ['setItems', 'upsert', 'patch', 'appendText', 'appendBlock', 'remove', 'get', 'getItems', 'reveal', 'scrollToEnd']) {
    assert.ok(name in methods, name);
  }
});

test('the composer forwards what an application drives it with', () => {
  const [, , { methods }] = KIT_ELEMENTS.find(([suffix]) => suffix === 'composer');
  for (const name of ['setBusy', 'update', 'focus', 'clear']) assert.ok(name in methods, name);
});
