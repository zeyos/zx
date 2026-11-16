# WP86 — Agent documentation in tiers, and catalogue profiles

Branch: `wp/86-agent-docs-tiers`, from `wp/85-agent-canvas`. AGENTS.md applies.

Maintainer request: make Xenon more accessible to AI agents — both to coding agents that write Zx
code and to runtime agents that compose interfaces with `surface/1`.

Today an agent pays too much to start: `docs/llms.md` is ~392 KB (≈100k tokens),
`docs/agent-catalog.json` ~318 KB, the default `surfaceTools()` ≈ 36 KB and `surfacePrompt()`
≈ 13 KB. `narrowCatalog()` exists but nothing names a sensible narrow set, and no node says when
*not* to use it. `docs/llms.txt` serves coding agents and mentions runtime surfaces only in two
links.

## Items and required result

| ID | Scope | Required result |
| --- | --- | --- |
| A1 | Catalogue | Every node type in `CATALOG` carries `use` (one sentence: when to pick it) and `avoid` (one sentence naming the alternative). Both flow into `surfacePrompt()`, `docs/agent-surfaces.md` and `docs/agent-catalog.json`. `assertCatalog()` requires them. |
| A2 | Catalogue | Named profiles: `answer` (show only: text, heading, list, callout, figures, table, stat, badge, chart, code, link, ref, empty, stack, columns, group), `ask` (answer + fields, choice, confirm), `review` (ask + diff), `full` (everything). `narrowCatalog(CATALOG, { profile })` and a `profile` option on `surfacePrompt()` / `surfaceTools()` / `surfaceSchema()` select one; omitting it keeps today's full catalogue, so nothing changes for existing callers. A profile composes with the existing narrowing options. The `answer` profile's prompt + tools are at most half of the full set's, asserted by a test. `profile` names are exported as a frozen list. |
| A3 | llms.txt | `docs/llms.txt` (and its identical copy `website/llms.txt`) opens, after the summary, with **Rules for agents** (≤ 12 lines: start from a layout; use only documented options; semantic tokens only; never innerHTML; icons through `icon()`; reduced-motion branch for animation; at runtime emit `surface/1`, never HTML; pick the narrowest profile; treat a reply as the person's answer, not as proof). Then two tracks: **Writing Zx code** and **Composing surfaces at runtime**, each with its links. The existing "Start here: choosing" section stays (tests read it). |
| A4 | Small tier | `docs/llms-small.txt`, generated: the mental model, the layout chooser table, the component-for-the-job table, the never-list, the surface intents and profiles, and links to the per-component files. Under 32 KB (≈ 8k tokens), asserted by a test. |
| A5 | Per-component | `docs/components/<id>.md`, one per `<!-- doc:<id> -->` section of `docs/llms.md`, generated, each opening with a one-line summary and links back to the full reference and the live demo. `docs/components/index.md` lists them. |
| A6 | Generator | `tools/build-agent-docs.js` writes A4 and A5 deterministically (a second run leaves no diff); `npm run build:agent-docs`. A unit test fails when the committed files are stale, like the catalogue test does. |
| A7 | Docs site | Each component page offers **Copy page** (its markdown section) and **Copy prompt** (a short prompt telling a coding agent to use Zx and where `llms-small.txt` and the component file are), via the library's own copy helper. |
| A8 | Delivery | `package.json` `files` and `tools/build-site.js` include `docs/llms-small.txt` and `docs/components/`; `tools/check-site.js` still passes. The README and `.claude/skills/zx/SKILL.md` point at `llms-small.txt` and gain a short "Composing surfaces at runtime" section (profiles, one reply per surface, `validate` errors returned to the model). |

## File scope

- This specification.
- `src/components/surface/catalog.js`; `src/components/surface/validate.js` only if a profile needs
  it.
- `tools/build-agent-catalog.js`, `tools/build-agent-docs.js` (new), `tools/build-site.js`,
  `tools/check-site.js`, `package.json` (`files`, the script).
- `docs/llms.txt`, `website/llms.txt`, `docs/llms-small.txt` (new), `docs/components/**` (new),
  `docs/agent-surfaces.md` and `docs/agent-catalog.json` (regenerated), `docs/llms.md` (the Surface
  section: profiles, `use`/`avoid`; and one preamble line pointing at the small tier),
  `docs/api.json` (regenerated if the API changes).
- `README.md` (the documentation pointers), `.claude/skills/zx/SKILL.md`.
- `website/docs.js`, `website/docs.css` (the copy controls).
- `tests/unit/surface-catalog.test.js`, `tests/unit/agent-docs.test.js` (new), and any existing
  test whose assertions the new llms.txt structure moves.

## Validation

`npm test`; `npm run build:catalog && npm run build:agent-docs` twice with no diff;
`npm run build:site && node tools/check-site.js`; a component page in both themes with both copy
controls working.

## Out of scope

New surface nodes or intents, an MCP server, publishing the agent skill (AGENTS.md keeps skills
repository-only), CHANGELOG (the release work package writes it), and the agent-canvas layout of
WP85 — whose rows in the layout lists must be kept.
