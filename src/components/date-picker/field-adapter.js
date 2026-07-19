import { Field } from '../field/field.js';
import { MonthPicker } from './month-picker.js';

/**
 * Registers the MonthPicker-backed `month` field type. Date and datetime fields are registered
 * by the Datebox adapter so those types retain formatted text-input behavior.
 * @returns {void}
 */
export function registerDatePickerFieldAdapters() {
  Field.register('month', (field, options) => {
    const picker = field.own(new MonthPicker(null, {
      ...(options.props ?? {}),
      value: options.value
    }));
    let disabled = false;
    const syncDisabled = () => {
      picker.el.setAttribute('aria-disabled', String(disabled));
      for (const button of picker.el.querySelectorAll('button')) button.disabled = disabled;
    };
    field.listen(picker.el, 'change', (event) => event.stopImmediatePropagation());
    picker.on('change', (event) => field.emit('change', { value: event.detail.date }));
    return {
      el: picker.el,
      get: () => picker.get(),
      set: (value) => {
        picker.set(value instanceof Date ? value : null, { silent: true });
        syncDisabled();
      },
      focus: () => picker.focus(),
      setDisabled: (value) => {
        disabled = Boolean(value);
        syncDisabled();
      }
    };
  });
}
