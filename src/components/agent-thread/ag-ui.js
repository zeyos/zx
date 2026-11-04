// @ts-check
/**
 * `connectAgUi()`: draws an AG-UI event stream in an AgentThread.
 *
 * AG-UI is an open protocol between an agent and its user interface: a run streams lifecycle,
 * text, tool-call, reasoning, state and custom events, with state changes as JSON Patch. The
 * adapter takes those events already parsed — the application owns the socket or the server-sent
 * events, retries and authentication — and turns each into calls on the thread: answers, trace
 * steps, approvals, the application's own tiles, and surfaces. It sends nothing anywhere; what the
 * person decides comes back to the application through `ontoolresult`.
 *
 * The module imports nothing that needs a DOM; the thread it is given does the drawing.
 */
import { formatDuration } from '../../internal/agent-model.js';
import { applyPatch } from '../../internal/json-patch.js';
import { assertCatalog, CATALOG } from '../surface/catalog.js';
import { inlineSplitter } from '../surface/stream.js';
import { createValidationState, validateDocument, validateOp } from '../surface/validate.js';

/** @typedef {import('./agent-thread.js').AgentThread} AgentThread */
/** @typedef {import('../../internal/agent-model.js').ThreadItem} ThreadItem */
/** @typedef {import('../../internal/agent-model.js').TraceStep} TraceStep */
/** @typedef {import('../../internal/agent-model.js').RunState} RunState */
/** @typedef {import('../../internal/agent-model.js').Author} Author */
/** @typedef {import('../surface/catalog.js').SurfaceCatalog} SurfaceCatalog */
/** @typedef {import('../surface/validate.js').SurfaceError} SurfaceError */
/** @typedef {import('../surface/text.js').SurfaceReply} SurfaceReply */

/** The AG-UI protocol version the adapter implements. */
export const AG_UI_VERSION = '1.0';

/** Longest token a surface accepts. */
const MAX_TOKEN = 512;

/**
 * One AG-UI event, parsed: its `type` and the fields the protocol gives that type.
 * @typedef {{type: string, timestamp?: number, [key: string]: unknown}} AgUiEvent
 */

/**
 * A tool call as a tile renderer receives it — a copy, so changing it changes nothing.
 * @typedef {Object} ToolCall
 * @property {string} id The call's `toolCallId`.
 * @property {string} name The tool's name.
 * @property {unknown} args The parsed arguments once they are complete; `null` before, and when
 *   they are not JSON.
 * @property {string} argsText The arguments as they arrived.
 * @property {unknown} [result] The `content` of the call's result event, unchanged (a string, or a
 *   list of content parts); for a surface tool, what `ontoolresult` received.
 * @property {string} [error] Why the call failed.
 * @property {RunState} status `queued` while the arguments arrive, `waiting` for an approval or an
 *   answer, `running` until the result, then `done`, `failed`, `skipped` when the approval was
 *   rejected, or `stopped` when the run ended without it.
 */

/**
 * What a tile renderer returns: an item of a type registered with `AgentThread.register()`, or
 * `null` to draw nothing yet. Its `id` is the adapter's, `tool:<toolCallId>`, whatever it says.
 * @typedef {(call: ToolCall) => ThreadItem|null} ToolTileRenderer
 */

/**
 * A problem the adapter found and how it dealt with it. Codes are stable:
 * - `invalid-event`: an event without a field its type requires, or a value the adapter cannot
 *   read; it is dropped.
 * - `version`: `RUN_STARTED` names a protocol version other than 1.x; the run is drawn anyway.
 * - `no-run`: an event outside a run; it is dropped.
 * - `out-of-order`: content, arguments, an end or a result for something that was never started
 *   or has already ended; it is dropped, never turned into an item.
 * - `duplicate-start`: a start for an id still open, or for a run already seen; it is ignored.
 * - `unclosed`: a message still open when its run ended; it is ended.
 * - `renderer`: a tile renderer threw or returned something that is not an item; the trace step
 *   stays as it was.
 * - `approval-check`: `requiresApproval` threw; the call waits for a person.
 * - `state`: a state delta that does not apply; the state stays as it was.
 * - `invalid-line`: a line in a surface fence that is not JSON; it is dropped.
 * - `unknown-surface`: an operation for a surface that has not begun; it is dropped.
 * - `surface-answered`: an operation for a surface that has already replied; it is refused.
 * - `not-allowed`: an operation for a surface another source opened — a fence line for a
 *   custom-event or tool surface, a custom event for a surface the model opened — or a message id
 *   that uses one of the adapter's own prefixes (`approval:`, `tool:`, `trace:`, `surface:`,
 *   `error:`, `think:`); it is refused, never merged.
 * - `unterminated-fence`, `line-too-long`: from splitting answer text; a surface left open by an
 *   unterminated fence is cancelled when the run ends.
 * - `unterminated-surface`: a surface reached the end of its run without its `end` operation; it
 *   is cancelled, because its actions would stay disabled for good.
 * - `internal`: an event the adapter could not handle at all; it is dropped, and `handle()` does
 *   not throw.
 * @typedef {Object} AgUiProblem
 * @property {string} code What went wrong.
 * @property {string} message What went wrong, in English.
 * @property {AgUiEvent} [event] The event it concerns.
 * @property {unknown} [cause] The error thrown, for `renderer`, `approval-check` and `state`.
 * @property {SurfaceError[]} [errors] The surface's problems, for a surface tool's document.
 */

/**
 * @typedef {Object} AgUiOptions
 * @property {{update: (values: Record<string, unknown>) => unknown}|null} [runStatus=null] A
 *   RunStatus the run's lifecycle drives: `running` when it starts, `done`, `waiting` (an
 *   interrupt, or calls still waiting for the person), `stopped` (cancelled) or `failed`.
 * @property {Record<string, Author>} [authors={}] The thread's authors. A text message whose
 *   `name` is one of their keys is written by that author; every other item by `agent`.
 * @property {string|null} [agent=null] The author key of the agent's output; the thread's first
 *   agent when null.
 * @property {((call: ToolCall) => unknown)|null} [requiresApproval=null] Asked once a call's
 *   arguments are complete: any truthy answer holds the call at an ApprovalCard until the person
 *   decides. Nothing is approved by default: a check that throws holds the call too, and so does a
 *   Promise, whatever it resolves to, so an asynchronous check never lets a call through. Not asked
 *   for surface tools, whose surface is the person's say.
 * @property {((id: string, result: Record<string, unknown>) => void)|null} [ontoolresult=null] What
 *   the person decided, for the application to send back to the agent. An approval answers
 *   `{approved: true}` or `{approved: false, reason?}`; a surface tool its reply, with `errors`
 *   when the surface had any; a `show` surface with no actions answers at once with
 *   `{shown: true, surface, errors?}` and stays on screen; a surface tool whose arguments are not a
 *   surface answers at once with `{error: 'invalid-arguments'}`. In AG-UI 1.0 the application turns it into a `resume`
 *   entry (`{interruptId, status: 'resolved', payload}`) when the run ended with an interrupt for
 *   the call, or into a tool message (`{role: 'tool', toolCallId, content}`) when it ended with
 *   the call among its `pendingToolCallIds`; either goes in the next run's input.
 * @property {((state: unknown) => void)|null} [onstate=null] The application state after each
 *   snapshot or delta.
 * @property {((event: AgUiEvent) => void)|null} [onunknown=null] Every event the adapter does not
 *   draw: unknown types, and known ones without a place in the thread (steps, message snapshots,
 *   activities, raw and encrypted values, subagents, custom events of another name).
 * @property {((problem: AgUiProblem) => void)|null} [onerror=null] Problems found in the stream.
 * @property {boolean} [showReasoning=false] Show the reasoning text in its trace step. Without
 *   it, reasoning is one collapsed "Thought for 12 s" step.
 * @property {string} [surfaceEvent='zx.surface'] The name of the custom event that carries
 *   surface operations: its `value` is one operation, or `{ops: [...], token?}`. The token of the
 *   event that opens a surface is kept; later ones are ignored. Give these surfaces ids a model
 *   cannot predict: a surface belongs to the source that opened it, and a `begin` for an id the
 *   model already took is refused.
 * @property {Record<string, ToolTileRenderer>} [tools={}] The tools whose calls the application
 *   draws itself, by name. The renderer is called at each status change of the call, never while
 *   its arguments stream; its first item that is not `null` is inserted after the call's step,
 *   later ones replace it where it stands, and the step links to it.
 * @property {string[]} [surfaceTools=['show_surface','ask_user']] The tools whose arguments are a
 *   whole surface document. The surface is drawn once the arguments are complete, and its reply is
 *   the call's result.
 * @property {boolean} [inlineSurfaces=false] Split surface fences out of answer text.
 * @property {SurfaceCatalog} [catalog] A narrowed catalog, given to every surface the adapter
 *   creates.
 */

