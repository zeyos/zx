# Xenon Design System (Zx) — agent reference

> Xenon is a dependency-free design system for browser applications; Zx is its product-agnostic
> vanilla-JavaScript implementation. ES2022 modules, WAI-ARIA-accessible native controls, semantic `--zx-*` design
> tokens (light/dark + cozy/compact), and lifecycle-safe components. Zero runtime dependencies.
> This file is the single, complete reference a coding agent needs to build UI with Zx; each
> component below is wrapped in `<!-- doc:<name> -->` markers so tools can extract a single
> component's section (`website/docs.html` renders them as each component's Reference tab).

## Mental model

Every visual component is an ES class extending `Component`, instantiated identically:

```js
import { Table, Dialog, Toggle } from '/assets/zx.esm.js'; // or window.zx.* from zx.global.js
const t = new Table(target, options);
```

- **`target`** — an `Element`, a selector string, or `null`. `null` means the component creates and
  **owns** its root element; retrieve it with `t.toElement()` (or `t.el`) and insert it. A non-null
  target is *enhanced in place* and restored on `destroy()`.
- **Options** — a plain object; each component declares `static defaults`. Never mutate the passed
  object.
- **Value/data** — set via constructor options and mutated via methods (`set`, `setData`, …);
  read via getters/methods (`.value`, `getValues()`, …).

## Events & lifecycle

- Subscribe with `t.on('change', fn)` (alias `addEvent`), `t.once(...)`, or an `on<type>` function
  **option** (`onchange`, `onrowclick`, …). Handlers receive a `CustomEvent`; read `event.detail`
  (always an object, e.g. `{ value, item }`).
- Every `emit` also dispatches a **bubbling, composed** `zx-<type>` `CustomEvent` on `t.el`, so
  `t.el.addEventListener('zx-change', …)` and event delegation work.
- `t.destroy()` aborts all listeners (one AbortController), unregisters the element, and removes an
  owned root. `Component.from(el)` returns the component for a root element (replaces the legacy
  `el.retrieve('com')`).

## Entry points

- ESM: `import { … } from '/assets/zx.esm.js'` (or `../src/index.js` in-repo, no build).
- Granular: `import { Slider } from '@zeyos/zx/src/components/slider/slider.js'` — one component
  rather than the whole library, for consumers running a bundler. Two components bundle 26 kB
  minified against 157 kB through the package entry. The stylesheet is still loaded whole.
- Global: `<script src="/assets/zx.global.js">` → `window.zx.*`.
- Styles: load `/assets/zx.css` once.
- Build bundles with `npm run build` (esbuild). No build is needed to develop against `src/`.

## Theming

Load `zx.css`, then set theme/density on any ancestor (usually `<html>`):

```html
<html data-zx-theme="dark" data-zx-density="compact">
```

Themes: `light` | `dark` | `auto` (follows OS). Density: `cozy` | `compact`.

**Accent presets.** A second, orthogonal attribute picks the accent ramp:
`data-zx-preset="zx" | "zeyos" | "ocean" | "violet" | "rose" | "slate"` (`zx` is the default and
need not be set). A preset repoints five tier-1 tokens — `--zx-accent-300` … `--zx-accent-700` —
and the semantic tier takes its own stop per polarity (600/700 on light surfaces, 300/400/500 on
dark), so one five-line block rethemes light, dark, and auto together. Status colours are not part
of a preset. Define your own the same way, or build one at `/theme.html` (the theme studio, which
renders every component family live and exports the CSS):

```css
:root {
  --zx-accent-300: #c4b4ff; --zx-accent-400: #a684ff; --zx-accent-500: #8e51ff;
  --zx-accent-600: #7f22fe; --zx-accent-700: #7008e7;
}
```

Keep the 600 stop at 4.5:1 or better against white and the 400 stop at 4.5:1 against the dark page
— that is what makes `--zx-color-on-accent` legible without being restated per theme.

Define a product theme by overriding **semantic** tokens under a `[data-zx-theme="name"]` selector:
`--zx-color-bg-page/surface/raised/control/hover/selected`, `--zx-color-border(-strong/-control)`,
`--zx-color-text(-muted/-placeholder)`, `--zx-color-accent(-hover)/on-accent`,
`--zx-color-danger/warning/success/info(+ -bg)`, `--zx-focus-ring`, `--zx-control-height/-radius`,
`--zx-space-*`, `--zx-radius-*`, `--zx-text-*`. Never use tier-1 palette tokens (`--zx-gray-*`,
`--zx-green-*`) or raw color literals in application/component CSS. Prefer the least-specific
override that works (global token → then, if needed, a component style).

## Talking to ZeyOS — use `@zeyos/client`

For ZeyOS business data use the **dedicated client library** `@zeyos/client`
(`npm install @zeyos/client`) — a zero-dependency, typed OpenAPI client (accounts,
transactions/invoices, tickets, 50+ resources), OAuth2/session auth, retries, and schema
introspection. Zx accepts the client by injection and does not bundle it.

```js
import { createZeyosClient, MemoryTokenStore, normalizeListResult } from '@zeyos/client';
const zeyos = createZeyosClient({
  platform: 'https://cloud.zeyos.com/<instance>/',
  auth: { mode: 'oauth', oauth: { tokenStore: new MemoryTokenStore({ accessToken }) } }
});
const { data } = normalizeListResult(await zeyos.api.listTransactions({ filters: { visibility: 0 }, limit: 50 }));
await zeyos.api.updateTransaction({ ID, status: 9 });
```

Feed results straight into Zx components (Table `data`, Select `items`, Form values). See the
`website/layouts/zeyos-invoices.layout.js` layout for the reference integration. Zx also ships a minimal `Http` /
`zeyosService(service, accesskey)` for ad-hoc `remotecall`, but `@zeyos/client` is the default.

<!-- doc:zeyos -->
## ZeyOS binding (zx-zeyos)

`zx-zeyos` is the optional schema-driven layer above `@zeyos/client`: inject a client instance and
declare a resource to generate typed Zx controls. It is a separate ESM entry at
`dist/zx-zeyos.esm.js` (or `src/zeyos/index.js` during no-build development) and is deliberately
not re-exported from `src/index.js`. The binding has zero runtime dependencies and never imports or
bundles `@zeyos/client`; the application owns client creation, authentication, and transport.

```js
import { createZeyosClient } from '@zeyos/client';
import {
  connect, dataFilterStateToFilters, zeyosForm, zeyosSelect, zeyosTable
} from '/assets/zx-zeyos.esm.js';

const client = createZeyosClient({ platform, auth });
const api = connect(client, { locale: 'en-GB' });

const list = zeyosTable(client, 'transactions', {
  fields: ['transactionnum', 'account', 'date', 'netamount', 'status'],
  sort: { id: 'date', dir: 'desc' },
  selectable: 'multi'
});
await list.load();

const editor = zeyosForm(client, 'transactions', {
  fields: ['transactionnum', 'account', 'date', 'netamount', 'status'],
  onSaved: () => list.load()
});
await editor.load(transactionId);
await editor.save();
```

- `connect(client, { onError, locale })` returns `{client, list, get, create, update, reportError}`;
  generated forms/tables use the same operation discovery and default `Message.error` reporting.
- `zeyosSelect(client, resource, opts)` returns an async Zx `Select`. Options include `fields`,
  `labelKey`, `valueKey`, `searchFields`, `filters`, `limit`, and normal Select options. Its list
  operation receives a query built by `buildListQuery`.
- `zeyosForm(client, resource, opts)` returns
  `{form, ready, load(id), save(), getForm(), destroy()}`. `fields` is an ordered allow-list;
  `exclude`, `labels`, `title`, `columns`, `value|id`, and `onSaved` curate behavior. `load` maps
  stored timestamps to `Date`; `save` validates and creates/updates, maps back to Unix seconds,
  calls `onSaved`, and shows a success toast.
- `zeyosTable(client, resource, opts)` returns
  `{table, load(), setSearch(), setFilters(), loadMore(), count, page, hasMore, destroy()}`. Columns
  come from schema metadata, sorting uses `sortMode:'server'`, and page zero replaces rows while
  later pages append them using server `limit`/`offset` and `count`.

Field mapping is schema-driven: entity/FK → async `zxselect`; enum/list → `optionlist` or native
`select`; indexed `date` bigint → `date`; other date/time bigints → `datetime`; money/price/numeric
→ right-aligned `float`/number columns (amount columns use the row currency); boolean/checked →
`toggle` and a check column; percent/progress → numeric percent; email/tel/url → typed text; arrays
→ `valuelist`; long text/JSON → `textarea`; short scalar text → `text`.

ZeyOS queries always use `filters` (plural), not `filter`. Full-text input becomes `query`; sort is
sent as signed server fields (`+field`/`-field`); projection supports aliases and dot joins; and
search/filter/sort/pagination remain server-side. ZeyOS timestamps are integer Unix seconds, so
forms convert them to/from `Date`. Use `dataFilterStateToFilters(state, defs)` before
`tableBinding.setFilters(...)` when wiring a `DataFilter`.

### Module icons and colours

`src/zeyos/modules.js` is the configuration file for module identity — one entry per ZeyOS module,
holding the icon and the colour it is drawn in:

```js
notes: { label: 'Notes', icon: 'zeyos-notes', color: '#008853', fa: 'note-sticky' }
```

`icon` is the glyph's name in the ZeyOS Font Awesome kit (61 custom `zeyos-*` icons, rendered as
`<i class="fa-kit fa-zeyos-notes">`); `fa` is a stock Font Awesome fallback that also exists in
Font Awesome Free. Colours are the ZeyOS runtime palette (`ICO.Colors`) where ZeyOS defines one and
Zx defaults elsewhere; they are also emitted as `--zx-module-*` CSS custom properties, generated
from this file by `tools/build-module-tokens.js` and checked by the unit tests.

```js
import { moduleChip, moduleColor, registerModules, useZeyosIcons } from '/assets/zx-zeyos.esm.js';

await useZeyosIcons();                          // loads ZEYOS_ICON_KIT, switches Zx to Font Awesome
nav.append(moduleChip('tickets', { size: 24, title: true }));   // glyph on the module colour
moduleColor('invoices');                        // '#535494' — aliases resolve to their module
registerModules({ tickets: '#f04639', 'my-fork': { label: 'My Fork', icon: 'zeyos-weblets' } });
```

- `moduleIcon(name, {size, label, standard})` → the bare glyph; `standard: true` uses the stock
  Font Awesome fallback, for pages on a kit without the ZeyOS uploads.
- `moduleChip(name, {size, iconSize, label, title, standard})` → `<span class="zx-module-icon">`
  with the glyph on the module colour. The glyph colour is whichever of ZeyOS's two foregrounds
  (`#ffffff`, `#141414`) contrasts better, via `moduleGlyphColor(hex)`.
- `moduleInfo`/`moduleColor`/`moduleIconName`/`moduleKeys`/`normalizeModuleName` read the config.
  Module, entity, and API resource names are all accepted, case-insensitively, with dots and
  underscores normalized: `'transactions.billing'`, `'invoices'`, and `'Transactions Billing'` all
  land on `transactions-billing`. Unknown names fall back to the `default` module — lookups never
  throw.
- `registerModules(map)` adds forks and weblets or overrides shipped entries (a bare string sets
  the colour only). Runtime ZeyOS menu data is authoritative: feed its colours in at startup.
<!-- /doc -->

## Custom elements

`defineElements()` (not auto-called) registers light-DOM `<zx-*>` wrappers with attribute↔option
reflection and ElementInternals form association: `<zx-toggle>`, `<zx-check-button>`, `<zx-select>`,
`<zx-checklist>`, `<zx-datebox>`, `<zx-timebox>`, `<zx-search>`, `<zx-groupbox>`, `<zx-tabbox>`,
`<zx-table>`, `<zx-dialog>`.

## Conventions (editing component source)

Follow `AGENTS.md`. Key rules: never declare instance class fields for state used in `render()`
(render runs inside the base constructor before field initializers); route all DOM listeners
through `this.listen()`; no `innerHTML` outside `h.raw()`; express state via ARIA/`data-*`, not
state classes; small glyph buttons use the shared `.zx-icon-btn` utility; follow the named APG
pattern with `:focus-visible` rings and `prefers-reduced-motion` guards.

## File map & commands

```
src/components/<name>/   component + CSS      src/core/   kernel (component, dom, http, i18n, date…)
website/                 marketing page + docs.html (docs.js)          specs/  per-component specs
website/demos/           per-component demo modules    website/layouts/  application layout examples
tests/                   node unit + smoke    dist/       built bundles

npm run serve   # http://127.0.0.1:8321/website/docs.html  (no build)
npm test        # node --test tests/unit/*.test.js  +  node tests/lint-tokens.js
npm run build   # dist/: ESM, global, ZeyOS binding, and CSS assets
node tools/build-module-tokens.js   # regenerate styles/tokens/modules.css from src/zeyos/modules.js
```

---

# Components

Each component is `new Component(target, options)`. Events are the component-level names (also
dispatched as bubbling `zx-<name>` on the root). Detail is always an object.

<!-- doc:button -->
### Button — `button(options)` / `buttonGroup(buttons)`

Factories (not classes) returning elements, used both standalone and as the
`buttons: [{ label, kind, action|onclick }]` descriptors Dialog, Modal, Panel, and MasterPanel
accept.

- **`button(options)`** → `HTMLButtonElement`. Options: `label`, `icon` (an icon name), `kind:
  'default'|'primary'|'danger'|'ghost'`, `size: 'md'|'sm'`, `disabled`, `title`, `onclick`.
- **`buttonGroup([button(…), …])`** → a container that joins the buttons into one control.
<!-- /doc -->

<!-- doc:badge -->
### Badge — `badge(options)` / `badgeGroup(badges)`

