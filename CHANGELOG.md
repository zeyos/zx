# Changelog

Notable changes to `@zeyos/zx`. The format follows [Keep a Changelog](https://keepachangelog.com),
and the project follows [semantic versioning](https://semver.org).

Releases before this file existed are summarised from the git history; `git log v2.0.1..v2.0.2`
and friends remain the complete record.

## Unreleased

## 4.1.0 — 2026-08-25

### Added

- **`AppIcon`.** A reusable application-identity surface with safe semantic colours, badges,
  accessible labelled and decorative modes, and an optional CSS-only translucent glass material.
  The ZeyOS adapter supplies presets for all 29 current applications while keeping glyph loading
  and routing application-owned.
- **`Filter`.** A backend-neutral visual expression builder with a versioned JSON-safe AST,
  nested AND/OR groups, typed operators and value editors, abortable asynchronous choices,
  structural and semantic validation, defensive limits, deterministic keyboard focus, and
  valid-only Apply events. Query compilation, saved views, and URL state remain adapter concerns.
- **Richer entity and tag selection.** `Select.entity()` supports optional recent items and an
  application-owned create command; `TagPicker` now renders native item icons and semantic colours
  without overriding a custom renderer.

### Changed

- **Transaction grids are faster to operate.** `Grid.BillingItems()` and `Table` now support
  single-click typed editing, opt-in double-click compatibility, same-parent row reordering by
  drag or keyboard, hierarchy-safe branch moves, and accessible column visibility controls.
- **ZeyOS identity is consistent across workflows.** Launcher application tiles use the new
  AppIcons, while Launcher recents and entity-select results use module/entity identities and
  colours rather than generic placeholders.
- **The documentation shell is easier to navigate.** Global search is centred in every header and
  reports full breadcrumb paths; component groups are alphabetized, application-shell primitives
  are collected under Layout, narrow API tables remain locally scrollable, and public navigation
  and footer links are reduced to their canonical destinations.
- **Theme Studio now applies complete recipes.** Presets change typography, tint, radius, density,
  control sizing, and glass strength in addition to colour; the house preset is named `ZeyOS`.

### Fixed

- Select preset chevrons retain their alignment across theme recipes and enhanced
  `Select.entity()` targets restore their exact original DOM when destroyed.
- Floating messages default to a content-sized upper-right glass surface instead of stretching
  with the document, with opaque and reduced-transparency fallbacks.
- Filter mutations preserve keyboard focus and accessible announcements; asynchronous editors
  expose busy state and abort stale work.
- Row editing no longer targets hidden columns or hijacks buttons and links rendered inside cells;
  column toggles retain focus and row drags do not export record identifiers as plain text.
- Application and tag colour overrides reject CSS image and URL values before reaching public
  custom properties.

## 4.0.0 — 2026-08-24

### Added

- **`Card`.** A semantic, product-agnostic content and record surface with optional media, native
  title link, secondary actions, footer metadata, three variants, horizontal/vertical layout, and
  exact enhanced-target restoration. The root never impersonates a link or button, so nested
  controls remain valid and independently keyboard-accessible.

### Changed

- **One public application-navigation component.** `AppSidebar` now owns expanded vertical, minimized
  vertical, and horizontal rail presentations over one active/branch state model. Descendants are
  inline only while expanded and use pointer-, focus-, and keyboard-accessible flyouts in rail
  states; its minimized renderer is an implementation detail, not a second public component.
- **Richer Select presets.** `Select.priority()` now uses the five-square ZeyOS scale;
  `Select.status()` adds shape- and semantic-color-distinct workflow states; and the optional
  `zeyosEntitySelect()` binding adds grouped remote records, module-colored icons, an explicit
  empty choice, and application-owned command rows without changing the selected-ID contract.
- **Full launcher parity.** `Launcher` now distinguishes application tiles from record rows,
  exposes current and pinned state, spatial keyboard movement, visible hints, query-state/source
  ordering, and injected icon factories. The optional ZeyOS adapter maps all 29 prototype
  applications, forks/weblets, cached or async recent records, and grouped abortable search while
  leaving permissions, icons, destinations, and routing with the host application.
- The documentation now has a global destination search, a clearer uppercase green
  Presets/Examples hierarchy, and product-agnostic Xenon positioning. The internal rollout guide
  is no longer shipped or linked from public surfaces.

### Removed

- **The separate `AppRail` constructor.** Use `AppSidebar` with `collapsed: true` for a vertical
  rail or `orientation: 'horizontal'` for a horizontal rail. This completes the single-owner
  navigation contract instead of maintaining two public root-DOM models.
- **Public gx compatibility entry points and bundles.** The compact `__()` DOM builder is part of
  the Zx core; gx adapter source remains repository-internal and is no longer exported, built, or
  included in the npm package.

### Fixed

- Late Launcher sources preserve the current keyboard choice only while completing the same query;
  a new query resets to its own best match.
- Card rejects control-obfuscated unsafe URL schemes; Launcher and every AppSidebar presentation
  strip executable/data destinations and disable inert descriptors. AppSidebar also relocates focus,
  emits its effective collapse state across layout changes, and releases obsolete mode listeners.
- Card restores an enhanced target after failed construction, releases callbacks when links or
  actions are replaced, and keeps the full non-interactive body inside the primary-link target.
- Status shortcut hints now activate their options, async permission group loaders cannot be
  disconnected by a filter override, and enhanced billing grids restore every target attribute.
- Billing totals now distinguish a missing operand from an explicit zero, and Chart renders a
  consistent error state for falsy payloads and errors without a message.

## 3.0.0 — 2026-08-24

### Added

- **Xenon application shell components.** `Launcher` combines deterministic local ranking with
  abortable grouped sources and a Cmd/Ctrl+K dialog; `Avatar` provides a stable initials fallback;
  `AccountMenu` composes identity with an APG menu; `AppSidebar` is expanded vertical navigation;
  and minimized `AppRail` keeps descendants in pointer-, focus-, and keyboard-accessible flyouts
  for both vertical and horizontal placement. All route, permission, session, and persistence work
  remains application-owned behind cancelable events.
- **`Grid` and `Grid.BillingItems()`.** The public Table specialization keeps every Table feature
  while providing a conventional editable billing schema for currencies, units, line totals, and
  flat parent rows. The default line formula is quantity × unit price; tax, discount, rounding,
  subtotal, validation, and persistence policy remain caller-owned.
- **Engine-neutral `Chart` and injected `ChartJsAdapter`.** Chart owns responsive canvas lifecycle,
  loading/empty/error states, Xenon theme defaults, point-selection events, and a synchronized
  semantic data table. Chart.js 4.5.1 is pinned only as a development/documentation asset; the Zx
  runtime has no chart import and no runtime dependency.
- **Lateral anchored-overlay placement.** `position()`, `Dropdown`, `MenuButton`, and `Tooltip` now
  accept left/right start/end variants for rail and account surfaces.

- **`Questionnaire`** — a guided, one-question-at-a-time flow for onboarding intake, service
  checklists, audits and surveys, where a `Form` full of fieldsets is the wrong shape. The root is
  a real `<form>` and the choices are native radios and checkboxes carrying the item name, so
  `new FormData(questionnaire.toElement())` reads the answers and the keyboard contract inside a
  choice group is the browser's. Three things go beyond a stack of fieldsets: an item carries a
  `when` predicate and a `next` target, so the flow **branches** — conditions cascade, an
  abandoned branch's answers drop out of `getAnswers()`, progress counts the questions actually
  reachable, and Back retraces the path walked rather than an array index; an item's answer control
  can be **any registered `Field` type** (`field: {type: 'date'}`), which is what lets a question
  ask for a date, a number, a rating or an upload; and `validate` may return a **promise**, so a
  question can be gated on a server check. `review: true` adds a summary screen with jump-back-to-
  edit, `advance: 'auto'` moves on by itself after a single choice, and `1`–`9`/`a`–`z` shortcuts
  are assigned and shown on each answer.

- **`Sheet`** — an edge-anchored `Dialog` covering both side-sheet and mobile-drawer patterns;
  the two differ only in which edge they take, so `side` (`'start' | 'end' | 'top' | 'bottom'`,
  logical) replaces a second component. `modal` is three-way rather than a boolean because the
  three real behaviours do not collapse into two: `true` hands focus containment, page inertness,
  Escape and the backdrop to the browser via `showModal()`, while `'trap-focus'` and `false` open
  non-modally and re-implement only what they still want. `backdrop: 'dim'|'blur'|'none'` applies
  to modal sheets alone — `::backdrop` does not render for a non-modal dialog, and a painted
  stand-in would make a non-blocking sheet look blocking. Entry **and exit** animate, which a
  `<dialog>` normally cannot do, via `@starting-style` and `transition-behavior: allow-discrete`
  on `display`/`overlay`. `resizable`, `snap` detents and swipe-to-dismiss are deliberately one
  gesture whose meaning is decided when the pointer settles, so the sheet follows the pointer the
  whole way instead of pinning at its minimum and then vanishing.
- **`SheetStack`** — several sheets as one drill-down. Small on purpose: nested dialogs already
  stack in the top layer by open order and Escape already closes only the topmost, so no z-index
  bookkeeping and no unwinding logic. `stack` slides covered sheets back, scales them down and
  makes them `inert`; `cascade` shifts each clear of the ones in front by their **measured** size
  so they sit side by side and all stay usable — usually the right one for an ERP screen, where
  the parent record should stay readable while a line item is edited.
- **`Dock`** — a stack of collapsible, resizable panes: the docked inspector column of a design
  tool, and the detail side of a master–detail screen. A pane is either titled or a **tab group**
  whose strip replaces the title. Giving the dock a `content` turns it into a region with panes on
  either `side` of it, and nesting one dock in another's pane gives a workbench. Sizes, collapsed
  panes and active tabs persist through `storageKey`; content factories run on first reveal.
- **`Dock.adopt(sheet)`** — a dock can take over a `Sheet`'s positioning, so the sheet becomes a
  track in the dock's flow instead of an overlay. A dock is a flex container by construction and
  therefore always a valid host, which is why docking needs no arrangement from the application.
  `dockAt` hands the sheet back to a free overlay below a breakpoint measured on the **dock's own
  width**, so a dock inside a split pane behaves correctly where a viewport media query would not.
  Nothing is rebuilt across the handoff: the element moves and reopens in place, so DOM state and
  listeners survive and no `open`/`close` is emitted for what is only a change of address.
- **`--zx-overlay-blur`** — tier-2 semantic token behind `Sheet`'s `'blur'` backdrop, default `8px`.

### Changed

- **`SplitView` now shares one axis-drag engine with `Sheet` and `Dock`**, extracted to
  `core/drag-axis.js`: pointer capture, one write per frame, telling a click from a zero-distance
  drag, and the WAI-ARIA keyboard map. Behaviour is unchanged. `resolveSize` moved to the kernel
  and is re-exported from `split-view.js`, so every existing import keeps working.
- **`Modal` gained three protected seams** — `mountTarget()`, `_show()` and `_isRealClose()` — so a
  subclass can live somewhere other than `document.body`, open non-modally, and re-host itself.
  `Dialog`'s size application became the overridable `_applySize()`. No public behaviour changed.
- **The modal scroll lock keys off `:modal` rather than `[open]`**, so a non-modal dialog no longer
  locks the page behind it. `Modal` and `Dialog` always open modally, so neither is affected.

### Removed

- **`Permission` is removed**, not just deprecated. 2.3.0 kept the class around for
  `gx.zeyos.Permission` while pointing new code at `Select.permission()`; there is no longer a
  second implementation to keep in sync, and `gx.zeyos.Permission` now builds directly on
  `Select.permission()` instead of wrapping the removed class. The legacy constructor, options,
  `get()`/`set()`, and the `change` event are unchanged — only the `zx.Permission` export is gone.

## 2.3.0 — 2026-08-23

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
  with nothing overflowing. `DateRangePicker`, `Fieldset`, and `NavigationBar` still use
  containment and are only partly rescued — see below.
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
- **Size containers fill their host instead of collapsing inside it.** `DateRangePicker`,
  `Fieldset`, and `NavigationBar` declare `container-type: inline-size` to pick their own layout,
  which means they contribute nothing to their own intrinsic width — so in a flex row, an
  inline-block, or a grid `auto` track they were squeezed to a few pixels and their contents
  spilled out on top of each other. They now take `inline-size: 100%`, and `Form` does too, because
  containment travels upward: a form shrink-wrapped to its action buttons while the fieldset inside
  it overflowed. Eight examples on the documentation site were rendering this way.

  This fixes every host that has a width of its own, which is the case that was actually biting.
  It cannot fix a host that shrink-wraps its contents — an `inline-block` or a `fit-content` track
  with no width of its own — because there 100% resolves against a containing block the collapse
  has already zeroed. Only dropping containment does, as `MultiValueEditor` now has;
  `DateRangePicker`, `Fieldset`, and `NavigationBar` still need a definite width from their host.
  `tests/unit/size-containers.test.js` keeps every `container-type` rule declaring a width.
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
