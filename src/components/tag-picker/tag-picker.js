import { Component } from '../../core/component.js';
import { h, restoreTarget, snapshotTarget } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { position } from '../../core/position.js';
import { uid } from '../../core/util.js';
import { matchItems } from '../select/filter.js';

/** @typedef {Record<string, any>|string|number} TagItem */
/** @typedef {string|((item: TagItem) => unknown)} TagValueReader */
/** @typedef {string|((item: TagItem) => string)} TagLabelReader */
/**
 * @typedef {Object} TagPickerOptions
 * @property {TagItem[]} [items=[]] Selectable items.
 * @property {unknown[]} [values=[]] Initially selected IDs.
 * @property {TagValueReader} [valueKey='ID'] Item ID property or reader.
 * @property {TagLabelReader} [labelKey='name'] Item label property or reader.
 * @property {Array<TagValueReader>|null} [searchKeys=null] Fields searched by local filtering.
 * @property {'local'|((query: string) => Promise<TagItem[]>|TagItem[])} [filter='local'] Filtering mode.
 * @property {number} [minQuery=0] Minimum async query length.
 * @property {number} [debounce=200] Async query delay in milliseconds.
 * @property {boolean} [allowCreate=false] Whether unknown values may be created from the query.
 * @property {number|null} [max=null] Maximum number of selected values.
 * @property {boolean} [closeOnSelect=false] Whether picking an item closes the list.
 * @property {string} [placeholder=''] Empty-state input text.
 * @property {number} [listHeight=260] Maximum list height in pixels.
 * @property {boolean} [disabled=false] Whether interaction is disabled.
 * @property {boolean} [readonly=false] Whether tags may be added or removed.
 * @property {((item: TagItem) => Node|string)|null} [renderItem=null] Option renderer.
 * @property {((item: TagItem) => Node|string)|null} [renderTag=null] Tag-label renderer.
 * @property {Record<string, string>|Record<string, Record<string, string>>} [msg] Localized messages.
 * @property {(event: CustomEvent<{values: unknown[], items: TagItem[]}>) => void} [onchange] Change listener.
 * @property {(event: CustomEvent<{value: unknown, item: TagItem}>) => void} [onadd] Add listener.
 * @property {(event: CustomEvent<{value: unknown, item: TagItem}>) => void} [onremove] Remove listener.
 * @property {(event: CustomEvent<{value: unknown, item: TagItem}>) => void} [oncreate] Create listener.
 * @property {(event: CustomEvent<{query: string}>) => void} [onquery] Async-query listener.
 * @property {(event: CustomEvent<Record<string, never>>) => void} [onopen] Open listener.
 * @property {(event: CustomEvent<Record<string, never>>) => void} [onclose] Close listener.
 * @property {(event: CustomEvent<{error: Error}>) => void} [onerror] Async-failure listener.
 */

/**
 * Multi-select combobox that renders its selection as removable tags inside the control
 * (APG combobox with a multi-selectable listbox).
 *
 * It differs from the two neighbouring components on purpose: `ValueList` takes free text with no
 * catalogue behind it, `Checklist` shows a fixed set in full, and `TagPicker` searches a large
 * catalogue and keeps the chosen values visible in the control.
 *
 * @fires TagPicker#change
 * @fires TagPicker#add
 * @fires TagPicker#remove
 * @fires TagPicker#create
 * @fires TagPicker#query
 * @fires TagPicker#open
 * @fires TagPicker#close
 * @fires TagPicker#error
 * @extends {Component<TagPickerOptions>}
 */
export class TagPicker extends Component {
  static cssName = 'tag-picker';

  /** @type {TagPickerOptions} */
  static defaults = {
    items: [],
    values: [],
    valueKey: 'ID',
    labelKey: 'name',
    searchKeys: null,
    filter: 'local',
    minQuery: 0,
    debounce: 200,
    allowCreate: false,
    max: null,
    closeOnSelect: false,
    placeholder: '',
    listHeight: 260,
    disabled: false,
    readonly: false,
    renderItem: null,
    renderTag: null
  };

