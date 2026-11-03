import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import {
  LIGHT_DARK, NO_LIGHT_DARK, branch, fallbackMapping, presetMapping, rules, schemeTokens, singleMapping, tokenCss
} from './theme-tokens.js';

/*
 * The token contract WP40 added: the role names components and layouts consume, the tier-1 ramps
 * behind them, the type tokens, and the base typography and quiet-field rules in `styles/base.css`.
 * Contrast is checked against the resolved values in `theme-presets.test.js`; this file holds the
 * names and the structure in place, so a rename, a role restated on a theme element, or a fallback
 * list that drifts from the single mapping fails here with a readable message.
 */

/** @param {string} path Repository-relative. @returns {string} The file without comments. */
function css(path) {
  const source = readFileSync(fileURLToPath(new URL(`../../${path}`, import.meta.url)), 'utf8');
  return source.replace(/\/\*[\s\S]*?\*\//g, '');
}

/**
 * Custom properties declared in the first block whose selector matches.
 * @param {string} source
 * @param {RegExp} selector
 * @returns {Map<string, string>}
 */
function block(source, selector) {
  const body = new RegExp(`${selector.source}\\s*\\{([^}]*)\\}`).exec(source)?.[1];
  assert.ok(body, `no block for ${selector.source}`);
  return new Map([...body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map(([, name, value]) => [name, value.trim()]));
}

const global = block(css('styles/tokens/global.css'), /:root/);
// Each theme is one half of the single mapping; the fallback states the same values per theme.
const single = singleMapping();
const light = schemeTokens('light');
const dark = schemeTokens('dark');
const fallback = fallbackMapping();

const TONES = ['blue', 'teal', 'green', 'amber', 'orange', 'red', 'pink', 'violet', 'slate'];

/** The tier-2 colour roles WP40 introduced. */
const ROLES = [
  '--zx-color-bg-current', '--zx-color-bg-chrome', '--zx-color-border-subtle', '--zx-color-text-subtle',
  '--zx-color-accent-solid', '--zx-color-accent-solid-hover', '--zx-color-accent-solid-active',
  '--zx-color-on-accent-solid',
  ...TONES.flatMap((tone) => [`--zx-color-tone-${tone}-bg`, `--zx-color-tone-${tone}-fg`]),
  ...Array.from({ length: 8 }, (_, index) => `--zx-color-chart-${index + 1}`)
];

/** Roles that read another theme-dependent role, and so must be restated by the fallback's dark list. */
const THEMED = ROLES.filter((role) => !/^--zx-color-chart-/.test(role));

test('every new colour role is declared once, and restated by the fallback for dark and auto', () => {
  for (const role of ROLES) assert.ok(single.has(role), `${role} is missing from the single mapping`);
  for (const role of THEMED) {
    assert.ok(fallback.dark.has(role), `${role} is missing from the fallback dark theme`);
    assert.ok(fallback.auto.has(role), `${role} is missing from the fallback auto theme`);
  }
});

test('the fallback\'s dark and auto lists are the same list', () => {
  // CSS cannot share one declaration block across a media boundary, so dark.css states the dark
  // mapping twice. Any drift means `auto` renders a different theme from `dark` on a dark OS.
  assert.deepEqual([...fallback.auto], [...fallback.dark]);
});

test('the chart series are one list for both themes', () => {
  // The 500 tone stops clear 3:1 on the light and the dark surface alike; a dark value would be a
  // second ordering to keep CVD-safe.
  for (let index = 1; index <= 8; index += 1) {
    assert.doesNotMatch(single.get(`--zx-color-chart-${index}`), /light-dark\(/, `--zx-color-chart-${index} differs in dark`);
    assert.ok(!fallback.dark.has(`--zx-color-chart-${index}`), `--zx-color-chart-${index} is overridden in the fallback's dark`);
  }
});

test('the palette defines the brand, status, and tone ramps the roles read', () => {
  for (const stop of [300, 400, 500, 600, 700]) {
    assert.match(global.get(`--zx-emerald-${stop}`) ?? '', /^#[\da-f]{6}$/, `--zx-emerald-${stop}`);
    assert.match(global.get(`--zx-green-${stop}`) ?? '', /^#[\da-f]{6}$/, `--zx-green-${stop}`);
    assert.notEqual(global.get(`--zx-green-${stop}`), global.get(`--zx-emerald-${stop}`),
      `status green ${stop} is the brand green`);
  }
  for (const tone of TONES) {
    for (const stop of [300, 500, 700]) {
      assert.match(global.get(`--zx-tone-${tone}-${stop}`) ?? '', /^#[\da-f]{6}$/, `--zx-tone-${tone}-${stop}`);
    }
  }
  // Success reads the status ramp, never the accent.
  assert.equal(light.get('--zx-color-success'), 'var(--zx-green-600)');
  assert.equal(dark.get('--zx-color-success'), 'var(--zx-green-400)');
});

test('every tone has a solid identity fill the white icon glyph reads on, in both themes', () => {
  // WCAG relative luminance of a six-digit hex colour.
  const luminance = (hex) => {
    const [red, green, blue] = [1, 3, 5].map((offset) => {
      const channel = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
      return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  };
  assert.equal(light.get('--zx-color-app-icon-glyph'), 'var(--zx-gray-0)');
  const glyph = luminance(global.get('--zx-gray-0'));
  for (const tone of TONES) {
    const role = `--zx-color-tone-${tone}-solid`;
    const reference = /^var\((--zx-tone-[\w-]+)\)$/.exec(light.get(role) ?? '')?.[1];
    assert.ok(reference, `${role} must read one tone stop`);
    // A solid is identity, not ink: the same stop on both themes, like the chart series.
    assert.equal(dark.get(role), light.get(role), `${role} differs in dark`);
    assert.ok(!fallback.dark.has(role), `${role} is overridden in the fallback's dark`);
    const fill = luminance(global.get(reference));
    const ratio = (Math.max(glyph, fill) + 0.05) / (Math.min(glyph, fill) + 0.05);
    assert.ok(ratio >= 3, `${role}: the glyph reaches ${ratio.toFixed(2)}:1, below 3:1`);
  }
});

/**
 * Resolves a type step at a given base: the steps are `calc()` expressions over `--zx-text-base`
 * with one subtraction or one multiplication and division, which is all this evaluates.
 * @param {string} name
 * @param {number} base
 * @returns {number} Pixels.
 */
function textStep(name, base) {
  let expression = global.get(name);
  while (/var\(--zx-text-(?!base)/.test(expression)) {
    expression = expression.replace(/var\((--zx-text-[\w-]+)\)/, (_, inner) => global.get(inner));
  }
  const source = expression.replace(/^calc\((.*)\)$/, '$1').replace(/var\(--zx-text-base\)/g, String(base)).replace(/px/g, '');
  assert.match(source, /^[\d\s.*/+-]+$/, `${name} is not a simple expression: ${expression}`);
  return Function(`return (${source});`)();
}

test('the type scale is one base with derived steps, in order at either end of the range', () => {
  assert.equal(global.get('--zx-text-base'), '14px');
  const steps = ['xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl'].map((step) => `--zx-text-${step}`);
  assert.deepEqual(steps.map((step) => textStep(step, 14)), [12, 13, 14, 16, 18, 24, 30]);
  for (const base of [12, 13, 15, 16, 17]) {
    const sizes = steps.map((step) => textStep(step, base));
    for (let index = 1; index < sizes.length; index += 1) {
      assert.ok(sizes[index] > sizes[index - 1], `at ${base}px, ${steps[index]} is not above ${steps[index - 1]}`);
    }
    assert.ok(sizes[0] >= 10, `at ${base}px the smallest step is ${sizes[0]}px`);
  }
});

test('the type scale has a document-title step, weights, and tracking', () => {
  assert.equal(textStep('--zx-text-3xl', 14), 30);
  assert.equal(global.get('--zx-weight-medium'), '500');
  assert.equal(global.get('--zx-weight-semibold'), '600');
  assert.equal(global.get('--zx-weight-title'), '650');
  assert.equal(global.get('--zx-tracking-tight'), '-0.01em');
  assert.equal(global.get('--zx-tracking-title'), '-0.015em');
});

test('the root runs Inter slightly tight, with the single-storey a', () => {
  const root = /\.zx-scope\s*\{([^}]*)\}/.exec(css('styles/base.css'))?.[1] ?? '';
  assert.match(root, /letter-spacing:\s*var\(--zx-tracking-tight\);/);
  assert.match(root, /font-feature-settings:\s*"cv11";/);
});

test('quiet fields drop their chrome until hover or focus, at zero specificity', () => {
  const base = css('styles/base.css');
  const rules = [...base.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter(([, selector]) => selector.includes('[data-zx-fields="quiet"]'))
    .map(([, selector, body]) => ({ selector: selector.trim(), body }));
  assert.equal(rules.length, 3, 'expected a resting, a hover, and a focus rule');
  for (const { selector } of rules) {
    // Everything sits inside :where(), so a component's own input styling still wins.
    assert.match(selector, /^:where\(/, `${selector} carries specificity`);
    assert.doesNotMatch(selector.replace(/:where\((?:[^()]|\((?:[^()]|\([^()]*\))*\))*\)/g, ''), /\S/,
      `${selector} has a selector outside :where()`);
    for (const field of ['input:not(', 'select', 'textarea']) assert.ok(selector.includes(field), `${field} is not quiet`);
  }
  const [rest, hover, focus] = rules;
  assert.match(rest.body, /border-color:\s*transparent;/);
  assert.match(rest.body, /background:\s*transparent;/);
  assert.match(hover.selector, /:hover:not\(:focus, :disabled, \[readonly\]\)/);
  assert.match(hover.body, /background:\s*var\(--zx-color-bg-hover\);/);
  assert.match(focus.selector, /:focus:not\(\[readonly\]\)/);
  assert.match(focus.body, /border-color:\s*var\(--zx-color-border-control\);/);
  assert.match(focus.body, /background:\s*var\(--zx-color-bg-control\);/);
  // The rules follow the native-control defaults they override at equal (zero) specificity.
  assert.ok(base.indexOf('[data-zx-fields="quiet"]') > base.indexOf('border: 1px solid var(--zx-color-border-control)'),
    'the quiet rules come before the defaults they override');
});

test('the fallback restates colours derived from other theme colours on every theme element', () => {
  // Without light-dark() a custom property resolves where it is declared; one declared on :root
  // alone reaches a nested `[data-zx-theme="dark"]` region as a finished light value.
  const derived = /var\(\s*--zx-(?:color|glass|overlay|app-icon|message)-/;
  for (const [name, value] of fallback.light) {
    assert.ok(!derived.test(value), `${name} reads another theme colour but is declared on :root only`);
  }
  assert.ok(fallback.everyTheme.has('--zx-color-overlay-surface') && fallback.everyTheme.has('--zx-focus-ring'));
});

/**
 * A shadow list as painted: layers in order, lengths padded to four, transparent layers dropped,
 * and the palette's `--zx-shadow-*` expanded.
 * @param {string} value
 * @returns {string[]}
 */
function shadowLayers(value) {
  const expanded = value.replace(/var\((--zx-shadow-\d)\)/g, (_, name) => global.get(name));
  const layers = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index <= expanded.length; index += 1) {
    const char = expanded[index];
    if (char === '(') depth += 1;
    else if (char === ')') depth -= 1;
    else if ((char === ',' && depth === 0) || index === expanded.length) {
      layers.push(expanded.slice(start, index).trim());
      start = index + 1;
    }
  }
  return layers.filter((layer) => !/\btransparent$/.test(layer)).map((layer) => {
    const inset = /^inset\b/.test(layer);
    const rest = layer.replace(/^inset\s+/, '');
    const lengths = /^((?:-?[\d.]+(?:px)?\s+){2,4})/.exec(`${rest} `)?.[1].trim().split(/\s+/) ?? [];
    const colour = rest.slice(lengths.join(' ').length).trim();
    while (lengths.length < 4) lengths.push('0');
    return `${inset ? 'inset ' : ''}${lengths.map((length) => length.replace(/^0px$/, '0')).join(' ')} ${colour}`;
  });
}

test('the single mapping and the fallback state the same values', () => {
  // The fallback is only ever read by a browser without light-dark(), so nothing else would notice
  // it drifting. tests/unit/colour-overrides.test.js compares the two as painted; this compares
  // them as written, and runs without a browser.
  const expected = {
    light: new Map([...fallback.light, ...fallback.everyTheme]),
    dark: new Map([...fallback.light, ...fallback.everyTheme, ...fallback.dark])
  };
  assert.deepEqual([...single.keys()].sort(), [...expected.light.keys()].sort(),
    'the single mapping and the fallback declare different roles');
  for (const scheme of /** @type {const} */ (['light', 'dark'])) {
    const tokens = schemeTokens(scheme);
    for (const [name, value] of expected[scheme]) {
      if (/shadow$/.test(name)) {
        assert.deepEqual(shadowLayers(tokens.get(name)), shadowLayers(value), `${name} paints differently in ${scheme}`);
      } else {
        assert.equal(tokens.get(name), value, `${name} differs in ${scheme}`);
      }
    }
  }
});

test('a theme element declares no colour role where light-dark() is supported', () => {
  // Anything declared on a theme element shadows the inherited value, which is how a :root
  // override used to stop at the first nested region. Only `color-scheme` belongs there.
  const themed = [];
  for (const file of ['semantic.css', 'dark.css', 'themes.css', 'global.css', 'modules.css']) {
    for (const rule of rules(tokenCss(file))) {
      if (!/\[data-zx-theme\b/.test(rule.selector) || rule.atRules.includes(NO_LIGHT_DARK)) continue;
      // The capability and preference fallbacks force one value on every scope, whatever the theme.
      if (rule.atRules.some((prelude) => /backdrop-filter|prefers-reduced-transparency|prefers-contrast|forced-colors/.test(prelude))) continue;
      if (rule.declarations.size) themed.push(`${file}: ${rule.selector} declares ${[...rule.declarations.keys()].join(', ')}`);
    }
  }
  assert.deepEqual(themed, []);
  // Each theme element says which half it reads, under the conditions the fallback uses: `auto`
  // turns dark with the system and otherwise keeps what surrounds it.
  const semantic = css('styles/tokens/semantic.css');
  assert.match(semantic, /\n:root,\s*\[data-zx-theme="light"\]\s*\{\s*color-scheme:\s*light;\s*\}/);
  assert.match(semantic, /\n\[data-zx-theme="dark"\]\s*\{\s*color-scheme:\s*dark;\s*\}/);
  assert.match(semantic,
    /\n@media \(prefers-color-scheme: dark\)\s*\{\s*\[data-zx-theme="auto"\]\s*\{\s*color-scheme:\s*dark;\s*\}\s*\}/);
});

test('a preset element restates exactly the roles that read the accent ramp', () => {
  // A preset repoints `--zx-accent-*` on its own element; a role substituted on :root would carry
  // the page's ramp into a nested preset region. The closure is computed from the stylesheet, so a
  // new accent-derived role that is not in the preset block fails here — and so does a role in the
  // block that does not need it, since everything there shadows an application's :root override.
  const reads = (value) => [...value.matchAll(/var\((--[\w-]+)\)/g)].map(([, name]) => name);
  const closure = new Set();
  for (let grew = true; grew;) {
    grew = false;
    for (const [name, value] of single) {
      if (closure.has(name)) continue;
      if (/var\(--zx-accent-/.test(value) || reads(value).some((reference) => closure.has(reference))) {
        closure.add(name);
        grew = true;
      }
    }
  }
  assert.deepEqual([...presetMapping().keys()].sort(), [...closure].sort());
});

test('no colour role is registered with @property', () => {
  // A registered <color> is computed where it is declared — on :root, in light — which would send
  // light values into every dark region again.
  for (const file of ['semantic.css', 'dark.css', 'themes.css', 'global.css', 'modules.css']) {
    assert.doesNotMatch(tokenCss(file), /@property\s+--zx-/, `${file} registers a token`);
  }
});

test('the single mapping sits behind a light-dark() support check, the fallback behind its negation', () => {
  const semantic = css('styles/tokens/semantic.css');
  assert.ok(semantic.includes(`${LIGHT_DARK} {`) && semantic.includes(`${NO_LIGHT_DARK} {`));
  assert.ok(css('styles/tokens/dark.css').trimStart().startsWith(`${NO_LIGHT_DARK} {`),
    'dark.css declares something outside the fallback');
  // The preference fallbacks follow both paths, so they win on either.
  assert.ok(semantic.indexOf(NO_LIGHT_DARK) < semantic.indexOf('@media (prefers-reduced-transparency'));
  assert.equal(branch('light-dark(a, light-dark(b, c))', 'dark'), 'c');
});

/* -------------------------------------------------------------------- motion -- */

/*
 * WP43: named easing, the drag shadow, and motion as a setting. The curves are checked by what
 * they do rather than by their numbers, so a retune that keeps the character passes and one that
 * turns the spring into a bounce or the drawer into a drift does not.
 */

/**
 * A `cubic-bezier()` token as a timing function: progress at a given share of the duration.
 * @param {string} value
 * @returns {{at: (time: number) => number, peak: number}}
 */
function easing(value) {
  const match = /^cubic-bezier\(\s*([\d.-]+)\s*,\s*([\d.-]+)\s*,\s*([\d.-]+)\s*,\s*([\d.-]+)\s*\)$/.exec(value ?? '');
  assert.ok(match, `"${value}" is not a cubic-bezier()`);
  const [x1, y1, x2, y2] = match.slice(1).map(Number);
  const curve = (a, b, t) => 3 * (1 - t) ** 2 * t * a + 3 * (1 - t) * t ** 2 * b + t ** 3;
  let peak = 0;
  for (let step = 0; step <= 1000; step += 1) peak = Math.max(peak, curve(y1, y2, step / 1000));
  return {
    peak,
    at(time) {
      let low = 0;
      let high = 1;
      for (let step = 0; step < 60; step += 1) {
        const middle = (low + high) / 2;
        if (curve(x1, x2, middle) < time) low = middle;
        else high = middle;
      }
      return curve(y1, y2, (low + high) / 2);
    }
  };
}

test('the named curves: a small spring and a decisive drawer beside the standard ease', () => {
  const ease = easing(global.get('--zx-ease'));
  const spring = easing(global.get('--zx-ease-spring'));
  const drawer = easing(global.get('--zx-ease-drawer'));
  // Pops in past its mark and settles back: noticeable, never a bounce.
  assert.ok(spring.peak > 1.01 && spring.peak < 1.08,
    `the spring overshoots by ${((spring.peak - 1) * 100).toFixed(1)}%, not a small overshoot`);
  // A panel covers most of its distance at once and never passes its edge.
  assert.ok(drawer.peak <= 1.0001, 'the drawer curve overshoots');
  assert.ok(drawer.at(0.25) > ease.at(0.25) && drawer.at(0.25) > 0.7,
    `the drawer is ${(drawer.at(0.25) * 100).toFixed(0)}% of the way at a quarter of its time — not decisive`);
});

test('the drag shadow is a tier-2 role in light, dark, and auto', () => {
  assert.ok(light.has('--zx-drag-shadow'), '--zx-drag-shadow is missing from the light theme');
  assert.ok(fallback.dark.has('--zx-drag-shadow'), '--zx-drag-shadow is missing from the fallback dark theme');
  assert.equal(fallback.auto.get('--zx-drag-shadow'), fallback.dark.get('--zx-drag-shadow'));
  // A dark canvas swallows a plain shadow; the dark value has to be its own.
  assert.notEqual(dark.get('--zx-drag-shadow'), light.get('--zx-drag-shadow'));
  // Lifted, not floating: it reads the palette, never another theme colour.
  assert.doesNotMatch(light.get('--zx-drag-shadow'), /var\(--zx-color-/);
});

test('a reduced-motion region, and the system preference, zero every duration token', () => {
  const tokens = css('styles/tokens/global.css');
  const durations = [...global.keys()].filter((name) => name.startsWith('--zx-dur-'));
  assert.ok(durations.length >= 2, 'no duration tokens found');
  const region = block(tokens, /\[data-zx-motion="reduced"\]/);
  const system = block(tokens, /@media \(prefers-reduced-motion: reduce\)\s*\{\s*:root/);
  for (const name of durations) {
    assert.equal(region.get(name), '0ms', `${name} keeps moving inside data-zx-motion="reduced"`);
    assert.equal(system.get(name), '0ms', `${name} keeps moving under prefers-reduced-motion`);
  }
  // There is no way to ask for more motion than the system allows.
  assert.doesNotMatch(tokens + css('styles/base.css'), /data-zx-motion="(?!reduced")/,
    'a data-zx-motion value other than "reduced" is styled');
});

test('the base rule stops animations and transitions inside a reduced region, end states kept', () => {
  const base = css('styles/base.css');
  const rule = [...base.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .find(([, selector]) => selector.includes('[data-zx-motion="reduced"] *'));
  assert.ok(rule, 'no base rule for data-zx-motion="reduced"');
  const [, selector, body] = rule;
  for (const target of ['[data-zx-motion="reduced"],', '*::before', '*::after', '*::backdrop']) {
    assert.ok(selector.includes(target), `the reduced rule does not cover ${target}`);
  }
  // Durations collapse rather than animations being removed, so an animation still lands on its
  // end state and still fires the end event a component may be waiting for.
  assert.match(body, /animation-duration:\s*0\.01ms !important;/);
  assert.match(body, /animation-iteration-count:\s*1 !important;/);
  assert.match(body, /transition-duration:\s*0\.01ms !important;/);
  assert.match(body, /scroll-behavior:\s*auto !important;/);
  assert.doesNotMatch(body, /animation(?:-name)?:\s*none/);
});
