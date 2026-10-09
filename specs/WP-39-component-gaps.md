# WP39 — What the application templates asked of Xenon (proposal)

Nine application templates (WP37: mail, issue tracker, knowledge base, AI chat, invoice editor,
item & inventory, workflows, infrastructure, CRM) were built from Zx components only. Wherever a
template needed something Zx could not do decently, it did the local thing and recorded the gap.
This document consolidates those records into one ranked proposal. It is a proposal: each section
below becomes its own work package with a file scope once it is accepted.

The count after each item is how many templates hit it independently. Items already resolved by
WP38 (density modes and nested density scopes) are left out. WP40 (visual refinement) resolved A1,
the tint from the name in B13, StatTile `caption` and equal heights in B14, a categorical Badge
`tone`, Table `variant: 'plain'`, the `--zx-text-3xl` title size from C3, and the outline icon set;
those are marked ✓, as is every defect WP41 fixed (all of section A and the defect table of section
D — `specs/WP-41-defects.md`). Section D adds what the WP40 polish of the templates and the rebuild of the
eight screen patterns on the shared shell asked for.

Every workaround mentioned here lives in `website/layouts/` today — mostly in `kit.js` / `kit.css`,
which double as prototypes for several proposals (`sectionLabel` → AppSidebar sections, `.segmented`
→ SegmentedControl, `navSearch` → `Launcher.trigger()`, `propList` → PropertyList, `.bulk-bar` →
RecordView selection bar, `toaster` → scoped Message regions, `kbd` → a `kbd()` primitive,
`listTime`/`DATE` → formatters). When a proposal lands, the template's workaround is deleted.

---

## A · Defects (fix first; each is small)

| # | Component | Defect | Fix | Seen in |
|---|---|---|---|---|
| A1 ✓ | AccountMenu | `menu-button.css` loads after `account-menu.css`; `.zx-menu-button` forces `inline-flex` + centre and `.zx-btn` adds the glass shadow, so the trigger renders as a centred, boxed card. | Raise specificity (`.zx-account-menu .zx-account-menu__trigger`) and reset `box-shadow`/backdrop. | all 9 |
| A2 ✓ | Form / Fieldset / Field | Field keys become DOM ids and radio `name`s, so a field `stage` collides with any `#stage`, and a form mounted twice duplicates ids. | Generate ids by default; the key stays the field's `name`; optional `idPrefix`. | 2 |
| A3 ✓ | CodeEditor | The documented "Escape, then Tab leaves the editor" is not implemented — a keyboard trap. | Escape releases Tab capture until the next keystroke in the editor. | 1 (a11y) |
| A4 ✓ | MenuButton | After choosing an item the panel closes and focus falls to `<body>`. | Return focus to the trigger unless `onselect` moved it; `open({ returnFocus })`. | 2 (a11y) |
| A5 ✓ | Table / Grid editors | Number and date cell editors don't select their content on entry: typing "6" into "1.00" gives 1.006. | Select on focus, as text editors already do. | 1 (data entry) |
| A6 ✓ | Message | The floating region is cached per scope without an `isConnected` check (toasts go to a detached node once a host is emptied) and is never removed. | Recreate when disconnected; remove the region when its last toast closes; `Message.disposeRegion(scope)`. | 6 |
| A7 ✓ | AppSidebar | `collapsible: false` still shows the minimise button (`.zx-icon-btn` display beats `[hidden]`); `getItems()` returns `children: []` on every item. | `[hidden]` rule; omit empty `children`. | 3 |
| A8 ✓ | Overlays | Dropdown / Tooltip / MenuButton / Modal subclasses created before their anchor is connected attach to `<body>` instead of their scope. | Resolve the overlay host on first open, not at construction. | gallery |
| A9 ✓ | NumberField, Datebox, DateRangeBox | Don't fill a Field's control column (inline-block with min widths), overflow two-column rows, reserve clear-button padding when not clearable. | Fill the control column inside `.zx-field__control`; pad for clear only when `clearable`. | 5 |
| A10 ✓ | copyButton | Its hidden status line is absolutely positioned without a positioned parent, creating scrollable overflow that `focus()` scrolls into view. | `.zx-copy-button { position: relative }`. | 1 |
| A11 ✓ | TableView, Table, KanbanView, Filter | The Columns / Fields chooser, Kanban's undo and redo, and Filter's actions used `zx-button zx-button--sm`, which no stylesheet defines. | Fixed in WP40: rendered as `.zx-btn` with `data-size="sm"` (ghost in toolbars, primary for Apply). | 1 |
| A12 ✓ | FileItem | Shows the raw MIME type ("application/pdf") as visible text. | A readable type label (PDF, CSV) or `typeLabel`; icon from the MIME type. | 3 |
| A13 ✓ | Select.entity | Without a colour the glyph is white on the pale accent tint (invisible); `colorKey` rejects `var()`. | ✓ A neutral tile with muted ink by default (WP40); token references accepted (WP41). | 1 |
| A14 ✓ | Smaller | Slider end-mark labels spill outside the box; Toggle labels centre-wrap; sortable and non-sortable Table headers use different fonts; Table reserves a scrollbar gutter on short tables; neutral soft Badge vanishes on raised dark surfaces; TreeView type-ahead doesn't `preventDefault`; a disabled DateRangeBox still shows its clear button; `Dialog.confirm`'s `okLabel` is undocumented and `Dialog.prompt` has none. | Individually trivial. | 1–2 each |

