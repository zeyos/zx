# WP48 — Row actions and section links

WP45 added the reveal utility to `styles/base.css`: inside a `[data-zx-reveal-host]`, an element
marked `[data-zx-reveal]` rests invisible and appears on hover, on focus within, while the host is
current or selected, and while it holds an open menu. It keeps its space and its tab order, and it
is always visible without a hovering pointer, under a contrast preference and in forced colours.
WP45 listed "row actions as API" as a follow-up, because today every layout applies the utility by
hand, and the two components that draw rows people act on — `TreeView` and `AppSidebar` — have no
way to carry per-row actions at all. A page tree in the wiki cannot offer "Add sub-page" on the row
it belongs to; a heading in a document has no link to itself.

This WP turns the utility into component API: `rowActions` on TreeView, `actions` on AppSidebar
items, and copy-link anchors on prose headings. Quiet chrome must not cost discoverability or
keyboard access: every hidden action is also in the row's context menu and in the Tab order.

Work in the current checkout, on top of WP45–47. **Do not commit**: this lands after central
review. `AGENTS.md`, the WP40 design rules, WP42 (every touched layout from 390px to 1440, clean
under `tools/audit-layout.js`) and WP45 rule 8 apply. `src/core/**` is **not** in scope.
`CHANGELOG.md` is central: report changelog lines instead of writing them; `npm run build:api`
regenerates `docs/api.json`. Public files (source comments, demos, docs) must not mention this
spec or any other internal material; `tools/check-site.js` enforces it.

## Review: what the code does today

- **TreeView** (`src/components/tree/tree.js`) renders a flat list of `role="treeitem"` rows with a
  roving tabindex; the row's accessible name comes from its content (label and badge). Clicks,
  double-clicks and keys are handled on the root; any click in a row focuses and selects it, and
  any key on a row is read as tree navigation or type-ahead. There is no context menu.
- **AppSidebar** (`src/components/app-sidebar/app-sidebar.js`) renders each destination as a
  native `button` or `a` directly inside its `li.zx-app-sidebar__row`; every destination is a Tab
  stop, and the arrow keys move between them. A *section* already takes `actions` — trailing
  controls beside its heading (`appendSlot`), always shown. A destination takes none. The
  stylesheet relies on `.zx-app-sidebar__row > .zx-app-sidebar__item` in four places.
- **Prose** is a stylesheet only (`styles/prose.css`). Headings carry `scroll-margin-block-start`,
  but nothing links to them.
- **Layouts:** the wiki's "New page" beside the Pages label is the only revealed control
  (`sectionLabel(…, { reveal: true })` in `kit.js`). The wiki's page actions live only in the
  header's "More" menu and act on the open page; the mail layout's labels have no actions.

## Decisions

