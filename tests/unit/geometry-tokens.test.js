import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

/*
 * One geometry (AGENTS.md): control sizes, radius, spacing, blur, filters, durations, easings and
 * the type scale are settings an application overrides once on `:root`. A custom property declared
 * on an element shadows the inherited value, so a non-colour token restated on a theme block
 * (`[data-zx-theme="light"]`) would quietly reset that override inside every nested light region
 * while a dark region kept it. Theme and preset blocks therefore carry colours only.
 */

const tokenDir = new URL('../../styles/tokens/', import.meta.url);
const TOKEN_FILES = readdirSync(fileURLToPath(tokenDir)).filter((name) => name.endsWith('.css'));

/** @param {string} name @returns {string} The token stylesheet without comments. */
function tokenCss(name) {
  return readFileSync(fileURLToPath(new URL(name, tokenDir)), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
}

/**
 * @typedef {object} Rule
 * @property {string} selector
 * @property {string[]} atRules The enclosing at-rule preludes, outermost first.
 * @property {Array<[string, string]>} declarations Custom properties declared directly in the rule.
 */

/**
 * A brace-aware walk over a stylesheet: every style rule with the at-rules around it.
 * @param {string} css Comment-free CSS.
 * @returns {Rule[]}
 */
function rules(css) {
  /** @type {Rule[]} */
  const found = [];
  /** @type {Array<{prelude: string, rule: Rule | null}>} */
  const stack = [];
  let start = 0;
  for (let index = 0; index < css.length; index += 1) {
    const char = css[index];
    if (char === '{') {
      const prelude = css.slice(start, index).replace(/^[\s\S]*[;}]/, '').trim();
      const atRule = prelude.startsWith('@');
      const rule = atRule ? null : {
        selector: prelude,
        atRules: stack.map((entry) => entry.prelude).filter((text) => text.startsWith('@')),
        declarations: []
      };
      if (rule) found.push(rule);
      stack.push({ prelude, rule });
      start = index + 1;
    } else if (char === '}') {
      const entry = stack.pop();
      if (entry?.rule) {
        const body = css.slice(start, index);
        entry.rule.declarations.push(...[...`${body};`.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)]
          .map(([, name, value]) => /** @type {[string, string]} */ ([name, value.trim()])));
      }
      start = index + 1;
    }
  }
  return found;
}

/*
 * Blocks whose overrides apply equally to every theme — a user preference or a missing capability
 * forcing filters off — are not theme blocks in the sense that matters here: they set the same
 * value on `:root` and on every scope, so they cannot make one theme's geometry differ from
 * another's.
 */
