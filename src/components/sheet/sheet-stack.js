/** @typedef {import('./sheet.js').Sheet} Sheet */

/**
 * @typedef {Object} SheetStackOptions
 * @property {'stack'|'cascade'} [layout='stack'] How depth is expressed. `stack` slides each
 *   covered sheet back toward its edge and scales it down, leaving only the top one usable —
 *   the drill-down feel. `cascade` shifts each covered sheet clear of the ones in front so they
 *   sit side by side and all stay usable, which is what an ERP screen usually wants: the parent
 *   record stays readable while a line item is edited.
 * @property {number} [offset=24] Pixels a `stack` layout moves per depth step.
 * @property {number} [scale=0.04] How much a `stack` layout shrinks per depth step, as a fraction.
 * @property {number} [max=3] Depth at which a sheet stops being drawn. Deeper sheets stay open and
 *   in the stack; they are simply no longer visible behind the ones in front.
 * @property {(event: CustomEvent<{sheet: Sheet, depth: number}>) => void} [onpush] Push listener.
 * @property {(event: CustomEvent<{sheet: Sheet}>) => void} [onpop] Pop listener.
 */

/**
 * An ordered group of Sheets that read as one drill-down.
 *
 * Deliberately tiny, because the browser already does the hard part: nested dialogs stack in the
 * top layer by open order, so there is no z-index bookkeeping here, and Escape closes only the
 * topmost, so unwinding one level at a time is native behaviour rather than something to
 * implement. What is left is bookkeeping — which sheet is at which depth — written onto the
 * elements as `data-depth` and `--zx-sheet-depth` for CSS to interpret.
 *
 * Owns no element of its own, so it is a controller rather than a `Component`: there is nothing
 * to render, only sheets to arrange.
 *
 * @fires SheetStack#push
 * @fires SheetStack#pop
 */
export class SheetStack extends EventTarget {
  /** @type {Readonly<SheetStackOptions>} */
  static defaults = Object.freeze({
    layout: 'stack',
    offset: 24,
    scale: 0.04,
    max: 3
  });

  /** @type {Sheet[]} Bottom first; the last entry is the top of the stack. */
  #sheets = [];
  /** @type {WeakMap<Sheet, () => void>} */
  #closers = new WeakMap();
  #destroyed = false;

  /**
   * Creates a sheet stack.
   * @param {SheetStackOptions} [options={}] Stack options.
   */
  constructor(options = {}) {
    super();
    const merged = { ...SheetStack.defaults, ...(options && typeof options === 'object' ? options : {}) };
    for (const [key, value] of Object.entries(merged)) {
      if (!/^on[a-z]/.test(key) || typeof value !== 'function') continue;
      this.on(key.slice(2), value);
      delete merged[key];
    }
    this.options = Object.freeze(merged);
  }

  /**
   * Adds a sheet to the top of the stack, opening it if it is closed. A sheet already in the stack
   * is raised rather than added twice.
   * @param {Sheet} sheet Sheet to push.
   * @returns {this}
   * @fires SheetStack#push
   */
  push(sheet) {
    if (!sheet || typeof sheet.open !== 'function') throw new TypeError('SheetStack.push expects a Sheet');
    const existing = this.#sheets.indexOf(sheet);
    if (existing !== -1) this.#sheets.splice(existing, 1);
    this.#sheets.push(sheet);

    if (!this.#closers.has(sheet)) {
      // A sheet dismissed by Escape, its close button, or its own code leaves the stack too.
      const onClose = () => this.#drop(sheet);
      this.#closers.set(sheet, onClose);
      sheet.on('close', onClose);
    }
    if (!sheet.isOpen()) sheet.open();
    this.#sync();
    this.#emit('push', { sheet, depth: 0 });
    return this;
  }

  /**
   * Closes the top sheet and removes it from the stack.
   *
   * The removal is synchronous while the close is not — a dialog dispatches `close` in a queued
   * task — so the stack updates itself here rather than waiting for the event. The close listener
   * is left to handle the other direction: a sheet dismissed by Escape or its own button.
   * @returns {Sheet|null} The sheet that was closed, or null on an empty stack.
   * @fires SheetStack#pop
   */
  pop() {
    const sheet = this.top();
    if (!sheet) return null;
    this.#remove(sheet);
    sheet.close();
    return sheet;
  }