Factories (not classes) returning a status pill: a small, non-interactive `<span>` carrying a
semantic colour, used for stages, counts, tags, and record-header metadata. A badge with no label
but a `title` is named for assistive technology through `role="img"`; everything else is plain text
and needs no ARIA.

- **Options** — `label`, `icon` (an icon name, rendered before the label), `kind:
  'neutral'|'accent'|'success'|'warning'|'danger'|'info'`, `variant: 'soft'|'solid'|'outline'`,
  `size: 'md'|'sm'`, `dot` (a leading status dot instead of an icon), `title`.
- **Methods** — none. `badge(options)` → `HTMLSpanElement`, `badgeGroup([badge(…), …])` → a wrapping
  inline row with its own spacing; you own both elements.
- **Events** — none; a badge is not interactive.
<!-- /doc -->

<!-- doc:toolbar -->
### Toolbar — APG toolbar

A single non-wrapping row of controls that is one tab stop: arrows move between the controls, and
what no longer fits collapses into a trailing overflow menu. Items are `button()` descriptors,
ready-made Elements, or `'-'` for a separator; a `ResizeObserver` remeasures the row, hides the
items that overflow — removing them from the tab order and the roving group — and mirrors them into
a `MenuButton`, where choosing one activates the original control.

- **Options** — `items: [Element | '-' | {name, label, icon, kind, size, disabled, title, active,
  onclick}]`, `align: 'start'|'end'|'between'`, `label` (accessible name, default `'Toolbar'`),
  `overflow` (default `true`), `overflowLabel` (default `'More'`), `dense`. `active` renders the
  item as a pressed toggle (`aria-pressed`).
- **Methods** — `setItems()`, `getItem(name)`, `enable(name)`, `disable(name)`,
  `setActive(name, active?)`, `destroy()`.
- **Events** — `action {name, item}`, emitted for descriptor-built items in addition to their own
  `onclick`, from the row and from the overflow menu alike.
- **Keyboard** — Tab reaches the toolbar once; ArrowLeft/ArrowRight move between controls and wrap;
  Home/End jump to the first and last control.
<!-- /doc -->

<!-- doc:empty-state -->
### EmptyState — `emptyState(options)`

A factory (not a class) returning the placeholder shown where a list, table, or panel has no content
yet: an optional decorative icon, a headline, a sentence, and optional actions. The headline is a
paragraph rather than a heading, so dropping one into a Table's empty slot or a Panel body never
disturbs the page's heading outline.

- **Options** — `icon` (an icon name, `null` for none; default `'folder-open'`), `title`,
  `description`, `actions: [Element | buttonOptions]`, `size: 'md'|'sm'`, `align: 'center'|'start'`.
- **Methods** — none. `emptyState(options)` → `HTMLDivElement`, which you own and place yourself.
- **Events** — none; action buttons carry their own `onclick`.
<!-- /doc -->

<!-- doc:loading -->
### Spinner / ProgressBar / InlineLoading

Three shapes of "wait". A **spinner** when the duration is unknown and there is nothing to say
about progress; a **progress bar** when the completed share is known; **inline loading** when the
wait resolves into its own outcome in the place it started. `spinner()` is a factory returning an
element — there is no state to update and nothing to destroy — while the other two are components.

#### spinner()

- **Signature** — `spinner({size, label, showLabel, kind})` → `HTMLSpanElement`.
- **Options** — `size: 'sm'|'md'|'lg'` (16px, 24px, 40px), `label: ''`, `showLabel: false`,
  `kind: 'accent'|'current'` — `current` draws the ring in `currentColor`, which is what a ring
  inside a button or a badge needs.
- **Accessibility** — a `label` makes the element `role="status"` and keeps the text in the
  accessibility tree even when `showLabel` is false; without a label the ring is `aria-hidden`,
  which is correct whenever a nearby element already announces the wait.

#### ProgressBar

- **Options** — `value: 0`, `max: 100`, `label: ''`, `helperText: ''`,
  `status: 'active'|'success'|'error'`, `indeterminate: false`, `size: 'md'|'sm'`,
  `hideLabel: false`, `showValue: true`, `formatValue: (value, max) => string`.
- **Methods** — `get()`, `set(value, {silent})` (clamped to `[0, max]`), `percent()`, `setMax()`,
  `setStatus(status, helperText?)`, `setLabel()`, `setHelperText()`, `setIndeterminate(flag)`.
- **Events** — `change {value, percent}`, `complete {value}` once the value reaches `max`.
- **Behaviour** — `status` is a display concern only: a run that failed at 100% still reads 100%.
  An indeterminate bar drops `aria-valuenow` rather than reporting a number it does not have, and
  under reduced motion its travelling band becomes a static muted track — visibly busy, never a
  wrong number.
- **Accessibility** — the track is `role="progressbar"` with `aria-valuemin`, `aria-valuemax`,
  `aria-valuenow`, and `aria-valuetext`, labelled by the visible label (kept for assistive
  technology when `hideLabel` is set).

#### InlineLoading

- **Options** — `status: 'inactive'|'active'|'success'|'error'`, `description: ''`,
  `size: 'sm'|'md'`, `live: true`.
- **Methods** — `get()`, `getDescription()`, `set(status, description?, {silent})`,
  `setDescription()`.
- **Events** — `statuschange {status, description}`.
- **Accessibility** — the whole element is one polite live region (`role="status"`), so the
  outcome is announced without the focus moving off the control that started the work. Use
  `Message` instead when the outcome deserves a dismissible notification rather than a line of
  text that stays put.
<!-- /doc -->

<!-- doc:skeleton -->
### Skeleton

Placeholders shaped like the content that is coming, so the layout does not jump when it arrives.
That is the whole reason to prefer them over a spinner, and the reason they only pay off where the
shape is genuinely known. All three are factories returning elements.

- **Factories** — `skeleton({width, height, radius})` → one block; `skeletonText({lines, width,
  heading, lastLineWidth})` → a stack of lines; `skeletonTable({rows, columns, header})` → the
  grid a table will fill.
- **skeleton options** — `width: '100%'`, `height: '1rem'` (a number is read as pixels),
  `radius: 'sm'|'md'|'full'`. Equal sides plus `radius: 'full'` gives the circle an avatar or icon
  placeholder needs.
- **skeletonText options** — `lines: 3` (1–20), `width: '100%'`, `heading: false` (draws the first
  line taller), `lastLineWidth: '60%'` — the short final line is what makes the block read as
  prose rather than as a filled rectangle.
- **skeletonTable options** — `rows: 5` (1–50), `columns: 4` (1–20), `header: true`. Rendered as
  plain elements, not a `<table>`: there is no data to expose, and a table whose cells are all
  empty is worse for assistive technology than no table at all.
- **Accessibility** — every skeleton is `aria-hidden`, because a screen reader gains nothing from
  an announced grey box. Set `aria-busy="true"` on the region being filled and remove it together
  with the placeholder.
- **Behaviour** — the pulse is wrapped in `prefers-reduced-motion: no-preference`; without motion
  a legible static block stays behind.
<!-- /doc -->

<!-- doc:check-button -->
### CheckButton

Two-state pressed button on a native `<button aria-pressed>`. The check indicator has a glyph in
both states — an empty box when off, a check when on — so an unpressed or disabled button still
reads as a two-state control.

- **Options** — `label: '' | [onLabel, offLabel]`, `checked: false`, `icon: true`,
  `disabled: false`.
- **Methods** — `get()`, `set(checked, {silent})`, `toggle()`, `setLabel()`, `enable()`/`disable()`.
- **Events** — `change {checked}`, fired only on a real state change.
- **Keyboard** — Space/Enter.
<!-- /doc -->

<!-- doc:toggle -->
### Toggle

Switch (`role="switch"`, `aria-checked`).

- **Options** — `checked: false`, `value: true`, `label: null`, `disabled: false`.
- **Methods** — `get()`, `set(checked, {silent})`, `toggle()`, `getValue()` (returns
  `options.value` when on, `false` when off), `enable()`/`disable()`.
- **Events** — `change {checked, value}`.
- **Keyboard** — Space/Enter.
<!-- /doc -->

<!-- doc:search -->
### Search

Search input with embedded search and clear buttons (`role="search"`).

- **Options** — `placeholder`, `value`, `clearable: true`, `debounce: 250`.
- **Methods** — `get()`, `set(value, {silent})`, `focus()`, `clear()`.
- **Events** — `input {value}` (debounced), `submit {value}` (Enter or the button), `clear`.
<!-- /doc -->

<!-- doc:launcher -->
### Launcher — application and record search

A native-dialog launcher for applications, recent records, commands, and grouped remote results.
Zx owns ranking, focus, request cancellation, and presentation; ZeyOS owns the catalogue,
permissions, recent-history/cache policy, and the route or command ultimately invoked.

- **Constructor** — `new Launcher(null, options)` owns a body-level dialog;
  `new Launcher(existingDialog, options)` enhances and later restores an existing `<dialog>`.
- **Options** — `items`, abortable `sources: [{id, label?, minQuery?, when?, order?, load(query, {signal})}]`,
  `query`, `debounce: 250`, `minQuery: 0`, `maxResults: 100`, `placeholder`, `label`, `emptyText`,
  `loadingText`, `shortcut: 'mod+k'|false`, and visible `hints` labels (or `false`).
- **Items** — `{id, label, description?, keywords?, group?, icon?, badge?, value?, href?, target?,
  invoke?, pinned?, disabled?, kind?, current?, when?, groupOrder?, itemOrder?}`. `icon` accepts a
  bundled icon name, Node, or factory. Links stay native so modified and middle clicks work;
  non-link commands may provide an application-owned `invoke` callback. Malformed and executable
  URL schemes are stripped; a descriptor with no safe link or callback is disabled.
- **Methods** — `open()`, `close()`, `toggle()`, `isOpen()`, `focus()`, `setQuery()`, `getQuery()`,
  `setItems()`, `setCurrent()`, `setSources()`, `destroy()`.
- **Events** — cancelable `select {item, value, source, query}`, `query {query}`, `open`, `close`,
  and `error {source, error}`. Preventing `select` suppresses the supplied link or callback.
- **Ranking** — local results are case/diacritic-insensitive and deterministic: exact label,
  label prefix, word prefix, label substring, identifier substring, then acronym prefix. Pinned
  items retain an explicit order ahead of otherwise equal results. A new async query aborts and
  ignores stale source work.
- **Keyboard** — Cmd+K on macOS or Ctrl+K elsewhere opens by default; the shortcut is ignored in
  editable controls, composition, and modal contexts. Application tiles use spatial arrow-key
  movement; Up/Down may continue into record groups. Home/End, Page Up/Down, and Enter operate the
  single listbox selection model; Escape closes and restores focus. `aria-current` marks the
  active destination independently from the keyboard's `aria-selected` option.
- **Optional ZeyOS adapter** — import `zeyosLauncher()` or `buildZeyosLauncherConfig()` from
  `@zeyos/zx/zeyos`. The adapter receives the permitted module/menu catalogue, pins, current
  identifier, recent loader or cache, abortable search, destination resolvers, and application/
  record icon renderers explicitly. It maps the complete shell payload without reading globals or
  taking over application routing.
<!-- /doc -->

<!-- doc:avatar -->
### Avatar

A fixed-geometry user image with deterministic initials fallback. Image loading or failure never
changes layout, and the component is decorative by default so adjacent identity text is not
announced twice.

- **Options** — `src`, `name`, `initials`, `label`, `size: 'sm'|'md'|'lg'|<pixels>`,
  `shape: 'circle'|'rounded'|'square'`, `status: 'online'|'away'|'busy'|'offline'|null`, and
  `statusLabel`.
- **Methods** — `set(values)`, `setStatus(status, label?)`, `hasImage()`, `destroy()`.
- **Accessibility** — set `label` only when the avatar stands alone. Presence is supplementary
  status, not the account's accessible name; supply `statusLabel` when it conveys information.
<!-- /doc -->

<!-- doc:account-menu -->
### AccountMenu

Composes `Avatar` and `MenuButton` into one account trigger and APG menu. The popup repeats the
identity before its actions; Zx never decides role visibility, changes preferences, signs a user
out, or mutates the session.

- **Options** — `account: {name, secondary, src?, initials?, status?, statusLabel?}`, `items`,
  `compact: false`, `label`, and any top/bottom/left/right `placement`.
- **Methods** — `open()`, `close()`, `toggle()`, `isOpen()`, `setAccount()`, `setItems()`, `focus()`,
  `getPanel()`, `destroy()`.
- **Events** — cancelable `select {value, item}`, `open`, and `close`. A canceled selection does
  not run the item's callback and leaves the menu open, so an application can reject or confirm an
  action without rebuilding the account surface.
- **Accessibility** — compact mode is visually avatar-only but keeps the full account-menu name on
  its single native trigger; MenuButton retains focus return, typeahead, and arrow-key behavior.
<!-- /doc -->

<!-- doc:select -->
### Select — APG editable combobox

Unifies single-select, local filtering, and async loading.

- **Options** — `items: []`, `fixedItems: []`, `valueKey: 'ID'` (string key or `(item)=>id`),
  `labelKey: 'name'` (string or `(item)=>string`), `renderItem`, `renderValue`,
  `renderValueAdornment`, `renderNone`, `noneLabel`, `actions`, `value`, `disabled`, `placeholder`,
  `clearable: false`, `filter: false | 'local' | async (query)=>items`, `searchKeys`,
  `minQuery: 0`, `debounce: 200`, `listHeight: 280`, `groupKey`.
- **Getters** — `.value`, `.selected`.
- **Methods** — `set(id, {silent})`, `setItems()`, `setFixedItems()`, `setActions()`, `reset()`,
  `open()`/`close()`, `enable()`/`disable()`, `focus()`.
- **Events** — `change {value, item}` (`item` is null on clear), preventable
  `action {id, action, query, select}`, `open`, `close`, `query {query}`, `loaded {items}`.
