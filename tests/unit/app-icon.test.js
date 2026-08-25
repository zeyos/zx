import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { AppIcon } from '../../src/components/app-icon/app-icon.js';

test('AppIcon defaults keep an unlabeled icon decorative and glass progressively optional', () => {
  assert.equal(AppIcon.defaults.label, null);
  assert.equal(AppIcon.defaults.glass, 'subtle');
  assert.equal(AppIcon.defaults.selected, false);
  assert.equal(AppIcon.defaults.iconSize, '52%');
});

test('AppIcon CSS retains reduced-transparency and forced-color fallbacks', () => {
  const css = readFileSync(fileURLToPath(new URL(
    '../../src/components/app-icon/app-icon.css', import.meta.url)), 'utf8');
  assert.match(css, /@media \(prefers-reduced-transparency: reduce\)/);
  assert.match(css, /@media \(forced-colors: active\)/);
  assert.match(css, /\[data-glass="none"\]/);
});
