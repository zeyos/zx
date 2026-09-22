import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  ActivityItem, normalizeActivityAction, normalizeActivityTimestamp, resolveActivityActions,
  resolveActivityState
} from '../../src/components/activity-item/activity-item.js';
import { setTranslator } from '../../src/core/i18n.js';

test('activity actions preserve native links, callbacks, intent, and safe new-tab relationships', () => {
  const onselect = () => {};
  assert.deepEqual(normalizeActivityAction({
    id: 7,
    label: 'Open',
    icon: 'eye',
    href: '/records/7',
    target: '_blank',
    rel: 'external',
    kind: 'primary',
    onselect
  }), {
    id: '7',
    label: 'Open',
    icon: 'eye',
    href: '/records/7',
    target: '_blank',
    rel: 'external noopener',
    title: undefined,
    disabled: false,
    kind: 'primary',
    onselect
  });
});

test('activity actions reject executable links and malformed or duplicate descriptors', () => {
  assert.equal(normalizeActivityAction({ id: 'bad', label: 'Bad', href: 'javascript:alert(1)' }), null);
  assert.equal(normalizeActivityAction({ id: '', label: 'Missing id' }), null);
  assert.equal(normalizeActivityAction({ id: 'empty' }), null);
  assert.equal(normalizeActivityAction({ id: 'unnamed-icon', icon: 'eye' }), null);
  assert.equal(normalizeActivityAction({ id: 'bad-callback', label: 'Bad', onselect: true }), null);

  const source = [
    { id: 'open', label: 'Open' },
    { id: 'open', label: 'Duplicate' },
    { id: 'remove', title: 'Remove', icon: 'trash', disabled: true, kind: 'danger' },
    null
  ];
  const resolved = resolveActivityActions(source);
  assert.deepEqual(resolved.map((action) => action.id), ['open', 'remove']);
  assert.notEqual(resolved[0], source[0]);
  assert.equal(resolved[1].disabled, true);
  assert.equal(resolved[1].kind, 'danger');
});

test('activity timestamps expose machine-readable dates and retain invalid display-only labels', () => {
  assert.deepEqual(normalizeActivityTimestamp('2026-08-31T10:15:00Z', 'Yesterday'), {
    dateTime: '2026-08-31T10:15:00.000Z',
    label: 'Yesterday'
  });
  assert.deepEqual(normalizeActivityTimestamp('not-a-date', null), {
    dateTime: null,
    label: 'not-a-date'
  });
  assert.deepEqual(normalizeActivityTimestamp(null, 'Just now'), {
    dateTime: null,
    label: 'Just now'
  });
  assert.equal(normalizeActivityTimestamp(null, null), null);
});

test('ActivityItem keeps DOM handling delegated, lifecycle-safe, and text-safe', () => {
  const source = readFileSync(
    new URL('../../src/components/activity-item/activity-item.js', import.meta.url), 'utf8'
  );
  assert.match(source, /@extends \{Component<ActivityItemOptions>\}/);
  assert.match(source, /this\.listen\(root, 'click'/);
  assert.match(source, /honorDomCancellation:\s*true/);
  assert.match(source, /h\('article'/);
  assert.match(source, /h\('time'/);
  assert.doesNotMatch(source, /\.addEventListener\s*\(/);
  assert.doesNotMatch(source, /\.innerHTML\s*=/);
});

test('activity states carry their own badge, intent, and busy semantics', () => {
  assert.deepEqual(resolveActivityState('pending', null), {
    state: 'pending',
    busy: true,
    key: 'activityItem.pending',
    fallback: 'Sending…',
    kind: 'neutral',
    label: null
  });

  // A failed send has finished. Leaving aria-busy on it would tell a screen reader the region is
  // still updating and suppress the announcement that says the message never went out.
  assert.deepEqual(resolveActivityState('failed', null), {
    state: 'failed',
    busy: false,
    key: 'activityItem.failed',
    fallback: 'Failed',
    kind: 'danger',
    label: null
  });

  assert.equal(resolveActivityState('failed', 'Nicht gesendet').label, 'Nicht gesendet');

  // stateLabel only names a badge that exists, so it cannot conjure one on a settled entry.
  for (const value of ['default', 'bogus', null, undefined, 'constructor']) {
    assert.deepEqual(resolveActivityState(value, 'ignored'), {
      state: 'default', busy: false, key: null, fallback: null, kind: 'neutral', label: null
    });
  }
});

test('activity state words are translatable and default to their English text', () => {
  const probe = Object.create(ActivityItem.prototype);
  probe.options = {};
  try {
    setTranslator(null);
    assert.equal(probe._message('activityItem.pending', 'Sending…'), 'Sending…');
    assert.equal(probe._message('activityItem.failed', 'Failed'), 'Failed');
    setTranslator((key) => (key === 'activityItem.pending' ? 'Wird gesendet…' : null));
    assert.equal(probe._message('activityItem.pending', 'Sending…'), 'Wird gesendet…');
    assert.equal(probe._message('activityItem.failed', 'Failed'), 'Failed');
  } finally {
    setTranslator(null);
  }
});

test('ActivityItem reflects its state on the item and builds the badge from the resolved intent', () => {
  const source = readFileSync(
    new URL('../../src/components/activity-item/activity-item.js', import.meta.url), 'utf8'
  );
  assert.match(source, /root\.dataset\.state = state\.state;/);
  assert.match(source, /if \(state\.busy\) root\.setAttribute\('aria-busy', 'true'\);\s*\n\s*else root\.removeAttribute\('aria-busy'\);/);
  assert.match(source, /badge\(\{[\s\S]{0,200}?kind: state\.kind/);
  assert.match(source, /label: state\.label \?\? this\._message\(state\.key, state\.fallback\)/);
});
