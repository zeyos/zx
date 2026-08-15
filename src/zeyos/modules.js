/**
 * ZeyOS module and entity identity — the icon and the colour each one is drawn with.
 *
 * This is the configuration file the rest of the ZeyOS layer reads. One entry per module:
 *
 * ```js
 * notes: { label: 'Notes', icon: 'zeyos-notes', color: '#008853', fa: 'note-sticky' }
 * ```
 *
 * - `icon` is the icon's name in the ZeyOS Font Awesome kit; it renders as
 *   `<i class="fa-kit fa-zeyos-notes">` and needs the kit loaded (see `./icons.js`).
 * - `fa` is a stock Font Awesome name used when the custom icons are unavailable — every one of
 *   them exists in Font Awesome Free, so the fallback also works on a Free kit.
 * - `color` is the module's identity colour, used for icon chips and header accents. Colours
 *   marked "ZeyOS runtime" below are the values ZeyOS itself ships (`ICO.Colors`); the rest are
 *   Zx defaults for modules ZeyOS has no colour for. Both are overridable: a ZeyOS menu payload
 *   is authoritative, so pass its colours to `registerModules()` at startup.
 *
 * The `--zx-module-*` CSS custom properties in `styles/tokens/modules.css` are generated from
 * this file by `tools/build-module-tokens.js`; `tests/unit/zeyos-modules.test.js` fails if the
 * two drift apart.
 *
 * @module zx/zeyos/modules
 */

/**
 * @typedef {Object} ZeyosModule
 * @property {string} label English display name.
 * @property {string} icon Icon name in the ZeyOS Font Awesome kit.
 * @property {string} color Identity colour as a hex string.
 * @property {string} fa Stock Font Awesome name used when the kit's custom icons are missing.
 */

/**
 * Every module in the ZeyOS Font Awesome kit, keyed by module identifier.
 * @type {Readonly<Record<string, ZeyosModule>>}
 */
