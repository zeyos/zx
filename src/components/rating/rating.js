import { Component } from '../../core/component.js';
import { h, restoreTarget, snapshotTarget } from '../../core/dom.js';
import { printf } from '../../core/i18n.js';
import { icon as createIcon } from '../../core/icons.js';
import { uid } from '../../core/util.js';

/**
 * @typedef {Object} RatingOptions
 * @property {number} [value=0] Initial rating; 0 means unrated.
 * @property {number} [max=5] Number of symbols.
 * @property {boolean} [allowHalf=false] Whether half steps are selectable.
 * @property {boolean} [clearable=true] Whether re-selecting the current value clears it.
 * @property {boolean} [readonly=false] Whether the rating is display-only.
 * @property {boolean} [disabled=false] Whether interaction is disabled.
 * @property {string} [label='Rating'] Accessible name of the group.
 * @property {string} [icon='star'] Icon name used for each symbol.
 * @property {string[]|null} [labels=null] Per-step accessible names, lowest first.
 * @property {boolean} [showValue=false] Whether to render the numeric value beside the symbols.
 * @property {number|null} [count=null] Optional rating count rendered beside the value.
 * @property {'sm'|'md'|'lg'} [size='md'] Symbol size.
 * @property {Record<string, string>|Record<string, Record<string, string>>} [msg] Localized messages.
 * @property {(event: CustomEvent<{value: number}>) => void} [onchange] Change listener.
 * @property {(event: CustomEvent<{value: number|null}>) => void} [onhover] Hover-preview listener.
 */

/**
 * Star-rating control implementing the APG radio-group pattern: one radio per selectable step,
 * a single tab stop, and arrow-key navigation. Half steps add a second radio per symbol rather
 * than bending the radio semantics, so every reachable value has a real, nameable control.
 *
 * @fires Rating#change
 * @fires Rating#hover
 * @extends {Component<RatingOptions>}
 */
export class Rating extends Component {
  static cssName = 'rating';

  /** @type {RatingOptions} */
  static defaults = {
    value: 0,
    max: 5,
    allowHalf: false,
    clearable: true,
    readonly: false,
    disabled: false,
    label: 'Rating',
    icon: 'star',
    labels: null,
    showValue: false,
    count: null,
    size: 'md'
  };

  /** @returns {HTMLElement} */
  render() {
    // render() runs inside the base constructor, before class-field initializers would run.
    this._value = 0;
    this._preview = null;
    this._disabled = false;
    this._readonly = false;
    this._radios = [];
    this._createdRoot = this.el === null;
    this._snapshot = this._createdRoot ? null : snapshotTarget(this.el);

    const root = /** @type {HTMLElement} */ (this.el ?? h('div'));
    this.el = root;

    this._max = Math.max(1, Math.trunc(Number(this.options.max) || 5));
    this._step = this.options.allowHalf ? 0.5 : 1;
    this._disabled = Boolean(this.options.disabled);
    this._readonly = Boolean(this.options.readonly);
    this._name = uid('zx-rating');

    const symbols = h('div', {
      ref: 'symbols',
      class: 'zx-rating__symbols',
      role: 'radiogroup',
      ariaLabel: String(this.options.label ?? 'Rating')
    });

    for (let index = 1; index <= this._max; index += 1) {
      const symbol = h('span', { class: 'zx-rating__symbol' },
        h('span', { class: 'zx-rating__glyph', ariaHidden: 'true' },
          createIcon(this.options.icon, { size: SIZES[this.options.size] ?? SIZES.md })),
        h('span', { class: 'zx-rating__glyph', dataset: { part: 'on' }, ariaHidden: 'true' },
          createIcon(this.options.icon, { size: SIZES[this.options.size] ?? SIZES.md }))
      );
      if (this.options.allowHalf) {
        symbol.append(this._radio(index - 0.5, 'half'), this._radio(index, 'full'));
      } else {
        symbol.append(this._radio(index, 'full'));
      }
      symbols.append(symbol);
    }

    // The readout is always rendered (empty when there is nothing to show) so `setCount()` can
    // start displaying a count on a component created without one.
    root.replaceChildren(symbols, h('span', { ref: 'readout', class: 'zx-rating__readout' }));
    root.dataset.size = SIZES[this.options.size] ? this.options.size : 'md';

    this.listen(symbols, 'keydown', (event) => this._onKeydown(/** @type {KeyboardEvent} */ (event)));
    this.listen(symbols, 'pointerleave', () => this._setPreview(null));

    this.set(this.options.value, { silent: true });
    this._syncDisabled();
    return root;
  }

