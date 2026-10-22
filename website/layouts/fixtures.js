/*
 * The one fictional world every application layout shares.
 *
 * ACME is a mid-sized software and services company. Its people answer the mail, file the
 * tickets, write the wiki, issue the invoices, and run the racks, and its customers turn up in all
 * of those places — so a reader moving from one layout to the next meets the same names, not a new
 * cast per screen. Every domain uses the reserved `.example` TLD; every number is invented.
 */

/** The organisation the layouts are "signed in" to. */
const ORGANISATION = {
  name: 'ACME',
  legalName: 'ACME GmbH',
  domain: 'acme.example',
  street: 'Lindenstraße 14',
  city: '10969 Berlin',
  country: 'Germany',
  vatId: 'DE 318 204 551',
  iban: 'DE12 1001 0010 0123 4567 89',
  bic: 'PBNKDEFFXXX'
};

/** The signed-in user, as an id into `PEOPLE`. */
const ME = 'ines';

/** Today in the layouts' world. Relative labels ("Yesterday", "2 days ago") are written from it. */
const TODAY = '2026-10-08';

/** The moment the layouts are looked at: Thursday morning, local time. */
const NOW = new Date(2026, 9, 8, 10, 30);

/**
 * ACME's own staff.
 * @type {{id: string, name: string, role: string, team: string, email: string,
 *   status: 'online'|'away'|'busy'|'offline'}[]}
 */
const PEOPLE = [
  { id: 'ines', name: 'Ines Bauer', role: 'Head of Operations', team: 'Operations', email: 'ines@acme.example', status: 'online' },
  { id: 'tobias', name: 'Tobias Kern', role: 'Account Executive', team: 'Sales', email: 'tobias@acme.example', status: 'online' },
  { id: 'nadine', name: 'Nadine Roth', role: 'Customer Success', team: 'Sales', email: 'nadine@acme.example', status: 'away' },
  { id: 'camille', name: 'Camille Fournier', role: 'Staff Engineer', team: 'Engineering', email: 'camille@acme.example', status: 'busy' },
  { id: 'owen', name: 'Owen Blythe', role: 'Support Engineer', team: 'Support', email: 'owen@acme.example', status: 'online' },
  { id: 'marta', name: 'Marta Silva', role: 'Product Designer', team: 'Product', email: 'marta@acme.example', status: 'offline' },
  { id: 'piet', name: 'Piet Vermeer', role: 'Solutions Architect', team: 'Engineering', email: 'piet@acme.example', status: 'online' },
  { id: 'ruth', name: 'Ruth Salzmann', role: 'Finance Manager', team: 'Finance', email: 'ruth@acme.example', status: 'away' },
  { id: 'jonas', name: 'Jonas Weber', role: 'Site Reliability Engineer', team: 'Infrastructure', email: 'jonas@acme.example', status: 'online' },
  { id: 'lea', name: 'Lea Hoffmann', role: 'Warehouse Lead', team: 'Operations', email: 'lea@acme.example', status: 'offline' }
];

/**
 * Customers and suppliers.
 * @type {{id: string, name: string, domain: string, city: string, country: string,
 *   industry: string, contact: string, email: string}[]}
 */
const COMPANIES = [
  { id: 'alpine', name: 'Alpine Works GmbH', domain: 'alpineworks.example', city: 'Innsbruck', country: 'Austria', industry: 'Manufacturing', contact: 'Hannah Egger', email: 'h.egger@alpineworks.example' },
  { id: 'danube', name: 'Danube Systems AG', domain: 'danube.example', city: 'Vienna', country: 'Austria', industry: 'Logistics software', contact: 'Lukas Gruber', email: 'lukas.gruber@danube.example' },
  { id: 'kestrel', name: 'Kestrel Analytics', domain: 'kestrel.example', city: 'Manchester', country: 'United Kingdom', industry: 'Data & analytics', contact: 'Priya Natarajan', email: 'priya@kestrel.example' },
  { id: 'northstar', name: 'Northstar Freight', domain: 'northstar.example', city: 'Rotterdam', country: 'Netherlands', industry: 'Freight & shipping', contact: 'Daan de Vries', email: 'daan@northstar.example' },
  { id: 'helios', name: 'Helios Energie', domain: 'helios.example', city: 'Lyon', country: 'France', industry: 'Energy', contact: 'Élise Martin', email: 'e.martin@helios.example' },
  { id: 'bruckner', name: 'Bruckner Logistik', domain: 'bruckner.example', city: 'Munich', country: 'Germany', industry: 'Logistics', contact: 'Felix Bruckner', email: 'felix@bruckner.example' },
  { id: 'atelier', name: 'Atelier West', domain: 'atelierwest.example', city: 'Hamburg', country: 'Germany', industry: 'Design studio', contact: 'Sofia Lange', email: 'sofia@atelierwest.example' },
  { id: 'meridian', name: 'Meridian Health', domain: 'meridian.example', city: 'Zurich', country: 'Switzerland', industry: 'Healthcare', contact: 'Marc Keller', email: 'marc.keller@meridian.example' }
];

