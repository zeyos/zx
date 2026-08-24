import { Component } from '../../core/component.js';
import { h, restoreTarget, snapshotTarget } from '../../core/dom.js';
import { icon as createIcon } from '../../core/icons.js';
import { uid } from '../../core/util.js';
import { button } from '../button/button.js';
import { Field } from '../field/field.js';
import { ProgressBar } from '../loading/progress-bar.js';
import {
  applyExclusive, isEmptyAnswer, normalizeItems, progressOf, resolveFlow, resolveNext, validateAnswer
} from './items.js';

/** @typedef {import('./items.js').QuestionnaireItem} QuestionnaireItem */
/** @typedef {import('./items.js').QuestionnaireChoice} QuestionnaireChoice */
/** @typedef {import('./items.js').NormalizedItem} NormalizedItem */
/** @typedef {import('./items.js').QuestionnaireProgress} QuestionnaireProgress */

/** @typedef {'manual'|'auto'} QuestionnaireAdvance */
/** @typedef {'asking'|'review'|'complete'} QuestionnaireStatus */

/** How long a picked answer stays visible before `advance: 'auto'` moves on, in milliseconds. */
const AUTO_ADVANCE_DELAY = 260;

/**
 * @typedef {Object} QuestionnaireOptions
 * @property {QuestionnaireItem[]} [items=[]] Ordered question definitions.
 * @property {Record<string, unknown>} [answers={}] Answers to start from. Together with `active`
 *   this is the resume pair: hand back what a previous session collected.
 * @property {string|null} [active=null] Item to open, defaulting to the first visible one.
 * @property {boolean} [progress=true] Whether the progress bar and counter are shown.
 * @property {boolean} [review=false] Whether a summary of every answer is shown before submitting.
 * @property {QuestionnaireAdvance} [advance='manual'] `auto` moves on by itself once a
 *   single-choice question is answered.
 * @property {boolean} [shortcuts=true] Whether `1`–`9` and `a`–`z` pick an answer.
 * @property {boolean} [allowBack=true] Whether the Back action is offered.
 * @property {Record<string, string>|Record<string, Record<string, string>>} [msg] Localized messages.
 * @property {(event: CustomEvent<QuestionnaireChangeDetail>) => void} [onchange] Answer listener.
 * @property {(event: CustomEvent<QuestionnaireNavigateDetail>) => void} [onnavigate] Navigation listener.
 * @property {(event: CustomEvent<QuestionnaireSkipDetail>) => void} [onskip] Skip listener.
 * @property {(event: CustomEvent<QuestionnaireInvalidDetail>) => void} [oninvalid] Validation listener.
 * @property {(event: CustomEvent<QuestionnaireSubmitDetail>) => void} [onsubmit] Submit listener.
 * @property {(event: CustomEvent<QuestionnaireCompleteDetail>) => void} [oncomplete] Completion listener.
 */

/**
 * @typedef {Object} QuestionnaireChangeDetail
 * @property {string} name Item whose answer changed.
 * @property {unknown} value The new answer.
 * @property {Record<string, unknown>} answers Every visible answer after the change.
 */

/**
 * @typedef {Object} QuestionnaireNavigateDetail
 * @property {string|null} from Item being left, or null.
 * @property {string|null} to Item being opened, or null when the review screen is being entered.
 * @property {'next'|'previous'|'skip'|'goto'|'review'} reason What triggered the move.
 */

/** @typedef {{name: string}} QuestionnaireSkipDetail */
/** @typedef {{name: string, message: string}} QuestionnaireInvalidDetail */
/** @typedef {{answers: Record<string, unknown>, path: string[]}} QuestionnaireSubmitDetail */
/** @typedef {{answers: Record<string, unknown>, path: string[]}} QuestionnaireCompleteDetail */

/**
 * A guided, one-question-at-a-time flow: onboarding intake, a service-call checklist, an audit
 * form, a feedback survey. The questionnaire owns the ordered items, the active one, the answers,
 * validation, progress and navigation; the page, card, dialog or drawer around it owns closing,
 * persistence and transport.
 *
 * Three things separate it from a `Form` with one `Fieldset` per question. It **branches**: an item
 * carries a `when` predicate and a `next` target, conditions cascade, and Back retraces the path
 * actually walked rather than an array index. Its answer control is **any registered Zx `Field`
 * type**, so a question can ask for a date, a number, a rating or an upload instead of a choice.
 * And its `validate` may be asynchronous, which is what lets a question be gated on a server check.
 *
 * The root is a real `<form>` and choices are native radios and checkboxes carrying the item name,
 * so `new FormData(questionnaire.toElement())` reads the answers, arrow-key navigation inside a
 * choice group is the browser's rather than ours, and nothing depends on JavaScript for semantics.
 *
 * @fires Questionnaire#change
 * @fires Questionnaire#navigate
 * @fires Questionnaire#skip
 * @fires Questionnaire#invalid
 * @fires Questionnaire#submit
 * @fires Questionnaire#complete
 * @extends {Component<QuestionnaireOptions>}
 */
