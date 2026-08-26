import { Component } from '../../core/component.js';
import { h } from '../../core/dom.js';
import { overlayHost } from '../../core/overlay-host.js';

/**
 * @typedef {Object} ModalOptions
 * @property {Node|string|number|{toElement: () => Node|null}|null} [content=null] Modal content.
 * @property {string|number} [width='auto'] CSS width, or a pixel width when numeric.
 * @property {boolean} [closable=true] Whether Escape may close the modal.
 * @property {boolean} [lightDismiss=false] Whether a backdrop click closes the modal.
 * @property {boolean} [destroyOnClose=false] Whether to destroy the modal after it closes.
 * @property {Element|string|null} [scope=null] Element whose nearest Zx theme scope owns the overlay; defaults to the opener.
 * @property {(event: CustomEvent<Record<string, never>>) => void} [onopen] Open event listener.
 * @property {(event: CustomEvent<{result: unknown}>) => void} [onclose] Close event listener.
 * @property {(event: CustomEvent<Record<string, never>>) => void} [oncancel] Cancel event listener.
 */

/**
 * Thin native-dialog overlay with lifecycle-safe content and dismissal behavior.
 * The constructor always creates and appends a new dialog; its target argument is ignored.
 * @fires Modal#open
 * @fires Modal#close
 * @fires Modal#cancel
 * @extends {Component<ModalOptions>}
 */
export class Modal extends Component {
  static cssName = 'modal';

  /** @type {Readonly<ModalOptions>} */
  static defaults = {
    content: null,
    width: 'auto',
    closable: true,
    lightDismiss: false,
    destroyOnClose: false,
    scope: null
  };

  /** @type {Map<number, {result: unknown}>} */
  #pendingResults = new Map();
  #destroying = false;
  #presentation = 0;
  /** @type {number[]} */
  #nativeClosingPresentations = [];

