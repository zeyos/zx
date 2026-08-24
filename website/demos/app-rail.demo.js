import { AppRail, h } from '../../src/index.js';

function railItems() {
  return [
    { id: 'home', label: 'Dashboard', icon: 'list', href: '#home' },
    { id: 'sales', label: 'Sales', icon: 'star', children: [
      { id: 'leads', label: 'Leads', href: '#leads' },
      { id: 'opportunities', label: 'Opportunities', href: '#opportunities' }
    ] },
    { id: 'billing', label: 'Billing', icon: 'file', badge: 3, children: [
      { id: 'invoices', label: 'Invoices', href: '#invoices' },
      { id: 'payments', label: 'Payments', href: '#payments' }
    ] }
  ];
}

export default {
  title: 'AppRail',
  group: 'Application shell',
  blurb: 'The minimized application navigation for vertical or horizontal placement; descendants are always flyouts and never inline.',
  examples: [
    {
      title: 'Vertical rail',
      blurb: 'Hover or focus Sales/Billing to open toward the workspace. Click and keyboard activation remain available, so discovery is never hover-only.',
      render: ({ cleanup, log }) => {
        const rail = new AppRail(null, {
          items: railItems(),
          side: 'left',
          active: 'home',
          onselect: (event) => { event.preventDefault(); log(`select ${event.detail.id}`); }
        });
        cleanup(() => rail.destroy());
        return h('div', { style: 'block-size: 300px; display: flex' }, rail.toElement(),
          h('div', { class: 'demo-card', style: 'flex: 1' }, 'Workspace'));
      }
    },
    {
      title: 'Horizontal rail hover/focus flyouts',
      blurb: 'A top rail opens descendants below itself. Focus uses the same flyout without moving focus automatically; Down Arrow moves into it.',
      render: ({ cleanup, log }) => {
        const rail = new AppRail(null, {
          items: railItems(),
          orientation: 'horizontal',
          side: 'top',
          onselect: (event) => { event.preventDefault(); log(`select ${event.detail.id}`); }
        });
        cleanup(() => rail.destroy());
        return h('div', { style: 'display: grid; gap: var(--zx-space-3)' }, rail.toElement(),
          h('div', { class: 'demo-card' }, 'Horizontal workspace'));
      }
    }
  ]
};
