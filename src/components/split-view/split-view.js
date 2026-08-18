import { Component } from '../../core/component.js';
import { h, restoreTarget, snapshotTarget } from '../../core/dom.js';
import { storage } from '../../core/storage.js';
import { uid } from '../../core/util.js';

/** Pixels an arrow key moves the divider. */
const STEP = 16;
/** Pixels a shifted arrow key moves the divider. */
const STEP_LARGE = 64;
/** Storage namespace shared by every split view that opted into persistence. */
const STORAGE_NAMESPACE = 'split-view';

/** @typedef {string|Node|Component|null} SplitViewContent */

/**
 * @typedef {Object} SplitViewOptions
 * @property {'horizontal'|'vertical'} [orientation='horizontal'] Split axis. `horizontal` puts the
 *   panes side by side behind a vertical divider; `vertical` stacks them behind a horizontal one.
 * @property {SplitViewContent} [start=null] Leading pane content (left, or top).
 * @property {SplitViewContent} [end=null] Trailing pane content (right, or bottom).
 * @property {number|string} [size='38%'] Initial size of the START pane. A number is pixels, a
 *   string is any CSS length the browser understands; `%` resolves against the container.
 * @property {number} [min=160] Smallest the start pane may become, in pixels.
 * @property {number|null} [max=null] Largest the start pane may become, in pixels; null means "as
 *   large as the container allows".
 * @property {false|'start'|'end'} [collapsible=false] Which pane Enter/Space on the divider hides.
 * @property {boolean|'start'|'end'} [collapsed=false] Whether a pane starts collapsed; `true` uses
 *   the `collapsible` pane.
 * @property {number} [snap=0] Snap radius in pixels. A drag that ends within this distance of the
 *   initial size, the minimum, or the maximum lands exactly on it. `0` disables snapping.
 * @property {string|null} [storageKey=null] Key under which the size is remembered between visits.
 *   Storage failures degrade to memory rather than throwing.
 * @property {boolean} [disabled=false] Whether resizing is blocked.
 * @property {string} [label='Resize panes'] Accessible name of the divider.
 * @property {(event: CustomEvent<{size: number, ratio: number}>) => void} [onresize] Resize listener.
 * @property {(event: CustomEvent<{size: number, ratio: number}>) => void} [onresizeend] Resize-end listener.
 * @property {(event: CustomEvent<{pane: 'start'|'end'}>) => void} [oncollapse] Collapse listener.
 * @property {(event: CustomEvent<Record<string, never>>) => void} [onexpand] Expand listener.
 */

/**
 * Two panes and a draggable divider between them.
 *
 * The layout is a three-track CSS grid driven by a single custom property, `--zx-split-size`, so a
 * drag writes one style value per frame and the browser does the rest — no per-pane width
 * arithmetic, no reflow storm. The property holds whatever was asked for: `38%` stays a percentage
 * and keeps tracking the container until someone drags, at which point it becomes a pixel value
 * and stays put.
 *
 * The divider follows the WAI-ARIA window splitter pattern: it is a focusable `separator` carrying
 * live `aria-valuenow`/`aria-valuemin`/`aria-valuemax` in pixels, it moves with the arrow keys, and
 * — where the component is `collapsible` — Enter or Space folds a pane away.
 * @fires SplitView#resize
 * @fires SplitView#resizeend
 * @fires SplitView#collapse
 * @fires SplitView#expand
 */
export class SplitView extends Component {
  static cssName = 'split-view';

  /** @type {Readonly<SplitViewOptions>} */
  static defaults = {
    orientation: 'horizontal',
    start: null,
    end: null,
    size: '38%',
    min: 160,
    max: null,
    collapsible: false,
    collapsed: false,
    snap: 0,
    storageKey: null,
    disabled: false,
    label: 'Resize panes'
  };

  /** @type {ResizeObserver|null} */
  #observer = null;
  /** @type {ReturnType<typeof storage>|null} */
  #store = null;

