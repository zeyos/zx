import { Component } from '../../core/component.js';
import { h } from '../../core/dom.js';
import { uid } from '../../core/util.js';

/** @typedef {{label?: string, data?: unknown[], [key: string]: unknown}} ChartDataset */
/** @typedef {{labels?: unknown[], datasets?: ChartDataset[], [key: string]: unknown}} ChartData */
/**
 * @typedef {Object} ChartSpec
 * @property {string} type Chart type.
 * @property {ChartData} data Chart data.
 * @property {Record<string, unknown>} options Engine-specific options.
 * @property {(detail: ChartSelectDetail) => void} onSelect Point-selection callback.
 */
/**
 * @typedef {Object} ChartHandle
 * @property {(spec: ChartSpec) => void} update Update the mounted chart.
 * @property {() => void} resize Resize the mounted chart.
 * @property {() => void} destroy Destroy the mounted chart.
 * @property {unknown} [instance] Engine instance.
 */
/** @typedef {{create: (canvas: HTMLCanvasElement, spec: ChartSpec) => ChartHandle}} ChartAdapter */
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
 * @property {string} [label='Chart'] Accessible canvas and summary label; blank text falls back to `Chart`.
 * @property {string} [description=''] Accessible description.
 * @property {'hidden'|'visible'} [summary='hidden'] Semantic data-table presentation.
 * @property {boolean} [loading=false] Initial loading state.
 * @property {string} [emptyText='No chart data'] Empty-state text.
 * @property {string} [loadingText='Loading chart…'] Loading-state text.
 * @property {string} [errorText='Unable to render chart'] Error fallback text.
 * @property {string} [aspectRatio='16 / 9'] Responsive container aspect ratio.
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
    label: 'Chart',
    description: '',
    summary: 'hidden',
    loading: false,
    emptyText: 'No chart data',
    loadingText: 'Loading chart…',
    errorText: 'Unable to render chart',
    aspectRatio: '16 / 9'
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
    this._label = normalizeChartLabel(this.options.label);
    this._chartOptions = cloneChartValue(this.options.chartOptions);
    this._loading = Boolean(this.options.loading);
    this._error = null;
    this._handle = null;
    this._destroyed = false;

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
    viewport.style.setProperty('--zx-chart-aspect-ratio', String(this.options.aspectRatio));
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

    this._observer = typeof ResizeObserver === 'function' ? new ResizeObserver(() => this.resize()) : null;
    this._observer?.observe(viewport);
    return root;
  }

  /** Replaces chart data and updates or mounts the engine. @param {ChartData} data @returns {this} */
  setData(data) {
    this._data = normalizeChartData(data);
    this._error = null;
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
    this._error = error ?? new Error(String(this.options.errorText));
    this._loading = false;
    this._destroyHandle();
    this._syncState();
    this.emit('error', { error: this._error });
    return this;
  }

  /** Clears the error and remounts when data and an adapter are available. @returns {this} */
  clearError() {
    this._error = null;
    this._mountOrUpdate(false);
    return this;
  }

  /** Requests an engine resize. @returns {this} */
  resize() {
    try { this._handle?.resize?.(); } catch (error) { this.setError(error); }
    return this;
  }

  /** Re-applies computed theme defaults through the adapter update path. @returns {this} */
  refreshTheme() {
    this._mountOrUpdate(true);
    return this;
  }

  /** Returns the underlying engine instance when the adapter exposes it. @returns {unknown} */
  getInstance() {
    return this._handle?.instance ?? null;
  }

  /** Destroys the engine/observer and restores or removes the host. @returns {void} */
  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    const original = this._original;
    this._observer?.disconnect();
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
    this._syncState();
    if (this._loading || this._error || isEmptyChartData(this._data)) {
      this._destroyHandle();
      return;
    }
    if (!this._adapter || typeof this._adapter.create !== 'function') {
      this._destroyHandle();
      return;
    }
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

  /** @returns {ChartSpec} */
  _spec() {
    return {
      type: this._type,
      data: cloneChartValue(this._data),
      options: {
        ...themeChartOptions(/** @type {HTMLElement} */ (this.el)),
        ...cloneChartValue(this._chartOptions)
      },
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
    const state = this._loading ? 'loading' : this._error ? 'error' : empty ? 'empty' : 'ready';
    this.el.dataset.state = state;
    this.refs.viewport.hidden = state !== 'ready';
    let text = '';
    if (state === 'loading') text = String(this.options.loadingText);
    else if (state === 'error') text = errorMessage(this._error, this.options.errorText);
    else if (state === 'empty') text = String(this.options.emptyText);
    this.refs.status.textContent = text;
    this.refs.status.hidden = !text;
  }

  /** @returns {void} */
  _renderSummary() {
    this.refs.summary.replaceChildren(chartSummaryTable(this._data, this._label));
  }
}

