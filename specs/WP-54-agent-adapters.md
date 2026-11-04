# WP54 — Protocol adapters: agent event streams and MCP elicitation

WP51 and WP52 give Zx a thread model and a surface format, but applications do not build their
agents around Zx; they use open protocols. Two matter today:

- **AG-UI:** an agent↔UI event stream of run, text, tool-call and state events, with state
  changes as JSON Patch.
- **MCP elicitation:** a server asks the client for structured input (form mode) or sends the
  person to a page (URL mode).

This WP adds thin adapters so an application can point either at Zx without glue code. Zx
renders; it does not become a transport, a client SDK or an agent host.

Work in the current checkout, on top of WP51 and WP52. **Do not commit**: this lands after central
review. `AGENTS.md` applies. `src/core/**` is **not** in scope, except `src/core/messages.js` for
new keys only. `CHANGELOG.md` is central: report
changelog lines. `docs/api.json` is regenerated. Public files must not mention this spec.

## Decisions (binding)

1. **Adapters take parsed events and return nothing but calls into Zx.** The application owns
   sockets, server-sent events, retries and authentication. An adapter is `handle(event)` plus
   callbacks, so it works with any transport and in tests without a network.
2. **Pin the protocol version.**
   - Each adapter declares the protocol version it implements (`AG_UI_VERSION`,
     `MCP_ELICITATION_VERSION`).
   - The event names and shapes are checked against the published specification at implementation
     time. Recorded fixtures in `tests/unit/fixtures/` pin them, and the release notes name the
     version.
   - Unknown events are ignored and reported through `onunknown`. They are never guessed at.
3. **Reasoning stays private by default.** Model reasoning events become one collapsed "Thought for
   12 s" trace step without the text. The text is shown only with `showReasoning: true`.
4. **Human-in-the-loop goes through ApprovalCard.**
   - The application's `requiresApproval(toolCall)` decides which tool calls wait for a person.
   - The adapter draws the card and hands the decision back through `ontoolresult`. No tool call
     is approved by default.
   - Any truthy answer gates the call, and so does a Promise: an asynchronous check holds the call
     for a person rather than letting it through.
5. **URL mode asks first.** An MCP URL-mode elicitation is shown as a `confirm` surface that names
   the full host, emphasised, before anything opens. Opening uses `noopener`, and declining or
   closing answers `decline` or `cancel`.
6. **The application designs the tiles; the model only fills them.**
   - The application names the tools whose calls it draws itself (`tools`). A call to one becomes a
     thread item that the application's own `AgentThread.register()` renderer draws. Every other
     call stays a trace step.
   - This is the first choice for anything an application knows in advance — a record card for a
     lookup, a preview for a draft — and a composed surface the choice for what it does not.
   - A call's arguments and result are model and tool output. The renderer puts them on the page
     as text, like any server data, and loads nothing from a URL in them.
   - The trace still records the call, and its step links to the tile, so the record of the run
     stays complete.
7. **Surfaces arrive three ways, and the adapter takes all three** (WP52 Decision 11): a custom
   event from the application's server, a call to a surface tool, and a fence in the answer text.
8. **The adapter scopes ids.** A model reuses surface ids such as `s1` in every run, so a surface
   is the thread item `surface:<runId>/<surface>` and a tile `tool:<toolCallId>`. A line for a
   surface that has already been answered is refused and reported.

## §1 · JSON Patch

**Scope:** new `src/internal/json-patch.js`, `tests/unit/json-patch.test.js`.

- **Exports:** `applyPatch(document, operations)` → a new document, and `getPointer(document,
  pointer)`. The input is never mutated.
- **Supported:** the RFC 6902 operations `add`, `remove`, `replace`, `move`, `copy` and `test`,
  with RFC 6901 pointers (`~0` and `~1` escapes, `-` for append).
- **Refused:** `__proto__`, `constructor` and `prototype` segments. A failing `test` throws, and
  the patch is applied all or nothing.
- **Tests:** the RFC's own example operations, plus the refusals.
- **Shared use:** WP52's `data` operation keeps its own simple form, but its pointer code moves
  here so the two cannot drift.

