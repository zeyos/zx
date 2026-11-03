// @ts-check
import { Component } from '../../core/component.js';
import { h, restoreTarget, snapshotTarget } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { formatNumber } from '../../core/format.js';
import { prefersReducedMotion } from '../../core/motion.js';
import { uid } from '../../core/util.js';
import {
  AGENT_MESSAGES, STATUS, formatDuration, formatElapsed, initialsOf, normalizeRunState, traceSummary
} from '../../internal/agent-model.js';
import { Avatar } from '../avatar/avatar.js';
import { copyButton } from '../copy/copy-button.js';
import { statusIcon } from '../select/glyphs.js';

/** @typedef {import('../../internal/agent-model.js').TraceStep} TraceStep */
/** @typedef {import('../../internal/agent-model.js').Author} Author */
/** @typedef {import('../../internal/agent-model.js').ItemRef} ItemRef */
/** @typedef {import('../../internal/agent-model.js').RunState} RunState */
/** @typedef {import('../avatar/avatar.js').AvatarTone} AvatarTone */

/**
 * What kind of step a trace step is: it picks the glyph, and whether the summary counts it as a
 * tool call. `task` is a planned step, `ask` a request a person made, `decision` a person's
 * answer; with `think` and `handoff` they are not tool calls.
 * @typedef {'search'|'read'|'query'|'write'|'run'|'call'|'handoff'|'think'|'task'|'ask'|'decision'} TraceKind
 */

/**
 * How a step's row behaves: a disclosure button when the step has something to open, a plain
 * button when the trace is `selectable`, otherwise a static row.
 * @typedef {'disclosure'|'select'|'static'} RowKind
 */

/**
 * One piece of a step's muted meta line, in the order drawn.
 * @typedef {Object} MetaPart
 * @property {'label'|'count'|'sources'|'actor'|'time'|'tokens'} part What the piece is: a
 * hand-off's own label, the count, a search's sources, who took the step, when it started, the
 * tokens it used.
 * @property {string} text The words shown.
 */

/**
 * @typedef {Object} RunTraceOptions
 * @property {TraceStep[]} [steps=[]] The steps the run took, in the order they started. A step
 * with `retryOf` is drawn under the step it repeats. Model text is data: every string reaches the
 * page as text.
 * @property {boolean} [open=false] Whether the step list starts open under its summary.
 * @property {string|null} [label=null] Text the summary reads instead of the computed "Worked for
 * …" line — a plan's title, "Plan · 5 of 6 done". Any state but done still follows it as a word
 * ("· Running"). `setLabel()` changes it.
 * @property {Record<string, Author>} [authors={}] Who the `actor` and `to` keys of the steps name;
 * a hand-off draws both authors' avatars, round for a `person` and rounded squares otherwise. A key
 * with no entry is shown as written.
 * @property {boolean} [showArguments=true] Whether a step's disclosure shows the arguments its call
 * was made with.
 * @property {number} [maxResult=4000] Characters of a result shown before it is cut, with a
 * "Show all" button for the rest. Zero or a non-finite value shows every result whole.
 * @property {boolean} [summary=true] Whether the steps fold into a summary line. Without it the
 * list always shows — for a run panel whose state is already told beside it.
 * @property {boolean|null} [kindIcons=null] Whether each step leads with its kind's glyph. Without
 * them a step shows only its status. `null` decides by the steps: a plan, where every step is a
 * `task`, shows none; anything else shows them.
 * @property {boolean} [selectable=false] Whether every step can be chosen: a row with nothing to
 * open becomes a button, and a disclosure also reports the step as it opens. Both emit `select`.
 * @property {boolean} [ticking=false] Whether a running step that has `at` shows how long it has
 * run, counting once a second. One interval serves the whole trace; it runs only while such a step
 * is on screen in the open list, and sleeps while the page is hidden.
 * @property {(() => Date)|null} [now=null] The clock `ticking` counts against, for an application
 * whose world is fixed on another date; real time when null.
 * @property {((at: string) => string)|null} [formatTime=null] Writes a step's `at` for its meta
 * line; "10:31:05" (the local ISO time as given) when null.
 * @property {Partial<Record<TraceKind, string>>} [icons={}] Icon names per step kind, over the
 * built-in `STEP_ICONS`.
 * @property {Record<string, string>|Record<string, Record<string, string>>} [msg] Localized
 * messages: the `runTrace.*` keys and the `agent.status.*` words.
 * @property {(event: CustomEvent<{id: string|null, open: boolean}>) => void} [ontoggle] Disclosure
 * listener.
 * @property {(event: CustomEvent<{id: string}>) => void} [onreveal] Reveal listener.
 * @property {(event: CustomEvent<{id: string}>) => void} [onselect] Selection listener
 * (`selectable` traces).
 * @property {(event: CustomEvent<{step: TraceStep, ref: ItemRef}>) => void} [onopen] Listener for
 * a step's links.
 */

/**
 * One drawn step.
 * @typedef {Object} StepEntry
 * @property {TraceStep & {id: string}} step The step as last given.
 * @property {HTMLElement} li Its list item; it outlives redraws of the step.
 * @property {HTMLElement|null} row The row: a disclosure button, a select button, or a plain row.
 * @property {HTMLElement|null} refs The step's links, after its row.
 * @property {HTMLElement|null} body The disclosure's content, when the step has any.
 * @property {HTMLElement|null} retries The nested list of the steps that repeat this one.
 * @property {Avatar[]} avatars Avatars the row owns.
 * @property {string|null} rootId The top-level step a retry is drawn under; null for a top-level step.
 * @property {string|null} bodyId Id of the disclosure content.
 */

/**
 * The trace's overall state and its one-line summary.
 * @typedef {Object} TraceLabel
 * @property {RunState} state `running`, `waiting`, `blocked`, `paused`, `stopped`, `failed`,
 * `queued` (no step has started), or `done`.
 * @property {string} label The summary line: "Worked for 41 s · 5 tool calls · 1 retry".
 * @property {string|null} doing What the running step is doing, or which step is waiting or
 * blocked, without an ellipsis.
 */

