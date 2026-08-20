import { Component } from '../../core/component.js';
import { h, restoreTarget, snapshotTarget } from '../../core/dom.js';
import { printf } from '../../core/i18n.js';
import { icon } from '../../core/icons.js';
import { completedByAdvance, normalizeSteps, resolveStepIndex, stepIndex, stepState } from './steps.js';

/** @typedef {import('./steps.js').StepDefinition} StepDefinition */
/** @typedef {import('./steps.js').NormalizedStep} NormalizedStep */

/** @typedef {'horizontal'|'vertical'} StepperOrientation */
/** @typedef {'completed'|'all'|false} StepperClickable */
/** @typedef {'upcoming'|'active'|'complete'|'error'} StepperStepState */

/** Layouts the rail supports. */
const ORIENTATIONS = new Set(['horizontal', 'vertical']);
/** Values `clickable` accepts. */
const CLICKABLE = new Set(['completed', 'all', false]);

/**
 * @typedef {Object} StepperOptions
 * @property {StepDefinition[]} [steps=[]] Ordered step definitions.
 * @property {string|null} [active=null] Initially active step name; defaults to the first enabled step.
 * @property {StepperOrientation} [orientation='horizontal'] `horizontal` lays the rail out above the
 *   stage, `vertical` puts it beside the stage.
 * @property {StepperClickable} [clickable='completed'] Which steps are activated by a click:
 *   `completed` (go back only), `all`, or `false` for a display-only rail.
 * @property {boolean} [showNumbers=true] Whether upcoming and active markers show their number.
 * @property {boolean} [counter=false] Whether to render a "Step 2 of 4" line above the rail.
 * @property {Record<string, string>|Record<string, Record<string, string>>} [msg] Localized messages.
 * @property {(event: CustomEvent<StepperChangeDetail>) => void} [onchange] Change listener.
 */

/**
 * @typedef {Object} StepperChangeDetail
 * @property {string} name Name of the step being activated.
 * @property {string|null} previous Name of the step being left, or null.
 * @property {number} index Zero-based index of the step being activated.
 */

/**
 * @typedef {Object} StepperState
 * @property {string|null} active Active step name.
 * @property {number} index Zero-based active index, or -1 when nothing is active.
 * @property {string[]} completed Completed step names, in step order.
 * @property {string[]} errored Errored step names, in step order.
 */

/**
 * @typedef {Object} StepRecord
 * @property {NormalizedStep} step Normalized definition.
 * @property {HTMLLIElement} item List item carrying `data-state` and `aria-current`.
 * @property {HTMLElement} control Button (clickable rails) or span (display-only rails).
 * @property {HTMLElement} marker Number / check / warning bubble.
 * @property {HTMLElement} status Visually hidden state text for assistive technology.
 */

/**
 * A wizard progress rail: an ordered list of steps, each in one of four states, with the active
 * step marked `aria-current="step"`. Advancing past a step marks it complete automatically, so a
 * wizard only has to call `next()` / `previous()` and veto `change` when validation fails.
 *
 * The rail owns no stage: it reports where the user is and where they asked to go. Rendering the
 * step's content stays with the application, exactly as in the checkout and record wizards.
 * @fires Stepper#change
 * @extends {Component<StepperOptions>}
 */
export class Stepper extends Component {
  static cssName = 'stepper';

  /** @type {Readonly<StepperOptions>} */
  static defaults = {
    steps: [],
    active: null,
    orientation: 'horizontal',
    clickable: 'completed',
    showNumbers: true,
    counter: false
  };

  /**
   * Creates or enhances a stepper.
   * @param {Element|string|null} target Existing container, selector, or null.
   * @param {StepperOptions} [options={}] Stepper options.
   */
  constructor(target, options = {}) {
    super(target, options);
  }

