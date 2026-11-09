# WP79 — Release 5.7.0

Branch: `wp/79-release-5-7-0`, from WP78. AGENTS.md applies.

## Requested result

Release the completed library improvements as version 5.7.0, merge them to `main`, push the
verified commit and release tag, publish the GitHub Release, and verify the npm package and
production documentation deployment. The user explicitly authorized these release actions.

## File scope

- This specification.
- `CHANGELOG.md`: publish accurate product changes under 5.7.0, dated 2026-11-09, with a fresh
  Unreleased section. Replace superseded picker API names with the supported Select factories;
  describe locale documentation, compatibility notes, and intentional visual changes.
- `package.json`, `package-lock.json`: version metadata only.
- `tools/size-budget.json`: raise only the three unminified JavaScript gzip budgets to the next
  5,000-byte boundary (575,000 ESM, 585,000 global, 225,000 ZeyOS). The added locale/storage and
  lifecycle code exceeds the previous limits; bundle inputs contain only local `src/` modules.
  Keep all minified and CSS budgets unchanged.
- Generated `docs/api.json` if the release build requires an update; ignored `dist/` and `site/`
  build output. Temporary validation reports and release-body files stay outside the repository.

## Release contract

- Follow `docs/RELEASING.md`. Compare against the latest released tag, inspect the full visual
  report including layouts, and account for intentional differences in the changelog.
- Run unit/token checks, distribution/type builds, size checks, browser regressions/smoke checks,
  and the website build/audit. Check the npm package and site for private working material.
- Keep the zero-runtime-dependency contract and all existing dependency versions unchanged.
- Merge with current remote `main` without discarding unrelated work or rewriting shared history.
  Commit the versioned release on this WP branch, merge to `main`, and create annotated `v5.7.0`.
- Push `main` and the tag. Publish product-only release notes on GitHub to trigger npm publication;
  the main push triggers Netlify. Check CI, npm version, and deployed site revision and examples.
- Rebuild the local preview from the final release revision as well.

## Validation

- All 1,852 unit tests and semantic-token lint for 127 CSS files pass. Distribution builds emit
  192 declaration files, and all gzip budgets pass after the documented unminified adjustment.
- All 136 browser regressions, 251 source smoke checks and six distribution checks pass. The
  documentation shell, all 21 layout previews, standalone layouts and the German sweep of
  17,643 strings pass.
- The full comparison with v5.6.0 covers 666 sections without rendering problems: 140 unchanged,
  526 changed, none added or removed. Theme Studio geometry accounts for the broad differences;
  the agent-chat example is the only changed layout. Representative before/after images were
  inspected and intentional differences are covered by the release notes.
- The generated site audit passes for 503 public files. The npm dry run contains 516 files and
  no forbidden private paths; both Select preset sources are included.
- An independent read-only bundle-input review confirms all JavaScript inputs are local `src/`
  files, with no external runtime imports.

## Out of scope

New component behavior, dependencies, core changes, instruction-file changes, infrastructure or
system settings, and publishing internal reports, prompts, specifications, or review material.
