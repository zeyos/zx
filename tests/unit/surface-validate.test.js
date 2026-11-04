import assert from 'node:assert/strict';
import test from 'node:test';

import { CATALOG, LIMITS, narrowCatalog } from '../../src/components/surface/catalog.js';
import { checkValue, FIELD_TYPES, schemaToFields, toJsonValue, unsupported } from '../../src/components/surface/schema.js';
import {
  createValidationState, normaliseLink, stateToDocument, validateDocument, validateOp, validateValue
} from '../../src/components/surface/validate.js';

/**
 * Validates operation lines in order, as a stream would, parsing each from its JSON text so keys
 * such as `__proto__` arrive as own properties.
 * @param {Array<object|string>} lines @param {object} [options]
 */
function stream(lines, options = {}) {
  const state = createValidationState(options);
  const errors = [];
  const ops = [];
  for (const line of lines) {
    const result = validateOp(JSON.parse(typeof line === 'string' ? line : JSON.stringify(line)), state, options.catalog ?? CATALOG);
    errors.push(...result.errors);
    ops.push(...result.ops);
  }
  return { state, errors, ops, document: stateToDocument(state, 's1') };
}

/** A document around some nodes. @param {object[]} nodes @param {object} [extra] */
function doc(nodes, extra = {}) {
  return { zx: 'surface/1', surface: 's1', intent: 'show', title: 'T', author: 'agent', root: nodes.map((node) => node.id), nodes, ...extra };
}

/** Validates a document given as JSON text or an object. */
function check(document, options = {}) {
  const value = typeof document === 'string' ? JSON.parse(document) : document;
  return validateDocument(value, options.catalog ?? CATALOG, options);
}

/** @param {object[]} errors @param {string} code */
const codes = (errors) => errors.map((error) => error.code);
const has = (errors, code) => errors.some((error) => error.code === code);
const node = (result, id) => result.document.nodes.find((entry) => entry.id === id);
const begin = (extra = {}) => ({ zx: 'surface/1', op: 'begin', surface: 's1', intent: 'show', title: 'T', author: 'agent', root: [], ...extra });

test('every error has a stable, model-ready shape', () => {
  const { errors } = check(doc([{ id: 'a', type: 'nope' }, { id: 'b', type: 'link', text: 'x', href: 'javascript:alert(1)' }]));
  assert.ok(errors.length >= 2);
  for (const error of errors) {
    assert.equal(typeof error.code, 'string');
    assert.equal(typeof error.message, 'string');
    assert.equal(error.surface, 's1');
    for (const key of Object.keys(error)) assert.ok(['code', 'message', 'surface', 'id', 'path', 'repaired'].includes(key), key);
  }
});

test('HTML in text stays text', () => {
  const html = '<img src=x onerror=alert(1)><script>alert(2)</script> **bold**';
  const result = check(doc([{ id: 't', type: 'text', text: html }, { id: 'h', type: 'heading', text: '<h1>x</h1>' }]));
  assert.deepEqual(result.errors, []);
  assert.equal(node(result, 't').text, html);
  assert.equal(node(result, 'h').text, '<h1>x</h1>');
});

test('javascript:, data:, protocol-relative, relative and http: links are dropped', () => {
  for (const href of ['javascript:alert(1)', 'JavaScript:alert(1)', 'data:text/html,<b>x</b>', '//evil.example/x', '/relative', 'relative/path',
    'http://example.com', 'https://user:pass@example.com', 'https:///nohost', ' https://example.com', 'https://exa mple.com', 'https:\\\\example.com']) {
    const result = check(doc([{ id: 'l', type: 'link', text: 'Open', href }]));
    assert.ok(has(result.errors, 'link-refused'), href);
    assert.equal(node(result, 'l').href, undefined, href);
  }
  const ok = check(doc([{ id: 'l', type: 'link', text: 'Docs', href: 'https://example.com/a?b=c#d' }]));
  assert.deepEqual(ok.errors, []);
  assert.equal(node(ok, 'l').href, 'https://example.com/a?b=c#d');
});

test('__proto__, constructor and prototype are refused at any depth', () => {
  const text = JSON.stringify(doc([{ id: 't', type: 'table', columns: [{ id: 'a', label: 'A' }], rows: [{ a: 1 }] }], {
    data: { deep: { deeper: [{ x: 1 }] } }
  }))
    .replace('"x":1', '"__proto__":{"polluted":true},"x":1')
    .replace('"a":1}', '"a":1,"constructor":{"prototype":{"bad":1}}}');
  const result = check(text);
  assert.ok(codes(result.errors).filter((code) => code === 'forbidden-key').length >= 2);
  assert.deepEqual(result.document.data.deep.deeper, [{ x: 1 }]);
  assert.deepEqual(node(result, 't').rows, [{ a: 1 }]);
  assert.equal({}.polluted, undefined);
  const lines = stream([begin(), '{"op":"data","surface":"s1","path":"/a","value":{"b":{"c":{"__proto__":{"x":1}}}}}']);
  assert.ok(has(lines.errors, 'forbidden-key'));
  assert.deepEqual(lines.document.data, { a: { b: { c: {} } } });
  const pointer = stream([begin(), { op: 'data', surface: 's1', path: '/__proto__/x', value: 1 }]);
  assert.ok(has(pointer.errors, 'pointer-invalid'));
});

test('non-finite numbers and non-JSON values are dropped', () => {
  const result = check(doc([{ id: 's', type: 'stat', label: 'Revenue', value: Number.NaN }], { data: { a: Infinity, b: () => 1, c: 2 } }));
  assert.ok(codes(result.errors).filter((code) => code === 'not-finite').length >= 2);
  assert.ok(has(result.errors, 'invalid-value'));
  assert.deepEqual(result.document.data, { c: 2 });
});

test('10,000-deep nesting is refused without exhausting the stack', () => {
  const deep = `${'['.repeat(10000)}1${']'.repeat(10000)}`;
  const lines = stream([begin(), `{"op":"data","surface":"s1","path":"/x","value":${deep}}`]);
  assert.ok(has(lines.errors, 'limit'));
  let inline = '{"id":"leaf","type":"text","text":"x"}';
  for (let level = 0; level < 10000; level += 1) inline = `{"id":"n${level}","type":"stack","children":[${inline}]}`;
  const nested = check(`{"zx":"surface/1","surface":"s1","intent":"show","title":"T","author":"a","root":[${inline}],"nodes":[]}`);
  assert.ok(has(nested.errors, 'limit'));
  assert.ok(nested.document.nodes.length <= LIMITS.nodes);
});

test('oversized strings and arrays are refused', () => {
  const long = 'x'.repeat(LIMITS.string + 1);
  const result = check(doc([
    { id: 't', type: 'text', text: long },
    { id: 'l', type: 'list', items: Array.from({ length: LIMITS.rows + 1 }, (_, index) => `item ${index}`) },
    { id: 'tb', type: 'table', columns: [{ id: 'a', label: 'A' }], rows: Array.from({ length: LIMITS.rows + 1 }, (_, index) => ({ a: index })) }
  ]));
  assert.equal(codes(result.errors).filter((code) => code === 'limit').length, 3);
  assert.equal(node(result, 't').text, undefined);
  assert.equal(node(result, 'l').items, undefined);
  assert.equal(node(result, 'tb').rows, undefined);
  assert.ok(has(result.errors, 'missing'), 'the emptied nodes are reported as incomplete at end');
});

