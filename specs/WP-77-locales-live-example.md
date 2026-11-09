# WP77 — Live language switching in the Locales guide

Branch: `wp/77-locales-live-example`, from WP76. AGENTS.md applies.

## Requested result

Add an interactive example to the Locales guide for English, German, and an application-owned
French catalogue. Let readers edit message variables and plural counts, preserve values across
language switches, and inspect the actual source and catalogues.

## File scope

- This specification.
- `website/docs.html`: the live example section in the existing Locales guide.
- `website/docs.js`: initialize the guide's embedded preview at the current source revision,
  synchronize its theme/size, expose its source with the existing code disclosure, and clean up.
- `website/docs.css`: the embedded example's frame only.
- `website/guides/locales.html`, `website/guides/locales.js`,
  `website/guides/locale-catalogues.js`, `website/guides/locales.css`: intentional public example.
- `docs/llms.md`: discovery link and supported behavior of the live example.
- `tests/regression/locales-guide.js`: behavioral browser coverage of the public example.

## Behavior

- Use LocalePicker through the Select field preset, `setTranslator`, `setLanguage`, `translate`, `translatePlural`
  and `formatNumber`. Show positional and named message variables and a real Select's translated
  placeholder/empty state. Changing language recreates the affected Select using public APIs.
- The language choices are `en-GB`, `de-DE`, and `fr-FR` (custom catalogue). English/German reuse
  shipped catalogues; the intentionally sparse French catalogue demonstrates English fallback for
  an untranslated built-in key. Example-owned message keys have English/German/French text in the
  example catalogue; they do not belong in the library's built-in catalogue.
- Name, record, and count remain editable. Include quick counts 0, 1, 2, and 1200; derive plural
  selection from the numeric count and format its displayed value separately. Render all values
  as text and handle an empty count without retaining stale output or implying it is zero.
- Run in an embedded document so module-global translation state remains local to the example.
  Keep surrounding guide/controls in English; mark translated output with the selected `lang`.
- Follow parent theme changes, fit mobile widths, retain keyboard access, label controls, and
  announce changing results politely. Leaving the guide removes the frame and all parent observers.
- Display source fetched from the same revision as the running example, using existing copy/tabs.

## Validation and completion

Run `npm test`, targeted browser regressions in both themes, and build/check the website. Verify
variables, counts, language switching, fallback, keyboard operation, theme synchronization,
navigation cleanup, source/copy controls, and light/dark layouts at desktop and phone widths.
Commit on this branch and rebuild the existing served preview from the committed revision.

Validation completed: all 1,841 unit tests and token lint pass. The new browser suite passes four
cases across light/dark themes, including variables/plurals, empty input, text safety, keyboard use,
state isolation, responsive sizing, theme changes, navigation/remounting, and source copying.
The built preview also passes interaction/source/revision/layout checks at 1440 and 390 pixels in
both themes; screenshots were inspected. Site audit passes for 505 public files, and the example's
CSS passes the semantic-token audit. No runtime implementation or dependencies changed.

## Out of scope

Runtime/core/API changes, new shipped language catalogues, dependencies, unrelated guides or
components, automatic global language-change broadcasting, system settings, public deployment/push.
