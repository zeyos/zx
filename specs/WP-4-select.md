# WP4 — Select family: Select, priority preset, Checklist, Permission

Branch: `wp4-select` from `main` (kernel + WP2/WP3 merged; if WP2/WP3 not yet on main, build
against kernel only and use plain buttons — orchestrator will confirm at kickoff).
Read `AGENTS.md`. Legacy reference: `../gx-zeyos/src/classes/{Select,Checklist,Permission}.js`,
`../gx-bootstrap/src/classes/Select.js`, demos in `../gx-zeyos/docs/demos/Select.demo.js`.

## Scope

```
src/components/select/select.js|css
src/components/select/filter.js          # pure matching logic (node-testable)
src/components/checklist/checklist.js|css
src/components/permission/permission.js|css
demos/components/{select,checklist,permission}.demo.js
tests/unit/select-filter.test.js
src/index.js styles/zx.css
```

## select.js — `class Select` (cssName `select`) — APG editable combobox

The unified successor of legacy Select / SelectFilter / SelectDyn / SelectDynREST.

```js
static defaults = {
  items: [],                 // array of objects or primitives
  valueKey: 'ID',            // string key or (item)=>id          ← legacy elementIndex
  labelKey: 'name',          // string key or (item)=>string      ← legacy elementLabel
  renderItem: null,          // (item)=>Node|string; default: label text ← elementLabel fn form
  renderValue: null,         // (item)=>string for the closed control  ← elementSelect
  value: null, disabled: false,
  placeholder: '',           // ← msg.noSelection
  clearable: false,          // ← allowEmpty/resetable (shows × and an empty row)
  filter: false,             // false | 'local' | async (query)=>items  ← Select/SelectFilter/SelectDyn
  searchKeys: null,          // for 'local': defaults [labelKey]        ← searchfields
  minQuery: 0, debounce: 200, listHeight: 280, groupKey: null,  // optional optgroup-style header
}
```

- Value/selection: `sel.value` getter (id) — assignment `sel.value = id` allowed;
  `sel.selected` getter (item object or null); `set(idOrItem, {silent})`, `setItems(items)`,
  `reset({silent})`, `open()`, `close()`, `enable()`, `disable()`, `focus()`.
- Events: `change {value, item}` (item null on clear — covers legacy `noselect`), `open`,
  `close`, `query {query}` (fires around async loads), `loaded {items}`.
- Async filter: debounce, cancel stale requests (ignore out-of-order resolutions), loading
  spinner state in the control, empty-state row ("No matches" via msg key `select.empty`).
- Markup/ARIA (APG combobox with list autocomplete): closed control shows current label; when
  `filter` is falsy the input is readonly-combobox behavior (arrows/typeahead only), else
  editable input. `role="combobox"`, `aria-expanded`, `aria-controls`, `aria-autocomplete`,
  option list `role="listbox"`/`role="option"` with `aria-selected`,
  `aria-activedescendant` (no DOM focus in list). Panel via WP3 Dropdown (or position() directly
  if Dropdown unavailable on branch — prefer Dropdown).
- Keyboard: ArrowDown/Alt+ArrowDown open; Arrow navigation with wrap; Home/End; Enter select;
  Esc close-restore; Tab close+keep; printable chars filter (editable) or typeahead (readonly).
- `filter.js` (pure): `matchItems(items, query, keys)` — case/diacritic-insensitive substring,
  multi-word AND; exported for unit tests.
- Static preset: `Select.priority(target, opts)` → Select with fixed 5 items (value 0..4,
  labels via msg keys `priority.lowest..highest`, colored square icon per level using semantic
  danger/warning/success colors — no raw colors).

## checklist.js — `class Checklist` (cssName `checklist`)

Searchable multi-check list (successor of both legacy Checklists).
`defaults: { items:[], valueKey:'ID', labelKey:'name', checkedKey:'on', search:true,
height:280, defaultChecked:false, load:null /* async ()=>items */ }`.
Methods: `setItems(items)`, `getValues() -> id[]`, `setValues(ids)`, `checkAll()/uncheckAll()`,
`search(query)`, `reload()`. Events: `change {values}`, `loaded`.
Markup: search input (WP2 Search if available, else plain input) + scrollable list of native
checkboxes with labels; group `role="group"` + label. Filtering reuses `filter.js`.

## permission.js — `class Permission` (cssName `permission`)

ZeyOS record-permission widget (owner/public/private/group).
`defaults: { value:true /* true='public'|false='private'|groupId */, groups:[],
groupsValueKey:'ID', groupsLabelKey:'name' }`.
Renders: radio-style choice Private / Public / Group, group choice enabling an embedded Select
of `groups`. Methods: `get() -> 'private'|'public'|groupId`, `set(value)`. Event:
`change {value}`. Msg keys `permission.private/public/group`.

## Demos

- select: readonly select (100 static items), local filter, async filter (fake fetch with
  latency + AbortController demo), clearable, custom renderItem (avatar-ish row), priority
  preset, disabled; event log incl. query events. Include a 1,000-item local-filter case to
  show it stays snappy.
- checklist: static list with search + select-all buttons; async load variant.
- permission: bound to a fake group list; log changes.

## Acceptance criteria

1. `npm test` green (filter matcher: case, diacritics, multi-word; stale-response ordering unit
   test if the resolution guard is pure enough — otherwise demo-verify).
2. Full APG combobox keyboard map manually verifiable in demo; `aria-activedescendant` updates.
3. Async: typing fast never shows out-of-order results (demo has artificial jitter).
4. Light/dark × density clean; list scroll keeps active option visible (scrollIntoView block:'nearest').
5. Double create/destroy clean incl. open-state destroy (no orphan panels).
6. Committed on `wp4-select`.

## Out of scope

Field adapters (WP7b); REST coupling (compat WP10 builds SelectDynREST on zeyosService); Table.