## §2 · AG-UI adapter

**Scope:** new `src/components/agent-thread/ag-ui.js`, `tests/unit/ag-ui.test.js`, a new
`tests/unit/fixtures/` directory with `ag-ui-*.json` (not picked up by `node --test`, which only
runs `*.test.js`), `website/demos/agent-thread.demo.js`, `docs/llms.md`.

- **`connectAgUi(thread, options)`** → `{handle(event), state(), destroy()}`.
- **Options:** `runStatus?`, `authors`, `agent` (the author key for agent output),
  `requiresApproval(toolCall)`, `ontoolresult(id, result)`, `onstate(state)`, `onunknown(event)`,
  `onerror(error)`, `showReasoning: false`, `surfaceEvent: 'zx.surface'`, and:
  - `tools: {}`: `Record<string, (call: ToolCall) => ThreadItem|null>`, the tiles of Decision 6,
    by tool name.
  - `surfaceTools: ['show_surface', 'ask_user']`: the tool names that carry a WP52 `document`.
  - `inlineSurfaces: false`: split surface fences out of answer text.
  - `catalog`: a narrowed WP52 catalog, given to every surface the adapter creates.
- **`ToolCall`**, what a tile renderer receives: `{id, name, args, argsText, result?, error?,
  status}`.
  - `args` is the parsed object once the arguments are complete, and `null` before.
  - `status` is a WP51 run state: `queued` while the arguments arrive, `waiting` for an approval,
    `running` until the result, then `done`, `failed`, or `skipped` when the approval was
    rejected.
- **Mapping:**
  - Run started, finished and error events drive `runStatus` and a `notice` item on error.
  - Text message start, content and end events become an `answer` item:
    - content is fed through `thread.appendText`;
    - end closes the answer.
  - Tool call start, args, end and result events become `trace` steps:
    - arguments accumulate as a string and are shown once complete;
    - a result fills the step.
  - **Tiles:** for a call named in `tools`, the renderer is called at each status change, never
    on an argument delta.
    - Its first result that is not `null` is inserted at the call's place in the thread with the
      id `tool:<toolCallId>`, and later results patch it in place; the adapter sets the id, the
      renderer cannot.
    - The call's trace step gains a ref to the tile. The adapter answers the thread's `open` for
      that ref with `thread.reveal('item:tool:<toolCallId>')`; it never handles another ref.
    - An approval-gated call keeps its ApprovalCard (Decision 4); the tile follows it, whatever
      status the renderer first answers at.
    - A renderer that throws is reported through `onerror`, and the trace step stays as it was.
  - **Surface tools:** a call named in `surfaceTools` becomes a surface item, and its trace step an
    `ask` step.
    - While the arguments arrive, the item stands as a Skeleton.
    - Once complete, the arguments are parsed and validated as one WP52 `document`.
    - The person's reply is the call's result, through `ontoolresult(id, reply)`, with the
      surface's `errors` added when there are any.
    - Arguments that are not JSON draw nothing and answer the call at once with
      `{error: 'invalid-arguments'}`.
    - A `show` surface with no actions has nothing to answer, so the call is answered at once with
      `{shown: true, surface, errors?}` and the surface stays on screen.
  - **Inline surfaces:** with `inlineSurfaces`, answer content goes through WP52's
    `inlineSplitter()`.
    - Prose before a fence stays in the answer. The fence's lines go to their surfaces, inserted
      after it.
    - Prose after a fence continues in a new answer item `<messageId>#<n>`, by the same author, so
      the thread draws it as the same turn.
    - A fence still open when the message ends is reported through `onerror`, and its surfaces
      are cancelled when the run ends (WP52 Decision 7).
  - **Custom events:** a custom event named by `surfaceEvent` carries WP52 operations into
    `thread.surface(id)`. Its `value` is one operation, or `{ops: […], token?}`. A `token` is taken
    from the event that opens the surface; later ones are ignored.
  - **Tokens:** the application's `token` binds a custom-event surface to what its server issued.
    A surface tool's surface gets the tool call id as its token, and an inline surface the run id,
    so a server can bind every reply to a call or a run it knows (WP52 Decision 5).
  - State snapshot and delta events keep the application state, applied with §1 and reported
    through `onstate`.
  - Reasoning events follow Decision 3.
  - Anything else goes to `onunknown`.
