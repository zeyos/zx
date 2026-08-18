import { Component } from '../../core/component.js';
import { h } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { uid } from '../../core/util.js';

/** @typedef {{h: number, m: number, s: number}} TimePickerValue */
/** @typedef {'h'|'m'} ClockUnit */
/**
 * @typedef {Object} TimePickerOptions
 * @property {TimePickerValue|Date|null} [value=null] Initial local time.
 * @property {boolean} [seconds=false] Show the seconds spinbutton.
 * @property {number} [step=5] Minute increment used by arrow keys.
 * @property {boolean} [clock=true] Offer a clock-face dial behind a toggle button.
 * @property {(event: CustomEvent<{time: TimePickerValue}>) => void} [onchange] Change listener.
 */
/** @typedef {{silent?: boolean}} TimePickerSetOptions */
/** @typedef {{value: number, label: string, angle: number, ring: 'outer'|'inner'}} ClockMark */

/** Minute marks on the dial, one per 5 minutes — the granularity a clock face can resolve. */
const MINUTE_STEP = 5;

/**
 * Accessible segmented time picker made from spinbutton inputs, with an optional clock face for
 * picking an hour and a minute by eye. The spinbuttons stay the primary control: the dial is a
 * second, visual route to the same value, and every mark is a radio in an APG radio group.
 * @fires TimePicker#change
 */
export class TimePicker extends Component {
  static cssName = 'time-picker';

  /** @type {TimePickerOptions} */
  static defaults = { value: null, seconds: false, step: 5, clock: true };

  /** @returns {HTMLElement} */
  render() {
    const root = /** @type {HTMLElement} */ (this.el ?? h('div'));
    this.el = root;
    const initial = normalizeTime(this.options.value);
    this._value = initial;
    this._display = initial ?? { h: 0, m: 0, s: 0 };
    this._inputs = [];
    this._clockOpen = false;
    /** @type {ClockUnit} */
    this._clockUnit = 'h';
    this._clock = null;

    const content = h('div', {
      class: 'zx-time-picker__segments',
      role: 'group',
      ariaLabel: 'Time'
    });
    this._content = content;
    this._addSpin(content, 'h', 'Hour', 23);
    content.append(h('span', { class: 'zx-time-picker__separator', ariaHidden: 'true' }, ':'));
    this._addSpin(content, 'm', 'Minute', 59);
    if (this.options.seconds) {
      content.append(h('span', { class: 'zx-time-picker__separator', ariaHidden: 'true' }, ':'));
      this._addSpin(content, 's', 'Second', 59);
    }
    root.append(content);

    if (this.options.clock) {
      const clockId = uid('zx-time-picker-clock');
      content.append(h('button', {
        ref: 'clockToggle',
        class: 'zx-icon-btn zx-time-picker__clock-toggle',
        type: 'button',
        ariaLabel: 'Pick the time on a clock',
        ariaExpanded: 'false',
        ariaControls: clockId
      }, icon('clock', { size: 15 })));
      this._clock = this._buildClock(clockId);
      root.append(this._clock);
      this.listen(this.refs.clockToggle, 'click', () => this.toggleClock());
    }

    this._writeInputs();
    return root;
  }

  /**
   * Returns a copy of the selected time, or null when no initial value has been committed.
   * @returns {TimePickerValue|null}
   */
  get() {
    return this._value ? { ...this._value } : null;
  }

  /**
   * Sets the displayed local time.
   * @param {TimePickerValue|Date|null} value Time object, Date, or null.
   * @param {TimePickerSetOptions} [options={}] Update behavior.
   * @returns {this}
   * @fires TimePicker#change
   */
  set(value, { silent = false } = {}) {
    const normalized = normalizeTime(value);
    this._value = normalized;
    this._display = normalized ?? { h: 0, m: 0, s: 0 };
    this._writeInputs();
    if (!silent && normalized) this.emit('change', { time: { ...normalized } });
    return this;
  }

  /**
   * Opens the clock face on the given unit.
   * @param {ClockUnit} [unit='h'] Dial to show first.
   * @returns {this}
   */
  openClock(unit = 'h') {
    if (!this._clock) return this;
    this._clockOpen = true;
    this._clockUnit = unit === 'm' ? 'm' : 'h';
    this._syncClock();
    return this;
  }

  /** Closes the clock face. @returns {this} */
  closeClock() {
    if (!this._clock) return this;
    this._clockOpen = false;
    this._syncClock();
    return this;
  }

  /** Toggles the clock face. @returns {this} */
  toggleClock() {
    return this._clockOpen ? this.closeClock() : this.openClock('h');
  }

  /** Removes generated content from an enhanced target. @returns {void} */
  destroy() {
    this._content?.remove();
    this._clock?.remove();
    this._clock = null;
    super.destroy();
  }

