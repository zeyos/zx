import assert from 'node:assert/strict';
import test from 'node:test';

import {
  RunTrace, STEP_ICONS, elapsedSince, groupRetries, prettyArguments, rowKind, stepIcon, stepMeta, traceLabel, truncateText
} from '../../src/components/run-trace/run-trace.js';
import { iconNames } from '../../src/core/icons.js';

/** A finished run: a search, a failed query and its retry, a hand-off, and some thinking. */
function finishedRun() {
  return [
    { id: 's1', kind: 'search', label: 'Searched customer notes', ms: 1_200, sources: 9 },
    { id: 's2', kind: 'query', label: 'Queried open invoices', status: 'failed', ms: 800, error: 'Timed out' },
    { id: 's3', kind: 'query', label: 'Queried open invoices', retryOf: 's2', ms: 900, result: '[]' },
    { id: 's4', kind: 'handoff', label: 'Handed over the dunning run', actor: 'finance', to: 'collections' },
    { id: 's5', kind: 'think', label: 'Planned the reminders', ms: 39_100 }
  ];
}

/* ------------------------------------------------------------------ summary line -- */

test('a finished trace reads "Worked for …" with each non-zero count', () => {
  assert.deepEqual(traceLabel(finishedRun()), {
    state: 'done',
    label: 'Worked for 42 s · 3 tool calls · 9 sources · 1 retry',
    doing: null
  });
});

test('counts are singular at one and left out at zero', () => {
  const { label } = traceLabel([{ id: 'a', kind: 'read', label: 'Read the policy', ms: 4_000 }]);
  assert.equal(label, 'Worked for 4.0 s · 1 tool call');
});

test('a running step makes the summary "Working…" and names what it is doing', () => {
  const steps = [...finishedRun(), { id: 's6', kind: 'write', label: 'Drafted', status: 'running', doing: 'Drafting the reminder…' }];
  assert.deepEqual(traceLabel(steps), { state: 'running', label: 'Working…', doing: 'Drafting the reminder' });
});

test('a waiting, stopped, or failed run says so before its counts', () => {
  assert.equal(traceLabel([{ id: 'a', label: 'Send the reminders', status: 'waiting' }]).label, 'Waiting for you');
  assert.equal(traceLabel([{ id: 'a', label: 'Send', status: 'waiting' }]).doing, 'Send');
  const stopped = traceLabel([{ id: 'a', kind: 'query', label: 'Queried', ms: 12_000 }, { id: 'b', label: 'Sent', status: 'stopped' }]);
  assert.equal(stopped.state, 'stopped');
  assert.equal(stopped.label, 'Stopped after 12 s · 2 tool calls');
  const failed = traceLabel([{ id: 'a', kind: 'query', label: 'Queried', status: 'failed' }]);
  assert.equal(failed.state, 'failed');
  assert.equal(failed.label, 'Failed · 1 tool call');
});

test('a failure that was retried successfully does not fail the run', () => {
  const { state } = traceLabel(finishedRun());
  assert.equal(state, 'done');
});

test('without durations or calls the summary counts the steps', () => {
  assert.equal(traceLabel([{ id: 'a', kind: 'think', label: 'Thought' }]).label, '1 step');
  assert.equal(traceLabel([{ id: 'a', kind: 'think', label: 'A' }, { id: 'b', kind: 'think', label: 'B' }]).label, '2 steps');
});

test('the summary takes its words from the message lookup it is given', () => {
  const msg = (key, ...args) => `[${key}${args.length ? `:${args.join(',')}` : ''}]`;
  assert.equal(traceLabel(finishedRun(), msg).label,
    '[runTrace.worked:42 s] · [runTrace.calls:3] · [runTrace.sources:9] · [runTrace.retry]');
});

test('a blocked run says so with its time and counts, and names the blocked step by its label', () => {
  const steps = [
    { id: 'a', kind: 'query', label: 'Queried invoices', ms: 12_000 },
    { id: 'b', kind: 'call', label: 'Send the reminders', status: 'blocked', doing: 'Sending the reminders…' }
  ];
  assert.deepEqual(traceLabel(steps), { state: 'blocked', label: 'Blocked after 12 s · 2 tool calls', doing: 'Send the reminders' });
  assert.equal(traceLabel([{ id: 'b', label: '', doing: 'Sending…', status: 'blocked' }]).doing, 'Sending');
  assert.equal(traceLabel([{ id: 'a', label: 'Send', status: 'blocked' }]).label, 'Blocked · 1 tool call');
  const msg = (key, ...args) => `[${key}${args.length ? `:${args.join(',')}` : ''}]`;
  assert.equal(traceLabel(steps, msg).label, '[runTrace.blockedAfter:12 s] · [runTrace.calls:2]');
});

