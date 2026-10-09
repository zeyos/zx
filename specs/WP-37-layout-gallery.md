# WP37 — Layout gallery and nine application templates

The layouts leave the documentation sidebar and get a page of their own: a gallery of tiles, each
opening its layout in a near-full-screen popup. Beside the eight existing screen patterns, nine
new **application templates** show what a complete product looks like when it is built from Xenon:
mail, an issue tracker, a knowledge base, an AI chat, an invoice editor, an item/inventory record,
a workflow tool, an infrastructure dashboard, and a CRM.

Each template takes its information architecture and interaction model from a well-known product
(listed per section below, **internal only**). It must not take that product's name, logo, colours,
or copy. The point is the opposite of an imitation: nine different products that visibly share one
design language, because they share one design system. Where Xenon cannot express what a template
needs, the template does the decent local thing and its agent reports the gap with a concrete
proposal; those reports become the next work package.

Work in the current checkout. **Do not commit** — this lands in one commit after central review.

## Shared rules

`AGENTS.md` applies in full. Beyond it, for this WP:

- **Centrally owned — do not edit:** `src/**`, `styles/**`, `docs/**`, `dist/**`, `package.json`,
  `README.md`, `CHANGELOG.md`, `website/layouts/kit.js`, `website/layouts/kit.css`,
  `website/layouts/fixtures.js`, `website/layouts/layout-icons.js`, `website/layouts/index.js`,
  `tests/layouts/harness.html`, `tools/shoot-layout.js`. If you need a change there (a missing
  icon, a kit helper, a fixture), work around it locally and list the request in your report.
- Sections run in parallel with disjoint file scopes. Stay inside yours.
- **Do not run** `npm run build`, `build:api`, `build:types`. Only §0 may run `build:site`,
  `tools/check-site.js`, and `test:browser`.
- Validate with `node --test` (not `node --test tests/unit/`) and `node tests/lint-tokens.js`.
  Baseline: **725 passing, 0 failing**; token lint clean.
- **Public content.** Everything under `website/` is published. Never name, quote, or allude to a
  reference product anywhere there — not in titles, copy, data, comments, or class names. No
  internal reasoning, gap notes, or "TODO: Xenon lacks …" comments in public files either; code
  comments explain the code to a reader learning Zx. Gaps go in your final report only.
- Fictional data only, from the shared world in `website/layouts/fixtures.js` (Fieldstone GmbH,
  its staff in `PEOPLE`, its customers in `COMPANIES`, `TODAY` = Thursday 8 October 2026). Add
  domain data in your own module. Domains use `.example`. No real people, companies, or AI model
  brand names.

## The layout module contract

```js
import { … } from '../../src/index.js';
import { disposer, layoutContext, paneHeader, … } from './kit.js';
import { PEOPLE, COMPANIES, person, … } from './fixtures.js';

const MESSAGES = [ … ];           // domain data: module-level declarations, top of the file

export default {
  title: 'Mail',                  // tile and popup title
  category: 'Communication',      // shown on the tile
  blurb: 'One sentence.',         // tile and popup subtitle, no reference product names
  components: ['AppSidebar', 'Launcher', 'Avatar', …],   // Xenon APIs it is built from
  mount(container, context) {
    context = layoutContext(context);
    const keep = disposer(context);
    …
    container.append(root);
  }
};
```

- `context` is `{preview, signal, cleanup}`; always normalise it with `layoutContext()`.
- `mount` appends **one** root: `h('div', { class: '<block> shell' }, …)`. It fills its container.
- **Teardown.** Wrap every component you construct in `keep(…)` so unmounting destroys it — this
  matters: menus, selects, tooltips, launchers, sheets, and dialogs attach to `<body>`, and the
  gallery opens and closes layouts in one page. Factories that return plain elements (`button()`,
  `badge()`, `icon()`, `h()`, `emptyState()`) need nothing. Any listener outside your root uses
  `{ signal: context.signal }`. `tools/shoot-layout.js` fails on anything left behind.