/** @param {unknown} value @returns {string} */
function normalizeChartLabel(value) {
  return String(value ?? '').trim() || 'Chart';
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
  return { type: spec.type, data: cloneChartValue(spec.data), options };
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

/**
 * Builds the semantic table mirrored alongside the canvas.
 * @param {ChartData} data Chart data.
 * @param {string} label Caption.
 * @returns {HTMLTableElement}
 */
export function chartSummaryTable(data, label = 'Chart data') {
  const summary = chartSummaryModel(data);
  const table = /** @type {HTMLTableElement} */ (h('table', { class: 'zx-chart__table' },
    h('caption', {}, label),
    h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Label'),
      summary.headers.map((header) => h('th', { scope: 'col' }, header)))),
    h('tbody', {}, summary.rows.map((row) => h('tr', {},
      h('th', { scope: 'row' }, row.label),
      row.values.map((value) => h('td', {}, value)))))));
  return table;
}

/**
 * Produces the exact text matrix rendered by the semantic chart summary.
 * @param {ChartData} data Chart data.
 * @returns {{headers: string[], rows: Array<{label: string, values: string[]}>}}
 */
export function chartSummaryModel(data) {
  const datasets = Array.isArray(data?.datasets) ? data.datasets : [];
  const labels = Array.isArray(data?.labels) ? data.labels : [];
  const length = Math.max(labels.length,
    ...datasets.map((dataset) => Array.isArray(dataset.data) ? dataset.data.length : 0), 0);
  return {
    headers: datasets.map((dataset, index) => String(dataset.label ?? `Series ${index + 1}`)),
    rows: Array.from({ length }, (_, index) => ({
      label: String(labels[index] ?? index + 1),
      values: datasets.map((dataset) => summaryValue(dataset.data?.[index]))
    }))
  };
}

/** @param {unknown} value @returns {string} */
function summaryValue(value) {
  if (value == null) return '';
  if (typeof value === 'object') {
    if ('y' in value) return String(value.y ?? '');
    if ('r' in value) return String(value.r ?? '');
    try { return JSON.stringify(value); } catch { return String(value); }
  }
  return String(value);
}

/** @param {HTMLElement} root @returns {Record<string, unknown>} */
function themeChartOptions(root) {
  if (typeof getComputedStyle !== 'function') return {};
  const style = getComputedStyle(root);
  const color = style.getPropertyValue('--zx-color-text').trim();
  const borderColor = style.getPropertyValue('--zx-color-border').trim();
  return {
    color: color || undefined,
    borderColor: borderColor || undefined
  };
}

/** @param {unknown} error @param {unknown} fallback @returns {string} */
function errorMessage(error, fallback) {
  return error && typeof error === 'object' && 'message' in error ? String(error.message) : String(fallback);
}

/** Fired after the adapter creates an engine instance. @event Chart#ready @type {CustomEvent<{instance: unknown}>} */
/** Fired after an existing chart updates. @event Chart#update @type {CustomEvent<{data: ChartData, type: string}>} */
/** Fired when the engine reports a selected point. @event Chart#select @type {CustomEvent<ChartSelectDetail>} */
/** Fired when adapter creation/update fails. @event Chart#error @type {CustomEvent<{error: unknown}>} */
