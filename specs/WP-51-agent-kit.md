# WP51 — Agent kit: one data model, the thread, and its parts

Xenon's AI-agent screens exist only as gallery layouts. `ai-chat`, `agent-chat` and
`agent-workspace` (about 6,800 lines of JavaScript between them) each build their own answer
renderer, step timeline, tool-call list, approval card, sources, composer, run panel and presence
animation, and they already disagree: two block vocabularies, two step models, citations that act
in one layout and are inert in the other, two send keys, three status maps. An application that
wants an agent screen today copies a layout.

This WP promotes those parts into library components that share one plain-JSON data model, and
moves the three layouts onto them. It is the base for composable responses (WP52), the trust
features (WP53) and the protocol adapters (WP54); none of those is in scope here.

Work in the current checkout, on top of 5.5.0. **Do not commit**: this lands after central review.
`AGENTS.md`, the WP40 and WP45 design rules, and WP42 (every touched layout from 390px to 1440,
clean under `tools/audit-layout.js`) apply. `src/core/**` is **not** in scope — shared code goes to
`src/internal/` — with one exception: the new English entries in the message catalogue
`src/core/messages.js`, which `tests/unit/messages.test.js` requires for every key a component
resolves. This WP also permits one change to `AGENTS.md`: adding `Agents` to the demo group list in
*Demo modules*. `CHANGELOG.md` is central: report changelog lines instead of writing
them. `docs/api.json` is regenerated (`npm run build:api`), never hand-edited. Public files (source
comments, demos, docs) must not mention this spec or any internal material; `tools/check-site.js`
enforces it.

## Review: what the code does today

- **`ai-chat`** renders answers from a block list (`p`, `quote`, `heading`, `list`, `code`,
  `table`, `artifact`; inline `**bold**` and `` `code` `` only) in `renderBlocks()`, with a small
  syntax highlighter. `workView()`/`stepRow()` draw a "worked for …" disclosure over a step list
  (`{kind, label, doing, detail, ms, sources}`). `sourcesView()` draws source chips that link out,
  with a `Tooltip` card. Answers keep versions (a ‹ 2 / 2 › pager), and offer copy, regenerate,
  branch and rating. The composer's `@`-mentions put `role="combobox"` on the `<textarea>`, which
  ARIA in HTML does not allow. Enter sends, `/` on an empty input opens saved prompts, and ArrowUp
  on an empty input edits the last message. Streaming is simulated with timers and honours
  `prefersReducedMotion()`.
- **`agent-chat`** keeps a conversation as typed items (`user`, `text`, `plan`, `call`, `answer`,
  `approval`). `callList()` draws each tool call as a disclosure row with its arguments and result
  in `<pre>`. A failed call and its retry are two unrelated rows. `approvalCard()` draws the request
  that holds the run: Approve, Edit and Reject, the email preview behind a disclosure, and Dialogs
  for edit and reject. Answered, it stays in the thread as the record. `answerBlock()` has its own
  vocabulary (`p` plus `figures` rows) and draws citations as inert `<sup>`; a separate Sources list
  jumps to the call each source came from. `renderRun()`/`runState()` show state, a steps
  progressbar, started and working time, the data scopes and cost against a budget. Mod+Enter
  sends, Escape stops, and A/E/R are bound on the layout root while an approval is pending.
- **`agent-workspace`** has six agent presences (needs you, blocked, working, thinking, idle,
  offline), animated by `presencePose()` in one shared `presenceLoop()`. The loop uses an
  `IntersectionObserver`, sleeps while the page is hidden, and stops under reduced motion. Its
  execution log draws hand-offs as two avatars joined by a dotted line, and tasks can be paused.
- **Status words** are mapped three times (`STATUS`, `STEP`, `PRESENCE`) over `statusIcon()`.
- **Avatar** already has `status: 'online'|'away'|'busy'|'offline'` with `statusLabel`, which is
  person presence, not agent activity.

## Decisions (binding)

