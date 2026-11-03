import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { sectionHref } from '../../src/components/prose/prose.js';

/*
 * Section links copy the page's address with the heading's id as its hash. Building that address
 * is pure; the anchors themselves, the copy, and the reveal are exercised in the browser.
 */

test('the section address replaces the hash and keeps the rest', () => {
  assert.equal(sectionHref('https://example.com/docs/page?tab=2', 'install'), 'https://example.com/docs/page?tab=2#install');
  assert.equal(sectionHref('https://example.com/docs/page#old', 'new'), 'https://example.com/docs/page#new');
  assert.equal(sectionHref('http://localhost:8080/layouts.html#wiki', 'release-steps'), 'http://localhost:8080/layouts.html#release-steps');
});

test('an id is encoded as a fragment', () => {
  assert.equal(sectionHref('https://example.com/', 'two words'), 'https://example.com/#two%20words');
  assert.equal(sectionHref('https://example.com/', 'größe'), 'https://example.com/#gr%C3%B6%C3%9Fe');
});

test('the link is revealed through the heading, never hidden with display', () => {
  const css = readFileSync(new URL('../../src/components/prose/prose.css', import.meta.url), 'utf8')
    .replace(/@media print\s*\{[\s\S]*?\}\s*\}/, '');
  assert.doesNotMatch(css, /display:\s*none|visibility:\s*hidden/);
  const source = readFileSync(new URL('../../src/components/prose/prose.js', import.meta.url), 'utf8');
  assert.match(source, /setAttribute\('data-zx-reveal-host', ''\)/);
  assert.match(source, /'data-zx-reveal': ''/);
});

test('the stylesheet is imported with the components', () => {
  const zx = readFileSync(new URL('../../styles/zx.css', import.meta.url), 'utf8');
  assert.match(zx, /@import url\("\.\.\/src\/components\/prose\/prose\.css"\);/);
});
