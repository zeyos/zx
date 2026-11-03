// @ts-check
import { Component } from '../../core/component.js';
import { formatDate, isSameDay } from '../../core/date.js';
import { h, restoreTarget, snapshotTarget } from '../../core/dom.js';
import { formatCurrency, formatNumber } from '../../core/format.js';
import { getLanguage, printf } from '../../core/i18n.js';
import { AGENT_MESSAGES, STATUS, formatElapsed, normalizeRunState } from '../../internal/agent-model.js';
import { button } from '../button/button.js';
import { statusIcon } from '../select/glyphs.js';

/** @typedef {import('../../internal/agent-model.js').RunState} RunState */

/**
 * A button beside the run's state, for what the reader can do about it now: "Review the request"
 * while it waits, "Renew the consent" when it failed.
 * @typedef {Object} RunStatusAction
 * @property {string} label Visible label.
 * @property {'default'|'primary'|'danger'|'ghost'} [kind='default'] Visual intent.
 * @property {string|null} [icon=null] Icon name.
 * @property {(event: MouseEvent) => void} [onclick] Called on activation, before the `action` event.
 */

/**
 * What a run has cost so far, and the budget it may spend.
 * @typedef {Object} RunCost
 * @property {number} amount Spent so far.
 * @property {number|null} [budget] The most it may spend. With a budget the cost is a meter that
 * turns to the warning tone from 80% and to the danger tone at 100%.
 * @property {string} [currency] ISO 4217 code, such as `EUR`.
 */

/** @typedef {{done: number, total: number}} RunSteps */

/**
 * Tokens a run has used: `[input, output]`, or the total as a single number.
 * @typedef {[number, number]|number} RunTokens
 */

/**
 * How the state is drawn on its own: `'word'` is the glyph and the word (`compact: true`), `'icon'`
 * the glyph alone with the word kept for assistive technology and the tooltip.
 * @typedef {'word'|'icon'} RunCompactMode
 */

/**
 * The tokens drawn as a meter against their budget.
 * @typedef {Object} RunTokenMeter
 * @property {number} total Tokens used.
 * @property {number} budget The most the run may use.
 * @property {'normal'|'warning'|'danger'} level `warning` from 80%, `danger` at 100%.
 * @property {string} text "22.8K of 60K tokens".
 */

/** A local ISO date-time string (`2026-09-29T11:20:04`) or a `Date`. @typedef {string|Date} RunTime */

/**
 * @typedef {Object} RunStatusOptions
 * @property {RunState} [state='queued'] Where the run stands. Also the root's `data-state`. A
 * `blocked` run is not over: it shows since when it is blocked, never a finished time.
 * @property {string} [summary=''] One sentence on what is happening: "Step 3 of 6 needs your
 * approval." Text only.
 * @property {RunSteps|null} [steps=null] Steps done out of the total, drawn as a progressbar.
 * @property {RunTime|null} [started=null] When the run started.
 * @property {RunTime|null} [finished=null] When it finished, failed, or was stopped. Shown once
 * the run is over.
 * @property {number|null} [workMs=null] How long the agent has worked, in milliseconds. Waiting
 * for a person is not work. The row shows only when this is a number.
 * @property {RunTime|null} [waitingSince=null] Since when the run has waited for a person, or been
 * blocked. Shown as "Waiting since" while the state is `waiting` and "Blocked since" while it is
 * `blocked`.
 * @property {RunTokens|null} [tokens=null] Input and output tokens as `[in, out]`, or the total as
 * one number.
 * @property {number|null} [tokenBudget=null] The most tokens the run may use. With a budget the
 * tokens are a meter, read in compact figures ("22.8K of 60K tokens"), that turns to the warning
 * tone from 80% and to the danger tone at 100%. Without one they stay text.
 * @property {RunCost|null} [cost=null] What the run has cost, against its budget.
 * @property {string|null} [model=null] The model the agent runs on.
 * @property {RunStatusAction[]} [actions=[]] Buttons under the summary.
 * @property {boolean} [ticking=true] While the state is `running`, the working time counts on
 * once a second from `workMs` and the moment of the last `update()`. One interval, which sleeps
 * while the page is hidden.
 * @property {boolean|'icon'} [compact=false] Draws only the state: `true` as a pill of glyph and
 * word for a narrow header, `'icon'` as the glyph alone, its word visually hidden but still the
 * accessible text, and shown as the pill's tooltip.
 * @property {(() => Date)|null} [now=null] The clock: what decides whether a time is today (a
 * time on another day shows its date too) and what the working time counts against while
 * `ticking`. Null is real time. Fixed at construction.
 * @property {string} [locale] BCP 47 tag for numbers and amounts; defaults to the active language.
 * @property {Record<string, string>|Record<string, Record<string, string>>} [msg] Localized
 * messages: the state words (`agent.status.*`) and the `runStatus.*` labels.
 * @property {(event: CustomEvent<{index: number, action: RunStatusAction}>) => void} [onaction]
 * Action listener.
 */

