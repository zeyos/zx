import {
  addDays, addMonths, clamp, clampDate, copyToClipboard, debounce, deepMerge, downloadBlob,
  escapeRegExp, formatCurrency, formatDate, formatFileSize, formatNumber, formatPercent,
  formatRelativeTime, getLanguage, getWeekStart, groupBy, h, highlightMatch, htmlEscape, isElement,
  isSameDay, parseDate, printf, rovingTabindex, sortBy, storage, throttle, toArray, toCsv,
  typeahead, uid, uniqueBy
} from '../../src/index.js';

/** Fixed reference date so the date examples read the same on every visit. */
const REFERENCE = new Date(2026, 7, 14, 9, 30, 0);

export default {
  title: 'Helper functions',
  group: 'Helpers',
  demoTitle: 'Helper gallery',
  blurb: 'The standalone function library that ships alongside the components: dates, formatting, '
    + 'escaping, small utilities, translation, and keyboard behaviours. Every one is a plain '
    + 'export — importable on its own, usable without instantiating anything.',

  /**
   * Mounts live examples for the non-component helper exports.
   * @param {HTMLElement} container Demo stage.
   * @returns {void}
   */
  mount(container) {
    container.append(
      intro(),
      dateHelpers(),
      formattingHelpers(),
      utilityHelpers(),
      collectionHelpers(),
      escapingHelpers(),
      storageHelpers(),
      exportHelpers(),
      translationHelpers(),
      keyboardHelpers()
    );
  }
};

/** @returns {HTMLElement} */
function intro() {
  return section('What counts as a helper',
    note('Components cover the interactive surface. Everything below is the layer underneath: '
      + 'pure functions with no DOM ownership, no lifecycle, and no teardown. They are exported '
      + 'from the same entry point as the components:'),
    code("import { formatDate, debounce, printf } from '/assets/zx.esm.js';"),
    note('For the element factory h(), the icon set, the anchored-positioning helper, and the '
      + 'Component base class, see the Kernel entry — those are the building blocks components '
      + 'themselves are made of.')
  );
}

/** @returns {HTMLElement} */
function dateHelpers() {
  const format = h('input', { type: 'text', value: '%d.%m.%Y %H:%M', size: 18 });
  const input = h('input', { type: 'text', value: '14.08.2026 09:30', size: 18 });
  const out = output();

  const update = () => {
    const parsed = parseDate(input.value, format.value);
    const lines = [
      `formatDate(reference, '${format.value}') → ${formatDate(REFERENCE, format.value)}`,
      `parseDate('${input.value}', '${format.value}') → ${parsed ? parsed.toISOString() : 'null'}`,
      `addDays(reference, 30) → ${formatDate(addDays(REFERENCE, 30), '%Y-%m-%d')}`,
      `addMonths(reference, -2) → ${formatDate(addMonths(REFERENCE, -2), '%Y-%m-%d')}`,
      `isSameDay(reference, parsed) → ${parsed ? isSameDay(REFERENCE, parsed) : 'n/a'}`,
      `clampDate(reference, 2026-01-01, 2026-06-30) → `
        + formatDate(clampDate(REFERENCE, new Date(2026, 0, 1), new Date(2026, 5, 30)), '%Y-%m-%d'),
      `getWeekStart('${getLanguage()}') → ${getWeekStart()} (0 = Sunday, 1 = Monday)`
    ];
    out.textContent = lines.join('\n');
  };
  format.addEventListener('input', update);
  input.addEventListener('input', update);
  update();

  return section('Dates',
    note('Formatting and parsing use strftime-style tokens: %d %m %Y %y %H %M %S %a %A %b %B %s. '
      + 'parseDate() returns null when the string does not match, so it doubles as a validator.'),
    row(
      field('Format', format),
      field('Parse', input)
    ),
    out
  );
}