- **Keyboard.** Bind shortcuts with `shortcuts(root, map, context)` from the kit — on the root,
  never on `document`. A `Launcher` gets `shortcut: false` and is opened from your `'Mod+k'`
  binding, so a thumbnail and the open layout never both answer.
- **Preview mode** (`context.preview === true`) is the gallery thumbnail: render the full initial
  state, but no timers, no streaming, no `Launcher`, no toasts, no `focus()` calls.
- **No hard-coded element ids** — a layout can be mounted twice on one page. Use `aria-label`, or
  derive ids from a per-mount counter.
- No `innerHTML`; text goes through `h()`. Format numbers, money, and dates with the Zx formatters
  (`formatCurrency`, `formatNumber`, `formatDate`, `formatRelativeTime`) so every layout formats
  alike.
- The module's source is shown to readers in the popup: write it as exemplary Zx code with JSDoc on
  every function. No `export const`/`export function` at column zero (the source extractor runs
  each top-level declaration through `new Function`, so `import.meta` cannot appear in one
  either); the module exports only `default`.
- Aim for under ~900 lines of JS and ~400 of CSS. Depth over breadth: one main screen that works
  completely beats four that half-work.

## The design language (binding)

The nine templates must look like one product family. Concretely:

1. **Shell.** Root `.shell`; columns `.shell__nav` (navigation), optional `.shell__list` (a
   collection beside the content), `.shell__main`, optional `.shell__aside` (inspector/details).
   Every column opens with `paneHeader()`; its scrolling content is one `.shell__body`. Change
   column widths only through `--shell-nav-width`, `--shell-list-width`, `--shell-aside-width`.
   The kit hides the aside under 1180px of shell width and the nav under 860px; a layout must
   stay usable at 1024×768 and look complete at 1440×900.
2. **Navigation column.** Top: the workspace identity, `.workspace` with a `.workspace__mark`
   ("F") and "Fieldstone". Destinations: **`AppSidebar`** (vertical, expanded) wherever the app has
   destinations. Content collections (a page tree, a chat history) go under a `sectionLabel()` as
   `TreeView` or `.list-row` lists. Bottom: the signed-in user (`Avatar` + name, or `AccountMenu`).
   If AppSidebar cannot express something the reference needs, compose around it and report it.
3. **Headers.** `paneHeader({ title, leading, actions })`. At most **one** `kind: 'primary'`
   button per pane; secondary actions are default `button()`s or `iconButton()`s; overflow goes in
   a `MenuButton` with the `ellipsis` icon.
4. **Type.** `--zx-text-*` sizes only; weights 400 / 600 / 650 / 700; `--zx-font-sans` and
   `--zx-font-mono` only. Page-level titles inside a body (a document title, a record name) use
   `--zx-text-2xl`/`-xl` at 650–700.
5. **Colour.** Semantic tokens only (`--zx-color-*`) — never tier-1 tokens or literals. The accent
   is for the one primary action, selection, focus, active navigation, and links. Status is
   `badge({ kind })` (`neutral|accent|success|warning|danger|info`) and `dot(tone)`.
6. **Spacing and shape.** `--zx-space-*`, `--zx-radius-*`. Pane bodies pad `--zx-space-5`
   (`.shell__body--padded`). Content blocks inside a body are `.surface` (or Zx `Card`/`Panel`).
   No fixed pixel heights for rows or controls — derive from `--zx-control-height` or padding, so
   any spacing a theme sets still works. (Density modes were removed by WP38; there is one
   geometry, and spacing is a theme setting.)
7. **Lists.** Collections are `.list-row` rows (selection via `aria-selected`/`aria-current`, the
   accent bar comes free) or Zx `Table`/`TableView`/`CardView`/`KanbanView`. Group headings are
   `.list-group`.
8. **Records.** Details columns use `propList()`; editable values use the real Zx inputs
   (`Select`, `Select.status()`, `Select.priority()`, `TagPicker`, `Datebox`, `NumberField`, …).
