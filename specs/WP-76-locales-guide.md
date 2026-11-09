# WP76 — Locales documentation

Branch: `wp/76-locales-guide`, from completed WP71 maintenance integration. AGENTS.md applies.

## Requested result

Explain that LocalePicker and CountryPicker are Select subclasses, and add a discoverable Locales
guide showing how an application selects languages, adds catalogues and regional variants, and
defines message keys, interpolation variables and plural forms.

## File scope

- This specification.
- `website/docs.html`: a `data-guide="locales"` template, using existing guide navigation/search.
- `docs/llms.md`: matching supported locale guidance and cross-links in picker/helper references.
- `README.md`, `docs/llms.txt`, `website/llms.txt`: discovery links and concise catalogue guidance.
- `website/demos/locale-picker.demo.js`: clarify that the picker names languages but does not
  supply application translations or change the active language by itself; prose only.

## Content contract

- Document the shipped English/German catalogues and frozen opt-in manifest accurately.
- Separate translation catalogues, active language tags, explicit formatting `locale`, picker
  `displayLocale`, and instance message overrides. Regional catalogue fallback belongs to the host.
- Show sparse application-owned catalogues, custom keys, positional/named interpolation and explicit
  plural counts. Preserve English fallback, intentionally empty translations, and flat-key lookup.
- Explain current refresh behavior: set language/translator before construction, and remount affected
  components when switching at runtime. Do not promise automatic relabeling or translate server data.
- Cover date-name overrides and separate format/currency/direction settings where supported.
- Describe adding supported tags to LocalePicker and the existing `zxselect` field preset; do not
  imply that a locale tag adds a bundled translation or a plain Select accepts `preset: 'locale'`.
- Public prose contains supported APIs and intentional examples only, with no internal review history.

## Validation and completion

Run existing unit/token checks; validate the examples against actual APIs. Build/check the website
and verify the guide's navigation, search, anchors, copyable code and light/dark desktop/mobile layout.
Commit on this WP branch and rebuild the served preview from the committed revision.

Validation completed: 1,841 unit tests and token lint pass; all nine documented code examples run
successfully in installed Chrome. The guide is discoverable in navigation and search, code copying
and section anchors work, and light/dark layouts pass at 1440 and 390 pixels without page overflow
or console errors. The generated site's reference and private-content audit passes.

## Out of scope

Runtime implementation or API changes, core edits, new shipped language catalogues, dependencies,
system settings, new documentation routing, public deployment and pushing.
