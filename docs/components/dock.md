# Dock

A stack of collapsible, resizable panes — the inspector column of a design tool, and the detail side of a master–detail screen.

Full reference: https://zx.zeyos.com/docs/llms.md · Live demo: https://zx.zeyos.com/docs.html#components/dock · All components: https://zx.zeyos.com/docs/components/index.md

A stack of collapsible, resizable panes: the docked inspector column of a design tool, and the
detail side of a master–detail screen. Give the root a size of its own (a grid area, `block-size:
100%`, a flex child) when the panes should fill a shell rather than grow with their content.

- **Options** — `orientation: 'vertical'`, `content: null`, `panes: []`, `resizable: true`,
  `collapsible: true`, `lazy: true`, `storageKey: null`.
- **Pane** — `{name, title?, content?, tabs?, active?, size?, min?, grow?, collapsed?,
  collapsible?, side?}`. `content` takes a string, Node, Component, or a factory called on first
  reveal. A pane with `tabs` renders its strip in place of the title; `content` is then ignored.
  `side` (`'start' | 'end'`) only applies when the dock has a `content`.
- **Tab** — `{name, title, content?}`, same content shapes.
- **Methods** — `pane(name)`, `names()`, `add(pane, {index})`, `remove(name)`,
  `collapse(name)`, `expand(name)`, `toggle(name)`, `isCollapsed(name)`, `reveal(name)`,
  `setSize(name, size)`, `getSize(name)`, `activate(pane, tab)`, `getActive(pane)`,
  `state()`, `setState(state)`, `adopt(sheet, options)`, `release(sheet)`.
- **Adopting a Sheet** — `adopt(sheet, {name?, side?, index?, size?, min?, dockAt?})` takes over a
  `Sheet`'s positioning: it becomes a track in the dock rather than an overlay. The dock owns
  where it sits, its size, and its resizing; the sheet keeps its content, header, footer, events,
  and its own `open()`/`close()`. `dockAt` names a breakpoint below which the dock hands the sheet
  back to a free overlay and reclaims the track, re-adopting it above — measured on the **dock's
  own width**, so a dock inside a split pane behaves correctly where a viewport media query would
  not. Because a dock is a flex container by construction it is always a valid host, which is why
  docking needs no arrangement from the application.
- **Ownership** — the dock never owns an adopted sheet: `destroy()` releases them rather than
  destroying them, `remove(name)` on a sheet releases it, and a sheet that destroys itself while
  adopted drops out of the dock cleanly.
- **Events** — `collapse {name}`, `expand {name}`, `resize {name, size}`,
  `tabchange {pane, tab, previous}`, `reveal {name}`.
- **Sizing** — one custom property per pane and one flex rule: a sized pane is
  `flex: 0 0 var(--zx-pane-size)`, a collapsed one falls to `flex: 0 0 auto` with its body hidden,
  and exactly one element grows. With a `content` that is always the content; without one it is the
  pane declaring `grow`, or the last expanded pane. A drag therefore rewrites at most two
  properties, and collapsing a pane feeds the grower rather than redistributing across the stack.
- **Regions** — with `content` the dock is a region rather than a plain stack: panes sit on either
  `side` of the flexible middle. Nesting one dock inside another dock's pane gives a workbench —
  a canvas with an inspector column beside it.
- **`reveal(name)`** — accepts a pane name or a tab name. Expands whichever pane holds it,
  activates the tab when the name is a tab's, and scrolls it into view.
- **Persistence** — `storageKey` remembers sizes, collapsed panes, and active tabs through
  `storage()`, which degrades to memory rather than throwing. `state()`/`setState()` expose the
  same shape for storing it elsewhere; unknown pane names are ignored, so a stored layout survives
  a release that added or removed panes.
- **Keyboard and screen readers** — each pane header is a row, not one big button, so the collapse
  toggle and the tab strip can coexist; the toggle carries `aria-expanded` and `aria-controls`.
  Tabs follow the APG tab pattern with one roving tab stop, Left/Right moving between them. The
  active panel is a Tab stop itself only while nothing inside it is focusable, with the ring
  inside its edge, so its text can be read and scrolled; a panel holding a control is not. A scrolling pane
  body that the browser makes a Tab stop (nothing focusable inside) rings the same way.
  Dividers are focusable `separator`s carrying live `aria-valuenow`/`aria-valuemin`/`aria-valuemax`
  in pixels: Up/Down (or Left/Right when horizontal) resize by 16px, Shift by 64px, and Enter or
  Space collapses the pane before the divider. A divider with nothing to resize is taken out of the
  tab order.
- **Out of scope** — drag-to-rearrange, tear-off panels, and multi-column docks. All three are
  additive without changing the API above.
