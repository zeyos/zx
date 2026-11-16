# Datebox / DateTimeBox

A text date field: it parses what the reader types against a strftime-style format, and keeps unparseable text on screen instead of silently discarding it.

Full reference: https://zx.zeyos.com/docs/llms.md · Live demo: https://zx.zeyos.com/docs.html#components/datebox · All components: https://zx.zeyos.com/docs/components/index.md

Text date input with a calendar popover. `DateTimeBox(target, opts)` is a Datebox with
`time: true`, which also brings the TimePicker (and its clock face) into the popover. Format
tokens are the date-utility ones: `%d %m %Y %H %M`.

- **Options** — `value: Date | number(unix) | string`, `format: '%d.%m.%Y'`, `displayFormat: null`,
  `time: false`, `min`, `max`, `placeholder`, `clearable: true` (the clear button shows while
  there is a value and the box is enabled; without `clearable` the input keeps no room for it),
  `disabled`.
- **Two formats** — `format` is what the reader types, and what the field shows while it has
  focus; it is parsed, so it takes numeric tokens only. `displayFormat` is what the field shows at
  rest, so a date field reads the way the rest of the screen writes dates (`'%e %b %Y'` → "2 Nov
  2026" beside a header that says "Created 19 Jul 2026"). It is never parsed, so month and weekday
  names (`%b %B %a %A`) are fine; `null` shows `format`. Focus switches the text to the typing
  format, a valid commit on blur or Enter switches it back, and text that failed to parse stays as
  typed. With `time`, a format without `%H`/`%M` gets ` %H:%M` appended, the display format too.
  The placeholder still describes `format`, and string values passed to `set()` are parsed with it.
  `dateboxFormats({format, displayFormat, time})` → `{format, display}` resolves both the same way.
- **In a Field** — field types `date`/`datetime` (and `daterange`) fill the control column like a
  text input and give way in a narrow two-column row; standalone, the box keeps its own width.
- **Methods** — `get(unit='date')` (`'seconds'` → unix), `set(value, {silent})` (accepts a Date;
  pass Date objects, not display strings), `open()`/`close()`, `enable()`/`disable()`, `focus()`.
- **Events** — `change {date}`, `invalid {text}`, `open`, `close`.
- **Quiet fields** — inside `[data-zx-fields="quiet"]` the date reads as text: no border, no fill,
  the calendar button hidden until hover; full chrome on focus. An invalid value keeps its danger
  border. DateRangeBox behaves the same way.
