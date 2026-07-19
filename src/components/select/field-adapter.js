import { Field } from '../field/field.js';
import { Select } from './select.js';

/**
 * Registers the Select-backed `zxselect` field type.
 * @returns {void}
 */
export function registerSelectFieldAdapter() {
  Field.register('zxselect', (field, options) => {
    const select = field.own(new Select(null, {
      ...(options.props ?? {}),
      value: options.value
    }));
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
