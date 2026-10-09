import assert from 'node:assert/strict';
import test from 'node:test';

import { TagPicker } from '../../src/components/tag-picker/tag-picker.js';

test('TagPicker publishes native icon/color readers without preempting custom renderers', () => {
  assert.equal(TagPicker.defaults.iconKey, 'icon');
  assert.equal(TagPicker.defaults.colorKey, 'color');
  assert.equal(TagPicker.defaults.renderItem, null);
  assert.equal(TagPicker.defaults.renderTag, null);
});

test('TagPicker reads a categorical tone per item, beside its colour', () => {
  assert.equal(TagPicker.defaults.toneKey, 'tone');
  // Without a DOM the readers are exercised on a bare receiver: the same calls the tags make.
  const picker = { options: { ...TagPicker.defaults }, _readItem: TagPicker.prototype._readItem };
  const toneOf = (item) => TagPicker.prototype._toneOf.call(picker, item);
  const colorOf = (item) => TagPicker.prototype._colorOf.call(picker, item);
  assert.equal(toneOf({ tone: 'violet' }), 'violet');
  assert.equal(toneOf({ tone: 'warning' }), null, 'a status kind is not a categorical tone');
  assert.equal(toneOf({ name: 'No tone' }), null);
  assert.equal(colorOf({ color: 'var(--zx-color-tone-teal-fg)' }), 'var(--zx-color-tone-teal-fg)');
  assert.equal(colorOf({ color: '#d97706' }), '#d97706');
  assert.equal(colorOf({ color: 'var(--zx-color-tone-teal-fg, red)' }), null);
});
