import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import {
  DEFAULTS, PRESETS, STOPS, TINTS, accentRamp, contrast, neutralRamp, presetById, themeCss,
  themeVars, toHex, toOklch
} from '../../website/theme-presets.js';

/*
 * The theme studio's preset table and `styles/tokens/themes.css` describe the same six themes: one
 * is what the studio draws swatches from and exports, the other is what an application actually
 * loads. Only the stylesheet ships, so a drift between them is invisible in the library and wrong
 * everywhere the studio claims to be showing a preset.
 */
const themesCss = readFileSync(
  fileURLToPath(new URL('../../styles/tokens/themes.css', import.meta.url)), 'utf8'
);

/** @returns {Record<string, Record<number, string>>} Every `[data-zx-preset]` block in the CSS. */
function cssPresets() {
  const found = {};
  const blocks = themesCss.matchAll(/\[data-zx-preset="([\w-]+)"\]\s*\{([^}]*)\}/g);
  for (const [, id, body] of blocks) {
    const ramp = {};
    for (const [, stop, value] of body.matchAll(/--zx-accent-(\d+):\s*([^;]+);/g)) {
      ramp[Number(stop)] = value.trim();
    }
    found[id] = ramp;
  }
  return found;
}

test('every preset ships as CSS with the same ramp the studio shows', () => {
  const fromCss = cssPresets();
  assert.deepEqual(
    Object.keys(fromCss).sort(),
    PRESETS.map((preset) => preset.id).sort(),
    'styles/tokens/themes.css and website/theme-presets.js list different presets'
  );
  for (const preset of PRESETS) {
    assert.deepEqual(fromCss[preset.id], preset.ramp, `the ${preset.id} ramp differs`);
  }
});

test('the default preset is the ramp the palette already defines', () => {
  // `zx` restates the green ramp from tokens/global.css, so anything setting `data-zx-preset="zx"`
  // explicitly gets exactly the stock theme rather than a near-miss of it.
  const global = readFileSync(
    fileURLToPath(new URL('../../styles/tokens/global.css', import.meta.url)), 'utf8'
  );
  for (const stop of STOPS) {
    const match = new RegExp(`--zx-green-${stop}:\\s*([^;]+);`).exec(global);
    assert.ok(match, `--zx-green-${stop} is missing from the palette`);
    assert.equal(presetById('zx').ramp[stop], match[1].trim());
  }
});

test('every shipped preset keeps its accent legible in both themes', () => {
  for (const preset of PRESETS) {
    // The stop each theme fills a button with, against the ink `--zx-color-on-accent` puts on it.
    assert.ok(contrast(preset.ramp[600], '#ffffff') >= 4.5,
      `${preset.id}: the 600 stop fails AA against white`);
    assert.ok(contrast(preset.ramp[400], '#09090b') >= 4.5,
      `${preset.id}: the 400 stop fails AA against the dark page`);
  }
});

test('a derived ramp holds the same contrast promise for any hue', () => {
  for (let hue = 0; hue < 360; hue += 15) {
    // Full chroma is the worst case: the gamut fit only ever reduces it, and a less saturated
    // colour at the same lightness has more contrast, not less.
    const picked = toHex({ l: 0.7, c: 0.37, h: hue });
    const ramp = accentRamp(picked);
    assert.ok(contrast(ramp[600], '#ffffff') >= 4.5, `hue ${hue}: the 600 stop fails AA on white`);
    assert.ok(contrast(ramp[400], '#09090b') >= 4.5, `hue ${hue}: the 400 stop fails AA on dark`);
  }
});

test('a derived ramp keeps the hue it was given', () => {
  const picked = '#2b7fff';
  const wanted = toOklch(picked).h;
  for (const stop of STOPS) {
    const got = toOklch(accentRamp(picked)[stop]).h;
    assert.ok(Math.abs(got - wanted) < 2, `stop ${stop} drifted from hue ${wanted} to ${got}`);
  }
});

test('a colour picked far outside the ramp still lands on it', () => {
  // The point of fixing lightness per stop: a near-black or near-white pick has to come back as a
  // usable ramp rather than five shades of the same unusable colour.
  for (const picked of ['#003300', '#ffe066', '#000000', '#ffffff']) {
    const ramp = accentRamp(picked);
    assert.ok(contrast(ramp[600], '#ffffff') >= 4.5, `${picked}: 600 fails AA on white`);
    assert.ok(contrast(ramp[400], '#09090b') >= 4.5, `${picked}: 400 fails AA on dark`);
  }
});

test('a neutral tint stays neutral at the ends of the ramp', () => {
  const cool = TINTS.find((tint) => tint.id === 'cool');
  const ramp = neutralRamp(cool, '#21cc75');
  assert.ok(toOklch(ramp['--zx-gray-50']).c < 0.006, 'the lightest stop picked up visible colour');
  assert.ok(toOklch(ramp['--zx-gray-500']).c > 0.02, 'the mid stop picked up no colour at all');
  assert.equal(Object.keys(ramp).length, 12);
});

test('an unchanged state produces no overrides', () => {
  assert.deepEqual(themeVars({ ...DEFAULTS }), {});
  assert.match(themeCss({ ...DEFAULTS }), /stock ZeyOS theme/);
});

test('the exported CSS names where the values came from', () => {
  assert.match(themeCss({ ...DEFAULTS, preset: 'ocean' }), /built from the Ocean preset/);
  // A custom accent replaces the preset's ramp, so crediting the preset would be wrong.
  assert.match(themeCss({ ...DEFAULTS, preset: 'ocean', accent: '#ff6a00' }), /custom #ff6a00 accent/);
});

test('only what changed is exported', () => {
  const vars = themeVars({ ...DEFAULTS, radius: 0.75, font: 'serif' });
  assert.deepEqual(Object.keys(vars), ['--zx-radius', '--zx-font-sans']);
  assert.equal(vars['--zx-radius'], '0.75rem');
});

test('non-default presets carry complete studio recipes, not only accent ramps', () => {
  for (const preset of PRESETS.slice(1)) {
    const changed = Object.entries(preset.recipe)
      .filter(([key, value]) => value !== DEFAULTS[key])
      .map(([key]) => key);
    assert.ok(changed.length >= 3, `${preset.label} does not meaningfully change its recipe`);
    const vars = themeVars({ ...DEFAULTS, preset: preset.id, ...preset.recipe });
    assert.ok(Object.keys(vars).length >= 3, `${preset.label} recipe produced only an accent change`);
  }
});

test('theme geometry, type, tint, and material controls each produce a token', () => {
  const vars = themeVars({
    ...DEFAULTS, tint: 'cool', radius: 0.8, controlHeight: 38, textSize: 16,
    font: 'serif', glass: 'strong'
  });
  assert.equal(vars['--zx-radius'], '0.8rem');
  assert.equal(vars['--zx-control-height'], '38px');
  assert.equal(vars['--zx-text-md'], '16px');
  assert.match(vars['--zx-font-sans'], /Iowan Old Style/);
  assert.equal(vars['--zx-glass-blur'], '14px');
  assert.ok(Object.hasOwn(vars, '--zx-gray-500'), 'neutral tint did not produce a ramp');
});
