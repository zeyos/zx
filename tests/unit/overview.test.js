import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

/** @param {string} path @returns {string} */
const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

/**
 * The selectors of every top-level rule, at-rules opened rather than counted as selectors.
 * @param {string} css
 * @returns {string[]}
 */
function selectors(css) {
  const found = [];
  const source = css.replace(/\/\*[\s\S]*?\*\//g, '');
  let depth = 0;
  let start = 0;
  const stack = [];
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (char === '{') {
      const prelude = source.slice(start, index).trim();
      const atRule = prelude.startsWith('@');
      if (!atRule && !stack.includes('rule') && !stack.some((entry) => entry === 'keyframes')) {
        for (const part of prelude.split(/,(?![^(]*\))/)) found.push(part.trim());
      }
      stack.push(atRule ? (prelude.startsWith('@keyframes') ? 'keyframes' : 'at') : 'rule');
      depth += 1;
      start = index + 1;
    } else if (char === '}') {
      stack.pop();
      depth -= 1;
      start = index + 1;
    } else if (char === ';' && stack.at(-1) !== 'rule') {
      start = index + 1;
    }
  }
  return found.filter(Boolean);
}

test('the overview stylesheet is scoped to its block', () => {
  const css = read('website/layouts/overview.css');
  const problems = selectors(css).filter((selector) => !/^\.overview(?:__[\w-]+|(?![\w-]))/.test(selector));
  assert.deepEqual(problems, [], 'every selector sits under .overview or an .overview__ element');
});

test('the gallery and the screenshot harness load the composition after the shell', () => {
  const gallery = read('website/layouts.css');
  assert.ok(gallery.indexOf("layouts/overview.css") > gallery.indexOf("layouts/kit.css"));
  const harness = read('tests/layouts/harness.html');
  assert.ok(harness.indexOf('layouts/overview.css') > harness.indexOf('layouts/kit.css'),
    'the harness that shoots and audits layouts has the composition too');
});

test('the composition documents its options, its API, and its events in its header', () => {
  const source = read('website/layouts/overview.js');
  for (const name of ['OverviewOptions', 'OverviewField', 'OverviewFilterField', 'OverviewGroupAxis', 'OverviewViewContext',
    'OverviewBoardContext', 'OverviewState', 'Overview', 'OverviewEvent']) {
    assert.match(source, new RegExp(`@typedef \\{[^}]+\\} ${name}\\b|@typedef \\{\\{[\\s\\S]*?\\}\\} ${name}\\b`), `${name} is documented`);
  }
  for (const method of ['setData', 'refresh', 'getState', 'setState', 'setView', 'setGroup', 'setFilters', 'openFilters',
    'openViewSettings', 'setBoardAxes', 'on']) {
    assert.match(source, new RegExp(`@property \\{[^\\n]*\\} ${method}(?: |$)`, 'm'), `the API documents ${method}()`);
  }
  assert.match(source, /^export \{[^}]*\bcreateOverview\b[^}]*\};$/m);
});

test('a layout on the composition keeps only its own styles', () => {
  const css = read('website/layouts/record-collection.layout.css');
  for (const moved of ['collection__toolbar', 'collection__filters', 'collection__chip', 'collection__editor', 'collection__drawer',
    'collection__frame', 'collection__body', 'collection__footer']) {
    assert.doesNotMatch(css, new RegExp(`\\.${moved}\\b`), `${moved} moved to the overview`);
  }
  assert.match(css, /\.collection\[data-overview-drawer\] \.collection__main/, 'the screen makes room for an open drawer');
});