## B · Extensions to existing components

Ranked by how many templates needed them.

1. **AppSidebar — embedded mode and sections (9).** `variant: 'embedded'` (no own chrome, fills its
   column, no empty header); `{ type: 'section', label, actions }` items that render a plain
   heading in the expanded state and group flyouts in the rail, so one instance (one `<nav>`
   landmark, one active item) serves a whole navigation column; `setBadge(id, value)`; item
   `shortcut` hints; an item status adornment; an `after` slot that scrolls with the items (chat
   history, page tree); `expandActive`.
2. **MenuButton (7).** `ariaLabel` + `hideLabel` for icon-only triggers (no empty label span);
   `caret: true`; submenus via item `children` with the APG submenu keys; shared with ContextMenu.
3. **Message (6).** `action: { label, onclick, shortcut }` (Undo) that pauses the timeout while the
   toast has hover or focus (WCAG 2.2.1) and returns a handle with `close()`; `placement` /
   `offset` so a region never covers a header's primary action; the scope taken from the
   triggering element.
4. **Tabbox (5).** `fill: true` (tabs fixed, active panel scrolls); `panels: false` for a tab strip
   that filters one shared list; a `tablistActions` slot ("+ view"); badge `tone: 'muted'|'accent'`; `fit: 'stretch'` and
   `size: 'sm'` so four tabs with counts fit a 360px list column.
5. **Table / TableView (5).** `height: 'fill'`; column `icon` and `renderHeader()`; column
   `truncate`; a `meter` column type (segments, markers, `role="meter"` text); `rowActions` revealed
   on hover/focus with Delete and ContextMenu hooks; runtime `setEditMode()` / `setReadOnly()` /
   `setRowReorder()`; editor sizing (`editorMinWidth`, NumberField `controls: false`); a custom
   editor API that can stage (`api.set`) and focus (`api.focus`); `refresh()`; `datachange` with a
   reason.
6. **Form / Fieldset / Field (4).** Dirty tracking — `isDirty()`, `getChanges()`,
   `markPristine()`, `dirtychange`, per-keystroke `input`; Fieldset `variant: 'plain'|'section'`
   (no box inside a dialog or tab); Field `span`; `minColumnWidth` instead of the fixed collapse
   width; `Field.wrap(label, component, { read, write })`, a `daterange` type, `setDescription()`;
   a Dialog `form` option whose primary button submits.
7. **Grid.BillingItems (1, but it is the heart of invoicing).** Canonical `taxRate` and `discount`
   fields with `taxRates` and a discount mode; `extraColumns` / `hiddenColumns`; exported field
   map accepting partial overrides; `Grid.billingTotals(rows, { rounding: 'per-rate'|'per-line' })`
   → `{ list, discount, net, rates[], total }`; a summary/footer slot.
8. **Chart (2).** Series `tone: 'accent'|'success'|…` resolved by the adapter; token defaults for
   grid, ticks, fonts and tooltips; redraw on theme change; `motion: 'auto'` honouring reduced
   motion; `minHeight`; a doughnut centre label. (`kit.js` `chartPalette()` is the prototype.)
