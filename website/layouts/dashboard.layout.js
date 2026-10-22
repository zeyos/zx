import {
  ActivityList, Avatar, Chart, ChartJsAdapter, InlineLoading, Tabbox, Table, badge, button, downloadBlob,
  formatCurrency, formatDate, formatNumber, formatPercent, formatRelativeTime, h, statTile, toCsv
} from '../../src/index.js';
import {
  DATE, adaptiveShell, allowsMotion, chartOptions, chartPalette, chartScales, disposer, iconButton, layoutContext,
  later, loadChartJs, paneHeader, shortcuts, suiteNav, toaster, unavailable, watchTheme
} from './kit.js';
import { NOW, company, person } from './fixtures.js';

/** The reporting windows the header switches between. Each one redraws the whole page. */
const PERIODS = [
  { id: 'month', label: '30 days', days: 30, buckets: 30, unit: 'day', compare: 'vs. last 30 days' },
  { id: 'quarter', label: '90 days', days: 90, buckets: 13, unit: 'week', compare: 'vs. last 90 days' },
  { id: 'year', label: '12 months', days: 365, buckets: 12, unit: 'month', compare: 'vs. last year' }
];

/** The headline figures per window. Deltas are relative changes; the win rate's is in points. */
const FIGURES = {
  month: { invoiced: 196200, invoicedDelta: 0.021, invoices: 38, collected: 171900, collectedDelta: 0.054, won: 135000, wonDelta: 0.18, deals: 2, winRate: 0.38, winRateDelta: 0.03, closed: 24 },
  quarter: { invoiced: 604700, invoicedDelta: 0.114, invoices: 117, collected: 548300, collectedDelta: 0.09, won: 362500, wonDelta: 0.075, deals: 6, winRate: 0.41, winRateDelta: 0.01, closed: 63 },
  year: { invoiced: 2806400, invoicedDelta: 0.097, invoices: 472, collected: 2640100, collectedDelta: 0.088, won: 1482000, wonDelta: 0.142, deals: 23, winRate: 0.44, winRateDelta: 0.02, closed: 211 }
};

/** Each top customer's share of what was invoiced in a window, largest first. */
const CUSTOMER_SHARES = {
  month: { alpine: 0.27, bruckner: 0.18, helios: 0.16, danube: 0.11, atelier: 0.05 },
  quarter: { alpine: 0.24, helios: 0.2, danube: 0.14, bruckner: 0.13, meridian: 0.04 },
  year: { alpine: 0.23, helios: 0.21, danube: 0.16, bruckner: 0.1, atelier: 0.04 }
};

/** The stages an open opportunity moves through, and the badge each is drawn with. */
const STAGES = {
  discovery: { label: 'Discovery', kind: 'neutral' },
  proposal: { label: 'Proposal', kind: 'info' },
  negotiation: { label: 'Negotiation', kind: 'warning' }
};

/** Open opportunities: a snapshot of today, whatever the window. */
const OPPORTUNITIES = [
  { ID: 'D-329', name: 'Warehouse rollout', company: 'bruckner', owner: 'tobias', stage: 'negotiation', value: 112000, close: '2026-11-02' },
  { ID: 'D-311', name: 'Plant rollout, phase 2', company: 'alpine', owner: 'tobias', stage: 'negotiation', value: 96000, close: '2026-10-30' },
  { ID: 'D-324', name: 'Patient portal integration', company: 'meridian', owner: 'piet', stage: 'proposal', value: 54000, close: '2026-11-20' },
  { ID: 'D-322', name: 'Analytics workspace, 40 seats', company: 'kestrel', owner: 'owen', stage: 'proposal', value: 38400, close: '2026-11-06' },
  { ID: 'D-326', name: 'Fleet tracking pilot', company: 'northstar', owner: 'nadine', stage: 'discovery', value: 22000, close: '2026-12-11' },
  { ID: 'D-318', name: 'Extended SLA', company: 'alpine', owner: 'nadine', stage: 'proposal', value: 18000, close: '2026-11-15' },
  { ID: 'D-331', name: 'Design system licence', company: 'atelier', owner: 'ines', stage: 'discovery', value: 9600, close: '2026-12-01' }
];

