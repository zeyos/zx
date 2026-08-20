import { Component } from '../../core/component.js';
import { h } from '../../core/dom.js';
import {
  applyFilters, deriveSelectOptions, isActiveFilterValue
} from './filter-core.js';

/** @typedef {Record<string, any>} DataFilterRow */
/**
 * @typedef {Object} DataFilterOption
 * @property {unknown} value Option value.
 * @property {string} [label] Option label.
 */

/**
 * @typedef {Object} SelectFilterDefinition
 * @property {'select'} type
 * @property {string} id State key.
 * @property {string} label Visible label.
 * @property {string} [field] Single row field.
 * @property {Array<string|((row: DataFilterRow) => unknown)>} [fields] Row fields combined with OR.
 * @property {(row: DataFilterRow) => unknown} [get] Custom value accessor.
 * @property {Array<unknown|DataFilterOption>} [options] Explicit options; omitted derives distinct values.
 * @property {string} [emptyLabel] Empty option label.
 */

/**
 * @typedef {Object} TextFilterDefinition
 * @property {'text'} type
 * @property {string} id State key.
 * @property {string} label Visible label.
 * @property {Array<string|((row: DataFilterRow) => unknown)>} fields Search fields.
 * @property {string} [placeholder] Search placeholder.
 */

/**
 * @typedef {Object} CustomFilterDefinition
 * @property {'custom'} type
 * @property {string} id State key.
 * @property {string} label Visible label.
 * @property {Element} element User-supplied native or custom control.
 * @property {(row: DataFilterRow, value: unknown) => boolean} predicate Row predicate.
 */

/** @typedef {SelectFilterDefinition|TextFilterDefinition|CustomFilterDefinition} FilterDefinition */

/**
 * @typedef {Object} DataFilterOptions
 * @property {FilterDefinition[]} [filters=[]] Declarative filters.
 * @property {DataFilterRow[]} [data=[]] Rows to filter.
 * @property {boolean} [autoApply=true] Apply and emit whenever a control changes.
 * @property {string|null} [clearLabel=null] Clear button label; null resolves `dataFilter.clear`.
 * @property {(event: CustomEvent<DataFilterEventDetail>) => void} [onfilter]
 */

/** @typedef {{rows: DataFilterRow[], state: Record<string, unknown>}} DataFilterEventDetail */

/**
 * Inline declarative filter bar that produces a filtered copy of client-side data.
 * @fires DataFilter#filter
 * @extends {Component<DataFilterOptions>}
 */
export class DataFilter extends Component {
  static cssName = 'data-filter';

  /** @type {DataFilterOptions} */
  static defaults = {
    filters: [],
    data: [],
    autoApply: true,
    clearLabel: null
  };

  /**
   * Creates a filter bar around a target or creates a new root when target is null.
   * @param {Element|string|null} target Existing root, selector, or null.
   * @param {DataFilterOptions} [options={}] Filter options.
   */
  constructor(target, options = {}) {
    super(target, options);
  }

  /** @returns {HTMLElement} Filter root. */
  render() {
    const root = /** @type {HTMLElement} */ (this.el ?? h('div'));
    this._originalChildren = this.el ? Array.from(this.el.childNodes) : null;
    this._filters = Array.isArray(this.options.filters) ? this.options.filters.map((definition) => ({ ...definition })) : [];
    this._data = Array.isArray(this.options.data) ? [...this.options.data] : [];
    this._state = {};
    this._entries = new Map();
    this._customOrigins = new Map();
    this._restored = false;

    const ids = new Set();
    for (const definition of this._filters) {
      validateDefinition(definition);
      if (ids.has(definition.id)) throw new RangeError(`Duplicate filter id: ${definition.id}`);
      ids.add(definition.id);
      if (definition.type === 'custom' && !this._customOrigins.has(definition.element)) {
        this._customOrigins.set(definition.element, {
          parent: definition.element.parentNode,
          nextSibling: definition.element.nextSibling
        });
      }
      this._state[definition.id] = definition.type === 'custom' ? readElementValue(definition.element) : '';
    }
    this._filtered = applyFilters(this._data, this._filters, this._state);

    this._controls = h('div', { class: 'zx-data-filter__controls' });
    this._badge = h('span', {
      class: 'zx-data-filter__badge',
      ariaLive: 'polite',
      hidden: true
    }, '0');
    this._clearButton = h('button', {
      class: 'zx-data-filter__clear',
      type: 'button',
      hidden: true
    }, this.options.clearLabel == null ? this.msg('dataFilter.clear') : String(this.options.clearLabel));
    root.replaceChildren(this._controls, this._badge, this._clearButton);
    this.listen(this._clearButton, 'click', () => this.clear());
    for (const definition of this._filters) this._appendFilter(definition);
    this._syncActiveState();
    return root;
  }

