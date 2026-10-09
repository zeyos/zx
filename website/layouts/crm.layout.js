import {
  AccountMenu, ActivityList, AppSidebar, Avatar, Breadcrumb, Datebox, Dialog, Dropdown, FileList,
  FilterPanel, Form, InlineLoading, KanbanView, Launcher, ListToolbar, MenuButton, NumberField,
  ProgressBar, Select, Sheet, SortControl, StatTile, Tabbox, TableView, TagPicker, badge, button,
  downloadBlob, emptyState, formatCurrency, formatDate, formatNumber, formatRelativeTime, h, icon,
  parseNumber, stack, toCsv
} from '../../src/index.js';
import {
  DATE, adaptiveShell, disposer, iconButton, iconTile, layoutContext, later, listTime, navSearch, paneHeader, panelBlock,
  propList, renderScope, sectionLabel, shortcuts, toaster, unavailable, workspaceHeader
} from './kit.js';
import { COMPANIES, ME, NOW, PEOPLE, TODAY, person } from './fixtures.js';

/** The kinds of record, each recognised by its tinted tile in the navigation and on its page. */
const RECORD_TYPES = {
  companies: { title: 'Companies', icon: 'building', tone: 'blue' },
  people: { title: 'People', icon: 'users', tone: 'teal' },
  deals: { title: 'Deals', icon: 'handshake', tone: 'orange' }
};

/** Where a company stands with Fieldstone, in pipeline order. Shaped for `Select.status()`. */
const STAGES = [
  { ID: 'lead', name: 'Lead', tone: 'neutral', indicator: 'dotted' },
  { ID: 'prospect', name: 'Prospect', tone: 'info', indicator: 'progress' },
  { ID: 'customer', name: 'Customer', tone: 'success', indicator: 'done' },
  { ID: 'partner', name: 'Partner', tone: 'accent', indicator: 'ready' }
];

/** Connection strength, weakest first; a company stores the 1-based level. */
const STRENGTH = ['Very weak', 'Weak', 'Good', 'Strong', 'Very strong'];

/** Account tiers, largest first. A company has one. */
const TIERS = ['Enterprise', 'Mid-market', 'SMB'];

/**
 * The industries a company can be tagged with, and the categorical tone each chip is drawn in:
 * a colour tells the tags apart and says nothing about how the account is doing.
 */
const CATEGORIES = {
  Manufacturing: 'amber', Logistics: 'blue', Software: 'violet', Healthcare: 'teal', Energy: 'orange',
  Retail: 'pink', Finance: 'green', Design: 'red', Hospitality: 'slate'
};

/** Prospects and leads beyond the shared fixtures — the long tail a sales team works through. */
const MORE_COMPANIES = [
  { id: 'lumen', name: 'Lumen Optics', domain: 'lumenoptics.example', city: 'Eindhoven', country: 'Netherlands', contact: 'Sanne Bakker', email: 'sanne@lumenoptics.example' },
  { id: 'harbor', name: 'Harbor & Finch', domain: 'harborfinch.example', city: 'Copenhagen', country: 'Denmark', contact: 'Mads Holm', email: 'mads@harborfinch.example' },
  { id: 'ostara', name: 'Ostara Bio', domain: 'ostara.example', city: 'Basel', country: 'Switzerland', contact: 'Lena Brunner', email: 'lena.brunner@ostara.example' },
  { id: 'pinecrest', name: 'Pinecrest Hotels', domain: 'pinecrest.example', city: 'Salzburg', country: 'Austria', contact: 'Jakob Aigner', email: 'j.aigner@pinecrest.example' },
  { id: 'quarry', name: 'Quarry Lane Studios', domain: 'quarrylane.example', city: 'Leeds', country: 'United Kingdom', contact: 'Amelia Shaw', email: 'amelia@quarrylane.example' },
  { id: 'tessellate', name: 'Tessellate Labs', domain: 'tessellate.example', city: 'Berlin', country: 'Germany', contact: 'Nils Krüger', email: 'nils@tessellate.example' },
  { id: 'vireo', name: 'Vireo Mobility', domain: 'vireo.example', city: 'Milan', country: 'Italy', contact: 'Chiara Conti', email: 'c.conti@vireo.example' },
  { id: 'wexford', name: 'Wexford Mutual', domain: 'wexford.example', city: 'Dublin', country: 'Ireland', contact: 'Ciarán Byrne', email: 'ciaran.byrne@wexford.example' },
  { id: 'corvid', name: 'Corvid Security', domain: 'corvid.example', city: 'Tallinn', country: 'Estonia', contact: 'Kadri Tamm', email: 'kadri@corvid.example' },
  { id: 'saltmarsh', name: 'Saltmarsh Foods', domain: 'saltmarsh.example', city: 'Bremen', country: 'Germany', contact: 'Greta Lüders', email: 'greta@saltmarsh.example' }
];

/** What the CRM knows about each company beyond its address, keyed by company id. */
const ACCOUNT_FACTS = {
  alpine: { stage: 'customer', tier: 'Enterprise', categories: ['Manufacturing', 'Logistics'], team: ['tobias', 'nadine', 'piet', 'camille'], strength: 5, arr: 184000, last: '2026-10-07T15:20', owner: 'tobias', employees: 420, renewal: '2027-03-31', role: 'Head of Procurement' },
  danube: { stage: 'customer', tier: 'Mid-market', categories: ['Software'], team: ['tobias', 'camille'], strength: 4, arr: 96000, last: '2026-10-05T11:00', owner: 'tobias', employees: 180, renewal: '2027-01-31', role: 'CTO' },
  kestrel: { stage: 'prospect', tier: 'Mid-market', categories: ['Software'], team: ['tobias', 'owen'], strength: 3, arr: 0, last: '2026-10-06T09:40', owner: 'tobias', employees: 95, renewal: null, role: 'Head of Data' },
  northstar: { stage: 'prospect', tier: 'Enterprise', categories: ['Logistics'], team: ['nadine'], strength: 2, arr: 0, last: '2026-09-21T14:10', owner: 'nadine', employees: 1300, renewal: null, role: 'Operations Director' },
  helios: { stage: 'customer', tier: 'Enterprise', categories: ['Energy'], team: ['nadine', 'jonas', 'ruth'], strength: 4, arr: 142000, last: '2026-10-01T10:30', owner: 'nadine', employees: 2600, renewal: '2026-12-31', role: 'IT Manager' },
  bruckner: { stage: 'customer', tier: 'Mid-market', categories: ['Logistics'], team: ['tobias', 'piet', 'ines'], strength: 5, arr: 78000, last: '2026-10-08T09:12', owner: 'tobias', employees: 310, renewal: '2027-06-30', role: 'Managing Director' },
  atelier: { stage: 'partner', tier: 'SMB', categories: ['Design'], team: ['marta'], strength: 3, arr: 12000, last: '2026-09-29T16:00', owner: 'ines', employees: 24, renewal: '2027-02-28', role: 'Studio Lead' },
  meridian: { stage: 'prospect', tier: 'Enterprise', categories: ['Healthcare', 'Software'], team: ['piet', 'tobias'], strength: 3, arr: 0, last: '2026-10-02T13:30', owner: 'piet', employees: 870, renewal: null, role: 'Head of Digital' },
  lumen: { stage: 'lead', tier: 'SMB', categories: ['Manufacturing'], team: ['owen'], strength: 1, arr: 0, last: '2026-08-14T10:00', owner: 'nadine', employees: 60, renewal: null, role: 'Plant Manager' },
  harbor: { stage: 'lead', tier: 'SMB', categories: ['Retail'], team: [], strength: 1, arr: 0, last: '2026-07-30T15:45', owner: 'tobias', employees: 45, renewal: null, role: 'Founder' },
  ostara: { stage: 'prospect', tier: 'Mid-market', categories: ['Healthcare'], team: ['tobias', 'piet'], strength: 2, arr: 0, last: '2026-10-03T08:50', owner: 'tobias', employees: 140, renewal: null, role: 'Lab Director' },
  pinecrest: { stage: 'customer', tier: 'Mid-market', categories: ['Hospitality'], team: ['nadine'], strength: 3, arr: 54000, last: '2026-09-25T12:00', owner: 'nadine', employees: 520, renewal: '2026-11-30', role: 'Head of IT' },
  quarry: { stage: 'lead', tier: 'SMB', categories: ['Design'], team: [], strength: 2, arr: 0, last: '2026-09-11T09:00', owner: 'ines', employees: 18, renewal: null, role: 'Producer' },
  tessellate: { stage: 'partner', tier: 'SMB', categories: ['Software', 'Design'], team: ['camille', 'piet'], strength: 4, arr: 24000, last: '2026-10-06T17:05', owner: 'ines', employees: 32, renewal: '2027-04-30', role: 'Partnerships Lead' },
  vireo: { stage: 'prospect', tier: 'Enterprise', categories: ['Logistics'], team: ['piet'], strength: 2, arr: 0, last: '2026-09-30T11:20', owner: 'piet', employees: 940, renewal: null, role: 'Fleet Director' },
  wexford: { stage: 'customer', tier: 'Enterprise', categories: ['Finance'], team: ['tobias', 'ruth'], strength: 4, arr: 128000, last: '2026-10-07T10:05', owner: 'tobias', employees: 1800, renewal: '2027-05-31', role: 'Head of Claims' },
  corvid: { stage: 'lead', tier: 'SMB', categories: ['Software'], team: ['owen'], strength: 1, arr: 0, last: '2026-09-02T14:30', owner: 'nadine', employees: 40, renewal: null, role: 'CISO' },
  saltmarsh: { stage: 'lead', tier: 'Mid-market', categories: ['Retail'], team: [], strength: 1, arr: 0, last: '2026-08-27T10:15', owner: 'ines', employees: 260, renewal: null, role: 'Head of Supply Chain' }
};

/** The stages a deal moves through on the board, in order. */
const DEAL_STAGES = [
  { id: 'discovery', label: 'Discovery', tone: 'neutral' },
  { id: 'proposal', label: 'Proposal', tone: 'info' },
  { id: 'negotiation', label: 'Negotiation', tone: 'warning' },
  { id: 'won', label: 'Won', tone: 'success' }
];

