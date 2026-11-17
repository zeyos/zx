# KanbanView

A semantic opportunity board sharing fields, cards, sort, selection, and serializable configuration with the other record views.

Full reference: https://zx.zeyos.com/docs/llms.md · Live demo: https://zx.zeyos.com/docs.html#components/kanban-view · All components: https://zx.zeyos.com/docs/components/index.md

A semantic record board with explicit or data-derived columns, optional swim lanes, shared record
cards, advisory work-in-progress limits, and equivalent pointer/programmatic/keyboard movement.

- **Options** — the shared RecordView options plus `columnBy`, `columns`, `swimlaneBy`,
  `swimlanes`, card title/subtitle/preview/link/actions, `moveMode: 'local'|'external'`,
  `columnOrder`, `swimlaneOrder`, collapsed IDs, `showCounts`, `showEmptyColumns`, `variant`, and
  `label`. Column/lane descriptors use stable `id`, `label`, optional stored `value`, and `accept`;
  columns may also declare an advisory `limit`.
- **Selection trigger** — `selectionTrigger:'card'` provides the same checkbox-free click and
  keyboard selection as CardView. The default remains `'checkbox'`.
- **Methods** — configure/get/move columns and swim lanes, collapse either axis, and
  `moveRecord(id,{column?,lane?,index?})`. Board-specific order/collapse joins the common view
  state; record order, movement history, and selection do not. Saved preferences for data-derived
  axes survive an empty/partial result set and reconcile as later records introduce their IDs.
- **Dense board layout** — bounded muted columns use a stable 20rem rail with native horizontal
  overflow, 48px headings, compact counts, 8–12px card padding, and 8px card gaps. Surface cards
  use an optional square thumbnail and a two-tier hierarchy from shared card field slots:
  `eyebrow-start`, `eyebrow-end`, and `title-prefix`. Unslotted metadata stays as quiet inline
  facts. Titles clamp visually to two lines while retaining their complete accessible text. Move
  and action controls reveal on hover/focus/selection/grab, and remain visible on touch devices.
- **Assignees** — `assignees` faces (a name, names, or `{name, src?, initials?, tone?}`) are drawn
  like a small Avatar: initials on the tint `avatarTone(name)` picks, so a person has the same
  colour on the board as in every Avatar; a descriptor's own `tone` wins. A descriptor with `face`
  (AgentAvatar traits, or `true`) is an agent, drawn as its generated face.
- **Movement boundary** — `recordmove {record,id,from,to,column,swimlane,limitExceeded}` is
  cancelable and fires before a commit/request; either the component event or bubbling
  `zx-recordmove` mirror may veto it. `accept` is a hard eligibility gate; WIP is visual advice.
  Local mode clones the moved record and never mutates host data, and a manual local move clears an
  active local sort so saved state matches visible order. External mode emits only, for server
  validation and optimistic rollback owned by ZeyOS.
- **Keyboard** — focus the move handle; Enter/Space grabs or drops, Escape cancels, Left/Right
  chooses a column, Up/Down chooses a bucket-relative position, and Alt+Up/Down chooses a swim
  lane. A polite live region announces every target, result, and reached/exceeded WIP limit.
  Collapse keeps focus on its control, including when a programmatic collapse hides the focused
  card. Native drag is an enhancement. The pointer-drag preview and a keyboard-grabbed card lift
  on `--zx-drag-shadow`.
