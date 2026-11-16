# Button — `button(options)` / `buttonGroup(buttons)`

Factories that return a real `<button>`, in four weights and two sizes.

Full reference: https://zx.zeyos.com/docs/llms.md · Live demo: https://zx.zeyos.com/docs.html#components/button · All components: https://zx.zeyos.com/docs/components/index.md

Factories (not classes) returning elements, used both standalone and as the
`buttons: [{ label, kind, action|onclick }]` descriptors Dialog, Modal, Panel, and MasterPanel
accept.

- **`button(options)`** → `HTMLButtonElement`. Options: `label`, `icon` (an icon name), `kind:
  'default'|'primary'|'danger'|'ghost'`, `size: 'md'|'sm'`, `disabled`, `title`, `onclick`.
- **Shortcut hints** — `shortcut: {label:'N', keys:'N'}` adds a visible key hint, hover text and
  `aria-keyshortcuts`. The host binds the action and owns editing/modality/permission guards;
  a hint never installs a global handler. Dialog and Sheet footer descriptors accept it too.
- **`buttonGroup([button(…), …])`** → a container that joins the buttons into one control.
- **Appearance** — `primary` is the screen's one solid accent and reads the
  `--zx-color-accent-solid*` roles, so in dark it keeps the deep stop with white ink rather than a
  bright slab. A `ghost` button's icon is drawn in `--zx-color-text-subtle` until hovered. A button
  with `aria-pressed="true"` (a Toolbar item with `active`, a view toggle) is a mode, not a pick:
  it stays neutral, never the accent, and is drawn with a stronger fill plus a frame in
  `--zx-color-text-subtle` (3:1 against its neighbours in both themes), so a pressed segment of a
  `buttonGroup` is told apart without relying on the fill alone.
