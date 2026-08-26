import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  expandAuroraColors, normalizeAuroraColors,
  normalizeAuroraIntensity, normalizeAuroraPreset
} from '../../src/components/aurora/aurora.js';

test('Aurora normalizes only its documented geometry and intensity names', () => {
  for (const preset of ['source', 'confluence', 'horizon', 'diagonal', 'edge', 'curtain']) {
    assert.equal(normalizeAuroraPreset(` ${preset.toUpperCase()} `), preset);
  }
  for (const intensity of ['subtle', 'balanced', 'vivid']) {
    assert.equal(normalizeAuroraIntensity(` ${intensity.toUpperCase()} `), intensity);
  }
  assert.throws(() => normalizeAuroraPreset('rainbow'), /Unknown Aurora preset/);
  assert.throws(() => normalizeAuroraIntensity('maximum'), /Unknown Aurora intensity/);
});

test('Aurora accepts zero to four concrete safe colours without mutating the input', () => {
  const input = [' #21cc75 ', 'oklch(65% .2 250)', 'coral'];
  assert.deepEqual(normalizeAuroraColors(input), ['#21cc75', 'oklch(65% .2 250)', 'coral']);
  assert.deepEqual(input, [' #21cc75 ', 'oklch(65% .2 250)', 'coral']);
  assert.deepEqual(normalizeAuroraColors(null), []);
  assert.throws(() => normalizeAuroraColors('#21cc75'), /must be an array/);
  assert.throws(() => normalizeAuroraColors(['red', 'blue', 'green', 'gold', 'violet']), /at most four/);
  for (const unsafe of ['url(https://example.test/color)', 'image-set(url(x) 1x)', 'red; background:url(x)', 'var(--secret)']) {
    assert.throws(() => normalizeAuroraColors([unsafe]), /Invalid Aurora color/);
  }
});

test('Aurora expands short palettes predictably across four fields', () => {
  assert.deepEqual(expandAuroraColors([]), []);
  assert.deepEqual(expandAuroraColors(['a']), ['a', 'a', 'a', 'a']);
  assert.deepEqual(expandAuroraColors(['a', 'b']), ['a', 'b', 'a', 'b']);
  assert.deepEqual(expandAuroraColors(['a', 'b', 'c']), ['a', 'b', 'c', 'b']);
  assert.deepEqual(expandAuroraColors(['a', 'b', 'c', 'd']), ['a', 'b', 'c', 'd']);
});

test('Aurora ships all geometries, accessibility fallbacks, and public registrations', () => {
  const css = readFileSync(fileURLToPath(new URL('../../src/components/aurora/aurora.css', import.meta.url)), 'utf8');
  for (const preset of ['source', 'confluence', 'horizon', 'diagonal', 'edge', 'curtain']) {
    assert.match(css, new RegExp(`data-preset="${preset}"`));
  }
  for (const channel of [1, 2, 3, 4]) {
    assert.match(css, new RegExp(`--zx-aurora-core-${channel}:`));
  }
  assert.match(css, /prefers-reduced-transparency: reduce/);
  assert.match(css, /prefers-contrast: more/);
  assert.match(css, /forced-colors: active/);
  assert.doesNotMatch(css, /@keyframes|url\(|filter:\s*url\(/);
  assert.doesNotMatch(css, /--zx-color-overlay|--zx-glass-filter/,
    'Aurora must remain independent from component material');

  const index = readFileSync(fileURLToPath(new URL('../../src/index.js', import.meta.url)), 'utf8');
  const styles = readFileSync(fileURLToPath(new URL('../../styles/zx.css', import.meta.url)), 'utf8');
  const docs = readFileSync(fileURLToPath(new URL('../../website/docs.js', import.meta.url)), 'utf8');
  assert.match(index, /export \{ Aurora \} from '.\/components\/aurora\/aurora\.js'/);
  assert.match(styles, /components\/aurora\/aurora\.css/);
  assert.match(docs, /'aurora'/);
});
