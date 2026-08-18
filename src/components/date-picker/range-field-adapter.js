import { DateRangeBox } from '../datebox/date-range-box.js';
import { Field } from '../field/field.js';

/**
 * Registers the DateRangeBox-backed `daterange` field type, so a Form field declared as
 * `{ type: 'daterange', label, props: {…} }` renders a formatted range input with an anchored
 * two-month calendar. Field values are `{start, end}` objects of `Date|null`.
 * @returns {void}
 */
export function registerDateRangeFieldAdapter() {
  Field.register('daterange', (field, options) => {
    const box = field.own(new DateRangeBox(null, {
      ...(options.props ?? {}),
      disabled: Boolean(options.disabled),
      start: options.value?.start ?? null,
      end: options.value?.end ?? null
    }));
    // The box already emits its own `change`; stop the DOM copy so Field does not report twice.
    field.listen(box.el, 'change', (event) => event.stopImmediatePropagation());
    box.on('change', (event) => field.emit('change', {
      value: { start: event.detail.start, end: event.detail.end }
    }));
    return {
      el: box.el,
      get: () => box.get(),
      set: (value) => box.set(value, { silent: true }),
      focus: () => box.focus(),
      setDisabled: (disabled) => disabled ? box.disable() : box.enable()
    };
  });
}
