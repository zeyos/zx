/**
 * Fails when a documentation page shows library text in English with the German catalogue installed.
 *
 *   node tools/check-language.js                   # Select, Table and Datebox
 *   node tools/check-language.js calendar filter   # other pages, by component id
 *
 * A complete catalogue proves nothing about text that never asks it, so this reads the screen. Each
 * page opens twice, as written and with `de` installed through `setTranslator()` and `setLanguage()`,
 * and the same steps open what the page hides: lists, calendars, the column menu, a grabbed row, a
 * cell editor. Text and labelling attributes are collected from every step.
 *
 * Library English is what reads the same in both runs and has no other explanation. Three things
 * explain it: the demo's own source wrote it, German shares it (a catalogue entry identical to its
 * English text, or a name such as `November`), or it holds no words.
 *
 * Demos do not use every option, so each page also mounts a fixture with the options they leave out,
 * and each page names text that must appear, so a step that silently opens nothing fails too.
 *
 * `npm run test:browser` runs this after the smoke suites. Requires an installed Google Chrome.
 */
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { de } from '../src/locales/de.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** The instant every run reads as "now", so a calendar opens on the same month in both. */
const FIXED_TIME = new Date(2026, 9, 8, 10, 30);

/** Attributes that reach a reader. */
const ATTRIBUTES = ['aria-label', 'aria-description', 'aria-roledescription', 'aria-valuetext', 'title', 'placeholder', 'alt'];

/** The fixture's own text, which is data rather than library text. */
const FIXTURE_WORDS = ['Alpha', 'Beta', 'Gamma'];

/** Prepended to `website/docs.js`, so the catalogue is in place before a demo mounts. */
const INSTALL = `import { setLanguage as zxCheckLanguage, setTranslator as zxCheckTranslator } from '/src/core/i18n.js';
import { de as zxCheckGerman } from '/src/locales/de.js';
zxCheckTranslator((key) => zxCheckGerman[key]);
zxCheckLanguage('de');
`;

/**
 * Clicks each visible control, reads the page, and closes it again.
 * @param {import('playwright-core').Page} page Page.
 * @param {string} selector Controls that open something.
 * @param {() => Promise<void>} read Reads the page.
 * @param {(() => Promise<void>)|null} [inside=null] Runs while the control is open.
 * @returns {Promise<void>}
 */
async function openEach(page, selector, read, inside = null) {
  const controls = page.locator(selector);
  const count = await controls.count();
  for (let index = 0; index < count; index += 1) {
    const control = controls.nth(index);
    if (!(await control.isVisible()) || !(await control.isEnabled())) continue;
    await control.click();
    await read();
    await inside?.();
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
  }
}

/**
 * Mounts what the page's demos leave out, with no text of their own to hide behind.
 * @type {Record<string, () => Promise<void>>}
 */
const FIXTURES = {
  async select() {
    const { Select } = await import('/src/index.js');
    const fixture = document.querySelector('[data-language-fixture]');
    const items = [{ ID: 1, name: 'Alpha' }, { ID: 2, name: 'Beta' }];
    for (const select of [
      new Select(null, { items, clearable: true, value: 1 }),
      Select.status(null),
      Select.priority(null),
      Select.permission(null, { groups: [{ ID: 3, name: 'Gamma' }] }),
      Select.entity(null, { items, recent: [items[0]], create: true, filter: 'local' })
    ]) fixture.append(select.el);
  },

  async table() {
    const { Table } = await import('/src/index.js');
    const fixture = document.querySelector('[data-language-fixture]');
    window.zxCheckTable = new Table(null, {
      columns: [
        { id: 'name', label: 'Alpha', editable: true, sortable: true },
        { id: 'note', label: 'Beta', editable: true }
      ],
      data: [{ ID: 1, name: 'Gamma', note: 'Gamma' }, { ID: 2, name: 'Gamma', note: 'Gamma' }],
      rowReorder: true, columnReorder: true, columnVisibility: true, editMode: 'cell', selectable: 'multi'
    });
    fixture.append(window.zxCheckTable.el);
  },

  async datebox() {
    const { Datebox, DateTimeBox } = await import('/src/index.js');
    const fixture = document.querySelector('[data-language-fixture]');
    for (const box of [
      new Datebox(null, {}),
      new Datebox(null, { format: '%e.%m.%y %H:%M:%S' }),
      new Datebox(null, { value: new Date(2026, 2, 5), displayFormat: '%A, %e %B %Y' }),
      DateTimeBox(null, { value: new Date(2026, 2, 5, 9, 7) })
    ]) fixture.append(box.el);
  }
};

