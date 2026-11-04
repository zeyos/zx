import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CONDITION_OPS, MAX_CONDITION_DEPTH, NEXT_REVIEW, NEXT_SUBMIT, RULE_MESSAGES, checkCondition,
  checkNext, checkRuleList, checkRules, evaluate, resolveNext, ruleMessage
} from '../../src/components/questionnaire/conditions.js';
import {
  normalizeItems, progressOf, resolveFlow, resolveNext as nextItem
} from '../../src/components/questionnaire/items.js';

/** @param {string} field @param {string} op @param {unknown} [value] @returns {any} */
const is = (field, op, value) => (value === undefined ? { field, op } : { field, op, value });

/** @param {any} condition @param {Record<string, unknown>} answers @returns {boolean} */
const holds = (condition, answers) => evaluate(condition, answers);

/** Nests a leaf inside `levels - 1` `not`s, so the whole condition is `levels` deep. */
function nested(levels) {
  /** @type {any} */
  let condition = is('a', 'eq', 1);
  for (let level = 1; level < levels; level += 1) condition = { not: condition };
  return condition;
}

test('the grammar names exactly the documented ops', () => {
  assert.deepEqual([...CONDITION_OPS].sort(),
    ['contains', 'empty', 'eq', 'filled', 'gt', 'gte', 'in', 'lt', 'lte', 'ne', 'nin'].sort());
  assert.equal(MAX_CONDITION_DEPTH, 4);
});

test('eq and ne compare strictly, with numbers matching numeric text', () => {
  assert.equal(holds(is('a', 'eq', 'x'), { a: 'x' }), true);
  assert.equal(holds(is('a', 'eq', 'x'), { a: 'X' }), false);
  assert.equal(holds(is('a', 'eq', 3), { a: '3' }), true);
  assert.equal(holds(is('a', 'eq', '3'), { a: 3 }), true);
  assert.equal(holds(is('a', 'eq', 3), { a: '3x' }), false);
  assert.equal(holds(is('a', 'eq', true), { a: 'true' }), false);
  assert.equal(holds(is('a', 'eq', null), { a: null }), true);
  assert.equal(holds(is('a', 'eq', 'x'), {}), false);
  assert.equal(holds(is('a', 'ne', 'x'), { a: 'y' }), true);
  assert.equal(holds(is('a', 'ne', 'x'), { a: 'x' }), false);
  assert.equal(holds(is('a', 'ne', 'x'), {}), true, 'a missing answer is not equal');
});

test('in and nin test membership, and a multiple answer is in when any entry is', () => {
  assert.equal(holds(is('a', 'in', ['x', 'y']), { a: 'y' }), true);
  assert.equal(holds(is('a', 'in', ['x', 'y']), { a: 'z' }), false);
  assert.equal(holds(is('a', 'in', [1, 2]), { a: '2' }), true);
  assert.equal(holds(is('a', 'in', ['x']), { a: ['z', 'x'] }), true);
  assert.equal(holds(is('a', 'in', ['x']), { a: [] }), false);
  assert.equal(holds(is('a', 'nin', ['x', 'y']), { a: 'z' }), true);
  assert.equal(holds(is('a', 'nin', ['x', 'y']), { a: 'x' }), false);
  assert.equal(holds(is('a', 'nin', ['x']), {}), true);
});