  /** @returns {HTMLElement} */
  render() {
    // render() runs inside the base constructor, before class-field initializers would run.
    this._items = [];
    this._selected = [];
    this._visible = [];
    this._entries = [];
    this._activeIndex = -1;
    this._open = false;
    this._disabled = false;
    this._readonly = false;
    this._loading = false;
    this._requestSequence = 0;
    this._queryTimer = null;
    this._position = null;
    this._activeId = null;
    this._createdRoot = this.el === null;
    this._snapshot = this._createdRoot ? null : snapshotTarget(this.el);

    const root = /** @type {HTMLElement} */ (this.el ?? h('div'));
    this.el = root;

    const listId = uid('zx-tag-picker-list');
    const tags = h('span', { ref: 'tags', class: 'zx-tag-picker__tags' });
    const input = h('input', {
      ref: 'input',
      class: 'zx-tag-picker__input',
      type: 'text',
      role: 'combobox',
      autocomplete: 'off',
      spellcheck: false,
      ariaExpanded: 'false',
      ariaControls: listId,
      ariaAutocomplete: 'list',
      ariaLabel: this._message('tagPicker.input', 'Add a value'),
      placeholder: String(this.options.placeholder ?? '')
    });
    const toggle = h('button', {
      ref: 'toggle',
      class: 'zx-tag-picker__toggle',
      type: 'button',
      tabIndex: -1,
      ariaLabel: this._message('tagPicker.toggle', 'Toggle options')
    }, icon('chevron-down', { size: 15 }));
    const control = h('div', { ref: 'control', class: 'zx-tag-picker__control' },
      tags, input, toggle);

    const list = h('div', {
      ref: 'list',
      class: 'zx-tag-picker__list',
      id: listId,
      role: 'listbox',
      ariaMultiSelectable: 'true'
    });
    list.style.maxBlockSize = `${Math.max(0, Number(this.options.listHeight) || 0)}px`;
    const panel = h('div', { ref: 'panel', class: 'zx-tag-picker__panel', popover: 'manual' }, list);
    root.replaceChildren(control, panel);

    this._items = Array.isArray(this.options.items) ? this.options.items.slice() : [];
    this._visible = this._items.slice();
    this._disabled = Boolean(this.options.disabled);
    this._readonly = Boolean(this.options.readonly);

    this.listen(control, 'pointerdown', (event) => {
      // Clicking anywhere in the control focuses the input, except on a tag's remove button.
      const target = /** @type {Element} */ (event.target);
      if (target.closest('.zx-tag-picker__remove') || target.closest('.zx-tag-picker__toggle')) return;
      if (event.target !== input) {
        event.preventDefault();
        this.focus();
      }
      if (!this._open) this.open();
    });
    // Tag removal is delegated: the tags are rebuilt on every change, so per-tag listeners would
    // accumulate on the component's AbortController for elements that no longer exist.
    this.listen(tags, 'click', (event) => {
      const remove = /** @type {Element} */ (event.target).closest('.zx-tag-picker__remove');
      if (!remove || this._disabled || this._readonly) return;
      event.stopPropagation();
      const index = [...tags.children].indexOf(remove.closest('.zx-tag-picker__tag'));
      const item = this._selected[index];
      if (item === undefined) return;
      this.removeValue(this._valueOf(item));
      this.focus();
    });
    this.listen(input, 'input', () => this._onInput());
    this.listen(input, 'keydown', (event) => this._onKeydown(/** @type {KeyboardEvent} */ (event)));
    this.listen(input, 'blur', () => this.el.removeAttribute('data-focus'));
    this.listen(input, 'focus', () => this.el.setAttribute('data-focus', ''));
    this.listen(toggle, 'click', () => {
      this.focus();
      if (this._open) this.close();
      else this.open();
    });
    this.listen(panel, 'pointerdown', (event) => event.preventDefault());
    this.listen(panel, 'click', (event) => this._onOptionClick(/** @type {MouseEvent} */ (event)));
    this.listen(document, 'pointerdown', (event) => {
      if (this._open && !root.contains(/** @type {Node} */ (event.target))) this.close();
    }, { capture: true });

    this.setValues(this.options.values, { silent: true });
    this._syncDisabled();
    return root;
  }

  /** Selected IDs. @returns {unknown[]} */
  get values() {
    return this.getValues();
  }

  /** @param {unknown[]} next Selected IDs. */
  set values(next) {
    this.setValues(next);
  }

