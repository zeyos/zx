/*
 * The layouts moved out of the documentation application onto a gallery page of their own. These
 * checks keep the pieces of that move together: every page links the gallery, nothing links the
 * retired `docs.html#layouts` addresses, the registry is the one list of layouts, and every layout's
 * styles — templates and screen patterns alike — live with the gallery rather than in the
 * documentation's stylesheet.
 *
 * They also hold the chrome to one geometry: no density switch anywhere, tiles without component
 * chips, corners no larger than `--zx-radius-lg`, and every layout reachable on a page of its own
 * (`layout.html#<id>`) from its tile and from the popup.
 *
 * The behaviour — tiles, thumbnails, the popup, the standalone page, routing, and teardown — needs
 * a browser, and is covered by `tools/run-smoke.js`.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { LAYOUT_IDS } from '../../website/layouts/index.js';

/** @param {string} path Repository-relative path. @returns {string} */
function read(path) {
  return readFileSync(fileURLToPath(new URL(`../../${path}`, import.meta.url)), 'utf8');
}

const PAGES = ['website/index.html', 'website/docs.html', 'website/layouts.html', 'website/theme.html'];

test('every page links the gallery from its header, and nothing links the retired addresses', () => {
  for (const path of PAGES) {
    const nav = /<nav class="site-nav"[\s\S]*?<\/nav>/.exec(read(path))?.[0] ?? '';
    assert.match(nav, /<a href="layouts\.html">Layouts<\/a>/, `${path}: the header does not link layouts.html`);
  }
  for (const path of [...PAGES, 'website/llms.txt', 'website/site.js', 'website/docs.js']) {
    assert.doesNotMatch(read(path), /docs\.html#layouts|href="#layouts/, `${path} links the retired layout address`);
  }
});

test('the gallery page loads its own stylesheet and script, and imports every layout after the shell', () => {
  const page = read('website/layouts.html');
  assert.match(page, /<link rel="stylesheet" href="layouts\.css">/);
  assert.match(page, /<script type="module" src="layouts\.js"><\/script>/);
  assert.match(page, /<script src="site\.js"><\/script>/);

  const imports = [...read('website/layouts.css').matchAll(/^@import url\('([^']+)'\);/gm)].map(([, url]) => url);
  assert.deepEqual(imports, ['layouts/kit.css', ...LAYOUT_IDS.map((id) => `layouts/${id}.layout.css`)]);
});

test('the documentation reads the layouts from the registry and has no layout section', () => {
  const docs = read('website/docs.js');
  assert.match(docs, /^import \{ LAYOUT_IDS \} from '\.\/layouts\/index\.js';$/m);
  assert.doesNotMatch(docs, /const LAYOUT_IDS\s*=/, 'docs.js keeps its own copy of the layout list');
  assert.doesNotMatch(docs, /\['layouts', 'Layouts'\]/, 'docs.js still builds a Layouts sidebar section');
  assert.match(docs, /href: `layouts\.html#\$\{encodeURIComponent\(id\)\}`/, 'layout search results do not point at the gallery');
});

test('the screen patterns are built like the templates, not styled by the documentation', () => {
  const docs = read('website/docs.css');
  // The stylesheet the patterns once shared is gone: each is a shell with its own block stylesheet.
  for (const block of ['layout-frame', 'layout-split', 'stat-card', 'wizard-rail', 'record-header', 'invoice-workspace']) {
    assert.doesNotMatch(docs, new RegExp(`\\.${block}\\b`), `docs.css still styles .${block}`);
  }
  assert.doesNotMatch(read('tests/layouts/harness.html'), /patterns\.css/);
});

/**
 * The gallery's own stylesheet, below the block that imports the layouts' stylesheets.
 * @returns {string}
 */
function galleryChrome() {
  return read('website/layouts.css').replace(/^[\s\S]*@import url\('[^']+'\);\n/, '');
}

/** @param {string} html @returns {string[]} The stylesheets a page links, in order. */
function stylesheets(html) {
  return [...html.matchAll(/<link rel="stylesheet" href="([^"]+)">/g)].map(([, href]) => href);
}

test('nothing in the documentation or gallery chrome switches density', () => {
  for (const path of [
    'website/layouts.html', 'website/layout.html', 'website/layouts.js', 'website/layout.js',
    'website/layout-host.js', 'website/layouts.css', 'website/docs.js', 'website/docs.css',
    'website/README.md'
  ]) {
    assert.doesNotMatch(read(path), /densit|cozy|zxDensity|gallery-segmented|docs-switcher/i,
      `${path} still offers or applies a density`);
  }
});

test('gallery tiles carry no component chips, and the page opens on its title and the tiles', () => {
  const gallery = read('website/layouts.js');
  assert.doesNotMatch(gallery, /gallery-tile__chips|CHIP_LIMIT|componentsOf|\.components\b/);
  assert.doesNotMatch(galleryChrome(), /gallery-tile__chips/);
  assert.doesNotMatch(gallery, /new Search\(|gallery-intro__(?:lead|filter|count|tools)/,
    'the gallery brings back an intro paragraph or a filter');
});

test('the gallery chrome keeps its corners at --zx-radius-lg or less', () => {
  const chrome = galleryChrome();
  assert.doesNotMatch(chrome, /--zx-radius-(?:xl|full)\b/, 'layouts.css rounds a surface past --zx-radius-lg');
  for (const block of ['.gallery-tile', '.zx-modal.gallery-popup']) {
    const rule = new RegExp(`^${block.replace(/\./g, '\\.')} \\{[^}]*border-radius: var\\(--zx-radius-lg\\)`, 'm');
    assert.match(chrome, rule, `${block} is not cornered with --zx-radius-lg`);
  }
  assert.doesNotMatch(read('website/docs.css'), /--zx-radius-xl\b/);
});

test('every layout opens on a page of its own, from its tile and from the popup', () => {
  const host = read('website/layout-host.js');
  assert.match(host, /return `layout\.html#\$\{encodeURIComponent\(id\)\}`;/);
  assert.match(host, /const LAYOUTS_TITLE = 'Layouts — ZeyOS Xenon Design System';/);
  assert.match(host, /preview: false,/, 'layouts are not mounted with a normal context');
  // Only an id the registry lists is ever imported.
  assert.match(host, /known: LAYOUT_IDS\.includes\(id\)/);

  const gallery = read('website/layouts.js');
  const tile = /^function tile\(entry\) \{[\s\S]*?^\}/m.exec(gallery)?.[0] ?? '';
  assert.match(tile, /h\('a', \{\s*class: 'zx-icon-btn gallery-tile__open',\s*href: standaloneHref\(entry\.id\),\s*target: '_blank',\s*rel: 'noopener',\s*'aria-label': `Open \$\{entry\.title\} in a new tab`/,
    'the tile has no named new-tab link');
  // The link follows the title's heading, so it is never inside the tile's button.
  assert.match(tile, /\}, entry\.title\)\),[\s\S]*h\('a', \{\s*class: 'zx-icon-btn gallery-tile__open'/,
    'the new-tab link is not a sibling of the tile\'s button');
  assert.match(gallery, /class: 'zx-btn gallery-popup__standalone',\s*target: '_blank',\s*rel: 'noopener'/);
  assert.match(gallery, /'Open in new tab'/);
  assert.match(gallery, /popup\.standalone\.href = standaloneHref\(entry\.id\);/);

  const page = read('website/layout.html');
  assert.deepEqual(stylesheets(page), stylesheets(read('website/layouts.html')),
    'layout.html does not load the gallery\'s stylesheets');
  assert.match(page, /<script src="site\.js"><\/script>/);
  assert.match(page, /<script type="module" src="layout\.js"><\/script>/);
  assert.match(page, /<a class="layout-bar__back" href="layouts\.html">All layouts<\/a>/);
  assert.match(page, /data-theme-toggle/);
  assert.doesNotMatch(page, /site-header|site-footer|site-nav/, 'layout.html carries the site chrome');

  const standalone = read('website/layout.js');
  assert.match(standalone, /window\.addEventListener\('hashchange', route\);/);
  assert.match(standalone, /document\.title = `\$\{name\} — \$\{LAYOUTS_TITLE\}`;/);
  assert.match(standalone, /label: 'Source'/);
});

test('the site check requires the standalone page, and the smoke run opens a layout through it', () => {
  const check = read('tools/check-site.js');
  for (const file of ['layout.html', 'layout.js', 'layout-host.js']) {
    assert.ok(check.includes(`'${file}'`), `check-site.js does not require ${file}`);
  }
  const smoke = read('tools/run-smoke.js');
  assert.match(smoke, /failed = \(await runStandaloneLayout\(browser\)\) \|\| failed;/);
  assert.match(smoke, /website\/layout\.html#\$\{id\}/);
  assert.doesNotMatch(smoke, /densit|cozy/i);
});

test('the shell gives columns up at the widths its controller knows', () => {
  // `adaptiveShell()` decides focus and drawer behaviour from `SHELL_BREAKPOINTS`; `kit.css` hides
  // and shows the columns. Both must name the same widths.
  const script = read('website/layouts/kit.js');
  const literal = /const SHELL_BREAKPOINTS = Object\.freeze\(\{([^}]*)\}\)/.exec(script)?.[1] ?? '';
  const declared = [...literal.matchAll(/(\w+):\s*(\d+)/g)].map(([, , width]) => Number(width)).sort((a, b) => a - b);
  assert.equal(declared.length, 3, 'SHELL_BREAKPOINTS names the aside, nav, and single-pane widths');
  const queried = [...new Set([...read('website/layouts/kit.css').matchAll(/@container shell \(max-width: (\d+)px\)/g)]
    .map(([, width]) => Number(width)))].sort((a, b) => a - b);
  assert.deepEqual(queried, declared);
});
