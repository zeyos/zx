# Breadcrumb

The trail of ancestors above the current page, with the middle levels collapsing into an ellipsis menu when there is no room for all of them.

Full reference: https://zx.zeyos.com/docs/llms.md · Live demo: https://zx.zeyos.com/docs.html#components/breadcrumb · All components: https://zx.zeyos.com/docs/components/index.md

The trail above a hierarchy view. It pairs directly with `Finder` and `TreeView`: feed
`getNodes()` from a Finder's `change` event into `setItems()` and the two stay in step. When
`maxVisible` is exceeded the middle collapses behind an ellipsis `MenuButton`, always keeping the
first and last items.

- **Options** — `items: [{name, label, icon?, href?}]`, `maxVisible: 0` (0 shows all),
  `separator: 'chevron'|'slash'`, `rootIcon: null`.
- **Methods** — `setItems()`, `getItems()`, `push(item)`, `pop()`, `truncateTo(name)`, `destroy()`.
- **Events** — `select {name, item, index}` **preventable**, including overflow items. An item
  with an `href` renders as a real `<a>` in the trail or overflow, and its
  default is left alone, so ordinary navigation and middle-click still work; without one it renders
  as a `<button>` and only the event fires.
- **Semantics** — `<nav aria-label="Breadcrumb"><ol>`; the last item is plain text carrying
  `aria-current="page"` and is deliberately not interactive; separators are `aria-hidden`.
