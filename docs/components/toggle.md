# Toggle

A labelled switch for settings that take effect immediately.

Full reference: https://zx.zeyos.com/docs/llms.md · Live demo: https://zx.zeyos.com/docs.html#components/toggle · All components: https://zx.zeyos.com/docs/components/index.md

Switch (`role="switch"`, `aria-checked`).

- **Options** — `checked: false`, `value: true`, `label: null`, `hideLabel: false`,
  `disabled: false`.
- **Label** — start-aligned and wrapping like text within the available width, the track level
  with its first line. It is the switch's accessible name. `hideLabel: true` keeps it for assistive
  technology only: no visible text, and the label becomes the switch's `aria-label` — for a switch
  whose meaning the layout already shows, such as a table cell under a column header. With no
  label at all, name the switch from outside: a Field or `<label for>` around it, or
  `aria-labelledby` on the element.
- **Methods** — `get()`, `set(checked, {silent})`, `toggle()`, `getValue()` (returns
  `options.value` when on, `false` when off), `setLabel(label)` (null removes it),
  `enable()`/`disable()`.
- **Events** — `change {checked, value}`.
- **Keyboard** — Space/Enter.
