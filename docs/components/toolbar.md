# Toolbar — APG toolbar

One tab stop, arrow-key navigation, and an overflow menu that swallows what no longer fits.

Full reference: https://zx.zeyos.com/docs/llms.md · Live demo: https://zx.zeyos.com/docs.html#components/toolbar · All components: https://zx.zeyos.com/docs/components/index.md

A single non-wrapping row of controls that is one tab stop: arrows move between the controls, and
what no longer fits collapses into a trailing overflow menu. Items are `button()` descriptors,
ready-made Elements, or `'-'` for a separator; a `ResizeObserver` remeasures the row, hides the
items that overflow — removing them from the tab order and the roving group — and mirrors them into
a `MenuButton`, where choosing one activates the original control.

- **Options** — `items: [Element | '-' | {name, label, icon, kind, size, disabled, title, active,
  onclick}]`, `align: 'start'|'end'|'between'`, `label` (accessible name, by default the `toolbar.label` message),
  `overflow` (default `true`), `overflowLabel` (by default the `toolbar.more` message), `dense`; `null` gives either
  no name. `active` renders the item as a pressed toggle (`aria-pressed`).
- **Methods** — `setItems()`, `getItem(name)`, `enable(name)`, `disable(name)`,
  `setActive(name, active?)`, `destroy()`.
- **Events** — `action {name, item}`, emitted for descriptor-built items in addition to their own
  `onclick`, from the row and from the overflow menu alike.
- **Keyboard** — Tab reaches the toolbar once; ArrowLeft/ArrowRight move between controls and wrap,
  in visual order under `dir="rtl"`; Home/End jump to the first and last control. A text field, select,
  or contenteditable item keeps its own keys: Home/End and the arrows move its caret, and an arrow
  moves on to the neighbouring control only once the caret is at that edge of the text.
- **Pressed items** — an item with `active` renders `aria-pressed="true"` and takes Button's
  neutral pressed fill and frame, never the accent.
