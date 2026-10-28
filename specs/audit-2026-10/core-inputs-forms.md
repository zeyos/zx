# Zx audit — core, internal, and input/identity/form components

Scope: `src/core/**`, `src/internal/**`, and button, badge, check-button, toggle, search, launcher,
app-icon, avatar, account-menu, workspace-switcher, number-field, rating, slider, copy, select,
checklist, tag-picker, date-picker (DatePicker, MonthPicker, TimePicker, DateRangePicker), datebox
(Datebox, DateTimeBox, DateRangeBox), timebox, calendar (input side), field, field-upload,
fieldset, form, multi-value-editor, value-list, questionnaire, code-editor, truncate — JS, CSS,
demos, and their `docs/llms.md` blocks. Yardstick: `AGENTS.md`. Read-only; `node tests/lint-tokens.js`
passes.

## Executive summary

1. **Two defects found by reading the code.** `AccountMenu.toggle()` calls `MenuButton.toggle()`, which does not exist, so it throws. `Fieldset.addField(id, component)` only knows `getValue/setValue/setDisabled`, so it silently fails for every `get()/set()/enable()` component (NumberField, Select, Slider, Rating, Datebox, Timebox …).
2. **Field double-emits `change`** for `slider` and `code` field types: their adapters do not stop the bubbling native `change` that `Field` also listens to (`field.js:178`). NumberField's adapter already explains and stops it.
3. **There are four value-accessor dialects** (`get/set`, `getValue/setValue`, `getValues/setValues`, `.value`), three disable dialects (`enable/disable`, `setDisabled(bool)`, none at all), and two spellings of `setReadonly`/`setReadOnly`. Select has `set()` but no `get()`.
4. **The `change` detail has nine shapes**: `{value}`, `{values}`, `{values,items}`, `{value,item}`, `{checked}`, `{checked,value}`, `{date}`, `{time}`, `{start,end}`. Field adapters exist only to translate them back to `{value}`.
5. **Event names are overloaded.** `select` means three unrelated things. `input` is debounced in Search but immediate in NumberField, Slider and CodeEditor. `invalid` has four payloads. Only WorkspaceSwitcher honours DOM cancellation; the other preventable events in this area do not.
6. **i18n is fractured.** There are 14 private `_message()` copies in four signatures, plus a module-level `text()` in DateRange* that bypasses the per-instance `msg` option entirely. AccountMenu, Datebox, FieldUpload, MultiValueEditor and CodeEditor hard-code English. Calendar uses bare keys (`next`, `today`, `loading`).
7. **Restoring an enhanced target is done six ways.** There is a core `snapshotTarget/restoreTarget`, three verbatim module copies, four inline copies, two `rememberAttributes/restoreAttributes` pairs and per-attribute fields. Three components also duplicate the base class's private `#destroyed` guard.
8. **Near-duplicate components.**
   - CheckButton and Toggle: about 90% the same code.
   - AccountMenu and WorkspaceSwitcher: the same trigger, the same lifecycle, about 60 lines of the same CSS.
   - Select and TagPicker: parallel combobox engines.
   - ValueList, MultiValueEditor and TagPicker (`allowCreate`): three ways to edit a list of strings.
   - The tone list is defined three times. The month grid is implemented three times. Date helpers re-implement `core/date.js`.
9. **A11y gaps.**
   - No accessible-name option on Toggle, Search, TagPicker, Datebox or Timebox. TagPicker's input stays "Add a value" even inside a labelled Field.
   - ValueList claims the APG listbox pattern but gives every chip a tab stop.
   - CodeEditor announces the caret position on every keystroke.
   - Checklist is always named "Checklist".
10. **Style drift.** Disabled state is expressed four ways on the root (`[data-disabled]`, `data-disabled="true|false"`, `aria-disabled` on a div, native `[disabled]`), with three different disabled opacities. The visually-hidden block is copied 22 times. The fixed-px Toggle, TagPicker and date-cell sizes ignore `--zx-control-height`.

---

## 1. Redundancies

### R1 — Target snapshot/restore re-implemented six ways · medium
- Core: `src/core/dom.js:264-282` (`snapshotTarget`/`restoreTarget`). Used correctly by app-icon, workspace-switcher, number-field, rating, slider, copy-input, select, tag-picker, questionnaire.
- Verbatim module-level copies: `check-button.js:155-167`, `toggle.js:138-150`, `search.js:193-205`.
- Inline copies: `launcher.js:163-166,450-457`, `avatar.js:65-68,139-145`, `account-menu.js:77-80,159-167`, `calendar.js:160-163,381-386`.
- Partial copies:
  - `rememberAttributes/restoreAttributes` in `field.js:436-446` and `date-range-picker.js:980-990`.
  - `restoreAttribute` in `date-range-box.js:500` (and `dropdown.js:292`, outside this area).
  - Per-attribute `_original*`/`_initial*` fields in `datebox.js:55-57,232-237`, `timebox.js:71,165`, `field-upload.js:79-80,380-383`, `value-list.js:46-47,324-327`, `multi-value-editor.js:52,368`, `checklist.js:59-61,197-202`, `code-editor.js:61-63,191-196`, `form.js:65,287`, `fieldset.js:37`.
- **Recommendation:**
  - Add `snapshotAttributes(el, names)` / `restoreAttributes(el, snapshot)` to `core/dom.js` next to `snapshotTarget`.
  - Better: give `Component` a protected `adoptTarget({children: true|false, attributes: [...]|true})` that `destroy()` undoes automatically.
  - Delete the module copies.
- **Migration:** non-breaking, internal only.

