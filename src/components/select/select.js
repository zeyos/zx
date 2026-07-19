import { Component } from '../../core/component.js';
import { h } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { typeahead } from '../../core/keyboard.js';
import { position } from '../../core/position.js';
import { uid } from '../../core/util.js';
import { matchItems } from './filter.js';

/** @typedef {string|number|boolean|symbol|bigint|null|undefined} Primitive */
/** @typedef {Record<string, any>|Primitive} SelectItem */
/** @typedef {string|((item: SelectItem) => unknown)} SelectValueReader */
/** @typedef {string|((item: SelectItem) => string)} SelectLabelReader */
/**
 * @typedef {Object} SelectOptions
 * @property {SelectItem[]} [items=[]] Available values.
 * @property {SelectValueReader} [valueKey='ID'] Item ID property or reader.
 * @property {SelectLabelReader} [labelKey='name'] Item label property or reader.
 * @property {((item: SelectItem) => Node|string)|null} [renderItem=null] Option renderer.
 * @property {((item: SelectItem) => string)|null} [renderValue=null] Selected-value renderer.
 * @property {unknown} [value=null] Initially selected ID or item.
 * @property {boolean} [disabled=false] Whether interaction is disabled.
 * @property {string} [placeholder=''] Empty control text.
 * @property {boolean} [clearable=false] Whether selection may be cleared.
 * @property {false|'local'|((query: string) => Promise<SelectItem[]>|SelectItem[])} [filter=false] Filtering mode.
 * @property {Array<SelectValueReader>|null} [searchKeys=null] Fields searched by local filtering.
 * @property {number} [minQuery=0] Minimum async query length.
 * @property {number} [debounce=200] Async query delay in milliseconds.
 * @property {number} [listHeight=280] Maximum list height in pixels.
 * @property {SelectValueReader|null} [groupKey=null] Optional group reader.
 * @property {Record<string, string>|Record<string, Record<string, string>>} [msg] Localized messages.
 * @property {(event: CustomEvent<SelectChangeDetail>) => void} [onchange] Change listener.
 * @property {(event: CustomEvent<Record<string, never>>) => void} [onopen] Open listener.
 * @property {(event: CustomEvent<Record<string, never>>) => void} [onclose] Close listener.
 * @property {(event: CustomEvent<SelectQueryDetail>) => void} [onquery] Async-query listener.
 * @property {(event: CustomEvent<SelectLoadedDetail>) => void} [onloaded] Async-loaded listener.
 */
/** @typedef {{value: unknown, item: SelectItem|null}} SelectChangeDetail */
/** @typedef {{query: string}} SelectQueryDetail */
/** @typedef {{items: SelectItem[]}} SelectLoadedDetail */
/** @typedef {{item: SelectItem|null, clear: boolean, element: HTMLElement}} SelectOptionEntry */
/** @typedef {{silent?: boolean}} SelectSetOptions */

const PRIORITY_KEYS = [
  'priority.lowest',
  'priority.low',
  'priority.normal',
  'priority.high',
  'priority.highest'
];
const PRIORITY_FALLBACKS = ['Lowest', 'Low', 'Normal', 'High', 'Highest'];

/**
 * APG editable combobox with optional local or asynchronous filtering.
 *
 * @fires Select#change
 * @fires Select#open
 * @fires Select#close
 * @fires Select#query
 * @fires Select#loaded
 */
export class Select extends Component {
  static cssName = 'select';

  /** @type {SelectOptions} */
  static defaults = {
    items: [],
    valueKey: 'ID',
    labelKey: 'name',
    renderItem: null,
    renderValue: null,
    value: null,
    disabled: false,
    placeholder: '',
    clearable: false,
    filter: false,
    searchKeys: null,
    minQuery: 0,
    debounce: 200,
    listHeight: 280,
    groupKey: null
  };


