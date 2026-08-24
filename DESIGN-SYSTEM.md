# Xenon design-system audit

Audit date: 2026-08-24. Xenon is the design system; Zx is its dependency-free JavaScript
implementation. This document records the current coverage against ZeyOS Classic and the work
needed for an incremental adoption that keeps the existing routing and business logic.

## System boundary

Xenon has four layers:

1. **Foundations** — semantic tokens, typography, spacing, density, themes, icons, motion, i18n,
   accessibility rules, and the safe DOM kernel.
2. **Components** — lifecycle-safe controls and containers with one options/events/destroy model.
3. **Patterns** — repeatable business interactions such as global launch, account/preferences,
   record detail, transaction entry, filtering, and empty/loading/error handling.
4. **Application layouts** — rails, bars, workspaces, master/detail, dashboards, inboxes, wizards,
   and responsive shell geometry.

This separation follows the enterprise-system intent described by the
[Carbon Design System](https://carbondesignsystem.com/all-about-carbon/what-is-carbon/) and
[SAP Fiori design principles](https://experience.sap.com/fiori-design-web/design-principles/),
without copying either system's code, assets, or component contracts.

Zx currently has more than 50 public component classes, 63 registered documentation/demo entries,
a generated API reference, bundled local icons, and no runtime dependency. The foundations,
component layer, and persistent application shell now cover the first ZeyOS adoption wave; domain
patterns remain intentionally application-owned until their business invariants are specified.

## ZeyOS adoption boundary

ZeyOS Classic does not use `gx`. Across its 30 module files it has roughly 2,500 `UI.*` calls and
2,600 `PG.*` calls. `PG` already owns navigation, transport, history, exit guards, and page
lifecycle and remains authoritative.

The existing compact DOM surface has 2,668 executable builder calls: 871 bare `__()` calls, 1,710
parent-returning `parent.__()` calls, and 87 child-returning `parent.$__()` calls. Zx now provides
the exact compact builder plus pure append/property/event helpers. Existing global and prototype
names remain application-owned delegation seams; Zx does not install or replace them.

Migration therefore replaces `UI.new*` implementations one family at a time, keeps their current
DOM/value contracts until call sites reach zero, and leaves `PG`, `MD`, routes, and server payloads
in place. See [MIGRATION.md](./MIGRATION.md) for the ordering and shell invariants.

## Coverage ledger

| Capability in current ZeyOS | Xenon/Zx status | Decision |
| --- | --- | --- |
| Buttons, inputs, toggles, dates, selects, checklists, tags | Covered by public components | Replace `UI.new*` families incrementally and preserve value/event contracts. |
| Forms and fieldsets | Covered, including component-backed field adapters | Use for record editors; keep validation/business rules application-owned. |
| Dialogs, sheets, dropdowns, context menus, tooltips, messages | Covered | Consolidate duplicate menu behavior before building account/launcher surfaces. |
| Tabs, panels, toolbar, breadcrumbs, stepper, split view, dock | Covered | Compose layouts; do not let navigation components own routes. |
| Sorting, selection, filtering, pagination, trees/finder | Covered | Suitable for generic data screens. |
| Editable billing/transaction rows | Covered at generic-grid level | `Grid.BillingItems()` composes typed editable currency/unit columns and flat hierarchy over `Table`. Tax, subtotal, posting, rounding, and persistence stay domain code. |
| Global launcher/search | Covered | `Launcher` combines ranked local applications with abortable grouped sources. ZeyOS still filters the catalogue and resolves selection through `PG`. |
| Account/profile/preferences menu | Covered at presentation level | `Avatar` and `AccountMenu` provide identity and action UI. ZeyOS supplies role-filtered actions and owns preferences, authentication, and logout. |
| Persistent app rail / side navigation | Covered | `AppSidebar` is the expanded vertical tree; minimized `AppRail` uses flyouts in every orientation. Both are route- and persistence-agnostic. |
| Charts and analytical summaries | Covered through an adapter | `Chart` is engine-neutral and accessible; `ChartJsAdapter` accepts an injected Chart.js 4 engine. Chart.js is documentation/test tooling only. |
| Local product/module icons | Partial | Use bundled icons or registered local assets; do not require the optional remote Font Awesome kit. |
| Domain entity selectors/cards/links | Partial | Build patterns on `Select`, Table, Panel, and ContextMenu after the shell blockers. |
| Persistent notification/activity center | Missing, lower priority | `Message` covers ephemeral feedback, not read/unread activity history. |

### Launcher contract

The current launcher searches applications, recent records, and grouped remote record types. A
replacement supplies pinned-order ranking, request cancellation, Cmd/Ctrl+K, listbox keyboard
behavior, native link metadata, and a cancelable action. Permission filtering, active-route state,
cache and recent-history policy remain inputs from ZeyOS, which resolves actions through `PG.go()`.
The component is deliberately not a second router.

### Account contract

The current account surface includes identity, role-dependent links, language, authentication and
logout, theme and menu-position preferences, and About/version content. A shared `Menu` should
first centralize the keyboard/typeahead/selection behavior currently duplicated by `MenuButton`
and `ContextMenu`; `AccountMenu` then composes that primitive with `Avatar`/`Identity` and emits
actions without owning routes or session state. `AccountMenu` now provides that composition over
`MenuButton`; a future shared low-level `Menu` remains an internal consolidation opportunity, not
an adoption blocker.

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

## Review corrections completed

- Generated API records no longer let helper typedefs overwrite component options; inline JSDoc
  tags are parsed, and audited runtime events are present in types and documentation.
- Form documentation exposes `Form`, `Fieldset`, and `Field`; `MonthPicker` has its own constructor
  type.
- Theme Studio destroys registered component instances on every rebuild and describes its honest
  family-level coverage.
- Documentation separates Presets from green-accent Examples and uses callable preset names.
- Current source and documentation no longer carry branding from the retired framework experiment.

## Recommended sequence

1. Ship the Zx runtime and delegate the current compact DOM/event seams; verify no navigation or
   listener regressions.
2. Mount `Launcher`, `Avatar`/`AccountMenu`, and `AppSidebar`/`AppRail` behind the current shell
   fixtures, permission filters, and preference store.
3. Replace high-volume `UI.new*` families, one discriminating fixture set at a time.
4. Introduce `Grid.BillingItems()` where its generic schema fits; add domain presets only with
   formula and rounding fixtures.
5. Inject Chart.js into `ChartJsAdapter` only on analytical surfaces that need it; keep the engine
   out of the base Zx runtime bundle.
