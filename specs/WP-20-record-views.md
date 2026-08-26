# WP20 — Record views: TableView, CardView, KanbanView

Branch: work on `main`. Read `AGENTS.md`, WP6, WP14, WP18, and WP19 first.

## Objective

Add three dependency-free, schema-friendly collection views for ZeyOS records. The views must
share one field, record, selection, sort, loading, and serializable-state contract while retaining
presentation-specific capabilities:

- `TableView`: column visibility, ordering, sorting, resizing-friendly widths, selection, and the
  complete low-level `Table` behavior through composition.
- `CardView`: responsive record cards with configurable title, subtitle, preview media, visible
  fields, actions, links, selection, grouping, and local/server sorting.
- `KanbanView`: configurable columns and swim lanes, record-card fields/media, counts and WIP
  indicators, collapsed sections, pointer plus keyboard movement, and local/external move modes.

The existing `Table`, `Grid`, and presentational `Card` remain backward-compatible primitives.

## Scope

```
specs/WP-20-record-views.md
src/index.js
styles/zx.css
src/components/view/record-view.js
src/components/view/record-view.css
src/components/table-view/table-view.js
src/components/table-view/table-view.css
src/components/card-view/card-view.js
src/components/card-view/card-view.css
src/components/card-view/record-card.js
src/components/kanban-view/kanban-view.js
src/components/kanban-view/kanban-view.css
src/components/table/table.js
src/components/table/table.css
src/zeyos/index.js
src/zeyos/table.js
src/zeyos/view.js
src/zeyos/saved-views.js
src/zeyos/legacy-saved-views.js
docs/llms.md
docs/llms.txt
docs/api.json
website/docs.js
website/demos/table-view.demo.js
website/demos/card-view.demo.js
website/demos/kanban-view.demo.js
website/demos/saved-views.demo.js
tests/unit/record-view.test.js
tests/unit/table-view.test.js
tests/unit/card-view.test.js
tests/unit/kanban-view.test.js
tests/unit/zeyos-view.test.js
tests/unit/zeyos-saved-views.test.js
tests/unit/zeyos-legacy-saved-views.test.js
tests/unit/zeyos-generators.test.js
tests/smoke/smoke.js
DESIGN-SYSTEM.md
CHANGELOG.md
```

Generated bundles, declarations, API docs, and `site/` are verification output and are not tracked
as source unless the repository already tracks them.

## Shared record-view contract

`RecordView` is the public abstract collection-view base. It extends `Component` and owns only
presentation-neutral state. Concrete renderers call its protected initialization and refresh hooks.

Shared options:

```
fields: [],             // ViewField[]; stable id + label, optional get/render/sortValue/type/etc.
data: [],               // record objects
recordId: 'ID',         // key or callback
sort: null,             // {id, dir:'asc'|'desc'}
sortMode: 'local',      // local reorders data; server only emits
selectable: false,      // false | 'single' | 'multi'
selection: [],          // initial record ids
fieldOrder: [],         // ordered ids; omitted/new fields retain descriptor order
hiddenFields: [],       // at least one field stays visible when fields exist
fieldControls: true,    // shared accessible show/hide + move-up/down disclosure
emptyText: null,
```

Every field supports `id`, `label`, `get(record,index)`, `render(record,index,value)`,
`sortValue(record,index)`, `sortable`, and view-specific properties. User values are text unless a
renderer explicitly returns a Node. Field descriptors and records are never mutated by Zx.

Shared methods include `setData`, `addData`, `updateRecord`, `removeRecord`, `getRecord`, `getData`,
`setFields`, `getFields`, `getVisibleFields`, `getHiddenFields`, `setFieldVisible`, `toggleField`,
`moveField`, `setFieldOrder`, `setSort`, `getSort`, `getSelection`, `setSelection`,
`clearSelection`, `setLoading`, `getViewState`, and `setViewState`.

Shared events include `recordclick`, `recorddblclick`, `datachange`, `selectionchange`,
`sortchange`, `fieldvisibilitychange`, `fieldorderchange`, and `statechange`. View state is plain,
versioned, JSON-safe configuration (`version`, `fieldOrder`, `hiddenFields`, `sort`, and
view-specific keys); records and rendered values are never serialized. Zx does not persist state.
Hosts save `getViewState()` and restore it through `setViewState()`. The view classes themselves
remain persistence-neutral; the optional ZeyOS saved-view coordinator described below captures this
state only when the application explicitly asks it to.

