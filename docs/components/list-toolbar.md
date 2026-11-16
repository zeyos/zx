# ListToolbar — the bar above a record view

The bar above a record view: one search field, a live result count, the tools that change what the list shows, and the shape switch.

Full reference: https://zx.zeyos.com/docs/llms.md · Live demo: https://zx.zeyos.com/docs.html#components/list-toolbar · All components: https://zx.zeyos.com/docs/components/index.md

Every list carries the same four questions — what am I searching for, which records, which
columns, in what shape. The parts have always existed (`Search`, `SortControl`, `badge()`,
`button()`); this is the composition, so that every consumer stops assembling it differently and
forgetting the same thing.

- **Options** — `search: {placeholder?, value?, debounce?, clearable?}|false`, `count`,
  `countText`, `views: Array<string|{id, label?, icon?}>` (string presets `auto|table|list|cards|gallery|board`),
  `view`, `tools: [{id, label?, icon?, badge?, badgeKind?, pressed?, disabled?, onclick?}]`,
  `label`, `msg`.
- **Methods** — `setCount()`, `setBadge()`, `setPressed()`, `setToolDisabled()`, `setTools()`,
  `getTool()`, `getToolsElement()`, `addTool()`, `setView()`, `getView()`, `getSearch()`,
  `setSearch()`, `focusSearch()`, `bind()`, `unbind()`.
- **Events** — `search {value}`, `viewchange {view, previous}`, `action {id, pressed, tool}`.

Three properties are the reason to use this rather than assemble your own:

- **A tool's badge is part of its accessible name**, not a second thing beside it — a tool
  showing `2` announces as "Filters (2)". Once filters live behind a panel, a list can show four
  rows out of twenty with nothing on screen saying why, and the badge is what prevents that.
- **The count line is a live region**, and `setCount(null)` clears it. The previous number
  describes the previous filters; a stale count during a load is worse than none.
- **Tool buttons meet the 44 px target** at any spacing.

The current view and a pressed tool take the neutral `--zx-color-bg-current` fill — a mode the
list is in, not a pick — never the accent tint.

`bind(view)` is optional sugar for a `TableView`, `CardView`, or `KanbanView`: it feature-detects
rather than importing them, adopts the view's shape, and mounts the view's field chooser into the
tools slot through the view's public `mountFieldControls()` — for a default `TableView` that is its
Table's column chooser. `unbind()` hands it back to the view, and a view destroyed first takes it
with it. A chooser already mounted here with `fieldControls: {target: toolbar.getToolsElement()}`
is left where it is. The toolbar is fully functional without `bind()`.
