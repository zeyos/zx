# CheckButton

A button that stays pressed — a checkbox with the presence of a toolbar control.

Full reference: https://zx.zeyos.com/docs/llms.md · Live demo: https://zx.zeyos.com/docs.html#components/check-button · All components: https://zx.zeyos.com/docs/components/index.md

Two-state pressed button on a native `<button aria-pressed>`. The check indicator has a glyph in
both states — an empty box when off, a check when on — so an unpressed or disabled button still
reads as a two-state control. Pressed, the button goes neutral (the `--zx-color-bg-current` fill,
a stronger border, the text colour); only the check glyph, the mark, keeps the accent.

- **Options** — `label: '' | [onLabel, offLabel]`, `checked: false`, `icon: true`,
  `disabled: false`. Prefer one label: the pressed state is announced already, and a name that
  changes with it is read twice over, which the APG toggle-button pattern advises against; an
  on/off setting reads better as a Toggle.
- **Methods** — `get()`, `set(checked, {silent})`, `toggle()`, `setLabel()`, `enable()`/`disable()`.
- **Events** — `change {checked}`, fired only on a real state change.
- **Keyboard** — Space/Enter.
