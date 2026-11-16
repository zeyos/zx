import assert from 'node:assert/strict';

/**
 * WP88: the dependency-free SVG chart adapter, in a real browser and in both themes. Nothing here
 * loads Chart.js; every colour is compared with what the theme's own token resolves to, so the
 * light and the dark run each check against their own palette.
 */

/** Installs a frame wait, a sized box, sample data and a colour probe. */
const prepare = (page) => page.evaluate(() => {
  window.frames2 = () => new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 0)));
  });
  window.box = (width = 600, height = 360) => {
    const box = document.createElement('div');
    box.style.cssText = `inline-size:${width}px;block-size:${height}px`;
    document.body.append(box);
    return box;
  };
  window.sample = () => ({
    labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5'],
    datasets: [
      { label: 'Invoiced', data: [52300, 61200, 58400, 70100, 44400] },
      { label: 'Collected', data: [41000, 55800, 49200, 61300, 34680] }
    ]
  });
  /** The computed colour a token resolves to where `element` is. */
  window.token = (element, name) => {
    const probe = document.createElement('span');
    probe.style.color = `var(${name})`;
    element.append(probe);
    const colour = getComputedStyle(probe).color;
    probe.remove();
    return colour;
  };
  window.chartIn = (box, options) => {
    const chart = new zx.Chart(null, { adapter: new zx.SvgChartAdapter(), data: window.sample(), label: 'Weeks', ...options });
    box.append(chart.toElement());
    return chart;
  };
});

