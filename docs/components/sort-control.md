# SortControl

A searchable field selector with an adjacent direction toggle.

Full reference: https://zx.zeyos.com/docs/llms.md · Live demo: https://zx.zeyos.com/docs.html#components/sort-control · All components: https://zx.zeyos.com/docs/components/index.md

A searchable field selector with an adjacent icon button to reverse the direction. Each field
appears once. Changing fields preserves direction; toggling direction preserves the field. Built
from `Select`, with its themed popover and keyboard behavior.

- **Options** — `fields: [{id,label}]`, `value: {id,dir:'asc'|'desc'}` (null selects the first field
  ascending), `label` (by default the `sortControl.label` message, and `null` gives no name), `labels: {asc,desc}` to override
  the `sortControl.ascending` and `sortControl.descending` messages, `disabled`.
- **Methods** — defensive `getValue()`, `setValue(value,{silent})`, `enable()`, `disable()`,
  `focus()`, `destroy()`. Unknown fields or directions are rejected. An empty catalogue disables
  selection and returns null.
- **Keyboard** — Tab reaches the direction button and field selector; Space/Enter toggle the
  focused direction button. The field retains Select’s combobox keyboard map. The button’s
  accessible name includes the current direction; its hover title shows current → next direction.
- **Events** — one `change {value:{id,dir}}` event per changed field or direction. Typed search text does
  not change the sort. The application applies the resulting state to its table, data source or route.
