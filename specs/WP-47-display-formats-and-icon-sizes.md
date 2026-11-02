# WP47 — Display formats and named icon sizes

Two craft gaps were left out of WP45 as follow-ups. Both are the same kind of defect: a value that
should be one decision per screen is instead chosen again at every call site, so neighbouring
elements disagree. A record page shows its close date as "02.11.2026" in the inspector, as "2 Nov
2026" in the stat tile above it, and as "Created 19 Jul 2026" in its header. Chevrons render at
five sizes from 11 to 16px, the dismiss × at seven sizes from 7 to 15px, and checks at five sizes
from 8 to 15px, and three components still draw a text character where every other component draws
an icon. This WP gives the date field a display format and the icon layer named sizes per role.

Work in the current checkout, on top of WP45. **Do not commit**: this lands after central review.
`AGENTS.md` and the WP40 design rules (small corners, quiet chrome, one solid accent) apply, as does
WP42 (every touched layout from 390px to 1440, clean under `tools/audit-layout.js`). This WP
explicitly permits changes to **`src/core/icons.js`** (§1: the size table, the default size that
reads it, and two glyphs). Nothing else under `src/core/**` changes. `CHANGELOG.md` is
central: report changelog lines instead of writing them; `npm run build:api` regenerates
`docs/api.json`. Public files (source
comments, demos, docs) must not mention this spec or any other internal material;
`tools/check-site.js` enforces it.

## Review: what the code does today

**Dates.** `Datebox` has one format, `format` (default `'%d.%m.%Y'`), which is both the format the
reader types and the format the field shows. `parseDate()` reads numeric tokens only (`%d %e %m %Y
%y %H %M %S %s`), so a format with month names (`%b`, `%B`) cannot be typed and therefore cannot be
shown either. The layouts write every other date with the kit's `DATE.year` (`'%e %b %Y'`), so a
date field is the one place on a record screen that reads differently. `DateTimeBox` is a factory
over `Datebox` with `time: true`. `DateRangeBox` has its own copy of the same logic, a `format` per
endpoint and a `separator`. `<zx-datebox>` reflects `format` as an attribute.

**Icons.** `icon(name, {size})` defaults to 16. Each component picks its own size per call:

| Role | Sizes in use | Call sites |
|---|---|---|
| Chevron | 16, 15, 14, 13, 12, 11 | `select.js:171`, `tag-picker.js:139`, `card-view.js:489`, `multi-value-editor.js:156,163`, `table.js:1441,1446,1958`, `record-view.js:787,794`, `tree.js:442`, `finder.js:279`, `breadcrumb.js:299`, `dock.js:447`, `groupbox.js:72`, `panel.js:86`, `kanban-view.js:1024,1077`, `pagination.js:339`, `app-sidebar.js:518,530,1165`, `launcher.js:795`, `account-menu.js:92`, `workspace-switcher.js:127`, `date-picker.js:60,73,86,93`, `month-picker.js:51,58`, `date-range-picker.js:620,627` |
| Dismiss × | 16, 15, 14, 13, 12, 11, 7 | `select.js:157`, `search.js:57`, `datebox.js:85`, `date-range-box.js:163`, `tabbox.js:187`, `message.js:425`, `multi-value-editor.js:169`, `tag-picker.js:441`, `launcher.js:219,227`, `glyphs.js:127` |
| Check | 16, 15, 13, 12, 8 | `select.js:769`, `tag-picker.js:466` (and the `plus` in the same slot, `:484`), `check-button.js:50,51`, `stepper.js:390,391`, `workspace-switcher.js:272`, `glyphs.js:126` |

Text characters stand in for icons in three places: Dialog's close button (`dialog.js:142`, a "×"
at `--zx-text-xl`), Table's sort direction (`table.css` `::after` with "↑" and "↓"), and ValueList's
chip remove (`value-list.js:209`, "×").

At 14px and below the bundled pen already draws one pixel (`MIN_STROKE_PX`), so the drift is in
glyph size, not weight: a 16px chevron beside a 14px leading icon in the same Select trigger, an
11px × in one chip and a 13px × in the next field.

## Decisions