  /** @returns {HTMLElement} */
  render() {
    // Instance state initialized here because render() runs inside the base
    // constructor, before class-field initializers would run (and clobber it).
    this._items = []; this._visibleItems = []; this._selected = null; this._optionEntries = []; this._activeIndex = -1; this._open = false; this._disabled = false; this._loading = false; this._requestSequence = 0; this._queryTimer = null; this._position = null; this._createdRoot = false; this._root = null; this._originalChildren = []; this._originalAttributes = new Map();
    this._createdRoot = this.el === null;
    const root = /** @type {HTMLElement} */ (this.el ?? h('div'));
    this.el = root;
    this._root = root;
    if (!this._createdRoot) this._originalChildren = Array.from(root.childNodes);
    this._rememberAttribute(root, 'data-state');
    this._rememberAttribute(root, 'data-loading');
    this._rememberAttribute(root, 'aria-disabled');

    const listId = uid('zx-select-list');
    const input = h('input', {
      ref: 'input',
      class: 'zx-select__input',
      type: 'text',
      role: 'combobox',
      autocomplete: 'off',
      spellcheck: false,
      ariaExpanded: 'false',
      ariaControls: listId,
      ariaAutocomplete: this.options.filter ? 'list' : 'none',
      placeholder: String(this.options.placeholder ?? ''),
      readOnly: !this.options.filter
    });
    const clear = h('button', {
      ref: 'clear',
      class: 'zx-select__clear',
      type: 'button',
      tabIndex: -1,
      ariaLabel: this._message('select.clear', 'Clear selection'),
      hidden: true
    }, icon('x', { size: 14 }));
    const loading = h('span', {
      ref: 'loading',
      class: 'zx-select__loading',
      role: 'status',
      ariaLabel: this._message('select.loading', 'Loading'),
      hidden: true
    });
    const toggle = h('button', {
      ref: 'toggle',
      class: 'zx-select__toggle',
      type: 'button',
      tabIndex: -1,
      ariaLabel: this._message('select.toggle', 'Toggle options')
    }, icon('chevron-down', { size: 16 }));
    const control = h('div', { ref: 'control', class: 'zx-select__control' },
      input, clear, loading, toggle
    );
    const list = h('div', {
      ref: 'list',
      class: 'zx-select__list',
      id: listId,
      role: 'listbox'
    });
    list.style.maxBlockSize = `${Math.max(0, Number(this.options.listHeight) || 0)}px`;
    const panel = h('div', {
      ref: 'panel',
      class: 'zx-select__panel',
      popover: 'manual'
    }, list);
    root.replaceChildren(control, panel);

    this._items = Array.isArray(this.options.items) ? this.options.items.slice() : [];
    this._visibleItems = this._items.slice();
    this._disabled = Boolean(this.options.disabled);
    this._handleTypeahead = typeahead(
      () => this._optionEntries.filter((entry) => !entry.clear).map((entry) => entry.element),
      (_option, index) => {
        if (!this._open) this.open();
        this._setActive(this._itemEntryIndex(index));
      }
    );

    this.listen(input, 'click', () => this.open());
    this.listen(input, 'input', () => this._onInput());
    this.listen(input, 'keydown', (event) => this._onKeydown(/** @type {KeyboardEvent} */ (event)));
    this.listen(toggle, 'click', () => {
      this.focus();
      if (this._open) this.close();
      else this.open();
    });
    this.listen(clear, 'click', () => {
      this.set(null);
      this.focus();
    });
    this.listen(panel, 'pointerdown', (event) => event.preventDefault());
    this.listen(panel, 'click', (event) => this._onOptionClick(event));
    this.listen(document, 'pointerdown', (event) => {
      if (this._open && !root.contains(/** @type {Node} */ (event.target))) this.close();
    }, { capture: true });

    this._renderOptions();
    this.set(this.options.value, { silent: true });
    this._syncDisabled();
    return root;
  }

  /** Selected item ID, or null. */
  get value() {
    return this._selected === null ? null : this._itemValue(this._selected);
  }

