import { Component } from '../../core/component.js';
import { h } from '../../core/dom.js';
import { icon } from '../../core/icons.js';

/** @typedef {'info'|'success'|'warning'|'error'} MessageKind */

/**
 * @typedef {Object} MessageShowOptions
 * @property {MessageKind|'danger'} [kind='info'] Message intent (`danger` aliases `error`).
 * @property {number} [timeout=4000] Auto-dismiss delay in milliseconds; zero persists.
 * @property {boolean} [closable=true] Whether to render a close button.
 */

/**
 * @typedef {Object} MessageOptions
 * @property {MessageKind|'danger'} [kind='info'] Default message intent.
 * @property {number} [timeout=4000] Default auto-dismiss delay.
 * @property {boolean} [closable=true] Default close-button visibility.
 * @property {number} [maxVisible=5] Maximum number of visible messages.
 */

/** @typedef {{close: () => void}} MessageHandle */

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

  /** @type {Message|null} */
  static #floating = null;

  /** @returns {HTMLElement} */
  render() {
    const created = !this.el;
    const root = /** @type {HTMLElement} */ (this.el ?? h('div'));
    this._createdRoot = created;
    this._original = created ? null : snapshot(root);
    this._entries = new Set();
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
    const settings = {
      kind: normalizeKind(options.kind ?? this.options.kind),
      timeout: normalizeTimeout(options.timeout ?? this.options.timeout),
      closable: options.closable ?? Boolean(this.options.closable)
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
    return this.#floatingRegion().show(msg, options);
  }

  /**
   * Shows a floating progress status.
   * @param {string} text Initial status text.
   * @returns {ProgressHandle}
   */
  static progress(text) {
    return this.#floatingRegion()._progress(text);
  }

  /** @returns {void} */
  destroy() {
    if (this._cleaned) return;
    this._cleaned = true;
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
   * @param {{kind: MessageKind, timeout: number, closable: boolean}} settings
   * @param {{pct: number, text: string}|null} [progress=null]
   * @returns {any}
   */
  _createEntry(msg, settings, progress = null) {
    const iconHost = h('span', { class: 'zx-message__icon', ariaHidden: 'true' },
      icon(settings.kind, { size: 18 })
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
      progressBar: null,
      progressFill: null
    };

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

    if (settings.closable) {
      const close = h('button', {
        class: 'zx-message__close',
        type: 'button',
        ariaLabel: 'Close message',
        title: 'Close'
      }, icon('x', { size: 15 }));
      node.append(close);
      this.listen(close, 'click', () => this._close(entry));
    }
    this.listen(node, 'mouseenter', () => this._pause(entry));
    this.listen(node, 'mouseleave', () => this._resume(entry));
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
    if (entry.closed || entry.remaining <= 0) return;
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
    if (entry.closed || entry.timer !== null) return;
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
    if (!this._queue.isActive(entry)) {
      this._queue.remove(entry);
      entry.node.remove();
      this._entries.delete(entry);
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
  }

  /** @returns {Message} */
  static #floatingRegion() {
    if (this.#floating) return this.#floating;
    const region = h('div', {
      class: 'zx-message-region',
      popover: 'manual',
      role: 'status',
      ariaLive: 'polite'
    });
    document.body.append(region);
    this.#floating = new Message(region);
    if (typeof region.showPopover === 'function') region.showPopover();
    return this.#floating;
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
