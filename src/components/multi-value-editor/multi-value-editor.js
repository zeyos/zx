import { Component } from '../../core/component.js';
import { h } from '../../core/dom.js';
import { icon } from '../../core/icons.js';

/**
 * @typedef {Object} MultiValueEditorOptions
 * @property {unknown[]} [values=[]] Initial ordered values.
 * @property {unknown[]|Record<string, string>|null} [options=null] Allowed values; null uses text inputs.
 * @property {string} [addLabel='Add value'] Add-row button text.
 * @property {'both'|'buttons'|'drag'|'none'} [reorder='both'] Reordering affordances each row gets:
 *   a drag handle, the up/down buttons, both, or neither.
 */

/** Affordances each `reorder` setting turns on. */
const REORDER = Object.freeze({
  both: { drag: true, buttons: true },
  buttons: { drag: false, buttons: true },
  drag: { drag: true, buttons: false },
  none: { drag: false, buttons: false }
});

/** Focusable parts of a row, so a re-render can put focus back where the reader left it. */
const PARTS = Object.freeze({
  value: '.zx-multi-value-editor__value',
  handle: '.zx-multi-value-editor__handle',
  up: '[data-action="up"]',
  down: '[data-action="down"]'
});

/**
 * Ordered value editor with explicit editable rows and controls.
 *
 * Rows reorder by dragging their handle or by pressing the up/down buttons — `reorder` picks which
 * of the two a row offers. The handle is also a keyboard control (arrows, Home, End), so drag-only
 * mode still reorders without a pointer.
 * @fires MultiValueEditor#change
 * @extends {Component<MultiValueEditorOptions>}
 */
export class MultiValueEditor extends Component {
  static cssName = 'multi-value-editor';

  /** @type {MultiValueEditorOptions} */
  static defaults = { values: [], options: null, addLabel: 'Add value', reorder: 'both' };

