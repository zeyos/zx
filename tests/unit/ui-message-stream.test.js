import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  UI_MESSAGE_STREAM_VERSION, connectUiMessageStream
} from '../../src/components/agent-thread/ui-message-stream.js';
import { translate } from '../../src/core/i18n.js';
import * as zx from '../../src/index.js';

/** @param {string} name @returns {any} */
function fixture(name) {
  return JSON.parse(readFileSync(new URL(`fixtures/ui-stream-${name}.json`, import.meta.url), 'utf8'));
}

/**
 * The thread's public API over plain data, with its one behaviour the adapter has to work around
 * kept on purpose: streamed text lives in the view, so a redraw that does not bring `blocks` falls
 * back to the blocks the item was last given. An answer's first steps are such a redraw.
 */
class FakeThread extends EventTarget {
  options = {};
  /** @type {Map<string, any>} */
  items = new Map();
  /** @type {Map<string, string>} Streamed text per answer. */
  text = new Map();
  /** @type {Map<string, any[]>} Blocks appended after the text, per answer. */
  appended = new Map();
  /** @type {string[]} */
  revealed = [];
  /** @type {any[]} */
  calls = [];
  /** @type {Map<string, any[]>} The sources given to an answer's view rather than its item. */
  citing = new Map();

  msg(key, ...args) { return translate(key, args); }
  on(type, fn) { this.addEventListener(type, fn); return this; }
  off(type, fn) { this.removeEventListener(type, fn); return this; }

  /** Stands in for a card's button: the thread's event, then the decision taking effect. */
  async decide(type, detail, { prevent = false } = {}) {
    const event = new CustomEvent(type, { detail, cancelable: true });
    this.dispatchEvent(event);
    if (prevent) event.preventDefault();
    await Promise.resolve();
    return event;
  }

  upsert(item) {
    this.calls.push(['upsert', item.id]);
    const copy = structuredClone(item);
    this.items.set(String(item.id), copy);
    if (copy.type === 'answer') this._blocks(copy);
    return this;
  }

  patch(id, partial) {
    const key = String(id);
    const before = this.items.get(key);
    if (!before) return this;
    this.calls.push(['patch', key, Object.keys(partial)]);
    const hadTrace = Boolean(before.steps?.length);
    const item = { ...before, ...structuredClone(partial), id: before.id, type: before.type };
    this.items.set(key, item);
    if (item.type === 'answer' && 'steps' in partial && !hadTrace) this._blocks(item);
    return this;
  }

  /** @param {any} item */
  _blocks(item) {
    const blocks = item.blocks ?? [];
    this.text.set(String(item.id), blocks.filter((block) => block.type === 'p').map((block) => block.text).join('\n\n'));
    this.appended.set(String(item.id), blocks.filter((block) => block.type !== 'p'));
  }

  appendText(id, text) {
    const key = String(id);
    this.calls.push(['appendText', key, text]);
    if (!this.items.has(key)) this.upsert({ id: key, type: 'answer', blocks: [], streaming: true });
    this.text.set(key, (this.text.get(key) ?? '') + text);
    return this;
  }

  appendBlock(id, block) {
    const key = String(id);
    this.appended.set(key, [...(this.appended.get(key) ?? []), block]);
    return this;
  }

  get(id) {
    const key = String(id);
    const item = this.items.get(key);
    if (!item) return null;
    const copy = structuredClone(item);
    if (copy.type === 'answer') {
      const paragraphs = (this.text.get(key) ?? '').split(/\n{2,}(?=\S)/).filter(Boolean);
      copy.blocks = [...paragraphs.map((text) => ({ type: 'p', text })), ...(this.appended.get(key) ?? [])];
    }
    return copy;
  }

  remove(id) {
    this.calls.push(['remove', String(id)]);
    this.items.delete(String(id));
    return this;
  }

  /** An answer's view, as far as the adapter reaches for it. */
  getComponent(id) {
    return { setSources: (sources) => this.citing.set(String(id), structuredClone(sources)) };
  }

  reveal(target) {
    this.revealed.push(target);
    return true;
  }

  /** @returns {string[]} The item ids, in thread order. */
  order() {
    return [...this.items.keys()];
  }
}

/** Records every `update()` a run status receives. */
function fakeRunStatus() {
  const states = [];
  return { states, update: (values) => { states.push(values.state); } };
}

/**
 * A connection with every callback recorded.
 * @param {Record<string, unknown>} [options]
 */
function connect(options = {}) {
  const thread = new FakeThread();
  const log = { approval: [], data: [], metadata: [], unknown: [], error: [] };
  const stream = connectUiMessageStream(/** @type {any} */ (thread), {
    onapproval: (...args) => log.approval.push(args),
    ondata: (...args) => log.data.push(args),
    onmetadata: (metadata) => log.metadata.push(metadata),
    onunknown: (part) => log.unknown.push(part),
    onerror: (error) => log.error.push(error.message),
    ...options
  });
  /** @param {any[]} parts */
  const play = (parts) => { for (const part of parts) stream.handle(part); };
  return { thread, stream, log, play };
}

/** @param {any[]} steps @returns {any[]} Steps without the measured durations. */
const untimed = (steps) => steps.map(({ ms, ...step }) => step);

/* ------------------------------------------------------------------ the module -- */

test('the adapter names the protocol version it implements and is exported', () => {
  assert.equal(UI_MESSAGE_STREAM_VERSION, 'v1');
  assert.equal(zx.UI_MESSAGE_STREAM_VERSION, 'v1');
  assert.equal(zx.connectUiMessageStream, connectUiMessageStream);
  for (const name of ['tools', 'approval', 'reasoning', 'reset']) assert.equal(fixture(name).pinned.protocol, UI_MESSAGE_STREAM_VERSION);
});

test('the documentation replays the recorded stream, not a version of its own', () => {
  // Tests are not published, so the demo carries its own copy of the recording.
  const source = readFileSync(new URL('../../website/demos/agent-thread.demo.js', import.meta.url), 'utf8');
  const recorded = /const RECORDED_STREAM = (\[[\s\S]*?\n\]);/.exec(source);
  assert.ok(recorded, 'RECORDED_STREAM not found in the demo');
  assert.deepEqual(JSON.parse(recorded[1]), fixture('approval').responses);
});

/* ------------------------------------------------------------------ the fixtures -- */

test('an answer with two tool calls and two sources replays into one answer', () => {
  const { thread, log, play } = connect({ agent: 'finance' });
  play(fixture('tools').responses[0]);

  assert.deepEqual(thread.order(), ['msg-weather']);
  const answer = /** @type {any} */ (thread.get('msg-weather'));
  assert.equal(answer.type, 'answer');
  assert.equal(answer.author, 'finance');
  assert.equal(answer.streaming, false);
  assert.deepEqual(answer.blocks, [
    { type: 'p', text: 'I’ll check both cities.' },
    { type: 'p', text: 'It rains in Hamburg [1] and the sun is out in Vienna [2].' }
  ]);
  assert.deepEqual(untimed(answer.steps), [
    { id: 'call-hamburg', kind: 'call', label: 'getWeatherInformation', tool: 'getWeatherInformation', status: 'done',
      args: '{"city":"Hamburg"}', result: JSON.stringify({ city: 'Hamburg', weather: 'rainy' }, null, 2) },
    { id: 'call-vienna', kind: 'call', label: 'getWeatherInformation', tool: 'getWeatherInformation', status: 'done',
      args: JSON.stringify({ city: 'Vienna' }, null, 2), result: JSON.stringify({ city: 'Vienna', weather: 'sunny' }, null, 2) }
  ]);
  assert.deepEqual(answer.sources, [
    { id: 'source-hamburg', kind: 'web', title: 'Hamburg forecast', site: 'weather.example', href: 'https://weather.example/hamburg' },
    { id: 'source-vienna', kind: 'file', title: 'Vienna station report', site: 'vienna.pdf' }
  ]);
  assert.deepEqual(log.error, []);
  assert.deepEqual(log.unknown, []);
});

