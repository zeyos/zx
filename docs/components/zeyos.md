# ZeyOS binding (zx-zeyos)

`zx-zeyos` is the optional schema-driven layer above `@zeyos/client`: inject a client instance and declare a resource to generate typed Zx controls.

Full reference: https://zx.zeyos.com/docs/llms.md · Live demo: https://zx.zeyos.com/layouts.html#zeyos-invoices · All components: https://zx.zeyos.com/docs/components/index.md

`zx-zeyos` is the optional schema-driven layer above `@zeyos/client`: inject a client instance and
declare a resource to generate typed Zx controls. It is a separate ESM entry at
`dist/zx-zeyos.esm.js` (or `src/zeyos/index.js` during no-build development) and is deliberately
not re-exported from `src/index.js`. The binding has zero runtime dependencies and never imports or
bundles `@zeyos/client`; the application owns client creation, authentication, and transport.

```js
import { createZeyosClient } from '@zeyos/client';
import {
  connect, createLegacySavedViewTransport, createSavedViewRegistry,
  dataFilterStateToFilters, legacySavedViewRequest, zeyosForm, zeyosSelect, zeyosTable, zeyosView
} from '/assets/zx-zeyos.esm.js';
import { CardView, TableView } from '/assets/zx.esm.js';

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

const records = zeyosView(client, 'transactions', TableView, {
  fields: ['transactionnum', 'account', 'date', 'netamount', 'status'],
  savedViews: {
    transport: savedViewTransport,
    scope: { userId: currentUserId, workspaceId: currentWorkspaceId }
  }
});
await records.ready; // restores a compatible default before the first list request
await records.load();
await records.saveView({ name: 'My open invoices', setDefault: true });
```

- `connect(client, { onError, locale })` returns `{client, list, get, create, update, reportError}`;
  generated forms/tables use the same operation discovery and default `Message.error` reporting.
- `zeyosSelect(client, resource, opts)` returns an async Zx `Select`. Options include `fields`,
  `labelKey`, `valueKey`, `searchFields`, `filters`, `limit`, and normal Select options. Its list
  operation receives a query built by `buildListQuery`.
