import { Launcher, button, h } from '../../src/index.js';

const APPS = [
  { id: 'invoices', label: 'Invoices', description: 'Billing and payments', icon: 'file', group: 'Applications', pinned: 0 },
  { id: 'contacts', label: 'Contacts', description: 'Customers and suppliers', icon: 'book', group: 'Applications', pinned: 1 },
  { id: 'calendar', label: 'Calendar', description: 'Meetings and deadlines', icon: 'calendar', group: 'Applications' },
  { id: 'settings', label: 'System settings', description: 'Workspace configuration', icon: 'gear', group: 'Applications' }
];

function recordSource() {
  const records = [
    { id: 'contact-18', label: 'Nordwind GmbH', description: 'Contact · Berlin' },
    { id: 'invoice-1042', label: 'INV-1042', description: 'Invoice · Nordwind GmbH' },
    { id: 'project-7', label: 'Berlin office refit', description: 'Project · Active' }
  ];
  return {
    id: 'records',
    label: 'Records',
    minQuery: 1,
    load(query, { signal }) {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => resolve(records.filter((record) =>
          `${record.label} ${record.description}`.toLowerCase().includes(query.toLowerCase()))), 180);
        signal.addEventListener('abort', () => {
          clearTimeout(timer);
          reject(new DOMException('Aborted', 'AbortError'));
        }, { once: true });
      });
    }
  };
}

export default {
  title: 'Launcher',
  group: 'Navigation',
  blurb: 'A grouped command/search dialog with ZeyOS-compatible ranking, abortable record sources, and application-owned routing.',
  examples: [
    {
      title: 'Applications and asynchronous records',
      blurb: 'Press the button or Cmd/Ctrl+K. Local applications render immediately; record results are abortable and stale responses are ignored.',
      render: ({ cleanup, log }) => {
        const launcher = new Launcher(null, {
          items: APPS,
          sources: [recordSource()],
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
