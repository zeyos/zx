import {
  AccountMenu, AppSidebar, Avatar, ContextMenu, DatePicker, Dialog, Fieldset, FileItem,
  InlineLoading, Launcher, MenuButton, Search, Sheet, badge, button, buttonGroup, copyButton,
  emptyState, formatDate, formatNumber, formatRelativeTime, h, highlightMatch, icon
} from '../../src/index.js';
import {
  DATE, adaptiveShell, disposer, dot, iconButton, kbd, later, layoutContext, listTime, modShortcut, modifierLabel,
  navSearch, paneHeader, panelBlock, propList, renderScope, sectionLabel, shortcuts, toaster,
  unavailable, workspaceHeader
} from './kit.js';
import { COMPANIES, ME, NOW, PEOPLE, person } from './fixtures.js';

/** Mailboxes in the navigation, in order. `count` says which number the row shows. */
const MAILBOXES = [
  { id: 'inbox', label: 'Inbox', icon: 'inbox', count: 'unread' },
  { id: 'starred', label: 'Starred', icon: 'star-regular' },
  { id: 'snoozed', label: 'Snoozed', icon: 'clock-regular', count: 'all' },
  { id: 'sent', label: 'Sent', icon: 'paper-plane-regular' },
  { id: 'drafts', label: 'Drafts', icon: 'file-regular', count: 'all' },
  { id: 'done', label: 'Done', icon: 'circle-check-regular' },
  { id: 'scheduled', label: 'Scheduled', icon: 'calendar-regular', count: 'all' }
];

/** The inbox is split into streams, so the important mail is never buried under the rest. */
const SPLITS = [
  { id: 'important', label: 'Important' },
  { id: 'other', label: 'Other' },
  { id: 'customers', label: 'Customers' },
  { id: 'team', label: 'Team' }
];

/**
 * Labels and the categorical tone each one is drawn in — a label says what a conversation is
 * about, never how it is doing, so it takes a tone and not a status colour.
 * @type {{id: string, label: string, tone: import('../../src/components/badge/badge.js').BadgeTone}[]}
 */
const LABELS = [
  { id: 'customers', label: 'Customers', tone: 'blue' },
  { id: 'finance', label: 'Finance', tone: 'teal' },
  { id: 'engineering', label: 'Engineering', tone: 'violet' },
  { id: 'recruiting', label: 'Recruiting', tone: 'amber' }
];

/** Job titles of the customer contacts in the shared fixtures, keyed by company id. */
const CUSTOMER_ROLES = {
  alpine: 'Head of Procurement', danube: 'CTO', kestrel: 'Data Platform Lead',
  northstar: 'IT Director', helios: 'Operations Manager', bruckner: 'Managing Director',
  atelier: 'Creative Director', meridian: 'Head of IT Compliance'
};

/**
 * Everyone this mailbox writes to or hears from: Fieldstone's staff, the customers' contacts, and
 * a few senders from outside both. Customer contacts share their company's id.
 * @type {{id: string, name: string, email: string, role: string, company: string, city: string,
 *   status?: 'online'|'away'|'busy'|'offline'}[]}
 */
const CONTACTS = [
  ...PEOPLE.map((p) => ({ id: p.id, name: p.name, email: p.email, role: p.role, company: 'Fieldstone', city: 'Berlin, Germany', status: p.status })),
  ...COMPANIES.map((c) => ({ id: c.id, name: c.contact, email: c.email, role: CUSTOMER_ROLES[c.id], company: c.name, city: `${c.city}, ${c.country}` })),
  { id: 'amira', name: 'Amira Haddad', email: 'amira.haddad@post.example', role: 'Candidate', company: 'Support Engineer role', city: 'Leipzig, Germany' },
  { id: 'certa', name: 'Maren Koch', email: 'maren.koch@certa-audit.example', role: 'Lead Auditor', company: 'Certa Audit', city: 'Hanover, Germany' },
  { id: 'havel', name: 'Jan Petersen', email: 'j.petersen@havel-brokers.example', role: 'Insurance Broker', company: 'Havel Brokers', city: 'Potsdam, Germany' },
  { id: 'lindenhof', name: 'Lindenhof Properties', email: 'office@lindenhof.example', role: 'Building management', company: 'Lindenhof Properties', city: 'Berlin, Germany' },
  { id: 'ledgerline', name: 'Ledgerline', email: 'statements@ledgerline.example', role: 'Accounting platform', company: 'Ledgerline', city: 'Online' },
  { id: 'status', name: 'Fieldstone Status', email: 'status@fieldstone.example', role: 'Service notifications', company: 'Fieldstone', city: 'Online' },
  { id: 'opsnight', name: 'Ops Night Berlin', email: 'hello@opsnight.example', role: 'Meetup newsletter', company: 'Ops Night Berlin', city: 'Berlin, Germany' }
];

/**
 * @typedef {Object} MailMessage
 * @property {string} from Contact id of the author.
 * @property {string} at Local time, `YYYY-MM-DDTHH:MM`.
 * @property {string[]} body Paragraphs.
 * @property {{name: string, size: number, mime: string}[]} [files] Attachments.
 */
/**
 * @typedef {Object} MailThread
 * @property {string} id
 * @property {'inbox'|'snoozed'|'sent'|'drafts'|'done'|'scheduled'|'trash'} folder
 * @property {'important'|'other'|'customers'|'team'} [split] The inbox stream it sorts into.
 * @property {string} subject
 * @property {string} with The other party, shown in the contact column.
 * @property {string[]} people Everyone on the thread besides the signed-in user.
 * @property {string[]} labels Label ids.
 * @property {boolean} [unread]
 * @property {boolean} [starred]
 * @property {string} [until] When a snoozed thread returns, or a scheduled one goes out.
 * @property {MailMessage[]} messages Oldest first.
 */

