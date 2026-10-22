import {
  Avatar, Dialog, Field, Fieldset, MenuButton, button, copyToClipboard, emptyState, formatCurrency,
  formatDate, formatFileSize, formatNumber, h, icon, prefersReducedMotion, statusIcon, uid, watchMotion
} from '../../src/index.js';
import {
  DATE, adaptiveShell, disposer, iconButton, iconTile, kbd, later, layoutContext, listTime, modShortcut,
  paneHeader, panelBlock, propList, renderScope, shortcutSheet, shortcuts, suiteNav, toaster, unavailable
} from './kit.js';
import { NOW, ORGANISATION, company } from './fixtures.js';

/** The agent this screen talks to, and the mailbox it writes from. */
const AGENT = {
  name: 'Finance agent',
  description: 'Works on ACME’s invoices, bank payments, and billing mail.'
};
const MAILBOX = `billing@${ORGANISATION.domain}`;

/** What the agent may touch. It reads, it drafts, it asks before it sends, and it books nothing. */
const SCOPES = [
  { icon: 'file-invoice', label: 'Invoices', access: 'Read' },
  { icon: 'credit-card', label: 'Bank payments', access: 'Read' },
  { icon: 'comment-regular', label: 'Customer notes', access: 'Read' },
  { icon: 'envelope-regular', label: 'Billing mailbox', access: 'Writes drafts, sends after you approve' },
  { icon: 'lock', label: 'Bookings and invoice changes', access: 'No access' }
];

/** September invoices more than 14 days past their due date. */
const OVERDUE = [
  { company: 'helios', invoice: 'RE-2026-0121', due: '2026-09-15', amount: 4860 },
  { company: 'bruckner', invoice: 'RE-2026-0126', due: '2026-09-20', amount: 12340 },
  { company: 'northstar', invoice: 'RE-2026-0129', due: '2026-09-22', amount: 2175.5 }
];

/** The first-reminder template from the dunning policy; braces are filled in per recipient. */
const TEMPLATE = {
  subject: 'Reminder: invoice {invoice} is overdue',
  body: [
    'Dear {name},',
    'Our invoice {invoice} for {amount} was due on {due}, and we have not received your payment yet. If you have paid in the meantime, please ignore this reminder.',
    `You can transfer the amount to IBAN ${ORGANISATION.iban}, quoting the invoice number.`,
    'Kind regards\nACME Billing'
  ].join('\n\n')
};

/** Price per token, for the cost line: input and output. */
const PRICE = { in: 0.000006, out: 0.00002 };
const BUDGET = 2;

/** Requests offered in an empty conversation. */
const SUGGESTIONS = [
  'Find supplier invoices that were paid twice',
  'Summarise this week’s incoming payments',
  'List the invoices due next week'
];

/** What the agent says to a request this example has no script for — honestly. */
const EXAMPLE_REPLY = [
  'This example only scripts the September reconciliation, so I can’t act on that here.',
  'In a real run you’d see every step I take in this thread — what I asked each system and what came back — and I’d stop and ask you before sending mail or changing a record.'
];

/** What the agent says to a message that arrives while it waits for an approval. */
const WAITING_REPLY = 'Noted. The reminders are still waiting for your answer above — nothing is sent until you approve them.';

/**
 * @typedef {'todo'|'running'|'waiting'|'done'|'failed'|'stopped'|'skipped'} StepStatus
 * @typedef {'working'|'waiting'|'done'|'failed'|'stopped'} RunState
 * @typedef {{id: string, label: string, status: StepStatus, ms?: number}} PlanStep
 * @typedef {{name: string, size: number}} Attachment
 * @typedef {{type: 'p', text: string} | {type: 'figures', rows: [string, string, string][]}} AnswerBlock
 * @typedef {{id: string, type: 'user', at: string, text: string, files?: Attachment[]}} UserItem
 * @typedef {{id: string, type: 'text', at?: string, text: string}} TextItem
 * @typedef {{id: string, type: 'plan', at?: string}} PlanItem
 * @typedef {{id: string, type: 'call', at?: string, step?: string, status: StepStatus, label: string,
 *   count?: string, ms?: number, tool: string, args: string, result: string}} CallItem
 * @typedef {{id: string, type: 'approval', at: string, step: string, status: 'pending'|'approved'|'rejected',
 *   recipients: string[], subject: string, body: string, edited?: boolean, answered?: string,
 *   reason?: string}} ApprovalItem
 * @typedef {{id: string, type: 'answer', at?: string, blocks: AnswerBlock[], cites?: boolean,
 *   streaming?: boolean, shown?: number, stopped?: boolean}} AnswerItem
 * @typedef {UserItem|TextItem|PlanItem|CallItem|ApprovalItem|AnswerItem} ThreadItem
 * @typedef {{id: string, label: string, icon: string, call: string}} Source
 * @typedef {{state: RunState, started: string, workMs: number, waitingSince?: string,
 *   finished?: string, error?: string, tokens: [number, number], resumedAt?: number}} Run
 * @typedef {{id: string, title: string, updated: string, steps: PlanStep[], items: ThreadItem[],
 *   sources: Source[], run: Run|null, busy?: boolean}} Conversation
 * @typedef {{conv: Conversation, timers: Set<number>, interval: number, flush: (() => void)|null,
 *   onstop: () => void}} Activity What the agent is doing in one conversation, and how to end it.
 */

/**
 * The agent's conversations, newest first. The first is the one on screen: the agent has
 * reconciled September and is waiting for approval to send three reminders.
 * @type {Conversation[]}
 */