/**
 * The pages this checks unless told otherwise: what to open on each, text the German run must show,
 * which is how a step that opened nothing gets noticed, and what a demo's code writes that its source
 * does not spell out (initials it derives, a label it builds from a row).
 * @type {Record<string, {reveal?: (page: import('playwright-core').Page, read: () => Promise<void>) => Promise<void>, expect?: string[], demoText?: RegExp[]}>}
 */
const PAGES = {
  select: {
    async reveal(page, read) {
      await openEach(page, '.zx-select__toggle', read);
    },
    expect: [
      'Auswahl', 'Auswahl aufheben', 'Zuletzt verwendet', 'Neu erstellen…', 'Neu', 'Backlog', 'Zu erledigen',
      'In Bearbeitung', 'In Prüfung', 'Bereit zum Mergen', 'Wartet auf Feedback', 'Erledigt', 'Abgebrochen',
      'Duplikat', 'Mittel', 'Privat', 'Öffentlich'
    ],
    demoText: [/^[A-Z]{2}$/]
  },

  table: {
    async reveal(page, read) {
      const fixture = page.locator('[data-language-fixture]');
      await fixture.locator('summary').click();
      await read();
      await fixture.locator('.zx-table__column-move:not(:disabled)').first().click();
      await read();
      await fixture.locator('summary').click();

      await fixture.locator('.zx-table__row-handle').first().focus();
      await page.keyboard.press('Space');
      await read();
      await page.keyboard.press('ArrowDown');
      await read();
      await page.keyboard.press('Space');
      await read();

      await page.evaluate(() => window.zxCheckTable.startEdit(1, 'name'));
      await read();
      await page.keyboard.press('Escape');
      await page.evaluate(() => window.zxCheckTable.setSort('name', 'asc'));
      await read();

      // The demos' editors: a Select, a Datebox and a text field in a cell.
      await page.getByRole('heading', { name: 'Cell editing' }).scrollIntoViewIfNeeded();
      await openEach(page, '.docs-example__stage .zx-select__toggle, .docs-example__stage .zx-datebox__toggle', read);
    },
    expect: [
      'Spalten', 'Zeilenreihenfolge', 'Alpha verschieben', 'Alpha nach hinten verschieben',
      'Beta nach vorn verschieben', 'Alpha an Position 2 von 2 verschoben.', 'Zeile aufgenommen. Mit den Pfeiltasten verschieben.',
      'Zeile an Position 2 von 2 verschoben.', 'Zeile abgelegt', 'Alpha, Zeile 2',
      'Sortierung aufheben, um Zeilen neu anzuordnen'
    ],
    demoText: [/^View the invoice for /]
  },

  datebox: {
    async reveal(page, read) {
      await openEach(page, '.zx-datebox__toggle', read, async () => {
        // A disabled box keeps its toggle enabled and opens nothing.
        const heading = page.locator('.zx-datebox__popover[data-state="open"] .zx-date-picker__heading');
        if (await heading.count() === 0) return;
        await heading.first().click();
        await read();
      });
    },
    expect: [
      'Datum auswählen', 'Datum zurücksetzen', 'TT.MM.JJJJ', 'TT.MM.JJJJ HH:MM', 'T.MM.JJ HH:MM:SS', 'Oktober 2026',
      'Monat und Jahr auswählen, Oktober 2026', '8. Oktober 2026', 'Mo', 'Montag', 'Mär', 'März 2026',
      'Donnerstag, 5 März 2026'
    ]
  }
};