/** Built-in glyph per step kind. */
export const STEP_ICONS = Object.freeze({
  search: 'search',
  read: 'file',
  query: 'table',
  write: 'type',
  run: 'code',
  call: 'gear',
  handoff: 'link-2',
  think: 'dots',
  task: 'list',
  ask: 'mail',
  decision: 'check'
});

const MESSAGES = Object.freeze({
  ...AGENT_MESSAGES,
  'runTrace.label': 'Steps',
  'runTrace.worked': 'Worked for %1',
  'runTrace.stoppedAfter': 'Stopped after %1',
  'runTrace.failedAfter': 'Failed after %1',
  'runTrace.blockedAfter': 'Blocked after %1',
  'runTrace.working': 'Working…',
  'runTrace.step': '1 step',
  'runTrace.steps': '%1 steps',
  'runTrace.call': '1 tool call',
  'runTrace.calls': '%1 tool calls',
  'runTrace.source': '1 source',
  'runTrace.sources': '%1 sources',
  'runTrace.retry': '1 retry',
  'runTrace.retries': '%1 retries',
  'runTrace.token': '1 token',
  'runTrace.tokens': '%1 tokens',
  'runTrace.doing': '%1…',
  'runTrace.retried': 'Retried',
  'runTrace.handoff': '%1 handed over to %2',
  'runTrace.arguments': 'Arguments',
  'runTrace.result': 'Result',
  'runTrace.error': 'Error',
  'runTrace.copyArguments': 'Copy arguments',
  'runTrace.copyResult': 'Copy result',
  'runTrace.copyError': 'Copy error',
  'runTrace.copied': 'Copied',
  'runTrace.showAll': 'Show all',
  'runTrace.awaiting': 'Waiting for the result…'
});

/** How long a revealed step stays marked, in milliseconds. */
const REVEAL_MS = 2000;

/** How often a running step's clock counts, in milliseconds. */
const TICK_MS = 1000;

/** Sections of a step's disclosure, with their title and copy-button message keys. */
const SECTIONS = Object.freeze({
  arguments: { title: 'runTrace.arguments', copy: 'runTrace.copyArguments' },
  result: { title: 'runTrace.result', copy: 'runTrace.copyResult' },
  error: { title: 'runTrace.error', copy: 'runTrace.copyError' }
});

/**
 * What an agent did during a run: a one-line summary ("Worked for 41 s · 5 tool calls") that
 * opens into a timeline of its steps. A tool call opens in turn to the arguments it was made with
 * and what came back; a retry is drawn under the call it repeats; a hand-off shows both agents.
 *
 * The trace renders the steps it is given and changes only when the application calls
 * `setSteps()` or `upsert()`; a live run upserts each step as it starts and again as it ends, and
 * only that step is redrawn. The same component draws a plan: `task` steps under a `label` of the
 * plan's own, chosen one at a time with `selectable`.
 *
 * @fires RunTrace#toggle
 * @fires RunTrace#reveal
 * @fires RunTrace#select
 * @fires RunTrace#open
 * @extends {Component<RunTraceOptions>}
 */
export class RunTrace extends Component {
  static cssName = 'run-trace';

  /** @type {Readonly<RunTraceOptions>} */
  static defaults = {
    steps: [],
    open: false,
    label: null,
    authors: {},
    showArguments: true,
    maxResult: 4000,
    summary: true,
    kindIcons: null,
    selectable: false,
    ticking: false,
    now: null,
    formatTime: null,
    icons: {},
    msg: MESSAGES
  };

  /** @returns {HTMLElement} */
  render() {
    const created = !this.el;
    const root = /** @type {HTMLElement} */ (this.el ?? h('div'));
    this.el = root;
    this._original = created ? null : snapshotTarget(root);
    if (!created) root.replaceChildren();
    this._destroyed = false;
    this._open = Boolean(this.options.open);
    /** @type {string|null} The summary text set by `label` or `setLabel()`. */
    this._label = ownLabel(this.options.label);
    /** @type {Array<TraceStep & {id: string}>} */
    this._steps = [];
    /** @type {Map<string, StepEntry>} */
    this._entries = new Map();
    /** @type {Set<string>} Steps whose disclosure is open. */
    this._expanded = new Set();
    /** @type {Set<string>} Steps whose long result is shown whole. */
    this._whole = new Set();
    /** @type {ReturnType<typeof setTimeout>|null} */
    this._revealTimer = null;
    /** @type {ReturnType<typeof setInterval>|null} The one clock every running step counts by. */
    this._clock = null;

    const listId = uid('zx-run-trace');
    this._summaryState = h('span', { class: 'zx-run-trace__summary-state', hidden: true });
    this._summaryText = h('span', { class: 'zx-run-trace__summary-text' });
    this._summaryDoing = h('span', { class: 'zx-run-trace__summary-doing', hidden: true });
    this._summary = h('button', {
      type: 'button',
      class: 'zx-run-trace__summary',
      'aria-expanded': String(this._open),
      'aria-controls': listId,
      dataset: { action: 'summary' }
    },
    h('span', { class: 'zx-run-trace__chevron', 'aria-hidden': 'true' }, icon('chevron-right', { size: 14 })),
    this._summaryState, this._summaryText, this._summaryDoing);
    this._list = h('ol', {
      class: 'zx-run-trace__steps', id: listId, 'aria-label': this.msg('runTrace.label'), hidden: !this._open
    });
    root.append(this._summary, this._list);
    if (this.options.summary === false) {
      this._summary.hidden = true;
      this._list.hidden = false;
      this._open = true;
    }

    this.listen(root, 'click', (event) => this._onClick(/** @type {MouseEvent} */ (event)));
    this.listen(root, 'focusout', (event) => {
      // A plain row is focusable only while a reveal has put focus on it.
      const target = /** @type {HTMLElement|null} */ (event.target instanceof HTMLElement ? event.target : null);
      if (target?.dataset.revealFocus !== undefined) {
        target.removeAttribute('tabindex');
        delete target.dataset.revealFocus;
      }
    });
    if (this.options.ticking) this.listen(root.ownerDocument, 'visibilitychange', () => this._syncClock());
    this._build(this.options.steps);
    return root;
  }

  /**
   * Sets the text the summary reads instead of the computed line; null or an empty string goes
   * back to "Worked for …". Any state but done still follows it as a word.
   * @param {string|null} label
   * @returns {this}
   */
  setLabel(label) {
    this._label = ownLabel(label);
    this._sync();
    return this;
  }

