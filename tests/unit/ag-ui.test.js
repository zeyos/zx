import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { AG_UI_VERSION, connectAgUi } from '../../src/components/agent-thread/ag-ui.js';
import { translate } from '../../src/core/i18n.js';
import { validateDocument } from '../../src/components/surface/validate.js';

/** A recorded sequence from `tests/unit/fixtures/`. */
function fixture(name) {
  const data = JSON.parse(readFileSync(new URL(`./fixtures/ag-ui-${name}.json`, import.meta.url), 'utf8'));
  assert.equal(data.protocol, `ag-ui/${AG_UI_VERSION}`);
  return data.events;
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

/**
 * The surface of a fake thread: it records operations and replies once, carrying its token, the
 * way a Surface does.
 */
class FakeSurface {
  constructor(thread, id, item) {
    this.thread = thread;
    this.id = id;
    this.token = item.token ?? null;
    this.document = item.document ?? null;
    this.ops = [];
    this.reply = null;
    this.cancelled = null;
    this.errors = this.document ? validateDocument(this.document).errors : [];
  }
  apply(op) { this.ops.push(op); return this; }
  getReply() { return this.reply ? structuredClone(this.reply) : null; }
  getErrors() { return structuredClone(this.errors); }
  cancel(reason) {
    this.cancelled = reason;
    this.answer('cancel', {}, reason);
    return this;
  }
  answer(action, values = {}, reason) {
    if (this.reply) return;
    const surface = this.document?.surface ?? this.ops.find((op) => op.op === 'begin')?.surface;
    this.reply = { zx: 'reply/1', surface, action, key: `${surface}#${action}`, values, confirmation: null, at: '2026-11-03T10:00:00',
      ...(this.token ? { token: this.token } : {}), ...(reason ? { reason } : {}) };
    this.thread.emit('reply', { item: this.thread.get(this.id), reply: this.getReply() });
  }
}

/** Just enough of AgentThread for the adapter: items in order, the calls made, and events. */
class FakeThread extends EventTarget {
  constructor() {
    super();
    this.items = new Map();
    this.order = [];
    this.surfaces = new Map();
    this.revealed = [];
    this.options = { surfaceOptions: {} };
  }
  msg(key, ...args) { return translate(key, args); }
  on(type, fn) { this.addEventListener(type, fn); return this; }
  off(type, fn) { this.removeEventListener(type, fn); return this; }
  emit(type, detail) {
    const event = new CustomEvent(type, { detail, cancelable: true });
    this.dispatchEvent(event);
    return event;
  }
  upsert(item, options = {}) {
    const id = String(item.id);
    const old = this.items.get(id);
    const after = options.after == null ? -1 : this.order.indexOf(String(options.after));
    if (!old && after >= 0) this.order.splice(after + 1, 0, id);
    else if (!old) this.order.push(id);
    this.items.set(id, { ...item, id });
    if (item.type === 'surface' && (!old || item.document)) this.surfaces.set(id, new FakeSurface(this, id, item));
    return this;
  }
  patch(id, partial) {
    const old = this.items.get(id);
    if (old) this.items.set(id, { ...old, ...structuredClone(partial), id, type: old.type });
    return this;
  }
  appendText(id, text) {
    if (!this.items.has(id)) this.upsert({ id, type: 'answer', blocks: [], streaming: true });
    const item = this.items.get(id);
    item.text = (item.text ?? '') + text;
    return this;
  }
  remove(id) {
    this.items.delete(id);
    this.surfaces.delete(id);
    this.order = this.order.filter((other) => other !== id);
    return this;
  }
  get(id) { return this.items.has(id) ? structuredClone({ ...this.items.get(id), catalog: undefined }) : null; }
  surface(id) { return this.surfaces.get(id) ?? null; }
  reveal(target) { this.revealed.push(target); return true; }
  step(traceId, stepId) { return this.items.get(traceId)?.steps.find((step) => step.id === stepId); }
}

/** A thread, an adapter, and every callback recorded. */
function setup(options = {}) {
  const thread = new FakeThread();
  const log = { results: [], states: [], unknown: [], errors: [], status: [] };
  const adapter = connectAgUi(thread, {
    agent: 'finance',
    runStatus: { update: (values) => log.status.push(values) },
    ontoolresult: (id, result) => log.results.push([id, result]),
    onstate: (state) => log.states.push(state),
    onunknown: (event) => log.unknown.push(event.type),
    onerror: (problem) => log.errors.push(problem.code),
    ...options
  });
  const play = (events) => { for (const event of events) adapter.handle(event); };
  return { thread, adapter, log, play };
}

const run = (id, events, outcome) => [
  { type: 'RUN_STARTED', threadId: 't', runId: id },
  ...events,
  { type: 'RUN_FINISHED', threadId: 't', runId: id, ...(outcome ? { outcome } : {}) }
];

/** The company tile of the surfaces fixture: nothing until the arguments are complete. */
function companyTile(seen) {
  return (call) => {
    seen.push(call.status);
    if (!call.args) return null;
    return { id: 'mine', type: 'company-card', company: call.args.id, status: call.status, result: call.result ?? null };
  };
}

/* ------------------------------------------------------------------ fixtures -- */

test('the plain fixture replays into a trace and an answer', () => {
  const { thread, log, play, adapter } = setup();
  play(fixture('plain'));
  assert.deepEqual(thread.order, ['trace:run_a1', 'msg_a2']);
  const steps = thread.items.get('trace:run_a1').steps;
  assert.deepEqual(steps.map((step) => [step.id, step.kind, step.status]), [
    ['think:rs_a1', 'think', 'done'], ['call_a1', 'call', 'done'], ['call_a2', 'call', 'done']
  ]);
  assert.equal(steps[1].label, 'Called find_company');
  assert.equal(steps[1].args, '{"query":"Helios Energie"}');
  assert.match(steps[1].result, /Helios Energie/);
  assert.equal(steps[1].ms, 700);
  const answer = thread.items.get('msg_a2');
  assert.equal(answer.author, 'finance');
  assert.equal(answer.streaming, false);
  assert.match(answer.text, /^Helios Energie has \*\*2 unpaid invoices\*\* totalling €6,135\.50:/);
  assert.match(answer.text, /14 days overdue\.$/);
  assert.deepEqual(log.states, [{ customer: null, lookups: 0 }, { customer: 'helios', lookups: 1 }, { customer: 'helios', lookups: 2 }]);
  assert.deepEqual(adapter.state(), { customer: 'helios', lookups: 2 });
  assert.deepEqual(log.status.map((values) => values.state), ['running', 'done']);
  assert.deepEqual(log.unknown, ['STEP_STARTED', 'STEP_FINISHED']);
  assert.deepEqual(log.errors, []);
  assert.deepEqual(log.results, []);
});

test('reasoning is one "Thought for" step without its text unless asked for', () => {
  const hidden = setup();
  hidden.play(fixture('plain'));
  const thought = hidden.thread.step('trace:run_a1', 'think:rs_a1');
  assert.equal(thought.label, 'Thought for 0.7 s');
  assert.equal(thought.detail, undefined);
  assert.ok(!JSON.stringify([...hidden.thread.items.values()]).includes('open balance'));

  const shown = setup({ showReasoning: true });
  shown.play(fixture('plain'));
  assert.equal(shown.thread.step('trace:run_a1', 'think:rs_a1').detail,
    'The user wants Helios Energie\'s open balance. Look up the company, then list its unpaid invoices.');
});

test('an approval-gated call waits for the person, and the decision is the tool result', async () => {
  const events = fixture('approval');
  const split = events.findIndex((event) => event.type === 'RUN_STARTED' && event.runId === 'run_b2');
  const { thread, log, play } = setup({ requiresApproval: (call) => call.name === 'send_reminder' });
  play(events.slice(0, split));
  assert.deepEqual(thread.order, ['msg_b1', 'trace:run_b1', 'approval:call_b1']);
  const card = thread.items.get('approval:call_b1');
  assert.equal(card.status, 'pending');
  assert.equal(card.title, 'Run send_reminder?');
  assert.match(card.details[0].code, /"invoice": "RE-2026-0121"/);
  assert.equal(thread.step('trace:run_b1', 'call_b1').status, 'waiting');
  assert.equal(log.status.at(-1).state, 'waiting');
  await tick();
  assert.deepEqual(log.results, [], 'nothing is approved by default');

  thread.emit('approve', { item: thread.get('approval:call_b1'), values: {} });
  assert.deepEqual(log.results, [], 'the decision waits for the thread’s own listeners');
  await tick();
  assert.deepEqual(log.results, [['call_b1', { approved: true }]]);
  assert.equal(thread.step('trace:run_b1', 'call_b1').status, 'running');

  play(events.slice(split));
  assert.equal(thread.step('trace:run_b1', 'call_b1').status, 'done');
  assert.match(thread.step('trace:run_b1', 'call_b1').result, /mail-88213/);
  assert.deepEqual(thread.order, ['msg_b1', 'trace:run_b1', 'approval:call_b1', 'msg_b2']);
  assert.deepEqual(log.status.map((values) => values.state), ['running', 'waiting', 'running', 'done']);
  assert.deepEqual(log.errors, []);
});

test('any truthy answer holds a call, and so does a Promise, whatever it resolves to', () => {
  const held = [
    () => true, () => 1, () => 'yes', () => ({ level: 'high' }), () => ['send'],
    (call) => /^send/.exec(call.name), async () => true, async () => false, () => Promise.resolve(false)
  ];
  for (const requiresApproval of held) {
    const { thread, play } = setup({ requiresApproval });
    play([{ type: 'RUN_STARTED', threadId: 't', runId: 'r1' }, { type: 'TOOL_CALL_START', toolCallId: 'c1', toolCallName: 'send_mail' }, { type: 'TOOL_CALL_END', toolCallId: 'c1' }]);
    assert.ok(thread.items.get('approval:c1'), String(requiresApproval));
    assert.equal(thread.step('trace:r1', 'c1').status, 'waiting', String(requiresApproval));
  }
  for (const requiresApproval of [() => false, () => 0, () => '', () => null, () => undefined, (call) => /^delete/.exec(call.name)]) {
    const { thread, play } = setup({ requiresApproval });
    play([{ type: 'RUN_STARTED', threadId: 't', runId: 'r1' }, { type: 'TOOL_CALL_START', toolCallId: 'c1', toolCallName: 'send_mail' }, { type: 'TOOL_CALL_END', toolCallId: 'c1' }]);
    assert.equal(thread.items.get('approval:c1'), undefined, String(requiresApproval));
    assert.equal(thread.step('trace:r1', 'c1').status, 'running', String(requiresApproval));
  }
});

test('a rejected approval skips the call; a prevented one keeps it waiting', async () => {
  const events = fixture('approval').slice(0, 13);
  const rejected = setup({ requiresApproval: () => true });
  rejected.play(events);
  rejected.thread.emit('reject', { item: rejected.thread.get('approval:call_b1'), reason: 'Not this week' });
  await tick();
  assert.deepEqual(rejected.log.results, [['call_b1', { approved: false, reason: 'Not this week' }]]);
  assert.equal(rejected.thread.step('trace:run_b1', 'call_b1').status, 'skipped');

  const prevented = setup({ requiresApproval: () => true });
  prevented.play(events);
  prevented.thread.addEventListener('approve', (event) => event.preventDefault());
  prevented.thread.emit('approve', { item: prevented.thread.get('approval:call_b1'), values: {} });
  await tick();
  assert.deepEqual(prevented.log.results, []);
  assert.equal(prevented.thread.step('trace:run_b1', 'call_b1').status, 'waiting');

  const throwing = setup({ requiresApproval: () => { throw new Error('policy offline'); } });
  throwing.play(events);
  assert.ok(throwing.thread.items.has('approval:call_b1'), 'a failing check holds the call');
  assert.deepEqual(throwing.log.errors, ['approval-check']);

  const ungated = setup();
  ungated.play(fixture('approval').map((event) => (event.outcome?.type === 'interrupt' ? { ...event, outcome: { type: 'success' } } : event)));
  assert.ok(!ungated.thread.items.has('approval:call_b1'));
  assert.equal(ungated.thread.step('trace:run_b1', 'call_b1').status, 'done');
});

test('the surfaces fixture replays into a tile, an ask surface and an inline surface', () => {
  const seen = [];
  const { thread, log, play } = setup({ tools: { show_company: companyTile(seen) }, inlineSurfaces: true });
  play(fixture('surfaces'));
  assert.deepEqual(thread.order, [
    'trace:run_c1', 'tool:call_c1', 'trace:run_c1#2', 'surface:run_c1/s1', 'msg_c2', 'surface:run_c2/s1', 'msg_c2#2'
  ]);
  assert.equal(thread.items.get('msg_c2').text, 'Scheduled. Here is the summary:\n\n');
  assert.equal(thread.items.get('msg_c2#2').text, 'I\'ll check for payment a week later.');
  assert.equal(thread.items.get('msg_c2#2').author, 'finance');
  assert.equal(thread.items.get('msg_c2#2').streaming, false);
  assert.deepEqual(thread.surface('surface:run_c2/s1').ops.map((op) => op.op), ['begin', 'node', 'node', 'end']);
  assert.equal(thread.step('trace:run_c1#2', 'call_c2').kind, 'ask');
  assert.equal(thread.step('trace:run_c1#2', 'call_c2').status, 'waiting');
  assert.deepEqual(log.status.map((values) => values.state), ['running', 'waiting', 'running', 'done']);
  assert.deepEqual(log.errors, []);
  assert.deepEqual(log.results, []);
});

/* ------------------------------------------------------------------ tiles -- */

test('a tile is inserted on its first item, patched in place, never redrawn on an argument delta', () => {
  const seen = [];
  const { thread, play } = setup({ tools: { show_company: companyTile(seen) } });
  const events = fixture('surfaces');
  play(events.slice(0, 5));
  assert.deepEqual(seen, ['queued', 'running'], 'one call at the start and one when the arguments completed');
  assert.deepEqual(thread.order, ['trace:run_c1', 'tool:call_c1']);
  const tile = thread.items.get('tool:call_c1');
  assert.equal(tile.type, 'company-card');
  assert.equal(tile.author, 'finance');
  assert.equal(tile.status, 'running');
  assert.ok(!thread.items.has('mine'), 'the adapter sets the id');
  assert.deepEqual(thread.step('trace:run_c1', 'call_c1').refs, [{ id: 'tool:call_c1', label: 'Show in conversation', entity: 'tile' }]);

  play(events.slice(5, 6));
  assert.deepEqual(seen, ['queued', 'running', 'done']);
  assert.deepEqual(thread.order, ['trace:run_c1', 'tool:call_c1'], 'patched where it stands');
  assert.equal(thread.items.get('tool:call_c1').status, 'done');
  assert.match(thread.items.get('tool:call_c1').result, /Élise Martin/);

  const step = thread.step('trace:run_c1', 'call_c1');
  thread.emit('open', { item: thread.get('trace:run_c1'), ref: step.refs[0], step });
  thread.emit('open', { item: thread.get('trace:run_c1'), ref: { id: 'task-7', label: 'Task' }, step });
  thread.emit('open', { item: thread.get('trace:run_c1'), ref: { id: 'tool:call_c1', label: 'Elsewhere' } });
  assert.deepEqual(thread.revealed, ['item:tool:call_c1']);
});

test('a throwing renderer is reported and its trace step stays as it was', () => {
  const { thread, log, play } = setup({ tools: { show_company: () => { throw new Error('boom'); } } });
  play(fixture('surfaces').slice(0, 6));
  assert.deepEqual(log.errors, ['renderer', 'renderer', 'renderer']);
  assert.ok(!thread.items.has('tool:call_c1'));
  const step = thread.step('trace:run_c1', 'call_c1');
  assert.equal(step.status, 'done');
  assert.equal(step.refs, undefined);

  const odd = setup({ tools: { show_company: () => 'not an item' } });
  odd.play(fixture('surfaces').slice(0, 3));
  assert.deepEqual(odd.log.errors, ['renderer']);
});

/* ------------------------------------------------------------------ surface tools -- */

test('a surface tool stands as a skeleton, then its reply is the tool result with its token', () => {
  const { thread, log, play } = setup();
  const events = fixture('surfaces');
  const end = events.findIndex((event) => event.type === 'TOOL_CALL_END' && event.toolCallId === 'call_c2');
  play(events.slice(0, end));
  const placeholder = thread.items.get('tool:call_c2');
  assert.equal(placeholder.type, 'zx-placeholder');
  assert.equal(thread.surfaces.size, 0, 'the stand-in is no surface, so it never replies');
  play(events.slice(end, end + 2));
  assert.ok(!thread.items.has('tool:call_c2'));
  const item = thread.items.get('surface:run_c1/s1');
  assert.equal(item.token, 'call_c2');
  assert.equal(item.document.intent, 'ask');
  assert.equal(log.status.at(-1).state, 'waiting');

  thread.surface('surface:run_c1/s1').answer('submit', { template: 'reminder-1' });
  assert.equal(log.results.length, 1);
  const [id, result] = log.results[0];
  assert.equal(id, 'call_c2');
  assert.equal(result.action, 'submit');
  assert.equal(result.token, 'call_c2');
  assert.deepEqual(result.values, { template: 'reminder-1' });
  assert.ok(!('errors' in result));
  assert.equal(thread.step('trace:run_c1', 'call_c2').status, 'done');
});

test('a surface tool’s reply carries the surface’s errors', () => {
  const { thread, log, play } = setup();
  const document = { zx: 'surface/1', surface: 'q', intent: 'confirm', title: 'Go?', author: 'finance', root: [], nodes: [], colour: 'red' };
  play(run('r1', [
    { type: 'TOOL_CALL_START', toolCallId: 'c1', toolCallName: 'show_surface' },
    { type: 'TOOL_CALL_ARGS', toolCallId: 'c1', delta: JSON.stringify(document) },
    { type: 'TOOL_CALL_END', toolCallId: 'c1' }
  ]));
  thread.surface('surface:r1/q').answer('confirm');
  const [, result] = log.results[0];
  assert.equal(result.action, 'confirm');
  assert.deepEqual(result.errors.map((error) => error.code), ['unknown-key']);
});

test('surface-tool arguments that are not JSON, or not a surface, are answered at once', () => {
  const { thread, log, play } = setup();
  play(run('r1', [
    { type: 'TOOL_CALL_START', toolCallId: 'c1', toolCallName: 'ask_user' },
    { type: 'TOOL_CALL_ARGS', toolCallId: 'c1', delta: '{"zx":"surface/1",' },
    { type: 'TOOL_CALL_END', toolCallId: 'c1' },
    { type: 'TOOL_CALL_START', toolCallId: 'c2', toolCallName: 'ask_user' },
    { type: 'TOOL_CALL_ARGS', toolCallId: 'c2', delta: '{"zx":"surface/2"}' },
    { type: 'TOOL_CALL_END', toolCallId: 'c2' }
  ]));
  assert.deepEqual(log.results[0], ['c1', { error: 'invalid-arguments' }]);
  assert.equal(log.results[1][0], 'c2');
  assert.equal(log.results[1][1].error, 'invalid-arguments');
  assert.ok(log.results[1][1].errors.length > 0);
  assert.ok(![...thread.items.values()].some((item) => item.type === 'surface'), 'nothing is drawn');
  assert.equal(thread.step('trace:r1', 'c1').status, 'failed');
  assert.equal(thread.step('trace:r1', 'c1').error, 'invalid-arguments');
});

/* ------------------------------------------------------------------ inline surfaces -- */

test('a show surface with no actions has nothing to answer: the call is answered at once', () => {
  const call = (id, document) => [
    { type: 'TOOL_CALL_START', toolCallId: id, toolCallName: 'show_surface' },
    { type: 'TOOL_CALL_ARGS', toolCallId: id, delta: JSON.stringify(document) },
    { type: 'TOOL_CALL_END', toolCallId: id }
  ];
  const show = { zx: 'surface/1', surface: 's1', intent: 'show', title: 'Balance', author: 'finance', root: ['a'], nodes: [{ id: 'a', type: 'text', text: 'Paid' }] };
  const { thread, log, play } = setup();
  play(run('r1', call('c1', show)));
  assert.deepEqual(log.results, [['c1', { shown: true, surface: 's1' }]]);
  assert.equal(thread.step('trace:r1', 'c1').status, 'done');
  assert.equal(log.status.at(-1).state, 'done', 'a run with nothing left to answer does not wait');
  const surface = thread.surface('surface:r1/s1');
  assert.ok(surface, 'the surface stays on screen');
  assert.equal(surface.getReply(), null);

  // Its errors go with the answer, and a later close of the surface does not answer twice.
  const faulty = setup();
  faulty.play(run('r1', call('c1', { ...show, nodes: [...show.nodes, { id: 'b', type: 'hologram' }] })));
  assert.equal(faulty.log.results.length, 1);
  assert.ok(faulty.log.results[0][1].errors.some((error) => error.code === 'unknown-type'));
  faulty.thread.surface('surface:r1/s1').cancel('stopped');
  assert.equal(faulty.log.results.length, 1);

  // With actions of its own there is something to answer, and the call waits for it.
  const acting = setup();
  acting.play(run('r1', call('c1', { ...show, actions: [{ id: 'ack', label: 'Got it' }] })));
  assert.deepEqual(acting.log.results, []);
  assert.equal(acting.log.status.at(-1).state, 'waiting');
});

test('a surface with no valid intent draws no controls, so the call is refused rather than left waiting', () => {
  const { thread, log, play } = setup();
  play(run('r1', [
    { type: 'TOOL_CALL_START', toolCallId: 'c1', toolCallName: 'show_surface' },
    { type: 'TOOL_CALL_ARGS', toolCallId: 'c1', delta: JSON.stringify({ zx: 'surface/1', surface: 's1', intent: 'hologram', title: 'T', author: 'finance', root: [], nodes: [] }) },
    { type: 'TOOL_CALL_END', toolCallId: 'c1' }
  ]));
  assert.equal(log.results.length, 1);
  assert.equal(log.results[0][1].error, 'invalid-arguments');
  assert.ok(log.results[0][1].errors.some((error) => error.code === 'unknown-intent'));
  assert.equal(thread.step('trace:r1', 'c1').status, 'failed');
  assert.equal(thread.surface('surface:r1/s1'), null);
  assert.notEqual(log.status.at(-1).state, 'waiting');
});

test('inline fences split across chunks of any size', () => {
  const events = fixture('surfaces');
  const run2 = events.slice(events.findIndex((event) => event.runId === 'run_c2'));
  const text = run2.filter((event) => event.type === 'TEXT_MESSAGE_CONTENT').map((event) => event.delta).join('');
  const chars = [...text].map((delta) => ({ type: 'TEXT_MESSAGE_CONTENT', messageId: 'msg_c2', delta }));
  const { thread, log, play } = setup({ inlineSurfaces: true });
  play([run2[0], run2[1], ...chars, ...run2.slice(-2)]);
  assert.deepEqual(thread.order, ['msg_c2', 'surface:run_c2/s1', 'msg_c2#2']);
  assert.equal(thread.items.get('msg_c2').text, 'Scheduled. Here is the summary:\n\n');
  assert.equal(thread.items.get('msg_c2#2').text, 'I\'ll check for payment a week later.');
  assert.equal(thread.surface('surface:run_c2/s1').ops.length, 4);
  assert.deepEqual(log.errors, []);

  const plain = setup();
  plain.play(run2);
  assert.deepEqual(plain.thread.order, ['msg_c2'], 'without inlineSurfaces the fence stays text');
  assert.match(plain.thread.items.get('msg_c2').text, /```zx-surface/);
});

test('an unterminated fence is reported and its surface cancelled when the run ends', () => {
  const { thread, log, play } = setup({ inlineSurfaces: true });
  const begin = '{"zx":"surface/1","op":"begin","surface":"s1","intent":"confirm","title":"Go?","author":"finance","root":[]}';
  const events = run('r1', [
    { type: 'TEXT_MESSAGE_START', messageId: 'm1' },
    { type: 'TEXT_MESSAGE_CONTENT', messageId: 'm1', delta: `Here:\n\`\`\`zx-surface\n${begin}\n` },
    { type: 'TEXT_MESSAGE_END', messageId: 'm1' }
  ]);
  play(events.slice(0, -1));
  assert.deepEqual(log.errors, ['unterminated-fence']);
  assert.equal(thread.surface('surface:r1/s1').cancelled, null, 'not before the run ends');
  play(events.slice(-1));
  assert.equal(thread.surface('surface:r1/s1').cancelled, 'stopped');
  assert.equal(thread.surface('surface:r1/s1').getReply().token, 'r1');
});