  /** @returns {HTMLElement} */
  render() {
    const root = /** @type {HTMLElement} */ (this.el ?? h('div'));
    this.el = root;
    this._values = Array.isArray(this.options.values) ? this.options.values.map(String) : [];
    this._ownedNodes = [];
    this._initialState = root.getAttribute('data-state');
    this._dragIndex = -1;
    /** @type {HTMLElement|null} Row made draggable by a pointer press on its handle. */
    this._armed = null;
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
    this.listen(this._rows, 'keydown', (event) => this._handleKeydown(event));
    if (this._reorder().drag) {
      this.listen(this._rows, 'pointerdown', (event) => this._handlePointerDown(event));
      this.listen(this._rows, 'dragstart', (event) => this._handleDragStart(event));
      this.listen(this._rows, 'dragover', (event) => this._handleDragOver(event));
      this.listen(this._rows, 'dragleave', (event) => this._handleDragLeave(event));
      this.listen(this._rows, 'drop', (event) => this._handleDrop(event));
      this.listen(this._rows, 'dragend', () => this._finishDrag());
      // A press that never became a drag still has to disarm the row, and its pointerup can land
      // anywhere — including outside the component.
      this.listen(document, 'pointerup', () => this._disarm());
      this.listen(document, 'pointercancel', () => this._disarm());
    }
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

  /** @returns {{drag: boolean, buttons: boolean}} */
  _reorder() {
    return REORDER[this.options.reorder] ?? REORDER.both;
  }

  /**
   * @param {number} [focusIndex=-1] Row to focus after the render, or -1 for none.
   * @param {keyof PARTS} [focusPart='value'] Which control of that row takes focus.
   * @returns {void}
   */
  _renderRows(focusIndex = -1, focusPart = 'value') {
    const choices = normalizeOptions(this.options.options);
    const useSelect = this.options.options !== null;
    const { drag, buttons } = this._reorder();
    const last = this._values.length - 1;
    const rows = this._values.map((value, index) => {
      // An option list that has lost a stored value still has to round-trip it, or `getValues()`
      // would quietly return something the select never showed.
      const entries = !useSelect || choices.some(([option]) => option === value)
        ? choices
        : [[value, value], ...choices];
      const control = useSelect ? h('select', {
        class: 'zx-multi-value-editor__value',
        ariaLabel: `Value ${index + 1}`,
        dataset: { index }
      }, entries.map(([optionValue, label]) => h('option', {
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
        drag ? h('button', {
          class: 'zx-multi-value-editor__handle',
          type: 'button',
          ariaLabel: `Reorder value ${index + 1}. Use the arrow keys to move it.`,
          dataset: { action: 'grab', index }
        }, icon('drag', { size: 12 })) : null,
        control,
        h('div', { class: 'zx-multi-value-editor__controls' },
          buttons ? h('button', {
            class: 'zx-btn',
            type: 'button',
            // `aria-disabled` rather than `disabled`: the buttons re-render on every move, and a
            // control that disables itself under the reader's finger drops focus to the document.
            ariaDisabled: String(index === 0),
            ariaLabel: `Move value ${index + 1} up`,
            dataset: { action: 'up', index }
          }, icon('chevron-up', { size: 12 })) : null,
          buttons ? h('button', {
            class: 'zx-btn',
            type: 'button',
            ariaDisabled: String(index === last),
            ariaLabel: `Move value ${index + 1} down`,
            dataset: { action: 'down', index }
          }, icon('chevron-down', { size: 12 })) : null,
          h('button', {
            class: 'zx-btn',
            type: 'button',
            ariaLabel: `Remove value ${index + 1}`,
            dataset: { action: 'remove', index }
          }, icon('x', { size: 12 }))
        )
      );
    });
    this._rows.replaceChildren(...rows);
    if (focusIndex >= 0) {
      const row = rows[Math.min(focusIndex, rows.length - 1)];
      /** @type {HTMLElement|null|undefined} */
      (row?.querySelector(PARTS[focusPart] ?? PARTS.value))?.focus();
    }
  }

  /** @param {MouseEvent} event @returns {void} */
  _handleClick(event) {
    const button = event.target instanceof Element ? event.target.closest('[data-action]') : null;
    if (!button || !this.el.contains(button)) return;
    if (button.getAttribute('aria-disabled') === 'true') return;
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
      // Focus stays on the button that moved the row, so the reader can press it again.
      this._move(index, index + (action === 'up' ? -1 : 1), action);
    }
  }

  /** @param {Event} event @returns {void} */
  _handleChange(event) {
    const control = event.target instanceof Element ? event.target.closest('[data-index]') : null;
    if (!control || !('value' in control)) return;
    const index = Number(control.dataset.index);
    if (!Number.isInteger(index) || index < 0 || index >= this._values.length) return;
    this._values[index] = control.value;
    this._emitChange();
  }

  /**
   * The handle is the keyboard equivalent of dragging it, so `reorder: 'drag'` is still operable
   * without a pointer.
   * @param {KeyboardEvent} event
   * @returns {void}
   */
  _handleKeydown(event) {
    const handle = event.target instanceof Element
      ? event.target.closest('.zx-multi-value-editor__handle')
      : null;
    if (!handle) return;
    const index = Number(handle.dataset.index);
    const target = event.key === 'ArrowUp' ? index - 1
      : event.key === 'ArrowDown' ? index + 1
        : event.key === 'Home' ? 0
          : event.key === 'End' ? this._values.length - 1
            : -1;
    if (target < 0 || target >= this._values.length) return;
    event.preventDefault();
    this._move(index, target, 'handle');
  }

  /**
   * Arms the row for dragging. Only the handle does this, so text selection inside a row's input
   * keeps working and a stray drag cannot reorder anything.
   * @param {PointerEvent} event
   * @returns {void}
   */
  _handlePointerDown(event) {
    const handle = event.target instanceof Element
      ? event.target.closest('.zx-multi-value-editor__handle')
      : null;
    this._disarm();
    if (!handle || handle.disabled) return;
    const row = /** @type {HTMLElement|null} */ (handle.closest('.zx-multi-value-editor__row'));
    if (!row) return;
    row.draggable = true;
    this._armed = row;
  }

  /** @returns {void} */
  _disarm() {
    if (this._armed) this._armed.draggable = false;
    this._armed = null;
  }

  /** @param {DragEvent} event @returns {void} */
  _handleDragStart(event) {
    const row = event.target instanceof Element
      ? event.target.closest('.zx-multi-value-editor__row')
      : null;
    if (!row || row !== this._armed) {
      event.preventDefault();
      return;
    }
    this._dragIndex = Number(row.dataset.row);
    row.dataset.dragging = 'true';
    this.el.setAttribute('data-state', 'dragging');
    event.dataTransfer?.setData('text/plain', String(this._dragIndex));
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  /** @param {DragEvent} event @returns {void} */
  _handleDragOver(event) {
    if (this._dragIndex < 0) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    this._showDrop(this._dropTarget(event.clientY));
  }

  /** @param {DragEvent} event @returns {void} */
  _handleDragLeave(event) {
    const to = event.relatedTarget;
    if (to instanceof Node && this._rows.contains(to)) return;
    this._clearDrop();
  }

  /** @param {DragEvent} event @returns {void} */
  _handleDrop(event) {
    if (this._dragIndex < 0) return;
    event.preventDefault();
    const from = this._dragIndex;
    const slot = this._dropTarget(event.clientY);
    this._finishDrag();
    // The slot is an insertion point in the list as it stands; lifting the row out shifts every
    // slot after it down by one.
    this._move(from, slot > from ? slot - 1 : slot, 'handle');
  }

  /** @returns {void} */
  _finishDrag() {
    this._dragIndex = -1;
    this._disarm();
    this._clearDrop();
    for (const row of this._rows.children) delete (/** @type {HTMLElement} */ (row)).dataset.dragging;
    if (this._initialState === null) this.el.removeAttribute('data-state');
    else this.el.setAttribute('data-state', this._initialState);
  }

  /**
   * Insertion slot (0…length) for a pointer at `clientY`.
   * @param {number} clientY Pointer position.
   * @returns {number}
   */
  _dropTarget(clientY) {
    const rows = [...this._rows.children];
    for (const [index, row] of rows.entries()) {
      const box = row.getBoundingClientRect();
      if (clientY < box.top + box.height / 2) return index;
    }
    return rows.length;
  }

  /** @param {number} slot Insertion slot to mark. @returns {void} */
  _showDrop(slot) {
    const rows = [...this._rows.children];
    // Dropping either side of the row being dragged puts it back where it was; showing a line
    // there would promise a move that does not happen.
    const inert = slot === this._dragIndex || slot === this._dragIndex + 1;
    for (const [index, row] of rows.entries()) {
      const cell = /** @type {HTMLElement} */ (row);
      if (!inert && index === slot) cell.dataset.drop = 'before';
      else if (!inert && slot === rows.length && index === rows.length - 1) cell.dataset.drop = 'after';
      else delete cell.dataset.drop;
    }
  }

  /** @returns {void} */
  _clearDrop() {
    for (const row of this._rows.children) delete (/** @type {HTMLElement} */ (row)).dataset.drop;
  }

  /**
   * @param {number} from Index to move.
   * @param {number} to Destination index.
   * @param {keyof PARTS} part Control of the moved row that takes focus.
   * @returns {boolean} Whether anything moved.
   */
  _move(from, to, part) {
    const size = this._values.length;
    if (from === to || from < 0 || to < 0 || from >= size || to >= size) return false;
    const [value] = this._values.splice(from, 1);
    this._values.splice(to, 0, value);
    this._renderRows(to, part);
    this._emitChange();
    return true;
  }

  /** @returns {void} */
  _emitChange() {
    this.emit('change', { values: this.getValues() });
  }

  /** @returns {void} */
  destroy() {
    if (this._initialState === null) this.el?.removeAttribute('data-state');
    else this.el?.setAttribute('data-state', this._initialState);
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