### R2 — 14 private `_message()` helpers plus two `text()` helpers · medium
- `(key, fallback)` with no interpolation: `search.js:168`, `number-field.js:420`, `select.js:966`, `checklist.js:276`, `time-picker.js:341`, `timebox.js:249`.
- `(key, fallback, ...args)`: `launcher.js:966`, `workspace-switcher.js:326`, `date-picker.js:463`, `calendar.js:1502`, `value-list.js:316`, `internal/app-rail.js:653`.
- `(key, fallback, args[])` with an array: `rating.js:253`. A call without `args` throws, because `...undefined` spreads nothing.
- Hand-rolled `replaceAll` instead of `printf`: `tag-picker.js:860-864`.
- Module-level `text(key, fallback, args)` built on `translate()`: `date-range-picker.js:851`, `date-range-box.js:494`. These skip `this.msg()`, so the per-instance `msg` option and `lang` are ignored (see A12).
- Repo-wide there are 32 copies.
- **Recommendation:**
  - Make `Component.msg(key, ...args)` accept a fallback: `this.msg(key, {fallback, args})`, or add `this.t(key, fallback, ...args)` in `core/component.js`.
  - Alternatively, declare English defaults in `static defaults.msg`, as Field, Form and Questionnaire already do, and drop fallbacks altogether.
  - Remove every private copy.
- **Migration:** non-breaking.

### R3 — CheckButton and Toggle are one component · medium
- `check-button.js:31-138` against `toggle.js:30-129`: identical render skeleton (button-only target check, `_createdRoot`, snapshot), identical `get/set/toggle/enable/disable`, identical `_cleaned` destroy guard and identical snapshot helpers.
- The only differences:
  - `aria-pressed` against `role=switch` with `aria-checked`.
  - On/off label pair (CheckButton) against `value`/`getValue()` (Toggle).
- Toggle lacks `setLabel()`; CheckButton lacks `getValue()`/`value`.
- A third "pressed" pattern exists as `.zx-btn[aria-pressed="true"]` (`button.css:114`).
- `check-button.css:1-16` restates the `.zx-btn` base (`button.css:1-24`) with drift: `--zx-color-bg-control` instead of the glass fill, and no `--zx-button-radius` hook.
- **Recommendation:**
  - Extract an internal `BinaryButton` base in `src/internal/` that owns state, events and lifecycle. CheckButton and Toggle become thin subclasses that set role and attributes.
  - Give both `value`, `getValue()` and `setLabel()`.
  - Have `.zx-check-button` compose `.zx-btn`, adding the class at render, instead of copying it.
- **Migration:** non-breaking (additive methods).

### R4 — AccountMenu and WorkspaceSwitcher share a trigger but not code · medium
- Shared JS, written twice:
  - Constructor re-emit with `zx-*` `stopPropagation`: `account-menu.js:55-68`, `workspace-switcher.js:95-102`.
  - Trigger DOM (graphic, two-line identity, chevron): `account-menu.js:83-92`, `workspace-switcher.js:118-127`.
  - `setCompact`, `open/close/toggle/isOpen/focus/getPanel`, and the destroy order.
- CSS duplicated almost line for line: `account-menu.css:13-81` against `workspace-switcher.css:22-127`.
- The drift between them is already visible:
  - AccountMenu's focus rule lacks `outline: none`.
  - AccountMenu has no reduced-motion transition and no chevron rotation.
  - AccountMenu sets no `title` when compact.
  - Panel min-width is 220px in AccountMenu (`account-menu.css:85`) and 240px in WorkspaceSwitcher (`workspace-switcher.css:159`).
- The drift has already caused a defect: AccountMenu `toggle()` delegates to a non-existent `MenuButton.toggle()` (`account-menu.js:109-112`; `menu-button.js` has none), while WorkspaceSwitcher implements toggle itself (`workspace-switcher.js:199-203`). See B1.
- **Recommendation:**
  - Add `MenuButton.toggle()`.
  - Extract `src/internal/menu-trigger.js`: trigger builder, compact handling, re-emit wiring and shared `.zx-menu-trigger` CSS.
  - Have AccountMenu use `_message` keys and `honorDomCancellation`, as WorkspaceSwitcher does.
- **Migration:** non-breaking.

### R5 — Select and TagPicker: two combobox engines · medium
- Both build input with `role=combobox`, a toggle, a `popover=manual` panel, a listbox, `position()`, async `_requestSequence` and `_queryTimer`, `_setActive`/`_move`, document `pointerdown` close, and loading state. Compare `select.js:119-243,563-666,793-850` with `tag-picker.js:97-200,535-584,665-720`.
- TagPicker imports Select's private modules: `../select/filter.js` and `../select/color.js` (`tag-picker.js:7-8`). Checklist does too (`checklist.js:4`).
- The two engines have drifted (A6, B5).
- **Recommendation:**
  - Move `matchItems` and `itemColor` to `src/internal/` (or core).
  - Extract an internal `ListboxPopup` controller covering open/close/position, async query, active descendant and keyboard. Both components then configure it.
- **Migration:** non-breaking.

### R6 — ValueList, MultiValueEditor and TagPicker(`allowCreate`) all edit a list of strings · low–medium
- Each implements its own row/chip rendering, reorder (Ctrl+←/→ in `value-list.js:236-250`; handle arrows and buttons in `multi-value-editor.js`), drag-and-drop, and removal.
- MultiValueEditor hard-codes English labels while ValueList uses messages (A12).
- `normalizeOptions` is duplicated in `field.js:619-625` and `multi-value-editor.js:376`.
- **Recommendation:**
  - Keep TagPicker as the catalogue picker.
  - Pick ValueList or MultiValueEditor as the free-text list, or make MultiValueEditor a `layout: 'rows'` mode of ValueList.
  - At minimum share the reorder and drag helpers and one keyboard map.
- **Migration:** breaking if one is folded in; keep an alias for a release.

### R7 — Tone palette and identity derivation · low
- The same nine-tone list is declared three times: `BADGE_TONES` (`badge.js:34`), `APP_ICON_TONES` (`app-icon.js:8`), `AVATAR_TONES` (`avatar.js:31`).
- Consumers import whichever they reach first: `workspace-switcher.js:5,346`, `module-bar.js:5`, `kanban-card.js:4`, `tag-picker.js:6` (`normalizeBadgeTone`).
- The presence list `['online','away','busy','offline']` is repeated at `avatar.js:189,213` and `account-menu.js:175`.
- Initials are handled well: `workspaceInitials` delegates to `avatarInitials` (`workspace-switcher.js:401-405`).
- **Recommendation:** add `src/core/tones.js` (or `internal/`) exporting `TONES`, `normalizeTone`, `toneFor(name)` (the FNV hash now in `avatarTone`) and `PRESENCE`. Keep the three exported names as aliases.
- **Migration:** non-breaking.

