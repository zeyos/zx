# StatTile — `statTile(options)` / `StatTile`

A labelled number: the metric loud, the label small above it, and — when there is one — a signed change that says which way it went without claiming that way is good.

Full reference: https://zx.zeyos.com/docs/llms.md · Live demo: https://zx.zeyos.com/docs.html#components/stat-tile · All components: https://zx.zeyos.com/docs/components/index.md

A labelled number with optional delta, trend and icon: the most-copied snippet in any
application UI, and the reason competing template products advertise a card count rather than a
component count. `statTile()` is the convenience form of `new StatTile(null, options)` and
returns the component, the way `tooltip()` does; call `.toElement()` for the node to place.

- **Options** — `label`, `value`, `format: 'number'|'currency'|'percent'|'fileSize'|null|fn`,
  `currency`, `locale`, `caption`, `delta`, `deltaKind: 'positive'|'negative'|'neutral'`,
  `deltaFormat`, `deltaLabel`, `trend: number[]`, `icon`, `kind`, `variant: 'default'|'plain'`,
  `emphasis`, `href`, `clickable`, `loading`, `msg`.
- **Appearance** — the label is a sentence-case muted line (13px, medium); the value is the loud
  part (24px, weight 650, tabular figures); `caption` is one muted context line under it ("of
  13,184"). `icon` is a muted glyph beside the label, never a coloured chip; `kind` tints only the
  sparkline. The tile is a column with the sparkline at its foot, so tiles in a row are the same
  height and line up whether or not each has a caption, a delta or a trend.
- **Framed or plain** — the default is a framed tile on its own surface: use it where a figure
  stands among other content, as on a dashboard. `variant: 'plain'` drops the frame, the fill and
  the padding, for a record's own figures under its title: its text sits on the content edge,
  space alone separates it from the next, and the figure steps down to 16px. Do not draw boxes
  around plain figures in the layout either. Reflected as `data-variant`.
- **One figure leads** — `emphasis: true` sets one figure per row above the others: 24px in a
  plain row (the record title's size, never above it), 30px on a framed tile. Reflected as
  `data-emphasis`. The size is `--zx-stat-tile-value-size`, which the loading skeleton reads too.
- **Methods** — `update(options)`, `getAccessibleName()`.
- **Events** — `click {event}`.

- **A delta is never colour alone.** It carries its sign and a direction glyph, and `deltaKind`
  decides the colour rather than the sign — rising ticket counts are not a success, and a
  component that assumes "up is good" is wrong for half the metrics in any business.
- **The accessible name is label + value (with its caption) + spoken delta** ("Active items,
  2,184 of 13,184, up 2 vs. last week"). The visible
  `+2` row and the sparkline are `aria-hidden`, because a sparkline nobody can read is
  decoration and saying the delta twice is worse than saying it once.
- **The element follows the behaviour** — `href` renders an `<a>`, `onclick` without `href` a
  `<button>`, neither a `<div>` with `role="group"`. Never a div with a click handler.
  `clickable: true` renders the button without an `onclick` option, for subscribing with
  `on('click', …)`. An explicit `clickable: false` wins over `onclick`: the tile stays a `<div>`
  and the handler is never called, for a caller that always passes a handler and decides per tile
  whether it applies. It never turns a tile with an `href` into anything but a link. Leave
  `onclick` out, rather than passing an empty function, for a tile that does nothing.
- **`loading: true` renders a skeleton shaped like the tile**, not a spinner.

Nothing in it assumes a fixed set of buckets or a fixed label: the content of a dashboard tile
is the instance's, not the library's.
