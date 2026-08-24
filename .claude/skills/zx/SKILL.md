---
name: zx
description: Build accessible front ends with Zx, the dependency-free vanilla-JavaScript implementation of the Xenon Design System. Use when creating or editing UI in this repo, instantiating zx.* components, composing layouts, or theming with --zx-* tokens.
---

# Zx UI library

Zx is a dependency-free, accessible, themeable vanilla-JavaScript implementation of the Xenon
Design System. It was developed through ZeyOS workflows, but its components and contracts are
product-agnostic. Source modules run directly in the browser (no build step to develop);
`npm run build` emits distribution bundles.

## When to use this skill

Use it whenever you create or modify Zx UI: instantiating components, composing forms and tables,
opening dialogs and toasts, theming, adding a `<zx-*>` custom element, or wiring the optional
ZeyOS data binding.

## Core mental model

Every visual component is an ES class extending `Component`, instantiated the same way:

```js
import { Table, Dialog, Toggle } from '/assets/zx.esm.js'; // or window.zx.* from zx.global.js
const t = new Table(target, options);
```

- **`target`** is an `Element`, a selector string, or `null`. `null` means the component creates
  and owns its own root element (`t.el`); get it with `t.toElement()` (or `t.el`) and insert it.
  A non-null target is *enhanced in place* and restored on `destroy()`.
- **Options** are a plain object. `static defaults` per component; never mutate the passed object.
- **Events**: subscribe with `t.on('change', fn)` (alias `addEvent`), or pass an `onchange`
  function option. Handlers receive a `CustomEvent`; read `event.detail` (always an object, e.g.
  `{value, item}`). Each emit also dispatches a bubbling `zx-change` DOM event on `t.el`, so
  `t.el.addEventListener('zx-change', …)` and event delegation work too.
- **Lifecycle**: call `t.destroy()` when done — it aborts all listeners (one AbortController),
  unregisters the element, and removes an owned root. `Component.from(el)` returns the component
  for a root element (replaces the legacy `el.retrieve('com')`).
- **`h(tag, props, ...children)`** is the internal DOM factory (safe: no `innerHTML` except
  explicit `h.raw(trustedHtml)`). The compact `__(tag#id.class, properties, content)` builder is
  also exported for existing application code. Use either for custom content/renderers.

## Component catalog

See `README.md` for the one-line index and `docs/llms.md` for per-component options/methods/events.
Groups (matching the demo sidebar):

- **Inputs**: `button()`, `buttonGroup()`, `badge()`/`badgeGroup()`, `CheckButton`, `Toggle`,
  `Search`, `Select` (APG combobox; `filter: false | 'local' | async fn`; `fixedItems` pins
  choices above the list; `Select.priority()`, `Select.status()`, and `Select.permission()`
  presets), `Checklist`,
  `NumberField`, `Rating`, `Slider` (native range underneath, so the whole
  keyboard map is free; `marks`, `showBounds`, `showInput`), `copyButton()`/`CopyInput`,
  `DatePicker`, `MonthPicker`, `TimePicker` (with an optional clock
  face), `Datebox`/`DateTimeBox`, `DateRangePicker`/`DateRangeBox`, `Timebox`.
- **Overlays**: `Tooltip`/`tooltip()`/`describe()`,
  `Message` (toasts + inline + progress; statics `Message.info/success/warning/error`),
  `Modal`, `Dialog` (views + statics `Dialog.alert/confirm/prompt` returning Promises),
  `Sheet` (a Dialog anchored to one edge — `side`, `modal: true|'trap-focus'|false`, `backdrop`
  incl. `'blur'`, `snap` detents and swipe-to-dismiss; a `Dock` can adopt it and own its
  positioning), `SheetStack` (several sheets as one drill-down; `stack` or `cascade`),
  `Dropdown`, `MenuButton`, `ContextMenu` (right-click **and** the Menu key/Shift+F10; `selector`
  delegates so a table needs one instance, and `items` may be a function of the clicked row).
  Note its root is a zero-sized anchor on `<body>`, so listen with `on('select')`/`onselect` —
  the bubbling `zx-select` does not pass through the target's tree.
- **Data**: `Table` (sortable, selectable, sticky header, local/server sort, opt-in inline
  cell/row editing via `editMode`), `DataFilter`, `Pagination` (+ pure `paginationRange()`).