### R8 — Date utilities duplicated around `core/date.js` · low–medium
- `validDate` ×5:
  - `calendar-model.js:415`
  - `date-picker.js:481`
  - `date-range-picker.js:903`
  - `month-picker.js:220`
  - `datebox.js:347`
- `dayOnly`, `cloneDate` and `isoWeekNumber` appear in both `date-picker.js:486-510` and `date-range-picker.js:908-970`.
- `normalizeWeekStart` ×3, and they behave differently: the pickers fall back to `getWeekStart()` (`date-picker.js:502-505`), while Calendar throws `RangeError` (`calendar-model.js:421-425`).
- `calendar-model.js` re-implements `addMonths/addDays/startOfDay` as `addCalendarMonths/addCalendarDays/startOfCalendarDay` (`:104-118,298-310`).
- `pad` is in both `time-picker.js:411` and `timebox.js:287`; `normalizeStep` is in both `time-picker.js:405` and `number-field.js:523`.
- **Recommendation:** add `isValidDate`, `startOfDay`, `isoWeek` and `normalizeWeekStart` to `core/date.js` (the spec must allow core edits) and import them.
- **Migration:** non-breaking.

### R9 — Three month-grid implementations · low
- DatePicker's quick-pick month grid (`date-picker.js:348-400`), MonthPicker (`month-picker.js:120-145`) and Calendar's year view (`calendar.js:683`).
- MonthPicker `extends DatePicker` (`month-picker.js:19`) but overrides `render()` completely. It inherits only `_message` and DatePicker's defaults (`weekStart`, `showWeekNumbers`, `time` are merged into its options by `mergeOptions`).
- **Recommendation:**
  - MonthPicker should extend `Component`.
  - DatePicker should compose MonthPicker for its quick pick.
- **Migration:** `instanceof DatePicker` changes for MonthPicker (minor break).

### R10 — Numeric parsing written twice · low
- `field.js:318-383` (`coerceInteger/coerceFloat/parseLocalizedNumber`, used by the `int`/`float` field types and Form) against `number-field.js:470-505` (`parseNumber`).
- They use different heuristics: Field validates thousands grouping, NumberField strips everything that is not a digit.
- `field.int/field.float` and `form.int/form.float` duplicate the same messages (`field.js:66-67`, `form.js:51-53`).
- **Recommendation:**
  - Use one `parseLocalizedNumber` in `core/format.js`.
  - Have the `int`/`float` field types reuse it, or delegate to NumberField.
  - Drop the duplicated Form messages, since Field already validates on blur.
- **Migration:** non-breaking, but behaviour changes for edge inputs.

### R11 — Field adapters copy the same disabling and re-entrancy boilerplate · low
- "Disable every inner control" is written three times: `checklist/field-adapter.js` (does not restore original state), `multi-value-editor/field-adapter.js` (does restore it) and `date-picker/field-adapter.js` (month).
- These exist only because Checklist, MultiValueEditor and MonthPicker have no `disable()`.
- The `setting` guard appears in six adapters; the others rely on `silent`.
- **Recommendation:**
  - Give those components `enable/disable`.
  - Add a `componentAdapter(field, component, {get, set, payload})` helper in `field.js` that wires the standard `get()`/`set(v,{silent})`/`enable()`/`focus()` contract and the native-change stop (fixes B2).
- **Migration:** non-breaking.

### R12 — CSS blocks duplicated · low
- **Visually-hidden** block appears in 22 stylesheets, nine of them in this area: `copy-button.css`, `copy-input.css`, `date-range-picker.css`, `field-upload.css`, `launcher.css`, `questionnaire.css`, `slider.css`, `value-list.css`, `calendar.css`. Recommendation: one `.zx-visually-hidden` utility in `styles/base.css`.
- **Disabled opacity:**
  - 0.55: button, check-button, toggle, number-field, rating, slider, tag-picker, multi-value-editor, questionnaire.
  - 0.65: select, date-range-picker, field, field-upload, value-list.
  - 0.6: code-editor (`code-editor.css:67`).
  - Recommendation: a `--zx-disabled-opacity` tier-2 token.
- **Square affordance buttons** (`__clear`, `__toggle`) are styled separately in select, tag-picker, datebox, date-range-box and search, with different glyph sizes (B9).
- **Migration:** non-breaking.

### R13 — `debounce` in core is unused · low
- `util.js:9-20` has no `cancel()`. As a result Search (`search.js:146-153`), Launcher (`:475-476`), Select (`:808-812`) and TagPicker (`:676-680`) each hand-roll `setTimeout`/`clearTimeout`.
- **Recommendation:** add `.cancel()`/`.flush()` to core `debounce` and use it everywhere.
- **Migration:** non-breaking.

---

## 2. Public API inconsistencies

### A1 — Value accessors: four dialects · high
- `get()/set(v,{silent})`: CheckButton, Toggle, Search, NumberField, Rating, Slider, CopyInput, DatePicker, MonthPicker, TimePicker, DateRangePicker, Datebox, DateRangeBox, Timebox.
- `getValue()/setValue()`: Field, CodeEditor. Toggle has both `get()` and `getValue()`, which return different things (`toggle.js:59,92`).
- `getValues()/setValues()`: Checklist, TagPicker, MultiValueEditor, ValueList, Fieldset, Form.
- Property `.value`: NumberField, Rating, Slider, Select. Property `.values`: TagPicker.
- Select has `set()` but **no `get()`** (`select.js:245-282`).
- Calendar: `getDate/setDate`. WorkspaceSwitcher: `getActive/setActive`.
- This is not cosmetic: `fieldset.js:285-305` duck-types only `getValue/getValues`, `setValue/setValues` and `setDisabled`, so external components break (B3).
- **Recommendation:**
  - Pick one canonical pair: `get()/set(value,{silent})`, plus a `value` accessor on every value component. For collection components, `get()` returns the array; keep `getValues()` as an alias.
  - Add `get()` to Select.
  - Add `getValue/setValue` aliases to the `get/set` family, or the reverse, so Fieldset works with every component.
