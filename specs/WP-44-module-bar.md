# WP44 — ModuleBar: modules as the first level of application navigation

Classic ZeyOS put every module in one row of coloured tiles: Mail with its unread count,
Calendar, Billing, Tickets, each recognisable by colour before it is read. Newer suites put the
same level in a narrow strip beside the menu: pick a space on the strip, and the panel next to it
shows that space's menu. Xenon has neither. `AppSidebar` draws one tree, and the layouts fake
sections by stacking two or three sidebars in a column. This WP adds the module level as a
component, `ModuleBar`, and makes it a presentation of `AppSidebar` (`layout: 'modules'`): a strip
of colour-coded modules beside a panel showing the current module's menu. The panel minimizes to the
strip. The ZeyOS binding fills it from the ZeyOS menu, and every layout with a navigation column
moves onto it.

Work in the current checkout. **Do not commit**: this lands in one release commit after central
review. `AGENTS.md`, the WP40 design rules (neutral current, one solid accent, tones for
categories, sentence case, small corners, no edge bars), and WP42 (every layout from 390px to
1440, clean under `tools/audit-layout.js`) apply. This WP explicitly permits changes to
`src/core/icons.js` (§1, one glyph) and `styles/tokens/**` (§1, one role family). `CHANGELOG.md`
and `docs/api.json` are central: report changelog lines instead of writing them. Public files
(source comments, demos, docs) must not mention this spec or any other internal material;
`tools/check-site.js` enforces it.

## Review: the navigation suite today

What exists and works:

- **`AppSidebar`** is the only public component that owns an application-navigation tree. It
  has an expanded vertical tree with inline branches, a minimized vertical rail, and a horizontal
  rail. Both rails use hover, focus, and keyboard flyouts (`src/internal/app-rail.js`,
  `AppRailPresenter`). It has header, footer, `railHeader`, and `railFooter` slots, a `collapsed`
  state with a toggle, and the `select` / `branchchange` / `collapsechange` / `flyoutchange`
  events. Wrapped labels, neutral current fill, and badges that become dots on the rail are
  already right.
- **Identity**: `AppIcon` (tile or circle, glass, badge), `moduleChip()` / `zeyosAppIcon()`, the
  ZeyOS module registry (`src/zeyos/modules.js`, 60+ modules with label, kit icon, Font Awesome
  fallback, hex colour), the generated `--zx-module-*` tokens, and `registerModules()` for colours a
  ZeyOS menu payload carries.
- **`Launcher`** (Mod+K) with `kind: 'application'` tiles and the ZeyOS adapter
  `buildZeyosLauncherConfig()`, which already normalizes `modules`, `menuApps`, `pinned`,
  `activeIdentifier`, `canUseModule`, and `resolveApplication`.
- **The kit** (`website/layouts/kit.js`): `adaptiveShell()` handles the columns, with drawers
  below 1180px (inspector) and 860px (navigation), a single-pane mode below 640px, `collapse()`,
  and optional Mod+B, Mod+I, and Mod+J.

The gaps this WP closes:

1. **No module level.** No layout has a module or app switcher. Every layout repeats the same
   "F ACME" header and flattens what would be modules into section labels: zeyos-invoices
   shows "Billing" and "Contacts" as headings, crm shows "CRM", "Records", and "Lists".
   `fixtures.js` has no notion of modules.
2. **`AppSidebar` has no sections.** Eighteen layouts stack 2–3 `AppSidebar` instances with
   `sectionLabel()` in between. The result is 2–3 `<nav>` landmarks per column, arrow keys that
   stop at every instance boundary, and no single tree that could minimize to one rail.
3. **Collapse is unusable in practice.** Every layout passes `collapsible: false`. The kit hides
   `.zx-app-sidebar__header`. `.shell__nav` has a fixed 248px basis, so the rail could never
   narrow the column anyway. The shell's `collapse('nav')` hides the whole column
   (`display: none`), so a collapsed column leaves no visible way to switch modules.
   `collapsechange` is not wired, Mod+B is bound in only three layouts, and nothing is persisted.
