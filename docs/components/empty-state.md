# EmptyState — `emptyState(options)`

The placeholder that stands where content would have been — in a table body, a panel, or a whole page.

Full reference: https://zx.zeyos.com/docs/llms.md · Live demo: https://zx.zeyos.com/docs.html#components/empty-state · All components: https://zx.zeyos.com/docs/components/index.md

A factory (not a class) returning the placeholder shown where a list, table, or panel has no content
yet: an optional decorative icon, a headline, a sentence, and optional actions. The headline is a
paragraph rather than a heading, so dropping one into a Table's empty slot or a Panel body never
disturbs the page's heading outline.

- **Options** — `icon` (an icon name, `null` for none; default `'folder-open'`), `title`,
  `description`, `actions: [Element | buttonOptions]`, `size: 'md'|'sm'`, `align: 'center'|'start'`.
- **Methods** — none. `emptyState(options)` → `HTMLDivElement`, which you own and place yourself.
- **Events** — none; action buttons carry their own `onclick`.
