# Kbd — `kbd(keys, options)`

Keycaps for every key hint: one construction in buttons, menus, the launcher, and help.

Full reference: https://zx.zeyos.com/docs/llms.md · Live demo: https://zx.zeyos.com/docs.html#components/kbd · All components: https://zx.zeyos.com/docs/components/index.md

A factory (not a class) returning keycaps: one `<kbd class="zx-kbd">` holding a nested
`<kbd class="zx-kbd__key">` per key, which is how HTML marks up a combination. Button shortcuts,
the launcher's hints, and shortcut references all use it, so a key looks the same everywhere.

- **Signature** — `kbd(keys, { size, tone })` → `HTMLElement`. `keys` is a chord written like
  `aria-keyshortcuts` (`'Mod+Shift+K'`; a literal plus as `'Mod++'`) or an array of keys for a
  sequence (`['g', 'i']`). `size: 'md'|'sm'` (`sm` inside buttons and menu rows); `tone:
  'neutral'|'inherit'` (`inherit` draws the caps in the surrounding ink, for a solid button or a
  dark toast). `keyLabels(keys, { apple })` returns the labels without building DOM.
- **Labels** — `Mod` is ⌘ on Apple platforms and Ctrl elsewhere; `Alt`, `Shift`, `Ctrl`,
  `Backspace`, `Delete`, `Tab` become ⌥ ⇧ ⌃ ⌫ ⌦ ⇥ on Apple platforms and words elsewhere; `Enter`,
  `Escape` and the arrows become ↵, Esc, ↑ ↓ ← →; single letters are upper-cased.
- **Look** — a surface fill, one hairline and a 1px foot, the label at the small size and medium
  weight, centred on its capital height; a single key is square. Retint it with `--zx-kbd-ink`,
  `--zx-kbd-fill` and `--zx-kbd-line` on any ancestor.
- **Accessibility** — the caps are presentation. Announce a control's shortcut with
  `aria-keyshortcuts` on the control and mark a hint that repeats it `aria-hidden`.
