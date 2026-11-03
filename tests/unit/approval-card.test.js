import assert from 'node:assert/strict';
import test from 'node:test';
import {
  APPROVAL_STATES,
  answerVerdict,
  answeredTimeFormat,
  approvalKeyAction,
  approvalVerdict,
  changedKeys,
  displayValue,
  editedEntries,
  editedState,
  formatAnsweredAt,
  isEmptyValue,
  mergeEditedKeys,
  normalizeApprovalStatus,
  normalizeEditedKeys,
  normalizeReasonMode,
  sameValue,
  toDate
} from '../../src/components/approval-card/approval-card.js';
import { STATUS } from '../../src/internal/agent-model.js';

test('every request status is drawn through a run state with a glyph and a tone', () => {
  assert.deepEqual(Object.keys(APPROVAL_STATES), ['pending', 'approved', 'rejected', 'expired']);
  assert.equal(APPROVAL_STATES.pending, 'waiting');
  assert.equal(APPROVAL_STATES.approved, 'done');
  assert.equal(APPROVAL_STATES.rejected, 'skipped');
  assert.equal(APPROVAL_STATES.expired, 'stopped');
  for (const state of Object.values(APPROVAL_STATES)) {
    assert.ok(STATUS[state]?.status, `${state} has a glyph`);
    assert.ok(STATUS[state]?.tone, `${state} has a tone`);
  }
  assert.ok(Object.isFrozen(APPROVAL_STATES));
});

test('normalizeApprovalStatus reads known statuses and falls back to pending', () => {
  for (const status of ['pending', 'approved', 'rejected', 'expired']) assert.equal(normalizeApprovalStatus(status), status);
  assert.equal(normalizeApprovalStatus('done'), 'pending');
  assert.equal(normalizeApprovalStatus('toString'), 'pending');
  assert.equal(normalizeApprovalStatus(undefined), 'pending');
  assert.equal(normalizeApprovalStatus(3), 'pending');
});

test('normalizeReasonMode reads required and none, and is optional otherwise', () => {
  assert.equal(normalizeReasonMode('required'), 'required');
  assert.equal(normalizeReasonMode('none'), 'none');
  assert.equal(normalizeReasonMode('optional'), 'optional');
  assert.equal(normalizeReasonMode('always'), 'optional');
  assert.equal(normalizeReasonMode(null), 'optional');
});

test('A, E, and R act on a pending request, in either case', () => {
  const pending = { status: /** @type {const} */ ('pending'), canEdit: true };
  assert.equal(approvalKeyAction({ key: 'a' }, pending), 'approve');
  assert.equal(approvalKeyAction({ key: 'A' }, pending), 'approve');
  assert.equal(approvalKeyAction({ key: 'e' }, pending), 'edit');
  assert.equal(approvalKeyAction({ key: 'r' }, pending), 'reject');
  assert.equal(approvalKeyAction({ key: 'x' }, pending), null);
  assert.equal(approvalKeyAction({ key: 'Enter' }, pending), null);
  assert.equal(approvalKeyAction({ key: 'ArrowRight' }, pending), null);
});

test('no key acts on an answered request', () => {
  for (const status of /** @type {const} */ (['approved', 'rejected', 'expired'])) {
    for (const key of ['a', 'e', 'r']) assert.equal(approvalKeyAction({ key }, { status, canEdit: true }), null, `${key} on ${status}`);
  }
});

test('E acts only when the request has an Edit form', () => {
  assert.equal(approvalKeyAction({ key: 'e' }, { status: 'pending', canEdit: false }), null);
  assert.equal(approvalKeyAction({ key: 'a' }, { status: 'pending', canEdit: false }), 'approve');
});

