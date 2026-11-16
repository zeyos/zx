# Chart, `SvgChartAdapter` and `ChartJsAdapter`

An accessible engine-neutral chart host.

Full reference: https://zx.zeyos.com/docs/llms.md · Live demo: https://zx.zeyos.com/docs.html#components/chart · All components: https://zx.zeyos.com/docs/components/index.md

An accessible, engine-neutral chart host. Zx renders state, canvas, semantic data summary, tokens,
and lifecycle; an adapter owns the drawing. Two are supplied: `SvgChartAdapter` draws bar, line,
pie and doughnut charts as SVG and needs nothing else; `ChartJsAdapter` draws any Chart.js type
with a Chart.js 4 the host supplies (the Zx runtime imports no Chart.js code). Without an adapter
Chart draws nothing, and the data lives in its summary table alone.

```js
const chart = new Chart(null, {
  adapter: new SvgChartAdapter(),
  type: 'bar',
  label: 'Invoiced and collected per week',
  data: { labels: ['Week 1', 'Week 2'], datasets: [{ label: 'Invoiced', data: [52300, 61200] }] }
});
```

- **Options** — `adapter`, `type: 'bar'`, `data`, engine-specific `chartOptions`, `label`,
  `description`, `summary: 'hidden'|'visible'`, `summaryFormat: null`, `loading`,
  loading/empty/error text, `aspectRatio: '16 / 9'`, and `fill: false`.
- **Methods** — `setData()`, `setType()`, `update(chartOptions)`, `setAdapter()`, `setLoading()`,
  `setError()`, `clearError()`, `setLabel()`, `setDescription()`, `setSummary()`,
  `setAspectRatio()`, `setFill()`, `resize()`, `refreshTheme()`, `getInstance()`, `destroy()`.
- **Events** — `ready {instance}`, `update {data, type}`, `select {datasetIndex, index, dataset,
  label, value, nativeEvent}`, and `error {error}`.
- **When the engine exists** — the engine is created once the chart is in a document, its
  viewport has a size, and it has data and an adapter; `ready` fires then, not necessarily inside
  the constructor. A chart constructed on a target that is already laid out mounts synchronously;
  one built with `null` and appended later mounts when the browser reports its size.
  `getInstance()` and `resize()` do not wait: called after the chart is appended, they create the
  engine on the spot, and `getInstance()` returns null while there is none. A chart that is
  loading, empty, or in error has no engine. Where there is no `ResizeObserver` or no layout at
  all (jsdom), nothing can report a size and the engine is created as soon as there is data.
- **State changes and the engine** — `setData()` clears both the loading state and an error.
  `setLoading(true)` and `setError()` destroy the engine; the next `setData()`,
  `setLoading(false)` or `clearError()` creates a new one and fires `ready` again, so do not hold
  on to an instance across them. `setAdapter()` replaces the engine as well.
- **Sizing** — by default the viewport takes the width it is given and derives its height from
  `aspectRatio` (`setAspectRatio()` changes it; null restores the default), never less than
  `--zx-chart-min-block-size` (220px unless set, on the chart or any ancestor). `fill: true` (or
  `setFill()`) takes the block size of the container instead: the root is 100% tall, the viewport
  takes what the description and a visible summary leave, `aspectRatio` is not used, and there is
  no minimum unless `--zx-chart-min-block-size` sets one. The container needs a height of its
  own. The chart follows its viewport; `resize()` is for an engine that needs telling after
  something else changed.
- **Theme** — the chart resolves `--zx-color-text`, `--zx-color-border` and the categorical
  palette `--zx-color-chart-1`…`-8` on its root and hands them to the adapter as values. It does
  so again by itself when a `data-zx-theme` or `data-zx-preset` attribute changes anywhere in the
  document, when the system colour scheme or contrast preference changes, and when the chart is
  shown again after being hidden or moved. `refreshTheme()` is only for changes none of those
  cover: a stylesheet swap, a class, an inline custom property.