  /** Current rating. @returns {number} */
  get value() {
    return this._value;
  }

  /** @param {number} next Next rating. */
  set value(next) {
    this.set(next);
  }

  /**
   * Returns the current rating.
   * @returns {number}
   */
  get() {
    return this._value;
  }

  /**
   * Sets the rating, snapped to the configured step and clamped to `[0, max]`.
   * @param {number} next Next rating; 0 clears it.
   * @param {{silent?: boolean}} [options={}] Set `silent` to suppress `change`.
   * @returns {this}
   * @fires Rating#change
   */
  set(next, { silent = false } = {}) {
    const value = this._clamp(next);
    const changed = value !== this._value;
    this._value = value;
    // Drop any hover/focus preview so the glyphs show the value that was just set.
    this._preview = null;
    this._sync();
    if (changed && !silent) this.emit('change', { value: this._value });
    return this;
  }

  /**
   * Clears the rating.
   * @param {{silent?: boolean}} [options={}] Set `silent` to suppress `change`.
   * @returns {this}
   */
  clear({ silent = false } = {}) {
    return this.set(0, { silent });
  }

  /**
   * Restores the configured initial value.
   * @param {{silent?: boolean}} [options={}] Reset behavior.
   * @returns {this}
   */
  reset({ silent = false } = {}) {
    return this.set(this.options.value, { silent });
  }

  /**
   * Replaces the rating count shown beside the value.
   * @param {number|null} count Number of ratings, or null to hide it.
   * @returns {this}
   */
  setCount(count) {
    this._count = count;
    this._syncReadout();
    return this;
  }

  /** Focuses the selected step, or the first one when unrated. @returns {this} */
  focus() {
    const active = this._radios.find((radio) => radio.tabIndex === 0) ?? this._radios[0];
    active?.focus();
    return this;
  }

  /** Enables user interaction. @returns {this} */
  enable() {
    this._disabled = false;
    this._syncDisabled();
    return this;
  }

  /** Disables user interaction. @returns {this} */
  disable() {
    this._disabled = true;
    this._syncDisabled();
    return this;
  }

  /**
   * Sets the read-only state.
   * @param {boolean} readonly Whether the rating is display-only.
   * @returns {this}
   */
  setReadonly(readonly) {
    this._readonly = Boolean(readonly);
    this._syncDisabled();
    return this;
  }

  /**
   * Builds one selectable step.
   * @param {number} value Step value.
   * @param {'half'|'full'} part Which half of the symbol the control covers.
   * @returns {HTMLButtonElement}
   */
  _radio(value, part) {
    const button = /** @type {HTMLButtonElement} */ (h('button', {
      class: 'zx-rating__radio',
      type: 'button',
      role: 'radio',
      tabIndex: -1,
      ariaChecked: 'false',
      ariaLabel: this._stepLabel(value),
      dataset: { value: String(value), part }
    }));
    this.listen(button, 'click', (event) => {
      // `detail` is 0 for keyboard-synthesized clicks; only a real pointer press may clear.
      this._choose(value, /** @type {MouseEvent} */ (event).detail > 0);
    });
    this.listen(button, 'pointerenter', () => this._setPreview(value));
    this.listen(button, 'focus', () => this._setPreview(value));
    this.listen(button, 'blur', () => this._setPreview(null));
    this._radios.push(button);
    return button;
  }

  /**
   * @param {number} value Step value.
   * @returns {string}
   */
  _stepLabel(value) {
    const labels = this.options.labels;
    if (Array.isArray(labels)) {
      const index = Math.round(value / this._step) - 1;
      if (labels[index] != null) return String(labels[index]);
    }
    return this._message('rating.value', '%1 of %2', [value, this._max]);
  }

  /**
   * Resolves a localized message, falling back to a built-in template.
   * @param {string} key Message key.
   * @param {string} fallback Template used when the host has no translation.
   * @param {unknown[]} args Positional interpolation values.
   * @returns {string}
   */
  _message(key, fallback, args) {
    const message = this.msg(key, ...args);
    return message === key ? printf(fallback, args) : message;
  }

  /**
   * Applies an activation, honoring `clearable`.
   * @param {number} value Step value.
   * @param {boolean} allowClear Whether re-selecting the current value may clear it. Keyboard
   *   activation never clears, because the APG radio pattern requires Space on an already
   *   checked radio to do nothing.
   * @returns {void}
   */
  _choose(value, allowClear) {
    if (this._disabled || this._readonly) return;
    if (allowClear && this.options.clearable && value === this._value) this.set(0);
    else this.set(value);
  }

