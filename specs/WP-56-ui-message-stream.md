# WP56 — Adapter for the AI SDK UI message stream

WP54 connects AgentThread to AG-UI and to MCP elicitation. Many TypeScript agent backends speak a
third stream instead: the Vercel AI SDK's UI message stream, sent as server-sent events with the
header `x-vercel-ai-ui-message-stream: v1`. Its parts carry text, reasoning, tool calls with their
streamed inputs, approval requests, sources and application data. This WP adds a thin adapter, so
an application whose server already sends that stream can draw it with Zx without glue code.

Work on the branch `wp/56-ui-message-stream`, from `main`. `AGENTS.md` applies. `src/core/**` is
**not** in scope. `CHANGELOG.md` is central: report changelog lines. `docs/api.json` is
regenerated. Public files must not mention this spec.

## Decisions (binding)

1. **Parsed parts in, calls into Zx out.** The application owns the request, the event source,
   retries and authentication. The adapter is `handle(part)` plus callbacks, so it runs in tests
   without a network. The transport strips the `data: ` framing and the `[DONE]` sentinel.
2. **Pin the protocol.**
   - The adapter exports `UI_MESSAGE_STREAM_VERSION = 'v1'`.
   - The part names and shapes are checked against the published stream protocol documentation at
     implementation time, and recorded fixtures in `tests/unit/fixtures/ui-stream-*.json` pin them.
     The report names the documentation version read.
   - An unknown part is reported through `onunknown`, never guessed at.
3. **Reasoning stays private by default.** Reasoning parts become one collapsed "Thought for 12 s"
   step without the text. The text is shown only with `showReasoning: true`. The label carries the
   duration, so the step carries no `ms`: RunTrace prints `ms` beside the label, which would show
   the duration twice. The trace's "Worked for" total therefore leaves reasoning out.
4. **The server asks; the person answers; the application sends.** A tool approval request draws an
   ApprovalCard. The person's decision goes to `onapproval(approvalId, approved, reason)`, and the
   application sends the response in its next request. Nothing is approved by default, and the
   adapter never approves on its own.
5. **No URLs to load.** A `source-url` becomes a source whose link is `https:` only and passes
   `safeHref()`; nothing is fetched to draw it. A `file` part draws its name and type, never its
   content.
6. **Tiles as in WP54.** The `tools` option maps tool names to the application's renderers, with the
   `ToolCall` shape and status rules of WP54 §2. Until WP54 lands, the adapter keeps its own
   implementation, and the two are folded into one shared module afterwards.
7. **The thread stays in stream order, without an insert API.** `AgentThread` can only add at its
   end, and a card or a tile cannot stand inside an answer. So what a message says after one
   continues in a new answer item `<messageId>#<n>`, the form WP54 gives continuation answers for
   inline surfaces. The thread draws it as the same turn.

## §1 · Adapter

**Scope:** new `src/components/agent-thread/ui-message-stream.js`, `src/index.js` (export),
`tests/unit/ui-message-stream.test.js`, `tests/unit/fixtures/ui-stream-*.json` (not run by
`node --test`, which only picks up `*.test.js`), `website/demos/agent-thread.demo.js`,
`docs/llms.md`, `src/core/messages.js` (new keys only, if any), `tests/smoke/smoke.js`.

- **`connectUiMessageStream(thread, options)`** → `{handle(part), destroy()}`.
- **Options:** `runStatus?`, `authors`, `agent` (the author key for assistant output), `tools: {}`,
  `onapproval(approvalId, approved, reason)`, `ondata(name, data, id)`, `onmetadata(metadata)`,
  `onunknown(part)`, `onerror(error)`, `showReasoning: false`.
- **Mapping:**
  - `start` opens an `answer` item under the message id; `finish` closes it and settles
    `runStatus`; `abort` closes it as stopped.
  - A `start` for a message that finished or was stopped resumes it. The response after an approval
    or a tool's output reuses the message id, and the AI SDK client appends that response to the
    same message. A `start` without a `messageId` always opens a new answer, because the adapter
    does not see the request that would say otherwise; a call of an earlier message still finds its
    step.
  - `text-start`, `text-delta` and `text-end` stream through `thread.appendText`. Several text
    blocks in one message append to the same answer, unless stream order says otherwise (below).
    A block's id only names it while it is open: as on the AI SDK client, `text-end` frees the id,
    and so does the end of its message, so a later block may reuse it.
  - `reasoning-*` follows Decision 3.
  - `tool-input-start`, `tool-input-delta`, `tool-input-available`, `tool-output-available` and
    the error and denial parts become steps of the answer, with the WP51 run states: `queued`
    while the input streams, `running` once it is available, then `done`, `failed` or `skipped`.
    The input text accumulates and is shown once complete.
  - `tool-approval-request` follows Decision 4, and its step waits (`waiting`) until the decision.
  - `source-url` and `source-document` become the answer's sources (Decision 5).
  - `data-<name>` parts go to `ondata`. A part with an `id` replaces the earlier one of the same
    name and id, so `ondata` always receives the current value.
  - `message-metadata` goes to `onmetadata`.
  - `start-step` and `finish-step` mark step boundaries and draw nothing of their own.
  - `reset-step` withdraws the current step (below).
  - `error` draws a `notice` with tone `danger` and its `errorText` as text.
  - Anything else goes to `onunknown`.