/* ------------------------------------------------------------------ custom events and scoping -- */

const begin = (surface, extra = {}) => ({ zx: 'surface/1', op: 'begin', surface, intent: 'confirm', title: 'Go?', author: 'finance', root: [], ...extra });

test('surface ids are scoped per run, and a line for an answered surface is refused', () => {
  const { thread, log, play } = setup();
  const custom = (value) => ({ type: 'CUSTOM', name: 'zx.surface', value });
  play(run('r1', [custom({ ops: [begin('s1'), { op: 'end', surface: 's1' }], token: 'app-1' })]));
  play(run('r2', [custom(begin('s1')), custom({ op: 'end', surface: 's1' })]));
  assert.deepEqual(thread.order, ['surface:r1/s1', 'surface:r2/s1']);

  thread.surface('surface:r2/s1').answer('confirm');
  play(run('r3', [custom(begin('s1')), custom({ op: 'end', surface: 's1' })]));
  assert.deepEqual(thread.order, ['surface:r1/s1', 'surface:r2/s1', 'surface:r3/s1']);
  assert.equal(thread.surface('surface:r1/s1').token, 'app-1');
  assert.equal(thread.surface('surface:r2/s1').getReply().action, 'confirm', 'the answered one stays answered');

  const live = setup();
  live.play([{ type: 'RUN_STARTED', threadId: 't', runId: 'r1' }, custom(begin('s1')), custom({ op: 'end', surface: 's1' })]);
  live.thread.surface('surface:r1/s1').answer('confirm');
  live.play([custom({ op: 'node', surface: 's1', id: 'late', type: 'text', text: 'Too late' })]);
  assert.deepEqual(live.log.errors, ['surface-answered']);
  assert.equal(live.thread.surface('surface:r1/s1').ops.length, 2);

  live.play([custom({ op: 'node', surface: 'nope', id: 'x', type: 'text', text: 'x' })]);
  assert.deepEqual(live.log.errors, ['surface-answered', 'unknown-surface']);
  assert.deepEqual(log.errors, []);
});

