import { Component } from '../../core/component.js';
import { h } from '../../core/dom.js';
import { formatNumber } from '../../core/format.js';
import { translate } from '../../core/i18n.js';
import { prefersReducedMotion, watchMotion } from '../../core/motion.js';
import { uid } from '../../core/util.js';
import { engineColor, withAlpha } from './color.js';

/** @typedef {{label?: string, data?: unknown[], [key: string]: unknown}} ChartDataset */
/** @typedef {{labels?: unknown[], datasets?: ChartDataset[], [key: string]: unknown}} ChartData */
/** @typedef {(key: string, ...args: unknown[]) => string} ChartText Resolves a message. */
/**
 * @typedef {Object} ChartTheme
 * The theme as the chart root resolves it, read when the engine is created and again on every
 * update. Every colour is a string a CSS Color 3 parser reads: `#rrggbb` when opaque,
 * `rgba(r, g, b, a)` when translucent — never `color()`, `oklch()`, `light-dark()` or a `var()`.
 * @property {string} [color] Text colour, from `--zx-color-text`. Absent where the token is not
 *   defined (no Zx stylesheet).
 * @property {string} [borderColor] Grid and axis line colour, from `--zx-color-border`. Absent
 *   where the token is not defined.
 * @property {string[]} palette The categorical series colours, `--zx-color-chart-1` to `-8`, in
 *   order; empty where the tokens are not defined. Series beyond the eighth start over.
 */
/**
 * @typedef {Object} ChartSpec
 * What a `ChartAdapter` receives in `create()` and in every `update()`.
 * @property {string} type Chart type.
 * @property {ChartData} data Chart data.
 * @property {Record<string, unknown>} options Engine-specific options: the application's
 *   `chartOptions`, over `color` and `borderColor` from the theme (the same strings as
 *   `theme.color` and `theme.borderColor`, in the shape Chart.js reads them).
 * @property {ChartTheme} theme Resolved theme colours, including the categorical palette.
 * @property {boolean} reducedMotion Whether the chart must not animate: the operating system asks
 *   for reduced motion, or the host sits inside a `data-zx-motion="reduced"` region. An adapter turns
 *   its engine's own animation off when this is true; `ChartJsAdapter` sets `animation: false`.
 * @property {(detail: ChartSelectDetail) => void} onSelect Point-selection callback.
 */
/**
 * @typedef {Object} ChartHandle
 * @property {(spec: ChartSpec) => void} update Update the mounted chart. Called for new data, type
 *   or options, and whenever the theme or the motion preference changes.
 * @property {() => void} resize Resize the mounted chart; called when the viewport changes size.
 * @property {() => void} destroy Destroy the mounted chart.
 * @property {unknown} [instance] Engine instance.
 */
/**
 * @typedef {Object} ChartAdapter
 * The contract between Chart and a chart engine.
 * @property {(canvas: HTMLCanvasElement, spec: ChartSpec) => ChartHandle} create Creates the
 *   engine. Chart calls it once the canvas is connected to a document and its viewport has a size,
 *   so the engine can measure the canvas and `spec.theme` carries real values; a chart that is
 *   loading, empty or in error has no engine. Where the environment has no `ResizeObserver`, or no
 *   layout at all, there is nothing to wait for and `create()` runs as soon as the chart has data.
 */
/**
 * @typedef {Object} ChartSummaryContext
 * @property {ChartDataset} dataset The series the value belongs to.
 * @property {number} datasetIndex Index of that series in `data.datasets`.
 * @property {number} index Index of the value in the series, and of its row in the table.
 * @property {unknown} label Entry of `data.labels` at that index; undefined where there is none.
 * @property {unknown} raw The entry of `dataset.data` as it was given — the whole point object
 *   where `value` is its `y` or `r`.
 * @property {string} formatted The text the table would show without `summaryFormat`.
 */
/**
 * @typedef {(value: unknown, context: ChartSummaryContext) => string|null|undefined} ChartSummaryFormat
 * Formats one cell of the summary table. `value` is the data entry, or `y` (else `r`) of a point
 * object; the returned text is the cell, and null or undefined keeps `context.formatted`.
 */
/**
 * @typedef {Object} ChartJsAdapterOptions
 * Generated API marker for the adapter class; its constructor accepts an injected engine and
 * optional defaults directly rather than a component options object.
 */
