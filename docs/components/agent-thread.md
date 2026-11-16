# AgentThread

A conversation with agents: messages, streamed answers, the steps a run took, and the approvals that hold it.

Full reference: https://zx.zeyos.com/docs/llms.md · Live demo: https://zx.zeyos.com/docs.html#components/agent-thread · All components: https://zx.zeyos.com/docs/components/index.md

A conversation with one or more agents, drawn from the items above: the person's messages, the
agents' answers as they stream (`BlockView` with a `SourceList`), the steps a run took
(`RunTrace`), the approvals that hold it (`ApprovalCard`), and one-line notices.

- **Options** — `items: []`, `authors: {}`, `me: 'me'` (the reader's author key; an item without
  `author` is the reader's when it is a `user` item), `label` (the feed's name, "Conversation"),
  `headingLevel: 3`, `emptyState: null` (`emptyState()` options shown while empty),
  `followOutput: true`, `scroller: null` (the element that scrolls; the nearest scrolling ancestor
  when null), `answerActions: ['copy', 'regenerate', 'branch']` (add `'rate'` for helpful / not
  helpful), `userActions: []` (`'edit'`, `'copy'` on the reader's own messages, revealed while the
  message is pointed at or holds focus), `icons` (glyphs for `regenerate`, `branch`, `rateUp`,
  `rateDown`, `edit`), `traceIcons` (handed to every `RunTrace` it draws), `now: null` (the clock
  "today" is measured against, for a world on fixed dates), `formatTime`, `locale`, `msg`.
