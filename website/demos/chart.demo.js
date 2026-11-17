import { Chart, ChartJsAdapter, SvgChartAdapter, button, formatCurrency, h } from '../../src/index.js';

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

/** One series per region; as a pie, each region is a slice. */
function regionData() {
  return {
    labels: ['North', 'South', 'East', 'West', 'Online'],
    datasets: [{ label: 'Orders', data: [320, 214, 181, 126, 172] }]
  };
}

/** Revenue and costs by month, for bars and lines. The label and description travel with the data. */
const REVENUE = {
  label: 'Revenue and costs by month',
  description: 'Monthly values in thousands of euros. A semantic table follows for non-visual access.',
  data: revenueData
};

/** Orders by region, for pies and doughnuts: one slice per region. */
const ORDERS = {
  label: 'Orders by region',
  description: 'Orders this quarter, one slice per sales region. A semantic table follows for non-visual access.',
  data: regionData
};

/** The kinds the built-in adapter example switches between, each with what it shows. */
const SVG_KINDS = [
  { type: 'bar', name: 'Bar', shows: REVENUE },
  { type: 'line', name: 'Line', shows: REVENUE },
  { type: 'pie', name: 'Pie', shows: ORDERS },
  { type: 'doughnut', name: 'Doughnut', shows: ORDERS }
];

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
  api: ['Chart', 'SvgChartAdapter', 'ChartJsAdapter'],
  blurb: 'An accessible engine-neutral chart host. SvgChartAdapter draws bar, line, pie and doughnut charts with no dependency; ChartJsAdapter receives an explicitly injected Chart.js engine.',
  examples: [
    {
      title: 'Built-in SVG adapter',
      blurb: 'SvgChartAdapter needs nothing but Zx: grouped bars, lines, pies and doughnuts, coloured from the theme’s chart palette, with a legend and round ticks. setType() redraws as another kind; pointing at a mark names its value, and pressing one fires select.',
      render: ({ cleanup, log }) => {
        const chart = new Chart(null, {
          adapter: new SvgChartAdapter(),
          type: 'bar',
          label: REVENUE.label,
          description: REVENUE.description,
          data: REVENUE.data(),
          onselect: ({ detail }) => log(`select ${detail.label} · ${detail.dataset.label}: ${detail.value}`)
        });
        // A switch of kind is a switch of data too: the name, description and table follow it.
        const choices = SVG_KINDS.map(({ type, name, shows }) => button({
          label: name,
          onclick: (event) => {
            for (const choice of choices) choice.setAttribute('aria-pressed', String(choice === event.currentTarget));
            chart.setType(type).setLabel(shows.label).setDescription(shows.description).setData(shows.data());
            log(`setType('${type}')`);
          }
        }));
        choices[0].setAttribute('aria-pressed', 'true');
        cleanup(() => chart.destroy());
        return h('div', { style: 'inline-size: 100%' },
          h('div', { class: 'demo-row', role: 'group', 'aria-label': 'Chart type' }, choices),
          chart.toElement());
      }
    },
    {
      title: 'Visible accessible summary',
      blurb: 'The chart always has a synchronized semantic table. Set summary: "visible" when the exact values belong in the visual interface too. Numbers are written for the active language; summaryFormat decides what a value reads as — here, an amount in euros.',
      render: ({ cleanup }) => {
        const chart = new Chart(null, {
          adapter: new SvgChartAdapter(),
          label: 'Quarterly revenue',
          summary: 'visible',
          summaryFormat: (value) => formatCurrency(value, 'EUR'),
          data: quarterlyData()
        });
        cleanup(() => chart.destroy());
        return chart.toElement();
      }
    },
    {
      title: 'Filling its container',
      blurb: 'With fill: true the chart takes the height of its container instead of deriving one from aspectRatio — a dashboard tile, a split pane. The container needs a height of its own; here the buttons change it and the chart lays itself out again.',
      render: ({ cleanup, log }) => {
        const chart = new Chart(null, {
          adapter: new SvgChartAdapter(),
          type: 'line',
          fill: true,
          label: 'Capacity by weekday',
          data: capacityData(),
          onready: () => log('ready: the engine is created once the chart is in the page')
        });
        const tile = h('div', { style: 'block-size: 220px' }, chart.toElement());
        const resize = (height) => button({
          label: `${height}px tall`,
          onclick: () => { tile.style.blockSize = `${height}px`; }
        });
        cleanup(() => chart.destroy());
        return h('div', { style: 'inline-size: 100%' }, h('div', { class: 'demo-row' }, [160, 220, 320].map(resize)), tile);
      }
    },
    {
      title: 'Injected Chart.js adapter',
      blurb: 'For chart types beyond the four, inject an engine. This documentation loads the pinned Chart.js 4.5.1 UMD development asset, then hands its constructor to ChartJsAdapter. The Zx runtime imports no chart engine.',
      render: ({ cleanup, log }) => {
        const host = h('div', {}, h('p', { class: 'demo-caption' }, 'Loading Chart.js adapter…'));
        let chart = null;
        let disposed = false;
        loadChartJs().then((engine) => {
          if (disposed) return;
          chart = new Chart(null, {
            adapter: new ChartJsAdapter(engine),
            type: 'radar',
            label: 'Capacity by weekday',
            description: 'A radar chart, which only an injected engine draws.',
            data: capacityData(),
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
    }
  ]
};
