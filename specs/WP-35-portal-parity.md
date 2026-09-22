# WP35 — Record-view parity: group rows, list controls, and the tail of the i18n layer

Closes the gaps a real application found when it was brought to the feature line of a
Vuetify/Vuexy build it replaces. Every item here was reached by writing the application code
first and finding the library could not express it, or could express it but not in a translated
product. Nothing here is speculative.

Work in the current checkout on top of the uncommitted 4.4.0 work. **Do not commit.** Leave
everything for review.

## Shared rules

`AGENTS.md` applies in full and is not repeated. Beyond it, for this WP:

- **Do not touch** `src/index.js`, `styles/zx.css`, `website/docs.js`, `docs/**`, `dist/**`,
  `CHANGELOG.md`, `README.md`, `package.json`, `tests/smoke/**`. Export registration, CSS
  imports, demo registration, generated documentation and the changelog are wired centrally
  after every section lands.
- **Do not run** `npm run build`, `build:api`, `build:site` or `test:browser`. They write shared
  generated output. Validate with `node --test tests/unit/` and `node tests/lint-tokens.js`.
- Sections are implemented in parallel by different people. **Stay inside your section's file
  scope.** Where two sections name the same directory they name different files in it.
- Every new user-visible string goes through `this._message('<component>.<thing>', 'English
  fallback')`, the pattern `Checklist`, `Pagination` and `Sheet` already use. Never a bare
  literal, never a new mechanism.

---

## §1 · `Table` — group and section rows

**File scope:** `src/components/table/table.js`, `src/components/table/table.css`,
`tests/unit/table-rows.test.js` (new), `website/demos/table.demo.js`.

### Why

A ZeyOS transaction line item carries a `type`: `0` is a position with quantities and amounts,
`1` is a **section heading** that groups the positions under it and carries no values. It is how
quotes and invoices are written, and `Table` cannot draw one: `colspan` appears exactly once in
`table.js`, on the empty-state row. `CardView` has `groupBy`; `Table` has nothing, which makes
this an inconsistency inside the library as well as a gap. `hierarchy` is a treegrid —
indentation and a disclosure control — and a section is not a branch you collapse.

The concept is already half-modelled: `isBillingLine()` in `src/components/grid/grid.js` reads a
`kind` field and returns `false` for `group | subtotal | header | section`, so `Grid` already
knows these rows exist and are not editable. Only the rendering is missing.

### Contract

Two new `Table` options:

```js
new Table(null, {
  columns,
  data,
  rowKind: 'type',          // string field name, or (row) => unknown, or null (default)
  rowKinds: {               // keyed by the resolved kind, coerced to a string
    1: {
      span: true,                          // one cell across every rendered column
      render: (row) => Node|string,        // cell content
      class: 'zx-table__row--section',     // added to the row
    },
  },
});
```

- `rowKind: null` (the default) keeps today's rendering exactly. A kind with no `rowKinds` entry
  also renders as an ordinary row. Existing consumers see no change.
- A `span: true` row renders **one** `<th scope="colgroup">` whose `colspan` covers every
  rendered cell, including the selection column when `selectable: 'multi'`. `<th>` and not
  `<td>` because the cell labels the columns of the rows beneath it, and a screen reader walking
  the table should meet it as a heading rather than as a value.
- Without `render`, the cell falls back to the row's value for the first visible column, which
  is what a host has to do today by hand.
- A spanning row carries no selection checkbox, is never editable, and is skipped by
  `rowReorder`. It still emits `rowclick` — a host may want to collapse a section — and it still
  participates in `getData()` and `updateRow()`.
- **Sorting.** When any row in the current data resolves to a spanning kind, the header sort
  controls are not rendered and `setSort()` is a no-op that warns once. Sorting a grouped table
  scatters the positions out of their sections, and silently doing so is worse than not offering
  it. `sortMode: 'server'` is unaffected — the host owns the order there — but the guard applies
  to the controls either way, so a header cannot invite an action the component will refuse.
- **Stacked presentation.** Below the `responsive` breakpoint `Table` turns each row into a
  labelled stack. A spanning row must render as its heading alone: no `data-label`, no empty
  labelled cells. Getting this wrong produces a heading followed by five labelled blanks, which
  is what the application's stylesheet is currently working around.

### CSS

`.zx-table__row--section` is **not** shipped as a look; ship the structural rules only (the cell
spans, the label pseudo-element is suppressed when stacked) and let the host style the row
through `class`. Sections differ per product — a billing section is not a kanban swimlane — and
a default tint is the part every consumer overrides first.

