// @ts-check
/**
 * The agent data model every agent component reads: a conversation thread as a list of plain JSON
 * items, the blocks an answer is made of, the steps a run took, the sources it cites, and the one
 * mapping from a run or agent state to the glyph, tone, and word that show it.
 *
 * The model holds no functions and no DOM nodes, so an agent can produce it directly and an
 * application can store, send, and replay it. Behaviour comes in through component options and
 * events, never through the model.
 */
import { formatNumber } from '../core/format.js';

/**
 * Where a run, or one step of it, stands.
 * @typedef {'queued'|'running'|'waiting'|'paused'|'blocked'|'done'|'failed'|'stopped'|'skipped'} RunState
 */

/**
 * What an agent is doing, shown beside its avatar.
 * @typedef {'idle'|'thinking'|'working'|'needs-you'|'blocked'|'offline'} AgentActivity
 */

/**
 * A row of figures: what it is, a muted detail, and the value. The tuple form is shorthand for the
 * object form; `call` names the trace step the value came from.
 * @typedef {[string, string, string]|{label: string, detail?: string, value: string, call?: string}} FigureRow
 */

/**
 * One block of an answer. Text runs use the inline grammar of `parseInline()`; nothing in a block
 * is ever read as HTML.
 * @typedef {{type: 'p', text: string}
 *   | {type: 'quote', text: string}
 *   | {type: 'heading', level?: 2|3, text: string}
 *   | {type: 'list', ordered?: boolean, items: string[]}
 *   | {type: 'code', language?: string, code: string, lines?: boolean}
 *   | {type: 'table', columns: string[], rows: string[][], align?: Array<'start'|'center'|'end'|null>}
 *   | {type: 'figures', rows: FigureRow[]}
 *   | {type: 'callout', tone?: 'info'|'success'|'warning'|'danger', title?: string, text: string}
 *   | {type: 'artifact', id: string, title: string, kind?: 'document'|'code', versions?: number}} Block
 */

/**
 * A source an answer draws on. `web` sources may carry an `href`; a `record` names an application
 * record; a `call` names the trace step it came from.
 * @typedef {Object} Source
 * @property {string} id Stable identity.
 * @property {string} title Full title, shown in the source card.
 * @property {'web'|'file'|'record'|'call'} [kind='web'] What the source is.
 * @property {string} [site] Short name shown on the chip: a host, a file name, a record type.
 * @property {string} [snippet] The passage the answer used.
 * @property {string} [href] Address of a `web` source.
 * @property {{entity: string, id: string}} [ref] The application record a `record` source names.
 * @property {string} [call] The trace step the source came from.
 */

/**
 * A link from an item or a step to something of the application's own — a task, a file, a
 * record. The application resolves it; the components only draw the label and report the click.
 * @typedef {Object} ItemRef
 * @property {string} id Stable identity, handed back on activation.
 * @property {string} label What the link says.
 * @property {string} [icon] Glyph name.
 * @property {string} [entity] What kind of thing it is, for the application: `task`, `file`, …
 */

/**
 * One thing an agent did during a run.
 * @typedef {Object} TraceStep
 * @property {string} id Stable identity.
 * @property {'search'|'read'|'query'|'write'|'run'|'call'|'handoff'|'think'|'task'|'ask'|'decision'} [kind='call']
 * What kind of step it is; sets the glyph and how the summary counts it. `task` is a planned step,
 * `ask` a request a person made, `decision` a person's answer; with `think` and `handoff` they are
 * not tool calls.
 * @property {string} label What was done, in the past tense: "Read the dunning policy".
 * @property {RunState} [status='done'] Where the step stands.
 * @property {string} [doing] The present-tense line shown while it runs: "Reading the policy".
 * @property {string} [detail] A muted detail.
 * @property {number} [ms] How long it took.
 * @property {string} [count] A short result count: "42 rows".
 * @property {number} [sources] How many sources a search looked at.
 * @property {string} [tool] The tool's name, shown in mono.
 * @property {string} [args] The call's arguments, JSON or text.
 * @property {string} [result] What the call returned.
 * @property {string} [error] Why the call failed.
 * @property {string} [retryOf] The id of the step this one repeats.
 * @property {string} [actor] Author key of whoever took the step.
 * @property {string} [to] Author key a `handoff` hands over to.
 * @property {string} [at] Local ISO date-time it started; a running step's clock counts from it.
 * @property {number} [tokens] Tokens the step used.
 * @property {ItemRef[]} [refs] Links to what the step touched — a file it wrote, a record it read.
 */