test('the per-surface limits are enforced', () => {
  const many = Array.from({ length: LIMITS.nodes + 5 }, (_, index) => ({ id: `n${index}`, type: 'text', text: 'x' }));
  const nodes = check(doc(many));
  assert.equal(nodes.document.nodes.length, LIMITS.nodes);
  assert.ok(has(nodes.errors, 'limit'));

  const actions = check(doc([], { actions: Array.from({ length: LIMITS.actions + 1 }, (_, index) => ({ id: `a${index}`, label: `A${index}` })) }));
  assert.equal(actions.document.actions.length, LIMITS.actions);
  assert.ok(has(actions.errors, 'limit'));

  const choices = check(doc([{ id: 'c', type: 'choice', name: 'pick', label: 'Pick', choices: Array.from({ length: LIMITS.choices + 1 }, (_, index) => ({ value: `v${index}`, label: `V${index}` })) }], { intent: 'choose' }));
  assert.ok(has(choices.errors, 'limit'));

  const properties = Object.fromEntries(Array.from({ length: 30 }, (_, index) => [`f${index}`, { type: 'string', title: `F${index}` }]));
  const more = Object.fromEntries(Array.from({ length: 30 }, (_, index) => [`g${index}`, { type: 'string', title: `G${index}` }]));
  const fields = check(doc([
    { id: 'a', type: 'fields', schema: { type: 'object', properties } },
    { id: 'b', type: 'fields', schema: { type: 'object', properties: more } }
  ], { intent: 'ask' }));
  assert.ok(has(fields.errors, 'limit'));
  assert.equal(Object.keys(node(fields, 'b').schema.properties).length, LIMITS.fields - 30);

  const big = stream([begin(), { op: 'data', surface: 's1', path: '/a', value: Array.from({ length: 900 }, () => 'x'.repeat(1200)) }]);
  assert.ok(has(big.errors, 'limit'));
  assert.equal(big.document.data, undefined);
});

test('unknown intents and node types are reported', () => {
  const intent = check(doc([{ id: 't', type: 'text', text: 'x' }], { intent: 'wizard' }));
  assert.ok(has(intent.errors, 'unknown-intent'));
  assert.equal(intent.document.intent, null);
  const type = check(doc([{ id: 'w', type: 'webview', url: 'https://example.com' }]));
  assert.ok(has(type.errors, 'unknown-type'));
  assert.deepEqual(node(type, 'w'), { id: 'w', type: 'webview' }, 'kept as a fallback, without its properties');
  assert.ok(!has(type.errors, 'unknown-key'), 'the properties of an unknown node are not listed one by one');
});

test('a narrowed catalog refuses what lies outside it as unknown', () => {
  const narrow = narrowCatalog(CATALOG, { intents: ['show'], nodes: ['text'] });
  const result = check(doc([{ id: 't', type: 'text', text: 'x' }, { id: 's', type: 'stat', label: 'L', value: 1 }]), { catalog: narrow });
  assert.ok(has(result.errors, 'unknown-type'));
  const ask = check(doc([], { intent: 'ask' }), { catalog: narrow });
  assert.ok(has(ask.errors, 'unknown-intent'));
  assert.throws(() => validateDocument(doc([]), { ...CATALOG, nodes: { ...CATALOG.nodes, extra: { type: 'extra' } } }), TypeError);
});

test('an action trying to set its own confirmation is ignored', () => {
  const result = check(doc([], { actions: [{ id: 'go', label: 'Delete all', kind: 'danger', tool: 'files.delete', confirmation: 'none', skipConfirmation: true, confirm: false }] }));
  assert.equal(codes(result.errors).filter((code) => code === 'confirmation-ignored').length, 3);
  assert.deepEqual(result.document.actions, [{ id: 'go', label: 'Delete all', kind: 'danger', tool: 'files.delete' }]);
});

test('an action without a label, and duplicate action ids, are reported and dropped', () => {
  const result = check(doc([], { actions: [{ id: 'a' }, { id: 'b', label: '  ' }, { id: 'c', label: 'C' }, { id: 'c', label: 'Again' }] }));
  assert.equal(codes(result.errors).filter((code) => code === 'missing').length, 2);
  assert.deepEqual(result.document.actions, [{ id: 'c', label: 'C' }]);
});

test('a token in a model-written begin or document is dropped and reported', () => {
  const lines = stream([begin({ token: 'issued-by-model' }), { op: 'end', surface: 's1' }]);
  assert.ok(has(lines.errors, 'token-refused'));
  assert.equal(lines.ops[0].token, undefined);
  const document = check(doc([], { token: 'x' }));
  assert.ok(has(document.errors, 'token-refused'));
  assert.equal(document.document.token, undefined);
});

test('a duplicate node id replaces the earlier node', () => {
  const result = stream([
    begin({ root: ['a'] }),
    { op: 'node', surface: 's1', id: 'a', type: 'text', text: 'first' },
    { op: 'node', surface: 's1', id: 'a', type: 'callout', text: 'second', tone: 'warning' },
    { op: 'end', surface: 's1' }
  ]);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.document.nodes, [{ id: 'a', type: 'callout', text: 'second', tone: 'warning' }]);
});

test('a data path through a non-object is reported', () => {
  const result = stream([
    begin(),
    { op: 'data', surface: 's1', path: '/total', value: 12 },
    { op: 'data', surface: 's1', path: '/total/net', value: 10 },
    { op: 'data', surface: 's1', path: '/missing/child', value: 1 },
    { op: 'data', surface: 's1', path: '/rows', value: [1, 2] },
    { op: 'data', surface: 's1', path: '/rows/-', value: 3 },
    { op: 'data', surface: 's1', path: '/rows/0', remove: true }
  ]);
  assert.equal(codes(result.errors).filter((code) => code === 'data-path').length, 2);
  assert.deepEqual(result.document.data, { total: 12, rows: [2, 3] });
});

test('repair: root and children given as one id are wrapped in a list', () => {
  const result = check({ ...doc([{ id: 'box', type: 'stack', children: 'inner' }, { id: 'inner', type: 'text', text: 'x' }]), root: 'box' });
  const repairs = result.errors.filter((error) => error.code === 'wrapped-list');
  assert.equal(repairs.length, 2);
  assert.ok(repairs.every((error) => error.repaired === true));
  assert.deepEqual(result.document.root, ['box']);
  assert.deepEqual(node(result, 'box').children, ['inner']);
});

test('repair: a $data pointer without its leading slash gets one', () => {
  const result = check(doc([{ id: 't', type: 'table', columns: [{ id: 'a', label: 'A' }], rows: { $data: 'rows' } }], { data: { rows: [{ a: 1 }] } }));
  const repair = result.errors.find((error) => error.code === 'pointer-slash');
  assert.equal(repair?.repaired, true);
  assert.deepEqual(node(result, 't').rows, { $data: '/rows' });
  assert.equal(result.errors.length, 1);
});

test('repair: an inline child is lifted out as its own node, and one without an id is refused', () => {
  const result = check({ ...doc([{ id: 'box', type: 'group', title: 'G', children: [{ id: 'kid', type: 'text', text: 'hi' }, { type: 'text', text: 'anon' }, 'other'] }, { id: 'other', type: 'text', text: 'o' }]), root: ['box'] });
  const lifted = result.errors.find((error) => error.code === 'lifted-child');
  assert.equal(lifted?.repaired, true);
  assert.ok(has(result.errors, 'invalid-value'), 'the inline child without an id is refused');
  assert.deepEqual(node(result, 'box').children, ['kid', 'other']);
  assert.deepEqual(node(result, 'kid'), { id: 'kid', type: 'text', text: 'hi' });

  const lines = stream([begin({ root: ['box'] }), { op: 'node', surface: 's1', id: 'box', type: 'stack', children: [{ id: 'kid', type: 'text', text: 'hi' }] }]);
  assert.deepEqual(lines.ops.map((op) => [op.op, op.id]), [['begin', undefined], ['node', 'box'], ['node', 'kid']]);
});

test('a lifted child follows the duplicate-id rule and counts towards the depth limit', () => {
  const replaced = check({
    ...doc([]),
    root: ['box'],
    nodes: [{ id: 'kid', type: 'text', text: 'old' }, { id: 'box', type: 'stack', children: [{ id: 'kid', type: 'text', text: 'new' }] }]
  });
  assert.equal(node(replaced, 'kid').text, 'new');
  assert.equal(replaced.document.nodes.filter((entry) => entry.id === 'kid').length, 1);

  let inline = { id: 'leaf', type: 'text', text: 'x' };
  for (let level = LIMITS.depth; level > 0; level -= 1) inline = { id: `s${level}`, type: 'stack', children: [inline] };
  const deep = stream([begin({ root: [inline] }), { op: 'end', surface: 's1' }]);
  assert.ok(has(deep.errors, 'limit'));
  assert.equal(deep.document.nodes.some((entry) => entry.id === 'leaf'), false);
  assert.ok(deep.document.nodes.some((entry) => entry.id === `s${LIMITS.depth}`));
});

