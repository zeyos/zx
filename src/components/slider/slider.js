import { Component } from '../../core/component.js';
import { h, restoreTarget, snapshotTarget } from '../../core/dom.js';
import { clamp, uid } from '../../core/util.js';
import { snapNumber } from '../number-field/number-field.js';

/**
 * @typedef {Object} SliderMark
 * @property {number} value Position on the scale.
 * @property {string} [label] Text drawn under the tick; the value is used when omitted.
 */

/**
 * @typedef {Object} SliderOptions
 * @property {number} [value=0] Initial value, clamped to the range and snapped to `step`.
 * @property {number} [min=0] Lowest selectable value.
 * @property {number} [max=100] Highest selectable value.
 * @property {number} [step=1] Increment between selectable values.
 * @property {string} [label=''] Visible name of the control.
 * @property {boolean} [hideLabel=false] Whether the label is kept for assistive technology only.
 * @property {boolean} [showValue=true] Whether the current value is drawn opposite the label.
 * @property {boolean} [showBounds=false] Whether `min` and `max` are drawn either side of the track.
 * @property {boolean} [showInput=false] Whether a number box is drawn beside the track, for
 *   entering a value precisely rather than dragging to it.
 * @property {string} [unit=''] Suffix appended to the readout.
 * @property {Array<number|SliderMark>|null} [marks=null] Labelled positions under the track.
 * @property {boolean} [disabled=false] Whether the control is disabled.
 * @property {boolean} [readonly=false] Whether the value is displayed but cannot be changed.
 * @property {'md'|'sm'} [size='md'] Control size.
 * @property {((value: number) => string)|null} [formatValue=null] Replaces the default readout.
 * @property {(event: CustomEvent<{value: number}>) => void} [onchange] Committed-value listener.
 * @property {(event: CustomEvent<{value: number}>) => void} [oninput] Listener called while dragging.
 */

/**
 * Range control for a bounded numeric value — a discount rate, a threshold, a weighting.
 *
 * Built on a native `<input type="range">`, which is where the whole keyboard map comes from:
 * arrows step, Page Up/Page Down jump, Home and End go to the bounds, and the value is announced
 * as a slider without a line of ARIA. Everything Zx adds is chrome around it — the filled track,
 * the readout, optional ticks, and an optional number box for entering a value exactly.
 *
 * @fires Slider#change
 * @fires Slider#input
 */
export class Slider extends Component {
  static cssName = 'slider';

  /** @type {SliderOptions} */
  static defaults = {
    value: 0,
    min: 0,
    max: 100,
    step: 1,
    label: '',
    hideLabel: false,
    showValue: true,
    showBounds: false,
    showInput: false,
    unit: '',
    marks: null,
    disabled: false,
    readonly: false,
    size: 'md',
    formatValue: null
  };

  /** @returns {HTMLElement} */
  render() {
    // render() runs inside the base constructor, before class-field initializers would run.
    this._value = 0;
    this._readonly = Boolean(this.options.readonly);
    this._createdRoot = this.el === null;
    this._snapshot = this._createdRoot ? null : snapshotTarget(this.el);

    const root = /** @type {HTMLElement} */ (this.el ?? h('div'));
    this.el = root;

    this._min = Number(this.options.min) || 0;
    this._max = Number(this.options.max);
    if (!Number.isFinite(this._max) || this._max <= this._min) this._max = this._min + 100;
    this._step = Math.abs(Number(this.options.step)) || 1;
    this._id = uid('zx-slider');

    const input = /** @type {HTMLInputElement} */ (h('input', {
      ref: 'input',
      class: 'zx-slider__input',
      type: 'range',
      id: this._id,
      min: String(this._min),
      max: String(this._max),
      step: String(this._step),
      disabled: Boolean(this.options.disabled)
    }));

    const track = h('div', { class: 'zx-slider__track' }, input, this._marks());
    const control = h('div', { class: 'zx-slider__control' });
    if (this.options.showBounds) {
      control.append(h('span', { class: 'zx-slider__bound', ariaHidden: 'true' },
        this._format(this._min)));
    }
    control.append(track);
    if (this.options.showBounds) {
      control.append(h('span', { class: 'zx-slider__bound', ariaHidden: 'true' },
        this._format(this._max)));
    }
    if (this.options.showInput) control.append(this._numberBox());

    root.replaceChildren(
      h('div', { class: 'zx-slider__head' },
        h('label', { ref: 'label', class: 'zx-slider__label', for: this._id },
          String(this.options.label ?? '')),
        h('span', { ref: 'output', class: 'zx-slider__value', ariaHidden: 'true' })
      ),
      control
    );
    root.dataset.size = this.options.size === 'sm' ? 'sm' : 'md';
    root.toggleAttribute('data-hide-label', Boolean(this.options.hideLabel));

    this.listen(input, 'input', () => this._onInput());
    this.listen(input, 'change', () => this._onCommit());
    // A range input has no readonly state of its own, so an edit is taken and put straight back.
    this.listen(input, 'keydown', (event) => {
      if (this._readonly && CHANGE_KEYS.has(/** @type {KeyboardEvent} */ (event).key)) {
        event.preventDefault();
      }
    });

    this.set(this.options.value, { silent: true });
    this._syncState();
    return root;
  }