test('gt, gte, lt and lte order numbers by value and strings in code-point order', () => {
  assert.equal(holds(is('n', 'gt', 5), { n: 6 }), true);
  assert.equal(holds(is('n', 'gt', 5), { n: 5 }), false);
  assert.equal(holds(is('n', 'gte', 5), { n: 5 }), true);
  assert.equal(holds(is('n', 'lt', 5), { n: '4.5' }), true);
  assert.equal(holds(is('n', 'lte', 5), { n: 5 }), true);
  assert.equal(holds(is('n', 'lte', 5), { n: 6 }), false);
  assert.equal(holds(is('d', 'gte', '2026-10-01'), { d: '2026-10-08' }), true);
  assert.equal(holds(is('d', 'lt', '2026-10-01'), { d: '2026-10-08' }), false);
  assert.equal(holds(is('d', 'gte', '2026-10-01'), { d: new Date(2026, 9, 8) }), true, 'a Date compares as its ISO date');
  for (const op of ['gt', 'gte', 'lt', 'lte']) {
    assert.equal(holds(is('n', op, 5), { n: 'five' }), false, `${op} on text that is not a number`);
    assert.equal(holds(is('n', op, 5), {}), false, `${op} on a missing answer`);
    assert.equal(holds(is('n', op, 'b'), { n: 1 }), false, `${op} across types`);
  }
});

test('empty and filled treat blank text, empty lists and null as no answer, and false and 0 as answers', () => {
  for (const value of [undefined, null, '', '   ', [], ['']]) {
    assert.equal(holds(is('a', 'empty'), { a: value }), true, JSON.stringify(value));
    assert.equal(holds(is('a', 'filled'), { a: value }), false, JSON.stringify(value));
  }
  for (const value of [false, 0, 'x', ['x']]) {
    assert.equal(holds(is('a', 'empty'), { a: value }), false, JSON.stringify(value));
    assert.equal(holds(is('a', 'filled'), { a: value }), true, JSON.stringify(value));
  }
  assert.equal(holds(is('a', 'empty'), {}), true);
});

test('contains looks inside a multiple answer or a text answer', () => {
  assert.equal(holds(is('a', 'contains', 'x'), { a: ['x', 'y'] }), true);
  assert.equal(holds(is('a', 'contains', 'z'), { a: ['x', 'y'] }), false);
  assert.equal(holds(is('a', 'contains', 2), { a: [1, 2] }), true);
  assert.equal(holds(is('a', 'contains', 'ell'), { a: 'hello' }), true);
  assert.equal(holds(is('a', 'contains', 'ELL'), { a: 'hello' }), false);
  assert.equal(holds(is('a', 'contains', 'x'), { a: 5 }), false);
  assert.equal(holds(is('a', 'contains', 'x'), {}), false);
});

test('all, any and not combine conditions', () => {
  const answers = { a: 1, b: 2 };
  assert.equal(holds({ all: [is('a', 'eq', 1), is('b', 'eq', 2)] }, answers), true);
  assert.equal(holds({ all: [is('a', 'eq', 1), is('b', 'eq', 3)] }, answers), false);
  assert.equal(holds({ any: [is('a', 'eq', 9), is('b', 'eq', 2)] }, answers), true);
  assert.equal(holds({ any: [is('a', 'eq', 9), is('b', 'eq', 9)] }, answers), false);
  assert.equal(holds({ not: is('a', 'eq', 1) }, answers), false);
  assert.equal(holds({ not: { any: [is('a', 'eq', 9)] } }, answers), true);
  assert.equal(holds({ all: [] }, answers), true);
  assert.equal(holds({ any: [] }, answers), false);
});

test('a condition reads only own answers, never inherited members', () => {
  assert.equal(holds(is('toString', 'filled'), {}), false);
  assert.equal(holds(is('__proto__', 'filled'), {}), false);
});

test('conditions nest at most four levels', () => {
  assert.equal(holds(nested(4), { a: 2 }), true, 'three nots around a leaf');
  assert.throws(() => holds(nested(5), { a: 1 }), TypeError);
  assert.deepEqual(checkCondition(nested(4)), []);
  const problems = checkCondition(nested(5));
  assert.equal(problems.length, 1);
  assert.equal(problems[0].path, '/not/not/not/not');
  assert.equal(checkCondition({ all: [{ any: [{ not: is('a', 'eq', 1) }] }] }).length, 0);
  assert.equal(checkCondition({ all: [{ any: [{ not: { not: is('a', 'eq', 1) } }] }] }).length, 1);
});

