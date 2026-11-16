# WP85 — Agent canvas: a Showcase layout where every answer is a surface

Branch: `wp/85-agent-canvas`, from `wp/84-site-nav-showcase`. AGENTS.md applies, in particular
"Layout examples".

Maintainer request: an extended demo of the agent chat pane, with different interactions and
different artifacts the agent creates directly — charts, tables, input forms. Today only
`agent-chat` mounts a surface (one `ask`), and `ai-chat`'s artifacts are BlockView documents, so
the `surface/1` protocol — the library's strongest agent feature — has no conversation that shows
it. This layout is that conversation: every agent answer is a `surface/1` document, and the reader
can see the JSON behind each one and the reply it produced.

## Design

A new screen pattern, `agent-canvas`, block class `canvas`, listed in `PATTERN_IDS` right after
`agent-chat`. One shell: `suiteNav` column, the main pane (AgentThread above a Composer, follow-up
chips between them), and an inspector column that is the **artifact panel**. `adaptiveShell` makes
the panel a drawer below 1180px; at 390px the thread is alone and the panel is a drawer.

The model is scripted; everything else is real. Keyword-matched prompts (and the starter and
follow-up chips) pick a scenario; anything else gets one plain reply saying which requests the demo
knows. Parsing, validation, rendering, policy confirmations, replies, receipts and validation error
reports are the library's own. The layout's `blurb` says that the agent is scripted.

### Scenarios

Each scenario is a top-of-module constant: the array of JSONL operation lines (`begin`, `node`,
`append`, `data`, `actions`, `end`, …) the agent streams, so the documentation page offers them as
data tabs. The data comes from `fixtures.js` (fictional companies, invoices, people) or constants in
the module.

| # | Prompt (chip text) | Surface | The person |
| --- | --- | --- | --- |
| 1 | "How did October go?" | `show`: `columns` with three `stat` tiles, a `chart` (bar), a `text` streamed in with `append` carrying `[n]` markers, sources | opens it in the panel, toggles the chart's data table |
| 2 | "Chase the overdue invoices" | `review`: multi-select `table` + `fields` (template, send date); primary action naming `tool: "mail.send"`, which the application's policy puts under `confirm` | selects rows, submits, confirms |
| 3 | "Draft a credit note" | `ask`: `fields` with a conditional `x-zx.visible` property, a `slider`, a `date` | meets a validation error, corrects it, submits |
| 4 | "Tidy up Helios' record" | `review`: a `diff` whose rows carry `ref` | accepts some rows, rejects the rest |
| 5 | "Set up the dunning run" | `questionnaire`: branching `next`, `validate` rules, a review step | walks the steps |
| 6 | "Show that as a trend" | `choose`: one `choice` with icons; then scenario 1's surface issued again as a line chart | picks; the panel shows the artifact's versions v1 and v2 |
| 7 | "Delete the old drafts" | `confirm` with a `kind: "danger"` action that the policy puts under type-to-confirm | types the confirmation, or cancels |
| 8 | "Give me the webhook snippet" | `show`: `code` + `callout`. The first attempt carries an unknown node type | sees the validation report come back and the corrected surface arrive |

Scenarios 2–5 and 7 end with a short `show` surface built from the reply values (`figures`,
`callout`, `badge`), so the loop closes visibly: question → structured reply → the agent's answer.

### Artifact panel

Tabs (Tabbox): **Preview**, **JSON**, **Reply**.

- **Preview** mounts a second, read-only Surface only for `show` surfaces and for answered surfaces
  (drawn as receipts through the `reply` option). An unanswered asking surface is never drawn
  twice — the panel shows "Waiting for your answer in the conversation" — so a surface keeps exactly
  one place to answer it.
- **JSON** shows the surface's `toDocument()` as formatted, copyable code.
- **Reply** shows the `reply/1` object and its `surfaceText()` rendering, or that there is none yet.
- **Versions**: an application-held list per artifact id with previous/next controls and
  "v2 of 2 · Latest". Scenario 6 produces a second version of scenario 1's artifact.
- Each surface in the thread has an "Open in panel" control; the panel follows the most recent
  surface until the reader picks one.

### Streaming, follow-ups, keyboard

- Operation lines are written through the thread's surface stream (`thread.surface(id)` and
  `write()`/`apply()`) on the kit's timers. Under reduced motion each surface is applied whole.
  Stop (the composer's stop, and Esc) cancels the timers and cancels the surface.
- Follow-up chips: a labelled group of `button()`s between the thread and the composer, replaced
  after each finished answer; a press sends its text as the person's message. The empty
  conversation offers the scenario prompts as PromptStarters.
- Keys through `shortcuts(root, …, context)`: `/` focuses the composer, `Esc` stops a stream,
  `[` and `]` step through versions, `?` opens the shortcut sheet; Mod+I toggles the panel through
  `adaptiveShell`. Thread, surfaces and composer keep their own APG keyboard maps.

### Charts

Start `loadChartJs()` at mount and pass a `ChartJsAdapter` as `surfaceOptions.chartAdapter`
(and to the panel's Surface). If the script cannot load, build without an adapter: charts then show
their data table, which is the documented fallback.

### Preview mode

The first state only: scenario 1 already complete in the thread, the panel open on it, static
chips. No timers, streaming, toasts, launcher, or `focus()`.

## File scope

- This specification.
- `website/layouts/agent-canvas.layout.js`, `website/layouts/agent-canvas.layout.css` (every
  selector under `.canvas`), `website/layouts/index.js` (the id), `website/layouts.css` (the import).
- `tests/unit/layout-templates.test.js` (its entry), `tests/layouts/agent-canvas.steps.mjs` (a
  `--steps` driver that runs all eight scenarios).
- The one row naming `agent-canvas` in each layout list the agent-guide test checks:
  `docs/llms.md` ("Choosing what to build with"), `docs/llms.txt`, `website/llms.txt`, `README.md`,
  `.claude/skills/zx/SKILL.md` ("Start from a layout"). Edit those rows only.

No `src/` changes. If a component gap blocks a scenario, stop and report the smallest change rather
than working around it in the layout.

## Validation

- `npm test`.
- `node tools/shoot-layout.js agent-canvas --out <dir>` and `node tools/audit-layout.js
  agent-canvas` at 1440 and 390 wide, light and dark, with `--preview`, and with
  `--steps tests/layouts/agent-canvas.steps.mjs`. Nothing left on `<body>` after unmount.
- `npm run build:site && node tools/check-site.js`; `node tools/run-smoke.js` (the gallery tile
  count follows `LAYOUT_IDS`).

## Out of scope

Changes to components or the surface protocol, a real model or network, CHANGELOG (the release
work package writes it), the documentation tiering of WP86.
