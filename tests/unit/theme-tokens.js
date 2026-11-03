import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/*
 * Reads the colour mapping out of the token stylesheets for the tests that check it. Not a test
 * file itself (`node --test` only runs `*.test.js`).
 *
 * The mapping has two forms. Where `light-dark()` is supported, every colour role is declared once
 * on `:root` — with the roles that read the accent ramp in a second block on `:root,
 * [data-zx-preset]` — and each half of a `light-dark()` pair is one theme's value. Elsewhere the
 * same values sit in today's per-theme blocks, under `@supports not`. The contrast tests read the
 * first form through `schemeTokens()`; the structure and browser tests compare the two.
 */

/** The condition the single mapping sits behind, and its fallback's. */
export const LIGHT_DARK = '@supports (color: light-dark(#000, #fff))';
export const NO_LIGHT_DARK = '@supports not (color: light-dark(#000, #fff))';

/** @param {string} name A file in `styles/tokens/`. @returns {string} The file without comments. */
export function tokenCss(name) {
  const source = readFileSync(fileURLToPath(new URL(`../../styles/tokens/${name}`, import.meta.url)), 'utf8');
  return source.replace(/\/\*[\s\S]*?\*\//g, '');
}

/**
 * @typedef {object} Rule
 * @property {string} selector Whitespace collapsed.
 * @property {string[]} atRules The enclosing at-rule preludes, outermost first.
 * @property {Map<string, string>} declarations Custom properties declared directly in the rule,
 *   values whitespace-collapsed.
 */

/**
 * A brace-aware walk over a stylesheet: every style rule with the at-rules around it.
 * @param {string} css Comment-free CSS.
 * @returns {Rule[]}
 */
export function rules(css) {
  /** @type {Rule[]} */
  const found = [];
  /** @type {Array<{prelude: string, rule: Rule | null}>} */
  const stack = [];
  let start = 0;
  for (let index = 0; index < css.length; index += 1) {
    const char = css[index];
    if (char === '{') {
      const prelude = css.slice(start, index).replace(/^[\s\S]*[;}]/, '').trim().replace(/\s+/g, ' ');
      const rule = prelude.startsWith('@') ? null : {
        selector: prelude,
        atRules: stack.map((entry) => entry.prelude).filter((text) => text.startsWith('@')),
        declarations: new Map()
      };
      if (rule) found.push(rule);
      stack.push({ prelude, rule });
      start = index + 1;
    } else if (char === '}') {
      const entry = stack.pop();
      if (entry?.rule) {
        for (const [, name, value] of `${css.slice(start, index)};`.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
          entry.rule.declarations.set(name, value.trim().replace(/\s+/g, ' '));
        }
      }
      start = index + 1;
    }
  }
  return found;
}

/**
 * The declarations of every rule with this selector under exactly these at-rules, merged in order.
 * @param {string} file
 * @param {string} selector Whitespace-collapsed, as written.
 * @param {string[]} atRules
 * @returns {Map<string, string>}
 */
export function declarations(file, selector, atRules) {
  const matching = rules(tokenCss(file)).filter((rule) => rule.selector === selector
    && rule.atRules.join(' | ') === atRules.join(' | '));
  assert.ok(matching.length, `${file}: no "${selector}" rule under ${atRules.join(' ') || 'no at-rule'}`);
  return new Map(matching.flatMap((rule) => [...rule.declarations]));
}

/** @returns {Map<string, string>} Every colour role as declared once, `light-dark()` pairs intact. */
export function singleMapping() {
  return new Map([
    ...declarations('semantic.css', ':root', [LIGHT_DARK]),
    ...declarations('semantic.css', ':root, [data-zx-preset]', [LIGHT_DARK])
  ]);
}

/** @returns {Map<string, string>} The roles restated on every preset element. */
export function presetMapping() {
  return declarations('semantic.css', ':root, [data-zx-preset]', [LIGHT_DARK]);
}

/**
 * Picks one half of every `light-dark()` in a value, nested ones included.
 * @param {string} value
 * @param {'light'|'dark'} scheme
 * @returns {string}
 */
export function branch(value, scheme) {
  let output = '';
  let index = 0;
  for (;;) {
    const start = value.indexOf('light-dark(', index);
    if (start < 0) return output + value.slice(index);
    let depth = 0;
    let comma = -1;
    let end = -1;
    for (let cursor = start + 'light-dark'.length; cursor < value.length; cursor += 1) {
      const char = value[cursor];
      if (char === '(') depth += 1;
      else if (char === ')' && --depth === 0) {
        end = cursor;
        break;
      } else if (char === ',' && depth === 1 && comma < 0) comma = cursor;
    }
    assert.ok(comma > 0 && end > comma, `malformed light-dark() in "${value}"`);
    const half = scheme === 'light' ? value.slice(start + 'light-dark('.length, comma) : value.slice(comma + 1, end);
    output += value.slice(index, start) + branch(half.trim(), scheme);
    index = end + 1;
  }
}

/**
 * Every colour role as one theme reads it.
 * @param {'light'|'dark'} scheme
 * @returns {Map<string, string>}
 */
export function schemeTokens(scheme) {
  return new Map([...singleMapping()].map(([name, value]) => [name, branch(value, scheme)]));
}

/**
 * The fallback's lists, as the per-theme blocks state them.
 * @returns {{light: Map<string, string>, everyTheme: Map<string, string>, dark: Map<string, string>,
 *   auto: Map<string, string>}}
 */
export function fallbackMapping() {
  return {
    light: declarations('semantic.css', ':root, [data-zx-theme="light"]', [NO_LIGHT_DARK]),
    everyTheme: declarations('semantic.css', ':root, [data-zx-theme]', [NO_LIGHT_DARK]),
    dark: declarations('dark.css', '[data-zx-theme="dark"]', [NO_LIGHT_DARK]),
    auto: declarations('dark.css', '[data-zx-theme="auto"]', [NO_LIGHT_DARK, '@media (prefers-color-scheme: dark)'])
  };
}
