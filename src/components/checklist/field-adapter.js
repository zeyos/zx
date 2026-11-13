import { Field } from '../field/field.js';
import { Checklist } from './checklist.js';

/**
 * Registers the Checklist-backed `checklist` field type.
 * @returns {void}
 */
export function registerChecklistFieldAdapter() {
  Field.register('checklist', (field, options) => {
    // The Field's label names the list (`aria-labelledby`), so the checklist draws no heading of
    // its own under it.
    const checklist = field.own(new Checklist(null, { hideLabel: true, ...(options.props ?? {}) }));
    let setting = false;
    field.listen(checklist.el, 'change', (event) => event.stopImmediatePropagation());
    checklist.on('change', (event) => {
      if (!setting) field.emit('change', { value: event.detail.values });
    });
    return {
      el: checklist.el,
      get: () => checklist.getValues(),
      set: (value) => {
        setting = true;
        try {
          checklist.setValues(Array.isArray(value) ? value : []);
        } finally {
          setting = false;
        }
      },
      focus: () => {
        const search = checklist.el.querySelector('.zx-checklist__search:not([hidden]):not([disabled])');
        (search ?? checklist.el.querySelector('input[type="checkbox"]:not([disabled])'))?.focus();
      },
      setDisabled: (value) => {
        if (value) checklist.disable();
        else checklist.enable();
      }
    };
  });
}