test('evaluate refuses malformed conditions', () => {
  assert.throws(() => holds(null, {}), TypeError);
  assert.throws(() => holds({ op: 'eq', value: 1 }, {}), TypeError);
  assert.throws(() => holds(is('a', 'matches', 'x'), {}), TypeError);
  assert.throws(() => holds(is('a', 'in', 'x'), {}), TypeError);
  assert.throws(() => holds({ all: 'x' }, {}), TypeError);
});

test('checkCondition reports every shape problem with its path', () => {
  assert.deepEqual(checkCondition(is('a', 'eq', 1)), []);
  assert.deepEqual(checkCondition(is('a', 'empty')), []);
  /** @type {[any, string][]} */
  const cases = [
    ['x', ''],
    [{ field: 'a', op: 'like', value: 1 }, '/op'],
    [{ op: 'eq', value: 1 }, '/field'],
    [is('a', 'eq'), '/value'],
    [is('a', 'eq', { nested: true }), '/value'],
    [is('a', 'empty', 1), '/value'],
    [is('a', 'in', []), '/value'],
    [is('a', 'in', [[1]]), '/value'],
    [is('a', 'gt', true), '/value'],
    [is('a', 'contains', null), '/value'],
    [{ ...is('a', 'eq', 1), pattern: '.*' }, '/pattern'],
    [{ all: [] }, '/all'],
    [{ all: [is('a', 'eq', 1)], any: [] }, ''],
    [{ any: [is('a', 'eq', 1), 'x'] }, '/any/1']
  ];
  for (const [condition, path] of cases) {
    const problems = checkCondition(condition);
    assert.ok(problems.length > 0, `no problem found in ${JSON.stringify(condition)}`);
    assert.equal(problems[0].path, path, JSON.stringify(condition));
  }
});

test('checkCondition limits field tests to the given fields', () => {
  assert.deepEqual(checkCondition(is('a', 'eq', 1), { fields: ['a'] }), []);
  const problems = checkCondition({ any: [is('a', 'eq', 1), is('later', 'eq', 1)] }, { fields: ['a'] });
  assert.deepEqual(problems.map((problem) => problem.path), ['/any/1/field']);
  assert.equal(checkCondition(nested(3), { maxDepth: 2 }).length, 1, 'a caller may lower the depth');
  assert.equal(checkCondition(nested(5), { maxDepth: 9 }).length, 1, 'but never raise it');
});

test('resolveNext: names, sentinels and functions pass through', () => {
  assert.equal(resolveNext(null, 'x', {}), null);
  assert.equal(resolveNext('', 'x', {}), null);
  assert.equal(resolveNext('contact', 'x', {}), 'contact');
  assert.equal(resolveNext('$review', 'x', {}), NEXT_REVIEW);
  assert.equal(resolveNext('$submit', 'x', {}), NEXT_SUBMIT);
  assert.equal(resolveNext((answer) => `after-${answer}`, 'x', {}), 'after-x');
  assert.equal(resolveNext(() => null, 'x', {}), null);
});

test('resolveNext: the first matching branch wins, and no match falls through', () => {
  const next = [
    { if: is('size', 'gte', 100), goto: 'enterprise' },
    { if: is('size', 'gte', 10), goto: 'team' },
    { goto: '$submit' }
  ];
  assert.equal(resolveNext(next, 500, { size: 500 }), 'enterprise');
  assert.equal(resolveNext(next, 50, { size: 50 }), 'team');
  assert.equal(resolveNext(next, 5, { size: 5 }), '$submit');
  assert.equal(resolveNext(next.slice(0, 2), 5, { size: 5 }), null);
  assert.throws(() => resolveNext([{ if: is('a', 'eq', 1) }], 1, {}), TypeError);
  assert.throws(() => resolveNext(/** @type {any} */ ({ goto: 'x' }), 1, {}), TypeError);
});

