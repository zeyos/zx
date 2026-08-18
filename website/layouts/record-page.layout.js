import {
  Finder, MasterPanel, Message, Rating, Tabbox, Table, TagPicker, badge, button, h
} from '../../src/index.js';

const POSITIONS = [
  { ID: 1, article: 'Platform licence — enterprise', quantity: 25, price: 480, unit: 'seat' },
  { ID: 2, article: 'Implementation package', quantity: 1, price: 14800, unit: 'flat' },
  { ID: 3, article: 'On-site training day', quantity: 4, price: 1450, unit: 'day' },
  { ID: 4, article: 'Priority support (annual)', quantity: 1, price: 9600, unit: 'year' }
];

const ACTIVITY = [
  { time: 'Today, 09:12', text: 'Tobias Kern moved the opportunity to Negotiation' },
  { time: 'Yesterday', text: 'Quotation QT-26014 sent to Ines Bauer' },
  { time: '2 Aug 2026', text: 'Technical review scheduled for 18 August' },
  { time: '28 Jul 2026', text: 'Migration plan attached by Ines Bauer' },
  { time: '19 Jul 2026', text: 'Opportunity created from an inbound enquiry' }
];

const DOCUMENTS = [
  {
    ID: 'quotes',
    name: 'Quotations',
    children: [
      { ID: 'qt-26014', name: 'QT-26014.pdf', size: '128 kB' },
      { ID: 'qt-26009', name: 'QT-26009.pdf', size: '119 kB' }
    ]
  },
  {
    ID: 'technical',
    name: 'Technical',
    children: [
      { ID: 'spec', name: 'Specification.md', size: '38 kB' },
      { ID: 'plan', name: 'Migration plan.xlsx', size: '74 kB' }
    ]
  },
  { ID: 'nda', name: 'NDA (signed).pdf', size: '64 kB' }
];

const currency = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'EUR' });

export default {
  title: 'Record page',
  group: 'Applications',
  blurb: 'A single record opened full-screen: a summary header, then tabs for the positions, the '
    + 'attached documents, and the activity trail.',

  /**
   * Mounts a record page with a summary header and tabbed detail sections.
   * @param {HTMLElement} container Documentation stage.
   * @returns {void}
   */
  mount(container) {
    const log = h('p', { class: 'layout-hint' }, 'Edit the tags or the rating to see events fire.');

    const tags = new TagPicker(null, {
      items: [
        { ID: 'strategic', name: 'Strategic' }, { ID: 'renewal', name: 'Renewal' },
        { ID: 'at', name: 'Austria' }, { ID: 'logistics', name: 'Logistics' },
        { ID: 'enterprise', name: 'Enterprise' }
      ],
      values: ['strategic', 'logistics'],
      allowCreate: true,
      placeholder: 'Add a tag',
      onchange: (event) => { log.textContent = `tags → [${event.detail.values.join(', ')}]`; }
    });

    const confidence = new Rating(null, {
      value: 4,
      label: 'Win confidence',
      labels: ['Very low', 'Low', 'Even', 'Likely', 'Committed'],
      showValue: true,
      onchange: (event) => { log.textContent = `confidence → ${event.detail.value}/5`; }
    });

    const positions = new Table(null, {
      columns: [
        { id: 'article', label: 'Article', sortable: true, width: '2.4fr' },
        { id: 'quantity', label: 'Qty', sortable: true, align: 'end', width: '0.6fr' },
        { id: 'unit', label: 'Unit', width: '0.7fr' },
        {
          id: 'price',
          label: 'Unit price',
          sortable: true,
          align: 'end',
          width: '1fr',
          render: (row) => currency.format(row.price)
        },
        {
          id: 'total',
          label: 'Total',
          align: 'end',
          width: '1fr',
          sortValue: (row) => row.quantity * row.price,
          render: (row) => currency.format(row.quantity * row.price)
        }
      ],
      data: POSITIONS,
      rowId: 'ID',
      sortMode: 'local',
      zebra: true
    });

    const documents = new Finder(null, {
      items: DOCUMENTS,
      rootLabel: 'Documents',
      columnWidth: 200,
      height: 240,
      preview: (node) => h('div', { class: 'layout-stack' },
        h('strong', {}, node.name),
        h('p', { class: 'layout-hint' }, `${node.size} · attached to this opportunity`),
        button({
          label: 'Download',
          icon: 'upload',
          size: 'sm',
          onclick: () => Message.info(`${node.name} would download here.`)
        }))
    });

    const activity = h('ul', { class: 'activity-list' },
      ACTIVITY.map((entry) => h('li', {},
        h('span', { class: 'activity-dot', 'aria-hidden': 'true' }),
        h('span', {}, entry.text),
        h('span', { class: 'activity-time' }, entry.time))));

    const total = POSITIONS.reduce((sum, row) => sum + row.quantity * row.price, 0);
    const header = h('header', { class: 'record-header' },
      h('div', { class: 'record-header__main' },
        h('p', { class: 'layout-hint' }, 'Opportunity · OPP-26041'),
        h('h2', { class: 'record-header__title' }, 'Warehouse rollout — Bruckner Logistik'),
        h('div', { class: 'record-header__pills' },
          badge({ label: 'Negotiation', kind: 'accent' }),
          badge({ label: 'Owner: T. Kern' }),
          badge({ label: 'Close: 2 Nov 2026' }))),
      h('dl', { class: 'record-header__facts' },
        h('dt', {}, 'Value'), h('dd', {}, currency.format(total)),
        h('dt', {}, 'Confidence'), h('dd', {}, confidence.toElement()),
        h('dt', {}, 'Tags'), h('dd', {}, tags.toElement())));

    const tabs = new Tabbox(null, {
      tabs: [
        { name: 'positions', title: 'Positions', content: positions.toElement() },
        { name: 'documents', title: 'Documents', content: documents.toElement() },
        { name: 'activity', title: 'Activity', content: activity }
      ],
      active: 'positions'
    });
    tabs.setBadge('positions', String(POSITIONS.length));
    tabs.setBadge('activity', String(ACTIVITY.length));

    const shell = new MasterPanel(null, {
      title: 'Opportunity',
      module: 'opportunities',
      content: h('div', { class: 'layout-stack' }, header, tabs.toElement(), log),
      buttons: [
        {
          label: 'Create quotation',
          icon: 'plus',
          kind: 'primary',
          onclick: () => Message.success('A quotation wizard would open here.')
        },
        { label: 'Mark won', icon: 'check', onclick: () => Message.success('Opportunity won.') }
      ],
      footer: 'Record page · summary header plus tabbed detail sections'
    });

    container.append(h('div', { class: 'layout-frame' }, shell.toElement()));
  }
};