  /**
   * Replaces every step. Open steps stay open, and focus on a step's row stays on that step.
   * @param {TraceStep[]} steps
   * @returns {this}
   */
  setSteps(steps) {
    this._build(steps);
    return this;
  }

  /**
   * Adds a step, or replaces the step with the same `id`. A replaced step is redrawn on its own,
   * keeping its place, its open state, and the retries under it; a new step is appended, under
   * the step it repeats when it has `retryOf`.
   * @param {TraceStep} step
   * @returns {this}
   */
  upsert(step) {
    if (!step || typeof step !== 'object' || step.id == null || step.id === '') return this;
    const next = { ...step, id: String(step.id) };
    const entry = this._entries.get(next.id);
    if (entry) {
      if (String(entry.step.retryOf ?? '') !== String(next.retryOf ?? '')) {
        // It moved under another step: regroup the whole trace.
        this._build(this._steps.map((current) => (current.id === next.id ? next : current)));
        return this;
      }
      this._steps[this._steps.indexOf(entry.step)] = next;
      entry.step = next;
      this._paint(entry);
    } else {
      this._steps.push(next);
      const rootId = this._rootOf(next);
      if (rootId) this._appendRetry(rootId, next);
      else this._list.append(this._createEntry(next, null));
    }
    this._sync();
    return this;
  }

  /**
   * Opens the step list, and the disclosure of the step `id` when one is given.
   * @param {string|null} [id=null]
   * @returns {this}
   */
  expand(id = null) {
    this._setOpen(true);
    if (id != null) this._setStep(String(id), true);
    return this;
  }

  /**
   * Closes the step list, or only the disclosure of the step `id` when one is given.
   * @param {string|null} [id=null]
   * @returns {this}
   */
  collapse(id = null) {
    if (id == null) this._setOpen(false);
    else this._setStep(String(id), false);
    return this;
  }

  /**
   * Shows one step: opens the list and the step, scrolls it into view, puts focus on its row, and
   * marks it with `data-state="revealed"` for two seconds. Under reduced motion the scroll jumps.
   * An unknown id does nothing.
   * @param {string} id
   * @returns {this}
   * @fires RunTrace#reveal
   */
  reveal(id) {
    const entry = this._entries.get(String(id));
    if (!entry?.row) return this;
    this.expand(entry.step.id);
    const row = entry.row;
    for (const other of /** @type {NodeListOf<HTMLElement>} */ (this._list.querySelectorAll('[data-reveal-focus]'))) {
      if (other === row) continue;
      other.removeAttribute('tabindex');
      delete other.dataset.revealFocus;
    }
    const smooth = !prefersReducedMotion(this.el);
    if (typeof entry.li.scrollIntoView === 'function') {
      entry.li.scrollIntoView({ block: 'nearest', behavior: smooth ? 'smooth' : 'auto' });
    }
    if (row.localName !== 'button') {
      row.tabIndex = -1;
      row.dataset.revealFocus = '';
    }
    row.focus({ preventScroll: true });
    this._mark(entry.li);
    this.emit('reveal', { id: entry.step.id });
    return this;
  }

  /** @returns {TraceStep[]} Copies of the steps, in the order they were given. */
  getSteps() {
    return this._steps.map((step) => ({ ...step }));
  }

  /** @returns {boolean} Whether the step list is open. */
  isOpen() {
    return this._open;
  }

