import {
  AppSidebar, Aurora, Card, MasterPanel, Search, Select, Table, badge, h
} from '../src/index.js';
import { demoZeyosAppIcon } from './zeyos-demo-icons.js';

const PALETTES = Object.freeze({
  northern: ['#21cc75', '#2b7fff', '#9a67ff', '#ffb900'],
  polar: ['#2b7fff', '#06b6d4', '#21cc75', '#9a67ff'],
  solar: ['#ff6f54', '#ffb900', '#d946ef', '#2b7fff'],
  ocean: ['#0ea5e9', '#14b8a6', '#6366f1', '#22c55e']
});

const INVOICES = Object.freeze([
  { ID: 26041, number: 'INV-26041', customer: 'Alpine Works', status: 'Open', due: '28 Aug 2026', amount: 4820 },
  { ID: 26038, number: 'INV-26038', customer: 'Northstar GmbH', status: 'Paid', due: '26 Aug 2026', amount: 1290.5 },
  { ID: 26035, number: 'INV-26035', customer: 'Atelier West', status: 'Draft', due: '2 Sep 2026', amount: 760 },
  { ID: 26029, number: 'INV-26029', customer: 'Danube Systems', status: 'Overdue', due: '18 Aug 2026', amount: 9350 },
  { ID: 26024, number: 'INV-26024', customer: 'Vertex Labs', status: 'Open', due: '5 Sep 2026', amount: 2480 }
]);

const STATUS_KIND = Object.freeze({ Open: 'info', Paid: 'success', Draft: 'neutral', Overdue: 'danger' });
const currency = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'EUR' });
const components = [];

const controls = document.querySelector('#aurora-controls');
const stageHost = document.querySelector('#aurora-stage');
const code = document.querySelector('#aurora-code');

const preset = track(new Select(null, {
  items: [
    { ID: 'source', name: 'Source Bloom' },
    { ID: 'confluence', name: 'Corner Confluence' },
    { ID: 'horizon', name: 'Horizon Band' },
    { ID: 'diagonal', name: 'Diagonal Veil' },
    { ID: 'edge', name: 'Edge Frame' },
    { ID: 'curtain', name: 'Curtain Field' }
  ],
  value: 'source',
  filter: false,
  onchange: updateExample
}));
const palette = track(new Select(null, {
  items: [
    { ID: 'northern', name: 'Northern lights' },
    { ID: 'polar', name: 'Polar dusk' },
    { ID: 'solar', name: 'Solar flare' },
    { ID: 'ocean', name: 'Ocean current' }
  ],
  value: 'northern',
  filter: false,
  onchange: updateExample
}));
const intensity = track(new Select(null, {
  items: [
    { ID: 'subtle', name: 'Subtle' },
    { ID: 'balanced', name: 'Balanced' },
    { ID: 'vivid', name: 'Vivid' }
  ],
  value: 'balanced',
  filter: false,
  onchange: updateExample
}));

controls.replaceChildren(
  field('Preset', preset.toElement()),
  field('Palette', palette.toElement()),
  field('Intensity', intensity.toElement())
);

const search = track(new Search(null, {
  placeholder: 'Search invoices',
  debounce: 0,
  oninput: ({ detail }) => {
    const needle = detail.value.trim().toLowerCase();
    table.setData(INVOICES.filter((row) => Object.values(row).join(' ').toLowerCase().includes(needle)));
  }
}));

const table = track(new Table(null, {
  columns: [
    { id: 'number', label: 'Invoice', sortable: true, width: '1fr' },
    { id: 'customer', label: 'Customer', sortable: true, width: '1.5fr' },
    { id: 'status', label: 'Status', width: '1fr', render: (row) => badge({ label: row.status, kind: STATUS_KIND[row.status] }) },
    { id: 'due', label: 'Due', width: '1fr' },
    { id: 'amount', label: 'Amount', align: 'right', width: '1fr', render: (row) => currency.format(row.amount) }
  ],
  data: INVOICES,
  rowId: 'ID',
  sort: { id: 'number', dir: 'desc' },
  sortMode: 'local',
  stickyHeader: true,
  zebra: true,
  responsive: 'md'
}));