- **Out of order:** as AG-UI 1.0 requires, content, arguments, an end or a result with no start are
  dropped and reported; they never create an item. A start for a closed message or tool call
  reopens it, and its content continues. A start for an id still open is ignored and reported.
- **Ending:**
  - A surface that reaches the end of its run without its `end` operation is reported and
    cancelled.
  - A tool call with no result and no pending id keeps the run from reading as finished.
  - A run error outside an open run marks the last run failed, draws its notice and is reported.
    Approvals and surfaces still waiting for a person stay open.
  - `destroy()` closes an open run as stopped.
- **Fixtures:** three recorded sequences, replayed in tests and, from the demo, into an
  AgentThread (instantly under reduced motion):
  - a plain answer with two tool calls;
  - an approval-gated tool call;
  - a call drawn as a tile, an `ask_user` call the person answers, and an answer with an inline
    surface.

## §3 · MCP elicitation handler

**Scope:** new `src/components/surface/mcp.js`, `tests/unit/mcp-elicitation.test.js`,
`website/demos/surface.demo.js`, `docs/llms.md`.

- **`elicitationHandler(options)`** → `(params) => Promise<{action, content?}>`, for an
  application's MCP client to install.
- **Form mode:** the default when `mode` is absent. It calls WP52's `elicit()`.
- **URL mode:** see Decision 5. It reports `accept` once the page was opened, and never sends
  credentials or data to the page.
- **Request shape:** the handler accepts `{mode?, message, requestedSchema?, url?,
  elicitationId?}`. That covers both the current request and the draft that moves elicitation into
  a result type; any field it does not use is ignored.
- **Unsupported schemas** reject with WP52's `TypeError`, so the client can answer the server with
  an error.
- **Options:** `target?` (inline instead of a dialog), `authors`, `serverName` (shown as the
  author: "Asked by <server>").

## Out of scope

- Transports, client SDKs and authentication.
- Agent-to-agent protocols.
- Rendering sandboxed HTML apps from MCP servers.
- Mapping Zx surfaces to or from other declarative UI protocols. A catalog for such a protocol is
  worth a separate WP once its specification reaches 1.0; public versions disagree today.
- Partial-JSON parsing of tool arguments: tiles and surface tools render from complete arguments.
- Tiles drawn by Zx itself for well-known tool names. Every tile is the application's.

## Acceptance criteria

1. `npm test` and `npm run test:browser` pass; `node tools/check-site.js` and `git diff --check`
   are clean.
2. Unit tests cover:
   - JSON Patch: the RFC examples and the refusals.
   - The AG-UI fixtures replay into the expected thread items.
   - Approval-gated tool calls wait for a decision.
   - Reasoning text is hidden by default.
   - Unknown events are reported.
   - A tile is inserted on its renderer's first non-null result, patched in place at later status
     changes, never re-rendered on an argument delta, and keeps the id the adapter gave it; a
     throwing renderer is reported and its trace step remains.
   - A surface tool's reply is its tool result, with the surface's errors; arguments that are not
     JSON answer the call at once.
   - Inline fences split across chunks; prose after a fence continues in `<messageId>#2`; an
     unterminated fence is reported and its surface cancelled at run end.
   - Surface ids are scoped per run: `s1` in two runs gives two surfaces, and a line for an
     answered surface is refused.
   - Every reply carries its token: the application's for a custom event, the tool call id for a
     surface tool, the run id for an inline surface.
   - Elicitation in form mode (accept, decline, cancel), in URL mode (consent shown, decline), and
     with an unsupported schema.
3. The demo replays the fixtures into an AgentThread, with one application tile registered, and
   shows the tool results and the replies an MCP client would send.
4. Changelog lines and the pinned protocol versions are reported.