test('a running or waiting step outranks a blocked one; blocked outranks paused, stopped and failed', () => {
  const blocked = { id: 'b', label: 'Send', status: 'blocked' };
  assert.equal(traceLabel([blocked, { id: 'r', label: 'Read', status: 'running' }]).state, 'running');
  assert.equal(traceLabel([blocked, { id: 'w', label: 'Ask', status: 'waiting' }]).state, 'waiting');
  for (const status of ['paused', 'stopped', 'failed']) {
    assert.equal(traceLabel([{ id: 'x', label: 'X', status }, blocked]).state, 'blocked', status);
  }
});

test('a run no step of which has started reads "Not started" with its step count', () => {
  const plan = [
    { id: 't1', kind: 'task', label: 'Match the bank feed', status: 'queued' },
    { id: 't2', kind: 'task', label: 'Send reminders', status: 'queued' }
  ];
  assert.deepEqual(traceLabel(plan), { state: 'queued', label: 'Not started · 2 steps', doing: null });
  assert.equal(traceLabel([{ ...plan[0], status: 'done', ms: 4_000 }, plan[1]]).state, 'done');
});

test('tasks, asks and decisions are not counted as tool calls', () => {
  const steps = [
    { id: 'a', kind: 'ask', label: 'Close September' },
    { id: 't', kind: 'task', label: 'Match the bank feed', ms: 2_000 },
    { id: 'q', kind: 'query', label: 'Queried invoices', ms: 1_000 },
    { id: 'd', kind: 'decision', label: 'Approved the wording' }
  ];
  assert.equal(traceLabel(steps).label, 'Worked for 3.0 s · 1 tool call');
});

test('a label replaces the computed line and is followed by the state word unless done', () => {
  const running = [...finishedRun(), { id: 'w', kind: 'task', label: 'Send', status: 'running', doing: 'Sending the reminders' }];
  assert.deepEqual(traceLabel(running, undefined, { label: 'Close September · 2 of 5 done' }), {
    state: 'running', label: 'Close September · 2 of 5 done · Running', doing: 'Sending the reminders'
  });
  assert.equal(traceLabel(finishedRun(), undefined, { label: 'Plan' }).label, 'Plan');
  assert.equal(traceLabel([{ id: 'a', label: 'Ask', status: 'waiting' }], undefined, { label: 'Plan' }).label, 'Plan · Waiting for you');
  assert.equal(traceLabel([{ id: 'b', label: 'Send', status: 'blocked' }], undefined, { label: 'Plan' }).label, 'Plan · Blocked');
  assert.equal(traceLabel([{ id: 'q', label: 'Q', status: 'queued' }], undefined, { label: 'Plan' }).label, 'Plan · Not started');
  for (const empty of [null, undefined, '', '   ']) {
    assert.equal(traceLabel(finishedRun(), undefined, { label: empty }).label, 'Worked for 42 s · 3 tool calls · 9 sources · 1 retry');
  }
});

test('the summary ignores what is not a step', () => {
  assert.deepEqual(traceLabel(null), { state: 'done', label: '0 steps', doing: null });
  assert.equal(traceLabel([null, 'x', { id: 'a', kind: 'read', label: 'Read', ms: 1_000 }]).label, 'Worked for 1.0 s · 1 tool call');
});

/* ------------------------------------------------------------------ step rows -- */

test('the meta line reads count, sources, actor, start time and tokens, in that order', () => {
  const step = {
    id: 's', kind: 'search', label: 'Searched notes', count: '3 notes', sources: 9, actor: 'finance',
    at: '2026-10-14T10:31:05', tokens: 912
  };
  const name = (key) => ({ finance: 'Finance agent' })[key] ?? key;
  assert.deepEqual(stepMeta(step, { name }), [
    { part: 'count', text: '3 notes' },
    { part: 'sources', text: '9 sources' },
    { part: 'actor', text: 'Finance agent' },
    { part: 'time', text: '10:31:05' },
    { part: 'tokens', text: '912 tokens' }
  ]);
});