4. **Colour cannot come from the theme.** `AppIcon` accepts only literal CSS colours: `isCssColor()`
   rejects `var()`. A product-agnostic application therefore cannot colour a module from the tone
   palette, as WP40 rule 3 asks. Only ZeyOS hex values work.
5. **Two layouts have no shared shell.** agent-chat has a hand-built nav column, and
   checkout-wizard has no navigation by design.

## Decisions

- **The module level is part of the tree.** The top-level items of an `AppSidebar` in
  `layout: 'modules'` are the modules, and their children are each module's menu. There is still
  one tree with one owner and one `select` event. The WP18 rule stays: a module with a menu is not
  itself a destination. Applications that want "click the module, land on its start page" handle
  `modulechange` and route.
- **`ModuleBar` is public, and it is the rail of the modules layout.** It is usable on its own,
  for example as the classic horizontal bar in an application header next to a tree-layout
  `AppSidebar`. `AppSidebar` composes it rather than reimplementing it. Both build on
  `AppRailPresenter`, so flyouts, tooltips, and badges behave identically. `DESIGN-SYSTEM.md`
  changes its wording from "the rail renderer is an internal presenter, not a second component"
  to: AppSidebar owns the tree, and ModuleBar is the module strip it composes.
- **Colour is data, drawn through tokens.** A module carries `tone` (one of the nine categorical
  tones, which follow the theme) or `color` (any CSS colour, validated with `isCssColor()`, as
  the ZeyOS payload supplies). `color` wins when both are given. Component CSS never contains a
  literal. A host colour enters only as an inline custom property.
- **Three appearances.**
  - `tint` (default): the glyph in the module's colour on a tint of it, which follows WP40.
  - `solid`: the classic ZeyOS identity tile, an `AppIcon` with the white glyph. It is the
    default of the ZeyOS binding.
  - `plain`: monochrome glyphs, with colour ignored.
  The current module is the neutral current fill behind the tile in every appearance, never a
  coloured ring or edge bar.
- **One Tab stop.** A bar of 20 modules costs 20 Tab presses before the menu, so `ModuleBar` uses
  a roving tabindex: the current module, else the first. Arrow keys move between tiles. The
  tree-layout rail is unchanged.
- **The panel minimizes to the strip.** Expanded shows strip and panel. Minimized shows the strip
  only, and the module menus open as flyouts, as the rail does today. The component does not
  persist anything; the kit persists for the demos.

**Confirm before implementation:** the `tint` default for the ACME layouts (versus
`solid` everywhere), the roving tabindex, and cross-layout navigation in the gallery (§5).

## §1 · Foundations: tone solids, AppIcon tone, grid glyph

**Scope:** `styles/tokens/semantic.css`, `styles/tokens/dark.css`, `src/core/icons.js`,
`src/components/app-icon/**`, `website/demos/app-icon.demo.js`, `tests/unit/tokens.test.js`,
`tests/unit/app-icon*.test.js` (if present), `docs/llms.md` (tokens and AppIcon sections).

- `--zx-color-tone-{blue,teal,green,amber,orange,red,pink,violet,slate}-solid`, light and dark
  (including the `auto` block in `dark.css`). Each is a solid identity fill on which
  `--zx-color-app-icon-glyph` reaches at least 3:1 in both themes. Tests: every role exists in
  both themes and the contrast holds.
- `AppIcon` gains `tone`, which resolves to `--zx-color-tone-<tone>-solid`. `color` still takes
  precedence. An unknown tone falls back to the accent, as a missing colour does today.
- A `grid` glyph (Font Awesome `table-cells-large`, plus an inline SVG in the bundled set) for the
  "All modules" button.

## §2 · ModuleBar

