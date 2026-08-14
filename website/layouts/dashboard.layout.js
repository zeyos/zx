import { MasterPanel, Message, Select, Table, Tabbox, button, h, icon } from '../../src/index.js';

const PERIODS = [
  { ID: 'month', name: 'This month' },
  { ID: 'quarter', name: 'This quarter' },
  { ID: 'year', name: 'This year' }
];

/** Figures per period, so switching the range visibly re-renders the whole dashboard. */
const FIGURES = {
  month: [
    { label: 'Open revenue', value: 284_500, delta: 8.4 },
    { label: 'Invoiced', value: 196_200, delta: 2.1 },
    { label: 'Overdue', value: 41_800, delta: -12.6 },
    { label: 'Win rate', value: 0.38, delta: 3.2, percent: true }
  ],
  quarter: [
    { label: 'Open revenue', value: 812_300, delta: 5.9 },
    { label: 'Invoiced', value: 604_700, delta: 11.4 },
    { label: 'Overdue', value: 88_400, delta: 4.8 },
    { label: 'Win rate', value: 0.41, delta: 1.1, percent: true }
  ],
  year: [
    { label: 'Open revenue', value: 3_140_900, delta: 14.2 },
    { label: 'Invoiced', value: 2_806_400, delta: 9.7 },
    { label: 'Overdue', value: 121_600, delta: -6.3 },
    { label: 'Win rate', value: 0.44, delta: 2.4, percent: true }
  ]
};

const OPPORTUNITIES = [
  { ID: 1, name: 'Warehouse rollout', account: 'Danube Systems AG', owner: 'T. Kern', value: 128_000, stage: 'Negotiation', close: '2026-09-30' },
  { ID: 2, name: 'Reporting add-on', account: 'Kestrel Analytics', owner: 'O. Blythe', value: 24_500, stage: 'Proposal', close: '2026-08-31' },
  { ID: 3, name: 'Seat expansion', account: 'Alpine Works GmbH', owner: 'N. Roth', value: 41_200, stage: 'Qualification', close: '2026-10-15' },
  { ID: 4, name: 'Dispatch migration', account: 'Bruckner Logistik', owner: 'I. Bauer', value: 96_800, stage: 'Proposal', close: '2026-11-02' },
  { ID: 5, name: 'Service contract', account: 'Atelier West', owner: 'C. Fournier', value: 18_900, stage: 'Negotiation', close: '2026-08-22' }
];

const ACTIVITY = [
  { time: '09:12', text: 'Invoice INV-26041 sent to Alpine Works GmbH' },
  { time: '08:47', text: 'Tobias Kern moved “Warehouse rollout” to Negotiation' },
  { time: 'Yesterday', text: 'Payment of € 12 400 matched to INV-26038' },
  { time: 'Yesterday', text: 'Three tickets closed in the Service queue' },
  { time: 'Monday', text: 'Quarterly business review scheduled with Danube Systems AG' }
];

const WORKLOAD = [
  { ID: 1, member: 'Nadine Roth', team: 'Sales', open: 12, overdue: 1, utilisation: 0.82 },
  { ID: 2, member: 'Tobias Kern', team: 'Sales', open: 18, overdue: 4, utilisation: 0.96 },
  { ID: 3, member: 'Camille Fournier', team: 'Service', open: 7, overdue: 0, utilisation: 0.61 },
  { ID: 4, member: 'Owen Blythe', team: 'Service', open: 9, overdue: 2, utilisation: 0.74 }
];

const currency = new Intl.NumberFormat(undefined, {
  style: 'currency', currency: 'EUR', maximumFractionDigits: 0
});
const percent = new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 0 });

