import assert from 'node:assert/strict';
import test from 'node:test';

import { clampSize, resolveSize, snapSize } from '../../src/components/split-view/split-view.js';

/* --------------------------------------------------------------------- resolveSize -- */

test('resolveSize reads pixels from numbers, bare strings, and px lengths', () => {
  assert.equal(resolveSize(240, 1000), 240);
  assert.equal(resolveSize('240', 1000), 240);
  assert.equal(resolveSize('240px', 1000), 240);
  assert.equal(resolveSize('240PX', 1000), 240);
  assert.equal(resolveSize('  240px  ', 1000), 240);
  assert.equal(resolveSize('12.5px', 1000), 12.5);
  assert.equal(resolveSize('.5px', 1000), 0.5);
  assert.equal(resolveSize(0, 1000), 0);
  assert.equal(resolveSize(-40, 1000), -40);
});

test('resolveSize resolves percentages against the container', () => {
  assert.equal(resolveSize('38%', 1000), 380);
  assert.equal(resolveSize('100%', 640), 640);
  assert.equal(resolveSize('0%', 640), 0);
  assert.equal(resolveSize('12.5%', 800), 100);
  // A container of zero makes every percentage zero — the caller, not this helper, decides
  // whether an unmeasurable container is worth acting on.
  assert.equal(resolveSize('38%', 0), 0);
});

test('resolveSize returns NaN for lengths only the browser can resolve', () => {
  for (const value of ['12rem', '4em', '10vh', '50vw', 'calc(100% - 20px)', 'auto', '', '   ']) {
    assert.ok(Number.isNaN(resolveSize(value, 1000)), `${value} should be NaN`);
  }
});

test('resolveSize returns NaN for values that are not sizes at all', () => {
  for (const value of [null, undefined, {}, [], true, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.ok(Number.isNaN(resolveSize(/** @type {any} */ (value), 1000)));
  }
  // A percentage needs a usable container to mean anything.
  assert.ok(Number.isNaN(resolveSize('50%', Number.NaN)));
});

/* ----------------------------------------------------------------------- clampSize -- */

test('clampSize leaves a size that already fits alone', () => {
  assert.equal(clampSize({ size: 400, min: 160, max: null, total: 1000 }), 400);
  assert.equal(clampSize({ size: 160, min: 160, max: null, total: 1000 }), 160);
});

test('clampSize lifts a size below the minimum and cuts one above the maximum', () => {
  assert.equal(clampSize({ size: 40, min: 160, max: null, total: 1000 }), 160);
  assert.equal(clampSize({ size: 900, min: 160, max: 480, total: 1000 }), 480);
  assert.equal(clampSize({ size: -300, min: 160, max: 480, total: 1000 }), 160);
});

test('clampSize keeps the trailing pane from going negative', () => {
  // Without an explicit max the container itself is the ceiling.
  assert.equal(clampSize({ size: 4000, min: 160, max: null, total: 1000 }), 1000);
  // The divider takes its thickness off the top before anything else.
  assert.equal(clampSize({ size: 4000, min: 160, max: null, total: 1000, divider: 8 }), 992);
  // A max wider than the container never wins.
  assert.equal(clampSize({ size: 900, min: 160, max: 5000, total: 400, divider: 8 }), 392);
});

test('clampSize gives up the minimum before it overflows a small container', () => {
  // 160px will not fit in 100px, so the minimum yields rather than pushing the other pane away.
  assert.equal(clampSize({ size: 200, min: 160, max: null, total: 100 }), 100);
  assert.equal(clampSize({ size: 200, min: 160, max: null, total: 100, divider: 8 }), 92);
  assert.equal(clampSize({ size: 10, min: 160, max: null, total: 100 }), 100);
});

test('clampSize passes the request through when the container measures nothing', () => {
  // A hidden tab or a detached node: clamping against zero would flatten a good size.
  assert.equal(clampSize({ size: 240, min: 160, max: 400, total: 0 }), 240);
  assert.equal(clampSize({ size: 240, min: 160, max: 400, total: -100 }), 240);
  assert.equal(clampSize({ size: 240, min: 160, max: 400, total: 8, divider: 8 }), 240);
  // Never negative, even then.
  assert.equal(clampSize({ size: -240, min: 160, max: 400, total: 0 }), 0);
});

test('clampSize falls back to the minimum for a size that is not a number', () => {
  assert.equal(clampSize({ size: Number.NaN, min: 160, max: 400, total: 1000 }), 160);
  assert.equal(clampSize({ size: /** @type {any} */ ('wide'), min: 160, max: null, total: 1000 }), 160);
  assert.equal(clampSize({ size: Number.NaN, min: 160, max: 400, total: 0 }), 0);
});

test('clampSize treats its geometry as optional', () => {
  assert.equal(clampSize({ size: 300, total: 1000 }), 300);
  assert.equal(clampSize({ size: 3000, total: 1000 }), 1000);
  assert.equal(clampSize({ size: 300 }), 300);
});

/* ------------------------------------------------------------------------ snapSize -- */

test('snapSize lands on a target inside the radius and ignores one outside it', () => {
  assert.equal(snapSize(374, [380], 10), 380);
  assert.equal(snapSize(374, [380], 4), 374);
  // The radius is inclusive.
  assert.equal(snapSize(370, [380], 10), 380);
  assert.equal(snapSize(369, [380], 10), 369);
});

test('snapSize picks the nearest target and breaks ties on listing order', () => {
  assert.equal(snapSize(300, [160, 290, 480], 40), 290);
  assert.equal(snapSize(300, [280, 320], 40), 280);
  assert.equal(snapSize(300, [320, 280], 40), 320);
});

test('snapSize is off for a radius of zero or less', () => {
  assert.equal(snapSize(374, [380, 160], 0), 374);
  assert.equal(snapSize(374, [380, 160], -20), 374);
  assert.equal(snapSize(374, [380, 160], Number.NaN), 374);
});

test('snapSize survives odd target lists', () => {
  assert.equal(snapSize(374, [], 20), 374);
  assert.equal(snapSize(374, null, 20), 374);
  assert.equal(snapSize(374, 380, 20), 380);
  assert.equal(snapSize(374, [Number.NaN, null, 'x', 380], 20), 380);
});

test('snapSize hands back a size it cannot read', () => {
  assert.ok(Number.isNaN(snapSize(Number.NaN, [380], 20)));
});

/* -------------------------------------------------------------- the three together -- */

test('a drag that ends near the initial size settles exactly on it', () => {
  const geometry = { min: 160, max: null, total: 1000, divider: 8 };
  const initial = resolveSize('38%', geometry.total);
  const dragged = clampSize({ size: 372, ...geometry });
  assert.equal(clampSize({ size: snapSize(dragged, [initial, 160, 992], 12), ...geometry }), 380);
});

test('a snap target outside the legal range is clamped back into it', () => {
  const geometry = { min: 160, max: 400, total: 1000, divider: 8 };
  const snapped = snapSize(408, [420], 20);
  assert.equal(snapped, 420);
  assert.equal(clampSize({ size: snapped, ...geometry }), 400);
});