- **Migration:** non-breaking if done through aliases.

### A2 — Disabled and read-only API · medium
- `enable()/disable()`: most components.
- `setDisabled(bool)`: Field (`field.js:229`), FieldUpload (`field-upload.js:225`).
- No method at all: Search, DatePicker, MonthPicker, TimePicker, Checklist, MultiValueEditor, Questionnaire.
- `disabled` option missing: FieldUpload, DatePicker, MonthPicker, TimePicker, Checklist, MultiValueEditor, Search.
- `setReadonly` (NumberField `:229`, Rating `:200`, Slider `:221`, TagPicker `:403`) against `setReadOnly` (CodeEditor `:144`). Option `readonly` against `readOnly` (`code-editor.js:51`).
- **Recommendation:**
  - Everywhere: `enable()`, `disable()`, `setDisabled(bool)`, `isDisabled()` and a `disabled` option.
  - Rename to `readonly`/`setReadonly`, keeping `readOnly`/`setReadOnly` as deprecated aliases in CodeEditor.
- **Migration:** additive; the rename keeps an alias.

### A3 — `change` detail shapes · high
- `{value}`: NumberField, Rating, Slider, Timebox, CodeEditor, Field.
- `{value,item}`: Select.
- `{values}`: Checklist, MultiValueEditor, ValueList.
- `{values,items}`: TagPicker.
- `{checked}`: CheckButton.
- `{checked,value}`: Toggle.
- `{date}`: DatePicker, MonthPicker, Datebox.
- `{time}`: TimePicker.
- `{start,end}`: DateRange*.
- `{id,value}`: Form.
- `{name,value,answers}`: Questionnaire.
- Every Field adapter then re-maps the payload to `{value}`, for example `datebox/field-adapter.js` (`detail.date`) and `checklist/field-adapter.js` (`detail.values`).
- **Recommendation:**
  - Guarantee a `value` key on every `change` detail, holding whatever `get()` returns.
  - Keep the specific keys (`date`, `values`, `checked`, …) as extras for compatibility.
  - Document the rule in "Events & lifecycle".
- **Migration:** additive (new key), non-breaking.

### A4 — Overloaded event names · medium
- **`select`** means three things: a menu/launcher pick (AccountMenu, Launcher, WorkspaceSwitcher, AppRail), a file choice (FieldUpload `field-upload.js` `emit('select',{files})`), and a date-range selection (Calendar, DateRangePicker).
- **`input`** is debounced in Search (`search.js:146-153`) but fires per keystroke in NumberField (`:340`), Slider (`:297`) and CodeEditor (`:96-99`).
- **`invalid`** has four payloads: `{text}` (Datebox, DateRangeBox), `{message}` (Field), `{errors}` (Form), `{name,message}` (Questionnaire).
- **Recommendation:**
  - FieldUpload: `select` becomes `filechange` (alias kept for one release).
  - Search: add an immediate `input` and rename the debounced one `search` or `query`, as Launcher and Select already name it.
  - Normalise `invalid` to include `message`.
- **Migration:** breaking for renames, so ship aliases.

### A5 — DOM cancellation honoured inconsistently · medium
- Only WorkspaceSwitcher passes `{honorDomCancellation:true}` (`workspace-switcher.js:295,316`).
- Preventable events that ignore `preventDefault()` on the bubbling `zx-*` event:
  - Launcher `select` (`launcher.js:932`)
  - AccountMenu `select` (`account-menu.js:64`)
  - Select `action` (`select.js:651`)
  - Form `submit` (`form.js:259`)
  - Questionnaire `navigate` and `submit` (`questionnaire.js:357,597,611`)
  - Calendar `dateclick`/`eventchange` (`calendar.js:816,1301`)
  - AppRail `select` (`internal/app-rail.js:249,339,420`)
- **Recommendation:** make every documented-preventable event honour DOM cancellation, or flip the default in `Component.emit` so that `cancelable` events are honoured unless the caller opts out.
- **Migration:** behaviour change, low risk.

### A6 — Same option, different names or defaults · medium
- **List height:** `listHeight: 280` (Select), `listHeight: 260` (TagPicker), `height: 280` (Checklist).
- **Debounce:** 250 (Search, Launcher) against 200 (Select, TagPicker).
- **Week numbers:** `showWeekNumbers` (DatePicker, DateRangePicker, DateRangeBox) against `weekNumbers: true` (Calendar `calendar.js:124`), with opposite defaults.
- **Week start:** `weekStart: 1` is hard-coded everywhere, so the locale fallback `getWeekStart()` (`core/date.js:157`) is dead unless the caller passes garbage. Datebox exposes neither `weekStart` nor `showWeekNumbers` to its DatePicker (`datebox.js:104-109`), while DateRangeBox does (`date-range-box.js:191-192`).
- **Async loading:**
  - Select and TagPicker: `filter: (query) => …`, with no `AbortSignal`.
  - Launcher: `load(query, {signal})`.
  - Checklist: `load()`, with no query.
- **Async errors:** TagPicker and Launcher emit `error`; Select (`select.js:830-836`) and Checklist (`checklist.js:100`) swallow them.
- **`loaded` event:** Select and Checklist only.
- **Units:** Datebox `get('seconds')` (Unix seconds); Calendar option `dateUnit: 'milliseconds'`; Timebox `unit: 'minutes'`.
- **Empty value:** Rating `0` (the adapter maps it to null), NumberField `null`, Select `null`, Timebox `0`.
- **WorkspaceSwitcher `setActive(id, {silent = true})`** (`workspace-switcher.js:144`) is the only setter whose default is silent.
- **Timebox `set(value, unit?, options?)`** (`timebox.js:130`) is the only setter with a positional second argument.
- **Recommendation:**
  - Standardise on `listHeight` and one debounce default.
  - Use `showWeekNumbers` with an alias.
  - Default `weekStart: null`, which resolves through `getWeekStart()`.
  - Pass `{signal}` to every async loader.
  - Emit `error` from every async component.
  - Make `set(value, {silent, unit})` options-only, with positional `unit` still accepted.
