# Slider

A bounded numeric value you set by dragging.

Full reference: https://zx.zeyos.com/docs/llms.md · Live demo: https://zx.zeyos.com/docs.html#components/slider · All components: https://zx.zeyos.com/docs/components/index.md

A bounded numeric value set by dragging — a discount rate, a threshold, a weighting. Built on a
native `<input type="range">`, which is where the whole keyboard map and the announcement come
from; everything Zx adds is chrome around it. Field type: `slider`.

- **Options** — `value: 0`, `min: 0`, `max: 100`, `step: 1`, `label: ''`, `hideLabel: false`,
  `showValue: true`, `showBounds: false` (draws `min` and `max` either side of the track),
  `showInput: false` (adds a number box for entering a value precisely instead of aiming at it),
  `unit: ''`, `marks: null` (numbers, or `{value, label}` objects), `disabled: false`,
  `readonly: false`, `size: 'md'|'sm'`, `formatValue: (value) => string`. Each mark sits under
  the thumb's centre at its value; the outermost labels end flush with the track instead of
  spilling out of the component.
- **Methods** — `get()`, `set(value, {silent})`, `setRange(min, max, step?)`, `setLabel()`,
  `setReadonly()`, `focus()`, `enable()`/`disable()`. `value` is also a getter/setter.
- **Events** — `input {value}` continuously while dragging, `change {value}` once the value is
  committed (pointer released, a range key pressed, or the optional number box committed).
- **Behaviour** — values snap to the step grid anchored at `min`, so 5…95 by 10 gives 5, 15, 25 —
  not 10, 20, 30. Bounds win over the grid, so a `max` that is not a whole number of steps above
  `min` stays reachable. A fractional step snaps to the decimals it carries: 0.1 gives 0.3, never
  0.30000000000000004. `stepPrecision(step)` is exported for the same arithmetic elsewhere;
  snapping itself reuses `snapNumber` from NumberField.
- **Keyboard** — arrows step by `step`, Page Up/Page Down jump, Home and End go to the bounds —
  all native. A read-only slider stays focusable and announced but refuses every edit, pointer and
  keyboard alike; a disabled one leaves the tab order entirely.