test('an approval-gated call waits, and the next response continues the same turn below the card', async () => {
  const { thread, log, play } = connect();
  const [first, second] = fixture('approval').responses;
  play(first);

  assert.deepEqual(thread.order(), ['msg-reminder', 'approval:approval-reminder']);
  const card = /** @type {any} */ (thread.get('approval:approval-reminder'));
  assert.equal(card.type, 'approval');
  assert.equal(card.status, 'pending');
  assert.equal(card.title, 'Run sendReminder?');
  assert.equal(card.description, 'Sent mail can’t be recalled.');
  assert.deepEqual(card.details, [{ type: 'code', language: 'json', code: JSON.stringify({ customer: 'Bruckner Logistik', invoice: 'RE-2026-0126' }, null, 2) }]);
  assert.equal(/** @type {any} */ (thread.get('msg-reminder')).steps[0].status, 'waiting');
  assert.deepEqual(log.approval, [], 'nothing is decided until the person decides');

  await thread.decide('approve', { item: card, values: {} });
  assert.deepEqual(log.approval, [['approval-reminder', true, undefined]]);
  assert.equal(/** @type {any} */ (thread.get('msg-reminder')).steps[0].status, 'running');

  play(second);
  assert.deepEqual(thread.order(), ['msg-reminder', 'approval:approval-reminder', 'msg-reminder#2'], 'the final text stands below the card');
  const answer = /** @type {any} */ (thread.get('msg-reminder'));
  const rest = /** @type {any} */ (thread.get('msg-reminder#2'));
  assert.equal(answer.streaming, false);
  assert.equal(rest.streaming, false);
  assert.equal(answer.steps[0].status, 'done', 'the steps stay on the message’s first answer');
  assert.equal(rest.steps, undefined);
  assert.deepEqual(answer.blocks.map((block) => block.text), ['Bruckner Logistik is 21 days late. I’ll send the first reminder once you agree.']);
  assert.deepEqual(rest.blocks.map((block) => block.text), ['The reminder is on its way.']);
  assert.deepEqual(log.error, []);
});

test('an answer with reasoning and data replays with the reasoning kept private', () => {
  const { thread, log, play } = connect();
  play(fixture('reasoning').responses[0]);

  const answer = /** @type {any} */ (thread.get('msg-plan'));
  assert.deepEqual(answer.blocks, [{ type: 'p', text: 'Send the reminder today.' }]);
  assert.equal(answer.steps.length, 1);
  assert.equal(answer.steps[0].kind, 'think');
  assert.equal(answer.steps[0].status, 'done');
  assert.deepEqual(log.data, [
    ['progress', { done: 1, total: 3 }, 'progress-1'],
    ['progress', { done: 3, total: 3 }, 'progress-1'],
    ['note', { text: 'Checked against the 2026 policy' }, undefined]
  ]);
  assert.deepEqual(log.metadata, [{ model: 'large' }, { tokens: 412 }, { tokens: 640 }]);
  assert.deepEqual(log.error, []);
});

/* ------------------------------------------------------------------ approvals -- */

test('a rejection reaches onapproval with its reason and skips the step', async () => {
  const { thread, log, play } = connect();
  play(fixture('approval').responses[0]);
  await thread.decide('reject', { item: thread.get('approval:approval-reminder'), reason: 'Wrong customer' });
  assert.deepEqual(log.approval, [['approval-reminder', false, 'Wrong customer']]);
  assert.equal(/** @type {any} */ (thread.get('msg-reminder')).steps[0].status, 'skipped');
});

test('a prevented decision decides nothing, even when the listener runs after the adapter', async () => {
  const { thread, log, play } = connect();
  play(fixture('approval').responses[0]);
  await thread.decide('approve', { item: thread.get('approval:approval-reminder'), values: {} }, { prevent: true });
  assert.deepEqual(log.approval, []);
  assert.equal(/** @type {any} */ (thread.get('msg-reminder')).steps[0].status, 'waiting');
});

test('an event for an item of the application is left alone', async () => {
  const { thread, log, play } = connect();
  play(fixture('approval').responses[0]);
  await thread.decide('approve', { item: { id: 'someone-elses-card' }, values: {} });
  assert.deepEqual(log.approval, []);
});

test('an automatic approval asks nobody', () => {
  const { thread, log, play } = connect();
  play([
    { type: 'start', messageId: 'm' },
    { type: 'tool-input-available', toolCallId: 'c', toolName: 'readFile', input: {} },
    { type: 'tool-approval-request', toolCallId: 'c', approvalId: 'a', isAutomatic: true },
    { type: 'tool-output-denied', toolCallId: 'c' }
  ]);
  assert.deepEqual(thread.order(), ['m']);
  assert.equal(/** @type {any} */ (thread.get('m')).steps[0].status, 'skipped');
  assert.deepEqual(log.approval, []);
});

test('an answer the server settled ends the card, so no stale decision can go out', async () => {
  const { thread, log, play } = connect();
  play(fixture('approval').responses[0]);
  play([{ type: 'tool-output-denied', toolCallId: 'call-reminder' }]);
  const card = /** @type {any} */ (thread.get('approval:approval-reminder'));
  assert.equal(card.status, 'expired');
  await thread.decide('approve', { item: card, values: {} });
  assert.deepEqual(log.approval, []);
});

test('a duplicate approval request is ignored and reported', () => {
  const { thread, log, play } = connect();
  const request = { type: 'tool-approval-request', toolCallId: 'call-reminder', approvalId: 'approval-reminder' };
  play(fixture('approval').responses[0]);
  play([request]);
  assert.equal(thread.order().length, 2);
  assert.match(log.error[0], /Duplicate tool-approval-request/);
});

/* ------------------------------------------------------------------ reasoning -- */

/** @type {any[]} */
const REASONING = [
  { type: 'start', messageId: 'm' },
  { type: 'reasoning-start', id: 'r' },
  { type: 'reasoning-delta', id: 'r', delta: 'A secret plan' }
];

test('reasoning is one "Thought for 12 s" step without the text', (context) => {
  context.mock.timers.enable({ apis: ['Date'], now: 1_000 });
  const { thread, play } = connect();
  play(REASONING);
  const running = /** @type {any} */ (thread.get('m')).steps[0];
  assert.equal(running.status, 'running');
  assert.equal(running.doing, 'Thinking');
  context.mock.timers.tick(12_000);
  play([{ type: 'reasoning-end', id: 'r' }]);

  const [step, ...rest] = /** @type {any} */ (thread.get('m')).steps;
  assert.deepEqual(rest, []);
  assert.deepEqual(step, { id: 'think:m', kind: 'think', label: 'Thought for 12 s', doing: 'Thinking', status: 'done' }, 'the label says how long, and `ms` would say it again beside it');
  assert.doesNotMatch(JSON.stringify(thread.get('m')), /secret/);
  assert.equal(/** @type {any} */ (thread.get('m')).stepsOpen, undefined, 'the steps stay collapsed');
});

test('showReasoning puts the text on the step', () => {
  const { thread, play } = connect({ showReasoning: true });
  play([...REASONING, { type: 'reasoning-delta', id: 'r', delta: ' for later' }, { type: 'reasoning-end', id: 'r' }]);
  assert.equal(/** @type {any} */ (thread.get('m')).steps[0].detail, 'A secret plan for later');
});

test('every reasoning block of a message shares its one step and its clock', (context) => {
  context.mock.timers.enable({ apis: ['Date'], now: 0 });
  const { thread, play } = connect();
  play(REASONING);
  context.mock.timers.tick(2_000);
  play([{ type: 'reasoning-end', id: 'r' }, { type: 'reasoning-start', id: 'r2' }]);
  context.mock.timers.tick(3_000);
  play([{ type: 'reasoning-end', id: 'r2' }]);
  const { steps } = /** @type {any} */ (thread.get('m'));
  assert.equal(steps.length, 1);
  assert.equal(steps[0].label, 'Thought for 5.0 s');
});

