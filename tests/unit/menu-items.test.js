import test from 'node:test';
import assert from 'node:assert/strict';

import {
  isMenuItem,
  MENU_ITEM_SELECTOR,
  menuItemRole
} from '../../src/internal/menu-items.js';

test('rich menu entry guards preserve legacy items and exclude structural entries', () => {
  assert.equal(isMenuItem({ label: 'Open', value: 'open' }), true);
  assert.equal(isMenuItem({ label: 'Enabled', role: 'menuitemcheckbox', checked: true }), true);
  assert.equal(isMenuItem('-'), false);
  assert.equal(isMenuItem({ type: 'separator' }), false);
  assert.equal(isMenuItem({ type: 'heading', label: 'Administration' }), false);
  assert.equal(isMenuItem(null), false);
});

test('rich menu roles accept only the three APG menu-item roles', () => {
  assert.equal(menuItemRole({ label: 'Open' }), 'menuitem');
  assert.equal(menuItemRole({ label: 'Pinned', role: 'menuitemcheckbox' }), 'menuitemcheckbox');
  assert.equal(menuItemRole({ label: 'Theme', role: 'menuitemradio' }), 'menuitemradio');
  assert.equal(menuItemRole({ label: 'Invalid', role: /** @type {any} */ ('option') }), 'menuitem');
  assert.match(MENU_ITEM_SELECTOR, /menuitemcheckbox/);
  assert.match(MENU_ITEM_SELECTOR, /menuitemradio/);
});
