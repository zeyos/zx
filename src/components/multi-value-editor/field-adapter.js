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
    field.listen(editor.el, 'change', (event) => event.stopImmediatePropagation());
    editor.on('change', (event) => field.emit('change', { value: event.detail.values }));
    return {
      el: editor.el,
      get: () => editor.getValues(),
      // Rows the editor renders while disabled are rendered disabled, so a value set on a
      // disabled field needs nothing more.
      set: (value) => editor.setValues(Array.isArray(value) ? value : [], { silent: true }),
      // The first value, else the first control: a selector list matches in document order, which
      // would put the drag handle ahead of the value it belongs to.
      focus: () => (editor.el.querySelector('.zx-multi-value-editor__value:not([disabled])')
        ?? editor.el.querySelector('button:not([disabled])'))?.focus(),
      setDisabled: (value) => { editor.setDisabled(value); }
    };
  });
}