test('a reasoning file is never drawn and is not an unknown part', () => {
  const { thread, log, play } = connect();
  play([{ type: 'start', messageId: 'm' }, { type: 'reasoning-file', url: 'data:image/png;base64,AAAA', mediaType: 'image/png' }]);
  assert.deepEqual(log.unknown, []);
  assert.doesNotMatch(JSON.stringify(thread.get('m')), /base64/);
});

/* ------------------------------------------------------------------ sources and files -- */

test('a source keeps a link only when it is https', () => {
  const { thread, play } = connect();
  play([
    { type: 'start', messageId: 'm' },
    { type: 'source-url', sourceId: 'a', url: 'https://bank.example/terms' },
    { type: 'source-url', sourceId: 'b', url: 'http://bank.example/terms', title: 'Terms' },
    { type: 'source-url', sourceId: 'c', url: 'javascript:alert(1)', title: 'Click' },
    { type: 'source-url', sourceId: 'd', url: 'data:text/html,hi', title: 'Data' }
  ]);
  const { sources } = /** @type {any} */ (thread.get('m'));
  assert.deepEqual(sources[0], { id: 'a', kind: 'web', title: 'bank.example', site: 'bank.example', href: 'https://bank.example/terms' });
  assert.deepEqual(sources.slice(1), [
    { id: 'b', kind: 'web', title: 'Terms' },
    { id: 'c', kind: 'web', title: 'Click' },
    { id: 'd', kind: 'web', title: 'Data' }
  ], 'the source stays, so [n] citations still count the same sources');
});

test('a source named twice stays one source', () => {
  const { thread, play } = connect();
  const source = { type: 'source-url', sourceId: 'a', url: 'https://bank.example/terms' };
  play([{ type: 'start', messageId: 'm' }, source, source]);
  assert.equal(/** @type {any} */ (thread.get('m')).sources.length, 1);
});

test('a file draws its name and type, never its address or content', () => {
  const { thread, play } = connect();
  play([
    { type: 'start', messageId: 'm' },
    { type: 'file', url: 'https://cdn.example/files/Q3%20report.pdf?sig=abc', mediaType: 'application/pdf' },
    { type: 'file', url: 'data:image/png;base64,AAAA', mediaType: 'image/png' }
  ]);
  const { blocks } = /** @type {any} */ (thread.get('m'));
  assert.deepEqual(blocks, [
    { type: 'figures', rows: [{ label: 'Q3 report.pdf', value: 'application/pdf' }] },
    { type: 'figures', rows: [{ label: 'File', value: 'image/png' }] }
  ]);
  assert.doesNotMatch(JSON.stringify(blocks), /cdn\.example|base64|sig=/);
});

/* ------------------------------------------------------------------ data and the rest -- */

test('data parts with an id replace the value: each delivery is the current one, with its id', () => {
  const { log, play } = connect();
  play([
    { type: 'start', messageId: 'm' },
    { type: 'data-weather', id: 'w', data: { status: 'loading' } },
    { type: 'data-weather', id: 'w', data: { status: 'done', weather: 'sunny' } },
    { type: 'data-weather', id: 'other', data: { status: 'loading' } }
  ]);
  const current = new Map(log.data.map(([name, data, id]) => [`${name}/${id}`, data]));
  assert.deepEqual(current.get('weather/w'), { status: 'done', weather: 'sunny' });
  assert.deepEqual(current.get('weather/other'), { status: 'loading' });
  assert.equal(current.size, 2);
});

test('step boundaries draw nothing', () => {
  const { thread, log, play } = connect();
  play([{ type: 'start', messageId: 'm' }, { type: 'start-step' }, { type: 'finish-step' }]);
  assert.deepEqual(thread.order(), ['m']);
  assert.deepEqual(log.unknown, []);
  assert.equal(thread.calls.filter(([name]) => name === 'patch').length, 0);
});

test('an error draws a danger notice with its text', () => {
  const { thread, play } = connect();
  play([{ type: 'start', messageId: 'm' }, { type: 'error', errorText: 'The model is overloaded' }]);
  const notice = /** @type {any} */ (thread.get(thread.order()[1]));
  assert.equal(notice.type, 'notice');
  assert.equal(notice.tone, 'danger');
  assert.equal(notice.text, 'The model is overloaded');
});

test('abort closes the answer as stopped, with its unfinished steps', () => {
  const { thread, play } = connect();
  play([
    { type: 'start', messageId: 'm' },
    { type: 'tool-input-start', toolCallId: 'a', toolName: 'one' },
    { type: 'tool-input-available', toolCallId: 'b', toolName: 'two', input: {} },
    { type: 'abort', reason: 'user cancelled' }
  ]);
  const answer = /** @type {any} */ (thread.get('m'));
  assert.equal(answer.streaming, false);
  assert.equal(answer.stopped, true);
  assert.deepEqual(answer.steps.map((step) => step.status), ['stopped', 'stopped']);
});

test('runStatus follows the run', async () => {
  const runStatus = fakeRunStatus();
  const { thread, play } = connect({ runStatus });
  const [first, second] = fixture('approval').responses;
  play(first);
  assert.deepEqual(runStatus.states, ['running', 'waiting', 'waiting']);
  await thread.decide('approve', { item: thread.get('approval:approval-reminder'), values: {} });
  play(second);
  assert.deepEqual(runStatus.states.slice(3), ['running', 'running', 'done']);
});

test('runStatus says when a run failed or was stopped', () => {
  const failed = fakeRunStatus();
  connect({ runStatus: failed }).play([{ type: 'start', messageId: 'm' }, { type: 'error', errorText: 'x' }, { type: 'finish' }]);
  assert.deepEqual(failed.states, ['running', 'failed', 'failed']);

  const reason = fakeRunStatus();
  connect({ runStatus: reason }).play([{ type: 'start', messageId: 'm' }, { type: 'finish', finishReason: 'error' }]);
  assert.deepEqual(reason.states, ['running', 'failed']);

  const stopped = fakeRunStatus();
  connect({ runStatus: stopped }).play([{ type: 'start', messageId: 'm' }, { type: 'abort' }]);
  assert.deepEqual(stopped.states, ['running', 'stopped']);
});

test('the author comes from `agent`, else from the first author who is not a person', () => {
  const { thread, play } = connect({ authors: { me: { name: 'Hanna', kind: 'person' }, finance: { name: 'Finance agent' } } });
  play([{ type: 'start', messageId: 'm' }]);
  assert.equal(/** @type {any} */ (thread.get('m')).author, 'finance');
});

/* ------------------------------------------------------------------ text -- */

test('text from before the first step survives the redraw that step causes', () => {
  const { thread, play } = connect();
  play([
    { type: 'start', messageId: 'm' },
    { type: 'text-start', id: 't' },
    { type: 'text-delta', id: 't', delta: 'Before the call.' },
    { type: 'tool-input-start', toolCallId: 'c', toolName: 'lookup' },
    { type: 'text-delta', id: 't', delta: ' After it.' }
  ]);
  assert.deepEqual(/** @type {any} */ (thread.get('m')).blocks, [{ type: 'p', text: 'Before the call. After it.' }]);
});

test('text is streamed through appendText and only one redraw ever happens', () => {
  const { thread, play } = connect();
  play(fixture('tools').responses[0]);
  assert.equal(thread.calls.filter(([name]) => name === 'appendText').length, 3);
  const withBlocks = thread.calls.filter(([name, , keys]) => name === 'patch' && keys.includes('blocks'));
  assert.equal(withBlocks.length, 1, 'blocks go along only with the first steps');
});

test('a later block starts a new paragraph, and leading space cannot hide the break', () => {
  const { thread, play } = connect();
  play([
    { type: 'start', messageId: 'm' },
    { type: 'text-start', id: 'a' },
    { type: 'text-delta', id: 'a', delta: 'One.' },
    { type: 'text-end', id: 'a' },
    { type: 'text-start', id: 'b' },
    { type: 'text-delta', id: 'b', delta: '  ' },
    { type: 'text-delta', id: 'b', delta: ' Two.' }
  ]);
  assert.deepEqual(/** @type {any} */ (thread.get('m')).blocks.map((block) => block.text), ['One.', 'Two.']);
});