- **Surfaces** — a `{type: 'surface', id, document?, token?, catalog?, reply?}` item draws a
  `Surface`. The item comes from the application, never from a model line, so its `token` and
  `catalog` are the application's. `surfaceOptions` (`policy`, `resolve`, `chartAdapter`, `msg`)
  is handed to every surface the thread draws. `thread.surface(id)` returns it to stream into, and
  its one reply arrives as the thread's `reply {item, reply}`. Redrawing the item — `patch`,
  `upsert(thread.get(id))`, `setItems(thread.getItems())` — keeps the live surface; an item with a
  different `document` supersedes it, which replies `dismiss`. Removing the item or destroying the
  thread dismisses it. A surface that waits for an answer is announced ("Finance agent needs your
  answer") when it arrives, or when a streamed one begins. When a run stops, the application calls
  `thread.surface(id).cancel('stopped')`.
- **Item extras** — any item's `refs: [{id, label, icon?, entity?}]` draws links to the
  application's own things after its content (`open {item, ref}`); a `user` item's `mentions`
  (names, or `{name, tone}`) marks each `@name` in its text; an `answer`'s `steps` show the work it
  did inline above its text (`stepsOpen` opens them) and, like `stopped`, `rating` and `at`, follow
  its version (`versions[]`); a `trace`'s `title` replaces its summary (a plan:
  "Plan · 5 of 6 done"); a `notice` is named by its own text and may carry `action: {id, label}`
  (`action {item, action: id}`); an author with an `icon` is drawn as a tinted tile instead of
  initials (round for a `model`; `tone: 'accent'` for the accent's quiet fill); an agent author with
  `face` (`{seed, tone, body, eyes, material}` or `true`) is drawn as its generated `AgentAvatar`,
  with the author's `activity`; an `approval`'s
  `editedKeys` say which values the person changed. `setArtifactState()` is remembered for answers
  drawn later; `sourceIcons` is handed to every `SourceList`.
- **Placeholders** — a `{type: 'zx-placeholder', id, author?, lines?}` item stands for something
  still on its way, as a Skeleton under its author's byline; replace or remove it once the real
  item is there. It neither replies nor is announced. The name is reserved; `placeholder` is free
  for an application's own items.
- **Methods** — `setItems(items)` (replaces the conversation: everything is dropped and drawn anew,
  except a surface already drawn, which stays so that one still matching keeps what was typed; an
  item bringing a `reply` that surface never gave freezes it as answered elsewhere),
  `upsert(item, {after?})` (adds, or replaces in place by `id`;
  a new item goes at the end, or right after the item `after` names — nothing else is redrawn),
  `patch(id, partial)` (an answer finishing, stopping or gaining sources, a trace's steps, an
  approval's status change in place; anything else redraws the item). Metadata patches preserve
  streamed answer blocks, including the selected version; explicit `blocks` or `versions`
  replacements remain authoritative. `appendText(id, text)`
  (streams into an answer, creating it when the id is new), `appendBlock(id, block)` (adds a whole
  block — figures, a table — without redrawing the answer), `announce(text)` (says an outcome
  through the thread's polite status), `setArtifactState(id, {expanded, controls})` (whether an
  artifact is open in an inspector, on every card naming it), `remove(id)`, `get(id)`,
  `getItems()`, `getComponent(id)`, `reveal(target)` (`item:<id>`, `step:<id>`, `source:<n>`,
  `source:<n>:<id>`, a source in the list of that answer),
  `scrollToEnd()`, `surface(id)` (the `Surface` of a `surface` item, to stream into), `destroy()`. The static `AgentThread.register(type, render)` draws an item type
  of the application's own; `render(item, {thread, author, own})` returns its content, and `own()`
  hands a component to the thread to destroy with the item. An application's renderer for
  `surface` replaces the library's drawing of that type, and `has('surface')` answers false until
  it does; the other built-in types cannot be replaced.
- **Events** — `action {item, action, value?}` (`copy`, `regenerate`, `branch`, `rate` with
  `up`/`down`/null, `version` with an index — preventable for `rate` and `version`; `edit` on the
  reader's message; a notice's action id), `open {item, ref, step?}` (an item's link, or a trace
  step's),
  `reply {item, reply}` (a surface's one reply; the item keeps it as `reply`),
  `approve {item, values}`, `edit {item, values}`, `reject {item, reason}` (preventable: the card
  stays pending), `cite {item, n, source}` (preventable: by default the cited source is
  highlighted), `artifact {item, id}`, `reveal {target}`. Each reaches a listener on the thread's
  root once, as the thread's `zx-*` event: the cards, answers and traces inside it do not bubble
  their own copies past it. A source that names a `call` reveals that
  step in the trace.
- **Turns** — consecutive items by the same agent read as one turn: the avatar and byline are drawn
  once, and the byline still names every article. The reader's own messages sit at the end as a
  bubble without an avatar.
- **Following output** — while the reader is at the end, new output keeps the end in view;
  scrolled up, a "Jump to latest" button appears and the reader is never moved. While a streaming
  answer has nothing yet, a quiet line says who is writing.
- **Narrow** — the thread is a size container; below 30rem the content takes the full width and
  the avatar stays beside the byline.
- **Keyboard and semantics** — the APG feed pattern: each item is an `article` in a `role="feed"`
  with `aria-posinset`, `aria-setsize` and `aria-labelledby` its byline; PageDown and PageUp move
  between articles; Ctrl+End and Ctrl+Home move focus past the end or before the start of the feed.
  A control inside an item keeps those keys: they move a caret, not the feed.
  The feed is `aria-busy` while an answer streams. One polite status says when an agent starts
  writing, answers, needs approval, or is stopped — streamed text is never read aloud as it arrives.

## connectUiMessageStream() — the AI SDK UI message stream

Draws a server's AI SDK UI message stream (the response header `x-vercel-ai-ui-message-stream: v1`;
`UI_MESSAGE_STREAM_VERSION` is the version implemented) in a thread. The application keeps the
request, the event source, retries, and authentication: it strips the `data: ` framing and the
`[DONE]` sentinel, and hands each parsed part to `handle()`.

```js
const stream = connectUiMessageStream(thread, {
  agent: 'finance',
  runStatus,
  onapproval: (approvalId, approved, reason) => sendNextRequest({ approvalId, approved, reason }),
  ondata: (name, data, id) => store.set(`${name}/${id}`, data)
});
for await (const part of parsedParts(response)) stream.handle(part);
```

- **Options** — `runStatus` (a `RunStatus` to keep up to date), `authors`, `agent` (the author key
  of the assistant's output; without it, the first author who is not a person), `tools: {}`,
  `onapproval(approvalId, approved, reason)`, `ondata(name, data, id)`, `onmetadata(metadata)`,
  `onunknown(part)`, `onerror(error)`, `showReasoning: false`. It returns
  `{handle(part), replay(messageId), destroy()}`.
- **Keep one connection for the conversation.** The answer to an approval goes out with the
  application's next request, and the response to it continues the same message: its `start` names
  a message that has finished or was stopped, and the message picks up where it stopped, once it has
  something to say. A `start` without a `messageId` opens a new answer, or, during an open message,
  joins it, because streams merged into one each send their own. `destroy()` stops a message still open and every
  call still going, and expires a pending approval, because no decision could reach the application
  any more.
- **After a reconnect, call `replay(messageId)`.** A reconnect can return the whole response from its
  beginning. Only the application knows it reconnected, so it calls `replay()` before it feeds the
  stream again from the `start`: what that response drew goes and is rebuilt, with nothing doubled
  and nothing reported. Earlier responses of the message are not sent again, so what they drew stays.
  A decision stands: its card comes back with its answer, and `onapproval` does not fire twice.
  `ondata` and `onmetadata` hear what the replay sends again. Without an id it takes the message being
  read, or the one read last. Without `replay()`, a `start` for a finished message resumes it, and a
  second copy of a response is drawn twice.

  ```js
  stream.replay(lastMessageId);
  for await (const part of parsedParts(await reconnect())) stream.handle(part);
  ```
- **What stands in the thread stays.** A `start` for an answer this connection did not draw, restored
  with the conversation or drawn by an earlier connection, takes it over: the message goes on below
  what stands under it, and a call on one of its steps finds that step. A `start` naming any other
  item opens an answer of its own, and a continuation skips a number already in use.
- **Message** — `start` opens an `answer` under the message id, `finish` closes it and settles
  `runStatus` (`waiting` while an approval is pending), `abort` closes it as stopped. Text blocks
  stream through `appendText`, each block a new paragraph of the same answer; blocks open side by side
  go out one after the other. `error` draws a
  `notice` with tone `danger`. `start-step` and `finish-step` draw nothing. `message-metadata`, and
  the `messageMetadata` of `start` and `finish`, go to `onmetadata`.
- **Stream order** — the thread adds at its end, so what a message says after a card, a tile, or
  another item the adapter added continues in a new answer `<messageId>#<n>`, counting from 2, by
  the same author, and the thread draws it as the same turn. The steps stay on the message's first
  answer, and the sources are listed under its last, while citations in any of its answers count
  them all and lead to that list. Each answer is its own item: `thread.get(messageId)` is the first one alone, and an
  action under a continuation carries the id `<messageId>#<n>`, so strip `#<n>` to name the message.
- **`reset-step`** withdraws the current step: everything the message added since its last
  `start-step` goes, or all of it when it has none, and the answer goes on where the step began. Its
  text, files, continuation answers, sources, reasoning, and tool calls with their tiles and cards
  go, and so does an error notice, because a step the server takes back has not failed. An earlier
  call keeps what the step did to it. A person can no longer answer a withdrawn card. What already
  went out through `ondata`, `onmetadata`, or `onapproval` stays with the application.
- **Reasoning stays private.** All of a message's reasoning is one collapsed "Thought for 12 s" step.
  The text is not kept at all unless `showReasoning: true` puts it on the step. A `reasoning-file` is
  never drawn. The step says its duration in words, so the trace's "Worked for" total leaves it out.
- **Tool calls** are steps of the answer: `queued` while the input streams, `running` once it is
  available, then `done`, `failed`, or `skipped`. The input is shown once it is complete. A
  preliminary output leaves the step running.
- **The server asks; the person answers; the application sends.** A `tool-approval-request` draws an
  `ApprovalCard` and its step waits. The person's decision goes to `onapproval`, and a prevented
  `approve` or `reject` decides nothing. Nothing is approved by default, and an automatic decision
  (`isAutomatic`) draws no card, because nobody is asked. A call the server settles while its card
  is pending expires the card, and a `tool-approval-response` shows on it what was decided elsewhere,
  without `onapproval`. `onapproval` fires once per approval: a request that arrives again, from a
  retried step or a replay, draws its card with the answer it already has.
- **No address is loaded.** A `source-url` keeps its link only when it is `https:` and passes
  `safeHref()`; otherwise the source stays, so `[n]` citations count the same sources, and opens
  nothing. A `source-document` is a `file` source. A `file` part draws its name and type, never its
  content.
- **Tiles** — `tools` maps a tool's name to the application's own renderer: `(call) => ThreadItem|null`,
  called at each status change and never on an input delta, with `{id, name, args, argsText, result?,
  error?, status}`. `args` is `null` until the input is complete. The first result that is not null
  joins the thread as `tool:<toolCallId>` (a card that holds the call stays ahead of it), and later
  results patch it in place; the adapter sets the id. The call's step links to the tile, and the
  adapter answers that link with `thread.reveal()`. Draw the tile with `AgentThread.register()`. A
  renderer that throws is reported through `onerror`, and the step stays.
- **Data parts** — `data-<name>` goes to `ondata(name, data, id)`. A part with an `id` replaces the
  earlier one of that name and id, so keep the latest value per name and id.
- **Reported, never guessed at.** A part the adapter does not draw goes to `onunknown`, among them
  `custom` and a `tool-approval-response` with no card here. A delta ahead of its start creates the item, a `start`
  naming a message still open is ignored, a `start` naming another message stops the open one, and a
  `reset-step` outside a message draws nothing; each goes to `onerror`.

## AG-UI event streams: `connectAgUi(thread, options)`

`connectAgUi()` draws an [AG-UI](https://docs.ag-ui.com) event stream in a thread. It implements
AG-UI `AG_UI_VERSION` (`'1.0'`). It takes events already parsed — the application keeps the
transport, retries and authentication — and returns `{handle(event), state(), destroy()}`.

```js
const status = new RunStatus(null, { compact: true });
const adapter = connectAgUi(thread, {
  agent: 'finance', runStatus: status, inlineSurfaces: true,
  requiresApproval: (call) => call.name === 'send_reminder',
  tools: { show_company: (call) => (call.args ? { type: 'company-card', company: call.args.id, status: call.status } : null) },
  ontoolresult: (id, result) => sendWithNextRun(id, result)
});
source.onmessage = (message) => adapter.handle(JSON.parse(message.data));
```

- **Options** — `runStatus` (a `RunStatus` the run's lifecycle drives), `authors` (a text message
  whose `name` is an author key is that author's), `agent` (the author key of agent output),
  `requiresApproval(call)`, `ontoolresult(id, result)`, `onstate(state)`, `onunknown(event)`,
  `onerror(problem)` (`{code, message, event?, cause?, errors?}`), `showReasoning: false`,
  `surfaceEvent: 'zx.surface'`, `tools: {}` (tile renderers by tool name), `surfaceTools:
  ['show_surface', 'ask_user']`, `inlineSurfaces: false`, `catalog` (a narrowed surface catalog).
- **What is drawn** — a run drives `runStatus` (`running`, then `done`, `waiting` while a call of
  the run has no result, listed in `pendingToolCallIds` or not, `stopped` when cancelled, `failed`),
  and a run error adds a `notice` (`error:<runId>`). A run error outside an open run marks the last
  run failed and reports `no-run`, but closes nothing: approvals and surfaces still waiting for a
  person stay open. A text message is an `answer` with the message id. Tool calls are steps of a
  `trace` (`trace:<runId>`, a new one, `#2`, after anything else was drawn): the arguments show once
  complete, the result fills the step. Reasoning is one collapsed "Thought for 0.7 s" step; its text
  only with `showReasoning: true`. State snapshots and JSON Patch deltas keep `state()`.
- **`ToolCall`** — what a tile renderer receives: `{id, name, args, argsText, result?, error?,
  status}`; `args` is the parsed arguments once complete, `null` before; `result` the result's
  `content` unchanged; `status` is `queued` while arguments arrive, `waiting`, `running`, then
  `done`, `failed`, `skipped` (rejected) or `stopped`.
- **Tiles** — a call named in `tools` is drawn by the application's renderer, an item type
  registered with `AgentThread.register()`. The renderer runs at each status change, never on an
  argument delta; its first item that is not `null` is inserted as `tool:<toolCallId>` at the
  call's place — after its trace and the items of earlier calls in it, even when text was drawn
  below since — later items replace it in place, and the step links to it. A gated call's tile
  follows its card. A renderer that throws is reported and the step stays as it was. Put arguments
  and results on the page as text.
- **Approvals** — a call `requiresApproval` answers truthy for waits at an ApprovalCard
  (`approval:<toolCallId>`); nothing is approved by default, so a check that throws or returns a
  Promise holds the call too. The decision is the call's result:
  `ontoolresult(id, {approved: true})` or `{approved: false, reason?}`. AG-UI 1.0 asks by ending the
  run with an `interrupt` outcome: keep each `interrupt.id` from that event and send the result as
  the next run's `resume` entry `{interruptId, status: 'resolved', payload: result}`. A `tool_call`
  interrupt for a call `requiresApproval` let through draws the card too; any other interrupt
  (`input_required`, `confirmation`, …) goes to `onunknown`. A result that arrives before the
  decision is drawn, the card expires, and no decision is sent; a result after a rejection only
  fills the step. A result for a surface tool still waiting closes its surface the same way.
- **Surfaces** — a call named in `surfaceTools` is an `ask` step and a surface at the call's place,
  a `zx-placeholder` until its arguments are complete; its reply, plus the surface's `errors` when there are any, is the call's
  result through `ontoolresult` — in AG-UI 1.0 a frontend tool, answered in the next run's input as
  `{role: 'tool', toolCallId, content}`. A `show` surface with no actions has nothing to answer, so
  the call is answered at once with `{shown: true, surface, errors?}` and the surface stays on
  screen. Arguments that are not a surface, or a surface with no valid intent, answer at once with
  `{error: 'invalid-arguments'}`. Where `thread.surface(id)` gives nothing, as with an application's
  own `surface` renderer, an operation is reported (`surface-unavailable`) and a surface tool's call
  answered at once with `{error: 'surface-unavailable'}`. With `inlineSurfaces`, surface fences in answer text become
  surfaces after the prose before them, and the prose after continues in `<messageId>#2`; a fence
  still open at the message's end is reported and its surface cancelled when the run ends, and so
  is any surface that reaches the end of its run without its `end` (`unterminated-surface`). A
  `CUSTOM` event named `surfaceEvent` carries one operation or `{ops, token?}`; the token of the
  event that opens a surface is kept. Each surface is `surface:<runId>/<surface>`, so `s1` in two
  runs is two surfaces; an operation for an answered surface is refused and reported. A surface
  belongs to the source that opened it — custom event, surface tool or fence — and an operation
  from another source is refused (`not-allowed`), never merged; give custom-event surfaces ids a
  model cannot predict, since a server `begin` for an id the model took first is refused. A reply's
  token is the application's for a custom event, the tool call id for a surface tool, and the run
  id for an inline surface.
- **Strictness** — `*_CHUNK` events are expanded into start, content and end. Content, arguments
  or an end for something never started is dropped and reported (`out-of-order`), never drawn. A
  start for a closed message or tool call reopens it, in this run or a later one, and its content
  continues; a reopened call stands as `queued`, loses its card or surface, and is asked about
  again once its arguments are complete. A start for an id still open, or for a call already
  decided or answered, is ignored and reported (`duplicate-start`), so `ontoolresult` fires once
  for a call and an answered surface's receipt stays; and a message id with one of the adapter's prefixes (`approval:`, `tool:`, `trace:`, `surface:`,
  `error:`, `think:`) is refused. `handle()` never throws: what it cannot read is reported and
  dropped. `destroy()` closes a run still open as stopped, cancels unanswered surface-tool surfaces
  (their replies still reach `ontoolresult`, with `reason: 'stopped'`) and expires undecided
  approvals before it stops listening, and reports none of that through `onerror`. Every event the thread does not draw goes to
  `onunknown`, including steps, message snapshots, activities, subagents and the deprecated
  `THINKING_*` names.
