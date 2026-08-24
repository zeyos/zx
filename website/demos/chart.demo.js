import { Chart, ChartJsAdapter, h } from '../../src/index.js';

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
      blurb: 'The canvas always has a synchronized semantic table. Set summary: "visible" when the exact values belong in the visual interface too.',
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
            data: { labels: ['Q1', 'Q2', 'Q3', 'Q4'], datasets: [{ label: 'EUR thousands', data: [145, 172, 181, 204] }] }
          });
          host.replaceChildren(chart.toElement());
        }).catch((error) => host.replaceChildren(h('p', { class: 'docs-note' }, error.message)));
        cleanup(() => { disposed = true; chart?.destroy(); });
        return host;
      }
    }
  ]
};