  /**
   * Builds the rail. Runs inside the base constructor, so every piece of instance state it needs
   * is initialized here rather than in class fields.
   * @returns {HTMLElement}
   */
  render() {
    this._createdRoot = this.el === null;
    this._snapshot = this._createdRoot ? null : snapshotTarget(this.el);
    this._destroyed = false;
    /** @type {NormalizedStep[]} */
    this._steps = [];
    /** @type {StepRecord[]} */
    this._records = [];
    this._activeIndex = -1;
    /** @type {Set<string>} */
    this._completed = new Set();
    /** @type {Set<string>} */
    this._errored = new Set();

    if (!ORIENTATIONS.has(this.options.orientation)) {
      throw new RangeError(`Unknown stepper orientation: ${this.options.orientation}`);
    }
    if (!CLICKABLE.has(this.options.clickable)) {
      throw new RangeError(`Unknown stepper clickable mode: ${this.options.clickable}`);
    }

    const root = /** @type {HTMLElement} */ (this.el ?? h('div'));
    this.el = root;
    root.dataset.orientation = this.options.orientation;

    const counter = h('p', {
      class: 'zx-stepper__counter',
      ref: 'counter',
      ariaLive: 'polite',
      hidden: true
    });
    const list = h('ol', { class: 'zx-stepper__list', ref: 'list' });
    root.replaceChildren(...(this.options.counter ? [counter, list] : [list]));

    this.setSteps(this.options.steps);

    this.listen(list, 'click', (event) => {
      const control = /** @type {Element} */ (event.target).closest?.('.zx-stepper__control');
      if (!control || !list.contains(control) || control.tagName !== 'BUTTON') return;
      const name = /** @type {HTMLElement} */ (control).dataset.step;
      if (typeof name === 'string') this.goTo(name);
    });
    return root;
  }

  /**
   * Replaces the whole step list. Completion and error flags survive for steps that are still
   * present, and so does the active step; when it is gone the first enabled step takes over. This
   * is a structural change, so it never emits `change`.
   * @param {StepDefinition[]} list Step definitions.
   * @returns {this}
   */
  setSteps(list) {
    const previous = this.getActive();
    const steps = normalizeSteps(list);
    const names = new Set(steps.map((step) => step.name));
    this._steps = steps;
    this._completed = new Set([...this._completed].filter((name) => names.has(name)));
    this._errored = new Set([...this._errored].filter((name) => names.has(name)));

    const wanted = previous ?? (this.options.active === null ? null : String(this.options.active));
    let index = wanted === null ? -1 : stepIndex(steps, wanted);
    if (index >= 0 && steps[index].disabled) index = -1;
    if (index < 0) index = resolveStepIndex(steps, -1, 1);
    this._activeIndex = index;

    this._records = steps.map((step) => this._createRecord(step));
    this.refs.list.replaceChildren(...this._records.map((record) => record.item));
    this._sync();
    return this;
  }

  /**
   * Activates a step unless its `change` event is vetoed. Disabled steps are ignored.
   * @param {string} name Step name.
   * @returns {this}
   * @throws {RangeError} When no step carries that name.
   * @fires Stepper#change
   */
  goTo(name) {
    const index = stepIndex(this._steps, name);
    if (index < 0) throw new RangeError(`Unknown step: ${name}`);
    return this._activate(index);
  }

  /**
   * Activates the next enabled step, marking the current one complete. Does nothing on the last
   * enabled step.
   * @returns {this}
   * @fires Stepper#change
   */
  next() {
    return this._activate(resolveStepIndex(this._steps, this._activeIndex, 1));
  }

  /**
   * Activates the previous enabled step. Going back never clears completion flags.
   * @returns {this}
   * @fires Stepper#change
   */
  previous() {
    return this._activate(resolveStepIndex(this._steps, this._activeIndex, -1));
  }

  /**
   * Returns the active step name.
   * @returns {string|null}
   */
  getActive() {
    return this._activeIndex < 0 ? null : this._steps[this._activeIndex].name;
  }

