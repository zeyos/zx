# WP53 — Trust: review what changes, suggest before writing, stop where you say

In a business suite an agent is only as useful as the trust people can place in what it does to
their records. WP51 shows what an agent did (its trace, its sources) and lets a person approve one
request. This WP adds the controls that make delegation safe. A person can:

- review proposed record changes field by field and accept only some;
- see an agent's suggestions in a form before they become values;
- set checkpoints in a plan;
- pause and redirect a run;
- undo a commit during a short grace period;
- set what an agent may touch;
- trace any figure to the call that produced it;
- hand a selection to the agent as context;
- let the agent point at a part of the screen without acting on it.

Work in the current checkout, on top of WP51 (§1 also serves WP52's `diff` node when WP52 has
landed). **Do not commit**: this lands after central review. `AGENTS.md`, the WP40 and WP45 design
rules, and WP42 apply. `src/core/**` is **not** in scope. `CHANGELOG.md` is central: report
changelog lines. `docs/api.json` is regenerated, never hand-edited. Public files must not mention
this spec.

## Decisions (binding)

1. **A suggestion is never a value until a person accepts it.**
   - Suggested form values are shown in place but excluded from `getValues()` and from submit,
     until they are accepted.
   - Typing into a suggested field makes the person's input the value.
2. **Selective, not all-or-nothing.** Wherever an agent proposes several changes, a person can
   accept any subset. "Accept all" is a convenience, never the only way.
3. **The component records intent; the application enforces it.**
   - A checkpoint, a pause, a grant or a steering note is an event to the application. The
     application's runtime pauses, refuses or redirects the agent.
   - Every component shows the state the application confirms: a checkpoint shows as set when the
     application has it, and a steering note reads as applied once acknowledged.
4. **Undo is the application's promise.** Components offer Undo only for changes marked
   `reversible`, and only within the window the application gives. Nothing claims reversibility it
   cannot deliver.
5. **The agent may point; it never acts.** A pointer highlights an element the application opted in
   (`data-zx-anchor`). It moves no focus, clicks nothing, and is dismissed with Escape.
6. **No new global keys.** Every key below acts only while focus is inside its component.

## §1 · ChangeReview

**Scope:** new `src/components/change-review/change-review.{js,css}`, new
`src/internal/text-diff.js`, `website/demos/change-review.demo.js`,
`tests/unit/text-diff.test.js`, `tests/unit/change-review.test.js`, `docs/llms.md`.

- **Options:**
  - `changes`: a list of `{id, ref: {entity, id, title}, field, label, before, after,
    format?: 'text'|'number'|'currency'|'date'|'status', currency?, status:
    'proposed'|'applied'|'rejected'|'reverted', reversible?: boolean}`.
  - `mode: 'proposal'|'receipt'`.
  - `selectable: true`.
  - `undoUntil: null`: a `Date`. In receipt mode, Undo is offered until then.
  - `resolve: {ref}`: renders the record title as an EntityRef.
  - `locale`, `msg`.
- **Rendering:**
  - Changes are grouped by record, under a group header with the record and a tri-state "select
    all of this record" checkbox (`indeterminate`).
  - Each row has a native checkbox, the field label, the before value, an arrow, and the after
    value.
  - A visually hidden sentence reads "<field> changes from <before> to <after>".
  - Long text values show a word diff with `<del>`/`<ins>`.
  - Values are formatted with the display formats.
- **Events:**
  - `selectionchange {ids}`.
  - `apply {ids}` and `reject {ids}`, both **preventable**.
  - `revert {ids}`.
- **Methods:** `setChanges`, `select(ids)`, `getSelected()`, `setStatus(ids, status)`.
- **Receipt mode:**
  - It lists applied changes with their status.
  - It offers "Undo" for the reversible ones while `undoUntil` lies ahead, and the time left reads
    as words, updated each minute.
- **Accessibility:**
  - A semantic `<table>` with row headers.
  - Native checkboxes; no custom grid and no `aria-checked` on rows.
  - The action buttons sit after the table.
- **`text-diff.js`:** `diffWords(a, b, {max: 2000})` → segments. It is an LCS over words, falls
  back to a whole replacement above `max`, and is pure.
- **Unit tests:**
  - `diffWords`: identical input, insertions, deletions, a replacement, and the `max` fallback.
  - The grouping and tri-state logic.
