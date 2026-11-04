// @ts-check
import { uid } from '../../core/util.js';
import { formatDuration } from '../../internal/agent-model.js';
import { sourceHost, sourceHref } from '../source-list/source-list.js';

/** @typedef {import('./agent-thread.js').AgentThread} AgentThread */
/** @typedef {import('../run-status/run-status.js').RunStatus} RunStatus */
/** @typedef {import('../../internal/agent-model.js').Author} Author */
/** @typedef {import('../../internal/agent-model.js').RunState} RunState */
/** @typedef {import('../../internal/agent-model.js').Source} Source */
/** @typedef {import('../../internal/agent-model.js').ThreadItem} ThreadItem */
/** @typedef {import('../../internal/agent-model.js').TraceStep} TraceStep */

/**
 * The version of the UI message stream this adapter implements: the value of the response header
 * `x-vercel-ai-ui-message-stream`.
 */
export const UI_MESSAGE_STREAM_VERSION = 'v1';

/**
 * One parsed part of the stream: the JSON of an event, without its `data: ` framing. The `[DONE]`
 * sentinel is the transport's and never reaches the adapter.
 * @typedef {{type: string, [key: string]: any}} UiMessagePart
 */

/**
 * A tool call as a tile renderer receives it: a copy, so a renderer changes nothing by holding on
 * to it.
 * @typedef {Object} ToolCall
 * @property {string} id The tool call id.
 * @property {string} name The tool's name.
 * @property {unknown} args The input once it is complete; `null` before.
 * @property {string} argsText The input as text; empty until it is complete when it was not
 * streamed.
 * @property {unknown} [result] What the tool returned.
 * @property {string} [error] Why the call failed.
 * @property {RunState} status `queued` while the input arrives, `waiting` for an approval, `running`
 * until the result, then `done`, `failed`, `skipped` when it was denied, or `stopped`.
 */

/**
 * @typedef {Object} UiMessageStreamOptions
 * @property {RunStatus|null} [runStatus=null] A run status to keep up to date.
 * @property {Record<string, Author>} [authors={}] Who writes; its first author who is not a person
 * is the agent when `agent` is not given.
 * @property {string|null} [agent=null] Author key of the assistant's output.
 * @property {Record<string, (call: ToolCall) => ThreadItem|null>} [tools={}] Tiles by tool name: the
 * application's renderer for a tool's calls, called at each status change. Its item joins the
 * thread as `tool:<toolCallId>`, and the call's step links to it.
 * @property {(approvalId: string, approved: boolean, reason?: string) => void} [onapproval] The
 * person decided. The application sends the answer with its next request.
 * @property {(name: string, data: unknown, id?: string) => void} [ondata] A `data-<name>` part. With
 * an `id` it replaces the earlier value of that name and id.
 * @property {(metadata: unknown) => void} [onmetadata] Metadata of the message.
 * @property {(part: UiMessagePart) => void} [onunknown] A part the adapter does not draw.
 * @property {(error: Error) => void} [onerror] A part out of order, or a tile that failed.
 * @property {boolean} [showReasoning=false] Shows the model's reasoning text. Without it the text
 * is not kept, and the reasoning is one step that says how long it took.
 */

/**
 * @typedef {Object} UiMessageStreamConnection
 * @property {(part: UiMessagePart) => void} handle Takes the next part of the stream.
 * @property {() => void} destroy Stops listening. An answer still open is stopped and a pending
 * approval expires, because no decision could reach the application any more.
 */

/**
 * @typedef {Object} MessageState
 * @property {string} id The answer's item id.
 * @property {TraceStep[]} steps The answer's steps.
 * @property {Source[]} sources The answer's sources.
 * @property {Set<unknown>} texts Text blocks seen.
 * @property {boolean} hasText Whether the answer ends in text a new block has to be set apart from.
 * @property {boolean} gap Whether the next text starts a new paragraph.
 * @property {boolean} drawn Whether the answer has steps on screen.
 * @property {boolean} failed Whether the run reported an error.
 * @property {boolean} closed Whether it finished or was stopped.
 * @property {boolean} implied Whether a part created it before its `start` arrived.
 * @property {ThinkingState|null} thinking Its reasoning.
 */

