# WP89 — Fitted pages and auto-load in Pagination, Aurora motion, Icons page

Branch: `wp/89-pagination-fit-aurora-motion`, from `main`. AGENTS.md applies.

Three requests from the product owner: list and table views should be able to size their page to
the space they have and to load continuously; Aurora should offer richer, optionally animated
fields; the Icons documentation page should no longer carry the ZeyOS module gallery.

## Items and required result

| ID | Scope | Required result |
| --- | --- | --- |
| P1 | Pagination | `pageSize: 'auto'` and an `'auto'` entry in `pageSizes` ("Auto (n)" in the select). The fitted size is the whole rows that fit `viewport` below its `thead`, times `perRow`, clamped into `[minPageSize, maxPageSize]`; it follows the viewport's and its content's size (ResizeObserver, measured once per frame) and keeps the page's first row on the new page. A resize that would oscillate settles on the smaller size. Appending pagers fit their first batch only. `refit()` re-resolves a function `viewport` and measures again. Pure `fitPageSize()` exported and unit tested. |
| P2 | Pagination | `autoLoad` loads the next page when the end of `viewport` (or, without one, the pager relative to its scrolling ancestor) is within `autoLoadMargin` (half the viewport by default). Nothing loads while the pager is disabled; `enable()` re-checks. `showAutoLoad` renders a Toggle; switching between paging and appending returns to page 1 (`change`, reason `mode`) and fires `autoload`. Load more stays visible under auto-load. |
| P3 | Pagination | `change` detail gains `reason`, `append`, `auto`, `autoLoad`, `mode`; `getState()` gains `auto`, `autoLoad`, `mode`. Existing fields and behaviour unchanged. New message keys in English and German. |
| P4 | Layouts | The overview composition (`overview.js`) fits its page to the body by default — tables measured by the pager, card shapes by their first card, gap and column count — offers `'auto'` and the Auto-load switch, appends while auto-loading, and keeps `autoLoad` in its state. CRM, issue tracker (auto-load on) and record collection use it. The pager fits one line plus the page row at phone width. |
| A1 | Aurora | Presets `mesh`, `ribbon`, `bloom`; every preset writes its gradients into `--zx-aurora-image`. |
| A2 | Aurora | `motion: 'none'|'drift'|'flow'`, `setMotion()`: one `aria-hidden` `.zx-aurora__motion` element prepended to the target, clipped to it, its layers animated by transform only, inside `prefers-reduced-motion: no-preference`; reduced motion, reduced transparency and forced colours keep or remove the static field as before. `destroy()` restores the target. The website hero uses `drift`. |
| I1 | Icons demo | The "ZeyOS modules" section, its blurb mention, and the module configuration note are removed from `website/demos/icons.demo.js`. |

## File scope

- This specification; `CHANGELOG.md`.
- `src/components/pagination/*`, `src/components/aurora/*`, `src/index.js` (export).
- `src/core/messages.js` (three `pagination.*` keys — explicitly in scope), `src/locales/de.js`.
- `tests/unit/pagination.test.js`, `tests/unit/aurora.test.js`.
- `website/demos/pagination.demo.js`, `website/demos/aurora.demo.js`, `website/demos/icons.demo.js`,
  `website/index.js`, `website/llms.txt`.
- `website/layouts/overview.js`, `website/layouts/overview.css`, and the `pageSize` options of
  `crm`, `issue-tracker` and `record-collection`.
- `docs/llms.md`, `docs/llms.txt` and the generated `docs/api.json`, `docs/components/*`.
- `tools/size-budget.json`: the bundles grow by about 2 KB minified, on top of the overage `main`
  already carried.

## Validation

`npm test`; `npm run build` and `npm run check:size`; `node tools/run-smoke.js`;
`node tools/shoot-layout.js` and `node tools/audit-layout.js` for `crm`, `issue-tracker` and
`record-collection` at 1440 and 390 in both themes.

## Out of scope

A "go to page" field, cursor-based paging, virtualised appending, remembering the reader's page
size across sessions, and further Aurora effects (grain, pointer-following light).