- **`displayFormat` is what the field shows at rest; `format` stays what the reader types.** While
  the input has focus it holds the value in `format`, so typing, Enter, and blur parse exactly as
  today. When it loses focus after a valid commit, or whenever the value changes while it is not
  focused, it shows the value in `displayFormat`. `displayFormat: null` (the default) means
  "same as `format`": existing fields behave exactly as before. The display format may use any
  `formatDate()` token, month and weekday names included, because it is never parsed.
- **Invalid text is never replaced.** A field holding text that failed to parse keeps it, with
  `data-state="invalid"`, through blur and focus, as today. Only a valid value is reformatted.
- **Time follows the value.** With `time: true`, a display format without `%H`/`%M` gets ` %H:%M`
  appended, the rule `format` already follows. A field that wants the time hidden at rest uses a
  date-only Datebox.
- **The placeholder still describes the typing format**, because the placeholder is only visible
  when the field is empty, and an empty field is where the reader types.
- **Named sizes are roles, not a scale.** `ICON_SIZE` names where an icon sits, so a call site
  says what the glyph is for and the size follows. Several roles share a value today (chevron,
  dismiss, check, and sort are all 14); naming them separately lets one change later without a
  sweep. `icon()`'s default size reads `ICON_SIZE.control`, so it stays 16.

  | Role | Size | Use |
  |---|---|---|
  | `control` | 16 | The default: an icon that is a control's content or leads its label. |
  | `chevron` | 14 | Dropdown, disclosure, and reorder chevrons, calendar and pager arrows, breadcrumb separators. |
  | `dismiss` | 14 | Clear, close, and remove ×. |
  | `check` | 14 | The selection check in an option, a toggle button, and a completed step (and whatever shares that slot). |
  | `sort` | 14 | The sort-direction arrow beside a column heading. |
  | `chip` | 12 | Any glyph inside a chip or token, its remove × included. |
  | `marker` | 8 | A glyph drawn inside a small status marker. |