  /**
   * Creates a split view, or turns an existing element into one.
   * @param {Element|string|null} [target=null] Existing container, selector, or null to create one.
   * @param {SplitViewOptions} [options={}] Split-view options.
   */
  constructor(target = null, options = {}) {
    super(target, options);

    const key = this.options.storageKey;
    if (key !== null && key !== undefined && key !== '') {
      this.#store = storage(STORAGE_NAMESPACE);
      const stored = this.#store.get(String(key));
      if (typeof stored === 'number' && Number.isFinite(stored) && stored >= 0) this.setSize(stored);
    }

    const collapsed = this.options.collapsed;
    if (collapsed === 'start' || collapsed === 'end') this.#setCollapsed(collapsed, false);
    else if (collapsed === true && this.options.collapsible) {
      this.#setCollapsed(this.options.collapsible === 'end' ? 'end' : 'start', false);
    }

    const divider = this.refs.divider;
    this.listen(divider, 'pointerdown', (event) => this.#onPointerDown(/** @type {PointerEvent} */ (event)));
    this.listen(divider, 'pointermove', (event) => this.#onPointerMove(/** @type {PointerEvent} */ (event)));
    this.listen(divider, 'pointerup', (event) => this.#endDrag(/** @type {PointerEvent} */ (event)));
    this.listen(divider, 'pointercancel', (event) => this.#endDrag(/** @type {PointerEvent} */ (event)));
    this.listen(divider, 'keydown', (event) => this.#onKeyDown(/** @type {KeyboardEvent} */ (event)));
    this.listen(divider, 'dblclick', () => this.#onDoubleClick());

    if (typeof ResizeObserver === 'function') {
      this.#observer = new ResizeObserver(() => this.#onContainerResize());
      this.#observer.observe(this.el);
    }
    this.#syncAria();
  }

  /**
   * Builds the panes and the divider. Runs inside the base constructor, before any class field
   * exists, so every value it needs later is an ordinary instance property assigned here.
   * @returns {HTMLElement}
   */
  render() {
    const options = /** @type {SplitViewOptions} */ (this.options);
    this._orientation = options.orientation === 'vertical' ? 'vertical' : 'horizontal';
    // A pixel size is known up front and can be clamped straight away; a percentage or any other
    // CSS length stays null, which means "the property holds the option and CSS is in charge".
    const initial = resolveSize(options.size, Number.NaN);
    /** Current start size in pixels, or null while the CSS value in the property is in charge. */
    this._size = Number.isFinite(initial) ? Math.max(0, initial) : null;
    /** @type {'start'|'end'|null} */
    this._collapsed = null;
    this._disabled = Boolean(options.disabled);
    this._destroyed = false;
    this._dragging = false;
    /** Handle of the frame a pending drag update is scheduled in; `0` if none. */
    this._frame = 0;
    /** @type {number|null} */
    this._pointerId = null;
    this._startClient = 0;
    this._startSize = 0;
    this._pointerClient = 0;
    /** Whether the pointer left its starting position, which separates a drag from a click. */
    this._moved = false;
    /** Container size of the last observer pass; `-1` forces the next one to run. */
    this._lastTotal = -1;

    this._createdRoot = !this.el;
    const root = /** @type {HTMLElement} */ (this.el ?? h('div'));
    this.el = root;
    this._snapshot = this._createdRoot ? null : snapshotTarget(root);
    // An enhanced element with no explicit pane options donates its first two children as panes.
    const adopted = this._createdRoot || options.start != null || options.end != null
      ? []
      : Array.from(root.children);

    const startId = uid('zx-split-start');
    const start = h('div', {
      class: 'zx-split-view__pane', id: startId, ref: 'start', dataset: { pane: 'start' }
    });
    const divider = h('div', {
      class: 'zx-split-view__divider',
      ref: 'divider',
      role: 'separator',
      tabindex: this._disabled ? -1 : 0,
      // A separator's aria-orientation describes the separator itself, not the split: panes lying
      // side by side (orientation "horizontal") are parted by a vertical line.
      ariaOrientation: this._orientation === 'vertical' ? 'horizontal' : 'vertical',
      ariaLabel: String(options.label ?? 'Resize panes'),
      ariaControls: startId
    });
    const end = h('div', {
      class: 'zx-split-view__pane', ref: 'end', dataset: { pane: 'end' }
    });

    root.replaceChildren(start, divider, end);
    root.dataset.orientation = this._orientation;
    if (this._disabled) divider.setAttribute('aria-disabled', 'true');
    root.style.setProperty('--zx-split-size', cssLength(options.size));

    if (options.start != null) replacePaneContent(start, options.start, 'SplitView start');
    else if (adopted[0]) start.append(adopted[0]);
    if (options.end != null) replacePaneContent(end, options.end, 'SplitView end');
    else if (adopted[1]) end.append(...adopted.slice(1));

    return root;
  }

  /**
   * Sets the start pane size. Pixels and percentages are clamped against `min`, `max`, and the
   * container immediately; any other CSS length is handed to the browser unclamped. Programmatic,
   * so it emits nothing.
   * @param {number|string} value Pixel number or CSS length.
   * @returns {this}
   */
  setSize(value) {
    const { total, divider, min, max } = this.#metrics();
    // With no container to measure, a percentage means nothing yet — leave it to CSS rather than
    // resolving it to zero and pinning the pane shut.
    const parsed = resolveSize(value, total > 0 ? total : Number.NaN);
    if (Number.isFinite(parsed)) {
      this.#applySize(clampSize({ size: parsed, min, max, total, divider }));
      return this;
    }
    this._size = null;
    /** @type {HTMLElement} */ (this.el).style.setProperty('--zx-split-size', cssLength(value));
    this.#syncAria();
    return this;
  }

  /**
   * Returns the start pane's current size in pixels: `0` while the start pane is collapsed, and
   * everything but the divider while the end pane is.
   * @returns {number}
   */
  getSize() {
    if (this._collapsed === 'start') return 0;
    const { total, divider } = this.#metrics();
    if (this._collapsed === 'end') return Math.max(0, total - divider);
    if (this._size !== null) return this._size;
    // A CSS-driven size is whatever the browser laid out, so measure rather than guess.
    const measured = paneExtent(this.refs.start, this._orientation);
    if (measured > 0) return measured;
    const parsed = resolveSize(this.options.size, total);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  }

  /**
   * Returns the start pane's share of the container, between 0 and 1.
   * @returns {number}
   */
  getRatio() {
    const { total } = this.#metrics();
    return total > 0 ? this.getSize() / total : 0;
  }

  /**
   * Replaces the start pane's content.
   * @param {SplitViewContent} content Text, node, component, or null to empty the pane.
   * @returns {this}
   */
  setStart(content) {
    replacePaneContent(this.refs.start, content, 'SplitView start');
    return this;
  }

  /**
   * Replaces the end pane's content.
   * @param {SplitViewContent} content Text, node, component, or null to empty the pane.
   * @returns {this}
   */
  setEnd(content) {
    replacePaneContent(this.refs.end, content, 'SplitView end');
    return this;
  }

  /**
   * Folds one pane away, keeping the remembered size for `expand()`. Works whatever `collapsible`
   * says — that option only governs the keyboard affordance.
   * @param {'start'|'end'} [which] Pane to hide; defaults to the `collapsible` pane, else `start`.
   * @returns {this}
   * @fires SplitView#collapse
   */
  collapse(which) {
    const fallback = this.options.collapsible === 'end' ? 'end' : 'start';
    return this.#setCollapsed(which === 'end' ? 'end' : (which === 'start' ? 'start' : fallback), true);
  }

  /**
   * Restores a collapsed pane to the size it had.
   * @returns {this}
   * @fires SplitView#expand
   */
  expand() {
    if (this._collapsed === null) return this;
    this._collapsed = null;
    delete /** @type {HTMLElement} */ (this.el).dataset.collapsed;
    this.#syncAria();
    this.emit('expand');
    return this;
  }

  /**
   * Reports which pane is collapsed, if any.
   * @returns {'start'|'end'|false}
   */
  isCollapsed() {
    return this._collapsed ?? false;
  }

  /**
   * Allows resizing again and puts the divider back in the tab order.
   * @returns {this}
   */
  enable() {
    this._disabled = false;
    this.refs.divider.removeAttribute('aria-disabled');
    this.refs.divider.setAttribute('tabindex', '0');
    return this;
  }

  /**
   * Blocks pointer and keyboard resizing and takes the divider out of the tab order. Any drag in
   * flight ends immediately.
   * @returns {this}
   */
  disable() {
    this._disabled = true;
    this.#endDrag(null);
    this.refs.divider.setAttribute('aria-disabled', 'true');
    this.refs.divider.setAttribute('tabindex', '-1');
    return this;
  }

  /**
   * Reports whether resizing is blocked.
   * @returns {boolean}
   */
  isDisabled() {
    return this._disabled;
  }

  /**
   * Disconnects the observer, drops listeners, and restores an enhanced target's original content.
   * @returns {void}
   */
  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    if (this._frame !== 0) {
      cancelAnimationFrame(this._frame);
      this._frame = 0;
    }
    this.#releasePointer();
    this.#observer?.disconnect();
    this.#observer = null;
    super.destroy();
    if (!this._createdRoot && this._snapshot) restoreTarget(this.el, this._snapshot);
  }

  /**
   * Collects everything the geometry helpers need, in pixels.
   * @returns {{total: number, divider: number, min: number, max: number|null}}
   */
  #metrics() {
    const root = /** @type {HTMLElement} */ (this.el);
    const total = this._orientation === 'vertical' ? root.clientHeight : root.clientWidth;
    const max = this.options.max == null ? null : Number(this.options.max);
    return {
      total: Number.isFinite(total) && total > 0 ? total : 0,
      divider: paneExtent(this.refs.divider, this._orientation),
      min: Math.max(0, Number(this.options.min) || 0),
      max: Number.isFinite(/** @type {number} */ (max)) ? max : null
    };
  }

  /**
   * Writes a pixel size to the one property the grid reads, and mirrors it into the divider's ARIA.
   * @param {number} size Clamped pixel size.
   * @returns {void}
   */
  #applySize(size) {
    this._size = size;
    /** @type {HTMLElement} */ (this.el).style.setProperty('--zx-split-size', `${size}px`);
    this.#syncAria();
  }

  /** @returns {void} */
  #syncAria() {
    const { total, divider, min, max } = this.#metrics();
    const bounds = sizeBounds({ min, max, total, divider });
    const element = this.refs.divider;
    element.setAttribute('aria-valuemin', String(Math.round(bounds.min)));
    element.setAttribute('aria-valuemax', String(Math.round(bounds.max)));
    element.setAttribute('aria-valuenow', String(Math.round(this.getSize())));
  }

  /**
   * @param {'start'|'end'} pane
   * @param {boolean} notify
   * @returns {this}
   */
  #setCollapsed(pane, notify) {
    if (this._collapsed === pane) return this;
    this._collapsed = pane;
    /** @type {HTMLElement} */ (this.el).dataset.collapsed = pane;
    this.#syncAria();
    if (notify) this.emit('collapse', { pane });
    return this;
  }

  /** @param {PointerEvent} event @returns {void} */
  #onPointerDown(event) {
    if (this._disabled || this._dragging || event.button !== 0) return;
    // No preventDefault(): cancelling pointerdown suppresses the compatibility mouse events the
    // double-click reset is built on. `user-select: none` on the divider stops the text selection
    // this would otherwise be guarding against.
    this._dragging = true;
    this._pointerId = event.pointerId;
    this._startClient = axisClient(event, this._orientation);
    this._pointerClient = this._startClient;
    this._startSize = this.getSize();
    this._moved = false;
    /** @type {HTMLElement} */ (this.el).dataset.dragging = 'true';
    try {
      this.refs.divider.setPointerCapture(event.pointerId);
    } catch {
      // A pointer that ended between the event and this call cannot be captured; the drag simply
      // finishes on the next pointerup.
    }
  }

