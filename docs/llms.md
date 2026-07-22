# Zx — agent reference

> Zx is the dependency-free, vanilla-JavaScript UI component library for the ZeyOS ERP, the
> successor to the MooTools-based "gx" libraries. ES2022 modules, WAI-ARIA-accessible native
> controls, semantic `--zx-*` design tokens (light/dark + cozy/compact), and lifecycle-safe
> components. Zero runtime dependencies. This file is the single, complete reference a coding agent
> needs to build UI with Zx; each component below is wrapped in `<!-- doc:<name> -->` markers so
> tools can extract a single component's section.

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
- Global: `<script src="/assets/zx.global.js">` → `window.zx.*`.
- Styles: load `/assets/zx.css` once.
- Build bundles with `npm run build` (esbuild). No build is needed to develop against `src/`.

## Theming

Load `zx.css`, then set theme/density on any ancestor (usually `<html>`):

```html
<html data-zx-theme="dark" data-zx-density="compact">
```

Themes: `light` | `dark` | `auto` (follows OS). Density: `cozy` | `compact`. Define a product theme
by overriding **semantic** tokens under a `[data-zx-theme="name"]` selector:
`--zx-color-bg-page/surface/raised/control/hover/selected`, `--zx-color-border(-strong/-control)`,
`--zx-color-text(-muted/-placeholder)`, `--zx-color-accent(-hover)/on-accent`,
`--zx-color-danger/warning/success/info(+ -bg)`, `--zx-focus-ring`, `--zx-control-height/-radius`,
`--zx-space-*`, `--zx-radius-*`, `--zx-text-*`. Never use tier-1 palette tokens (`--zx-gray-*`,
`--zx-green-*`) or raw color literals in application/component CSS. Prefer the least-specific
override that works (global token → then, if needed, a component style).

## Talking to ZeyOS — use `@zeyos/client`

For ZeyOS business data use the **dedicated client library** `@zeyos/client`
(`npm install @zeyos/client`) — a zero-dependency, typed OpenAPI client (accounts,
transactions/invoices, tickets, 50+ resources), OAuth2/session auth, retries, schema
introspection. It replaces the legacy `gx.zeyos.Client` / `gx.zeyos.Request`.

```js
import { createZeyosClient, MemoryTokenStore, normalizeListResult } from '@zeyos/client';
const zeyos = createZeyosClient({
  platform: 'https://cloud.zeyos.com/<instance>/',
  auth: { mode: 'oauth', oauth: { tokenStore: new MemoryTokenStore({ accessToken }) } }
});
const { data } = normalizeListResult(await zeyos.api.listTransactions({ filters: { visibility: 0 }, limit: 50 }));
await zeyos.api.updateTransaction({ ID, status: 9 });
```

Feed results straight into Zx components (Table `data`, Select `items`, Form values). See
`website/kitchen-sink.html` for the reference integration. Zx also ships a minimal `Http` /
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
<!-- /doc -->

## Custom elements

`defineElements()` (not auto-called) registers light-DOM `<zx-*>` wrappers with attribute↔option
reflection and ElementInternals form association: `<zx-toggle>`, `<zx-check-button>`, `<zx-select>`,
`<zx-checklist>`, `<zx-datebox>`, `<zx-timebox>`, `<zx-search>`, `<zx-groupbox>`, `<zx-tabbox>`,
`<zx-table>`, `<zx-dialog>`.

## gx compatibility

Load `zx.global.js` then `zx-compat.global.js` → `window.gx.{core,ui,util,zeyos,bootstrap}` wrapping
Zx components (constructor/option/event-name translation, MooTools-style `addEvent`).
`gx.compat.installGlobals()` (opt-in) installs `__()`, `_()`, `String.htmlSpecialChars`, and the
element `store/retrieve` shim. See `MIGRATION.md` for the class map and unsupported legacy APIs.

## Conventions (editing component source)

