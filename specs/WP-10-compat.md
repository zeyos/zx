# WP10 — gx compatibility layer

Branch: `wp10-compat` from `main` (requires all component WPs merged). Read `AGENTS.md`.
Legacy sources are the specification — read them: `../gx-core/src/gx.{js,core.js,ui.js,util.js}`,
`../gx-core/src/classes/*.js`, `../gx-zeyos/src/classes/*.js`, `../gx-bootstrap/src/classes/*.js`,
usage examples `../gx-zeyos/docs/demos/*.demo.js`, `../gx-bootstrap/docs/demos/*.demo.js`.

Goal: legacy app code written against gx runs on Zx after swapping script tags — for the API
surface listed below. 100% coverage of quirks is NOT the goal; the mapped surface must be solid.

## Scope

```
src/compat/index.js            # assembles window-independent `gx` namespace object + install()
src/compat/base.js             # Settings/Container emulation base wrapper
src/compat/globals.js          # installGlobals(): __(), String.htmlSpecialChars, Element
                               # store/retrieve shim, Array.findBy
src/compat/map/*.js            # one file per legacy class (grouped by family is fine)
demos/compat.html              # standalone page: loads styles + ESM compat build, runs legacy
                               # snippets ported from legacy docs demos
tests/unit/compat-options.test.js   # option/event translation tables (pure)
src/compat-entry.js            # entry that esbuild will later bundle as zx-compat.global.js:
                               # imports zx + compat, assigns window.gx (+ window.zx), calls
                               # nothing else automatically except Element store/retrieve shim
```

## base.js — legacy wrapper base

`class GxWrapper` provides MooTools-flavored surface around a wrapped Zx component (`this._zx`):
- `addEvent(type, fn)` / `removeEvent` / `fireEvent(type, args)` — translates names via the
  per-class event map; handlers receive LEGACY positional arguments (map declares
  `(detail) => [args...]`).
- `setOptions/setOption`, `options` object (translated names kept in sync one-way at construct
  time; later setOption maps through when a setter exists, else warns once).
- `toElement()`, `display(key)` (per-class `_ui` key → zx refs map; unmapped → root),
  `destroy()`.
- Element back-pointer: root element registered so `el.retrieve('com')` returns the wrapper
  (via the store/retrieve shim below).
- `.act` mirroring where legacy CSS/tests rely on it (per-class: mirror open/checked/selected
  state onto the legacy-equivalent element as class `act`).

## globals.js — `gx.compat.installGlobals()` (explicit opt-in) + always-on shims

Always installed by compat-entry: `Element.prototype.store/retrieve/eliminate` (WeakMap-backed,
only if not already present — MooTools absent in v2 world).
`installGlobals()` additionally: `window.__ = parse` (legacy object-literal → DOM: `tag`,
`html` (via h.raw), `styles`, `classes`, `child/children`, `onXxx` events, gx objects via
toElement — reimplement `gx.util.Parse` semantics on top of h()), `String.prototype.
htmlSpecialChars`, `Array.prototype.findBy`, `window._` passthrough to i18n translate (only if
`window._` undefined).

## Namespace & class map (map/*.js)

`gx.core.Settings` / `gx.ui.Container` — minimal functional emulations for app subclassing are
OUT of scope; export stubs that throw with a clear migration message when constructed directly.
`gx.util` — real implementations: `initValue, initNum, formatTime, getMinutes, formatNum,
getNumber, printf, parseResult, Parse (=== __ impl), isArray/isObject/isFunction/isString/
isNumber/isElement/isNode, Console` (→ console).

Wrappers (constructor signatures are legacy; each maps options/methods/events per the legacy
source of truth):