/** @type {MailThread[]} */
const THREADS = [
  { id: 'renewal', folder: 'inbox', split: 'customers', subject: 'Renewal terms for 2027', with: 'alpine', people: ['alpine', 'tobias'], labels: ['customers', 'finance'], unread: true, starred: true, messages: [
    { from: 'alpine', at: '2026-09-29T10:02', body: ['Hello Ines, our contract renews on 1 January. Before procurement starts, could you send us the terms for 2027, including the extended support SLA we discussed in the spring?'] },
    { from: 'ines', at: '2026-10-01T14:36', body: ['Hello Hannah, thanks for the heads-up. Tobias will send the full offer this week. In short: the licence rate stays, and the extended SLA adds 12% to the support line.'] },
    { from: 'tobias', at: '2026-10-05T09:20', body: ['Hi Hannah, the offer is attached. It holds the 2026 rate for twelve months and lists the SLA as a separate line, so you can approve it on its own.'], files: [{ name: 'Fieldstone-Offer-AW-2027.pdf', size: 482_000, mime: 'application/pdf' }] },
    { from: 'alpine', at: '2026-10-08T09:12', body: [
      'Hello Ines, hello Tobias, thank you for the offer — it reads well. Two questions before I take it to our board on 20 October:',
      'First, can the extended SLA start on 1 December rather than with the new term? Our peak season begins in December. Second, would you accept quarterly invoicing instead of annual in advance?',
      'If both work, I expect a signature before the end of the month.',
      'Best regards, Hannah'] }
  ] },
  { id: 'postmortem', folder: 'inbox', split: 'team', subject: 'Postmortem: reporting API pagination', with: 'camille', people: ['camille', 'piet', 'jonas'], labels: ['engineering'], unread: true, messages: [
    { from: 'camille', at: '2026-10-08T10:05', body: ['Hi all, the postmortem for Tuesday’s pagination incident is ready. Short version: a cursor was reused across tenants after a cache change, so two customers saw empty pages for 40 minutes. No data crossed tenants.', 'The fix is deployed and a contract test now covers cursor scoping. Please leave comments by Friday.'], files: [{ name: 'Postmortem-2026-10-06.pdf', size: 214_000, mime: 'application/pdf' }] }
  ] },
  { id: 'brand', folder: 'inbox', split: 'important', subject: 'Brand refresh — proposal and timeline', with: 'atelier', people: ['atelier'], labels: [], unread: true, messages: [
    { from: 'ines', at: '2026-10-02T16:20', body: ['Hi Sofia, following our call: could you send a proposal for the brand refresh by mid-October? Logo, type, and the product colours. The budget is in the brief.'] },
    { from: 'atelier', at: '2026-10-08T09:40', body: ['Hi Ines, thanks again for the brief. Our proposal is attached: three phases over nine weeks, starting with a two-day workshop in your office.', 'The fixed fee is €38,500. If you sign by 16 October we can hold the workshop slot on 2 and 3 November.', 'Happy to walk you through it — would Monday at 15:00 work?'], files: [{ name: 'Atelier-West-Proposal.pdf', size: 2_480_000, mime: 'application/pdf' }] }
  ] },
  { id: 'audit', folder: 'inbox', split: 'important', subject: 'ISO 27001 surveillance audit — agenda', with: 'certa', people: ['certa', 'jonas'], labels: [], unread: true, messages: [
    { from: 'certa', at: '2026-10-08T09:05', body: ['Dear Ms Bauer, attached is the agenda for the surveillance audit on 27 and 28 October. Day one covers access control and supplier management; day two, incident handling and backups.', 'Could you name a contact for each block by next Wednesday?'], files: [{ name: 'Audit-agenda-Fieldstone.pdf', size: 128_000, mime: 'application/pdf' }] }
  ] },
  { id: 'ratelimit', folder: 'inbox', split: 'customers', subject: 'API rate limits during the nightly export', with: 'danube', people: ['danube'], labels: ['customers', 'engineering'], unread: true, messages: [
    { from: 'danube', at: '2026-10-08T08:40', body: ['Hi Ines, since Monday our nightly export to the data warehouse fails at around 02:30 with HTTP 429. We run about 40,000 requests in that window.', 'Is there a way to raise the ceiling for scheduled jobs, or should we spread the load across the night?'] }
  ] },
  { id: 'candidate', folder: 'inbox', split: 'important', subject: 'Re: Support engineer role — availability', with: 'amira', people: ['amira', 'nadine'], labels: ['recruiting'], unread: true, messages: [
    { from: 'nadine', at: '2026-10-06T17:10', body: ['Hi Amira, thank you for your time yesterday. We would love you to meet Ines, our Head of Operations, for a final conversation. Could you share your availability for next week?'] },
    { from: 'amira', at: '2026-10-08T08:15', body: ['Hi Nadine, hi Ines, thank you — I am glad it went well.', 'I am free on Tuesday and Wednesday afternoon, and on Thursday until 13:00. I can come to the office or join a call, whichever suits you.'] }
  ] },
  { id: 'accruals', folder: 'inbox', split: 'team', subject: 'Q3 close — two open accruals', with: 'ruth', people: ['ruth'], labels: ['finance'], unread: true, messages: [
    { from: 'ruth', at: '2026-10-08T07:58', body: ['Morning Ines, the Q3 close is nearly done. Two accruals are still open: the Atelier West workshop deposit and the Bruckner freight for September.', 'Can you confirm both amounts by Friday noon?'] }
  ] },
  { id: 'statement', folder: 'inbox', split: 'other', subject: 'Your September statement is ready', with: 'ledgerline', people: ['ledgerline'], labels: ['finance'], messages: [
    { from: 'ledgerline', at: '2026-10-08T06:00', body: ['Your statement for September 2026 is ready. 214 transactions were reconciled automatically; 3 need your review.'] }
  ] },
  { id: 'review', folder: 'inbox', split: 'customers', subject: 'Technical review before signing', with: 'northstar', people: ['northstar', 'piet'], labels: ['customers'], messages: [
    { from: 'northstar', at: '2026-10-07T14:22', body: ['Hello Ines, our security team would like a technical review before we sign: hosting locations, encryption at rest, and how backups are restored. Could Piet join a call next week?'] },
    { from: 'ines', at: '2026-10-07T15:10', body: ['Hello Daan, of course. Piet is copied and will propose times.'] },
    { from: 'piet', at: '2026-10-07T17:45', body: ['Hi Daan, Tuesday 13 October at 10:00 or Wednesday at 14:00 both work for me. I will bring our hosting and backup documentation.'] }
  ] },
  { id: 'onboarding', folder: 'inbox', split: 'team', subject: 'Onboarding flow — final designs for review', with: 'marta', people: ['marta'], labels: [], messages: [
    { from: 'marta', at: '2026-10-07T18:12', body: ['Hi Ines, the final onboarding designs are ready. The biggest change since last week: workspace setup now takes three steps instead of five.'] }
  ] },
  { id: 'pallets', folder: 'inbox', split: 'important', subject: 'Pallet delivery moved to Monday', with: 'bruckner', people: ['bruckner', 'lea'], labels: [], messages: [
    { from: 'bruckner', at: '2026-10-07T16:05', body: ['Hi Ines, our truck for Thursday is out of service. We can deliver the 14 pallets on Monday 12 October between 08:00 and 10:00 instead. Please confirm the dock is free.'] }
  ] },
  { id: 'invoice', folder: 'inbox', split: 'customers', subject: 'Invoice RE-2026-0138 — PO number missing', with: 'kestrel', people: ['kestrel', 'ruth'], labels: ['customers', 'finance'], messages: [
    { from: 'kestrel', at: '2026-10-07T11:03', body: ['Hi Ines, our accounts payable team cannot process invoice RE-2026-0138 without our purchase order number. Could you reissue it with PO 4500-2291?'] }
  ] },
  { id: 'maintenance', folder: 'inbox', split: 'other', subject: 'Scheduled maintenance: FRA1, 14 October', with: 'status', people: ['status'], labels: ['engineering'], messages: [
    { from: 'status', at: '2026-10-07T12:00', body: ['Planned maintenance on the FRA1 power distribution, Wednesday 14 October 22:00–02:00. No customer impact is expected. On-call lead: Jonas Weber.'] }
  ] },
  { id: 'debrief', folder: 'inbox', split: 'team', subject: 'Candidate debrief: support engineer', with: 'nadine', people: ['nadine', 'owen'], labels: ['recruiting'], messages: [
    { from: 'nadine', at: '2026-10-06T16:40', body: ['Quick summary from yesterday: strong troubleshooting, calm under pressure, a little light on SQL. Owen and I both recommend a final round.'] }
  ] },
  { id: 'dpa', folder: 'inbox', split: 'customers', subject: 'Data processing agreement — signed copy', with: 'meridian', people: ['meridian'], labels: ['customers'], messages: [
    { from: 'meridian', at: '2026-10-06T15:30', body: ['Dear Ines, please find the countersigned data processing agreement attached. Nothing further is needed from your side.'], files: [{ name: 'Meridian-DPA-signed.pdf', size: 356_000, mime: 'application/pdf' }] }
  ] },
  { id: 'insurance', folder: 'inbox', split: 'important', subject: 'Liability policy renewal — two options', with: 'havel', people: ['havel', 'ruth'], labels: ['finance'], messages: [
    { from: 'havel', at: '2026-10-07T10:20', body: ['Good morning, your business liability policy renews on 1 December. I have two quotes: the current cover at €4,180 a year, or doubled cyber cover at €5,020. Happy to talk them through.'] }
  ] },
  { id: 'access', folder: 'inbox', split: 'important', subject: 'Access cards for the third floor', with: 'lindenhof', people: ['lindenhof'], labels: [], messages: [
    { from: 'lindenhof', at: '2026-10-06T11:30', body: ['Dear Ms Bauer, the access cards for your new rooms on the third floor are ready at reception. Please bring a list of the employees who need one; cards are activated the same day.'] }
  ] },
  { id: 'rollout', folder: 'inbox', split: 'team', subject: 'Warehouse rollout — sign-off by Friday', with: 'tobias', people: ['tobias', 'lea'], labels: [], starred: true, messages: [
    { from: 'tobias', at: '2026-10-05T09:30', body: ['Ines, the migration plan for the warehouse rollout is final. Procurement needs your sign-off by Friday so the scanners can be ordered.'] }
  ] },
  { id: 'meetup', folder: 'inbox', split: 'other', subject: 'Ops Night #42 — speakers announced', with: 'opsnight', people: ['opsnight'], labels: [], messages: [
    { from: 'opsnight', at: '2026-10-05T08:00', body: ['Our October meetup is on 22 October in Kreuzberg: three talks on running small fleets, on-call without burnout, and boring deployments.'] }
  ] },
  { id: 'quote', folder: 'snoozed', split: 'customers', until: '2026-10-09T08:00', subject: 'Quote for twelve seats', with: 'helios', people: ['helios'], labels: ['customers', 'finance'], messages: [
    { from: 'helios', at: '2026-10-02T10:40', body: ['Bonjour Ines, could you send a quote for twelve seats with the annual discount? We would like to start in November.'] }
  ] },
  { id: 'talk', folder: 'snoozed', split: 'team', until: '2026-10-12T08:00', subject: 'Conference talk: running racks at small scale', with: 'jonas', people: ['jonas'], labels: ['engineering'], messages: [
    { from: 'jonas', at: '2026-10-01T13:15', body: ['I have drafted the abstract for the infrastructure conference. Could you read it before the deadline on the 16th?'] }
  ] },
  { id: 'board', folder: 'sent', subject: 'Board pack for October', with: 'ruth', people: ['ruth'], labels: ['finance'], messages: [
    { from: 'ines', at: '2026-10-07T19:02', body: ['Ruth, the operations section of the board pack is attached. Headcount and the warehouse numbers are final.'] }
  ] },
  { id: 'offsite', folder: 'drafts', subject: 'Team offsite — first ideas', with: 'nadine', people: ['nadine', 'marta'], labels: [], messages: [
    { from: 'ines', at: '2026-10-07T21:30', body: ['Two days in November, somewhere reachable by train. Ideas so far:'] }
  ] },
  { id: 'welcome', folder: 'done', split: 'team', subject: 'Welcome Owen to Support', with: 'owen', people: ['owen'], labels: [], messages: [
    { from: 'owen', at: '2026-10-01T09:00', body: ['Thanks for the warm welcome, everyone. My laptop is set up and I have my first tickets.'] }
  ] },
  { id: 'report', folder: 'scheduled', until: '2026-10-09T08:00', subject: 'Monthly operations report — September', with: 'tobias', people: ['tobias', 'ruth', 'jonas'], labels: [], messages: [
    { from: 'ines', at: '2026-10-08T08:30', body: ['Good morning, the September operations report is attached. Highlights: on-time delivery at 97%, two new warehouse leads, and the FRA1 power work on the 14th.'] }
  ] }
];

