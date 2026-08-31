# WP25 — Kanban workflow board

Raises `KanbanView` from a semantic record board to an operational workflow board: pointer **and
touch** movement, atomic multi-card moves, enforceable work-in-progress and transition policy,
ordered visual card rules, local move history, board search, per-column scroll regions, replaceable
presentation, a card context menu, and a complete localizable string surface.

Everything WP20 established stays true. The board remains understandable without drag-and-drop,
every pointer capability keeps its keyboard equivalent, records supplied by the caller are never
mutated, and `moveMode:'external'` never writes local data.

## Files in scope

```
specs/WP-25-kanban-workflow.md
src/components/kanban-view/kanban-policy.js   # new: pure policy, rules, search, history, reorder
src/components/kanban-view/kanban-view.js
src/components/kanban-view/kanban-view.css
src/index.js                                  # exports for the new pure helpers
website/demos/kanban-view.demo.js
tests/unit/kanban-view.test.js
tests/smoke/smoke.js                          # KanbanView case only
CHANGELOG.md                                  # Unreleased entry
```

`src/core/**` is not modified. No other component is modified. `ContextMenu` is consumed as an
existing public component; it is not changed.

## Movement

- **Pointer and touch.** Native HTML5 drag-and-drop is replaced by Pointer Events so the same code
  path serves mouse, pen, and touch. A drag starts after a 4px threshold (mouse/pen) so a press
  that never travels stays a click and text selection still works. On touch, a drag from the card
  body requires a ~350ms long press; a drag from the move handle starts immediately, because the
  handle alone carries `touch-action: none` and therefore never competes with page scrolling.
- `dragFrom: 'card'|'handle'` (default `'card'`) decides whether the whole card is a drag source.
  Interactive descendants (`a, button, input, …`) never start a drag.
- A floating drag preview follows the pointer, is `pointer-events: none`, and is replaceable via
  `renderDragPreview`. Escape and `pointercancel` abort a drag without moving anything.
- Auto-scroll: while dragging near a board inline edge the board scrolls; near a scrollable column's
  block edge that column scrolls. One `requestAnimationFrame` loop, cancelled with the drag.
- **Multi-card moves.** When the grabbed card is part of the current selection and `selectable` is
  `'multi'`, the whole selection moves atomically, preserving its relative order. One `recordmove`
  event, one policy decision, one history entry, one announcement — all cards move or none do.
  `moveRecords(ids, destination)` is the public form; `moveRecord(id, destination)` delegates to it.
- The `recordmove` detail keeps every WP20 field (`record`, `id`, `from`, `to`, `column`,
  `swimlane`, `limitExceeded`) describing the primary record, and adds `records`, `ids`, and
  `moves: {id, from}[]`. Cancelling still vetoes the complete move.

## Policy

Column descriptors gain `laneLimits`, `wipPolicy`, and `from`; lane descriptors gain `limit` and
`from`. The board gains `wipPolicy: 'warn'|'block'` (default `'warn'`, preserving WP20 behavior).

- `from` is a transition allow-list of origin ids; `null`/absent/`['*']` allows any origin. A move
  that stays inside the same column (or lane) is never blocked by that axis's transition rule.
- Limits are evaluated against the destination excluding the moving records: `column.limit` across
  lanes, `column.laneLimits[lane]` inside one cell, and `swimlane.limit` across the lane.
- `wipPolicy:'warn'` keeps WP20 semantics exactly — the move commits and `limitExceeded` reports it.
  `wipPolicy:'block'` refuses the move before the cancelable event. A per-column `wipPolicy`
  overrides the board default.
- Every refusal announces politely and emits `movereject` with `{ids, records, from, to, column,
  swimlane, reason, limit, count}`. `reason` is one of `accept`, `transition`, `wip`, `lane-accept`,
  `lane-transition`, `lane-wip`, `destination`, or `grouping`.
- Policy remains presentation and workflow guidance. It is not authorization: host listeners still
  veto business-invalid moves, and the server remains authoritative.

## Rules