test('keys never act from a text control, with a modifier, while composing, or on repeat', () => {
  const pending = { status: /** @type {const} */ ('pending'), canEdit: true };
  assert.equal(approvalKeyAction({ key: 'a' }, { ...pending, editable: true }), null);
  for (const modifier of ['altKey', 'ctrlKey', 'metaKey', 'shiftKey']) {
    assert.equal(approvalKeyAction({ key: 'a', [modifier]: true }, pending), null, modifier);
  }
  assert.equal(approvalKeyAction({ key: 'a', isComposing: true }, pending), null);
  assert.equal(approvalKeyAction({ key: 'a', repeat: true }, pending), null);
  assert.equal(approvalKeyAction({ key: 'a', defaultPrevented: true }, pending), null);
  assert.equal(approvalKeyAction(null, pending), null);
});

test('the verdict says who answered and when, or that the run is paused', () => {
  assert.deepEqual(approvalVerdict('pending'), { key: 'approvalCard.paused', args: [] });
  assert.deepEqual(approvalVerdict('approved', { by: 'you', time: '10:31' }), { key: 'approvalCard.approvedBy', args: ['you', '10:31'] });
  assert.deepEqual(approvalVerdict('rejected', { by: 'Ada', time: '9:05' }), { key: 'approvalCard.rejectedBy', args: ['Ada', '9:05'] });
  assert.deepEqual(approvalVerdict('expired', { time: '18:00' }), { key: 'approvalCard.expiredAt', args: ['18:00'] });
  assert.deepEqual(approvalVerdict('approved', { by: 'you' }), { key: 'approvalCard.approvedByUndated', args: ['you'] });
  assert.deepEqual(approvalVerdict('rejected'), { key: 'approvalCard.rejectedByUndated', args: ['you'] });
  assert.deepEqual(approvalVerdict('expired'), { key: 'approvalCard.expiredUndated', args: [] });
  assert.deepEqual(approvalVerdict('unknown'), { key: 'approvalCard.paused', args: [] });
});

test('answer times read as a clock today, with the day this year, and in full before that', () => {
  const now = new Date(2026, 10, 3, 16, 0);
  assert.equal(answeredTimeFormat(new Date(2026, 10, 3, 10, 31), now), '%H:%M');
  assert.equal(answeredTimeFormat(new Date(2026, 10, 2, 10, 31), now), '%e %b, %H:%M');
  assert.equal(answeredTimeFormat(new Date(2026, 9, 3, 10, 31), now), '%e %b, %H:%M');
  assert.equal(answeredTimeFormat(new Date(2025, 10, 3, 10, 31), now), '%e %b %Y, %H:%M');
  assert.equal(formatAnsweredAt(new Date(2026, 10, 3, 10, 31), now), '10:31');
  assert.equal(formatAnsweredAt(new Date(2026, 10, 3, 9, 5), now), '09:05');
});

test('toDate reads dates, local ISO date-times, and epoch milliseconds', () => {
  const local = toDate('2026-11-03T10:31');
  assert.ok(local instanceof Date);
  assert.equal(local.getHours(), 10);
  assert.equal(local.getMinutes(), 31);
  const original = new Date(2026, 0, 1);
  const copy = toDate(original);
  assert.notEqual(copy, original);
  assert.equal(copy?.getTime(), original.getTime());
  assert.equal(toDate(0)?.getTime(), 0);
  assert.equal(toDate('not a date'), null);
  assert.equal(toDate(''), null);
  assert.equal(toDate(null), null);
  assert.equal(toDate({}), null);
});

test('isEmptyValue treats nothing, blank text, and empty lists as not given', () => {
  for (const value of [null, undefined, '', '   ', []]) assert.equal(isEmptyValue(value), true);
  for (const value of ['x', 0, false, ['a'], {}]) assert.equal(isEmptyValue(value), false);
});

test('changedKeys lists the fields an edit changed, in field order', () => {
  const fields = { subject: {}, body: {}, cc: {} };
  const before = { subject: 'Reminder', body: 'Hello', cc: '' };
  assert.deepEqual(changedKeys(fields, before, { ...before }), []);
  assert.deepEqual(changedKeys(fields, before, { ...before, body: 'Hi', subject: 'Overdue' }), ['subject', 'body']);
  // Absent, null, and empty text are the same "nothing".
  assert.deepEqual(changedKeys(fields, { subject: 'Reminder', body: 'Hello' }, { ...before, cc: null }), []);
  assert.deepEqual(changedKeys(fields, before, { ...before, cc: ['ada@example.com'] }), ['cc']);
  assert.deepEqual(changedKeys(null, before, {}), []);
});

