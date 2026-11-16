# ViewSettings — the content of a view-settings drawer

The content of a view-settings drawer: arrange and hide the shown fields, add a hidden one back, and choose grouping and the board’s columns and swim lanes.

Full reference: https://zx.zeyos.com/docs/llms.md · Live demo: https://zx.zeyos.com/docs.html#components/view-settings · All components: https://zx.zeyos.com/docs/components/index.md

Which fields a record view shows and in what order, which hidden field to bring back, what the
records are grouped by, and which fields a board uses for columns and swim lanes. It is content,
not a container: put it in a `Sheet`, a `Dropdown`, or a settings page.

- **Options** — `fields: ViewSettingsField[]` (a `ViewField` plus `type`, `groupable`, `locked`),
  `fieldOrder`, `hiddenFields`, `groupBy`, `grouping: boolean|{fields?}`,
  `board: {columnBy, swimlaneBy, showEmptyColumns?, fields?}|false` (`fields` restricts the
  Columns and Swim lanes choices; default: the Group by fields), `sections` (order and presence of
  `'fields'|'grouping'|'board'`), `types: Record<type, {icon?, label?}>`, `searchThreshold` (8),
  `headingLevel` (3), `label`, `msg`.
- **Methods** — `getState()`, `setState(partial, {silent})`, `setFields()`, `getFields()`,
  `showField()`, `hideField()`, `moveField(id, index)`, `bind(view, {board?})`, `unbind()`,
  `focus()`, `destroy()`.
- **Events** — `change {state, reason: 'order'|'visibility'|'group'|'board'}`,
  `fieldorderchange {order}`, `fieldvisibilitychange {visible, hidden}`, `groupchange {field}`,
  `boardchange {board}`.
- **State** — `{fieldOrder, hiddenFields, groupBy, board}`: JSON-safe, ready to persist.

The shown fields are listed in order, each with a drag handle, its type glyph, and a hide button;
the hidden ones follow with an explicit **Add** button, which puts the field at the end of the
shown list. Above `searchThreshold` fields a search narrows the hidden list (label, id, and type
name, ignoring case and accents) and Enter adds the first match. A `locked` field — the record
title — has neither handle nor hide button and keeps its place while the others move around it.
`locked` governs only what the panel offers: a bound view has no such notion, so a locked field the
view hides itself appears under Hidden with Add like any other. The last shown field cannot be
hidden.

Rows reorder by pointer (mouse, touch, and pen share one path: drag the handle, an insertion line
shows where it lands, Escape cancels; near the top or bottom edge of the nearest scroll container,
the container scrolls) and by keyboard on the focused handle: ArrowUp/ArrowDown
move one step, Home/End to the ends, Space or Enter picks the row up and drops it, Escape returns
it. Every move is announced in a polite live region ("Owner moved to position 3 of 6"). A redraw
from outside — `setState()`, `setFields()`, a bound view's change — cancels a pick-up or drag in
progress (announced) and keeps focus on the same field's control.

The type glyph comes from a built-in map that `types` extends: text, number (int, float,
percent), money, date, datetime, time, boolean, select (enum), status, priority, entity, tags,
url, email, image, file, rating. The type name is the glyph's `title` and visually hidden text,
so it is seen and heard. Grouping and the board offer fields with `groupable !== false` and a
discrete type (text, select, status, priority, boolean, entity), or `groupable: true`;
`grouping.fields` restricts the Group by choices.

`bind(view)` connects a `TableView`, `CardView`, or `KanbanView`: it reads the view's fields and
state, pushes order and visibility through `setFieldOrder()`/`setFieldVisible()`, and follows the
view's own `statechange`; `unbind()` releases the view. A panel given its own `fields` lists
those and no others (the title a card draws is not a column to offer); given none, it lists every
field the view has. The view's labels and types win over the panel's descriptors, which add only
`locked`, `groupable`, and a type where the view has just the `'text'` default. While bound the view owns the field list: call the view's `setFields()` — the
panel's own `setFields()` is not pushed and lasts until the view's next change. Grouping and board
changes are only emitted — the host applies them.