/**
 * @typedef {Object} ChartSelectDetail
 * @property {number} datasetIndex Dataset index.
 * @property {number} index Data index.
 * @property {ChartDataset|null} dataset Dataset definition.
 * @property {unknown} label Label at the selected index.
 * @property {unknown} value Data value.
 * @property {Event|null} nativeEvent Engine-native event when available.
 */
/**
 * @typedef {Object} ChartOptions
 * @property {ChartAdapter|null} [adapter=null] Injected engine adapter.
 * @property {string} [type='bar'] Chart type passed to the adapter.
 * @property {ChartData} [data={labels: [], datasets: []}] Chart data.
 * @property {Record<string, unknown>} [chartOptions={}] Engine-specific options.
 * @property {string|null} [label=null] Accessible canvas and summary label; null or blank text reads
 *   the `chart.label` message ("Chart").
 * @property {string} [description=''] Accessible description.
 * @property {'hidden'|'visible'} [summary='hidden'] Semantic data-table presentation.
 * @property {ChartSummaryFormat|null} [summaryFormat=null] Formats a summary-table value. Without
 *   it a number is written for the active language (`lang`, else `getLanguage()`) with grouping and
 *   up to twelve significant digits — `1234567.5` reads "1,234,567.5", `0.1 + 0.2` reads "0.3" —
 *   and any other value as its own text.
 * @property {boolean} [loading=false] Initial loading state.
 * @property {string|null} [emptyText] Empty-state text, by default the `chart.empty` message
 *   ("No chart data"). Null shows none.
 * @property {string|null} [loadingText] Loading-state text, by default the `chart.loading` message
 *   ("Loading chart…"). Null shows none.
 * @property {string|null} [errorText] Error fallback text, by default the `chart.error` message
 *   ("Unable to render chart"). Null shows none.
 * @property {string} [aspectRatio='16 / 9'] Responsive container aspect ratio. Not used in
 *   `fill` mode.
 * @property {boolean} [fill=false] Takes the block size of the container instead of deriving it
 *   from `aspectRatio`: the root is 100% tall and the viewport takes what the description and a
 *   visible summary leave. The container needs a height of its own. The minimum viewport height
 *   is the `--zx-chart-min-block-size` custom property: 220px by default, none in `fill` mode.
 * @property {(event: CustomEvent<{instance: unknown}>) => void} [onready] Engine-ready listener.
 * @property {(event: CustomEvent<{data: ChartData, type: string}>) => void} [onupdate] Update listener.
 * @property {(event: CustomEvent<ChartSelectDetail>) => void} [onselect] Point-selection listener.
 * @property {(event: CustomEvent<{error: unknown}>) => void} [onerror] Engine error listener.
 */

/**
 * Accessible, engine-neutral chart host with explicit adapter lifecycle.
 * @fires Chart#ready
 * @fires Chart#update
 * @fires Chart#select
 * @fires Chart#error
 * @extends {Component<ChartOptions>}
 */
export class Chart extends Component {
  static cssName = 'chart';

  /** @type {Readonly<ChartOptions>} */
  static defaults = {
    adapter: null,
    type: 'bar',
    data: { labels: [], datasets: [] },
    chartOptions: {},
    label: null,
    description: '',
    summary: 'hidden',
    summaryFormat: null,
    loading: false,
    // Undefined rather than null, which shows nothing.
    emptyText: undefined,
    loadingText: undefined,
    errorText: undefined,
    aspectRatio: '16 / 9',
    fill: false
  };

  /**
   * Creates or enhances a chart host.
   * @param {Element|string|null} target Chart target.
   * @param {ChartOptions} [options={}] Chart options.
   */
  constructor(target = null, options = {}) {
    super(target, options);
    this._mountOrUpdate(false);
  }

