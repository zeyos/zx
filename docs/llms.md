# Zx — agent reference

> Zx is the dependency-free, vanilla-JavaScript UI component library for ZeyOS business
> applications. ES2022 modules, WAI-ARIA-accessible native controls, semantic `--zx-*` design
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

## gx compatibility

Load `zx-compat.global.js` (or import `zx-compat.esm.js`) →
`window.gx.{core,ui,util,zeyos,bootstrap}` wrapping Zx components (constructor/option/event-name
translation, MooTools-style `addEvent`). `gx.compat.installGlobals()` (opt-in) installs `__()`,
`_()`, `String.htmlSpecialChars`, and the element `store/retrieve` shim. Full namespace listing in
the "gx compatibility layer" component section below; class map and unsupported legacy APIs in
`MIGRATION.md`.

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
website/                 marketing page + docs.html (docs.js)          specs/  per-component specs
website/demos/           per-component demo modules    website/layouts/  application layout examples
tests/                   node unit + smoke    dist/       built bundles

npm run serve   # http://127.0.0.1:8321/website/docs.html  (no build)
npm test        # node --test tests/unit/*.test.js  +  node tests/lint-tokens.js
npm run build   # dist/: zx.esm.js, zx.global.js (window.zx), zx-compat.global.js (window.gx), zx.css
node tools/build-module-tokens.js   # regenerate styles/tokens/modules.css from src/zeyos/modules.js
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

<!-- doc:number-field -->
### NumberField
Numeric input with decrement/increment buttons, following the APG **spinbutton** pattern. Options: `value` (number|null), `min`, `max`, `step: 1`, `largeStep: 10` (PageUp/PageDown multiplier), `precision` (decimals; derived from `step` when null), `wrap: false` (stepping past a bound jumps to the other one), `placeholder`, `unit` (suffix rendered inside the control), `group: false` (thousands separators while idle), `locale`, `disabled`, `readonly`, `required`, `name`. Methods: `get()`, `set(value, {silent})` (parses strings, snaps to the step grid, clamps to the range; `''`/null clear it), `stepUp(n)`, `stepDown(n)`, `setRange(min, max)`, `setReadonly()`, `reset()`, `focus()`, `getInput()`, `enable()`/`disable()`. Events: `change {value}` (committed), `input {value}` (per keystroke, possibly unsnapped). Keyboard: ↑/↓ one step, PageUp/PageDown `largeStep` steps, Home/End jump to `min`/`max` when set (otherwise they keep their caret meaning), Enter commits, wheel steps while focused. The step buttons are `tabindex="-1"`/`aria-hidden` pointer affordances — the input is the spinbutton. Also exported: `parseNumber(raw)` (accepts `.` and `,` as the decimal separator, ignores grouping, returns null for junk) and `snapNumber(value, {min, max, step, precision})`. Field type: `number`.
<!-- /doc -->

<!-- doc:rating -->
### Rating
Star rating built as an APG **radio group**: one radio per selectable step, a single tab stop, arrow-key selection. Options: `value: 0` (0 = unrated), `max: 5`, `allowHalf: false` (renders two radios per symbol so every reachable value has a nameable control), `clearable: true` (re-selecting the current value clears it), `readonly`, `disabled`, `label: 'Rating'`, `icon: 'star'`, `labels: []` (per-step accessible names, lowest first), `showValue: false`, `count` (rating count shown beside the value), `size: 'sm'|'md'|'lg'`. Methods: `get()`, `set(value, {silent})`, `clear()`, `reset()`, `setCount()`, `setReadonly()`, `focus()`, `enable()`/`disable()`. Events: `change {value}`, `hover {value|null}` (pointer or focus preview; null on leave). Keyboard: ←/↓ and →/↑ step, Home selects the first step, End the last, Delete/Backspace clear. Field type: `rating`.
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
Sortable, selectable, sticky-header data table (one component covering both legacy gx.ui.Table and SimpleTable). Options: `columns: [{ id, label, sortable?, width ('120px'|'2fr'|'auto'), align, render?: (row,i)=>Node|string, sortValue?, headerTitle? }]`, `data`, `rowId: 'ID'`, `sort: { id, dir }`, `sortMode: 'local'|'server'`, `selectable: false|'single'|'multi'`, `stickyHeader: true`, `height`, `emptyText`, `rowClass`, `zebra: true`. Methods: `setData()`, `addData()`, `updateRow(id,row)`, `removeRow(id)`, `getRow(id)`, `getData()`, `empty()`, `setSort(id,dir)`, `getSelection()`, `setSelection(ids)`, `clearSelection()`, `setLoading(bool)` (busy/skeleton state — dims rows, shows an indeterminate top bar, sets `aria-busy`; auto-cleared by `setData`). Events: `rowclick {row, id, index, event}`, `rowdblclick`, `sort {id, dir}`, `selectionchange {rows, ids}`, `datachange {rows}`. `fr` widths fill the container; px/auto widths scroll horizontally. Multi-select adds a tri-state header checkbox and Shift+click range select.
<!-- /doc -->

