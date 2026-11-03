import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test, { after, before } from 'node:test';

import { MATERIAL_RECIPES } from '../../website/theme-presets.js';
import { LIGHT_DARK, NO_LIGHT_DARK, presetMapping, singleMapping } from './theme-tokens.js';

/*
 * Colour overrides compose with nested regions (WP49). An application declares a colour role once,
 * on `:root`, and every light, dark, auto, and nested theme region reads it; a theme studio material
 * applies inside a nested region exactly as it does on a page of that theme. Checked as a browser
 * paints it, in Chrome through `playwright-core`, and skipped where no Chrome is installed, like the
 * smoke suites (`npm run test:browser`) and the geometry check beside this file.
 *
 * The same stylesheets with the `light-dark()` support check made false are the fallback older
 * browsers read; the last tests hold it to painting what the single mapping paints.
 */

const STYLES = ['global.css', 'themes.css', 'semantic.css', 'dark.css']
  .map((name) => readFileSync(fileURLToPath(new URL(`../../styles/tokens/${name}`, import.meta.url)), 'utf8'))
  .join('\n');
const FALLBACK_STYLES = STYLES
  .replaceAll(LIGHT_DARK, '@supports (color: no-such-function(#000))')
  .replaceAll(NO_LIGHT_DARK, '@supports not (color: no-such-function(#000))');
const ROLES = [...singleMapping().keys()];

/** @type {import('playwright-core').Browser | undefined} */
let browser;
let unavailable = '';

before(async () => {
  let chromium;
  try {
    ({ chromium } = await import('playwright-core'));
  } catch {
    unavailable = 'playwright-core is not installed';
    return;
  }
  try {
    browser = await chromium.launch({ channel: 'chrome' });
  } catch {
    unavailable = 'Google Chrome is not installed';
  }
});

after(async () => {
  await browser?.close();
});

/**
 * @typedef {object} Scene
 * @property {string} [styles] The token stylesheets.
 * @property {string} [css] Application CSS loaded after them.
 * @property {string} [root] Attributes on `<html>`.
 * @property {string} body Markup; regions carry ids.
 * @property {'light'|'dark'} [system] The operating system's colour preference.
 * @property {Array<{name: string, value: string}>} [features] Further media features to emulate.
 */

/**
 * Renders a scene and reads every role, as painted, at each id in it.
 * @param {import('node:test').TestContext} t
 * @param {Scene} scene
 * @returns {Promise<Record<string, Record<string, string>> | null>} Null when the test was skipped.
 */
async function paint(t, scene) {
  if (!browser) {
    t.skip(unavailable);
    return null;
  }
  const context = await browser.newContext({ colorScheme: scene.system ?? 'light' });
  try {
    const page = await context.newPage();
    if (scene.features?.length) {
      const cdp = await context.newCDPSession(page);
      await cdp.send('Emulation.setEmulatedMedia', { features: scene.features });
    }
    await page.setContent(`<!doctype html><html ${scene.root ?? ''}><head><style>${scene.styles ?? STYLES}</style>`
      + `<style>${scene.css ?? ''}</style></head><body id="body">${scene.body}</body></html>`);
    return await page.evaluate((roles) => {
      const result = {};
      for (const host of [document.documentElement, ...document.querySelectorAll('[id]')]) {
        const probe = document.createElement('i');
        host.append(probe);
        const values = { 'color-scheme': getComputedStyle(host).colorScheme };
        for (const role of roles) {
          const property = /shadow$|focus-ring$/.test(role) ? 'box-shadow'
            : /-image$/.test(role) ? 'background-image'
              : /filter-/.test(role) ? 'backdrop-filter' : 'color';
          probe.removeAttribute('style');
          probe.style.setProperty(property, `var(${role})`);
          values[role] = getComputedStyle(probe).getPropertyValue(property);
        }
        probe.remove();
        result[host === document.documentElement ? 'html' : host.id] = values;
      }
      return result;
    }, [...ROLES, '--zx-glass-filter-overlay', '--zx-glass-filter-panel']);
  } finally {
    await context.close();
  }
}

/**
 * A shadow list without its transparent layers, which paint nothing: the single mapping lists both
 * themes' layers and leaves the other theme's transparent.
 * @param {string} value
 * @returns {string}
 */
function painted(value) {
  if (!/\dpx/.test(value) || /gradient\(/.test(value)) return value;
  const layers = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index <= value.length; index += 1) {
    const char = value[index];
    if (char === '(') depth += 1;
    else if (char === ')') depth -= 1;
    else if ((char === ',' && depth === 0) || index === value.length) {
      layers.push(value.slice(start, index).trim());
      start = index + 1;
    }
  }
  const visible = layers.filter((layer) => !/^(?:rgba\(\d+, \d+, \d+, 0\)|color\([^)]*\/ 0\))/.test(layer));
  return visible.join(', ') || 'none';
}

/** Overrides an application might write: a plain colour, a pair, a pane ingredient, and a shadow. */
const OVERRIDES = `:root {
  --zx-color-bg-surface: rgb(1 2 3);
  --zx-color-text: light-dark(rgb(10 20 30), rgb(200 210 220));
  --zx-color-glass-shade: light-dark(rgb(4 5 6 / 50%), rgb(7 8 9 / 50%));
  --zx-surface-shadow: 0 0 0 3px rgb(11 12 13);
}`;