  /** @returns {HTMLElement} */
  render() {
    this._createdRoot = this.el === null;
    const root = /** @type {HTMLElement} */ (this.el ?? h('div'));
    this.el = root;
    this._original = this._createdRoot ? null : {
      attributes: Array.from(root.attributes, (attribute) => [attribute.name, attribute.value]),
      children: Array.from(root.childNodes)
    };
    this._adapter = this.options.adapter;
    this._type = String(this.options.type || 'bar');
    this._data = normalizeChartData(this.options.data);
    this._label = String(this.options.label ?? '').trim() || this.msg('chart.label');
    this._chartOptions = cloneChartValue(this.options.chartOptions);
    this._loading = Boolean(this.options.loading);
    this._error = null;
    this._hasError = false;
    this._handle = null;
    this._destroyed = false;
    this._themeKey = '';
    this._sized = false;

    const descriptionId = uid('zx-chart-description');
    const canvas = /** @type {HTMLCanvasElement} */ (h('canvas', {
      ref: 'canvas',
      class: 'zx-chart__canvas',
      role: 'img',
      ariaLabel: this._label,
      ariaDescribedby: descriptionId
    }));
    const viewport = h('div', {
      ref: 'viewport',
      class: 'zx-chart__viewport'
    }, canvas);
    viewport.style.setProperty('--zx-chart-aspect-ratio', aspectRatioText(this.options.aspectRatio));
    root.toggleAttribute('data-fill', Boolean(this.options.fill));
    const description = h('p', {
      ref: 'description',
      class: 'zx-chart__description',
      id: descriptionId
    }, this.options.description);
    const status = h('div', {
      ref: 'status',
      class: 'zx-chart__status',
      role: 'status',
      ariaLive: 'polite'
    });
    const summary = h('div', {
      ref: 'summary',
      class: 'zx-chart__summary',
      dataset: { summary: this.options.summary === 'visible' ? 'visible' : 'hidden' }
    });
    root.replaceChildren(viewport, description, status, summary);
    this._renderSummary();
    this._syncState();

    // The viewport has no size until the root is connected and displayed, and loses it when the
    // root leaves the document: one observer both creates the engine at the right moment and
    // keeps it sized. Constructed on a target that is already laid out, the chart does not wait
    // for it — the constructor mounts synchronously.
    this._observer = typeof ResizeObserver === 'function'
      ? new ResizeObserver((entries) => this._viewportResized(entries))
      : null;
    this._observer?.observe(viewport);
    // Theme colours reach the engine as values, not as CSS, so a theme switch has to be noticed:
    // the theme and preset attributes anywhere in the document, and the system preferences the
    // tokens answer to.
    this._themeObserver = typeof MutationObserver === 'function'
      ? new MutationObserver(() => this._syncTheme())
      : null;
    const documentElement = root.ownerDocument?.documentElement;
    if (documentElement) {
      this._themeObserver?.observe(documentElement, { attributes: true, attributeFilter: THEME_ATTRIBUTES, subtree: true });
    }
    for (const query of THEME_QUERIES) {
      const media = typeof globalThis.matchMedia === 'function' ? globalThis.matchMedia(query) : null;
      if (typeof media?.addEventListener === 'function') this.listen(media, 'change', () => this._syncTheme());
    }
    // The engine tweens in script, where no stylesheet can reach it: when motion is reduced, or
    // stops being reduced, the mounted chart is updated with the new answer in its spec.
    this._stopWatchingMotion = watchMotion(root, () => this._mountOrUpdate(false));
    return root;
  }

  /** Replaces chart data and updates or mounts the engine. @param {ChartData} data @returns {this} */
  setData(data) {
    this._data = normalizeChartData(data);
    this._error = null;
    this._hasError = false;
    this._loading = false;
    this._renderSummary();
    this._mountOrUpdate(true);
    return this;
  }

  /** Changes the chart type and updates/recreates the engine as needed. @param {string} type @returns {this} */
  setType(type) {
    this._type = String(type || 'bar');
    this._mountOrUpdate(true);
    return this;
  }

  /** Replaces engine-specific options. @param {Record<string, unknown>} options @returns {this} */
  update(options) {
    this._chartOptions = cloneChartValue(options && typeof options === 'object' ? options : {});
    this._mountOrUpdate(true);
    return this;
  }

  /** Replaces the engine adapter. @param {ChartAdapter|null} adapter @returns {this} */
  setAdapter(adapter) {
    this._destroyHandle();
    this._adapter = adapter;
    this._mountOrUpdate(false);
    return this;
  }

  /** Toggles loading state. Loading charts do not keep an engine instance alive. @param {boolean} [loading=true] @returns {this} */
  setLoading(loading = true) {
    this._loading = Boolean(loading);
    if (this._loading) this._destroyHandle();
    else this._mountOrUpdate(false);
    this._syncState();
    return this;
  }

  /** Shows an error and destroys the current engine. @param {unknown} error @returns {this} */
  setError(error) {
    this._error = error ?? new Error(this._errorText());
    this._hasError = true;
    this._loading = false;
    this._destroyHandle();
    this._syncState();
    this.emit('error', { error: this._error });
    return this;
  }

