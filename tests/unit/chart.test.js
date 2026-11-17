import assert from 'node:assert/strict';
import test from 'node:test';

import { setLanguage } from '../../src/core/i18n.js';
import {
  ChartJsAdapter, chartSummaryModel, cloneChartValue, isEmptyChartData
} from '../../src/components/chart/chart.js';

test('chart clone copies arrays/plain objects while preserving functions and rich objects', () => {
  const fn = () => 1;
  const date = new Date('2026-01-01T00:00:00Z');
  const source = { data: [1, { nested: true }], fn, date };
  const clone = cloneChartValue(source);
  assert.notEqual(clone, source);
  assert.notEqual(clone.data, source.data);
  assert.notEqual(clone.data[1], source.data[1]);
  assert.equal(clone.fn, fn);
  assert.equal(clone.date, date);
});

test('chart clone tolerates cyclic plain objects', () => {
  const source = { name: 'root' };
  source.self = source;
  const clone = cloneChartValue(source);
  assert.equal(clone.self, clone);
});

test('empty chart data requires at least one dataset value', () => {
  assert.equal(isEmptyChartData({ labels: ['A'], datasets: [] }), true);
  assert.equal(isEmptyChartData({ labels: ['A'], datasets: [{ data: [] }] }), true);
  assert.equal(isEmptyChartData({ labels: ['A'], datasets: [{ data: [0] }] }), false);
});

test('chart summary matrix names series and preserves mismatched values as empty cells', () => {
  assert.deepEqual(chartSummaryModel({
    labels: ['Jan', 'Feb'],
    datasets: [
      { label: 'Revenue', data: [42] },
      { data: [{ y: 9 }, null, 12] }
    ]
  }), {
    headers: ['Revenue', 'Series 2'],
    rows: [
      { label: 'Jan', values: ['42', '9'] },
      { label: 'Feb', values: ['', ''] },
      { label: '3', values: ['', '12'] }
    ]
  });
});

test('ChartJsAdapter injects, updates, selects, resizes, and destroys one engine', () => {
  const calls = [];
  class FakeChart {
    constructor(canvas, config) {
      this.canvas = canvas;
      this.data = config.data;
      this.options = config.options;
      calls.push(['create', config.type]);
    }
    update() { calls.push(['update']); }
    resize() { calls.push(['resize']); }
    destroy() { calls.push(['destroy']); }
  }
  const selections = [];
  const spec = {
    type: 'bar',
    data: { labels: ['A'], datasets: [{ label: 'Revenue', data: [7] }] },
    options: {},
    onSelect: (detail) => selections.push(detail)
  };
  const handle = new ChartJsAdapter(FakeChart).create({}, spec);
  handle.instance.options.onClick({ native: { type: 'click' } }, [{ datasetIndex: 0, index: 0 }], handle.instance);
  assert.equal(selections[0].value, 7);
  handle.update({ ...spec, data: { labels: ['A'], datasets: [{ data: [9] }] } });
  handle.resize();
  handle.destroy();
  handle.destroy();
  assert.deepEqual(calls, [['create', 'bar'], ['update'], ['resize'], ['destroy']]);
});

test('ChartJsAdapter recreates the engine when type changes', () => {
  const calls = [];
  class FakeChart {
    constructor(_canvas, config) { calls.push(['create', config.type]); this.options = config.options; }
    destroy() { calls.push(['destroy']); }
    update() {}
  }
  const adapter = new ChartJsAdapter(FakeChart);
  const base = { data: { datasets: [{ data: [1] }] }, options: {}, onSelect() {} };
  const handle = adapter.create({}, { ...base, type: 'bar' });
  handle.update({ ...base, type: 'line' });
  assert.deepEqual(calls, [['create', 'bar'], ['destroy'], ['create', 'line']]);
});