- **Stream order** (Decision 7): text or a file that follows anything else the adapter added
  continues in a new answer item `<messageId>#<n>`, counting from 2, by the same author.
  - Only content opens one: an empty text block or a blank delta does not, and a resumed message
    with nothing to say leaves its last answer closed.
  - The steps stay on the message's first answer.
  - The sources are listed once, under its last answer. Earlier answers keep them for their
    citations, which count the whole message's sources, without a list of their own.
  - The answer above a card ends before the card joins, so the thread's last word is that it needs
    approval. An answer above a tile goes on streaming until the message continues or finishes, so
    a tile does not announce an answer that is not finished.
  - Only what the adapter added counts: it does not see an item the application appends itself.
  - The thread keeps drawing each answer as its own item. `thread.get(messageId)` is the first
    answer alone, an action under a continuation carries the id `<messageId>#<n>`, and each
    finished answer draws its own action row.
- **`reset-step`:** the protocol defines it as removing every message part received since the most
  recent `start-step`, or every part of the message when there is none. It clears the blocks still
  open and does not end the step: the step's next parts follow without a `start-step`.
  - Everything the step added goes: its text and file blocks, its continuation answers, its sources,
    its reasoning, and its tool calls with their steps, tiles and cards. Reasoning from earlier steps
    stays, with their time and text.
  - A call belongs to the step that began it. An earlier call keeps whatever the withdrawn step did
    to it, as it does on the AI SDK client, where a tool part is updated in place.
  - An `error` is not a message part, but a step the server takes back has not failed, so its notice
    goes too and the run does not end as failed.
  - The answer goes on where the step began. A retry may reuse the ids of the step it replaces, and
    `runStatus` returns to `running`, or to `waiting` while an earlier card still waits.
  - What already went out stays with the application: `ondata`, `onmetadata` and `onapproval` cannot
    be recalled, and the adapter has no callback that says so.
  - Outside a message it draws nothing and is reported through `onerror`.
- **Out of order:** a delta arriving outside its block creates the item, and a `start` for a message
  still open is ignored. A `start` for another message stops the open one, which nothing else can
  finish. All three are reported through `onerror`.
- **Fixtures:** four streams: a plain answer with two tool calls and two sources; an approval-gated
  tool call; an answer with reasoning and a data part; and a step withdrawn by `reset-step`, written
  from the documented rule rather than recorded. They are replayed in tests, and all but the last
  from the demo into an AgentThread (instantly under reduced motion). Smoke cases replay them through
  a real AgentThread, because the unit tests run against a stand-in.

## Out of scope

- Transports, client SDKs, authentication and the request side (sending messages and approval
  responses).
- Converting thread items back into UI messages.
- WP52 surfaces carried in data parts. They follow once WP52 and WP54 have landed, reusing WP54's
  surface handling.
- The deprecated RSC streaming APIs.

## Acceptance criteria

1. `npm test` and `npm run test:browser` pass; `node tools/check-site.js` and `git diff --check`
   are clean.
2. Unit tests cover:
   - each fixture replaying into the expected thread items and steps;
   - an approval request waiting for a decision, and the decision reaching `onapproval`;
   - reasoning text hidden by default and shown with `showReasoning`;
   - a non-`https:` source link dropped;
   - data parts replaced by id;
   - unknown parts and out-of-order deltas reported;
   - a `start` for a finished or stopped message resuming it, and one for an open message ignored;
   - text and files after a card or tile continuing in `<messageId>#<n>`, sources included;
   - `reset-step` taking back each kind of output, keeping earlier steps, and allowing a retry to
     reuse its ids.
3. The demo replays a fixture into an AgentThread and logs the callbacks.
4. Changelog lines and the pinned protocol version are reported.
5. Smoke cases replay the fixtures through a real AgentThread: the approval fixture shows its final
   text below its card, a `reset-step` leaves nothing of the withdrawn step on screen, a card expires
   when the server settles its call or the connection ends, and a reasoning row shows its duration
   once.