export default {
  title: 'Dashboard',
  group: 'Applications',
  blurb: 'An overview screen: a row of figures above tabbed detail views, with one control at the '
    + 'top that re-renders everything below it.',

  /**
   * Mounts a reporting dashboard: stat tiles, a Tabbox, and two tables.
   * @param {HTMLElement} container Documentation stage.
   * @returns {void}
   */
  mount(container) {
    const stats = h('div', { class: 'stat-grid' });
    renderStats('month');

    const period = new Select(null, {
      items: PERIODS,
      value: 'month',
      filter: false,
      onchange: (event) => renderStats(event.detail.value)
    });

    const toolbar = h('div', { class: 'layout-toolbar' },
      h('span', { class: 'layout-hint' }, 'Reporting period'),
      period.toElement(),
      h('span', { class: 'layout-toolbar__spacer' }),
      button({
        label: 'Share snapshot',
        icon: 'upload',
        size: 'sm',
        onclick: () => Message.info('A snapshot link would be copied to the clipboard.')
      })
    );

    const pipeline = new Table(null, {
      columns: [
        { id: 'name', label: 'Opportunity', sortable: true, width: '2fr' },
        { id: 'account', label: 'Account', sortable: true, width: '2fr' },
        { id: 'owner', label: 'Owner', sortable: true, width: '1fr' },
        { id: 'stage', label: 'Stage', sortable: true, width: '1.2fr' },
        {
          id: 'value',
          label: 'Value',
          sortable: true,
          align: 'right',
          width: '1fr',
          render: (row) => currency.format(row.value)
        },
        {
          id: 'close',
          label: 'Expected close',
          sortable: true,
          width: '1.2fr',
          render: (row) => new Date(row.close).toLocaleDateString()
        }
      ],
      data: OPPORTUNITIES,
      rowId: 'ID',
      sortMode: 'local',
      sort: { id: 'value', dir: 'desc' },
      stickyHeader: true,
      zebra: true,
      onrowclick: (event) => Message.info(`Opening ${event.detail.row.name}.`)
    });

    const workload = new Table(null, {
      columns: [
        { id: 'member', label: 'Team member', sortable: true, width: '2fr' },
        { id: 'team', label: 'Team', sortable: true, width: '1fr' },
        { id: 'open', label: 'Open items', sortable: true, align: 'right', width: '1fr' },
        { id: 'overdue', label: 'Overdue', sortable: true, align: 'right', width: '1fr' },
        {
          id: 'utilisation',
          label: 'Utilisation',
          sortable: true,
          align: 'right',
          width: '1fr',
          render: (row) => percent.format(row.utilisation)
        }
      ],
      data: WORKLOAD,
      rowId: 'ID',
      sortMode: 'local',
      sort: { id: 'open', dir: 'desc' },
      zebra: true
    });

    const activity = h('ul', { class: 'activity-list' },
      ACTIVITY.map((entry) => h('li', {},
        h('span', { class: 'activity-dot', 'aria-hidden': 'true' }),
        h('span', {}, entry.text),
        h('span', { class: 'activity-time' }, entry.time)
      ))
    );

    const tabs = new Tabbox(null, {
      tabs: [
        { name: 'pipeline', title: 'Pipeline', content: pipeline.toElement() },
        { name: 'activity', title: 'Activity', content: activity },
        { name: 'workload', title: 'Team load', content: workload.toElement() }
      ],
      active: 'pipeline'
    });
    tabs.setBadge('pipeline', String(OPPORTUNITIES.length));

    const shell = new MasterPanel(null, {
      title: 'Overview',
      module: 'opportunities',
      content: h('div', { class: 'layout-stack' }, toolbar, stats, tabs.toElement()),
      buttons: [
        {
          label: 'New opportunity',
          icon: 'plus',
          kind: 'primary',
          onclick: () => Message.success('A creation dialog would open here.')
        },
        { label: 'Refresh', icon: 'reload', onclick: () => Message.info('Figures refreshed.') }
      ],
      footer: 'Dashboard · figures, tabbed detail, and a shared period control'
    });

    container.append(h('div', { class: 'layout-frame' }, shell.toElement()));

    /**
     * Renders the stat tiles for one reporting period.
     * @param {string} key Period id.
     * @returns {void}
     */
    function renderStats(key) {
      stats.replaceChildren(...FIGURES[key].map((figure) => h('div', { class: 'stat-card' },
        h('span', { class: 'stat-card__label' }, figure.label),
        h('span', { class: 'stat-card__value' },
          figure.percent ? percent.format(figure.value) : currency.format(figure.value)),
        h('span', {
          class: 'stat-card__delta',
          dataset: { trend: figure.delta >= 0 ? 'up' : 'down' }
        },
        icon(figure.delta >= 0 ? 'chevron-up' : 'chevron-down', { size: 12 }),
        ` ${Math.abs(figure.delta).toFixed(1)}% vs. previous`)
      )));
    }
  }
};
