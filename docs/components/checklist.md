# Checklist

A searchable list of checkboxes for picking several records at once, with a static or an asynchronously loaded set of items.

Full reference: https://zx.zeyos.com/docs/llms.md · Live demo: https://zx.zeyos.com/docs.html#components/checklist · All components: https://zx.zeyos.com/docs/components/index.md

Searchable multi-check list with optional async loading.

- **Options** — `items`, `valueKey: 'ID'`, `labelKey: 'name'`, `checkedKey: 'on'`, `search: true`,
  `height: 280`, `defaultChecked: false`, `label: null` (heading text and the group's accessible
  name; null uses the `checklist.label` message), `disabled: false`, `hideLabel: false` (leaves out
  the heading; the group keeps its text as `aria-label`), `load: async ()=>items`.
- **In a Field** — field type `checklist` draws no heading of its own: the field's label names the
  group (`aria-labelledby`).
- **Methods** — `setItems()`, `getValues()`, `setValues(ids)`, `checkAll()`/`uncheckAll()`,
  `search(query)`, `reload()`, `setLabel(text)`, `enable()`/`disable()`, `isDisabled()`. Disabled,
  the search field and every checkbox are disabled (`aria-disabled="true"` on the group) through
  searches, `setItems()` and reloads; values can still be set from code.
- **Events** — `change {values}`, `loaded`.