  /** Clears the error and remounts when data and an adapter are available. @returns {this} */
  clearError() {
    this._error = null;
    this._hasError = false;
    this._mountOrUpdate(false);
    return this;
  }

  /**
   * Changes the accessible name of the canvas and the caption of the summary table.
   * @param {string|null} label Label; null or blank text reads the `chart.label` message.
   * @returns {this}
   */
  setLabel(label) {
    this._label = String(label ?? '').trim() || this.msg('chart.label');
    this.refs.canvas.setAttribute('aria-label', this._label);
    this._renderSummary();
    return this;
  }

  /**
   * Changes the description under the chart, which also describes the canvas.
   * @param {string|null} description Description; null or empty text shows none.
   * @returns {this}
   */
  setDescription(description) {
    this.refs.description.textContent = String(description ?? '');
    return this;
  }

  /**
   * Shows the summary table or leaves it to assistive technology only.
   * @param {'hidden'|'visible'} summary Presentation.
   * @returns {this}
   */
  setSummary(summary) {
    this.refs.summary.dataset.summary = summary === 'visible' ? 'visible' : 'hidden';
    return this;
  }

  /**
   * Changes the aspect ratio of the viewport. It has no effect while the chart is in `fill` mode.
   * @param {string|number|null} aspectRatio A CSS `aspect-ratio` value such as `'16 / 9'` or `2`;
   *   null or blank text restores the default.
   * @returns {this}
   */
  setAspectRatio(aspectRatio) {
    this.refs.viewport.style.setProperty('--zx-chart-aspect-ratio', aspectRatioText(aspectRatio));
    return this;
  }

  /**
   * Switches `fill` mode, in which the chart takes the block size of its container.
   * @param {boolean} [fill=true] Whether to fill the container.
   * @returns {this}
   */
  setFill(fill = true) {
    this.el.toggleAttribute('data-fill', Boolean(fill));
    return this;
  }

  /**
   * Requests an engine resize. The chart follows its viewport on its own; this is for an engine
   * that needs telling after something else changed.
   * @returns {this}
   */
  resize() {
    if (!this._handle) {
      this._mountOrUpdate(false);
      return this;
    }
    try { this._handle.resize?.(); } catch (error) { this.setError(error); }
    return this;
  }

  /**
   * Re-applies computed theme values through the adapter update path. The chart does this itself
   * when a `data-zx-theme` or `data-zx-preset` attribute changes anywhere in the document, when the
   * system colour scheme or contrast preference changes, and when it is shown again after being
   * hidden or moved; call it after changing tokens in a way none of those cover — a stylesheet
   * swap, a class, or an inline custom property.
   * @returns {this}
   */
  refreshTheme() {
    this._mountOrUpdate(true);
    return this;
  }

  /**
   * Returns the underlying engine instance when the adapter exposes it. The engine exists once
   * the chart is connected, displayed, and has data; asking for it right after appending the
   * chart creates it then rather than on the next frame.
   * @returns {unknown} Null while there is no engine.
   */
  getInstance() {
    if (!this._handle) this._mountOrUpdate(false);
    return this._handle?.instance ?? null;
  }

