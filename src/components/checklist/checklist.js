import { Component } from '../../core/component.js';
import { h } from '../../core/dom.js';
import { uid } from '../../core/util.js';
import { matchItems } from '../select/filter.js';

/** @typedef {Record<string, any>|string|number|boolean|symbol|bigint|null|undefined} ChecklistItem */
/**
 * @typedef {Object} ChecklistOptions
 * @property {ChecklistItem[]} [items=[]] Available checkbox items.
 * @property {string|((item: ChecklistItem) => unknown)} [valueKey='ID'] Item ID property or reader.
 * @property {string|((item: ChecklistItem) => string)} [labelKey='name'] Item label property or reader.
 * @property {string|((item: ChecklistItem) => unknown)} [checkedKey='on'] Initial checked-state property or reader.
 * @property {boolean} [search=true] Whether the search field is shown.
 * @property {number} [height=280] Maximum list height in pixels.
 * @property {boolean} [defaultChecked=false] Fallback initial checked state.
 * @property {(() => Promise<ChecklistItem[]>|ChecklistItem[])|null} [load=null] Async item loader.
 * @property {Record<string, string>|Record<string, Record<string, string>>} [msg] Localized messages.
 * @property {(event: CustomEvent<ChecklistChangeDetail>) => void} [onchange] Change listener.
 * @property {(event: CustomEvent<ChecklistLoadedDetail>) => void} [onloaded] Loaded listener.
 */
/** @typedef {{values: unknown[]}} ChecklistChangeDetail */
/** @typedef {{items: ChecklistItem[]}} ChecklistLoadedDetail */

/**
 * Searchable native-checkbox group.
 *
 * @fires Checklist#change
 * @fires Checklist#loaded
 */
export class Checklist extends Component {
  static cssName = 'checklist';

  /** @type {ChecklistOptions} */
  static defaults = {
    items: [],
    valueKey: 'ID',
    labelKey: 'name',
    checkedKey: 'on',
    search: true,
    height: 280,
    defaultChecked: false,
    load: null
  };


  /** @returns {HTMLElement} */
  render() {
    // Instance state initialized here because render() runs inside the base
    // constructor, before class-field initializers would run (and clobber it).
    this._items = []; this._visibleItems = []; this._checked = new Set(); this._query = ''; this._loadSequence = 0; this._createdRoot = false; this._active = true; this._originalChildren = []; this._originalAttributes = new Map();
    this._createdRoot = this.el === null;
    const root = /** @type {HTMLElement} */ (this.el ?? h('div'));
    this.el = root;
    if (!this._createdRoot) this._originalChildren = Array.from(root.childNodes);
    for (const name of ['role', 'aria-labelledby', 'data-state']) {
      this._originalAttributes.set(name, root.getAttribute(name));
    }

    const labelId = uid('zx-checklist-label');
    const title = h('div', {
      class: 'zx-checklist__label',
      id: labelId
    }, this._message('checklist.label', 'Checklist'));
    const search = h('input', {
      ref: 'search',
      class: 'zx-checklist__search',
      type: 'search',
      autocomplete: 'off',
      placeholder: this._message('checklist.search', 'Search'),
      ariaLabel: this._message('checklist.search', 'Search checklist'),
      hidden: !this.options.search
    });
    const list = h('div', {
      ref: 'list',
      class: 'zx-checklist__list'
    });
    list.style.maxBlockSize = `${Math.max(0, Number(this.options.height) || 0)}px`;
    root.replaceChildren(title, search, list);
    root.setAttribute('role', 'group');
    root.setAttribute('aria-labelledby', labelId);

    this.listen(search, 'input', () => this.search(/** @type {HTMLInputElement} */ (search).value));
    this.listen(list, 'change', (event) => {
      const input = /** @type {HTMLInputElement|null} */ (event.target);
      if (!input?.matches?.('input[type="checkbox"][data-index]')) return;
      const item = this._visibleItems[Number(input.dataset.index)];
      if (item === undefined) return;
      const value = this._itemValue(item);
      if (input.checked) this._checked.add(value);
      else this._checked.delete(value);
      this.emit('change', { values: this.getValues() });
    });

    this._replaceItems(this.options.items);
    if (typeof this.options.load === 'function') {
      queueMicrotask(() => {
        if (this._active) void this.reload().catch(() => {});
      });
    }
    return root;
  }

  /**
   * Replaces items and derives checked state from `checkedKey` and `defaultChecked`.
   * @param {ChecklistItem[]} items New items.
   * @returns {this}
   */
  setItems(items) {
    this._replaceItems(items);
    return this;
  }

  /** Returns checked IDs in item order. @returns {unknown[]} */
  getValues() {
    return this._items
      .map((item) => this._itemValue(item))
      .filter((value) => this._checked.has(value));
  }