- **Text glyphs become icons**, sized by role: Dialog's close is `icon('x', {size:
  ICON_SIZE.dismiss})`, ValueList's remove is `icon('x', {size: ICON_SIZE.chip})`, and Table's
  sort direction is a real element in the sort button holding `icon('arrow-up', {size:
  ICON_SIZE.sort})`, shown only on the sorted column and turned for descending. The bundled set
  gains Lucide's `arrow-up` and `arrow-down` (Font Awesome has both under the same names).

## §1 · Icon layer

**Scope:** `src/core/icons.js`, `src/index.js` (export), `tests/unit/icons.test.js`,
`website/demos/icons.demo.js` (a sizes row), `website/layouts/layout-icons.js` (drops its own
`arrow-up` and `arrow-down`, identical and now bundled), `docs/llms.md` (Icons section).

- `export const ICON_SIZE = Object.freeze({ control: 16, chevron: 14, dismiss: 14, check: 14, sort:
  14, chip: 12, marker: 8 })`, with JSDoc on each role.
- The default `size` in `iconSvg()` and `faIcon()` reads `ICON_SIZE.control`. The `IconOptions`
  typedef says so.
- Glyphs `arrow-up` (`M5 12l7-7 7 7M12 19V5`) and `arrow-down` (`M12 5v14M19 12l-7 7-7-7`), Lucide
  1.53.0, in the bundled table.
- Tests: the table is frozen, every role is a positive integer, `control` equals the default
  rendered size, the indicator roles fit inside `control` and `marker` inside `chip`, and
  `icon(name, {size: ICON_SIZE.<role>})` renders that width with at least a one-pixel stroke.

## §2 · Components use the named sizes

**Scope:** the JS of every call site in the table above, plus `dialog.{js,css}`,
`value-list.{js,css}`, and `table.{js,css}` for the text glyphs. CSS only where a text glyph's
styling goes away or the new icon needs a box.

- Each listed call imports `ICON_SIZE` and passes the role's size. No numeric icon size remains on
  a chevron, dismiss, or check call in `src/components/**`.
- Dialog: the close button holds the icon; the `font-size: var(--zx-text-xl)` that sized the
  character goes.
- ValueList: the remove span holds the icon.
- Table: each sortable header's button gets `<span class="zx-table__sort-icon" aria-hidden="true">`
  after the label, holding the arrow. CSS hides it unless the header carries `aria-sort`, and
  turns it half a turn for `descending`, without a transition. The `::after` text rules go. `aria-sort` stays the only state and the
  accessible name does not change.
- Font Awesome: every glyph the components now use maps to a Font Awesome name (`x` → `xmark` is
  already mapped; `arrow-up`/`arrow-down` match).

## §3 · Datebox, DateTimeBox, DateRangeBox

**Scope:** `src/components/datebox/datebox.js`, `src/components/datebox/date-range-box.js`,
`src/index.js` (export), `src/elements/define.js` (one attribute),
`website/layouts/{record-page,crm,issue-tracker}.layout.js`, `website/demos/datebox.demo.js`,
`website/demos/date-range.demo.js`, new `tests/unit/datebox-display.test.js`,
`tests/smoke/smoke.js` (one case each), `docs/llms.md` (Datebox and DateRangeBox sections).

- **Datebox** gains `displayFormat: string|null = null`. Exported pure helper
  `dateboxFormats({format, displayFormat, time})` → `{format, display}` applies the defaults and
  the time rule, so the rule is testable without a DOM.
  - The input shows `formatDate(value, focused ? format : display)`.
  - On `focus` the input switches to the typing text, unless it holds invalid text.
  - On `blur` the existing commit runs; a successful commit redraws in the display format.
  - `set()` while focused writes the typing text; while not focused, the display text.
- **DateTimeBox** inherits it (it is a Datebox with `time: true`).
- **DateRangeBox** gains the same option, with `parseRangeText`/`formatRangeText` unchanged: the
  display text is `formatRangeText(range, display, separator)`. Its blur rule stays (no commit while
  the calendar holds focus); when the input loses focus with its text unchanged, it redraws in the
  display format.
- **`<zx-datebox display-format>`** reflects the option.
- **Layouts:** record-page's close date, crm's renewal date, and issue-tracker's due date (the
  inspector and the create dialog) pass `displayFormat: DATE.year`, the format the rest of each
  screen uses. Issue-tracker's "Filed by … on" line moves from `DATE.long` to `DATE.year` so its
  inspector reads one format.
- **Demos:** the Datebox demo gains a "Display format" example (typed as `%d.%m.%Y`, shown as
  `%e %b %Y`, logging the change); the DateRangeBox demo shows one range with a display format.
- **Unit tests:** `dateboxFormats` defaults and the time rule; that the display text is what
  `formatDate` writes for month names; that the typing text round-trips through `parseDate` while
  the display text is never asked to; `formatRangeText` with a display format.
- **Smoke:** Datebox and DateRangeBox each: at rest the input shows the display text; on focus the
  typing text; typing a new date and blurring shows the new date in the display format and emits
  one `change`; invalid text survives blur and refocus.

## Out of scope

- Locale-aware default formats (`Intl.DateTimeFormat`) and a display format on `TimePicker`,
  `MonthPicker`, or the inline pickers.
- Parsing month names: the typing format stays numeric.
- Sweeping every `{ size: 16 }` call to `ICON_SIZE.control`: it is the default; new code omits it.
- Icon sizes in layouts (`website/layouts/**`) and in the ZeyOS binding; text glyphs in table cell
  renderers (the ZeyOS schema's boolean "✓").
- Kbd's arrow and modifier characters, which are keycap typography, not icons.

## Acceptance criteria

1. `npm test`, `npm run test:browser`, `node tools/check-site.js`, and `git diff --check` succeed.
2. `grep -nE "icon\([^)]*(chevron-|'x'|'check'|'square')[^)]*size: *[0-9]" src/components` finds
   nothing, and no component draws "×", "↑", or "↓" as text.
3. Unit tests cover `ICON_SIZE`, `dateboxFormats`, and display formatting for both boxes.
4. `node tools/shoot-layout.js` and `node tools/audit-layout.js` pass on record-page, crm, and
   issue-tracker at 1440 and 390, light and dark.
5. `docs/llms.md` documents `ICON_SIZE` (Icons), `displayFormat` (Datebox, DateRangeBox), and the
   `display-format` attribute.
6. JSDoc is complete on the new export, option, and helper.
