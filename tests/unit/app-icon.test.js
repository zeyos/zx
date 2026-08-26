import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { AppIcon } from '../../src/components/app-icon/app-icon.js';

test('AppIcon defaults keep an unlabeled icon decorative and glass progressively optional', () => {
  assert.equal(AppIcon.defaults.label, null);
  assert.equal(AppIcon.defaults.glass, 'subtle');
  assert.equal(AppIcon.defaults.selected, false);
  assert.equal(AppIcon.defaults.shape, 'tile');
  assert.equal(AppIcon.defaults.iconSize, '52%');
});

test('AppIcon CSS retains reduced-transparency and forced-color fallbacks', () => {
  const css = readFileSync(fileURLToPath(new URL(
    '../../src/components/app-icon/app-icon.css', import.meta.url)), 'utf8');
  assert.match(css, /@media \(prefers-reduced-transparency: reduce\)/);
  assert.match(css, /@media \(prefers-reduced-motion: no-preference\)/);
  assert.match(css, /@media \(forced-colors: active\)/);
  assert.match(css, /\[data-glass="none"\]/);
  assert.match(css, /var\(--zx-color-app-icon-glyph\)/);
  assert.match(css, /data-shape="circle"/);
  assert.match(css, /\.zx-app-icon__surface/);
  assert.match(css, /\[role="button"\]\):not\(:disabled\):not\(\[aria-disabled="true"\]\):hover \.zx-app-icon__surface/);
  assert.match(css, /transform: translate\(-50%, -50%\)/);
  assert.match(css, /calc\(var\(--zx-app-icon-size\) \* \.12\)/);
  assert.match(css, /inset-block-start: -3px/);
  assert.match(css, /var\(--zx-app-icon-color\) var\(--zx-app-icon-core-strength\)/);
  assert.match(css, /var\(--zx-app-icon-color\) var\(--zx-app-icon-bloom-strength\)/);
  assert.match(css, /var\(--zx-app-icon-color\) var\(--zx-app-icon-rim-strength\)/);
  assert.match(css, /radial-gradient\(112% 92% at 50% 122%/);
  assert.doesNotMatch(css, /translateY\(/, 'small AppIcons must not jump in dense rails');
  assert.doesNotMatch(css, /drop-shadow\(/, 'small AppIcon glyphs must remain crisp');
  assert.doesNotMatch(css, /backdrop-filter: var\(--zx-glass-filter/, 'icons must not create blur layers');
});

test('AppIcon colour recipes stay instance-local', () => {
  const component = readFileSync(fileURLToPath(new URL(
    '../../src/components/app-icon/app-icon.css', import.meta.url)), 'utf8');
  const semantic = readFileSync(fileURLToPath(new URL(
    '../../styles/tokens/semantic.css', import.meta.url)), 'utf8');
  const studio = readFileSync(fileURLToPath(new URL(
    '../../website/theme-presets.js', import.meta.url)), 'utf8');

  assert.match(component, /var\(--zx-app-icon-color\) var\(--zx-app-icon-core-strength\)/);
  assert.match(component, /var\(--zx-app-icon-color\) var\(--zx-app-icon-halo-strength\)/);
  assert.doesNotMatch(semantic, /var\(--zx-app-icon-color\)/,
    'a root token would freeze every AppIcon to the inherited accent colour');
  assert.doesNotMatch(studio, /var\(--zx-app-icon-color\)/,
    'a Theme Studio override would freeze every AppIcon to the inherited accent colour');
});

test('AppIcon does not pass an absent badge to native replaceChildren', () => {
  const source = readFileSync(fileURLToPath(new URL(
    '../../src/components/app-icon/app-icon.js', import.meta.url)), 'utf8');
  assert.match(source, /if \(badge\) children\.push\(badge\)/);
  assert.match(source, /const children = \[surface\]/);
  assert.match(source, /replaceChildren\(\.\.\.children\)/);
});

test('ZeyOS AppIcon and compact module chips keep separate shape defaults', () => {
  const source = readFileSync(fileURLToPath(new URL(
    '../../src/zeyos/icons.js', import.meta.url)), 'utf8');
  assert.match(source, /moduleChip\(name, \{ shape: 'circle', \.\.\.options \}\)/);
  assert.match(source, /shape: options\.shape \?\? 'tile'/);
});
