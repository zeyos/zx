# Table

A sortable, selectable, editable data table with a sticky header for dense records, transactions, and operational workflows.

Full reference: https://zx.zeyos.com/docs/llms.md · Live demo: https://zx.zeyos.com/docs.html#components/table · All components: https://zx.zeyos.com/docs/components/index.md

**Group and section rows.** `rowKind` names the field (or a callback) that classifies a row, and
`rowKinds` maps a kind to `{span, render, class}`. A `span: true` row renders one
`<th scope="colgroup">` across every rendered cell — including the selection and reorder columns —
and carries no others, which is what a heading row in a billing document actually is. Both
default to null, so a table that sets neither renders exactly as before. While any spanning row is
present the header sort controls are withheld and `setSort()` is a no-op: sorting a grouped table
scatters its positions out of their sections, and silently doing so is worse than not offering it.
The stacked presentation renders the heading alone rather than a row of labelled blanks.

Sortable, selectable, sticky-header data table. `fr` widths fill the container while px/auto
widths scroll horizontally, and multi-select adds a tri-state header checkbox plus Shift+click
range select.

- **Options** — `columns: [{ id, label, ariaLabel?, sortable?, width ('120px'|'2fr'|'auto'),
  minWidth?, pin?: 'start'|'end', group?, align,
  type?: 'text'|'number'|'currency'|'percent'|'unit', locale?, decimals?, currency?, unit?,
  render?: (row,i)=>Node|string, sortValue?, headerTitle? }]`, `data`, `rowId: 'ID'`,
  `sort: { id, dir }`, `sortMode: 'local'|'server'`, `selectable: false|'single'|'multi'`,
  `stickyHeader: true`, `height`, `virtual: false`, `emptyText`, `rowClass`, `zebra: true`, `variant:
  'default'|'plain'`, `hierarchy: false|{parentId, column?, expanded?}`, `interactive: false`,
  and `label`/`labelledBy`. Locale, currency, unit, and decimals may be row callbacks; values
  remain numbers in row data while display formatting is locale-aware.
- **Appearance** — the header sits on the table's surface (no band) in the muted text colour at a
  medium weight, sentence case; the sorted column's label takes the text colour beside its arrow.
  Rows are divided by `--zx-color-border-subtle`, the header by the ordinary border, and every cell
  uses tabular figures. Checked rows of a multi-selection keep the accent tint (`--zx-color-bg-selected`);
  the selected row of a `selectable: 'single'` table is the current record of a master–detail list
  and takes the neutral `--zx-color-bg-current` fill. Sortable and plain headers set the same type,
  and the scroll region reserves no scrollbar gutter until the table actually scrolls.
- **Column widths** — `fr` columns share what the columns with a CSS length leave over, and never
  less than their `minWidth` (a CSS length or a number of pixels, default `'5rem'`; `0` lifts the
  floor). The table takes a minimum width from those floors, so a container too narrow for them
  scrolls the table inline instead of squeezing the `fr` columns to nothing — in a windowed table
  as well. `minWidth` is also honoured on an `auto` column of a table with a fixed layout (one
  with `fr` columns, or `virtual`), where it has no default; a column with a CSS length `width`
  ignores it.
- **Sticky header** — `stickyHeader: true` sticks the column headers to the top of the table's
  **own scroll region** while its rows scroll. That takes a bounded region: set `height`, or use
  `virtual`, which caps the region at the window height. A table without one grows to the height
  of its rows, never scrolls itself, and its header leaves with the page; to keep a header in view
  while the *page* scrolls, give the table the height of the area it sits in. Header cells sit at
  `z-index: 2` inside the scroll region.