| Legacy | Zx | Key mappings |
|---|---|---|
| gx.zeyos.Toggle(display, opts) | Toggle | opts `on`→checked, `value`; ev `check/uncheck`←change filtered; methods getState/getValue/toggle/setChecked/setUnchecked; `.act` mirror |
| gx.zeyos.Msgbox | Message inline/static | `show(msg, class)` — `s_msg_32_*` class → kind; hide() |
| gx.bootstrap.Message(display, opts) | Message | addMessage(msg, iconClass, closable,…)→Message.show kind map info/error/success; showStatus/incProgress/setProgress/hideStatus→Message.progress |
| gx.zeyos.Popup(opts) | Dialog | width, closable, overlayDismiss→lightDismiss, content; show/hide→open/close; ev show/hide←open/close; setContent/setPosition(noop warn) |
| gx.bootstrap.Popup(opts) + PopupAlert/PopupConfirm | Dialog + statics | maps incl. onOk veto→preventable close; PopupConfirmCanceled sentinel preserved |
| gx.zeyos.Dialog(display, opts) | Dialog views | addFrame/addSubmitFrame/addFormFrame/addSuccessFrame/openFrame→addView/showView (+submit wiring); getFormValues |
| gx.zeyos.Dropdown(display, opts) | MenuButton | items object→items[]; ev change(value, text, this); getSelected/getValue/reset; compact/upside→placement |
| gx.bootstrap.MenuButton | MenuButton | entries/add()/divider; setLabel/setStyle(fixed) |
| gx.zeyos/bootstrap.Select(display, opts) | Select | elementIndex→valueKey, elementLabel→labelKey/renderItem, elementSelect→renderValue, allowEmpty/resetable→clearable, msg.noSelection→placeholder; ev select→change(item, this), noselect→change null; methods set/setId/getId/getValue/getSelected/setData/reset/enable/disable/show/hide |
| SelectFilter | Select filter:'local' | searchfields→searchKeys, height→listHeight |
| SelectDyn | Select filter:async | url/method/queryParam/requestData/parseDefault → async fn built on Http; ev requestSuccess/requestFailure←loaded/error |
| SelectDynREST | Select filter:async | entity/limit via zeyosService(entity) listQuery-style GET; requestData merge |
| SelectPrio | Select.priority | — |
| gx.zeyos/bootstrap.Checklist(display, opts) | Checklist | listValue→valueKey, listFormat→labelKey fn, listActive→checkedKey, url/method/requestData→load fn; getValues/setValues/reset/search; ev complete/failure←loaded/error |
| gx.zeyos.Permission | Permission | value/groups; get/set |
| gx.zeyos.Table / gx.bootstrap.Table (display, opts) | Table | cols[{label,id,width,filter,filterable}]→columns (+sort init from filter/mode), structure(row,i)→per-row render adapter (legacy structure returns array of cell contents/objects → map to columns render), data; setData/addData/empty/setSort/getFilter; ev click→rowclick(row… legacy args (data, row, event)), dblclick, filter←sort, complete←datachange |
| gx.ui.SimpleTable(opts) | Table | cols/structure dialect; createRow/addRow/updateRow/removeRow/getRows→data API |
| gx.zeyos.Tabbox / gx.bootstrap.Tabbox(display, opts) | Tabbox | frames[{name,title,content}]→tabs, show→active(1-based index→name), height; addTab/closeTab/openTab/setTabTitle/setHighlight→setBadge; ev change(name) |
| gx.bootstrap.NavigationBar | NavigationBar+Tabbox | frames+title+buttons→items/title/actions |
| gx.zeyos.Panel(display, title, content, open) | Panel | positional adapter |
| gx.zeyos.MasterPanel(display, title, content, buttons) | MasterPanel | positional adapter |
| gx.zeyos.Groupbox(display, opts) | Groupbox | title/open; toggle/open/close/isOpen; `.act` on header |
| gx.zeyos.Search() | Search | get(); ev input/keypress/click |
| gx.zeyos.Datebox(display, opts) | Datebox | timestamp+unit→value, format array→format string (map d/M/y/h/i tokens→%d/%m/%Y/%H/%M), month names; set(ts, unit)/get(unit); ev update←change |
| gx.zeyos.DatePicker/TimePicker/MonthPicker | Datebox/variants | date, format '%a %d.%m.%Y %H:%M'→supported subset (%a display ok), return_format '%s'→get('seconds'); ev select←change |
| gx.ui/zeyos/bootstrap.Timebox(display, opts) | Timebox | time/unit/seconds/prefix→signed; set/get(unit, precision)/enable/disable; ev change/disabled |
| gx.bootstrap.CheckButton | CheckButton | label array [on,off]; get/toggle/check/uncheck/set/setDisabled; ev change(bool)+check/uncheck correctly split (fixes legacy) |
| gx.bootstrap.Form/Fieldset/Field | Form/Fieldset/Field | horizontal→layout, type map incl. gxselect→zxselect, date/month/time widgets, optionlist, html; getValue(s)/setValue(s)/getField/setHighlights (type map error/success/warning→danger/success/warning)/reset |
| gx.bootstrap.ValueList | ValueList | deletable; addValue/getValues/setValues/enable/disable |
| gx.bootstrap.MultiValueEditor | MultiValueEditor | JSON-string getValue/setValue preserved here |
| gx.bootstrap.FieldUpload | FieldUpload | uploadurl→url, inputname→paramName, params, imageurl→preview src, parseResponse/showError hooks |
| gx.bootstrap.DataFilter | DataFilter | addSelectFilter/addFulltextFilter/addCustomElement/initData/doFilter/clearFilter/getFilter; ev filtered←filter(rows) |
| gx.zeyos.Client / gx.zeyos.Request | Http/zeyosService | url/service/accesskey; post/get/put/delete/send/upload(files)/openLink; FIX: delete sends DELETE; ev request/complete/failure/success/error/exception mapped from promise lifecycle |
| gx.zeyos.Factory | button()/icon() | Icon(name)→icons map (legacy glyph names), Button(text,type,ico,opts)→button(); ButtonsGroup→buttonGroup |
| gx.ui.Collapse/Blend/Hud/Toggling/HGroup/Templates | — | stubs throwing migration errors listing the Zx replacement (CSS/Panel/Dialog/…)|