const PREFERENCE_AT_RULE = /prefers-reduced-transparency|prefers-contrast|forced-colors|prefers-reduced-motion|^@supports/;
/** A rule that targets a theme or preset scope. */
const THEMED_SELECTOR = /\[data-zx-(?:theme|preset)\b/;
/** Names that are geometry or material whatever their value looks like. */
const GEOMETRY_NAME =
  /^--zx-(?:control-|space-|radius|text-|weight-|tracking-|font-|dur-|ease)|blur|filter|strength|saturation|-size\b/;
/** Colour roles by name: colours, shadows (painted), gradients, the focus ring. */
const COLOUR_NAME = /^--zx-(?:color-|[\w-]*shadow$|[\w-]*-image$|focus-ring$|header-(?:bg|text)$|app-icon-rim-base$)/;
/** A value that paints: a palette or colour reference, a colour function, or a literal. */
const COLOUR_VALUE = new RegExp([
  String.raw`var\(--zx-(?:color|gray|accent|emerald|green|red|amber|blue|tone|shadow|module)-`,
  String.raw`\b(?:color-mix|rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(`,
  String.raw`#[\da-f]{3,8}\b`,
  String.raw`\b(?:transparent|currentcolor|Canvas|CanvasText|Highlight|HighlightText|ButtonFace|ButtonText|LinkText|GrayText)\b`
].join('|'), 'i');

/** @param {string} name @param {string} value @returns {boolean} */
function isColourToken(name, value) {
  if (GEOMETRY_NAME.test(name) && !COLOUR_NAME.test(name)) return false;
  return COLOUR_NAME.test(name) || COLOUR_VALUE.test(value);
}

test('no non-colour token is declared inside a theme or preset block', () => {
  const offenders = [];
  let themedRules = 0;
  for (const file of TOKEN_FILES) {
    for (const rule of rules(tokenCss(file))) {
      if (!THEMED_SELECTOR.test(rule.selector)) continue;
      if (rule.atRules.some((prelude) => PREFERENCE_AT_RULE.test(prelude))) continue;
      themedRules += 1;
      for (const [name, value] of rule.declarations) {
        if (!isColourToken(name, value)) offenders.push(`${file}: ${name}: ${value} (in ${rule.selector.replace(/\s+/g, ' ')})`);
      }
    }
  }
  assert.ok(themedRules >= 4, `expected the light, every-theme, dark, and auto blocks; found ${themedRules}`);
  assert.deepEqual(offenders, [], 'non-colour tokens belong on :root only:\n' + offenders.join('\n'));
});

test('the geometry and material tokens are declared on :root, never on a theme block', () => {
  const declaredOn = new Map();
  for (const file of TOKEN_FILES) {
    for (const rule of rules(tokenCss(file))) {
      if (rule.atRules.length) continue;
      for (const [name] of rule.declarations) {
        if (!declaredOn.has(name)) declaredOn.set(name, []);
        declaredOn.get(name).push(rule.selector.replace(/\s+/g, ' '));
      }
    }
  }
  for (const name of [
    '--zx-control-height', '--zx-control-pad-x', '--zx-control-radius', '--zx-control-font-size',
    '--zx-control-font-weight', '--zx-overlay-blur', '--zx-glass-blur', '--zx-glass-filter-overlay',
    '--zx-space-unit', '--zx-radius', '--zx-text-md', '--zx-dur-base', '--zx-ease'
  ]) {
    const selectors = declaredOn.get(name) ?? [];
    assert.ok(selectors.includes(':root'), `${name} is not declared on :root`);
    // `[data-zx-motion="reduced"]` zeroing the durations is a setting, not a theme, and stays.
    const themed = selectors.filter((selector) => THEMED_SELECTOR.test(selector));
    assert.deepEqual(themed, [], `${name} is also declared on ${themed.join(' | ')}`);
  }
});

test('the classifier tells colours from geometry', () => {
  assert.equal(isColourToken('--zx-control-height', '30px'), false);
  assert.equal(isColourToken('--zx-glass-filter-icon', 'blur(4px) saturate(118%)'), false);
  assert.equal(isColourToken('--zx-control-radius', 'var(--zx-radius-lg)'), false);
  assert.equal(isColourToken('--zx-color-text', 'var(--zx-gray-950)'), true);
  assert.equal(isColourToken('--zx-overlay-shadow', 'var(--zx-shadow-3)'), true);
  assert.equal(isColourToken('--zx-app-icon-rim-base', 'var(--zx-color-glass-highlight)'), true);
});

/*
 * The same property in a real browser: an application's `:root` override has to reach a nested
 * light region and a nested dark region alike. Skipped where no Chrome is installed, like the
 * smoke suites (`npm run test:browser`).
 */
test('a nested light region keeps an application\'s :root control height', async (t) => {
  let chromium;
  try {
    ({ chromium } = await import('playwright-core'));
  } catch {
    t.skip('playwright-core is not installed');
    return;
  }
  let browser;
  try {
    browser = await chromium.launch({ channel: 'chrome' });
  } catch {
    t.skip('Google Chrome is not installed');
    return;
  }
  try {
    const page = await browser.newPage();
    const styles = ['global.css', 'themes.css', 'semantic.css', 'dark.css']
      .map((name) => readFileSync(fileURLToPath(new URL(name, tokenDir)), 'utf8'))
      .join('\n');
    await page.setContent(`<!doctype html><html><head><style>${styles}</style>
      <style>:root { --zx-control-height: 40px; --zx-space-unit: 5px; --zx-glass-blur: 3px; }</style></head>
      <body>
        <div id="light" data-zx-theme="light"><div id="light-inner"></div></div>
        <div id="dark" data-zx-theme="dark"><div id="dark-light" data-zx-theme="light"></div></div>
        <div id="auto" data-zx-theme="auto" data-zx-preset="ocean"></div>
      </body></html>`);
    const read = (selector) => page.$eval(selector, (element) => {
      const style = getComputedStyle(element);
      return ['--zx-control-height', '--zx-space-unit', '--zx-glass-blur']
        .map((name) => style.getPropertyValue(name).trim());
    });
    for (const selector of ['html', '#light', '#light-inner', '#dark', '#dark-light', '#auto']) {
      assert.deepEqual(await read(selector), ['40px', '5px', '3px'], `${selector} lost the :root geometry`);
    }
  } finally {
    await browser.close();
  }
});