- **Pinned columns** — `pin: 'start'|'end'` on a column keeps it in view at that inline edge of
  the scroll region while the table scrolls sideways (`position: sticky`, so it follows the
  writing direction). A pinned column stays where the column order puts it and sticks once it
  reaches the edge: declare a `'start'` column before the columns it should stay in front of and
  an `'end'` column after them. Several pinned columns stack in column order, and the row handle
  and selection checkbox columns are pinned along with the first `'start'` column. Give a pinned
  column a `width` or keep it short — what is pinned is taken from the room the others scroll in.
  A cell focused by keyboard scrolls clear of the pinned columns. Pinning is not applied while
  the table is stacked (`responsive`). Pinned cells are opaque and paint the row's fill
  themselves; `--zx-table-pin-bg` sets their base, the header background unless set. Cells carry
  `data-pin="start"|"end"`, and `data-pin-edge` on the column next to the scrolling ones.
- **Header groups** — `group: 'Label'` on adjacent visible columns (with the same `pin`) gives
  them one shared header cell in a second header row above the column labels: a
  `<th scope="col">` with the right `colspan`, so assistive technology announces the group with
  every cell beneath it. Columns without a `group` have a blank above them. The group row holds
  no controls and takes no part in sorting or keyboard navigation; it counts as a row in
  `aria-rowcount`/`aria-rowindex`. Hiding or reordering columns regroups what is left: a group
  interrupted by another column becomes two cells. It works in plain, hierarchical and windowed
  tables, and sticks with the header.
- **Columns in the DOM** — every header and body cell carries `data-column="<id>"` in every mode,
  read-only included, so a table can be styled per column. A column with `label: ''` (icons,
  actions) keeps a blank header named by `ariaLabel`, or by its id; `ariaLabel` also names the
  column in the chooser and its cell editors.
- **`variant: 'plain'`** — for a table inside a card or panel that already draws the box: no outer
  frame, no header band, no zebra, hairline row dividers. Reflected as `data-variant="plain"` on the
  root; TableView passes it through `table: { variant: 'plain' }`.
- **Methods** — `setData()`, `addData()`, `updateRow(id,row)`, `removeRow(id)`, `getRow(id)`,
  `getData()`, `empty()`, `setSort(id,dir)`, `getSort()`, `clearSort()`, `getSelection()`, `setSelection(ids)`,
  `clearSelection()`, `reveal(id)`, `setLoading(bool)` (busy/skeleton state — dims rows, shows an
  indeterminate top bar, sets `aria-busy`, and is cleared by the next `setData`).
- **Events** — `rowclick {row, id, index, event}`, `rowdblclick`, `sort {id, dir}`,
  `selectionchange {rows, ids}`, `datachange {rows}`, and `rowtoggle {row, id, expanded}`.
  `rowclick` fires for Enter on a focused row as well as for a click; `event` is then the keydown.
  A click on a control inside a cell belongs to that control: it raises neither `rowclick` nor
  `rowdblclick` and does not select the row in a `single` selection. A control is a button, link,
  field or `<label>`, an element with a widget role or in the Tab order, editable content, or
  anything marked `data-zx-table-no-edit` — so a Toggle, a menu button or a link rendered into a
  cell needs no `stopPropagation()`. Mark a custom clickable element the same way.