## TableView

`TableView` extends `RecordView` and composes one `Table`. It maps shared fields to table columns and
forwards advanced Table options without copying the table implementation. Existing Table APIs gain
safe column-order primitives (`getColumns`, `setColumns`, `getColumnOrder`, `moveColumn`,
`setColumnOrder`) and an opt-in accessible reorder UI beside the existing visibility chooser.

- `TableView` maps Table `rowclick`/`rowdblclick` to shared record events and preserves the complete
  row detail.
- Sorting, selection, editing, hierarchy, growth, row movement, responsiveness, and loading remain
  delegated to Table. Shared state mirrors Table state without event loops.
- A caller may supply `table` options; shared `fields`, `data`, `recordId`, sort, selection, hidden
  fields, and order win where the contracts overlap.
- Column reordering works through pointer controls and keyboard controls, never by making `<th>`
  elements themselves draggable. The active sort and hidden state follow stable column ids.

## CardView

`CardView` extends `RecordView`. Options include `titleField`, `subtitleField`, `preview`,
`previewAlt`, `link`, `actions`, `groupBy`, `groupOrder`, `minCardWidth`, `maxColumns`, `variant`,
and `loadingCount`.

- `preview` accepts a field id or callback returning an image URL, an `{src,alt,fit}` descriptor, a
  Node, or null. Unsafe URL schemes are rejected; image failure reveals a stable fallback.
- Cards use semantic list/listitem structure. A primary native title link is never wrapped around
  secondary actions. Selection uses native checkboxes in multi mode and `aria-selected` state.
- The default CardView presentation is deliberately dense: titles clamp to two lines, previews stay
  at thumbnail/avatar scale, and visible fields render as compact labelled metadata chips in shared
  field order. Title/subtitle fields are not duplicated unless explicitly requested with a
  per-field option. Kanban retains its independently scoped board-card rhythm.
- A visible field may opt into the shared semantic card anatomy with
  `field.view.card.slot: 'eyebrow-start'|'eyebrow-end'|'title-prefix'`. Eyebrow fields render before
  the header; title-prefix fields render immediately before, but outside, the heading and primary
  link. Recognized slotted fields are not duplicated in ordinary metadata, while absent, malformed,
  or unknown slots safely fall back to ordinary labelled metadata. Field visibility and order remain
  authoritative, and primitive values are always rendered as text; an explicit field renderer may
  still return a Node.
- Group headings and empty groups are deterministic. Local sort uses the common sort contract;
  server sort emits without reordering.
- Card activation avoids stealing clicks from links, buttons, inputs, selection controls, and text
  selection. Enter activates a focused card; Space toggles selection where enabled.

`record-card.js` is a text-safe rendering helper shared by CardView and KanbanView; it is not a
separately registered component.

## KanbanView

`KanbanView` extends `RecordView`. Options include `columnBy`, `columns`, `swimlaneBy`, `swimlanes`,
`titleField`, `subtitleField`, `preview`, `link`, `actions`, `moveMode`, `columnOrder`,
`swimlaneOrder`, `collapsedColumns`, `collapsedSwimlanes`, `showCounts`, and `showEmptyColumns`.

Column and lane descriptors have stable `id`, `label`, optional `accept(record, context)`, and a
column `limit`. Missing descriptors may be derived from distinct data values when the respective
descriptor list is omitted. Explicit descriptors may display empty columns/lanes.

- Markup is a labelled board region containing semantic lane and column sections. Board/card
  semantics must stay understandable without drag-and-drop or visual position.
- Pointer movement uses native drag only as an enhancement. Every movable card has an accessible
  move handle: Enter/Space grabs/drops, Escape cancels, Arrow Left/Right chooses a column, Arrow
  Up/Down chooses a record position, and modified Arrow Up/Down changes swim lane when configured.
  A polite live region announces grab, target, rejection, cancellation, and completion.
- `moveRecord(id, destination)` emits a cancelable `recordmove` with from/to column, lane, and index
  before committing. `accept` and WIP limits are advisory presentation constraints; host listeners
  may veto any business-invalid move.
- `moveMode:'local'` updates a cloned record and local order after acceptance. `moveMode:'external'`
  emits only; the application updates data after its server accepts the change. Records supplied by
  the caller are never mutated in either mode.
