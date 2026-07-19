import { Field } from '../field/field.js';
import { MultiValueEditor } from './multi-value-editor.js';

/**
 * Registers the MultiValueEditor-backed `multivalueeditor` field type.
 * @returns {void}
 */
export function registerMultiValueEditorFieldAdapter() {
  Field.register('multivalueeditor', (field, options) => {
    const editor = field.own(new MultiValueEditor(null, {
      ...(options.props ?? {}),
      values: Array.isArray(options.value) ? options.value : []
    }));
    const originalDisabled = new WeakMap();
    let disabled = false;
    const syncDisabled = () => {
      editor.el.setAttribute('aria-disabled', String(disabled));
      for (const control of editor.el.querySelectorAll('input, button, select, textarea')) {
        if (disabled) {
          if (!originalDisabled.has(control)) originalDisabled.set(control, Boolean(control.disabled));
          control.disabled = true;
        } else if (originalDisabled.has(control)) {
          control.disabled = originalDisabled.get(control);
          originalDisabled.delete(control);
        }
      }
    };
    field.listen(editor.el, 'change', (event) => event.stopImmediatePropagation());
    editor.on('change', (event) => field.emit('change', { value: event.detail.values }));
    return {
      el: editor.el,
      get: () => editor.getValues(),
      set: (value) => {
        editor.setValues(Array.isArray(value) ? value : [], { silent: true });
        syncDisabled();
      },
      focus: () => editor.el.querySelector('.zx-multi-value-editor__value:not([disabled]), button:not([disabled])')?.focus(),
      setDisabled: (value) => {
        disabled = Boolean(value);
        syncDisabled();
      }
    };
  });
}
