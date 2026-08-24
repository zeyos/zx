import { STEP, STEP_LARGE, dragAxis, resolveSize } from '../../core/drag-axis.js';
import { focusTrap } from '../../core/keyboard.js';
import { h } from '../../core/dom.js';
import { clamp } from '../../core/util.js';
import { Dialog } from '../dialog/dialog.js';

/** @typedef {'start'|'end'|'top'|'bottom'} SheetSide */
/** @typedef {true|'trap-focus'|false} SheetModality */
/** @typedef {'dim'|'blur'|'none'} SheetBackdrop */

const SIDES = new Set(['start', 'end', 'top', 'bottom']);
const BACKDROPS = new Set(['dim', 'blur', 'none']);
/**
 * Which way a positive pointer delta grows the sheet. A sheet on the `end` edge grows as the
 * pointer moves left, so its handle counts backwards.
 */
const GROW_SIGN = Object.freeze({ start: 1, end: -1, top: 1, bottom: -1 });

/**
 * @typedef {Object} SheetOptions
 * @property {SheetSide} [side='end'] Edge the sheet is anchored to. Logical, so `start` and `end`
 *   follow the writing direction.
 * @property {SheetModality} [modal=true] `true` traps focus, locks page scroll, and blocks pointer
 *   interaction behind a backdrop; `'trap-focus'` traps focus only; `false` leaves the page fully
 *   interactive. Only `true` renders a backdrop — that is what makes the other two non-modal.
 * @property {SheetBackdrop} [backdrop='dim'] Backdrop treatment, applied only when `modal` is
 *   `true`. `'blur'` reads `--zx-overlay-blur`.
 * @property {string|number|null} [size=null] Size along the sheet's own axis — width for
 *   `start`/`end`, height for `top`/`bottom`. A number is pixels, a string is any CSS length. Null
 *   keeps the per-side default.
 * @property {boolean} [closeButton=true] Whether the header shows its close control. Independent of
 *   `closable`, so a sheet can offer Escape without an ✕, or the reverse.
 * @property {boolean} [resizable=false] Whether the inner edge may be dragged to resize the sheet.
 * @property {number} [min=160] Smallest the sheet may be dragged to, in pixels.
 * @property {number|null} [max=null] Largest it may be dragged to; null means the viewport.
 * @property {boolean|'auto'} [handle='auto'] Whether to show a grab handle on the inner edge.
 *   `'auto'` shows one for `top` and `bottom` sheets, which is what makes them read as drawers.
 * @property {Array<number|string>|null} [snap=null] Detents the sheet settles on. A number at or
 *   below 1 is a fraction of the viewport along the sheet's axis, anything larger is pixels, and a
 *   string is any CSS length `resolveSize` understands (`'320px'`, `'90%'`).
 * @property {string} [title=''] Header title.
 * @property {Node|string|number|{toElement: () => Node|null}|null} [content=null] Body content.
 * @property {import('../dialog/dialog.js').DialogButton[]} [buttons=[]] Footer buttons.
 * @property {boolean} [closable=true] Whether Escape may close the sheet.
 * @property {boolean} [lightDismiss=true] Whether a click outside closes the sheet — the backdrop
 *   when modal, a document-level pointer press when not.
 * @property {boolean} [destroyOnClose=false] Whether to destroy the sheet after it closes.
 * @property {(event: CustomEvent<Record<string, never>>) => void} [onopen] Open event listener.
 * @property {(event: CustomEvent<{result: unknown}>) => void} [onclose] Close event listener.
 * @property {(event: CustomEvent<Record<string, never>>) => void} [oncancel] Cancel event listener.
 * @property {(event: CustomEvent<{size: number, ratio: number}>) => void} [onresize] Resize listener.
 * @property {(event: CustomEvent<{docked: boolean, dock: import('../dock/dock.js').Dock|null}>) => void} [ondockchange] Dock-state listener.
 */