  /** @param {PointerEvent} event @returns {void} */
  #onPointerMove(event) {
    if (!this._dragging || event.pointerId !== this._pointerId) return;
    this._pointerClient = axisClient(event, this._orientation);
    if (this._pointerClient !== this._startClient) this._moved = true;
    if (this._frame !== 0) return;
    // One write and at most one `resize` per frame, however fast the pointer reports.
    this._frame = requestAnimationFrame(() => {
      this._frame = 0;
      this.#trackPointer(false);
    });
  }

  /**
   * Clamps the pointer position into a legal size and applies it.
   * @param {boolean} settle Whether to apply the snap radius, which only makes sense at drag end.
   * @returns {void}
   */
  #trackPointer(settle) {
    if (!this._dragging || this._destroyed) return;
    const { total, divider, min, max } = this.#metrics();
    if (total <= 0) return;
    // Dragging a folded pane brings it back rather than doing nothing; a plain click does not,
    // because this runs only once the pointer has actually moved.
    if (this._collapsed !== null) this.expand();
    let next = clampSize({
      size: this._startSize + (this._pointerClient - this._startClient), min, max, total, divider
    });
    if (settle) {
      next = clampSize({
        size: snapSize(next, this.#snapTargets(total, divider), Number(this.options.snap)),
        min, max, total, divider
      });
    }
    if (next === this._size) return;
    this.#applySize(next);
    this.emit('resize', { size: next, ratio: next / total });
  }

  /**
   * @param {number} total
   * @param {number} divider
   * @returns {number[]}
   */
  #snapTargets(total, divider) {
    const { min, max } = this.#metrics();
    const bounds = sizeBounds({ min, max, total, divider });
    const targets = [bounds.min, bounds.max];
    const initial = resolveSize(this.options.size, total);
    if (Number.isFinite(initial)) targets.unshift(initial);
    return targets;
  }

  /**
   * Finishes a drag: flushes the last frame, applies the snap radius, releases the capture,
   * persists, and reports. A press that never moved is a click, not a resize, and reports nothing.
   * @param {PointerEvent|null} event Ending pointer event, or null when ending programmatically.
   * @returns {void}
   * @fires SplitView#resizeend
   */
  #endDrag(event) {
    if (!this._dragging) return;
    if (event && event.pointerId !== this._pointerId) return;
    if (this._frame !== 0) {
      cancelAnimationFrame(this._frame);
      this._frame = 0;
    }
    if (event) this._pointerClient = axisClient(event, this._orientation);
    const moved = this._moved;
    // A drag that ends back where it started still has a final position to restore and report.
    if (moved) this.#trackPointer(true);
    this._dragging = false;
    this._moved = false;
    this.#releasePointer();
    delete /** @type {HTMLElement} */ (this.el).dataset.dragging;
    if (!moved) return;
    this.#persist();
    this.#emitResizeEnd();
  }

  /** @returns {void} */
  #releasePointer() {
    const pointerId = this._pointerId;
    this._pointerId = null;
    if (pointerId === null) return;
    try {
      this.refs.divider.releasePointerCapture(pointerId);
    } catch {
      // The capture is already gone once the pointer was cancelled or the node was detached.
    }
  }

  /** @param {KeyboardEvent} event @returns {void} */
  #onKeyDown(event) {
    if (this._disabled) return;
    const key = event.key;

    if (key === 'Enter' || key === ' ') {
      if (!this.options.collapsible) return;
      event.preventDefault();
      if (this._collapsed === null) {
        this.collapse(/** @type {'start'|'end'} */ (this.options.collapsible));
      } else {
        this.expand();
      }
      return;
    }

    const horizontal = this._orientation === 'horizontal';
    const shrink = horizontal ? 'ArrowLeft' : 'ArrowUp';
    const grow = horizontal ? 'ArrowRight' : 'ArrowDown';
    if (key !== shrink && key !== grow && key !== 'Home' && key !== 'End') return;
    event.preventDefault();
    // A key that moves the divider implies the pane should be visible again.
    if (this._collapsed !== null) this.expand();

    const { total, divider, min, max } = this.#metrics();
    if (total <= 0) return;
    const bounds = sizeBounds({ min, max, total, divider });
    const step = event.shiftKey ? STEP_LARGE : STEP;
    let next = bounds.min;
    if (key === 'End') next = bounds.max;
    else if (key !== 'Home') next = this.getSize() + (key === grow ? step : -step);

    const size = clampSize({ size: next, min, max, total, divider });
    if (size === this._size) return;
    this.#applySize(size);
    this.emit('resize', { size, ratio: size / total });
    this.#persist();
    this.#emitResizeEnd();
  }

  /**
   * Resets the divider to the initial `size`. A percentage goes back to being a percentage rather
   * than to the pixel value it happens to work out at, so the pane keeps tracking the container.
   * @returns {void}
   * @fires SplitView#resize
   * @fires SplitView#resizeend
   */
  #onDoubleClick() {
    if (this._disabled) return;
    if (this._collapsed !== null) this.expand();
    const initial = resolveSize(this.options.size, Number.NaN);
    if (Number.isFinite(initial)) {
      this.setSize(initial);
    } else {
      this._size = null;
      /** @type {HTMLElement} */ (this.el).style.setProperty('--zx-split-size', cssLength(this.options.size));
      this._lastTotal = -1;
      this.#onContainerResize();
    }
    const { total } = this.#metrics();
    const size = this.getSize();
    this.emit('resize', { size, ratio: total > 0 ? size / total : 0 });
    this.#persist();
    this.#emitResizeEnd();
  }

  /**
   * Re-clamps after the container changed size.
   *
   * The pass bails on a container that measures zero — a hidden tab or a detached node — because
   * clamping against nothing would collapse a perfectly good size to the minimum and then persist
   * it. It also returns early when the container size is unchanged, and writes only when clamping
   * actually moved the value, so the writes it makes can never drive the observer in a loop.
   *
   * A percentage keeps its responsiveness: it is re-checked against the bounds on every container
   * change and only pinned to pixels for as long as it actually breaks one, so a container that
   * grows back gets its percentage back too.
   * @returns {void}
   */
  #onContainerResize() {
    if (this._destroyed || this._dragging) return;
    const { total, divider, min, max } = this.#metrics();
    if (total <= 0 || total === this._lastTotal) return;
    this._lastTotal = total;

    if (this._size === null) {
      const resolved = resolveSize(this.options.size, total);
      if (Number.isFinite(resolved)) {
        const clamped = clampSize({ size: resolved, min, max, total, divider });
        /** @type {HTMLElement} */ (this.el).style.setProperty('--zx-split-size',
          Math.abs(clamped - resolved) > 0.5 ? `${clamped}px` : cssLength(this.options.size));
      }
      this.#syncAria();
      return;
    }

    const clamped = clampSize({ size: this._size, min, max, total, divider });
    if (clamped === this._size) {
      this.#syncAria();
      return;
    }
    this.#applySize(clamped);
    this.emit('resize', { size: clamped, ratio: clamped / total });
  }

  /**
   * Remembers the current pixel size, or forgets a remembered one once the size went back to
   * being CSS-driven — otherwise a reset would be undone by the next visit.
   * @returns {void}
   */
  #persist() {
    const key = this.options.storageKey;
    if (!this.#store || key == null || key === '') return;
    if (this._size === null) this.#store.remove(String(key));
    else this.#store.set(String(key), Math.round(this._size));
  }

  /** @returns {void} @fires SplitView#resizeend */
  #emitResizeEnd() {
    const { total } = this.#metrics();
    const size = this.getSize();
    this.emit('resizeend', { size, ratio: total > 0 ? size / total : 0 });
  }
}

