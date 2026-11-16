# Pagination

The footer bar of a server-backed list: a page window that never changes width, a page-size select, a row summary, and an append-style Load more mode.

Full reference: https://zx.zeyos.com/docs/llms.md · Live demo: https://zx.zeyos.com/docs.html#components/pagination · All components: https://zx.zeyos.com/docs/components/index.md

The pager for a server-backed list. It owns no data: `getState()` and every `change` hand back
the `page`, `pageSize`, and zero-based `offset = (page - 1) * pageSize` a query needs. `page` is
1-based and always clamped into `[1, pages]`; a `total` of 0 is treated as one empty page rather
than zero pages.

The ZeyOS bindings page differently — zero-based, `pageSize: 50`, appending pages above zero — so
driving `zeyosTable()` (or `zeyosView()`) takes one mapping in the `change` listener:

```js
const binding = zeyosTable(client, 'contacts', { pageSize: 25 });
const pager = new Pagination(host, { pageSize: binding.pageSize });
pager.on('change', async ({ detail }) => {
  const result = await binding.load({ page: detail.page - 1, pageSize: detail.pageSize, replace: true });
  pager.setTotal(result.count ?? 0); // silent, so it cannot loop
});
```

In `mode: 'loadmore'` each `change` is one `binding.loadMore()`, which appends.

- **Options** — `page: 1`, `pageSize: 25`, `total: 0`, `pageSizes: [25, 50, 100]`, `siblings: 1`,
  `boundaries: 1`, `showPageSize: true`, `showSummary: true` (renders "26–50 of 312"),
  `mode: 'pages'|'loadmore'`, `disabled: false`.
- **Methods** — `setPage(n)`, `setTotal(n)`, `setPageSize(n)`, `setState({page, pageSize, total},
  {silent})`, `getState()` → `{page, pageSize, total, pages, offset}`, `enable()`/`disable()`,
  `destroy()`.
- **Events** — `change {page, pageSize, offset, total, pages}`, fired for a page change, a
  page-size change (which resets to page 1), and Load more.
- **Also exported** — `paginationRange({page, pages, siblings, boundaries})` → `Array<number|'…'>`,
  the pure page-window calculation, usable on its own.
- **Semantics** — `<nav aria-label="Pagination">`; the current page carries `aria-current="page"`;
  previous/next are labelled icon buttons that go `disabled` at the ends; the ellipses are
  `aria-hidden` spans, not buttons.
- **Appearance** — the summary and the page-size select sit together at the start of the bar,
  the pager alone at the end; the current page is the neutral `--zx-color-bg-current` fill with a
  semibold figure: where you are, not a call to action.