/**
 * Who wrote an item or took a step.
 * @typedef {Object} Author
 * @property {string} name Display name.
 * @property {'person'|'agent'|'model'} [kind='agent'] What the author is.
 * @property {string} [initials] Avatar initials; derived from the name when absent.
 * @property {string} [tone] Categorical avatar tone.
 * @property {AgentActivity|null} [activity] What an agent is doing now.
 * @property {string} [via] The model an agent answers through, shown in the byline.
 * @property {string} [icon] A glyph drawn in a tinted tile instead of initials — a model's mark.
 */

/** @typedef {{name: string, size?: number, type?: string}} Attachment */

/**
 * One version of a regenerated answer.
 * @typedef {{blocks: Block[], sources?: Source[], steps?: TraceStep[], at?: string, model?: string,
 *   stopped?: boolean, rating?: 'up'|'down'|null}} AnswerVersion
 */

/**
 * One item in a conversation thread.
 * `refs` on any item draws links to the application's own things after its content; `mentions` on a
 * person's message marks each `@name` in the text; an answer's `steps` show the work it did inline,
 * above its text, and change with its version.
 * @typedef {{id: string, type: 'user', at?: string, author?: string, text: string, files?: Attachment[],
 *       mentions?: Array<string|{name: string, tone?: string}>, refs?: ItemRef[]}
 *   | {id: string, type: 'text', at?: string, author?: string, text: string, refs?: ItemRef[]}
 *   | {id: string, type: 'answer', at?: string, author?: string, blocks: Block[], sources?: Source[],
 *       steps?: TraceStep[], stepsOpen?: boolean, streaming?: boolean, stopped?: boolean, versions?: AnswerVersion[],
 *       version?: number, rating?: 'up'|'down'|null, refs?: ItemRef[]}
 *   | {id: string, type: 'trace', at?: string, author?: string, steps: TraceStep[], open?: boolean,
 *       title?: string, refs?: ItemRef[]}
 *   | {id: string, type: 'approval', at?: string, author?: string, title: string, description?: string,
 *       icon?: string|null, tone?: string,
 *       status?: 'pending'|'approved'|'rejected'|'expired', details?: Block[],
 *       preview?: {label: string, blocks: Block[]}, fields?: Record<string, Record<string, unknown>>,
 *       values?: Record<string, unknown>, confirmText?: string|null, reason?: 'optional'|'required'|'none',
 *       edited?: boolean, editedKeys?: string[]|null, rejectReason?: string|null, answeredBy?: string,
 *       answeredAt?: string}
 *   | {id: string, type: 'notice', at?: string, author?: string, text: string,
 *       tone?: 'neutral'|'info'|'success'|'warning'|'danger', action?: {id: string, label: string}}
 *   | {id: string, type: string, at?: string, author?: string, [key: string]: unknown}} ThreadItem
 */

/** @typedef {'neutral'|'info'|'success'|'warning'|'danger'|'muted'} StateTone */
/** @typedef {{status: string, tone: StateTone, key: string}} StateEntry */

/**
 * How each run or step state is drawn: the `statusIcon()` status, its tone, and the message key of
 * the word beside it. A state is always a glyph and a word; its colour never stands alone.
 * @type {Readonly<Record<RunState, StateEntry>>}
 */
export const STATUS = Object.freeze({
  queued: { status: 'todo', tone: 'neutral', key: 'agent.status.queued' },
  running: { status: 'in-progress', tone: 'info', key: 'agent.status.running' },
  waiting: { status: 'waiting', tone: 'warning', key: 'agent.status.waiting' },
  paused: { status: 'in-progress', tone: 'muted', key: 'agent.status.paused' },
  blocked: { status: 'waiting', tone: 'danger', key: 'agent.status.blocked' },
  done: { status: 'done', tone: 'success', key: 'agent.status.done' },
  failed: { status: 'canceled', tone: 'danger', key: 'agent.status.failed' },
  stopped: { status: 'canceled', tone: 'muted', key: 'agent.status.stopped' },
  skipped: { status: 'canceled', tone: 'muted', key: 'agent.status.skipped' }
});

