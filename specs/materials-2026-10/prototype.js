// Internal exploration — builds the comparison grid. Not part of the site or the package.
import { AppIcon, Aurora, Card, Table, Toggle, badge, button, h, icon } from '../../src/index.js';

const ROWS = [
  { id: 'flat', title: 'Flat', note: 'Current. Opaque surfaces, no filters.', code: 'glass: none' },
  { id: 'stock', title: 'Glass', note: 'Current. A grey tint with blur and a corner wash; in dark it is a 70% grey slab.', code: 'glass: subtle (stylesheet defaults)' },
  { id: 'deep-current', title: 'Deep glass', note: 'Current. The same recipe with larger numbers — thinner, blurrier, and muddier.', code: 'glass: strong' },
  { id: 'glass', title: 'Glass — proposed', note: 'Lift instead of grey, a lit top edge and a cut outer edge, brightness in the filter so text keeps contrast, a faint accent caustic.', code: 'proposed glass' },
  { id: 'deep', title: 'Deep glass — proposed', note: 'A thick pane: a double rim with an inner glow, one narrow specular band, a stronger caustic, fine grain, wider blur and more saturation.', code: 'proposed deep' },
  { id: 'frost', title: 'Frost — new', note: 'Milk glass. Heavy diffusion, almost no reflection; colour behind becomes a wash and text reads as on paper.', code: 'frost' },
  { id: 'smoke', title: 'Smoke — new', note: 'Tinted glass that darkens the scene behind it. Sunglass glass in dark, a grey-smoked pane in light.', code: 'smoke' },
  { id: 'paper', title: 'Paper — new', note: 'Opaque and matte: depth from layered soft shadows and a fine tooth, no blur anywhere. The cheapest to render.', code: 'paper' },
  { id: 'satin', title: 'Satin — new', note: 'Brushed and opaque: a vertical sheen on controls and chrome, a bright top rim and a darker foot.', code: 'satin' }
];

const TONES = ['blue', 'teal', 'amber', 'orange', 'pink', 'violet'];
const ROWS_DATA = [
  { ID: 1, number: 'INV-26041', customer: 'Alpine Works GmbH', amount: 12480, state: 'Paid' },
  { ID: 2, number: 'INV-26042', customer: 'Danube Systems AG', amount: 3290, state: 'Open' },
  { ID: 3, number: 'INV-26043', customer: 'Nordlicht Studio', amount: 18900, state: 'Overdue' },
  { ID: 4, number: 'INV-26044', customer: 'Brenner Logistik', amount: 760, state: 'Draft' }
];

function page() {
  const table = new Table(null, {
    columns: [
      { id: 'number', label: 'Number', width: '1fr' },
      { id: 'customer', label: 'Customer', width: '2fr' },
      { id: 'amount', label: 'Amount', type: 'currency', currency: 'EUR', align: 'end', width: '1fr' },
      { id: 'state', label: 'State', width: '1fr', render: (row) => badge({ label: row.state, kind: { Paid: 'success', Open: 'info', Overdue: 'danger', Draft: 'neutral' }[row.state], size: 'sm' }) }
    ],
    data: ROWS_DATA, zebra: true
  });
  return h('div', { class: 'p-page' },
    h('h4', {}, 'Invoices'),
    h('p', {}, 'Open and overdue documents for the quarter, grouped by customer. The glass above refracts this text, the colour chips and the table.'),
    h('div', { class: 'p-tones' }, TONES.map((tone) => h('span', { style: `background: var(--zx-color-tone-${tone}-solid)` }))),
    table.toElement());
}

function chrome() {
  return h('nav', { class: 'p-chrome', 'aria-label': 'Modules' },
    h('div', { class: 'p-current' }, icon('folder')),
    icon('mail'), icon('calendar'), icon('tag'), icon('gear'));
}

function overlays() {
  const card = new Card(null, {
    variant: 'raised', title: 'Raised card',
    content: 'A feature surface on the page, one step above it.',
    actions: [{ label: 'Review', kind: 'primary', size: 'sm' }]
  }).toElement();
  card.classList.add('p-over', 'p-card');
  const icons = h('div', { class: 'p-over p-icons' },
    new AppIcon(null, { icon: 'folder', color: '#bc3885', size: 44, label: 'Accounts', shape: 'circle' }).toElement(),
    new AppIcon(null, { icon: 'file', color: '#535494', size: 44, label: 'Billing', shape: 'circle' }).toElement(),
    new AppIcon(null, { icon: 'check', color: '#e2b301', size: 44, label: 'Tasks' }).toElement());
  const buttons = h('div', { class: 'p-over p-buttons' },
    button({ label: 'Default', size: 'sm' }),
    button({ label: 'Primary', kind: 'primary', size: 'sm' }),
    button({ icon: 'filter', title: 'Filter', size: 'sm' }),
    new Toggle(null, { label: 'Live', value: true }).toElement());
  const menu = h('div', { class: 'p-over p-menu', role: 'presentation' },
    h('div', {}, icon('eye'), 'Open'),
    h('div', { 'data-hover': '' }, icon('copy'), 'Duplicate'),
    h('div', { 'data-selected': '' }, icon('check'), 'Mark as paid'),
    h('hr'),
    h('div', { 'data-danger': '' }, icon('trash'), 'Delete'));
  const dialog = h('div', { class: 'p-over p-dialog' },
    h('header', {}, 'Record payment', icon('x')),
    h('div', { class: 'p-body' }, 'A dialog brings its own header, footer and button row.'),
    h('footer', {}, button({ label: 'Cancel', size: 'sm' }), button({ label: 'Post', kind: 'primary', size: 'sm' })));
  const toast = h('div', { class: 'p-over p-toast' }, icon('check'), 'Payment recorded');
  return [card, icons, buttons, menu, dialog, toast];
}

function cell(theme, material) {
  const scene = h('div', { class: 'p-scene' }, chrome(), page());
  const region = h('div', { class: 'p-cell', 'data-zx-theme': theme, 'data-material': material }, scene, ...overlays());
  new Aurora(scene, { preset: 'confluence', intensity: 'balanced' });
  return region;
}

const grid = document.getElementById('grid');
grid.append(h('h2'), h('h2', {}, 'Light'), h('h2', {}, 'Dark'));
for (const row of ROWS) {
  grid.append(h('div', { class: 'p-row', 'data-row': row.id },
    h('div', { class: 'p-label' }, h('h3', {}, row.title), h('p', {}, row.note), h('code', {}, row.code)),
    cell('light', row.id), cell('dark', row.id)));
}

document.getElementById('aurora').addEventListener('change', (event) => {
  grid.classList.toggle('no-aurora', !event.target.checked);
});
document.getElementById('busy').addEventListener('change', (event) => {
  for (const el of grid.querySelectorAll('.p-page')) el.style.visibility = event.target.checked ? '' : 'hidden';
});
