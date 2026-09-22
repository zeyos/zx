import { Component } from '../../core/component.js';
import { h } from '../../core/dom.js';
import { isElement, uid } from '../../core/util.js';
import { button } from '../button/button.js';
import { MenuButton } from '../menu-button/menu-button.js';

/** @typedef {Node|Component|(() => Node|Component)} NavigationPanelContent */

/**
 * @typedef {Object} NavigationItem
 * @property {string} name Stable item name.
 * @property {string} title Visible item title.
 * @property {string|null} [badge=null] Optional badge text.
 * @property {NavigationPanelContent} [content] Optional panel content; its presence enables tab semantics.
 * @property {string} [href] Optional link destination for plain navigation.
 * @property {boolean} [disabled=false] Whether the item is unavailable.
 * @property {(name: string, item: NavigationItem, navigation: NavigationBar) => void} [onselect] Selection callback.
 */

/**
 * @typedef {Object} NavigationActionDescriptor
 * @property {string} [label=''] Visible button label.
 * @property {string|null} [icon=null] Icon name from the kernel icon set.
 * @property {'default'|'primary'|'danger'|'ghost'} [kind='default'] Visual intent.
 * @property {'md'|'sm'} [size='md'] Control size.
 * @property {boolean} [disabled=false] Whether the action is disabled.
 * @property {string} [title] Native title text.
 * @property {(event: MouseEvent) => void} [onclick] Click callback.
 */
/** @typedef {Element|NavigationActionDescriptor} NavigationAction */

/**
 * @typedef {Object} NavigationBarOptions
 * @property {string} [title=''] Brand or application title.
 * @property {NavigationItem[]} [items=[]] Navigation items.
 * @property {string|null} [active=null] Initially active item, or the first enabled item.
 * @property {NavigationAction[]} [actions=[]] Right-aligned action elements or descriptors.
 * @property {boolean} [overflow=true] Whether items collapse into the overflow menu at all.
 *   `false` keeps every item in the bar at every width and never shows the More button.
 * @property {string|number|false} [overflowBelow='44rem'] Container inline size at or below which
 *   items collapse, as a `px` or `rem` length (a number is read as `px`); `false` disables
 *   collapsing exactly as `overflow: false` does. The default is the threshold the stylesheet's
 *   own container query carries, and a bar that keeps it collapses in CSS without measuring
 *   itself; any other value is watched with a `ResizeObserver`.
 * @property {number} [minVisible=0] How many items, counted from the start, never collapse. The
 *   default collapses all of them, which is right for a top app bar and wrong for a phone bottom
 *   bar — `minVisible: 4` is what makes that bar usable.
 * @property {(event: CustomEvent<{name: string}>) => void} [onchange] Change callback.
 */

/**
 * The container width `navigation-bar.css` collapses at. A bar that keeps this exact threshold is
 * served by the stylesheet's container query, so it needs no measurement and no script at all;
 * anything else has to be watched. Keep it in step with the `@container` rule.
 */
export const OVERFLOW_BELOW = '44rem';

/** The lengths a threshold may be written in — the two a `ResizeObserver` can resolve alone. */
const OVERFLOW_LENGTH = /^\d+(?:\.\d+)?(?:px|rem)$/;

/**
 * @typedef {Object} NavigationRecord
 * @property {NavigationItem} definition Normalized item definition.
 * @property {HTMLElement} item Rendered link or button.
 * @property {HTMLElement} badge Badge element.
 * @property {HTMLElement|null} panel Optional tab panel.
 * @property {boolean} built Whether panel content has been mounted.
 */

/**
 * Responsive application navigation with MenuButton overflow.
 * @fires NavigationBar#change
 * @extends {Component<NavigationBarOptions>}
 */
export class NavigationBar extends Component {
  static cssName = 'navigation-bar';

  /** @type {Readonly<NavigationBarOptions>} */
  static defaults = {
    title: '',
    items: [],
    active: null,
    actions: [],
    overflow: true,
    overflowBelow: OVERFLOW_BELOW,
    minVisible: 0
  };

  /**
   * Creates or enhances an application navigation bar.
   * @param {Element|string|null} target Existing container, selector, or null.
   * @param {NavigationBarOptions} [options={}] Navigation options.
   */
  constructor(target, options = {}) {
    super(target, options);
    this._overflow = new MenuButton(this.refs.moreTrigger, {
      label: 'More',
      icon: 'dots',
      kind: 'ghost',
      items: [],
      placement: 'bottom-end'
    });
    this._overflow.on('select', (event) => {
      const record = this._find(String(event.detail.value));
      if (!record || record.definition.disabled) return;
      this.setActive(record.definition.name);
      record.definition.onselect?.(record.definition.name, record.definition, this);
      if (record.definition.href) globalThis.location?.assign(record.definition.href);
    });
    this._syncOverflow();
    this._observeWidth();
  }

