# WP14 — zx-zeyos foundation: field-type mapping, query bridge, wiring

Branch: `wp14-zeyos-core` from `main`. Read `AGENTS.md` and `docs/llms.md` first.

Goal: a small **optional binding layer** between Zx and the dedicated ZeyOS client `@zeyos/client`
that lets applications drive Zx components from ZeyOS schema metadata and the ZeyOS query model.
This WP is the pure, testable foundation; WP15 builds the DOM generators on top.

## Architecture (critical)

- Lives under `src/zeyos/` and is a **separate entry** — it must NOT be imported by
  `src/index.js` (the zero-dependency core surface). Zx core stays zero-dependency.
- **Injection-based**: functions receive a `@zeyos/client` **instance** (the app creates it);
  this module must NOT `import '@zeyos/client'`. It only uses the injected client's public API
  (`client.schema.*`, `client.api.*`). This keeps the module itself dependency-free.
- May import from Zx core (`../index.js`) for `Message`, i18n, etc.

## Reference material (read-only, discover exact shapes)

The client lives at `/Users/peter/htdocs/zeyos/client`. Inspect it to learn the exact
introspection API and field-metadata shape — do not guess:
- `src/runtime/schema.js` (`createSchema` → `resources()`, `fields(resource)`, `describe(...)`,
  `enums(...)`, `operationIds()`, `validate(...)`); confirm what `fields()`/`describe()` return
  and where per-field **type** info lives (the generated `src/generated/schema.js` has DB column
  types like `bigint`, `numeric`, `t_entity`, `boolean`, `text`, `character varying(N)`, `text[]`;
  richer semantic `format`s such as `money`, `priority`, `progress`, `date`, `datetime`, `email`,
  `tel`, `url`, `percent`, `entity`, `list`, `checked` appear in `openapi/api.json`). Use whichever
  metadata is reliably reachable from a client instance; prefer semantic format when available,
  else fall back to DB type.
- `okf/concepts/*.md` — the query gotchas you MUST encode: `filters-vs-filter` (use `filters`
  plural for FK fields), `dates-unix-seconds` (all timestamps are Unix seconds), `enums`
  (priority/status values), `null-empty-missing`, `counting-and-sums` (count server-side, no SUM).
- `samples/crm/js/api.js` — real usage: dot-notation joins (`contact.email`), field aliasing,
  fulltext `query`, `limit`/`offset`, `visibility: 0`.

## Scope

```
src/zeyos/schema.js      # field metadata → Zx field/column descriptors
src/zeyos/query.js       # Zx state → ZeyOS query params
src/zeyos/connect.js     # wiring helper
src/zeyos/index.js       # public exports of the binding
tests/unit/zeyos-schema.test.js
tests/unit/zeyos-query.test.js
```

## schema.js — field-type → widget mapping

A registry + resolver mapping ZeyOS field metadata to Zx configuration.

```js
// Map one ZeyOS field's metadata to a Zx Field descriptor (for zeyosForm) and to a Table column
// descriptor (for zeyosTable). Pure: takes field metadata, returns plain config objects.
export function fieldToZxField(meta)   // -> { id, type, label, props?, required?, ... }
export function fieldToZxColumn(meta)  // -> { id, label, sortable, align?, render? , sortValue? }
export function resolveFields(client, resource, opts)
   // -> ordered array of normalized field metadata for `resource`, honoring
   //    opts.fields (curated allow-list, in order) / opts.exclude; pulls types from client.schema.
export const TYPE_MAP  // ZeyOS type/format -> { field, column } strategy; extensible via register()
export function registerFieldType(typeOrFormat, strategy)
```

Mapping (best-effort, document each choice in JSDoc):
- `t_entity` / `entity` (FK reference) → Field `zxselect` bound to the referenced resource
  (WP15 supplies the async loader; here just emit `{ type:'zxselect', props:{ entity } }` and a
  column `render` showing the label); detect the referenced resource from the relation/metadata.