/**
 * Everything the page shows a reader right now. It runs inside the page.
 * @param {string[]} attributes Attributes to read.
 * @returns {string[]}
 */
function readPage(attributes) {
  const found = new Set();
  const add = (value) => {
    const text = String(value ?? '').replace(/\s+/g, ' ').trim();
    if (text) found.add(text);
  };
  const scopes = [...document.querySelectorAll('.docs-example__stage, [data-language-fixture]')];
  // Overlays that attach themselves to the page instead of their component.
  for (const child of document.body.children) {
    if (!child.matches('.site-header, #docs-app, footer, script, template, noscript, [data-language-fixture]')) scopes.push(child);
  }
  for (const scope of scopes) {
    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!node.parentElement?.closest('script, style, template')) add(node.nodeValue);
    }
    for (const element of [scope, ...scope.querySelectorAll('*')]) {
      for (const name of attributes) if (element.hasAttribute(name)) add(element.getAttribute(name));
      // A field shows its value as a property, which no attribute or text node holds.
      if (element.matches('textarea, input:not([type="checkbox"], [type="radio"], [type="hidden"])')) add(element.value);
    }
  }
  return [...found];
}

/**
 * Reads one documentation page, hidden states and fixture included.
 * @param {import('playwright-core').Browser} browser Browser.
 * @param {string} base Server origin.
 * @param {string} id Component id.
 * @param {boolean} german Whether to install the catalogue.
 * @returns {Promise<{strings: Set<string>, shared: Set<string>, problems: string[]}>}
 */
export async function capturePage(browser, base, id, german) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1200 }, reducedMotion: 'reduce', colorScheme: 'light'
  });
  try {
    await context.clock.setFixedTime(FIXED_TIME);
    if (german) {
      await context.route('**/website/docs.js', async (route) => {
        const response = await route.fetch();
        await route.fulfill({ response, body: INSTALL + await response.text() });
      });
    }
    const page = await context.newPage();
    const problems = [];
    page.on('pageerror', (error) => problems.push(`uncaught: ${error.message}`));
    await page.goto(`${base}/website/docs.html#components/${id}`, { waitUntil: 'load' });
    await page.waitForSelector('.docs-example__stage');
    await page.waitForLoadState('networkidle');

    await page.evaluate(() => {
      const fixture = document.createElement('div');
      fixture.dataset.languageFixture = '';
      document.querySelector('.docs-example__stage').closest('main, #docs-app').append(fixture);
    });
    if (FIXTURES[id]) await page.evaluate(FIXTURES[id]);

    const strings = new Set();
    const read = async () => {
      for (const text of await page.evaluate(readPage, ATTRIBUTES)) strings.add(text);
    };
    await read();
    await PAGES[id]?.reveal?.(page, read);

    // Words German shares with English are the platform's, so they are read from the same engine.
    const shared = new Set(await page.evaluate(() => {
      const names = [];
      for (const [option, count, make] of [
        ['month', 12, (index) => new Date(2026, index, 15)],
        ['weekday', 7, (index) => new Date(2026, 2, 1 + index)]
      ]) {
        for (const style of ['long', 'short']) {
          const format = new Intl.DateTimeFormat('de', { [option]: style });
          for (let index = 0; index < count; index += 1) names.push(format.format(make(index)));
        }
      }
      return names;
    }));
    return { strings, shared, problems };
  } finally {
    await context.close();
  }
}

/**
 * The text a demo wrote itself, from its module and the `website/` modules it imports.
 * @param {string} id Component id.
 * @returns {string}
 */