9. **KanbanView (2).** `columnSummary: { field, reduce, format }` announced with the count;
   `card.label: false` and skipping empty values; `focusRecord(id)` and `data-record-id`;
   `columnWidth`; no scrollbar gutter unless `columnHeight` is set.
10. **TreeView (1, high for any content tree).** `renderActions(node)` revealed on hover/focus
    (Shift+F10 opens a menu); `updateNode(id, patch)`; inline rename; drag and drop with a
    cancelable `move { id, parent, index }` and Alt+arrow keys; focus kept across `setItems` and
    `reveal`; `isExpanded()` / `getExpanded()`.
11. **CodeEditor (1).** `getSelection` / `setSelection` / `replaceSelection` (native undo intact) /
    `wrapSelection` / `prefixLines` / `insertBlock`; `height: 'fill'`; `scrollToLine` and a
    `scroll` event; a `keymap`.
12. **Select, TagPicker, Datebox (3).** `Select.people()` (or `avatarKey` on `Select.entity`);
    TagPicker `toneKey` with the semantic tones and a `compact` mode; Datebox `%b`/`%B` parsing;
    `Select.priority()` with "No priority".
13. **Avatar (3).** An `avatar()` factory for render callbacks (no instance per cell to destroy);
    `tone` / ✓ automatic tint from the name for logos.
14. **Smaller (1–3 each).** StatTile ✓ `caption`, `unit`, wrapping labels, ✓ equal heights with and
    without a sparkline · Stepper compact spacing, `skipped`/`waiting` states, per-step meta ·
    InlineLoading `dirty` status, neutral outcome text, `successDuration` · `Tooltip.delegate(root,
    { selector, content })` · Search `block: true` (no 12rem minimum) · ListToolbar tool
    `popover`/`menu` and an active-filter slot · ActivityList compact entries and a comment
    composer · Badge `dotTone` · Launcher item `shortcut`, search over `description`, and
    `launcher.trigger({ label })` · DataFilter toolbar variant · SplitView `collapseBelow` ·
    `Dialog.confirm/alert/prompt` accepting `scope` and `signal`.

## C · New components

Ranked by reach.

1. **ListView** (mail, tracker, chat history, CRM, wiki favourites). A record view of dense rows
   with leading / title / meta / snippet slots; single or multi selection (Space / X), roving focus
   with J/K and arrows, Enter → `recordactivate`; `rowActions` revealed on hover/focus; grouping
   (`groupBy`, `groupOrder`, sticky and collapsible group headers with counts and a per-group
   add); shares state (sort, filter, selection) with TableView, CardView and KanbanView. APG grid
   pattern when rows carry actions, listbox otherwise. Prototype: `.list-row`, `.list-group`.
2. **SegmentedControl** (tracker, infrastructure, mail, CRM). An exclusive choice drawn as one
   segmented control: `items: [{ id, label, count?, icon? }]`, `value`, `change`, radio-group
   semantics and keys, visuals shared with the segmented Tabbox. Prototype: `.segmented`.
3. **Prose** (wiki, chat, mail). `renderMarkdown(source, { mention, resolveLink, onTaskToggle })`
   → `{ fragment, headings }` built only through `h()`; `.zx-prose` (measure, rhythm, heading
   scale, inline code, code blocks with copy, tables, task lists); `callout({ tone, title, icon,
   content })` with `role="note"`; streaming support (`slice(blocks, n)`). Tokens to go with it:
   `--zx-text-3xl`, `--zx-text-4xl`, `--zx-leading-prose`, `--zx-measure`.
4. **Composer** (chat, mail, wiki comments). An auto-growing text area (`Textarea({ autoGrow,
   maxRows })`) with attachment chips, action slots, `submitKey: 'enter'|'mod+enter'`, a `busy`
   state that swaps Send for Stop, and `submit` / `stop` / `attach` events; plus `suggest(textarea,
   { trigger: '/', items })` for slash commands and mentions (combobox with
   `aria-activedescendant`).
5. **Meter** (infrastructure, inventory). Native `<meter>` semantics — `value`, `min`, `max`,
   `low`, `high`, `optimum`, `valueText` — with tone from the thresholds; usable as a Table column.
6. **ChatThread** (chat). Messages as labelled articles, `append` / `update` / `stream` / `stop`,
   stick-to-bottom with a "Jump to latest" control and a `stickchange` event, completion announced
   politely.