/**
 * Edge-anchored surface: a Dialog that attaches to one side of the viewport instead of floating in
 * the middle. One primitive covers both side sheets and mobile drawers; only the edge differs.
 *
 * Extends `Dialog` rather than reimplementing it, so the header, footer buttons, switchable views,
 * and focus restoration all come from the same structured-dialog foundation.
 *
 * Modality is a three-way choice rather than a boolean because the three real behaviours do not
 * collapse into two: a modal sheet delegates focus containment, page inertness, and Escape to the
 * browser via `showModal()`; the other two open with `show()` and re-implement only what they still
 * want. That is also why `backdrop` applies only to `modal: true` — `::backdrop` does not render
 * for a non-modal dialog, and painting a fake one would make a sheet look blocking while it is not.
 * @fires Sheet#open
 * @fires Sheet#close
 * @fires Sheet#cancel
 * @fires Sheet#resize
 * @fires Sheet#dockchange
 */
export class Sheet extends Dialog {
  static cssName = 'sheet';

  /** @type {Readonly<SheetOptions>} */
  static defaults = {
    side: 'end',
    modal: true,
    backdrop: 'dim',
    size: null,
    closeButton: true,
    resizable: false,
    min: 160,
    max: null,
    handle: 'auto',
    snap: null,
    // A sheet is a transient surface, so dismissal is on by default — Modal's is not.
    lightDismiss: true
  };

  /** @type {{activate: () => void, deactivate: () => void}|null} */
  #trap = null;
  /** @type {ReturnType<typeof dragAxis>|null} */
  #drag = null;
  /** Size when the current drag began, in pixels. */
  #dragStart = 0;

