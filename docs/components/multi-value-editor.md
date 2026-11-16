# MultiValueEditor

A stack of rows for an ordered list of values, each row with its own remove and reorder controls — for a field that repeats.

Full reference: https://zx.zeyos.com/docs/llms.md · Live demo: https://zx.zeyos.com/docs.html#components/multi-value-editor · All components: https://zx.zeyos.com/docs/components/index.md

Ordered value editor with explicit rows (add / remove / move).

- **Options** — `values`, `options` (allowed values, which turns the rows into selects),
  `addLabel`, `reorder: 'both'` (`'both'` | `'buttons'` | `'drag'` | `'none'` — a drag handle, the
  up/down buttons, both, or neither).
- **Methods** — `getValues()`, `setValues()`.
- **Events** — `change {values}`.
- Dragging goes through a dedicated handle, so text selection inside a row's input still works. The
  handle is also a keyboard control (Arrow keys, Home, End), which is what keeps `reorder: 'drag'`
  operable without a pointer.
