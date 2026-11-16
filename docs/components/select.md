# Select — APG editable combobox

An APG editable combobox: a real text input, a top-layer listbox, and three filtering modes — none, local, and a function you supply.

Full reference: https://zx.zeyos.com/docs/llms.md · Live demo: https://zx.zeyos.com/docs.html#components/select · All components: https://zx.zeyos.com/docs/components/index.md

Unifies single-select, local filtering, and async loading.

- **Options** — `items: []`, `fixedItems: []`, optional `fixedLabel`, `valueKey: 'ID'` (string key or `(item)=>id`),
  `labelKey: 'name'` (string or `(item)=>string`), `renderItem`, `renderValue`,
  `renderValueAdornment`, `renderNone`, `noneLabel`, `actions`, `value`, `disabled`, `placeholder`,
  `label` (accessible combobox name; defaults to the placeholder or "Select"),
  `clearable: false`, `filter: false | 'local' | async (query)=>items`, `searchKeys`,
  `minQuery: 0`, `debounce: 200`, `listHeight: 280`, `groupKey`.
- **Getters** — `.value`, `.selected`.
- **Methods** — `get()` (the same as `.value`), `set(id, {silent})`, `setItems()`,
  `setFixedItems()`, `setActions()`, `reset()`, `open()`/`close()`, `enable()`/`disable()`,
  `focus()`.
- **Events** — `change {value, item}` (`item` is null on clear), preventable
  `action {id, action, query, select}`, `open`, `close`, `query {query}`, `loaded {items}`.
- **Fixed choices** — `fixedItems` pins entries to the top of the list, separated by a rule (the
  rule is dropped when `groupKey` is on, since a heading already divides them). They belong to the
  control, not to its data: a `filter` function replaces `items` on every query, while the pinned
  entries are narrowed locally against the same query and stay resolvable by `set()`. They survive
  `setItems()` and are shown below `minQuery`. Use them for choices with no row in the source —
  "Unassigned", "Everyone", "Private".
- **Presets** — `Select.priority(target, opts)` renders the five-level ZeyOS priority scale (values
  0–4) as grey signal bars filled to the level; only the highest is coloured, a danger square with
  "!". A "No priority" row (value null, message `priority.none`) heads the list and is the empty
  control's placeholder; `clearable: false` removes it, as does a `required` `zxselect` field with
  `preset: 'priority'`. `Select.status(target, opts)` supplies shape- and semantic-color-distinct workflow states
  and accepts replacement `items` (each `{ID, name, indicator, tone, description?, shortcut?}`);
  `Select.permission(target, {groups, value})` pins Private and
  Public above record-access groups. Its value is the tri-state ZeyOS stores (`false` private,
  `true` public, or a group ID), and `groups` takes an array or loader `(query)=>items`.
- **Glyphs** — `statusIcon(status, {tone?, indicator?, label?})` and `priorityIcon(level, {label?})`
  return the exact glyphs the two presets draw (`.zx-status-icon`, `.zx-priority-icon`; inside a
  Select they also carry `.zx-select__status-indicator` / `.zx-select__priority-icon`), for list
  rows, board columns, filter chips, and headings. Status ids: `backlog` (dotted ring), `todo`
  (empty ring), `in-progress` (ring with a centre dot), `in-review` or `review` (half filled),
  `ready` (a third filled), `waiting` (two thirds filled), `done` (filled, check), `canceled` or
  `cancelled` (filled, cross), `duplicate` (ring with a slash); a `Select.status` item object is
  accepted too, and an unknown id draws a muted empty ring. Indicators: `dotted`, `ring`,
  `progress`, `review`, `ready`, `waiting`, `done`, `canceled`, `duplicate`; tones: `muted`,
  `neutral`, `warning`, `info`, `accent`, `success`, `danger`. Priority levels: `null` (no
  priority, dashes), `0` lowest … `3` high (signal bars filled to the level), `4` highest (danger
  square with "!"). Both are decorative (`aria-hidden`) — always pair them with the status or
  priority as text, or a tooltip on the control holding them; `label` instead makes a standalone
  glyph `role="img"` with that name.
- **Entity preset** — `Select.entity(target, options)` renders icon/color, label, and secondary
  text using `iconKey`, `colorKey`, and `subtitleKey` (or `renderIcon`). `colorKey` takes a CSS
  colour or a token reference (`var(--zx-color-tone-blue-fg)`); without one the glyph is a neutral
  tile in muted ink. `recent` pins a deduplicated
  **Recent** section above ordinary/local/async results; `create: true|actionDescriptor` appends an
  application-owned command at the bottom without changing the selected ID. `recentLabel` and the
  ordinary Select options remain overridable. For schema-driven ZeyOS loading,
  `zeyosEntitySelect(client, resource, options)` and `buildZeyosEntitySelectConfig()` compose this
  preset from `@zeyos/zx/zeyos`; the core preset itself is backend-neutral.
