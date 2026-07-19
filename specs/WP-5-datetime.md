# WP5 — Date & time: DatePicker, MonthPicker, TimePicker, Datebox, Timebox, DateTimeBox

Branch: `wp5-datetime` from `main` (kernel merged; WP3 Dropdown preferred if on main, else
position() directly). Read `AGENTS.md`. Legacy reference:
`../gx-zeyos/src/classes/{DatePicker,MonthPicker,TimePicker,Datebox,Timebox}.js`,
`../gx-core/src/classes/Timebox.js`. Use kernel `date.js` for ALL formatting/parsing —
extend it there only if a token is missing (kernel edit allowed for date.js only).

## Scope

```
src/components/date-picker/date-picker.js|css     # calendar surface (also used inline)
src/components/date-picker/month-picker.js        # variant classes in same dir
src/components/date-picker/time-picker.js|css
src/components/datebox/datebox.js|css             # input + popover picker
src/components/timebox/timebox.js|css             # duration/segments input
demos/components/{date-picker,datebox,timebox}.demo.js
tests/unit/datebox-parse.test.js
src/index.js styles/zx.css
```

## date-picker.js — `class DatePicker` (cssName `date-picker`) — APG date-picker grid

An inline calendar component (embeddable), not the input.
`defaults: { value:null (Date), min:null, max:null, weekStart:1, showWeekNumbers:false,
time:false /* append TimePicker below */ }`.
Methods: `get() -> Date|null`, `set(date, {silent})`, `focus()`. Events: `change {date}`,
`monthchange {year, month}`.
Markup/ARIA: header (prev/next month buttons, month+year button opening a year/month quick-pick
panel), `table role="grid"` of days, `aria-selected` on chosen day, other-month days dimmed,
today outlined. Keyboard (APG): Arrows move day, PageUp/PageDown month, Shift+PageUp/PageDown
year, Home/End week bounds, Enter/Space select. Roving tabindex on day cells.
Localized month/weekday names via kernel date.js/i18n.

`class MonthPicker extends DatePicker` — grid of 12 months (+ year stepper); `get/set` use
first-of-month; event `change {date}`.
`class TimePicker` (cssName `time-picker`) — hour/minute (optional second) spin columns
(`role="spinbutton"` each, Up/Down arrows, typing 2 digits advances), `defaults: { value:null,
seconds:false, step:5 }`, `get()/set()` with `{h,m,s}` or Date, event `change`.

## datebox.js — `class Datebox` (cssName `datebox`)

Text input + calendar button opening DatePicker in an anchored popover. Successor of legacy
Datebox AND the Picker.Date-based DatePicker usage.
`defaults: { value:null (Date|unix seconds|string), format:'%d.%m.%Y', time:false
(appends ' %H:%M' handling), min, max, placeholder:auto-from-format, clearable:true,
disabled:false }`.
- Typing: parse on blur/Enter via `parseDate`; invalid input → `data-state="invalid"` +
  `aria-invalid`, keeps text for correction; valid → normalize display via `formatDate`.
- Methods: `get(unit='date') -> Date|null` (`'seconds'` → unix, ← legacy get('seconds')),
  `set(value, {silent})`, `open()/close()`, `enable()/disable()`, `focus()`.
- Events: `change {date}`, `invalid {text}`, `open`, `close`.
- Keyboard: ArrowDown or the button opens picker (focus moves into grid); Esc returns to input.
- `DateTimeBox` = `Datebox` with `time:true` — no separate class, but export alias
  `const DateTimeBox = ...` factory for API clarity.

## timebox.js — `class Timebox` (cssName `timebox`)

Duration input (H:MM or H:MM:SS), successor of gx.ui/zeyos Timebox incl. negative prefix.
`defaults: { value:0, unit:'minutes'|'seconds'|'hours', seconds:false, signed:false, disabled:false }`.
Segmented inputs (hours unlimited, mm/ss 0-59 with zero-pad), optional +/- toggle button when
`signed`. Methods: `get(unit=options.unit) -> number`, `set(value, unit?, {silent})`,
`enable()/disable()`. Event: `change {value}` (in `options.unit`).
Parsing helpers pure & unit-tested (`splitTime`/`joinTime` in the component file but exported).

## Demos

- date-picker: inline calendar with min/max, month-picker, time-picker, week numbers, event log.
- datebox: default `%d.%m.%Y`, datetime variant, US format `%m/%d/%Y`, invalid-input behavior
  demo, clearable, unix-seconds get/set buttons (legacy interop check).
- timebox: minutes-unit and seconds-unit variants, signed variant, live value readout.

## Acceptance criteria

1. `npm test` green: datebox parse/format round-trips (valid + invalid + normalization cases),
   timebox split/join incl. negative and >24h hours.
2. APG grid keyboard map fully working (arrows/PageUp/PageDown/Shift+PageUp/Home/End/Enter);
   focus visibly moves in the grid; screen-reader labels on day cells
   (`aria-label="17 July 2026"`-style).
3. Datebox popover anchors + flips near viewport bottom; Esc → focus back in input.
4. min/max: out-of-range days disabled (`aria-disabled`, not focus-skipped per APG).
5. Light/dark × density clean; today/selected states distinguishable in both themes.
6. Double create/destroy clean incl. open-popover destroy.
7. Committed on `wp5-datetime`.

## Out of scope

Field adapters (WP7b); native input[type=date] fallback (documented README note only); compat.
