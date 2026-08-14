import { Field } from '../field/field.js';
import { TagPicker } from './tag-picker.js';

/**
 * Registers the TagPicker-backed `tagpicker` field type.
 * @returns {void}
 */
export function registerTagPickerFieldAdapter() {
  Field.register('tagpicker', (field, options) => {
    const picker = field.own(new TagPicker(null, {
      placeholder: options.placeholder,
      ...(options.props ?? {})
    }));
    let setting = false;
    // The picker's own listbox emits DOM change events; keep them out of the Field's plumbing.
    field.listen(picker.el, 'change', (event) => event.stopImmediatePropagation());
    picker.on('change', (event) => {
      if (!setting) field.emit('change', { value: event.detail.values });
    });
    return {
      el: picker.el,
      get: () => picker.getValues(),
      set: (value) => {
        setting = true;
        try {
          picker.setValues(Array.isArray(value) ? value : [], { silent: true });
        } finally {
          setting = false;
        }
      },
      focus: () => picker.focus(),
      setDisabled: (value) => (value ? picker.disable() : picker.enable())
    };
  });
}