- **WP52:** when WP52 has landed, its `diff` input node renders through ChangeReview.

## §2 · Suggested values in Form

**Scope:** `src/components/form/**`, `website/demos/form.demo.js`,
`tests/unit/form-suggestions.test.js`, `tests/smoke/smoke.js`, `docs/llms.md` (Form).

- **New methods:**
  - On Form and Fieldset: `suggest(map)`, where `map` is `{key: {value, source?, reason?}}`;
    `getSuggestions()`; `acceptSuggestion(key)`; `acceptAllSuggestions()`;
    `dismissSuggestion(key)`; `clearSuggestions()`.
  - On Field: `setSuggestion(s|null)` and `getSuggestion()`.
- **Showing a suggestion:**
  - The suggested value is shown in the control, and the Field wrapper carries
    `data-state="suggested"`.
  - A small "Suggested" mark has a Tooltip with `source` and `reason`, beside two icon buttons,
    "Accept suggestion: <label>" and "Dismiss suggestion: <label>".
  - The style is quiet: an accent-tinted underline on the control and the mark in the muted ink,
    with no fill.
- **What becomes a value:**
  - Accepting makes the suggestion the value (one `change`). Dismissing restores the earlier value.
  - Editing the control drops the suggestion, and the edit is the value.
  - `getValues()` excludes pending suggestions unless called with `{withSuggestions: true}`.
  - The `submit` event detail adds `pendingSuggestions: [keys]`.
- **Types:** suggestions work for every built-in and registered field type through the adapter's
  `set`/`get`. Types without a visible value (`hidden`) refuse suggestions.
- **Events:** `suggestion {key, action: 'accept'|'dismiss'|'override'}`.
- **Unit tests:** excluded from `getValues`, accept, dismiss, override by edit, and
  `pendingSuggestions` on submit.

## §3 · PlanList with checkpoints

**Scope:** new `src/components/plan-list/plan-list.{js,css}`, `website/demos/plan-list.demo.js`,
`docs/llms.md`.

- **Options:**
  - `steps`: a list of `{id, label, owner?, status, ms?, checkpoint?: boolean}`, where `owner` is an
    author key and `status` uses the WP51 statuses.
  - `authors`, `editable: false`, `checkpoints: true`, `msg`.
