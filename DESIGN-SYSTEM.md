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
| Sorting, selection, filtering, pagination, trees/finder | Covered | Suitable for generic data screens. |
| Editable billing/transaction rows | Covered at generic-grid level | `Grid.BillingItems()` composes typed editable currency/unit columns and flat hierarchy over `Table`. Tax, subtotal, posting, rounding, and persistence stay domain code. |
| Global launcher/search | Covered | `Launcher` combines an application grid, current/pinned state, recent records, and abortable grouped sources. The optional ZeyOS adapter maps the complete 29-app shell catalogue while the host retains permissions, icons, and routing. |
| Account/profile/preferences menu | Covered at presentation level | `Avatar` and `AccountMenu` provide identity and action UI. The host supplies permitted actions and owns preferences, authentication, and logout. |
| Persistent app rail / side navigation | Covered | One route-agnostic `AppSidebar` owns expanded, minimized, and horizontal presentations. Only expanded vertical branches render inline; every rail presentation uses flyouts. |
| Charts and analytical summaries | Covered through an adapter | `Chart` is engine-neutral and accessible; `ChartJsAdapter` accepts an injected Chart.js 4 engine. Chart.js is documentation/test tooling only. |
| Local product/module icons | Partial | Use bundled icons or registered local assets; do not require the optional remote Font Awesome kit. |
| Domain entity selectors/cards/links | Covered at generic presentation level | `Card` provides media, native primary links, secondary actions, and metadata; applications own entity routing and policy. |
| Persistent notification/activity center | Missing, lower priority | `Message` covers ephemeral feedback, not read/unread activity history. |

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
- column reorder and user-persisted column state;
- product-specific invoice/transaction presets with tax, discount, rounding, and formula golden tests;
- server persistence, optimistic rejection, and undo owned by the application/controller layer.

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
