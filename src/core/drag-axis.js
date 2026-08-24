// @ts-check

/** Pixels an arrow key moves a handle. */
export const STEP = 16;
/** Pixels a shifted arrow key moves a handle. */
export const STEP_LARGE = 64;

/**
 * @typedef {Object} DragAxisOptions
 * @property {'horizontal'|'vertical'} orientation Axis the handle moves along. `horizontal` reads
 *   `clientX`, `vertical` reads `clientY`.
 * @property {(event: PointerEvent) => boolean|void} [onStart] Called on pointer-down before the
 *   drag begins. Return `false` to refuse it — the usual reason being that there is nothing to
 *   resize on either side of the handle.
 * @property {(delta: number) => void} onMove Called at most once per frame with the signed pixel
 *   distance travelled along the axis since pointer-down.
 * @property {(delta: number, moved: boolean) => void} [onEnd] Called once the pointer is released.
 *   `moved` is false for a press that never travelled, which is a click rather than a drag.
 * @property {(direction: -1|1, large: boolean) => void} [onStep] Called for an arrow key along the
 *   axis. `large` is true while Shift is held.
 * @property {(edge: 'min'|'max') => void} [onJump] Called for Home and End.
 * @property {() => void} [onActivate] Called for Enter and Space, which components use for the
 *   collapse affordance a splitter is expected to offer.
 * @property {() => boolean} [disabled] Consulted before every interaction.
 */

/**
 * @typedef {Object} DragAxisController
 * @property {() => boolean} isDragging Whether a drag is in flight.
 * @property {() => void} cancel Ends any drag in flight without reporting it.
 * @property {() => void} destroy Removes listeners and cancels any drag in flight.
 */

/**
 * Pointer and keyboard mechanics for anything dragged along one axis — a split divider, a dock
 * divider, the resizable edge of a sheet.
 *
 * Deliberately knows nothing about sizes. It reports the signed distance travelled and leaves
 * every consumer to do its own arithmetic, because the three that need it disagree about what a
 * drag means: a split view moves one boundary, a dock moves size between two neighbours, and a
 * sheet grows in the opposite direction depending on which edge it is attached to. What they do
 * share is the fiddly part — pointer capture that survives the pointer leaving the handle, one
 * write per frame however fast the pointer reports, telling a click apart from a zero-distance
 * drag, and the WAI-ARIA keyboard map.
 *
 * @param {Element} handle Element the pointer grabs; also the keyboard target.
 * @param {DragAxisOptions} options Axis and callbacks.
 * @returns {DragAxisController}
 */
export function dragAxis(handle, options) {
  if (!handle) throw new TypeError('dragAxis requires a handle element');
  if (typeof options?.onMove !== 'function') throw new TypeError('dragAxis requires an onMove callback');

  const vertical = options.orientation === 'vertical';
  const controller = new AbortController();
  const { signal } = controller;

  let dragging = false;
  /** @type {number|null} */
  let pointerId = null;
  let startClient = 0;
  let client = 0;
  let moved = false;
  /** Handle of the frame a pending update is scheduled in; `0` if none. */
  let frame = 0;

  /** @param {PointerEvent} event @returns {number} */
  const axis = (event) => (vertical ? event.clientY : event.clientX);

  /** @returns {boolean} */
  const blocked = () => Boolean(options.disabled?.());

  /** @returns {void} */
  const releasePointer = () => {
    const id = pointerId;
    pointerId = null;
    if (id === null) return;
    try {
      /** @type {HTMLElement} */ (handle).releasePointerCapture(id);
    } catch {
      // The capture is already gone once the pointer was cancelled or the node was detached.
    }
  };

  /** @returns {void} */
  const cancelFrame = () => {
    if (frame === 0) return;
    cancelAnimationFrame(frame);
    frame = 0;
  };

  /** @returns {void} */
  const finish = () => {
    dragging = false;
    moved = false;
    cancelFrame();
    releasePointer();
  };

  handle.addEventListener('pointerdown', (event) => {
    const pointer = /** @type {PointerEvent} */ (event);
    if (blocked() || dragging || pointer.button !== 0) return;
    if (options.onStart?.(pointer) === false) return;
    /*
     * No preventDefault(): cancelling pointerdown suppresses the compatibility mouse events a
     * double-click reset is built on. Handles set `user-select: none` in CSS to stop the text
     * selection this would otherwise be guarding against.
     */
    dragging = true;
    pointerId = pointer.pointerId;
    startClient = axis(pointer);
    client = startClient;
    moved = false;
    try {
      /** @type {HTMLElement} */ (handle).setPointerCapture(pointer.pointerId);
    } catch {
      // A pointer that ended between the event and this call cannot be captured; the drag simply
      // finishes on the next pointerup.
    }
  }, { signal });

  handle.addEventListener('pointermove', (event) => {
    const pointer = /** @type {PointerEvent} */ (event);
    if (!dragging || pointer.pointerId !== pointerId) return;
    client = axis(pointer);
    if (client !== startClient) moved = true;
    if (frame !== 0) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      if (dragging) options.onMove(client - startClient);
    });
  }, { signal });

  /** @param {Event} event @returns {void} */
  const end = (event) => {
    const pointer = /** @type {PointerEvent} */ (event);
    if (!dragging || pointer.pointerId !== pointerId) return;
    cancelFrame();
    client = axis(pointer);
    const travelled = moved;
    const delta = client - startClient;
    finish();
    options.onEnd?.(delta, travelled);
  };
  handle.addEventListener('pointerup', end, { signal });
  handle.addEventListener('pointercancel', end, { signal });

  handle.addEventListener('keydown', (event) => {
    const key = /** @type {KeyboardEvent} */ (event);
    if (blocked()) return;
    if ((key.key === 'Enter' || key.key === ' ') && options.onActivate) {
      key.preventDefault();
      options.onActivate();
      return;
    }
    if (key.key === 'Home' || key.key === 'End') {
      if (!options.onJump) return;
      key.preventDefault();
      options.onJump(key.key === 'Home' ? 'min' : 'max');
      return;
    }
    const decrease = vertical ? 'ArrowUp' : 'ArrowLeft';
    const increase = vertical ? 'ArrowDown' : 'ArrowRight';
    if (key.key !== decrease && key.key !== increase) return;
    if (!options.onStep) return;
    key.preventDefault();
    options.onStep(key.key === increase ? 1 : -1, key.shiftKey);
  }, { signal });

  return {
    isDragging: () => dragging,
    cancel() {
      if (!dragging) return;
      finish();
    },
    destroy() {
      finish();
      controller.abort();
    }
  };
}

/**
 * Resolves a size option to pixels without touching the DOM.
 *
 * Numbers, bare numeric strings, and `px` lengths are pixels; a percentage resolves against
 * `total`. Every other CSS length — `rem`, `vh`, `calc()` — needs the browser, so it returns `NaN`
 * and the caller hands the value to CSS instead of guessing at it.
 * @param {number|string} value Size option.
 * @param {number} total Container size along the split axis, in pixels.
 * @returns {number} Pixels, or `NaN` when only the browser can resolve the value.
 */
export function resolveSize(value, total) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : Number.NaN;
  if (typeof value !== 'string') return Number.NaN;
  const match = /^([+-]?(?:\d+\.?\d*|\.\d+))(px|%)?$/i.exec(value.trim());
  if (!match) return Number.NaN;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount)) return Number.NaN;
  if ((match[2] ?? '').toLowerCase() !== '%') return amount;
  const span = Number(total);
  return Number.isFinite(span) ? (amount / 100) * span : Number.NaN;
}
