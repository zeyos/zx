# WP34 — Sorting field selector and direction toggle

Supersedes WP31's field/direction permutation list. Work in the current review checkout;
leave this refinement uncommitted for review. No publishing or dependencies.

## File scope

- `src/components/sort-control/sort-control.js|css`
- `src/core/icons.js` only to add the two Font Awesome Free wide-to-short sorting arrows
- `tests/unit/sort-control.test.js`, `tests/smoke/smoke.js`
- `website/demos/sort-control.demo.js`, `docs/llms.md`, generated `docs/api.json`
- Generated declaration output under `dist/types`

## Contract

SortControl remains one component with one `{id,dir}` state. Its searchable Select lists each
field once. A native icon button before the field reverses direction without changing the field;
choosing a field preserves direction. Both update the existing atomic change event once, including
its DOM mirror. Search text alone never commits. The button exposes the current direction through
its accessible name and shows current/next direction in its hover title, using localized labels.
Use shared icons, semantic tokens, existing ghost button styling and a visible focus ring.

Keep the existing options and methods. setValue synchronizes both controls; silent and unchanged
updates emit nothing. Empty catalogues disable both controls and return null. enable/disable apply
to both controls. Native Space/Enter activate the direction button, Tab reaches the searchable field,
and the Select retains its keyboard map and nested Escape behavior. Preserve enhancement teardown
and dispose every owned listener and Select. Both themes and densities must work, including a narrow
container. No app-specific fields or routing belong in the library.

## Validation

Test distinct field choices and defensive normalization. Browser smoke covers direction toggles,
field changes, exact event counts, uncommitted searches, silent/reset behavior, disabled/empty states,
localized labels, target restoration and stale listener disposal. Verify the public demo in
light/dark and compact/cozy and the Accounts Display draft, Apply, Cancel and reset paths.
Run unit/token checks, declaration and API generation. Rebuild the ZeyOS local source preview.

## Out of scope

Other components, additional core changes, multi-column sorting, kernel/router changes,
new dependencies, release packaging and unrelated dirty files.
