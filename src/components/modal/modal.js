import { Component } from '../../core/component.js';
import { h } from '../../core/dom.js';
import { overlayHost } from '../../core/overlay-host.js';

/**
 * Controls initial focus may be placed on: what a reader reaches with Tab, rather than everything
 * the platform will focus programmatically.
 */
const FOCUSABLE_SELECTOR = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled])', 'select:not([disabled])',
  'textarea:not([disabled])', '[contenteditable="true"]', '[tabindex]:not([tabindex="-1"])'
].join(',');

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
 *
 * Accessibility is the platform's wherever the platform has an answer. The root is a real
 * `<dialog>` and `_show()` presents it with `showModal()`, so focus containment, the inertness of
 * everything behind it, Escape, the top layer and the implicit `dialog` role all come from the
 * browser — there is no hand-written focus trap here, and adding one on top of `:modal` would be
 * two traps fighting over the same Tab key. What the platform leaves undone is the rest of this
 * class's accessibility work: it stops initial focus at the panel instead of the first control,
 * and it restores focus to the opener only for its own native presentation, not for the popover
 * one a non-modal subclass uses.
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
  /** @type {Element|null} Element that had focus when the overlay was opened. */
  #opener = null;

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
    /*
     * One listener for every close path, because `close` is the one event all four converge on:
     * a footer button and a programmatic `close()` go through `_dismiss()`, Escape and a native
     * dismissal arrive as the platform's own `close`, and light dismiss calls `close()` itself.
     * A subclass that traps focus registers its own restore after this one and so wins, which is
     * what keeps `Sheet`'s trap authoritative over its own capture.
     */
    this.on('close', () => this.#restoreFocus());
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
    this.#syncModality();
  }

  /**
   * Mirrors the presentation's real modality onto the panel as `aria-modal`.
   *
   * Asked of the platform (`:modal`) rather than of an option, so it stays true through every
   * presentation a subclass chooses: `showModal()` is modal, a popover or an in-flow `show()` is
   * not, and a sheet that moves between them is re-answered when it is presented again. The
   * `<dialog>` element already carries the implicit `dialog` role and, while `:modal`, the
   * implicit modal semantics — the attribute states them for assistive technology that reads the
   * markup rather than the top-layer state.
   * @returns {void}
   */
  #syncModality() {
    if (this.el.matches(':modal')) this.el.setAttribute('aria-modal', 'true');
    else if (this.el.getAttribute('aria-modal') === 'true') this.el.removeAttribute('aria-modal');
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
    /*
     * Only the flag this class raised. A subclass presenting non-modally writes
     * `aria-modal="false"` and owns that value across its own presentations.
     */
    if (this.el.getAttribute('aria-modal') === 'true') this.el.removeAttribute('aria-modal');
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
   * Returns focus to whatever held it when the overlay opened.
   *
   * A closing `<dialog>` restores focus itself, but only for its own native presentation and only
   * while the opener is still where it was; doing it here covers the popover presentation a
   * non-modal subclass uses, and covers `destroyOnClose`, which takes the opener's document
   * position out from under the platform's own restore.
   * @returns {void}
   */
  #restoreFocus() {
    const opener = /** @type {HTMLElement|null} */ (this.#opener);
    this.#opener = null;
    if (opener?.isConnected && typeof opener.focus === 'function') opener.focus();
  }

  /**
   * Places initial focus inside the panel.
   *
   * `showModal()` focuses an `autofocus` control when the content declares one and otherwise stops
   * at the dialog element, which leaves a reader one Tab short of the first control. This keeps
   * that preference — so a `Dialog` footer button marked `autofocus` still wins — and then falls
   * through to the first focusable descendant, with the panel itself as the last resort so focus
   * is never left outside the overlay.
   * @returns {void}
   */
  _focusInitial() {
    if (!this.isOpen()) return;
    const target = initialFocusTarget(this.el);
    if (target) {
      target.focus();
      return;
    }
    // A panel holding nothing focusable has to take focus itself, and is made focusable only for
    // that: `tabindex="-1"` is programmatic focus, so it adds nothing to the Tab order.
    const panel = /** @type {HTMLElement} */ (this.el);
    if (!panel.hasAttribute('tabindex')) panel.setAttribute('tabindex', '-1');
    panel.focus();
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
    /*
     * Captured before anything is presented, so it is the element the reader was actually on
     * rather than whatever the overlay is about to focus. A subclass that traps focus before
     * delegating here has already moved it and restores its own capture afterwards.
     */
    this.#opener = document.activeElement instanceof Element ? document.activeElement : null;
    const host = this.mountTarget();
    if (this.el.parentElement !== host) host.append(this.el);
    this.el.dataset.zxOverlayOrder = String(nextOverlayOrder());
    this.el.returnValue = '';
    try {
      this._present();
    } catch (error) {
      delete this.el.dataset.zxOverlayOrder;
      // Nothing was presented, so nothing will close; a capture left behind would outlive its open.
      this.#opener = null;
      throw error;
    }
    this.el.dataset.state = 'open';
    this.emit('open');
    // Deferred by one microtask: the platform's own focusing step runs as part of presenting, and
    // this has to be the one that settles, not the one it overwrites.
    queueMicrotask(() => this._focusInitial());
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
 * Picks the control initial focus belongs on inside an overlay panel: an `autofocus` control when
 * the content named one, the first focusable descendant otherwise, and null when the panel holds
 * neither and must take focus itself.
 *
 * Candidates in a hidden, `aria-hidden` or `inert` subtree are skipped, because `focus()` on one
 * is a silent no-op: a `Dialog` whose header close button is hidden by `closable: false`, or whose
 * other registered views sit hidden in the same body, would otherwise "focus" nothing at all and
 * leave the reader with no way into the overlay.
 * @param {Element} root Overlay panel.
 * @returns {HTMLElement|null}
 */
export function initialFocusTarget(root) {
  const declared = root.querySelector('[autofocus]:not([disabled])');
  if (declared && isFocusable(declared, root)) return /** @type {HTMLElement} */ (declared);
  for (const candidate of root.querySelectorAll(FOCUSABLE_SELECTOR)) {
    if (isFocusable(candidate, root)) return /** @type {HTMLElement} */ (candidate);
  }
  return null;
}

/**
 * Whether a candidate can take focus from where it sits inside the panel.
 *
 * Duck-typed on `focus` rather than tested against `HTMLElement`, so a focusable SVG or MathML
 * element inside the panel is a candidate rather than a silently skipped one.
 * @param {Element} element Candidate found by the focusable selector.
 * @param {Element} root Panel the search is bounded by.
 * @returns {boolean}
 */
function isFocusable(element, root) {
  if (typeof (/** @type {HTMLElement} */ (element).focus) !== 'function') return false;
  for (let node = /** @type {Element|null} */ (element); node; node = node.parentElement) {
    if (/** @type {HTMLElement} */ (node).hidden) return false;
    if (node.getAttribute('aria-hidden') === 'true') return false;
    if (node.hasAttribute('inert')) return false;
    if (node === root) break;
  }
  return true;
}

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