test('checkNext reports bad targets, conditions and unreachable branches', () => {
  assert.deepEqual(checkNext('contact', { targets: ['contact'] }), []);
  assert.deepEqual(checkNext('$review', { targets: [] }), []);
  assert.deepEqual(checkNext('$submit', { targets: [] }), []);
  assert.deepEqual(checkNext('nowhere', { targets: ['contact'] }).map((p) => p.path), ['']);
  assert.deepEqual(checkNext([]).map((p) => p.path), ['']);
  assert.deepEqual(checkNext([{ goto: 'a' }, { goto: 'b' }]).map((p) => p.path), ['/0']);
  assert.deepEqual(checkNext([{ if: is('x', 'eq', 1), goto: 'a', when: 1 }], { fields: ['y'] }).map((p) => p.path),
    ['/0/when', '/0/if/field']);
  assert.deepEqual(checkNext([{ if: is('x', 'eq', 1) }]).map((p) => p.path), ['/0/goto']);
});

test('checkRules: each rule fails with its default message', () => {
  /** @type {[any, unknown, string][]} */
  const cases = [
    [{ required: true }, '', RULE_MESSAGES.required],
    [{ required: true }, [], RULE_MESSAGES.required],
    [{ minLength: 3 }, 'ab', 'Enter at least 3 characters.'],
    [{ maxLength: 3 }, 'abcd', 'Enter at most 3 characters.'],
    [{ minLength: 2 }, ['a'], 'Choose at least 2.'],
    [{ maxLength: 1 }, ['a', 'b'], 'Choose at most 1.'],
    [{ minimum: 5 }, 4, 'Enter a number of at least 5.'],
    [{ minimum: 5 }, 'many', 'Enter a number of at least 5.'],
    [{ maximum: 5 }, '6', 'Enter a number of at most 5.'],
    [{ format: 'date' }, '2026-02-30', RULE_MESSAGES.date],
    [{ format: 'date-time' }, '2026-10-08 25:00', RULE_MESSAGES['date-time']],
    [{ format: 'time' }, '9:30', RULE_MESSAGES.time],
    [{ format: 'email' }, 'name@host', RULE_MESSAGES.email],
    [{ format: 'uri' }, 'example.com/path', RULE_MESSAGES.uri],
    [{ oneOf: ['a', 'b'] }, 'c', RULE_MESSAGES.oneOf],
    [{ oneOf: ['a', 'b'] }, ['a', 'c'], RULE_MESSAGES.oneOf]
  ];
  for (const [rule, value, expected] of cases) {
    assert.equal(checkRules([rule], value), expected, JSON.stringify([rule, value]));
  }
});

test('checkRules: each rule takes its own message instead', () => {
  for (const [rule, value] of /** @type {[any, unknown][]} */ ([
    [{ required: true }, null], [{ minLength: 3 }, 'ab'], [{ maxLength: 1 }, 'ab'], [{ minimum: 5 }, 1],
    [{ maximum: 5 }, 9], [{ format: 'email' }, 'x'], [{ oneOf: [1] }, 2]
  ])) {
    assert.equal(checkRules([{ ...rule, message: 'Custom.' }], value), 'Custom.', JSON.stringify(rule));
  }
});

