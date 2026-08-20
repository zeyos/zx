import { Component } from '../../core/component.js';
import { h, resolveElement } from '../../core/dom.js';
import { position } from '../../core/position.js';
import { uid } from '../../core/util.js';

/** Placements accepted by the option and understood by `position()`. */
const PLACEMENTS = new Set(['top', 'bottom', 'top-start', 'top-end', 'bottom-start', 'bottom-end']);
/** Trigger modes. `manual` installs no listeners at all. */
const TRIGGERS = new Set(['hover', 'focus', 'both', 'manual']);

/**
 * @typedef {string|number|Node|{toElement: () => Node|null}|null} TooltipContentValue
 * A value the tooltip can render: text, a node, or anything exposing `toElement()`.
 */
/**
 * @typedef {TooltipContentValue|(() => TooltipContentValue)} TooltipContent
 * Tooltip content, or a function returning it. A function is called on every open, so a tooltip
 * can describe state that changes between hovers.
 */

/**
 * @typedef {Object} TooltipOptions
 * @property {TooltipContent} [content=''] Bubble content, re-evaluated on each open when a function.
 * @property {'top'|'bottom'|'top-start'|'top-end'|'bottom-start'|'bottom-end'} [placement='top'] Preferred side; flips when it would overflow.
 * @property {number} [offset=6] Gap between anchor and bubble in pixels.
 * @property {number} [delay=400] Delay before a hover opens the tooltip, in milliseconds.
 * @property {number} [hideDelay=80] Delay before a leave or blur closes it, in milliseconds.
 * @property {number|string} [maxWidth=260] Maximum bubble width; a number is pixels, a string is any CSS length.
 * @property {'hover'|'focus'|'both'|'manual'} [trigger='both'] Which interactions open the tooltip.
 * @property {boolean} [disabled=false] Whether the tooltip starts suppressed.
 * @property {(event: CustomEvent<Record<string, never>>) => void} [onopen] Open event listener.
 * @property {(event: CustomEvent<Record<string, never>>) => void} [onclose] Close event listener.
 */

/**
 * A non-interactive description bubble anchored to another element.
 *
 * The bubble is a manual popover in the top layer, positioned by `position()` from the kernel, so
 * it escapes clipping and stacking contexts and flips near a viewport edge. It never takes focus
 * and never receives pointer events: it describes the anchor rather than adding a target of its
 * own. While open, the anchor carries `aria-describedby` pointing at the bubble; closing restores
 * whatever the anchor had before — including nothing at all.
 *
 * A hover opens it after `delay`; keyboard focus opens it at once, because a keyboard user has no
 * way to "hover a little longer". Touch never opens it: a bubble that cannot be dismissed by
 * moving the pointer away would simply stick, so touch pointers are ignored and the anchor is left
 * to its own label.
 * @fires Tooltip#open
 * @fires Tooltip#close
 * @extends {Component<TooltipOptions>}
 */
export class Tooltip extends Component {
  static cssName = 'tooltip';

  /** @type {Readonly<TooltipOptions>} */
  static defaults = {
    content: '',
    placement: 'top',
    offset: 6,
    delay: 400,
    hideDelay: 80,
    maxWidth: 260,
    trigger: 'both',
    disabled: false
  };

  /** @type {Element} */
  #anchor;
  /** @type {TooltipContent} */
  #content;
  /** @type {ReturnType<typeof position>|null} */
  #position = null;
  /** The anchor's `aria-describedby` before this tooltip touched it; `null` when it had none. */
  #describedBy = null;
  /** Handle of the pending open timer; `0` when none is scheduled. */
  #openTimer = 0;
  /** Handle of the pending close timer; `0` when none is scheduled. */
  #closeTimer = 0;
  /** True between `pointerdown` and `pointerup`, so a click-induced focus cannot re-open. */
  #pointerActive = false;
  #disabled = false;
  #destroyed = false;