- **Keyboard** (APG combobox) — ArrowDown/Alt+ArrowDown open; arrows navigate and wrap; Home/End;
  Enter selects; Esc closes; Tab closes; printable characters filter (editable) or run a typeahead
  (readonly). `aria-activedescendant` tracks the active option.
- **Appearance** — the highlighted option is a neutral step; a chosen option is a pick and keeps
  the accent tint and its check mark. Group labels are sentence-case captions. The focus ring
  follows keyboard focus: a click on a read-only input (no `filter`) does not draw it
  (`data-focus-origin="pointer"` on the root until the next key). Disabled, the whole control fades
  as a disabled Field does, and not a second time inside one.
- **Quiet fields** — inside `[data-zx-fields="quiet"]` the value reads as text: no border, fill,
  chevron or clear button until hover; full field chrome while focused or open.

## Select.locale()

`Select.locale(target, options)` returns an ordinary Select: each locale is named in its own language ("Deutsch") with the interface's
name for it beneath ("German"), and the flag of its region or a language chip before it. Names come
from `Intl.DisplayNames`, so no translation table ships. The value is the canonical BCP 47 tag
(`'de-AT'`); `set()` and `value` accept any spelling of a listed tag (`'de_at'`). Everything else —
keyboard map, events, `clearable`, `disabled`, `msg` — is Select's. Field type: `zxselect` with
`props.preset: 'locale'`.

The picker supplies locale names, not translations for the application. It emits `change` without
changing the active language. See the [Locales guide](https://zx.zeyos.com/docs.html#getting-started/locales)
for catalogues, message variables, formatting, and runtime language switching.

```js
Select.locale(el, { locales: ['en-GB', 'de', 'de-AT', 'fr'], value: 'de' });
```

- **Options** — `locales` (tags or `{code, name?, description?, region?}`; invalid tags are left
  out; a short list of common languages by default), `preferred: []` and `preferredLabel` (pinned
  above the list), `displayLocale` (default: the `lang` option, then `getLanguage()`),
  `display: 'both'|'native'|'localized'`, `flags: 'auto'|'emoji'|'code'|'none'|(region, item) => Node`,
  `flagUrl` (image template, `{code}`/`{CODE}`), `flagRegions` (`{ en: 'GB' }` — a language's flag
  when its likely region is not the one meant), `sort: false`, plus Select options. Message overrides
  retain the `localePicker.*` keys. A list longer
  than seven filters locally by native name, localized name, and tag.
- **Flags** — a full-tag `flagRegions` override wins, then the tag's own region (`de-AT` → Austria),
  then a language-level override, then the language's likely region (`Intl.Locale#maximize()`:
  `ja` → Japan). A locale with no country (`es-419`) shows
  its language chip. `flags: 'code'` shows chips throughout — the honest choice where a language is
  not a country.
- **Statics** — `Select.localeItems(locales, options)` returns the rows without the DOM;
  `canonicalLocale(tag)` canonicalizes one tag.

## Select.country()

`Select.country(target, options)` returns an ordinary Select: a filterable list of ISO 3166-1 countries, named in the interface's language by
`Intl.DisplayNames` and drawn with their flags. The value is the upper-case alpha-2 code (`'DE'`);
`set()` accepts either case. Search matches the name, the code, and the English name, so "Germany"
finds Deutschland in a German interface. Field type: `zxselect` with `props.preset: 'country'`.
Custom descriptions are searchable too. Its `displayLocale` names countries without changing the
application language; see the [Locales guide](https://zx.zeyos.com/docs.html#getting-started/locales).

```js
Select.country(el, { preferred: ['DE', 'AT', 'CH'], value: 'AT', clearable: true });
```

- **Options** — `countries` (codes or `{code, name?, description?}`; all of `COUNTRY_CODES` by
  default), `preferred: []` and `preferredLabel`, `displayLocale`, `flags`, `flagUrl`,
  `showCode: false`, `sort: true` (by name, with `Intl.Collator`), plus Select options. Message
  overrides retain the `countryPicker.*` keys.
- **Statics** — `Select.countryItems(countries, options)` returns the rows without the DOM.

## flag()

`flag(code, { kind, src, text, label })` draws one flag as a `.zx-flag` span — for a picker row, a
table cell, a profile. `kind: 'auto'` (default) draws the platform's flag emoji where it has them
(`supportsFlagEmoji()`) and a muted code chip where it does not (Windows); `'emoji'`, `'code'`, and
`'image'` force one. Zx ships no flag artwork: `src: '/flags/{code}.svg'` draws from any flag set
the application serves. Decorative (`aria-hidden`) unless `label` is given. Also exported:
`flagEmoji(code)`, `supportsFlagEmoji()`, and `COUNTRY_CODES`.
