import assert from 'node:assert/strict';
import test from 'node:test';

import {
  EntityRef, normalizeEntityRef, normalizeEntityRefActions,
  normalizeEntityRefLink, normalizeEntityRefMetadata
} from '../../src/components/entity-ref/entity-ref.js';

test('EntityRef defaults are dense, static, and action-safe', () => {
  assert.equal(EntityRef.defaults.size, 'md');
  assert.equal(EntityRef.defaults.wrap, false);
  assert.deepEqual(EntityRef.defaults.metadata, []);
  assert.deepEqual(EntityRef.defaults.actions, []);
  assert.equal(EntityRef.defaults.link, null);
});

test('entity links retain native hints, reject executable URLs, and secure new tabs', () => {
  assert.deepEqual(normalizeEntityRefLink({
    href: ' /records/7 ', target: '_blank', rel: 'author', download: 'record.txt'
  }), {
    href: '/records/7', target: '_blank', rel: 'author noopener', download: 'record.txt'
  });
  assert.deepEqual(normalizeEntityRefLink({ href: '/files/7', download: true }), {
    href: '/files/7', download: true
  });
  assert.equal(normalizeEntityRefLink('javascript:alert(1)'), null);
  assert.equal(normalizeEntityRefLink({ href: 'data:text/html,bad' }), null);
});

test('linked references require a usable native-link label', () => {
  assert.throws(() => normalizeEntityRef({ title: ' ', link: '/records/7' }), /non-empty title/);
  assert.equal(normalizeEntityRef({ title: 'Record 7', link: '/records/7' }).link?.href, '/records/7');
});

test('metadata and actions normalize defensively without mutating caller descriptors', () => {
  const metadata = [{ label: 'Owner', value: 'Ava', showLabel: false }];
  const actions = [
    { id: 'open', label: 'Open', href: '/open', target: '_blank' },
    { id: 'open', label: 'Duplicate' },
    { id: 'unsafe', label: 'Unsafe', href: 'javascript:alert(1)' },
    { id: 'unnamed', icon: 'more' }
  ];
  const normalizedMetadata = normalizeEntityRefMetadata(metadata);
  const normalizedActions = normalizeEntityRefActions(actions);

  assert.deepEqual(normalizedMetadata, [{ label: 'Owner', value: 'Ava', icon: null, showLabel: false }]);
  assert.equal(normalizedActions.length, 1);
  assert.deepEqual(normalizedActions[0], {
    id: 'open', label: 'Open', href: '/open', target: '_blank', title: 'Open', icon: null,
    kind: 'ghost', disabled: false, rel: 'noopener'
  });
  assert.equal(metadata[0].icon, undefined);
  assert.equal(actions[0].rel, undefined);
});

test('normalization retains identifiers and coerces display-only scalar values', () => {
  const state = normalizeEntityRef({
    id: 42,
    title: 7,
    subtitle: false,
    size: 'unsupported',
    actionsLabel: ''
  });
  assert.equal(state.id, 42);
  assert.equal(state.title, '7');
  assert.equal(state.subtitle, 'false');
  assert.equal(state.size, 'md');
  assert.equal(state.actionsLabel, 'Entity actions');
});

test('invalid descriptor callbacks fail at the normalization boundary', () => {
  assert.throws(() => normalizeEntityRefLink({ href: '/record', onclick: 'nope' }), /must be a function/);
  assert.throws(() => normalizeEntityRefActions([{ id: 'open', label: 'Open', onselect: 'nope' }]),
    /must be a function/);
});