- **Keyboard** — an *interactive* table implements the WAI-ARIA APG **Grid** pattern
  (`role="grid"`, with `aria-multiselectable` for `selectable: 'multi'`), or the **Treegrid**
  pattern with `hierarchy`. A table is interactive when it is `selectable`, has `editMode` or
  `hierarchy`, sets `interactive: true`, or has a `rowclick`/`rowdblclick` listener attached through
  `on()` or an `onrowclick`/`onrowdblclick` option (attaching one later turns the grid on). A host
  that listens only for the bubbling `zx-rowclick` DOM event passes `interactive: true`. TableView
  always bridges `rowclick` to `recordclick`, so its table is always a grid. Any other table keeps
  plain `<table>` semantics, no grid role, no name unless `label` is given, and no row Tab stop.
  In a grid the rows are one Tab stop with a roving `tabindex`; the row checkboxes and disclosure
  buttons leave the Tab order because the row keys cover them (links and buttons a host renders
  in cells keep theirs). Focus is on rows by default and on cells when `editMode` is set —
  reflected as `data-focus="row"|"cell"` on the root. ArrowUp/ArrowDown move a row,
  ArrowLeft/ArrowRight a cell (cell focus), Home/End go to the first/last row (cell focus:
  first/last cell of the row) and Ctrl+Home/End to the first/last row's corner cell,
  PageUp/PageDown move by the rows visible in the scroll region (10 when the table does not scroll
  itself). Enter activates exactly like a click (`rowclick`; selects in `single`), Enter/F2 on an
  editable cell opens its editor, Space toggles the row's selection when `selectable` (activates
  otherwise), Shift+ArrowUp/Down extends a `multi` selection from its anchor, and Ctrl/Cmd+A
  selects the rows in the DOM — like the header checkbox, not the rows `growing` holds back nor the
  children of collapsed branches. A sort, new data, or a change in expansion starts the anchor
  over. Treegrid: ArrowRight expands a collapsed row, then moves into its first child; ArrowLeft
  collapses an expanded row, then moves to its parent. With cell focus, ArrowLeft from the first
  cell lands on the row and ArrowRight from the row goes back to its first cell. The focused row
  (and column) is kept by id across `setData`, sorting, expansion, growing, and `updateRow`; when
  a collapsed ancestor hides it, the ancestor takes focus, and when it is gone, its neighbour does.
  Focus is only restored when the body had it, and without scrolling, so a polling refresh never
  pulls the page back to the table. An emptied table keeps focus on its frame until rows return.
  Column headers keep their sort buttons in the Tab order rather than joining arrow navigation —
  the one deliberate departure from the APG grid, which puts the header row inside it. Rows and
  cells show an inset `--zx-focus-ring` with a transparent outline that forced colours paint.
- **Naming** — `label` or `labelledBy` (an element id) names the table; a grid without either is
  named by the `table.label` message (English "Table"), so pass a real name. Row controls are named
  after the row's first cell with text through `table.selectRow` (`Select %1`), `table.expandRow`,
  `table.collapseRow`, and `table.moveRow`; `table.row` (`row %1`) stands in for a row without
  text, and `table.selectAll` names the header checkbox. Sort buttons and selection checkboxes are
  at least 24×24 px targets; the checkbox is drawn so the glyph stays `--zx-space-4` while a
  transparent border makes up the target.
- **Hierarchy** — flat parent references are projected as an ARIA `treegrid`; `getData()` and all
  editing/mutation APIs stay flat and ID-based. Orphans become roots, cycles render once, local
  sort reorders siblings without mixing levels, and growing counts visible rows. Use
  `toggleRow()`, `expandRow()`, `collapseRow()`, `expandAll()`, `collapseAll()`, and
  `getExpanded()`. `hierarchy.expanded` is read at construction only; `setExpanded(ids, {silent})`
  replaces the whole set afterwards in one render, which is what to call when restoring a saved
  state (a loop over `expandRow()` renders once per branch). `true` expands every branch, `false`
  or `[]` collapses them all; ids are compared as `rowId` returns them (`1` is not `'1'`), and ids
  that are not branches of the current data are dropped. Unless silent it emits one `rowtoggle`
  per branch whose state changed, after the render; a set equal to the current one renders and
  fires nothing. The native disclosure button works by pointer and keyboard without selecting
  or clicking the row.
- **Editing** — `editMode: false|'cell'|'row'` (default `false`, and completely inert until set),
  plus `editTrigger: 'double'|'single'` (Table defaults to double; Grid defaults to single).
  `'cell'` edits one cell, `'row'` opens every editable cell of the row and commits them as a unit.
  Editors are sized into the cell without changing row height, and an editing cell carries
  `data-editing="true"` (`data-invalid="true"` plus an `aria-live` message when a validator rejects).
  Text, number, and date editors select their content on entry, so typing replaces the value
  ("6" over "1.00" gives 6); a textarea keeps its caret.