9. **Icons.** `icon(name)` only, from the built-in set plus the shared pack (`iconNames()` lists
   all ~270). Muted in navigation and metadata; colour only where it carries status.
10. **People.** `Avatar` everywhere a person appears (`size: 'sm'` in rows, `'md'` in headers),
    stacked with `.avatar-stack`.
11. **States.** `emptyState()` for empty panes, `skeleton*()` for loading, `InlineLoading` for
    "Saving… → Saved", `Message` toasts for completed actions (not in preview), and
    `Dialog.confirm({ danger: true })` before anything destructive.
12. **Motion.** Only inside `@media (prefers-reduced-motion: no-preference)`.
13. **Interactivity.** Every visible control does something plausible: selecting changes the
    detail, buttons change state or confirm with a toast. No `href="#"` links that move the page.
14. **Copy.** English, sentence case, realistic and short.

### Per-layout CSS

`website/layouts/<id>.layout.css`, already imported by `website/layouts.css`. Every selector
starts with the layout's block class (`.mail …`). No bare element selectors, no `!important`, no
literals, no tier-1 tokens. Reach for kit classes first; add `.<block>__<part>` for the rest.

## Verification (every template)

```
node tools/shoot-layout.js <id> --out <your scratch dir>/shots           # 2 PNGs: light and dark
node tools/shoot-layout.js <id> --out … --preview --themes light
node tools/shoot-layout.js <id> --out … --width 1024 --height 768 --themes light
node tools/shoot-layout.js <id> --out … --themes dark --preset ocean      # another accent
node tools/shoot-layout.js <id> --out … --steps <your steps.mjs>         # drive interactions, shot(name)
```

Look at every screenshot (Read the PNGs) and fix what looks wrong. The tool must report **no
PROBLEM lines** — no page or console errors, no failed requests, nothing left on `<body>` after
unmount. Then `node --test` and `node tests/lint-tokens.js`. Do not use the shared browser pane;
the screenshot tool runs its own headless Chrome on a private port.

## Report (your final message)

1. **Built** — screens and states, interactions, the keyboard map.
2. **Components used** — which Xenon APIs, for what.
3. **Gaps** — for each: the Xenon component (existing or proposed); what this layout needed and
   could not do decently; a concrete proposal (options/methods/events, behaviour, a11y pattern);
   the local workaround now in the layout; priority (high/medium/low). Be specific and honest —
   this is the most valuable part of the report.
4. **Central requests** — anything you needed in the kit, fixtures, or icon pack.
5. **Verification** — the screenshot tool's output, test counts.

---

## §0 · The gallery page

**File scope:** `website/layouts.html`, `website/layouts.js`, `website/layouts.css` (keep the
`@import` block at its top exactly as it is; add below it), `website/layouts/patterns.css` (new),
`website/docs.js`, `website/docs.css`, `website/docs.html`, `website/index.html`,
`website/theme.html`, `website/site.js`, `website/site.css`, `website/README.md`,
`website/llms.txt`, `tools/check-site.js`, `tools/build-site.js`, `tools/run-smoke.js`,
`AGENTS.md` ("Layout examples" section only), new `tests/unit/layout-gallery.test.js` if you
extract pure logic. Do **not** edit any `*.layout.js`/`*.layout.css`.

### Page

- `layouts.html` shares the site header and footer of `docs.html`; the header's "Layouts" link
  points here on every page and is marked current here.
- An intro (title "Layouts", one short paragraph), then two sections from the registry in
  `website/layouts/index.js`: **Application templates** (`TEMPLATE_IDS`) and **Screen patterns**
  (`PATTERN_IDS`). A text filter over title, blurb, category, and components is welcome.
- **Tiles** in a responsive grid. Each tile: a live thumbnail, the title, the blurb, the category,
  and the components used as small chips (a few, then "+n"). The whole tile is one button whose
  accessible name is the title.
