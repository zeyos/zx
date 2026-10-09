import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { AppSidebar } from '../../src/components/app-sidebar/app-sidebar.js';
import { normalizeAppItems } from '../../src/internal/app-rail.js';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

/**
 * `getItems()` reads nothing but the normalized items, so a prototype probe exercises it without a
 * DOM.
 * @param {unknown[]} items Items as an application passes them.
 * @returns {AppSidebar}
 */
function sidebar(items) {
  const probe = Object.create(AppSidebar.prototype);
  probe._items = normalizeAppItems(items);
  return probe;
}

test('getItems() leaves leaves without the empty children normalization gives them', () => {
  const input = [
    { id: 'home', label: 'Home', href: '#home' },
    {
      id: 'sales', label: 'Sales', children: [
        { id: 'leads', label: 'Leads', href: '#leads' },
        { id: 'deals', label: 'Deals', children: [{ id: 'won', label: 'Won', href: '#won' }] }
      ]
    },
    { id: 'empty', label: 'Empty', href: '#empty', children: [] }
  ];
  const items = sidebar(input).getItems();

  assert.equal(Object.hasOwn(items[0], 'children'), false, 'a leaf has no children property');
  assert.equal(Object.hasOwn(items[2], 'children'), false, 'an empty list is dropped too');
  assert.equal(items[1].children.length, 2);
  assert.equal(Object.hasOwn(items[1].children[0], 'children'), false, 'nested leaves as well');
  assert.equal(items[1].children[1].children[0].id, 'won', 'branches keep their descendants');
});

test('getItems() returns copies the caller can change without touching the sidebar', () => {
  const probe = sidebar([{ id: 'sales', label: 'Sales', children: [{ id: 'leads', label: 'Leads' }] }]);
  const first = probe.getItems();
  first[0].label = 'Changed';
  first[0].children[0].label = 'Changed';
  first[0].children.push({ id: 'extra', label: 'Extra' });
  const second = probe.getItems();
  assert.equal(second[0].label, 'Sales');
  assert.equal(second[0].children[0].label, 'Leads');
  assert.equal(second[0].children.length, 1);
});

test('collapsible: false hides the minimise button over the icon-button display rule', () => {
  const css = read('../../src/components/app-sidebar/app-sidebar.css');
  // `.zx-scope .zx-icon-btn` sets a display, so a single-class [hidden] rule would lose to it.
  assert.match(css, /\.zx-app-sidebar \.zx-app-sidebar__collapse\[hidden\] \{ display: none; \}/);
});

test('a sidebar that creates its own root adds no landmark around its navigation', () => {
  const source = read('../../src/components/app-sidebar/app-sidebar.js');
  assert.match(source, /this\.el \?\? h\('div'\)/);
  assert.doesNotMatch(source, /h\('aside'/, 'an <aside> root is an unnamed complementary landmark');
});
