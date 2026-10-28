# Zx audit: data views, filters, ZeyOS bindings

Scope: `src/components/{table,table-view,card-view,kanban-view,view,grid,chart,calendar,data-filter,filter,filter-panel,sort-control,list-toolbar,pagination,tree,finder,entity-ref,file-item,file-list,activity-item,activity-list,stat-tile}`, `src/zeyos/**`, `src/core/export.js`, the matching CSS, demos and `docs/llms.md` blocks. Yardstick: `AGENTS.md`.
Line numbers are from the working tree on 2026-10-28. `src/components/filter/filter.js`, `record-collection.layout.js` and the untracked `src/components/view-settings/` were being edited while this audit ran, so they may drift. Items marked **[verified]** were reproduced in the browser against `/src/index.js` with no translator installed.

## Executive summary

1. **Raw message keys reach the screen.** With no translator installed, `Table`, `CardView` and `DataFilter` print `table.empty`, `dataFilter.clear` and `dataFilter.all` **[verified]**. Other components use a `_message(key, fallback)` helper, but each one carries its own copy.
2. **Three filter components, three layout-level evaluators, no shared model.** There are 4 type vocabularies, 3 option shapes, 3 "select" semantics and 4 date serialisations. The Filter AST has no client evaluator and no ZeyOS compiler. Saved views store ZeyOS predicates, not UI filter state.
3. **Table is mouse-only for activation.** Rows are never focusable, so `rowclick`/`recordclick` and `selectable:'single'` cannot be used from the keyboard **[verified]**. `hierarchy` sets `role="treegrid"` without the treegrid keyboard model.
4. **TableView keeps two sources of truth.** RecordView state is mirrored into a composed Table through a re-entrancy guard. There are two field choosers that behave differently (a third, `ViewSettings`, is in progress). The `fieldControls` object switches TableView to the weaker one.
5. **Field descriptors differ in every component.** For example `render(row,i)` vs `render(record,i,value)`, `options` vs `choices`, `format` meaning 3 different things, and `rowId`/`recordId`/`valueKey`/`eventId`/fixed `id`. Same-named methods mean different things across sibling views (`toggleColumn`, `setColumns`, `getColumns`).
6. **i18n is split across five mechanisms:** `msg` keys with `%1`, Kanban `labels` with `%name%`, Calendar's un-namespaced keys, English option defaults, and hard-coded English template strings (Table row controls, record-card, CardView groups).
7. **Behaviour bugs [verified]:**
   - `KanbanView` ignores `fieldControls.target`.
   - `ListToolbar.bind(tableView)` mounts nothing, even though the demo claims it does.
   - The RecordView chooser drops focus to `<body>` after a move.
   - `FileList.updateItem` drops focus.
   - Filter's `withinLast`/`withinNext` render two date pickers.
8. **ZeyOS correctness:** filter date serialisation ignores the instance `timeZone`, although forms and tables honour it. `Pagination`'s JSDoc says it matches `zeyosTable()`, but they differ: one-based vs zero-based pages, 25 vs 50 page size, and pages > 0 append.
9. **Duplication is pervasive** and some of it is security-relevant: `safeRel` ×3, `sameValue` ×3, `normalizeHeadingLevel` ×5, 2 comparators with different collation, 4 text matchers, 4 grouping implementations, 3 progress bars. Most items carry a non-breaking extraction path.
10. **Conventions are mostly clean:** no `innerHTML`, no stray listeners, no clobbered class fields, and reduced-motion guards are present. The gaps:
    - one tier-1 token (`--zx-shadow-1`) that the lint regex misses
    - one BEM modifier
    - raw font-weights
    - hard-coded 24/26 px controls that ignore the 44 px policy used elsewhere

---

## 1. Redundancies

### 1.1 Filters: DataFilter vs Filter vs FilterPanel vs layout chips vs `zeyos/query` — **high**

What each one is:

| | `DataFilter` (`data-filter/`) | `FilterPanel` (`filter-panel/`) | `Filter` (`filter/`) | Layout chips (`website/layouts/record-collection.layout.js`) | `zeyos/query.js` |
|---|---|---|---|---|---|
| Purpose | Filters in-memory rows and emits them | Turns a server field map into a flat query object | Authors a nested AST | Chip bar plus `Filter` drawer | Converts DataFilter state into ZeyOS predicates |
| Field shape | `[{type,id,label,field\|fields\|get,options,emptyLabel,placeholder,element,predicate}]` (data-filter.js:14-44) | `{key:{type,label,options,min,max,step,placeholder,search}}` map (filter-panel.js:32-46) | `[{id,label,type,operators,defaultOperator,icon,choices,loadChoices,editor,minQuery,debounce}]` (filter.js:13-27) | `FILTER_FIELDS` in Filter shape plus a private `OPERATOR_TEXT` (layout.js:137-175) | `ServerFilterDefinition {id,field,rawField,fields,operator('>=','IN'),format,type,includeEmpty,includeNull,transform,toFilter}` (query.js:16-29) |
| Types | `select`, `text`, `custom` | `text`, `select`, `date`, `date:range`, `int`, `float`, `number`, `*:range` (filter-panel.js:646-660) | 15 types: `text`, `number`, `money`, `date`, `datetime`, `boolean`, `enum`, `status`, `priority`, `country`, `currency`, `unit`, `entity`, `tags`, `custom` (filter-model.js:14-40) | Filter types | `format`/`type` used only to detect dates |
| Option shape | `{value,label}` or primitive; legacy `{field,label}` (filter-core.js:111-121, data-filter.js:339-344) | `{value,label}`, `{ID,name\|title}` or primitive (filter-panel.js:754-770) | `choices:[{value,label,icon,color}]` | Filter shape | – |
| "Select" means | Single value, native `<select>` | **Multi**-value `Checklist` | `eq` or `anyOf` depending on operator | Filter operators | Predicate value |
| Value/state | `{id: value}`, `''` means inactive | Pruned `{key: value \| [values] \| {from,to}}` | `{version:1, root}` AST | `{logic, conditions:[{field,operator,value}], advanced}` | ZeyOS `filters` |
| Dates | None (custom) | `serialize: 'seconds'\|'ms'\|'iso'\|fn` at **runtime-local** midnight / end of day (filter-panel.js:735-746) | Raw `'YYYY-MM-DD'` / `'YYYY-MM-DDTHH:mm'` strings, no serializer | ISO text compared as strings (layout.js:240-275) | Only `Date` instances become Unix seconds as **instants** (query.js:331-340) |
| "Active" check | `isActiveFilterValue`: `false` and `[]` count as active (filter-core.js:35) | `isActiveValue`: `false` and `[]` are inactive (filter-panel.js:668) | `filled()` (filter-model.js:182) | `isComplete()` (layout.js:229) | `includeEmpty`/`includeNull` |
| API | `getState/setState/apply/clear/addFilter`; `filter{rows,state}` | `getValue/setValue/apply/reset/clear`; `change`, `apply{value}` | `getValue/setValue/apply/clear/...`; `change`, `apply{value}`, `invalid` | – | pure functions |

