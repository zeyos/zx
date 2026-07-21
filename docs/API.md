# Zx API reference

Generated from source; see each component's `src/components/<name>/` and `specs/WP-*.md` for full
detail. Every component is `new Component(target, options)` where `target` is an `Element`, a
selector string, or `null` (component creates and owns its root). Subscribe with `.on(type, fn)`
or an `on<type>` function option; handlers get a `CustomEvent` whose `detail` is an object. Call
`.destroy()` to clean up. Events below are the component-level names (also dispatched on the root
element as `zx-<name>`, bubbling).

## Inputs

### `button(options)` → `HTMLButtonElement`, `buttonGroup(buttons)` → element
Factory (not a class). `{ label, icon, kind: 'default'|'primary'|'danger'|'ghost', size: 'md'|'sm', disabled, title, onclick }`.

### `CheckButton`
Options: `label: '' | [onLabel, offLabel]`, `checked: false`, `icon: true`, `disabled: false`.
Methods: `get()`, `set(checked, {silent})`, `toggle()`, `setLabel()`, `enable()`/`disable()`. Events: `change {checked}`.

### `Toggle`
Options: `checked: false`, `value: true`, `label: null`, `disabled: false`.
Methods: `get()`, `set()`, `toggle()`, `getValue()`, `enable()`/`disable()`. Events: `change {checked, value}`. (`role="switch"`.)

### `Search`
Options: `placeholder`, `value`, `clearable: true`, `debounce: 250`.
Methods: `get()`, `set()`, `focus()`, `clear()`. Events: `input {value}` (debounced), `submit {value}`, `clear`.

### `Select` (APG combobox)
Options: `items: []`, `valueKey: 'ID'`, `labelKey: 'name'`, `renderItem`, `renderValue`, `value`, `disabled`, `placeholder`, `clearable: false`, `filter: false | 'local' | async (q)=>items`, `searchKeys`, `minQuery: 0`, `debounce: 200`, `listHeight: 280`, `groupKey`.
Getters: `.value`, `.selected`. Methods: `set(id, {silent})`, `setItems()`, `reset()`, `open()`/`close()`, `enable()`/`disable()`, `focus()`. Events: `change {value, item}`, `open`, `close`, `query {query}`, `loaded {items}`. Preset: `Select.priority(target, opts)`.

### `Checklist`
Options: `items`, `valueKey: 'ID'`, `labelKey: 'name'`, `checkedKey: 'on'`, `search: true`, `height: 280`, `defaultChecked: false`, `load: async ()=>items`.
Methods: `setItems()`, `getValues()`, `setValues()`, `checkAll()`/`uncheckAll()`, `search()`, `reload()`. Events: `change {values}`, `loaded`.

### `DatePicker` (APG grid)
Options: `value: Date|null`, `min`, `max`, `weekStart: 1`, `showWeekNumbers: false`, `time: false`.
Methods: `get()`, `set()`, `focus()`. Events: `change {date}`, `monthchange {year, month}`.

### `MonthPicker`
Options: `value`. Methods: `get()`, `set()`. Events: `change {date}`.

### `TimePicker`
Options: `value: null`, `seconds: false`, `step: 5`. Methods: `get()`, `set()`. Events: `change`.

### `Datebox`, `DateTimeBox`
Options: `value: Date|number|string`, `format: '%d.%m.%Y'`, `time: false`, `min`, `max`, `placeholder`, `clearable: true`, `disabled`.
Methods: `get(unit='date')` (`'seconds'` → unix), `set()`, `open()`/`close()`, `enable()`/`disable()`, `focus()`. Events: `change {date}`, `invalid {text}`, `open`, `close`. `DateTimeBox(target, opts)` = `Datebox` with `time: true`.

### `Timebox`
Options: `value: 0`, `unit: 'minutes'|'seconds'|'hours'`, `seconds: false`, `signed: false`, `disabled`.
Methods: `get(unit)`, `set(value, unit?, {silent})`, `enable()`/`disable()`. Events: `change {value}`. Also exports pure `splitTime`, `joinTime`.

## Overlays

