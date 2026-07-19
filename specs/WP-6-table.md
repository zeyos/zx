# WP6 — Table family: Table, DataFilter

Branch: `wp6-table` from `main` (kernel merged). Read `AGENTS.md`.
Legacy reference: `../gx-core/src/classes/{Table,SimpleTable}.js`,
`../gx-bootstrap/src/classes/DataFilter.js`, demo `../gx-zeyos/docs/demos/Table.demo.js`.

## Scope

```
src/components/table/table.js|css
src/components/table/sort.js               # pure comparators (node-testable)
src/components/data-filter/data-filter.js|css
src/components/data-filter/filter-core.js  # pure filtering engine (node-testable)
demos/components/{table,data-filter}.demo.js
tests/unit/table-sort.test.js  tests/unit/data-filter.test.js
src/index.js styles/zx.css
```

## table.js — `class Table` (cssName `table`)

Single successor of gx.ui.Table AND gx.ui.SimpleTable.

```js
static defaults = {
  columns: [],        // { id, label, sortable=false, width ('120px'|'2fr'|'auto'), align,
                      //   render: (row, rowIndex)=>Node|string|number,  // default: row[id]
                      //   sortValue: (row)=>any,                        // default: row[id]
                      //   headerTitle }        ← legacy cols/structure()
  data: [],
  rowId: 'ID',        // string key or (row)=>id
  sort: null,         // { id, dir:'asc'|'desc' }
  sortMode: 'local',  // 'local' sorts data; 'server' only emits 'sort'
  selectable: false,  // false | 'single' | 'multi' (multi = leading checkbox column + header
                      //   tri-state select-all)
  stickyHeader: true, height: null,   // px|css → scroll container
  emptyText: null,    // msg key 'table.empty' default
  rowClass: null,     // (row)=>string extra class
  zebra: true,
}
```

- Data API: `setData(rows)`, `addData(rows)` (append), `updateRow(id, row)`, `removeRow(id)`,
  `getRow(id)`, `getData()`, `empty()`.
- Sort: `setSort(id, dir, {silent})`; header click cycles asc→desc→(none when sortMode local? no
  — cycles asc/desc only, matching legacy); `aria-sort` on the active th; comparator in
  `sort.js`: locale-aware string compare, numeric, Date, null-last — chosen per column via
  `sortValue` result type.
- Selection: `getSelection() -> rows`, `setSelection(ids)`, `clearSelection()`; row click
  selects (single) / checkbox toggles (multi); Shift+click range-select in multi;
  `aria-selected` on rows.
- Events: `rowclick {row, id, index, event}`, `rowdblclick {...}`, `sort {id, dir}`,
  `selectionchange {rows, ids}`, `datachange {rows}` (after set/add/update/remove).
- Markup: semantic `<table>` in a scroll div; `<th scope="col">`; sticky header via
  `position:sticky` (NO JS width syncing — this replaces legacy adoptSizeToHead entirely);
  `scrollbar-gutter: stable`. Column widths via `<colgroup>`; `fr` widths map to
  `width:%`-less `table-layout:fixed` strategy — document the approach chosen in JSDoc.
- Perf: `setData` with 5,000 rows must render < ~300ms using a DocumentFragment single pass (no
  virtual scrolling in this WP; note it as future work).

## data-filter.js — `class DataFilter` (cssName `data-filter`)

Declarative client-side filter bar producing a filtered array (successor of
gx.bootstrap.DataFilter, commonly wired to Table).

```js
static defaults = { filters: [], data: [], autoApply: true, clearLabel: null }
// filters: [{ type:'select', id, label, field(s) | get:(row)=>value, options? (auto-derived
//             distinct values when omitted), emptyLabel }
//           { type:'text', id, label, fields:[...], placeholder }   // multi-word AND fulltext
//           { type:'custom', id, element, predicate:(row, value)=>bool }]
```
- `filter-core.js` (pure): `applyFilters(rows, filterDefs, state) -> rows`; text matching reuses
  the same semantics as WP4's matcher (duplicate the tiny function if WP4 not merged; orchestrator
  will unify later — note a `// TODO(unify)` if so).
- Methods: `setData(rows)`, `apply() -> rows`, `clear()`, `getState()`, `setState(state)`,
  `addFilter(def)`.
- Event: `filter {rows, state}` (fired on any control change when autoApply).
- Renders controls inline (label + native select / search input), clear button when any active;
  active-filter count badge.

## Demos

- table: 30-row static demo (sortable columns incl. date + number, custom render with status
  chip, multi-select with selection readout, rowclick log); a 5,000-row perf demo with a
  "regenerate" button and render-time readout; server-sort demo (sort event log only);
  height-constrained sticky-header demo.
- data-filter: DataFilter wired to the 30-row Table (select on category, fulltext on
  name+notes, custom min-amount filter); state get/set buttons.

## Acceptance criteria

1. `npm test` green: sort comparators (strings w/ umlauts, numbers, dates, nulls, stability),
   filter-core (AND semantics, distinct-derivation, custom predicate).
2. 5,000-row demo renders and sorts without visible jank; no layout thrash warnings.
3. `aria-sort` toggles; multi-select tri-state header checkbox correct (unchecked/indeterminate/
   checked); Shift+click range works.
4. Sticky header stays aligned during horizontal + vertical scroll (the legacy failure mode).
5. Light/dark × density clean (compact density visibly tightens row height via tokens).
6. Double create/destroy clean.
7. Committed on `wp6-table`.

## Out of scope

Virtual scrolling, inline cell editing (future); pagination; compat mapping; Field integration.