export class Questionnaire extends Component {
  static cssName = 'questionnaire';

  /** @type {QuestionnaireOptions & {msg: Record<string, string>}} */
  static defaults = {
    items: [],
    answers: {},
    active: null,
    progress: true,
    review: false,
    advance: 'manual',
    shortcuts: true,
    allowBack: true,
    msg: {
      'questionnaire.next': 'Continue',
      'questionnaire.previous': 'Back',
      'questionnaire.skip': 'Skip',
      'questionnaire.submit': 'Submit',
      'questionnaire.review': 'Review answers',
      'questionnaire.reviewTitle': 'Check your answers',
      'questionnaire.edit': 'Edit',
      'questionnaire.counter': 'Question %1 of %2',
      'questionnaire.required': 'Choose an answer to continue.',
      'questionnaire.requiredInput': 'Enter an answer to continue.',
      'questionnaire.noAnswer': 'Skipped',
      'questionnaire.empty': 'There is nothing to answer.'
    }
  };

  /**
   * Builds the questionnaire. Runs inside the base constructor, so every piece of instance state
   * is initialized here rather than in class fields.
   * @returns {HTMLElement}
   */
  render() {
    this._createdRoot = this.el === null;
    this._snapshot = this._createdRoot ? null : snapshotTarget(this.el);
    this._destroyed = false;
    /** @type {NormalizedItem[]} */
    this._items = [];
    /** @type {Map<string, Array<string|number>>} */
    this._selected = new Map();
    /** @type {Map<string, string>} */
    this._freeform = new Map();
    /** @type {Map<string, Field>} */
    this._fields = new Map();
    /** @type {string[]} */
    this._path = [];
    /** @type {QuestionnaireStatus} */
    this._status = 'asking';
    this._returnToReview = false;
    this._busy = false;
    this._error = '';
    this._advanceTimer = 0;
    this._uid = uid('zx-questionnaire');

    const root = /** @type {HTMLElement} */ (this.el ?? h('form'));
    this.el = root;

    // Radios group by name within their form owner. A questionnaire enhancing a plain element
    // therefore gets an inner form, or two instances showing a same-named question would fight
    // over one selection — and `toFormData()` would have nothing to read.
    this._form = root.localName === 'form' ? root : h('form', { class: 'zx-questionnaire__form' });
    this._form.setAttribute('novalidate', '');

    this._progressHost = h('div', { class: 'zx-questionnaire__progress', hidden: !this.options.progress });
    this._itemHost = h('fieldset', {
      class: 'zx-questionnaire__item',
      tabIndex: -1
    });
    this._reviewHost = h('div', { class: 'zx-questionnaire__review', tabIndex: -1, hidden: true });
    this._actionsHost = h('div', { class: 'zx-questionnaire__actions' });
    this.refs.item = this._itemHost;
    this.refs.review = this._reviewHost;
    this.refs.actions = this._actionsHost;

    this._bar = new ProgressBar(null, { max: 100, value: 0, size: 'sm', showValue: false });
    this._progressHost.append(this._bar.el);

    this._back = this._action('previous', this.msg('questionnaire.previous'), 'chevron-left', 'default');
    this._skip = this._action('skip', this.msg('questionnaire.skip'), null, 'ghost');
    this._forward = this._action('next', this.msg('questionnaire.next'), 'chevron-right', 'primary');
    this._actionsHost.append(this._back, h('span', { class: 'zx-questionnaire__spacer' }), this._skip, this._forward);

    this._form.replaceChildren(this._progressHost, this._itemHost, this._reviewHost, this._actionsHost);
    if (this._form !== root) root.replaceChildren(this._form);

    this.listen(this._form, 'submit', (event) => {
      event.preventDefault();
      void this.next();
    });
    this.listen(this._itemHost, 'change', (event) => this._onControlChange(event));
    this.listen(this._itemHost, 'input', (event) => this._onFreeformInput(event));
    this.listen(this._actionsHost, 'click', (event) => this._onActionClick(event));
    this.listen(this._reviewHost, 'click', (event) => this._onReviewClick(event));
    this.listen(root, 'keydown', (event) => this._onKeydown(/** @type {KeyboardEvent} */ (event)));

    this.setItems(this.options.items);
    if (this.options.answers && typeof this.options.answers === 'object') {
      this.setAnswers(this.options.answers, { silent: true });
    }
    if (this.options.active != null) {
      const start = String(this.options.active);
      const visible = resolveFlow(this._items, this._rawAnswers()).visible;
      if (visible.some((item) => item.name === start)) this._path = [start];
    }
    this._paint();
    return root;
  }

