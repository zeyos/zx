# DataFilter

The filter bar above a list: typed filter descriptors in, the matching rows out.

Full reference: https://zx.zeyos.com/docs/llms.md · Live demo: https://zx.zeyos.com/docs.html#components/data-filter · All components: https://zx.zeyos.com/docs/components/index.md

Declarative client-side filter bar producing a filtered array, commonly wired to a Table with
`onfilter: (e) => table.setData(e.detail.rows)`.

- **Options** — `filters: [{ type: 'select'|'text'|'custom', id, label, field(s)|get, options?,
  predicate?, emptyLabel?, placeholder? }]`, `data`, `autoApply: true`, `clearLabel`.
- **Messages** — `dataFilter.clear` ("Clear", unless `clearLabel` is given) and `dataFilter.all`
  ("All", a select filter's empty option unless it sets `emptyLabel`).
- **Methods** — `setData()`, `apply()` → rows, `clear()`, `getState()`, `setState()`,
  `addFilter()`.
- **Events** — `filter {rows, state}`.
