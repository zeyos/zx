import { Component } from '../../core/component.js';
import { h, resolveElement } from '../../core/dom.js';
import { connectedOverlayHost, openDialogOf, overlayHost, overlayScope } from '../../core/overlay-host.js';
import { pushOverlay } from '../../core/overlay-stack.js';
import { position } from '../../core/position.js';
import { uid } from '../../core/util.js';

/** What Tab may land on inside a panel: the controls a reader reaches in sequence. */
const TABBABLE_SELECTOR = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])', 'textarea:not([disabled])', 'iframe', '[contenteditable="true"]',
  '[tabindex]'
].map((selector) => `${selector}:not([tabindex^="-"])`).join(',');

/**
 * @typedef {Object} DropdownOptions
 * @property {Node|string|number|{toElement: () => Node|null}|null} [content=null] Panel content.
 * @property {'bottom-start'|'bottom-end'|'top-start'|'top-end'|'bottom'|'top'|'right-start'|'right-end'|'left-start'|'left-end'|'right'|'left'} [placement='bottom-start'] Panel placement.
 * @property {number} [offset=4] Gap between anchor and panel in pixels.
 * @property {boolean} [matchWidth=false] Whether the panel matches the anchor width.
 * @property {'click'|'manual'} [openOn='click'] Trigger behavior.
 * @property {boolean} [closeOnSelect=false] Whether a click within the panel closes it.
 * @property {Element|string|null} [scope=null] Element whose nearest Zx theme scope owns the panel; defaults to the anchor. Resolved on every open, so an anchor connected after construction still gets its scope.
 * @property {(event: CustomEvent<Record<string, never>>) => void} [onopen] Open event listener.
 * @property {(event: CustomEvent<Record<string, never>>) => void} [onclose] Close event listener.
 */

