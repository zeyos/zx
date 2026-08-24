import { button, h, icon } from '../../src/index.js';
import {
  ZEYOS_LAUNCHER_APPLICATIONS, moduleChip, moduleInfo, zeyosLauncher
} from '../../src/zeyos/index.js';

const BUILTIN_APP_ICONS = {
  accounts: 'folder', actionsteps: 'clock', admin: 'gear', auth: 'lock', billing: 'file',
  calendar: 'calendar', campaigns: 'star', collection: 'folder-open', contacts: 'book',
  contracts: 'file', control: 'filter', coupons: 'tag', dev: 'code', documents: 'copy',
  inventory: 'square', mailinglists: 'list', main: 'heart', messages: 'info', links: 'tag',
  notes: 'file', objects: 'square', opportunities: 'star', payments: 'check', pricelists: 'list',
  procurement: 'folder-open', production: 'gear', projects: 'folder', tasks: 'check', tickets: 'tag'
};

const RECENT = [
  { entity: 'accounts', ID: 18, name: 'Nordwind GmbH', sec: 'Customer · Berlin' },
  { entity: 'transactions.billing', ID: 1042, name: 'INV-1042', sec: 'Nordwind GmbH · €1,428.00' },
  { entity: 'projects', ID: 7, name: 'Berlin office refit', sec: 'Project · Active' },
  { entity: 'contacts', ID: 31, name: 'Marta Hoffmann', sec: 'Nordwind GmbH' }
];

const SEARCH_RECORDS = {
  '': [[18, null, 'Nordwind GmbH', 'Customer · Berlin', 'accounts']],
  contacts: [[31, null, 'Marta Hoffmann', 'Nordwind GmbH']],
  'transactions.billing': [[1042, null, 'INV-1042', 'Nordwind GmbH · €1,428.00']],
  projects: [[7, null, 'Berlin office refit', 'Active']]
};

function builtinModuleChip(module, size) {
  const chip = moduleChip(module, { size });
  chip.replaceChildren(icon(BUILTIN_APP_ICONS[module] ?? 'square'));
  return chip;
}

function searchRecords(query, { signal }) {
  return new Promise((resolve, reject) => {
    const needle = query.toLowerCase();
    const filtered = Object.fromEntries(Object.entries(SEARCH_RECORDS).map(([group, rows]) => [
      group,
      rows.filter((row) => row.join(' ').toLowerCase().includes(needle))
    ]).filter(([, rows]) => rows.length));
    const timer = setTimeout(() => resolve(filtered), 180);
    signal.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    }, { once: true });
  });
}

export default {
  title: 'Launcher',
  group: 'Navigation',
  blurb: 'A full application launcher with app tiles, current and pinned state, recent records, grouped asynchronous search, and application-owned routing.',
  examples: [
    {
      title: 'Complete ZeyOS application launcher',
      blurb: 'Press the button or Cmd/Ctrl+K. The optional adapter maps all 29 prototype applications, recent items, permissions, current state, host-provided icons, and grouped abortable record results onto the generic Launcher.',
      render: ({ cleanup, log }) => {
        const launcher = zeyosLauncher({
          modules: Object.fromEntries(ZEYOS_LAUNCHER_APPLICATIONS.map((id) => [id, moduleInfo(id).label])),
          pinned: ['billing', 'contacts', 'calendar', 'projects'],
          recent: RECENT,
          activeIdentifier: 'billing',
          canUseModule: () => true,
          search: searchRecords,
          resolveApplication: (raw) => ({ value: Array.isArray(raw) ? raw[0] : raw.identifier, invoke() {} }),
          resolveRecord: (record) => ({ value: record, invoke() {} }),
          renderApplicationIcon: (_raw, app) => builtinModuleChip(app.module, 36),
          renderRecordIcon: (_raw, record) => builtinModuleChip(record.entity, 28),
          labels: {
            entities: {
              contacts: 'Contacts', projects: 'Projects',
              'transactions.billing': 'Billing'
            }
          }
        }, {
          onselect: ({ detail }) => log(`select ${detail.source ?? 'local'}:${detail.item.id}`),
          onerror: ({ detail }) => log(`source error: ${detail.source.id}`)
        });
        cleanup(() => launcher.destroy());
        return h('div', { class: 'demo-row' },
          button({ label: 'Open launcher', kind: 'primary', onclick: () => launcher.open() }),
          h('span', { class: 'demo-caption' }, 'Shortcut: Cmd/Ctrl+K'));
      }
    }
  ]
};