  /**
   * Returns the zero-based active index.
   * @returns {number} -1 when no step is active.
   */
  getIndex() {
    return this._activeIndex;
  }

  /**
   * Marks a step complete.
   * @param {string} name Step name.
   * @returns {this}
   */
  complete(name) {
    this._require(name);
    this._completed.add(name);
    this._sync();
    return this;
  }

  /**
   * Clears a step's completion flag.
   * @param {string} name Step name.
   * @returns {this}
   */
  uncomplete(name) {
    this._require(name);
    this._completed.delete(name);
    this._sync();
    return this;
  }

  /**
   * Flags or clears a step's error state. An errored step renders a warning marker and keeps its
   * completion flag, so a wizard can still send the user back to fix it.
   * @param {string} name Step name.
   * @param {boolean} [errored=true] Whether the step is in error.
   * @returns {this}
   */
  setError(name, errored = true) {
    this._require(name);
    if (errored) this._errored.add(name);
    else this._errored.delete(name);
    this._sync();
    return this;
  }

  /**
   * Enables or disables a step. Disabling the active step leaves it active — the user is still
   * standing on it — but `next()`, `previous()`, and `goTo()` will skip or refuse it afterwards.
   * @param {string} name Step name.
   * @param {boolean} [disabled=true] Whether the step is unavailable.
   * @returns {this}
   */
  setDisabled(name, disabled = true) {
    this._require(name).disabled = Boolean(disabled);
    this._sync();
    return this;
  }

  /**
   * Returns a snapshot of the rail's state.
   * @returns {StepperState}
   */
  getState() {
    return {
      active: this.getActive(),
      index: this._activeIndex,
      completed: this._steps.filter((step) => this._completed.has(step.name)).map((step) => step.name),
      errored: this._steps.filter((step) => this._errored.has(step.name)).map((step) => step.name)
    };
  }

