# WP75 — CSS invariants and reliable browser checks

Branch: `wp/71-review-maintenance`. Implements WP71 M15/M16. AGENTS.md applies.
Status: complete, 2026-11-09. Eight CSS browser cases and 58 scoped unit/browser checks pass;
16 desktop/mobile light/dark screenshots and 16 accessibility audit checks pass. Hover ink,
responsive geometry, optional module colours and missing-browser/error handling are verified.

## Scope

- `tests/lint-tokens.js`, `tests/unit/logical-properties.test.js`, new `tests/unit/css-audit.test.js`.
- New `tools/browser.js`, `tests/unit/browser-launch.test.js`;
  `tools/{run-smoke,run-regressions,shoot-layout,audit-layout}.js` and
  `tests/unit/{colour-overrides,geometry-tokens}.test.js`: browser configuration/failure handling only.
- `src/components/filter/{filter.js,filter.css}`, `src/components/select/select.css`.
- `styles/core.css`, new `styles/zeyos.css`, `styles/tokens/semantic.css` (semantic disabled-opacity
  token if required), `website/site.css` (explicit optional ZeyOS palette import).
- `tests/unit/zeyos-modules.test.js`, new `tests/regression/css-maintenance.js`.
- `tests/unit/css-subset.test.js`: core import order and optional palette invariants only.
- `website/layouts/{crm.layout,invoice-editor.layout,kit,mail.layout,overview}.css`: the six
  identified asymmetric padding/margin shorthands only; preserve LTR geometry and mirror logical edges.
- Public docs/package changes by integration owner. No core JS changes.

## Contract

1. Inspect SVG paint values inside quoted data:image/svg+xml URLs, including URL/base64 encoding,
   for raw colors without treating attribute selectors, ordinary content strings or SVG ids as colors.
   Keep allowed semantic palette definitions in token files. Test scanner behavior with negative and
   legitimate controls; do not add broad allowlists to make a failing check pass.
2. Extend logical-property scanning to shared styles and website/layouts; preserve exact, explained
   allowances for genuinely physical geometry. Report full relative file names. Existing styles should
   pass without behavior changes; seek a scoped amendment for any actual off-list defect.
3. Centralize installed-browser launch options: Chrome default; explicit ZX_BROWSER_CHANNEL or
   ZX_BROWSER_EXECUTABLE_PATH override, mutually exclusive. Missing installed browser may skip the
   optional unit checks; crash/permission/dependency errors fail visibly. Explicit browser suites fail
   when no browser is available. Never download browsers, silently substitute, or change host settings.
4. Express Filter empty-value state with an attribute. Derive its fixed 28px control row from semantic
   control height. Remove Select !important declarations only with sufficient scoped selectors and
   computed-style verification of editable/read-only/disabled/adorned input/button states. Derive spinner
   geometry from semantic size; use semantic disabled opacity; remove unnecessary z-index:20 for the
   top-layer panel only after verifying behavior.
5. Generic core.css excludes the ZeyOS module palette. Add optional styles/zeyos.css importing the
   unchanged module token sheet; public site explicitly imports it. No product palette identities change.
   Existing source wildcard export makes the optional sheet available; root documents the opt-in.

## Acceptance

Behavioral scanner fixtures; browser launch errors distinguished; computed styles at multiple control
heights in both themes, LTR/RTL Filter and Select interaction; generic core excludes product palette and
explicit opt-in restores it. All unit/lint/regression/build/smoke checks pass.

## Out of scope

Broad visual redesign, token deletion without users audit, module identity data changes, other component
CSS, browser installation, arbitrary alternate-browser auto-detection, new dependencies or publication.
