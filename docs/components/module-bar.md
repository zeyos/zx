# ModuleBar — the module level of an application

The module level of an application: one colour-coded tile per module in a vertical strip or a horizontal bar.

Full reference: https://zx.zeyos.com/docs/llms.md · Live demo: https://zx.zeyos.com/docs.html#components/module-bar · All components: https://zx.zeyos.com/docs/components/index.md

One colour-coded tile per module, in a vertical strip or a horizontal bar: the level above an
application's menus. Use it on its own — the classic module bar in an application header, beside
a tree-layout `AppSidebar` — or through `AppSidebar`'s `layout: 'modules'`, which composes it.

```js
import { ModuleBar } from '/assets/zx.esm.js';

const bar = new ModuleBar(null, {
  items: [
    { id: 'mail', label: 'Mail', icon: 'envelope', tone: 'blue', badge: 7, children: [
      { id: 'inbox', label: 'Inbox', href: '#inbox' }, { id: 'sent', label: 'Sent', href: '#sent' }
    ] },
    { id: 'billing', label: 'Billing', icon: 'file-invoice', color: '#535494', href: '#billing' }
  ],
  active: 'inbox',
  onselect: (event) => { event.preventDefault(); route(event.detail.id); }
});
bar.setBadge('mail', 8);
```

- **Items** (`ModuleItem`) — the `AppNavItem` shape plus `tone` (a categorical tone that follows
  the theme) or `color` (any CSS colour; it wins), `pinned: true|number` (when any module is
  pinned, unpinned ones are under "All modules" only), `group` (the catalogue heading), and
  `description`. Children are the module's menu. A `section` at the top level heads its modules:
  a caption over them while names are printed beside the tiles, a short rule between groups on an
  icon strip or bar, and their group in the catalogue.
- **Options** — `items`, `active` (a module or anything in a module's menu),
  `orientation: 'vertical'|'horizontal'`, `side`, `appearance: 'tint'|'solid'|'plain'` (the glyph
  on a tint of the module colour; the solid identity tile; monochrome glyphs),
  `labels: 'hidden'|'below'|'beside'` (names under the tiles of a vertical strip, or beside them —
  a navigation column of its own, a row per module with its count at the end),
  `menus: 'flyout'|'none'`, `expanded`, `controls`, `allModules: 'auto'|'always'|'never'`,
  `header`, `footer`, `label` (default "Modules"), `openDelay`, `closeDelay`, `renderIcon`.
- **Menus** — with `menus: 'flyout'` a module's children open beside its tile on hover, focus,
  click, or the arrow toward the workspace, exactly like a rail. With `menus: 'none'` an adjacent
  panel the application owns shows them: every module then fires `select`, `setExpanded(id)`
  names the module the panel shows, and each tile with a menu reports `aria-expanded` and
  `aria-controls` the `controls` id.
- **Overflow** — modules that do not fit move behind the "All modules" button; the current module
  (and the expanded one) always stays. The catalogue lists every module as a labelled tile,
  grouped by `group`, with a filter field past twelve modules. `partitionModules(items, capacity,
  keep, reserve)` is the pure function deciding what shows; `reserve` keeps the button's slot for
  `allModules: 'always'`.
- **Methods** — `setItems()`, `getItems()`, `setActive()`, `setBadge(id, badge)` (in place, on the
  tile, in its menu, and in the catalogue), `setExpanded(id)`, `setLabels(labels)` (how a column
  expands to names and collapses to icons), `setLayout({orientation, side})`,
  `openFlyout()`, `closeFlyout()`, `closeAllFlyouts()`, `isFlyoutOpen()`, `openAllModules()`,
  `closeAllModules()`, `isAllModulesOpen()`, `focus()`, `destroy()`.
- **Events** — cancelable `select {item, id, value, href, event}`, `flyoutchange {item, id, open}`,
  `overflowchange {visible, overflow}`, and `allmodules {open}`.
- **Keyboard** — the bar is one Tab stop, on the current module. Arrow keys along the bar move
  between tiles and wrap; Home and End go to the first and last control; typing jumps to the next
  module whose name starts with the letters typed; the arrow toward the workspace opens a menu and
  moves into it; Escape, or the arrow back toward the strip, closes a menu onto its tile; Escape
  closes the catalogue onto its button, and so does tabbing out of it. In the catalogue, arrows
  move across the grid, typing goes to the filter field (past twelve modules), and Enter chooses.
- **Semantics** — a `<nav>` of native links and buttons, never a menu or menubar. The module that
  is or holds the current page carries `aria-current` (`page` or `true`); an icon-only tile's
  accessible name is its label, with its count ("Mail (7)"), and it has a tooltip. Current is
  the neutral `--zx-color-bg-current` fill behind the tile, never the accent or an edge bar.
- **Geometry** — a target is one control plus a space step, a tile one control less one, so
  `--zx-control-height` resizes the bar; a coarse pointer keeps a 40px target.