/**
 * How each agent activity is drawn beside an avatar: the tone of its dot and the message key of
 * its word.
 * @type {Readonly<Record<AgentActivity, {tone: StateTone, key: string}>>}
 */
export const ACTIVITY = Object.freeze({
  'needs-you': { tone: 'warning', key: 'agent.activity.needsYou' },
  blocked: { tone: 'danger', key: 'agent.activity.blocked' },
  working: { tone: 'success', key: 'agent.activity.working' },
  thinking: { tone: 'info', key: 'agent.activity.thinking' },
  idle: { tone: 'neutral', key: 'agent.activity.idle' },
  offline: { tone: 'muted', key: 'agent.activity.offline' }
});

/**
 * The English words for `STATUS` and `ACTIVITY`, for a component's `msg` defaults.
 * @type {Readonly<Record<string, string>>}
 */
export const AGENT_MESSAGES = Object.freeze({
  'agent.status.queued': 'Not started',
  'agent.status.running': 'Running',
  'agent.status.waiting': 'Waiting for you',
  'agent.status.paused': 'Paused',
  'agent.status.blocked': 'Blocked',
  'agent.status.done': 'Done',
  'agent.status.failed': 'Failed',
  'agent.status.stopped': 'Stopped',
  'agent.status.skipped': 'Skipped',
  'agent.activity.needsYou': 'Needs you',
  'agent.activity.blocked': 'Blocked',
  'agent.activity.working': 'Working',
  'agent.activity.thinking': 'Thinking',
  'agent.activity.idle': 'Idle',
  'agent.activity.offline': 'Offline'
});

/**
 * Reads a state, falling back to `done` for anything the model does not know.
 * @param {unknown} state
 * @returns {RunState}
 */
export function normalizeRunState(state) {
  return typeof state === 'string' && Object.hasOwn(STATUS, state) ? /** @type {RunState} */ (state) : 'done';
}

/**
 * Reads an activity, or null for none or anything unknown.
 * @param {unknown} activity
 * @returns {AgentActivity|null}
 */
export function normalizeActivity(activity) {
  return typeof activity === 'string' && Object.hasOwn(ACTIVITY, activity) ? /** @type {AgentActivity} */ (activity) : null;
}

/* ------------------------------------------------------------------ inline grammar -- */

/** @typedef {{kind: 'text'|'strong'|'code', text: string}|{kind: 'cite', text: string, n: number}} InlineSegment */

/** Characters a backslash makes literal. */
const ESCAPABLE = '*`[\\';

/**
 * Splits a run of model text into plain text, `**bold**`, `` `code` ``, and `[n]` citation
 * segments. That is the whole grammar: there are no links, no HTML, and no nesting. A backslash
 * makes the next `*`, `` ` ``, `[`, or backslash literal; a marker that is never closed stays
 * literal text, which is also what a half-streamed marker looks like until its close arrives.
 * Code spans are verbatim: escapes inside them are not processed.
 * @param {unknown} text
 * @returns {InlineSegment[]}
 */
export function parseInline(text) {
  const source = text == null ? '' : String(text);
  /** @type {InlineSegment[]} */
  const out = [];
  let buffer = '';
  const flush = () => {
    if (!buffer) return;
    const last = out.at(-1);
    if (last?.kind === 'text') last.text += buffer;
    else out.push({ kind: 'text', text: buffer });
    buffer = '';
  };
  let index = 0;
  while (index < source.length) {
    const char = source[index];
    if (char === '\\' && index + 1 < source.length && ESCAPABLE.includes(source[index + 1])) {
      buffer += source[index + 1];
      index += 2;
      continue;
    }
    if (char === '*' && source[index + 1] === '*') {
      const close = findStrongClose(source, index + 2);
      if (close > index + 2) {
        flush();
        out.push({ kind: 'strong', text: unescapeInline(source.slice(index + 2, close)) });
        index = close + 2;
        continue;
      }
    }
    if (char === '`') {
      const close = source.indexOf('`', index + 1);
      if (close > index + 1) {
        flush();
        out.push({ kind: 'code', text: source.slice(index + 1, close) });
        index = close + 1;
        continue;
      }
    }
    if (char === '[') {
      const match = /^\[(\d{1,3})\]/.exec(source.slice(index, index + 5));
      if (match && Number(match[1]) > 0) {
        flush();
        out.push({ kind: 'cite', text: match[0], n: Number(match[1]) });
        index += match[0].length;
        continue;
      }
    }
    buffer += char;
    index += 1;
  }
  flush();
  return out;
}

