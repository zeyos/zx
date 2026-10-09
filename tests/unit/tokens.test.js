import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

/*
 * The token contract WP40 added: the role names components and layouts consume, the tier-1 ramps
 * behind them, the type tokens, and the base typography and quiet-field rules in `styles/base.css`.
 * Contrast is checked against the resolved values in `theme-presets.test.js`; this file holds the
 * names and the structure in place, so a rename or a dark list that drifts from its auto twin fails
 * here with a readable message.
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
// The light theme is its base block plus the derived colours restated on every theme element.
const light = new Map([
  ...block(css('styles/tokens/semantic.css'), /:root,\s*\[data-zx-theme="light"\]/),
  ...block(css('styles/tokens/semantic.css'), /:root,\s*\[data-zx-theme\]/)
]);
const darkCss = css('styles/tokens/dark.css');
const dark = block(darkCss, /\[data-zx-theme="dark"\]/);
const auto = block(darkCss, /@media \(prefers-color-scheme: dark\)\s*\{\s*\[data-zx-theme="auto"\]/);

const TONES = ['blue', 'teal', 'green', 'amber', 'orange', 'red', 'pink', 'violet', 'slate'];

/** The tier-2 colour roles WP40 introduced. */
const ROLES = [
  '--zx-color-bg-current', '--zx-color-bg-chrome', '--zx-color-border-subtle', '--zx-color-text-subtle',
  '--zx-color-accent-solid', '--zx-color-accent-solid-hover', '--zx-color-accent-solid-active',
  '--zx-color-on-accent-solid',
  ...TONES.flatMap((tone) => [`--zx-color-tone-${tone}-bg`, `--zx-color-tone-${tone}-fg`]),
  ...Array.from({ length: 8 }, (_, index) => `--zx-color-chart-${index + 1}`)
];

/** Roles that read another theme-dependent role, and so must be restated by the dark theme. */
const THEMED = ROLES.filter((role) => !/^--zx-color-chart-/.test(role));

test('every new colour role is defined for light, and restated for dark and auto', () => {
  for (const role of ROLES) assert.ok(light.has(role), `${role} is missing from the light theme`);
  for (const role of THEMED) {
    assert.ok(dark.has(role), `${role} is missing from the dark theme`);
    assert.ok(auto.has(role), `${role} is missing from the auto theme`);
  }
});

test('the dark and auto lists are the same list', () => {
  // CSS cannot share one declaration block across a media boundary, so dark.css states the dark
  // mapping twice. Any drift means `auto` renders a different theme from `dark` on a dark OS.
  assert.deepEqual([...auto], [...dark]);
});

test('the chart series are one list for both themes', () => {
  // The 500 tone stops clear 3:1 on the light and the dark surface alike; a dark override would
  // be a second ordering to keep CVD-safe.
  for (let index = 1; index <= 8; index += 1) {
    assert.ok(!dark.has(`--zx-color-chart-${index}`), `--zx-color-chart-${index} is overridden in dark`);
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

test('the type scale has a document-title step, weights, and tracking', () => {
  assert.equal(global.get('--zx-text-3xl'), '30px');
  assert.equal(global.get('--zx-weight-medium'), '500');
  assert.equal(global.get('--zx-weight-semibold'), '600');
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

test('colours derived from other theme colours are restated on every theme element', () => {
  // A custom property resolves where it is declared; one declared on :root alone reaches a nested
  // `[data-zx-theme="dark"]` region as a finished light value.
  const semantic = css('styles/tokens/semantic.css');
  const base = block(semantic, /:root,\s*\[data-zx-theme="light"\]/);
  const everyTheme = block(semantic, /:root,\s*\[data-zx-theme\]/);
  const derived = /var\(\s*--zx-(?:color|glass|overlay|app-icon|message)-/;
  for (const [name, value] of base) {
    assert.ok(!derived.test(value), `${name} reads another theme colour but is declared on :root only`);
  }
  assert.ok(everyTheme.has('--zx-color-overlay-surface') && everyTheme.has('--zx-focus-ring'));
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
  assert.ok(dark.has('--zx-drag-shadow'), '--zx-drag-shadow is missing from the dark theme');
  assert.equal(auto.get('--zx-drag-shadow'), dark.get('--zx-drag-shadow'));
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