### `Message`
Options (per message): `kind: 'info'`, `timeout: 4000`, `closable: true`, `maxVisible: 5`.
Statics (floating toasts): `Message.info/success/warning/error(msg, opts)`, `Message.show(msg, {kind, timeout, closable})` → `{close()}`, `Message.progress(text)` → `{update(pct, text?), done(), fail(text?)}`. Instance: `new Message(target)` for an inline area with the same `.show()`.

### `Modal`
Options: `content`, `width: 'auto'`, `closable: true`, `lightDismiss: false`, `destroyOnClose: false`.
Methods: `open()`, `close(result?)`, `setContent()`, `isOpen()`. Events: `open`, `close {result}`, `cancel` (Esc; preventable). Built on native `<dialog>`.

### `Dialog` (extends `Modal`)
Options: `title`, `size: 'sm'|'md'|'lg'|number`, `buttons: [{ label, kind, action: 'close'|'cancel'|fn, autofocus }]`, `closable: true`.
Methods: `setTitle()`, `setContent()`, `setButtons()`, `addView(key, {content, buttons?})`, `showView(key)`. Statics (Promises): `Dialog.alert({title, message})`, `Dialog.confirm({title, message, danger})` → boolean, `Dialog.prompt({title, message, value})` → string|null.

### `Dropdown`
Constructor `(anchor, options)`. Options: `content`, `placement: 'bottom-start'`, `offset: 4`, `matchWidth: false`, `openOn: 'click'|'manual'`, `closeOnSelect: false`.
Methods: `open()`, `close()`, `toggle()`, `isOpen()`, `setContent()`, `getPanel()`. Events: `open`, `close`.

### `MenuButton` (APG menu)
Options: `label`, `icon`, `kind`, `items: [{ label, icon?, value?, disabled?, danger?, onselect? } | '-']`, `placement`.
Methods: `setItems()`, `open()`, `close()`, `setLabel()`. Events: `select {value, item}`, `open`, `close`.

## Data

### `Table`
Options: `columns: [{ id, label, sortable?, width, align, render?, sortValue?, headerTitle? }]`, `data`, `rowId: 'ID'`, `sort: { id, dir }`, `sortMode: 'local'|'server'`, `selectable: false|'single'|'multi'`, `stickyHeader: true`, `height`, `emptyText`, `rowClass`, `zebra: true`.
Methods: `setData()`, `addData()`, `updateRow(id, row)`, `removeRow(id)`, `getRow(id)`, `getData()`, `empty()`, `setSort(id, dir)`, `getSelection()`, `setSelection(ids)`, `clearSelection()`, `setLoading(bool)` (busy/skeleton state; auto-cleared by `setData`). Events: `rowclick {row, id, index, event}`, `rowdblclick`, `sort {id, dir}`, `selectionchange {rows, ids}`, `datachange {rows}`. Pure exports: `sortRows`, `createComparator`.

### `DataFilter`
Options: `filters: [{ type: 'select'|'text'|'custom', id, label, field(s)|get, options?, predicate? }]`, `data`, `autoApply: true`, `clearLabel`.
Methods: `setData()`, `apply()` → rows, `clear()`, `getState()`, `setState()`, `addFilter()`. Events: `filter {rows, state}`. Pure exports: `applyFilters`, `matchesText`.

## Forms

### `Field` (+ registry)
Options: `id`, `type: 'text'`, `label`, `description`, `value`, `placeholder`, `required`, `disabled`, `options`, `layout: 'stack'|'inline'`, `props: {}`. Built-in types: text, password, textarea, checkbox, int, float, select, optionlist, hidden, html + widget types (zxselect, checklist, date, month, datetime, time, valuelist, multivalueeditor, upload, toggle).
Methods: `getValue()`, `setValue()`, `focus()`, `reset()`, `setDisabled()`, `setHighlight(msg, kind)`, `clearHighlight()`, `getInput()`, `own(child)`. `Field.register(type, adapter)`, `Field.has(type)`. Events: `change {value}`, `invalid {message}`.

### `Fieldset`
Options: `title`, `columns: 1|2|3`, `fields: { id: Field options }`.
Methods: `addField(id, opts)`, `getField()`, `hasField()`, `getFields()`, `getValues()`, `setValues()`, `getValue()`, `setValue()`, `reset()`, `clear()`, `focus(id)`, `setHighlights()`, `clearHighlights()`.

