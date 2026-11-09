# WP73 — Plurals, formatting locale and translated binding defaults

Branch: `wp/71-review-maintenance`. Implements WP71 M8/M9. AGENTS.md applies.
Status: complete, 2026-11-09. All 12 localization browser cases pass across both themes, including
English fallback under Russian plural rules; catalogue, locale-service, number-input and binding
regressions, type checks and English/German audits pass. Full integration results are in WP74.

## Scope

- Explicit core permission: `src/core/{i18n,component,messages,date,format}.js`.
- `src/internal/date-locale.js`, `src/index.js`, `src/locales/{de,en,index}.js`.
- `src/components/{number-field,rating,list-toolbar,kanban-view,run-status,code-editor,questionnaire}/`
  matching component `.js` only; questionnaire `conditions.js` if needed for explicit count plumbing.
- `src/zeyos/{schema,table,form,select,launcher,module-bar,calendar}.js`.
- `tools/check-language.js`.
- Existing corresponding unit tests for i18n/messages/locale-de/date/date-locale/format/number-field,
  list-toolbar/kanban-view/run-status/code-editor/questionnaire and ZeyOS bindings; new
  `tests/unit/locales.test.js`, `tests/regression/i18n.js`.
- Public docs/package/API/arity fixtures coordinated by integration owner (WP74).

## Contract

- Add `translatePlural(key, count, args?, {locale?} = {})` and `Component.msgPlural(key, count, ...args)`.
  Count is numeric and separate from interpolation, never inferred from formatted strings.
  Existing translate/msg signatures and behavior stay compatible.
- Add flat `.one/.other` plural variants (support all Intl cardinal categories). Preserve source tiers:
  instance, host, inherited, English; each tier tries selected category, other, unsuffixed/legacy alias.
  The English fallback selects with English rules, independent of requested language.
- Migrate confirmed plural UI: rating count, list-toolbar results, Kanban counts/drag preview,
  run-status steps, code-editor selected lines, questionnaire minimum-length validation.
  Preserve custom labels and old unsuffixed overrides. Use explicit count at each call site.
- Valid explicit formatting locale wins, then active language including regional English, then en.
  Determine support with the consuming Intl service: number, date, relative-time and plural-rule
  support sets may differ. Built-in English plural text must reach English-rule fallback.
  Explicit formatDate locale bypasses host date-name translation. Without explicit locale, honor
  host short names; absent short names come from Intl, never slicing translated long names.
  NumberField parsing separators and formatting share the same effective locale, including changes.
- Add English catalogue re-export and an opt-in locale manifest; no extra language in the main bundle.
  Generalize key/placeholder/catalogue checks; retain German-only language-style rules where appropriate.
  Parameterize browser language auditing, German remaining default. No French/Italian/Spanish translations.
- Replace identified binding interface literals with translated messages; preserve caller labels,
  identifiers, server data and module identities. New English/German keys land together.
- Include `agUi.thoughtComplete`: English `Thought complete`, German `Nachdenken abgeschlossen` for WP72.

## Acceptance

Synthetic Arabic/Russian/French plural rules, count/interpolation separation, custom tier overrides and
English fallback; explicit locale date names, ambiguous short month names, regional English, current
NumberField separators; localized binding defaults; catalogue parity. Browser counts/controls in both
themes. Full integration build/types/tests and German audit. No dependencies.

## Out of scope

New translated catalogues, client schema migration, locale inference from user location, changing the
existing translator signature or message argument meanings, or other core files.
