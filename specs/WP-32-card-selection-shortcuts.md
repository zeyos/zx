# WP32 — Card selection and shortcut hints

Review work in the current checkout; publishing and commits of unrelated work are out of scope.

## Scope

- `src/components/card-view/card-view.js`, `record-card.js`, `card-view.css`
- `src/components/kanban-view/kanban-view.js`, `kanban-view.css`
- `src/components/button/button.js`, `button.css`; `src/components/dialog/dialog.js`
- `tests/unit/card-view.test.js`, `tests/smoke/smoke.js`
- `website/demos/card-view.demo.js`, `website/demos/button.demo.js`
- `docs/llms.md`, generated `docs/api.json`

## Contract

CardView and KanbanView add `selectionTrigger:'checkbox'|'card'`, defaulting to existing checkbox
behavior. In card mode selectable card backgrounds toggle selection on click, Enter or Space;
Shift+click retains range selection. Interactive descendants and text selection do not toggle.
The shared card anatomy omits the checkbox in this mode and retains semantic list items, native
links and an accessible selection description. Read-only views do not acquire selection behavior.

Buttons accept `shortcut:{label,keys}` for a visible key hint, native hover title and
`aria-keyshortcuts`. Dialog footer buttons use the same rendering. Hints never install global
handlers; application scopes own keyboard dispatch, editing guards, permission checks and cleanup.

## Validation

Unit and browser checks cover checkbox omission, pointer and keyboard selection, interactive
descendant guards, shortcut semantics and disposal. Review both themes/densities. Run token lint,
declaration generation and regenerate API docs. No dependency, core or backend changes.