/**
 * The run's values as they stand. `workMs` includes the time counted since the last update.
 * @typedef {Object} RunStatusState
 * @property {RunState} state
 * @property {string} summary
 * @property {RunSteps|null} steps
 * @property {RunTime|null} started
 * @property {RunTime|null} finished
 * @property {number|null} workMs
 * @property {RunTime|null} waitingSince
 * @property {RunTokens|null} tokens
 * @property {number|null} tokenBudget
 * @property {RunCost|null} cost
 * @property {string|null} model
 * @property {RunStatusAction[]} actions
 */

const MESSAGES = Object.freeze({
  ...AGENT_MESSAGES,
  'runStatus.started': 'Started',
  'runStatus.workingTime': 'Working time',
  'runStatus.waitingSince': 'Waiting since',
  'runStatus.blockedSince': 'Blocked since',
  'runStatus.finished': 'Finished',
  'runStatus.failedAt': 'Failed at',
  'runStatus.stoppedAt': 'Stopped at',
  'runStatus.model': 'Model',
  'runStatus.tokens': 'Tokens',
  'runStatus.tokensValue': '%1 in · %2 out',
  'runStatus.tokenBudget': '%1 of %2 tokens',
  'runStatus.costLabel': 'Cost',
  'runStatus.cost': '%1 of %2',
  'runStatus.stepsLabel': 'Steps done',
  'runStatus.steps': '%1 of %2 steps',
  'runStatus.timeFormat': '%H:%M',
  'runStatus.dateTimeFormat': '%e %b, %H:%M'
});

/** The values `update()` merges; everything else is fixed at construction. */
const VALUE_KEYS = Object.freeze(['state', 'summary', 'steps', 'started', 'finished', 'workMs', 'waitingSince',
  'tokens', 'tokenBudget', 'cost', 'model', 'actions', 'ticking', 'compact']);

/** The label of the "finished" row for each state that ends a run. */
const FINISHED_KEYS = Object.freeze({
  done: 'runStatus.finished',
  failed: 'runStatus.failedAt',
  stopped: 'runStatus.stoppedAt',
  skipped: 'runStatus.finished'
});

/**
 * The label of the "since" row for each state that holds the run for someone or something. A
 * blocked run is not over: it shows since when it has been blocked, never when it finished.
 */
const SINCE_KEYS = Object.freeze({
  waiting: 'runStatus.waitingSince',
  blocked: 'runStatus.blockedSince'
});

/** What can take focus inside the panel, in document order. */
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), '
  + 'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Where an agent's run stands: its state in a glyph and a word, a sentence on what is happening,
 * its steps as a progressbar, when it started and how long the agent has worked, what it has cost
 * against its budget, and the buttons for what the reader can do about it now. `compact` draws the
 * state alone, for a header.
 *
 * It announces nothing itself: the conversation the run belongs to says when it starts, waits,
 * fails, or finishes.
 *
 * @fires RunStatus#action
 * @extends {Component<RunStatusOptions>}
 */
export class RunStatus extends Component {
  static cssName = 'run-status';