test('checkRules: passing values, empty answers, order, and the message resolver', () => {
  assert.equal(checkRules([{ minLength: 3 }, { format: 'email' }], ''), null, 'an empty answer passes all but required');
  assert.equal(checkRules([{ required: false }], ''), null);
  assert.equal(checkRules([{ minLength: 2 }, { maxLength: 4 }], 'abc'), null);
  assert.equal(checkRules([{ minLength: 2 }], '日本'), null, 'characters, not code units');
  assert.equal(checkRules([{ minimum: 1 }, { maximum: 10 }], '7'), null);
  assert.equal(checkRules([{ format: 'date' }], '2024-02-29'), null);
  assert.equal(checkRules([{ format: 'date' }], new Date(2026, 9, 8)), null);
  assert.equal(checkRules([{ format: 'date-time' }], '2026-10-08T10:31:12Z'), null);
  assert.equal(checkRules([{ format: 'date-time' }], '2026-10-08T10:31+02:00'), null);
  assert.equal(checkRules([{ format: 'time' }], '23:59:59'), null);
  assert.equal(checkRules([{ format: 'email' }], 'name@example.com'), null);
  assert.equal(checkRules([{ format: 'uri' }], 'https://example.com/a?b=c'), null);
  assert.equal(checkRules([{ format: 'uri' }], 'mailto:name@example.com'), null);
  assert.equal(checkRules([{ oneOf: [1, 2] }], '2'), null);
  assert.equal(checkRules([{ minLength: 5, message: 'first' }, { maxLength: 1, message: 'second' }], 'abc'), 'first');
  assert.equal(checkRules([{ minLength: 3 }], 'ab', (key, ...args) => `${key}:${args.join(',')}`), 'minLength:3');
  assert.equal(ruleMessage('minimum', 4), 'Enter a number of at least 4.');
  assert.throws(() => checkRules([{ minLength: 1, maxLength: 2 }], 'x'), TypeError);
  assert.throws(() => checkRules([{ pattern: '.*' }], 'x'), TypeError);
});

test('checkRuleList reports malformed rules and refuses patterns', () => {
  assert.deepEqual(checkRuleList([{ required: true }, { minLength: 2, message: 'x' }, { format: 'uri' }, { oneOf: ['a'] }]), []);
  /** @type {[any, string[]][]} */
  const cases = [
    ['x', ['']],
    [[{ pattern: '^a' }], ['/0/pattern', '/0']],
    [[{ minLength: 1, maxLength: 2 }], ['/0']],
    [[{ minLength: -1 }], ['/0/minLength']],
    [[{ minLength: 1.5 }], ['/0/minLength']],
    [[{ minimum: 'a' }], ['/0/minimum']],
    [[{ format: 'phone' }], ['/0/format']],
    [[{ oneOf: [] }], ['/0/oneOf']],
    [[{ required: 'yes' }], ['/0/required']],
    [[{ required: true, message: 5 }], ['/0/message']]
  ];
  for (const [rules, paths] of cases) {
    assert.deepEqual(checkRuleList(rules).map((problem) => problem.path), paths, JSON.stringify(rules));
  }
});

/** The intake of the function-form tests, written declaratively. */
function intake() {
  return normalizeItems([
    { name: 'type', prompt: 'Who is buying?', required: true, choices: [
      { value: 'company', label: 'A company' },
      { value: 'private', label: 'A private buyer' }
    ] },
    { name: 'vat', prompt: 'VAT id', input: {}, when: is('type', 'eq', 'company') },
    { name: 'vatCountry', prompt: 'VAT country', input: {}, when: is('vat', 'filled') },
    { name: 'contact', prompt: 'How do we reach you?', input: {} }
  ]);
}

test('declarative conditions cascade: each sees only visible answers declared before it', () => {
  const items = intake();
  const open = resolveFlow(items, { type: 'company', vat: 'DE1', vatCountry: 'DE' });
  assert.deepEqual(open.visible.map((item) => item.name), ['type', 'vat', 'vatCountry', 'contact']);
  const closed = resolveFlow(items, { type: 'private', vat: 'DE1', vatCountry: 'DE' });
  assert.deepEqual(closed.visible.map((item) => item.name), ['type', 'contact'],
    'hiding vat also hides what depends on it, although its raw answer is kept');
  assert.deepEqual(closed.answers, { type: 'private' });
});

test('a declarative when may name only items declared before it', () => {
  assert.throws(() => normalizeItems([
    { name: 'a', prompt: 'A', input: {}, when: is('b', 'filled') },
    { name: 'b', prompt: 'B', input: {} }
  ]), /Item "a" when\/field/);
  assert.throws(() => normalizeItems([{ name: 'a', prompt: 'A', input: {}, when: is('a', 'filled') }]), TypeError,
    'not even itself');
  assert.throws(() => normalizeItems([{ name: 'a', prompt: 'A', input: {}, when: nested(5) }]), TypeError);
});

