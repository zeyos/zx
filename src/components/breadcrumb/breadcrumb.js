import { Component } from '../../core/component.js';
import { h, restoreTarget, snapshotTarget } from '../../core/dom.js';
import { printf } from '../../core/i18n.js';
import { icon } from '../../core/icons.js';
import { MenuButton } from '../menu-button/menu-button.js';

/** @typedef {'chevron'|'slash'} BreadcrumbSeparator */

/**
 * @typedef {Object} BreadcrumbItem
 * @property {string} name Stable item name, unique within the trail.
 * @property {string} label Visible label.
 * @property {string} [icon] Icon name passed to `icon()`, rendered before the label.
 * @property {string} [href] Link destination; items without one render as buttons.
 */

/**
 * @typedef {Object} NormalizedBreadcrumbItem
 * @property {string} name Stable item name.
 * @property {string} label Visible label.
 * @property {string|null} icon Icon name, or null.
 * @property {string|null} href Link destination, or null.
 */

/**
 * @typedef {Object} BreadcrumbOptions
 * @property {BreadcrumbItem[]} [items=[]] Trail from the root to the current page.
 * @property {number} [maxVisible=0] Number of items rendered inline; 0 renders all of them.
 *   Anything in between collapses into an ellipsis menu, always keeping the first and last item.
 *   Values below 2 behave as 2.
 * @property {BreadcrumbSeparator} [separator='chevron'] Glyph drawn between items.
 * @property {string|null} [rootIcon=null] Icon for the first item when it carries none itself.
 * @property {Record<string, string>|Record<string, Record<string, string>>} [msg] Localized messages.
 * @property {(event: CustomEvent<BreadcrumbSelectDetail>) => void} [onselect] Selection listener.
 */

/**
 * @typedef {Object} BreadcrumbSelectDetail
 * @property {string} name Selected item name.
 * @property {NormalizedBreadcrumbItem} item Copy of the selected item.
 * @property {number} index Zero-based index in the full trail, collapsed items included.
 */

/** Separator glyphs. */
const SEPARATORS = new Set(['chevron', 'slash']);

/**
 * The trail of ancestors above the current page. Pairs with {@link Finder} and {@link TreeView}:
 * feed `setItems()` from a `change` event's `nodes`, and turn a `select` back into a path.
 *
 * The last item is the page you are on, so it is plain text marked `aria-current="page"` and never
 * interactive. Every other item is a real `<a>` when it carries an `href` — its navigation is left
 * alone — and a `<button>` otherwise, for trails an application resolves in JavaScript.
 * @fires Breadcrumb#select
 * @extends {Component<BreadcrumbOptions>}
 */
export class Breadcrumb extends Component {
  static cssName = 'breadcrumb';

  /** @type {Readonly<BreadcrumbOptions>} */
  static defaults = {
    items: [],
    maxVisible: 0,
    separator: 'chevron',
    rootIcon: null
  };

  /**
   * Creates or enhances a breadcrumb trail.
   * @param {Element|string|null} target Existing container, selector, or null.
   * @param {BreadcrumbOptions} [options={}] Breadcrumb options.
   */
  constructor(target, options = {}) {
    super(target, options);
  }

  /**
   * Builds the trail. Runs inside the base constructor, so instance state is initialized here.
   * @returns {HTMLElement}
   */
  render() {
    this._createdRoot = this.el === null;
    this._snapshot = this._createdRoot ? null : snapshotTarget(this.el);
    this._destroyed = false;
    /** @type {NormalizedBreadcrumbItem[]} */
    this._items = [];
    /** @type {MenuButton|null} */
    this._overflow = null;

    if (!SEPARATORS.has(this.options.separator)) {
      throw new RangeError(`Unknown breadcrumb separator: ${this.options.separator}`);
    }

    const root = /** @type {HTMLElement} */ (this.el ?? h('nav'));
    this.el = root;
    if (root.tagName !== 'NAV') root.setAttribute('role', 'navigation');
    root.setAttribute('aria-label', this._message('breadcrumb.label', 'Breadcrumb'));

    const list = h('ol', { class: 'zx-breadcrumb__list', ref: 'list' });
    root.replaceChildren(list);
    this.setItems(this.options.items);

    this.listen(list, 'click', (event) => {
      const control = /** @type {Element} */ (event.target).closest?.('[data-crumb]');
      if (!control || !list.contains(control)) return;
      // A crumb with an href is an ordinary link: report the selection and let the browser follow.
      this._select(/** @type {HTMLElement} */ (control).dataset.crumb);
    });
    return root;
  }