Follow `AGENTS.md`. Key rules: never declare instance class fields for state used in `render()`
(render runs inside the base constructor before field initializers); route all DOM listeners
through `this.listen()`; no `innerHTML` outside `h.raw()`; express state via ARIA/`data-*`, not
state classes; small glyph buttons use the shared `.zx-icon-btn` utility; follow the named APG
pattern with `:focus-visible` rings and `prefers-reduced-motion` guards.

## File map & commands

```
src/components/<name>/   component + CSS      src/core/   kernel (component, dom, http, i18n, date…)
src/compat/              gx compat layer      styles/     tokens + base.css
website/                 site + component catalog + kitchen sink   specs/  per-component build specs
tests/                   node unit + smoke    dist/       built bundles

npm run serve   # http://127.0.0.1:8321/website/components.html  (no build)
npm test        # node --test tests/unit/*.test.js  +  node tests/lint-tokens.js
npm run build   # dist/: zx.esm.js, zx.global.js (window.zx), zx-compat.global.js (window.gx), zx.css
```

---

# Components

Each component is `new Component(target, options)`. Events are the component-level names (also
dispatched as bubbling `zx-<name>` on the root). Detail is always an object.

<!-- doc:button -->
### Button — `button(options)` / `buttonGroup(buttons)`
Factories (not classes) returning elements. `button({ label, icon, kind: 'default'|'primary'|'danger'|'ghost', size: 'md'|'sm', disabled, title, onclick })` → `HTMLButtonElement`. `buttonGroup([button(...), ...])` → grouped container. `icon` is an icon name (Font Awesome Free solid, inline SVG). Used both standalone and as the `buttons: [{ label, kind, action|onclick }]` descriptors accepted by Dialog/Modal/MasterPanel.
<!-- /doc -->

<!-- doc:check-button -->
### CheckButton
Two-state pressed button (`role`-native `<button aria-pressed>`). Options: `label: '' | [onLabel, offLabel]`, `checked: false`, `icon: true`, `disabled: false`. Methods: `get()`, `set(checked, {silent})`, `toggle()`, `setLabel()`, `enable()`/`disable()`. Events: `change {checked}` — fires only on real state change. Keyboard: Space/Enter.
<!-- /doc -->

<!-- doc:toggle -->
### Toggle
Switch (`role="switch"`, `aria-checked`). Options: `checked: false`, `value: true`, `label: null`, `disabled: false`. Methods: `get()`, `set(checked, {silent})`, `toggle()`, `getValue()` (returns `options.value` when on, `false` when off), `enable()`/`disable()`. Events: `change {checked, value}`. Keyboard: Space/Enter.
<!-- /doc -->

<!-- doc:search -->
### Search
Search input with embedded search + clear buttons (`role="search"`). Options: `placeholder`, `value`, `clearable: true`, `debounce: 250`. Methods: `get()`, `set(value, {silent})`, `focus()`, `clear()`. Events: `input {value}` (debounced), `submit {value}` (Enter/button), `clear`.
<!-- /doc -->

<!-- doc:select -->
### Select — APG editable combobox
Unifies single-select, local filtering, and async loading. Options: `items: []`, `valueKey: 'ID'` (string key or `(item)=>id`), `labelKey: 'name'` (string or `(item)=>string`), `renderItem`, `renderValue`, `value`, `disabled`, `placeholder`, `clearable: false`, `filter: false | 'local' | async (query)=>items`, `searchKeys`, `minQuery: 0`, `debounce: 200`, `listHeight: 280`, `groupKey`. Getters: `.value`, `.selected`. Methods: `set(id, {silent})`, `setItems()`, `reset()`, `open()`/`close()`, `enable()`/`disable()`, `focus()`. Events: `change {value, item}` (item null on clear), `open`, `close`, `query {query}`, `loaded {items}`. Preset: `Select.priority(target, opts)` (5-level priority picker). Keyboard (APG combobox): ArrowDown/Alt+ArrowDown open; arrows navigate (wrap); Home/End; Enter selects; Esc closes; Tab closes; printable chars filter (editable) or typeahead (readonly); `aria-activedescendant` tracks the active option.
<!-- /doc -->