Overlaps and gaps:

- **No evaluator for the AST, so every layout writes its own.**
  - `record-collection.layout.js:245-288` contains `conditionMatches`/`nodeMatches`, a hand-written client evaluator for the core operator ids.
  - `crm.layout.js:347-359` contains `matchesFilters` for FilterPanel values.
  - `zeyos-invoices` uses DataFilter's built-in evaluator.

  Those are three evaluators for three shapes. The layout copy compares dates as strings and handles only some operators.
- **No ZeyOS compiler for the AST.** `docs/llms.md:1854` says to "keep the AST in saved views … compile it in a backend-specific adapter", but `src/zeyos` has no such adapter. `dataFilterStateToFilters` only understands DataFilter state.
- **Saved views persist ZeyOS predicates** (`SavedViewEntry.filters`, saved-views.js:16-26; capture at view.js:349). The UI filter state cannot be rebuilt from them, so a saved view cannot repopulate a FilterPanel, a Filter or chips.
- **Operator labels:**
  - `filterOperators` labels are English literals (filter-model.js:14-40) and are rendered as-is (filter.js:423).
  - The layout re-declares them with symbols (`OPERATOR_TEXT`).
  - Validation messages are English literals (filter-model.js:139-160, filter.js:827-830).
- **Text matching:**
  - `matchesText` is diacritic-insensitive with AND semantics (filter-core.js:22-28) and carries an open `// TODO(unify)` at line 23.
  - Kanban search is case-only with phrase support (kanban-policy.js:201-219).
  - `select/filter.js:34` and `view-settings.js:1611` each normalise again.

  The same query ("Muller" vs "Müller") therefore matches differently in DataFilter and in KanbanView.

**Recommendation: one model, several presentations.**

1. Promote `filter-model.js` to the single core model, e.g. `src/core/filter-model.js`. Contents:
   - **One field-type registry:** id, label key, operators, editor, serializer and glyph. It also replaces the `ViewSettings` `FIELD_TYPES` map and the `TableColumn.type` formatter switch. See §2.1.
   - **`normalizeChoices()`:** accepts `{value,label}`, `{ID,name}`, `{value:label}` maps and primitives.
   - **`evaluateFilterAst(ast, record, fields)`:** a client evaluator that uses the shared `matchesText`.
   - **Serialisation:** `serializeFilterValue(field, value, {timeZone, unit})`, using `calendarDayToUnixSeconds` for date-only fields.
2. Keep `Filter` (nested editor) and `FilterPanel` (flat form) as presentations of that model. Add a `FilterChips` presentation, lifting the chip bar out of `record-collection.layout.js`.
   - FilterPanel's value becomes a derived view: each key maps to one condition (`anyOf`, `between`, `contains`).
   - Add `toFilterAst()` / `fromFilterAst()` to FilterPanel.
3. Reduce `DataFilter` to a thin wrapper. Its select becomes an `eq` condition, its text a `contains` condition, its custom filter a predicate. Its state stays as-is for compatibility. Deprecate it in favour of `FilterPanel` plus `evaluateFilterAst`.
4. In `src/zeyos`, add `filterAstToZeyosFilters(ast, fields, {timeZone})` and `fieldToFilterField(meta)`, alongside `fieldToZxField`/`fieldToZxColumn`. Have saved views persist the AST, keeping `filters` for v1 documents and migrating them.

Migration cost: steps 1, 2 and 4 are additive and non-breaking. Deprecating DataFilter's shape is breaking, but only on a major release. Changing the saved-view document needs a v2 migration, and `migrateSavedViewDocument` already exists for that.

### 1.2 Table vs TableView: duplicated state and two choosers — **high**

- **Duplicated state.** `TableView` (table-view.js:69-143) composes a full `Table` while keeping RecordView's own copies of data, sort, selection, field order and hidden fields. It keeps the two in sync through `_withTableSync` and `_tableSyncDepth`, mapping in both directions (lines 121-143 and 205-265).
  - Every `sort`, `fields` or `state` refresh calls `table.setData()`, which rebuilds the body and resets `growing` (table.js:466).
  - `Table.setSelection` cannot be silenced (table.js:830-845). TableView depends on call ordering and `stopPropagation` (table-view.js:102-104, 184-185) to hide the duplicate DOM events.
- **Duplicated API.** Field-order and visibility logic exists twice:
  - Table: `reconcileTableColumnOrder`, `moveTableColumn`, `setColumnVisible`, `toggleColumn` and the hidden-columns invariant (table.js:574-700, 3142-3176, 360-361).
  - RecordView: `reconcileFieldOrder`, `moveViewField`, `setFieldVisible`, `toggleField` (record-view.js:296-356, 721-747, 820-826).
- **Duplicated row API.** Table `updateRow/removeRow/getRow` vs RecordView `updateRecord/removeRecord/getRecord`. The bodies are near-identical (table.js:504-548 vs record-view.js:207-242).

**Recommendation:**
- Make Table consume RecordView's state model rather than mirror it: extract `src/components/view/record-state.js` (data, order, hidden, sort, selection) and let both own one instance.
- Short of that, give Table `{silent}` on `setSelection`/`clearSelection`, and stop TableView from calling `setData` for sort-only refreshes.

Cost: the internal refactor is not breaking.

### 1.3 Field choosers (2 shipped, 1 in progress) — **high**

| | Table chooser (table.js:1310-1437) | RecordView chooser (record-view.js:499-672) | `ViewSettings` (untracked WIP) |
|---|---|---|---|
| Label | `table.columns` / "Columns" | `recordView.fields` / "Fields"; Kanban's comes from its own `labels.fields` | `viewSettings.*` |
| Keyboard | Arrow, Home and End on the move buttons | none | Arrow, Home, End, Space and drag |
| Focus after move | Restored (1366-1388) | **Lost to `<body>`** **[verified]** | – |
| Live status | yes (`zx-table__column-status`) | no | yes |
| Move labels | **hard-coded** `` `Move ${name} earlier/later` `` (1355, 1360) | i18n'd "Move %1 up/down" (649, 656) | – |
| Surface | Glass overlay tokens, 190 px wide (table.css:32-48) | `bg-raised`, 230 px wide; hover draws a focus ring (record-view.css:38-89) | – |
| Container | `<details>`: no Escape, no outside-click dismissal | same | content only |