const CONVERSATIONS = [
  {
    id: 'reconcile',
    title: 'Reconcile September invoices',
    updated: '2026-10-08T10:28',
    steps: [
      { id: 'policy', label: 'Read the dunning policy', status: 'done', ms: 600 },
      { id: 'invoices', label: 'Find September’s open invoices', status: 'done', ms: 800 },
      { id: 'payments', label: 'Match them against bank payments', status: 'done', ms: 12100 },
      { id: 'notes', label: 'Check customer notes for disputes', status: 'done', ms: 1400 },
      { id: 'drafts', label: 'Draft reminders for anything overdue', status: 'done', ms: 3200 },
      { id: 'send', label: 'Send the reminders once you approve', status: 'waiting' }
    ],
    items: [
      { id: 'ask', type: 'user', at: '2026-10-08T10:27', text: 'Reconcile last month’s open invoices and draft reminders for anything overdue. Follow the attached policy.', files: [{ name: 'Dunning policy 2026.pdf', size: 188_416 }] },
      { id: 'intro', type: 'text', at: '2026-10-08T10:27', text: 'I’ll check September against the bank feed and the customer notes, then draft reminders. Nothing goes out without your approval.' },
      { id: 'plan', type: 'plan' },
      { id: 'policy', type: 'call', step: 'policy', status: 'done', label: 'Read Dunning policy 2026.pdf', count: '4 pages', ms: 600, tool: 'files.read',
        args: '{\n  "file": "Dunning policy 2026.pdf"\n}',
        result: 'First reminder 14 days after the due date, template "reminder-1".\nSecond reminder after 28 days, with a €5.00 fee.\nNo reminder while a customer disputes the invoice.' },
      { id: 'invoices', type: 'call', step: 'invoices', status: 'done', label: 'Queried invoices', count: '42 rows', ms: 800, tool: 'invoices.search',
        args: '{\n  "issued": "2026-09-01..2026-09-30",\n  "fields": ["number", "customer", "total", "due", "status"]\n}',
        result: '42 invoices, €209,575.50 in total\n29 marked paid, 13 open' },
      { id: 'bank-1', type: 'call', step: 'payments', status: 'failed', label: 'Fetched bank payments', count: 'timed out', ms: 10000, tool: 'bank.transactions',
        args: '{\n  "account": "DE12 …4567 89",\n  "booked": "2026-09-01..2026-10-07"\n}',
        result: 'The bank feed did not answer within 10 s. Nothing was read; retrying once.' },
      { id: 'bank-2', type: 'call', step: 'payments', status: 'done', label: 'Fetched bank payments', count: 'retry, 57 transactions', ms: 2100, tool: 'bank.transactions',
        args: '{\n  "account": "DE12 …4567 89",\n  "booked": "2026-09-01..2026-10-07"\n}',
        result: '57 transactions\n31 match a September invoice; RE-2026-0117 and RE-2026-0133 are paid but not booked\n26 belong to other months' },
      { id: 'notes', type: 'call', step: 'notes', status: 'done', label: 'Read customer notes', count: '4 customers', ms: 1400, tool: 'customers.notes',
        args: '{\n  "customers": ["Helios Energie", "Bruckner Logistik",\n                "Northstar Freight", "Kestrel Analytics"]\n}',
        result: 'Kestrel Analytics: RE-2026-0138 reissued on 7 Oct with PO 4500-2291, new due date 21 Oct.\nThe other three: no open disputes.' },
      { id: 'drafts', type: 'call', step: 'drafts', status: 'done', label: 'Drafted 3 reminders', count: 'not sent', ms: 3200, tool: 'mail.drafts.create',
        args: '{\n  "template": "reminder-1",\n  "invoices": ["RE-2026-0121", "RE-2026-0126", "RE-2026-0129"]\n}',
        result: `3 drafts saved in ${MAILBOX} › Drafts. Nothing has been sent.` },
      { id: 'findings', type: 'text', text: 'September has 42 invoices. Two that still look open were paid on 30 September but aren’t booked yet. Of the other 11, four looked overdue — but Kestrel’s RE-2026-0138 was reissued on 7 October with a new due date. That leaves three more than 14 days late, and I’ve drafted a first reminder for each.' },
      { id: 'approval', type: 'approval', at: '2026-10-08T10:28', step: 'send', status: 'pending', recipients: OVERDUE.map((entry) => entry.company), subject: TEMPLATE.subject, body: TEMPLATE.body }
    ],
    sources: [
      { id: 'invoices', label: 'Invoices · September 2026', icon: 'file-invoice', call: 'invoices' },
      { id: 'bank', label: 'Bank payments · 1 Sep – 7 Oct', icon: 'credit-card', call: 'bank-2' },
      { id: 'notes', label: 'Customer notes · Kestrel Analytics', icon: 'comment-regular', call: 'notes' },
      { id: 'policy', label: 'Dunning policy 2026.pdf', icon: 'file-pdf', call: 'policy' }
    ],
    run: { state: 'waiting', started: '2026-10-08T10:27:40', workMs: 41_000, waitingSince: '2026-10-08T10:28:21', tokens: [18_420, 1_236] }
  },
  {
    id: 'forecast',
    title: 'Cash forecast for October',
    updated: '2026-10-08T08:52',
    steps: [],
    items: [
      { id: 'ask', type: 'user', at: '2026-10-08T08:52', text: 'What does cash look like for October? Use the open invoices and the payroll calendar.' },
      { id: 'open', type: 'call', at: '2026-10-08T08:52', status: 'done', label: 'Queried open invoices', count: '58 rows', ms: 900, tool: 'invoices.search',
        args: '{\n  "status": "open",\n  "due": "2026-10-01..2026-10-31"\n}', result: '58 invoices, €246,800.00 expected' },
      { id: 'payroll', type: 'call', status: 'done', label: 'Read the payroll calendar', count: '2 runs', ms: 400, tool: 'hr.payroll',
        args: '{\n  "month": "2026-10"\n}', result: 'Payroll on 15 Oct and 27 Oct, €171,200.00 together\n14 supplier bills due, €13,200.00' },
      { id: 'answer', type: 'answer', cites: true, blocks: [
        { type: 'p', text: 'October should close about €62,400.00 ahead [1][2].' },
        { type: 'figures', rows: [['Expected in', '58 invoices', '€246,800.00'], ['Going out', 'Payroll and 14 bills', '€184,400.00']] },
        { type: 'p', text: 'The tightest day is 27 October, when the second payroll leaves three days before Alpine Works’ €38,000.00 is due [1][2].' }
      ] }
    ],
    sources: [
      { id: 'open', label: 'Open invoices · October 2026', icon: 'file-invoice', call: 'open' },
      { id: 'payroll', label: 'Payroll calendar · October', icon: 'calendar-regular', call: 'payroll' }
    ],
    run: { state: 'done', started: '2026-10-08T08:52:10', workMs: 14_000, finished: '2026-10-08T08:52:24', tokens: [9_840, 612] }
  },
  {
    id: 'bankfeed',
    title: 'Sync the bank feed for October',
    updated: '2026-10-07T17:40',
    steps: [],
    items: [
      { id: 'ask', type: 'user', at: '2026-10-07T17:40', text: 'Pull October’s bank transactions and match what you can.' },
      { id: 'connect', type: 'call', at: '2026-10-07T17:40', status: 'failed', label: 'Connected to the bank feed', count: 'consent expired', ms: 1300, tool: 'bank.transactions',
        args: '{\n  "account": "DE12 …4567 89",\n  "booked": "2026-10-01..2026-10-07"\n}',
        result: '403 consent_expired: the account access consent ended on 6 Oct 2026.' },
      { id: 'explain', type: 'text', text: 'I couldn’t reach the bank: the access consent for the account ended on 6 October. Nothing was imported or matched. Once the consent is renewed under Settings › Bank accounts, ask me again.' }
    ],
    sources: [],
    run: { state: 'failed', started: '2026-10-07T17:40:05', workMs: 6_000, finished: '2026-10-07T17:40:11', error: 'The bank feed’s access consent ended on 6 October.', tokens: [3_120, 214] }
  },
  {
    id: 'late',
    title: 'Who pays late most often?',
    updated: '2026-10-02T15:05',
    steps: [],
    items: [
      { id: 'ask', type: 'user', at: '2026-10-02T15:05', text: 'Who pays late most often this year?' },
      { id: 'paid', type: 'call', at: '2026-10-02T15:05', status: 'done', label: 'Queried paid invoices', count: '412 rows', ms: 1100, tool: 'invoices.search',
        args: '{\n  "status": "paid",\n  "issued": "2026-01-01..2026-09-30"\n}', result: '412 invoices, 37 paid after their due date' },
      { id: 'answer', type: 'answer', cites: true, blocks: [
        { type: 'p', text: 'Three customers account for most late payments this year [1]:' },
        { type: 'figures', rows: [['Bruckner Logistik', '9 of 14 late', '12 days on average'], ['Helios Energie', '5 of 11 late', '9 days on average'], ['Northstar Freight', '4 of 16 late', '6 days on average']] },
        { type: 'p', text: 'Everyone else paid on time at least nine times out of ten.' }
      ] }
    ],
    sources: [{ id: 'paid', label: 'Paid invoices · January to September', icon: 'file-invoice', call: 'paid' }],
    run: { state: 'done', started: '2026-10-02T15:05:02', workMs: 9_000, finished: '2026-10-02T15:05:11', tokens: [7_200, 388] }
  },
  {
    id: 'accruals',
    title: 'Open accruals for the Q3 close',
    updated: '2026-09-29T11:20',
    steps: [],
    items: [
      { id: 'ask', type: 'user', at: '2026-09-29T11:20', text: 'List the open accruals for the Q3 close.' },
      { id: 'ledger', type: 'call', at: '2026-09-29T11:20', status: 'done', label: 'Queried the general ledger', count: '6 accruals', ms: 700, tool: 'ledger.accruals',
        args: '{\n  "period": "2026-Q3",\n  "status": "open"\n}', result: '6 open accruals, 2 without an amount' },
      { id: 'answer', type: 'answer', cites: true, blocks: [
        { type: 'p', text: 'Six accruals are open for Q3, and two still need an amount: the Atelier West workshop deposit and Bruckner’s September freight [1].' }
      ] }
    ],
    sources: [{ id: 'ledger', label: 'General ledger · Q3 2026', icon: 'table-list', call: 'ledger' }],
    run: { state: 'done', started: '2026-09-29T11:20:04', workMs: 7_000, finished: '2026-09-29T11:20:11', tokens: [5_480, 301] }
  }
];

/** How each step and run state reads, and the `statusIcon()` status and tone that show it. */
const STATUS = {
  todo: { label: 'Not started', status: 'todo', tone: 'neutral' },
  running: { label: 'Running', status: 'in-progress', tone: 'info' },
  working: { label: 'Working', status: 'in-progress', tone: 'info' },
  waiting: { label: 'Waiting for you', status: 'waiting', tone: 'warning' },
  done: { label: 'Done', status: 'done', tone: 'success' },
  failed: { label: 'Failed', status: 'canceled', tone: 'danger' },
  stopped: { label: 'Stopped', status: 'canceled', tone: 'muted' },
  skipped: { label: 'Skipped', status: 'canceled', tone: 'muted' }
};

/**
 * @param {{status: string, tone: string}} entry A `STATUS` entry.
 * @returns {HTMLSpanElement} Its glyph, decorative: the words beside it say the state.
 */
function stateIcon(entry) {
  return statusIcon(entry.status, { tone: /** @type {any} */ (entry.tone) });
}

/** The keyboard reference the `?` key opens. */
const SHORTCUTS = [
  ['Conversation', [['Send', 'Mod+Enter'], ['Stop the run', 'Esc'], ['Write a message', '/'], ['New conversation', 'N']]],
  ['Approval, when it has focus', [['Approve', 'A'], ['Edit', 'E'], ['Reject', 'R']]],
  ['View', [['Navigation', 'Mod+B'], ['Run details', 'Mod+I'], ['Keyboard shortcuts', '?']]]
];

/** @param {string} value `YYYY-MM-DDTHH:MM[:SS]`, local time. @returns {Date} */
function toDate(value) {
  return new Date(value.length === 10 ? `${value}T00:00` : value);
}

/** @param {Date} date @returns {string} The fixtures' timestamp format, to the second. */
function stamp(date) {
  return formatDate(date, '%Y-%m-%dT%H:%M:%S');
}

/** @param {string} value @returns {string} The clock time, "10:28". */
function clockTime(value) {
  return formatDate(toDate(value), DATE.time);
}

/** @param {number} ms @returns {string} How long a step took: "0.8 s", "12 s", "1 min 42 s". */
function duration(ms) {
  if (ms < 10_000) return `${formatNumber(ms / 1000, { decimals: 1 })} s`;
  return elapsed(ms);
}