/**
 * @typedef {Object} ThinkingState
 * @property {TraceStep} step The one step all the message's reasoning shares.
 * @property {Set<unknown>} open Reasoning blocks not ended yet.
 * @property {number|null} since When the running stretch began.
 * @property {number} ms Time spent in finished stretches.
 * @property {string} text The reasoning text; only with `showReasoning`.
 */

/**
 * @typedef {Object} CallState
 * @property {string} id The tool call id.
 * @property {string} name The tool's name.
 * @property {MessageState} message The message it belongs to, also from a later response.
 * @property {RunState} status Where it stands.
 * @property {unknown} args The complete input.
 * @property {string} argsText The input text so far.
 * @property {unknown} [result] The output.
 * @property {string} [error] The error text.
 * @property {number|null} since When it began running.
 * @property {TraceStep} step Its step.
 * @property {string|null} tile The tile's item id, once drawn.
 */

/**
 * @typedef {Object} ApprovalState
 * @property {string} id The approval id.
 * @property {CallState} call The call it holds.
 * @property {boolean} settled Whether nothing can be decided any more.
 */

/** @param {unknown} value @returns {string} A tool's input or output as text. */
function asText(value) {
  if (value === undefined) return '';
  return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
}

/**
 * The name of a file part: its own, or the last segment of an `http(s)` address. The address is
 * only read, never loaded, and a `data:` address has no name to give.
 * @param {UiMessagePart} part
 * @returns {string}
 */
function fileName(part) {
  if (typeof part.filename === 'string' && part.filename.trim()) return part.filename.trim();
  try {
    const url = new URL(String(part.url));
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return '';
    return decodeURIComponent(url.pathname.split('/').filter(Boolean).at(-1) ?? '');
  } catch {
    return '';
  }
}

/**
 * The source a `source-url` or `source-document` part stands for. A link is kept only when it is
 * `https:` and passes `safeHref()`; without one the source stays, so `[n]` citations keep counting
 * the same sources, and it opens nothing.
 * @param {UiMessagePart} part
 * @returns {Source}
 */
function sourceOf(part) {
  const id = String(part.sourceId);
  const title = typeof part.title === 'string' ? part.title.trim() : '';
  if (part.type === 'source-document') {
    const name = String(part.filename || part.mediaType || '');
    return { id, kind: 'file', title: title || name, site: name };
  }
  const link = { id, title, kind: /** @type {const} */ ('web'), href: part.url };
  const href = sourceHref(link);
  if (!href) return { id, kind: 'web', title: title || String(part.url ?? '') };
  const site = /** @type {string} */ (sourceHost(link));
  return { id, kind: 'web', title: title || site, site, href };
}

/**
 * Draws an AI SDK UI message stream in an AgentThread: text, reasoning, tool calls and their
 * approvals, sources, and files. The application owns the request, the event source, retries, and
 * authentication; it strips the `data: ` framing and the `[DONE]` sentinel and hands each parsed
 * part to `handle()`, so the adapter runs with any transport and without a network.
 *
 * Keep one connection for the whole conversation: an approval's answer goes out with the
 * application's next request, and the response to it continues the same message.
 *
 * Model output is data. Nothing is approved without the person, reasoning text stays out of the
 * page unless asked for, a source only ever links to `https:`, and no address is fetched to draw
 * anything: a file part shows its name and type, never its content.
 *
 * @param {AgentThread} thread The thread to draw in.
 * @param {UiMessageStreamOptions} [options]
 * @returns {UiMessageStreamConnection}
 */