- **Adapter contract** — `adapter.create(canvas, {type, data, options, theme, reducedMotion, onSelect})`
  returns `{update(spec), resize(), destroy(), instance?}`; `update(spec)` is called for new data,
  type or options and whenever the theme or the motion preference changes. An adapter that draws
  an element of its own implements `mount(viewport, spec)` instead, with the same spec and handle:
  Chart calls `mount()` when an adapter has it, `create()` otherwise. The canvas then stays in
  place, empty, keeping the chart's accessible name and description; what `mount()` appends lies
  over it, is presentational (`aria-hidden="true"`), and goes with the handle's `destroy()`. `spec.theme` is
  `{color?, borderColor?, palette}`: text colour, grid and axis colour, and the series colours in
  order (empty where the tokens are not defined; series beyond the eighth start over).
  `spec.options` is the application's `chartOptions` over `color` and `borderColor`, the same two
  strings in the shape Chart.js reads. Every colour is `#rrggbb` when opaque and
  `rgba(r, g, b, a)` when translucent — never `color()`, `oklch()`, `light-dark()` or a `var()` —
  so an engine with its own colour parser reads it. Implementations must destroy engine
  resources and must not retain the component after teardown. `reducedMotion` is true under the
  system preference or inside a `data-zx-motion="reduced"` region, and an adapter must then turn its
  engine's animation off; Chart watches for the answer changing and updates the mounted engine.
- **`SvgChartAdapter`** — `new SvgChartAdapter({animation: true, legend: null})` draws `bar`
  (grouped), `line`, `pie` and `doughnut`; any other type puts the chart in its error state, and
  `SvgChartAdapter.supports(type)` answers first. A value is a number, or the `y` (else `r`) of a
  point object; null and anything not finite is a gap — no bar, a break in the line, no slice.
  Bars stand on zero; a line's scale spans its data; ticks fall on 1, 2 or 5 × 10ⁿ and are written
  compactly in the active language ("250K"). Pie and doughnut draw one ring per dataset, a slice
  per positive value. The legend lists the series (the labels, for pie and doughnut) when there are
  two or more and for the arc kinds; `legend: true|false` forces it. Colours come through CSS from
  `--zx-color-chart-1`…`-8`, so a theme or preset switch repaints without a redraw; a dataset's own
  colour keys are not read, and series past the eighth take the palette again, lighter (dashed, for
  a line). The plot's `viewBox` is its size in pixels, so text keeps its size: it scales with the
  viewport and is laid out again on the next resize, thinning category labels rather than
  overlapping them. Each mark has a `<title>` ("Week 1 · Invoiced: 52,300") and pressing one fires
  `select` with the usual detail; there is no keyboard path through the marks — the summary table is
  the accessible one. The first drawing grows in unless motion is reduced (system, or a
  `data-zx-motion="reduced"` region) or `animation` is false; per chart, `chartOptions.animation` and
  `chartOptions.legend` decide over the adapter's options. `getInstance()` returns the drawing
  element. One adapter serves any number of charts.
- **`ChartJsAdapter`** — construct it with a Chart.js constructor or namespace:
  `new ChartJsAdapter(window.Chart)`. The documentation pins Chart.js 4.5.1 as a development dependency and copies it to its
  self-hosted vendor assets during the website build; `package.json` has no runtime dependencies and application builds explicitly choose how
  the engine is loaded. Under reduced motion it sets `animation: false`, over any animation the
  application configured. A dataset that names neither `backgroundColor` nor `borderColor` is
  coloured from the theme palette: one colour per series (a bar filled with it, a line, radar or
  point series stroked with it and filled at half opacity), or one per value for `pie`,
  `doughnut` and `polarArea`. A dataset that names either is left exactly as written.
- **Accessibility** — the canvas always has a name and optional description, whichever adapter
  draws, while synchronized labels and dataset values live in a semantic table.
  `summary: 'hidden'` keeps it visually hidden for assistive technology; `'visible'` makes exact
  values part of the interface. `setLabel()`
  renames the canvas and the table's caption, `setDescription()` and `setSummary()` change the
  other two.
- **Summary values** — a number is written for the active language (the chart's `lang`, else
  `getLanguage()`) with grouping and up to twelve significant digits: `1234567.5` reads
  "1,234,567.5" and `0.1 + 0.2` reads "0.3". For a point object the value is its `y`, else its
  `r`. `summaryFormat(value, context)` returns the text of one cell instead — a currency, a unit,
  a percentage — with `context` `{dataset, datasetIndex, index, label, raw, formatted}`, where
  `formatted` is the default text; returning null or undefined keeps it.
