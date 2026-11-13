# WP81 — Release 5.7.1

Branch: `wp/81-release-5-7-1`, from WP80. AGENTS.md applies.

## Requested result

Release WP80 as version 5.7.1: merge to `main`, push the verified commit and annotated tag, and
publish the GitHub Release, which starts npm publication. The user explicitly asked for the merge,
the push and this version number.

## File scope

- This specification.
- `CHANGELOG.md`: publish WP80's entries under 5.7.1, dated 2026-11-13, with a fresh Unreleased
  section.
- `package.json`, `package-lock.json`: version metadata only.
- `tools/size-budget.json`: raise the two minified library budgets (`zx.esm.min.js`,
  `zx.global.min.js`) from 355,000 to 360,000 bytes. WP80's dismissal, exact-number and Checklist
  code takes them from about 300 bytes under the old limit to about 600 over it; bundle inputs are
  unchanged local `src/` modules. All other budgets stay as they are.

## Release contract

Follow `docs/RELEASING.md`: unit and token checks, distribution and type builds, size check,
browser regressions and smoke checks, site build and audit, package dry run, and the full visual
comparison with v5.7.0, with every difference accounted for in the changelog.

## Validation

- 1,854 unit tests and the semantic-token lint pass; distribution and type builds succeed and
  every bundle is within its budget after the documented adjustment.
- 150 browser regressions pass in both themes, and the smoke suites pass, including all 21 layout
  previews and the German string sweep.
- The comparison with v5.7.0 covers 666 sections; 76 differ. They are the Buttons, Navigation and
  Icons sections of the theme page in each of its 24 variants and the mail and invoice-editor
  layouts, and each shows only the new pressed-button state or the added icons, both named in the
  changelog.
- The site audit passes for 503 public files; the npm dry run contains 516 files.

## Out of scope

New behavior, dependencies, instruction-file changes, and infrastructure or system settings.
