# Library consistency audit — October 2026

A read-only review of the whole Zx component library against the contract in `AGENTS.md`,
looking for redundancies (two things doing one job) and inconsistencies (one concept spelled
several ways). Three reviewers covered the library in parallel, each with file-and-line
evidence; findings marked **[verified]** were reproduced in headless Chrome, not only read.

| Area | Report | Scope |
| --- | --- | --- |
| Core, inputs, identity, forms | [core-inputs-forms.md](core-inputs-forms.md) | `src/core`, `src/internal`, 30 input and form components |
| Data, views, filters, ZeyOS bindings | [data-views-filters.md](data-views-filters.md) | Table, the record views, the three filter components, lists, `src/zeyos` |
| Layout, navigation, overlays, tokens | [layout-navigation-overlays.md](layout-navigation-overlays.md) | overlays, navigation, sections, `styles/`, the layout kit as a consumer |

Nothing in this folder is published: `specs/` is neither a site source nor in the package
allowlist. Working-tree line numbers were taken on branch `feat/record-collection-layout` on
2026-10-28 and will drift.

## Defects to fix first

These are bugs, not style. All are non-breaking to fix.

| # | Defect | Where | Status |
| --- | --- | --- | --- |
| 1 | **[verified]** Menus, dropdowns, context menus, rail flyouts and toasts are inert while a modal Dialog or Sheet is open: `overlayHost()` parks their panels outside the open `<dialog>`. | `core/overlay-host.js`, every anchored overlay | high |
| 2 | **[verified]** A non-modal Sheet closes itself when an item is chosen in a menu opened inside it; Escape closes the sheet and strands its open dropdown. No overlay stack exists. | `sheet.js`, `dropdown.js`, `menu-button.js` | high |
| 3 | **[verified]** Raw message keys reach the screen without a translator: `table.empty`, `dataFilter.clear`, `dataFilter.all`. The library ships no default English catalogue; each component carries its own `_message()` fallback helper (15 copies, 4 signatures) or none. | `table.js`, `card-view.js`, `data-filter.js` | high |
| 4 | **[verified]** Table rows are never focusable: `rowclick`, `recordclick` and single selection are mouse-only; `hierarchy` sets `role="treegrid"` without its keyboard model. | `table.js` | high |
| 5 | **[verified]** Geometry tokens (`--zx-control-height` and friends) are declared inside the light-theme block, so a nested light region resets an application's override while a dark one keeps it. | `styles/tokens/*.css` | high |
| 6 | Keyboard focus is invisible in forced-colors mode: `base.css` keeps a transparent outline on purpose, then 22+ component rules set `outline: 0` and rely on a box-shadow that forced colors removes. | `styles/base.css`, overlays and navigation CSS | high |
| 7 | `AccountMenu.toggle()` throws: it calls `MenuButton.toggle()`, which does not exist. | `account-menu.js:109` | medium |
| 8 | `Fieldset.addField(id, component)` only understands `getValue/setValue/setDisabled`, so NumberField, Select, Slider, Rating, Datebox and Timebox read back `null` and are never disabled. | `fieldset.js:275-330` | medium |
| 9 | `Field` emits `change` twice for `slider` and `code` types; `code` also emits on every keystroke. | `field.js:178`, adapters | medium |
| 10 | **[verified]** `KanbanView` ignores `fieldControls.target`; `ListToolbar.bind(tableView)` mounts no field chooser although its demo says so, and reads a private field. | `kanban-view.js`, `list-toolbar.js` | medium |
| 11 | **[verified]** Focus drops to `<body>` after moving a field in the RecordView chooser and after every `FileList.updateItem` (each upload progress tick). | `record-view.js`, `file-list.js` | medium |
| 12 | **[verified]** Filter's `withinLast` / `withinNext` operators render two date pickers; neither can be filled in. | `filter.js` | medium |
| 13 | **[verified]** Toolbar's roving tabindex steals ArrowLeft/Right/Home/End from text inputs inside it; a generic Dropdown panel cannot be reached with Tab. | `core/keyboard.js`, `dropdown.js` | medium |
| 14 | `Pagination`'s JSDoc claims it matches `zeyosTable()`; the bindings are zero-based with 50 per page and append, the pager one-based with 25 and replace. `zeyosTable` has no guard against a load resolving after `destroy()`. | `pagination.js`, `zeyos/table.js`, `zeyos/view.js` | medium |
| 15 | ZeyOS filter date serialisation ignores the instance `timeZone` that forms and tables honour. | `filter-panel.js`, `zeyos/query.js` | medium |
| 16 | A tier-1 token (`--zx-shadow-1`) in `kanban-view.css:191` passes the lint, which also skips `icons.css`, `--zx-accent-*`, `oklch()` and JS-set properties. | `tests/lint-tokens.js` | low |

## Cross-cutting themes

The same handful of root causes recur in all three reports.

### 1. Core helpers were copied instead of shared

