# AppSidebar — application navigation in every presentation

One application-navigation component with an expanded vertical tree, a minimized vertical rail, and horizontal rail layouts.

Full reference: https://zx.zeyos.com/docs/llms.md · Live demo: https://zx.zeyos.com/docs.html#components/app-sidebar · All components: https://zx.zeyos.com/docs/components/index.md

One route-agnostic application-navigation owner with an expanded vertical tree, a minimized
vertical rail, and horizontal rail layouts. It mounts exactly one presentation at a time while
preserving active and expanded branch state. Only the expanded vertical state reveals descendants
inline; every rail state opens descendants toward the workspace in anchored flyouts.

- **Options** — `items`, `active`, `expanded`, `collapsed`, `collapsible` (`false` removes the
  minimise and expand buttons), `orientation: 'vertical'|'horizontal'`,
  `side: 'left'|'right'|'top'|'bottom'`, `layout: 'tree'|'modules'`, `module`, `moduleBar`
  (`{appearance, labels: 'auto'|'beside'|'below'|'hidden', allModules, label}` for the module
  strip), `label`,
  `header`, `footer`, `railHeader`, `railFooter`, `openDelay: 80`, `closeDelay: 160`,
  `moreLabel` (by default the `appSidebar.more` message), and `renderIcon(item, context)`. Icon values may also be names,
  nodes, components, or factories.
- **Row actions** — `actions` on a destination lists its commands: `{icon, label, onSelect(item),
  disabled?, danger?}` descriptors or nodes, laid out as TreeView's `rowActions` (two at most, the
  rest in a "More actions" menu). They rest out of sight over the end of the row, which keeps room
  for them, and show while the row is pointed at, holds focus, is the current page or has its menu
  open — always on a touch screen, under a contrast preference and in forced colours. Each is named
  after its action and the destination ("Rename: Customers"). Only the actions of the destination
  holding focus are Tab stops, right after it; a right-click or Shift+F10 on the destination lists
  them all. The expanded tree and the modules layout's panel draw them; minimized flyouts show the
  destinations only.
- **Sections** — an item with `section: true` is a quiet heading over its `children`, which stay
  at its own level: never indented, collapsed, focused, or selected, and it needs no `id`.
  `actions` (a node) adds trailing controls such as an add button. Sections replace stacking
  several sidebars: one `<nav>`, one keyboard sequence, one rail. On a rail a section becomes a
  rule; in a flyout, a caption.
- **Modules layout** — `layout: 'modules'` reads the top level as modules (`ModuleItem`s: `tone`
  or `color`, `badge`, `pinned`, `group`) and draws them as a `ModuleBar` strip beside a panel
  with one module's menu. A module with `children`, `header` (a node above its menu, such as its
  primary action), or `content` (a node below it, such as a tree or a history) is a panel module:
  choosing its tile shows its panel and fires a cancelable `modulechange`; any other module is a
  destination and fires `select`. The panel starts on `module`, else the module holding `active`,
  and follows `setActive()` into another module. A `section` at the top level heads its modules on
  the strip.
- **Presentations** — the modules layout shows `'expanded'` (both menus: the strip names its
  modules beside their tiles, and the side menu shows), `'compact'` (the module menu collapsed to
  icons beside the side menu), or `'collapsed'` (the icon strip alone; every module's menu opens as
  a flyout beside its tile). A small three-way switch at the foot of the strip, above
  `railFooter`, chooses between them: an APG radio group ("Navigation layout") of one pictogram per
  presentation, in a row while the modules are named and a column on the icon strip; arrow keys
  move and choose, Home and End jump. `presentationSwitch: false` leaves it out when the choice
  lives in a menu instead: `presentationChoice({label})` returns the same choice as a menu
  `choice` entry (`account.setItems([sidebar.presentationChoice(), …])`; rebuild it after
  `presentationchange`), and `presentationGlyph(name)` is its pictogram. `presentations` (default all three) decides which it offers;
  `presentation` sets the first one; `getPresentation()`, `setPresentation()`, and
  `togglePresentation()` (the next one, wrapping — Mod+B in an application) drive it, and
  `presentationchange {presentation, previous}` reports it. `moduleBar.labels: 'hidden'` never
  names the modules. `railHeader`/`railFooter` are the strip's head and foot in every
  presentation. The arrow toward the panel moves from a tile into its menu, and Left Arrow on a
  top-level row of the menu returns to the tile.
- **Methods** — `setItems()`, `getItems()`, `setActive()`, `setBadge(id, badge)`, `setExpanded()`,
  `getExpanded()`, `toggleBranch()`, `expand()`, `collapse()`, `setCollapsed()`, `isCollapsed()`,
  `setModule(id, {silent})`, `getModule()`, `setModuleLabels(labels)`, `getPresentation()`,
  `setPresentation(presentation, {silent})`, `togglePresentation()`, `presentationChoice({label})`,
  `setLayout({orientation, side})`, `openFlyout(id, {focus})`, `closeFlyout()`,
  `closeAllFlyouts()`, `isFlyoutOpen()`, `focus()`, `destroy()`. `getItems()` returns copies of
  the normalized tree; a leaf carries no `children` property.
- **Events** — cancelable `select {item, id, value, href, event}`,
  `branchchange {item, id, expanded, ids}`, `collapsechange {collapsed}`,
  `flyoutchange {item, id, open}`, cancelable `modulechange {item, id, previous}`, and
  `presentationchange {presentation, previous}`.
- **Presentation state** — horizontal navigation is always effectively minimized and never exposes
  an expand control. Switching layouts does not erase the saved vertical collapsed preference or
  expanded branch IDs. `AppSidebar` is the one component that owns an application's navigation
  tree; use `collapsed: true` or `orientation: 'horizontal'` for its rail presentations, and
  `layout: 'modules'` for the module strip it composes from `ModuleBar`.
- **Current state** — the current page is neutral: the `--zx-color-bg-current` fill, the full
  text colour and a semibold label, in the tree, the rail and every flyout; hover is a lighter
  step of the same overlay. A closed branch (or a rail item) over the active route takes the
  semibold label or the text colour, never the accent. Nothing is docked to an edge.
- **Pointer and focus** — hover or focus reveals rail descendants without stealing focus. Click,
  Enter, Space, and the arrow toward the workspace also open a flyout; Escape, outside activation,
  or selection closes it. Expanded navigation supports arrows plus Home/End across visible rows.
- **Semantics** — persistent navigation uses `<nav>` and nested lists with native links and
  disclosure buttons, not menu or menubar roles. The `<nav>` is the only landmark: a root the
  sidebar creates is a plain `<div>`, and a caller's own root keeps its element and attributes.
  Icon-only destinations retain an accessible name
  and Tooltip. A parent with children is disclosure-only; add an Overview child when it also needs
  a destination. Malformed and executable URL schemes are stripped; an item with no remaining
  link or callback is disabled in every presentation.
