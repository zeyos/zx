# WP78 — Locale/country Select presets and dependency audit

Branch: `wp/78-select-locale-country`, from WP77. AGENTS.md applies.

## Requested result

Expose locale and country selection as `Select.locale(target, options)` and
`Select.country(target, options)`, replacing the dedicated LocalePicker/CountryPicker components.
Check component dependencies and describe the actual requirements of optional rendering engines
and integrations, especially charts.

## File scope

- This specification.
- `src/components/select/select.js`, `src/components/select/field-adapter.js`.
- New `src/components/select/locale.js`, `src/components/select/country.js`: option/item builders
  moved from the two former components, without a runtime import of Select or dedicated classes.
- Delete `src/components/locale-picker/locale-picker.js` and
  `src/components/country-picker/country-picker.js`.
- `src/index.js`: remove class exports; retain canonicalLocale at its relocated helper path.
- `src/components/flag/flag.js`: update the country-preset reference in its comment only.
- `tests/unit/select-locales.test.js`, `tests/regression/select-presets.js`: new pure/data and
  behavioral coverage. `tests/regression/forms.js`, `tests/regression/maintenance.js`,
  `tests/smoke/smoke.js`: migrate existing picker checks without dropping their coverage.
- `tests/unit/css-subset.test.js`: include the local flag stylesheet now used by Select presets.
- `tools/check-language.js`, `tests/unit/language-audit.test.js`: distinguish the moved presets'
  Intl-generated item names from library messages, while explicitly checking translated preset
  labels/placeholders and retaining checks for untranslated control messages.
- `website/demos/select.demo.js`: integrate the two sets of examples as Select presets. Delete
  `website/demos/locale-picker.demo.js` and `website/demos/country-picker.demo.js`.
- `website/docs.js`: remove separate component registrations and redirect former picker hashes
  to the corresponding Select preset examples.
- `website/docs.html`, `docs/llms.md`, `docs/llms.txt`, `website/llms.txt`, `README.md`: update
  the public API, guide examples, discovery, and precise optional-dependency requirements.
- `docs/api.json`: regenerate from the final implementation.

## Contract

- Both factories return ordinary Select instances, with the same constructor/prototype as
  `new Select()`. Remove the old classes and their exports; do not retain wrapper subclasses or
  compatibility aliases. Existing `Field` props presets `locale` and `country` use the factories.
- Preserve locale/country items, defaults, native/localized names, pinned choices, flags, search,
  custom descriptions, events, clearability, initial values and later `set()` normalization.
  Locale tags still canonicalize underscores/case; country codes still normalize to uppercase.
  Keep `data-preset` and the `.zx-select` styling, keyboard map, and target restoration contract.
- Preserve pure item-generation access as `Select.localeItems()` and `Select.countryItems()`.
  Keep `canonicalLocale()` exported. Use JSDoc types for both preset options.
- Generic Select behavior must stay unchanged. Normalization is per preset instance, and accepts
  item objects/null without mutating caller options or item arrays.
- Keep existing localePicker/countryPicker message keys stable for caller overrides. No core
  catalogue/key changes are needed for this API reorganization.
- Move all existing picker examples under Select, with explicit preset IDs `locale` and `country`
  for the main examples. Update live guide prose/snippets; its existing field-preset example must
  continue working. Public documentation describes supported APIs, not internal review history.
- Dependency audit is read-only for runtime behavior. Document that Chart needs an injected
  renderer (the supplied ChartJsAdapter needs Chart.js); optional Font Awesome and ZeyOS icons
  need host-provided assets; distinguish website/vendor dependencies from library imports.

## Validation and completion

Run unit/token tests, declaration emit, affected browser regressions (including live Locales),
source/bundle smoke checks, and website build/audit. Verify new Select preset demos in light/dark
themes at desktop and phone widths, old documentation link routing, and same-target teardown.
Commit the changes on this branch and rebuild the existing preview from the final revision.

Validation completed: 1,852 unit tests and token lint pass; 48 affected preset/forms/maintenance
browser cases plus four live-Locales cases pass across both themes. The complete smoke run passes
251 source checks, six bundle checks, the documentation shell, all 21 layout previews and standalone
layouts, and the German sweep of 17,643 strings. Declaration emit and a typed consumer of all four
new static methods pass. Built-site preset interactions, source tabs, old-route redirects and
light/dark screenshots pass at 1440 and 390 pixels. Site audit passes for 503 public files.

## Dependency audit result

No external runtime package imports were found under `src/`; package dependency, optional-dependency
and peer-dependency maps are empty. Chart drawing requires an injected adapter: the supplied
ChartJsAdapter requires Chart.js 4, and no adapter currently leaves a ready but blank canvas with
the semantic summary retained. Core icons default to bundled SVG; Font Awesome modes and default
ZeyOS module glyphs need the host's CSS/kit assets. ZeyOS data operations need an injected compatible
client. CodeEditor, block text/highlighting, agent protocols, flags, and other component code are local.

The documentation site supplies pinned Chart.js 4.5.1 from its self-hosted vendor copy and vendors
@zeyos/client 1.1.0 for its invoice example. These website requirements are separate from library
package imports. The existing Chart.js devDependency is absent from AGENTS.md's tool-only allowlist;
this contract discrepancy remains recorded without changing instructions or dependency manifests.

## Out of scope

Core edits, Chart rendering/fallback behavior changes, new dependencies, package/version changes,
unrelated component behavior, instruction-file changes, external publication/push, or system settings.