  /**
   * Replaces the whole item list. Answers survive for items that are still present, and so does
   * the active item; when it is gone the first visible item takes over. This is a structural
   * change, so it never emits `navigate`.
   * @param {QuestionnaireItem[]} list Item definitions.
   * @returns {this}
   * @throws {TypeError} When the list, an item, or a name is malformed, or a name repeats.
   */
  setItems(list) {
    const previous = this.getActive();
    const items = normalizeItems(list);
    const names = new Set(items.map((item) => item.name));
    this._items = items;

    for (const map of [this._selected, this._freeform]) {
      for (const name of [...map.keys()]) if (!names.has(name)) map.delete(name);
    }
    for (const [name, field] of [...this._fields]) {
      if (names.has(name)) continue;
      field.destroy();
      this._fields.delete(name);
    }

    const visible = resolveFlow(items, this._rawAnswers()).visible;
    const kept = this._path.filter((name) => visible.some((item) => item.name === name));
    if (previous && kept[kept.length - 1] === previous) this._path = kept;
    else this._path = visible.length > 0 ? [visible[0].name] : [];
    this._status = 'asking';
    this._returnToReview = false;
    this._error = '';
    this._paint();
    return this;
  }

  /**
   * Returns the normalized items, including ones currently conditioned out.
   * @returns {NormalizedItem[]}
   */
  getItems() {
    return this._items.map((item) => ({
      ...item,
      choices: item.choices.map((choice) => ({ ...choice })),
      input: item.input ? { ...item.input } : null
    }));
  }

  /**
   * Opens an item without validating the one being left — what the review screen's Edit action
   * does. An item already on the path truncates it, so Back keeps working; a new one is appended.
   * @param {string} name Item name.
   * @returns {boolean} False when the move was vetoed or the item is conditioned out.
   * @throws {RangeError} When no item carries that name.
   * @fires Questionnaire#navigate
   */
  goTo(name) {
    const item = this._items.find((candidate) => candidate.name === name);
    if (!item) throw new RangeError(`Unknown questionnaire item: ${name}`);
    const visible = resolveFlow(this._items, this._rawAnswers()).visible;
    if (!visible.includes(item)) return false;
    const restore = this._returnToReview;
    // Set before navigating: `_navigate()` paints, and the forward button's label reads this.
    this._returnToReview = restore || this._status === 'review';
    if (this._navigate(name, 'goto')) return true;
    this._returnToReview = restore;
    return false;
  }

  /**
   * Validates the active item and moves on: to the branch target, then the review screen, then
   * submission. Returns a promise because an item's `validate` may be asynchronous.
   * @returns {Promise<boolean>} False when validation failed or the move was vetoed.
   * @fires Questionnaire#navigate
   * @fires Questionnaire#invalid
   */
  async next() {
    if (this._busy || this._status === 'complete') return false;
    if (this._status === 'review') return this.submit();
    if (!await this._validateActive()) return false;
    if (this._destroyed) return false;

    if (this._returnToReview) {
      this._returnToReview = false;
      return this._enterReview();
    }
    const item = this._activeItem();
    const target = item ? resolveNext(this._items, item, this._rawAnswers()) : null;
    if (target) return this._navigate(target, 'next');
    if (this.options.review) return this._enterReview();
    return this.submit();
  }

  /**
   * Steps back along the path actually walked — which is not `index - 1` once a branch has been
   * taken. From the review screen it reopens the last question.
   * @returns {boolean} False at the start of the questionnaire, or when the move was vetoed.
   * @fires Questionnaire#navigate
   */
  previous() {
    if (this._busy) return false;
    if (this._status === 'review' || this._status === 'complete') {
      const last = this._path[this._path.length - 1];
      if (!last) return false;
      const event = this.emit('navigate', { from: null, to: last, reason: 'previous' });
      if (event.defaultPrevented) return false;
      this._status = 'asking';
      // The last question leads back into review on its own, so nothing needs to be remembered.
      this._returnToReview = false;
      this._error = '';
      this._paint();
      this._focusItem();
      return true;
    }
    if (!this.options.allowBack || this._path.length <= 1) return false;
    const from = this.getActive();
    const to = this._path[this._path.length - 2];
    const event = this.emit('navigate', { from, to, reason: 'previous' });
    if (event.defaultPrevented) return false;
    this._path.pop();
    this._returnToReview = false;
    this._error = '';
    this._paint();
    this._focusItem();
    return true;
  }

  /**
   * Clears the active item's answer and moves on without validating it.
   * @returns {boolean} False when the item is not skippable or the move was vetoed.
   * @fires Questionnaire#skip
   * @fires Questionnaire#navigate
   */
  skip() {
    const item = this._activeItem();
    if (!item || !item.skippable || this._busy) return false;
    this.setAnswer(item.name, null, { silent: true });
    this.emit('skip', { name: item.name });
    if (this._returnToReview) {
      this._returnToReview = false;
      return this._enterReview();
    }
    const target = resolveNext(this._items, item, this._rawAnswers());
    if (target) return this._navigate(target, 'skip');
    if (this.options.review) return this._enterReview();
    return this.submit();
  }