- **Thumbnails** are the real layout mounted with `preview: true`, lazily (when the tile nears the
  viewport), rendered at a fixed 1440×900 and scaled to the tile's width; `inert` and
  `aria-hidden`. The eight patterns predate the context contract and ignore it — that is fine.
- **Popup.** A near-full-screen Zx `Modal`/`Dialog`/`Sheet` (your choice; inset ~16–24px, full
  screen on small viewports). Its header: title, category, blurb; actions: **Source** (the module's
  own text read-only, with a copy button — `CodeEditor` read-only if it suits), a cozy/compact
  density switch scoped to the popup, and close. Its body mounts the layout with
  `preview: false` and a fresh context; closing aborts the signal, runs the cleanups, empties the
  stage, and returns focus to the tile. A subtle `Aurora` behind the stage, as the docs frames had.
- The eight patterns render a `.layout-frame`; inside the popup it must fill the stage (no fixed
  height, no frame border/radius).
- **Routing.** `layouts.html#<id>` opens that layout on load; opening sets the hash, closing
  clears it (`history.replaceState`), Back closes. Unknown ids are ignored.

### Moving out of the docs

- Move the layout CSS out of `docs.css` ("layout examples" through the "ZeyOS invoices layout"
  section, and their responsive rules) into `website/layouts/patterns.css`, imported from
  `layouts.css` right after `kit.css`. Check first that no component demo still uses a class you
  move.
- `docs.js`: drop the Layouts section from the sidebar and the registry; import the ids from
  `./layouts/index.js`; keep layouts in the global documentation search with
  `href: 'layouts.html#<id>'`; redirect `docs.html#layouts` and `#layouts/<id>` to the gallery
  (`location.replace`). Remove code that only served layout pages.
- `docs.html` guides, `index.html`, `theme.html`: links and copy point at `layouts.html` (no more
  "eight layouts"). `site.js`: current-page detection for the new page.
- `tools/check-site.js`: read the layout ids from `layouts/index.js` (`TEMPLATE_IDS`,
  `PATTERN_IDS`) and verify every module and stylesheet exists; require `layouts.html`; and fail
  if any published file names a reference product — case-sensitive: `Superhuman`, `linear.app`,
  `Docmost`, `TypingMind`, `easybill`, `ERPNext`, `Frappe`, `rhythms.ai`, `NetBox`, `Attio`.
- `tools/build-site.js`: only if the new files need it (e.g. the Chart.js path in
  `layouts/kit.js`, which uses `new URL('../../node_modules/chart.js/dist/chart.umd.js',
  import.meta.url)` — confirm the flattened site resolves it to `vendor/chart.umd.js`).
- `tools/run-smoke.js`: add a gallery check — the page loads with 17 tiles and no console errors;
  every layout opens from its hash, renders a `.shell` or `.layout-frame`, closes on Escape with
  focus back on its tile, and leaves `<body>` with no more children than before.
- `AGENTS.md` "Layout examples" and `website/README.md`: describe the gallery, the registry, the
  module contract, the kit, and `tools/shoot-layout.js`.

The nine templates are being built while you work; until they land, their modules are stubs. A
failure that is clearly inside a template is not yours — note it and move on.

---

## §1 · Mail — `mail`, block `.mail`, category "Communication"

*Reference (internal): Superhuman.* Keyboard-first, fast, minimal chrome; triage is the job.

- **Navigation:** Compose (primary, full width, hint `C`); Inbox (count), Starred, Snoozed, Sent,
  Drafts, Done, Scheduled; a "Labels" section (Customers, Finance, Engineering, Recruiting).
- **List column:** split-inbox tabs at the top (Important · Other · Customers · Team, with counts);
  dense rows — sender (bold when unread), subject and snippet, label chips, time; on hover/focus,
  row actions for Done (E), Snooze (H), Star (S).
