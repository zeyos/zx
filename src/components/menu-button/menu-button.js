import { Component } from '../../core/component.js';
import { h, resolveElement } from '../../core/dom.js';
import { uid } from '../../core/util.js';
import { icon } from '../../core/icons.js';
import { rovingTabindex, typeahead } from '../../core/keyboard.js';
import {
  isMenuItem,
  MENU_ITEM_SELECTOR,
  renderMenuEntries
} from '../../internal/menu-items.js';
import { Dropdown } from '../dropdown/dropdown.js';

/** @typedef {import('../../internal/menu-items.js').MenuItem} MenuItem */
/** @typedef {import('../../internal/menu-items.js').MenuEntry} MenuButtonItem */
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
 * @typedef {Object} MenuButtonOpenOptions
 * @property {boolean|HTMLElement} [returnFocus=true] Where focus goes when this opening ends with a
 *   selection or Escape: `true` is the trigger, an element is that element (the trigger again if
 *   it has left the document), and `false` leaves focus alone.
 */

/**
 * APG menu-button trigger backed by an anchored Dropdown.
 *
 * Choosing an item closes the menu and puts focus back on the trigger before the `select` event
 * and the item's `onselect` run, so whatever they open — a dialog, a sheet — records the trigger
 * as the place to return to, and focus they move themselves stays where they put it.
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
  /** @type {boolean|HTMLElement} Focus destination for the current opening. */
  #returnFocus = true;
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
    // The menu is named by its trigger, as the APG menu-button pattern has it. An id given here to
    // an enhanced trigger goes again on destroy(), with the rest of the attributes it gained.
    if (!this.el.id) this.el.id = uid('zx-menu-button');
    this.#panel.setAttribute('aria-labelledby', this.el.id);
    this.el.setAttribute('aria-haspopup', 'menu');
    if (existing && hasExplicitLabel) this.setLabel(this.options.label);

    this.setItems(this.options.items);
    this.#roving = rovingTabindex(this.#panel, MENU_ITEM_SELECTOR);
    this.#typeahead = typeahead(
      () => this.#menuItems(),
      (item) => item.focus()
    );

    this.#dropdown.on('open', () => this.emit('open'));
    this.#dropdown.on('close', () => {
      this.#returnFocus = true;
      this.emit('close');
    });
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
      if (item && this.#panel.contains(item)) this.#selectElement(item, event);
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
    this.#panel.replaceChildren(...renderMenuEntries(this.#items, 'menu-button'));
    return this;
  }

  /**
   * Opens the menu.
   * @param {MenuButtonOpenOptions} [options={}] Where focus returns when this opening ends; ignored
   *   while the menu is already open.
   * @returns {this}
   */
  open(options = {}) {
    if (!this.isOpen()) this.#returnFocus = options?.returnFocus ?? true;
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

  /**
   * Opens the menu and focuses its first enabled item.
   * @param {MenuButtonOpenOptions} [options={}] Passed to `open()`.
   * @returns {this}
   */
  focusFirst(options = {}) {
    this.open(options);
    this.#roving.focusFirst();
    return this;
  }

  /**
   * Opens the menu and focuses its last enabled item.
   * @param {MenuButtonOpenOptions} [options={}] Passed to `open()`.
   * @returns {this}
   */
  focusLast(options = {}) {
    this.open(options);
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
      const target = this.#returnTarget();
      this.close();
      target?.focus();
      return;
    }
    if (event.key === 'Tab') {
      this.close();
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      const item = event.target.closest?.(MENU_ITEM_SELECTOR);
      if (!item || !this.#panel.contains(item)) return;
      if (event.key === 'Enter' && item.tagName === 'A') return;
      event.preventDefault();
      /** @type {HTMLElement} */ (item).click();
      return;
    }
    this.#typeahead(event);
  }

  /** @param {Element} element @param {Event|null} [event=null] @returns {void} */
  #selectElement(element, event = null) {
    const index = Number(element.getAttribute('data-menu-item'));
    const item = this.#items[index];
    if (!isMenuItem(item) || item.disabled) {
      event?.preventDefault();
      return;
    }
    /*
     * Focus goes back first, as the APG pattern has it, and only if it is still the menu's to give:
     * inside the panel, or already lost to the body. A dialog opened by a listener below then
     * records the trigger as its opener rather than an item that is about to be hidden, and focus
     * a listener moves on purpose is left where it was put.
     */
    const target = this.#returnTarget();
    const active = document.activeElement;
    const reclaim = Boolean(target) && (!active || active === document.body || this.#panel.contains(active));
    if (reclaim) target?.focus();
    const selected = this.emit('select', { value: item.value, item });
    if (selected.defaultPrevented) {
      event?.preventDefault();
      // The menu stays open, so focus returns to the item, unless a listener has moved it again.
      if (reclaim && document.activeElement === target && element instanceof HTMLElement) element.focus();
      return;
    }
    try {
      item.onselect?.(item.value, item, this);
    } finally {
      this.close();
    }
  }

  /**
   * The element focus returns to when the current opening ends, or null when it should stay put.
   * @returns {HTMLElement|null}
   */
  #returnTarget() {
    const target = this.#returnFocus;
    if (target === false) return null;
    if (target instanceof HTMLElement && target.isConnected) return target;
    return /** @type {HTMLElement} */ (this.el);
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
