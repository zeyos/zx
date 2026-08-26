import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const html = readFileSync(fileURLToPath(new URL('../../website/aurora-preview.html', import.meta.url)), 'utf8');
const css = readFileSync(fileURLToPath(new URL('../../website/aurora-preview.css', import.meta.url)), 'utf8');

test('Aurora preview compares all six directions in dark and light', () => {
  for (const name of [
    'Source Bloom', 'Corner Confluence', 'Horizon Band',
    'Diagonal Veil', 'Edge Frame', 'Curtain Field'
  ]) {
    assert.match(html, new RegExp(`<h2>${name}</h2>`));
    assert.match(html, new RegExp(`aria-label="${name} in dark mode"`));
    assert.match(html, new RegExp(`aria-label="${name} in light mode"`));
  }
});

test('Aurora preview is local, dependency-free, and does not expose a component API', () => {
  assert.doesNotMatch(html, /https?:\/\//);
  assert.doesNotMatch(html, /type="module"|\bimport\s|new\s+Aurora|Aurora\s*\(/);
  assert.doesNotMatch(css, /url\(|@keyframes|filter:\s*url\(/);
  assert.match(html, /\.\.\/styles\/zx\.css/);
  assert.match(html, /id="aurora-accent-emerald"[\s\S]*?type="radio"/);
  assert.match(css, /:has\(#aurora-accent-coral:checked\)/);
});

test('Aurora preview defines quiet accessibility fallbacks', () => {
  assert.match(css, /@media \(prefers-reduced-transparency: reduce\)/);
  assert.match(css, /@media \(forced-colors: active\)/);
  assert.match(css, /background-image: none !important/);
  assert.match(css, /backdrop-filter: none/);
});