  /**
   * Closes everything above a sheet, leaving it on top.
   * @param {Sheet} sheet Sheet to return to.
   * @returns {this}
   */
  popTo(sheet) {
    const index = this.#sheets.indexOf(sheet);
    if (index === -1) return this;
    while (this.#sheets.length > index + 1) this.pop();
    return this;
  }

  /**
   * Closes every sheet, from the top down.
   * @returns {this}
   */
  clear() {
    while (this.#sheets.length > 0) this.pop();
    return this;
  }

  /**
   * The sheet currently on top.
   * @returns {Sheet|null}
   */
  top() {
    return this.#sheets[this.#sheets.length - 1] ?? null;
  }

  /**
   * How many sheets the stack holds.
   * @returns {number}
   */
  size() {
    return this.#sheets.length;
  }

  /**
   * The sheets, bottom first.
   * @returns {Sheet[]}
   */
  sheets() {
    return [...this.#sheets];
  }

  /**
   * Whether a sheet is in this stack.
   * @param {Sheet} sheet Sheet to look for.
   * @returns {boolean}
   */
  has(sheet) {
    return this.#sheets.includes(sheet);
  }

  /**
   * Subscribes to a stack event.
   * @param {string} type Event name.
   * @param {(event: any) => void} fn Listener.
   * @returns {this}
   */
  on(type, fn) {
    this.addEventListener(type, fn);
    return this;
  }

  /**
   * Removes a stack event listener.
   * @param {string} type Event name.
   * @param {(event: any) => void} fn Listener.
   * @returns {this}
   */
  off(type, fn) {
    this.removeEventListener(type, fn);
    return this;
  }

  /**
   * Subscribes to one occurrence of a stack event.
   * @param {string} type Event name.
   * @param {(event: any) => void} fn Listener.
   * @returns {this}
   */
  once(type, fn) {
    this.addEventListener(type, fn, { once: true });
    return this;
  }

  /**
   * Empties the stack without closing anything. The sheets are not the stack's to destroy, so
   * they are simply released with their depth styling removed.
   * @returns {void}
   */
  destroy() {
    if (this.#destroyed) return;
    this.#destroyed = true;
    for (const sheet of this.#sheets) {
      const onClose = this.#closers.get(sheet);
      if (onClose) sheet.off('close', onClose);
      clearDepth(sheet);
    }
    this.#sheets = [];
  }

  /**
   * Handles a sheet that closed on its own. A sheet popped through `pop()` has already been
   * removed by the time its close event lands, so this is a no-op for that path.
   * @param {Sheet} sheet Sheet that closed.
   * @returns {void}
   */
  #drop(sheet) {
    if (this.#sheets.includes(sheet)) this.#remove(sheet);
  }

  /**
   * Takes a sheet out of the stack and re-numbers what is left.
   * @param {Sheet} sheet Sheet to remove.
   * @returns {void}
   * @fires SheetStack#pop
   */
  #remove(sheet) {
    const index = this.#sheets.indexOf(sheet);
    if (index === -1) return;
    this.#sheets.splice(index, 1);
    const onClose = this.#closers.get(sheet);
    if (onClose) sheet.off('close', onClose);
    this.#closers.delete(sheet);
    clearDepth(sheet);
    this.#sync();
    this.#emit('pop', { sheet });
  }

  /**
   * Writes each sheet's depth, and for a cascade the distance it must clear.
   * @returns {void}
   */
  #sync() {
    const { layout, offset, scale, max } = this.options;
    const cascade = layout === 'cascade';
    /** Cumulative extent of the sheets in front of the one being positioned. */
    let ahead = 0;

    // Top first, so `ahead` accumulates from the front of the stack backwards.
    for (let depth = 0; depth < this.#sheets.length; depth += 1) {
      const sheet = this.#sheets[this.#sheets.length - 1 - depth];
      const element = /** @type {HTMLElement} */ (sheet.el);
      element.dataset.stack = cascade ? 'cascade' : 'stack';
      element.dataset.depth = String(depth);
      element.style.setProperty('--zx-sheet-depth', String(depth));
      element.style.setProperty('--zx-sheet-stack-offset', `${Number(offset) || 0}px`);
      element.style.setProperty('--zx-sheet-stack-scale', String(Number(scale) || 0));
      element.toggleAttribute('data-stack-hidden', depth >= Math.max(1, Number(max) || 1));
      /*
       * A covered sheet in a drill-down is not just visually behind — it must leave the tab order
       * too. The browser does that for stacked *modal* dialogs on its own, but a non-modal stack
       * gets nothing, so the attribute is set either way.
       */
      element.inert = !cascade && depth > 0;
      if (cascade) {
        element.style.setProperty('--zx-sheet-depth-offset', `${ahead}px`);
        ahead += sheet.getSize();
      } else {
        element.style.removeProperty('--zx-sheet-depth-offset');
      }
    }
  }

  /**
   * @param {string} type
   * @param {Record<string, unknown>} detail
   * @returns {void}
   */
  #emit(type, detail) {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }
}

/**
 * Fired after a sheet is pushed onto the stack.
 * @event SheetStack#push
 * @type {CustomEvent<{sheet: Sheet, depth: number}>}
 */

/**
 * Fired after a sheet leaves the stack, however it was dismissed.
 * @event SheetStack#pop
 * @type {CustomEvent<{sheet: Sheet}>}
 */

/** @param {Sheet} sheet @returns {void} */
function clearDepth(sheet) {
  const element = /** @type {HTMLElement} */ (sheet.el);
  if (!element) return;
  delete element.dataset.stack;
  delete element.dataset.depth;
  element.removeAttribute('data-stack-hidden');
  element.inert = false;
  for (const property of [
    '--zx-sheet-depth', '--zx-sheet-stack-offset', '--zx-sheet-stack-scale', '--zx-sheet-depth-offset'
  ]) element.style.removeProperty(property);
}
