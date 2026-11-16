# TableView and the shared RecordView contract

A schema-friendly record view that composes the full Table: one field contract drives sorting, selection, editable cells, visibility, and stable column order.

Full reference: https://zx.zeyos.com/docs/llms.md · Live demo: https://zx.zeyos.com/docs.html#components/table-view · All components: https://zx.zeyos.com/docs/components/index.md

**`fieldControls` takes an object.** `true` and `false` behave as they always have; a
`{label, target}` object names the chooser's trigger and mounts the disclosure into a host
element — a list toolbar, say — instead of the view's own. `label` omitted resolves
`recordView.fields`. This is what lets a translated application use the chooser at all: the
trigger used to be the literal `Fields`, with no way to change it or move it. `TableView`,
`CardView`, and `KanbanView` all honour `target`.

**The chooser is public.** `getFieldControls()` returns the view's field chooser — the shared
disclosure, or for a `TableView` with `fieldControls: true` its Table's column chooser — and
`mountFieldControls(target)` moves it into a host element (`null` hands it back). The view keeps
owning it wherever it sits and removes it on `destroy()`; `ListToolbar.bind()` uses exactly this.
In the shared chooser the move buttons keep focus on the field they moved (or its other button once
one end disables), a polite live region announces "Name moved to position 2 of 5"
(`recordView.fieldMoved`), and Escape closes the disclosure and returns focus to its trigger.

`TableView` is the record-oriented entry point above the lower-level `Table`. It extends
`RecordView` and composes one complete `Table`, so editing, hierarchy, growing, row movement,
responsive stacking, loading, and advanced table events remain available through `getTable()`.

- **Shared fields** — every view accepts `fields: [{id,label,get?,render?,sortValue?,sortable?,
  visible?,duplicate?,type?,view?}]`. Primitive rendered values become text; an explicit Node is
  adopted. `field.view.table` carries Table-only column keys without changing CardView or KanbanView.
- **Shared options** — `data`, `recordId: 'ID'`, `sort`, `sortMode: 'local'|'server'`,
  `selectable: false|'single'|'multi'`, `selection`, `fieldOrder`, `hiddenFields`,
  `fieldControls: true`, and `emptyText`. At least one field remains visible.
- **Shared methods** — `setData()`, `addData()`, `updateRecord()`, `removeRecord()`, `getRecord()`,
  `getData()`, field getters/order/visibility methods, `setSort()`/`getSort()`, selection methods,
  `setLoading()`, `getViewState()`, `setViewState()`, `getFieldControls()`, and
  `mountFieldControls(target)`.
- **Portable state** — `{version:1,fieldOrder,hiddenFields,sort}` is JSON-safe configuration only.
  Records, selection, DOM nodes, rendered values, and callbacks are never serialized. A state from
  one record view may seed another; unknown fields are ignored and new fields append.
- **TableView composition** — `table: {...}` forwards every advanced Table option, while shared
  fields/data/id/sort/selection/visibility/order win on overlaps. `getTable()` returns the composed
  instance. Row events become shared `recordclick`/`recorddblclick` details.
- **Events** — `recordclick`, `recorddblclick`, `datachange`, `selectionchange`, `sortchange`,
  `fieldvisibilitychange`, `fieldorderchange`, and `statechange {state,reason}`.
