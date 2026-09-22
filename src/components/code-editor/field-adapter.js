import { CodeEditor } from './code-editor.js';
import { Field } from '../field/field.js';

/**
 * Registers the CodeEditor-backed `code` field type.
 * @returns {void}
 */
export function registerCodeEditorFieldAdapter() {
  Field.register('code', (field, options) => {
    const editor = field.own(new CodeEditor(null, {
      label: options.label ? String(options.label) : 'Code editor',
      placeholder: options.placeholder,
      readOnly: Boolean(options.props?.readOnly),
      disabled: Boolean(options.disabled),
      ...(options.props ?? {}),
      value: options.value
    }));
    let setting = false;
    editor.on('input', (event) => {
      if (!setting) field.emit('change', { value: event.detail.value });
    });
    return {
      el: editor.el,
      get: () => editor.getValue(),
      set: (value) => {
        setting = true;
        try { editor.setValue(value, { silent: true }); }
        finally { setting = false; }
      },
      focus: () => editor.focus(),
      setDisabled: (value) => (value ? editor.disable() : editor.enable())
    };
  });
}