### Validation

Unit: kind resolution from a string field and from a callback; colspan arithmetic with and
without a selection column; fallback cell content; sort controls withheld when a spanning row is
present and restored when the data changes to one without. Demo: a billing-shaped table with two
sections, shown in both themes, both densities, and narrow enough to stack.

### Also in this section — two literals

`table.js` has two user-visible English strings with no way to change them:
`'Columns'` (the column-chooser summary) and `` `Move ${column.label}` `` (the reorder group's
accessible name). Route both through `_message()` as `table.columns` and `table.moveColumn`
(`'Move %1'`). `Table` already has `_message`; this is two lines.

---

## §2 · `RecordView` / `TableView` / `CardView` — a field chooser a product can use

**File scope:** `src/components/view/record-view.js`, `record-view.css`,
`src/components/table-view/table-view.js`, `table-view.css`,
`src/components/card-view/card-view.js`, `card-view.css`,
`tests/unit/record-view-controls.test.js` (new), `website/demos/table-view.demo.js`,
`website/demos/card-view.demo.js`.

Do **not** edit `src/components/table/table.js` — §1 owns it.

### Why

`fieldControls` defaults to **on** and is unusable in a translated application: the trigger is
the literal `'Fields'` in `record-view.js` and there is no option to change it, so a German
product either shows an English word or switches the whole feature off. The application under
test switched it off and rebuilt visibility and ordering by hand — roughly 180 lines — while
driving the library's own `hiddenFields` / `fieldOrder` underneath. The state model was right
the whole time; only the control could not be placed or named.

### Contract

```js
new TableView(null, {
  fields, data,
  fieldControls: true,                       // unchanged default
  // or
  fieldControls: {
    label: 'Spalten',                        // trigger label
    target: someToolbarElement,              // mount the disclosure here instead of in the view
  },
  // or
  fieldControls: false,                      // unchanged
});
```

- `true` and `false` behave exactly as today.
- An object customises the trigger. `label` omitted falls back to `_message('recordView.fields',
  'Fields')` so a host that installs a translator gets it for free.
- `target` moves the disclosure into a host element — a list toolbar — instead of the view's own
  toolbar. The control keeps working on the same view; only its mount point changes. On
  `destroy()` the disclosure is removed from wherever it was mounted and the target is left as
  found.
- `setViewState()` and the `fieldvisibilitychange` / `fieldorderchange` events are unchanged.

### Also in this section — `CardView`'s sort control

`card-view.js` writes four literals into its markup: `'Sort'`, `'Unsorted'`,
`` `${field.label} (ascending)` `` and `` `${field.label} (descending)` ``. Route them through
`_message()` as `cardView.sort`, `cardView.unsorted`, `cardView.sortAscending` (`'%1
(ascending)'`) and `cardView.sortDescending`.

Replacing that hand-built `<select>` with `SortControl` — which already has `label` and `labels`
options and would fix this for free — is the right eventual move and is **out of scope here**:
it changes the control's appearance and belongs in its own review.

### Validation

Unit: the three `fieldControls` shapes; the label falling back to the message key; `target`
mounting and teardown restoring the target. Demo: one view with the control in the view and one
with it mounted into a toolbar above.

---

## §3 · `Dialog`, `ActivityItem`, and the rest of the untranslatable strings

**File scope:** `src/components/dialog/dialog.js`, `src/components/activity-item/activity-item.js|css`,
and, for the literal sweep only, `src/components/search/search.js`,
`message/message.js`, `tabbox/tabbox.js`, `panel/panel.js`, `card/card.js`,
`value-list/value-list.js`, `timebox/timebox.js`, `launcher/launcher.js`,
`filter/filter.js`, `app-rail/app-rail.js`, `date-picker/date-picker.js`,
`date-picker/month-picker.js`, `date-picker/time-picker.js`, `calendar/calendar.js`.
Tests: `tests/unit/dialog.test.js`, `tests/unit/activity-item.test.js`.

Do **not** edit `app-sidebar` (§7), `table` (§1), or the three view files (§2).

### 3a · `DialogButton.disabled`

```js
/** @property {boolean} [disabled=false] Whether the footer button is disabled. */
```