### `Form`
Options: `fieldsets: []`, `actions: []`, `novalidate: true`.
Methods (proxy across fieldsets): `getValues()`, `setValues()`, `getField()`, `setValue()`, `getValue()`, `reset()`, `setHighlights()`, `clearHighlights()`, `addFieldset()`, `setActions()`, `submit()`. Events: `submit {values}` (preventable), `invalid {errors}`, `change {id, value}`.

### `ValueList`
Options: `values: []`, `placeholder`, `deletable: true`, `sortable: true`, `unique: true`, `validate: (str)=>bool|string`.
Methods: `getValues()`, `setValues()`, `addValue()`, `removeValue()`, `focus()`, `enable()`/`disable()`. Events: `change {values}`, `add {value}`, `remove {value}`.

### `MultiValueEditor`
Options: `values`, `options`, `addLabel`. Methods: `getValues()`, `setValues()`. Events: `change {values}`.

### `FieldUpload`
Options: `url`, `paramName: 'upload'`, `params`, `headers`, `multiple: false`, `accept`, `maxSize`, `autoUpload: true`, `preview: true`, `http`.
Methods: `upload(files?)`, `abort()`, `clear()`, `setDisabled()`. Events: `select {files}`, `progress {percent}`, `success {response}`, `error {error}`, `abort`.

### `Permission`
Options: `value: true|false|groupId`, `groups: []`, `groupsValueKey: 'ID'`, `groupsLabelKey: 'name'`.
Methods: `get()` → `'private'|'public'|groupId`, `set(value)`. Events: `change {value}`.

## Layout

### `Groupbox`
Options: `title`, `open: true`. Methods: `open()`, `close()`, `toggle()`, `isOpen()`, `setTitle()`, `setContent()`. Events: `open`, `close`. (Native `<details>`.)

### `Panel`
Options: `title`, `content`, `open: true`, `collapsible: true`, `footer`. Methods: `setTitle()`, `setContent()`, `setFooter()`, `open()`/`close()`/`toggle()`, `isOpen()`. Events: `open`, `close`.

### `MasterPanel`
Options: `title`, `content`, `buttons: []`, `module: <ZeyOS module name → accent token>`, `footer`. Methods: `setTitle()`, `setContent()`, `setButtons()`, `setFooter()`.

### `Tabbox` (APG tabs)
Options: `tabs: [{ name, title, content, closable?, disabled? }]`, `active`, `keepAlive: true`.
Methods: `addTab()`, `removeTab()`, `openTab(name)`, `getActive()`, `setTitle()`, `setBadge(name, text|null)`, `enableTab()`/`disableTab()`. Events: `change {name, previous}` (preventable), `close {name}`.

### `NavigationBar`
Options: `title`, `items: [{ name, title, badge? }]`, `active`, `actions: []`.
Methods: `setTitle()`, `setItems()`, `setActive()`, `setBadge()`, `setActions()`. Events: `change {name}`.

## Core

- `Component` — base class: `on/off/once/emit`, `listen`, `toElement`, `msg`, `destroy`, static `from(el)`.
- `h(tag, props, ...children)`, `h.raw(html)`, `htmlEscape`, `resolveElement`.
- `icon(name, {size, label})`, `icons` — Font Awesome Free solid, inline SVG.
- `position(anchor, floating, {placement, offset, flip, matchWidth})` → `{update, destroy}`.
- `Http`, `zeyosService(service, accesskey, opts)`, `parseResult(json)` — minimal built-in helpers for ad-hoc ZeyOS `remotecall`. For ZeyOS business data prefer the dedicated **`@zeyos/client`** library (see the skill's "Talking to ZeyOS" section).
- i18n: `setTranslator`, `setLanguage`, `getLanguage`, `translate`, `printf`.
- dates: `formatDate(d, fmt)`, `parseDate(s, fmt)` (tokens `%d %m %Y %y %H %M %S %a %A %b %B %s`), `clampDate`, `isSameDay`, `addDays`, `addMonths`, `getWeekStart`.
- keyboard: `focusTrap`, `rovingTabindex`, `typeahead`. utils: `debounce`, `uid`, `deepMerge`, `isElement`, `clamp`, `toArray`.
- `defineElements(prefix='zx')` — declarative `<zx-*>` custom elements.