  /** @type {Readonly<RunStatusOptions>} */
  static defaults = {
    state: 'queued',
    summary: '',
    steps: null,
    started: null,
    finished: null,
    workMs: null,
    waitingSince: null,
    tokens: null,
    tokenBudget: null,
    cost: null,
    model: null,
    actions: [],
    ticking: true,
    compact: false,
    now: null,
    msg: MESSAGES
  };

  /** @returns {HTMLElement} */
  render() {
    const created = !this.el;
    const root = /** @type {HTMLElement} */ (this.el ?? h('div'));
    this.el = root;
    this._original = created ? null : snapshotTarget(root);
    if (!created) root.replaceChildren();
    /** @type {Record<string, any>} */
    this._values = {};
    for (const key of VALUE_KEYS) this._values[key] = copyValue(this.options[key]);
    this._workBase = finiteOrNull(this.options.workMs);
    this._workAt = this._clock();
    /** @type {HTMLElement|null} */
    this._elapsed = null;
    /** @type {HTMLElement|null} The action row as drawn, kept across updates that leave it unchanged. */
    this._actionsEl = null;
    this._actionsKey = '';
    /** Whether the root took `tabindex="-1"` to hold focus that had nowhere else to go. */
    this._heldFocus = false;
    /** @type {ReturnType<typeof setInterval>|0} */
    this._interval = 0;
    this._destroyed = false;
    const doc = root.ownerDocument;
    this.listen(root, 'click', (event) => this._onClick(/** @type {MouseEvent} */ (event)));
    this.listen(root, 'blur', () => this._releaseFocus());
    this.listen(doc, 'visibilitychange', () => {
      if (!doc.hidden) this._tick();
      this._syncTicker();
    });
    this._draw();
    return root;
  }

  /**
   * Merges new values and redraws. The working time carries on from where it stood unless the
   * update brings a new `workMs`. Focus inside the panel stays where it was: an action row that
   * did not change is kept as it is, and otherwise focus moves to the action at the same index (or
   * the nearest one left), or to the panel itself when no action is left.
   * @param {Partial<Omit<RunStatusOptions, 'locale'|'msg'|'onaction'|'now'>>} values
   * @returns {this}
   */
  update(values = {}) {
    if (this._destroyed || !values || typeof values !== 'object') return this;
    const current = this._workTime();
    for (const key of VALUE_KEYS) {
      if (Object.hasOwn(values, key)) this._values[key] = copyValue(/** @type {Record<string, unknown>} */ (values)[key]);
    }
    this._workBase = Object.hasOwn(values, 'workMs') ? finiteOrNull(values.workMs) : current;
    this._workAt = this._clock();
    this._draw();
    return this;
  }

  /** @returns {RunStatusState} The run's values as they stand, as copies. */
  getState() {
    const values = this._values;
    return {
      state: normalizeRunState(values.state),
      summary: String(values.summary ?? ''),
      steps: copyValue(values.steps) ?? null,
      started: values.started ?? null,
      finished: values.finished ?? null,
      workMs: this._workTime(),
      waitingSince: values.waitingSince ?? null,
      tokens: copyValue(values.tokens) ?? null,
      tokenBudget: finiteOrNull(values.tokenBudget),
      cost: copyValue(values.cost) ?? null,
      model: values.model ?? null,
      actions: Array.isArray(values.actions) ? [...values.actions] : []
    };
  }