  /**
   * Replaces source rows and refreshes auto-derived select options.
   * @param {DataFilterRow[]} rows New source rows.
   * @returns {this}
   * @fires DataFilter#filter
   */
  setData(rows) {
    assertRows(rows);
    this._data = [...rows];
    for (const definition of this._filters) {
      if (definition.type !== 'select') continue;
      const entry = this._entries.get(definition.id);
      if (entry) this._populateSelect(definition, entry);
    }
    this._syncActiveState();
    if (this.options.autoApply) this.apply();
    else this._filtered = applyFilters(this._data, this._filters, this._state);
    return this;
  }

  /**
   * Applies current state, emits the filtered rows, and returns them.
   * @returns {DataFilterRow[]} Filtered copy.
   * @fires DataFilter#filter
   */
  apply() {
    this._filtered = applyFilters(this._data, this._filters, this._state);
    const rows = [...this._filtered];
    this.emit('filter', { rows, state: this.getState() });
    return rows;
  }

  /**
   * Clears every control and applies the empty state.
   * @returns {this}
   * @fires DataFilter#filter
   */
  clear() {
    for (const definition of this._filters) this._state[definition.id] = '';
    this._syncControls();
    this._syncActiveState();
    this.apply();
    return this;
  }

  /** @returns {Record<string, unknown>} Shallow copy of state keyed by filter id. */
  getState() {
    return { ...this._state };
  }

  /**
   * Replaces filter state. Missing filter ids are cleared.
   * @param {Record<string, unknown>} state State keyed by filter id.
   * @returns {this}
   * @fires DataFilter#filter
   */
  setState(state) {
    if (!state || typeof state !== 'object' || Array.isArray(state)) {
      throw new TypeError('DataFilter state must be an object');
    }
    for (const definition of this._filters) {
      this._state[definition.id] = Object.prototype.hasOwnProperty.call(state, definition.id) ? state[definition.id] : '';
    }
    this._syncControls();
    this._syncActiveState();
    if (this.options.autoApply) this.apply();
    else this._filtered = applyFilters(this._data, this._filters, this._state);
    return this;
  }

  /**
   * Adds one filter control without mutating the original options array.
   * @param {FilterDefinition} definition Filter definition.
   * @returns {this}
   */
  addFilter(definition) {
    validateDefinition(definition);
    const copy = { ...definition };
    this._filters.push(copy);
    this._state[copy.id] = copy.type === 'custom' ? readElementValue(copy.element) : '';
    this._appendFilter(copy);
    this._filtered = applyFilters(this._data, this._filters, this._state);
    this._syncActiveState();
    return this;
  }

  /** Restores enhanced content and user-owned custom controls. @returns {void} */
  destroy() {
    if (!this._restored) {
      if (this._originalChildren) this.el.replaceChildren(...this._originalChildren);
      restoreCustomElements(this._customOrigins);
      this._restored = true;
    }
    super.destroy();
  }

  /** @param {FilterDefinition} definition @returns {void} */
  _appendFilter(definition) {
    validateDefinition(definition);
    if (this._entries.has(definition.id)) throw new RangeError(`Duplicate filter id: ${definition.id}`);

    let element;
    const entry = { element: null, options: [] };
    if (definition.type === 'select') {
      element = h('select', { ariaLabel: definition.label });
      entry.element = element;
      this._populateSelect(definition, entry);
      this.listen(element, 'change', () => {
        const index = Number(element.value) - 1;
        this._state[definition.id] = index >= 0 ? entry.options[index]?.value ?? '' : '';
        this._controlChanged();
      });
    } else if (definition.type === 'text') {
      element = h('input', {
        type: 'search',
        placeholder: definition.placeholder ?? '',
        ariaLabel: definition.label,
        autocomplete: 'off'
      });
      entry.element = element;
      this.listen(element, 'input', () => {
        this._state[definition.id] = element.value;
        this._controlChanged();
      });
    } else {
      element = definition.element;
      if (!this._customOrigins.has(element)) {
        this._customOrigins.set(element, { parent: element.parentNode, nextSibling: element.nextSibling });
      }
      entry.element = element;
      const inputEvent = element.matches?.('input:not([type="checkbox"]):not([type="radio"]), textarea') ? 'input' : 'change';
      this.listen(element, inputEvent, () => {
        this._state[definition.id] = readElementValue(element);
        this._controlChanged();
      });
    }

    this._entries.set(definition.id, entry);
    const field = h('label', { class: 'zx-data-filter__field' },
      h('span', { class: 'zx-data-filter__label' }, definition.label),
      element
    );
    this._controls.append(field);
  }