/**
 * Finds the `**` that closes a bold run opened just before `from`, skipping escaped asterisks.
 * @param {string} source
 * @param {number} from
 * @returns {number} Index of the closing marker, or -1.
 */
function findStrongClose(source, from) {
  for (let index = from; index < source.length - 1; index += 1) {
    if (source[index] === '\\') {
      index += 1;
      continue;
    }
    if (source[index] === '*' && source[index + 1] === '*') return index;
  }
  return -1;
}

/** @param {string} text @returns {string} The text with its backslash escapes resolved. */
function unescapeInline(text) {
  return text.replace(/\\([*`[\\])/g, '$1');
}

/**
 * The visible text of a run of model text: markers dropped, citations kept as `[n]`.
 * @param {unknown} text
 * @returns {string}
 */
export function inlineText(text) {
  return parseInline(text).map((segment) => segment.text).join('');
}

/* ------------------------------------------------------------------ figures -- */

/**
 * Reads a figures row in either form.
 * @param {FigureRow} row
 * @returns {{label: string, detail: string, value: string, call: string|null}}
 */
export function figureRow(row) {
  if (Array.isArray(row)) return { label: String(row[0] ?? ''), detail: String(row[1] ?? ''), value: String(row[2] ?? ''), call: null };
  return {
    label: String(row?.label ?? ''),
    detail: String(row?.detail ?? ''),
    value: String(row?.value ?? ''),
    call: typeof row?.call === 'string' && row.call ? row.call : null
  };
}

/* ------------------------------------------------------------------ export -- */

/**
 * An answer as plain text, for search and screen-reader summaries: markers dropped, one blank line
 * between blocks.
 * @param {Block[]} blocks
 * @returns {string}
 */
export function blocksToText(blocks) {
  return (Array.isArray(blocks) ? blocks : []).map((block) => {
    switch (block?.type) {
      case 'list': return block.items.map((item) => inlineText(item)).join('\n');
      case 'code': return block.code;
      case 'table': return [block.columns, ...block.rows].map((row) => row.map((cell) => inlineText(cell)).join('\t')).join('\n');
      case 'figures': return block.rows.map((row) => {
        const { label, detail, value } = figureRow(row);
        return [label, detail, value].filter(Boolean).join('\t');
      }).join('\n');
      case 'callout': return [block.title, inlineText(block.text)].filter(Boolean).join('\n');
      case 'artifact': return block.title;
      default: return inlineText(/** @type {{text?: string}} */ (block)?.text ?? '');
    }
  }).filter(Boolean).join('\n\n');
}

/** @param {string} cell @returns {string} A table cell safe inside a Markdown pipe row. */
function markdownCell(cell) {
  return String(cell ?? '').replaceAll('|', '\\|').replaceAll('\n', ' ');
}

/**
 * An answer as Markdown, for copying and export. Inline markers are already Markdown and pass
 * through as written.
 * @param {Block[]} blocks
 * @returns {string}
 */
export function blocksToMarkdown(blocks) {
  return (Array.isArray(blocks) ? blocks : []).map((block) => {
    switch (block?.type) {
      case 'heading': return `${'#'.repeat(block.level === 3 ? 3 : 2)} ${block.text}`;
      case 'quote': return block.text.split('\n').map((line) => `> ${line}`).join('\n');
      case 'list': return block.items.map((item, index) => `${block.ordered ? `${index + 1}.` : '-'} ${item}`).join('\n');
      case 'code': return `\`\`\`${block.language ?? ''}\n${block.code}\n\`\`\``;
      case 'table': {
        const rows = [block.columns, block.columns.map(() => '---'), ...block.rows];
        return rows.map((row) => `| ${row.map(markdownCell).join(' | ')} |`).join('\n');
      }
      case 'figures': return block.rows.map((row) => {
        const { label, detail, value } = figureRow(row);
        return `- ${label}${detail ? ` (${detail})` : ''}: **${value}**`;
      }).join('\n');
      case 'callout': return `> ${block.title ? `**${block.title}** ` : ''}${block.text}`;
      case 'artifact': return `**${block.title}**`;
      default: return /** @type {{text?: string}} */ (block)?.text ?? '';
    }
  }).filter(Boolean).join('\n\n');
}

