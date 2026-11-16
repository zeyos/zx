# Field widget types

The field types backed by a whole Zx component rather than a native input — what turns a Form into a real record editor.

Full reference: https://zx.zeyos.com/docs/llms.md · Live demo: https://zx.zeyos.com/docs.html#components/form-widgets · All components: https://zx.zeyos.com/docs/components/index.md

Beyond the built-in field types, these widget types wrap whole components, used as
`{ type, label, props: {…component options…} }`. They are registered by
`registerFieldAdapters()`, which `src/index.js` calls by default.

- `zxselect` (Select), `checklist` (Checklist), `tagpicker` (TagPicker), `number` (NumberField),
  `rating` (Rating), `slider` (Slider).
- `date`/`month`/`datetime` (Datebox/MonthPicker — pass a `Date` value), `daterange`
  (DateRangeBox — a `{start, end}` value), `time` (Timebox).
- `valuelist` (ValueList), `multivalueeditor` (MultiValueEditor), `upload` (FieldUpload),
  `toggle` (Toggle), `code` (CodeEditor).

**Stylesheet names for `zx-css`.** A field type is registered at run time, so `zx-css` cannot
follow it from `form` to the component that draws it: name that component's stylesheet beside
`form`. Each line is field type — component — the name to pass, and the stylesheets that name
depends on come with it.

- `zxselect` — Select — `select`
- `checklist` — Checklist — `checklist`
- `tagpicker` — TagPicker — `tag-picker`
- `number` — NumberField — `number-field`
- `rating` — Rating — `rating`
- `slider` — Slider — `slider`
- `date` — Datebox — `datebox`
- `datetime` — DateTimeBox — `datebox`
- `month` — MonthPicker — `date-picker`
- `daterange` — DateRangeBox — `date-range-box`
- `time` — Timebox — `timebox`
- `valuelist` — ValueList — `value-list`
- `multivalueeditor` — MultiValueEditor — `multi-value-editor`
- `upload` — FieldUpload — `field-upload`
- `toggle` — Toggle — `toggle`
- `code` — CodeEditor — `code-editor`

The built-in types — `text`, `password`, `textarea`, `checkbox`, `int`, `float`, `select`,
`optionlist`, `hidden`, `html`, `custom` — are drawn by Field itself and need `form` alone. A form
with a Select and a date field is `npx zx-css form select datebox --out public/zx.css`.
