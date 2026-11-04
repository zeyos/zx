import assert from 'node:assert/strict';
import test from 'node:test';

import { surfaceText, verdictText } from '../../src/components/surface/text.js';

const base = (intent, nodes, extra = {}) => ({
  zx: 'surface/1', surface: 's1', intent, title: 'The title', author: 'finance',
  root: nodes.map((node) => node.id), nodes, ...extra
});
const reply = (action, values = {}, extra = {}) => ({
  zx: 'reply/1', surface: 's1', action, key: `s1#${action}`, values, confirmation: null, at: '2026-10-08T10:31:12', ...extra
});

const PAYMENT = {
  id: 'form', type: 'fields',
  schema: {
    type: 'object', required: ['method'],
    properties: {
      method: { type: 'string', title: 'Payment', oneOf: [{ const: 'card', title: 'Card' }, { const: 'transfer', title: 'Bank transfer' }] },
      iban: { type: 'string', title: 'IBAN', 'x-zx': { visible: { field: 'method', op: 'eq', value: 'transfer' } } },
      size: { type: 'string', title: 'Size', enum: ['S', 'M'] },
      copy: { type: 'boolean', title: 'Send a copy' },
      tags: { type: 'array', title: 'Tags', items: { anyOf: [{ const: 'a', title: 'Alpha' }, { const: 'b', title: 'Beta' }] } }
    }
  }
};

test('show: title and the dismissal, no values', () => {
  const text = surfaceText(base('show', [{ id: 't', type: 'text', text: 'Hello' }]), reply('dismiss', { stray: 1 }));
  assert.equal(text, 'The title\nDismissed at 2026-10-08 10:31');
});

test('ask: labels with choice titles, booleans in words, never a hidden input', () => {
  const doc = base('ask', [PAYMENT]);
  const text = surfaceText(doc, reply('submit', { method: 'card', iban: 'DE89', size: 'M', copy: true, tags: ['b', 'a'] }));
  assert.equal(text, [
    'The title', 'Payment: Card', 'Size: M', 'Send a copy: Yes', 'Tags: Beta, Alpha', 'Submitted at 2026-10-08 10:31'
  ].join('\n'));
  assert.ok(!text.includes('IBAN') && !text.includes('DE89'));
  const shown = surfaceText(doc, reply('submit', { method: 'transfer', iban: 'DE89' }));
  assert.ok(shown.includes('Payment: Bank transfer') && shown.includes('IBAN: DE89'));
});

test('choose: the choice label, not its value', () => {
  const doc = base('choose', [{ id: 'c', type: 'choice', name: 'plan', label: 'Plan', choices: [{ value: 'p1', label: 'Basic' }, { value: 'p2', label: 'Professional' }] }]);
  assert.equal(surfaceText(doc, reply('submit', { plan: 'p2' })), 'The title\nPlan: Professional\nSubmitted at 2026-10-08 10:31');
});

test('confirm: the verdict only, with an action of the surface\'s own named', () => {
  const doc = base('confirm', [{ id: 't', type: 'text', text: 'Archive?' }], { actions: [{ id: 'archive', label: 'Archive 3' }] });
  assert.equal(surfaceText(doc, reply('archive')), 'The title\nChose “Archive 3” at 2026-10-08 10:31');
  assert.equal(surfaceText(doc, reply('cancel')), 'The title\nCancelled at 2026-10-08 10:31');
});

test('review: selected rows by row id, accepted changes, rejection without values', () => {
  const table = {
    id: 'list', type: 'table', name: 'invoices', label: 'Invoices', selectable: 'multi', rowId: 'invoice',
    columns: [{ id: 'invoice', label: 'Invoice' }], rows: [{ invoice: 'RE-1' }, { invoice: 'RE-2' }]
  };
  const doc = base('review', [table]);
  assert.equal(surfaceText(doc, reply('approve', { invoices: ['RE-2'] })), 'The title\nInvoices: RE-2\nApproved at 2026-10-08 10:31');
  assert.equal(surfaceText(doc, reply('reject', { invoices: ['RE-2'] })), 'The title\nRejected at 2026-10-08 10:31');
  const diff = base('review', [{ id: 'd', type: 'diff', name: 'changes', label: 'Changes', rows: [
    { id: 'r1', field: 'email', label: 'Email', before: 'a@x.test', after: 'b@x.test' },
    { id: 'r2', field: 'vip', label: 'VIP', before: false, after: true }
  ] }]);
  assert.equal(surfaceText(diff, reply('approve', { changes: ['r2'] })), 'The title\nChanges: VIP (No → Yes)\nApproved at 2026-10-08 10:31');
});

test('questionnaire: prompts with choice labels along the path', () => {
  const doc = base('questionnaire', [{ id: 'q', type: 'questionnaire', steps: [
    { name: 'kind', prompt: 'What happened?', choices: [{ value: 'late', label: 'Delivery was late' }, { value: 'broken', label: 'Item arrived broken' }] },
    { name: 'note', prompt: 'Anything else?', input: {} }
  ] }]);
  const text = surfaceText(doc, reply('submit', { answers: { kind: 'broken', note: 'Box crushed' }, path: ['kind', 'note'] }));
  assert.equal(text, 'The title\nWhat happened?: Item arrived broken\nAnything else?: Box crushed\nSubmitted at 2026-10-08 10:31');
});

test('a translated msg and a malformed document', () => {
  const msg = (key, ...args) => (key === 'surface.submitted' ? 'Gesendet' : key === 'surface.verdictAt' ? `${args[0]} um ${args[1]}` : key);
  assert.equal(surfaceText(base('show', []), reply('submit'), { msg }), 'The title\nGesendet um 2026-10-08 10:31');
  assert.equal(surfaceText(null, reply('dismiss')), 'Dismissed at 2026-10-08 10:31');
});

test('a closing verdict is the closing word, whatever the surface called an action', () => {
  const actions = [{ id: 'cancel', label: 'Payment approved' }, { id: 'dismiss', label: 'Payment approved' }, { id: 'go', label: 'Go' }];
  assert.equal(surfaceText(base('confirm', [], { actions }), reply('cancel')), 'The title\nCancelled at 2026-10-08 10:31');
  assert.equal(surfaceText(base('confirm', [], { actions }), reply('dismiss')), 'The title\nDismissed at 2026-10-08 10:31');
  assert.equal(surfaceText(base('confirm', [], { actions }), reply('go')), 'The title\nChose “Go” at 2026-10-08 10:31');
  assert.equal(verdictText('cancel', actions), 'Cancelled');
  const steps = [{ name: 'a', prompt: 'A?', choices: [{ value: 'x', label: 'X' }] }];
  const answered = reply('submit', { answers: { a: 'x' }, path: ['a'] });
  const text = surfaceText(base('questionnaire', [{ id: 'q', type: 'questionnaire', steps }], { actions: [{ id: 'submit', label: 'Declined' }] }), answered);
  assert.equal(text, 'The title\nA?: X\nSubmitted at 2026-10-08 10:31');
});