  /** Stops the clock, removes what the component drew, and restores an enhanced target. @returns {void} */
  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    this._stopTicker();
    this._releaseFocus();
    super.destroy();
    if (this._original) restoreTarget(this.el, this._original);
  }

  /** @private @returns {number} Milliseconds on the clock the working time counts against. */
  _clock() {
    return typeof this.options.now === 'function' ? currentTime(this.options.now).getTime() : clock();
  }

  /** @private @returns {number|null} Milliseconds worked, including the time counted since the last update. */
  _workTime() {
    if (this._workBase === null) return null;
    const counting = this._values.ticking !== false && normalizeRunState(this._values.state) === 'running';
    return this._workBase + (counting ? Math.max(0, this._clock() - this._workAt) : 0);
  }

  /** @private @returns {void} */
  _draw() {
    const root = /** @type {HTMLElement} */ (this.el);
    const values = this._values;
    const state = normalizeRunState(values.state);
    const mode = compactMode(values.compact);
    const focus = this._focusKey();
    if (root.ownerDocument.activeElement !== root) this._releaseFocus();
    root.dataset.state = state;
    if (mode) root.setAttribute('data-compact', mode === 'icon' ? 'icon' : '');
    else root.removeAttribute('data-compact');
    this._elapsed = null;
    if (mode) {
      this._actionsEl = null;
      this._actionsKey = '';
      const word = this.msg(STATUS[state].key);
      this._place([h('span', { class: 'zx-run-status__pill', title: mode === 'icon' ? word : undefined },
        ...this._stateParts(state))]);
      this._restoreFocus(focus);
      this._syncTicker();
      return;
    }
    const steps = stepProgress(values.steps);
    const summary = values.summary == null ? '' : String(values.summary);
    const rows = this._rows(state);
    this._place([
      h('p', { class: 'zx-run-status__state' }, ...this._stateParts(state)),
      summary ? h('p', { class: 'zx-run-status__summary' }, summary) : null,
      steps ? this._steps(steps) : null,
      this._actions(),
      rows.length ? h('dl', { class: 'zx-run-status__props' }, rows.map(([key, value]) => h('div', { class: 'zx-run-status__prop' },
        h('dt', { class: 'zx-run-status__label' }, this.msg(key)),
        h('dd', { class: 'zx-run-status__value' }, value)))) : null
    ]);
    this._restoreFocus(focus);
    this._syncTicker();
  }

  /**
   * Puts the drawn parts in the root in order. A part kept from the last draw stays where it is
   * rather than being taken out and put back, so focus inside it survives.
   * @private
   * @param {Array<Node|null>} parts
   * @returns {void}
   */
  _place(parts) {
    const root = /** @type {HTMLElement} */ (this.el);
    const nodes = parts.filter((node) => node !== null);
    const keep = new Set(nodes);
    for (const node of Array.from(root.childNodes)) {
      if (!keep.has(node)) node.remove();
    }
    let next = root.firstChild;
    for (const node of nodes) {
      if (node === next) next = next.nextSibling;
      else root.insertBefore(node, next);
    }
  }

  /**
   * The action row: the one already drawn when the actions read the same, a new one otherwise.
   * @private
   * @returns {HTMLElement|null}
   */
  _actions() {
    const actions = Array.isArray(this._values.actions) ? this._values.actions : [];
    if (!actions.length) {
      this._actionsEl = null;
      this._actionsKey = '';
      return null;
    }
    const key = JSON.stringify(actions.map((action) => [String(action?.label ?? ''), action?.kind ?? null, action?.icon ?? null]));
    if (this._actionsEl && key === this._actionsKey) return this._actionsEl;
    this._actionsKey = key;
    this._actionsEl = h('div', { class: 'zx-run-status__actions' }, actions.map((action, index) => {
      const element = button({
        label: String(action?.label ?? ''), kind: action?.kind, icon: action?.icon ?? null, size: 'sm'
      });
      element.dataset.runAction = String(index);
      return element;
    }));
    return this._actionsEl;
  }

  /**
   * Where focus is inside the panel, in terms that survive a redraw: the index of an action, or
   * of a focusable element among all of them.
   * @private
   * @returns {{action: number}|{focusable: number}|null} Null when focus is elsewhere, or on the root.
   */
  _focusKey() {
    const root = /** @type {HTMLElement} */ (this.el);
    const active = root.ownerDocument.activeElement;
    if (!active || active === root || !root.contains(active)) return null;
    const control = /** @type {HTMLElement|null} */ (active.closest('[data-run-action]'));
    if (control && root.contains(control)) return { action: Number(control.dataset.runAction) };
    const index = Array.from(root.querySelectorAll(FOCUSABLE)).indexOf(active);
    return index >= 0 ? { focusable: index } : null;
  }

  /**
   * Puts focus back after a redraw when the element that had it is gone: on the action at the same
   * index or the nearest one left, else on the focusable at the same index, else on the root.
   * @private
   * @param {{action: number}|{focusable: number}|null} key What `_focusKey()` returned before the draw.
   * @returns {void}
   */
  _restoreFocus(key) {
    if (!key) return;
    const root = /** @type {HTMLElement} */ (this.el);
    const active = root.ownerDocument.activeElement;
    if (active && active !== root.ownerDocument.body && root.contains(active)) return;
    const pick = (/** @type {Element[]} */ list, /** @type {number} */ index) => list[Math.min(index, list.length - 1)] ?? null;
    const target = 'action' in key
      ? pick(Array.from(root.querySelectorAll('[data-run-action]')), key.action)
        ?? pick(Array.from(root.querySelectorAll(FOCUSABLE)), 0)
      : pick(Array.from(root.querySelectorAll(FOCUSABLE)), key.focusable);
    if (target instanceof HTMLElement) {
      target.focus({ preventScroll: true });
      return;
    }
    if (!root.hasAttribute('tabindex')) {
      root.tabIndex = -1;
      this._heldFocus = true;
    }
    root.focus({ preventScroll: true });
  }

  /** @private Gives back the `tabindex` the root took to hold focus. @returns {void} */
  _releaseFocus() {
    if (!this._heldFocus) return;
    this._heldFocus = false;
    this.el.removeAttribute('tabindex');
  }

  /** @private @param {RunState} state @returns {Node[]} The state's glyph and its word. */
  _stateParts(state) {
    const entry = STATUS[state];
    return [
      statusIcon(entry.status, { tone: /** @type {import('../select/glyphs.js').StatusTone} */ (entry.tone) }),
      h('span', { class: 'zx-run-status__word' }, this.msg(entry.key))
    ];
  }

  /** @private @param {{done: number, total: number, percent: number}} steps @returns {HTMLElement} */
  _steps(steps) {
    const locale = this.options.locale;
    const done = formatNumber(steps.done, { locale });
    const total = formatNumber(steps.total, { locale });
    return h('div', { class: 'zx-run-status__steps' },
      h('span', {
        class: 'zx-run-status__bar',
        role: 'progressbar',
        'aria-label': this.msg('runStatus.stepsLabel'),
        'aria-valuemin': '0',
        'aria-valuemax': String(steps.total),
        'aria-valuenow': String(steps.done),
        'aria-valuetext': this.msg('runStatus.steps', done, total)
      }, h('span', { class: 'zx-run-status__bar-fill', style: { inlineSize: `${steps.percent}%` } })),
      h('span', { class: 'zx-run-status__steps-text', 'aria-hidden': 'true' }, `${done}/${total}`));
  }

  /**
   * The property rows that apply to the state: started, working time, waiting or blocked since,
   * or finished, then model, tokens, and cost.
   * @private
   * @param {RunState} state
   * @returns {Array<[string, Node|string|Array<Node>]>}
   */
  _rows(state) {
    const values = this._values;
    const locale = this.options.locale;
    const keys = runTimeKeys(state);
    /** @type {Array<[string, Node|string|Array<Node>]>} */
    const rows = [];
    const started = this._time(values.started);
    if (started) rows.push(['runStatus.started', started]);
    const worked = this._workTime();
    if (worked !== null) {
      this._elapsed = h('span', { class: 'zx-run-status__elapsed' }, formatElapsed(worked));
      rows.push(['runStatus.workingTime', this._elapsed]);
    }
    const since = keys.since ? this._time(values.waitingSince) : null;
    if (since && keys.since) rows.push([keys.since, since]);
    const finished = keys.finished ? this._time(values.finished) : null;
    if (finished && keys.finished) rows.push([keys.finished, finished]);
    if (values.model) rows.push(['runStatus.model', String(values.model)]);
    const meter = tokenMeter(values.tokens, values.tokenBudget, { locale, template: this.msg('runStatus.tokenBudget') });
    if (meter) {
      rows.push(['runStatus.tokens', [
        h('span', { class: 'zx-run-status__tokens', 'aria-hidden': 'true' }, meter.text),
        this._meter(this.msg('runStatus.tokens'), meter.total, meter.budget, meter.text)
      ]]);
    } else {
      const tokens = formatTokens(values.tokens, { locale, template: this.msg('runStatus.tokensValue') });
      if (tokens) rows.push(['runStatus.tokens', tokens]);
    }
    const cost = this._cost(values.cost);
    if (cost) rows.push(['runStatus.costLabel', cost]);
    return rows;
  }

  /** @private @param {unknown} value @returns {HTMLElement|null} A `<time>` with the clock time, and the date when it is not today. */
  _time(value) {
    const date = runDate(value);
    if (!date) return null;
    const format = isSameDay(date, currentTime(this.options.now)) ? 'runStatus.timeFormat' : 'runStatus.dateTimeFormat';
    return h('time', { datetime: formatDate(date, '%Y-%m-%dT%H:%M:%S') }, formatDate(date, this.msg(format)));
  }

  /** @private @param {unknown} cost @returns {Node[]|null} The cost, and a meter against the budget when there is one. */
  _cost(cost) {
    const text = formatRunCost(cost, { locale: this.options.locale, template: this.msg('runStatus.cost') });
    if (!text) return null;
    const { amount, budget } = /** @type {RunCost} */ (cost);
    const limit = Number(budget);
    if (!(limit > 0)) return [h('span', { class: 'zx-run-status__cost' }, text)];
    return [
      h('span', { class: 'zx-run-status__cost', 'aria-hidden': 'true' }, text),
      this._meter(this.msg('runStatus.costLabel'), Math.max(0, Number(amount) || 0), limit, text)
    ];
  }

  /**
   * A thin `role="meter"` bar of a value against its limit, toned by how close it is.
   * @private
   * @param {string} label
   * @param {number} value
   * @param {number} limit
   * @param {string} text The value in words, its `aria-valuetext`.
   * @returns {HTMLElement}
   */
  _meter(label, value, limit, text) {
    return h('span', {
      class: 'zx-run-status__meter',
      role: 'meter',
      'aria-label': label,
      'aria-valuemin': '0',
      'aria-valuemax': String(limit),
      'aria-valuenow': String(Math.min(value, limit)),
      'aria-valuetext': text,
      dataset: { level: costLevel(value, limit) }
    }, h('span', { class: 'zx-run-status__meter-fill', style: { inlineSize: `${Math.min(100, (value / limit) * 100)}%` } }));
  }

  /** @private @returns {boolean} Whether the working time should count on screen now. */
  _shouldTick() {
    return !this._destroyed
      && this._values.ticking !== false
      && normalizeRunState(this._values.state) === 'running'
      && this._elapsed !== null
      && !this.el.ownerDocument.hidden;
  }

  /** @private @returns {void} */
  _syncTicker() {
    if (this._shouldTick()) {
      if (!this._interval) this._interval = setInterval(() => this._tick(), 1000);
    } else {
      this._stopTicker();
    }
  }

  /** @private @returns {void} */
  _stopTicker() {
    if (this._interval) clearInterval(this._interval);
    this._interval = 0;
  }

  /** @private @returns {void} */
  _tick() {
    const worked = this._workTime();
    if (this._elapsed && worked !== null) this._elapsed.textContent = formatElapsed(worked);
  }

  /** @private @param {MouseEvent} event @returns {void} */
  _onClick(event) {
    const target = event.target instanceof Element ? event.target : null;
    const control = /** @type {HTMLElement|null} */ (target?.closest('[data-run-action]') ?? null);
    if (!control || !this.el.contains(control)) return;
    const index = Number(control.dataset.runAction);
    const action = /** @type {RunStatusAction|undefined} */ (this._values.actions?.[index]);
    if (!action) return;
    if (typeof action.onclick === 'function') action.onclick(event);
    this.emit('action', { index, action });
  }
}

