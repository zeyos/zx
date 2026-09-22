import assert from 'node:assert/strict';
import test from 'node:test';

import { FileItem, normalizeFileItem } from '../../src/components/file-item/file-item.js';
import { FileList, normalizeFileListItems } from '../../src/components/file-list/file-list.js';

test('file component defaults distinguish durable presentation from active transport', () => {
  assert.equal(FileItem.defaults.status, 'ready');
  assert.equal(FileItem.defaults.progress, null);
  assert.equal(FileItem.defaults.indeterminate, false);
  assert.equal(FileList.defaults.loading, false);
});

test('file normalization retains zero bytes and clamps progress without mutating input', () => {
  const input = {
    id: 'contract', name: 'contract.pdf', size: 0, mime: 'application/pdf',
    status: 'uploading', progress: 140,
    metadata: [{ label: 'Owner', value: 'Ava' }],
    actions: [{ id: 'remove', label: 'Remove' }]
  };
  const normalized = normalizeFileItem(input);

  assert.equal(normalized.size, 0);
  assert.equal(normalized.progress, 100);
  assert.equal(normalized.status, 'uploading');
  assert.notEqual(normalized.metadata, input.metadata);
  assert.notEqual(normalized.actions, input.actions);
  assert.equal(input.progress, 140);
});

test('file normalization omits unusable sizes and progress and falls back to a safe status', () => {
  const state = normalizeFileItem({
    name: 'draft.txt', size: -3, progress: Number.NaN, status: 'invented', density: 'huge'
  });
  assert.equal(state.size, null);
  assert.equal(state.progress, null);
  assert.equal(state.status, 'ready');
  assert.equal(state.density, 'md');
  assert.equal(state.icon, 'file');
});

test('file links share EntityRef native-link safety and download support', () => {
  const state = normalizeFileItem({
    name: 'report.csv', link: { href: '/exports/7', download: 'report.csv', target: '_blank' }
  });
  assert.deepEqual(state.link, {
    href: '/exports/7', target: '_blank', rel: 'noopener', download: 'report.csv'
  });
  assert.equal(normalizeFileItem({ name: 'bad', link: 'javascript:alert(1)' }).link, null);
});

test('file lists validate descriptor arrays and reject duplicate explicit IDs', () => {
  assert.throws(() => normalizeFileListItems(null), /must be an array/);
  assert.throws(() => normalizeFileListItems([null]), /descriptor objects/);
  assert.throws(() => normalizeFileListItems([{ id: 1 }, { id: 1 }]), /Duplicate FileList id/);
  assert.equal(normalizeFileListItems([{}, {}]).length, 2);
  assert.equal(normalizeFileListItems([{ id: 1 }, { id: '1' }]).length, 2);
});

test('file list normalization returns descriptor and slot copies in source order', () => {
  const action = { id: 'open', label: 'Open' };
  const source = [
    { id: 'a', name: 'A.txt', actions: [action] },
    { id: 'b', name: 'B.txt', metadata: [{ label: 'Kind', value: 'Text' }] }
  ];
  const normalized = normalizeFileListItems(source);

  assert.deepEqual(normalized.map((item) => item.id), ['a', 'b']);
  assert.notEqual(normalized, source);
  assert.notEqual(normalized[0].actions, source[0].actions);
  assert.notEqual(normalized[0].actions[0], action);
  assert.notEqual(normalized[1].metadata, source[1].metadata);
});
