# NavigationBar

The application header: a brand, one row of destinations with badges, and the actions that stay reachable at every width.

Full reference: https://zx.zeyos.com/docs/llms.md · Live demo: https://zx.zeyos.com/docs.html#components/navigation-bar · All components: https://zx.zeyos.com/docs/components/index.md

Application navigation bar: brand, items, and right-aligned actions. Items overflow into a "More"
menu on narrow widths.

- **Options** — `title`, `items: [{ name, title, badge? }]`, `active`, `actions: []`,
  `overflow: true`, `overflowBelow: '44rem'`, `minVisible: 0`.
- **Methods** — `setTitle()`, `setItems()`, `setActive()`, `setBadge()`, `setActions()`.
- **Events** — `change {name}`.

**Overflow is a default, not a law.** Collapsing every item behind "More" is right for a top app
bar and wrong for a phone bottom bar, where the navigation is the point. `overflow: false` keeps
every item at every width; `overflowBelow` moves the threshold; `minVisible: n` pins the first `n`
items and overflows the rest. At the default the collapse is a container query with no observer
installed; any other threshold installs a `ResizeObserver`, which is the cost of asking for one.

The current item is the neutral `--zx-color-bg-current` fill with the text colour and a semibold
label; item badges are neutral counts. Only the brand mark keeps the accent.
