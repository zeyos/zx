# Grid and `Grid.BillingItems()`

A public Table specialization for domain presets; it inherits sorting, selection, hierarchy, typed formatting, and editing without forking them.

Full reference: https://zx.zeyos.com/docs/llms.md · Live demo: https://zx.zeyos.com/docs.html#components/grid · All components: https://zx.zeyos.com/docs/components/index.md

`Grid` is the public extension point for repeatable data-table presets. It subclasses `Table`
without forking its implementation, so sorting, selection, hierarchy, responsive stacking,
editable cells/rows, loading, events, and teardown keep the Table contract.

- **Constructor** — `new Grid(target, tableOptions)` accepts the complete `Table` API and defaults
  editable cells to a single-click trigger. Pinned columns, header groups, `minWidth`,
  `setExpanded()` and the rule that a click on a control inside a cell raises no `rowclick` are
  Table's and apply unchanged.
- **Preset** — `Grid.BillingItems(target, options)` supplies an editable hierarchical billing
  schema for item, quantity, unit, unit price, currency, and line total. It enables single-click
  editing, hierarchy, row reorder handles, and the column visibility chooser. It returns a `Grid`.
- **Billing options** — `data`, `fields` key overrides, `units`, `currencies`, fallback `currency`,
  `locale`, `decimals`, `columnOverrides`, complete `columns` replacement, `lineTotal(row, changes)`,
  and `oneditcommit` in addition to ordinary Table options.
- **Rows** — default field names are `id`, `parent`, `kind`, `item`, `quantity`, `unit`,
  `unitPrice`, `currency`, and `total`. `kind: 'group'|'subtotal'|'header'|'section'` is read-only;
  other rows are editable. Parent references use Table's flat-data treegrid projection.
- **Calculation boundary** — the default line total is quantity × unit price. Applications own
  taxes, discounts, rounding, subtotal/group recalculation, optimistic persistence, and server
  validation; provide `lineTotal` or cancel `editcommit` when product policy differs.
