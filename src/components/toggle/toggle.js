import { Component } from '../../core/component.js';
import { h } from '../../core/dom.js';

/**
 * @typedef {Object} ToggleOptions
 * @property {boolean} [checked=false] Initial switch state.
 * @property {*} [value=true] Value returned while on.
 * @property {string|null} [label=null] Optional visible label.
 * @property {boolean} [disabled=false] Initial disabled state.
 * @property {(event: CustomEvent<{checked: boolean, value: *}>) => void} [onchange] Change callback.
 */

/**
 * Accessible on/off switch.
 * @fires Toggle#change
 */
export class Toggle extends Component {
  static cssName = 'toggle';

  /** @type {Readonly<ToggleOptions>} */
  static defaults = {
    checked: false,
    value: true,
    label: null,
    disabled: false
  };

  /** @returns {HTMLButtonElement} */
  render() {
    const created = !this.el;
    const root = /** @type {HTMLButtonElement} */ (this.el ?? h('button'));
    this.el = root;
    if (root.localName !== 'button') throw new TypeError('Toggle target must be a button element');

    this._createdRoot = created;
    this._original = created ? null : snapshot(root);
    this._checked = Boolean(this.options.checked);
    this._disabled = Boolean(this.options.disabled);
    root.type = 'button';
    root.setAttribute('role', 'switch');
    const children = [
      h('span', { class: 'zx-toggle__track', ariaHidden: 'true' },
        h('span', { class: 'zx-toggle__thumb' }))
    ];
    if (this.options.label !== null) {
      children.push(h('span', { class: 'zx-toggle__label' }, String(this.options.label)));
    }
    root.replaceChildren(...children);
    this._sync();
    this.listen(root, 'click', () => this.toggle());
    return root;
  }

  /**
   * Returns the current switch state.
   * @returns {boolean}
   */
  get() {
    return this._checked;
  }

  /**
   * Sets the switch state.
   * @param {boolean} checked Next state.
   * @param {{silent?: boolean}} [options={}] Set `silent` to suppress `change`.
   * @returns {this}
   * @fires Toggle#change
   */
  set(checked, { silent = false } = {}) {
    const next = Boolean(checked);
    if (next === this._checked) return this;
    this._checked = next;
    this._sync();
    if (!silent) this.emit('change', { checked: this._checked, value: this.getValue() });
    return this;
  }

  /**
   * Toggles the switch state.
   * @returns {this}
   * @fires Toggle#change
   */
  toggle() {
    return this.set(!this._checked);
  }

  /**
   * Returns the configured value while on, otherwise `false`.
   * @returns {*}
   */
  getValue() {
    return this._checked ? this.options.value : false;
  }

  /**
   * Enables user interaction.
   * @returns {this}
   */
  enable() {
    this._disabled = false;
    this.el.removeAttribute('disabled');
    return this;
  }

  /**
   * Disables user interaction.
   * @returns {this}
   */
  disable() {
    this._disabled = true;
    this.el.setAttribute('disabled', '');
    return this;
  }

  /** @returns {void} */
  destroy() {
    if (this._cleaned) return;
    this._cleaned = true;
    super.destroy();
    if (!this._createdRoot && this._original) restore(this.el, this._original);
  }

  /** @returns {void} */
  _sync() {
    this.el.setAttribute('aria-checked', String(this._checked));
    this.el.toggleAttribute('disabled', this._disabled);
  }
}

/**
 * Change emitted after a real state transition.
 * @event Toggle#change
 * @type {CustomEvent<{checked: boolean, value: *}>}
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