- **Migration:** mostly additive. Changing the `weekStart` default changes behaviour for non-Monday locales.

### A7 — `label` means two different things · medium
- **Visible text:** Toggle (`label:null`), CheckButton (`''`), Slider (`''` + `hideLabel`), CopyInput (`''` + `hideLabel`), Field.
- **Accessible name only:** NumberField (`null`), Rating (`'Rating'`), Select (`''`), CodeEditor (`'Code editor'`), Launcher, AccountMenu, WorkspaceSwitcher, AppIcon, Avatar.
- **No naming option at all:** Search (`search.js:49` uses the placeholder), TagPicker, Datebox, DateRangeBox, Timebox, DatePicker, Checklist (`hideLabel` exists, but the text is always the message `checklist.label`).
- **Recommendation:**
  - `label` = visible text, with `hideLabel` to keep it as the accessible name only.
  - Add `ariaLabel` (or `labelledBy`) to every input component.
  - Rating and CodeEditor default `label` to `null` and resolve a message.
- **Migration:** additive.

### A8 — Overlay method set is incomplete · low–medium
- `open/close/toggle/isOpen`: Launcher, AccountMenu (but `toggle` is broken), WorkspaceSwitcher.
- `open/close` only: Select, TagPicker, Datebox, DateRangeBox.
- `openClock/closeClock/toggleClock`: TimePicker.
- **Recommendation:** every popup-owning component gets `open/close/toggle/isOpen`.
- **Migration:** additive.

### A9 — Factories against classes · low
- Factory functions: `button()`, `badge()`, `copyButton()`, `appIcon()` (a class wrapper), `truncate()` (returns a controller), `setButtonBusy()`.
- `DateTimeBox` is a PascalCase function, not a class (`datebox.js:337`), which contradicts the docs' "every visual component is an ES class" (`llms.md:12`).
- `copyButton`'s `oncopy(text, copied)` is a positional callback (`copy-button.js:63`), not a `CustomEvent`.
- **Recommendation:** make `DateTimeBox` a subclass (`class DateTimeBox extends Datebox`) and document the factory family as such.
- **Migration:** non-breaking.

### A10 — Action-descriptor callback names · medium
- Button: `onclick(event)` (`button.js:57`).
- Form action: `onClick` **or** `onclick` **or** `handler(event, form)` (`form.js:268`).
- MenuButton item: `onselect(value, item, controller)` (`menu-items.js:25`).
- Launcher item and Select action: `invoke()` / `invoke(detail)`.
- Docs for Dialog buttons: `action|onclick`.
- **Recommendation:** pick one, e.g. `onselect(detail)` with a single detail object, accept the others as deprecated aliases in one normaliser in `internal/`, and document it once.
- **Migration:** additive with aliases.

### A11 — Field type names · low
- Run-together lowercase: `zxselect`, `tagpicker`, `multivalueeditor`, `valuelist`, `optionlist`.
- Short names: `code` (CodeEditor), `upload` (FieldUpload), `number`, `time`, `month`.
- Forced by `Field.register` lowercasing (`field.js:82`).
- **Recommendation:** accept kebab aliases (`tag-picker`, `value-list`, `multi-value-editor`, `code-editor`, `field-upload`, `select` → keep native, add `combobox` for Select) and document a single convention.
- **Migration:** additive.

### A12 — Message-key naming and the override mechanism · medium
- **Camel prefixes:** `tagPicker.*`, `numberField.*`, `workspaceSwitcher.*`, `monthPicker.*`, `timePicker.*`, `valueList.*`, `appRail.*`. Against lowercase `daterange.*`, used by both DateRangePicker and DateRangeBox.
- **Cross-component keys** in Select: `priority.*`, `permission.*`, `status.*` (`select.js:70-74,545`, `glyphs.js:50`).
- **Unprefixed keys** in Calendar: `today`, `next`, `previous`, `loading`, `more`, `new`, `calendar` (`calendar.js:76-99`). These collide in any host translator dictionary.
- **Two override mechanisms:**
  - Launcher has six label options (`placeholder`, `label`, `closeLabel`, `resultsLabel`, `emptyText`, `loadingText`) **and** message keys.
  - Others accept only `msg`.
  - Others still accept only English options: CopyInput `feedback`/`buttonTitle`, MultiValueEditor `addLabel`, EntitySelect `recentLabel = 'Recent'` (`select.js:465`).
- **Hard-coded English, no keys:**
  - AccountMenu (`account-menu.js:177,190`)
  - Datebox (`datebox.js:84,90`)
  - FieldUpload (`field-upload.js:94,96,103,109,168,338,393`)
  - MultiValueEditor (`multi-value-editor.js:127-167`)
  - CodeEditor (status text `code-editor.js:176-178`; label default)
  - Select's name fallback `'Select'` (`select.js:135`)
  - Rating `label: 'Rating'`
- **DateRange\*** `text()` bypasses `this.msg()`: the per-instance `msg` and `lang` options have no effect (`date-range-picker.js:851`, `date-range-box.js:494`).
- **Recommendation:**
  - Keys: `<componentCamel>.<key>`, always prefixed. Calendar moves to `calendar.*` and reads the bare keys as a fallback for one release.
  - DateRange* use `this.msg`.
  - Every visible or ARIA string gets a key.
  - Options stay as per-instance overrides only where already public.
- **Migration:** additive. Renaming Calendar keys breaks host dictionaries, so keep the fallback.

### A13 — Core: reserved option names leak · low
- `Component.msg` reads `this.options.lang ?? this.options.language` (`component.js:214`). Neither is documented in any typedef.
- `language` collides with CodeEditor's public `language` option (`code-editor.js:44`). The moment CodeEditor calls `this.msg()`, `language: 'json'` will select the `msg.json` dictionary.
- **Recommendation:** reserve `lang` only, drop `language` from `msg()`, and document `lang`/`msg` as base options.
- **Migration:** low risk.