  /** @returns {void} */
  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    if (this._revealTimer) clearTimeout(this._revealTimer);
    this._revealTimer = null;
    if (this._clock) clearInterval(this._clock);
    this._clock = null;
    for (const entry of this._entries.values()) this._releaseAvatars(entry);
    this._entries.clear();
    super.destroy();
    if (this._original) restoreTarget(this.el, this._original);
  }

  /* ------------------------------------------------------------------ building -- */

  /**
   * @private
   * @param {unknown} steps
   * @returns {void}
   */
  _build(steps) {
    const focused = this._focusedStep();
    for (const entry of this._entries.values()) this._releaseAvatars(entry);
    this._entries.clear();
    this._list.replaceChildren();
    this._steps = normalizeSteps(steps);
    for (const group of groupRetries(this._steps)) {
      this._list.append(this._createEntry(/** @type {TraceStep & {id: string}} */ (group.step), null));
      for (const retry of group.retries) this._appendRetry(String(group.step.id), /** @type {TraceStep & {id: string}} */ (retry));
    }
    for (const id of [...this._expanded]) if (!this._entries.has(id)) this._expanded.delete(id);
    for (const id of [...this._whole]) if (!this._entries.has(id)) this._whole.delete(id);
    if (focused) this._entries.get(focused)?.row?.focus({ preventScroll: true });
    this._sync();
  }

  /**
   * @private
   * @param {TraceStep & {id: string}} step
   * @param {string|null} rootId
   * @returns {HTMLElement}
   */
  _createEntry(step, rootId) {
    const li = h('li', { class: 'zx-run-trace__step', dataset: { step: step.id } });
    /** @type {StepEntry} */
    const entry = { step, li, row: null, refs: null, body: null, retries: null, avatars: [], rootId, bodyId: null };
    this._entries.set(step.id, entry);
    this._paint(entry);
    return li;
  }

  /**
   * @private
   * @param {string} rootId
   * @param {TraceStep & {id: string}} step
   * @returns {void}
   */
  _appendRetry(rootId, step) {
    const root = this._entries.get(rootId);
    if (!root) {
      this._list.append(this._createEntry(step, null));
      return;
    }
    if (!root.retries) {
      root.retries = h('ol', { class: 'zx-run-trace__retries' });
      root.li.append(root.retries);
    }
    root.retries.append(this._createEntry(step, rootId));
  }

  /**
   * The top-level step a new step is drawn under, or null when it repeats nothing drawn.
   * @private
   * @param {TraceStep} step
   * @returns {string|null}
   */
  _rootOf(step) {
    if (step.retryOf == null || step.retryOf === '') return null;
    const parent = this._entries.get(String(step.retryOf));
    if (!parent || parent.step.id === step.id) return null;
    return parent.rootId ?? parent.step.id;
  }

  /**
   * Draws a step's row, links, and disclosure, replacing the ones it had. The list item, its
   * marks, and the retries under it stay; focus on the row, a link, or the disclosure stays on
   * the step.
   * @private
   * @param {StepEntry} entry
   * @returns {void}
   */
  _paint(entry) {
    const { step, li } = entry;
    const active = this.el.ownerDocument?.activeElement ?? null;
    const focusedRef = active && entry.refs?.contains(active)
      ? /** @type {HTMLElement|null} */ (active.closest('[data-ref-index]'))?.dataset.refIndex ?? null
      : null;
    const hadFocus = Boolean(active && (entry.row?.contains(active) || entry.refs?.contains(active) || entry.body?.contains(active)));
    this._releaseAvatars(entry);

    const status = normalizeRunState(step.status);
    const kind = normalizeKind(step.kind);
    li.dataset.kind = kind;
    li.dataset.status = status;
    if (status === 'running') li.setAttribute('aria-current', 'step');
    else li.removeAttribute('aria-current');

    const mode = rowKind(step, this.options);
    const disclosure = mode === 'disclosure';
    if (disclosure && !entry.bodyId) entry.bodyId = uid('zx-run-trace-step');
    const open = disclosure && this._expanded.has(step.id);
    if (!disclosure) this._expanded.delete(step.id);

    const content = [
      h('span', { class: 'zx-run-trace__tile', 'aria-hidden': 'true' }, icon(this._icon(kind), { size: 14 })),
      this._text(entry, kind, status),
      this._end(step, status),
      h('span', { class: 'zx-run-trace__chevron', 'aria-hidden': 'true' },
        disclosure ? icon('chevron-down', { size: 14 }) : null)
    ];
    let row;
    if (disclosure) {
      row = h('button', {
        type: 'button',
        class: 'zx-run-trace__row',
        'aria-expanded': String(open),
        'aria-controls': entry.bodyId,
        dataset: { action: 'step' }
      }, content);
    } else if (mode === 'select') {
      row = h('button', { type: 'button', class: 'zx-run-trace__row', dataset: { action: 'select' } }, content);
    } else {
      row = h('div', { class: 'zx-run-trace__row' }, content);
    }
    // The links sit beside the row, never inside it: a button holds no other controls.
    const refs = this._refs(step);
    const body = disclosure ? this._body(step, /** @type {string} */ (entry.bodyId), open) : null;

    if (entry.row) entry.row.replaceWith(row);
    else li.prepend(row);
    entry.refs?.remove();
    entry.body?.remove();
    if (refs) row.after(refs);
    if (body) (refs ?? row).after(body);
    entry.row = row;
    entry.refs = refs;
    entry.body = body;
    const again = focusedRef === null ? null
      : /** @type {HTMLElement|null} */ (refs?.querySelector(`[data-ref-index="${focusedRef}"]`) ?? null);
    if (again) again.focus({ preventScroll: true });
    else if (hadFocus) row.focus({ preventScroll: true });
  }

  /**
   * The step's links to the application's own things, as a list of quiet buttons, or null when it
   * has none.
   * @private
   * @param {TraceStep} step
   * @returns {HTMLElement|null}
   */
  _refs(step) {
    const list = stepRefs(step);
    if (!list.length) return null;
    return h('ul', { class: 'zx-run-trace__refs' }, list.map(({ ref, index }) => h('li', {},
      h('button', { type: 'button', class: 'zx-run-trace__ref', dataset: { action: 'ref', refIndex: String(index) } },
        text(ref.icon) ? h('span', { class: 'zx-run-trace__ref-icon', 'aria-hidden': 'true' }, icon(text(ref.icon), { size: 14 })) : null,
        h('span', { class: 'zx-run-trace__ref-label' }, text(ref.label))))));
  }

  /**
   * The step's words: what it did (or is doing), a "Retried" tag, a hand-off's two avatars, and a
   * muted line of its count, who took it, when, and the tokens it used.
   * @private
   * @param {StepEntry} entry
   * @param {TraceKind} kind
   * @param {RunState} status
   * @returns {HTMLElement}
   */
  _text(entry, kind, status) {
    const { step } = entry;
    const label = text(step.label);
    const handoff = kind === 'handoff' && (step.actor || step.to);
    const handoffWords = handoff ? this.msg('runTrace.handoff', this._author(step.actor).name, this._author(step.to).name) : '';
    const doing = text(step.doing).replace(/(?:…|\.\.\.)\s*$/, '');
    const main = status === 'running' && doing ? this.msg('runTrace.doing', doing) : handoffWords || label;
    const parts = stepMeta(step, {
      msg: (key, ...args) => this.msg(key, ...args),
      name: (key) => this._author(key).name,
      formatTime: this.options.formatTime
    });
    const meta = parts.length ? h('span', { class: 'zx-run-trace__meta' }, parts.flatMap((part, index) => {
      const node = part.part === 'time'
        ? h('time', { class: 'zx-run-trace__clock', dateTime: text(step.at) }, part.text)
        : part.text;
      return index ? [' · ', node] : [node];
    })) : null;
    let pair = null;
    if (handoff) {
      const from = this._avatar(step.actor);
      const to = this._avatar(step.to);
      entry.avatars.push(from, to);
      pair = h('span', { class: 'zx-run-trace__handoff', 'aria-hidden': 'true' },
        from.toElement(), h('span', { class: 'zx-run-trace__handoff-line' }), to.toElement());
    }
    return h('span', { class: 'zx-run-trace__text' },
      h('span', { class: 'zx-run-trace__line' },
        entry.rootId ? h('span', { class: 'zx-run-trace__retry' }, this.msg('runTrace.retried')) : null,
        pair,
        h('span', { class: 'zx-run-trace__label' }, main)),
      meta);
  }

  /**
   * The step's state: always a glyph and a word. The word is visible for the states a reader has
   * to notice; a finished step shows its duration instead, and a running one says what it is doing
   * and, with `ticking`, how long it has run.
   * @private
   * @param {TraceStep} step
   * @param {RunState} status
   * @returns {HTMLElement}
   */
  _end(step, status) {
    const state = STATUS[status];
    const quiet = status === 'done' || status === 'running';
    const ms = typeof step.ms === 'number' && Number.isFinite(step.ms) ? step.ms : null;
    // A resumed step counts on from what it had worked before (`ms`) rather than from zero.
    const start = status === 'running' && this.options.ticking ? startOf(step.at) : null;
    const since = start !== null ? start - (ms ?? 0) : null;
    let time = null;
    if (status === 'done' && ms !== null) {
      time = h('span', { class: 'zx-run-trace__time' }, formatDuration(ms));
    } else if (since !== null) {
      time = h('span', { class: 'zx-run-trace__time', dataset: { since: String(since) } }, elapsedSince(since, this._now()));
    }
    return h('span', { class: 'zx-run-trace__end' },
      statusIcon(state.status, { tone: state.tone }),
      h('span', { class: quiet ? 'zx-run-trace__sr' : 'zx-run-trace__word' }, this.msg(state.key)),
      time);
  }

  /**
   * A step's disclosure: the tool, the detail, the arguments, and the result or the error. Who
   * took the step and when are on its row.
   * @private
   * @param {TraceStep & {id: string}} step
   * @param {string} id
   * @param {boolean} open
   * @returns {HTMLElement}
   */
  _body(step, id, open) {
    const status = normalizeRunState(step.status);
    const args = this.options.showArguments !== false && text(step.args) ? prettyArguments(step.args) : '';
    return h('div', { class: 'zx-run-trace__body', id, hidden: !open },
      text(step.tool) ? h('p', { class: 'zx-run-trace__tool' },
        h('code', { class: 'zx-run-trace__tool-name' }, text(step.tool))) : null,
      text(step.detail) ? h('p', { class: 'zx-run-trace__note' }, text(step.detail)) : null,
      args ? this._section('arguments', args, step.id) : null,
      text(step.result) ? this._section('result', text(step.result), step.id) : null,
      text(step.error) ? this._section('error', text(step.error), step.id) : null,
      args && status === 'running' && !text(step.result) && !text(step.error)
        ? h('p', { class: 'zx-run-trace__note' }, this.msg('runTrace.awaiting')) : null);
  }

  /**
   * One block of a disclosure: its title, a copy button, and the text in a `<pre>`. A result
   * longer than `maxResult` is cut, with a button that shows the rest.
   * @private
   * @param {'arguments'|'result'|'error'} kind
   * @param {string} full
   * @param {string} stepId
   * @returns {HTMLElement}
   */
  _section(kind, full, stepId) {
    const keys = SECTIONS[kind];
    const shown = kind === 'result' && !this._whole.has(stepId)
      ? truncateText(full, this.options.maxResult)
      : { text: full, cut: false, length: full.length };
    const titleId = uid('zx-run-trace-section');
    return h('div', { class: 'zx-run-trace__section', dataset: { section: kind } },
      h('div', { class: 'zx-run-trace__section-head' },
        h('span', { class: 'zx-run-trace__section-title', id: titleId }, this.msg(keys.title)),
        copyButton({ text: full, title: this.msg(keys.copy), feedback: this.msg('runTrace.copied'), size: 'sm' })),
      h('pre', {
        class: 'zx-run-trace__code',
        tabindex: '0',
        'aria-labelledby': titleId,
        dataset: { tone: kind === 'error' ? 'danger' : null }
      }, shown.text),
      shown.cut ? h('button', {
        type: 'button', class: 'zx-btn zx-run-trace__more', dataset: { kind: 'ghost', size: 'sm', action: 'show-all' }
      }, this.msg('runTrace.showAll')) : null);
  }

  /* ------------------------------------------------------------------ state -- */

  /**
   * @private
   * @param {boolean} open
   * @returns {void}
   */
  _setOpen(open) {
    if (open === this._open) return;
    this._open = open;
    this._summary.setAttribute('aria-expanded', String(open));
    this._list.hidden = !open;
    this._syncClock();
    this.emit('toggle', { id: null, open });
  }

  /**
   * @private
   * @param {string} id
   * @param {boolean} open
   * @returns {void}
   */
  _setStep(id, open) {
    const entry = this._entries.get(id);
    if (!entry?.body || !entry.row || open === this._expanded.has(id)) return;
    if (open) this._expanded.add(id);
    else this._expanded.delete(id);
    entry.row.setAttribute('aria-expanded', String(open));
    entry.body.hidden = !open;
    this.emit('toggle', { id, open });
  }

  /**
   * Redraws the summary from the steps.
   * @private
   * @returns {void}
   */
  _sync() {
    const root = /** @type {HTMLElement} */ (this.el);
    // A plan — every step a task — shows each step's status alone, unless told otherwise.
    const tiles = this.options.kindIcons ?? !(this._steps.length > 0 && this._steps.every((step) => step.kind === 'task'));
    if (tiles) delete root.dataset.tiles;
    else root.dataset.tiles = 'none';
    const { state, label, doing } = traceLabel(this._steps, (key, ...args) => this.msg(key, ...args), { label: this._label });
    root.dataset.state = state;
    if (this._steps.length) delete root.dataset.empty;
    else root.dataset.empty = '';
    this._summaryText.textContent = label;
    this._summaryDoing.textContent = doing ?? '';
    this._summaryDoing.hidden = !doing;
    const entry = STATUS[state];
    this._summaryState.replaceChildren(state === 'done' ? '' : statusIcon(entry.status, { tone: entry.tone }));
    this._summaryState.hidden = state === 'done';
    this._syncClock();
  }

  /**
   * Starts the one clock while a running step's time is on screen, and stops it otherwise: when
   * no step is running, the list is closed, the page is hidden, or the trace is destroyed.
   * @private
   * @returns {void}
   */
  _syncClock() {
    const counting = !this._destroyed
      && this._open
      && !this.el.ownerDocument?.hidden
      && this._list.querySelector('[data-since]') !== null;
    if (counting && !this._clock) {
      this._tick();
      this._clock = setInterval(() => this._tick(), TICK_MS);
    } else if (!counting && this._clock) {
      clearInterval(this._clock);
      this._clock = null;
    }
  }

  /**
   * Moves every running step's time to the clock's now.
   * @private
   * @returns {void}
   */
  _tick() {
    const slots = /** @type {NodeListOf<HTMLElement>} */ (this._list.querySelectorAll('[data-since]'));
    if (!slots.length) return;
    const now = this._now();
    for (const slot of slots) {
      const next = elapsedSince(Number(slot.dataset.since), now);
      if (slot.textContent !== next) slot.textContent = next;
    }
  }

  /**
   * The time `ticking` counts against: the `now` option's, or real time.
   * @private
   * @returns {number} Milliseconds since the epoch.
   */
  _now() {
    const clock = this.options.now;
    const value = typeof clock === 'function' ? clock() : null;
    const ms = value instanceof Date ? value.getTime() : Number(value ?? Number.NaN);
    return Number.isFinite(ms) ? ms : Date.now();
  }

  /**
   * @private
   * @param {HTMLElement} li
   * @returns {void}
   */
  _mark(li) {
    if (this._revealTimer) clearTimeout(this._revealTimer);
    for (const marked of /** @type {NodeListOf<HTMLElement>} */ (this._list.querySelectorAll('[data-state="revealed"]'))) {
      delete marked.dataset.state;
    }
    li.dataset.state = 'revealed';
    this._revealTimer = setTimeout(() => {
      this._revealTimer = null;
      if (li.dataset.state === 'revealed') delete li.dataset.state;
    }, REVEAL_MS);
  }

  /* ------------------------------------------------------------------ helpers -- */

  /** @private @param {TraceKind} kind @returns {string} */
  _icon(kind) {
    return stepIcon(kind, this.options.icons);
  }

  /**
   * @private
   * @param {unknown} key
   * @returns {{name: string, initials: string, tone: AvatarTone|null, person: boolean}}
   */
  _author(key) {
    const authors = this.options.authors && typeof this.options.authors === 'object' ? this.options.authors : {};
    const id = key == null ? '' : String(key);
    const author = id && Object.hasOwn(authors, id) ? authors[id] : null;
    const name = text(author?.name) || id;
    return {
      name,
      initials: text(author?.initials) || initialsOf(name),
      tone: /** @type {AvatarTone|null} */ (author?.tone ?? null),
      person: author?.kind === 'person'
    };
  }

  /**
   * A hand-off avatar, shaped like the author's avatar everywhere else: round for a person, a
   * rounded square for an agent or a model.
   * @private
   * @param {unknown} key
   * @returns {Avatar}
   */
  _avatar(key) {
    const author = this._author(key);
    return new Avatar(null, {
      name: author.name, initials: author.initials, tone: author.tone, size: 'sm', shape: author.person ? 'circle' : 'rounded'
    });
  }

  /** @private @param {StepEntry} entry @returns {void} */
  _releaseAvatars(entry) {
    for (const avatar of entry.avatars) avatar.destroy();
    entry.avatars = [];
  }

  /** @private @returns {string|null} The step whose row or disclosure has focus. */
  _focusedStep() {
    const active = this.el?.ownerDocument?.activeElement ?? null;
    if (!active || !this._list?.contains(active)) return null;
    const item = /** @type {HTMLElement|null} */ (active.closest('[data-step]'));
    return item?.dataset.step ?? null;
  }

  /**
   * @private
   * @param {MouseEvent} event
   * @returns {void}
   */
  _onClick(event) {
    const target = event.target instanceof Element ? event.target : null;
    const control = /** @type {HTMLElement|null} */ (target?.closest('[data-action]') ?? null);
    if (!control || !this.el.contains(control)) return;
    const action = control.dataset.action;
    if (action === 'summary') {
      this._setOpen(!this._open);
      return;
    }
    const id = /** @type {HTMLElement|null} */ (control.closest('[data-step]'))?.dataset.step;
    const entry = id ? this._entries.get(id) : undefined;
    if (!entry) return;
    if (action === 'step') {
      const open = !this._expanded.has(entry.step.id);
      this._setStep(entry.step.id, open);
      if (open && this.options.selectable) this.emit('select', { id: entry.step.id });
    } else if (action === 'select') {
      this.emit('select', { id: entry.step.id });
    } else if (action === 'ref') {
      const ref = Array.isArray(entry.step.refs) ? entry.step.refs[Number(control.dataset.refIndex)] : null;
      if (ref && typeof ref === 'object') this.emit('open', { step: { ...entry.step }, ref: { ...ref } });
    } else if (action === 'show-all') {
      this._whole.add(entry.step.id);
      this._paint(entry);
      /** @type {HTMLElement|null} */ (entry.body?.querySelector('[data-section="result"] > pre') ?? null)?.focus();
    }
  }
}