- **Editing:** while `editable`, steps can be renamed (inline text field), removed, added ("Add
  step") and reordered by dragging or Alt+ArrowUp and Alt+ArrowDown.
- **Checkpoints:**
  - A toggle button per step (`aria-pressed`), named "Ask me before: <step>", sets a checkpoint.
  - A step with a checkpoint shows a glyph and the word "Asks you first".
  - A running plan that reaches it shows `waiting` as the application reports it.
- **Events:** `change {steps}`, `checkpoint {id, on}`, `reorder {ids}`.
- **Methods:** `setSteps`, `upsert(step)`, `focusStep(id)`.
- **Accessibility:** an ordered list. Reordering announces "Moved <step> to position 3 of 6"
  through a polite status.

## §4 · Pause and steer

**Scope:** `src/components/run-status/**`, `src/components/composer/**`, their demos,
`docs/llms.md`.

- **RunStatus:**
  - `state: 'paused'` is drawn.
  - The new option `controls: ['pause', 'stop']` adds Pause/Resume and Stop buttons, which emit
    `pause`, `resume` and `stop`.
- **Composer:**
  - The new option `steer: false`. While `busy` and `steer`, the submit key emits `steer {id,
    text}` instead of `send`.
  - The note shows as a pending chip, "Applies at the next step", until the application calls
    `ackSteer(id)`; it then reads "Applied". `dropSteer(id)` removes it.
  - Stop stays on Escape and on the button.

## §5 · Grace-period commits

**Scope:** `src/components/message/**`, `website/demos/message.demo.js`, `docs/llms.md`
(Message).

- **`Message.show()` option `countdown: seconds`** (with an `action`):
  - The message reads "<text> in 10 s", and its action is usually "Undo".
  - When the countdown ends without the action, the handle's `committed` promise resolves.
  - The existing rule holds: hover or focus inside pauses the countdown.
  - Only the start and the end are announced. Under reduced motion there is no moving bar, and the
    seconds update as text.
- **`graceCommit({message, seconds, commit, undo?})`** → `Promise<'committed'|'undone'>`. It runs
  `commit` when the countdown ends, and `undo` (when given) if Undo was chosen after an early
  commit.

## §6 · GrantList

**Scope:** new `src/components/grant-list/grant-list.{js,css}`,
`website/demos/grant-list.demo.js`, `docs/llms.md`.

- **Options:**
  - `grants`: a list of `{id, icon?, label, description?, access, choices?}`, where `access` is
    `'never'|'ask'|'allow-run'|'allow'|'read'`.
  - `readonly: false`, `msg`.
- **Rendering:** each grant is a row: glyph, label, description, and a segmented radio group of its
  choices (default Never · Ask · Allow for this run). Read-only grants show their access as text.
- **Events:** `change {id, access}`, which is **preventable**.
- **Accessibility:** one APG radio group per row, named by its label, with arrow keys inside the
  group.

## §7 · Trace a figure; selection as context

**Scope:** `src/components/block-view/**`, `src/components/stat-tile/**` (one option),
`src/components/agent-thread/**`, `src/components/composer/**`, `docs/llms.md`.

- **Tracing a figure:**
  - A `figures` row and a `stat` may carry `call: id`. The value then becomes a quiet button with
    the tooltip "Show where this comes from", which emits `trace {call}`.
  - AgentThread routes `trace` to `RunTrace.reveal(call)`.
  - StatTile gains `onTrace` only (no visual change without it).
- **Selection as context:**
  - `contextChip({entity, ids, label})` builds a Composer context chip from a selection, and the
    chip names the count ("3 invoices").
  - Sending passes the chip's `ref` in `send.context`.
  - The demo wires a TableView selection to a Composer.

## §8 · Pointer

**Scope:** new `src/components/pointer/pointer.{js,css}`, `website/demos/pointer.demo.js`,
`docs/llms.md`.

- **`pointTo(root, anchor, {text, placement?})`** → `{close()}`. It finds `[data-zx-anchor="…"]`
  inside `root`, scrolls it into view, and draws an outline around it plus a small callout with
  `text` (as text), positioned through `position()`.
- **Dismissal:** Escape, the callout's close button, or any click outside closes it.
- **Restrictions:** it never takes focus from where it is, except into the callout when opened by
  the keyboard. It never triggers the anchor.
- **Unknown anchors:** an unknown anchor returns `null` and draws nothing.
- **Motion:** none under reduced motion.
- **Accessibility:** the callout is a `role="note"` with an `aria-describedby` link to the anchor,
  and a polite status reads "Pointing at: <anchor's accessible name>".

## §9 · Layouts

**Scope:** `website/layouts/{agent-chat,agent-workspace,record-wizard}.layout.{js,css}`.

- **`agent-chat`:**
  - "Data it may touch" becomes a GrantList.
  - An approved send runs through `graceCommit` (10 s, Undo).
  - Figures trace to their calls.
- **`agent-workspace`:**
  - The task plan is a PlanList with one checkpoint set.
  - The task view gets Pause and Resume.
  - The chat composer steers a running task.
- **`record-wizard`:**
  - "Fill from the last order" suggests the contact fields instead of writing them.
  - The review step shows a ChangeReview receipt of what the assistant filled.
- All three pass `tools/shoot-layout.js` and `tools/audit-layout.js` at 1440 and 390, light and
  dark.

## Out of scope

- Enforcing anything server-side.
- A memory inspector, multi-agent hand-off contracts, and cost forecasting before a run.
- Version history of records.
- An agent operating the UI: clicking, typing or navigating for the person.
- Suggestions inside Table cell editors and Grid.

## Acceptance criteria

1. `npm test` and `npm run test:browser` pass; `node tools/check-site.js` and `git diff --check`
   are clean.
2. Unit tests cover `diffWords`, the ChangeReview selection logic and Form suggestions as listed,
   and `tests/unit/type-bindings.test.js` passes for every new component.
3. Smoke cases:
   - Selective apply in ChangeReview.
   - A pending suggestion is not submitted, and an accepted one is.
   - PlanList keyboard reorder.
   - A countdown pauses on hover and focus.
   - GrantList arrow keys stay inside a row.
   - `pointTo` never moves focus on pointer use, and closes on Escape.
   - Create and destroy twice leaves the DOM as found for each new component.
4. The three layouts pass as stated in §9.
5. Changelog lines are reported.