Which one appears depends on how `fieldControls` is spelled: `true` shows Table's, an object shows RecordView's (table-view.js:80-105, 319-336). Yet the record-view.js:36-37 JSDoc says an object changes "only its wording and mount point".

**Recommendation:**
- Extract one internal `FieldChooser`. Build it on `ViewSettings`' field section once that lands, or on Table's implementation, which is the better of the two. Mount it in a `Dropdown`/popover (overlap with the overlays auditor) and use it in Table, RecordView, `ListToolbar.bind()` and `ViewSettings`.
- Delete `_renderViewFieldControls` and `_renderColumnControls`.

Cost: the visual change is not breaking. The `zx-table__column-*` and `zx-record-view__field-*` class names are consumed by CSS (table-view.css:13-23) and by `ListToolbar._findFieldControls`. Alias them for a release.

### 1.4 Sorting implemented 4–5 times — **medium**

- `table/sort.js` uses plain `localeCompare`: "Item 10" sorts before "Item 2", and numeric strings sort lexically, although `zeyos/query.js:47` notes that bigint columns come back as strings. It treats booleans and `NaN` like strings (sort.js:9-58).
- `core/util.js:210-231` `sortBy` uses numeric collation and puts empty and `NaN` values last. These are different semantics for the same job.
- `SortControl` cannot represent "unsorted": `null` means first field ascending (sort-control.js:120-126). It throws on unknown fields, whereas `RecordView.normalizeViewSort` returns `null` (record-view.js:811-817). Its event is `change{value:{id,dir}}`, against `sortchange{id,dir}` on views and `sort{id,dir}` on Table.
- `CardView` builds its own sort `<select>` with "(ascending)/(descending)" options (card-view.js:218-246) instead of using `SortControl`.
- Kanban inherits RecordView sorting.

**Recommendation:**
- Make `sortRows` delegate to util's comparator (numeric collation, nullish and `NaN` last).
- Let `SortControl` accept `allowNone` and emit `{id,dir}|null`.
- Replace CardView's private select with `SortControl`.

Cost: the collation change is visible behaviour but a bug fix. The rest is additive.

### 1.5 CardView vs KanbanView card rendering — **medium**

- `record-card.js` is genuinely shared (both views call `createRecordCard`).
- `kanban-card.js` adds head and footer pieces (indicators, progress, avatars) that **CardView cannot use**. That is a feature asymmetry for no technical reason.
- `kanban-card.js` also re-implements:
  - **Avatar:** its own avatar markup plus a tone map in CSS (kanban-card.js:189-207, kanban-view.css:790-817), against `Avatar`'s.
  - **Progress bar:** its own meter (kanban-card.js:116-133). `FileItem` has a third (file-item.js:137-142, 246), and `ProgressBar` (loading/progress-bar.js) is the public one.
  - **Badge toning:** `resolveKanbanIndicator` uses `tone`, while `StatTile`/`badge` use `kind`.
- Hard-coded English sits inside the shared helper:
  - record-card.js:140 `` `Select ${…}` ``, :146 `` `Actions for ${…}` ``, :157 `'Selected'/'Not selected'`.
  - card-view.js:342 repeats the selection strings, :307 has 'No records in this group.', :464 has 'Ungrouped'.

  Kanban instead routes the same words through `labels.selected/notSelected`, so one helper produces localisable text in one view and English in the other.

**Recommendation:**
- Move indicator, progress and assignee slots into `record-card.js` as `RecordCardOptions.head/footer`, built from `badge()`, `ProgressBar` and `Avatar`, so CardView gains them for free.
- Pass a `messages` object into `createRecordCard`, the way `filter.js` does with `FilterValueMessages`.

Cost: additive. Kanban's CSS class names `zx-kanban-view__avatar*`/`__progress*` would move, so keep aliases.

### 1.6 Pagination vs ZeyOS paging, and duplicated ZeyOS loaders — **high**

- **Page base and size.** `Pagination` is one-based with `pageSize: 25` (pagination.js:71, 113, 141). `zeyosTable` and `zeyosView` are zero-based with a page size of 50 (table.js:319-322, view.js:460-463).
- **Paging mode.** The bindings fix `pageSize` at construction and **append** for `page > 0` (table.js:211-212, view.js:256-257). That is load-more only, so a numbered pager cannot drive them.
- **The JSDoc is wrong.** pagination.js:96-99 says the bindings take "exactly the shape `zeyosTable()` expects — offset/pageSize for load()". `load()` accepts neither `offset` nor `pageSize`.
- **Duplicated loader.** `zeyosTable.load` (table.js:186-218) and `zeyosView.performLoad` (view.js:229-263) are copy-paste with drift:

  | | `zeyosTable` | `zeyosView` |
  |---|---|---|
  | Invalid page | throws `RangeError` (table.js:325-329) | clamps (view.js:466-469) |
  | Invalid page size | rejects non-integers (319-322) | floors (460-463) |
  | Bad filters | throws `TypeError` (332-337) | silently `{}` (472-474) |
  | Sort event listened to | `sort` | `sortchange` |
  | Destroy guard | **none**: loads keep calling `setData`/`setLoading` after `destroy()` | yes |
  | Saved views | no | yes |
  | Row identity | `rowId`, `onRowClick` | `recordId`, `onRecordClick` |

**Recommendation:**
- Extract `createServerPager({client, resource, projection, pageSize, onPage})` with `mode:'append'|'replace'`, `setPage(n)`, `setPageSize(n)` and destroy-awareness. Use it from both bindings.
- Add a `pagination` option or a `bindPagination(binding, pagination)` helper. Fix the JSDoc.
- Make validation consistent: throw in both.

Cost: changing the view binding from clamp to throw is mildly breaking. Everything else is additive.

### 1.7 FileList vs ActivityList — **medium**

The skeletons are the same:
- `setItems`, `getItems`, `getItem`, `updateItem`, `removeItem`, `setLoading(loading)` without a default, `_renderList`, `_createLoading`, `listContent`, `normalizeLoadingCount` (clamped to 12) and `{silent}` handling.
- Compare file-list.js:84-230, 301-316 with activity-list.js:104-260, 342-403. The `listContent` and `normalizeLoadingCount` bodies are identical.

They have drifted:
- FileList has `addItem(item, index)`; ActivityList has `appendItems`/`prependItems`.
- FileList's `getItems()` reads component state; ActivityList returns descriptor copies.
- Both fully destroy and rebuild every child on any mutation, which drops focus (§3.6).
- CardView's `loadingCount` clamps to 50 (card-view.js:509-512).

