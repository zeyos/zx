import assert from 'node:assert/strict';
import test from 'node:test';

import { FieldUpload } from '../../src/components/field-upload/field-upload.js';

/*
 * disable(), enable() and isDisabled() beside setDisabled(bool), as the other inputs have them. A
 * prototype probe with a stand-in input and drop zone drives them without a DOM.
 */
function uploadProbe() {
  const upload = Object.create(FieldUpload.prototype);
  upload.el = { dataset: {} };
  upload._input = { disabled: false };
  upload._dropzone = { disabled: false };
  upload._disabled = false;
  return upload;
}

test('FieldUpload.disable() and enable() are setDisabled(true) and setDisabled(false)', () => {
  const upload = uploadProbe();
  assert.equal(upload.isDisabled(), false);

  assert.equal(upload.disable(), upload);
  assert.equal(upload.isDisabled(), true);
  assert.equal(upload._input.disabled, true);
  assert.equal(upload._dropzone.disabled, true);
  assert.equal(upload.el.dataset.disabled, 'true');

  assert.equal(upload.enable(), upload);
  assert.equal(upload.isDisabled(), false);
  assert.equal(upload._input.disabled, false);
  assert.equal(upload._dropzone.disabled, false);
  assert.equal(upload.el.dataset.disabled, 'false');

  upload.setDisabled(true);
  assert.equal(upload.isDisabled(), true, 'isDisabled() reads what setDisabled() set');
});
