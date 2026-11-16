import { Component } from '../../core/component.js';
import { h, resolveElement } from '../../core/dom.js';
import { ICON_SIZE, icon } from '../../core/icons.js';
import { overlayScope } from '../../core/overlay-host.js';
import { overlayStack } from '../../core/overlay-stack.js';
import { button } from '../button/button.js';

/** @typedef {'info'|'success'|'warning'|'error'} MessageKind */

/**
 * Where a floating region sits in the viewport: the block edge, then the inline position. Logical,
 * so `start` and `end` follow the writing direction; `top` and `bottom` alone are centred.
 * @typedef {'top-start'|'top'|'top-end'|'bottom-start'|'bottom'|'bottom-end'} MessagePlacement
 */

/** The placements a floating region accepts. */
const PLACEMENTS = new Set(['top-start', 'top', 'top-end', 'bottom-start', 'bottom', 'bottom-end']);

/** The corner floating messages use unless told otherwise. */
const DEFAULT_PLACEMENT = 'top-end';

/** How many messages a collapsed stack shows behind the front one. */
const STACK_PEEK = 2;

/** How much smaller each message behind the front one is drawn in a collapsed stack. */
const STACK_SCALE_STEP = 0.05;

/**
 * How a message stands out beyond its kind icon. `false` draws the plain card; `'border'` (or
 * `true`) draws its border in the kind colour; `'animated'` adds a light that travels around that
 * border — a kind-coloured border where motion is reduced.
 * @typedef {boolean|'border'|'animated'} MessageHighlight
 */

/**
 * The one command a message may carry, drawn as a small button beside its text.
 * @typedef {Object} MessageAction
 * @property {string} label Button text: a verb naming what happens ("Undo", "Approve", "Retry").
 * @property {(event: MouseEvent) => void} [onclick] Runs when the button is activated, by pointer
 *   or keyboard; the message closes right after it.
 * @property {'default'|'primary'|'danger'|'ghost'} [kind='default'] Button kind; the default is the
 *   secondary button.
 */

/**
 * @typedef {Object} MessageShowOptions
 * @property {MessageKind|'danger'} [kind='info'] Message intent (`danger` aliases `error`).
 * @property {number} [timeout=4000] Auto-dismiss delay in milliseconds; zero persists. A message
 *   with an `action` stays at least 8000ms.
 * @property {boolean} [closable=true] Whether to render a close button.
 * @property {MessageAction|null} [action=null] A command button inside the message. The message
 *   never times out while the pointer is over it or focus is inside it.
 * @property {Node|{toElement: () => Node|null}|null} [leading=null] Visual shown in place of the
 *   kind icon, such as an Avatar's element. It is decorative — the message text must say what it
 *   shows.
 * @property {MessageHighlight} [highlight=false] Draws the border in the kind colour (`'border'` or
 *   `true`), or sends a light around it (`'animated'`); the default is the area's `highlight`.
 * @property {Element|string|null} [scope=null] Element whose nearest Zx theme scope owns a floating toast.
 * @property {MessagePlacement} [placement='top-end'] Where a floating toast sits in the viewport; the default is the one set with `Message.setPlacement()`. Messages of one placement share a region. Ignored by an inline area.
 */

/**
 * @typedef {Object} MessageOptions
 * @property {MessageKind|'danger'} [kind='info'] Default message intent.
 * @property {number} [timeout=4000] Default auto-dismiss delay.
 * @property {boolean} [closable=true] Default close-button visibility.
 * @property {number} [maxVisible=5] Maximum number of visible messages.
 * @property {MessageHighlight} [highlight=false] Default highlight of the messages shown here.
 * @property {boolean} [stack=false] Piles the visible messages into one stack, the newest in front
 *   and two more peeking out behind it. The stack opens while the pointer is over it or focus is
 *   inside it, and a press on it keeps it open until a press outside it or Escape; while it is open
 *   by any of these, no message in it times out.
 * @property {boolean} [expanded=false] Keeps a stack open. Its messages still time out.
 */

/**
 * A length in a stack: measured pixels plus a number of spacing steps, so the spacing stays a
 * theme setting. A step is `--zx-message-gap` in an open stack, the space between two messages,
 * and `--zx-message-peek` in a collapsed one, how far each message behind the front shows.
 * @typedef {Object} MessageStackLength
 * @property {number} px Measured part, in pixels.
 * @property {number} steps Spacing steps added to it (negative or fractional where it is cut back).
 */

/**
 * Where one message sits in a stack.
 * @typedef {Object} MessageStackItem
 * @property {number} depth Place in the pile, 0 for the front (newest) message, counting back.
 * @property {MessageStackLength} y How far the message moves from the stack's edge.
 * @property {number} scale Drawn size, 1 at the front.
 * @property {MessageStackLength|null} clip How much is cut from the message's inner edge, in its
 *   own unscaled size, so that only the strip peeking out past the message in front of it shows —
 *   nothing behind a translucent card shows through it. Null where nothing is cut.
 * @property {boolean} hidden Whether the message is out of sight behind the visible pile.
 */

/**
 * @typedef {Object} MessageStackLayout
 * @property {MessageStackItem[]} items One per message, the front first.
 * @property {MessageStackLength} size The stack's own height.
 */

/**
 * Returned by every `show()`: closes that message early. Closing one that already closed, or one
 * still waiting in the queue, is safe.
 * @typedef {Object} MessageHandle
 * @property {() => void} close Closes the message.
 */

/** The shortest time a message that carries an action stays, in milliseconds. */
export const MESSAGE_ACTION_MIN_TIMEOUT = 8000;

/**
 * @typedef {Object} ProgressHandle
 * @property {(pct: number, text?: string) => void} update Updates progress and optional text.
 * @property {() => void} done Completes and dismisses the progress message.
 * @property {(text?: string) => void} fail Marks progress as failed and dismisses it later.
 */

/**
 * Small FIFO admission queue used by message regions.
 * @template T
 */
export class MessageQueue {
  #limit;
  #active = [];
  #pending = [];
  #onActivate;

  /**
   * @param {number} [limit=5] Maximum active item count.
   * @param {(item: T) => void} [onActivate=()=>{}] Called when an item becomes active.
   */
  constructor(limit = 5, onActivate = () => {}) {
    if (!Number.isInteger(limit) || limit < 1) throw new RangeError('Queue limit must be positive');
    if (typeof onActivate !== 'function') throw new TypeError('Activation callback must be a function');
    this.#limit = limit;
    this.#onActivate = onActivate;
  }

