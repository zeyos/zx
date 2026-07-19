import { Field } from '../field/field.js';
import { Datebox, DateTimeBox } from './datebox.js';

/**
 * Registers Datebox-backed `date` and DateTimeBox-backed `datetime` field types.
 * @returns {void}
 */
export function registerDateboxFieldAdapters() {
  registerDatebox('date', (options) => new Datebox(null, options));
  registerDatebox('datetime', (options) => DateTimeBox(null, options));
}

/**
 * @param {'date'|'datetime'} type Field type.
 * @param {(options: Record<string, unknown>) => Datebox} create Component factory.
 * @returns {void}
 */
function registerDatebox(type, create) {
  Field.register(type, (field, options) => {
    const datebox = field.own(create({
      ...(options.props ?? {}),
      value: options.value
    }));
    field.listen(datebox.el, 'change', (event) => event.stopImmediatePropagation());
    datebox.on('change', (event) => field.emit('change', { value: event.detail.date }));
    return {
      el: datebox.el,
      get: () => datebox.get(),
      set: (value) => datebox.set(value, { silent: true }),
      focus: () => datebox.focus(),
      setDisabled: (disabled) => disabled ? datebox.disable() : datebox.enable()
    };
  });
}