- **Target snapshot/restore**: `core/dom.js` exports `snapshotTarget/restoreTarget`; eight files
  carry their own copy and four more do it inline. Three components also re-implement the base
  class's private destroyed guard.
- **Messages**: fifteen private `_message()` helpers, four signatures, plus a module-level
  `text()` in the date-range components that ignores the per-instance `msg` option. Five
  components hard-code English; Calendar uses un-namespaced keys (`next`, `today`).
- **Overlay ordering and dismissal**: `nextOverlayOrder()` exists three times (a source comment in
  `sheet.js` admits it); Escape and outside-click handling is written six times; every Tooltip
  adds five permanent document listeners.
- **Small helpers**: `safeRel` ×3 (security-relevant), `sameValue` ×3, `normalizeHeadingLevel`
  ×5, two sort comparators with different collation, four text matchers, four grouping
  implementations, three progress bars, the tone list ×3, the month grid ×3, `appendSlot/
  replaceContent` ×9, the visually-hidden CSS recipe ×50 in 36 files, identical MenuButton and
  ContextMenu CSS (~125 lines each).

**Recommendation.** One core pass that adds `Component#t()` (message with fallback, backed by a
default English catalogue), `core/overlay-stack.js`, mandatory `snapshotTarget`, `toNode/
setContent`, `FOCUSABLE_SELECTOR`, a `tones` module, date helpers in `core/date.js`, and a
`.zx-visually-hidden` class; then delete the copies. Non-breaking; needs a spec that authorises
`src/core/**` edits.

### 2. Near-duplicate components

| Overlap | Reports say |
| --- | --- |
| CheckButton / Toggle | about 90% the same code; extract a shared binary-button base |
| AccountMenu / WorkspaceSwitcher | same trigger, lifecycle and ~60 lines of CSS; extract `internal/menu-trigger` |
| Select / TagPicker | parallel combobox engines; extract `internal/listbox-popup` |
| ValueList / MultiValueEditor / TagPicker (`allowCreate`) | three ways to edit a list of strings |
| DataFilter / FilterPanel / Filter (+ per-layout chip evaluators) | four type vocabularies, three option shapes, three meanings of "select", four date serialisations; the Filter AST has no client evaluator and no ZeyOS compiler |
| Table / TableView | two copies of sort, selection and column state, reconciled through a re-entrancy guard; two field choosers chosen by how `fieldControls` is spelled, now a third in `ViewSettings` |
| record-card / kanban-card | card anatomy twice; Kanban's indicator, progress and avatar slots are missing from CardView |
| MenuButton / ContextMenu | duplicated controller and CSS |
| AppRail / ModuleBar / AppSidebar / NavigationBar | four navigation primitives, three keyboard models, two typeahead timings (500 vs 600 ms) |
| Tabbox / NavigationBar tab mode / Dock pane tabs | three tab implementations, one undocumented |
| Groupbox / Panel | Groupbox is a subset of Panel |
| Toolbar / ListToolbar | ListToolbar reuses nothing from Toolbar |
| Loading / Skeleton, Message / kit toasts | overlapping feedback primitives |

**Recommendation.** Keep every public class (aliases are cheap) but build each pair on one
internal: a filter *model* in core with Filter, FilterPanel and a new FilterChips as its
presentations, one `FieldChooser` used by Table, RecordView, ListToolbar and ViewSettings, one
menu controller, one record-state module under Table and TableView, one roving-tabindex contract
for navigation. Deprecate DataFilter, Groupbox and NavigationBar's tab mode after an alias period.

### 3. One concept, many spellings

- **Value access**: `get/set`, `getValue/setValue`, `getValues/setValues`, `.value`; Select has
  `set()` but no `get()`. **Disable**: `enable/disable`, `setDisabled(bool)`, none; both
  `setReadonly` and `setReadOnly` exist.
- **`change` payload**: nine shapes (`{value}`, `{values}`, `{values,items}`, `{value,item}`,
  `{checked}`, `{checked,value}`, `{date}`, `{time}`, `{start,end}`); Field's adapters exist only
  to map them back to `{value}`.
- **Event names**: `select` means three things; `input` is debounced in Search and immediate
  elsewhere; `invalid` has four payloads; `cancel` fires only for Escape; Tooltip says `show/hide`
  where every other overlay says `open/close`. Only WorkspaceSwitcher honours `preventDefault()`
  on the bubbling DOM event; Launcher, AccountMenu, Select, Form, Questionnaire, Calendar and
  AppRail ignore it.
- **Dismissal options**: `closable` means four different things across Modal, Dialog, Sheet and
  Message; `delay/hideDelay` vs `openDelay/closeDelay`; `snap` and `size` each carry two meanings;
  seven action-descriptor shapes; Dialog silently drops Modal's `width`.
