import { AccountMenu, AppSidebar, h } from '../../src/index.js';

function applicationItems() {
  return [
    { id: 'dashboard', label: 'Dashboard', icon: 'list', href: '#dashboard' },
    { id: 'sales', label: 'Sales', icon: 'star', badge: 4, children: [
      { id: 'sales-overview', label: 'Overview', href: '#sales-overview' },
      { id: 'leads', label: 'Leads', href: '#leads', badge: 4 },
      { id: 'opportunities', label: 'Opportunities', href: '#opportunities' }
    ] },
    { id: 'billing', label: 'Billing', icon: 'file', children: [
      { id: 'invoices', label: 'Invoices', href: '#invoices' },
      { id: 'transactions', label: 'Transactions', href: '#transactions' }
    ] },
    { id: 'calendar', label: 'Calendar', icon: 'calendar', href: '#calendar' }
  ];
}

export default {
  title: 'AppSidebar',
  group: 'Application shell',
  blurb: 'Expanded vertical application navigation with inline disclosures, sticky account footer, and a composed AppRail minimized state.',
  examples: [
    {
      title: 'Expanded sidebar and minimized rail',
      blurb: 'Only this expanded vertical presentation reveals children inline. Minimize it with the header control; branch state survives the round trip.',
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
          header: h('strong', {}, 'ZeyOS'),
          footer: account,
          railFooter: compactAccount,
          items: applicationItems(),
          active: 'leads',
          expanded: ['sales'],
          onselect: (event) => { event.preventDefault(); log(`select ${event.detail.id}`); },
          oncollapsechange: ({ detail }) => log(detail.collapsed ? 'minimized' : 'expanded')
        });
        cleanup(() => { sidebar.destroy(); account.destroy(); compactAccount.destroy(); });
        return h('div', { style: 'block-size: 520px; display: flex' }, sidebar.toElement(),
          h('div', { class: 'demo-card', style: 'flex: 1; display: grid; place-items: center' }, 'Application workspace'));
      }
    }
  ]
};
