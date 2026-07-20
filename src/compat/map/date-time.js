import {
  Datebox as ZxDatebox,
  DatePicker as ZxDatePicker,
  MonthPicker as ZxMonthPicker,
  Timebox as ZxTimebox,
  TimePicker as ZxTimePicker,
  formatDate
} from '../../index.js';
import { GxWrapper } from '../base.js';
import { translateDateboxFormat } from './options.js';

/** Legacy segmented date box presented through the Zx formatted date input. */
export class Datebox extends GxWrapper {
  static legacyName = 'gx.zeyos.Datebox';

  /** @param {Element|string|null} display @param {Record<string, any>} [options={}] */
  constructor(display, options = {}) {
    super(options, { timestamp: 0, unit: 'milliseconds', format: ['d', '.', 'M', '.', 'y', ' ', 'h', ':', 'i'] });
    const initial = options.timestamp == null || Number(options.timestamp) === 0
      ? new Date() : legacyDate(options.timestamp, options.unit ?? 'milliseconds');
    const format = translateDateboxFormat(options.format);
    const component = new ZxDatebox(display, {
      value: initial, format, time: /%[HMS]/.test(format), disabled: Boolean(options.disabled)
    });
    this._attach(component, {
      events: { update: { type: 'change', args: () => [this.get()] } },
      ui: { input: 'input', fieldset: 'control' },
      setters: { timestamp: 'set', disabled: (value) => value ? this.disable() : this.enable() }
    });
  }
  /** @param {Date|number|string|null} timestamp @param {'milliseconds'|'seconds'} [unit] @returns {this} */
  set(timestamp, unit = this.options.unit ?? 'milliseconds') { this._zx.set(legacyDate(timestamp, unit)); return this; }
  /** @param {'milliseconds'|'seconds'|'date'} [unit] @returns {Date|number|null} */
  get(unit = this.options.unit ?? 'milliseconds') {
    const date = this._zx.get('date');
    if (!date) return null;
    if (unit === 'date') return date;
    return unit === 'seconds' ? date.getTime() / 1000 : date.getTime();
  }
  /** @returns {this} */ enable() { this._zx.enable(); return this; }
  /** @returns {this} */ disable() { this._zx.disable(); return this; }
}

/** Shared inline picker wrapper with legacy date formatting. */
class PickerBase extends GxWrapper {
  static legacyName = 'gx.zeyos.DatePicker';
  static Picker = ZxDatePicker;

  /** @param {Element|string|null} display @param {Record<string, any>} [options={}] */
  constructor(display, options = {}) {
    super(options, { date: false, format: '%a %d.%m.%Y %H:%M', return_format: '%s' });
    const initial = legacyDate(options.date || new Date(), options.unit ?? 'milliseconds');
    const Picker = this.constructor.Picker;
    const component = new Picker(display, pickerOptions(initial, options, Picker));
    this._date = initial;
    this._attach(component, {
      events: { select: { type: 'change', args: (detail) => {
        this._date = detail.date ? new Date(detail.date.getTime()) : this._dateFromTime(detail.time);
        return [this._date];
      } } },
      ui: { input: 'root' },
      setters: { date: 'set' }
    });
  }

  /** @param {Date|number|string|null} value @returns {this} */
  set(value) {
    const date = legacyDate(value, 'milliseconds');
    this._date = date;
    if (this.constructor.Picker === ZxTimePicker) this._zx.set(date);
    else this._zx.set(date);
    return this;
  }
  /** @param {string} [format] @returns {Date|number|string|null} */
  get(format = this.options.return_format) {
    const date = this._readDate();
    if (!date) return null;
    if (format == null) return date;
    if (format === '%s' || format === 'seconds') return Math.floor(date.getTime() / 1000);
    if (format === 'date') return date;
    return formatDate(date, String(format));
  }
  /** @returns {number|null} */ getSeconds() { const date = this._readDate(); return date ? date.getTime() / 1000 : null; }
  /** @param {boolean} readOnly @returns {this} */ setReadOnly(readOnly) { this.toElement().setAttribute('aria-disabled', String(Boolean(readOnly))); return this; }
  /** @param {string} format @param {boolean} [enableTimePicker] @returns {this} */ setFormat(format, enableTimePicker) { this.options.format = format; this.options.timePicker = enableTimePicker; return this; }
  /** @returns {Date|null} */
  _readDate() {
    if (this.constructor.Picker === ZxTimePicker) {
      const time = this._zx.get();
      return time ? this._dateFromTime(time) : this._date;
    }
    return this._zx.get();
  }
  /** @param {{h?: number, m?: number, s?: number}|null} time @returns {Date} */
  _dateFromTime(time) {
    const date = this._date ? new Date(this._date.getTime()) : new Date();
    if (time) date.setHours(Number(time.h) || 0, Number(time.m) || 0, Number(time.s) || 0, 0);
    return date;
  }
}

