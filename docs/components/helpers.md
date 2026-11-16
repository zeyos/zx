# Helper functions

The standalone function library that ships alongside the components: dates, formatting, escaping, small utilities, translation, and keyboard behaviours.

Full reference: https://zx.zeyos.com/docs/llms.md · Live demo: https://zx.zeyos.com/docs.html#components/helpers · All components: https://zx.zeyos.com/docs/components/index.md

Standalone exports with no DOM ownership and no lifecycle, importable individually from the same
entry point as the components. See also the Kernel section for `Component`, `h`, `icon`, and
`position` — the substrate the components themselves are built on.

- **Dates** — `formatDate(date, fmt, {locale})`, `parseDate(str, fmt)` (returns `null` when the
  string does not match, so it doubles as a validator), `clampDate(date, min, max)`,
  `isSameDay(a, b)`, `addDays(date, n)`, `addMonths(date, n)`, `getWeekStart(lang?)` → `0` (Sunday)
  or `1` (Monday). strftime-style tokens: `%d %m %Y %y %H %M %S %a %A %b %B %s`. Month and weekday
  names come from `Intl` in a supported explicit `locale`, then `getLanguage()`, then English.
  Regional English tags keep their own abbreviations and conventions. Explicit locale names take
  precedence over host date-name translations; without an explicit locale those translations apply.
  Short names use `Intl` unless a host supplies the corresponding short-name key.
- **Numbers, money and time** — `formatNumber(value, {locale, decimals, minDecimals, maxDecimals,
  group=true})`, `formatCurrency(value, currency, {locale, decimals})`, `formatPercent(value,
  {locale, decimals=0})` (takes a fraction, so `0.42` → `42%`), `formatFileSize(bytes, {locale,
  decimals=1, standard='iec'})` (`'iec'` → KiB/MiB/GiB in steps of 1024, `'si'` → kB/MB/GB in steps
  of 1000; `0` → `'0 B'`, trailing zeros dropped), `formatRelativeTime(date, {now=new Date(),
  locale, numeric='auto'})` (picks the largest sensible unit from second to year; accepts a `Date`,
  Unix seconds, or an ISO string). A supported explicit `locale` takes precedence over
  `getLanguage()`, then English, so `setLanguage()` drives all five when no usable option is given.
  Nothing throws: `null`, `undefined` and `NaN` all format as
  `''`, an invalid currency code falls back to plain number formatting, and every `Intl` instance
  is cached because tables call these once per cell.
- **Utilities** — `debounce(fn, ms)` (trailing edge, preserves `this`), `throttle(fn, ms,
  {leading=true, trailing=true})` (its rate-limiting counterpart: runs at most once per interval
  and replays the latest arguments on the trailing edge), `uid(prefix='zx')` (unique
  per page load, safe as a DOM id), `deepMerge(a, b)` (never mutates either input; replaces arrays
  rather than concatenating), `clamp(n, min, max)`, `toArray(value)` (null → `[]`, string → single
  entry, iterable/array-like → array), `isElement(value)` (cross-realm safe).
- **Collections** — `groupBy(items, key)` → `Record<string, T[]>` ordered by first appearance;
  `sortBy(items, ...keys)` returns a **new** array and never mutates its input, taking a property
  name, a `'-name'` prefix or a `{key, dir}` object for descending, or an accessor function,
  comparing digit runs numerically and always sorting `null`, `undefined` and `NaN` last in either
  direction; `uniqueBy(items, key?)` keeps the first occurrence.
- **Escaping** — `h()` rejects `innerHTML`, `outerHTML`, and `srcdoc` properties regardless of
  casing, and sanitizes `href` through `safeHref`. `htmlEscape(str)`, and `h.raw(html)` as the only
  sanctioned `innerHTML` path, for
  component-generated markup only. `escapeRegExp(value)` makes user input safe as a literal
  pattern, and `highlightMatch(text, query, {className='zx-mark'})` → `DocumentFragment` wraps
  every case-insensitive occurrence in a `<mark>` built from text nodes, with no `innerHTML`
  involved — the pairing every filtering list wants.