---

## 3. Behaviour and accessibility

### B1 — `AccountMenu.toggle()` throws · high
- `account-menu.js:109-112` calls `this._menu.toggle()`; `MenuButton` defines `open/close/isOpen` only (`menu-button.js:174-197`). The method is documented in `llms.md:793`.
- No test calls it.
- **Fix:** implement it as WorkspaceSwitcher does (`isOpen() ? close() : open()`), or add `MenuButton.toggle()`.
- **Migration:** fix only.

### B2 — Field emits `change` twice for `slider` and `code` · high
- `Field` listens for native `change` on the adapter root (`field.js:178`). NumberField's adapter stops it and says why (`number-field/field-adapter.js` comment).
- The slider adapter does not, so the inner range input's native `change` (`slider.js:121`) bubbles and Field emits a second `{value}`. The CodeEditor textarea does the same (`code-editor.js:100`). The code adapter also re-emits on every `input`, so a Field of type `code` fires `change` per keystroke **and** on blur.
- The rating adapter is unaffected (its radios are buttons).
- **Fix:**
  - Stop native `change` in the slider and code adapters, or better, have `Field` ignore events whose target is not `adapter.el`.
  - Make `code` emit on the editor's `change`, not on `input`.
- **Migration:** fix (event count changes).

### B3 — `Fieldset.addField(id, component)` fails for most components · high
- `externalAdapter` (`fieldset.js:275-310`) and `readExternalValue/readExternalDisabled` (`:319-330`) duck-type `getValue/getValues`, `setValue/setValues` and `setDisabled`.
- For NumberField, Slider, Rating, Select, Datebox, Timebox, DatePicker, Search or CopyInput: `get` falls through to `'value' in el`, which is false for a `div`, so it returns `null`.
- `set` is a no-op. For Toggle and CheckButton it writes `button.value`.
- `setDisabled` only sets `aria-disabled` on the root and disables nothing.
- **Fix:** have the adapter try `get()`/`set()`/`enable()`/`disable()` too; better still, solve it with A1/A2.
- **Migration:** fix.

### B4 — Accessible names · medium
- **Toggle** (`toggle.js:46-48`) and **CheckButton** with no label, or an icon-only CheckButton, have no name and no `ariaLabel` option.
- **Search** uses the placeholder as its `aria-label` (`search.js:49`).
- **TagPicker**'s input is always named "Add a value" (`tag-picker.js:130`).
  - Inside a Field, `unnamedControlWithin` skips controls that already have `aria-label` (`field.js:425-433`). The Field label therefore goes onto the non-labelable wrapper `div` as `aria-labelledby`, and the combobox the user actually focuses never announces the field label.
  - The TagPicker adapter passes no label (`tag-picker/field-adapter.js`).
- **Datebox** and **DateRangeBox** inputs have no name standalone; their buttons say "Clear date" / "Choose date" in English.
- **Checklist** is always named by the message `checklist.label` ("Checklist", `checklist.js:63`).
- **Fix:** add the A7 `ariaLabel`/`label` option to each component. Field adapters should pass `options.label` (TagPicker), or set `labelTarget` to the inner input.
- **Migration:** additive.

### B5 — Combobox keyboard maps differ · medium
- Select:
  - ArrowUp on a closed control opens it at the last option (`select.js:581-587`).
  - Home/End always move the active option when open, even in `filter` mode, where they should move the caret.
  - Escape when closed does nothing.
  - Enter when closed does nothing (the APG select-only pattern expects Enter/Space to open).
  - Space in the read-only form runs typeahead with `' '`.
- TagPicker:
  - ArrowUp on a closed control does nothing (`tag-picker.js:545-548`).
  - Home/End work only when the input is empty, which is correct for editable comboboxes.
- Escape scope differs:
  - Select and TagPicker: on the input.
  - Datebox (`datebox.js:131-135`) and DateRangeBox (`date-range-box.js:225`): `document`-level.
- **Recommendation:**
  - One keymap in the shared controller (R5).
  - Select-only mode: Enter/Space/Alt+↓ open.
  - Editable mode: Home/End move the caret.
- **Migration:** behaviour change, minor.

### B6 — ValueList claims a listbox but has N tab stops · medium
- The docblock says "APG listbox/option focus model" (`value-list.js:20`), but every chip gets `tabIndex 0` (`:198`) and `aria-selected` is always `false`.
- The core `rovingTabindex` (`core/keyboard.js:81`) is not used. Rating, MonthPicker, the TimePicker dial and DatePicker also hand-roll roving focus.
- **Fix:** use `rovingTabindex` with a single tab stop, or re-label the chips as a list of buttons.
- **Migration:** behaviour change.

### B7 — Live regions · medium
- CodeEditor's `role=status aria-live=polite` position line (`code-editor.js:66-70`) updates on every click, keyup and select (`:102-104`), so screen readers announce "Ln 3, Col 7" constantly.
- Select's loading indicator is an empty `role=status` span with only an `aria-label` that is toggled with `hidden` (`select.js:159-165`). Announcing that way is unreliable.
- Field's highlight carries both `aria-live="polite"` and, for danger, `role="alert"` (`field.js:135-140,249`), which is conflicting politeness.
- **Fix:**
  - CodeEditor: no live region, or announce only on demand or on a debounce.
  - Select: put the loading text in the status element's text content.
  - Field: pick one mechanism.
- **Migration:** non-breaking.

### B8 — Change emitted without a real change · low
- CheckButton, Toggle, Select, NumberField and Checklist emit only on a real transition.
- Timebox emits on every commit and every non-silent `set()`, even when the value is unchanged (`timebox.js:144,213,234`).
- Slider `_onCommit` emits on every native `change` (`slider.js:301-307`).
- Datebox `set()` always emits (`datebox.js:168`).
- **Fix:** guard all of them with a previous/next comparison.
- **Migration:** fewer events (non-breaking in practice).