1. **One action model, two hosts.** A row action is `{icon, label, onSelect, disabled?, danger?}`
   or a `Node` (a control of the application's own, placed as given). TreeView asks for them per
   node with `rowActions(node)`; an AppSidebar destination lists them in `actions`. Both build the
   row through one internal module, `src/internal/row-actions.js`, so the two can never drift.
2. **At most two controls per row.** One or two actions show as icon buttons. With more than two,
   the first stays an icon button and the rest fold into an overflow `MenuButton` (the `dots`
   glyph). A `Node` entry is never folded: it always stays in the row, in order.
3. **The row is the reveal host; the action strip is revealed.** The row gets
   `data-zx-reveal-host`, the strip `data-zx-reveal`, so the base utility decides visibility —
   hover, focus within, current, selected, an open overflow menu, and always under `(hover: none)`,
   `prefers-contrast: more` and forced colours. Components add no visibility rules of their own,
   except AppSidebar's current row (below), whose `aria-current` sits on the control, not the host.
   Space is kept: the label never runs under the strip. This is decided, not provisional: in a
   narrow tree the labels truncate sooner at rest (the strip costs about two controls' width), and
   that is preferred over a strip that overlays the label while revealed, because a revealed
   control never hides part of the name of the row it acts on.
4. **Names say which row.** Every action control's `aria-label` is `"<action>: <row name>"`
   ("Add sub-page: Release checklist"), and the overflow is `"<moreLabel>: <row name>"`. The
   `title` tooltip is the action alone. Action labels are the application's own text; the one
   string the components add, the overflow's name, is a plain option (`moreLabel: 'More
   actions'`), as TreeView's `label` and `emptyText` are, because the English message catalogue
   lives in `src/core/messages.js`, which this WP does not touch. Moving it into the catalogue is a
   follow-up.
5. **Keyboard: the tree stays a tree.** TreeView keeps the APG treeview map unchanged. The action
   controls of the row that holds the tree's tab stop are Tab stops (`tabIndex = 0`); every other
   row's are `-1`. Tab from the focused row therefore walks its actions and then leaves the tree;
   Shift+Tab walks back to the row. Keys pressed on an action belong to that control (Enter,
   Space, the overflow's arrows), never to the tree; clicks on an action neither select nor focus
   the row. Focusing an action (pointer or keyboard) makes its row the tree's tab stop without
   moving focus. AppSidebar does the same with its own model: each destination stays a Tab stop,
   and only the actions of the row holding focus are Tab stops.
6. **The context menu is the other way in.** A component with row actions attaches one
   `ContextMenu` to the rows (right-click, Shift+F10, the Menu key) listing every descriptor
   action of the row it opens on, with `danger` and `disabled` carried over. Choosing an item
   closes the menu, returns focus to the row, and then runs `onSelect`, so a dialog the action
   opens records the row as its opener.
7. **The treeitem keeps its own name.** A row with actions names itself with `aria-labelledby` on
   its label (and badge), so the action labels never join the row's name.
8. **Section links copy, they do not navigate.** `proseAnchors(root)` gives every `h2`–`h4` that
   has an `id`, inside a `.zx-prose` under `root`, a trailing `<a href="#id">` (`link-2` glyph,
   `"Copy link to <heading>"`). A plain click copies the page URL with that hash (current URL, hash
   replaced) and confirms in place — the glyph becomes a check for two seconds and a polite live
   region says "Link copied" — without changing the location, so an application's own hash
   routing is untouched. A modified or middle click is left to the browser. The heading is the
   reveal host. Headings without an `id` are left alone: an id is the author's decision, and a
   generated one would break when the heading is edited.

## §1 · Shared row-action module

**Scope:** new `src/internal/row-actions.js`, new `tests/unit/row-actions.test.js`.

- `planRowActions(entries)` → `{inline, overflow}` (pure): drops entries that are neither a `Node`
  nor a descriptor with a `label` and an `onSelect` function; applies decision 2.
- `rowActionLabel(action, name)` (pure): `"<action>: <name>"`, the action alone without a name.
- `menuEntries(descriptors)` (pure): maps descriptors to `ContextMenu`/`MenuButton` items
  (`{label, icon, danger, disabled, value: index}`).
- `renderRowActions(entries, {block, name, moreLabel, run})` → `{element, actions, menu, destroy}` or
  `null` when nothing is left: a `span.zx-<block>__actions[data-zx-reveal]` holding
  `button.zx-icon-btn.zx-<block>__action` per inline descriptor (its icon at the default
  `ICON_SIZE.control`), the given nodes, and the overflow trigger
  (`.zx-<block>__action.zx-<block>__more`). Every control starts at `tabIndex = -1`.
  `onSelect(node)` runs on click; the overflow's items run it after the MenuButton's own focus
  return. `destroy()` destroys the MenuButton.
- `setRowActionsTabbable(element, tabbable)` sets the tab stop of every focusable inside a strip.
- `rowActionMenu(target, selector, resolve)` attaches the row `ContextMenu` of decision 6.
- Unit tests: the plan for 0–4 descriptors, with nodes among them, and invalid entries; the label
  format; the menu mapping keeps `danger`/`disabled` and indexes.

## §2 · TreeView `rowActions`

**Scope:** `src/components/tree/tree.{js,css}`, `website/demos/tree.demo.js`,
`tests/smoke/smoke.js` (one case), `docs/llms.md` (TreeView).

- Options `rowActions: ((node) => Array<RowAction|Node>)|null = null` and `moreLabel: 'More actions'`.
- Each rendered row with a non-empty plan gets `data-zx-reveal-host`, the strip after its label
  and badge, and `aria-labelledby` naming its label (and badge). Strips and their MenuButtons are
  destroyed and rebuilt with the rows; `destroy()` destroys them and the context menu.
- `_syncRows()` makes the tab-stop row's strip tabbable and every other strip not.
- Root handlers ignore events from inside a strip: `keydown` (no navigation, no type-ahead, no
  Enter/Space), `click` and `dblclick`. A `focusin` inside a strip moves the tab stop to its row.
- A `ContextMenu` on the root with `selector: '.zx-tree__row'` and the row's descriptors (decision
  6), created only when `rowActions` is set.
- CSS: the strip sits at the row's end (after the badge), with a 2px gap; each control is a
  square of `calc(var(--zx-control-height) - var(--zx-space-1) - 2px)`, pulled into the row by
  negative block margins so the row height does not change; ghost look, muted glyph, the hover fill
  and the text colour on hover, the inset focus ring.

## §3 · AppSidebar item `actions`

**Scope:** `src/components/app-sidebar/app-sidebar.{js,css}`, `src/internal/app-rail.js` (the
`AppNavItem` typedef only), `website/demos/app-sidebar.demo.js`, `tests/smoke/smoke.js` (one
case), `docs/llms.md` (AppSidebar). The level-padding rule `tests/unit/geometry.test.js` pins keeps
its form; the line variant is added beside it.

- Option `moreLabel: 'More actions'`.
- On a destination, `actions: Array<RowAction|Node>`; `onSelect` receives the item. On a section,
  `actions` keeps its meaning (trailing controls beside the heading, always shown).
- A destination with actions renders its control and the strip inside
  `div.zx-app-sidebar__line[data-zx-reveal-host]`; a destination without keeps today's markup.
  The line is a one-cell grid: the control fills it, the strip sits over its end, and the control
  reserves the strip's width (`--zx-app-sidebar-actions`, the number of controls) so the label,
  badge and chevron never run under it. Pointing at the strip keeps the row's hover fill; the
  current row (`:has(> [aria-current="page"])`) shows its strip.
- The four structural selectors and the four DOM walks that assumed the control is the row's
  direct child accept the line as well.
- Only the actions of the row holding focus are Tab stops (`focusin` on the list).
- A `ContextMenu` on the list with `selector: '.zx-app-sidebar__line'`, in the expanded tree and
  the modules layout's panel. Minimized flyouts show destinations only.

## §4 · Prose section links

**Scope:** new `src/components/prose/prose.{js,css}`, `src/index.js` (export), `styles/zx.css`
(import), `website/demos/prose.demo.js`, new `tests/unit/prose-anchors.test.js`,
`tests/smoke/smoke.js` (one case), `docs/llms.md` (Prose).

- `proseAnchors(root, options?)` → `{refresh(), destroy()}`. Options: `selector = 'h2[id], h3[id],
  h4[id]'`, `label = 'Copy link to %1'`, `title = 'Copy link'`, `feedback = 'Link copied'`,
  `href = (id) => sectionHref(location.href, id)`, `oncopy(url, copied)`.
- One delegated `click` listener on `root` (an `AbortController`), one visually hidden
  `role="status"` region, re-attached by `refresh()` when the content was replaced. `refresh()`
  adds anchors to new headings and updates the `href` of existing ones. `destroy()` removes the
  anchors, the host attribute it set, the region and the listener, and clears its timer.
- `sectionHref(base, id)` (pure, exported): the base URL with its hash replaced by `id`.
- CSS: the anchor follows the heading text with a small gap, in the muted ink, the text colour on
  hover, the focus ring; no underline; not printed.
- Unit tests: `sectionHref` (replaces a hash, keeps the query, encodes); the stylesheet consumes
  only tier-2 tokens and never sets `display` on the anchor's revealed state.

## §5 · Layouts

**Scope:** `website/layouts/wiki.layout.js`, `website/layouts/mail.layout.js` (no layout CSS is
needed: the components bring their own).

- **Wiki:** page tree rows get `rowActions`: "Add sub-page" inline, and "More" holding
  "Add to favorites"/"Remove from favorites", "Move…" and "Delete". The page actions that act on
  the open page take a page argument (defaulting to the open one). Article headings get ids from
  their text, unique per page, outside preview mode; `proseAnchors(article)` is created once and
  refreshed on every render.
- **Mail:** each label in the sidebar gets `actions`: "Mark all as read" inline (it works), and
  "More" holding "Rename…" and "Delete label", which report that they are not part of the
  example, as the layout's other unbuilt commands do.
- Both pass `tools/shoot-layout.js` and `tools/audit-layout.js` at 1440 and 390, light and dark.

## Out of scope

- Row actions on `Table`, `Finder`, `KanbanView`, `CardView` and the kit's `.list-row`.
- Actions in AppSidebar's minimized flyouts and on ModuleBar tiles.
- Merging the row menu with an application's own `ContextMenu` on the same element.
- Generated heading ids, and a table-of-contents component.
- `h1` and `h5`/`h6` anchors.

## Acceptance criteria

1. `npm test` and `npm run test:browser` pass; `node tools/check-site.js` and `git diff --check`
   are clean.
2. Unit tests cover `planRowActions`, `rowActionLabel`, `menuEntries` and `sectionHref`.
3. Smoke cases: TreeView (row actions), AppSidebar (item actions), `proseAnchors()` — tab stops
   follow the focused row, labels name the row, the overflow and the context menu run the action,
   keys on an action never move the tree, and destroy leaves the DOM as found.
4. `node tools/shoot-layout.js` and `node tools/audit-layout.js` pass on wiki and mail at 1440 and
   390, light and dark.
5. `docs/llms.md` documents `rowActions` (TreeView), `actions` (AppSidebar) and `proseAnchors`
   (Prose); the three demos show them.
