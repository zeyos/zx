# WP71 — Confirmed review maintenance backlog

Status: implemented and validated in WP72–WP75 after WP65–WP70.
Branch: `wp/71-review-maintenance`, from completed WP65 integration.
`AGENTS.md` applies. WP72 covers M1–M7; WP73 M8/M9; WP74 M10–M14; WP75 M15/M16.

## Confirmed items and acceptance

| ID | Scope | Required result / regression |
| --- | --- | --- |
| M1 | `src/components/country-picker/country-picker.js`; its tests | Secondary `description` is searchable alongside names/codes. |
| M2 | `src/components/datebox/datebox.js`; its tests | Unchanged user blur does not emit a committed change; keep documented programmatic-set semantics. |
| M3 | `src/components/app-sidebar/app-sidebar.js`; its tests | Disabled branches reject ArrowRight activation consistently with clicks. |
| M4 | `src/core/storage.js`; `tests/unit/storage.test.js` | Define an unambiguous namespace encoding/migration policy; clearing `a` cannot clear `a:b`. Existing stored data must remain accessible or have an explicit migration. |
| M5 | `src/core/keyboard.js`; keyboard tests | Empty traps focus a suitable boundary, preserve its tabindex, and restore focus on deactivate. |
| M6 | `src/components/agent-thread/agent-thread.js`; regression tests | Rebinding a scroll host removes the old listener; destroy cleans the current one. |
| M7 | `src/components/agent-thread/ag-ui.js`; its tests | Durations never mix source and local clocks; partially timestamped/replayed events have a defined policy. |
| M8 | `src/core/i18n.js`, `messages.js`, `date.js`; `src/internal/date-locale.js`; number-field and ZeyOS formatters; locales; language tooling/tests | Specify plural-key and formatting-locale precedence before changes, use Intl.PluralRules, fix ambiguous short month fallback; preserve English fallback and German key/placeholder parity. Generalize checks per locale, optionally expose an English re-export/manifest. No new language translations in this WP. |
| M9 | `src/zeyos/{form,select,launcher,module-bar,calendar}.js`; messages/de and tests | Replace English UI literals with supported translated messages. |
| M10 | `website/vendor/zeyos-client.esm.js`; site build/check tools | Use a reproducible source/version/hash for the client bundle; verify its actual API without adding a dependency silently. |
| M11 | `README.md`, `docs/llms.md`, `docs/llms.txt`, `website/llms.txt`, `package.json`; docs/package tests | Synchronize component discovery and ship or link the public Surface guide; preserve private-file exclusions. |
| M12 | `package.json`; package/build tests | Declare adapter registration side effects accurately; bundled side-effect imports initialize adapters. |
| M13 | `package.json`, lockfile, `.github/workflows/{ci,pages,publish}.yml` | Pin build tooling and fail lockfile mismatches rather than falling back to install. Dependency changes require owner approval. |
| M14 | `src/core/overlay-host.js`; type checks | Add @ts-check after resolving its type diagnostics. |
| M15 | `tests/lint-tokens.js`, logical-property tests, browser launch checks; smoke runner | Scan quoted SVG colours appropriately and shared/layout logical properties; distinguish missing browser from launch errors; explicitly configure any alternate browser. Add behavior coverage for discovered failures, not source-text-only assertions. |
| M16 | Filter/Select CSS and other specifically identified component CSS; styles/core.css and module palette | Replace modifier state/fixed control geometry with supported attributes/tokens; audit overrides before removal. Separate product palette from generic core with a compatible optional import. |

WP72–WP75 name the exact touched files and compatibility choices, including explicit core permission.
WP74 records final integration validation. The excluded architecture decisions below remain separate.

## Excluded claims and separate decisions

No defect work for deliberate invalid breakpoint rejection, documented deepMerge replacement,
supported scoped approval shortcuts/registries, or already-protected Surface form access.
The public Font Awesome kit URL is deployment configuration; any move to caller configuration
belongs to a separately scoped product-binding change. Client-owned semantics/module identity
and compatibility-code maintenance are architecture decisions, not confirmed P1/P2 defects.
Do not publish review transcripts, test prompts, or internal reasoning in documentation.
