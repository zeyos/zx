import { Component } from '../../core/component.js';
import { h } from '../../core/dom.js';
import { uid } from '../../core/util.js';

/**
 * @typedef {Object} ValueListOptions
 * @property {unknown[]} [values=[]] Initial ordered values.
 * @property {string} [placeholder=''] Input placeholder.
 * @property {boolean} [deletable=true] Whether values can be removed.
 * @property {boolean} [sortable=true] Whether values can be reordered.
 * @property {boolean} [unique=true] Whether duplicate strings are rejected.
 * @property {((value: string) => boolean|string)|null} [validate=null] Value validator.
 * @property {(event: CustomEvent<{values: string[]}>) => void} [onchange] Values change listener.
 * @property {(event: CustomEvent<{value: string}>) => void} [onadd] Value added listener.
 * @property {(event: CustomEvent<{value: string}>) => void} [onremove] Value removed listener.
 */

/**
 * Tag/chip editor. It uses the APG listbox/option focus model: each chip is an option, arrow keys
 * move focus, Ctrl+Left/Right reorders, and Delete/Backspace removes the focused option.
 * @fires ValueList#change
 * @fires ValueList#add
 * @fires ValueList#remove
 * @extends {Component<ValueListOptions>}
 */
export class ValueList extends Component {
  static cssName = 'value-list';

  /** @type {ValueListOptions} */
  static defaults = {
    values: [],
    placeholder: '',
    deletable: true,
    sortable: true,
    unique: true,
    validate: null
  };

  /** @returns {HTMLElement} */
  render() {
    const root = /** @type {HTMLElement} */ (this.el ?? h('div'));
    this._ownedNodes = [];
    this._disabled = false;
    this._dragIndex = -1;
    this._initialState = root.getAttribute('data-state');
    this._initialDisabled = root.getAttribute('data-disabled');
    this._values = normalizeValues(this.options.values, Boolean(this.options.unique));
    const instructionsId = uid('zx-value-list-instructions');
    this._list = h('ul', {
      class: 'zx-value-list__list',
      role: 'listbox',
      ariaLabel: 'Values',
      ariaOrientation: 'horizontal'
    });
    this._input = h('input', {
      class: 'zx-value-list__input',
      type: 'text',
      placeholder: String(this.options.placeholder ?? ''),
      ariaLabel: 'Add value',
      ariaDescribedby: instructionsId
    });
    this._status = h('div', {
      class: 'zx-value-list__status',
      role: 'status',
      ariaLive: 'polite'
    });
    this._instructions = h('span', {
      class: 'zx-value-list__instructions',
      id: instructionsId
    }, 'Press Enter to add. Focus a value and press Ctrl plus Left or Right to reorder.');
    this._ownedNodes.push(this._list, this._input, this._status, this._instructions);
    root.append(this._list, this._input, this._status, this._instructions);

    this.listen(this._input, 'keydown', (event) => this._handleInputKeydown(event));
    this.listen(this._list, 'keydown', (event) => this._handleChipKeydown(event));
    this.listen(this._list, 'click', (event) => this._handleChipClick(event));
    this.listen(this._list, 'dragstart', (event) => this._handleDragStart(event));
    this.listen(this._list, 'dragover', (event) => {
      if (this._dragIndex >= 0 && !this._disabled) event.preventDefault();
    });
    this.listen(this._list, 'drop', (event) => this._handleDrop(event));
    this.listen(this._list, 'dragend', () => this._finishDrag());
    this.listen(root, 'click', (event) => {
      if (event.target === root && !this._disabled) this.focus();
    });
    this._renderChips();
    return root;
  }

  /**
   * Returns a copy of the ordered values.
   * @returns {string[]}
   */
  getValues() {
    return this._values.slice();
  }

