import { Component } from '../../core/component.js';
import { h } from '../../core/dom.js';

/**
 * @typedef {Object} ModalOptions
 * @property {Node|string|number|{toElement: () => Node|null}|null} [content=null] Modal content.
 * @property {string|number} [width='auto'] CSS width, or a pixel width when numeric.
 * @property {boolean} [closable=true] Whether Escape may close the modal.
 * @property {boolean} [lightDismiss=false] Whether a backdrop click closes the modal.
 * @property {boolean} [destroyOnClose=false] Whether to destroy the modal after it closes.
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
    destroyOnClose: false
  };

  #pendingResult;
  #hasPendingResult = false;
  #destroying = false;

  /**
   * Creates a modal appended to `document.body`.
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
      this.el.dataset.state = 'closed';
      delete this.el.dataset.zxOverlayOrder;
      const result = this.#hasPendingResult ? this.#pendingResult : (this.el.returnValue || undefined);
      this.#pendingResult = undefined;
      this.#hasPendingResult = false;
      this.emit('close', { result });
      if (this.options.destroyOnClose && !this.#destroying) this.destroy();
    });
    this.listen(this.el, 'click', (event) => {
      if (!this.options.lightDismiss || event.target !== this.el || !isBackdropClick(this.el, event)) return;
      this.close();
    });
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
    document.body.append(dialog);
    return dialog;
  }

  /**
   * Opens the modal in the browser top layer.
   * @returns {this}
   * @fires Modal#open
   */
  open() {
    if (this.isOpen()) return this;
    this.el.dataset.zxOverlayOrder = String(nextOverlayOrder());
    this.el.returnValue = '';
    try {
      this.el.showModal();
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
    this.#pendingResult = result;
    this.#hasPendingResult = true;
    this.el.close(typeof result === 'string' ? result : '');
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
    return this.el.open;
  }

  /**
   * Closes and removes the owned dialog. Safe to call repeatedly.
   * @returns {void}
   */
  destroy() {
    if (this.#destroying) return;
    this.#destroying = true;
    if (this.isOpen()) this.el.close();
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