/** Open and recently won deals. `company` is a company id, `owner` a staff id. */
const DEALS = [
  { ID: 'D-311', name: 'Plant rollout, phase 2', company: 'alpine', stage: 'negotiation', value: 96000, owner: 'tobias', close: '2026-10-30' },
  { ID: 'D-318', name: 'Extended SLA', company: 'alpine', stage: 'proposal', value: 18000, owner: 'nadine', close: '2026-11-15' },
  { ID: 'D-329', name: 'Warehouse rollout', company: 'bruckner', stage: 'negotiation', value: 112000, owner: 'tobias', close: '2026-11-02' },
  { ID: 'D-327', name: 'Guest Wi-Fi analytics', company: 'pinecrest', stage: 'negotiation', value: 27500, owner: 'nadine', close: '2026-10-24' },
  { ID: 'D-322', name: 'Analytics workspace, 40 seats', company: 'kestrel', stage: 'proposal', value: 38400, owner: 'tobias', close: '2026-11-06' },
  { ID: 'D-324', name: 'Patient portal integration', company: 'meridian', stage: 'proposal', value: 54000, owner: 'piet', close: '2026-11-20' },
  { ID: 'D-335', name: 'Claims automation', company: 'wexford', stage: 'proposal', value: 88000, owner: 'tobias', close: '2026-12-04' },
  { ID: 'D-326', name: 'Fleet tracking pilot', company: 'northstar', stage: 'discovery', value: 22000, owner: 'nadine', close: '2026-12-11' },
  { ID: 'D-331', name: 'Design system licence', company: 'atelier', stage: 'discovery', value: 9600, owner: 'ines', close: '2026-12-01' },
  { ID: 'D-333', name: 'Lab data platform', company: 'ostara', stage: 'discovery', value: 46000, owner: 'tobias', close: '2027-01-15' },
  { ID: 'D-336', name: 'Fleet electrification study', company: 'vireo', stage: 'discovery', value: 31000, owner: 'piet', close: '2027-01-29' },
  { ID: 'D-305', name: 'Route optimisation API', company: 'danube', stage: 'won', value: 64000, owner: 'tobias', close: '2026-09-22' },
  { ID: 'D-301', name: 'Grid monitoring renewal', company: 'helios', stage: 'won', value: 71000, owner: 'nadine', close: '2026-09-30' }
];

/** Curated lists. Each has its own stages, and a company's place in a list is a membership. */
const LISTS = [
  { id: 'enterprise', name: 'Enterprise pipeline', stages: ['Researching', 'Engaged', 'Evaluating', 'Contracting'] },
  { id: 'partnerships', name: 'Partnerships', stages: ['Intro', 'Pilot', 'Signed'] },
  { id: 'renewals', name: 'Renewals Q4', stages: ['Upcoming', 'In discussion', 'Renewed'] }
];

/** Which company sits in which list, and at which of that list's stages: [list, company, stage]. */
const MEMBERSHIPS = [
  ['enterprise', 'bruckner', 'Contracting'], ['enterprise', 'alpine', 'Contracting'],
  ['enterprise', 'wexford', 'Evaluating'], ['enterprise', 'meridian', 'Evaluating'],
  ['enterprise', 'ostara', 'Engaged'], ['enterprise', 'vireo', 'Researching'],
  ['enterprise', 'northstar', 'Researching'], ['partnerships', 'tessellate', 'Signed'],
  ['partnerships', 'atelier', 'Pilot'], ['partnerships', 'kestrel', 'Intro'],
  ['renewals', 'alpine', 'In discussion'], ['renewals', 'helios', 'Renewed'],
  ['renewals', 'pinecrest', 'Upcoming'], ['renewals', 'danube', 'Upcoming']
];

/** Everything that happened on a company, newest first. `kind` decides which record tab lists it. */
const TIMELINE = [
  { company: 'bruckner', actor: 'piet', kind: 'email', at: '2026-10-08T09:12', title: 'emailed Felix Bruckner', subject: 'Migration window for the Munich depot', content: 'Proposed the weekend of 24 October for the cut-over; rollback plan attached.' },
  { company: 'alpine', actor: 'tobias', kind: 'email', at: '2026-10-07T15:20', title: 'emailed Hannah Egger', subject: 'Phase 2 proposal, revised', content: 'Sent the revised phase 2 proposal with the extended SLA bundled in.' },
  { company: 'wexford', actor: 'tobias', kind: 'meeting', at: '2026-10-07T10:05', title: 'met Ciarán Byrne', content: 'Claims wants a pilot on motor claims first; the security review starts next week.' },
  { company: 'alpine', actor: 'nadine', kind: 'meeting', at: '2026-10-06T10:00', title: 'held the quarterly business review', content: 'Usage is up 18% since July. Hannah wants the Graz plant onboarded before year end.' },
  { company: 'kestrel', actor: 'owen', kind: 'email', at: '2026-10-06T09:40', title: 'emailed Priya Natarajan', subject: 'Nightly export limits', content: 'Raised the scheduled-job ceiling for their trial workspace to 500 requests a minute.' },
  { company: 'alpine', actor: 'piet', kind: 'note', at: '2026-10-02T11:45', title: 'added a note', content: 'IT prefers single sign-on through their existing identity provider. No on-premise requirement.' },
  { company: 'helios', actor: 'nadine', kind: 'deal', at: '2026-09-30T16:00', title: 'won Grid monitoring renewal' },
  { company: 'alpine', actor: 'tobias', kind: 'deal', at: '2026-09-28T09:10', title: 'moved Plant rollout, phase 2 to Negotiation' },
  { company: 'alpine', actor: 'nadine', kind: 'email', at: '2026-09-24T16:30', title: 'emailed Hannah Egger', subject: 'Usage report, Q3', content: 'Quarterly usage report attached, broken down by plant and shift.' },
  { company: 'alpine', actor: 'tobias', kind: 'note', at: '2026-09-22T08:30', title: 'added a note', content: 'Procurement signs off above €80,000 only with a second quote. The budget owner is the COO.' },
  { company: 'alpine', actor: 'tobias', kind: 'deal', at: '2026-09-19T14:00', title: 'created the deal Plant rollout, phase 2' }
];

/** Follow-ups, each on a company and assigned to a member of staff. */
const TASKS = [
  { company: 'alpine', title: 'Send the phase 2 order form to Hannah', due: '2026-10-09', assignee: 'tobias', done: false },
  { company: 'alpine', title: 'Book onboarding for the Graz plant', due: '2026-10-14', assignee: 'nadine', done: false },
  { company: 'alpine', title: 'Send the Q3 usage report', due: '2026-09-24', assignee: 'nadine', done: true },
  { company: 'bruckner', title: 'Confirm the migration window', due: '2026-10-08', assignee: 'ines', done: false },
  { company: 'kestrel', title: 'Follow up on the seat count', due: '2026-10-06', assignee: 'ines', done: false },
  { company: 'wexford', title: 'Prepare the security questionnaire', due: '2026-10-12', assignee: 'ines', done: false },
  { company: 'meridian', title: 'Share the data processing agreement', due: '2026-10-16', assignee: 'ines', done: false },
  { company: 'tessellate', title: 'Draft the co-marketing plan', due: '2026-10-21', assignee: 'ines', done: false }
];

/** Documents attached to companies. Sizes are in bytes. */
const FILES = [
  { id: 'f1', company: 'alpine', name: 'Phase 2 proposal.pdf', size: 482113, mime: 'application/pdf' },
  { id: 'f2', company: 'alpine', name: 'Master services agreement.pdf', size: 1203334, mime: 'application/pdf' },
  { id: 'f3', company: 'alpine', name: 'Plant inventory.xlsx', size: 88211, mime: 'application/vnd.ms-excel' },
  { id: 'f4', company: 'bruckner', name: 'Migration plan.xlsx', size: 74120, mime: 'application/vnd.ms-excel' }
];

/** The next scheduled meeting per company. */
const MEETINGS = {
  alpine: { title: 'Phase 2 contract walkthrough', at: '2026-10-13T10:00', with: ['tobias', 'piet'] },
  bruckner: { title: 'Cut-over rehearsal', at: '2026-10-15T14:00', with: ['piet', 'ines'] },
  wexford: { title: 'Security review kick-off', at: '2026-10-14T11:00', with: ['tobias'] }
};

/** @param {number} value Euros. @returns {string} Whole euros, the way pipeline values are read. */
function money(value) {
  return formatCurrency(value, 'EUR', { decimals: 0 });
}

/**
 * @param {Record<string, any>[]} records
 * @param {string} key A numeric field.
 * @returns {number} The field added up over the records.
 */
function sumOf(records, key) {
  return records.reduce((sum, record) => sum + (Number(record[key]) || 0), 0);
}

/** @param {string} iso Local date-time. @returns {string} "3 days ago", written from now. */
function ago(iso) {
  return formatRelativeTime(new Date(iso), { now: NOW });
}

/** @param {string} iso Local date. @returns {string} "13 Oct 2026". */
function day(iso) {
  return formatDate(new Date(`${iso.slice(0, 10)}T12:00:00`), DATE.year);
}

/** @param {Date} date @returns {string} The local date-time as the records store it: "2026-10-08T10:30". */
function stamp(date) {
  return formatDate(date, '%Y-%m-%dT%H:%M');
}

/**
 * Copies the fixtures into the state one mounted CRM edits, so a second mount starts clean.
 * @returns {Record<string, Record<string, any>[]>}
 */
function createStore() {
  const sources = [...COMPANIES, ...MORE_COMPANIES];
  return {
    companies: sources.map(({ id, name, domain, city, country, contact }) => {
      const facts = ACCOUNT_FACTS[id];
      return {
        ID: id, name, domain, city, country, contact, ...facts,
        categories: [...facts.categories], team: [...facts.team], favourite: id === 'alpine'
      };
    }),
    people: sources.map((entry) => ({
      ID: `p-${entry.id}`, name: entry.contact, email: entry.email, company: entry.id, role: ACCOUNT_FACTS[entry.id].role
    })),
    deals: DEALS.map((deal) => ({ ...deal })),
    memberships: MEMBERSHIPS.map(([list, company, stage], index) => ({ ID: index + 1, list, company, stage })),
    timeline: TIMELINE.map((entry, index) => ({ ID: index + 1, ...entry })),
    tasks: TASKS.map((task, index) => ({ ID: index + 1, ...task }))
  };
}

/**
 * @typedef {Object} Scope Owns the components drawn into one region, as the kit's `renderScope()`.
 * @property {<T extends {destroy: () => void}>(component: T) => T} own
 */

/**
 * A company's mark: its initials on a rounded square, tinted from its name by Avatar itself, so the
 * same company has the same colour on every screen.
 * @param {Scope} scope Owns the avatar.
 * @param {{name: string}} company
 * @param {number|'sm'|'md'|'lg'} [size] 20px beside a name in a row; `lg` heads a record page.
 * @returns {HTMLElement}
 */
function logo(scope, company, size = 20) {
  return scope.own(new Avatar(null, { name: company.name.replace(/\b(GmbH|AG)\b/g, ''), shape: 'rounded', size })).toElement();
}

/**
 * @param {Scope} scope Owns the avatar.
 * @param {string} name
 * @returns {HTMLElement} A person's name beside a small avatar, as the name of their record.
 */
function personLabel(scope, name) {
  return h('span', { class: 'person crm__person' },
    scope.own(new Avatar(null, { name, size: 20 })).toElement(),
    h('span', { class: 'person__name' }, name));
}

/**
 * Who owns a record, as an outlined pill: the person is the value, not a link or a status.
 * @param {Scope} scope Owns the avatar.
 * @param {string} id Staff id.
 * @returns {HTMLElement}
 */
function ownerPill(scope, id) {
  const member = person(id);
  if (!member) return h('span', { class: 'meta' }, 'Unassigned');
  return h('span', { class: 'crm__owner' },
    scope.own(new Avatar(null, { name: member.name, size: 16 })).toElement(),
    h('span', { class: 'person__name' }, member.name));
}

