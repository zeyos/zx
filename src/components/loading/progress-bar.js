import { Component } from '../../core/component.js';
import { h, restoreTarget, snapshotTarget } from '../../core/dom.js';
import { icon as createIcon } from '../../core/icons.js';
import { clamp, uid } from '../../core/util.js';

/**
 * @typedef {Object} ProgressBarOptions
 * @property {number} [value=0] Completed amount, clamped to `[0, max]`.
 * @property {number} [max=100] Amount that counts as finished.
 * @property {string} [label=''] Visible name of the task.
 * @property {string} [helperText=''] Supporting line below the track.
 * @property {'active'|'success'|'error'} [status='active'] Visual state of the track.
 * @property {boolean} [indeterminate=false] Whether the amount done is unknown.
 * @property {'md'|'sm'} [size='md'] Track thickness.
 * @property {boolean} [hideLabel=false] Whether the label is kept for assistive technology only.
 * @property {boolean} [showValue=true] Whether the formatted value is drawn opposite the label.
 * @property {((value: number, max: number) => string)|null} [formatValue=null] Replaces the
 *   default percentage readout.
 * @property {(event: CustomEvent<{value: number, percent: number}>) => void} [onchange] Value listener.
 * @property {(event: CustomEvent<{value: number}>) => void} [oncomplete] Listener for reaching `max`.
 */

/**
 * Determinate progress track for work whose completed share is known — a file upload, a batch
 * posting run, an import.
 *
 * The track carries `role="progressbar"` and its ARIA value attributes, which is what a screen
 * reader reports; an indeterminate bar drops `aria-valuenow` rather than reporting a fake number.
 * `status` is a display concern only: a finished-with-errors bar still reads 100%.
 *
 * @fires ProgressBar#change
 * @fires ProgressBar#complete
 */
export class ProgressBar extends Component {
  static cssName = 'progress-bar';

  /** @type {ProgressBarOptions} */
  static defaults = {
    value: 0,
    max: 100,
    label: '',
    helperText: '',
    status: 'active',
    indeterminate: false,
    size: 'md',
    hideLabel: false,
    showValue: true,
    formatValue: null
  };

  /** @returns {HTMLElement} */
  render() {
    // render() runs inside the base constructor, before class-field initializers would run.
    this._value = 0;
    this._createdRoot = this.el === null;
    this._snapshot = this._createdRoot ? null : snapshotTarget(this.el);

    const root = /** @type {HTMLElement} */ (this.el ?? h('div'));
    this.el = root;

    this._max = Math.max(1, Number(this.options.max) || 100);
    this._status = normalizeStatus(this.options.status);
    this._indeterminate = Boolean(this.options.indeterminate);
    this._labelId = uid('zx-progress-label');

    const head = h('div', { ref: 'head', class: 'zx-progress-bar__head' },
      h('span', { ref: 'label', class: 'zx-progress-bar__label', id: this._labelId },
        String(this.options.label ?? '')),
      h('span', { ref: 'value', class: 'zx-progress-bar__value' })
    );
    const track = h('div', {
      ref: 'track',
      class: 'zx-progress-bar__track',
      role: 'progressbar',
      ariaValuemin: '0',
      ariaValuemax: String(this._max),
      ariaLabelledby: this._labelId
    }, h('div', { ref: 'fill', class: 'zx-progress-bar__fill' }));

    root.replaceChildren(head, track,
      h('p', { ref: 'helper', class: 'zx-progress-bar__helper' },
        String(this.options.helperText ?? '')));
    root.dataset.size = this.options.size === 'sm' ? 'sm' : 'md';
    root.toggleAttribute('data-hide-label', Boolean(this.options.hideLabel));

    this.set(this.options.value, { silent: true });
    return root;
  }

  /** Current value. @returns {number} */
  get value() {
    return this._value;
  }

  /** @param {number} next Next value. */
  set value(next) {
    this.set(next);
  }

  /**
   * Returns the current value.
   * @returns {number}
   */
  get() {
    return this._value;
  }

