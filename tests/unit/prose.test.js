import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

/*
 * The reading register: `.zx-prose` sets authored content in the reading tokens, at one class of
 * specificity, and loads before the component stylesheets so a component placed in prose keeps its
 * own styles.
 */

const source = readFileSync(new URL('../../styles/prose.css', import.meta.url), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '');
const zx = readFileSync(new URL('../../styles/zx.css', import.meta.url), 'utf8');

/** @param {string} list A selector list. @returns {string[]} Its selectors, split at top-level commas. */
function splitSelectors(list) {
  const parts = [];
  let depth = 0;
  let current = '';
  for (const char of list) {
    if (char === '(') depth += 1;
    if (char === ')') depth -= 1;
    if (char === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
    } else current += char;
  }
  return [...parts, current.trim()];
}

test('prose reads the reading tokens, not the interface ones', () => {
  const root = /\.zx-prose\s*\{([^}]*)\}/.exec(source)?.[1] ?? '';
  assert.match(root, /font-family:\s*var\(--zx-font-prose\)/);
  assert.match(root, /font-size:\s*var\(--zx-prose-size\)/);
  assert.match(root, /line-height:\s*var\(--zx-prose-leading\)/);
  assert.match(root, /max-inline-size:\s*var\(--zx-prose-measure\)/);
});

test('every prose rule is one class plus :where(), so components inside keep their styles', () => {
  const selectors = [...source.matchAll(/([^{}]+)\{[^{}]*\}/g)]
    .flatMap(([, selector]) => splitSelectors(selector))
    .filter((selector) => selector.startsWith('.zx-prose') && !selector.startsWith('.zx-prose['));
  assert.ok(selectors.length > 20, `found only ${selectors.length} prose selectors`);
  for (const selector of selectors) {
    const outside = selector.replace(/:where\((?:[^()]|\([^()]*\))*\)/g, '').replace(/::?marker$/, '');
    assert.match(outside, /^\.zx-prose(\s*>)?\s*(\+\s*)?$/, `${selector} adds specificity outside :where()`);
  }
});

test('prose loads before the component stylesheets', () => {
  const prose = zx.indexOf('./prose.css');
  const firstComponent = zx.indexOf('../src/components/');
  assert.ok(prose > 0 && prose < firstComponent, 'prose.css must be imported ahead of every component');
});

test('a callout is neutral by default, with status kinds and the nine tones', () => {
  const callout = /\.zx-callout\s*\{([^}]*)\}/.exec(source)?.[1] ?? '';
  assert.match(callout, /--zx-callout-bg:\s*var\(--zx-color-bg-muted\)/);
  for (const kind of ['info', 'success', 'warning', 'danger']) {
    assert.match(source, new RegExp(`\\.zx-callout\\[data-kind="${kind}"\\]`));
  }
  for (const tone of ['blue', 'teal', 'green', 'amber', 'orange', 'red', 'pink', 'violet', 'slate']) {
    assert.match(source, new RegExp(`\\[data-tone="${tone}"\\]\\s*\\{[^}]*--zx-color-tone-${tone}-fg`));
  }
});
