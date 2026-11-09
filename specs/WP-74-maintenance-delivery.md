# WP74 — Reproducible assets, package discovery and delivery checks

Branch: `wp/71-review-maintenance`. Implements WP71 M10–M14 and integration for WP72–75.
Status: complete, 2026-11-09.
AGENTS.md applies. The owner requested a fresh website for local testing after the remaining fixes.

## Scope

- `specs/WP-71-review-maintenance.md` and `specs/WP-72-maintenance-lifecycle.md`,
  `specs/WP-73-maintenance-localization.md`, this spec, `specs/WP-75-maintenance-css-checks.md`.
- `website/vendor/zeyos-client.esm.js`, new `website/vendor/zeyos-client.manifest.json`,
  new `tools/build-client-vendor.js`, `tools/build-site.js`, `tools/check-site.js`.
- `README.md`, `docs/llms.md`, `docs/llms.txt`, `website/llms.txt`, `docs/api.json`, `CHANGELOG.md`.
- `package.json`, `package-lock.json`, `.github/workflows/{ci,pages,publish}.yml`.
- Explicit core permission: `src/core/overlay-host.js` (type annotation corrections only).
- `tests/unit/fixtures/export-parameters.json` for new WP73 helper signatures (public and internal) only;
  `tests/unit/api-reference.test.js` if corrected API assertions require it; new
  `tests/unit/package-contract.test.js`, `tests/unit/client-vendor.test.js`.
- WP75 may additionally scope shared build/check/browser tools; one owner per file at a time.

## Contract

- Refresh the already-vendored client from the local, read-only sibling client checkout using existing
  esbuild, not a new runtime dependency. Record source revision/version, source/content hash, build
  recipe/tool version and bundle checksum. Provide an explicit reproducible update command; ordinary
  site builds verify the checked-in manifest/hash without requiring the sibling checkout or network.
  Verify real bundled client schema/API against the integration's actual calls. Do not edit the client.
- Synchronize public component discovery and both llms.txt entry points. Include the supported Surface
  guide/catalog in the package allowlist. Internal specs/reviews/Pi material remain excluded.
- Declare source adapter registration and distribution entry side effects correctly; test a consumer
  bundle that uses side-effect imports to register field adapters under tree-shaking.
- Pin existing dev tools to their already-locked installed versions (esbuild 0.28.1, playwright-core
  1.62.1, typescript 7.0.2); chart.js remains 4.5.1. No additions, upgrades or install required.
  Update matching lockfile root ranges and require npm ci in workflows; fail mismatches.
- Add @ts-check to overlay-host and correct JSDoc so declaration/type build succeeds.
- Regenerate API and supported public docs. Commit completed fixes on this branch, build bundles and
  a fresh site after source changes, check public/package exclusions and provide local testing URL.

## Acceptance

npm test, bundle/type build, complete regressions and smoke checks, both-theme demos for changed UI,
client provenance/API verification, package tree-shaking and allowlist checks, fresh site audit.

## Validation results

- `npm test`: 1,841 passing tests, zero failures or skips; semantic-token lint covers 127 stylesheets.
- Bundle and declaration build: passing; API reference regenerated for 132 components.
- Browser regressions: 122 passing cases across light and dark themes.
- Smoke: 251 source and six distribution checks; documentation shell, all 21 layout gallery tiles,
  standalone routes and the German audit of 17,032 strings pass.
- Vendor recipe reproduces the committed bundle byte for byte; root and revisioned site assets are
  checksum-checked. Package dry run contains 516 files, supported Surface/locale/palette additions,
  and no private working material.
- WP75 desktop/mobile light/dark screenshots and accessibility audits pass. The site is rebuilt
  from the final branch revision for local testing; publication remains outside this package.

## Out of scope

Dependency upgrades/additions, system-wide settings, network client credentials, client-repository
changes, public deployment, pushing, version bumps or adding internal working material to public docs.
