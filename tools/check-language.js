/**
 * Fails when a documentation page shows library text in English with the German catalogue installed.
 *
 *   node tools/check-language.js                   # every page in PAGES
 *   node tools/check-language.js calendar filter   # the pages named, by component id
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
  },
  async filter() {
    const { Filter, filterOperators } = await import('/src/index.js');
    const fixture = document.querySelector('[data-language-fixture]');
    const choices = [{ value: 'a', label: 'Alpha' }];
    const filter = new Filter(null, {
      fields: [
        { id: 'text', label: 'Alpha', type: 'text' },
        { id: 'number', label: 'Beta', type: 'number' },
        { id: 'date', label: 'Gamma', type: 'date' },
        { id: 'enum', label: 'Alpha', type: 'enum', choices },
        { id: 'tags', label: 'Beta', type: 'tags', choices }
      ],
      // The built-ins handed back as data stay translated, and a host's own label stays its own.
      operators: [...filterOperators, { id: 'alpha', label: 'Alpha', arity: 'single', types: ['text'] }],
      value: {
        version: 1,
        root: {
          kind: 'group', id: 'root', logic: 'and',
          children: ['text', 'number', 'date', 'enum', 'tags'].map((field) => ({
            kind: 'condition', id: field, field, operator: '', value: null
          }))
        }
      }
    });
    fixture.append(filter.el);
  },

  'account-menu': async () => {
    const { AccountMenu } = await import('/src/index.js');
    const fixture = document.querySelector('[data-language-fixture]');
    for (const account of [{}, { name: 'Alpha' }]) fixture.append(new AccountMenu(null, { account, items: [] }).el);
  },

  'activity-list': async () => {
    const { ActivityList } = await import('/src/index.js');
    const fixture = document.querySelector('[data-language-fixture]');
    for (const options of [
      { items: [] },
      { items: [], loading: true },
      { items: [{ id: 1, actor: 'Alpha', title: 'Beta' }], groupBy: () => null }
    ]) fixture.append(new ActivityList(null, options).el);
  },

  'app-sidebar': async () => {
    const { AppSidebar } = await import('/src/index.js');
    const fixture = document.querySelector('[data-language-fixture]');
    const action = { icon: 'plus', label: 'Beta', onSelect() {} };
    fixture.append(new AppSidebar(null, {
      items: [{ id: 'alpha', label: 'Alpha', actions: [action, action, action] }]
    }).el);
  },

  'file-item': async () => {
    const { FileItem } = await import('/src/index.js');
    const fixture = document.querySelector('[data-language-fixture]');
    const mimes = [
      'application/vnd.ms-excel', 'application/msword', 'application/vnd.ms-powerpoint', 'text/plain',
      'message/rfc822', 'text/calendar', 'text/vcard', 'image/png', 'video/mp4', 'audio/mpeg', 'font/woff2'
    ];
    const statuses = ['temporary', 'waiting', 'uploading', 'processing', 'success', 'error'];
    for (const mime of mimes) fixture.append(new FileItem(null, { name: 'Alpha', mime }).el);
    for (const status of statuses) fixture.append(new FileItem(null, { name: 'Alpha', status }).el);
    fixture.append(new FileItem(null, {
      name: 'Alpha', indeterminate: true, actions: [{ id: 'beta', title: 'Beta', icon: 'x' }]
    }).el);
  },

  'file-list': async () => {
    const { FileList } = await import('/src/index.js');
    const fixture = document.querySelector('[data-language-fixture]');
    for (const options of [{ items: [] }, { items: [], loading: true }]) fixture.append(new FileList(null, options).el);
  },

  'field-upload': async () => {
    const { FieldUpload } = await import('/src/index.js');
    const fixture = document.querySelector('[data-language-fixture]');
    window.zxCheckUpload = new FieldUpload(null, { http: { upload: () => new Promise(() => {}) } });
    window.zxCheckRefusing = new FieldUpload(null, { accept: 'image/*', maxSize: 1 });
    for (const upload of [
      window.zxCheckUpload, window.zxCheckRefusing, new FieldUpload(null, { multiple: true })
    ]) fixture.append(upload.el);
  },

  'kanban-view': async () => {
    const { KanbanView } = await import('/src/index.js');
    const fixture = document.querySelector('[data-language-fixture]');
    fixture.append(new KanbanView(null, {
      data: [{ ID: 1, name: 'Alpha', stage: null }], fields: [{ id: 'name', label: 'Beta' }],
      recordId: 'ID', titleField: 'name', columnBy: 'stage', fieldControls: true, searchControl: true,
      historyControls: true
    }).el);
  },

  async chart() {
    const { Chart } = await import('/src/index.js');
    const fixture = document.querySelector('[data-language-fixture]');
    const failed = new Chart(null, {});
    failed.setError(false);
    for (const chart of [
      new Chart(null, {}),
      new Chart(null, { loading: true }),
      failed,
      new Chart(null, { summary: 'visible', data: { labels: ['Alpha'], datasets: [{ data: [1] }] } })
    ]) fixture.append(chart.el);
  },

  async tree() {
    const { TreeView } = await import('/src/index.js');
    const fixture = document.querySelector('[data-language-fixture]');
    const action = { icon: 'plus', label: 'Beta', onSelect() {} };
    for (const tree of [
      new TreeView(null, { items: [] }),
      new TreeView(null, { items: [{ ID: 1, name: 'Alpha' }], rowActions: () => [action, action, action] })
    ]) fixture.append(tree.el);
  },

  'sort-control': async () => {
    const { SortControl } = await import('/src/index.js');
    document.querySelector('[data-language-fixture]').append(new SortControl(null, {
      fields: [{ id: 'alpha', label: 'Alpha' }]
    }).el);
  },

  'multi-value-editor': async () => {
    const { MultiValueEditor } = await import('/src/index.js');
    document.querySelector('[data-language-fixture]').append(new MultiValueEditor(null, {
      values: ['Alpha', 'Beta']
    }).el);
  },

  async rating() {
    const { Rating } = await import('/src/index.js');
    document.querySelector('[data-language-fixture]').append(new Rating(null, {}).el);
  },

  async finder() {
    const { Finder } = await import('/src/index.js');
    document.querySelector('[data-language-fixture]').append(new Finder(null, { items: [] }).el);
  },

  async toolbar() {
    const { MasterPanel, Toolbar } = await import('/src/index.js');
    const fixture = document.querySelector('[data-language-fixture]');
    fixture.append(new Toolbar(null, { items: [{ name: 'alpha', label: 'Alpha' }] }).el, new MasterPanel(null, {}).el);
  },

  'code-editor': async () => {
    const { CodeEditor } = await import('/src/index.js');
    window.zxCheckEditor = new CodeEditor(null, { status: true, value: 'Alpha\nBeta' });
    document.querySelector('[data-language-fixture]').append(window.zxCheckEditor.el);
  },

  async calendar() {
    const { Calendar } = await import('/src/index.js');
    document.querySelector('[data-language-fixture]').append(new Calendar(null, {
      date: new Date(2026, 2, 5), now: new Date(2026, 2, 5, 9), view: 'week',
      events: [{ id: 1, start: new Date(2026, 2, 5, 9), end: new Date(2026, 2, 5, 10) }]
    }).el);
  },

  'date-range': async () => {
    const { DateRangePicker } = await import('/src/index.js');
    const fixture = document.querySelector('[data-language-fixture]');
    for (const [start, end] of [
      [new Date(2026, 2, 5), new Date(2026, 2, 12)],
      [new Date(2026, 2, 5), new Date(2026, 3, 12)],
      [new Date(2025, 2, 5), new Date(2026, 3, 12)]
    ]) fixture.append(new DateRangePicker(null, { start, end }).el);
  },

  async copy() {
    const { CopyInput, copyButton } = await import('/src/index.js');
    const fixture = document.querySelector('[data-language-fixture]');
    fixture.append(copyButton({ text: 'Alpha' }), new CopyInput(null, { value: 'Alpha' }).el);
  },

  'entity-ref': async () => {
    const { EntityRef } = await import('/src/index.js');
    document.querySelector('[data-language-fixture]').append(new EntityRef(null, {
      title: 'Alpha', actions: [{ id: 'beta', title: 'Beta', icon: 'x' }]
    }).el);
  },

  async form() {
    const { Form } = await import('/src/index.js');
    document.querySelector('[data-language-fixture]').append(new Form(null, { fields: {}, actions: [{}] }).el);
  },

  async slider() {
    const { Slider } = await import('/src/index.js');
    document.querySelector('[data-language-fixture]').append(new Slider(null, { showInput: true, label: null }).el);
  },

  'source-list': async () => {
    const { SourceList } = await import('/src/index.js');
    document.querySelector('[data-language-fixture]').append(new SourceList(null, {
      sources: [{ id: 'alpha', title: 'Alpha' }]
    }).el);
  },

  async questionnaire() {
    const { Questionnaire } = await import('/src/index.js');
    document.querySelector('[data-language-fixture]').append(new Questionnaire(null, {
      items: [{ name: 'alpha', prompt: 'Alpha', choices: [{ value: 'beta', label: 'Beta' }], input: true }]
    }).el);
  },

  'block-view': async () => {
    const { renderBlocks } = await import('/src/index.js');
    document.querySelector('[data-language-fixture]').append(renderBlocks([{ type: 'code', code: 'Alpha' }]));
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
  },

  filter: {
    expect: [
      'enthält', 'enthält nicht', 'ist', 'ist nicht', 'beginnt mit', 'endet mit', 'ist kleiner als', 'ist höchstens',
      'ist größer als', 'ist mindestens', 'ist am', 'ist nicht am', 'ist vor', 'ist am oder vor', 'ist nach',
      'ist am oder nach', 'ist zwischen', 'ist nicht zwischen', 'liegt in den letzten', 'liegt in den nächsten',
      'ist eines von', 'ist keines von', 'enthält eines von', 'enthält alle', 'enthält keines von', 'ist leer',
      'ist nicht leer', 'Alpha'
    ]
  },

  'account-menu': { expect: ['Kontomenü', 'Kontomenü für Alpha'], demoText: [/^[A-Z]{2}$/] },

  'activity-list': {
    expect: ['Aktivität', 'Noch keine Aktivität', 'Aktivität wird geladen', 'Sonstige'],
    demoText: [/^[A-Z]{2}$/, /^(?:Today|Yesterday) · \d+$/]
  },

  'app-sidebar': {
    expect: ['Anwendungen', 'Weitere Aktionen'],
    demoText: [/^[A-Z]{2}$/, / \(\d+\)$/, /^New task: /]
  },

  'sort-control': { expect: ['Sortieren nach', 'Aufsteigend → Absteigend'] },

  'multi-value-editor': {
    expect: [
      'Wert hinzufügen', 'Wert 1', 'Wert 1 entfernen', 'Wert 1 nach oben verschieben', 'Wert 1 nach unten verschieben',
      'Wert 1 neu anordnen. Mit den Pfeiltasten verschieben.'
    ],
    demoText: [/^Add to (?:drag|buttons|none)$/, /^(?:drag|buttons|none) — /]
  },

  'file-item': {
    expect: [
      'Tabelle', 'Dokument', 'Präsentation', 'E-Mail', 'Kalender', 'Kontakt', 'Bild', 'Schriftart', 'Temporär',
      'Wartet', 'Wird hochgeladen', 'Wird verarbeitet', 'Abgeschlossen', 'Fehlgeschlagen', 'Fortschritt',
      'Dateiaktionen'
    ],
    demoText: [/^(?:PDF|ZIP|CSV|BIN)$/, / KiB$/, /^Actions for /, /Checksum failed/]
  },

  'file-list': {
    expect: ['Dateien', 'Keine Dateien', 'Dateien werden geladen'],
    demoText: [/^PDF$/, / KiB$/]
  },

  'field-upload': {
    async reveal(page, read) {
      await page.evaluate(() => {
        const refused = (name, type, size) => new File(['x'.repeat(size)], name, { type });
        window.zxCheckRefusing._setFiles([refused('Alpha.txt', 'text/plain', 1)]);
      });
      await read();
      await page.evaluate(() => {
        window.zxCheckRefusing._setFiles([new File(['xx'], 'Beta.png', { type: 'image/png' })]);
      });
      await read();
      await page.evaluate(() => {
        window.zxCheckUpload._setFiles([new File(['x'], 'Gamma.txt', { type: 'text/plain' })]);
        window.zxCheckUpload.upload();
      });
      await read();
      await page.evaluate(() => window.zxCheckUpload.abort());
      await read();
    },
    expect: [
      'Datei auswählen oder hier ablegen', 'Dateien auswählen oder hier ablegen', 'Datei hier ablegen oder auswählen',
      'Dateien hier ablegen oder auswählen', 'Von diesem Gerät auswählen', 'Upload-Fortschritt', 'Abbrechen',
      'Alpha.txt ist kein zulässiger Dateityp.', 'Beta.png überschreitet die maximale Dateigröße.',
      'Wird hochgeladen…', 'Upload abgebrochen.'
    ],
    demoText: [/^Simulate /, /^(?:abort|clear)\(\)$/]
  },

  'view-settings': { expect: ['Ansichtseinstellungen'], demoText: [/^, /] },

  'kanban-view': {
    expect: [
      'Kanban-Board', 'Felder', 'Board durchsuchen', 'Karten suchen', 'Rückgängig', 'Wiederholen', 'Nicht zugewiesen'
    ],
    demoText: [
      /^[A-Z]{2}$/, /^Flagged at risk\./, /, (?:Ada Lovelace|Grace Hopper)$/, / preview$/, / · €[\d,]+$/
    ]
  },

  grid: { expect: ['Position', 'Menge', 'Einheit', 'Einzelpreis', 'Währung', 'Gesamtpreis'] },

  chart: {
    expect: [
      'Diagramm', 'Keine Diagrammdaten', 'Diagramm wird geladen…', 'Diagramm kann nicht dargestellt werden',
      'Bezeichnung', 'Reihe 1'
    ]
  },

  tree: {
    expect: ['Baumansicht', 'Nichts anzuzeigen', 'Weitere Aktionen'],
    demoText: [/^Add sub-page: /]
  },

  finder: { expect: ['Leer'] },

  'navigation-bar': { expect: ['Hauptnavigation', 'Anwendungsaktionen', 'Mehr'] },

  toolbar: {
    expect: ['Symbolleiste', 'Aktionen des Bereichs'],
    demoText: [/^Aligned (?:start|end|between)$/]
  },

  'split-view': { expect: ['Größe der Bereiche ändern'] },

  dock: { expect: ['Größe der Bereiche ändern'] },

  rating: { expect: ['Bewertung'] },

  'code-editor': {
    async reveal(page, read) {
      await page.evaluate(() => {
        const input = window.zxCheckEditor.el.querySelector('textarea');
        input.setSelectionRange(0, input.value.length);
        input.dispatchEvent(new Event('select', { bubbles: true }));
      });
      await read();
    },
    expect: ['Code-Editor', 'Z. 2, Sp. 5', 'Z. 1, Sp. 1 · 2 Zeilen ausgewählt'],
    demoText: [/^\{ "theme"/]
  },

  calendar: {
    expect: ['Termin ohne Titel', 'Termin ohne Titel, Do., 5. März, 09:00 bis Do., 5. März, 10:00'],
    demoText: [/^[^,]+: [^,]+$/]
  },

  'date-range': {
    expect: [
      '5. – 12. März 2026, 7 Nächte', '5. März – 12. April 2026, 38 Nächte',
      '5. März 2025 – 12. April 2026, 403 Nächte', 'Donnerstag, 5. März 2026, Beginn des Zeitraums'
    ]
  },

  copy: { expect: ['Kopieren'] },

  prose: { expect: ['Link kopieren'], demoText: [/^The finance team closes/] },

  'entity-ref': { expect: ['Aktionen des Objekts'] },

  form: { expect: ['Aktion'], demoText: [/^set(?:Values|Highlights)\(…\)$/] },

  slider: { expect: ['Wert'] },

  'source-list': { expect: ['Quellen'] },

  questionnaire: { expect: ['Sonstiges'], demoText: [/^path type progress /] },

  'block-view': { expect: ['Code kopieren'] },

  'agent-thread': {
    expect: ['Code kopieren'],
    demoText: [/^[A-Z]{2}$/, / kB$/, /^\{ "/, /^json$/, /^Bruckner Logistik is/]
  },

  composer: { demoText: [/^Message Halden/, /^Start task \(/] },

  'run-status': {},

  'run-trace': {
    demoText: [/^[A-Z]{2}$/, /^[{[] /, /^Searching the bank feed…$/, /^Sending \d+ reminders…$/]
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
