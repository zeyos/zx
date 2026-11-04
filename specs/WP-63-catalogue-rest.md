# WP63 — The rest of the text outside the catalogue

WP-62 closed Select, Table and Datebox and added a check that reads the screen. Everything else that
writes English straight into the DOM is still there: Filter's operators and validation, the default
labels of about thirty components, a calendar event's name, and a date range's spoken label. A page
with `de` installed shows those in English. This WP moves them into the catalogue and extends the
check to every page it touches, so the gap cannot reopen.

Work on the branch `wp/63-catalogue-rest`, from `wp/integration-55-61` with `wp/62-catalogue-gaps`
merged into it. `AGENTS.md` applies. `CHANGELOG.md` is central: report changelog lines. `docs/api.json`
is regenerated. Public files must not mention this spec.

This WP **explicitly permits** changes to one core file: `src/core/messages.js`. No other file under
`src/core/` changes.

## Decisions (binding)

1. **English does not change.** Every new entry holds exactly the text the component shows today.
   `tools/visual-diff.js` reports no difference.
2. **Whole sentences, never a slot for a word.** WP-62 Decision 2 stands. "This filter requires match
   all conditions." and its `any` sibling are two keys, not one with a slot, and each pair of
   singular and plural prompts in FieldUpload is two keys. A slot holds a name or a number the
   application supplied, never a word the library chose.
3. **What an application passed keeps its meaning.** Only an option left unset reads the catalogue.
   Passing text keeps working unchanged, and `''` and `null` mean what they meant:
   - Where the code read `??` or `||`, `null` already meant the default. Those options default to
     `null` and keep the same operator: the `label` of ActivityList, Chart, CodeEditor, Dock, FileList,
     Rating, SplitView and Tree; `actionsLabel`, `addLabel`, and the `moreLabel` of AppSidebar and Tree.
   - Where the code took the value as it came, `null` was a value of its own, so the default is
     `undefined`, as on SourceList, and the option is read with a destructuring default:
     `const { emptyText = this.msg('…') } = this.options`. These are `emptyText` on ActivityList,
     FileList, Tree, Finder and Chart; `loadingText` on ActivityList, FileList and Chart; Chart's
     `errorText`; CopyInput's `feedback` and `buttonTitle`; the `label` of AppSidebar, KanbanView,
     SortControl and Toolbar; Toolbar's `overflowLabel`; the `title` and `feedback` of `copyButton()`
     and `proseAnchors()`; and the `label` of `proseAnchors()`.
   - `null` on those shows nothing. That is what 5.x did for `emptyText` on the lists, Tree and Finder,
     and for the `label` of AppSidebar and KanbanView. The rest wrote the word "null" into the page,
     which no application can have meant, so they show nothing too.
   - An explicit `undefined` counts as unset.

   Element attributes follow, because `tests/unit/elements-kit.test.js` holds them equal to the
   component's defaults, so removing an attribute restores the default text.
4. **Code without a component reads the catalogue; a component uses an internal function.**
   `validateFilterAst()`, `rootLogicError()`, `billingColumns()`, `chartSummaryTable()`,
   `chartSummaryModel()`, `fileTypeLabel()`, `normalizeEntityRef()`, `normalizeFileItem()`,
   `normalizeKanbanDescriptors()`, `deriveKanbanDescriptors()` and `normalizeItems()` are exported and
   have no `msg()`. Each keeps the signature it released with and uses `translate()`, so a host
   translator reaches it. A component calls an internal function that takes the text as well, so a
   `msg` option reaches it. The text is never an extra positional parameter on the exported function:
   an exported function gets passed as a value, and `files.map(normalizeFileItem)` then writes the
   index into that parameter. `tests/unit/export-signatures.test.js` holds every exported function to
   the parameters it declared at the last release, and `formatDate()`'s options bag is its one
   exception. `normalizeCalendarEvents()` already takes options and reads a string from them, so it
   keeps `untitledTitle`.
5. **`filterOperators` stays English and frozen.** It is exported data, and hosts read it. A built-in
   operator's name is the `filter.op.<id>` message. A host-supplied operator keeps its own `label`:
   an entry in the `operators` option shows its label unless that label is the built-in text for
   that id, which is the case for `operators: filterOperators`, and for a spread that changes
   something else, and then it translates like the built-in. The rule compares labels rather than
   object identity for that reason. An id `filterOperators` does not have reads no message, so an
   operator without a label stays without one rather than showing `filter.op.<id>`.