- **Fixed choices** — `fixedItems` pins entries to the top of the list, separated by a rule (the
  rule is dropped when `groupKey` is on, since a heading already divides them). They belong to the
  control, not to its data: a `filter` function replaces `items` on every query, while the pinned
  entries are narrowed locally against the same query and stay resolvable by `set()`. They survive
  `setItems()` and are shown below `minQuery`. Use them for choices with no row in the source —
  "Unassigned", "Everyone", "Private".
- **Presets** — `Select.priority(target, opts)` renders the five-level, five-square ZeyOS priority
  scale; `Select.status(target, opts)` supplies shape- and semantic-color-distinct workflow states
  and accepts replacement `items`; `Select.permission(target, {groups, value})` pins Private and
  Public above record-access groups. Its value is the tri-state ZeyOS stores (`false` private,
  `true` public, or a group ID), and `groups` takes an array or loader `(query)=>items`.
- **ZeyOS entity preset** — import `zeyosEntitySelect(client, resource, options)` or the DOM-free
  `buildZeyosEntitySelectConfig()` from `@zeyos/zx/zeyos`. It composes the async client binding
  with module-colored icons, subtitle/group readers, a deliberate none row, and an optional
  application-owned create command. The selected value remains the record ID and exact product
  glyphs stay injectable through `renderIcon`.
- **Keyboard** (APG combobox) — ArrowDown/Alt+ArrowDown open; arrows navigate and wrap; Home/End;
  Enter selects; Esc closes; Tab closes; printable characters filter (editable) or run a typeahead
  (readonly). `aria-activedescendant` tracks the active option.
<!-- /doc -->

<!-- doc:checklist -->
### Checklist

Searchable multi-check list with optional async loading.

- **Options** — `items`, `valueKey: 'ID'`, `labelKey: 'name'`, `checkedKey: 'on'`, `search: true`,
  `height: 280`, `defaultChecked: false`, `load: async ()=>items`.
- **Methods** — `setItems()`, `getValues()`, `setValues(ids)`, `checkAll()`/`uncheckAll()`,
  `search(query)`, `reload()`.
- **Events** — `change {values}`, `loaded`.
<!-- /doc -->

<!-- doc:number-field -->
### NumberField

Numeric input with decrement/increment buttons, following the APG **spinbutton** pattern. The step
buttons are `tabindex="-1"`/`aria-hidden` pointer affordances — the input itself is the spinbutton.
Field type: `number`.

- **Options** — `value` (number|null), `min`, `max`, `step: 1`, `largeStep: 10` (PageUp/PageDown
  multiplier), `precision` (decimals; derived from `step` when null), `wrap: false` (stepping past
  a bound jumps to the other one), `placeholder`, `unit` (suffix rendered inside the control),
  `group: false` (thousands separators while idle), `locale`, `disabled`, `readonly`, `required`,
  `name`.
- **Methods** — `get()`, `set(value, {silent})` (parses strings, snaps to the step grid, clamps to
  the range; `''`/null clear it), `stepUp(n)`, `stepDown(n)`, `setRange(min, max)`,
  `setReadonly()`, `reset()`, `focus()`, `getInput()`, `enable()`/`disable()`.
- **Events** — `change {value}` (committed), `input {value}` (per keystroke, possibly unsnapped).
- **Keyboard** — ↑/↓ one step, PageUp/PageDown `largeStep` steps, Home/End jump to `min`/`max` when
  set (otherwise they keep their caret meaning), Enter commits, wheel steps while focused.
- **Also exported** — `parseNumber(raw)` (accepts `.` and `,` as the decimal separator, ignores
  grouping, returns null for junk) and `snapNumber(value, {min, max, step, precision})`.
<!-- /doc -->

<!-- doc:rating -->
### Rating

Star rating built as an APG **radio group**: one radio per selectable step, a single tab stop,
arrow-key selection. Field type: `rating`.

- **Options** — `value: 0` (0 = unrated), `max: 5`, `allowHalf: false` (renders two radios per
  symbol so every reachable value has a nameable control), `clearable: true` (re-selecting the
  current value clears it), `readonly`, `disabled`, `label: 'Rating'`, `icon: 'star'`,
  `labels: []` (per-step accessible names, lowest first), `showValue: false`, `count` (rating
  count shown beside the value), `size: 'sm'|'md'|'lg'`.
- **Methods** — `get()`, `set(value, {silent})`, `clear()`, `reset()`, `setCount()`,
  `setReadonly()`, `focus()`, `enable()`/`disable()`.
- **Events** — `change {value}`, `hover {value|null}` (pointer or focus preview; null on leave).
- **Keyboard** — ←/↓ and →/↑ step, Home selects the first step, End the last, Delete/Backspace
  clear.
<!-- /doc -->

<!-- doc:slider -->
### Slider

A bounded numeric value set by dragging — a discount rate, a threshold, a weighting. Built on a
native `<input type="range">`, which is where the whole keyboard map and the announcement come
from; everything Zx adds is chrome around it. Field type: `slider`.

- **Options** — `value: 0`, `min: 0`, `max: 100`, `step: 1`, `label: ''`, `hideLabel: false`,
  `showValue: true`, `showBounds: false` (draws `min` and `max` either side of the track),
  `showInput: false` (adds a number box for entering a value precisely instead of aiming at it),
  `unit: ''`, `marks: null` (numbers, or `{value, label}` objects), `disabled: false`,
  `readonly: false`, `size: 'md'|'sm'`, `formatValue: (value) => string`.
- **Methods** — `get()`, `set(value, {silent})`, `setRange(min, max, step?)`, `setLabel()`,
  `setReadonly()`, `focus()`, `enable()`/`disable()`. `value` is also a getter/setter.
- **Events** — `input {value}` continuously while dragging, `change {value}` once the value is
  committed (pointer released, or a key pressed).
- **Behaviour** — values snap to the step grid anchored at `min`, so 5…95 by 10 gives 5, 15, 25 —
  not 10, 20, 30. Bounds win over the grid, so a `max` that is not a whole number of steps above
  `min` stays reachable. A fractional step snaps to the decimals it carries: 0.1 gives 0.3, never
  0.30000000000000004. `stepPrecision(step)` is exported for the same arithmetic elsewhere;
  snapping itself reuses `snapNumber` from NumberField.
- **Keyboard** — arrows step by `step`, Page Up/Page Down jump, Home and End go to the bounds —
  all native. A read-only slider stays focusable and announced but refuses every edit, pointer and
  keyboard alike; a disabled one leaves the tab order entirely.
<!-- /doc -->

<!-- doc:copy -->
### copyButton() / CopyInput

Copying a value, and saying so. A clipboard write is silent, so both of these confirm it in place
— and stay quiet when the browser refuses. Both go through `copyToClipboard()`, which falls back
to a hidden textarea when the async Clipboard API is unavailable or denied.

#### copyButton()

- **Signature** — `copyButton({text, label, title, feedback, feedbackDuration, size, kind, oncopy})`
  → `HTMLButtonElement`.
- **Options** — `text: ''` — a string, or **a function returning one**, which is what a button
  beside a live value needs so the copy is never stale; `label: ''` (empty renders an icon-only
  ghost button), `title: 'Copy'`, `feedback: 'Copied'`, `feedbackDuration: 2000`,
  `size: 'md'|'sm'`, `kind: 'default'|'primary'|'ghost'`.
- **Events** — `oncopy(text, copied)` is called for every attempt; `copied` is `false` when the
  clipboard refused the write, and the button then stays untouched rather than claiming a copy
  that did not happen.
- **Accessibility** — on success the glyph becomes a tick and a visually hidden `role="status"`
  speaks the confirmation, then both revert. The icon-only form carries the `title` as its
  accessible name.

#### CopyInput

- **Options** — `value: ''`, `label: ''`, `hideLabel: false`, `feedback: 'Copied'`,
  `buttonTitle: 'Copy'`, `size: 'md'|'sm'`.
- **Methods** — `get()`, `set(value)`, `focus()` (focuses and selects the whole value).
- **Events** — `copy {value, copied}`.
- **Behaviour** — the field is `readonly`, not `disabled`, so the text stays selectable and
  reachable by keyboard; focusing it selects the whole value, which is what someone reaching for
  Ctrl+C expects.
<!-- /doc -->

<!-- doc:date-picker -->
### DatePicker / MonthPicker / TimePicker

Inline, embeddable pickers.

#### DatePicker — APG date grid

- **Options** — `value: Date|null`, `min`, `max`, `weekStart: 1`, `showWeekNumbers: false`,
  `time: false`.
- **Methods** — `get()`, `set()`, `focus()`.
- **Events** — `change {date}`, `monthchange {year, month}`.
- **Keyboard** — arrows move a day, PageUp/PageDown a month, Shift+PageUp/PageDown a year,
  Home/End, Enter/Space select. Day cells carry an `aria-label`.

#### MonthPicker

A 12-month grid. `get()`/`set()` work on the first of the month; event `change {date}`.

#### TimePicker

Two spinbuttons (three with `seconds`), plus an optional clock face behind a toggle button: pick an
hour on the outer (1–12) or inner (13–23, 00) ring and the dial moves on to the minutes. Every mark
is a radio in an APG radio group; the spinbuttons stay the primary control.

- **Options** — `value: null`, `seconds: false`, `step: 5` (minute increment for the arrow keys),
  `clock: true`.
- **Methods** — `get()`, `set()`, `openClock(unit)`, `closeClock()`, `toggleClock()`.
- **Events** — `change {time}`.
<!-- /doc -->

<!-- doc:datebox -->
### Datebox / DateTimeBox

Text date input with a calendar popover. `DateTimeBox(target, opts)` is a Datebox with
`time: true`, which also brings the TimePicker (and its clock face) into the popover. Format
tokens are the date-utility ones: `%d %m %Y %H %M`.

- **Options** — `value: Date | number(unix) | string`, `format: '%d.%m.%Y'`, `time: false`, `min`,
  `max`, `placeholder`, `clearable: true`, `disabled`.
- **Methods** — `get(unit='date')` (`'seconds'` → unix), `set(value, {silent})` (accepts a Date;
  pass Date objects, not display strings), `open()`/`close()`, `enable()`/`disable()`, `focus()`.
- **Events** — `change {date}`, `invalid {text}`, `open`, `close`.
<!-- /doc -->

<!-- doc:date-range -->
### DateRangePicker / DateRangeBox

An inline two-month calendar for picking a start and an end day, plus the form-usable text input that wraps it. The first click opens a range and the second closes it; while an end is pending, hovering and arrow-key focus preview where the range would land, and clicking on or before the pending start restarts it there instead of producing an inverted range. Both grids behave as one roving-focus unit, so arrowing right off 31 August continues on 1 September. Range maths is exported separately as `normalizeRange`, `rangeNights`, `rangeStateOf`, and `clampRange`, so the rules can be reused and tested without a DOM.

#### DateRangePicker

- **Options** — `start: null`, `end: null` (Dates), `min: null`, `max: null`, `months: 2` (a container query drops to one month in narrow hosts), `weekStart: 1`, `showWeekNumbers: false`, `minNights: 0`, `maxNights: null`, `presets: []` (an array of `{name, label, range: () => ({start, end})}`, or `true` for the built-in Today, Yesterday, Last 7 days, Last 30 days, This month, Last month, This quarter, This year), `disabled: false`.
- **Methods** — `get()` → `{start, end}` copies, `set({start, end}, {silent})` (clamped to the bounds, scrolls the first month to the start), `clear({silent})`, `focus()`, `enable()`, `disable()`, `destroy()`.
- **Events** — `change {start, end}` once a range is complete and on clear, `select {start, end}` on every click including the half-open state where `end` is still null, `monthchange {year, month}` when the first visible month moves.
- **Keyboard** — arrows move a day, PageUp/PageDown a month, Shift+PageUp/PageDown a year, Home/End the ends of the week, Enter or Space selects, Escape abandons a half-picked range and restores the last complete one. Days outside `min`/`max` — and, once a start is pending, days that would break `minNights`/`maxNights` — stay keyboard-focusable but carry `aria-disabled="true"`. Committed days carry `data-range="start" | "middle" | "end"` and previewed days `data-range="preview"`; the picker is a `role="group"` holding one `role="grid"` per month, and the selection is announced through a visually hidden `aria-live="polite"` region ("1 – 14 August 2026, 13 nights").
- **Exported helpers** — `normalizeRange(start, end)` orders a pair at local midnight (invalid values become null), `rangeNights(start, end)` counts nights from calendar days so DST never shifts the total, `rangeStateOf(day, start, end)` → `'start' | 'middle' | 'end' | null`, `clampRange(range, {min, max, minNights, maxNights})` pulls a range inside its bounds.

#### DateRangeBox

- **Options** — everything DateRangePicker takes, plus `format: '%d.%m.%Y'`, `separator: ' – '`, `placeholder: null` (derived from the format when null), `clearable: true`. Typed text is parsed as `"<start><separator><end>"`; a lone date reads as a one-day range and a trailing separator keeps the range half open.
- **Methods** — `get(unit = 'date')` (`'seconds'` returns `{start, end}` as Unix seconds), `set(range, {silent})` accepting `{start, end}` of Dates, Unix-seconds numbers, or formatted strings, `clear({silent})`, `open()`, `close()`, `enable()`, `disable()`, `focus()`, `destroy()`.
- **Events** — `change {start, end}`, `invalid {text}` when the typed value cannot be parsed (the text stays editable and the field takes `data-state="invalid"` plus `aria-invalid`), `open`, `close`.
<!-- /doc -->

<!-- doc:timebox -->
### Timebox

Duration input (H:MM[:SS], optional sign) — a length of time, not a time of day. For a time of day
use `TimePicker` or `DateTimeBox`.

- **Options** — `value: 0`, `unit: 'minutes'|'seconds'|'hours'`, `seconds: false`, `signed: false`,
  `disabled`.
