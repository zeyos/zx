import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import {
  ModuleBar, moduleOf, partitionModules, resolveModuleColor
} from '../../src/components/module-bar/module-bar.js';

const ids = (items) => items.map((item) => item.id);
const modules = (count, extra = {}) => Array.from({ length: count }, (_, index) => ({
  id: `m${index + 1}`, label: `Module ${index + 1}`, ...(extra[index] ?? {})
}));

test('partitionModules shows every module when they fit and nothing is pinned', () => {
  const result = partitionModules(modules(4), 10);
  assert.deepEqual(ids(result.visible), ['m1', 'm2', 'm3', 'm4']);
  assert.deepEqual(result.overflow, []);
  assert.equal(result.more, false);
  // No capacity means no limit.
  assert.equal(partitionModules(modules(30)).visible.length, 30);
});

test('partitionModules gives one slot to "All modules" when the bar overflows', () => {
  const result = partitionModules(modules(6), 4);
  assert.deepEqual(ids(result.visible), ['m1', 'm2', 'm3']);
  assert.deepEqual(ids(result.overflow), ['m4', 'm5', 'm6']);
  assert.equal(result.more, true);
});

test('partitionModules keeps the current module on the bar, displacing the last one', () => {
  const result = partitionModules(modules(6), 4, ['m6']);
  assert.deepEqual(ids(result.visible), ['m1', 'm2', 'm6']);
  assert.deepEqual(ids(result.overflow), ['m3', 'm4', 'm5']);
  // Two kept modules, and nulls ignored.
  const both = partitionModules(modules(6), 4, ['m5', null, 'm6', undefined]);
  assert.deepEqual(ids(both.visible), ['m1', 'm5', 'm6']);
});

test('partitionModules orders pinned modules first and keeps unpinned ones in the catalogue', () => {
  const items = modules(5, { 1: { pinned: 2 }, 3: { pinned: 1 }, 4: { pinned: true } });
  const result = partitionModules(items, Infinity);
  assert.deepEqual(ids(result.visible), ['m4', 'm2', 'm5']);
  assert.deepEqual(ids(result.overflow), ['m1', 'm3']);
  assert.equal(result.more, true);
  // A kept unpinned module joins the bar, after the pinned ones.
  assert.deepEqual(ids(partitionModules(items, Infinity, 'm3').visible), ['m4', 'm2', 'm5', 'm3']);
});

test('partitionModules tolerates junk and never returns a module twice', () => {
  assert.deepEqual(partitionModules(null), { visible: [], overflow: [], more: false });
  const result = partitionModules([{ id: 'a', label: 'A' }, null, { label: 'no id' }], 1, ['a', 'a']);
  assert.deepEqual(ids(result.visible), ['a']);
  assert.equal(result.overflow.length, 0);
});

test('resolveModuleColor prefers a valid colour, then a known tone, and rejects the rest', () => {
  assert.deepEqual(resolveModuleColor({ color: '#bc3885', tone: 'blue' }), { tone: null, color: '#bc3885' });
  assert.deepEqual(resolveModuleColor({ tone: 'teal' }), { tone: 'teal', color: null });
  assert.deepEqual(resolveModuleColor({ tone: 'chartreuse' }), { tone: null, color: null });
  // A custom property, a declaration break, or an image is not a colour.
  for (const color of ['var(--x)', 'red; background: url(x)', 'url(x)', '']) {
    assert.deepEqual(resolveModuleColor({ color, tone: 'red' }), { tone: 'red', color: null }, color);
  }
  assert.deepEqual(resolveModuleColor(null), { tone: null, color: null });
});

test('moduleOf finds the module that is, or contains, a destination', () => {
  const items = [
    { id: 'crm', label: 'CRM', children: [{ id: 'records', label: 'Records', children: [{ id: 'companies', label: 'Companies' }] }] },
    { id: 'mail', label: 'Mail' }
  ];
  assert.equal(moduleOf(items, 'companies')?.id, 'crm');
  assert.equal(moduleOf(items, 'mail')?.id, 'mail');
  assert.equal(moduleOf(items, 'nowhere'), null);
  assert.equal(moduleOf(items, null), null);
});

test('ModuleBar defaults: tint, flyout menus, one catalogue when needed', () => {
  assert.equal(ModuleBar.defaults.appearance, 'tint');
  assert.equal(ModuleBar.defaults.menus, 'flyout');
  assert.equal(ModuleBar.defaults.allModules, 'auto');
  assert.equal(ModuleBar.defaults.labels, 'hidden');
  assert.equal(ModuleBar.partBlock, 'zx-module-bar');
});

test('ModuleBar geometry follows the control height and keeps colour out of the stylesheet', () => {
  const css = readFileSync(fileURLToPath(new URL(
    '../../src/components/module-bar/module-bar.css', import.meta.url)), 'utf8');
  assert.match(css, /--zx-module-bar-target: calc\(var\(--zx-control-height\) \+ var\(--zx-space-2\)\)/);
  assert.match(css, /--zx-module-bar-tile: calc\(var\(--zx-control-height\) - var\(--zx-space-1\)\)/);
  // Every tone has its tint pair, and a host colour only enters through the custom property.
  for (const tone of ['blue', 'teal', 'green', 'amber', 'orange', 'red', 'pink', 'violet', 'slate']) {
    assert.match(css, new RegExp(`\\[data-tone="${tone}"\\] \\{ --zx-module-bar-fill: var\\(--zx-color-tone-${tone}-bg\\); --zx-module-bar-ink: var\\(--zx-color-tone-${tone}-fg\\); \\}`));
  }
  assert.match(css, /color-mix\(in srgb, var\(--zx-module-bar-color\) 16%, var\(--zx-color-bg-surface\)\)/);
  assert.match(css, /@media \(prefers-reduced-motion: no-preference\)/);
  assert.match(css, /@media \(forced-colors: active\)/);
  // Current is the neutral fill, never the accent.
  assert.match(css, /\[aria-current\][^{]*\{\s*background: var\(--zx-color-bg-current\)/);
});

test('partitionModules keeps a slot for an always-shown button even when every module fits', () => {
  const result = partitionModules(modules(5), 5, [], true);
  assert.deepEqual(ids(result.visible), ['m1', 'm2', 'm3', 'm4']);
  assert.deepEqual(ids(result.overflow), ['m5']);
  assert.equal(result.more, true);
  // With room to spare nothing moves, and the button still has its slot.
  assert.equal(partitionModules(modules(3), 10, [], true).visible.length, 3);
});
