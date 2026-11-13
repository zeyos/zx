# WP82 — Application feedback: overlays, options, charts, tables, packaging

Branch: `wp/82-application-feedback`, from the 5.7.1 release. AGENTS.md applies.

Feedback from an application built on Zx. Every item is reproduced against 5.7.1 before it is
changed; an item that no longer reproduces is recorded as such in the hand-off and left alone
(F12's alias precedence and the `download` glyph shipped in 5.7.1).

## Items and required result

| ID | Scope | Required result |
| --- | --- | --- |
| F1 | Dialog, Sheet, Modal | A close button switched off (`closable: false`, `closeButton: false`) is not displayed, not focusable and cannot close the overlay. |
| F2 | `src/core/component.js` | An option passed as `undefined` keeps the declared default, at the top level and inside `msg`. `null` still overrides. |
| F3 | Packaging | Importing one export from `@zeyos/zx` lets a bundler drop what is unused as far as the registration side effects the package promises allow: the element tables and the static initialisers in Calendar, CardView and KanbanView no longer pin classes. `exports` gains `./src/core/*.js` with types so granular imports reach `setTranslator`, `registerIcons`, `icon`. The size figures in the documentation are re-measured with esbuild and state the bundler. Registration behaviour of every existing entry is unchanged. |
| F4 | Message | A `placement` for floating messages (the six logical corners and centres, block-start inline-end by default), per call and as a default, expressed on the region as an attribute, with a documented custom property for the offset from the viewport edge. Messages of different placements do not share a region. |
| F5 | Chart | The engine is created once the canvas is connected and has a size, and receives theme values without a manual `refreshTheme()`. The adapter receives the resolved categorical palette (`--zx-color-chart-1…8`) in addition to the two existing colours, and every colour it receives is a string a legacy parser reads (`#rrggbb` or `rgb()/rgba()`). |
| F6 | Chart | A `fill` mode that takes the height of its container; the minimum viewport height becomes a documented custom property keeping today's value by default; `setAspectRatio()`, `setLabel()`, `setDescription()`, `setSummary()`. |
| F7 | Table, Grid | `TableColumn.pin` (`'start'`/`'end'`) keeps a column in view while the table scrolls inline, and `TableColumn.group` renders a grouped header row with correct `colspan`, ARIA and keyboard behaviour, in plain, hierarchical and windowed tables. |
| F8 | Modal, Dialog, Sheet, Launcher, Table | Without `showModal()`, `showPopover()` or `ResizeObserver` (jsdom) the components open, close and construct without throwing, falling back to the `open` attribute. |
| F9 | Chart | Summary-table values are formatted for the locale by default; a `summaryFormat(value, context)` option overrides it. |
| F10 | Documentation | A framework guide for the class API (mount/unmount, StrictMode double mount, framework content in slots, controlled wrappers, Groupbox's asynchronous `toggle`), and a generated per-component statement of which options have setters and which need a rebuild. |
| F11 | Table | `setExpanded(ids, { silent })` replaces the expanded set with one render. |
| F12 | Icons | The built-in aliases are documented; `iconNames()` and `icon()` agree about a name. |
| F13 | Toggle | An unlabelled switch can be given an accessible name through an option, following the convention other inputs use. |
| F14–F16 | Documentation | `stickyHeader` needs a bounded height; `Chart.setData()` clears loading and error, `setLoading(true)` destroys the engine; the Field-type → stylesheet mapping `zx-css` uses. |
| N1 | CodeEditor | `indent: ''` and the Tab/Escape behaviour are documented. |
| N2 | Table | With `virtual: true` a `fr` column keeps a usable width in a narrow container. |
| N4 | Table, Grid | A click on an interactive element inside a cell does not raise `rowclick`. |
| N6 | StatTile | The tile is a `<button>` only when it is actually clickable; `clickable: false` wins. |
| N7 | Stepper | A horizontal stepper that wraps draws no connector past the last step of a row. |
| N8 | CodeEditor | An error state with a message, following Field's convention. |

## File scope

- This specification.
- `src/core/component.js`, `src/core/icons.js` (explicit core permission for F2 and F12), and
  `src/core/messages.js`, `src/locales/de.js` for new message keys only.
- `src/components/{modal,dialog,sheet,launcher,message,chart,table,grid,toggle,stat-tile,stepper,code-editor,calendar,card-view,kanban-view}/**`.
- `src/elements/**`, `src/index.js`, `package.json` (`exports` only), `tools/check-size.js`,
  `tools/size-budget.json` (only as far as the added code requires, stated in the hand-off).
- The matching `website/demos/*.demo.js`, a guide under `website/guides/`, and its registration.
- `tests/unit/**`, `tests/regression/wp82-*.js`.
- `docs/llms.md`, `docs/api.json` (generated), `tools/build-api.js` (F10), `CHANGELOG.md`.

## Validation

`npm test`; `npm run test:browser`; the new regression suites in both themes; `npm run build` and
`npm run check:size`; a bundle measurement for F3.

## Out of scope

A release or version bump, deployment. Row-level `Table.updateRow()`, focus retention in
`MenuButton.setItems()`/`AccountMenu.setItems()`, a dashboard grid, shipping `layouts/kit.js` in
the package — these are open questions for the maintainer. New tier-2 tokens.
