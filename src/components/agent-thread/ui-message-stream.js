// @ts-check
import { uid } from '../../core/util.js';
import { formatDuration } from '../../internal/agent-model.js';
import { sourceHost, sourceHref } from '../source-list/source-list.js';

/** @typedef {import('./agent-thread.js').AgentThread} AgentThread */
/** @typedef {import('../block-view/block-view.js').BlockView} BlockView */
/** @typedef {import('../run-status/run-status.js').RunStatus} RunStatus */
/** @typedef {import('../../internal/agent-model.js').Author} Author */
/** @typedef {import('../../internal/agent-model.js').Block} Block */
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
 * an `id` it replaces the earlier value of that name and id. What went out here stays with the
 * application: a `reset-step` takes back what was drawn, not what was delivered.
 * @property {(metadata: unknown) => void} [onmetadata] Metadata of the message.
 * @property {(part: UiMessagePart) => void} [onunknown] A part the adapter does not draw.
 * @property {(error: Error) => void} [onerror] A part out of order, or a tile that failed.
 * @property {boolean} [showReasoning=false] Shows the model's reasoning text. Without it the text
 * is not kept, and the reasoning is one step that says how long it took.
 */

/**
 * @typedef {Object} UiMessageStreamConnection
 * @property {(part: UiMessagePart) => void} handle Takes the next part of the stream.
 * @property {() => void} destroy Stops listening. An answer still open is stopped, a pending
 * approval expires, because no decision could reach the application any more, and a call still
 * going is stopped, because nothing can settle it.
 */

/**
 * @typedef {Object} MessageState
 * @property {string} id The message id, which is also its first answer item's.
 * @property {string[]} pieces The answer items that hold it, in thread order: the message id, then
 * `<id>#2`, `<id>#3`. What it says next goes to the last.
 * @property {boolean} writing Whether its last piece is streaming.
 * @property {TraceStep[]} steps The message's steps, which its first piece shows.
 * @property {Source[]} sources The message's sources.
 * @property {string} listed The piece that lists them.
 * @property {Set<unknown>} texts Text blocks not ended yet. An ended block's id is free again.
 * @property {boolean} hasText Whether the last piece ends in text a new block has to be set apart
 * from.
 * @property {boolean} gap Whether the next text starts a new paragraph.
 * @property {boolean} drawn Whether the first piece has steps on screen.
 * @property {boolean} failed Whether the run reported an error.
 * @property {boolean} closed Whether it finished or was stopped.
 * @property {boolean} implied Whether a part created it before its `start` arrived.
 * @property {boolean} quiet Whether the response that resumed it has written nothing yet.
 * @property {number} writes Counts what it wrote, so that a step can tell it wrote nothing.
 * @property {ThinkingState|null} thinking Its reasoning.
 * @property {StepMark} mark Where its current step began.
 */

/**
 * Where a message's current step began, and what that step added since: everything `reset-step`
 * has to take back. A call belongs to the step that began it, and its tile and card go with it; an
 * earlier call the step only moved on stays, as it does on the protocol's own client.
 * @typedef {Object} StepMark
 * @property {number} pieces How many pieces the message had.
 * @property {Block[]} blocks What its last piece showed.
 * @property {number} sources How many sources it had.
 * @property {{ms: number, text: string}|null} thought Its reasoning so far, if it had any.
 * @property {Pick<MessageState, 'writing'|'hasText'|'gap'|'failed'|'quiet'>} state Where its text
 * stood.
 * @property {number} writes What it had written.
 * @property {Set<CallState>} calls The calls begun since.
 * @property {string[]} notices The error notices drawn since.
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

/**
 * An answer to an approval, from the person or recorded in the stream.
 * @typedef {Object} Decision
 * @property {boolean} approved Whether it was approved.
 * @property {string} [reason] Why it was rejected.
 * @property {string} [at] When, as the card says it.
 */

/** @param {unknown} value @returns {string} A tool's input or output as text. */
function asText(value) {
  if (value === undefined) return '';
  return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
}

/**
 * What a card that holds a decision shows.
 * @param {Decision} decision
 * @returns {{status: 'approved'|'rejected', rejectReason?: string, answeredAt?: string}}
 */