/* ------------------------------------------------------------------ out of order -- */

test('an unknown part is reported and not guessed at', () => {
  const { thread, log, stream } = connect();
  const custom = { type: 'custom', kind: 'openai.compaction' };
  for (const part of [custom, { type: 'tool-approval-response', approvalId: 'a', approved: true }, { type: 'data-' }]) stream.handle(part);
  stream.handle(/** @type {any} */ (null));
  stream.handle(/** @type {any} */ ({ type: 'constructor' }));
  assert.equal(log.unknown.length, 5);
  assert.equal(log.unknown[0], custom);
  assert.deepEqual(thread.order(), []);
});

test('a text delta before its start creates the block and is reported', () => {
  const { thread, log, play } = connect();
  play([{ type: 'start', messageId: 'm' }, { type: 'text-delta', id: 't', delta: 'Early' }]);
  assert.deepEqual(/** @type {any} */ (thread.get('m')).blocks, [{ type: 'p', text: 'Early' }]);
  assert.match(log.error[0], /text-delta arrived before the text-start of block t/);
});

test('a part before any start creates the answer, and the late start joins it', () => {
  const { thread, log, play } = connect();
  play([{ type: 'text-delta', id: 't', delta: 'Early' }, { type: 'start', messageId: 'm' }, { type: 'finish' }]);
  assert.equal(thread.order().length, 1, 'one answer, not two');
  const answer = /** @type {any} */ (thread.get(thread.order()[0]));
  assert.equal(answer.streaming, false);
  assert.equal(answer.stopped, undefined);
  assert.match(log.error[0], /text-delta arrived outside a message/);
});

test('a duplicate start for a known id is ignored and reported', () => {
  const { thread, log, play } = connect();
  play([
    { type: 'start', messageId: 'm' },
    { type: 'text-start', id: 't' },
    { type: 'text-delta', id: 't', delta: 'Kept' },
    { type: 'start', messageId: 'm' },
    { type: 'text-start', id: 't' }
  ]);
  assert.deepEqual(/** @type {any} */ (thread.get('m')).blocks, [{ type: 'p', text: 'Kept' }]);
  assert.deepEqual(log.error, ['Duplicate start for message m', 'Duplicate text-start for block t']);
});

test('a start for a finished message resumes it, and is not a duplicate', () => {
  const { thread, log, play } = connect();
  play([
    { type: 'start', messageId: 'm' },
    { type: 'text-start', id: 'a' },
    { type: 'text-delta', id: 'a', delta: 'First.' },
    { type: 'text-end', id: 'a' },
    { type: 'finish' },
    { type: 'start', messageId: 'm' }
  ]);
  assert.equal(/** @type {any} */ (thread.get('m')).streaming, true);
  play([
    { type: 'text-start', id: 'b' },
    { type: 'text-delta', id: 'b', delta: 'Second.' },
    { type: 'text-end', id: 'b' },
    { type: 'finish' }
  ]);
  assert.deepEqual(thread.order(), ['m'], 'nothing stands below it, so it goes on in the same answer');
  assert.deepEqual(/** @type {any} */ (thread.get('m')).blocks.map((block) => block.text), ['First.', 'Second.']);
  assert.deepEqual(log.error, []);
});

test('a start for a stopped message resumes it too', () => {
  const { thread, log, play } = connect();
  play([{ type: 'start', messageId: 'm' }, { type: 'abort' }, { type: 'start', messageId: 'm' }]);
  const answer = /** @type {any} */ (thread.get('m'));
  assert.equal(answer.stopped, false);
  assert.equal(answer.streaming, true);
  assert.deepEqual(log.error, []);
});

test('a start without a message id opens a new answer, and a call of the earlier one still finds its step', () => {
  const { thread, log, play } = connect();
  play([
    { type: 'start' },
    { type: 'tool-input-available', toolCallId: 'c', toolName: 'lookup', input: {} },
    { type: 'finish', finishReason: 'tool-calls' },
    { type: 'start' },
    { type: 'tool-output-available', toolCallId: 'c', output: 'kept' },
    { type: 'finish' }
  ]);
  const [first, second, ...rest] = thread.order();
  assert.deepEqual(rest, []);
  assert.equal(/** @type {any} */ (thread.get(first)).steps[0].status, 'done');
  assert.equal(/** @type {any} */ (thread.get(second)).steps, undefined);
  assert.deepEqual(log.error, []);
});

test('a block id is free again once its block has ended, and the next block is its own paragraph', () => {
  const { thread, log, play } = connect();
  play([
    { type: 'start', messageId: 'm' },
    { type: 'start-step' }, ...said('0', 'One.'), { type: 'finish-step' },
    { type: 'start-step' }, ...said('0', 'Two.'), { type: 'finish-step' },
    { type: 'finish' }
  ]);
  assert.deepEqual(/** @type {any} */ (thread.get('m')).blocks.map((block) => block.text), ['One.', 'Two.']);
  assert.deepEqual(log.error, []);
});

test('a block left open when its message ends does not hold its id into the next response', () => {
  const { thread, log, play } = connect();
  play([
    { type: 'start', messageId: 'm' },
    { type: 'text-start', id: '0' },
    { type: 'text-delta', id: '0', delta: 'One.' },
    { type: 'finish' },
    { type: 'start', messageId: 'm' },
    ...said('0', 'Two.'),
    { type: 'finish' }
  ]);
  assert.deepEqual(/** @type {any} */ (thread.get('m')).blocks.map((block) => block.text), ['One.', 'Two.']);
  assert.deepEqual(log.error, []);
});

test('a block ended is closed: its late delta and second end are reported', () => {
  const { thread, log, play } = connect();
  play([
    { type: 'start', messageId: 'm' },
    ...said('t', 'One.'),
    { type: 'text-delta', id: 't', delta: 'Late.' },
    { type: 'text-end', id: 't' },
    { type: 'text-end', id: 't' }
  ]);
  assert.deepEqual(/** @type {any} */ (thread.get('m')).blocks.map((block) => block.text), ['One.', 'Late.'], 'what it carries is still drawn');
  assert.deepEqual(log.error, [
    'text-delta arrived before the text-start of block t',
    'text-end arrived before the text-start of block t'
  ]);
});

test('tool and reasoning parts out of order create their step and are reported', () => {
  const { thread, log, play } = connect();
  play([
    { type: 'start', messageId: 'm' },
    { type: 'tool-input-delta', toolCallId: 'a', inputTextDelta: '{' },
    { type: 'tool-output-available', toolCallId: 'b', output: 'x' },
    { type: 'tool-approval-request', toolCallId: 'c', approvalId: 'p' },
    { type: 'reasoning-delta', id: 'r', delta: 'x' },
    { type: 'tool-input-start', toolCallId: 'a', toolName: 'dup' },
    { type: 'reasoning-end', id: 'nothing' },
    { type: 'text-end', id: 'nothing' }
  ]);
  assert.deepEqual(/** @type {any} */ (thread.get('m')).steps.map((step) => step.id), ['a', 'b', 'c', 'think:m']);
  assert.equal(log.error.length, 7);
});

test('a call that was never streamed may start at its available part', () => {
  const { log, play } = connect();
  play([{ type: 'start', messageId: 'm' }, { type: 'tool-input-available', toolCallId: 'a', toolName: 'one', input: {} }]);
  assert.deepEqual(log.error, []);
});

test('a start while another message is open stops that one, which nothing else can finish', () => {
  const { thread, log, play } = connect();
  play([{ type: 'start', messageId: 'a' }, { type: 'start', messageId: 'b' }]);
  assert.equal(/** @type {any} */ (thread.get('a')).stopped, true);
  assert.equal(/** @type {any} */ (thread.get('b')).streaming, true);
  assert.equal(log.error.length, 1);
});

test('a start without a message id still opens an answer', () => {
  const { thread, play } = connect();
  play([{ type: 'start' }]);
  assert.equal(thread.order().length, 1);
});