  /** @param {unknown} id Selected item ID. */
  set value(id) {
    this.set(id);
  }

  /** Selected item, or null. @returns {SelectItem|null} */
  get selected() {
    return this._selected;
  }

  /**
   * Selects an item or item ID.
   * @param {unknown} idOrItem Item ID, item, or null.
   * @param {SelectSetOptions} [options={}] Update behavior.
   * @returns {this}
   * @fires Select#change
   */
  set(idOrItem, { silent = false } = {}) {
    const previousValue = this.value;
    const item = idOrItem == null ? null : this._findItem(idOrItem);
    this._selected = item;
    this._syncInputValue();
    this._renderOptions();
    const nextValue = this.value;
    if (!silent && !Object.is(previousValue, nextValue)) {
      this.emit('change', { value: nextValue, item });
    }
    return this;
  }

  /**
   * Replaces the available items and preserves selection by ID when possible.
   * @param {SelectItem[]} items New items.
   * @returns {this}
   */
  setItems(items) {
    const selectedValue = this.value;
    this._items = Array.isArray(items) ? items.slice() : [];
    this._visibleItems = this._items.slice();
    this._selected = selectedValue == null ? null :
      this._items.find((item) => Object.is(this._itemValue(item), selectedValue)) ?? null;
    this._syncInputValue();
    this._renderOptions();
    this._position?.update();
    return this;
  }

  /**
   * Restores the configured initial value.
   * @param {{silent?: boolean}} [options={}] Reset behavior.
   * @returns {this}
   */
  reset({ silent = false } = {}) {
    this.set(this.options.value, { silent });
    return this;
  }

  /** Opens the option panel. @returns {this} @fires Select#open */
  open() {
    if (this._disabled || this._open) return this;
    this._open = true;
    this.el.setAttribute('data-state', 'open');
    this.refs.input.setAttribute('aria-expanded', 'true');
    this._renderOptions();
    this._position = position(this.refs.control, /** @type {HTMLElement} */ (this.refs.panel), {
      placement: 'bottom-start',
      flip: true,
      matchWidth: true
    });
    // Set the active option only after position() shows the popover — scrollIntoView
    // is a no-op while the panel is still hidden.
    this._setActive(this._selectedEntryIndex());
    if (this._activeIndex < 0 && this._optionEntries.length > 0) this._setActive(0);
    if (this.options.filter && this._selected !== null) {
      /** @type {HTMLInputElement} */ (this.refs.input).select();
    }
    if (typeof this.options.filter === 'function') this._scheduleAsyncQuery('');
    this.emit('open', {});
    return this;
  }

  /** Closes the option panel and restores the selected label. @returns {this} @fires Select#close */
  close() {
    if (!this._open) return this;
    this._open = false;
    this._cancelQuery();
    this._setLoading(false);
    this._position?.destroy();
    this._position = null;
    this.el.setAttribute('data-state', 'closed');
    this.refs.input.setAttribute('aria-expanded', 'false');
    this.refs.input.removeAttribute('aria-activedescendant');
    this._activeIndex = -1;
    this._visibleItems = this._items.slice();
    this._syncInputValue();
    this.emit('close', {});
    return this;
  }

  /** Enables user interaction. @returns {this} */
  enable() {
    this._disabled = false;
    this._syncDisabled();
    return this;
  }

  /** Disables user interaction and closes the panel. @returns {this} */
  disable() {
    this.close();
    this._disabled = true;
    this._syncDisabled();
    return this;
  }

  /** Moves focus to the combobox input. @returns {this} */
  focus() {
    /** @type {HTMLInputElement} */ (this.refs.input).focus();
    return this;
  }