/** @param {number} ms @returns {string} A running clock, in whole seconds: "2 s", "41 s", "1 min 42 s". */
function elapsed(ms) {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds} s`;
  return `${Math.floor(seconds / 60)} min ${seconds % 60} s`;
}

/** @param {number} amount @returns {string} */
function euro(amount) {
  return formatCurrency(amount, 'EUR');
}

/** @param {number} n @param {string} noun Singular. @returns {string} "3 reminder emails". */
function count(n, noun) {
  return `${formatNumber(n)} ${noun}${n === 1 ? '' : 's'}`;
}

/** @param {string[]} names @returns {string} "A, B and C". */
function listNames(names) {
  return names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}

/** @param {[number, number]} tokens Input and output. @returns {number} */
function costOf([input, output]) {
  return input * PRICE.in + output * PRICE.out;
}

/** @param {string} id Company id. @returns {typeof OVERDUE[number] & {name: string, contact: string, email: string, days: number}} */
function reminder(id) {
  const entry = OVERDUE.find((candidate) => candidate.company === id) ?? OVERDUE[0];
  const customer = company(entry.company);
  const days = Math.round((new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate()).getTime() - toDate(entry.due).getTime()) / 86_400_000);
  return { ...entry, name: customer?.name ?? '', contact: customer?.contact ?? '', email: customer?.email ?? '', days };
}

/** @param {string} text Template text. @param {string} id Company id. @returns {string} Filled in for one recipient. */
function fill(text, id) {
  const entry = reminder(id);
  const values = { name: entry.contact, invoice: entry.invoice, amount: euro(entry.amount), due: formatDate(toDate(entry.due), DATE.long) };
  return text.replace(/\{(name|invoice|amount|due)\}/g, (match, key) => values[key] ?? match);
}

/**
 * Splits answer text into words and citation markers: "paid [1][2]." becomes the text and two
 * markers.
 * @param {string} text
 * @returns {Array<string|number>}
 */
function citations(text) {
  return text.split(/(\[\d+\])/).filter(Boolean).map((part) => (/^\[\d+\]$/.test(part) ? Number(part.slice(1, -1)) : part));
}

/** @param {AnswerItem} answer @returns {number} How many units the answer streams in: words, and a whole figures table. */
function unitsOf(answer) {
  return answer.blocks.reduce((sum, block) => sum + (block.type === 'p' ? block.text.split(' ').length : 1), 0);
}

/**
 * The answer the run ends with, written from what the reader decided.
 * @param {ApprovalItem} approval
 * @returns {AnswerBlock[]}
 */
function closingAnswer(approval) {
  const sent = approval.status === 'approved' ? approval.recipients : [];
  const unsent = OVERDUE.map((entry) => entry.company).filter((id) => !sent.includes(id));
  const total = (ids) => euro(ids.reduce((sum, id) => sum + reminder(id).amount, 0));
  const rows = /** @type {[string, string, string][]} */ ([
    ['Paid', '31 invoices', '€148,220.00'],
    ['Not due yet', '8 invoices', '€41,980.00']
  ]);
  if (sent.length) rows.push(['Overdue, reminded', count(sent.length, 'invoice'), total(sent)]);
  if (unsent.length) rows.push(['Overdue, no reminder yet', count(unsent.length, 'invoice'), total(unsent)]);
  const names = (ids) => listNames(ids.map((id) => reminder(id).name));
  return [
    approval.status === 'rejected'
      ? { type: 'p', text: `Understood — I sent nothing. The reminders stay in Drafts in ${MAILBOX}, so you can send them yourself or ask me again later.` }
      : null,
    { type: 'p', text: 'September is reconciled: 42 invoices, €209,575.50 in total [1][2].' },
    { type: 'figures', rows },
    sent.length
      ? { type: 'p', text: `I sent first reminders to ${names(sent)} from ${MAILBOX}, using the template in your policy [4]. Replies will arrive there.${unsent.length ? ` ${names(unsent)} got none, as you asked.` : ''}` }
      : null,
    { type: 'p', text: 'For the books: RE-2026-0117 and RE-2026-0133 were paid on 30 September but aren’t booked yet [2], and Kestrel’s RE-2026-0138 isn’t overdue — it was reissued with a due date of 21 October [3].' }
  ].filter((block) => block !== null);
}

export default {
  title: 'Agent chat',
  category: 'Pattern',
  blurb: 'One conversation with an agent that acts: its plan, every tool call, an approval that holds the run, a streamed answer with sources, and the run beside it.',
  components: [
    'Avatar', 'Dialog', 'Field', 'Fieldset', 'MenuButton', 'Message', 'statusIcon', 'AppSidebar', 'ModuleBar',
    'AccountMenu'
  ],

  /**
   * Mounts the agent conversation: the agent's other conversations, the thread with its plan,
   * tool calls, approval, and answer, the composer, and the run inspector.
   * @param {HTMLElement} container Gallery stage.
   * @param {import('./kit.js').LayoutContext} [context]
   * @returns {void}
   */
  mount(container, context) {
    context = layoutContext(context);
    const keep = disposer(context);
    const { preview } = context;

    /* ------------------------------------------------------------ conversations -- */

    const history = h('div', { class: 'agent-chat__history', role: 'region', 'aria-label': 'Conversations', tabindex: '-1' });
    // The suite's navigation: the agent's conversations, under the way to start a new one.
    const nav = suiteNav(context, {
      module: 'assistant',
      header: button({ label: 'New conversation', icon: 'pen-to-square', shortcut: { label: 'N', keys: 'N' }, onclick: () => newConversation() }),
      content: h('div', { class: 'agent-chat__conversations' },
        h('h2', { class: 'agent-chat__agent' }, iconTile('robot', 'violet'), AGENT.name),
        history)
    });
    const root = h('div', { class: 'agent-chat shell' }, nav.column);
    // Narrow, the conversations and the run become drawers; Mod+B minimizes the navigation and
    // Mod+I toggles the run.
    const shell = adaptiveShell(root, context, {
      navLabel: 'Show conversations', asideLabel: 'Show run details', keys: true
    });

    // Mutable copies: runs move on, approvals get answered, and new conversations start.
    const conversations = /** @type {Conversation[]} */ (structuredClone(CONVERSATIONS));
    const state = {
      current: conversations[0].id,
      /** @type {Set<string>} Tool calls opened to their arguments and result, `conversation:call`. */
      expanded: new Set(),
      /** @type {Set<string>} Approvals whose email is shown. */
      email: new Set(),
      /** @type {Attachment[]} Files waiting in the composer. */
      files: [],
      seq: 0
    };
    // The layouts' world starts at NOW; once the reader acts, its clock runs on from there.
    const mountedAt = performance.now();
    const clock = () => new Date(NOW.getTime() + (preview ? 0 : performance.now() - mountedAt));

    /**
     * What the agent is doing in each conversation — a run step, or an answer being written — with
     * the timers that drive it, so Stop and unmount can end it. One per conversation at most; a
     * run carries on while the reader looks at another conversation.
     * @type {Map<string, Activity>}
     */
    const activities = new Map();
    /** @type {number} The working-time ticker. */
    let ticker = 0;
    context.cleanup(() => {
      for (const own of activities.values()) cancel(own);
      activities.clear();
      clearInterval(ticker);
    });

    const threadParts = renderScope(context);

    /* ------------------------------------------------------------------ thread -- */

    // Narrow, where the run column has given way, its state rides in the header.
    const pill = h('span', { class: 'agent-chat__pill' });
    const more = keep(new MenuButton(iconButton('ellipsis', 'Conversation actions'), {
      kind: 'ghost', placement: 'bottom-end',
      items: [
        { label: 'New conversation', icon: 'pen-to-square', adornment: kbd('N'), onselect: () => newConversation() },
        { label: 'Copy transcript', icon: 'copy-regular', onselect: () => copyTranscript() },
        { label: 'Keyboard shortcuts', icon: 'keyboard', adornment: kbd('?'), onselect: () => openShortcuts() }
      ]
    }));
    const header = paneHeader({ leading: shell.navToggle(), title: '', actions: [pill, more.toElement(), shell.asideToggle()] });
    const heading = /** @type {HTMLElement} */ (header.querySelector('.shell__title'));
    const column = h('div', { class: 'agent-chat__column' });
    const thread = h('div', { class: 'shell__body agent-chat__thread', role: 'region', 'aria-label': 'Messages', tabindex: '0' }, column);
    const announcer = h('p', { class: 'visually-hidden', role: 'status' });

    /* ---------------------------------------------------------------- composer -- */

    const input = /** @type {HTMLTextAreaElement} */ (h('textarea', {
      class: 'agent-chat__input', rows: 1, 'aria-label': 'Message', placeholder: 'Ask a follow-up or give an instruction',
      'aria-keyshortcuts': modShortcut('Enter').keys
    }));
    const fileInput = /** @type {HTMLInputElement} */ (h('input', { type: 'file', multiple: true, hidden: true, tabindex: '-1' }));
    const chips = h('ul', { class: 'agent-chat__chips', 'aria-label': 'Attachments', hidden: true });
    const hint = h('span', { class: 'agent-chat__hint', 'data-narrow': 'hide' });
    const sendButton = /** @type {HTMLButtonElement} */ (h('button', {
      type: 'button', class: 'zx-icon-btn agent-chat__send', onclick: () => (busy() ? stop() : send())
    }));
    const composer = h('div', { class: 'agent-chat__composer', role: 'group', 'aria-label': 'Message the agent' },
      chips,
      input,
      h('div', { class: 'agent-chat__bar' },
        iconButton('paperclip', 'Attach files', () => fileInput.click()), fileInput, hint,
        h('span', { class: 'shell__spacer' }), sendButton));
    const main = h('section', { class: 'shell__main agent-chat__main', 'aria-label': 'Conversation' },
      header, thread,
      h('div', { class: 'agent-chat__dock' }, composer,
        h('p', { class: 'agent-chat__note' }, 'The agent asks before it sends anything or changes a record.')),
      announcer);

    /* --------------------------------------------------------------------- run -- */

    const runBody = h('div', { class: 'shell__body agent-chat__run', tabindex: '-1' });
    const aside = h('aside', { class: 'shell__aside agent-chat__aside', 'aria-label': 'Run' },
      paneHeader({ title: 'Run' }), runBody);

    root.append(main, aside);
    const notify = toaster(context, root);
    const openShortcuts = shortcutSheet(context, SHORTCUTS, { onclose: () => refocus() });
    /** @type {{dialog: Dialog, picks: HTMLElement, error: HTMLElement, form: Fieldset}|null} The edit dialog, once opened. */
    let editor = null;
    /** @type {{dialog: Dialog, reason: Field}|null} The reject dialog, once opened. */
    let rejecting = null;
    more.on('close', () => refocus());

    /* ---------------------------------------------------------------- keyboard -- */

    shortcuts(root, {
      'Mod+Enter': () => (busy() ? false : send()),
      // Escape stops what the agent is doing; with nothing running it declines the key, so a
      // surrounding dialog can close instead.
      Escape: () => (busy() ? stop() : false),
      a: (event) => onApproval(event, () => approve()),
      e: (event) => onApproval(event, () => openEdit()),
      r: (event) => onApproval(event, () => openReject()),
      n: () => newConversation(),
      '/': () => focusComposer(),
      '?': () => openShortcuts()
    }, context);
    // In the text the plain keys belong to the text, so the composer handles its own Escape.
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && busy()) {
        event.preventDefault();
        stop();
      }
    });
    input.addEventListener('input', () => {
      autosize();
      syncComposer();
    });
    fileInput.addEventListener('change', () => {
      for (const file of fileInput.files ?? []) state.files.push({ name: file.name, size: file.size });
      fileInput.value = '';
      renderChips();
      syncComposer();
      input.focus();
    });
    // The arrow keys walk the conversation list.
    history.addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
      const rows = /** @type {HTMLElement[]} */ ([...history.querySelectorAll('.agent-chat__conv')]);
      const index = rows.indexOf(/** @type {HTMLElement} */ (document.activeElement));
      if (index < 0) return;
      event.preventDefault();
      rows[Math.max(0, Math.min(rows.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)))].focus();
    });
    // Motion that starts in script stops with the reader's preference: an answer being written
    // word by word is finished at once.
    watchMotion(root, (reduced) => {
      if (reduced) for (const own of [...activities.values()]) own.flush?.();
    }, { signal: context.signal });

    container.append(root);
    render();
    scrollToEnd();
    if (!preview) {
      // The run is waiting on the approval, so that is where the keys start — without a focus
      // ring, since nothing has been pressed yet.
      const card = column.querySelector('.agent-chat__approval[data-state="pending"]');
      if (card instanceof HTMLElement) card.focus({ preventScroll: true, focusVisible: false });
    }

    /* ------------------------------------------------------------------ queries -- */

    /** @returns {Conversation} */
    function current() {
      return conversations.find((conv) => conv.id === state.current) ?? conversations[0];
    }

    /** @returns {boolean} Whether the agent is doing something in the conversation on screen. */
    function busy() {
      return Boolean(current().busy);
    }

    /** @param {Conversation} conv @returns {ApprovalItem|undefined} The approval holding the run. */
    function pendingApproval(conv) {
      return /** @type {ApprovalItem|undefined} */ (conv.items.find((item) => item.type === 'approval' && item.status === 'pending'));
    }

    /** @param {Conversation} conv @returns {CallItem[]} */
    function callsOf(conv) {
      return /** @type {CallItem[]} */ (conv.items.filter((item) => item.type === 'call'));
    }

    /**
     * The run's steps: its plan when it has one, otherwise its tool calls.
     * @param {Conversation} conv
     * @returns {{id: string, label: string, status: StepStatus, ms?: number, target: string|null}[]}
     */
    function stepsOf(conv) {
      if (conv.steps.length) {
        return conv.steps.map((step) => {
          const call = callsOf(conv).find((entry) => entry.step === step.id);
          const approval = conv.items.find((item) => item.type === 'approval' && item.step === step.id);
          return { ...step, target: approval ? `approval:${approval.id}` : call ? `call:${call.id}` : null };
        });
      }
      return callsOf(conv).map((call) => ({ id: call.id, label: call.label, status: call.status, ms: call.ms, target: `call:${call.id}` }));
    }

    /** @param {Run} run @returns {number} Milliseconds the agent has worked, including now. */
    function workTime(run) {
      return run.workMs + (run.state === 'working' && run.resumedAt ? performance.now() - run.resumedAt : 0);
    }

    /* ---------------------------------------------------------------- rendering -- */

    /** Redraws every region from the state. @param {{follow?: boolean}} [options] @returns {void} */
    function render({ follow = false } = {}) {
      renderHistory();
      renderHeader();
      renderThread({ follow });
      renderRun();
      syncComposer();
      syncTicker();
    }

    /**
     * Rebuilds a region and puts the focus back on the control that had it, found again by its
     * `data-key` — rows and buttons are new elements after a redraw.
     * When that control is gone the region itself takes the focus, so it never drops to the page.
     * @param {HTMLElement} region
     * @param {() => void} build
     * @returns {void}
     */
    function rebuild(region, build) {
      const active = document.activeElement;
      const inside = active instanceof HTMLElement && region.contains(active) && active !== region;
      const key = inside ? active.dataset.key : null;
      build();
      if (!inside || preview) return;
      if (!(key && focusKey(key, region)) && !region.contains(document.activeElement)) region.focus({ preventScroll: true });
    }

    /**
     * @param {string} key
     * @param {ParentNode} [scope]
     * @returns {boolean} Whether an element with that key took focus.
     */
    function focusKey(key, scope = root) {
      const target = scope.querySelector(`[data-key="${CSS.escape(key)}"]`);
      if (!(target instanceof HTMLElement)) return false;
      target.focus({ preventScroll: true });
      return document.activeElement === target;
    }

    /** The agent's conversations, grouped by day. @returns {void} */
    function renderHistory() {
      const today = formatDate(NOW, '%Y-%m-%d');
      const yesterday = formatDate(new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() - 1), '%Y-%m-%d');
      const groups = [['Today', []], ['Yesterday', []], ['Earlier', []]];
      for (const conv of conversations) {
        const day = conv.updated.slice(0, 10);
        groups[day === today ? 0 : day === yesterday ? 1 : 2][1].push(conv);
      }
      rebuild(history, () => history.replaceChildren(...groups.filter(([, list]) => list.length).map(([label, list]) => h('section', { class: 'agent-chat__group' },
        h('h3', { class: 'list-group' }, label),
        h('ul', { class: 'agent-chat__convs', role: 'list' }, list.map((conv) => h('li', {}, conversationRow(conv))))))));
    }

    /**
     * One conversation: its title, then the state of its run and when it last moved.
     * @param {Conversation} conv
     * @returns {HTMLButtonElement}
     */
    function conversationRow(conv) {
      const run = conv.run;
      const status = run ? STATUS[run.state] : null;
      return /** @type {HTMLButtonElement} */ (h('button', {
        type: 'button', class: 'list-row agent-chat__conv', dataset: { key: `conv:${conv.id}` },
        'aria-current': conv.id === state.current ? 'page' : null,
        onclick: () => openConversation(conv.id)
      },
      h('span', { class: 'list-row__title' }, conv.title),
      h('span', { class: 'agent-chat__conv-meta' },
        status ? stateIcon(status) : null,
        h('span', { class: 'agent-chat__conv-state' }, status?.label ?? 'No run yet'),
        h('span', { class: 'agent-chat__conv-time' }, listTime(toDate(conv.updated))))));
    }

    /** The title and, narrow, the run's state. @returns {void} */
    function renderHeader() {
      const conv = current();
      heading.textContent = conv.title;
      const status = conv.run ? STATUS[conv.run.state] : null;
      pill.hidden = !status;
      if (status) pill.replaceChildren(stateIcon(status), h('span', { class: 'agent-chat__pill-text' }, status.label));
    }

    /**
     * Redraws the thread: the turns, the plan, the tool calls, the approval, and the answers.
     * @param {{follow?: boolean}} [options] `follow` scrolls to the end after drawing; the thread
     *   also stays at the end when it already was there.
     * @returns {void}
     */
    function renderThread({ follow = false } = {}) {
      const conv = current();
      const atEnd = thread.scrollHeight - thread.scrollTop - thread.clientHeight < 48;
      rebuild(thread, () => {
        threadParts.reset();
        column.replaceChildren(...(conv.items.length ? turns(conv) : [welcome()]));
      });
      if (follow || atEnd) scrollToEnd();
    }

    /** @returns {void} */
    function scrollToEnd() {
      thread.scrollTop = thread.scrollHeight;
    }

    /**
     * Groups the items into turns: each message of the reader's, and everything the agent does
     * in between under one byline.
     * @param {Conversation} conv
     * @returns {HTMLElement[]}
     */
    function turns(conv) {
      /** @type {HTMLElement[]} */
      const out = [];
      /** @type {ThreadItem[]} */
      let agent = [];
      const flush = () => {
        if (agent.length) out.push(agentTurn(conv, agent));
        agent = [];
      };
      for (const item of conv.items) {
        if (item.type === 'user') {
          flush();
          out.push(userTurn(item));
        } else agent.push(item);
      }
      flush();
      return out;
    }

    /** @param {UserItem} item @returns {HTMLElement} The reader's message, on the far side. */
    function userTurn(item) {
      return h('article', { class: 'agent-chat__turn', dataset: { role: 'user' }, 'aria-label': `You, ${clockTime(item.at)}` },
        h('div', { class: 'agent-chat__bubble' },
          item.files?.length ? h('ul', { class: 'agent-chat__chips', 'aria-label': 'Attachments' }, item.files.map((file) => fileChip(file))) : null,
          item.text ? h('p', { class: 'agent-chat__bubble-text' }, item.text) : null),
        h('time', { class: 'agent-chat__time', dateTime: item.at }, clockTime(item.at)));
    }

    /**
     * Everything the agent did for one message: narration, the plan, its tool calls (grouped),
     * the approval it asked for, and its answer.
     * @param {Conversation} conv
     * @param {ThreadItem[]} items
     * @returns {HTMLElement}
     */
    function agentTurn(conv, items) {
      const at = items.find((item) => item.at)?.at ?? conv.updated;
      /** @type {HTMLElement[]} */
      const parts = [];
      /** @type {CallItem[]} */
      let calls = [];
      const flushCalls = () => {
        if (calls.length) parts.push(callList(conv, calls));
        calls = [];
      };
      for (const item of items) {
        if (item.type === 'call') {
          calls.push(item);
          continue;
        }
        flushCalls();
        if (item.type === 'text') parts.push(h('p', { class: 'agent-chat__text' }, item.text));
        else if (item.type === 'plan') parts.push(planBlock(conv));
        else if (item.type === 'approval') parts.push(approvalCard(conv, item));
        else if (item.type === 'answer') parts.push(answerBlock(conv, item));
      }
      flushCalls();
      return h('article', { class: 'agent-chat__turn', dataset: { role: 'agent' }, 'aria-label': `${AGENT.name}, ${clockTime(at)}` },
        h('div', { class: 'agent-chat__byline' },
          iconTile('robot', 'violet'),
          h('span', { class: 'agent-chat__author' }, AGENT.name),
          h('time', { class: 'agent-chat__time', dateTime: at }, clockTime(at))),
        h('div', { class: 'agent-chat__flow' }, parts));
    }

    /** @param {Conversation} conv @returns {HTMLElement} The plan, each step with its state. */
    function planBlock(conv) {
      const done = conv.steps.filter((step) => step.status === 'done').length;
      return h('div', { class: 'agent-chat__plan' },
        h('p', { class: 'agent-chat__plan-title' }, 'Plan', h('span', { class: 'agent-chat__plan-count' }, `${formatNumber(done)} of ${formatNumber(conv.steps.length)} done`)),
        h('ol', { class: 'agent-chat__plan-steps' }, conv.steps.map((step) => h('li', { class: 'agent-chat__plan-step', dataset: { status: step.status } },
          stateIcon(STATUS[step.status]),
          h('span', { class: 'visually-hidden' }, `${STATUS[step.status].label}: `),
          h('span', { class: 'agent-chat__plan-label' }, step.label),
          step.status === 'waiting' || step.status === 'running' ? h('span', { class: 'agent-chat__plan-note', 'aria-hidden': 'true' }, STATUS[step.status].label) : null))));
    }

    /**
     * Tool calls as compact rows: state, what was done, how long it took. Each opens to the
     * arguments the agent sent and the result it got back.
     * @param {Conversation} conv
     * @param {CallItem[]} calls
     * @returns {HTMLElement}
     */
    function callList(conv, calls) {
      return h('ol', { class: 'agent-chat__calls', 'aria-label': 'Tool calls' }, calls.map((call) => {
        const key = `${conv.id}:${call.id}`;
        const open = state.expanded.has(key);
        const detailId = uid('agent-chat-call');
        const status = STATUS[call.status];
        const detail = h('div', { class: 'agent-chat__call-detail', id: detailId, hidden: !open },
          h('p', { class: 'agent-chat__call-tool' }, h('span', { class: 'mono' }, call.tool),
            call.at ? ` · ${clockTime(call.at)}` : null),
          h('p', { class: 'agent-chat__call-heading' }, 'Arguments'),
          h('pre', { class: 'agent-chat__code' }, call.args),
          h('p', { class: 'agent-chat__call-heading' }, call.status === 'failed' ? 'Error' : 'Result'),
          h('pre', { class: 'agent-chat__code', dataset: { tone: call.status === 'failed' ? 'danger' : null } }, call.result || 'Waiting for the result…'));
        const row = h('button', {
          type: 'button', class: 'agent-chat__call-row', 'aria-expanded': String(open), 'aria-controls': detailId,
          dataset: { key: `call:${call.id}` },
          // Opening a call changes only that call, so the thread keeps its place.
          onclick: () => {
            const next = !state.expanded.has(key);
            if (next) state.expanded.add(key);
            else state.expanded.delete(key);
            row.setAttribute('aria-expanded', String(next));
            detail.hidden = !next;
          }
        },
        stateIcon(status),
        h('span', { class: 'visually-hidden' }, `${status.label}: `),
        h('span', { class: 'agent-chat__call-label' }, call.label,
          call.count ? h('span', { class: 'agent-chat__call-count' }, ` · ${call.count}`) : null),
        h('span', { class: 'agent-chat__call-time' }, call.status === 'running' ? 'Running' : call.ms ? duration(call.ms) : ''),
        icon('chevron-down', { size: 14 }));
        return h('li', { class: 'agent-chat__call', dataset: { status: call.status } }, row, detail);
      }));
    }

    /**
     * The request that holds the run: what the agent wants to do, to whom, the email itself, and
     * Approve, Edit, or Reject. Answered, it stays as the record of what was decided.
     * @param {Conversation} conv
     * @param {ApprovalItem} item
     * @returns {HTMLElement}
     */
    function approvalCard(conv, item) {
      const titleId = uid('agent-chat-approval');
      const emailId = uid('agent-chat-email');
      const pending = item.status === 'pending';
      const n = item.recipients.length;
      const title = pending ? `Send ${count(n, 'reminder email')}?`
        : item.status === 'approved' ? `Sent ${count(n, 'reminder email')}` : 'Reminders not sent';
      const status = STATUS[pending ? 'waiting' : item.status === 'approved' ? 'done' : 'skipped'];
      const verdict = pending ? 'Waiting for you' : item.status === 'approved' ? 'Approved' : 'Rejected';
      const showEmail = state.email.has(`${conv.id}:${item.id}`);
      const email = h('div', { class: 'agent-chat__email', id: emailId, hidden: !showEmail },
        h('p', { class: 'agent-chat__email-subject' }, h('span', { class: 'agent-chat__email-label' }, 'Subject'), fill(item.subject, item.recipients[0])),
        h('p', { class: 'agent-chat__email-body' }, fill(item.body, item.recipients[0])),
        h('p', { class: 'agent-chat__email-note' }, n > 1
          ? `As ${reminder(item.recipients[0]).contact} gets it. Each recipient sees their own name, invoice, amount, and due date.`
          : `As ${reminder(item.recipients[0]).contact} gets it.`));
      const toggle = h('button', {
        type: 'button', class: 'agent-chat__disclosure', 'aria-expanded': String(showEmail), 'aria-controls': emailId,
        dataset: { key: `email:${item.id}` },
        onclick: () => {
          const key = `${conv.id}:${item.id}`;
          const next = !state.email.has(key);
          if (next) state.email.add(key);
          else state.email.delete(key);
          toggle.setAttribute('aria-expanded', String(next));
          email.hidden = !next;
        }
      }, icon('chevron-right', { size: 14 }), 'Show the email');
      const answered = item.answered ? clockTime(item.answered) : '';
      return h('div', {
        class: 'agent-chat__approval', role: 'group', 'aria-labelledby': titleId, tabindex: '-1',
        dataset: { state: item.status, key: `approval:${item.id}` }
      },
      h('div', { class: 'agent-chat__approval-head' },
        iconTile('paper-plane', 'blue'),
        h('div', { class: 'agent-chat__approval-titles' },
          h('h3', { class: 'agent-chat__approval-title', id: titleId }, title),
          h('p', { class: 'agent-chat__approval-sub' }, pending
            ? `The run is paused until you answer. Sent mail can’t be recalled.${item.edited ? ' Edited by you.' : ''}`
            : item.status === 'approved' ? `Approved by you at ${answered}, from ${MAILBOX}.` : `Rejected by you at ${answered}. Nothing was sent.`)),
        h('span', { class: 'agent-chat__verdict' }, stateIcon(status), verdict)),
      h('ul', { class: 'agent-chat__recipients', 'aria-label': 'Recipients' }, item.recipients.map((id) => {
        const entry = reminder(id);
        return h('li', { class: 'agent-chat__recipient' },
          threadParts.own(new Avatar(null, { name: entry.contact, size: 'sm' })),
          h('span', { class: 'agent-chat__recipient-who' },
            h('span', { class: 'agent-chat__recipient-name' }, entry.contact),
            h('span', { class: 'agent-chat__recipient-company' }, entry.name)),
          h('span', { class: 'agent-chat__recipient-facts' },
            h('span', { class: 'agent-chat__recipient-invoice' }, entry.invoice),
            h('span', { class: 'agent-chat__recipient-amount' }, euro(entry.amount)),
            h('span', { class: 'agent-chat__recipient-late' }, `${entry.days} days overdue`)));
      })),
      item.reason ? h('div', { class: 'agent-chat__reason' },
        h('p', { class: 'agent-chat__email-label' }, 'Your reason'),
        h('blockquote', { class: 'agent-chat__reason-text' }, item.reason)) : null,
      h('div', { class: 'agent-chat__email-wrap' }, toggle, email),
      pending ? h('div', { class: 'agent-chat__approval-actions' },
        withKey(button({ label: 'Approve', kind: 'primary', shortcut: { label: 'A', keys: 'A' }, onclick: () => approve() }), 'approve'),
        withKey(button({ label: 'Edit', shortcut: { label: 'E', keys: 'E' }, onclick: () => openEdit() }), 'edit'),
        withKey(button({ label: 'Reject', shortcut: { label: 'R', keys: 'R' }, onclick: () => openReject() }), 'reject'),
        h('span', { class: 'agent-chat__approval-from' }, `From ${MAILBOX}`)) : null);
    }

    /**
     * The answer, as far as it has been written, with its citations, the figures it rests on,
     * and — once complete — its sources.
     * @param {Conversation} conv
     * @param {AnswerItem} answer
     * @returns {HTMLElement}
     */
    function answerBlock(conv, answer) {
      let budget = answer.streaming || answer.stopped ? answer.shown ?? 0 : Infinity;
      /** @type {HTMLElement[]} */
      const parts = [];
      for (const block of answer.blocks) {
        if (budget <= 0) break;
        if (block.type === 'figures') {
          budget -= 1;
          parts.push(h('dl', { class: 'agent-chat__figures' }, block.rows.flatMap(([label, what, value]) => [
            h('dt', {}, label), h('dd', { class: 'agent-chat__figure-what' }, what), h('dd', { class: 'agent-chat__figure-value' }, value)
          ])));
          continue;
        }
        const words = block.text.split(' ');
        const visible = words.slice(0, Math.min(words.length, budget)).join(' ');
        budget -= words.length;
        parts.push(h('p', { class: 'agent-chat__p' }, citations(visible).map((part) => (typeof part === 'number'
          ? h('sup', { class: 'agent-chat__cite' }, h('span', { class: 'visually-hidden' }, 'source '), String(part))
          : part))));
      }
      const writing = answer.streaming && !answer.shown;
      const complete = !answer.streaming && !answer.stopped;
      const sources = complete && answer.cites ? conv.sources : [];
      return h('div', { class: 'agent-chat__answer', dataset: { answer: answer.id, streaming: answer.streaming ? '' : null } },
        writing ? h('p', { class: 'agent-chat__writing' }, 'Writing the answer…') : parts,
        answer.stopped ? h('p', { class: 'agent-chat__stopped' }, 'You stopped the answer here.') : null,
        sources.length ? h('div', { class: 'agent-chat__sources' },
          h('p', { class: 'agent-chat__sources-label' }, 'Sources'),
          h('ul', { class: 'agent-chat__source-list', 'aria-label': 'Sources' }, sources.map((source, index) => h('li', {},
            h('button', {
              type: 'button', class: 'agent-chat__source', title: 'Show the tool call it came from',
              dataset: { key: `source:${source.id}` }, onclick: () => reveal(`call:${source.call}`)
            },
            h('span', { class: 'agent-chat__source-n' }, String(index + 1)),
            icon(source.icon, { size: 14 }),
            h('span', { class: 'agent-chat__source-label' }, source.label)))))) : null);
    }

    /** @returns {HTMLElement} An empty conversation: what the agent can do, and a few requests to start from. */
    function welcome() {
      return h('div', { class: 'agent-chat__welcome' },
        iconTile('robot', 'violet', { size: 'lg' }),
        h('h3', { class: 'agent-chat__welcome-title' }, 'What should the finance agent do?'),
        h('p', { class: 'agent-chat__welcome-text' }, `${AGENT.description} It asks before it sends anything.`),
        h('ul', { class: 'agent-chat__suggestions', 'aria-label': 'Suggestions' }, SUGGESTIONS.map((text, index) => h('li', {},
          h('button', {
            type: 'button', class: 'agent-chat__suggestion', dataset: { key: `suggestion:${index}` },
            onclick: () => {
              input.value = text;
              send();
            }
          }, text)))));
    }

    /** @param {Attachment} file @param {() => void} [remove] @returns {HTMLElement} A file, in a message or waiting to be sent. */
    function fileChip(file, remove) {
      return h('li', { class: 'agent-chat__chip' },
        icon(/\.pdf$/i.test(file.name) ? 'file-pdf' : 'file-regular', { size: 14 }),
        h('span', { class: 'agent-chat__chip-name' }, file.name),
        h('span', { class: 'agent-chat__chip-size' }, formatFileSize(file.size, { decimals: 0, standard: 'si' })),
        remove ? iconButton('xmark', `Remove ${file.name}`, remove) : null);
    }

    /** The files waiting in the composer. @returns {void} */
    function renderChips() {
      chips.hidden = !state.files.length;
      chips.replaceChildren(...state.files.map((file, index) => fileChip(file, () => {
        state.files.splice(index, 1);
        renderChips();
        syncComposer();
        input.focus();
      })));
    }

    /**
     * The run beside the thread: its state and clock, the steps, what it may touch, what it read,
     * and what it cost.
     * @returns {void}
     */
    function renderRun() {
      const conv = current();
      const run = conv.run;
      rebuild(runBody, () => {
        if (!run) {
          runBody.replaceChildren(
            h('div', { class: 'panel-block' }, emptyState({ icon: 'robot', title: 'No run yet', description: 'Send a request and the run shows here: every step, what it read, and what it cost.', size: 'sm' })),
            panelBlock('Data it may touch', scopeList()));
          return;
        }
        const steps = stepsOf(conv);
        const cost = costOf(run.tokens);
        runBody.replaceChildren(...[
          runState(conv, run, steps),
          panelBlock('Steps', h('ol', { class: 'agent-chat__steps' }, steps.map((step) => {
            const status = STATUS[step.status];
            const content = [
              stateIcon(status),
              h('span', { class: 'visually-hidden' }, `${status.label}: `),
              h('span', { class: 'agent-chat__step-label' }, step.label),
              h('span', { class: 'agent-chat__step-time' }, step.ms ? duration(step.ms) : step.status === 'todo' ? '' : status.label)
            ];
            return h('li', {}, step.target
              ? h('button', { type: 'button', class: 'agent-chat__step', dataset: { key: `step:${step.id}`, status: step.status }, onclick: () => reveal(step.target ?? '') }, content)
              : h('span', { class: 'agent-chat__step', dataset: { status: step.status } }, content));
          }))),
          panelBlock('Data it may touch', scopeList()),
          conv.sources.length ? panelBlock('Sources', h('ol', { class: 'agent-chat__run-sources' }, conv.sources.map((source, index) => h('li', {},
            h('button', { type: 'button', class: 'agent-chat__run-source', dataset: { key: `run-source:${source.id}` }, onclick: () => reveal(`call:${source.call}`) },
              h('span', { class: 'agent-chat__source-n' }, String(index + 1)),
              icon(source.icon, { size: 14 }),
              h('span', { class: 'agent-chat__source-label' }, source.label)))))) : null,
          panelBlock('Cost', propList([
            ['Model', 'Large, hosted in the EU'],
            ['Tokens', h('span', { class: 'num' }, `${formatNumber(run.tokens[0])} in · ${formatNumber(run.tokens[1])} out`)],
            ['Tool calls', h('span', { class: 'num' }, formatNumber(callsOf(conv).length))],
            ['Cost', h('span', { class: 'num' }, `${euro(cost)} of ${euro(BUDGET)}`)]
          ]))
        ].filter((block) => block !== null));
      });
    }

    /**
     * The run's state, said in words, with a meter of its steps and its clock.
     * @param {Conversation} conv
     * @param {Run} run
     * @param {ReturnType<typeof stepsOf>} steps
     * @returns {HTMLElement}
     */
    function runState(conv, run, steps) {
      const status = STATUS[run.state];
      const done = steps.filter((step) => step.status === 'done').length;
      const index = steps.findIndex((step) => step.status === 'waiting' || step.status === 'running');
      const running = callsOf(conv).find((call) => call.status === 'running');
      const summary = {
        waiting: `Step ${index + 1} of ${steps.length} needs your approval.`,
        working: running ? `${running.label}…` : conv.busy ? 'Writing the answer…' : 'Working…',
        done: steps.some((step) => step.status === 'skipped')
          ? `${formatNumber(done)} of ${formatNumber(steps.length)} steps done; ${formatNumber(steps.filter((step) => step.status === 'skipped').length)} skipped at your request.`
          : `All ${count(steps.length, 'step')} finished.`,
        failed: run.error ?? 'The run stopped on an error.',
        stopped: 'You stopped the run. Nothing after that point ran.'
      }[run.state];
      const percent = steps.length ? Math.round((done / steps.length) * 100) : 0;
      return h('div', { class: 'panel-block agent-chat__state', dataset: { state: run.state } },
        h('p', { class: 'agent-chat__state-line' }, stateIcon(status), h('span', {}, status.label)),
        h('p', { class: 'agent-chat__state-text' }, summary),
        h('div', { class: 'agent-chat__meter-row' },
          h('div', {
            class: 'agent-chat__meter', role: 'progressbar', 'aria-label': 'Steps done',
            'aria-valuemin': '0', 'aria-valuemax': String(steps.length), 'aria-valuenow': String(done),
            'aria-valuetext': `${done} of ${steps.length} steps`, dataset: { active: run.state === 'working' ? '' : null, state: run.state }
          }, h('span', { class: 'agent-chat__meter-fill', style: { inlineSize: `${percent}%` } })),
          h('span', { class: 'agent-chat__meter-text', 'aria-hidden': 'true' }, `${done}/${steps.length}`)),
        run.state === 'waiting' ? withKey(button({ label: 'Review the request', size: 'sm', onclick: () => focusApproval() }), 'review') : null,
        run.state === 'failed' ? withKey(button({ label: 'Renew bank consent', size: 'sm', onclick: () => notify(unavailable('Bank account settings'), 'info') }), 'renew') : null,
        propList([
          ['Started', clockTime(run.started)],
          ['Working time', h('span', { class: 'num agent-chat__elapsed' }, elapsed(workTime(run)))],
          run.waitingSince && run.state === 'waiting' ? ['Waiting since', clockTime(run.waitingSince)] : null,
          run.finished && run.state !== 'working' && run.state !== 'waiting' ? [run.state === 'done' ? 'Finished' : run.state === 'failed' ? 'Failed at' : 'Stopped at', clockTime(run.finished)] : null
        ].filter((row) => row !== null)));
    }

    /** @returns {HTMLElement} What the agent may read, write, and never touch. */
    function scopeList() {
      return h('ul', { class: 'agent-chat__scopes' }, SCOPES.map((scope) => h('li', { class: 'agent-chat__scope', dataset: { access: scope.access === 'No access' ? 'none' : null } },
        icon(scope.icon, { size: 14 }),
        h('span', { class: 'agent-chat__scope-label' }, scope.label),
        h('span', { class: 'agent-chat__scope-access' }, scope.access))));
    }

    /** The Send or Stop button, the hint beside it, and the state the stylesheet reads. @returns {void} */
    function syncComposer() {
      const conv = current();
      const working = Boolean(conv.busy);
      root.dataset.run = conv.run?.state ?? 'none';
      const empty = !input.value.trim() && !state.files.length;
      const send = modShortcut('Enter', '↵');
      sendButton.dataset.mode = working ? 'stop' : 'send';
      sendButton.replaceChildren(icon(working ? 'stop' : 'arrow-up'));
      sendButton.setAttribute('aria-label', working ? 'Stop' : 'Send');
      sendButton.title = working ? 'Stop (Esc)' : `Send (${send.label})`;
      sendButton.setAttribute('aria-keyshortcuts', working ? 'Escape' : send.keys);
      // Never disabled: a disabled button drops the focus it holds when the run ends under it.
      sendButton.setAttribute('aria-disabled', String(!working && empty));
      hint.textContent = working ? 'Working · Esc stops it'
        : conv.run?.state === 'waiting' ? 'The run is waiting for your answer above' : '';
    }

    /** Keeps the working time ticking while the run on screen works. @returns {void} */
    function syncTicker() {
      const working = !preview && current().run?.state === 'working';
      if (working && !ticker) {
        ticker = window.setInterval(() => {
          const run = current().run;
          const target = runBody.querySelector('.agent-chat__elapsed');
          if (run && target) target.textContent = elapsed(workTime(run));
        }, 1000);
      } else if (!working && ticker) {
        clearInterval(ticker);
        ticker = 0;
      }
    }

    /** Grows the text area with its text, up to the stylesheet's limit. @returns {void} */
    function autosize() {
      input.style.blockSize = 'auto';
      input.style.blockSize = `${input.scrollHeight}px`;
    }

    /* ---------------------------------------------------------------- the run -- */

    /**
     * Starts something the agent does in a conversation; Stop ends it.
     * @param {Conversation} conv
     * @param {() => void} onstop What Stop leaves behind: a call marked stopped, an answer cut off.
     * @returns {Activity}
     */
    function begin(conv, onstop) {
      finishActivity(conv);
      /** @type {Activity} */
      const own = { conv, timers: new Set(), interval: 0, flush: null, onstop };
      activities.set(conv.id, own);
      conv.busy = true;
      return own;
    }

    /**
     * @param {Activity} own
     * @param {number} ms
     * @param {() => void} fn Runs after `ms` unless the activity has ended by then.
     * @returns {void}
     */
    function wait(own, ms, fn) {
      const timer = window.setTimeout(() => {
        own.timers.delete(timer);
        if (activities.get(own.conv.id) === own) fn();
      }, ms);
      own.timers.add(timer);
    }

    /** @param {Activity} own @returns {void} */
    function cancel(own) {
      for (const timer of own.timers) clearTimeout(timer);
      clearInterval(own.interval);
      own.timers.clear();
      own.interval = 0;
      own.flush = null;
    }

    /** Ends what the agent does in a conversation, normally. @param {Conversation} conv @returns {void} */
    function finishActivity(conv) {
      const own = activities.get(conv.id);
      if (!own) return;
      cancel(own);
      activities.delete(conv.id);
      conv.busy = false;
    }

    /**
     * Moves a run to another state, keeping its working time: it counts only while it works.
     * @param {Conversation} conv
     * @param {RunState} next
     * @returns {void}
     */
    function setRun(conv, next) {
      const run = conv.run;
      if (!run) return;
      if (run.state === 'working' && run.resumedAt) run.workMs += performance.now() - run.resumedAt;
      run.resumedAt = next === 'working' ? performance.now() : undefined;
      run.state = next;
      if (next !== 'working' && next !== 'waiting') run.finished = stamp(clock());
    }

    /**
     * Writes an answer out word by word, then calls `done`. Under reduced motion it appears whole.
     * @param {Activity} own
     * @param {AnswerItem} answer
     * @param {() => void} done
     * @returns {void}
     */
    function stream(own, answer, done) {
      const { conv } = own;
      const total = unitsOf(answer);
      const finish = () => {
        if (activities.get(conv.id) !== own) return;
        cancel(own);
        answer.shown = total;
        answer.streaming = false;
        done();
      };
      own.flush = finish;
      if (prefersReducedMotion(root)) {
        wait(own, 500, finish);
        return;
      }
      wait(own, 450, () => {
        own.interval = window.setInterval(() => {
          answer.shown = Math.min(total, (answer.shown ?? 0) + 2);
          if (answer.shown >= total) finish();
          else patchAnswer(conv, answer);
        }, 55);
      });
    }

    /** Redraws only an answer being written, so nothing else in the thread moves. @param {Conversation} conv @param {AnswerItem} answer @returns {void} */
    function patchAnswer(conv, answer) {
      if (conv !== current()) return;
      const node = column.querySelector(`[data-answer="${CSS.escape(answer.id)}"]`);
      if (!node) return;
      const atEnd = thread.scrollHeight - thread.scrollTop - thread.clientHeight < 48;
      node.replaceWith(answerBlock(conv, answer));
      if (atEnd) scrollToEnd();
    }

    /** @param {string} kind @returns {string} A new item id. */
    function nextId(kind) {
      state.seq += 1;
      return `${kind}-${state.seq}`;
    }

    /** A: approves the request; the run resumes and sends. @returns {void} */
    function approve() {
      const conv = current();
      const approval = pendingApproval(conv);
      if (!approval || preview) return;
      settle();
      const n = approval.recipients.length;
      approval.status = 'approved';
      approval.answered = stamp(clock());
      const step = conv.steps.find((entry) => entry.id === approval.step);
      if (step) step.status = 'running';
      setRun(conv, 'working');
      /** @type {CallItem} */
      const call = {
        id: nextId('send'), type: 'call', step: approval.step, status: 'running', label: `Sending ${count(n, 'reminder')}`,
        tool: 'mail.send', args: `{\n  "drafts": [${approval.recipients.map((id) => `"${reminder(id).invoice}"`).join(', ')}],\n  "from": "${MAILBOX}"\n}`, result: ''
      };
      conv.items.push(call);
      const own = begin(conv, () => {
        if (call.status !== 'running') return;
        Object.assign(call, { status: 'stopped', label: 'Sending stopped', count: 'nothing sent', result: 'Stopped by you before the mail left the billing mailbox.' });
        if (step) step.status = 'stopped';
      });
      render({ follow: true });
      focusApproval();
      announce(`Approved. Sending ${count(n, 'reminder')}.`);
      wait(own, 1400, () => {
        Object.assign(call, { status: 'done', label: `Sent ${count(n, 'reminder')}`, count: `${formatNumber(n)} delivered`, ms: 1380,
          result: approval.recipients.map((id) => `${reminder(id).email}: delivered`).join('\n') });
        if (step) Object.assign(step, { status: 'done', ms: 1380 });
        conclude(own, approval);
      });
    }

    /**
     * Writes the closing answer after an approval was answered, then ends the run.
     * @param {Activity} own
     * @param {ApprovalItem} approval
     * @returns {void}
     */
    function conclude(own, approval) {
      const { conv } = own;
      /** @type {AnswerItem} */
      const answer = { id: nextId('answer'), type: 'answer', cites: true, blocks: closingAnswer(approval), streaming: true, shown: 0 };
      conv.items.push(answer);
      own.onstop = () => {
        answer.streaming = false;
        answer.stopped = true;
      };
      refresh(conv, { follow: true });
      stream(own, answer, () => {
        const run = conv.run;
        if (run) run.tokens = [run.tokens[0] + 5_540, run.tokens[1] + 872];
        finishActivity(conv);
        setRun(conv, 'done');
        conv.updated = stamp(clock());
        refresh(conv);
        announce('The run is done.');
      });
    }

    /** E: edits the recipients and the email before approving. @returns {void} */
    function openEdit() {
      const approval = pendingApproval(current());
      if (!approval || preview) return;
      const editor = editing();
      editor.picks.replaceChildren(...OVERDUE.map((entry, index) => {
        const who = reminder(entry.company);
        return h('label', { class: 'agent-chat__pick-row' },
          h('input', { type: 'checkbox', value: entry.company, checked: approval.recipients.includes(entry.company), autofocus: index === 0 }),
          h('span', { class: 'agent-chat__pick-who' },
            h('span', { class: 'agent-chat__pick-name' }, who.contact),
            h('span', { class: 'agent-chat__pick-meta' }, `${who.name} · ${who.invoice}`)),
          h('span', { class: 'agent-chat__pick-amount' }, euro(who.amount)));
      }));
      editor.error.textContent = '';
      editor.form.setValues({ subject: approval.subject, body: approval.body }, { silent: true });
      editor.dialog.open();
    }

    /**
     * The edit dialog, built the first time it is needed: the recipients to keep, then the
     * email's subject and text.
     * @returns {NonNullable<typeof editor>}
     */
    function editing() {
      if (editor) return editor;
      const picks = h('div', { class: 'agent-chat__pick-rows' });
      const error = h('p', { class: 'agent-chat__pick-error', role: 'alert' });
      const form = keep(new Fieldset(null, {
        fields: {
          subject: { type: 'text', label: 'Subject' },
          body: { type: 'textarea', label: 'Message', description: 'Braces are filled in for each recipient: {name}, {invoice}, {amount}, {due}.', props: { rows: 9 } }
        }
      }));
      const dialog = keep(new Dialog(null, {
        title: 'Edit the reminders', size: 'md',
        content: h('div', { class: 'agent-chat__edit form-sheet' },
          h('fieldset', { class: 'agent-chat__pick' }, h('legend', { class: 'agent-chat__pick-legend' }, 'Recipients'), picks, error),
          form.toElement()),
        buttons: [{ label: 'Cancel', action: 'cancel' }, { label: 'Save changes', kind: 'primary', action: () => saveEdit() }],
        onclose: () => refocus()
      }));
      editor = { dialog, picks, error, form };
      return editor;
    }

    /** Saves the edited reminders, as long as somebody still gets one. @returns {void} */
    function saveEdit() {
      const approval = pendingApproval(current());
      if (!approval || !editor) return;
      const boxes = /** @type {HTMLInputElement[]} */ ([...editor.picks.querySelectorAll('input[type="checkbox"]')]);
      const chosen = boxes.filter((box) => box.checked).map((box) => box.value);
      if (!chosen.length) {
        editor.error.textContent = 'Choose at least one recipient, or reject the reminders instead.';
        boxes[0]?.focus();
        return;
      }
      const values = editor.form.getValues();
      Object.assign(approval, {
        recipients: chosen, subject: String(values.subject ?? '').trim() || TEMPLATE.subject,
        body: String(values.body ?? '').trim() || TEMPLATE.body, edited: true
      });
      editor.dialog.close();
      renderThread();
      renderHeader();
      announce(`Updated: ${count(chosen.length, 'reminder')} to approve.`);
    }

    /** R: rejects the request, asking why. @returns {void} */
    function openReject() {
      if (!pendingApproval(current()) || preview) return;
      if (!rejecting) {
        const reason = keep(new Field(null, {
          type: 'textarea', label: 'Why not?', required: true,
          placeholder: 'For example: wait for Friday’s payment run', props: { rows: 3, autofocus: true }
        }));
        const dialog = keep(new Dialog(null, {
          title: 'Reject the reminders?', size: 'sm',
          content: h('div', { class: 'agent-chat__reject form-sheet' },
            h('p', { class: 'agent-chat__reject-text' }, 'Nothing will be sent. The agent finishes the run without this step and keeps the drafts. Your reason stays in the conversation.'),
            reason.toElement()),
          buttons: [{ label: 'Cancel', action: 'cancel' }, { label: 'Reject', kind: 'danger', action: () => confirmReject() }],
          onclose: () => refocus()
        }));
        reason.getInput()?.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            confirmReject();
          }
        });
        rejecting = { dialog, reason };
      }
      rejecting.reason.setValue('', { silent: true });
      rejecting.reason.clearHighlight();
      rejecting.dialog.open();
    }

    /** Rejects with the reason given, or asks for one. @returns {void} */
    function confirmReject() {
      const conv = current();
      const approval = pendingApproval(conv);
      if (!approval || !rejecting) return;
      const { dialog, reason } = rejecting;
      const text = String(reason.getValue() ?? '').trim();
      if (!text) {
        reason.setHighlight('Tell the agent why, so it can do better next time.', 'danger');
        reason.focus();
        return;
      }
      settle();
      Object.assign(approval, { status: 'rejected', reason: text, answered: stamp(clock()) });
      const step = conv.steps.find((entry) => entry.id === approval.step);
      if (step) step.status = 'skipped';
      setRun(conv, 'working');
      const own = begin(conv, () => {});
      dialog.close();
      render({ follow: true });
      announce('Rejected. Nothing will be sent.');
      conclude(own, approval);
    }

    /**
     * Sends the composer's message. While the run waits for an approval the agent says so;
     * otherwise this example answers honestly that only the reconciliation is scripted.
     * @returns {void}
     */
    function send() {
      const conv = current();
      if (conv.busy || preview) return;
      const text = input.value.trim();
      if (!text && !state.files.length) {
        focusComposer();
        return;
      }
      const at = stamp(clock());
      const first = !conv.items.length;
      conv.items.push({ id: nextId('user'), type: 'user', at, text, files: state.files.splice(0) });
      if (first) conv.title = text ? (text.length > 44 ? `${text.slice(0, 43).trimEnd()}…` : text) : 'Files for the agent';
      conv.updated = at;
      input.value = '';
      autosize();
      renderChips();
      const waiting = conv.run?.state === 'waiting';
      if (!conv.run) startRun(conv);
      else reply(conv, waiting ? [WAITING_REPLY] : EXAMPLE_REPLY);
      input.focus();
    }

    /**
     * A short answer that is not a run of its own.
     * @param {Conversation} conv
     * @param {string[]} paragraphs
     * @returns {void}
     */
    function reply(conv, paragraphs) {
      /** @type {AnswerItem} */
      const answer = { id: nextId('answer'), type: 'answer', at: stamp(clock()), blocks: paragraphs.map((text) => ({ type: 'p', text })), streaming: true, shown: 0 };
      conv.items.push(answer);
      const own = begin(conv, () => {
        answer.streaming = false;
        answer.stopped = true;
      });
      render({ follow: true });
      stream(own, answer, () => {
        finishActivity(conv);
        refresh(conv);
      });
    }

    /**
     * The first message of a new conversation starts a run: one look for records, then the
     * answer.
     * @param {Conversation} conv
     * @returns {void}
     */
    function startRun(conv) {
      conv.run = { state: 'working', started: stamp(clock()), workMs: 0, tokens: [2_310, 0], resumedAt: performance.now() };
      /** @type {CallItem} */
      const call = {
        id: nextId('call'), type: 'call', at: stamp(clock()), status: 'running', label: 'Looking for matching records',
        tool: 'records.search', args: '{\n  "query": "' + (conv.title.replace(/["\\]/g, '')) + '"\n}', result: ''
      };
      conv.items.push(call);
      const own = begin(conv, () => {
        if (call.status === 'running') Object.assign(call, { status: 'stopped', label: 'Search stopped', result: 'Stopped by you.' });
      });
      render({ follow: true });
      announce('The agent is working.');
      wait(own, 1100, () => {
        Object.assign(call, { status: 'done', label: 'Looked for matching records', count: 'example data only', ms: 1040, result: 'This example has no live data. The September reconciliation is its one scripted run.' });
        /** @type {AnswerItem} */
        const answer = { id: nextId('answer'), type: 'answer', blocks: EXAMPLE_REPLY.map((text) => ({ type: 'p', text })), streaming: true, shown: 0 };
        conv.items.push(answer);
        own.onstop = () => {
          answer.streaming = false;
          answer.stopped = true;
        };
        refresh(conv, { follow: true });
        stream(own, answer, () => {
          if (conv.run) conv.run.tokens = [conv.run.tokens[0] + 640, 214];
          finishActivity(conv);
          setRun(conv, 'done');
          refresh(conv);
          announce('The run is done.');
        });
      });
    }

    /**
     * Esc or the Stop button: ends what the agent is doing, keeping what it already did.
     * @param {{quiet?: boolean}} [options]
     * @returns {void}
     */
    function stop({ quiet = false } = {}) {
      const conv = current();
      const own = activities.get(conv.id);
      if (!own) return;
      cancel(own);
      own.onstop();
      activities.delete(conv.id);
      conv.busy = false;
      if (conv.run?.state === 'working') setRun(conv, 'stopped');
      if (quiet) return;
      render();
      announce('Stopped.');
    }

    /**
     * Lets whatever the agent is doing finish now — an answer being written appears whole — so a
     * decision on the approval never cuts a reply off mid-sentence.
     * @returns {void}
     */
    function settle() {
      const own = activities.get(current().id);
      if (own?.flush) own.flush();
      else if (own) stop({ quiet: true });
    }

    /** @param {Conversation} conv @param {{follow?: boolean}} [options] Redraws, if that conversation is on screen. @returns {void} */
    function refresh(conv, options) {
      if (conv === current()) render(options);
      else renderHistory();
    }

    /* -------------------------------------------------------------- navigation -- */

    /** @param {string} id @returns {void} */
    function openConversation(id) {
      if (id === state.current) return;
      state.current = id;
      render({ follow: true });
    }

    /** N: an empty conversation, or the empty one already there. @returns {void} */
    function newConversation() {
      if (preview) return;
      let conv = conversations.find((entry) => !entry.items.length);
      if (!conv) {
        conv = { id: `new-${nextId('conv')}`, title: 'New conversation', updated: stamp(clock()), steps: [], items: [], sources: [], run: null };
        conversations.unshift(conv);
      }
      state.current = conv.id;
      render();
      if (root.dataset.navOpen === 'true') shell.closeNav();
      focusComposer();
    }

    /** /: puts the cursor in the composer. @returns {void} */
    function focusComposer() {
      if (preview) return;
      input.focus();
    }

    /** Moves focus to the approval holding the run. @returns {void} */
    function focusApproval() {
      if (preview) return;
      if (root.dataset.asideOpen === 'true') shell.toggleAside(false);
      const card = column.querySelector('.agent-chat__approval');
      if (!(card instanceof HTMLElement)) return;
      card.scrollIntoView({ block: 'nearest' });
      card.focus({ preventScroll: true });
    }

    /**
     * Shows where something came from: opens the tool call (or the approval) in the thread and
     * puts the focus on it.
     * @param {string} key `call:<id>` or `approval:<id>`.
     * @returns {void}
     */
    function reveal(key) {
      const conv = current();
      if (key.startsWith('call:')) state.expanded.add(`${conv.id}:${key.slice(5)}`);
      if (root.dataset.asideOpen === 'true') shell.toggleAside(false);
      renderThread();
      const target = column.querySelector(`[data-key="${CSS.escape(key)}"]`);
      if (!(target instanceof HTMLElement)) return;
      target.closest('.agent-chat__call, .agent-chat__approval')?.scrollIntoView({ block: 'nearest' });
      target.focus({ preventScroll: true });
    }

    /**
     * A, E, and R act on the approval only while it has the focus — anywhere else they are
     * letters.
     * @param {KeyboardEvent} event
     * @param {() => void} fn
     * @returns {boolean|void}
     */
    function onApproval(event, fn) {
      const target = event.target instanceof Element ? event.target : null;
      if (!target?.closest('.agent-chat__approval[data-state="pending"]')) return false;
      fn();
    }

    /**
     * Shortcuts listen on this layout, so focus must never be left on the page body when a menu or
     * dialog closes over a control that is gone: it goes to the approval, or the thread.
     * @returns {void}
     */
    function refocus() {
      later(context, () => {
        const active = document.activeElement;
        if (active && active !== document.body && active.isConnected && root.contains(active)) return;
        const card = column.querySelector('.agent-chat__approval');
        (card instanceof HTMLElement ? card : thread).focus({ preventScroll: true });
      }, 0);
    }

    /** @param {string} text Said by screen readers, politely. @returns {void} */
    function announce(text) {
      if (preview) return;
      announcer.textContent = '';
      later(context, () => { announcer.textContent = text; }, 50);
    }

    /** Copies the conversation as plain text. @returns {Promise<void>} */
    async function copyTranscript() {
      const conv = current();
      const lines = [conv.title, ''];
      for (const item of conv.items) {
        if (item.type === 'user') lines.push(`You: ${item.text}${item.files?.length ? ` [${item.files.map((file) => file.name).join(', ')}]` : ''}`);
        else if (item.type === 'text') lines.push(`${AGENT.name}: ${item.text}`);
        else if (item.type === 'call') lines.push(`  ${STATUS[item.status].label} — ${item.label}${item.count ? ` · ${item.count}` : ''}${item.ms ? ` (${duration(item.ms)})` : ''}`);
        else if (item.type === 'approval') lines.push(`  Approval: send ${count(item.recipients.length, 'reminder')} — ${item.status}${item.reason ? ` (“${item.reason}”)` : ''}`);
        else if (item.type === 'answer') lines.push(...item.blocks.map((block) => (block.type === 'p' ? `${AGENT.name}: ${block.text}` : block.rows.map((row) => `  ${row.join(' · ')}`).join('\n'))));
      }
      const copied = await copyToClipboard(lines.join('\n'));
      notify(copied ? 'Transcript copied.' : 'The transcript couldn’t be copied.', copied ? 'success' : 'error');
    }

    /** @template {HTMLElement} T @param {T} element @param {string} key @returns {T} The element, findable again after a redraw. */
    function withKey(element, key) {
      element.dataset.key = key;
      return element;
    }
  }
};
