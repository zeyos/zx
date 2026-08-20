import { Component } from '../../core/component.js';
import { h } from '../../core/dom.js';

/**
 * @typedef {Object} MultiValueEditorOptions
 * @property {unknown[]} [values=[]] Initial ordered values.
 * @property {unknown[]|Record<string, string>|null} [options=null] Allowed values; null uses text inputs.
 * @property {string} [addLabel='Add value'] Add-row button text.
 */

/**
 * Ordered value editor with explicit editable rows and controls.
 * @fires MultiValueEditor#change
 * @extends {Component<MultiValueEditorOptions>}
 */
export class MultiValueEditor extends Component {
  static cssName = 'multi-value-editor';

  /** @type {MultiValueEditorOptions} */
  static defaults = { values: [], options: null, addLabel: 'Add value' };

  /** @returns {HTMLElement} */
  render() {
    const root = /** @type {HTMLElement} */ (this.el ?? h('div'));
    this._values = Array.isArray(this.options.values) ? this.options.values.map(String) : [];
    this._ownedNodes = [];
    this._rows = h('div', { class: 'zx-multi-value-editor__rows' });
    this._add = h('button', {
      class: 'zx-btn zx-multi-value-editor__add',
      type: 'button',
      dataset: { action: 'add' }
    }, String(this.options.addLabel ?? 'Add value'));
    this._ownedNodes.push(this._rows, this._add);
    root.append(this._rows, this._add);
    this.listen(root, 'click', (event) => this._handleClick(event));
    this.listen(this._rows, 'change', (event) => this._handleChange(event));
    this._renderRows();
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
   * Replaces all rows.
   * @param {unknown[]} values New ordered values.
   * @param {{silent?: boolean}} [options={}] Set `silent` to suppress `change`.
   * @returns {this}
   */
  setValues(values, { silent = false } = {}) {
    this._values = Array.isArray(values) ? values.map(String) : [];
    this._renderRows();
    if (!silent) this.emit('change', { values: this.getValues() });
    return this;
  }

  /** @param {number} [focusIndex=-1] @returns {void} */
  _renderRows(focusIndex = -1) {
    const choices = normalizeOptions(this.options.options);
    const useSelect = this.options.options !== null;
    const rows = this._values.map((value, index) => {
      const control = useSelect ? h('select', {
        class: 'zx-multi-value-editor__value',
        ariaLabel: `Value ${index + 1}`,
        dataset: { index }
      }, choices.map(([optionValue, label]) => h('option', {
        value: optionValue,
        selected: optionValue === value
      }, label))) : h('input', {
        class: 'zx-multi-value-editor__value',
        type: 'text',
        value,
        ariaLabel: `Value ${index + 1}`,
        dataset: { index }
      });
      return h('div', { class: 'zx-multi-value-editor__row', dataset: { row: index } },
        control,
        h('div', { class: 'zx-multi-value-editor__controls' },
          h('button', {
            class: 'zx-btn',
            type: 'button',
            disabled: index === 0,
            ariaLabel: `Move value ${index + 1} up`,
            dataset: { action: 'up', index }
          }, '↑'),
          h('button', {
            class: 'zx-btn',
            type: 'button',
            disabled: index === this._values.length - 1,
            ariaLabel: `Move value ${index + 1} down`,
            dataset: { action: 'down', index }
          }, '↓'),
          h('button', {
            class: 'zx-btn',
            type: 'button',
            ariaLabel: `Remove value ${index + 1}`,
            dataset: { action: 'remove', index }
          }, '×')
        )
      );
    });
    this._rows.replaceChildren(...rows);
    if (focusIndex >= 0) rows[focusIndex]?.querySelector('.zx-multi-value-editor__value')?.focus();
  }

  /** @param {MouseEvent} event @returns {void} */
  _handleClick(event) {
    const button = event.target instanceof Element ? event.target.closest('[data-action]') : null;
    if (!button || !this.el.contains(button)) return;
    const action = button.dataset.action;
    const index = Number(button.dataset.index);
    if (action === 'add') {
      const choices = normalizeOptions(this.options.options);
      this._values.push(this.options.options === null ? '' : choices[0]?.[0] ?? '');
      this._renderRows(this._values.length - 1);
      this._emitChange();
    } else if (action === 'remove' && Number.isInteger(index)) {
      this._values.splice(index, 1);
      this._renderRows(Math.min(index, this._values.length - 1));
      this._emitChange();
    } else if ((action === 'up' || action === 'down') && Number.isInteger(index)) {
      const target = index + (action === 'up' ? -1 : 1);
      if (target < 0 || target >= this._values.length) return;
      [this._values[index], this._values[target]] = [this._values[target], this._values[index]];
      this._renderRows(target);
      this._emitChange();
    }
  }

  /** @param {Event} event @returns {void} */
  _handleChange(event) {
    const control = event.target instanceof Element ? event.target.closest('[data-index]') : null;
    if (!control) return;
    const index = Number(control.dataset.index);
    if (!Number.isInteger(index) || index < 0 || index >= this._values.length) return;
    this._values[index] = control.value;
    this._emitChange();
  }

  /** @returns {void} */
  _emitChange() {
    this.emit('change', { values: this.getValues() });
  }

  /** @returns {void} */
  destroy() {
    for (const node of this._ownedNodes ?? []) node.remove();
    super.destroy();
  }
}

/** @param {MultiValueEditorOptions['options']} options @returns {Array<[string, string]>} */
function normalizeOptions(options) {
  if (Array.isArray(options)) return options.map((value) => [String(value), String(value)]);
  if (options && typeof options === 'object') {
    return Object.entries(options).map(([value, label]) => [value, String(label)]);
  }
  return [];
}

/**
 * Ordered values changed event.
 * @event MultiValueEditor#change
 * @type {CustomEvent<{values: string[]}>
 */
