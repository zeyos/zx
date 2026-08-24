# WP17 — Component and documentation audit corrections

Branch: work on `main`. Read `AGENTS.md` and WP16 first. This package fixes evidence-backed
consistency defects found by the full Xenon component/demo/API audit; it does not add components.

## Scope

```
specs/WP-17-audit-corrections.md
tools/build-api.js
tests/unit/api-reference.test.js
tests/unit/type-bindings.test.js
website/demos/form.demo.js
src/components/date-picker/month-picker.js
website/theme-showcase.js
website/theme.js
AGENTS.md
src/components/button/button.css
src/components/select/select.css
src/components/field/field.js
src/components/field-upload/field-upload.js
src/components/form/form.js
src/components/multi-value-editor/multi-value-editor.js
src/components/value-list/value-list.js
src/components/sheet/sheet.js
styles/tokens/global.css
styles/tokens/semantic.css
styles/tokens/dark.css
styles/tokens/themes.css
website/theme-presets.js
website/demos/sheet.demo.js
website/docs.html
website/llms.txt
docs/llms.md
CHANGELOG.md
docs/api.json
```

## Required corrections

- API generation must split inline JSDoc tags, never overwrite a component with an unrelated helper
  typedef, and test both invariants. Dialog must retain Dialog options; descriptions must contain
  no raw `@returns`/`@fires` tags.
- The Form page must request generated APIs for Form, Fieldset, and Field.
- MonthPicker must bind and expose MonthPickerOptions rather than inheriting DatePicker's
  constructor type; extend the binding test to derived public components.
- Add missing `on*` option types and repair malformed event JSDoc for Field, FieldUpload, Form,
  MultiValueEditor, ValueList, and Sheet.
- Theme Studio rebuilds must own and destroy every component instance with persistent listeners,
  observers, or body nodes. Density/reset rebuilds must not accumulate instances.
- Make the documented demo group taxonomy match the categories the site intentionally uses and
  target `.zx-icon` rather than raw SVG in component CSS.
- Remove prior toolkit-specific branding from current Xenon source/docs/token rationale while preserving
  the existing token values and factual historical changelog behavior in neutral language.

## Non-goals

- New Launcher, AccountMenu, rail, chart, or notification implementations.
- Visual redesign beyond WP16, token-value changes, dependency changes, or generated bundle edits.
- Repairing defensive exceptions that have no reproduced failure (CopyButton ownership and the
  ContextMenu root/BEM exception remain documented findings).

## Acceptance

1. API tests prove Dialog has Dialog options, method descriptions contain no raw tags, and generated
   output equals the committed JSON.
2. Generated declarations give MonthPicker its own constructor options.
3. Generated API exposes every audited runtime event, and Form docs show all three public classes.
4. Theme Studio can rebuild twice with an equal number of owned/destroyed instances and no retained
   body overlays/listeners attributable to the previous canvas.
5. Current source/docs contain no case-insensitive whole-word reference to the retired toolkit.
6. Full unit, type, token, build, site, and browser suites remain green.