- **Forms**: `Form` → `Fieldset` → `Field` (type registry: text/password/int/float/textarea/
  checkbox/select/optionlist/hidden/html/custom + widget types zxselect/checklist/date/month/
  datetime/daterange/time/valuelist/multivalueeditor/upload/toggle/number/rating/tagpicker/
  slider), `ValueList`, `MultiValueEditor`, `FieldUpload`.
- **Layout**: `Groupbox`, `Card` (semantic record/content surface), `Panel` (header/footer action
  buttons), `MasterPanel`,
  `Tabbox` (`variant: 'divided'|'bracket'|'line'|'segmented'`, all square-cornered; boxed variants
  read `--zx-tabbox-radius`), `NavigationBar`, `Toolbar` (APG toolbar with an overflow menu),
  `SplitView`, `Dock` (a stack of collapsible, resizable panes — the inspector column of a design
  tool; panes may be tab groups, a `content` turns it into a region with panes on either side, and
  `adopt(sheet)` hands it a `Sheet` to position), `Stepper`, `Breadcrumb`, `emptyState()`, and the
  primitives under them:
  `stack()` (spacing; `gap` 1–8 maps to `--zx-space-*`), `grid()` (reflows on the CONTAINER's own
  width via `auto-fit` + `min`, never a media query, so it behaves identically inside a split pane
  or modal), `aspect()`. Classes `.zx-stack`/`.zx-grid`/`.zx-aspect` work from static markup too.
- **Feedback**: `spinner()` (unknown duration; `kind: 'current'` for inside a button),
  `ProgressBar` (known share; `indeterminate` drops `aria-valuenow` rather than inventing one),
  `InlineLoading` ("Saving…" → "Saved" in place, as one polite live region),
  `skeleton()`/`skeletonText()`/`skeletonTable()` (all `aria-hidden` — put `aria-busy="true"` on
  the region you are filling and drop it with the placeholder).
- **Core**: `Component`, `h`, `icon`/`icons` (Font Awesome Free solid, inline SVG),
  `position`, `Http`/`zeyosService`/`parseResult`, i18n (`setTranslator`/`translate`),
  formatters (`formatNumber`/`formatCurrency`/`formatPercent`/`formatFileSize`/
  `formatRelativeTime`), `storage()`, `toCsv`/`downloadBlob`/`copyToClipboard`,
  `groupBy`/`sortBy`/`uniqueBy`, `throttle`, `escapeRegExp`/`highlightMatch`,
  date utils (`formatDate`/`parseDate`, tokens `%d %m %Y %H %M %S %a %B %s`), `defineElements`,
  `truncate()`/`isTruncated()` (line clamp that sets `title` only while the text is really cut off),
  breakpoints (`breakpoints`, `breakpointOf`, `matchBreakpoint`, `onBreakpoint(fn, {target})` —
  the scale is JS, not tokens, because a custom property cannot be read inside a media query;
  pass an element as `target` to observe the space actually available).

## Common recipes

```js
// Confirm dialog (Promise)
if (await Dialog.confirm({ title: 'Delete', message: 'Remove this record?', danger: true })) { … }

// Toast
Message.success('Saved.');

// Async Select
new Select(el, { filter: async (q) => (await http.get('search', { q })).result,
                 valueKey: 'ID', labelKey: 'name' });

// Table + filter
const table = new Table(el, { columns, data, rowId: 'ID', selectable: 'multi', sortMode: 'local' });
new DataFilter(barEl, { data, filters: [{ type: 'text', id: 'q', fields: ['name'] }],
                        onfilter: (e) => table.setData(e.detail.rows) });

// Form with widget fields
const form = new Form(el, { fieldsets: [ new Fieldset(null, { columns: 2, fields: {
  name:  { type: 'text', label: 'Name', required: true },
  due:   { type: 'date', label: 'Due date' },
  owner: { type: 'zxselect', label: 'Owner', props: { items, valueKey: 'ID', labelKey: 'name' } }
}}) ], actions: [{ label: 'Save', kind: 'primary', action: 'submit' }] });
form.on('submit', (e) => save(e.detail.values));
```

## Talking to ZeyOS: use the dedicated `@zeyos/client`