<!-- doc:data-filter -->
### DataFilter
Declarative client-side filter bar producing a filtered array (commonly wired to a Table). Options: `filters: [{ type: 'select'|'text'|'custom', id, label, field(s)|get, options?, predicate?, emptyLabel?, placeholder? }]`, `data`, `autoApply: true`, `clearLabel`. Methods: `setData()`, `apply()` → rows, `clear()`, `getState()`, `setState()`, `addFilter()`. Event: `filter {rows, state}`. Common pattern: `onfilter: (e) => table.setData(e.detail.rows)`.
<!-- /doc -->

<!-- doc:tree -->
### TreeView
Hierarchical tree implementing the APG **tree** pattern. Rows render as a flat list carrying `aria-level`/`aria-setsize`/`aria-posinset` (the flattened variant the APG allows) rather than nested `role="group"` containers. Options: `items` (nested), `valueKey: 'ID'`, `labelKey: 'name'`, `childrenKey: 'children'`, `expanded: []`, `selection: 'single'|'multi'|false`, `selected: []`, `checkboxes: false` (tri-state), `checked: []`, `icons: true`, `renderLabel`, `load: (node)=>Promise<children>` (lazy children; mark a branch with `hasChildren: true`), `filter`, `emptyText`, `height`. Methods: `setItems()`, `getItems()`, `getNode(id)`, `getPath(id)`, `setFilter(query)` (keeps matching nodes' ancestors and opens the surviving branches), `expand(id)`/`collapse(id)`/`toggle(id)` (async — they await the loader), `expandAll()`/`collapseAll()`, `reveal(id)`, `select(id, {additive})`, `getSelection()`/`setSelection()`/`clearSelection()`, `check(id, checked)`, `getChecked({leavesOnly})`, `setChecked()`, `focusNode(id)`. Events: `select {node, id, ids}`, `expand`, `collapse`, `activate {node, id}` (Enter or double-click), `check {ids, node}`. Keyboard: ↑/↓ move, → expands then descends, ← collapses then ascends, Home/End, Enter activates, Space selects or toggles the checkbox, `*` expands every sibling, typing jumps to the next match. The component clones `items`, so lazily loaded children never mutate the caller's data.
<!-- /doc -->

<!-- doc:finder -->
### Finder
Miller-columns hierarchy browser: each column lists the children of the row selected in the column to its left, like the macOS Finder's column view. Columns are linked listboxes sharing **one** tab stop. Options: `items` (the same nested shape as `TreeView`), `valueKey`, `labelKey`, `childrenKey`, `path: []` (initial selection, root first), `load: (node)=>Promise<children>`, `preview: (node)=>Node|null` (renders a pane after the last column for a selected leaf), `rootLabel`, `columnWidth: 220`, `height: 320`, `icons: true`, `renderItem`, `emptyText`. Methods: `getPath()`, `getNodes()`, `getSelection()`, `setPath(ids, {silent, focus})` (async — loads every branch along the way), `reveal(id)`, `setItems()`, `focus()`. Events: `change {path, nodes, node}`, `activate {node, id}`. Keyboard: ↑/↓ move within the active column, → steps into the selected branch and lands on its first row, ← returns to the parent column and truncates the path, Home/End, Enter opens a leaf, typing jumps to the next match. The constructor applies `path` silently, so read `getNodes()` for the first paint of any breadcrumb.
<!-- /doc -->

<!-- doc:form -->
### Form / Fieldset / Field
**Form** options: `fieldsets: []`, `actions: [button descriptors]`, `novalidate: true`. Proxy methods across fieldsets: `getValues()`, `setValues()`, `getField()`, `setValue()`, `getValue()`, `reset()`, `setHighlights()`, `clearHighlights()`, `addFieldset()`, `setActions()`, `submit()`. Events: `submit {values}` (preventable; required/int/float validation runs first), `invalid {errors}`, `change {id, value}`.
**Fieldset** options: `title`, `columns: 1|2|3`, `fields: { id: Field-options }`. Methods: `addField(id, opts)`, `getField/hasField/getFields`, `getValues/setValues/getValue/setValue`, `reset`, `clear`, `focus(id)`, `setHighlights/clearHighlights`.
**Field** options: `id`, `type: 'text'`, `label`, `description`, `value`, `placeholder`, `required`, `disabled`, `options`, `layout: 'stack'|'inline'`, `props: {}`. Built-in types: `text, password, textarea, checkbox, int, float, select, optionlist, hidden, html`. Methods: `getValue/setValue`, `focus`, `reset`, `setDisabled`, `setHighlight(msg, kind)`, `clearHighlight`, `getInput`, `own(child)`. `Field.register(type, adapter)`, `Field.has(type)`. Events: `change {value}`, `invalid {message}`.
<!-- /doc -->

<!-- doc:form-widgets -->
### Field widget types
Beyond the built-in field types, these widget types wrap full components (used as `{ type, label, props: {…component options…} }`): `zxselect` (Select), `checklist` (Checklist), `tagpicker` (TagPicker), `number` (NumberField), `rating` (Rating), `date`/`month`/`datetime` (Datebox/MonthPicker — pass a `Date` value), `time` (Timebox), `valuelist` (ValueList), `multivalueeditor` (MultiValueEditor), `upload` (FieldUpload), `toggle` (Toggle). Registered via `registerFieldAdapters()` (called by default from `src/index.js`).
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

<!-- doc:tag-picker -->
### TagPicker
Multi-select combobox that renders its selection as removable tags inside the control (APG combobox + multi-selectable listbox). Use it when the catalogue is too large to show in full — `Checklist` shows a fixed set, `ValueList` takes free text with no catalogue. Options: `items`, `values: []`, `valueKey: 'ID'`, `labelKey: 'name'`, `searchKeys`, `filter: 'local'|(query)=>Promise<items>`, `minQuery: 0`, `debounce: 200`, `allowCreate: false`, `max` (maximum tags; further options become `aria-disabled`), `closeOnSelect: false`, `placeholder`, `listHeight: 260`, `disabled`, `readonly`, `renderItem`, `renderTag`. Methods: `getValues()`, `getItems()`, `setValues(values, {silent})`, `addValue()`, `removeValue()`, `clear()`, `reset()`, `setItems()`, `isFull()`, `open()`/`close()`, `focus()`, `setReadonly()`, `enable()`/`disable()`. Events: `change {values, items}`, `add {value, item}`, `remove {value, item}`, `create {value, item}`, `query {query}`, `open`, `close`. Keyboard: ↓ opens and moves, ↑ moves, Enter toggles the active option (or creates from the query), Escape closes, Backspace on an empty input removes the last tag, Home/End jump within the list. Unknown IDs passed to `setValues` still render as tags, so a stored selection survives a catalogue that has not loaded yet. Field type: `tagpicker`.
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
`Component` (base: `on/off/once/emit`, `listen`, `toElement`, `msg`, `destroy`, static `from(el)`). `h(tag, props, ...children)`, `h.raw(html)`, `htmlEscape`, `resolveElement`. `icon(name, {size,label})`, `icons` (see the Icons section — bundled inline SVG by default, Font Awesome after opt-in). `position(anchor, floating, {placement, offset, flip, matchWidth})` → `{update, destroy}`. i18n: `setTranslator`, `setLanguage`, `getLanguage`, `translate`, `printf`. Dates: `formatDate(d, fmt)`, `parseDate(s, fmt)` (tokens `%d %m %Y %y %H %M %S %a %A %b %B %s`), `clampDate`, `isSameDay`, `addDays`, `addMonths`, `getWeekStart`. Keyboard: `focusTrap`, `rovingTabindex`, `typeahead`. Utils: `debounce`, `uid`, `deepMerge`, `isElement`, `clamp`, `toArray`.
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
Standalone exports with no DOM ownership and no lifecycle, importable individually from the same entry point as the components.
**Dates** — `formatDate(date, fmt)`, `parseDate(str, fmt)` (returns `null` when the string does not match, so it doubles as a validator), `clampDate(date, min, max)`, `isSameDay(a, b)`, `addDays(date, n)`, `addMonths(date, n)`, `getWeekStart(lang?)` → `0` (Sunday) or `1` (Monday). strftime-style tokens: `%d %m %Y %y %H %M %S %a %A %b %B %s`.
**Utilities** — `debounce(fn, ms)` (trailing edge, preserves `this`), `uid(prefix='zx')` (unique per page load, safe as a DOM id), `deepMerge(a, b)` (never mutates either input; replaces arrays rather than concatenating), `clamp(n, min, max)`, `toArray(value)` (null → `[]`, string → single entry, iterable/array-like → array), `isElement(value)` (cross-realm safe).
**Escaping** — `htmlEscape(str)`, and `h.raw(html)` as the only sanctioned `innerHTML` path (component-generated markup only).
**Translation** — `setTranslator(fn)`, `setLanguage(lang)`, `getLanguage()`, `translate(key, args)`, `printf(str, args)` (`%s` placeholders). Every component routes its built-in strings through `translate()`, so one translator covers the library; `setLanguage()` also drives locale-dependent behaviour such as the first day of the week.
**Keyboard** — `focusTrap(container)` → `{activate, release}` confines Tab to a container; `rovingTabindex(container, itemSelector, {orientation, wrap})` → `{focusFirst, focusLast, destroy}` keeps one tab stop in a group; `typeahead(getItems, onMatch)` → `(event|string) => void` resolves buffered printable keystrokes to an item (500 ms buffer, repeated-letter cycling).
See also the Kernel section for `Component`, `h`, `icon`, and `position` — the substrate the components themselves are built on.
<!-- /doc -->

<!-- doc:gx-compat -->
### gx compatibility layer
Opt-in re-implementation of the legacy MooTools-era `gx` API on top of Zx, so existing ZeyOS screens keep running while their code is modernised file by file. It lives in its own bundle, is never imported by `src/index.js`, and adds nothing to an application that does not load it.
**Loading** — classic: `<script src="/assets/zx-compat.global.js">` → `window.gx`; module: `import { gx } from '/assets/zx-compat.esm.js'` (or `src/compat/index.js` in-repo). `gx.compat.installGlobals()` additionally installs the legacy free functions `__()`, `_()`, `String.htmlSpecialChars`, and the element `store`/`retrieve` shim. `gx.install(host)` assigns the namespace without the optional globals.
**Namespaces** — `gx.zeyos` (Select/SelectFilter/SelectDyn/SelectPrio, Table, Tabbox, Panel, MasterPanel, Groupbox, Search, Datebox, DatePicker, MonthPicker, TimePicker, Timebox, Toggle, Msgbox, Popup, Dialog, Dropdown, Checklist, Permission, Client, Request, Factory), `gx.bootstrap` (Form, Fieldset, Field, Select variants, Checklist, Table, Tabbox, NavigationBar, MenuButton, Message, Popup/PopupAlert/PopupConfirm, CheckButton, DataFilter, ValueList, MultiValueEditor, FieldUpload, Timebox), `gx.util` (`formatNum`, `formatTime`, `getMinutes`, `getNumber`, `printf`, `parseResult`, `Parse`, `isArray`/`isObject`/`isFunction`/`isString`/`isNumber`/`isElement`/`isNode`, `Console`), `gx.ui` (Container, SimpleTable, Timebox, and inert visual-effect stubs Blend/Collapse/Hud/Toggling/HGroup/Templates), `gx.core` (Settings), `gx.compat` (installGlobals, installElementStorage, parse, GxWrapper).
**Migrating off it** — legacy classes collapse onto fewer Zx components: all four Select variants → one `Select` with a `filter` option; `gx.ui.Table` + `SimpleTable` → one `Table`; `Msgbox`/`bootstrap.Message` → `Message`; `Popup`/`PopupAlert`/`PopupConfirm` → `Modal`/`Dialog` with Promise-returning statics; `gx.zeyos.Client`/`Request` → `@zeyos/client`. Anything that depended on MooTools prototype extensions is gone. `MIGRATION.md` has the full map and the deliberate behaviour changes; `website/compat.html` runs legacy snippets against Zx as a smoke test.
<!-- /doc -->

<!-- doc:elements -->
### Custom elements — `defineElements()`
Call `defineElements()` once to register `<zx-*>` light-DOM wrappers with attribute↔option reflection and ElementInternals form association (they participate in native `<form>`/`FormData`): `<zx-toggle>`, `<zx-check-button>`, `<zx-select items='[…]' required>`, `<zx-checklist>`, `<zx-datebox>`, `<zx-timebox>`, `<zx-search>`, `<zx-groupbox>`, `<zx-tabbox>`, `<zx-table>`, `<zx-dialog>`. Events bubble as `zx-*` on the host element. Removing an element from the DOM destroys its component.
<!-- /doc -->

<!-- doc:tokens -->
### Design tokens
Two tiers of CSS custom properties. **Tier 1** (global palette, `styles/tokens/global.css`) — never referenced by components: `--zx-gray-0…950`, `--zx-green-*`, `--zx-red/amber/blue-*`, `--zx-space-1…8`, `--zx-radius-sm/md/lg/full`, type scale, shadows, motion. **Tier 2** (semantic, the only tokens components may use): the `--zx-color-*`, `--zx-control-*`, `--zx-focus-ring`, `--zx-overlay-shadow` set. Dark mode and density are pure token/attribute swaps (`[data-zx-theme="dark"]`, `[data-zx-density="compact"]`). `tests/lint-tokens.js` forbids raw color literals and tier-1 references in component CSS.
<!-- /doc -->