test('normalizeItems checks and copies declarative next and validate', () => {
  const next = [{ if: is('a', 'eq', 'x'), goto: 'c' }];
  const validate = [{ minLength: 2 }];
  const [item] = normalizeItems([{ name: 'a', prompt: 'A', input: {}, next, validate }]);
  assert.deepEqual(item.next, next);
  assert.notEqual(item.next, next);
  assert.deepEqual(item.validate, validate);
  assert.notEqual(item.validate, validate);
  assert.throws(() => normalizeItems([{ name: 'a', prompt: 'A', input: {}, next: [{ if: is('b', 'eq', 1), goto: 'c' }] }]),
    /Item "a" next\/0\/if\/field/);
  assert.throws(() => normalizeItems([{ name: 'a', prompt: 'A', input: {}, validate: [{ pattern: '^x' }] }]), TypeError);
  assert.throws(() => normalizeItems([{ name: '$review', prompt: 'A', input: {} }]), /reserved/);
});

test('the first matching branch picks the next item, and a hidden target walks on', () => {
  const items = normalizeItems([
    { name: 'size', prompt: 'Size', field: { type: 'number' }, next: [
      { if: is('size', 'gte', 100), goto: 'enterprise' },
      { if: is('size', 'gte', 10), goto: 'team' }
    ] },
    { name: 'solo', prompt: 'Solo', input: {} },
    { name: 'team', prompt: 'Team', input: {} },
    { name: 'enterprise', prompt: 'Enterprise', input: {}, when: is('size', 'lt', 1000) },
    { name: 'end', prompt: 'End', input: {} }
  ]);
  assert.equal(nextItem(items, items[0], { size: 500 }), 'enterprise');
  assert.equal(nextItem(items, items[0], { size: 50 }), 'team');
  assert.equal(nextItem(items, items[0], { size: 5 }), 'solo', 'no match falls through');
  assert.equal(nextItem(items, items[0], { size: 5000 }), 'end', 'a conditioned-out target walks forward');
});

test('$review and $submit come back from the walk and end the progress estimate', () => {
  const items = normalizeItems([
    { name: 'a', prompt: 'A', choices: [{ value: 'x', label: 'X' }, { value: 'y', label: 'Y' }],
      next: [{ if: is('a', 'eq', 'x'), goto: '$submit' }, { goto: '$review' }] },
    { name: 'b', prompt: 'B', input: {} }
  ]);
  assert.equal(nextItem(items, items[0], { a: 'x' }), NEXT_SUBMIT);
  assert.equal(nextItem(items, items[0], { a: 'y' }), NEXT_REVIEW);
  const progress = progressOf(items, { a: 'x' }, ['a']);
  assert.equal(progress.total, 1);
  assert.equal(progress.percent, 100);
});

test('function forms of when, next and validate keep working unchanged', () => {
  const when = (/** @type {any} */ answers) => answers.a === 'x';
  const next = () => 'c';
  const validate = () => null;
  const items = normalizeItems([
    { name: 'a', prompt: 'A', input: {}, next },
    { name: 'b', prompt: 'B', input: {}, when, validate },
    { name: 'c', prompt: 'C', input: {} }
  ]);
  assert.equal(items[0].next, next);
  assert.equal(items[1].when, when);
  assert.equal(items[1].validate, validate);
  assert.equal(nextItem(items, items[0], { a: 'x' }), 'c');
});

