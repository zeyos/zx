# stack() / grid() / aspect()

The small pieces under Panel and SplitView: consistent spacing, a grid that reflows on its own width rather than the viewport, and a fixed-ratio box.

Full reference: https://zx.zeyos.com/docs/llms.md · Live demo: https://zx.zeyos.com/docs.html#components/layout · All components: https://zx.zeyos.com/docs/components/index.md

The small layout pieces that sit under Panel, SplitView, and MasterPanel: consistent spacing, a
grid that reflows on its own width, and a fixed-ratio box. Zx ships no page grid on purpose — an
ERP screen is a shell of panels, and those components already own that layer. All three are
factories returning elements, and all three are plain classes that work just as well in static
markup with no JavaScript.

- **Factories** — `stack(options, ...children)`, `grid(options, ...children)`,
  `aspect(options, ...children)`; the classes are `.zx-stack`, `.zx-grid`, `.zx-aspect`.
- **stack options** — `direction: 'column'|'row'`, `gap: 4` (1–8 picks the matching `--zx-space-*`
  step; any other value is used as a CSS length), `align: 'start'|'center'|'end'|'stretch'|
  'baseline'`, `justify: 'start'|'center'|'end'|'between'|'around'`, `wrap: false`,
  `inline: false`, `class: ''`.
- **grid options** — `columns: null` (the count at full width; null fills each row with as many
  `min`-wide tracks as fit), `min: '16rem'` (a number is read as pixels), `gap: 4`,
  `align: 'start'|'center'|'end'|'stretch'`, `class: ''`.
- **aspect options** — `ratio: '16 / 9'`, `fit: 'cover'|'contain'|'fill'`, `class: ''`.
- **Behaviour** — the grid reflows intrinsically: each track asks for its share of the row but
  never goes below `min`, so `auto-fit` drops one column at a time as the container narrows. No
  media query is involved, which is why a grid behaves the same in a full-width page, a split
  pane, and a modal — the usual reason a "responsive" grid still breaks inside a narrow panel.
- **Breakpoints** — `breakpoints` (`sm: 480`, `md: 768`, `lg: 1024`, `xl: 1280`),
  `breakpointOf(width)` → `'xs'|'sm'|'md'|'lg'|'xl'`, `matchBreakpoint(name, width)` (the script
  equivalent of a `min-width` query), and `onBreakpoint(handler, {target})` → `{current, destroy}`,
  which fires immediately and then on every crossing. `target` defaults to the window but takes an
  **element**, watched with a `ResizeObserver` — inside a split pane the viewport width says
  nothing about the space actually available. The scale lives in JavaScript rather than as tokens
  because a CSS custom property cannot be used inside a media query.