  /** @param {HTMLElement} parent @param {'h'|'m'|'s'} segment @param {string} label @param {number} max @returns {void} */
  _addSpin(parent, segment, label, max) {
    const input = h('input', {
      class: 'zx-time-picker__spin',
      type: 'text',
      role: 'spinbutton',
      inputMode: 'numeric',
      maxLength: 2,
      autocomplete: 'off',
      ariaLabel: label,
      ariaValueMin: '0',
      ariaValueMax: String(max),
      dataset: { segment }
    });
    this._inputs.push(input);
    parent.append(input);
    this.listen(input, 'focus', () => input.select());
    this.listen(input, 'keydown', (event) => this._onKeydown(event, segment, max));
    this.listen(input, 'input', () => this._onInput(input, segment, max));
    this.listen(input, 'blur', () => this._commitFromInputs());
  }

  /** @param {KeyboardEvent} event @param {'h'|'m'|'s'} segment @param {number} max @returns {void} */
  _onKeydown(event, segment, max) {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
    event.preventDefault();
    const direction = event.key === 'ArrowUp' ? 1 : -1;
    const increment = segment === 'm' ? normalizeStep(this.options.step) : 1;
    const current = numberInRange(event.currentTarget.value, 0, max);
    const modulus = max + 1;
    const value = (current + direction * increment + modulus * increment) % modulus;
    event.currentTarget.value = pad(value);
    this._commitFromInputs();
  }

  /** @param {HTMLInputElement} input @param {'h'|'m'|'s'} segment @param {number} max @returns {void} */
  _onInput(input, segment, max) {
    input.value = input.value.replace(/\D/g, '').slice(0, 2);
    if (input.value.length < 2) return;
    input.value = pad(numberInRange(input.value, 0, max));
    this._commitFromInputs();
    const index = this._inputs.indexOf(input);
    this._inputs[index + 1]?.focus();
  }

  /** @returns {void} */
  _commitFromInputs() {
    const next = { h: 0, m: 0, s: 0 };
    for (const input of this._inputs) {
      const segment = input.dataset.segment;
      const max = segment === 'h' ? 23 : 59;
      next[segment] = numberInRange(input.value, 0, max);
    }
    const changed = !this._value || !sameTime(this._value, next);
    this._value = next;
    this._display = next;
    this._writeInputs();
    if (changed) this.emit('change', { time: { ...next } });
  }

  /** @returns {void} */
  _writeInputs() {
    for (const input of this._inputs) {
      const segment = input.dataset.segment;
      input.value = pad(this._display[segment]);
      input.setAttribute('aria-valuenow', String(this._display[segment]));
      input.setAttribute('aria-valuetext', input.value);
    }
    this._syncClock();
  }

  /* ------------------------------------------------------------------- clock -- */

  /**
   * Builds the collapsible clock face: a read-out that doubles as the hour/minute switch, and a
   * dial whose marks are radios.
   * @param {string} id Element id the toggle button controls.
   * @returns {HTMLElement}
   */
  _buildClock(id) {
    const clock = h('div', { class: 'zx-time-picker__clock', id, hidden: true },
      h('div', { class: 'zx-time-picker__clock-head' },
        h('button', {
          ref: 'headHour',
          class: 'zx-time-picker__clock-unit',
          type: 'button',
          ariaLabel: 'Select the hour',
          dataset: { unit: 'h' }
        }),
        h('span', { class: 'zx-time-picker__clock-colon', ariaHidden: 'true' }, ':'),
        h('button', {
          ref: 'headMinute',
          class: 'zx-time-picker__clock-unit',
          type: 'button',
          ariaLabel: 'Select the minutes',
          dataset: { unit: 'm' }
        })),
      h('div', { ref: 'dial', class: 'zx-time-picker__dial', role: 'radiogroup' },
        h('span', { ref: 'hand', class: 'zx-time-picker__hand', ariaHidden: 'true' }),
        h('span', { class: 'zx-time-picker__pivot', ariaHidden: 'true' })));

    this.listen(this.refs.headHour, 'click', () => this.openClock('h'));
    this.listen(this.refs.headMinute, 'click', () => this.openClock('m'));
    this.listen(this.refs.dial, 'click', (event) => {
      const mark = event.target.closest?.('.zx-time-picker__mark');
      if (mark) this._pick(Number(mark.dataset.value));
    });
    this.listen(this.refs.dial, 'keydown', (event) => this._onDialKeydown(event));
    return clock;
  }

  /**
   * Applies a mark's value to the active unit, then moves on to the minutes so a whole time can
   * be set with two clicks.
   * @param {number} value Hour or minute the mark stands for.
   * @returns {void}
   */
  _pick(value) {
    const next = { ...this._display, [this._clockUnit]: value };
    const advance = this._clockUnit === 'h';
    this.set(next);
    if (advance) this.openClock('m');
  }

  /** @param {KeyboardEvent} event @returns {void} */
  _onDialKeydown(event) {
    const marks = [...this.refs.dial.querySelectorAll('.zx-time-picker__mark')];
    const current = event.target.closest?.('.zx-time-picker__mark');
    const index = marks.indexOf(current);
    if (index < 0) return;
    // Marks are laid out clockwise within a ring, so Right/Down step forward and Left/Up back.
    const offset = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    let next = null;
    if (offset !== undefined) next = (index + offset + marks.length) % marks.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = marks.length - 1;
    if (next === null) return;
    event.preventDefault();
    // Selection follows focus, the APG behaviour for a radio group.
    this._pick(Number(marks[next].dataset.value));
    this.refs.dial.querySelector(`[data-value="${marks[next].dataset.value}"]`)?.focus();
  }