  /** @returns {HTMLElement} */
  render() {
    const created = !this.el;
    const root = /** @type {HTMLElement} */ (this.el ?? h('section'));
    this.el = root;
    this._createdRoot = created;
    this._original = created ? null : snapshot(root);
    this._cleaned = false;
    /** @type {NavigationRecord[]} */
    this._items = [];
    this._activeName = null;
    this._tabMode = false;
    this._overflow = null;
    this._observer = null;
    this._frame = 0;

    const bar = h('header', { class: 'zx-navigation-bar__bar' },
      h('div', { class: 'zx-navigation-bar__brand', ref: 'title' }),
      h('nav', {
        class: 'zx-navigation-bar__navigation',
        ariaLabel: 'Primary navigation'
      },
      h('div', { class: 'zx-navigation-bar__items', ref: 'items' }),
      h('div', { class: 'zx-navigation-bar__more', ref: 'more' },
        h('button', { class: 'zx-navigation-bar__more-trigger', ref: 'moreTrigger' })
      )),
      h('div', {
        class: 'zx-navigation-bar__actions',
        ref: 'actions',
        role: 'group',
        ariaLabel: 'Application actions'
      })
    );
    const panels = h('div', {
      class: 'zx-navigation-bar__panels',
      ref: 'panels',
      hidden: true
    });
    root.replaceChildren(bar, panels);
    this.setTitle(this.options.title);
    this.setItems(this.options.items);
    this.setActions(this.options.actions);
    this.listen(this.refs.items, 'keydown', (event) => this._onTabKeydown(event));
    return root;
  }

  /**
   * Replaces the brand or application title.
   * @param {string} title Next title.
   * @returns {this}
   */
  setTitle(title) {
    this.refs.title.textContent = String(title ?? '');
    return this;
  }

  /**
   * Replaces navigation items.
   * @param {NavigationItem[]} list Item definitions.
   * @returns {this}
   */
  setItems(list) {
    if (!Array.isArray(list)) throw new TypeError('NavigationBar items must be an array');
    const previous = this._activeName;
    const names = new Set();
    const definitions = list.map((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        throw new TypeError('Navigation item must be an object');
      }
      if (typeof item.name !== 'string' || item.name === '') {
        throw new TypeError('Navigation item name must be a non-empty string');
      }
      if (names.has(item.name)) throw new RangeError(`Navigation item already exists: ${item.name}`);
      names.add(item.name);
      if (Object.hasOwn(item, 'content') && !isPanelContent(item.content)) {
        throw new TypeError(`Navigation panel content for ${item.name} is invalid`);
      }
      const definition = {
        name: item.name,
        title: String(item.title ?? ''),
        badge: item.badge == null ? null : String(item.badge),
        href: item.href == null ? undefined : String(item.href),
        disabled: Boolean(item.disabled),
        onselect: typeof item.onselect === 'function' ? item.onselect : undefined
      };
      if (Object.hasOwn(item, 'content')) definition.content = item.content;
      return definition;
    });

    const tabMode = definitions.some((item) => Object.hasOwn(item, 'content'));
    if (tabMode && definitions.some((item) => !Object.hasOwn(item, 'content'))) {
      throw new TypeError('NavigationBar panel items must all define content');
    }
    this._items = [];
    this._activeName = null;
    this._tabMode = tabMode;
    this.refs.items.replaceChildren();
    this.refs.panels.replaceChildren();
    this.refs.panels.hidden = !this._tabMode;
    if (this._tabMode) {
      this.refs.items.setAttribute('role', 'tablist');
      this.refs.items.setAttribute('aria-orientation', 'horizontal');
    } else {
      this.refs.items.removeAttribute('role');
      this.refs.items.removeAttribute('aria-orientation');
    }