test('a surface that reaches the end of its run without its end is reported and cancelled', () => {
  const custom = (value) => ({ type: 'CUSTOM', name: 'zx.surface', value });
  const { thread, log, play } = setup();
  play(run('r1', [custom(begin('open')), custom(begin('done')), custom({ op: 'end', surface: 'done' })]));
  assert.deepEqual(log.errors, ['unterminated-surface']);
  assert.equal(thread.surface('surface:r1/open').cancelled, 'stopped');
  assert.equal(thread.surface('surface:r1/open').getReply().token, undefined);
  assert.equal(thread.surface('surface:r1/done').cancelled, null, 'a surface that ended goes on waiting');

  // A fence closed without an `end`: nothing in the text is wrong, but the surface never ended.
  const inline = setup({ inlineSurfaces: true });
  inline.play(run('r1', [
    { type: 'TEXT_MESSAGE_START', messageId: 'm' },
    { type: 'TEXT_MESSAGE_CONTENT', messageId: 'm', delta: `Hello\n\`\`\`zx-surface\n${JSON.stringify(begin('s1'))}\n\`\`\`\n` },
    { type: 'TEXT_MESSAGE_END', messageId: 'm' }
  ]));
  assert.deepEqual(inline.log.errors, ['unterminated-surface']);
  assert.equal(inline.thread.surface('surface:r1/s1').cancelled, 'stopped');

  // An unterminated fence is reported as that, once.
  const fence = setup({ inlineSurfaces: true });
  fence.play(run('r1', [
    { type: 'TEXT_MESSAGE_START', messageId: 'm' },
    { type: 'TEXT_MESSAGE_CONTENT', messageId: 'm', delta: `\`\`\`zx-surface\n${JSON.stringify(begin('s1'))}\n` },
    { type: 'TEXT_MESSAGE_END', messageId: 'm' }
  ]));
  assert.deepEqual(fence.log.errors, ['unterminated-fence']);
  assert.equal(fence.thread.surface('surface:r1/s1').cancelled, 'stopped');

  // An answered surface owes nothing, ended or not.
  const answered = setup();
  answered.play([{ type: 'RUN_STARTED', threadId: 't', runId: 'r1' }, custom(begin('s1'))]);
  answered.thread.surface('surface:r1/s1').cancel('cancelled');
  answered.play([{ type: 'RUN_FINISHED', threadId: 't', runId: 'r1' }]);
  assert.deepEqual(answered.log.errors, []);
});

