# WP86b — Review fixes for WP85/WP86, and the dist smoke check

Branch: `wp/86b-review-fixes`, from `wp/86-agent-docs-tiers`. AGENTS.md applies.

An independent review of WP84–86 found no critical issue and the defects below. The dist smoke
check has failed since WP83 for an unrelated reason, fixed here too.

## Items and required result

| ID | Scope | Required result |
| --- | --- | --- |
| F1 | agent-canvas | A stream that finishes early (reduced motion switched on mid-stream, Esc, Stop, a new message) cancels its pending timer, and neither the step nor the finish can run twice for one stream: switching motion during the first webhook stream yields exactly one report and one correction. |
| F2 | agent-canvas | While a surface question is unanswered, the follow-up chips that start an unrelated task are hidden; nothing silently supersedes a half-filled surface. The composer keeps its existing "waiting for your answer" behaviour. |
| F3 | AgentThread | Operations streamed into `thread.surface(id)` (`apply()`, `write()`, `end()`) follow the output exactly as the thread's own updates do: the end stays in view if the reader was at the end, otherwise "Jump to latest" appears. No change for consumers that do not stream into surfaces. Unit or regression test. |
| F4 | agent-canvas | After the person sends a message, presses a chip, or answers a surface, the thread follows the output again (`scrollToEnd()` or equivalent). |
| F5 | agent-canvas | Choosing an artifact in the navigation's artifact list reveals the panel the same way "Open in panel" does — the drawer opens below 1180px, a collapsed inspector expands — and focus moves sensibly. |
| F6 | agent-canvas | In preview mode charts do not animate: the Chart.js adapter gets `animation: false` for the thread's and the panel's surfaces. |
| F7 | build-agent-docs | Before writing or deleting anything, the generator checks the `<!-- doc: -->` markers: each opened once and closed once, not nested, unique ids, every id a safe file name. On any violation it exits non-zero, naming the marker, and changes no file. Unit test with a malformed fixture. |
| F8 | dist smoke | `tests/smoke/smoke-dist.html` ignores a registered custom property (`@property`) on an element where it holds its registered initial value, so a registration in one component's CSS no longer reads as a difference against a subset that omits that component. A token missing from a subset still fails the check. |

## File scope

- This specification.
- `website/layouts/agent-canvas.layout.js`, `website/layouts/agent-canvas.layout.css`,
  `tests/layouts/agent-canvas.steps.mjs`.
- `src/components/agent-thread/agent-thread.js` (F3 only), its unit test or a regression in
  `tests/regression/`.
- `tools/build-agent-docs.js`, `tests/unit/agent-docs.test.js`.
- `tests/smoke/smoke-dist.html`.

## Validation

`npm test`; `node tools/shoot-layout.js agent-canvas` and `node tools/audit-layout.js agent-canvas`
at 1440 and 390, with `--preview` and with the steps driver; `node tools/run-smoke.js` all PASS.

## Out of scope

New components, the surface protocol, CI configuration, the server-side reply example and the
catalogue-identity and stream-budget proposals (recorded in the review roadmap).
