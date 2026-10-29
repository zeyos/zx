import {
  ActivityList, Avatar, Breadcrumb, CardView, Datebox, Dialog, FileList, Form, InlineLoading, KanbanView,
  Launcher, MenuButton, NumberField, ProgressBar, Select, StatTile, Tabbox, TableView, TagPicker, badge, button,
  downloadBlob, emptyState, formatCurrency, formatDate, formatNumber, formatRelativeTime, h, icon,
  parseNumber, toCsv
} from '../../src/index.js';
import {
  DATE, adaptiveShell, disposer, iconButton, iconTile, layoutContext, later, listTime, paneHeader, panelBlock,
  propList, renderScope, shortcuts, suiteNav, toaster, unavailable
} from './kit.js';
import { COMPANIES, ME, NOW, PEOPLE, TODAY, person } from './fixtures.js';
import { axisChoices, columnHeader, createOverview } from './overview.js';
import { bucketOf, filterExpression, nodeMatches } from './overview-filters.js';

/** The kinds of record, each recognised by its tinted tile in the navigation and on its page. */
const RECORD_TYPES = {
  companies: { title: 'Companies', icon: 'building', tone: 'blue' },
  people: { title: 'People', icon: 'users', tone: 'teal' },
  deals: { title: 'Deals', icon: 'handshake', tone: 'orange' }
};

/** Where a company stands with ACME, in pipeline order. Shaped for `Select.status()`. */
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
 * The id of the bucket a record without a value groups, filters, and lays out on the board under
 * — an owner nobody holds, a company without a tier — so that no record drops out of a grouping.
 * The record keeps its empty value; the overview reads it into this bucket and writes a move into
 * it back as null.
 */
const NONE = 'none';

/**
 * @param {string} [label]
 * @returns {import('./overview.js').OverviewGroupAxis} Every member of staff, then Unassigned: the
 *   owners as a grouping, and as board columns or lanes.
 */
function ownerAxis(label = 'Owner') {
  return { label, buckets: PEOPLE.map((member) => ({ id: member.id, label: member.name })), other: { id: NONE, label: 'Unassigned' } };
}

/** @returns {import('./overview.js').OverviewGroupAxis} The tiers, then No tier. */
function tierAxis() {
  return { label: 'Tier', buckets: TIERS.map((tier) => ({ id: tier, label: tier })), other: { id: NONE, label: 'No tier' } };
}

/**
 * @param {string} label Field name on the chip.
 * @returns {import('./overview.js').OverviewFilterField} The owner as the filter tests it — any
 *   member of staff, or nobody, as the grouping shows them; a chip lists first names.
 */
function ownerFilter(label) {
  return {
    id: 'owner', label, type: 'enum', icon: 'circle-user', operators: ['anyOf', 'noneOf', 'eq', 'neq'], defaultOperator: 'anyOf',
    choices: axisChoices(ownerAxis(label)).map((choice) => ({ ...choice, short: person(String(choice.value))?.name.split(' ')[0] }))
  };
}

/**
 * @param {{value: string, label: string}[]} stages
 * @returns {import('./overview.js').OverviewFilterField} A stage as the filter tests it.
 */
function stageFilter(stages) {
  return { id: 'stage', label: 'Stage', type: 'enum', icon: 'circle-half-stroke', operators: ['eq', 'neq', 'anyOf', 'noneOf'], choices: stages };
}

/**
 * @param {string} id A whole-euro field.
 * @param {string} label
 * @returns {import('./overview.js').OverviewFilterField} An amount as the filter tests it.
 */