6. **Deliberate absences stay.** `tree.empty`, `finder.empty` and `priority.medium` stay out of the
   catalogue. Tree and Finder keep asking for `tree.empty` and `finder.empty` first, so a host that
   translated those wins over `emptyText` as it does today; only the default `emptyText` moves, to
   the new keys `tree.noItems` and `finder.noItems`.
7. **Date patterns are patterns.** The three parts of a date range's spoken label are `formatDate()`
   patterns, as `datePicker.dayLabel` is, because German needs the ordinal dot on each: `5. – 12. März
   2026`. The dash between them is typography, not language, and stays in the code.
8. **Format names are not language.** PDF, CSV, HTML, JavaScript, Markdown and the like stay data in
   `FILE_KINDS`, and byte units stay in `formatBytes()`.

## §1 · Filter

**Scope:** `src/core/messages.js`, `src/locales/de.js`, `src/components/filter/filter.js`,
`src/components/filter/filter-model.js`, `tests/unit/filter.test.js`, `tests/unit/messages.test.js`,
`tests/unit/locale-de.test.js`.

- Twenty-seven `filter.op.<id>` entries, one per id in `filterOperators`, each holding that operator's
  `label`. `filterOperatorLabel(operator, text)` in `filter-model.js` implements Decision 5; it is
  module-private API, not exported from `src/index.js`.
- Filter asks at the moment it draws, not once in `render()`, so `this._operators` keeps the host's
  data and a redraw follows the catalogue, as the rest of its text does.
- `Filter` validates through `checkFilterAst(ast, fields, operators, text)` in `filter-model.js`, not
  exported from `src/index.js`, and an internal `logicError()` in `filter.js`, per Decision 4. Error
  `code` values do not change; only `message` does, and only under a catalogue.

| Key | English |
|---|---|
| `filter.emptyGroup` | Nested groups need at least one condition |
| `filter.fieldRequired` | Choose a field |
| `filter.fieldUnavailable` | Unavailable field: %1 |
| `filter.operatorRequired` | Choose an operator |
| `filter.operatorType` | %1 is not available for %2 |
| `filter.operatorUnavailable` | Unavailable operator: %1 |
| `filter.requiresAll` | This filter requires match all conditions. |
| `filter.requiresAny` | This filter requires match any conditions. |
| `filter.valueMany` | Choose at least one value |
| `filter.valueNone` | This operator does not accept a value |
| `filter.valueOne` | Enter a value |
| `filter.valuePair` | Enter both values |

## §2 · Default labels

**Scope:** `src/core/messages.js`, `src/locales/de.js`, the component files below, `src/elements/kit.js`,
`src/elements/define.js`, `tests/unit/messages.test.js`, `tests/unit/locale-de.test.js`,
`tests/unit/type-bindings.test.js` where a typedef changes, and the unit test of any component whose
default moves. `tools/size-budget.json` may rise if the entries take a bundle over its budget.

Confirmed real, each by reading the code:

