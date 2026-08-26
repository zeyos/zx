# Xenon Design System

Xenon is a product-agnostic design system for browser applications; Zx is its dependency-free
JavaScript implementation. It provides shared foundations, accessible components, interaction
patterns, and application layouts without taking ownership of an application's routing or domain
logic.

## System boundary

Xenon has four layers:

1. **Foundations** — semantic tokens, typography, spacing, density, themes, icons, motion, i18n,
   accessibility rules, and the safe DOM kernel.
2. **Components** — lifecycle-safe controls and containers with one options/events/destroy model.
3. **Patterns** — repeatable business interactions such as global launch, account/preferences,
   record detail, transaction entry, filtering, and empty/loading/error handling.
4. **Application layouts** — rails, bars, workspaces, master/detail, dashboards, inboxes, wizards,
   and responsive shell geometry.

This separation keeps foundations, components, patterns, and layouts independently reusable while
preserving a coherent API and visual language.

Zx has a generated API reference, live examples, bundled local icons, and no runtime dependency.
Its compact `__()` DOM builder and pure append/property/event helpers let established applications
adopt the system without introducing a framework runtime. Domain policy, transport, persistence,
and navigation remain application-owned.

## Coverage ledger

| Front-end capability | Xenon/Zx status | Design-system boundary |
| --- | --- | --- |
| Buttons, inputs, toggles, dates, selects, checklists, tags | Covered by public components | Components preserve native semantics and expose consistent value/event contracts. |
| Forms and fieldsets | Covered, including component-backed field adapters | Use for record editors; keep validation/business rules application-owned. |
| Dialogs, sheets, dropdowns, context menus, tooltips, messages | Covered | Consolidate duplicate menu behavior before building account/launcher surfaces. |
| Tabs, panels, toolbar, breadcrumbs, stepper, split view, dock | Covered | Compose layouts; do not let navigation components own routes. |
| Sorting, selection, dynamic/local filtering, pagination, trees/finder | Covered | `Filter` authors typed nested expressions; `DataFilter` executes simple local predicates. Backend query compilation stays in adapters. |
| Operational calendars and scheduling | Covered | `Calendar` provides agenda/day/week/month/year views, local collision/spanning layout, selection, and configurable optimistic pointer/keyboard edits. The host owns loading, persistence, permissions, recurrence rules, and DAV. |
| Record table, card, and Kanban views | Covered by one shared contract | `TableView`, `CardView`, and `KanbanView` share schema fields, records, sort, selection, field controls, loading, and versioned state. Core remains persistence-neutral; the optional ZeyOS registry coordinates named layouts through an injected server transport. The host still owns permissions, server validation, and rollback. |
| Editable billing/transaction rows | Covered at generic-grid level | `Grid.BillingItems()` composes single-click typed currency/unit editors, flat hierarchy, same-parent row movement, and column visibility over `Table`. Tax, subtotal, posting, rounding, and persistence stay domain code. |
| Global launcher/search | Covered | `Launcher` combines an application grid, current/pinned state, recent records, and abortable grouped sources. The optional ZeyOS adapter maps the complete 29-app shell catalogue while the host retains permissions, icons, and routing. |
| Account/profile/preferences menu | Covered at presentation level | `Avatar` and `AccountMenu` provide identity and action UI. The host supplies permitted actions and owns preferences, authentication, and logout. |
| Persistent app rail / side navigation | Covered | One route-agnostic `AppSidebar` owns expanded, minimized, and horizontal presentations. Only expanded vertical branches render inline; every rail presentation uses flyouts. |
| Charts and analytical summaries | Covered through an adapter | `Chart` is engine-neutral and accessible; `ChartJsAdapter` accepts an injected Chart.js 4 engine. Chart.js is documentation/test tooling only. |
| Local product/module icons | Covered | `AppIcon` is generic; `zeyosAppIcon()` maps every current ZeyOS module/entity identity and accepts an offline glyph override. The optional remote Font Awesome kit is never loaded automatically. |
| Domain entity selectors/cards/links | Covered at generic presentation level | `Card` provides media, native primary links, secondary actions, and metadata; applications own entity routing and policy. |
| Persistent notification/activity center | Missing, lower priority | `Message` covers ephemeral feedback, not read/unread activity history. |

## Current ZeyOS delta audit (25 August 2026)

