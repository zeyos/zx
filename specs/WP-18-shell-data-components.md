# WP18 — Xenon shell, launcher, charts, and billing grid

Branch: work on `main`. Read `AGENTS.md`, WP16, and WP17 first. This package implements the
evidence-backed gaps left by the Xenon audit. It extends the overlay-positioning and MenuButton
primitives only where the new shell components need reusable behavior.

## Objective

Add the dependency-free application-shell components needed to adopt Zx in the current ZeyOS UI
without replacing its routing, authentication, permissions, or page-controller logic: Launcher,
Avatar, AccountMenu, expanded AppSidebar, minimized AppRail, a generic chart adapter with a
Chart.js implementation, and a generic Grid with `Grid.BillingItems()`.

## Scope

```
specs/WP-18-shell-data-components.md
package.json
package-lock.json
src/index.js
src/core/position.js
src/components/dropdown/dropdown.js
src/components/menu-button/menu-button.js
src/components/tooltip/tooltip.js
src/components/launcher/launcher.js
src/components/launcher/launcher.css
src/components/avatar/avatar.js
src/components/avatar/avatar.css
src/components/account-menu/account-menu.js
src/components/account-menu/account-menu.css
src/components/app-sidebar/app-sidebar.js
src/components/app-sidebar/app-sidebar.css
src/components/app-rail/app-rail.js
src/components/app-rail/app-rail.css
src/components/chart/chart.js
src/components/chart/chart.css
src/components/grid/grid.js
src/components/grid/grid.css
styles/zx.css
tests/unit/launcher.test.js
tests/unit/avatar.test.js
tests/unit/app-navigation.test.js
tests/unit/chart.test.js
tests/unit/grid.test.js
tests/unit/type-bindings.test.js
tests/smoke/smoke.js
website/docs.js
website/demos/launcher.demo.js
website/demos/avatar.demo.js
website/demos/account-menu.demo.js
website/demos/app-sidebar.demo.js
website/demos/app-rail.demo.js
website/demos/chart.demo.js
website/demos/grid.demo.js
tools/build-site.js
docs/llms.md
docs/llms.txt
docs/api.json
DESIGN-SYSTEM.md
MIGRATION.md
CHANGELOG.md
src/components/layout/layout.js
website/demos/layout.demo.js
```

Generated bundles, declaration files, and `site/` are verification output and are not committed as
source changes unless the repository already tracks them.

## Shared ownership boundary

- ZeyOS owns identity/session data, permissions, route resolution, launcher result loading,
  application actions, active-route derivation, preference persistence, and billing formulas.
- Zx owns semantic rendering, focus/keyboard behavior, disclosure and overlay state, responsive
  presentation, component-local loading/error state, and lifecycle cleanup.
- A navigation or launcher selection emits a cancelable event. Zx may render a supplied `href`, but
  never imports or creates a router and never changes `location` itself.
- Component state can be seeded and updated by the application; persistence is always opt-in and
  external.

## Launcher

`Launcher` is a native-dialog command/search surface. Items have a stable `id`, `label`, optional
`description`, `keywords`, `group`, `icon`, `badge`, `value`, `disabled`, and `pinned`. Sources have
an `id`, optional label, and `load(query, {signal})`; stale work is aborted and ignored.

- Public options include direct `items`, asynchronous `sources`, `query`, `debounce`, `minQuery`,
  `maxResults`, `placeholder`, `emptyText`, `loadingText`, `label`, and an explicit shortcut option.
- Public methods: `open()`, `close()`, `toggle()`, `isOpen()`, `focus()`, `setQuery()`, `getQuery()`,
  `setItems()`, `setSources()`, and `destroy()`.
- Results are grouped but participate in one listbox selection model. Arrow Up/Down, Home/End,
  Enter, and Escape work; opening never routes and selection emits `{item, value, source, query}`.
- Filtering/ranking is text-safe, deterministic, diacritic/case-insensitive, and pure-testable.
- The default keyboard shortcut must be documented and can be disabled so ZeyOS can resolve
  conflicts centrally.

## Avatar and AccountMenu

`Avatar` renders a stable-size decorative image with deterministic initials fallback and optional
status. Image failure reveals the fallback without changing layout. A caller may provide an
accessible label; AccountMenu supplies the accessible name on its single native trigger.

`AccountMenu` composes Avatar with MenuButton. Expanded mode shows primary and secondary identity;
compact mode is visually avatar-only but retains a complete accessible trigger label. The popup
repeats identity, accepts grouped items/separators, isolates destructive actions through item
metadata, and preserves MenuButton's APG keyboard/focus behavior. It emits actions and never owns
authentication, preference mutation, or sign-out.

## AppSidebar and AppRail

Both components accept the same tree of application navigation items. A parent with children is a
disclosure-only control; applications that need a parent destination provide an explicit Overview
child. Persistent application navigation uses semantic `nav`, lists, links, and disclosure buttons,
not menu/menubar roles.

- `AppSidebar` is the expanded vertical presentation. It alone may reveal descendants inline.
  It provides header, scrollable navigation, and sticky footer regions; exposes controlled
  collapsed, active, expanded-branch, and item update methods; and renders an `AppRail` while
  collapsed. Expanded branch IDs survive collapse and restoration.
- `AppRail` is the minimized presentation and supports vertical and horizontal orientation. It
  never reveals descendants inline. Child collections appear in anchored flyouts: toward the
  workspace for a vertical rail and away from a top/bottom horizontal rail.