/**
 * Fired while the divider moves, at most once per animation frame during a drag.
 * @event SplitView#resize
 * @type {CustomEvent<{size: number, ratio: number}>}
 */

/**
 * Fired once an interaction settles: a drag ends, a key moves the divider, or a double-click
 * resets it.
 * @event SplitView#resizeend
 * @type {CustomEvent<{size: number, ratio: number}>}
 */

/**
 * Fired when a pane folds away.
 * @event SplitView#collapse
 * @type {CustomEvent<{pane: 'start'|'end'}>}
 */

/**
 * Fired when a collapsed pane comes back.
 * @event SplitView#expand
 * @type {CustomEvent<Record<string, never>>}
 */

/**
 * @typedef {Object} SizeBounds
 * @property {number} min Smallest legal start size in pixels.
 * @property {number} max Largest legal start size in pixels.
 */

/**
 * @typedef {Object} ClampSizeInput
 * @property {number} size Requested start size in pixels.
 * @property {number} [min=0] Smallest start size in pixels.
 * @property {number|null} [max=null] Largest start size in pixels, or null for "whatever fits".
 * @property {number} [total=0] Container size along the split axis, in pixels.
 * @property {number} [divider=0] Divider thickness, in pixels.
 */

/**
 * Restricts a start-pane size to what the container can actually give it.
 *
 * The upper bound is never more than the space left after the divider, so the trailing pane can
 * never be pushed to a negative size; when the container is too small even for `min`, the minimum
 * yields rather than overflowing. A container that measures zero or less — a hidden tab, a node
 * that is not in the document — has nothing to clamp against, so the requested size passes through
 * untouched instead of being flattened to zero.
 * @param {ClampSizeInput} input Requested size and the geometry around it.
 * @returns {number} A size in pixels, never negative.
 */
