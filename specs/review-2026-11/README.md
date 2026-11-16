# Xenon next version — review and plan, November 2026

A review of Xenon/Zx 5.7.1 against five reference libraries the maintainer chose (vercel-labs/ui,
Beautiful UI, Radix Primitives, affectUI, Arc UI) and against the agent-composed-UI ecosystem
(A2UI, json-render, AI SDK / AI Elements, MCP Apps, OpenAI Apps SDK, AG-UI / CopilotKit,
assistant-ui, OpenUI, Tambo, LangGraph, Adaptive Cards, Claude artifacts). Three research passes
read primary sources; a separate reviewer then challenged the draft position. Where the research
and the review disagreed, the call made here is stated.

Nothing in this folder is published: `specs/` is neither a site source nor in the package allowlist.

| Topic | File |
| --- | --- |
| Agents: what "composable for agents" means, gaps, adapters, documentation | [agent-ui.md](agent-ui.md) |
| A Pro offer: licence options, what goes in it, pricing, enforcement, legal review | [pro-licensing.md](pro-licensing.md) |
| The website: what the references do well, concrete moves for this site | [website.md](website.md) |
| Fonts and icons: what to bundle, what to reference | [fonts-icons.md](fonts-icons.md) |

## Verdict

Of the agent protocols reviewed, `surface/1` has the strictest contract — a qualitative judgement
until the evals in WP87 put numbers on it. It is JSON only: no HTML, script or expression; the only
addresses are `link` nodes with a validated `https:` URL, which the application may refuse; records
are `$ref`s the application resolves. Every surface ends in exactly one `reply/1`, the application
owns confirmation policy, and invalid input is dropped and reported so the model can repair it. One
catalogue generates the schema, the tool definitions, the prompt and the docs. AG-UI 1.0, the AI SDK
UI message stream and MCP elicitation adapters are current. None of the five references has an
equivalent. A2UI comes closest — its actions carry resolved form values back — but it has no
one-reply rule and no application-owned confirmation levels.

The weaknesses are about *reach*, not substance:

1. **It is invisible.** The home page never mentions agents; only `agent-chat` mounts a surface,
   and only one `ask`. No conversation shows charts, tables, reviews, choices or questionnaires
   composed by an agent. → fixed by WP85 (the agent canvas).
2. **It is expensive to start.** `docs/llms.md` ≈ 100k tokens, `agent-catalog.json` ≈ 318 KB, the
   default tool set ≈ 9k tokens; no small tier, no per-component file, no "when not to use".
   → WP86.
3. **It is unmeasured.** No numbers for valid-first-try, repair rate, token cost or task success,
   so neither the claims above nor the next catalogue additions rest on evidence. → WP87.
4. **Its charts need a host library.** The `chart` node falls back to a table without an injected
   Chart.js — at odds with "dependency-free". → WP88.
5. **It does not speak the other protocols.** No A2UI import, no MCP Apps view, no MCP server for
   coding agents. → WP91–93.

## Decisions taken in this review

- **Measure first.** Evals come right after WP86, before the catalogue grows or new integrations
  start.
- **Positioning.** Xenon aims to be *the safest structured target for agents*: data, not code; a closed
  loop; small by default; the application owns consequences; one component set whether a person or
  an agent composed the screen. Do not chase sandboxed-HTML generative UI; add interop instead.
- **The extended agent-chat demo is a new layout**, `agent-canvas`, not a bigger `agent-chat` or
  `ai-chat`: every agent answer there is a `surface/1` document whose JSON and reply the reader can
  inspect. It is the protocol's living documentation.
- **Shrink before growing.** Catalogue profiles and `use`/`avoid` guidance come before any new
  surface node.
- **Basic charts stay MIT.** A dependency-free SVG adapter for the four surface chart kinds is core;
  advanced chart types can be Pro.
- **Agent bridge (operate live UI, à la vercel-labs/ui): later.** WebMCP is an origin trial, and it
  needs a security and accessibility review of every component. The cheap first slice — telling the
  model what the person currently sees — comes with live surfaces.