    for (const definition of definitions) this._appendItem(definition);
    const requested = previous ?? this.options.active;
    const initial = requested === null ? null : this._find(requested);
    const active = initial && !initial.definition.disabled ? initial : this._enabledItems()[0];
    if (active) this._applyActive(active);
    this._syncOverflow();
    return this;
  }

  /**
   * Selects a navigation item.
   * @param {string} name Item name.
   * @returns {this}
   * @fires NavigationBar#change
   */
  setActive(name) {
    const record = this._find(name);
    if (!record || record.definition.disabled || name === this._activeName) return this;
    this._applyActive(record);
    this.emit('change', { name: record.definition.name });
    return this;
  }

  /**
   * Sets or clears an item badge.
   * @param {string} name Item name.
   * @param {string|null} text Badge text, or null to remove it.
   * @returns {this}
   */
  setBadge(name, text) {
    const record = this._require(name);
    record.definition.badge = text === null ? null : String(text);
    record.badge.textContent = record.definition.badge ?? '';
    record.badge.hidden = record.definition.badge === null;
    this._syncOverflow();
    return this;
  }

  /**
   * Replaces right-aligned application actions.
   * @param {NavigationAction[]} list Action elements or button descriptors.
   * @returns {this}
   */
  setActions(list) {
    if (!Array.isArray(list)) throw new TypeError('NavigationBar actions must be an array');
    const elements = list.map((item) => {
      if (isElement(item)) return item;
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        throw new TypeError('NavigationBar actions must be Elements or button descriptors');
      }
      const descriptor = { ...item };
      const onclick = descriptor.onclick;
      delete descriptor.onclick;
      const element = button(descriptor);
      if (typeof onclick === 'function') this.listen(element, 'click', onclick);
      return element;
    });
    this.refs.actions.replaceChildren(...elements);
    return this;
  }

  /** @returns {void} */
  destroy() {
    if (this._cleaned) return;
    this._cleaned = true;
    if (this._frame && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(this._frame);
    this._frame = 0;
    this._observer?.disconnect();
    this._observer = null;
    this._overflow?.destroy();
    super.destroy();
    if (!this._createdRoot && this._original) restore(this.el, this._original);
  }

  /** @param {NavigationItem} definition @returns {void} */
  _appendItem(definition) {
    const tabId = uid('zx-navigation-item');
    const panelId = uid('zx-navigation-panel');
    const badge = h('span', {
      class: 'zx-navigation-bar__badge',
      hidden: definition.badge === null
    }, definition.badge ?? '');
    const properties = {
      class: 'zx-navigation-bar__item',
      id: tabId,
      ariaDisabled: definition.disabled ? 'true' : null
    };
    let item;
    if (this._tabMode) {
      item = h('button', {
        ...properties,
        type: 'button',
        role: 'tab',
        tabindex: '-1',
        ariaControls: panelId,
        ariaSelected: 'false'
      }, h('span', { class: 'zx-navigation-bar__label' }, definition.title), badge);
    } else if (definition.href) {
      item = h('a', {
        ...properties,
        href: definition.href
      }, h('span', { class: 'zx-navigation-bar__label' }, definition.title), badge);
    } else {
      item = h('button', {
        ...properties,
        type: 'button'
      }, h('span', { class: 'zx-navigation-bar__label' }, definition.title), badge);
    }

    let panel = null;
    if (this._tabMode) {
      panel = h('div', {
        class: 'zx-navigation-bar__panel',
        id: panelId,
        role: 'tabpanel',
        tabindex: '0',
        ariaLabelledby: tabId,
        hidden: true
      });
      this.refs.panels.append(panel);
    }
    /** @type {NavigationRecord} */
    const record = { definition, item, badge, panel, built: false };
    this._items.push(record);
    this.refs.items.append(item);
    this.listen(item, 'click', (event) => {
      if (record.definition.disabled) {
        event.preventDefault();
        return;
      }
      this.setActive(record.definition.name);
      record.definition.onselect?.(record.definition.name, record.definition, this);
    });
  }

  /** @param {NavigationRecord} record @returns {void} */
  _applyActive(record) {
    if (this._tabMode) this._ensurePanel(record);
    for (const item of this._items) {
      const active = item === record;
      if (this._tabMode) {
        item.item.setAttribute('aria-selected', String(active));
        item.item.tabIndex = active ? 0 : -1;
        if (item.panel) item.panel.hidden = !active;
      } else if (active) {
        item.item.setAttribute('aria-current', 'page');
      } else {
        item.item.removeAttribute('aria-current');
      }
    }
    this._activeName = record.definition.name;
  }

  /** @param {NavigationRecord} record @returns {void} */
  _ensurePanel(record) {
    if (!record.panel || record.built) return;
    const source = record.definition.content;
    const content = typeof source === 'function' ? source() : source;
    const node = content instanceof Component ? content.toElement() : content;
    if (!node || typeof node.nodeType !== 'number') {
      throw new TypeError(`Navigation panel factory for ${record.definition.name} must return a Node or Component`);
    }
    record.panel.append(node);
    record.built = true;
  }

  /** @param {KeyboardEvent} event @returns {void} */
  _onTabKeydown(event) {
    if (!this._tabMode) return;
    const item = event.target.closest?.('[role="tab"]');
    if (!item || !this.refs.items.contains(item)) return;
    const current = this._items.find((record) => record.item === item);
    if (!current) return;
    const enabled = this._enabledItems();
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      const offset = event.key === 'ArrowRight' ? 1 : -1;
      const index = enabled.indexOf(current);
      const next = enabled[(index + offset + enabled.length) % enabled.length];
      if (next) this._focusTab(next);
      return;
    }
    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      const next = event.key === 'Home' ? enabled[0] : enabled[enabled.length - 1];
      if (next) this._focusTab(next);
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.setActive(current.definition.name);
    }
  }

  /**
   * Republishes the overflow state: which items may collapse, which mode the stylesheet should
   * apply, and what the More menu contains. With the default `minVisible: 0` every item collapses
   * and the menu lists them all, which is what it has always done.
   * @returns {void}
   */
  _syncOverflow() {
    const below = resolveOverflowBelow(this.options);
    const minVisible = below === null
      ? this._items.length
      : resolveMinVisible(this.options, this._items.length);
    const collapsing = this._items.slice(minVisible);
    const root = /** @type {HTMLElement} */ (this.el);

    for (const [index, record] of this._items.entries()) {
      record.item.dataset.collapsed = String(index >= minVisible);
    }
    root.dataset.overflow = below === null ? 'off' : (minVisible === 0 ? 'all' : 'partial');
    /*
     * The attribute is the stylesheet's own switch: present means "a threshold I do not know", so
     * the container query stands down and the observer below drives `data-narrow` instead.
     */
    if (below === null || below === OVERFLOW_BELOW) delete root.dataset.overflowBelow;
    else root.dataset.overflowBelow = below;

    if (!this._overflow) return;
    this.refs.more.dataset.empty = collapsing.length === 0 ? 'true' : 'false';
    this._overflow.setItems(collapsing.map((record) => ({
      label: record.definition.badge === null ? record.definition.title :
        `${record.definition.title} (${record.definition.badge})`,
      value: record.definition.name,
      disabled: record.definition.disabled
    })));
  }

  /**
   * Watches the bar's own inline size when `overflowBelow` names a threshold the stylesheet cannot
   * express. A bar on the default threshold installs nothing: its container query has already
   * decided before the first frame of script, which is why the default path stays exactly as it
   * was.
   * @returns {void}
   */
  _observeWidth() {
    const below = resolveOverflowBelow(this.options);
    if (below === null || below === OVERFLOW_BELOW) return;
    if (typeof ResizeObserver !== 'function') return;
    const root = /** @type {HTMLElement} */ (this.el);

    const measure = () => {
      const width = root.getBoundingClientRect().width;
      /*
       * Zero is not a narrow bar, it is no measurement at all — what an element reports before it
       * has been laid out. Recording it would latch the collapsed state and never notice the real
       * width, which is the failure `src/core/breakpoint.js` documents.
       */
      if (!width) return;
      const rootElement = globalThis.document?.documentElement;
      const rootFontSize = rootElement
        ? Number.parseFloat(globalThis.getComputedStyle(rootElement).fontSize)
        : Number.NaN;
      // `<=`, because the container query this replaces is a `max-width` and that is inclusive.
      root.dataset.narrow = String(width <= lengthToPixels(below, rootFontSize));
    };

    this._observer = new ResizeObserver(() => {
      /*
       * Answered on the next frame rather than inside the callback: collapsing the bar resizes the
       * very element being observed, which the browser reports as an undelivered-notification loop.
       */
      if (this._frame || typeof requestAnimationFrame !== 'function') {
        if (typeof requestAnimationFrame !== 'function') measure();
        return;
      }
      this._frame = requestAnimationFrame(() => {
        this._frame = 0;
        measure();
      });
    });
    this._observer.observe(root);
    measure();
  }

  /** @param {NavigationRecord} record @returns {void} */
  _focusTab(record) {
    for (const item of this._items) item.item.tabIndex = item === record ? 0 : -1;
    record.item.focus();
  }

  /** @returns {NavigationRecord[]} */
  _enabledItems() {
    return this._items.filter((record) => !record.definition.disabled);
  }

  /** @param {string} name @returns {NavigationRecord|null} */
  _find(name) {
    return this._items.find((record) => record.definition.name === name) ?? null;
  }

  /** @param {string} name @returns {NavigationRecord} */
  _require(name) {
    const record = this._find(name);
    if (!record) throw new RangeError(`Unknown navigation item: ${name}`);
    return record;
  }
}