  /**
   * Creates an edge-anchored sheet.
   * @param {Element|string|null} [_target=null] Ignored; Sheet always owns its root.
   * @param {SheetOptions} [options={}] Sheet options.
   */
  constructor(_target = null, options = {}) {
    super(null, options);
    /*
     * Assigned here rather than declared as a class field: `render()` runs inside the base
     * constructor, before field initializers, and `mountTarget()` is called from there. A declared
     * field would be undefined at best and a private one would throw.
     */
    this._dock = null;
    this._handoff = false;
    this.setSide(this.options.side);
    this.el.dataset.backdrop = BACKDROPS.has(this.options.backdrop) ? this.options.backdrop : 'dim';
    this.el.dataset.modality = modality(this.options.modal);
    this.refs.close.hidden = !this.options.closeButton;

    if (this.options.modal !== true) {
      /*
       * Escape and outside-click are free for a modal dialog and absent for a non-modal one: the
       * browser only wires `cancel` for `showModal()`, and there is no `::backdrop` to click.
       */
      this.listen(this.el, 'keydown', (event) => {
        const keyboardEvent = /** @type {KeyboardEvent} */ (event);
        if (keyboardEvent.key !== 'Escape' || !this.options.closable || this._dock) return;
        keyboardEvent.preventDefault();
        if (!this.emit('cancel').defaultPrevented) this.close();
      });
      if (this.options.lightDismiss) {
        this.listen(document, 'pointerdown', (event) => {
          const target = /** @type {Node} */ (event.target);
          if (!this.isOpen() || this._dock || this.el.contains(target)) return;
          this.close();
        });
      }
    }

    /*
     * Registered after Dialog's own restore listener, so focus lands on the opener either way:
     * the trap captured the same element, because `open()` activates it before the sheet shows.
     */
    this.on('close', () => this.#trap?.deactivate());

    if (this.#wantsHandle()) this.#buildHandle();
  }

  /** @returns {boolean} */
  #wantsHandle() {
    const handle = this.options.handle;
    const side = this.getSide();
    const shown = handle === true || (handle === 'auto' && (side === 'top' || side === 'bottom'));
    return Boolean(this.options.resizable) || Array.isArray(this.options.snap) || shown;
  }

  /**
   * Adds the grab handle on the inner edge and wires it to the shared axis-drag engine.
   *
   * Resizing, moving between detents, and swiping to dismiss are one gesture, not three: all of
   * them are "the sheet got bigger or smaller", and which one a drag turns out to be is decided
   * once, when the pointer settles.
   * @returns {void}
   */
  #buildHandle() {
    const vertical = this.getSide() === 'top' || this.getSide() === 'bottom';
    const handle = h('div', {
      class: 'zx-sheet__handle',
      ref: 'handle',
      role: 'separator',
      tabindex: 0,
      ariaOrientation: vertical ? 'horizontal' : 'vertical',
      ariaLabel: this._message('sheet.resize', 'Resize sheet')
    });
    this.el.append(handle);
    this.refs.handle = handle;
    this.#syncHandleAria();

    this.#drag = dragAxis(handle, {
      orientation: vertical ? 'vertical' : 'horizontal',
      // While docked the dock's own divider owns resizing, so the sheet's handle stands down.
      disabled: () => this.isDocked(),
      onStart: () => {
        this.#dragStart = this.getSize();
        this.el.dataset.dragging = 'true';
      },
      onMove: (delta) => this.#dragTo(delta, false),
      onEnd: (delta, moved) => {
        delete this.el.dataset.dragging;
        if (moved) this.#dragTo(delta, true);
      },
      onStep: (direction, large) => {
        /*
         * `#dragTo` applies the grow sign itself, so the step goes in as a raw pointer delta:
         * ArrowLeft on an `end` sheet is a negative delta, which that sign turns into growth.
         */
        this.#dragStart = this.getSize();
        this.#dragTo(direction * (large ? STEP_LARGE : STEP), true);
      }
    });
  }

  /**
   * Applies a pointer delta as a new size, and on settle decides what the gesture meant.
   * @param {number} delta Pixels travelled along the axis since the drag began.
   * @param {boolean} settle Whether the pointer has been released.
   * @returns {void}
   */
  #dragTo(delta, settle) {
    const total = this.#axisTotal();
    const { min, max: bound } = this.#bounds(total);
    /*
     * A sheet that is neither `resizable` nor snapping still has a draggable handle — that is what
     * makes a drawer dismissible — but the gesture may only take size away, never add it. Growing
     * one by dragging when nothing asked for resizing would contradict `resizable: false`.
     */
    const free = Boolean(this.options.resizable) || this.#detents(total).length > 0;
    const max = free ? bound : Math.min(bound, this.#dragStart);
    const next = clamp(this.#dragStart + delta * GROW_SIGN[this.getSide()], 0, max);
    if (!settle) {
      // Below the minimum the sheet still follows the pointer, so a dismissing swipe is visible
      // rather than pinned in place until it suddenly disappears.
      this._applySize(next);
      this.#syncHandleAria();
      return;
    }
    if (this.options.closable && next < min / 2) {
      this._applySize(this.#dragStart);
      this.close();
      return;
    }
    const detents = this.#detents(total);
    const settled = detents.length > 0 ? nearest(next, detents) : next;
    this._applySize(clamp(settled, min, max));
    this.#syncHandleAria();
    this.emit('resize', { size: this.getSize(), ratio: total > 0 ? this.getSize() / total : 0 });
  }

  /**
   * Moves to one of the configured detents.
   * @param {number|string} target Detent index, or one of the `snap` values.
   * @returns {this}
   * @fires Sheet#resize
   */
  snapTo(target) {
    const total = this.#axisTotal();
    const detents = this.#detents(total);
    if (detents.length === 0) return this;
    const size = typeof target === 'number' && Number.isInteger(target) && target >= 0
      && target < detents.length
      ? detents[target]
      : resolveDetent(target, total);
    if (!Number.isFinite(size)) return this;
    const { min, max } = this.#bounds(total);
    this._applySize(clamp(size, min, max));
    this.#syncHandleAria();
    this.emit('resize', { size: this.getSize(), ratio: total > 0 ? this.getSize() / total : 0 });
    return this;
  }

  /**
   * Returns the sheet's current size along its own axis, in pixels.
   * @returns {number}
   */
  getSize() {
    const rect = this.el.getBoundingClientRect();
    const vertical = this.getSide() === 'top' || this.getSide() === 'bottom';
    return vertical ? rect.height : rect.width;
  }

  /**
   * Resolves a translated string, falling back to English when no translator knows the key.
   * @param {string} key Message key.
   * @param {string} fallback English default.
   * @returns {string}
   */
  _message(key, fallback) {
    const message = this.msg(key);
    return message === key ? fallback : message;
  }

  /** @returns {number} */
  #axisTotal() {
    const vertical = this.getSide() === 'top' || this.getSide() === 'bottom';
    return vertical ? window.innerHeight : window.innerWidth;
  }

  /** @param {number} total @returns {{min: number, max: number}} */
  #bounds(total) {
    const detents = this.#detents(total);
    const declared = Math.max(0, Number(this.options.min) || 0);
    const max = this.options.max == null ? total : Math.min(total, Number(this.options.max) || total);
    // With detents the smallest one is the real floor; `min` still applies underneath it.
    const min = detents.length > 0 ? Math.max(declared, Math.min(...detents)) : declared;
    return { min: Math.min(min, max), max };
  }

  /** @param {number} total @returns {number[]} */
  #detents(total) {
    const snap = this.options.snap;
    if (!Array.isArray(snap)) return [];
    return snap.map((value) => resolveDetent(value, total))
      .filter((value) => Number.isFinite(value) && value > 0)
      .sort((a, b) => a - b);
  }

  /** @returns {void} */
  #syncHandleAria() {
    const handle = this.refs.handle;
    if (!handle) return;
    const total = this.#axisTotal();
    const { min, max } = this.#bounds(total);
    handle.setAttribute('aria-valuenow', String(Math.round(this.getSize())));
    handle.setAttribute('aria-valuemin', String(Math.round(min)));
    handle.setAttribute('aria-valuemax', String(Math.round(max)));
  }

  /**
   * Where the dialog lives: the owning dock while adopted, the document otherwise.
   * @returns {Element}
   */
  mountTarget() {
    return this._dock?.el ?? document.body;
  }

  /**
   * Reports whether a dock currently owns this sheet's positioning.
   * @returns {boolean}
   */
  isDocked() {
    return Boolean(this._dock);
  }

  /**
   * Hands positioning to a dock, or takes it back. Called by `Dock.adopt()` and `Dock.release()`;
   * applications go through those rather than here.
   * @param {{el: Element}|null} dock Owning dock, or null to float again.
   * @returns {void}
   * @fires Sheet#dockchange
   */
  _setDock(dock) {
    if (this._dock === dock) return;
    this._dock = dock ?? null;
    this.el.toggleAttribute('data-docked', Boolean(this._dock));
    this._rehost();
    this.emit('dockchange', { docked: Boolean(this._dock), dock: this._dock });
  }

  /**
   * Moves the dialog to its current mount and, when it was open, reopens it there.
   *
   * The close is unavoidable — a dialog cannot cross between the top layer and the flow while
   * open — but it is invisible: `_isRealClose()` drops the stale event, and reopening bypasses
   * `open()` so no lifecycle event is emitted for what is only a change of address.
   * @returns {void}
   */
  _rehost() {
    const wasOpen = this.isOpen();
    if (wasOpen) {
      this._handoff = true;
      /** @type {HTMLDialogElement} */ (this.el).close();
    }
    this.mountTarget().append(this.el);
    if (!wasOpen) return;
    this.el.returnValue = '';
    this._show();
    this.el.dataset.state = 'open';
    if (this._dock) delete /** @type {HTMLElement} */ (this.el).dataset.zxOverlayOrder;
    else this.el.dataset.zxOverlayOrder = String(nextOverlayOrder());
  }

  /**
   * Drops the stale `close` a re-hosting handoff leaves behind.
   * @returns {boolean}
   */
  _isRealClose() {
    if (!this._handoff) return true;
    this._handoff = false;
    return false;
  }

  /**
   * Opens the sheet, trapping focus first where the modality asks for it.
   * @returns {this}
   * @fires Modal#open
   */
  open() {
    if (this.isOpen()) return this;
    if (this.options.modal === 'trap-focus') {
      this.#trap ??= focusTrap(this.el);
      this.#trap.activate();
    }
    super.open();
    // The handle is built while the sheet is still closed, where it measures zero; only now is
    // there a real size to report to a screen reader.
    this.#syncHandleAria();
    return this;
  }

  /**
   * Closes the sheet with an optional result.
   * @param {unknown} [result] Result included in the close event.
   * @returns {this}
   */
  close(result) {
    this.#trap?.deactivate();
    return super.close(result);
  }

  /**
   * Moves the sheet to another edge. Takes effect immediately, open or closed.
   * @param {SheetSide} side Edge to anchor to.
   * @returns {this}
   */
  setSide(side) {
    this.el.dataset.side = SIDES.has(side) ? side : 'end';
    return this;
  }

  /**
   * Returns the edge the sheet is anchored to.
   * @returns {SheetSide}
   */
  getSide() {
    return /** @type {SheetSide} */ (this.el.dataset.side);
  }

  /**
   * Resizes the sheet along its own axis.
   * @param {string|number|null} size CSS length, pixel number, or null for the per-side default.
   * @returns {this}
   */
  setSize(size) {
    this._applySize(size);
    return this;
  }

  /**
   * Reports whether focus containment is active.
   * @returns {boolean}
   */
  isModal() {
    return this.options.modal === true;
  }

  /**
   * Sizes the sheet along whichever axis its side implies, by custom property rather than a fixed
   * dimension so the per-side CSS default survives a null.
   *
   * Runs from `Dialog`'s constructor, before this class's field initializers — DOM only.
   * @param {string|number|null} size CSS length, pixel number, or null.
   * @returns {void}
   */
  _applySize(size) {
    // Modal wrote an inline width and Dialog would write a preset one; neither applies to a sheet,
    // and an inline dimension would beat the side rules in the stylesheet.
    this.el.style.removeProperty('inline-size');
    this.el.style.removeProperty('block-size');
    const value = normalizeSize(size);
    if (value === null) this.el.style.removeProperty('--zx-sheet-size');
    else this.el.style.setProperty('--zx-sheet-size', value);
  }

  /**
   * Opens the sheet modally or not, as `modal` asks.
   * @returns {void}
   */
  _show() {
    if (this.options.modal === true && !this._dock) {
      super._show();
      return;
    }
    /** @type {HTMLDialogElement} */ (this.el).show();
  }

  /**
   * Releases the focus trap and the owned dialog.
   * @returns {void}
   */
  destroy() {
    this.#trap?.deactivate();
    this.#trap = null;
    this.#drag?.destroy();
    this.#drag = null;
    this._dock?._forget(this);
    this._dock = null;
    super.destroy();
  }
}

