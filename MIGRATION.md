# Migrating from `gx` to Zx

Zx replaces the MooTools-era `gx` UI libraries with dependency-free ES2022 modules. The
compatibility bundle lets mapped legacy code keep running while classes are migrated one at a
time. Compatibility constructors warn once per legacy class so remaining call sites are visible.

## Deployment script swap

For deployments that serve the old libraries directly from
`net.zeyon.lib.gx-3000/assets/`, copy `dist/zx.global.js`, `dist/zx-compat.global.js`, and
`dist/zx.css` into that asset directory. Replace:

```html
<link rel="stylesheet" href="/net.zeyon.lib.gx-3000/assets/gx.css">
<script src="/net.zeyon.lib.gx-3000/assets/gx-core.js"></script>
<script src="/net.zeyon.lib.gx-3000/assets/gx-zeyos.js"></script>
```

with this order:

```html
<link rel="stylesheet" href="/net.zeyon.lib.gx-3000/assets/zx.css">
<script src="/net.zeyon.lib.gx-3000/assets/zx.global.js"></script>
<script src="/net.zeyon.lib.gx-3000/assets/zx-compat.global.js"></script>
```

The compatibility entry exposes both `window.zx` and `window.gx`. Element
`store`/`retrieve`/`eliminate` is installed automatically. If the application uses `__()`, `_()`,
`String.prototype.htmlSpecialChars`, or `Array.prototype.findBy`, opt in after both scripts load:

```js
gx.compat.installGlobals();
```

Do not call this for newly migrated code; import `h`, `htmlEscape`, and the i18n helpers directly.

## Class-by-class replacements

The snippets show the normal direct-Zx replacement. All strings supplied as component content are
inserted as text; pass a DOM node when structured content is needed.

### `gx.zeyos.Toggle` → `zx.Toggle`

```js
// gx
const control = new gx.zeyos.Toggle(host, { on: true, value: 'enabled' });
control.addEvent('uncheck', () => save(false));

// Zx
const control = new zx.Toggle(host, { checked: true, value: 'enabled' });
control.on('change', (event) => save(event.detail.checked));
```

Use `get()`, `getValue()`, `set(boolean)`, and `toggle()` in place of
`getState()`, `setChecked()`, and `setUnchecked()`.

### `gx.zeyos.Msgbox` → `zx.Message`

```js
// gx
const messages = new gx.zeyos.Msgbox();
messages.show('Saved', 's_msg_32_success');

// Zx
const messages = new zx.Message(null, { timeout: 0 });
document.body.append(messages.el);
const handle = messages.show('Saved', { kind: 'success' });
```

Call `handle.close()` instead of `hide()`.

### `gx.bootstrap.Message` → `zx.Message`

```js
// gx
const messages = new gx.bootstrap.Message(host);
messages.addMessage('Saved', 'success', true);
messages.showStatus(40, 'Uploading');

// Zx
const messages = new zx.Message(host);
messages.show('Saved', { kind: 'success', closable: true });
const progress = zx.Message.progress('Uploading');
progress.update(40);
```

Use `progress.done()` or `progress.fail(message)` instead of `hideStatus()`.

### `gx.zeyos.Popup` and `gx.bootstrap.Popup` → `zx.Dialog`

```js
// gx (either Popup class)
const popup = new gx.zeyos.Popup({ width: 480, content: 'Details', overlayDismiss: true });
popup.show();

// Zx
const popup = new zx.Dialog(null, { size: 480, content: 'Details', lightDismiss: true });
popup.open();
```

Replace `show`/`hide` events and methods with `open`/`close`. Use CSS for custom positioning;
legacy `setPosition()` is only a warning-producing compatibility no-op.

### `gx.bootstrap.PopupAlert` → `zx.Dialog.alert`

```js
// gx
await gx.bootstrap.PopupAlert('Saved', 'The record was saved.');

// Zx
await zx.Dialog.alert({ title: 'Saved', message: 'The record was saved.' });
```

### `gx.bootstrap.PopupConfirm` and `PopupConfirmCanceled` → `zx.Dialog.confirm`