/**
 * Fired after the active item changes.
 * @event NavigationBar#change
 * @type {CustomEvent<{name: string}>}
 */

/**
 * Resolves the container inline size at or below which items collapse into the overflow menu.
 *
 * Two options can switch collapsing off, because they answer two different questions: `overflow`
 * is whether the bar has an overflow menu at all, and `overflowBelow` is where it starts using it.
 * Either being `false` means the same thing to the stylesheet — nothing ever collapses — so both
 * resolve to `null` here and the caller has one state to handle rather than two.
 * @param {NavigationBarOptions} [options={}] Navigation options, whole or partial.
 * @returns {string|null} A `px` or `rem` length, or `null` when nothing ever collapses.
 */
export function resolveOverflowBelow(options = {}) {
  const enabled = options.overflow ?? true;
  if (typeof enabled !== 'boolean') {
    throw new TypeError('NavigationBar overflow must be a boolean');
  }
  const below = options.overflowBelow ?? OVERFLOW_BELOW;
  if (!enabled || below === false) return null;
  if (typeof below === 'number') {
    if (!Number.isFinite(below) || below < 0) {
      throw new RangeError(`NavigationBar overflowBelow must not be negative: ${below}`);
    }
    return `${below}px`;
  }
  if (typeof below !== 'string' || !OVERFLOW_LENGTH.test(below.trim())) {
    throw new TypeError(
      `NavigationBar overflowBelow must be a px or rem length, a number of pixels, or false: ${String(below)}`
    );
  }
  return below.trim();
}