- **Main:** the open conversation — subject, labels, participants; earlier messages collapsed to a
  line, the latest expanded; an inline reply composer (Reply/Reply all/Forward, Send with
  Mod+Enter, "Send later" menu).
- **Aside:** the sender — Avatar, role, company, email, recent threads with them.
- **Snooze:** a menu of presets (Later today, Tomorrow, Next week) plus a date picker.
- **Compose:** a `Sheet` with To (`TagPicker` of contacts), Subject, body, Send.
- **Command palette:** `Launcher` on Mod+K with commands and contacts.
- **Keyboard:** J/K next/previous, Enter or O open, Esc back, E done, S star, H snooze, R reply,
  A reply all, F forward, C compose, / search, Mod+K commands, Mod+Enter send.

## §2 · Issue tracker — `issue-tracker`, block `.tracker`, category "Product"

*Reference (internal): Linear.*

- **Navigation:** search, New issue (hint `C`); Inbox (count), My issues; "Workspace" (Projects,
  Views); "Your teams" — Engineering (ENG) and Design (DES), each with Issues, Cycles, Projects.
- **Main — list:** header "Engineering › Issues" with view tabs (All issues · Active · Backlog) and
  actions (filter, display options, list/board switch). A filter row. Issues grouped by status
  (In progress, Todo, Backlog, Done, Canceled) under `.list-group` headers with counts and an add
  button; rows: priority, key (ENG-142), status, title, label chips, assignee avatar, date.
  Board view: `KanbanView` by status.
- **Issue:** opening an issue shows title, description, sub-issues, and an activity stream
  (comments and property changes) with a comment composer; a properties aside — Status, Priority,
  Assignee, Labels, Project, Cycle, Estimate, Due date — every value editable with a real Zx input.
- **Create:** C opens a `Dialog`: title, description, and property chips.
- **Keyboard:** J/K, Enter open, Esc back, C create, S status, P priority, A assignee, L labels,
  X select, Mod+K commands. Right-click a row for a `ContextMenu`.

## §3 · Knowledge base — `wiki`, block `.wiki`, category "Product"

*Reference (internal): Docmost.*

- **Navigation:** search (Mod+K), Home, Settings; a space switcher (Engineering, Operations,
  Handbook); a "Pages" section with an add button over a `TreeView` of nested pages; Favorites.
- **Main:** header with a `Breadcrumb` of the page path, who is viewing (avatar stack), Share,
  an Edit/Done toggle, and an overflow menu (History, Export, Move, Delete). The body is a centred
  reading column: title, "Last edited by … · 2 days ago", then real document content — headings,
  paragraphs, a callout, a checklist, a table, a code block, an image placeholder, a mention.
- **Aside:** "On this page" outline that follows scrolling and jumps on click; page details
  (created, updated, contributors); comments.
- **Editing:** Edit switches the page to an editable state (Xenon has no rich-text editor — choose
  the most decent option, e.g. Markdown in `CodeEditor` beside a live preview) and Done returns.
  New page adds "Untitled" to the tree and opens it for editing.
- **Keyboard:** Mod+K search pages, E edit, Mod+Enter or Esc done, [ / ] previous/next page.

## §4 · AI chat — `ai-chat`, block `.chat`, category "Communication"

*Reference (internal): TypingMind.* Fictional, brand-free model names only.

- **Navigation:** New chat (primary); search chats; history as `.list-row`s grouped Today,
  Yesterday, Previous 7 days, Older; folders/pinned; the user and settings at the bottom.
- **Main:** header with a model `Select` and the chat title (renameable), share/export/more.
  The thread: user and assistant messages, assistant content with paragraphs, a list, a code block
  with a copy button, a table; per-message actions (copy, regenerate, edit, rate). A composer
  pinned at the bottom: auto-growing textarea, attach (file chips), prompt library ("/"),
  parameters, Send (Enter) that becomes Stop while generating. Sending streams a canned answer
  (instantly under reduced motion; never in preview).