  /** Destroys the engine/observer and restores or removes the host. @returns {void} */
  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    const original = this._original;
    this._observer?.disconnect();
    this._themeObserver?.disconnect();
    this._stopWatchingMotion?.();
    this._destroyHandle();
    super.destroy();
    if (!this._createdRoot && original) {
      for (const attribute of Array.from(this.el.attributes)) this.el.removeAttribute(attribute.name);
      for (const [name, value] of original.attributes) this.el.setAttribute(name, value);
      this.el.replaceChildren(...original.children);
    }
  }

  /** @param {boolean} emitUpdate @returns {void} */
  _mountOrUpdate(emitUpdate) {
    if (this._destroyed) return;
    this._syncState();
    if (this._loading || this._hasError || isEmptyChartData(this._data)) {
      this._destroyHandle();
      return;
    }
    if (!this._adapter || typeof this._adapter.create !== 'function') {
      this._destroyHandle();
      return;
    }
    // Not connected or not laid out yet: the viewport observer comes back here when it is.
    if (!this._handle && !this._canMount()) return;
    const spec = this._spec();
    try {
      if (this._handle) this._handle.update(spec);
      else {
        this._handle = this._adapter.create(/** @type {HTMLCanvasElement} */ (this.refs.canvas), spec);
        if (!this._handle || typeof this._handle.destroy !== 'function') {
          throw new TypeError('Chart adapter create() must return a lifecycle handle');
        }
        this.emit('ready', { instance: this.getInstance() });
      }
      if (emitUpdate) this.emit('update', { data: this._data, type: this._type });
    } catch (error) {
      this.setError(error);
    }
  }

  /**
   * Whether an engine can be created now: the canvas is in a document and its viewport has a size.
   * An environment that cannot say — no `ResizeObserver` to report the size later, or no layout at
   * all (jsdom measures everything as zero) — is not made to wait for an answer it will never get.
   * @returns {boolean}
   */
  _canMount() {
    if (!this._observer) return true;
    const viewport = /** @type {HTMLElement} */ (this.refs.viewport);
    if (!viewport.isConnected) return false;
    const { width, height } = viewport.getBoundingClientRect();
    if (width > 0 && height > 0) return true;
    const page = viewport.ownerDocument.documentElement.getBoundingClientRect();
    return page.width === 0 && page.height === 0;
  }

  /**
   * The viewport changed size: create the engine if it was waiting for one, otherwise resize it.
   * A viewport that had no size and has one again was hidden or moved, possibly into another
   * theme region, so the theme is read again too.
   * @param {ResizeObserverEntry[]} entries
   * @returns {void}
   */
  _viewportResized(entries) {
    if (this._destroyed) return;
    const box = entries[entries.length - 1]?.contentRect;
    const sized = Boolean(box && box.width > 0 && box.height > 0);
    const shown = sized && !this._sized;
    this._sized = sized;
    if (!this._handle) {
      this._mountOrUpdate(false);
      return;
    }
    if (shown) this._syncTheme();
    this.resize();
  }

  /** Updates the engine when the theme it was given is no longer the one the root resolves. @returns {void} */
  _syncTheme() {
    if (this._destroyed || !this._handle) return;
    if (themeKey(chartTheme(/** @type {HTMLElement} */ (this.el))) === this._themeKey) return;
    this._mountOrUpdate(false);
  }

  /** @returns {ChartSpec} */
  _spec() {
    const theme = chartTheme(/** @type {HTMLElement} */ (this.el));
    this._themeKey = themeKey(theme);
    const themed = {};
    if (theme.color) themed.color = theme.color;
    if (theme.borderColor) themed.borderColor = theme.borderColor;
    return {
      type: this._type,
      data: cloneChartValue(this._data),
      options: { ...themed, ...cloneChartValue(this._chartOptions) },
      theme,
      reducedMotion: prefersReducedMotion(this.el),
      onSelect: (detail) => this.emit('select', detail)
    };
  }

  /** @returns {void} */
  _destroyHandle() {
    if (!this._handle) return;
    const handle = this._handle;
    this._handle = null;
    try { handle.destroy(); } catch { /* teardown must remain safe */ }
  }

  /** @returns {void} */
  _syncState() {
    const empty = isEmptyChartData(this._data);
    const state = this._loading ? 'loading' : this._hasError ? 'error' : empty ? 'empty' : 'ready';
    this.el.dataset.state = state;
    this.refs.viewport.hidden = state !== 'ready';
    const { loadingText = this.msg('chart.loading'), emptyText = this.msg('chart.empty') } = this.options;
    let text = '';
    if (state === 'loading') text = String(loadingText ?? '');
    else if (state === 'error') text = errorMessage(this._error, this._errorText());
    else if (state === 'empty') text = String(emptyText ?? '');
    this.refs.status.textContent = text;
    this.refs.status.hidden = !text;
  }

  /** @returns {string} What an error without a message of its own says. */
  _errorText() {
    const { errorText = this.msg('chart.error') } = this.options;
    return String(errorText ?? '');
  }

  /** @returns {void} */
  _renderSummary() {
    this.refs.summary.replaceChildren(summaryTable(this._data, this._label, (key, ...args) => this.msg(key, ...args), {
      locale: this.options.lang ?? this.options.language ?? undefined,
      format: typeof this.options.summaryFormat === 'function' ? this.options.summaryFormat : null
    }));
  }
}

/**
 * Adapter for an injected Chart.js 4 constructor or namespace.
 */
export class ChartJsAdapter {
  /**
   * @param {Function|{Chart?: Function}} engine Injected Chart.js constructor or namespace.
   * @param {Record<string, unknown>} [defaults={}] Adapter-wide Chart.js options.
   */
  constructor(engine, defaults = {}) {
    const constructor = typeof engine === 'function' ? engine : engine?.Chart;
    if (typeof constructor !== 'function') throw new TypeError('ChartJsAdapter requires an injected Chart.js constructor');
    this.engine = constructor;
    this.defaults = cloneChartValue(defaults);
  }