/**
 * Fired when one of the run's action buttons is activated.
 * @event RunStatus#action
 * @type {CustomEvent<{index: number, action: RunStatusAction}>}
 */

/** @returns {number} A monotonic clock in milliseconds. */
function clock() {
  return typeof performance === 'object' && typeof performance.now === 'function' ? performance.now() : Date.now();
}

/** @param {unknown} value @returns {number|null} */
function finiteOrNull(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * A shallow copy, so the options and later updates are never mutated or shared.
 * @template T
 * @param {T} value
 * @returns {T}
 */
function copyValue(value) {
  if (Array.isArray(value)) return /** @type {T} */ ([...value]);
  if (value && typeof value === 'object' && !(value instanceof Date)) return /** @type {T} */ ({ ...value });
  return value;
}

/**
 * How close a run's cost is to its budget: `'warning'` from 80%, `'danger'` at 100% and over,
 * `'normal'` below, and without a budget.
 * @param {number} amount
 * @param {number|null|undefined} budget
 * @returns {'normal'|'warning'|'danger'}
 */
export function costLevel(amount, budget) {
  const limit = Number(budget);
  const spent = Number(amount);
  if (!(limit > 0) || !Number.isFinite(spent)) return 'normal';
  const ratio = spent / limit;
  if (ratio >= 1) return 'danger';
  if (ratio >= 0.8) return 'warning';
  return 'normal';
}

/**
 * Reads a steps count: whole numbers, the done count kept within the total. Null for no steps.
 * @param {unknown} steps `{done, total}`.
 * @returns {{done: number, total: number, percent: number}|null}
 */
export function stepProgress(steps) {
  if (!steps || typeof steps !== 'object') return null;
  const { done, total } = /** @type {{done?: unknown, total?: unknown}} */ (steps);
  const all = Math.max(0, Math.floor(Number(total) || 0));
  if (all === 0) return null;
  const finished = Math.min(all, Math.max(0, Math.floor(Number(done) || 0)));
  return { done: finished, total: all, percent: Math.round((finished / all) * 100) };
}

/**
 * Token counts in words: "18,420 in · 1,236 out" for a pair, "22,840" for a total. Empty without
 * counts.
 * @param {unknown} tokens `[input, output]`, or the total as one number.
 * @param {{locale?: string, template?: string}} [options={}] `template` takes the two formatted
 * counts of a pair as `%1` and `%2`.
 * @returns {string}
 */
export function formatTokens(tokens, options = {}) {
  if (typeof tokens === 'number') {
    return Number.isFinite(tokens) ? formatNumber(Math.max(0, tokens), { locale: options.locale }) : '';
  }
  if (!Array.isArray(tokens) || tokens.length < 2) return '';
  const counts = tokens.slice(0, 2).map((count) => Math.max(0, Number(count) || 0));
  return printf(options.template ?? MESSAGES['runStatus.tokensValue'],
    counts.map((count) => formatNumber(count, { locale: options.locale })));
}

/**
 * How many tokens a run has used in all: the number itself, or input and output added up.
 * @param {unknown} tokens `[input, output]`, or the total as one number.
 * @returns {number|null} Null without counts.
 */
export function tokenTotal(tokens) {
  if (typeof tokens === 'number') return Number.isFinite(tokens) ? Math.max(0, tokens) : null;
  if (!Array.isArray(tokens) || tokens.length < 2) return null;
  return tokens.slice(0, 2).reduce((sum, count) => sum + Math.max(0, Number(count) || 0), 0);
}

/**
 * A count in the locale's compact notation (`Intl.NumberFormat` with `notation: 'compact'`) and at
 * most one decimal: "22.8K", "60K", "1.2M" in English, "22.840" in German, which has no compact
 * form for thousands.
 * @param {number} value
 * @param {{locale?: string}} [options={}]
 * @returns {string} Empty for anything that is not a finite number.
 */
export function formatCompactNumber(value, options = {}) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '';
  const number = value;
  /** @type {Intl.NumberFormatOptions} */
  const format = { notation: 'compact', maximumFractionDigits: 1 };
  try {
    return new Intl.NumberFormat(options.locale ?? getLanguage(), format).format(number);
  } catch {
    return new Intl.NumberFormat(undefined, format).format(number);
  }
}

