import { Component } from '../../core/component.js';
import { h } from '../../core/dom.js';

/**
 * @typedef {Object} ToggleOptions
 * @property {boolean} [checked=false] Initial switch state.
 * @property {*} [value=true] Value returned while on.
 * @property {string|null} [label=null] The switch's name, drawn beside the track and read as its
 *   accessible name. Null renders no text: the switch then needs a name from somewhere else — a
 *   Field or `<label for>` around it, or `aria-labelledby` on the element.
 * @property {boolean} [hideLabel=false] Whether the label is kept for assistive technology only:
 *   no visible text, and the label becomes the switch's `aria-label`. For a switch whose meaning
 *   the surrounding layout already shows — a table cell under a column header, a settings row.
 * @property {boolean} [disabled=false] Initial disabled state.
 * @property {(event: CustomEvent<{checked: boolean, value: *}>) => void} [onchange] Change callback.
 */

/**
 * Accessible on/off switch.
 * @fires Toggle#change
 * @extends {Component<ToggleOptions>}
 */
export class Toggle extends Component {
  static cssName = 'toggle';

  /** @type {Readonly<ToggleOptions>} */
  static defaults = {
    checked: false,
    value: true,
    label: null,
    hideLabel: false,
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
    /** The `aria-label` the target arrived with, put back whenever the switch stops writing its own. */
    this._ariaLabel = root.getAttribute('aria-label');
    /** @type {HTMLElement|null} The visible label, when there is one. */
    this._labelEl = null;
    root.replaceChildren(h('span', { class: 'zx-toggle__track', ariaHidden: 'true' },
      h('span', { class: 'zx-toggle__thumb' })));
    this._syncLabel(this.options.label ?? null);
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
   * Replaces the switch's name: the visible label, or the `aria-label` under `hideLabel`.
   * @param {string|null} label New name; null removes it.
   * @returns {this}
   */
  setLabel(label) {
    this._syncLabel(label ?? null);
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

  /**
   * Writes the name where the options put it: a text node beside the track, or `aria-label` when
   * the label is hidden. With no name of its own the switch leaves `aria-label` as it found it.
   * @param {string|null} label Name, or null for none.
   * @returns {void}
   */
  _syncLabel(label) {
    const text = label === null ? '' : String(label);
    const hidden = Boolean(this.options.hideLabel);
    if (text && !hidden) {
      if (!this._labelEl) {
        this._labelEl = h('span', { class: 'zx-toggle__label' });
        this.el.append(this._labelEl);
      }
      this._labelEl.textContent = text;
    } else {
      this._labelEl?.remove();
      this._labelEl = null;
    }
    if (text && hidden) this.el.setAttribute('aria-label', text);
    else if (this._ariaLabel === null) this.el.removeAttribute('aria-label');
    else this.el.setAttribute('aria-label', this._ariaLabel);
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
