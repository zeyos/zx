import assert from 'node:assert/strict';
import test from 'node:test';

import { TagPicker } from '../../src/components/tag-picker/tag-picker.js';

test('TagPicker publishes native icon/color readers without preempting custom renderers', () => {
  assert.equal(TagPicker.defaults.iconKey, 'icon');
  assert.equal(TagPicker.defaults.colorKey, 'color');
  assert.equal(TagPicker.defaults.renderItem, null);
  assert.equal(TagPicker.defaults.renderTag, null);
});