<!-- doc:checklist -->
### Checklist
Searchable multi-check list with optional async loading. Options: `items`, `valueKey: 'ID'`, `labelKey: 'name'`, `checkedKey: 'on'`, `search: true`, `height: 280`, `defaultChecked: false`, `load: async ()=>items`. Methods: `setItems()`, `getValues()`, `setValues(ids)`, `checkAll()`/`uncheckAll()`, `search(query)`, `reload()`. Events: `change {values}`, `loaded`.
<!-- /doc -->

<!-- doc:date-picker -->
### DatePicker / MonthPicker / TimePicker
Inline (embeddable) pickers. **DatePicker** (APG date grid) options: `value: Date|null`, `min`, `max`, `weekStart: 1`, `showWeekNumbers: false`, `time: false`; methods `get()`, `set()`, `focus()`; events `change {date}`, `monthchange {year, month}`; keyboard: Arrows move day, PageUp/PageDown month, Shift+PageUp/PageDown year, Home/End, Enter/Space select; day cells carry `aria-label`. **MonthPicker**: 12-month grid, `get/set` first-of-month, event `change {date}`. **TimePicker**: `value: null`, `seconds: false`, `step: 5`; `get()/set()`; event `change`.
<!-- /doc -->

<!-- doc:datebox -->
### Datebox / DateTimeBox
Text date input + calendar popover. Options: `value: Date | number(unix) | string`, `format: '%d.%m.%Y'`, `time: false`, `min`, `max`, `placeholder`, `clearable: true`, `disabled`. Methods: `get(unit='date')` (`'seconds'` → unix), `set(value, {silent})` (accepts a Date; pass Date objects, not display strings), `open()`/`close()`, `enable()`/`disable()`, `focus()`. Events: `change {date}`, `invalid {text}`, `open`, `close`. `DateTimeBox(target, opts)` = Datebox with `time: true`. Format tokens: `%d %m %Y %H %M` (see date utils).
<!-- /doc -->

<!-- doc:timebox -->
### Timebox
Duration input (H:MM[:SS], optional sign). Options: `value: 0`, `unit: 'minutes'|'seconds'|'hours'`, `seconds: false`, `signed: false`, `disabled`. Methods: `get(unit)`, `set(value, unit?, {silent})`, `enable()`/`disable()`. Events: `change {value}` (in `options.unit`). Also exports pure helpers `splitTime`, `joinTime`.
<!-- /doc -->

<!-- doc:message -->
### Message — toasts, inline, progress
Floating toasts via statics: `Message.info/success/warning/error(msg, opts)`, `Message.show(msg, { kind, timeout=4000, closable })` → `{ close() }`, `Message.progress(text)` → `{ update(pct, text?), done(), fail(text?) }`. Per-message options: `kind: 'info'`, `timeout`, `closable: true`, `maxVisible: 5` (extras queue; hover pauses dismissal). Instance `new Message(target)` gives an inline (non-floating) area with the same `.show()`. Toast region is `role="status"`/`aria-live` (`role="alert"` for errors).
<!-- /doc -->

<!-- doc:modal -->
### Modal
Thin native-`<dialog>` overlay. Options: `content`, `width: 'auto'`, `closable: true`, `lightDismiss: false`, `destroyOnClose: false`. Methods: `open()`, `close(result?)`, `setContent()`, `isOpen()`. Events: `open`, `close {result}`, `cancel` (Esc; preventable via `event.preventDefault()`). Backdrop uses `--zx-color-bg-backdrop`; focus returns to the opener.
<!-- /doc -->