test('a child cannot be its own ancestor or have two parents', () => {
  const result = check({ ...doc([]), root: ['a'], nodes: [
    { id: 'a', type: 'stack', children: ['b', 'a'] },
    { id: 'b', type: 'stack', children: ['a', 'c'] },
    { id: 'c', type: 'text', text: 'x' },
    { id: 'd', type: 'stack', children: ['c'] }
  ] });
  assert.equal(codes(result.errors).filter((code) => code === 'cycle').length, 3);
  assert.deepEqual(node(result, 'a').children, ['b']);
  assert.deepEqual(node(result, 'b').children, ['c']);
  assert.deepEqual(node(result, 'd').children, []);
  assert.ok(has(result.errors, 'unreachable'));
});

test('a child never sent is reported at end', () => {
  const result = check(doc([{ id: 'box', type: 'stack', children: ['ghost'] }]));
  assert.ok(has(result.errors, 'missing-node'));
});

const IBAN = {
  type: 'object',
  required: ['method'],
  properties: {
    method: { type: 'string', title: 'Payment', enum: ['card', 'transfer'] },
    iban: { type: 'string', title: 'IBAN', 'x-zx': { visible: { field: 'method', op: 'eq', value: 'transfer' } } }
  }
};

test('visible conditions on earlier inputs pass', () => {
  const result = check(doc([
    { id: 'form', type: 'fields', schema: IBAN },
    { id: 'note', type: 'text', text: 'Transfers take a day.', visible: { field: 'method', op: 'eq', value: 'transfer' } }
  ], { intent: 'ask' }));
  assert.deepEqual(result.errors, []);
  assert.deepEqual(node(result, 'form').schema.properties.iban['x-zx'].visible, { field: 'method', op: 'eq', value: 'transfer' });
  assert.ok(node(result, 'note').visible);
});

test('a visible condition naming a later input, an unknown input or nesting five deep is dropped and its node stays visible', () => {
  const later = check(doc([
    { id: 'note', type: 'text', text: 'x', visible: { field: 'method', op: 'filled' } },
    { id: 'form', type: 'fields', schema: IBAN }
  ], { intent: 'ask' }));
  assert.ok(has(later.errors, 'condition'));
  assert.equal(node(later, 'note').visible, undefined);

  const unknown = check(doc([{ id: 'form', type: 'fields', schema: IBAN }, { id: 'note', type: 'text', text: 'x', visible: { field: 'nope', op: 'filled' } }], { intent: 'ask' }));
  assert.ok(has(unknown.errors, 'condition'));
  assert.equal(node(unknown, 'note').visible, undefined);

  const five = { not: { not: { not: { not: { field: 'method', op: 'filled' } } } } };
  const deep = check(doc([{ id: 'form', type: 'fields', schema: IBAN }, { id: 'note', type: 'text', text: 'x', visible: five }], { intent: 'ask' }));
  assert.ok(has(deep.errors, 'condition'));
  assert.equal(node(deep, 'note').visible, undefined);

  const own = check(doc([{ id: 'form', type: 'fields', schema: { type: 'object', properties: {
    a: { type: 'string', title: 'A', 'x-zx': { visible: { field: 'b', op: 'filled' } } },
    b: { type: 'string', title: 'B' }
  } } }], { intent: 'ask' }));
  assert.ok(has(own.errors, 'condition'), 'a property may only name earlier properties');
  assert.equal(node(own, 'form').schema.properties.a['x-zx'], undefined);
});

test('the order of inputs is checked against the tree at end, not only the arrival order', () => {
  // `pick` arrives first but sits after `note` in the tree, so the condition is dropped at end.
  const result = stream([
    begin({ intent: 'choose', root: ['note', 'pick'] }),
    { op: 'node', surface: 's1', id: 'pick', type: 'choice', name: 'plan', label: 'Plan', choices: [{ value: 'a', label: 'A' }] },
    { op: 'node', surface: 's1', id: 'note', type: 'text', text: 'x', visible: { field: 'plan', op: 'eq', value: 'a' } },
    { op: 'end', surface: 's1' }
  ]);
  assert.ok(has(result.errors, 'condition'));
  const patch = result.ops.find((op) => op.op === 'patch');
  assert.deepEqual(patch, { op: 'patch', surface: 's1', id: 'note', props: { visible: null } });
  assert.equal(result.ops.at(-1).op, 'end', 'the patches come before end');
  assert.equal(node({ document: result.document }, 'note').visible, undefined);
});

test('an input node without a name, a property without a title and an action without a label are reported', () => {
  const result = check(doc([
    { id: 'c', type: 'choice', label: 'Pick', choices: [{ value: 'a', label: 'A' }] },
    { id: 'f', type: 'fields', schema: { type: 'object', properties: { x: { type: 'string' } } } }
  ], { intent: 'ask', actions: [{ id: 'go' }] }));
  assert.ok(result.errors.some((error) => error.code === 'missing' && error.id === 'c' && error.path.endsWith('/name')));
  assert.ok(has(result.errors, 'untitled-property'));
  assert.ok(result.errors.some((error) => error.code === 'missing' && error.path === '/actions/0/label'));
});

test('a selectable table needs a name and a row id', () => {
  const result = check(doc([{ id: 't', type: 'table', selectable: 'multi', columns: [{ id: 'a', label: 'A' }], rows: [] }], { intent: 'review' }));
  assert.equal(codes(result.errors).filter((code) => code === 'missing').length, 2);
  assert.equal(node(result, 't').selectable, undefined);
  assert.ok(has(result.errors, 'needs'), 'without selection the review has nothing to review');
});

test('inputs do not belong in show and confirm surfaces', () => {
  const result = check(doc([{ id: 'f', type: 'fields', schema: IBAN }, { id: 't', type: 'table', selectable: 'single', name: 'x', rowId: 'a', columns: [{ id: 'a', label: 'A' }], rows: [] }], { intent: 'confirm' }));
  assert.equal(codes(result.errors).filter((code) => code === 'not-allowed').length, 2);
  assert.deepEqual(node(result, 'f'), { id: 'f', type: 'fields' });
  assert.equal(node(result, 't').selectable, undefined);
});

test('an intent without the node it needs is reported', () => {
  for (const intent of ['ask', 'choose', 'review', 'questionnaire']) {
    const result = check(doc([{ id: 't', type: 'text', text: 'x' }], { intent }));
    assert.ok(has(result.errors, 'needs'), intent);
  }
  const diffOutside = check(doc([{ id: 'd', type: 'diff', name: 'x', rows: [] }], { intent: 'ask' }));
  assert.ok(has(diffOutside.errors, 'not-allowed'));
});

test('input names are unique within a surface', () => {
  const result = check(doc([
    { id: 'f', type: 'fields', schema: { type: 'object', properties: { plan: { type: 'string', title: 'Plan' } } } },
    { id: 'c', type: 'choice', name: 'plan', label: 'Plan', choices: [{ value: 'a', label: 'A' }] }
  ], { intent: 'ask' }));
  assert.ok(has(result.errors, 'duplicate-name'));
  assert.equal(node(result, 'c').name, undefined);
});

