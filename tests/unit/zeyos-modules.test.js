import assert from 'node:assert/strict';
import test from 'node:test';

import {
  moduleAliases, moduleColor, moduleGlyphColor, moduleIconName, moduleInfo, moduleKeys,
  normalizeModuleName, registerModules, zeyosModules
} from '../../src/zeyos/modules.js';
import { readModuleTokens, renderModuleTokens } from '../../tools/build-module-tokens.js';

/** The custom icons uploaded to the ZeyOS Font Awesome kit, as the kit itself reports them. */
const kitIcons = [
  'zeyos', 'zeyos-accounts', 'zeyos-actionsteps', 'zeyos-admin', 'zeyos-applications',
  'zeyos-appointments', 'zeyos-auth', 'zeyos-billing', 'zeyos-calendar', 'zeyos-campaigns',
  'zeyos-categories', 'zeyos-channels', 'zeyos-collection', 'zeyos-contacts', 'zeyos-contracts',
  'zeyos-control', 'zeyos-coupons', 'zeyos-davservers', 'zeyos-default', 'zeyos-dev',
  'zeyos-devices', 'zeyos-documents', 'zeyos-dunning', 'zeyos-error', 'zeyos-events',
  'zeyos-global', 'zeyos-groups', 'zeyos-inventory', 'zeyos-items', 'zeyos-ledgers', 'zeyos-line',
  'zeyos-links', 'zeyos-logout', 'zeyos-mailinglists', 'zeyos-messages', 'zeyos-messages-unread',
  'zeyos-notes', 'zeyos-objects', 'zeyos-opportunities', 'zeyos-participants', 'zeyos-payments',
  'zeyos-permissions', 'zeyos-pricelists', 'zeyos-procurement', 'zeyos-production',
  'zeyos-projects', 'zeyos-records', 'zeyos-resources', 'zeyos-services',
  'zeyos-stocktransactions', 'zeyos-storages', 'zeyos-system', 'zeyos-tasks', 'zeyos-text',
  'zeyos-tickets', 'zeyos-transactions-billing', 'zeyos-transactions-collection',
  'zeyos-transactions-procurement', 'zeyos-transactions-production', 'zeyos-users',
  'zeyos-weblets'
];

test('the configuration covers every icon in the ZeyOS kit, and invents none', () => {
  const configured = Object.values(zeyosModules).map((module) => module.icon).sort();
  assert.deepEqual(configured, [...kitIcons].sort());
});

test('every module carries a label, an icon, a hex colour, and a stock fallback', () => {
  for (const [key, module] of Object.entries(zeyosModules)) {
    assert.match(key, /^[a-z][a-z-]*$/, `${key} is not a usable module key`);
    assert.ok(module.label, `${key} has no label`);
    assert.match(module.color, /^#[\da-f]{6}$/i, `${key} has a non-hex colour: ${module.color}`);
    assert.match(module.fa, /^[a-z][a-z\d-]*$/, `${key} has a suspicious fallback: ${module.fa}`);
    assert.equal(module.icon, key === 'zeyos' ? 'zeyos' : `zeyos-${key}`);
  }
});

test('module colours reach 3:1 against the glyph colour picked for them', () => {
  for (const [key, module] of Object.entries(zeyosModules)) {
    const glyph = moduleGlyphColor(module.color);
    assert.ok(['#ffffff', '#141414'].includes(glyph), `${key} produced ${glyph}`);
    assert.ok(contrast(module.color, glyph) >= 3, `${key}: ${module.color} on ${glyph}`);
  }
});

test('every alias points at a real module', () => {
  for (const [alias, target] of Object.entries(moduleAliases)) {
    assert.ok(Object.hasOwn(zeyosModules, target), `${alias} → ${target} does not exist`);
    assert.ok(!Object.hasOwn(zeyosModules, alias), `${alias} is both a module and an alias`);
  }
});

test('names are normalized across case, dots, underscores, and aliases', () => {
  assert.equal(normalizeModuleName('Notes'), 'notes');
  assert.equal(normalizeModuleName(' TICKETS '), 'tickets');
  assert.equal(normalizeModuleName('transactions.billing'), 'transactions-billing');
  assert.equal(normalizeModuleName('messages.unread'), 'messages-unread');
  assert.equal(normalizeModuleName('participants.campaigns'), 'participants');
  assert.equal(normalizeModuleName('stock_transactions'), 'default');
  assert.equal(normalizeModuleName('invoices'), 'transactions-billing');
  assert.equal(normalizeModuleName('customers'), 'accounts');
  assert.equal(normalizeModuleName(null), 'default');
  assert.equal(normalizeModuleName('nope'), 'default');
});

test('lookups fall back to the default module instead of throwing', () => {
  assert.equal(moduleColor('notes'), '#008853');
  assert.equal(moduleIconName('notes'), 'zeyos-notes');
  assert.equal(moduleIconName('notes', { standard: true }), 'note-sticky');
  assert.equal(moduleIconName('invoices'), 'zeyos-transactions-billing');
  assert.deepEqual(moduleInfo('does-not-exist'), zeyosModules.default);
});

test('registerModules adds forks and overrides shipped colours', () => {
  registerModules({
    'my-fork': { label: 'My Fork', icon: 'zeyos-weblets', color: '#123456', fa: 'star' },
    Notes: '#ff0000'
  });

  assert.equal(moduleColor('my-fork'), '#123456');
  assert.equal(moduleIconName('my-fork'), 'zeyos-weblets');
  assert.equal(moduleColor('notes'), '#ff0000');
  assert.equal(moduleInfo('notes').label, 'Notes', 'a partial override keeps the rest');
  assert.ok(moduleKeys().includes('my-fork'));

  registerModules({ notes: zeyosModules.notes.color });
  assert.equal(moduleColor('notes'), '#008853');
});

test('the checked-in module tokens match the configuration', async () => {
  assert.equal(
    await readModuleTokens(),
    renderModuleTokens(),
    'styles/tokens/modules.css is stale — run node tools/build-module-tokens.js'
  );
});

/**
 * WCAG contrast ratio between two hex colours.
 * @param {string} first First colour.
 * @param {string} second Second colour.
 * @returns {number}
 */
function contrast(first, second) {
  const [a, b] = [first, second].map(luminance);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/**
 * WCAG relative luminance of a six-digit hex colour.
 * @param {string} color Hex colour.
 * @returns {number}
 */
function luminance(color) {
  const [red, green, blue] = [1, 3, 5].map((offset) => {
    const channel = Number.parseInt(color.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}