- **Editable columns** — extra column keys: `editable: false|true|'text'|'number'|'select'|'date'|
  'checkbox'|'textarea'|((row)=>boolean)` (`true` infers `'number'` for number/currency/percent/unit
  columns and `'text'` otherwise; a function is evaluated per row, so individual rows stay
  read-only), `options` for `'select'` (`[{value,label}]`, a `{value: label}` map
  whose keys are always strings, or `(row)=>items`), `editorProps` (forwarded to the underlying
  NumberField/Select/Datebox/Toggle or to the generated `<input>`/`<textarea>`),
  `editor: (row, api)=>Node` for a fully custom editor (`api` is `{value, commit(value), cancel(),
  row, column}`; it wins over `editable`, but a per-row `editable` function returning `false` still
  marks the cell read-only), `parse: (raw,row)=>value` and `format: (value,row)=>string` (`format`
  seeds the text of a `'text'`/`'textarea'` editor, `parse` converts every editor's raw output back),
  and `validate: (value,row)=>true|string` (a returned string marks the cell invalid, shows the
  message, and refuses the commit).
- **Transaction editors** — currency and unit columns reuse `NumberField` and show the resolved
  currency/unit as its suffix unless `editorProps.unit` overrides it. This is a generic typed-grid
  contract: application code remains responsible for tax, discount, subtotal, and accounting
  formula rules.
- **Editing methods** — `startEdit(rowId, columnId)`, `commitEdit()`, `cancelEdit()`, `isEditing()`,
  `getEditing()` → `{id, columnId}|null`.
- **Editing events** — `editstart {row, id, column, columnId, value}`;
  `editcommit {row, id, column, columnId, value, previous, changes}` — **cancelable**:
  `preventDefault()` on the component event (`table.on('editcommit', …)` or the `oneditcommit` option,
  not the mirrored `zx-editcommit` DOM event) keeps the editor open so a server round-trip can reject
  the change (`changes` is the `{columnId: value}` map and holds every changed cell in row mode);
  `editcancel {row, id, column, columnId}`;
  `editinvalid {row, id, column, columnId, value, message}`. A committed change is written
  back through `updateRow()`, so `datachange` fires exactly as for a programmatic row update — a
  commit with no changes emits `editcommit` with an empty `changes` map and leaves the data alone.
  Sorting, filtering, or `setData()` while editing cancels the edit cleanly and emits `editcancel`.
- **Editing keyboard** — Enter or F2 on a focused editable cell starts editing (editable cells share
  one roving tab stop); the configured single/double pointer gesture starts it without emitting
  `rowdblclick`. Enter commits and
  returns focus to the cell (Shift+Enter stays a newline in a `'textarea'`, Space toggles a
  `'checkbox'`), Escape cancels and returns focus to the cell, Tab commits and moves to the next
  editable cell (Shift+Tab the previous), wrapping across rows, and tabbing past the last editable
  cell commits and leaves the table normally. Clicking outside the editor commits rather than
  discarding what was typed.
- **Growing** — `growing: <number>` renders that many rows and offers a control for the next batch,
  instead of laying out a result set nobody will scroll through. `growBy(count?)`, `showAll()`,
  `getRenderedCount()`, and `grow {rendered, total}`. `setData()` starts the batch over, since a new
  result set is not the old one grown. Row indices stay absolute — a row's index is its place in the
  data, not in what is on screen. **Select-all covers the rendered rows, not the whole result set**;
  call `showAll()` first to mean all of them. While growing, the table carries `aria-rowcount` and
  each row an `aria-rowindex`, so assistive technology hears the real total rather than the size of
  the batch.
- **Windowed rendering** — `virtual: true` draws only the rows in view and one viewport of overscan
  above and below; spacer rows keep the scroll height, so what the table costs stops depending on
  how many rows it holds. It is off by default, and a table that does not ask for it renders exactly
  as before. A windowed table is one grid over all of its rows, so `virtual` implies `interactive`:
  the table carries `aria-rowcount`, every drawn row an `aria-rowindex`, and the whole keyboard map
  moves through every row, drawing the one it lands on. The focused row and the row being edited
  stay drawn wherever the reader scrolls. Sorting, filtering through `setData()`, section rows,
  hierarchy, row-level controls in cells, inline editing, and the sticky header work as usual, and
  `getData()`, `getSelection()`, and exports built on them read the data, not the DOM. Selection
  reaches rows that are not drawn: a Shift range covers them, and **the header checkbox and
  Ctrl/Cmd+A take every row**, not only the drawn ones. `reveal(id)` scrolls a row into view, drawing
  it first, and returns whether it could; it works without `virtual` too, on any row in the DOM.
  `getRenderedCount()` reports the rows drawn. `virtual` wins over `growing`, and the conflict is
  reported once through the console. Limits: give the table a `height`, or its scroll region stops at
  the height of the window. **Rows have one height:** the table measures one row and takes that
  height for all, following `--zx-row-height`, so rows of differing height are not supported, and
  long text is cut short with an ellipsis rather than wrapped. Column widths cannot follow content
  that is not drawn, so the layout is fixed: `auto` columns share the width evenly, and a column that
  needs more sets `width`. It needs no `ResizeObserver`: where there is none (jsdom) the window
  draws for an assumed row height and viewport. **Find-in-page does not see rows that are not drawn**, and printing prints
  the drawn rows only.
- **Responsive stacking** — `responsive: false|'sm'|'md'|'lg'|'xl'` stacks each row into a card of
  label/value pairs below that width, instead of leaving a horizontal scrollbar with the data
  hidden behind it. The width measured is **the table's own container**, not the viewport, so this
  triggers inside a narrow split pane on a wide screen. A column with `popin: false` leads the card
  instead of becoming another labelled line — the identifying column usually wants that. Every cell
  carries `data-label`, so the labels are there whether or not the option is on. `isStacked()`
  reports the current state and `stackedchange {stacked}` fires on each crossing. Stacking drops
  `display: table`, which drops the implicit ARIA roles, so the component states
  `table`/`rowgroup`/`row`/`cell`/`columnheader` explicitly for exactly as long as the mode is on.
- **Empty state** — `emptyText` takes a string, a Node, or a function returning one, so an empty
  table can carry an icon, an explanation, and the action that resolves it (`emptyState({…})`).
  A function is re-called on every render, which is what to use when the placeholder holds controls.
- **Row order** — `rowReorder: true` adds a dedicated drag handle. Pointer drag moves rows before
  or after a sibling; Space/Enter grabs/releases the same handle and ArrowUp/ArrowDown moves it for
  keyboard users. `moveRow(id, targetId, position)` exposes the same guarded operation. Hierarchical
  rows only move among siblings, and an active local sort disables manual order. A cancelable
  `rowmove {row,id,target,targetId,position}` fires before `datachange`.
- **Column visibility** — `columnVisibility: true` renders a chooser; `hiddenColumns` seeds it.
  `getVisibleColumns()`, `getHiddenColumns()`, `setColumnVisible()`, and `toggleColumn()` preserve
  caller column order and never allow the final visible column to disappear.
- **Column order** — `columnReorder: true` adds up/down buttons to the chooser and ArrowUp/
  ArrowDown support while a column option is focused. `getColumns()`, `setColumns()`,
  `getColumnOrder()`, `setColumnOrder()`, and `moveColumn()` reconcile stale saved IDs and keep
  hidden/sorted state attached to stable column IDs. `columnorderchange {order}` fires after a
  user or non-silent programmatic change.