  /**
   * Attaches a tooltip to an existing element.
   * @param {Element|string} anchor Anchor element or selector.
   * @param {TooltipOptions} [options={}] Tooltip options.
   */
  constructor(anchor, options = {}) {
    const resolved = resolveElement(anchor);
    if (!resolved) throw new TypeError('Tooltip anchor could not be resolved');
    super(null, options);

    this.#anchor = resolved;
    this.#content = this.options.content;
    this.#disabled = Boolean(this.options.disabled);
    this.#describedBy = resolved.getAttribute('aria-describedby');
    this.el.style.setProperty('--zx-tooltip-max-inline-size', cssLength(this.options.maxWidth));

    const trigger = TRIGGERS.has(this.options.trigger) ? this.options.trigger : 'both';
    if (trigger === 'manual') return;

    if (trigger === 'hover' || trigger === 'both') {
      this.listen(this.#anchor, 'pointerenter', (event) => {
        // A touch tooltip has no "move away" gesture to close it, so it would stick open.
        if (/** @type {PointerEvent} */ (event).pointerType === 'touch') return;
        this.#scheduleShow(Number(this.options.delay));
      });
      this.listen(this.#anchor, 'pointerleave', () => this.#scheduleHide(Number(this.options.hideDelay)));
    }

    if (trigger === 'focus' || trigger === 'both') {
      this.listen(this.#anchor, 'focusin', () => {
        // Focus that came from a click is not a request for a tooltip; the pointer already closed it.
        if (this.#pointerActive || !isFocusVisible(this.#anchor)) return;
        this.#scheduleShow(0);
      });
      this.listen(this.#anchor, 'focusout', () => this.#scheduleHide(Number(this.options.hideDelay)));
    }

    // Dismissal. Escape satisfies WCAG 1.4.13; the pointer and focus rules also keep two tooltips
    // from ever being visible at once without a module-level registry to coordinate them.
    this.listen(document, 'keydown', (event) => {
      if (/** @type {KeyboardEvent} */ (event).key !== 'Escape' || !this.isOpen()) return;
      event.preventDefault();
      this.hide();
    });
    this.listen(document, 'pointerdown', () => {
      this.#pointerActive = true;
      this.#cancelTimers();
      this.hide();
    }, { capture: true });
    this.listen(document, 'pointerup', () => { this.#pointerActive = false; }, { capture: true });
    this.listen(document, 'pointercancel', () => { this.#pointerActive = false; }, { capture: true });
    this.listen(document, 'focusin', (event) => {
      if (!this.isOpen()) return;
      const path = event.composedPath();
      if (path.includes(this.#anchor)) return;
      this.hide();
    });
  }

  /**
   * Creates the owned bubble. Runs inside the base constructor, so it touches nothing but the DOM.
   * @returns {HTMLElement}
   */
  render() {
    const panel = h('div', {
      id: uid('zx-tooltip'),
      role: 'tooltip',
      popover: 'manual'
    });
    panel.dataset.state = 'closed';
    document.body.append(panel);
    return panel;
  }

  /**
   * Opens the tooltip, evaluating the content first. Does nothing while disabled, already open, or
   * when the content resolves to nothing.
   * @returns {this}
   * @fires Tooltip#open
   */
  show() {
    if (this.#destroyed || this.#disabled || this.isOpen()) return this;
    this.#cancelTimers();
    const node = resolveContent(this.#content);
    if (node === null) return this;

    this.el.replaceChildren(node);
    this.#position = position(this.#anchor, /** @type {HTMLElement} */ (this.el), {
      placement: PLACEMENTS.has(this.options.placement) ? this.options.placement : 'top',
      offset: Number(this.options.offset),
      flip: true
    });
    this.el.dataset.state = 'open';
    this.#anchor.setAttribute('aria-describedby', appendToken(this.#describedBy, this.el.id));
    this.emit('open');
    return this;
  }

  /**
   * Closes the tooltip and restores the anchor's original `aria-describedby`.
   * @returns {this}
   * @fires Tooltip#close
   */
  hide() {
    this.#cancelTimers();
    if (!this.isOpen()) return this;
    this.#position?.destroy();
    this.#position = null;
    this.el.dataset.state = 'closed';
    this.el.replaceChildren();
    this.#restoreDescribedBy();
    this.emit('close');
    return this;
  }

  /**
   * Opens a closed tooltip, closes an open one.
   * @returns {this}
   */
  toggle() {
    return this.isOpen() ? this.hide() : this.show();
  }

  /**
   * Reports whether the bubble is currently visible.
   * @returns {boolean}
   */
  isOpen() {
    return this.#position !== null;
  }

  /**
   * Replaces the content. Strings are never parsed as HTML. A function is stored, not called, and
   * runs on every subsequent open.
   * @param {TooltipContent} content Next content.
   * @returns {this}
   */
  setContent(content) {
    this.#content = content;
    if (!this.isOpen()) return this;
    const node = resolveContent(content);
    if (node === null) return this.hide();
    this.el.replaceChildren(node);
    this.#position?.update();
    return this;
  }

  /**
   * Allows the tooltip to open again.
   * @returns {this}
   */
  enable() {
    this.#disabled = false;
    return this;
  }

  /**
   * Suppresses the tooltip and closes it if it is open.
   * @returns {this}
   */
  disable() {
    this.#disabled = true;
    return this.hide();
  }

  /**
   * Reports whether the tooltip is currently suppressed.
   * @returns {boolean}
   */
  isDisabled() {
    return this.#disabled;
  }

  /**
   * Returns the anchor the tooltip describes.
   * @returns {Element}
   */
  getAnchor() {
    return this.#anchor;
  }

  /**
   * Closes the tooltip, removes the bubble, and puts the anchor's ARIA back as it was found.
   * @returns {void}
   */
  destroy() {
    if (this.#destroyed) return;
    this.#destroyed = true;
    this.hide();
    this.#restoreDescribedBy();
    super.destroy();
  }

  /** @param {number} delay @returns {void} */
  #scheduleShow(delay) {
    this.#cancelTimers();
    if (this.#destroyed || this.#disabled || this.isOpen()) return;
    const ms = Number.isFinite(delay) ? Math.max(0, delay) : 0;
    if (ms === 0) {
      this.show();
      return;
    }
    this.#openTimer = setTimeout(() => {
      this.#openTimer = 0;
      this.show();
    }, ms);
  }

  /** @param {number} delay @returns {void} */
  #scheduleHide(delay) {
    this.#cancelTimers();
    if (!this.isOpen()) return;
    const ms = Number.isFinite(delay) ? Math.max(0, delay) : 0;
    if (ms === 0) {
      this.hide();
      return;
    }
    this.#closeTimer = setTimeout(() => {
      this.#closeTimer = 0;
      this.hide();
    }, ms);
  }

  /** @returns {void} */
  #cancelTimers() {
    if (this.#openTimer !== 0) clearTimeout(this.#openTimer);
    if (this.#closeTimer !== 0) clearTimeout(this.#closeTimer);
    this.#openTimer = 0;
    this.#closeTimer = 0;
  }

  /** @returns {void} */
  #restoreDescribedBy() {
    if (this.#describedBy === null) this.#anchor.removeAttribute('aria-describedby');
    else this.#anchor.setAttribute('aria-describedby', this.#describedBy);
  }
}

/**
 * Fired when the bubble becomes visible. Never fired for a `show()` on an open tooltip.
 * @event Tooltip#open
 * @type {CustomEvent<Record<string, never>>}
 */

/**
 * Fired when the bubble is hidden. Never fired for a `hide()` on a closed tooltip.
 * @event Tooltip#close
 * @type {CustomEvent<Record<string, never>>}
 */

/**
 * Creates a tooltip from either a content value or a full option object.
 * @param {Element|string} anchor Anchor element or selector.
 * @param {TooltipContent|TooltipOptions} [contentOrOptions=''] Content, or tooltip options.
 * @returns {Tooltip}
 */
export function tooltip(anchor, contentOrOptions = '') {
  return new Tooltip(anchor, isOptionsObject(contentOrOptions)
    ? /** @type {TooltipOptions} */ (contentOrOptions)
    : { content: /** @type {TooltipContent} */ (contentOrOptions) });
}

/**
 * Attaches a plain-text tooltip with every default in place — the one-liner replacement for a
 * `title` attribute.
 * @param {Element|string} anchor Anchor element or selector.
 * @param {string} text Description text, inserted as a text node.
 * @returns {Tooltip}
 */
export function describe(anchor, text) {
  return new Tooltip(anchor, { content: String(text ?? '') });
}

/**
 * Distinguishes an option object from a content value. Nodes, functions, arrays, and primitives
 * are content; anything else that is a plain object is options.
 * @param {unknown} value Second argument of {@link tooltip}.
 * @returns {boolean}
 */
function isOptionsObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  if (typeof (/** @type {any} */ (value).nodeType) === 'number') return false;
  return typeof (/** @type {any} */ (value).toElement) !== 'function';
}

/**
 * Evaluates tooltip content into a single node, or null when there is nothing to show.
 * @param {TooltipContent} content Stored content.
 * @returns {Node|null}
 */
function resolveContent(content) {
  const value = typeof content === 'function' ? content() : content;
  if (value === null || value === undefined) return null;
  if (typeof value === 'object' && typeof (/** @type {any} */ (value).nodeType) === 'number') {
    return /** @type {Node} */ (value);
  }
  if (typeof value === 'object' && typeof (/** @type {any} */ (value).toElement) === 'function') {
    return /** @type {any} */ (value).toElement();
  }
  const text = String(value);
  return text === '' ? null : document.createTextNode(text);
}

/**
 * Adds an id to a space-separated token list without duplicating it.
 * @param {string|null} list Existing attribute value.
 * @param {string} token Token to add.
 * @returns {string}
 */
function appendToken(list, token) {
  const tokens = String(list ?? '').split(/\s+/).filter(Boolean);
  if (!tokens.includes(token)) tokens.push(token);
  return tokens.join(' ');
}

/**
 * Normalizes a length option: a number is pixels, a string is passed through.
 * @param {number|string} value Length option.
 * @returns {string}
 */
function cssLength(value) {
  return typeof value === 'number' && Number.isFinite(value) ? `${value}px` : String(value);
}

/**
 * Reports whether an element is focused in a way that deserves a visible affordance. Browsers
 * without `:focus-visible` fall back to treating every focus as visible.
 * @param {Element} element Focused element.
 * @returns {boolean}
 */
function isFocusVisible(element) {
  try {
    return element.matches(':focus-visible');
  } catch {
    return true;
  }
}