7. **FlowView** (workflows). A vertical flow of step cards with branches and insertion points:
   `steps`, `renderStep`, `insertItems`, `maxBranchDepth`; cancelable `select` / `insert` / `move`
   / `delete`; one roving tab stop over cards and insertion points, ↑/↓ in reading order, ←/→
   between lanes, Alt+↑/↓ to move with a live announcement.
8. **Outline** (wiki). A table of contents that follows a scroll container: `{ target, headings,
   offset }`, `aria-current="location"`, reduced-motion jumps, last-heading handling.
9. **PageView** (invoice). A paper surface with `size: 'A4'|'letter'`, `zoom: 'fit-width'|
   'fit-page'|number`, a zoom toolbar, and paper tokens (`--zx-color-paper`,
   `--zx-color-on-paper`) so a dark theme needs no light island.
10. **UnitView** (infrastructure; generalises to shelves and bins). Positioned items in numbered
    units — `units`, `items: [{ position, height, tone, label }]`, `current`, numbering direction,
    a tooltip renderer, `select`.
11. **Small factories.** `splitButton({ label, onclick, items })` · `toggleButton({ icon,
    pressedIcon, label })` · `chip({ icon, label, meta, onremove })` shared with TagPicker ·
    `kbd(...keys)` used by `button({ shortcut })`, menu items and Launcher items ·
    `statusIcon()` / `priorityIcon()` (the Select presets' glyphs, public) · `BarList` · a
    `.zx-visually-hidden` utility.

## D · Found while polishing (WP40) and rebuilding the screen patterns

Defects — fold into WP-A:

| # | Component | Defect | Fix |
|---|---|---|---|
| D1 ✓ | Table | A sortable end-aligned header put its label at the start, away from its figures. | Fixed in WP40: the label sits at the end with the arrow before it. The dashboard and record-page patterns can make their figure columns sortable again. |
| D2 ✓ | ZeyOS binding | `zeyosTable` / `zeyosForm` show enums raw ("INVOICED") and a date field as a date-time whose hour moves with daylight saving; `zeyosTable` cannot pass Table options (`variant`, `zebra`); `zeyosForm.save()` raises a toast outside the caller's scope. | Labels for enums, date-only formatting for date fields, Table options passed through, a `scope` / `notify` option. High: every ZeyOS list shows it. |
| D3 ✓ | Checklist | Inside a Field it repeats its own heading under the field's label. | No heading when a Field labels it. |
| D4 ✓ | `Select.priority()` | Five squares from green to red; WP40 keeps colour for the one level that needs attention. | Grey bars by level, colour only for urgent; "No priority". |
| D5 ✓ | TagPicker | `colorKey` rejects `var()` and there is no `tone` option (Badge has one); read-only, it keeps its empty input and chevron, so chips wrap onto a blank row. | `toneKey` over the categorical tones; nothing but chips when read-only. |
| D6 ✓ | NumberField | As a quiet field the value stays right-aligned behind the hidden stepper and floats mid-field. | Start-align quiet values; the stepper appears on hover or focus. |
| D7 ✓ | KanbanView | Assignee avatars are plain initials, not the tinted Avatar. | Use Avatar's tone from the name. |
| D8 ✓ | Select.entity | Clicking its read-only input shows the keyboard focus ring (a text input always matches `:focus-visible`). | Ring only after keyboard focus. |
| D9 ✓ | ActivityItem | Actor and title were adjacent spans in a flex heading, so the heading's text read "Jonas Weberset…". | Fixed in WP40: a text space between them. |
| D10 ✓ | ActivityList | No compact variant: in a card narrower than 30rem the time stacks under the title. | `variant: 'compact'` — one line, time at the end. |
| D11 ✓ | Badge | `size: 'sm'` with `dot` is cramped (2px gap, 11px text). | Gap and text size for the small dotted badge. |
| D12 ✓ | Table | Header cells carry no `data-column` and body cells only in edit mode, so a read-only grid cannot be styled per column; an empty-label column renders an empty header with no accessible name. (Number editors not selecting their content is A5; a custom editor that reports a live value is B5.) | `data-column` on every header and body cell; an accessible name for unlabelled columns. |
| D13 ✓ | Select | Disabled on its own, its text stays full strength, while a disabled Field fades. | One disabled treatment. |
| D14 ✓ | Field `type: 'html'` | Draws an input frame around read-only content, so it reads as a field that cannot be edited. | No frame for display content. |

Extensions — fold into WP-B to WP-D:

- **Select** — a `quiet` trigger for pickers in a header row (the knowledge base's space switcher
  needed five overrides); an adornment slot that holds its place when there is no value, so empty
  property rows line up with filled ones.
- **StatTile** — a colour for the value by meaning (`valueKind`, or a `--zx-stat-tile-value-color`
  hook); today `kind` tints only the sparkline, so a tile without one cannot show that it needs
  attention.
- **Button** — show `shortcut` in the tooltip only (`shortcutDisplay: 'tooltip'`); two templates
  built a local helper for it. An icon button `size: 'xs'` (20px) for insertion points.
  CheckButton `kind: 'ghost'`.
- **Datebox** — a `label` option and an adornment slot.
- **ListToolbar** — `size: 'sm'`, so its tools fit a pane header (44px tools, 46px header); an
  icon-only view switch; sizing to its content beside other elements (its `container-type`
  needs an explicit flex basis today).
- **Tabbox** — a tab row that can stand without its panels as a header's title row (see B4
  `panels: false`).