  /**
   * Replaces all values.
   * @param {unknown[]} values New values.
   * @param {{silent?: boolean}} [options={}] Set `silent` to suppress `change`.
   * @returns {this}
   */
  setValues(values, { silent = false } = {}) {
    this._values = normalizeValues(values, Boolean(this.options.unique));
    this._renderChips();
    if (!silent) this.emit('change', { values: this.getValues() });
    return this;
  }

  /**
   * Validates and appends one value.
   * @param {unknown} value Value to append.
   * @returns {boolean} Whether the value was added.
   * @fires ValueList#add
   * @fires ValueList#change
   */
  addValue(value) {
    if (this._disabled) return false;
    const normalized = String(value ?? '').trim();
    if (!normalized) return false;
    if (this.options.unique && this._values.includes(normalized)) {
      this._showError('This value already exists.');
      return false;
    }
    if (typeof this.options.validate === 'function') {
      const result = this.options.validate(normalized);
      if (result !== true) {
        this._showError(typeof result === 'string' ? result : 'This value is not valid.');
        return false;
      }
    }
    this._status.textContent = '';
    this._input.removeAttribute('aria-invalid');
    this._values.push(normalized);
    this._renderChips();
    this.emit('add', { value: normalized });
    this.emit('change', { values: this.getValues() });
    return true;
  }

  /**
   * Removes the first matching value.
   * @param {unknown} value Value to remove.
   * @returns {boolean} Whether a value was removed.
   * @fires ValueList#remove
   * @fires ValueList#change
   */
  removeValue(value) {
    if (this._disabled || !this.options.deletable) return false;
    const index = this._values.indexOf(String(value));
    if (index < 0) return false;
    this._removeAt(index);
    return true;
  }

  /**
   * Focuses the value input.
   * @returns {this}
   */
  focus() {
    this._input.focus();
    return this;
  }

  /**
   * Enables editing.
   * @returns {this}
   */
  enable() {
    this._disabled = false;
    this._input.disabled = false;
    this.el.dataset.disabled = 'false';
    this._renderChips();
    return this;
  }

  /**
   * Disables editing, removal, and reordering.
   * @returns {this}
   */
  disable() {
    this._disabled = true;
    this._input.disabled = true;
    this.el.dataset.disabled = 'true';
    this._renderChips();
    return this;
  }

  /** @returns {void} */
  _renderChips(focusIndex = -1) {
    const chips = this._values.map((value, index) => h('li', {
      class: 'zx-value-list__chip',
      role: 'option',
      tabIndex: this._disabled ? -1 : 0,
      draggable: Boolean(this.options.sortable) && !this._disabled,
      ariaSelected: 'false',
      ariaDisabled: String(this._disabled),
      ariaLabel: this.options.deletable ? `${value}. Press Delete to remove.` : value,
      dataset: { index }
    }, h('span', { class: 'zx-value-list__value' }, value), this.options.deletable ? h('span', {
      class: 'zx-value-list__remove',
      dataset: { remove: '' },
      ariaHidden: 'true'
    }, '×') : null));
    this._list.replaceChildren(...chips);
    if (focusIndex >= 0) chips[Math.min(focusIndex, chips.length - 1)]?.focus();
  }

  /** @param {KeyboardEvent} event @returns {void} */
  _handleInputKeydown(event) {
    if (this._disabled) return;
    if (event.key === 'Enter') {
      event.preventDefault();
      if (this.addValue(this._input.value)) this._input.value = '';
    } else if (event.key === 'Backspace' && this._input.value === '' && this._values.length && this.options.deletable) {
      event.preventDefault();
      this._removeAt(this._values.length - 1);
    }
  }