- **Methods** — `get(unit)`, `set(value, unit?, {silent})`, `enable()`/`disable()`.
- **Events** — `change {value}`, in `options.unit`.
- **Also exported** — the pure helpers `splitTime` and `joinTime`.
<!-- /doc -->

<!-- doc:message -->
### Message — toasts, inline, progress

Floating toasts come from statics; `new Message(target)` gives an inline, non-floating area with
the same `.show()`. The toast region is `role="status"`/`aria-live` (`role="alert"` for errors).

- **Statics** — `Message.info/success/warning/error(msg, opts)`,
  `Message.show(msg, { kind, timeout=4000, closable })` → `{ close() }`,
  `Message.progress(text)` → `{ update(pct, text?), done(), fail(text?) }`.
- **Per-message options** — `kind: 'info'`, `timeout`, `closable: true`, `maxVisible: 5` (extras
  queue, and hovering pauses dismissal).
<!-- /doc -->

<!-- doc:modal -->
### Modal

Thin overlay on the native `<dialog>` element. The backdrop uses `--zx-color-bg-backdrop`, and
focus returns to the opener on close.

- **Options** — `content`, `width: 'auto'`, `closable: true`, `lightDismiss: false`,
  `destroyOnClose: false`.
- **Methods** — `open()`, `close(result?)`, `setContent()`, `isOpen()`.
- **Events** — `open`, `close {result}`, `cancel` (Esc; preventable with `event.preventDefault()`).
<!-- /doc -->

<!-- doc:dialog -->
### Dialog (extends Modal)

Structured modal: a header with title and close button, a body, and footer buttons.

- **Options** — `title`, `size: 'sm'|'md'|'lg'|number`,
  `buttons: [{ label, kind, action: 'close'|'cancel'|fn(dialog), autofocus }]`, `closable: true`.
- **Methods** — `setTitle()`, `setContent()`, `setButtons()`,
  `addView(key, { content, buttons? })`, `showView(key)`.
- **Statics returning Promises** — `Dialog.alert({ title, message })`,
  `Dialog.confirm({ title, message, danger })` → boolean,
  `Dialog.prompt({ title, message, value })` → string|null.
<!-- /doc -->

<!-- doc:sheet -->
### Sheet

Edge-anchored surface — a `Dialog` attached to one side of the viewport instead of floating in the
middle. One primitive covers both side sheets and mobile drawers, which differ mainly in the edge they take, so
`side` replaces what would otherwise be two components. Inherits the whole Dialog anatomy: title,
footer buttons, switchable views, and focus restoration.

- **Options** — `side: 'end'` (`'start' | 'end' | 'top' | 'bottom'`, logical), `modal: true`
  (`true | 'trap-focus' | false`), `backdrop: 'dim'` (`'dim' | 'blur' | 'none'`), `size: null`
  (CSS length or px number, applied to whichever axis `side` implies), `closeButton: true`,
  plus everything Dialog takes — `title`, `content`, `buttons`, `closable`, `lightDismiss`
  (defaults to `true` here, unlike Modal), `destroyOnClose`.
- **Methods** — `open()`, `close(result?)`, `setSide(side)`, `getSide()`, `setSize(size)`,
  `isModal()`, `isDocked()`, `isOpen()`, `getSize()`, `snapTo(target)`, plus Dialog's `setTitle()`, `setContent()`,
  `setButtons()`, `addView()`, `showView()`.
- **Events** — `open`, `close {result}`, `cancel` (preventable with `event.preventDefault()`),
  `resize {size, ratio}`, `dockchange {docked, dock}`.
- **Docked** — a sheet has two lives, and it does not choose between them: `Dock.adopt(sheet)`
  makes it a track in that dock's flow instead of an overlay, and the dock then owns its side,
  size, and resizing. A docked sheet is always non-modal, `close()` collapses its track to zero
  rather than sliding away, and Escape and outside-click stop dismissing it — it is part of the
  layout, not something covering it. `Dock.release(sheet)` hands it back. Nothing is rebuilt
  across a handoff: the element moves and reopens in place, so DOM state and listeners survive,
  and no `open`/`close` is emitted for what is only a change of address.
- **Modality** — `true` delegates focus containment, page inertness, Escape, and the backdrop to
  the browser through `showModal()`. `'trap-focus'` and `false` open with `show()`, so the page
  keeps scrolling and stays interactive; Escape and outside-click are re-implemented, and
  `'trap-focus'` adds `focusTrap()` on top. Only a modal sheet renders a `::backdrop`, so
  `backdrop` is meaningful only when `modal` is `true`.
- **Resizing and detents** — `resizable` makes the inner edge draggable between `min` and `max`.
  `snap` gives it detents: a number at or below 1 is a fraction of the viewport along the sheet's
  axis, anything larger is pixels, and a string is any CSS length (`'320px'`, `'90%'`). With
  detents a drag settles on the nearest one rather than where it was released, and `snapTo(index)`
  or `snapTo(value)` moves there directly. Dragging below half the smallest allowed size dismisses
  a `closable` sheet, so resize, detent, and swipe-to-dismiss are one gesture whose meaning is
  decided when the pointer settles. `getSize()` reports the current pixel size. A sheet that is
  neither `resizable` nor snapping still has a draggable handle where `handle` shows one — that is
  what makes a drawer dismissible — but the drag may only take size away, never add it, so it
  cannot be grown by dragging when nothing asked for resizing.
- **Handle** — `handle: 'auto'` shows a grab handle on `top` and `bottom` sheets, which is what
  makes them read as drawers; `true` and `false` force it either way. It exists whenever the sheet
  is `resizable` or has `snap`, visible or not. It is a `separator` with live
  `aria-valuenow`/`aria-valuemin`/`aria-valuemax`: arrow keys along the axis step it by 16px, Shift
  by 64px. A docked sheet hides its handle — the dock's own divider resizes it there.
- **Custom properties** — `--zx-sheet-size` (written by `size`; the per-side default otherwise)
  and `--zx-sheet-radius` (inner corners of a top/bottom sheet, default `--zx-radius-xl`) are
  internal geometry, not published styling hooks — prefer the options. `--zx-overlay-blur` is a
  tier-2 semantic token and is public: it sets the `'blur'` backdrop's radius, default `8px`.
- **Motion** — entry and exit both animate, via `@starting-style` and
  `transition-behavior: allow-discrete` on `display`/`overlay`; without them the sheet appears and
  disappears instantly. All of it sits inside `prefers-reduced-motion: no-preference`.
- **Keyboard and screen readers** — identical to Dialog: the native `<dialog>` supplies the role
  and `aria-labelledby` points at the title. Escape closes when `closable`, focus moves to the
  `[autofocus]` control or the first focusable descendant on open, and returns to the opener on
  close. Tab cycles within the sheet when `modal` is `true` or `'trap-focus'`.
<!-- /doc -->

<!-- doc:sheet-stack -->
### SheetStack

An ordered group of Sheets that reads as one drill-down. Deliberately tiny, because the browser
already does the hard part: nested dialogs stack in the top layer by open order, so there is no
z-index bookkeeping, and Escape closes only the topmost, so unwinding one level at a time is
native. What is left is which sheet sits at which depth, written onto the elements as `data-depth`
and `--zx-sheet-depth` for CSS to interpret.

Owns no element, so it is a controller rather than a `Component` — constructed with options
alone, `new SheetStack({…})`.

- **Options** — `layout: 'stack'` (`'stack' | 'cascade'`), `offset: 24`, `scale: 0.04`, `max: 3`.
- **Methods** — `push(sheet)`, `pop()`, `popTo(sheet)`, `clear()`, `top()`, `size()`, `sheets()`,
  `has(sheet)`, `on/off/once`, `destroy()`.
- **Events** — `push {sheet, depth}`, `pop {sheet}`. `pop` fires however a sheet left — popped,
  dismissed with Escape, or closed by its own button.
- **Layouts** — `stack` slides each covered sheet back toward its own edge, scales it down, and
  takes it out of the tab order; only the top one is usable, which is the drill-down feel.
  `cascade` shifts each covered sheet clear of the ones in front — by their measured size, not a
  guess — so they sit side by side and all stay usable. `cascade` is usually the right one for an
  ERP screen, where the parent record should stay readable while a line item is edited.
- **Depth** — numbered from the top: the visible sheet is `0`. Past `max` a sheet stops being
  drawn but stays open and in the stack. In a `stack` only the topmost backdrop shades the page;
  one per depth would compound into black. A `cascade` shades nothing — a backdrop paints directly
  beneath its own dialog in the top layer, so the top sheet's would dim exactly the sheets the
  layout exists to keep readable. Pair a cascade with `modal: false` when the page behind it
  should stay live as well.
- **Ownership** — the stack never owns its sheets. `destroy()` empties it and strips the depth
  styling without closing anything.
- **Accessibility** — for `stack`, covered sheets are `inert`. The browser does that on its own
  for stacked *modal* dialogs, but a non-modal stack gets nothing, so the attribute is set either
  way. `cascade` deliberately leaves them interactive.
- **Gotcha** — `close()` on a dialog dispatches its `close` event in a queued task, not
  synchronously. `pop()` therefore removes the sheet from the stack itself rather than waiting for
  the event, so `popTo()` and `clear()` can loop without racing it.
<!-- /doc -->

<!-- doc:dropdown -->
### Dropdown

Generic anchored popover in the top layer, constructed as `new Dropdown(anchor, options)`. It
light-dismisses on an outside click or Esc, and mirrors `aria-expanded` onto the anchor.

- **Options** — `content`,
  `placement: 'bottom-start'|'bottom-end'|'top-start'|'top-end'|'bottom'|'top'` plus the matching
  `left*` and `right*` placements, `offset: 4`,
  `matchWidth: false`, `openOn: 'click'|'manual'`, `closeOnSelect: false`.
- **Methods** — `open()`, `close()`, `toggle()`, `isOpen()`, `setContent()`, `getPanel()`.
- **Events** — `open`, `close`.
<!-- /doc -->

<!-- doc:menu-button -->
### MenuButton — APG menu button

A button that opens a `role="menu"`.

- **Options** — `label`, `icon`, `kind`,
  `items: [{ label, icon?, value?, disabled?, danger?, onselect? } | '-']`, `placement`.
- **Methods** — `setItems()`, `open()`, `close()`, `setLabel()`, `getTrigger()`, `getPanel()`,
  `focusFirst()`, `focusLast()`.
- **Events** — `select {value, item}`, `open`, `close`.
- **Cancellation** — `select` is cancelable. Preventing it skips the item's `onselect` callback and
  leaves the menu open, which is the composition seam used by `AccountMenu` and rail flyouts.
- **Keyboard** — ArrowDown/Enter/Space open and focus the first item; ArrowUp opens and focuses the
  last; arrows cycle; Home/End; typeahead; Enter/Space select; Esc/Tab close.
<!-- /doc -->

<!-- doc:context-menu -->
### ContextMenu

Right-click menu for a region or a row, implementing the APG menu pattern. Attaches to an existing
element and never changes it: the menu lives in the top layer, anchored to a zero-sized element
parked at the pointer, so it flips near a viewport edge like every other floating panel.

- **Constructor** — `new ContextMenu(target, options)` where `target` is an element or selector.
  Unlike most components the target is not enhanced or replaced; `destroy()` removes only the
  anchor the menu created.
- **Options** — `items: []` — the same `{label, icon, value, disabled, danger, onselect}` shape
  MenuButton takes, with `'-'` for a separator, **or a function** `(context) => items` called on
  every opening so a row menu can disable the actions that row does not allow; returning an empty
  array cancels the opening and leaves the platform menu alone. `selector: null` restricts the
  menu to matching descendants and reports the matched element as the context — a table passes
  `'tbody tr'` here and needs one instance, not one per row.
- **Methods** — `setItems(items)`, `openAt(x, y, context?)` (viewport coordinates),
  `openAtElement(element)`, `close()`, `isOpen()`, `getContext()`.
- **Events** — `select {value, item, context}`, `open {context}`, `close`. Subscribe with
  `menu.on('select', …)` or the `onselect` option: the component's root is the anchor on
  `<body>`, so the bubbling `zx-select` DOM event is dispatched there and not through the
  region the menu belongs to — delegation on the target will not see it.
- **Keyboard** — the Menu key and Shift+F10 open the menu at the focused element, which is the
  half most pointer-only context menus miss. Arrows move between items, typing jumps to one by its
  first letters, Enter and Space activate, Escape and Tab close — and closing returns focus to
  wherever it came from.
<!-- /doc -->

<!-- doc:tooltip -->
### Tooltip

A description bubble anchored to another element. The panel is a manual popover positioned by the kernel's `position()`, so it escapes clipping and stacking contexts and flips near a viewport edge; it carries `role="tooltip"` and a generated id, and the anchor gets `aria-describedby` pointing at it only while it is open — closing puts the anchor's original value back, including no value at all. The bubble is never interactive: `pointer-events: none` keeps it from stealing the hover it depends on, and nothing inside it can take focus. Hover opens it after `delay`; keyboard focus opens it immediately, because a keyboard user cannot hover a moment longer; a touch pointer never opens it, since a bubble with no "move away" gesture would simply stick. Only one is ever visible at a time, which falls out of the dismissal rules rather than a registry.

- **Options** — `content` (string, Node, or a function re-evaluated on every open), `placement`
  (`'top'` default, plus top/bottom/left/right and their start/end variants), `offset` (6), `delay`
  (400), `hideDelay` (80), `maxWidth` (260; a number is pixels, a string is any CSS length),
  `trigger` (`'both'` default, or `'hover'`, `'focus'`, `'manual'` — `manual` installs no listeners
  at all and leaves everything to the methods), `disabled` (false).
