import assert from 'node:assert/strict';
import test from 'node:test';

import { AVATAR_TONES, avatarInitials, avatarTone } from '../../src/components/avatar/avatar.js';

/** Tones pinned for a few names. The hash is part of the contract; see the tone tests below. */
const PINNED = { 'Ada Lovelace': 'pink', 'Grace Hopper': 'amber', 'Peter Zey': 'teal' };

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

test('a small avatar asks for one initial, not two', () => {
  assert.equal(avatarInitials('Ada Lovelace', 1), 'A');
  assert.equal(avatarInitials('Ada Lovelace', 2), 'AL');
  assert.equal(avatarInitials('', 1), '?');
});

/* ------------------------------------------------------------------------ tone -- */

test('the fallback tone is one of the palette, and the palette order is fixed', () => {
  assert.deepEqual([...AVATAR_TONES],
    ['blue', 'teal', 'green', 'amber', 'orange', 'red', 'pink', 'violet', 'slate']);
  for (const name of ['Ada Lovelace', 'Grace Hopper', 'Katherine Johnson', 'x', '山田 太郎']) {
    assert.ok(AVATAR_TONES.includes(avatarTone(name)), name);
    // The neutral is kept for "no name"; a real name always gets a colour.
    assert.notEqual(avatarTone(name), 'slate', name);
  }
});

test('the tone is a pure function of the name', () => {
  // Pinned values: the hash is part of the contract, because a person's colour has to be the same
  // on every screen and in every release. Changing these moves every avatar.
  assert.equal(avatarTone('Ada Lovelace'), avatarTone('Ada Lovelace'));
  assert.deepEqual(
    ['Ada Lovelace', 'Grace Hopper', 'Katherine Johnson', 'Peter Zey'].map(avatarTone),
    ['Ada Lovelace', 'Grace Hopper', 'Katherine Johnson', 'Peter Zey'].map(avatarTone));
  assert.equal(avatarTone('Ada Lovelace'), PINNED['Ada Lovelace']);
  assert.equal(avatarTone('Grace Hopper'), PINNED['Grace Hopper']);
  assert.equal(avatarTone('Peter Zey'), PINNED['Peter Zey']);
});

test('the tone ignores case, outer whitespace, and Unicode composition', () => {
  assert.equal(avatarTone('  ada lovelace '), avatarTone('Ada Lovelace'));
  assert.equal(avatarTone('ADA LOVELACE'), avatarTone('Ada Lovelace'));
  // "é" precomposed and as e + combining acute are the same name.
  assert.equal(avatarTone('André Weil'), avatarTone('André Weil'));
});

test('an empty name falls back to the neutral tone', () => {
  assert.equal(avatarTone(''), 'slate');
  assert.equal(avatarTone('   '), 'slate');
  assert.equal(avatarTone(null), 'slate');
  assert.equal(avatarTone(undefined), 'slate');
});

test('different names spread across the palette rather than collapsing onto one tone', () => {
  const names = ['Ada Lovelace', 'Grace Hopper', 'Katherine Johnson', 'Alan Turing', 'Edsger Dijkstra',
    'Barbara Liskov', 'Donald Knuth', 'Margaret Hamilton', 'Tim Berners-Lee', 'Radia Perlman',
    'Frances Allen', 'John Backus', 'Hedy Lamarr', 'Linus Torvalds', 'Shafi Goldwasser'];
  assert.ok(new Set(names.map(avatarTone)).size >= 6);
});