  /** @param {KeyboardEvent} event @returns {void} */
  _handleChipKeydown(event) {
    if (this._disabled) return;
    const chip = event.target instanceof Element ? event.target.closest('[data-index]') : null;
    if (!chip) return;
    const index = Number(chip.dataset.index);
    if ((event.key === 'Delete' || event.key === 'Backspace') && this.options.deletable) {
      event.preventDefault();
      this._removeAt(index, Math.min(index, this._values.length - 2));
      return;
    }
    const horizontal = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0;
    const vertical = event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0;
    const direction = horizontal || vertical;
    if (!direction) return;
    event.preventDefault();
    const next = Math.max(0, Math.min(this._values.length - 1, index + direction));
    if (event.ctrlKey && horizontal && this.options.sortable) this._move(index, next, true);
    else this._list.querySelector(`[data-index="${next}"]`)?.focus();
  }

  /** @param {MouseEvent} event @returns {void} */
  _handleChipClick(event) {
    const target = event.target instanceof Element ? event.target : null;
    const chip = target?.closest('[data-index]');
    if (!chip || this._disabled) return;
    if (target.closest('[data-remove]') && this.options.deletable) this._removeAt(Number(chip.dataset.index));
    else chip.focus();
  }

  /** @param {DragEvent} event @returns {void} */
  _handleDragStart(event) {
    if (this._disabled || !this.options.sortable) return;
    const chip = event.target instanceof Element ? event.target.closest('[data-index]') : null;
    if (!chip) return;
    this._dragIndex = Number(chip.dataset.index);
    this.el.dataset.state = 'dragging';
    event.dataTransfer?.setData('text/plain', String(this._dragIndex));
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  /** @param {DragEvent} event @returns {void} */
  _handleDrop(event) {
    if (this._dragIndex < 0 || this._disabled) return;
    event.preventDefault();
    const chip = event.target instanceof Element ? event.target.closest('[data-index]') : null;
    const target = chip ? Number(chip.dataset.index) : this._values.length - 1;
    this._move(this._dragIndex, target, true);
    this._finishDrag();
  }

  /** @returns {void} */
  _finishDrag() {
    this._dragIndex = -1;
    if (this._initialState === null) this.el.removeAttribute('data-state');
    else this.el.setAttribute('data-state', this._initialState);
  }

  /** @param {number} start @param {number} end @param {boolean} focus @returns {void} */
  _move(start, end, focus) {
    if (start === end || start < 0 || end < 0 || start >= this._values.length || end >= this._values.length) return;
    const [value] = this._values.splice(start, 1);
    this._values.splice(end, 0, value);
    this._renderChips(focus ? end : -1);
    this.emit('change', { values: this.getValues() });
  }

  /** @param {number} index @param {number} [focusIndex=-1] @returns {void} */
  _removeAt(index, focusIndex = -1) {
    const [value] = this._values.splice(index, 1);
    if (value === undefined) return;
    this._renderChips(focusIndex);
    if (focusIndex < 0 && this._values.length === 0) this._input.focus();
    this.emit('remove', { value });
    this.emit('change', { values: this.getValues() });
  }

  /** @param {string} message @returns {void} */
  _showError(message) {
    this._status.textContent = message;
    this._input.setAttribute('aria-invalid', 'true');
  }

  /** @returns {void} */
  destroy() {
    for (const node of this._ownedNodes ?? []) node.remove();
    if (this._initialState === null) this.el.removeAttribute('data-state');
    else this.el.setAttribute('data-state', this._initialState);
    if (this._initialDisabled === null) this.el.removeAttribute('data-disabled');
    else this.el.setAttribute('data-disabled', this._initialDisabled);
    super.destroy();
  }
}

/** @param {unknown} values @param {boolean} unique @returns {string[]} */
function normalizeValues(values, unique) {
  if (!Array.isArray(values)) return [];
  const normalized = values.map((value) => String(value));
  return unique ? [...new Set(normalized)] : normalized;
}

/**
 * Values changed event.
 * @event ValueList#change
 * @type {CustomEvent<{values: string[]}>}
 */

/**
 * Value added event.
 * @event ValueList#add
 * @type {CustomEvent<{value: string}>}
 */

/**
 * Value removed event.
 * @event ValueList#remove
 * @type {CustomEvent<{value: string}>}
 */