test('displayValue writes values as text, with option labels for choices', () => {
  assert.equal(displayValue('Overdue invoice'), 'Overdue invoice');
  assert.equal(displayValue(12), '12');
  assert.equal(displayValue(''), '');
  assert.equal(displayValue(null), '');
  assert.equal(displayValue(['a', '', 'b']), 'a, b');
  assert.equal(displayValue('high', { options: { low: 'Low', high: 'High' } }), 'High');
  assert.equal(displayValue(['low', 'high'], { options: { low: 'Low', high: 'High' } }), 'Low, High');
  assert.equal(displayValue('other', { options: ['other'] }), 'other');
  assert.equal(displayValue({ id: 1 }), '{"id":1}');
  assert.equal(displayValue('<b>not markup</b>'), '<b>not markup</b>');
});

test('editedEntries lists the changed fields, or every field when the change is unknown', () => {
  const fields = { subject: { label: 'Subject' }, body: { label: 'Message' }, tone: { options: { firm: 'Firm' } } };
  const values = { subject: 'Overdue', body: 'Please pay.', tone: 'firm' };
  assert.deepEqual(editedEntries(fields, values, new Set(['body'])), [{ key: 'body', label: 'Message', text: 'Please pay.' }]);
  assert.deepEqual(editedEntries(fields, values, null).map((entry) => [entry.label, entry.text]),
    [['Subject', 'Overdue'], ['Message', 'Please pay.'], ['tone', 'Firm']]);
  assert.deepEqual(editedEntries(fields, values, new Set()), []);
  assert.deepEqual(editedEntries(null, { amount: 40 }, null), [{ key: 'amount', label: 'amount', text: '40' }]);
});

test('editedEntries takes the edited keys as a list too, and lists them in field order', () => {
  const fields = { subject: { label: 'Subject' }, body: { label: 'Message' }, cc: { label: 'Copy to' } };
  const values = { subject: 'Overdue', body: 'Please pay.', cc: '' };
  assert.deepEqual(editedEntries(fields, values, ['cc', 'subject']).map((entry) => [entry.key, entry.text]),
    [['subject', 'Overdue'], ['cc', '']]);
  // A name no field has is not listed.
  assert.deepEqual(editedEntries(fields, values, ['amount']), []);
  assert.deepEqual(editedEntries(null, { amount: 40, note: 'x' }, ['note']), [{ key: 'note', label: 'note', text: 'x' }]);
});

test('normalizeEditedKeys keeps distinct non-empty names, and is null for anything but a list', () => {
  assert.deepEqual(normalizeEditedKeys(['subject', 'body', 'subject', '', 3, null]), ['subject', 'body']);
  assert.deepEqual(normalizeEditedKeys([]), []);
  assert.equal(normalizeEditedKeys(null), null);
  assert.equal(normalizeEditedKeys(undefined), null);
  assert.equal(normalizeEditedKeys('subject'), null);
});

test('editedState: edited alone lists every field, editedKeys narrows it and implies edited', () => {
  assert.deepEqual(editedState(false, null), { edited: false, keys: [] });
  assert.deepEqual(editedState(undefined, undefined), { edited: false, keys: [] });
  // Today's behaviour: edited with no list lists every field.
  assert.deepEqual(editedState(true, null), { edited: true, keys: null });
  assert.deepEqual(editedState(true, ['subject']), { edited: true, keys: ['subject'] });
  // A non-empty list marks the request edited on its own.
  assert.deepEqual(editedState(false, ['subject', 'subject']), { edited: true, keys: ['subject'] });
  // Edited, with nothing named: the label alone.
  assert.deepEqual(editedState(true, []), { edited: true, keys: [] });
  assert.deepEqual(editedState(false, []), { edited: false, keys: [] });
});