/* ------------------------------------------------------------------ tool steps -- */

test('the input stays out of the step until it is complete', () => {
  const { thread, play } = connect();
  const parts = fixture('approval').responses[0];
  play(parts.slice(0, parts.findIndex((part) => part.type === 'tool-input-available')));
  const step = /** @type {any} */ (thread.get('msg-reminder')).steps[0];
  assert.equal(step.status, 'queued');
  assert.equal(step.args, undefined);
  play([parts.find((part) => part.type === 'tool-input-available')]);
  const running = /** @type {any} */ (thread.get('msg-reminder')).steps[0];
  assert.equal(running.status, 'running');
  assert.equal(running.args, '{"customer":"Bruckner Logistik","invoice":"RE-2026-0126"}');
});

test('errors fail the step and a preliminary output leaves it running', () => {
  const { thread, play } = connect();
  play([
    { type: 'start', messageId: 'm' },
    { type: 'tool-input-available', toolCallId: 'a', toolName: 'one', input: {} },
    { type: 'tool-output-available', toolCallId: 'a', output: 'partial', preliminary: true },
    { type: 'tool-input-error', toolCallId: 'b', toolName: 'two', input: 'nope', errorText: 'Invalid input' },
    { type: 'tool-input-available', toolCallId: 'c', toolName: 'three', input: {} },
    { type: 'tool-output-error', toolCallId: 'c', errorText: 'Timed out' }
  ]);
  const [one, two, three] = /** @type {any} */ (thread.get('m')).steps;
  assert.equal(one.status, 'running');
  assert.equal(one.result, undefined);
  assert.equal(two.status, 'failed');
  assert.equal(two.error, 'Invalid input');
  assert.equal(three.status, 'failed');
  assert.equal(three.error, 'Timed out');
});

/* ------------------------------------------------------------------ tiles -- */

/** @param {any} seen @returns {(call: any) => any} */
function tile(seen) {
  return (call) => {
    seen.push(call);
    return call.status === 'queued' ? null : { type: 'record-card', id: 'chosen-by-the-model', title: call.status };
  };
}

test('a tile is inserted on its first result, patched at each status, and keeps its id', () => {
  const seen = [];
  const { thread, play } = connect({ agent: 'finance', tools: { lookup: tile(seen) } });
  play([
    { type: 'start', messageId: 'm' },
    { type: 'tool-input-start', toolCallId: 'c', toolName: 'lookup' },
    { type: 'tool-input-delta', toolCallId: 'c', inputTextDelta: '{"id":' },
    { type: 'tool-input-delta', toolCallId: 'c', inputTextDelta: '7}' }
  ]);
  assert.deepEqual(seen.map((call) => call.status), ['queued'], 'never called on an input delta');
  assert.equal(seen[0].args, null);
  assert.deepEqual(thread.order(), ['m'], 'null draws nothing');

  play([{ type: 'tool-input-available', toolCallId: 'c', toolName: 'lookup', input: { id: 7 } }]);
  assert.deepEqual(thread.order(), ['m', 'tool:c']);
  assert.deepEqual(thread.items.get('tool:c'), { author: 'finance', type: 'record-card', id: 'tool:c', title: 'running' });
  assert.deepEqual(seen.at(-1), { id: 'c', name: 'lookup', args: { id: 7 }, argsText: '{"id":7}', status: 'running' });

  play([{ type: 'tool-output-available', toolCallId: 'c', output: { name: 'Helios' } }]);
  assert.deepEqual(thread.order(), ['m', 'tool:c'], 'patched in place');
  assert.equal(thread.items.get('tool:c').title, 'done');
  assert.equal(thread.items.get('tool:c').id, 'tool:c');
  assert.deepEqual(seen.at(-1).result, { name: 'Helios' });
  assert.deepEqual(/** @type {any} */ (thread.get('m')).steps[0].refs, [{ id: 'tool:c', label: 'Show lookup', entity: 'tool' }]);
});

test('a thrown renderer is reported and the step stays', () => {
  const { thread, log, play } = connect({ tools: { lookup: () => { throw new Error('No card for you'); } } });
  play([
    { type: 'start', messageId: 'm' },
    { type: 'tool-input-available', toolCallId: 'c', toolName: 'lookup', input: {} }
  ]);
  assert.ok(log.error.includes('No card for you'));
  assert.deepEqual(thread.order(), ['m']);
  const step = /** @type {any} */ (thread.get('m')).steps[0];
  assert.equal(step.status, 'running');
  assert.equal(step.refs, undefined);
});

test('a renderer that returns no item is reported', () => {
  const { thread, log, play } = connect({ tools: { lookup: () => /** @type {any} */ ('card') } });
  play([{ type: 'start', messageId: 'm' }, { type: 'tool-input-start', toolCallId: 'c', toolName: 'lookup' }]);
  assert.deepEqual(thread.order(), ['m']);
  assert.match(log.error[0], /not a thread item/);
});

test('a tool name from the stream cannot reach an inherited property', () => {
  const { thread, log, play } = connect({ tools: {} });
  play([{ type: 'start', messageId: 'm' }, { type: 'tool-input-start', toolCallId: 'c', toolName: 'constructor' }]);
  assert.deepEqual(thread.order(), ['m']);
  assert.deepEqual(log.error, []);
});

test('the step’s link opens the tile, and no other link is touched', () => {
  const { thread, play } = connect({ tools: { lookup: tile([]) } });
  play([{ type: 'start', messageId: 'm' }, { type: 'tool-input-available', toolCallId: 'c', toolName: 'lookup', input: {} }]);
  thread.dispatchEvent(new CustomEvent('open', { detail: { ref: { id: 'tool:c' } } }));
  thread.dispatchEvent(new CustomEvent('open', { detail: { ref: { id: 'task-12' } } }));
  assert.deepEqual(thread.revealed, ['item:tool:c']);
});

test('a tile follows the card that holds its call', () => {
  const { thread, play } = connect({ tools: { sendReminder: tile([]) } });
  play(fixture('approval').responses[0]);
  assert.deepEqual(thread.order(), ['msg-reminder', 'approval:approval-reminder', 'tool:call-reminder']);
});

/* ------------------------------------------------------------------ stream order -- */

/** @param {string} id @param {string} [delta] @returns {any[]} A whole text block. */
const said = (id, delta = id) => [
  { type: 'text-start', id },
  { type: 'text-delta', id, delta },
  { type: 'text-end', id }
];

/** @param {string} id @param {string} [toolName] @returns {any[]} A tool call that ran. */
const ran = (id, toolName = 'lookup') => [
  { type: 'tool-input-available', toolCallId: id, toolName, input: {} },
  { type: 'tool-output-available', toolCallId: id, output: {} }
];

test('text after a tile continues below it, by the same author', () => {
  const { thread, log, play } = connect({ agent: 'finance', tools: { getWeatherInformation: tile([]) } });
  play(fixture('tools').responses[0]);
  assert.deepEqual(thread.order(), ['msg-weather', 'tool:call-hamburg', 'tool:call-vienna', 'msg-weather#2']);
  const first = /** @type {any} */ (thread.get('msg-weather'));
  const rest = /** @type {any} */ (thread.get('msg-weather#2'));
  assert.deepEqual(first.blocks.map((block) => block.text), ['I’ll check both cities.']);
  assert.deepEqual(rest.blocks.map((block) => block.text), ['It rains in Hamburg [1] and the sun is out in Vienna [2].']);
  assert.equal(rest.type, 'answer');
  assert.equal(rest.author, 'finance');
  assert.equal(first.steps.length, 2);
  assert.deepEqual(log.error, []);
});

test('every interruption opens the next answer, numbered from 2', () => {
  const { thread, play } = connect({ tools: { lookup: tile([]) } });
  play([
    { type: 'start', messageId: 'm' }, ...said('one'),
    ...ran('a'), ...said('two'),
    ...ran('b'), ...said('three'),
    { type: 'finish' }
  ]);
  assert.deepEqual(thread.order(), ['m', 'tool:a', 'm#2', 'tool:b', 'm#3']);
  for (const id of ['m', 'm#2', 'm#3']) assert.equal(/** @type {any} */ (thread.get(id)).streaming, false, `${id} stayed open`);
});