/** What the overrides paint in each polarity. */
const EXPECTED = {
  light: { text: 'rgb(10, 20, 30)', shade: 'rgba(4, 5, 6, 0.5)', hover: 'color(srgb 0.0392157 0.0784314 0.117647 / 0.045)' },
  dark: { text: 'rgb(200, 210, 220)', shade: 'rgba(7, 8, 9, 0.5)', hover: 'color(srgb 0.784314 0.823529 0.862745 / 0.05)' }
};

/**
 * @param {Record<string, string>} region
 * @param {'light'|'dark'} polarity
 * @param {string} where
 */
function assertOverridden(region, polarity, where) {
  const expected = EXPECTED[polarity];
  assert.equal(region['color-scheme'], polarity, `${where} is not ${polarity}`);
  assert.equal(region['--zx-color-bg-surface'], 'rgb(1, 2, 3)', `${where} lost the plain override`);
  assert.equal(region['--zx-color-text'], expected.text, `${where} read the wrong half of the pair`);
  // A derived role follows the override it is derived from, in the region's own polarity.
  assert.equal(region['--zx-color-bg-hover'], expected.hover, `${where}: hover does not follow the text override`);
  assert.ok(region['--zx-overlay-surface-image'].includes(expected.shade), `${where}: the overlay image lost the shade override`);
  assert.equal(region['--zx-surface-shadow'], 'rgb(11, 12, 13) 0px 0px 0px 3px', `${where} lost the shadow override`);
}

test('a :root colour override reaches nested regions of either polarity', async (t) => {
  for (const page of /** @type {const} */ (['light', 'dark'])) {
    const other = page === 'light' ? 'dark' : 'light';
    const regions = await paint(t, {
      css: OVERRIDES,
      root: `data-zx-theme="${page}"`,
      body: `<div id="same" data-zx-theme="${page}"></div>
        <div id="other" data-zx-theme="${other}"><div id="back" data-zx-theme="${page}"></div></div>`
    });
    if (!regions) return;
    assertOverridden(regions.html, page, `a ${page} page`);
    assertOverridden(regions.same, page, `a nested ${page} region on a ${page} page`);
    assertOverridden(regions.other, other, `a nested ${other} region on a ${page} page`);
    assertOverridden(regions.back, page, `a ${page} region inside that`);
  }
});

test('auto follows the system, and an override reaches into it and through it', async (t) => {
  for (const system of /** @type {const} */ (['light', 'dark'])) {
    const regions = await paint(t, {
      css: OVERRIDES,
      root: 'data-zx-theme="auto"',
      system,
      body: `<div id="dark" data-zx-theme="dark"><div id="auto" data-zx-theme="auto"></div></div>
        <div id="light" data-zx-theme="light"></div>`
    });
    if (!regions) return;
    assertOverridden(regions.html, system, `an auto page on a ${system} system`);
    assertOverridden(regions.light, 'light', `a light region in an auto page on a ${system} system`);
    assertOverridden(regions.dark, 'dark', `a dark region in an auto page on a ${system} system`);
    // As before: auto turns dark with the system, and otherwise keeps what surrounds it.
    assertOverridden(regions.auto, 'dark', `an auto region inside a dark one on a ${system} system`);
  }
});

test('a theme studio material applies in a nested region exactly as on a page of that theme', async (t) => {
  const roles = [
    '--zx-color-glass-surface', '--zx-color-glass-chrome', '--zx-color-glass-control', '--zx-color-overlay-surface',
    '--zx-color-overlay-panel', '--zx-color-overlay-backdrop', '--zx-color-overlay-selected', '--zx-overlay-surface-image',
    '--zx-overlay-panel-image', '--zx-glass-raised-shadow', '--zx-glass-overlay-shadow', '--zx-glass-panel-shadow',
    '--zx-glass-filter-overlay', '--zx-glass-filter-panel'
  ];
  for (const [id, recipe] of Object.entries(MATERIAL_RECIPES)) {
    if (!Object.keys(recipe).length) continue;
    // Written to :root, as the studio's export and the documentation site write it.
    const css = `:root { ${Object.entries(recipe).map(([name, value]) => `${name}: ${value};`).join(' ')} }`;
    const pages = {};
    for (const theme of ['light', 'dark']) {
      pages[theme] = await paint(t, { css, root: `data-zx-theme="${theme}"`, body: '' });
      if (!pages[theme]) return;
    }
    const nested = await paint(t, {
      css,
      root: 'data-zx-theme="light"',
      body: '<div id="dark" data-zx-theme="dark"><div id="light" data-zx-theme="light"></div></div>'
    });
    for (const role of roles) {
      assert.equal(nested.dark[role], pages.dark.html[role], `${id}: ${role} in a nested dark region`);
      assert.equal(nested.light[role], pages.light.html[role], `${id}: ${role} in a light region nested in that`);
    }
  }
});

