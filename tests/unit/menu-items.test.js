import test from 'node:test';
import assert from 'node:assert/strict';

import {
  isMenuItem,
  MENU_ITEM_SELECTOR,
  menuItemRole,
  nextCheckedState,
  radioGroupIndices
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

test('choosing a checkable item toggles a checkbox and checks a radio; a plain item has no state', () => {
  assert.equal(nextCheckedState({ label: 'Pinned', role: 'menuitemcheckbox' }, true), false);
  assert.equal(nextCheckedState({ label: 'Pinned', role: 'menuitemcheckbox' }, false), true);
  assert.equal(nextCheckedState({ label: 'Name', role: 'menuitemradio' }, true), true);
  assert.equal(nextCheckedState({ label: 'Date', role: 'menuitemradio' }, false), true);
  assert.equal(nextCheckedState({ label: 'Open' }, false), undefined);
});

test('a radio item\'s group is the radio items of its section, between separators and headings', () => {
  const entries = [
    { label: 'Pinned', role: 'menuitemcheckbox' },
    { type: 'heading', label: 'Sort' },
    { label: 'Name', role: 'menuitemradio' },
    { label: 'Reset', value: 'reset' },
    { label: 'Date', role: 'menuitemradio' },
    '-',
    { label: 'Small', role: 'menuitemradio' },
    { type: 'separator' },
    { label: 'Large', role: 'menuitemradio' }
  ];
  assert.deepEqual(radioGroupIndices(entries, 2), [2, 4]);
  assert.deepEqual(radioGroupIndices(entries, 4), [2, 4]);
  assert.deepEqual(radioGroupIndices(entries, 6), [6]);
  assert.deepEqual(radioGroupIndices(entries, 8), [8]);
  assert.deepEqual(radioGroupIndices(entries, 0), [], 'a checkbox has no group');
  assert.deepEqual(radioGroupIndices(entries, 3), [], 'neither has a plain item');
});