test('a Date answer meets a date or date-time value in that value\'s shape', () => {
  const midnight = new Date(2026, 0, 5, 0, 0, 0);
  const morning = new Date(2026, 0, 5, 8, 30);
  const withSeconds = new Date(2026, 0, 5, 8, 30, 15);
  assert.equal(holds(is('d', 'gte', '2026-01-05T00:00'), { d: midnight }), true, 'midnight keeps its time');
  assert.equal(holds(is('d', 'lt', '2026-01-05T00:01'), { d: midnight }), true);
  assert.equal(holds(is('d', 'eq', '2026-01-05T08:30'), { d: morning }), true, 'no :00 seconds are added');
  assert.equal(holds(is('d', 'eq', '2026-01-05T08:30:00'), { d: morning }), true, 'nor do they matter on the value');
  assert.equal(holds(is('d', 'eq', '2026-01-05 08:30'), { d: morning }), true);
  assert.equal(holds(is('d', 'eq', '2026-01-05T08:30'), { d: withSeconds }), false);
  assert.equal(holds(is('d', 'eq', '2026-01-05T08:30:15'), { d: withSeconds }), true);
  assert.equal(holds(is('d', 'eq', '2026-01-05'), { d: morning }), true, 'a date value compares the date part');
  assert.equal(holds(is('d', 'eq', '2026-01-05'), { d: midnight }), true);
  assert.equal(holds(is('d', 'lt', '2026-01-06'), { d: morning }), true);
  assert.equal(holds(is('d', 'gt', '2026-01-05'), { d: morning }), false);
  assert.equal(holds(is('d', 'in', ['2026-01-04', '2026-01-05']), { d: morning }), true);
  assert.equal(holds(is('d', 'eq', 5), { d: morning }), false);
  assert.equal(holds(is('d', 'empty'), { d: new Date(Number.NaN) }), true, 'an invalid Date is no answer');
});

test('the date and date-time formats accept a Date, midnight included', () => {
  const midnight = new Date(2026, 0, 5, 0, 0, 0);
  assert.equal(checkRules([{ format: 'date-time' }], midnight), null);
  assert.equal(checkRules([{ format: 'date' }], midnight), null);
  assert.equal(checkRules([{ format: 'date-time' }], new Date(2026, 0, 5, 8, 30)), null);
  assert.equal(checkRules([{ format: 'email' }], midnight), RULE_MESSAGES.email);
  assert.equal(checkRules([{ maxLength: 16 }], new Date(2026, 0, 5, 8, 30)), null, 'measured as YYYY-MM-DDTHH:MM');
});

test('a null condition value is refused in favour of empty and filled', () => {
  for (const condition of [is('a', 'eq', null), is('a', 'ne', null), is('a', 'in', ['x', null]), is('a', 'nin', [null])]) {
    const problems = checkCondition(condition);
    assert.equal(problems.length, 1, JSON.stringify(condition));
    assert.equal(problems[0].path, '/value');
    assert.match(problems[0].message, /"empty" or "filled"/);
  }
  assert.throws(() => normalizeItems([
    { name: 'a', prompt: 'A', input: {} },
    { name: 'b', prompt: 'B', input: {}, when: is('a', 'eq', null) }
  ]), /Item "b" when\/value/);
});

test('a declarative required rule marks the item required', () => {
  const [ruled, plain, optional] = normalizeItems([
    { name: 'a', prompt: 'A', input: {}, validate: [{ minLength: 2 }, { required: true }] },
    { name: 'b', prompt: 'B', input: {}, validate: [{ minLength: 2 }] },
    { name: 'c', prompt: 'C', input: {}, validate: [{ required: false }] }
  ]);
  assert.equal(ruled.required, true);
  assert.equal(plain.required, false);
  assert.equal(optional.required, false);
});

test('a validate or next of a type neither form takes throws', () => {
  /** @param {any} extra */
  const item = (extra) => normalizeItems([{ name: 'a', prompt: 'A', input: {}, ...extra }]);
  assert.throws(() => item({ validate: { required: true } }), /Item "a" validate/);
  assert.throws(() => item({ validate: 'required' }), TypeError);
  assert.throws(() => item({ next: { goto: 'x' } }), /Item "a" next/);
  assert.throws(() => item({ next: 3 }), TypeError);
  assert.equal(item({ validate: null, next: null })[0].validate, null);
  assert.equal(item({ validate: undefined, next: undefined })[0].next, null);
});
