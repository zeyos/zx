import { Field } from '../field/field.js';
import { Timebox } from './timebox.js';

/**
 * Registers the duration-oriented `time` field type.
 * @returns {void}
 */
export function registerTimeboxFieldAdapter() {
  Field.register('time', (field, options) => {
    const timebox = field.own(new Timebox(null, {
      ...(options.props ?? {}),
      value: options.value
    }));
    field.listen(timebox.el, 'change', (event) => event.stopImmediatePropagation());
    timebox.on('change', (event) => field.emit('change', { value: event.detail.value }));
    return {
      el: timebox.el,
      get: () => timebox.get(),
      set: (value) => timebox.set(Number(value) || 0, { silent: true }),
      focus: () => timebox.el.querySelector('input:not([disabled]), button:not([disabled])')?.focus(),
      setDisabled: (disabled) => disabled ? timebox.disable() : timebox.enable()
    };
  });
}
