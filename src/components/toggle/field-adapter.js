import { Field } from '../field/field.js';
import { Toggle } from './toggle.js';

/**
 * Registers the boolean `toggle` field type.
 * @returns {void}
 */
export function registerToggleFieldAdapter() {
  Field.register('toggle', (field, options) => {
    const toggle = field.own(new Toggle(null, {
      ...(options.props ?? {}),
      checked: Boolean(options.value)
    }));
    field.listen(toggle.el, 'change', (event) => event.stopImmediatePropagation());
    toggle.on('change', (event) => field.emit('change', { value: event.detail.value }));
    return {
      el: toggle.el,
      get: () => toggle.getValue(),
      set: (value) => toggle.set(Boolean(value), { silent: true }),
      focus: () => toggle.el.focus(),
      setDisabled: (disabled) => disabled ? toggle.disable() : toggle.enable()
    };
  });
}