**Scope:** new `src/components/module-bar/module-bar.{js,css}`, `src/internal/app-rail.js`
(presenter hooks only: tile renderer, roving focus, type-ahead, `setBadge`), `src/index.js`,
`styles/zx.css`, new `website/demos/module-bar.demo.js`, `website/docs.js` (`COMPONENT_IDS`, Layout
group), new `tests/unit/module-bar.test.js`, `tests/unit/geometry.test.js` (one ModuleBar block),
`tests/smoke/smoke.js` (ModuleBar cases), `docs/llms.md` / `docs/llms.txt` / `website/llms.txt` /
`README.md` (ModuleBar entries).

**Item** (`ModuleItem` extends `AppNavItem`):

- `tone?` or `color?`.
- `pinned?: boolean|number`: shown on the bar, optionally in that order. When no item sets it,
  all items are shown.
- `group?: string`: the heading in the "All modules" popover.
- `description?: string`: the popover's secondary line.
- `children?`: always rendered as flyouts, never inline.

**Options** (`ModuleBarOptions`), with `@extends {Component<ModuleBarOptions>}`:

- `items`, `active`.
- `orientation: 'vertical'|'horizontal'` and `side`, as in AppSidebar.
- `appearance: 'tint'|'solid'|'plain'`.
- `labels: 'hidden'|'below'`. With `'below'`, vertical bars show a short label under each tile;
  labels are hidden on horizontal bars.
- `allModules: 'auto'|'always'|'never'`. With `'auto'`, the button appears when anything
  overflows or is unpinned.
- `header`, `footer`, `label` (default from `moduleBar.label`, "Modules").
- `openDelay`, `closeDelay`, `renderIcon`.

**Presentation:**

- `nav` > `ul` of tiles. A tile with an `href` and no children is an `<a>`; everything else is a
  `<button>`.
- Geometry comes from tokens on the root: `--zx-module-bar-target` is
  `calc(var(--zx-control-height) + var(--zx-space-2))` and `--zx-module-bar-tile` is
  `calc(var(--zx-control-height) - var(--zx-space-1))`, so `--zx-control-height` scales the bar.
  A coarse pointer keeps a 40px target.
- Every icon-only tile has a Tooltip and an accessible name. The badge is folded into the name
  ("Mail (7)") and drawn as a dot past two characters, as on the rail today.
- The current module carries `aria-current="page"` when it is itself the active destination, or
  `aria-current="true"` when it contains the active route. A module is current when the `active`
  id is the module or lies anywhere in its subtree.
- **Overflow:** a ResizeObserver measures the bar. Tiles that do not fit move to the "All modules"
  popover, and the active module is always kept visible. This logic is the pure, exported
  `partitionModules(items, capacity, activeId)`, which returns `{visible, overflow}`.
- **"All modules" popover:** a Dropdown holding every module as a labelled tile, grouped by
  `group`, with a filter field when there are more than 12 modules.
- Forced colours: tiles use system colours, and the current module uses `Highlight`. Motion:
  hover and press only, under `prefers-reduced-motion: no-preference`.

**Methods:**

- `setItems`, `getItems` (a copy; Node props by reference), `setActive`, `setBadge(id, badge)`
  (updates in place, for live counts), `setLayout({orientation, side})`.
- `openFlyout`, `closeFlyout`, `closeAllFlyouts`, `openAllModules`, `closeAllModules`.
- `focus`, `destroy`.

**Events:**

- `select`: preventable, with `{item, id, value, href, event}`, the same as AppSidebar.
- `flyoutchange`.
- `overflowchange`: `{visible: ids, overflow: ids}`.
- `allmodules`: `{open}`.

**Keyboard** (APG disclosure navigation with roving focus):

