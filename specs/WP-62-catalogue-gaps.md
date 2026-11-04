# WP62 — The text that never reached the catalogue

WP-61 shipped a complete German catalogue, and it is complete against `defaultMessages`. But a
catalogue only translates what asks it: some library text is written straight into a component, and
some asks for keys `defaultMessages` lacks. A page with `de` installed therefore still shows English
in Select, Table and Datebox, which left WP-61's third acceptance criterion only partly met. This WP
closes those three components and the one Filter gap that produces wrong German.

Work on the branch `wp/62-catalogue-gaps`, from `wp/integration-55-61`. `AGENTS.md` applies.
`CHANGELOG.md` is central: report changelog lines. `docs/api.json` is regenerated. Public files must
not mention this spec.

This WP **explicitly permits** changes to two core files: `src/core/messages.js` (§1) and
`src/core/date.js` (§2). No other file under `src/core/` changes.

## Decisions (binding)

1. **English does not change.** Every new entry holds exactly the text the component shows today.
   `tools/visual-diff.js --base wp/integration-55-61` reports no difference.
2. **Whole sentences, never a slot for a word.** A translator gets the full text. A key does not
   take a noun that the component chose in English, because the verb and article around it depend on
   that noun in other languages.
3. **Month and weekday names stay out of the catalogue.** `Intl` already holds them for every
   language, in the forms that language uses (`Jänner` in `de-AT`, no dot in a short German month).
   Copying them into a catalogue would make every future language translate 38 strings the platform
   already has, and `tests/unit/i18n.test.js` already states that date names are not catalogue keys.
   `formatDate()` resolves a name in this order:
   1. the host translator's `date.month.*` / `date.weekday.*` keys, as today;
   2. `Intl.DateTimeFormat` in the `locale` option, which defaults to `getLanguage()`, the same
      contract as `formatNumber()`;
   3. the English constants, for an English language tag or a tag `Intl` cannot use.

   English tags (`en`, `en-*`) never reach `Intl`, so `Sep` does not become `Sept` under `en-GB`.
   Names always use the Gregorian calendar, because `%d`, `%m` and `%Y` do.
4. **Presets resolve through the instance's messages.** `Select.entity()` hands text to the
   constructor, so it reads that text through the options it was given. A `msg` option keeps working
   on a preset; `translate()` alone would skip it.
5. **Deliberate absences stay.** `tree.empty`, `finder.empty` and `priority.medium` stay out of the
   catalogue.

## §1 · Catalogue entries

**Scope:** `src/core/messages.js`, `src/locales/de.js`, `src/components/datebox/datebox.js`,
`src/components/datebox/date-range-box.js`, new `src/components/datebox/placeholder.js`,
`src/components/date-picker/date-picker.js`, `src/components/select/select.js`,
`src/components/table/table.js`, `src/components/filter/filter.js`, `tests/unit/messages.test.js`,
`tests/unit/locale-de.test.js`, `tests/unit/dialog.test.js`, `tests/smoke/smoke.js`,
`tools/size-budget.json` (the entries add to the `zx.esm.js` budget, which goes to 490000).

New keys, in the same place and order in both catalogues. German follows WP-61 Decision 3.

| Key | English |
|---|---|
| `datebox.choose` | Choose date |
| `datebox.clear` | Clear date |
| `datebox.placeholder.day` | DD |
| `datebox.placeholder.dayShort` | D |
| `datebox.placeholder.hour` | HH |
| `datebox.placeholder.minute` | MM |
| `datebox.placeholder.month` | MM |
| `datebox.placeholder.second` | SS |
| `datebox.placeholder.year` | YYYY |
| `datebox.placeholder.yearShort` | YY |
| `datePicker.dayLabel` | `%e %B %Y` (a `formatDate()` pattern) |
| `filter.choosePart.field` | Choose field… |
| `filter.choosePart.operator` | Choose operator… |
| `filter.choosePart.value` | Choose value… |
| `select.create` | Create new… |
| `select.createGroup` | New |
| `select.label` | Select |
| `select.recent` | Recent |
| `status.backlog` | Backlog |
| `status.canceled` | Canceled |
| `status.done` | Done |
| `status.duplicate` | Duplicate |
| `status.inProgress` | In Progress |
| `status.inReview` | In Review |
| `status.ready` | Ready to Merge |
| `status.todo` | Todo |
| `status.waiting` | Waiting for feedback |
| `table.cellInput` | %1 row %2 |
| `table.columnMoved` | Moved %1 to position %2 of %3. |
| `table.moveColumnEarlier` | Move %1 earlier |
| `table.moveColumnLater` | Move %1 later |
| `table.reorderBlocked` | Clear sorting to reorder rows |
| `table.rowDropped` | Row dropped |
| `table.rowGrabbed` | Row grabbed. Use the arrow keys to move it. |
| `table.rowMoved` | Moved row to position %1 of %2. |
| `table.rowOrder` | Row order |