test('a file after a card goes below it too', () => {
  const { thread, play } = connect();
  play(fixture('approval').responses[0]);
  play([{ type: 'start', messageId: 'msg-reminder' }, { type: 'file', url: 'https://cdn.example/report.pdf', mediaType: 'application/pdf' }]);
  assert.deepEqual(thread.order(), ['msg-reminder', 'approval:approval-reminder', 'msg-reminder#2']);
  assert.equal(/** @type {any} */ (thread.get('msg-reminder#2')).blocks[0].type, 'figures');
});

test('only content opens a new answer: an empty block or blank text leaves none behind', () => {
  const { thread, play } = connect();
  play(fixture('approval').responses[0]);
  play([
    { type: 'start', messageId: 'msg-reminder' },
    { type: 'text-start', id: 'blank' },
    { type: 'text-delta', id: 'blank', delta: ' \n' },
    { type: 'text-end', id: 'blank' },
    { type: 'tool-output-available', toolCallId: 'call-reminder', output: {} },
    { type: 'finish' }
  ]);
  assert.deepEqual(thread.order(), ['msg-reminder', 'approval:approval-reminder']);
});

test('a block a tile cuts in two goes on below it, without its leading space or a paragraph mark', () => {
  const { thread, log, play } = connect({ tools: { lookup: tile([]) } });
  play([
    { type: 'start', messageId: 'm' },
    { type: 'text-start', id: 't' },
    { type: 'text-delta', id: 't', delta: 'Before.' },
    ...ran('c'),
    { type: 'text-delta', id: 't', delta: ' After.' },
    { type: 'text-end', id: 't' }
  ]);
  assert.deepEqual(/** @type {any} */ (thread.get('m#2')).blocks, [{ type: 'p', text: 'After.' }]);
  assert.equal(thread.text.get('m#2'), 'After.');
  assert.deepEqual(log.error, []);
});

test('a tile leaves the answer above it writing until the words move on', () => {
  const { thread, play } = connect({ tools: { lookup: tile([]) } });
  play([{ type: 'start', messageId: 'm' }, ...said('one'), ...ran('c')]);
  assert.equal(/** @type {any} */ (thread.get('m')).streaming, true, 'a tile is not the end of an answer');
  play(said('two'));
  assert.equal(/** @type {any} */ (thread.get('m')).streaming, false);
  assert.equal(/** @type {any} */ (thread.get('m#2')).streaming, true);
});

test('the answer above a card ends first, so that the card is the last thing the thread says', () => {
  const { thread, play } = connect();
  play(fixture('approval').responses[0]);
  const ended = thread.calls.findIndex(([name, id, keys]) => name === 'patch' && id === 'msg-reminder' && keys.join() === 'streaming');
  const asked = thread.calls.findIndex(([name, id]) => name === 'upsert' && id === 'approval:approval-reminder');
  assert.ok(ended >= 0 && ended < asked, 'the answer finished after the card');
});

test('text after an error notice continues below it', () => {
  const { thread, play } = connect();
  play([{ type: 'start', messageId: 'm' }, ...said('one'), { type: 'error', errorText: 'Hiccup' }, ...said('two')]);
  const [first, notice, rest] = thread.order();
  assert.equal(first, 'm');
  assert.equal(/** @type {any} */ (thread.get(notice)).type, 'notice');
  assert.equal(rest, 'm#2');
});

test('a message resumed below another answer continues below that one', () => {
  const { thread, play } = connect();
  play([
    { type: 'start', messageId: 'm' }, ...said('one'), { type: 'finish' },
    { type: 'start', messageId: 'n' }, ...said('other'), { type: 'finish' },
    { type: 'start', messageId: 'm' }
  ]);
  assert.equal(/** @type {any} */ (thread.get('m')).streaming, false, 'it stays closed until it has something to say');
  play([...said('two'), { type: 'finish' }]);
  assert.deepEqual(thread.order(), ['m', 'n', 'm#2']);
});

test('a card or tile for an earlier message holds the text of the open one back too', () => {
  const { thread, play } = connect({ tools: { lookup: tile([]) } });
  play([
    { type: 'start', messageId: 'm' }, { type: 'tool-input-start', toolCallId: 'c', toolName: 'lookup' }, { type: 'finish' },
    { type: 'start', messageId: 'n' }, ...said('one'),
    { type: 'tool-input-available', toolCallId: 'c', toolName: 'lookup', input: {} },
    ...said('two')
  ]);
  assert.deepEqual(thread.order(), ['m', 'n', 'tool:c', 'n#2']);
});

test('stopping a continued message stops the answer it was writing', () => {
  const { thread, play } = connect({ tools: { lookup: tile([]) } });
  play([{ type: 'start', messageId: 'm' }, ...said('one'), ...ran('c'), ...said('two'), { type: 'abort' }]);
  assert.equal(/** @type {any} */ (thread.get('m#2')).stopped, true);
  assert.equal(/** @type {any} */ (thread.get('m')).stopped, undefined);
});

test('the sources are listed once, under the last answer, and every answer’s citations still count them', () => {
  const { thread, play } = connect({ tools: { lookup: tile([]) } });
  const source = (id) => ({ type: 'source-url', sourceId: id, url: `https://${id}.example/` });
  play([{ type: 'start', messageId: 'm' }, ...said('one', 'One [1].'), source('a'), ...ran('c')]);
  assert.deepEqual(/** @type {any} */ (thread.get('m')).sources.map(({ id }) => id), ['a'], 'still the last answer');

  play([...said('two', 'Two [2].'), source('b'), { type: 'finish' }]);
  assert.deepEqual(/** @type {any} */ (thread.get('m')).sources, [], 'the list moved on');
  assert.deepEqual(/** @type {any} */ (thread.get('m#2')).sources.map(({ id }) => id), ['a', 'b']);
  assert.deepEqual(thread.citing.get('m').map(({ id }) => id), ['a', 'b']);
});

test('a citation above the last answer reaches the list below it, unless it is prevented', async () => {
  const { thread, stream, play } = connect({ tools: { lookup: tile([]) } });
  play([{ type: 'start', messageId: 'm' }, ...said('Above [1].'), { type: 'source-url', sourceId: 's', url: 'https://example.com/' }, ...ran('c'), ...said('Below [1].'), { type: 'finish' }]);
  /** @param {string} id @param {boolean} [prevent] */
  const cite = async (id, prevent = false) => {
    const event = new CustomEvent('cite', { detail: { item: { id }, n: 1 }, cancelable: true });
    thread.dispatchEvent(event);
    if (prevent) event.preventDefault();
    await Promise.resolve();
  };
  await cite('m', true);
  await cite('m#2');
  await cite('another');
  assert.deepEqual(thread.revealed, [], 'prevented, and neither of the others stands above a list');
  await cite('m');
  assert.deepEqual(thread.revealed, ['source:1:m#2']);
  stream.destroy();
  await cite('m');
  assert.equal(thread.revealed.length, 1);
});

/* ------------------------------------------------------------------ reset-step -- */

test('reset-step leaves nothing of the withdrawn step in the thread, and the retry stands', () => {
  const { thread, log, play } = connect();
  const [parts] = fixture('reset').responses;
  const at = parts.findIndex((part) => part.type === 'reset-step');
  play(parts.slice(0, at));
  assert.ok(thread.order().length > 2, 'the step drew a card and a notice');
  assert.match(JSON.stringify(thread.get('msg-retry')), /Withdrawn/);

  play(parts.slice(at));
  assert.deepEqual(thread.order(), ['msg-retry']);
  const answer = /** @type {any} */ (thread.get('msg-retry'));
  assert.doesNotMatch(JSON.stringify(answer), /withdrawn/i);
  assert.deepEqual(answer.blocks.map((block) => block.text), ['I’ll look the invoice up.', 'The invoice is still open [1].']);
  assert.deepEqual(answer.steps.map((step) => [step.id, step.status]), [['call-invoice', 'done']]);
  assert.deepEqual(answer.sources.map(({ id }) => id), ['source-policy']);
  assert.equal(answer.streaming, false);
  assert.deepEqual(log.error, [], 'the retry names its blocks the way the first try did');
  assert.deepEqual(log.unknown, []);
});