**Recommendation:**
- Extract an internal `KeyedCollection` base (keyed list of child components, loading/empty region, keyed reconciliation so unchanged children survive).
- Unify on `items`, `setItems`, `appendItems`, `prependItems`, `insertItem(index)`, `updateItem` and `removeItem`.

Cost: adding the missing methods is not breaking. Renaming `addItem` would be, so alias it.

### 1.8 saved-views vs legacy-saved-views — **low**

These are not duplicates: `legacy-saved-views.js` is a transport adapter for `SavedViewRegistry`. They do duplicate pieces of each other:
- `SavedViewScope` is declared in both files with different `userId` types: legacy-saved-views.js:1-6 has `string|number`, saved-views.js:9-14 has `string`.
- Scope normalisation exists twice (`normalizeScope` at legacy:100-109, `normalizeSavedViewScope` at saved-views:428).
- JSON clone/validate exists three times: legacy:133-155, saved-views:712-760, and `cloneJson` in filter-model.js:185-212.

**Recommendation:** import the typedef and `normalizeSavedViewScope` into legacy, and extract one `cloneJsonSafe()` (core/util). Cost: not breaking.

### 1.9 Helper duplication catalogue — **medium** (cumulative)

| Helper | Copies |
|---|---|
| `sameValue` | filter-core.js:124, data-filter.js:361, filter-panel.js:938 |
| `normalizeOption(s)` | filter-core.js:111, data-filter.js:339, filter-panel.js:754, field.js:619, multi-value-editor.js:376, schema.js:428 (returns a `{value:label}` map), table.js:2801 `normalizeEditorOptions` |
| `safeRel` (security) | record-card.js:443, entity-ref.js:479, activity-item.js:574. Belongs in core/dom.js beside `safeHref` |
| `normalizeHeadingLevel` | card-view.js:515, record-card.js:460, activity-item.js:581, activity-list.js:373, card.js:293 |
| `isNode` | card-view.js:535, record-card.js:419, entity-ref.js:463 |
| `listContent`, `normalizeLoadingCount` | file-list.js:301/313, activity-list.js:354/400; card-view.js:509 differs |
| `humanize` | record-view.js:843 `humanizeViewField` and schema.js `humanize`: identical |
| `referencedResource` | schema.js and zeyos/table.js:271 `referencedResourceFor`: identical |
| `inferLabelKey` | zeyos/table.js:283, zeyos/select.js: identical |
| `normalizePage`/`normalizePageSize`/`copyFilters` | zeyos/table.js:319-337 vs view.js:460-474, with different semantics |
| `clamp` | pagination.js:470 vs core/util.js:152 |
| `cssEscape` | filter.js:812, calendar.js:1634 |
| `_message(key, fallback, …args)` | filter, filter-panel, record-view, list-toolbar, pagination, table (`_message` at 1180 and `_msgOr` at 2322), calendar. It belongs on `Component` (core; out of my area) |
| Grouping | util.js `groupBy`, card-view.js:449 `groupCardRecords`, activity-list `groupActivityItems`, Kanban `columnBy`/`swimlaneBy` |
| Currency/number formatting | core/format.js (used by Table) vs zeyos/table.js:299 `formatCurrency` vs schema.js `numberRenderer`/`formatPercent`, both with locale `undefined` |
| Action descriptors | `RecordCardAction` (record-card.js:38-50), `EntityRefAction` (entity-ref.js:30-37), `ActivityAction` (activity-item.js:17-25), `ListToolbarTool`. Different keys (`kind` vs none) and 3 normalisers |
| Hierarchy | Table flat `parentId` projection (table.js:2665-2990) vs `tree/hierarchy.js` nested (shared by TreeView and Finder) |
| Search input | KanbanView builds a raw `<input type=search>` (kanban-view.js:1717-1724) instead of `Search`, which ListToolbar uses |
| Section rows | Table `rowKind`/`rowKinds` `span` (table.js:30-46) vs Grid `isBillingLine` kinds `group\|subtotal\|header\|section` (grid.js:138-141) |

**Recommendation:** add `src/components/_shared/` (or `core/`, with a spec) holding `options.js` (`normalizeChoices`, `sameValue`), `content.js` (`isNode`, `listContent`, `normalizeHeadingLevel`), `links.js` (`safeRel`), `text-match.js` and `grouping.js`. Cost: internal only, not breaking.

### 1.10 Grid — **low**

`Grid` is `Table` plus a default of `editTrigger:'single'` (grid.js:40-50). Its only value is the `BillingItems` preset, and that preset carries product defaults: `currency='EUR'` (grid.js:84) and English column labels at lines 160-202.
- `zx.grid()` (layout factory) and `zx.Grid` (data grid) differ only by case (index.js exports).
- `cssName='table'`, and its block class `zx-grid-billing__summary` matches no component block.

**Recommendation:**
- Keep `Grid` only as a preset namespace and rename it (e.g. `TablePresets.billingItems()`).
- Have the preset use `rowKind`/`rowKinds` instead of `isBillingLine`, and take labels through `msg`.

Cost: breaking rename, so alias it.

---

## 2. API inconsistencies

### 2.1 Field/column descriptors — **high**

| Concept | TableColumn | ViewField | Filter FilterField | FilterPanelField | DataFilter def | SortField | CsvColumn | ZeyOS Field descriptor | Calendar | Kanban |
|---|---|---|---|---|---|---|---|---|---|---|
| id | `id` | `id` | `id` | map key | `id` | `id` | `id` | `id` | `eventId` reader | `columnBy` etc. |
| accessor | none (`id` only) | `get(record,i)` | – | – | `field`/`fields`/`get(row)` | – | `value(row)` | `path` meta | `eventTitle`… | `titleField`, `identifier`… |
| display | `render(row,i)` | `render(record,i,value)` | – | – | – | – | – | `render(row)` | – | `renderCard(ctx)` |
| type | `'text'\|'number'\|'currency'\|'percent'\|'unit'` (table.js:19) | free string, default `'text'` (record-view.js:22) | 15 types | `text`, `select`, `date`, `int:range`… | `select\|text\|custom` | – | – | `int`, `float`, `toggle`, `zxselect`, `optionlist`… (schema.js:237-290) | – | – |
| choices | `options` (`[{value,label}]\|{v:l}\|fn`) | – | `choices` | `options` (also `{ID,name}`) | `options` | – | – | `options` (`{v:l}` map) | – | `columns:[{id,label,value}]` |
| `format` | **editor initial text** (table.js:96) | – | – | – | – | – | – | zeyos `formats` = **semantic type** | – | – |