  /**
   * Returns the selected IDs in selection order.
   * @returns {unknown[]}
   */
  getValues() {
    return this._selected.map((item) => this._valueOf(item));
  }

  /**
   * Returns the selected items.
   * @returns {TagItem[]}
   */
  getItems() {
    return this._selected.slice();
  }

  /**
   * Replaces the whole selection.
   * @param {unknown[]} values Item IDs, or items.
   * @param {{silent?: boolean}} [options={}] Set `silent` to suppress `change`.
   * @returns {this}
   * @fires TagPicker#change
   */
  setValues(values, { silent = false } = {}) {
    const list = Array.isArray(values) ? values : [];
    const max = this.options.max === null || this.options.max === undefined
      ? Infinity
      : Number(this.options.max);
    const next = [];
    for (const value of list) {
      if (next.length >= max) break;
      const item = this._resolve(value);
      if (item !== null && !next.some((entry) => this._sameValue(entry, item))) next.push(item);
    }
    const changed = !sameSelection(next, this._selected, (item) => this._valueOf(item));
    this._selected = next;
    this._renderTags();
    this._renderOptions();
    if (changed && !silent) this._emitChange();
    return this;
  }

  /**
   * Adds one value to the selection.
   * @param {unknown} value Item ID, or an item.
   * @param {{silent?: boolean}} [options={}] Set `silent` to suppress events.
   * @returns {this}
   * @fires TagPicker#add
   * @fires TagPicker#change
   */
  addValue(value, { silent = false } = {}) {
    if (this.isFull()) return this;
    const item = this._resolve(value);
    if (item === null) return this;
    if (this._selected.some((entry) => this._sameValue(entry, item))) return this;
    this._selected.push(item);
    this._renderTags();
    this._renderOptions();
    if (!silent) {
      this.emit('add', { value: this._valueOf(item), item });
      this._emitChange();
    }
    return this;
  }

  /**
   * Removes one value from the selection.
   * @param {unknown} value Item ID, or an item.
   * @param {{silent?: boolean}} [options={}] Set `silent` to suppress events.
   * @returns {this}
   * @fires TagPicker#remove
   * @fires TagPicker#change
   */
  removeValue(value, { silent = false } = {}) {
    const id = this._valueOf(this._resolve(value) ?? value);
    const index = this._selected.findIndex((item) => Object.is(this._valueOf(item), id));
    if (index < 0) return this;
    const [item] = this._selected.splice(index, 1);
    this._renderTags();
    this._renderOptions();
    if (!silent) {
      this.emit('remove', { value: this._valueOf(item), item });
      this._emitChange();
    }
    return this;
  }

  /**
   * Clears the selection.
   * @param {{silent?: boolean}} [options={}] Set `silent` to suppress `change`.
   * @returns {this}
   */
  clear({ silent = false } = {}) {
    return this.setValues([], { silent });
  }

  /**
   * Restores the configured initial selection.
   * @param {{silent?: boolean}} [options={}] Reset behavior.
   * @returns {this}
   */
  reset({ silent = false } = {}) {
    return this.setValues(this.options.values, { silent });
  }

  /**
   * Replaces the catalogue of selectable items.
   * @param {TagItem[]} items Available items.
   * @returns {this}
   */
  setItems(items) {
    // Invalidate any in-flight query first: a late response must not overwrite this catalogue.
    this._cancelQuery();
    this._items = Array.isArray(items) ? items.slice() : [];
    if (typeof this.options.filter === 'function') this._visible = this._items.slice();
    else this._applyLocalFilter(this.refs.input.value);
    this._renderOptions();
    this._position?.update();
    return this;
  }

  /** Reports whether the configured maximum is reached. @returns {boolean} */
  isFull() {
    const max = this.options.max;
    return max !== null && max !== undefined && this._selected.length >= Number(max);
  }

  /** Opens the option list. @returns {this} */
  open() {
    if (this._disabled || this._readonly || this._open) return this;
    this._open = true;
    this.el.setAttribute('data-state', 'open');
    this.refs.input.setAttribute('aria-expanded', 'true');
    this._renderOptions();
    this._position = position(this.refs.control, /** @type {HTMLElement} */ (this.refs.panel), {
      placement: 'bottom-start',
      flip: true,
      matchWidth: true
    });
    this._setActive(this._entries.length > 0 ? 0 : -1);
    if (typeof this.options.filter === 'function') this._scheduleAsyncQuery(this.refs.input.value);
    this.emit('open', {});
    return this;
  }

