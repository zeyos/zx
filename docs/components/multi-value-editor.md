# MultiValueEditor

A stack of rows for an ordered list of values, each row with its own remove and reorder controls — for a field that repeats.

Full reference: https://zx.zeyos.com/docs/llms.md · Live demo: https://zx.zeyos.com/docs.html#components/multi-value-editor · All components: https://zx.zeyos.com/docs/components/index.md

Ordered value editor with explicit rows (add / remove / move).

- **Options** — `values`, `options` (allowed values, which turns the rows into selects),
  `addLabel`, `reorder: 'both'` (`'both'` | `'buttons'` | `'drag'` | `'none'` — a drag handle, the
  up/down buttons, both, or neither), `disabled: false`.
- **Methods** — `getValues()`, `setValues(values, {silent})`, `setDisabled(bool)`,
  `enable()`/`disable()`, `isDisabled()`. Disabled, every value input or select, handle, move and
  remove button and the add button is disabled (`aria-disabled="true"` on the root) and nothing
  reorders; values can still be set from code.
- **Events** — `change {values}`.
- Dragging goes through a dedicated handle, so text selection inside a row's input still works. The
  handle is also a keyboard control (Arrow keys, Home, End), which is what keeps `reorder: 'drag'`
  operable without a pointer.
