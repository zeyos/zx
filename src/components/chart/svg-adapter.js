import { getLanguage, translate } from '../../core/i18n.js';
import {
  arcPath, arcSlices, barSlots, labelStep, linePath, linearScale, niceScale, ringRadii, tickPrecision
} from './svg-geometry.js';

/** @typedef {import('./chart.js').ChartData} ChartData */
/** @typedef {import('./chart.js').ChartHandle} ChartHandle */
/** @typedef {import('./chart.js').ChartSpec} ChartSpec */

/**
 * @typedef {Object} SvgChartAdapterOptions
 * @property {boolean} [animation=true] Whether a chart grows into place the first time it is
 *   drawn. Reduced motion stops it whatever this says; `chartOptions.animation` decides per chart.
 * @property {boolean|null} [legend=null] Whether a legend is drawn: null draws one for two or
 *   more series and for pie and doughnut charts; `chartOptions.legend` decides per chart.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';
/** The chart types `SvgChartAdapter` draws: the four `surface/1` chart kinds. */
const KINDS = Object.freeze(['bar', 'line', 'pie', 'doughnut']);
const ARC_KINDS = new Set(['pie', 'doughnut']);
/** The categorical palette, `--zx-color-chart-1` to `-8`; a series past it takes it again. */
const PALETTE_SIZE = 8;
/** The plot's size where nothing can be measured (no layout), in CSS pixels. */
const UNMEASURED = Object.freeze({ width: 640, height: 360 });
/** Text size where none can be read. */
const DEFAULT_FONT = 12;
/** The hole of a doughnut, as a fraction of its radius. */
const DOUGHNUT_HOLE = 0.5;

/**
 * @typedef {Object} SeriesModel
 * @property {number} index Index of the dataset.
 * @property {string} name The dataset's label, or "Series n".
 * @property {number[]} values One per category; NaN where there is no value.
 */

/**
 * @typedef {Object} ChartModel
 * @property {string[]} labels One per category.
 * @property {SeriesModel[]} series One per dataset.
 */

/**
 * @typedef {Object} Formats
 * @property {(ticks: number[], step: number) => (value: number) => string} ticks Tick labels.
 * @property {(value: number) => string} value A value as the tooltip writes it.
 * @property {(value: number) => string} percent A share of a pie.
 */

/**
 * A chart engine with no dependency: draws `bar` (grouped), `line`, `pie` and `doughnut` charts as
 * SVG for `Chart`, through the adapter's `mount()` contract. Colours come from the theme's chart
 * palette (`--zx-color-chart-1`…`-8`) through CSS, so a theme or preset switch repaints without a
 * redraw. The drawing is presentational: the chart's canvas keeps its accessible name and
 * description, and its summary table carries the values.
 *
 * `Surface` draws its `chart` nodes with a shared instance unless the application passes another
 * adapter, or `null` for the data table alone.
 */
export class SvgChartAdapter {
  /**
   * @param {SvgChartAdapterOptions} [options={}] Defaults for every chart the adapter draws.
   */
  constructor(options = {}) {
    /** @type {Readonly<Required<SvgChartAdapterOptions>>} */
    this.options = Object.freeze({ animation: true, legend: null, ...options });
  }

  /**
   * Whether the adapter draws a chart type: `bar`, `line`, `pie` or `doughnut`.
   * @param {string} type Chart type.
   * @returns {boolean}
   */
  static supports(type) {
    return KINDS.includes(type);
  }

  /**
   * Draws one chart into the viewport Chart hands over and returns its lifecycle handle. The
   * handle's `instance` is the drawing element.
   * @param {HTMLElement} viewport The chart's viewport; the drawing is appended to it and removed
   *   by the handle's `destroy()`.
   * @param {ChartSpec} spec Initial chart specification.
   * @returns {ChartHandle}
   */
  mount(viewport, spec) {
    return mountDrawing(viewport, spec, this.options);
  }
}

/**
 * @param {HTMLElement} viewport
 * @param {ChartSpec} initial
 * @param {Readonly<Required<SvgChartAdapterOptions>>} defaults
 * @returns {ChartHandle}
 */
