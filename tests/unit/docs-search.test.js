import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  normalizeDocsSearchText, rankDocsSearch
} from '../../website/docs-search.js';

test('documentation search folds accents, punctuation, and camelCase symbols', () => {
  assert.equal(normalizeDocsSearchText('Über Grid.BillingItems()'), 'uber grid billing items');
});

test('documentation search requires every query term and ranks meaningful destinations', () => {
  const records = [
    { label: 'Billing guide', description: 'Editable transaction items', href: '#guide' },
    { label: 'Grid.BillingItems()', aliases: ['billing items preset'], href: '#preset' },
    { label: 'Grid', aliases: ['Grid.BillingItems()'], href: '#grid' },
    { label: 'Items', description: 'Generic list', href: '#items' }
  ];
  assert.deepEqual(rankDocsSearch(records, 'billing items').map((item) => item.href),
    ['#preset', '#grid', '#guide']);
});

test('documentation search is stable, limited, and blank-safe', () => {
  const records = Array.from({ length: 12 }, (_, index) => ({
    label: 'Result', href: `#${index}`
  }));
  assert.deepEqual(rankDocsSearch(records, 'result', 3).map((item) => item.href),
    ['#0', '#1', '#2']);
  assert.deepEqual(rankDocsSearch(records, '   '), []);
  assert.deepEqual(rankDocsSearch(records, 'missing'), []);
});

test('both machine indexes keep the requested application-shell components in Layout', () => {
  for (const relative of ['../../website/llms.txt', '../../docs/llms.txt']) {
    const source = readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');
    const groups = [...source.matchAll(/^- ([^:\n]+):([\s\S]*?)(?=^- [^:\n]+:|^## |(?![\s\S]))/gm)]
      .map((match) => ({ name: match[1], body: match[2] }));
    const layout = groups.find((group) => group.name === 'Layout')?.body ?? '';
    for (const component of ['AppSidebar', 'AccountMenu', 'Avatar', 'Launcher', 'InlineLoading', 'skeleton()']) {
      assert.ok(layout.includes(component), `${relative}: ${component} is not in Layout`);
      assert.equal(groups.some((group) => group.name !== 'Layout' && group.body.includes(component)), false,
        `${relative}: ${component} is duplicated outside Layout`);
    }
  }
});

test('public documentation presents the compact builder as a first-class API', () => {
  for (const relative of ['../../website/llms.txt', '../../docs/llms.txt', '../../docs/llms.md']) {
    const source = readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');
    assert.doesNotMatch(source, /migration alias|gx compatibility|carbon|fiori/i, relative);
  }
  const reference = readFileSync(fileURLToPath(new URL('../../docs/llms.md', import.meta.url)), 'utf8');
  assert.match(reference, /Zx's compact DOM builder and public alias/);
});

test('documentation, theme, and landing headers expose their centered search mount', () => {
  const docs = readFileSync(fileURLToPath(new URL('../../website/docs.html', import.meta.url)), 'utf8');
  const theme = readFileSync(fileURLToPath(new URL('../../website/theme.html', import.meta.url)), 'utf8');
  const landing = readFileSync(fileURLToPath(new URL('../../website/index.html', import.meta.url)), 'utf8');
  assert.match(docs, /class="site-docs-search docs-global-search"/);
  assert.match(theme, /class="site-docs-search theme-global-search"/);
  assert.match(landing, /class="site-docs-search site-landing-search"/);
  assert.match(landing, /new Search\(document\.querySelector\('\[data-landing-search-field\]'\)/);
  assert.match(landing, /docs\.html\?q=\$\{encodeURIComponent\(query\)\}/);
  const css = readFileSync(fileURLToPath(new URL('../../website/site.css', import.meta.url)), 'utf8');
  assert.match(css, /\.site-docs-search\s*\{[\s\S]*?inline-size: min\(19rem, 24vw\)/,
    'the centered documentation search must leave room for primary navigation');
  // The threshold has to clear the widest primary nav, not a fixed guess: the centered search
  // cannot be pushed aside, so it must wrap before nearby chrome reaches it. `tools/run-smoke.js`
  // measures the actual overlap; this pins the rule that prevents it.
  assert.match(css, /@media \(max-width: 1400px\)[\s\S]*?\.site-docs-search\s*\{[\s\S]*?flex: 1 0 100%/,
    'the documentation search must move to its own row before header chrome can collide');
  assert.match(css, /@media \(max-width: 1400px\)[\s\S]*?\.site-header__inner:has\(\.site-docs-search\)[\s\S]*?flex-wrap: wrap/,
    'a full-width search row needs a header that wraps, in every shell that mounts one');
});

test('public site keeps Aurora in component docs without publishing study pages', () => {
  for (const file of ['index.html', 'docs.html', 'theme.html']) {
    const source = readFileSync(fileURLToPath(new URL(`../../website/${file}`, import.meta.url)), 'utf8');
    assert.doesNotMatch(source, /href="aurora\.html"/, file);
  }
  const landing = readFileSync(fileURLToPath(new URL('../../website/index.html', import.meta.url)), 'utf8');
  const docs = readFileSync(fileURLToPath(new URL('../../website/docs.html', import.meta.url)), 'utf8');
  assert.match(landing, /href="docs\.html#components\/aurora"/);
  assert.match(docs, /href="#components\/aurora"/);
  for (const file of [
    'aurora.html', 'aurora.js', 'aurora.css', 'aurora-preview.html', 'aurora-preview.css'
  ]) {
    assert.equal(existsSync(fileURLToPath(new URL(`../../website/${file}`, import.meta.url))), false, file);
  }
});

test('landing header transitions from transparent to accessible glass', () => {
  const css = readFileSync(fileURLToPath(new URL('../../website/site.css', import.meta.url)), 'utf8');
  assert.match(css, /\.site-header--overlay\s*\{[\s\S]*?position: fixed;[\s\S]*?background: transparent;/);
  assert.match(css, /\.site-header--overlay\[data-scrolled\]\s*\{[\s\S]*?var\(--zx-glass-filter-chrome\)/);
  assert.match(css, /@media \(prefers-reduced-motion: no-preference\)[\s\S]*?\.site-header--overlay\s*\{[\s\S]*?transition:/);
  assert.match(css, /@media \(prefers-reduced-transparency: reduce\)[\s\S]*?\.site-header--overlay\[data-scrolled\][\s\S]*?backdrop-filter: none;/);
});

test('public pages carry the ZeyOS copyright identity beside their legal links', () => {
  for (const file of ['index.html', 'docs.html', 'theme.html']) {
    const source = readFileSync(fileURLToPath(new URL(`../../website/${file}`, import.meta.url)), 'utf8');
    assert.match(source, /class="site-footer__brand"[\s\S]*?assets\/zeyos-logo-light\.svg/, file);
    assert.match(source, /Copyright © 2012–2026 ZeyOS GmbH &amp; Co\. KG/, file);
    assert.match(source, /All rights reserved\./, file);
    assert.match(source, /class="site-footer__legal"/, file);
  }
});