- Rail flyouts open by hover and keyboard focus, and remain reachable through click/Enter/Space and
  arrow keys. They do not steal focus on hover, remain open while pointer or focus crosses between
  trigger and panel, and close on Escape, outside activation, or selection. A short close grace
  interval prevents the trigger-to-panel gap from becoming a dead zone.
- Every icon-only rail item has a visible hover/focus tooltip and independent accessible name.
- Selection emits `{item, id, value, href, event}`. Preventing the event prevents native link
  navigation. Active-route and expanded state are application-settable without persistence.

Side placements (`left`, `right`, and start/end variants) become supported by `position()`,
Dropdown, MenuButton, and Tooltip so rail/account behavior does not use one-off coordinates.
MenuButton may expose its trigger/panel and focus helpers, but existing defaults and behavior stay
backward compatible.

## Chart and Chart.js adapter

`Chart` is engine-neutral. Its adapter contract receives a canvas, type, data, options, and a point
selection callback and returns a lifecycle handle with `update`, `resize`, and `destroy`.

- `ChartJsAdapter` receives the Chart.js constructor/namespace through its constructor. Runtime Zx
  source must never import `chart.js` or any `node_modules` path.
- Chart.js `4.5.1` is pinned as a **devDependency only**, used for tests and the live documentation
  demo. The deployable docs copy its bundled UMD development asset into the site; the Zx bundles
  remain dependency-free.
- Chart creates a dedicated positioned responsive container, destroys/replaces engine instances
  safely, exposes loading/empty/error states, and emits `ready`, `update`, `select`, and `error`.
- Canvas always has an accessible name and description. A semantic summary table mirrors labels and
  datasets for non-visual access; it can be visually hidden or shown, and must update with data.
- Chart.js-specific registration, plugins, parsing, scales, and animation options remain ordinary
  caller-supplied Chart.js configuration. Future adapters require no Chart API change.

## Grid and billing preset

`Grid` is the public specialization of `Table`, not a fork. `new Grid()` retains Table's complete
sorting, selection, editable-cell/row, hierarchy, growth, loading, and teardown contracts.

`Grid.BillingItems(target, options)` supplies conventional editable billing columns for item,
quantity, unit, unit price, currency, and line total, plus the flat parent-ID hierarchy. Typed
currency/unit formatting and NumberField editors are inherited from Table. The preset accepts data,
locale, currency/unit choices, schema key overrides where practical, column overrides, and an
optional line-total callback; taxes, discounts, rounding policy, validation against server state,
and persistence remain application-owned. Existing `Table` remains public and unchanged.

The existing lowercase layout factory keeps the exported name `grid()`, but its generated helper
API record is renamed from `Grid` to `LayoutGrid`; otherwise its `GridOptions` typedef would collide
with and overwrite the data component's API record.

## Documentation

Add one page and live demo per public component. Preset examples use the existing Presets section
and callable headings, including exactly `Grid.BillingItems()`. The AppSidebar demo must show
expanded inline children and the same tree collapsed into a rail; a horizontal rail example must
prove hover/focus flyouts. The Chart demo injects Chart.js into `ChartJsAdapter` and explains the
zero-runtime-dependency boundary.

Update the design-system inventory and migration guide with the new shell/data coverage and the
explicit application-owned boundaries. Do not copy Shadcn markup/classes/assets or Carbon/Fiori
implementation code.

## Non-goals

- Rewriting ZeyOS routing, page lifecycle, authorization, launcher endpoints, account/session
  behavior, server schemas, or UI controllers.
- React, Shadcn, Tailwind, Radix, Base UI, Lucide, a router, a state store, or any Chart.js runtime
  import in Zx.
- Hover-only navigation, an ARIA menubar for persistent navigation, ambiguous parent
  navigate-and-expand behavior, or inline submenus in any AppRail orientation.
- Spreadsheet formulas, tax engines, accounting rounding policy, pivoting, virtual scrolling,
  remote persistence, or undo history.

## Acceptance criteria

1. DOM-free unit tests cover launcher ranking/stale-source cancellation, avatar initial generation,
   adapter injection/lifecycle, accessible chart-summary models, and Grid preset merge/calculation
   behavior. Browser smoke covers image fallback plus sidebar-vs-rail submenu and hover/focus-grace
   invariants without adding a DOM emulation dependency.
2. Browser smoke creates, exercises, and destroys every new exported Component; teardown leaves no
   dialogs, popovers, observers, document listeners, or Chart.js instances.
3. Expanded AppSidebar is the only inline submenu presentation. Vertical and horizontal AppRail
   expose all children in flyouts through pointer, focus, and keyboard, with correct accessible
   names and focus restoration.
4. Launcher selection and all navigation/account actions are cancelable events and never perform
   application-owned work themselves.
5. `Grid.BillingItems()` demonstrates editable currencies, units, and nested line items while
   `Grid` passes all inherited Table behavior.
6. The Chart demo uses injected Chart.js 4.5.1, the built Zx bundles contain no Chart.js code, and
   `package.json` still has no `dependencies` field.
7. `npm test`, `npm run build`, `npm run build:site`, `npm run test:browser`, `git diff --check`, and
   source/dist site smoke all succeed. Generated API/docs/types include every new public option,
   method, and event.
8. Two isolated read-only final reviews receive the implementation and acceptance criteria but not
   each other's findings; every accepted finding is reproduced or tied to source/test evidence.