/* ------------------------------------------------------------------ runs -- */

/**
 * @typedef {Object} TraceSummary
 * @property {number} steps Steps that are not retries.
 * @property {number} calls Tool calls made, retries included.
 * @property {number} retries Steps that repeat another.
 * @property {number} failed Steps that failed and were not retried successfully.
 * @property {number} sources Sources looked at, across all searches.
 * @property {number} ms Time spent on finished steps.
 * @property {TraceStep|null} running The step running now, if any.
 * @property {TraceStep|null} stopped The step the run was stopped at, if any.
 */

/** Step kinds that are not tool calls. */
const NOT_CALLS = new Set(['think', 'handoff', 'task', 'ask', 'decision']);

/**
 * What a run's steps add up to, for the one-line summary its trace folds into.
 * @param {TraceStep[]} steps
 * @returns {TraceSummary}
 */
export function traceSummary(steps) {
  const list = Array.isArray(steps) ? steps : [];
  const retried = new Set(list.map((step) => step.retryOf).filter(Boolean));
  let calls = 0;
  let retries = 0;
  let failed = 0;
  let sources = 0;
  let ms = 0;
  /** @type {TraceStep|null} */
  let running = null;
  /** @type {TraceStep|null} */
  let stopped = null;
  for (const step of list) {
    const status = normalizeRunState(step.status ?? 'done');
    if (!NOT_CALLS.has(step.kind ?? 'call')) calls += 1;
    if (step.retryOf) retries += 1;
    if (status === 'failed' && !retried.has(step.id)) failed += 1;
    if (typeof step.sources === 'number' && Number.isFinite(step.sources)) sources += step.sources;
    if (status === 'running' && !running) running = step;
    if (status === 'stopped' && !stopped) stopped = step;
    if (status !== 'running' && typeof step.ms === 'number' && Number.isFinite(step.ms)) ms += step.ms;
  }
  return { steps: list.length - retries, calls, retries, failed, sources, ms, running, stopped };
}

/**
 * How long something took, the way a person says it: "0.8 s" below ten seconds, then "12 s",
 * "1 min 42 s", "1 h 5 min".
 * @param {number} ms
 * @param {{locale?: string}} [options]
 * @returns {string}
 */
export function formatDuration(ms, options = {}) {
  const value = Number(ms);
  if (!Number.isFinite(value) || value < 0) return '';
  if (value < 10_000) return `${formatNumber(value / 1000, { decimals: 1, locale: options.locale })} s`;
  return formatElapsed(value);
}

/**
 * A running clock in whole units: "2 s", "41 s", "1 min 42 s", "1 h 5 min".
 * @param {number} ms
 * @returns {string}
 */
export function formatElapsed(ms) {
  const value = Number(ms);
  if (!Number.isFinite(value) || value < 0) return '';
  const seconds = Math.floor(value / 1000);
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ${seconds % 60} s`;
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

/**
 * What a run cost, from its token counts and per-token prices.
 * @param {[number, number]|null|undefined} tokens Input and output tokens.
 * @param {{in: number, out: number}} price Price per input and per output token.
 * @returns {number}
 */
export function runCost(tokens, price) {
  if (!Array.isArray(tokens) || !price) return 0;
  const input = Number(tokens[0]) || 0;
  const output = Number(tokens[1]) || 0;
  return input * (Number(price.in) || 0) + output * (Number(price.out) || 0);
}

/**
 * Initials for an avatar from a name: "Finance agent" → "FA".
 * @param {string} name
 * @returns {string}
 */
export function initialsOf(name) {
  const words = String(name ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const letters = words.length === 1 ? [...words[0]].slice(0, 2) : [[...words[0]][0], [...words.at(-1) ?? ''][0]];
  return letters.join('').toUpperCase();
}