- **`filter.choosePart` is removed** from both catalogues. Its `%1` was the identifier `field`,
  `operator` or `value`, which Decision 2 forbids; the three keys above replace it. A host override
  of the old key stops applying, which goes in the changelog.
- **Date placeholders** are shared by Datebox and DateRangeBox through
  `src/components/datebox/placeholder.js`, so a range box asks for the same text. Each box keeps the
  tokens it replaces today.
- **`datePicker.dayLabel`** is the name of a day cell. German needs `%e. %B %Y` to read as an
  ordinal, which is why it is a pattern and not a concatenation.
- **The tests** cover the keys of `DEFAULT_STATUSES`, which the `messages.test.js` scan cannot read
  out of its tuples, and fail when a labelling property in the Select, Table or Datebox source holds
  a literal. A smoke case proves Decision 4.

## §2 · Month and weekday names

**Scope:** `src/core/date.js`, `tests/unit/date.test.js`, `tests/unit/locale-de.test.js`,
`docs/llms.md`.

- `formatDate(date, fmt, { locale } = {})` implements Decision 3. Formatters are cached under their
  locale and style, because `formatDate()` runs once per calendar cell.
- `docs/llms.md` says that names follow `setLanguage()` through `Intl`, and that `date.*` keys remain
  the way to override them.
- The `locale-de.test.js` assertion that date patterns must avoid `%a %A %b %B` goes: the reason for
  it, that a name would come out in English, no longer holds.

## §3 · A check that stays

**Scope:** new `tools/check-language.js`, `tools/run-smoke.js`.

WP-61 checked this by hand, which is how the gaps survived. `tools/check-language.js` opens the
Select, Table and Datebox documentation pages with `de` installed, opens what those pages hide (lists,
calendars, the column menu, a grabbed row, a cell editor) and fails on any library text that stayed
English. `npm run test:browser` runs it.

Text counts as library English when it reads the same with and without the catalogue and does not
come from the demo module's own source. Demo copy is the author's, and `website/` stays English.
Blurbs and comments do not count as that source: they are prose about the library, so they would
excuse the very words this looks for.

The demos do not use every option (no demo reorders rows), so each page also mounts a fixture with
the options they leave out, and names German text that must appear, so a step that opens nothing
fails instead of passing.

## Out of scope

- Text that bypasses the catalogue in other components: Filter's operator labels and validation
  messages (`filter-model.js`), AccountMenu, ActivityList, AppSidebar, Calendar, MultiValueEditor,
  SortControl, ViewSettings and others. They are listed in the report as follow-up work.
- A `locale` option on the date components. `setLanguage()` drives them, and the option can be added
  when an application needs two languages on one page.
- Passing a Datebox's `msg` option down to its DatePicker.
- Translating documentation, demos or layout content.
- Date, number and currency formats beyond the names in Decision 3.

## Acceptance criteria

1. Every new key sits in `src/core/messages.js` and `src/locales/de.js` in the same order.
2. `npm test`, `npm run test:browser`, `node tools/check-site.js` and `git diff --check` pass.
3. `node tools/visual-diff.js --base wp/integration-55-61` shows no change in English.
4. With the catalogue installed, `tools/check-language.js` finds no library English on the Select,
   Table and Datebox pages, and it fails when one of the new keys is removed from `de` (checked by
   temporarily breaking one entry, then restoring it).
5. Changelog lines are reported.