export const zeyosModules = Object.freeze({
  /* ---------------------------------------------- colours from the ZeyOS runtime (ICO.Colors) */
  accounts: { label: 'Accounts', icon: 'zeyos-accounts', color: '#bc3885', fa: 'building' },
  actionsteps: { label: 'Action Steps', icon: 'zeyos-actionsteps', color: '#f67f00', fa: 'clock' },
  appointments: { label: 'Appointments', icon: 'zeyos-appointments', color: '#bd1e32', fa: 'calendar-check' },
  billing: { label: 'Billing', icon: 'zeyos-billing', color: '#535494', fa: 'file-invoice-dollar' },
  calendar: { label: 'Calendar', icon: 'zeyos-calendar', color: '#bd1e32', fa: 'calendar-days' },
  campaigns: { label: 'Campaigns', icon: 'zeyos-campaigns', color: '#f16528', fa: 'bullhorn' },
  collection: { label: 'Collection', icon: 'zeyos-collection', color: '#0d60ae', fa: 'hand-holding-dollar' },
  contacts: { label: 'Contacts', icon: 'zeyos-contacts', color: '#8c6641', fa: 'address-book' },
  contracts: { label: 'Contracts', icon: 'zeyos-contracts', color: '#823e89', fa: 'file-contract' },
  coupons: { label: 'Coupons', icon: 'zeyos-coupons', color: '#10775c', fa: 'ticket-simple' },
  devices: { label: 'Devices', icon: 'zeyos-devices', color: '#064e4f', fa: 'desktop' },
  documents: { label: 'Documents', icon: 'zeyos-documents', color: '#808000', fa: 'file' },
  dunning: { label: 'Dunning', icon: 'zeyos-dunning', color: '#0d60ae', fa: 'file-invoice-dollar' },
  events: { label: 'Events', icon: 'zeyos-events', color: '#bd1e32', fa: 'calendar-day' },
  inventory: { label: 'Inventory', icon: 'zeyos-inventory', color: '#064e4f', fa: 'warehouse' },
  items: { label: 'Items', icon: 'zeyos-items', color: '#064e4f', fa: 'box-open' },
  ledgers: { label: 'Ledgers', icon: 'zeyos-ledgers', color: '#4679c8', fa: 'book-open' },
  line: { label: 'Line Items', icon: 'zeyos-line', color: '#064e4f', fa: 'list-ul' },
  links: { label: 'Links', icon: 'zeyos-links', color: '#405e76', fa: 'bookmark' },
  mailinglists: { label: 'Mailing Lists', icon: 'zeyos-mailinglists', color: '#0299ac', fa: 'envelope-open-text' },
  messages: { label: 'Messages', icon: 'zeyos-messages', color: '#31a8e0', fa: 'message' },
  'messages-unread': { label: 'Unread Messages', icon: 'zeyos-messages-unread', color: '#31a8e0', fa: 'envelope' },
  notes: { label: 'Notes', icon: 'zeyos-notes', color: '#008853', fa: 'note-sticky' },
  opportunities: { label: 'Opportunities', icon: 'zeyos-opportunities', color: '#7b67ae', fa: 'handshake' },
  payments: { label: 'Payments', icon: 'zeyos-payments', color: '#4679c8', fa: 'sack-dollar' },
  pricelists: { label: 'Price Lists', icon: 'zeyos-pricelists', color: '#10775c', fa: 'clipboard-list' },
  procurement: { label: 'Procurement', icon: 'zeyos-procurement', color: '#006e9f', fa: 'truck' },
  production: { label: 'Production', icon: 'zeyos-production', color: '#226375', fa: 'industry' },
  projects: { label: 'Projects', icon: 'zeyos-projects', color: '#db532d', fa: 'diagram-project' },
  stocktransactions: { label: 'Stock Transactions', icon: 'zeyos-stocktransactions', color: '#064e4f', fa: 'arrow-right-arrow-left' },
  storages: { label: 'Storages', icon: 'zeyos-storages', color: '#064e4f', fa: 'boxes-stacked' },
  tasks: { label: 'Tasks', icon: 'zeyos-tasks', color: '#e2b301', fa: 'list-check' },
  text: { label: 'Text Blocks', icon: 'zeyos-text', color: '#064e4f', fa: 'file-lines' },
  tickets: { label: 'Tickets', icon: 'zeyos-tickets', color: '#f04639', fa: 'ticket' },
  'transactions-billing': { label: 'Billing Transactions', icon: 'zeyos-transactions-billing', color: '#535494', fa: 'file-invoice' },
  'transactions-collection': { label: 'Collection Transactions', icon: 'zeyos-transactions-collection', color: '#0d60ae', fa: 'money-bill-transfer' },
  'transactions-procurement': { label: 'Procurement Transactions', icon: 'zeyos-transactions-procurement', color: '#006e9f', fa: 'cart-shopping' },
  'transactions-production': { label: 'Production Transactions', icon: 'zeyos-transactions-production', color: '#226375', fa: 'gears' },

  /* ------------------------------------- Zx defaults: modules ZeyOS ships no identity colour for */
  zeyos: { label: 'ZeyOS', icon: 'zeyos', color: '#007a55', fa: 'cloud' },
  default: { label: 'Default', icon: 'zeyos-default', color: '#21cc75', fa: 'cube' },
  admin: { label: 'Administration', icon: 'zeyos-admin', color: '#4b5563', fa: 'screwdriver-wrench' },
  applications: { label: 'Applications', icon: 'zeyos-applications', color: '#2563eb', fa: 'window-maximize' },
  auth: { label: 'Credentials', icon: 'zeyos-auth', color: '#a16207', fa: 'shield-halved' },
  categories: { label: 'Categories', icon: 'zeyos-categories', color: '#9a3412', fa: 'folder-tree' },
  channels: { label: 'Channels', icon: 'zeyos-channels', color: '#0891b2', fa: 'share-nodes' },
  control: { label: 'Control Center', icon: 'zeyos-control', color: '#0f766e', fa: 'sliders' },
  davservers: { label: 'DAV Servers', icon: 'zeyos-davservers', color: '#475569', fa: 'server' },
  dev: { label: 'Development', icon: 'zeyos-dev', color: '#1f2937', fa: 'code' },
  error: { label: 'Errors', icon: 'zeyos-error', color: '#b91c1c', fa: 'triangle-exclamation' },
  global: { label: 'Global', icon: 'zeyos-global', color: '#0369a1', fa: 'globe' },
  groups: { label: 'Groups', icon: 'zeyos-groups', color: '#007a55', fa: 'users' },
  logout: { label: 'Logout', icon: 'zeyos-logout', color: '#9f1239', fa: 'right-from-bracket' },
  objects: { label: 'Custom Objects', icon: 'zeyos-objects', color: '#7e22ce', fa: 'cubes' },
  participants: { label: 'Participants', icon: 'zeyos-participants', color: '#4338ca', fa: 'user-group' },
  permissions: { label: 'Permissions', icon: 'zeyos-permissions', color: '#5b21b6', fa: 'user-lock' },
  records: { label: 'Records', icon: 'zeyos-records', color: '#57534e', fa: 'database' },
  resources: { label: 'Resources', icon: 'zeyos-resources', color: '#15803d', fa: 'layer-group' },
  services: { label: 'Services', icon: 'zeyos-services', color: '#b45309', fa: 'bell-concierge' },
  system: { label: 'System', icon: 'zeyos-system', color: '#374151', fa: 'gear' },
  users: { label: 'Users', icon: 'zeyos-users', color: '#007a55', fa: 'user' },
  weblets: { label: 'Weblets', icon: 'zeyos-weblets', color: '#4f46e5', fa: 'window-restore' }
});