export function clampSize({ size, min = 0, max = null, total = 0, divider = 0 }) {
  const requested = Number(size);
  const bounds = sizeBounds({ min, max, total, divider });
  const available = Math.max(0, (Number(total) || 0) - Math.max(0, Number(divider) || 0));
  if (!(available > 0)) return Number.isFinite(requested) ? Math.max(0, requested) : bounds.min;
  if (!Number.isFinite(requested)) return bounds.min;
  return Math.min(bounds.max, Math.max(bounds.min, requested));
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

/**
 * Pulls a size onto the nearest target within a radius, leaving it alone when nothing is close.
 * The radius is inclusive, ties go to the target listed first, and a radius of zero or less turns
 * snapping off.
 * @param {number} size Size in pixels.
 * @param {number[]|number|null|undefined} targets Sizes worth landing exactly on.
 * @param {number} threshold Snap radius in pixels.
 * @returns {number}
 */
export function snapSize(size, targets, threshold) {
  const value = Number(size);
  const radius = Number(threshold);
  if (!Number.isFinite(value) || !Number.isFinite(radius) || radius <= 0) return value;

  const list = Array.isArray(targets) ? targets : (targets == null ? [] : [targets]);
  let best = value;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const candidate of list) {
    const target = Number(candidate);
    if (!Number.isFinite(target)) continue;
    const distance = Math.abs(target - value);
    if (distance <= radius && distance < bestDistance) {
      bestDistance = distance;
      best = target;
    }
  }
  return best;
}