/** Invoices past their due date. */
const OVERDUE = [
  { ID: 'RE-2026-0119', company: 'northstar', due: '2026-09-04', amount: 18400 },
  { ID: 'RE-2026-0124', company: 'kestrel', due: '2026-09-18', amount: 6900 },
  { ID: 'RE-2026-0127', company: 'atelier', due: '2026-09-25', amount: 3200 },
  { ID: 'RE-2026-0131', company: 'meridian', due: '2026-10-01', amount: 13300 }
];

/** What the team did, newest first. The window decides how far back the list reaches. */
const ACTIVITY = [
  { actor: 'tobias', at: '2026-10-08T09:12', title: 'moved Warehouse rollout to Negotiation' },
  { actor: 'ruth', at: '2026-10-07T16:40', title: 'matched a payment of €12,400 to RE-2026-0112' },
  { actor: 'nadine', at: '2026-10-06T10:00', title: 'held the quarterly review with Alpine Works' },
  { actor: 'nadine', at: '2026-09-30T16:00', title: 'won Grid monitoring renewal with Helios Energie' },
  { actor: 'tobias', at: '2026-09-22T11:30', title: 'won Route optimisation API with Danube Systems' },
  { actor: 'ruth', at: '2026-08-14T09:00', title: 'sent twelve payment reminders' },
  { actor: 'piet', at: '2026-07-02T14:20', title: 'ran the technical review with Meridian Health' },
  { actor: 'ines', at: '2026-04-15T10:00', title: 'set the sales targets for the second half' },
  { actor: 'tobias', at: '2025-12-12T10:00', title: 'renewed Alpine Works for three more years' }
];

/** @param {number} value Euros. @returns {string} Whole euros. */
function money(value) {
  return formatCurrency(value, 'EUR', { decimals: 0 });
}

/** @param {string} iso Local date. @returns {Date} Noon that day, so no time zone moves it. */
function noon(iso) {
  return new Date(`${iso}T12:00:00`);
}

/**
 * Invented figures with a believable shape: a gently varying series that adds up to `total`.
 * @param {number} total
 * @param {number} count
 * @param {number} seed Shifts the shape, so two series never move in lockstep.
 * @returns {number[]}
 */
function spread(total, count, seed) {
  const raw = Array.from({ length: count }, (_, index) => 1 + 0.25 * Math.sin(index * 0.55 + seed)
    + 0.08 * Math.sin(index * 1.3 + seed * 3) + (0.25 * index) / count);
  const sum = raw.reduce((a, b) => a + b, 0);
  return raw.map((value) => Math.round((value / sum) * total));
}

/**
 * The revenue chart's buckets for a window: days, weeks, or months up to now.
 * @param {(typeof PERIODS)[number]} period
 * @returns {{labels: string[], invoiced: number[], collected: number[]}}
 */
function revenueSeries(period) {
  const figures = FIGURES[period.id];
  const labels = Array.from({ length: period.buckets }, (_, index) => {
    const back = period.buckets - 1 - index;
    if (period.unit === 'month') return formatDate(new Date(NOW.getFullYear(), NOW.getMonth() - back, 1), '%b');
    const days = period.unit === 'week' ? back * 7 : back;
    return formatDate(new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() - days), DATE.short);
  });
  return {
    labels,
    invoiced: spread(figures.invoiced, period.buckets, 1),
    collected: spread(figures.collected, period.buckets, 2.2)
  };
}

