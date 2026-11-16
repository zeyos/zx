# ActivityList

A chronological ordered collection with stable grouping, incremental updates, and loading/empty states.

Full reference: https://zx.zeyos.com/docs/llms.md · Live demo: https://zx.zeyos.com/docs.html#components/activity-list · All components: https://zx.zeyos.com/docs/components/index.md

An accessible chronological ordered collection with stable grouping, loading/empty states, and
incremental host-controlled mutation. It deliberately preserves source order instead of guessing
whether a feed is newest- or oldest-first.

- **Options** — `items`, `groupBy` (property, resolver, or null), `groupLabel`,
  `label`, `variant: 'default'|'compact'`, `loading`, `loadingCount: 3`, `loadingText`, `emptyText`,
  `groupHeadingLevel`, and `itemHeadingLevel`. Unset, `label`, `loadingText` and `emptyText` read the
  `activityList.*` messages; `loadingText` or `emptyText` set to `null` shows no text.
- **Compact** — `variant: 'compact'` (reflected as `data-variant`) keeps every entry on one line at
  any width, for a summary card narrower than 30rem: actor and title read as one sentence that
  wraps as text, the time keeps the trailing end instead of stacking under the title, an avatar
  descriptor without a `size` is small, and metadata follows as a muted second line.
- **Methods** — `setItems(items,{silent?})`, `getItems()`, `getItem(id)`,
  `appendItems(items,{silent?})`, `prependItems(items,{silent?})`,
  `updateItem(id,values,{silent?})`, `removeItem(id,{silent?})`, `setLoading()`, and `destroy()`.
- **Events** — `datachange {items}` after mutation. Each child's cancelable `zx-action` bubbles
  naturally through the list for delegated application handling.
- **Focus** — entries are regrouped on every mutation; focus on an entry's control returns to the
  same control of the same activity (matched by `id`, else position), so a feed prepending live
  entries does not drop the reader to `<body>`.
- **Grouping** — groups keep first-seen group order and item source order. The exported pure
  `groupActivityItems()` and `normalizeActivityItems()` helpers do not mutate caller arrays.
