import {
  Aurora, Datebox, Message, Select, Table, Toggle, button, icon
} from '../src/index.js';

document.querySelectorAll('[data-feature-icon]').forEach((host) => {
  host.append(icon(host.dataset.featureIcon, { size: 18 }));
});

// The hero's ambient light is the shipped component, not a bespoke gradient: Aurora enhances
// the band in place, paints behind its existing children, and owns none of them. The palette
// is the ZeyOS accent plus the three module hues the launcher already uses.
new Aurora('#hero', {
  preset: 'confluence',
  colors: ['#21cc75', '#2b7fff', '#9a67ff', '#ffb900'],
  intensity: 'vivid'
});

const toggleOutput = document.querySelector('#toggle-output');
const toggle = new Toggle(null, {
  label: 'Enable invoice workflow',
  checked: true,
  onchange: (event) => {
    toggleOutput.textContent = event.detail.checked
      ? 'Workflow is enabled.'
      : 'Workflow is paused.';
  }
});
document.querySelector('#showcase-toggle').append(toggle.toElement());

const statuses = [
  { ID: 'open', name: 'Open' },
  { ID: 'paid', name: 'Paid' },
  { ID: 'overdue', name: 'Overdue' },
  { ID: 'draft', name: 'Draft' }
];
const selectOutput = document.querySelector('#select-output');
const select = new Select(null, {
  items: statuses,
  value: 'open',
  filter: 'local',
  placeholder: 'Find a status',
  onchange: (event) => {
    selectOutput.textContent = 'Selected: ' + (event.detail.item?.name ?? 'None');
  }
});
document.querySelector('#showcase-select').append(select.toElement());

const dateOutput = document.querySelector('#date-output');
const datebox = new Datebox(null, {
  value: new Date(2026, 6, 20),
  onchange: (event) => {
    dateOutput.textContent = event.detail.date
      ? 'Invoice date: ' + event.detail.date.toLocaleDateString()
      : 'Choose an invoice date.';
  }
});
document.querySelector('#showcase-date').append(datebox.toElement());

const toastButton = button({
  label: 'Show toast',
  kind: 'primary',
  icon: 'success',
  onclick: () => Message.success('Invoice saved successfully.')
});
document.querySelector('#showcase-message').append(toastButton);

const table = new Table(null, {
  columns: [
    { id: 'number', label: 'Number', sortable: true, width: '1fr' },
    { id: 'customer', label: 'Customer', sortable: true, width: '2fr' },
    { id: 'amount', label: 'Amount', type: 'currency', currency: 'EUR', sortable: true, width: '1fr' },
    { id: 'status', label: 'Status', sortable: true, width: '1fr' }
  ],
  data: [
    { ID: 1, number: 'INV-26041', customer: 'Alpine Works', amount: 4820, status: 'Open' },
    { ID: 2, number: 'INV-26038', customer: 'Northstar GmbH', amount: 1290.5, status: 'Paid' },
    { ID: 3, number: 'INV-26035', customer: 'Atelier West', amount: 760, status: 'Draft' },
    { ID: 4, number: 'INV-26029', customer: 'Danube Systems', amount: 9350, status: 'Overdue' }
  ],
  rowId: 'ID',
  sortMode: 'local',
  sort: { id: 'number', dir: 'desc' },
  stickyHeader: true
});
document.querySelector('#showcase-table').append(table.toElement());