test('the meta line leaves out what a step does not have', () => {
  assert.deepEqual(stepMeta({ id: 'a', label: 'Read' }), []);
  assert.deepEqual(stepMeta({ id: 'a', label: 'Read', tokens: 0, sources: 0, count: '' }), []);
  assert.deepEqual(stepMeta({ id: 'a', label: 'Read', tokens: 1 }), [{ part: 'tokens', text: '1 token' }]);
  assert.deepEqual(stepMeta({ id: 'a', label: 'Read', tokens: 12_400 }), [{ part: 'tokens', text: '12,400 tokens' }]);
  assert.deepEqual(stepMeta({ id: 'a', label: 'Read', actor: 'ghost' }), [{ part: 'actor', text: 'ghost' }]);
  assert.deepEqual(stepMeta({ id: 'a', label: 'Read', at: 'yesterday' }), []);
  assert.deepEqual(stepMeta(null), []);
});

test('the start time is HH:MM:SS from the local ISO time, or what formatTime writes', () => {
  assert.deepEqual(stepMeta({ id: 'a', label: 'A', at: '2026-10-14T10:31' }), [{ part: 'time', text: '10:31:00' }]);
  assert.deepEqual(stepMeta({ id: 'a', label: 'A', at: '2026-10-14 08:02:09' }), [{ part: 'time', text: '08:02:09' }]);
  const formatTime = (at) => `at ${at.slice(11, 16)}`;
  assert.deepEqual(stepMeta({ id: 'a', label: 'A', at: '2026-10-14T10:31:05' }, { formatTime }), [{ part: 'time', text: 'at 10:31' }]);
});

test('a hand-off names neither side again, and keeps its own label when its words replace it', () => {
  const name = (key) => ({ finance: 'Finance agent', hanna: 'Hanna Weber' })[key] ?? key;
  const step = { id: 'h', kind: 'handoff', label: 'Passed on 7 invoices', actor: 'finance', to: 'hanna', at: '2026-10-14T10:20:00' };
  assert.deepEqual(stepMeta(step, { name }), [{ part: 'label', text: 'Passed on 7 invoices' }, { part: 'time', text: '10:20:00' }]);
  const same = { ...step, label: 'Finance agent handed over to Hanna Weber' };
  assert.deepEqual(stepMeta(same, { name }).map((part) => part.part), ['time']);
});

test('the meta line takes its words from the message lookup it is given', () => {
  const msg = (key, ...args) => `[${key}${args.length ? `:${args.join(',')}` : ''}]`;
  assert.deepEqual(stepMeta({ id: 'a', label: 'A', sources: 1, tokens: 912 }, { msg }).map((part) => part.text),
    ['[runTrace.source]', '[runTrace.tokens:912]']);
});

test('a row with something to open is a disclosure; otherwise selectable traces make it a button', () => {
  const plain = { id: 'a', kind: 'task', label: 'Match the bank feed' };
  assert.equal(rowKind(plain), 'static');
  assert.equal(rowKind(plain, { selectable: true }), 'select');
  for (const key of ['args', 'result', 'error', 'detail']) {
    assert.equal(rowKind({ ...plain, [key]: 'x' }), 'disclosure', key);
    assert.equal(rowKind({ ...plain, [key]: 'x' }, { selectable: true }), 'disclosure', key);
  }
  // Arguments that are not shown leave nothing to open.
  assert.equal(rowKind({ ...plain, args: '{}' }, { showArguments: false }), 'static');
  assert.equal(rowKind({ ...plain, args: '{}' }, { showArguments: false, selectable: true }), 'select');
  assert.equal(rowKind({ ...plain, refs: [{ id: 'f', label: 'File' }] }), 'static');
});

test('a running clock counts whole units from the start, and never below zero', () => {
  const start = Date.parse('2026-10-14T10:30:18');
  assert.equal(elapsedSince(start, start + 41_400), '41 s');
  assert.equal(elapsedSince(start, start + 102_000), '1 min 42 s');
  assert.equal(elapsedSince(start, start - 5_000), '0 s');
  assert.equal(elapsedSince(Number.NaN, start), '');
});

/* ------------------------------------------------------------------ arguments and results -- */

test('JSON arguments are pretty-printed; anything else is shown as given', () => {
  assert.equal(prettyArguments('{"customer":"C-1042","status":["open","overdue"]}'),
    '{\n  "customer": "C-1042",\n  "status": [\n    "open",\n    "overdue"\n  ]\n}');
  assert.equal(prettyArguments('[1,2]'), '[\n  1,\n  2\n]');
  assert.equal(prettyArguments('customer = C-1042'), 'customer = C-1042');
  assert.equal(prettyArguments('{"unclosed": '), '{"unclosed": ');
  assert.equal(prettyArguments('42'), '42');
  assert.equal(prettyArguments('"text"'), '"text"');
  assert.equal(prettyArguments(null), '');
});

