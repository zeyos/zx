import assert from 'node:assert/strict';
import test from 'node:test';

import {
  fileTypeIcon, fileTypeLabel, normalizeFileItem
} from '../../src/components/file-item/file-item.js';
import { registerIcons, useBuiltinIcons, useFontAwesome } from '../../src/core/icons.js';

test('a file type reads as its format or family, never as the raw MIME string', () => {
  assert.equal(fileTypeLabel('application/pdf'), 'PDF');
  assert.equal(fileTypeLabel('text/csv; charset=utf-8'), 'CSV');
  assert.equal(fileTypeLabel('IMAGE/PNG'), 'Image');
  assert.equal(fileTypeLabel('image/svg+xml'), 'Image');
  assert.equal(fileTypeLabel('video/mp4'), 'Video');
  assert.equal(fileTypeLabel('text/plain'), 'Text');
  assert.equal(fileTypeLabel('application/zip'), 'ZIP');
  assert.equal(fileTypeLabel(
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'), 'Spreadsheet');
  assert.equal(fileTypeLabel('application/msword'), 'Document');
});

test('an unfamiliar MIME type falls back to the extension, and nothing is shown without one', () => {
  assert.equal(fileTypeLabel('application/x-msdownload', 'setup.exe'), 'EXE');
  assert.equal(fileTypeLabel('application/octet-stream', 'damaged-upload.bin'), 'BIN');
  assert.equal(fileTypeLabel('application/vnd.example.custom', 'blob'), '');
  assert.equal(fileTypeLabel('', 'export.xlsx'), '', 'no MIME type, no generated type');
});

test('the type label is explicit when given and derived when not', () => {
  assert.equal(normalizeFileItem({ mime: 'application/pdf' }).typeLabel, null);
  assert.equal(normalizeFileItem({ mime: 'application/pdf', typeLabel: 'Signed PDF' }).typeLabel,
    'Signed PDF');
  assert.equal(normalizeFileItem({ typeLabel: '' }).typeLabel, '', 'an empty label hides the type');
});

test('the MIME icon is used only when the active icon set can draw it', () => {
  try {
    useBuiltinIcons();
    assert.equal(fileTypeIcon('application/pdf'), 'file', 'the bundled set has no PDF glyph');
    assert.equal(fileTypeIcon('application/json'), 'code', 'a later candidate the set carries');
    assert.equal(fileTypeIcon(''), 'file');

    registerIcons({ 'file-pdf': ['0 0 24 24', 'M0 0h24v24H0z', 'stroke'] });
    assert.equal(fileTypeIcon('application/pdf'), 'file-pdf', 'a registered glyph is picked up');

    useFontAwesome();
    assert.equal(fileTypeIcon('image/jpeg'), 'file-image', 'Font Awesome draws every candidate');
    assert.equal(fileTypeIcon('application/x-unknown'), 'file');
  } finally {
    useBuiltinIcons();
  }
});
