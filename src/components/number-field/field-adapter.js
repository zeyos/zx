import { Field } from '../field/field.js';
import { NumberField } from './number-field.js';

/**
 * Registers the NumberField-backed `number` field type.
 * @returns {void}
 */
export function registerNumberFieldAdapter() {
  Field.register('number', (field, options) => {
    const numberField = field.own(new NumberField(null, {
      label: options.label ? String(options.label) : undefined,
      placeholder: options.placeholder,
      required: options.required,
      ...(options.props ?? {})
    }));
    let setting = false;
    // The inner <input> also fires a native `change`; without this the Field would see two
    // changes per edit, the first still carrying the previous committed value.
    field.listen(numberField.el, 'change', (event) => event.stopImmediatePropagation());
    numberField.on('change', (event) => {
      if (!setting) field.emit('change', { value: event.detail.value });
    });
    return {
      el: numberField.el,
      get: () => numberField.get(),
      set: (value) => {
        setting = true;
        try {
          numberField.set(value === '' || value === null || value === undefined ? null : value, {
            silent: true
          });
        } finally {
          setting = false;
        }
      },
      focus: () => numberField.focus(),
      setDisabled: (value) => (value ? numberField.disable() : numberField.enable())
    };
  });
}
