import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { keyLabels } from '../../src/components/kbd/kbd.js';

/*
 * `kbd()` builds DOM, which `node --test` does not have; its rendering is covered in the browser.
 * The labels it draws are pure and live here.
 */

test('a chord splits on plus and names modifiers per platform', () => {
  assert.deepEqual(keyLabels('Mod+Shift+K', { apple: true }), ['⌘', '⇧', 'K']);
  assert.deepEqual(keyLabels('Mod+Shift+K', { apple: false }), ['Ctrl', 'Shift', 'K']);
  assert.deepEqual(keyLabels('Alt+Enter', { apple: true }), ['⌥', '↵']);
  assert.deepEqual(keyLabels('Ctrl+Backspace', { apple: false }), ['Ctrl', 'Backspace']);
});

test('named keys read the same everywhere, letters are upper-cased, anything else is kept', () => {
  assert.deepEqual(keyLabels('Escape', { apple: false }), ['Esc']);
  assert.deepEqual(keyLabels('ArrowUp', { apple: true }), ['↑']);
  assert.deepEqual(keyLabels('k', { apple: true }), ['K']);
  assert.deepEqual(keyLabels('F2', { apple: true }), ['F2']);
  assert.deepEqual(keyLabels('?', { apple: true }), ['?']);
});

test('a literal plus survives, and a list is taken as written', () => {
  assert.deepEqual(keyLabels('+', { apple: true }), ['+']);
  assert.deepEqual(keyLabels('Mod++', { apple: true }), ['⌘', '+']);
  assert.deepEqual(keyLabels(['g', 'h'], { apple: true }), ['G', 'H']);
  assert.deepEqual(keyLabels(['⌘↵'], { apple: false }), ['⌘↵']);
});

test('the keycap is one construction with retint hooks, centred on cap height where supported', () => {
  const css = readFileSync(new URL('../../src/components/kbd/kbd.css', import.meta.url), 'utf8');
  for (const hook of ['--zx-kbd-ink', '--zx-kbd-fill', '--zx-kbd-line']) assert.match(css, new RegExp(`var\\(${hook},`));
  assert.match(css, /@supports \(text-box: trim-both cap alphabetic\)/);
  assert.match(css, /\.zx-kbd\[data-tone="inherit"\]/);
});