A form the client cannot render completely must not be submittable, and the control has to
*look* refused as well as behave that way. Today a host reaches into
`.zx-dialog__footer [data-dialog-button]` after `open()` and sets `.disabled` — which is exactly
the kind of private-DOM dependency that breaks on the next release. Honour `disabled` in the
descriptor, in `setButtons()`, and keep `autofocus` from landing on a disabled button. `Sheet`
takes the same descriptors and must get the same behaviour for free.

### 3b · `ActivityItem.state`

```js
state: 'default' | 'pending' | 'failed'   // default 'default'
stateLabel: string | null                  // overrides the built-in word
```

For an entry rendered optimistically before its request resolves, and for one whose send
failed. `pending` sets `aria-busy="true"` on the item and shows a badge reading
`_message('activityItem.pending', 'Sending…')`; `failed` shows
`_message('activityItem.failed', 'Failed')` with the danger kind and **no** `aria-busy`.

The failed state matters as much as the pending one: an entry that silently disappears on
failure tells the customer their message was sent when nobody was told.

### 3c · The literal sweep

Roughly forty user-visible strings across the files listed above go through neither `_message()`
nor an option, so a consumer cannot change them at all. Most are `aria-label` or `title`, which
means the visible damage is small and the **accessibility damage is not**: a German
screen-reader user hears "Clear search", "Close message", "Previous month", "Minimize
application sidebar" in the middle of a German application.

Route each through `_message('<component>.<thing>', '<today's English>')`. Keys are
`<camelCase component>.<camelCase thing>` — `search.clear`, `search.submit`, `dialog.close`,
`message.close`, `tabbox.close`, `panel.actions`, `card.actions`, `valueList.add`,
`datePicker.previousMonth`, and so on. **The English fallback must be byte-identical to
today's string**, so a host that installs no translator sees no change whatsoever.

Add the new keys to `docs/llms.md`'s message-key list only if such a list exists; do not create
one in this WP.

### Validation

Unit: a disabled footer button renders disabled, refuses activation and is skipped by
`autofocus`; each `ActivityItem` state renders its badge and the correct `aria-busy`. For the
sweep, one test asserting that installing a translator changes at least one string in each
touched component is enough — the point is that the seam exists.

---

## §4 · `FilterPanel` — declarative filters from server metadata

**File scope:** `src/components/filter-panel/filter-panel.js|css`,
`tests/unit/filter-panel.test.js`, `website/demos/filter-panel.demo.js`.

### Why

This is the third filter component and the one a data-driven application needs. `DataFilter`
filters a client-side row set. `Filter` is a full AST query builder with groups, operators and
depth limits. Neither is *"here is a map of `{key: {type, label, options, min, max}}` that a list
response published; give me a form, and give me back a query object"* — which is the shape every
ZeyOS list endpoint already sends and every consumer therefore rebuilds.

### Contract

```js
const panel = new FilterPanel(null, {
  fields: {                                  // exactly what a list response publishes
    status: { type: 'select', label: 'Status', options: [{ value: 1, label: 'Open' }] },
    created: { type: 'date:range', label: 'Created' },
    amount: { type: 'float:range', label: 'Amount', min: 0, max: 10000 },
  },
  order: ['status', 'created', 'amount'],    // display order; omitted ⇒ object order
  value: { status: [1] },                    // applied filters, drafted from
  mode: 'draft',                             // 'draft' (default) | 'live'
  serialize: 'seconds',                      // 'seconds' | 'ms' | 'iso' | (date, edge) => unknown
  emptyText: null,                           // shown when `fields` is empty
});
panel.on('apply', ({ detail }) => load(detail.value));   // draft mode
panel.on('change', ({ detail }) => …);                    // live mode, and on every edit
panel.getValue(); panel.setValue(v); panel.reset(); panel.clear();
```

**Types to support**, because these are the ones instance settings produce: `text`, `select`,
`date`, `date:range`, `int`, `float`, `number`, and `int:range` / `float:range` /
`number:range`. An unrecognised type renders a visible, labelled placeholder naming it and is
excluded from the value — never dropped silently, never guessed at.

Five properties learned the hard way in the application and belonging in the component:

1. **A select is multi-valued by default.** "Open or waiting" is the common request; single
   choice turns it into two visits. Build it on `Checklist`, which brings its own search — a
   twelve-value status enum is a lot of checkboxes to read past — and name the group after the
   filter rather than after the component.
2. **Each end of a range needs its own accessible name.** One `<label for>` cannot name two
   inputs, and a group label that names neither is worse than no group label.