  /** Current value. @returns {number} */
  get value() {
    return this._value;
  }

  /** @param {number} next Next value. */
  set value(next) {
    this.set(next);
  }

  /**
   * Returns the current value.
   * @returns {number}
   */
  get() {
    return this._value;
  }

  /**
   * Sets the value, snapped to `step` and clamped to the range.
   * @param {number} next Next value.
   * @param {{silent?: boolean}} [options={}] Set `silent` to suppress `change`.
   * @returns {this}
   * @fires Slider#change
   */
  set(next, { silent = false } = {}) {
    const value = this._snap(next);
    const changed = value !== this._value;
    this._value = value;
    this._paint();
    if (changed && !silent) this.emit('change', { value });
    return this;
  }

  /**
   * Replaces the range, re-snapping the current value into it.
   * @param {number} min Lowest selectable value.
   * @param {number} max Highest selectable value.
   * @param {number} [step] Increment; the current one is kept when omitted.
   * @returns {this}
   */
  setRange(min, max, step) {
    const low = Number(min);
    const high = Number(max);
    if (!Number.isFinite(low) || !Number.isFinite(high) || high <= low) {
      throw new RangeError('Slider range requires min < max');
    }
    this._min = low;
    this._max = high;
    if (step !== undefined) this._step = Math.abs(Number(step)) || 1;
    const { input } = this.refs;
    input.min = String(this._min);
    input.max = String(this._max);
    input.step = String(this._step);
    for (const [index, bound] of [...this.el.querySelectorAll('.zx-slider__bound')].entries()) {
      bound.textContent = this._format(index === 0 ? this._min : this._max);
    }
    return this.set(this._value, { silent: true });
  }

  /** Focuses the track. @returns {this} */
  focus() {
    this.refs.input.focus();
    return this;
  }

  /** Enables user interaction. @returns {this} */
  enable() {
    this.refs.input.disabled = false;
    if (this.refs.number) this.refs.number.disabled = false;
    this._syncState();
    return this;
  }

  /** Disables user interaction. @returns {this} */
  disable() {
    this.refs.input.disabled = true;
    if (this.refs.number) this.refs.number.disabled = true;
    this._syncState();
    return this;
  }

  /**
   * Sets the read-only state: the value stays focusable and announced, but cannot be changed.
   * @param {boolean} readonly Whether the value is fixed.
   * @returns {this}
   */
  setReadonly(readonly) {
    this._readonly = Boolean(readonly);
    if (this.refs.number) this.refs.number.readOnly = this._readonly;
    this._syncState();
    return this;
  }

  /**
   * Replaces the visible label.
   * @param {string} label Control name.
   * @returns {this}
   */
  setLabel(label) {
    this.refs.label.textContent = String(label ?? '');
    return this;
  }

  /** @returns {HTMLInputElement} */
  _numberBox() {
    const number = /** @type {HTMLInputElement} */ (h('input', {
      ref: 'number',
      class: 'zx-slider__number',
      type: 'number',
      min: String(this._min),
      max: String(this._max),
      step: String(this._step),
      disabled: Boolean(this.options.disabled),
      readOnly: this._readonly,
      ariaLabel: String(this.options.label ?? 'Value')
    }));
    this.listen(number, 'input', () => {
      if (this._readonly) return;
      const raw = Number(number.value);
      if (number.value === '' || !Number.isFinite(raw)) return;
      this._value = this._snap(raw);
      this.refs.input.value = String(this._value);
      this._paintTrack();
      this.emit('input', { value: this._value });
    });
    // Snapping on the way out, so typing "5" on the way to "50" is not rewritten mid-keystroke.
    this.listen(number, 'change', () => {
      if (this._readonly) {
        number.value = String(this._value);
        return;
      }
      this.set(number.value === '' ? this._min : Number(number.value));
    });
    return number;
  }