/** @returns {HTMLElement} */
function utilityHelpers() {
  const out = output();
  const debounceOut = output('Type below — the handler fires 400 ms after you stop.');
  let calls = 0;

  const typing = h('input', { type: 'text', placeholder: 'Search…', size: 24 });
  const onSettled = debounce((value) => {
    calls += 1;
    debounceOut.textContent = `debounce fired ${calls}× — latest value: "${value}"`;
  }, 400);
  typing.addEventListener('input', () => onSettled(typing.value));

  const defaults = { page: 1, sort: { id: 'name', dir: 'asc' }, columns: ['name', 'city'] };
  const overrides = { sort: { dir: 'desc' }, columns: ['name'] };
  out.textContent = [
    `uid() → ${uid()}`,
    `uid('row') → ${uid('row')}`,
    `clamp(42, 0, 10) → ${clamp(42, 0, 10)}`,
    `toArray(null) → ${JSON.stringify(toArray(null))}`,
    `toArray('one') → ${JSON.stringify(toArray('one'))}`,
    `toArray(document.querySelectorAll('input')).length → ${toArray(document.querySelectorAll('input')).length}`,
    `isElement(document.body) → ${isElement(document.body)}`,
    `isElement({ nodeType: 1 }) → ${isElement({ nodeType: 1 })}  // cross-realm safe`,
    '',
    'deepMerge(defaults, overrides) →',
    JSON.stringify(deepMerge(defaults, overrides), null, 2)
  ].join('\n');

  return section('Utilities',
    note('deepMerge() never mutates either input and replaces arrays rather than concatenating '
      + 'them, which is what option objects want. uid() is unique per page load and safe as a DOM '
      + 'id or CSS name.'),
    out,
    row(field('Debounced input', typing)),
    debounceOut
  );
}

/** @returns {HTMLElement} */
function escapingHelpers() {
  const input = h('input', {
    type: 'text',
    size: 34,
    value: '<img src=x onerror="alert(1)"> & "quoted"'
  });
  const escaped = output();
  const rendered = h('p', { style: { margin: '0' } });

  const update = () => {
    escaped.textContent = `htmlEscape(value) → ${htmlEscape(input.value)}`;
    rendered.textContent = input.value;
  };
  input.addEventListener('input', update);
  update();

  return section('Escaping',
    note('Zx never assigns innerHTML except through h.raw(), and only for markup a component '
      + 'generated itself. Anything from a user or a server goes through a text node or '
      + 'htmlEscape().'),
    row(field('Untrusted value', input)),
    escaped,
    h('div', { style: {
      padding: 'var(--zx-space-3)',
      border: '1px solid var(--zx-color-border)',
      borderRadius: 'var(--zx-radius-md)'
    } },
    h('small', { style: { color: 'var(--zx-color-text-muted)' } }, 'Rendered as a text node:'),
    rendered)
  );
}

/** @returns {HTMLElement} */
function translationHelpers() {
  const template = h('input', {
    type: 'text',
    size: 40,
    value: '%s has %s open item(s) — due %s'
  });
  const out = output();

  const update = () => {
    out.textContent = [
      `getLanguage() → '${getLanguage()}'`,
      `printf(template, ['Nadine', 3, formatDate(reference, '%d.%m.%Y')])`,
      `  → ${printf(template.value, ['Nadine', 3, formatDate(REFERENCE, '%d.%m.%Y')])}`
    ].join('\n');
  };
  template.addEventListener('input', update);
  update();

  return section('Translation',
    note('Every component routes its built-in strings through translate(), so one translator '
      + 'covers the whole library. Install it once at application start-up; setLanguage() also '
      + 'drives locale-dependent behaviour such as the first day of the week.'),
    code([
      "import { setTranslator, setLanguage } from '/assets/zx.esm.js';",
      '',
      'setLanguage(document.documentElement.lang);',
      'setTranslator((key, args) => printf(myCatalogue[key] ?? key, args));'
    ].join('\n')),
    row(field('printf template', template)),
    out
  );
}

