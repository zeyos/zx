# ApprovalCard

A request that holds an agent’s run until a person answers it: what will happen, a preview of what it produces, and Approve, Edit, and Reject.

Full reference: https://zx.zeyos.com/docs/llms.md · Live demo: https://zx.zeyos.com/docs.html#components/approval-card · All components: https://zx.zeyos.com/docs/components/index.md

A request that holds an agent's run until a person answers it: what the agent wants to do, what
will happen, a preview of what it produces, and Approve, Edit, and Reject. Answered, it freezes
into the record of what was decided, by whom, and when. The card never acts on its own — it emits
the answer, and the application carries it out.

- **Options** — `title`, `description`, `icon: null` (an icon name for the tinted tile), `tone:
  'blue'` (`slate|blue|teal|green|amber|orange|red|pink|violet`), `headingLevel: 3`,
  `status: 'pending'|'approved'|'rejected'|'expired'`, `details: Node|Block[]|null` (recipients,
  amounts, records), `preview: {label, content: Node|Block[]}|null` (behind a disclosure; `blocks`
  is accepted for `content`, as the thread model spells it), `fields: Record<string,
  FieldOptions>|null` (the Edit form — no fields, no Edit), `values: {}`, `confirmText: null`,
  `reason: 'optional'|'required'|'none'` (whether Reject asks why), `answeredBy: null` (the verdict's
  "you" when null), `answeredAt: null` (local ISO date-time or Date), `edited: false`,
  `editedKeys: null` and `rejectReason: null` (for a card restored from a record), `now: null`
  (a `() => Date` clock), `keys: true`, and `msg`.
- **Edited values** — `edited: true` lists every field under "Edited by you"; `editedKeys:
  ['subject']` lists only those (in field order) and on its own marks the card edited. The card's
  own Edit flow keeps `editedKeys` as the union of every save so far, so a restored card and a
  card edited in place list the same thing.
- **Events** — `approve {values}`, `edit {values, changed, editedKeys}`, `reject {reason}`, all
  **preventable** (on the component or on the bubbling `zx-*` event). Unless `approve` or `reject`
  is prevented the card moves to its answered state; a saved `edit` keeps it pending and adopts
  the values. `changed` names the fields this save changed. `editedKeys` is the union the card
  will list (null when it lists every field), so the application can store it with the record.
  Prevent an answer to refuse or defer it, then settle the card with `setStatus()`.
- **Methods** — `update(partial)` changes any of `title`, `description`, `icon`, `tone`,
  `details`, `preview`, `fields`, `values`, `confirmText`, `reason`, `edited`, `editedKeys` in
  place (see below); `setStatus(status, {by?, at?, reason?})` (emits nothing; `at` defaults to
  now; closes any of the card's open dialogs), `getStatus()`, `getValues()` (a copy, edits
  included), `getEditedKeys()` (`[]` when not edited, `null` when every field is listed),
  `focus()` (the root is `tabindex="-1"`, so a thread can move focus to a request when a run
  starts waiting), `handleKey(event)` → `boolean`, and `destroy()` (also destroys the card's
  dialogs, including an open confirmation).
- **Update in place** — `update()` is for a request the agent revises while it waits, or a record
  that changed. It redraws only what changed: values equal to what is drawn (compared by content,
  so a fresh copy of the same blocks or fields counts as equal) are left alone, and focus stays
  where it was. When the focused control goes away (Edit when `fields` go, the preview toggle when
  `preview` goes), focus moves to the card. A change closes a dialog only when the dialog no
  longer applies: new `fields` close the Edit form, a new `reason` closes the Reject dialog, a new
  `confirmText` closes the typed confirmation without approving. An open Edit form stays open over
  new `values`. Status goes through `setStatus()`. `update()` emits nothing.
- **Approve** — with `confirmText`, Approve first opens `Dialog.confirm({confirmText, danger:
  true})` titled with the card's title; only a confirmed approval emits `approve`.
- **Reject** — `reason: 'optional'` asks in a dialog with a textarea and accepts an empty answer;
  `'required'` keeps the Reject button disabled until the reason is non-empty; `'none'` rejects at
  once with `reason: ''`. Mod+Enter submits the Reject and Edit dialogs.
- **Answered state** — no actions; the line under the title becomes the verdict ("Approved by you
  at 10:31"; the date is added when it is not today, by the `now` clock); the edited values and
  the reason (as a quote) stay. An answer given on the card, or a `setStatus()` without `at`,
  takes its time from `now`. `data-state` is the status, and the state pill is a `statusIcon()`
  glyph plus its word (waiting, done, skipped, stopped glyphs for pending, approved, rejected,
  expired).
- **Keyboard** — A approves, E edits, R rejects, only while focus is inside the pending card, not
  in a text control, with no modifier held, and while none of the card's dialogs is open. The card
  binds no document key: an application that wants them from elsewhere forwards the event to
  `handleKey(event)`, which returns true and prevents the default when it used the key.
  `keys: false` stops the card listening on itself (and drops the key hints on its buttons).
- **Accessibility** — `role="group"` labelled by the title heading and described by the
  description and the state line; a pending card says "The run is paused until you answer."
  (message `approvalCard.paused`). The preview toggle follows the APG Disclosure pattern.
- **Consequence comes from the application** — whether an action needs `confirmText` (or
  `reason: 'required'`) is decided by the application from the tool the action triggers. It is
  never taken from model output: an agent that could set its own confirmation could also waive it.