  /**
   * Aborts listeners and restores an enhanced target to the markup it had before the takeover.
   * @returns {void}
   */
  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    const root = this.el;
    super.destroy();
    if (!this._createdRoot && root) restoreTarget(root, this._snapshot);
  }

  /* ------------------------------------------------------------------ internals -- */

  /**
   * Activates an index, marking every step it advanced past complete.
   * @param {number} index Zero-based index, or -1 for "nowhere to go".
   * @returns {this}
   * @fires Stepper#change
   */
  _activate(index) {
    if (index < 0 || index >= this._steps.length || index === this._activeIndex) return this;
    const step = this._steps[index];
    if (step.disabled) return this;
    const from = this._activeIndex;
    const event = this.emit('change', {
      name: step.name,
      previous: from < 0 ? null : this._steps[from].name,
      index
    });
    if (event.defaultPrevented) return this;
    for (const name of completedByAdvance(this._steps, from, index)) this._completed.add(name);
    this._activeIndex = index;
    this._sync();
    return this;
  }

  /**
   * Builds one step's elements. The control's tag depends only on the `clickable` option, never on
   * the step's state, so state changes never have to swap an element out from under the focus.
   * @param {NormalizedStep} step Normalized step.
   * @returns {StepRecord}
   */
  _createRecord(step) {
    const marker = h('span', { class: 'zx-stepper__marker', ariaHidden: 'true' });
    const status = h('span', { class: 'zx-stepper__status' });
    const text = [h('span', { class: 'zx-stepper__title' }, step.title)];
    if (step.description) {
      text.push(h('span', { class: 'zx-stepper__description' }, step.description));
    }
    if (step.optional) {
      text.push(h('span', { class: 'zx-stepper__optional' },
        this._message('stepper.optional', 'Optional')));
    }
    const body = [marker, h('span', { class: 'zx-stepper__text' }, text), status];
    const control = this.options.clickable === false
      ? h('span', { class: 'zx-stepper__control' }, body)
      : h('button', {
        class: 'zx-stepper__control',
        type: 'button',
        dataset: { step: step.name }
      }, body);
    return {
      step,
      item: /** @type {HTMLLIElement} */ (h('li', { class: 'zx-stepper__step' }, control)),
      control,
      marker,
      status
    };
  }

  /**
   * Pushes the current state onto every rendered step and the counter line.
   * @returns {void}
   */
  _sync() {
    this._records.forEach((record, index) => {
      const state = this._stateFor(record.step, index);
      record.item.dataset.state = state;
      if (index === this._activeIndex) record.item.setAttribute('aria-current', 'step');
      else record.item.removeAttribute('aria-current');
      record.item.toggleAttribute('data-disabled', record.step.disabled);
      record.marker.replaceChildren(...this._markerContent(state, index));
      record.status.textContent = this._statusText(state);
      if (record.control.tagName === 'BUTTON') {
        /** @type {HTMLButtonElement} */ (record.control).disabled = !this._isClickable(record.step);
      }
    });
    this._syncCounter();
  }

  /**
   * Resolves a step's rendered state.
   * @param {NormalizedStep} step Normalized step.
   * @param {number} index Zero-based index.
   * @returns {StepperStepState}
   */
  _stateFor(step, index) {
    return stepState(step, index, {
      activeIndex: this._activeIndex,
      completed: this._completed,
      errored: this._errored
    });
  }

  /**
   * @param {StepperStepState} state Rendered state.
   * @param {number} index Zero-based index.
   * @returns {Array<Node|string>}
   */
  _markerContent(state, index) {
    if (state === 'complete') return [icon('check', { size: 12 })];
    if (state === 'error') return [icon('warning', { size: 12 })];
    return this.options.showNumbers ? [String(index + 1)] : [];
  }

  /**
   * @param {StepperStepState} state Rendered state.
   * @returns {string} Text announced in place of the decorative marker.
   */
  _statusText(state) {
    if (state === 'complete') return this._message('stepper.completed', 'Completed');
    if (state === 'error') return this._message('stepper.error', 'Error');
    if (state === 'active') return this._message('stepper.current', 'Current step');
    return '';
  }

  /**
   * Whether a step's button is enabled. The active step stays enabled when it qualifies (under
   * `all`, or under `completed` once it has been visited), because disabling the button the user
   * just clicked would throw their focus back to the document body; activating the active step is
   * a no-op anyway.
   * @param {NormalizedStep} step Normalized step.
   * @returns {boolean}
   */
  _isClickable(step) {
    if (step.disabled) return false;
    if (this.options.clickable === 'all') return true;
    if (this.options.clickable === 'completed') return this._completed.has(step.name);
    return false;
  }

  /** @returns {void} */
  _syncCounter() {
    if (!this.options.counter) return;
    const counter = this.refs.counter;
    counter.hidden = this._activeIndex < 0;
    counter.textContent = this._activeIndex < 0 ? '' :
      this._message('stepper.counter', 'Step %1 of %2', this._activeIndex + 1, this._steps.length);
  }

  /**
   * @param {string} name Step name.
   * @returns {NormalizedStep}
   * @throws {RangeError} When no step carries that name.
   */
  _require(name) {
    const index = stepIndex(this._steps, name);
    if (index < 0) throw new RangeError(`Unknown step: ${name}`);
    return this._steps[index];
  }

  /**
   * Resolves a message through the host translator, falling back to the built-in English text.
   * @param {string} key Message key.
   * @param {string} fallback Built-in text, with `%1`-style placeholders.
   * @param {...unknown} args Interpolation values.
   * @returns {string}
   */
  _message(key, fallback, ...args) {
    const message = this.msg(key, ...args);
    return message === key ? printf(fallback, args) : message;
  }
}

/**
 * Fired before the active step changes. Calling `preventDefault()` vetoes the move, which is how a
 * wizard blocks a step whose form has not validated.
 * @event Stepper#change
 * @type {CustomEvent<StepperChangeDetail>}
 */
