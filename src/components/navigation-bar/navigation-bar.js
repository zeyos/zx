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
 * @property {(event: CustomEvent<{name: string}>) => void} [onchange] Change callback.
 */

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
 */
export class NavigationBar extends Component {
  static cssName = 'navigation-bar';

  /** @type {Readonly<NavigationBarOptions>} */
  static defaults = {
    title: '',
    items: [],
    active: null,
    actions: []
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

    this._items = [];
    this._activeName = null;
    this._tabMode = definitions.some((item) => Object.hasOwn(item, 'content'));
    if (this._tabMode && definitions.some((item) => !Object.hasOwn(item, 'content'))) {
      throw new TypeError('NavigationBar panel items must all define content');
    }
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

  /** @returns {void} */
  _syncOverflow() {
    if (!this._overflow) return;
    this.refs.more.dataset.empty = this._items.length === 0 ? 'true' : 'false';
    this._overflow.setItems(this._items.map((record) => ({
      label: record.definition.badge === null ? record.definition.title :
        `${record.definition.title} (${record.definition.badge})`,
      value: record.definition.name,
      disabled: record.definition.disabled
    })));
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