- `zeyosForm(client, resource, opts)` returns
  `{form, ready, load(id), save(), getForm(), destroy()}`. `fields` is an ordered allow-list;
  `exclude`, `labels`, `formats`, `timeZone`, `title`, `columns`, `value|id`, and `onSaved` curate
  behavior. `load` maps stored timestamps to `Date`; `save` validates and creates/updates, maps back
  to Unix seconds, calls `onSaved`, and shows a success toast. Its toasts (that confirmation and a
  failed request's report) appear in the theme scope of `scope` — default: the form's own element,
  so a form in a scoped dialog toasts inside that scope, and the confirmation stays there when
  `onSaved` closes and destroys the dialog; `notify: false` raises none, leaving the
  promise's result or rejection to the caller.
- `zeyosTable(client, resource, opts)` returns
  `{table, load(), setSearch(), setFilters(), loadMore(), count, page, pageSize, hasMore, destroy()}`.
  Columns come from schema metadata, sorting uses `sortMode:'server'`, and paging is zero-based with
  `pageSize: 50` by default: page zero replaces rows while later pages append them using server
  `limit`/`offset` and `count`; `load({page, pageSize, replace: true})` replaces at any page. A
  one-based `Pagination` maps onto it as `load({page: detail.page - 1, pageSize: detail.pageSize,
  replace: true})` (offset `(page - 1) * pageSize`), feeding `result.count` back through
  `setTotal()`. A response that resolves after `destroy()` is ignored and later loads reject; page
  must be a non-negative integer and page size a positive integer (`RangeError`), filters an object
  (`TypeError`), and every argument is checked before any is applied, so a rejected call changes
  nothing. Table presentation options and
  listeners pass through — `variant`, `zebra`, `stickyHeader`, `responsive`, `growing`, `emptyText`,
  `rowClass`, `rowKind(s)`, `columnVisibility`, `columnReorder`, `hiddenColumns`, `on<event>`;
  `onrowclick` runs beside `onRowClick`. The binding owns `columns`, `data`, and `sortMode`, and
  leaves out editing, `rowReorder`, and `hierarchy`, which change rows it never persists.
- `buildZeyosViewConfig(client, resource, opts)` resolves one schema to shared `ViewField[]`, a
  complete projection, and view options. `zeyosView(client, resource, CardView|TableView|KanbanView,
  opts)` returns `{view, load(), setSearch(), setFilters(), loadMore(), count, page, hasMore,
  savedViews, ready, restoreDefault(), captureView(), saveView(), applyView(), destroy()}` with
  paging and server sort. Paging is the same loader as `zeyosTable()` — same `pageSize: 50` default,
  validation, `replace`/`pageSize` load options, and destroy guard. Title, preview, group, column, and swim-lane fields stay in the projection
  even when hidden. Without `savedViews`, the host may persist `view.getViewState()` directly.
  `savedViewFallback: 'error'` is the default: a saved-view initialization failure blocks loads.
  Opt into `'baseline'` to load records using the configured query and sort when the registry
  cannot be read. The failure is reported and `ready` still rejects; capture, save, apply, and
  default restoration remain blocked. Later operations retry initialization so repaired storage
  can restore its default. The unreadable document is never rewritten automatically, and a
  failure while applying a view or query cannot fall back.
- `createSavedViewRegistry(transport, {userId,workspaceId,resource})` coordinates private named
  Table/Card/Kanban configurations as one versioned, atomically replaced document. Entries capture
  component state plus filters/search and an explicit presentation type, never records, selection,
  pages, callbacks, or DOM. Duplicate names, defaults, migration, type mismatch, failed writes, and
  teardown are explicit. `workspaceId:null` addresses ZeyOS's base workspace.
- `createLegacySavedViewTransport(request)` reuses the authenticated `fields`, `fields_save`, and
  `fields_remove` endpoints through one reserved, namespaced `userfields` record.
  `legacySavedViewRequest(PG.load.bind(PG))` is the optional Promise bridge for a legacy host. The
  scope's `userId` is intentionally not sent to the endpoint; the server session remains authority.

Field mapping is schema-driven: entity/FK → async `zxselect`; enum/list → `optionlist` or native
`select` with readable labels (a schema `{value, label}` as given, a stored constant in sentence
case — `INVOICED` → "Invoiced", `PARTLYPAID` → "Partly paid"); date-only bigints (indexed `date`,
`duedate`, `birthdate`, `datefrom`/`dateto` outside appointments and events, `datecancel`,
`lastbilling`) → `date`; other date/time bigints and `lastmodified` → `datetime`;
`formats: { field: 'date' }` overrides the guess; money/price/numeric
→ right-aligned `float`/number columns (amount columns use the row currency); boolean/checked →
`toggle` and a check column; percent/progress → numeric percent; email/tel/url → typed text; arrays
→ `valuelist`; long text/JSON → `textarea`; short scalar text → `text`.

ZeyOS queries always use `filters` (plural), not `filter`. Full-text input becomes `query`; sort is
sent as signed server fields (`+field`/`-field`); projection supports aliases and dot joins; and
search/filter/sort/pagination remain server-side. ZeyOS timestamps are integer Unix seconds, so
forms convert them to/from `Date`. A date-only field stores midnight of a calendar day in the
instance's zone — a day, not an instant: tables show it with no time, and forms edit it as that day,
so neither the viewer's zone nor daylight saving moves it. Pass the instance's IANA zone as
`timeZone` (table, form, view; default: the runtime's own); `unixSecondsToCalendarDay(seconds, tz)`
and `calendarDayToUnixSeconds(date, tz)` do the same conversion for application code. Use
`dataFilterStateToFilters(state, defs, {timeZone})` before `tableBinding.setFilters(...)` when wiring
a `DataFilter`: with `timeZone`, a `format: 'date'` value (`Date` or `YYYY-MM-DD`) becomes that
day's midnight in the zone, as forms store it, while `datetime` values stay instants; without it,
dates convert as exact instants. `FilterPanel` takes the same `timeZone` option.

## Module icons and colours

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
  Font Awesome fallback, for pages on a kit without the ZeyOS uploads. Stock Font Awesome
  CSS or kit assets must still be loaded by the host.
- `moduleChip(name, {size, iconSize, label, title, standard})` → `<span class="zx-module-icon">`
  with a centred white glyph on the module colour. `moduleGlyphColor(hex)` remains available as a
  separate contrast helper for non-AppIcon integrations that deliberately choose their foreground.
- `moduleInfo`/`moduleColor`/`moduleIconName`/`moduleKeys`/`normalizeModuleName` read the config.
  Module, entity, and API resource names are all accepted, case-insensitively, with dots and
  underscores normalized: `'transactions.billing'`, `'invoices'`, and `'Transactions Billing'` all
  land on `transactions-billing`. Unknown names fall back to the `default` module — lookups never
  throw.
- `registerModules(map)` adds forks and weblets or overrides shipped entries (a bare string sets
  the colour only). Runtime ZeyOS menu data is authoritative: feed its colours in at startup.

## Module bar from the ZeyOS menu

The module bar and the module-layout sidebar read the same shell state the launcher does, plus
each module's menu and its counts:

```js
import { buildZeyosAppSidebarConfig, buildZeyosModuleBarConfig } from '/assets/zx-zeyos.esm.js';
import { AppSidebar, ModuleBar } from '/assets/zx.esm.js';

const state = {
  modules: ['messages', 'tasks', 'billing', 'contacts', 'calendar', 'tickets'],
  pinned: ['messages', 'tasks', 'billing', 'tickets'],     // the rest are under "All modules"
  activeIdentifier: 'tickets',
  active: 'tickets-mine',                                     // a menu entry, when more precise
  canUseModule: (module) => permissions.has(module),
  menus: { tickets: [{ id: 'tickets-mine', label: 'My tickets' }, ['tickets-all', 'All tickets', '#tickets']] },
  badges: { messages: 7, 'tickets-mine': 3 },
  resolveApplication: (app) => ({ href: routeFor(app) })
};
new AppSidebar(nav, buildZeyosAppSidebarConfig(state, { onselect: route }));
new ModuleBar(header, buildZeyosModuleBarConfig(state, { orientation: 'horizontal', side: 'top' }));
```

- `zeyosModuleItems(state, {standardIcons})` → `ModuleItem[]`: every permitted module, fork, and
  weblet, with its kit icon (or `renderApplicationIcon(app, normalized)`), its colour — the
  payload's, else the registry's, so `registerModules()` reaches the bar — its menu from
  `menus[identifier]` (objects or `[id, label, href]` arrays, sections, nesting; unsafe hrefs are
  disabled), its badge from `badges`, `pinned` from the pinned order, and forks and weblets in
  their own catalogue group (`labels.forks`, `labels.weblets`). A module with a menu is a panel
  module; one without is a destination.
- `buildZeyosModuleBarConfig(state, options)` → ModuleBar options; `buildZeyosAppSidebarConfig()`
  → AppSidebar options in `layout: 'modules'`. Both draw the classic ZeyOS identity tiles
  (`appearance: 'solid'`) unless told otherwise. `zeyosModuleBar(target, state, options)` creates
  the bar directly.
