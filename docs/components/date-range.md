# DateRangePicker / DateRangeBox

Two calendars driven as one roving-focus grid: the first click opens a range, hovering or arrowing previews where it would end, and the second click closes it.

Full reference: https://zx.zeyos.com/docs/llms.md · Live demo: https://zx.zeyos.com/docs.html#components/date-range · All components: https://zx.zeyos.com/docs/components/index.md

An inline two-month calendar for picking a start and an end day, plus the form-usable text input that wraps it. The first click opens a range and the second closes it; while an end is pending, hovering and arrow-key focus preview where the range would land, and clicking on or before the pending start restarts it there instead of producing an inverted range. Both grids behave as one roving-focus unit, so arrowing right off 31 August continues on 1 September. Range maths is exported separately as `normalizeRange`, `rangeNights`, `rangeStateOf`, and `clampRange`, so the rules can be reused and tested without a DOM.

## DateRangePicker

- **Options** — `start: null`, `end: null` (Dates), `min: null`, `max: null`, `months: 2` (a container query drops to one month in narrow hosts), `weekStart: 1`, `showWeekNumbers: false`, `minNights: 0`, `maxNights: null`, `presets: []` (an array of `{name, label, range: () => ({start, end})}`, or `true` for the built-in Today, Yesterday, Last 7 days, Last 30 days, This month, Last month, This quarter, This year), `disabled: false`.
- **Methods** — `get()` → `{start, end}` copies, `set({start, end}, {silent})` (clamped to the bounds, scrolls the first month to the start), `clear({silent})`, `focus()`, `enable()`, `disable()`, `destroy()`.
- **Events** — `change {start, end}` once a range is complete and on clear, `select {start, end}` on every click including the half-open state where `end` is still null, `monthchange {year, month}` when the first visible month moves.
- **Keyboard** — arrows move a day, PageUp/PageDown a month, Shift+PageUp/PageDown a year, Home/End the ends of the week, Enter or Space selects, Escape abandons a half-picked range and restores the last complete one. Days outside `min`/`max` — and, once a start is pending, days that would break `minNights`/`maxNights` — stay keyboard-focusable but carry `aria-disabled="true"`. Committed days carry `data-range="start" | "middle" | "end"` and previewed days `data-range="preview"`; the picker is a `role="group"` holding one `role="grid"` per month, and the selection is announced through a visually hidden `aria-live="polite"` region ("1 – 14 August 2026, 13 nights").
- **Exported helpers** — `normalizeRange(start, end)` orders a pair at local midnight (invalid values become null), `rangeNights(start, end)` counts nights from calendar days so DST never shifts the total, `rangeStateOf(day, start, end)` → `'start' | 'middle' | 'end' | null`, `clampRange(range, {min, max, minNights, maxNights})` pulls a range inside its bounds.

## DateRangeBox

- **Options** — everything DateRangePicker takes, plus `format: '%d.%m.%Y'`, `displayFormat: null`, `separator: ' – '`, `placeholder: null` (derived from the format when null), `clearable: true` (no clear button while disabled, and no room kept for one without it). Typed text is parsed as `"<start><separator><end>"`; a lone date reads as a one-day range and a trailing separator keeps the range half open. `displayFormat` is the endpoints' format at rest, as on Datebox (`'%e %b %Y'` → "3 Aug 2026 – 9 Aug 2026"); focus switches to `format`, and text left untouched while the calendar holds focus goes back to the display format.
- **Methods** — `get(unit = 'date')` (`'seconds'` returns `{start, end}` as Unix seconds), `set(range, {silent})` accepting `{start, end}` of Dates, Unix-seconds numbers, or formatted strings, `clear({silent})`, `open()`, `close()`, `enable()`, `disable()`, `focus()`, `destroy()`.
- **Events** — `change {start, end}`, `invalid {text}` when the typed value cannot be parsed (the text stays editable and the field takes `data-state="invalid"` plus `aria-invalid`), `open`, `close`.