| Component | File | What moves |
|---|---|---|
| AccountMenu | `account-menu/account-menu.js` | trigger name, panel fallback |
| ActivityList | `activity-list/activity-list.js` | `label`, `loadingText`, `emptyText`, the group without an id |
| AppSidebar | `app-sidebar/app-sidebar.js` | `label`, `moreLabel` |
| Chart | `chart/chart.js` | `label`, `emptyText`, `loadingText`, `errorText`, the summary table's caption, first column and unnamed series |
| CodeEditor | `code-editor/code-editor.js`, `field-adapter.js` | `label`, the position readout |
| Copy | `copy/copy-button.js`, `copy/copy-input.js` | `title`, `feedback`, `buttonTitle` |
| Dock | `dock/dock.js` | `label` |
| EntityRef | `entity-ref/entity-ref.js` | `actionsLabel` |
| FieldUpload | `field-upload/field-upload.js` | prompts, hint, progress, statuses, the errors it shows |
| FileItem | `file-item/file-item.js` | `actionsLabel`, status words, type words, progress and file fallbacks, metadata names |
| FileList | `file-list/file-list.js` | `label`, `loadingText`, `emptyText` |
| Finder | `finder/finder.js` | `emptyText` (Decision 6) |
| Form | `form/form.js` | the fallback name of an action |
| KanbanView | `kanban-view/kanban-view.js` | `label`, the 52 entries of `DEFAULT_LABELS` it asks for, the unassigned lane |
| MasterPanel | `master-panel/master-panel.js` | the action group's name, through the existing `panel.actions` |
| MultiValueEditor | `multi-value-editor/multi-value-editor.js` | `addLabel`, the row labels |
| NavigationBar | `navigation-bar/navigation-bar.js` | the overflow, navigation and action group names |
| Prose | `prose/prose.js` | `proseAnchors()`'s `label`, `title`, `feedback` |
| Questionnaire | `questionnaire/items.js`, `questionnaire/questionnaire.js` | the free-form input's fallback label |
| Rating | `rating/rating.js` | `label` |
| Slider | `slider/slider.js` | the number field's fallback name |
| SortControl | `sort-control/sort-control.js` | `label`, the direction words |
| SourceList | `source-list/source-list.js` | the heading it shows by default |
| SplitView | `split-view/split-view.js` | `label` |
| Toolbar | `toolbar/toolbar.js` | `label`, `overflowLabel` |
| Tree | `tree/tree.js` | `label`, `moreLabel`, `emptyText` (Decision 6) |
| Grid | `grid/grid.js` | the six `billingColumns()` headers |
| Elements | `src/elements/define.js` | the two validity messages of a required Select and Datebox |

- **KanbanView.** `labels` stays the per-instance override and keeps its keys. `_text(key, args)` reads
  an override first and then the `kanbanView.<key>` message. `msg()` fills positional placeholders,
  and these are named (`%count%`), so `_text()` takes the template from `this.msg(key)` and fills it
  with `printf()`, as it does today. `clearSearch` and `searchSummary` are never asked for, so they
  get no entry.
- **SourceList.** `label` draws a visible heading, and `null` or `''` already mean "no heading". So
  the default is `undefined`, not `null`, and only `undefined` reads `sourceList.label`. Decision 3
  gives every option of this kind the same treatment.
- **CodeEditor's `code` field.** The adapter stops writing the name itself and hands the editor the
  label it has or `null`.
- **MasterPanel** reuses `panel.actions`: same words, same role.

False positives, verified and left alone: **ViewSettings** field types already resolve through
`viewSettings.type*`; **RunStatus** and **RunTrace** hits are their `msg` keys; **Composer**'s are key
names for `aria-keyshortcuts`; `row-actions.js`'s `moreLabel` default is overridden by both callers;
`AppRailPresenter`'s `label` default is overridden by AppSidebar and ModuleBar. Their pages still join
`PAGES` where the check adds something (§4).

New keys (all but the two named tables, the operators and `kanbanView.*`, whose English is the
current text of `DEFAULT_LABELS`):