  /**
   * Validates the active item (unless already on the review screen) and submits.
   * @returns {Promise<boolean>} False when validation failed or `submit` was prevented.
   * @fires Questionnaire#submit
   * @fires Questionnaire#complete
   */
  async submit() {
    if (this._busy || this._status === 'complete') return false;
    if (this._status !== 'review' && !await this._validateActive()) return false;
    if (this._destroyed) return false;

    const detail = { answers: this.getAnswers(), path: this.getPath() };
    if (this.emit('submit', detail).defaultPrevented) return false;
    this._status = 'complete';
    this._paint();
    this.emit('complete', { answers: detail.answers, path: detail.path });
    return true;
  }

  /**
   * Returns the answers of every visible question that carries one, in declaration order.
   * Questions conditioned out are left out, so an abandoned branch never submits stale data.
   * @returns {Record<string, unknown>}
   */
  getAnswers() {
    return resolveFlow(this._items, this._rawAnswers()).answers;
  }

  /**
   * Returns one answer, whether or not its question is currently visible.
   * @param {string} name Item name.
   * @returns {unknown}
   */
  getAnswer(name) {
    const item = this._items.find((candidate) => candidate.name === name);
    return item ? this._answerOf(item) : null;
  }

  /**
   * Sets several answers at once.
   * @param {Record<string, unknown>} values Answers keyed by item name.
   * @param {{silent?: boolean}} [options={}] Set `silent` to suppress `change`.
   * @returns {this}
   * @fires Questionnaire#change
   */
  setAnswers(values, { silent = false } = {}) {
    if (!values || typeof values !== 'object') return this;
    for (const [name, value] of Object.entries(values)) {
      if (this._items.some((item) => item.name === name)) this.setAnswer(name, value, { silent: true });
    }
    this._paint();
    if (!silent) {
      const answers = this.getAnswers();
      for (const name of Object.keys(values)) {
        if (name in answers) this.emit('change', { name, value: answers[name], answers });
      }
    }
    return this;
  }

  /**
   * Sets one answer. A value matching a choice selects it; anything else lands in the freeform
   * input when the item has one.
   * @param {string} name Item name.
   * @param {unknown} value New answer, or null to clear it.
   * @param {{silent?: boolean}} [options={}] Set `silent` to suppress `change`.
   * @returns {this}
   * @throws {RangeError} When no item carries that name.
   * @fires Questionnaire#change
   */
  setAnswer(name, value, { silent = false } = {}) {
    const item = this._items.find((candidate) => candidate.name === name);
    if (!item) throw new RangeError(`Unknown questionnaire item: ${name}`);

    if (item.field) {
      this._field(item).setValue(value === undefined ? null : value, { silent: true });
    } else {
      const list = Array.isArray(value) ? value : value == null || value === '' ? [] : [value];
      const keys = new Set(list.map((entry) => String(entry)));
      const matched = item.choices.filter((choice) => keys.has(String(choice.value)));
      for (const choice of matched) keys.delete(String(choice.value));
      this._selected.set(name, matched.map((choice) => choice.value));
      this._freeform.set(name, item.input ? ([...keys][0] ?? '') : '');
    }
    this._paint();
    if (!silent) this._emitChange(item);
    return this;
  }

  /**
   * Returns the active item name, or null on the review or completion screen.
   * @returns {string|null}
   */
  getActive() {
    if (this._status !== 'asking') return null;
    return this._path[this._path.length - 1] ?? null;
  }

  /**
   * Returns the item names visited so far, active last. This is the questionnaire's memory of the
   * route through the branches.
   * @returns {string[]}
   */
  getPath() {
    return [...this._path];
  }

  /**
   * Returns progress along the path walked. `total` is exact while the flow is static and an
   * estimate once a function `next` can jump somewhere the forward walk cannot predict.
   * @returns {QuestionnaireProgress}
   */
  getProgress() {
    return progressOf(this._items, this._rawAnswers(), this._path);
  }

  /**
   * Returns everything a caller needs to resume this questionnaire later.
   * @returns {{active: string|null, status: QuestionnaireStatus, answers: Record<string, unknown>, path: string[], progress: QuestionnaireProgress}}
   */
  getState() {
    return {
      active: this.getActive(),
      status: this._status,
      answers: this.getAnswers(),
      path: this.getPath(),
      progress: this.getProgress()
    };
  }

  /**
   * Returns the visible answers as form data, with one entry per value of a multiple-choice item —
   * the same shape `new FormData(questionnaire.toElement())` produces.
   * @returns {FormData}
   */
  toFormData() {
    const data = new FormData();
    for (const [name, value] of Object.entries(this.getAnswers())) {
      if (Array.isArray(value)) for (const entry of value) data.append(name, String(entry));
      else if (value instanceof File || value instanceof Blob) data.append(name, value);
      else data.append(name, value == null ? '' : String(value));
    }
    return data;
  }

