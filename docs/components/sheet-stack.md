# SheetStack

A group of Sheets that reads as one drill-down — and stays small, because the browser already stacks dialogs and already makes Escape unwind them one at a time.

Full reference: https://zx.zeyos.com/docs/llms.md · Live demo: https://zx.zeyos.com/docs.html#components/sheet-stack · All components: https://zx.zeyos.com/docs/components/index.md

An ordered group of Sheets that reads as one drill-down. Deliberately tiny, because the browser
already does the hard part: nested dialogs stack in the top layer by open order, so there is no
z-index bookkeeping, and Escape closes only the topmost, so unwinding one level at a time is
native. What is left is which sheet sits at which depth, written onto the elements as `data-depth`
and `--zx-sheet-depth` for CSS to interpret.

Owns no element, so it is a controller rather than a `Component` — constructed with options
alone, `new SheetStack({…})`.

- **Options** — `layout: 'stack'` (`'stack' | 'cascade'`), `offset: 24`, `scale: 0.04`, `max: 3`.
- **Methods** — `push(sheet)`, `pop()`, `popTo(sheet)`, `clear()`, `top()`, `size()`, `sheets()`,
  `has(sheet)`, `on/off/once`, `destroy()`.
- **Events** — `push {sheet, depth}`, `pop {sheet}`. `pop` fires however a sheet left — popped,
  dismissed with Escape, or closed by its own button.
- **Layouts** — `stack` slides each covered sheet back toward its own edge, scales it down, and
  takes it out of the tab order; only the top one is usable, which is the drill-down feel.
  `cascade` shifts each covered sheet clear of the ones in front — by their measured size, not a
  guess — so they sit side by side and all stay usable. `cascade` is usually the right one for an
  ERP screen, where the parent record should stay readable while a line item is edited.
- **Depth** — numbered from the top: the visible sheet is `0`. Past `max` a sheet stops being
  drawn but stays open and in the stack. In a `stack` only the topmost backdrop shades the page;
  one per depth would compound into black. A `cascade` shades nothing — a backdrop paints directly
  beneath its own dialog in the top layer, so the top sheet's would dim exactly the sheets the
  layout exists to keep readable. Pair a cascade with `modal: false` when the page behind it
  should stay live as well.
- **Ownership** — the stack never owns its sheets. `destroy()` empties it and strips the depth
  styling without closing anything.
- **Accessibility** — for `stack`, covered sheets are `inert`. The browser does that on its own
  for stacked *modal* dialogs, but a non-modal stack gets nothing, so the attribute is set either
  way. `cascade` deliberately leaves them interactive.
- **Gotcha** — `close()` on a dialog dispatches its `close` event in a queued task, not
  synchronously. `pop()` therefore removes the sheet from the stack itself rather than waiting for
  the event, so `popTo()` and `clear()` can loop without racing it.
