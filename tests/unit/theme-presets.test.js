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

/** @param {string} path @returns {string} */
function componentCss(path) {
  return readFileSync(fileURLToPath(new URL(`../../src/components/${path}`, import.meta.url)), 'utf8');
}

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
  assert.equal(vars['--zx-glass-blur'], '18px');
  assert.equal(vars['--zx-glass-color-strength'], '68%');
  assert.ok(Object.hasOwn(vars, '--zx-color-glass-control'), 'material controls did not change');
  assert.ok(Object.hasOwn(vars, '--zx-color-glass-chrome'), 'persistent chrome did not change');
  assert.equal(vars['--zx-glass-filter-overlay'], 'blur(22px) saturate(165%)');
  assert.equal(vars['--zx-color-app-icon-depth'], 'color-mix(in srgb, var(--zx-color-app-icon-shade) 34%, transparent)');
  assert.equal(vars['--zx-app-icon-core-strength'], '48%');
  assert.equal(vars['--zx-app-icon-bloom-strength'], '78%');
  assert.ok(Object.hasOwn(vars, '--zx-glass-raised-shadow'), 'raised material did not change');
  assert.ok(Object.hasOwn(vars, '--zx-gray-500'), 'neutral tint did not produce a ramp');
});

test('flat and deep-glass recipes change every shared material consumer', () => {
  const flat = themeVars({ ...DEFAULTS, glass: 'none' });
  const deep = themeVars({ ...DEFAULTS, glass: 'strong' });
  for (const name of [
    '--zx-glass-blur', '--zx-glass-color-strength', '--zx-color-glass-border',
    '--zx-color-glass-surface', '--zx-color-glass-chrome', '--zx-color-glass-control', '--zx-color-overlay-surface',
    '--zx-color-overlay-panel', '--zx-color-overlay-backdrop', '--zx-color-overlay-border',
    '--zx-color-overlay-hover', '--zx-color-overlay-selected', '--zx-color-overlay-divider',
    '--zx-color-overlay-scrim', '--zx-color-app-icon-depth',
    '--zx-app-icon-core-strength', '--zx-app-icon-rim-strength', '--zx-app-icon-bloom-strength',
    '--zx-app-icon-specular-strength', '--zx-app-icon-rim-base', '--zx-app-icon-halo-size',
    '--zx-app-icon-halo-strength', '--zx-app-icon-shadow',
    '--zx-glass-filter-icon', '--zx-glass-filter-control', '--zx-glass-filter-raised',
    '--zx-glass-filter-chrome', '--zx-glass-filter-overlay', '--zx-glass-filter-panel',
    '--zx-glass-control-shadow', '--zx-glass-chrome-shadow', '--zx-glass-raised-shadow',
    '--zx-glass-overlay-shadow', '--zx-glass-panel-shadow'
  ]) {
    assert.ok(Object.hasOwn(flat, name), `flat is missing ${name}`);
    assert.ok(Object.hasOwn(deep, name), `deep glass is missing ${name}`);
    assert.notEqual(flat[name], deep[name], `${name} does not distinguish the modes`);
  }
  assert.equal(flat['--zx-glass-filter-overlay'], 'none');
  assert.equal(flat['--zx-overlay-toast-image'], 'none');
  assert.equal(flat['--zx-color-overlay-surface'], 'var(--zx-color-bg-raised)');
  assert.equal(flat['--zx-color-overlay-panel'], 'var(--zx-color-bg-raised)');
  assert.match(deep['--zx-color-overlay-surface'], /62%/);
  assert.match(deep['--zx-color-overlay-panel'], /68%/);
  assert.match(deep['--zx-color-overlay-backdrop'], /18%/);
  assert.equal(deep['--zx-glass-filter-overlay'], 'blur(22px) saturate(165%)');
  assert.equal(deep['--zx-glass-filter-panel'], 'blur(20px) saturate(152%)');
});

test('persistent application chrome consumes the shared material role', () => {
  for (const path of [
    'app-sidebar/app-sidebar.css', 'app-rail/app-rail.css',
    'master-panel/master-panel.css', 'navigation-bar/navigation-bar.css', 'panel/panel.css'
  ]) {
    const css = componentCss(path);
    assert.match(css, /var\(--zx-color-glass-chrome\)/, `${path} does not use persistent chrome`);
    assert.match(css, /prefers-reduced-transparency: reduce/, `${path} has no opaque fallback`);
  }
});

