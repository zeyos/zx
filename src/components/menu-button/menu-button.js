import { Component } from '../../core/component.js';
import { h, resolveElement } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { rovingTabindex, typeahead } from '../../core/keyboard.js';
import { Dropdown } from '../dropdown/dropdown.js';

const MENU_ITEM_SELECTOR = '[role="menuitem"]';

/**
 * @typedef {Object} MenuItem
 * @property {string} label Item label.
 * @property {string} [icon] Kernel icon name.
 * @property {unknown} [value] Value emitted on selection.
 * @property {boolean} [disabled=false] Whether selection is disabled.
 * @property {boolean} [danger=false] Whether the action is dangerous.
 * @property {(value: unknown, item: MenuItem, menuButton: MenuButton) => void} [onselect] Selection callback.
 */
/** @typedef {MenuItem|'-'} MenuButtonItem */
/**
 * @typedef {Object} MenuButtonOptions
 * @property {string} [label=''] Trigger label.
 * @property {string|null} [icon=null] Trigger icon name.
 * @property {'default'|'primary'|'danger'|'ghost'} [kind='default'] Trigger button kind.
 * @property {MenuButtonItem[]} [items=[]] Menu items and separators.
 * @property {'bottom-start'|'bottom-end'|'top-start'|'top-end'|'bottom'|'top'|'right-start'|'right-end'|'left-start'|'left-end'|'right'|'left'} [placement='bottom-start'] Menu placement.
 * @property {(event: CustomEvent<{value: unknown, item: MenuItem}>) => void} [onselect] Select event listener.
 * @property {(event: CustomEvent<Record<string, never>>) => void} [onopen] Open event listener.
 * @property {(event: CustomEvent<Record<string, never>>) => void} [onclose] Close event listener.
 */

/**
 * APG menu-button trigger backed by an anchored Dropdown.
 * @fires MenuButton#select
 * @fires MenuButton#open
 * @fires MenuButton#close
 * @extends {Component<MenuButtonOptions>}
 */
export class MenuButton extends Component {
  static cssName = 'menu-button';

  /** @type {Readonly<MenuButtonOptions>} */
  static defaults = {
    label: '',
    icon: null,
    kind: 'default',
    items: [],
    placement: 'bottom-start'
  };

  /** @type {Dropdown} */
  #dropdown;
  /** @type {HTMLElement} */
  #panel;
  /** @type {ReturnType<typeof rovingTabindex>} */
  #roving;
  /** @type {(event: KeyboardEvent|string) => void} */
  #typeahead;
  /** @type {MenuButtonItem[]} */
  #items = [];
  /** @type {{attributes: Array<[string, string]>, children: Node[]}|null} */
  #original = null;
  #created = false;
  #destroyed = false;

