import assert from 'node:assert/strict';
import test from 'node:test';

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