  /** Reflects the open state, the active unit, the marks, and the hand. @returns {void} */
  _syncClock() {
    if (!this._clock) return;
    const hours = this._clockUnit === 'h';
    this._clock.hidden = !this._clockOpen;
    this.refs.clockToggle.setAttribute('aria-expanded', String(this._clockOpen));
    this.refs.headHour.textContent = pad(this._display.h);
    this.refs.headMinute.textContent = pad(this._display.m);
    this.refs.headHour.setAttribute('aria-pressed', String(hours));
    this.refs.headMinute.setAttribute('aria-pressed', String(!hours));
    this.refs.dial.setAttribute('aria-label', hours ? 'Hour' : 'Minutes');
    if (!this._clockOpen) return;

    const selected = hours ? this._display.h : this._display.m;
    const marks = hours ? hourMarks() : minuteMarks();
    const rendered = this.refs.dial.querySelectorAll('.zx-time-picker__mark');
    // Rebuild only when the dial switches unit; otherwise just restate which mark is checked.
    if (rendered.length !== marks.length || this.refs.dial.dataset.unit !== this._clockUnit) {
      for (const mark of rendered) mark.remove();
      this.refs.dial.dataset.unit = this._clockUnit;
      this.refs.dial.append(...marks.map((mark) => this._buildMark(mark, selected)));
    } else {
      marks.forEach((mark, index) => this._syncMark(rendered[index], mark, selected));
    }

    const ring = hours && !isOuterHour(selected) ? 'inner' : 'outer';
    const angle = hours ? (selected % 12) * 30 : selected * 6;
    this.refs.hand.dataset.ring = ring;
    this.refs.hand.style.setProperty('--zx-clock-angle', `${angle}deg`);
  }

  /** @param {ClockMark} mark @param {number} selected @returns {HTMLElement} */
  _buildMark(mark, selected) {
    const element = h('button', {
      class: 'zx-time-picker__mark',
      type: 'button',
      role: 'radio',
      dataset: { value: String(mark.value), ring: mark.ring }
    }, mark.label);
    element.style.setProperty('--zx-clock-angle', `${mark.angle}deg`);
    this._syncMark(element, mark, selected);
    return element;
  }

  /** @param {HTMLElement} element @param {ClockMark} mark @param {number} selected @returns {void} */
  _syncMark(element, mark, selected) {
    const checked = mark.value === selected;
    element.setAttribute('aria-checked', String(checked));
    element.tabIndex = checked ? 0 : -1;
  }
}

/**
 * Fired after a time is committed.
 * @event TimePicker#change
 * @type {CustomEvent<{time: TimePickerValue}>}
 */

/**
 * Hour marks: 1–12 on the outer ring, 13–23 and 00 on the inner one, so all 24 hours are
 * reachable without an AM/PM switch.
 * @returns {ClockMark[]}
 */
function hourMarks() {
  const marks = [];
  for (let index = 1; index <= 12; index += 1) {
    marks.push({ value: index, label: String(index), angle: (index % 12) * 30, ring: 'outer' });
  }
  for (let index = 0; index < 12; index += 1) {
    const value = index === 0 ? 0 : 12 + index;
    marks.push({ value, label: pad(value), angle: index * 30, ring: 'inner' });
  }
  return marks;
}

/** @returns {ClockMark[]} */
function minuteMarks() {
  const marks = [];
  for (let value = 0; value < 60; value += MINUTE_STEP) {
    marks.push({ value, label: pad(value), angle: value * 6, ring: 'outer' });
  }
  return marks;
}

/** @param {number} hour @returns {boolean} */
function isOuterHour(hour) {
  return hour >= 1 && hour <= 12;
}

/** @param {unknown} value @returns {TimePickerValue|null} */
function normalizeTime(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return { h: value.getHours(), m: value.getMinutes(), s: value.getSeconds() };
  }
  if (!value || typeof value !== 'object') return null;
  return {
    h: numberInRange(value.h, 0, 23),
    m: numberInRange(value.m, 0, 59),
    s: numberInRange(value.s, 0, 59)
  };
}

/** @param {unknown} value @param {number} min @param {number} max @returns {number} */
function numberInRange(value, min, max) {
  const number = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(number)) return min;
  return Math.max(min, Math.min(max, number));
}

/** @param {unknown} value @returns {number} */
function normalizeStep(value) {
  const number = Math.round(Number(value));
  return Number.isFinite(number) && number > 0 && number <= 59 ? number : 5;
}

/** @param {number} value @returns {string} */
function pad(value) {
  return String(value).padStart(2, '0');
}

/** @param {TimePickerValue} a @param {TimePickerValue} b @returns {boolean} */
function sameTime(a, b) {
  return a.h === b.h && a.m === b.m && a.s === b.s;
}