3. **Draft-then-apply is the right default** wherever a request is involved. A control that
   applies on change reflows the list under the panel being read, and against an API with a
   custom auth header and no `Access-Control-Max-Age` it costs two round trips per keystroke.
4. **An empty `fields` map is normal, not an error.** An instance that configures no filters for
   a settings section is the ordinary case. Render `emptyText` and say so; never an error state.
5. **`0` is a value.** `''`, `null`, `[]` and `{from: null, to: null}` are not. The emitted value
   contains only active constraints.

`serialize` decides how a date leaves the component, because the answer differs per platform and
is not the application's business to re-derive: `'seconds'` (Unix seconds, the ZeyOS answer) is
the default, and a range's upper bound takes the **end** of its day or a one-day range matches
nothing.

Number inputs use `NumberField`; dates use native `<input type="date">` — the value has to
round-trip through a URL and the platform picker is the one keyboard path nobody has to test.

### Validation

Unit (pure logic, no DOM where possible): active-value detection including `0`; pruning; date
serialisation at both edges for all four `serialize` modes; unknown-type passthrough. Demo:
one panel over a realistic field map inside a `Sheet`, plus the empty-map case.

---

## §5 · `ListToolbar` — the bar above a record view

**File scope:** `src/components/list-toolbar/list-toolbar.js|css`,
`tests/unit/list-toolbar.test.js`, `website/demos/list-toolbar.demo.js`.

### Why

Every list in every application has the same four questions attached to it — what am I searching
for, which records, which columns, in what shape — and the library ships every part (`Search`,
`SortControl`, `badge()`, `button()`, `Toolbar`) and no composition, so every consumer assembles
it differently and most forget the same thing.

### Contract

```js
const toolbar = new ListToolbar(null, {
  search: { placeholder: 'Search tickets…', value: '', debounce: 350 },  // false to omit
  count: null,                                    // number|null, shown as a live status line
  countText: (n) => `${n} results`,               // omitted ⇒ _message('listToolbar.results', '%1 results')
  views: ['auto', 'cards', 'table'],              // [] to omit the shape switch
  view: 'auto',
  tools: [
    { id: 'columns', icon: 'fields', label: 'Columns', badge: '5/6', onclick },
    { id: 'filters', icon: 'filter', label: 'Filters', badge: 2, pressed: true, onclick },
  ],
});
toolbar.setCount(20);            // null clears the line
toolbar.setBadge('filters', 3);  // null removes it
toolbar.setView('cards');
```

Events: `search` (debounced), `viewchange`, `action` (`{id}`).

Three properties that are the point of having this at all:

- **The badge is part of the button's accessible name**, not a second thing to find beside it.
  A tool showing `2` must announce as "Filters (2)". Once filters live behind a panel, a list can
  be showing four rows out of twenty with nothing on screen saying why, and the badge is the only
  thing that prevents a support ticket about missing invoices.
- **The count line is a live region** and `setCount(null)` clears it. The previous number
  describes the previous filters, and a stale count during a load is worse than none.
- **Tool buttons meet the 44 px target.** An icon button sized to its glyph is the control people
  miss twice before hitting once.

`bind(view)` is optional sugar: given a `TableView` or `CardView` it wires the shape switch and,
when that view was constructed with `fieldControls: {target}`, mounts the chooser into the
toolbar. It must work perfectly without `bind()`.

The toolbar composes `Search` and `badge()`; it does not reimplement them.

### Validation

Unit: badge in the accessible name; `setCount(null)` clearing; view cycling through the
configured list only. Demo: a toolbar over a `TableView` with two tools and a live event log.

---

## §6 · `StatTile` — the metric card

**File scope:** `src/components/stat-tile/stat-tile.js|css`,
`tests/unit/stat-tile.test.js`, `website/demos/stat-tile.demo.js`.

### Why

The most-copied snippet in any application UI, and the reason competing template products
advertise a *card count* rather than a component count. The library has `Card`, `Chart` and
`ProgressBar` and no name for a labelled number.

### Contract

```js
statTile({
  label: 'Awaiting acceptance',
  value: 3,                       // number|string; a string is rendered as given
  format: 'number',               // 'number'|'currency'|'percent'|'fileSize'|null|(v) => string
  currency: 'EUR', locale: 'de-DE',
  delta: +2,                      // number|null — rendered with its sign and direction
  deltaLabel: 'vs. last week',
  trend: [1, 2, 2, 3],            // optional sparkline values
  icon: 'ticket',
  kind: 'neutral'|'accent'|'success'|'warning'|'danger'|'info',
  href: '/tickets?status=6',      // makes the whole tile a link
  onclick,                        // or a button
  loading: false,
});
```