  /**
   * Creates one Chart.js lifecycle handle.
   * @param {HTMLCanvasElement} canvas Canvas.
   * @param {ChartSpec} spec Initial chart specification.
   * @returns {ChartHandle}
   */
  create(canvas, spec) {
    const Engine = this.engine;
    let instance = null;
    let currentType = '';
    let destroyed = false;

    const build = (next) => {
      let created = null;
      const config = chartJsConfig(next, this.defaults, () => created);
      created = new Engine(canvas, config);
      instance = created;
      currentType = next.type;
    };
    build(spec);

    return {
      get instance() { return instance; },
      update: (next) => {
        if (destroyed) return;
        if (next.type !== currentType) {
          const previous = instance;
          instance = null;
          previous?.destroy?.();
          build(next);
          return;
        }
        const config = chartJsConfig(next, this.defaults, () => instance);
        instance.data = config.data;
        instance.options = config.options;
        instance.update();
      },
      resize: () => { if (!destroyed) instance?.resize?.(); },
      destroy: () => {
        if (destroyed) return;
        destroyed = true;
        instance?.destroy?.();
        instance = null;
      }
    };
  }
}

/** @param {ChartSpec} spec @param {Record<string, unknown>} defaults @param {() => any} getInstance @returns {Record<string, unknown>} */
function chartJsConfig(spec, defaults, getInstance) {
  const supplied = cloneChartValue(spec.options);
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    ...cloneChartValue(defaults),
    ...supplied
  };
  // Reduced motion wins over any animation the application configured: a person who asked for
  // less motion gets it from every chart, not only from the ones that remembered to ask.
  if (spec.reducedMotion) options.animation = false;
  const originalClick = options.onClick;
  options.onClick = (event, elements, chart) => {
    if (typeof originalClick === 'function') originalClick(event, elements, chart);
    const instance = getInstance() ?? chart;
    const points = Array.isArray(elements) && elements.length ? elements
      : instance?.getElementsAtEventForMode?.(event, 'nearest', { intersect: true }, true) ?? [];
    const point = points[0];
    if (!point) return;
    const dataset = spec.data.datasets?.[point.datasetIndex] ?? null;
    spec.onSelect({
      datasetIndex: point.datasetIndex,
      index: point.index,
      dataset,
      label: spec.data.labels?.[point.index],
      value: dataset?.data?.[point.index],
      nativeEvent: event?.native ?? event ?? null
    });
  };
  return { type: spec.type, data: paletteChartData(cloneChartValue(spec.data), spec.type, spec.theme?.palette), options };
}

/** Chart.js types whose single dataset is coloured per value rather than per series. */
const ARC_TYPES = new Set(['pie', 'doughnut', 'polarArea']);

/**
 * Gives every dataset that names no colour of its own one from the theme palette: per series, or
 * per value for the arc types. A dataset with a `backgroundColor` or a `borderColor` is left
 * exactly as the application wrote it.
 * @param {ChartData} data Chart data, already a copy.
 * @param {string} type Chart type.
 * @param {string[]} [palette] Resolved palette.
 * @returns {ChartData}
 */
function paletteChartData(data, type, palette) {
  if (!Array.isArray(palette) || !palette.length || !Array.isArray(data?.datasets)) return data;
  const colour = (index) => palette[index % palette.length];
  data.datasets.forEach((dataset, index) => {
    if (!dataset || typeof dataset !== 'object') return;
    if (dataset.backgroundColor !== undefined || dataset.borderColor !== undefined) return;
    const datasetType = String(dataset.type ?? type);
    if (ARC_TYPES.has(datasetType)) {
      dataset.backgroundColor = (Array.isArray(dataset.data) ? dataset.data : []).map((_, point) => colour(point));
      return;
    }
    dataset.borderColor = colour(index);
    // A bar is its fill; a line, radar or point series fills under and inside its stroke.
    dataset.backgroundColor = datasetType === 'bar' ? colour(index) : withAlpha(colour(index), 0.5) ?? colour(index);
  });
  return data;
}

/**
 * Clones arrays and plain objects while preserving callbacks and engine-specific object instances.
 * @template T
 * @param {T} value Value.
 * @returns {T}
 */
export function cloneChartValue(value) {
  return cloneValue(value, new WeakMap());
}

