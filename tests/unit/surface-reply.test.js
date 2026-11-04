import assert from 'node:assert/strict';
import test from 'node:test';

import { createReply, surfaceVisibility } from '../../src/components/surface/text.js';

const AT = new Date(2026, 9, 8, 10, 31, 12);
const doc = (intent, nodes) => ({
  zx: 'surface/1', surface: 's1', intent, title: 'T', author: 'a', root: nodes.map((node) => node.id), nodes
});
const FIELDS = {
  id: 'form', type: 'fields',
  schema: { type: 'object', properties: {
    method: { type: 'string', title: 'Payment', enum: ['card', 'transfer'] },
    iban: { type: 'string', title: 'IBAN', 'x-zx': { visible: { field: 'method', op: 'eq', value: 'transfer' } } }
  } }
};
const TABLE = { id: 'list', type: 'table', name: 'rows', selectable: 'multi', rowId: 'id', columns: [{ id: 'id', label: 'Id' }], rows: [{ id: 'r1' }] };

test('the reply shape', () => {
  const reply = createReply(doc('ask', [FIELDS]), { action: 'submit', values: { method: 'card' }, confirmation: 'clicked', at: AT });
  assert.deepEqual(reply, {
    zx: 'reply/1', surface: 's1', action: 'submit', key: 's1#submit', values: { method: 'card' },
    confirmation: 'clicked', at: '2026-10-08T10:31:12'
  });
});

test('values per intent', () => {
  const values = { method: 'transfer', iban: 'DE89', rows: ['r1'] };
  assert.deepEqual(createReply(doc('show', [FIELDS]), { action: 'ok', values, at: AT }).values, {});
  assert.deepEqual(createReply(doc('confirm', []), { action: 'confirm', values, at: AT }).values, {});
  assert.deepEqual(createReply(doc('ask', [FIELDS]), { action: 'submit', values, at: AT }).values, { method: 'transfer', iban: 'DE89' });
  const choice = { id: 'c', type: 'choice', name: 'plan', label: 'Plan', choices: [{ value: 'a', label: 'A' }] };
  assert.deepEqual(createReply(doc('choose', [choice]), { action: 'submit', values: { plan: 'a', other: 1 }, at: AT }).values, { plan: 'a' });
  assert.deepEqual(createReply(doc('review', [TABLE, FIELDS]), { action: 'approve', values, at: AT }).values, values);
  assert.deepEqual(createReply(doc('review', [TABLE]), { action: 'reject', values, at: AT }).values, {});
  const questionnaire = createReply(doc('questionnaire', [{ id: 'q', type: 'questionnaire', steps: [] }]), {
    action: 'submit', values: { answers: { a: 'x' }, path: ['a'] }, at: AT
  });
  assert.deepEqual(questionnaire.values, { answers: { a: 'x' }, path: ['a'] });
});

test('a hidden input never leaves, and closing replies carry nothing', () => {
  const reply = createReply(doc('ask', [FIELDS]), { action: 'submit', values: { method: 'card', iban: 'DE89' }, at: AT });
  assert.deepEqual(reply.values, { method: 'card' });
  const closed = createReply(doc('ask', [FIELDS]), { action: 'cancel', values: { method: 'card' }, confirmation: 'typed', reason: 'escape', at: AT });
  assert.deepEqual(closed.values, {});
  assert.equal(closed.confirmation, null);
  assert.equal(closed.reason, 'escape');
});

test('token and removed actions only when given', () => {
  const plain = createReply(doc('confirm', []), { action: 'confirm', at: AT });
  assert.ok(!('token' in plain) && !('removed' in plain) && !('reason' in plain));
  const full = createReply(doc('confirm', []), { action: 'confirm', token: 'opaque', removed: ['send'], at: AT });
  assert.equal(full.token, 'opaque');
  assert.deepEqual(full.removed, ['send']);
});

test('idempotency: the same answer has the same key', () => {
  const first = createReply(doc('ask', [FIELDS]), { action: 'submit', values: { method: 'card' }, at: AT });
  const second = createReply(doc('ask', [FIELDS]), { action: 'submit', values: { method: 'transfer' }, at: new Date() });
  assert.equal(first.key, second.key);
  assert.notEqual(first.key, createReply(doc('ask', [FIELDS]), { action: 'cancel', at: AT }).key);
});

test('visibility cascades, and a condition on an input not yet arrived leaves its node visible', () => {
  const nodes = [
    FIELDS,
    { id: 'note', type: 'text', text: 'IBAN help', visible: { field: 'iban', op: 'filled' } },
    { id: 'early', type: 'text', text: 'x', visible: { field: 'later', op: 'eq', value: 'y' } }
  ];
  const hidden = surfaceVisibility(doc('ask', nodes), { method: 'card', iban: 'DE89' });
  assert.ok(hidden.hiddenFields.get('form').has('iban'));
  assert.ok(hidden.hiddenNodes.has('note'), 'a node depending on a hidden input hides with it');
  assert.ok(!hidden.hiddenNodes.has('early'));
  assert.deepEqual(hidden.names, ['method']);
});
