# WP64 — Locale and country pickers

Applications ask for a language and a country on almost every settings and address screen, and
each builds its own list. This WP adds both as Select subclasses, with names from
`Intl.DisplayNames` and flags without shipping flag artwork.

Work on the branch `wp/64-locale-country-pickers`, from `main`. `AGENTS.md` applies. `docs/api.json`
is regenerated. Public files must not mention this spec.

This WP **explicitly permits** changes to one core file: `src/core/messages.js` (four new keys).
No other file under `src/core/` changes.

## Scope

- `src/components/flag/flag.js`, `flag.css` — `flag(code, {kind, src, text, label})`, `flagEmoji()`,
  `supportsFlagEmoji()`, `normalizeRegion()`, `flagSource()`, `flagRenderer()`, `COUNTRY_CODES`.
- `src/components/locale-picker/locale-picker.js` — `LocalePicker extends Select`,
  `canonicalLocale()`.
- `src/components/country-picker/country-picker.js` — `CountryPicker extends Select`.
- `src/components/select/field-adapter.js` — `preset: 'locale' | 'country'` on `zxselect`.
- `src/index.js`, `styles/zx.css`, `src/core/messages.js`, `src/locales/de.js`.
- Demos `website/demos/locale-picker.demo.js`, `country-picker.demo.js`, registered in
  `website/docs.js`; `docs/llms.md`, `docs/llms.txt`, `website/llms.txt`, `README.md`;
  smoke cases in `tests/smoke/smoke.js`; `tools/size-budget.json`.

## Decisions (binding)

1. **A subset of Select.** Both pickers extend `Select` and keep its root class, keyboard map
   (APG combobox), events, and field type. They only build items and renderers; the root carries
   `data-preset="locale"` / `"country"`.
2. **Names from the platform.** `Intl.DisplayNames` names languages and regions in the display
   locale (`displayLocale`, then `lang`, then `getLanguage()`). A locale's label is its native name,
   its secondary text the localized name where it differs (`display: 'both'`).
3. **Values are canonical.** LocalePicker: `Intl.getCanonicalLocales()`, accepting `_`.
   CountryPicker: upper-case alpha-2. `set()` and the `value` option accept any spelling.
4. **No flag artwork ships.** `flags: 'auto'` draws the regional-indicator emoji where the platform
   renders flags (canvas colour test, run once per picker) and a code chip where it does not.
   `flagUrl` draws from an application-served flag set. A language without a region shows its
   language chip; `flagRegions` overrides a language's likely region.
5. **Picker size.** CountryPicker always filters locally; LocalePicker filters once it holds more
   than seven locales. Search covers name, secondary name / English name, and code.

## Keyboard

Select's, unchanged: ↓/↑ open and move, Enter selects, Escape closes, Home/End, typeahead on the
read-only variant.

## Out of scope

Shipping SVG flags, a `<zx-locale-picker>` custom element, multi-select, subdivisions (ISO 3166-2),
calling codes or currencies as built-in data.
