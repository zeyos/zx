import { Component } from '../../core/component.js';
import { h, restoreTarget, snapshotTarget } from '../../core/dom.js';
import { icon as createIcon } from '../../core/icons.js';
import { spinner } from './spinner.js';

/**
 * @typedef {Object} InlineLoadingOptions
 * @property {'inactive'|'active'|'success'|'error'} [status='active'] Initial state.
 * @property {string} [description=''] Text shown beside the indicator.
 * @property {'sm'|'md'} [size='sm'] Indicator size.
 * @property {boolean} [live=true] Whether state changes are announced through `aria-live`.
 * @property {(event: CustomEvent<{status: string, description: string}>) => void} [onstatuschange]
 *   State-change listener.
 */

const STATUSES = new Set(['inactive', 'active', 'success', 'error']);

/**
 * The status line that replaces a spinner once the wait resolves — "Saving…" becoming "Saved" or
 * "Could not save" in the same place, beside the control that started the work.
 *
 * The whole element is one polite live region, so a screen reader hears the outcome without the
 * focus moving. Reach for `Message` instead when the outcome deserves a dismissible notification
 * rather than a line of text that stays put.
 *
 * @fires InlineLoading#statuschange
 * @extends {Component<InlineLoadingOptions>}
 */
export class InlineLoading extends Component {
  static cssName = 'inline-loading';

  /** @type {InlineLoadingOptions} */
  static defaults = {
    status: 'active',
    description: '',
    size: 'sm',
    live: true
  };

  /** @returns {HTMLElement} */
  render() {
    // render() runs inside the base constructor, before class-field initializers would run.
    this._status = 'inactive';
    this._description = '';
    this._createdRoot = this.el === null;
    this._snapshot = this._createdRoot ? null : snapshotTarget(this.el);

    const root = /** @type {HTMLElement} */ (this.el ?? h('span'));
    this.el = root;

    root.replaceChildren(
      h('span', { ref: 'indicator', class: 'zx-inline-loading__indicator' }),
      h('span', { ref: 'description', class: 'zx-inline-loading__description' })
    );
    root.dataset.size = this.options.size === 'md' ? 'md' : 'sm';
    if (this.options.live !== false) {
      root.setAttribute('role', 'status');
      root.setAttribute('aria-live', 'polite');
    }

    this.set(this.options.status, this.options.description, { silent: true });
    return root;
  }

  /**
   * Returns the current state.
   * @returns {'inactive'|'active'|'success'|'error'}
   */
  get() {
    return this._status;
  }

  /**
   * Returns the current description.
   * @returns {string}
   */
  getDescription() {
    return this._description;
  }

  /**
   * Moves to a state, optionally replacing the description with it.
   * @param {'inactive'|'active'|'success'|'error'} status Next state.
   * @param {string} [description] Replacement description; the current one is kept when omitted.
   * @param {{silent?: boolean}} [options={}] Set `silent` to suppress `statuschange`.
   * @returns {this}
   * @fires InlineLoading#statuschange
   */
  set(status, description, { silent = false } = {}) {
    const next = STATUSES.has(status) ? status : 'inactive';
    if (description !== undefined) this._description = String(description ?? '');
    const changed = next !== this._status;
    this._status = next;
    this._sync();
    if (changed && !silent) {
      this.emit('statuschange', { status: this._status, description: this._description });
    }
    return this;
  }

  /**
   * Replaces the description without changing the state.
   * @param {string} description Text beside the indicator.
   * @returns {this}
   */
  setDescription(description) {
    this._description = String(description ?? '');
    this.refs.description.textContent = this._description;
    return this;
  }

  /** Paints the indicator and the description for the current state. @returns {void} */
  _sync() {
    this.el.dataset.status = this._status;
    this.refs.description.textContent = this._description;
    this.refs.indicator.replaceChildren(...this._indicator());
  }

  /** @returns {Node[]} */
  _indicator() {
    const size = this.el.dataset.size === 'md' ? 18 : 16;
    if (this._status === 'active') return [spinner({ size: 'sm', kind: 'current' })];
    if (this._status === 'success') return [createIcon('success', { size })];
    if (this._status === 'error') return [createIcon('error', { size })];
    return [];
  }

  /** Restores an enhanced target to the markup it had before the takeover. @returns {void} */
  destroy() {
    const root = this.el;
    super.destroy();
    if (!this._createdRoot && root) restoreTarget(root, this._snapshot);
  }
}

/**
 * State change.
 * @event InlineLoading#statuschange
 * @type {CustomEvent<{status: string, description: string}>}
 */
