import { Component } from '../../core/component.js';
import { h, resolveElement } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { rovingTabindex, typeahead } from '../../core/keyboard.js';
import { Dropdown } from '../dropdown/dropdown.js';

/** @typedef {import('../menu-button/menu-button.js').MenuItem} MenuItem */
/** @typedef {MenuItem|'-'} ContextMenuEntry */

/**
 * @typedef {Object} ContextMenuOptions
 * @property {ContextMenuEntry[]|((context: Element|null) => ContextMenuEntry[])} [items=[]] Menu
 *   items and `'-'` separators, or a function returning them for the element the menu is opening
 *   on — which is how a row menu disables the actions that row does not allow. Returning an empty
 *   array cancels the opening.
 * @property {string|null} [selector=null] Restricts the menu to descendants matching this
 *   selector, and reports the matched element as the context of the selection. A table passes
 *   `'tbody tr'` here to get a per-row menu from one listener.
 * @property {(event: CustomEvent<{value: unknown, item: MenuItem, context: Element|null}>) => void} [onselect]
 *   Selection listener.
 * @property {(event: CustomEvent<{context: Element|null}>) => void} [onopen] Open listener.
 * @property {(event: CustomEvent<Record<string, never>>) => void} [onclose] Close listener.
 */

const MENU_ITEM_SELECTOR = '[role="menuitem"]';

/**
 * Right-click menu for a region, implementing the APG menu pattern.
 *
 * Attaches to an existing element and never changes it: the menu itself lives in the top layer,
 * anchored to a zero-sized element parked at the pointer. `selector` turns one instance into a
 * per-row menu — the listener stays on the container, and the row that was clicked arrives with
 * the selection as `context`.
 *
 * Reachable from the keyboard as the platform expects: the Menu key or Shift+F10 opens the menu at
 * the focused element, and closing returns focus to where it came from. Pointer-only context
 * menus are a common accessibility failure, so both routes are wired here rather than left to the
 * application.
 *
 * Note that the component's root is the anchor, which lives on `<body>` — so the bubbling `zx-*`
 * DOM events land there, not in the target's tree. Listen with `on('select')` or `onselect`.
 *
 * @fires ContextMenu#select
 * @fires ContextMenu#open
 * @fires ContextMenu#close
 */
export class ContextMenu extends Component {
  /** @type {ContextMenuOptions} */
  static defaults = {
    items: [],
    selector: null
  };

  /** @type {Element} */
  #target;
  /** @type {Dropdown} */
  #dropdown;
  /** @type {HTMLElement} */
  #panel;
  /** @type {ReturnType<typeof rovingTabindex>} */
  #roving;
  /** @type {(event: KeyboardEvent|string) => void} */
  #typeahead;
  /** @type {ContextMenuEntry[]} */
  #items = [];
  /** @type {Element|null} */
  #context = null;
  /** @type {Element|null} */
  #returnFocus = null;
  #destroyed = false;