- Column/lane collapse and order belong to view state. Record movement and selection do not become
  persisted configuration.

## ZeyOS integration boundary

`src/zeyos/view.js` converts one resolved ZeyOS schema into the common `ViewField[]` and a complete
projection. It exposes a DOM-free config builder plus an injected-client binding that can create any
of the three view classes and load/search/filter/page through the existing connection/query layer.
Group, preview, title, column, and swim-lane fields are included in the projection even when hidden.
ZeyOS owns permissions, routes/links, server paging, the durable saved-view endpoint, optimistic
rollback for business records, and validation. The optional adapter coordinates an injected saved-
view transport but never creates a new storage service or imports a client. Zx also provides the
dependency-free legacy compatibility transport described below for the existing Fields endpoints.
No Zx runtime module imports `@zeyos/client`.

## Named saved views

`src/zeyos/saved-views.js` exports `SavedViewRegistry`, `createSavedViewRegistry`,
`normalizeSavedViewScope`, `normalizeSavedViewDocument`, `migrateSavedViewDocument`,
`SAVED_VIEWS_VERSION`, and the typed duplicate-name/scope-mismatch errors. It is a transport-neutral
controller for product-facing named views in the optional `zx/zeyos` entry. It may depend on the
shared RecordView contract, but it must not import `@zeyos/client`, browser storage, a router, or an
authorization policy. Applications inject the server transport and decide where the picker,
dialogs, dirty indicator, and error messages appear.

### Versioned document and exact scope

The registry loads and atomically saves one normalized document per exact scope:

```
{
  version: 1,
  scope: {
    userId,              // authenticated user id
    workspaceId,         // tenant/workspace id; null selects the base workspace
    resource,            // ZeyOS resource/schema id
  },
  defaultId: null,       // stable view id or null
  views: [],             // SavedViewEntry[]
}
```

Every entry has stable `id`, trimmed non-empty `name`, `type` (`'table'|'card'|'kanban'`), JSON-safe
`state`, JSON-safe `filters`, string `search`, and `createdAt`/`updatedAt`. `defaultId` is the sole
source of default status; duplicating an `isDefault` flag onto entries would allow contradictory
states. `normalizeSavedViewScope` and `normalizeSavedViewDocument` produce defensive normalized
copies and reconcile a missing default target back to null.

The complete `{userId,workspaceId,resource}` tuple is required on every transport operation and is
embedded in the document. `userId` and `resource` are non-empty; `workspaceId:null` is the explicit
base-workspace scope, distinct from every named/id workspace. A document from one tuple must never
appear in, become default for, or be applied to another tuple. Authorization and workspace
membership are still enforced by the server; client-side scoping is organization, not a security
boundary.

Names should be unique under case-folded comparison within the exact scope across all three
types, so the picker never contains ambiguous duplicates. `save` rejects duplicates by default and
supports an explicit replace policy for intentional overwrite. There is at most one default across
all types in the scope: a Card default can be the landing view even when the current renderer is a
Table. An explicit route/view id wins over `getDefault()`; without either, the application uses its
unsaved baseline configuration.

Records, selection, loading state, current pages/cursors, rendered Nodes, open disclosures,
keyboard/drag drafts, and Kanban record positions never belong in the saved document.

### State, filters/search, and presentation capture

Capture is explicit and defensive:

- `state` comes from `view.getViewState()` and includes common plus presentation-specific
  configuration. It is cloned and JSON-validated before it reaches a transport.
- `filters` and `search` come from the application/query binding, not from DOM inspection. Sort has
  one canonical saved value in view state; projection, result data, offset/cursor, pending requests,
  credentials, callbacks, and DOM values are excluded.
- `type` is captured beside state rather than inferred later from presentation-specific state keys.
- Capture and transport results reject cycles, functions, symbols, bigint, DOM nodes, non-finite
  numbers, unsafe object prototypes, and prototype-pollution keys. Caller objects and server
  responses are never mutated.

`capture(view, entryMeta)` combines `getViewState()` with entry metadata, type, filters, and search,
then persists that complete entry through `save`. The application calls it only for an explicit
**Save** or **Save as** action. Changing fields, sort, grouping, columns, lanes, collapse state,
filters, or search creates an application-tracked local draft; there is no implicit autosave.
Switching away from a dirty draft offers Save / Discard / Cancel. Rename changes only the saved
entry metadata and must not silently recapture or overwrite a newer live draft.