<!-- doc:dialog -->
### Dialog (extends Modal)
Structured modal: header (title + close), body, footer buttons. Options: `title`, `size: 'sm'|'md'|'lg'|number`, `buttons: [{ label, kind, action: 'close'|'cancel'|fn(dialog), autofocus }]`, `closable: true`. Methods: `setTitle()`, `setContent()`, `setButtons()`, `addView(key, { content, buttons? })`, `showView(key)`. Statics returning Promises: `Dialog.alert({ title, message })`, `Dialog.confirm({ title, message, danger })` → boolean, `Dialog.prompt({ title, message, value })` → string|null.
<!-- /doc -->

<!-- doc:dropdown -->
### Dropdown
Generic anchored popover (top layer). Constructor `(anchor, options)`. Options: `content`, `placement: 'bottom-start'|'bottom-end'|'top-start'|'top-end'|'bottom'|'top'`, `offset: 4`, `matchWidth: false`, `openOn: 'click'|'manual'`, `closeOnSelect: false`. Methods: `open()`, `close()`, `toggle()`, `isOpen()`, `setContent()`, `getPanel()`. Events: `open`, `close`. Light-dismiss on outside click + Esc; `aria-expanded` mirrored on the anchor.
<!-- /doc -->

<!-- doc:menu-button -->
### MenuButton — APG menu button
Button opening a `role="menu"`. Options: `label`, `icon`, `kind`, `items: [{ label, icon?, value?, disabled?, danger?, onselect? } | '-']`, `placement`. Methods: `setItems()`, `open()`, `close()`, `setLabel()`. Events: `select {value, item}`, `open`, `close`. Keyboard: ArrowDown/Enter/Space open + focus first; ArrowUp opens + focuses last; Arrow cycle, Home/End, typeahead, Enter/Space select, Esc/Tab close.
<!-- /doc -->

<!-- doc:table -->
### Table
Sortable, selectable, sticky-header data table (single successor to gx.ui.Table + SimpleTable). Options: `columns: [{ id, label, sortable?, width ('120px'|'2fr'|'auto'), align, render?: (row,i)=>Node|string, sortValue?, headerTitle? }]`, `data`, `rowId: 'ID'`, `sort: { id, dir }`, `sortMode: 'local'|'server'`, `selectable: false|'single'|'multi'`, `stickyHeader: true`, `height`, `emptyText`, `rowClass`, `zebra: true`. Methods: `setData()`, `addData()`, `updateRow(id,row)`, `removeRow(id)`, `getRow(id)`, `getData()`, `empty()`, `setSort(id,dir)`, `getSelection()`, `setSelection(ids)`, `clearSelection()`, `setLoading(bool)` (busy/skeleton state — dims rows, shows an indeterminate top bar, sets `aria-busy`; auto-cleared by `setData`). Events: `rowclick {row, id, index, event}`, `rowdblclick`, `sort {id, dir}`, `selectionchange {rows, ids}`, `datachange {rows}`. `fr` widths fill the container; px/auto widths scroll horizontally. Multi-select adds a tri-state header checkbox and Shift+click range select.
<!-- /doc -->

<!-- doc:data-filter -->
### DataFilter
Declarative client-side filter bar producing a filtered array (commonly wired to a Table). Options: `filters: [{ type: 'select'|'text'|'custom', id, label, field(s)|get, options?, predicate?, emptyLabel?, placeholder? }]`, `data`, `autoApply: true`, `clearLabel`. Methods: `setData()`, `apply()` → rows, `clear()`, `getState()`, `setState()`, `addFilter()`. Event: `filter {rows, state}`. Common pattern: `onfilter: (e) => table.setData(e.detail.rows)`.
<!-- /doc -->