/**
 * Fired when the step list or a step's disclosure opens or closes, from a click or a method. `id`
 * is null for the step list.
 * @event RunTrace#toggle
 * @type {CustomEvent<{id: string|null, open: boolean}>}
 */
/**
 * Fired when `reveal()` has shown a step.
 * @event RunTrace#reveal
 * @type {CustomEvent<{id: string}>}
 */
/**
 * Fired in a `selectable` trace when the reader chooses a step: a row with nothing to open is
 * activated, or a step's disclosure is opened by the reader (not by `expand()` or `reveal()`).
 * @event RunTrace#select
 * @type {CustomEvent<{id: string}>}
 */
/**
 * Fired when one of a step's links is activated; the application opens what it names. `step` and
 * `ref` are copies.
 * @event RunTrace#open
 * @type {CustomEvent<{step: TraceStep, ref: ItemRef}>}
 */

/* ------------------------------------------------------------------ pure helpers -- */

/**
 * @param {string} key
 * @param {...unknown} args
 * @returns {string}
 */
function englishMessage(key, ...args) {
  const template = MESSAGES[/** @type {keyof typeof MESSAGES} */ (key)] ?? key;
  return template.replace(/%(\d+)/g, (match, index) => String(args[Number(index) - 1] ?? match));
}

/** @param {unknown} value @returns {string} */
function text(value) {
  return value == null ? '' : String(value);
}

