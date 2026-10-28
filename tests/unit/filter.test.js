import assert from 'node:assert/strict';
import test from 'node:test';

import {
  cloneFilterAst, cloneFilterValue, emptyFilterAst, filterCondition, filterGroup,
  parseFilterAst, stringifyFilterAst, validateFilterAst
} from '../../src/components/filter/filter-model.js';

const fields = [
  { id: 'status', label: 'Status', type: 'status', defaultOperator: 'eq' },
  { id: 'amount', label: 'Amount', type: 'money', defaultOperator: 'gte' },
  { id: 'date', label: 'Date', type: 'date', defaultOperator: 'on' }
];

function sampleAst() {
  return {
    version: 1,
    root: {
      kind: 'group', id: 'root', logic: 'and', children: [
        { kind: 'condition', id: 'paid', field: 'status', operator: 'eq', value: 'paid' },
        { kind: 'group', id: 'amount-or-date', logic: 'or', children: [
          { kind: 'condition', id: 'amount', field: 'amount', operator: 'gte', value: 1000 },
          { kind: 'condition', id: 'date', field: 'date', operator: 'between', value: ['2026-01-01', '2026-12-31'] }
        ] }
      ]
    }
  };
}

test('filter AST parses defensively, validates, and serializes without mutating input', () => {
  const source = sampleAst();
  const parsed = parseFilterAst(source);
  assert.deepEqual(validateFilterAst(parsed, fields), { valid: true, errors: [] });
  assert.deepEqual(JSON.parse(stringifyFilterAst(parsed)), source);
  parsed.root.children[0].value = 'open';
  assert.equal(source.root.children[0].value, 'paid');
  assert.deepEqual(cloneFilterAst(source), source);
});

test('semantic validation keeps unknown fields and operators visible as actionable errors', () => {
  const ast = sampleAst();
  ast.root.children.push({
    kind: 'condition', id: 'legacy', field: 'retired-field', operator: 'legacy-op', value: 'x'
  });
  const result = validateFilterAst(parseFilterAst(ast), fields);
  assert.equal(result.valid, false);
  assert.deepEqual(result.errors.filter((error) => error.nodeId === 'legacy').map((error) => error.code),
    ['unknown-field', 'unknown-operator']);
});

test('operator arity and field type compatibility are enforced', () => {
  const ast = sampleAst();
  ast.root.children[0].operator = 'between';
  ast.root.children[0].value = ['one'];
  const result = validateFilterAst(parseFilterAst(ast), fields);
  assert.ok(result.errors.some((error) => error.code === 'operator-type'));
  assert.ok(result.errors.some((error) => error.code === 'value'));
});

test('parser enforces unique IDs, depth, count, and JSON-safe values', () => {
  const duplicate = sampleAst();
  duplicate.root.children[1].children[0].id = 'paid';
  assert.throws(() => parseFilterAst(duplicate), /unique/);
  assert.throws(() => parseFilterAst(sampleAst(), { maxDepth: 0 }), /depth/);
  assert.throws(() => parseFilterAst(sampleAst(), { maxConditions: 2 }), /count/);
  assert.throws(() => cloneFilterValue({ amount: Number.NaN }), /non-finite/);
  assert.throws(() => cloneFilterValue(new Date()), /JSON-safe/);
  const cycle = {};
  cycle.self = cycle;
  assert.throws(() => cloneFilterValue(cycle), /cycles/);
});

test('JSON cloning preserves an own __proto__ member without changing object prototypes', () => {
  const source = JSON.parse('{"__proto__":{"polluted":true},"safe":1}');
  const clone = cloneFilterValue(source);
  assert.equal(Object.getPrototypeOf(clone), Object.prototype);
  assert.equal(Object.hasOwn(clone, '__proto__'), true);
  assert.deepEqual(clone.__proto__, { polluted: true });
  assert.equal({}.polluted, undefined);
  assert.deepEqual(JSON.parse(JSON.stringify(clone)), source);
});

test('AST factories create stable shapes without sharing caller values', () => {
  const payload = { currency: 'EUR' };
  const condition = filterCondition({ field: 'amount', operator: 'eq', value: payload });
  payload.currency = 'USD';
  assert.deepEqual(condition.value, { currency: 'EUR' });
  const group = filterGroup('or', [condition]);
  const empty = emptyFilterAst();
  assert.equal(group.logic, 'or');
  assert.equal(group.children[0], condition);
  assert.equal(empty.version, 1);
  assert.equal(empty.root.children.length, 0);
});


test('restricted root logic rejects a mismatching saved expression without rewriting it', async () => {
  const {rootLogicError} = await import('../../src/components/filter/filter.js');
  const ast = sampleAst();
  assert.equal(rootLogicError(ast, 'and'), null);
  assert.equal(rootLogicError(ast, null), null);
  const before = JSON.stringify(ast);
  const mismatch = rootLogicError(ast, 'or');
  assert.equal(mismatch.code, 'root-logic');
  assert.equal(mismatch.nodeId, 'root');
  assert.equal(JSON.stringify(ast), before);
});