/** @template T @param {T} value @param {WeakMap<object, object>} seen @returns {T} */
function cloneValue(value, seen) {
  if (Array.isArray(value)) {
    if (seen.has(value)) return /** @type {T} */ (seen.get(value));
    const copy = [];
    seen.set(value, copy);
    copy.push(...value.map((item) => cloneValue(item, seen)));
    return /** @type {T} */ (copy);
  }
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    if (seen.has(value)) return /** @type {T} */ (seen.get(value));
    const copy = {};
    seen.set(value, copy);
    for (const [key, item] of Object.entries(value)) copy[key] = cloneValue(item, seen);
    return /** @type {T} */ (copy);
  }
  return value;
}

/** @param {unknown} data @returns {ChartData} */
function normalizeChartData(data) {
  if (!data || typeof data !== 'object') return { labels: [], datasets: [] };
  return cloneChartValue({
    ...data,
    labels: Array.isArray(data.labels) ? data.labels : [],
    datasets: Array.isArray(data.datasets) ? data.datasets : []
  });
}

/** @param {ChartData} data @returns {boolean} */
export function isEmptyChartData(data) {
  return !Array.isArray(data?.datasets) || !data.datasets.some((dataset) => Array.isArray(dataset?.data) && dataset.data.length > 0);
}

/** The catalogue, for the summary helpers when no Chart called them. @type {ChartText} */
const catalogueText = (key, ...args) => translate(key, args);

/**
 * Builds the semantic table mirrored alongside the canvas.
 * @param {ChartData} data Chart data.
 * @param {string} [label] Caption, by default the `chart.summary` message ("Chart data").
 * @returns {HTMLTableElement}
 */
export function chartSummaryTable(data, label = translate('chart.summary')) {
  return summaryTable(data, label, catalogueText, {});
}

/**
 * @param {ChartData} data Chart data.
 * @param {string} label Caption.
 * @param {ChartText} text Resolves the table's own words; a Chart passes its `msg()`.
 * @param {SummaryFormatting} formatting How values are written.
 * @returns {HTMLTableElement}
 */
function summaryTable(data, label, text, formatting) {
  const summary = summaryModel(data, text, formatting);
  const table = /** @type {HTMLTableElement} */ (h('table', { class: 'zx-chart__table' },
    h('caption', {}, label),
    h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, text('chart.summaryLabel')),
      summary.headers.map((header) => h('th', { scope: 'col' }, header)))),
    h('tbody', {}, summary.rows.map((row) => h('tr', {},
      h('th', { scope: 'row' }, row.label),
      row.values.map((value) => h('td', {}, value)))))));
  return table;
}

/**
 * Produces the exact text matrix rendered by the semantic chart summary, with numbers written for
 * the active language.
 * @param {ChartData} data Chart data.
 * @returns {{headers: string[], rows: Array<{label: string, values: string[]}>}}
 */
export function chartSummaryModel(data) {
  return summaryModel(data, catalogueText, {});
}

/**
 * @typedef {Object} SummaryFormatting
 * @property {string} [locale] Number-formatting locale; the active language by default.
 * @property {ChartSummaryFormat|null} [format] The chart's `summaryFormat`.
 */

/**
 * @param {ChartData} data Chart data.
 * @param {ChartText} text Resolves the name of an unnamed series.
 * @param {SummaryFormatting} formatting How values are written.
 * @returns {{headers: string[], rows: Array<{label: string, values: string[]}>}}
 */
function summaryModel(data, text, formatting) {
  const datasets = Array.isArray(data?.datasets) ? data.datasets : [];
  const labels = Array.isArray(data?.labels) ? data.labels : [];
  const length = Math.max(labels.length,
    ...datasets.map((dataset) => Array.isArray(dataset.data) ? dataset.data.length : 0), 0);
  return {
    headers: datasets.map((dataset, index) => String(dataset.label ?? text('chart.series', index + 1))),
    rows: Array.from({ length }, (_, index) => ({
      label: String(labels[index] ?? index + 1),
      values: datasets.map((dataset, datasetIndex) => {
        const raw = dataset.data?.[index];
        const value = summaryCellValue(raw);
        const formatted = summaryValue(value, formatting.locale);
        if (typeof formatting.format !== 'function') return formatted;
        const custom = formatting.format(value, { dataset, datasetIndex, index, label: labels[index], raw, formatted });
        return custom == null ? formatted : String(custom);
      })
    }))
  };
}

