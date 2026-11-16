# Finder

A Miller-columns browser: every column lists the children of the row picked to its left, the way a file browser’s column view works.

Full reference: https://zx.zeyos.com/docs/llms.md · Live demo: https://zx.zeyos.com/docs.html#components/finder · All components: https://zx.zeyos.com/docs/components/index.md

Miller-columns hierarchy browser: each column lists the children of the row selected in the column
to its left, like the macOS Finder's column view. The columns are linked listboxes sharing **one**
tab stop. The constructor applies `path` silently, so read `getNodes()` for the first paint of any
breadcrumb.

- **Options** — `items` (the same nested shape as `TreeView`), `valueKey`, `labelKey`,
  `childrenKey`, `path: []` (initial selection, root first), `load: (node)=>Promise<children>`,
  `preview: (node)=>Node|null` (renders a pane after the last column for a selected leaf),
  `rootLabel`, `columnWidth: 220`, `height: 320`, `icons: true`, `renderItem`, `emptyText` (unset, the
  `finder.noItems` message; `null` shows no text).
- **Methods** — `getPath()`, `getNodes()`, `getSelection()`, `setPath(ids, {silent, focus})`
  (async — loads every branch along the way), `reveal(id)`, `setItems()`, `focus()`.
- **Events** — `change {path, nodes, node}`, `activate {node, id}`.
- **Keyboard** — ↑/↓ move within the active column, → steps into the selected branch and lands on
  its first row, ← returns to the parent column and truncates the path, Home/End, Enter opens a
  leaf, typing jumps to the next match.
- **Appearance** — the selected row of each column is the path you are on: the neutral
  `--zx-color-bg-current` fill, the text colour and a semibold label, with subtle icons and
  column dividers.