/**
 * What `connectAgUi()` returns.
 * @typedef {Object} AgUiConnection
 * @property {(event: AgUiEvent) => void} handle Takes the next event, in stream order.
 * @property {() => unknown} state The application state as it stands: a copy of the last
 *   snapshot with every delta since applied, `null` before the first.
 * @property {() => void} destroy Ends the connection without leaving anyone waiting: a run still
 *   open is closed as stopped, every unanswered surface-tool surface is cancelled (its reply, with
 *   `reason: 'stopped'`, still reaches `ontoolresult`), every undecided approval card expires, and
 *   then the thread is no longer listened to. Nothing of this is reported through `onerror`. Later
 *   events are ignored; the items stay.
 */

/** The fields each event type needs: `id` a non-empty string, `text` any string. */
const SHAPES = /** @type {Record<string, Record<string, 'id'|'text'|'array'|'content'|'present'>>} */ ({
  RUN_STARTED: { threadId: 'id', runId: 'id' },
  RUN_FINISHED: { threadId: 'id', runId: 'id' },
  RUN_ERROR: { message: 'text' },
  TEXT_MESSAGE_START: { messageId: 'id' },
  TEXT_MESSAGE_CONTENT: { messageId: 'id', delta: 'text' },
  TEXT_MESSAGE_END: { messageId: 'id' },
  TOOL_CALL_START: { toolCallId: 'id', toolCallName: 'id' },
  TOOL_CALL_ARGS: { toolCallId: 'id', delta: 'text' },
  TOOL_CALL_END: { toolCallId: 'id' },
  TOOL_CALL_RESULT: { toolCallId: 'id', messageId: 'id', content: 'content' },
  STATE_SNAPSHOT: { snapshot: 'present' },
  STATE_DELTA: { delta: 'array' },
  CUSTOM: { name: 'id', value: 'present' },
  REASONING_START: { messageId: 'id' },
  REASONING_MESSAGE_START: { messageId: 'id' },
  REASONING_MESSAGE_CONTENT: { messageId: 'id', delta: 'text' },
  REASONING_MESSAGE_END: { messageId: 'id' },
  REASONING_END: { messageId: 'id' }
});

/** Events that leave an open chunk stream open. */
const PASSING = new Set(['RAW', 'ACTIVITY_SNAPSHOT', 'ACTIVITY_DELTA', 'REASONING_ENCRYPTED_VALUE']);

/** Prefixes of the adapter's own item ids, which a message id may not take. */
const RESERVED = /^(?:approval|tool|trace|surface|error|think):/;

/** Step states a run's end still finds open. */
const OPEN_STATES = new Set(['queued', 'running', 'waiting']);

/**
 * @typedef {Object} Run
 * @property {string} id
 * @property {string|null} traceId The trace its steps go into now.
 * @property {number} traces
 * @property {number} errors
 * @property {Set<string>} surfaces Surface items created in the run.
 * @property {Set<string>} cancelAtEnd Surfaces an unterminated fence left open, already reported.
 */

/**
 * @typedef {Object} Message
 * @property {string} id
 * @property {Run} run
 * @property {boolean} open
 * @property {boolean} ignored A message of a role the thread does not draw.
 * @property {string|null} author
 * @property {string[]} segments Its answer items: the message id, then `<id>#2`, `<id>#3`…
 * @property {Set<string>} written Segments that received text.
 * @property {boolean} afterFence A fence's lines came since the last prose.
 * @property {Set<string>} pending Surfaces its fences began and did not end.
 * @property {number} surfaces Surfaces its fences began.
 * @property {ReturnType<typeof inlineSplitter>|null} splitter
 */

/**
 * @typedef {Object} Call
 * @property {ToolCall} call
 * @property {'step'|'tile'|'surface'} kind
 * @property {Run} run
 * @property {string} traceId
 * @property {boolean} open Its arguments are still arriving.
 * @property {number} startedAt
 * @property {boolean} gated
 * @property {boolean} decided
 * @property {string|null} tileId
 * @property {string|null} placeholder
 * @property {string|null} surfaceId
 * @property {string[]} items The items drawn for the call — its approval, tile, stand-in or
 *   surface — in thread order.
 */

/**
 * Connects an AG-UI 1.0 event stream to an AgentThread.
 *
 * - Run start, finish and error drive `runStatus`; an error also adds a `notice`.
 * - A text message is an `answer` streamed with `appendText()`; with `inlineSurfaces`, its
 *   surface fences become surfaces after the prose before them, and the prose after a fence
 *   continues in the answer `<messageId>#2` (then `#3`…), by the same author.
 * - A tool call is a trace step: its arguments show once complete, its result fills it. A call in
 *   `tools` is also the application's tile `tool:<toolCallId>`; a call in `surfaceTools` is an
 *   `ask` step and a surface, a Skeleton while its arguments arrive.
 * - Calls `requiresApproval` holds wait at an ApprovalCard (`approval:<toolCallId>`). AG-UI 1.0
 *   asks for approval by ending the run with an `interrupt` outcome, or with the call among the
 *   `pendingToolCallIds` of a frontend tool; either way the decision reaches the application
 *   through `ontoolresult` for its next run, and a later run's result for the call fills the step.
 *   A `tool_call` interrupt for a call `requiresApproval` let through gates it too; the
 *   application keeps each `interrupt.id` from the event for its `resume` entry. Every other
 *   interrupt is the application's: the event goes to `onunknown`. A result that arrives before
 *   the decision is drawn as it is, the card expires, and no decision is sent for that call.
 * - A message id is the answer's item id. A start for a closed message or call reopens it, in this
 *   run or a later one, and its content continues: a reopened call is asked about again once its
 *   arguments are complete. A start for an id still open is ignored and reported.
 * - A surface is the thread item `surface:<runId>/<surface>`, so a model reusing `s1` in every
 *   run gets a new surface each run. Its token is the application's for a custom event, the tool
 *   call id for a surface tool, and the run id for an inline surface.
 * - A state snapshot and its deltas keep the application state, reported through `onstate`.
 * - Reasoning is one collapsed "Thought for N s" step, its text shown only with `showReasoning`.
 * - `*_CHUNK` events are expanded into their start, content and end events.
 * - Out of order: content, arguments or an end for something never started is dropped, not
 *   drawn; a second start for an open id is ignored. Both are reported through `onerror`.
 *
 * @param {AgentThread} thread The thread to draw in.
 * @param {AgUiOptions} [options]
 * @returns {AgUiConnection}
 */