/** Legacy date picker. */
export class DatePicker extends PickerBase { static legacyName = 'gx.zeyos.DatePicker'; static Picker = ZxDatePicker; }
/** Legacy month picker. */
export class MonthPicker extends PickerBase { static legacyName = 'gx.zeyos.MonthPicker'; static Picker = ZxMonthPicker; }
/** Legacy time picker. */
export class TimePicker extends PickerBase { static legacyName = 'gx.zeyos.TimePicker'; static Picker = ZxTimePicker; }

/** Shared duration Timebox wrapper. */
class TimeboxBase extends GxWrapper {
  static legacyName = 'gx.ui.Timebox';

  /** @param {Element|string|null} display @param {Record<string, any>} [options={}] */
  constructor(display, options = {}) {
    super(options, { time: 0, unit: 'minutes', seconds: true, prefix: false, disabled: false });
    const component = new ZxTimebox(display, {
      value: Number(options.time) || 0, unit: normalizeTimeUnit(options.unit),
      seconds: options.seconds !== false, signed: Boolean(options.prefix),
      disabled: Boolean(options.disabled || options.readonly)
    });
    this._attach(component, {
      events: { change: { type: 'change', args: (detail) => [detail.value] } },
      ui: { prefix: 'sign' },
      setters: { time: 'set', disabled: (value) => value ? this.disable() : this.enable() }
    });
  }
  /** @param {number} time @param {'seconds'|'minutes'|'hours'} [unit] @returns {this} */ set(time, unit = this.options.unit) { this._zx.set(time ?? 0, normalizeTimeUnit(unit)); return this; }
  /** @param {'seconds'|'minutes'|'hours'} [unit] @param {number} [precision=0] @returns {number} */
  get(unit = this.options.unit, precision = 0) { const value = this._zx.get(normalizeTimeUnit(unit)); const scale = 10 ** (Number(precision) || 0); return Math.round(value * scale) / scale; }
  /** @returns {this} */ update() { return this.set(this.get()); }
  /** @returns {this} */ enable() { this.options.disabled = false; this._zx.enable(); this.fireEvent('disabled', [false]); return this; }
  /** @returns {this} */ disable() { this.options.disabled = true; this._zx.disable(); this.fireEvent('disabled', [true]); return this; }
  /** @returns {boolean} */ disabled() { return Boolean(this.options.disabled); }
  /** @param {boolean} positive @returns {this} */ setPrefix(positive) { const value = Math.abs(this.get()); this.set(positive ? value : -value); return this; }
}

/** Legacy core Timebox. */
export class CoreTimebox extends TimeboxBase { static legacyName = 'gx.ui.Timebox'; }
/** Legacy ZeyOS Timebox. */
export class Timebox extends TimeboxBase { static legacyName = 'gx.zeyos.Timebox'; }
/** Legacy bootstrap Timebox. */
export class BootstrapTimebox extends TimeboxBase { static legacyName = 'gx.bootstrap.Timebox'; }

/** @param {unknown} value @param {unknown} unit @returns {Date|null} */
function legacyDate(value, unit) {
  if (value == null) return null;
  if (value instanceof Date) return new Date(value.getTime());
  if (typeof value === 'number' || /^-?\d+(?:\.\d+)?$/.test(String(value))) {
    const number = Number(value);
    return new Date(unit === 'seconds' ? number * 1000 : number);
  }
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

/** @param {Date|null} value @param {Record<string, any>} options @param {Function} Picker @returns {Record<string, any>} */
function pickerOptions(value, options, Picker) {
  if (Picker === ZxTimePicker) return { value, seconds: /%S/.test(options.format ?? '') };
  return {
    value,
    min: legacyDate(options.min ?? null, 'milliseconds'),
    max: legacyDate(options.max ?? null, 'milliseconds'),
    time: Picker === ZxDatePicker && options.timePicker !== false,
    showWeekNumbers: Boolean(options.weeknumbers)
  };
}

/** @param {unknown} unit @returns {'seconds'|'minutes'|'hours'} */
function normalizeTimeUnit(unit) {
  return ['seconds', 'minutes', 'hours'].includes(String(unit)) ? String(unit) : 'minutes';
}
