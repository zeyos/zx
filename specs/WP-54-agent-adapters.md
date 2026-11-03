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
review. `AGENTS.md` applies. `src/core/**` is **not** in scope. `CHANGELOG.md` is central: report
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
5. **URL mode asks first.** An MCP URL-mode elicitation is shown as a `confirm` surface that names
   the full host, emphasised, before anything opens. Opening uses `noopener`, and declining or
   closing answers `decline` or `cancel`.

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
  `showReasoning: false`, `surfaceEvent: 'zx.surface'`.
- **Mapping:**
  - Run started, finished and error events drive `runStatus` and a `notice` item on error.
  - Text message start, content and end events become an `answer` item:
    - content is fed through `thread.appendText`;
    - end closes the answer.
  - Tool call start, args, end and result events become `trace` steps:
    - arguments accumulate as a string and are shown once complete;
    - a result fills the step.
  - State snapshot and delta events keep the application state, applied with §1 and reported
    through `onstate`.
  - A custom event named by `surfaceEvent` carries WP52 operations into `thread.surface(id)`.
  - Reasoning events follow Decision 3.
  - Anything else goes to `onunknown`.
- **Out of order:** content arriving before its start creates the item, and a duplicate start for
  a known id is ignored. Both cases are reported.
- **Fixtures:** two recorded sequences, a plain answer with two tool calls and an approval-gated
  tool call, replayed in tests and, from the demo, into an AgentThread (instantly under reduced
  motion).

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

## Acceptance criteria

1. `npm test` and `npm run test:browser` pass; `node tools/check-site.js` and `git diff --check`
   are clean.
2. Unit tests cover:
   - JSON Patch: the RFC examples and the refusals.
   - The AG-UI fixtures replay into the expected thread items.
   - Approval-gated tool calls wait for a decision.
   - Reasoning text is hidden by default.
   - Unknown events are reported.
   - Elicitation in form mode (accept, decline, cancel), in URL mode (consent shown, decline), and
     with an unsupported schema.
3. The demo replays a fixture into an AgentThread and shows the replies an MCP client would send.
4. Changelog lines and the pinned protocol versions are reported.