function amountFilter(id, label) {
  return {
    id, label, type: 'money', icon: 'euro-sign', operators: ['gte', 'lte', 'between'],
    input: { unit: '€', min: 0, step: 1000, group: true }
  };
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
    'TableView', 'CardView', 'KanbanView', 'ListToolbar', 'Filter', 'ViewSettings', 'Pagination', 'SortControl',
    'Tabbox', 'Select', 'TagPicker', 'NumberField', 'Datebox', 'ActivityList', 'StatTile', 'FileList', 'Form',
    'Avatar', 'Launcher', 'MenuButton', 'Dropdown', 'Sheet', 'Dialog', 'InlineLoading', 'ProgressBar',
    'Breadcrumb', 'Message', 'AppSidebar', 'ModuleBar', 'AccountMenu'
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
    // The suite's navigation: CRM's own menu beside every other module of the suite.
    const nav = suiteNav(context, { module: 'crm', menu: menuItems(), active: route.id, onsearch: () => openLauncher() });

    const main = h('section', { class: 'shell__main crm__main', ariaLabel: 'Workspace' });
    const aside = h('aside', { class: 'shell__aside shell__aside--wide', ariaLabel: 'Record details', hidden: true });
    const root = h('div', { class: 'crm shell' }, nav.column, main, aside);
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

    /** @returns {Record<string, any>[]} CRM's menu: its destinations, then its records and lists. */
    function menuItems() {
      return [
        ...destinationItems(),
        { section: true, label: 'Records', children: Object.entries(RECORD_TYPES).map(([id, type]) => ({
          id, label: type.title, icon: iconTile(type.icon, type.tone), invoke: go(id)
        })) },
        { section: true, label: 'Lists', children: LISTS.map((list) => ({
          id: `list:${list.id}`, label: list.name, icon: 'table-list', invoke: go(`list:${list.id}`)
        })) }
      ];
    }

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
      nav.setActive(next.kind === 'company' ? next.from.id : next.id);
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
     * Describes a record collection: its fields, saved views, what the filter can test and the
     * records group by, the shapes it offers, the total it sums (`sum.text` words it after the count), and how it draws as cards and as
     * a board. A field's `text` is how it reads in plain words (search, CSV, a board card where
     * its cell is a link, which `link` marks); a board card shows every field View settings shows
     * there, `lines` overriding how one reads.
     * @param {string} id
     * @returns {Record<string, any>|null}
     */
    function collection(id) {
      const companyLink = (entry) => (entry ? h('span', { class: 'crm__company' }, logo(viewParts, entry),
        h('button', { type: 'button', class: 'crm__record-link', onclick: () => openCompany(entry.ID) }, entry.name)) : '—');
      const owner = {
        id: 'owner', label: 'Owner', type: 'entity', glyph: 'circle-user', sortable: true, render: (record) => ownerPill(viewParts, record.owner),
        text: (record) => person(record.owner)?.name ?? '',
        sortValue: (record) => person(record.owner)?.name ?? '', view: { table: { width: '136px', editable: 'select', options: staffOptions() } }
      };
      const last = {
        id: 'last', label: 'Last contact', type: 'datetime', glyph: 'clock-regular', sortable: true, render: (record) => ago(record.last),
        view: { table: { width: '120px' } }
      };
      // On a card a company without ARR leaves the line out rather than showing a dash.
      const arrLine = (record) => (record.arr ? money(record.arr) : null);
      const readOnly = (field) => ({ ...field, view: { table: { ...field.view.table, editable: false } } });
      // Membership ids are numbers and the views hand ids back as text, so ids compare as text.
      const same = (entry, recordId) => String(entry.ID) === String(recordId);
      const byId = (records) => (recordId, changes) => Object.assign(records().find((entry) => same(entry, recordId)) ?? {}, changes);
      const removeFrom = (key) => (ids) => { store[key] = store[key].filter((entry) => !ids.some((recordId) => same(entry, recordId))); };
      const statusAxis = (entries) => ({
        label: 'Stage', buckets: entries.map(({ id: bucket, label, tone = null }) => ({ id: bucket, label, tone }))
      });

      if (id === 'companies') {
        return {
          id, ...RECORD_TYPES.companies, noun: ['company', 'companies'], newLabel: 'New company',
          records: () => store.companies,
          none: {
            title: 'No companies yet', description: 'Add your first company, or import them from a spreadsheet.',
            actions: [{ label: 'New company', onclick: () => newCompany() }]
          },
          sum: { id: 'arr', text: (total) => ` · ${money(total)} ARR` },
          views: [
            { id: 'all', label: 'All companies', match: () => true },
            { id: 'customers', label: 'Customers', match: (record) => record.stage === 'customer', sort: { id: 'arr', dir: 'desc' } },
            {
              id: 'prospects', label: 'Prospects',
              match: (record) => ['lead', 'prospect'].includes(record.stage),
              sort: { id: 'last', dir: 'desc' }
            }
          ],
          // A company is a natural card — its logo tile, its name, and a few facts — so the
          // spreadsheet comes with cards and with the pipeline board by stage.
          shapes: ['table', 'cards', 'board'],
          sort: { id: 'name', dir: 'asc' },
          visible: {
            table: ['name', 'domain', 'tier', 'categories', 'team', 'strength', 'arr', 'last', 'owner'],
            cards: ['stage', 'tier', 'arr', 'owner'],
            board: ['arr', 'tier', 'owner']
          },
          fields: [
            {
              id: 'name', label: 'Company', type: 'text', locked: true, glyph: 'building', sortable: true, link: true,
              render: companyLink,
              view: { table: { width: '184px', popin: false } }
            },
            {
              id: 'domain', label: 'Domain', type: 'url', groupable: false, glyph: 'globe', sortable: true,
              view: {
                table: {
                  width: '154px', editable: 'text',
                  validate: (value) => /^[\w-]+(\.[\w-]+)+$/.test(String(value).trim()) || 'Enter a domain such as company.example.'
                }
              }
            },
            {
              id: 'tier', label: 'Tier', type: 'select', glyph: 'layer-group', sortable: true,
              render: (record) => record.tier || '—',
              text: (record) => record.tier || '',
              sortValue: (record) => TIERS.indexOf(record.tier),
              view: { table: { width: '100px', editable: 'select', options: choices(TIERS) } }
            },
            {
              id: 'categories', label: 'Categories', type: 'tags', glyph: 'tags', text: (record) => record.categories.join(', '),
              render: (record) => chips(record.categories, { limit: 1 }),
              view: { table: { width: '130px', editor: categoryEditor } }
            },
            {
              id: 'stage', label: 'Stage', type: 'status', glyph: 'circle-half-stroke', sortable: true, render: (record) => stageBadge(record.stage),
              text: (record) => STAGES.find((stage) => stage.ID === record.stage)?.name ?? '',
              sortValue: (record) => STAGES.findIndex((stage) => stage.ID === record.stage),
              view: { table: { width: '130px', editable: 'select', options: choices(STAGES) } }
            },
            {
              id: 'team', label: 'Team', type: 'entity', groupable: false, glyph: 'user-group',
              text: (record) => record.team.map((member) => person(member)?.name ?? member).join(', '),
              render: (record) => avatarStack(viewParts, record.team),
              view: { table: { width: '84px' } }
            },
            {
              id: 'strength', label: 'Connection', type: 'rating', glyph: 'signal', sortable: true, render: (record) => strengthMeter(record.strength),
              text: (record) => STRENGTH[record.strength - 1] ?? '',
              view: { table: { width: '120px', editable: 'select', options: STRENGTH.map((label, index) => ({ value: index + 1, label })) } }
            },
            {
              id: 'arr', label: 'ARR', type: 'money', glyph: 'euro-sign', sortable: true,
              render: (record) => (record.arr ? money(record.arr) : '—'),
              view: { table: amountColumn('92px') }
            },
            last,
            owner
          ],
          filterFields: [
            stageFilter(choices(STAGES)),
            ownerFilter('Owner'),
            {
              id: 'tier', label: 'Tier', type: 'enum', icon: 'layer-group', operators: ['eq', 'neq', 'anyOf', 'noneOf'],
              choices: axisChoices(tierAxis())
            },
            {
              id: 'categories', label: 'Categories', type: 'tags', icon: 'tags',
              operators: ['containsAny', 'containsAll', 'containsNone', 'isEmpty'], choices: choices(Object.keys(CATEGORIES))
            },
            amountFilter('arr', 'ARR')
          ],
          groups: {
            stage: statusAxis(STAGES.map((stage) => ({ id: stage.ID, label: stage.name, tone: stage.tone }))),
            owner: ownerAxis(),
            tier: tierAxis()
          },
          cards: {
            subtitle: (record) => record.domain,
            preview: (record) => logo(viewParts, record, 'sm')
          },
          board: {
            columnBy: 'stage',
            title: (record) => record.name, subtitle: (record) => record.domain,
            lines: { arr: arrLine }
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
          none: { title: 'No people yet', description: 'People are added from an email or from a company page.' },
          sum: null,
          views: [
            { id: 'all', label: 'All people', match: () => true },
            { id: 'customers', label: 'At customers', match: (record) => companyById(record.company)?.stage === 'customer' }
          ],
          // A contact reads as a card too — a face, a role, a company — but there is no pipeline
          // to lay out, so no board.
          shapes: ['table', 'cards'],
          sort: { id: 'name', dir: 'asc' },
          visible: { table: ['name', 'email', 'company', 'role', 'strength', 'owner'], cards: ['company', 'email', 'owner'] },
          fields: [
            {
              id: 'name', label: 'Name', type: 'text', locked: true, glyph: 'user', sortable: true, view: { table: { width: '190px', popin: false } },
              render: (record) => personLabel(viewParts, record.name)
            },
            {
              id: 'email', label: 'Email', type: 'email', groupable: false, glyph: 'envelope-regular', sortable: true,
              view: { table: { width: '230px', editable: 'text' } }
            },
            {
              id: 'company', label: 'Company', type: 'entity', glyph: 'building', sortable: true, link: true,
              render: (record) => companyLink(companyById(record.company)), text: (record) => companyById(record.company)?.name ?? '',
              sortValue: (record) => record.companyName,
              view: { table: { width: '200px' } }
            },
            {
              id: 'role', label: 'Role', type: 'text', groupable: false, glyph: 'briefcase', sortable: true,
              view: { table: { width: '170px', editable: 'text' } }
            },
            {
              id: 'strength', label: 'Connection', type: 'rating', glyph: 'signal', sortable: true,
              render: (record) => strengthMeter(record.strength), text: (record) => STRENGTH[record.strength - 1] ?? '',
              view: { table: { width: '130px' } }
            },
            readOnly(owner)
          ],
          filterFields: [ownerFilter('Account owner')],
          groups: { owner: ownerAxis('Account owner') },
          cards: {
            subtitle: (record) => record.role,
            preview: (record) => viewParts.own(new Avatar(null, { name: record.name, size: 'sm' })).toElement()
          },
          board: null,
          create: () => notify('People are added from an email or from a company page.', 'info'),
          open: (record) => openCompany(record.company),
          update: byId(() => store.people),
          remove: removeFrom('people')
        };
      }
      if (id === 'deals') {
        return {
          id, ...RECORD_TYPES.deals, noun: ['deal', 'deals'], newLabel: 'New deal',
          records: () => store.deals,
          none: { title: 'No deals yet', description: 'Deals start from a company page, with its contacts filled in.' },
          sum: { id: 'value', text: (total) => ` worth ${money(total)}` },
          views: [
            { id: 'all', label: 'All deals', match: () => true },
            { id: 'mine', label: 'My deals', match: (record) => record.owner === ME },
            { id: 'closing', label: 'Closing this month', match: (record) => record.close.startsWith(TODAY.slice(0, 7)) }
          ],
          // A pipeline: it opens on the board; the table is there to edit many deals at once.
          shapes: ['table', 'board'],
          view: 'board',
          sort: { id: 'close', dir: 'asc' },
          visible: { table: ['name', 'company', 'stage', 'value', 'close', 'owner'], board: ['value', 'close', 'owner'] },
          fields: [
            {
              id: 'name', label: 'Deal', type: 'text', locked: true, glyph: 'handshake', sortable: true,
              view: { table: { width: '240px', popin: false, editable: 'text' } }
            },
            {
              id: 'company', label: 'Company', type: 'entity', groupable: false, glyph: 'building', sortable: true, link: true,
              render: (record) => companyLink(companyById(record.company)), text: (record) => companyById(record.company)?.name ?? '',
              sortValue: (record) => companyById(record.company)?.name,
              view: { table: { width: '220px' } }
            },
            {
              id: 'stage', label: 'Stage', type: 'status', glyph: 'circle-half-stroke', sortable: true,
              render: (record) => dealBadge(record.stage),
              text: (record) => DEAL_STAGES.find((stage) => stage.id === record.stage)?.label ?? '',
              sortValue: (record) => DEAL_STAGES.findIndex((stage) => stage.id === record.stage),
              view: { table: { width: '140px', editable: 'select', options: choices(DEAL_STAGES) } }
            },
            {
              id: 'value', label: 'Value', type: 'money', glyph: 'euro-sign', sortable: true,
              render: (record) => money(record.value),
              view: { table: amountColumn('120px') }
            },
            {
              id: 'close', label: 'Close date', type: 'date', glyph: 'calendar-days', sortable: true,
              render: (record) => day(record.close),
              view: { table: { width: '130px' } }
            },
            owner
          ],
          filterFields: [stageFilter(choices(DEAL_STAGES)), ownerFilter('Owner'), amountFilter('value', 'Value')],
          groups: { stage: statusAxis(DEAL_STAGES), owner: ownerAxis() },
          cards: null,
          board: {
            columnBy: 'stage', title: (record) => record.name, subtitle: (record) => companyById(record.company)?.name,
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
        id, title: list.name, icon: 'table-list', tone: 'slate', noun: ['entry', 'entries'], newLabel: 'Add company',
        records: entries,
        none: { title: 'No entries yet', description: 'Select companies in the table and use Add to list.' },
        sum: { id: 'arr', text: (total) => ` · ${money(total)} ARR` },
        views: [{ id: 'all', label: 'All entries', match: () => true }],
        // A list is worked stage by stage, so it opens on its board. Its entries borrow their
        // owner from the company, so they group by the list's own stages only.
        shapes: ['table', 'board'],
        view: 'board',
        sort: { id: 'name', dir: 'asc' },
        visible: { table: ['name', 'stage', 'arr', 'last', 'owner'], board: ['arr', 'last', 'owner'] },
        fields: [
          {
            id: 'name', label: 'Company', type: 'text', locked: true, glyph: 'building', sortable: true, link: true,
            render: (record) => companyLink(companyById(record.company)),
            view: { table: { width: '240px', popin: false } }
          },
          {
            id: 'stage', label: 'Stage', type: 'status', glyph: 'circle-half-stroke', sortable: true,
            render: (record) => badge({ label: record.stage, size: 'sm' }),
            sortValue: (record) => list.stages.indexOf(record.stage),
            view: { table: { width: '150px', editable: 'select', options: choices(list.stages) } }
          },
          {
            id: 'arr', label: 'ARR', type: 'money', glyph: 'euro-sign', sortable: true,
            render: (record) => (record.arr ? money(record.arr) : '—'),
            view: { table: { width: '120px', type: 'currency' } }
          },
          last,
          readOnly(owner)
        ],
        filterFields: [ownerFilter('Account owner')],
        // An entry is a copy joined from its membership; a move on the board is written to both.
        groups: {
          stage: {
            ...statusAxis(list.stages.map((stage) => ({ id: stage, label: stage }))),
            set: (record, stage) => { record.stage = stage; byId(() => store.memberships)(record.ID, { stage }); }
          }
        },
        cards: null,
        board: {
          columnBy: 'stage', title: (record) => record.name,
          subtitle: (record) => companyById(record.company)?.domain,
          lines: { arr: arrLine },
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
     * A context for one screen, inside the layout's: the overview binds its keys and builds its
     * drawers on it, and all of that goes when the screen does — on the next `screen.reset()`.
     * @returns {import('./kit.js').LayoutContext}
     */
    function screenContext() {
      const controller = new AbortController();
      /** @type {Array<() => void>} */
      const tasks = [];
      screen.own({
        destroy: () => {
          controller.abort();
          for (const task of tasks.splice(0).reverse()) task();
        }
      });
      return { ...context, signal: controller.signal, cleanup: (task) => { tasks.push(task); } };
    }

    /**
     * Renders a collection: the page header, the saved views, and the kit's overview — search,
     * Filter, Sort, View, the shape switch, the filter chips, the table, cards, or board, and the
     * pager — with the CRM's own cells, card and board drawing, and bulk bar.
     * @param {Record<string, any>} definition From `collection()`.
     * @returns {void}
     */
    function showCollection(definition) {
      const [singular, plural] = definition.noun;
      const glyphs = Object.fromEntries(definition.fields.map((field) => [field.id, field.glyph]));
      const filterTypes = Object.fromEntries(definition.filterFields.map((field) => [field.id, field.type]));
      const fieldById = new Map(definition.fields.map((field) => [field.id, field]));
      /** @param {Record<string, any>} field @param {Record<string, any>} record @returns {string} A field in plain words. */
      const textOf = (field, record) => (field.text ? field.text(record) : [record[field.id]].flat().filter((value) => value != null).join(', '));
      // A record is found by its words and numbers — its fields as they read, and the address
      // and contact behind them — never by a flag.
      const searchText = (record) => [
        ...Object.values(record).flat().filter((value) => typeof value === 'string' || typeof value === 'number'),
        ...definition.fields.map((field) => textOf(field, record))
      ].join(' ');
      // A filter reads an empty owner or tier as its Unassigned or No tier bucket, as the overview does.
      const matchRead = (record, field) => {
        const axis = definition.groups[field];
        return axis?.other ? bucketOf(record[field], axis) : record[field];
      };
      const noFilters = { logic: 'and', conditions: [], advanced: null };
      let views = [...definition.views];
      let viewId = views[0].id;
      /** @type {Set<string>} Shapes still to be given a built-in view's default columns when they next show. */
      let pendingDefaults = new Set();
      const scoped = screenContext();

      /** @type {import('./overview.js').Overview|null} Null only while it builds itself. */
      let overview = null;
      overview = createOverview(scoped, {
        root,
        label: `${definition.title} controls`,
        fields: definition.fields,
        visible: definition.visible,
        titleField: 'name',
        filterFields: definition.filterFields,
        groups: definition.groups,
        records: definition.records(),
        // The saved view's own records: a scope before the chips, which its count follows.
        baseFilter: currentView().match,
        views: definition.shapes,
        view: definition.view ?? definition.shapes[0],
        board: definition.board ? { columnBy: definition.board.columnBy } : undefined,
        sort: views[0].sort ?? definition.sort,
        // A sales team's collections are short; ten a page is there for reading on a phone.
        pageSize: 25,
        pageSizes: [10, 25, 50],
        search: { placeholder: `Search ${plural}…`, label: definition.title, text: searchText },
        // The count, and what it adds up to, in every shape — short, so that the count still fits
        // beside an open drawer; past that the line ends in an ellipsis and its title holds it all.
        countText: (count) => {
          const text = `${formatNumber(count)} ${count === 1 ? singular : plural}`;
          return definition.sum ? text + definition.sum.text(sumOf(shown(), definition.sum.id)) : text;
        },
        // Nothing in the collection at all, or nothing in this saved view, or nothing the filter
        // leaves, each says so.
        empty: ({ filtered }) => (filtered ? { title: `No ${plural} match` }
          : currentView() === views[0] ? { icon: definition.icon, ...definition.none }
            : { icon: definition.icon, title: `No ${plural} in this view`, description: 'Records appear here once they match it.' }),
        shortcuts: true,
        createView
      });
      overview.toolbar.setCount(overview.getFiltered().length);
      // Leaving the screen closes an open drawer, so the main pane gives its room back.
      scoped.cleanup(() => {
        overview.closeDrawers();
        root.removeAttribute('data-overview-drawer');
        root.style.removeProperty('--overview-drawer-size');
      });
      // Cells draw avatars; a new page destroys the last page's, and the headings get their glyphs.
      overview.on('render', () => viewParts.reset());
      overview.on('rendered', () => {
        decorate();
        const line = overview.toolbar.toElement().querySelector('.zx-list-toolbar__count');
        if (line) line.title = line.textContent ?? '';
      });
      overview.on('selectionchange', ({ detail }) => syncBulk(detail.ids));
      overview.on('recordclick', ({ detail }) => definition.open(detail.record));
      // A card moved to another stage can leave the saved view, and changes its counts.
      overview.on('recordmove', () => syncData());
      // A built-in view arranges every shape its own way; a shape not showing gets it when it does.
      overview.on('viewchange', ({ detail }) => {
        if (pendingDefaults.delete(detail.view)) applyDefaults();
      });

      /** @returns {Record<string, any>[]} The filtered records, or none while the overview builds. */
      function shown() {
        return overview?.getFiltered() ?? [];
      }

      // The saved views are one radio group: Tab reaches the current view, the arrow keys move
      // between views, and Delete removes one saved here.
      const viewGroup = h('div', { class: 'crm__views', role: 'radiogroup', ariaLabel: 'Saved views', onkeydown: viewKeys });
      const tabs = h('div', { class: 'crm__tabs' }, viewGroup, iconButton('plus', 'Save as new view', saveView));

      const selected = h('span', { class: 'bulk-bar__count' });
      const bulk = h('div', { class: 'bulk-bar crm__bulk', role: 'region', ariaLabel: 'Bulk actions', hidden: true },
        selected,
        definition.id === 'companies' ? screen.own(new MenuButton(null, {
          label: 'Add to list', icon: 'list-ul', kind: 'ghost', placement: 'top-start',
          items: LISTS.map((list) => ({ label: list.name, value: list.id })),
          onselect: ({ detail }) => addToList(detail.value)
        })).toElement() : null,
        definition.fields.find((field) => field.id === 'owner')?.view.table.editable ? screen.own(new MenuButton(null, {
          label: 'Assign', icon: 'circle-user', kind: 'ghost', placement: 'top-start',
          items: staffOptions().map(({ value, label }) => ({ label, value })),
          onselect: ({ detail }) => assignOwner(detail.value)
        })).toElement() : null,
        button({ label: 'Export', icon: 'file-export', kind: 'ghost', onclick: exportSelection }),
        button({ label: 'Delete', icon: 'trash-can', kind: 'ghost', onclick: deleteSelection }),
        iconButton('xmark', 'Clear selection', () => overview.clearSelection()));
      overview.element.append(bulk);

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
        tabs,
        overview.element);
      focusSearch = () => overview.toolbar.focusSearch();
      createRecord = () => definition.create();
      renderViews();
      decorate();

      /** @returns {Record<string, any>} The saved view showing. */
      function currentView() {
        return views.find((entry) => entry.id === viewId) ?? views[0];
      }

      /** Hands the overview the records again, after the store changed, and recounts the views. @returns {void} */
      function syncData() {
        overview.setData(definition.records());
        renderViews();
      }

      /**
       * Whether a record shows in a view: its own match, then the search and filters it saved.
       * @param {Record<string, any>} record
       * @param {{match: (record: Record<string, any>) => boolean, state?: {query: string, filters: any}|null}} view
       * @returns {boolean}
       */
      function passes(record, view) {
        if (!view.match(record)) return false;
        if (!view.state) return true;
        const needle = view.state.query.trim().toLowerCase();
        return nodeMatches(record, filterExpression(view.state.filters), { read: matchRead, type: (field) => filterTypes[field] })
          && (!needle || searchText(record).toLowerCase().includes(needle));
      }

      /**
       * Draws one presentation. The overview supplies the shared options, the group rows, and the
       * board's axes; this adds the spreadsheet's editing, the cards' logo tiles, and the board's
       * cards and column heads.
       * @param {string} shape
       * @param {import('./overview.js').OverviewViewContext} view
       * @returns {TableView|CardView|KanbanView}
       */
      function createView(shape, view) {
        if (shape === 'board' && view.board) return createBoard(view);
        if (shape === 'cards' && definition.cards) {
          return new CardView(null, {
            ...view.options,
            selectable: 'multi',
            titleField: (record) => record.name,
            subtitleField: definition.cards.subtitle,
            preview: definition.cards.preview,
            groupBy: view.groupBy,
            minCardWidth: '16rem',
            variant: 'outlined',
            label: `${definition.title} as cards`
          });
        }
        return new TableView(null, {
          ...view.options,
          selectable: 'multi',
          // A click in the spreadsheet edits a cell; the record's name is the link that opens it.
          onrecordclick: null,
          onstatechange: () => decorate(),
          table: {
            ...view.table,
            label: definition.title,
            // The pane is the frame: no box round the table, hairlines between its rows.
            variant: 'plain',
            stickyHeader: true,
            responsive: 'sm',
            zebra: false,
            editMode: 'cell',
            oneditcommit: ({ detail }) => commitEdit(detail.id, detail.changes)
          }
        });
      }

      /**
       * The board: one tray per column, headed by its count and total. Cards move by drag or
       * keyboard; the overview writes the move into the record, through the axis's `set` where the
       * record is a copy (a list's entry).
       * @param {import('./overview.js').OverviewViewContext} view
       * @returns {KanbanView}
       */
      function createBoard(view) {
        const { columnBy, swimlaneBy, columnAxis } = view.board;
        const { board: draw, sum } = definition;
        const kanban = new KanbanView(null, {
          ...view.options,
          ...view.board.options,
          titleField: draw.title,
          preview: draw.preview ?? ((record) => logo(viewParts, record, 'sm')),
          label: `${definition.title} by ${columnAxis.label.toLowerCase()}`,
          renderCard: ({ record }) => boardCard(record, kanban),
          renderColumnHeader: ({ column, swimlane, count }) => {
            const { bucketOf: bucketIn } = view.board;
            const inColumn = (record) => String(bucketIn(record, columnBy)) === String(column.id)
              && (!swimlane || !swimlaneBy || String(bucketIn(record, swimlaneBy)) === String(swimlane.id));
            const total = sum ? sumOf(view.records().filter(inColumn), sum.id) : 0;
            return columnHeader({
              label: column.label,
              tone: columnAxis.buckets.find((bucket) => String(bucket.id) === String(column.id))?.tone ?? null,
              lane: swimlane?.label ?? null,
              count,
              total: total ? money(total) : null
            });
          }
        });
        return kanban;
      }

      /**
       * A card on the board: its title, a quiet subtitle, and one line for each field View settings
       * shows there, in its order — an icon, then the value, its label kept for screen readers; the
       * owner with a face. A line with nothing to say is left out; a field whose cell is a link
       * reads as plain words, since the whole card opens the record.
       * @param {Record<string, any>} record
       * @param {KanbanView} kanban
       * @returns {HTMLElement}
       */
      function boardCard(record, kanban) {
        const { title, subtitle, lines = {} } = definition.board;
        const hidden = kanban.getHiddenFields();
        const line = (mark, label, value) => h('li', {}, mark, h('span', { class: 'visually-hidden' }, `${label}: `), value);
        const entry = (id) => {
          const field = fieldById.get(id);
          if (!field || id === 'name' || hidden.includes(id)) return null;
          if (id === 'owner') {
            const owner = person(record.owner);
            return owner ? line(viewParts.own(new Avatar(null, { name: owner.name, size: 16 })).toElement(), field.label, owner.name) : null;
          }
          const value = lines[id] ? lines[id](record) : field.link ? textOf(field, record) : field.render ? field.render(record) : textOf(field, record);
          return value == null || value === '' || value === '—' ? null : line(icon(field.glyph, { size: 14 }), field.label, value);
        };
        return h('div', { class: 'crm__card' },
          h('h3', { class: 'crm__card-title' }, title(record)),
          h('p', { class: 'crm__card-subtitle' }, subtitle(record)),
          h('ul', { class: 'crm__card-lines' }, kanban.getFieldOrder().map(entry)));
      }

      /** Puts the type glyphs in the table's headings, whenever the table has drawn them. @returns {void} */
      function decorate() {
        const view = overview?.getView();
        if (view instanceof TableView) decorateHeadings(view, glyphs);
      }

      /**
       * A cell edit: written into the store and into the overview's copy of the record. A record
       * the edit moved out of the view leaves it; anything else the table drew itself.
       * @param {string|number} recordId
       * @param {Record<string, any>} changes
       * @returns {void}
       */
      function commitEdit(recordId, changes) {
        definition.update(recordId, changes);
        const copy = overview.getRecords().find((entry) => String(entry.ID) === String(recordId));
        if (copy) Object.assign(copy, changes);
        queueMicrotask(() => {
          const record = definition.records().find((entry) => String(entry.ID) === String(recordId));
          const { group, sort } = overview.getState();
          // A change to the grouping or the sort moves the row, so the page is drawn again.
          const moved = (group && Object.hasOwn(changes, group)) || Object.hasOwn(changes, sort.id);
          if (moved || !record || !passes(record, { match: currentView().match, state: overview.getState() })) syncData();
          else {
            renderViews();
            overview.toolbar.setCount(shown().length);
          }
        });
      }

      /** Draws the saved views and their counts; the focus stays on the current one. @returns {void} */
      function renderViews() {
        const focused = viewGroup.contains(document.activeElement);
        const records = definition.records();
        viewGroup.replaceChildren(...views.map((entry) => h('button', {
          type: 'button', role: 'radio', class: 'crm__view',
          ariaChecked: String(entry.id === viewId), tabindex: entry.id === viewId ? '0' : '-1',
          onclick: (event) => (event.target.closest('.crm__view-remove') ? removeView(entry.id) : selectView(entry.id))
        },
        entry.label,
        h('span', { class: 'crm__view-count' }, formatNumber(records.filter((record) => passes(record, entry)).length)),
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

      /**
       * Shows a saved view. Each is a whole view: its records, then the search, filters, sort,
       * shape, grouping, and columns it saved. A built-in view brings its sort and otherwise the
       * collection's defaults — no search, no filter, no grouping, the default board, and each
       * shape's default columns — in whichever shape is showing.
       * @param {string} id
       * @returns {void}
       */
      function selectView(id) {
        viewId = id;
        const saved = currentView();
        overview.clearSelection();
        overview.setBaseFilter(saved.match);
        if (saved.state) {
          pendingDefaults = new Set();
          overview.setState(saved.state);
          const columns = saved.columns;
          if (columns && overview.getState().view === columns.shape) applyColumns(columns.fieldOrder, columns.hiddenFields);
        } else {
          overview.setState({
            query: '', filters: noFilters, sort: saved.sort ?? definition.sort, group: null,
            ...(definition.board ? { board: { columnBy: definition.board.columnBy, showEmptyColumns: true } } : {})
          });
          pendingDefaults = new Set(definition.shapes);
          pendingDefaults.delete(overview.getState().view);
          applyDefaults();
        }
        renderViews();
        decorate();
      }

      /**
       * Arranges the presentation's fields, keeping the sort it shows: the header's arrow follows
       * the overview's sort, except in a grouped table, which has none.
       * @param {string[]} fieldOrder
       * @param {string[]} hiddenFields
       * @returns {void}
       */
      function applyColumns(fieldOrder, hiddenFields) {
        const { sort, group, view: shape } = overview.getState();
        overview.getView()?.setViewState({ fieldOrder, hiddenFields, sort: group && shape === 'table' ? null : sort });
      }

      /** Gives the presentation showing its shape's default columns. @returns {void} */
      function applyDefaults() {
        const ids = definition.fields.map((field) => field.id);
        const shown = definition.visible[overview.getState().view] ?? ids;
        applyColumns(ids, ids.filter((field) => !shown.includes(field)));
      }

      /** @param {string} id @returns {void} Removes a saved view; the one before it shows if it was showing. */
      function removeView(id) {
        const index = views.findIndex((entry) => entry.id === id);
        views = views.filter((entry) => entry.id !== id);
        if (id === viewId) selectView(views[Math.max(0, index - 1)].id);
        else renderViews();
      }

      /** @param {string[]} ids @returns {void} Shows the bulk bar while anything is selected. */
      function syncBulk(ids) {
        if (ids.length === 0 && bulk.contains(document.activeElement)) focusList();
        bulk.hidden = ids.length === 0;
        selected.textContent = `${ids.length} selected`;
      }

      /**
       * Puts the focus on the list — its first row's checkbox, or the body — so it is not lost
       * with the bulk bar, once an action has cleared the selection.
       * @returns {void}
       */
      function focusList() {
        if (context.preview) return;
        const first = overview.body.querySelector('tbody input[type="checkbox"]:not([disabled]), .zx-record-card input[type="checkbox"]')
          ?? overview.body.querySelector('input[type="checkbox"]:not([disabled]), [tabindex="0"]');
        (first instanceof HTMLElement ? first : overview.body).focus({ preventScroll: true });
      }

      /**
       * After a bulk action, which hides the bar its button was in: a menu or the confirmation
       * hands the focus back to that button as it closes, so the focus moves on once they have.
       * @returns {void}
       */
      function afterBulkAction() {
        later(scoped, () => {
          const active = document.activeElement;
          if (!active || active === document.body || !active.isConnected || bulk.contains(active)) focusList();
        }, 0);
      }

      /** @param {string} listId @returns {void} Adds the selected companies to a list. */
      function addToList(listId) {
        const list = LISTS.find((entry) => entry.id === listId);
        const inList = (company) => store.memberships.some((entry) => entry.list === listId && entry.company === company);
        const ids = overview.getSelection().filter((company) => !inList(company));
        for (const company of ids) {
          store.memberships.push({ ID: Date.now() + store.memberships.length, list: listId, company, stage: list.stages[0] });
        }
        notify(`${ids.length} ${ids.length === 1 ? singular : plural} added to ${list.name}.`);
        overview.clearSelection();
        afterBulkAction();
      }

      /** @param {string} staff Staff id. @returns {void} Assigns the selection to one owner. */
      function assignOwner(staff) {
        const ids = overview.getSelection();
        for (const recordId of ids) definition.update(recordId, { owner: staff });
        overview.clearSelection();
        syncData();
        afterBulkAction();
        notify(`${ids.length} ${ids.length === 1 ? singular : plural} assigned to ${person(staff).name}.`);
      }

      /**
       * Downloads the selected records as CSV: the fields the view shows, in its order, as they
       * read — names for owners and teams, labels for stages.
       * @returns {void}
       */
      function exportSelection() {
        const ids = overview.getSelection();
        const records = overview.getRecords().filter((record) => ids.includes(String(record.ID)));
        const view = overview.getView();
        const hidden = view.getHiddenFields();
        const columns = view.getFieldOrder().filter((id) => !hidden.includes(id)).map((id) => fieldById.get(id)).filter(Boolean)
          .map((field) => ({ id: field.id, label: field.label, value: (record) => textOf(field, record) }));
        downloadBlob(`${definition.title.toLowerCase().replace(/\s+/g, '-')}.csv`, toCsv(records, columns), { type: 'text/csv' });
      }

      /** Deletes the selected records once confirmed. @returns {Promise<void>} */
      async function deleteSelection() {
        const ids = overview.getSelection();
        const noun = ids.length === 1 ? singular : plural;
        const confirmed = await Dialog.confirm({
          title: `Delete ${ids.length} ${noun}?`, message: 'Their activity, notes, and files go with them. This cannot be undone.',
          okLabel: 'Delete', danger: true
        });
        if (!confirmed || scoped.signal.aborted) return;
        definition.remove(ids);
        overview.clearSelection();
        syncData();
        afterBulkAction();
        notify(`${ids.length} ${noun} deleted.`);
      }

      /**
       * Saves what shows as a new view: the records of the view it was made in, the search, the
       * filters, the sort, the shape and grouping, and the columns as they are arranged.
       * @returns {void}
       */
      function saveView() {
        formDialog({
          title: 'Save view',
          submit: 'Save view',
          fields: { name: { type: 'text', label: 'Name', value: 'My view', required: true } },
          onsubmit: ({ name }) => {
            const label = name.trim();
            const state = { ...overview.getState(), page: 1 };
            const view = overview.getView();
            views.push({
              id: `view-${Date.now()}`, label, removable: true, match: currentView().match, state,
              columns: { shape: state.view, fieldOrder: view.getFieldOrder(), hiddenFields: view.getHiddenFields() }
            });
            viewId = views.at(-1).id;
            renderViews();
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
            nav.setMenu(menuItems());
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