- **Storage** — `storage(namespace, {area='local'})` → `{get, set, remove, keys, clear, migrateLegacy}`, a
  namespaced JSON-encoded view of `localStorage` (or `sessionStorage` with `{area: 'session'}`).
  Keys are written as `zx2:<namespace length>:<namespace>:<key>` (UTF-16 string length), so names
  containing colons cannot overlap. `clear()` empties only its own namespace; `keys()` reports
  namespace-relative names. To retain values from the earlier `zx:` format, call
  `migrateLegacy(['known-key'])` before reading them. It copies only the exact keys you name, only
  when they contain valid JSON and the current key is absent, and returns the names copied.
  Legacy values are never deleted. Migration is recorded once per key, including missing keys;
  removing or clearing a migrated value does not restore it on the next load. Invalid legacy JSON
  remains retryable. Built-in persisted components migrate their own known keys automatically.
  `get(key, fallback)` returns the fallback both for a missing key and for unparseable JSON, and
  `set()` drops values JSON cannot represent rather than throwing. When the area is missing or
  refuses a write — private browsing, a full quota, cookies disabled — the view degrades silently
  to an in-memory map for the life of the page, so callers never need a `try`/`catch`.
- **Export** — `toCsv(rows, columns, {delimiter=',', header=true, newline='\r\n'})` serialises to
  RFC 4180: fields containing the delimiter, a quote, CR or LF are quoted with inner quotes
  doubled, `Date`s become ISO strings, `null`/`undefined` become empty fields, and text starting
  with `=`, `+`, `-` or `@` is prefixed with a tab so spreadsheets treat it as text rather than a
  formula (numbers are exempt, so negative amounts survive). `columns` accepts plain id strings or
  `{id, label, value(row)}` descriptors. `downloadBlob(filename, data, {type})` saves through a
  temporary object URL, prepending a UTF-8 BOM for `text/csv` so Excel reads it as UTF-8;
  `copyToClipboard(text)` → `Promise<boolean>` uses the async Clipboard API and falls back to a
  hidden textarea, never rejecting.
- **Translation** — `setTranslator(fn)`, `setLanguage(lang)`, `getLanguage()`,
  `translate(key, args)`, `printf(str, args)` (`%1`, `%2`, … placeholders), `defaultMessages`.
  Every component resolves its built-in strings through `msg()`, so one translator covers the
  library: per-instance `msg` option → `setTranslator()` function → the component's built-in
  defaults → the default English catalogue → the key. The translator answers one key at a time;
  null, undefined, or the key itself means "not translated" and English shows, so an application
  without a translator never sees a raw key. `defaultMessages` is that catalogue — copy it to
  start a locale (`setTranslator((key) => de[key])`), or install the German one below.
  `setLanguage()` also selects the language table of a `msg` option and drives locale-dependent
  behaviour such as the first day of the week and the month and weekday names `formatDate()` writes.
  `translatePlural(key, count, args, {locale}?)` and `component.msgPlural(key, count, ...args)`
  select cardinal forms using `Intl.PluralRules`. Pass the finite numeric count separately from
  display arguments: `translatePlural('items', 2, ['two'])`. At each message source, resolution
  tries `items.<category>`, `items.other`, then `items` (including a legacy alias). Instance overrides
  precede the host translator, inherited component messages, and English defaults. English fallback
  selects its category using English rules. Existing unsuffixed overrides remain valid.
- **Keyboard** — `focusTrap(container)` → `{activate, deactivate}` confines Tab to a container;
  an empty trap focuses its boundary, temporarily adding `tabindex="-1"` when needed and removing
  it on deactivation. Deactivation restores the previous focus when it is still connected.
  `rovingTabindex(container, itemSelector, {orientation, wrap, rtl: 'auto'})` → `{focusFirst,
  focusLast, destroy}` keeps one tab stop in a group — horizontal arrows follow `dir="rtl"`, and a
  text field, select, or contenteditable item keeps Home/End and its arrows (an arrow leaves a text
  field only from the edge of its text); toggling a `<fieldset disabled>` around items inside the
  container moves the tab stop off them. Removed items regain their original tabindex and are
  released; reinserted items use their new baseline. `typeahead(getItems, onMatch)` →
  `(event|string) => void` resolves buffered printable keystrokes to an item (500 ms buffer,
  repeated-letter cycling).

