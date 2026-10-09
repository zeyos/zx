# WP41 — Component defects found by the application templates

`specs/WP-39-component-gaps.md` collects what the nine application templates and the eight screen
patterns needed from Xenon. This WP fixes its defects: every open row of section A and the defect
table of section D. Extensions (WP-39 section B), new components (section C), and the extension list
in section D are out of scope.

Work in the current checkout. **Do not commit.** The five groups below run in parallel with disjoint
file scopes. `AGENTS.md` applies. Each group may also touch the unit tests of its components
(`tests/unit/<name>.test.js`, new ones where the fix is pure logic) and its components' sections of
`docs/llms.md` — edit that file only with small targeted edits, because other groups edit it at the
same time. `CHANGELOG.md` and `docs/api.json` are central: report the changelog lines, don't edit.
`website/layouts/**` is not in any group's scope: report a template workaround that the fix makes
removable (file and line) instead of removing it.

Run `node --test` and `node tests/lint-tokens.js` before and after (baseline 784 passing). Verify
visually with your own headless scripts (see `tools/run-smoke.js` for serving the repository and
launching Chrome) on `website/theme.html` and the components' `docs.html#components/<name>` pages,
in both themes — never the shared browser pane.

The WP40 design rules stay binding: current is neutral and picked is the accent tint; one solid
accent per screen; categorical colour from `--zx-color-tone-*`; sentence case and mid weights; small
corners; no edge bars.

## Group 1 · Select and TagPicker

**Scope:** `src/components/select/**`, `src/components/tag-picker/**`, their demos.

- **A13** `Select.entity`: `colorKey` accepts token references (`var(--zx-…)`) as well as colour
  literals. The neutral default glyph already landed in WP40.
- **D4** `Select.priority()`: priority drawn as grey signal bars filled to the level in
  `--zx-color-text-muted`; only the urgent level is coloured (`--zx-color-danger`, a filled square
  with "!"); a "No priority" option. Keep the option values and the public API.
- **D5** TagPicker: `toneKey` (an item field naming a categorical tone; chips use the Badge tone
  palette) beside `colorKey`, which also accepts token references; read-only shows only the chips —
  no empty input, no chevron, no blank second row.
- **D8** `Select.entity` (and any Select whose input is read-only): a pointer click does not show
  the keyboard focus ring; keyboard focus still does.
- **D13** A disabled Select reads as disabled the same way a disabled Field does (the text and
  frame fade; one treatment, not two).

## Group 2 · Form, fields, and value inputs

**Scope:** `src/components/{form,fieldset,field,number-field,datebox,checklist,toggle,slider}/**`
(DateRangeBox lives in `datebox/`), their demos.

- **A2** Field keys stop being DOM ids and radio `name`s by themselves: ids are generated per form
  instance (an optional `idPrefix` makes them predictable); the key stays the field's `name` and its
  `data-field-id`. A form mounted twice has no duplicate ids; a field `stage` cannot collide with
  `#stage` elsewhere.
- **A9** NumberField, Datebox, and DateRangeBox fill a Field's control column (no inline-block with
  minimum widths) and fit two-column rows; the clear button's padding is reserved only when
  `clearable`.
- **A14** (part) Slider end-mark labels stay inside the component's box; Toggle labels start-align
  and wrap like text; a disabled DateRangeBox shows no clear button.
- **D3** Checklist inside a Field does not repeat its own heading under the field's label (the
  Field labels it; keep the accessible name).
- **D6** NumberField as a quiet field (`[data-zx-fields="quiet"]`): the value start-aligns with the
  other quiet values, and the stepper appears on hover or focus only.
- **D14** Field `type: 'html'` draws no input frame around display content.

## Group 3 · Data views

**Scope:** `src/components/{table,grid,table-view,kanban-view,badge,activity-list,activity-item,tree}/**`
(TreeView lives in `tree/`), `src/components/view/**`, their demos.

- **A5** Table and Grid number and date cell editors select their content on entry, as text editors
  already do (typing "6" into "1.00" gives 6).
- **A14** (part) Sortable and non-sortable Table headers use the same font; Table reserves no
  scrollbar gutter on a table that does not scroll; the neutral soft Badge stays visible on raised
  dark surfaces; TreeView type-ahead calls `preventDefault`.
- **D7** KanbanView assignee avatars use Avatar's tone from the name.
- **D10** ActivityList `variant: 'compact'`: one line per entry, the time at the trailing end, for
  cards narrower than 30rem.
- **D11** Badge `size: 'sm'` with `dot`: a gap and text size that do not look cramped.
- **D12** Table puts `data-column` on every header and body cell in every mode, and gives a column
  without a label an accessible name (its key or a `ariaLabel`).

## Group 4 · Overlays and shell

**Scope:** `src/components/{code-editor,menu-button,message,app-sidebar,copy,file-item,dialog,modal,dropdown,tooltip}/**`,
`src/core/overlay-host.js` (A8 only — this WP explicitly permits it), their demos.

- **A3** CodeEditor: Escape releases Tab capture until the next keystroke in the editor, so Tab
  then leaves it (no keyboard trap), as its documentation already says.
- **A4** MenuButton: after choosing an item the panel closes and focus returns to the trigger unless
  `onselect` moved it; `open({ returnFocus })`.
- **A6** Message: the floating region is recreated when its host was disconnected and removed when
  its last toast closes; `Message.disposeRegion(scope)`.
- **A7** AppSidebar: `collapsible: false` hides the minimise button; `getItems()` omits empty
  `children`.
- **A8** Dropdown, Tooltip, MenuButton, and Modal subclasses created before their anchor is
  connected resolve their overlay host on first open, not at construction, so they attach inside
  their theme scope rather than to `<body>`.
- **A10** copyButton: its hidden status line is positioned inside the button, creating no
  scrollable overflow that `focus()` could scroll into view.
- **A12** FileItem: a readable type label ("PDF", "CSV", "Image") instead of the raw MIME type, and
  the icon chosen from the MIME type; an explicit `typeLabel` wins.
- **A14** (part) `Dialog.confirm`'s `okLabel` is documented; `Dialog.prompt` takes one too.

## Group 5 · ZeyOS binding

**Scope:** `src/zeyos/**` (not `src/zeyos/icons.js` or `modules.js`), `tests/unit/zeyos-*.test.js`,
the ZeyOS sections of `docs/llms.md`.

- **D2** `zeyosTable` / `zeyosForm`: enum fields show readable labels (from the schema where it has
  them, otherwise sentence case of the value — "Invoiced", not "INVOICED"); date-only fields format
  as dates with no time and no daylight-saving shift (Unix-second dates are calendar days in the
  instance's zone, not instants); `zeyosTable` passes Table display options through (`variant`,
  `zebra`, and the rest of the Table option surface that does not conflict with the binding);
  `zeyosForm.save()` raises its toast in the caller's scope (`scope`, or the form's own element) and
  takes `notify: false` to stay silent.

## Out of scope

Everything in WP-39 sections B and C and the extension list of section D; template and kit changes;
new tokens.
