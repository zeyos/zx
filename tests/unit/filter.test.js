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