  /** @param {SelectFilterDefinition} definition @param {{element: HTMLSelectElement, options: Array<{value: unknown, label: string}>}} entry @returns {void} */
  _populateSelect(definition, entry) {
    const selected = this._state[definition.id];
    entry.options = Array.isArray(definition.options) ?
      definition.options.map(normalizeExplicitOption) : deriveSelectOptions(this._data, definition);
    const empty = h('option', { value: '' }, definition.emptyLabel ?? this.msg('dataFilter.all'));
    const fragment = document.createDocumentFragment();
    fragment.append(empty);
    entry.options.forEach((option, index) => {
      fragment.append(h('option', { value: String(index + 1) }, option.label));
    });
    entry.element.replaceChildren(fragment);
    const selectedIndex = entry.options.findIndex((option) => sameValue(option.value, selected));
    entry.element.value = selectedIndex >= 0 ? String(selectedIndex + 1) : '';
    if (selectedIndex < 0) this._state[definition.id] = '';
  }

  /** @returns {void} */
  _controlChanged() {
    this._syncActiveState();
    if (this.options.autoApply) this.apply();
    else this._filtered = applyFilters(this._data, this._filters, this._state);
  }

  /** @returns {void} */
  _syncControls() {
    for (const definition of this._filters) {
      const entry = this._entries.get(definition.id);
      if (!entry) continue;
      const value = this._state[definition.id];
      if (definition.type === 'select') {
        const index = entry.options.findIndex((option) => sameValue(option.value, value));
        entry.element.value = index >= 0 ? String(index + 1) : '';
        if (index < 0) this._state[definition.id] = '';
      } else {
        writeElementValue(entry.element, value);
      }
    }
  }

  /** @returns {void} */
  _syncActiveState() {
    const count = this._filters.reduce((total, definition) =>
      total + Number(isActiveFilterValue(this._state[definition.id])), 0);
    this._badge.textContent = String(count);
    this._badge.hidden = count === 0;
    this._clearButton.hidden = count === 0;
  }
}

/**
 * Filter result event.
 * @event DataFilter#filter
 * @type {CustomEvent<DataFilterEventDetail>}
 */

/** @param {unknown} definition @returns {asserts definition is FilterDefinition} */
function validateDefinition(definition) {
  if (!definition || typeof definition !== 'object') throw new TypeError('Filter definition must be an object');
  if (!['select', 'text', 'custom'].includes(definition.type)) throw new TypeError(`Unknown filter type: ${definition.type}`);
  if (typeof definition.id !== 'string' || !definition.id) throw new TypeError('Filter definition requires an id');
  if (definition.type === 'custom') {
    if (!definition.element || definition.element.nodeType !== 1) throw new TypeError('Custom filter requires an Element');
    if (typeof definition.predicate !== 'function') throw new TypeError('Custom filter requires a predicate');
  }
}

/** @param {unknown} option @returns {{value: unknown, label: string}} */
function normalizeExplicitOption(option) {
  if (option && typeof option === 'object' && Object.prototype.hasOwnProperty.call(option, 'value')) {
    return { value: option.value, label: String(option.label ?? option.value ?? '') };
  }
  return { value: option, label: String(option ?? '') };
}

/** @param {Element} element @returns {unknown} */
function readElementValue(element) {
  if ('checked' in element && ['checkbox', 'radio'].includes(element.type)) return element.checked;
  return 'value' in element ? element.value : element.getAttribute('data-value') ?? '';
}

/** @param {Element} element @param {unknown} value @returns {void} */
function writeElementValue(element, value) {
  if ('checked' in element && ['checkbox', 'radio'].includes(element.type)) element.checked = Boolean(value);
  else if ('value' in element) element.value = value == null ? '' : String(value);
  else if (value == null || value === '') element.removeAttribute('data-value');
  else element.setAttribute('data-value', String(value));
}

/** @param {unknown} left @param {unknown} right @returns {boolean} */
function sameValue(left, right) {
  if (Object.is(left, right)) return true;
  if (left == null || right == null) return false;
  return String(left) === String(right);
}

/** @param {unknown} rows @returns {asserts rows is DataFilterRow[]} */
function assertRows(rows) {
  if (!Array.isArray(rows)) throw new TypeError('DataFilter data must be an array');
}

/**
 * Restores custom elements once their original following sibling is back in place. This
 * dependency-aware order preserves adjacent custom controls as well as isolated controls.
 * @param {Map<Element, {parent: ParentNode|null, nextSibling: Node|null}>} origins Origins.
 * @returns {void}
 */
function restoreCustomElements(origins) {
  const pending = [...origins];
  for (let pass = pending.length; pending.length > 0 && pass >= 0; pass -= 1) {
    let restored = 0;
    for (let index = pending.length - 1; index >= 0; index -= 1) {
      const [element, origin] = pending[index];
      if (!origin.parent) {
        element.remove();
      } else if (origin.nextSibling && origin.nextSibling.parentNode !== origin.parent) {
        continue;
      } else {
        origin.parent.insertBefore(element, origin.nextSibling);
      }
      pending.splice(index, 1);
      restored += 1;
    }
    if (restored === 0) break;
  }
  for (const [element, origin] of pending) {
    if (origin.parent) origin.parent.append(element);
    else element.remove();
  }
}