const summaryCards = [
  ['Open amount', '€42,840.00', 'Across 18 invoices'],
  ['Due this week', '8 invoices', 'Next settlement Friday'],
  ['Overdue', '€3,120.00', 'Two customers']
].map(([title, value, footer]) => track(new Card(null, {
  variant: 'raised',
  title,
  content: h('strong', { class: 'aurora-metric' }, value),
  footer
})));

const panel = track(new MasterPanel(null, {
  title: 'Billing',
  module: 'billing',
  buttons: [
    { label: 'Export', icon: 'upload' },
    { label: 'New invoice', icon: 'plus', kind: 'primary' }
  ],
  content: h('div', { class: 'aurora-workspace__content' },
    h('div', { class: 'aurora-workspace__search' }, search.toElement()),
    h('div', { class: 'aurora-workspace__summary' }, summaryCards.map((card) => card.toElement())),
    table.toElement()),
  footer: 'Aurora canvas · translucent chrome · opaque data plane'
}));

const applicationItems = [
  { id: 'accounts', module: 'accounts', label: 'Accounts', href: '#accounts' },
  { id: 'billing', module: 'billing', label: 'Billing', href: '#billing' },
  { id: 'calendar', module: 'calendar', label: 'Calendar', href: '#calendar' },
  { id: 'projects', module: 'projects', label: 'Projects', href: '#projects' }
];
const sidebar = track(new AppSidebar(null, {
  collapsed: true,
  active: 'billing',
  railHeader: demoZeyosAppIcon('main', { size: 36, shape: 'circle', label: 'ZeyOS' }),
  items: applicationItems,
  renderIcon: (item) => demoZeyosAppIcon(item.module, {
    size: 26,
    label: item.label,
    shape: 'circle'
  }),
  onselect: (event) => {
    event.preventDefault();
    sidebar.setActive(event.detail.id);
  }
}));

const paymentCard = track(new Card(null, {
  title: 'Payment received',
  variant: 'raised',
  content: 'INV-26038 · Northstar GmbH',
  footer: '€1,290.50 settled today'
}));
const floating = h('div', { class: 'aurora-workspace__glass' }, paymentCard.toElement());

stageHost.replaceChildren(sidebar.toElement(), panel.toElement(), floating);
const stage = track(new Aurora(stageHost, {
  preset: 'source',
  colors: PALETTES.northern,
  intensity: 'balanced'
}));

for (const target of document.querySelectorAll('[data-aurora-preset]')) {
  const card = track(new Card(null, {
    variant: 'raised',
    title: 'Customer record',
    content: 'Liquid Glass surface',
    footer: 'Aurora remains on the canvas'
  }));
  target.append(card.toElement());
  track(new Aurora(target, {
    preset: target.dataset.auroraPreset,
    colors: PALETTES.northern,
    intensity: 'balanced'
  }));
}

updateExample();

function updateExample() {
  if (!stage) return;
  const colors = PALETTES[palette.value];
  stage.setPreset(preset.value).setColors(colors).setIntensity(intensity.value);
  code.textContent = `import { Aurora } from '@zeyos/zx';

const aurora = new Aurora('#workspace', {
  preset: '${preset.value}',
  colors: [${colors.map((color) => `'${color}'`).join(', ')}],
  intensity: '${intensity.value}'
});

aurora.setPreset('horizon');`;
}

function field(label, control) {
  return h('label', {}, h('span', {}, label), control);
}

function track(component) {
  components.push(component);
  return component;
}

window.addEventListener('pagehide', () => {
  for (const component of components.reverse()) component.destroy();
}, { once: true });