- `money` / price formats / `numeric` / `double precision` → Field `float`; column right-aligned
  with a currency/number `render`.
- `date` (indexed date column) → Field `date`; **store/read as Unix seconds** (the column format
  helper converts Date↔seconds). `datetime` → `datetime`.
- `priority` → `Select.priority` (Field `zxselect` preset) / column chip.
- `progress` / `percent` → numeric with a progress/percent column render.
- `list` / enum (has `enums`) → Field `optionlist`/`select` with the enum options; column shows label.
- `checked` / `boolean` → Field `toggle`/`checkbox`; column shows a check.
- `email` / `tel` / `url` → Field `text` (typed input via props); column plain.
- `text` (short) → `text`; long/`json`/`character varying` large → `textarea`; `text[]` → `valuelist`.
- Unknown → `text`, and `console.warn` once.
- Labels: humanize the field name (or use a label from metadata if present); allow `opts.labels`
  override. Respect readonly/required flags where available.

Keep DOM out of this file (pure config); WP15's generators consume these descriptors.

## query.js — Zx state → ZeyOS query params

```js
export function buildListQuery({ fields, sort, filters, search, searchFields, limit, offset, visibility = 0 })
// Returns the object passed to client.api.list<Resource>(...). Encodes:
//  - `filters` (PLURAL) for field predicates (FK footgun); never `filter`.
//  - `sort`: ['-lastmodified'] style from Zx {id, dir}; map id→raw field (dot-notation joins ok).
//  - `fields`: projection incl. dot-notation joins and aliasing.
//  - fulltext `query` from `search` across `searchFields`.
//  - `limit`/`offset` for pagination; `visibility: 0` by default.
export function tableSortToQuery(sort)               // {id,dir} -> ['±field']
export function dataFilterStateToFilters(state, defs) // DataFilter state -> ZeyOS `filters`
export function dateToUnixSeconds(date) / unixSecondsToDate(seconds)
```
Bake in the documented gotchas (filters plural, unix-seconds, count server-side). Pure functions.

## connect.js — wiring helper

```js
export function connect(client, { onError, locale } = {})
// Wires an existing client to Zx infrastructure and returns a small facade:
//  - installs an error reporter (default: Message.error) — used by generators for failed loads/saves
//  - applies ZeyOS locale to Zx i18n/date (setLanguage) if provided/derivable
//  - returns { client, list, get, create, update, reportError } thin helpers over client.api
// Does NOT create a client (no @zeyos/client import) — the app injects one.
```

## index.js

Re-export the public surface: `fieldToZxField`, `fieldToZxColumn`, `resolveFields`,
`registerFieldType`, `buildListQuery`, `tableSortToQuery`, `dataFilterStateToFilters`,
`dateToUnixSeconds`, `unixSecondsToDate`, `connect`.

## Acceptance criteria

1. `node --test tests/unit/zeyos-schema.test.js tests/unit/zeyos-query.test.js` green:
   - schema: several field-metadata inputs → expected Zx field/column descriptors (entity, money,
     date/unix, boolean, enum/list, text[], unknown→text+warn); `resolveFields` honors a curated
     `fields` allow-list order and `exclude`.
   - query: `buildListQuery` emits `filters` (plural), `-field` sort, projection with a dot-join,
     fulltext `query`, `limit`/`offset`, `visibility:0`; date↔unix-seconds round-trips.
   - Tests must be pure (no network, no client instance needed for the pure functions; where a
     client is needed, use a tiny stub exposing `schema.fields/describe/enums`).
2. `node tests/lint-tokens.js` still green; `npm run build` still succeeds (this module isn't in
   the core bundle yet — WP15 adds its dist entry).
3. `src/index.js` is unchanged (core stays zero-dep; the binding is not exported from it).
4. JSDoc on every export; commit on `wp14-zeyos-core`.

## Out of scope

DOM generators (`zeyosForm/zeyosTable/zeyosSelect`), the kitchen-sink rework, the dist entry, and
the demo — all WP15. Do not modify component source or `src/index.js`.