/**
 * Looks a staff member up by id.
 * @param {string} id
 * @returns {(typeof PEOPLE)[number] | undefined}
 */
function person(id) {
  return PEOPLE.find((entry) => entry.id === id);
}

/**
 * Looks a customer or supplier up by id.
 * @param {string} id
 * @returns {(typeof COMPANIES)[number] | undefined}
 */
function company(id) {
  return COMPANIES.find((entry) => entry.id === id);
}

/**
 * The modules of the ACME suite, in the order the module strip shows them, under the headings
 * that group them there. Each names the layout that implements it and, where it has more than one
 * screen, a short menu of them — so every layout's navigation reaches the whole suite. A layout
 * fills its own module's menu with its live destinations; a module without a menu is a
 * destination of its own.
 * @type {ReadonlyArray<{id: string, label: string, icon: string, tone: string|null, layout: string,
 *   section?: string, menu?: {id: string, label: string, icon?: string, layout: string}[]}>}
 */
const SUITE_MODULES = Object.freeze([
  { id: 'home', label: 'Home', icon: 'house', tone: 'slate', layout: 'dashboard' },
  { id: 'mail', label: 'Mail', icon: 'envelope', tone: 'blue', layout: 'mail', section: 'Communication', menu: [
    { id: 'mail:mailboxes', label: 'Mailboxes', icon: 'inbox', layout: 'mail' },
    { id: 'mail:team', label: 'Team inbox', icon: 'users', layout: 'inbox' }
  ] },
  { id: 'assistant', label: 'Assistant', icon: 'robot', tone: 'violet', layout: 'ai-chat', section: 'Communication', menu: [
    { id: 'assistant:chat', label: 'Chats', icon: 'comments', layout: 'ai-chat' },
    { id: 'assistant:workspace', label: 'Agent workspace', icon: 'layer-group', layout: 'agent-workspace' },
    { id: 'assistant:run', label: 'Agent runs', icon: 'robot', layout: 'agent-chat' }
  ] },
  { id: 'crm', label: 'CRM', icon: 'building', tone: 'pink', layout: 'crm', section: 'Sales', menu: [
    { id: 'crm:companies', label: 'Companies', icon: 'building', layout: 'crm' },
    { id: 'crm:customers', label: 'Customers', icon: 'users', layout: 'master-detail' },
    { id: 'crm:opportunities', label: 'Opportunities', icon: 'handshake', layout: 'record-page' }
  ] },
  { id: 'billing', label: 'Billing', icon: 'file-invoice', tone: 'amber', layout: 'invoice-editor', section: 'Sales', menu: [
    { id: 'billing:invoices', label: 'Invoices', icon: 'file-invoice', layout: 'invoice-editor' },
    { id: 'billing:quotation', label: 'New quotation', icon: 'plus', layout: 'record-wizard' },
    { id: 'billing:zeyos', label: 'Invoices from ZeyOS', icon: 'cloud', layout: 'zeyos-invoices' },
    { id: 'billing:shop', label: 'Shop checkout', icon: 'cart-shopping', layout: 'checkout-wizard' }
  ] },
  { id: 'inventory', label: 'Inventory', icon: 'box', tone: 'teal', layout: 'item-inventory', section: 'Operations' },
  { id: 'projects', label: 'Projects', icon: 'list-check', tone: 'orange', layout: 'issue-tracker', section: 'Operations', menu: [
    { id: 'projects:issues', label: 'Issues', icon: 'list-check', layout: 'issue-tracker' },
    { id: 'projects:rollout', label: 'Scanner rollout', icon: 'layer-group', layout: 'system-states' }
  ] },
  { id: 'workflows', label: 'Workflows', icon: 'diagram-project', tone: 'red', layout: 'workflows', section: 'Operations' },
  { id: 'wiki', label: 'Knowledge base', icon: 'book-open', tone: 'green', layout: 'wiki', section: 'Workspace' },
  { id: 'infrastructure', label: 'Infrastructure', icon: 'server', tone: 'teal', layout: 'infrastructure', section: 'Workspace' },
  { id: 'settings', label: 'Settings', icon: 'gear', tone: null, layout: 'settings-workspace', section: 'Workspace' }
]);

export { COMPANIES, ME, NOW, ORGANISATION, PEOPLE, SUITE_MODULES, TODAY, company, person };