function authorText(id) {
  const path = join(root, 'website/demos', `${id}.demo.js`);
  const source = readFileSync(path, 'utf8');
  const imported = [...source.matchAll(/from '(\.\.?\/[^']+)'/g)]
    .map((match) => resolve(dirname(path), match[1]))
    .filter((file) => file.startsWith(join(root, 'website')));
  // Blurbs and comments are prose about the library, full of the words this looks for, and never
  // reach a stage, so they must not explain anything that does.
  return [source, ...imported.map((file) => readFileSync(file, 'utf8'))].join('\n')
    .replace(/\/\*[\s\S]*?\*\/|^\s*\/\/.*$/gm, '')
    .replace(/blurb:\s*(?:(?:'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")\s*\+?\s*)+/g, '');
}

/**
 * What one page still shows in English.
 * @param {{strings: Set<string>, shared: Set<string>}} english The page as written.
 * @param {{strings: Set<string>, shared: Set<string>}} german The page with the catalogue installed.
 * @param {string} author The demo's own source.
 * @param {RegExp[]} [demoText=[]] Text the demo's code builds.
 * @returns {string[]}
 */
export function libraryEnglish(english, german, author, demoText = []) {
  const catalogue = new Set(Object.values(de));
  const sharedNames = [...german.shared].sort((left, right) => right.length - left.length);
  const fixture = new RegExp(`\\b(?:${FIXTURE_WORDS.join('|')})\\b`, 'g');
  return [...german.strings].filter((text) => {
    if (!english.strings.has(text) || catalogue.has(text)) return false;
    if (demoText.some((pattern) => pattern.test(text))) return false;
    // Demos number what they generate: `Item ${index}` reads `Item 12` on the page.
    if (text.split(/\d+/).every((part) => author.includes(part.trim()))) return false;
    // A date heading reads the same in November, and a number is nobody's language.
    let words = text.replace(fixture, ' ');
    for (const name of sharedNames) words = words.split(name).join(' ');
    return /\p{L}{2,}/u.test(words);
  });
}

/**
 * Checks pages and reports them.
 * @param {import('playwright-core').Browser} browser Browser.
 * @param {string} base Server origin.
 * @param {string[]} [ids=Object.keys(PAGES)] Component ids.
 * @returns {Promise<boolean>} Whether a page failed.
 */
export async function checkLanguage(browser, base, ids = Object.keys(PAGES)) {
  let failed = false;
  let read = 0;
  for (const id of ids) {
    const english = await capturePage(browser, base, id, false);
    const german = await capturePage(browser, base, id, true);
    const leftovers = libraryEnglish(english, german, authorText(id), PAGES[id]?.demoText);
    const missing = (PAGES[id]?.expect ?? []).filter((text) => !german.strings.has(text));
    const problems = [...english.problems, ...german.problems];
    read += german.strings.size;
    if (leftovers.length || missing.length || problems.length) {
      failed = true;
      console.error(`FAIL  language: ${id}`);
      for (const text of leftovers) console.error(`        still English: ${text}`);
      for (const text of missing) console.error(`        never shown: ${text}`);
      for (const text of problems.slice(0, 5)) console.error(`        ${text}`);
    }
  }
  if (!failed) console.log(`PASS  language — ${ids.join(', ')}: ${read} strings in German`);
  return failed;
}

/** Runs on its own: serves the repository, checks, and stops. @returns {Promise<number>} Exit code. */
async function main() {
  const ids = process.argv.slice(2);
  const port = Number(process.env.SMOKE_PORT ?? 8398);
  const base = `http://127.0.0.1:${port}`;
  const server = spawn(process.execPath, [join(root, 'tools/serve.js')], {
    cwd: root, env: { ...process.env, PORT: String(port) }, stdio: 'ignore'
  });
  process.on('exit', () => server.kill());
  let browser;
  try {
    for (let attempt = 0; attempt < 50; attempt += 1) {
      try {
        await fetch(base);
        break;
      } catch {
        await new Promise((done) => setTimeout(done, 100));
      }
    }
    browser = await chromium.launch({ channel: 'chrome' });
    return (await checkLanguage(browser, base, ids.length ? ids : undefined)) ? 1 : 0;
  } finally {
    await browser?.close();
    server.kill();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exit(await main());
