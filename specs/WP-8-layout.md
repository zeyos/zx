# WP8 — Layout: Panel, MasterPanel, Tabbox, NavigationBar

Branch: `wp8-layout` from `main` (kernel + WP2 merged). Read `AGENTS.md`.
Legacy reference: `../gx-zeyos/src/classes/{Panel,MasterPanel,Tabbox,Groupbox}.js`,
`../gx-bootstrap/src/classes/{Tabbox,NavigationBar}.js`.

## Scope

```
src/components/panel/panel.js|css
src/components/master-panel/master-panel.js|css
src/components/tabbox/tabbox.js|css
src/components/navigation-bar/navigation-bar.js|css
demos/components/{panel,tabbox,navigation-bar}.demo.js
src/index.js styles/zx.css
```

## panel.js — `class Panel` (cssName `panel`)

Collapsible titled section (like Groupbox but framed/raised surface, successor of legacy
`Panel(display, title, content, open)` positional API — v2 uses options).
`defaults: { title:'', content:null, open:true, collapsible:true, footer:null }`.
Methods: `setTitle(t)`, `setContent(c)`, `setFooter(c)`, `open()/close()/toggle()`, `isOpen()`.
Events: `open`, `close`. Header is a button when collapsible (aria-expanded, chevron); surface
uses `--zx-color-bg-surface` + border + `--zx-radius-lg`.

## master-panel.js — `class MasterPanel` (cssName `master-panel`)

Page-level panel: fixed header bar (title + action button area), scrollable content, optional
footer bar. `defaults: { title:'', content:null, buttons:[] /* button() descriptors or
Elements */, module:null /* ZeyOS module name → header accent via --zx-module-<name> */,
footer:null }`.
Methods: `setTitle(t)`, `setContent(c)`, `setButtons(list)`, `setFooter(c)`.
Fills its target's height (flex column, content region `overflow:auto`).

## tabbox.js — `class Tabbox` (cssName `tabbox`) — APG tabs

`defaults: { tabs:[] /* {name, title, content: Node|Component|()=>Node (lazy), closable=false,
disabled=false} */, active:null /* name; default first */, keepAlive:true /* keep panel DOM */ }`.
Methods: `addTab(tab, {index})`, `removeTab(name)`, `openTab(name)` (alias `show`),
`getActive()`, `setTitle(name, title)`, `setBadge(name, text|null)` (successor of legacy
setHighlight), `enableTab(name)/disableTab(name)`.
Events: `change {name, previous}` (preventable → veto switch), `close {name}` (closable tabs).
ARIA/keyboard (APG tabs, manual activation): `role="tablist"/tab/tabpanel`,
`aria-selected`, roving tabindex, ArrowLeft/Right + Home/End move focus, Enter/Space activates,
Delete closes closable tab. Lazy content functions called on first activation.

## navigation-bar.js — `class NavigationBar` (cssName `navigation-bar`)

App top bar: brand/title area, horizontal nav derived from Tabbox semantics (it IS a tablist
when used with panels, or plain links/actions otherwise), right-aligned actions area.
`defaults: { title:'', items:[] /* {name, title, badge?} */, active:null, actions:[] }`.
Methods: `setTitle(t)`, `setItems(list)`, `setActive(name)`, `setBadge(name, text|null)`,
`setActions(list)`. Event: `change {name}`.
Responsive: items overflow into a "More" MenuButton (WP3) under container-query narrow widths
— if WP3 unavailable on the branch, hide overflow items and note TODO.

## Demos

- panel: collapsible panels stack, non-collapsible, footer variant; MasterPanel full-height demo
  with module accent (pick 3 modules), action buttons, long scrolling content.
- tabbox: 4 tabs incl. one disabled, one closable, one lazy-loaded (log when built), badge
  update button, veto-change checkbox demonstrating preventable `change`.
- navigation-bar: brand + 6 items with badges + actions; narrow-container overflow demo.

## Acceptance criteria

1. `npm test` + lint green.
2. Tabbox full APG keyboard map (arrows/Home/End/Enter/Space/Delete); focus ring visible;
   `change` veto works.
3. MasterPanel fills height, content scrolls, header/footer stay fixed; module accent visible
   in light and dark.
4. NavigationBar overflow behavior at narrow width.
5. Light/dark × density clean; double create/destroy clean.
6. Committed on `wp8-layout`.

## Out of scope

Routing; legacy Grid/HGroup (dropped — document in README later); compat.