/**
 * Derives the legal size range from the container and the options.
 * @param {{min?: number, max?: number|null, total?: number, divider?: number}} input Geometry.
 * @returns {SizeBounds}
 */
function sizeBounds({ min = 0, max = null, total = 0, divider = 0 }) {
  const available = Math.max(0, (Number(total) || 0) - Math.max(0, Number(divider) || 0));
  const upper = max == null || !Number.isFinite(Number(max))
    ? available
    : Math.min(available, Math.max(0, Number(max)));
  const lower = Math.min(Math.max(0, Number(min) || 0), upper);
  return { min: lower, max: upper };
}

/**
 * Measures an element along the split axis.
 * @param {Element} element Pane or divider.
 * @param {'horizontal'|'vertical'} orientation Split axis.
 * @returns {number}
 */
function paneExtent(element, orientation) {
  const rect = element.getBoundingClientRect();
  const value = orientation === 'vertical' ? rect.height : rect.width;
  return Number.isFinite(value) && value > 0 ? value : 0;
}

/**
 * Reads the pointer coordinate that matters for the split axis.
 * @param {PointerEvent} event Pointer event.
 * @param {'horizontal'|'vertical'} orientation Split axis.
 * @returns {number}
 */
function axisClient(event, orientation) {
  return orientation === 'vertical' ? event.clientY : event.clientX;
}

/**
 * Normalizes a length option: a number is pixels, a string is passed through to CSS.
 * @param {number|string} value Length option.
 * @returns {string}
 */
function cssLength(value) {
  return typeof value === 'number' && Number.isFinite(value) ? `${value}px` : String(value);
}

/**
 * @param {Element} pane Target pane.
 * @param {SplitViewContent} content Replacement content.
 * @param {string} label Name used in the type error.
 * @returns {void}
 */
function replacePaneContent(pane, content, label) {
  pane.replaceChildren();
  if (content === null || content === undefined) return;
  if (typeof content === 'string' || typeof content === 'number') {
    pane.append(document.createTextNode(String(content)));
    return;
  }
  const node = content instanceof Component ? content.toElement() : content;
  if (node && typeof (/** @type {any} */ (node).nodeType) === 'number') {
    pane.append(/** @type {Node} */ (node));
    return;
  }
  throw new TypeError(`${label} must be a string, Node, Component, or null`);
}
