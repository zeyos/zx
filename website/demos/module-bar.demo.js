import { AccountMenu, ModuleBar, button, h } from '../../src/index.js';
import { buildZeyosModuleBarConfig } from '../../src/zeyos/index.js';
import { demoZeyosGlyph } from '../zeyos-demo-icons.js';
// The outline set the layout gallery uses, registered under Font Awesome names (envelope, building…).
import '../layouts/layout-icons.js';

// A suite's modules: each with an icon, an identity tone, and — for the modules that have one —
// the menu that opens beside its tile. A module without children is a destination of its own.
function suiteModules() {
  return [
    { id: 'home', label: 'Home', icon: 'house', tone: 'slate', href: '#home' },
    { id: 'mail', label: 'Mail', icon: 'envelope', tone: 'blue', badge: 7, children: [
      { id: 'inbox', label: 'Inbox', href: '#inbox', badge: 7 },
      { id: 'sent', label: 'Sent', href: '#sent' },
      { id: 'drafts', label: 'Drafts', href: '#drafts', badge: 2 }
    ] },
    { id: 'crm', label: 'Customers', icon: 'building', tone: 'pink', children: [
      { id: 'companies', label: 'Companies', href: '#companies' },
      { id: 'people', label: 'People', href: '#people' },
      { id: 'deals', label: 'Deals', href: '#deals' }
    ] },
    { id: 'billing', label: 'Billing', icon: 'file-invoice', tone: 'violet', children: [
      { id: 'invoices', label: 'Invoices', href: '#invoices', badge: 3 },
      { id: 'payments', label: 'Payments', href: '#payments' }
    ] },
    { id: 'inventory', label: 'Inventory', icon: 'box', tone: 'teal', href: '#inventory' },
    { id: 'projects', label: 'Projects', icon: 'list-check', tone: 'orange', badge: 12, href: '#projects' },
    { id: 'calendar', label: 'Calendar', icon: 'calendar-days', tone: 'red', href: '#calendar' },
    { id: 'wiki', label: 'Knowledge base', icon: 'book-open', tone: 'green', href: '#wiki' }
  ];
}

// The classic arrangement: many modules in one row, each in its own identity colour, grouped for
// the "All modules" catalogue. A host colour (any CSS colour) wins over a tone.
function classicModules() {
  return [
    { id: 'messages', label: 'Messages', icon: 'envelope', color: '#31a8e0', badge: 7, group: 'Communication' },
    { id: 'tasks', label: 'Tasks', icon: 'list-check', color: '#e2b301', group: 'Work' },
    { id: 'actionsteps', label: 'Action steps', icon: 'clock', color: '#f67f00', group: 'Work' },
    { id: 'billing', label: 'Billing', icon: 'file-invoice', color: '#535494', group: 'Finance' },
    { id: 'procurement', label: 'Procurement', icon: 'truck', color: '#006e9f', group: 'Finance' },
    { id: 'payments', label: 'Payments', icon: 'credit-card', color: '#4679c8', group: 'Finance' },
    { id: 'contacts', label: 'Contacts', icon: 'users', color: '#8c6641', group: 'Customers' },
    { id: 'accounts', label: 'Accounts', icon: 'building', color: '#bc3885', group: 'Customers' },
    { id: 'opportunities', label: 'Opportunities', icon: 'handshake', color: '#7b67ae', group: 'Customers' },
    { id: 'calendar', label: 'Calendar', icon: 'calendar-days', color: '#bd1e32', badge: 21, group: 'Communication' },
    { id: 'inventory', label: 'Inventory', icon: 'warehouse', color: '#064e4f', group: 'Logistics' },
    { id: 'documents', label: 'Documents', icon: 'file', color: '#808000', group: 'Work' },
    { id: 'projects', label: 'Projects', icon: 'diagram-project', color: '#db532d', group: 'Work' },
    { id: 'devices', label: 'Devices', icon: 'server', color: '#064e4f', group: 'Logistics' }
  ].map((module) => ({ ...module, href: `#${module.id}` }));
}

