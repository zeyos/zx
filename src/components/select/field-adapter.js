import { Field } from '../field/field.js';
import { CountryPicker } from '../country-picker/country-picker.js';
import { LocalePicker } from '../locale-picker/locale-picker.js';
import { Select } from './select.js';

/**
 * Registers the Select-backed `zxselect` field type. `props.preset` picks a preset: `'priority'`,
 * `'status'`, `'locale'` (LocalePicker), or `'country'` (CountryPicker).
 * @returns {void}
 */
export function registerSelectFieldAdapter() {
  Field.register('zxselect', (field, options) => {
    const props = options.props ?? {};
    const preset = props.preset;
    const selectOptions = { ...props, value: options.value, label: options.label || props.label, placeholder: props.placeholder ?? options.placeholder };
    field.listen(field.el, 'click', (event) => {
      if (event.target.closest?.('.zx-field__label')) field.adapter.focus();
    });
    delete selectOptions.preset;
    // The priority preset offers "No priority" (null) by default; a required field cannot hold it.
    if (preset === 'priority' && props.clearable === undefined) selectOptions.clearable = !options.required;
    const select = field.own(preset === 'priority'
      ? Select.priority(null, selectOptions)
      : preset === 'status'
        ? Select.status(null, selectOptions)
        : preset === 'locale'
          ? new LocalePicker(null, selectOptions)
          : preset === 'country'
            ? new CountryPicker(null, selectOptions)
            : new Select(null, selectOptions));
    field.listen(select.el, 'change', (event) => event.stopImmediatePropagation());
    select.on('change', (event) => field.emit('change', { value: event.detail.value }));
    return {
      el: select.el,
      get: () => select.value,
      set: (value) => select.set(value, { silent: true }),
      focus: () => select.focus(),
      setDisabled: (disabled) => disabled ? select.disable() : select.enable()
    };
  });
}
