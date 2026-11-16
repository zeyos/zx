# ContextMenu

Right-click menu for a region or a row.

Full reference: https://zx.zeyos.com/docs/llms.md · Live demo: https://zx.zeyos.com/docs.html#components/context-menu · All components: https://zx.zeyos.com/docs/components/index.md

Right-click menu for a region or a row, implementing the APG menu pattern. Attaches to an existing
element and never changes it: the menu lives in the top layer, anchored to a zero-sized element
parked at the pointer, so it flips near a viewport edge like every other floating panel.

- **Constructor** — `new ContextMenu(target, options)` where `target` is an element or selector.
  Unlike most components the target is not enhanced or replaced; `destroy()` removes only the
  anchor the menu created.
- **Options** — `items: []` uses the same headings, separators, links, descriptions, trailing
  metadata, checked roles, and ordinary action shape MenuButton takes, **or a function**
  `(context) => items` called on
  every opening so a row menu can disable the actions that row does not allow; returning an empty
  array cancels the opening and leaves the platform menu alone. `selector: null` restricts the
  menu to matching descendants and reports the matched element as the context — a table passes
  `'tbody tr'` here and needs one instance, not one per row.
- **Methods** — `setItems(items)`, `openAt(x, y, context?)` (viewport coordinates),
  `openAtElement(element)`, `close()`, `isOpen()`, `getContext()`.
- **Events** — `select {value, item, context}`, `open {context}`, `close`. Subscribe with
  `menu.on('select', …)` or the `onselect` option: the component's root is the anchor on
  `<body>`, so the bubbling `zx-select` DOM event is dispatched there and not through the
  region the menu belongs to — delegation on the target will not see it.
- **Keyboard** — the Menu key and Shift+F10 open the menu at the focused element, which is the
  half most pointer-only context menus miss. Arrows move between items, typing jumps to one by its
  first letters, Enter and Space activate, Escape and Tab close — and closing returns focus to
  wherever it came from.
- **Cancellation** — `select` is cancelable just like MenuButton. Preventing it suppresses the
  item callback and native navigation and leaves the context menu open.