This is a source audit, not a visual inventory. The comparison uses the current ZeyOS DOM/UI
implementation as evidence: its generic control catalogue is concentrated in
[`4-ui.orig.js`](../zeyos/ext/global.orig/4-ui.orig.js), configurable index-column management in
[`4-pg.orig.js`](../zeyos/ext/global.orig/4-pg.orig.js#L3464), and the multi-view scheduling surface
in [`calendar.orig.js`](../zeyos/ext/mod/calendar.orig.js#L61). Capabilities already represented by
a Zx component or a documented composition are not counted as gaps.

### Already closed by Zx core

| ZeyOS behavior | Source evidence | Xenon/Zx coverage |
| --- | --- | --- |
| Dynamic search/filter authoring and saved filter controls | [`UI.newSearch`](../zeyos/ext/global.orig/4-ui.orig.js#L3378) and [`UI.newContainerFilters`](../zeyos/ext/global.orig/4-ui.orig.js#L7723) | `Filter` supplies a typed/versioned AST editor; `DataFilter` remains the lightweight local-row helper. A compiler and persistence service are intentionally not core. |
| Agenda/day/week/month/year scheduling | [`calendar.orig.js`](../zeyos/ext/mod/calendar.orig.js#L61) | `Calendar` covers timed collisions, spanning lanes, windowed range events, activity year view, selection, now state, and pointer/keyboard move/resize. `zeyosCalendar()` maps expanded appointment rows and Unix seconds without importing recurrence, DAV, routing, or permissions into core. |
| Record table/card collections and reusable view state | [`_newCrdLstTbl`](../zeyos/ext/global.orig/4-ui.orig.js#L4457), [`newCrd`](../zeyos/ext/global.orig/4-ui.orig.js#L4649), and [`newTbl`](../zeyos/ext/global.orig/4-ui.orig.js#L4782) | `TableView`, `CardView`, and the additive `KanbanView` consume the same field descriptors and JSON-safe layout state. `buildZeyosViewConfig()` derives them from the runtime schema; `SavedViewRegistry` adds exact user/workspace/resource scoping and can bridge the existing `userfields` endpoints. Neither imports the client into core. |
| Editable transaction rows and row movement | [`_newTblAddColEdit`](../zeyos/ext/global.orig/4-ui.orig.js#L5613) and [`newTblItems`](../zeyos/ext/global.orig/4-ui.orig.js#L6070) | `Table`/`Grid.BillingItems()` cover typed editing, currencies/units, hierarchy, single-click entry, same-parent drag/keyboard reorder, and show/hide columns. |
| Entity selection, priority, status, and permission choices | [`newSelEntity`](../zeyos/ext/global.orig/4-ui.orig.js#L3296), [`newSelPriority`](../zeyos/ext/global.orig/4-ui.orig.js#L3101), and the surrounding Select family | `Select.entity()`, `.priority()`, `.status()`, and `.permission()` cover the interaction contract; the ZeyOS adapter owns schemas and localized catalogues. |
| Application launcher and module/entity identity | [`newExpLst`](../zeyos/ext/global.orig/4-ui.orig.js#L4355) and entity/module item builders through line 4457 | `Launcher`, `AppIcon`, and the optional ZeyOS adapter cover the full app catalogue, current/pinned state, recent records, grouped abortable search, forks/weblets, and injected routing. |
| Expanded/minimized/horizontal app navigation | Current shell navigation plus the same module identity catalogue | One public `AppSidebar` owns all presentations. The rail renderer is an internal presenter, not a second component; only expanded vertical branches render inline and rail branches use anchored flyouts. |
| Toasts, loading, cards, dialogs, forms, grids, charts, and layout primitives | Multiple `newContainer*`, input, table, and progress families in `4-ui.orig.js` | Covered by existing Zx components and documented composition; these are not delta items merely because the legacy factory names differ. |

### Recommended additions to Zx core

| Priority | Missing reusable contract | Evidence and proposed boundary |
| --- | --- | --- |
| P0 | **EntityRef** | ZeyOS has a large family of linked/static entity presentations with subtitle, owner/group/assignee context, fork, and record actions: [`newLinkEntity*`](../zeyos/ext/global.orig/4-ui.orig.js#L225) and [`newEntityStatic`/`newEntity*`](../zeyos/ext/global.orig/4-ui.orig.js#L8262). A generic `EntityRef` should own icon/title/subtitle/metadata/link/action semantics; ZeyOS routing, permissions, and context menus remain injected. `Card` is too large for dense table/feed rows. |
| P0 | **FileItem / FileList** | Existing-file, temporary-file, waiting/progress, MIME, size, and download rows recur in [`newFile`, `newFileTemp`, and `newFileWait`](../zeyos/ext/global.orig/4-ui.orig.js#L8158). `FieldUpload` owns selection/upload but not durable file presentation. Core should render file identity/state/actions; transport, authorization, preview, and download URLs stay with the host. |
| P0 | **ActivityList / ActivityItem** | [`newFeed`](../zeyos/ext/global.orig/4-ui.orig.js#L8704) combines chronological records, comments, attachments, likes, and incremental updates. Core should own an accessible chronological list, grouping, loading/empty state, and action slots. Posting, reactions, channels, permissions, and persistence remain application code. |
| P1 | **FacetList** | Counted activity/status/tag/entity side filters appear in [`newNavActivityStatus`](../zeyos/ext/global.orig/4-ui.orig.js#L3967), `newNavTag`, and `newNavEntity`. `Filter` is an expression author, not a compact persistent facet navigator. Core should own selection/count/collapse/loading behavior; query mapping stays injected. |
| P1 | **EditorHost** | ZeyOS uses plain/Markdown/contenteditable/iframe editors through [`newEditor`](../zeyos/ext/global.orig/4-ui.orig.js#L1607) and `newFrameEditor`. Like `Chart`, core should provide labels, toolbar/action slots, value/lifecycle, dirty/read-only/error states, and an injected engine adapter. Sanitization and document/media policy must not be implicit core behavior. |
| P1 | **ColorPicker** | The reusable swatch picker is [`newCl`](../zeyos/ext/global.orig/4-ui.orig.js#L3753). A dependency-free accessible swatch/custom-color picker belongs in core and would also serve the Theme Studio. |
| P2 | **Metric / Summary** | [`newSummary`](../zeyos/ext/global.orig/4-ui.orig.js#L7312) repeatedly formats counts, money, timing, size, stock, and relative values. These can currently be composed from Card and format helpers, but a small semantic Metric/DescriptionList pair would remove repeated markup without importing business formulas. |
| P2 | **RecordPreview** | Typed preview builders for appointments, contacts, links, messages, tasks, and tickets start at [`newPreviewForm`](../zeyos/ext/global.orig/4-ui.orig.js#L9589). Core should offer a generic preview anatomy or engine-neutral preview host, not one component per ZeyOS entity. |
| P2 | **Shortcut / Kbd** | Launcher and menus expose shortcuts but Zx has no reusable semantic `<kbd>` treatment. A tiny factory is justified once shortcuts appear outside those components. |

### Adapter work, not new core components

- A **ZeyOS Filter compiler** mapping allowlisted AST field/operator IDs to the server's plural
  `filters` query shape, plus a parser for stored legacy filter state. Compilation must use bound/
  structured values and never accept raw SQL or URL fragments.
- A shared **ZeyOS field/status/priority catalogue** built from runtime schemas and localization,
  feeding `Field`, `Filter`, `Select.status()`, and `Select.priority()` without hard-coding
  entity-specific policy in core.
- **EntityRef/FileItem/ActivityList adapters** that resolve routes, icons, permissions, server
  payloads, and action menus while leaving their visual/interaction contracts reusable.
- Optional persistence connectors for column visibility/order, sidebar state, saved filters, recent
  items, and theme preferences. Core should expose serializable state and events only.

### Deliberately application-owned

Routing/history, authentication/session/logout, authorization, server transport/caching, saved-view
storage, audit policy, transaction tax/discount/subtotal/posting formulas, server reconciliation and undo history,
calendar recurrence/DAV synchronization, rich-text sanitization, and activity actions are not
design-system responsibilities. Moving them into Zx would reproduce ZeyOS application logic inside
the library and make Xenon less reusable.

### Launcher contract

The launcher searches applications, recent records, and grouped remote record types. The generic
component supplies the tile/list layouts, pinned-order ranking, current-route marker, request
cancellation, spatial keyboard movement, visible keyboard hints, native link metadata, and a
cancelable action. The optional ZeyOS adapter accepts all 29 prototype modules plus forks and
weblets, cached or async recent items, grouped legacy search payloads, permission/current state,
and host icon renderers. All state is injected; the adapter reads no shell globals and deliberately
does not become a second router.

### Account contract

A typical account surface includes identity, role-dependent links, language, authentication and
logout, preferences, and About/version content. `AccountMenu` composes `Avatar` with the existing
menu behavior and emits actions without owning routes or session state. The host decides which
actions exist and what each one does.

## Table and transaction follow-ups

The enhanced `Table` now keeps values numeric while formatting per-row locales, currencies, units,
and decimals; numeric types infer `NumberField` editors. Flat `parentId` data is projected into a
cycle-safe ARIA treegrid with local sibling sorting and expand/collapse APIs.

`Grid.BillingItems()` now packages the conventional description, quantity, unit, unit-price,
currency, line-total, and hierarchy schema while retaining Table's editing contract. Useful
follow-ups, deliberately separate from this generic preset:

- summary/footer rows and grouped subtotals;
- persistence connectors for versioned view state (column order and visibility are now component capabilities);
- product-specific invoice/transaction presets with tax, discount, rounding, and formula golden tests;
- server persistence, optimistic rejection, and undo owned by the application/controller layer.

## Record-view contract

`RecordView` is the presentation-neutral base for `TableView`, `CardView`, and `KanbanView`.
Stable field IDs allow a runtime ZeyOS schema to drive every presentation, while per-view properties
add table widths, card previews, or board grouping without changing how values, sorting, selection,
and field visibility work. Each view returns a versioned JSON-safe configuration through
`getViewState()`; record data and rendered Nodes are deliberately excluded.

The optional ZeyOS adapter builds the shared descriptors and server projection, including hidden
title, media, column, and swim-lane fields. It can page any concrete record view through an injected
client. Preference storage remains outside Zx, and Kanban moves are cancelable: local mode updates a
record clone, while external mode waits for the application to supply accepted server state.

## Calendar contract

`Calendar` normalizes arbitrary event records into stable IDs, copied local Dates, optional colour
and location, and per-event edit policies. Agenda, day, week, month, and year are presentations of
the same event set. The interval helpers operate on calendar days rather than fixed 24-hour spans,
so DST does not move a date; timed overlaps get deterministic columns and all-day/multi-day items
get non-overlapping clipped lanes.

Move and resize proposals are cancelable and keyboard-equivalent. Optimistic mode is the default
and provides a version-guarded `revert()` that cannot overwrite a newer local edit. Controlled mode
emits the same proposal without local mutation. The optional ZeyOS adapter maps expanded
appointment occurrences and Unix seconds while the application retains transport, recurrence/DAV,
permissions, routing, validation, and conflict handling.

## Chart-engine candidates

Chart.js was selected for the first adapter. It is pinned at 4.5.1 as a development dependency for
tests and the documentation asset, but is never imported by Zx runtime source. Applications inject
their chosen engine into the adapter. Published browser artifact sizes below are approximate and
remain useful when choosing a different future adapter.

| Engine | Current state at audit | Approx. browser cost | Best fit | Main trade-off |
| --- | --- | ---: | --- | --- |
| [Chart.js](https://github.com/chartjs/Chart.js/releases) 4.5.1 | Mature, active, MIT | 209 kB / 71 kB gzip (UMD) | Broad default: bar, line, doughnut, mixed business charts | Larger than focused engines; canvas requires a separate accessible data summary. |
| [Frappe Charts](https://github.com/frappe/charts/releases) 1.6.x | Zero-dependency SVG, ERP-oriented, MIT | 69 kB / 18 kB gzip (UMD) | Lean dashboards with common chart types | GitHub release and npm publication were out of step; ecosystem and extension surface are smaller. |
| [uPlot](https://github.com/leeoniya/uPlot) 1.6.32 | Active, MIT, highly optimized | 51 kB JS + 2 kB CSS / about 23 kB gzip | Dense time-series and operational telemetry | Deliberately narrow; not a general categorical/stacked business-chart toolkit. |
| [Apache ECharts](https://echarts.apache.org/en/changelog.html) 6.1.0 | Very capable, active, Apache-2.0 | 1.12 MB / 369 kB gzip (full build) | Advanced analytical visualization | Too large as Xenon's default; only sensible as an opt-in advanced adapter or custom build. |

Implemented architecture: `Chart` accepts an injected engine adapter, maps Xenon semantic tokens,
owns loading/empty/error states, and mirrors its data in an accessible table. Chart.js is the broad
default adapter; Frappe Charts remains the lean ERP-oriented alternative, uPlot a specialized
time-series candidate, and ECharts an opt-in advanced adapter. Any additional package still
requires explicit dependency approval.
