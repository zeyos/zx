import assert from 'node:assert/strict';
import test from 'node:test';

import { avatarInitials } from '../../src/components/avatar/avatar.js';

test('avatar initials use first and last words and handle whitespace', () => {
  assert.equal(avatarInitials('  Ada   Lovelace  '), 'AL');
  assert.equal(avatarInitials('Plato'), 'P');
  assert.equal(avatarInitials(''), '?');
});

test('avatar initials retain non-Latin graphemes', () => {
  assert.equal(avatarInitials('山田 太郎'), '山太');
  assert.equal(avatarInitials('élise dupont'), 'ÉD');
});

test('avatar initials remain at most two graphemes after Unicode case expansion', () => {
  assert.equal(avatarInitials('ß alpha'), 'SA');
  assert.equal(avatarInitials('ﬃ ﬁ'), 'FF');
  assert.equal(Array.from(avatarInitials('ß alpha')).length, 2);
});
