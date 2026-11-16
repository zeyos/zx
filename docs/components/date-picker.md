# DatePicker / MonthPicker / TimePicker

Three inline pickers — a calendar, a month grid, and a time control — each a roving grid with one tab stop.

Full reference: https://zx.zeyos.com/docs/llms.md · Live demo: https://zx.zeyos.com/docs.html#components/date-picker · All components: https://zx.zeyos.com/docs/components/index.md

Inline, embeddable pickers.

## DatePicker — APG date grid

- **Options** — `value: Date|null`, `min`, `max`, `weekStart: 1`, `showWeekNumbers: false`,
  `time: false`.
- **Methods** — `get()`, `set()`, `focus()`.
- **Events** — `change {date}`, `monthchange {year, month}`.
- **Keyboard** — arrows move a day, PageUp/PageDown a month, Shift+PageUp/PageDown a year,
  Home/End, Enter/Space select. Day cells carry an `aria-label`.

## MonthPicker

A 12-month grid. `get()`/`set()` work on the first of the month; event `change {date}`.

## TimePicker

Two spinbuttons (three with `seconds`), plus an optional clock face behind a toggle button: pick an
hour on the outer (1–12) or inner (13–23, 00) ring and the dial moves on to the minutes. Every mark
is a radio in an APG radio group; the spinbuttons stay the primary control.

- **Options** — `value: null`, `seconds: false`, `step: 5` (minute increment for the arrow keys),
  `clock: true`.
- **Methods** — `get()`, `set()`, `openClock(unit)`, `closeClock()`, `toggleClock()`.
- **Events** — `change {time}`.