  /**
   * Adds an item, activating it immediately when capacity allows.
   * @param {T} item Item to add.
   * @returns {'active'|'pending'} Initial queue location.
   */
  enqueue(item) {
    if (this.#active.length < this.#limit) {
      this.#active.push(item);
      this.#onActivate(item);
      return 'active';
    }
    this.#pending.push(item);
    return 'pending';
  }

  /**
   * Removes an item and promotes the oldest pending item when needed.
   * @param {T} item Item to remove.
   * @returns {'active'|'pending'|null} Previous location, or null when absent.
   */
  remove(item) {
    const pendingIndex = this.#pending.indexOf(item);
    if (pendingIndex !== -1) {
      this.#pending.splice(pendingIndex, 1);
      return 'pending';
    }

    const activeIndex = this.#active.indexOf(item);
    if (activeIndex === -1) return null;
    this.#active.splice(activeIndex, 1);
    if (this.#pending.length > 0) {
      const next = /** @type {T} */ (this.#pending.shift());
      this.#active.push(next);
      this.#onActivate(next);
    }
    return 'active';
  }

  /**
   * Reports whether an item is active.
   * @param {T} item Item to inspect.
   * @returns {boolean}
   */
  isActive(item) {
    return this.#active.includes(item);
  }

  /**
   * Removes every item without activation callbacks.
   * @returns {{active: T[], pending: T[]}} Removed items.
   */
  clear() {
    const removed = { active: this.#active.slice(), pending: this.#pending.slice() };
    this.#active.length = 0;
    this.#pending.length = 0;
    return removed;
  }

  /** @returns {number} */
  get activeCount() {
    return this.#active.length;
  }

  /** @returns {number} */
  get pendingCount() {
    return this.#pending.length;
  }
}

/**
 * Inline message area and static toast service.
 *
 * With `stack` the visible messages pile up into one card, the newest in front, and the pile
 * opens to show them all — the same for an inline area and a floating region. Floating regions
 * stack by default (`Message.setStack(false)` lists their messages instead); an inline area stacks
 * with `stack: true`. The root then carries `data-stack` and `data-state="collapsed"` or
 * `"expanded"`.
 * @extends {Component<MessageOptions>}
 * @fires Message#expand
 * @fires Message#collapse
 */
export class Message extends Component {
  static cssName = 'message';

  /** @type {Readonly<MessageOptions>} */
  static defaults = {
    kind: 'info',
    timeout: 4000,
    closable: true,
    maxVisible: 5,
    highlight: false,
    stack: false,
    expanded: false
  };

  /** @type {MessagePlacement} Where floating messages appear when a call names no placement. */
  static #placement = DEFAULT_PLACEMENT;

  /** @type {boolean} Whether floating regions stack their messages; they do unless told not to. */
  static #stack = true;

  /** @returns {HTMLElement} */
  render() {
    const created = !this.el;
    const root = /** @type {HTMLElement} */ (this.el ?? h('div'));
    this._createdRoot = created;
    this._original = created ? null : snapshot(root);
    this._entries = new Set();
    /** @type {Element|null} The theme scope this instance is the floating region of; null when inline. */
    this._floatingHost = null;
    /** @type {Element|null} Where the floating region was last put: its scope, or the topmost modal. */
    this._placedIn = null;
    /** @type {MessagePlacement|null} The placement this instance is the floating region of. */
    this._placement = null;
    /** @type {import('../../core/overlay-stack.js').OverlayHandle|null} The region's toast entry. */
    this._overlay = null;
    /** @type {(() => void)|null} Stops following the overlay stack. */
    this._unfollow = null;
    this._queue = new MessageQueue(normalizeLimit(this.options.maxVisible), (entry) => {
      this._activate(entry);
    });
    /** @type {any[]} The active messages, oldest first, closing ones until they are gone. */
    this._shown = [];
    /** Activation counter: a newer message paints over an older one in a stack. */
    this._seq = 0;
    this._stack = Boolean(this.options.stack);
    /** Stack holds: the pointer is over it, focus is inside it, a press or `expand()` pinned it. */
    this._hovered = false;
    this._focusWithin = false;
    this._pinned = false;
    /** @type {boolean} Whether the timers were last held by the stack. */
    this._wasHeld = false;
    /** @type {Element|null} Where focus came from when it entered the stack, for Escape. */
    this._stackReturn = null;
    /** @type {number} When the stack was last pinned, so the press that pinned it does not unpin it. */
    this._pinnedAt = -Infinity;
    /** @type {boolean|null} Whether the stack last piled from the foot; null before the first layout. */
    this._pileFromEnd = null;
    /** Set while messages are moved, so the focus they lose and regain is not read as leaving. */
    this._reordering = false;
    this._resizeObserver = typeof ResizeObserver === 'function'
      ? new ResizeObserver(() => this._syncStack()) : null;
    root.replaceChildren();
    root.setAttribute('role', 'status');
    root.setAttribute('aria-live', 'polite');
    /** @type {boolean} What the last `expand`/`collapse` event said. */
    this._wasExpanded = this.isExpanded();
    if (this._stack) {
      root.setAttribute('data-stack', '');
      root.setAttribute('data-state', this._wasExpanded ? 'expanded' : 'collapsed');
    }
    this._listenStack(root);
    return root;
  }

  /**
   * Shows a message in this inline region.
   * @param {string|Node} msg Text or DOM content.
   * @param {MessageShowOptions} [options={}] Display options.
   * @returns {MessageHandle}
   */
  show(msg, options = {}) {
    const action = normalizeMessageAction(options.action);
    const settings = {
      kind: normalizeKind(options.kind ?? this.options.kind),
      timeout: messageTimeout(options.timeout ?? this.options.timeout, action !== null),
      closable: options.closable ?? Boolean(this.options.closable),
      action,
      leading: resolveLeading(options.leading),
      highlight: normalizeMessageHighlight(options.highlight ?? this.options.highlight)
    };
    const entry = this._createEntry(msg, settings);
    this._entries.add(entry);
    this._queue.enqueue(entry);
    return { close: () => this._close(entry) };
  }

  /**
   * Shows a floating informational toast.
   * @param {string|Node} msg Text or DOM content.
   * @param {MessageShowOptions} [options={}] Display options.
   * @returns {MessageHandle}
   */
  static info(msg, options = {}) {
    return this.show(msg, { ...options, kind: 'info' });
  }

  /**
   * Shows a floating success toast.
   * @param {string|Node} msg Text or DOM content.
   * @param {MessageShowOptions} [options={}] Display options.
   * @returns {MessageHandle}
   */
  static success(msg, options = {}) {
    return this.show(msg, { ...options, kind: 'success' });
  }

  /**
   * Shows a floating warning toast.
   * @param {string|Node} msg Text or DOM content.
   * @param {MessageShowOptions} [options={}] Display options.
   * @returns {MessageHandle}
   */
  static warning(msg, options = {}) {
    return this.show(msg, { ...options, kind: 'warning' });
  }

  /**
   * Shows a floating error toast.
   * @param {string|Node} msg Text or DOM content.
   * @param {MessageShowOptions} [options={}] Display options.
   * @returns {MessageHandle}
   */
  static error(msg, options = {}) {
    return this.show(msg, { ...options, kind: 'error' });
  }

  /**
   * Shows a floating toast.
   * @param {string|Node} msg Text or DOM content.
   * @param {MessageShowOptions} [options={}] Display options.
   * @returns {MessageHandle}
   */
  static show(msg, options = {}) {
    return Message.#floatingRegion(options.scope, options.placement).show(msg, options);
  }

  /**
   * Shows a floating progress status.
   * @param {string} text Initial status text.
   * @param {{scope?: Element|string|null, placement?: MessagePlacement, highlight?: MessageHighlight}} [options={}]
   *   Floating-region scope and placement, and the message's highlight.
   * @returns {ProgressHandle}
   */
  static progress(text, options = {}) {
    return Message.#floatingRegion(options.scope, options.placement)._progress(text, options);
  }

  /**
   * Sets whether floating regions stack their messages (see the `stack` option); they do by
   * default, and `false` lists them one below another instead. Unlike a placement it applies at
   * once, to the regions on screen as well as those to come.
   * @param {boolean} enabled Whether to stack.
   * @returns {boolean} Whether floating regions stack now.
   */
  static setStack(enabled) {
    Message.#stack = Boolean(enabled);
    for (const entry of overlayStack.entries()) {
      if (entry.kind === 'toast' && entry.owner instanceof Message) entry.owner.setStack(Message.#stack);
    }
    return Message.#stack;
  }

  /**
   * Returns whether floating regions stack their messages, true unless `setStack(false)` was called.
   * @returns {boolean}
   */
  static getStack() {
    return Message.#stack;
  }

  /**
   * Sets where floating messages appear when a call names no `placement`. It applies to messages
   * shown from then on; a region already on screen stays where it is until its last toast closes.
   *
   * The region carries the placement as `data-placement`, and its distance from the viewport edge
   * is the `--zx-message-offset` custom property (default `var(--zx-space-4)`), read from the
   * region's theme scope. At 640px and narrower every placement spans the foot of the viewport.
   * @param {MessagePlacement} placement One of `'top-start'`, `'top'`, `'top-end'`, `'bottom-start'`,
   *   `'bottom'`, `'bottom-end'`; anything else restores `'top-end'`.
   * @returns {MessagePlacement} The placement now in effect.
   */
  static setPlacement(placement) {
    Message.#placement = normalizeMessagePlacement(placement);
    return Message.#placement;
  }

  /**
   * Returns where floating messages appear when a call names no `placement`.
   * @returns {MessagePlacement}
   */
  static getPlacement() {
    return Message.#placement;
  }

  /**
   * Removes a floating region at once, toasts and all, without waiting for them to time out.
   *
   * A region already removes itself when its last toast closes, and one whose host has left the
   * document is replaced on the next toast, so this is only for a host being torn down while
   * toasts are still showing — an application view unmounting its themed shell, say.
   *
   * A scope has one region per placement in use; all of them are removed.
   * @param {Element|string} scope Element or selector whose nearest Zx theme scope owns the region,
   *   as passed to `show()`.
   * @returns {boolean} Whether there was a region to remove.
   */
  static disposeRegion(scope) {
    if (scope == null) return false;
    const context = resolveElement(scope);
    if (!context) return false;
    const regions = Message.#regionsOf(overlayScope(context));
    for (const region of regions) region._disposeFloating();
    return regions.length > 0;
  }

  /**
   * Turns stacking on or off for this area or region (see the `stack` option). The messages on
   * screen move into the pile, or back into a list, where they are.
   * @param {boolean} enabled Whether to stack.
   * @returns {this}
   */
  setStack(enabled) {
    const next = Boolean(enabled);
    if (next === this._stack) return this;
    this._stack = next;
    const root = /** @type {HTMLElement} */ (this.el);
    const wasExpanded = this._wasExpanded;
    if (next) {
      root.setAttribute('data-stack', '');
    } else {
      this._pinned = false;
      this._hovered = false;
      this._focusWithin = false;
      this._wasExpanded = false;
      this._pileFromEnd = null;
      root.removeAttribute('data-stack');
      root.removeAttribute('data-state');
      root.removeAttribute('data-overflow');
      for (const name of ['--zx-message-stack-size', '--zx-message-stack-hold']) root.style.removeProperty(name);
      for (const entry of this._shown) clearStackStyle(entry.node);
    }
    this._order();
    this._refreshStack();
    // A stack that was open and is now a list has closed, as far as anyone listening knows.
    if (!next && wasExpanded) this.emit('collapse');
    return this;
  }

  /**
   * Opens a stack and keeps it open until `collapse()`, Escape, or a press outside it. Does
   * nothing without `stack`.
   * @returns {this}
   * @fires Message#expand
   */
  expand() {
    if (!this._stack) return this;
    this._pinned = true;
    this._pinnedAt = now();
    this._refreshStack();
    return this;
  }

  /**
   * Closes a stack opened by a press, `expand()`, or the pointer. A stack holding focus stays open
   * until focus leaves it, and one with `expanded: true` never closes.
   * @returns {this}
   * @fires Message#collapse
   */
  collapse() {
    if (!this._stack) return this;
    this._pinned = false;
    this._hovered = false;
    this._refreshStack();
    return this;
  }

  /**
   * Reports whether the stack is open. Always false without `stack`.
   * @returns {boolean}
   */
  isExpanded() {
    return this._stack && Boolean(this.options.expanded || this._pinned || this._hovered || this._focusWithin);
  }

  /** @returns {void} */
  destroy() {
    if (this._cleaned) return;
    this._cleaned = true;
    this._resizeObserver?.disconnect();
    this._resizeObserver = null;
    this._unfollow?.();
    this._unfollow = null;
    const overlay = this._overlay;
    this._overlay = null;
    overlay?.release();
    this._floatingHost = null;
    this._placedIn = null;
    this._placement = null;
    for (const entry of this._entries) {
      clearEntryTimers(entry);
      entry.node.remove();
    }
    this._queue.clear();
    this._entries.clear();
    this._shown.length = 0;
    super.destroy();
    if (!this._createdRoot && this._original) restore(this.el, this._original);
  }

  /**
   * @param {string} text
   * @param {{highlight?: MessageHighlight}} [options={}]
   * @returns {ProgressHandle}
   */
  _progress(text, options = {}) {
    const state = { pct: 0, text: String(text) };
    const entry = this._createEntry(state.text, {
      kind: 'info', timeout: 0, closable: false,
      highlight: normalizeMessageHighlight(options.highlight ?? this.options.highlight)
    }, state);
    this._entries.add(entry);
    this._queue.enqueue(entry);
    let settled = false;

    return {
      update: (pct, nextText) => {
        if (settled || entry.closed) return;
        state.pct = clampPercent(pct);
        if (nextText !== undefined) state.text = String(nextText);
        syncProgress(entry, state);
      },
      done: () => {
        if (settled || entry.closed) return;
        settled = true;
        state.pct = 100;
        syncProgress(entry, state);
        entry.timeout = 600;
        entry.remaining = 600;
        if (this._queue.isActive(entry)) this._schedule(entry);
      },
      fail: (nextText) => {
        if (settled || entry.closed) return;
        settled = true;
        if (nextText !== undefined) state.text = String(nextText);
        entry.kind = 'error';
        entry.node.dataset.kind = 'error';
        entry.node.setAttribute('role', 'alert');
        entry.iconHost.replaceChildren(icon('error', { size: 18 }));
        syncProgress(entry, state);
        entry.timeout = 4000;
        entry.remaining = 4000;
        if (this._queue.isActive(entry)) this._schedule(entry);
      }
    };
  }

  /**
   * @param {string|Node} msg
   * @param {{kind: MessageKind, timeout: number, closable: boolean, action?: MessageAction|null, leading?: Node|null, highlight?: 'border'|'animated'|null}} settings
   * @param {{pct: number, text: string}|null} [progress=null]
   * @returns {any}
   */
  _createEntry(msg, settings, progress = null) {
    const iconHost = h('span', { class: 'zx-message__icon', ariaHidden: 'true' },
      settings.leading ?? icon(settings.kind, { size: 18 })
    );
    const content = h('div', { class: 'zx-message__content' });
    if (isNode(msg)) content.append(msg);
    else content.append(document.createTextNode(String(msg)));
    const node = h('div', {
      class: 'zx-message__toast',
      role: settings.kind === 'error' ? 'alert' : 'status',
      dataset: { kind: settings.kind, state: 'queued' }
    }, iconHost, content);
    const entry = {
      node,
      content,
      iconHost,
      kind: settings.kind,
      timeout: settings.timeout,
      remaining: settings.timeout,
      startedAt: 0,
      timer: null,
      exitTimer: null,
      closed: false,
      hovered: false,
      focused: false,
      returnFocus: null,
      progressBar: null,
      progressFill: null,
      seq: 0
    };
    if (settings.leading) node.dataset.leading = '';
    if (settings.highlight) node.dataset.highlight = settings.highlight;

    if (progress) {
      node.dataset.progress = '';
      const fill = h('span', { class: 'zx-message__progress-fill' });
      const bar = h('div', {
        class: 'zx-message__progress',
        role: 'progressbar',
        ariaValueMin: '0',
        ariaValueMax: '100',
        ariaValueNow: '0',
        ariaLabel: progress.text
      }, fill);
      content.append(bar);
      entry.progressBar = bar;
      entry.progressFill = fill;
      syncProgress(entry, progress);
    }

    if (settings.action) {
      const { label, kind, onclick } = settings.action;
      const control = button({ label, kind, size: 'sm' });
      control.classList.add('zx-message__action');
      node.append(control);
      this.listen(control, 'click', (event) => {
        if (entry.closed) return;
        try {
          onclick?.(/** @type {MouseEvent} */ (event));
        } finally {
          this._close(entry);
        }
      });
    }

    if (settings.closable) {
      const close = h('button', {
        class: 'zx-icon-btn zx-message__close',
        type: 'button',
        ariaLabel: this._message('message.close', 'Close message'),
        title: this._message('message.closeTitle', 'Close')
      }, icon('x', { size: ICON_SIZE.dismiss }));
      node.append(close);
      this.listen(close, 'click', () => this._close(entry));
    }
    // Hover and focus each hold the timer (WCAG 2.2.1): a reader moving to the action or the close
    // button must not have the message vanish under them, and it counts down again only once
    // neither holds it.
    this.listen(node, 'mouseenter', () => {
      entry.hovered = true;
      this._pause(entry);
    });
    this.listen(node, 'mouseleave', () => {
      entry.hovered = false;
      this._resume(entry);
    });
    this.listen(node, 'focusin', (event) => {
      if (!entry.focused) {
        const from = /** @type {FocusEvent} */ (event).relatedTarget;
        entry.returnFocus = isNode(from) && !node.contains(/** @type {Node} */ (from)) ? from : null;
      }
      entry.focused = true;
      this._pause(entry);
    });
    this.listen(node, 'focusout', (event) => {
      const to = /** @type {FocusEvent} */ (event).relatedTarget;
      if (isNode(to) && node.contains(/** @type {Node} */ (to))) return;
      entry.focused = false;
      this._resume(entry);
    });
    return entry;
  }

  /** @param {any} entry @returns {void} */
  _activate(entry) {
    if (entry.closed) return;
    entry.node.dataset.state = 'open';
    this._seq += 1;
    entry.seq = this._seq;
    // A stack keeps document order in visual order, so Tab meets the messages as they are seen:
    // the newest first where it piles from the top, last where it piles from the foot.
    if (this._stack && !this._fromEnd()) this.el.prepend(entry.node);
    else this.el.append(entry.node);
    this._shown.push(entry);
    this._resizeObserver?.observe(entry.node);
    this._syncStack();
    this._schedule(entry);
  }

  /** @param {any} entry @returns {void} */
  _schedule(entry) {
    if (entry.closed || entry.remaining <= 0 || entry.hovered || entry.focused || this._held()) return;
    entry.startedAt = Date.now();
    entry.timer = setTimeout(() => this._close(entry), entry.remaining);
  }

  /** @param {any} entry @returns {void} */
  _pause(entry) {
    if (entry.closed || entry.timer === null) return;
    clearTimeout(entry.timer);
    entry.timer = null;
    entry.remaining = Math.max(0, entry.remaining - (Date.now() - entry.startedAt));
  }

  /** @param {any} entry @returns {void} */
  _resume(entry) {
    if (entry.closed || entry.timer !== null || entry.hovered || entry.focused || this._held()) return;
    if (entry.timeout === 0) return;
    if (entry.remaining <= 0) {
      this._close(entry);
      return;
    }
    this._schedule(entry);
  }

  /** @param {any} entry @returns {void} */
  _close(entry) {
    if (entry.closed) return;
    entry.closed = true;
    clearEntryTimers(entry);
    this._handOffFocus(entry);
    if (!this._queue.isActive(entry)) {
      this._queue.remove(entry);
      entry.node.remove();
      this._entries.delete(entry);
      this._releaseIfEmpty();
      return;
    }

    entry.node.dataset.state = 'closing';
    // The rest of a stack closes up at once, while this one leaves.
    this._syncStack();
    if (!shouldAnimate()) {
      this._finish(entry);
      return;
    }
    const finish = (event) => {
      if (event.target === entry.node) this._finish(entry);
    };
    this.listen(entry.node, 'animationend', finish, { once: true });
    entry.exitTimer = setTimeout(() => this._finish(entry), 260);
  }

  /** @param {any} entry @returns {void} */
  _finish(entry) {
    if (!this._entries.has(entry)) return;
    clearEntryTimers(entry);
    this._resizeObserver?.unobserve(entry.node);
    entry.node.remove();
    this._entries.delete(entry);
    const index = this._shown.indexOf(entry);
    if (index !== -1) this._shown.splice(index, 1);
    this._queue.remove(entry);
    if (this._shown.length === 0) {
      // An emptied stack starts over: nothing is left to hold open.
      this._pinned = false;
      this._hovered = false;
    }
    const active = this.el.ownerDocument?.activeElement;
    if (this._focusWithin && !(active && this.el.contains(active))) this._focusWithin = false;
    this._refreshStack();
    this._releaseIfEmpty();
  }

  /**
   * Whether a stack holds every timer: it is open because someone is looking at it.
   * @returns {boolean}
   */
  _held() {
    return this._stack && (this._pinned || this._hovered || this._focusWithin);
  }

  /**
   * Whether the stack piles from the foot: a bottom placement, or any placement on a phone. Read
   * from the region's `--zx-message-dir`, which the stylesheet sets for both.
   * @returns {boolean}
   */
  _fromEnd() {
    const view = this.el.ownerDocument?.defaultView;
    if (!view || typeof view.getComputedStyle !== 'function') return false;
    return view.getComputedStyle(this.el).getPropertyValue('--zx-message-dir').trim() === '-1';
  }

  /**
   * Puts the messages in document order: oldest first, or newest first in a stack that piles from
   * the top. Moves only when the order is wrong. A moved message keeps focus, and does not play
   * its entrance again (`data-entered`).
   * @param {boolean} [fromEnd] Whether the stack piles from the foot, when already known.
   * @returns {void}
   */
  _order(fromEnd = this._fromEnd()) {
    const nodes = this._shown.map((entry) => entry.node).filter((node) => node.parentNode === this.el);
    if (this._stack && !fromEnd) nodes.reverse();
    const current = Array.from(this.el.children).filter((node) => nodes.includes(node));
    if (current.every((node, index) => node === nodes[index])) return;
    const doc = this.el.ownerDocument;
    const active = doc?.activeElement;
    const keep = active && this.el.contains(active) ? /** @type {HTMLElement} */ (active) : null;
    this._reordering = true;
    try {
      for (const node of nodes) {
        node.setAttribute('data-entered', '');
        this.el.append(node);
      }
      if (keep?.isConnected && doc?.activeElement !== keep) keep.focus({ preventScroll: true });
    } finally {
      this._reordering = false;
    }
  }

  /**
   * Moves focus off a message that is closing with focus inside it. In a stack it goes to the
   * same control of the next message (the one before, for the last), so a keyboard reader closes
   * one message after another without leaving the stack; from the stack's last message it goes
   * back to where it was before it came into the stack. A list hands it back to where it was
   * before it came into the message.
   * @param {any} entry Closing message.
   * @returns {void}
   */
  _handOffFocus(entry) {
    const active = entry.node.ownerDocument?.activeElement;
    if (!this._stack || !active || !entry.node.contains(active)) {
      returnFocus(entry);
      return;
    }
    const nodes = Array.from(this.el.children);
    const live = this._shown.filter((other) => !other.closed && other.node.parentNode === this.el)
      .map((other) => other.node);
    const at = nodes.indexOf(entry.node);
    const after = live.filter((node) => nodes.indexOf(node) > at)
      .sort((a, b) => nodes.indexOf(a) - nodes.indexOf(b))[0];
    const before = live.filter((node) => nodes.indexOf(node) < at)
      .sort((a, b) => nodes.indexOf(b) - nodes.indexOf(a))[0];
    const neighbour = after ?? before;
    const same = active.classList.contains('zx-message__close') ? '.zx-message__close' : '.zx-message__action';
    const target = /** @type {HTMLElement|null} */ (neighbour?.querySelector(same) ?? neighbour?.querySelector('button'));
    if (target) {
      target.focus({ preventScroll: true });
      return;
    }
    const back = /** @type {HTMLElement|null} */ (this._stackReturn);
    if (back?.isConnected && typeof back.focus === 'function') {
      this._stackReturn = null;
      back.focus({ preventScroll: true });
      return;
    }
    returnFocus(entry);
  }

  /**
   * Settles a stack after anything that may open or close it: holds or releases the timers,
   * lays the messages out, and reports a change of state.
   * @returns {void}
   */
  _refreshStack() {
    const held = this._held();
    if (held !== this._wasHeld) {
      this._wasHeld = held;
      for (const entry of this._shown.slice()) {
        if (held) this._pause(entry);
        else this._resume(entry);
      }
    }
    this._syncStack();
    if (!this._stack) return;
    const expanded = this.isExpanded();
    if (expanded === this._wasExpanded) return;
    this._wasExpanded = expanded;
    this.emit(expanded ? 'expand' : 'collapse');
  }

  /**
   * Lays a stack out from its messages' measured heights: each one's place, size, and clip, and
   * the stack's own height. Runs again whenever a message changes size.
   * @returns {void}
   */
  _syncStack() {
    if (!this._stack || this._cleaned) return;
    const root = /** @type {HTMLElement} */ (this.el);
    // A region crossing the phone breakpoint changes the way it piles: keep Tab in visual order.
    const fromEnd = this._fromEnd();
    if (fromEnd !== this._pileFromEnd) {
      this._pileFromEnd = fromEnd;
      this._order(fromEnd);
    }
    const expanded = this.isExpanded();
    root.setAttribute('data-state', expanded ? 'expanded' : 'collapsed');
    const live = this._shown.filter((entry) => !entry.closed).reverse();
    const layout = messageStackLayout(live.map((entry) => entry.node.offsetHeight), expanded);
    this._syncOverflow(expanded, layout.size, fromEnd);
    const step = expanded ? '--zx-message-gap' : '--zx-message-peek';
    live.forEach((entry, index) => {
      const item = layout.items[index];
      const style = entry.node.style;
      style.setProperty('--zx-message-y', stackLength(item.y, step));
      style.setProperty('--zx-message-scale', String(round(item.scale)));
      style.setProperty('--zx-message-z', String(entry.seq));
      if (item.clip) style.setProperty('--zx-message-clip', `max(0px, ${stackLength(item.clip, step)})`);
      else style.removeProperty('--zx-message-clip');
      entry.node.setAttribute('data-depth', item.hidden ? 'hidden' : String(item.depth));
    });
    root.style.setProperty('--zx-message-stack-size', stackLength(layout.size, step));
    // While the pointer is over an open stack it does not shrink under it: a message closing at
    // the far end would otherwise pull the edge past the pointer and fold the stack it is reading.
    if (expanded && this._hovered) {
      const held = Math.max(parseFloat(root.style.getPropertyValue('--zx-message-stack-hold')) || 0,
        root.getBoundingClientRect().height);
      root.style.setProperty('--zx-message-stack-hold', `${round(held)}px`);
    } else {
      root.style.removeProperty('--zx-message-stack-hold');
    }
  }

  /**
   * An open floating stack taller than the viewport becomes a list that scrolls
   * (`data-overflow`), the newest message in view, so every message stays reachable. An inline
   * stack grows with the page and never needs it.
   * @param {boolean} expanded Whether the stack is open.
   * @param {MessageStackLength} size The open stack's height.
   * @param {boolean} fromEnd Whether it piles from the foot.
   * @returns {void}
   */
  _syncOverflow(expanded, size, fromEnd) {
    const root = /** @type {HTMLElement} */ (this.el);
    const view = root.ownerDocument?.defaultView;
    let overflow = false;
    if (expanded && this._floatingHost && view && typeof view.getComputedStyle === 'function') {
      const gap = parseFloat(view.getComputedStyle(root).rowGap) || 0;
      const rect = root.getBoundingClientRect();
      // The region keeps the same offset from both viewport edges.
      const edge = fromEnd ? view.innerHeight - rect.bottom : rect.top;
      overflow = size.px + (size.steps * gap) > view.innerHeight - (2 * Math.max(0, edge)) + 0.5;
    }
    if (overflow === root.hasAttribute('data-overflow')) return;
    root.toggleAttribute('data-overflow', overflow);
    if (overflow && fromEnd) root.scrollTop = root.scrollHeight;
  }

  /**
   * Wires the ways a stack opens and closes: pointer over it, focus inside it, a press on it (a
   * tap included) that keeps it open until a press outside it, and Escape.
   * @param {HTMLElement} root
   * @returns {void}
   */
  _listenStack(root) {
    this.listen(root, 'pointerenter', (event) => {
      // An emptied stack does not open: Chrome enters the root again when the message under the
      // pointer goes.
      if (!this._stack || this._shown.length === 0) return;
      if (/** @type {PointerEvent} */ (event).pointerType === 'touch') return;
      this._hovered = true;
      this._refreshStack();
    });
    this.listen(root, 'pointerleave', (event) => {
      if (!this._stack || /** @type {PointerEvent} */ (event).pointerType === 'touch') return;
      this._hovered = false;
      this._refreshStack();
    });
    this.listen(root, 'pointerdown', (event) => {
      if (!this._stack || this._pinned || this._shown.length === 0) return;
      const target = /** @type {Element|null} */ (event.target);
      // A control acts on its own message: closing the front one needs no opening first.
      if (target?.closest?.('button, a[href], input, select, textarea, [tabindex]')) return;
      this._pinned = true;
      this._pinnedAt = now();
      this._refreshStack();
    });
    const doc = root.ownerDocument;
    if (doc) {
      // A press elsewhere unpins the stack once the press has been handled — after the click
      // handlers, so a button outside that toggles the stack (`isExpanded() ? collapse() :
      // expand()`) sees it as it was, and a stack the press pinned stays pinned. Captured, so a
      // handler stopping propagation does not keep the stack open.
      this.listen(doc, 'click', (event) => {
        if (!this._stack || root.contains(/** @type {Node} */ (event.target))) return;
        const pressed = event.timeStamp;
        setTimeout(() => {
          if (this._cleaned || !this._pinned || this._pinnedAt >= pressed) return;
          this._pinned = false;
          this._refreshStack();
        }, 0);
      }, { capture: true });
    }
    this.listen(root, 'focusin', (event) => {
      if (!this._stack || this._reordering) return;
      if (!this._focusWithin) {
        const from = /** @type {FocusEvent} */ (event).relatedTarget;
        this._stackReturn = isNode(from) && !root.contains(/** @type {Node} */ (from))
          ? /** @type {Element} */ (from) : null;
      }
      this._focusWithin = true;
      this._refreshStack();
    });
    this.listen(root, 'focusout', (event) => {
      if (!this._stack || this._reordering) return;
      const to = /** @type {FocusEvent} */ (event).relatedTarget;
      if (isNode(to) && root.contains(/** @type {Node} */ (to))) return;
      this._focusWithin = false;
      this._refreshStack();
    });
    this.listen(root, 'keydown', (event) => {
      const key = /** @type {KeyboardEvent} */ (event);
      if (key.key !== 'Escape' || key.defaultPrevented || key.isComposing) return;
      if (!this._stack || this.options.expanded || !this.isExpanded()) return;
      // Escape folds the stack and hands focus back to where it was before it came in.
      key.preventDefault();
      this._pinned = false;
      this._hovered = false;
      const active = doc?.activeElement;
      if (active && root.contains(active)) {
        const back = this._stackReturn;
        this._stackReturn = null;
        if (back?.isConnected && typeof (/** @type {HTMLElement} */ (back)).focus === 'function') {
          /** @type {HTMLElement} */ (back).focus({ preventScroll: true });
        } else {
          /** @type {HTMLElement} */ (active).blur?.();
        }
      }
      this._refreshStack();
    });
  }

  /**
   * Takes a floating region out of the document once its last toast has gone, so an emptied host
   * is not left holding a region nobody uses. Inline areas stay: their element is the caller's.
   * @returns {void}
   */
  _releaseIfEmpty() {
    if (!this._floatingHost || this._entries.size > 0) return;
    Message.#release(this);
  }

  /**
   * Puts a floating region where it can be seen and used: inside the topmost open modal dialog
   * while one is open — outside it, `showModal()` would leave every toast unclickable — and in its
   * own theme scope otherwise. Re-showing it after a move puts it back on top of the top layer.
   * @returns {void}
   */
  _rehome() {
    const host = this._floatingHost;
    if (!host) return;
    const target = overlayStack.topmostModal() ?? host;
    if (this.el.parentElement === target && this._placedIn === target) return;
    target.append(this.el);
    this._placedIn = target;
    const region = /** @type {HTMLElement} */ (this.el);
    if (typeof region.showPopover === 'function' && !region.matches(':popover-open')) region.showPopover();
  }

  /**
   * Destroys a floating region and removes its element.
   * @returns {void}
   */
  _disposeFloating() {
    const region = this.el;
    this.destroy();
    region.remove();
  }

  /**
   * Resolves a message through the host translator, falling back to the built-in English text.
   * @param {string} key Message key.
   * @param {string} fallback English default.
   * @returns {string}
   */
  _message(key, fallback) {
    const message = this.msg(key);
    return message === key ? fallback : message;
  }

  /**
   * Finds or creates the floating region of a scope for one placement. A cached region is reused
   * only while it is still where it was put: a host emptied by `replaceChildren()` would otherwise
   * keep receiving toasts in a node nobody can see.
   * @param {Element|string|null|undefined} scope
   * @param {unknown} [requested] Placement asked for; the default placement when absent or unknown.
   * @returns {Message}
   */
  static #floatingRegion(scope, requested) {
    let host = overlayScope(scope ?? null);
    // A scope that has itself left the document cannot show anything; the toast still must be seen.
    if (!host.isConnected) host = overlayScope(null);
    const placement = normalizeMessagePlacement(requested, Message.#placement);
    const existing = Message.#regionsOf(host).find((region) => region._placement === placement) ?? null;
    if (existing && existing.el.isConnected && existing.el.parentElement === existing._placedIn) {
      existing._rehome();
      return existing;
    }
    existing?._disposeFloating();
    const region = h('div', {
      class: 'zx-message-region',
      popover: 'manual',
      role: 'status',
      ariaLive: 'polite',
      dataset: { placement }
    });
    const floating = new Message(region, { stack: Message.#stack });
    floating._floatingHost = host;
    floating._placement = placement;
    // A toast entry on the overlay stack: the registry of regions, and the reason a press on a
    // toast dismisses no drawer or menu. Following the stack moves the region into a modal dialog
    // when one opens and back out when it closes.
    floating._overlay = overlayStack.push({ kind: 'toast', root: region, owner: floating });
    floating._unfollow = overlayStack.subscribe(() => floating._rehome());
    floating._rehome();
    return floating;
  }

  /**
   * The live floating regions of a theme scope — one per placement in use — from the overlay
   * stack's toast entries.
   * @param {Element} host Theme scope.
   * @returns {Message[]}
   */
  static #regionsOf(host) {
    const regions = [];
    for (const entry of overlayStack.entries()) {
      if (entry.kind === 'toast' && entry.owner instanceof Message && entry.owner._floatingHost === host) {
        regions.push(entry.owner);
      }
    }
    return regions;
  }

  /** @param {Message} region Floating region whose last toast closed. @returns {void} */
  static #release(region) {
    region._disposeFloating();
  }
}

/** @param {unknown} value @returns {MessageKind} */
function normalizeKind(value) {
  if (value === 'danger') return 'error';
  return ['success', 'warning', 'error'].includes(String(value)) ?
    /** @type {MessageKind} */ (value) : 'info';
}

/**
 * Settles a floating-message placement: the value when it is one of the six, the fallback otherwise.
 * @param {unknown} value Requested placement.
 * @param {MessagePlacement} [fallback='top-end'] Placement used when the value is absent or unknown.
 * @returns {MessagePlacement}
 */
export function normalizeMessagePlacement(value, fallback = DEFAULT_PLACEMENT) {
  return PLACEMENTS.has(/** @type {string} */ (value)) ? /** @type {MessagePlacement} */ (value) : fallback;
}

/**
 * Settles a message highlight: `'border'` for `true` or `'border'`, `'animated'` for `'animated'`,
 * and null — the plain card — for anything else.
 * @param {unknown} value Requested highlight.
 * @returns {'border'|'animated'|null}
 */
export function normalizeMessageHighlight(value) {
  if (value === true || value === 'border') return 'border';
  return value === 'animated' ? 'animated' : null;
}

/**
 * Lays out a stack of messages from their heights, the front (newest) first.
 *
 * Open, the messages follow one another from the stack's edge. Collapsed, the front one sits at
 * the edge and the next two peek out behind it: each lined up with the front one's far edge, one
 * peek further out, a step smaller, and cut down to the strip that shows below the one in front of
 * it. The rest wait out of sight behind them.
 * @param {number[]} heights Height of each message in pixels, the front first.
 * @param {boolean} expanded Whether the stack is open.
 * @returns {MessageStackLayout}
 */
export function messageStackLayout(heights, expanded) {
  const sizes = Array.from(heights ?? [], (height) => {
    const value = Number(height);
    return Number.isFinite(value) && value > 0 ? value : 0;
  });
  const front = sizes[0] ?? 0;
  let before = 0;
  const items = sizes.map((height, index) => {
    if (expanded) {
      const item = { depth: index, y: { px: before, steps: index }, scale: 1, clip: null, hidden: false };
      before += height;
      return item;
    }
    const depth = Math.min(index, STACK_PEEK);
    const scale = 1 - (depth * STACK_SCALE_STEP);
    return {
      depth,
      y: { px: front - height, steps: depth },
      scale,
      // Drawn at `scale`, one peek on screen is 1/scale of the message's own height.
      clip: depth === 0 ? null : { px: height, steps: -1 / scale },
      hidden: index > STACK_PEEK
    };
  });
  /** @type {MessageStackLength} */
  let size = { px: 0, steps: 0 };
  if (sizes.length > 0) {
    size = expanded
      ? { px: before, steps: sizes.length - 1 }
      : { px: front, steps: Math.min(sizes.length - 1, STACK_PEEK) };
  }
  return { items, size };
}

/**
 * Writes a stack length as CSS.
 * @param {MessageStackLength} length
 * @param {string} step The custom property one step is.
 * @returns {string}
 */
function stackLength(length, step) {
  return `calc(${round(length.px)}px + ${round(length.steps)} * var(${step}))`;
}

/** @returns {number} The current time on the clock event time stamps use. */
function now() {
  return typeof performance === 'object' && typeof performance.now === 'function' ? performance.now() : Date.now();
}

/** @param {number} value @returns {number} Value rounded to two decimals, for inline styles. */
function round(value) {
  return Math.round(value * 100) / 100;
}

/**
 * Removes what a stack set on a message, when its area stops stacking.
 * @param {HTMLElement} node Message element.
 * @returns {void}
 */
function clearStackStyle(node) {
  for (const name of ['--zx-message-y', '--zx-message-scale', '--zx-message-z', '--zx-message-clip']) {
    node.style.removeProperty(name);
  }
  node.removeAttribute('data-depth');
}

/** @param {unknown} value @returns {number} */
function normalizeTimeout(value) {
  const timeout = Number(value);
  return Number.isFinite(timeout) ? Math.max(0, timeout) : 4000;
}

/**
 * Settles how long a message stays. A message that carries an action stays at least
 * `MESSAGE_ACTION_MIN_TIMEOUT`, so there is time to reach it; zero still means it stays until
 * closed, and anything that is not a finite number falls back to the 4000ms default.
 * @param {unknown} timeout Requested auto-dismiss delay in milliseconds.
 * @param {boolean} [hasAction=false] Whether the message carries an action.
 * @returns {number}
 */
export function messageTimeout(timeout, hasAction = false) {
  const settled = normalizeTimeout(timeout);
  return hasAction && settled > 0 ? Math.max(settled, MESSAGE_ACTION_MIN_TIMEOUT) : settled;
}

/**
 * Copies a message action into the shape the message renders, or returns null when there is
 * nothing to render: no object, or no label. An unknown `kind` reads as the default, secondary
 * button, and a missing `onclick` leaves a button that only closes the message.
 * @param {unknown} value Action descriptor.
 * @returns {{label: string, kind: 'default'|'primary'|'danger'|'ghost', onclick: ((event: MouseEvent) => void)|null}|null}
 */
export function normalizeMessageAction(value) {
  if (!value || typeof value !== 'object') return null;
  const action = /** @type {Record<string, unknown>} */ (value);
  const label = action.label == null ? '' : String(action.label).trim();
  if (!label) return null;
  const kind = ['primary', 'danger', 'ghost'].includes(String(action.kind))
    ? /** @type {'primary'|'danger'|'ghost'} */ (action.kind) : 'default';
  return {
    label,
    kind,
    onclick: typeof action.onclick === 'function'
      ? /** @type {(event: MouseEvent) => void} */ (action.onclick) : null
  };
}

/**
 * Accepts a node, or a component such as an Avatar, for the leading slot.
 * @param {any} value Leading content.
 * @returns {Node|null}
 */
function resolveLeading(value) {
  if (isNode(value)) return /** @type {Node} */ (value);
  if (value && typeof value === 'object' && typeof value.toElement === 'function') {
    const element = value.toElement();
    return isNode(element) ? element : null;
  }
  return null;
}

/**
 * Hands focus back to where it came from when a message closes with focus inside it, so a keyboard
 * reader is not dropped on the page body with the element they were on gone.
 * @param {any} entry Message entry.
 * @returns {void}
 */
function returnFocus(entry) {
  const root = entry.node.getRootNode?.();
  const active = root?.activeElement ?? globalThis.document?.activeElement;
  if (!active || !entry.node.contains(active)) return;
  const target = entry.returnFocus;
  entry.returnFocus = null;
  if (target?.isConnected && typeof target.focus === 'function') target.focus({ preventScroll: true });
}

/** @param {unknown} value @returns {number} */
function normalizeLimit(value) {
  const limit = Number(value);
  return Number.isInteger(limit) && limit > 0 ? limit : 5;
}

/** @param {unknown} value @returns {boolean} */
function isNode(value) {
  return Boolean(value && typeof value === 'object' && typeof value.nodeType === 'number');
}

/** @param {unknown} value @returns {number} */
function clampPercent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.min(100, Math.max(0, number));
}

/** @param {any} entry @param {{pct: number, text: string}} state @returns {void} */
function syncProgress(entry, state) {
  entry.content.firstChild.textContent = state.text;
  entry.progressBar?.setAttribute('aria-valuenow', String(state.pct));
  entry.progressBar?.setAttribute('aria-label', state.text);
  if (entry.progressFill) entry.progressFill.style.inlineSize = `${state.pct}%`;
}

/** @param {any} entry @returns {void} */
function clearEntryTimers(entry) {
  if (entry.timer !== null) clearTimeout(entry.timer);
  if (entry.exitTimer !== null) clearTimeout(entry.exitTimer);
  entry.timer = null;
  entry.exitTimer = null;
}

/** @returns {boolean} */
function shouldAnimate() {
  return typeof matchMedia !== 'function' ||
    matchMedia('(prefers-reduced-motion: no-preference)').matches;
}

/** @param {Element} element @returns {{attributes: [string, string][], children: Node[]}} */
function snapshot(element) {
  return {
    attributes: Array.from(element.attributes, (attribute) => [attribute.name, attribute.value]),
    children: Array.from(element.childNodes)
  };
}

/** @param {Element} element @param {{attributes: [string, string][], children: Node[]}} state */
function restore(element, state) {
  for (const attribute of Array.from(element.attributes)) element.removeAttribute(attribute.name);
  for (const [name, value] of state.attributes) element.setAttribute(name, value);
  element.replaceChildren(...state.children);
}

/**
 * Fired when a stack opens: the pointer came over it, focus came into it, it was pressed, or
 * `expand()` was called.
 * @event Message#expand
 * @type {CustomEvent<Record<string, never>>}
 */

/**
 * Fired when a stack closes again.
 * @event Message#collapse
 * @type {CustomEvent<Record<string, never>>}
 */