- **Pro: staged, demand first.** Interview partner teams before building anything; then a paid
  templates / Figma offer with no licence code, with support and LTS sold separately as recurring
  services; a key-gated `@zeyos/zx-pro` only when an item shows demand. Past MIT releases stay MIT
  forever; nothing moves from free to Pro.

## Roadmap

WP84–86 and the review fixes (86b) were specified and built in this session; the rest are
proposals, each to get its own `specs/WP-*.md` when it starts.

| WP | Scope | Done when |
| --- | --- | --- |
| **84** ✓ | Header nav icons on the deployed site (`data-nav`), "Layouts" → "Showcase" | Icons render on clean URLs, both themes, phone width |
| **85** ✓ | `agent-canvas` Showcase layout: eight scripted scenarios, every answer a surface; artifact panel with Preview / JSON / Reply and versions; follow-up chips | shoot + audit pass at 1440 and 390, both themes, preview and steps |
| **86** ✓ | Catalogue profiles (`answer`/`ask`/`review`/`full`), `use`/`avoid` per node; Rules for agents and two tracks in `llms.txt`; `llms-small.txt`; `docs/components/<id>.md`; Copy page / Copy prompt | `answer` profile ≤ 50 % of full; generated docs stable; site check passes |
| **86b** ✓ | Review fixes: stream cancellation, chips during a pending question, AgentThread following streamed surfaces, artifact reveal, static preview charts, generator marker validation, the dist smoke check | All smoke suites pass |
| 87 | Surface evals: golden tasks per intent and profile → valid-first-try, repair rate, task success, tokens, accessibility of the rendered result; the steps drivers of agent layouts in CI (reruns, cancellation at each phase, motion changes, phone width, keyboard only) | Baselines recorded; CI runs the drivers |
| 88 | Dependency-free SVG chart adapter (bar, line, pie, doughnut), MIT; Surface uses it by default | The four kinds render without Chart.js, both themes, size budget kept |
| 89 | Surface nodes: `steps`/progress, `disclosure` (tabs as a variant), `choice` with `display: "cards"`, `file` via `$ref` — each justified by the evals | Each node validated, rendered, with a worked example and a `use`/`avoid` line |
| 90 | Chat patterns: follow-up chips as a component, citation hover cards, checkpoint markers in AgentThread | agent-canvas switches its chips to the component |
| 91 | `bin/zx-mcp.js`: stdio MCP server — `search_docs`, `get_component`, `get_layout`, `get_surface_catalog(profile)`, `validate_surface` | A client lists the tools; `validate_surface` returns the drop reports |
| 92 | MCP Apps view: one `ui://zx/surface` page rendering surface/1 from `structuredContent`, host CSS variables mapped onto `--zx-*` | A surface renders and replies in one MCP Apps host |
| 93 | A2UI importer (lossy, reported) and AG-UI `ACTIVITY_*` / `SUBAGENT_*` rendering | The A2UI basic catalogue round-trips with reported losses |
| 94 | Server side of the loop: a complete reply-consumption example (issued-token binding, value and action validation, authorisation, stale-record rejection, deduplication by surface *instance*, not only `surface#action`); cumulative stream budgets (operations, bytes, errors) with a summarised report; catalogue narrowing by entry names so a bundled `Surface` accepts a catalogue from another module instance | Example runs end to end; budgets tested; mixed-bundle test passes |
| 95 | Website pass (see [website.md](website.md)) | `check-site` passes; both themes; phone width |
| 96 | Opt-in `fonts.css` (Inter + Geist Mono), Lucide update, icon names in the catalogue | Opt-in import works; licence notices shipped |
| 97 | Live surfaces: non-final `event` replies on `show` surfaces, agent patches after a reply, a "what the person sees" report | Still exactly one final reply per surface |
| 98 | Pro stage 1 (separate private repository), after partner interviews | Legal review done; first template pack sold |
| 99 | Agent-bridge trial on Form and Table | The evals decide whether it ships |

Ordering rationale: 85–86 make the existing strength visible and cheap; 87 measures before anything
grows; 88 removes the one external dependency an agent hits; 89–90 close the most common pattern
gaps where the evals show models need them; 91–93 widen reach to agents and hosts not written for
Xenon; 94 hardens the server side every real integration needs; 97 only after the evals show where
models fail.
