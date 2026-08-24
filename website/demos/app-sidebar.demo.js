import { AccountMenu, AppSidebar, h, icon } from '../../src/index.js';
import { moduleChip } from '../../src/zeyos/index.js';

const BUILTIN_MODULE_ICONS = {
  accounts: 'folder', billing: 'file', calendar: 'calendar', main: 'heart',
  projects: 'folder-open', tasks: 'check'
};

function moduleVisual(name, size = 24) {
  const chip = moduleChip(name, { size });
  chip.replaceChildren(icon(BUILTIN_MODULE_ICONS[name] ?? 'square', { size: 13 }));
  return chip;
}

function applicationItems() {
  return [
    { id: 'main', module: 'main', label: 'Mindlog', href: '#main' },
    { id: 'accounts', module: 'accounts', label: 'Accounts', badge: 4, children: [
      { id: 'customers', module: 'accounts', label: 'Customers', href: '#customers' },
      { id: 'contacts', module: 'accounts', label: 'Contacts', href: '#contacts', badge: 4 },
      { id: 'suppliers', module: 'accounts', label: 'Suppliers', href: '#suppliers' }
    ] },
    { id: 'billing', module: 'billing', label: 'Billing', children: [
      { id: 'invoices', module: 'billing', label: 'Invoices', href: '#invoices' },
      { id: 'transactions', module: 'billing', label: 'Transactions', href: '#transactions' }
    ] },
    { id: 'calendar', module: 'calendar', label: 'Calendar', href: '#calendar' },
    { id: 'projects', module: 'projects', label: 'Projects', children: [
      { id: 'project-list', module: 'projects', label: 'All projects', href: '#projects' },
      { id: 'tasks', module: 'tasks', label: 'Tasks', href: '#tasks' }
    ] }
  ];
}

function renderModuleIcon(item) {
  return moduleVisual(item.module ?? item.id);
}

export default {
  title: 'AppSidebar',
  group: 'Application shell',
  blurb: 'One application-navigation component with an expanded vertical tree, a minimized '
    + 'vertical rail, and horizontal rail layouts. Only the expanded vertical state reveals '
    + 'children inline; every rail state presents descendants in hover-, focus-, and '
    + 'keyboard-accessible flyouts.',
  examples: [
    {
      title: 'Expanded and minimized vertical states',
      blurb: 'Use the header control to minimize the same component. Its active route and open '
        + 'branch state survive the transition. The module-colored icon renderer is injected by '
        + 'the application, so Zx remains product-agnostic.',
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
      blurb: 'Horizontal navigation is always minimized. Hover or focus Accounts, Billing, or '
        + 'Projects to open its child destinations; Down Arrow moves keyboard focus into a top '
        + 'rail flyout.',
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