  /** @param {KeyboardEvent} event @returns {void} */
  _onKeydown(event) {
    if (this._disabled || this._readonly) return;
    // APG radio group: Right/Down move to the next radio, Left/Up to the previous, both wrapping.
    const forward = ['ArrowRight', 'ArrowDown'];
    const backward = ['ArrowLeft', 'ArrowUp'];
    if (forward.includes(event.key)) {
      event.preventDefault();
      this.set(this._value >= this._max ? this._step : (this._value || 0) + this._step);
    } else if (backward.includes(event.key)) {
      event.preventDefault();
      this.set(this._value <= this._step ? this._max : this._value - this._step);
    } else if (event.key === 'Home') {
      event.preventDefault();
      this.set(this._step);
    } else if (event.key === 'End') {
      event.preventDefault();
      this.set(this._max);
    } else if ((event.key === 'Delete' || event.key === 'Backspace') && this.options.clearable) {
      event.preventDefault();
      this.set(0);
    } else {
      return;
    }
    this.focus();
  }

  /**
   * @param {number|null} value Previewed value, or null to drop the preview.
   * @returns {void}
   */
  _setPreview(value) {
    const next = this._disabled || this._readonly ? null : value;
    if (next === this._preview) return;
    this._preview = next;
    this._paint();
    this.emit('hover', { value: this._preview });
  }

  /** @param {unknown} raw @returns {number} */
  _clamp(raw) {
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0) return 0;
    const snapped = Math.round(value / this._step) * this._step;
    return Math.min(this._max, Math.max(0, snapped));
  }

  /** @returns {void} */
  _sync() {
    for (const radio of this._radios) {
      const value = Number(radio.dataset.value);
      radio.setAttribute('aria-checked', String(value === this._value));
    }
    // APG radio group: exactly one tab stop, on the checked step or the first one when unrated.
    const checked = this._radios.find((radio) => radio.getAttribute('aria-checked') === 'true');
    for (const radio of this._radios) radio.tabIndex = -1;
    (checked ?? this._radios[0]).tabIndex = 0;
    this._paint();
    this._syncReadout();
  }

  /** Paints the filled portion of every symbol from the preview or the value. @returns {void} */
  _paint() {
    const shown = this._preview ?? this._value;
    const symbols = this.refs.symbols.querySelectorAll('.zx-rating__symbol');
    symbols.forEach((symbol, index) => {
      const filled = Math.min(1, Math.max(0, shown - index));
      symbol.style.setProperty('--zx-rating-fill', `${filled * 100}%`);
      symbol.toggleAttribute('data-preview', this._preview !== null);
    });
    this.el.dataset.value = String(shown);
  }

  /** @returns {void} */
  _syncReadout() {
    const readout = this.refs.readout;
    if (!readout) return;
    const count = this._count === undefined ? this.options.count : this._count;
    const parts = [];
    if (this.options.showValue) parts.push(formatValue(this._value, this._step));
    if (count !== null && count !== undefined) {
      parts.push(this._message('rating.count', '%1 ratings', [count]));
    }
    readout.textContent = parts.join(' · ');
  }

  /** @returns {void} */
  _syncDisabled() {
    const inert = this._disabled || this._readonly;
    for (const radio of this._radios) radio.disabled = this._disabled;
    this.refs.symbols.setAttribute('aria-readonly', String(this._readonly));
    this.el.toggleAttribute('data-disabled', this._disabled);
    this.el.toggleAttribute('data-readonly', this._readonly);
    this.el.toggleAttribute('data-inert', inert);
    if (this._disabled) this.el.setAttribute('aria-disabled', 'true');
    else this.el.removeAttribute('aria-disabled');
  }

  /** Restores an enhanced target to the markup it had before the takeover. @returns {void} */
  destroy() {
    const root = this.el;
    super.destroy();
    if (!this._createdRoot && root) restoreTarget(root, this._snapshot);
  }
}

/**
 * Rating change.
 * @event Rating#change
 * @type {CustomEvent<{value: number}>}
 */

/**
 * Hover or focus preview; `value` is null when the pointer leaves the group.
 * @event Rating#hover
 * @type {CustomEvent<{value: number|null}>}
 */

const SIZES = { sm: 14, md: 18, lg: 24 };

/** @param {number} value @param {number} step @returns {string} */
function formatValue(value, step) {
  return step < 1 ? value.toFixed(1) : String(value);
}
