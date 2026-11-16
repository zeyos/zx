# WP88 — A dependency-free SVG chart adapter

Branch: `wp/88-svg-chart-adapter`, from `wp/86b-review-fixes`. AGENTS.md applies.

The November 2026 review (`specs/review-2026-11/README.md`) decided that basic charts stay MIT and
need no host library: a `chart` node in an agent surface falls back to its data table unless the
application injects Chart.js, which contradicts "dependency-free". This WP adds an SVG renderer for
the four `surface/1` chart kinds, lets a `ChartAdapter` draw an element of its own instead of a
canvas, and makes it the default for `Surface`.

## Decisions

- **Contract.** `ChartAdapter` gains an optional `mount(viewport, spec)` beside `create(canvas,
  spec)`; an adapter implements one of them and Chart calls `mount()` when it is there. Both
  return the same `ChartHandle`, receive the same `ChartSpec`, and are called at the same moment
  (connected, sized, with data). The canvas stays where it is, empty, and keeps the chart's
  accessible name and description, so the accessible structure does not depend on the adapter;
  what `mount()` appends is presentational (`aria-hidden="true"`), laid over the canvas, and
  removed by the handle's `destroy()`. `ChartJsAdapter` is unchanged.
- **Colour through CSS.** The SVG marks name a palette slot (`data-series="1"`…`"8"`) and
  `chart.css` maps it to `--zx-color-chart-*`; the adapter writes no colour values, so a theme or
  preset switch repaints without a redraw. Series beyond the eighth take the palette again, drawn
  lighter (bars, slices) or dashed (lines).
- **Surface default.** `Surface`'s `chartAdapter` defaults to a shared `SvgChartAdapter`. The
  opt-out is `chartAdapter: null`: no engine, each chart shows its data table, as before. Any
  other adapter (Chart.js) is passed as today. `Chart`'s own `adapter` default stays `null`.

## Items and required result

| ID | Scope | Required result |
| --- | --- | --- |
| C1 | Chart | `ChartAdapter.mount(viewport, spec)` as above; `create` becomes optional in the typedef. Chart mounts, updates, resizes, re-creates on `setAdapter()` and destroys a mounting adapter exactly as a creating one; the canvas keeps `role="img"`, the label and the description; loading, empty and error states, the summary table and every event are unchanged. |
| C2 | SvgChartAdapter | `src/components/chart/svg-adapter.js`, exported from `src/index.js`. Kinds `bar` (grouped), `line`, `pie`, `doughnut`; any other type is an error (Chart's error state names it). Reads `labels` and `datasets[].data`; a number, or the `y` of a point object, is a value; null and non-finite values are gaps. A legend of series (of labels for pie and doughnut), shown for two or more series and for the arc kinds; `legend: true\|false` forces it. Bars start at zero; a line's scale spans its data; ticks are 1, 2 or 5 × 10ⁿ, written compactly in the active language. Pie and doughnut draw one ring per dataset. Every mark carries a `<title>` ("Label · Series: value"); a click on one calls `onSelect` with the standard detail. |
| C3 | SvgChartAdapter | Drawn as `div.zx-chart__drawing` (HTML legend, then `svg.zx-chart__plot`), no `innerHTML`, one `AbortController` for its listener. The `viewBox` is the plot's size in CSS pixels, so text keeps its size; the SVG scales with the viewport until the next `resize()`, which lays it out again only when the size changed. Category labels thin out and truncate rather than overlap. |
| C4 | Motion | The first drawing grows in (bars from the baseline, lines and points fade, rings scale from the centre) under `prefers-reduced-motion: no-preference` only, never when `spec.reducedMotion` is true, never on a redraw. `animation: false` (adapter option, or `chartOptions.animation` per chart) turns it off. |
| C5 | CSS | `chart.css` only: `.zx-chart__*` parts, tier-2 tokens only (`tests/lint-tokens.js`), both themes, the six presets, `--zx-space-unit`, `--zx-radius` and `--zx-text-*` followed. |
| C6 | Geometry | Pure helpers in `src/components/chart/svg-geometry.js` — nice scale, band and bar layout, label step, line path with gaps, arc slices, arc path — with unit tests in `tests/unit/chart-svg.test.js`. Not exported from `src/index.js`. |
| C7 | Surface | `chartAdapter` default as decided; `null` opts out. Charts drawn by the default adapter keep the "Data table" toggle. |
| C8 | Demo and layout | `website/demos/chart.demo.js` opens with the SVG adapter: the four kinds behind a switch, with selection logged; the summary and fill examples use it; the Chart.js example stays. `agent-canvas` drops `loadChartJs()` and draws with an `SvgChartAdapter` (no animation in preview); the thread starts synchronously. |
| C9 | Docs | `docs/llms.md` (optional integrations, the job table, Chart, Surface), `docs/llms.txt` and `website/llms.txt`, `README.md`, `website/docs.html`, `CHANGELOG.md`; regenerated `docs/api.json`, `docs/llms-small.txt`, `docs/components/*.md`. No page says there is no built-in renderer. |
| C10 | Budget | `tools/size-budget.json` raised deliberately to the measured sizes with modest headroom. The base branch is already over its JS budgets (WP85/WP86); the raise covers both, and the commit message says so. |

## File scope

- This specification.
- `src/components/chart/chart.js` (C1 only), `src/components/chart/svg-adapter.js`,
  `src/components/chart/svg-geometry.js`, `src/components/chart/chart.css`.
- `src/components/surface/surface.js` (C7 only), `src/index.js` (the export).
- `website/demos/chart.demo.js`, `website/layouts/agent-canvas.layout.js`, `website/docs.html`
  (the integration paragraph).
- `tests/unit/chart-svg.test.js`, `tests/smoke/smoke.js` (one case),
  `tests/regression/svg-chart.js`; `tools/check-language.js` (the chart page's demo-built text: a
  mark's title is the demo's label and series around a number).
- `docs/llms.md`, `docs/llms.txt`, `website/llms.txt`, `README.md`, `CHANGELOG.md`; generated
  `docs/api.json`, `docs/llms-small.txt`, `docs/components/*.md`.
- `tools/size-budget.json`.

## Validation

`npm test`; `npx tsc --noEmit -p tsconfig.json`; `node tools/run-smoke.js`;
`node tools/run-regressions.js svg-chart wp82-chart`; `node tools/shoot-layout.js agent-canvas`
and `node tools/audit-layout.js agent-canvas` at 1440 and 390, both themes, with `--preview` and
with `--steps tests/layouts/agent-canvas.steps.mjs`; `npm run build:site && node
tools/check-site.js`; `npm run check:size`. The four kinds render without Chart.js in both themes.

## Out of scope

`Chart`'s own default adapter (stays `null`); horizontal, stacked or area bars, scatter, radar,
polar area, mixed types; per-dataset colours; keyboard navigation of marks (the summary table is
the accessible path, as with Chart.js); tooltips beyond the native `<title>`; right-to-left
mirroring of axes; the dashboard, infrastructure and workflows layouts (they keep Chart.js); the
surface protocol and catalogue; new tier-2 tokens; advanced chart types (a Pro candidate).
