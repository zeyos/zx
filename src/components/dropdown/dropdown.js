import { Component } from '../../core/component.js';
import { h, resolveElement } from '../../core/dom.js';
import { position } from '../../core/position.js';
import { uid } from '../../core/util.js';

const HANDLE_POINTER_DISMISS = Symbol('zxDropdownPointerDismiss');
const HANDLE_ESCAPE_DISMISS = Symbol('zxDropdownEscapeDismiss');

/**
 * @typedef {Object} DropdownOptions
 * @property {Node|string|number|{toElement: () => Node|null}|null} [content=null] Panel content.
 * @property {'bottom-start'|'bottom-end'|'top-start'|'top-end'|'bottom'|'top'} [placement='bottom-start'] Panel placement.
 * @property {number} [offset=4] Gap between anchor and panel in pixels.
 * @property {boolean} [matchWidth=false] Whether the panel matches the anchor width.
 * @property {'click'|'manual'} [openOn='click'] Trigger behavior.
 * @property {boolean} [closeOnSelect=false] Whether a click within the panel closes it.
 * @property {(event: CustomEvent<Record<string, never>>) => void} [onopen] Open event listener.
 * @property {(event: CustomEvent<Record<string, never>>) => void} [onclose] Close event listener.
 */

/**
 * Generic anchored floating panel using the browser popover top layer.
 * @fires Dropdown#open
 * @fires Dropdown#close
 */
export class Dropdown extends Component {
  static cssName = 'dropdown';

  /** @type {Readonly<DropdownOptions>} */
  static defaults = {
    content: null,
    placement: 'bottom-start',
    offset: 4,
    matchWidth: false,
    openOn: 'click',
    closeOnSelect: false
  };

  /** @type {Element} */
  #anchor;
  /** @type {ReturnType<typeof position>|null} */
  #position = null;
  /** @type {Map<string, string|null>} */
  #anchorAttributes = new Map();
  #destroyed = false;

  /**
   * Creates a floating panel anchored to an existing element.
   * @param {Element|string} anchor Anchor element or selector.
   * @param {DropdownOptions} [options={}] Dropdown options.
   */
  constructor(anchor, options = {}) {
    const resolved = resolveElement(anchor);
    if (!resolved) throw new TypeError('Dropdown anchor could not be resolved');
    super(null, options);
    this.#anchor = resolved;
    this.#rememberAnchorAttribute('aria-expanded');
    this.#rememberAnchorAttribute('aria-controls');
    this.#anchor.setAttribute('aria-expanded', 'false');
    this.#anchor.setAttribute('aria-controls', this.el.id);
    this.setContent(this.options.content);

    if (this.options.openOn === 'click') {
      this.listen(this.#anchor, 'click', () => this.toggle());
    }
    this.listen(this.el, 'click', () => {
      if (this.options.closeOnSelect) this.close();
    });
  }

  /**
   * Creates the owned popover panel.
   * @returns {HTMLElement}
   */
  render() {
    const panel = h('div', {
      id: uid('zx-dropdown'),
      popover: 'manual'
    });
    panel.dataset.state = 'closed';
    document.body.append(panel);
    return panel;
  }

  /**
   * Opens and positions the panel.
   * @returns {this}
   * @fires Dropdown#open
   */
  open() {
    if (this.isOpen() || this.#destroyed) return this;
    this.#position = position(this.#anchor, this.el, {
      placement: this.options.placement,
      offset: Number(this.options.offset),
      matchWidth: Boolean(this.options.matchWidth)
    });
    this.el.dataset.state = 'open';
    this.el.dataset.zxOverlayOrder = String(nextOverlayOrder());
    this.#anchor.setAttribute('aria-expanded', 'true');
    ensureDismissManager();
    this.emit('open');
    return this;
  }

  /**
   * Closes the panel and releases its positioning resources.
   * @returns {this}
   * @fires Dropdown#close
   */
  close() {
    if (!this.isOpen()) return this;
    this.#position?.destroy();
    this.#position = null;
    this.el.dataset.state = 'closed';
    delete this.el.dataset.zxOverlayOrder;
    this.#anchor.setAttribute('aria-expanded', 'false');
    this.emit('close');
    destroyUnusedDismissManager();
    return this;
  }

  /**
   * Toggles the panel.
   * @returns {this}
   */
  toggle() {
    return this.isOpen() ? this.close() : this.open();
  }

  /**
   * Reports whether the panel is open.
   * @returns {boolean}
   */
  isOpen() {
    return this.#position !== null;
  }

  /**
   * Replaces panel content without interpreting strings as HTML.
   * @param {Node|string|number|{toElement: () => Node|null}|null} content Panel content.
   * @returns {this}
   */
  setContent(content) {
    replaceContent(this.el, content);
    this.#position?.update();
    return this;
  }