<!-- doc:form -->
### Form / Fieldset / Field
**Form** options: `fieldsets: []`, `actions: [button descriptors]`, `novalidate: true`. Proxy methods across fieldsets: `getValues()`, `setValues()`, `getField()`, `setValue()`, `getValue()`, `reset()`, `setHighlights()`, `clearHighlights()`, `addFieldset()`, `setActions()`, `submit()`. Events: `submit {values}` (preventable; required/int/float validation runs first), `invalid {errors}`, `change {id, value}`.
**Fieldset** options: `title`, `columns: 1|2|3`, `fields: { id: Field-options }`. Methods: `addField(id, opts)`, `getField/hasField/getFields`, `getValues/setValues/getValue/setValue`, `reset`, `clear`, `focus(id)`, `setHighlights/clearHighlights`.
**Field** options: `id`, `type: 'text'`, `label`, `description`, `value`, `placeholder`, `required`, `disabled`, `options`, `layout: 'stack'|'inline'`, `props: {}`. Built-in types: `text, password, textarea, checkbox, int, float, select, optionlist, hidden, html`. Methods: `getValue/setValue`, `focus`, `reset`, `setDisabled`, `setHighlight(msg, kind)`, `clearHighlight`, `getInput`, `own(child)`. `Field.register(type, adapter)`, `Field.has(type)`. Events: `change {value}`, `invalid {message}`.
<!-- /doc -->

<!-- doc:form-widgets -->
### Field widget types
Beyond the built-in field types, these widget types wrap full components (used as `{ type, label, props: {…component options…} }`): `zxselect` (Select), `checklist` (Checklist), `date`/`month`/`datetime` (Datebox/MonthPicker — pass a `Date` value), `time` (Timebox), `valuelist` (ValueList), `multivalueeditor` (MultiValueEditor), `upload` (FieldUpload), `toggle` (Toggle). Registered via `registerFieldAdapters()` (called by default from `src/index.js`).
<!-- /doc -->

<!-- doc:value-list -->
### ValueList
Tag/chip input. Options: `values: []`, `placeholder`, `deletable: true`, `sortable: true`, `unique: true`, `validate: (str)=>bool|string`. Methods: `getValues()`, `setValues()`, `addValue()`, `removeValue()`, `focus()`, `enable()`/`disable()`. Events: `change {values}`, `add {value}`, `remove {value}`. Enter adds; Backspace on empty removes last; drag or Ctrl+Arrow reorders.
<!-- /doc -->

<!-- doc:multi-value-editor -->
### MultiValueEditor
Ordered value editor with explicit rows (add / remove / move). Options: `values`, `options` (allowed values → select rows), `addLabel`. Methods: `getValues()`, `setValues()`. Event: `change {values}`.
<!-- /doc -->

<!-- doc:field-upload -->
### FieldUpload
Click/drop file upload with progress. Options: `url`, `paramName: 'upload'`, `params`, `headers`, `multiple: false`, `accept`, `maxSize`, `autoUpload: true`, `preview: true`, `http`. Methods: `upload(files?)`, `abort()`, `clear()`, `setDisabled()`. Events: `select {files}`, `progress {percent}`, `success {response}`, `error {error}`, `abort`. Keyboard-accessible drop zone; upload progress via XMLHttpRequest.
<!-- /doc -->

<!-- doc:permission -->
### Permission
Private / public / group record-permission selector. Options: `value: true|false|groupId`, `groups: []`, `groupsValueKey: 'ID'`, `groupsLabelKey: 'name'`. Methods: `get()` → `'private'|'public'|groupId`, `set(value)`. Event: `change {value}`.
<!-- /doc -->

<!-- doc:groupbox -->
### Groupbox
Collapsible titled section on native `<details>`. Options: `title`, `open: true`. Methods: `open()`, `close()`, `toggle()`, `isOpen()`, `setTitle()`, `setContent()`. Events: `open`, `close`.
<!-- /doc -->