- **Descriptors**: `render(row, i)` vs `render(record, i, value)`; `options` vs `choices`;
  `format` with three meanings; `rowId` / `recordId` / `valueKey` / `eventId`; item identity as
  `name/title`, `name/label`, `id/label`. Same-named methods differ between siblings: Kanban's
  `toggleColumn/setColumns` act on lanes, Table's on fields; TreeView's `selection` is the mode,
  the record views' the initial ids.
- **Accessible names**: `label` is visible text in some components and the screen-reader name in
  others; Toggle, Search, TagPicker, Datebox, Timebox and Checklist offer no way to set one.
- **Disabled styling**: four root conventions and three opacities.

**Recommendation.** Publish one vocabulary (`get()/set(v, {silent})` plus `value`, `detail.value`
guaranteed, `enable/disable/isDisabled`, `open/close/toggle/isOpen` on every popup, one meaning
each for `closable`, `closeButton`, `lightDismiss`, `cancel {reason}` cancelable everywhere,
`label` = accessible name on every control) and add it as aliases first, removing the old
spellings one major version later.

### 4. Accessibility gaps that follow from the above

Mouse-only Table, forced-colors focus loss, focus dropped to `<body>` on re-render in three
components, ValueList giving every chip a tab stop while claiming the listbox pattern, CodeEditor
announcing the caret on every keystroke, Checklist always named "Checklist", confirm dialogs
never `role="alertdialog"`, bare Modal with no accessible-name option, Tooltip's bubble vanishing
on hover despite the WCAG 1.4.13 claim in its docs, 24–26 px controls in Table and RecordView next
to the 44 px policy in ListToolbar.

### 5. Tokens, lint and the kit

Exact duplicate light-theme tokens; `--zx-header-*`, `--zx-ease-spring`, `--zx-color-accent-active`
and `--zx-master-panel-accent` unused; the ZeyOS module palette imported unconditionally into an
agnostic system; twelve component-level `prefers-reduced-transparency` blocks repeating the token
layer. The layout kit shows four primitives the library lacks, each rebuilt by hand across the
layouts: an icon-button factory (21 layouts), a header part (46 calls), a shortcut binder, and a
container-scoped drawer (the kit rebuilds Sheet's scrim, inert and focus return).

### 6. Documentation drift

`AGENTS.md` still describes the `mount(container)` demo format while 79 of 83 demos use
`examples`; the Field widget list omits `slider`, `daterange`, `code` and `custom`; Rating's
arrow-key direction is wrong; NavigationBar's tab mode is undocumented; Message's `maxVisible` is
documented per message but is a constructor option; the checkout-wizard example builds its Undo
toast by hand instead of using Message's `action`.

## Suggested programme

Each step is a work package of its own; the order keeps every step shippable without breaking
consumers.

1. **Defects** — items 1–16 above. Mostly one-file fixes; the overlay-host and overlay-stack
   items are the two with design in them.
2. **Core hygiene** — the shared helpers in theme 1, under a spec that opens `src/core/**`.
   Then delete every local copy. Pure refactor, no API change.
3. **Vocabulary** — the aliases in theme 3, with the docs and demos updated to the canonical
   spellings and the old ones marked deprecated.
4. **Internals** — the shared bases in theme 2 (menu controller, listbox popup, menu trigger,
   binary button, field chooser, record state, filter model). Public classes keep their names.
5. **Consolidation** — fold Groupbox into Panel, DataFilter into the filter model, NavigationBar's
   tab mode into Tabbox; add the four kit primitives to the library; make `modules.css` opt-in.
6. **Removals** — one major version later: deprecated spellings, duplicate tokens, the retired
   classes.

Each detailed report ends with its own prioritised top ten, with severity, migration cost and the
exact files to touch.

## Component gaps the record collection layout works around

Building the record collection pattern (`website/layouts/record-collection.layout.js`) needed
these workarounds in the layout. Each is a component fix waiting to happen; the layout's comments
name them too.

| Workaround in the layout | Component fix |
| --- | --- |
| Escape is stopped at the drawer content so a picker's own Escape does not close the Sheet | `Sheet` (non-modal) should ignore an Escape that is already `defaultPrevented` |
| `role="none"` on the Sheet's `<header>` | `Dialog`/`Sheet` should not render a banner landmark in non-modal mode |
| Search landmarks named by hand | `Search` needs a `label` option for its landmark; `ListToolbar` should pass one through |
| Hidden lane names in board column headers | `KanbanView` should include the swim-lane name in a column's accessible name when lanes repeat columns |
| CSS hides the Filter editor's own Clear button and root frame | `Filter` should offer options to omit its Clear action and its frame |
| Toolbar tools carry `aria-expanded`/`aria-controls` set from outside | `ListToolbar` tools need a disclosure mode (`expanded`, `controls`) |
| `ViewSettings` keeps a `locked` flag the view does not know | `RecordView`/`ViewField` should carry `locked`, so the view and the panel agree |
| The layout evaluates the filter AST itself | the filter model needs a client-side evaluator in core (see theme 2) |