test('a nested preset rethemes the accent roles, with or without a theme attribute', async (t) => {
  const accentRoles = [...presetMapping().keys()];
  const reference = {};
  for (const theme of ['light', 'dark']) {
    reference[theme] = (await paint(t, { root: `data-zx-theme="${theme}" data-zx-preset="rose"`, body: '' }))?.html;
    if (!reference[theme]) return;
  }
  const regions = await paint(t, {
    root: 'data-zx-theme="light"',
    body: `<div id="preset" data-zx-preset="rose"></div>
      <div id="both" data-zx-theme="dark" data-zx-preset="rose"></div>
      <div id="dark" data-zx-theme="dark"><div id="inner" data-zx-preset="rose"></div></div>`
  });
  for (const role of accentRoles) {
    assert.equal(regions.preset[role], reference.light[role], `${role} in a nested preset region`);
    assert.equal(regions.both[role], reference.dark[role], `${role} in a nested dark preset region`);
    assert.equal(regions.inner[role], reference.dark[role], `${role} in a preset region inside a dark one`);
  }
  assert.notEqual(regions.preset['--zx-color-accent'], regions.html['--zx-color-accent'], 'the preset changed nothing');
});

test('reduced transparency, increased contrast, and forced colours win in a nested region', async (t) => {
  const css = ':root { --zx-color-overlay-surface: rgb(1 2 3 / 40%); --zx-glass-filter-overlay: blur(3px); }';
  const body = '<div id="dark" data-zx-theme="dark"></div>';
  for (const features of [
    [{ name: 'prefers-reduced-transparency', value: 'reduce' }],
    [{ name: 'prefers-contrast', value: 'more' }]
  ]) {
    const regions = await paint(t, { css, root: 'data-zx-theme="light"', body, features });
    if (!regions) return;
    for (const where of ['html', 'dark']) {
      assert.equal(regions[where]['--zx-color-overlay-surface'], regions[where]['--zx-color-bg-raised'],
        `${features[0].name}: the ${where} overlay is not the opaque raised surface`);
      assert.equal(regions[where]['--zx-glass-filter-overlay'], 'none', `${features[0].name}: the ${where} overlay still filters`);
    }
  }
  const forced = await paint(t, { css, root: 'data-zx-theme="light"', body, features: [{ name: 'forced-colors', value: 'active' }] });
  for (const where of ['html', 'dark']) {
    assert.doesNotMatch(forced[where]['--zx-color-overlay-surface'], /^rgba\(1, 2, 3/, `forced colours: the ${where} overlay kept the override`);
    assert.equal(forced[where]['--zx-glass-filter-overlay'], 'none', `forced colours: the ${where} overlay still filters`);
  }
});

test('the fallback is really read where light-dark() is unsupported', async (t) => {
  const single = await paint(t, { root: 'data-zx-theme="dark"', body: '' });
  const fallback = await paint(t, { styles: FALLBACK_STYLES, root: 'data-zx-theme="dark"', body: '' });
  if (!single || !fallback) return;
  assert.equal(single.html['--zx-color-text'], fallback.html['--zx-color-text']);
  // Without the support check, a nested region ignores a :root override again — the gap this
  // mapping closes, and proof that the per-theme blocks rather than the single mapping were read.
  const nested = await paint(t, {
    styles: FALLBACK_STYLES, css: OVERRIDES, root: 'data-zx-theme="light"', body: '<div id="dark" data-zx-theme="dark"></div>'
  });
  assert.notEqual(nested.dark['--zx-color-bg-surface'], 'rgb(1, 2, 3)');
});

test('the fallback paints every role the single mapping paints, in every theme and nesting', async (t) => {
  // One region is left out on purpose: an auto region inside a dark one on a light system. Both
  // paths keep it dark, but the fallback restates the light formulas of the derived roles there
  // (a 4.5% hover over dark text), where the single mapping paints the whole dark theme.
  const scenes = [
    { root: 'data-zx-theme="light"', body: '<div id="dark" data-zx-theme="dark"><div id="light" data-zx-theme="light"></div></div>' },
    { root: 'data-zx-theme="dark" data-zx-preset="ocean"', body: '<div id="light" data-zx-theme="light"></div>' },
    { root: 'data-zx-theme="auto"', system: 'light', body: '<div id="dark" data-zx-theme="dark"></div>' },
    { root: 'data-zx-theme="auto" data-zx-preset="folio"', system: 'dark', body: '<div id="light" data-zx-theme="light"><div id="auto" data-zx-theme="auto"></div></div>' },
    { root: '', body: '<div id="both" data-zx-theme="dark" data-zx-preset="rose"></div>' }
  ];
  for (const scene of scenes) {
    const single = await paint(t, scene);
    const fallback = await paint(t, { ...scene, styles: FALLBACK_STYLES });
    if (!single || !fallback) return;
    for (const [where, values] of Object.entries(single)) {
      for (const [role, value] of Object.entries(values)) {
        assert.equal(painted(fallback[where][role]), painted(value),
          `${role} at ${where} (${scene.root || 'no attribute'}, ${scene.system ?? 'light'} system)`);
      }
    }
  }
});