  /**
   * Sets the completed amount, clamped to `[0, max]`.
   * @param {number} next Completed amount.
   * @param {{silent?: boolean}} [options={}] Set `silent` to suppress events.
   * @returns {this}
   * @fires ProgressBar#change
   * @fires ProgressBar#complete
   */
  set(next, { silent = false } = {}) {
    const raw = Number(next);
    const value = clamp(Number.isFinite(raw) ? raw : 0, 0, this._max);
    const changed = value !== this._value;
    const reached = changed && value >= this._max;
    this._value = value;
    this._sync();
    if (!silent && changed) this.emit('change', { value, percent: this.percent() });
    if (!silent && reached) this.emit('complete', { value });
    return this;
  }

  /**
   * Completed share of the track, as a number between 0 and 100.
   * @returns {number}
   */
  percent() {
    return (this._value / this._max) * 100;
  }

  /**
   * Replaces the upper bound, re-clamping the current value against it.
   * @param {number} max New maximum.
   * @returns {this}
   */
  setMax(max) {
    this._max = Math.max(1, Number(max) || 1);
    this.refs.track.setAttribute('aria-valuemax', String(this._max));
    return this.set(this._value, { silent: true });
  }

  /**
   * Sets the visual state, optionally replacing the helper line with it.
   * @param {'active'|'success'|'error'} status Track state.
   * @param {string} [helperText] Replacement helper line.
   * @returns {this}
   */
  setStatus(status, helperText) {
    this._status = normalizeStatus(status);
    if (helperText !== undefined) this.setHelperText(helperText);
    this._sync();
    return this;
  }

  /**
   * Replaces the visible task name.
   * @param {string} label Task name.
   * @returns {this}
   */
  setLabel(label) {
    this.refs.label.textContent = String(label ?? '');
    return this;
  }

  /**
   * Replaces the supporting line below the track.
   * @param {string} helperText Supporting line.
   * @returns {this}
   */
  setHelperText(helperText) {
    this.refs.helper.textContent = String(helperText ?? '');
    return this;
  }

  /**
   * Switches between a known and an unknown completed share.
   * @param {boolean} [indeterminate=true] Whether the amount done is unknown.
   * @returns {this}
   */
  setIndeterminate(indeterminate = true) {
    this._indeterminate = Boolean(indeterminate);
    this._sync();
    return this;
  }

  /** Paints the track, the readout, and the ARIA value attributes. @returns {void} */
  _sync() {
    const { track, fill, value } = this.refs;
    this.el.dataset.status = this._status;
    this.el.toggleAttribute('data-indeterminate', this._indeterminate);

    if (this._indeterminate) {
      track.removeAttribute('aria-valuenow');
      track.removeAttribute('aria-valuetext');
      fill.style.removeProperty('--zx-progress-fill');
      value.textContent = '';
      return;
    }

    const text = this._format();
    track.setAttribute('aria-valuenow', String(this._value));
    track.setAttribute('aria-valuetext', text);
    fill.style.setProperty('--zx-progress-fill', `${this.percent()}%`);
    value.replaceChildren(...this._readout(text));
  }

  /** @returns {string} */
  _format() {
    const formatter = this.options.formatValue;
    if (typeof formatter === 'function') return String(formatter(this._value, this._max));
    return `${Math.round(this.percent())}%`;
  }

  /**
   * The readout beside the label: the formatted value, prefixed by a status glyph once the run
   * has finished one way or the other.
   * @param {string} text Formatted value.
   * @returns {Node[]}
   */
  _readout(text) {
    if (!this.options.showValue) return [];
    const nodes = [];
    if (this._status !== 'active') {
      nodes.push(createIcon(this._status === 'success' ? 'success' : 'error', { size: 14 }));
    }
    nodes.push(h('span', { class: 'zx-progress-bar__percent' }, text));
    return nodes;
  }

  /** Restores an enhanced target to the markup it had before the takeover. @returns {void} */
  destroy() {
    const root = this.el;
    super.destroy();
    if (!this._createdRoot && root) restoreTarget(root, this._snapshot);
  }
}

/**
 * Value change.
 * @event ProgressBar#change
 * @type {CustomEvent<{value: number, percent: number}>}
 */

/**
 * Fired once the value reaches `max`.
 * @event ProgressBar#complete
 * @type {CustomEvent<{value: number}>}
 */

/** @param {unknown} value @returns {'active'|'success'|'error'} */
function normalizeStatus(value) {
  return value === 'success' || value === 'error' ? value : 'active';
}