- **Methods** — `show()`, `hide()`, `toggle()`, `isOpen()`, `setContent(content)`, `enable()`, `disable()`, `isDisabled()`, `getAnchor()`, `destroy()`. Convenience factories: `tooltip(anchor, contentOrOptions)` takes either a content value or a full option object, and `describe(anchor, text)` is the one-liner replacement for a `title` attribute. Both return the instance.
- **Events** — `open`, `close`. Both fire only on a real transition, so a `show()` on an open tooltip is silent.
- **Keyboard** — Focusing the anchor opens the tooltip at once; moving focus away closes it. `Escape` closes it without moving focus, satisfying WCAG 1.4.13. A `pointerdown` anywhere closes it, and focus that arrives with a click does not re-open it.
<!-- /doc -->

<!-- doc:split-view -->
### SplitView

Two panes with a divider the user owns. The layout is a three-track CSS grid driven by one custom property, `--zx-split-size`, so a drag writes a single style value per frame and the browser does the rest. That property holds whatever was asked for: `38%` stays a percentage and keeps tracking the container until someone drags, at which point it becomes pixels and stays put. The divider follows the WAI-ARIA window splitter pattern — a focusable `separator` with live pixel `aria-valuenow`/`aria-valuemin`/`aria-valuemax` — and a `ResizeObserver` re-clamps the size when the container shrinks, bailing on a container that measures zero (a hidden tab, a detached node) rather than flattening a good size to nothing. A split view given an existing element with children adopts the first two as its panes and hands them back on `destroy()`.

- **Options** — `orientation` (`'horizontal'` default: panes side by side behind a vertical divider; `'vertical'` stacks them), `start` / `end` (Node, Component, string, or null), `size` (`'38%'`; a number is pixels, a string is any CSS length), `min` (160), `max` (null — "whatever the container allows"), `collapsible` (`false`, `'start'`, or `'end'`), `collapsed` (false, true, or a pane name), `snap` (0 — a radius in pixels within which a settled drag lands exactly on the initial size, the minimum, or the maximum), `storageKey` (null; storage failures degrade to memory rather than throwing), `disabled` (false), `label` (`'Resize panes'`).
- **Methods** — `setSize(value)`, `getSize()` (pixels), `getRatio()`, `setStart(content)`, `setEnd(content)`, `collapse(which)`, `expand()`, `isCollapsed()` (returns the pane name or false), `enable()`, `disable()`, `isDisabled()`, `destroy()`. The setters are programmatic and emit nothing.
- **Events** — `resize` `{size, ratio}`, throttled to at most once per animation frame during a drag; `resizeend` `{size, ratio}` once an interaction settles (a drag ends, a key moves the divider, a double-click resets it); `collapse` `{pane}`; `expand`. A press that never moved is a click, not a resize, and reports nothing.
- **Keyboard** — With the divider focused: `←` / `→` (horizontal) or `↑` / `↓` (vertical) move it 16px, `Shift` with an arrow moves 64px, `Home` goes to the minimum, `End` to the maximum, and `Enter` or `Space` folds a collapsible pane away and brings it back. Any key that moves the divider expands a collapsed pane first. Double-clicking the divider resets it to the initial `size`.
<!-- /doc -->

<!-- doc:table -->
### Table

Sortable, selectable, sticky-header data table. `fr` widths fill the container while px/auto
widths scroll horizontally, and multi-select adds a tri-state header checkbox plus Shift+click
range select.

- **Options** — `columns: [{ id, label, sortable?, width ('120px'|'2fr'|'auto'), align,
  type?: 'text'|'number'|'currency'|'percent'|'unit', locale?, decimals?, currency?, unit?,
  render?: (row,i)=>Node|string, sortValue?, headerTitle? }]`, `data`, `rowId: 'ID'`,
  `sort: { id, dir }`, `sortMode: 'local'|'server'`, `selectable: false|'single'|'multi'`,
  `stickyHeader: true`, `height`, `emptyText`, `rowClass`, `zebra: true`, and
  `hierarchy: false|{parentId, column?, expanded?}`. Locale, currency, unit, and decimals may be
  row callbacks; values remain numbers in row data while display formatting is locale-aware.
- **Methods** — `setData()`, `addData()`, `updateRow(id,row)`, `removeRow(id)`, `getRow(id)`,
  `getData()`, `empty()`, `setSort(id,dir)`, `getSelection()`, `setSelection(ids)`,
  `clearSelection()`, `setLoading(bool)` (busy/skeleton state — dims rows, shows an indeterminate
  top bar, sets `aria-busy`, and is cleared by the next `setData`).
- **Events** — `rowclick {row, id, index, event}`, `rowdblclick`, `sort {id, dir}`,
  `selectionchange {rows, ids}`, `datachange {rows}`, and `rowtoggle {row, id, expanded}`.
- **Hierarchy** — flat parent references are projected as an ARIA `treegrid`; `getData()` and all
  editing/mutation APIs stay flat and ID-based. Orphans become roots, cycles render once, local
  sort reorders siblings without mixing levels, and growing counts visible rows. Use
  `toggleRow()`, `expandRow()`, `collapseRow()`, `expandAll()`, `collapseAll()`, and
  `getExpanded()`. The native disclosure button works by pointer and keyboard without selecting
  or clicking the row.
- **Editing** — `editMode: false|'cell'|'row'` (default `false`, and completely inert until set).
  `'cell'` edits one cell, `'row'` opens every editable cell of the row and commits them as a unit.
  Editors are sized into the cell without changing row height, and an editing cell carries
  `data-editing="true"` (`data-invalid="true"` plus an `aria-live` message when a validator rejects).
