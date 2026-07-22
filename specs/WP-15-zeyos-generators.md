# WP15 — zeyosForm / zeyosTable / zeyosSelect + kitchen-sink rework

Branch: `wp15-zeyos-generators` from `main` **after WP14 is merged** (needs `src/zeyos/`).
Read `AGENTS.md`, `docs/llms.md`, `specs/WP-14-zeyos-core.md`, and the WP14 code in `src/zeyos/`.

Goal: schema-driven DOM generators on top of the WP14 foundation, and rework the kitchen sink to
prove the whole ZeyOS × Zx integration — "declare an entity, get a typed form/table."

## Architecture

- Add to `src/zeyos/` (still a separate entry; NOT imported by `src/index.js`; still no direct
  `import '@zeyos/client'` — the app injects a client instance).
- Generators import Zx components from `../index.js` and the WP14 helpers from `./schema.js` /
  `./query.js` / `./connect.js`.

## Scope

```
src/zeyos/form.js        # zeyosForm
src/zeyos/table.js       # zeyosTable
src/zeyos/select.js      # zeyosSelect
src/zeyos/index.js       # add the new exports
tools/build.js           # add dist/zx-zeyos.esm.js (esbuild bundle of src/zeyos/index.js)
website/kitchen-sink.html        # rework to use the generators
website/mock-zeyos-api.js        # return data shaped to the real fields chosen (see below)
docs/llms.md                     # add a `<!-- doc:zeyos -->` "ZeyOS binding" section
tests/unit/zeyos-generators.test.js   # pure parts only (config assembly); DOM verified in browser
```

## select.js — `zeyosSelect(client, resource, opts)` → Zx `Select`

Async Select backed by the resource's list operation. Options: `{ fields, labelKey, valueKey='ID',
searchFields, limit=50, filters, value, ...selectOpts }`. Uses WP14 `buildListQuery` for the
fulltext `query`/`filters`/`fields`/`limit`; `filter: async (q) => rows` calls
`client.api.list<Resource>`. Returns a configured `Select` instance. Used by entity (`t_entity`)
fields in zeyosForm.

## form.js — `zeyosForm(client, resource, opts)`

Builds a Zx `Form` from schema. Options: `{ fields (curated allow-list, ordered), exclude, labels,
title, columns=2, value|id, onSaved }`. Behavior:
- `resolveFields(client, resource, opts)` → `fieldToZxField` per field. Entity fields become
  `zxselect` wired via `zeyosSelect(client, referencedResource)`. Enum/list fields get their
  options from `client.schema.enums`. Date fields convert Unix-seconds ↔ Date (WP14 helpers).
- `await form.load(id)` (or initial `value`) → `client.api.get<Resource>({ ID })`, mapped through
  the field descriptors (unix-seconds→Date, etc.), `setValues`.
- `form.save()` → validates, maps values back (Date→unix-seconds), calls
  `client.api.update<Resource>({ ID, ...})` or `create<Resource>(...)`; on success `onSaved(record)`
  + `Message.success`; on error reports via the connect error reporter / `Message.error`.
- Returns `{ form, load, save, getForm() }` (or the Form with these methods attached — pick one and
  document). Destroy cleans up child components.

## table.js — `zeyosTable(client, resource, opts)`

Builds a Zx `Table` with server-side data. Options: `{ fields, labels, rowId='ID', pageSize=50,
sort, filters, search, selectable, height, onRowClick }`. Behavior:
- Columns from `fieldToZxColumn` per resolved field (typed renderers: money right-aligned, date
  formatted, entity label, enum label, boolean check, progress/percent).
- `sortMode:'server'` — on `sort`, rebuild the query (`tableSortToQuery`) and reload.
- `load({ search, filters, page })` → `client.api.list<Resource>(buildListQuery(...))` →
  `normalizeListResult` → `table.setData`; uses `table.setLoading()` during fetches.
- Pagination or "load more" using `limit`/`offset` + the server `count`.
- Returns `{ table, load, setSearch, setFilters }`. Pair with `DataFilter` via
  `dataFilterStateToFilters` when the caller wires one.

## Kitchen-sink rework (the proof)

Rework `website/kitchen-sink.html` so the invoices screen is generated from ZeyOS schema instead
of hand-configured:
- Pick a **small, real** field set from the actual `transactions` schema (inspect
  `client.schema.fields('transactions')` / describe) — e.g. a document-number field, an `account`
  entity field (t_entity → accounts), a date field (Unix seconds), a money/total field, a
  status/priority field, and a text/notes field. Likewise a couple of real `accounts` fields for
  the customer select.
- Update `mock-zeyos-api.js` to return `transactions` and `accounts` rows shaped to exactly those
  real field names/types (Unix-seconds dates, numeric totals, the account FK id, enum status), so
  the schema-driven mapping is faithful.
- The page becomes roughly: `const list = zeyosTable(client, 'transactions', { fields:[…],
  selectable:'multi', onRowClick: row => openEditor(row.ID) })` inside the MasterPanel; a
  DataFilter wired through `dataFilterStateToFilters`; the editor Dialog hosts
  `zeyosForm(client, 'transactions', { fields:[…] })` with `.load(id)` / `.save()`. Keep the
  MasterPanel/Dialog/Message shell and the "About the data layer" note (update wording to mention
  schema-driven generation).
- Keep it working end-to-end against the mock: initial list, filter, sort, edit→load→save→toast,
  new→create. `table.setLoading()` during loads.

## dist

`tools/build.js`: add `dist/zx-zeyos.esm.js` (+ `.min.js`) as an esbuild bundle of
`src/zeyos/index.js`, format esm. It should be small (no `@zeyos/client` inside — injection). Add
it to the printed size report.

## docs

Add to `docs/llms.md` a `<!-- doc:zeyos -->` section "ZeyOS binding (zx-zeyos)" documenting
`connect`, `zeyosForm`, `zeyosTable`, `zeyosSelect`, the field-type→widget mapping, the query
model (filters plural, unix-seconds, server sort/filter/search/pagination), the injection/zero-dep
design, and that it's a separate optional entry (`dist/zx-zeyos.esm.js`). Update `README.md` and
`.claude/skills/zx/SKILL.md` "Talking to ZeyOS" to mention the binding as the schema-driven layer
above `@zeyos/client`.

## Acceptance criteria

1. `node --test tests/unit/*.test.js` green (incl. generator config-assembly unit parts);
   `node tests/lint-tokens.js` green; `npm run build` succeeds and emits `dist/zx-zeyos.esm.js`.
2. `npm run serve` → `http://127.0.0.1:8321/website/kitchen-sink.html`: the invoices table and
   the edit/new form are generated from the ZeyOS `transactions`/`accounts` schema; list, filter,
   sort, edit (load→save→success toast), and new (create) all work against the mock; typed columns
   render (money right-aligned, date formatted, status/entity labels); no console errors.
3. `src/index.js` unchanged; `src/zeyos/**` does not import `@zeyos/client`.
4. `docs/llms.md` has the `<!-- doc:zeyos -->` section (so the catalog Docs tab could show it);
   README/SKILL updated. Commit on `wp15-zeyos-generators`.

## Out of scope

Real backend/live OAuth; codegen from api.json; changing Zx component source; a catalog demo tile
(the kitchen sink is the demo).