test('every reply carries its token: the application’s, the tool call’s, the run’s', () => {
  const { thread, play } = setup({ inlineSurfaces: true });
  const custom = (value) => ({ type: 'CUSTOM', name: 'zx.surface', value });
  play([
    { type: 'RUN_STARTED', threadId: 't', runId: 'run-9' },
    custom({ ops: [begin('a')], token: 'issued-by-server' }),
    custom({ ops: [{ op: 'end', surface: 'a' }], token: 'ignored' }),
    { type: 'TOOL_CALL_START', toolCallId: 'call-4', toolCallName: 'show_surface' },
    { type: 'TOOL_CALL_ARGS', toolCallId: 'call-4', delta: JSON.stringify({ zx: 'surface/1', surface: 'b', intent: 'confirm', title: 'Go?', author: 'finance', root: [], nodes: [] }) },
    { type: 'TOOL_CALL_END', toolCallId: 'call-4' },
    { type: 'TEXT_MESSAGE_START', messageId: 'm' },
    { type: 'TEXT_MESSAGE_CONTENT', messageId: 'm', delta: `\`\`\`zx-surface\n${JSON.stringify(begin('c'))}\n{"op":"end","surface":"c"}\n\`\`\`\n` },
    { type: 'TEXT_MESSAGE_END', messageId: 'm' }
  ]);
  const tokens = ['a', 'b', 'c'].map((name) => {
    const surface = thread.surface(`surface:run-9/${name}`);
    surface.answer('confirm');
    return surface.getReply().token;
  });
  assert.deepEqual(tokens, ['issued-by-server', 'call-4', 'run-9']);
  assert.ok(!thread.items.has('m'), 'a message that was only a fence leaves no empty answer');
});

/* ------------------------------------------------------------------ the rest of the protocol -- */

test('unknown events, and known ones the thread does not draw, are reported', () => {
  const { log, play } = setup();
  play(run('r1', [
    { type: 'SOMETHING_NEW', value: 1 },
    { type: 'THINKING_START' },
    { type: 'MESSAGES_SNAPSHOT', messages: [] },
    { type: 'CUSTOM', name: 'other', value: 1 },
    { type: 'RAW', event: {} }
  ]));
  assert.deepEqual(log.unknown, ['SOMETHING_NEW', 'THINKING_START', 'MESSAGES_SNAPSHOT', 'CUSTOM', 'RAW']);
});

test('out of order: orphans are dropped, duplicate starts ignored, both reported', () => {
  const { thread, log, play } = setup();
  play(run('r1', [
    { type: 'TEXT_MESSAGE_CONTENT', messageId: 'm1', delta: 'early' },
    { type: 'TEXT_MESSAGE_START', messageId: 'm1' },
    { type: 'TEXT_MESSAGE_START', messageId: 'm1' },
    { type: 'TEXT_MESSAGE_CONTENT', messageId: 'm1', delta: 'on time' },
    { type: 'TEXT_MESSAGE_END', messageId: 'm1' },
    { type: 'TEXT_MESSAGE_CONTENT', messageId: 'm1', delta: 'late' },
    { type: 'TOOL_CALL_ARGS', toolCallId: 'c9', delta: '{}' },
    { type: 'TOOL_CALL_END', toolCallId: 'c9' },
    { type: 'TOOL_CALL_RESULT', toolCallId: 'c9', messageId: 't9', content: 'x' },
    { type: 'REASONING_MESSAGE_CONTENT', messageId: 'r', delta: 'x' },
    { type: 'TEXT_MESSAGE_CONTENT', messageId: 'm1' }
  ]));
  assert.deepEqual(thread.order, ['m1']);
  assert.equal(thread.items.get('m1').text, 'on time');
  assert.deepEqual(log.errors, ['out-of-order', 'duplicate-start', 'out-of-order', 'out-of-order', 'out-of-order', 'out-of-order', 'out-of-order', 'invalid-event']);

  const outside = setup();
  outside.play([{ type: 'TEXT_MESSAGE_START', messageId: 'm' }, { type: 'RUN_STARTED', threadId: 't', runId: 'r' }, { type: 'RUN_STARTED', threadId: 't', runId: 'r' }]);
  assert.deepEqual(outside.log.errors, ['no-run', 'duplicate-start']);
  assert.deepEqual(outside.thread.order, []);
});

test('a start for a closed message reopens it, and its content continues', () => {
  const { thread, log, play } = setup();
  const say = (id, delta) => [
    { type: 'TEXT_MESSAGE_START', messageId: id },
    { type: 'TEXT_MESSAGE_CONTENT', messageId: id, delta },
    { type: 'TEXT_MESSAGE_END', messageId: id }
  ];
  play(run('r1', [...say('m1', 'first '), { type: 'TOOL_CALL_START', toolCallId: 'c1', toolCallName: 'x' }, { type: 'TOOL_CALL_END', toolCallId: 'c1' }, ...say('m1', 'second')]));
  assert.equal(thread.items.get('m1').text, 'first second');
  assert.equal(thread.items.get('m1').streaming, false);
  assert.deepEqual(thread.order.filter((id) => id.startsWith('m')), ['m1'], 'it continues where it stands');
  play(run('r2', say('m1', ' third')));
  assert.equal(thread.items.get('m1').text, 'first second third', 'a later run may reopen it too');
  assert.deepEqual(log.errors, []);

  // Left open, the reopened message is closed by the run like any other.
  const open = setup();
  open.play(run('r1', say('m1', 'one')));
  open.play(run('r2', [{ type: 'TEXT_MESSAGE_START', messageId: 'm1' }]));
  assert.equal(open.thread.items.get('m1').streaming, false);
  assert.deepEqual(open.log.errors, ['unclosed']);

  // A chunk stream reopens the same way.
  const chunks = setup();
  chunks.play(run('r1', [
    { type: 'TEXT_MESSAGE_CHUNK', messageId: 'm1', delta: 'a' },
    { type: 'STATE_SNAPSHOT', snapshot: {} },
    { type: 'TEXT_MESSAGE_CHUNK', messageId: 'm1', delta: 'b' }
  ]));
  assert.equal(chunks.thread.items.get('m1').text, 'ab');
  assert.deepEqual(chunks.log.errors, []);
});

test('a reopened message with fences keeps splitting them', () => {
  const { thread, log, play } = setup({ inlineSurfaces: true });
  const line = (surface) => `\`\`\`zx-surface\n{"zx":"surface/1","op":"begin","surface":"${surface}","intent":"confirm","title":"Go?","author":"finance","root":[]}\n{"op":"end","surface":"${surface}"}\n\`\`\`\n`;
  play(run('r1', [
    { type: 'TEXT_MESSAGE_START', messageId: 'm1' },
    { type: 'TEXT_MESSAGE_CONTENT', messageId: 'm1', delta: `Before\n${line('s1')}` },
    { type: 'TEXT_MESSAGE_END', messageId: 'm1' },
    { type: 'TEXT_MESSAGE_START', messageId: 'm1' },
    { type: 'TEXT_MESSAGE_CONTENT', messageId: 'm1', delta: `After\n${line('s2')}Done` },
    { type: 'TEXT_MESSAGE_END', messageId: 'm1' }
  ]));
  assert.deepEqual(thread.order, ['m1', 'surface:r1/s1', 'm1#2', 'surface:r1/s2', 'm1#3']);
  assert.equal(thread.items.get('m1#3').text, 'Done');
  assert.deepEqual(log.errors, []);
});

test('a start for a closed call reopens it: its arguments continue, and are asked about again', async () => {
  const start = { type: 'TOOL_CALL_START', toolCallId: 'c1', toolCallName: 'send' };
  const end = { type: 'TOOL_CALL_END', toolCallId: 'c1' };
  const args = (delta) => ({ type: 'TOOL_CALL_ARGS', toolCallId: 'c1', delta });
  const begun = { type: 'RUN_STARTED', threadId: 't', runId: 'r1' };

  const plain = setup();
  plain.play(run('r1', [start, args('{"a":'), end, start, args('1}'), end, { type: 'TOOL_CALL_RESULT', toolCallId: 'c1', messageId: 't1', content: 'ok' }]));
  assert.equal(plain.thread.step('trace:r1', 'c1').args, '{"a":1}');
  assert.equal(plain.thread.step('trace:r1', 'c1').status, 'done');
  assert.deepEqual(plain.log.errors, []);

  // What a person is shown is what they decide on: the card goes while the arguments change.
  const asked = [];
  const gated = setup({ requiresApproval: (call) => { asked.push(call.args); return true; } });
  gated.play([begun, start, args('{"a":1'), end]);
  const stale = gated.thread.get('approval:c1');
  gated.play([start]);
  assert.equal(gated.thread.items.get('approval:c1'), undefined, 'a card for arguments still changing is gone');
  assert.equal(gated.thread.step('trace:r1', 'c1').status, 'queued');
  gated.thread.emit('approve', { item: stale, values: {} });
  await tick();
  assert.deepEqual(gated.log.results, [], 'a decision on the old card counts for nothing');
  gated.play([args(',"b":2}'), end]);
  assert.equal(gated.thread.items.get('approval:c1').status, 'pending');
  assert.deepEqual(asked, [null, { a: 1, b: 2 }], 'the check sees the complete arguments');
  gated.thread.emit('approve', { item: gated.thread.get('approval:c1'), values: {} });
  await tick();
  assert.deepEqual(gated.log.results, [['c1', { approved: true }]]);

  // A tile sees the reopening as a status change, and is not drawn twice.
  const statuses = [];
  const tiled = setup({ tools: { send: (call) => { statuses.push([call.status, call.args, call.result]); return { type: 'card' }; } } });
  tiled.play(run('r1', [start, args('{}'), end, start, end, { type: 'TOOL_CALL_RESULT', toolCallId: 'c1', messageId: 't1', content: 'ok' }]));
  assert.deepEqual(statuses, [['queued', null, undefined], ['running', {}, undefined], ['queued', null, undefined], ['running', {}, undefined], ['done', {}, 'ok']]);
  assert.equal(tiled.thread.order.filter((id) => id === 'tool:c1').length, 1);
});