test('records are kept only for the entities the application resolves', () => {
  const nodes = [{ id: 'r', type: 'ref', ref: { $ref: 'company', id: 'helios' } }, { id: 'x', type: 'ref', ref: { $ref: 'secret', id: '1' } }];
  const data = { rows: [{ who: { $ref: 'company', id: 'helios' } }, { who: { $ref: 'user', id: 'root' } }] };
  const result = check(doc(nodes, { data }), { entities: ['company'] });
  assert.deepEqual(node(result, 'r').ref, { $ref: 'company', id: 'helios' });
  assert.equal(node(result, 'x').ref, undefined);
  assert.deepEqual(result.document.data.rows, [{ who: { $ref: 'company', id: 'helios' } }, {}]);
  assert.equal(codes(result.errors).filter((code) => code === 'ref-refused').length, 2);
  const none = check(doc([nodes[0]]));
  assert.ok(has(none.errors, 'ref-refused'), 'without entities every record is refused');
  const malformed = check(doc([{ id: 'r', type: 'ref', ref: { $ref: 'company', id: 'h', href: 'https://x' } }]), { entities: ['company'] });
  assert.ok(has(malformed.errors, 'invalid-value'));
});

test('assets are names, never addresses', () => {
  const result = check(doc([], { data: { logo: { $asset: 'helios-logo' }, bad: { $asset: 'https://evil.example/x.png' }, worse: { $asset: 'a', src: 'x' } } }));
  assert.deepEqual(result.document.data, { logo: { $asset: 'helios-logo' } });
  assert.equal(codes(result.errors).filter((code) => code === 'invalid-value').length, 2);
});

test('unknown keys are dropped and reported, nulls count as absent', () => {
  const result = check(doc([{ id: 't', type: 'text', text: 'x', style: 'color:red', onclick: 'x()', visible: null }], { placement: null, description: null }));
  assert.equal(codes(result.errors).filter((code) => code === 'unknown-key').length, 2);
  assert.deepEqual(node(result, 't'), { id: 't', type: 'text', text: 'x' });
});

test('a document written for strict structured output validates as written', () => {
  const strict = {
    zx: 'surface/1', surface: 's1', intent: 'ask', title: 'Pay', author: 'orders', root: ['form', 'tbl'], placement: null, description: null,
    nodes: [
      { id: 'form', type: 'fields', visible: null, title: null, schema: { type: 'object', required: ['method'], properties: [
        { name: 'method', type: 'string', title: 'Payment', description: null, default: null, enum: null, oneOf: [{ const: 'card', title: 'Card' }, { const: 'transfer', title: 'Transfer' }], format: null, minimum: null, maximum: null, minLength: null, maxLength: null, items: null, minItems: null, maxItems: null, 'x-zx': null },
        { name: 'iban', type: 'string', title: 'IBAN', description: null, default: null, enum: null, oneOf: null, format: null, minimum: null, maximum: null, minLength: null, maxLength: 34, items: null, minItems: null, maxItems: null, 'x-zx': { field: null, visible: { field: 'method', op: 'eq', value: 'transfer' } } },
        { name: 'notes', type: 'string', title: 'Notes', description: null, default: null, enum: null, oneOf: null, format: null, minimum: null, maximum: null, minLength: null, maxLength: null, items: null, minItems: null, maxItems: null, 'x-zx': { field: 'textarea', visible: { field: 'iban', op: 'empty', value: null } } }
      ] } },
      { id: 'tbl', type: 'table', visible: null, name: null, selectable: null, rowId: null, label: null, columns: [{ id: 'a', label: 'A', align: null, format: null, currency: null }, { id: 'b', label: 'B', align: 'end', format: 'number', currency: null }], rows: [['x', 1], ['y', null]] }
    ],
    actions: null, sources: null
  };
  const result = check(strict);
  assert.deepEqual(result.errors, []);
  const form = node(result, 'form');
  assert.deepEqual(Object.keys(form.schema.properties), ['method', 'iban', 'notes']);
  assert.deepEqual(form.schema.properties.iban, { type: 'string', title: 'IBAN', maxLength: 34, 'x-zx': { visible: { field: 'method', op: 'eq', value: 'transfer' } } });
  assert.deepEqual(form.schema.properties.notes['x-zx'].visible, { field: 'iban', op: 'empty' });
  assert.deepEqual(node(result, 'tbl').rows, [{ a: 'x', b: 1 }, { a: 'y', b: null }]);
});

test('operations out of order, unknown operations and wrong versions are refused', () => {
  const state = createValidationState();
  assert.equal(validateOp({ op: 'node', surface: 's1', id: 'a', type: 'text', text: 'x' }, state).errors[0].code, 'no-begin');
  assert.equal(validateOp({ ...begin(), zx: 'surface/2' }, state).errors[0].code, 'version');
  assert.ok(validateOp(begin(), state).op);
  assert.equal(validateOp(begin(), state).errors[0].code, 'duplicate-begin');
  assert.equal(validateOp({ op: 'explode', surface: 's1' }, state).errors[0].code, 'unknown-op');
  assert.equal(validateOp('not an object', state).errors[0].code, 'invalid-op');
  assert.equal(validateOp({ op: 'end', surface: 's1' }, state).errors.length, 0);
  assert.equal(validateOp({ op: 'node', surface: 's1', id: 'b', type: 'text', text: 'x' }, state).errors[0].code, 'ended');
  assert.throws(() => validateOp({}, {}), TypeError);
});

test('one stream may carry several surfaces', () => {
  const state = createValidationState();
  validateOp(begin({ root: ['a'] }), state);
  validateOp({ ...begin({ root: ['a'] }), surface: 's2' }, state);
  validateOp({ op: 'node', surface: 's1', id: 'a', type: 'text', text: 'one' }, state);
  validateOp({ op: 'node', surface: 's2', id: 'a', type: 'text', text: 'two' }, state);
  assert.equal(stateToDocument(state, 's1').nodes[0].text, 'one');
  assert.equal(stateToDocument(state, 's2').nodes[0].text, 'two');
});

test('patch merges properties, append adds text and remove takes a node out', () => {
  const result = stream([
    begin({ root: ['t', 'box'] }),
    { op: 'node', surface: 's1', id: 't', type: 'text', text: 'Hello' },
    { op: 'append', surface: 's1', id: 't', text: ', world' },
    { op: 'node', surface: 's1', id: 'box', type: 'stack', children: ['c'] },
    { op: 'node', surface: 's1', id: 'c', type: 'callout', text: 'note', tone: 'info' },
    { op: 'patch', surface: 's1', id: 'c', props: { tone: 'danger', title: 'Careful', bogus: 1 } },
    { op: 'patch', surface: 's1', id: 'c', props: { title: null, type: 'text' } },
    { op: 'remove', surface: 's1', id: 'box' },
    { op: 'append', surface: 's1', id: 'c', text: 'x' },
    { op: 'patch', surface: 's1', id: 'ghost', props: {} }
  ]);
  assert.deepEqual(codes(result.errors), ['unknown-key', 'not-allowed', 'not-allowed', 'unknown-node']);
  const patches = result.ops.filter((op) => op.op === 'patch');
  assert.deepEqual(patches[0].props, { tone: 'danger', title: 'Careful' });
  assert.deepEqual(patches[1].props, { title: null });
  assert.equal(node({ document: result.document }, 't').text, 'Hello, world');
  assert.deepEqual(result.document.root, ['t']);
  assert.deepEqual(node({ document: result.document }, 'c'), { id: 'c', type: 'callout', text: 'note', tone: 'danger' });
});

test('append cannot grow a text past the string limit', () => {
  const result = stream([
    begin({ root: ['t'] }),
    { op: 'node', surface: 's1', id: 't', type: 'text', text: 'x'.repeat(LIMITS.string - 1) },
    { op: 'append', surface: 's1', id: 't', text: 'yy' }
  ]);
  assert.ok(has(result.errors, 'limit'));
});