  /** @returns {HTMLElement|null} */
  _marks() {
    const marks = this.options.marks;
    if (!Array.isArray(marks) || marks.length === 0) return null;
    const element = h('div', { class: 'zx-slider__marks', ariaHidden: 'true' });
    for (const mark of marks) {
      const value = typeof mark === 'number' ? mark : Number(mark?.value);
      if (!Number.isFinite(value)) continue;
      const label = typeof mark === 'number' ? this._format(value) : String(mark.label ?? this._format(value));
      element.append(h('span', {
        class: 'zx-slider__mark',
        style: { '--zx-slider-mark': `${this._ratio(value) * 100}%` }
      }, label));
    }
    return element;
  }

  /** @returns {void} */
  _onInput() {
    if (this._readonly) {
      this.refs.input.value = String(this._value);
      return;
    }
    this._value = this._snap(this.refs.input.value);
    this._paintTrack();
    if (this.refs.number) this.refs.number.value = String(this._value);
    this.emit('input', { value: this._value });
  }

  /** @returns {void} */
  _onCommit() {
    if (this._readonly) {
      this.refs.input.value = String(this._value);
      return;
    }
    this.emit('change', { value: this._value });
  }

  /** Writes the value into the input, the readout, and the fill. @returns {void} */
  _paint() {
    this.refs.input.value = String(this._value);
    if (this.refs.number) this.refs.number.value = String(this._value);
    this._paintTrack();
  }

  /** @returns {void} */
  _paintTrack() {
    this.el.style.setProperty('--zx-slider-fill', `${this._ratio(this._value) * 100}%`);
    const { output } = this.refs;
    output.textContent = this.options.showValue ? this._format(this._value) : '';
  }

  /** @returns {void} */
  _syncState() {
    const disabled = this.refs.input.disabled;
    this.el.toggleAttribute('data-disabled', disabled);
    this.el.toggleAttribute('data-readonly', this._readonly);
    this.refs.input.setAttribute('aria-readonly', String(this._readonly));
  }

  /**
   * Snaps a raw value onto the step grid and clamps it to the range.
   * @param {unknown} raw Value to snap.
   * @returns {number}
   */
  _snap(raw) {
    const value = Number(raw);
    if (!Number.isFinite(value)) return this._min;
    return snapNumber(value, {
      min: this._min,
      max: this._max,
      step: this._step,
      precision: stepPrecision(this._step)
    });
  }

  /** @param {number} value @returns {number} */
  _ratio(value) {
    return clamp((value - this._min) / (this._max - this._min), 0, 1);
  }

  /** @param {number} value @returns {string} */
  _format(value) {
    const formatter = this.options.formatValue;
    if (typeof formatter === 'function') return String(formatter(value));
    return `${trimFloat(value)}${this.options.unit ?? ''}`;
  }

  /** Restores an enhanced target to the markup it had before the takeover. @returns {void} */
  destroy() {
    const root = this.el;
    super.destroy();
    if (!this._createdRoot && root) restoreTarget(root, this._snapshot);
  }
}

/**
 * Value committed — the pointer was released, or the keyboard moved the thumb.
 * @event Slider#change
 * @type {CustomEvent<{value: number}>}
 */

/**
 * Value while dragging, before it is committed.
 * @event Slider#input
 * @type {CustomEvent<{value: number}>}
 */

/** Keys a range input would act on, blocked while the slider is read-only. */
const CHANGE_KEYS = new Set([
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End'
]);

/**
 * Decimal places a step carries, so a 0.1 step snaps to 0.3 rather than 0.30000000000000004.
 * @param {number} step Step size.
 * @returns {number}
 */
export function stepPrecision(step) {
  const text = String(step);
  const exponent = /e-(\d+)$/i.exec(text);
  if (exponent) return Number(exponent[1]);
  return (text.split('.')[1] ?? '').length;
}

/** @param {number} value @returns {string} */
function trimFloat(value) {
  return String(Number(value.toFixed(6)));
}