  /**
   * Creates the five-level priority preset.
   * @param {Element|string|null} target Component target.
   * @param {SelectOptions} [options={}] Select overrides other than fixed items and renderer.
   * @returns {Select}
   */
  static priority(target, options = {}) {
    const requestedValue = options.value ?? null;
    const select = new Select(target, {
      ...options,
      value: null,
      items: [],
      renderItem(item) {
        return h('span', { class: 'zx-select__priority' },
          h('span', {
            class: 'zx-select__priority-icon',
            dataset: { level: item.level },
            ariaHidden: 'true'
          }),
          h('span', {}, String(item.name))
        );
      }
    });
    select.setItems(PRIORITY_KEYS.map((key, level) => ({
      ID: level,
      name: select._message(key, PRIORITY_FALLBACKS[level]),
      level
    })));
    select.set(requestedValue, { silent: true });
    return select;
  }

  /** Cleans up the panel, pending async work, and enhanced target contents. @returns {void} */
  destroy() {
    this._cancelQuery();
    this._position?.destroy();
    this._position = null;
    const root = /** @type {HTMLElement} */ (this.el);
    if (!this._createdRoot && root) {
      root.replaceChildren(...this._originalChildren);
      for (const [name, value] of this._originalAttributes) {
        if (value === null) root.removeAttribute(name);
        else root.setAttribute(name, value);
      }
    }
    super.destroy();
  }