```js
// gx
const result = await gx.bootstrap.PopupConfirm('Delete', 'Delete this record?');
if (result !== gx.bootstrap.PopupConfirmCanceled) removeRecord();

// Zx
if (await zx.Dialog.confirm({ title: 'Delete', message: 'Delete this record?', danger: true })) {
  removeRecord();
}
```

### `gx.zeyos.Dialog` → `zx.Dialog` views

```js
// gx
const dialog = new gx.zeyos.Dialog(null, { title: 'Wizard' });
dialog.addFrame('review', { title: 'Review', content: reviewNode }, true);
dialog.openFrame('review');

// Zx
const dialog = new zx.Dialog(null, { title: 'Wizard' });
dialog.addView('review', { title: 'Review', content: reviewNode });
dialog.showView('review');
dialog.open();
```

Replace `addSubmitFrame`, `addFormFrame`, and `addSuccessFrame` with explicit views, `Form`
instances, and dialog button actions. Read form data with `form.getValues()`.

### `gx.zeyos.Dropdown` → `zx.MenuButton`

```js
// gx
const menu = new gx.zeyos.Dropdown(host, { items: { edit: 'Edit', remove: 'Remove' } });
menu.addEvent('change', (value) => run(value));

// Zx
const menu = new zx.MenuButton(null, {
  label: 'Actions',
  items: [{ value: 'edit', label: 'Edit' }, { value: 'remove', label: 'Remove' }],
  onselect: (event) => run(event.detail.value)
});
host.append(menu.el);
```

### `gx.bootstrap.MenuButton` → `zx.MenuButton`

```js
// gx
const menu = new gx.bootstrap.MenuButton(host, { label: 'Actions' });
menu.add('Edit').divider().add('Remove');

// Zx
const menu = new zx.MenuButton(host, {
  label: 'Actions', items: [{ label: 'Edit', value: 'edit' }, '-', { label: 'Remove', value: 'remove' }]
});
```

### `gx.zeyos.Select` and `gx.bootstrap.Select` → `zx.Select`

```js
// gx (either namespace)
const select = new gx.zeyos.Select(host, {
  data: rows, elementIndex: 'ID', elementLabel: 'name', allowEmpty: true
});
select.addEvent('select', (item) => save(item.ID));

// Zx
const select = new zx.Select(host, {
  items: rows, valueKey: 'ID', labelKey: 'name', clearable: true,
  onchange: (event) => save(event.detail.value)
});
```

Use `value`/`selected`, `set()`, `setItems()`, and `reset()`. A cleared selection is the same
`change` event with `{value: null, item: null}` rather than a separate `noselect` event.

### `gx.zeyos.SelectFilter` and `gx.bootstrap.SelectFilter` → local `zx.Select`

```js
// gx
const select = new gx.zeyos.SelectFilter(host, { data: rows, searchfields: ['name', 'code'] });

// Zx
const select = new zx.Select(host, { items: rows, filter: 'local', searchKeys: ['name', 'code'] });
```

### `gx.zeyos.SelectDyn` and `gx.bootstrap.SelectDyn` → async `zx.Select`

```js
// gx
const select = new gx.zeyos.SelectDyn(host, { url: '/people', queryParam: 'query' });

// Zx
const http = new zx.Http();
const select = new zx.Select(host, {
  filter: (query) => http.get('/people', { query }),
  onloaded: (event) => console.log(event.detail.items)
});
```

### `gx.bootstrap.SelectDynREST` → `zx.Select` + `zx.zeyosService`

```js
// gx
const select = new gx.bootstrap.SelectDynREST(host, { entity: 'contacts', limit: 20 });

// Zx
const contacts = zx.zeyosService('contacts');
const select = new zx.Select(host, {
  filter: (query) => contacts.get('', { search: query, limit: 20 })
});
```

### `gx.zeyos.SelectPrio` and `gx.bootstrap.SelectPrio` → `zx.Select.priority`

```js
// gx
const priority = new gx.zeyos.SelectPrio(host, { value: 2 });

// Zx
const priority = zx.Select.priority(host, { value: 2 });
```

### `gx.zeyos.Checklist` and `gx.bootstrap.Checklist` → `zx.Checklist`

