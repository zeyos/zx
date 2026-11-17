# TagPicker

A multi-select combobox that keeps its selection visible as removable tags inside the control — for picking several values out of a large catalogue.

Full reference: https://zx.zeyos.com/docs/llms.md · Live demo: https://zx.zeyos.com/docs.html#components/tag-picker · All components: https://zx.zeyos.com/docs/components/index.md

Multi-select combobox that renders its selection as removable tags inside the control (APG combobox
plus multi-selectable listbox). Use it when the catalogue is too large to show in full: `Checklist`
shows a fixed set, and `ValueList` takes free text with no catalogue. Unknown IDs passed to
`setValues` still render as tags, so a stored selection survives a catalogue that has not loaded
yet. Field type: `tagpicker`.

- **Options** — `items`, `values: []`, `valueKey: 'ID'`, `labelKey: 'name'`, `iconKey: 'icon'`,
  `colorKey: 'color'`, `toneKey: 'tone'`, `searchKeys`,
  `filter: 'local'|(query, {signal})=>Promise<items>` (the signal aborts when a newer query
  starts, the list closes, `setItems()` replaces the catalogue, or the picker is destroyed; a late
  result is discarded either way), `minQuery: 0`, `debounce: 200`, `allowCreate: false`,
  `max` (maximum tags; further options become `aria-disabled`), `closeOnSelect: false`,
  `placeholder`, `listHeight: 260`, `disabled`, `readonly`, `renderItem`, `renderTag`.
- **Tags are Badges** — every selected tag is built by `badge()` (`.zx-badge.zx-tag-picker__tag`):
  the Badge's height from the row, 12px medium type, padding and one fill, with the tag shape's
  small corners. `toneKey` names a categorical tone from the Badge palette (`blue`, `teal`,
  `green`, `amber`, `orange`, `red`, `pink`, `violet`, `slate`), so a toned tag is exactly the
  `badge({ tone })` a list row or record header shows for the same item; a tone wins over a colour.
  An untoned tag keeps the text ink, because in a field it is the value.
- **Tag identity** — icon values accept a bundled icon name or Node; colors (a CSS colour or a token
  reference such as `var(--zx-color-tone-blue-fg)`) are scoped to the tag and its option through
  `--zx-tag-color`. An option shows its icon on a tile of its colour; inside a tag the icon is a bare
  glyph, since the tag is already the fill. Custom `renderItem`/`renderTag` remain authoritative.
- **Read-only** — `readonly` (or `setReadonly(true)`) shows only the tags: no input, chevron, or
  remove buttons, so a full row of tags never wraps onto an empty line.
- **Methods** — `getValues()`, `getItems()`, `setValues(values, {silent})`, `addValue()`,
  `removeValue()`, `clear()`, `reset()`, `setItems()`, `isFull()`, `open()`/`close()`, `focus()`,
  `setReadonly()`, `enable()`/`disable()`.
- **Events** — `change {values, items}`, `add {value, item}`, `remove {value, item}`,
  `create {value, item}`, `query {query}`, `open`, `close`.
- **Keyboard** — ↓ opens and moves, ↑ moves, Enter toggles the active option (or creates one from
  the query), Escape closes, Backspace on an empty input removes the last tag, Home/End jump
  within the list.
- **Quiet fields** — inside `[data-zx-fields="quiet"]` the tags read as the value: no border, fill
  or chevron until hover; full field chrome while focused or open.
