# WP36 — The open gaps: overlay focus, icon robustness, navigation overflow, RTL, print

Closes the defects a consuming application worked around rather than the features it wished for.
Each of these has an existing workaround in production code; the workaround is the evidence.

Work in the current checkout. **Do not commit** — this lands in one release commit afterwards.

## Shared rules

`AGENTS.md` applies in full. Beyond it, for this WP:

- **Do not touch** `src/index.js`, `website/docs.js`, `docs/**`, `dist/**`, `CHANGELOG.md`,
  `README.md`, `package.json`, `tests/smoke/smoke.js`. Those are wired centrally afterwards.
  §3 owns `styles/zx.css`; nobody else may edit it.
- **Do not run** `npm run build`, `build:api`, `build:site` or `test:browser`.
- Validate with `node --test` (not `node --test tests/unit/`, which this Node rejects) and
  `node tests/lint-tokens.js`. Run both BEFORE you start and record the baseline: it is currently
  **688 passing, 0 failing**, token lint clean over 83 CSS files.
- Sections run in parallel with disjoint file scopes. Stay inside yours.
- New user-visible strings go through `this._message('<component>.<thing>', 'English fallback')`.

---

## §1 · `Modal` and `Dialog` — focus containment

**File scope:** `src/components/modal/modal.js`, `modal.css`,
`src/components/dialog/dialog.js`, `dialog.css`, `tests/unit/modal.test.js`,
`tests/unit/dialog.test.js`, `website/demos/modal.demo.js`, `website/demos/dialog.demo.js`.

### Why

`modal.js` contains no focus, `aria-` or `role` handling, and `Dialog` is built on it. An
application that needs an accessible overlay therefore cannot use either: the one consumer we
have reads *"`sheet` everywhere. Not 'modal, wrapped' — one overlay primitive used consistently
is one thing to keep accessible, and a `modal` that needs a wrapper is a `modal` somebody will
eventually use without one."* That is a correct decision about a library that should not have
forced it. This is the oldest entry in that application's ledger and the only one ever flagged
as an accessibility concern.

`Sheet` already does this correctly and extends `Dialog`. Read it first: whatever you add must
not double-apply there.

### Contract

`Modal` gains, with no new required options:

- **Focus containment** while open. Prefer the platform: `<dialog>.showModal()` already contains
  focus and makes the rest of the page inert, which is why `Sheet` sets `modal: true` and gets
  this for free. If `Modal` is already using `<dialog>`, the fix may be as small as using the
  modal mode rather than re-implementing a trap — establish which before writing anything, and
  say so in your report.
- **`aria-modal`** and an appropriate `role` on the panel when it is modal.
- **Focus restore** to the element that opened it, on every close path — button, Escape, light
  dismiss, programmatic `close()`. An overlay that returns focus to `<body>` puts a keyboard
  reader at the top of the document.
- **Initial focus** on the first focusable element in the panel, or the panel itself when it has
  none. `Dialog` already honours `autofocus` on a footer button; that must keep winning.
- A non-modal `Modal` (if the option exists) keeps today's behaviour exactly.

Everything already true stays true: light dismiss, `destroyOnClose`, the `scope` option, and
`Dialog`'s buttons, views, `alert`/`confirm`/`prompt`.

### Validation

Unit: focus restore to the opener across all four close paths; `aria-modal` present while open
and gone after; initial focus placement including the `autofocus` case; a second open/close
cycle on the same instance. Assert that `Sheet` does not end up with two traps — one test that
`Sheet.prototype` still resolves to the same methods, as the existing dialog test does.

---

## §2 · `icon()` — an unknown name must not throw

**File scope:** `src/core/icons.js`, `tests/unit/icons.test.js`.

`AGENTS.md` restricts `src/core/**`; this section is the explicit permission.

### Why

`icon()` throws `RangeError` on a name it does not know, and the bundled set is 35 glyphs. In
any application whose icon names come from a server — which is the normal case for a
schema-driven product — one unconfigured name takes out the whole screen it appears on. The
consuming application lost a ticket-detail page to exactly this before it built a wrapper, and
that wrapper is now mandatory at every call site: *"Everything that hands a name to a component
goes through here."*

A design system may reasonably not have a glyph. It may not reasonably take the page down.

### Contract

- `icon(name)` with an unresolvable name **returns a placeholder element**, not an exception:
  the same `class="zx-icon"` root every icon has, empty or carrying a neutral fallback glyph, so
  layout does not shift.
- It **warns once per distinct name** (`console.warn`), so the gap is visible in development
  without flooding a list of four hundred rows.
- A new option `icon(name, { strict: true })` keeps today's throwing behaviour for callers that
  want to catch a typo at build time.
- Explicit provider prefixes (`fa:`, `kit:`, `builtin:`, a literal class list) behave as they do
  now. A Font Awesome name under a loaded kit is not "unknown" — the kit resolves at render time
  and that path must not start warning.

