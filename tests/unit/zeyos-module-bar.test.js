import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildZeyosAppSidebarConfig, buildZeyosModuleBarConfig, zeyosModuleItems
} from '../../src/zeyos/module-bar.js';
import { moduleInfo, registerModules } from '../../src/zeyos/modules.js';

const byId = (items) => Object.fromEntries(items.map((item) => [item.id, item]));

test('modules carry their registry colour and kit icon, and a menu makes a panel module', () => {
  const items = zeyosModuleItems({
    modules: { tickets: 'Tickets', invoices: 'Invoices', notes: 'Notes' },
    menus: {
      tickets: [
        { id: 'tickets-mine', label: 'My tickets', href: '#tickets/mine' },
        ['tickets-all', 'All tickets', '#tickets']
      ]
    },
    resolveApplication: (app) => (Array.isArray(app) ? { href: `#${app[0]}` } : null)
  });
  const modules = byId(items);
  assert.deepEqual(items.map((item) => item.id), ['tickets', 'invoices', 'notes']);
  assert.equal(modules.tickets.color, moduleInfo('tickets').color);
  // `invoices` is an alias: the colour is the billing transactions module's.
  assert.equal(modules.invoices.color, moduleInfo('transactions-billing').color);
  assert.equal(typeof modules.tickets.icon, 'function');
  assert.deepEqual(modules.tickets.children.map((entry) => entry.id), ['tickets-mine', 'tickets-all']);
  assert.equal(modules.tickets.children[1].href, '#tickets');
  // A module with a menu is not itself a destination.
  assert.equal(modules.tickets.href, undefined);
  assert.equal(modules.notes.href, '#notes');
});

test('permissions filter modules, pins order the bar, and forks and weblets get their own group', () => {
  const items = zeyosModuleItems({
    modules: ['tasks', 'billing', 'admin'],
    menuApps: [[17, 'Field service', 'tickets', 'ff8800'], [4, 'Portal', '', '', '', '', '', '', '336699']],
    canUseModule: (module) => module !== 'admin',
    pinned: ['billing', 'fork#17'],
    labels: { weblets: 'Extensions' }
  });
  const modules = byId(items);
  assert.equal(modules.admin, undefined, 'a forbidden module is left out');
  assert.equal(modules.billing.pinned, 0);
  assert.equal(modules['fork#17'].pinned, 1);
  assert.equal(modules.tasks.pinned, false);
  assert.equal(modules['fork#17'].group, 'Forks');
  assert.equal(modules['fork#17'].color, '#ff8800', 'the payload colour wins over the registry');
  assert.equal(modules['weblet#4'].group, 'Extensions');
});

test('registered colours reach the bar', () => {
  registerModules({ projects: '#123456' });
  const [projects] = zeyosModuleItems({ modules: ['projects'] });
  assert.equal(projects.color, '#123456');
});

test('menu entries: sections, nesting, badges by id, and nothing unsafe', () => {
  const [module] = zeyosModuleItems({
    modules: ['tickets'],
    badges: { tickets: 4, 'tickets-open': 4 },
    menus: {
      tickets: [
        { section: true, label: 'Views', children: [
          { id: 'tickets-open', label: 'Open' },
          { id: 'tickets-closed', label: 'Closed', children: [{ id: 'tickets-closed-week', label: 'This week', href: '#w' }] }
        ] },
        { id: 'tickets-bad', label: 'Script', href: 'javascript:alert(1)' },
        { label: 'No id' },
        { section: true, label: 'Empty section', children: [] },
        null,
        ['only-an-id']
      ]
    }
  });
  assert.equal(module.badge, 4);
  const [views, bad] = module.children;
  assert.equal(views.section, true);
  assert.equal(views.children[0].badge, 4);
  assert.equal(views.children[1].children[0].href, '#w');
  assert.equal(bad.href, undefined, 'an executable href is dropped');
  assert.equal(bad.disabled, true, 'and the entry disabled');
  assert.equal(module.children.length, 2);
});

test('the builders produce solid ModuleBar and modules-layout AppSidebar options', () => {
  const state = { modules: ['tasks', 'notes'], activeIdentifier: 'notes' };
  const bar = buildZeyosModuleBarConfig(state, { allModules: 'always' });
  assert.equal(bar.appearance, 'solid');
  assert.equal(bar.active, 'notes');
  assert.equal(bar.allModules, 'always');
  assert.equal(bar.items.length, 2);
  const sidebar = buildZeyosAppSidebarConfig({ ...state, active: 'notes-mine' }, { appearance: 'tint', collapsed: true });
  assert.equal(sidebar.layout, 'modules');
  assert.equal(sidebar.active, 'notes-mine');
  assert.equal(sidebar.collapsed, true);
  assert.deepEqual(sidebar.moduleBar, { appearance: 'tint' });
});
