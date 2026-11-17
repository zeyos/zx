# WP91 — Library audit and release 5.8.0

Branch: `wp/91-audit-release-5-8-0`, from `main` after WP90. AGENTS.md applies.

## Requested result

A systematic review of the library as it stands — bugs, missing or obsolete tests, abandoned or
unreferenced files, inconsistencies, redundant implementations — with independent reviewers
(parallel review agents per area and a second model as sparring partner), the confirmed findings
fixed, and the result released as 5.8.0: merged to `main`, pushed with an annotated tag, and
published through a GitHub Release. The user explicitly asked for the merge, the push and this
version number, for WP88 (`wp/88-svg-chart-adapter`, finished but never merged) to ship in 5.8.0,
and for the stale `wp/85-agent-canvas-impl` and `wp/86-agent-docs-tiers-impl` branches and their
worktrees to be deleted.

## File scope

Library-wide, because the review is. `src/core/**` may be modified for confirmed defects (focus
trap, storage fallback, `deepMerge`, HTTP, Font Awesome loading, position cleanup, CSV export,
DST parsing, `dragAxis` direction). Public APIs are not renamed or removed; behaviour changes
are bug fixes, each named in the changelog. Abandoned files are deleted where nothing references
them: the gx compatibility layer (`src/compat/**`, `src/compat-entry.js`, unbuilt and unshipped
since 5.0.0), the unregistered saved-views demo, the duplicate `website/llms.txt`, and the WP0
`.gitkeep`. Tooling (`tools/**`, CI build step), generated references (`docs/api.json`,
`docs/llms-small.txt`, `docs/components/*.md`), `README.md`, `CHANGELOG.md`, `package.json`,
`package-lock.json` and `tools/size-budget.json` (raised for WP88's adapter and the fixes, with
the measured sizes in the release notes) are in scope.

## Review areas

Core, internal, custom elements and the ZeyOS binding; inputs and forms; pickers; data views;
overlays, navigation and layout; agent components and AgentAvatar; WP88's chart renderer; and
repository hygiene (reference graph of tracked files, demo and layout registries, exports, package
contents, generated-docs drift, changelog claims). Every finding is verified against the code
before it is fixed, and a fix comes with a unit test or a browser regression where practical.

## Release contract

Follow `docs/RELEASING.md`: unit and token checks, distribution and type builds (now including a
consumer-side declaration check), size check, browser regressions and smoke checks, site build and
audit, package dry run, and the full visual comparison with v5.7.1, with every difference accounted
for in the changelog.

## Out of scope

New features beyond WP88, API renames, dependency changes, instruction-file changes, deleting
other merged local branches, renumbering historical specs, and infrastructure or system settings.