- **Aside:** assistant settings — system prompt, temperature (`Slider`), max tokens
  (`NumberField`), tools (`Toggle`s: web search, code execution), knowledge files (`FileList`).
- **Keyboard:** Enter send, Shift+Enter newline, Esc stop, Mod+K search chats, / focus composer,
  ↑ in an empty composer edits the last message.

## §5 · Invoice editor — `invoice-editor`, block `.invoicing`, category "Finance"

*Reference (internal): easybill.* German small-business invoicing; EUR; 19 % and 7 % VAT.

- **Navigation:** Dashboard; Documents — Invoices (active), Quotes, Credit notes, Delivery notes;
  Customers; Products; Payments; Reports.
- **Header:** "Invoices › RE-2026-0142", a Draft badge, Save draft, Preview, **Finalize & send**
  (primary — a `Dialog` with recipient, subject, message, the PDF as an attachment chip),
  overflow (Duplicate, Download PDF, Delete with confirm).
- **Editor** (left of a `SplitView`): customer (`Select` over `COMPANIES` with the address shown),
  contact; number, invoice date, service period (`DateRangeBox`), payment terms, PO reference;
  intro text; **positions** with `Grid.BillingItems()` (article, quantity, unit, unit price, VAT,
  discount, total; add from a product search); totals — net, VAT per rate, gross; closing text.
- **Preview** (right): a live A4 page — letterhead, both addresses, meta block, the positions,
  totals, and a footer with Fieldstone's bank and tax details — updating as you edit, with zoom.
- **Keyboard:** Mod+S save, Mod+Enter finalize, Mod+P toggle preview.

## §6 · Item & inventory — `item-inventory`, block `.inventory`, category "Operations"

*Reference (internal): ERPNext / Frappe desk — the Item form and its stock dashboard.*

- **Navigation:** Stock — Items (active), Stock entries, Warehouses, Purchase receipts, Delivery
  notes, Stock ledger; Reports — Stock balance, Projected quantity; Masters — Item groups,
  Suppliers, Units.
- **Header:** `Breadcrumb` (Stock › Items › SKU-2048), the item name with an Enabled status,
  previous/next record, a Create `MenuButton` (Purchase order, Stock entry, Material request),
  Save (primary, Mod+S) with "Not saved" / `InlineLoading` state.
- **Record:** a side column (image placeholder, tags, assigned to, attachments, followers); a
  dashboard strip of `StatTile`s (in stock, reserved, projected, valuation) and stock per warehouse
  (`Table` with quantity bars); **Connections** (purchase orders, sales orders, stock entries,
  quality inspections — counts that link); a `Tabbox`: Details, Inventory (valuation method,
  shelf life, reorder levels per warehouse — editable rows), Purchasing (suppliers, lead times),
  Sales (price lists); then the activity timeline.
- **Actions:** "New stock entry" `Dialog` (receipt/transfer/issue, warehouse, quantity) updates
  the numbers and the timeline; editing any field marks the form dirty.

## §7 · Workflows — `workflows`, block `.flow`, category "Operations"

*Reference (internal): rhythms.ai — an operating system for a team's recurring rhythms: planning,
check-ins, reviews, approvals, with an assistant that drafts and summarises.* Look at the
reference's public site for its information architecture before you design.

- **Navigation:** Home, My tasks (count), Check-ins; "Workflows" — Weekly business review,
  Month-end close, Customer onboarding, Quarterly planning; Insights; Settings.
- **Main:** the selected workflow — name, schedule ("Every Monday at 09:00"), owner, Active
  `Toggle`, Run now. Tabs: **Builder · Runs · Insights**. Builder shows the workflow as a vertical
  flow of step cards joined by connectors — trigger, automated step, assigned step, approval,
  condition, assistant summary — with an add button between steps (step-type menu). Runs: a table
  of runs with status, duration, on-time; the current run's progress. Insights: `StatTile`s
  (on-time rate, average cycle time, overdue steps) and a chart.