/** How a presence state is read out beside an avatar. */
const PRESENCE = { online: 'Online', away: 'Away', busy: 'Busy', offline: 'Offline' };

/** Snooze presets, as days from today and the hour the conversation comes back. */
const SNOOZE = [['Later today', 0, 18], ['Tomorrow', 1, 8], ['Next week', 4, 8]];

/** Send-later presets, in the same shape. */
const SEND_LATER = [['Tomorrow morning', 1, 8], ['Tomorrow afternoon', 1, 13], ['Monday morning', 4, 8]];

/** Keyboard reference, grouped as the help dialog shows it. `Mod` is ⌘ on macOS, Ctrl elsewhere. */
const SHORTCUTS = [
  ['Move', [['Next / previous', 'J', 'K'], ['Open conversation', 'Enter'], ['Back to the list', 'Esc'], ['Search this view', '/'], ['Commands and contacts', 'Mod', 'K']]],
  ['Triage', [['Mark done', 'E'], ['Snooze', 'H'], ['Star', 'S'], ['Mark read or unread', 'U'], ['Undo', 'Z']]],
  ['Write', [['Compose', 'C'], ['Reply', 'R'], ['Reply all', 'A'], ['Forward', 'F'], ['Send', 'Mod', '↵']]]
];

/** @param {string} id @returns {(typeof CONTACTS)[number]} */
function contact(id) {
  return CONTACTS.find((entry) => entry.id === id) ?? CONTACTS[0];
}

/** @param {MailThread} thread @returns {MailMessage} The newest message. */
function latest(thread) {
  return thread.messages[thread.messages.length - 1];
}

/** @param {number} days Days from today. @param {number} hour @returns {Date} */
function dayAt(days, hour) {
  return new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() + days, hour);
}

/** @param {Date} date @returns {string} The fixture timestamp format, `YYYY-MM-DDTHH:MM`. */
function stamp(date) {
  return formatDate(date, '%Y-%m-%dT%H:%M');
}

/** @param {Date} date @returns {string} When a snoozed or scheduled message is due: the clock today, else day and clock. */
function dueTime(date) {
  return formatDate(date, date.toDateString() === NOW.toDateString() ? DATE.time : DATE.dateTime);
}

/** @param {Date} date @returns {string} The full time beside a message, "Thu 8 Oct, 09:12". */
function longTime(date) {
  return formatDate(date, DATE.dateTime);
}

/** @param {string} id Label id. @returns {HTMLElement} */
function labelBadge(id) {
  const entry = LABELS.find((item) => item.id === id);
  return badge({ label: entry?.label ?? id, tone: entry?.tone ?? 'slate', size: 'sm' });
}

/** @param {string} tone A label's tone. @returns {HTMLElement} Its colour swatch in the navigation. */
function swatch(tone) {
  return h('span', { class: 'mail__swatch', 'data-tone': tone, 'aria-hidden': 'true' });
}

/**
 * `button()` with its key in the tooltip and in `aria-keyshortcuts` rather than on its face — for
 * the composer, where a row of key caps would be louder than the words beside them.
 * @param {{label: string, shortcut: {label: string, keys: string}, icon?: string,
 *   kind?: 'default'|'ghost', size?: 'md'|'sm', onclick: () => void}} options
 * @returns {HTMLButtonElement}
 */
function hintedButton({ shortcut, ...options }) {
  const control = button({ ...options, title: `${options.label} (${shortcut.label})` });
  control.setAttribute('aria-keyshortcuts', shortcut.keys);
  return control;
}

/** @param {{name: string, size: number, mime: string}} file @returns {FileItem} An attachment row. */
function attachment(file) {
  return new FileItem(null, {
    id: file.name, name: file.name, size: file.size, mime: file.mime, identitySize: 'sm'
  });
}

