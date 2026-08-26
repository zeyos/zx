import { normalizeModuleName, zeyosAppIcon } from '../src/zeyos/index.js';

/* Built-in glyphs keep the documentation useful offline. Applications can omit this override after
   opting into the existing ZeyOS icon kit; the AppIcon shape, module colour, and API are identical. */
const BUILTIN_GLYPHS = Object.freeze({
  accounts: 'book', actionsteps: 'clock', admin: 'gear', auth: 'lock', billing: 'copy',
  calendar: 'calendar', campaigns: 'star', collection: 'folder-open', contacts: 'book',
  contracts: 'file', control: 'filter', coupons: 'tag', dev: 'code', documents: 'copy',
  inventory: 'square', mailinglists: 'list', main: 'heart', messages: 'info', links: 'tag',
  notes: 'file', objects: 'square', opportunities: 'star', payments: 'check', pricelists: 'list',
  procurement: 'folder', production: 'gear', projects: 'folder-open', tasks: 'check', tickets: 'tag',
  'transactions-billing': 'file'
});

/** Creates a module-coloured ZeyOS AppIcon that also renders in the offline documentation. */
export function demoZeyosAppIcon(name, options = {}) {
  const key = normalizeModuleName(name);
  return zeyosAppIcon(name, {
    ...options,
    icon: options.icon ?? BUILTIN_GLYPHS[key] ?? 'square'
  });
}
