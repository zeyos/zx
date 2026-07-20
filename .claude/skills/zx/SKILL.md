---
name: zx
description: Build UI in the ZeyOS ERP with the Zx component library — the dependency-free vanilla-JS successor to the MooTools "gx" library. Use when creating or editing UI in this repo (v2/), instantiating zx.* components (Table, Select, Form, Dialog, Datebox, Message, Tabbox…), wiring the gx compatibility layer, theming with --zx-* tokens, or migrating legacy gx.zeyos.*/gx.bootstrap.* code.
---

# Zx UI library

Zx is a dependency-free, accessible, themeable vanilla-JavaScript UI component library for the
ZeyOS ERP. It lives in `v2/` and replaces the MooTools-based `gx` libraries. Source modules run
directly in the browser (no build step to develop); `npm run build` emits distribution bundles.

## When to use this skill

Use it whenever you create or modify UI in `v2/`: instantiating components, composing forms and
tables, opening dialogs and toasts, theming, adding a `<zx-*>` custom element, wiring the ZeyOS
HTTP client, or migrating legacy `gx.*` code through the compatibility layer.

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
  explicit `h.raw(trustedHtml)`). Use it for custom content/renderers.

## Component catalog

See `README.md` for the one-line index and `docs/API.md` for per-component options/methods/events.
Groups (matching the demo sidebar):

- **Inputs**: `button()`, `buttonGroup()`, `CheckButton`, `Toggle`, `Search`, `Select`
  (APG combobox; `filter: false | 'local' | async fn`; `Select.priority()` preset), `Checklist`,
  `DatePicker`, `MonthPicker`, `TimePicker`, `Datebox`/`DateTimeBox`, `Timebox`.
- **Overlays**: `Message` (toasts + inline + progress; statics `Message.info/success/warning/error`),
  `Modal`, `Dialog` (views + statics `Dialog.alert/confirm/prompt` returning Promises),
  `Dropdown`, `MenuButton`.
- **Data**: `Table` (sortable, selectable, sticky header, local/server sort), `DataFilter`.
- **Forms**: `Form` → `Fieldset` → `Field` (type registry: text/password/int/float/textarea/
  checkbox/select/optionlist + widget types zxselect/checklist/date/month/datetime/time/
  valuelist/multivalueeditor/upload/toggle), `ValueList`, `MultiValueEditor`, `FieldUpload`,
  `Permission`.
- **Layout**: `Groupbox`, `Panel`, `MasterPanel`, `Tabbox`, `NavigationBar`.
- **Core**: `Component`, `h`, `icon`/`icons` (Font Awesome Free solid, inline SVG),
  `position`, `Http`/`zeyosService`/`parseResult`, i18n (`setTranslator`/`translate`),
  date utils (`formatDate`/`parseDate`, tokens `%d %m %Y %H %M %S %a %B %s`), `defineElements`.

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

## ZeyOS HTTP client

`Http` / `zeyosService` are the Zx successors to the legacy `gx.zeyos.Client` / `gx.zeyos.Request`.
The core is ZeyOS-agnostic: inject the base URL and error handler.

```js
import { Http, zeyosService, parseResult } from '/assets/zx.esm.js';

const remote = new Http({ base: './remotecall.php', onError: (err) => Message.error(err.message) });
const rows = await remote.post('', { action: 'list' });      // POST JSON, parsed JSON back

// REST-style service (../remotecall/<service>[:<accesskey>]/):
const invoices = zeyosService('invoices', accesskey);
const data = await invoices.get('list', { limit: 50 });
```

Legacy `gx.zeyos.Client` / `gx.zeyos.Request` still work via the compat bundle (they wrap `Http`).

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

## gx compatibility layer

Load `zx.global.js` then `zx-compat.global.js` to expose `window.gx.{core,ui,util,zeyos,bootstrap}`
wrapping Zx components. Constructors, option names, and MooTools-style `addEvent` events are
translated. `gx.compat.installGlobals()` (explicit opt-in) installs `__()`, `_()`,
`String.htmlSpecialChars`, and prototype conveniences. See `MIGRATION.md` for the full class map,
the deliberately-changed behaviors, and unsupported legacy APIs.

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
v2/src/components/<name>/   component + CSS      v2/src/core/   kernel (component, dom, http, …)
v2/src/compat/              gx compat layer      v2/styles/     tokens + base.css
v2/demos/                   live catalog          v2/specs/      per-component build specs
v2/tests/                   node unit + smoke     v2/dist/       built bundles

npm run serve   # http://127.0.0.1:8321/demos/ (no build)
npm test        # node --test tests/unit/*.test.js  +  node tests/lint-tokens.js
npm run build   # dist/: zx.esm.js, zx.global.js (window.zx), zx-compat.global.js (window.gx), zx.css
```

Reference docs: `README.md` (index + quick start), `docs/API.md` (per-component API),
`MIGRATION.md` (gx→zx), `docs/llms.txt` (compact AI surface).
