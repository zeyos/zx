# WP16 — Xenon design-system positioning and transaction tables

Branch: work on `main`. Read `AGENTS.md`, `specs/WP-6-table.md`, and
`specs/WP-13-website.md` first. This work package supersedes WP6's inline-editing exclusion and
WP13's website-only source exclusion only for the files and behavior named below.

## Objective

Present Xenon as ZeyOS's complete, dependency-free design system, with Zx as its plain-JavaScript
implementation. Improve the component documentation's hierarchy and preset treatment, and make
`Table` directly useful for editable billing and transaction lines without changing ZeyOS routing
or requiring an application rewrite.

## Scope

```
specs/WP-16-xenon-system.md
DESIGN-SYSTEM.md
website/index.html
website/site.css
website/docs.js
website/docs.css
website/demos/select.demo.js
website/demos/table.demo.js
website/demos/helpers.demo.js
src/components/table/table.js
src/components/table/table.css
src/core/dom.js
src/index.js
tests/unit/table-edit.test.js
tests/unit/table-billing.test.js
tests/unit/dom-builder.test.js
docs/llms.md
```

The separate ZeyOS repository may remove the retired framework experiment and its bootstrap. No other
Zx source component or generated artifact is in this work package.

## Design-system website and documentation

- Name the product **Xenon Design System** and explain that **Zx** is its dependency-free runtime.
- Describe four layers: foundations, components, patterns, and application layouts. Emphasize
  accessible enterprise workflows, coherent behavior, adaptation across theme/density/layout, and
  incremental adoption through the current ZeyOS DOM/UI seams (and the opt-in gx compatibility
  layer only for applications that actually use gx).
- Keep the current live component showcase and quick-start examples. Do not add an asset, font,
  framework, build step, analytics package, or runtime dependency.
- On component pages, render examples under a green-accent `Examples` heading. Demos marked
  `preset: true` render in a distinct `Presets` group immediately before `Examples`.
- Use a valid heading hierarchy: page `h1`, major groups `h2`, individual preset/example cards
  `h3`. Preset headings name the callable API, for example `Select.priority()`.

## Transaction-oriented Table additions

### Typed columns

`TableColumn.type` may be `text`, `number`, `currency`, `percent`, or `unit`. When `render` is not
provided, typed columns format their row value with the existing cached helpers in
`src/core/format.js`.

- `locale`, `decimals`, `currency`, and `unit` accept either a value or a row callback where
  applicable. `currency` is an ISO 4217 code; `unit` is display text such as `kg` or `hours`.
- Numeric types align to the inline end unless `align` is explicit.
- With `editMode` enabled, `editable: true` resolves to `number` for numeric typed columns and
  remains `text` for all other columns. Explicit editor declarations and custom renderers keep
  their current precedence.
- Currency and unit editors reuse `NumberField`, showing the resolved currency/unit as its suffix
  unless `editorProps.unit` is explicitly supplied. Values remain plain numbers in row data.
- Existing untyped columns render and edit exactly as before.

### Hierarchical line items

`TableOptions.hierarchy` is false or an object with `parentId`, optional `column`, and optional
`expanded`. `parentId` is a row property or callback returning the parent row id; null means a root.
Rows stay flat in `getData()` and all existing row mutation/editing APIs continue to use row ids.

- The visible body is a stable depth-first projection. Orphans are rendered as roots; cycles are
  rendered once and never recurse indefinitely.
- The hierarchy column shows an accessible expand/collapse button and depth indentation. Rows
  expose `aria-level`; the table uses `role="treegrid"` while hierarchy is active.
- Public methods: `toggleRow(id, options)`, `expandRow(id, options)`, `collapseRow(id, options)`,
  `expandAll(options)`, `collapseAll(options)`, and `getExpanded()`.
- `rowtoggle` emits `{row, id, expanded}` unless `{silent: true}`. Keyboard activation uses the
  native button behavior; expanding must not trigger row selection or row-click.
- Local sorting sorts siblings at each level. Server sorting preserves incoming sibling order.
- Growing counts visible rows after expansion. Collapsing a branch must not mutate or discard its
  descendants.

## Demo

Add one realistic editable transaction-lines example with invoices or procurement rows, mixed
currencies/units, parent and sub-items, quantity and unit-price editors, formatted totals,
validation, and an edit/toggle event log. Existing examples remain.

## ZeyOS DOM builder

Make the current ZeyOS `__(tag#id.class, properties, content)` builder a first-class Zx core export
instead of introducing a separate Classic bridge. Preserve its default element behavior and its
`D*` data, `S*` style, built-in property, boolean, attribute, and `on*` event rules. Export standalone
append/apply helpers for the four legacy return contracts (`_`, `__`, `$__`, `be`) and a shared
event on/remove/fire triad. Zx must not install globals or alter DOM prototypes; the existing ZeyOS
runtime keeps owning those temporary names and delegates their implementations to the pure helpers.

Additive support for Zx element providers is allowed. Exact builder content remains a single value;
arrays and plain objects retain their native `appendChild` failure contract, while the separate
`fragment()` helper may normalize arrays. Content must remain text-safe and must not parse strings
as HTML. Existing `h()` behavior stays unchanged.

## Out of scope

- Selecting or adding a chart dependency. The chart comparison is research only until the user
  explicitly approves an engine.
- Formula parsing, spreadsheet fill handles, arbitrary nested tables, pivoting, grouping unrelated
  rows, virtual scrolling, remote persistence, or undo history.
- Rewriting ZeyOS routing, page controllers, server schemas, or current UI application logic.
- Copying third-party code, markup, visual assets, or proprietary language.

## Acceptance criteria

1. Existing unit/token/type tests remain green; new pure tests cover typed formatting/edit
   inference and hierarchy order, orphan/cycle handling, sibling sorting, and expansion state.
2. The transaction demo visibly formats and edits currencies and units and expands nested items.
3. Hierarchical rows have correct treegrid semantics and expansion controls work by pointer and
   keyboard without selecting the row.
4. The generated documentation has no skipped heading level; Presets precedes Examples and both
   Select presets use their callable API names.
5. The landing page clearly distinguishes Xenon (system) from Zx (implementation), includes all
   four design-system layers, and retains working live examples and theme support.
6. `npm test`, `npm run build`, `npm run build:site`, browser smoke tests, `git diff --check`, and a
   desktop/narrow visual pass succeed.
7. `package.json` still has no `dependencies` field and no new dependency or remote asset exists.
8. DOM-builder fixtures cover real compact tags, ZeyOS property prefixes, legacy event
   registration/removal/firing, safe exact content, chain return values, collision-safe gx global
   installation, and the invariant that Zx performs no global/prototype installation.