/** @returns {HTMLElement} */
function keyboardHelpers() {
  const items = ['Accounts', 'Billing', 'Calendar', 'Contacts', 'Projects', 'Tickets'];
  const list = h('div', {
    role: 'listbox',
    tabIndex: -1,
    'aria-label': 'Modules',
    style: {
      display: 'flex', flexWrap: 'wrap', gap: 'var(--zx-space-2)',
      padding: 'var(--zx-space-3)',
      border: '1px solid var(--zx-color-border)',
      borderRadius: 'var(--zx-radius-md)'
    }
  }, items.map((label) => h('button', {
    type: 'button',
    class: 'zx-btn',
    dataset: { size: 'sm' },
    role: 'option'
  }, label)));

  const out = output('Click an item, then use the arrow keys — or just type a module name.');
  const roving = rovingTabindex(list, '[role="option"]', { orientation: 'horizontal' });
  const search = typeahead(
    () => [...list.querySelectorAll('[role="option"]')],
    (item) => {
      item.focus();
      out.textContent = `typeahead matched "${item.textContent}"`;
    }
  );
  list.addEventListener('keydown', (event) => search(event));
  list.addEventListener('focusin', (event) => {
    out.textContent = `rovingTabindex focus → ${event.target.textContent}`;
  });

  // The demo stage is replaced when another entry is opened; drop the listeners with it.
  new MutationObserver((records, observer) => {
    if (list.isConnected) return;
    roving.destroy();
    observer.disconnect();
  }).observe(document.body, { childList: true, subtree: true });

  return section('Keyboard',
    note('These are the primitives the components use for APG conformance. focusTrap(container) '
      + 'confines Tab to a container and returns a release function; rovingTabindex() keeps one '
      + 'tab stop in a group and moves focus with the arrow keys; typeahead() resolves printable '
      + 'keystrokes to an item index.'),
    list,
    out
  );
}

/** @returns {HTMLElement} */
function formattingHelpers() {
  const value = h('input', { type: 'text', value: '1234567.891', size: 14 });
  const fraction = h('input', { type: 'text', value: '0.4267', size: 8 });
  const bytes = h('input', { type: 'text', value: '1587200', size: 12 });
  const decimals = h('input', { type: 'number', value: '2', min: '0', max: '6', size: 4 });
  const locale = h('select', {}, ['en', 'de', 'fr', 'ja'].map((code) => h('option', { value: code }, code)));
  const currency = h('select', {}, ['EUR', 'USD', 'GBP', 'JPY'].map((code) => h('option', { value: code }, code)));
  const out = output();

  const update = () => {
    const options = { locale: locale.value };
    const digits = Number(decimals.value);
    const now = new Date();
    out.textContent = [
      `formatNumber('${value.value}') → ${formatNumber(value.value, options)}`,
      `formatNumber(…, { decimals: ${digits} }) → ${formatNumber(value.value, { ...options, decimals: digits })}`,
      `formatNumber(…, { group: false }) → ${formatNumber(value.value, { ...options, group: false })}`,
      '',
      `formatCurrency('${value.value}', '${currency.value}') → ${formatCurrency(value.value, currency.value, options)}`,
      // An unusable code never throws — it degrades to a plain formatted number.
      `formatCurrency(…, 'not-a-code') → ${formatCurrency(value.value, 'not-a-code', options)}`,
      '',
      `formatPercent(${fraction.value}) → ${formatPercent(fraction.value, options)}`,
      `formatPercent(…, { decimals: ${digits} }) → ${formatPercent(fraction.value, { ...options, decimals: digits })}`,
      '',
      `formatFileSize(${bytes.value}) → ${formatFileSize(bytes.value, options)}`,
      `formatFileSize(…, { standard: 'si' }) → ${formatFileSize(bytes.value, { ...options, standard: 'si' })}`,
      '',
      `formatRelativeTime(90 seconds ago) → ${formatRelativeTime(new Date(now.getTime() - 90000), options)}`,
      `formatRelativeTime(yesterday) → ${formatRelativeTime(addDays(now, -1), options)}`,
      `formatRelativeTime(in 3 weeks) → ${formatRelativeTime(addDays(now, 21), options)}`,
      `formatRelativeTime(…, { numeric: 'always' }) → `
        + formatRelativeTime(addDays(now, -1), { ...options, numeric: 'always' })
    ].join('\n');
  };
  for (const control of [value, fraction, bytes, decimals]) control.addEventListener('input', update);
  for (const control of [locale, currency]) control.addEventListener('change', update);
  update();

  return section('Formatting',
    note('Locale-aware number, currency, percentage, file-size, and relative-time formatting on '
      + 'top of Intl, with every formatter instance cached — tables call these once per cell. '
      + 'Nothing throws: null, undefined, and NaN all format as an empty string, and an invalid '
      + 'currency code falls back to a plain number. Pass a locale explicitly or leave it off and '
      + 'let setLanguage() drive all five.'),
    row(
      field('Value', value),
      field('Fraction', fraction),
      field('Bytes', bytes),
      field('Decimals', decimals),
      field('Locale', locale),
      field('Currency', currency)
    ),
    out
  );
}