export function connectAgUi(thread, options = {}) {
  if (!thread || typeof thread.upsert !== 'function') throw new TypeError('connectAgUi needs an AgentThread');
  const authors = options.authors && typeof options.authors === 'object' ? options.authors : {};
  const agent = typeof options.agent === 'string' && options.agent ? options.agent : null;
  const showReasoning = options.showReasoning === true;
  const surfaceEvent = typeof options.surfaceEvent === 'string' && options.surfaceEvent ? options.surfaceEvent : 'zx.surface';
  const tools = options.tools && typeof options.tools === 'object' ? options.tools : {};
  const surfaceTools = new Set(Array.isArray(options.surfaceTools) ? options.surfaceTools : ['show_surface', 'ask_user']);
  const inlineSurfaces = options.inlineSurfaces === true;
  const catalog = options.catalog ?? null;
  if (catalog) assertCatalog(catalog);
  const runStatus = options.runStatus && typeof options.runStatus.update === 'function' ? options.runStatus : null;

  /** @type {Run|null} */
  let active = null;
  /** @type {Run|null} */
  let lastRun = null;
  /** @type {Set<string>} */
  const runIds = new Set();
  /** @type {Map<string, Message>} */
  const messages = new Map();
  /** @type {Map<string, Call>} */
  const calls = new Map();
  /** @type {Map<string, TraceStep[]>} */
  const traces = new Map();
  /** @type {Map<string, {source: 'tool'|'custom'|'inline', ended: boolean}>} */
  const surfaces = new Map();
  /** @type {Map<string, string>} Surface item id → the surface tool call it answers. */
  const surfaceCalls = new Map();
  /** @type {Map<string, string>} Approval item id → its call. */
  const approvals = new Map();
  /** @type {Set<string>} */
  const tileRefs = new Set();
  /** @type {{id: string, start: number, stepId: string, traceId: string, text: string, open: Set<string>, seen: Set<string>}|null} */
  let reasoning = null;
  /** @type {Set<string>} */
  const spans = new Set();
  /** @type {unknown} */
  let state = null;
  /** @type {string|null} The last item the adapter added. */
  let lastPlaced = null;
  /** @type {{text: {id: string, owned: boolean}|null, tool: {id: string, owned: boolean}|null, reasoning: {id: string, owned: boolean}|null}} */
  const chunk = { text: null, tool: null, reasoning: null };
  let destroyed = false;

  /* ------------------------------------------------------------------ helpers -- */

  /** @param {string} code @param {string} message @param {Partial<AgUiProblem>} [extra] */
  const report = (code, message, extra = {}) => {
    // Going away is not a problem in the stream, however much it leaves unfinished.
    if (!destroyed && typeof options.onerror === 'function') options.onerror({ code, message, ...extra });
  };
  /** @param {AgUiEvent} event */
  const unknown = (event) => {
    if (typeof options.onunknown === 'function') options.onunknown(event);
  };
  /** @param {string} id @param {Record<string, unknown>} result */
  const answer = (id, result) => {
    if (typeof options.ontoolresult === 'function') options.ontoolresult(id, result);
  };
  /** @param {Record<string, unknown>} values */
  const status = (values) => {
    runStatus?.update(values);
  };
  /** @param {string|null} [key] @returns {{author?: string}} */
  const by = (key = agent) => (key ? { author: key } : {});
  /** @param {AgUiEvent} event @returns {number} */
  const timeOf = (event) => (typeof event.timestamp === 'number' && Number.isFinite(event.timestamp) ? event.timestamp : Date.now());
  /** @param {string|null|undefined} token @returns {string|null} */
  const tokenOf = (token) => (typeof token === 'string' && token.length <= MAX_TOKEN ? token : null);

  /** @param {ThreadItem} item */
  const place = (item) => {
    thread.upsert(item);
    lastPlaced = String(item.id);
  };

  /**
   * The item a call's next item goes after: the last item drawn for this call or an earlier call
   * of the same trace, else the trace itself.
   * @param {Call} entry
   * @returns {string}
   */
  const anchorOf = (entry) => {
    let anchor = entry.traceId;
    for (const step of traces.get(entry.traceId) ?? []) {
      const other = calls.get(step.id);
      if (other?.traceId === entry.traceId && other.items.length) anchor = /** @type {string} */ (other.items.at(-1));
      if (step.id === entry.call.id) break;
    }
    return anchor;
  };

  /**
   * Inserts an item at its call's place, even when something was drawn after the call's step
   * since.
   * @param {Call} entry @param {ThreadItem} item
   */
  const placeForCall = (entry, item) => {
    const anchor = anchorOf(entry);
    thread.upsert(item, { after: anchor });
    if (lastPlaced === anchor) lastPlaced = String(item.id);
    entry.items.push(String(item.id));
  };

  /**
   * Removes an item drawn for a call.
   * @param {Call} entry @param {string} id
   */
  const unplace = (entry, id) => {
    thread.remove(id);
    entry.items = entry.items.filter((other) => other !== id);
    if (lastPlaced === id) lastPlaced = anchorOf(entry);
  };

  /**
   * Adds a step to the run's current trace, or to a new trace when something else was drawn
   * since, so every step stands where it happened.
   * @param {Run} run @param {TraceStep} step
   * @returns {string} The trace's id.
   */
  const addStep = (run, step) => {
    const current = run.traceId;
    if (current && lastPlaced === current && traces.has(current)) {
      const steps = /** @type {TraceStep[]} */ (traces.get(current));
      steps.push(step);
      thread.patch(current, { steps: structuredClone(steps) });
      return current;
    }
    run.traces += 1;
    const id = run.traces === 1 ? `trace:${run.id}` : `trace:${run.id}#${run.traces}`;
    run.traceId = id;
    traces.set(id, [step]);
    place(/** @type {ThreadItem} */ ({ id, type: 'trace', ...by(), steps: [structuredClone(step)] }));
    return id;
  };

  /** @param {string} traceId @param {string} stepId @param {Record<string, unknown>} changes */
  const updateStep = (traceId, stepId, changes) => {
    const steps = traces.get(traceId);
    const index = steps ? steps.findIndex((step) => step.id === stepId) : -1;
    if (!steps || index < 0) return;
    const next = /** @type {Record<string, unknown>} */ ({ ...steps[index], ...changes });
    for (const key of Object.keys(next)) if (next[key] === undefined) delete next[key];
    steps[index] = /** @type {TraceStep} */ (next);
    thread.patch(traceId, { steps: structuredClone(steps) });
  };

  /**
   * Moves a call to another status: its step, then its tile.
   * @param {Call} entry @param {RunState} next
   * @param {Partial<ToolCall>} [changes] @param {Record<string, unknown>} [step]
   */
  const setStatus = (entry, next, changes = {}, step = {}) => {
    const changed = entry.call.status !== next;
    Object.assign(entry.call, changes, { status: next });
    updateStep(entry.traceId, entry.call.id, { status: next, ...step });
    if (entry.kind === 'tile' && changed) renderTile(entry);
  };

  /**
   * Holds a call at an ApprovalCard.
   * @param {Call} entry
   */
  const gate = (entry) => {
    entry.gated = true;
    const id = `approval:${entry.call.id}`;
    approvals.set(id, entry.call.id);
    placeForCall(entry, /** @type {ThreadItem} */ ({
      id, type: 'approval', ...by(), title: thread.msg('agUi.approve', entry.call.name), status: 'pending',
      details: [{ type: 'code', language: 'json', code: pretty(entry.call.argsText) }]
    }));
    setStatus(entry, 'waiting', {}, { args: entry.call.argsText });
  };

  /**
   * Expires a call's approval card: the decision can no longer be made.
   * @param {Call} entry
   */
  const expire = (entry) => {
    if (!entry.gated || entry.decided) return;
    entry.decided = true;
    thread.patch(`approval:${entry.call.id}`, { status: 'expired' });
  };

  /**
   * A start for a closed call: its arguments continue, so nothing drawn from them stands any more.
   * Its card and its surface go, and it is asked about again once the arguments are complete, so
   * nobody decides on arguments that have since changed.
   * @param {Call} entry @param {Run} run
   */
  const reopenCall = (entry, run) => {
    const { call } = entry;
    if (entry.gated) {
      approvals.delete(`approval:${call.id}`);
      unplace(entry, `approval:${call.id}`);
    }
    if (entry.surfaceId) {
      // Forgotten first: the reply its removal sends is not the call's answer.
      surfaces.delete(entry.surfaceId);
      surfaceCalls.delete(entry.surfaceId);
      entry.run.surfaces.delete(entry.surfaceId);
      unplace(entry, entry.surfaceId);
    }
    Object.assign(entry, { run, open: true, gated: false, decided: false, surfaceId: null });
    delete call.result;
    delete call.error;
    call.args = null;
    if (entry.kind === 'surface') standIn(entry);
    setStatus(entry, 'queued', {}, { args: undefined, result: undefined, error: undefined, detail: undefined });
  };

  /**
   * Draws the Skeleton a surface call stands as while its arguments arrive.
   * @param {Call} entry
   */
  const standIn = (entry) => {
    entry.placeholder = `tool:${entry.call.id}`;
    placeForCall(entry, /** @type {ThreadItem} */ ({ id: entry.placeholder, type: 'zx-placeholder', ...by(), lines: 4 }));
  };

  /** @param {Call} entry */
  const renderTile = (entry) => {
    const render = tools[entry.call.name];
    if (typeof render !== 'function') return;
    const id = `tool:${entry.call.id}`;
    try {
      const item = render(structuredClone(entry.call));
      if (item == null) return;
      if (!isObject(item) || typeof item.type !== 'string' || !item.type) {
        report('renderer', `The tile renderer for "${entry.call.name}" returned something that is not an item`, { cause: item });
        return;
      }
      const tile = /** @type {ThreadItem} */ ({ ...by(), ...item, id });
      if (entry.tileId) {
        thread.upsert(tile);
        return;
      }
      placeForCall(entry, tile);
      entry.tileId = id;
    } catch (error) {
      report('renderer', `The tile renderer for "${entry.call.name}" failed: ${messageOf(error)}`, { cause: error });
      return;
    }
    tileRefs.add(id);
    updateStep(entry.traceId, entry.call.id, { refs: [{ id, label: thread.msg('agUi.showTile'), entity: 'tile' }] });
  };

  /** @param {AgUiEvent} event @returns {Run|null} */
  const inRun = (event) => {
    if (active) return active;
    report('no-run', `${event.type} arrived outside a run and was dropped`, { event });
    return null;
  };

  /* ------------------------------------------------------------------ surfaces -- */

  /**
   * Routes one surface operation into its scoped surface. A surface belongs to the source that
   * opened it; an operation from another source is refused.
   * @param {unknown} op
   * @param {{source: 'custom'|'inline', run: Run, token: string|null, badToken?: boolean, message?: Message, event?: AgUiEvent}} context
   */
  const routeOp = (op, context) => {
    const invalid = context.source === 'inline' ? 'invalid-line' : 'invalid-event';
    const name = isObject(op) ? op.surface : undefined;
    if (!isObject(op) || typeof name !== 'string' || !name) {
      report(invalid, 'A surface operation names no surface; it was dropped', { event: context.event });
      return;
    }
    const id = `surface:${context.run.id}/${name}`;
    let owner = surfaces.get(id);
    if (owner && owner.source !== context.source) {
      report('not-allowed', `Surface "${name}" belongs to another source; the operation was refused`, { event: context.event });
      return;
    }
    if (!owner) {
      if (op.op !== 'begin') {
        report('unknown-surface', `Surface "${name}" has not begun; the operation was dropped`, { event: context.event });
        return;
      }
      if (context.badToken) {
        report('invalid-event', `A surface token is a string of at most ${MAX_TOKEN} characters; surface "${name}" was not opened`, { event: context.event });
        return;
      }
      const entities = thread.options?.surfaceOptions?.resolve?.entities ?? null;
      const checked = validateOp(op, createValidationState({ entities }), catalog ?? CATALOG);
      if (!checked.op) {
        report(invalid, `Surface "${name}" cannot begin; nothing was drawn`, { event: context.event, errors: checked.errors });
        return;
      }
      owner = { source: context.source, ended: false };
      surfaces.set(id, owner);
      context.run.surfaces.add(id);
      place(/** @type {ThreadItem} */ ({
        id, type: 'surface', ...by(context.message ? context.message.author : agent), document: null,
        token: context.token, ...(catalog ? { catalog } : {})
      }));
      if (context.message) {
        context.message.pending.add(id);
        context.message.surfaces += 1;
      }
    }
    const surface = thread.surface(id);
    if (!surface) return;
    if (surface.getReply()) {
      report('surface-answered', `Surface "${name}" has already been answered; the operation was refused`, { event: context.event });
      return;
    }
    surface.apply(op);
    if (op.op === 'end') {
      owner.ended = true;
      context.message?.pending.delete(id);
    }
  };

  /**
   * A surface tool's arguments are complete: draw the surface, or answer the call at once.
   * @param {Call} entry @param {{ok: boolean, value?: unknown}} parsed
   */
  const surfaceArguments = (entry, parsed) => {
    const { call, run } = entry;
    const skeleton = entry.placeholder;
    entry.placeholder = null;
    /** @param {Record<string, unknown>} result @param {SurfaceError[]} [errors] */
    const refuse = (result, errors) => {
      if (skeleton) unplace(entry, skeleton);
      setStatus(entry, 'failed', { error: 'invalid-arguments' }, { args: call.argsText, error: 'invalid-arguments' });
      if (errors) report('invalid-event', `The arguments of "${call.name}" are not a surface`, { errors });
      answer(call.id, result);
    };
    if (!parsed.ok) {
      refuse({ error: 'invalid-arguments' });
      return;
    }
    call.args = parsed.value;
    const settings = thread.options?.surfaceOptions?.resolve?.entities;
    const { document, errors } = validateDocument(parsed.value, catalog ?? CATALOG, { entities: settings ?? null });
    // Without a valid intent a surface draws no controls, so nobody could ever answer it.
    if (!document?.intent) {
      refuse({ error: 'invalid-arguments', errors }, errors);
      return;
    }
    const id = `surface:${run.id}/${document.surface}`;
    if (surfaces.has(id)) {
      const duplicate = [{ code: /** @type {const} */ ('duplicate-begin'), surface: document.surface,
        message: `Surface "${document.surface}" already exists in this run; use another id` }];
      refuse({ error: 'invalid-arguments', errors: duplicate }, duplicate);
      return;
    }
    surfaces.set(id, { source: 'tool', ended: true });
    surfaceCalls.set(id, call.id);
    run.surfaces.add(id);
    entry.surfaceId = id;
    placeForCall(entry, /** @type {ThreadItem} */ ({
      id, type: 'surface', ...by(), document: parsed.value, token: tokenOf(call.id), ...(catalog ? { catalog } : {})
    }));
    if (skeleton) unplace(entry, skeleton);
    if (document.intent === 'show' && !document.actions?.length) {
      // Nothing here can be answered: the call is, at once, and the surface stays on screen.
      const problems = thread.surface(id)?.getErrors() ?? errors;
      const result = { shown: true, surface: document.surface, ...(problems.length ? { errors: problems } : {}) };
      entry.decided = true;
      setStatus(entry, 'done', { result }, { args: call.argsText, detail: document.title, result: JSON.stringify(result) });
      answer(call.id, result);
      return;
    }
    setStatus(entry, 'waiting', {}, { args: call.argsText, detail: document.title });
  };

  /* ------------------------------------------------------------------ text -- */

  /** @param {Message} message @returns {ReturnType<typeof inlineSplitter>} */
  const splitterFor = (message) => inlineSplitter({
    ontext: (text) => prose(message, text),
    online: (line) => fenceLine(message, line),
    onerror: (error) => {
      report(error.code, error.message);
      if (error.code !== 'unterminated-fence') return;
      for (const surface of message.pending) message.run.cancelAtEnd.add(surface);
      message.pending.clear();
    }
  });

  /**
   * A start for a closed message: its content continues where it stands, in this run.
   * @param {Message} message @param {Run} run
   */
  const reopenMessage = (message, run) => {
    message.open = true;
    message.run = run;
    if (message.ignored) return;
    if (inlineSurfaces) message.splitter = splitterFor(message);
    const last = thread.get(/** @type {string} */ (message.segments.at(-1)));
    if (last) thread.upsert(/** @type {ThreadItem} */ ({ ...last, streaming: true, stopped: false }));
  };

  /** @param {Message} message @param {string} text */
  const prose = (message, text) => {
    let rest = text;
    if (message.afterFence) {
      rest = rest.replace(/^\s+/, '');
      if (!rest) return;
      message.afterFence = false;
      const id = `${message.id}#${message.segments.length + 1}`;
      message.segments.push(id);
      place(/** @type {ThreadItem} */ ({ id, type: 'answer', ...by(message.author), blocks: [], streaming: true }));
    }
    if (!rest) return;
    const current = /** @type {string} */ (message.segments.at(-1));
    message.written.add(current);
    thread.appendText(current, rest);
  };

  /** @param {Message} message @param {string} line */
  const fenceLine = (message, line) => {
    if (!line.trim()) return;
    message.afterFence = true;
    let op;
    try {
      op = JSON.parse(line);
    } catch {
      report('invalid-line', 'A line in a surface fence is not JSON; it was dropped');
      return;
    }
    routeOp(op, { source: 'inline', run: message.run, token: tokenOf(message.run.id), message });
  };

  /**
   * Ends a message: the splitter, then every answer segment.
   * @param {Message} message @param {boolean} [stopped]
   */
  const endMessage = (message, stopped = false) => {
    message.open = false;
    if (message.ignored) return;
    message.splitter?.end();
    for (const id of message.segments) {
      if (id === message.id && !message.written.has(id) && message.surfaces > 0) {
        thread.remove(id);
        continue;
      }
      thread.patch(id, stopped ? { streaming: false, stopped: true } : { streaming: false });
    }
  };

  /* ------------------------------------------------------------------ runs -- */

  /**
   * Ends a run: open reasoning, messages and fences, then the surfaces an unterminated fence left.
   * @param {Run} run @param {'done'|'stopped'|'failed'|null} outcome
   * @param {number} [at] When the run ended.
   */
  const closeRun = (run, outcome, at = Date.now()) => {
    if (reasoning) endReasoning(at);
    const stopped = outcome === 'stopped' || outcome === 'failed';
    for (const entry of calls.values()) {
      if (entry.run !== run || !entry.open) continue;
      report('unclosed', `The arguments of tool call "${entry.call.id}" were still arriving when its run ended`);
      entry.open = false;
      if (entry.placeholder) unplace(entry, entry.placeholder);
      entry.placeholder = null;
      setStatus(entry, 'stopped');
    }
    for (const message of messages.values()) {
      if (message.run !== run || !message.open) continue;
      if (!message.ignored) report('unclosed', `Message "${message.id}" was still open when its run ended`);
      endMessage(message, stopped);
    }
    for (const id of run.surfaces) {
      const surface = thread.surface(id);
      if (surfaces.get(id)?.ended || !surface || surface.getReply()) continue;
      if (!run.cancelAtEnd.has(id)) report('unterminated-surface', `Surface "${id}" reached the end of its run without its "end"; it was cancelled`);
      surface.cancel('stopped');
    }
    run.cancelAtEnd.clear();
    if (!stopped) return;
    for (const id of run.surfaces) {
      const surface = thread.surface(id);
      if (surface && !surface.getReply()) surface.cancel('stopped');
    }
    for (const entry of calls.values()) {
      if (entry.run !== run || !OPEN_STATES.has(entry.call.status)) continue;
      entry.open = false;
      expire(entry);
      setStatus(entry, 'stopped');
    }
  };

  /** @param {number} at */
  const endReasoning = (at) => {
    const span = /** @type {NonNullable<typeof reasoning>} */ (reasoning);
    const ms = Math.max(0, at - span.start);
    updateStep(span.traceId, span.stepId, {
      status: 'done', label: thread.msg('agUi.thought', formatDuration(ms)), doing: undefined, ms,
      ...(showReasoning && span.text ? { detail: span.text } : {})
    });
    reasoning = null;
  };

  /* ------------------------------------------------------------------ events -- */

  /** @param {AgUiEvent} event */
  const dispatch = (event) => {
    const shape = SHAPES[event.type];
    if (shape) {
      const missing = Object.entries(shape).find(([key, kind]) => !fits(event[key], kind, Object.hasOwn(event, key)));
      if (missing) {
        report('invalid-event', `${event.type} needs "${missing[0]}"; it was dropped`, { event });
        return;
      }
    }
    switch (event.type) {
      case 'RUN_STARTED': return runStarted(event);
      case 'RUN_FINISHED': return runFinished(event);
      case 'RUN_ERROR': return runError(event);
      case 'TEXT_MESSAGE_START': return textStart(event);
      case 'TEXT_MESSAGE_CONTENT': return textContent(event);
      case 'TEXT_MESSAGE_END': return textEnd(event);
      case 'TOOL_CALL_START': return toolStart(event);
      case 'TOOL_CALL_ARGS': return toolArgs(event);
      case 'TOOL_CALL_END': return toolEnd(event);
      case 'TOOL_CALL_RESULT': return toolResult(event);
      case 'STATE_SNAPSHOT': return stateSnapshot(event);
      case 'STATE_DELTA': return stateDelta(event);
      case 'CUSTOM': return custom(event);
      case 'REASONING_START':
      case 'REASONING_MESSAGE_START':
      case 'REASONING_MESSAGE_CONTENT':
      case 'REASONING_MESSAGE_END':
      case 'REASONING_END':
        return reason(event);
      default:
        unknown(event);
    }
  };

  /** @param {AgUiEvent} event */
  const runStarted = (event) => {
    const id = String(event.runId);
    if (active?.id === id || runIds.has(id)) {
      report('duplicate-start', `Run "${id}" has already started; the start was ignored`, { event });
      return;
    }
    if (typeof event.protocolVersion === 'string' && !/^1(?:\.|$)/.test(event.protocolVersion)) {
      report('version', `The run speaks AG-UI ${event.protocolVersion}; this adapter implements ${AG_UI_VERSION}`, { event });
    }
    if (active) {
      report('out-of-order', `Run "${active.id}" never finished before run "${id}" started`, { event });
      closeRun(active, null, timeOf(event));
    }
    runIds.add(id);
    active = { id, traceId: null, traces: 0, errors: 0, surfaces: new Set(), cancelAtEnd: new Set() };
    lastRun = active;
    status({ state: 'running', started: new Date(timeOf(event)), finished: null, waitingSince: null });
  };

  /** @param {AgUiEvent} event */
  const runFinished = (event) => {
    const id = String(event.runId);
    if (!active || active.id !== id) {
      report('out-of-order', `Run "${id}" is not the run in progress; its end was dropped`, { event });
      return;
    }
    const run = active;
    const outcome = isObject(event.outcome) ? event.outcome : { type: 'success' };
    const kind = outcome.type;
    const at = new Date(timeOf(event));
    if (kind !== 'success' && kind !== 'interrupt' && kind !== 'cancelled') {
      report('invalid-event', `RUN_FINISHED has an unknown outcome ${safeText(kind)}`, { event });
      closeRun(run, null, timeOf(event));
      active = null;
      status({ state: 'done', finished: at });
      return;
    }
    closeRun(run, kind === 'cancelled' ? 'stopped' : 'done', timeOf(event));
    active = null;
    if (kind === 'cancelled') {
      status({ state: 'stopped', finished: at });
      return;
    }
    if (kind === 'interrupt') interrupted(event, Array.isArray(outcome.interrupts) ? outcome.interrupts : []);
    const pending = Array.isArray(outcome.pendingToolCallIds) && outcome.pendingToolCallIds.length > 0;
    const waiting = kind === 'interrupt' || pending
      || [...calls.values()].some((entry) => entry.run === run && entry.call.status === 'waiting');
    status(waiting ? { state: 'waiting', waitingSince: at } : { state: 'done', finished: at });
  };

  /**
   * An interrupt outcome: a `tool_call` interrupt for a known call gates it, if nothing has yet;
   * any other interrupt is the application's.
   * @param {AgUiEvent} event @param {unknown[]} interrupts
   */
  const interrupted = (event, interrupts) => {
    let other = interrupts.length === 0;
    for (const interrupt of interrupts) {
      const callId = isObject(interrupt) && interrupt.reason === 'tool_call' && typeof interrupt.toolCallId === 'string'
        ? interrupt.toolCallId : null;
      const entry = callId ? calls.get(callId) : undefined;
      if (!entry) {
        other = true;
        continue;
      }
      if (!entry.gated && !entry.decided && entry.kind !== 'surface' && entry.call.status === 'running') gate(entry);
    }
    if (other) unknown(event);
  };

  /** @param {AgUiEvent} event */
  const runError = (event) => {
    const run = active ?? lastRun;
    if (run) closeRun(run, 'failed', timeOf(event));
    active = null;
    const text = String(event.message ?? '');
    const key = run ? `error:${run.id}` : 'error';
    let id = key;
    if (run) {
      run.errors += 1;
      if (run.errors > 1) id = `${key}#${run.errors}`;
    } else {
      id = `${key}:${timeOf(event)}`;
    }
    place(/** @type {ThreadItem} */ ({
      id, type: 'notice', tone: 'danger',
      text: text ? thread.msg('agUi.runFailedWith', text) : thread.msg('agUi.runFailed')
    }));
    status({ state: 'failed', finished: new Date(timeOf(event)) });
  };

  /** @param {AgUiEvent} event */
  const textStart = (event) => {
    const run = inRun(event);
    if (!run) return;
    const id = String(event.messageId);
    const known = messages.get(id);
    if (known?.open) {
      report('duplicate-start', `Message "${id}" is already open; the start was ignored`, { event });
      return;
    }
    if (known) {
      reopenMessage(known, run);
      return;
    }
    const reserved = RESERVED.test(id);
    if (reserved) report('not-allowed', `Message id "${id}" uses a prefix the adapter keeps for its own items; the message was dropped`, { event });
    const role = event.role ?? 'assistant';
    const name = typeof event.name === 'string' && Object.hasOwn(authors, event.name) ? event.name : null;
    /** @type {Message} */
    const message = {
      id, run, open: true, ignored: reserved || role !== 'assistant', author: name ?? agent, segments: [id], written: new Set(),
      afterFence: false, pending: new Set(), surfaces: 0, splitter: null
    };
    messages.set(id, message);
    if (message.ignored) {
      if (!reserved) unknown(event);
      return;
    }
    if (inlineSurfaces) message.splitter = splitterFor(message);
    place(/** @type {ThreadItem} */ ({ id, type: 'answer', ...by(message.author), blocks: [], streaming: true }));
  };

  /** @param {AgUiEvent} event */
  const textContent = (event) => {
    const message = messages.get(String(event.messageId));
    if (!message || !message.open) {
      report('out-of-order', `Content for message "${String(event.messageId)}", which is not open, was dropped`, { event });
      return;
    }
    if (message.ignored) return;
    const delta = String(event.delta);
    if (message.splitter) message.splitter.write(delta);
    else prose(message, delta);
  };

  /** @param {AgUiEvent} event */
  const textEnd = (event) => {
    const message = messages.get(String(event.messageId));
    if (!message || !message.open) {
      report('out-of-order', `The end of message "${String(event.messageId)}", which is not open, was dropped`, { event });
      return;
    }
    endMessage(message);
  };

  /** @param {AgUiEvent} event */
  const toolStart = (event) => {
    const run = inRun(event);
    if (!run) return;
    const id = String(event.toolCallId);
    const known = calls.get(id);
    if (known?.open) {
      report('duplicate-start', `Tool call "${id}" is already open; the start was ignored`, { event });
      return;
    }
    if (known) {
      reopenCall(known, run);
      return;
    }
    const name = String(event.toolCallName);
    const kind = typeof tools[name] === 'function' && Object.hasOwn(tools, name) ? 'tile' : surfaceTools.has(name) ? 'surface' : 'step';
    /** @type {TraceStep} */
    const step = kind === 'surface'
      ? { id, kind: 'ask', label: thread.msg('agUi.asked'), tool: name, status: 'queued' }
      : { id, kind: 'call', label: thread.msg('agUi.called', name), doing: thread.msg('agUi.calling', name), tool: name, status: 'queued' };
    /** @type {Call} */
    const entry = {
      call: { id, name, args: null, argsText: '', status: 'queued' }, kind, run, traceId: addStep(run, step), open: true,
      startedAt: timeOf(event), gated: false, decided: false, tileId: null, placeholder: null, surfaceId: null, items: []
    };
    calls.set(id, entry);
    if (kind === 'surface') standIn(entry);
    else if (kind === 'tile') renderTile(entry);
  };

  /** @param {AgUiEvent} event */
  const toolArgs = (event) => {
    const entry = calls.get(String(event.toolCallId));
    if (!entry || !entry.open) {
      report('out-of-order', `Arguments for tool call "${String(event.toolCallId)}", which is not open, were dropped`, { event });
      return;
    }
    entry.call.argsText += String(event.delta);
  };

  /** @param {AgUiEvent} event */
  const toolEnd = (event) => {
    const entry = calls.get(String(event.toolCallId));
    if (!entry || !entry.open) {
      report('out-of-order', `The end of tool call "${String(event.toolCallId)}", which is not open, was dropped`, { event });
      return;
    }
    entry.open = false;
    const { call } = entry;
    const parsed = parseArguments(call.argsText);
    if (entry.kind === 'surface') {
      surfaceArguments(entry, parsed);
      return;
    }
    if (parsed.ok) call.args = parsed.value;
    let gated = false;
    if (typeof options.requiresApproval === 'function') {
      try {
        gated = Boolean(options.requiresApproval(structuredClone(call)));
      } catch (error) {
        gated = true;
        report('approval-check', `requiresApproval failed for "${call.name}"; the call waits for a person`, { cause: error });
      }
    }
    if (gated) gate(entry);
    else setStatus(entry, 'running', {}, { args: call.argsText });
  };

  /** @param {AgUiEvent} event */
  const toolResult = (event) => {
    if (!inRun(event)) return;
    const entry = calls.get(String(event.toolCallId));
    if (!entry || entry.open) {
      report('out-of-order', `A result for tool call "${String(event.toolCallId)}", whose arguments are not complete, was dropped`, { event });
      return;
    }
    const content = event.content;
    const text = typeof content === 'string' ? content
      : /** @type {unknown[]} */ (content).filter((part) => isObject(part) && part.type === 'text' && typeof part.text === 'string')
        .map((part) => String(/** @type {any} */ (part).text)).join('\n');
    const end = timeOf(event);
    const timing = end >= entry.startedAt ? { ms: end - entry.startedAt } : {};
    // A rejected or stopped call keeps its status: the result is only recorded.
    if (entry.call.status === 'skipped' || entry.call.status === 'stopped') {
      setStatus(entry, entry.call.status, { result: structuredClone(content) }, { result: text });
      return;
    }
    if (entry.gated && !entry.decided) {
      report('out-of-order', `Tool call "${entry.call.id}" has a result before the person decided; its approval expired`, { event });
      expire(entry);
    }
    setStatus(entry, 'done', { result: structuredClone(content) }, { result: text, ...timing });
  };

  /** @param {AgUiEvent} event */
  const stateSnapshot = (event) => {
    if (!inRun(event)) return;
    try {
      state = structuredClone(event.snapshot);
    } catch (error) {
      report('state', 'The state snapshot is not plain data', { event, cause: error });
      return;
    }
    if (typeof options.onstate === 'function') options.onstate(structuredClone(state));
  };

  /** @param {AgUiEvent} event */
  const stateDelta = (event) => {
    if (!inRun(event)) return;
    try {
      state = applyPatch(state, /** @type {any} */ (event.delta));
    } catch (error) {
      report('state', `The state delta does not apply: ${messageOf(error)}`, { event, cause: error });
      return;
    }
    if (typeof options.onstate === 'function') options.onstate(structuredClone(state));
  };

  /** @param {AgUiEvent} event */
  const custom = (event) => {
    if (event.name !== surfaceEvent) {
      unknown(event);
      return;
    }
    const run = inRun(event);
    if (!run) return;
    const value = event.value;
    /** @type {unknown[]} */
    let ops;
    let token = null;
    let badToken = false;
    if (isObject(value) && Array.isArray(value.ops)) {
      ops = value.ops;
      if (value.token != null) {
        // Checked only where the event opens a surface; elsewhere the token is ignored.
        if (typeof value.token === 'string' && value.token.length <= MAX_TOKEN) token = value.token;
        else badToken = true;
      }
    } else if (isObject(value) && typeof value.op === 'string') {
      ops = [value];
    } else {
      report('invalid-event', `The value of "${surfaceEvent}" is neither an operation nor {ops}; it was dropped`, { event });
      return;
    }
    for (const op of ops) routeOp(op, { source: 'custom', run, token, badToken, event });
  };

  /** @param {AgUiEvent} event */
  const reason = (event) => {
    const run = inRun(event);
    if (!run) return;
    const id = String(event.messageId);
    const orphan = (/** @type {string} */ what) => report('out-of-order', `${what} outside an open reasoning span was dropped`, { event });
    switch (event.type) {
      case 'REASONING_START': {
        if (reasoning || spans.has(id)) {
          report('duplicate-start', `Reasoning "${id}" started while another was open or after it ended; ignored`, { event });
          return;
        }
        spans.add(id);
        const stepId = `think:${id}`;
        const traceId = addStep(run, { id: stepId, kind: 'think', label: thread.msg('agUi.thinking'), doing: thread.msg('agUi.thinking'), status: 'running' });
        reasoning = { id, start: timeOf(event), stepId, traceId, text: '', open: new Set(), seen: new Set() };
        return;
      }
      case 'REASONING_MESSAGE_START':
        if (!reasoning) return orphan('A reasoning message');
        if (reasoning.seen.has(id)) {
          report('duplicate-start', `Reasoning message "${id}" has already started; the start was ignored`, { event });
          return;
        }
        reasoning.seen.add(id);
        reasoning.open.add(id);
        return;
      case 'REASONING_MESSAGE_CONTENT':
        if (!reasoning?.open.has(id)) return orphan('Reasoning content');
        if (showReasoning) reasoning.text += String(event.delta);
        return;
      case 'REASONING_MESSAGE_END':
        if (!reasoning?.open.has(id)) return orphan('The end of a reasoning message');
        reasoning.open.delete(id);
        if (showReasoning) reasoning.text += '\n\n';
        return;
      default:
        if (!reasoning || reasoning.id !== id) return orphan('The end of reasoning');
        reasoning.text = reasoning.text.trim();
        endReasoning(timeOf(event));
    }
  };

  /* ------------------------------------------------------------------ chunks -- */

  /**
   * Expands chunk events into start, content and end events, and ends an open chunk stream when
   * another event arrives.
   * @param {AgUiEvent} event
   * @returns {AgUiEvent[]}
   */
  const expand = (event) => {
    /** @type {AgUiEvent[]} */
    const out = [];
    const stamp = typeof event.timestamp === 'number' ? { timestamp: event.timestamp } : {};
    /** @param {'text'|'tool'|'reasoning'} lane */
    const close = (lane) => {
      const open = chunk[lane];
      chunk[lane] = null;
      if (!open?.owned) return;
      if (lane === 'text') out.push({ type: 'TEXT_MESSAGE_END', messageId: open.id, ...stamp });
      else if (lane === 'tool') out.push({ type: 'TOOL_CALL_END', toolCallId: open.id, ...stamp });
      else out.push({ type: 'REASONING_MESSAGE_END', messageId: open.id, ...stamp });
    };
    const lanes = /** @type {const} */ (['text', 'tool', 'reasoning']);
    const lane = event.type === 'TEXT_MESSAGE_CHUNK' ? 'text' : event.type === 'TOOL_CALL_CHUNK' ? 'tool'
      : event.type === 'REASONING_MESSAGE_CHUNK' ? 'reasoning' : null;
    if (!lane) {
      if (!PASSING.has(event.type)) for (const other of lanes) close(other);
      out.push(event);
      return out;
    }
    for (const other of lanes) if (other !== lane) close(other);
    const key = lane === 'tool' ? 'toolCallId' : 'messageId';
    const id = typeof event[key] === 'string' && event[key] ? String(event[key]) : null;
    if (id && id !== chunk[lane]?.id) {
      close(lane);
      if (lane === 'text') {
        const known = messages.get(id);
        const owned = !known?.open;
        chunk.text = { id, owned };
        if (owned) {
          out.push({
            type: 'TEXT_MESSAGE_START', messageId: id, ...stamp,
            ...(event.role !== undefined ? { role: event.role } : {}), ...(event.name !== undefined ? { name: event.name } : {})
          });
        }
      } else if (lane === 'tool') {
        const owned = !calls.get(id)?.open;
        if (owned && (typeof event.toolCallName !== 'string' || !event.toolCallName)) {
          report('invalid-event', 'The first TOOL_CALL_CHUNK of a call needs "toolCallName"; it was dropped', { event });
          return out;
        }
        chunk.tool = { id, owned };
        if (owned) {
          out.push({
            type: 'TOOL_CALL_START', toolCallId: id, toolCallName: event.toolCallName, ...stamp,
            ...(event.parentMessageId !== undefined ? { parentMessageId: event.parentMessageId } : {})
          });
        }
      } else {
        const owned = !reasoning?.open.has(id);
        chunk.reasoning = { id, owned };
        if (owned) out.push({ type: 'REASONING_MESSAGE_START', messageId: id, role: 'reasoning', ...stamp });
      }
    }
    const current = chunk[lane];
    if (!current) {
      report('invalid-event', `The first ${event.type} needs "${key}"; it was dropped`, { event });
      return out;
    }
    if (event.delta !== undefined && typeof event.delta !== 'string') {
      report('invalid-event', `${event.type} has a "delta" that is not a string; it was dropped`, { event });
      return out;
    }
    if (typeof event.delta === 'string' && event.delta !== '') {
      if (lane === 'text') out.push({ type: 'TEXT_MESSAGE_CONTENT', messageId: current.id, delta: event.delta, ...stamp });
      else if (lane === 'tool') out.push({ type: 'TOOL_CALL_ARGS', toolCallId: current.id, delta: event.delta, ...stamp });
      else out.push({ type: 'REASONING_MESSAGE_CONTENT', messageId: current.id, delta: event.delta, ...stamp });
    }
    return out;
  };

  /* ------------------------------------------------------------------ thread events -- */

  /** @param {Event} event */
  const onOpen = (event) => {
    const { ref, step } = /** @type {CustomEvent<{ref?: {id?: unknown}, step?: TraceStep}>} */ (event).detail ?? {};
    const id = ref ? String(ref.id) : '';
    if (step && tileRefs.has(id) && id === `tool:${step.id}`) thread.reveal(`item:${id}`);
  };

  /** @param {Event} event */
  const onReply = (event) => {
    const { item, reply } = /** @type {CustomEvent<{item?: ThreadItem, reply: SurfaceReply}>} */ (event).detail ?? {};
    const callId = item ? surfaceCalls.get(String(item.id)) : undefined;
    const entry = callId ? calls.get(callId) : undefined;
    if (!entry || !reply || entry.decided) return;
    entry.decided = true;
    const errors = thread.surface(String(item?.id))?.getErrors() ?? [];
    const result = /** @type {Record<string, unknown>} */ ({ ...structuredClone(reply), ...(errors.length ? { errors } : {}) });
    setStatus(entry, reply.reason === 'stopped' ? 'stopped' : 'done', { result }, { result: JSON.stringify(reply) });
    answer(entry.call.id, result);
  };

  /**
   * An approval decision, once the thread's own listeners have had their say: a prevented
   * decision keeps the card pending.
   * @param {boolean} approved
   * @returns {(event: Event) => void}
   */
  const onDecision = (approved) => (event) => {
    const detail = /** @type {CustomEvent<{item?: ThreadItem, values?: Record<string, unknown>, reason?: string}>} */ (event).detail ?? {};
    const callId = detail.item ? approvals.get(String(detail.item.id)) : undefined;
    const entry = callId ? calls.get(callId) : undefined;
    if (!entry || entry.decided || entry.call.status !== 'waiting') return;
    queueMicrotask(() => {
      if (event.defaultPrevented || entry.decided || destroyed || entry.call.status !== 'waiting') return;
      entry.decided = true;
      if (approved) {
        const values = isObject(detail.values) && Object.keys(detail.values).length ? { values: structuredClone(detail.values) } : {};
        setStatus(entry, 'running');
        answer(entry.call.id, { approved: true, ...values });
      } else {
        setStatus(entry, 'skipped');
        answer(entry.call.id, { approved: false, ...(typeof detail.reason === 'string' && detail.reason ? { reason: detail.reason } : {}) });
      }
    });
  };
  const onApprove = onDecision(true);
  const onReject = onDecision(false);

  thread.on('open', onOpen);
  thread.on('reply', onReply);
  thread.on('approve', onApprove);
  thread.on('reject', onReject);

  return {
    handle(event) {
      if (destroyed) return;
      if (!isObject(event) || typeof event.type !== 'string' || !event.type) {
        report('invalid-event', 'An event must be an object with a "type"; it was dropped');
        return;
      }
      try {
        for (const expanded of expand(/** @type {AgUiEvent} */ (event))) dispatch(expanded);
      } catch (error) {
        report('internal', `${safeText(event.type)} could not be handled and was dropped: ${messageOf(error)}`, { event, cause: error });
      }
    },
    state() {
      return structuredClone(state);
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      if (active) {
        closeRun(active, 'stopped');
        active = null;
        status({ state: 'stopped', finished: new Date() });
      }
      for (const entry of calls.values()) {
        if (entry.decided) continue;
        if (entry.surfaceId) thread.surface(entry.surfaceId)?.cancel('stopped');
        if (entry.gated && !entry.decided) {
          expire(entry);
          setStatus(entry, 'stopped');
        }
      }
      thread.off('open', onOpen);
      thread.off('reply', onReply);
      thread.off('approve', onApprove);
      thread.off('reject', onReject);
    }
  };
}