/**
 * The value a data entry stands for in the table: `y`, else `r`, of a point object.
 * @param {unknown} raw Data entry.
 * @returns {unknown}
 */
function summaryCellValue(raw) {
  if (raw && typeof raw === 'object') {
    if ('y' in raw) return raw.y;
    if ('r' in raw) return raw.r;
  }
  return raw;
}

/** Significant digits a summary number keeps: enough for any real value, too few for float noise. */
const SUMMARY_PRECISION = 12;

/**
 * @param {unknown} value Cell value.
 * @param {string} [locale] Number-formatting locale; the active language by default.
 * @returns {string}
 */
function summaryValue(value, locale) {
  if (value == null) return '';
  if (typeof value === 'number' && Number.isFinite(value)) {
    // A whole number is exact as it stands; rounding it to the precision would change large counts.
    if (Number.isInteger(value)) return formatNumber(value, { locale, maxDecimals: 0 });
    const magnitude = value === 0 ? 0 : Math.floor(Math.log10(Math.abs(value)));
    const maxDecimals = Math.min(20, Math.max(0, SUMMARY_PRECISION - 1 - magnitude));
    return formatNumber(Number(value.toPrecision(SUMMARY_PRECISION)), { locale, maxDecimals });
  }
  if (typeof value === 'object') {
    try { return JSON.stringify(value); } catch { return String(value); }
  }
  return String(value);
}

/** @param {unknown} aspectRatio @returns {string} A CSS `aspect-ratio` value; the default for none. */
function aspectRatioText(aspectRatio) {
  return String(aspectRatio ?? '').trim() || String(Chart.defaults.aspectRatio);
}

/** Attributes whose change anywhere above a chart can change the colours its tokens resolve to. */
const THEME_ATTRIBUTES = ['data-zx-theme', 'data-zx-preset'];
/** System preferences the semantic tokens answer to. */
const THEME_QUERIES = ['(prefers-color-scheme: dark)', '(prefers-contrast: more)', '(forced-colors: active)'];
const PALETTE_TOKENS = Array.from({ length: 8 }, (_, index) => `--zx-color-chart-${index + 1}`);

/**
 * The theme as the chart root resolves it. A token's text may be a `light-dark()` pair or a
 * `color-mix()`, which only an element can resolve (it takes that element's colour scheme), so each
 * colour is read back from a hidden probe inside the root; and the computed value may be written
 * as `color(srgb …)` or `oklch(…)`, which an engine's own parser may not read, so it is rewritten
 * as `#rrggbb` or `rgba()` (see `color.js`). A root outside a document resolves nothing.
 * @param {HTMLElement} root Chart root.
 * @returns {ChartTheme}
 */
function chartTheme(root) {
  /** @type {ChartTheme} */
  const theme = { palette: [] };
  if (typeof getComputedStyle !== 'function' || !root.isConnected) return theme;
  const declared = getComputedStyle(root);
  const probe = h('span', { hidden: true });
  root.append(probe);
  const read = (token) => {
    if (!declared.getPropertyValue(token).trim()) return undefined;
    probe.style.color = `var(${token})`;
    return engineColor(getComputedStyle(probe).color, root.ownerDocument);
  };
  const color = read('--zx-color-text');
  const borderColor = read('--zx-color-border');
  if (color) theme.color = color;
  if (borderColor) theme.borderColor = borderColor;
  theme.palette = /** @type {string[]} */ (PALETTE_TOKENS.map(read).filter(Boolean));
  probe.remove();
  return theme;
}

/** @param {ChartTheme} theme @returns {string} One string per distinct theme. */
function themeKey(theme) {
  return [theme.color ?? '', theme.borderColor ?? '', ...theme.palette].join('|');
}

/** @param {unknown} error @param {unknown} fallback @returns {string} */
function errorMessage(error, fallback) {
  const message = error && typeof error === 'object' && 'message' in error ? String(error.message) : '';
  return message.trim() ? message : String(fallback);
}

/** Fired after the adapter creates an engine instance. @event Chart#ready @type {CustomEvent<{instance: unknown}>} */
/** Fired after an existing chart updates. @event Chart#update @type {CustomEvent<{data: ChartData, type: string}>} */
/** Fired when the engine reports a selected point. @event Chart#select @type {CustomEvent<ChartSelectDetail>} */
/** Fired when adapter creation/update fails. @event Chart#error @type {CustomEvent<{error: unknown}>} */
