# CardView

A compact responsive record collection sharing fields, sort, selection, visibility, order, and serializable state with TableView and KanbanView.

Full reference: https://zx.zeyos.com/docs/llms.md · Live demo: https://zx.zeyos.com/docs.html#components/card-view · All components: https://zx.zeyos.com/docs/components/index.md

A responsive semantic record collection using the same fields, records, sort, selection, and
portable state as TableView and KanbanView.

- **Options** — the shared RecordView options plus `titleField`, `subtitleField`, `preview`,
  `previewAlt`, `link`, `actions`, `groupBy`, `groupOrder`, `minCardWidth`, `maxColumns`,
  `variant: 'outlined'|'raised'|'filled'`, `loadingCount`, `headingLevel`, `label` (null
  resolves message `cardView.label`, "Card view"), `keyboard: 'tabs'|'roving'` (default `'tabs'`),
  `collapsibleGroups`, `collapsedGroups`, and `renderGroupHeading`.
- **Methods** — the shared RecordView methods plus `setGroupCollapsed(id, collapsed, {silent})` and
  `getCollapsedGroups()`. **Events** — the shared set plus `recordaction` and
  `groupcollapse {id, collapsed, collapsedGroups}` (also a `statechange` with reason
  `'groupcollapse'`). The view state carries `collapsedGroups`.
- **Messages** — `cardView.label`, `cardView.sort`, `cardView.sortCards`, `cardView.unsorted`,
  `cardView.sortAscending`/`cardView.sortDescending` (`%1` the field), `cardView.ungrouped`
  ("Ungrouped"), `cardView.groupEmpty` ("No records in this group."), `table.empty` for the empty
  collection ("No records", shared with Table), and the card's own `recordCard.select`,
  `recordCard.actions` (`%1` the title), `recordCard.untitled`, `recordCard.selected`,
  `recordCard.notSelected`. English comes from the default catalogue; override per instance
  through `msg`, or for every instance through `setTranslator()`.
- **Selection trigger** — `selectionTrigger:'checkbox'` preserves existing selection behavior.
  With `'card'`, selectable backgrounds toggle on click, Enter or Space, Shift+click selects a range,
  and the checkbox is omitted. Links, actions and text selection keep their native behavior. Selection
  remains announced through the card's ARIA description. This option also works in KanbanView.
- **Cards** — each record is a focusable `<li>` with a native title link, separate secondary
  actions, optional native multi-select checkbox, labelled metadata, and a global ARIA selection
  description that retains valid listitem semantics.
  CardView uses a dense collection rhythm: titles clamp to two lines, previews stay at
  thumbnail/avatar scale, and visible fields become compact labelled metadata chips. Title/subtitle
  fields are not duplicated in metadata unless their field sets `duplicate:true`.
- **Shared card slots** — a visible field may set
  `view.card.slot: 'eyebrow-start'|'eyebrow-end'|'title-prefix'`. These slots create a semantic
  eyebrow row or put labelled content immediately before (and outside) the title heading/link.
  Unknown slots remain ordinary metadata; visibility and field order still control rendering.
- **Media and URLs** — `preview` accepts a field ID or callback returning an image URL,
  `{src,alt,fit}`, Node, or null. Executable/non-image schemes are rejected and image failures show
  a stable fallback. Title/action links are normalized; `_blank` links receive `noopener`.
- **Grouping and layout** — `groupBy` is a field ID or callback; `groupOrder` may deliberately show
  empty groups. Cards reflow through container queries and may cap columns without viewport logic.
- **Keyboard model** — `keyboard: 'roving'` is the recommended setting for lists; `'tabs'` stays the
  default for compatibility, and makes every card, title link, checkbox, and action its own Tab
  stop (44 stops for 22 selectable cards). `'roving'` follows the WAI-ARIA APG **Grid** pattern with
  row focus, the same model as `Table`: the content is `role="grid"` (`aria-multiselectable` for
  `multi`), each card a `row` with `aria-selected` when selectable, and the collection is one Tab
  stop. Grid rather than listbox because a card holds a link and buttons, which a listbox option
  would flatten. ArrowUp/ArrowDown move to the card above or below — columns are measured from the
  rendered positions, and the column you travel in is remembered — ArrowLeft/ArrowRight within a
  row, Home/End to the first or last card, PageUp/PageDown by a visible page. Enter activates
  (`recordclick`), Space toggles selection in `selectable` modes (activates otherwise),
  Shift+movement extends a `multi` selection, Ctrl/Cmd+A selects every rendered card. Title links,
  checkboxes, and actions get `tabindex="-1"`: they still work with the pointer, and Enter on the
  card is the keyboard route. The current card is kept by record id across `setData`, sorting,
  grouping, and collapsing, and focus is restored with `preventScroll`. Focus shows as an inset
  `--zx-focus-ring` with a transparent outline for forced-colors mode.
- **Group headings** — `renderGroupHeading({id, label, count, records, collapsed, toggle})` returns
  the heading content in place of the label. `collapsibleGroups: true` makes each heading an APG
  disclosure: a button with `aria-expanded` and `aria-controls` pointing at the group's list, which
  holds the label (and so the custom content, which must then not contain interactive elements).
  A collapsed group keeps its heading and renders no cards; `collapsedGroups` sets the initial
  ones. In the roving model a collapsible heading is a row in the arrow-key order: Enter or Space
  toggles it, ArrowLeft collapses, ArrowRight expands, and collapsing the group of the focused card
  moves focus to its heading.
- **Interaction** — By default Enter activates a focused card; Space toggles selection. With
  `selectionTrigger:'card'`, Enter also toggles selection. Links, actions,
  selection controls, and selected text do not also activate the card. `recordaction` adds the
  resolved action to the shared event set.
- **Appearance** — a selected card is a pick and keeps the accent: the `--zx-color-bg-selected`
  tint inside an accent outline. Metadata pairs are borderless tinted chips, not boxes in a box.