/**
 * The tokens as a meter against their budget: the total, the budget, the level (`warning` from
 * 80%, `danger` at 100%, as for the cost), and the words "22.8K of 60K tokens". Null without
 * counts or without a budget above zero, when the tokens stay text.
 * @param {unknown} tokens `[input, output]`, or the total as one number.
 * @param {unknown} budget The most tokens the run may use.
 * @param {{locale?: string, template?: string}} [options={}] `template` takes the compact total and
 * budget as `%1` and `%2`.
 * @returns {RunTokenMeter|null}
 */
export function tokenMeter(tokens, budget, options = {}) {
  const total = tokenTotal(tokens);
  const limit = typeof budget === 'number' ? budget : Number.NaN;
  if (total === null || !(limit > 0) || !Number.isFinite(limit)) return null;
  const locale = options.locale;
  return {
    total,
    budget: limit,
    level: costLevel(total, limit),
    text: printf(options.template ?? MESSAGES['runStatus.tokenBudget'],
      [formatCompactNumber(total, { locale }), formatCompactNumber(limit, { locale })])
  };
}

/**
 * Reads the `compact` option: `'icon'` for the glyph alone, `'word'` for any other truthy value
 * (the pill of glyph and word), null for the full panel.
 * @param {unknown} value
 * @returns {RunCompactMode|null}
 */