| Key | Action |
|---|---|
| Tab / Shift+Tab | Enter the bar on the current module (else the first tile); leave it. |
| ArrowDown / ArrowUp (vertical), ArrowRight / ArrowLeft (horizontal) | Next or previous tile, wrapping. |
| Home / End | First tile / last control (including "All modules"). |
| Arrow toward the workspace | Open the tile's flyout and focus its first item. |
| Enter / Space | Activate: select a destination, open a flyout, or open the popover. |
| Escape | Close the flyout or popover and return focus to its trigger. |
| Printable characters | Type-ahead to the next module whose label starts with the typed text. |
| Popover: arrows | Move in two dimensions across the tile grid. |
| Popover: typing | Goes to the filter field. |
| Popover: Enter | Activates and closes. |

**Demo:**

- A vertical tint bar with header (mark), footer (compact AccountMenu), badges, and a live
  `setBadge` counter.
- The classic horizontal bar in a header, in solid appearance, with overflow into "All modules".
- `labels: 'below'`.
- `plain`.

Every example logs its events.

## §3 · AppSidebar: sections and the modules layout (after §2)

**Scope:** `src/components/app-sidebar/**`, `src/internal/app-rail.js` (sections in rail and
flyouts), `website/demos/app-sidebar.demo.js`, `tests/unit/app-sidebar.test.js`,
`tests/smoke/smoke.js` (AppSidebar cases), `docs/llms.md` (AppSidebar), `DESIGN-SYSTEM.md`
(navigation rows).

