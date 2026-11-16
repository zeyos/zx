# Pagination

The footer bar of a server-backed list: a page window that never changes width, a page-size select with an Auto size that fits the viewport, a row summary, an append-style Load more mode, and an Auto-load switch for infinite scrolling.

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

**Fitting the page.** `pageSize: 'auto'` (and `'auto'` among `pageSizes`, shown as "Auto (14)")
shows as many rows as fit `viewport`, the element the rows scroll in, below its sticky `thead`. It
measures again whenever the viewport or its content changes size — a window, a drawer, the row height,
a table stacking into cards — and keeps the page's first row on the new page. A Zx Table is
measured by its first body row, anything else by `--zx-row-height`; `rowHeight`, `perRow` (a card
grid's columns) and `reserve` take numbers or functions of the viewport for other content. Call
`refit()` after swapping what the viewport shows.

**Auto-load.** `autoLoad: true` turns paging into infinite scroll: the next page loads by itself
when the end of the viewport (or, without one, the pager) comes within `autoLoadMargin` pixels —
half the viewport by default. `showAutoLoad: true` adds an Auto-load switch, so the reader chooses;
switching between paging and appending returns to page 1. Load more stays as the keyboard's way on.
Disable the pager while a page is in flight and enable it when the rows land; auto-load waits:

```js
const pager = new Pagination(footer, { pageSize: 'auto', pageSizes: ['auto', 25, 50], viewport: list, showAutoLoad: true });
pager.on('change', async ({ detail }) => {
  pager.disable();
  // Appending adds one page; paging shows one; restarting an appending list shows all loaded so far.
  const from = detail.append || detail.mode === 'pages' ? detail.offset : 0;
  const rows = await fetchRows(from, detail.offset + detail.pageSize - from);
  if (detail.append) table.addData(rows); else table.setData(rows);
  pager.enable();
});
```

- **Options** — `page: 1`, `pageSize: 25` (or `'auto'`), `total: 0`, `pageSizes: [25, 50, 100]`
  (may include `'auto'`), `siblings: 1`, `boundaries: 1`, `showPageSize: true`, `showSummary: true`
  (renders "26–50 of 312"), `mode: 'pages'|'loadmore'`, `autoLoad: false`, `showAutoLoad: false`,
  `viewport: null` (element, selector, or function), `rowHeight`, `perRow: 1`, `reserve`,
  `minPageSize: 5`, `maxPageSize: 200`, `autoLoadMargin: null`, `disabled: false`.
- **Methods** — `setPage(n)`, `setTotal(n)`, `setPageSize(n|'auto')`, `setState({page, pageSize,
  total}, {silent})`, `setAutoLoad(on, {silent})`, `refit()`, `getState()` → `{page, pageSize,
  total, pages, offset, auto, autoLoad, mode}`, `enable()`/`disable()`, `destroy()`.
- **Events** — `change {page, pageSize, offset, total, pages, auto, autoLoad, mode, reason,
  append}`, where `reason` is `page`, `pageSize`, `fit`, `more`, `scroll`, `mode`, or `state`, and
  `append` means "add rows `offset … offset + pageSize` after the shown ones" (otherwise show rows
  `offset …` while paging, `0 … page × pageSize` while appending). `autoload {autoLoad}` when the
  switch flips.
- **Also exported** — `paginationRange({page, pages, siblings, boundaries})` → `Array<number|'…'>`,
  the pure page-window calculation, and `fitPageSize({available, rowHeight, perRow, reserve, min,
  max})` → the fitted size (0 when nothing can be measured), both usable on their own.
- **Semantics** — `<nav aria-label="Pagination">`; the current page carries `aria-current="page"`;
  previous/next are labelled icon buttons that go `disabled` at the ends; the ellipses are
  `aria-hidden` spans, not buttons.
- **Appearance** — the summary and the page-size select sit together at the start of the bar,
  the pager alone at the end; the current page is the neutral `--zx-color-bg-current` fill with a
  semibold figure: where you are, not a call to action.
