import { Field } from '../field/field.js';
import { Checklist } from './checklist.js';

/**
 * Registers the Checklist-backed `checklist` field type.
 * @returns {void}
 */
export function registerChecklistFieldAdapter() {
  Field.register('checklist', (field, options) => {
    const checklist = field.own(new Checklist(null, { ...(options.props ?? {}) }));
    let disabled = false;
    let setting = false;
    const syncDisabled = () => {
      checklist.el.setAttribute('aria-disabled', String(disabled));
      for (const control of checklist.el.querySelectorAll('input, button, select, textarea')) {
        control.disabled = disabled;
      }
    };
    field.listen(checklist.el, 'change', (event) => event.stopImmediatePropagation());
    checklist.on('change', (event) => {
      if (!setting) field.emit('change', { value: event.detail.values });
    });
    checklist.on('loaded', syncDisabled);
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
        syncDisabled();
      },
      focus: () => {
        const search = checklist.el.querySelector('.zx-checklist__search:not([hidden]):not([disabled])');
        (search ?? checklist.el.querySelector('input[type="checkbox"]:not([disabled])'))?.focus();
      },
      setDisabled: (value) => {
        disabled = Boolean(value);
        syncDisabled();
      }
    };
  });
}
