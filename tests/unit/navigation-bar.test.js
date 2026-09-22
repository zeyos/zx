import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import {
  lengthToPixels, NavigationBar, OVERFLOW_BELOW, resolveMinVisible, resolveOverflowBelow
} from '../../src/components/navigation-bar/navigation-bar.js';

/*
 * `tests/unit/` runs in Node with no DOM, so what is testable here is everything the bar decides
 * before it touches an element: where it collapses, how many items survive the collapse, and how
 * a threshold it was given as a CSS length becomes a number it can compare a measured width with.
 *
 * The stylesheet is read as text for the one fact the two halves have to agree on. A container
 * query cannot read a custom property, so the default threshold is written twice — once in
 * `OVERFLOW_BELOW` and once in the `@container` rule — and if they ever drift the bar measures
 * against one number while the browser collapses at another.
 */
const css = readFileSync(
  fileURLToPath(new URL('../../src/components/navigation-bar/navigation-bar.css', import.meta.url)),
  'utf8'
);

test('the default threshold is the one the stylesheet collapses at', () => {
  assert.equal(OVERFLOW_BELOW, '44rem');
  assert.ok(css.includes(`@container (max-width: ${OVERFLOW_BELOW})`),
    `navigation-bar.css no longer carries @container (max-width: ${OVERFLOW_BELOW})`);
  assert.equal(NavigationBar.defaults.overflowBelow, OVERFLOW_BELOW);
  assert.equal(NavigationBar.defaults.overflow, true);
  assert.equal(NavigationBar.defaults.minVisible, 0);
});

test('an unconfigured bar resolves to exactly what it always did', () => {
  // Every item collapses, at the stylesheet's own threshold, with no measurement involved.
  assert.equal(resolveOverflowBelow({}), OVERFLOW_BELOW);
  assert.equal(resolveMinVisible({}, 6), 0);
  assert.equal(resolveOverflowBelow({ title: 'ZeyOS', items: [] }), OVERFLOW_BELOW);
});

test('either switch turns collapsing off, and both mean the same thing', () => {
  assert.equal(resolveOverflowBelow({ overflow: false }), null);
  assert.equal(resolveOverflowBelow({ overflowBelow: false }), null);
  // `overflow: false` wins over a threshold, rather than the two disagreeing.
  assert.equal(resolveOverflowBelow({ overflow: false, overflowBelow: '30rem' }), null);
});

test('a threshold may be a length or a number of pixels', () => {
  assert.equal(resolveOverflowBelow({ overflowBelow: '30rem' }), '30rem');
  assert.equal(resolveOverflowBelow({ overflowBelow: '  480px  ' }), '480px');
  assert.equal(resolveOverflowBelow({ overflowBelow: '37.5rem' }), '37.5rem');
  assert.equal(resolveOverflowBelow({ overflowBelow: 480 }), '480px');
  assert.equal(resolveOverflowBelow({ overflowBelow: 0 }), '0px');
});

test('a threshold the bar cannot measure is refused, not silently ignored', () => {
  // A viewport unit reads as a threshold and behaves as none at all, which is the worst outcome.
  assert.throws(() => resolveOverflowBelow({ overflowBelow: '50vw' }), TypeError);
  assert.throws(() => resolveOverflowBelow({ overflowBelow: '44' }), TypeError);
  assert.throws(() => resolveOverflowBelow({ overflowBelow: true }), TypeError);
  assert.throws(() => resolveOverflowBelow({ overflowBelow: -480 }), RangeError);
  assert.throws(() => resolveOverflowBelow({ overflow: 'yes' }), TypeError);
  // Nullish is "not set", as everywhere else in an options object — only `false` is the switch.
  assert.equal(resolveOverflowBelow({ overflowBelow: null }), OVERFLOW_BELOW);
  assert.equal(resolveOverflowBelow({ overflowBelow: undefined }), OVERFLOW_BELOW);
});

test('minVisible counts from the start and never exceeds the items there are', () => {
  assert.equal(resolveMinVisible({ minVisible: 4 }, 6), 4);
  assert.equal(resolveMinVisible({ minVisible: 4 }, 4), 4);
  // Three items and a promise of four: the overflow menu is empty rather than holding a phantom.
  assert.equal(resolveMinVisible({ minVisible: 4 }, 3), 3);
  assert.equal(resolveMinVisible({ minVisible: 4 }, 0), 0);
  assert.equal(resolveMinVisible({ minVisible: 0 }, 6), 0);
  assert.equal(resolveMinVisible({}, 6), 0);
});

test('minVisible must be a count', () => {
  assert.throws(() => resolveMinVisible({ minVisible: -1 }, 6), TypeError);
  assert.throws(() => resolveMinVisible({ minVisible: 2.5 }, 6), TypeError);
  assert.throws(() => resolveMinVisible({ minVisible: '4' }, 6), TypeError);
});

test('a threshold becomes pixels against the root font size', () => {
  assert.equal(lengthToPixels('44rem', 16), 704);
  assert.equal(lengthToPixels('44rem', 20), 880);
  assert.equal(lengthToPixels('375px', 20), 375);
  assert.equal(lengthToPixels(375), 375);
  assert.equal(lengthToPixels('37.5rem', 16), 600);
});

test('an unreadable root font size falls back to 16 rather than to NaN', () => {
  // `getComputedStyle` on a detached document answers with an empty string, and a NaN threshold
  // compares false against every width — the bar would simply never collapse.
  assert.equal(lengthToPixels('44rem', Number.NaN), 704);
  assert.equal(lengthToPixels('44rem', 0), 704);
  assert.equal(lengthToPixels('44rem', undefined), 704);
  assert.throws(() => lengthToPixels('50vw', 16), TypeError);
});

test('the stylesheet carries the same collapse in both mechanisms', () => {
  /*
   * The container query serves the default threshold and `[data-narrow]` serves every other one,
   * because CSS cannot parameterise a container query. Two mechanisms means two chances to change
   * one and forget the other, so each of the three collapse declarations is required in both.
   */
  const container = css.slice(css.indexOf(`@container (max-width: ${OVERFLOW_BELOW})`));
  for (const rule of ['data-overflow="all"', 'data-overflow="partial"', 'data-empty="true"']) {
    assert.ok(container.includes(rule), `the container query no longer handles ${rule}`);
  }
  for (const rule of [
    '.zx-navigation-bar[data-overflow="all"][data-narrow="true"] .zx-navigation-bar__items',
    '.zx-navigation-bar[data-overflow="partial"][data-narrow="true"]',
    '.zx-navigation-bar[data-narrow="true"]:not([data-overflow="off"])'
  ]) {
    assert.ok(css.includes(rule), `the measured threshold no longer handles ${rule}`);
  }
  // `overflow: false` shows no More button under either mechanism.
  const shows = css.split('}')
    .filter((rule) => rule.includes('.zx-navigation-bar__more:not([data-empty="true"])'));
  assert.equal(shows.length, 2, 'the More button should be revealed by exactly two rules');
  for (const rule of shows) {
    assert.ok(rule.includes(':not([data-overflow="off"])'),
      `a rule reveals the More button without excluding overflow: false —\n${rule.trim()}`);
  }
});
