import { Chart, ChartJsAdapter, button, formatCurrency, h } from '../../src/index.js';

let chartJsPromise = null;

function loadChartJs() {
  if (window.Chart) return Promise.resolve(window.Chart);
  if (chartJsPromise) return chartJsPromise;
  chartJsPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = '../../node_modules/chart.js/dist/chart.umd.js';
    script.onload = () => resolve(window.Chart);
    script.onerror = () => reject(new Error('Chart.js development asset could not be loaded.'));
    document.head.append(script);
  });
  return chartJsPromise;
}

function revenueData() {
  return {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    datasets: [
      { label: 'Revenue', data: [42, 55, 48, 67, 71, 84] },
      { label: 'Costs', data: [28, 31, 29, 38, 40, 45] }
    ]
  };
}

/** One series of amounts in euros; the summary table prints each with `summaryFormat`. */
function quarterlyData() {
  return {
    labels: ['Q1', 'Q2', 'Q3', 'Q4'],
    datasets: [{ label: 'Revenue', data: [145230.5, 172048, 181400.25, 204915.75] }]
  };
}

/** Three series without colours of their own: the adapter takes them from the theme palette. */
function capacityData() {
  return {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    datasets: [
      { label: 'Planned', data: [32, 36, 40, 38, 30] },
      { label: 'Booked', data: [28, 35, 31, 36, 22] },
      { label: 'Billable', data: [24, 30, 27, 33, 18] }
    ]
  };
}

export default {
  title: 'Chart',
  group: 'Data',
  api: ['Chart', 'ChartJsAdapter'],
  blurb: 'An accessible engine-neutral chart host. Zx stays dependency-free; ChartJsAdapter receives an explicitly injected Chart.js engine.',
  examples: [
    {
      title: 'Injected Chart.js adapter',
      blurb: 'This documentation loads the pinned Chart.js 4.5.1 UMD development asset, then injects its constructor. The Zx runtime imports no chart engine.',
      render: ({ cleanup, log }) => {
        const host = h('div', {}, h('p', { class: 'demo-caption' }, 'Loading Chart.js adapter…'));
        let chart = null;
        let disposed = false;
        loadChartJs().then((engine) => {
          if (disposed) return;
          chart = new Chart(null, {
            adapter: new ChartJsAdapter(engine),
            type: 'bar',
            label: 'Revenue and costs by month',
            description: 'Monthly values in thousands of euros. A semantic table follows for non-visual access.',
            data: revenueData(),
            chartOptions: {
              interaction: { mode: 'nearest', intersect: true },
              plugins: { legend: { position: 'bottom' } }
            },
            onselect: ({ detail }) => log(`select ${detail.label}: ${detail.value}`)
          });
          host.replaceChildren(chart.toElement());
        }).catch((error) => host.replaceChildren(h('p', { class: 'docs-note' }, error.message)));
        cleanup(() => { disposed = true; chart?.destroy(); });
        return host;
      }
    },
    {
      title: 'Visible accessible summary',
      blurb: 'The canvas always has a synchronized semantic table. Set summary: "visible" when the exact values belong in the visual interface too. Numbers are written for the active language; summaryFormat decides what a value reads as — here, an amount in euros.',
      render: ({ cleanup }) => {
        const host = h('div', {}, h('p', { class: 'demo-caption' }, 'Loading Chart.js adapter…'));
        let chart = null;
        let disposed = false;
        loadChartJs().then((engine) => {
          if (disposed) return;
          chart = new Chart(null, {
            adapter: new ChartJsAdapter(engine),
            label: 'Quarterly revenue',
            summary: 'visible',
            summaryFormat: (value) => formatCurrency(value, 'EUR'),
            data: quarterlyData()
          });
          host.replaceChildren(chart.toElement());
        }).catch((error) => host.replaceChildren(h('p', { class: 'docs-note' }, error.message)));
        cleanup(() => { disposed = true; chart?.destroy(); });
        return host;
      }
    },
    {
      title: 'Filling its container',
      blurb: 'With fill: true the chart takes the height of its container instead of deriving one from aspectRatio — a dashboard tile, a split pane. The container needs a height of its own; here the buttons change it and the chart follows.',
      render: ({ cleanup, log }) => {
        const tile = h('div', { style: 'block-size: 220px' }, h('p', { class: 'demo-caption' }, 'Loading Chart.js adapter…'));
        const resize = (height) => button({
          label: `${height}px tall`,
          onclick: () => { tile.style.blockSize = `${height}px`; }
        });
        const host = h('div', { style: 'inline-size: 100%' }, h('div', { class: 'demo-row' }, [160, 220, 320].map(resize)), tile);
        let chart = null;
        let disposed = false;
        loadChartJs().then((engine) => {
          if (disposed) return;
          chart = new Chart(null, {
            adapter: new ChartJsAdapter(engine),
            type: 'line',
            fill: true,
            label: 'Capacity by weekday',
            data: capacityData(),
            onready: () => log('ready: the engine is created once the chart is in the page')
          });
          tile.replaceChildren(chart.toElement());
        }).catch((error) => tile.replaceChildren(h('p', { class: 'docs-note' }, error.message)));
        cleanup(() => { disposed = true; chart?.destroy(); });
        return host;
      }
    }
  ]
};