  /**
   * Returns the owned popover panel.
   * @returns {HTMLElement}
   */
  getPanel() {
    return this.el;
  }

  /**
   * Closes and removes the panel, restoring anchor ARIA attributes.
   * @returns {void}
   */
  destroy() {
    if (this.#destroyed) return;
    this.#destroyed = true;
    this.close();
    for (const [name, value] of this.#anchorAttributes) restoreAttribute(this.#anchor, name, value);
    super.destroy();
  }

  /** @param {PointerEvent} event @returns {void} */
  [HANDLE_POINTER_DISMISS](event) {
    if (!this.isOpen()) return;
    const path = event.composedPath();
    if (path.includes(this.el) || path.includes(this.#anchor)) return;
    this.close();
  }

  /** @param {KeyboardEvent} event @returns {void} */
  [HANDLE_ESCAPE_DISMISS](event) {
    if (event.key !== 'Escape' || !this.isOpen()) return;
    event.preventDefault();
    const restoreFocus = this.el.contains(document.activeElement);
    this.close();
    if (restoreFocus && this.#anchor instanceof HTMLElement) this.#anchor.focus();
  }

  /** @param {string} name @returns {void} */
  #rememberAnchorAttribute(name) {
    this.#anchorAttributes.set(name, this.#anchor.getAttribute(name));
  }
}

/** Shared document-level light-dismiss listener owned only while a dropdown is open. */
class DropdownDismissManager extends Component {
  /** Creates the transient listener owner. */
  constructor() {
    super(null);
    this.listen(document, 'pointerdown', (event) => {
      const component = topmostOverlayComponent();
      if (component instanceof Dropdown) component[HANDLE_POINTER_DISMISS](event);
    });
    this.listen(document, 'keydown', (event) => {
      if (event.key !== 'Escape') return;
      const component = topmostOverlayComponent();
      if (component instanceof Dropdown) component[HANDLE_ESCAPE_DISMISS](event);
    });
  }

  /** @returns {HTMLElement} */
  render() {
    const marker = h('span', { hidden: true, 'data-zx-dropdown-dismiss-manager': '' });
    document.body.append(marker);
    return marker;
  }
}

/**
 * Fired when the dropdown panel opens.
 * @event Dropdown#open
 * @type {CustomEvent<Record<string, never>>}
 */

/**
 * Fired when the dropdown panel closes.
 * @event Dropdown#close
 * @type {CustomEvent<Record<string, never>>}
 */

/**
 * @param {Element} target
 * @param {Node|string|number|{toElement: () => Node|null}|null|undefined} content
 * @returns {void}
 */
function replaceContent(target, content) {
  target.replaceChildren();
  if (content == null) return;
  if (typeof content === 'string' || typeof content === 'number') {
    target.append(document.createTextNode(String(content)));
  } else if (typeof content.toElement === 'function') {
    const element = content.toElement();
    if (element) target.append(element);
  } else if (typeof content.nodeType === 'number') {
    target.append(content);
  }
}

/** @returns {Component|null} */
function topmostOverlayComponent() {
  let topmost = null;
  let highest = -1;
  for (const candidate of document.querySelectorAll('[data-zx-overlay-order]')) {
    const order = Number(candidate.getAttribute('data-zx-overlay-order')) || 0;
    if (order > highest) {
      highest = order;
      topmost = candidate;
    }
  }
  return topmost ? Component.from(topmost) : null;
}

/** @returns {number} */
function nextOverlayOrder() {
  const orders = Array.from(document.querySelectorAll('[data-zx-overlay-order]'), (element) =>
    Number(element.getAttribute('data-zx-overlay-order')) || 0
  );
  return Math.max(0, ...orders) + 1;
}

/** @returns {DropdownDismissManager} */
function ensureDismissManager() {
  const marker = document.querySelector('[data-zx-dropdown-dismiss-manager]');
  const existing = marker ? Component.from(marker) : null;
  return existing instanceof DropdownDismissManager ? existing : new DropdownDismissManager();
}

/** @returns {void} */
function destroyUnusedDismissManager() {
  if (document.querySelector('.zx-dropdown[data-state="open"]')) return;
  const marker = document.querySelector('[data-zx-dropdown-dismiss-manager]');
  const manager = marker ? Component.from(marker) : null;
  if (manager instanceof DropdownDismissManager) manager.destroy();
}

/** @param {Element} element @param {string} name @param {string|null} value @returns {void} */
function restoreAttribute(element, name, value) {
  if (value === null) element.removeAttribute(name);
  else element.setAttribute(name, value);
}
