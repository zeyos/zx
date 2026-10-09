import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { BADGE_TONES, normalizeBadgeTone } from '../../src/components/badge/badge.js';

/*
 * `badge()` builds DOM, which `node --test` does not have; its rendering is covered by the smoke
 * suite. The decision it makes about `tone` is pure and lives here.
 */

test('the tone palette is the categorical one, apart from the semantic kinds', () => {
  assert.deepEqual([...BADGE_TONES],
    ['blue', 'teal', 'green', 'amber', 'orange', 'red', 'pink', 'violet', 'slate']);
  for (const kind of ['neutral', 'accent', 'success', 'warning', 'danger', 'info']) {
    assert.equal(BADGE_TONES.includes(/** @type {any} */ (kind)), false, kind);
  }
});

test('a known tone is kept and anything else is no tone at all', () => {
  for (const tone of BADGE_TONES) assert.equal(normalizeBadgeTone(tone), tone);
  assert.equal(normalizeBadgeTone(null), null);
  assert.equal(normalizeBadgeTone(undefined), null);
  assert.equal(normalizeBadgeTone(''), null);
  assert.equal(normalizeBadgeTone('Blue'), null);
  assert.equal(normalizeBadgeTone('success'), null);
  assert.equal(normalizeBadgeTone('var(--x)'), null);
});

test('the neutral soft fill is a wash of the text colour, visible on any surface', () => {
  const css = readFileSync(new URL('../../src/components/badge/badge.css', import.meta.url), 'utf8');
  const base = /(?:^|\n)\.zx-badge\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
  // An opaque muted step equals the raised surface in the dark theme, where the badge vanished.
  assert.match(base, /background:\s*color-mix\(in srgb, var\(--zx-color-text\) \d+%, transparent\)/);
  assert.doesNotMatch(base, /background:\s*var\(--zx-color-bg-(?:muted|raised)\)/);
});

test('a small badge with a dot has room between the dot and a readable label', () => {
  const css = readFileSync(new URL('../../src/components/badge/badge.css', import.meta.url), 'utf8');
  const dotted = /\.zx-badge\[data-size="sm"\]:has\(> \.zx-badge__dot\)\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
  assert.match(dotted, /gap:\s*var\(--zx-space-1\)/);
  assert.match(dotted, /font-size:\s*var\(--zx-text-xs\)/);
});
