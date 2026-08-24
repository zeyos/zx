import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applyExclusive, isEmptyAnswer, isVisible, normalizeChoices, normalizeItems, progressOf,
  resolveFlow, resolveNext, validateAnswer, visibleItems
} from '../../src/components/questionnaire/items.js';

/** @param {...any} items @returns {any[]} */
function flow(...items) {
  return normalizeItems(items);
}

/** A three-question intake where the two company questions hang off the first answer. */
function intake() {
  return flow(
    { name: 'type', prompt: 'Who is buying?', required: true, choices: [
      { value: 'company', label: 'A company' },
      { value: 'private', label: 'A private buyer' }
    ] },
    { name: 'vat', prompt: 'VAT id', input: {}, when: (a) => a.type === 'company' },
    { name: 'vatCountry', prompt: 'VAT country', input: {}, when: (a) => Boolean(a.vat) },
    { name: 'contact', prompt: 'How do we reach you?', input: {} }
  );
}

/** @param {string} key @returns {string} */
const message = (key) => key;

test('normalizeItems fills in every documented default', () => {
  const [item] = normalizeItems([{ name: 'q', prompt: 'Why?', choices: [{ value: 'a', label: 'A' }] }]);
  assert.deepEqual({ ...item, choices: undefined }, {
    name: 'q',
    prompt: 'Why?',
    description: null,
    section: '',
    required: false,
    multiple: false,
    skippable: false,
    choices: undefined,
    input: null,
    field: null,
    when: null,
    next: null,
    validate: null
  });
});

test('normalizeItems coerces types and never mutates its input', () => {
  const input = [{ name: 'q', prompt: 7, description: 12, required: 1, multiple: '', input: {} }];
  const [item] = normalizeItems(input);
  assert.equal(item.prompt, '7');
  assert.equal(item.description, '12');
  assert.equal(item.required, true);
  assert.equal(item.multiple, false);
  assert.deepEqual(input, [{ name: 'q', prompt: 7, description: 12, required: 1, multiple: '', input: {} }]);
  assert.notEqual(item, input[0]);
});

test('normalizeItems defaults the prompt to the name and keeps declaration order', () => {
  const items = flow({ name: 'c', input: {} }, { name: 'a', input: {} }, { name: 'b', input: {} });
  assert.deepEqual(items.map((item) => item.name), ['c', 'a', 'b']);
  assert.equal(items[0].prompt, 'c');
});

test('normalizeItems rejects malformed lists, items, and names', () => {
  assert.throws(() => normalizeItems(null), TypeError);
  assert.throws(() => normalizeItems({ 0: { name: 'a' } }), TypeError);
  assert.throws(() => normalizeItems([null]), TypeError);
  assert.throws(() => normalizeItems([['a']]), TypeError);
  assert.throws(() => normalizeItems([{ prompt: 'No name', input: {} }]), TypeError);
  assert.throws(() => normalizeItems([{ name: '  ', input: {} }]), TypeError);
  assert.throws(() => normalizeItems([{ name: 3, input: {} }]), TypeError);
});

test('normalizeItems rejects duplicate names', () => {
  assert.throws(
    () => flow({ name: 'a', input: {} }, { name: 'b', input: {} }, { name: 'a', input: {} }),
    /Item already exists: a/
  );
});

test('normalizeItems rejects an item with no way to answer it', () => {
  assert.throws(() => normalizeItems([{ name: 'q', prompt: 'Why?' }]), /needs choices, an input, or a field/);
  assert.doesNotThrow(() => normalizeItems([{ name: 'q', field: { type: 'date' } }]));
});