/**
 * Alternative identifiers resolving to a module key: API resource names, ZeyOS entity names, and
 * the legacy gx module names. Dotted ZeyOS identifiers (`transactions.billing`) need no entry —
 * `normalizeModuleName()` turns dots into hyphens first.
 * @type {Readonly<Record<string, string>>}
 */
export const moduleAliases = Object.freeze({
  addresses: 'contacts',
  clocking: 'actionsteps',
  comments: 'notes',
  couponcodes: 'coupons',
  customers: 'accounts',
  customfields: 'objects',
  davids: 'davservers',
  documentversions: 'documents',
  enhancements: 'applications',
  extdata: 'objects',
  feedservers: 'channels',
  files: 'documents',
  filters: 'records',
  forks: 'applications',
  imports: 'records',
  invoices: 'transactions-billing',
  linecoupon: 'line',
  logins: 'auth',
  mailservers: 'channels',
  notifications: 'messages',
  'participants-campaigns': 'participants',
  'participants-mailinglists': 'participants',
  prices: 'pricelists',
  pwd: 'auth',
  purchaseorders: 'transactions-procurement',
  sessions: 'auth',
  settings: 'system',
  suppliers: 'accounts',
  tags: 'categories',
  tokens: 'auth',
  transactions: 'transactions-billing',
  usergroups: 'groups',
  usermgmt: 'users',
  usersettings: 'system',
  userfields: 'objects',
  userfilters: 'records'
});

/** Glyph colour candidates, matching the two foregrounds ZeyOS measured its palette against. */
const glyphColors = Object.freeze({ light: '#ffffff', dark: '#141414' });

/** @type {Record<string, ZeyosModule>} Modules registered or overridden at runtime. */
const overrides = Object.create(null);

/**
 * Normalizes a module, entity, or resource name to a module key. Case, surrounding whitespace,
 * dots (`transactions.billing`), and underscores are all accepted; aliases are resolved.
 * @param {string|null|undefined} name Module, entity, or resource name.
 * @returns {string} A module key, or `'default'` when nothing matches.
 */