test('every transient overlay consumes a shared material tier with an opaque fallback', () => {
  for (const path of [
    'dropdown/dropdown.css', 'select/select.css', 'tag-picker/tag-picker.css',
    'tooltip/tooltip.css', 'table/table.css', 'datebox/datebox.css',
    'datebox/date-range-box.css', 'date-picker/date-picker.css'
  ]) {
    const css = componentCss(path);
    assert.match(css, /var\(--zx-color-overlay-surface\)/, `${path} does not use the floating overlay tier`);
    assert.match(css, /var\(--zx-overlay-surface-image\)/, `${path} has no material reflection layer`);
    assert.match(css, /prefers-reduced-transparency: reduce/, `${path} has no opaque fallback`);
  }

  for (const path of ['modal/modal.css', 'launcher/launcher.css']) {
    const css = componentCss(path);
    assert.match(css, /var\(--zx-color-overlay-panel\)/, `${path} does not use the reading-panel tier`);
    assert.match(css, /var\(--zx-overlay-panel-image\)/, `${path} has no reading-panel reflection layer`);
    assert.match(css, /var\(--zx-glass-panel-shadow\)/, `${path} has no reading-panel shadow`);
    assert.match(css, /prefers-reduced-transparency: reduce/, `${path} has no opaque fallback`);
  }

  const sheet = componentCss('sheet/sheet.css');
  assert.match(sheet, /\.zx-sheet\[data-docked\][\s\S]*background: var\(--zx-color-bg-raised\)/,
    'a docked Sheet did not return to an opaque layout surface');
  assert.match(sheet, /\.zx-sheet\[data-docked\][\s\S]*backdrop-filter: none/,
    'a docked Sheet retained overlay backdrop filtering');

  const select = componentCss('select/select.css');
  assert.match(select, /\.zx-select__group[\s\S]*var\(--zx-color-overlay-scrim\)/,
    'Select sticky group repeats the full overlay surface');
  const message = componentCss('message/message.css');
  assert.match(message, /var\(--zx-overlay-toast-image\)/,
    'Message does not use the status-aware overlay material');
  assert.match(message, /@supports \(\(backdrop-filter:[\s\S]*-webkit-backdrop-filter/,
    'Message glass ignores prefixed backdrop-filter support');
});

test('overlay tokens include accessibility and unsupported-filter fallbacks at the shared seam', () => {
  const css = readFileSync(
    fileURLToPath(new URL('../../styles/tokens/semantic.css', import.meta.url)), 'utf8'
  );
  assert.match(css, /--zx-overlay-surface-image:\s*linear-gradient/);
  assert.match(css, /--zx-overlay-panel-image:\s*radial-gradient/);
  assert.match(css, /@supports not \(\(backdrop-filter:[\s\S]*-webkit-backdrop-filter/);
  assert.match(css, /@media \(forced-colors: active\)[\s\S]*--zx-glass-filter-overlay: none !important/);
  assert.match(css, /@media \(forced-colors: active\)[\s\S]*--zx-glass-filter-panel: none !important/);

  const scopeRoots = String.raw`:root,\s*\.zx-scope,\s*\[data-zx-theme\],\s*\[data-zx-density\],\s*\[data-zx-preset\]`;
  for (const fallback of [
    String.raw`@media \(prefers-reduced-transparency: reduce\), \(prefers-contrast: more\)`,
    String.raw`@media \(forced-colors: active\)`,
    String.raw`@supports not \(\(backdrop-filter:`
  ]) {
    assert.match(css, new RegExp(`${fallback}[\\s\\S]*?${scopeRoots}\\s*\\{`),
      `${fallback} does not cover every overlay theme-scope root`);
  }
});

test('documentation search uses the same compact overlay material as library popovers', () => {
  const css = readFileSync(
    fileURLToPath(new URL('../../website/docs.css', import.meta.url)), 'utf8'
  );
  const block = /\.docs-global-search__popover\s*\{([\s\S]*?)\}/.exec(css)?.[1] ?? '';
  assert.match(block, /background-color:\s*var\(--zx-color-overlay-surface\)/);
  assert.match(block, /background-image:\s*var\(--zx-overlay-surface-image\)/);
  assert.match(block, /box-shadow:\s*var\(--zx-glass-overlay-shadow\)/);
  assert.match(css, /\.docs-global-search__result:hover\s*\{[\s\S]*var\(--zx-color-overlay-hover\)/);
  assert.match(css, /\.docs-global-search__result\[data-active="true"\]\s*\{[\s\S]*var\(--zx-color-overlay-selected\)/);
});