test('normalizeChoices hands out digits before letters', () => {
  const choices = normalizeChoices(Array.from({ length: 11 }, (_, index) => ({ value: `v${index}` })));
  assert.deepEqual(choices.map((choice) => choice.key),
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b']);
});

test('normalizeChoices reserves explicit keys before assigning any', () => {
  const choices = normalizeChoices([{ value: 'a' }, { value: 'b', key: '1' }, { value: 'c' }]);
  // Without the reservation pass the first choice would also claim "1" and collide.
  assert.deepEqual(choices.map((choice) => choice.key), ['2', '1', '3']);
});

test('normalizeChoices lowercases an explicit key and keeps one character', () => {
  const [choice] = normalizeChoices([{ value: 'a', key: 'XY' }]);
  assert.equal(choice.key, 'x');
});

test('normalizeChoices leaves the surplus without a shortcut rather than colliding', () => {
  const choices = normalizeChoices(Array.from({ length: 40 }, (_, index) => ({ value: index + 1 })));
  const keys = choices.map((choice) => choice.key).filter(Boolean);
  assert.equal(keys.length, 35);
  assert.equal(new Set(keys).size, 35);
  assert.equal(choices[39].key, '');
});

test('normalizeChoices defaults the label to the value and rejects duplicates', () => {
  assert.equal(normalizeChoices([{ value: 'yes' }])[0].label, 'yes');
  assert.throws(() => normalizeChoices([{ value: 'a' }, { value: 'a' }], 'q'),
    /Choice already exists in "q": a/);
  assert.throws(() => normalizeChoices([{ label: 'No value' }], 'q'), /needs a value/);
  assert.throws(() => normalizeChoices('nope'), TypeError);
});

test('normalizeChoices keeps a numeric value numeric', () => {
  const [choice] = normalizeChoices([{ value: 5, label: 'Five' }]);
  assert.equal(choice.value, 5);
  assert.equal(typeof choice.value, 'number');
});

test('isVisible treats a missing and a throwing predicate as visible', () => {
  const [plain, broken] = flow(
    { name: 'a', input: {} },
    { name: 'b', input: {}, when: () => { throw new Error('boom'); } }
  );
  assert.equal(isVisible(plain, {}), true);
  // A broken condition must not strand the reader on a question they can never reach.
  assert.equal(isVisible(broken, {}), true);
});

test('resolveFlow hides conditioned-out items and their answers', () => {
  const items = intake();
  const { answers, visible } = resolveFlow(items, { type: 'private', contact: 'mail@example.com' });
  assert.deepEqual(visible.map((item) => item.name), ['type', 'contact']);
  assert.deepEqual(answers, { type: 'private', contact: 'mail@example.com' });
});

test('resolveFlow cascades: hiding a question hides what depended on its answer', () => {
  const items = intake();
  // The buyer answered the VAT questions as a company, then went back and became a private buyer.
  const raw = { type: 'private', vat: 'DE123', vatCountry: 'DE', contact: 'mail@example.com' };
  const { answers, visible } = resolveFlow(items, raw);
  assert.deepEqual(visible.map((item) => item.name), ['type', 'contact']);
  // vatCountry's own predicate still passes against the raw store — it must not.
  assert.deepEqual(Object.keys(answers), ['type', 'contact']);
});

test('resolveFlow keeps a branch alive while its condition holds', () => {
  const items = intake();
  const raw = { type: 'company', vat: 'DE123', contact: 'mail@example.com' };
  assert.deepEqual(visibleItems(items, raw).map((item) => item.name),
    ['type', 'vat', 'vatCountry', 'contact']);
});

test('resolveFlow answers stay in declaration order regardless of the raw key order', () => {
  const items = intake();
  const raw = { contact: 'c', type: 'company', vat: 'v' };
  const { answers, visible } = resolveFlow(items, raw);
  // vatCountry is visible — its condition passes — but unanswered, so it is not an answer.
  assert.deepEqual(visible.map((item) => item.name), ['type', 'vat', 'vatCountry', 'contact']);
  assert.deepEqual(Object.keys(answers), ['type', 'vat', 'contact']);
});

test('resolveNext falls through to the next visible item', () => {
  const items = intake();
  assert.equal(resolveNext(items, items[0], { type: 'company' }), 'vat');
  // With no VAT id, vatCountry is out and the walk continues past it.
  assert.equal(resolveNext(items, items[1], { type: 'company' }), 'contact');
  assert.equal(resolveNext(items, items[3], { type: 'private' }), null);
});

test('resolveNext honours a static branch target', () => {
  const items = flow(
    { name: 'a', input: {}, next: 'c' },
    { name: 'b', input: {} },
    { name: 'c', input: {} }
  );
  assert.equal(resolveNext(items, items[0], {}), 'c');
});

test('resolveNext honours a function branch target and its answer argument', () => {
  const seen = [];
  const items = flow(
    { name: 'a', choices: [{ value: 'yes' }, { value: 'no' }], next: (answer, answers) => {
      seen.push([answer, { ...answers }]);
      return answer === 'yes' ? 'c' : null;
    } },
    { name: 'b', input: {} },
    { name: 'c', input: {} }
  );
  assert.equal(resolveNext(items, items[0], { a: 'yes' }), 'c');
  assert.equal(resolveNext(items, items[0], { a: 'no' }), 'b');
  assert.deepEqual(seen[0], ['yes', { a: 'yes' }]);
});

test('resolveNext treats an empty function result as a fall-through', () => {
  const items = flow({ name: 'a', input: {}, next: () => '' }, { name: 'b', input: {} });
  assert.equal(resolveNext(items, items[0], {}), 'b');
});

test('resolveNext walks past a branch target that is conditioned out', () => {
  const items = flow(
    { name: 'a', input: {}, next: 'b' },
    { name: 'b', input: {}, when: () => false },
    { name: 'c', input: {} }
  );
  // Jumping onto an invisible question would strand the reader, so the walk continues from it.
  assert.equal(resolveNext(items, items[0], {}), 'c');
});

test('resolveNext rejects a branch target that does not exist', () => {
  const items = flow({ name: 'a', input: {}, next: 'nowhere' }, { name: 'b', input: {} });
  assert.throws(() => resolveNext(items, items[0], {}), /Unknown questionnaire item: nowhere/);
});

test('isEmptyAnswer counts blanks as absent and false and zero as answers', () => {
  for (const value of [null, undefined, '', '   ', [], ['', '  '], [null]]) {
    assert.equal(isEmptyAnswer(value), true, `${JSON.stringify(value)} should be empty`);
  }
  for (const value of [false, 0, 'a', ['a'], ['', 'a'], {}]) {
    assert.equal(isEmptyAnswer(value), false, `${JSON.stringify(value)} should be an answer`);
  }
});

test('validateAnswer only complains about a required question left blank', () => {
  const [choice, free] = flow(
    { name: 'a', required: true, choices: [{ value: 'x' }] },
    { name: 'b', required: true, input: {} }
  );
  assert.equal(validateAnswer(choice, null, message), 'questionnaire.required');
  assert.equal(validateAnswer(free, '  ', message), 'questionnaire.requiredInput');
  assert.equal(validateAnswer(choice, 'x', message), null);
  assert.equal(validateAnswer(free, 'typed', message), null);
});

test('validateAnswer passes an optional question whatever it holds', () => {
  const [optional] = flow({ name: 'a', choices: [{ value: 'x' }] });
  assert.equal(validateAnswer(optional, null, message), null);
});

test('validateAnswer accepts false and zero as answers to a required question', () => {
  const [item] = flow({ name: 'a', required: true, choices: [{ value: 0, label: 'Zero' }] });
  assert.equal(validateAnswer(item, 0, message), null);
});

test('applyExclusive clears the rest when an exclusive choice is picked', () => {
  const choices = normalizeChoices([
    { value: 'a' }, { value: 'b' }, { value: 'none', exclusive: true }
  ]);
  assert.deepEqual(applyExclusive(choices, ['a', 'b', 'none'], 'none'), ['none']);
});

test('applyExclusive clears the exclusive one when something else is picked', () => {
  const choices = normalizeChoices([
    { value: 'a' }, { value: 'b' }, { value: 'none', exclusive: true }
  ]);
  assert.deepEqual(applyExclusive(choices, ['none', 'b'], 'b'), ['b']);
});

test('applyExclusive returns choice order, not click order', () => {
  const choices = normalizeChoices([{ value: 'a' }, { value: 'b' }, { value: 'c' }]);
  assert.deepEqual(applyExclusive(choices, ['c', 'a'], 'a'), ['a', 'c']);
});

test('applyExclusive leaves a selection alone when nothing was just switched on', () => {
  const choices = normalizeChoices([{ value: 'a' }, { value: 'none', exclusive: true }]);
  assert.deepEqual(applyExclusive(choices, ['a', 'none'], null), ['a', 'none']);
  // Switching a choice *off* is not a toggle-on, so nothing else is cleared either.
  assert.deepEqual(applyExclusive(choices, ['a'], 'none'), ['a']);
});

test('progressOf counts the path walked, not the array index', () => {
  const items = intake();
  const raw = { type: 'private' };
  assert.deepEqual(progressOf(items, raw, ['type']), {
    index: 0, answered: 1, total: 2, percent: 50, section: ''
  });
  // Two questions dropped out of the flow, so "1 of 4" would have been a lie.
  assert.deepEqual(progressOf(items, raw, ['type', 'contact']), {
    index: 1, answered: 1, total: 2, percent: 50, section: ''
  });
});

test('progressOf grows the total as a branch opens up', () => {
  const items = intake();
  assert.equal(progressOf(items, { type: 'company' }, ['type']).total, 3);
  assert.equal(progressOf(items, { type: 'company', vat: 'DE1' }, ['type', 'vat']).total, 4);
});

test('progressOf ignores path entries that are no longer visible', () => {
  const items = intake();
  const walked = ['type', 'vat', 'vatCountry'];
  const progress = progressOf(items, { type: 'private' }, walked);
  assert.equal(progress.index, 0);
  assert.equal(progress.total, 2);
});

test('progressOf reports the active section and copes with an empty flow', () => {
  const items = flow({ name: 'a', section: 'Company', input: {} });
  assert.equal(progressOf(items, { a: 'x' }, ['a']).section, 'Company');
  assert.deepEqual(progressOf([], {}, []), {
    index: 0, answered: 0, total: 0, percent: 0, section: ''
  });
});