export default {
  title: 'Dashboard',
  category: 'Pattern',
  blurb: 'A reporting overview: figures, a revenue chart, and tabbed detail, all redrawn by one period switch.',
  components: ['StatTile', 'Chart', 'Tabbox', 'Table', 'ActivityList', 'InlineLoading', 'ChartJsAdapter', 'Avatar', 'Message', 'ModuleBar'],

  /**
   * Mounts the sales overview: navigation, the period switch, and every widget it drives.
   * @param {HTMLElement} container Gallery stage.
   * @param {import('./kit.js').LayoutContext} [context]
   * @returns {void}
   */
  mount(container, context) {
    context = layoutContext(context);
    const keep = disposer(context);
    const state = { period: PERIODS[0], reminded: new Set() };
    // One avatar per table row, moved into each redraw of the row rather than drawn anew.
    const avatars = new Map();

    // ----------------------------------------------------------------- navigation --

    // The suite's navigation: the overview is the suite's home, and its menu the sales
    // destinations and saved reports, beside every other module.
    const nav = suiteNav(context, {
      module: 'home',
      active: 'overview',
      menu: [
        { id: 'overview', label: 'Overview', icon: 'gauge' },
        { id: 'deals', label: 'Opportunities', icon: 'handshake', badge: OPPORTUNITIES.length, invoke: () => notify(unavailable('Opportunities'), 'info') },
        { id: 'invoices', label: 'Invoices', icon: 'file-invoice', invoke: () => notify(unavailable('Invoices'), 'info') },
        { id: 'customers', label: 'Customers', icon: 'building', invoke: () => notify(unavailable('Customers'), 'info') },
        { section: true, label: 'Reports', children: [
          { id: 'by-customer', label: 'Revenue by customer', icon: 'chart-column', invoke: () => notify(unavailable('Saved reports'), 'info') },
          { id: 'by-owner', label: 'Win rate by owner', icon: 'chart-pie', invoke: () => notify(unavailable('Saved reports'), 'info') },
          { id: 'ageing', label: 'Receivables ageing', icon: 'hourglass-half', invoke: () => notify(unavailable('Saved reports'), 'info') }
        ] }
      ]
    });
    // Narrow, the navigation becomes a drawer opened from the page header.
    const root = h('div', { class: 'dashboard shell' }, nav.column);
    const shell = adaptiveShell(root, context);
    const notify = toaster(context, root);

    // --------------------------------------------------------------------- header --

    // The window is one radio group: Tab reaches the checked one, the arrow keys change it.
    const periodButtons = PERIODS.map((period, index) => h('button', {
      type: 'button', class: 'segmented__item', role: 'radio', 'aria-keyshortcuts': String(index + 1),
      title: `${period.label} (${index + 1})`, onclick: () => setPeriod(period.id)
    }, period.label));
    const periods = h('div', { class: 'segmented', role: 'radiogroup', 'aria-label': 'Reporting period' }, periodButtons);
    periods.addEventListener('keydown', (event) => {
      const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
      if (!step) return;
      event.preventDefault();
      const index = (PERIODS.indexOf(state.period) + step + PERIODS.length) % PERIODS.length;
      setPeriod(PERIODS[index].id);
      periodButtons[index].focus();
    }, { signal: context.signal });
    // On a phone the export keeps only its icon; its name stays the word.
    const exportButton = button({ label: 'Export', icon: 'file-export', onclick: () => exportFigures() });
    exportButton.dataset.narrow = 'icon';
    const updated = keep(new InlineLoading(null, {
      status: 'inactive', size: 'sm', description: `Updated ${formatDate(NOW, DATE.time)}`
    }));

    // ---------------------------------------------------------------------- tiles --

    const tiles = {
      invoiced: keep(statTile({ label: 'Invoiced', format: money, deltaFormat: 'percent', deltaKind: 'positive' })),
      collected: keep(statTile({ label: 'Collected', format: money, deltaFormat: 'percent', deltaKind: 'positive' })),
      won: keep(statTile({ label: 'Won', format: money, deltaFormat: 'percent', deltaKind: 'positive' })),
      winRate: keep(statTile({
        label: 'Win rate', format: 'percent', deltaKind: 'positive',
        deltaFormat: (value) => `${formatNumber(Math.abs(Number(value)) * 100)}\u00a0pts`
      }))
    };

    // ---------------------------------------------------------------------- chart --

    const revenue = keep(new Chart(null, {
      type: 'line', loading: true, aspectRatio: '16 / 6', label: 'Invoiced and collected revenue'
    }));
    const legend = h('div', { class: 'dashboard__legend' },
      h('span', { class: 'dashboard__key', dataset: { series: '1' } }, 'Invoiced'),
      h('span', { class: 'dashboard__key', dataset: { series: '2' } }, 'Collected'));
    const revenueMeta = h('span', { class: 'surface__meta' });
    const customers = h('ol', { class: 'dashboard__ranking', 'aria-label': 'Top customers by revenue' });
    const customersMeta = h('span', { class: 'surface__meta' });

    // ----------------------------------------------------------------------- tabs --

    const opportunities = keep(new Table(null, {
      variant: 'plain',
      columns: [
        { id: 'name', label: 'Opportunity', sortable: true, width: '2fr' },
        { id: 'company', label: 'Customer', sortable: true, width: '1.6fr', sortValue: (row) => company(row.company)?.name, render: (row) => company(row.company)?.name },
        { id: 'owner', label: 'Owner', sortable: true, width: '1.4fr', sortValue: (row) => person(row.owner)?.name, render: (row) => owner(row) },
        { id: 'stage', label: 'Stage', sortable: true, width: '1fr', render: (row) => badge({ ...STAGES[row.stage], size: 'sm' }) },
        { id: 'value', label: 'Value', align: 'end', width: '1fr', render: (row) => money(row.value) },
        { id: 'close', label: 'Expected close', sortable: true, width: '1.1fr', render: (row) => formatDate(noon(row.close), DATE.short) }
      ],
      data: OPPORTUNITIES,
      rowId: 'ID',
      stickyHeader: false,
      responsive: 'sm',
      onrowclick: () => notify(unavailable('Opportunity records'), 'info')
    }));
    const overdue = keep(new Table(null, {
      variant: 'plain',
      columns: [
        { id: 'ID', label: 'Invoice', width: '1.2fr', render: (row) => h('span', { class: 'mono' }, row.ID) },
        { id: 'company', label: 'Customer', width: '1.6fr', render: (row) => company(row.company)?.name },
        { id: 'due', label: 'Due', sortable: true, width: '1fr', render: (row) => formatDate(noon(row.due), DATE.short) },
        { id: 'late', label: 'Overdue', width: '1fr', render: (row) => lateBadge(row) },
        { id: 'amount', label: 'Amount', align: 'end', width: '1fr', render: (row) => money(row.amount) },
        { id: 'remind', label: 'Reminder', align: 'end', width: '1.2fr', render: (row) => reminder(row) }
      ],
      data: OVERDUE,
      rowId: 'ID',
      stickyHeader: false,
      responsive: 'sm'
    }));
    const activity = keep(new ActivityList(null, { label: 'Team activity', emptyText: 'Nothing happened in this period.' }));
    const tabs = keep(new Tabbox(null, {
      variant: 'line',
      label: 'Details',
      tabs: [
        { name: 'opportunities', title: 'Open opportunities', content: opportunities.toElement() },
        { name: 'overdue', title: 'Overdue invoices', content: overdue.toElement() },
        { name: 'activity', title: 'Activity', content: h('div', { class: 'dashboard__activity' }, activity.toElement()) }
      ]
    }));
    tabs.setBadge('opportunities', String(OPPORTUNITIES.length));
    tabs.setBadge('overdue', String(OVERDUE.length));

    // ----------------------------------------------------------------------- page --

    const main = h('section', { class: 'shell__main', 'aria-label': 'Overview' },
      paneHeader({
        title: 'Overview',
        size: 'page',
        className: 'dashboard__header',
        leading: shell.navToggle(),
        actions: [
          updated.toElement(),
          periods,
          iconButton('arrows-rotate', 'Refresh', () => refresh(), { shortcut: { label: 'R', keys: 'R' } }),
          exportButton
        ]
      }),
      h('div', { class: 'shell__body shell__body--padded dashboard__body' },
        h('div', { class: 'dashboard__grid' },
          h('div', { class: 'dashboard__tiles' }, Object.values(tiles).map((tile) => tile.toElement())),
          h('section', { class: 'surface dashboard__revenue', 'aria-label': 'Revenue' },
            h('header', { class: 'dashboard__widget-head' },
              h('h3', { class: 'surface__title' }, 'Revenue', revenueMeta), legend),
            revenue.toElement()),
          h('section', { class: 'surface dashboard__customers', 'aria-label': 'Top customers' },
            h('header', { class: 'dashboard__widget-head' }, h('h3', { class: 'surface__title' }, 'Top customers', customersMeta)),
            customers),
          h('section', { class: 'surface dashboard__details', 'aria-label': 'Details' }, tabs.toElement()))));

    root.append(main);

    shortcuts(root, {
      1: () => setPeriod('month'),
      2: () => setPeriod('quarter'),
      3: () => setPeriod('year'),
      r: () => refresh()
    }, context);

    container.append(root);
    render();

    loadChartJs().then((engine) => {
      if (context.signal.aborted) return;
      revenue.setAdapter(new ChartJsAdapter(engine)).setLoading(false);
      renderChart(false);
    }).catch((error) => {
      if (!context.signal.aborted) revenue.setError(error);
    });
    watchTheme(context, () => renderChart(false));

    // ------------------------------------------------------------------ rendering --

    /** @param {string} id Period id. @returns {void} Switches the window and redraws the page. */
    function setPeriod(id) {
      state.period = PERIODS.find((period) => period.id === id) ?? PERIODS[0];
      render();
      renderChart(true);
    }

    /** Draws every widget for the current window. @returns {void} */
    function render() {
      const { period } = state;
      const figures = FIGURES[period.id];
      const series = revenueSeries(period);
      for (const [index, item] of periodButtons.entries()) {
        const checked = PERIODS[index] === period;
        item.setAttribute('aria-checked', String(checked));
        item.tabIndex = checked ? 0 : -1;
      }
      tiles.invoiced.update({
        value: figures.invoiced, delta: figures.invoicedDelta, deltaLabel: period.compare,
        caption: `${formatNumber(figures.invoices)} invoices`, trend: series.invoiced
      });
      tiles.collected.update({
        value: figures.collected, delta: figures.collectedDelta, deltaLabel: period.compare,
        caption: `${formatPercent(figures.collected / figures.invoiced)} of invoiced`, trend: series.collected
      });
      tiles.won.update({
        value: figures.won, delta: figures.wonDelta, deltaLabel: period.compare,
        caption: `${formatNumber(figures.deals)} deals`, trend: spread(figures.won, 8, 3)
      });
      tiles.winRate.update({
        value: figures.winRate, delta: figures.winRateDelta, deltaLabel: period.compare,
        caption: `${formatNumber(Math.round(figures.winRate * figures.closed))} of ${formatNumber(figures.closed)} closed`,
        trend: spread(figures.winRate * 100, 8, 4.5)
      });

      revenueMeta.textContent = `${period.unit === 'month' ? 'By month' : period.unit === 'week' ? 'By week' : 'By day'}, last ${period.label}`;
      customersMeta.textContent = `Last ${period.label}`;
      const shares = Object.entries(CUSTOMER_SHARES[period.id]);
      customers.replaceChildren(...shares.map(([id, share]) => h('li', { class: 'dashboard__rank' },
        h('span', { class: 'dashboard__rank-name' }, company(id)?.name),
        h('span', { class: 'dashboard__rank-value num' }, money(Math.round((share * figures.invoiced) / 100) * 100)),
        h('span', { class: 'dashboard__bar', 'aria-hidden': 'true', style: { '--share': String(share / shares[0][1]) } }),
        h('span', { class: 'dashboard__rank-share meta num' }, formatPercent(share)))));

      const since = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() - period.days);
      const entries = ACTIVITY.filter((entry) => new Date(entry.at) >= since);
      activity.setItems(entries.map((entry, index) => {
        const actor = person(entry.actor)?.name ?? '';
        return {
          id: index, actor, avatar: { name: actor, size: 'sm' }, title: entry.title,
          timestamp: new Date(entry.at), timeLabel: formatRelativeTime(new Date(entry.at), { now: NOW })
        };
      }));
      tabs.setBadge('activity', String(entries.length));
    }

    /**
     * Draws the revenue chart in the current theme. Colours are read from the semantic tokens on
     * every call, so a theme switch only needs to call this again.
     * @param {boolean} animate Whether the change may animate.
     * @returns {void}
     */
    function renderChart(animate) {
      if (revenue.el.dataset.state === 'loading' || !root.isConnected) return;
      const palette = chartPalette(root);
      const series = revenueSeries(state.period);
      const scales = chartScales(palette, { unit: 'Thousand €' });
      scales.y = { ...scales.y, beginAtZero: true, ticks: { ...scales.y.ticks, maxTicksLimit: 5, callback: (value) => formatNumber(value / 1000) } };
      scales.x = { ...scales.x, ticks: { ...scales.x.ticks, maxRotation: 0, autoSkipPadding: 16 } };
      revenue.update({
        ...chartOptions(palette, animate && allowsMotion(context)),
        interaction: { mode: 'index', intersect: false },
        scales
      });
      revenue.setData({
        labels: series.labels,
        datasets: [
          {
            label: 'Invoiced', data: series.invoiced, fill: 'origin', borderColor: palette.series[0],
            backgroundColor: palette.series[0].replace(/[\d.]+\)$/, '0.1)')
          },
          { label: 'Collected', data: series.collected, fill: false, borderColor: palette.series[1], backgroundColor: palette.series[1] }
        ]
      });
    }

    /** @param {(typeof OPPORTUNITIES)[number]} row @returns {HTMLElement} The owner's avatar and name. */
    function owner(row) {
      const name = person(row.owner)?.name ?? '';
      if (!avatars.has(row.ID)) avatars.set(row.ID, keep(new Avatar(null, { name, size: 'sm' })));
      return h('span', { class: 'person' }, avatars.get(row.ID).toElement(), h('span', { class: 'person__name' }, name));
    }

    /** @param {(typeof OVERDUE)[number]} row @returns {HTMLElement} How late it is, as a status. */
    function lateBadge(row) {
      const days = Math.floor((NOW.getTime() - noon(row.due).getTime()) / 86_400_000);
      return badge({ label: `${formatNumber(days)} days`, kind: days > 30 ? 'danger' : 'warning', size: 'sm' });
    }

    /**
     * Sends a payment reminder for one invoice, once.
     * @param {(typeof OVERDUE)[number]} row
     * @returns {HTMLElement}
     */
    function reminder(row) {
      if (state.reminded.has(row.ID)) return h('span', { class: 'meta' }, 'Sent today');
      return button({
        label: 'Remind', size: 'sm', kind: 'ghost', icon: 'paper-plane',
        onclick: (event) => {
          event.stopPropagation();
          state.reminded.add(row.ID);
          overdue.updateRow(row.ID, row);
          notify(`Reminder for ${row.ID} sent to ${company(row.company)?.contact}.`);
        }
      });
    }

    /** Fetches fresh figures: the status reads "Refreshing…", then the time. @returns {void} */
    function refresh() {
      if (context.preview) return;
      updated.set('active', 'Refreshing…');
      later(context, () => {
        render();
        renderChart(true);
        updated.set('success', `Updated ${formatDate(NOW, DATE.time)}`);
      }, 600);
    }

    /** Downloads the window's headline figures as CSV. @returns {void} */
    function exportFigures() {
      const figures = FIGURES[state.period.id];
      const rows = [
        { metric: 'Invoiced', value: figures.invoiced }, { metric: 'Collected', value: figures.collected },
        { metric: 'Won', value: figures.won }, { metric: 'Win rate', value: figures.winRate }
      ];
      downloadBlob(`overview-${state.period.id}.csv`, toCsv(rows, [
        { id: 'metric', label: 'Metric' }, { id: 'value', label: `Last ${state.period.label}` }
      ]), { type: 'text/csv' });
      notify('Figures exported.');
    }
  }
};
