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
   step without the text. The text is shown only with `showReasoning: true`.
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

## §1 · Adapter

**Scope:** new `src/components/agent-thread/ui-message-stream.js`, `src/index.js` (export),
`tests/unit/ui-message-stream.test.js`, `tests/unit/fixtures/ui-stream-*.json` (not run by
`node --test`, which only picks up `*.test.js`), `website/demos/agent-thread.demo.js`,
`docs/llms.md`, `src/core/messages.js` (new keys only, if any).

- **`connectUiMessageStream(thread, options)`** → `{handle(part), destroy()}`.
- **Options:** `runStatus?`, `authors`, `agent` (the author key for assistant output), `tools: {}`,
  `onapproval(approvalId, approved, reason)`, `ondata(name, data, id)`, `onmetadata(metadata)`,
  `onunknown(part)`, `onerror(error)`, `showReasoning: false`.
- **Mapping:**
  - `start` opens an `answer` item under the message id; `finish` closes it and settles
    `runStatus`; `abort` closes it as stopped.
  - `text-start`, `text-delta` and `text-end` stream through `thread.appendText`. Several text
    blocks in one message append to the same answer.
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
  - `error` draws a `notice` with tone `danger` and its `errorText` as text.
  - Anything else goes to `onunknown`.
- **Out of order:** a delta arriving before its start creates the item, and a duplicate start for a
  known id is ignored. Both are reported through `onerror`.
- **Fixtures:** three recorded streams: a plain answer with two tool calls and two sources; an
  approval-gated tool call; and an answer with reasoning and a data part. They are replayed in tests
  and, from the demo, into an AgentThread (instantly under reduced motion).

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
   - unknown parts and out-of-order deltas reported.
3. The demo replays a fixture into an AgentThread and logs the callbacks.
4. Changelog lines and the pinned protocol version are reported.
