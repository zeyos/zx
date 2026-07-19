import { Component } from '../../core/component.js';
import { h } from '../../core/dom.js';
import { icon } from '../../core/icons.js';

/**
 * @typedef {Object} CheckButtonOptions
 * @property {string|[string, string]} [label=''] A shared label or `[onLabel, offLabel]`.
 * @property {boolean} [checked=false] Initial pressed state.
 * @property {boolean} [icon=true] Whether to show the check indicator.
 * @property {boolean} [disabled=false] Initial disabled state.
 * @property {(event: CustomEvent<{checked: boolean}>) => void} [onchange] Change callback.
 */

/**
 * Two-state native press button.
 * @fires CheckButton#change
 */
export class CheckButton extends Component {
  static cssName = 'check-button';

  /** @type {Readonly<CheckButtonOptions>} */
  static defaults = {
    label: '',
    checked: false,
    icon: true,
    disabled: false
  };

  /** @returns {HTMLButtonElement} */
  render() {
    const created = !this.el;
    const root = /** @type {HTMLButtonElement} */ (this.el ?? h('button'));
    this.el = root;
    if (root.localName !== 'button') {
      throw new TypeError('CheckButton target must be a button element');
    }

    this._createdRoot = created;
    this._original = created ? null : snapshot(root);
    this._checked = Boolean(this.options.checked);
    this._disabled = Boolean(this.options.disabled);
    this._labels = normalizeLabels(this.options.label);
    root.type = 'button';
    const children = [];
    if (this.options.icon) {
      children.push(h('span', { class: 'zx-check-button__icon', ariaHidden: 'true' },
        icon('check', { size: 15 })));
    }
    children.push(h('span', { class: 'zx-check-button__label', ref: 'label' }));
    root.replaceChildren(...children);
    this._sync();
    this.listen(root, 'click', () => this.toggle());
    return root;
  }

  /**
   * Returns the current pressed state.
   * @returns {boolean}
   */
  get() {
    return this._checked;
  }

  /**
   * Sets the pressed state.
   * @param {boolean} checked Next state.
   * @param {{silent?: boolean}} [options={}] Set `silent` to suppress `change`.
   * @returns {this}
   * @fires CheckButton#change
   */
  set(checked, { silent = false } = {}) {
    const next = Boolean(checked);
    if (next === this._checked) return this;
    this._checked = next;
    this._sync();
    if (!silent) this.emit('change', { checked: this._checked });
    return this;
  }

  /**
   * Toggles the pressed state.
   * @returns {this}
   * @fires CheckButton#change
   */
  toggle() {
    return this.set(!this._checked);
  }

  /**
   * Replaces the state labels.
   * @param {string|[string, string]} label A shared label or `[onLabel, offLabel]`.
   * @returns {this}
   */
  setLabel(label) {
    this._labels = normalizeLabels(label);
    this._sync();
    return this;
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
    this.el.setAttribute('aria-pressed', String(this._checked));
    this.el.toggleAttribute('disabled', this._disabled);
    this.refs.label.textContent = this._checked ? this._labels.on : this._labels.off;
  }
}

/**
 * Change emitted after a real state transition.
 * @event CheckButton#change
 * @type {CustomEvent<{checked: boolean}>}
 */

/** @param {string|[string, string]} label @returns {{on: string, off: string}} */
function normalizeLabels(label) {
  if (Array.isArray(label)) {
    return { on: String(label[0] ?? ''), off: String(label[1] ?? '') };
  }
  return { on: String(label ?? ''), off: String(label ?? '') };
}

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