```js
// gx (either namespace)
const list = new gx.zeyos.Checklist(host, { data: rows, listValue: 'ID', listFormat: 'name' });
list.setValues([1, 2]);

// Zx
const list = new zx.Checklist(host, { items: rows, valueKey: 'ID', labelKey: 'name' });
list.setValues([1, 2]);
```

For remote data pass `load: () => Promise<items>` and listen for `loaded`.

### `gx.zeyos.Permission` → `zx.Permission`

```js
// gx
const permission = new gx.zeyos.Permission(host, { value: true, groups });

// Zx
const permission = new zx.Permission(host, { value: 'public', groups });
permission.on('change', (event) => save(event.detail.value));
```

### `gx.zeyos.Table` and `gx.bootstrap.Table` → `zx.Table`

```js
// gx (either namespace)
const table = new gx.zeyos.Table(host, {
  cols: [{ id: 'name', label: 'Name', filterable: true }],
  structure: (row) => [row.name], data: rows
});

// Zx
const table = new zx.Table(host, {
  columns: [{ id: 'name', label: 'Name', sortable: true }],
  data: rows, rowId: 'ID'
});
```

Move `structure()` work into per-column `render(row, index)`. Replace `filter` events with `sort`
and `click`/`dblclick` with `rowclick`/`rowdblclick`; all payloads are in `event.detail`.

### `gx.ui.SimpleTable` → `zx.Table`

```js
// gx
const table = new gx.ui.SimpleTable({ cols: ['Name'] });
table.addRow({ ID: 1, name: 'Ada' });

// Zx
const table = new zx.Table(null, { columns: [{ id: 'name', label: 'Name' }], rowId: 'ID' });
table.addData([{ ID: 1, name: 'Ada' }]);
```

Use `setData`, `addData`, `updateRow`, `removeRow`, and `getData` for row operations.

### `gx.zeyos.Tabbox` and `gx.bootstrap.Tabbox` → `zx.Tabbox`

```js
// gx (either namespace; show is one-based)
const tabs = new gx.zeyos.Tabbox(host, { frames, show: 2 });
tabs.openTab('history');

// Zx
const tabs = new zx.Tabbox(host, { tabs, active: 'history' });
tabs.openTab('history');
```

Rename `frames` to `tabs`; each entry keeps `name`, `title`, and `content`. Use `setBadge()` in
place of `setHighlight()`.

### `gx.bootstrap.NavigationBar` → `zx.NavigationBar`

```js
// gx
const navigation = new gx.bootstrap.NavigationBar(host, { title: 'ZeyOS', frames, buttons });

// Zx
const navigation = new zx.NavigationBar(host, { title: 'ZeyOS', items: frames, actions: buttons });
```

### `gx.zeyos.Panel` → `zx.Panel`

```js
// gx
const panel = new gx.zeyos.Panel(host, 'Details', contentNode, true);

// Zx
const panel = new zx.Panel(host, { title: 'Details', content: contentNode, open: true });
```

### `gx.zeyos.MasterPanel` → `zx.MasterPanel`

```js
// gx
const panel = new gx.zeyos.MasterPanel(host, 'Contacts', contentNode, buttons);

// Zx
const panel = new zx.MasterPanel(host, { title: 'Contacts', content: contentNode, buttons });
```

### `gx.zeyos.Groupbox` → `zx.Groupbox`

```js
// gx
const group = new gx.zeyos.Groupbox(host, { title: 'Advanced', open: false });

// Zx
const group = new zx.Groupbox(host, { title: 'Advanced', open: false });
group.open();
```

### `gx.zeyos.Search` → `zx.Search`

```js
// gx
const search = new gx.zeyos.Search();
search.addEvent('keypress', () => load(search.get()));

// Zx
const search = new zx.Search(null, { onsubmit: (event) => load(event.detail.value) });
host.append(search.el);
```

### `gx.zeyos.Datebox` → `zx.Datebox` or `zx.DateTimeBox`

```js
// gx
const date = new gx.zeyos.Datebox(host, { timestamp, unit: 'seconds', format: ['d', '.', 'M', '.', 'y'] });

// Zx
const date = new zx.Datebox(host, { value: timestamp, format: '%d.%m.%Y' });
const timestampSeconds = date.get('seconds');
```