1. **One data model, JSON only.** `src/internal/agent-model.js` declares the typedefs every kit
   component reads, plus the pure helpers below, and nothing else. A thread is a list of items:
   `user`, `text` (agent narration), `answer` (blocks and sources), `trace` (steps), `approval`,
   and `notice` (a one-line event such as stopped, failed or handed over). The type `surface` is
   reserved for WP52. Every item has `id` and `type`, and may have `at` (local ISO date-time) and
   `author` (a key into the thread's `authors`). The model holds no functions and no nodes;
   behaviour comes through component options and events. That is what lets an agent produce the
   model directly.
2. **One block vocabulary.**
   - The types are `p`, `heading` (`level: 2|3`, rendered relative to the host's `headingLevel`),
     `list`, `quote`, `code`, `table`, `figures` (rows of label, detail and value), `callout`
     (`tone: info|success|warning|danger`, drawn with `.zx-callout`) and `artifact` (`id`, `title`,
     `kind: 'document'|'code'`, `versions`).
   - The inline grammar is `**bold**`, `` `code` `` and `[n]` citation markers, and nothing else. A
     backslash escapes `*`, `` ` ``, `[` and itself. An unclosed marker renders literally.
   - Text never carries links or HTML; links arrive as sources.
3. **Streaming appends; finished blocks are never redrawn.** A block view keeps every closed
   block's nodes untouched and re-renders only the open tail block, whose cost is bounded by its own
   length. The library adds no typing animation: text appears as fast as the application feeds it.
4. **Announce milestones, not tokens.** Streamed text is never inside a live region. Each thread
   has one polite status region that says when an agent starts working, answers, needs approval,
   fails or is stopped. While an article streams it carries `aria-busy="true"`.
5. **The application owns transport and state.** No component fetches anything. Components render
   the model they are given, emit intents (`send`, `stop`, `approve`, `regenerate`, …), and change
   only when the application calls `upsert`/`patch`/`appendText`. Options are never mutated.
6. **One status vocabulary.** It is mapped once, in `agent-model.js`, to a `statusIcon()` status, a
   tone and a word:
   - **Run and step status:** `queued`, `running`, `waiting`, `done`, `failed`, `stopped`,
     `skipped`, and `paused` (used from WP53).
   - **Agent activity:** `idle`, `thinking`, `working`, `needs-you`, `blocked`, `offline`.

   Every state is always a glyph plus a word. Motion is never the only signal.
7. **Keys stay local.**
   - The Composer sends on Enter, with Shift+Enter for a new line. `submitKey: 'mod+enter'`
     switches it to the instruction style. Escape in the Composer stops a running agent.
   - Approval keys (A, E, R) act only while focus is inside the pending card, or when the
     application forwards a key to `approvalCard.handleKey(event)`.
   - No kit component binds a document-level key.

## §1 · Data model and BlockView

**Scope:** new `src/internal/agent-model.js`, new `src/internal/highlight.js`, new
`src/components/block-view/block-view.{js,css}`, `website/demos/block-view.demo.js`,
`tests/unit/agent-model.test.js`, `tests/unit/block-view.test.js`, `docs/llms.md` (Agents chapter).

- **`agent-model.js` exports:**
  - The typedefs `ThreadItem`, `Block`, `Source`, `TraceStep`, `Author`, `RunState` and
    `AgentActivity`.
  - `STATUS` and `ACTIVITY` (frozen maps to `{status, tone, label}`).
  - `parseInline(text)` → segments, `blocksToText(blocks)`, `blocksToMarkdown(blocks)`,
    `traceSummary(steps)` → `{label, calls, retries, sources, ms}`, `formatDuration(ms)` and
    `runCost(tokens, price)`. `traceSummary` returns counts (`steps`, `calls`, `retries`, `failed`,
    `sources`, `ms`, `running`, `stopped`); the component that shows them words them through its
    own messages. Message keys are camelCase after the component prefix (`agent.activity.needsYou`),
    as the catalogue requires.
- **`highlight.js`:** the tokenizer moved from `ai-chat` (strings, numbers, comments, keywords per
  grammar: js, ts, json, sql, python, shell, css). It returns segments and never markup; an unknown
  language is plain text.
- **`renderBlocks(blocks, options)`** returns a `DocumentFragment`, for static use.
- **`BlockView`**:
  - **Options:** `blocks`, `headingLevel: 3`, `size: 'sm'` (prose size), `streaming: false`,
    `sources: null` (names the citation buttons), `msg`.
  - **Methods:** `setBlocks(blocks)`, `append(block)`, `appendText(text)` (into the open tail
    paragraph, opening one when needed), `end()`, `stop()` (closes the tail and adds "Stopped
    here"), `toText()`, `toMarkdown()`.
  - **Events:** `cite {n}`, `artifact {id}`, `end`.
- **Rendering:**
  - Code: a figure with a language caption, `copyButton()` and a focusable `<pre>`.
  - Tables: `scope="col"` headers and `align` per column, in a scroll container that is focusable
    only while it overflows.
  - Figures: a `<dl>` with tabular numbers.
  - Artifacts: a button card (glyph, title, kind and version count) emitting `artifact`.
  - Citations: a `<sup>` button named "Source n", or "Source n: <title>" when `sources` are given,
    emitting `cite`. Without a `cite` listener it is plain text.
- **Unit tests:**
  - `parseInline`: bold, code, citations, escapes, unclosed and nested markers, and HTML-looking
    text kept as text.
  - `blocksToMarkdown` and `blocksToText` for every block type.
  - `traceSummary`: calls, retries, sources and summed durations.
  - `formatDuration`: ms, s, and min s.
  - Every `STATUS` and `ACTIVITY` entry has a glyph, a tone and a word.

## §2 · RunTrace

**Scope:** new `src/components/run-trace/run-trace.{js,css}`, `website/demos/run-trace.demo.js`,
`docs/llms.md`.

- **Options:**
  - `steps: TraceStep[]`, where each step is `{id, kind, label, status, doing?, detail?, ms?,
    count?, tool?, args?, result?, error?, retryOf?, actor?, to?, at?}`. `kind` is one of `search`,
    `read`, `query`, `write`, `run`, `call`, `handoff` or `think`.
  - `open: false`, `authors: {}`, `showArguments: true`, `maxResult: 4000`, `msg`.
- **Rendering:**
  - A summary disclosure reads "Worked for 41 s · 5 tool calls · 1 retry" (from `traceSummary`),
    or "Working…" with the running step's `doing` line.
  - Each step with arguments, a result or detail is its own disclosure.
  - A step with `retryOf` is drawn under the step it repeats, labelled "Retried".
  - A `handoff` step shows the two authors' avatars joined by a dotted line, with the words
    "<actor> handed over to <to>".
  - Arguments that parse as JSON are pretty-printed; anything else is shown verbatim.
  - A result longer than `maxResult` is cut, with a "Show all" button.
  - Arguments and results each have a copy button.
- **Methods:**
  - `setSteps(steps)` and `upsert(step)`.
  - `expand(id)` and `collapse()`.
  - `reveal(id)` opens the summary and the step, scrolls to it, focuses its row and marks it
    `data-state="revealed"` for 2 s (no movement under reduced motion).
- **Events:** `toggle {id, open}`, `reveal {id}`.
- **Accessibility:**
  - The summary and every step follow the APG Disclosure pattern.
  - The running step carries `aria-current="step"`, and each status has a visually hidden word
    beside its glyph.
  - The running spinner is static under reduced motion.

## §3 · ApprovalCard

**Scope:** new `src/components/approval-card/approval-card.{js,css}`,
`website/demos/approval-card.demo.js`, `docs/llms.md`.

- **Options:**
  - `title`, `description`, `icon`, `headingLevel: 3`.
  - `status: 'pending'|'approved'|'rejected'|'expired'`.
  - `details: Node|Block[]`: what will happen, such as recipients or amounts.
  - `preview: {label, content: Node|Block[]}|null`: shown behind a disclosure.
  - `fields: Record<string, FieldOptions>|null`: the Edit form. No fields means no Edit.
  - `values: {}`.
  - `confirmText: null`: when set, Approve asks for this text first through
    `Dialog.confirm({confirmText})`.
  - `reason: 'optional'|'required'|'none'`: whether Reject asks why.
  - `edited`, `rejectReason` (so a card rebuilt from a stored approval item shows both),
    `answeredBy`, `answeredAt`, `keys: true`, and `msg` (action labels and the verdict lines).
- **Events:** `approve {values}`, `edit {values}` and `reject {reason}`, all **preventable**.
  - Unless an `approve` or `reject` is prevented, the card moves to its answered state.
  - A saved `edit` keeps the card pending and adds "Edited by you".
- **Answered state:**
  - The card freezes into its own record: no actions, a verdict line ("Approved by you at 10:31"),
    and the edited values and the reason shown.
  - `data-state` is the status.
- **Methods:** `setStatus(status, {by?, at?})`, `focus()`, and `handleKey(event)` → `boolean`
  (true when the key was used).
- **Keyboard:** A, E and R act while focus is inside a pending card and not in a text control.
  Buttons work as native buttons.
- **Accessibility:** `role="group"` labelled by the title. The card is focusable (`tabindex="-1"`)
  so a thread can move focus to it when a run starts waiting.
- **Documented rule:** whether an action needs `confirmText` is decided by the application from
  the tool it triggers. It is never taken from model output.

## §4 · SourceList

**Scope:** new `src/components/source-list/source-list.{js,css}`,
`website/demos/source-list.demo.js`, `docs/llms.md`.

- **Options:**
  - `sources: Source[]`, where each source is `{id, title, kind: 'web'|'file'|'record'|'call',
    site?, snippet?, href?, ref?: {entity, id}, call?}`.
  - `label: 'Sources'`, `layout: 'chips'|'list'`, `numbered: true`.
- **Behaviour:**
  - Each source is a button showing its number, glyph and short name, with a `Tooltip` card
    (title, site, snippet) on hover and focus.
  - Activating a source emits `select {source}`, which is **preventable**. By default, a
    `web` source opens its `href` only if `safeHref()` accepts it and the scheme is `https:`, and
    the card shows the host. Every other kind leaves the action to the application, for example
    `runTrace.reveal(source.call)`.
- **Methods:** `setSources(sources)`, `highlight(n)` (focus and mark, from a BlockView `cite`).
- **Privacy rule:** no favicons, thumbnails or other remote resources are ever loaded.

## §5 · Composer

**Scope:** new `src/components/composer/composer.{js,css}`, `website/demos/composer.demo.js`,
`docs/llms.md`.

- **Options:**
  - `label` (the accessible name), `placeholder`, `value`.
  - `submitKey: 'enter'|'mod+enter'`, `busy: false`, `disabled: false`.
  - `attachments: false`, `accept: ''`, `maxFiles: 10`.
  - `mentions: null|{trigger: '@', items: Item[]|((query) => Item[]|Promise<Item[]>)}`.
  - `commands: null|LauncherItem[]`, opened by `/` on an empty input, with Launcher pages.
  - `context: ContextChip[]`, where a chip is `{id, label, icon?, ref?}`: removable chips above
    the input.
  - `hint`, `note` (a line under the composer), `draftKey: null` (persisted through
    `storage()`), `maxRows: 10`, `msg`.
- **Events:**
  - `send {text, files, mentions, context}`, **preventable**. The input clears unless the event is
    prevented.
  - `stop`, `input {text}`, `attach {files}`, `remove {kind, id}`, `mention {item}`,
    `command {item}`, `historyprevious`.
- **Methods:** `focus()`, `getValue()`, `setValue(text)`, `clear()`, `setBusy(busy)`,
  `addFiles(files)`, `addContext(chip)`, `removeContext(id)`.
- **Keyboard:**
  - The submit key sends; the other Enter makes a new line.
  - Escape closes the suggestion list, and otherwise emits `stop` while busy.
  - ArrowUp on an empty input emits `historyprevious`. `/` on an empty input opens the commands.
  - In the suggestion list, Up and Down move, Enter or Tab picks, and Escape closes.
  - While an IME composition is active, a key never sends.
- **Busy state:** the Send button becomes Stop, with the label "Stop" and the stop glyph.
- **Files:** pasting or dropping files onto the composer adds attachments, with a visible drop
  state.
- **Accessibility:**
  - The `<textarea>` keeps its textbox semantics; `role="combobox"` is not used.
  - While suggestions show, it carries `aria-autocomplete="list"`, `aria-controls` and
    `aria-activedescendant`, and a polite status announces the number of matches.
  - Attachments and context chips are lists, each item with a remove button named
    "Remove <name>".

## §6 · RunStatus and agent activity

**Scope:** new `src/components/run-status/run-status.{js,css}`, `src/components/avatar/**`
(the `activity` option only), new `src/internal/presence-loop.js`,
`website/demos/run-status.demo.js`, `website/demos/avatar.demo.js`, `docs/llms.md`.

- **RunStatus**
  - **Options:**
    - `state`, `summary`, `steps: {done, total}|null`.
    - `started`, `finished`, `workMs`, `waitingSince`.
    - `tokens: [in, out]|null`, `cost: {amount, budget?, currency}|null`, `model`.
    - `actions` (button descriptors), `ticking: true`, `compact: false`, `locale`, `msg`.
  - **Rendering:**
    - A state line (glyph and word) and the summary sentence.
    - A steps progressbar whose `aria-valuetext` reads "3 of 6 steps".
    - A property list of started, working time and finished or waiting since.
    - A cost `role="meter"` reading "€0.14 of €2.00", with a warning tone from 80% and a danger
      tone at 100%.
  - **`compact`** draws only the state pill for narrow headers.
  - **`ticking`** updates the working time once a second while running, with one interval that
    sleeps while the page is hidden.
- **Avatar**
  - New options: `activity: AgentActivity|null` and `activityLabel`.
  - The activity draws as a toned dot. Its word goes into the accessible name and the tooltip.
  - `animate: false` opts the avatar into the shared presence loop.
- **`presence-loop.js`**
  - The poses of `presencePose()`, transform only.
  - One `requestAnimationFrame` loop per document, kept on the document under a symbol-keyed
    property rather than in module scope. It is created on the first tracked avatar and torn down
    with the last.
  - It moves only avatars on screen (`IntersectionObserver`), sleeps while the page is hidden,
    and returns every avatar to rest under `prefersReducedMotion()` (followed through
    `watchMotion()`).

## §7 · AgentThread

**Scope:** new `src/components/agent-thread/agent-thread.{js,css}`,
`website/demos/agent-thread.demo.js`, `docs/llms.md`.

- **Options:**
  - `items: ThreadItem[]`.
  - `authors: Record<string, Author>`, where an author is `{name, kind: 'person'|'agent'|'model',
    initials?, tone?, activity?, via?}`.
  - `label`, `headingLevel: 3`, `emptyState: EmptyStateOptions|null`.
  - `followOutput: true`.
  - `answerActions: ['copy', 'regenerate', 'branch', 'rate']`.
  - `locale`, `msg`.
- **Composition:**
  - An `answer` uses BlockView and SourceList.
  - A `trace` uses RunTrace.
  - An `approval` uses ApprovalCard.
  - Bylines use Avatar.
  - Answers with `versions` get the ‹ 2 / 2 › pager.
- **Statics:** `AgentThread.register(type, render)`, following `Field.register`, so other item
  types (WP52's `surface`) and application types plug in. `render(item, context)` returns a Node
  and may return a component for the thread to own.
- **Methods:**
  - `setItems(items)`.
  - `upsert(item)`: by id; appends when new.
  - `patch(id, partial)`.
  - `appendText(id, text)`: streams into that answer's BlockView.
  - `remove(id)`, `get(id)`, `getComponent(id)`, `reveal(target)` (`item:<id>`, `step:<id>`,
    `source:<id>`), `scrollToEnd()`.
- **Events:**
  - `action {item, action}` for copy, regenerate, branch, rate and edit.
  - `approve`, `edit`, `reject`: re-emitted from the cards with `{item, …}`.
  - `cite {item, n}`, `artifact {item, id}`, `reveal {target}`.
- **Following output:** the thread follows new output while the reader is at the end. Otherwise a
  "Jump to latest" button appears, and it never scrolls the reader away from where they are.
- **Accessibility:**
  - The APG Feed pattern: `role="feed"`, each item an `article` with `aria-posinset`,
    `aria-setsize` and `aria-labelledby` its byline.
  - PageDown and PageUp move between articles; Ctrl+End and Ctrl+Home leave the feed.
  - Milestones are announced per Decision 4.
- **`destroy()`** destroys every component the thread created and leaves the target as found.

## §8 · Layouts move onto the kit

**Scope:** `website/layouts/{ai-chat,agent-chat,agent-workspace}.layout.{js,css}`.

- Each layout keeps its look, content and keyboard map. It deletes its own block renderer,
  highlighter, step timeline, call list, approval card, sources, composer, run state and presence
  loop, and uses the kit. Layout CSS keeps layout only (columns, spacing, the shell); nothing a
  kit component draws is styled by a layout.
- **`agent-chat`:**
  - Its citations become buttons that highlight their source, and each source reveals its call.
  - Its send key stays Mod+Enter (`submitKey: 'mod+enter'`).
- **`ai-chat`:** its composer gets the corrected ARIA (§5).
- **`agent-workspace`:** its avatars use `activity` and the shared loop.
- Report each layout's JS and CSS line counts before and after.

## §9 · Registration and docs

**Scope:** `src/index.js` (exports), `styles/zx.css` (imports), `website/docs.js`
(`COMPONENT_IDS`), `AGENTS.md` (the demo group list only), `docs/llms.md`.

- **Exports:** `BlockView`, `renderBlocks`, `RunTrace`, `ApprovalCard`, `SourceList`,
  `Composer`, `RunStatus` and `AgentThread`.
- **Demos:** seven demos in a new group `Agents` in the current demo shape (`examples: [{title,
  blurb, render}]`), each showing its common options with a visible event log, and with its data
  declared at the top of the module.
- **`docs/llms.md`:** a new *Agents* chapter with the data model (with one complete JSON thread),
  each component, and three rules:
  - The application owns transport.
  - Consequence comes from the application.
  - Model text is data.

## Out of scope

- Composable responses and surfaces (WP52).
- Change review, suggested values, plan checkpoints, pause and steering, grace-period commits and
  grants (WP53).
- AG-UI and MCP adapters (WP54).
- Networking, LLM clients, token counting and pricing tables.
- Markdown beyond the inline grammar; links or images inside answer text.
- Typing animation, voice input, collaboration presence, and custom elements for the kit.

## Acceptance criteria

1. `npm test` and `npm run test:browser` pass; `node tools/check-site.js` and `git diff --check`
   are clean.
2. Unit tests cover everything listed in §1, and `tests/unit/type-bindings.test.js` passes for
   every new component (`@extends {Component<XOptions>}`).
3. Smoke cases:
   - Every new component can be created and destroyed twice on the same target without leaving
     nodes.
   - `appendText` leaves earlier blocks' nodes identical (the same `Node` references).
   - Approval keys act only with focus inside the card.
   - A composition (IME) Enter never sends.
   - Feed keys move between articles.
   - The presence loop stops under `data-zx-motion="reduced"` and while the page is hidden.
4. `ai-chat`, `agent-chat` and `agent-workspace` pass `tools/shoot-layout.js` and
   `tools/audit-layout.js` at 1440 and 390, light and dark. No layout keeps markup a kit component
   now draws.
5. Changelog lines and the before/after line counts are reported.