export function normalizeModuleName(name) {
  const key = String(name ?? '').trim().toLowerCase().replaceAll(/[._\s]+/g, '-');
  if (!key) return 'default';
  if (Object.hasOwn(overrides, key) || Object.hasOwn(zeyosModules, key)) return key;
  const alias = moduleAliases[key];
  if (alias) return alias;
  return 'default';
}

/**
 * Looks a module up. Unknown names fall back to the `default` entry, so callers always get an
 * icon and a colour.
 * @param {string|null|undefined} name Module, entity, or resource name.
 * @returns {ZeyosModule} The module's configuration.
 */
export function moduleInfo(name) {
  const key = normalizeModuleName(name);
  return overrides[key] ?? zeyosModules[key] ?? zeyosModules.default;
}

/**
 * Reads a module's identity colour.
 * @param {string|null|undefined} name Module, entity, or resource name.
 * @returns {string} Hex colour.
 */
export function moduleColor(name) {
  return moduleInfo(name).color;
}

/**
 * Reads the kit icon name for a module (`'zeyos-notes'`), or its stock Font Awesome fallback.
 * @param {string|null|undefined} name Module, entity, or resource name.
 * @param {{standard?: boolean}} [options={}] Set `standard` for the stock Font Awesome name.
 * @returns {string} Icon name without the `fa-` prefix.
 */
export function moduleIconName(name, { standard = false } = {}) {
  const info = moduleInfo(name);
  return standard ? info.fa : info.icon;
}

/**
 * Lists every module key, including runtime registrations.
 * @returns {string[]} Sorted module keys.
 */
export function moduleKeys() {
  return [...new Set([...Object.keys(zeyosModules), ...Object.keys(overrides)])].sort();
}

/**
 * Registers modules, or overrides shipped ones — for forks, weblets, and the colours a ZeyOS
 * menu payload carries. A partial entry inherits the rest from the module it replaces.
 * @param {Record<string, string|Partial<ZeyosModule>>} modules Entries keyed by module name;
 *   a string value sets the colour only.
 * @returns {void}
 */
export function registerModules(modules) {
  for (const [name, value] of Object.entries(modules)) {
    const key = String(name).trim().toLowerCase().replaceAll(/[._\s]+/g, '-');
    const patch = typeof value === 'string' ? { color: value } : value;
    const base = overrides[key] ?? zeyosModules[key] ?? zeyosModules.default;
    overrides[key] = Object.freeze({
      label: patch.label ?? base.label,
      icon: patch.icon ?? base.icon,
      color: patch.color ?? base.color,
      fa: patch.fa ?? base.fa
    });
  }
}

/**
 * Picks the higher-contrast glyph colour for a background, using the same two candidates and the
 * same WCAG relative-luminance maths ZeyOS used to measure its palette.
 * @param {string} background Hex colour, three or six digits.
 * @returns {string} `'#ffffff'` or `'#141414'`.
 */
export function moduleGlyphColor(background) {
  const luminance = hexLuminance(background);
  if (luminance === null) return glyphColors.light;
  const light = contrastRatio(luminance, hexLuminance(glyphColors.light) ?? 1);
  const dark = contrastRatio(luminance, hexLuminance(glyphColors.dark) ?? 0);
  return light >= dark ? glyphColors.light : glyphColors.dark;
}

/**
 * WCAG relative luminance of a hex colour.
 * @param {string} color Hex colour, three or six digits.
 * @returns {number|null} Luminance, or null when the colour is not hex.
 */
function hexLuminance(color) {
  const match = /^#([\da-f]{3}|[\da-f]{6})$/i.exec(String(color).trim());
  if (!match) return null;
  const digits = match[1].length === 3 ? [...match[1]].map((digit) => digit + digit).join('') : match[1];
  const [red, green, blue] = [0, 2, 4].map((offset) => {
    const channel = Number.parseInt(digits.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

/**
 * Contrast ratio between two relative luminances.
 * @param {number} first First luminance.
 * @param {number} second Second luminance.
 * @returns {number}
 */
function contrastRatio(first, second) {
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}