export const cases = [
  {
    name: 'WP88 the four kinds draw without Chart.js, painted from the theme palette',
    async run({ page }) {
      await prepare(page);
      const result = await page.evaluate(async () => {
        const out = { engine: typeof window.Chart };
        const charts = ['bar', 'line', 'pie', 'doughnut'].map((type) => window.chartIn(window.box(480, 300), { type }));
        await window.frames2();
        out.kinds = charts.map((chart) => {
          const drawing = chart.el.querySelector('.zx-chart__drawing');
          const mark = drawing?.querySelector('.zx-chart__mark');
          const line = drawing?.querySelector('.zx-chart__line');
          const second = drawing?.querySelector('[data-series="2"] .zx-chart__mark, .zx-chart__slice[data-series="2"]');
          return {
            type: drawing?.dataset.type,
            marks: drawing?.querySelectorAll('.zx-chart__mark').length ?? 0,
            keys: drawing?.querySelectorAll('.zx-chart__key').length ?? 0,
            first: line ? getComputedStyle(line).stroke : getComputedStyle(mark).fill,
            second: getComputedStyle(second).fill,
            chart1: window.token(drawing, '--zx-color-chart-1'),
            chart2: window.token(drawing, '--zx-color-chart-2'),
            tick: drawing.querySelector('.zx-chart__tick') ? getComputedStyle(drawing.querySelector('.zx-chart__tick')).fill : null,
            muted: window.token(drawing, '--zx-color-text-muted'),
            named: chart.refs.canvas.getAttribute('role') === 'img' && chart.refs.canvas.getAttribute('aria-label') === 'Weeks',
            hidden: drawing.getAttribute('aria-hidden')
          };
        });
        charts.forEach((chart) => chart.destroy());
        return out;
      });
      assert.equal(result.engine, 'undefined', 'no chart engine on the page');
      assert.deepEqual(result.kinds.map((kind) => [kind.type, kind.marks, kind.keys]),
        [['bar', 10, 2], ['line', 10, 2], ['pie', 10, 5], ['doughnut', 10, 5]]);
      for (const kind of result.kinds) {
        assert.equal(kind.first, kind.chart1, `${kind.type}: the first series is --zx-color-chart-1`);
        assert.equal(kind.second, kind.chart2, `${kind.type}: the second is --zx-color-chart-2`);
        assert.equal(kind.named, true, `${kind.type}: the canvas keeps the accessible name`);
        assert.equal(kind.hidden, 'true', `${kind.type}: the drawing is presentational`);
        if (kind.tick) assert.equal(kind.tick, kind.muted, `${kind.type}: ticks are muted text`);
      }
    }
  },
  {
    name: 'WP88 the viewBox follows the plot, text keeps its size, and a same-size resize does not redraw',
    async run({ page }) {
      await prepare(page);
      const result = await page.evaluate(async () => {
        const box = window.box(600, 360);
        const chart = window.chartIn(box, { type: 'line' });
        await window.frames2();
        const plot = () => chart.el.querySelector('.zx-chart__plot');
        const read = () => {
          const rect = plot().getBoundingClientRect();
          return {
            viewBox: plot().getAttribute('viewBox'),
            size: `0 0 ${Math.round(rect.width)} ${Math.round(rect.height)}`,
            font: getComputedStyle(chart.el.querySelector('.zx-chart__tick')).fontSize,
            ticks: [...chart.el.querySelectorAll('[data-axis="value"] .zx-chart__tick')].map((tick) => tick.textContent)
          };
        };
        const wide = read();
        const first = plot().querySelector('.zx-chart__line');
        chart.resize();
        const kept = plot().querySelector('.zx-chart__line') === first;
        box.style.inlineSize = '320px';
        box.style.blockSize = '220px';
        await window.frames2();
        const narrow = read();
        const labels = [...chart.el.querySelectorAll('[data-axis="category"] .zx-chart__tick')];
        const overlapping = labels.some((label, index) => index > 0
          && label.getBoundingClientRect().left < labels[index - 1].getBoundingClientRect().right);
        chart.destroy();
        return { wide, narrow, kept, overlapping };
      });
      assert.equal(result.wide.viewBox, result.wide.size, 'the viewBox is the plot in pixels');
      assert.equal(result.narrow.viewBox, result.narrow.size, 'and follows it when the viewport changes');
      assert.notEqual(result.narrow.viewBox, result.wide.viewBox);
      assert.equal(result.narrow.font, result.wide.font, 'text keeps its size at any width');
      assert.deepEqual(result.wide.ticks.slice(0, 2), ['30K', '35K'], 'compact round ticks');
      assert.equal(result.kept, true, 'a resize at the same size leaves the drawing alone');
      assert.equal(result.overlapping, false, 'category labels never overlap');
    }
  },
  {
    name: 'WP88 the first drawing grows in only when motion is allowed, and a redraw never does',
    async run({ page }) {
      await prepare(page);
      const reduced = await page.evaluate(async () => {
        const chart = window.chartIn(window.box());
        await window.frames2();
        const animate = chart.el.querySelector('.zx-chart__drawing').hasAttribute('data-animate');
        chart.destroy();
        return animate;
      });
      assert.equal(reduced, false, 'no animation under the reduced-motion preference');
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      const result = await page.evaluate(async () => {
        const chart = window.chartIn(window.box());
        await window.frames2();
        const drawing = () => chart.el.querySelector('.zx-chart__drawing');
        const out = {
          first: drawing().hasAttribute('data-animate'),
          running: getComputedStyle(drawing().querySelector('.zx-chart__bar')).animationName
        };
        chart.setData({ labels: ['a', 'b'], datasets: [{ label: 'x', data: [1, 2] }] });
        out.redraw = drawing().hasAttribute('data-animate');
        const still = window.chartIn(window.box(), { chartOptions: { animation: false } });
        const region = document.createElement('div');
        region.dataset.zxMotion = 'reduced';
        window.box().append(region);
        const inRegion = new zx.Chart(null, { adapter: new zx.SvgChartAdapter(), data: window.sample() });
        region.append(inRegion.toElement());
        await window.frames2();
        out.optedOut = still.el.querySelector('.zx-chart__drawing').hasAttribute('data-animate');
        out.region = inRegion.el.querySelector('.zx-chart__drawing').hasAttribute('data-animate');
        [chart, still, inRegion].forEach((each) => each.destroy());
        return out;
      });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      assert.equal(result.first, true, 'the first drawing grows in');
      assert.equal(result.running, 'zx-chart-grow');
      assert.equal(result.redraw, false, 'new data redraws in place');
      assert.equal(result.optedOut, false, 'chartOptions.animation: false turns it off');
      assert.equal(result.region, false, 'a data-zx-motion="reduced" region turns it off');
    }
  },
  {
    name: 'WP88 pressing a mark selects it; destroy removes the drawing and its listener',
    async run({ page }) {
      await prepare(page);
      await page.evaluate(async () => {
        window.selected = [];
        window.chart = window.chartIn(window.box(), { onselect: ({ detail }) => window.selected.push(detail) });
        await window.frames2();
      });
      await page.click('.zx-chart__bar[data-index="3"]');
      const result = await page.evaluate(() => {
        const [detail] = window.selected;
        const viewport = window.chart.refs.viewport;
        const drawing = viewport.querySelector('.zx-chart__drawing');
        window.chart.destroy();
        drawing.querySelector('.zx-chart__bar').dispatchEvent(new MouseEvent('click', { bubbles: true }));
        return {
          detail: { datasetIndex: detail.datasetIndex, index: detail.index, label: detail.label, value: detail.value, native: detail.nativeEvent?.type },
          count: window.selected.length,
          left: viewport.querySelectorAll('.zx-chart__drawing').length
        };
      });
      assert.deepEqual(result.detail, { datasetIndex: 0, index: 3, label: 'Week 4', value: 70100, native: 'click' });
      assert.equal(result.count, 1, 'no selection after destroy');
      assert.equal(result.left, 0, 'the drawing is gone');
    }
  },
  {
    name: 'WP88 Surface draws charts with the SVG adapter by default; chartAdapter: null shows the table',
    async run({ page }) {
      await prepare(page);
      const result = await page.evaluate(async () => {
        const documentFor = (surface) => ({
          zx: 'surface/1', surface, intent: 'show', title: 'October',
          root: ['weeks'],
          nodes: [{ id: 'weeks', type: 'chart', kind: 'bar', label: 'Invoiced per week', data: window.sample() }]
        });
        const draw = (options) => {
          const surface = new zx.Surface(null, options);
          window.box(600, 520).append(surface.toElement());
          return surface;
        };
        const svg = draw({ document: documentFor('a') });
        const none = draw({ document: documentFor('b'), chartAdapter: null });
        await window.frames2();
        const read = (surface) => ({
          drawing: Boolean(surface.el.querySelector('.zx-chart__drawing')),
          bars: surface.el.querySelectorAll('.zx-chart__bar').length,
          toggle: Boolean(surface.el.querySelector('.zx-surface__data-toggle')),
          summary: surface.el.querySelector('.zx-chart__summary')?.dataset.summary
        });
        const out = { svg: read(svg), none: read(none) };
        svg.destroy();
        none.destroy();
        return out;
      });
      assert.deepEqual(result.svg, { drawing: true, bars: 10, toggle: true, summary: 'hidden' });
      assert.deepEqual(result.none, { drawing: false, bars: 0, toggle: false, summary: 'visible' });
    }
  }
];