### B9 — Timebox is a weaker spinbutton than TimePicker · low
- TimePicker segments are `role=spinbutton` with ↑/↓ and `aria-valuenow` (`time-picker.js:146-173`).
- Timebox segments are plain text inputs with no arrow keys (`timebox.js:171-197`). Timebox also has no `focus()`, so its adapter queries the DOM.
- TimePicker's dial ignores its own `step` option (it uses the constant `MINUTE_STEP = 5`, `time-picker.js:20`).
- **Fix:** share a `segmentInput` helper and add `focus()`.
- **Migration:** additive.

### B10 — Inconsistent glyph sizes for the same affordance · low
- Clear "x": 15 (Search `search.js:57`), 13 (Select `:157`, Datebox `:85`, DateRangeBox `:163`), 12 (MultiValueEditor), 11 (TagPicker tag remove).
- Chevron toggle: 16 (Select `:171`) against 15 (TagPicker `:139`).
- All of these are px constants in JS, independent of `--zx-control-height`.
- **Fix:** size glyphs in CSS (`.zx-icon { inline-size: var(--zx-icon-sm) }`) or use one constant per affordance.
- **Migration:** visual only.

### B11 — Enhancing and restoring: two models · low
- Replace children: Select, Toggle, Search, Launcher, Avatar, CheckButton and others.
- Append children: DatePicker, DateRange*, Datebox, Timebox, Field, Form, Fieldset, ValueList, MultiValueEditor, FieldUpload.
- DatePicker, MonthPicker and TimePicker restore nothing but their own content.
- `llms.md:19-21` promises a non-null target is "enhanced in place and restored on destroy()".
- **Recommendation:** document the two models explicitly, or use R1's `adoptTarget()`.

### B12 — Reduced motion · low
- Unguarded transitions in `button.css:20-23` and `multi-value-editor.css:90`. They are neutralised globally by `styles/base.css:155`, but still breach the "wrap in no-preference" rule.

---

## 4. Convention breaches

### C1 — Stray `addEventListener` (factories) · low
- `button.js:90` (`setButtonBusy` capture guard) and `copy-button.js:60`. Both are factories with no `Component`, so `this.listen` is unavailable, but the listeners can never be removed.
- `dom.js:396-398`: `h()` turns any `on*` function prop into an untracked `addEventListener`. Any component passing `onclick:` to `h()` silently bypasses `this.listen`. None does in this area today.
- **Recommendation:**
  - Accept a `signal` option in `button()`/`copyButton()`.
  - Have `h()` honour an active scope signal, analogous to `h.scope` refs, so listeners attached during `render()` are aborted on `destroy()`.

### C2 — `this.el` not assigned in `render()` · low
- Search (`search.js:37`), DatePicker (`date-picker.js:42`), MonthPicker, Fieldset, Form (`form.js:59`), ValueList (`value-list.js:42`) and `internal/app-rail.js` use a local `root` and never set `this.el`.
- That is harmless today, but violates the AGENTS rule and breaks any helper that touches `this.el` during render. Form's `addFieldset()` runs inside render.

### C3 — Duplicated destroy guards · low
- `_cleaned` in `check-button.js:126`, `toggle.js:118` and `search.js:138`; `_destroyed` in `launcher.js:186` and Questionnaire; `_active` in `checklist.js:55`.
- All of them duplicate `Component#destroyed`, which is private and has no getter.
- **Recommendation:** expose a `get destroyed()` (or `isDestroyed()`) on `Component`.

### C4 — Module-level and static mutable state · low
- `Field.#adapters` (`field.js:73`) is a global mutable registry filled by side-effect imports (`src/index.js:26-44`). This is intentional, but it is the one place a component holds cross-instance state, so it should be called out in AGENTS.
- Core holds module state by design: `i18n.js:5-6`, `util.js:80`, `dom.js:16,24`.

### C5 — Listener-scope workaround · low
- `internal/app-rail.js:660-671`: `RailListenerScope` is a whole `Component` that appends a hidden `<span>` to the DOM just to get a resettable AbortController.
- AppSidebar and Card create raw AbortControllers for the same reason (outside this area).
- **Recommendation:** add `Component#scope()`, returning a child `{listen, abort}` tied to the main signal.

### C6 — Icons outside `icon()` · low
- ValueList's remove glyph is a literal `'×'` (`value-list.js:205-209`).
- Rating sizes its icons from a JS px table (`rating.js:390`).

### C7 — Hard-coded px that should follow tokens · low–medium
- Toggle track and thumb: 34×20 and 14px (`toggle.css:37-66`). They do not scale with `--zx-control-height` or density.
- TagPicker: tags `min-block-size: 24px`, remove 18px, toggle 24px, padding 3px (`tag-picker.css:13,67,117-140`).
- DatePicker: width 292px and day cells 24px (`date-picker.css:11,61,118`). DateRangePicker uses **28px** cells (`date-range-picker.css:160`), so the two pickers have different cell sizes.
- Launcher: option 36px, tile 92px, `padding-inline: 4px` (`launcher.css:191-291`).
- Rating: `gap: 4px` (`rating.css:103`).
- Control-height offsets: `number-field.css:48` (`- 6px`), `copy-input.css:62` (`- 4px`).
- Font sizes outside `--zx-text-*`: `font-size: 11px` (`select.css:253`), `9px` (`app-icon.css:166`).
- Panel widths 220 and 240px (R4).

### C8 — Tokens · none
- No tier-1 or raw colours found in this area's CSS. The lint passes, and manual greps for `color-mix`/`var()` fallbacks found nothing.

### C9 — `@ts-check` coverage · low
- Only `questionnaire.js` and `questionnaire/items.js` carry it among the 55 component/internal JS files. `src/internal/*.js` lacks it although it is shared infrastructure.
- `tsconfig.json` acknowledges this. The recommendation is to prioritise `internal/` and the field adapters.

### C10 — Private cross-component imports · low
- TagPicker and Checklist import `select/filter.js` and `select/color.js`; `normalizeBadgeTone` is exported from `badge.js` but not from `src/index.js`.
- `normalizeAppItems` is exported publicly from `src/internal/` (`src/index.js:127`), so the "internal" folder carries public API.

---

## 5. Docs drift

