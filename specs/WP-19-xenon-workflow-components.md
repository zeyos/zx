# WP19 — Xenon workflow components and documentation hardening

Branch: work on `main`. Read `AGENTS.md`, WP16, WP17, and WP18 first. This package closes the
evidence-backed workflow and documentation gaps identified while comparing Zx with the current
non-React ZeyOS front end. It preserves Zx's zero-runtime-dependency contract.

## Objective

Make Zx practical as the application-neutral design system for dense business front ends: add a
generic AppIcon and a typed dynamic Filter builder, improve entity/tag selection and editable data
grids, correct theme and notification behavior, and make the documentation shell easier to search
and navigate. ZeyOS-specific identity data stays in the optional `zx/zeyos` adapter.

## Scope

```
specs/WP-19-xenon-workflow-components.md
src/index.js
src/components/app-icon/app-icon.js
src/components/app-icon/app-icon.css
src/components/button/button.css
src/components/card/card.css
src/components/filter/filter-model.js
src/components/filter/filter.js
src/components/filter/filter.css
src/components/grid/grid.js
src/components/grid/grid.css
src/components/launcher/launcher.js
src/components/message/message.css
src/components/select/select.js
src/components/select/select.css
src/components/table/table.js
src/components/table/table.css
src/components/tag-picker/tag-picker.js
src/components/tag-picker/tag-picker.css
src/zeyos/icons.js
src/zeyos/index.js
src/zeyos/launcher.js
src/zeyos/select.js
styles/icons.css
styles/tokens/semantic.css
styles/tokens/dark.css
styles/tokens/themes.css
styles/zx.css
tests/unit/app-icon.test.js
tests/unit/filter.test.js
tests/unit/grid.test.js
tests/unit/tag-picker.test.js
tests/unit/zeyos-launcher.test.js
tests/unit/zeyos-select.test.js
tests/unit/type-bindings.test.js
tests/unit/theme-presets.test.js
tests/smoke/smoke.js
website/docs.html
website/docs.js
website/docs.css
website/docs-search.js
website/index.html
website/theme.html
website/theme.js
website/theme.css
website/theme-presets.js
website/theme-showcase.js
website/site.js
website/site.css
website/demos/app-icon.demo.js
website/demos/filter.demo.js
website/demos/grid.demo.js
website/demos/launcher.demo.js
website/demos/select.demo.js
website/demos/tag-picker.demo.js
website/demos/message.demo.js
website/llms.txt
docs/llms.md
docs/llms.txt
docs/api.json
DESIGN-SYSTEM.md
CHANGELOG.md
```

Generated bundles, declarations, and `site/` are verification output. They are not committed unless
the repository already tracks them.

## Architecture boundaries

- Zx core owns semantic DOM, state editing, keyboard/focus behavior, validation, responsive
  presentation, and component lifecycle. It does not own routing, persistence, authorization,
  server schemas, or executable backend queries.
- ZeyOS module/entity names, icon identities, colours, launcher payload mapping, and entity URL
  resolution stay in `src/zeyos`. Core components accept data and renderers without importing the
  optional adapter.
- `Filter` authors a versioned, JSON-safe expression AST. Backend adapters compile only allowlisted
  field/operator IDs. `DataFilter` remains the simple local-row filtering component.
- Liquid-glass treatment is CSS-first progressive enhancement. It uses translucent semantic
  surfaces, borders, gradients, shadows, and `backdrop-filter` where supported, plus an opaque
  reduced-transparency fallback. No pointer-tracking or distortion JavaScript is added.
- No runtime dependency is introduced.

## AppIcon and ZeyOS identity

`AppIcon` is a generic component accepting icon content, colour, size, label, badge, selected state,
and glass strength. It renders a stable square with an accessible image name when labelled and is
otherwise decorative. ZeyOS helpers build AppIcons from the existing module registry and preserve
`moduleChip()` as a backwards-compatible alias.

- Every registered ZeyOS module/entity can be rendered through a named module preset/helper.
- Launcher applications use AppIcon. Launcher recent/search records and `Select.entity()` use the
  same entity icon identity rather than generic placeholders.
- Glass is opt-in at component level and theme-configurable; forced/reduced-transparency modes keep
  content and focus indication legible.

## Select and TagPicker

- Add application-neutral `Select.entity()` with grouped items, optional recent items pinned above
  results, optional clear choice, asynchronous loading/hydration, and optional create action at the
  bottom. Keep prior ZeyOS entity helper exports as compatibility wrappers.
- Fix the Select disclosure button's geometry so the chevron remains centred at every control
  height, radius, density, and font setting.
- TagPicker natively understands optional `icon` and `color` item readers for both option rows and
  selected tags, while preserving custom `renderItem` and `renderTag` precedence.

## Filter

`Filter` is a query-expression editor with a version-1 AST:

```
{ version: 1, root: { kind: 'group', id, logic: 'and'|'or', children: FilterNode[] } }
```

Conditions carry stable `id`, `field`, `operator`, and JSON-safe `value`. Root is always a group;
IDs are unique; child order is meaningful; functions, DOM nodes, dates, cycles, and non-finite
numbers are rejected. Empty root means no filter. Unknown restored fields/operators remain visible
and invalid instead of being discarded.

- Core field types: text, number, money, date, datetime, boolean, enum, status, priority, country,
  currency, unit, entity, tags, and custom.
- Operators are type-allowlisted and define `none`, `single`, `pair`, or `many` arity. No regex or
  group-level NOT ships in v1.
- Draft `change` events include validity; explicit `apply` only emits for valid ASTs. Public methods
  include defensive get/set, add/update/remove/move, validate/apply/clear/focus, readonly/disabled,
  and destroy.
- Nested groups, maximum depth/count, asynchronous choice cancellation, deterministic mutation
  focus, an accessible status region, and 320px reflow are required.

## Grid/Table

- Editable Grid cells enter edit mode on one click. Table retains an explicit backwards-compatible
  trigger option so applications can request double-click editing.
- Optional row reordering renders a drag handle and emits a cancelable row-move event. Pointer drag
  and keyboard grab/move/drop are supported. Hierarchical moves stay within the same parent and move
  a row with its visible descendants.
- Optional column controls allow users to show/hide columns, preserve caller order, retain at least
  one visible column, and expose programmatic visibility methods/events.
- `Grid.BillingItems()` enables single-click editing and demonstrates the optional reorder and
  column controls; billing calculations and persistence remain application-owned.

## Theme, glass, toast, and documentation shell

- Theme Studio must apply font, tint, radius, density/control height, text size, and glass strength
  in addition to colours; its default preset label is `ZeyOS`. Rebuilds must not leak components.
- Flat, Glass, and Deep glass must resolve to visibly different semantic material tokens consumed
  by AppIcon, ordinary buttons, raised cards, and transient messages. Dense data surfaces remain
  opaque. ZeyOS AppIcons use one white glyph treatment across every module colour, with stable
  geometric centring and pointer/focus feedback.
- Every primary header, including Theme Studio, contains the centred documentation search. Search
  results show full `Group > Component > Section` breadcrumbs and the docs sidebar alphabetizes
  entries within each group.
- Documentation groups AppSidebar, Loading, Skeleton, Launcher, and AccountMenu under Layout.
- Landing navigation removes redundant Design System and Components links. Footers contain only
  Imprint, Privacy Policy, and LLMs.txt at the lower right.
- Message/Toast floating regions default to the upper right, size to their content, and use a
  translucent glass surface with safe fallbacks.

## Non-goals

- A router, query compiler, saved-filter service, SQL/REST/ZeyOS backend syntax, filter URL storage,
  virtualized grid, spreadsheet formulas, cross-parent hierarchy reparenting, undo history, or a
  runtime icon/chart/UI dependency.
- Copying third-party component code or CSS; the supplied glass example informs visual ingredients
  only.
- Publishing, tagging, or changing package version in this work package.

## Acceptance criteria

1. AppIcon unit/browser tests cover labelled/decorative states, all ZeyOS registry entries, colour
   identity, launcher application/recent records, and entity-select rows without generic icon loss.
2. Filter pure tests cover JSON round trips, structural/semantic rejection, nested AND/OR order,
   arity, unknown fields/operators, atomic `setValue`, defensive copies, depth/count limits, and
   valid-only apply. Browser smoke covers keyboard mutation focus, Escape popup behavior, async
   cancellation, readonly/disabled states, teardown, and 320px reflow.
3. TagPicker tests prove native icon/colour rendering without weakening custom-renderer behavior.
4. Grid tests prove single-click edit, opt-in double-click compatibility, accessible row movement,
   hierarchy restrictions, column visibility with one-column minimum, events, and teardown.
5. Browser smoke verifies Select chevron alignment under multiple theme settings; Theme Studio
   changes computed font, tint, radius, control height, text size, and glass; every header exposes
   the centred search with breadcrumb results.
6. Toast smoke verifies an upper-right content-sized region that does not stretch with the page and
   retains legible fallback styling when backdrop filtering or transparency preferences apply.
7. The docs taxonomy/footer/nav match this spec, live demos cover each public addition, generated
   API/LLM/type outputs are current, and `DESIGN-SYSTEM.md` contains an evidence-linked ZeyOS delta
   report with core/adaptor/application boundaries.
8. `npm test`, `npm run build`, `npm run build:site`, `npm run test:browser`, and
   `git diff --check` pass. `package.json` has no runtime `dependencies` field.
9. Two isolated read-only final reviews receive the implementation and these criteria but not each
   other's findings. Every accepted finding is reproduced or tied to source/test evidence.