  /**
   * Replaces the whole trail.
   * @param {BreadcrumbItem[]} list Items from the root to the current page.
   * @returns {this}
   * @throws {TypeError} When the list or an item is malformed.
   * @throws {RangeError} When two items share a name.
   */
  setItems(list) {
    if (!Array.isArray(list)) throw new TypeError('Breadcrumb items must be an array');
    const names = new Set();
    this._items = list.map((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        throw new TypeError('Breadcrumb item must be an object');
      }
      if (typeof item.name !== 'string' || item.name === '') {
        throw new TypeError('Breadcrumb item name must be a non-empty string');
      }
      if (names.has(item.name)) throw new RangeError(`Breadcrumb item already exists: ${item.name}`);
      names.add(item.name);
      return {
        name: item.name,
        label: String(item.label ?? ''),
        icon: item.icon ? String(item.icon) : null,
        href: item.href == null ? null : String(item.href)
      };
    });
    this._build();
    return this;
  }

  /**
   * Returns a copy of the trail.
   * @returns {NormalizedBreadcrumbItem[]}
   */
  getItems() {
    return this._items.map((item) => ({ ...item }));
  }

  /**
   * Appends one level, which becomes the current page.
   * @param {BreadcrumbItem} item Item to append.
   * @returns {this}
   */
  push(item) {
    return this.setItems([...this._items, item]);
  }

  /**
   * Removes the deepest level.
   * @returns {NormalizedBreadcrumbItem|null} The removed item, or null when the trail was empty.
   */
  pop() {
    if (this._items.length === 0) return null;
    const removed = this._items[this._items.length - 1];
    this.setItems(this._items.slice(0, -1));
    return removed;
  }

  /**
   * Drops every level below a named item, making it the current page.
   * @param {string} name Item name.
   * @returns {this}
   * @throws {RangeError} When no item carries that name.
   */
  truncateTo(name) {
    const index = this._items.findIndex((item) => item.name === name);
    if (index < 0) throw new RangeError(`Unknown breadcrumb item: ${name}`);
    return this.setItems(this._items.slice(0, index + 1));
  }

  /**
   * Destroys the overflow menu, aborts listeners, and restores an enhanced target.
   * @returns {void}
   */
  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    this._overflow?.destroy();
    this._overflow = null;
    const root = this.el;
    super.destroy();
    if (!this._createdRoot && root) restoreTarget(root, this._snapshot);
  }

  /* ------------------------------------------------------------------ internals -- */

  /**
   * Rebuilds the list from the current items.
   * @returns {void}
   */
  _build() {
    const { head, hidden, tail } = this._split();
    const last = this._items[this._items.length - 1] ?? null;
    /** @type {HTMLElement[]} */
    const entries = [];

    for (const item of head) entries.push(this._renderItem(item, item === last));
    if (hidden.length > 0) entries.push(this._renderOverflow(hidden));
    for (const item of tail) entries.push(this._renderItem(item, item === last));

    this.refs.list.replaceChildren(...entries.map((content, index) => h('li', {
      class: 'zx-breadcrumb__item'
    }, index === 0 ? content : [this._renderSeparator(), content])));
    if (hidden.length === 0) this._overflow?.toElement().remove();
  }

  /**
   * Splits the trail into the inline head, the collapsed middle, and the inline tail.
   * @returns {{head: NormalizedBreadcrumbItem[], hidden: NormalizedBreadcrumbItem[], tail: NormalizedBreadcrumbItem[]}}
   */
  _split() {
    const items = this._items;
    const max = Math.trunc(Number(this.options.maxVisible) || 0);
    if (max <= 0 || items.length <= max) return { head: items, hidden: [], tail: [] };
    // Collapsing needs at least the first and the last item to survive.
    const visible = Math.max(2, max);
    if (items.length <= visible) return { head: items, hidden: [], tail: [] };
    const tailCount = visible - 1;
    return {
      head: items.slice(0, 1),
      hidden: items.slice(1, items.length - tailCount),
      tail: items.slice(items.length - tailCount)
    };
  }

  /**
   * @param {NormalizedBreadcrumbItem} item Item to render.
   * @param {boolean} current Whether this is the page the user is on.
   * @returns {HTMLElement}
   */
  _renderItem(item, current) {
    const children = [];
    const glyph = item.icon ?? (item === this._items[0] ? this.options.rootIcon : null);
    if (glyph) {
      children.push(h('span', { class: 'zx-breadcrumb__icon', ariaHidden: 'true' },
        icon(String(glyph), { size: 13 })));
    }
    children.push(h('span', { class: 'zx-breadcrumb__label' }, item.label));

    if (current) {
      return h('span', { class: 'zx-breadcrumb__current', ariaCurrent: 'page' }, children);
    }
    if (item.href !== null) {
      return h('a', {
        class: 'zx-breadcrumb__link',
        href: item.href,
        dataset: { crumb: item.name }
      }, children);
    }
    return h('button', {
      class: 'zx-breadcrumb__link',
      type: 'button',
      dataset: { crumb: item.name }
    }, children);
  }

  /**
   * Renders (and, on first use, creates) the ellipsis menu holding the collapsed levels. The
   * MenuButton is kept for the component's lifetime because its dropdown panel lives on
   * `document.body`; rebuilding the trail only refills its items.
   * @param {NormalizedBreadcrumbItem[]} hidden Collapsed items.
   * @returns {HTMLElement}
   */
  _renderOverflow(hidden) {
    if (!this._overflow) {
      this._overflow = new MenuButton(null, {
        label: '',
        icon: 'dots',
        kind: 'ghost',
        placement: 'bottom-start'
      });
      const trigger = this._overflow.toElement();
      trigger.classList.add('zx-breadcrumb__more');
      trigger.setAttribute('aria-label', this._message('breadcrumb.more', 'Show hidden levels'));
      this._overflow.on('select', (event) => this._select(String(event.detail.value)));
    }
    this._overflow.setItems(hidden.map((item) => ({
      label: item.label,
      value: item.name,
      icon: item.icon ?? undefined
    })));
    return /** @type {HTMLElement} */ (this._overflow.toElement());
  }

  /** @returns {HTMLElement} */
  _renderSeparator() {
    return h('span', { class: 'zx-breadcrumb__separator', ariaHidden: 'true' },
      this.options.separator === 'slash' ? '/' : icon('chevron-right', { size: 11 }));
  }

  /**
   * @param {string|undefined} name Item name from a control's `data-crumb`.
   * @returns {void}
   * @fires Breadcrumb#select
   */
  _select(name) {
    const index = this._items.findIndex((item) => item.name === name);
    if (index < 0) return;
    this.emit('select', { name: this._items[index].name, item: { ...this._items[index] }, index });
  }

  /**
   * Resolves a message through the host translator, falling back to the built-in English text.
   * @param {string} key Message key.
   * @param {string} fallback Built-in text, with `%1`-style placeholders.
   * @param {...unknown} args Interpolation values.
   * @returns {string}
   */
  _message(key, fallback, ...args) {
    const message = this.msg(key, ...args);
    return message === key ? printf(fallback, args) : message;
  }
}

/**
 * Fired when an interactive crumb is chosen, from the trail itself or from the overflow menu. A
 * crumb with an `href` still navigates: the event reports the choice, it does not gate it.
 * @event Breadcrumb#select
 * @type {CustomEvent<BreadcrumbSelectDetail>}
 */