export function compactMode(value) {
  if (value === 'icon') return 'icon';
  return value ? 'word' : null;
}

/**
 * The message keys of the time rows a state shows besides "Started": the "since" row while the
 * run is held (`waiting`: "Waiting since", `blocked`: "Blocked since"), and the "finished" row
 * once it is over ("Finished", "Failed at", "Stopped at"). A blocked run is not over, so it never
 * shows a finished row.
 * @param {unknown} state
 * @returns {{since: string|null, finished: string|null}}
 */
export function runTimeKeys(state) {
  const known = normalizeRunState(state);
  return {
    since: SINCE_KEYS[/** @type {keyof typeof SINCE_KEYS} */ (known)] ?? null,
    finished: FINISHED_KEYS[/** @type {keyof typeof FINISHED_KEYS} */ (known)] ?? null
  };
}

/**
 * Reads the `now` option: the date its function returns (a `Date` or a millisecond timestamp),
 * or the real time when there is no function or it returns nothing usable.
 * @param {unknown} now
 * @returns {Date}
 */
export function currentTime(now) {
  if (typeof now === 'function') {
    const value = now();
    const date = value instanceof Date ? new Date(value.getTime()) : typeof value === 'number' ? new Date(value) : null;
    if (date && !Number.isNaN(date.getTime())) return date;
  }
  return new Date();
}

