# NumberField

A spinbutton with step buttons: bounded ranges, fractional steps, units, and wrapping.

Full reference: https://zx.zeyos.com/docs/llms.md · Live demo: https://zx.zeyos.com/docs.html#components/number-field · All components: https://zx.zeyos.com/docs/components/index.md

Numeric input with decrement/increment buttons, following the APG **spinbutton** pattern. The step
buttons are `tabindex="-1"`/`aria-hidden` pointer affordances — the input itself is the spinbutton.
Field type: `number`.

- **Options** — `value` (number|null), `min`, `max`, `step: 1`, `largeStep: 10` (PageUp/PageDown
  multiplier), `precision` (decimals; derived from `step` when null), `snap: true` (see
  **Snapping**), `wrap: false` (stepping past
  a bound jumps to the other one), `placeholder`, `unit` (suffix rendered inside the control),
  `group: false` (thousands separators while idle), `locale`, `disabled`, `readonly`, `required`,
  `name`.
- **Methods** — `get()`, `set(value, {silent})` (parses strings, snaps to the step grid, clamps to
  the range; `''`/null clear it), `stepUp(n)`, `stepDown(n)`, `setRange(min, max)`,
  `setReadonly()`, `reset()`, `focus()`, `getInput()`, `enable()`/`disable()`.
- **Events** — `change {value}` (committed), `input {value}` (per keystroke, possibly unsnapped).
- **Snapping** — by default a typed or assigned value is moved onto the `step` grid (step 2 turns
  123 into 124) and rounded to the step's decimals. That suits quantities; it is wrong for a value
  that is not a multiple of anything — an identifier, a seed, a measurement. `snap: false` keeps
  the value exactly as entered: `step` is then only what the buttons and arrow keys add, decimals
  are rounded only to an explicit `precision`, and `min`/`max` still clamp.
- **Keyboard** — ↑/↓ one step, PageUp/PageDown `largeStep` steps, Home/End jump to `min`/`max` when
  set (otherwise they keep their caret meaning), Enter commits, wheel steps while focused.
- **Also exported** — `parseNumber(raw)` (accepts `.` and `,` as the decimal separator, ignores
  grouping, returns null for junk) and `snapNumber(value, {min, max, step, precision})`.
- **In a Field** — field type `number` fills the control column like a text input and takes the
  field key as its `name`.
- **Quiet fields** — inside `[data-zx-fields="quiet"]` the number reads as text: no border, no
  fill, the value start-aligned with the quiet values around it, both steppers at the trailing end
  and hidden (kept in the layout so nothing moves) until hover or focus; full chrome on focus.