function cardOf({ approved, reason, at }) {
  return { status: approved ? 'approved' : 'rejected', ...(reason ? { rejectReason: reason } : {}), ...(at ? { answeredAt: at } : {}) };
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
 * application's next request, and the response to it continues the same message. A `start` for an
 * answer the connection did not draw, restored with the conversation, takes it over, and nothing in
 * the thread is overwritten: a `start` naming any other item opens an answer of its own.
 *
 * The thread stays in stream order. What a message says after a card, a tile, or another item it
 * cannot write above continues in a new answer `<messageId>#<n>`, counting from 2, which the thread
 * draws as the same turn. A `reset-step` takes back what the step drew, whichever answers it reached.
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
  /** @type {Map<string, Decision>} What was decided, by approval id, for good. */
  const decisions = new Map();
  /** @type {Set<string>} */
  const tiles = new Set();
  /** @type {string[]} Every item the adapter added, in thread order. */
  const added = [];
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

  /** @param {ThreadItem} item @returns {void} */
  const add = (item) => {
    added.push(String(item.id));
    thread.upsert(item);
  };

  /** @param {string} id An item the adapter added. @returns {void} */
  const takeBack = (id) => {
    const at = added.lastIndexOf(id);
    if (at !== -1) added.splice(at, 1);
    thread.remove(id);
  };

  /** @param {MessageState} message @returns {string} The item its next words go to. */
  const tailOf = (message) => /** @type {string} */ (message.pieces.at(-1));

  /**
   * The thread can only add at its end, so a message's last piece stops being a place to write
   * once anything else stands below it.
   * @param {MessageState} message
   * @returns {boolean}
   */
  const atEnd = (message) => added.at(-1) === tailOf(message);

  /** @param {string} id @returns {MessageState|undefined} The message an answer is a piece of. */
  const ownerOf = (id) => [...messages.values()].find((message) => message.pieces.includes(id));

  /* ------------------------------------------------------------------ messages -- */

  /**
   * Takes over an answer this connection did not draw: restored with the conversation, or drawn by
   * a connection before it. The message goes on from what stands in the thread, with the pieces,
   * sources and steps it has, so that a later part of one of its calls finds that call's step.
   * @param {MessageState} message
   * @param {any} item The answer as it stands.
   * @returns {void}
   */
  function adopt(message, item) {
    for (let n = 2; /** @type {any} */ (thread.get(`${message.id}#${n}`))?.type === 'answer'; n += 1) {
      message.pieces.push(`${message.id}#${n}`);
    }
    const tail = /** @type {any} */ (thread.get(tailOf(message)));
    message.listed = tailOf(message);
    message.sources = tail.sources ?? [];
    message.hasText = tail.blocks?.at(-1)?.type === 'p';
    message.writing = false;
    message.quiet = true;
    message.steps = item.steps ?? [];
    message.drawn = message.steps.length > 0;
    for (const step of message.steps) {
      if (step.kind === 'think') {
        message.thinking = { step, open: new Set(), since: null, ms: 0, text: step.detail ?? '' };
      } else if (step.kind === 'call' && !calls.has(step.id)) {
        const tile = `tool:${step.id}`;
        const drawn = Boolean(thread.get(tile));
        if (drawn) tiles.add(tile);
        calls.set(step.id, {
          id: step.id, name: step.tool ?? '', message, status: step.status ?? 'done', args: null,
          argsText: step.args ?? '', since: null, step, tile: drawn ? tile : null
        });
      }
    }
    // What already stands in the thread decides where the message goes on, whoever put it there.
    added.splice(0, added.length, ...thread.getItems().map((entry) => String(entry.id)));
  }

  /**
   * Opens a message under the id asked for. What already holds that id is never overwritten: an
   * answer the adapter did not draw is taken over, and anything else, whether a person's message, a
   * card, or a piece of another message, leaves the message an id of its own.
   * @param {string} requested
   * @param {boolean} [implied]
   * @returns {MessageState}
   */
  function openMessage(requested, implied = false) {
    const taken = /** @type {any} */ (thread.get(requested));
    const adopted = taken?.type === 'answer' && !ownerOf(requested);
    const id = taken && !adopted ? uid('zx-ui-message') : requested;
    const message = /** @type {MessageState} */ ({
      id, pieces: [id], writing: true, steps: [], sources: [], listed: id, texts: new Set(), hasText: false,
      gap: false, drawn: false, failed: false, closed: false, implied, thinking: null, quiet: false,
      writes: 0
    });
    messages.set(requested, message);
    current = message;
    if (adopted) adopt(message, taken);
    else add({ id, type: 'answer', ...byline, blocks: [], streaming: true });
    message.mark = markStep(message);
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
    const redraw = !message.drawn;
    if (redraw) partial.blocks = /** @type {{blocks?: unknown[]}|null} */ (thread.get(message.id))?.blocks ?? [];
    message.drawn = true;
    thread.patch(message.id, partial);
    if (redraw && message.sources.length) drawSources(message);
  }

  /** @param {MessageState} message @returns {void} */
  function endPiece(message) {
    if (!message.writing) return;
    message.writing = false;
    thread.patch(tailOf(message), { streaming: false });
  }

  /**
   * Continues a message below what now stands under it, in a new answer of the same author, which
   * the thread draws as the same turn.
   * @param {MessageState} message
   * @returns {void}
   */
  function continueMessage(message) {
    endPiece(message);
    let n = message.pieces.length + 1;
    while (thread.get(`${message.id}#${n}`)) n += 1;
    const id = `${message.id}#${n}`;
    message.pieces.push(id);
    message.writing = true;
    message.hasText = false;
    message.gap = false;
    add({ id, type: 'answer', ...byline, blocks: [], streaming: true });
    // Only the answer that held the list changes: the ones above it keep what they have.
    if (message.sources.length) drawSources(message, message.pieces.slice(-2, -1));
  }

  /**
   * The answer that takes what a message says next. A resumed message's last answer stays as it is
   * until here, so one with nothing to say leaves it closed.
   * @param {MessageState} message
   * @returns {string}
   */
  function writeTo(message) {
    message.writes += 1;
    message.quiet = false;
    if (!atEnd(message)) continueMessage(message);
    else if (!message.writing) {
      message.writing = true;
      thread.patch(tailOf(message), { streaming: true, stopped: false });
    }
    return tailOf(message);
  }

  /**
   * @param {MessageState} message
   * @param {boolean} [stopped=false] Whether it was cut off. What a response that wrote nothing cut
   * off is not its last answer, which had already said what it had to say.
   * @returns {void}
   */
  function closeMessage(message, stopped = false) {
    endThinking(message);
    message.closed = true;
    message.writing = false;
    // A response brings its own blocks, so one left open cannot hold its id into the next.
    message.texts.clear();
    if (current === message) current = null;
    thread.patch(tailOf(message), stopped && !message.quiet ? { streaming: false, stopped: true } : { streaming: false });
  }

  /** @param {MessageState} message @returns {void} */
  function stopMessage(message) {
    for (const call of calls.values()) {
      if (call.message === message && (call.status === 'queued' || call.status === 'running')) finishCall(call, 'stopped');
    }
    closeMessage(message, true);
  }

  /**
   * The response to an approval or a tool's output continues the message it belongs to. Its last
   * piece stays as it is: whatever the message says next takes it up again or, with something below
   * it, opens a new one.
   * @param {MessageState} message
   * @returns {void}
   */
  function resumeMessage(message) {
    message.closed = false;
    message.failed = false;
    message.quiet = true;
    current = message;
  }

  /**
   * A `start` for an unknown id opens a message, and one for a message that finished or was stopped
   * resumes it: the response to an approval or a tool's output reuses the id. Only a `start` for a
   * message still open is a duplicate. One without an id during an open message names no other
   * message: streams merged into one each send their own, and the message goes on.
   * @param {UiMessagePart} part
   * @returns {void}
   */
  function onStart(part) {
    const id = part.messageId == null ? null : String(part.messageId);
    const known = id ? messages.get(id) : undefined;
    if (current?.implied) {
      // The parts that came ahead of this start already opened the answer.
      current.implied = false;
      if (id) messages.set(id, current);
    } else if (!id && current) {
      sendMetadata(part);
      return;
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
      closeMessage(current);
    } else {
      report('finish arrived outside a message', part);
    }
    if (waitingForPerson()) runStatus?.update({ state: 'waiting' });
    else runStatus?.update({ state: failed ? 'failed' : 'done', finished: new Date() });
  }

  /* ------------------------------------------------------------------ steps -- */

  /**
   * @param {MessageState} message
   * @returns {StepMark}
   */
  function markStep(message) {
    const { thinking, writing, hasText, gap, failed, quiet, writes } = message;
    return {
      pieces: message.pieces.length,
      blocks: /** @type {{blocks?: Block[]}|null} */ (thread.get(tailOf(message)))?.blocks ?? [],
      sources: message.sources.length,
      thought: thinking && {
        ms: thinking.ms + (thinking.since === null ? 0 : Date.now() - thinking.since),
        text: thinking.text
      },
      state: { writing, hasText, gap, failed, quiet },
      writes,
      calls: new Set(),
      notices: []
    };
  }

  /**
   * Takes back what a message's current step added, so that only what the server sends next stands
   * in its place. The step itself stays open: its next parts need no `start-step` of their own. A
   * step that added nothing leaves the answer alone, with whatever the reader has selected in it,
   * and what stays is changed in place, so that what the reader opened stays open.
   * @param {MessageState} message
   * @returns {void}
   */
  function withdrawStep(message) {
    const { mark } = message;
    // No block is open any more, and the retry may name its blocks the same way.
    message.texts.clear();
    if (!mark.calls.size && !mark.notices.length && message.writes === mark.writes && !message.thinking?.open.size) return;
    for (const [id, approval] of approvals) {
      if (!mark.calls.has(approval.call)) continue;
      // A decision on its way cannot reach the application any more.
      approval.settled = true;
      approvals.delete(id);
      takeBack(id);
    }
    /** @type {Set<TraceStep>} */
    const steps = new Set();
    for (const call of mark.calls) {
      steps.add(call.step);
      calls.delete(call.id);
      if (!call.tile) continue;
      tiles.delete(call.tile);
      takeBack(call.tile);
    }
    message.steps = message.steps.filter((step) => !steps.has(step));
    for (const id of [...message.pieces.splice(mark.pieces), ...mark.notices]) takeBack(id);
    message.sources.length = mark.sources;
    restoreThinking(message, mark.thought);
    Object.assign(message, mark.state);
    message.writes = mark.writes;
    mark.calls.clear();
    mark.notices.length = 0;

    const traced = message.drawn;
    message.drawn = message.steps.length > 0;
    if (message.drawn) thread.patch(message.id, { steps: message.steps });
    else if (traced) thread.upsert({ .../** @type {any} */ (thread.get(message.id)), steps: [] });
    thread.patch(tailOf(message), { blocks: mark.blocks, streaming: message.writing, stopped: false });
    drawSources(message);
    if (waitingForPerson()) runStatus?.update({ state: 'waiting' });
    else runStatus?.update({ state: 'running', waitingSince: null });
  }

  /** @returns {void} */
  function onStartStep() {
    if (current) current.mark = markStep(current);
  }

  /** @param {UiMessagePart} part @returns {void} */
  function onResetStep(part) {
    if (current) withdrawStep(current);
    else report('reset-step arrived outside a message', part);
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
    // A new block is a new paragraph and a new piece a new answer; only text opens either.
    if (message.gap || !atEnd(message)) delta = delta.trimStart();
    if (!delta) return;
    const id = writeTo(message);
    thread.appendText(id, message.gap ? `\n\n${delta}` : delta);
    message.gap = false;
    message.hasText = true;
  }

  /** @param {UiMessagePart} part @returns {void} */
  function onTextEnd(part) {
    if (!current?.texts.delete(part.id)) report(`text-end arrived before the text-start of block ${part.id}`, part);
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
    message.writes += 1;
    thinking.open.add(id);
    if (thinking.text) thinking.text += '\n\n';
    if (thinking.since === null) {
      thinking.since = Date.now();
      thinking.step.status = 'running';
      drawSteps(message);
    }
    return thinking;
  }

  /**
   * The step says how long the reasoning took in its words, so it carries no `ms`: the trace would
   * print that beside them.
   * @param {ThinkingState} thinking
   * @returns {void}
   */
  function settleThinking(thinking) {
    const { step, ms, text } = thinking;
    thinking.since = null;
    thinking.open.clear();
    step.status = 'done';
    step.label = thread.msg('uiMessageStream.thought', formatDuration(ms, { locale: thread.options.locale }));
    if (text) step.detail = text;
    else delete step.detail;
  }

  /** @param {MessageState} message @returns {void} */
  function endThinking(message) {
    const thinking = message.thinking;
    if (!thinking || thinking.since === null) return;
    thinking.ms += Date.now() - thinking.since;
    settleThinking(thinking);
    drawSteps(message);
  }

  /**
   * Puts a message's reasoning back where a withdrawn step found it.
   * @param {MessageState} message
   * @param {StepMark['thought']} thought
   * @returns {void}
   */
  function restoreThinking(message, thought) {
    const { thinking } = message;
    if (!thinking) return;
    if (thought) {
      Object.assign(thinking, thought);
      settleThinking(thinking);
    } else {
      message.steps = message.steps.filter((step) => step !== thinking.step);
      message.thinking = null;
    }
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
    message.writes += 1;
    if (showReasoning) thinking.text += String(part.delta ?? '');
  }

  /** @param {UiMessagePart} part @returns {void} */
  function onReasoningEnd(part) {
    const thinking = current?.thinking;
    if (!current || !thinking?.open.has(part.id)) {
      report(`reasoning-end arrived before the reasoning-start of block ${part.id}`, part);
      return;
    }
    current.writes += 1;
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
    message.mark.calls.add(call);
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
    add({ ...byline, ...item, id });
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
    const approvalId = String(part.approvalId);
    const id = `approval:${approvalId}`;
    if (approvals.has(id)) {
      report(`Duplicate tool-approval-request ${part.approvalId}`, part);
      return;
    }
    const call = callOf(part);
    // An automatic decision is a record, not a question: nobody is asked, and the outcome follows.
    if (part.isAutomatic) return;
    // A request that arrives again was answered once, and that answer stands.
    const decision = decisions.get(approvalId);
    approvals.set(id, { id: approvalId, call, settled: Boolean(decision) });
    const code = call.args === null ? call.argsText : asText(call.args);
    // The answer ends before the card joins, so the thread's last word is that it needs approval,
    // not that it answered. A card for an earlier call outlives a reset of this step, and the answer
    // above it stays ended with it.
    if (current) {
      endPiece(current);
      if (!current.mark.calls.has(call)) current.mark.state.writing = false;
    }
    add({
      id,
      type: 'approval',
      ...byline,
      title: thread.msg('uiMessageStream.approvalTitle', call.step.label),
      ...(typeof part.reason === 'string' && part.reason ? { description: part.reason } : {}),
      ...(code ? { details: [{ type: 'code', ...(typeof call.args === 'string' ? {} : { language: 'json' }), code }] } : {}),
      ...(decision ? cardOf(decision) : { status: 'pending' })
    });
    // A tile follows the card that holds its call.
    if (call.tile) {
      const tile = thread.get(call.tile);
      takeBack(call.tile);
      if (tile) add(tile);
    }
    if (decision) {
      settleCall(call, decision.approved);
      return;
    }
    moveCall(call, 'waiting');
    runStatus?.update({ state: 'waiting', waitingSince: new Date() });
  }

  /**
   * The stream records a decision the person did not make here: on another device, or on the
   * server's side. It is the application's already, so nothing goes to `onapproval`, and the card
   * says what was decided rather than inviting another answer.
   * @param {UiMessagePart} part
   * @returns {void}
   */
  function onApprovalResponse(part) {
    const approvalId = String(part.approvalId);
    const id = `approval:${approvalId}`;
    const approval = approvals.get(id);
    if (!approval) {
      options.onunknown?.(part);
      return;
    }
    if (approval.settled) return;
    const decision = { approved: part.approved === true, ...(typeof part.reason === 'string' && part.reason ? { reason: part.reason } : {}) };
    approval.settled = true;
    decisions.set(approvalId, decision);
    thread.patch(id, cardOf(decision));
    settleCall(approval.call, decision.approved);
    if (!waitingForPerson()) runStatus?.update({ state: 'running', waitingSince: null });
  }

  /**
   * Moves on a call whose approval was decided.
   * @param {CallState} call
   * @param {boolean} approved
   * @returns {void}
   */
  function settleCall(call, approved) {
    if (approved) moveCall(call, 'running');
    else finishCall(call, 'skipped');
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
      const reason = approved ? undefined : detail.reason || undefined;
      const at = /** @type {{answeredAt?: string}|null} */ (thread.get(`approval:${approval.id}`))?.answeredAt;
      decisions.set(approval.id, { approved, ...(reason ? { reason } : {}), ...(at ? { at } : {}) });
      settleCall(approval.call, approved);
      if (!waitingForPerson()) runStatus?.update({ state: 'running', waitingSince: null });
      options.onapproval?.(approval.id, approved, reason);
    });
  };
  const onApprove = onDecision(true);
  const onReject = onDecision(false);

  /** @param {Event} event @returns {void} */
  const onOpen = (event) => {
    const id = /** @type {CustomEvent<{ref?: {id?: string}}>} */ (event).detail?.ref?.id;
    if (id && tiles.has(id)) thread.reveal(`item:${id}`);
  };

  /**
   * A message lists its sources under its last piece, where a citation in an earlier piece cannot
   * reach them on its own. Like a decision, it waits for every listener: a prevented citation is
   * the application's to answer.
   * @param {Event} event
   * @returns {void}
   */
  const onCite = (event) => {
    const { detail } = /** @type {CustomEvent<{item?: ThreadItem, n: number}>} */ (event);
    const id = String(detail?.item?.id);
    const message = ownerOf(id);
    if (!message || tailOf(message) === id) return;
    queueMicrotask(() => {
      if (!destroyed && !event.defaultPrevented) thread.reveal(`source:${detail.n}:${tailOf(message)}`);
    });
  };

  thread.on('approve', onApprove);
  thread.on('reject', onReject);
  thread.on('open', onOpen);
  thread.on('cite', onCite);

  /* ------------------------------------------------------------------ the rest -- */

  /**
   * Lists a message's sources under its last piece, where its turn ends. A citation counts the
   * whole message's sources wherever it stands, so the pieces above keep them for their citations,
   * without a list of their own.
   * @param {MessageState} message
   * @param {string[]} [above] The pieces above the last whose citations have to learn of them.
   * @returns {void}
   */
  function drawSources(message, above = message.pieces.slice(0, -1)) {
    const tail = tailOf(message);
    if (message.listed !== tail) thread.patch(message.listed, { sources: [] });
    message.listed = tail;
    thread.patch(tail, { sources: message.sources });
    for (const id of above) /** @type {BlockView|null} */ (thread.getComponent(id))?.setSources(message.sources);
  }

  /** @param {UiMessagePart} part @returns {void} */
  function onSource(part) {
    const message = activeMessage(part);
    const source = sourceOf(part);
    if (message.sources.some((known) => known.id === source.id)) return;
    message.sources.push(source);
    message.writes += 1;
    drawSources(message);
  }

  /** @param {UiMessagePart} part @returns {void} */
  function onFile(part) {
    const message = activeMessage(part);
    const label = fileName(part) || thread.msg('uiMessageStream.file');
    thread.appendBlock(writeTo(message), { type: 'figures', rows: [{ label, value: String(part.mediaType ?? '') }] });
    message.hasText = false;
    message.gap = false;
  }

  /** @param {UiMessagePart} part @returns {void} */
  function onError(part) {
    const id = uid('zx-ui-error');
    if (current) {
      current.failed = true;
      current.mark.notices.push(id);
    }
    add({ id, type: 'notice', tone: 'danger', text: String(part.errorText ?? '') });
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
    'tool-approval-response': onApprovalResponse,
    'source-url': onSource,
    'source-document': onSource,
    file: onFile,
    'message-metadata': sendMetadata,
    // A file made while reasoning is part of the reasoning, which stays private.
    'reasoning-file': () => {},
    // Step boundaries draw nothing of their own, and a step ends with its own parts.
    'start-step': onStartStep,
    'finish-step': () => {},
    'reset-step': onResetStep
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
      thread.off('cite', onCite);
      for (const [id, approval] of approvals) {
        if (approval.settled) continue;
        expire(id, approval);
        moveCall(approval.call, 'stopped');
      }
      if (current) {
        stopMessage(current);
        runStatus?.update({ state: 'stopped', finished: new Date() });
      }
      // A call of a finished message may be waiting for the next response, which cannot come now.
      for (const call of calls.values()) {
        if (call.status === 'queued' || call.status === 'running') finishCall(call, 'stopped');
      }
    }
  };
}