- **ContextMenu** — `openFrom(trigger)`, positioned from a button and flipping near the edge.
- **Form** — `variant: 'sections'`: fieldsets as titled sections of one sheet, set off by
  hairlines. The kit's `.form-sections` is the prototype; five layouts use it.
- **Chart** — a `height` option (a 220px chart relies on Chart.js's minimum today); the kit's
  `chartScales()` merging extra tick options and an alpha option on `chartPalette()` until B8
  lands.
- **Kit** — a card header row (title, meta, trailing actions such as "View all") beside
  `.surface__title` / `.surface__meta`.
- **Type and colour tokens** — a title step between `--zx-text-xl` (18px) and `--zx-text-2xl`
  (24px) for record and page titles; a filled-field surface role (muted on light, the page tone
  on dark) for composers; a soft shadow for paper and lifted cards below `--zx-overlay-shadow`.
  In the dark theme `--zx-color-bg-muted` equals `--zx-color-bg-raised`, so "cards on a grey tray"
  cannot be built from those two; the board uses chrome and raised.
- **Narrow screens (WP42)** — Table's stacked mode drops the header row, so a phone has no sort and
  no select-all; `Grid.BillingItems` defaults to `responsive: 'sm'`, whose stacked cards suit cell
  editing poorly (the invoice editor turns it off); Stepper cannot switch orientation at runtime.
- **Target sizes (WP42 audit warnings)** — Table row checkboxes (16px) and sort buttons (20px tall),
  the Columns/Fields toggle (13px), Rating stars (14–18px), TagPicker remove buttons (20px), the
  Kanban move handle, and Slider's range input (16px tall) fall under 24 × 24px; most pass on
  spacing, but a 24px hit area would remove the doubt.
- **Loading states (WP43)** — KanbanView has no loading state (`setLoading` is ignored; the
  system-states pattern builds a column skeleton from the Skeleton factories); CardView's loading
  skeleton draws a preview square even when its cards have none, so they grow when they load.
- **Kit `adaptiveShell()`** — a show-on-phone-only counterpart to `data-narrow`; narrow rules keyed
  to a pane's width rather than the shell's; a layout with a list column shows two navigation
  toggles between 641 and 860px unless it hides the main pane's (two layouts do).
- **Kit `propList()`** — line up a plain-text value with the text inside quiet fields when a list
  mixes the two (the CRM template pads it locally).

## E · Suggested sequencing

1. **WP-A, defects** — all of section A and the defects in section D (one release).
2. **WP-B, shell** — AppSidebar sections and embedded mode, MenuButton, Message, Tabbox,
   SegmentedControl. After it, every template's navigation column and header lose their local CSS.
3. **WP-C, record views** — ListView, Table/TableView extensions, KanbanView, Meter, Form dirty
   tracking, Grid billing totals.
4. **WP-D, content and editing** — Prose, Composer, Outline, CodeEditor and TreeView extensions,
   ChatThread.
5. **WP-E, domain views** — FlowView, PageView, UnitView, Chart theming.

Each WP removes the matching workaround from the templates and the kit, and the templates'
screenshots (`tools/shoot-layout.js`) are the acceptance check.