Use `zx.DateTimeBox(host, options)` when the legacy format included hours/minutes.

### `gx.zeyos.DatePicker` → `zx.DatePicker`

```js
// gx
const picker = new gx.zeyos.DatePicker(host, { date: initial, weeknumbers: true });

// Zx
const picker = new zx.DatePicker(host, { value: initial, showWeekNumbers: true });
```

### `gx.zeyos.MonthPicker` → `zx.MonthPicker`

```js
// gx
const picker = new gx.zeyos.MonthPicker(host, { date: initial });

// Zx
const picker = new zx.MonthPicker(host, { value: initial });
```

### `gx.zeyos.TimePicker` → `zx.TimePicker`

```js
// gx
const picker = new gx.zeyos.TimePicker(host, { date: initial, format: '%H:%M:%S' });

// Zx
const picker = new zx.TimePicker(host, { value: initial, seconds: true });
```

Direct picker `change` events carry `{date}` or `{time}`. Use `Date#getTime()` or the exported
date formatting helpers when a timestamp or formatted string is required.

### `gx.ui.Timebox`, `gx.zeyos.Timebox`, and `gx.bootstrap.Timebox` → `zx.Timebox`

```js
// gx (any namespace)
const duration = new gx.zeyos.Timebox(host, { time: -90, unit: 'minutes', prefix: true });

// Zx
const duration = new zx.Timebox(host, { value: -90, unit: 'minutes', signed: true });
```

Use `get(unit)`, `set(value, unit)`, `enable()`, and `disable()`.

### `gx.bootstrap.CheckButton` → `zx.CheckButton`

```js
// gx
const check = new gx.bootstrap.CheckButton(host, { label: ['On', 'Off'], value: true });

// Zx
const check = new zx.CheckButton(host, { label: ['On', 'Off'], checked: true });
check.on('change', (event) => save(event.detail.checked));
```

### `gx.bootstrap.Form` → `zx.Form`

```js
// gx
const form = new gx.bootstrap.Form(host, { horizontal: true, fields: legacyFields });

// Zx
const form = new zx.Form(host, {
  fieldsets: [{ fields: modernFields }],
  actions: [{ id: 'save', label: 'Save', type: 'submit', kind: 'primary' }]
});
```

Use `getValues`, `setValues`, `getField`, `setHighlights`, `reset`, and the preventable `submit`
event.

### `gx.bootstrap.Fieldset` → `zx.Fieldset`

```js
// gx
const fields = new gx.bootstrap.Fieldset(host, { title: 'Contact', fields: legacyFields });

// Zx
const fields = new zx.Fieldset(host, { title: 'Contact', columns: 2, fields: modernFields });
```

### `gx.bootstrap.Field` → `zx.Field`

```js
// gx
const field = new gx.bootstrap.Field({ type: 'text', label: 'Name', value: 'Ada' });
host.append(field.toElement());

// Zx
const field = new zx.Field(host, { id: 'name', type: 'text', label: 'Name', value: 'Ada' });
```

Legacy `gxselect`, date/month/time widgets, option lists, and custom HTML fields map to registered
Zx field adapters. Highlights use `danger`, `warning`, or `success`.

### `gx.bootstrap.ValueList` → `zx.ValueList`

```js
// gx
const values = new gx.bootstrap.ValueList(host, { deletable: true });
values.addValue('one');

// Zx
const values = new zx.ValueList(host, { deletable: true, sortable: true });
values.addValue('one');
```

### `gx.bootstrap.MultiValueEditor` → `zx.MultiValueEditor`

```js
// gx (JSON string)
const editor = new gx.bootstrap.MultiValueEditor(host);
editor.setValue('["one","two"]');

// Zx (array)
const editor = new zx.MultiValueEditor(host);
editor.setValues(['one', 'two']);
```

The compatibility wrapper deliberately preserves JSON-string `getValue()`/`setValue()` only for
unmigrated callers.

### `gx.bootstrap.FieldUpload` → `zx.FieldUpload`