Anything currently relying on the throw is a caller wrapping it in `try`, which keeps working.

### Validation

Unit: an unknown name returns an element rather than throwing; the element carries `zx-icon`;
the warning fires once for repeats; `strict: true` still throws; every existing name still
resolves. Check whether any component catches `RangeError` from `icon()` today and adjust it if
so — a dead `catch` is worse than none.

---

## §3 · Navigation overflow, RTL, and print

**File scope:** `src/components/navigation-bar/navigation-bar.js`, `navigation-bar.css`,
`src/components/table/table.css`, `styles/print.css` (new), `styles/zx.css`,
`tests/unit/navigation-bar.test.js`, `website/demos/navigation-bar.demo.js`.

### 3a · `NavigationBar` overflow is not configurable

Below 44 rem the bar hides **every** item behind a "More" menu, so at 375 px the whole navigation
is one button. That is a defensible default for a top app bar and a bad one for a product that
wanted a phone bottom bar, and today there is no way to say so — the consumer switched component
entirely.

Do **not** change the default. Add a way to choose:

```js
new NavigationBar(null, {
  items,
  overflow: true,          // unchanged default
  overflowBelow: '44rem',  // the container width at which items start collapsing; false disables
  minVisible: 0,           // how many items never collapse, from the start
});
```

`minVisible: 4` with the existing container query is what makes a usable bottom bar. Keep the
overflow menu's keyboard map and its `More` label (which is already an option) exactly as they
are.

### 3b · RTL

A scan finds **one** physical-direction declaration across 79 component stylesheets — in
`table.css` — with 50 already using logical properties and the rest needing none. `Sheet` already
carries `[dir="rtl"]` rules for its enter transition. So this is close to done and nobody has
said so.

- Convert the remaining declaration in `table.css` to its logical equivalent.
- Add `tests/unit/logical-properties.test.js`: scan `src/components/**/*.css` and fail on
  `margin-left|right`, `padding-left|right`, `left:`, `right:`, `text-align: left|right`, with a
  narrow allowlist for anything genuinely physical (a transform origin, say). This is the test
  that keeps it true — the state is good today by accident, not by enforcement.

### 3c · Print

`grep -rl '@media print'` returns nothing. Consumers print invoices, delivery notes and reports
out of these components, and a table that takes its sticky header, zebra stripes and hover states
to paper is a support ticket.

Add `styles/print.css`, imported from `styles/zx.css` **last**:

- Release `position: sticky` on table headers and toolbars; they stack on paper.
- Zebra, hover and focus rings off; borders to a hairline that actually prints.
- Overlays, toasts, tooltips, dropdowns, launchers and the navigation chrome hidden.
- `break-inside: avoid` on cards, table rows and stat tiles; table headers repeat via
  `display: table-header-group`.
- Link URLs after the text (`a[href^="http"]::after { content: " (" attr(href) ")" }`) in prose
  contexts only — never inside a table cell or a button, where it destroys the layout.
- Backgrounds off by default; `print-color-adjust: exact` **only** on status badges, whose colour
  carries meaning alongside their text.

Semantic tokens only, and the file must be inert on screen.

### Validation

Unit for 3a (the resolved threshold and `minVisible` arithmetic as pure functions) and 3b (the
new scanner, which must pass on the current tree once `table.css` is fixed). For 3c, assert that
`styles/zx.css` imports it last and that the file body is entirely inside `@media print`.

---

## §4 · The rail flyout

**File scope:** `src/components/app-rail/app-rail.css`, `src/internal/app-rail.js`,
`website/demos/app-sidebar.demo.js`.

`AppSidebar` had a visual pass in the previous release; its **minimized rail's flyout** did not,
because the flyout panel is built into a `Dropdown` portaled to `<body>` and its styles live in
`app-rail.css`, outside that work's file scope. So an expanded sidebar and a minimized one now
disagree: the tree has a filled active pill, an edge marker, a fixed icon gutter and wrapping
labels; the flyout still has the old flat treatment.

Bring the flyout to the same treatment. Read `src/components/app-sidebar/app-sidebar.css` first —
it declares the spacing scale and the active-item recipe, and the point is to match it, not to
invent a second one. The flyout is portaled, so `.zx-app-sidebar` descendant selectors do not
reach it; style it from `.zx-app-rail__popover`.

Options, events, methods, the DOM and the keyboard map do not change.

### Validation

No unit test is required for a visual pass; do not delete existing ones. Verify by eye in
light × dark × cozy × compact and on all six accent presets, expanded and minimized, with a
nested flyout open. You have browser tools — use them, and report the contrast ratio for the
flyout's active item against its panel.

---

## Out of scope for the whole WP

A rich-text editor, a second chart adapter, a shared drag primitive, `Form` × `Stepper` wizard
validation, an `AppSidebar` heading item type (that is an item-model change and needs its own
work package), release packaging, and committing.