test('mergeEditedKeys keeps the union of edits so far, in field order', () => {
  const fields = { subject: {}, body: {}, cc: {} };
  assert.deepEqual(mergeEditedKeys([], ['body'], fields), ['body']);
  assert.deepEqual(mergeEditedKeys(['body'], ['subject'], fields), ['subject', 'body']);
  // A field edited back is still a field that was edited.
  assert.deepEqual(mergeEditedKeys(['subject', 'body'], [], fields), ['subject', 'body']);
  assert.deepEqual(mergeEditedKeys(['cc'], ['cc', 'subject'], fields), ['subject', 'cc']);
  // Names no field has kept go last, in the order given.
  assert.deepEqual(mergeEditedKeys(['legacy'], ['body'], fields), ['body', 'legacy']);
  assert.deepEqual(mergeEditedKeys(undefined, ['body'], null), ['body']);
  // Every field stays every field.
  assert.equal(mergeEditedKeys(null, ['body'], fields), null);
});

test('the verdict writes the answer time against the now it is given', () => {
  const now = new Date(2026, 10, 3, 16, 0);
  assert.deepEqual(answerVerdict('approved', { by: 'Ada', at: '2026-11-03T10:31', now }),
    { key: 'approvalCard.approvedBy', args: ['Ada', '10:31'] });
  assert.deepEqual(answerVerdict('approved', { by: 'Ada', at: '2026-11-02T10:31', now }),
    { key: 'approvalCard.approvedBy', args: ['Ada', '2 Nov, 10:31'] });
  assert.deepEqual(answerVerdict('rejected', { at: new Date(2025, 10, 3, 9, 5), now }),
    { key: 'approvalCard.rejectedBy', args: ['you', '3 Nov 2025, 09:05'] });
  assert.deepEqual(answerVerdict('expired', { at: '2026-11-03T08:00', now }), { key: 'approvalCard.expiredAt', args: ['08:00'] });
  // The same answer read a day later carries its date.
  assert.deepEqual(answerVerdict('expired', { at: '2026-11-03T08:00', now: new Date(2026, 10, 4, 9, 0) }),
    { key: 'approvalCard.expiredAt', args: ['3 Nov, 08:00'] });
  // No time, no time in the line; pending is the pause note whatever the clock says.
  assert.deepEqual(answerVerdict('approved', { by: 'Ada', at: null, now }), { key: 'approvalCard.approvedByUndated', args: ['Ada'] });
  assert.deepEqual(answerVerdict('pending', { at: '2026-11-03T08:00', now }), { key: 'approvalCard.paused', args: [] });
});

test('sameValue compares plain data by content and anything else by identity', () => {
  assert.equal(sameValue('a', 'a'), true);
  assert.equal(sameValue(null, undefined), false);
  assert.equal(sameValue(Number.NaN, Number.NaN), true);
  assert.equal(sameValue([{ type: 'p', text: 'Hi' }], [{ type: 'p', text: 'Hi' }]), true);
  assert.equal(sameValue([{ type: 'p', text: 'Hi' }], [{ type: 'p', text: 'Hello' }]), false);
  assert.equal(sameValue({ a: 1, b: [1, 2] }, { b: [1, 2], a: 1 }), true);
  assert.equal(sameValue({ a: 1 }, { a: 1, b: undefined }), false);
  assert.equal(sameValue([1, 2], { 0: 1, 1: 2 }), false);
  assert.equal(sameValue(new Date(2026, 0, 1), new Date(2026, 0, 1)), true);
  assert.equal(sameValue(new Date(2026, 0, 1), new Date(2026, 0, 2)), false);
  const validate = () => true;
  assert.equal(sameValue({ subject: { validate } }, { subject: { validate } }), true);
  assert.equal(sameValue({ subject: { validate } }, { subject: { validate: () => true } }), false);
  class Thing {}
  assert.equal(sameValue(new Thing(), new Thing()), false);
});