  /**
   * Creates or enhances a menu trigger button.
   * @param {HTMLButtonElement|string|null} target Existing button, selector, or null to create one.
   * @param {MenuButtonOptions} [options={}] Menu-button options.
   */
  constructor(target = null, options = {}) {
    const existing = target === null ? null : resolveElement(target);
    if (target !== null && (!existing || existing.tagName !== 'BUTTON')) {
      throw new TypeError('MenuButton target must resolve to a button');
    }
    const original = existing ? {
      attributes: Array.from(existing.attributes, (attribute) => [attribute.name, attribute.value]),
      children: Array.from(existing.childNodes)
    } : null;
    const hasExplicitLabel = Object.hasOwn(options, 'label');
    super(target, options);
    this.#created = existing === null;
    this.#original = original;

    this.el.classList.add('zx-btn');
    this.el.setAttribute('type', 'button');
    this.el.setAttribute('data-kind', String(this.options.kind));
    this.el.setAttribute('data-size', 'md');

    this.#dropdown = new Dropdown(this.el, {
      openOn: 'manual',
      placement: this.options.placement,
      content: null
    });
    this.#panel = this.#dropdown.getPanel();
    this.#panel.classList.add('zx-menu-button__menu');
    this.#panel.setAttribute('role', 'menu');
    this.el.setAttribute('aria-haspopup', 'menu');
    if (existing && hasExplicitLabel) this.setLabel(this.options.label);

    this.setItems(this.options.items);
    this.#roving = rovingTabindex(this.#panel, MENU_ITEM_SELECTOR);
    this.#typeahead = typeahead(
      () => this.#menuItems(),
      (item) => item.focus()
    );

    this.#dropdown.on('open', () => this.emit('open'));
    this.#dropdown.on('close', () => this.emit('close'));
    this.listen(this.el, 'click', () => {
      if (this.isOpen()) this.close();
      else {
        this.open();
        this.#roving.focusFirst();
      }
    });
    this.listen(this.el, 'keydown', (event) => this.#onTriggerKeydown(event));
    this.listen(this.#panel, 'click', (event) => {
      const item = event.target.closest?.(MENU_ITEM_SELECTOR);
      if (item && this.#panel.contains(item)) this.#selectElement(item);
    });
    this.listen(this.#panel, 'keydown', (event) => this.#onMenuKeydown(event));
  }

  /**
   * Creates a trigger when no target was provided.
   * @returns {HTMLButtonElement}
   */
  render() {
    if (this.el) return /** @type {HTMLButtonElement} */ (this.el);
    return /** @type {HTMLButtonElement} */ (h('button', {
      class: 'zx-btn',
      type: 'button',
      'data-kind': this.options.kind,
      'data-size': 'md'
    }, triggerContent(this.options.label, this.options.icon)));
  }

  /**
   * Replaces menu items and separators.
   * @param {MenuButtonItem[]} items Menu definitions.
   * @returns {this}
   */
  setItems(items) {
    this.#items = Array.isArray(items) ? items.slice() : [];
    this.#panel.replaceChildren();
    this.#items.forEach((item, index) => {
      if (item === '-') {
        this.#panel.append(h('div', { class: 'zx-menu-button__separator', role: 'separator' }));
        return;
      }
      const children = [];
      if (item.icon) children.push(h('span', { class: 'zx-menu-button__icon' }, icon(item.icon)));
      children.push(h('span', { class: 'zx-menu-button__label' }, item.label));
      this.#panel.append(h('button', {
        class: 'zx-menu-button__item',
        type: 'button',
        role: 'menuitem',
        tabindex: '-1',
        'data-menu-item': String(index),
        'data-danger': item.danger ? 'true' : null,
        ariaDisabled: item.disabled ? 'true' : null
      }, children));
    });
    return this;
  }

  /**
   * Opens the menu.
   * @returns {this}
   */
  open() {
    this.#dropdown.open();
    return this;
  }

  /**
   * Closes the menu.
   * @returns {this}
   */
  close() {
    this.#dropdown.close();
    return this;
  }

  /**
   * Reports whether the menu is open.
   * @returns {boolean}
   */
  isOpen() {
    return this.#dropdown.isOpen();
  }

  /** Returns the trigger button. @returns {HTMLElement} */
  getTrigger() {
    return /** @type {HTMLElement} */ (this.el);
  }

  /** Returns the owned menu panel. @returns {HTMLElement} */
  getPanel() {
    return this.#panel;
  }

  /** Opens the menu and focuses its first enabled item. @returns {this} */
  focusFirst() {
    this.open();
    this.#roving.focusFirst();
    return this;
  }

  /** Opens the menu and focuses its last enabled item. @returns {this} */
  focusLast() {
    this.open();
    this.#roving.focusLast();
    return this;
  }

  /**
   * Sets the visible trigger label.
   * @param {string} label Trigger label.
   * @returns {this}
   */
  setLabel(label) {
    this.el.replaceChildren(...triggerContent(label, this.options.icon));
    return this;
  }

  /**
   * Destroys the menu, dropdown panel, and trigger enhancements.
   * @returns {void}
   */
  destroy() {
    if (this.#destroyed) return;
    this.#destroyed = true;
    this.#roving.destroy();
    this.#dropdown.destroy();
    super.destroy();
    if (!this.#created && this.#original) {
      for (const attribute of Array.from(this.el.attributes)) this.el.removeAttribute(attribute.name);
      for (const [name, value] of this.#original.attributes) this.el.setAttribute(name, value);
      this.el.replaceChildren(...this.#original.children);
    }
  }

  /** @param {KeyboardEvent} event @returns {void} */
  #onTriggerKeydown(event) {
    if (!['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) return;
    event.preventDefault();
    this.open();
    if (event.key === 'ArrowUp') this.#roving.focusLast();
    else this.#roving.focusFirst();
  }

  /** @param {KeyboardEvent} event @returns {void} */
  #onMenuKeydown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
      this.el.focus();
      return;
    }
    if (event.key === 'Tab') {
      this.close();
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      const item = event.target.closest?.(MENU_ITEM_SELECTOR);
      if (!item || !this.#panel.contains(item)) return;
      event.preventDefault();
      this.#selectElement(item);
      return;
    }
    this.#typeahead(event);
  }

  /** @param {Element} element @returns {void} */
  #selectElement(element) {
    const index = Number(element.getAttribute('data-menu-item'));
    const item = this.#items[index];
    if (!item || item === '-' || item.disabled) return;
    const selected = this.emit('select', { value: item.value, item });
    if (selected.defaultPrevented) return;
    try {
      item.onselect?.(item.value, item, this);
    } finally {
      this.close();
    }
  }

  /** @returns {HTMLElement[]} */
  #menuItems() {
    return Array.from(this.#panel.querySelectorAll(MENU_ITEM_SELECTOR));
  }
}

/**
 * Fired when an enabled item is activated.
 * @event MenuButton#select
 * @type {CustomEvent<{value: unknown, item: MenuItem}>}
 */

/**
 * Fired when the menu opens.
 * @event MenuButton#open
 * @type {CustomEvent<Record<string, never>>}
 */

/**
 * Fired when the menu closes.
 * @event MenuButton#close
 * @type {CustomEvent<Record<string, never>>}
 */

/** @param {string} label @param {string|null} iconName @returns {Node[]} */
function triggerContent(label, iconName) {
  const children = [];
  if (iconName) children.push(h('span', { class: 'zx-btn__icon' }, icon(iconName)));
  children.push(h('span', { class: 'zx-btn__label' }, String(label ?? '')));
  return children;
}