```js
// gx
const upload = new gx.bootstrap.FieldUpload({ uploadurl: '/upload', inputname: 'document' });
host.append(upload.toElement());

// Zx
const upload = new zx.FieldUpload(host, { url: '/upload', paramName: 'document' });
```

Use `params`, `accept`, `maxSize`, `multiple`, and the `select`, `progress`, `success`, `error`, and
`abort` events.

### `gx.bootstrap.DataFilter` → `zx.DataFilter`

```js
// gx
const filter = new gx.bootstrap.DataFilter(host);
filter.addFulltextFilter('query', ['name', 'city']).initData(rows).doFilter();

// Zx
const filter = new zx.DataFilter(host, {
  data: rows,
  filters: [{ type: 'text', id: 'query', label: 'Search', fields: ['name', 'city'] }]
});
const visibleRows = filter.apply();
```

Use `setData`, `setState`, `getState`, `apply`, `clear`, and `addFilter`.

### `gx.zeyos.Client` → `zx.Http`

```js
// gx
const client = new gx.zeyos.Client({ url: '/api/' });
client.get('contacts', { active: true });

// Zx
const client = new zx.Http({ base: '/api/' });
await client.get('contacts', { active: true });
```

### `gx.zeyos.Request` → `zx.zeyosService`

```js
// gx
const request = new gx.zeyos.Request({ service: 'contacts', accesskey: token });
request.post('create', data);

// Zx
const request = zx.zeyosService('contacts', token);
await request.post('create', data);
```

`Http` uses promises and exposes `request`, `get`, `post`, `put`, and `delete`. Uploads use
`request(path, {method, files, data})`. Request failures reject; use `try`/`catch` or `onError`.

### `gx.zeyos.Factory` → `zx.button`, `zx.buttonGroup`, and `zx.icon`

```js
// gx
const save = gx.zeyos.Factory.Button('Save', 'primary', 'check');
const glyph = gx.zeyos.Factory.Icon('trash');

// Zx
const save = zx.button({ label: 'Save', kind: 'primary', icon: 'check' });
const glyph = zx.icon('trash');
```

## Intentionally not reproduced

- `gx.core.Settings` and `gx.ui.Container`: direct construction now throws. Use plain option
  objects and extend `zx.Component`; emulating the MooTools inheritance model would retain the
  coupling Zx removes.
- `gx.ui.Collapse` and `gx.ui.Blend`: compatibility names are migration-error stubs. Use CSS
  transitions guarded by `prefers-reduced-motion`; Zx does not reproduce `Fx.*` timing or the
  MooTools `Class`/`Fx` APIs.
- `gx.ui.Hud`: use `zx.Dialog` or `zx.Modal` so focus, Escape, and the top layer remain native.
- `gx.ui.Toggling`: use `zx.Toggle`, `zx.CheckButton`, `zx.Panel`, or direct ARIA/data state.
- `gx.ui.HGroup`: use application CSS grid/flex layout.
- `gx.ui.Templates`: use native `<template>`, `zx.h()`, or explicit renderer functions.
- Legacy bugs are fixed, not emulated: `MenuButton.setStyle`'s typo, the dead
  `MultiValueEditor` delete path, duplicate CheckButton `check`, the Request.File comma bug,
  Tabbox's wrong root, and `Request.delete()` sending PUT. Update tests that depended on those
  defects; `Http.delete()` sends DELETE.
- `_theme` class-map overrides, including `gx.ui.Table._theme`, are not supported. Override Zx
  semantic tokens or documented component selectors instead.
- Legacy atomic utility CSS and pixel-identical legacy styling are not shipped. Keep temporary
  app-owned utilities during migration, then replace them with layout CSS and semantic tokens.
- Fontello numeric glyph codes are not supported. Use the named icons accepted by `zx.icon()`.
- Full MooTools `getCoordinates()` objects are not emulated. Wrappers expose only
  `width`/`height`/`top`/`left`; migrated code should use `getBoundingClientRect()`.
- `dispatchEvents` is not reproduced. Use native `dispatchEvent()` or a component's `emit()` and
  listen for bubbling `zx-*` DOM events.
- `gx.Browser` is not reproduced. Prefer feature detection (`CSS.supports`, element/method
  presence, media queries) over browser-name branching.