  /** Closes the option list. @returns {this} */
  close() {
    if (!this._open) return this;
    this._open = false;
    this._cancelQuery();
    this._position?.destroy();
    this._position = null;
    this.el.setAttribute('data-state', 'closed');
    this.refs.input.setAttribute('aria-expanded', 'false');
    this.refs.input.removeAttribute('aria-activedescendant');
    this._activeIndex = -1;
    this._activeId = null;
    this.refs.input.value = '';
    this._syncInputWidth();
    this._applyLocalFilter('');
    this.emit('close', {});
    return this;
  }

  /** Focuses the text input. @returns {this} */
  focus() {
    this.refs.input.focus();
    return this;
  }

  /** Enables user interaction. @returns {this} */
  enable() {
    this._disabled = false;
    this._renderTags();
    this._syncDisabled();
    return this;
  }

  /** Disables user interaction and closes the list. @returns {this} */
  disable() {
    this.close();
    this._disabled = true;
    this._renderTags();
    this._syncDisabled();
    return this;
  }

  /**
   * Sets the read-only state.
   * @param {boolean} readonly Whether tags may be added or removed.
   * @returns {this}
   */
  setReadonly(readonly) {
    if (readonly) this.close();
    this._readonly = Boolean(readonly);
    this._renderTags();
    this._syncDisabled();
    return this;
  }

  /** Cancels pending work and restores an enhanced target. @returns {void} */
  destroy() {
    this._cancelQuery();
    this._position?.destroy();
    this._position = null;
    const root = this.el;
    super.destroy();
    if (!this._createdRoot && root) restoreTarget(root, this._snapshot);
  }

  /* ------------------------------------------------------------------ rendering -- */

  /** @returns {void} */
  _renderTags() {
    const tags = this._selected.map((item) => {
      const label = this._labelOf(item);
      const content = this.options.renderTag ? this.options.renderTag(item) : label;
      const tag = h('span', { class: 'zx-tag-picker__tag' },
        h('span', { class: 'zx-tag-picker__tag-label' }, content));
      if (!this._readonly && !this._disabled) {
        tag.append(h('button', {
          class: 'zx-icon-btn zx-tag-picker__remove',
          type: 'button',
          ariaLabel: this._message('tagPicker.remove', 'Remove %1', [label])
        }, icon('x', { size: 11 })));
      }
      return tag;
    });
    this.refs.tags.replaceChildren(...tags);
    this.el.toggleAttribute('data-empty', this._selected.length === 0);
    this._syncPlaceholder();
  }

  /** @returns {void} */
  _renderOptions() {
    const list = this.refs.list;
    this._entries = [];
    const nodes = [];

    for (const item of this._visible) {
      const value = this._valueOf(item);
      const selected = this._isSelected(value);
      const option = h('div', {
        class: 'zx-tag-picker__option',
        id: uid('zx-tag-picker-option'),
        role: 'option',
        ariaSelected: String(selected)
      },
      h('span', { class: 'zx-tag-picker__check', ariaHidden: 'true' },
        selected ? icon('check', { size: 13 }) : null),
      h('span', { class: 'zx-tag-picker__option-label' },
        this.options.renderItem ? this.options.renderItem(item) : this._labelOf(item)));
      if (!selected && this.isFull()) option.setAttribute('aria-disabled', 'true');
      this._entries.push({ item, element: option, create: false });
      nodes.push(option);
    }

    const query = this.refs.input.value.trim();
    if (this._canCreate(query)) {
      const option = h('div', {
        class: 'zx-tag-picker__option',
        id: uid('zx-tag-picker-option'),
        role: 'option',
        ariaSelected: 'false',
        dataset: { create: 'true' }
      },
      h('span', { class: 'zx-tag-picker__check', ariaHidden: 'true' }, icon('plus', { size: 13 })),
      h('span', { class: 'zx-tag-picker__option-label' },
        this._message('tagPicker.create', 'Create “%1”', [query])));
      this._entries.push({ item: null, element: option, create: true });
      nodes.push(option);
    }

    if (nodes.length === 0) {
      nodes.push(h('div', { class: 'zx-tag-picker__empty' },
        this._loading
          ? this._message('tagPicker.loading', 'Loading…')
          : this._message('tagPicker.empty', 'No matches')));
    }
    list.replaceChildren(...nodes);
    // Re-anchor the active option by identity: the DOM ids are new on every render, so keeping
    // the old numeric index would leave aria-activedescendant pointing at a removed node.
    const restored = this._entries.findIndex((entry) => this._entryId(entry) === this._activeId);
    this._setActive(restored >= 0 ? restored : (this._entries.length > 0 ? 0 : -1));
  }

