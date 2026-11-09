# WP65 — Library review corrections and regression integration

Base: `270d6a5`. Work on `wp/65-library-review-fixes`; WP66–WP70 use that same
integration branch. `AGENTS.md` applies. The owner requested specs for the confirmed review
findings and implementation of P1/P2 corrections with regression tests. Specs and test fixtures
are repository-only and must not be copied into the public site or package.

## Packages and ownership

- WP66: Questionnaire, numeric fields, Select, locale picker and Datebox.
- WP67: overlays, navigation and Dock.
- WP68: calendar, editor, lazy hierarchy views and Kanban.
- WP69: HTTP/upload, DOM/keyboard helpers, streamed answers and site entry assets.
- WP70: saved-view availability with an explicit baseline fallback.
- WP71: confirmed P3 maintenance backlog; specification only in this implementation pass.

Implementation may run in parallel with disjoint scopes. One integration owner edits shared
documentation, generated API output, test infrastructure and Git history. Agents do not commit.
Commit each component's correction and regressions with a concise message, on the integration branch.

## Scope (integration owner)

- `specs/WP-65-library-review-fixes.md`, `specs/WP-66-form-review-fixes.md`,
  `specs/WP-67-overlay-review-fixes.md`, `specs/WP-68-data-review-fixes.md`,
  `specs/WP-69-kernel-review-fixes.md`, `specs/WP-70-saved-view-recovery.md`,
  `specs/WP-71-review-maintenance.md`.
- `tools/run-regressions.js`, `tests/regression/harness.html`, `package.json` (scripts only).
- `docs/llms.md`, `docs/api.json`, `CHANGELOG.md`: supported behavior and release notes only.
- `tests/unit/api-reference.test.js` only if the corrected public contract needs an assertion.

## Regression contract

Use existing Node tests for pure logic. Add focused browser suites in `tests/regression/`, each
exporting `cases`, an array of `{name, run({page, theme, base})}` descriptors. The runner loads
the source library as `window.zx` in a fresh page for each case, with real styles and the selected
theme. It runs every case in light and dark by default. Cases use the installed `playwright-core`
and Chrome, never install another browser or library, and fail on unexpected page/console errors.
Use real keyboard/pointer actions for focus, native undo and drag behavior. Control deferred
promises instead of arbitrary waits where possible. `REGRESSION_BASE` may reuse a local server;
otherwise the runner owns and cleans up its server. CLI suite names allow focused runs.

`npm run test:browser` runs the regressions as well as existing smoke suites. A missing or failed
Chrome launch fails this explicit browser command. Regression fixtures stay outside public sources.
Where practical demonstrate that each new assertion fails against the original implementation;
record verification in the completion report rather than publishing review notes.

## Acceptance

1. WP66–WP70's behavioral requirements and regression cases pass; P3 work stays deferred.
2. `npm test`, declaration/bundle build, full browser regression and smoke suites pass.
3. Regenerate API data after public JSDoc changes. Build a fresh site and run `tools/check-site.js`;
   the generated output and package source lists expose none of these specs or test fixtures.
4. Check changed component demos in both themes without console errors. No dependencies added.
5. Review all diffs, confirm scopes, and commit completed work. Do not publish or push.

## Out of scope

New components, visual redesign, new languages, client-schema migration, dependency updates,
unconfirmed review claims, release/version bumps, deployment and package publication.