export function connectUiMessageStream(thread, options = {}) {
  const runStatus = options.runStatus ?? null;
  const tools = options.tools ?? {};
  const showReasoning = options.showReasoning === true;
  const agent = options.agent
    ?? Object.entries(options.authors ?? {}).find(([, author]) => author?.kind !== 'person')?.[0];
  const byline = agent ? { author: agent } : {};

  /** @type {Map<string, MessageState>} */
  const messages = new Map();
  /** @type {Map<string, CallState>} */
  const calls = new Map();
  /** @type {Map<string, ApprovalState>} By thread item id. */
  const approvals = new Map();
  /** @type {Set<string>} */
  const tiles = new Set();
  /** @type {MessageState|null} */
  let current = null;
  let destroyed = false;

  /**
   * @param {string} message
   * @param {UiMessagePart} part
   * @returns {void}
   */
  const report = (message, part) => {
    options.onerror?.(Object.assign(new Error(message), { part }));
  };

  /** @param {UiMessagePart} part @returns {void} */
  const sendMetadata = (part) => {
    if (part.messageMetadata !== undefined) options.onmetadata?.(part.messageMetadata);
  };

  /** @returns {boolean} Whether an approval is still waiting for the person. */
  const waitingForPerson = () => [...approvals.values()].some((approval) => !approval.settled);

  /* ------------------------------------------------------------------ messages -- */

  /**
   * @param {string} id
   * @param {boolean} [implied]
   * @returns {MessageState}
   */
  function openMessage(id, implied = false) {
    /** @type {MessageState} */
    const message = {
      id, steps: [], sources: [], texts: new Set(), hasText: false, gap: false, drawn: false,
      failed: false, closed: false, implied, thinking: null
    };
    messages.set(id, message);
    current = message;
    thread.upsert({ id, type: 'answer', ...byline, blocks: [], streaming: true });
    return message;
  }

  /**
   * The message a part belongs to. A part that arrives outside any message opens one, so what it
   * carries is still drawn.
   * @param {UiMessagePart} part
   * @returns {MessageState}
   */
  function activeMessage(part) {
    if (current) return current;
    report(`${part.type} arrived outside a message`, part);
    return openMessage(uid('zx-ui-message'), true);
  }

  /**
   * Hands the thread a message's steps. An answer without steps has no trace to update in place,
   * so its first steps redraw it, and the redraw has to carry the text streamed so far.
   * @param {MessageState} message
   * @returns {void}
   */
  function drawSteps(message) {
    /** @type {Record<string, unknown>} */
    const partial = { steps: message.steps };
    if (!message.drawn) partial.blocks = /** @type {{blocks?: unknown[]}|null} */ (thread.get(message.id))?.blocks ?? [];
    message.drawn = true;
    thread.patch(message.id, partial);
  }

  /**
   * @param {MessageState} message
   * @param {Record<string, unknown>} partial
   * @returns {void}
   */
  function closeMessage(message, partial) {
    endThinking(message);
    message.closed = true;
    if (current === message) current = null;
    thread.patch(message.id, partial);
  }

  /** @param {MessageState} message @returns {void} */
  function stopMessage(message) {
    for (const call of calls.values()) {
      if (call.message === message && (call.status === 'queued' || call.status === 'running')) finishCall(call, 'stopped');
    }
    closeMessage(message, { streaming: false, stopped: true });
  }

  /**
   * The response to an approval or a tool's output continues the message it belongs to.
   * @param {MessageState} message
   * @returns {void}
   */
  function resumeMessage(message) {
    message.closed = false;
    message.failed = false;
    current = message;
    const item = thread.get(message.id);
    if (item) thread.upsert({ .../** @type {any} */ (item), streaming: true, stopped: false });
  }

  /** @param {UiMessagePart} part @returns {void} */
  function onStart(part) {
    const id = part.messageId == null ? null : String(part.messageId);
    const known = id ? messages.get(id) : undefined;
    if (current?.implied) {
      // The parts that came ahead of this start already opened the answer.
      current.implied = false;
      if (id) messages.set(id, current);
    } else if (known && !known.closed) {
      report(`Duplicate start for message ${id}`, part);
      return;
    } else {
      if (current) {
        report(`start arrived while message ${current.id} was still open`, part);
        stopMessage(current);
      }
      if (known) resumeMessage(known);
      else openMessage(id ?? uid('zx-ui-message'));
    }
    runStatus?.update({ state: 'running', finished: null, waitingSince: null, ...(known ? {} : { started: new Date() }) });
    sendMetadata(part);
  }

  /** @param {UiMessagePart} part @returns {void} */
  function onFinish(part) {
    sendMetadata(part);
    let failed = part.finishReason === 'error';
    if (current) {
      failed = failed || current.failed;
      closeMessage(current, { streaming: false });
    } else {
      report('finish arrived outside a message', part);
    }
    if (waitingForPerson()) runStatus?.update({ state: 'waiting' });
    else runStatus?.update({ state: failed ? 'failed' : 'done', finished: new Date() });
  }

  /* ------------------------------------------------------------------ text -- */

  /** @param {MessageState} message @param {unknown} id @returns {void} */
  function beginText(message, id) {
    message.texts.add(id);
    message.gap = message.hasText;
  }

  /** @param {UiMessagePart} part @returns {void} */
  function onTextStart(part) {
    const message = activeMessage(part);
    if (message.texts.has(part.id)) report(`Duplicate text-start for block ${part.id}`, part);
    else beginText(message, part.id);
  }

  /** @param {UiMessagePart} part @returns {void} */
  function onTextDelta(part) {
    const message = activeMessage(part);
    if (!message.texts.has(part.id)) {
      report(`text-delta arrived before the text-start of block ${part.id}`, part);
      beginText(message, part.id);
    }
    let delta = String(part.delta ?? '');
    // A new block is a new paragraph; only a blank line followed by text opens one.
    if (message.gap) delta = delta.trimStart();
    if (!delta) return;
    thread.appendText(message.id, message.gap ? `\n\n${delta}` : delta);
    message.gap = false;
    message.hasText = true;
  }

  /** @param {UiMessagePart} part @returns {void} */
  function onTextEnd(part) {
    if (!current?.texts.has(part.id)) report(`text-end arrived before the text-start of block ${part.id}`, part);
  }

  /* ------------------------------------------------------------------ reasoning -- */

  /** @param {MessageState} message @returns {ThinkingState} */
  function thinkingOf(message) {
    if (message.thinking) return message.thinking;
    const word = thread.msg('uiMessageStream.thinking');
    message.thinking = {
      step: { id: `think:${message.id}`, kind: 'think', label: word, doing: word, status: 'running' },
      open: new Set(), since: null, ms: 0, text: ''
    };
    message.steps.push(message.thinking.step);
    return message.thinking;
  }

  /**
   * @param {MessageState} message
   * @param {unknown} id
   * @returns {ThinkingState}
   */
  function beginThinking(message, id) {
    const thinking = thinkingOf(message);
    thinking.open.add(id);
    if (thinking.text) thinking.text += '\n\n';
    if (thinking.since === null) {
      thinking.since = Date.now();
      thinking.step.status = 'running';
      drawSteps(message);
    }
    return thinking;
  }

  /** @param {MessageState} message @returns {void} */
  function endThinking(message) {
    const thinking = message.thinking;
    if (!thinking || thinking.since === null) return;
    thinking.ms += Date.now() - thinking.since;
    thinking.since = null;
    thinking.open.clear();
    const { step, ms } = thinking;
    step.status = 'done';
    step.ms = ms;
    step.label = thread.msg('uiMessageStream.thought', formatDuration(ms, { locale: thread.options.locale }));
    if (thinking.text) step.detail = thinking.text;
    drawSteps(message);
  }

  /** @param {UiMessagePart} part @returns {void} */
  function onReasoningStart(part) {
    const message = activeMessage(part);
    if (message.thinking?.open.has(part.id)) report(`Duplicate reasoning-start for block ${part.id}`, part);
    else beginThinking(message, part.id);
  }

  /** @param {UiMessagePart} part @returns {void} */
  function onReasoningDelta(part) {
    const message = activeMessage(part);
    let thinking = message.thinking;
    if (!thinking?.open.has(part.id)) {
      report(`reasoning-delta arrived before the reasoning-start of block ${part.id}`, part);
      thinking = beginThinking(message, part.id);
    }
    if (showReasoning) thinking.text += String(part.delta ?? '');
  }

  /** @param {UiMessagePart} part @returns {void} */
  function onReasoningEnd(part) {
    const thinking = current?.thinking;
    if (!current || !thinking?.open.has(part.id)) {
      report(`reasoning-end arrived before the reasoning-start of block ${part.id}`, part);
      return;
    }
    thinking.open.delete(part.id);
    if (thinking.open.size === 0) endThinking(current);
  }

  /* ------------------------------------------------------------------ tool calls -- */

  /** @param {UiMessagePart} part @returns {CallState} */
  function addCall(part) {
    const message = activeMessage(part);
    const id = String(part.toolCallId);
    const name = typeof part.toolName === 'string' ? part.toolName : '';
    /** @type {CallState} */
    const call = {
      id, name, message, status: 'queued', args: null, argsText: '', since: null, tile: null,
      step: { id, kind: 'call', label: part.title || name || id, status: 'queued' }
    };
    if (name) call.step.tool = name;
    calls.set(id, call);
    message.steps.push(call.step);
    drawSteps(message);
    drawTile(call);
    return call;
  }

  /**
   * The call a part names. Only a call whose input was never streamed may start at `available`;
   * anything else ahead of its start creates the step and is reported.
   * @param {UiMessagePart} part
   * @param {{expected?: boolean}} [options]
   * @returns {CallState}
   */
  function callOf(part, { expected = false } = {}) {
    const known = calls.get(String(part.toolCallId));
    if (known) return known;
    if (!expected) report(`${part.type} arrived before the start of tool call ${part.toolCallId}`, part);
    return addCall(part);
  }

  /**
   * Fills in what an input part knows about its call.
   * @param {CallState} call
   * @param {UiMessagePart} part
   * @returns {void}
   */
  function setInput(call, part) {
    if (!call.name && typeof part.toolName === 'string') {
      call.name = part.toolName;
      call.step.tool = part.toolName;
      call.step.label = part.title || part.toolName;
    }
    call.args = part.input === undefined ? null : part.input;
    call.argsText ||= asText(part.input);
    // The input is shown once it is complete, never as it streams.
    if (call.argsText) call.step.args = call.argsText;
  }

  /**
   * Moves a call on, and calls its tile's renderer when the status changed.
   * @param {CallState} call
   * @param {RunState} status
   * @returns {void}
   */
  function moveCall(call, status) {
    const changed = call.status !== status;
    call.status = status;
    call.step.status = status;
    if (status === 'running') call.since = Date.now();
    drawSteps(call.message);
    if (changed) drawTile(call);
  }

  /**
   * Ends a call. A card still pending has lost its question: whatever happened happened without
   * it, so it cannot be left inviting a decision.
   * @param {CallState} call
   * @param {RunState} status
   * @returns {void}
   */
  function finishCall(call, status) {
    for (const [id, approval] of approvals) {
      if (approval.call === call && !approval.settled) expire(id, approval);
    }
    if (call.since !== null) call.step.ms = Date.now() - call.since;
    call.since = null;
    moveCall(call, status);
  }

  /**
   * Draws or updates a call's tile. Whatever the renderer returns is the application's: the
   * adapter only sets the id, so the renderer cannot aim at another item.
   * @param {CallState} call
   * @returns {void}
   */
  function drawTile(call) {
    const render = call.name && Object.hasOwn(tools, call.name) ? tools[call.name] : null;
    if (typeof render !== 'function') return;
    /** @type {ThreadItem|null} */
    let item;
    try {
      item = render(structuredClone({
        id: call.id, name: call.name, args: call.args, argsText: call.argsText,
        ...(call.result === undefined ? {} : { result: call.result }),
        ...(call.error === undefined ? {} : { error: call.error }),
        status: call.status
      }));
    } catch (error) {
      options.onerror?.(error instanceof Error ? error : new Error(String(error)));
      return;
    }
    if (item == null) return;
    if (typeof item !== 'object' || typeof item.type !== 'string' || !item.type) {
      report(`The tile of ${call.name} is not a thread item`, { type: 'tile', toolCallId: call.id });
      return;
    }
    const id = `tool:${call.id}`;
    if (call.tile) {
      thread.patch(id, { ...item });
      return;
    }
    call.tile = id;
    tiles.add(id);
    thread.upsert({ ...byline, ...item, id });
    call.step.refs = [{ id, label: thread.msg('uiMessageStream.showTile', call.step.label), entity: 'tool' }];
    drawSteps(call.message);
  }

  /** @param {UiMessagePart} part @returns {void} */
  function onInputStart(part) {
    if (calls.has(String(part.toolCallId))) report(`Duplicate tool-input-start for call ${part.toolCallId}`, part);
    else addCall(part);
  }

  /** @param {UiMessagePart} part @returns {void} */
  function onInputDelta(part) {
    const call = callOf(part);
    call.argsText += String(part.inputTextDelta ?? '');
  }

  /** @param {UiMessagePart} part @returns {void} */
  function onInputAvailable(part) {
    const call = callOf(part, { expected: true });
    setInput(call, part);
    if (call.status === 'queued') moveCall(call, 'running');
    else drawSteps(call.message);
  }

  /** @param {UiMessagePart} part @returns {void} */
  function onInputError(part) {
    const call = callOf(part, { expected: true });
    setInput(call, part);
    call.error = String(part.errorText ?? '');
    call.step.error = call.error;
    finishCall(call, 'failed');
  }

  /** @param {UiMessagePart} part @returns {void} */
  function onOutputAvailable(part) {
    // A preliminary output is followed by the final one, which is what finishes the call.
    if (part.preliminary) return;
    const call = callOf(part);
    call.result = part.output;
    call.step.result = asText(part.output);
    finishCall(call, 'done');
  }

  /** @param {UiMessagePart} part @returns {void} */
  function onOutputError(part) {
    const call = callOf(part);
    call.error = String(part.errorText ?? '');
    call.step.error = call.error;
    finishCall(call, 'failed');
  }

  /** @param {UiMessagePart} part @returns {void} */
  function onOutputDenied(part) {
    finishCall(callOf(part), 'skipped');
  }

  /* ------------------------------------------------------------------ approvals -- */

  /**
   * @param {string} id The approval's item id.
   * @param {ApprovalState} approval
   * @returns {void}
   */
  function expire(id, approval) {
    approval.settled = true;
    thread.patch(id, { status: 'expired' });
  }

  /** @param {UiMessagePart} part @returns {void} */
  function onApprovalRequest(part) {
    const id = `approval:${part.approvalId}`;
    if (approvals.has(id)) {
      report(`Duplicate tool-approval-request ${part.approvalId}`, part);
      return;
    }
    const call = callOf(part);
    // An automatic decision is a record, not a question: nobody is asked, and the outcome follows.
    if (part.isAutomatic) return;
    approvals.set(id, { id: String(part.approvalId), call, settled: false });
    const code = call.args === null ? call.argsText : asText(call.args);
    thread.upsert({
      id,
      type: 'approval',
      ...byline,
      title: thread.msg('uiMessageStream.approvalTitle', call.step.label),
      ...(typeof part.reason === 'string' && part.reason ? { description: part.reason } : {}),
      ...(code ? { details: [{ type: 'code', ...(typeof call.args === 'string' ? {} : { language: 'json' }), code }] } : {}),
      status: 'pending'
    });
    // A tile follows the card that holds its call.
    if (call.tile) {
      const tile = thread.get(call.tile);
      thread.remove(call.tile);
      if (tile) thread.upsert(tile);
    }
    moveCall(call, 'waiting');
    runStatus?.update({ state: 'waiting', waitingSince: new Date() });
  }

  /**
   * Hears the person's answer. It takes effect once every listener has had its say, because a
   * prevented event keeps the card pending and a card that stays pending decided nothing.
   * @param {boolean} approved
   * @returns {(event: Event) => void}
   */
  const onDecision = (approved) => (event) => {
    const { detail } = /** @type {CustomEvent<{item?: ThreadItem, reason?: string}>} */ (event);
    const approval = approvals.get(String(detail?.item?.id));
    if (!approval) return;
    queueMicrotask(() => {
      if (destroyed || approval.settled || event.defaultPrevented) return;
      approval.settled = true;
      if (approved) moveCall(approval.call, 'running');
      else finishCall(approval.call, 'skipped');
      if (!waitingForPerson()) runStatus?.update({ state: 'running', waitingSince: null });
      options.onapproval?.(approval.id, approved, approved ? undefined : detail.reason || undefined);
    });
  };
  const onApprove = onDecision(true);
  const onReject = onDecision(false);

  /** @param {Event} event @returns {void} */
  const onOpen = (event) => {
    const id = /** @type {CustomEvent<{ref?: {id?: string}}>} */ (event).detail?.ref?.id;
    if (id && tiles.has(id)) thread.reveal(`item:${id}`);
  };

  thread.on('approve', onApprove);
  thread.on('reject', onReject);
  thread.on('open', onOpen);

  /* ------------------------------------------------------------------ the rest -- */

  /** @param {UiMessagePart} part @returns {void} */
  function onSource(part) {
    const message = activeMessage(part);
    const source = sourceOf(part);
    if (message.sources.some((known) => known.id === source.id)) return;
    message.sources.push(source);
    thread.patch(message.id, { sources: message.sources });
  }

  /** @param {UiMessagePart} part @returns {void} */
  function onFile(part) {
    const message = activeMessage(part);
    const label = fileName(part) || thread.msg('uiMessageStream.file');
    thread.appendBlock(message.id, { type: 'figures', rows: [{ label, value: String(part.mediaType ?? '') }] });
    message.hasText = false;
    message.gap = false;
  }

  /** @param {UiMessagePart} part @returns {void} */
  function onError(part) {
    if (current) current.failed = true;
    thread.upsert({ id: uid('zx-ui-error'), type: 'notice', tone: 'danger', text: String(part.errorText ?? '') });
    runStatus?.update({ state: 'failed' });
  }

  /** @returns {void} */
  function onAbort() {
    if (current) stopMessage(current);
    runStatus?.update({ state: 'stopped', finished: new Date() });
  }

  /** @type {Record<string, (part: UiMessagePart) => void>} */
  const handlers = {
    start: onStart,
    finish: onFinish,
    abort: onAbort,
    error: onError,
    'text-start': onTextStart,
    'text-delta': onTextDelta,
    'text-end': onTextEnd,
    'reasoning-start': onReasoningStart,
    'reasoning-delta': onReasoningDelta,
    'reasoning-end': onReasoningEnd,
    'tool-input-start': onInputStart,
    'tool-input-delta': onInputDelta,
    'tool-input-available': onInputAvailable,
    'tool-input-error': onInputError,
    'tool-output-available': onOutputAvailable,
    'tool-output-error': onOutputError,
    'tool-output-denied': onOutputDenied,
    'tool-approval-request': onApprovalRequest,
    'source-url': onSource,
    'source-document': onSource,
    file: onFile,
    'message-metadata': sendMetadata,
    // A file made while reasoning is part of the reasoning, which stays private.
    'reasoning-file': () => {},
    // Step boundaries draw nothing of their own.
    'start-step': () => {},
    'finish-step': () => {}
  };

  return {
    handle(part) {
      if (destroyed) return;
      const type = part && typeof part === 'object' ? part.type : null;
      if (typeof type === 'string' && Object.hasOwn(handlers, type)) handlers[type](part);
      else if (typeof type === 'string' && type.length > 5 && type.startsWith('data-')) options.ondata?.(type.slice(5), part.data, part.id);
      else options.onunknown?.(part);
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      thread.off('approve', onApprove);
      thread.off('reject', onReject);
      thread.off('open', onOpen);
      for (const [id, approval] of approvals) {
        if (approval.settled) continue;
        expire(id, approval);
        moveCall(approval.call, 'stopped');
      }
      if (current) {
        stopMessage(current);
        runStatus?.update({ state: 'stopped', finished: new Date() });
      }
    }
  };
}