test('questionnaire steps keep their declarative when, next and validate', () => {
  const steps = [
    { name: 'team', prompt: 'Who?', required: true, choices: [{ value: 'me', label: 'Me' }, { value: 'team', label: 'Team' }], next: [{ if: { field: 'team', op: 'eq', value: 'me' }, goto: 'region' }, { goto: 'size' }] },
    { name: 'size', prompt: 'How many?', input: { label: 'People', maxLength: 4 }, validate: [{ required: true, message: 'Say how many' }], when: { field: 'team', op: 'eq', value: 'team' } },
    { name: 'region', prompt: 'Where?', when: { field: 'later', op: 'filled' }, next: 'nowhere', validate: [{ pattern: '.*' }] }
  ];
  const result = check(doc([{ id: 'q', type: 'questionnaire', steps }], { intent: 'questionnaire' }));
  const kept = node(result, 'q').steps;
  assert.deepEqual(kept[0].next, steps[0].next);
  assert.deepEqual(kept[1].validate, [{ required: true, message: 'Say how many' }]);
  assert.deepEqual(kept[1].when, { field: 'team', op: 'eq', value: 'team' });
  assert.equal(kept[2].when, undefined);
  assert.equal(kept[2].next, undefined);
  assert.equal(kept[2].validate, undefined);
  assert.equal(codes(result.errors).filter((code) => code === 'condition').length, 2);
  assert.ok(has(result.errors, 'invalid-value'));
});

test('unsupported schema constructs are dropped with their property', () => {
  const schema = {
    type: 'object',
    required: ['address', 'name'],
    properties: {
      name: { type: 'string', title: 'Name', pattern: '^a' },
      address: { type: 'object', title: 'Address', properties: {} },
      secret: { type: 'string', title: 'Password', format: 'password' },
      ok: { type: 'integer', title: 'Count', minimum: 1 }
    }
  };
  const result = check(doc([{ id: 'f', type: 'fields', schema }], { intent: 'ask' }));
  assert.deepEqual(Object.keys(node(result, 'f').schema.properties), ['ok']);
  assert.equal(node(result, 'f').schema.required, undefined);
  assert.equal(codes(result.errors).filter((code) => code === 'unsupported-schema').length, 3);
});

test('validateValue checks a bound value once it is resolved', () => {
  const rows = validateValue('table', 'rows', [{ a: 1 }, 'bad', ['x', 2]], { node: { columns: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }] } });
  assert.deepEqual(rows.value, [{ a: 1 }, { a: 'x', b: 2 }]);
  assert.equal(rows.errors.length, 1);
  const href = validateValue('link', 'href', 'javascript:x');
  assert.equal(href.value, undefined);
  assert.equal(href.errors[0].code, 'link-refused');
  assert.equal(validateValue('text', 'nope', 'x').errors[0].code, 'unknown-key');
});

/* ------------------------------------------------------------------------------------------------
 * schema.js
 * --------------------------------------------------------------------------------------------- */

const EVERY_KIND = {
  type: 'object',
  required: ['name', 'plan'],
  properties: {
    name: { type: 'string', title: 'Name', minLength: 2, maxLength: 40 },
    bio: { type: 'string', title: 'Bio', 'x-zx': { field: 'textarea' } },
    due: { type: 'string', title: 'Due', format: 'date' },
    at: { type: 'string', title: 'At', format: 'date-time' },
    time: { type: 'string', title: 'Time', format: 'time' },
    email: { type: 'string', title: 'Email', format: 'email' },
    site: { type: 'string', title: 'Site', format: 'uri' },
    plan: { type: 'string', title: 'Plan', enum: ['basic', 'pro'] },
    tier: { type: 'string', title: 'Tier', oneOf: [{ const: 'a', title: 'Alpha' }, { const: 'b', title: 'Beta' }], 'x-zx': { field: 'optionlist' } },
    owner: { type: 'string', title: 'Owner', oneOf: [{ const: 'u1', title: 'Ana' }], 'x-zx': { field: 'zxselect' } },
    amount: { type: 'number', title: 'Amount', minimum: 0, maximum: 100 },
    seats: { type: 'integer', title: 'Seats', minimum: 1 },
    volume: { type: 'integer', title: 'Volume', minimum: 0, maximum: 10, 'x-zx': { field: 'slider' } },
    stars: { type: 'integer', title: 'Stars', maximum: 5, 'x-zx': { field: 'rating' } },
    agree: { type: 'boolean', title: 'Agree' },
    notify: { type: 'boolean', title: 'Notify', default: true, 'x-zx': { field: 'toggle' } },
    tags: { type: 'array', title: 'Tags', items: { type: 'string', enum: ['x', 'y'] } },
    labels: { type: 'array', title: 'Labels', items: { anyOf: [{ const: 'l1', title: 'One' }] }, maxItems: 3, 'x-zx': { field: 'tagpicker' } }
  }
};

test('schemaToFields maps every type and format to a Field', () => {
  assert.deepEqual(unsupported(EVERY_KIND), []);
  const fields = schemaToFields(EVERY_KIND);
  assert.deepEqual(Object.keys(fields), Object.keys(EVERY_KIND.properties), 'in property order');
  const types = Object.fromEntries(Object.entries(fields).map(([name, field]) => [name, field.type]));
  assert.deepEqual(types, {
    name: 'text', bio: 'textarea', due: 'date', at: 'datetime', time: 'text', email: 'text', site: 'text', plan: 'select',
    tier: 'optionlist', owner: 'zxselect', amount: 'number', seats: 'number', volume: 'slider', stars: 'rating',
    agree: 'checkbox', notify: 'toggle', tags: 'checklist', labels: 'tagpicker'
  });
  assert.equal(fields.name.required, true);
  assert.equal(fields.name.label, 'Name');
  assert.deepEqual(fields.name.props, { minLength: 2, maxLength: 40 });
  assert.equal(fields.time.placeholder, 'HH:MM');
  assert.equal(fields.email.props.inputMode, 'email');
  assert.equal(fields.site.props.inputMode, 'url');
  assert.deepEqual(fields.plan.options, { '': '', basic: 'basic', pro: 'pro' });
  assert.deepEqual(fields.tier.options, { a: 'Alpha', b: 'Beta' });
  assert.deepEqual(fields.owner.props.items, [{ value: 'u1', label: 'Ana' }]);
  assert.deepEqual(fields.amount.props, { min: 0, max: 100 });
  assert.deepEqual(fields.seats.props, { min: 1, step: 1, precision: 0 });
  assert.equal(fields.volume.props.max, 10);
  assert.equal(fields.stars.props.max, 5);
  assert.equal(fields.agree.value, false);
  assert.equal(fields.notify.value, true);
  assert.deepEqual(fields.tags.props.items, [{ value: 'x', label: 'x' }, { value: 'y', label: 'y' }]);
  assert.equal(fields.labels.props.max, 3);
});

test('no kind of property offers a password, hidden or HTML field', () => {
  const offered = new Set(Object.values(FIELD_TYPES).flat());
  for (const type of ['password', 'hidden', 'html', 'custom', 'upload', 'code']) assert.equal(offered.has(type), false, type);
  const problems = unsupported({ type: 'object', properties: { pin: { type: 'string', title: 'PIN', 'x-zx': { field: 'password' } } } });
  assert.equal(problems.length, 1);
  assert.match(problems[0].path, /x-zx\/field/);
});

test('unsupported lists the constructs outside the subset', () => {
  const problems = unsupported({
    type: 'object',
    additionalProperties: false,
    properties: {
      nested: { type: 'object', title: 'N' },
      list: { type: 'array', title: 'L', items: { type: 'number' } },
      pattern: { type: 'string', title: 'P', pattern: '^x' },
      both: { type: 'string', title: 'B', enum: ['a'], oneOf: [{ const: 'a', title: 'A' }] },
      fmt: { type: 'string', title: 'F', format: 'password' },
      union: { type: ['string', 'null'], title: 'U' },
      slider: { type: 'number', title: 'S', 'x-zx': { field: 'slider' } }
    },
    required: ['ghost']
  });
  const paths = problems.map((problem) => problem.path);
  for (const path of ['/additionalProperties', '/properties/nested/type', '/properties/list/items', '/properties/pattern/pattern', '/properties/both/oneOf', '/properties/fmt/format', '/properties/union/type', '/properties/slider/x-zx/field', '/required/0']) {
    assert.ok(paths.some((entry) => entry.startsWith(path)), path);
  }
  assert.equal(unsupported(null).length, 1);
  assert.throws(() => schemaToFields({ type: 'object', properties: { a: { type: 'object' } } }), TypeError);
});