| Key | English |
|---|---|
| `accountMenu.fallback` | Account |
| `accountMenu.label` | Account menu |
| `accountMenu.labelFor` | Account menu for %1 |
| `activityList.empty` | No activity yet |
| `activityList.label` | Activity |
| `activityList.loading` | Loading activity |
| `activityList.other` | Other |
| `appSidebar.label` | Applications |
| `appSidebar.more` | More actions |
| `chart.empty` | No chart data |
| `chart.error` | Unable to render chart |
| `chart.label` | Chart |
| `chart.loading` | Loading chart… |
| `chart.series` | Series %1 |
| `chart.summary` | Chart data |
| `chart.summaryLabel` | Label |
| `codeEditor.label` | Code editor |
| `codeEditor.position` | Ln %1, Col %2 |
| `codeEditor.selection` | Ln %1, Col %2 · %3 lines selected |
| `copy.copied` | Copied |
| `copy.copy` | Copy |
| `datebox.required` | Please enter a date. |
| `dock.resize` | Resize panes |
| `entityRef.actions` | Entity actions |
| `fieldUpload.abort` | Abort |
| `fieldUpload.aborted` | Upload aborted. |
| `fieldUpload.choose` | Choose a file or drop it here |
| `fieldUpload.chooseMany` | Choose files or drop them here |
| `fieldUpload.complete` | Upload complete. |
| `fieldUpload.drop` | Drop a file here or choose a file |
| `fieldUpload.dropMany` | Drop files here or choose files |
| `fieldUpload.hint` | Choose from this device |
| `fieldUpload.httpFailed` | Upload failed with HTTP %1 |
| `fieldUpload.maxSize` | up to %1 |
| `fieldUpload.preview` | Preview of %1 |
| `fieldUpload.progress` | Upload progress |
| `fieldUpload.rejectedSize` | %1 exceeds the maximum file size. |
| `fieldUpload.rejectedType` | %1 is not an accepted file type. |
| `fieldUpload.requestFailed` | Upload request failed |
| `fieldUpload.uploading` | Uploading… |
| `fileItem.actions` | File actions |
| `fileItem.file` | File |
| `fileItem.kind.audio` … `.video` | one per family in `FILE_KINDS` |
| `fileItem.progress` | Progress |
| `fileItem.size` | Size |
| `fileItem.status.error` … `.waiting` | one per entry in `STATUS_LABELS` |
| `fileItem.type` | Type |
| `fileList.empty` | No files |
| `fileList.label` | Files |
| `fileList.loading` | Loading files |
| `finder.noItems` | Empty |
| `form.action` | Action |
| `grid.currency` | Currency |
| `grid.item` | Item |
| `grid.lineTotal` | Line total |
| `grid.quantity` | Quantity |
| `grid.unit` | Unit |
| `grid.unitPrice` | Unit price |
| `kanbanView.label` | Kanban board |
| `kanbanView.unassigned` | Unassigned |
| `multiValueEditor.add` | Add value |
| `multiValueEditor.moveDown` | Move value %1 down |
| `multiValueEditor.moveUp` | Move value %1 up |
| `multiValueEditor.remove` | Remove value %1 |
| `multiValueEditor.reorder` | Reorder value %1. Use the arrow keys to move it. |
| `multiValueEditor.value` | Value %1 |
| `navigationBar.actions` | Application actions |
| `navigationBar.more` | More |
| `navigationBar.primary` | Primary navigation |
| `prose.copied` | Link copied |
| `prose.copyLink` | Copy link |
| `prose.copyLinkTo` | Copy link to %1 |
| `questionnaire.other` | Other |
| `rating.label` | Rating |
| `select.required` | Please select a value. |
| `slider.value` | Value |
| `sortControl.ascending` | Ascending |
| `sortControl.descending` | Descending |
| `sortControl.label` | Sort by |
| `splitView.resize` | Resize panes |
| `toolbar.label` | Toolbar |
| `toolbar.more` | More |
| `tree.label` | Tree |
| `tree.more` | More actions |
| `tree.noItems` | Nothing to show |

## §3 · Calendar and date range

**Scope:** `src/core/messages.js`, `src/locales/de.js`, `src/components/calendar/calendar.js`,
`src/components/calendar/calendar-model.js`, `src/components/date-picker/date-range-picker.js`,
`src/components/activity-item/activity-item.js`, `src/components/agent-thread/agent-thread.js`,
`src/components/surface/surface.js`, `src/components/block-view/block-view.js`, new
`src/internal/date-locale.js`, new `tests/unit/date-locale.test.js`, `src/components/approval-card/approval-card.js`,
`tests/unit/locale-de.test.js`.

| Key | English |
|---|---|
| `calendar.eventLabel` | %1, %2 to %3 |
| `calendar.untitled` | Untitled event |
| `approvalCard.dateTimeFormat` | `%e %b, %H:%M` (a `formatDate()` pattern) |
| `approvalCard.fullDateTimeFormat` | `%e %b %Y, %H:%M` (a `formatDate()` pattern) |
| `daterange.dayLabel` | `%A, %e %B %Y` (a `formatDate()` pattern) |
| `daterange.span.day` | `%e` (a `formatDate()` pattern) |
| `daterange.span.full` | `%e %B %Y` (a `formatDate()` pattern) |
| `daterange.span.month` | `%e %B` (a `formatDate()` pattern) |