Ship the factory `statTile()` and a `StatTile` class beside it, the way `badge()` /
`Badge` and `button()` / `Button` already pair.

Rules:

- **The value is the loudest thing on the tile.** The label is small caps above it, the delta and
  the trend are subordinate to both.
- **A delta is never colour alone.** It carries its sign and an arrow glyph, and "up" is not
  assumed to be good — `deltaKind: 'positive'|'negative'|'neutral'` decides the colour, defaulting
  to `neutral`. Rising ticket counts are not a success.
- **`loading: true` renders a skeleton shaped like the tile**, through `skeleton()`, not a
  spinner.
- The sparkline is inline SVG with `aria-hidden`, and the tile's accessible name is label +
  value + delta. A sparkline nobody can read is decoration and must be marked as such.
- A tile with `href` is an `<a>`; with `onclick` and no `href`, a `<button>`; with neither, a
  `<div>`. Never a div with a click handler.

### Validation

Unit: formatting for each `format` value; delta sign rendering; the accessible name; the three
element shapes. Demo: a row of four tiles in every `kind`, one loading, one with a trend.

---

## §7 · `AppSidebar` — the visual pass

**File scope:** `src/components/app-sidebar/app-sidebar.js`, `app-sidebar.css`,
`website/demos/app-sidebar.demo.js`, `website/layouts/*.layout.js` only where a sidebar is
already used and the change is visual.

### Why

`AppSidebar` is the component every application meets first and the one that decides whether the
product looks finished. It works — expanded and minimized states, rails, flyouts, branch
expansion, a full keyboard map — and it looks like scaffolding: the active item is a flat tint,
the groups have no rhythm, icons and labels do not share a baseline, and the minimized rail loses
the badge that was the item's only unread signal.

**This section is a refinement, not a redesign.** The options, events, methods, DOM structure and
keyboard map stay exactly as they are; consumers must see no API change.

### What to improve

- **The active item.** A filled, rounded pill with a clear inline-start accent marker, correct in
  light and dark and on all six accent presets, and legible at 4.5:1 against whatever it sits on.
- **Rhythm.** One spacing scale for item height, icon gutter, group gap and section headings. The
  icon column is fixed so labels align down the list whether or not an item has an icon.
- **Group headings and dividers** that read as structure rather than as leftover text: small
  caps, muted, with space above rather than a rule wherever a rule is not carrying meaning.
- **Counts and badges** survive minimization — as a dot on the rail if the number cannot fit, with
  the number still in the accessible name.
- **Long labels.** Nav items wrap to two lines rather than truncating. German runs 20–35 % longer
  than English and a fixed-width nav item is where that first shows; "Belege & Rechnungen" is two
  lines at 16.5 rem and must stay readable.
- **Hover, focus and pressed states** that are distinguishable from the active state and from
  each other. `:focus-visible` uses `--zx-focus-ring`; no state may rely on colour alone.
- **Motion** — the flyout, the collapse and the branch disclosure — wrapped in
  `@media (prefers-reduced-motion: no-preference)`.
- **Density.** `compact` is a real density, not a smaller font: it tightens the item height and
  the group gap and leaves the tap target at 40 px minimum.

Semantic tokens only. If a value cannot be expressed in the tier-2 set, that is a finding worth
writing down rather than a reason to reach for a palette token.

### Also in this section — two literals

`'Minimize application sidebar'` and `'Expand application sidebar'` are hard-coded
`aria-label`s. Route them through `_message()` as `appSidebar.minimize` and `appSidebar.expand`.

### Validation

Render `website/theme.html` and check the sidebar in light × dark × cozy × compact × all six
accent presets, expanded, minimized, and as a horizontal rail. Verify the keyboard map is
unchanged: arrows, Home/End, Enter/Space, Escape out of a flyout. No unit test is required for a
visual pass; do not delete the existing ones.

---

## Out of scope for the whole WP

Replacing `CardView`'s sort control with `SortControl`; RTL work; a print stylesheet; a second
chart adapter; a rich-text editor; a shared drag primitive; `Form` × `Stepper` wizard
validation; any change to `src/core/**` beyond adding an icon name that a section genuinely
needs; release packaging; committing.