test('ChartJsAdapter preserves a default onClick until a chart-specific callback overrides it', () => {
  class FakeChart {
    constructor(_canvas, config) { this.data = config.data; this.options = config.options; }
    update() {}
  }
  const calls = [];
  const point = [{ datasetIndex: 0, index: 0 }];
  const base = {
    type: 'bar',
    data: { labels: ['Jan'], datasets: [{ data: [12] }] },
    options: {},
    onSelect: (detail) => calls.push(`select:${detail.value}`)
  };
  const handle = new ChartJsAdapter(FakeChart, {
    onClick: () => calls.push('default')
  }).create({}, base);

  handle.instance.options.onClick({ type: 'click' }, point, handle.instance);
  handle.update({ ...base, options: { onClick: () => calls.push('supplied') } });
  handle.instance.options.onClick({ type: 'click' }, point, handle.instance);

  assert.deepEqual(calls, ['default', 'select:12', 'supplied', 'select:12']);
});

test('ChartJsAdapter destroys the old engine once when type reconstruction fails', () => {
  let destroys = 0;
  class FakeChart {
    constructor(_canvas, config) {
      if (config.type === 'line') throw new Error('unsupported type');
      this.options = config.options;
    }
    destroy() { destroys += 1; }
  }
  const base = { data: { datasets: [{ data: [1] }] }, options: {}, onSelect() {} };
  const handle = new ChartJsAdapter(FakeChart).create({}, { ...base, type: 'bar' });

  assert.throws(() => handle.update({ ...base, type: 'line' }), /unsupported type/);
  assert.equal(handle.instance, null);
  handle.destroy();
  handle.destroy();
  assert.equal(destroys, 1);
});

test('chartSummaryModel works as an array callback', () => {
  const [model] = [{ labels: ['a'], datasets: [{ data: [1] }] }].map(chartSummaryModel);
  assert.deepEqual(model.headers, ['Series 1']);
});

test('chart summary numbers are written for the active language, without float noise', () => {
  const data = {
    labels: ['a', 'b', 'c', 'd'],
    datasets: [
      { data: [0.1 + 0.2, 1234567.5, 0, -0.000123456] },
      { data: [{ x: 1, y: 1500.25 }, { r: 12000 }, '1500', true] },
      { data: [{ custom: 1 }, Number.NaN, 1e21, 3.14159265358979] }
    ]
  };
  const values = () => chartSummaryModel(data).rows.map((row) => row.values);
  assert.deepEqual(values(), [
    ['0.3', '1,500.25', '{"custom":1}'],
    ['1,234,567.5', '12,000', 'NaN'],
    ['0', '1500', '1,000,000,000,000,000,000,000'],
    ['-0.000123456', 'true', '3.14159265359']
  ]);
  setLanguage('de');
  try {
    assert.deepEqual(values().map((row) => row[0]), ['0,3', '1.234.567,5', '0', '-0,000123456']);
  } finally {
    setLanguage('en');
  }
});

test('ChartJsAdapter colours uncoloured datasets from the theme palette and leaves the rest alone', () => {
  class FakeChart {
    constructor(_canvas, config) { this.data = config.data; this.options = config.options; }
    update() {}
    destroy() {}
  }
  const palette = ['#111111', '#222222', '#333333'];
  const data = {
    labels: ['A', 'B', 'C', 'D'],
    datasets: [
      { data: [1, 2, 3, 4] },
      { data: [1, 2, 3, 4], backgroundColor: '#abcdef' },
      { data: [1, 2, 3, 4], borderColor: '#fedcba' },
      { data: [1, 2, 3, 4], type: 'line' },
      { data: [1, 2, 3, 4], type: 'pie' }
    ]
  };
  const spec = { type: 'bar', data, options: {}, theme: { palette }, onSelect() {} };
  const handle = new ChartJsAdapter(FakeChart).create({}, spec);
  const colours = () => handle.instance.data.datasets.map(({ backgroundColor, borderColor }) => [backgroundColor, borderColor]);
  assert.deepEqual(colours(), [
    ['#111111', '#111111'],
    ['#abcdef', undefined],
    [undefined, '#fedcba'],
    ['rgba(17, 17, 17, 0.5)', '#111111'],
    [['#111111', '#222222', '#333333', '#111111'], undefined]
  ]);
  assert.equal(data.datasets[0].backgroundColor, undefined, 'the application data is not written to');

  handle.update({ ...spec, type: 'bar', theme: { palette: ['#444444'] } });
  assert.equal(colours()[0][0], '#444444', 'an update carries the new palette');
  handle.update({ ...spec, theme: { palette: [] } });
  assert.deepEqual(colours()[0], [undefined, undefined], 'no palette, no colours');
  handle.update({ type: 'bar', data, options: {}, onSelect() {} });
  assert.deepEqual(colours()[0], [undefined, undefined], 'a spec from before `theme` existed still works');
});