/** @param {unknown} kind @returns {TraceKind} */
function normalizeKind(kind) {
  return typeof kind === 'string' && Object.hasOwn(STEP_ICONS, kind) ? /** @type {TraceKind} */ (kind) : 'call';
}

/** @param {unknown} label @returns {string|null} The label to show, or null for the computed one. */
function ownLabel(label) {
  return label == null || String(label).trim() === '' ? null : String(label);
}

/**
 * "10:31:05" from a local ISO date-time ("10:31:00" when it gives no seconds), or '' for
 * anything else.
 * @param {unknown} at
 * @returns {string}
 */
function clockTime(at) {
  const match = /[T ](\d{2}:\d{2})(?::(\d{2}))?/.exec(text(at));
  return match ? `${match[1]}:${match[2] ?? '00'}` : '';
}

/** @param {unknown} at @returns {number|null} When a step started, or null when `at` is no date. */
function startOf(at) {
  const source = text(at);
  if (!source) return null;
  const ms = Date.parse(source);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * How long something has run, from when it started to now, in whole units: "41 s". A start in
 * the future reads "0 s".
 * @param {number} since Start, in milliseconds since the epoch.
 * @param {number} now
 * @returns {string}
 */
export function elapsedSince(since, now) {
  if (!Number.isFinite(since) || !Number.isFinite(now)) return '';
  return formatElapsed(Math.max(0, now - since));
}

/**
 * The glyph a step kind draws: the application's from `icons`, else the built-in one. An unknown
 * kind draws as a `call`.
 * @param {unknown} kind
 * @param {Partial<Record<TraceKind, string>>|null} [icons]
 * @returns {string}
 */
export function stepIcon(kind, icons = null) {
  const known = normalizeKind(kind);
  const custom = icons && typeof icons === 'object' ? icons[known] : null;
  return typeof custom === 'string' && custom ? custom : STEP_ICONS[known];
}

/**
 * Whether a step has a disclosure to open: arguments (when they are shown), a result, an error,
 * or a detail.
 * @param {TraceStep} step
 * @param {boolean} [showArguments=true]
 * @returns {boolean}
 */
function hasBody(step, showArguments = true) {
  return Boolean((showArguments && text(step.args)) || text(step.result) || text(step.error) || text(step.detail));
}

/**
 * How a step's row behaves: a disclosure when it has something to open, a button that selects
 * the step when the trace is `selectable`, otherwise a static row.
 * @param {TraceStep} step
 * @param {{selectable?: boolean, showArguments?: boolean}} [options]
 * @returns {RowKind}
 */
export function rowKind(step, options = {}) {
  if (step && typeof step === 'object' && hasBody(step, options?.showArguments !== false)) return 'disclosure';
  return options?.selectable ? 'select' : 'static';
}

/**
 * A step's links that can be drawn — objects with a label — with their place in `step.refs`.
 * @param {TraceStep} step
 * @returns {Array<{ref: ItemRef, index: number}>}
 */
function stepRefs(step) {
  const refs = Array.isArray(step?.refs) ? step.refs : [];
  return refs.flatMap((ref, index) => (ref && typeof ref === 'object' && text(ref.label) ? [{ ref, index }] : []));
}

/**
 * A step's muted meta line, in reading order: a hand-off's own label (when the "handed over"
 * words replace it), the count, a search's sources, who took the step (not for a hand-off, whose
 * words name both sides), the clock time it started, and the tokens it used. Each piece only when
 * the step has it.
 * @param {TraceStep} step
 * @param {{msg?: (key: string, ...args: unknown[]) => string, name?: (key: string) => string,
 *   formatTime?: ((at: string) => string)|null}} [context] Message lookup (English by default),
 *   author key → display name (the key itself by default), and a writer for `at`.
 * @returns {MetaPart[]}
 */
export function stepMeta(step, context = {}) {
  if (!step || typeof step !== 'object') return [];
  const msg = context.msg ?? englishMessage;
  const name = context.name ?? ((key) => key);
  /** @type {MetaPart[]} */
  const parts = [];
  const handoff = normalizeKind(step.kind) === 'handoff' && (step.actor || step.to)
    ? msg('runTrace.handoff', name(text(step.actor)), name(text(step.to)))
    : '';
  const label = text(step.label);
  if (handoff && label && label !== handoff) parts.push({ part: 'label', text: label });
  if (text(step.count)) parts.push({ part: 'count', text: text(step.count) });
  if (typeof step.sources === 'number' && step.sources > 0) {
    parts.push({ part: 'sources', text: step.sources === 1 ? msg('runTrace.source') : msg('runTrace.sources', step.sources) });
  }
  if (!handoff && text(step.actor)) parts.push({ part: 'actor', text: name(text(step.actor)) });
  const at = text(step.at);
  const time = at ? (typeof context.formatTime === 'function' ? text(context.formatTime(at)) : clockTime(at)) : '';
  if (time) parts.push({ part: 'time', text: time });
  if (typeof step.tokens === 'number' && Number.isFinite(step.tokens) && step.tokens > 0) {
    parts.push({ part: 'tokens', text: step.tokens === 1 ? msg('runTrace.token') : msg('runTrace.tokens', formatNumber(step.tokens)) });
  }
  return parts;
}

/**
 * Copies the steps, giving each a string id; a later step with an id already seen replaces the
 * earlier one in its place.
 * @param {unknown} steps
 * @returns {Array<TraceStep & {id: string}>}
 */
function normalizeSteps(steps) {
  /** @type {Map<string, TraceStep & {id: string}>} */
  const byId = new Map();
  (Array.isArray(steps) ? steps : []).forEach((step, index) => {
    if (!step || typeof step !== 'object') return;
    const id = step.id == null || step.id === '' ? `step-${index + 1}` : String(step.id);
    byId.set(id, { ...step, id });
  });
  return [...byId.values()];
}

/**
 * Arguments for display: JSON objects and arrays pretty-printed with two spaces, anything else
 * exactly as given.
 * @param {unknown} value
 * @returns {string}
 */
export function prettyArguments(value) {
  const source = text(value);
  try {
    const parsed = JSON.parse(source);
    return parsed !== null && typeof parsed === 'object' ? JSON.stringify(parsed, null, 2) : source;
  } catch {
    return source;
  }
}

/**
 * Cuts a text to at most `max` characters plus an ellipsis, never inside a surrogate pair. Zero, a
 * negative, or a non-finite `max` keeps the whole text.
 * @param {unknown} value
 * @param {unknown} max
 * @returns {{text: string, cut: boolean, length: number}} The text to show, whether it was cut,
 * and the length of the whole.
 */
export function truncateText(value, max) {
  const source = text(value);
  const limit = Math.floor(Number(max));
  if (!Number.isFinite(limit) || limit <= 0 || source.length <= limit) {
    return { text: source, cut: false, length: source.length };
  }
  let end = limit;
  const code = source.charCodeAt(end - 1);
  if (code >= 0xd800 && code <= 0xdbff) end -= 1;
  return { text: `${source.slice(0, end)}…`, cut: true, length: source.length };
}

/**
 * Groups steps for drawing: every step that repeats another (`retryOf`, followed through retries
 * of retries) goes under the first step of its chain. Top-level steps keep their order, and so do
 * the retries under each. A `retryOf` naming no step, or a loop, leaves the step at the top level.
 * @param {TraceStep[]} steps
 * @returns {Array<{step: TraceStep, retries: TraceStep[]}>}
 */
export function groupRetries(steps) {
  const list = (Array.isArray(steps) ? steps : []).filter((step) => step && typeof step === 'object');
  /** @type {Map<string, TraceStep>} */
  const byId = new Map();
  for (const step of list) if (!byId.has(String(step.id))) byId.set(String(step.id), step);
  /** @param {TraceStep} step @returns {TraceStep} */
  const rootOf = (step) => {
    const seen = new Set();
    let current = step;
    while (current.retryOf != null && byId.has(String(current.retryOf)) && !seen.has(String(current.id))) {
      seen.add(String(current.id));
      current = /** @type {TraceStep} */ (byId.get(String(current.retryOf)));
    }
    return seen.has(String(current.id)) ? step : current;
  };
  /** @type {Map<TraceStep, {step: TraceStep, retries: TraceStep[]}>} */
  const groups = new Map();
  const roots = list.map(rootOf);
  list.forEach((step, index) => {
    if (roots[index] === step) groups.set(step, { step, retries: [] });
  });
  list.forEach((step, index) => {
    if (roots[index] !== step) groups.get(roots[index])?.retries.push(step);
  });
  return [...groups.values()];
}

/**
 * The trace's state and its summary line. While a step runs it reads "Working…" and names what
 * the step is doing; a run waiting for a person, or blocked, says so and names the step ("Blocked
 * after 12 s · 3 tool calls"); a paused, stopped, or failed run says so before its counts; a run
 * no step of which has started reads "Not started · 6 steps"; once the run ends it reads "Worked
 * for 41 s · 5 tool calls · 9 sources · 1 retry", each count only when it is not zero.
 *
 * With `label`, the line is that text instead — a plan's title — followed by the state's word for
 * every state but done: "Close September · 2 of 5 done · Running".
 * @param {TraceStep[]} steps
 * @param {(key: string, ...args: unknown[]) => string} [msg] Message lookup; English by default.
 * @param {{label?: string|null}} [options]
 * @returns {TraceLabel}
 */
export function traceLabel(steps, msg = englishMessage, options = {}) {
  const computed = computedLabel(steps, msg);
  const own = ownLabel(options?.label);
  if (own === null) return computed;
  return {
    ...computed,
    label: computed.state === 'done' ? own : `${own} · ${msg(STATUS[computed.state].key)}`
  };
}

/**
 * @param {TraceStep[]} steps
 * @param {(key: string, ...args: unknown[]) => string} msg
 * @returns {TraceLabel}
 */
function computedLabel(steps, msg) {
  const list = Array.isArray(steps) ? steps.filter((step) => step && typeof step === 'object') : [];
  const summary = traceSummary(list);
  const stateOf = (/** @type {TraceStep} */ step) => normalizeRunState(step.status ?? 'done');
  const find = (/** @type {RunState} */ state) => list.find((step) => stateOf(step) === state) ?? null;
  const plain = (/** @type {TraceStep|null} */ step) => (step ? text(step.doing || step.label).replace(/(?:…|\.\.\.)\s*$/, '') || null : null);
  const time = summary.ms > 0 ? formatDuration(summary.ms) : '';
  const stepCount = summary.steps === 1 ? msg('runTrace.step') : msg('runTrace.steps', summary.steps);
  const counts = [
    summary.calls ? (summary.calls === 1 ? msg('runTrace.call') : msg('runTrace.calls', summary.calls)) : '',
    summary.sources ? (summary.sources === 1 ? msg('runTrace.source') : msg('runTrace.sources', summary.sources)) : '',
    summary.retries ? (summary.retries === 1 ? msg('runTrace.retry') : msg('runTrace.retries', summary.retries)) : ''
  ].filter(Boolean);

  if (summary.running) return { state: 'running', label: msg('runTrace.working'), doing: plain(summary.running) };
  const waiting = find('waiting');
  if (waiting) return { state: 'waiting', label: msg(STATUS.waiting.key), doing: plain(waiting) };
  const blocked = find('blocked');
  if (blocked) {
    // A blocked step is doing nothing: it is named by its label, its "…ing" line only without one.
    const head = time ? msg('runTrace.blockedAfter', time) : msg(STATUS.blocked.key);
    return { state: 'blocked', label: [head, ...counts].join(' · '), doing: plain({ ...blocked, doing: blocked.label || blocked.doing }) };
  }
  const paused = find('paused');
  if (paused) return { state: 'paused', label: [msg(STATUS.paused.key), ...counts].join(' · '), doing: null };
  if (list.length && list.every((step) => stateOf(step) === 'queued')) {
    return { state: 'queued', label: [msg(STATUS.queued.key), stepCount].join(' · '), doing: null };
  }

  /** @type {RunState} */
  let state = 'done';
  let head = '';
  if (summary.stopped) {
    state = 'stopped';
    head = time ? msg('runTrace.stoppedAfter', time) : msg(STATUS.stopped.key);
  } else if (summary.failed) {
    state = 'failed';
    head = time ? msg('runTrace.failedAfter', time) : msg(STATUS.failed.key);
  } else if (time) {
    head = msg('runTrace.worked', time);
  } else if (!counts.length) {
    head = stepCount;
  }
  return { state, label: [head, ...counts].filter(Boolean).join(' · '), doing: null };
}