### Restore and presentation switching

`apply(idOrName, view, {type, onQuery})` is intentionally two-phase so a saved Kanban view is never
partially pushed into the wrong renderer:

```
resolve explicit id or exact-scope default
                 │
                 ▼
           type matches current view? ── no ──► {status:'type-mismatch', expectedType}
                 │ yes                          host creates target renderer
                 ▼                                           │
       apply validated view state ◄───────────────────────────┘
                 │
                 ▼
 await onQuery({filters, search, entry}) and load records
                 │
                 ▼
        mark confirmed snapshot clean
```

Apply returns `{status:'applied', applied:true, entry}` on success, `{status:'missing',
applied:false}` when the id/name no longer exists, and `{status:'type-mismatch', applied:false,
entry, expectedType, currentType}` on mismatch. `expectedType` is always the saved presentation the
host must create; `currentType` echoes the host-supplied renderer type for diagnostics. A mismatch
is not an exception and mutates neither the current view nor query. The host creates the appropriate
`TableView`, `CardView`, or `KanbanView`, reconnects its ordinary event/data binding, and retries
apply with the matching type. Shared state
compatibility is useful for “Save as another presentation”, but does not override an entry's
explicit type.

`onQuery` is awaited only after `setViewState()` succeeds and receives filters plus search together,
so applications do not issue two competing loads. The host owns the actual data load and may keep
old records visible with a busy indicator. Selection and record movement remain live session state.

### Injected server transport and mutations

The registry accepts this dependency-free async transport:

```
{
  load(scope),                    // SavedViewDocument|null
  save(scope, document),          // atomic confirmation or rejected Promise
  remove?(scope),                 // optional deletion when the final view is removed
}
```

Every mutation creates a candidate document and performs one atomic `save`; confirmed local state
changes only after that operation succeeds. Removing the final entry calls optional `remove(scope)`
where supplied, otherwise it atomically saves the normalized empty document. The concrete endpoint
name, HTTP client, auth headers, revision/ETag enforcement, validation messages, and permission
model for a generic transport remain application-owned. The compatibility adapter below is the
limited, dependency-free bridge for ZeyOS's already-existing Fields endpoints.

### Existing ZeyOS compatibility transport

`src/zeyos/legacy-saved-views.js` exports `createLegacySavedViewTransport(request, options)` and
`legacySavedViewRequest(load)`. This is a concrete compatibility adapter over ZeyOS's existing
`fields`, `fields_save`, and `fields_remove` endpoints, not a new backend, browser store, or
authorization system. The Promise-based `request` remains injected; `legacySavedViewRequest`
adapts a caller-bound `PG.load` only when a legacy host needs that bridge.

The adapter stores one complete registry document in a reserved userfields row named
`__zx_record_views_v1__` by default. Its `view` value is namespaced as
`zx.record-views:<resource>` and includes the workspace/fork, keeping the internal document out of
ordinary legacy Fields picker namespaces and avoiding collisions with user-authored field layouts.
`workspaceId:null` maps to ZeyOS's nullable `userfields.fork` for the base workspace. The names are
configurable for installations that already reserve those identifiers.

The authenticated server session determines the user. `scope.userId` protects the client registry
from accidental cross-user reuse but is deliberately never sent as an endpoint authorization
parameter; the server remains responsible for user identity, workspace membership, permissions,
and isolation. Corrupt or absent reserved legacy rows load as no saved-view document, while
transport errors reject normally so the registry can preserve its last confirmed snapshot.

The async registry API is `ready`, `load`, `list`, `get`, `getDefault`, `save`, `rename`, `remove`,
`setDefault`, `capture`, `apply`, and `destroy`. List/get results are defensive copies. `destroy()`
is local-only: it invalidates later work but never deletes the server document.

Create, overwrite, rename, delete, and default changes are explicit operations. Product behavior:

- **Save as** validates the name, captures state/filters/search/type, waits for server confirmation,
  then selects the returned entry from the confirmed document.
- **Save** updates the selected entry. A transport-level conflict leaves the draft intact and lets
  the application offer Reload / Save as / retry after an intentional merge.
- **Rename** keeps the same id, type, state, filters, search, creation time, and default target;
  `updatedAt` advances with the confirmed rename.
- **Make default** changes `defaultId` in the same atomic document save, so two defaults are never
  observable from one confirmed registry snapshot.