/* ------------------------------------------------------------------ helpers -- */

/** @param {unknown} value @returns {value is Record<string, any>} */
function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Whether a field has the shape its event type needs.
 * @param {unknown} value @param {'id'|'text'|'array'|'content'|'present'} kind @param {boolean} present
 * @returns {boolean}
 */
function fits(value, kind, present) {
  switch (kind) {
    case 'id': return typeof value === 'string' && value !== '';
    case 'text': return typeof value === 'string';
    case 'array': return Array.isArray(value);
    case 'content': return typeof value === 'string' || Array.isArray(value);
    default: return present;
  }
}

/**
 * A call's complete arguments. No arguments at all read as an empty object, which is how a tool
 * without parameters is called.
 * @param {string} text
 * @returns {{ok: boolean, value?: unknown}}
 */
function parseArguments(text) {
  if (!text.trim()) return { ok: true, value: {} };
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
}

/** @param {string} text @returns {string} The arguments indented, or as they are when not JSON. */
function pretty(text) {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

/** @param {unknown} error @returns {string} */
function messageOf(error) {
  return error instanceof Error ? error.message : safeText(error);
}

/**
 * Any value as text for a message, without running code a hostile object carries.
 * @param {unknown} value
 * @returns {string}
 */
function safeText(value) {
  if (typeof value === 'string') return JSON.stringify(value);
  try {
    return JSON.stringify(value) ?? typeof value;
  } catch {
    return typeof value;
  }
}