  /**
   * Creates a modal in the configured theme scope, or at document level when none is present.
   * @param {Element|string|null} [_target=null] Ignored; Modal always owns its root dialog.
   * @param {ModalOptions} [options={}] Modal options.
   */
  constructor(_target = null, options = {}) {
    super(null, options);
    this.#setWidth(this.options.width);
    replaceContent(this.refs.content, this.options.content);

    this.listen(this.el, 'cancel', (event) => {
      const cancelEvent = this.emit('cancel');
      if (!this.options.closable || cancelEvent.defaultPrevented) event.preventDefault();
    });
    this.listen(this.el, 'close', () => {
      this._settleClose(this.#nativeClosingPresentations.shift());
    });
    this.listen(this.el, 'click', (event) => {
      if (!this.options.lightDismiss || event.target !== this.el || !isBackdropClick(this.el, event)) return;
      this.close();
    });
  }

  /**
   * Element the owned dialog is appended to. Overridden by subclasses that live inside a host
   * rather than at the document level.
   *
   * Called from `render()`, which the base constructor runs before any subclass field
   * initializers, so an override may read `this.options` but must not touch instance state.
   * @returns {Element}
   */
  mountTarget() {
    return overlayHost(this.options.scope);
  }

  /**
   * Puts the dialog on screen. Overridden by subclasses that open non-modally.
   * @returns {void}
   */
  _show() {
    this.el.showModal();
  }

  /**
   * Removes the dialog from its current presentation layer.
   * Subclasses may replace native dialog presentation while preserving Modal lifecycle events.
   * @param {string} [result=''] Native string return value.
   * @param {number} [presentation=this.#presentation] Presentation generation being hidden.
   * @returns {void}
   */
  _hide(result = '', presentation = this.#presentation) {
    this.#nativeClosingPresentations.push(presentation);
    try {
      this.el.close(result);
    } catch (error) {
      this.#nativeClosingPresentations.pop();
      throw error;
    }
  }

  /**
   * Shows a new presentation and gives it a generation of its own. Close events are queued by the
   * platform, so the generation lets an event from an earlier presentation expire harmlessly if
   * the same overlay has already reopened.
   * @returns {void}
   */
  _present() {
    this._show();
    this.#presentation += 1;
  }

  /**
   * Hides the current presentation and records which generation its queued close event belongs to.
   * @param {string} [result=''] Native string return value.
   * @returns {void}
   */
  _dismiss(result = '') {
    this._hide(result, this.#presentation);
  }

  /**
   * Reports whether the current presentation layer is visible.
   * @returns {boolean}
   */
  _isShown() {
    return this.el.open;
  }

  /**
   * Whether an incoming `close` event is a real dismissal.
   *
   * `close` is dispatched in a queued task, not synchronously. By the time it arrives the overlay
   * may have reopened or crossed presentation layers, so only the event for the current hidden
   * generation may settle state, emit lifecycle events, or trigger `destroyOnClose`.
   * @param {number|undefined} closingPresentation Presentation that produced the event, if known.
   * @returns {boolean}
   */
  _isRealClose(closingPresentation) {
    if (closingPresentation !== undefined && closingPresentation !== this.#presentation) return false;
    return !this._isShown();
  }

  /**
   * Settles one presentation's close without allowing a queued event to invalidate a newer one.
   * Popover-based subclasses call this directly; native dialog events arrive through the listener.
   * @param {number|undefined} closingPresentation Presentation that was hidden, if known.
   * @returns {boolean} Whether this event closed the current presentation.
   */
  _settleClose(closingPresentation) {
    if (!this._isRealClose(closingPresentation)) {
      if (closingPresentation !== undefined) this.#pendingResults.delete(closingPresentation);
      return false;
    }
    this.el.dataset.state = 'closed';
    delete this.el.dataset.zxOverlayOrder;
    const pending = closingPresentation === undefined
      ? undefined
      : this.#pendingResults.get(closingPresentation);
    if (closingPresentation !== undefined) this.#pendingResults.delete(closingPresentation);
    const result = pending ? pending.result : (this.el.returnValue || undefined);
    this.emit('close', { result });
    if (this.options.destroyOnClose && !this.#destroying) this.destroy();
    return true;
  }

  /**
   * Creates the owned native dialog.
   * @returns {HTMLDialogElement}
   */
  render() {
    const dialog = /** @type {HTMLDialogElement} */ (h('dialog', {
      class: 'zx-modal'
    }, h('div', { class: 'zx-modal__content', ref: 'content' })));
    dialog.dataset.state = 'closed';
    this.mountTarget().append(dialog);
    return dialog;
  }

  /**
   * Opens the modal in the browser top layer.
   * @returns {this}
   * @fires Modal#open
   */
  open() {
    if (this.isOpen()) return this;
    const host = this.mountTarget();
    if (this.el.parentElement !== host) host.append(this.el);
    this.el.dataset.zxOverlayOrder = String(nextOverlayOrder());
    this.el.returnValue = '';
    try {
      this._present();
    } catch (error) {
      delete this.el.dataset.zxOverlayOrder;
      throw error;
    }
    this.el.dataset.state = 'open';
    this.emit('open');
    return this;
  }

  /**
   * Closes the modal with an optional result.
   * @param {unknown} [result] Result included in the close event.
   * @returns {this}
   */
  close(result) {
    if (!this.isOpen()) return this;
    const presentation = this.#presentation;
    this.#pendingResults.set(presentation, { result });
    try {
      this._dismiss(typeof result === 'string' ? result : '');
    } catch (error) {
      this.#pendingResults.delete(presentation);
      throw error;
    }
    return this;
  }

  /**
   * Replaces the modal content without interpreting strings as HTML.
   * @param {Node|string|number|{toElement: () => Node|null}|null} content Content to display.
   * @returns {this}
   */
  setContent(content) {
    replaceContent(this.refs.content, content);
    return this;
  }

  /**
   * Reports whether the native dialog is open.
   * @returns {boolean}
   */
  isOpen() {
    return this._isShown();
  }

  /**
   * Closes and removes the owned dialog. Safe to call repeatedly.
   * @returns {void}
   */
  destroy() {
    if (this.#destroying) return;
    this.#destroying = true;
    if (this.isOpen()) this._dismiss();
    super.destroy();
  }

  /** @param {string|number} width @returns {void} */
  #setWidth(width) {
    if (typeof width === 'number' && Number.isFinite(width)) {
      this.el.style.inlineSize = `${Math.max(0, width)}px`;
    } else {
      this.el.style.inlineSize = String(width ?? 'auto');
    }
  }
}

/**
 * Fired after the modal enters the top layer.
 * @event Modal#open
 * @type {CustomEvent<Record<string, never>>}
 */

/**
 * Fired after the native dialog closes.
 * @event Modal#close
 * @type {CustomEvent<{result: unknown}>}
 */

/**
 * Fired when Escape requests cancellation. Preventing it keeps the modal open.
 * @event Modal#cancel
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

/** @param {HTMLDialogElement} dialog @param {MouseEvent} event @returns {boolean} */
function isBackdropClick(dialog, event) {
  const rect = dialog.getBoundingClientRect();
  return event.clientX < rect.left || event.clientX > rect.right ||
    event.clientY < rect.top || event.clientY > rect.bottom;
}

/** @returns {number} */
function nextOverlayOrder() {
  const orders = Array.from(document.querySelectorAll('[data-zx-overlay-order]'), (element) =>
    Number(element.getAttribute('data-zx-overlay-order')) || 0
  );
  return Math.max(0, ...orders) + 1;
}