/**
 * Generic anchored floating panel using the browser popover top layer.
 *
 * Open, the panel is one entry on the overlay stack (`core/overlay-stack.js`): Escape closes it
 * only while it is the topmost layer that takes Escape, a press outside it and every overlay opened
 * from it closes it, and it closes with the overlay its anchor sits in. Inside an open dialog the
 * panel is hosted by that dialog, so `showModal()` does not make it inert.
 *
 * The panel follows its trigger in the Tab order: Tab on the anchor of an open panel moves into
 * the panel's first focusable control (or onto the panel itself when it carries a `tabindex`),
 * Tab past the panel's last control continues after the anchor, and Shift+Tab from the first goes
 * back to the anchor. Closing while focus is inside returns it to the anchor.
 * @fires Dropdown#open
 * @fires Dropdown#close
 * @extends {Component<DropdownOptions>}
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
    closeOnSelect: false,
    scope: null
  };

  /** @type {Element} */
  #anchor;
  /** @type {ReturnType<typeof position>|null} */
  #position = null;
  /** @type {Map<string, string|null>} */
  #anchorAttributes = new Map();
  /** @type {import('../../core/overlay-stack.js').OverlayHandle|null} */
  #overlay = null;
  /** @type {((event: KeyboardEvent) => void)|null} Escape behaviour a composing component supplies. */
  #escapeHandler = null;
  /** Whether the panel joins the Tab order after its anchor; menus and rail flyouts opt out. */
  #tabReach = true;
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
    // An anchor that is not in the document yet has no theme scope to read; the panel then waits
    // detached and finds its host on the first open, instead of settling on <body>. A closed panel
    // rests in the theme scope even when the anchor is in a dialog; it moves in only while open.
    connectedOverlayHost(this.options.scope ?? resolved, { dialog: false })?.append(this.el);
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
    this.listen(this.#anchor, 'keydown', (event) => this.#onAnchorKeydown(/** @type {KeyboardEvent} */ (event)));
    this.listen(this.el, 'keydown', (event) => this.#onPanelKeydown(/** @type {KeyboardEvent} */ (event)));
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
    return panel;
  }

  /**
   * Opens and positions the panel.
   * @returns {this}
   * @fires Dropdown#open
   */
  open() {
    if (this.isOpen() || this.#destroyed) return this;
    const host = this.#host();
    if (this.el.parentElement !== host) host.append(this.el);
    this.#position = position(this.#anchor, this.el, {
      placement: this.options.placement,
      offset: Number(this.options.offset),
      matchWidth: Boolean(this.options.matchWidth)
    });
    this.el.dataset.state = 'open';
    this.#overlay = pushOverlay({
      kind: 'popup',
      root: this.el,
      owner: this,
      anchor: [this.#anchor, resolveElement(this.options.scope)],
      inside: [this.#anchor],
      onEscape: (event) => this.#onEscape(event),
      onOutsidePointer: () => this.close(),
      onParentClose: () => this.close()
    });
    this.el.dataset.zxOverlayOrder = String(this.#overlay.order);
    this.#anchor.setAttribute('aria-expanded', 'true');
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
    const hadFocus = this.el.contains(document.activeElement);
    this.#position?.destroy();
    this.#position = null;
    this.el.dataset.state = 'closed';
    delete this.el.dataset.zxOverlayOrder;
    const overlay = this.#overlay;
    this.#overlay = null;
    this.#anchor.setAttribute('aria-expanded', 'false');
    // A panel that took the Tab order hands focus back rather than dropping it on <body>. Menus and
    // flyouts decide where their own focus goes.
    if (hadFocus && this.#tabReach && this.#anchor instanceof HTMLElement) this.#anchor.focus();
    // Back to the theme scope: a closed panel left inside a dialog would sit in that dialog's
    // focus search and go with it when the dialog is removed.
    if (openDialogOf(this.el.parentElement) && this.el.parentElement?.isConnected) {
      overlayScope(this.options.scope ?? this.#anchor).append(this.el);
    }
    overlay?.release();
    this.emit('close');
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

  /**
   * Internal seam for components built on a Dropdown (MenuButton, ContextMenu, the app rail):
   * replaces what Escape does when the overlay stack routes it to this panel, and takes the panel
   * out of the anchor's Tab order — a menu is reached with the arrow keys, not Tab.
   * @param {{onEscape?: ((event: KeyboardEvent) => void)|null, tabReach?: boolean}} settings
   * @returns {this}
   * @internal
   */
  _configure(settings) {
    if ('onEscape' in settings) this.#escapeHandler = settings.onEscape ?? null;
    if ('tabReach' in settings) this.#tabReach = Boolean(settings.tabReach);
    return this;
  }

  /** @returns {Element} Where the panel lives while open. */
  #host() {
    const dialog = openDialogOf(this.#anchor) ?? openDialogOf(resolveElement(this.options.scope));
    return dialog ?? overlayHost(this.options.scope ?? this.#anchor);
  }

  /** @param {KeyboardEvent} event @returns {void} */
  #onEscape(event) {
    if (this.#escapeHandler) {
      this.#escapeHandler(event);
      return;
    }
    const restoreFocus = this.el.contains(document.activeElement);
    this.close();
    if (restoreFocus && this.#anchor instanceof HTMLElement) this.#anchor.focus();
  }

  /** @param {KeyboardEvent} event @returns {void} */
  #onAnchorKeydown(event) {
    if (event.key !== 'Tab' || event.shiftKey || event.defaultPrevented || !this.#tabReach || !this.isOpen()) return;
    const target = tabbables(this.el)[0] ?? (this.el.hasAttribute('tabindex') ? this.el : null);
    if (!(target instanceof HTMLElement)) return;
    event.preventDefault();
    target.focus();
  }

  /** @param {KeyboardEvent} event @returns {void} */
  #onPanelKeydown(event) {
    if (event.key !== 'Tab' || event.defaultPrevented || !this.#tabReach || !this.isOpen()) return;
    const items = tabbables(this.el);
    const active = document.activeElement;
    /*
     * Judged by position, not identity: focus may rest on something Tab itself would never stop
     * at — a composite's `tabindex="-1"` part, a roving item — and what matters is whether any
     * real stop is left in the panel on the side Tab is moving to.
     */
    const ahead = active && active !== this.el
      ? items.filter((item) => !item.contains(active) && (event.shiftKey
        ? Boolean(active.compareDocumentPosition(item) & Node.DOCUMENT_POSITION_PRECEDING)
        : Boolean(active.compareDocumentPosition(item) & Node.DOCUMENT_POSITION_FOLLOWING)
          && !active.contains(item)))
      : (event.shiftKey ? [] : items);
    if (ahead.length > 0) return;
    if (event.shiftKey) {
      if (!(this.#anchor instanceof HTMLElement)) return;
      event.preventDefault();
      this.#anchor.focus();
      return;
    }
    const next = followingTabbable(this.#anchor, this.el);
    if (!next) return;
    event.preventDefault();
    next.focus();
  }

  /** @param {string} name @returns {void} */
  #rememberAnchorAttribute(name) {
    this.#anchorAttributes.set(name, this.#anchor.getAttribute(name));
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

/**
 * The controls inside a container Tab would visit, in document order.
 * @param {Element} container
 * @returns {HTMLElement[]}
 */
function tabbables(container) {
  return /** @type {HTMLElement[]} */ (Array.from(container.querySelectorAll(TABBABLE_SELECTOR))
    .filter((element) => isTabbable(element)));
}

/**
 * The control Tab reaches after `anchor`, skipping the panel that follows it.
 * @param {Element} anchor
 * @param {Element} panel
 * @returns {HTMLElement|null}
 */
function followingTabbable(anchor, panel) {
  // Inside a modal dialog nothing beyond it can take focus, so the search stays within it.
  const scope = openDialogOf(anchor) ?? anchor.ownerDocument.body ?? anchor.ownerDocument.documentElement;
  const all = tabbables(scope).filter((element) => !panel.contains(element));
  const index = all.findIndex((element) => element === anchor || anchor.contains(element));
  if (index < 0) return null;
  let next = index + 1;
  while (next < all.length && anchor.contains(all[next])) next += 1;
  return all[next] ?? null;
}

/**
 * Whether sequential navigation stops at an element: focusable, a non-negative tab index, not
 * disabled, hidden, inert or `aria-hidden`, rendered, and — for a radio — the one stop its group
 * offers (the checked radio, or the first when none is checked).
 * @param {Element} element
 * @returns {boolean}
 */
function isTabbable(element) {
  const html = /** @type {HTMLElement} */ (element);
  if (typeof html.focus !== 'function' || html.tabIndex < 0) return false;
  if (/** @type {HTMLButtonElement} */ (html).disabled) return false;
  if (element.closest('[inert], [hidden], [aria-hidden="true"], fieldset[disabled]')) return false;
  if (html instanceof HTMLInputElement && html.type === 'radio' && html.name && !html.checked) {
    const scope = html.form ?? html.getRootNode();
    const group = /** @type {HTMLInputElement[]} */ (Array.from(
      /** @type {ParentNode} */ (scope).querySelectorAll?.('input[type="radio"]') ?? []
    )).filter((radio) => radio.name === html.name && (radio.form ?? radio.getRootNode()) === scope);
    if (group.some((radio) => radio.checked) || group[0] !== html) return false;
  }
  if (typeof html.checkVisibility === 'function') return html.checkVisibility({ visibilityProperty: true });
  return html.getClientRects().length > 0;
}

/** @param {Element} element @param {string} name @param {string|null} value @returns {void} */
function restoreAttribute(element, name, value) {
  if (value === null) element.removeAttribute(name);
  else element.setAttribute(name, value);
}