For reading and writing ZeyOS business data, use the **dedicated ZeyOS client library**
[`@zeyos/client`](https://github.com/zeyos/client) (`npm install @zeyos/client`) — a
zero-dependency JS client with auto-generated, typed methods for the full ZeyOS OpenAPI surface
(accounts, transactions/invoices, tickets, and 50+ resources), OAuth2/session auth, retries, and
schema introspection. Zx accepts the client by injection and does not bundle it.

```js
import { createZeyosClient, MemoryTokenStore, normalizeListResult } from '@zeyos/client';

const zeyos = createZeyosClient({
  platform: 'https://cloud.zeyos.com/<instance>/',
  auth: { mode: 'oauth', oauth: { tokenStore: new MemoryTokenStore({ accessToken }) } }
  //  or: auth: { mode: 'session', session: { enabled: true, credentials: 'include' } }
});

const { data } = normalizeListResult(await zeyos.api.listTransactions({
  filters: { visibility: 0 }, sort: ['-lastmodified'], limit: 50
}));
const created = await zeyos.api.createTransaction({ /* fields */ });
await zeyos.api.updateTransaction({ ID, status: 9 });
```

For schema-driven UI, inject that client into the optional `zx-zeyos` binding above the client:
`connect(client)` provides consistently reported CRUD helpers, `zeyosTable(client, resource)`
generates typed server-backed columns, `zeyosForm(client, resource)` generates a load/save form,
and `zeyosSelect(client, resource)` generates an async entity selector. Import these from the
separate `dist/zx-zeyos.esm.js` entry (or `src/zeyos/index.js` in-repo), not `src/index.js`.
`zx-zeyos` is injection-based and never imports or bundles `@zeyos/client`, preserving Zx's zero
runtime-dependency core.

The `website/layouts/zeyos-invoices.layout.js` layout is the reference schema-driven integration. Zx also ships a
tiny built-in `Http` / `zeyosService(service, accesskey)` (from `src/index.js`) for ad-hoc
`remotecall` requests inside a ZeyOS app, but `@zeyos/client` plus `zx-zeyos` is the dedicated,
full-featured default.

## Theming

Load `zx.css` once. Set theme/density on any ancestor (usually `<html>`):

```html
<html data-zx-theme="dark" data-zx-density="compact">
```

Themes: `light` | `dark` | `auto`. Density: `cozy` | `compact`. Define a product theme by
overriding **semantic** tokens only (`--zx-color-*`, `--zx-control-*`, `--zx-space-*`,
`--zx-radius-*`, `--zx-text-*`) under a `[data-zx-theme="name"]` selector. Never reference tier-1
palette tokens (`--zx-gray-*`, `--zx-green-*`) or raw color literals in component/app CSS —
`tests/lint-tokens.js` enforces this.

## Custom elements (declarative)

`defineElements()` (not auto-called) registers light-DOM `<zx-*>` wrappers with attribute↔option
reflection and ElementInternals form association:

```js
import { defineElements } from '/assets/zx.esm.js';
defineElements();
// <zx-select items='[…]' required></zx-select>, <zx-toggle>, <zx-datebox>, <zx-tabbox>, <zx-table>…
```

## Conventions & gotchas (when editing component source)

- Follow `AGENTS.md` (the contributor contract). Key rules:
  - **Never declare instance class fields for state used in `render()`** — `render()` runs inside
    the base constructor, before field initializers, so they'd clobber it. Initialize such state
    at the top of `render()`. When creating your own root, assign `this.el = root` early.
  - All DOM listeners go through `this.listen(el, type, fn)` (AbortController cleanup).
  - No `innerHTML` outside `h.raw()`. Express state via ARIA/`data-*`, not state classes.
  - Small glyph buttons (close/clear) use the shared `.zx-icon-btn` ghost-button utility.
  - Follow the WAI-ARIA APG pattern named in the component's spec (combobox, dialog, tabs, grid,
    menu). `:focus-visible` rings via `--zx-focus-ring`; wrap animation in
    `@media (prefers-reduced-motion: no-preference)`.

## Where things are & commands

```
src/components/<name>/   component + CSS      src/core/   kernel (component, dom, http, …)
styles/                  tokens + base CSS     website/    site + component catalogue
tests/                   node unit + smoke     dist/       built bundles

npm run serve   # http://127.0.0.1:8321/website/docs.html (no build)
npm test        # node --test tests/unit/*.test.js  +  node tests/lint-tokens.js
npm run build   # distribution modules, global bundle, declarations, and zx.css
```

Reference docs: `README.md` (index + quick start), `docs/llms.md` (per-component API),
`docs/llms.txt` (compact AI surface).