**Sections (both layouts).** An item with `section: true` at any level renders as a group: a
quiet sentence-case label, an optional `actions` node (such as workflows' "+"), and its children
at the same level. A section is not indented, not collapsible, does not count as a level, and
never takes focus. On a rail a section becomes a separator; in a flyout it becomes a group label.
Unsectioned trees render exactly as today: the existing tests pass unmodified.

**`layout: 'modules'`.** The default stays `'tree'`, with no behaviour change.

- **Expanded.** `[ModuleBar | panel]`.
  - The panel header holds the shown module's title (the panel `nav` is `aria-labelledby` it)
    and the minimize button.
  - Below the header comes the module's `header` node (a primary action, a search).
  - Then the module's menu, which is today's tree, sections included, rooted at the module.
  - Then the module's `content` node (a TreeView, a conversation history).
  - Then the `footer`.
  - `railHeader` and `railFooter` become the strip's header and footer in both states.
  - Strip and panel share the chrome surface, divided by the subtle border. The panel is
    `14rem` wide.
- **Panel modules and destinations.** A module with children, `header`, or `content` is a panel
  module. Its tile is a disclosure button (`aria-expanded`, `aria-controls` → panel) that shows
  its panel and emits a preventable `modulechange` `{item, id, previous}`. A module with none of
  these is a destination and emits `select`.
- **Which module the panel shows.** It starts as `module` ?? the module containing `active` ??
  the first panel module. `setActive()` into another module follows it there. Expanded branch ids
  survive module switches.
- **Minimized.** The strip only. A panel module with children opens them as a flyout. One
  without children expands the sidebar on that module. The expand button comes first in the
  strip header, and focus restoration works as today.
- **Horizontal.** A horizontal ModuleBar with flyouts, which is always minimized.
- **Keyboard additions.** In the expanded strip, the arrow toward the panel shows that module and
  focuses its first menu item. In the panel, ArrowLeft on a top-level row returns to the module
  tile.
- **Node ownership.** `header` and `content` are moved in and out, never cloned or destroyed; the
  application owns them.
- **New API:**
  - Options: `moduleBar: Partial<ModuleBarOptions>` (presentation: `appearance`, `labels`,
    `allModules`, `label`) and `module`.
  - Methods: `setModule(id, {silent})`, `getModule()`, `setBadge(id, badge)`.
  - Event: `modulechange`.
  - i18n keys: `appSidebar.modulePanel` and `appSidebar.showModule`.
- **Motion.** The panel cross-fades on module switch and on expand. Width is never animated
  (it would force layout every frame).

**Demo:**

- The modules layout, expanded and minimized, with sections, a per-module `header` and
  `content`, and live badges.
- A tree-layout sidebar with sections replacing the stacked-sidebar pattern.

## §4 · ZeyOS binding (parallel with §3, after §2's typedefs)

**Scope:** new `src/zeyos/module-bar.js`, `src/zeyos/index.js` (exports),
`src/zeyos/launcher.js` (export its application normalizer for reuse; no behaviour change), new
`tests/unit/zeyos-module-bar.test.js`, the ZeyOS example in `website/demos/module-bar.demo.js`,
`docs/llms.md` (ZeyOS section).

- `zeyosModuleItems(state, options)` maps ZeyOS shell state to `ModuleItem[]`.
  - It reads the launcher state fields (`modules`, `menuApps`, `pinned`, `activeIdentifier`,
    `canUseModule`, `resolveApplication`) plus `menus: Record<identifier, ZeyosMenuEntry[]>`
    (each module's menu entries) and `badges: Record<identifier, count>`.
  - Each item gets the kit icon through `moduleIcon()` (or the stock glyph with
    `standardIcons`), its colour from the registry or the payload, its menu entries as
    `children`, and forks and weblets in their own `group`.
  - Entries are objects `{id, label, href?, invoke?, badge?, icon?, children?}` or arrays
    `[id, label, href?]`, which is the tolerance the launcher already has.
- `buildZeyosModuleBarConfig(state, options)` returns ModuleBar options in solid appearance.
  `buildZeyosAppSidebarConfig()` returns the same as AppSidebar modules-layout options.
- `zeyosModuleBar(target, state, options)` is a convenience factory, as `zeyosLauncher` is.
- Tests cover:
  - permission filtering, pinned order, aliases (`invoices` → billing colour), and payload
    colour overrides;
  - array and object entries and unsafe hrefs, which are disabled as in `normalizeAppItems`;
  - badges.

## §5 · Kit: one navigation for the suite (coordinator, after §3)

**Scope:** `website/layouts/kit.{js,css}`, `website/layouts/fixtures.js`,
`website/layouts/layout-icons.js`, `website/layouts.js`, `website/layout.js`,
`website/layout-host.js`, `tests/layouts/harness.html`.

- **`SUITE_MODULES` in `fixtures.js`.** The ACME suite: Home, Mail, Assistant, CRM,
  Billing, Inventory, Projects, Wiki, Workflows, Infrastructure, and Settings.
  - Each has a layout icon, a `tone`, the `layout` id that implements it, and a short menu
    (3–6 entries pointing at that layout).
  - Each layout supplies its own live menu for its own module.
- **`suiteNav(context, {module, active, menu, header, content, onselect, …})`.** Builds the one
  `AppSidebar` in modules layout, wrapped in `disposer()`, and returns it.
  - The strip header holds the workspace mark (home) and the search button (Launcher).
  - The strip footer holds the compact AccountMenu.
  - It replaces `workspaceHeader()`, `navSearch()`, `sectionLabel()`, and the stacked sidebars
    in the nav column. Those helpers stay for other uses.
- **Shell with a modules sidebar:**
  - `.shell__nav` sizes to the sidebar: strip plus panel, or strip alone. The fixed 248px basis
    goes for this case.
  - At ≥1180px the user's choice applies. It defaults to expanded and is persisted with
    `storage('zx-layouts')`, never in preview.
  - At 860–1180px the sidebar starts minimized.
  - Below 860px today's drawer applies, opening the expanded sidebar.
  - `toggleNav()` and Mod+B minimize and expand instead of hiding, and the kit binds Mod+B for
    every suite layout.
- **Cross-layout navigation.** Choosing an entry of another module calls `context.open(layoutId)`
  when the host provides it: the gallery Modal swaps the layout, and `layout.html` updates its
  hash. Otherwise it shows a toast. In preview there is no navigation.

## §6 · Layouts (parallel groups, after §5)

Each layout replaces its nav-column assembly with `suiteNav()`:

- its module and its live menu (former stacked sidebars become sections);
- its primary action and search as the module `header`;
- its TreeViews and histories as the module `content`.

Each layout also drops `collapsible: false`, keeps its keyboard map, and renders the expanded
first state in preview.

| Group | Layouts → module |
|---|---|
| A | mail, inbox → Mail · ai-chat, agent-workspace, agent-chat → Assistant (agent-chat leaves its hand-built column) |
| B | issue-tracker, system-states → Projects · wiki → Wiki · workflows → Workflows |
| C | crm, master-detail, record-page, record-wizard → CRM · dashboard → Home |
| D | invoice-editor → Billing · item-inventory → Inventory · infrastructure → Infrastructure · settings-workspace → Settings · zeyos-invoices → Billing, in solid appearance through `buildZeyosAppSidebarConfig()` (the ZeyOS reference) |

checkout-wizard is unchanged: a checkout deliberately drops the application chrome.

Each layout is done when `tools/shoot-layout.js` and `tools/audit-layout.js` pass at 1440 and 390
in both themes, plus two step states: minimized at 1440 and the drawer open at 390.

## §7 · Theme studio, documentation, release notes (coordinator, last)

`website/theme-showcase.js` renders ModuleBar (three appearances) and the modules-layout
AppSidebar, so `theme.html` checks them against both themes, the spacing and radius settings, and
the six accent presets. `DESIGN-SYSTEM.md` navigation rows. `npm run build:api` regenerates
`docs/api.json`. Report the changelog lines.

## Addendum — one toggle for both levels

Requested after the first review, following a two-state sidebar reference (names beside icons
expanded, icons alone collapsed):

- `ModuleBar` gains `labels: 'beside'` — a vertical strip that names each module beside its tile
  (a navigation column of its own, `--zx-module-bar-column` wide, counts at the end of the row) —
  and `setLabels()`.
- In `AppSidebar`'s modules layout one control, at the foot of the strip above `railFooter`,
  expands and collapses both levels: expanded, the strip names its modules (`moduleBar.labels:
  'auto'`) beside the panel; collapsed, the icon strip with flyout menus. It replaces the panel's
  minimize button and the strip's top expand button. `labels: 'hidden'` keeps the icon strip
  beside the panel; `setModuleLabels()` changes it at run time.
- The kit draws the Zx mark (letters in the text colour, the bolt in the accent) at the head of
  the strip, with the workspace name while the strip is named; the drawer keeps the icon strip,
  which fits a phone beside the panel.

## Addendum — three presentations, headings, the account, ACME

Requested after the second review:

- **Presentations.** The modules layout shows `expanded` (module names beside the side menu),
  `compact` (the module menu collapsed to icons beside the side menu), or `collapsed` (the icon
  strip alone, menus as flyouts). The strip's one toggle steps through `presentations` in order;
  its glyph and accessible name say which step it takes next. API: `presentation`,
  `presentations`, `getPresentation()`, `setPresentation()`, `togglePresentation()`,
  `presentationchange`. The kit remembers the reader's presentation at full width, uses
  `collapsed` between 860 and 1180px, and `compact` in the drawer.
- **Headings.** A top-level `section` of modules is a caption over them on a named strip, a rule
  between groups on an icon strip, and their catalogue group. The suite groups its modules under
  Communication, Sales, Operations, and Workspace.
- **Account.** `AccountMenu.setCompact()`; the kit shows the name and role at the foot of the
  expanded strip and the avatar alone on an icon strip.
- **ACME.** The layouts' fictional company is renamed from its previous name to ACME.

## Addendum — the three-way switch

Requested after the third review: the stepping toggle becomes a small three-way switch (an APG
radio group of pictograms, a row on the named strip and a column on the icon strip; Mod+B still
steps), and the strip's account menu opens above its button (`placement: 'top-start'`).

## Addendum — choices in the account menu

Requested after the fourth review: the layout switch moves into the account menu, beside a theme
choice (light, dark, system), both drawn by one reusable three-way picker. Menus gain a `choice`
entry (a segmented group of `menuitemradio` options that applies in place and keeps the menu
open); `AppSidebar` gains `presentationSwitch` (off in the suite), `presentationChoice()`, and an
exported `presentationGlyph()`. The kit's `accountChoices()` puts both rows ahead of an account's
own items and keeps them in step with Mod+B and the site's theme toggle.

## Addendum — review fixes

The final reviews found, and this WP fixes: an always-shown "All modules" button without a slot
(`partitionModules(…, reserve)`); focus lost to the page after a presentation change without a
strip switch, after a catalogue choice, and after a choice row's handler closed its menu; choice
rows drawn but inert in `ContextMenu` (now left out); an unreachable presentation when the strip
never or always names its modules; keyboard-opened flyouts placed at the page origin, because a
tooltip and a menu on one trigger overwrote each other's `anchor-name` — **this addendum permits
the fix in `src/core/position.js`**, which now adds and removes only its own name; focus on the
page after the navigation became a drawer during a resize, or a drawer opened from the page; menus
opening onto an unchecked choice option; the tile tooltip taking the first Escape meant for its
flyout; the catalogue staying open after tabbing out.

A second review pass added: a fourth controller-only width in `SHELL_BREAKPOINTS`, `named: 1440`,
below which a remembered "both expanded" opens with the module menu collapsed (the drawer, too, is
always the compact presentation); `context.id`, so a layout's menu ends with a "More in <module>"
section listing the module's other layouts without itself; the last pre-ACME traces in fixtures; the
navigation-search helper and its styles, unused since every layout moved to the suite navigation;
the documentation of `context.open`/`context.id` and `suiteNav()` in `AGENTS.md` and
`website/README.md`. The "All modules" catalogue's entries are one roving Tab stop (the
last focused, kept on a visible entry while filtering); the theme studio's modules use only bundled
glyphs; agent-workspace's presence loop forgets avatars removed without a replacement.

## Out of scope

- Routing, authorization, and persistence inside components.
- User customisation of the bar (drag to reorder, pin and unpin): a follow-up.
- Badge transport (polling, push).
- A mobile bottom tab bar.
- Dynamic icons (the calendar date tile) beyond `icon: Node`.
- Changes to Launcher: the "All modules" popover is not a search palette, and Mod+K stays the
  search.
- Inline submenus in any minimized or horizontal presentation (WP18 still applies).

## Acceptance criteria

1. `npm test`, `npm run build`, `npm run build:site`, `npm run test:browser`,
   `node tools/check-site.js`, and `git diff --check` succeed.
2. Smoke covers all of the following, and creating and destroying each component twice leaves
   no node, popover, tooltip, or listener behind:
   - ModuleBar: roving focus, type-ahead, flyouts, overflow, and the popover.
   - AppSidebar modules layout: switching modules, minimizing and expanding with focus
     restoration, and flyouts when minimized.
3. Unit tests cover:
   - `partitionModules`, colour resolution (tone, colour, invalid, none), and section
     normalization;
   - the ZeyOS mapping;
   - the tone-solid contrast;
   - geometry: the bar follows `--zx-control-height`.
4. Existing AppSidebar tests and every tree-layout use behave as before.
5. No raw colour or tier-1 token in component or layout CSS (`tests/lint-tokens.js`). In `tint`
   and `solid`, every tone has a glyph-to-tile contrast of at least 3:1 in both themes.
6. Every layout in §6 passes §6's checks, and `theme.html` renders the new components correctly
   under every preset.
7. JSDoc is complete on every new public option, method, and event; `docs/api.json` and the
   types include them.