  /**
   * Stable identity for an option entry across re-renders.
   * @param {{item: TagItem|null, create: boolean}} entry Entry.
   * @returns {string}
   */
  _entryId(entry) {
    return entry.create ? '\u0000create' : String(this._valueOf(entry.item));
  }

  /** @returns {void} */
  _syncPlaceholder() {
    const input = /** @type {HTMLInputElement} */ (this.refs.input);
    // The placeholder would collide with the tags, so it only shows on an empty control.
    input.placeholder = this._selected.length === 0 ? String(this.options.placeholder ?? '') : '';
  }

  /* -------------------------------------------------------------- interaction -- */

  /** @returns {void} */
  _onInput() {
    const query = this.refs.input.value;
    this._syncInputWidth();
    if (!this._open) this.open();
    if (typeof this.options.filter === 'function') this._scheduleAsyncQuery(query);
    else this._applyLocalFilter(query);
    this._renderOptions();
    this._setActive(this._entries.length > 0 ? 0 : -1);
    this._position?.update();
  }

  /** @param {KeyboardEvent} event @returns {void} */
  _onKeydown(event) {
    if (this._disabled || this._readonly) return;
    const input = /** @type {HTMLInputElement} */ (this.refs.input);

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (!this._open) this.open();
        else this._move(1);
        return;
      case 'ArrowUp':
        event.preventDefault();
        if (this._open) this._move(-1);
        return;
      case 'Home':
        if (this._open && input.value === '') {
          event.preventDefault();
          this._setActive(0);
        }
        return;
      case 'End':
        if (this._open && input.value === '') {
          event.preventDefault();
          this._setActive(this._entries.length - 1);
        }
        return;
      case 'Enter': {
        if (!this._open || this._activeIndex < 0) return;
        event.preventDefault();
        this._commitEntry(this._entries[this._activeIndex]);
        return;
      }
      case 'Escape':
        if (this._open) {
          event.preventDefault();
          this.close();
        }
        return;
      case 'Backspace':
        if (input.value === '' && this._selected.length > 0) {
          event.preventDefault();
          this.removeValue(this._valueOf(this._selected[this._selected.length - 1]));
        }
        return;
      case 'Tab':
        if (this._open) this.close();
        return;
      default:
    }
  }

  /** @param {MouseEvent} event @returns {void} */
  _onOptionClick(event) {
    const element = /** @type {Element} */ (event.target).closest('.zx-tag-picker__option');
    if (!element) return;
    const entry = this._entries.find((candidate) => candidate.element === element);
    if (entry) this._commitEntry(entry);
  }

  /**
   * Applies the active entry: toggles an item, or creates one from the query.
   * @param {{item: TagItem|null, element: HTMLElement, create: boolean}|undefined} entry Entry.
   * @returns {void}
   */
  _commitEntry(entry) {
    if (!entry) return;
    const input = /** @type {HTMLInputElement} */ (this.refs.input);
    if (entry.create) {
      const label = input.value.trim();
      const item = this._createItem(label);
      this._items = this._items.concat([item]);
      this.addValue(item);
      this.emit('create', { value: this._valueOf(item), item });
    } else {
      const value = this._valueOf(entry.item);
      if (this._isSelected(value)) this.removeValue(value);
      else if (!this.isFull()) this.addValue(entry.item);
      else return;
    }
    input.value = '';
    this._syncInputWidth();
    this._applyLocalFilter('');
    this._renderOptions();
    if (this.options.closeOnSelect) this.close();
    else {
      this._setActive(this._entries.length > 0 ? 0 : -1);
      this._position?.update();
    }
    this.focus();
  }

  /**
   * Moves the active option. The APG combobox map stops at the ends rather than wrapping.
   * @param {number} delta Signed step.
   * @returns {void}
   */
  _move(delta) {
    if (this._entries.length === 0) return;
    const next = this._activeIndex < 0
      ? (delta > 0 ? 0 : this._entries.length - 1)
      : Math.min(this._entries.length - 1, Math.max(0, this._activeIndex + delta));
    this._setActive(next);
  }

  /** @param {number} index @returns {void} */
  _setActive(index) {
    this._activeIndex = index;
    this._activeId = this._entries[index] ? this._entryId(this._entries[index]) : null;
    for (const [position_, entry] of this._entries.entries()) {
      const active = position_ === index;
      entry.element.toggleAttribute('data-active', active);
      if (active) {
        this.refs.input.setAttribute('aria-activedescendant', entry.element.id);
        entry.element.scrollIntoView({ block: 'nearest' });
      }
    }
    if (index < 0) this.refs.input.removeAttribute('aria-activedescendant');
  }

  /* ------------------------------------------------------------------ filtering -- */

  /** @param {string} query @returns {void} */
  _applyLocalFilter(query) {
    if (typeof this.options.filter === 'function') return;
    const keys = this.options.searchKeys ?? [this.options.labelKey];
    this._visible = matchItems(this._items, query, keys);
  }

  /** @param {string} query @returns {void} */
  _scheduleAsyncQuery(query) {
    this._cancelQuery();
    const text = String(query ?? '');
    if (text.length < Number(this.options.minQuery ?? 0)) {
      this._visible = [];
      this._renderOptions();
      return;
    }
    // Results for the previous query must not stay clickable while a new one is pending.
    this._visible = [];
    this._setLoading(true);
    this._renderOptions();
    const delay = Math.max(0, Number(this.options.debounce) || 0);
    this._queryTimer = setTimeout(() => {
      this._queryTimer = null;
      void this._runQuery(text);
    }, delay);
  }

  /** @param {string} query @returns {Promise<void>} */
  async _runQuery(query) {
    const sequence = this._requestSequence + 1;
    this._requestSequence = sequence;
    this._setLoading(true);
    this.emit('query', { query });
    try {
      const result = await /** @type {Function} */ (this.options.filter)(query);
      if (sequence !== this._requestSequence) return;
      this._items = Array.isArray(result) ? result.slice() : [];
      this._visible = this._items.slice();
    } catch (error) {
      if (sequence !== this._requestSequence) return;
      this._visible = [];
      this.emit('error', { error });
    } finally {
      if (sequence === this._requestSequence) {
        this._setLoading(false);
        this._renderOptions();
        this._setActive(this._entries.length > 0 ? 0 : -1);
        this._position?.update();
      }
    }
  }

  /** @returns {void} */
  _cancelQuery() {
    if (this._queryTimer !== null) {
      clearTimeout(this._queryTimer);
      this._queryTimer = null;
    }
    this._requestSequence += 1;
    this._setLoading(false);
  }

  /** @param {boolean} loading @returns {void} */
  _setLoading(loading) {
    this._loading = loading;
    this.el.toggleAttribute('data-loading', loading);
  }

  /**
   * Reports whether an item is already selected.
   * @param {unknown} value Item ID.
   * @returns {boolean}
   */
  _isSelected(value) {
    return this._selected.some((item) => Object.is(this._valueOf(item), value));
  }

  /* --------------------------------------------------------------------- items -- */

  /** @param {string} query @returns {boolean} */
  _canCreate(query) {
    if (!this.options.allowCreate || query === '' || this.isFull()) return false;
    const exists = (list) => list.some((item) => normalizeLabel(this._labelOf(item)) === normalizeLabel(query));
    return !exists(this._items) && !exists(this._selected);
  }

  /**
   * Builds a stand-in item for a value that is not in the catalogue.
   * @param {string} label Visible label.
   * @param {unknown} [value=label] ID to keep, so the original type survives.
   * @returns {TagItem}
   */
  _createItem(label, value = label) {
    if (typeof this.options.valueKey !== 'string' || typeof this.options.labelKey !== 'string') {
      return label;
    }
    return { [this.options.valueKey]: value, [this.options.labelKey]: label, created: true };
  }

  /**
   * Resolves an ID or an item to a catalogue item, falling back to a bare value.
   * @param {unknown} value ID or item.
   * @returns {TagItem|null}
   */
  _resolve(value) {
    if (value === null || value === undefined) return null;
    const id = this._valueOf(value);
    // `find` results are compared against undefined, not truthiness: an item whose ID is 0 or ''
    // is a real item.
    const known = this._items.find((item) => Object.is(this._valueOf(item), id));
    if (known !== undefined) return known;
    const selected = this._selected.find((item) => Object.is(this._valueOf(item), id));
    if (selected !== undefined) return selected;
    if (typeof value === 'object') return /** @type {TagItem} */ (value);
    // Unknown IDs still become tags so a stored selection survives a catalogue that has not
    // loaded yet — keeping the original ID, so a later numeric 7 matches the placeholder 7.
    return this._createItem(String(value), value);
  }

  /** @param {TagItem} a @param {TagItem} b @returns {boolean} */
  _sameValue(a, b) {
    return Object.is(this._valueOf(a), this._valueOf(b));
  }

  /** @param {unknown} item @returns {unknown} */
  _valueOf(item) {
    const key = this.options.valueKey;
    if (typeof key === 'function') return key(/** @type {TagItem} */ (item));
    if (item !== null && typeof item === 'object') return item[key];
    return item;
  }

  /** @param {unknown} item @returns {string} */
  _labelOf(item) {
    const key = this.options.labelKey;
    if (typeof key === 'function') return String(key(/** @type {TagItem} */ (item)));
    if (item !== null && typeof item === 'object') return String(item[key] ?? '');
    return String(item ?? '');
  }

  /** @returns {void} */
  _emitChange() {
    this.emit('change', { values: this.getValues(), items: this.getItems() });
  }

  /** Grows the input to fit its text so the caret stays visible next to the tags. @returns {void} */
  _syncInputWidth() {
    const input = /** @type {HTMLInputElement} */ (this.refs.input);
    const length = input.value.length;
    input.style.inlineSize = length === 0 ? '' : `${Math.min(40, length + 1)}ch`;
  }

  /** @returns {void} */
  _syncDisabled() {
    const input = /** @type {HTMLInputElement} */ (this.refs.input);
    input.disabled = this._disabled;
    input.readOnly = this._readonly;
    this.refs.toggle.disabled = this._disabled || this._readonly;
    this.el.toggleAttribute('data-disabled', this._disabled);
    this.el.toggleAttribute('data-readonly', this._readonly);
    if (this._disabled) this.el.setAttribute('aria-disabled', 'true');
    else this.el.removeAttribute('aria-disabled');
  }

  /**
   * @param {string} key Message key.
   * @param {string} fallback Template used when the host has no translation.
   * @param {unknown[]} [args=[]] Positional interpolation values.
   * @returns {string}
   */
  _message(key, fallback, args = []) {
    const message = this.msg(key, ...args);
    if (message !== key) return message;
    return args.reduce((text, value, index) => text.replaceAll(`%${index + 1}`, String(value)), fallback);
  }
}

/** Selection change. @event TagPicker#change @type {CustomEvent<{values: unknown[], items: TagItem[]}>} */
/** One value added. @event TagPicker#add @type {CustomEvent<{value: unknown, item: TagItem}>} */
/** One value removed. @event TagPicker#remove @type {CustomEvent<{value: unknown, item: TagItem}>} */
/** A value created from the query. @event TagPicker#create @type {CustomEvent<{value: unknown, item: TagItem}>} */
/** Async query started. @event TagPicker#query @type {CustomEvent<{query: string}>} */
/** Option list opened. @event TagPicker#open @type {CustomEvent<Record<string, never>>} */
/** Option list closed. @event TagPicker#close @type {CustomEvent<Record<string, never>>} */
/** An async filter rejected. @event TagPicker#error @type {CustomEvent<{error: Error}>} */

/** @param {string} value @returns {string} */
function normalizeLabel(value) {
  return String(value ?? '').trim().toLocaleLowerCase();
}

/**
 * @template T
 * @param {T[]} a
 * @param {T[]} b
 * @param {(item: T) => unknown} read
 * @returns {boolean}
 */
function sameSelection(a, b, read) {
  if (a.length !== b.length) return false;
  return a.every((item, index) => Object.is(read(item), read(b[index])));
}