`format` therefore means "editor text" in Table, "semantic type" in the ZeyOS options, and "formatter" in `core/format.js`.

ZeyOS view fields are `fieldToZxColumn` output spread into ViewFields (view.js:149-154), so they carry Table-shaped `render(row)`. `TableView.fieldsToTableColumns` then calls `field.render(record, index, value)` (table-view.js:295-296). This works only because the extra arguments are ignored.

**Recommendation:** define one canonical `FieldDescriptor` in core: `{id, label, type, get, render(record,i,value), sortValue, choices, sortable, align, width, view:{table,card,filter}}`.
- `TableColumn`, `FilterField` and `FilterPanelField` become projections of it (as `fieldsToTableColumns` already does for Table).
- Rename `TableColumn.format` to `editFormat`, keeping `format` as a deprecated alias.
- Make `options` vs `choices` both accepted everywhere through `normalizeChoices`.

Cost: additive, plus deprecations.

### 2.2 Identity, selection and accessor option names — **high**

- **Row identity:**
  - `rowId` on Table and zeyosTable.
  - `recordId` on views and zeyosView.
  - `valueKey`/`labelKey`/`childrenKey` on TreeView, Finder and Select.
  - `eventId`/`eventTitle`/… on Calendar (calendar-model.js:21-29).
  - A fixed `id` property on FileList, ActivityList and EntityRef.
  - `ID ?? id` fallback in zeyos/calendar.js:28.
- **Selection — a direct clash:**
  - RecordView: `selectable` is the mode and `selection` holds the initial ids (record-view.js:67-68).
  - TreeView: `selection` is the **mode** and `selected` holds the ids (tree.js:17-18).
  - Table has no initial `selection` option at all (table.js:283-307), and no `getSelectionIds()`.
- **"filter" and "search":**
  - TreeView `filter: ''` is a label substring.
  - KanbanView `filter` is a predicate function, and its `search` is a string.

**Recommendation:**
- Standardise on `recordId`/`rowId` as aliases.
- Rename Tree's `selection` to `selectable`, keeping `selection` as a mode alias for a deprecation cycle; that is breaking long term.
- Add `selection` and `getSelectionIds()` to Table.

### 2.3 Events and payloads — **medium**

- **Sort:** `sort{id,dir}` (Table) vs `sortchange{id,dir}` (views) vs SortControl `change{value:{id,dir}}`. The ZeyOS bindings listen to different names (table.js:246 vs view.js:428).
- **Click:**
  - `rowclick{row,id,index,event}` (Table).
  - `recordclick{record,id,index,event}` (CardView/Kanban).
  - TableView emits `{...detail, record}`, so it carries both `row` and `record` (table-view.js:186-193).
- **Data and selection:**
  - `datachange{rows}`/`selectionchange{rows,ids}` (Table) vs `{records}`/`{records,ids}` (views) vs `{items}` (FileList/ActivityList).
  - TableView has to stop the inner events from propagating (table-view.js:184-185). FilterPanel and SortControl do the same against their children (filter-panel.js:553-557, sort-control.js:53).
- **Actions:** `recordaction` (Card/Kanban) vs `action` (FileItem, EntityRef, ActivityItem, ListToolbar), with different detail keys (`fileId` vs `id`).
- **ZeyOS callbacks:** `onRowClick(row, event)` vs `onRecordClick(record, event)` (table.js:260-268, view.js:174-176).

**Recommendation:**
- Have Table also emit `sortchange` and `recordclick`, keeping the old names.
- Have nested composites rename child events (e.g. `zx-child-change`) instead of stopping propagation.

Cost: additive.

### 2.4 Method naming collisions inside the RecordView family — **high**

| Method | Table / TableView | KanbanView |
|---|---|---|
| `toggleColumn(id)` | toggles column **visibility** (table.js:698) | **collapses** a lane (kanban-view.js:619) |
| `setColumns` / `getColumns` | field descriptors | lane descriptors (477-486) |
| `setColumnOrder` / `moveColumn` | field order | lane order (526-555) |

Table's `toggleRow` (expand) sits beside RecordView's `toggleSelection`.

Update verbs vary across siblings:
- `set(values)`: EntityRef, FileItem.
- `setActivity`: ActivityItem.
- `update(options)`: StatTile, Chart.
- `setItems` vs `setData`.
- `updateRow` vs `updateRecord` vs `updateItem(id, patch)`. Table/RecordView replace the whole row; lists merge a patch.

Code that accepts "any record view" (`zeyosView`, `ListToolbar.bind`, `ViewSettings.bind`) can therefore call the right name with the wrong meaning.

**Recommendation:** rename Kanban's methods to `setLanes`/`getLanes`/`setLaneOrder`/`toggleLane`/`moveLane`, keeping the old names for a cycle, and document one verb set per role. Cost: breaking after deprecation.

### 2.5 State objects — **medium**

- **Getter/setter names:** `getViewState`/`setViewState` (views) vs `getState` (DataFilter, Pagination, ViewSettings) vs `getValue` (Filter, FilterPanel, SortControl).
- **Versioning:** only the RecordView state and the Filter AST are versioned.
- **Kanban:** `KanbanViewState` re-types `sort` inline (kanban-view.js:87-97).
- **Saved views:**
  - Plain `Table` has no state, so `zeyosTable` cannot use them.
  - A view saved as `card` cannot be applied to `table` (saved-views.js:316-323), although `fieldOrder`/`hiddenFields`/`sort` are shared and RecordView documents that one state "may seed another" (llms.md:1575-1577).
- **Vocabulary mismatch:**
  - ListToolbar shapes are `table|list|cards|gallery|board` (list-toolbar.js:19-26).
  - Saved-view types are `table|card|kanban` (saved-views.js:73).
  - `presentationType` reads `cssName` (view.js:514-522).

**Recommendation:**
- Apply shared state across types and keep type-specific keys namespaced.
- Map ListToolbar shape ids to presentation types in one table.
- Give Table `getViewState`/`setViewState`.

### 2.6 i18n mechanisms — **high**