test('a reopened surface call stands as a skeleton again, and draws its complete arguments', () => {
  const document = askDoc('s1');
  const start = { type: 'TOOL_CALL_START', toolCallId: 'c1', toolCallName: 'ask_user' };
  const end = { type: 'TOOL_CALL_END', toolCallId: 'c1' };
  const args = (delta) => ({ type: 'TOOL_CALL_ARGS', toolCallId: 'c1', delta });
  const begun = { type: 'RUN_STARTED', threadId: 't', runId: 'r1' };

  // Drawn, then reopened: the surface goes, unanswered, and its call is not answered for it.
  const drawn = setup();
  drawn.play([begun, start, args(document), end]);
  const first = drawn.thread.surface('surface:r1/s1');
  drawn.play([start]);
  assert.equal(drawn.thread.items.get('surface:r1/s1'), undefined);
  first.answer('cancel');
  assert.deepEqual(drawn.log.results, []);
  drawn.play([args(' '), end]);
  assert.ok(drawn.thread.items.get('surface:r1/s1'), 'the same surface id is free again');
  assert.deepEqual(drawn.log.errors, []);
  drawn.thread.surface('surface:r1/s1').answer('submit', { a: 1 });
  assert.equal(drawn.log.results.length, 1);
});

test('a start for a settled call changes nothing: it is ignored and reported', async () => {
  const start = (name) => ({ type: 'TOOL_CALL_START', toolCallId: 'c1', toolCallName: name });
  const args = (delta) => ({ type: 'TOOL_CALL_ARGS', toolCallId: 'c1', delta });
  const end = { type: 'TOOL_CALL_END', toolCallId: 'c1' };
  const begun = { type: 'RUN_STARTED', threadId: 't', runId: 'r1' };
  const result = { type: 'TOOL_CALL_RESULT', toolCallId: 'c1', messageId: 't1', content: 'ok' };
  const again = (name) => [start(name), args(' more'), end];
  const refused = ['duplicate-start', 'out-of-order', 'out-of-order'];

  // Decided: the person's answer stands, and no second one is asked for.
  for (const [decision, answer] of [['approve', { approved: true }], ['reject', { approved: false, reason: 'no' }]]) {
    const { thread, log, play } = setup({ requiresApproval: () => true });
    play([begun, start('send'), args('{"a":1}'), end]);
    thread.emit(decision, { item: thread.get('approval:c1'), values: {}, reason: 'no' });
    await tick();
    const { status } = thread.step('trace:r1', 'c1');
    play(again('send'));
    assert.deepEqual(log.results, [['c1', answer]], decision);
    assert.deepEqual(log.errors, refused, decision);
    assert.ok(thread.items.get('approval:c1'), `${decision}: the card stays`);
    assert.equal(thread.step('trace:r1', 'c1').status, status, decision);
    assert.equal(thread.step('trace:r1', 'c1').args, '{"a":1}', decision);
  }

  // Expired by a result that came first.
  const expired = setup({ requiresApproval: () => true });
  expired.play([begun, start('send'), end, result]);
  expired.play(again('send'));
  assert.deepEqual(expired.log.results, []);
  assert.equal(expired.thread.items.get('approval:c1').status, 'expired');
  assert.deepEqual(expired.log.errors, ['out-of-order', ...refused]);

  // Answered by its result.
  const seen = [];
  const answered = setup({ tools: { send: (call) => { seen.push(call.status); return { type: 'card' }; } } });
  answered.play([begun, start('send'), args('{}'), end, result]);
  answered.play(again('send'));
  assert.equal(answered.thread.step('trace:r1', 'c1').status, 'done');
  assert.equal(answered.thread.step('trace:r1', 'c1').result, 'ok');
  assert.equal(answered.thread.step('trace:r1', 'c1').args, '{}');
  assert.deepEqual(seen, ['queued', 'running', 'done'], 'a tile is not drawn for a start that changed nothing');
  assert.deepEqual(answered.log.errors, refused);

  // A surface answered: its receipt stays where it stands.
  const receipt = setup();
  receipt.play([begun, ...askCall('c1', 's1')]);
  receipt.thread.surface('surface:r1/s1').answer('confirm');
  receipt.play(again('ask_user'));
  assert.equal(receipt.log.results.length, 1);
  assert.ok(receipt.thread.items.get('surface:r1/s1'), 'the receipt stays in the thread');
  assert.equal(receipt.thread.surface('surface:r1/s1').getReply().action, 'confirm');
  assert.equal(receipt.thread.items.get('tool:c1'), undefined, 'no Skeleton takes its place');
  assert.deepEqual(receipt.log.errors, refused);

  // Answered at once, because its arguments were no surface.
  const invalid = setup();
  invalid.play([begun, start('ask_user'), args('{"zx":'), end]);
  invalid.play(again('ask_user'));
  assert.deepEqual(invalid.log.results, [['c1', { error: 'invalid-arguments' }]]);
  assert.equal(invalid.thread.items.get('tool:c1'), undefined);
  assert.equal(invalid.thread.step('trace:r1', 'c1').status, 'failed');
  assert.deepEqual(invalid.log.errors, refused);

  // Answered at once, because a show surface has nothing to answer.
  const shown = setup();
  shown.play([begun, start('show_surface'), args(JSON.stringify({ zx: 'surface/1', surface: 's1', intent: 'show', title: 'T', author: 'finance', root: [], nodes: [] })), end]);
  shown.play(again('show_surface'));
  assert.deepEqual(shown.log.results, [['c1', { shown: true, surface: 's1' }]]);
  assert.ok(shown.thread.items.get('surface:r1/s1'));
  assert.deepEqual(shown.log.errors, refused);

  // A chunk stream asks the same way, and is told the same.
  const chunks = setup();
  chunks.play([begun, start('send'), end, result,
    { type: 'TOOL_CALL_CHUNK', toolCallId: 'c1', toolCallName: 'send', delta: '{}' }, { type: 'STATE_SNAPSHOT', snapshot: {} }]);
  assert.equal(chunks.thread.step('trace:r1', 'c1').status, 'done');
  assert.deepEqual(chunks.log.errors, refused);
});

test('with no surface from the thread nothing is dropped silently, and no call hangs', () => {
  const custom = (value) => ({ type: 'CUSTOM', name: 'zx.surface', value });
  const drawn = (options) => {
    const parts = setup(options);
    parts.thread.surface = () => null;
    return parts;
  };
  const show = JSON.stringify({ zx: 'surface/1', surface: 's2', intent: 'show', title: 'T', author: 'finance', root: [], nodes: [] });

  // A surface tool is answered at once, whatever its intent, and nothing stands in the thread.
  const tool = drawn();
  tool.play(run('r1', [
    ...askCall('c1', 's1'),
    { type: 'TOOL_CALL_START', toolCallId: 'c2', toolCallName: 'show_surface' },
    { type: 'TOOL_CALL_ARGS', toolCallId: 'c2', delta: show },
    { type: 'TOOL_CALL_END', toolCallId: 'c2' }
  ]));
  assert.deepEqual(tool.log.results, [['c1', { error: 'surface-unavailable' }], ['c2', { error: 'surface-unavailable' }]]);
  assert.deepEqual(tool.log.errors, ['surface-unavailable', 'surface-unavailable']);
  assert.equal(tool.thread.step('trace:r1', 'c1').status, 'failed');
  assert.equal(tool.thread.step('trace:r1', 'c1').error, 'surface-unavailable');
  assert.deepEqual([...tool.thread.items.values()].filter((item) => item.type !== 'trace'), [], 'no surface, and no Skeleton either');
  assert.equal(tool.log.status.at(-1).state, 'done', 'the run does not wait for an answer that cannot come');

  // Answered, the call is settled: it cannot be answered twice.
  tool.play([{ type: 'RUN_STARTED', threadId: 't', runId: 'r2' }, ...askCall('c1', 's1')]);
  assert.equal(tool.log.results.length, 2);

  // Every operation of a custom stream is reported, not only the first.
  const stream = drawn();
  stream.play(run('r1', [custom(begin('s1')), custom({ op: 'node', surface: 's1', id: 'a', type: 'text', text: 'x' }), custom({ op: 'end', surface: 's1' })]));
  assert.deepEqual(stream.log.errors, ['surface-unavailable', 'surface-unavailable', 'surface-unavailable']);
  assert.deepEqual(stream.thread.order, [], 'an empty surface item does not stay');

  // So is every line of a fence, and the prose around it goes on.
  const fence = drawn({ inlineSurfaces: true });
  fence.play(run('r1', [
    { type: 'TEXT_MESSAGE_START', messageId: 'm' },
    { type: 'TEXT_MESSAGE_CONTENT', messageId: 'm', delta: `Before\n\`\`\`zx-surface\n${JSON.stringify(begin('s1'))}\n{"op":"end","surface":"s1"}\n\`\`\`\nAfter` },
    { type: 'TEXT_MESSAGE_END', messageId: 'm' }
  ]));
  assert.deepEqual(fence.log.errors, ['surface-unavailable', 'surface-unavailable']);
  assert.equal(fence.thread.items.get('m').text, 'Before\n');
  assert.equal(fence.thread.items.get('m#2').text, 'After');

  // A step can follow where the surface would have stood.
  const after = drawn();
  after.play(run('r1', [
    { type: 'TOOL_CALL_START', toolCallId: 'c0', toolCallName: 'x' }, { type: 'TOOL_CALL_END', toolCallId: 'c0' },
    custom(begin('s1')),
    { type: 'TOOL_CALL_START', toolCallId: 'c1', toolCallName: 'x' }, { type: 'TOOL_CALL_END', toolCallId: 'c1' }
  ]));
  assert.deepEqual(after.thread.order, ['trace:r1'], 'nothing was drawn, so the trace goes on');

  // A surface the application removed from under a live stream is reported the same way.
  const removed = setup();
  removed.play([{ type: 'RUN_STARTED', threadId: 't', runId: 'r1' }, custom(begin('s1'))]);
  removed.thread.surface = () => null;
  removed.play([custom({ op: 'end', surface: 's1' })]);
  assert.deepEqual(removed.log.errors, ['surface-unavailable']);
});

