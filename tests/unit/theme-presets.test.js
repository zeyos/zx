import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import {
  CUSTOM_FONT, DEFAULTS, FONTS, MATERIALS, MATERIAL_RECIPES, MONO_FONTS, PRESETS, RANGES, SETTING_FIELDS, STOPS, THEME_FORMAT, TINTS,
  accentRamp, cleanFontStack, contrast, neutralRamp, presetById, readThemeJson, themeCss, themeJson,
  themeTokens, themeVars, tintRamp, toHex, toOklch
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

/** @param {string} relative Path from this test. @returns {string} */
function read(relative) {
  return readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');
}

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

/* ------------------------------------------------------------ token resolver -- */

/*
 * The contrast checks below read the stylesheets an application loads rather than a copy of their
 * values: the tier-1 palette, a preset, the light mapping, and — for dark — the dark mapping on
 * top, exactly as they cascade onto `<html data-zx-theme="dark" data-zx-preset="…">`. Values are
 * resolved through `var()` and `color-mix(in srgb, …)` the way CSS Color 5 defines the mix
 * (premultiplied alpha), and a translucent role is composited over the surface it sits on.
 */

/** @param {string} name @returns {string} A token stylesheet with its comments removed. */
function tokenCss(name) {
  const css = readFileSync(fileURLToPath(new URL(`../../styles/tokens/${name}`, import.meta.url)), 'utf8');
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

/** @param {string} css @param {RegExp} selector @returns {Map<string, string>} */
function declarationsOf(css, selector) {
  const body = new RegExp(`${selector.source}\\s*\\{([^}]*)\\}`).exec(css)?.[1];
  assert.ok(body, `no block for ${selector.source}`);
  return new Map([...body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map(([, name, value]) => [name, value.trim()]));
}

const TIER_ONE = declarationsOf(tokenCss('global.css'), /:root/);
// The light theme is its base block plus the derived colours restated on every theme element.
const LIGHT = new Map([
  ...declarationsOf(tokenCss('semantic.css'), /:root,\s*\[data-zx-theme="light"\]/),
  ...declarationsOf(tokenCss('semantic.css'), /:root,\s*\[data-zx-theme\]/)
]);
const DARK = declarationsOf(tokenCss('dark.css'), /\[data-zx-theme="dark"\]/);

/**
 * Every custom property in effect for one theme and preset.
 * @param {'light'|'dark'} theme
 * @param {string} [preset]
 * @returns {Map<string, string>}
 */
function tokensFor(theme, preset = 'zx') {
  const ramp = Object.entries(presetById(preset).ramp).map(([stop, hex]) => [`--zx-accent-${stop}`, hex]);
  return new Map([...TIER_ONE, ...ramp, ...LIGHT, ...(theme === 'dark' ? DARK : [])]);
}

/** @typedef {{r: number, g: number, b: number, a: number}} Rgba Channels 0–255, alpha 0–1. */

/** @param {string} text @returns {string[]} Top-level comma-separated arguments. */
function splitArgs(text) {
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === '(') depth += 1;
    else if (text[index] === ')') depth -= 1;
    else if (text[index] === ',' && depth === 0) {
      parts.push(text.slice(start, index).trim());
      start = index + 1;
    }
  }
  parts.push(text.slice(start).trim());
  return parts;
}

/**
 * Resolves a colour value.
 * @param {string} value
 * @param {Map<string, string>} tokens
 * @returns {Rgba}
 */
function resolve(value, tokens) {
  const text = value.trim();
  const reference = /^var\((--[\w-]+)\)$/.exec(text);
  if (reference) {
    assert.ok(tokens.has(reference[1]), `${reference[1]} is not defined`);
    return resolve(tokens.get(reference[1]), tokens);
  }
  if (text === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
  if (/^#[\da-f]{6}$/i.test(text)) {
    const [r, g, b] = [1, 3, 5].map((offset) => parseInt(text.slice(offset, offset + 2), 16));
    return { r, g, b, a: 1 };
  }
  const mix = /^color-mix\(in srgb,(.*)\)$/s.exec(text);
  assert.ok(mix, `cannot resolve "${text}"`);
  const [one, two] = splitArgs(mix[1]).map((part) => {
    const match = /^(.*?)(?:\s+([\d.]+)%)?$/s.exec(part);
    return { colour: resolve(match[1], tokens), weight: match[2] === undefined ? null : Number(match[2]) / 100 };
  });
  const p1 = one.weight ?? (two.weight === null ? 0.5 : 1 - two.weight);
  const p2 = two.weight ?? 1 - p1;
  const scale = p1 + p2;
  const alpha = (one.colour.a * p1 + two.colour.a * p2) / scale;
  const channel = (key) => alpha === 0 ? 0
    : (one.colour[key] * one.colour.a * p1 + two.colour[key] * two.colour.a * p2) / scale / alpha;
  return { r: channel('r'), g: channel('g'), b: channel('b'), a: alpha * Math.min(1, scale) };
}

/** @param {Rgba} top @param {Rgba} bottom An opaque colour. @returns {Rgba} */
function over(top, bottom) {
  const blend = (key) => top[key] * top.a + bottom[key] * (1 - top.a);
  return { r: blend('r'), g: blend('g'), b: blend('b'), a: 1 };
}

/** @param {Rgba} colour @returns {string} The `#rrggbb` the browser paints. */
function hex(colour) {
  return '#' + ['r', 'g', 'b'].map((key) => Math.round(colour[key]).toString(16).padStart(2, '0')).join('');
}

/**
 * A role as painted: resolved and, when translucent, composited over a background.
 * @param {Map<string, string>} tokens
 * @param {string} role Token name.
 * @param {string} [on] The role it sits on, itself painted over the page.
 * @returns {string}
 */
function paint(tokens, role, on) {
  const page = resolve(tokens.get('--zx-color-bg-page'), tokens);
  const base = on ? over(resolve(tokens.get(on), tokens), page) : page;
  return hex(over(resolve(tokens.get(role), tokens), base));
}

/** The dark steps accent text has to read on, painted from the shipped stylesheet. */
const DARK_STEPS = Object.fromEntries(['page', 'chrome', 'surface', 'raised'].map((step) =>
  [step, paint(tokensFor('dark'), `--zx-color-bg-${step}`)]).concat([
  ['overlay', paint(tokensFor('dark'), '--zx-color-overlay-base')]
]));

/** @param {string} one @param {string} two @returns {number} OKLab distance × 100. */
function deltaE(one, two) {
  const lab = (colour) => {
    const { l, c, h } = toOklch(colour);
    return [l, c * Math.cos((h * Math.PI) / 180), c * Math.sin((h * Math.PI) / 180)];
  };
  const [a, b] = [lab(one), lab(two)];
  return 100 * Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

/* ------------------------------------------------------------------- presets -- */

test('the default preset is the ramp the palette already defines', () => {
  // `zx` restates the emerald ramp from tokens/global.css, so anything setting
  // `data-zx-preset="zx"` explicitly gets exactly the stock theme rather than a near-miss of it.
  for (const stop of STOPS) {
    assert.ok(TIER_ONE.has(`--zx-emerald-${stop}`), `--zx-emerald-${stop} is missing from the palette`);
    assert.equal(presetById('zx').ramp[stop], TIER_ONE.get(`--zx-emerald-${stop}`));
    assert.equal(TIER_ONE.get(`--zx-accent-${stop}`), `var(--zx-emerald-${stop})`,
      `the default accent ${stop} does not read the emerald ramp`);
  }
});

/**
 * The promise every accent ramp keeps, shipped or derived: the 600 stop carries white ink (the
 * primary button in both themes, accent text on light), and the 400 stop carries the near-black
 * ink of a dark-theme accent fill and reads as text on every dark surface step.
 * @param {Record<number, string>} ramp
 * @param {string} name For the failure message.
 */
function assertRampPromise(ramp, name) {
  assert.ok(contrast(ramp[600], '#ffffff') >= 4.5, `${name}: the 600 stop fails AA against white`);
  assert.ok(contrast(ramp[400], '#09090b') >= 4.5, `${name}: the 400 stop fails AA under dark ink`);
  for (const [step, background] of Object.entries(DARK_STEPS)) {
    assert.ok(contrast(ramp[400], background) >= 4.5,
      `${name}: the 400 stop fails AA as text on the dark ${step} (${background})`);
  }
}

test('every shipped preset keeps its accent legible in both themes', () => {
  for (const preset of PRESETS) assertRampPromise(preset.ramp, preset.id);
});

test('a derived ramp holds the same contrast promise for any hue', () => {
  for (let hue = 0; hue < 360; hue += 15) {
    // Full chroma is the worst case: the gamut fit only ever reduces it, and a less saturated
    // colour at the same lightness has more contrast, not less.
    assertRampPromise(accentRamp(toHex({ l: 0.7, c: 0.37, h: hue })), `hue ${hue}`);
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
    assertRampPromise(accentRamp(picked), picked);
  }
});

test('a neutral tint stays neutral at the ends of the ramp', () => {
  const cool = TINTS.find((tint) => tint.id === 'cool');
  const ramp = neutralRamp(cool, '#21cc75');
  assert.ok(toOklch(ramp['--zx-gray-50']).c < 0.006, 'the lightest stop picked up visible colour');
  assert.ok(toOklch(ramp['--zx-gray-500']).c > 0.02, 'the mid stop picked up no colour at all');
  assert.equal(Object.keys(ramp).length, 12);
});

test('every tint keeps the text roles legible in both themes, even at full strength', () => {
  const strongest = RANGES.tintStrength.max;
  for (const tint of TINTS) {
    for (const theme of ['light', 'dark']) {
      const ramp = tintRamp({ ...DEFAULTS, tint: tint.id, tintStrength: strongest });
      const tokens = new Map([...tokensFor(theme), ...Object.entries(ramp)]);
      const name = `${tint.id} at ${strongest}% in ${theme}`;
      for (const surface of ['page', 'chrome', 'surface', 'raised']) {
        const background = paint(tokens, `--zx-color-bg-${surface}`);
        atLeast(contrast(paint(tokens, '--zx-color-text'), background), 7, `${name}: text on ${surface}`);
        atLeast(contrast(paint(tokens, '--zx-color-text-muted'), background), 4.5, `${name}: muted text on ${surface}`);
      }
      for (const surface of ['page', 'chrome', 'surface']) {
        atLeast(contrast(paint(tokens, '--zx-color-text-subtle'), paint(tokens, `--zx-color-bg-${surface}`)), 3,
          `${name}: subtle text on ${surface}`);
      }
    }
  }
});

test('tints are distinct, and their strength scales the colour without moving the greys', () => {
  assert.equal(new Set(TINTS.map((tint) => tint.id)).size, TINTS.length, 'two tints share an id');
  assert.ok(TINTS.length >= 10, 'the tint list shrank');
  assert.ok(TINTS.some((tint) => tint.id === DEFAULTS.tint), 'the default tint is not offered');

  const neutral = tintRamp({ ...DEFAULTS, tint: 'neutral' });
  for (const hex of Object.values(neutral)) assert.ok(toOklch(hex).c < 0.002, `neutral ${hex} has colour`);

  const mid = (strength) => toOklch(tintRamp({ ...DEFAULTS, tint: 'mist', tintStrength: strength })['--zx-gray-500']);
  assert.ok(mid(0).c < 0.002, 'no strength still tints');
  assert.ok(mid(200).c > mid(100).c * 1.6, 'double strength is not about twice the colour');
  assert.ok(Math.abs(mid(200).l - mid(0).l) < 0.01, 'strength moved the grey\'s lightness');

  // Zinc at its own strength is the stock palette, so it needs no override; any other strength does.
  assert.deepEqual(themeVars({ ...DEFAULTS, tintStrength: 100 }), {});
  assert.ok(Object.hasOwn(themeVars({ ...DEFAULTS, tintStrength: 150 }), '--zx-gray-500'));
});

test('every typeface and code font produces its own stack, and only off the default', () => {
  assert.equal(new Set(FONTS.map((font) => font.id)).size, FONTS.length, 'two typefaces share an id');
  assert.ok(FONTS.length >= 10, 'the typeface list shrank');
  assert.ok(!FONTS.some((font) => font.id === CUSTOM_FONT), 'the custom id collides with a stack');
  const stacks = new Set();
  for (const font of FONTS) {
    const vars = themeVars({ ...DEFAULTS, font: font.id });
    if (font.id === DEFAULTS.font) {
      assert.ok(!Object.hasOwn(vars, '--zx-font-sans'), 'the default typeface is exported');
      continue;
    }
    assert.equal(vars['--zx-font-sans'], font.stack);
    assert.match(font.stack, /(sans-serif|serif|monospace)$/, `${font.id} has no generic fallback`);
    stacks.add(font.stack);
  }
  assert.equal(stacks.size, FONTS.length - 1, 'two typefaces share a stack');

  // The stock code stack is the one tokens/global.css already declares.
  const stock = TIER_ONE.get('--zx-font-mono').replace(/\s+/g, ' ');
  assert.equal(MONO_FONTS.find((font) => font.id === DEFAULTS.monoFont).stack, stock);
  for (const font of MONO_FONTS) {
    const vars = themeVars({ ...DEFAULTS, monoFont: font.id });
    if (font.id === DEFAULTS.monoFont) assert.deepEqual(vars, {});
    else assert.deepEqual(vars, { '--zx-font-mono': font.stack });
    assert.match(font.stack, /monospace$/, `${font.id} has no monospace fallback`);
  }
});

test('a custom font stack is normalised into valid CSS, or not used at all', () => {
  assert.equal(cleanFontStack("'Brand Sans', Helvetica  Neue, SANS-SERIF"), '"Brand Sans", "Helvetica Neue", sans-serif');
  assert.equal(cleanFontStack('system-ui, ui-rounded'), 'system-ui, ui-rounded');
  assert.equal(cleanFontStack('Söhne, , monospace'), '"Söhne", monospace');
  for (const bad of ['a;b', 'x} body{color:red', 'Foo"bar', 'url(evil)', '\\41', 'a'.repeat(201), 42, null]) {
    assert.equal(cleanFontStack(bad), '', `${JSON.stringify(bad)} was accepted`);
  }

  const vars = themeVars({ ...DEFAULTS, font: CUSTOM_FONT, fontStack: 'Brand Sans, sans-serif' });
  assert.equal(vars['--zx-font-sans'], '"Brand Sans", sans-serif');
  // Half-typed or unusable, the page falls back to the stock typeface rather than to nothing.
  assert.deepEqual(themeVars({ ...DEFAULTS, font: CUSTOM_FONT, fontStack: 'Brand;' }), {});
  assert.deepEqual(themeVars({ ...DEFAULTS, font: CUSTOM_FONT, fontStack: '' }), {});
});

/* ---------------------------------------------------------------- theme files -- */

/** A state that moves every setting off its default. */
const EVERYTHING = {
  ...DEFAULTS, preset: 'violet', accent: '#e11d48', tint: 'sage', tintStrength: 140,
  font: CUSTOM_FONT, fontStack: '"Brand Sans", sans-serif', monoFont: 'editor', textSize: 15,
  spacing: 4.5, radius: 7, controlHeight: 34, glass: 'strong'
};

test('a theme file round-trips every setting', () => {
  const text = themeJson(EVERYTHING);
  const file = JSON.parse(text);
  assert.equal(file.format, THEME_FORMAT);
  assert.equal(file.version, 1);
  assert.deepEqual(Object.keys(file.settings), SETTING_FIELDS);
  assert.ok(!('theme' in file.settings), 'appearance is exported as part of the theme');
  assert.deepEqual(file.tokens, themeVars(EVERYTHING));

  const { settings, warnings } = readThemeJson(text);
  assert.deepEqual(warnings, []);
  for (const field of SETTING_FIELDS) assert.deepEqual(settings[field], EVERYTHING[field], field);

  // Reading back the stock theme gives the stock theme.
  const stock = readThemeJson(themeJson({ ...DEFAULTS, theme: 'dark' }));
  assert.deepEqual(stock.warnings, []);
  assert.ok(!('theme' in stock.settings));
  for (const field of SETTING_FIELDS) assert.deepEqual(stock.settings[field], DEFAULTS[field], field);
});

test('a theme file lists the preset ramp among its tokens, and only the stack it renders', () => {
  const ocean = JSON.parse(themeJson({ ...DEFAULTS, preset: 'ocean' }));
  assert.equal(ocean.tokens['--zx-accent-600'], presetById('ocean').ramp[600]);
  assert.deepEqual(ocean.tokens, themeTokens({ ...DEFAULTS, preset: 'ocean' }));

  const plain = JSON.parse(themeJson({ ...DEFAULTS, fontStack: 'Left over' }));
  assert.ok(!('fontStack' in plain.settings), 'a stack that is not in use was exported');
  const broken = JSON.parse(themeJson({ ...DEFAULTS, font: CUSTOM_FONT, fontStack: 'Brand;' }));
  assert.equal(broken.settings.font, DEFAULTS.font, 'an unusable custom stack was exported as custom');
});

test('a bare settings object is a theme file too', () => {
  const { settings, warnings } = readThemeJson('{"accent": "#E1D", "radius": 6}');
  assert.deepEqual(warnings, []);
  assert.equal(settings.accent, '#ee11dd');
  assert.equal(settings.radius, 6);
  assert.equal(settings.preset, DEFAULTS.preset, 'a missing setting did not take the stock value');
  assert.equal(settings.font, DEFAULTS.font);
});

test('a theme file with bad values loads, and says what it changed', () => {
  const { settings, warnings } = readThemeJson(JSON.stringify({
    format: THEME_FORMAT,
    version: 3,
    settings: {
      preset: 'neon', accent: 'red', tint: 'mauve', radius: 40, spacing: '4', textSize: 13.4,
      font: CUSTOM_FONT, fontStack: '}; body { display: none', glass: 'strong', sparkle: true
    }
  }));
  assert.equal(settings.preset, DEFAULTS.preset);
  assert.equal(settings.accent, null);
  assert.equal(settings.tint, 'mauve');
  assert.equal(settings.radius, RANGES.radius.max);
  assert.equal(settings.spacing, DEFAULTS.spacing);
  assert.equal(settings.textSize, 13, 'a value off the step was not snapped');
  assert.equal(settings.font, DEFAULTS.font);
  assert.equal(settings.glass, 'strong');
  const text = warnings.join('\n');
  for (const expected of [/newer theme studio/, /preset "neon"/, /accent "red"/, /corner radius 40/,
    /spacing unit "4"/, /font stack/, /no usable font stack/, /unknown settings: sparkle/]) {
    assert.match(text, expected);
  }
  assert.doesNotMatch(text, /text size/, 'snapping to the step is reported as a problem');
});

test('something that is not a theme file is refused with a reason', () => {
  assert.throws(() => readThemeJson('{"accent": '), /not valid JSON/);
  assert.throws(() => readThemeJson('[1, 2]'), /JSON object/);
  assert.throws(() => readThemeJson('"zx"'), /JSON object/);
  assert.throws(() => readThemeJson('{"format": "figma-tokens", "accent": "#ffffff"}'), /not a Zx theme file/);
  assert.throws(() => readThemeJson('{"format": "zx-theme", "version": 1}'), /no theme settings/);
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
  const vars = themeVars({ ...DEFAULTS, radius: 6, font: 'serif' });
  assert.deepEqual(Object.keys(vars), ['--zx-radius', '--zx-font-sans']);
  assert.equal(vars['--zx-radius'], '6px');
});

test('spacing is a theme setting exported as the spacing unit', () => {
  assert.equal(DEFAULTS.spacing, 4);
  assert.equal(DEFAULTS.radius, 4);
  assert.equal(DEFAULTS.controlHeight, 30);
  assert.ok(!('density' in DEFAULTS), 'the studio still has a density default');
  assert.deepEqual(RANGES.spacing, { min: 3, max: 6, step: 0.5 });
  assert.deepEqual(RANGES.radius, { min: 0, max: 10, step: 0.5 });

  const vars = themeVars({ ...DEFAULTS, spacing: 3.5 });
  assert.deepEqual(vars, { '--zx-space-unit': '3.5px' });
  const css = themeCss({ ...DEFAULTS, spacing: 3.5, theme: 'dark' });
  assert.match(css, /--zx-space-unit: 3\.5px;/);
  assert.match(css, /data-zx-theme="dark"/);
  assert.doesNotMatch(css, /density/i, 'Copy CSS still talks about density');
});

test('standard recipes carry a spacing unit instead of a density', () => {
  for (const preset of PRESETS) {
    assert.ok(!('density' in preset.recipe), `${preset.label} still carries a density`);
    const { spacing, radius } = preset.recipe;
    assert.ok(Number.isFinite(spacing), `${preset.label} has no spacing unit`);
    for (const [field, value] of Object.entries({ spacing, radius })) {
      const { min, max, step } = RANGES[field];
      assert.ok(value >= min && value <= max, `${preset.label} ${field} is outside the slider`);
      assert.equal(Math.round(value / step) * step, value, `${preset.label} ${field} is off the slider's step`);
    }
  }
  // Compact recipes sit just under the default unit, roomy ones just over it.
  assert.equal(presetById('ocean').recipe.spacing, 3.5);
  assert.equal(presetById('slate').recipe.spacing, 3.5);
  for (const id of ['zeyos', 'violet', 'rose']) assert.equal(presetById(id).recipe.spacing, 4.5);
  assert.deepEqual(presetById('zx').recipe, {
    spacing: DEFAULTS.spacing, tint: DEFAULTS.tint, radius: DEFAULTS.radius,
    controlHeight: DEFAULTS.controlHeight, textSize: DEFAULTS.textSize, font: DEFAULTS.font,
    glass: DEFAULTS.glass
  }, 'the default preset is not the stock theme');
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
    ...DEFAULTS, tint: 'cool', spacing: 4.5, radius: 7, controlHeight: 38, textSize: 16,
    font: 'serif', glass: 'strong'
  });
  assert.equal(vars['--zx-space-unit'], '4.5px');
  assert.equal(vars['--zx-radius'], '7px');
  assert.equal(vars['--zx-control-height'], '38px');
  assert.equal(vars['--zx-text-md'], '16px');
  assert.match(vars['--zx-font-sans'], /Iowan Old Style/);
  assert.equal(vars['--zx-glass-blur'], '18px');
  assert.equal(vars['--zx-glass-color-strength'], '68%');
  assert.ok(Object.hasOwn(vars, '--zx-color-glass-control'), 'material controls did not change');
  assert.ok(Object.hasOwn(vars, '--zx-color-glass-chrome'), 'persistent chrome did not change');
  assert.equal(vars['--zx-glass-filter-overlay'], 'blur(32px) saturate(150%)');
  assert.equal(vars['--zx-color-app-icon-depth'], 'color-mix(in srgb, var(--zx-color-app-icon-shade) 34%, transparent)');
  assert.equal(vars['--zx-app-icon-core-strength'], '46%');
  assert.equal(vars['--zx-app-icon-bloom-strength'], '80%');
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
  assert.match(deep['--zx-color-overlay-surface'], /44%/);
  assert.match(deep['--zx-color-overlay-panel'], /52%/);
  assert.match(deep['--zx-color-overlay-backdrop'], /36%/);
  assert.equal(deep['--zx-glass-filter-overlay'], 'blur(32px) saturate(150%)');
  assert.equal(deep['--zx-glass-filter-panel'], 'blur(36px) saturate(140%)');
  // Thickness is drawn, not merely dialled up: a lit top line, a darker foot, a narrow inner
  // glow — never a luminous bevel — and a grain under the reflection, not over it.
  assert.match(deep['--zx-glass-overlay-shadow'], /inset 0 -2px 0 .*inset 0 0 8px/);
  assert.doesNotMatch(deep['--zx-glass-overlay-shadow'], /inset 0 0 (?:[2-9]\d)px/);
  assert.ok(deep['--zx-overlay-surface-image'].indexOf('var(--zx-glass-grain)') > deep['--zx-overlay-surface-image'].indexOf('112deg'));
});

/*
 * Every material is a complete recipe over the same consumers, so switching never leaves a role
 * on the previous material, and each is composed from the theme's glass ingredients rather than
 * from a lightness of its own, which is what lets one recipe serve light and dark.
 */
const MATERIAL_CONSUMERS = [
  '--zx-color-glass-border', '--zx-color-glass-surface', '--zx-color-glass-chrome',
  '--zx-color-glass-control', '--zx-color-glass-control-hover', '--zx-color-overlay-surface',
  '--zx-color-overlay-panel', '--zx-color-overlay-backdrop', '--zx-color-overlay-border',
  '--zx-overlay-surface-image', '--zx-overlay-toast-image', '--zx-overlay-panel-image',
  '--zx-glass-filter-icon', '--zx-glass-filter-control', '--zx-glass-filter-raised',
  '--zx-glass-filter-chrome', '--zx-glass-filter-overlay', '--zx-glass-filter-panel',
  '--zx-glass-control-shadow', '--zx-glass-chrome-shadow', '--zx-glass-raised-shadow',
  '--zx-glass-overlay-shadow', '--zx-glass-panel-shadow'
];

test('every material other than the stylesheet glass is a complete, theme-neutral recipe', () => {
  assert.deepEqual(MATERIALS.map((material) => material.id),
    ['none', 'subtle', 'strong', 'frost', 'smoke', 'paper', 'satin', 'enamel']);
  assert.deepEqual(MATERIAL_RECIPES.subtle, {}, 'Glass is the stylesheet, not an override');
  for (const material of MATERIALS) {
    assert.ok(material.note, `${material.id} has no note for the studio`);
    if (material.id === 'subtle') continue;
    const recipe = MATERIAL_RECIPES[material.id];
    for (const name of MATERIAL_CONSUMERS) {
      assert.ok(Object.hasOwn(recipe, name), `${material.id} leaves ${name} on the previous material`);
    }
    for (const [name, value] of Object.entries(recipe)) {
      // Theme-neutral: a recipe may name the ink and the ingredients, never a theme's own stop.
      assert.doesNotMatch(value, /--zx-gray-(?!950\b)\d+/, `${material.id} ${name} pins a grey stop`);
      assert.doesNotMatch(value, /#[0-9a-f]{3,8}\b|rgb\(|hsl\(/i, `${material.id} ${name} paints a literal`);
    }
    assert.equal(themeVars({ ...DEFAULTS, glass: material.id })['--zx-glass-filter-overlay'],
      recipe['--zx-glass-filter-overlay']);
  }
  // The opaque materials filter nothing, so they render cheaply and survive every fallback.
  for (const id of ['none', 'paper', 'satin', 'enamel']) {
    for (const name of MATERIAL_CONSUMERS.filter((token) => token.includes('filter'))) {
      assert.equal(MATERIAL_RECIPES[id][name], 'none', `${id} still filters through ${name}`);
    }
  }
  // Glass panes are lit on their edge: the rim and ring come from the theme, never a wash.
  for (const id of ['strong', 'frost', 'smoke']) {
    assert.match(MATERIAL_RECIPES[id]['--zx-glass-overlay-shadow'], /inset 0 1px 0 (?:var\(--zx-color-glass-rim\)|color-mix\(in srgb, var\(--zx-color-glass-rim\))/);
    assert.equal(MATERIAL_RECIPES[id]['--zx-overlay-specular-strength'], '0%');
    // Every translucent pane keeps its body: the shade is a layer of its surface image.
    assert.match(MATERIAL_RECIPES[id]['--zx-overlay-surface-image'], /linear-gradient\(var\(--zx-color-glass-shade\), var\(--zx-color-glass-shade\)\)$/);
  }
  // A translucent tint on its own is no backing: Smoke's body is the tint mixed into a surface.
  assert.match(MATERIAL_RECIPES.smoke['--zx-color-overlay-surface'], /var\(--zx-color-glass-tint\) \d+%, var\(--zx-color-overlay-base\)/);
  // No recipe bakes a status tint into the toast image: the toast composes its own.
  for (const [id, recipe] of Object.entries(MATERIAL_RECIPES)) {
    assert.doesNotMatch(recipe['--zx-overlay-toast-image'] ?? '', /message-kind/, `${id} bakes the toast kind in`);
  }
  // A hover never thins a pane's body: it is a step on the control's own colour.
  for (const id of ['smoke', 'enamel']) {
    assert.match(MATERIAL_RECIPES[id]['--zx-color-glass-control-hover'], /var\(--zx-color-glass-control\)\)$/, `${id} hover discards the control body`);
  }
  // The capability fallback precedes the preference fallbacks, so a preference wins where both apply.
  const semanticCss = read('../../styles/tokens/semantic.css');
  assert.ok(semanticCss.indexOf('@supports not ((backdrop-filter') < semanticCss.indexOf('@media (prefers-reduced-transparency'),
    'the no-backdrop-filter block must come before the preference blocks');
  // Resting cards keep a resting shadow on the opaque materials; only panes float.
  for (const id of ['none', 'paper', 'satin', 'enamel']) {
    assert.doesNotMatch(MATERIAL_RECIPES[id]['--zx-glass-raised-shadow'], /overlay-shadow/, `${id} lifts a card to overlay elevation`);
    assert.equal(MATERIAL_RECIPES[id]['--zx-color-glass-chrome'], 'var(--zx-color-bg-surface)', `${id} moves the chrome tone`);
  }
});

test('the stylesheet declares the glass ingredients for both themes', () => {
  const semantic = read('../../styles/tokens/semantic.css');
  const dark = read('../../styles/tokens/dark.css');
  for (const name of ['rim', 'ring', 'lift', 'shade', 'edge', 'tint']) {
    assert.match(semantic, new RegExp(`--zx-color-glass-${name}:`), `semantic.css lacks the ${name}`);
    assert.equal((dark.match(new RegExp(`--zx-color-glass-${name}:`, 'g')) ?? []).length, 2,
      `dark.css must restate the ${name} on the dark and the auto block`);
  }
  assert.match(semantic, /--zx-glass-grain: url\("data:image\/svg\+xml[^"]*color-interpolation-filters='sRGB'/);
  // The shade is the pane's body in both themes, and the toast image carries no status tint.
  assert.match(semantic, /--zx-color-glass-shade: color-mix\(in srgb, var\(--zx-gray-0\) \d+%, transparent\);/);
  assert.match(semantic, /--zx-overlay-toast-image: var\(--zx-overlay-surface-image\);/);
  assert.match(read('../../src/components/message/message.css'), /radial-gradient\([^;]*var\(--zx-message-kind\)[^;]*var\(--zx-overlay-toast-image\)/);
  // Without backdrop filtering every glass role is opaque, cards and chrome included.
  const unsupported = /@supports not \(\(backdrop-filter[\s\S]*?\n\}/.exec(semantic)?.[0] ?? '';
  for (const name of ['--zx-color-glass-surface', '--zx-color-glass-chrome', '--zx-color-glass-control', '--zx-glass-filter-raised', '--zx-glass-filter-chrome']) {
    assert.match(unsupported, new RegExp(`${name}: [^;]+ !important;`), `${name} stays translucent without backdrop-filter`);
  }
  // The pane's light is on its edge, not a wash on its face.
  assert.match(semantic, /--zx-glass-overlay-shadow: inset 0 1px 0 var\(--zx-color-glass-rim\), inset 0 0 0 1px var\(--zx-color-glass-ring\), 0 0 0 1px var\(--zx-color-glass-edge\)/);
  assert.doesNotMatch(semantic, /--zx-overlay-surface-image: linear-gradient\(145deg/, 'the corner wash is back');
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
  // Both tiers are lit from the top edge (the lift) with an accent caustic at the far corner.
  assert.match(css, /--zx-overlay-surface-image:\s*linear-gradient\(180deg, var\(--zx-color-glass-lift\)/);
  assert.match(css, /--zx-overlay-panel-image:\s*linear-gradient\(180deg, var\(--zx-color-glass-lift\)[\s\S]*?radial-gradient\([^;]*var\(--zx-color-accent\)/);
  assert.match(css, /@supports not \(\(backdrop-filter:[\s\S]*-webkit-backdrop-filter/);
  assert.match(css, /@media \(forced-colors: active\)[\s\S]*--zx-glass-filter-overlay: none !important/);
  assert.match(css, /@media \(forced-colors: active\)[\s\S]*--zx-glass-filter-panel: none !important/);

  const scopeRoots = String.raw`:root,\s*\.zx-scope,\s*\[data-zx-theme\],\s*\[data-zx-preset\]`;
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
  // The active result is where the keyboard is, not a pick: the same neutral step as hover.
  assert.match(css, /\.docs-global-search__result\[data-active="true"\]\s*\{[^}]*var\(--zx-color-overlay-hover\)/);
});

/* ------------------------------------------------------------ semantic roles -- */

/*
 * The roles WP40 added — chrome, current, subtle border and text, the tone palette, the chart
 * series, the solid accent — and the retuned status green, checked as painted in both themes and
 * under every preset. Neutral roles do not depend on the preset; checking them under all six
 * costs nothing and catches a preset that ever starts touching them.
 */

const THEMES = /** @type {const} */ (['light', 'dark']);
const TONES = ['blue', 'teal', 'green', 'amber', 'orange', 'red', 'pink', 'violet', 'slate'];
const CHART = Array.from({ length: 8 }, (_, index) => `--zx-color-chart-${index + 1}`);

/** Every theme × preset pairing, with its resolved tokens. */
const SCOPES = THEMES.flatMap((theme) => PRESETS.map((preset) =>
  ({ theme, preset: preset.id, tokens: tokensFor(theme, preset.id), name: `${theme}/${preset.id}` })));

/** @param {string} colour @returns {number} OKLab lightness. */
const lightness = (colour) => toOklch(colour).l;

/**
 * @param {number} actual
 * @param {number} minimum
 * @param {string} message
 */
function atLeast(actual, minimum, message) {
  assert.ok(actual >= minimum, `${message}: ${actual.toFixed(2)} < ${minimum}`);
}

test('text, muted, and subtle text read on every surface tone and on a current row', () => {
  for (const { tokens, name } of SCOPES) {
    for (const surface of ['page', 'chrome', 'surface', 'raised']) {
      const background = paint(tokens, `--zx-color-bg-${surface}`);
      atLeast(contrast(paint(tokens, '--zx-color-text'), background), 7, `${name} text on ${surface}`);
      atLeast(contrast(paint(tokens, '--zx-color-text-muted'), background), 4.5, `${name} muted text on ${surface}`);
    }
    for (const surface of ['page', 'chrome', 'surface']) {
      atLeast(contrast(paint(tokens, '--zx-color-text-subtle'), paint(tokens, `--zx-color-bg-${surface}`)), 3,
        `${name} subtle text on ${surface}`);
    }
    // A current row is translucent text over whatever column it sits in.
    for (const column of ['--zx-color-bg-chrome', '--zx-color-bg-surface']) {
      const row = hex(over(resolve(tokens.get('--zx-color-bg-current'), tokens), resolve(paint(tokens, column), tokens)));
      atLeast(contrast(paint(tokens, '--zx-color-text'), row), 7, `${name} text on a current row in ${column}`);
      atLeast(contrast(paint(tokens, '--zx-color-text-muted'), row), 4.5, `${name} muted text on a current row in ${column}`);
      atLeast(contrast(paint(tokens, '--zx-color-text-subtle'), row), 3, `${name} subtle text on a current row in ${column}`);
    }
  }
});

test('current is a neutral fill a clear step above hover, on the canvas and on the chrome', () => {
  for (const { tokens, name } of SCOPES) {
    for (const column of ['--zx-color-bg-surface', '--zx-color-bg-chrome']) {
      const base = paint(tokens, column);
      const current = paint(tokens, '--zx-color-bg-current', column);
      const hover = paint(tokens, '--zx-color-bg-hover', column);
      atLeast(contrast(hover, base), 1.06, `${name} hover is not visible on ${column}`);
      atLeast(contrast(current, base), contrast(hover, base) + 0.06, `${name} current is not a step above hover on ${column}`);
      assert.ok(toOklch(current).c < 0.012, `${name} current picked up colour on ${column}`);
    }
    // Selected keeps the accent: it is the one row fill with hue.
    assert.ok(toOklch(paint(tokens, '--zx-color-bg-selected')).c > toOklch(paint(tokens, '--zx-color-bg-current')).c,
      `${name} selected is no more colourful than current`);
  }
});

test('the chrome tone is one step from the canvas: below it in light, between page and canvas in dark', () => {
  const light = tokensFor('light');
  const [chrome, surface, page] = ['chrome', 'surface', 'page'].map((step) => paint(light, `--zx-color-bg-${step}`));
  assert.ok(lightness(chrome) < lightness(page) && lightness(page) < lightness(surface), 'light chrome is not the darkest column');
  const step = contrast(chrome, surface);
  assert.ok(step >= 1.06 && step <= 1.15, `light chrome is ${step.toFixed(3)}:1 from the canvas, not one clear step`);

  const dark = tokensFor('dark');
  const ramp = ['page', 'chrome', 'surface', 'raised'].map((name) => paint(dark, `--zx-color-bg-${name}`))
    .concat(paint(dark, '--zx-color-overlay-base'));
  for (let index = 1; index < ramp.length; index += 1) {
    assert.ok(lightness(ramp[index]) > lightness(ramp[index - 1]), `the dark ramp does not ascend at step ${index}: ${ramp}`);
  }
});

test('the dark theme is lifted off black, with softened text and translucent borders', () => {
  const dark = tokensFor('dark');
  atLeast(lightness(paint(dark, '--zx-color-bg-page')), 0.2, 'the dark page is near-black');
  assert.ok(lightness(paint(dark, '--zx-color-bg-surface')) < 0.3, 'the dark surface is no longer dark');
  const text = paint(dark, '--zx-color-text');
  assert.ok(text !== '#ffffff' && lightness(text) < 0.95 && lightness(text) > 0.88, `dark text ${text} is not about 90% white`);
  const muted = lightness(paint(dark, '--zx-color-text-muted'));
  assert.ok(muted > 0.66 && muted < 0.76, `dark muted text sits at L ${muted.toFixed(3)}, not about 62–65% white`);
  for (const role of ['--zx-color-border', '--zx-color-border-subtle']) {
    assert.ok(resolve(dark.get(role), dark).a < 0.11, `${role} is not a translucent hairline in dark`);
  }
});

test('the subtle border is lighter than the border and still draws a line', () => {
  for (const { tokens, name } of SCOPES) {
    const surface = paint(tokens, '--zx-color-bg-surface');
    const subtle = contrast(paint(tokens, '--zx-color-border-subtle', '--zx-color-bg-surface'), surface);
    const border = contrast(paint(tokens, '--zx-color-border', '--zx-color-bg-surface'), surface);
    assert.ok(subtle < border, `${name} the subtle border is not lighter than the border`);
    atLeast(subtle, 1.08, `${name} the subtle border vanishes`);
  }
});

test('every tone is a soft tint with ink at 4.5:1 on it, in both themes', () => {
  for (const { theme, tokens, name } of SCOPES) {
    const surface = paint(tokens, '--zx-color-bg-surface');
    for (const tone of TONES) {
      const fill = paint(tokens, `--zx-color-tone-${tone}-bg`);
      atLeast(contrast(paint(tokens, `--zx-color-tone-${tone}-fg`, `--zx-color-tone-${tone}-bg`), fill), 4.5,
        `${name} ${tone} ink on its fill`);
      // Soft: a tint of the surface, never a slab of colour.
      assert.ok(contrast(fill, surface) < (theme === 'light' ? 1.2 : 1.5), `${name} ${tone} fill is loud`);
      const amount = Number(/(\d+)%/.exec(tokens.get(`--zx-color-tone-${tone}-bg`))?.[1]);
      const [min, max] = theme === 'light' ? [12, 14] : [18, 22];
      assert.ok(amount >= min && amount <= max, `${name} ${tone} fill mixes ${amount}%, outside ${min}–${max}%`);
    }
  }
});

test('tones and chart series come from the tone palette, never the accent or a status ramp', () => {
  for (const map of [LIGHT, DARK]) {
    for (const [role, value] of map) {
      if (!/^--zx-color-(tone|chart)-/.test(role)) continue;
      const references = [...value.matchAll(/var\((--[\w-]+)\)/g)].map((match) => match[1]);
      for (const reference of references) {
        assert.match(reference, /^--zx-(tone-|color-bg-surface$)/, `${role} reads ${reference}`);
      }
    }
  }
});

/**
 * OKLab of a colour as seen with protanopia or deuteranopia (Machado, Oliveira & Fernandes 2009,
 * severity 1), or with normal vision when no kind is given.
 * @param {string} colour
 * @param {'protan'|'deutan'} [kind]
 * @returns {number[]}
 */
function seen(colour, kind) {
  const matrices = {
    protan: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
    deutan: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]]
  };
  const linear = [1, 3, 5].map((offset) => {
    const value = parseInt(colour.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  const [r, g, b] = kind
    ? matrices[kind].map((row) => Math.min(1, Math.max(0, row[0] * linear[0] + row[1] * linear[1] + row[2] * linear[2])))
    : linear;
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s
  ];
}

test('chart series read on both themes, keep neighbours apart, and do not open on the accent', () => {
  for (const { tokens, name } of SCOPES) {
    const series = CHART.map((role) => paint(tokens, role));
    for (const [index, colour] of series.entries()) {
      for (const surface of ['page', 'chrome', 'surface', 'raised']) {
        atLeast(contrast(colour, paint(tokens, `--zx-color-bg-${surface}`)), 3,
          `${name} series ${index + 1} as a mark on ${surface}`);
      }
    }
    for (let index = 1; index < series.length; index += 1) {
      const [a, b] = [series[index - 1], series[index]];
      const distance = (kind) => 100 * Math.hypot(...seen(a, kind).map((value, axis) => value - seen(b, kind)[axis]));
      atLeast(distance(), 15, `${name} series ${index} and ${index + 1} with normal vision`);
      atLeast(Math.min(distance('protan'), distance('deutan')), 8, `${name} series ${index} and ${index + 1} with red-green CVD`);
    }
  }
  for (const theme of THEMES) {
    const tokens = tokensFor(theme);
    atLeast(deltaE(paint(tokens, CHART[0]), paint(tokens, '--zx-color-accent')), 15,
      `${theme}: series 1 is the default accent`);
  }
});

test('success is its own green, apart from the accent, and legible as text', () => {
  for (const { theme, tokens, name } of SCOPES) {
    const success = paint(tokens, '--zx-color-success');
    for (const surface of ['page', 'chrome', 'surface', 'raised']) {
      atLeast(contrast(success, paint(tokens, `--zx-color-bg-${surface}`)), 4.5, `${name} success on ${surface}`);
    }
    atLeast(contrast(success, paint(tokens, '--zx-color-success-bg')), 4.5, `${name} success on its own fill`);
    if (theme === 'light') atLeast(contrast(success, '#ffffff'), 4.5, `${name} success on white`);

    const accent = paint(tokens, '--zx-color-accent');
    atLeast(deltaE(success, accent), 7, `${name} success is too close to the accent (OKLab ΔE)`);
    if (toOklch(accent).c > 0.05) {
      const apart = Math.abs(((toOklch(success).h - toOklch(accent).h + 540) % 360) - 180);
      atLeast(apart, 20, `${name} success shares the accent's hue`);
    }
  }
  // The status green is yellow-green, the brand green is emerald: the ramp itself must stay put.
  for (const stop of [400, 600]) {
    const hue = toOklch(TIER_ONE.get(`--zx-green-${stop}`)).h;
    assert.ok(hue > 115 && hue < 140, `the status green ${stop} sits at hue ${hue.toFixed(0)}, not yellow-green`);
  }
});

test('muted text stays legible on a picked row', () => {
  // A checked table row or chosen option keeps its secondary text muted; the tint must not sink
  // it below 4.5:1 in either theme or under any preset.
  for (const { tokens, name } of SCOPES) {
    const selected = paint(tokens, '--zx-color-bg-selected');
    for (const role of ['--zx-color-text', '--zx-color-text-muted']) {
      atLeast(contrast(paint(tokens, role), selected), 4.5, `${name} ${role} on the selected fill`);
    }
  }
});

test('every status colour is legible as text on the surfaces and on its own fill', () => {
  // Badges, inline messages, field errors, and status text all draw the status colour as ink.
  for (const { tokens, name } of SCOPES) {
    for (const status of ['danger', 'warning', 'success', 'info']) {
      const ink = paint(tokens, `--zx-color-${status}`);
      for (const surface of ['page', 'chrome', 'surface', 'raised']) {
        atLeast(contrast(ink, paint(tokens, `--zx-color-bg-${surface}`)), 4.5, `${name} ${status} on ${surface}`);
      }
      atLeast(contrast(ink, paint(tokens, `--zx-color-${status}-bg`)), 4.5, `${name} ${status} on its own fill`);
    }
  }
});

test('the solid accent carries white ink in both themes; accent text stays on its theme stop', () => {
  for (const { theme, tokens, name } of SCOPES) {
    const ink = paint(tokens, '--zx-color-on-accent-solid');
    assert.equal(ink, '#ffffff', `${name} the primary button ink is not white`);
    for (const role of ['--zx-color-accent-solid', '--zx-color-accent-solid-hover', '--zx-color-accent-solid-active']) {
      atLeast(contrast(ink, paint(tokens, role)), 4.5, `${name} white on ${role}`);
    }
    assert.equal(paint(tokens, '--zx-color-accent-solid'), presetById(name.split('/')[1]).ramp[600],
      `${name} the primary button is not the 600 stop`);
    // An accent fill (checkbox, selected day, solid badge) keeps its own ink.
    atLeast(contrast(paint(tokens, '--zx-color-on-accent'), paint(tokens, '--zx-color-accent')), 4.5,
      `${name} on-accent on the accent`);
    for (const surface of ['page', 'surface']) {
      atLeast(contrast(paint(tokens, '--zx-color-accent'), paint(tokens, `--zx-color-bg-${surface}`)), 4.5,
        `${name} accent text on ${surface}`);
    }
    assert.equal(paint(tokens, '--zx-color-accent'), presetById(name.split('/')[1]).ramp[theme === 'dark' ? 400 : 600],
      `${name} accent text left its stop`);
  }
});
