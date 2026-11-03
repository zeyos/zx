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

const CSS = readFileSync(new URL('../../src/components/badge/badge.css', import.meta.url), 'utf8');

/** @param {string} selector @returns {string} The declarations of the rule with exactly that selector. */
function rule(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`).exec(CSS)?.[1] ?? '';
}

/** @param {string} body @param {string} property @returns {string|undefined} */
function value(body, property) {
  return new RegExp(`(?:^|[;\\s])${property}:\\s*([^;]+);`).exec(body)?.[1].trim();
}

test('a small badge is shorter, never smaller type', () => {
  assert.equal(value(rule('.zx-badge'), 'font-size'), 'var(--zx-text-xs)');
  assert.equal(value(rule('.zx-badge'), 'font-weight'), 'var(--zx-weight-medium)');
  // No rule anywhere in the stylesheet sets a badge below the 12px step.
  assert.doesNotMatch(CSS, /font-size:\s*calc\(var\(--zx-text-xs\)\s*-/);
  assert.equal(value(rule('.zx-badge[data-size="sm"]'), 'font-size'), undefined);
});

test('a chip\'s height follows the row it sits in, bounded by its own text', () => {
  for (const selector of ['.zx-badge', '.zx-badge[data-size="sm"]']) {
    const height = value(rule(selector), '--zx-badge-height') ?? '';
    assert.match(height, /^clamp\(calc\(var\(--zx-text-xs\) \* [\d.]+\), calc\(var\(--zx-row-height\) [^)]+\), calc\(var\(--zx-text-xs\) \* [\d.]+\)\)$/,
      selector);
  }
  assert.equal(value(rule('.zx-badge'), 'block-size'), 'var(--zx-badge-height)');
  assert.equal(value(rule('.zx-badge'), 'padding-block'), '0');
});

test('a status is a pill and a tag has small corners', () => {
  assert.equal(value(rule('.zx-badge'), 'border-radius'), 'var(--zx-radius-full)');
  assert.equal(value(rule('.zx-badge[data-tone]'), 'border-radius'), 'var(--zx-radius-md)');
});

test('a status dot is 6px at every size and sits in the centre of the pill\'s round end', () => {
  const dot = rule('.zx-badge__dot');
  assert.equal(value(dot, 'inline-size'), '6px');
  assert.equal(value(dot, 'block-size'), '6px');
  assert.doesNotMatch(CSS, /\.zx-badge\[data-size="sm"\][^{]*\.zx-badge__dot\s*\{/, 'a size restates the dot');
  // The 1px edge plus half the dot: its centre lands at half the height, the round end's centre.
  assert.equal(value(rule('.zx-badge:has(> .zx-badge__dot)'), 'padding-inline-start'), 'calc(var(--zx-badge-height) / 2 - 4px)');
  assert.equal(value(rule('.zx-badge'), 'gap'), 'var(--zx-space-1)');
});