test('without a step boundary reset-step takes back the whole message, and its answer stays', () => {
  const { thread, play } = connect({ tools: { lookup: tile([]) } });
  play([{ type: 'start', messageId: 'm' }, ...said('gone'), ...ran('c'), ...said('gone too'), { type: 'reset-step' }]);
  assert.deepEqual(thread.order(), ['m']);
  const answer = /** @type {any} */ (thread.get('m'));
  assert.deepEqual(answer.blocks, []);
  assert.deepEqual(answer.steps, []);
  assert.equal(answer.streaming, true);
  play([...said('kept'), { type: 'finish' }]);
  assert.deepEqual(/** @type {any} */ (thread.get('m')).blocks, [{ type: 'p', text: 'kept' }]);
});

test('the step it takes back is the one since the most recent start-step, in any response', () => {
  const { thread, play } = connect();
  play([
    { type: 'start', messageId: 'm' }, { type: 'start-step' }, ...said('one'), { type: 'finish-step' },
    { type: 'start-step' }, ...said('two'), { type: 'finish-step' }, { type: 'finish' },
    { type: 'start', messageId: 'm' }, ...said('three'), { type: 'reset-step' }
  ]);
  assert.deepEqual(/** @type {any} */ (thread.get('m')).blocks.map((block) => block.text), ['one']);
  assert.equal(/** @type {any} */ (thread.get('m')).streaming, true);
});

test('a reset-step after finish-step still takes that step back', () => {
  const { thread, play } = connect();
  play([{ type: 'start', messageId: 'm' }, { type: 'start-step' }, ...said('gone'), { type: 'finish-step' }, { type: 'reset-step' }]);
  assert.deepEqual(/** @type {any} */ (thread.get('m')).blocks, []);
});

test('two reset-steps in a row, and one with nothing to take back, change nothing more', () => {
  const { thread, log, play } = connect();
  play([{ type: 'start', messageId: 'm' }, ...said('kept'), { type: 'start-step' }, { type: 'reset-step' }, ...said('gone'), { type: 'reset-step' }, { type: 'reset-step' }]);
  assert.deepEqual(/** @type {any} */ (thread.get('m')).blocks, [{ type: 'p', text: 'kept' }]);
  assert.deepEqual(log.error, []);
});

test('a reset-step outside a message is reported and draws nothing', () => {
  const { thread, log, play } = connect();
  play([{ type: 'start', messageId: 'm' }, ...said('kept'), { type: 'finish' }, { type: 'reset-step' }]);
  assert.deepEqual(log.error, ['reset-step arrived outside a message']);
  assert.deepEqual(/** @type {any} */ (thread.get('m')).blocks, [{ type: 'p', text: 'kept' }]);
  assert.deepEqual(thread.order(), ['m']);
});

test('a text block goes on in the answer it stood in, with the same paragraph break after a retry', () => {
  const { thread, play } = connect();
  play([
    { type: 'start', messageId: 'm' }, { type: 'start-step' }, ...said('one', 'One.'), { type: 'finish-step' },
    { type: 'start-step' }, ...said('two', 'Withdrawn.'), { type: 'reset-step' }, ...said('two', 'Two.'), { type: 'finish' }
  ]);
  assert.deepEqual(/** @type {any} */ (thread.get('m')).blocks.map((block) => block.text), ['One.', 'Two.']);
});

test('reset-step takes back a piece the step opened and writes on where the step began', () => {
  const { thread, play } = connect({ tools: { lookup: tile([]) } });
  play([
    { type: 'start', messageId: 'm' }, { type: 'start-step' }, ...said('kept'),
    { type: 'finish-step' }, { type: 'start-step' },
    ...said('gone above'), ...ran('c'), ...said('gone below'),
    { type: 'reset-step' }, ...said('retry'), { type: 'finish' }
  ]);
  assert.deepEqual(thread.order(), ['m'], 'the tile and the piece went');
  assert.deepEqual(/** @type {any} */ (thread.get('m')).blocks.map((block) => block.text), ['kept', 'retry']);
  assert.equal(/** @type {any} */ (thread.get('m')).streaming, false);
  assert.deepEqual(/** @type {any} */ (thread.get('m')).steps, []);
});

test('a piece an earlier step opened stands, and the numbering goes on from it', () => {
  const { thread, play } = connect({ tools: { lookup: tile([]) } });
  play([
    { type: 'start', messageId: 'm' }, { type: 'start-step' }, ...said('one'), ...ran('a'), ...said('two'),
    { type: 'finish-step' }, { type: 'start-step' },
    ...ran('b'), ...said('gone'),
    { type: 'reset-step' }, ...ran('b'), ...said('three'), { type: 'finish' }
  ]);
  assert.deepEqual(thread.order(), ['m', 'tool:a', 'm#2', 'tool:b', 'm#3'], 'the same ids, not a gap');
  assert.deepEqual(/** @type {any} */ (thread.get('m#2')).blocks, [{ type: 'p', text: 'two' }]);
  assert.deepEqual(/** @type {any} */ (thread.get('m#3')).blocks, [{ type: 'p', text: 'three' }]);
});

test('an earlier step’s text below a tile stays below it after a retry', () => {
  const { thread, play } = connect({ tools: { lookup: tile([]) } });
  play([
    { type: 'start', messageId: 'm' }, { type: 'start-step' }, ...said('one'), ...ran('a'),
    { type: 'finish-step' }, { type: 'start-step' }, { type: 'reset-step' }, ...said('two'), { type: 'finish' }
  ]);
  assert.deepEqual(thread.order(), ['m', 'tool:a', 'm#2'], 'the tile from before still stands below the first answer');
});

test('a call from an earlier step keeps what the withdrawn step did to it', () => {
  const { thread, play } = connect();
  play([
    { type: 'start', messageId: 'm' }, { type: 'start-step' },
    { type: 'tool-input-available', toolCallId: 'c', toolName: 'lookup', input: {} },
    { type: 'finish-step' }, { type: 'start-step' },
    { type: 'tool-output-available', toolCallId: 'c', output: 'kept' },
    { type: 'reset-step' }
  ]);
  const [step] = /** @type {any} */ (thread.get('m')).steps;
  assert.equal(step.status, 'done', 'a part of an earlier step stays as it is on the protocol’s own client');
  assert.equal(step.result, 'kept');
});

test('a tile first drawn for an earlier call in the withdrawn step stays', () => {
  const { thread, play } = connect({ tools: { lookup: (call) => (call.status === 'done' ? { type: 'record-card' } : null) } });
  play([
    { type: 'start', messageId: 'm' }, { type: 'start-step' }, ...said('one'),
    { type: 'tool-input-available', toolCallId: 'c', toolName: 'lookup', input: {} },
    { type: 'finish-step' }, { type: 'start-step' },
    { type: 'tool-output-available', toolCallId: 'c', output: {} },
    { type: 'reset-step' }, ...said('two')
  ]);
  assert.deepEqual(thread.order(), ['m', 'tool:c', 'm#2'], 'the text still lands below it');
});

test('a part for a withdrawn call is reported, and the link to its tile is gone', () => {
  const { thread, log, play } = connect({ tools: { lookup: tile([]) } });
  play([{ type: 'start', messageId: 'm' }, { type: 'start-step' }, ...ran('c'), { type: 'reset-step' }]);
  thread.dispatchEvent(new CustomEvent('open', { detail: { ref: { id: 'tool:c' } } }));
  assert.deepEqual(thread.revealed, []);
  play([{ type: 'tool-output-available', toolCallId: 'c', output: {} }]);
  assert.match(log.error[0], /before the start of tool call c/);
});