/**
 * @param {Scope} scope Owns the avatars.
 * @param {string[]} ids Staff ids.
 * @returns {HTMLElement} At most three overlapping faces and a count of the rest, named as a group.
 */
function avatarStack(scope, ids) {
  if (ids.length === 0) return h('span', { class: 'meta' }, '—');
  const names = ids.map((id) => person(id)?.name ?? id);
  return h('span', { class: 'crm__team', role: 'img', title: names.join(', '), ariaLabel: names.join(', ') },
    h('span', { class: 'avatar-stack' }, names.slice(0, 3).map((name) => scope.own(new Avatar(null, { name, size: 20 })).toElement())),
    ids.length > 3 ? h('span', { class: 'crm__more' }, `+${ids.length - 3}`) : null);
}

/**
 * A company's categories as tone chips. A table cell shows the first and counts the rest, so every
 * row keeps one line; the record page shows them all.
 * @param {string[]} values
 * @param {{limit?: number}} [options]
 * @returns {HTMLElement}
 */
function chips(values, { limit = Infinity } = {}) {
  const shown = values.slice(0, limit);
  const rest = values.length - shown.length;
  return h('span', { class: 'crm__chips', title: rest ? values.join(', ') : null },
    shown.map((label) => badge({ label, tone: CATEGORIES[label] ?? 'slate', size: 'sm' })),
    rest ? h('span', { class: 'crm__more' }, `+${rest}`,
      h('span', { class: 'visually-hidden' }, ` (${values.slice(limit).join(', ')})`)) : null);
}

/** @param {string} id Stage id. @returns {HTMLElement} The company's stage as a status badge. */
function stageBadge(id) {
  const stage = STAGES.find((entry) => entry.ID === id) ?? STAGES[0];
  return badge({ label: stage.name, kind: stage.tone, dot: true, size: 'sm' });
}

/** @param {string} id Deal stage id. @returns {HTMLElement} */
function dealBadge(id) {
  const stage = DEAL_STAGES.find((entry) => entry.id === id) ?? DEAL_STAGES[0];
  return badge({ label: stage.label, kind: stage.tone, size: 'sm' });
}

/**
 * Connection strength as four bars and a word. The word carries the meaning; the bars are a cue.
 * @param {number} level 1 (very weak) to 5 (very strong).
 * @returns {HTMLElement}
 */
function strengthMeter(level) {
  return h('span', { class: 'crm__strength', dataset: { level: String(level) } },
    h('span', { class: 'crm__bars', ariaHidden: 'true' }, [1, 2, 3, 4].map(() => h('span', {}))),
    STRENGTH[level - 1] ?? '—');
}

/**
 * @param {Array<string|Record<string, string>>} entries Labels, stages, or deal stages.
 * @returns {{value: string, label: string}[]} Options for table editors and filters.
 */
function choices(entries) {
  return entries.map((entry) => (typeof entry === 'string'
    ? { value: entry, label: entry }
    : { value: entry.id ?? entry.ID, label: entry.label ?? entry.name }));
}

/** @returns {{value: string, label: string}[]} Staff as options. */
function staffOptions() {
  return PEOPLE.map((member) => ({ value: member.id, label: member.name }));
}

/**
 * Table settings for a whole-euro amount, edited as plain text so the editor fits a narrow cell.
 * @param {string} width
 * @returns {Record<string, unknown>}
 */
function amountColumn(width) {
  return {
    width, type: 'currency', currency: 'EUR', decimals: 0, editable: 'text',
    format: (value) => (value ? String(value) : ''),
    parse: (raw) => parseNumber(raw) ?? 0,
    validate: (value) => value >= 0 || 'Enter an amount in euros.'
  };
}

/**
 * Keeps records whose values satisfy a `FilterPanel` value: option lists, ranges, and text.
 * @param {Record<string, any>} record
 * @param {Record<string, any>} filters
 * @returns {boolean}
 */
function matchesFilters(record, filters) {
  return Object.entries(filters).every(([key, wanted]) => {
    const actual = record[key];
    if (Array.isArray(wanted)) {
      return Array.isArray(actual) ? actual.some((value) => wanted.includes(value)) : wanted.includes(actual);
    }
    if (wanted && typeof wanted === 'object') {
      return (wanted.from == null || actual >= wanted.from) && (wanted.to == null || actual <= wanted.to);
    }
    return String(actual ?? '').toLowerCase().includes(String(wanted).toLowerCase());
  });
}

/**
 * Puts each field's type glyph in front of its column heading. The glyph is decoration, so it is
 * hidden from assistive technology. Runs again whenever the table rebuilds its columns.
 * @param {TableView} view
 * @param {Record<string, string>} glyphs Icon name per field id.
 * @returns {void}
 */
function decorateHeadings(view, glyphs) {
  const table = view.getTable();
  const labels = table.el.querySelectorAll('thead th:not(.zx-table__selection-header) .zx-table__header-label');
  table.getVisibleColumns().forEach((id, index) => {
    const label = labels[index];
    if (label && glyphs[id] && !label.querySelector('.zx-icon')) {
      label.prepend(icon(glyphs[id], { size: 13, class: 'crm__heading-icon' }));
    }
  });
}

