# Changelog

Notable changes to `@zeyos/zx`. The format follows [Keep a Changelog](https://keepachangelog.com),
and the project follows [semantic versioning](https://semver.org).

Releases before this file existed are summarised from the git history; `git log v2.0.1..v2.0.2`
and friends remain the complete record.

## Unreleased

## 5.0.0 — 2026-10-09

Xenon now has one geometry and a quieter finish. The cozy and compact view modes are gone; in their
place is a single, slightly tighter default whose spacing, corners, and control height are tokens a
product sets once. On top of it the visual language was refined against how well-made business
applications look today: "where you are" is a neutral fill rather than a block of accent colour,
status colours no longer borrow the brand green, chrome and canvas separate by tone instead of by
lines, labels are sentence case at medium weights, and icons are outlines.

The other half is what building twenty complete screens on the library asked of it. A layout
gallery of application templates and screen patterns — mail, an issue tracker, a knowledge base, AI
chat, an agent workspace, invoicing, inventory, workflows, infrastructure, CRM, and the screens
inside them — every one usable from a phone to a wide screen and clean under an accessibility
audit. Fixing what those screens found: some forty component defects, status colours that read as
text, nested dark themes, and focus that never falls to the page. And what they needed: motion as
a reader's setting, a command palette with pages, toasts that carry their action, busy buttons,
type-to-confirm, and public status and priority glyphs.

### Breaking

- **Form field keys are no longer element ids.** Control ids are generated per Form and Fieldset
  instance (`<idPrefix>-<key>`; `idPrefix` makes them predictable), so a form mounted twice repeats
  no id and a key such as `stage` never collides with `#stage` elsewhere. The key stays the field's
  `name`, the native control's `name`, and its `data-field-id`; radio groups are named after the
  control id. Code that looked a control up by `#<key>` reads `form.getField(key).controlId` (or
  queries `[data-field-id="<key>"]`) instead. An explicit `id` that differs from the key is used as
  given, and the legacy compatibility layer keeps key ids.
- **Density modes are removed.** `data-zx-density` (`cozy` | `compact`) no longer has any effect,
  `styles/tokens/density.css` no longer ships, and no component carries density-specific rules.
  Migration: drop the attribute. To tighten an application — or one region of it — set
  `--zx-space-unit` and `--zx-control-height` instead, for example
  `:root { --zx-space-unit: 3.5px; --zx-control-height: 28px; }`, which is close to what compact
  used to do without shrinking the type.
- **`FileItem`'s `density` option is now `identitySize`** (`'sm'|'md'|'lg'`, the size of the
  file's icon and name), and `FileList` items take the same name. The word now means one thing
  nowhere in the library.

### Changed

- Every toast pauses while it holds focus as well as hover, resumes when neither applies, and
  returns focus to where it came from if it closes while focused.
- Sheet slides on `--zx-ease-drawer`; KanbanView's drag preview and grabbed card take
  `--zx-drag-shadow`. A solid primary button's pressed step is darker than its hover step.
- Launcher `select` and `error` details carry `page`; closing the launcher returns it to its root.
  The status and priority glyph styles are `.zx-status-icon` and `.zx-priority-icon` (Select's
  glyphs keep their old classes as well).
- **`Select.priority()` reads by height, not hue**: levels are four grey signal bars filled to the
  level in muted ink, and only the highest is coloured — a danger square with "!". It offers "No
  priority" (value null, message `priority.none`) at the head of the list; `clearable: false`
  restores the old list, a required priority field leaves it out, and the legacy compatibility
  select keeps its old list unless it allows empty values. Values and message keys are unchanged.
- **Quiet NumberField** start-aligns its value with the quiet values around it; both steppers sit
  at the trailing end, shown on hover or focus.
- **Field `type: 'html'`** draws no input frame; display content keeps a control's height.
- **Toggle labels** start-align and wrap like text, the track level with the first line; a field
  beside a taller one keeps its label and control at the top of its cell.
- **FileItem** shows a readable type ("PDF", "Image") instead of the MIME type and picks its icon
  from the MIME type when the icon set has one.
- **AppSidebar** creates its own root as a `<div>` (the `<nav>` inside is the landmark), so it no
  longer adds an unnamed complementary landmark; `getItems()` leaves out empty `children`.
- **Table** puts `data-column` on every header and body cell in every mode; **KanbanView**
  assignee faces take Avatar's tint from the name (or a descriptor `tone`); the neutral soft
  **Badge** is a wash of the text colour, visible on raised dark surfaces, and a small dotted
  Badge has 12px text and a 4px gap.
- **ZeyOS enums read as labels** ("Invoiced", "Partly paid") in generated tables and forms; a
  schema `{value, label}` is used as given. **ZeyOS date-only fields are calendar days** — indexed
  `date`, `duedate`, `birthdate`, `datefrom`/`dateto` outside appointments and events, `datecancel`,
  and `lastbilling` show no time and are stored as midnight in the instance's zone (`timeZone`,
  default the browser's); `lastmodified` and the appointment, event, comment, record, and
  document-version timestamps are date-times.
- **Spacing derives from one unit.** `--zx-space-1` … `--zx-space-8` are multiples of the new
  `--zx-space-unit` (4px by default, so the steps are unchanged at 4–40px).
- **Corners are smaller and proportional.** `--zx-radius` is now `4px`, and `-sm`, `-md`, `-lg`,
  and `-xl` are ×0.5, ×0.75, ×1, and ×1.5 of it — 2 / 3 / 4 / 6px, down from 3 / 5 / 7 / 11px — so a
  theme that scales the base keeps every step in proportion. `--zx-control-radius` still follows
  `-lg`. Panels that used `-xl` (Launcher, Sheet, the AppSidebar and AppRail items) use `-lg` or
  `-md`; ValueList chips and record-card metadata chips are no longer pills, and the SortControl
  direction button is a control rather than a circle.
- **Controls are 30px tall** (`--zx-control-height`, from 32px). `--zx-control-pad-x` stays 10px
  and text sizes are unchanged.
- **Structured menus are tighter.** AppSidebar rows are one control tall (from control + 8px) with
  2px between rows, 12px between groups, and a 3px corner. A text-only child starts under its
  parent's label; a child with its own icon steps in 16px, just clear of the guide line, instead
  of a whole icon column. The rail flyouts follow. TreeView indents 12px per level (from
  18px) with a 4px block padding per row. MenuButton, ContextMenu, Select, TagPicker, Launcher,
  Finder, Checklist, and the Table column menu share one row: 4px × 8px padding, the smallest
  radius, panels at `--zx-radius-lg`, and section labels no taller than an item.
- **"Current" is neutral, and nothing is docked to an edge.** Where you are — the active
  navigation item (AppSidebar, its rails and flyouts), the open TreeView node, the current Finder
  column entry, the active tab in every Tabbox variant, the pressed ListToolbar view, the current
  Calendar view, Launcher app and Pagination page — is a neutral `--zx-color-bg-current` fill with
  the text colour at weight 600; the edge marker beside the active item is gone. What you have
  *picked* (checked rows, chosen options, a multi-selection) keeps the accent tint. A rail item
  whose flyout holds the active route takes the accent colour. Forced colours still use the
  system's selected pair.
- **One solid accent per screen.** Solid accent is for the primary button; tab underlines, pressed
  toggles, and decorative icons no longer use it. In dark, the primary button sits on the accent
  600 step with white text (`--zx-color-accent-solid` / `--zx-color-on-accent-solid`) instead of
  the bright 400 step.
- **Status green is its own colour.** `--zx-green-*` is a yellow-green status ramp that no longer
  matches the default ZeyOS accent, so a "success" badge or chart segment never reads as branding.
  The brand values moved to `--zx-emerald-*`, which the default accent points at.
- **Dark theme is layered.** Page, chrome, surface, raised, and overlay steps sit off near-black
  (#1b1b1e → #313136), primary text is about 90% white, and borders are translucent white.
- **Quieter type.** Decorative upper-case and letter-spaced labels are gone from every component
  (menu and Select groups, Launcher groups, StatTile labels, Calendar weekdays, Table headers, …);
  row and label weights moved from 600 to 500, titles to 600–650, and UI text is set with
  `--zx-tracking-tight` and Inter's `cv11`. Field labels and Fieldset legends are small, medium, and
  muted, so values lead.
- **Tables** drop the header band (muted medium labels on the surface), divide rows with
  `--zx-color-border-subtle`, and set numbers in tabular figures.
- **Avatars** fall back to a colour picked from the name (one of eight tones) with no ring, at
  24 / 32 / 40px, and show one initial below 24px.
- **StatTile** labels are sentence case, values 24px tabular, the icon is a muted glyph without a
  coloured chip, and tiles in a row line up whether or not they carry a sparkline.
- **EmptyState** draws its icon in `--zx-color-text-subtle` and its title semibold.
- **Danger is legible as text.** Light `--zx-color-danger` moves to the 600 step and the dark
  danger tint is lighter, so danger ink keeps 4.5:1 on every surface and on its own tint, as the
  other status colours do (now tested for all four in both themes and every preset).
- **The dark selected tint is lighter** (13% of the accent instead of 18%), so muted text on a
  checked row or chosen option keeps 4.5:1 under every preset (now tested, light and dark).
- **Toasts lose their coloured leading-edge bar**; the kind shows in the icon and a tinted border,
  as everywhere else nothing is docked to an edge.
- **Button key hints** are quieter by colour and weight instead of opacity, which left them below
  4.5:1 on a solid primary button.
- **Select.entity** shows an entity without a colour as a neutral tile with a muted glyph; before,
  the glyph was white on the pale accent tint and could not be seen.
- **Icons are Lucide outlines.** The bundled set renders as strokes in `currentColor` (ISC; a
  1.75-unit stroke per 24 that never thins below 1px), with every existing name kept. Bundles keep
  the licence notice. A chosen Rating star is drawn solid.
- **The theme studio's Density section is now Spacing**: a slider for `--zx-space-unit` (3–6px).
  The radius slider sets `--zx-radius` in pixels (0–10px), the standard recipes carry a spacing
  unit instead of a density, Copy CSS exports the unit, and a theme saved by an earlier studio
  still loads.

### Added

- **Motion as a setting.** `data-zx-motion="reduced"` on any element stops motion inside it: the
  duration tokens become `0ms` and a base rule stops CSS animations and transitions, while state
  changes still apply; the system preference zeroes the tokens too. `prefersReducedMotion(element)`,
  `watchMotion(element, fn, { signal, immediate })`, and `MOTION_ATTRIBUTE` let script follow it;
  Chart passes `reducedMotion` to its adapter and `ChartJsAdapter` turns animation off under it.
- `--zx-ease-spring` (a small overshoot) and `--zx-ease-drawer` (a decisive ease-out) beside
  `--zx-ease`, and `--zx-drag-shadow` for an item being dragged.
- **Launcher pages.** An item with `items` (an array, or a loader `(query, { signal })`) opens a
  nested page: a scope chip in the input, Backspace, ArrowLeft, or × to go back, "⌫ Back" in the
  footer, `open({ page })`, `back()`, `getPage()`, and a `page` event. Items take a `hint` (muted
  text at the end of the row), `shortcut` key caps, and `keys` for `aria-keyshortcuts`.
- **Message `action`** (`{ label, onclick, kind }`, a small button that runs and closes the toast;
  a toast with an action stays at least 8 seconds) and **`leading`** (a node such as an Avatar in
  place of the kind icon).
- **`Dialog.confirm({ confirmText })`** — type-to-confirm: a labelled input that has focus, and a
  confirm button and Enter that work only on an exact match.
- **Busy buttons.** `button({ busy })` and `setButtonBusy(button, busy)` show a spinner in place of
  the icon, set `aria-busy`, and ignore activation while the action runs — but keep the button
  focusable, so focus does not fall to the page as it does from a disabled button.
- **`statusIcon(status)` and `priorityIcon(level)`**, the glyphs `Select.status()` and
  `Select.priority()` draw, for lists, boards, and filters; decorative unless given a `label`.
- `idPrefix` on Form and Fieldset; Field `name`, `field.name`, and `field.controlId`.
- Checklist `hideLabel`; TagPicker `toneKey` (default `'tone'`), colouring a tag the way a Badge
  `tone` does; ActivityList `variant: 'compact'` for cards narrower than 30rem; Table column
  `ariaLabel` for a blank or terse header; FileItem `typeLabel`; `Dialog.prompt` `okLabel` and
  `cancelLabel`.
- `MenuButton.open({ returnFocus })` (also on `focusFirst()` and `focusLast()`) and
  `Message.disposeRegion(scope)`.
- ZeyOS: `zeyosTable` passes Table options through (`variant`, `zebra`, `stickyHeader`,
  `responsive`, `growing`, `emptyText`, `rowClass`, `rowKind(s)`, the column chooser, and the Table
  listeners; editing, row reordering, and hierarchy stay out because the binding never persists
  them); `timeZone` and per-field `formats` on `zeyosTable`, `zeyosForm`, `zeyosView`, and
  `resolveFields`; `unixSecondsToCalendarDay()` and `calendarDayToUnixSeconds()`; `zeyosForm`
  `scope` and `notify`.
- **Colour roles:** `--zx-color-bg-current`, `--zx-color-bg-chrome`, `--zx-color-border-subtle`,
  `--zx-color-text-subtle`, the categorical tones `--zx-color-tone-{blue,teal,green,amber,orange,
  red,pink,violet,slate}-{bg,fg}`, and the chart series `--zx-color-chart-1` … `-8`, whose first
  series is deliberately not the accent. Contrast is tested in both themes and all six presets.
- **Type tokens:** `--zx-text-3xl` (30px), `--zx-weight-medium`, `--zx-weight-semibold`,
  `--zx-tracking-tight`, `--zx-tracking-title`.
- **Quiet fields:** inside any `[data-zx-fields="quiet"]` container, native fields and Select,
  TagPicker, Datebox, DateRangeBox, NumberField, and Timebox show their frame only on hover and
  focus — property panels read as data, not as a wall of boxes.
- `Table` / `TableView` `variant: 'plain'` (no frame, no header band) for tables inside cards;
  `badge({ tone })` with the categorical tones (and `BADGE_TONES`); `Avatar` `tone`, `avatarTone()`
  and `AVATAR_TONES`; `StatTile` `caption`, read with the value.
- `registerIcons()` accepts outline glyphs as `[viewBox, path, 'stroke']`; `[viewBox, path]` pairs
  still render filled.
- `Tabbox` `label`, the tab list's accessible name.

### Fixed

- A destructive `Dialog.confirm` started focus on the destructive button; it starts on Cancel, the
  least destructive choice (type-to-confirm starts in its input).
- On a phone, toasts covered the header's controls; they rise from the foot of the screen there.
- A ghost Button showed no focus ring: its `box-shadow: none` outranked `:focus-visible`.
- Select's loading spinner never turned (it read an undefined duration token).
- The Launcher's search row could push its close button off a narrow screen.
- A `[data-zx-theme="dark"]` region on a light page inherited light glass, overlays, hover and
  current fills, tone tints, and focus ring: colours derived from other theme colours were resolved
  on `:root` only. They are restated on every theme element now; geometry overrides on `:root`
  still reach nested regions.
- Overlays (Dropdown, Tooltip, MenuButton, ContextMenu, Modal, Dialog, Sheet, Launcher) created before their
  anchor or scope was in the document parked their panel on `<body>`, outside the theme scope; they
  find their host on first open.
- Choosing a MenuButton item dropped focus to `<body>`; it returns to the trigger. CodeEditor
  trapped the keyboard; Escape then Tab leaves it, as documented.
- Floating Message regions kept sending toasts into an emptied host and were never removed.
- Table and Grid number and date editors select their content on entry (typing "6" over "1.00"
  gives 6); sortable headers use the same font as the others; no scrollbar gutter is reserved on a
  table that does not scroll; a blank header has an accessible name. TreeView type-ahead calls
  `preventDefault` and leaves text controls in rows alone.
- Table's selection checkboxes and row-reorder handles sit in the middle of their cell. They rode a
  few pixels high on the text baseline, and the cell padding pushed them off the centre of their
  control-height column, in a fixed layout past its edge.
- NumberField, Datebox, and DateRangeBox fill a Field's control column; clear-button padding is
  reserved only when `clearable`, and a disabled Datebox or DateRangeBox shows no clear button.
  Slider end labels stay inside the component. A Checklist inside a Field no longer repeats its
  heading.
- `colorKey` on `Select.entity()` and TagPicker accepts token references (`var(--zx-…)`). Clicking a
  read-only Select no longer draws the keyboard focus ring; a disabled Select fades like a disabled
  Field; a read-only TagPicker shows only its tags.
- `collapsible: false` still showed AppSidebar's minimise button. copyButton's status line and
  CopyInput's hidden label were positioned outside their control.
- A Field whose adapter returns a wrapper (a `custom` field holding a component) named the
  wrapper, which cannot carry a name; its label, description, and validity now reach the first
  unnamed form control inside it, or the adapter's new `labelTarget`.
- Launcher ran an item's command before closing, so closing put focus back on an element the
  command had just redrawn or moved focus away from; it closes first now.
- A MenuButton's menu had no accessible name; it is labelled by its trigger, as the APG pattern
  has it. NumberField no longer swallows Mod+Enter (and other chords), so a form or dialog's submit
  shortcut works from a number field. Datebox and DateRangeBox were 2px taller than the text input
  beside them; every control is one control height.
- A Tooltip placed beside an anchor near the edge of the screen squeezed to a word per line
  instead of moving: it now takes the other side, or goes above or below when neither side fits.
- A Chart in a narrow card overflowed it (its 220px minimum height became a 587px minimum width
  through the aspect ratio); it grows taller instead. A StatTile delta keeps its figure on one line
  in a narrow tile.
- `zeyosTable` showed a due date as a date-time whose hour moved with daylight saving, and
  `zeyosForm` edited it as one; `zeyosForm.save()` raised its toast wherever focus was.
- The AccountMenu trigger rendered as a centred, boxed card because `menu-button.css` loaded after
  `account-menu.css`; it is a flat row again.
- CodeEditor referenced `--zx-color-bg-subtle`, which never existed.
- The Marque Gold preset's accent text now reaches 4.5:1 on the light chrome tone.
- A sortable end-aligned Table column put its header label at the start, away from its figures;
  the label now sits at the end with the sort arrow before it.
- ActivityItem's heading read the actor and title as one word ("Jonas Weberset…") to assistive
  technology; a space now separates them.
- Table's Columns chooser, RecordView's Fields chooser, KanbanView's undo and redo, and Filter's
  actions used a `zx-button` class no stylesheet defines, so they rendered as bare browser buttons;
  they are small Zx buttons now (ghost in toolbars, primary for Apply).

### Website

- The application layouts moved from the documentation sidebar to a gallery of their own
  (`layouts.html`), with a live thumbnail per layout, a near-full-screen view with its source, and a
  standalone page (`layout.html#<id>`) for opening one in its own tab. Nine complete application
  templates join the eight screen patterns, which are rebuilt on the same application shell.
- The documentation, gallery, and theme studio share the library's look: navigation on the chrome
  tone, neutral current entries, sentence-case labels, hairline example cards, and code and API
  tables drawn like the refined Table.
- New in the gallery: an **agent workspace** template — agents with live presence, editor tabs, a
  plan and execution log with hand-offs, approvals as toasts that carry their action, a command
  palette with pages, a bottom panel, and a status bar — and two screen patterns, **agent chat**
  (tool calls, an approval that blocks the run, sources, and the run beside the thread) and
  **system states** (every empty, loading, error, validation, and confirmation state, with a
  switch to go offline). The AI chat template shows its work: tool steps, sources, artifacts with
  versions, regenerate and branch, and `@agent` mentions.
- Every layout works from a phone to a wide screen: below 1180px the inspector and below 860px
  the navigation become drawers, and on a phone a layout shows its list or its record with a way
  back. All seventeen pass an accessibility audit — named controls and landmarks, text contrast,
  visible focus, heading order — in both themes, wide and narrow.
- The theme studio has a Motion setting (System or Reduced), kept across the whole site as a
  reader's preference, and a Button states card showing every kind in every state.
- The site self-hosts Inter as a variable font (SIL OFL), so every weight renders as designed and no
  font request leaves the site.
- The theme studio offers more to build from. Eleven neutral tints — Neutral, Zinc, Stone, Cool,
  Mist, Sage, Olive, Warm, Taupe, Mauve, and Accent — are picked from swatches of the ramp each
  would produce, and a strength control scales any of them from grey to twice its colour; every
  tint keeps the text roles legible at full strength. The typeface list grows from six system
  stacks to eleven, drawn in their own type, plus a custom stack for a brand font, and the code
  font (`--zx-font-mono`) is a choice of its own.
- Themes can be saved and loaded as JSON. Export writes a `zx-theme` file — the settings, plus the
  custom properties they produce — to copy or download; Import takes one pasted, dropped, or chosen,
  loads it even when a value is out of range or unknown, and says what it adjusted.

## 4.4.0 — 2026-09-22

A large release in two halves. The first adds capability: a dependency-free code editor, the
record primitives (`EntityRef`, `FileItem`/`FileList`, `ActivityItem`/`ActivityList`), kanban
movement and workflow policy, and richer action menus. The second is what building a real
application on the library found missing — group rows, list controls, a filter panel driven by
server metadata, a metric tile, and the long tail of strings a translated product could not
reach.

Nothing here is a breaking change. Every new option defaults to the previous behaviour, and every
English string a translator can now reach keeps its exact previous wording when no translator is
installed.

### Added

- **Structured text no longer requires an editor dependency.** `CodeEditor` keeps source in a
  native textarea with browser undo and IME behavior, adds Tab/Shift+Tab indentation, language
  metadata, line/column feedback, read-only and disabled states, and a `code` Form field adapter.
  It never executes or injects the value; rich HTML authoring remains a separate policy surface.
- **Reusable record primitives cover dense identity, files, and activity.** `EntityRef` presents
  linked or static identity with labelled metadata and injected actions; `FileItem`/`FileList`
  cover durable, temporary, waiting, progress, MIME, size, download, loading, and empty states;
  `ActivityItem`/`ActivityList` cover actor, time, content, attachments, actions, stable grouping,
  and incremental feed updates. Zx owns safe presentation and cancelable interaction boundaries;
  applications retain routing, authorization, transport, posting, reactions, and persistence.
- **Action menus now carry business metadata without becoming free-form popovers.** MenuButton and
  ContextMenu share headings, object separators, safe native links, descriptions, badges,
  shortcuts, text/Node adornments, and checked/radio menu-item roles. Existing flat items and
  `'-'` separators are unchanged.
- **Kanban cards carry the anatomy an operational board needs.** New read-only projections put an
  `entityIcon` and `identifier` on a card head beside `status` and `priority` indicators, and a
  `progress` meter and `assignees` avatars on a card footer. `priorityTones` and `statusTones` map
  a value to a semantic tone as data rather than through a renderer, `progressMax` sets the
  completion scale explicitly, and `maxAvatars` bounds the avatar stack. A board that sets none of
  them renders exactly the card it rendered in 4.3.4.

- **`FilterPanel` — typed filters from server metadata.** Takes the `{key: {type, label,
  options, min, max}}` map a list endpoint already publishes and returns a query object. Ten
  field types including both range forms, multi-valued selects on `Checklist`, draft-then-apply
  by default, and `serialize` for the Unix-seconds / ISO / epoch-ms question. `DataFilter`
  filters a client-side row set and `Filter` builds an AST; this is the third shape, and the one
  a data-driven application needs.
- **`ListToolbar` — the bar above a record view.** Search, a live result count, a view switch and
  badged tools. A tool's badge is part of its accessible name rather than a second thing beside
  it, `setCount(null)` clears the live region during a load, and `bind()` feature-detects a
  `TableView`/`CardView` instead of importing it.
- **`StatTile` / `statTile()` — the labelled metric.** Formats through the core formatters, never
  encodes "up is good" (`deltaKind` decides the colour, not the sign), marks its sparkline
  `aria-hidden`, and picks `<a>` / `<button>` / `<div role="group">` from the behaviour it was
  given rather than wrapping a click handler round a div.
- **`Table` group and section rows.** `rowKind` and `rowKinds` render a `<th scope="colgroup">`
  spanning every rendered cell, including the selection and reorder columns. `CardView` has had
  `groupBy`; `Table` had nothing, while `Grid.BillingItems()` already modelled the row kind for
  editability and simply never drew it. Sort controls are withheld while a spanning row is
  present, because sorting a grouped table scatters its positions out of their sections.
- **`ActivityItem.state`** — `pending` and `failed`, for an entry rendered optimistically before
  its request resolves and for one whose send failed. An entry that disappears on failure tells
  the reader their message was sent when nobody was told.

### Changed

- **The move handle is no longer pointer furniture.** Since 4.3.4 the card itself is the drag
  source, so the knob is decoration that competes with the card's content. The new
  `moveHandle: 'keyboard' | 'always'` defaults to `keyboard`: the button stays in the DOM, in tab
  order, and fully announced, but is clipped out of sight and out of the layout until it takes
  focus or holds a grabbed card. `always` restores the 4.3.4 presentation, and `dragFrom: 'handle'`
  keeps the handle visible regardless, since it is then the only thing a pointer user can grab.
- **An empty column now reads as a drop target.** `labels.columnEmpty` defaults to
  "Drop a card here" in a dashed zone instead of an empty gap; `labels.columnEmpty: ''` restores
  the previous blank column, and `renderColumnEmpty` still replaces it.
- **A field the card head or footer projects no longer repeats itself as a metadata row.** Set
  `duplicate: true` on the field descriptor to show it in both places.

- **`fieldControls` accepts `{label, target}`** on `TableView`, `CardView` and `KanbanView`.
  `true`/`false` are unchanged. The chooser's trigger can now be named, and mounted into a host
  toolbar instead of the view's own — which is what made it usable in a translated product at
  all.
- **`DialogButton.disabled`**, honoured by the constructor, `setButtons()` and per-view buttons,
  and skipped by `autofocus`. `Sheet` inherits it. A form a client cannot render completely must
  not be submittable, and until now the only way to show that was to reach into the rendered
  footer.
- **Roughly ninety-six user-visible strings across sixteen components now route through
  `_message()`**, which falls back to `translate()` — so installing a host translator is enough.
  Most are `aria-label` and `title`, which is the half that does not show up in a screenshot: a
  German application previously announced "Clear search", "Close message" and "Previous month" in
  the middle of its own chrome, with no option to prevent it. Every English fallback is
  byte-identical to the previous literal.
- **`Launcher` and `Filter` label options default to `null`** and resolve through the translator,
  so an application that installs one and passes no labels gets a translated component. The
  rendered words are unchanged without a translator.
- **`AppSidebar` visual pass.** A filled active pill with an edge marker and a weight change, so
  nothing rests on colour alone; one spacing scale; a fixed icon gutter that collapses when no
  item has an icon; labels that wrap and hyphenate rather than truncate; badges that survive
  minimization as a dot with the number still in the accessible name. Options, events, methods,
  DOM and the keyboard map are unchanged.
- **`NavigationBar` overflow is configurable.** `overflow: false` keeps every item at every
  width; `overflowBelow` moves the collapse threshold; `minVisible: n` pins the first `n` items.
  Defaults are unchanged — every item still collapses below 44 rem through the same container
  query, with no observer installed. Collapsing all of a navigation into one button is right for
  a top app bar and wrong for a phone bottom bar, and there was no way to say so.
- **A print stylesheet ships.** `styles/print.css`, imported last, releases sticky headers and
  scroll containers, drops fills, shadows, zebra striping and focus rings, hides overlays and
  navigation chrome, repeats table headers across pages, keeps cards and rows from breaking, and
  prints link URLs in prose but never inside a table cell or on a button. Status badges keep
  their colour, because there it carries meaning beside the word. An application that sets
  `data-zx-theme="dark"` explicitly still prints dark text tokens; `auto` is unaffected.

### Fixed

- **Context-menu selection could not be cancelled.** Preventing its `select` event now suppresses
  the item callback and native link navigation and leaves the menu open, matching MenuButton.
- **The keyboard move handle could take focus while staying invisible.** It revealed itself on
  `:focus-visible`, which does not match after pointer input — so the focus a committed pointer
  drop moves onto the handle landed on a one-pixel control. It now reveals on `:focus`, and
  `dragFrom: 'handle'` keeps the handle visible regardless of `moveHandle`.
- **A literal indicator descriptor rendered nothing.** `priority: {label: 'Blocked'}` was read as
  a record property name and resolved `undefined`.
- **A blank progress label produced an unnamed progressbar.** An empty or whitespace label now
  falls back to the localized default instead of becoming `aria-label=""`.
- **A fractional `maxAvatars` hid every face** while the overflow chip still counted from the raw
  option. The faces and the chip now come from one normalization.
- **The card identifier named itself with `aria-label` on a `<span>`**, which the generic role
  prohibits. Identifier and indicator prefixes are visually hidden text instead.
- **An assignee with an image but no name rendered an unidentifiable face.** Entries without a
  name are now dropped rather than announced as "Assigned to ".
- **Board rendering rebuilt the whole field-descriptor array for every axis read.** A string
  column or lane accessor was resolved through `getFields()` — which clones every descriptor —
  once per record per column per lane. Descriptors are now indexed once per refresh.

- **`Modal` and `Dialog` place and restore focus.** Both have always built a native `<dialog>`
  and opened it with `showModal()`, so focus containment, page inertness, Escape and the top
  layer were the platform's — a reading of the source that greps for a focus trap and finds
  none draws the wrong conclusion, and one did. What was genuinely missing is now there:
  initial focus lands on the first focusable control inside the panel rather than on the panel,
  focus returns to the opener on every close path including the non-native presentation, and
  `aria-modal` is set while modal. `Sheet` keeps its own trap for the non-modal case and is not
  double-trapped. Candidates inside a `hidden`, `aria-hidden` or `inert` subtree are now skipped,
  so a dialog whose close button is suppressed focuses its first real control instead of nothing.
- **`icon()` no longer throws on a name it cannot resolve.** Icon names routinely arrive from a
  server, and one unconfigured name should not take down the screen it appears on. An
  unresolvable inline glyph renders an empty `<svg>` of the requested size — so layout does not
  shift — carrying `data-zx-icon-missing="<name>"`, and reports itself once per distinct name.
  `icon(name, { strict: true })` keeps the old `RangeError` for callers that can afford to fail.
  Font Awesome paths are unaffected: a kit resolves names in the browser, so nothing under one
  is "unknown" here and nothing warns.
- **The minimized rail's flyout matches the expanded sidebar.** The visual pass in this release
  could not reach it — the panel is portaled into a `Dropdown`, so the sidebar's descendant
  selectors do not apply to it. It now carries the same spacing scale, icon gutter, wrapping
  labels and active-item treatment, derived from the same tokens. Fixing it surfaced a cascade
  bug: `app-rail.css` is imported before `dropdown.css`, so the popover's own padding had never
  won and the panel had been rendering with the generic overlay's.
- **One physical-direction declaration** remained in the component tree (`table.css`), plus four
  asymmetric box shorthands that pin an edge physically. All are logical now, and a test scans
  for both so the state is enforced rather than accidental.

## 4.3.4 — 2026-08-31

### Added

- **Kanban boards became workflow boards.** `KanbanView` now moves cards by pointer, touch,
  keyboard, context menu, and public API through one policy and one commit path.
  - **Pointer and touch dragging.** Native HTML5 drag-and-drop is replaced by Pointer Events, so
    the same code path serves mouse, pen, and touch. A drag from the card body needs a small
    travel (or a long press on touch, so the board still scrolls); a drag from the move handle
    starts immediately. A floating drag preview follows the pointer, the board and any scrollable
    column auto-scroll near their edges, and Escape aborts without moving anything.
    `dragFrom: 'card' | 'handle'` chooses the drag source.
  - **Atomic multi-card moves.** Picking up a card that belongs to the current multi-selection
    moves the whole selection as one step, preserving relative order — one `recordmove`, one
    policy decision, one history entry. `moveRecords(ids, destination)` is the public form.
  - **Enforceable workflow policy.** Columns gain `laneLimits`, `wipPolicy`, and a `from`
    transition allow-list; lanes gain `limit` and `from`. The board-level `wipPolicy` still
    defaults to `'warn'`, and `'block'` refuses a move before the cancelable event. Every refusal
    announces its reason and emits the new cancel-free `movereject` event.
  - **Ordered card rules.** `rules` marks cards with an inline tone marker, badges, and an
    accessible description, so a rule is never communicated by colour alone.
  - **Undo and redo** of committed local moves, with `undo()`, `redo()`, `canUndo()`, `canRedo()`,
    `clearHistory()`, a bounded `historyLimit`, the `historychange` event, optional toolbar
    controls, and Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z on the board.
  - **Board search and filtering.** `search`, `searchFields`, `filter`, `setSearch`, `setFilter`,
    an optional built-in search control, and the `searchchange` event. Hidden records keep their
    position in the data, so a card dropped between two visible cards lands between them.
  - **Replaceable presentation.** `renderCard`, `renderColumnHeader`, `renderSwimlaneHeader`,
    `renderColumnEmpty`, and `renderDragPreview` replace content while the board keeps the managed
    shell: list item, selection control, action group, move handle, drop targets, and collapse
    control never change hands.
  - **Card context menu, per-column scroll regions, and an add affordance.** `contextMenu` offers
    move commands filtered by the same policy path, `columnHeight` turns each column into its own
    scroll region, and `allowAdd` emits `recordadd` for the application to act on.
  - **A complete `labels` map**, so every visible and announced string can be translated without
    patching the component.

## 4.3.3 — 2026-08-26

### Changed

- **Kanban boards use a lighter rail hierarchy.** The board and columns no longer stack filled,
  bordered panels around every lane. Compact headers, quiet semantic WIP counts, wider rail gaps,
  and restrained card radii make record cards the primary surfaces while preserving horizontal
  scrolling, empty drop targets, swim lanes, and every existing interaction.
- **Calendar grids use square structural edges.** The outer calendar, day headings, and time slots
  align as one continuous grid, while the view picker becomes a compact segmented control with a
  raised active view.
- **Floating messages keep severity visible on glass.** Toasts use a coloured leading inset over
  the shared overlay material and retain deterministic severity backgrounds when transparency is
  reduced or unsupported.
- The public landing page and Theme Studio no longer duplicate documentation search in their
  headers. Dated 4.3 promotional sections were removed from the landing page and documentation
  introduction, and the landing hero typography was rebalanced around the simplified header.

## 4.3.2 — 2026-08-26

### Added

- **Shared card field slots.** A visible field may opt into the shared record-card anatomy with
  `view.card.slot: 'eyebrow-start' | 'eyebrow-end' | 'title-prefix'`, producing a semantic eyebrow
  row or labelled content immediately before — but outside — the title heading and primary link.
  Absent, malformed, and unknown slots fall back to ordinary labelled metadata, and field
  visibility and order remain authoritative.

### Changed

- **CardView and KanbanView read as collections, not documents.** CardView clamps titles to two
  lines, keeps previews at thumbnail scale, and renders visible fields as compact metadata chips.
  Kanban columns use a stable 20rem rail with native horizontal overflow, compact headings and
  counts, tighter card padding, an optional square thumbnail, and move/action controls that reveal
  on hover, focus, selection, or grab while staying visible on touch. Both views keep the same
  markup, semantics, and delegated interaction hooks.
- The landing page hero is lit by the shipped `Aurora` component rather than a bespoke gradient,
  and gains a "Latest release" band covering Calendar, the record views, Aurora, Sheet and Dock,
  the glass materials, and application identity.
- The documentation Introduction gains a "New in 4.3" section linking the newest component pages.
  Aurora stays documented through its supported component examples and API reference; the
  standalone showcase route is no longer part of the public site.
- The landing page now carries documentation search, restores the ZeyOS copyright identity in the
  shared footer, and transitions its initially transparent navigation to the established glass
  material after scrolling, with reduced-motion and reduced-transparency fallbacks.
- Public site and package assembly now exclude non-product contributor material and design audits,
  with release checks that reject private paths in deployable output.

### Fixed

- **Calendar month and year paging no longer overflows a month-end anchor.** From 31 January,
  `next()` reached 3 March and skipped February entirely; from 31 March, `prev()` landed back
  inside March, so the button appeared dead. Both steps now clamp the day of month into the target
  month via the new `calendarPageDate()` / `addCalendarMonths()` model helpers.
- `Calendar.updateEvent()` honours the configured `dateUnit` again. It normalized without it, so a
  numeric `start`/`end` change was read as milliseconds on a calendar configured for Unix seconds.
- The Calendar toolbar no longer overlaps itself. The end-justified view/new controls kept their
  min-content width inside a narrower `1fr` track and bled back over the centred heading, hiding
  the first view button; the heading is now the only elastic track and ellipsizes instead.
- Kanban announces a reached or exceeded work-in-progress limit with the move it belongs to, and
  keeps focus on a collapse control across a board refresh — including when a programmatic
  collapse hides the card that had focus.
- Kanban preserves saved order and collapse preferences for data-derived columns and swim lanes
  when state is restored before asynchronous records arrive. Canceling the bubbling
  `zx-recordmove` event now vetoes the move, and a manual local move clears a conflicting local
  sort so serialized state matches visible order.
- Selectable record cards retain valid list-item semantics with a global selection description,
  and preview media no longer accepts local `file:` URLs.
- The four system-architecture cards on the landing page align their links again, and ~60 lines of
  dead `.release-band`/`.release-notes` site CSS with no remaining markup were removed.
- Documentation search no longer collides with primary navigation: responsive headers move the
  centered field to its own row before their chrome can overlap.

## 4.3.0 — 2026-08-26

### Added

- **Scoped top-layer ownership.** Dropdown, Modal, Dialog, Sheet, Launcher, and floating Message
  regions accept an optional `scope` context and otherwise resolve the opener's nearest Zx theme
  scope. Native popovers and dialogs still use the browser top layer, while material, density,
  product-token, and nested-theme inheritance remain intact.

### Changed

- **Liquid glass is now a real overlay material.** Compact overlays and reading panels use
  separate translucent bases, restrained specular and Aurora-response layers, blur/saturation,
  shadows, borders, dividers, and interaction-state tokens. Menus, Select, TagPicker, date
  popovers, tooltips, table column controls, and Toast use compact glass; Launcher, Modal, Dialog,
  and floating Sheets use the calmer reading material. Docked Sheets remain opaque.
- **Theme Studio makes optical differences visible.** Its overlay specimen now sits on a
  multicolour Aurora field, while Flat, Glass, and Deep glass expose materially different alpha,
  refraction, and elevation in both light and dark themes.
- **Accessible material fallbacks are deterministic.** Reduced-transparency, increased-contrast,
  forced-colour, and unsupported-filter environments remove reflection and backdrop effects and
  restore solid surfaces; blurred Sheet backdrops follow the same rule.

### Fixed

- Toast intent colours no longer turn the surface effectively opaque, modal backdrops no longer
  erase the content meant to refract through the panel, scoped modals lock page scrolling again,
  and DatePicker controls no longer tile the owning surface's reflection gradient.
- Floating non-modal Sheets now remain viewport-anchored inside transformed or clipped theme
  scopes, and generation-aware lifecycle handling prevents queued close events from invalidating
  a reopened Sheet during rapid dock/release handoffs.
- Documentation search now consumes the same compact overlay material, interaction states, and
  accessibility fallbacks as library popovers; fallback tokens cover every supported theme scope.
- Calendar drag operations preserve the grabbed time/day offset, resize previews track their
  proposed duration, pointer capture is resilient, and agenda/month layouts keep their event and
  day controls aligned across desktop and mobile views.

## 4.2.0 — 2026-08-26

### Added

- **Calendar scheduling.** `Calendar` adds agenda/day/week/month/year views, local-time collision
  and spanning layout, range selection, now/loading states, and pointer plus keyboard move/resize.
  Optimistic updates are the default with an idempotent version-guarded rollback; setting
  `optimistic: false` leaves updates application-controlled. The optional ZeyOS adapter maps
  expanded appointment occurrences and Unix seconds while recurrence, DAV, and persistence remain
  outside core.
- **Shared record views.** `TableView`, `CardView`, and `KanbanView` use one schema-friendly field,
  data, sort, selection, loading, and versioned view-state contract. Tables can expose accessible
  column ordering; cards support safe preview media and grouped responsive layouts; Kanban boards
  add columns, swim lanes, WIP indicators, and cancelable pointer/keyboard moves in local or
  application-controlled mode. The optional ZeyOS binding derives fields and projections from an
  injected client without making validation, permissions, or routing core concerns. Its optional
  saved-view registry persists named Table/Card/Kanban state by user, workspace, and resource
  through an injected atomic transport; a compatibility adapter reuses ZeyOS's existing
  `userfields` endpoints without trusting a client-supplied user identity.
- **Aurora surfaces.** `Aurora` adds a dependency-free, one- to four-colour ambient-light layer
  with six geometries, bounded palettes and intensity, CSS-only composition, and deterministic
  reduced-motion, reduced-transparency, and forced-colour fallbacks. The documentation includes a
  live application composition and examples for all six supported geometries.

### Changed

- Liquid-glass recipes now distinguish compact floating overlays from reading-sized panels and
  apply consistently to menus, pickers, tooltips, column controls, toasts, Launcher, Modal,
  Dialog, and overlay Sheets. Docked Sheets remain opaque.
- The documentation search is narrower at desktop widths, and Avatar now appears under Layout.
- **Application identity now has one deliberate shape language.** `zeyosAppIcon()` and application
  destinations in Launcher/AppSidebar use quiet circular chromatic lenses with crisp centred white
  glyphs; `moduleChip()` remains a low-radius tile for entities, nested destinations, and records.
  Per-icon blur and hover movement were removed, while rim/light/shadow feedback and material-mode
  differences remain visible without changing geometry.

### Fixed

- AppIcon now preserves native button/link semantics when enhancing an interactive target, forwards
  ZeyOS badge and selection state, ignores hover on disabled destinations, and uses forced-colour
  system values for badges.
- The AppSidebar example no longer replaces AppIcon's internal surface, so collapsed rails retain
  the same material, focus, selection, and accessibility behavior as expanded navigation.

## 4.1.1 — 2026-08-25

### Changed

- **Material recipes are visibly distinct.** Flat, Glass, and Deep glass now resolve shared
  semantic tokens consumed by application icons, buttons, raised cards, and transient messages;
  reduced-transparency and forced-colour environments retain opaque accessible fallbacks.
- **Theme Studio documents the material system.** Its component showcase now includes the shared
  AppIcon and raised-surface treatments, and explains which component families consume them.
- **Application identity is more consistent.** ZeyOS AppIcons use centred white glyphs, a tighter
  corner radius, CSS-only depth, and explicit hover and focus feedback across module colours.

### Fixed

- AppIcons without badges no longer append a visible `null` text node, preserving exact glyph
  centring and clean accessible output.

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
