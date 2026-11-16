# Rating

A star rating built as a radio group: one tab stop, arrow-key selection, optional half steps, and a read-only display mode.

Full reference: https://zx.zeyos.com/docs/llms.md · Live demo: https://zx.zeyos.com/docs.html#components/rating · All components: https://zx.zeyos.com/docs/components/index.md

Star rating built as an APG **radio group**: one radio per selectable step, a single tab stop,
arrow-key selection. Field type: `rating`.

- **Options** — `value: 0` (0 = unrated), `max: 5`, `allowHalf: false` (renders two radios per
  symbol so every reachable value has a nameable control), `clearable: true` (re-selecting the
  current value clears it), `readonly`, `disabled`, `label: 'Rating'`, `icon: 'star'`,
  `labels: []` (per-step accessible names, lowest first), `showValue: false`, `count` (rating
  count shown beside the value), `size: 'sm'|'md'|'lg'`.
- **Methods** — `get()`, `set(value, {silent})`, `clear()`, `reset()`, `setCount()`,
  `setReadonly()`, `focus()`, `enable()`/`disable()`.
- **Events** — `change {value}`, `hover {value|null}` (pointer or focus preview; null on leave).
- **Keyboard** — ←/↓ and →/↑ step, Home selects the first step, End the last, Delete/Backspace
  clear.
