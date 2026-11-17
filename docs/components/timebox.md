# Timebox

A duration field.

Full reference: https://zx.zeyos.com/docs/llms.md · Live demo: https://zx.zeyos.com/docs.html#components/timebox · All components: https://zx.zeyos.com/docs/components/index.md

Duration input (H:MM[:SS], optional sign) — a length of time, not a time of day. For a time of day
use `TimePicker` or `DateTimeBox`.

- **Options** — `value: 0`, `unit: 'minutes'|'seconds'|'hours'`, `seconds: false`, `signed: false`,
  `disabled`.
- **Methods** — `get(unit)`, `set(value, unit?, {silent})`, `focus()` (the hours segment),
  `enable()`/`disable()`.
- **Events** — `change {value}`, in `options.unit`.
- **Also exported** — the pure helpers `splitTime` and `joinTime`.
- **Quiet fields** — inside `[data-zx-fields="quiet"]` the segments (native inputs) and the sign
  button drop their border and fill until hover or focus; the sign keeps its colour.