- **D1 · medium — Field widget types** (`llms.md:1970-1981`). Missing: `slider`, `daterange`, `code`. All three are registered in `src/index.js:29-41` (slider and code are mentioned only in their own sections). The built-in list (`:1944-1946`) omits `custom`, and the `adapter` option (`field.js:21`) is undocumented.
- **D2 · medium — Rating keyboard** (`llms.md:990`). The docs say "←/↓ and →/↑ step", pairing Down with back. The code (`rating.js:269-276`) follows APG: Right/Down forward, Left/Up back.
- **D3 · medium — AccountMenu `toggle()`** is documented (`llms.md:793`) but throws (B1). The default `placement: 'top-start'` is not stated, while WorkspaceSwitcher states its own.
- **D4 · low — Search demo** claims "clear when the button or Escape empties the field" (`website/demos/search.demo.js`). Only the button emits `clear`; Escape relies on native `type=search`, which fires `input` only.
- **D5 · low — Button `busy` option** (`button.js:14`) and `setButtonBusy()` are not in `llms.md:359-377`, and the demo does not exercise them.
- **D6 · low — TagPicker `error` event** is in the JSDoc (`tag-picker.js:66,874`) but missing from `llms.md:2141`.
- **D7 · low — Select JSDoc** does not list `action` in the class `@fires` (`select.js:81-85`), although the event is declared at `:1075` and documented in `llms.md`.
- **D8 · low — "Mental model"** promises every target is restored on `destroy()` (`llms.md:19-21`); see B11. "Every visual component is an ES class" is contradicted by `DateTimeBox`, `button`, `badge` and `copyButton`.
- **D9 · low — AGENTS.md demo contract** specifies `export default {title, group, mount(container)}`. 79 of 83 demos use `examples: [{title, render}]`, which `website/docs.js:185-206` treats as the "current" shape. AGENTS.md is stale.
- **D10 · low — Demo coverage of documented options:**
  - Launcher: `sources`, `hints`, `scope`, `maxResults`, `minQuery`. `sources` is the headline async feature.
  - Select: `actions` (plain), `renderNone`, `minQuery`, `listHeight`.
  - NumberField: `largeStep`, `precision`, `required`.
  - Checklist: `checkedKey`, `defaultChecked`, `height`, `hideLabel`.
  - Datebox: `min`, `max`.
  - DatePicker: `weekStart`.
  - FieldUpload: `multiple`, `params`, `headers`.
  - CodeEditor: `wrap`, `spellcheck`, `status`, `placeholder`, `disabled`.
  - CopyInput: `hideLabel`, `buttonTitle`, `feedbackDuration`.
  - TagPicker: `closeOnSelect`.
  - Slider: `hideLabel`.
  - AppIcon: `iconSize`.
  - Form: `novalidate`.
  - WorkspaceSwitcher: `placement`.
- **D11 · low — Calendar JSDoc** reads `this.options.locale` and `this.options.renderEvent`, which appear in neither `static defaults` nor the typedef.
- **D12 · low — copyButton docs** omit the actual default `kind: 'ghost'` (`copy-button.js:27`). CopyInput's `buttonTitle` names the same thing copyButton calls `title`.

---

## Cross-area overlaps noticed (not audited in depth)

- MenuButton lacks `toggle()` (the root of B1), and shares `menu-items.js` callback naming with ContextMenu (A10).
- Calendar's view side uses `jsEvent` in event details, while AppRail and EntityRef use `event`. Normalise the native-event key across the data/views area.
- AppSidebar, Card and Filter each hand-roll AbortControllers and `_message()` (R2, C5).
- `dropdown.js:292` has another `restoreAttribute` copy (R1). The visually-hidden copy is also in table, filter, kanban-view, module-bar and others (R12).
- ModuleBar imports `APP_ICON_TONES` and KanbanCard imports `AVATAR_TONES` (R7).

---

## Prioritised top 10

1. **Fix B1** (`AccountMenu.toggle()` throws). Add `MenuButton.toggle()` or implement it locally. Fix, 1-line.
2. **Fix B3** (Fieldset external components): make `externalAdapter` understand `get/set/enable/disable`. Fix.
3. **Fix B2** (double `change` from slider and code fields): stop native `change` in the adapters, or have Field ignore descendant events; make `code` emit on commit. Fix.
4. **Unify value accessors and `change` payloads** (A1 + A3): canonical `get()/set(v,{silent})` plus `value`, a guaranteed `detail.value`, `get()` on Select, and aliases for the rest. Additive.
5. **Make i18n consistent** (R2 + A12): one fallback-aware `msg` in `Component`; DateRange* stop bypassing `msg`; keys for AccountMenu, Datebox, FieldUpload, MultiValueEditor and CodeEditor; prefix Calendar keys. Mostly additive.
6. **Fix accessible names** (A7 + B4): an `ariaLabel`/`label` contract on Toggle, Search, TagPicker, Datebox, DateRangeBox, Timebox and Checklist; Field adapters pass the label to the focusable control. Additive.
7. **Extract shared internals**: `internal/menu-trigger` (R4), `internal/listbox-popup` (R5), `BinaryButton` for CheckButton/Toggle (R3), and `componentAdapter` for Field (R11). Non-breaking.
8. **Standardise enable/disable/readonly and overlay methods** (A2 + A8): `enable/disable/setDisabled/isDisabled` everywhere, `readonly` spelling, `open/close/toggle/isOpen` on every popup. Additive with aliases.
9. **Core hygiene**: snapshot/attribute helpers and `adoptTarget()` (R1); `debounce.cancel()` (R13); a `destroyed` getter (C3); a listener `scope()` (C5); date helpers in `core/date.js` (R8); a `tones` module (R7); `--zx-disabled-opacity` and `.zx-visually-hidden` (R12). Non-breaking; requires a spec that authorises `src/core/**` edits.
10. **Event semantics** (A4 + A5): honour DOM cancellation on every preventable event; rename FieldUpload `select` and split Search's debounced `input`, with aliases; normalise the `invalid` payload. Then fix the docs drift list (D1–D3 first). Aliases keep it non-breaking.