test('checkValue returns JSON, skips hidden properties, and a hidden required field does not block', () => {
  const schema = {
    type: 'object',
    required: ['method', 'iban'],
    properties: {
      method: { type: 'string', title: 'Payment', enum: ['card', 'transfer'] },
      iban: { type: 'string', title: 'IBAN', minLength: 15 },
      count: { type: 'integer', title: 'Count' },
      ok: { type: 'boolean', title: 'OK' }
    }
  };
  const hidden = checkValue(schema, { method: 'card', iban: '', count: '3', ok: false, extra: 'dropped' }, ['iban']);
  assert.deepEqual(hidden.errors, []);
  assert.deepEqual(hidden.values, { method: 'card', count: 3, ok: false });

  const shown = checkValue(schema, { method: 'transfer', iban: 'DE12', count: 'many' });
  assert.deepEqual(shown.errors.map((error) => error.name), ['iban', 'count']);
  assert.equal(shown.errors[1].message, 'Enter a whole number.');

  const missing = checkValue(schema, { method: 'cash' }, ['iban']);
  assert.deepEqual(missing.errors.map((error) => error.name), ['method']);
  const required = checkValue(schema, {}, []);
  assert.deepEqual(required.errors.map((error) => error.name), ['method', 'iban']);
  assert.equal(required.errors[0].message, 'Enter an answer to continue.');
});

test('checkValue brings Dates and numbers to JSON by format', () => {
  const schema = {
    type: 'object',
    properties: {
      day: { type: 'string', title: 'Day', format: 'date' },
      at: { type: 'string', title: 'At', format: 'date-time' },
      time: { type: 'string', title: 'Time', format: 'time' },
      code: { type: 'string', title: 'Code' },
      picks: { type: 'array', title: 'Picks', items: { enum: ['1', '2'] }, minItems: 1 }
    }
  };
  const when = new Date(2026, 9, 9, 7, 5, 9);
  const result = checkValue(schema, { day: when, at: when, time: when, code: 42, picks: [2] });
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.values, { day: '2026-10-09', at: '2026-10-09T07:05:09', time: '07:05', code: '42', picks: ['2'] });
  assert.equal(toJsonValue({ type: 'string', format: 'date' }, new Date(Number.NaN)), null);
  const bad = checkValue(schema, { day: '2026-02-30', picks: ['3'] });
  assert.deepEqual(bad.errors.map((error) => error.name), ['day', 'picks']);
  const localized = checkValue(schema, { day: 'x' }, [], (key) => `msg:${key}`);
  assert.equal(localized.errors[0].message, 'msg:date');
});

/* ------------------------------------------------------------------------------------------------
 * Regressions
 * --------------------------------------------------------------------------------------------- */

test('node types and intents named after Object members are unknown, never inherited', () => {
  for (const type of ['toString', 'constructor', '__proto__', 'hasOwnProperty', 'valueOf']) {
    const result = stream([begin({ root: ['a'] }), { op: 'node', surface: 's1', id: 'a', type }, { op: 'end', surface: 's1' }]);
    assert.ok(has(result.errors, 'unknown-type'), type);
    assert.deepEqual(node({ document: result.document }, 'a'), { id: 'a', type }, type);
  }
  for (const intent of ['toString', 'constructor', '__proto__']) {
    const result = stream([begin({ intent }), { op: 'end', surface: 's1' }]);
    assert.ok(has(result.errors, 'unknown-intent'), intent);
    assert.equal(result.document.intent, null);
  }
  assert.equal(validateValue('toString', 'text', 'x').errors[0].code, 'unknown-key');
  assert.equal(validateValue('text', 'constructor', 'x').errors[0].code, 'unknown-key');
});

test('schema, steps and name cannot be bound to data, on a node or in a patch', () => {
  for (const [type, prop, intent] of [['fields', 'schema', 'ask'], ['questionnaire', 'steps', 'questionnaire'], ['choice', 'name', 'choose']]) {
    const result = stream([begin({ intent, root: ['a'] }), { op: 'node', surface: 's1', id: 'a', type, [prop]: { $data: '/x' } }]);
    assert.ok(result.errors.some((error) => error.code === 'not-allowed' && error.path === `/${prop}`), prop);
    assert.equal(node({ document: result.document }, 'a')[prop], undefined);
    assert.equal(validateValue(type, prop, {}).errors[0].code, 'not-allowed');
  }
  const patched = stream([
    begin({ intent: 'ask', root: ['a'] }),
    { op: 'node', surface: 's1', id: 'a', type: 'fields', schema: { type: 'object', properties: { x: { type: 'string', title: 'X' } } } },
    { op: 'patch', surface: 's1', id: 'a', props: { schema: { $data: '/s' }, title: 'New' } }
  ]);
  assert.ok(has(patched.errors, 'not-allowed'));
  const patch = patched.ops.find((op) => op.op === 'patch');
  assert.deepEqual(patch.props, { title: 'New' }, 'a refused value leaves the current one in place');
  assert.deepEqual(Object.keys(node({ document: patched.document }, 'a').schema.properties), ['x']);
  assert.ok(patched.state.surfaces.get('s1').names.has('x'), 'the kept schema still declares its inputs');
});

test('the data tree stays within the value depth across data operations', () => {
  const chain = (levels) => {
    let value = 1;
    for (let level = 0; level < levels; level += 1) value = { a: value };
    return value;
  };
  const state = createValidationState();
  validateOp(begin(), state);
  let path = '/a';
  let refusal = null;
  for (let index = 0; index < 50 && !refusal; index += 1) {
    const result = validateOp({ op: 'data', surface: 's1', path, value: chain(10) }, state);
    if (!result.op) refusal = result.errors[0];
    path += '/a'.repeat(10);
  }
  assert.equal(refusal?.code, 'limit');
  assert.ok(JSON.stringify(stateToDocument(state, 's1').data).length < 1000);
});

test('the data size is kept exact as values are set, replaced and removed', () => {
  const state = createValidationState();
  validateOp(begin(), state);
  const ops = [
    { path: '/a', value: { b: [1, 2, 3], c: 'x' } },
    { path: '/a/b/-', value: 4 },
    { path: '/a/b/0', value: 'one' },
    { path: '/a/b/1', remove: true },
    { path: '/a/c', remove: true },
    { path: '/d', value: [] },
    { path: '/d/0', value: { e: null } },
    { path: '/a', value: 'flat' },
    { path: '/a', remove: true },
    { path: '', value: { fresh: true } },
    { path: '/g', value: 'é"\\' }
  ];
  const track = state.surfaces.get('s1');
  for (const op of ops) {
    validateOp({ op: 'data', surface: 's1', ...op }, state);
    assert.equal(track.dataSize, JSON.stringify(track.data).length, JSON.stringify(op));
  }
});