  /**
   * Replaces the checked IDs.
   * @param {Iterable<unknown>|unknown[]} ids Checked item IDs.
   * @returns {this}
   * @fires Checklist#change
   */
  setValues(ids) {
    const requested = new Set(ids == null ? [] : Array.from(ids));
    const next = new Set(this._items
      .map((item) => this._itemValue(item))
      .filter((value) => requested.has(value)));
    this._replaceChecked(next);
    return this;
  }

  /** Checks every item. @returns {this} @fires Checklist#change */
  checkAll() {
    this._replaceChecked(new Set(this._items.map((item) => this._itemValue(item))));
    return this;
  }

  /** Unchecks every item. @returns {this} @fires Checklist#change */
  uncheckAll() {
    this._replaceChecked(new Set());
    return this;
  }

  /**
   * Filters visible items by label.
   * @param {string} query Search text.
   * @returns {this}
   */
  search(query) {
    this._query = String(query ?? '');
    const input = /** @type {HTMLInputElement} */ (this.refs.search);
    if (input.value !== this._query) input.value = this._query;
    this._visibleItems = matchItems(this._items, this._query, [this.options.labelKey]);
    this._renderItems();
    return this;
  }

  /**
   * Reloads items through the configured async loader.
   * @returns {Promise<this>}
   * @fires Checklist#loaded
   */
  async reload() {
    if (!this._active || typeof this.options.load !== 'function') return this;
    const sequence = ++this._loadSequence;
    this.el.setAttribute('data-state', 'loading');
    this.refs.list.setAttribute('aria-busy', 'true');
    try {
      const items = await this.options.load();
      if (sequence !== this._loadSequence) return this;
      this._replaceItems(items);
      this.emit('loaded', { items: this._items.slice() });
    } finally {
      if (sequence === this._loadSequence) {
        this.el.removeAttribute('data-state');
        this.refs.list.setAttribute('aria-busy', 'false');
      }
    }
    return this;
  }

  /** Restores an enhanced target and invalidates pending loads. @returns {void} */
  destroy() {
    this._active = false;
    this._loadSequence += 1;
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

  /** @param {ChecklistItem[]} items @returns {void} */
  _replaceItems(items) {
    this._items = Array.isArray(items) ? items.slice() : [];
    this._checked = new Set(this._items
      .filter((item) => Boolean(this._initialChecked(item)))
      .map((item) => this._itemValue(item)));
    this._visibleItems = matchItems(this._items, this._query, [this.options.labelKey]);
    this._renderItems();
  }

  /** @returns {void} */
  _renderItems() {
    if (!this.refs.list) return;
    const rows = this._visibleItems.map((item, index) => {
      const checkboxId = uid('zx-checklist-item');
      const input = h('input', {
        type: 'checkbox',
        id: checkboxId,
        checked: this._checked.has(this._itemValue(item)),
        dataset: { index }
      });
      return h('label', {
        class: 'zx-checklist__item',
        for: checkboxId
      }, input, h('span', {}, this._itemLabel(item)));
    });
    if (rows.length === 0) {
      rows.push(h('div', {
        class: 'zx-checklist__empty',
        role: 'status'
      }, this._message('checklist.empty', 'No matches')));
    }
    this.refs.list.replaceChildren(...rows);
  }

  /** @param {Set<unknown>} next @returns {void} */
  _replaceChecked(next) {
    if (setsEqual(this._checked, next)) return;
    this._checked = next;
    this._renderItems();
    this.emit('change', { values: this.getValues() });
  }

  /** @param {ChecklistItem} item @returns {unknown} */
  _itemValue(item) {
    return this._read(item, this.options.valueKey);
  }

  /** @param {ChecklistItem} item @returns {string} */
  _itemLabel(item) {
    return String(this._read(item, this.options.labelKey) ?? '');
  }

  /** @param {ChecklistItem} item @returns {unknown} */
  _initialChecked(item) {
    let value;
    if (typeof this.options.checkedKey === 'function') value = this.options.checkedKey(item);
    else if (item !== null && typeof item === 'object') value = item[this.options.checkedKey];
    return value == null ? this.options.defaultChecked : value;
  }

  /** @param {ChecklistItem} item @param {string|((item: ChecklistItem) => unknown)} reader @returns {unknown} */
  _read(item, reader) {
    if (typeof reader === 'function') return reader(item);
    if (item === null || typeof item !== 'object') return item;
    return item[reader];
  }

  /** @param {string} key @param {string} fallback @returns {string} */
  _message(key, fallback) {
    const message = this.msg(key);
    return message === key ? fallback : message;
  }
}

/** Checked-value change. @event Checklist#change @type {CustomEvent<ChecklistChangeDetail>} */
/** Async-load completion. @event Checklist#loaded @type {CustomEvent<ChecklistLoadedDetail>} */

/** @param {Set<unknown>} left @param {Set<unknown>} right @returns {boolean} */
function setsEqual(left, right) {
  return left.size === right.size && Array.from(left).every((value) => right.has(value));
}
