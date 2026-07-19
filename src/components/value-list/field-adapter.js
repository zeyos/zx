import { Field } from '../field/field.js';
import { ValueList } from './value-list.js';

/**
 * Registers the ValueList-backed `valuelist` field type.
 * @returns {void}
 */
export function registerValueListFieldAdapter() {
  Field.register('valuelist', (field, options) => {
    const valueList = field.own(new ValueList(null, {
      ...(options.props ?? {}),
      values: Array.isArray(options.value) ? options.value : []
    }));
    field.listen(valueList.el, 'change', (event) => event.stopImmediatePropagation());
    valueList.on('change', (event) => field.emit('change', { value: event.detail.values }));
    return {
      el: valueList.el,
      get: () => valueList.getValues(),
      set: (value) => valueList.setValues(Array.isArray(value) ? value : [], { silent: true }),
      focus: () => valueList.focus(),
      setDisabled: (disabled) => disabled ? valueList.disable() : valueList.enable()
    };
  });
}