test('a large whole number in the chart summary keeps every digit', () => {
  const model = chartSummaryModel({ labels: ['a'], datasets: [{ data: [1234567890123456] }] });
  assert.deepEqual(model.rows[0].values, ['1,234,567,890,123,456']);
});

test('ChartJsAdapter gives every drawn scale the theme colours the options leave unset', () => {
  class FakeChart {
    constructor(_canvas, config) { this.data = config.data; this.options = config.options; }
    update() {}
    destroy() {}
  }
  const theme = { color: '#eeeeee', borderColor: '#333333', background: '#101010', palette: [] };
  const data = { labels: ['A', 'B'], datasets: [{ data: [1, 2] }] };
  const create = (spec) => new ChartJsAdapter(FakeChart).create({}, { data, options: {}, theme, onSelect() {}, ...spec });

  // Chart.js reads axis colours from its global defaults, never from the chart's own `color`.
  const bar = create({ type: 'bar' }).instance.options;
  for (const id of ['x', 'y']) {
    assert.equal(bar.scales[id].ticks.color, '#eeeeee', `${id} ticks`);
    assert.equal(bar.scales[id].title.color, '#eeeeee', `${id} title`);
    assert.equal(bar.scales[id].grid.color, '#333333', `${id} grid`);
    assert.equal(bar.scales[id].border.color, '#333333', `${id} border`);
  }

  // What the application set stays; only the gaps are filled, and its options are not written to.
  const options = { scales: { y: { ticks: { color: 'red', stepSize: 1 }, grid: { display: false } } } };
  const custom = create({ type: 'bar', options }).instance.options;
  assert.equal(custom.scales.y.ticks.color, 'red');
  assert.equal(custom.scales.y.ticks.stepSize, 1);
  assert.equal(custom.scales.y.grid.display, false);
  assert.equal(custom.scales.y.grid.color, '#333333');
  assert.equal(custom.scales.x.ticks.color, '#eeeeee');
  assert.deepEqual(options, { scales: { y: { ticks: { color: 'red', stepSize: 1 }, grid: { display: false } } } });

  // A dataset on an axis of its own colours that axis, and no stray default axis appears.
  const twoAxes = create({
    type: 'line',
    data: { labels: ['A'], datasets: [{ data: [1], yAxisID: 'left' }, { data: [2], yAxisID: 'right' }] },
    options: { scales: { left: { position: 'left' }, right: { position: 'right' } } }
  }).instance.options;
  assert.deepEqual(Object.keys(twoAxes.scales).sort(), ['left', 'right', 'x']);
  assert.equal(twoAxes.scales.right.ticks.color, '#eeeeee');
  assert.equal(twoAxes.scales.right.position, 'right');

  // The radial scale of a radar or polar-area chart: labels, spokes, rings, and a dark tick backdrop.
  for (const type of ['radar', 'polarArea']) {
    const radial = create({ type }).instance.options.scales;
    assert.deepEqual(Object.keys(radial), ['r'], type);
    assert.equal(radial.r.ticks.color, '#eeeeee');
    assert.equal(radial.r.pointLabels.color, '#eeeeee');
    assert.equal(radial.r.grid.color, '#333333');
    assert.equal(radial.r.angleLines.color, '#333333');
    assert.equal(radial.r.ticks.backdropColor, 'rgba(16, 16, 16, 0.75)');
  }

  // A pie has no scales, and naming one would make Chart.js draw axes over it.
  assert.equal(create({ type: 'pie' }).instance.options.scales, undefined);
  // Without theme colours (no Zx stylesheet) nothing is added.
  assert.equal(create({ type: 'bar', theme: { palette: [] } }).instance.options.scales, undefined);

  // An update carries the new theme to the scales.
  const handle = create({ type: 'bar' });
  handle.update({ type: 'bar', data, options: {}, theme: { ...theme, color: '#111111' }, onSelect() {} });
  assert.equal(handle.instance.options.scales.x.ticks.color, '#111111');
});
