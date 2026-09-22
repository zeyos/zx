import { AccountMenu, AppSidebar, h } from '../../src/index.js';
import { moduleChip } from '../../src/zeyos/index.js';

const BUILTIN_MODULE_ICONS = {
  accounts: 'folder', billing: 'file', calendar: 'calendar', documents: 'file',
  main: 'heart', projects: 'folder-open', tasks: 'check'
};

function moduleVisual(name, size = 24, shape = 'tile') {
  return moduleChip(name, {
    size,
    shape,
    icon: BUILTIN_MODULE_ICONS[name] ?? 'square'
  });
}

// A navigation tree sized like a real one: counts on several destinations, a three-digit count
// that cannot fit a rail target, a label long enough to need a second line in a 280px sidebar,
// and one branch three levels deep. Those are the cases a nav has to survive rather than edge
// cases to design around — the third level indents inline when the sidebar is expanded and opens
// a second flyout beside the first when it is minimized.
function applicationItems() {
  return [
    { id: 'main', module: 'main', label: 'Mindlog', href: '#main' },
    { id: 'accounts', module: 'accounts', label: 'Accounts', badge: 4, children: [
      { id: 'customers', module: 'accounts', label: 'Customers', href: '#customers' },
      { id: 'contacts', module: 'accounts', label: 'Contacts', href: '#contacts', badge: 4 },
      { id: 'suppliers', module: 'accounts', label: 'Suppliers', href: '#suppliers' }
    ] },
    { id: 'billing', module: 'billing', label: 'Belege & Rechnungen', badge: 128, children: [
      { id: 'invoices', module: 'billing', label: 'Rechnungsausgang', href: '#invoices', badge: 12 },
      { id: 'transactions', module: 'billing', label: 'Transaktionen', href: '#transactions' }
    ] },
    { id: 'calendar', module: 'calendar', label: 'Calendar', href: '#calendar', badge: 2 },
    { id: 'documents', module: 'documents', label: 'Dokumentenverwaltung', href: '#documents' },
    { id: 'projects', module: 'projects', label: 'Projects', children: [
      { id: 'project-list', module: 'projects', label: 'All projects', href: '#projects' },
      { id: 'tasks', module: 'tasks', label: 'Tasks', badge: 9, children: [
        { id: 'tasks-mine', module: 'tasks', label: 'My tasks', href: '#tasks-mine', badge: 5 },
        { id: 'tasks-team', module: 'tasks', label: 'Team tasks', href: '#tasks-team', badge: 4 },
        { id: 'tasks-archive', module: 'tasks', label: 'Archive', href: '#tasks-archive' }
      ] }
    ] }
  ];
}

function renderModuleIcon(item, context = {}) {
  return moduleVisual(item.module ?? item.id, 24, context.location === 'root' ? 'circle' : 'tile');
}

export default {
  title: 'AppSidebar',
  group: 'Layout',
  blurb: 'One application-navigation component with an expanded vertical tree, a minimized '
    + 'vertical rail, and horizontal rail layouts. Only the expanded vertical state reveals '
    + 'children inline; every rail state presents descendants in hover-, focus-, and '
    + 'keyboard-accessible flyouts.',
  examples: [
    {
      title: 'Expanded and minimized vertical states',
      blurb: 'Use the header control to minimize the same component. Its active route and open '
        + 'branch state survive the transition. The module-colored icon renderer is injected by '
        + 'the application, so Zx remains product-agnostic. The active route is a filled pill '
        + 'with a marker docked to the sidebar edge, labels wrap to a second line instead of '
        + 'truncating, and a count that cannot fit a minimized target becomes a dot while the '
        + 'number stays in the item’s accessible name. The rail presents those same rows in a '
        + 'flyout — same icon gutter, same pill, same marker — so minimizing changes the width '
        + 'and not the vocabulary.',
      render: ({ cleanup, log }) => {
        const account = new AccountMenu(null, {
          account: { name: 'Ada Lovelace', secondary: 'ada@example.test' },
          items: [{ label: 'Settings', value: 'settings' }, '-', { label: 'Sign out', value: 'logout', danger: true }],
          placement: 'right-end'
        });
        const compactAccount = new AccountMenu(null, {
          compact: true,
          account: { name: 'Ada Lovelace', secondary: 'ada@example.test' },
          items: [{ label: 'Settings', value: 'settings' }, '-', { label: 'Sign out', value: 'logout', danger: true }],
          placement: 'right-end'
        });
        const sidebar = new AppSidebar(null, {
          header: h('strong', {}, 'Applications'),
          footer: account,
          railFooter: compactAccount,
          items: applicationItems(),
          active: 'contacts',
          expanded: ['accounts'],
          renderIcon: renderModuleIcon,
          onselect: (event) => { event.preventDefault(); log(`select ${event.detail.id}`); },
          oncollapsechange: ({ detail }) => log(detail.collapsed ? 'minimized' : 'expanded')
        });
        cleanup(() => { sidebar.destroy(); account.destroy(); compactAccount.destroy(); });
        return h('div', { style: 'block-size: 520px; display: flex' }, sidebar.toElement(),
          h('div', { class: 'demo-card', style: 'flex: 1; display: grid; place-items: center' }, 'Application workspace'));
      }
    },
    {
      title: 'Horizontal rail with descendant flyouts',
      blurb: 'Horizontal navigation is always minimized. Hover or focus Accounts, Belege & '
        + 'Rechnungen, or Projects to open its child destinations; Down Arrow moves keyboard '
        + 'focus into a top rail flyout. Projects › Tasks carries a third level, which opens a '
        + 'second flyout beside the first — Right Arrow moves into it, Left Arrow or Escape back '
        + 'out. The active marker follows the edge the rail occupies, so it runs under the item '
        + 'here and beside it on a vertical rail.',
      render: ({ cleanup, log }) => {
        const sidebar = new AppSidebar(null, {
          items: applicationItems(),
          orientation: 'horizontal',
          side: 'top',
          active: 'calendar',
          renderIcon: renderModuleIcon,
          onselect: (event) => { event.preventDefault(); log(`select ${event.detail.id}`); }
        });
        cleanup(() => sidebar.destroy());
        return h('div', { style: 'display: grid; gap: var(--zx-space-3)' }, sidebar.toElement(),
          h('div', { class: 'demo-card', style: 'min-block-size: 180px' }, 'Horizontal workspace'));
      }
    }
  ]
};