/** @returns {HTMLElement} */
function collectionHelpers() {
  const people = [
    { name: 'Ada', dept: 'Engineering', age: 36 },
    { name: 'Bo', dept: 'Sales', age: 29 },
    { name: 'Cleo', dept: 'Engineering', age: 41 },
    { name: 'Dev', dept: 'Sales', age: null },
    { name: 'Eve', dept: 'Support', age: 24 }
  ];
  const grouped = groupBy(people, 'dept');
  const out = output([
    "groupBy(people, 'dept') →",
    JSON.stringify(
      Object.fromEntries(Object.entries(grouped).map(([key, list]) => [key, list.map((p) => p.name)])),
      null, 2
    ),
    '',
    // '-age' sorts descending; the null age sorts last either way.
    "sortBy(people, 'dept', '-age') → "
      + sortBy(people, 'dept', '-age').map((p) => `${p.name}(${p.age ?? '—'})`).join(', '),
    "sortBy(people, { key: 'age', dir: 'desc' }) → "
      + sortBy(people, { key: 'age', dir: 'desc' }).map((p) => p.name).join(', '),
    '',
    "uniqueBy(people, 'dept') → " + uniqueBy(people, 'dept').map((p) => p.dept).join(', '),
    'uniqueBy([1, 2, 2, 3, 1]) → ' + JSON.stringify(uniqueBy([1, 2, 2, 3, 1]))
  ].join('\n'));

  // throttle: every keystroke is counted, but the handler runs at most once per 300 ms.
  const typing = h('input', { type: 'text', placeholder: 'Type quickly…', size: 24 });
  const throttleOut = output('Type above — raw keystrokes vs. throttled calls.');
  let raw = 0;
  let throttled = 0;
  const onThrottled = throttle(() => {
    throttled += 1;
    throttleOut.textContent = `keystrokes: ${raw} — throttle(fn, 300) calls: ${throttled}`;
  }, 300);
  typing.addEventListener('input', () => {
    raw += 1;
    throttleOut.textContent = `keystrokes: ${raw} — throttle(fn, 300) calls: ${throttled}`;
    onThrottled();
  });

  // escapeRegExp + highlightMatch: the query is treated as literal text, never as a pattern.
  const HAYSTACK = 'Invoice INV-2026-014 (net 30) totals 1.240,00 € — see item 4.2 and item 4.20.';
  const query = h('input', { type: 'text', value: '4.2', size: 18 });
  const highlighted = h('p', { style: { margin: '0', lineHeight: '1.8' } });
  const escaped = output();
  const highlight = () => {
    escaped.textContent = `escapeRegExp('${query.value}') → ${escapeRegExp(query.value)}`;
    highlighted.replaceChildren(highlightMatch(HAYSTACK, query.value));
  };
  query.addEventListener('input', highlight);
  highlight();

  return section('Collections',
    note('groupBy(), sortBy(), and uniqueBy() take a property name or an accessor function. '
      + 'sortBy() returns a new array — it never mutates its input — accepts several keys, reads a '
      + "'-' prefix (or a { key, dir } object) as descending, compares digit runs numerically, and "
      + 'always sorts null, undefined, and NaN last whichever direction is asked for.'),
    out,
    note('throttle() runs at most once per interval, on the leading edge, the trailing edge, or '
      + 'both — the counterpart to debounce(), which waits for calls to stop.'),
    row(field('Throttled input', typing)),
    throttleOut,
    note('escapeRegExp() makes user input safe as a literal pattern; highlightMatch() uses it to '
      + 'wrap every case-insensitive occurrence in a <mark class="zx-mark"> without any innerHTML. '
      + 'Note that "4.2" matches only the literal text, not "4x2".'),
    row(field('Search term', query)),
    escaped,
    h('div', { style: {
      padding: 'var(--zx-space-3)',
      border: '1px solid var(--zx-color-border)',
      borderRadius: 'var(--zx-radius-md)'
    } }, highlighted)
  );
}

