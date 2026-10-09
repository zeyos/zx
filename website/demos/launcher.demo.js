import { Launcher, button, h } from '../../src/index.js';
import {
  ZEYOS_LAUNCHER_APPLICATIONS, moduleInfo, zeyosLauncher
} from '../../src/zeyos/index.js';
import { demoZeyosAppIcon } from '../zeyos-demo-icons.js';

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

/** The agents the "Open agent" page lists: what each is on, and its state as the row's hint. */
const AGENTS = [
  { id: 'scout', name: 'Scout', task: 'Supplier audit', state: 'Working' },
  { id: 'ledger', name: 'Ledger', task: 'Invoice reconciliation', state: 'Waiting' },
  { id: 'atlas', name: 'Atlas', task: 'Route planning', state: 'Idle' },
  { id: 'quill', name: 'Quill', task: 'Release notes', state: 'Thinking' },
  { id: 'sentry', name: 'Sentry', task: 'Nightly checks', state: 'Idle' },
  { id: 'harbor', name: 'Harbor', task: 'Customer onboarding', state: 'Needs you' },
  { id: 'tally', name: 'Tally', task: 'Stock count', state: 'Working' }
];

/** Models for the "Switch model" page; the current one carries `current` and says so in its hint. */
const MODELS = [
  { id: 'swift', name: 'Swift', description: 'Fastest replies' },
  { id: 'balanced', name: 'Balanced', description: 'The default for most tasks' },
  { id: 'thorough', name: 'Thorough', description: 'Slower, careful reasoning' }
];

/** Workflows live on a server: the "Run workflow" page searches them as you type. */
const WORKFLOWS = [
  { id: 'supplier-report', name: 'Weekly supplier report' },
  { id: 'release-notes', name: 'Release notes' },
  { id: 'reconcile', name: 'Invoice reconciliation' },
  { id: 'onboarding', name: 'Onboard a customer' },
  { id: 'backup-check', name: 'Nightly backup check' }
];

/**
 * A page loader: called with the page's query and an abort signal whenever the query changes.
 * Each workflow is itself a page, one level deeper, with the environments it can run on.
 */
function searchWorkflows(query, { signal }) {
  return new Promise((resolve, reject) => {
    const needle = query.toLowerCase();
    const timer = setTimeout(() => resolve(WORKFLOWS
      .filter((workflow) => workflow.name.toLowerCase().includes(needle))
      .map((workflow) => ({
        id: workflow.id,
        label: workflow.name,
        items: [
          { id: `${workflow.id}:staging`, label: 'Run on staging', value: { workflow: workflow.id, on: 'staging' } },
          { id: `${workflow.id}:production`, label: 'Run on production', value: { workflow: workflow.id, on: 'production' } }
        ]
      }))), 400);
    signal.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    }, { once: true });
  });
}

/**
 * The palette's root: commands with key caps, and the three that open pages. A page is any item
 * with `items` — an array, or a loader like `searchWorkflows`. `groupOrder` and `itemOrder` keep
 * the order written here instead of the alphabetical one.
 * @param {string} currentModel Id of the model in use.
 */
function paletteItems(currentModel) {
  const model = MODELS.find((entry) => entry.id === currentModel);
  const groups = ['Commands', 'View'];
  return [
    { id: 'new-task', label: 'New task', icon: 'plus', group: 'Commands', shortcut: ['N'], keys: 'N' },
    {
      id: 'agents', label: 'Open agent', icon: 'folder-open', group: 'Commands', placeholder: 'Search agents',
      items: AGENTS.map((agent) => ({
        id: agent.id, label: agent.name, description: agent.task, hint: agent.state, keywords: [agent.task]
      }))
    },
    {
      id: 'workflows', label: 'Run workflow', icon: 'reload', group: 'Commands', placeholder: 'Search workflows',
      items: searchWorkflows
    },
    {
      id: 'model', label: 'Switch model', icon: 'gear', group: 'Commands', hint: model?.name,
      items: MODELS.map((entry) => ({
        id: entry.id, label: entry.name, description: entry.description,
        current: entry.id === currentModel, hint: entry.id === currentModel ? 'Current' : null
      }))
    },
    { id: 'panel', label: 'Toggle panel', icon: 'square', group: 'View', shortcut: ['Ctrl', 'J'], keys: 'Control+J' },
    { id: 'help', label: 'Keyboard shortcuts', icon: 'info', group: 'View', shortcut: ['?'] }
  ].map((item, itemOrder) => ({ ...item, groupOrder: groups.indexOf(item.group), itemOrder }));
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
  group: 'Layout',
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
          renderApplicationIcon: (_raw, app) => demoZeyosAppIcon(app.module, {
            size: 36, label: app.label, shape: 'circle'
          }),
          renderRecordIcon: (_raw, record) => demoZeyosAppIcon(record.entity, {
            size: 28, label: record.name, shape: 'tile'
          }),
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
    },
    {
      title: 'Command palette with pages',
      blurb: 'An item with items opens a page: the query clears, a chip names the page, and Backspace '
        + 'on the empty query, ArrowLeft, or the chip\'s × goes back. "Run workflow" loads its page '
        + 'as you type and nests a page per workflow. Rows show a hint and key caps; open({ page }) '
        + 'opens straight into one.',
      render: ({ cleanup, log }) => {
        let model = 'balanced';
        const launcher = new Launcher(null, {
          items: paletteItems(model),
          label: 'Commands',
          placeholder: 'Type a command',
          shortcut: false,
          onpage: ({ detail }) => log(`page ${detail.path.map((page) => page.label).join(' › ') || 'root'}`),
          onselect: ({ detail }) => {
            log(`select ${detail.page ? `${detail.page.label} › ` : ''}${detail.item.label}`);
            if (detail.page?.id === 'model') {
              model = String(detail.item.id);
              launcher.setItems(paletteItems(model));
            }
          }
        });
        cleanup(() => launcher.destroy());
        return h('div', { class: 'demo-row' },
          button({ label: 'Open command palette', onclick: () => launcher.open() }),
          button({ label: 'Switch model…', kind: 'ghost', onclick: () => launcher.open({ page: 'model' }) }));
      }
    }
  ]
};