/**
 * A run's cost in words: "€0.14 of €2.00" against a budget, "€0.14" without one. Empty without a
 * cost.
 * @param {unknown} cost `{amount, budget?, currency?}`.
 * @param {{locale?: string, template?: string}} [options={}] `template` takes the amount and the
 * budget as `%1` and `%2`.
 * @returns {string}
 */
export function formatRunCost(cost, options = {}) {
  if (!cost || typeof cost !== 'object') return '';
  const { amount, budget, currency } = /** @type {RunCost} */ (cost);
  if (!Number.isFinite(Number(amount))) return '';
  const spent = formatCurrency(Number(amount), currency, { locale: options.locale });
  const limit = Number(budget);
  if (budget == null || !(limit > 0)) return spent;
  return printf(options.template ?? MESSAGES['runStatus.cost'], [spent, formatCurrency(limit, currency, { locale: options.locale })]);
}

/**
 * Reads a run time: a `Date`, or a local ISO date-time string (`2026-09-29T11:20:04`; a bare date
 * is midnight local time). Null for anything else.
 * @param {unknown} value
 * @returns {Date|null}
 */
export function runDate(value) {
  /** @type {Date|null} */
  let date = null;
  if (value instanceof Date) date = new Date(value.getTime());
  else if (typeof value === 'string' && value.trim()) {
    const text = value.trim();
    date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(text) ? `${text}T00:00` : text);
  }
  return date && !Number.isNaN(date.getTime()) ? date : null;
}