export default {
  title: 'Mail',
  category: 'Communication',
  blurb: 'A keyboard-first inbox: split streams, one-key triage, snooze, and an inline reply.',
  components: [
    'DatePicker', 'ContextMenu', 'Launcher', 'Sheet', 'TagPicker', 'MenuButton', 'Search',
    'FileItem', 'InlineLoading', 'Fieldset', 'Dialog', 'Avatar', 'Badge', 'Message'
  ],

  /**
   * Mounts the mail client: mailboxes and labels, the split inbox, the open conversation with its
   * reply composer, and the sender's details.
   * @param {HTMLElement} container Gallery stage.
   * @param {import('./kit.js').LayoutContext} [context]
   * @returns {void}
   */
  mount(container, context) {
    context = layoutContext(context);
    const keep = disposer(context);
    const { preview } = context;
    const root = h('div', { class: 'mail shell', 'data-mode': 'list' });
    // Narrow, the navigation and the contact panel become drawers, and a phone shows the list or
    // the conversation (the conversation's own back button returns to the list).
    const shell = adaptiveShell(root, context, { asideLabel: 'Show contact' });

    // Mutable copies: triage moves threads between folders, so the fixtures stay untouched.
    const threads = structuredClone(THREADS);
    const state = {
      folder: 'inbox', label: /** @type {string|null} */ (null), split: 'important', query: '',
      current: /** @type {string|null} */ (null), mode: 'list', reply: 'reply',
      navCounts: '', cancelDraft: () => {},
      undo: /** @type {{revert: () => void, close: () => void}[]} */ ([]),
      drafts: /** @type {Map<string, string>} */ (new Map()),
      expanded: /** @type {Set<string>} */ (new Set())
    };

    // Components drawn for one rendering of a region are released when it is drawn again.
    const threadParts = renderScope(context);
    const asideParts = renderScope(context);

    /* ------------------------------------------------------------ navigation column -- */

    const mailboxes = keep(new AppSidebar(null, { label: 'Mailboxes', collapsible: false, items: mailboxItems() }));
    const labels = keep(new AppSidebar(null, {
      label: 'Labels', collapsible: false,
      items: LABELS.map((entry) => ({ id: entry.id, label: entry.label, icon: () => swatch(entry.tone), invoke: () => go(null, entry.id) }))
    }));
    const account = keep(new AccountMenu(null, {
      account: { name: person(ME)?.name ?? '', secondary: person(ME)?.role, status: 'online', statusLabel: PRESENCE.online },
      placement: 'top-start',
      items: [
        { label: 'Keyboard shortcuts', icon: 'keyboard', adornment: kbd('?'), onselect: () => showHelp() },
        { label: 'Settings', icon: 'gear', onselect: () => notify(unavailable('Mail settings'), 'info') }
      ]
    }));
    const nav = h('div', { class: 'shell__nav' },
      workspaceHeader(),
      h('div', { class: 'nav-action' },
        button({ label: 'Compose', icon: 'pen', kind: 'primary', shortcut: { label: 'C', keys: 'C' }, onclick: () => openCompose() }),
        navSearch({ label: 'Search mail', onclick: () => openPalette() })),
      h('div', { class: 'shell__body' },
        mailboxes.toElement(),
        sectionLabel('Labels'),
        labels.toElement()),
      h('div', { class: 'shell__footer' }, account.toElement()));

    /* ------------------------------------------------------------------ list column -- */

    // In the inbox the streams are the column's title: one radio group in the header, the checked
    // stream in the text colour and the others muted, each with its unread count. Every other
    // view names itself; the inbox keeps its name as a heading for screen readers.
    const listTitle = h('span');
    const splitTabs = SPLITS.map((split) => {
      const count = h('span', { class: 'mail__split-count' });
      const control = h('button', {
        type: 'button', class: 'mail__split', role: 'radio', onclick: () => openSplit(split.id)
      }, split.label, count);
      return { id: split.id, control, count };
    });
    const splitGroup = h('div', { class: 'mail__splits', role: 'radiogroup', 'aria-label': 'Inbox streams' },
      splitTabs.map((tab) => tab.control));
    // Tab reaches the checked stream; the arrow keys check the next one.
    splitGroup.addEventListener('keydown', (event) => {
      const delta = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
      if (!delta) return;
      event.preventDefault();
      const index = (SPLITS.findIndex((split) => split.id === state.split) + delta + SPLITS.length) % SPLITS.length;
      openSplit(SPLITS[index].id);
      splitTabs[index].control.focus();
    });
    const listBody = h('div', { class: 'shell__body', tabindex: '-1' });
    const search = keep(new Search(null, {
      placeholder: 'Search this view', debounce: 120,
      oninput: (event) => {
        state.query = event.detail.value.trim();
        if (visible().some((thread) => thread.id === state.current)) render();
        else selectFirst();
      }
    }));
    const searchBar = h('div', { class: 'shell__toolbar', hidden: true }, search.toElement());
    const listMenu = keep(new MenuButton(iconButton('ellipsis', 'View actions'), {
      kind: 'ghost', placement: 'bottom-end',
      items: [
        { label: 'Search this view', icon: 'magnifying-glass', adornment: kbd('/'), onselect: () => openSearch() },
        { label: 'Mark all as read', icon: 'envelope-open', onselect: () => markAllRead() }
      ]
    }));
    const listHeader = paneHeader({ leading: [shell.navToggle(), splitGroup], title: listTitle, actions: listMenu.toElement() });
    const listHeading = /** @type {HTMLElement} */ (listHeader.querySelector('.shell__title'));
    const listColumn = h('section', { class: 'shell__list', 'aria-label': 'Conversations' }, listHeader, searchBar, listBody);

    /* ------------------------------------------------------------------ main column -- */

    const back = iconButton('arrow-left', 'Back to the list', () => showList(), { shortcut: { label: 'Esc', keys: 'Escape' } });
    back.classList.add('mail__back');
    const previous = iconButton('chevron-up', 'Previous conversation', () => step(-1), { shortcut: { label: 'K', keys: 'K' } });
    const next = iconButton('chevron-down', 'Next conversation', () => step(1), { shortcut: { label: 'J', keys: 'J' } });
    // On a phone the header keeps its buttons and lets the count go.
    const position = h('span', { class: 'mail__position', 'data-narrow': 'hide' });
    const doneButton = iconButton('check', 'Mark done', () => markDone(), { shortcut: { label: 'E', keys: 'E' } });
    const starButton = iconButton('star-regular', 'Star', () => toggleStar(), { shortcut: { label: 'S', keys: 'S' } });
    starButton.classList.add('star-toggle');
    const snooze = keep(new MenuButton(iconButton('clock-regular', 'Snooze', undefined, { shortcut: { label: 'H', keys: 'H' } }), {
      kind: 'ghost', placement: 'bottom-end', items: snoozeItems()
    }));
    const more = keep(new MenuButton(iconButton('ellipsis', 'More actions'), { kind: 'ghost', placement: 'bottom-end' }));
    const threadBody = h('div', { class: 'shell__body mail__reader', tabindex: '-1' });
    const main = h('section', { class: 'shell__main', 'aria-label': 'Conversation' },
      paneHeader({
        leading: [shell.navToggle(), back, previous, next], title: position,
        actions: [doneButton, snooze.toElement(), starButton, more.toElement(), shell.asideToggle()]
      }),
      threadBody);

    // The reply composer is built once and moved into whichever conversation is open.
    const replyInput = h('textarea', {
      class: 'mail__reply-input', rows: 4, tabindex: '0', 'aria-label': 'Reply', placeholder: 'Write a reply…',
      'aria-keyshortcuts': modShortcut('Enter').keys
    });
    const replyTo = h('span', { class: 'mail__reply-to' });
    const replyModes = Object.fromEntries([['reply', 'Reply', 'R'], ['all', 'Reply all', 'A'], ['forward', 'Forward', 'F']]
      .map(([id, label, letter]) => [id, hintedButton({
        label, kind: 'ghost', size: 'sm', shortcut: { label: letter, keys: letter }, onclick: () => startReply(id)
      })]));
    const saved = keep(new InlineLoading(null, { status: 'inactive', size: 'sm' }));
    // Compose is the screen's one solid accent; sending a reply is a plain button beside the text.
    const sendLater = keep(new MenuButton(button({ icon: 'angle-down', title: 'Send later' }), {
      placement: 'top-end',
      items: [{ type: 'heading', label: 'Send later' }, ...presetItems(SEND_LATER, 'calendar-regular', (date) => sendReply(date))]
    }));
    // One quiet surface under a hairline: the text area shows its frame only on hover and focus.
    const composer = h('div', { class: 'mail__composer', role: 'group', 'aria-label': 'Reply', 'data-zx-fields': 'quiet' },
      h('div', { class: 'mail__composer-top' }, ...Object.values(replyModes), replyTo),
      replyInput,
      h('div', { class: 'mail__composer-foot' },
        saved.toElement(),
        h('span', { class: 'shell__spacer' }),
        buttonGroup([
          hintedButton({ label: 'Send', icon: 'paper-plane', shortcut: modShortcut('Enter', '↵'), onclick: () => sendReply() }),
          sendLater.toElement()
        ])));

    /* ---------------------------------------------------------------- contact column -- */

    const asideBody = h('div', { class: 'shell__body' });
    const writeTo = iconButton('pen-to-square', 'Write to this contact', () => {
      if (currentThread()) openCompose([currentThread().with]);
    });
    const aside = h('aside', { class: 'shell__aside', 'aria-label': 'Contact' },
      paneHeader({ title: 'Contact', actions: writeTo }),
      asideBody);

    root.append(nav, listColumn, main, aside);
    const notify = toaster(context, root);

    /* ------------------------------------------------------------------ overlays -- */

    const composeForm = keep(new Fieldset(null, {
      fields: {
        to: { type: 'tagpicker', label: 'To', props: {
          items: CONTACTS.filter((entry) => entry.id !== ME).map((entry) => ({ ID: entry.id, name: entry.name, email: entry.email })),
          searchKeys: ['name', 'email'], placeholder: 'Add people'
        } },
        subject: { type: 'text', label: 'Subject' },
        body: { type: 'textarea', label: 'Message', props: { rows: 12, tabIndex: 0 } }
      }
    }));
    const composeSheet = keep(new Sheet(null, {
      title: 'New message', size: 560, content: h('div', { class: 'form-sheet' }, composeForm.toElement()),
      buttons: [
        { label: 'Discard', action: () => discardCompose() },
        { label: 'Send', kind: 'primary', action: () => sendCompose(),
          shortcut: modShortcut('Enter', '↵') }
      ]
    }));
    const snoozePicker = keep(new DatePicker(null, { value: dayAt(1, 8), min: dayAt(0, 0), time: true }));
    const snoozeDialog = keep(new Dialog(null, {
      title: 'Snooze until', size: 'sm', content: snoozePicker.toElement(),
      buttons: [
        { label: 'Cancel', action: 'cancel' },
        { label: 'Snooze', kind: 'primary', action: (dialog) => { dialog.close(); snoozeUntil(snoozePicker.get() ?? dayAt(1, 8)); } }
      ]
    }));
    // Right-click (or Shift+F10) on a row, and the row's own snooze button, open menus for that row.
    const rowMenu = keep(new ContextMenu(listBody, {
      selector: '.mail__item, [data-snooze]',
      items: (target) => {
        const thread = threads.find((entry) => entry.id === target?.closest('.mail__item')?.getAttribute('data-id'));
        if (!thread) return [];
        select(thread.id, { markRead: false });
        return target.hasAttribute('data-snooze') ? snoozeItems() : threadActions(thread);
      }
    }));
    let palette = /** @type {Launcher|null} */ (null);
    let help = /** @type {Dialog|null} */ (null);
    for (const overlay of [snooze, more, listMenu, sendLater, account, rowMenu, snoozeDialog, composeSheet]) overlay.on('close', refocus);

    /* ------------------------------------------------------------------- keyboard -- */

    shortcuts(root, {
      j: () => step(1), k: () => step(-1), o: () => openThread(),
      // Esc steps back out of reading mode or the search; with nothing to leave, it declines the
      // key so a surrounding dialog can close instead.
      Escape: () => {
        if (state.mode === 'read') showList();
        else if (!searchBar.hidden) closeSearch();
        else return false;
      },
      e: () => markDone(), s: () => toggleStar(), u: () => toggleRead(), z: () => undoLast(),
      // A menu opened with H hands the focus back to where the key was pressed — the list, or the
      // conversation in reading mode — rather than to its trigger in the header.
      h: () => {
        if (!currentThread()) return;
        const row = listBody.querySelector('.mail__row[aria-current="true"]');
        snooze.focusFirst({ returnFocus: state.mode === 'read' || !(row instanceof HTMLElement) ? threadBody : row });
      },
      r: () => startReply('reply'), a: () => startReply('all'), f: () => startReply('forward'),
      c: () => openCompose(), '/': () => openSearch(), '?': () => showHelp(), 'Mod+k': () => openPalette()
    }, context);
    shortcuts(replyInput, { 'Mod+Enter': () => sendReply() }, context);
    const composeBody = composeForm.getField('body')?.getInput();
    if (composeBody instanceof HTMLElement) shortcuts(composeBody, { 'Mod+Enter': () => sendCompose() }, context);
    listBody.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        step(event.key === 'ArrowDown' ? 1 : -1);
      } else if (event.key === 'Enter' && event.target instanceof HTMLElement && event.target.matches('.mail__row')) {
        event.preventDefault();
        openThread();
      }
    });
    search.toElement().addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeSearch();
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        focusRow();
      }
    });
    replyInput.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      focusRow();
    });
    replyInput.addEventListener('input', () => draftChanged());

    container.append(root);
    selectFirst();
    if (!preview) {
      palette = keep(new Launcher(null, {
        shortcut: false, label: 'Commands', scope: root, placeholder: 'Type a command, a contact, or a subject', onclose: refocus
      }));
      // The keys work from the start, but nothing has been pressed yet: no focus ring at rest.
      focusRow({ focusVisible: false });
    }

    /* ------------------------------------------------------------------- queries -- */

    /** @returns {MailThread|undefined} */
    function currentThread() {
      return threads.find((thread) => thread.id === state.current);
    }

    /** @param {MailThread} thread @param {string} folder @returns {boolean} Whether it belongs to a mailbox. */
    function inFolder(thread, folder) {
      return folder === 'starred' ? Boolean(thread.starred) && !['trash', 'drafts'].includes(thread.folder) : thread.folder === folder;
    }

    /** @returns {MailThread[]} The conversations in the current view: newest first, or soonest due. */
    function visible() {
      const needle = state.query.toLocaleLowerCase();
      const due = ['snoozed', 'scheduled'].includes(state.folder);
      const time = (thread) => new Date(due ? thread.until ?? '' : latest(thread).at).getTime();
      return threads
        .filter((thread) => state.label
          ? thread.labels.includes(state.label) && ['inbox', 'done', 'snoozed'].includes(thread.folder)
          : inFolder(thread, state.folder) && (state.folder !== 'inbox' || thread.split === state.split))
        .filter((thread) => !needle || [thread.subject, contact(thread.with).name, ...latest(thread).body]
          .join(' ').toLocaleLowerCase().includes(needle))
        .sort((a, b) => due ? time(a) - time(b) : time(b) - time(a));
    }

    /* ------------------------------------------------------------------ rendering -- */

    /** Redraws every region from the state. @returns {void} */
    function render() {
      renderNav();
      renderList();
      renderThread();
      renderAside();
    }

    /** @returns {any[]} The mailboxes, with live counts. */
    function mailboxItems() {
      return MAILBOXES.map((box) => {
        const inBox = threads.filter((thread) => inFolder(thread, box.id));
        const count = box.count === 'unread' ? inBox.filter((thread) => thread.unread).length : box.count ? inBox.length : 0;
        return { id: box.id, label: box.label, icon: box.icon, badge: count ? formatNumber(count) : undefined, invoke: () => go(box.id, null) };
      });
    }

    /** Refreshes counts, the active destination, and the list's title or streams. @returns {void} */
    function renderNav() {
      const items = mailboxItems();
      const counts = items.map((item) => item.badge ?? '').join();
      if (counts !== state.navCounts) mailboxes.setItems(items);
      state.navCounts = counts;
      mailboxes.setActive(state.label ? null : state.folder);
      labels.setActive(state.label);
      const splitView = !state.label && state.folder === 'inbox';
      splitGroup.hidden = !splitView;
      listHeading.classList.toggle('visually-hidden', splitView);
      for (const tab of splitTabs) {
        const checked = tab.id === state.split;
        const unread = threads.filter((thread) => thread.folder === 'inbox' && thread.split === tab.id && thread.unread).length;
        tab.control.setAttribute('aria-checked', String(checked));
        tab.control.tabIndex = checked ? 0 : -1;
        tab.count.textContent = unread ? formatNumber(unread) : '';
      }
      listTitle.textContent = (state.label ? LABELS.find((entry) => entry.id === state.label)
        : MAILBOXES.find((box) => box.id === state.folder))?.label ?? '';
    }

    /** Redraws the conversation rows, keeping keyboard focus on the selected one. @returns {void} */
    function renderList() {
      const hadFocus = listBody.contains(document.activeElement);
      const list = visible();
      listBody.replaceChildren(list.length ? h('ul', { class: 'mail__rows', role: 'list' }, list.map(rowFor)) : emptyState(state.query
        ? { icon: 'magnifying-glass', title: 'No matches', description: `Nothing here mentions “${state.query}”.`, size: 'sm' }
        : { icon: 'circle-check', title: 'All done', description: 'Nothing left in this view. Enjoy the quiet.', size: 'sm' }));
      if (hadFocus) focusRow();
    }

    /**
     * One conversation row on two lines — sender and time, then subject, preview, and labels —
     * with an unread dot in the gutter before it. Its triage actions take the time's place on
     * hover or keyboard focus. Only the selected row is in the tab order.
     * @param {MailThread} thread
     * @returns {HTMLLIElement}
     */
    function rowFor(thread) {
      const sender = contact(thread.with);
      const last = latest(thread);
      const current = thread.id === state.current;
      const when = thread.until && ['snoozed', 'scheduled'].includes(thread.folder) ? thread.until : last.at;
      const outgoing = ['sent', 'drafts', 'scheduled'].includes(thread.folder);
      const actions = [
        ...(outgoing ? [] : [['check', 'Mark done', 'E', () => markDone(thread.id)], ['clock-regular', 'Snooze', 'H', null]]),
        [thread.starred ? 'star' : 'star-regular', 'Star', 'S', () => toggleStar(thread.id)]
      ].map(([glyph, label, letter, run]) => {
        const control = iconButton(glyph, label, run ?? ((event) => rowMenu.openAtElement(event.currentTarget)),
          { shortcut: { label: letter, keys: letter } });
        control.tabIndex = current ? 0 : -1;
        if (!run) control.dataset.snooze = '';
        if (glyph.startsWith('star')) {
          control.classList.add('star-toggle');
          control.setAttribute('aria-pressed', String(Boolean(thread.starred)));
        }
        return control;
      });
      return h('li', { class: 'mail__item', 'data-id': thread.id },
        h('button', {
          type: 'button', class: 'list-row mail__row', tabindex: current ? '0' : '-1',
          'aria-current': current ? 'true' : null, 'data-unread': thread.unread ? '' : null,
          // Wide, a click selects and the conversation shows beside the list; on a phone, where
          // only one fits, it opens the conversation.
          onclick: () => {
            select(thread.id);
            if (shell.single()) openThread();
          }
        },
        thread.unread ? h('span', { class: 'mail__unread' }, dot('accent'), h('span', { class: 'visually-hidden' }, 'Unread')) : null,
        h('span', { class: 'mail__row-top' },
          h('span', { class: 'list-row__title' }, highlightMatch(outgoing ? `To ${sender.name}` : sender.name, state.query)),
          thread.messages.length > 1 ? h('span', { class: 'mail__row-count' }, String(thread.messages.length)) : null,
          thread.starred ? h('span', { class: 'mail__star', title: 'Starred' }, icon('star', { size: 12 })) : null,
          h('span', { class: 'list-row__meta mail__row-time' }, thread.until && when === thread.until ? dueTime(new Date(when)) : listTime(when))),
        h('span', { class: 'mail__row-line' },
          h('span', { class: 'mail__row-text' },
            h('span', { class: 'mail__row-subject' }, highlightMatch(thread.subject, state.query)), ' ',
            h('span', { class: 'mail__row-snippet' }, last.body.join(' '))),
          thread.labels.map(labelBadge))),
        h('div', { class: 'mail__row-actions' }, actions));
    }

    /** Draws the open conversation: subject, labels, people, messages, and the composer. @returns {void} */
    function renderThread() {
      const focused = threadBody.contains(document.activeElement) ? document.activeElement : null;
      threadParts.reset();
      const thread = currentThread();
      const list = visible();
      const index = thread ? list.indexOf(thread) : -1;
      position.textContent = index >= 0 ? `${formatNumber(index + 1)} of ${formatNumber(list.length)}` : '';
      previous.disabled = index <= 0;
      next.disabled = index < 0 || index >= list.length - 1;
      for (const control of [doneButton, starButton, snooze.toElement(), more.toElement(), writeTo]) control.disabled = !thread;
      starButton.setAttribute('aria-pressed', String(Boolean(thread?.starred)));
      starButton.replaceChildren(icon(thread?.starred ? 'star' : 'star-regular'));
      if (!thread) {
        threadBody.replaceChildren(emptyState({
          icon: 'envelope-open', title: 'No conversation open', description: 'Pick one from the list, or press C to write a new message.'
        }));
        return;
      }
      const done = thread.folder === 'done';
      doneButton.setAttribute('aria-label', done ? 'Move to inbox' : 'Mark done');
      doneButton.title = `${done ? 'Move to inbox' : 'Mark done'} (E)`;
      doneButton.replaceChildren(icon(done ? 'inbox' : 'check'));
      more.setItems(threadActions(thread));
      replyInput.value = state.drafts.get(thread.id) ?? '';
      state.cancelDraft();
      saved.set('inactive', '', { silent: true });
      startReply(state.reply === 'all' ? 'all' : 'reply', { focus: false });

      const people = [ME, ...thread.people];
      threadBody.replaceChildren(h('article', { class: 'mail__thread', 'aria-label': thread.subject },
        h('header', { class: 'mail__thread-head' },
          h('h2', { class: 'record-title record-title--sm' }, thread.subject),
          h('div', { class: 'mail__thread-meta' },
            thread.labels.map(labelBadge),
            thread.until ? badge({ label: `${thread.folder === 'scheduled' ? 'Sends' : 'Returns'} ${dueTime(new Date(thread.until))}`, icon: 'clock', size: 'sm' }) : null,
            h('span', { class: 'avatar-stack' }, people.slice(0, 4).map((id) => threadParts.own(new Avatar(null, { name: contact(id).name, size: 'sm' })))),
            h('span', { class: 'meta' }, people.map((id) => id === ME ? 'You' : contact(id).name).join(', ')))),
        h('div', { class: 'mail__messages' }, thread.messages.map((message, i) =>
          i === thread.messages.length - 1 || state.expanded.has(`${thread.id}:${i}`)
            ? expandedMessage(thread, message, i) : foldedMessage(thread, message, i))),
        ['drafts', 'scheduled'].includes(thread.folder) ? null : composer));
      // Redrawing must not drop keyboard focus: keep it in the composer, or on the pane.
      if (focused instanceof HTMLElement && !preview) (focused.isConnected ? focused : threadBody).focus();
    }

    /**
     * An earlier message folded to one line; activating it unfolds it.
     * @param {MailThread} thread @param {MailMessage} message @param {number} index
     * @returns {HTMLElement}
     */
    function foldedMessage(thread, message, index) {
      const author = contact(message.from);
      return h('button', {
        type: 'button', class: 'mail__fold', 'aria-expanded': 'false',
        onclick: () => { state.expanded.add(`${thread.id}:${index}`); renderThread(); }
      },
      threadParts.own(new Avatar(null, { name: author.name, size: 'sm' })),
      h('span', { class: 'mail__fold-name' }, message.from === ME ? 'You' : author.name),
      h('span', { class: 'mail__fold-snippet' }, message.body.join(' ')),
      h('span', { class: 'meta' }, listTime(message.at)));
    }

    /**
     * A message in full: author, recipients, time, body, and attachments.
     * @param {MailThread} thread @param {MailMessage} message @param {number} index
     * @returns {HTMLElement}
     */
    function expandedMessage(thread, message, index) {
      const author = contact(message.from);
      const sent = new Date(message.at);
      const to = [ME, ...thread.people].filter((id) => id !== message.from).map((id) => id === ME ? 'you' : contact(id).name);
      const fold = index < thread.messages.length - 1 ? iconButton('chevron-up', 'Fold message', () => {
        state.expanded.delete(`${thread.id}:${index}`);
        renderThread();
      }) : null;
      return h('section', { class: 'mail__message', 'aria-label': `${author.name}, ${longTime(sent)}` },
        h('header', { class: 'mail__message-head' },
          threadParts.own(new Avatar(null, { name: author.name, size: 'md', status: author.status ?? null })),
          h('div', { class: 'mail__message-who' },
            h('span', { class: 'mail__message-from', title: author.email }, author.name),
            h('span', { class: 'meta' }, `to ${to.join(', ')}`)),
          h('time', { class: 'meta mail__message-time', dateTime: message.at }, `${longTime(sent)} · ${formatRelativeTime(sent, { now: NOW })}`),
          fold),
        h('div', { class: 'mail__message-body' }, message.body.map((text) => h('p', { class: 'mail__para' }, text))),
        message.files ? h('div', { class: 'mail__files' }, message.files.map((file) => threadParts.own(attachment(file)))) : null);
    }

    /** Draws the other party: who they are, how to reach them, and what else you share. @returns {void} */
    function renderAside() {
      asideParts.reset();
      const thread = currentThread();
      if (!thread) {
        asideBody.replaceChildren(emptyState({ icon: 'user', title: 'No contact', size: 'sm' }));
        return;
      }
      const person = contact(thread.with);
      const shared = threads.filter((entry) => entry.with === person.id && entry.folder !== 'trash');
      const recent = panelBlock('Recent conversations',
        h('ul', { class: 'mail__rows', role: 'list' }, shared.map((entry) => h('li', {}, h('button', {
          type: 'button', class: 'list-row mail__recent-row', 'aria-current': entry.id === thread.id ? 'true' : null,
          onclick: () => reveal(entry.id)
        }, h('span', { class: 'list-row__top' },
          h('span', { class: 'list-row__title' }, entry.subject),
          h('span', { class: 'list-row__meta' }, listTime(latest(entry).at))))))));
      recent.classList.add('mail__recent');
      asideBody.replaceChildren(
        h('div', { class: 'panel-block mail__person' },
          asideParts.own(new Avatar(null, { name: person.name, size: 'lg', status: person.status ?? null, statusLabel: PRESENCE[person.status ?? ''] ?? null })),
          h('div', {},
            h('p', { class: 'mail__person-name' }, person.name),
            h('p', { class: 'meta mail__person-role' }, `${person.role} · ${person.company}`))),
        h('div', { class: 'panel-block' }, propList([
          ['Email', h('span', { class: 'mail__email' }, h('span', { class: 'mail__email-text' }, person.email),
            copyButton({ text: person.email, title: 'Copy email address', size: 'sm', kind: 'ghost' }))],
          ['Company', person.company],
          ['Location', person.city],
          ['Conversations', formatNumber(shared.length)]
        ])),
        recent);
    }

    /* ---------------------------------------------------------------- navigation -- */

    /** Selects and shows a conversation. @param {string|null} id @param {{markRead?: boolean}} [options] @returns {void} */
    function select(id, { markRead = true } = {}) {
      const previousId = state.current;
      state.current = id;
      const thread = currentThread();
      if (thread?.unread && markRead) {
        thread.unread = false;
        renderNav();
        renderList();
      } else if (previousId !== id) syncRows();
      else return;
      renderThread();
      renderAside();
    }

    /** Moves the selection marker and the tab stop without rebuilding the rows. @returns {void} */
    function syncRows() {
      for (const item of listBody.querySelectorAll('.mail__item')) {
        const current = item.getAttribute('data-id') === state.current;
        if (current) item.querySelector('.mail__row')?.setAttribute('aria-current', 'true');
        else item.querySelector('.mail__row')?.removeAttribute('aria-current');
        for (const control of item.querySelectorAll('button')) control.tabIndex = current ? 0 : -1;
      }
    }

    /** Shows one stream of the split inbox. @param {string} id @returns {void} */
    function openSplit(id) {
      state.split = id;
      selectFirst();
    }

    /** Lands on the first conversation in view without marking it read. @returns {void} */
    function selectFirst() {
      state.current = visible()[0]?.id ?? null;
      render();
    }

    /** J and K. @param {number} delta +1 for the next conversation, -1 for the previous. @returns {void} */
    function step(delta) {
      const list = visible();
      const target = list[Math.min(list.length - 1, Math.max(0, list.findIndex((thread) => thread.id === state.current) + delta))];
      if (!target) return;
      select(target.id);
      if (state.mode === 'list') focusRow();
      listBody.querySelector('[aria-current="true"]')?.scrollIntoView({ block: 'nearest' });
    }

    /**
     * Puts keyboard focus on the selected row, or on the conversation in reading mode.
     * @param {FocusOptions} [options] `{ focusVisible: false }` when no key was pressed to get here.
     * @returns {void}
     */
    function focusRow(options) {
      if (preview) return;
      const row = /** @type {HTMLElement|null} */ (listBody.querySelector('.mail__row[aria-current="true"]'));
      (state.mode === 'read' ? threadBody : row ?? listBody).focus(options);
    }

    /**
     * Shortcuts listen on this layout's root, so focus must not be left on the page body when a
     * menu or dialog closes over a control that no longer exists. Puts it back on the list.
     * @returns {void}
     */
    function refocus() {
      later(context, () => {
        const active = document.activeElement;
        if (!active || active === document.body || !active.checkVisibility()) focusRow();
      }, 0);
    }

    /** Opens a mailbox or a label. @param {string|null} folder @param {string|null} label @returns {void} */
    function go(folder, label) {
      // Chosen in the navigation drawer: close it first, so the list is no longer inert when the
      // focus moves to it.
      if (root.dataset.navOpen === 'true') shell.closeNav();
      Object.assign(state, { folder: folder ?? state.folder, label, query: '' });
      search.set('', { silent: true });
      showList({ focus: false });
      selectFirst();
      focusRow();
    }

    /** Opens a conversation wherever it lives — from the palette or the contact column. @param {string} id @returns {void} */
    function reveal(id) {
      const thread = threads.find((entry) => entry.id === id);
      if (!thread) return;
      // From the contact drawer: it closes, so the conversation it opens is in view.
      if (root.dataset.asideOpen === 'true') shell.toggleAside(false);
      Object.assign(state, { label: null, query: '', folder: thread.folder === 'trash' ? 'inbox' : thread.folder });
      if (thread.folder === 'inbox' && thread.split) state.split = thread.split;
      state.current = null;
      select(id);
      render();
      openThread();
    }

    /** Reading mode: the list steps aside and the conversation takes the room. @returns {void} */
    function openThread() {
      if (!currentThread()) return;
      state.mode = root.dataset.mode = 'read';
      shell.show('main', { focus: false });
      // On a phone the conversation replaces the list, so the focus lands on its subject and a
      // screen reader says where it went; wide, the pane takes it so the arrow keys scroll it.
      const subject = shell.single() ? threadBody.querySelector('h2') : null;
      if (subject) subject.tabIndex = -1;
      (subject ?? threadBody).focus();
    }

    /** Back to the list. @param {{focus?: boolean}} [options] @returns {void} */
    function showList({ focus = true } = {}) {
      state.mode = root.dataset.mode = 'list';
      shell.show('list', { focus: false });
      if (focus) focusRow();
    }

    /** @returns {void} */
    function openSearch() {
      showList({ focus: false });
      searchBar.hidden = false;
      search.focus();
    }

    /** @returns {void} */
    function closeSearch() {
      searchBar.hidden = true;
      if (state.query) {
        state.query = '';
        search.set('', { silent: true });
        render();
      }
      focusRow();
    }

    /* -------------------------------------------------------------------- triage -- */

    /**
     * Moves a conversation out of the view, selects the one after it, and offers an undo.
     * @param {MailThread} thread
     * @param {Partial<MailThread>} change
     * @param {string} message Toast text.
     * @returns {void}
     */
    function file(thread, change, message) {
      const list = visible();
      const index = list.indexOf(thread);
      const before = { folder: thread.folder, until: thread.until };
      Object.assign(thread, change);
      const remaining = visible();
      const following = remaining.includes(thread) ? thread
        : list.slice(index + 1).find((entry) => remaining.includes(entry)) ?? list.slice(0, index).reverse().find((entry) => remaining.includes(entry));
      state.current = following?.id ?? null;
      if (!following && state.mode === 'read') showList({ focus: false });
      render();
      focusRow();
      remember(message, () => {
        Object.assign(thread, before);
        state.current = thread.id;
        render();
        focusRow();
      });
    }

    /** E: done, or back to the inbox when viewing Done. @param {string} [id] @returns {void} */
    function markDone(id = state.current ?? '') {
      const thread = threads.find((entry) => entry.id === id && ['inbox', 'snoozed', 'done'].includes(entry.folder));
      if (thread?.folder === 'done') file(thread, { folder: 'inbox', split: thread.split ?? 'important' }, 'Moved to Inbox.');
      else if (thread) file(thread, { folder: 'done', until: undefined }, 'Marked done.');
    }

    /** @param {Date} until @returns {void} Snoozes the selected conversation. */
    function snoozeUntil(until) {
      const thread = currentThread();
      if (thread && ['inbox', 'snoozed', 'done'].includes(thread.folder)) file(thread, { folder: 'snoozed', until: stamp(until), split: thread.split ?? 'important' }, `Snoozed until ${dueTime(until)}.`);
    }

    /** @returns {any[]} The snooze menu: presets, then a date picker. */
    function snoozeItems() {
      return [
        { type: 'heading', label: 'Snooze until' },
        ...presetItems(SNOOZE, 'clock-regular', (date) => snoozeUntil(date)),
        '-',
        { label: 'Pick date and time…', icon: 'calendar-days', onselect: () => { if (currentThread()) snoozeDialog.open(); } }
      ];
    }

    /** S: stars or unstars a conversation. @param {string} [id] @returns {void} */
    function toggleStar(id = state.current ?? '') {
      const thread = threads.find((entry) => entry.id === id);
      if (!thread) return;
      thread.starred = !thread.starred;
      render();
    }

    /** U: marks the selected conversation read or unread. @returns {void} */
    function toggleRead() {
      const thread = currentThread();
      if (!thread) return;
      thread.unread = !thread.unread;
      renderNav();
      renderList();
    }

    /** @param {MailThread} thread @returns {any[]} The actions menu for one conversation. */
    function threadActions(thread) {
      return [
        { label: thread.folder === 'done' ? 'Move to inbox' : 'Mark done', icon: 'check', adornment: kbd('E'), onselect: () => markDone(thread.id) },
        { label: thread.starred ? 'Remove star' : 'Star', icon: 'star-regular', adornment: kbd('S'), onselect: () => toggleStar(thread.id) },
        { label: thread.unread ? 'Mark as read' : 'Mark as unread', icon: 'envelope', adornment: kbd('U'), onselect: () => toggleRead() },
        { type: 'heading', label: 'Labels' },
        ...LABELS.map((entry) => ({
          label: entry.label, role: 'menuitemcheckbox', checked: thread.labels.includes(entry.id),
          onselect: () => {
            thread.labels = thread.labels.includes(entry.id) ? thread.labels.filter((id) => id !== entry.id) : [...thread.labels, entry.id];
            render();
          }
        })),
        '-',
        { label: 'Delete', icon: 'trash-can', danger: true, onselect: () => deleteThread(thread) }
      ];
    }

    /** Deletes after a confirmation. @param {MailThread} thread @returns {Promise<void>} */
    async function deleteThread(thread) {
      const confirmed = await Dialog.confirm({
        title: 'Delete conversation?', okLabel: 'Delete conversation', danger: true,
        message: `“${thread.subject}” and its ${formatNumber(thread.messages.length)} messages will be deleted.`
      });
      if (confirmed) file(thread, { folder: 'trash' }, 'Conversation deleted.');
      else refocus();
    }

    /** @returns {void} */
    function markAllRead() {
      for (const thread of visible()) thread.unread = false;
      render();
      notify('Every conversation in this view is marked as read.');
    }

    /* ------------------------------------------------------------------- writing -- */

    /**
     * R, A, F: sets the reply mode and puts the cursor in the composer. Forward opens the full
     * composer with the message quoted.
     * @param {'reply'|'all'|'forward'} mode
     * @param {{focus?: boolean}} [options]
     * @returns {void}
     */
    function startReply(mode, { focus = true } = {}) {
      const thread = currentThread();
      if (!thread) return;
      if (mode === 'forward') {
        const last = latest(thread);
        openCompose([], `Fwd: ${thread.subject}`, `\n\n— Forwarded message from ${contact(last.from).name} —\n${last.body.join('\n\n')}`);
        return;
      }
      state.reply = mode;
      for (const [id, control] of Object.entries(replyModes)) control.setAttribute('aria-pressed', String(id === mode));
      replyTo.textContent = `To ${recipients(thread).map((id) => contact(id).name).join(', ')}`;
      if (!focus || preview) return;
      if (state.mode === 'list') openThread();
      replyInput.focus();
      replyInput.scrollIntoView({ block: 'nearest' });
    }

    /** @param {MailThread} thread @returns {string[]} Who the reply goes to. */
    function recipients(thread) {
      return state.reply === 'all' ? thread.people : [thread.with];
    }

    /** Keeps the reply as a draft, confirming a moment after typing stops. @returns {void} */
    function draftChanged() {
      if (!state.current) return;
      state.drafts.set(state.current, replyInput.value);
      saved.set('active', 'Saving draft…');
      state.cancelDraft();
      state.cancelDraft = later(context, () => saved.set('success', 'Draft saved'), 700);
    }

    /** Sends the inline reply, now or at a later time. @param {Date} [at] @returns {void} */
    function sendReply(at) {
      const thread = currentThread();
      const text = replyInput.value.trim();
      if (!thread) return;
      if (!text) {
        notify('Write something first.', 'warning');
        replyInput.focus();
        return;
      }
      const message = { from: ME, at: stamp(at ?? NOW), body: text.split(/\n{2,}/) };
      const to = recipients(thread);
      const scheduled = at ? { id: `scheduled-${threads.length}`, folder: 'scheduled', until: message.at, subject: `Re: ${thread.subject}`, with: thread.with, people: to, labels: [], messages: [message] } : null;
      if (scheduled) threads.push(scheduled);
      else thread.messages.push(message);
      replyInput.value = '';
      state.drafts.delete(thread.id);
      render();
      if (scheduled) remember(`Reply scheduled for ${dueTime(at)}.`, () => { scheduled.folder = 'trash'; render(); });
      else notify(`Sent to ${to.map((id) => contact(id).name).join(', ')}.`);
    }

    /** Opens the full composer. @param {string[]} [to] Contact ids. @param {string} [subject] @param {string} [body] @returns {void} */
    function openCompose(to = [], subject = '', body = '') {
      if (preview) return;
      composeForm.setValues({ to, subject, body }, { silent: true });
      composeForm.getField('to')?.clearHighlight();
      composeSheet.setTitle(subject || 'New message');
      composeSheet.open();
      if (to.length) composeForm.focus(subject ? 'body' : 'subject');
    }

    /** Sends the composed message to Sent. @returns {void} */
    function sendCompose() {
      const values = composeForm.getValues();
      if (!values.to?.length) {
        composeForm.getField('to')?.setHighlight('Add at least one recipient.', 'error');
        return;
      }
      const people = values.to.map(String);
      threads.push({
        id: `sent-${threads.length}`, folder: 'sent', subject: values.subject || '(no subject)', with: people[0], people, labels: [],
        messages: [{ from: ME, at: stamp(NOW), body: String(values.body ?? '').split(/\n{2,}/) }]
      });
      composeSheet.close();
      renderNav();
      notify(`Sent to ${people.map((id) => contact(id).name).join(', ')}.`);
    }

    /** Closes the composer, asking first when there is text to lose. @returns {Promise<void>} */
    async function discardCompose() {
      const { subject, body } = composeForm.getValues();
      composeSheet.close();
      if ((subject || body) && !await Dialog.confirm({
        title: 'Discard this message?', message: 'The text you wrote will be lost.', okLabel: 'Discard message', danger: true
      })) composeSheet.open();
      else refocus();
    }

    /* ---------------------------------------------------------------- feedback -- */

    /** Confirms an undoable action with an Undo button; Z does the same. @param {string} label @param {() => void} revert @returns {void} */
    function remember(label, revert) {
      const entry = { revert, close: () => {} };
      state.undo.push(entry);
      const handle = /** @type {{close: () => void}|null} */ (notify(h('span', { class: 'toast-action' }, label,
        button({ label: 'Undo', size: 'sm', kind: 'ghost', onclick: () => undoLast(entry) }), kbd('Z'))));
      if (handle) entry.close = handle.close;
    }

    /** Z: reverts the last triage. @param {{revert: () => void, close: () => void}} [entry] @returns {void} */
    function undoLast(entry = state.undo[state.undo.length - 1]) {
      if (!entry || !state.undo.includes(entry)) return;
      state.undo.splice(state.undo.indexOf(entry), 1);
      entry.close();
      entry.revert();
    }

    /** Mod+K: commands, mailboxes, contacts, and conversations in one palette. @returns {void} */
    function openPalette() {
      if (!palette) return;
      const thread = currentThread();
      const command = (id, label, glyph, key, invoke, group = 'Actions') => ({ id, label, icon: glyph, badge: key, group, invoke });
      palette.setItems([
        command('compose', 'Compose', 'pen', 'C', () => openCompose()),
        command('search', 'Search this view', 'magnifying-glass', '/', () => openSearch()),
        ...(thread ? [
          command('done', 'Mark done', 'check', 'E', () => markDone()),
          command('star', thread.starred ? 'Remove star' : 'Star', 'star-regular', 'S', () => toggleStar()),
          command('reply', 'Reply', 'reply', 'R', () => startReply('reply')),
          command('forward', 'Forward', 'share', 'F', () => startReply('forward'))
        ] : []),
        command('help', 'Keyboard shortcuts', 'keyboard', '?', () => showHelp()),
        ...MAILBOXES.map((box) => command(`go-${box.id}`, `Go to ${box.label}`, box.icon, undefined, () => go(box.id, null), 'Go to')),
        ...CONTACTS.filter((entry) => entry.id !== ME).map((entry) => ({
          id: `to-${entry.id}`, label: entry.name, description: `${entry.email} · ${entry.company}`, icon: 'user',
          keywords: [entry.company, entry.email], group: 'Contacts', when: 'query', invoke: () => openCompose([entry.id])
        })),
        ...threads.filter((entry) => entry.folder !== 'trash').map((entry) => ({
          id: `thread-${entry.id}`, label: entry.subject, description: contact(entry.with).name, icon: 'envelope',
          keywords: [contact(entry.with).name, ...entry.labels], group: 'Conversations', when: 'query', invoke: () => reveal(entry.id)
        }))
      ]);
      palette.setQuery('');
      palette.open();
    }

    /** ?: the keyboard reference. @returns {void} */
    function showHelp() {
      if (preview) return;
      help ??= keep(new Dialog(null, {
        title: 'Keyboard shortcuts', size: 'lg',
        content: h('div', { class: 'mail__help' }, SHORTCUTS.map(([group, entries]) => h('section', {},
          h('h3', { class: 'panel-block__title' }, group),
          h('dl', { class: 'mail__help-list' }, entries.flatMap(([label, ...keys]) => [
            h('dt', { class: 'mail__help-label' }, label),
            h('dd', { class: 'mail__help-keys' }, kbd(...keys.map((name) => name === 'Mod' ? modifierLabel() : name)))
          ]))))),
        buttons: [{ label: 'Close', action: 'close', autofocus: true }],
        onclose: refocus
      }));
      help.open();
    }
  }
};

/**
 * Menu entries for timed presets — snooze and send later — each showing when it lands.
 * @param {(string|number)[][]} presets `[label, days from today, hour]`.
 * @param {string} glyph Icon name.
 * @param {(date: Date) => void} run
 * @returns {any[]}
 */
function presetItems(presets, glyph, run) {
  return presets.map(([label, days, hour]) => {
    const date = dayAt(Number(days), Number(hour));
    return { label: String(label), icon: glyph, adornment: dueTime(date), onselect: () => run(date) };
  });
}