  /**
   * Clears every answer and returns to the first visible question.
   * @returns {this}
   */
  reset() {
    this._selected.clear();
    this._freeform.clear();
    for (const [name, field] of this._fields) {
      const item = this._items.find((candidate) => candidate.name === name);
      field.setValue(item?.field?.value ?? null, { silent: true });
    }
    const visible = resolveFlow(this._items, this._rawAnswers()).visible;
    this._path = visible.length > 0 ? [visible[0].name] : [];
    this._status = 'asking';
    this._returnToReview = false;
    this._error = '';
    this._paint();
    return this;
  }

  /**
   * Moves focus to the active question, which is what a screen reader announces after a move.
   * @returns {this}
   */
  focus() {
    this._focusItem();
    return this;
  }

  /** @returns {void} */
  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    clearTimeout(this._advanceTimer);
    for (const field of this._fields.values()) field.destroy();
    this._fields.clear();
    this._bar?.destroy();
    super.destroy();
    if (!this._createdRoot) restoreTarget(this.el, this._snapshot);
  }

  /* ---------------------------------------------------------------- state */

  /** @returns {NormalizedItem|null} */
  _activeItem() {
    const name = this._path[this._path.length - 1];
    return this._items.find((item) => item.name === name) ?? null;
  }

  /**
   * Every answer given, including ones on branches that are currently conditioned out — walking
   * back into a branch restores what was typed there. `resolveFlow()` filters this down.
   * @returns {Record<string, unknown>}
   */
  _rawAnswers() {
    /** @type {Record<string, unknown>} */
    const answers = {};
    for (const item of this._items) {
      const value = this._answerOf(item);
      if (!isEmptyAnswer(value)) answers[item.name] = value;
    }
    return answers;
  }

  /** @param {NormalizedItem} item @returns {unknown} */
  _answerOf(item) {
    if (item.field) return this._fields.get(item.name)?.getValue() ?? null;
    const selected = this._selected.get(item.name) ?? [];
    const freeform = (this._freeform.get(item.name) ?? '').trim();
    if (item.multiple) return freeform ? [...selected, freeform] : [...selected];
    if (freeform) return freeform;
    return selected.length > 0 ? selected[0] : null;
  }

  /**
   * Returns the item's Field, building it on first use. Fields are cached rather than rebuilt per
   * paint, so what a reader typed survives walking away from the question and back.
   * @param {NormalizedItem} item Item carrying `field` options.
   * @returns {Field}
   */
  _field(item) {
    let field = this._fields.get(item.name);
    if (field) return field;
    const options = /** @type {Record<string, any>} */ (item.field ?? {});
    field = new Field(null, {
      ...options,
      label: options.label ?? item.prompt,
      required: item.required
    });
    field.el.classList.add('zx-questionnaire__field');
    // The legend already asks the question; repeating it above the control would say it twice.
    if (options.label == null) field.el.setAttribute('data-hide-label', '');
    field.on('change', () => {
      this._error = '';
      this._paintError(item);
      this._emitChange(item);
    });
    this._fields.set(item.name, field);
    return field;
  }

  /* ----------------------------------------------------------- navigation */

  /** @param {string} name @param {QuestionnaireNavigateDetail['reason']} reason @returns {boolean} */
  _navigate(name, reason) {
    const from = this.getActive();
    if (from === name && this._status === 'asking') return false;
    if (this.emit('navigate', { from, to: name, reason }).defaultPrevented) return false;

    const index = this._path.indexOf(name);
    if (index >= 0) this._path = this._path.slice(0, index + 1);
    else this._path.push(name);
    this._status = 'asking';
    this._error = '';
    this._paint();
    this._focusItem();
    return true;
  }

  /** @returns {boolean} */
  _enterReview() {
    if (this.emit('navigate', { from: this.getActive(), to: null, reason: 'review' }).defaultPrevented) {
      return false;
    }
    this._status = 'review';
    this._error = '';
    this._paint();
    this._reviewHost.focus?.();
    return true;
  }

  /** @returns {Promise<boolean>} */
  async _validateActive() {
    const item = this._activeItem();
    if (!item) return true;
    const answer = this._answerOf(item);
    let message = validateAnswer(item, answer, (key) => this.msg(key));

    if (!message && typeof item.validate === 'function') {
      this._setBusy(true);
      try {
        message = await item.validate(answer, this.getAnswers());
      } catch (error) {
        message = error instanceof Error ? error.message : String(error);
      } finally {
        if (!this._destroyed) this._setBusy(false);
      }
    }
    if (this._destroyed) return false;

    this._error = message ? String(message) : '';
    this._paintError(item);
    if (!this._error) return true;
    this.emit('invalid', { name: item.name, message: this._error });
    this._focusControl();
    return false;
  }

  /** @param {boolean} busy @returns {void} */
  _setBusy(busy) {
    this._busy = busy;
    if (busy) this.el.setAttribute('aria-busy', 'true');
    else this.el.removeAttribute('aria-busy');
    this._syncState();
    this._paintActions();
  }

  /* -------------------------------------------------------------- painting */

  /** @returns {void} */
  _paint() {
    if (this._destroyed) return;
    this._syncState();
    this._paintProgress();
    if (this._status === 'review') this._paintReview();
    else this._paintItem();
    this._itemHost.hidden = this._status === 'review';
    this._reviewHost.hidden = this._status !== 'review';
    this._paintActions();
  }

  /** @returns {void} */
  _syncState() {
    this.el.dataset.state = this._busy ? 'checking' : this._status;
  }

  /** @returns {void} */
  _paintProgress() {
    this._progressHost.hidden = !this.options.progress || this._items.length === 0;
    if (this._progressHost.hidden) return;
    const progress = this.getProgress();
    const counter = this.msg('questionnaire.counter', progress.index + 1, Math.max(progress.total, 1));
    this._bar.setLabel(progress.section ? `${counter} · ${progress.section}` : counter);
    this._bar.set(this._status === 'asking' ? progress.percent : 100, { silent: true });
    this._bar.setStatus(this._status === 'complete' ? 'success' : 'active');
  }

  /** @returns {void} */
  _paintItem() {
    const item = this._activeItem();
    this._itemHost.toggleAttribute('data-empty', !item);
    if (!item) {
      this._itemHost.replaceChildren(h('p', { class: 'zx-questionnaire__prompt' },
        this.msg('questionnaire.empty')));
      return;
    }

    const promptId = `${this._uid}-prompt`;
    const descriptionId = `${this._uid}-description`;
    const errorId = `${this._uid}-error`;
    const children = [h('legend', { class: 'zx-questionnaire__prompt', id: promptId }, item.prompt)];
    if (item.description) {
      children.push(h('p', { class: 'zx-questionnaire__description', id: descriptionId }, item.description));
    }
    children.push(item.field ? this._field(item).el : this._choices(item));
    children.push(h('p', {
      class: 'zx-questionnaire__error',
      id: errorId,
      role: 'alert',
      hidden: true
    }));

    this._itemHost.replaceChildren(...children);
    this._itemHost.dataset.item = item.name;
    this._itemHost.setAttribute('aria-describedby',
      [item.description ? descriptionId : '', errorId].filter(Boolean).join(' '));
    this._paintError(item);
  }

  /** @param {NormalizedItem} item @returns {HTMLElement} */
  _choices(item) {
    const selected = new Set((this._selected.get(item.name) ?? []).map((value) => String(value)));
    const group = h('div', { class: 'zx-questionnaire__choices' });

    group.append(...item.choices.map((choice, index) => h('label', {
      class: 'zx-questionnaire__choice',
      dataset: { disabled: choice.disabled ? 'true' : null }
    },
    h('input', {
      type: item.multiple ? 'checkbox' : 'radio',
      class: 'zx-questionnaire__control',
      name: item.name,
      value: String(choice.value),
      checked: selected.has(String(choice.value)),
      disabled: choice.disabled,
      dataset: { index }
    }),
    h('span', { class: 'zx-questionnaire__marker', ariaHidden: 'true' }),
    choice.icon ? createIcon(choice.icon, { size: 16 }) : null,
    h('span', { class: 'zx-questionnaire__text' },
      h('span', { class: 'zx-questionnaire__label' }, choice.label),
      choice.description ? h('span', { class: 'zx-questionnaire__hint' }, choice.description) : null),
    choice.key ? h('kbd', { class: 'zx-questionnaire__key', ariaHidden: 'true' }, choice.key) : null)));

    if (item.input) {
      const inputId = `${this._uid}-freeform`;
      const value = this._freeform.get(item.name) ?? '';
      const control = h(item.input.multiline ? 'textarea' : 'input', {
        type: item.input.multiline ? undefined : 'text',
        class: 'zx-questionnaire__freeform-input',
        id: inputId,
        name: item.choices.length > 0 ? `${item.name}__other` : item.name,
        placeholder: item.input.placeholder || undefined,
        maxLength: item.input.maxLength > 0 ? item.input.maxLength : undefined,
        rows: item.input.multiline ? 3 : undefined,
        autocomplete: 'off',
        value
      });
      group.append(h('div', { class: 'zx-questionnaire__freeform' },
        h('label', { class: 'zx-questionnaire__freeform-label', htmlFor: inputId }, item.input.label),
        control));
    }
    return group;
  }

  /** @param {NormalizedItem} item @returns {void} */
  _paintError(item) {
    const error = this._itemHost.querySelector('.zx-questionnaire__error');
    if (error instanceof HTMLElement) {
      error.textContent = this._error;
      error.hidden = !this._error;
    }
    if (this._error) this._itemHost.setAttribute('aria-invalid', 'true');
    else this._itemHost.removeAttribute('aria-invalid');
    const field = item?.field ? this._fields.get(item.name) : null;
    // A Field draws its own highlight; letting it own the message keeps one error, not two.
    if (field) {
      if (this._error) field.setHighlight(this._error, 'danger');
      else field.clearHighlight();
      if (error instanceof HTMLElement) error.hidden = true;
    }
  }

  /** @returns {void} */
  _paintReview() {
    const { answers, visible } = resolveFlow(this._items, this._rawAnswers());
    const rows = this._path
      .map((name) => visible.find((item) => item.name === name))
      .filter((item) => Boolean(item))
      .map((item) => h('div', { class: 'zx-questionnaire__answer' },
        h('dt', { class: 'zx-questionnaire__answer-prompt' }, item.prompt),
        h('dd', {
          class: 'zx-questionnaire__answer-value',
          dataset: { empty: isEmptyAnswer(answers[item.name]) ? 'true' : null }
        }, this._formatAnswer(item, answers[item.name])),
        button({ label: this.msg('questionnaire.edit'), kind: 'ghost', size: 'sm' })));

    for (const [index, row] of rows.entries()) {
      const edit = row.querySelector('button');
      if (edit instanceof HTMLElement) edit.dataset.edit = this._path[index];
    }
    this._reviewHost.replaceChildren(
      h('p', { class: 'zx-questionnaire__review-title' }, this.msg('questionnaire.reviewTitle')),
      h('dl', { class: 'zx-questionnaire__answers' }, ...rows));
  }

  /** @param {NormalizedItem} item @param {unknown} value @returns {string} */
  _formatAnswer(item, value) {
    if (isEmptyAnswer(value)) return this.msg('questionnaire.noAnswer');
    const labels = new Map(item.choices.map((choice) => [String(choice.value), choice.label]));
    const list = Array.isArray(value) ? value : [value];
    return list.map((entry) => labels.get(String(entry)) ?? String(entry)).join(', ');
  }

  /** @returns {void} */
  _paintActions() {
    const item = this._activeItem();
    const review = this._status === 'review';
    const complete = this._status === 'complete';
    // `next()` lets a bad branch target throw; painting must not, or one typo blanks the UI.
    let hasNext = false;
    try {
      hasNext = Boolean(item) && resolveNext(this._items, /** @type {NormalizedItem} */ (item),
        this._rawAnswers()) !== null;
    } catch {
      hasNext = false;
    }

    this._back.hidden = complete || (!review && (!this.options.allowBack || this._path.length <= 1));
    this._back.disabled = this._busy;
    this._skip.hidden = review || complete || !item?.skippable;
    this._skip.disabled = this._busy;
    this._forward.hidden = complete;
    this._forward.disabled = this._busy || (!item && !review);

    const role = review ? 'submit' : this._returnToReview || (!hasNext && this.options.review) ? 'review'
      : hasNext ? 'next' : 'submit';
    if (this._forward.dataset.role !== role) {
      this._forward.dataset.role = role;
      const glyph = role === 'next' ? 'chevron-right' : role === 'review' ? 'list' : 'check';
      this._forward.replaceChildren(createIcon(glyph, { size: 16 }),
        h('span', { class: 'zx-btn__label' }, this.msg(`questionnaire.${role}`)));
    }
  }

  /**
   * @param {string} action @param {string} label @param {string|null} glyph
   * @param {'default'|'primary'|'ghost'} kind @returns {HTMLButtonElement}
   */
  _action(action, label, glyph, kind) {
    const element = button({ label, icon: glyph, kind });
    element.dataset.action = action;
    return element;
  }

  /* -------------------------------------------------------------- handlers */

  /** @param {Event} event @returns {void} */
  _onControlChange(event) {
    const control = event.target;
    if (!(control instanceof HTMLInputElement) || !control.classList.contains('zx-questionnaire__control')) return;
    const item = this._activeItem();
    if (!item) return;
    const choice = item.choices[Number(control.dataset.index)];
    if (!choice) return;

    if (item.multiple) {
      const checked = [...this._itemHost.querySelectorAll('.zx-questionnaire__control')]
        .filter((input) => /** @type {HTMLInputElement} */ (input).checked)
        .map((input) => item.choices[Number(/** @type {HTMLElement} */ (input).dataset.index)].value);
      const values = applyExclusive(item.choices, checked, control.checked ? choice.value : null);
      this._selected.set(item.name, values);
      const keep = new Set(values.map((value) => String(value)));
      for (const input of this._itemHost.querySelectorAll('.zx-questionnaire__control')) {
        /** @type {HTMLInputElement} */ (input).checked = keep.has(/** @type {HTMLInputElement} */ (input).value);
      }
    } else {
      this._selected.set(item.name, [choice.value]);
      // A fixed answer and a freeform one are alternatives, so picking one drops the other.
      this._freeform.set(item.name, '');
      const freeform = this._itemHost.querySelector('.zx-questionnaire__freeform-input');
      if (freeform instanceof HTMLInputElement || freeform instanceof HTMLTextAreaElement) freeform.value = '';
    }

    this._error = '';
    this._paintError(item);
    this._paintProgress();
    this._paintActions();
    this._emitChange(item);
    this._maybeAutoAdvance(item);
  }

  /** @param {Event} event @returns {void} */
  _onFreeformInput(event) {
    const control = event.target;
    const isFreeform = (control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement)
      && control.classList.contains('zx-questionnaire__freeform-input');
    if (!isFreeform) return;
    const item = this._activeItem();
    if (!item) return;

    this._freeform.set(item.name, control.value);
    if (!item.multiple && control.value.trim() !== '') {
      this._selected.set(item.name, []);
      for (const input of this._itemHost.querySelectorAll('.zx-questionnaire__control')) {
        /** @type {HTMLInputElement} */ (input).checked = false;
      }
    }
    this._error = '';
    this._paintError(item);
    this._paintProgress();
    this._paintActions();
    this._emitChange(item);
  }

  /** @param {Event} event @returns {void} */
  _onActionClick(event) {
    const target = event.target instanceof Element ? event.target.closest('[data-action]') : null;
    if (!(target instanceof HTMLElement) || !this._actionsHost.contains(target)) return;
    if (target.dataset.action === 'previous') this.previous();
    else if (target.dataset.action === 'skip') this.skip();
    else void this.next();
  }

  /** @param {Event} event @returns {void} */
  _onReviewClick(event) {
    const target = event.target instanceof Element ? event.target.closest('[data-edit]') : null;
    if (!(target instanceof HTMLElement)) return;
    this.goTo(String(target.dataset.edit));
  }

  /** @param {KeyboardEvent} event @returns {void} */
  _onKeydown(event) {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
    const target = event.target;
    const typing = target instanceof HTMLTextAreaElement
      || (target instanceof HTMLInputElement && !['radio', 'checkbox'].includes(target.type))
      || (target instanceof HTMLElement && target.isContentEditable);

    if (event.key === 'Enter') {
      if (target instanceof HTMLTextAreaElement || target instanceof HTMLButtonElement) return;
      event.preventDefault();
      void this.next();
      return;
    }
    if (!this.options.shortcuts || typing || event.key.length !== 1) return;

    const item = this._activeItem();
    if (!item || this._status !== 'asking') return;
    const wanted = event.key.toLowerCase();
    const index = item.choices.findIndex((choice) => choice.key === wanted && !choice.disabled);
    if (index < 0) return;
    const control = this._itemHost.querySelector(`.zx-questionnaire__control[data-index="${index}"]`);
    if (!(control instanceof HTMLInputElement)) return;
    event.preventDefault();
    control.checked = item.multiple ? !control.checked : true;
    control.focus();
    control.dispatchEvent(new Event('change', { bubbles: true }));
  }

  /** @param {NormalizedItem} item @returns {void} */
  _maybeAutoAdvance(item) {
    if (this.options.advance !== 'auto' || item.multiple || item.input) return;
    clearTimeout(this._advanceTimer);
    // A beat of delay so the picked answer is seen to register before the question is replaced.
    this._advanceTimer = setTimeout(() => {
      if (!this._destroyed && this._activeItem() === item) void this.next();
    }, AUTO_ADVANCE_DELAY);
  }

  /** @param {NormalizedItem} item @returns {void} */
  _emitChange(item) {
    const answers = this.getAnswers();
    this.emit('change', { name: item.name, value: this._answerOf(item), answers });
  }

  /** @returns {void} */
  _focusItem() {
    if (this._status === 'asking') this._itemHost.focus?.();
  }

  /** @returns {void} */
  _focusControl() {
    const item = this._activeItem();
    const field = item?.field ? this._fields.get(item.name) : null;
    if (field) {
      field.focus();
      return;
    }
    const control = this._itemHost.querySelector(
      '.zx-questionnaire__control:not(:disabled), .zx-questionnaire__freeform-input');
    if (control instanceof HTMLElement) control.focus();
    else this._focusItem();
  }
}

/**
 * An answer changed.
 * @event Questionnaire#change
 * @type {CustomEvent<QuestionnaireChangeDetail>}
 */

/**
 * A move between questions, into the review screen, or back. Preventable: call
 * `event.preventDefault()` to refuse the move.
 * @event Questionnaire#navigate
 * @type {CustomEvent<QuestionnaireNavigateDetail>}
 */

/**
 * A skippable question was skipped, clearing its answer.
 * @event Questionnaire#skip
 * @type {CustomEvent<QuestionnaireSkipDetail>}
 */

/**
 * Validation of the active question failed.
 * @event Questionnaire#invalid
 * @type {CustomEvent<QuestionnaireInvalidDetail>}
 */

/**
 * The questionnaire is being submitted. Preventable.
 * @event Questionnaire#submit
 * @type {CustomEvent<QuestionnaireSubmitDetail>}
 */

/**
 * Submission was not prevented and the questionnaire is finished.
 * @event Questionnaire#complete
 * @type {CustomEvent<QuestionnaireCompleteDetail>}
 */
