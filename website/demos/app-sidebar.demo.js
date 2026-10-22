import { AccountMenu, AppSidebar, button, h } from '../../src/index.js';
import { moduleChip } from '../../src/zeyos/index.js';
// The outline set the layout gallery uses, registered under Font Awesome names (envelope, building…).
import '../layouts/layout-icons.js';

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

// A settings column: a short tree the page lays out itself, so it never minimizes.
function settingsItems() {
  return [
    { id: 'profile', label: 'Profile', icon: 'eye', href: '#profile' },
    { id: 'security', label: 'Security', icon: 'lock', href: '#security' },
    { id: 'workspace', label: 'Workspace', icon: 'gear', children: [
      { id: 'members', label: 'Members', href: '#members' },
      { id: 'billing-settings', label: 'Billing', href: '#billing-settings' }
    ] }
  ];
}

// The modules layout: the top level is the modules, each with a tone and its own menu, under the
// headings that group them. Sections group a menu without nesting it; a module's header and
// content are its own panel content.
function suiteModules({ compose, history }) {
  return [
    { id: 'home', label: 'Home', icon: 'house', tone: 'slate', href: '#home' },
    { section: true, label: 'Communication', children: [
      { id: 'mail', label: 'Mail', icon: 'envelope', tone: 'blue', badge: 7, header: compose, children: [
        { id: 'inbox', label: 'Inbox', icon: 'inbox', href: '#inbox', badge: 7 },
        { id: 'sent', label: 'Sent', icon: 'paper-plane', href: '#sent' },
        { section: true, label: 'Labels', children: [
          { id: 'label-clients', label: 'Clients', href: '#clients' },
          { id: 'label-billing', label: 'Billing', href: '#label-billing' }
        ] }
      ] },
      { id: 'assistant', label: 'Assistant', icon: 'robot', tone: 'violet', content: history }
    ] },
    { section: true, label: 'Business', children: [
      { id: 'crm', label: 'Customers', icon: 'building', tone: 'pink', children: [
        { id: 'notifications', label: 'Notifications', icon: 'bell', href: '#notifications', badge: 3 },
        { section: true, label: 'Records', children: [
          { id: 'companies', label: 'Companies', icon: 'building', href: '#companies' },
          { id: 'people', label: 'People', icon: 'users', href: '#people' },
          { id: 'deals', label: 'Deals', icon: 'handshake', href: '#deals' }
        ] },
        { section: true, label: 'Lists', children: [
          { id: 'pipeline', label: 'Enterprise pipeline', href: '#pipeline' },
          { id: 'renewals', label: 'Renewals Q4', href: '#renewals' }
        ] }
      ] },
      { id: 'inventory', label: 'Inventory', icon: 'box', tone: 'teal', href: '#inventory' }
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
      title: 'Modules layout',
      blurb: 'layout: \u2019modules\u2019 draws the top level as a ModuleBar beside a panel with one '
        + 'module\u2019s menu. Choosing a module shows its menu (a preventable modulechange); a module '
        + 'without a panel is a destination. The arrow toward the panel moves into the menu, and '
        + 'Left Arrow on a top-level row comes back to the module. Sections group a menu without '
        + 'nesting it, and sections of modules head them on the strip. Three presentations — both '
        + 'menus expanded, the module menu collapsed to icons beside the side menu, and both '
        + 'collapsed, where each menu opens beside its module — are chosen with a three-way switch '
        + 'at the foot of the strip, or, as here, in the account menu: presentationSwitch: false '
        + 'takes it off the strip and presentationChoice() hands it to the menu as a choice row. The account follows: name and role while the modules are '
        + 'named, the avatar alone on icons.',
      render: ({ cleanup, log }) => {
        const compose = button({ label: 'Compose', kind: 'primary' });
        const history = h('ol', { style: 'margin: 0; padding-inline: var(--zx-space-3); display: grid; gap: var(--zx-space-2); color: var(--zx-color-text-muted)' },
          ['Quarterly report outline', 'Supplier email draft', 'Onboarding checklist'].map((title) => h('li', {}, title)));
        const account = new AccountMenu(null, {
          account: { name: 'Ada Lovelace', secondary: 'ada@example.test' },
          items: [{ label: 'Settings', value: 'settings' }, '-', { label: 'Sign out', value: 'logout', danger: true }],
          placement: 'top-start'
        });
        const sidebar = new AppSidebar(null, {
          layout: 'modules',
          label: 'ACME',
          items: suiteModules({ compose, history }),
          active: 'companies',
          railFooter: account,
          presentationSwitch: false,
          onselect: (event) => { event.preventDefault(); log(`select ${event.detail.id}`); sidebar.setActive(event.detail.id); },
          onmodulechange: ({ detail }) => log(`module ${detail.id}`),
          onpresentationchange: ({ detail }) => {
            account.setCompact(detail.presentation !== 'expanded');
            account.setItems(accountItems());
            log(`presentation ${detail.presentation}`);
          }
        });
        // The layout choice, read fresh each time, ahead of the account's own actions. Choosing
        // a layout closes the menu: the strip it sits on is redrawn.
        const accountItems = () => [
          { ...sidebar.presentationChoice({ label: 'Layout' }), onselect: (value, entry, menu) => { menu.close(); sidebar.setPresentation(value); } },
          '-',
          { label: 'Settings', value: 'settings' },
          { label: 'Sign out', value: 'logout', danger: true }
        ];
        account.setItems(accountItems());
        cleanup(() => { sidebar.destroy(); account.destroy(); });
        return h('div', { style: 'display: flex; inline-size: 100%; block-size: 460px' }, sidebar.toElement(),
          h('div', { class: 'demo-card', style: 'flex: 1; display: grid; place-items: center' }, 'Application workspace'));
      }
    },
    {
      title: 'Expanded and minimized vertical states',
      blurb: 'Use the header control to minimize the same component. Its active route and open '
        + 'branch state survive the transition. The module-colored icon renderer is injected by '
        + 'the application, so Zx remains product-agnostic. The active route is a neutral fill '
        + 'with a heavier label — where you are, not something you picked — labels wrap to a second line instead of '
        + 'truncating, and a count that cannot fit a minimized target becomes a dot while the '
        + 'number stays in the item’s accessible name. The rail presents those same rows in a '
        + 'flyout — same icon gutter, same fill — so minimizing changes the width '
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
        + 'out. A rail item whose flyout holds the active route takes the full text colour.',
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
    },
    {
      title: 'A column that does not minimize',
      blurb: 'collapsible: false removes the minimize control, for a navigation column the page '
        + 'lays out itself. getItems() hands the tree back as it was written: a destination '
        + 'without descendants has no children property.',
      layout: 'stack',
      render: ({ cleanup, log }) => {
        const sidebar = new AppSidebar(null, {
          label: 'Settings',
          header: h('strong', {}, 'Settings'),
          collapsible: false,
          items: settingsItems(),
          active: 'profile',
          expanded: ['workspace'],
          onselect: (event) => { event.preventDefault(); log(`select ${event.detail.id}`); }
        });
        cleanup(() => sidebar.destroy());
        const branches = sidebar.getItems().filter((item) => item.children).map((item) => item.id);
        log(`items with children: ${branches.join(', ')}`);
        return h('div', { style: 'block-size: 320px; display: flex' }, sidebar.toElement(),
          h('div', { class: 'demo-card', style: 'flex: 1; display: grid; place-items: center' }, 'Settings page'));
      }
    }
  ]
};