/**
 * How many items, counted from the start, stay in the bar when it collapses.
 *
 * Clamping to the item count is the whole arithmetic: `minVisible: 4` on a three-item bar keeps
 * three, so the overflow menu is empty rather than holding a phantom fourth entry, and the bar
 * hides its More button instead of opening onto nothing.
 * @param {NavigationBarOptions} [options={}] Navigation options, whole or partial.
 * @param {number} [count=0] How many items the bar currently has.
 * @returns {number} A count between 0 and `count`.
 */
export function resolveMinVisible(options = {}, count = 0) {
  const requested = options.minVisible ?? 0;
  if (!Number.isInteger(requested) || requested < 0) {
    throw new TypeError(`NavigationBar minVisible must be a non-negative integer: ${String(requested)}`);
  }
  const total = Number.isInteger(count) && count > 0 ? count : 0;
  return Math.min(requested, total);
}

/**
 * Converts an overflow threshold to pixels, so a measured width can be compared with it.
 * @param {string|number} length A `px` or `rem` length, or a number of pixels.
 * @param {number} [rootFontSize=16] Computed root font size; anything unusable falls back to 16.
 * @returns {number} The threshold in pixels.
 */
export function lengthToPixels(length, rootFontSize = 16) {
  const value = typeof length === 'number' ? `${length}px` : String(length).trim();
  if (!OVERFLOW_LENGTH.test(value)) {
    throw new TypeError(`NavigationBar cannot measure the length "${String(length)}"`);
  }
  const size = Number.parseFloat(value);
  if (!value.endsWith('rem')) return size;
  const root = Number(rootFontSize);
  return size * (Number.isFinite(root) && root > 0 ? root : 16);
}

/** @param {unknown} content @returns {content is NavigationPanelContent} */
function isPanelContent(content) {
  if (typeof content === 'function' || content instanceof Component) return true;
  return Boolean(content && typeof content === 'object' && typeof content.nodeType === 'number');
}

/** @param {Element} element @returns {{attributes: Array<[string, string]>, children: Node[]}} */
function snapshot(element) {
  return {
    attributes: Array.from(element.attributes, (attribute) => [attribute.name, attribute.value]),
    children: Array.from(element.childNodes)
  };
}

/**
 * @param {Element} element
 * @param {{attributes: Array<[string, string]>, children: Node[]}} original
 * @returns {void}
 */
function restore(element, original) {
  for (const attribute of Array.from(element.attributes)) element.removeAttribute(attribute.name);
  for (const [name, value] of original.attributes) element.setAttribute(name, value);
  element.replaceChildren(...original.children);
}
