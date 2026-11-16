# TreeView

A hierarchy following the APG tree pattern: arrow-key navigation, expand and collapse, typeahead, lazy children, and optional tri-state checkboxes.

Full reference: https://zx.zeyos.com/docs/llms.md · Live demo: https://zx.zeyos.com/docs.html#components/tree · All components: https://zx.zeyos.com/docs/components/index.md

Hierarchical tree implementing the APG **tree** pattern. Rows render as a flat list carrying
`aria-level`/`aria-setsize`/`aria-posinset` (the flattened variant the APG allows) rather than
nested `role="group"` containers. The component clones `items`, so lazily loaded children never
mutate the caller's data.

- **Options** — `items` (nested), `valueKey: 'ID'`, `labelKey: 'name'`, `childrenKey: 'children'`,
  `expanded: []`, `selection: 'single'|'multi'|false`, `selected: []`, `checkboxes: false`
  (tri-state), `checked: []`, `icons: true`, `renderLabel`, `load: (node)=>Promise<children>`
  (lazy children; mark a branch with `hasChildren: true`), `filter`, `emptyText`, `height`,
  `rowActions: (node) => actions`, `moreLabel`. Unset, `label`, `emptyText` and `moreLabel` read the
  `tree.label`, `tree.noItems` and `tree.more` messages; `tree.empty` still wins over `emptyText`, and
  `emptyText: null` shows no text.
- **Row actions** — `rowActions(node)` returns the row's commands: `{icon, label, onSelect(node),
  disabled?, danger?}` descriptors, or nodes of your own placed as given. One or two show as icon
  buttons at the row's end; with more, the first shows and the rest fold into a "More actions"
  menu (a node never folds). They rest out of sight and keep their room, and show while the row is
  pointed at, focused or selected, while its menu is open, and always on a touch screen, under a
  contrast preference and in forced colours — the `data-zx-reveal` utility. Every descriptor is
  also in the row's context menu (right-click, Shift+F10, the Menu key), and each control is named
  after its action and its row ("Add sub-page: Onboarding"); the row's own name stays its label.
  Use them only for repeated, secondary commands that are reachable another way too.
- **Methods** — `setItems()`, `getItems()`, `getNode(id)`, `getPath(id)`, `setFilter(query)` (keeps
  matching nodes' ancestors and opens the surviving branches),
  `expand(id)`/`collapse(id)`/`toggle(id)` (async — they await the loader),
  `expandAll()`/`collapseAll()`, `reveal(id)`, `select(id, {additive})`,
  `getSelection()`/`setSelection()`/`clearSelection()`, `check(id, checked)`,
  `getChecked({leavesOnly})`, `setChecked()`, `focusNode(id)`.
- **Events** — `select {node, id, ids}`, `expand`, `collapse`, `activate {node, id}` (Enter or
  double-click), `check {ids, node}`.
- **Keyboard** — ↑/↓ move, → expands then descends, ← collapses then ascends, Home/End, Enter
  activates, Space selects or toggles the checkbox, `*` expands every sibling, typing jumps to the
  next match. A typed character's default action is prevented, so find-as-you-type and page
  shortcuts do not act on it too; typing into a control inside a row is left to that control.
  With row actions, Tab from the focused row walks that row's actions and then leaves the tree
  (Shift+Tab comes back); keys pressed on an action belong to it, and clicking one neither selects
  nor focuses the row.
- **Appearance** — the selected node of a single-selection tree is where you are: the neutral
  `--zx-color-bg-current` fill, the text colour, a semibold label. A `selection: 'multi'` tree is a
  set of picks and keeps the accent tint. Icons, folders included, are drawn in
  `--zx-color-text-subtle`; badges are plain muted counts.