/** @returns {HTMLElement} */
function storageHelpers() {
  const store = storage('demo');
  const other = storage('other-feature');
  const out = output();
  const note1 = h('input', { type: 'text', size: 28, placeholder: 'Persisted across reloads…' });

  // Seed a neighbouring namespace so clear() can be shown to leave it alone.
  other.set('untouched', true);
  note1.value = store.get('note', '');

  /**
   * Reading globalThis.localStorage itself throws when cookies are disabled — the very case
   * storage() exists to absorb — so the demo guards it rather than being more fragile than the
   * helper it is showing off.
   * @returns {string[]}
   */
  const rawKeys = () => {
    try {
      return Object.keys(globalThis.localStorage ?? {}).filter((key) => key.startsWith('zx:'));
    } catch {
      return [];
    }
  };

  const update = () => {
    out.textContent = [
      `store.keys() → ${JSON.stringify(store.keys())}`,
      `store.get('note', '(nothing yet)') → ${JSON.stringify(store.get('note', '(nothing yet)'))}`,
      `store.get('missing', 'fallback') → ${JSON.stringify(store.get('missing', 'fallback'))}`,
      '',
      'Raw keys in localStorage (note the zx: prefix and the namespace);',
      'empty here means the in-memory fallback is active:',
      JSON.stringify(rawKeys(), null, 2)
    ].join('\n');
  };

  note1.addEventListener('input', () => {
    store.set('note', note1.value);
    update();
  });

  const clear = h('button', { type: 'button', class: 'zx-btn', dataset: { size: 'sm' } }, 'Clear namespace');
  clear.addEventListener('click', () => {
    store.clear();
    note1.value = '';
    update();
  });
  update();

  return section('Storage',
    note('storage(namespace) is a namespaced, JSON-encoded view of localStorage (or '
      + "sessionStorage with { area: 'session' }). Every key is written as zx:<namespace>:<key>, so "
      + 'features share an origin without colliding and clear() only empties its own namespace. '
      + 'When the area is unavailable or refuses a write — private browsing, a full quota, cookies '
      + 'disabled — it silently falls back to an in-memory map, so callers never need a try/catch.'),
    code([
      "const store = storage('invoices');",
      "store.set('filter', { status: 'open', page: 1 });",
      "store.get('filter', {});   // the fallback covers a missing key AND unparseable JSON",
      'store.keys();              // namespace-relative names',
      'store.clear();             // this namespace only'
    ].join('\n')),
    row(field('store.set("note", …)', note1), clear),
    out
  );
}