test('a TagPicker value round-trips through the AST with its raw values', async () => {
  const { filterTagItems, filterTagValue } = await import('../../src/components/filter/filter.js');
  const glyph = { nodeType: 1, cloneNode: () => glyph };
  const items = filterTagItems([
    { value: 1, label: 'Open', icon: 'circle' },
    { value: 'won', label: 'Won', icon: glyph, color: 'var(--zx-color-success)' },
    { value: true, label: 'Flagged' }
  ]);
  // Raw values, the icon as given (a name or a node), no icon key where none was given.
  assert.deepEqual(items.map((item) => item.value), [1, 'won', true]);
  assert.equal(items[0].icon, 'circle');
  assert.equal(items[1].icon, glyph);
  assert.equal(items[1].color, 'var(--zx-color-success)');
  assert.equal(Object.hasOwn(items[2], 'icon'), false);
  assert.deepEqual(filterTagItems(undefined), []);

  const picked = [2, 'won'];
  const value = filterTagValue(picked);
  assert.deepEqual(value, [2, 'won']);
  assert.notEqual(value, picked, 'the condition gets a copy, not the picker array');
  assert.deepEqual(filterTagValue(null), []);

  const statusFields = [{ id: 'status', label: 'Status', type: 'status', choices: [{ value: 2, label: 'Paid' }, { value: 'won', label: 'Won' }] }];
  const ast = { version: 1, root: { kind: 'group', id: 'root', logic: 'and', children: [
    { kind: 'condition', id: 'c', field: 'status', operator: 'anyOf', value }
  ] } };
  const parsed = parseFilterAst(JSON.parse(stringifyFilterAst(ast)));
  assert.deepEqual(parsed.root.children[0].value, [2, 'won'], 'anyOf keeps a number a number');
  assert.equal(validateFilterAst(parsed, statusFields).valid, true);
  assert.equal(validateFilterAst({ ...parsed, root: { ...parsed.root, children: [{ ...parsed.root.children[0], value: filterTagValue([]) }] } }, statusFields).valid, false,
    'an empty pick is not applied');
});

test('the connector switches its group, names itself by its word, and agrees with the select', async () => {
  const { filterConnectorText, nextFilterGroupLogic } = await import('../../src/components/filter/filter.js');
  const ast = sampleAst();
  // The nested group is "or": its connector reads "or" and switches it to "and"; the root the reverse.
  assert.equal(nextFilterGroupLogic(ast, 'amount-or-date'), 'and');
  assert.equal(nextFilterGroupLogic(ast, 'root'), 'or');
  assert.equal(nextFilterGroupLogic(ast, 'missing'), null);
  assert.equal(nextFilterGroupLogic(ast, 'paid'), null, 'a condition is not a group');
  assert.equal(nextFilterGroupLogic(ast, 'root', 'and'), null, 'a restricted root does not switch');
  assert.equal(nextFilterGroupLogic(ast, 'amount-or-date', 'and'), 'and', 'the restriction is the root only');

  // Applying the switch is what the select would set: the two name one state, both ways.
  const group = ast.root.children[1];
  for (let round = 0; round < 2; round += 1) {
    const before = group.logic;
    group.logic = nextFilterGroupLogic(ast, group.id);
    assert.notEqual(group.logic, before);
    assert.ok(['and', 'or'].includes(group.logic), 'a value the group select offers');
    const { word, name } = filterConnectorText(group.logic);
    assert.equal(word, group.logic);
    assert.ok(name.startsWith(word), `label in name: "${name}" starts with "${word}"`);
  }
  assert.deepEqual(filterConnectorText('and'), { word: 'and', name: 'and — switch to any' });
  assert.deepEqual(filterConnectorText('or'), { word: 'or', name: 'or — switch to all' });
  const german = { 'filter.and': 'und', 'filter.switchToAny': '%1 – zu „beliebig“ wechseln' };
  const translated = filterConnectorText('and', (key, fallback, ...args) =>
    (german[key] ?? fallback).replace('%1', String(args[0])));
  assert.deepEqual(translated, { word: 'und', name: 'und – zu „beliebig“ wechseln' });
});

test('host messages reach the TagPicker with the field-named input added', async () => {
  const { withFilterMessage } = await import('../../src/components/filter/filter.js');
  assert.deepEqual(withFilterMessage(null, 'tagPicker.input', 'Owner value'), { 'tagPicker.input': 'Owner value' });
  const host = { 'tagPicker.remove': 'Entfernen %1', de: { 'tagPicker.empty': 'Keine Treffer', 'tagPicker.input': 'x' } };
  const merged = withFilterMessage(host, 'tagPicker.input', 'Besitzer Wert');
  assert.equal(merged['tagPicker.remove'], 'Entfernen %1');
  assert.equal(merged.de['tagPicker.empty'], 'Keine Treffer');
  assert.equal(merged.de['tagPicker.input'], 'Besitzer Wert', 'the locale table cannot shadow the field name');
  assert.equal(merged['tagPicker.input'], 'Besitzer Wert');
  assert.equal(host.de['tagPicker.input'], 'x', 'the host object is left as it was');
});