/**
 * Next free overlay order. Same bookkeeping `Modal` and `Dropdown` each carry a copy of; the three
 * should converge on one kernel helper.
 * @returns {number}
 */
function nextOverlayOrder() {
  const orders = Array.from(document.querySelectorAll('[data-zx-overlay-order]'), (element) =>
    Number(element.getAttribute('data-zx-overlay-order')) || 0);
  return Math.max(0, ...orders) + 1;
}

/**
 * Resolves one `snap` entry. A bare number at or below 1 is a fraction of the axis, which is the
 * convention every drawer library uses; everything else goes through `resolveSize`.
 * @param {number|string} value Detent.
 * @param {number} total Axis extent in pixels.
 * @returns {number}
 */
function resolveDetent(value, total) {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= 1) {
    return value * total;
  }
  return resolveSize(value, total);
}

/** @param {number} value @param {number[]} targets @returns {number} */
function nearest(value, targets) {
  let best = value;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const target of targets) {
    const distance = Math.abs(target - value);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = target;
    }
  }
  return best;
}

/** @param {SheetModality} value @returns {'modal'|'trap-focus'|'none'} */
function modality(value) {
  if (value === true) return 'modal';
  return value === 'trap-focus' ? 'trap-focus' : 'none';
}

/** @param {string|number|null|undefined} size @returns {string|null} */
function normalizeSize(size) {
  if (size === null || size === undefined || size === '') return null;
  if (typeof size === 'number') return Number.isFinite(size) ? `${Math.max(0, size)}px` : null;
  return String(size);
}

/**
 * Sheet resize event.
 * @event Sheet#resize
 * @type {CustomEvent<{size: number, ratio: number}>}
 */

/**
 * Sheet dock-state event.
 * @event Sheet#dockchange
 * @type {CustomEvent<{docked: boolean, dock: import('../dock/dock.js').Dock|null}>}
 */
