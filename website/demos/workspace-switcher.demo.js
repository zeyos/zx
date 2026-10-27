import { AppSidebar, WorkspaceSwitcher, h } from '../../src/index.js';
// The outline set the layout gallery uses, registered under Font Awesome names (envelope, building…).
import '../layouts/layout-icons.js';

// The workspaces a user belongs to. The tile is the image, else the icon, else the initial, on the
// tone — derived from the name when neither tone nor color is given.
const WORKSPACES = [
  { id: 'northwind', label: 'Northwind Trading', secondary: 'Business plan · 48 members', tone: 'blue' },
  { id: 'acme', label: 'Acme Labs', secondary: 'Member', tone: 'violet', badge: 3 },
  { id: 'studio', label: 'Personal studio', secondary: 'Free plan', icon: 'heart', tone: 'green' },
  { id: 'legacy', label: 'Legacy GmbH', secondary: 'Access suspended', disabled: true }
];

// The application's own actions, listed after the workspaces; the separator between the two
// groups is added by the switcher.
const ACTIONS = [
  { label: 'Create workspace', icon: 'plus', value: 'create' },
  { label: 'Workspace settings', icon: 'gear', value: 'settings' },
  '-',
  { label: 'Sign out', icon: 'lock', value: 'signout', danger: true }
];

// The modules a modules-layout sidebar lists under the switcher.
const MODULES = [
  { id: 'home', label: 'Home', icon: 'house', tone: 'slate', href: '#home' },
  { id: 'mail', label: 'Mail', icon: 'envelope', tone: 'blue', badge: 7, children: [
    { id: 'inbox', label: 'Inbox', icon: 'inbox', href: '#inbox', badge: 7 },
    { id: 'sent', label: 'Sent', icon: 'paper-plane', href: '#sent' }
  ] },
  { id: 'crm', label: 'Customers', icon: 'building', tone: 'pink', children: [
    { id: 'companies', label: 'Companies', icon: 'building', href: '#companies' },
    { id: 'people', label: 'People', icon: 'users', href: '#people' }
  ] },
  { id: 'inventory', label: 'Inventory', icon: 'box', tone: 'teal', href: '#inventory' }
];

export default {
  title: 'Workspace switcher',
  group: 'Layout',
  blurb: 'The current workspace at the head of a navigation column — tile, name, and secondary line — '
    + 'opening a menu of the workspaces with the current one checked, then the application’s own '
    + 'actions. Which workspaces a user sees, and what switching does, stay application-owned.',
  examples: [
    {
      title: 'Workspaces and actions',
      blurb: 'select is cancelable: preventDefault() keeps the previous workspace active. The extra '
        + 'items emit action. A disabled workspace is listed but cannot be chosen.',
      width: '300px',
      render: ({ cleanup, log }) => {
        const switcher = new WorkspaceSwitcher(null, {
          workspaces: WORKSPACES,
          active: 'northwind',
          items: ACTIONS,
          onselect: ({ detail }) => log(`select ${detail.id} (was ${detail.previous?.id})`),
          onaction: ({ detail }) => log(`action ${detail.value}`)
        });
        cleanup(() => switcher.destroy());
        return switcher.toElement();
      }
    },
    {
      title: 'Compact',
      blurb: 'The tile alone, for a column of icons. The trigger keeps its full accessible name and '
        + 'shows the workspace name as a tooltip.',
      render: ({ cleanup }) => {
        const switcher = new WorkspaceSwitcher(null, {
          workspaces: WORKSPACES,
          active: 'acme',
          items: ACTIONS,
          compact: true
        });
        cleanup(() => switcher.destroy());
        return h('div', { style: 'padding: var(--zx-space-2)' }, switcher.toElement());
      }
    },
    {
      title: 'At the head of a modules sidebar',
      blurb: 'As an AppSidebar railHeader in place of a brand: full width while the modules are '
        + 'named, the tile alone on the icon strip — setCompact() follows presentationchange. Use '
        + 'the switch at the foot of the strip to change the presentation.',
      render: ({ cleanup, log }) => {
        const switcher = new WorkspaceSwitcher(null, {
          workspaces: WORKSPACES,
          items: ACTIONS,
          heading: 'Switch workspace',
          onselect: ({ detail }) => log(`select ${detail.id}`),
          onaction: ({ detail }) => log(`action ${detail.value}`)
        });
        const sidebar = new AppSidebar(null, {
          layout: 'modules',
          label: 'Northwind Trading',
          items: MODULES,
          active: 'companies',
          railHeader: switcher,
          onselect: (event) => { event.preventDefault(); sidebar.setActive(event.detail.id); },
          onpresentationchange: ({ detail }) => switcher.setCompact(detail.presentation !== 'expanded')
        });
        switcher.setCompact(sidebar.getPresentation() !== 'expanded');
        cleanup(() => { sidebar.destroy(); switcher.destroy(); });
        return h('div', { style: 'display: flex; inline-size: 100%; block-size: 420px' }, sidebar.toElement(),
          h('div', { class: 'demo-card', style: 'flex: 1; display: grid; place-items: center' }, 'Application workspace'));
      }
    }
  ]
};