/** @returns {HTMLElement} */
function exportHelpers() {
  const rows = [
    { id: 'INV-1001', customer: 'Acme, Inc.', total: 1240, due: new Date(2026, 7, 31), note: 'net 30' },
    { id: 'INV-1002', customer: 'Bö "Quoted" GmbH', total: 89.9, due: new Date(2026, 8, 15), note: 'first\nsecond' },
    // A leading '=' would be executed by a spreadsheet; toCsv() defuses it.
    { id: 'INV-1003', customer: '=cmd|calc', total: -50, due: null, note: null }
  ];
  const columns = [
    { id: 'id', label: 'Invoice' },
    { id: 'customer', label: 'Customer' },
    { id: 'total', label: 'Total' },
    { id: 'due', label: 'Due date' },
    { id: 'formatted', label: 'Formatted', value: (row) => formatCurrency(row.total, 'EUR', { locale: 'de' }) },
    { id: 'note', label: 'Note' }
  ];

  const delimiter = h('select', {}, [
    h('option', { value: ',' }, ', (comma)'),
    h('option', { value: ';' }, '; (semicolon — German Excel)')
  ]);
  const header = h('input', { type: 'checkbox', checked: true });
  const preview = output();
  const status = h('p', { style: {
    margin: '0', minBlockSize: '1.5em', color: 'var(--zx-color-text-muted)'
  } });

  /** @returns {string} */
  const csv = () => toCsv(rows, columns, { delimiter: delimiter.value, header: header.checked });
  const update = () => {
    // Tabs and CRLFs are invisible in a preview, so they are spelled out here.
    preview.textContent = csv()
      .replaceAll('\r\n', '⏎\n')
      .replaceAll('\t', '→');
  };
  delimiter.addEventListener('change', update);
  header.addEventListener('change', update);
  update();

  const download = h('button', { type: 'button', class: 'zx-btn', dataset: { kind: 'primary', size: 'sm' } }, 'Download CSV');
  download.addEventListener('click', () => {
    downloadBlob('invoices.csv', csv(), { type: 'text/csv;charset=utf-8' });
    status.textContent = 'downloadBlob() wrote invoices.csv — check your downloads.';
  });

  const copy = h('button', { type: 'button', class: 'zx-btn', dataset: { size: 'sm' } }, 'Copy to clipboard');
  copy.addEventListener('click', async () => {
    const ok = await copyToClipboard(csv());
    status.textContent = ok
      ? 'copyToClipboard() resolved true — paste it into a spreadsheet.'
      : 'copyToClipboard() resolved false — the browser blocked both paths.';
  });

  return section('Export & clipboard',
    note('toCsv() writes RFC 4180: fields containing the delimiter, a quote, CR, or LF are quoted '
      + 'with inner quotes doubled, Dates become ISO strings, and null and undefined become empty '
      + 'fields. Text starting with =, +, -, or @ is prefixed with a tab so a spreadsheet treats it '
      + 'as text instead of a formula — numbers are left alone, so negative amounts survive.'),
    code([
      "const csv = toCsv(rows, ['id', 'customer', { id: 'total', label: 'Total', value: (r) => r.total }]);",
      "downloadBlob('invoices.csv', csv, { type: 'text/csv;charset=utf-8' });",
      'await copyToClipboard(csv);'
    ].join('\n')),
    row(
      field('Delimiter', delimiter),
      field('Header row', header),
      download,
      copy
    ),
    status,
    note('Preview below with ⏎ marking the CRLF record separator and → the tab guard. The guard '
      + 'lands on the =cmd|calc cell and on the formatted "-50,00 €" text, while the numeric Total '
      + 'of -50 is left untouched — that is the text/number distinction in action. Switch the '
      + 'delimiter to ; and watch which fields stop needing quotes. downloadBlob() prepends a '
      + 'UTF-8 BOM for text/csv so Excel reads the umlauts correctly.'),
    preview
  );
}

/* --------------------------------------------------------------- small helpers -- */

/** @param {string} title @param {...Node} children @returns {HTMLElement} */
function section(title, ...children) {
  return h('section', { style: {
    display: 'grid', gap: 'var(--zx-space-4)', marginBlockEnd: 'var(--zx-space-6)',
    border: '1px solid var(--zx-color-border)', borderRadius: 'var(--zx-radius-lg)',
    background: 'var(--zx-color-bg-surface)', padding: 'var(--zx-space-5)'
  } }, h('h2', { style: { margin: '0', fontSize: 'var(--zx-text-xl)' } }, title), children);
}

/** @param {...Node} children @returns {HTMLElement} */
function row(...children) {
  return h('div', { style: {
    display: 'flex', flexWrap: 'wrap', alignItems: 'end', gap: 'var(--zx-space-4)'
  } }, children);
}

/** @param {string} label @param {HTMLElement} control @returns {HTMLElement} */
function field(label, control) {
  return h('label', { style: { display: 'grid', gap: 'var(--zx-space-1)' } },
    h('span', { style: { color: 'var(--zx-color-text-muted)', fontSize: 'var(--zx-text-sm)' } }, label),
    control);
}

/** @param {string} [text=''] @returns {HTMLElement} */
function output(text = '') {
  return h('pre', { style: {
    margin: '0', padding: 'var(--zx-space-4)', overflowX: 'auto',
    borderRadius: 'var(--zx-radius-md)', background: 'var(--zx-color-bg-muted)',
    fontFamily: 'var(--zx-font-mono)', fontSize: 'var(--zx-text-sm)', lineHeight: '1.7',
    whiteSpace: 'pre-wrap'
  } }, text);
}

/** @param {string} text @returns {HTMLElement} */
function code(text) {
  return output(text);
}

/** @param {string} text @returns {HTMLElement} */
function note(text) {
  return h('p', { style: {
    margin: '0', maxInlineSize: '78ch', color: 'var(--zx-color-text-muted)', lineHeight: '1.7'
  } }, text);
}