Every wrapper: console.warn ONCE per class on first construction:
"gx.<ns>.<Class> is running on the Zx compat layer — migrate to zx.<Class>".

## Intentionally not reproduced (must be in README migration guide)

Legacy bugs (MenuButton.setStyle typo, MVE dead delete, CheckButton double-`check` event,
Request.File comma bug, Tabbox root bug, Request.delete→PUT); Fx.* API/timing; `_theme` class-map
overrides; atomic utility CSS classes; Fontello glyph codes; getCoordinates full field set
(subset width/height/top/left provided on wrappers); dispatchEvents; gx.Browser.

## demos/compat.html

No-build page: `<script type="module">` importing `../src/compat-entry.js`; then classic inline
script using ONLY legacy API: port 5 legacy demo snippets nearly verbatim (Select+SelectDyn from
Select.demo.js with fetch-stubbed url, Table.demo.js, Tabbox, Toggle+Msgbox, a Form with
gxselect+date fields). Visible pass/fail note per snippet (try/catch wrapper).

## Acceptance criteria

1. `npm test` green (translation tables: option renames, event arg shapes, Datebox format-array
   conversion, tab index→name resolution).
2. compat.html: all 5 ported legacy snippets run without errors and are interactive; `.act`
   appears on active tab/toggle/groupbox elements (inspect).
3. `el.retrieve('com')` returns wrapper; `__()` builds a tree with events after installGlobals().
4. One deprecation warning per class, not per instance.
5. Committed on `wp10-compat`.

## Out of scope

Pixel-parity with legacy CSS; MooTools Class/Fx emulation; gx.ui.Table `_theme` support.