  /**
   * Attaches a context menu to an existing element.
   * @param {Element|string} target Element or selector the menu belongs to.
   * @param {ContextMenuOptions} [options={}] Context-menu options.
   */
  constructor(target, options = {}) {
    const resolved = resolveElement(target);
    if (!resolved) throw new TypeError('ContextMenu target could not be resolved');
    super(null, options);
    this.#target = resolved;
    document.body.append(this.el);

    this.#dropdown = new Dropdown(this.el, { openOn: 'manual', placement: 'bottom-start' });
    this.#panel = this.#dropdown.getPanel();
    this.#panel.classList.add('zx-context-menu');
    this.#panel.setAttribute('role', 'menu');

    if (Array.isArray(this.options.items)) this.setItems(this.options.items);
    this.#roving = rovingTabindex(this.#panel, MENU_ITEM_SELECTOR);
    this.#typeahead = typeahead(() => this.#menuItems(), (item) => item.focus());

    this.#dropdown.on('close', () => {
      this.#context = null;
      const restore = this.#returnFocus;
      this.#returnFocus = null;
      if (restore instanceof HTMLElement && restore.isConnected) restore.focus();
      this.emit('close');
    });

    this.listen(this.#target, 'contextmenu', (event) => this.#onContextMenu(event));
    this.listen(this.#target, 'keydown', (event) => this.#onTargetKeydown(event));
    this.listen(this.#panel, 'click', (event) => {
      const item = event.target.closest?.(MENU_ITEM_SELECTOR);
      if (item && this.#panel.contains(item)) this.#select(item);
    });
    this.listen(this.#panel, 'keydown', (event) => this.#onMenuKeydown(event));
  }

  /**
   * Creates the zero-sized element the menu is anchored to.
   * @returns {HTMLElement}
   */
  render() {
    return h('span', { class: 'zx-context-menu__anchor', ariaHidden: 'true' });
  }

  /**
   * Replaces the menu items.
   * @param {ContextMenuEntry[]} items Menu definitions.
   * @returns {this}
   */
  setItems(items) {
    this.#items = Array.isArray(items) ? items.slice() : [];
    this.#panel.replaceChildren();
    this.#items.forEach((item, index) => {
      if (item === '-') {
        this.#panel.append(h('div', { class: 'zx-context-menu__separator', role: 'separator' }));
        return;
      }
      const children = [];
      if (item.icon) children.push(h('span', { class: 'zx-context-menu__icon' }, icon(item.icon)));
      children.push(h('span', { class: 'zx-context-menu__label' }, String(item.label ?? '')));
      this.#panel.append(h('button', {
        class: 'zx-context-menu__item',
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
   * Opens the menu at a point in viewport coordinates.
   * @param {number} x Client X.
   * @param {number} y Client Y.
   * @param {Element|null} [context=null] Element the menu applies to.
   * @returns {this}
   * @fires ContextMenu#open
   */
  openAt(x, y, context = null) {
    if (!this.#prepare(context)) return this;
    this.#openResolved(x, y, context);
    return this;
  }

  /**
   * Opens the menu against an element's box, which is where a keyboard invocation puts it.
   * @param {Element} element Element to anchor to.
   * @returns {this}
   * @fires ContextMenu#open
   */
  openAtElement(element) {
    const box = element.getBoundingClientRect();
    return this.openAt(box.left, box.bottom, element);
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

  /**
   * The element the open menu applies to — the `selector` match under the pointer, or the target.
   * @returns {Element|null}
   */
  getContext() {
    return this.#context;
  }

  /**
   * Detaches the menu and removes its anchor.
   * @returns {void}
   */
  destroy() {
    if (this.#destroyed) return;
    this.#destroyed = true;
    this.#roving.destroy();
    this.#dropdown.destroy();
    super.destroy();
  }

  /**
   * Resolves the items for this opening and reports whether it may proceed.
   * @param {Element|null} context Element the menu applies to.
   * @returns {boolean}
   */
  #prepare(context) {
    const items = this.options.items;
    if (typeof items === 'function') {
      const resolved = items(context);
      if (!Array.isArray(resolved) || resolved.length === 0) return false;
      this.setItems(resolved);
    }
    return this.#items.length > 0;
  }

  /**
   * Places the anchor and opens, with the items for this opening already resolved.
   *
   * `left`/`top` rather than the logical insets used everywhere else: these are viewport
   * coordinates from a pointer event, which are physical whatever the writing direction is.
   *
   * @param {number} x Client X.
   * @param {number} y Client Y.
   * @param {Element|null} context Element the menu applies to.
   * @returns {void}
   */
  #openResolved(x, y, context) {
    const root = /** @type {HTMLElement} */ (this.el);
    root.style.left = `${x}px`;
    root.style.top = `${y}px`;
    this.#context = context;
    this.#returnFocus = document.activeElement;
    this.#dropdown.open();
    this.#roving.focusFirst();
    this.emit('open', { context });
  }

  /** @param {Event} event @returns {void} */
  #onContextMenu(event) {
    const pointer = /** @type {PointerEvent & {target: Element}} */ (event);
    const context = this.#contextFor(pointer.target);
    // Only take over the platform menu once there is something of our own to show — and resolve
    // the items once for the opening, not once to decide and again to open.
    if (!context || !this.#prepare(context)) return;
    event.preventDefault();
    this.#openResolved(pointer.clientX, pointer.clientY, context);
  }

  /** @param {Event} event @returns {void} */
  #onTargetKeydown(event) {
    const key = /** @type {KeyboardEvent} */ (event);
    if (key.key !== 'ContextMenu' && !(key.key === 'F10' && key.shiftKey)) return;
    const context = this.#contextFor(/** @type {Element} */ (key.target));
    if (!context || !this.#prepare(context)) return;
    event.preventDefault();
    const box = context.getBoundingClientRect();
    this.#openResolved(box.left, box.bottom, context);
  }

  /**
   * The element a pointer or key event applies to, honoring `selector`.
   * @param {Element|null} from Event target.
   * @returns {Element|null}
   */
  #contextFor(from) {
    if (!this.options.selector) return this.#target;
    const match = from?.closest?.(String(this.options.selector));
    return match && this.#target.contains(match) ? match : null;
  }

  /** @param {Event} event @returns {void} */
  #onMenuKeydown(event) {
    const key = /** @type {KeyboardEvent} */ (event);
    if (key.key === 'Escape' || key.key === 'Tab') {
      event.preventDefault();
      this.close();
      return;
    }
    if (key.key === 'Enter' || key.key === ' ') {
      const item = /** @type {Element} */ (key.target).closest?.(MENU_ITEM_SELECTOR);
      if (!item || !this.#panel.contains(item)) return;
      event.preventDefault();
      this.#select(item);
      return;
    }
    this.#typeahead(key);
  }

  /** @param {Element} element @returns {void} */
  #select(element) {
    const index = Number(element.getAttribute('data-menu-item'));
    const item = this.#items[index];
    if (!item || item === '-' || item.disabled) return;
    const context = this.#context;
    this.emit('select', { value: item.value, item, context });
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
 * Fired when an enabled item is activated. `context` is the element the menu was opened on.
 * @event ContextMenu#select
 * @type {CustomEvent<{value: unknown, item: MenuItem, context: Element|null}>}
 */

/**
 * Fired when the menu opens.
 * @event ContextMenu#open
 * @type {CustomEvent<{context: Element|null}>}
 */

/**
 * Fired when the menu closes.
 * @event ContextMenu#close
 * @type {CustomEvent<Record<string, never>>}
 */
