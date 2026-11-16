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

Xenon already has the most disciplined agent protocol in the field. `surface/1` is JSON only — no
HTML, script, expression or URL — every surface ends in exactly one `reply/1`, the application owns
confirmation policy and resolves records (`$ref`), and invalid input is dropped and reported so the
model can repair it. One catalogue generates the schema, the tool definitions, the prompt and the
docs. AG-UI 1.0, the AI SDK UI message stream and MCP elicitation adapters are current. None of the
five references has an equivalent; A2UI and json-render have no reply discipline.

The weaknesses are about *reach*, not substance:

1. **It is invisible.** The home page never mentions agents; only `agent-chat` mounts a surface,
   and only one `ask`. No conversation shows charts, tables, reviews, choices or questionnaires
   composed by an agent. → fixed by WP85 (the agent canvas).
2. **It is expensive to start.** `docs/llms.md` ≈ 100k tokens, `agent-catalog.json` ≈ 318 KB, the
   default tool set ≈ 9k tokens; no small tier, no per-component file, no "when not to use".
   → WP86.
3. **Its charts need a host library.** The `chart` node falls back to a table without an injected
   Chart.js — at odds with "dependency-free". → WP87.
4. **It does not speak the other protocols.** No A2UI import, no MCP Apps view, no MCP server for
   coding agents. → WP90–92.

## Decisions taken in this review

- **Positioning.** Xenon is *the safest structured target for agents*: data, not code; a closed
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
- **Pro: staged.** First a paid templates / Figma / support offer with no licence code; a key-gated
  `@zeyos/zx-pro` only when an item shows demand. Past MIT releases stay MIT forever; nothing moves
  from free to Pro.

## Roadmap

WP84–86 were specified and built in this session; the rest are proposals, each to get its own
`specs/WP-*.md` when it starts.

| WP | Scope | Done when |
| --- | --- | --- |
| **84** ✓ | Header nav icons on the deployed site (`data-nav`), "Layouts" → "Showcase" | Icons render on clean URLs, both themes, phone width |
| **85** | `agent-canvas` Showcase layout: eight scripted scenarios, every answer a surface; artifact panel with Preview / JSON / Reply and versions; follow-up chips | shoot + audit pass at 1440 and 390, both themes, preview and steps |
| **86** | Catalogue profiles (`answer`/`ask`/`review`/`full`), `use`/`avoid` per node; Rules for agents and two tracks in `llms.txt`; `llms-small.txt`; `docs/components/<id>.md`; Copy page / Copy prompt | `answer` profile ≤ 50 % of full; generated docs stable; site check passes |
| 87 | Dependency-free SVG chart adapter (bar, line, pie, doughnut), MIT; Surface uses it by default | The four kinds render without Chart.js, both themes, size budget kept |
| 88 | Surface nodes: `steps`/progress, `disclosure` (tabs as a variant), `choice` with `display: "cards"`, `file` via `$ref` | Each node validated, rendered, with a worked example and a `use`/`avoid` line |
| 89 | Chat patterns: follow-up chips as a component, citation hover cards, checkpoint markers in AgentThread | agent-canvas switches its chips to the component |
| 90 | `bin/zx-mcp.js`: stdio MCP server — `search_docs`, `get_component`, `get_layout`, `get_surface_catalog(profile)`, `validate_surface` | A client lists the tools; `validate_surface` returns the drop reports |
| 91 | MCP Apps view: one `ui://zx/surface` page rendering surface/1 from `structuredContent`, host CSS variables mapped onto `--zx-*` | A surface renders and replies in one MCP Apps host |
| 92 | A2UI importer (lossy, reported) and AG-UI `ACTIVITY_*` / `SUBAGENT_*` rendering | The A2UI basic catalogue round-trips with reported losses |
| 93 | Website pass (see [website.md](website.md)) | `check-site` passes; both themes; phone width |
| 94 | Opt-in `fonts.css` (Inter + Geist Mono), Lucide update, icon names in the catalogue | Opt-in import works; licence notices shipped |
| 95 | Live surfaces: non-final `event` replies on `show` surfaces, agent patches after a reply, a "what the person sees" report | Still exactly one final reply per surface |
| 96 | Pro stage 1 (separate private repository) | Legal review done; first template pack sold |
| 97 | Surface evals (valid-first-try, repair rate, tokens) and an agent-bridge trial on Form and Table | Numbers exist to decide on the bridge |

Ordering rationale: 85 and 86 make the existing strength visible and cheap; 87 removes the one
external dependency an agent hits; 88–89 close the most common pattern gaps; 90–92 widen reach to
agents and hosts that were not written for Xenon; 95 only after the evals show where models fail.
