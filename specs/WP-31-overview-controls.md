# WP31 — Searchable filters and unified sorting

Read AGENTS.md. Review work in the existing checkout; publication and release packaging are outside
this package. This extends the existing Select, Filter and field-adapter specifications.

## Scope

- `src/components/filter/filter.js|css`, `tests/unit/filter.test.js`
- `src/components/select/select.js`, `src/components/select/field-adapter.js`
- `src/components/sort-control/sort-control.js|css`, `tests/unit/sort-control.test.js`
- `src/index.js`, `styles/zx.css`
- `website/demos/filter.demo.js`, `website/demos/sort-control.demo.js`, `website/docs.js`
- `tests/smoke/smoke.js` for component lifecycle and interaction coverage
- Generated `docs/api.json`; supported API additions in `docs/llms.md`

## Contract

Select gains an accessible `label` option; its existing local search and themed popover remain the
single implementation of searchable single selection. The form adapter forwards the field label.
No runtime dependency, core change or native-select replacement for existing consumers is required.

Filter adds opt-in `searchable` field/operator/single-choice selectors and `layout:'compact'`.
Compact conditions fit one row using their container's width, falling back to a value row on narrow
containers. Owned Select instances are disposed on rerender/removal/destroy; field/operator changes
preserve focus and rebuild compatible values without accepting uncommitted search text. Unknown
fields/operators remain visible and invalid. Native and multi-value editor behavior stays compatible.
`rootLogic` can restrict the root to AND or OR, with mismatching saved ASTs invalid rather than
rewritten. `showApply` and `showRootActions` support embedding in a drawer with an external Apply
button, without host DOM surgery. Compact removal keeps an accessible name.

SortControl composes Select into one searchable control for a field and direction, represented by
`{id,dir}`. Field choices are displayed with direction text and an arrow; each direction is available
for each field in the same option list. Changing it emits one `change {value}` event. Expose
getValue(), setValue(value,{silent}), enable(), disable(), focus(), and destroy(). Changing the field
or direction atomically commits one sort state. Use semantic tokens and the shared icon helper.

## Validation

Pure tests cover sort choices/state normalization and filter logic validation. Existing Zx tests,
token lint, generated API validation and declaration build must pass. Browser review covers local
search, keyboard selection, Escape, dark/light and cozy/compact, drawer popovers, single-row and
narrow layouts, stale editor disposal and empty/unsupported conditions. Demos document supported
component behavior only. Application integration is in the ZeyOS checkout.

## Out of scope

Kernel/routing changes, asynchronous multi-selection, saved-view storage, business schema rules,
record moves, publishing, new dependencies, unrelated work in the existing checkout.
