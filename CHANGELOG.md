# Changelog

Notable changes to `@zeyos/zx`. The format follows [Keep a Changelog](https://keepachangelog.com),
and the project follows [semantic versioning](https://semver.org).

Releases before this file existed are summarised from the git history; `git log v2.0.1..v2.0.2`
and friends remain the complete record.

## Unreleased

### Added

- **Six standard themes, as an attribute.** `data-zx-preset="zx" | "zeyos" | "ocean" | "violet" |
  "rose" | "slate"` picks the accent ramp, orthogonally to `data-zx-theme` picking the polarity.
  A preset is five tier-1 declarations — `--zx-accent-300` … `--zx-accent-700` — because the accent
  roles now resolve through that ramp rather than through the green palette directly, so one block
  rethemes light, dark, and auto together with no second list to keep in sync. Every shipped
  preset keeps its 600 stop above 4.5:1 against white and its 400 stop above 4.5:1 against the dark
  page, which is what lets `--zx-color-on-accent` stay a single value per theme. Status colours are
  deliberately not part of a preset.
- **A theme studio at `/theme.html`.** Every component on one page under a live theme: cycle the
  standard presets (or press `[` and `]`), set a custom accent that is derived into a full ramp in
  OKLab with the contrast ratio reported as you go, tint the neutral ramp, and change radius,
  control height, base text size, type stack, and density — then copy the result out as CSS.
  What you pick applies to the whole documentation site until you reset it.

- **`Select` takes fixed choices.** `fixedItems` pins entries to the top of the list, above a rule,
  and treats them as part of the control rather than of its data: a `filter` function replaces the
  item list on every query, so a pinned entry is narrowed locally against the same query instead,
  survives `setItems()`, shows below `minQuery`, and stays resolvable by `set()` once the first
  results have landed. That is what a choice with no row in the source needs — "Unassigned",
  "Everyone", "Private". `setFixedItems()` replaces them later.
- **`Select.permission()`**, the record-access picker: Private and Public pinned above the groups a
  record may be shared with, carrying the tri-state ZeyOS stores — `false`, `true`, or a group ID —
  so it binds straight to the record field. `groups` takes an array, or a loader `(query) => items`
  for an installation whose group list is too long to ship with the form.

- **`MultiValueEditor` rows reorder by dragging.** Each row grows a handle that drags it to a new
  position, with a line showing where it will land. `reorder` picks what a row offers — `'both'`
  (the default), `'drag'` for the handle alone, `'buttons'` for the arrows alone, or `'none'`.
  Dragging goes through the handle rather than the whole row, so selecting text inside a row's
  input still works, and the handle is a keyboard control too (arrow keys, Home, End) — which is
  what keeps `reorder: 'drag'` operable without a pointer.

### Changed

- **The documentation shows the demo data behind an example.** `items: catalogue()` documented
  nothing on its own — the shape the component wants was in a helper the reader could only find by
  opening the whole module. Every example's code block now carries a tab per module-level
  declaration it uses, transitively, extracted from the demo module's own text. Nothing about
  writing a demo changes: declare the data at the top of the module and it appears.

### Deprecated

- **`Permission`.** Its three radios and a disabled group picker spend a form row on a choice
  `Select.permission()` makes in one control, and the group list could only ever be an array held
  in memory. The class stays for `gx.zeyos.Permission` and goes away in 3.0; the value and the
  `groups` option are identical, so replacing it is a one-line change.

### Fixed

- **`MultiValueEditor` no longer collapses in a host that sizes to its contents.** It is no longer
  a size container at all. `inline-size: 100%` does not rescue one: the percentage resolves against
  a containing block the host measured from the contribution containment had already zeroed, so the
  editor still came out 26px wide in an inline-block, a table cell, or a shrink-to-fit flex row,
  with the row spilling out to the left of it. The rows reflow on their own now — the controls wrap
  under the value when the row runs out of room — which also reads the width that decides the
  layout, the row's, rather than the editor's. Verified from a 1000px grid down to a 100px pane
  with nothing overflowing. `DateRangePicker`, `Fieldset`, and `NavigationBar` still carry the
  original recipe and still collapse.
- **`MultiValueEditor` keeps focus on the move button.** Up and down disabled themselves at the
  ends of the list, so a row that reached the top took focus down to the document with it, and a
  move sent focus to the value input rather than leaving it on the button that had just moved the
  row — pressing up twice was impossible without going back for it. The ends now mark themselves
  `aria-disabled` and stay focusable.
- **`MultiValueEditor` keeps a stored value its option list has lost.** A value with no matching
  option displayed as the first option while `getValues()` went on returning the stored one, so a
  form that was only opened and saved rewrote the field. The unknown value is now an option in its
  own right.

- **The × on a closable `Tabbox` tab closes it.** It was drawn as a decorative glyph with no
  handler, so clicking it merely activated the tab and closing was reachable only through the
  Delete key. It is now a real hit target that emits `close` and hands focus to the neighbouring
  tab, with Delete unchanged. It stays a `<span>` rather than a nested `<button>`, which buttons
  cannot contain.
- **Size containers no longer collapse in a host that sizes to its contents.** `DateRangePicker`,
  `Fieldset`, `MultiValueEditor`, and `NavigationBar` declare `container-type: inline-size` to pick
  their own layout, which means they contribute nothing to their own intrinsic width — so in a flex
  row, an inline-block, or a grid `auto` track they were squeezed to a few pixels and their contents
  spilled out on top of each other. They now fill their host, which is the only thing that can size
  them. `Form` fills its host for the same reason: containment travels, so a form shrink-wrapped to
  its buttons while the fieldset inside it overflowed. Eight examples on the documentation site were
  rendering this way.
- **A focused `Search` field is ringed as one control.** The input carried its own focus ring on
  top of the ring the field already draws on `:focus-within`, so a smaller rounded box appeared
  inside the field and cut the submit button out of it — the field read as an input with a
  detached button beside it. The input now rides the field's ring, and the clear and submit
  buttons mark themselves with an inset ring so tabbing still shows which one has focus without
  breaking the outline.

- **The generated API reference stopped losing methods to inline type casts.** `/** @type {X} */
  (expr)` is a doc comment with no method behind it, and the scanner in `tools/build-api.js` was
  allowed to run past it to the next one — swallowing that method's own comment, and with it the
  method. Sixty-three public methods across forty-four components had no row on the documentation
  site, `Dialog.open()` and `Table.commitEdit()` among them, and a few of the rows that did appear
  had absorbed a neighbour's parameters into signatures like
  `destroy(options, column, index, node)`.
- **A horizontal `Stepper` spans its container.** The connectors were already written to absorb
  whatever space was left over, but the steps themselves could not grow, so there was never any
  slack to absorb and the rail bunched up on the left of a wide card. The labels still size to
  themselves; the rules between them now stretch.

## 2.2.1 — 2026-08-21

### Fixed

- **Select-all covers the rendered rows when `growing` is on**, not the whole result set. Ticking a
  box above the ten rows you can see and selecting a hundred is a trap, because the next click is
  usually a bulk action; `showAll()` first to mean all of them. Tables without `growing` are
  unaffected — everything is rendered, so the two are the same set.
- **A growing table reports its real size to assistive technology.** Only a prefix of the data is in
  the DOM, so a screen reader was announcing "row 3 of 10" for a table of ten thousand. The table
  now carries `aria-rowcount` and each row an `aria-rowindex`.

## 2.2.0 — 2026-08-21

### Added
- **TypeScript definitions**, generated from the JSDoc and shipped in the package. `exports` now
  carries a `types` condition for every entry point, so `@zeyos/zx`, `/zeyos`, and `/compat` all
  resolve. `Component` became generic over its options type and every component binds its own
  typedef, which is what makes `new Slider(null, { value: 20 })` check against `SliderOptions`
  rather than accept any object at all.
- **Table growing** — `growing: <number>` renders a first batch of rows and offers a control for
  the next, for the result sets an ERP query returns happily and nobody scrolls through.
- **Responsive tables** — `Table` gained `responsive` and a per-column `popin`. Below the given
  width each row stacks into a card of label/value pairs, measured on the table's own container
  rather than the viewport, so it triggers inside a narrow split pane on a wide screen.
- **`Table.emptyText` accepts a Node or a factory**, so an empty table can carry an icon, an
  explanation, and the action that resolves it instead of one line of grey text.
- **Per-component imports** — `src/` and `styles/` now ship, and `@zeyos/zx/src/components/…` is a
  supported subpath carrying its own type declarations. An application using two components bundles
  26 kB minified that way against 157 kB through the package entry point. Nothing changes for
  existing imports.
- **Component styling hooks** — a short, published set of custom properties for restyling one
  component without reaching into its selectors: `--zx-table-header-bg`, `--zx-table-row-hover-bg`,
  `--zx-table-row-selected-bg`, `--zx-table-border-color`, `--zx-button-radius`,
  `--zx-panel-header-bg`. Each falls back to the semantic token it replaces.

### Fixed

- `onBreakpoint()` treated an element that had not been laid out yet — width 0 — as the `xs` band,
  so the first real width silently never notified if it landed in the same band. It also answered
  resize notifications inside the observer callback, which the browser reports as a
  "ResizeObserver loop" whenever the handler changes layout, and rejected nothing when handed a
  target it could not measure.
- The type declarations describe the kernel accurately now: every module in `src/core/` is type
  checked on each build, which corrected a set of JSDoc inaccuracies that had been flowing into the
  published `.d.ts` — among them `Component.cssName`, and the `response` the HTTP helpers attach to
  the errors they throw, which TypeScript had been told did not exist.
- Two static-field type conflicts in the compatibility layer (`SelectBase.filterMode`,
  `PickerBase.Picker`) that made the emitted declarations fail to compile for consumers who do not
  set `skipLibCheck`.

## 2.1.0 — 2026-08-19

### Added

- **`spinner()`, `ProgressBar`, `InlineLoading`** — three shapes of "wait". A ring for an unknown
  duration, a determinate track for a known share, and a status line that resolves in place
  ("Saving…" becoming "Saved"). Previously the only loading affordance was `Table.setLoading()`,
  which belongs to the table and cannot be used anywhere else.
- **`skeleton()`, `skeletonText()`, `skeletonTable()`** — placeholders shaped like the content that
  is coming, so the layout does not jump when it arrives. All `aria-hidden`; put `aria-busy="true"`
  on the region being filled.
- **`stack()`, `grid()`, `aspect()`** and the `.zx-stack` / `.zx-grid` / `.zx-aspect` classes —
  the spacing and grid primitives under `Panel` and `SplitView`. `grid()` reflows on its own
  container width rather than the viewport, so it behaves identically inside a split pane or a
  modal.
- **`breakpoints`, `breakpointOf()`, `matchBreakpoint()`, `onBreakpoint()`** — named width bands
  for the decisions only script can make. `onBreakpoint()` observes an element as readily as the
  window.
- **`Slider`** and the `slider` field type — a bounded numeric value set by dragging, on a native
  range input, with optional marks, bounds, and a number box. `stepPrecision()` is exported
  alongside it.
- **`ContextMenu`** — right-click menu for a region or, through `selector`, per row from a single
  instance. Reachable from the keyboard with the Menu key and Shift+F10.
- **`copyButton()` and `CopyInput`** — copying a value, and confirming it; a refused clipboard
  write reports `false` rather than claiming success.
- **`truncate()` and `isTruncated()`**, plus the `.zx-truncate` class — line clamping that exposes
  the full value as a `title` only while the text is actually cut off.
- `copy` added to the built-in icon set.
- `CHANGELOG.md`, included in the published package.

### Changed

- The landing page routes by intent — start something new, see what is there, or move an old
  screen across — states how to install the package, lists the entry points, and renders the
  newest changelog entry so a release updates it too. The footer, shared by every page, carries
  grouped links plus the version and the build date.

## 2.0.2 — 2026-08-19

### Fixed

- The base stylesheet now replaces the browser's own focus outline instead of stacking on it, so a
  focused control no longer shows a blue border inside the accent ring.
- Tabbox variants match the approved draft, and the tab clears the inherited control radius.
- Every deploy is served from a revision-stamped path, and the imports the markup cannot see are
  fingerprinted with it — working around a CDN that rewrites cache headers.

## 2.0.1 — 2026-08-19

### Added

- Tabbox gained four square-cornered variants (`divided`, `bracket`, `line`, `segmented`) with
  `--zx-tabbox-radius` as an escape hatch. **The default moved from `line` to `divided`**, so a
  Tabbox with no explicit `variant` changes appearance.

### Changed

- The documentation is one scrolling page per component, with the source folded under each example.

## 2.0.0 — 2026-08-18

First stable release: the dependency-free, vanilla-JavaScript successor to the MooTools-era `gx`
library. Components, design tokens with light/dark and cozy/compact theming, the `zx-zeyos`
schema-driven binding, and an opt-in `gx` compatibility layer.