test('a retried step may reuse the ids of the one it replaces', () => {
  const step = [
    { type: 'reasoning-start', id: 'r' },
    { type: 'reasoning-end', id: 'r' },
    ...said('t'),
    { type: 'tool-input-start', toolCallId: 'c', toolName: 'lookup' },
    { type: 'tool-input-available', toolCallId: 'c', toolName: 'lookup', input: {} },
    { type: 'tool-approval-request', toolCallId: 'c', approvalId: 'a' }
  ];
  const { thread, log, play } = connect();
  play([{ type: 'start', messageId: 'm' }, { type: 'start-step' }, ...step, { type: 'reset-step' }, ...step]);
  assert.deepEqual(log.error, []);
  assert.deepEqual(thread.order(), ['m', 'approval:a']);
  assert.equal(/** @type {any} */ (thread.get('approval:a')).status, 'pending');
});

test('a withdrawn card decides nothing, also when the decision is already on its way', async () => {
  const { thread, log, play } = connect();
  const parts = [
    { type: 'start', messageId: 'm' }, { type: 'start-step' },
    { type: 'tool-input-available', toolCallId: 'c', toolName: 'lookup', input: {} },
    { type: 'tool-approval-request', toolCallId: 'c', approvalId: 'a' }
  ];
  play(parts);
  const card = thread.get('approval:a');
  thread.dispatchEvent(new CustomEvent('approve', { detail: { item: card, values: {} }, cancelable: true }));
  play([{ type: 'reset-step' }]);
  await Promise.resolve();
  assert.deepEqual(log.approval, []);
  assert.equal(thread.get('approval:a'), null);

  await thread.decide('approve', { item: card, values: {} });
  assert.deepEqual(log.approval, [], 'nothing is listening for it any more');
});

test('runStatus goes back to running when the card or the error it was reporting is withdrawn', () => {
  const runStatus = fakeRunStatus();
  const { play } = connect({ runStatus });
  play([
    { type: 'start', messageId: 'm' }, { type: 'start-step' },
    { type: 'tool-input-available', toolCallId: 'c', toolName: 'lookup', input: {} },
    { type: 'tool-approval-request', toolCallId: 'c', approvalId: 'a' },
    { type: 'reset-step' }
  ]);
  assert.equal(runStatus.states.at(-1), 'running');
  play([{ type: 'error', errorText: 'Overloaded' }, { type: 'reset-step' }, { type: 'finish' }]);
  assert.equal(runStatus.states.at(-1), 'done', 'a failure the server took back is not a failed run');
});

test('runStatus keeps waiting for a card an earlier step put up', () => {
  const runStatus = fakeRunStatus();
  const { thread, play } = connect({ runStatus });
  play([
    { type: 'start', messageId: 'm' }, { type: 'start-step' },
    { type: 'tool-input-available', toolCallId: 'c', toolName: 'lookup', input: {} },
    { type: 'tool-approval-request', toolCallId: 'c', approvalId: 'a' },
    { type: 'finish-step' }, { type: 'start-step' }, ...said('gone'), { type: 'reset-step' }
  ]);
  assert.equal(runStatus.states.at(-1), 'waiting');
  assert.equal(/** @type {any} */ (thread.get('approval:a')).status, 'pending');
});

test('reasoning from before the step stays, without the time or text of the withdrawn stretch', (context) => {
  context.mock.timers.enable({ apis: ['Date'], now: 0 });
  const { thread, play } = connect({ showReasoning: true });
  const think = (id, delta) => [
    { type: 'reasoning-start', id },
    { type: 'reasoning-delta', id, delta }
  ];
  play([{ type: 'start', messageId: 'm' }, { type: 'start-step' }, ...think('r', 'Kept thought.')]);
  context.mock.timers.tick(2_000);
  play([{ type: 'reasoning-end', id: 'r' }, { type: 'finish-step' }, { type: 'start-step' }, ...think('s', 'Withdrawn thought.')]);
  context.mock.timers.tick(30_000);
  play([{ type: 'reasoning-end', id: 's' }, { type: 'reset-step' }]);

  const [step, ...rest] = /** @type {any} */ (thread.get('m')).steps;
  assert.deepEqual(rest, []);
  assert.equal(step.status, 'done');
  assert.equal(step.label, 'Thought for 2.0 s');
  assert.equal(step.detail, 'Kept thought.');
});

test('reasoning that only the withdrawn step did goes altogether, and the next starts its own step', () => {
  const { thread, log, play } = connect();
  play([...REASONING, { type: 'reset-step' }]);
  assert.deepEqual(/** @type {any} */ (thread.get('m')).steps, []);
  play([{ type: 'reasoning-start', id: 'r' }, { type: 'reasoning-end', id: 'r' }]);
  assert.equal(/** @type {any} */ (thread.get('m')).steps.length, 1);
  assert.deepEqual(log.error, []);
});

test('text from before the first step survives a withdrawn step and the redraw of the next one', () => {
  const { thread, play } = connect();
  play([
    { type: 'start', messageId: 'm' }, ...said('kept'), { type: 'start-step' },
    { type: 'tool-input-start', toolCallId: 'c', toolName: 'one' },
    { type: 'reset-step' },
    { type: 'tool-input-start', toolCallId: 'd', toolName: 'two' }
  ]);
  const answer = /** @type {any} */ (thread.get('m'));
  assert.deepEqual(answer.blocks, [{ type: 'p', text: 'kept' }]);
  assert.deepEqual(answer.steps.map((step) => step.id), ['d']);
});

test('a file the step drew goes with it, one from before stays', () => {
  const { thread, play } = connect();
  const file = (name) => ({ type: 'file', url: `https://cdn.example/${name}.pdf`, mediaType: 'application/pdf' });
  play([{ type: 'start', messageId: 'm' }, file('kept'), { type: 'start-step' }, file('gone'), { type: 'reset-step' }]);
  assert.deepEqual(/** @type {any} */ (thread.get('m')).blocks.map((block) => block.rows[0].label), ['kept.pdf']);
});

test('sources from before the step stay, and the numbering goes on from them', () => {
  const { thread, play } = connect();
  const source = (id) => ({ type: 'source-url', sourceId: id, url: `https://${id}.example/` });
  play([{ type: 'start', messageId: 'm' }, source('a'), { type: 'start-step' }, source('b'), { type: 'reset-step' }, source('c')]);
  assert.deepEqual(/** @type {any} */ (thread.get('m')).sources.map(({ id }) => id), ['a', 'c']);
});

test('data already delivered is the application’s: reset-step draws back what is on screen only', () => {
  const { log, play } = connect();
  play([{ type: 'start', messageId: 'm' }, { type: 'start-step' }, { type: 'data-note', data: 1 }, { type: 'reset-step' }]);
  assert.deepEqual(log.data, [['note', 1, undefined]]);
  assert.deepEqual(log.unknown, []);
});

/* ------------------------------------------------------------------ destroy -- */

test('destroy stops listening, stops what is open, and expires what nobody can answer', async () => {
  const { thread, log, stream, play } = connect();
  play(fixture('approval').responses[0]);
  play([{ type: 'start', messageId: 'next' }]);
  const card = thread.get('approval:approval-reminder');
  stream.destroy();
  stream.destroy();

  assert.equal(/** @type {any} */ (thread.get('approval:approval-reminder')).status, 'expired');
  assert.equal(/** @type {any} */ (thread.get('next')).stopped, true);
  assert.equal(/** @type {any} */ (thread.get('msg-reminder')).steps[0].status, 'stopped');

  await thread.decide('approve', { item: card, values: {} });
  assert.deepEqual(log.approval, []);
  const before = thread.order();
  stream.handle({ type: 'start', messageId: 'after' });
  assert.deepEqual(thread.order(), before);
});

test('a finished conversation leaves destroy nothing to change', () => {
  const { thread, stream, play } = connect();
  play(fixture('tools').responses[0]);
  const before = thread.calls.length;
  stream.destroy();
  assert.equal(thread.calls.length, before);
});