test('a long result is cut at the limit with an ellipsis, and reports its whole length', () => {
  assert.deepEqual(truncateText('abcdefgh', 5), { text: 'abcde…', cut: true, length: 8 });
  assert.deepEqual(truncateText('abc', 5), { text: 'abc', cut: false, length: 3 });
  assert.deepEqual(truncateText('abcde', 5), { text: 'abcde', cut: false, length: 5 });
});

test('a result is never cut inside a surrogate pair', () => {
  const { text, cut } = truncateText('ab😀cd', 3);
  assert.equal(cut, true);
  assert.equal(text, 'ab…');
});

test('no limit, or a nonsensical one, keeps the whole result', () => {
  for (const max of [0, -1, Infinity, Number.NaN, null, undefined, 'many']) {
    assert.equal(truncateText('abcdef', max).cut, false, String(max));
  }
});

/* ------------------------------------------------------------------ retries -- */

test('retries are grouped under the first step of their chain, in order', () => {
  const steps = [
    { id: 'a', label: 'A' },
    { id: 'b', label: 'B', status: 'failed' },
    { id: 'c', label: 'C' },
    { id: 'b2', label: 'B again', retryOf: 'b', status: 'failed' },
    { id: 'b3', label: 'B once more', retryOf: 'b2' }
  ];
  assert.deepEqual(groupRetries(steps).map((group) => [group.step.id, group.retries.map((retry) => retry.id)]),
    [['a', []], ['b', ['b2', 'b3']], ['c', []]]);
});

test('a retry of nothing known, of itself, or in a loop stays at the top level', () => {
  const steps = [
    { id: 'a', label: 'A', retryOf: 'missing' },
    { id: 'b', label: 'B', retryOf: 'b' },
    { id: 'c', label: 'C', retryOf: 'd' },
    { id: 'd', label: 'D', retryOf: 'c' }
  ];
  assert.deepEqual(groupRetries(steps).map((group) => [group.step.id, group.retries.length]),
    [['a', 0], ['b', 0], ['c', 0], ['d', 0]]);
});

test('grouping keeps the step objects and leaves the input alone', () => {
  const steps = finishedRun();
  const before = JSON.stringify(steps);
  const groups = groupRetries(steps);
  assert.equal(groups[1].retries[0], steps[2]);
  assert.equal(JSON.stringify(steps), before);
  assert.deepEqual(groupRetries(undefined), []);
});

/* ------------------------------------------------------------------ contract -- */

test('every step kind has a glyph the bundled icon set draws', () => {
  const names = new Set(iconNames());
  for (const kind of ['search', 'read', 'query', 'write', 'run', 'call', 'handoff', 'think', 'task', 'ask', 'decision']) {
    assert.ok(Object.hasOwn(STEP_ICONS, kind), kind);
    assert.ok(names.has(STEP_ICONS[kind]), `${kind} → ${STEP_ICONS[kind]}`);
  }
  assert.ok(Object.isFrozen(STEP_ICONS));
});

test('a plan task, an ask and a decision draw a list, a letter and a check, unless overridden', () => {
  assert.deepEqual(['task', 'ask', 'decision'].map((kind) => stepIcon(kind)), ['list', 'mail', 'check']);
  assert.equal(stepIcon('decision', { decision: 'success' }), 'success');
  assert.equal(stepIcon('ask', { ask: '' }), 'mail');
  assert.equal(stepIcon('mystery'), STEP_ICONS.call);
  assert.equal(stepIcon('mystery', { call: 'reload' }), 'reload');
});

test('the defaults match the documented options and carry the status words', () => {
  const {
    steps, open, label, authors, showArguments, maxResult, selectable, ticking, now, formatTime, msg
  } = RunTrace.defaults;
  assert.deepEqual({ steps, open, label, authors, showArguments, maxResult, selectable, ticking, now, formatTime }, {
    steps: [], open: false, label: null, authors: {}, showArguments: true, maxResult: 4000,
    selectable: false, ticking: false, now: null, formatTime: null
  });
  assert.equal(msg['agent.status.failed'], 'Failed');
  assert.equal(msg['agent.status.blocked'], 'Blocked');
  assert.equal(msg['runTrace.retried'], 'Retried');
  assert.equal(msg['runTrace.showAll'], 'Show all');
  assert.equal(msg['runTrace.blockedAfter'], 'Blocked after %1');
  assert.equal(msg['runTrace.tokens'], '%1 tokens');
  assert.equal(RunTrace.cssName, 'run-trace');
});