  /** @param {KeyboardEvent} event @returns {void} */
  _onKeydown(event) {
    if (this._disabled) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!this._open) this.open();
      else this._moveActive(1);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (!this._open) {
        this.open();
        this._setActive(this._optionEntries.length - 1);
      } else this._moveActive(-1);
      return;
    }
    if (event.key === 'Home' && this._open) {
      event.preventDefault();
      this._setActive(0);
      return;
    }
    if (event.key === 'End' && this._open) {
      event.preventDefault();
      this._setActive(this._optionEntries.length - 1);
      return;
    }
    if (event.key === 'Enter' && this._open) {
      event.preventDefault();
      this._chooseEntry(this._optionEntries[this._activeIndex]);
      return;
    }
    if (event.key === 'Escape' && this._open) {
      event.preventDefault();
      this.close();
      return;
    }
    if (event.key === 'Tab' && this._open) {
      this.close();
      return;
    }
    if (!this.options.filter && isPrintable(event)) this._handleTypeahead(event);
  }

  /** @returns {void} */
  _onInput() {
    if (!this.options.filter) return;
    const query = /** @type {HTMLInputElement} */ (this.refs.input).value;
    if (!this._open) this.open();
    if (this.options.filter === 'local') {
      const keys = this.options.searchKeys ?? [this.options.labelKey];
      this._visibleItems = matchItems(this._items, query, keys);
      this._renderOptions();
      this._setActive(this._optionEntries.length > 0 ? 0 : -1);
      this._position?.update();
    } else if (typeof this.options.filter === 'function') {
      this._scheduleAsyncQuery(query);
    }
  }

  /** @param {Event} event @returns {void} */
  _onOptionClick(event) {
    const option = /** @type {Element|null} */ (event.target)?.closest?.('[role="option"]');
    if (!option || !this.refs.panel.contains(option)) return;
    this._chooseEntry(this._optionEntries[Number(option.getAttribute('data-index'))]);
  }

  /** @param {SelectOptionEntry|undefined} entry @returns {void} */
  _chooseEntry(entry) {
    if (!entry) return;
    this.set(entry.clear ? null : entry.item);
    this.close();
    this.focus();
  }

  /** @param {number} delta @returns {void} */
  _moveActive(delta) {
    const length = this._optionEntries.length;
    if (length === 0) return;
    this._setActive((this._activeIndex + delta + length) % length);
  }

  /** @param {number} index @returns {void} */
  _setActive(index) {
    this._activeIndex = index >= 0 && index < this._optionEntries.length ? index : -1;
    this._optionEntries.forEach((entry, entryIndex) => {
      if (entryIndex === this._activeIndex) entry.element.setAttribute('data-active', 'true');
      else entry.element.removeAttribute('data-active');
    });
    const active = this._optionEntries[this._activeIndex]?.element;
    if (active) {
      this.refs.input.setAttribute('aria-activedescendant', active.id);
      active.scrollIntoView?.({ block: 'nearest' });
    } else {
      this.refs.input.removeAttribute('aria-activedescendant');
    }
  }

  /** @returns {void} */
  _renderOptions() {
    const list = this.refs.list;
    if (!list) return;
    list.replaceChildren();
    this._optionEntries = [];
    let lastGroup = Symbol('initial-group');

    if (this.options.clearable) {
      this._appendOption(null, true, this.options.placeholder || this._message('select.none', 'No selection'));
    }
    for (const item of this._visibleItems) {
      if (this.options.groupKey) {
        const group = this._read(item, this.options.groupKey);
        if (!Object.is(group, lastGroup)) {
          list.append(h('div', {
            class: 'zx-select__group',
            role: 'presentation'
          }, String(group ?? '')));
          lastGroup = group;
        }
      }
      this._appendOption(item, false);
    }
    if (this._visibleItems.length === 0 && !this._loading) {
      list.append(h('div', {
        class: 'zx-select__empty',
        role: 'status'
      }, this._message('select.empty', 'No matches')));
    }
    this._setActive(-1);
  }

  /** @param {SelectItem|null} item @param {boolean} clear @param {string} [label] @returns {void} */
  _appendOption(item, clear, label) {
    const selected = clear ? this._selected === null :
      this._selected !== null && Object.is(this._itemValue(item), this.value);
    const index = this._optionEntries.length;
    const content = clear ? String(label ?? '') : this._renderItem(item);
    const option = h('div', {
      class: 'zx-select__option',
      id: uid('zx-select-option'),
      role: 'option',
      ariaSelected: String(selected),
      dataset: { index }
    }, h('span', { class: 'zx-select__option-content' }, content));
    if (selected) option.append(icon('check', { size: 15 }));
    this.refs.list.append(option);
    this._optionEntries.push({ item, clear, element: option });
  }

  /** @param {SelectItem|null} item @returns {Node|string} */
  _renderItem(item) {
    if (typeof this.options.renderItem === 'function') {
      const rendered = this.options.renderItem(item);
      return rendered && typeof rendered === 'object' && 'nodeType' in rendered ?
        /** @type {Node} */ (rendered) : String(rendered ?? '');
    }
    return this._itemLabel(item);
  }

  /** @param {string} query @returns {void} */
  _scheduleAsyncQuery(query) {
    if (this._queryTimer !== null) clearTimeout(this._queryTimer);
    this._requestSequence += 1;
    const sequence = this._requestSequence;
    if (query.length < Math.max(0, Number(this.options.minQuery) || 0)) {
      this._setLoading(false);
      this._visibleItems = [];
      this._renderOptions();
      return;
    }
    this._setLoading(true);
    this._renderOptions();
    this._position?.update();
    const delay = Math.max(0, Number(this.options.debounce) || 0);
    this._queryTimer = setTimeout(() => {
      this._queryTimer = null;
      this._runAsyncQuery(query, sequence);
    }, delay);
  }

  /** @param {string} query @param {number} sequence @returns {Promise<void>} */
  async _runAsyncQuery(query, sequence) {
    if (sequence !== this._requestSequence || typeof this.options.filter !== 'function') return;
    this.emit('query', { query });
    try {
      const result = await this.options.filter(query);
      if (sequence !== this._requestSequence || !this._open) return;
      this._items = Array.isArray(result) ? result.slice() : [];
      this._visibleItems = this._items.slice();
      this._setLoading(false);
      this._renderOptions();
      this._setActive(this._optionEntries.length > 0 ? 0 : -1);
      this._position?.update();
      this.emit('loaded', { items: this._items.slice() });
    } catch {
      if (sequence !== this._requestSequence || !this._open) return;
      this._items = [];
      this._visibleItems = [];
      this._setLoading(false);
      this._renderOptions();
      this._position?.update();
    }
  }

  /** @returns {void} */
  _cancelQuery() {
    if (this._queryTimer !== null) clearTimeout(this._queryTimer);
    this._queryTimer = null;
    this._requestSequence += 1;
  }

  /** @param {boolean} loading @returns {void} */
  _setLoading(loading) {
    this._loading = loading;
    this.refs.loading.hidden = !loading;
    this.refs.input.setAttribute('aria-busy', String(loading));
    this.refs.list.setAttribute('aria-busy', String(loading));
    if (loading) this._root?.setAttribute('data-loading', 'true');
    else this._root?.removeAttribute('data-loading');
  }

  /** @returns {void} */
  _syncInputValue() {
    if (!this.refs.input) return;
    const input = /** @type {HTMLInputElement} */ (this.refs.input);
    input.value = this._selected === null ? '' :
      (typeof this.options.renderValue === 'function' ?
        String(this.options.renderValue(this._selected) ?? '') : this._itemLabel(this._selected));
    this.refs.clear.hidden = !this.options.clearable || this._selected === null;
  }

  /** @returns {void} */
  _syncDisabled() {
    const input = /** @type {HTMLInputElement} */ (this.refs.input);
    const clear = /** @type {HTMLButtonElement} */ (this.refs.clear);
    const toggle = /** @type {HTMLButtonElement} */ (this.refs.toggle);
    input.disabled = this._disabled;
    clear.disabled = this._disabled;
    toggle.disabled = this._disabled;
    this._root?.setAttribute('aria-disabled', String(this._disabled));
  }

  /** @param {unknown} candidate @returns {SelectItem|null} */
  _findItem(candidate) {
    const direct = this._items.find((item) => item === candidate);
    if (direct !== undefined) return direct;
    const value = candidate !== null && typeof candidate === 'object' ?
      this._itemValue(/** @type {SelectItem} */ (candidate)) : candidate;
    return this._items.find((item) => Object.is(this._itemValue(item), value)) ?? null;
  }

  /** @param {SelectItem|null} item @returns {unknown} */
  _itemValue(item) {
    return this._read(item, this.options.valueKey);
  }

  /** @param {SelectItem|null} item @returns {string} */
  _itemLabel(item) {
    const value = this._read(item, this.options.labelKey);
    return String(value ?? '');
  }

  /** @param {SelectItem|null} item @param {SelectValueReader|SelectLabelReader} reader @returns {unknown} */
  _read(item, reader) {
    if (typeof reader === 'function') return reader(item);
    if (item === null || typeof item !== 'object') return item;
    return item[reader];
  }

  /** @returns {number} */
  _selectedEntryIndex() {
    if (this._selected === null) return this.options.clearable ? 0 : -1;
    return this._optionEntries.findIndex((entry) =>
      !entry.clear && Object.is(this._itemValue(entry.item), this.value)
    );
  }

  /** @param {number} itemIndex @returns {number} */
  _itemEntryIndex(itemIndex) {
    return itemIndex + (this.options.clearable ? 1 : 0);
  }

  /** @param {string} name @returns {void} */
  _rememberAttribute(element, name) {
    this._originalAttributes.set(name, element.getAttribute(name));
  }

  /** @param {string} key @param {string} fallback @returns {string} */
  _message(key, fallback) {
    const message = this.msg(key);
    return message === key ? fallback : message;
  }
}

/** Change emitted when the selected value changes. @event Select#change @type {CustomEvent<SelectChangeDetail>} */
/** Panel-open notification. @event Select#open @type {CustomEvent<Record<string, never>>} */
/** Panel-close notification. @event Select#close @type {CustomEvent<Record<string, never>>} */
/** Async-query start notification. @event Select#query @type {CustomEvent<SelectQueryDetail>} */
/** Async results notification. @event Select#loaded @type {CustomEvent<SelectLoadedDetail>} */

/** @param {KeyboardEvent} event @returns {boolean} */
function isPrintable(event) {
  return event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey;
}