`rules: KanbanRule[]` is an ordered list of `{id, when(record, context), tone, label, icon,
description}`. Every matching rule contributes a badge; the **first** match sets the card's tone,
which paints an inline start marker. Matched ids land on `data-rule`, the tone on `data-rule-tone`,
and rule `description`s join the card's accessible description so the marker is never colour-only.

## Search and filtering

- `search` (string), `searchFields` (ids, default: visible fields plus the title/subtitle sources),
  and `filter(record, index)` narrow which cards render. `setSearch`/`getSearch` and
  `setFilter` are public; `searchchange` reports user edits from the optional built-in control
  (`searchControl: true`).
- A count with no limit shows `matching / total` while a search or filter hides cards, so nothing
  silently disappears. A count that has a limit keeps reporting real capacity — `total / limit` —
  because capacity is about the work in the column, not about what the current search shows.
  Hidden records still exist: destination indices computed from rendered cards are translated back
  to absolute positions inside the column/lane before any move is proposed.
- Search state is interaction, not saved configuration: it never enters `getViewState()`.

## History

`history: true` (default) records committed **local** moves. `undo()`, `redo()`, `canUndo()`,
`canRedo()`, and `clearHistory()` are public; `historyLimit` (default 50) bounds the stack;
`historychange` reports depth. Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z (plus Ctrl+Y) work on the board when
the event target is not a text entry. `setData`, `addData`, `updateRecord`, and `removeRecord` clear
the history: the snapshots describe records the host has just replaced, and reinstating them would
resurrect data the application no longer owns. `moveMode:'external'` records nothing — the
application owns that data — and `canUndo()` is then always false.

## Presentation

- `renderCard`, `renderColumnHeader`, `renderSwimlaneHeader`, `renderColumnEmpty`, and
  `renderDragPreview` each return a `Node` (or a falsy value for the default). The component keeps
  the managed shell in every case: the list item, selection control, action group, move handle,
  drop semantics, collapse control, and heading element are never handed over. A replaced card body
  swaps `aria-labelledby` for an `aria-label` so the card keeps its accessible name.
- `columnHeight` turns each column's card list into its own scroll region of that height.
- `allowAdd` renders a per-column add control that emits `recordadd` with `{column, swimlane}`.
  The board never creates records itself.
- `contextMenu` (`true`, an item array, or a function) attaches a `ContextMenu` scoped to cards
  offering move-to-column and move-to-lane commands filtered by the same policy path, plus any
  application items. It is destroyed with the view.
- `labels` overrides every string the board renders or announces — the shared record-card anatomy
  keeps its own. Values pass through `printf`, so `%name%`, `%target%`, `%position%`, `%count%`,
  and `%limit%` placeholders are available.

## Out of scope

- Card virtualization or bounded rendered DOM. Columns render every matching card.
- A packaged schema-driven card editor, CRUD transport, validation lifecycle, or rank rebalancing.
- Undo of anything but local record movement; server-side moves; optimistic rollback.
- Changes to `RecordView`, `record-card.js`, `ContextMenu`, `src/core/**`, or any other component.

## Acceptance criteria

1. Cards move by mouse, pen, touch, keyboard, context menu, and public API through one policy and
   one commit path; every pointer capability has a keyboard equivalent.
2. A blocked move never mutates data, announces its reason, and emits `movereject` once.
3. A multi-card move commits completely or not at all, keeps relative order, and produces one
   `recordmove`, one history entry, and one announcement.
4. Undo and redo restore the exact previous record order and selection, and never resurrect records
   the host has since replaced.
5. Search and filter hide cards without corrupting move indices: a card dropped between two visible
   cards lands between them in the underlying data.
6. Render hooks replace content without removing the accessible name, the move handle, selection,
   drop targets, or the collapse control.
7. Every string the board itself renders or announces resolves through the `labels` map. The
   shared record-card anatomy keeps its own strings; it is out of scope here.
8. `npm test` and `npm run test:browser` pass; creating and destroying the view twice leaks no
   nodes, listeners, rAF loops, pointer captures, drag previews, or context menus.