export default {
  title: 'CRM',
  category: 'Sales',
  blurb: 'Companies in an editable spreadsheet with saved views, live record pages, and deals on a board by stage.',
  components: [
    'TableView', 'KanbanView', 'FilterPanel', 'ListToolbar', 'SortControl', 'Tabbox', 'Select',
    'TagPicker', 'NumberField', 'Datebox', 'ActivityList', 'StatTile', 'FileList', 'Form', 'Avatar',
    'Launcher', 'MenuButton', 'Dropdown', 'Sheet', 'Dialog', 'InlineLoading', 'ProgressBar',
    'Breadcrumb', 'Message', 'AppSidebar', 'AccountMenu'
  ],

  /**
   * Mounts the CRM: navigation, a record collection or a company page, and its details.
   * @param {HTMLElement} container Gallery stage.
   * @param {import('./kit.js').LayoutContext} [context]
   * @returns {void}
   */
  mount(container, context) {
    context = layoutContext(context);
    const keep = disposer(context);
    const store = createStore();
    // Components drawn for one rendering of a region are released when it is drawn again.
    const screen = renderScope(context);     // the screen in the main pane and its details
    const viewParts = renderScope(context);  // a collection's table or board, and its cells
    const summary = renderScope(context);    // a company page's header and highlights
    const dialogs = renderScope(context);    // the open form dialog
    /** What the main pane shows: a collection (`companies`, `list:renewals`, …) or a company. */
    let route = { kind: 'collection', id: 'companies' };
    let launcher = null;
    let focusSearch = () => {};
    let createRecord = () => {};

    const go = (id) => () => navigate({ kind: 'collection', id });
    const destinations = keep(new AppSidebar(null, { label: 'CRM', collapsible: false, items: destinationItems() }));
    const records = keep(new AppSidebar(null, {
      label: 'Records',
      collapsible: false,
      items: Object.entries(RECORD_TYPES).map(([id, type]) => ({
        id, label: type.title, icon: iconTile(type.icon, type.tone), invoke: go(id)
      }))
    }));
    const lists = keep(new AppSidebar(null, {
      label: 'Lists',
      collapsible: false,
      items: LISTS.map((list) => ({ id: `list:${list.id}`, label: list.name, icon: 'table-list', invoke: go(`list:${list.id}`) }))
    }));
    const account = keep(new AccountMenu(null, {
      account: { name: person(ME).name, secondary: person(ME).role, status: 'online', statusLabel: 'Online' },
      items: [{ label: 'Profile', value: 'profile', icon: 'user' }, { label: 'Settings', value: 'settings', icon: 'gear' }, '-', { label: 'Sign out', value: 'signout' }],
      placement: 'top-start',
      onselect: ({ detail }) => notify(unavailable(detail.item.label), 'info')
    }));

    const main = h('section', { class: 'shell__main', ariaLabel: 'Workspace' });
    const aside = h('aside', { class: 'shell__aside shell__aside--wide', ariaLabel: 'Record details', hidden: true });
    const root = h('div', { class: 'crm shell' },
      h('div', { class: 'shell__nav' },
        workspaceHeader(),
        h('div', { class: 'nav-action' }, navSearch({ label: 'Search', onclick: () => openLauncher() })),
        h('div', { class: 'shell__body' },
          destinations.toElement(),
          sectionLabel('Records'),
          records.toElement(),
          sectionLabel('Lists'),
          lists.toElement()),
        h('div', { class: 'shell__footer' }, account.toElement())),
      main, aside);
    // Narrow, the navigation and a company's details become drawers; every page's header carries
    // the way to the navigation, and a company page the way to its details.
    const shell = adaptiveShell(root, context, { asideLabel: 'Show record details' });
    const notify = toaster(context, root);

    shortcuts(root, {
      'Mod+k': () => openLauncher(),
      '/': () => focusSearch(),
      n: () => createRecord(),
      // Escape leaves a company page; anywhere else it is not ours, so it reaches the host.
      Escape: () => (route.kind === 'company' ? navigate(route.from) : false)
    }, context);
    navigate(route);
    container.append(root);

    /** @returns {Record<string, any>[]} The workspace-wide destinations, with the open-task count. */
    function destinationItems() {
      const open = store.tasks.filter((task) => task.assignee === ME && !task.done).length;
      return [
        { id: 'notifications', label: 'Notifications', icon: 'bell-regular', badge: 3, invoke: go('notifications') },
        { id: 'tasks', label: 'Tasks', icon: 'square-check-regular', badge: open || undefined, invoke: go('tasks') },
        { id: 'notes', label: 'Notes', icon: 'file-lines', invoke: go('notes') },
        { id: 'emails', label: 'Emails', icon: 'envelope-regular', invoke: go('emails') },
        { id: 'reports', label: 'Reports', icon: 'chart-column', invoke: go('reports') }
      ];
    }

    /**
     * Shows a route in the main pane and marks its item in the navigation.
     * @param {{kind: 'collection'|'company', id: string, from?: {kind: string, id: string}}} next
     * @returns {void}
     */
    function navigate(next) {
      // A destination chosen in a drawer, or a page left from inside itself, takes the focus to the
      // new page's heading rather than dropping it with the old page.
      const active = document.activeElement;
      const moveFocus = root.dataset.navOpen === 'true' || root.dataset.asideOpen === 'true'
        || main.contains(active) || aside.contains(active) || active === root || !root.contains(active);
      // A task ticked off on a page that redraws itself keeps the focus on its checkbox.
      const task = active instanceof HTMLElement ? active.dataset.task : undefined;
      shell.closeNav();
      shell.toggleAside(false);
      route = next;
      viewParts.reset();
      summary.reset();
      screen.reset();
      focusSearch = () => {};
      createRecord = () => {};
      aside.hidden = next.kind !== 'company';
      aside.replaceChildren();
      for (const sidebar of [destinations, records, lists]) sidebar.setActive(next.kind === 'company' ? next.from.id : next.id);
      if (next.kind === 'company') showCompany(next.id);
      else if (collection(next.id)) showCollection(collection(next.id));
      else showFeed(next.id);
      if (!moveFocus || context.preview) return;
      const checkbox = task ? main.querySelector(`[data-task="${task}"]`) : null;
      if (checkbox instanceof HTMLElement) checkbox.focus();
      else focusHeading();
    }

    /** Puts the focus on the main pane's first heading: the page title or the company's name. @returns {void} */
    function focusHeading() {
      const heading = main.querySelector('h1, h2');
      if (!(heading instanceof HTMLElement)) return;
      if (!heading.hasAttribute('tabindex')) heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    }

    /** @param {string} id Company id. @returns {void} Opens it, remembering where from. */
    function openCompany(id) {
      navigate({ kind: 'company', id, from: route.kind === 'collection' ? route : route.from });
    }

    /** @param {string} id @returns {Record<string, any>|undefined} */
    function companyById(id) {
      return store.companies.find((entry) => entry.ID === id);
    }

    /** Opens the command palette over companies, people, deals, and commands. @returns {void} */
    function openLauncher() {
      if (context.preview) return;
      launcher ??= keep(new Launcher(null, { shortcut: false, label: 'Search the CRM', placeholder: 'Search companies, people, deals, or commands' }));
      // A command runs once the palette has closed and handed the focus back, so the page it opens
      // can take the focus to its heading.
      const afterClose = (item) => ({ ...item, invoke: () => later(context, item.invoke, 0) });
      launcher.setItems([
        { id: 'new', label: 'New company', group: 'Commands', icon: 'plus', invoke: () => { go('companies')(); newCompany(); } },
        { id: 'deals', label: 'Go to deals', group: 'Commands', icon: 'handshake', invoke: go('deals') },
        { id: 'tasks', label: 'Go to my tasks', group: 'Commands', icon: 'square-check-regular', invoke: go('tasks') },
        ...store.companies.map((entry) => ({
          id: entry.ID, label: entry.name, description: entry.domain, group: 'Companies', kind: 'record',
          icon: 'building', keywords: [entry.tier, ...entry.categories].filter(Boolean), invoke: () => openCompany(entry.ID)
        })),
        ...store.people.map((entry) => ({
          id: entry.ID, label: entry.name, description: companyById(entry.company)?.name, group: 'People',
          kind: 'record', icon: 'user', invoke: () => openCompany(entry.company)
        })),
        ...store.deals.map((deal) => ({
          id: deal.ID, label: deal.name, description: `${companyById(deal.company)?.name ?? ''} · ${money(deal.value)}`,
          group: 'Deals', kind: 'record', icon: 'handshake', invoke: () => openCompany(deal.company)
        }))
      ].map(afterClose));
      launcher.open();
    }

    /**
     * A dialog around a `Form`, for the short create-and-send flows. Closing it destroys both.
     * @param {{title: string, submit: string, fields: Record<string, any>,
     *   onsubmit: (values: Record<string, any>) => void}} options
     * @returns {void}
     */
    function formDialog({ title, submit, fields, onsubmit }) {
      if (context.preview) return;
      const form = dialogs.own(new Form(null, { fieldsets: [{ fields }] }));
      const dialog = dialogs.own(new Dialog(null, {
        title, size: 'sm', content: h('div', { class: 'form-sheet' }, form.toElement()),
        buttons: [{ label: 'Cancel', action: 'cancel' }, { label: submit, kind: 'primary', action: () => form.submit() }]
      }));
      form.on('submit', ({ detail }) => { dialog.close(); onsubmit(detail.values); });
      dialog.on('close', () => dialogs.reset());
      dialog.open();
    }

    /** Creates a company from a short form, then opens its page. @returns {void} */
    function newCompany() {
      formDialog({
        title: 'New company',
        submit: 'Create company',
        fields: {
          name: { type: 'text', label: 'Name', required: true, placeholder: 'Company name' },
          domain: { type: 'text', label: 'Domain', placeholder: 'company.example' },
          stage: { type: 'zxselect', label: 'Stage', value: 'lead', props: { preset: 'status', items: STAGES } },
          owner: { type: 'zxselect', label: 'Owner', value: ME, props: { items: staffOptions(), valueKey: 'value', labelKey: 'label' } }
        },
        onsubmit: (values) => {
          const ID = `c-${Date.now()}`;
          store.companies.unshift({
            ID, name: values.name, domain: values.domain || `${values.name.toLowerCase().replace(/[^a-z0-9]+/g, '')}.example`,
            city: '', country: '', contact: '', role: '', stage: values.stage ?? 'lead', tier: null, categories: [], team: [ME],
            strength: 1, arr: 0, last: stamp(NOW), owner: values.owner ?? ME, employees: null, renewal: null, favourite: false
          });
          notify(`${values.name} created.`);
          openCompany(ID);
        }
      });
    }

    /* ------------------------------------------------------------- collections -- */

    /**
     * Describes a record collection: its fields, saved views, filters, the total its footer sums,
     * and how it draws as a board — `card` lists the icon, label, and value of each line on a card,
     * and a line without a value is left out.
     * @param {string} id
     * @returns {Record<string, any>|null}
     */
    function collection(id) {
      const companyLink = (entry) => (entry ? h('span', { class: 'crm__company' }, logo(viewParts, entry),
        h('button', { type: 'button', class: 'crm__record-link', onclick: () => openCompany(entry.ID) }, entry.name)) : '—');
      const owner = {
        id: 'owner', label: 'Owner', glyph: 'circle-user', sortable: true, render: (record) => ownerPill(viewParts, record.owner),
        sortValue: (record) => person(record.owner)?.name ?? '', view: { table: { width: '136px', editable: 'select', options: staffOptions() } }
      };
      const last = {
        id: 'last', label: 'Last contact', glyph: 'clock-regular', sortable: true, render: (record) => ago(record.last),
        view: { table: { width: '120px' } }
      };
      const arrLine = (record) => ['euro-sign', 'ARR', record.arr ? money(record.arr) : null];
      const readOnly = (field) => ({ ...field, view: { table: { ...field.view.table, editable: false } } });
      const byId = (records) => (recordId, changes) => Object.assign(records().find((entry) => entry.ID === recordId), changes);
      const removeFrom = (key) => (ids) => { store[key] = store[key].filter((entry) => !ids.includes(entry.ID)); };

      if (id === 'companies') {
        return {
          id, ...RECORD_TYPES.companies, noun: ['company', 'companies'], newLabel: 'New company',
          records: () => store.companies,
          sum: { id: 'arr', label: 'Total ARR' },
          views: [
            { id: 'all', label: 'All companies', match: () => true },
            { id: 'customers', label: 'Customers', match: (record) => record.stage === 'customer', sort: { id: 'arr', dir: 'desc' } },
            {
              id: 'prospects', label: 'Prospects',
              match: (record) => ['lead', 'prospect'].includes(record.stage),
              sort: { id: 'last', dir: 'desc' }
            }
          ],
          hidden: ['stage'],
          fields: [
            {
              id: 'name', label: 'Company', glyph: 'building', sortable: true,
              render: companyLink,
              view: { table: { width: '184px', popin: false } }
            },
            {
              id: 'domain', label: 'Domain', glyph: 'globe', sortable: true,
              view: {
                table: {
                  width: '154px', editable: 'text',
                  validate: (value) => /^[\w-]+(\.[\w-]+)+$/.test(String(value).trim()) || 'Enter a domain such as company.example.'
                }
              }
            },
            {
              id: 'tier', label: 'Tier', glyph: 'layer-group', sortable: true,
              sortValue: (record) => TIERS.indexOf(record.tier),
              view: { table: { width: '100px', editable: 'select', options: choices(TIERS) } }
            },
            {
              id: 'categories', label: 'Categories', glyph: 'tags',
              render: (record) => chips(record.categories, { limit: 1 }),
              view: { table: { width: '130px', editor: categoryEditor } }
            },
            {
              id: 'stage', label: 'Stage', glyph: 'circle-half-stroke', sortable: true, render: (record) => stageBadge(record.stage),
              sortValue: (record) => STAGES.findIndex((stage) => stage.ID === record.stage),
              view: { table: { width: '130px', editable: 'select', options: choices(STAGES) } }
            },
            {
              id: 'team', label: 'Team', glyph: 'user-group',
              render: (record) => avatarStack(viewParts, record.team),
              view: { table: { width: '84px' } }
            },
            {
              id: 'strength', label: 'Connection', glyph: 'signal', sortable: true, render: (record) => strengthMeter(record.strength),
              view: { table: { width: '120px', editable: 'select', options: STRENGTH.map((label, index) => ({ value: index + 1, label })) } }
            },
            {
              id: 'arr', label: 'ARR', glyph: 'euro-sign', sortable: true,
              render: (record) => (record.arr ? money(record.arr) : '—'),
              view: { table: amountColumn('92px') }
            },
            last,
            owner
          ],
          filters: {
            stage: { type: 'select', label: 'Stage', options: choices(STAGES) },
            owner: { type: 'select', label: 'Owner', options: staffOptions() },
            tier: { type: 'select', label: 'Tier', options: TIERS },
            categories: { type: 'select', label: 'Categories', options: Object.keys(CATEGORIES) },
            arr: { type: 'float:range', label: 'ARR (€)', min: 0 }
          },
          board: {
            columnBy: 'stage', columns: choices(STAGES).map(({ value, label }) => ({ id: value, label })),
            title: (record) => record.name, subtitle: (record) => record.domain,
            card: (record) => [arrLine(record), ['layer-group', 'Tier', record.tier]]
          },
          create: newCompany,
          open: (record) => openCompany(record.ID),
          update: byId(() => store.companies),
          remove: removeFrom('companies')
        };
      }
      if (id === 'people') {
        const rows = () => store.people.map((entry) => {
          const company = companyById(entry.company);
          return company && { ...entry, companyName: company.name, strength: company.strength, last: company.last, owner: company.owner };
        }).filter(Boolean);
        return {
          id, ...RECORD_TYPES.people, noun: ['person', 'people'], newLabel: 'New person',
          records: rows,
          sum: null,
          views: [
            { id: 'all', label: 'All people', match: () => true },
            { id: 'customers', label: 'At customers', match: (record) => companyById(record.company)?.stage === 'customer' }
          ],
          hidden: [],
          fields: [
            {
              id: 'name', label: 'Name', glyph: 'user', sortable: true, view: { table: { width: '190px', popin: false } },
              render: (record) => personLabel(viewParts, record.name)
            },
            {
              id: 'email', label: 'Email', glyph: 'envelope-regular', sortable: true,
              view: { table: { width: '230px', editable: 'text' } }
            },
            {
              id: 'company', label: 'Company', glyph: 'building', sortable: true,
              render: (record) => companyLink(companyById(record.company)),
              sortValue: (record) => record.companyName,
              view: { table: { width: '200px' } }
            },
            { id: 'role', label: 'Role', glyph: 'briefcase', sortable: true, view: { table: { width: '170px', editable: 'text' } } },
            {
              id: 'strength', label: 'Connection', glyph: 'signal', sortable: true,
              render: (record) => strengthMeter(record.strength),
              view: { table: { width: '130px' } }
            },
            readOnly(owner)
          ],
          filters: { owner: { type: 'select', label: 'Account owner', options: staffOptions() } },
          board: null,
          create: () => notify('People are added from an email or from a company page.', 'info'),
          open: (record) => openCompany(record.company),
          update: byId(() => store.people),
          remove: removeFrom('people')
        };
      }
      if (id === 'deals') {
        return {
          id, ...RECORD_TYPES.deals, noun: ['deal', 'deals'], newLabel: 'New deal', shape: 'kanban',
          records: () => store.deals,
          sum: { id: 'value', label: 'Total value' },
          views: [
            { id: 'all', label: 'All deals', match: () => true },
            { id: 'mine', label: 'My deals', match: (record) => record.owner === ME },
            { id: 'closing', label: 'Closing this month', match: (record) => record.close.startsWith(TODAY.slice(0, 7)) }
          ],
          hidden: [],
          fields: [
            {
              id: 'name', label: 'Deal', glyph: 'handshake', sortable: true,
              view: { table: { width: '240px', popin: false, editable: 'text' } }
            },
            {
              id: 'company', label: 'Company', glyph: 'building', sortable: true,
              render: (record) => companyLink(companyById(record.company)),
              sortValue: (record) => companyById(record.company)?.name,
              view: { table: { width: '220px' } }
            },
            {
              id: 'stage', label: 'Stage', glyph: 'circle-half-stroke', sortable: true,
              render: (record) => dealBadge(record.stage),
              sortValue: (record) => DEAL_STAGES.findIndex((stage) => stage.id === record.stage),
              view: { table: { width: '140px', editable: 'select', options: choices(DEAL_STAGES) } }
            },
            {
              id: 'value', label: 'Value', glyph: 'euro-sign', sortable: true,
              render: (record) => money(record.value),
              view: { table: amountColumn('120px') }
            },
            {
              id: 'close', label: 'Close date', glyph: 'calendar-days', sortable: true,
              render: (record) => day(record.close),
              view: { table: { width: '130px' } }
            },
            owner
          ],
          filters: {
            stage: { type: 'select', label: 'Stage', options: choices(DEAL_STAGES) },
            owner: { type: 'select', label: 'Owner', options: staffOptions() },
            value: { type: 'float:range', label: 'Value (€)', min: 0 }
          },
          board: {
            columnBy: 'stage', columns: DEAL_STAGES, title: (record) => record.name, subtitle: (record) => companyById(record.company)?.name,
            card: (record) => [['euro-sign', 'Value', money(record.value)], ['calendar-days', 'Close date', day(record.close)]],
            preview: (record) => logo(viewParts, companyById(record.company) ?? { name: '?' }, 'sm')
          },
          create: () => notify('Deals start from a company page, with its contacts filled in.', 'info'),
          open: (record) => openCompany(record.company),
          update: byId(() => store.deals),
          remove: removeFrom('deals')
        };
      }
      const list = LISTS.find((entry) => `list:${entry.id}` === id);
      if (!list) return null;
      const entries = () => store.memberships.filter((entry) => entry.list === list.id).map((entry) => {
        const company = companyById(entry.company);
        return company && { ...entry, name: company.name, arr: company.arr, owner: company.owner, last: company.last };
      }).filter(Boolean);
      return {
        id, title: list.name, icon: 'table-list', tone: 'slate', noun: ['entry', 'entries'], newLabel: 'Add company', shape: 'kanban',
        records: entries,
        sum: { id: 'arr', label: 'Total ARR' },
        views: [{ id: 'all', label: 'All entries', match: () => true }],
        hidden: [],
        fields: [
          {
            id: 'name', label: 'Company', glyph: 'building', sortable: true,
            render: (record) => companyLink(companyById(record.company)),
            view: { table: { width: '240px', popin: false } }
          },
          {
            id: 'stage', label: 'Stage', glyph: 'circle-half-stroke', sortable: true,
            render: (record) => badge({ label: record.stage, size: 'sm' }),
            view: { table: { width: '150px', editable: 'select', options: choices(list.stages) } }
          },
          {
            id: 'arr', label: 'ARR', glyph: 'euro-sign', sortable: true,
            render: (record) => (record.arr ? money(record.arr) : '—'),
            view: { table: { width: '120px', type: 'currency' } }
          },
          last,
          readOnly(owner)
        ],
        filters: { owner: { type: 'select', label: 'Account owner', options: staffOptions() } },
        board: {
          columnBy: 'stage', columns: choices(list.stages).map(({ value, label }) => ({ id: value, label })), title: (record) => record.name,
          subtitle: (record) => companyById(record.company)?.domain,
          card: (record) => [arrLine(record), ['clock-regular', 'Last contact', ago(record.last)]],
          preview: (record) => logo(viewParts, record, 'sm')
        },
        create: () => notify('Select companies in the table and use Add to list.', 'info'),
        open: (record) => openCompany(record.company),
        update: byId(() => store.memberships),
        remove: removeFrom('memberships')
      };
    }

    /**
     * Edits a company's categories inside its table cell. Picking or removing one commits.
     * @param {Record<string, any>} record
     * @param {{commit: (value: unknown) => void}} api
     * @returns {TagPicker}
     */
    function categoryEditor(record, api) {
      const picker = new TagPicker(null, {
        items: Object.keys(CATEGORIES).map((label) => ({ ID: label, name: label })),
        values: record.categories,
        placeholder: 'Add',
        onchange: ({ detail }) => api.commit([...detail.values])
      });
      // The table focuses the first control in an editor, which is a tag's remove button here.
      queueMicrotask(() => { picker.focus(); picker.open(); });
      return picker;
    }

    /**
     * Renders a collection under one view bar — the saved views on the left; search, sort, filters,
     * fields, and the table or board switch on the right — above a table or board, a footer that
     * counts and sums what is shown, and a bulk bar while rows are selected.
     * @param {Record<string, any>} definition From `collection()`.
     * @returns {void}
     */
    function showCollection(definition) {
      const [singular, plural] = definition.noun;
      const glyphs = Object.fromEntries(definition.fields.map((field) => [field.id, field.glyph]));
      let shape = definition.shape ?? 'table';
      let views = [...definition.views];
      let viewId = views[0].id;
      let query = '';
      let filters = {};
      let rows = [];
      /** @type {TableView|KanbanView|null} */
      let view = null;
      let tableState = null;

      const host = h('div', { class: 'shell__body crm__grid' });
      const toolbar = screen.own(new ListToolbar(null, {
        search: { placeholder: `Search ${plural}` },
        tools: [
          { id: 'search', icon: 'magnifying-glass', title: `Search ${plural}` },
          { id: 'sort', icon: 'arrow-down-wide-short', label: 'Sort' },
          { id: 'filter', icon: 'filter', label: 'Filter' }
        ],
        views: definition.board ? [{ id: 'table', label: 'Table', icon: 'table' }, { id: 'kanban', label: 'Board', icon: 'table-columns' }] : [],
        view: shape,
        onsearch: ({ detail }) => { query = detail.value; refresh(); },
        onaction: ({ detail }) => {
          if (detail.id === 'search') openSearch();
          if (detail.id === 'filter') filterSheet.open();
        },
        onviewchange: ({ detail }) => { shape = detail.view; mountView(); }
      }));
      const sorter = screen.own(new SortControl(null, {
        fields: definition.fields.filter((field) => field.sortable).map(({ id, label }) => ({ id, label })),
        onchange: ({ detail }) => view?.setSort(detail.value.id, detail.value.dir)
      }));
      screen.own(new Dropdown(toolbar.getTool('sort'), { content: stack({ gap: 2 }, sorter.toElement()), placement: 'bottom-end' }));
      const filterPanel = screen.own(new FilterPanel(null, {
        fields: definition.filters,
        mode: 'live',
        onapply: ({ detail }) => {
          filters = detail.value;
          toolbar.setBadge('filter', Object.keys(filters).length || null);
          refresh();
        }
      }));
      const filterSheet = screen.own(new Sheet(null, {
        side: 'end', size: 360, title: `Filter ${plural}`, content: filterPanel.toElement(),
        buttons: [{ label: 'Clear all', action: () => filterPanel.clear() }, { label: 'Done', kind: 'primary', action: 'close' }]
      }));

      const selected = h('span', { class: 'bulk-bar__count' });
      const bulk = h('div', { class: 'bulk-bar', role: 'region', ariaLabel: 'Bulk actions', hidden: true },
        selected,
        definition.id === 'companies' ? screen.own(new MenuButton(null, {
          label: 'Add to list', icon: 'list-ul', items: LISTS.map((list) => ({ label: list.name, value: list.id })),
          onselect: ({ detail }) => addToList(detail.value)
        })).toElement() : null,
        definition.fields.find((field) => field.id === 'owner')?.view.table.editable ? screen.own(new MenuButton(null, {
          label: 'Assign owner', icon: 'circle-user', items: staffOptions().map(({ value, label }) => ({ label, value })),
          onselect: ({ detail }) => assignOwner(detail.value)
        })).toElement() : null,
        button({ label: 'Export', icon: 'file-export', onclick: exportSelection }),
        button({ label: 'Delete', icon: 'trash-can', kind: 'danger', onclick: deleteSelection }),
        iconButton('xmark', 'Clear selection', () => view?.clearSelection()));

      // The saved views are one radio group: Tab reaches the current view, the arrow keys move
      // between views, and Delete removes one saved here.
      const viewGroup = h('div', { class: 'crm__views', role: 'radiogroup', ariaLabel: 'Saved views', onkeydown: viewKeys });
      const isSearchField = (target) => target instanceof HTMLInputElement && target.type === 'search';
      // The search field waits behind its icon (or /), and folds back into it once it is left empty.
      const viewbar = h('div', {
        class: 'crm__viewbar',
        dataset: { search: 'closed' },
        onfocusout: ({ target }) => { if (isSearchField(target) && !toolbar.getSearch()) viewbar.dataset.search = 'closed'; },
        onkeydown: (event) => {
          if (event.key !== 'Escape' || !isSearchField(event.target) || toolbar.getSearch()) return;
          event.preventDefault();
          viewbar.dataset.search = 'closed';
          toolbar.getTool('search').focus();
        }
      }, viewGroup, iconButton('plus', 'Save as new view', saveView), toolbar.toElement());
      // The footer is also the live region that tells a screen reader what a search left.
      const footer = h('div', { class: 'shell__footer crm__footer', role: 'status' });

      main.replaceChildren(
        paneHeader({
          size: 'page',
          leading: [shell.navToggle(), iconTile(definition.icon, definition.tone)],
          title: definition.title,
          actions: [
            definition.id === 'companies' ? button({
              label: 'Import', icon: 'cloud-arrow-up', onclick: () => notify(unavailable('Importing'), 'info')
            }) : null,
            button({
              label: definition.newLabel, icon: 'plus', kind: 'primary', shortcut: { label: 'N', keys: 'N' }, onclick: () => definition.create()
            })
          ]
        }),
        h('div', { class: 'crm__collection' }, viewbar, host, footer, bulk));
      focusSearch = openSearch;
      createRecord = () => definition.create();
      mountView();

      /** @returns {Record<string, any>[]} The records the active view, search, and filters let through. */
      function visible() {
        const saved = views.find((entry) => entry.id === viewId);
        const needle = query.trim().toLowerCase();
        return definition.records().filter((record) => saved.match(record) && matchesFilters(record, filters)
          && (!needle || Object.values(record).join(' ').toLowerCase().includes(needle)));
      }

      /**
       * Builds the table or the board. The table's columns and sort are kept aside while the
       * board shows, so switching back restores them.
       * @returns {void}
       */
      function mountView() {
        if (view instanceof TableView) tableState = view.getViewState();
        viewParts.reset();
        rows = visible();
        view = viewParts.own(shape === 'kanban' ? createBoard() : createTable());
        if (view instanceof TableView && tableState) view.setViewState(tableState);
        host.replaceChildren(view.toElement());
        host.dataset.shape = shape;
        syncBulk([]);
        updateCounts();
        syncSorter();
        afterColumnsChange();
      }

      /** @returns {TableView} The spreadsheet: inline cell editing, row checkboxes, sticky header. */
      function createTable() {
        return new TableView(null, {
          fields: definition.fields,
          data: rows,
          recordId: 'ID',
          selectable: 'multi',
          hiddenFields: definition.hidden,
          sort: views.find((entry) => entry.id === viewId).sort ?? null,
          fieldControls: { label: 'Fields', target: toolbar.getToolsElement() },
          emptyText: () => emptyState({
            icon: 'filter', size: 'sm', title: `No ${plural} match`, description: 'Change the search or the filters to see more.',
            actions: [{ label: 'Clear filters', onclick: clearFilters }]
          }),
          table: {
            // The pane is the frame: no box round the table, hairlines between its rows.
            variant: 'plain',
            stickyHeader: true,
            responsive: 'sm',
            zebra: false,
            editMode: 'cell',
            oneditcommit: ({ detail }) => {
              definition.update(detail.id, detail.changes);
              // A record the edit moved out of this view leaves it; anything else the table drew.
              queueMicrotask(() => (visible().length === rows.length ? updateCounts() : refresh()));
            }
          },
          onselectionchange: ({ detail }) => syncBulk(detail.ids),
          onsortchange: () => syncSorter(),
          onstatechange: () => afterColumnsChange()
        });
      }

      /** @returns {KanbanView} The board: one tray per stage, headed by its count and total. */
      function createBoard() {
        const board = definition.board;
        return new KanbanView(null, {
          fields: definition.fields,
          data: rows,
          recordId: 'ID',
          columnBy: board.columnBy,
          columns: board.columns,
          titleField: board.title,
          preview: board.preview ?? ((record) => logo(viewParts, record, 'sm')),
          moveMode: 'external',
          fieldControls: false,
          renderCard: ({ record }) => boardCard(record),
          renderColumnHeader: ({ column, count }) => h('span', { class: 'crm__column-head' },
            h('span', { class: 'crm__column-label' }, column.label),
            h('span', { class: 'crm__count' }, String(count)),
            columnTotal(column.id)),
          onrecordmove: ({ detail }) => {
            for (const recordId of detail.ids) definition.update(recordId, { [board.columnBy]: detail.to.column });
            refresh();
          },
          onrecordclick: ({ detail }) => definition.open(detail.record)
        });
      }

      /** @param {string} columnId @returns {HTMLElement|null} A tray's total, left out while it is nothing. */
      function columnTotal(columnId) {
        const total = sumOf(rows.filter((record) => String(record[definition.board.columnBy]) === columnId), definition.sum.id);
        return total ? h('span', { class: 'crm__column-total' }, money(total)) : null;
      }

      /**
       * A card on the board: its title, a quiet subtitle, and one line per value — an icon, then
       * the value, its label kept for screen readers. A line with nothing to say is left out.
       * @param {Record<string, any>} record
       * @returns {HTMLElement}
       */
      function boardCard(record) {
        const { title, subtitle, card } = definition.board;
        const owner = person(record.owner);
        const line = (mark, label, value) => h('li', {}, mark, h('span', { class: 'visually-hidden' }, `${label}: `), value);
        return h('div', { class: 'crm__card' },
          h('h3', { class: 'crm__card-title' }, title(record)),
          h('p', { class: 'crm__card-subtitle' }, subtitle(record)),
          h('ul', { class: 'crm__card-lines' },
            card(record).filter(([, , value]) => value).map(([glyph, label, value]) => line(icon(glyph, { size: 14 }), label, value)),
            owner ? line(viewParts.own(new Avatar(null, { name: owner.name, size: 16 })).toElement(), 'Owner', owner.name) : null));
      }

      /** Re-reads the records into the current view and updates every count. @returns {void} */
      function refresh() {
        rows = visible();
        view?.setData(rows);
        updateCounts();
      }

      /** Counts every saved view, and counts and sums what the current one shows. @returns {void} */
      function updateCounts() {
        renderViews();
        const { sum } = definition;
        footer.replaceChildren(h('span', {}, `${formatNumber(rows.length)} ${rows.length === 1 ? singular : plural}`),
          ...(sum ? [h('span', { class: 'crm__footer-sum' }, h('span', { class: 'meta' }, sum.label), money(sumOf(rows, sum.id)))] : []));
      }

      /** Draws the saved views and their counts; the focus stays on the current one. @returns {void} */
      function renderViews() {
        const focused = viewGroup.contains(document.activeElement);
        viewGroup.replaceChildren(...views.map((entry) => h('button', {
          type: 'button', role: 'radio', class: 'crm__view',
          ariaChecked: String(entry.id === viewId), tabindex: entry.id === viewId ? '0' : '-1',
          onclick: (event) => (event.target.closest('.crm__view-remove') ? removeView(entry.id) : selectView(entry.id))
        },
        entry.label,
        h('span', { class: 'crm__view-count' }, formatNumber(definition.records().filter(entry.match).length)),
        // A span rather than a button inside the button; Delete is its keyboard equivalent.
        entry.removable ? h('span', { class: 'crm__view-remove', ariaHidden: 'true', title: 'Remove view' }, icon('xmark', { size: 12 })) : null)));
        if (focused) viewGroup.querySelector('[aria-checked="true"]')?.focus();
      }

      /** @param {KeyboardEvent} event @returns {void} Arrow keys change the view; Delete removes a saved one. */
      function viewKeys(event) {
        const index = views.findIndex((entry) => entry.id === viewId);
        const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
        if (step) selectView(views[(index + step + views.length) % views.length].id);
        else if (event.key === 'Delete' && views[index].removable) removeView(viewId);
        else return;
        event.preventDefault();
      }

      /** @param {string} id @returns {void} Shows a saved view: its records, and its columns or sort. */
      function selectView(id) {
        viewId = id;
        const saved = views.find((entry) => entry.id === id);
        refresh();
        if (saved.state && view instanceof TableView) view.setViewState(saved.state);
        else if (saved.sort) view.setSort(saved.sort.id, saved.sort.dir);
        syncSorter();
        afterColumnsChange();
      }

      /** @param {string} id @returns {void} Removes a saved view; the one before it shows if it was showing. */
      function removeView(id) {
        const index = views.findIndex((entry) => entry.id === id);
        views = views.filter((entry) => entry.id !== id);
        if (id === viewId) selectView(views[Math.max(0, index - 1)].id);
        else renderViews();
      }

      /** Unfolds the search field in place of its icon and puts the caret in it. @returns {void} */
      function openSearch() {
        viewbar.dataset.search = 'open';
        toolbar.focusSearch();
      }

      /** Keeps the sort menu showing the view's current sort. @returns {void} */
      function syncSorter() {
        const sort = view?.getSort();
        if (sort) sorter.setValue(sort, { silent: true });
      }

      /** Redraws the heading glyphs once the table has rebuilt its columns. @returns {void} */
      function afterColumnsChange() {
        if (view instanceof TableView) decorateHeadings(view, glyphs);
      }

      /** @param {unknown[]} ids @returns {void} Shows the bulk bar while anything is selected. */
      function syncBulk(ids) {
        bulk.hidden = ids.length === 0;
        selected.textContent = `${ids.length} selected`;
      }

      /** Clears search and filters. @returns {void} */
      function clearFilters() {
        query = '';
        toolbar.setSearch('', { silent: true });
        viewbar.dataset.search = 'closed';
        filterPanel.clear();
      }

      /** @param {string} listId @returns {void} Adds the selected companies to a list. */
      function addToList(listId) {
        const list = LISTS.find((entry) => entry.id === listId);
        const inList = (company) => store.memberships.some((entry) => entry.list === listId && entry.company === company);
        const ids = view.getSelectionIds().filter((company) => !inList(company));
        for (const company of ids) {
          store.memberships.push({ ID: Date.now() + store.memberships.length, list: listId, company, stage: list.stages[0] });
        }
        notify(`${ids.length} ${ids.length === 1 ? singular : plural} added to ${list.name}.`);
        view.clearSelection();
      }

      /** @param {string} staff Staff id. @returns {void} Assigns the selection to one owner. */
      function assignOwner(staff) {
        const ids = view.getSelectionIds();
        for (const recordId of ids) definition.update(recordId, { owner: staff });
        refresh();
        notify(`${ids.length} ${ids.length === 1 ? singular : plural} assigned to ${person(staff).name}.`);
      }

      /** Downloads the selected records as CSV. @returns {void} */
      function exportSelection() {
        const columns = definition.fields.map(({ id, label }) => ({ id, label, value: (record) => [record[id]].flat().join(', ') }));
        downloadBlob(`${definition.title.toLowerCase().replace(/\s+/g, '-')}.csv`, toCsv(view.getSelection(), columns), { type: 'text/csv' });
      }

      /** Deletes the selected records once confirmed. @returns {Promise<void>} */
      async function deleteSelection() {
        const ids = view.getSelectionIds();
        const noun = ids.length === 1 ? singular : plural;
        const confirmed = await Dialog.confirm({
          title: `Delete ${ids.length} ${noun}?`, message: 'Their activity, notes, and files go with them. This cannot be undone.',
          okLabel: 'Delete', danger: true
        });
        if (!confirmed) return;
        definition.remove(ids);
        refresh();
        notify(`${ids.length} ${noun} deleted.`);
      }

      /** Saves the current search, filters, columns, and sort as a new view. @returns {void} */
      function saveView() {
        formDialog({
          title: 'Save view',
          submit: 'Save view',
          fields: { name: { type: 'text', label: 'Name', value: 'My view', required: true } },
          onsubmit: ({ name }) => {
            const label = name.trim();
            const snapshot = { needle: query.trim().toLowerCase(), filters: { ...filters } };
            const saved = {
              id: `view-${Date.now()}`, label, removable: true, state: view instanceof TableView ? view.getViewState() : null,
              match: (record) => matchesFilters(record, snapshot.filters)
                && (!snapshot.needle || Object.values(record).join(' ').toLowerCase().includes(snapshot.needle))
            };
            views.push(saved);
            clearFilters();
            selectView(saved.id);
            notify(`View “${label}” saved.`);
          }
        });
      }
    }

    /* ------------------------------------------------------------ record page -- */

    /**
     * Shows one company: its header, tabbed content, and the editable details aside.
     * @param {string} id Company id.
     * @returns {void}
     */
    function showCompany(id) {
      const record = companyById(id);
      const back = route.from;
      const backTitle = collection(back.id)?.title ?? 'Companies';
      const timeline = () => store.timeline.filter((entry) => entry.company === id);
      const tasks = () => store.tasks.filter((task) => task.company === id);
      const files = FILES.filter((file) => file.company === id);

      const crumbs = screen.own(new Breadcrumb(null, {
        items: [{ name: 'back', label: backTitle }, { name: id, label: record.name }],
        onselect: ({ detail }) => { if (detail.name === 'back') navigate(back); }
      }));
      const favourite = iconButton('star', 'Favourite', () => {
        record.favourite = !record.favourite;
        syncFavourite();
        notify(record.favourite ? `${record.name} added to favourites.` : `${record.name} removed from favourites.`, 'info');
      });
      favourite.classList.add('star-toggle');
      syncFavourite();
      const listMenu = screen.own(new MenuButton(null, {
        label: 'Add to list', icon: 'list-ul', items: LISTS.map((list) => ({ label: list.name, value: list.id })),
        onselect: ({ detail }) => {
          const list = LISTS.find((entry) => entry.id === detail.value);
          if (!store.memberships.some((entry) => entry.list === list.id && entry.company === id)) {
            store.memberships.push({ ID: Date.now(), list: list.id, company: id, stage: list.stages[0] });
          }
          renderMemberships();
          notify(`${record.name} added to ${list.name}.`);
        }
      }));
      const more = screen.own(new MenuButton(iconButton('ellipsis', 'More actions'), {
        kind: 'ghost', placement: 'bottom-end',
        items: [{ label: 'Copy link', value: 'copy', icon: 'link' }, '-', { label: 'Delete company', value: 'delete', icon: 'trash-can', danger: true }],
        onselect: async ({ detail }) => {
          if (detail.value === 'copy') { notify('Link copied.', 'info'); return; }
          const confirmed = await Dialog.confirm({
            title: `Delete ${record.name}?`, message: 'Its activity, notes, and files go with it.', okLabel: 'Delete company', danger: true
          });
          if (!confirmed) return;
          store.companies = store.companies.filter((entry) => entry.ID !== id);
          notify(`${record.name} deleted.`);
          navigate(back);
        }
      }));

      const hero = h('div', { class: 'crm__hero' });
      const highlights = h('div', { class: 'crm__highlights' });
      const notes = h('div', { class: 'crm__stack' });
      const taskList = h('div', { class: 'crm__stack' });
      const memberships = h('div', { class: 'crm__stack' });
      const activity = screen.own(new ActivityList(null, { label: 'Activity', groupBy: 'month', emptyText: 'Nothing has happened here yet.' }));
      const recent = screen.own(new ActivityList(null, { label: 'Recent activity', emptyText: 'Nothing has happened here yet.' }));
      const emails = timeline().filter((entry) => entry.kind === 'email');
      const tab = (...children) => h('div', { class: 'crm__tab' }, ...children);

      const tabs = screen.own(new Tabbox(null, {
        variant: 'line',
        label: `${record.name} record`,
        tabs: [
          {
            name: 'overview', title: 'Overview',
            content: tab(highlights, h('section', { class: 'surface' }, h('h3', { class: 'surface__title' }, 'Recent activity'), recent.toElement()))
          },
          { name: 'activity', title: 'Activity', content: tab(activity.toElement()) },
          {
            name: 'emails', title: 'Emails', content: tab(h('div', { class: 'surface crm__rows' }, emails.length ? emails.map((entry) => h('button', {
              type: 'button', class: 'list-row', onclick: () => notify(unavailable('Reading email'), 'info')
            },
            h('span', { class: 'list-row__top' }, h('span', { class: 'list-row__title' }, entry.subject), h('span', { class: 'list-row__meta' }, listTime(entry.at))),
            h('span', { class: 'list-row__snippet' }, `${person(entry.actor)?.name}: ${entry.content}`)))
              : emptyState({
                icon: 'envelope-regular', size: 'sm', title: 'No emails yet',
                description: 'Emails with this company appear here once a mailbox is connected.'
              })))
          },
          { name: 'notes', title: 'Notes', content: tab(notes) },
          { name: 'tasks', title: 'Tasks', content: tab(taskList) },
          { name: 'files', title: 'Files', content: tab(screen.own(new FileList(null, { label: 'Files', items: files, emptyText: 'No files attached yet.' })).toElement()) }
        ]
      }));

      main.replaceChildren(
        paneHeader({
          leading: [shell.navToggle(), iconButton('arrow-left', `Back to ${backTitle.toLowerCase()}`, () => navigate(back)), crumbs.toElement()],
          actions: [
            favourite, listMenu.toElement(), button({ label: 'Compose email', icon: 'envelope-regular', kind: 'primary', onclick: composeEmail }),
            more.toElement(), shell.asideToggle()
          ]
        }),
        h('div', { class: 'shell__body shell__body--padded crm__record' }, hero, tabs.toElement()));
      renderSummary();
      renderTimeline();
      renderTasks();
      renderDetails();

      /** Presses the favourite toggle; the kit fills its outline star while it is on. @returns {void} */
      function syncFavourite() {
        favourite.setAttribute('aria-pressed', String(record.favourite));
      }

      /** Redraws everything that shows the record's attributes: its header and highlights. @returns {void} */
      function renderSummary() {
        summary.reset();
        renderHero();
        renderHighlights();
      }

      /** Header block: mark, name, domain, location, tier, stage, and categories. @returns {void} */
      function renderHero() {
        hero.replaceChildren(logo(summary, record, 'lg'), h('div', { class: 'crm__hero-text' },
          h('h2', { class: 'record-title' }, record.name),
          h('p', { class: 'crm__hero-meta' },
            h('span', { class: 'crm__fact' }, icon('globe', { size: 14 }), record.domain),
            record.city ? h('span', { class: 'crm__fact' }, icon('location-dot', { size: 14 }), `${record.city}, ${record.country}`) : null,
            record.tier ? h('span', { class: 'crm__fact' }, icon('layer-group', { size: 14 }), record.tier) : null,
            stageBadge(record.stage),
            record.categories.length ? chips(record.categories) : null)));
        crumbs.setItems([{ name: 'back', label: backTitle }, { name: id, label: record.name }]);
      }

      /** The four facts a seller checks first. @returns {void} */
      function renderHighlights() {
        const meeting = MEETINGS[id];
        const open = store.deals.filter((deal) => deal.company === id && deal.stage !== 'won');
        // The anatomy of the StatTile beside them: a quiet sentence-case label, its icon at the end.
        const card = (glyph, label, ...body) => h('section', { class: 'surface crm__highlight' },
          h('div', { class: 'crm__highlight-head' },
            h('h3', { class: 'crm__highlight-label' }, label), icon(glyph, { class: 'crm__highlight-icon' })),
          ...body);
        highlights.replaceChildren(
          meeting
            ? card('calendar-days', 'Next meeting',
              h('p', { class: 'crm__highlight-title' }, meeting.title),
              h('p', { class: 'meta' }, `${formatDate(new Date(meeting.at), DATE.dateTime)} · ${ago(meeting.at)}`),
              avatarStack(summary, meeting.with))
            : card('calendar-days', 'Next meeting',
              h('p', { class: 'meta' }, 'Nothing scheduled.'),
              button({ label: 'Schedule', size: 'sm', icon: 'calendar-days', onclick: () => notify('A scheduling link was copied.', 'info') })),
          card('handshake', 'Open deals',
            h('p', { class: 'crm__highlight-value' }, money(sumOf(open, 'value'))),
            open.length
              ? h('ul', { class: 'crm__deals' }, open.map((deal) => h('li', {},
                h('span', { class: 'crm__deal-name' }, deal.name), dealBadge(deal.stage), h('span', { class: 'num' }, money(deal.value)))))
              : h('p', { class: 'meta' }, 'No open deals.')),
          card('signal', 'Connection strength',
            h('p', { class: 'crm__highlight-value' }, strengthMeter(record.strength)),
            h('p', { class: 'meta' }, record.team.length ? `Strongest through ${person(record.team[0])?.name}` : 'Nobody has met them yet.')),
          summary.own(new StatTile(null, {
            label: 'Annual recurring revenue', value: record.arr, format: money, icon: 'euro-sign',
            delta: record.arr ? 0.12 : null, deltaFormat: 'percent', deltaKind: 'positive', deltaLabel: 'vs. last year'
          })).toElement());
      }

      /** Activity, recent activity, notes, and every tab count. @returns {void} */
      function renderTimeline() {
        const entries = timeline().map((entry) => {
          const actor = person(entry.actor)?.name ?? '';
          return {
            id: entry.ID, actor, avatar: { name: actor }, title: entry.title, kind: entry.kind,
            content: entry.subject ? h('p', {}, h('strong', {}, entry.subject), ` — ${entry.content}`) : entry.content ?? null,
            timestamp: new Date(entry.at).toISOString(), timeLabel: ago(entry.at), month: formatDate(new Date(entry.at), '%B %Y')
          };
        });
        activity.setItems(entries);
        recent.setItems(entries.slice(0, 3));
        notes.replaceChildren(
          h('div', {}, button({ label: 'New note', icon: 'pen-to-square', onclick: addNote })),
          ...timeline().filter((entry) => entry.kind === 'note').map((entry) => h('article', { class: 'surface' },
            h('p', { class: 'crm__note' }, entry.content), h('span', { class: 'meta' }, `${person(entry.actor)?.name} · ${ago(entry.at)}`))));
        const counts = { activity: entries.length, emails: emails.length, notes: entries.filter((entry) => entry.kind === 'note').length, files: files.length };
        for (const [name, count] of Object.entries(counts)) tabs.setBadge(name, String(count));
      }

      /** The tasks tab: follow-ups that tick off in place, and the count of open ones. @returns {void} */
      function renderTasks() {
        const entries = tasks();
        const countOpen = () => tabs.setBadge('tasks', String(tasks().filter((task) => !task.done).length));
        countOpen();
        taskList.replaceChildren(...(entries.length ? entries.map((task) => taskRow(task, countOpen, false))
          : [emptyState({ icon: 'square-check-regular', size: 'sm', title: 'No tasks', description: 'Follow-ups for this company appear here.' })]));
      }

      /** Writes a note and puts it on the timeline. @returns {void} */
      function addNote() {
        formDialog({
          title: 'New note',
          submit: 'Add note',
          fields: { text: { type: 'textarea', label: `Note on ${record.name}`, required: true, props: { rows: 5 } } },
          onsubmit: ({ text }) => {
            store.timeline.unshift({ ID: Date.now(), company: id, actor: ME, kind: 'note', at: stamp(NOW), title: 'added a note', content: text.trim() });
            renderTimeline();
            notify('Note added.');
          }
        });
      }

      /** Writes to the company's contact and logs the email on the timeline. @returns {void} */
      function composeEmail() {
        const contact = store.people.find((entry) => entry.company === id);
        formDialog({
          title: `Email ${contact?.name ?? record.name}`,
          submit: 'Send',
          fields: {
            to: { type: 'text', label: 'To', value: contact?.email ?? '', required: true },
            subject: { type: 'text', label: 'Subject', value: `Following up — ${record.name}`, required: true },
            body: { type: 'textarea', label: 'Message', placeholder: contact ? `Hi ${contact.name.split(' ')[0]},` : 'Hello,', props: { rows: 6 } }
          },
          onsubmit: (values) => {
            store.timeline.unshift({
              ID: Date.now(), company: id, actor: ME, kind: 'email', at: stamp(NOW),
              title: `emailed ${contact?.name ?? values.to}`, subject: values.subject, content: values.body || '(no message)'
            });
            emails.unshift(store.timeline[0]);
            record.last = stamp(NOW);
            renderTimeline();
            notify('Email sent.');
          }
        });
      }

      /**
       * The aside: a plain list of properties, each in its matching Zx input — quiet until it is
       * pointed at — then the lists the company is in.
       * @returns {void}
       */
      function renderDetails() {
        const status = screen.own(new InlineLoading(null, { status: 'inactive', size: 'sm' }));
        let cancelSaved = () => {};
        screen.own({ destroy: () => cancelSaved() });
        const save = (changes) => {
          Object.assign(record, changes);
          renderSummary();
          if (context.preview) return;
          status.set('active', 'Saving…');
          cancelSaved();
          cancelSaved = later(context, () => status.set('success', 'Saved'), 500);
        };
        const text = (key, label) => h('input', {
          type: 'text', value: record[key] ?? '', ariaLabel: label, onchange: (event) => save({ [key]: event.target.value.trim() })
        });
        const tags = (key, items, placeholder) => screen.own(new TagPicker(null, {
          items, values: record[key], placeholder, onchange: ({ detail }) => save({ [key]: [...detail.values] })
        })).toElement();
        aside.replaceChildren(
          paneHeader({ title: 'Record details', actions: status.toElement() }),
          h('div', { class: 'shell__body' },
            h('section', { class: 'panel-block', ariaLabel: 'Attributes' }, propList([
              ['Name', text('name', 'Name')],
              ['Domain', text('domain', 'Domain')],
              ['Stage', screen.own(Select.status(null, {
                items: STAGES, value: record.stage, label: 'Stage', onchange: ({ detail }) => save({ stage: detail.value })
              })).toElement()],
              ['Tier', screen.own(new Select(null, {
                items: choices(TIERS), valueKey: 'value', labelKey: 'label', value: record.tier, label: 'Tier', placeholder: 'None',
                onchange: ({ detail }) => save({ tier: detail.value })
              })).toElement()],
              ['Categories', tags('categories', Object.keys(CATEGORIES).map((label) => ({ ID: label, name: label })), 'Add category')],
              ['Owner', screen.own(new Select(null, {
                items: staffOptions(), valueKey: 'value', labelKey: 'label', value: record.owner, label: 'Owner', filter: 'local',
                renderValueAdornment: (item) => screen.own(new Avatar(null, { name: item.label, size: 20 })).toElement(),
                onchange: ({ detail }) => save({ owner: detail.value })
              })).toElement()],
              ['Team', tags('team', PEOPLE.map((member) => ({ ID: member.id, name: member.name })), 'Add people')],
              ['Connection', screen.own(new Select(null, {
                items: STRENGTH.map((label, index) => ({ value: index + 1, label })), valueKey: 'value', labelKey: 'label',
                value: record.strength, label: 'Connection strength', onchange: ({ detail }) => save({ strength: detail.value })
              })).toElement()],
              ['ARR', screen.own(new NumberField(null, {
                value: record.arr, min: 0, step: 1000, unit: '€', group: true, label: 'Annual recurring revenue',
                onchange: ({ detail }) => save({ arr: detail.value ?? 0 })
              })).toElement()],
              ['Employees', screen.own(new NumberField(null, {
                value: record.employees, min: 0, step: 10, group: true, label: 'Employees',
                onchange: ({ detail }) => save({ employees: detail.value })
              })).toElement()],
              ['Renewal', screen.own(new Datebox(null, {
                value: record.renewal ? new Date(`${record.renewal}T12:00:00`) : null, placeholder: 'None',
                onchange: ({ detail }) => save({ renewal: detail.date ? formatDate(detail.date, '%Y-%m-%d') : null })
              })).toElement()],
              // Read-only, so it lines up with the text inside the quiet fields above it.
              ['Last contact', h('span', { class: 'crm__prop-text' }, ago(record.last))]
            ])),
            panelBlock('Lists', memberships)));
        renderMemberships();
      }

      /** The lists this company is in, each with its stage there. @returns {void} */
      function renderMemberships() {
        const entries = store.memberships.filter((entry) => entry.company === id);
        memberships.replaceChildren(...(entries.length ? entries.map((entry) => {
          const list = LISTS.find((candidate) => candidate.id === entry.list);
          return h('div', { class: 'crm__membership' },
            h('button', { type: 'button', class: 'crm__record-link', onclick: () => navigate({ kind: 'collection', id: `list:${list.id}` }) },
              icon('table-list', { size: 13, class: 'crm__title-icon' }), list.name),
            badge({ label: entry.stage, size: 'sm', kind: entry.stage === list.stages.at(-1) ? 'success' : 'neutral' }));
        }) : [h('span', { class: 'meta' }, 'Not in any list yet.')]));
      }
    }

    /**
     * One follow-up with a checkbox that ticks it off in place.
     * @param {Record<string, any>} task
     * @param {() => void} onchange Updates whatever counts or groups the task.
     * @param {boolean} [withCompany] Names the company under the title, outside its own page.
     * @returns {HTMLElement}
     */
    function taskRow(task, onchange, withCompany = true) {
      const due = h('span', { class: 'crm__task-due' }, day(task.due));
      const row = h('label', { class: 'crm__task' },
        h('input', {
          type: 'checkbox', checked: task.done, dataset: { task: String(task.ID) }, onchange: (event) => {
            task.done = event.target.checked;
            sync();
            destinations.setItems(destinationItems());
            onchange();
          }
        }),
        h('span', { class: 'crm__task-title' }, task.title, withCompany ? h('span', { class: 'meta' }, companyById(task.company)?.name) : null),
        due,
        screen.own(new Avatar(null, { name: person(task.assignee)?.name ?? '', size: 'sm' })).toElement());
      const sync = () => {
        row.dataset.done = String(task.done);
        due.dataset.overdue = String(!task.done && task.due < TODAY);
      };
      sync();
      return row;
    }

    /* ------------------------------------------------------------------ feeds -- */

    /**
     * The workspace-wide destinations: tasks, notifications, notes, emails, and reports.
     * @param {string} id
     * @returns {void}
     */
    function showFeed(id) {
      const titles = {
        notifications: ['Notifications', 'bell-regular'], tasks: ['My tasks', 'square-check-regular'], notes: ['Notes', 'file-lines'],
        emails: ['Emails', 'envelope-regular'], reports: ['Reports', 'chart-column']
      };
      const [title, glyph] = titles[id];
      const body = h('div', { class: 'shell__body shell__body--padded' });
      main.replaceChildren(paneHeader({ size: 'page', leading: [shell.navToggle(), icon(glyph, { class: 'crm__title-icon' })], title }), body);
      if (id === 'tasks') {
        const mine = store.tasks.filter((task) => task.assignee === ME);
        const groups = [
          ['Overdue', (task) => !task.done && task.due < TODAY], ['Today', (task) => !task.done && task.due === TODAY],
          ['Upcoming', (task) => !task.done && task.due > TODAY], ['Done', (task) => task.done]
        ];
        body.replaceChildren(h('div', { class: 'crm__stack crm__feed' }, groups.map(([label, test]) => {
          const entries = mine.filter(test);
          return entries.length ? h('section', { class: 'crm__stack' }, h('h3', { class: 'panel-block__title' }, `${label} · ${entries.length}`),
            ...entries.map((task) => taskRow(task, () => navigate(route)))) : null;
        })));
        return;
      }
      if (id === 'reports') {
        const open = store.deals.filter((deal) => deal.stage !== 'won');
        const total = (deals) => deals.reduce((sum, deal) => sum + deal.value, 0);
        const tiles = [
          { label: 'Open pipeline', value: total(open), format: money, icon: 'handshake' },
          { label: 'Won this quarter', value: total(store.deals.filter((deal) => deal.stage === 'won')), format: money, icon: 'flag-checkered', kind: 'success' },
          {
            label: 'Customer ARR', value: store.companies.reduce((sum, entry) => sum + entry.arr, 0), format: money,
            icon: 'euro-sign', delta: 0.08, deltaFormat: 'percent', deltaKind: 'positive', deltaLabel: 'vs. Q2'
          },
          { label: 'Open deals', value: open.length, icon: 'chart-column' }
        ];
        body.replaceChildren(h('div', { class: 'crm__stack' },
          h('div', { class: 'crm__tiles' }, tiles.map((tile) => screen.own(new StatTile(null, tile)).toElement())),
          h('section', { class: 'surface' }, h('h3', { class: 'surface__title' }, 'Pipeline by stage'),
            DEAL_STAGES.map((stage) => screen.own(new ProgressBar(null, {
              label: stage.label, value: total(store.deals.filter((deal) => deal.stage === stage.id)), max: total(store.deals),
              status: stage.id === 'won' ? 'success' : 'active', formatValue: (value) => money(value)
            })).toElement()))));
        return;
      }
      const kinds = { notes: ['note'], emails: ['email'], notifications: ['email', 'meeting', 'deal'] }[id];
      body.classList.remove('shell__body--padded');
      body.replaceChildren(...store.timeline.filter((entry) => kinds.includes(entry.kind)).map((entry) => h('button', {
        type: 'button', class: 'list-row', onclick: () => openCompany(entry.company)
      },
      h('span', { class: 'list-row__top' },
        screen.own(new Avatar(null, { name: person(entry.actor)?.name ?? '', size: 'sm' })).toElement(),
        h('span', { class: 'list-row__title' }, `${person(entry.actor)?.name} ${entry.subject ? `· ${entry.subject}` : entry.title}`),
        h('span', { class: 'list-row__meta' }, listTime(entry.at))),
      h('span', { class: 'list-row__snippet' }, `${companyById(entry.company)?.name}${entry.content ? ` · ${entry.content}` : ''}`))));
    }
  }
};