- **Aside:** the selected step's configuration — name, type, assignee, due offset, conditions,
  assistant instructions, notifications.
- **Assistant:** an inline suggestion card ("Approvals waited 2.4 days on average — move the
  finance approval before …") with Apply / Dismiss.

## §8 · Infrastructure — `infrastructure`, block `.infra`, category "IT"

*Reference (internal): NetBox — a DCIM/IPAM source of truth — with a monitoring dashboard on top.*

- **Navigation:** Dashboard (active); Organization (Sites, Locations, Tenants); Racks (Racks,
  Elevations); Devices (Devices, Device types, Platforms); Connections (Cables, Interfaces); IPAM
  (Prefixes, IP addresses, VLANs); Virtualization (Clusters, Virtual machines); Circuits; Power.
- **Dashboard:** header with a site filter (All sites · FRA1 · BER2 · AMS1), time range, refresh.
  A widget grid of `.surface`s: object counts (`StatTile`s), device status (`Chart` doughnut),
  prefix utilisation (rows with utilisation bars), a rack elevation (a 42U rack, devices as blocks
  coloured by status, hover for details), recent changes (`ActivityList`), open alerts with
  severity, uplink bandwidth (`Chart` line). The site filter re-renders the widgets.
- **Devices:** a second working view — `TableView` with filters (site, role, status, platform),
  status badges; a row opens the device in the aside (properties, interfaces, rack position).
- Charts: load Chart.js with `loadChartJs()` from the kit; take colours from computed semantic
  tokens so both themes work.

## §9 · CRM — `crm`, block `.crm`, category "Sales"

*Reference (internal): Attio.*

- **Navigation:** search (Mod+K); Notifications, Tasks (count), Notes, Emails, Reports;
  "Records" — Companies (active), People, Deals; "Lists" — Enterprise pipeline, Partnerships,
  Renewals Q4.
- **Companies:** header with saved-view tabs (All companies · Customers · Prospects · + view),
  Import, **New company**. A toolbar: sort, filter, Table/Kanban switch, search, count. A
  spreadsheet-like table: company (square logo initials + name), domain, categories (chips), team
  (avatar stack), connection strength, ARR, last interaction, owner — with type icons in the
  headers, inline cell editing, row checkboxes, and a bulk-action bar when rows are selected.
- **Record:** opening a company shows its page — header (logo, name, domain, categories; Compose
  email, Add to list, favourite), tabs (Overview, Activity, Emails, Notes, Tasks, Files, with
  counts); Overview highlights (next meeting, open deals with stage and value, connection
  strength, ARR) above an activity timeline. Aside: **Record details** — every attribute editable
  in place with the matching Zx input — and list memberships with their stage.
- **Deals** as a `KanbanView` by stage with column value totals.

---

## Harmonization (central review)

The first pass produced nine good layouts that did not yet read as one product: five ways to build
the navigation column, four toast mechanisms, four date styles, the same Zx components patched four
different ways. The kit now carries the shared pieces; every template adopts them and deletes its
local equivalent. Binding for all templates:

1. **Toasts.** `const notify = toaster(context, root)` once; every toast is `notify(text, kind)`.
   No local wrappers, no bare `Message.*`, no own `Message` instance. Undo content goes in
   `h('span', { class: 'toast-action' }, …)`. A control whose screen is not built here:
   `notify(unavailable('Calendar'), 'info')`; a destination that is not built:
   `unavailablePane(title, { label: 'Back to …', onclick })`.
2. **Navigation column**, always in this order:
   `h('div', { class: 'shell__nav' }, workspaceHeader(), h('div', { class: 'nav-action' }, primary?, navSearch?), h('div', { class: 'shell__body' }, …groups), h('div', { class: 'shell__footer' }, accountMenu))`.
   - The primary action is Zx `button({ kind: 'primary', icon, label, shortcut: { label: 'C', keys: 'C' } })` (upper-case key labels).
   - Every template with a `Launcher` has `navSearch({ label, onclick })` (and `'Mod+k'` bound to the same handler); templates without one have no search here.
   - AppSidebar always sits inside the column's `.shell__body`. Groups that are always open are `sectionLabel(label, actions?)` + one AppSidebar each; parent items only for genuinely collapsible trees.
   - The footer is `AccountMenu` with `secondary: person(ME).role` (not the email); the kit flattens its trigger.
   - Width: the kit default (248px). No `--shell-nav-width` overrides.
3. **Columns.** `h('section', { class: 'shell__main', 'aria-label': … })`;
   `h('aside', { class: 'shell__aside', 'aria-label': … })` at the default 320px, or
   `shell__aside shell__aside--wide` (352px) for a record's editable details. No width overrides.
   Headings in asides use the default levels.
4. **Time.** `NOW` from `fixtures.js` is the only "now"; no local copies. Relative times are
   `formatRelativeTime(date, { now: NOW })`, list times `listTime(date)`, every other date one of
   the kit's `DATE` formats (`short` 9 Oct · `year` 9 Oct 2026 · `long` 9 October 2026 ·
   `dateTime` Fri 9 Oct, 09:00 · `time` 09:00 · `day` Friday 9 October). No hand-written relative
   strings in data — store dates and derive the text.
