import { Component } from '../../core/component.js';
import { h, resolveElement } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { overlayScope } from '../../core/overlay-host.js';
import { overlayStack } from '../../core/overlay-stack.js';
import { button } from '../button/button.js';

/** @typedef {'info'|'success'|'warning'|'error'} MessageKind */

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
 * @property {Element|string|null} [scope=null] Element whose nearest Zx theme scope owns a floating toast.
 */

/**
 * @typedef {Object} MessageOptions
 * @property {MessageKind|'danger'} [kind='info'] Default message intent.
 * @property {number} [timeout=4000] Default auto-dismiss delay.
 * @property {boolean} [closable=true] Default close-button visibility.
 * @property {number} [maxVisible=5] Maximum number of visible messages.
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
 * @extends {Component<MessageOptions>}
 */
export class Message extends Component {
  static cssName = 'message';

  /** @type {Readonly<MessageOptions>} */
  static defaults = {
    kind: 'info',
    timeout: 4000,
    closable: true,
    maxVisible: 5
  };

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
    /** @type {import('../../core/overlay-stack.js').OverlayHandle|null} The region's toast entry. */
    this._overlay = null;
    /** @type {(() => void)|null} Stops following the overlay stack. */
    this._unfollow = null;
    this._queue = new MessageQueue(normalizeLimit(this.options.maxVisible), (entry) => {
      this._activate(entry);
    });
    root.replaceChildren();
    root.setAttribute('role', 'status');
    root.setAttribute('aria-live', 'polite');
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
      leading: resolveLeading(options.leading)
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
    return this.#floatingRegion(options.scope).show(msg, options);
  }

  /**
   * Shows a floating progress status.
   * @param {string} text Initial status text.
   * @param {{scope?: Element|string|null}} [options={}] Floating-region scope.
   * @returns {ProgressHandle}
   */
  static progress(text, options = {}) {
    return this.#floatingRegion(options.scope)._progress(text);
  }

  /**
   * Removes a floating region at once, toasts and all, without waiting for them to time out.
   *
   * A region already removes itself when its last toast closes, and one whose host has left the
   * document is replaced on the next toast, so this is only for a host being torn down while
   * toasts are still showing — an application view unmounting its themed shell, say.
   * @param {Element|string} scope Element or selector whose nearest Zx theme scope owns the region,
   *   as passed to `show()`.
   * @returns {boolean} Whether there was a region to remove.
   */
  static disposeRegion(scope) {
    if (scope == null) return false;
    const context = resolveElement(scope);
    if (!context) return false;
    const region = Message.#regionFor(overlayScope(context));
    if (!region) return false;
    region._disposeFloating();
    return true;
  }

  /** @returns {void} */
  destroy() {
    if (this._cleaned) return;
    this._cleaned = true;
    this._unfollow?.();
    this._unfollow = null;
    const overlay = this._overlay;
    this._overlay = null;
    overlay?.release();
    this._floatingHost = null;
    this._placedIn = null;
    for (const entry of this._entries) {
      clearEntryTimers(entry);
      entry.node.remove();
    }
    this._queue.clear();
    this._entries.clear();
    super.destroy();
    if (!this._createdRoot && this._original) restore(this.el, this._original);
  }

  /** @param {string} text @returns {ProgressHandle} */
  _progress(text) {
    const state = { pct: 0, text: String(text) };
    const entry = this._createEntry(state.text, {
      kind: 'info', timeout: 0, closable: false
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
        entry.remaining = 4000;
        if (this._queue.isActive(entry)) this._schedule(entry);
      }
    };
  }

  /**
   * @param {string|Node} msg
   * @param {{kind: MessageKind, timeout: number, closable: boolean, action?: MessageAction|null, leading?: Node|null}} settings
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
      progressFill: null
    };
    if (settings.leading) node.dataset.leading = '';

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
      }, icon('x', { size: 14 }));
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
    this.el.append(entry.node);
    this._schedule(entry);
  }

  /** @param {any} entry @returns {void} */
  _schedule(entry) {
    if (entry.closed || entry.remaining <= 0 || entry.hovered || entry.focused) return;
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
    if (entry.closed || entry.timer !== null || entry.hovered || entry.focused) return;
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
    returnFocus(entry);
    if (!this._queue.isActive(entry)) {
      this._queue.remove(entry);
      entry.node.remove();
      this._entries.delete(entry);
      this._releaseIfEmpty();
      return;
    }

    entry.node.dataset.state = 'closing';
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
    entry.node.remove();
    this._entries.delete(entry);
    this._queue.remove(entry);
    this._releaseIfEmpty();
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
   * Finds or creates the floating region for a scope. A cached region is reused only while it is
   * still where it was put: a host emptied by `replaceChildren()` would otherwise keep receiving
   * toasts in a node nobody can see.
   * @param {Element|string|null|undefined} scope
   * @returns {Message}
   */
  static #floatingRegion(scope) {
    let host = overlayScope(scope ?? null);
    // A scope that has itself left the document cannot show anything; the toast still must be seen.
    if (!host.isConnected) host = overlayScope(null);
    const existing = this.#regionFor(host);
    if (existing && existing.el.isConnected && existing.el.parentElement === existing._placedIn) {
      existing._rehome();
      return existing;
    }
    existing?._disposeFloating();
    const region = h('div', {
      class: 'zx-message-region',
      popover: 'manual',
      role: 'status',
      ariaLive: 'polite'
    });
    const floating = new Message(region);
    floating._floatingHost = host;
    // A toast entry on the overlay stack: the registry of regions, and the reason a press on a
    // toast dismisses no drawer or menu. Following the stack moves the region into a modal dialog
    // when one opens and back out when it closes.
    floating._overlay = overlayStack.push({ kind: 'toast', root: region, owner: floating });
    floating._unfollow = overlayStack.subscribe(() => floating._rehome());
    floating._rehome();
    return floating;
  }

  /**
   * The live floating region of a theme scope, from the overlay stack's toast entries.
   * @param {Element} host Theme scope.
   * @returns {Message|null}
   */
  static #regionFor(host) {
    for (const entry of overlayStack.entries()) {
      if (entry.kind === 'toast' && entry.owner instanceof Message && entry.owner._floatingHost === host) {
        return entry.owner;
      }
    }
    return null;
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
