# Changelog

Notable changes to `@zeyos/zx`. The format follows [Keep a Changelog](https://keepachangelog.com),
and the project follows [semantic versioning](https://semver.org).

Releases before this file existed are summarised from the git history; `git log v2.0.1..v2.0.2`
and friends remain the complete record.

## Unreleased

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