test('__proto__, constructor and prototype are refused as names, ids and keys wherever they would become keys', () => {
  const choice = stream([begin({ intent: 'choose', root: ['a'] }), { op: 'node', surface: 's1', id: 'a', type: 'choice', name: '__proto__', label: 'L', choices: [{ value: 'a', label: 'A' }] }]);
  assert.ok(choice.errors.some((error) => error.path === '/name'));
  assert.equal(node({ document: choice.document }, 'a').name, undefined);

  const table = stream([begin({ intent: 'review', root: ['a'] }), { op: 'node', surface: 's1', id: 'a', type: 'table', name: 'constructor', selectable: 'multi', rowId: '__proto__', columns: [{ id: '__proto__', label: 'P' }, { id: 'ok', label: 'OK' }], rows: [['bad', 'good']] }]);
  const tableNode = node({ document: table.document }, 'a');
  assert.deepEqual(tableNode.columns, [{ id: 'ok', label: 'OK' }]);
  assert.deepEqual(tableNode.rows, [{ ok: 'good' }]);
  assert.equal(Object.getPrototypeOf(table.state.surfaces.get('s1').nodes.get('a').rows[0]), Object.prototype);
  assert.equal(tableNode.name, undefined);
  assert.equal(tableNode.rowId, undefined);

  const listSchema = stream([begin({ intent: 'ask', root: ['a'] }), { op: 'node', surface: 's1', id: 'a', type: 'fields', schema: { type: 'object', properties: [{ name: '__proto__', type: 'string', title: 'Evil' }, { name: 'prototype', type: 'string', title: 'Evil' }, { name: 'ok', type: 'string', title: 'OK' }] } }]);
  const properties = listSchema.state.surfaces.get('s1').nodes.get('a').schema.properties;
  assert.equal(Object.getPrototypeOf(properties), Object.prototype);
  assert.deepEqual(Object.keys(properties), ['ok']);
  assert.equal(codes(listSchema.errors).filter((code) => code === 'forbidden-key').length, 2);

  const diff = stream([begin({ intent: 'review', root: ['a'] }), { op: 'node', surface: 's1', id: 'a', type: 'diff', name: 'changes', rows: [{ id: 'r', field: '__proto__', label: 'L', before: 1, after: 2 }, { id: 's', field: 'ok', label: 'L', before: 1, after: 2 }] }]);
  assert.deepEqual(node({ document: diff.document }, 'a').rows.map((row) => row.field), ['ok']);

  const steps = stream([begin({ intent: 'questionnaire', root: ['a'] }), { op: 'node', surface: 's1', id: 'a', type: 'questionnaire', steps: [
    { name: '__proto__', prompt: 'P' },
    { name: 'ok', prompt: 'Q', when: { field: '__proto__', op: 'filled' } },
    { name: 'constructor', prompt: 'R' }
  ] }]);
  const kept = node({ document: steps.document }, 'a').steps;
  assert.deepEqual(kept.map((step) => step.name), ['ok']);
  assert.equal(kept[0].when, undefined);
  assert.ok(has(steps.errors, 'condition'));

  const ids = stream([begin({ root: ['constructor'] })]);
  assert.ok(has(ids.errors, 'invalid-value'));
  assert.equal({}.polluted, undefined);
});

test('schemaToFields keeps a choice named __proto__ as a value, never a prototype', () => {
  const fields = schemaToFields({ type: 'object', properties: { pick: { type: 'string', title: 'Pick', enum: ['__proto__', 'a'] } } });
  assert.equal(Object.getPrototypeOf(fields.pick.options), Object.prototype);
  assert.deepEqual(Object.keys(fields.pick.options), ['', '__proto__', 'a']);
  assert.equal(Object.getOwnPropertyDescriptor(fields.pick.options, '__proto__').value, '__proto__');
  assert.ok(unsupported({ type: 'object', properties: JSON.parse('{"__proto__":{"type":"string","title":"x"}}') }).length > 0);
});

test('the order of inputs follows the tree, not the order nodes arrive in', () => {
  const later = (root) => stream([
    begin({ intent: 'ask', root }),
    { op: 'node', surface: 's1', id: 'second', type: 'fields', visible: { field: 'm', op: 'eq', value: 'x' }, schema: { type: 'object', properties: { y: { type: 'string', title: 'Y' } } } },
    { op: 'node', surface: 's1', id: 'first', type: 'fields', schema: { type: 'object', properties: { m: { type: 'string', title: 'M' } } } },
    { op: 'end', surface: 's1' }
  ]);
  const kept = later(['first', 'second']);
  assert.deepEqual(kept.errors, [], 'arrived first but declared later in the tree: kept');
  assert.deepEqual(node({ document: kept.document }, 'second').visible, { field: 'm', op: 'eq', value: 'x' });
  const dropped = later(['second', 'first']);
  assert.ok(has(dropped.errors, 'condition'), 'the field comes later in the tree: dropped at end');
  assert.equal(node({ document: dropped.document }, 'second').visible, undefined);

  const document = check({ ...doc([]), intent: 'ask', root: ['first', 'second'], nodes: [
    { id: 'second', type: 'fields', visible: { field: 'm', op: 'filled' }, schema: { type: 'object', properties: { y: { type: 'string', title: 'Y' } } } },
    { id: 'first', type: 'fields', schema: { type: 'object', properties: { m: { type: 'string', title: 'M' } } } }
  ] });
  assert.deepEqual(document.errors, []);
  assert.deepEqual(node(document, 'second').visible, { field: 'm', op: 'filled' });

  const self = stream([begin({ intent: 'ask', root: ['a'] }), { op: 'node', surface: 's1', id: 'a', type: 'fields', visible: { field: 'own', op: 'filled' }, schema: { type: 'object', properties: { own: { type: 'string', title: 'Own' } } } }]);
  assert.ok(has(self.errors, 'condition'), 'a node cannot depend on its own inputs');
});

test('a link is returned as the address it parses to, and invisible or mixed-case ones are refused', () => {
  const ok = check(doc([{ id: 'l', type: 'link', text: 'Docs', href: 'https://ex%2ecom' }, { id: 'm', type: 'link', text: 'IDN', href: 'https://аpple.com/a b'.replace(' ', '%20') }]));
  assert.deepEqual(ok.errors, []);
  assert.equal(node(ok, 'l').href, 'https://ex.com/');
  assert.equal(new URL(node(ok, 'm').href).host, 'xn--pple-43d.com');
  for (const href of ['HTTPS://ex.com', 'https://ex.com​.evil.io/', 'https://exa­mple.com', 'https://ex.com/‮gnp.exe', 'https://ex.com/\u{E0041}', 'https://ex.com/﻿']) {
    const result = check(doc([{ id: 'l', type: 'link', text: 'x', href }]));
    assert.ok(has(result.errors, 'link-refused'), JSON.stringify(href));
  }
});

test('normaliseLink() is the one link check: it normalises, or says why it refuses', () => {
  assert.deepEqual(normaliseLink('https://Example.com:443/a b'.replace(' ', '')), { href: 'https://example.com/ab', problem: null });
  assert.equal(normaliseLink('https://аpple.com/').href, 'https://xn--pple-43d.com/');
  for (const value of [null, 'http://example.com/', 'HTTPS://example.com/', 'https://u:p@example.com/', 'https://example.com/\u200b', `https://example.com/${'a'.repeat(LIMITS.href)}`]) {
    const link = normaliseLink(value);
    assert.equal(link.href, null, String(value));
    assert.equal(typeof link.problem, 'string');
  }
  // A link node reports the same problem.
  const { errors } = validateDocument({ zx: 'surface/1', surface: 's', intent: 'show', title: 'T', author: 'a', root: ['l'], nodes: [{ id: 'l', type: 'link', text: 'x', href: 'http://example.com/' }] });
  const refused = errors.find((error) => error.code === 'link-refused');
  assert.ok(refused && refused.message.startsWith(normaliseLink('http://example.com/').problem), refused?.message);
});

test('an action using a reserved id is dropped and reported', () => {
  for (const id of ['cancel', 'dismiss']) {
    const whole = check(doc([{ id: 't', type: 'text', text: 'x' }], { intent: 'confirm', actions: [{ id, label: 'Approved' }, { id: 'go', label: 'Go' }] }));
    assert.deepEqual(whole.document.actions.map((action) => action.id), ['go'], id);
    assert.ok(whole.errors.some((error) => error.code === 'not-allowed' && error.id === id), id);
    const streamed = stream([begin({ intent: 'confirm' }), { op: 'actions', surface: 's1', items: [{ id, label: 'Approved' }] }]);
    assert.deepEqual(streamed.document.actions, [], id);
    assert.ok(has(streamed.errors, 'not-allowed'), id);
  }
});

test('a questionnaire keeps no actions of its own', () => {
  const steps = [{ name: 'a', prompt: 'A?', choices: [{ value: 'x', label: 'X' }] }];
  const result = check(doc([{ id: 'q', type: 'questionnaire', steps }], { intent: 'questionnaire', actions: [{ id: 'submit', label: 'Declined' }] }));
  assert.equal(result.document.actions.length, 0);
  assert.ok(has(result.errors, 'not-allowed'));
});