5. **Ownership.** Components in redrawn regions go through the kit's `renderScope(context)`; every
   other component through `keep()`. No local scope helpers, no unowned instances. Timers go
   through `later(context, fn, ms)`.
6. **Keys.** Hints use `modifierLabel()` / `modShortcut(key, glyph)`; Mod+Enter shows `↵`
   (`modShortcut('Enter', '↵')` → ⌘↵ / Ctrl+↵). Icon buttons with a shortcut:
   `iconButton(name, label, onclick, { shortcut })`; keys never go in accessible names. Mod+Enter in
   a text area: `shortcuts(textarea, { 'Mod+Enter': submit }, context)`.
7. **Menus and header order.** Icon-only menu triggers are
   `new MenuButton(iconButton('ellipsis', 'More actions'), { kind: 'ghost', items })`. Header
   actions run `[status, …secondary, primary, more]`.
8. **Shared classes replace local copies** — delete the local rule when you adopt one:
   `.visually-hidden`; `.shell__tabs` on a Tabbox that divides a pane (`tabs.el.classList.add('shell__tabs')`)
   and the kit's quiet tab counts; Datebox / DateRangeBox / NumberField filling a `.prop-list__value` or
   `.zx-field__control`; the kit's `.prop-list` columns; `.shell [hidden][hidden]`; `.shell__body`
   focus styles; the pressed look of plain toggle buttons; `.star-toggle`; `.link-button`;
   `.bulk-bar` + `.bulk-bar__count`; `.segmented` + `.segmented__item` (`role="radiogroup"` /
   `role="radio"`, `aria-checked`, arrow keys) + `.segmented__count`; `.shell__body--board`;
   `.person` + `.person__name`; `.record-title` (`--sm`); `panelBlock(title, …)`; and
   `h('div', { class: 'form-sheet' }, …)` around a form in a Dialog, Sheet, or tab panel.
9. **Components.** Tabbox `variant: 'line'` for record and collection tabs. `InlineLoading` with
   `size: 'sm'`. Avatars `size: 'sm'` in rows — no numeric sizes. `Dialog.confirm` names its
   action (`okLabel: 'Delete company'`). Numbers with `formatNumber`, percentages with
   `formatPercent` ("92%", no space, in data too). Charts take `chartPalette()`, `chartOptions()`,
   `watchTheme()` and `allowsMotion()` from the kit.
10. **Metadata.** `components` lists Zx classes only (PascalCase), the three most distinctive
    first — not AppSidebar/AccountMenu, which every template has. Blurbs stay under ~110
    characters and use the template's own words.
11. **Comments** that explained a workaround for a rule the kit now covers go with the rule.