test('chunk events expand into start, content and end', () => {
  const { thread, log, play } = setup();
  play(run('r1', [
    { type: 'TEXT_MESSAGE_CHUNK', messageId: 'm1', delta: 'Hel' },
    { type: 'TEXT_MESSAGE_CHUNK', delta: 'lo' },
    { type: 'TOOL_CALL_CHUNK', toolCallId: 'c1', toolCallName: 'lookup', delta: '{"q":' },
    { type: 'TOOL_CALL_CHUNK', delta: '1}' },
    { type: 'STATE_SNAPSHOT', snapshot: {} },
    { type: 'TOOL_CALL_RESULT', toolCallId: 'c1', messageId: 'tm', content: [{ type: 'text', text: 'one' }, { type: 'image', source: {} }] },
    { type: 'TEXT_MESSAGE_CHUNK', delta: 'orphan' }
  ]));
  assert.equal(thread.items.get('m1').text, 'Hello');
  assert.equal(thread.items.get('m1').streaming, false);
  const step = thread.step('trace:r1', 'c1');
  assert.equal(step.args, '{"q":1}');
  assert.equal(step.result, 'one');
  assert.equal(step.status, 'done');
  assert.deepEqual(log.errors, ['invalid-event']);
});

test('a run error adds a notice, stops what was open, and fails the run', () => {
  const { thread, log, play } = setup();
  play([
    { type: 'RUN_STARTED', threadId: 't', runId: 'r1' },
    { type: 'TEXT_MESSAGE_START', messageId: 'm1' },
    { type: 'TEXT_MESSAGE_CONTENT', messageId: 'm1', delta: 'Half' },
    { type: 'TOOL_CALL_START', toolCallId: 'c1', toolCallName: 'lookup' },
    { type: 'RUN_ERROR', message: 'Model overloaded' }
  ]);
  assert.deepEqual(thread.items.get('error:r1'), { id: 'error:r1', type: 'notice', tone: 'danger', text: 'The run failed: Model overloaded' });
  assert.equal(thread.items.get('m1').stopped, true);
  assert.equal(thread.step('trace:r1', 'c1').status, 'stopped');
  assert.equal(log.status.at(-1).state, 'failed');
  assert.deepEqual(log.errors, ['unclosed', 'unclosed'], 'the message and the call whose arguments were arriving');

  const cancelled = setup();
  cancelled.play(run('r1', [{ type: 'TOOL_CALL_START', toolCallId: 'c1', toolCallName: 'x' }], { type: 'cancelled' }));
  assert.equal(cancelled.log.status.at(-1).state, 'stopped');
  assert.equal(cancelled.thread.step('trace:r1', 'c1').status, 'stopped');
});

test('a state delta that does not apply is reported and the state is kept', () => {
  const { log, play, adapter } = setup();
  play(run('r1', [
    { type: 'STATE_SNAPSHOT', snapshot: { a: 1 } },
    { type: 'STATE_DELTA', delta: [{ op: 'test', path: '/a', value: 2 }, { op: 'replace', path: '/a', value: 3 }] },
    { type: 'STATE_DELTA', delta: [{ op: 'add', path: '/__proto__/x', value: 1 }] }
  ]));
  assert.deepEqual(adapter.state(), { a: 1 });
  assert.deepEqual(log.errors, ['state', 'state']);
});

test('a text message by a named author, and messages of other roles', () => {
  const { thread, log, play } = setup({ authors: { finance: { name: 'Finance' }, legal: { name: 'Legal' } } });
  play(run('r1', [
    { type: 'TEXT_MESSAGE_START', messageId: 'm1', name: 'legal' },
    { type: 'TEXT_MESSAGE_END', messageId: 'm1' },
    { type: 'TEXT_MESSAGE_START', messageId: 'm2', role: 'user' },
    { type: 'TEXT_MESSAGE_CONTENT', messageId: 'm2', delta: 'hi' },
    { type: 'TEXT_MESSAGE_END', messageId: 'm2' }
  ]));
  assert.equal(thread.items.get('m1').author, 'legal');
  assert.ok(!thread.items.has('m2'));
  assert.deepEqual(log.unknown, ['TEXT_MESSAGE_START']);
});

test('after destroy() events are ignored and the thread is not listened to', async () => {
  const { thread, log, play, adapter } = setup({ requiresApproval: () => true });
  play(fixture('approval').slice(0, 13));
  adapter.destroy();
  adapter.destroy();
  thread.emit('approve', { item: thread.get('approval:call_b1'), values: {} });
  await tick();
  adapter.handle({ type: 'RUN_STARTED', threadId: 't', runId: 'later' });
  assert.deepEqual(log.results, []);
  assert.deepEqual(log.status.map((update) => update.state), ['running', 'stopped'], 'the open run was closed, and nothing started after');
});

test('a thread is required and the catalog must be the library’s', () => {
  assert.throws(() => connectAgUi(null), TypeError);
  assert.throws(() => connectAgUi(new FakeThread(), { catalog: { intents: {} } }), TypeError);
});

test('the documentation demo replays the recorded fixtures unchanged', () => {
  const source = readFileSync(new URL('../../website/demos/agent-thread.demo.js', import.meta.url), 'utf8');
  for (const [name, fn] of [['plain', 'plainRun'], ['approval', 'approvalRun'], ['surfaces', 'surfaceRun']]) {
    const body = new RegExp(`function ${fn}\\(\\) \\{\\n  return (\\[[\\s\\S]*?\\n  \\]);`).exec(source);
    assert.ok(body, `${fn}() not found in the demo`);
    assert.deepEqual(new Function(`return ${body[1]};`)(), fixture(name), `${fn}() differs from ag-ui-${name}.json`);
  }
});

test('a call’s items go at its place, even after text drawn since its step', async () => {
  const seen = [];
  const { thread, log, play } = setup({ tools: { show_company: companyTile(seen) }, requiresApproval: (call) => call.name === 'send' });
  const company = fixture('surfaces').slice(1, 6);
  play([
    { type: 'RUN_STARTED', threadId: 't', runId: 'r1' },
    company[0], company[1], company[2],
    { type: 'TOOL_CALL_START', toolCallId: 'ask', toolCallName: 'ask_user' },
    { type: 'TEXT_MESSAGE_START', messageId: 'm1' },
    { type: 'TEXT_MESSAGE_CONTENT', messageId: 'm1', delta: 'While that runs…' },
    company[3], company[4],
    { type: 'TOOL_CALL_ARGS', toolCallId: 'ask', delta: JSON.stringify({ zx: 'surface/1', surface: 's1', intent: 'confirm', title: 'Go?', author: 'finance', root: [], nodes: [] }) },
    { type: 'TOOL_CALL_END', toolCallId: 'ask' },
    { type: 'TOOL_CALL_START', toolCallId: 'later', toolCallName: 'send' },
    { type: 'TOOL_CALL_END', toolCallId: 'later' }
  ]);
  assert.deepEqual(thread.order, ['trace:r1', 'tool:call_c1', 'surface:r1/s1', 'm1', 'trace:r1#2', 'approval:later']);
  thread.surface('surface:r1/s1').answer('confirm');
  assert.equal(log.results.length, 1);
  assert.deepEqual(log.errors, []);
});

/* ------------------------------------------------------------------ review regressions -- */

const askDoc = (surface = 'q') => JSON.stringify({ zx: 'surface/1', surface, intent: 'confirm', title: 'Go?', author: 'finance', root: [], nodes: [] });
const askCall = (id, surface) => [
  { type: 'TOOL_CALL_START', toolCallId: id, toolCallName: 'ask_user' },
  { type: 'TOOL_CALL_ARGS', toolCallId: id, delta: askDoc(surface) },
  { type: 'TOOL_CALL_END', toolCallId: id }
];

