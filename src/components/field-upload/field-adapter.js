import { Field } from '../field/field.js';
import { FieldUpload } from './field-upload.js';

/**
 * Registers the `upload` field type. Upload state remains server-owned, so its form value is null.
 * @returns {void}
 */
export function registerFieldUploadAdapter() {
  Field.register('upload', (field, options) => {
    const upload = field.own(new FieldUpload(null, { ...(options.props ?? {}) }));
    field.listen(upload.el, 'change', (event) => event.stopImmediatePropagation());
    upload.on('select', () => field.emit('change', { value: null }));
    return {
      el: upload.el,
      get: () => null,
      set: () => upload.clear(),
      focus: () => upload.el.querySelector('.zx-field-upload__dropzone')?.focus(),
      setDisabled: (disabled) => upload.setDisabled(disabled)
    };
  });
}