<!-- doc:panel -->
### Panel / MasterPanel
**Panel** — framed, optionally collapsible section. Options: `title`, `content`, `open: true`, `collapsible: true`, `footer`. Methods: `setTitle/setContent/setFooter`, `open()/close()/toggle()`, `isOpen()`. Events: `open`, `close`.
**MasterPanel** — full-height application panel with a fixed header (title + action buttons) and optional footer. Options: `title`, `content`, `buttons: []`, `module: <ZeyOS module name → accent token>`, `footer`. Methods: `setTitle/setContent/setButtons/setFooter`.
<!-- /doc -->

<!-- doc:tabbox -->
### Tabbox — APG tabs
Options: `tabs: [{ name, title, content, closable?, disabled? }]`, `active`, `keepAlive: true`. Methods: `addTab()`, `removeTab()`, `openTab(name)`, `getActive()`, `setTitle()`, `setBadge(name, text|null)`, `enableTab()`/`disableTab()`. Events: `change {name, previous}` (preventable), `close {name}`. Keyboard: ArrowLeft/Right + Home/End move focus, Enter/Space activate, Delete closes a closable tab. Carbon-style underline "line tabs".
<!-- /doc -->

<!-- doc:navigation-bar -->
### NavigationBar
Application navigation bar (brand + items + right-aligned actions). Options: `title`, `items: [{ name, title, badge? }]`, `active`, `actions: []`. Methods: `setTitle()`, `setItems()`, `setActive()`, `setBadge()`, `setActions()`. Event: `change {name}`. Items overflow into a "More" menu on narrow widths.
<!-- /doc -->

<!-- doc:kernel -->
### Core helpers
`Component` (base: `on/off/once/emit`, `listen`, `toElement`, `msg`, `destroy`, static `from(el)`). `h(tag, props, ...children)`, `h.raw(html)`, `htmlEscape`, `resolveElement`. `icon(name, {size,label})`, `icons` (Font Awesome Free solid). `position(anchor, floating, {placement, offset, flip, matchWidth})` → `{update, destroy}`. i18n: `setTranslator`, `setLanguage`, `getLanguage`, `translate`, `printf`. Dates: `formatDate(d, fmt)`, `parseDate(s, fmt)` (tokens `%d %m %Y %y %H %M %S %a %A %b %B %s`), `clampDate`, `isSameDay`, `addDays`, `addMonths`, `getWeekStart`. Keyboard: `focusTrap`, `rovingTabindex`, `typeahead`. Utils: `debounce`, `uid`, `deepMerge`, `isElement`, `clamp`, `toArray`.
<!-- /doc -->

<!-- doc:elements -->
### Custom elements — `defineElements()`
Call `defineElements()` once to register `<zx-*>` light-DOM wrappers with attribute↔option reflection and ElementInternals form association (they participate in native `<form>`/`FormData`): `<zx-toggle>`, `<zx-check-button>`, `<zx-select items='[…]' required>`, `<zx-checklist>`, `<zx-datebox>`, `<zx-timebox>`, `<zx-search>`, `<zx-groupbox>`, `<zx-tabbox>`, `<zx-table>`, `<zx-dialog>`. Events bubble as `zx-*` on the host element. Removing an element from the DOM destroys its component.
<!-- /doc -->

<!-- doc:tokens -->
### Design tokens
Two tiers of CSS custom properties. **Tier 1** (global palette, `styles/tokens/global.css`) — never referenced by components: `--zx-gray-0…950`, `--zx-green-*`, `--zx-red/amber/blue-*`, `--zx-space-1…8`, `--zx-radius-sm/md/lg/full`, type scale, shadows, motion. **Tier 2** (semantic, the only tokens components may use): the `--zx-color-*`, `--zx-control-*`, `--zx-focus-ring`, `--zx-overlay-shadow` set. Dark mode and density are pure token/attribute swaps (`[data-zx-theme="dark"]`, `[data-zx-density="compact"]`). `tests/lint-tokens.js` forbids raw color literals and tier-1 references in component CSS.
<!-- /doc -->