1. **Raw `this.msg(key)` without a fallback.** Raw keys show **[verified]**:
   - table.js:1709 (`table.empty`)
   - card-view.js:333 (`table.empty`, borrowing Table's key)
   - data-filter.js:118, 276 (`dataFilter.clear`, `dataFilter.all`)

   The library ships no default catalogue (`core/i18n.js:43-46` returns the key).
2. **`_message(key, 'English %1')`.** Correct, but re-implemented in ~8 files.
3. **KanbanView `labels` option** with `%name%` placeholders and **no `msg` integration** (kanban-view.js:242-301, 2455-2460). `setLanguage()`/`setTranslator()` do nothing for the board.
4. **Calendar** overrides `msg` with **un-namespaced** keys (`today`, `new`, `more`; calendar.js:76-98) mixed with namespaced `calendar.viewSwitch` (193).
5. **English option defaults** that bypass `msg`:
   - `label: 'Card view'` (card-view.js:99/129) and `'Kanban board'` (kanban-view.js:374).
   - `'Files'`, `'Loading files'`, `'No files'` (file-list.js:42-45).
   - `'Activity'`, `'Loading activity'`, `'No activity yet'` (activity-list.js:56-63).
   - `'Tree'`, `'Nothing to show'`; Finder `'Empty'`.
   - `'Chart'`, `'No chart data'`, `'Unable to render chart'` (chart.js:77-83).
   - SortControl `'Sort by'`, `'Ascending'/'Descending'` (sort-control.js:27, 97).
   - FileItem `actionsLabel: 'File actions'`.
6. **Hard-coded template English:**
   - table.js:1355, 1360, 1497, 1582, 1588, 1767, 1770, 1780, 1835.
   - record-card.js:140, 146, 157; card-view.js:307, 342, 464.
   - activity-list `'Other'`; calendar-model.js:155 `'Untitled event'`; zeyos/calendar.js:34 `'Untitled appointment'`.
   - zeyos/form.js:85 `` `Select ${label.toLowerCase()}` ``, which also lowercases German nouns.
   - zeyos/schema.js `PRIORITY_LABELS`.
   - Locale: `toLocaleString()` with the runtime locale instead of `getLanguage()` (list-toolbar.js:463, pagination.js:482); schema.js/zeyos/table.js use `Intl.*(undefined)`.

**Recommendation:**
- Ship an English default catalogue in core (`src/i18n/en.js` merged by `translate`) so `msg(key)` never returns the key. That one change fixes 1 and makes 2 unnecessary.
- Migrate Kanban `labels` and Calendar keys to namespaced `kanbanView.*`/`calendar.*` keys, keeping `labels` as an override.
- Replace English option defaults with `null` that resolves through `msg`.

Cost: the catalogue is non-breaking. Changing the defaults to `null` is not breaking for anyone who passes a value.

### 2.7 Defaults and naming drift — **low/medium**

| Setting | Values |
|---|---|
| `pageSize` | 25 (Pagination, layouts) vs 50 (ZeyOS bindings) |
| Search debounce | 250 (ListToolbar) vs 120 (Kanban `SEARCH_DEBOUNCE`, kanban-view.js:229) vs 200 (Filter `loadChoices`) |
| Search threshold | 8 (FilterPanel `SEARCH_THRESHOLD`, ViewSettings `searchThreshold`) vs unconfigurable in `SortControl` (always searchable) |
| Loading count clamp | 12 (FileList/ActivityList) vs 50 (CardView) |
| Empty content | `emptyText` (most) vs `emptyLabel` (DataFilter select's "All" option) vs `placeholder` vs `labels.empty` (Kanban) vs `msg('table.empty')` |
| Clear label | `clearLabel` (DataFilter, Filter); none on FilterPanel (msg only) |
| `setLoading` | Table: `loading=true` default, dims and shows a progress bar. Lists: no default, show skeleton plus status. CardView: skeleton cards. **Kanban: ignores it** (kanban-view.js:949 `if (_reason === 'loading') return`, CSS only). Chart: own state |

**ZeyOS binding signatures:**
- `(client, resource, opts)` for table, form and select; `(client, resource, View, opts)` for view.
- `(target, options)` for calendar, with no client and no loading. `(target, state, options)` for module bar.
- `zeyosTable` cannot take a target; `zeyosView` takes `opts.target`.
- `zeyosCalendar` has no `timeZone`. All-day detection uses runtime-local midnight (zeyos/calendar.js:36-37, 112-114), unlike the date-only handling elsewhere.

**Recommendation:** shared constants module (`DEFAULT_PAGE_SIZE`, `SEARCH_DEBOUNCE`, `SEARCH_THRESHOLD`); one `setLoading(loading=true)` contract (busy attribute plus an optional skeleton); a `target` option on every binding.

---

## 3. Behaviour and accessibility

| # | Sev | Where | Problem | Recommendation | Cost |
|---|---|---|---|---|---|
| 3.1 | **high** | table.js:1719-1815, 1845-1893 | Rows and cells are never focusable outside `editMode`, and `rowclick` plus `selectable:'single'` selection exist only on click **[verified: 0 focusable body elements]**. CardView/Kanban cards are `tabindex=0` with Enter and Space (card-view.js:389-405), so in TableView the same `recordclick` is mouse-only. | Implement the APG grid pattern: roving `tabindex` on rows or cells, Arrow/Home/End, Enter to activate, Space to select. Or at minimum make the first cell a row link/button. | Additive |
| 3.2 | **high** | table.js:376, 1736-1739 | `hierarchy` sets `role="treegrid"`, `aria-level` and `aria-expanded` but has no arrow-key model (no `Arrow*` handling outside reorder buttons; grep table.js). The role promises keyboard behaviour that is not there. | Implement treegrid keys (Right/Left expand and collapse, Up/Down move) or drop to `role=table` with disclosure buttons. | Additive |
| 3.3 | medium | table.js:1794-1798, 2296-2316 | In `editMode`, one editable cell holds `tabindex=0` (roving) but no arrows move it. Other cells are reachable only through Enter/F2 then Tab, which commits each cell along the way. | Same grid navigation as 3.1. | Additive |
| 3.4 | low | table.js:1734 | `aria-selected` on `<tr>` inside a native table (role `table`) is not supported there. | Use the grid role from 3.1, or rely on checkbox state. | – |
| 3.5 | medium | table.js:1767, 1780, 1835 | Row handle, checkbox and disclosure are named by **index** ("Select row 3", "Expand row 3"), in English. Screen-reader users cannot tell rows apart, and the names change on sort. | Name them by the row's primary column (`tableColumnName`/first visible value) through `msg`. | Not breaking |
| 3.6 | medium–high | file-list.js:84-90, 162-192; activity-list.js:104-112, 206-230 | Every mutation destroys and rebuilds all children. **[verified]** `updateItem(1, {progress:50})` moves focus from the item's Cancel button to `<body>`, which repeats on every upload progress tick. | Keyed reconciliation: update the existing `FileItem` through `set()`/`setProgress()` (file-item.js:160-186 already exist). | Not breaking |
| 3.7 | medium | record-view.js:514-524, 633-672 | After Move up/down the list is rebuilt without `focusId`, and focus goes to `<body>` **[verified]**. No live region announces the move, and the `<details>` popover has no Escape or outside-click close. Table's chooser handles all three (§1.3). | Covered by the `FieldChooser` extraction. | Not breaking |
| 3.8 | medium | kanban-view.js:437-441 | KanbanView calls `_createViewFieldControls` directly, so `fieldControls.target` is ignored and the chooser always renders inside the board toolbar **[verified]**, contrary to `ViewFieldControlsConfig` and llms.md:1558-1562. CardView and TableView use `_mountViewFieldControls`. | Use `_mountViewFieldControls(this._toolbar, configured ?? this._text('fields'))`. | Fix |
| 3.9 | medium | list-toolbar.js:612-620 | `bind(view)` finds a chooser only through `view.getFieldControls()` (implemented nowhere), **private** `view._viewFieldControls`, or `.zx-record-view__field-controls`. A default TableView renders Table's `.zx-table__column-controls`, so nothing is mounted **[verified]**. The demo text (list-toolbar.demo.js:50-53) claims otherwise. | Implement a public `getFieldControls()` on RecordView and TableView, and stop reading underscore fields. | Additive |
| 3.10 | medium | filter-model.js:32-33; filter.js:433-470, 778-790 | `withinLast`/`withinNext` have `pair` arity on date types, so the editor renders **two date inputs** **[verified]**. The intended value (amount plus unit) cannot be entered, and validation then demands two dates. | Give relative-date operators a dedicated arity (`'relative'`: number plus unit select) and a value shape `{amount, unit}`. | Breaks no saved data: today's values are unusable anyway |
| 3.11 | medium–high (ZeyOS) | filter-panel.js:735-746; query.js:331-340 | Filter date serialisation uses runtime-local midnight (FilterPanel) or instants (`dataFilterStateToFilters`). Forms and columns use `calendarDayToUnixSeconds(date, timeZone)` (form.js:231, 251; schema.js `calendarDayFormatter`). A viewer outside the instance zone filters `duedate` by the wrong day. | Give FilterPanel a `timeZone` option (or a `serialize` that receives the field). Add `timeZone` to `dataFilterStateToFilters` and the new AST compiler. | Additive |
| 3.12 | medium | table/sort.js:9-11 | Non-natural, locale-only string collation; numeric strings sort lexically. See §1.4. | Use util's comparator. | Behaviour fix |
| 3.13 | low–medium | table.js:417-423, 1766 vs kanban-view.js:460-466 | Row reorder uses native HTML5 drag-and-drop, which has no touch support (Kanban's own comment says so). Kanban uses a pointer path with long-press, and ViewSettings (WIP) has a third pointer implementation. Table columns cannot be dragged at all ("Column headers never become draggable", table.js:150). | Extract Kanban's pointer-drag into a shared `core/drag-list.js` used by Table rows, the field chooser and ViewSettings. | Internal |
| 3.14 | low | data-filter.js:109-113, 312-318; card-view.js:338-346 | DataFilter's badge is an `aria-live` span that is toggled `hidden`, which loses the announcement (list-toolbar.js:179-182 explains why that pattern fails), and it announces a bare number. Selection changes are announced only through `aria-description` (Card) or not at all (Table); Kanban has a live region. | Live region always present with a labelled sentence, plus a shared "n selected" announcement in RecordView. | Additive |
| 3.15 | low–medium | list-toolbar.css:77-84, 128-134; card-view.css:587-592; kanban-view.css:462-475, 665-670, 855-861; table.css:96-97, 157-158, 435-437; record-view.css:81-82; tree.css:50-51 | 44 px targets: always in ListToolbar, only under `(pointer: coarse)` in Card/Kanban (written as `44px` in one file and `2.75rem` in the other), and never for Table's 26/24 px move, handle and disclosure buttons or RecordView's 26 px move buttons. | One `--zx-target-min` token (44 px) and one coarse-pointer rule pattern applied to every icon-only control in the area. | Visual only |
| 3.16 | low | card-view.js:311 | Group headings are always `<h2>` whatever `headingLevel` is (cards default to h3), unlike ActivityList's `groupHeadingLevel`. | Add `groupHeadingLevel`. | Additive |
| 3.17 | low | zeyos/table.js:173-253 | No destroyed guard: a load that resolves after `destroy()` still re-renders into the detached root (the view binding guards this). Sort-triggered loads swallow errors with `.catch(() => {})`. | Covered by §1.6. | – |
| 3.18 | — | — | `destroy()` restoration: every component in the area snapshots and restores enhanced targets. Reduced motion: every `transition`/`animation` in the area's CSS sits under `prefers-reduced-motion: no-preference`. No issues found. | – | – |

---

## 4. Convention breaches

- **Stray `addEventListener`/`innerHTML`:** none in the area. `zeyos/view.js:423` calls `removeEventListener?.` only as a fallback for duck-typed views. That is not a component, so acceptable.
- **Module-level mutable state — low.**
  - `zeyos/schema.js:75` `warnedUnknownTypes` is a mutable `Set`.
  - `schema.js:30` `TYPE_MAP` is a mutable global registry. That is intentional for `registerFieldType`, but it is process-global, so two clients with different schemas share overrides.
  - Not a component, so not strictly covered by the rule. Document it, or move it into a `createSchemaRegistry()`.
- **Clobbered class fields:** none. The only match, record-view.js:744, is a local variable.
- **Tier-1 token — medium.** `kanban-view.css:191 box-shadow: var(--zx-shadow-1)`. `--zx-shadow-1` is defined in `styles/tokens/global.css:150`.
  - `tests/lint-tokens.js:75` only matches `gray|green|red|amber|blue|emerald|tone`, so neither `shadow-*` nor `accent-*` is caught.
  - Fix: use a semantic shadow token, and extend the regex to every name defined in `global.css` minus the allowed families.
- **Off-list semantic tokens — low.** `--zx-glass-*`, `--zx-overlay-surface-image`, `--zx-drag-shadow` (table.css:42-46, card-view.css:91-93, kanban-view.css:423-427, 657) are semantic but missing from AGENTS.md's allowed list. Either add them to the list or route them through `--zx-overlay-shadow`.
- **Raw typography — low.** `font-weight: 600/650/500/400` instead of `--zx-weight-*`:
  - table.css:657
  - card-view.css:58, 229
  - kanban-view.css:146-169, 237, 310
  - grid.css:5
  - calendar.css:182, 506
  - activity-item.css:55
  - stat-tile.css:89, 147

  There is no token for 650 at all. Also `font-size: max(10px, …)` at kanban-view.css:817.
- **BEM modifier — low.** `zx-filter__value--empty` (filter.js:436, filter.css:100-104) breaks the no-modifier rule. Use `data-state="empty"` or `[data-arity="none"]`.
- **Hard-coded px that should follow theme settings — low/medium.**
  - table.css:38 (190 px), :48 (360 px), :96-97/157-158 (26 px), :435-437 (24 px)
  - record-view.css:43-44, 81-82
  - filter.css:60 (28 px, should be `--zx-control-height`)
  - data-filter.css:18-20; filter-panel.css:13 (240 px)
  - finder.css:2 plus `columnWidth: 220` (finder.js:55, 80)
  - chart.css:14, 38
  - kanban-view.css:518 (`+ 13px`)
  - tree.css:50-51

  The 44 px floors in list-toolbar are deliberate and documented, but not applied consistently (§3.15).
- **Product-specific defaults in product-agnostic components — low.** `Grid.BillingItems` defaults to `currency='EUR'` with English labels (grid.js:84, 160-202). The CardView group fallback is 'Ungrouped' (card-view.js:464).

---

## 5. Docs drift (JSDoc ↔ `docs/llms.md` ↔ demos)

| Sev | Location | Drift |
|---|---|---|
| medium | llms.md:1558-1562; record-view.js:36-37 | Both say a `fieldControls` object changes only label and mount point. In TableView it swaps Table's chooser for RecordView's (table-view.js:80-105, 319-336), and in KanbanView `target` is ignored (§3.8). |
| medium | llms.md:2462-2464 vs list-toolbar.js:394-403 vs list-toolbar.demo.js:50-53 | Three different stories for `bind()`: llms.md says it "mounts a field chooser built with `fieldControls:{target}`", the JSDoc says it moves the view's chooser, and the demo says it moves the TableView chooser, which does not happen (§3.9). |
| medium | pagination.js:96-99 | "exactly the shape `zeyosTable()` expects — offset/pageSize for load()" is false (§1.6). |
| medium | llms.md:1854 | Says to keep the AST in saved views and compile it in an adapter. Saved views store ZeyOS predicates, and no adapter exists (§1.1). |
| low | llms.md:1651 | "WIP is visual advice". `wipPolicy:'block'` refuses moves (kanban-view.js:61, 167). |
| low | llms.md:1659 | "Native drag is an enhancement". Native `dragstart` is suppressed (kanban-view.js:464-466). |
| low | llms.md:1640 | "stable 20rem rail". CSS sets `--zx-kanban-column-width: 18.5rem` (kanban-view.css:2). |
| low | llms.md:1768-1777 | DataFilter docs omit that the empty option and Clear button require a translator (raw keys, §2.6). |
| low | website/demos/saved-views.demo.js | A complete demo module that is **not registered** in `COMPONENT_IDS` or anywhere else (grep). It still ships in the site build, because `tools/build-site.js` copies `website/` wholesale. Register it or remove it. |
| low | filter.js:688 (HEAD) | An orphan `/** @param {any} node @returns {string[]} */` precedes `groupDepth`'s real doc block. |
| info | `src/components/view-settings/` (untracked) | Not audited. It is already exported from `src/index.js` and documented in `docs/llms.md`. It adds a third field chooser, a second `bind(view)` and a sixth field-type vocabulary (`FIELD_TYPES`/`TYPE_ALIASES`, view-settings.js:16-50). It should land as the consolidated chooser (§1.3), not beside the other two. |

Cross-area overlaps, not covered in depth here:
- **Core:** `_message` belongs on `Component`, plus the missing default i18n catalogue. Also `core/util` `sortBy`/`groupBy` vs `table/sort.js`, and `core/format` vs ZeyOS formatters.
- **Overlays:** the `<details>` choosers should use `Dropdown`/popover.
- **Feedback and inputs:** `ProgressBar`, `Avatar`, `Search` and `badge` re-implemented in kanban-card, file-item and KanbanView.

---

## Prioritised top 10

1. **Ship a default English message catalogue in core** so `msg(key)` never renders a key. Then delete the ~8 local `_message` copies and move Kanban `labels` and Calendar keys onto namespaced `msg` keys (§2.6). Fixes visible raw keys in Table, CardView and DataFilter today. Not breaking.
2. **Make Table keyboard-operable.** APG grid/treegrid navigation, a keyboard path for `rowclick` and single selection, and row controls named by content rather than index (§3.1-3.5). Additive.
3. **Unify the filter model.** Core field-type registry plus `normalizeChoices`, `evaluateFilterAst` and a zone-aware serializer. FilterPanel and a new FilterChips become AST presentations; add `filterAstToZeyosFilters` and `fieldToFilterField`; saved views v2 persist the AST (§1.1, §3.11). Additive, with a later DataFilter deprecation.
4. **Extract one `FieldChooser`.** Use it from Table, RecordView, ListToolbar and ViewSettings. Fixes focus loss, the missing live region, the missing Escape and the hard-coded labels. Also fix Kanban's ignored `target` and give `bind()` a public `getFieldControls()` (§1.3, §3.7-3.9). Not breaking, with class aliases.
5. **Collapse the TableView/Table double state** into one record-state module, or at minimum add `{silent}` everywhere and stop full `setData` on sort (§1.2). Internal.
6. **Shared ZeyOS server pager** with replace/append modes, page-size changes and destroy-awareness. Reconcile `Pagination` one-based/25 with the zero-based/50 bindings and fix the false JSDoc (§1.6). Mostly additive.
7. **Resolve same-name/different-meaning methods** in the RecordView family (Kanban `*Column*` → `*Lane*`), the `selection` mode/ids clash in TreeView, and missing Table `selection`/`getSelectionIds` (§2.2, §2.4). Breaking after a deprecation cycle.
8. **Keyed reconciliation in FileList and ActivityList** via a shared collection base, so progress updates keep focus (§1.7, §3.6). Not breaking.
9. **Fix concrete defects:** `withinLast`/`withinNext` editor shape, numeric-string and natural sort in `table/sort.js`, and the `--zx-shadow-1` tier-1 token plus the lint-regex gap (§3.10, §1.4, §4). Small.
10. **Extract the helper catalogue** (`safeRel`, `sameValue`, `normalizeHeadingLevel`, `isNode`, text matcher, grouping, `cloneJsonSafe`, ZeyOS `humanize`/`referencedResource`/`inferLabelKey`). Move kanban-card's indicator/progress/avatar slots into `record-card` on top of `badge`/`ProgressBar`/`Avatar` so CardView gains them (§1.5, §1.9). Internal.
