# WP68 — Data view timing, editing and async lifecycle corrections

Branch: `wp/65-library-review-fixes`, from WP65. `AGENTS.md` and WP65 apply.

## Scope

- `src/components/calendar/calendar.js`, `calendar-model.js` in that directory.
- `src/components/code-editor/code-editor.js`
- `src/components/tree/tree.js`, `src/components/finder/finder.js`
- `src/components/kanban-view/kanban-view.js`
- `tests/unit/{calendar,code-editor,tree,finder,kanban-view}.test.js`, and
  `tests/regression/data.js`.

No core/shared documentation edits. Report API/documentation changes to the integration owner.

## Required corrections (P2)

1. **D1: local-clock event positions.** A 10:00–11:00 event displays there on both Vienna DST
   transition days (2026-03-29 and 2026-10-25). Grid positions use local clock plus calendar-day
   offset, not elapsed milliseconds from midnight. Preserve clipping, multi-day spans, collision
   behavior and input immutability.
2. **D2: editor indentation participates in editing.** Tab/Shift+Tab indentation supports native
   undo/redo and committed change on blur, including through Field. Emit input as usual, avoid
   duplicate commit notifications after mixed native/indent edits, retain selection and the Escape
   mechanism for releasing Tab capture. No dependency or custom editor engine.
3. **D3: period navigation retains focus.** A focused time slot retains relative day/time when
   paging, with an available-slot fallback and exactly one roving stop. Preserve existing view and
   date navigation semantics, including public navigation while focus is elsewhere.
4. **D4: keyboard resize keeps a valid draft.** Shortening an event to/before its start is ignored
   or clamped before calling throwing model helpers. Keep the last valid draft, cancellation and
   preventable commit; no uncaught exception on an ordinary arrow key.
5. **D5/D6: stale lazy loads cannot render.** TreeView expansion and Finder interactive selection/
   entry must discard results after destroy or replacement by newer data/work. Restored enhanced
   targets and replacement components remain untouched; no stale events or unhandled rejection.
6. **D7: auto-scroll updates Kanban drop position.** Recalculate destination when scrolling under
   a stationary pointer and at release. Preserve filtered-to-full index mapping, multi-selection,
   cancelable movement and keyboard movement.

## Regression acceptance

Add pure DST/model tests and real-browser tests for native undo/redo and commit, Calendar
ArrowDown/PageDown focus and invalid resize, deferred loads resolved after destruction/data
replacement, and a stationary-pointer Kanban auto-scroll drag. Cover ordinary non-DST dates,
successful async loads, valid resize and unchanged selection. Both themes must pass.

## Out of scope

Table redesign/virtualization changes (review probes passed), Chart.js loading changes, ambiguous
nested FileList events, new dependencies, caller-data mutation policies outside these fixes.
