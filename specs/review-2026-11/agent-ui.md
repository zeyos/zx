# Agents: composing interfaces with Xenon

## What "composable for agents" means

An agent can produce a correct, accessible, on-brand interface by emitting data against a small
typed catalogue, and always gets back exactly one structured answer. It never writes markup and
never needs to read the library to do so.

1. **Data, not code.** No HTML, script or expression. Records are `$ref`s and icons are names the
   application resolves; the only addresses are `link` nodes with a validated `https:` URL, shown
   with their host, which the application may refuse.
2. **A closed loop.** Every surface ends in one reply; invalid input is dropped and reported, so the
   model repairs itself.
3. **Small by default.** The catalogue a model sees is the narrowest that does the job, and its cost
   is measured.
4. **The application owns consequences.** Confirmation policy, tool execution and placement are
   never the model's call.
5. **One component set either way.** A surface and hand-written Zx render identically, so an agent's
   draft can graduate to code.

Two audiences, two tracks: *coding agents* write Zx JavaScript at development time (layouts,
components, tokens); *runtime agents* emit `surface/1` inside a running application. Today
`llms.txt` serves the first and mentions the second in two links — WP86 separates them.

## Where the ecosystem stands

Three approaches have settled:

- **Tool → prebuilt component** — the agent calls a tool, the application maps it to a component
  (AI SDK tool parts, CopilotKit `useFrontendTool`, assistant-ui toolkits, Tambo, LangGraph).
- **Declarative tree against a catalogue** — A2UI, json-render, OpenUI, ChatKit widgets, Adaptive
  Cards, Xenon `surface/1`.
- **Sandboxed HTML** — MCP Apps (and ChatGPT apps), Claude inline visuals and artifacts, Gemini
  dynamic view.

AG-UI is the transport underneath several of them. A2UI (Google, v0.9/1.0) is the closest thing to
a cross-vendor declarative standard; MCP Apps (SEP-1865, stable 2026-01-26) is the cross-host
standard for HTML views, supported by Claude, ChatGPT, VS Code, Goose and M365 Copilot.

What only Xenon has, among the systems reviewed: intents with exactly one reply (reserved
`cancel`/`dismiss`; "a reply is the person's answer, never proof"); an application-owned
confirmation policy down to type-to-confirm; field-level `review` diffs; records as `$ref` rather
than addresses; a branching questionnaire with validation; hard limits with drop-and-report errors;
a dependency-free renderer. A2UI is the nearest neighbour — its actions also return resolved form
values — so "safest" is a claim for the evals (WP87) to back, not a given.

## Pattern coverage

| Pattern | Elsewhere | Xenon |
| --- | --- | --- |
| Reasoning disclosure, tool-call cards, grouped steps, plans | AI Elements, assistant-ui, CopilotKit | RunTrace, RunStatus |
| Sources, `[n]` citations | most | SourceList, surface text |
| Citation hover card | AI Elements, assistant-ui | **missing** (WP90) |
| Artifact panel with versions | Claude, AI Elements, ChatGPT fullscreen | application-built; shown in WP85 |
| Charts, selectable tables, forms, approvals, question flows | most | yes |
| Option cards / carousel | ChatGPT, assistant-ui, A2UI | `choice` without imagery (WP89 cards) |
| Steps / progress, tabs / disclosure, file | A2UI, assistant-ui | **missing** (WP89) |
| Follow-up chips | AI Elements, assistant-ui | PromptStarters (empty state only) (WP90) |
| Checkpoints / undo | AI Elements, assistant-ui, affectUI | **missing** (WP90) |
| Context meter, message actions, queue, attachments | AI Elements, assistant-ui | yes |
| Model picker, voice | AI Elements, assistant-ui | composer button only; no voice (later) |
| Images, maps | A2UI, assistant-ui, ChatGPT | none, deliberately (later, `$ref` only) |
| Live / updatable surfaces; UI → model "what the person sees" | ChatGPT, Tambo, MCP Apps, A2UI | **missing** (WP97) |

## Gaps, by when

**Now**

- The `agent-canvas` layout (WP85) — the protocol has no conversation that shows it.
- Catalogue profiles and `use`/`avoid` per node (WP86) — cut tokens and misuse before the
  catalogue grows.
- Documentation tiers (WP86).
- Evals before growth (WP87): golden tasks per intent and profile, measured for valid-first-try,
  repair rate, task success, tokens and the accessibility of the result; the layouts' steps drivers
  in CI.

**Next**

- SVG chart adapter, MIT (WP88).
- Nodes (WP89): `steps`/progress; `disclosure` with tabs as a variant (not a second node); `choice`
  with `display: "cards"`; `file` through `$ref`. Skip `timeline` until asked.
- Chat patterns (WP90): follow-up chips, citation hover cards, checkpoint markers.
- `bin/zx-mcp.js` (WP91), zero-dependency stdio JSON-RPC: `search_docs`, `get_component`,
  `get_layout`, `get_surface_catalog(profile)`, `validate_surface`.
- MCP Apps view (WP92): one static `ui://zx/surface` page that renders `surface/1` from a tool's
  `structuredContent` and answers through `tools/call`. Biggest distribution lever, and it keeps the
  no-HTML guarantee — the model still sends JSON.
- A2UI as an *importer* to `surface/1`, lossy and reported (WP93) — a second renderer would mean a
  second validation path. Render AG-UI `ACTIVITY_*` (how A2UI and MCP Apps travel over AG-UI) and
  `SUBAGENT_*` attribution; progressive rendering from partial tool arguments.

**Later**

- Live surfaces, restricted to `show` with non-final events, plus the "what the person sees" report.
- The agent bridge (snapshot / act over live components, WebMCP): trial on Form and Table after
  evals exist.
- Image and map nodes (application-resolved only), an MCP Apps host frame, voice.

## Simplify, don't grow

- Profiles, not a bigger default: `answer`, `ask`, `review`, `full`.
- Component overlap (date ×5, filter ×3, navigation ×5, table ×3) is real but not worth a breaking
  change; give each cluster a decision table and "use X instead" lines.
- A shared chat kit can be extracted once a fourth agent layout shows what is common.

## Documentation and agent surface

- `llms.txt`: **Rules for agents** first, then two tracks — "Writing Zx code" and "Composing
  surfaces at runtime".
- `llms-small.txt` (< 8k tokens), `docs/components/<id>.md` generated from the `<!-- doc: -->`
  sections, Copy page / Copy prompt on every component page.
- `use` / `avoid` per surface node, flowing into the prompt, `agent-surfaces.md` and
  `agent-catalog.json`.
- The `zx` skill gains a runtime-surfaces section. Publishing the skill (as Arc and vercel-labs do)
  would change the AGENTS.md rule that skills stay repository-only — a maintainer decision.
- Later: per-component "When to use / When not to use", Radix-style anatomy, keyboard and
  state-attribute tables; a public threat-model page for surfaces; public evals once numbers exist.