test('a surface belongs to the source that opened it', () => {
  const custom = (value) => ({ type: 'CUSTOM', name: 'zx.surface', value });
  const fence = (lines) => [
    { type: 'TEXT_MESSAGE_START', messageId: 'm' },
    { type: 'TEXT_MESSAGE_CONTENT', messageId: 'm', delta: `\`\`\`zx-surface\n${lines.map((line) => JSON.stringify(line)).join('\n')}\n\`\`\`\n` },
    { type: 'TEXT_MESSAGE_END', messageId: 'm' }
  ];
  // The model writes into the server's surface.
  const server = setup({ inlineSurfaces: true });
  server.play([{ type: 'RUN_STARTED', threadId: 't', runId: 'r1' }, custom({ ops: [begin('pay')], token: 'signed' }),
    ...fence([{ op: 'node', surface: 'pay', id: 'a', type: 'text', text: 'Changed' }, { op: 'end', surface: 'pay' }])]);
  assert.deepEqual(server.thread.surface('surface:r1/pay').ops.map((op) => op.op), ['begin']);
  assert.deepEqual(server.log.errors, ['not-allowed', 'not-allowed']);
  // The model takes the id first; the server's begin is refused, never merged.
  const model = setup({ inlineSurfaces: true });
  model.play([{ type: 'RUN_STARTED', threadId: 't', runId: 'r1' }, ...fence([begin('pay')]), custom({ ops: [begin('pay')], token: 'signed' })]);
  assert.equal(model.thread.surface('surface:r1/pay').token, 'r1');
  assert.deepEqual(model.thread.surface('surface:r1/pay').ops.length, 1);
  assert.ok(model.log.errors.includes('not-allowed'));
  // Neither may write into a surface tool's surface.
  const tool = setup({ inlineSurfaces: true });
  tool.play([{ type: 'RUN_STARTED', threadId: 't', runId: 'r1' }, ...askCall('c1', 'q'), custom({ op: 'node', surface: 'q', id: 'x', type: 'text', text: 'x' })]);
  assert.deepEqual(tool.thread.surface('surface:r1/q').ops, []);
  assert.deepEqual(tool.log.errors, ['not-allowed']);
});

test('a result before the decision expires the card; a result after a rejection keeps it skipped', async () => {
  const events = fixture('approval');
  const early = setup({ requiresApproval: () => true });
  early.play(events);
  assert.equal(early.thread.items.get('approval:call_b1').status, 'expired');
  assert.equal(early.thread.step('trace:run_b1', 'call_b1').status, 'done');
  assert.ok(early.log.errors.includes('out-of-order'));
  early.thread.emit('approve', { item: early.thread.get('approval:call_b1'), values: {} });
  await tick();
  assert.deepEqual(early.log.results, [], 'no decision for a call that already has its result');

  const late = setup({ requiresApproval: () => true });
  late.play(events.slice(0, 13));
  late.thread.emit('reject', { item: late.thread.get('approval:call_b1'), reason: 'no' });
  await tick();
  late.play(events.slice(13));
  const step = late.thread.step('trace:run_b1', 'call_b1');
  assert.equal(step.status, 'skipped');
  assert.match(step.result, /mail-88213/);
  late.thread.emit('approve', { item: late.thread.get('approval:call_b1'), values: {} });
  await tick();
  assert.equal(late.log.results.length, 1, 'a decision after the first is ignored');
});

test('handle() never throws on hostile input', () => {
  const { log, play, adapter } = setup();
  assert.doesNotThrow(() => play([
    { type: 'RUN_STARTED', threadId: 't', runId: 'r1' },
    { type: 'TOOL_CALL_START', toolCallId: 'c1', toolCallName: 'x' },
    { type: 'TOOL_CALL_END', toolCallId: 'c1' },
    { type: 'TOOL_CALL_RESULT', toolCallId: 'c1', messageId: 'm', content: [{ type: 'text', text: { toString: 1 } }, { type: 'text', text: 'ok' }] },
    { type: 'TEXT_MESSAGE_CHUNK', messageId: 'm2', delta: { toString: 1 } },
    { type: 'RUN_FINISHED', threadId: 't', runId: 'r1', outcome: { type: { toString: 1 } } }
  ]));
  assert.doesNotThrow(() => adapter.handle({ type: 'CUSTOM', name: 'zx.surface', value: { ops: [{ toString: 1, surface: { toString: 1 } }] } }));
  assert.ok(log.errors.includes('invalid-event'));
  assert.equal(log.status.at(-1).state, 'done', 'an unknown outcome still ends the run');
});

test('a tool_call interrupt gates an ungated call; other interrupts go to onunknown', async () => {
  const events = fixture('approval').slice(0, 14);
  const { thread, log, play } = setup();
  play(events);
  assert.equal(thread.items.get('approval:call_b1').status, 'pending');
  assert.equal(thread.step('trace:run_b1', 'call_b1').status, 'waiting');
  thread.emit('approve', { item: thread.get('approval:call_b1'), values: {} });
  await tick();
  assert.deepEqual(log.results, [['call_b1', { approved: true }]]);
  assert.deepEqual(log.unknown, []);

  const other = setup();
  other.play(run('r1', [], { type: 'interrupt', interrupts: [{ id: 'i1', reason: 'input_required', message: 'Which account?' }] }));
  assert.deepEqual(other.log.unknown, ['RUN_FINISHED']);
  assert.equal(other.log.status.at(-1).state, 'waiting');
});

test('reasoning chunks: hidden by default, shown when asked', () => {
  const chunks = [
    { type: 'REASONING_START', messageId: 's', timestamp: 1000 },
    { type: 'REASONING_MESSAGE_CHUNK', messageId: 'rm', delta: 'Check ' },
    { type: 'REASONING_MESSAGE_CHUNK', delta: 'the ledger.' },
    { type: 'REASONING_END', messageId: 's', timestamp: 13000 }
  ];
  const hidden = setup();
  hidden.play(run('r1', chunks));
  const step = hidden.thread.step('trace:r1', 'think:s');
  assert.equal(step.label, 'Thought for 12 s');
  assert.equal(step.detail, undefined);
  assert.deepEqual(hidden.log.errors, []);
  const shown = setup({ showReasoning: true });
  shown.play(run('r1', chunks));
  assert.equal(shown.thread.step('trace:r1', 'think:s').detail, 'Check the ledger.');
});

test('a pending surface tool is answered when the run fails, is cancelled, or the adapter goes', async () => {
  for (const ending of [{ type: 'RUN_ERROR', message: 'x' }, { type: 'RUN_FINISHED', threadId: 't', runId: 'r1', outcome: { type: 'cancelled' } }]) {
    const { thread, log, play } = setup();
    play([{ type: 'RUN_STARTED', threadId: 't', runId: 'r1' }, ...askCall('c1'), ending]);
    assert.equal(log.results.length, 1, ending.type);
    assert.equal(log.results[0][1].reason, 'stopped');
    assert.equal(log.results[0][1].token, 'c1');
    assert.equal(thread.step('trace:r1', 'c1').status, 'stopped');
  }
  const { thread, log, play, adapter } = setup({ requiresApproval: (call) => call.name === 'send' });
  play([{ type: 'RUN_STARTED', threadId: 't', runId: 'r1' }, ...askCall('c1'),
    { type: 'TOOL_CALL_START', toolCallId: 'c2', toolCallName: 'send' }, { type: 'TOOL_CALL_END', toolCallId: 'c2' }]);
  adapter.destroy();
  assert.deepEqual(log.results.map(([id, result]) => [id, result.action, result.reason]), [['c1', 'cancel', 'stopped']]);
  assert.equal(thread.items.get('approval:c2').status, 'expired');
  thread.emit('approve', { item: thread.get('approval:c2'), values: {} });
  await tick();
  assert.equal(log.results.length, 1);
});

test('destroy() closes an open run as stopped, and reports nothing for it', () => {
  const custom = (value) => ({ type: 'CUSTOM', name: 'zx.surface', value });
  const { thread, log, play, adapter } = setup({ inlineSurfaces: true });
  play([
    { type: 'RUN_STARTED', threadId: 't', runId: 'r1' },
    { type: 'REASONING_START', messageId: 'rs' },
    { type: 'TEXT_MESSAGE_START', messageId: 'm1' },
    { type: 'TEXT_MESSAGE_CONTENT', messageId: 'm1', delta: 'Half an answer' },
    { type: 'TOOL_CALL_START', toolCallId: 'c1', toolCallName: 'lookup' },
    { type: 'TOOL_CALL_START', toolCallId: 'c2', toolCallName: 'ask_user' },
    { type: 'TOOL_CALL_ARGS', toolCallId: 'c2', delta: '{"zx":' },
    custom({ ops: [begin('s1')], token: 'app' })
  ]);
  const updates = log.status.length;
  adapter.destroy();
  assert.equal(thread.items.get('m1').streaming, false, 'the answer stopped streaming');
  assert.equal(thread.items.get('m1').stopped, true);
  assert.equal(thread.items.get('tool:c2'), undefined, 'the Skeleton of a call that never completed is gone');
  assert.equal(thread.step('trace:r1#2', 'c1').status, 'stopped');
  assert.equal(thread.step('trace:r1#2', 'c2').status, 'stopped');
  assert.equal(thread.step('trace:r1', 'think:rs').status, 'done', 'open reasoning is closed');
  assert.equal(thread.surface('surface:r1/s1').cancelled, 'stopped', 'a custom surface does not wait for ever');
  assert.equal(log.status.length, updates + 1);
  assert.equal(log.status.at(-1).state, 'stopped');
  assert.ok(log.status.at(-1).finished instanceof Date);
  assert.deepEqual(log.errors, [], 'going away is not a problem in the stream');

  // Nothing is left to close afterwards, and a finished run is not stopped after the fact.
  adapter.destroy();
  assert.equal(log.status.length, updates + 1);
  const done = setup();
  done.play(run('r1', [{ type: 'TEXT_MESSAGE_START', messageId: 'm1' }, { type: 'TEXT_MESSAGE_END', messageId: 'm1' }]));
  const final = done.log.status.at(-1).state;
  done.adapter.destroy();
  assert.equal(done.log.status.at(-1).state, final);
});

