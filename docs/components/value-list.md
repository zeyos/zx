# ValueList

A chip editor for a list of strings, with per-value validation and drag or keyboard reordering.

Full reference: https://zx.zeyos.com/docs/llms.md · Live demo: https://zx.zeyos.com/docs.html#components/value-list · All components: https://zx.zeyos.com/docs/components/index.md

Tag/chip input. Enter adds a value, Backspace on an empty input removes the last one, and dragging
or Ctrl+Arrow reorders.

- **Options** — `values: []`, `placeholder`, `deletable: true`, `sortable: true`, `unique: true`,
  `validate: (str)=>bool|string`.
- **Methods** — `getValues()`, `setValues()`, `addValue()`, `removeValue()`, `focus()`,
  `enable()`/`disable()`.
- **Events** — `change {values}`, `add {value}`, `remove {value}`.
