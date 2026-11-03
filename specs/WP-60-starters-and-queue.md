# WP60 — Conversation starters and queued messages

Two everyday parts of a conversation with an agent are still missing from the kit. Conversation
starters exist only as layout code inside `ai-chat`. And while an agent works, Composer's Send
button becomes Stop, so a person who thinks of the next request has to hold it until the run
ends. This WP adds both.

Work on the branch `wp/60-starters-and-queue`, from `main`. `AGENTS.md` applies. `src/core/**` is
**not** in scope, except `src/core/messages.js` for new keys only. `CHANGELOG.md` is central:
report changelog lines. `docs/api.json` is regenerated. Public files must not mention this spec.

## Decisions (binding)

1. **A starter is a button that fills or sends; the application decides which.** PromptStarters
   reports the pick. It never sends anything itself.
2. **Queued means "after this run", nothing else.** A queued message is sent only when the agent is
   no longer busy, one at a time, in order. The person can edit or remove any queued message until
   it is sent.
3. **The queue is session state.** It is not persisted with the draft, and `destroy()` drops it.
4. **AgentThread is not changed.** Queued messages live in the Composer until they are sent; only a
   sent message becomes a thread item.

## §1 · PromptStarters

**Scope:** new `src/components/prompt-starters/prompt-starters.{js,css}`, `src/index.js`,
`styles/zx.css`, new `website/demos/prompt-starters.demo.js`, `website/docs.js`
(`COMPONENT_IDS`), `website/layouts/ai-chat.layout.{js,css}`, `tests/smoke/smoke.js`,
`docs/llms.md`, `src/core/messages.js`.

- **Options:** `items: [{id, title, text, description?, icon?}]`, `label` (the group's accessible
  name, default `promptStarters.label`, "Suggestions"), `columns: 'auto'|1|2` (`'auto'` is two
  columns, one in a narrow container, through a container query), `headingLevel: null`.
- **Rendering:** a labelled group of buttons, each with its title and, muted beneath, its
  `description` or else its `text` clamped to two lines. Icons go through `icon()`.
- **Methods:** `setItems(items)`.
- **Events:** `pick {item}`.
- **Keyboard:** each starter is a button in the Tab order. There are no custom keys.
- **`ai-chat`:** its empty state uses PromptStarters instead of its own markup, and its own
  suggestion CSS is removed. A pick sends, as it does today. The layout still passes
  `tools/shoot-layout.js` and `tools/audit-layout.js` at 1440 and 390, light and dark.

## §2 · Queued messages in Composer

**Scope:** `src/components/composer/**`, new `src/components/composer/queue.js`,
`tests/unit/composer-queue.test.js`, `website/demos/composer.demo.js`, `tests/smoke/smoke.js`,
`docs/llms.md`, `src/core/messages.js`.

- **Options:** `queue: false`, `queueLimit: 10`.
- **While busy, with `queue: true`:**
  - Enter (or Mod+Enter, following the Composer's send key) adds the draft to the queue and clears
    the input; the button stays Stop. Escape still stops the run.
  - The queue shows above the input as a list labelled "Queued (2)", each row with its text on one
    line, Edit and Remove. Edit takes the text back into the input and removes the row; with text
    already in the input, it asks first through `Dialog.confirm`.
  - At `queueLimit`, sending is refused and the hint says why.
  - A polite announcement says "Queued; sends when the agent finishes" once per added message.
- **When busy ends** (`setBusy(false)`): the first queued message is sent as a normal `send` with
  `queued: true` in its detail. The next waits for the next time busy ends.
- **Stop** does not clear the queue; `clearQueue()` does.
- **Methods:** `getQueue()`, `clearQueue()`, `removeQueued(id)`.
- **Events:** `queue {item, items}` when one is added, `dequeue {item, items, reason:
  'sent'|'removed'|'edited'|'cleared'}`.
- **`queue.js`:** the pure queue (add, remove, take the next, limit), unit-tested.
- **Keyboard:** the queue list is reachable by Tab. Its rows use the APG toolbar pattern for their
  two buttons, and Delete on a focused row removes it.
- **Demo:** a simulated agent that stays busy for a few seconds, so a reader can queue two
  messages and watch them send in order.

## Out of scope

- Starters drawn by AgentThread itself, and starters chosen by a model.
- Queued messages shown in the thread, reordering the queue, and persisting it.
- Sending queued messages in parallel.

## Acceptance criteria

1. `npm test` and `npm run test:browser` pass; `node tools/check-site.js` and `git diff --check`
   are clean; the `ai-chat` layout passes both layout tools as stated.
2. Unit tests cover the queue: order, the limit, removal, taking the next, clearing.
3. Smoke cases:
   - a starter pick emits `pick` with its item, and the group has its accessible name;
   - queueing while busy, editing and removing a queued message, and the queue sending one
     message per end of busy, in order;
   - Stop keeping the queue;
   - create and destroy twice leaving the DOM as found, for both components.
4. Both demos work in light and dark with no console errors.
5. Changelog lines are reported.