test('a call with no result and no pending id keeps the run from reading as finished', () => {
  const start = { type: 'TOOL_CALL_START', toolCallId: 'c1', toolCallName: 'pick_file' };
  const end = { type: 'TOOL_CALL_END', toolCallId: 'c1' };
  const unanswered = setup();
  unanswered.play(run('r1', [start, end]));
  assert.equal(unanswered.log.status.at(-1).state, 'waiting');
  assert.ok(unanswered.log.status.at(-1).waitingSince instanceof Date);
  const success = setup();
  success.play(run('r1', [start, end], { type: 'success' }));
  assert.equal(success.log.status.at(-1).state, 'waiting', 'an outcome without the list says nothing either way');
  const pending = setup();
  pending.play(run('r1', [start, end], { type: 'success', pendingToolCallIds: [] }));
  assert.equal(pending.log.status.at(-1).state, 'waiting', 'an empty list does not mean nothing is pending');
  const unknown = setup();
  unknown.play(run('r1', [start, end], { type: 'someday' }));
  assert.equal(unknown.log.status.at(-1).state, 'waiting', 'an unknown outcome reads as success');
  assert.deepEqual(unknown.log.errors, ['invalid-event']);

  const answered = setup();
  answered.play(run('r1', [start, end, { type: 'TOOL_CALL_RESULT', toolCallId: 'c1', messageId: 't1', content: 'ok' }]));
  assert.equal(answered.log.status.at(-1).state, 'done');

  // Only a call of this run holds it: an earlier run's call is that run's to wait for.
  const later = setup();
  later.play(run('r1', [start, end]));
  later.play(run('r2', []));
  assert.equal(later.log.status.at(-1).state, 'done');
  const stopped = setup();
  stopped.play(run('r1', [start, end], { type: 'cancelled' }));
  assert.equal(stopped.log.status.at(-1).state, 'stopped');
});

test('a run error outside an open run fails the last run, and what waits for a person stays open', async () => {
  const { thread, log, play } = setup({ requiresApproval: (call) => call.name === 'send' });
  play(run('r1', [...askCall('c1'), { type: 'TOOL_CALL_START', toolCallId: 'c2', toolCallName: 'send' }, { type: 'TOOL_CALL_END', toolCallId: 'c2' }]));
  play([{ type: 'RUN_ERROR', message: 'The resume was refused' }]);
  assert.deepEqual(thread.items.get('error:r1'), { id: 'error:r1', type: 'notice', tone: 'danger', text: 'The run failed: The resume was refused' });
  assert.equal(log.status.at(-1).state, 'failed');
  assert.deepEqual(log.errors, ['no-run']);
  assert.deepEqual(log.results, [], 'nobody answered for the person');
  assert.equal(thread.surface('surface:r1/q').cancelled, null);
  assert.equal(thread.items.get('approval:c2').status, 'pending');
  assert.equal(thread.step('trace:r1#2', 'c2').status, 'waiting');
  thread.emit('approve', { item: thread.get('approval:c2'), values: {} });
  await tick();
  assert.deepEqual(log.results, [['c2', { approved: true }]], 'the card can still be answered');
  thread.surface('surface:r1/q').answer('confirm');
  assert.equal(log.results.at(-1)[1].action, 'confirm');

  const first = setup();
  first.play([{ type: 'RUN_ERROR', message: 'Refused', timestamp: 7 }]);
  assert.deepEqual(first.thread.order, ['error:7']);
  assert.equal(first.log.status.at(-1).state, 'failed');
  assert.deepEqual(first.log.errors, ['no-run']);
});

test('a tile on a gated call follows its card', () => {
  const seen = [];
  const { thread, play } = setup({ tools: { show_company: companyTile(seen) }, requiresApproval: () => true });
  play(fixture('surfaces').slice(0, 5));
  assert.deepEqual(thread.order, ['trace:run_c1', 'approval:call_c1', 'tool:call_c1']);
  assert.deepEqual(seen, ['queued', 'waiting']);
  play(fixture('surfaces').slice(5, 6));
  assert.deepEqual(seen, ['queued', 'waiting', 'done'], 'the renderer runs only when the status changes');
});

test('a tile follows its card, whatever status the renderer first answers at', () => {
  const seen = [];
  const { thread, play } = setup({
    requiresApproval: (call) => call.name === 'show_company',
    tools: { show_company: (call) => { seen.push(call.status); return { type: 'company-card', status: call.status }; } }
  });
  play([
    { type: 'RUN_STARTED', threadId: 't', runId: 'r1' },
    { type: 'TOOL_CALL_START', toolCallId: 'c0', toolCallName: 'lookup' },
    { type: 'TOOL_CALL_END', toolCallId: 'c0' },
    { type: 'TOOL_CALL_START', toolCallId: 'c1', toolCallName: 'show_company' },
    { type: 'TOOL_CALL_END', toolCallId: 'c1' },
    { type: 'TOOL_CALL_START', toolCallId: 'c2', toolCallName: 'lookup' },
    { type: 'TOOL_CALL_END', toolCallId: 'c2' }
  ]);
  assert.deepEqual(seen, ['queued', 'waiting']);
  assert.deepEqual(thread.order, ['trace:r1', 'approval:c1', 'tool:c1', 'trace:r1#2'], 'the card goes before the tile drawn earlier, and what follows goes after both');
});

test('a result for a surface still waiting closes it: no answer goes out for that call', () => {
  const { thread, log, play } = setup();
  play(run('r1', [...askCall('c1'), { type: 'TOOL_CALL_RESULT', toolCallId: 'c1', messageId: 't1', content: 'timed out' }]));
  assert.deepEqual(log.errors, ['out-of-order']);
  assert.equal(thread.step('trace:r1', 'c1').status, 'done');
  assert.equal(thread.step('trace:r1', 'c1').result, 'timed out');
  const surface = thread.surface('surface:r1/q');
  assert.equal(surface.cancelled, 'stopped', 'its one reply is out, and it cannot be answered any more');
  assert.deepEqual(log.results, []);
  surface.answer('confirm');
  assert.deepEqual(log.results, []);
  assert.equal(log.status.at(-1).state, 'done');

  // A result that follows an answer only fills the step.
  const answered = setup();
  answered.play(run('r1', askCall('c1')));
  answered.thread.surface('surface:r1/q').answer('confirm');
  answered.play(run('r2', [{ type: 'TOOL_CALL_RESULT', toolCallId: 'c1', messageId: 't1', content: 'sent' }]));
  assert.deepEqual(answered.log.errors, []);
  assert.equal(answered.log.results.length, 1);
  assert.equal(answered.thread.surface('surface:r1/q').cancelled, null);
});

test('run end removes the stand-in of a call whose arguments never completed', () => {
  const { thread, log, play } = setup();
  play(run('r1', [{ type: 'TOOL_CALL_START', toolCallId: 'c1', toolCallName: 'ask_user' }, { type: 'TOOL_CALL_ARGS', toolCallId: 'c1', delta: '{' }]));
  assert.ok(!thread.items.has('tool:c1'));
  assert.equal(thread.step('trace:r1', 'c1').status, 'stopped');
  assert.deepEqual(log.errors, ['unclosed']);
});

test('reserved message ids are refused; reasoning closed by the run uses its time', () => {
  const { thread, log, play } = setup();
  play([
    { type: 'RUN_STARTED', threadId: 't', runId: 'r1' },
    { type: 'TEXT_MESSAGE_START', messageId: 'approval:c9' },
    { type: 'TEXT_MESSAGE_CONTENT', messageId: 'approval:c9', delta: 'fake' },
    { type: 'REASONING_START', messageId: 's', timestamp: 1000 },
    { type: 'RUN_FINISHED', threadId: 't', runId: 'r1', timestamp: 4000 }
  ]);
  assert.ok(!thread.items.has('approval:c9'));
  assert.deepEqual(log.errors, ['not-allowed']);
  assert.equal(thread.step('trace:r1', 'think:s').label, 'Thought for 3.0 s');
});

test('a token is checked only on the event that opens a surface; an invalid begin draws nothing', () => {
  const custom = (value) => ({ type: 'CUSTOM', name: 'zx.surface', value });
  const { thread, log, play } = setup();
  play([
    { type: 'RUN_STARTED', threadId: 't', runId: 'r1' },
    custom({ ops: [begin('a')], token: 42 }),
    custom({ ops: [begin('b')], token: 'ok' }),
    custom({ ops: [{ op: 'end', surface: 'b' }], token: 42 }),
    custom({ ops: [{ zx: 'surface/9', op: 'begin', surface: 'c', intent: 'confirm', root: [] }] })
  ]);
  assert.deepEqual(thread.order, ['surface:r1/b']);
  assert.deepEqual(thread.surface('surface:r1/b').ops.map((op) => op.op), ['begin', 'end']);
  assert.equal(thread.surface('surface:r1/b').token, 'ok');
  assert.deepEqual(log.errors, ['invalid-event', 'invalid-event']);
});