test('the tables of a surface hold 100,000 cells, a binding counted each time it is used', () => {
  assert.equal(LIMITS.cells, 100000);
  const columns = Array.from({ length: 50 }, (_, index) => ({ id: `c${index}`, label: 'C' }));
  const rows = Array.from({ length: 1000 }, () => ({ c0: 1 }));
  const bound = ['a', 'b', 'c'].map((id) => ({ id, type: 'table', columns, rows: { $data: '/rows' } }));
  const result = check(doc(bound, { data: { rows } }));
  assert.deepEqual(['a', 'b', 'c'].map((id) => Object.hasOwn(node(result, id), 'rows')), [true, true, false]);
  assert.ok(result.errors.some((error) => error.code === 'limit' && error.id === 'c' && error.path === '/nodes/c/rows'));

  // Written out, and drawn as changes (three columns each), the same budget applies.
  const written = check(doc([{ id: 'a', type: 'table', columns, rows }, { id: 'b', type: 'table', columns, rows }, { id: 'c', type: 'table', columns: columns.slice(0, 1), rows }]));
  assert.deepEqual(codes(written.errors).filter((code) => code === 'limit'), ['limit']);
  const changes = Array.from({ length: 1000 }, (_, index) => ({ id: `r${index}`, field: 'f', label: 'L', before: 1, after: 2 }));
  const diffs = Array.from({ length: 34 }, (_, index) => ({ id: `d${index}`, type: 'diff', name: `n${index}`, rows: changes }));
  const reviewed = check(doc(diffs, { intent: 'review' }));
  assert.equal(reviewed.document.nodes.filter((entry) => Object.hasOwn(entry, 'rows')).length, 33);

  // What a smaller table needs can still fit after a larger one was dropped.
  const small = { id: 'd', type: 'table', columns: columns.slice(0, 1), rows: rows.slice(0, 10) };
  const fitted = check(doc([bound[0], { ...bound[1], columns: columns.slice(0, 40) }, bound[2], small], { data: { rows } }));
  assert.deepEqual(['a', 'b', 'c', 'd'].map((id) => Object.hasOwn(node(fitted, id), 'rows')), [true, true, false, true]);

  // A stream is told what to drop when it ends.
  const streamed = stream([begin({ root: ['a', 'b', 'c'] }), { op: 'data', surface: 's1', path: '/rows', value: rows }, ...bound.map((entry) => ({ op: 'node', surface: 's1', ...entry })), { op: 'end', surface: 's1' }]);
  assert.ok(streamed.ops.some((op) => op.op === 'patch' && op.id === 'c' && op.props.rows === null));
});

const questionnaire = (steps) => check(doc([{ id: 'q', type: 'questionnaire', steps }], { intent: 'questionnaire' }));
const asked = (name, extra = {}) => ({ name, prompt: `${name}?`, choices: [{ value: 'x', label: 'X' }], ...extra });
const nextOf = (result) => Object.fromEntries(node(result, 'q').steps.map((step) => [step.name, step.next ?? null]));

test('a questionnaire next naming a dropped step is dropped and reported', () => {
  const direct = questionnaire([asked('a', { next: 'gone' }), { name: 'gone' }, asked('c')]);
  assert.deepEqual(nextOf(direct), { a: null, c: null });
  assert.ok(direct.errors.some((error) => error.code === 'condition' && error.path === '/nodes/0/steps/0/next' && /gone/.test(error.message)));
  const branch = questionnaire([asked('a', { next: [{ if: { field: 'a', op: 'eq', value: 'x' }, goto: 'gone' }, { goto: 'c' }] }), { name: 'gone' }, asked('c')]);
  assert.equal(nextOf(branch).a, null);
  assert.ok(has(branch.errors, 'condition'));
  // A step dropped for its name is as gone as one dropped for its prompt, and the later of two of a name stays dropped.
  assert.equal(nextOf(questionnaire([asked('a', { next: '__proto__' }), asked('c')])).a, null);
  assert.deepEqual(nextOf(questionnaire([asked('a', { next: 'c' }), asked('b'), asked('c')])), { a: 'c', b: null, c: null });
});

test('a questionnaire next forming a cycle is dropped and reported', () => {
  const pair = questionnaire([asked('a', { next: 'b' }), asked('b', { next: 'a' })]);
  assert.deepEqual(nextOf(pair), { a: 'b', b: null });
  assert.ok(pair.errors.some((error) => error.code === 'condition' && error.path === '/nodes/0/steps/1/next'));

  // Back to a step that falls through to this one.
  assert.deepEqual(nextOf(questionnaire([asked('a'), asked('b'), asked('c', { next: 'a' })])), { a: null, b: null, c: null });
  // A branch may be taken or not: a list that can go back goes.
  const branch = questionnaire([asked('a'), asked('b', { next: [{ if: { field: 'b', op: 'eq', value: 'x' }, goto: 'a' }, { goto: '$submit' }] })]);
  assert.equal(nextOf(branch).b, null);
  // A hidden step is walked past, so its own `next` does not stop the way back.
  const past = questionnaire([asked('a'), asked('b', { when: { field: 'a', op: 'eq', value: 'y' }, next: '$submit' }), asked('c', { next: 'a' })]);
  assert.equal(nextOf(past).c, null);
  assert.ok(has(past.errors, 'condition'));

  // Going back is not a cycle when nothing there leads here, and going forward never is one.
  const back = questionnaire([asked('a', { next: 'c' }), asked('b', { next: '$submit' }), asked('c', { next: 'b' })]);
  assert.deepEqual(nextOf(back), { a: 'c', b: '$submit', c: 'b' });
  assert.deepEqual(back.errors, []);
});

test('nesting past any stack is refused wherever it is written', () => {
  const deep = (depth) => JSON.parse('['.repeat(depth) + ']'.repeat(depth));
  const value = deep(100000);
  const state = createValidationState();
  validateOp(begin(), state);
  for (const key of ['op', 'surface', 'id', 'type', 'props', 'path', 'value', 'items', 'root', 'intent', 'title', 'sources']) {
    for (const op of ['node', 'patch', 'data', 'actions', 'end']) {
      const line = { op, surface: 's1', [key]: value };
      assert.doesNotThrow(() => validateOp(line, state), `${op} with a deep "${key}"`);
    }
  }
  const unknown = validateOp({ op: value, surface: 's1' }, createValidationState());
  assert.equal(unknown.errors[0].code, 'unknown-op');
  assert.match(unknown.errors[0].message, /^Unknown operation a list;/);
  assert.match(validateOp({ op: 'x'.repeat(5000), surface: 's1' }, state).errors[0].message.slice(0, 100), /^Unknown operation "x+"/);
  assert.ok(validateOp({ op: 'x'.repeat(5000), surface: 's1' }, state).errors[0].message.length < 300);
  assert.equal(check({ zx: 'surface/1', surface: value, intent: value, root: value, nodes: value }).document, null);
});

test('a name every object inherits is only ever a name', () => {
  const schema = { type: 'object', properties: { removeAttribute: { type: 'string', title: 'A' }, toString: { type: 'string', title: 'B' } } };
  const result = check(doc([
    { id: 'kind', type: 'constructor' },
    { id: 'list', type: 'table', name: 'pick', rowId: 'toString', selectable: 'multi', columns: [{ id: 'valueOf', label: 'V' }], rows: [{ valueOf: 1 }] },
    { id: 'form', type: 'fields', schema }
  ], { intent: 'ask' }));
  assert.equal(node(result, 'kind').type, 'constructor');
  assert.ok(result.errors.some((error) => error.code === 'unknown-type' && error.id === 'kind'));
  assert.equal(node(result, 'list').rowId, 'toString');
  assert.deepEqual(Object.keys(node(result, 'form').schema.properties), ['removeAttribute', 'toString']);
  assert.equal(({}).removeAttribute, undefined);
  assert.equal(typeof ({}).toString, 'function');
});