function mountDrawing(viewport, initial, defaults) {
  assertKind(initial.type);
  const doc = viewport.ownerDocument;
  const controller = new AbortController();
  const legend = doc.createElement('ul');
  legend.className = 'zx-chart__legend';
  const plot = svgElement(doc, 'svg', { class: 'zx-chart__plot', focusable: 'false' });
  const root = doc.createElement('div');
  root.className = 'zx-chart__drawing';
  root.setAttribute('aria-hidden', 'true');
  root.append(legend, plot);
  viewport.append(root);

  let spec = initial;
  let size = '';
  let destroyed = false;

  // One listener for every mark: the mark names its dataset and index.
  root.addEventListener('click', (event) => {
    const target = /** @type {Element|null} */ (event.target);
    const mark = typeof target?.closest === 'function' ? target.closest('[data-index]') : null;
    if (!mark || !root.contains(mark)) return;
    const datasetIndex = Number(mark.getAttribute('data-dataset'));
    const index = Number(mark.getAttribute('data-index'));
    const dataset = spec.data.datasets?.[datasetIndex] ?? null;
    spec.onSelect?.({
      datasetIndex, index, dataset,
      label: spec.data.labels?.[index],
      value: dataset?.data?.[index],
      nativeEvent: event
    });
  }, { signal: controller.signal });

  /** @param {boolean} first @returns {void} */
  const draw = (first) => {
    assertKind(spec.type);
    const options = /** @type {Record<string, unknown>} */ (spec.options ?? {});
    const animation = 'animation' in options ? options.animation !== false : defaults.animation !== false;
    const model = chartModel(spec.data);
    const arcs = ARC_KINDS.has(spec.type);
    const legendSetting = typeof options.legend === 'boolean' ? options.legend : defaults.legend;
    const showLegend = typeof legendSetting === 'boolean' ? legendSetting : arcs || model.series.length > 1;
    root.dataset.type = spec.type;
    // Only the first drawing grows in; a resize, new data or a theme change redraws in place.
    root.toggleAttribute('data-animate', first && animation && !spec.reducedMotion);
    drawLegend(legend, arcs ? model.labels.map((name, index) => ({ name, index })) : model.series, showLegend);
    const box = measure(plot);
    size = `${box.width}×${box.height}`;
    plot.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`);
    plot.replaceChildren();
    const font = fontSize(plot);
    const formats = numberFormats();
    if (arcs) drawArcs(plot, model, box, font, spec.type === 'doughnut', formats);
    else drawCartesian(plot, model, box, font, spec.type, formats);
  };
  draw(true);

  return {
    get instance() { return destroyed ? null : root; },
    update(next) {
      if (destroyed) return;
      spec = next;
      draw(false);
    },
    resize() {
      if (destroyed) return;
      const box = measure(plot);
      if (`${box.width}×${box.height}` !== size) draw(false);
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      controller.abort();
      root.remove();
    }
  };
}

/** @param {string} type @returns {void} */
function assertKind(type) {
  if (!KINDS.includes(type)) {
    throw new TypeError(`SvgChartAdapter draws bar, line, pie and doughnut charts, not "${type}"`);
  }
}

/**
 * The categories and series to draw: as many categories as the longest of the labels and the
 * datasets, a number (or the `y`, else `r`, of a point object) as a value, anything else a gap.
 * @param {ChartData} data
 * @returns {ChartModel}
 */
function chartModel(data) {
  const datasets = Array.isArray(data?.datasets) ? data.datasets : [];
  const labels = Array.isArray(data?.labels) ? data.labels : [];
  const length = datasets.reduce((most, dataset) => Math.max(most, Array.isArray(dataset?.data) ? dataset.data.length : 0), labels.length);
  return {
    labels: Array.from({ length }, (_, index) => String(labels[index] ?? index + 1)),
    series: datasets.map((dataset, index) => ({
      index,
      name: String(dataset?.label ?? translate('chart.series', [index + 1])),
      values: Array.from({ length }, (_, at) => valueOf(Array.isArray(dataset?.data) ? dataset.data[at] : undefined))
    }))
  };
}

/** @param {unknown} raw @returns {number} */
function valueOf(raw) {
  let value = raw;
  if (raw && typeof raw === 'object') value = 'y' in raw ? raw.y : 'r' in raw ? raw.r : undefined;
  return typeof value === 'number' && Number.isFinite(value) ? value : NaN;
}

/**
 * @param {HTMLUListElement} list
 * @param {Array<{name: string, index: number}>} entries
 * @param {boolean} shown
 * @returns {void}
 */
function drawLegend(list, entries, shown) {
  list.hidden = !shown;
  const doc = list.ownerDocument;
  list.replaceChildren(...(shown ? entries : []).map(({ name, index }) => {
    const swatch = doc.createElement('span');
    swatch.className = 'zx-chart__swatch';
    const key = doc.createElement('li');
    key.className = 'zx-chart__key';
    paint(key, index);
    key.append(swatch, doc.createTextNode(name));
    return key;
  }));
}

/**
 * Bars and lines: a value axis with round ticks on the start side, categories along the bottom.
 * @param {SVGSVGElement} plot
 * @param {ChartModel} model
 * @param {{width: number, height: number}} box
 * @param {number} font
 * @param {string} type
 * @param {Formats} formats
 * @returns {void}
 */
function drawCartesian(plot, model, box, font, type, formats) {
  const doc = plot.ownerDocument;
  const { width, height } = box;
  const count = Math.max(1, model.labels.length);
  let low = Infinity;
  let high = -Infinity;
  for (const series of model.series) {
    for (const value of series.values) {
      if (Number.isNaN(value)) continue;
      low = Math.min(low, value);
      high = Math.max(high, value);
    }
  }
  if (low > high) low = high = 0;
  // A bar's length is its value, so bars always stand on zero.
  if (type === 'bar') {
    low = Math.min(0, low);
    high = Math.max(0, high);
  }
  const pad = Math.ceil(font / 3);
  const gap = font / 2;
  const axisHeight = Math.ceil(font * 1.75);
  const top = pad + Math.ceil(font / 2);
  const bottom = pad + axisHeight;
  const intervals = Math.min(8, Math.max(2, Math.floor((height - top - bottom) / (font * 3.5))));
  const scale = niceScale(low, high, intervals);

  // Tick labels first: their width decides where the plot starts.
  const tickText = formats.ticks(scale.ticks, scale.step);
  const yAxis = svgElement(doc, 'g', { class: 'zx-chart__axis', 'data-axis': 'value' });
  const tickLabels = scale.ticks.map((tick) => {
    const label = svgElement(doc, 'text', { class: 'zx-chart__tick', 'text-anchor': 'end', 'dominant-baseline': 'central' });
    label.textContent = tickText(tick);
    yAxis.append(label);
    return label;
  });
  plot.append(yAxis);
  const labelWidth = tickLabels.reduce((most, label) => Math.max(most, textWidth(label, font)), 0);
  const left = pad + Math.ceil(labelWidth) + gap;
  const right = pad;
  const plotWidth = Math.max(1, width - left - right);
  const plotHeight = Math.max(1, height - top - bottom);
  const y = linearScale(scale.min, scale.max, top + plotHeight, top);
  const band = plotWidth / count;

  const grid = svgElement(doc, 'g', { class: 'zx-chart__grid' });
  scale.ticks.forEach((tick, index) => {
    const at = crisp(y(tick));
    grid.append(svgElement(doc, 'line', { class: 'zx-chart__grid-line', x1: left, x2: left + plotWidth, y1: at, y2: at }));
    tickLabels[index].setAttribute('x', String(left - gap));
    tickLabels[index].setAttribute('y', String(round(y(tick))));
  });
  plot.prepend(grid);

  // Category labels: every one where they fit, every second or third where they do not, and
  // shortened only when a single label is wider than any band could be. How often a label fits
  // comes from every label's width, measured off-screen once per distinct text; the labels drawn
  // are then measured as rendered and shortened to their room, so wide glyphs never overlap.
  const xAxis = svgElement(doc, 'g', { class: 'zx-chart__axis', 'data-axis': 'category' });
  plot.append(xAxis);
  const baseline = round(top + plotHeight + pad + font);
  const estimate = textEstimator(xAxis, font);
  let widest = 0;
  for (const text of new Set(model.labels)) widest = Math.max(widest, estimate(text));
  const cap = Math.max(font * 8, band - gap);
  const ellipsis = svgElement(doc, 'text', { class: 'zx-chart__tick' });
  ellipsis.textContent = '…';
  /** @param {number} every @returns {SVGTextElement[]} The labels drawn, every `every`-th. */
  const drawLabels = (every) => {
    const drawn = [];
    for (let index = 0; index < model.labels.length; index += every) {
      const label = svgElement(doc, 'text', { class: 'zx-chart__tick', 'text-anchor': 'middle', x: round(left + band * (index + 0.5)), y: baseline });
      label.textContent = model.labels[index];
      drawn.push(label);
    }
    xAxis.replaceChildren(...drawn, ellipsis);
    return drawn;
  };
  let step = labelStep(Math.min(widest, cap), band, gap);
  let shown = drawLabels(step);
  let widths = shown.map((label) => textWidth(label, font));
  // The off-screen width can fall a little short of the drawn one: thin out once more if it did.
  const drawnStep = labelStep(Math.min(widths.reduce((most, width) => Math.max(most, width), 0), cap), band, gap);
  if (drawnStep > step) {
    step = drawnStep;
    shown = drawLabels(step);
    widths = shown.map((label) => textWidth(label, font));
  }
  const room = step * band - gap;
  // Everything is read before anything is written, so the axis is laid out once.
  const ellipsisWidth = textWidth(ellipsis, font);
  const shortened = shown.map((label, index) => shortenedText(label, widths[index], room, ellipsisWidth));
  ellipsis.remove();
  shown.forEach((label, index) => {
    if (shortened[index] !== null) label.textContent = shortened[index];
  });

  const zero = crisp(y(Math.min(scale.max, Math.max(scale.min, 0))));
  const marks = svgElement(doc, 'g', { class: 'zx-chart__marks' });
  plot.append(marks);
  const seriesCount = model.series.length;
  for (const series of model.series) {
    const group = svgElement(doc, 'g', { class: 'zx-chart__series' });
    paint(group, series.index);
    if (type === 'bar') {
      series.values.forEach((value, index) => {
        if (Number.isNaN(value)) return;
        const slot = barSlots(left + band * index, band, seriesCount, font * 5)[series.index];
        const end = y(value);
        const bar = svgElement(doc, 'rect', {
          class: 'zx-chart__bar zx-chart__mark',
          x: round(slot.x), y: round(Math.min(end, zero)), width: round(slot.width), height: round(Math.abs(zero - end)),
          'data-dataset': series.index, 'data-index': index
        });
        if (value < 0) bar.setAttribute('data-negative', '');
        titled(bar, `${model.labels[index]} · ${series.name}: ${formats.value(value)}`);
        group.append(bar);
      });
    } else {
      const points = series.values.map((value, index) => (Number.isNaN(value) ? null
        : /** @type {[number, number]} */ ([left + band * (index + 0.5), y(value)])));
      group.append(svgElement(doc, 'path', { class: 'zx-chart__line', d: linePath(points) }));
      // A point is drawn where there is room, and always where it stands alone: a value between
      // two gaps has no line to show it. Where the points are too dense to draw, each value keeps
      // a target that names it and can be pressed, unpainted and no wider than its band.
      const radius = Math.max(2, font / 4);
      points.forEach((point, index) => {
        if (!point) return;
        const alone = !points[index - 1] && !points[index + 1];
        const hidden = band < font && !alone;
        const dot = svgElement(doc, 'circle', {
          class: 'zx-chart__point zx-chart__mark', cx: round(point[0]), cy: round(point[1]),
          r: round(hidden ? Math.max(0.5, Math.min(radius, band / 2)) : radius),
          'data-dataset': series.index, 'data-index': index
        });
        if (hidden) dot.setAttribute('data-hit', '');
        titled(dot, `${model.labels[index]} · ${series.name}: ${formats.value(series.values[index])}`);
        group.append(dot);
      });
    }
    marks.append(group);
  }
  plot.append(svgElement(doc, 'line', { class: 'zx-chart__baseline', x1: left, x2: left + plotWidth, y1: zero, y2: zero }));
}

/**
 * Pie and doughnut: one ring per dataset, outermost first, a slice per positive value coloured
 * by its category.
 * @param {SVGSVGElement} plot
 * @param {ChartModel} model
 * @param {{width: number, height: number}} box
 * @param {number} font
 * @param {boolean} doughnut
 * @param {Formats} formats
 * @returns {void}
 */
function drawArcs(plot, model, box, font, doughnut, formats) {
  const doc = plot.ownerDocument;
  const pad = Math.ceil(font / 3);
  const radius = Math.max(1, Math.min(box.width, box.height) / 2 - pad);
  const cx = round(box.width / 2);
  const cy = round(box.height / 2);
  const gap = Math.max(1, font / 8);
  const rings = ringRadii(model.series.length, radius, doughnut ? DOUGHNUT_HOLE : 0, gap * 2);
  const group = svgElement(doc, 'g', { class: 'zx-chart__ring' });
  group.style.transformOrigin = `${cx}px ${cy}px`;
  model.series.forEach((series, ring) => {
    const { outer, inner } = rings[ring];
    const slices = arcSlices(series.values, gap / outer);
    if (!slices.length) {
      group.append(svgElement(doc, 'path', { class: 'zx-chart__track', d: arcPath(cx, cy, outer, inner, 0, Math.PI * 2) }));
      return;
    }
    for (const slice of slices) {
      const path = svgElement(doc, 'path', {
        class: 'zx-chart__slice zx-chart__mark', d: arcPath(cx, cy, outer, inner, slice.start, slice.end),
        'data-dataset': series.index, 'data-index': slice.index
      });
      paint(path, slice.index);
      titled(path, `${model.labels[slice.index]} · ${series.name}: ${formats.value(slice.value)} (${formats.percent(slice.share)})`);
      group.append(path);
    }
  });
  plot.append(group);
}

/**
 * Names the palette slot an element is painted with: `data-series` 1 to 8, and `data-cycle="2"`
 * for every second pass through the palette, which CSS draws lighter or dashed.
 * @param {Element} element @param {number} index Series or category index.
 * @returns {void}
 */
function paint(element, index) {
  element.setAttribute('data-series', String((index % PALETTE_SIZE) + 1));
  if (Math.floor(index / PALETTE_SIZE) % 2 === 1) element.setAttribute('data-cycle', '2');
}

/** @param {Element} mark @param {string} text @returns {void} */
function titled(mark, text) {
  const title = svgElement(mark.ownerDocument, 'title', {});
  title.textContent = text;
  mark.append(title);
}

/**
 * The plot's size in CSS pixels, which becomes its `viewBox`: one user unit is one pixel, so text
 * keeps the size its stylesheet gives it.
 * @param {SVGSVGElement} plot
 * @returns {{width: number, height: number}}
 */
function measure(plot) {
  const rect = typeof plot.getBoundingClientRect === 'function' ? plot.getBoundingClientRect() : null;
  const width = Math.round(rect?.width ?? 0);
  const height = Math.round(rect?.height ?? 0);
  return width > 0 && height > 0 ? { width, height } : { ...UNMEASURED };
}

/** @param {Element} element @returns {number} The element's computed text size in pixels. */
function fontSize(element) {
  const view = element.ownerDocument.defaultView;
  const size = view && typeof view.getComputedStyle === 'function' ? parseFloat(view.getComputedStyle(element).fontSize) : NaN;
  return size > 0 ? size : DEFAULT_FONT;
}

/**
 * The rendered width of a text element, or an estimate where nothing is rendered.
 * @param {SVGTextElement} text @param {number} font
 * @returns {number}
 */
function textWidth(text, font) {
  let width = 0;
  try { width = typeof text.getComputedTextLength === 'function' ? text.getComputedTextLength() : 0; } catch { width = 0; }
  return width > 0 ? width : (text.textContent ?? '').length * font * 0.6;
}

/**
 * A cheap width for any text in an element's font: measured off-screen on a canvas, without
 * laying anything out, or estimated from the text size where there is no canvas. Close to what
 * the SVG draws, not exact (font features apply only there).
 * @param {Element} element @param {number} font
 * @returns {(text: string) => number}
 */
function textEstimator(element, font) {
  const doc = element.ownerDocument;
  const view = doc.defaultView;
  /** @type {CanvasRenderingContext2D|null} */
  let context = null;
  try { context = doc.createElement('canvas').getContext('2d'); } catch { context = null; }
  if (!context || !view || typeof view.getComputedStyle !== 'function') return (text) => text.length * font * 0.6;
  const style = view.getComputedStyle(element);
  context.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  if (typeof context.letterSpacing === 'string' && style.letterSpacing !== 'normal') context.letterSpacing = style.letterSpacing;
  const measuring = context;
  return (text) => measuring.measureText(text).width;
}

/**
 * The text a category label is shortened to so that it fits `room`, or null when it fits as it
 * is: the longest start that leaves space for the ellipsis, measured as rendered where the
 * browser can say, estimated from the label's own average glyph width where it cannot. It only
 * reads, so the labels of an axis are measured in one layout.
 * @param {SVGTextElement} label @param {number} width Its rendered width.
 * @param {number} room @param {number} ellipsis Width of "…".
 * @returns {string|null}
 */
function shortenedText(label, width, room, ellipsis) {
  const text = label.textContent ?? '';
  if (width <= room || text.length < 2) return null;
  const target = room - ellipsis;
  /** @param {number} count @returns {number} Width of the first `count` characters, or NaN. */
  const prefix = (count) => {
    try { return typeof label.getSubStringLength === 'function' ? label.getSubStringLength(0, count) : NaN; } catch { return NaN; }
  };
  let keep;
  if (prefix(text.length) > 0) {
    let low = 0;
    let high = text.length - 1;
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      if (prefix(middle) <= target) low = middle;
      else high = middle - 1;
    }
    keep = low;
  } else {
    keep = Math.floor(target / (width / text.length));
  }
  keep = Math.min(text.length - 1, Math.max(1, keep));
  // Never between the halves of a surrogate pair.
  const code = text.charCodeAt(keep - 1);
  if (code >= 0xd800 && code <= 0xdbff && keep > 1) keep -= 1;
  return `${text.slice(0, keep).trimEnd() || text.slice(0, keep)}…`;
}

/**
 * Number formats for the active language: ticks compact ("250K") with exactly the digits that
 * tell them apart, values as the summary table writes them.
 * @returns {Formats}
 */
function numberFormats() {
  const locale = getLanguage() || undefined;
  /** @param {Intl.NumberFormatOptions} options @returns {Intl.NumberFormat} */
  const make = (options) => {
    try { return new Intl.NumberFormat(locale, options); } catch { return new Intl.NumberFormat(undefined, options); }
  };
  const whole = make({ maximumFractionDigits: 0 });
  const precise = make({ maximumSignificantDigits: 12 });
  const percent = make({ style: 'percent', maximumFractionDigits: 1 });
  return {
    ticks(ticks, step) {
      const format = make({ notation: 'compact', maximumSignificantDigits: tickPrecision(ticks, step) });
      return (value) => format.format(value);
    },
    value: (value) => (Number.isInteger(value) ? whole : precise).format(value),
    percent: (value) => percent.format(value)
  };
}

/**
 * @template {keyof SVGElementTagNameMap} K
 * @param {Document} doc @param {K} tag @param {Record<string, string|number>} attributes
 * @returns {SVGElementTagNameMap[K]}
 */
function svgElement(doc, tag, attributes) {
  const element = /** @type {SVGElementTagNameMap[K]} */ (doc.createElementNS(SVG_NS, tag));
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, String(value));
  return element;
}

/** @param {number} value @returns {number} Two decimals. */
function round(value) {
  return Math.round(value * 100) / 100;
}

/** @param {number} value @returns {number} A hairline's position on the pixel grid. */
function crisp(value) {
  return Math.round(value) + 0.5;
}