- **Delete** requires product-level confirmation. Success removes the name but does not destroy or
  reset the live renderer; it becomes an unsaved draft. Deleting the default clears it unless the
  canonical saved document explicitly names another valid default.

The application owns picker state, mutation-pending controls, dirty comparison, confirmation
dialogs, and focus restoration. Registry methods provide the confirmed data without owning UI.

### Failure and concurrency behavior

Safe failure is pessimistic and last-confirmed:

- A failed initial list shows a retryable error, not a fabricated empty list. A failed refresh keeps
  the last confirmed list and selection.
- Failed save/rename/remove/default calls leave the confirmed document unchanged. The current
  view state/filter/search draft is never rolled back or discarded merely because persistence
  failed.
- Stale `load`/`save` responses are ignored. A response is committed only while its operation and
  scope still match the live registry; the transport may additionally enforce revisions/ETags.
- Malformed or cross-scope server records are rejected before cache/application. Error results are
  never committed, and callers handle rejected persistence promises without unhandled rejections.
- Type mismatch and missing/deleted id are structured `apply` outcomes. Conflict, validation,
  permission, offline/network, and application-canceled query failures remain distinguishable
  transport/application errors while preserving confirmed registry state.
- `destroy()` invalidates pending work and prevents later results from mutating registry state. It
  does not call transport `remove` or imply that an arbitrary transport can abort its own request.

The application decides toast/dialog wording and telemetry. It must not place credentials, raw
server errors, or record contents into saved-view names, filter/search snapshots, URLs, or logs.

## Demos and accessibility

Each component gets a self-contained Data demo registered under the exact titles `Table view`,
`Card view`, and `Kanban view`. Demos use the same realistic record/field descriptors so switching
among the examples demonstrates contract compatibility. Event logs show state, activation, sort,
selection, and moves. At least one example demonstrates a saved state round-trip in memory only.

An additional in-memory saved-view workflow demo may remain unregistered while the surrounding
product picker/dialog is application-owned. It uses the real saved-view controller with a tiny
injected Promise transport and no network, storage, timer race, or external dependency. It shows
Save as, Save, presentation mismatch/switching, default, rename, confirmed delete, dirty switching,
and a deterministic failed mutation that preserves the draft and confirmed list.

Verify light/dark × cozy/compact, narrow containers, 200% zoom, keyboard-only operation, reduced
motion, empty/loading/long-content states, image failure, and create/destroy twice.

## Non-goals

- A router, API client import, new persistence store/endpoint, permissions engine, undo history,
  collaborative presence, server validation, formulas, spreadsheet behavior, or framework adapter.
  The saved-view controller calls an injected transport; it is not itself a store. The optional
  legacy transport only adapts ZeyOS endpoints that already exist.
- Virtual scrolling, infinite bidirectional Kanban virtualization, arbitrary dashboard layout,
  pivot tables, aggregate formula language, or a schema editor.
- Mutating host records, moving records on the server, or treating visual WIP limits as security or
  business-rule enforcement.

## Acceptance criteria

1. The three public views accept one `ViewField[]` and expose the shared method/event/state contract;
   state from one can seed another without error and unknown/new fields reconcile deterministically.
2. TableView preserves every inherited Table capability and supports visibility plus ordering
   through both public APIs and accessible controls.
3. Card previews, links, actions, labels, and user values are text/URL safe; selection and activation
   never produce nested interactive content or double events.
4. Kanban pointer and full keyboard movement work across columns and swim lanes; rejected/canceled
   moves do not mutate data; external mode never mutates local data.
5. `npm test`, `npm run build`, `npm run build:site`, `npm run test:browser`, and
   `git diff --check` pass without a runtime dependency or a `dependencies` package field.
6. Browser smoke creates, exercises, and destroys all three views without leaked roots, listeners,
   observers, drag markers, disclosures, or live regions.
7. Existing unrelated worktree changes are preserved, especially the current token/glass styling
   changes in `src/components/table/table.css`.
8. Named views remain isolated by exact `{userId,workspaceId,resource}` scope, capture JSON-safe
   state plus filters/search and explicit type, resolve one cross-type `defaultId`, and never
   serialize records, selection, pagination cursors, functions, DOM, or pending interaction state.
9. Missing ids and type mismatches are structured apply outcomes. Persistence failures, conflicts,
   and stale responses never mutate the last confirmed document or discard the live draft, and
   destroy prevents pending work from applying late.
