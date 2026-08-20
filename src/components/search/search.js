import { Component } from '../../core/component.js';
import { h } from '../../core/dom.js';
import { icon } from '../../core/icons.js';

/**
 * @typedef {Object} SearchOptions
 * @property {string} [placeholder=''] Input placeholder.
 * @property {string} [value=''] Initial query.
 * @property {boolean} [clearable=true] Whether to show a clear control.
 * @property {number} [debounce=250] Input debounce in milliseconds.
 * @property {(event: CustomEvent<{value: string}>) => void} [oninput] Input callback.
 * @property {(event: CustomEvent<{value: string}>) => void} [onsubmit] Submit callback.
 * @property {(event: CustomEvent<Record<string, never>>) => void} [onclear] Clear callback.
 */

/**
 * Search field with embedded submit and optional clear controls.
 * @fires Search#input
 * @fires Search#submit
 * @fires Search#clear
 * @extends {Component<SearchOptions>}
 */
export class Search extends Component {
  static cssName = 'search';

  /** @type {Readonly<SearchOptions>} */
  static defaults = {
    placeholder: '',
    value: '',
    clearable: true,
    debounce: 250
  };

  /** @returns {HTMLElement} */
  render() {
    const created = !this.el;
    const root = /** @type {HTMLElement} */ (this.el ?? h('form'));
    this._createdRoot = created;
    this._original = created ? null : snapshot(root);
    this._inputTimer = null;
    root.setAttribute('role', 'search');
    const input = h('input', {
      class: 'zx-search__input',
      ref: 'input',
      type: 'search',
      placeholder: String(this.options.placeholder),
      value: String(this.options.value),
      ariaLabel: String(this.options.placeholder || 'Search')
    });
    const clear = this.options.clearable ? h('button', {
      class: 'zx-search__clear',
      ref: 'clear',
      type: 'button',
      ariaLabel: 'Clear search',
      title: 'Clear search'
    }, icon('x', { size: 15 })) : null;
    const submit = h('button', {
      class: 'zx-search__submit',
      ref: 'submit',
      type: root.localName === 'form' ? 'submit' : 'button',
      ariaLabel: 'Submit search',
      title: 'Search'
    }, icon('search', { size: 16 }));
    root.replaceChildren(...[input, clear, submit].filter(Boolean));
    this._syncClear();

    this.listen(input, 'input', () => {
      this._syncClear();
      this._scheduleInput();
    });
    if (root.localName === 'form') {
      this.listen(root, 'submit', (event) => {
        event.preventDefault();
        this.emit('submit', { value: this.get() });
      });
    } else {
      this.listen(input, 'keydown', (event) => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        this.emit('submit', { value: this.get() });
      });
      this.listen(submit, 'click', () => this.emit('submit', { value: this.get() }));
    }
    if (clear) this.listen(clear, 'click', () => this.clear());
    return root;
  }

  /**
   * Returns the current query.
   * @returns {string}
   */
  get() {
    return /** @type {HTMLInputElement} */ (this.refs.input).value;
  }

  /**
   * Sets the current query.
   * @param {string} value Next query.
   * @param {{silent?: boolean}} [options={}] Set `silent` to suppress `input`.
   * @returns {this}
   */
  set(value, { silent = false } = {}) {
    if (this._inputTimer !== null) {
      clearTimeout(this._inputTimer);
      this._inputTimer = null;
    }
    /** @type {HTMLInputElement} */ (this.refs.input).value = String(value);
    this._syncClear();
    if (!silent) this._scheduleInput();
    return this;
  }

  /**
   * Focuses the input.
   * @returns {this}
   */
  focus() {
    /** @type {HTMLInputElement} */ (this.refs.input).focus();
    return this;
  }

  /**
   * Clears the query and reports both the value update and clear action.
   * @returns {this}
   * @fires Search#input
   * @fires Search#clear
   */
  clear() {
    this.set('');
    this.emit('clear');
    this.focus();
    return this;
  }

  /** @returns {void} */
  destroy() {
    if (this._cleaned) return;
    this._cleaned = true;
    if (this._inputTimer !== null) clearTimeout(this._inputTimer);
    super.destroy();
    if (!this._createdRoot && this._original) restore(this.el, this._original);
  }

  /** @returns {void} */
  _scheduleInput() {
    if (this._inputTimer !== null) clearTimeout(this._inputTimer);
    const delay = Math.max(0, Number(this.options.debounce) || 0);
    this._inputTimer = setTimeout(() => {
      this._inputTimer = null;
      this.emit('input', { value: this.get() });
    }, delay);
  }

  /** @returns {void} */
  _syncClear() {
    if (this.refs.clear) {
      /** @type {HTMLButtonElement} */ (this.refs.clear).hidden = this.get() === '';
    }
  }
}

/**
 * Debounced query update.
 * @event Search#input
 * @type {CustomEvent<{value: string}>}
 */

/**
 * Search submission.
 * @event Search#submit
 * @type {CustomEvent<{value: string}>}
 */

/**
 * Explicit clear action.
 * @event Search#clear
 * @type {CustomEvent<Record<string, never>>}
 */

/** @param {Element} element @returns {{attributes: [string, string][], children: Node[]}} */
function snapshot(element) {
  return {
    attributes: Array.from(element.attributes, (attribute) => [attribute.name, attribute.value]),
    children: Array.from(element.childNodes)
  };
}

/** @param {Element} element @param {{attributes: [string, string][], children: Node[]}} state */
function restore(element, state) {
  for (const attribute of Array.from(element.attributes)) element.removeAttribute(attribute.name);
  for (const [name, value] of state.attributes) element.setAttribute(name, value);
  element.replaceChildren(...state.children);
}