- `normalizeCalendarEvents()` takes the title of an unnamed event as the option `untitledTitle`, and
  Calendar's three call sites, including the one in `updateEvent()`, pass it. The location stays
  a comma-joined suffix on `calendar.eventLabel`.
- `spanLabel()` reads the three patterns. They join `DATE_PATTERNS` in `tests/unit/locale-de.test.js`.
- The picker's day label and start status had the same bug, and so did `answeredTimeFormat()` in
  `src/components/approval-card/approval-card.js`. Both read patterns from the catalogue too.
- **Dates that ignored the language.** Calendar, ActivityItem, AgentThread and Surface handed `Intl` an
  unset locale, so the browser's language wrote `Tue` and `07:00 AM` under `de`. No catalogue can reach
  that. New `src/internal/date-locale.js` resolves the option, then the active language. An English
  tag, or one `Intl` cannot use, stays unset, as `formatDate()` treats them, so English output and a
  browser's own English variant do not change.
- **`renderBlocks()`** fell back to a private English table when called without `msg`, as ApprovalCard
  and Surface call it, so the translator never answered. It now falls back to `translate()`.

## §4 · The check

**Scope:** `tools/check-language.js`, `tests/unit/messages.test.js`, `tests/smoke/smoke.js`,
`docs/llms.md`, `docs/api.json`, `docs/agent-catalog.*` if the generator rewrites it.

- Each finished page joins `PAGES`, with a fixture where the demos leave options out and `expect`
  naming German that must appear, so a step that opens nothing fails. `npm run test:browser` runs
  them all, so the suite keeps the gap closed.
- `messages.test.js` stops being the place a new literal hides: the source-literal test from WP-62
  covers the components in this WP, and the operators, status words and Kanban keys get the same
  entry-against-English check that `DEFAULT_STATUSES` has, since the scan cannot read their keys out
  of code that builds them.
- Smoke cases prove what needs a real DOM: `tree.empty` and `finder.empty` still beat `emptyText`, and
  `null` or `''` still hide SourceList's heading while an unset `label` draws it.
- `docs/llms.md` says that `filterOperators[].label` is English data and that Filter shows
  `filter.op.<id>`, and describes defaults that are now messages.

## Out of scope

- `src/zeyos/*`, which stays unchanged. The user decided that the ZeyOS module names stay out of the
  catalogue: a host already passes its own `label` through `registerModules()`, which can override a
  shipped entry.
- Keyboard key names in `src/components/kbd/kbd.js` (`Ctrl`, `Space`, `Home`). They are not catalogue
  text today, and German keycaps are a design question of their own.
- Developer-facing errors: `TypeError` and `RangeError` messages, the Questionnaire condition parser's
  `message` fields (they name schema keys), `XMLHttpRequest is not available`, and the `AbortError`
  FieldUpload makes for itself, which nothing shows.
- A `Datebox` `msg` option reaching its DatePicker. A `locale` option on the date components.
- NumberField's digit grouping, which uses the browser's locale when `locale` is unset. It is number
  formatting rather than English text.
- `fileTypeLabel()` in `src/index.js`: it stays where it is, not newly exported.
- Translating documentation, demos or layout content.

## printf

`printf()` once ran its `%name%` pass over text it had already filled, so a value holding `%word%` was
rewritten: `Remove %1` with `50%off%sale.pdf` gave `Remove 5050%off%sale.pdfsale.pdf`. It now fills
every placeholder in one pass, in `src/core/i18n.js`, because the keys this WP converted from template
literals would otherwise have changed English for such a value, against Decision 1.

## Acceptance criteria

1. Every new key sits in `src/core/messages.js` and `src/locales/de.js` in the same order.
2. `npm test`, `npm run test:browser` with a free `SMOKE_PORT`, `npm run check:size`,
   `npm run build:site` followed by `node tools/check-site.js`, and `git diff --check` pass.
3. `node tools/visual-diff.js --base wp/62-catalogue-gaps` shows no change in English.
4. With the catalogue installed, `tools/check-language.js` finds no library English on any page in
   `PAGES`, and it fails when one of the new keys is removed from `de` (checked by temporarily
   breaking one entry, then restoring it).
5. A host-supplied operator keeps its label under `de`, and `operators: filterOperators` does not
   bring English back. Tests prove both.
6. Changelog lines are reported.