- **Editable columns** — extra column keys: `editable: false|true|'text'|'number'|'select'|'date'|
  'checkbox'|'textarea'|((row)=>boolean)` (`true` infers `'number'` for number/currency/percent/unit
  columns and `'text'` otherwise; a function is evaluated per row, so individual rows stay
  read-only), `options` for `'select'` (`[{value,label}]`, a `{value: label}` map
  whose keys are always strings, or `(row)=>items`), `editorProps` (forwarded to the underlying
  NumberField/Select/Datebox/Toggle or to the generated `<input>`/`<textarea>`),
  `editor: (row, api)=>Node` for a fully custom editor (`api` is `{value, commit(value), cancel(),
  row, column}`; it wins over `editable`, but a per-row `editable` function returning `false` still
  marks the cell read-only), `parse: (raw,row)=>value` and `format: (value,row)=>string` (`format`
  seeds the text of a `'text'`/`'textarea'` editor, `parse` converts every editor's raw output back),
  and `validate: (value,row)=>true|string` (a returned string marks the cell invalid, shows the
  message, and refuses the commit).
- **Transaction editors** — currency and unit columns reuse `NumberField` and show the resolved
  currency/unit as its suffix unless `editorProps.unit` overrides it. This is a generic typed-grid
  contract: application code remains responsible for tax, discount, subtotal, and accounting
  formula rules.
- **Editing methods** — `startEdit(rowId, columnId)`, `commitEdit()`, `cancelEdit()`, `isEditing()`,
  `getEditing()` → `{id, columnId}|null`.
- **Editing events** — `editstart {row, id, column, columnId, value}`;
  `editcommit {row, id, column, columnId, value, previous, changes}` — **cancelable**:
  `preventDefault()` on the component event (`table.on('editcommit', …)` or the `oneditcommit` option,
  not the mirrored `zx-editcommit` DOM event) keeps the editor open so a server round-trip can reject
  the change (`changes` is the `{columnId: value}` map and holds every changed cell in row mode);
  `editcancel {row, id, column, columnId}`;
  `editinvalid {row, id, column, columnId, value, message}`. A committed change is written
  back through `updateRow()`, so `datachange` fires exactly as for a programmatic row update — a
  commit with no changes emits `editcommit` with an empty `changes` map and leaves the data alone.
  Sorting, filtering, or `setData()` while editing cancels the edit cleanly and emits `editcancel`.
- **Editing keyboard** — Enter or F2 on a focused editable cell starts editing (editable cells share
  one roving tab stop), double-click starts editing without emitting `rowdblclick`, Enter commits and
  returns focus to the cell (Shift+Enter stays a newline in a `'textarea'`, Space toggles a
  `'checkbox'`), Escape cancels and returns focus to the cell, Tab commits and moves to the next
  editable cell (Shift+Tab the previous), wrapping across rows, and tabbing past the last editable
  cell commits and leaves the table normally. Clicking outside the editor commits rather than
  discarding what was typed.
- **Growing** — `growing: <number>` renders that many rows and offers a control for the next batch,
  instead of laying out a result set nobody will scroll through. `growBy(count?)`, `showAll()`,
  `getRenderedCount()`, and `grow {rendered, total}`. `setData()` starts the batch over, since a new
  result set is not the old one grown. Row indices stay absolute — a row's index is its place in the
  data, not in what is on screen. **Select-all covers the rendered rows, not the whole result set**;
  call `showAll()` first to mean all of them. While growing, the table carries `aria-rowcount` and
  each row an `aria-rowindex`, so assistive technology hears the real total rather than the size of
  the batch.
- **Responsive stacking** — `responsive: false|'sm'|'md'|'lg'|'xl'` stacks each row into a card of
  label/value pairs below that width, instead of leaving a horizontal scrollbar with the data
  hidden behind it. The width measured is **the table's own container**, not the viewport, so this
  triggers inside a narrow split pane on a wide screen. A column with `popin: false` leads the card
  instead of becoming another labelled line — the identifying column usually wants that. Every cell
  carries `data-label`, so the labels are there whether or not the option is on. `isStacked()`
  reports the current state and `stackedchange {stacked}` fires on each crossing. Stacking drops
  `display: table`, which drops the implicit ARIA roles, so the component states
  `table`/`rowgroup`/`row`/`cell`/`columnheader` explicitly for exactly as long as the mode is on.
- **Empty state** — `emptyText` takes a string, a Node, or a function returning one, so an empty
  table can carry an icon, an explanation, and the action that resolves it (`emptyState({…})`).
  A function is re-called on every render, which is what to use when the placeholder holds controls.
<!-- /doc -->

<!-- doc:grid -->
### Grid and `Grid.BillingItems()`

`Grid` is the public extension point for repeatable data-table presets. It subclasses `Table`
without forking its implementation, so sorting, selection, hierarchy, responsive stacking,
editable cells/rows, loading, events, and teardown keep the Table contract.

- **Constructor** — `new Grid(target, tableOptions)` accepts the complete `Table` API.
- **Preset** — `Grid.BillingItems(target, options)` supplies an editable hierarchical billing
  schema for item, quantity, unit, unit price, currency, and line total. It returns a `Grid`.
- **Billing options** — `data`, `fields` key overrides, `units`, `currencies`, fallback `currency`,
  `locale`, `decimals`, `columnOverrides`, complete `columns` replacement, `lineTotal(row, changes)`,
  and `oneditcommit` in addition to ordinary Table options.
- **Rows** — default field names are `id`, `parent`, `kind`, `item`, `quantity`, `unit`,
  `unitPrice`, `currency`, and `total`. `kind: 'group'|'subtotal'|'header'|'section'` is read-only;
  other rows are editable. Parent references use Table's flat-data treegrid projection.
- **Calculation boundary** — the default line total is quantity × unit price. Applications own
  taxes, discounts, rounding, subtotal/group recalculation, optimistic persistence, and server
  validation; provide `lineTotal` or cancel `editcommit` when product policy differs.
<!-- /doc -->

<!-- doc:chart -->
### Chart and `ChartJsAdapter`

An accessible, engine-neutral chart host. Zx renders state, canvas, semantic data summary, tokens,
and lifecycle; an injected adapter owns the drawing engine. The Zx runtime imports no Chart.js
code, so future adapters do not change the public `Chart` API.

- **Options** — `adapter`, `type: 'bar'`, `data`, engine-specific `chartOptions`, `label`,
  `description`, `summary: 'hidden'|'visible'`, `loading`, loading/empty/error text, and
  `aspectRatio: '16 / 9'`.
- **Methods** — `setData()`, `setType()`, `update(chartOptions)`, `setAdapter()`, `setLoading()`,
  `setError()`, `clearError()`, `resize()`, `refreshTheme()`, `getInstance()`, `destroy()`.
- **Events** — `ready {instance}`, `update {data, type}`, `select {datasetIndex, index, dataset,
  label, value, nativeEvent}`, and `error {error}`.
- **Adapter contract** — `adapter.create(canvas, {type, data, options, onSelect})` returns
  `{update(spec), resize(), destroy(), instance?}`. Implementations must destroy engine resources
  and must not retain the component after teardown.
- **`ChartJsAdapter`** — construct it with a Chart.js constructor or namespace:
  `new ChartJsAdapter(window.Chart)`. The documentation pins Chart.js 4.5.1 as a development-only
  asset; `package.json` has no runtime dependencies and application builds explicitly choose how
  the engine is loaded.
- **Accessibility** — the canvas always has a name and optional description, while synchronized
  labels and dataset values live in a semantic table. `summary: 'hidden'` keeps it visually hidden
  for assistive technology; `'visible'` makes exact values part of the interface.
<!-- /doc -->

<!-- doc:data-filter -->
### DataFilter

Declarative client-side filter bar producing a filtered array, commonly wired to a Table with
`onfilter: (e) => table.setData(e.detail.rows)`.

- **Options** — `filters: [{ type: 'select'|'text'|'custom', id, label, field(s)|get, options?,
  predicate?, emptyLabel?, placeholder? }]`, `data`, `autoApply: true`, `clearLabel`.
- **Methods** — `setData()`, `apply()` → rows, `clear()`, `getState()`, `setState()`,
  `addFilter()`.
- **Events** — `filter {rows, state}`.
<!-- /doc -->

<!-- doc:tree -->
### TreeView

Hierarchical tree implementing the APG **tree** pattern. Rows render as a flat list carrying
`aria-level`/`aria-setsize`/`aria-posinset` (the flattened variant the APG allows) rather than
nested `role="group"` containers. The component clones `items`, so lazily loaded children never
mutate the caller's data.

- **Options** — `items` (nested), `valueKey: 'ID'`, `labelKey: 'name'`, `childrenKey: 'children'`,
  `expanded: []`, `selection: 'single'|'multi'|false`, `selected: []`, `checkboxes: false`
  (tri-state), `checked: []`, `icons: true`, `renderLabel`, `load: (node)=>Promise<children>`
  (lazy children; mark a branch with `hasChildren: true`), `filter`, `emptyText`, `height`.
- **Methods** — `setItems()`, `getItems()`, `getNode(id)`, `getPath(id)`, `setFilter(query)` (keeps
  matching nodes' ancestors and opens the surviving branches),
  `expand(id)`/`collapse(id)`/`toggle(id)` (async — they await the loader),
  `expandAll()`/`collapseAll()`, `reveal(id)`, `select(id, {additive})`,
  `getSelection()`/`setSelection()`/`clearSelection()`, `check(id, checked)`,
  `getChecked({leavesOnly})`, `setChecked()`, `focusNode(id)`.
- **Events** — `select {node, id, ids}`, `expand`, `collapse`, `activate {node, id}` (Enter or
  double-click), `check {ids, node}`.
- **Keyboard** — ↑/↓ move, → expands then descends, ← collapses then ascends, Home/End, Enter
  activates, Space selects or toggles the checkbox, `*` expands every sibling, typing jumps to the
  next match.
<!-- /doc -->

<!-- doc:finder -->
### Finder

Miller-columns hierarchy browser: each column lists the children of the row selected in the column
to its left, like the macOS Finder's column view. The columns are linked listboxes sharing **one**
tab stop. The constructor applies `path` silently, so read `getNodes()` for the first paint of any
breadcrumb.

- **Options** — `items` (the same nested shape as `TreeView`), `valueKey`, `labelKey`,
  `childrenKey`, `path: []` (initial selection, root first), `load: (node)=>Promise<children>`,
  `preview: (node)=>Node|null` (renders a pane after the last column for a selected leaf),
  `rootLabel`, `columnWidth: 220`, `height: 320`, `icons: true`, `renderItem`, `emptyText`.
- **Methods** — `getPath()`, `getNodes()`, `getSelection()`, `setPath(ids, {silent, focus})`
  (async — loads every branch along the way), `reveal(id)`, `setItems()`, `focus()`.
- **Events** — `change {path, nodes, node}`, `activate {node, id}`.
- **Keyboard** — ↑/↓ move within the active column, → steps into the selected branch and lands on
  its first row, ← returns to the parent column and truncates the path, Home/End, Enter opens a
  leaf, typing jumps to the next match.
<!-- /doc -->

<!-- doc:form -->
### Form / Fieldset / Field

#### Form

- **Options** — `fieldsets: []`, `actions: [button descriptors]`, `novalidate: true`.
- **Methods** (proxied across the fieldsets) — `getValues()`, `setValues()`, `getField()`,
  `setValue()`, `getValue()`, `reset()`, `setHighlights()`, `clearHighlights()`, `addFieldset()`,
  `setActions()`, `submit()`.
- **Events** — `submit {values}` (preventable; required/int/float validation runs first),
  `invalid {errors}`, `change {id, value}`.

#### Fieldset

- **Options** — `title`, `columns: 1|2|3`, `fields: { id: Field-options }`.
- **Methods** — `addField(id, opts)`, `getField`/`hasField`/`getFields`,
  `getValues`/`setValues`/`getValue`/`setValue`, `reset`, `clear`, `focus(id)`,
  `setHighlights`/`clearHighlights`.

#### Field

- **Options** — `id`, `type: 'text'`, `label`, `description`, `value`, `placeholder`, `required`,
  `disabled`, `options`, `layout: 'stack'|'inline'`, `props: {}`.
- **Built-in types** — `text`, `password`, `textarea`, `checkbox`, `int`, `float`, `select`,
  `optionlist`, `hidden`, `html`.
- **Methods** — `getValue`/`setValue`, `focus`, `reset`, `setDisabled`,
  `setHighlight(msg, kind)`, `clearHighlight`, `getInput`, `own(child)`, plus the statics
  `Field.register(type, adapter)` and `Field.has(type)`.
- **Events** — `change {value}`, `invalid {message}`.
<!-- /doc -->

<!-- doc:form-widgets -->
### Field widget types

Beyond the built-in field types, these widget types wrap whole components, used as
`{ type, label, props: {…component options…} }`. They are registered by
`registerFieldAdapters()`, which `src/index.js` calls by default.

- `zxselect` (Select), `checklist` (Checklist), `tagpicker` (TagPicker), `number` (NumberField),
  `rating` (Rating).
- `date`/`month`/`datetime` (Datebox/MonthPicker — pass a `Date` value), `time` (Timebox).
- `valuelist` (ValueList), `multivalueeditor` (MultiValueEditor), `upload` (FieldUpload),
  `toggle` (Toggle).
<!-- /doc -->

<!-- doc:questionnaire -->
### Questionnaire

A guided, one-question-at-a-time flow: onboarding intake, a service-call checklist, an audit form,
a feedback survey. The questionnaire owns the ordered items, the active one, the answers,
validation, progress and navigation; the page, card, dialog or drawer around it owns closing,
persistence and transport.

The root is a real `<form>` and the choices are native radios and checkboxes carrying the item
name, so `new FormData(questionnaire.toElement())` reads the answers, arrow keys inside a choice
group are the browser's rather than ours, and the semantics do not depend on JavaScript. Three
things separate it from a `Form` with one `Fieldset` per question: it branches, its answer control
can be any registered `Field` type, and its validation may be asynchronous.

- **Options** — `items: [{name, prompt, description?, section?, required?, multiple?, skippable?,
  choices?, input?, field?, when?, next?, validate?}]`, `answers: {}` and `active: null` (the
  resume pair), `progress: true`, `review: false`, `advance: 'manual'|'auto'`, `shortcuts: true`,
  `allowBack: true`.
- **Choices** — `[{value, label, description?, icon?, key?, disabled?, exclusive?}]`. `exclusive`
  is the "None of the above" behaviour: picking it clears the rest of a `multiple` item, and
  picking anything else clears it.
- **Methods** — `setItems()`, `getItems()`, `goTo(name)`, `next()`, `previous()`, `skip()`,
  `submit()`, `getAnswers()`, `getAnswer(name)`, `setAnswers(values, {silent})`,
  `setAnswer(name, value, {silent})`, `getActive()`, `getPath()`, `getProgress()`, `getState()`,
  `toFormData()`, `reset()`, `focus()`, `destroy()`. `next()`, `skip()` and `submit()` return
  **promises** — `next()` because an item's `validate` may be asynchronous, and `skip()` because
  skipping the last question submits. Everything else is synchronous.
- **Events** — `change {name, value, answers}`, `navigate {from, to, reason}` **preventable**,
  `skip {name}`, `invalid {name, message}`, `submit {answers, path}` **preventable**,
  `complete {answers, path}`.
- **Branching** — `when(answers)` decides whether an item is asked at all, and `next` (a name, or
  `(answer, answers) => name`) decides what follows. Conditions **cascade**: each predicate sees
  only the answers of visible items declared before it, so hiding the VAT question also hides
  whatever depended on the VAT id. An answer to a conditioned-out question is kept internally —
  walk back into the branch and it is still there — but is left out of `getAnswers()` and
  `toFormData()`, so an abandoned branch never submits stale data. A `next` naming a hidden item
  walks forward from it rather than stranding the reader; naming an item that does not exist
  throws `RangeError`.
- **Path and progress** — `getPath()` is the questionnaire's memory of the route walked, and
  `previous()` pops it: once a branch has been taken, "previous" is not `index - 1`. `getProgress()`
  returns `{index, answered, total, percent, section}` where `total` is the path plus the items
  still reachable — exact for a static flow, an estimate once a function `next` can jump somewhere
  the forward walk cannot predict.
- **Field answers** — `field: {type: 'date'|'number'|'zxselect'|'rating'|'upload'|…}` hands the
  answer to a `Field`, so any registered field type works, including ones an application registered
  itself. The `<legend>` already asks the question, so the Field's own label is hidden from sight
  but kept as the control's accessible name unless the item gives `field.label` explicitly; the
  Field draws its own highlight, so a failing answer shows one message, not two.
- **Validation** — `required` is checked synchronously; an item's `validate(answer, answers)` may
  return a message, `null`, or a **promise** of either, and a rejection is reported as its message.
  While the check is pending the root carries `data-state="checking"` and `aria-busy="true"` and
  the actions are disabled.
- **Review** — `review: true` shows a summary of every answer on the path before submitting, each
  with an Edit that reopens that question; Continue from an edited question comes straight back to
  the review rather than replaying the tail.
- **Semantics** — the item is a `<fieldset>` and the prompt its `<legend>`; the description and the
  error are associated through `aria-describedby`, the error is a `role="alert"`, and a failing
  item carries `aria-invalid="true"`. `data-state` on the root is
  `asking`, `checking`, `review`, or `complete`. Submitting does not replace the content: it sets
  `data-state="complete"`, hides the actions, and emits `complete`, leaving the thank-you screen to
  the application.
- **Keyboard** — `1`–`9` then `a`–`z` pick the matching answer, assigned in choice order (an
  explicit `key` is reserved first, so adding one never renumbers the others) and shown as a key
  cap on each choice; the caps are `aria-hidden`, since a screen-reader user moves through the
  group with the arrow keys the radios already provide. `Enter` continues, except in a `multiline`
  input. Shortcuts are suppressed while focus is in a text control. Navigating moves focus to the
  new question's fieldset, which is what gets the prompt announced; failing validation moves it to
  the first answer control instead.
<!-- /doc -->

<!-- doc:value-list -->
### ValueList

Tag/chip input. Enter adds a value, Backspace on an empty input removes the last one, and dragging
or Ctrl+Arrow reorders.

- **Options** — `values: []`, `placeholder`, `deletable: true`, `sortable: true`, `unique: true`,
  `validate: (str)=>bool|string`.
- **Methods** — `getValues()`, `setValues()`, `addValue()`, `removeValue()`, `focus()`,
  `enable()`/`disable()`.
- **Events** — `change {values}`, `add {value}`, `remove {value}`.
<!-- /doc -->

<!-- doc:multi-value-editor -->
### MultiValueEditor

Ordered value editor with explicit rows (add / remove / move).

- **Options** — `values`, `options` (allowed values, which turns the rows into selects),
  `addLabel`, `reorder: 'both'` (`'both'` | `'buttons'` | `'drag'` | `'none'` — a drag handle, the
  up/down buttons, both, or neither).
- **Methods** — `getValues()`, `setValues()`.
- **Events** — `change {values}`.
- Dragging goes through a dedicated handle, so text selection inside a row's input still works. The
  handle is also a keyboard control (Arrow keys, Home, End), which is what keeps `reorder: 'drag'`
  operable without a pointer.
<!-- /doc -->

<!-- doc:field-upload -->
### FieldUpload

Click/drop file upload with progress. The drop zone is keyboard-accessible and progress comes from
`XMLHttpRequest`.

- **Options** — `url`, `paramName: 'upload'`, `params`, `headers`, `multiple: false`, `accept`,
  `maxSize`, `autoUpload: true`, `preview: true`, `http`.
- **Methods** — `upload(files?)`, `abort()`, `clear()`, `setDisabled()`.
- **Events** — `select {files}`, `progress {percent}`, `success {response}`, `error {error}`,
  `abort`.
<!-- /doc -->

<!-- doc:tag-picker -->
### TagPicker

Multi-select combobox that renders its selection as removable tags inside the control (APG combobox
plus multi-selectable listbox). Use it when the catalogue is too large to show in full: `Checklist`
shows a fixed set, and `ValueList` takes free text with no catalogue. Unknown IDs passed to
`setValues` still render as tags, so a stored selection survives a catalogue that has not loaded
yet. Field type: `tagpicker`.

- **Options** — `items`, `values: []`, `valueKey: 'ID'`, `labelKey: 'name'`, `searchKeys`,
  `filter: 'local'|(query)=>Promise<items>`, `minQuery: 0`, `debounce: 200`, `allowCreate: false`,
  `max` (maximum tags; further options become `aria-disabled`), `closeOnSelect: false`,
  `placeholder`, `listHeight: 260`, `disabled`, `readonly`, `renderItem`, `renderTag`.
- **Methods** — `getValues()`, `getItems()`, `setValues(values, {silent})`, `addValue()`,
  `removeValue()`, `clear()`, `reset()`, `setItems()`, `isFull()`, `open()`/`close()`, `focus()`,
  `setReadonly()`, `enable()`/`disable()`.
- **Events** — `change {values, items}`, `add {value, item}`, `remove {value, item}`,
  `create {value, item}`, `query {query}`, `open`, `close`.
- **Keyboard** — ↓ opens and moves, ↑ moves, Enter toggles the active option (or creates one from
  the query), Escape closes, Backspace on an empty input removes the last tag, Home/End jump
  within the list.
<!-- /doc -->

<!-- doc:groupbox -->
### Groupbox

Collapsible titled section built on the native `<details>` element.

- **Options** — `title`, `open: true`.
- **Methods** — `open()`, `close()`, `toggle()`, `isOpen()`, `setTitle()`, `setContent()`.
- **Events** — `open`, `close`.
<!-- /doc -->

<!-- doc:card -->
### Card

A semantic content or record surface. Card is intentionally not a Panel preset: it has no
disclosure state or application chrome, and composes as one repeated item in a grid or list. A
linked Card keeps the root non-interactive and renders a real title anchor as its primary action,
so buttons and links in its action, content, and footer regions remain valid sibling controls.

- **Options** — `title: ''`, `media: null`, `content: null`, `actions: []`, `footer: null`,
  `link: null|string|{href, target?, rel?, onclick?}`, `variant: 'outlined'|'raised'|'filled'`,
  `orientation: 'vertical'|'horizontal'`, `headingLevel: 3`.
- **Methods** — `setTitle()`, `setMedia()`, `setContent()`, `setActions()`, `setFooter()`,
  `setLink()`.
- **Content** — media, body, and footer accept text, a Node, a Component, or null. Enhanced target
  children become body content when no explicit content is supplied, and `destroy()` restores the
  target exactly.
- **Interaction** — `link` stretches the native title anchor across the visual surface; secondary
  controls stay above it and are never nested inside it. A linked card requires a non-empty title.
  Executable/data URL schemes are rejected. Commands belong in `actions`, and selectable cards
  should compose a native checkbox or radio.
- **Layout** — horizontal media uses the public `--zx-card-media-size` hook and stacks through a
  container query when the card itself becomes narrow.
<!-- /doc -->

<!-- doc:panel -->
### Panel / MasterPanel

#### Panel

Framed, optionally collapsible section. Its header is a row rather than one big button: the chevron
and title form the collapse control and `buttons` sit at the trailing edge beside it, so clicking
an action never collapses the panel. The footer bar appears as soon as it has `footer` content,
`footerButtons`, or both, and its buttons are right-aligned.

- **Options** — `title`, `content`, `open: true`, `collapsible: true`, `buttons: []` (elements or
  `button()` descriptors, right-aligned in the header), `footer`, `footerButtons: []`
  (right-aligned in the footer).
- **Methods** — `setTitle()`, `setContent()`, `setButtons()`, `setFooter()`, `setFooterButtons()`,
  `open()`/`close()`/`toggle()`, `isOpen()`.
- **Events** — `open`, `close`.

#### MasterPanel

Full-height application panel with a fixed header (title plus action buttons) and an optional
fixed footer, while the body scrolls.

- **Options** — `title`, `content`, `buttons: []`,
  `module: <ZeyOS module name → accent token>`, `footer`.
- **Methods** — `setTitle()`, `setContent()`, `setButtons()`, `setFooter()`.
<!-- /doc -->

<!-- doc:layout -->
### stack() / grid() / aspect()

The small layout pieces that sit under Panel, SplitView, and MasterPanel: consistent spacing, a
grid that reflows on its own width, and a fixed-ratio box. Zx ships no page grid on purpose — an
ERP screen is a shell of panels, and those components already own that layer. All three are
factories returning elements, and all three are plain classes that work just as well in static
markup with no JavaScript.

- **Factories** — `stack(options, ...children)`, `grid(options, ...children)`,
  `aspect(options, ...children)`; the classes are `.zx-stack`, `.zx-grid`, `.zx-aspect`.
- **stack options** — `direction: 'column'|'row'`, `gap: 4` (1–8 picks the matching `--zx-space-*`
  step; any other value is used as a CSS length), `align: 'start'|'center'|'end'|'stretch'|
  'baseline'`, `justify: 'start'|'center'|'end'|'between'|'around'`, `wrap: false`,
  `inline: false`, `class: ''`.
- **grid options** — `columns: null` (the count at full width; null fills each row with as many
  `min`-wide tracks as fit), `min: '16rem'` (a number is read as pixels), `gap: 4`,
  `align: 'start'|'center'|'end'|'stretch'`, `class: ''`.
- **aspect options** — `ratio: '16 / 9'`, `fit: 'cover'|'contain'|'fill'`, `class: ''`.
- **Behaviour** — the grid reflows intrinsically: each track asks for its share of the row but
  never goes below `min`, so `auto-fit` drops one column at a time as the container narrows. No
  media query is involved, which is why a grid behaves the same in a full-width page, a split
  pane, and a modal — the usual reason a "responsive" grid still breaks inside a narrow panel.
- **Breakpoints** — `breakpoints` (`sm: 480`, `md: 768`, `lg: 1024`, `xl: 1280`),
  `breakpointOf(width)` → `'xs'|'sm'|'md'|'lg'|'xl'`, `matchBreakpoint(name, width)` (the script
  equivalent of a `min-width` query), and `onBreakpoint(handler, {target})` → `{current, destroy}`,
  which fires immediately and then on every crossing. `target` defaults to the window but takes an
  **element**, watched with a `ResizeObserver` — inside a split pane the viewport width says
  nothing about the space actually available. The scale lives in JavaScript rather than as tokens
  because a CSS custom property cannot be used inside a media query.
<!-- /doc -->

<!-- doc:dock -->
### Dock

A stack of collapsible, resizable panes: the docked inspector column of a design tool, and the
detail side of a master–detail screen. Give the root a size of its own (a grid area, `block-size:
100%`, a flex child) when the panes should fill a shell rather than grow with their content.

- **Options** — `orientation: 'vertical'`, `content: null`, `panes: []`, `resizable: true`,
  `collapsible: true`, `lazy: true`, `storageKey: null`.
- **Pane** — `{name, title?, content?, tabs?, active?, size?, min?, grow?, collapsed?,
  collapsible?, side?}`. `content` takes a string, Node, Component, or a factory called on first
  reveal. A pane with `tabs` renders its strip in place of the title; `content` is then ignored.
  `side` (`'start' | 'end'`) only applies when the dock has a `content`.
- **Tab** — `{name, title, content?}`, same content shapes.
- **Methods** — `pane(name)`, `names()`, `add(pane, {index})`, `remove(name)`,
  `collapse(name)`, `expand(name)`, `toggle(name)`, `isCollapsed(name)`, `reveal(name)`,
  `setSize(name, size)`, `getSize(name)`, `activate(pane, tab)`, `getActive(pane)`,
  `state()`, `setState(state)`, `adopt(sheet, options)`, `release(sheet)`.
- **Adopting a Sheet** — `adopt(sheet, {name?, side?, index?, size?, min?, dockAt?})` takes over a
  `Sheet`'s positioning: it becomes a track in the dock rather than an overlay. The dock owns
  where it sits, its size, and its resizing; the sheet keeps its content, header, footer, events,
  and its own `open()`/`close()`. `dockAt` names a breakpoint below which the dock hands the sheet
  back to a free overlay and reclaims the track, re-adopting it above — measured on the **dock's
  own width**, so a dock inside a split pane behaves correctly where a viewport media query would
  not. Because a dock is a flex container by construction it is always a valid host, which is why
  docking needs no arrangement from the application.
- **Ownership** — the dock never owns an adopted sheet: `destroy()` releases them rather than
  destroying them, `remove(name)` on a sheet releases it, and a sheet that destroys itself while
  adopted drops out of the dock cleanly.
- **Events** — `collapse {name}`, `expand {name}`, `resize {name, size}`,
  `tabchange {pane, tab, previous}`, `reveal {name}`.
- **Sizing** — one custom property per pane and one flex rule: a sized pane is
  `flex: 0 0 var(--zx-pane-size)`, a collapsed one falls to `flex: 0 0 auto` with its body hidden,
  and exactly one element grows. With a `content` that is always the content; without one it is the
  pane declaring `grow`, or the last expanded pane. A drag therefore rewrites at most two
  properties, and collapsing a pane feeds the grower rather than redistributing across the stack.
- **Regions** — with `content` the dock is a region rather than a plain stack: panes sit on either
  `side` of the flexible middle. Nesting one dock inside another dock's pane gives a workbench —
  a canvas with an inspector column beside it.
- **`reveal(name)`** — accepts a pane name or a tab name. Expands whichever pane holds it,
  activates the tab when the name is a tab's, and scrolls it into view.
- **Persistence** — `storageKey` remembers sizes, collapsed panes, and active tabs through
  `storage()`, which degrades to memory rather than throwing. `state()`/`setState()` expose the
  same shape for storing it elsewhere; unknown pane names are ignored, so a stored layout survives
  a release that added or removed panes.
- **Keyboard and screen readers** — each pane header is a row, not one big button, so the collapse
  toggle and the tab strip can coexist; the toggle carries `aria-expanded` and `aria-controls`.
  Tabs follow the APG tab pattern with one roving tab stop, Left/Right moving between them.
  Dividers are focusable `separator`s carrying live `aria-valuenow`/`aria-valuemin`/`aria-valuemax`
  in pixels: Up/Down (or Left/Right when horizontal) resize by 16px, Shift by 64px, and Enter or
  Space collapses the pane before the divider. A divider with nothing to resize is taken out of the
  tab order.
- **Out of scope** — drag-to-rearrange, tear-off panels, and multi-column docks. All three are
  additive without changing the API above.
<!-- /doc -->

<!-- doc:tabbox -->
### Tabbox — APG tabs

Four appearances, all square-cornered. `divided` (the default) sets flat blocks on a muted track,
split by hairline dividers, above a bordered panel, with the active block lifted onto the panel
surface under an accent rule. `bracket` outlines folder tabs that fuse into that same panel, the
active tab bridging the seam. `line` underlines the active tab across a full-width rule, for page-
and section-level navigation. `segmented` renders a compact group on a muted fill with the active
tab raised onto a control surface, so the row reads as one control inside a toolbar or card header.

`divided` and `bracket` draw the panel box themselves; `line` and `segmented` leave the panel bare
for the surrounding layout to frame. The boxed variants read `--zx-tabbox-radius` (default `0px`)
from the component root, so `el.style.setProperty('--zx-tabbox-radius', 'var(--zx-radius-lg)')`
restores rounded corners without forking the stylesheet.

- **Options** — `tabs: [{ name, title, content, icon?, closable?, disabled? }]`, `active`,
  `variant: 'divided'|'bracket'|'line'|'segmented'`, `keepAlive: true`.
- **Methods** — `addTab()`, `removeTab()`, `openTab(name)`, `getActive()`, `setTitle()`,
  `setBadge(name, text|null)`, `enableTab()`/`disableTab()`.
- **Events** — `change {name, previous}` (preventable), `close {name}`.
- **Behaviour** — a `closable` tab renders a × that closes it on click, and `close` fires for that
  gesture just as it does for Delete. `removeTab()` is the silent programmatic path. Closing the
  active tab activates its neighbour through the usual `change` event, so a `preventDefault()` on
  that change also vetoes the close.
- **Keyboard** — ArrowLeft/Right and Home/End move focus, Enter/Space activate, Delete closes a
  closable tab. The × is a plain glyph rather than a nested button (buttons cannot nest), so
  keyboard and screen-reader users close through Delete; focus lands on the neighbouring tab.
<!-- /doc -->

<!-- doc:stepper -->
### Stepper

Linear progress through a multi-step flow: a numbered `<ol>` where each step is upcoming, active,
complete, or errored. It promotes the markup the checkout and record wizards used to hand-roll.
Advancing past a step marks it complete automatically, and only steps the `clickable` policy allows
are rendered as real buttons — the rest are not focusable at all. A horizontal rail fills the width
it is given: the labels keep their own width and the connectors stretch to take the slack, wrapping
onto more lines only when the container is too narrow to hold them.

- **Options** — `steps: [{name, title, description?, optional?, disabled?}]`, `active` (defaults to
  the first enabled step), `orientation: 'horizontal'|'vertical'`, `clickable:
  'completed'|'all'|false` (default `'completed'`, so users can go back but not skip ahead),
  `showNumbers: true`, `counter: false` (adds a "Step 2 of 4" line).
- **Methods** — `setSteps()`, `goTo(name)`, `next()`, `previous()`, `getActive()`, `getIndex()`,
  `complete(name)`/`uncomplete(name)`, `setError(name, boolean)`, `setDisabled(name, boolean)`,
  `getState()` → `{active, index, completed, errored}`, `destroy()`.
- **Events** — `change {name, previous, index}`, **preventable** with `event.preventDefault()` so a
  step can refuse to be left until its form validates.
- **Semantics** — the active step carries `aria-current="step"`; every step carries
  `data-state="upcoming"|"active"|"complete"|"error"`, and complete and errored steps swap the
  number for a `check` or `warning` glyph.
<!-- /doc -->

<!-- doc:breadcrumb -->
### Breadcrumb

The trail above a hierarchy view. It pairs directly with `Finder` and `TreeView`: feed
`getNodes()` from a Finder's `change` event into `setItems()` and the two stay in step. When
`maxVisible` is exceeded the middle collapses behind an ellipsis `MenuButton`, always keeping the
first and last items.

- **Options** — `items: [{name, label, icon?, href?}]`, `maxVisible: 0` (0 shows all),
  `separator: 'chevron'|'slash'`, `rootIcon: null`.
- **Methods** — `setItems()`, `getItems()`, `push(item)`, `pop()`, `truncateTo(name)`, `destroy()`.
- **Events** — `select {name, item, index}`. An item with an `href` renders as a real `<a>` and its
  default is left alone, so ordinary navigation and middle-click still work; without one it renders
  as a `<button>` and only the event fires.
- **Semantics** — `<nav aria-label="Breadcrumb"><ol>`; the last item is plain text carrying
  `aria-current="page"` and is deliberately not interactive; separators are `aria-hidden`.
<!-- /doc -->

<!-- doc:pagination -->
### Pagination

The pager for a server-backed list, shaped to drop straight onto `Table` with
`sortMode: 'server'` or onto the `zeyosTable` binding — `getState()` hands back the `offset` and
`pageSize` a query needs. `page` is 1-based and always clamped into `[1, pages]`; a `total` of 0 is
treated as one empty page rather than zero pages.

- **Options** — `page: 1`, `pageSize: 25`, `total: 0`, `pageSizes: [25, 50, 100]`, `siblings: 1`,
  `boundaries: 1`, `showPageSize: true`, `showSummary: true` (renders "26–50 of 312"),
  `mode: 'pages'|'loadmore'`, `disabled: false`.
- **Methods** — `setPage(n)`, `setTotal(n)`, `setPageSize(n)`, `setState({page, pageSize, total},
  {silent})`, `getState()` → `{page, pageSize, total, pages, offset}`, `enable()`/`disable()`,
  `destroy()`.
- **Events** — `change {page, pageSize, offset, total, pages}`, fired for a page change, a
  page-size change (which resets to page 1), and Load more.
- **Also exported** — `paginationRange({page, pages, siblings, boundaries})` → `Array<number|'…'>`,
  the pure page-window calculation, usable on its own.
- **Semantics** — `<nav aria-label="Pagination">`; the current page carries `aria-current="page"`;
  previous/next are labelled icon buttons that go `disabled` at the ends; the ellipses are
  `aria-hidden` spans, not buttons.
<!-- /doc -->

<!-- doc:navigation-bar -->
### NavigationBar

Application navigation bar: brand, items, and right-aligned actions. Items overflow into a "More"
menu on narrow widths.

- **Options** — `title`, `items: [{ name, title, badge? }]`, `active`, `actions: []`.
- **Methods** — `setTitle()`, `setItems()`, `setActive()`, `setBadge()`, `setActions()`.
- **Events** — `change {name}`.
<!-- /doc -->

<!-- doc:app-sidebar -->
### AppSidebar — application navigation in every presentation

One route-agnostic application-navigation owner with an expanded vertical tree, a minimized
vertical rail, and horizontal rail layouts. It mounts exactly one presentation at a time while
preserving active and expanded branch state. Only the expanded vertical state reveals descendants
inline; every rail state opens descendants toward the workspace in anchored flyouts.

- **Options** — `items`, `active`, `expanded`, `collapsed`, `collapsible`,
  `orientation: 'vertical'|'horizontal'`, `side: 'left'|'right'|'top'|'bottom'`, `label`,
  `header`, `footer`, `railHeader`, `railFooter`, `openDelay: 80`, `closeDelay: 160`, and
  `renderIcon(item, context)`. Icon values may also be names, nodes, components, or factories.
- **Methods** — `setItems()`, `getItems()`, `setActive()`, `setExpanded()`, `getExpanded()`,
  `toggleBranch()`, `expand()`, `collapse()`, `setCollapsed()`, `isCollapsed()`,
  `setLayout({orientation, side})`, `openFlyout(id, {focus})`, `closeFlyout()`,
  `closeAllFlyouts()`, `isFlyoutOpen()`, `focus()`, `destroy()`.
- **Events** — cancelable `select {item, id, value, href, event}`,
  `branchchange {item, id, expanded, ids}`, `collapsechange {collapsed}`, and
  `flyoutchange {item, id, open}`.
- **Presentation state** — horizontal navigation is always effectively minimized and never exposes
  an expand control. Switching layouts does not erase the saved vertical collapsed preference or
  expanded branch IDs. `AppSidebar` is the single public application-navigation component; use
  `collapsed: true` or `orientation: 'horizontal'` for its rail presentations.
- **Pointer and focus** — hover or focus reveals rail descendants without stealing focus. Click,
  Enter, Space, and the arrow toward the workspace also open a flyout; Escape, outside activation,
  or selection closes it. Expanded navigation supports arrows plus Home/End across visible rows.
- **Semantics** — persistent navigation uses `<nav>` and nested lists with native links and
  disclosure buttons, not menu or menubar roles. Icon-only destinations retain an accessible name
  and Tooltip. A parent with children is disclosure-only; add an Overview child when it also needs
  a destination. Malformed and executable URL schemes are stripped; an item with no remaining
  link or callback is disabled in every presentation.
<!-- /doc -->

<!-- doc:kernel -->
### Core helpers

- **Component** — the base class: `on`/`off`/`once`/`emit`, `listen`, `toElement`, `msg`,
  `destroy`, and the static `Component.from(el)`.
- **DOM** — `h(tag, props, ...children)`, `h.raw(html)`, `htmlEscape`, `resolveElement`. The current
  ZeyOS builder is also first-class: `__(tag#id.class, properties, content)` is the migration alias
  for `compactElement()`. It preserves `D*` data, `S*` style, boolean/built-in property, attribute,
  and legacy `on*` callback rules while keeping content text-safe. `applyCompactProperties`,
  `appendContent`, `appendCompact` (parent return), `appendCompactChild` (child return), and
  `fragment(...children)` are the pure forms.
- **Compact events** — `onCompactEvent`, `offCompactEvent`, and `fireCompactEvent` share one
  newest-first handler registry. Existing `DOM.on/remEvt/fireEvt` methods can delegate to this
  triad. Zx never installs globals or alters DOM prototypes; the current application owns those
  temporary seams while `UI.new*` implementations are replaced without rewriting `PG` routing.
- **Icons** — `icon(name, {size, label})` and `icons`; see the Icons section — bundled inline SVG
  by default, Font Awesome after an opt-in.
- **Positioning** — `position(anchor, floating, {placement, offset, flip, matchWidth})` →
  `{update, destroy}`. It anchors a manual popover with CSS anchor positioning where the browser
  supports it and a scroll/resize-tracked fallback where it does not. Options are resolved once,
  so changing a placement means `destroy()` and a fresh `position()` call.
- **i18n** — `setTranslator`, `setLanguage`, `getLanguage`, `translate`, `printf`.
- **Dates** — `formatDate(d, fmt)`, `parseDate(s, fmt)` (tokens
  `%d %m %Y %y %H %M %S %a %A %b %B %s`), `clampDate`, `isSameDay`, `addDays`, `addMonths`,
  `getWeekStart`.
- **Keyboard** — `focusTrap`, `rovingTabindex`, `typeahead`.
- **Utils** — `debounce`, `uid`, `deepMerge`, `isElement`, `clamp`, `toArray`.
<!-- /doc -->

<!-- doc:icons -->
### Icons — bundled glyphs or Font Awesome

`icon(name, {size, label, class, style, family, fixedWidth})` returns an element: an inline `<svg>`
from the bundled set, or an `<i>` carrying Font Awesome classes. Both get `class="zx-icon"`, so
component CSS styles either. Zx renders the bundled glyphs by default and **never loads anything on
its own** — Font Awesome is an opt-in an application makes.

```js
import { loadFontAwesome, useFontAwesome, registerIcons } from '/assets/zx.esm.js';

await loadFontAwesome({ kit: 'ae8320b210', style: 'duotone' });  // injects the kit, switches over
useFontAwesome();                          // page already carries Font Awesome; no network
registerIcons({ rocket: ['0 0 512 512', 'M…'] });   // extend the bundled inline set
```

- `loadFontAwesome(kit | {kit, style, family, fixedWidth, activate})` — injects the kit script once
  per URL (a kit token expands to `https://kit.fontawesome.com/<token>.js`), adopts a kit the page
  already embeds, then switches the renderer. Rejects if the script fails; kits only load on the
  domains configured in the Font Awesome account.
- `useFontAwesome(opts)` / `useBuiltinIcons()` / `configureIcons(opts)` / `getIconConfig()` —
  switch or read the renderer without touching the network.
- `iconNames()` lists every inline glyph; `registerIcons(map)` adds `[viewBox, path]` entries.

**Names decide their own renderer.** A bare name (`'check'`) follows the active provider, and the
built-in names are translated to their Font Awesome counterparts (`x` → `fa-xmark`, `search` →
`fa-magnifying-glass`, `warning` → `fa-triangle-exclamation`, …), so component code never changes.
Prefixes override: `'fa:user'`, `'fas:user'`/`'regular:user'`/`'duotone:user'`/`'thin:user'`,
`'kit:zeyos-notes'` (custom kit icons), `'builtin:check'` (force the inline SVG). A literal class
list — `'fa-sharp fa-solid fa-user'` — is used verbatim. Unknown *built-in* names throw
`RangeError`; unknown names under Font Awesome are passed through to the kit.

Font Awesome elements are sized with `font-size` and occupy 1em; bundled SVGs use width/height
attributes. Both honour `label` (`null` ⇒ `aria-hidden`, otherwise `role="img"` + `aria-label`).
<!-- /doc -->

<!-- doc:helpers -->
### Helper functions

Standalone exports with no DOM ownership and no lifecycle, importable individually from the same
entry point as the components. See also the Kernel section for `Component`, `h`, `icon`, and
`position` — the substrate the components themselves are built on.

- **Dates** — `formatDate(date, fmt)`, `parseDate(str, fmt)` (returns `null` when the string does
  not match, so it doubles as a validator), `clampDate(date, min, max)`, `isSameDay(a, b)`,
  `addDays(date, n)`, `addMonths(date, n)`, `getWeekStart(lang?)` → `0` (Sunday) or `1` (Monday).
  strftime-style tokens: `%d %m %Y %y %H %M %S %a %A %b %B %s`.
- **Numbers, money and time** — `formatNumber(value, {locale, decimals, minDecimals, maxDecimals,
  group=true})`, `formatCurrency(value, currency, {locale, decimals})`, `formatPercent(value,
  {locale, decimals=0})` (takes a fraction, so `0.42` → `42%`), `formatFileSize(bytes, {locale,
  decimals=1, standard='iec'})` (`'iec'` → KiB/MiB/GiB in steps of 1024, `'si'` → kB/MB/GB in steps
  of 1000; `0` → `'0 B'`, trailing zeros dropped), `formatRelativeTime(date, {now=new Date(),
  locale, numeric='auto'})` (picks the largest sensible unit from second to year; accepts a `Date`,
  Unix seconds, or an ISO string). `locale` defaults to `getLanguage()` throughout, so
  `setLanguage()` drives all five. Nothing throws: `null`, `undefined` and `NaN` all format as
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
- **Escaping** — `htmlEscape(str)`, and `h.raw(html)` as the only sanctioned `innerHTML` path, for
  component-generated markup only. `escapeRegExp(value)` makes user input safe as a literal
  pattern, and `highlightMatch(text, query, {className='zx-mark'})` → `DocumentFragment` wraps
  every case-insensitive occurrence in a `<mark>` built from text nodes, with no `innerHTML`
  involved — the pairing every filtering list wants.
- **Storage** — `storage(namespace, {area='local'})` → `{get, set, remove, keys, clear}`, a
  namespaced JSON-encoded view of `localStorage` (or `sessionStorage` with `{area: 'session'}`).
  Keys are written as `zx:<namespace>:<key>`, so features share an origin without colliding and
  `clear()` empties only its own namespace; `keys()` reports namespace-relative names.
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
  `translate(key, args)`, `printf(str, args)` (`%s` placeholders). Every component routes its
  built-in strings through `translate()`, so one translator covers the library, and
  `setLanguage()` also drives locale-dependent behaviour such as the first day of the week.
- **Keyboard** — `focusTrap(container)` → `{activate, release}` confines Tab to a container;
  `rovingTabindex(container, itemSelector, {orientation, wrap})` → `{focusFirst, focusLast,
  destroy}` keeps one tab stop in a group; `typeahead(getItems, onMatch)` →
  `(event|string) => void` resolves buffered printable keystrokes to an item (500 ms buffer,
  repeated-letter cycling).
<!-- /doc -->

<!-- doc:truncate -->
### truncate()

Clamps text to a number of lines and gives the cut-off text back on hover. The tooltip half is
what makes it more than a CSS class: a cell that silently drops the end of a value is a data-loss
bug wearing a layout costume, while a tooltip that is always there is noise.

- **Signature** — `truncate(target, {lines, title})` → `{update, isTruncated, destroy}`.
- **Options** — `lines: 1` (1–10; one line ends in an ellipsis, more clamp the block),
  `title: true` — sets a native `title` **only while the text is actually cut off**, re-measured
  through a `ResizeObserver` on every resize, and restores any previous title on `destroy()`.
- **Controller** — `update()` re-measures and returns the current state, `isTruncated()` reports
  the last measurement, `destroy()` removes the class, the observer, and any title it set.
- **Exported helper** — `isTruncated(element)` compares scroll and client sizes on both axes (a
  single line runs out of width, a clamped block runs out of height) with a one-pixel tolerance
  for the sub-pixel difference fractional zoom produces.
- **Class** — `.zx-truncate` alone does the clamping from static markup with no JavaScript;
  `data-lines` plus `--zx-truncate-lines` select the multi-line form.
<!-- /doc -->

<!-- doc:elements -->
### Custom elements — `defineElements()`

Call `defineElements()` once to register `<zx-*>` light-DOM wrappers with attribute↔option
reflection and ElementInternals form association, so they participate in a native `<form>` and its
`FormData`. Events bubble as `zx-*` on the host element, and removing an element from the DOM
destroys its component.

Registered elements: `<zx-toggle>`, `<zx-check-button>`, `<zx-select items='[…]' required>`,
`<zx-checklist>`, `<zx-datebox>`, `<zx-timebox>`, `<zx-search>`, `<zx-groupbox>`, `<zx-tabbox>`,
`<zx-table>`, `<zx-dialog>`.
<!-- /doc -->

<!-- doc:tokens -->
### Design tokens

Two tiers of CSS custom properties. Dark mode and density are pure token/attribute swaps
(`[data-zx-theme="dark"]`, `[data-zx-density="compact"]`), and `tests/lint-tokens.js` forbids raw
colour literals and tier-1 references in component CSS.

- **Tier 1** — the global palette in `styles/tokens/global.css`, never referenced by components:
  `--zx-gray-0…950`, `--zx-green-*`, `--zx-red/amber/blue-*`, `--zx-space-1…8`,
  `--zx-radius-sm/md/lg/full`, the type scale, shadows, and motion.
- **Tier 2** — the semantic set, the only tokens components may use: `--zx-color-*`,
  `--zx-control-*`, `--zx-focus-ring`, `--zx-overlay-shadow`.
- **Component styling hooks** — a short, deliberately small set of component-level custom
  properties for restyling one component without touching its internals. Each falls back to the
  semantic token it replaces, so setting none of them changes nothing:
  `--zx-table-header-bg`, `--zx-table-row-hover-bg`, `--zx-table-row-selected-bg`,
  `--zx-table-border-color`, `--zx-button-radius`, `--zx-panel-header-bg`.
  Reach for the least specific override that works: a global semantic token first, one of these
  second, an internal selector never. Component CSS declares many other `--zx-<component>-*`
  properties — those are internal geometry, not API, and will change without notice.
<!-- /doc -->