## Locales

[Open the Locales guide](https://zx.zeyos.com/docs.html#getting-started/locales).

Its [live language-switching example](https://zx.zeyos.com/docs.html#getting-started/locales/try-language-switching)
offers English, German, and an application-owned French catalogue. Edit the name, record, and
count to try positional/named variables, plural forms, and number formatting. Switching preserves
the input values and recreates the translated Select. French intentionally omits `table.empty`
to demonstrate English fallback. The embedded example has its own language state, and its running
source and catalogues are available under Code.

### Language, locale, and catalogue

Zx ships English and German interface messages. Other languages can be supplied by the application.
Locale tags such as `en-GB`, `de-AT`, and `fr-CA` describe language and regional conventions; adding a
tag to a picker does not install a translation.

- `setTranslator(fn)` supplies the words. The function receives a flat message key and returns its text.
- `setLanguage(tag)` selects the active language for plural rules, default formatting, and language-specific `msg` tables. It does not load a catalogue or change the page's HTML `lang` attribute.
- `locale` selects formatting on helpers and components that expose this option. It does not select translated interface messages.
- `displayLocale` controls the names shown by Select.locale() and Select.country(), independently of their selected value.
- `msg` overrides messages for one component. Application labels, record values, and server text remain application-owned.

### Enable a shipped language

Install the catalogue and language before creating components:

```js
import { setLanguage, setTranslator } from '@zeyos/zx';
import { de } from '@zeyos/zx/locales/de.js';

setTranslator((key) => de[key]);
setLanguage('de-AT');
document.documentElement.lang = 'de-AT';
```

This uses German messages with Austrian formatting conventions. `setTranslator(null)` restores
English message fallback; call `setLanguage('en')` as well to return formatting to English.
`en` from `@zeyos/zx/locales/en.js` is the frozen `defaultMessages` object. The optional
`@zeyos/zx/locales/index.js` exports `en`, `de`, and the frozen `locales` manifest. Importing that
manifest includes both catalogues; the main entry does not load German automatically.

### Add a new language

Create an application-owned module, for example `app/locales/fr.js`, served at `/app/locales/fr.js`.
This intentionally partial example translates two Select messages:

```js
export const fr = Object.freeze({
  'select.none': 'Aucune sélection',
  'select.empty': 'Aucun résultat'
});
```

```js
import { setLanguage, setTranslator } from '@zeyos/zx';
import { fr } from '/app/locales/fr.js';

setTranslator((key) => fr[key]);
setLanguage('fr-FR');
document.documentElement.lang = 'fr-FR';
```

Use `defaultMessages` as the inventory of built-in keys to translate. Keep their placeholders,
including each plural form's placeholders, and test the controls and accessible labels that your
application uses. A partial catalogue should return `undefined` for untranslated keys so Zx can
apply its English fallback with English plural rules. Do not fill a partial non-English catalogue
by spreading `defaultMessages` into it. `null` and an echoed key also mean “no translation”; an
empty string is an intentional empty translation.

Application catalogues need no change to Zx or its shipped manifest. Keep a registry of the languages
your application actually supports, and pass those tags to Select.locale().

### Regional variants and catalogue lookup

The application chooses how a regional tag maps to a catalogue. Zx does not automatically search
`de-AT`, then `de`, inside your translator. Reuse a language catalogue, or create regional overrides:

```js
import { setLanguage, setTranslator } from '@zeyos/zx';
import { en, de } from '@zeyos/zx/locales/index.js';

const deAT = Object.freeze({ ...de, 'table.empty': 'Keine Einträge' });
const catalogues = { en, de, 'de-AT': deAT };

function applyLocale(tag) {
  const locale = Intl.getCanonicalLocales(tag)[0];
  const language = new Intl.Locale(locale).language;
  const catalogue = catalogues[locale] ?? catalogues[language];
  setTranslator(catalogue ? (key) => catalogue[key] : null);
  setLanguage(locale);
  document.documentElement.lang = locale;
}

applyLocale('de-AT');
```

Here `en-GB` reuses English messages, while `de-AT` keeps its regional override. This function expects
a valid BCP 47 tag; picker values are already canonical. General locale APIs use hyphenated tags.

### Message keys and interpolation variables

Use flat string keys for your own messages. A dotted key is a name, not a nested object path.
Positional placeholders are `%1`, `%2`, and so on; named placeholders use `%name%`:

```js
import { setLanguage, setTranslator, translate } from '@zeyos/zx';
import { de } from '@zeyos/zx/locales/de.js';

const messages = Object.freeze({
  ...de,
  'app.welcome': 'Willkommen, %1!',
  'app.assigned': '%person% bearbeitet %record%.'
});
setTranslator((key) => messages[key]);
setLanguage('de');

translate('app.welcome', ['Ada']);
translate('app.assigned', { person: 'Ada', record: 'INV-42' });
```

`component.msg(key, ...args)` takes positional arguments. For a named template, use
`translate(key, values)` or `printf(component.msg(key), values)`. Interpolation produces plain text;
render it with text nodes or `textContent`.

For a single component, pass `msg: { 'select.empty': 'Nothing found here' }`. Resolution is instance
messages, host translator, inherited component messages, English catalogue, then the key.
Language-specific tables such as `msg: { de: { 'select.empty': 'Nichts gefunden' } }` match the exact
active language identifier; provide a `de-AT` table or a flat entry when that is the active tag.

### Plural forms

Pass a numeric count separately from its displayed text. The selected cardinal category comes
from `Intl.PluralRules`; messages remain flat strings:

```js
import { formatNumber, setLanguage, setTranslator, translatePlural } from '@zeyos/zx';
import { de } from '@zeyos/zx/locales/de.js';

const messages = Object.freeze({
  ...de,
  'app.results.one': '%1 Ergebnis',
  'app.results.other': '%1 Ergebnisse'
});
setTranslator((key) => messages[key]);
setLanguage('de');

const count = 1200;
translatePlural('app.results', count, [formatNumber(count)]);
```

Use `component.msgPlural(key, count, ...args)` inside a component. Supply `.other` and the categories
your language needs: `.zero`, `.one`, `.two`, `.few`, and `.many` are supported too. At each message
source, lookup tries the selected category, `.other`, then the unsuffixed key and any supported legacy
alias before moving to the next source. Existing flat overrides therefore keep their precedence.
English fallback uses English rules. Custom application keys need their own fallback text; they are
not part of the built-in English catalogue. Ordinary `translate()` and `msg()` never infer a count.

### Formatting and date-name overrides

Formatting uses a supported explicit locale, then the active language, then English. Support is
checked for the particular Intl service, since a language may support numbers but not plural rules.
Regional English tags retain their own conventions.

```js
import { formatCurrency, formatDate, formatNumber } from '@zeyos/zx';

formatNumber(1234.5, { locale: 'en-GB', decimals: 2 });
formatCurrency(1234.5, 'EUR', { locale: 'de-AT' });
formatDate(new Date(2026, 8, 1), '%b', { locale: 'en-GB' });
```

Components with a `locale` option can use the same override. For NumberField, locale-aware display
and parsing apply with `group: true`; ungrouped fields retain their machine-format input behavior.
Currency, time zone, week start, and display patterns are separate settings where the API exposes
them; a locale tag alone does not choose them all.

`formatDate()` normally obtains month and weekday names from Intl. A host translator can override
`date.month.0` through `date.month.11` and `date.weekday.0` through `date.weekday.6` (Sunday is zero).
Use `date.month.short.0` and `date.weekday.short.0` for their short forms. Missing short names come
from Intl, not a shortened translated long name. These overrides apply when no explicit locale is
passed; an explicit `formatDate(..., { locale })` takes precedence. `locale: null` remains implicit.

### Use the Select-based pickers

Select.locale() and Select.country() return ordinary Select instances. They keep its popup, keyboard map, events, field
adapter, and `.zx-select` styling, adding item generation, names, flags, and value normalization.
A locale selection emits `change`; it does not install translations or change the application language.

Using `applyLocale()` from the regional-lookup example:

```js
import { getLanguage, Select } from '@zeyos/zx';

const picker = Select.locale(null, {
  locales: ['en-GB', 'de-DE', 'de-AT'],
  value: getLanguage(),
  displayLocale: 'en-GB',
  flags: 'code',
  filter: 'local'
});
picker.on('change', ({ detail }) => {
  if (detail.value) applyLocale(detail.value);
});
document.querySelector('#language').append(picker.toElement());
```

`displayLocale` changes the language names shown, while the selected value stays a locale tag.
Select.locale() filters automatically for lists longer than seven; `filter: 'local'` also enables
search for short lists. For a form, use the existing Select field preset:

```js
import { Field } from '@zeyos/zx';

const languageField = new Field(null, {
  type: 'zxselect',
  name: 'language',
  label: 'Language',
  value: 'de-AT',
  props: { preset: 'locale', locales: ['en-GB', 'de-AT'], flags: 'code' }
});
```

Use `props.preset: 'country'` for the country factory. Preset names are Field adapter options;
for direct construction call `Select.locale()` or `Select.country()`.

### Switching language at runtime

Set the translator and active language together, then refresh your application UI. Zx does not
broadcast a language-change event or automatically relabel every mounted component. Preserve the
application's values, destroy affected instances, and recreate them with the new messages; merely
changing the picker value does not do this. Use each component's documented update methods where
they cover the text being changed, rather than calling its internal `render()` method.

Set the document or region's HTML `lang` for pronunciation, and set `dir="rtl"` when your application
selects a right-to-left language. Zx does not infer text direction from `setLanguage()`. Verify visible
labels, accessible names, plural counts, date/number entry, and layout after a switch.

### German catalogue glossary

- **Voice** — a business application. The reader is addressed formally ("Sie"), and preferably not
  at all ("Änderungen speichern"). Buttons and menu items use the infinitive ("Speichern",
  "Abbrechen").
- **Typography** — quotation marks „…“; the ellipsis character attached to its word ("Wird
  geladen…"); a non-breaking space between a number and its unit ("Letzte 30 Tage").
- **Kept as they are** — Agent, Board, Code, Swimlanes, Tags, Token, Tool, Upload; also Dashboard,
  Prompt, and Tab where a key needs them. A work-in-progress limit is a WIP-Limit.
- **Agents** — approve → genehmigen, approval → Genehmigung, reject → ablehnen, request → Anfrage,
  run → Ausführung, working time → Laufzeit, step → Schritt, tool call → Tool-Aufruf, retry →
  Wiederholung, stop → stoppen, conversation → Unterhaltung, source → Quelle, attachment → Anhang.
- **Records** — record → Datensatz, field → Feld, row → Zeile, column → Spalte, view → Ansicht,
  group by → gruppieren nach, no records → Keine Datensätze.
- **Dates** — event → Termin, date range and period → Zeitraum, week number → Kalenderwoche.
- **Actions** — choose and select → auswählen, clear → zurücksetzen (a selection: aufheben), search
  → suchen, or durchsuchen with an object, expand → ausklappen, collapse → einklappen, hide →
  ausblenden, remove → entfernen, no matches → Keine Treffer, no results → Keine Ergebnisse.
- **Parts of the interface** — message → Nachricht in a conversation and Meldung in a notice,
  launcher → Schnellsuche, workspace → Arbeitsbereich, panel → Bereich, sheet → Seitenbereich,
  breadcrumb → Pfadnavigation.
- **Keys** — arrow keys → Pfeiltasten, Space → Leertaste, Enter → Eingabetaste, Escape → Esc, Ctrl →
  Strg, Delete → Entf.