// ZeyOS shell state, as the launcher reads it: the permitted modules, the pinned ones in order,
// each module's menu, and live counts. Colours and icons come from the module registry.
function zeyosShellState() {
  return {
    modules: ['messages', 'tasks', 'actionsteps', 'billing', 'procurement', 'payments', 'contacts',
      'accounts', 'opportunities', 'calendar', 'inventory', 'documents', 'projects', 'tickets', 'notes'],
    pinned: ['messages', 'tasks', 'actionsteps', 'billing', 'contacts', 'calendar', 'tickets'],
    activeIdentifier: 'tickets',
    badges: { messages: 7, calendar: 21 },
    menus: {
      tickets: [
        { id: 'tickets-mine', label: 'My tickets', badge: 3 },
        { id: 'tickets-open', label: 'Open tickets' },
        { section: true, label: 'Saved views', children: [{ id: 'tickets-escalated', label: 'Escalated' }] }
      ]
    },
    resolveApplication: (app) => ({ href: `#${Array.isArray(app) ? app[0] : app.identifier}` })
  };
}

const ACCOUNT = { name: 'Ada Lovelace', secondary: 'ada@example.test' };

export default {
  title: 'ModuleBar',
  group: 'Layout',
  api: ['ModuleBar'],
  blurb: 'The module level of an application: one colour-coded tile per module in a vertical '
    + 'strip or a horizontal bar. Modules with a menu open it beside the tile; modules that do '
    + 'not fit, or are not pinned, are one step away under All modules. The bar is a single Tab '
    + 'stop — arrow keys, Home, End, and type-ahead move between modules.',
  examples: [
    {
      title: 'A vertical strip with menus and live counts',
      blurb: 'Tint draws each glyph in its module’s tone on a soft fill of it; the current '
        + 'module takes the neutral current fill behind its tile. Hover or focus Mail, Customers, '
        + 'or Billing to open its menu; the arrow toward the workspace moves focus into it. '
        + 'setBadge() changes a count in place — on the tile, in the menu, and in its accessible '
        + 'name. Make the frame shorter than the modules and the rest move under All modules, '
        + 'while the current module stays on the bar.',
      render: ({ cleanup, log }) => {
        const account = new AccountMenu(null, { compact: true, account: ACCOUNT, placement: 'top-start',
          items: [{ label: 'Settings', value: 'settings' }, '-', { label: 'Sign out', value: 'logout', danger: true }] });
        const bar = new ModuleBar(null, {
          items: suiteModules(),
          active: 'companies',
          header: h('span', {
            ariaHidden: 'true',
            style: 'display: grid; place-items: center; inline-size: var(--zx-control-height); block-size: var(--zx-control-height); border-radius: var(--zx-radius-lg); background: var(--zx-color-text); color: var(--zx-color-bg-surface); font-weight: var(--zx-weight-semibold)'
          }, 'A'),
          footer: account,
          onselect: (event) => { event.preventDefault(); log(`select ${event.detail.id}`); },
          onoverflowchange: ({ detail }) => log(`under All modules: ${detail.overflow.join(', ') || 'none'}`)
        });
        let unread = 7;
        const more = button({ label: 'New mail' });
        more.addEventListener('click', () => bar.setBadge('mail', ++unread).setBadge('inbox', unread));
        cleanup(() => { bar.destroy(); account.destroy(); });
        return h('div', { style: 'display: flex; inline-size: 100%; block-size: 380px; resize: vertical; overflow: hidden; min-block-size: 200px' },
          bar.toElement(),
          h('div', { class: 'demo-card', style: 'flex: 1; display: grid; place-items: center' }, more));
      }
    },
    {
      title: 'The classic horizontal bar',
      blurb: 'appearance: ’solid’ is the identity tile with the white glyph, as module '
        + 'bars in ERP suites traditionally draw it; colour comes from the host, as hex. The bar '
        + 'fills the width it is given: narrow the window and the modules that no longer fit are '
        + 'listed, grouped and filterable, under All modules.',
      render: ({ cleanup, log }) => {
        const bar = new ModuleBar(null, {
          items: classicModules(),
          orientation: 'horizontal',
          side: 'top',
          appearance: 'solid',
          active: 'billing',
          onselect: (event) => { event.preventDefault(); log(`select ${event.detail.id}`); },
          onallmodules: ({ detail }) => log(detail.open ? 'All modules opened' : 'All modules closed')
        });
        cleanup(() => bar.destroy());
        return h('div', { class: 'demo-card', style: 'inline-size: 100%; padding: 0; overflow: hidden' }, bar.toElement());
      }
    },
    {
      id: 'zeyos-module-bar',
      title: 'buildZeyosModuleBarConfig()',
      preset: true,
      blurb: 'The ZeyOS binding builds the bar from the same shell state the launcher reads: '
        + 'permitted modules (canUseModule), pins, each module\u2019s menu, and badges. Every '
        + 'module takes its registry colour — or the one a menu payload brings, through '
        + 'registerModules() — and the solid appearance. With the ZeyOS icon kit loaded the '
        + 'kit glyphs render; this offline page passes built-in ones through renderApplicationIcon.',
      render: ({ cleanup, log }) => {
        const state = { ...zeyosShellState(), renderApplicationIcon: (app, normalized) => demoZeyosGlyph(normalized.module) };
        const bar = new ModuleBar(null, buildZeyosModuleBarConfig(state, {
          orientation: 'horizontal',
          side: 'top',
          onselect: (event) => { event.preventDefault(); log(`select ${event.detail.id}`); }
        }));
        cleanup(() => bar.destroy());
        return h('div', { class: 'demo-card', style: 'inline-size: 100%; padding: 0; overflow: hidden' }, bar.toElement());
      }
    },
    {
      title: 'Names beside or under the tiles, or no colour at all',
      blurb: 'labels: ’beside’ turns a vertical strip into a navigation column of its own, a row '
        + 'per module with its count at the end; setLabels() switches between it and the icon '
        + 'strip, which is how a column expands and collapses. labels: ’below’ prints each name '
        + 'under its tile, for an audience that does not know the icons yet; tooltips are then '
        + 'dropped as redundant. appearance: ’plain’ draws monochrome glyphs.',
      layout: 'stack',
      render: ({ cleanup, log }) => {
        const options = (extra) => ({
          items: suiteModules().slice(0, 6),
          active: 'inventory',
          onselect: (event) => { event.preventDefault(); log(`select ${event.detail.id}`); },
          ...extra
        });
        const column = new ModuleBar(null, options({ labels: 'beside', label: 'Modules with names beside' }));
        const labelled = new ModuleBar(null, options({ labels: 'below', label: 'Modules with names' }));
        const plain = new ModuleBar(null, options({ appearance: 'plain', label: 'Plain modules' }));
        const toggle = button({ label: 'Collapse', size: 'sm' });
        toggle.addEventListener('click', () => {
          const named = column.el.dataset.labels !== 'beside';
          column.setLabels(named ? 'beside' : 'hidden');
          toggle.querySelector('.zx-btn__label').textContent = named ? 'Collapse' : 'Expand';
          log(named ? 'names beside' : 'icons only');
        });
        cleanup(() => { column.destroy(); labelled.destroy(); plain.destroy(); });
        return h('div', { style: 'display: grid; gap: var(--zx-space-3)' },
          h('div', {}, toggle),
          h('div', { style: 'display: flex; gap: var(--zx-space-4); block-size: 420px' },
            column.toElement(), labelled.toElement(), plain.toElement()));
      }
    },
    {
      title: 'Driving a panel of your own',
      blurb: 'menus: ’none’ leaves module menus to an adjacent panel. Every module then '
        + 'emits select, and setExpanded() marks the module whose menu the panel shows; its tile '
        + 'reports aria-expanded and controls the panel named by controls. AppSidebar’s modules '
        + 'layout is built this way.',
      render: ({ cleanup, log }) => {
        const items = suiteModules();
        // The panel the bar controls; any unique id will do.
        const panel = h('div', { id: `module-panel-${crypto.randomUUID()}`, class: 'demo-card', style: 'flex: 1' });
        const show = (module) => {
          panel.replaceChildren(h('strong', {}, module.label),
            h('ul', {}, (module.children ?? []).map((child) => h('li', {}, child.label))));
        };
        const bar = new ModuleBar(null, {
          items,
          menus: 'none',
          controls: panel.id,
          expanded: 'mail',
          active: 'inbox',
          onselect: (event) => {
            event.preventDefault();
            const module = items.find((item) => item.id === event.detail.id);
            if (module?.children) { bar.setExpanded(module.id); show(module); }
            log(`select ${event.detail.id}`);
          }
        });
        show(items[1]);
        cleanup(() => bar.destroy());
        return h('div', { style: 'display: flex; inline-size: 100%; gap: var(--zx-space-3); block-size: 380px' }, bar.toElement(), panel);
      }
    }
  ]
};
