import {
  AgentThread, Composer, MenuButton, RunStatus, RunTrace, SourceList, button, copyToClipboard, emptyState,
  formatCurrency, formatDate, formatNumber, h, icon, prefersReducedMotion, surfaceText, watchMotion
} from '../../src/index.js';
import {
  DATE, adaptiveShell, disposer, iconButton, iconTile, kbd, later, layoutContext, listTime, paneHeader, panelBlock,
  renderScope, shortcutSheet, shortcuts, suiteNav, toaster, unavailable
} from './kit.js';
import { ME, NOW, ORGANISATION, company, person } from './fixtures.js';

/** The agent this screen talks to, and the mailbox it writes from. */
const AGENT = {
  name: 'Finance agent',
  description: 'Works on ACME’s invoices, bank payments, and billing mail.'
};
const MAILBOX = `billing@${ORGANISATION.domain}`;

/** Who takes part: the person reading, and the agent. */
const AUTHORS = {
  me: { name: person(ME)?.name ?? 'You', kind: 'person' },
  finance: { name: AGENT.name, kind: 'agent', tone: 'violet', icon: 'robot' }
};

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

/** The model the agent runs on, its price per token (input and output), and the run's budget. */
const MODEL = 'Large, hosted in the EU';
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
 * Thread items, blocks, steps, and sources are the agent kit's plain-JSON model.
 * @typedef {import('../../src/internal/agent-model.js').ThreadItem} ThreadItem
 * @typedef {import('../../src/internal/agent-model.js').Block} Block
 * @typedef {import('../../src/internal/agent-model.js').TraceStep} TraceStep
 * @typedef {import('../../src/internal/agent-model.js').Source} Source
 * @typedef {'running'|'waiting'|'done'|'failed'|'stopped'} RunState
 * @typedef {{recipients: string[], subject: string, body: string}} ReminderValues
 * @typedef {{state: RunState, started: string, workMs: number, waitingSince?: string,
 *   finished?: string, error?: string, tokens: [number, number], resumedAt?: number}} Run
 * @typedef {{id: string, title: string, updated: string, plan: string|null, reveals?: Record<string, string>,
 *   items: any[], sources: Source[], run: Run|null, busy?: boolean, waiting?: string}} Conversation `plan` names the
 *   trace item that holds the plan, whose steps are the run's steps; without one the run's steps
 *   are its calls. `reveals` says what each plan step stands for in the thread: the call it made
 *   (`step:<id>`) or the approval it waits on (`item:<id>`). `waiting` is what the agent says to a
 *   message that arrives while the run waits for the reader.
 * @typedef {{conv: Conversation, timers: Set<number>, interval: number, flush: (() => void)|null,
 *   onstop: () => void}} Activity What the agent is doing in one conversation, and how to end it.
 */

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

/** @param {string} text @returns {string} Text the inline grammar reads literally: no bold, code, or citation. */
function literal(text) {
  return String(text).replace(/[\\*`[]/g, '\\$&');
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

/** The reminders' Edit form: who gets one, and the email's subject and text. */
const EDIT_FIELDS = {
  recipients: {
    type: 'checklist', label: 'Recipients', required: true,
    // The labels the list of edited values shows for each choice.
    options: Object.fromEntries(OVERDUE.map((entry) => [entry.company, reminder(entry.company).name])),
    props: {
      search: false,
      items: OVERDUE.map((entry) => {
        const who = reminder(entry.company);
        return { ID: entry.company, name: `${who.contact} · ${who.name} · ${who.invoice} · ${euro(who.amount)}` };
      })
    }
  },
  subject: { type: 'text', label: 'Subject', required: true },
  body: {
    type: 'textarea', label: 'Message', required: true, props: { rows: 9 },
    description: 'Braces are filled in for each recipient: {name}, {invoice}, {amount}, {due}.'
  }
};

/**
 * What the approval shows for a set of reminders: the question, who gets one, and the email as
 * the first recipient reads it.
 * @param {ReminderValues} values
 * @returns {{title: string, description: string, details: Block[], preview: {label: string, blocks: Block[]}}}
 */
function reminderRequest(values) {
  const ids = values.recipients;
  const first = ids[0];
  return {
    title: `Send ${count(ids.length, 'reminder email')}?`,
    description: `Sent mail can’t be recalled. It goes out from ${MAILBOX}.`,
    details: [{ type: 'figures', rows: ids.map((id) => {
      const entry = reminder(id);
      // Two columns, so the words wrap at any width: who and which invoice, then the amount.
      return { label: `${entry.contact}, ${entry.name} · ${entry.invoice} · ${entry.days} days overdue`, value: euro(entry.amount) };
    }) }],
    preview: { label: 'Show the email', blocks: [
      { type: 'p', text: `Subject: **${literal(fill(values.subject, first))}**` },
      { type: 'quote', text: literal(fill(values.body, first)) },
      { type: 'p', text: ids.length > 1
        ? `As ${reminder(first).contact} gets it. Each recipient sees their own name, invoice, amount, and due date.`
        : `As ${reminder(first).contact} gets it.` }
    ] }
  };
}

/** @param {TraceStep[]} steps @returns {string} The plan's own heading: "Plan · 5 of 6 done". */
function planTitle(steps) {
  const done = steps.filter((step) => step.status === 'done').length;
  return `Plan · ${formatNumber(done)} of ${formatNumber(steps.length)} done`;
}

/** @type {ReminderValues} */
const DRAFTED ={ recipients: OVERDUE.map((entry) => entry.company), subject: TEMPLATE.subject, body: TEMPLATE.body };

/** Bruckner's two open September invoices, either of which the damaged pallets may concern. */
const CREDIT_INVOICES = [
  { invoice: 'RE-2026-0126', label: 'Freight Munich–Lyon', amount: 12340 },
  { invoice: 'RE-2026-0134', label: 'Pallet hire', amount: 3980 }
];

/**
 * The form the agent composes when it lacks the invoice and the amount for a credit note: an
 * `ask` surface, answered with `{invoice, amount, reason}`.
 * @type {import('../../src/components/surface/validate.js').SurfaceDocument}
 */
const CREDIT_QUESTION = {
  zx: 'surface/1',
  surface: 'credit-note',
  intent: 'ask',
  title: 'Which invoice, and how much?',
  author: 'finance',
  root: ['why', 'form'],
  nodes: [
    { id: 'why', type: 'text', text: 'A credit note needs the invoice it corrects and an amount. The customer note gives neither.' },
    {
      id: 'form', type: 'fields',
      schema: {
        type: 'object', required: ['invoice', 'amount'],
        properties: {
          invoice: {
            type: 'string', title: 'Invoice to correct', 'x-zx': { field: 'zxselect' },
            oneOf: CREDIT_INVOICES.map((entry) => ({ const: entry.invoice, title: `${entry.invoice} · ${entry.label} · ${euro(entry.amount)}` }))
          },
          amount: { type: 'number', title: 'Credit amount in euros', minimum: 0.01, maximum: 12340 },
          reason: { type: 'string', title: 'Reason on the credit note', default: 'Two pallets damaged in transit', maxLength: 200 }
        }
      }
    }
  ]
};

/**
 * The agent's conversations, newest first, as thread items. The first is the one on screen: the
 * agent has reconciled September and is waiting for approval to send three reminders.
 * @type {Conversation[]}
 */
const CONVERSATIONS = [
  {
    id: 'reconcile',
    title: 'Reconcile September invoices',
    updated: '2026-10-08T10:28',
    plan: 'plan',
    reveals: {
      'plan-policy': 'step:policy', 'plan-invoices': 'step:invoices', 'plan-payments': 'step:bank-1',
      'plan-notes': 'step:notes', 'plan-drafts': 'step:drafts', 'plan-send': 'item:approval'
    },
    items: [
      { id: 'ask', type: 'user', at: '2026-10-08T10:27', text: 'Reconcile last month’s open invoices and draft reminders for anything overdue. Follow the attached policy.', files: [{ name: 'Dunning policy 2026.pdf', size: 188_416 }] },
      { id: 'intro', type: 'text', at: '2026-10-08T10:27', text: 'I’ll check September against the bank feed and the customer notes, then draft reminders. Nothing goes out without your approval.' },
      { id: 'plan', type: 'trace', open: true, steps: [
        { id: 'plan-policy', kind: 'task', label: 'Read the dunning policy', status: 'done', ms: 600 },
        { id: 'plan-invoices', kind: 'task', label: 'Find September’s open invoices', status: 'done', ms: 800 },
        { id: 'plan-payments', kind: 'task', label: 'Match them against bank payments', status: 'done', ms: 12_100 },
        { id: 'plan-notes', kind: 'task', label: 'Check customer notes for disputes', status: 'done', ms: 1400 },
        { id: 'plan-drafts', kind: 'task', label: 'Draft reminders for anything overdue', status: 'done', ms: 3200 },
        { id: 'plan-send', kind: 'task', label: 'Send the reminders once you approve', doing: 'Send the reminders', status: 'waiting' }
      ] },
      { id: 'calls', type: 'trace', open: true, steps: [
        { id: 'policy', kind: 'read', label: 'Read Dunning policy 2026.pdf', count: '4 pages', ms: 600, tool: 'files.read',
          args: '{"file": "Dunning policy 2026.pdf"}',
          result: 'First reminder 14 days after the due date, template "reminder-1".\nSecond reminder after 28 days, with a €5.00 fee.\nNo reminder while a customer disputes the invoice.' },
        { id: 'invoices', kind: 'query', label: 'Queried invoices', count: '42 rows', ms: 800, tool: 'invoices.search',
          args: '{"issued": "2026-09-01..2026-09-30", "fields": ["number", "customer", "total", "due", "status"]}',
          result: '42 invoices, €209,575.50 in total\n29 marked paid, 13 open' },
        { id: 'bank-1', kind: 'call', label: 'Fetched bank payments', status: 'failed', count: 'timed out', ms: 10_000, tool: 'bank.transactions',
          args: '{"account": "DE12 …4567 89", "booked": "2026-09-01..2026-10-07"}',
          error: 'The bank feed did not answer within 10 s. Nothing was read; retrying once.' },
        { id: 'bank-2', kind: 'call', retryOf: 'bank-1', label: 'Fetched bank payments', count: '57 transactions', ms: 2100, tool: 'bank.transactions',
          args: '{"account": "DE12 …4567 89", "booked": "2026-09-01..2026-10-07"}',
          result: '57 transactions\n31 match a September invoice; RE-2026-0117 and RE-2026-0133 are paid but not booked\n26 belong to other months' },
        { id: 'notes', kind: 'read', label: 'Read customer notes', count: '4 customers', ms: 1400, tool: 'customers.notes',
          args: '{"customers": ["Helios Energie", "Bruckner Logistik", "Northstar Freight", "Kestrel Analytics"]}',
          result: 'Kestrel Analytics: RE-2026-0138 reissued on 7 Oct with PO 4500-2291, new due date 21 Oct.\nThe other three: no open disputes.' },
        { id: 'drafts', kind: 'write', label: 'Drafted 3 reminders', count: 'not sent', ms: 3200, tool: 'mail.drafts.create',
          args: '{"template": "reminder-1", "invoices": ["RE-2026-0121", "RE-2026-0126", "RE-2026-0129"]}',
          result: `3 drafts saved in ${MAILBOX} › Drafts. Nothing has been sent.` }
      ] },
      { id: 'findings', type: 'text', text: 'September has 42 invoices. Two that still look open were paid on 30 September but aren’t booked yet. Of the other 11, four looked overdue — but Kestrel’s RE-2026-0138 was reissued on 7 October with a new due date. That leaves three more than 14 days late, and I’ve drafted a first reminder for each.' },
      { id: 'approval', type: 'approval', at: '2026-10-08T10:28', status: 'pending', reason: 'required',
        ...reminderRequest(DRAFTED), fields: EDIT_FIELDS, values: DRAFTED }
    ],
    sources: [
      { id: 'invoices', title: 'Invoices · September 2026', kind: 'record', call: 'invoices' },
      { id: 'bank', title: 'Bank payments · 1 Sep – 7 Oct', kind: 'record', call: 'bank-2' },
      { id: 'notes', title: 'Customer notes · Kestrel Analytics', kind: 'record', call: 'notes' },
      { id: 'policy', title: 'Dunning policy 2026.pdf', kind: 'file', call: 'policy' }
    ],
    run: { state: 'waiting', started: '2026-10-08T10:27:40', workMs: 41_000, waitingSince: '2026-10-08T10:28:21', tokens: [18_420, 1_236] }
  },
  {
    id: 'credit',
    title: 'Credit note for Bruckner’s damaged pallets',
    updated: '2026-10-08T09:14',
    plan: null,
    waiting: 'Noted. The credit note waits for the invoice and the amount above — I haven’t drafted anything yet.',
    items: [
      { id: 'ask', type: 'user', at: '2026-10-08T09:14', text: 'Issue a credit note to Bruckner Logistik for the pallets that arrived damaged.' },
      { id: 'calls', type: 'trace', at: '2026-10-08T09:14', open: true, steps: [
        { id: 'credit-invoices', kind: 'query', status: 'done', label: 'Queried Bruckner’s open invoices', count: '2 rows', ms: 700, tool: 'invoices.search', at: '2026-10-08T09:14',
          args: '{"customer": "Bruckner Logistik", "status": "open"}',
          result: CREDIT_INVOICES.map((entry) => `${entry.invoice} · ${entry.label} · ${euro(entry.amount)}`).join('\n') },
        { id: 'credit-notes', kind: 'read', status: 'done', label: 'Read customer notes', count: '1 note', ms: 500, tool: 'customers.notes',
          args: '{"customers": ["Bruckner Logistik"]}',
          result: 'Felix Bruckner, 6 Oct: two pallets arrived broken and he asks for a credit. No invoice or amount given.' }
      ] },
      { id: 'credit-explain', type: 'text', text: 'Bruckner has two open invoices from September, and the note doesn’t say which one the pallets were on or how much to credit. I won’t guess the amount on a credit note.' },
      { id: 'credit-question', type: 'surface', at: '2026-10-08T09:14', document: CREDIT_QUESTION }
    ],
    sources: [
      { id: 'credit-invoices', title: 'Invoices · Bruckner Logistik', kind: 'record', call: 'credit-invoices' },
      { id: 'credit-notes', title: 'Customer notes · Bruckner Logistik', kind: 'record', call: 'credit-notes' }
    ],
    run: { state: 'waiting', started: '2026-10-08T09:14:12', workMs: 9_000, waitingSince: '2026-10-08T09:14:21', tokens: [6_210, 402] }
  },
  {
    id: 'forecast',
    title: 'Cash forecast for October',
    updated: '2026-10-08T08:52',
    plan: null,
    items: [
      { id: 'ask', type: 'user', at: '2026-10-08T08:52', text: 'What does cash look like for October? Use the open invoices and the payroll calendar.' },
      { id: 'calls', type: 'trace', at: '2026-10-08T08:52', open: true, steps: [
        { id: 'open', kind: 'query', label: 'Queried open invoices', count: '58 rows', ms: 900, tool: 'invoices.search', at: '2026-10-08T08:52',
          args: '{"status": "open", "due": "2026-10-01..2026-10-31"}', result: '58 invoices, €246,800.00 expected' },
        { id: 'payroll', kind: 'read', label: 'Read the payroll calendar', count: '2 runs', ms: 400, tool: 'hr.payroll',
          args: '{"month": "2026-10"}', result: 'Payroll on 15 Oct and 27 Oct, €171,200.00 together\n14 supplier bills due, €13,200.00' }
      ] },
      { id: 'answer', type: 'answer', blocks: [
        { type: 'p', text: 'October should close about €62,400.00 ahead [1][2].' },
        { type: 'figures', rows: [['Expected in', '58 invoices', '€246,800.00'], ['Going out', 'Payroll and 14 bills', '€184,400.00']] },
        { type: 'p', text: 'The tightest day is 27 October, when the second payroll leaves three days before Alpine Works’ €38,000.00 is due [1][2].' }
      ] }
    ],
    sources: [
      { id: 'open', title: 'Open invoices · October 2026', kind: 'record', call: 'open' },
      { id: 'payroll', title: 'Payroll calendar · October', kind: 'record', call: 'payroll' }
    ],
    run: { state: 'done', started: '2026-10-08T08:52:10', workMs: 14_000, finished: '2026-10-08T08:52:24', tokens: [9_840, 612] }
  },
  {
    id: 'bankfeed',
    title: 'Sync the bank feed for October',
    updated: '2026-10-07T17:40',
    plan: null,
    items: [
      { id: 'ask', type: 'user', at: '2026-10-07T17:40', text: 'Pull October’s bank transactions and match what you can.' },
      { id: 'calls', type: 'trace', at: '2026-10-07T17:40', open: true, steps: [
        { id: 'connect', kind: 'call', label: 'Connected to the bank feed', status: 'failed', count: 'consent expired', ms: 1300, tool: 'bank.transactions', at: '2026-10-07T17:40',
          args: '{"account": "DE12 …4567 89", "booked": "2026-10-01..2026-10-07"}',
          error: '403 consent_expired: the account access consent ended on 6 Oct 2026.' }
      ] },
      { id: 'explain', type: 'text', text: 'I couldn’t reach the bank: the access consent for the account ended on 6 October. Nothing was imported or matched. Once the consent is renewed under Settings › Bank accounts, ask me again.' }
    ],
    sources: [],
    run: { state: 'failed', started: '2026-10-07T17:40:05', workMs: 6_000, finished: '2026-10-07T17:40:11', error: 'The bank feed’s access consent ended on 6 October.', tokens: [3_120, 214] }
  },
  {
    id: 'late',
    title: 'Who pays late most often?',
    updated: '2026-10-02T15:05',
    plan: null,
    items: [
      { id: 'ask', type: 'user', at: '2026-10-02T15:05', text: 'Who pays late most often this year?' },
      { id: 'calls', type: 'trace', at: '2026-10-02T15:05', open: true, steps: [
        { id: 'paid', kind: 'query', label: 'Queried paid invoices', count: '412 rows', ms: 1100, tool: 'invoices.search', at: '2026-10-02T15:05',
          args: '{"status": "paid", "issued": "2026-01-01..2026-09-30"}', result: '412 invoices, 37 paid after their due date' }
      ] },
      { id: 'answer', type: 'answer', blocks: [
        { type: 'p', text: 'Three customers account for most late payments this year [1]:' },
        { type: 'figures', rows: [['Bruckner Logistik', '9 of 14 late', '12 days on average'], ['Helios Energie', '5 of 11 late', '9 days on average'], ['Northstar Freight', '4 of 16 late', '6 days on average']] },
        { type: 'p', text: 'Everyone else paid on time at least nine times out of ten.' }
      ] }
    ],
    sources: [{ id: 'paid', title: 'Paid invoices · January to September', kind: 'record', call: 'paid' }],
    run: { state: 'done', started: '2026-10-02T15:05:02', workMs: 9_000, finished: '2026-10-02T15:05:11', tokens: [7_200, 388] }
  },
  {
    id: 'accruals',
    title: 'Open accruals for the Q3 close',
    updated: '2026-09-29T11:20',
    plan: null,
    items: [
      { id: 'ask', type: 'user', at: '2026-09-29T11:20', text: 'List the open accruals for the Q3 close.' },
      { id: 'calls', type: 'trace', at: '2026-09-29T11:20', open: true, steps: [
        { id: 'ledger', kind: 'query', label: 'Queried the general ledger', count: '6 accruals', ms: 700, tool: 'ledger.accruals', at: '2026-09-29T11:20',
          args: '{"period": "2026-Q3", "status": "open"}', result: '6 open accruals, 2 without an amount' }
      ] },
      { id: 'answer', type: 'answer', blocks: [
        { type: 'p', text: 'Six accruals are open for Q3, and two still need an amount: the Atelier West workshop deposit and Bruckner’s September freight [1].' }
      ] }
    ],
    sources: [{ id: 'ledger', title: 'General ledger · Q3 2026', kind: 'record', call: 'ledger' }],
    run: { state: 'done', started: '2026-09-29T11:20:04', workMs: 7_000, finished: '2026-09-29T11:20:11', tokens: [5_480, 301] }
  }
];

// An answer cites the conversation's sources, so each answer carries them; a plan is headed by
// how far it has got.
for (const conv of CONVERSATIONS) {
  for (const item of conv.items) {
    if (item.type === 'answer') item.sources = conv.sources;
    if (item.id === conv.plan) item.title = planTitle(item.steps);
  }
}

/** The keyboard reference the `?` key opens. */
const SHORTCUTS = [
  ['Conversation', [['Send', 'Mod+Enter'], ['Stop the run', 'Esc'], ['Write a message', '/'], ['New conversation', 'N']]],
  ['Approval, when it has focus', [['Approve', 'A'], ['Edit', 'E'], ['Reject', 'R']]],
  ['View', [['Navigation', 'Mod+B'], ['Run details', 'Mod+I'], ['Keyboard shortcuts', '?']]]
];

/**
 * The answer the run ends with, written from what the reader decided.
 * @param {{status: string, values: ReminderValues}} approval
 * @returns {Block[]}
 */
function closingAnswer(approval) {
  const sent = approval.status === 'approved' ? approval.values.recipients : [];
  const unsent = OVERDUE.map((entry) => entry.company).filter((id) => !sent.includes(id));
  const total = (ids) => euro(ids.reduce((sum, id) => sum + reminder(id).amount, 0));
  const rows = /** @type {[string, string, string][]} */ ([
    ['Paid', '31 invoices', '€148,220.00'],
    ['Not due yet', '8 invoices', '€41,980.00']
  ]);
  if (sent.length) rows.push(['Overdue, reminded', count(sent.length, 'invoice'), total(sent)]);
  if (unsent.length) rows.push(['Overdue, no reminder yet', count(unsent.length, 'invoice'), total(unsent)]);
  const names = (ids) => listNames(ids.map((id) => reminder(id).name));
  return /** @type {Block[]} */ ([
    approval.status === 'rejected'
      ? { type: 'p', text: `Understood — I sent nothing. The reminders stay in Drafts in ${MAILBOX}, so you can send them yourself or ask me again later.` }
      : null,
    { type: 'p', text: 'September is reconciled: 42 invoices, €209,575.50 in total [1][2].' },
    { type: 'figures', rows },
    sent.length
      ? { type: 'p', text: `I sent first reminders to ${names(sent)} from ${MAILBOX}, using the template in your policy [4]. Replies will arrive there.${unsent.length ? ` ${names(unsent)} got none, as you asked.` : ''}` }
      : null,
    { type: 'p', text: 'For the books: RE-2026-0117 and RE-2026-0133 were paid on 30 September but aren’t booked yet [2], and Kestrel’s RE-2026-0138 isn’t overdue — it was reissued with a due date of 21 October [3].' }
  ].filter((block) => block !== null));
}

/**
 * The pieces an answer is written in: its paragraphs a word at a time, and every other block
 * whole. A paragraph that follows a paragraph opens with a blank line.
 * @param {Block[]} blocks
 * @returns {Array<{text: string}|{block: Block}>}
 */
function streamUnits(blocks) {
  return blocks.flatMap((block, index) => {
    if (block.type !== 'p') return [{ block }];
    const lead = index > 0 && blocks[index - 1].type === 'p' ? '\n\n' : '';
    return block.text.split(' ').map((word, n) => ({ text: n ? ` ${word}` : `${lead}${word}` }));
  });
}

/**
 * Adds one piece to the blocks written so far, the way the thread's answer takes it.
 * @param {Block[]} blocks
 * @param {{text: string}|{block: Block}} unit
 * @returns {void}
 */
function applyUnit(blocks, unit) {
  if ('block' in unit) {
    blocks.push(structuredClone(unit.block));
    return;
  }
  const last = blocks.at(-1);
  if (unit.text.startsWith('\n\n') || last?.type !== 'p') blocks.push({ type: 'p', text: unit.text.replace(/^\n\n/, '') });
  else last.text += unit.text;
}

export default {
  title: 'Agent chat',
  category: 'Pattern',
  blurb: 'One conversation with an agent that acts: its plan, every tool call, an approval that holds the run, a streamed answer with sources, and the run beside it.',
  components: [
    'AgentThread', 'RunTrace', 'ApprovalCard', 'Surface', 'SourceList', 'Composer', 'RunStatus', 'MenuButton', 'Message',
    'AppSidebar', 'ModuleBar', 'AccountMenu'
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

    // Mutable copies: runs move on, approvals get answered, and new conversations start. The
    // layout keeps each conversation's items and tells the thread what changed.
    const conversations = /** @type {Conversation[]} */ (structuredClone(CONVERSATIONS));
    const state = { current: conversations[0].id, seq: 0 };
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
    context.cleanup(() => {
      for (const own of activities.values()) cancel(own);
      activities.clear();
    });
    const historyParts = renderScope(context);

    /* ------------------------------------------------------------------ thread -- */

    // Narrow, where the run column has given way, its state rides in the header: the glyph and
    // the word while they fit beside the title, the glyph alone (named by the word) below that.
    const pillStatus = keep(new RunStatus(h('span'), { compact: true, ticking: false }));
    const pill = h('span', { class: 'agent-chat__pill' }, pillStatus.toElement());
    let pillMode = /** @type {true|'icon'} */ (true);
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
    const scroller = h('div', { class: 'shell__body agent-chat__thread', role: 'region', 'aria-label': 'Messages', tabindex: '0' });
    const thread = keep(new AgentThread(null, {
      items: current().items,
      authors: AUTHORS,
      label: `Conversation with the ${AGENT.name.toLowerCase()}`,
      scroller,
      answerActions: [],
      // A surface the agent composes resolves only what this example knows, and never opens a link.
      surfaceOptions: { resolve: { entities: [], link: () => false } },
      // This world has one day: an answer given on it reads as today.
      now: clock,
      formatTime: clockTime,
      emptyState: {
        icon: 'robot',
        title: 'What should the finance agent do?',
        description: `${AGENT.description} It asks before it sends anything.`,
        actions: SUGGESTIONS.map((text) => ({ label: text, onclick: () => send(text, []) }))
      }
    }));
    scroller.append(h('div', { class: 'agent-chat__column' }, thread.toElement()));

    /* ---------------------------------------------------------------- composer -- */

    const composer = keep(new Composer(null, {
      placeholder: 'Ask a follow-up or give an instruction',
      submitKey: 'mod+enter',
      attachments: true,
      note: 'The agent asks before it sends anything or changes a record.'
    }));
    const main = h('section', { class: 'shell__main agent-chat__main', 'aria-label': 'Conversation' },
      header, scroller,
      h('div', { class: 'agent-chat__dock' }, h('div', { class: 'agent-chat__composer' }, composer.toElement())));
    // Below 560px of pane the pill keeps to its glyph, so the title keeps its room.
    const fit = new ResizeObserver(([entry]) => {
      const mode = entry.contentRect.width < 560 ? 'icon' : true;
      if (mode === pillMode) return;
      pillMode = mode;
      pillStatus.update({ compact: mode });
    });
    fit.observe(main);
    context.cleanup(() => fit.disconnect());

    /* --------------------------------------------------------------------- run -- */

    const runStatus = keep(new RunStatus(null, { ticking: !preview, model: MODEL, now: clock }));
    // Each step shows what it stands for in the thread.
    const runSteps = keep(new RunTrace(null, { open: true, summary: false, showArguments: false, selectable: true }));
    const runSources = keep(new SourceList(null, { label: '', layout: 'list' }));
    const noRun = h('div', { class: 'panel-block' }, emptyState({
      icon: 'robot', title: 'No run yet', size: 'sm',
      description: 'Send a request and the run shows here: every step, what it read, and what it cost.'
    }));
    const stateBlock = h('div', { class: 'panel-block' }, runStatus.toElement());
    const stepsBlock = panelBlock('Steps', runSteps.toElement());
    const sourcesBlock = panelBlock('Sources', runSources.toElement());
    const runBody = h('div', { class: 'shell__body agent-chat__run', tabindex: '-1' },
      noRun, stateBlock, stepsBlock, panelBlock('Data it may touch', scopeList()), sourcesBlock);
    const aside = h('aside', { class: 'shell__aside agent-chat__aside', 'aria-label': 'Run' },
      paneHeader({ title: 'Run' }), runBody);

    root.append(main, aside);
    const notify = toaster(context, root);
    const openShortcuts = shortcutSheet(context, SHORTCUTS, { onclose: () => refocus() });
    more.on('close', () => refocus());

    /* ------------------------------------------------------------------ events -- */

    // The approval's answers come back to the layout, which records them with its own clock and
    // carries them out; the card is settled through the thread.
    thread.on('approve', (event) => {
      event.preventDefault();
      approve();
    });
    thread.on('reject', (event) => {
      event.preventDefault();
      reject(event.detail.reason);
    });
    thread.on('edit', (event) => {
      event.preventDefault();
      // After the card has closed its dialog: the card is redrawn with the new request, listing
      // the values the reader changed.
      const { values, changed, editedKeys } = event.detail;
      later(context, () => saveEdit(values, changed, editedKeys), 0);
    });
    // A surface the agent composed has been answered: the run continues with the values.
    thread.on('reply', (event) => answered(event.detail.item, event.detail.reply));
    thread.on('reveal', () => closeAside());
    composer.on('send', (event) => {
      event.preventDefault();
      if (send(event.detail.text, event.detail.files)) composer.clear();
    });
    composer.on('stop', () => stop());
    runSources.on('select', (event) => {
      event.preventDefault();
      const source = event.detail.source;
      if (source.call) reveal(`step:${source.call}`);
    });
    runSteps.on('select', (event) => {
      const id = event.detail.id;
      reveal(current().reveals?.[id] ?? `step:${id}`);
    });

    /* ---------------------------------------------------------------- keyboard -- */

    // A, E, and R belong to the approval card while it has the focus; the composer sends with
    // Mod+Enter and stops with Escape from its text.
    shortcuts(root, {
      'Mod+Enter': () => (busy() ? false : sendComposer()),
      // Escape stops what the agent is doing; with nothing running it declines the key, so a
      // surrounding dialog can close instead.
      Escape: () => (busy() ? stop() : false),
      n: () => newConversation(),
      '/': () => focusComposer(),
      '?': () => openShortcuts()
    }, context);
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
    thread.scrollToEnd();
    if (!preview) {
      // The run is waiting on the approval, so that is where the keys start — without a focus
      // ring, since nothing has been pressed yet.
      const approval = pendingApproval(current());
      if (approval) thread.getComponent(approval.id)?.focus({ preventScroll: true, focusVisible: false });
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

    /** @param {Conversation} conv @param {string} id @returns {any} */
    function itemOf(conv, id) {
      return conv.items.find((item) => item.id === id) ?? null;
    }

    /** @param {Conversation} conv @returns {any} The approval holding the run. */
    function pendingApproval(conv) {
      return conv.items.find((item) => item.type === 'approval' && item.status === 'pending') ?? null;
    }

    /** @param {Conversation} conv @returns {any} A surface the agent asked with, still unanswered. */
    function pendingSurface(conv) {
      return conv.items.find((item) => item.type === 'surface' && !item.reply) ?? null;
    }

    /** @param {Conversation} conv @returns {any} The last approval or surface: what the run asks the reader. */
    function lastQuestion(conv) {
      return [...conv.items].reverse().find((item) => item.type === 'approval' || item.type === 'surface') ?? null;
    }

    /**
     * The run's steps: its plan when it has one, otherwise every call it made — as rows, without
     * the arguments and results the thread already shows.
     * @param {Conversation} conv
     * @returns {TraceStep[]}
     */
    function stepsOf(conv) {
      const plan = conv.plan ? itemOf(conv, conv.plan) : null;
      const steps = plan ? plan.steps : conv.items.filter((item) => item.type === 'trace').flatMap((item) => item.steps);
      return steps.map(({ id, kind, label, status, doing, ms, retryOf }) => ({ id, kind, label, status, doing, ms, retryOf }));
    }

    /** @param {Run} run @returns {number} Milliseconds the agent has worked, including now. */
    function workTime(run) {
      return run.workMs + (run.state === 'running' && run.resumedAt ? performance.now() - run.resumedAt : 0);
    }

    /* ---------------------------------------------------- changing a conversation -- */

    /**
     * Adds an item, or replaces the item with its id, and shows it when the conversation is on
     * screen.
     * @param {Conversation} conv
     * @param {any} item
     * @returns {void}
     */
    function put(conv, item) {
      const index = conv.items.findIndex((entry) => entry.id === item.id);
      if (index < 0) conv.items.push(item);
      else conv.items[index] = item;
      if (conv === current()) thread.upsert(item);
    }

    /**
     * Changes part of an item, in the conversation and on screen.
     * @param {Conversation} conv
     * @param {string} id
     * @param {Record<string, unknown>} partial
     * @returns {void}
     */
    function change(conv, id, partial) {
      const item = itemOf(conv, id);
      if (!item) return;
      Object.assign(item, structuredClone(partial));
      if (conv === current()) thread.patch(id, partial);
    }

    /**
     * Adds a step to a trace, or changes the step with its id.
     * @param {Conversation} conv
     * @param {string} traceId
     * @param {TraceStep} step
     * @returns {void}
     */
    function putStep(conv, traceId, step) {
      const trace = itemOf(conv, traceId);
      if (!trace) return;
      const known = trace.steps.some((entry) => entry.id === step.id);
      const steps = known
        ? trace.steps.map((entry) => (entry.id === step.id ? { ...entry, ...step } : entry))
        : [...trace.steps, step];
      change(conv, traceId, traceId === conv.plan ? { steps, title: planTitle(steps) } : { steps });
    }

    /* ---------------------------------------------------------------- rendering -- */

    /** Redraws the regions that follow the conversation's state. @returns {void} */
    function render() {
      renderHistory();
      renderHeader();
      renderRun();
      composer.setBusy(busy());
      composer.setHint(busy() ? 'Working · Esc stops it'
        : current().run?.state === 'waiting' ? 'The run is waiting for your answer above' : '');
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

    /**
     * The agent's conversations, grouped by day. The rows are new elements after a redraw, so
     * the focus goes back to the row that had it.
     * @returns {void}
     */
    function renderHistory() {
      const active = document.activeElement;
      const inside = active instanceof HTMLElement && history.contains(active) && active !== history;
      const key = inside ? active.dataset.key : null;
      const today = formatDate(NOW, '%Y-%m-%d');
      const yesterday = formatDate(new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() - 1), '%Y-%m-%d');
      const groups = [['Today', []], ['Yesterday', []], ['Earlier', []]];
      for (const conv of conversations) {
        const day = conv.updated.slice(0, 10);
        groups[day === today ? 0 : day === yesterday ? 1 : 2][1].push(conv);
      }
      historyParts.reset();
      history.replaceChildren(...groups.filter(([, list]) => list.length).map(([label, list]) => h('section', { class: 'agent-chat__group' },
        h('h3', { class: 'list-group' }, label),
        h('ul', { class: 'agent-chat__convs', role: 'list' }, list.map((conv) => h('li', {}, conversationRow(conv)))))));
      if (inside && !preview && !(key && focusKey(key, history))) history.focus({ preventScroll: true });
    }

    /**
     * One conversation: its title, then the state of its run and when it last moved.
     * @param {Conversation} conv
     * @returns {HTMLButtonElement}
     */
    function conversationRow(conv) {
      const status = conv.run
        ? historyParts.own(new RunStatus(h('span'), { compact: true, ticking: false, state: conv.run.state })).toElement()
        : h('span', {}, 'No run yet');
      return /** @type {HTMLButtonElement} */ (h('button', {
        type: 'button', class: 'list-row agent-chat__conv', dataset: { key: `conv:${conv.id}` },
        'aria-current': conv.id === state.current ? 'page' : null,
        onclick: () => openConversation(conv.id)
      },
      h('span', { class: 'list-row__title' }, conv.title),
      h('span', { class: 'agent-chat__conv-meta' },
        h('span', { class: 'agent-chat__conv-state' }, status),
        h('span', { class: 'agent-chat__conv-time' }, listTime(toDate(conv.updated))))));
    }

    /** The title and, narrow, the run's state. @returns {void} */
    function renderHeader() {
      const conv = current();
      heading.textContent = conv.title;
      pill.hidden = !conv.run;
      if (conv.run) pillStatus.update({ state: conv.run.state });
    }

    /**
     * The run beside the thread: its state, clock and cost, the steps, what it may touch, and what
     * it read.
     * @returns {void}
     */
    function renderRun() {
      const conv = current();
      const run = conv.run;
      const hadFocus = runBody.contains(document.activeElement) && document.activeElement !== runBody;
      noRun.hidden = Boolean(run);
      stateBlock.hidden = !run;
      stepsBlock.hidden = !run;
      sourcesBlock.hidden = !run || !conv.sources.length;
      if (run) {
        const steps = stepsOf(conv);
        const done = steps.filter((step) => step.status === 'done').length;
        runStatus.update({
          state: run.state,
          summary: runSummary(conv, run, steps),
          steps: steps.length ? { done, total: steps.length } : null,
          started: run.started,
          workMs: workTime(run),
          waitingSince: run.waitingSince ?? null,
          finished: run.finished ?? null,
          tokens: run.tokens,
          cost: { amount: costOf(run.tokens), budget: BUDGET, currency: 'EUR' },
          actions: run.state === 'waiting' ? [{ label: 'Review the request', onclick: () => focusApproval() }]
            : run.state === 'failed' ? [{ label: 'Renew bank consent', onclick: () => notify(unavailable('Bank account settings'), 'info') }]
              : []
        });
        runSteps.setSteps(steps);
        runSources.setSources(conv.sources);
      }
      // A button that was redrawn under the focus hands it to the panel, never to the page.
      if (hadFocus && !preview && !runBody.contains(document.activeElement)) runBody.focus({ preventScroll: true });
    }

    /**
     * The run's state in one sentence.
     * @param {Conversation} conv
     * @param {Run} run
     * @param {TraceStep[]} steps
     * @returns {string}
     */
    function runSummary(conv, run, steps) {
      const done = steps.filter((step) => step.status === 'done').length;
      const skipped = steps.filter((step) => step.status === 'skipped').length;
      const index = steps.findIndex((step) => step.status === 'waiting' || step.status === 'running');
      const running = conv.items.filter((item) => item.type === 'trace' && item.id !== conv.plan)
        .flatMap((item) => item.steps).find((step) => step.status === 'running');
      return {
        waiting: pendingSurface(conv) ? 'The agent needs an answer from you to go on.' : `Step ${index + 1} of ${steps.length} needs your approval.`,
        running: running ? `${running.doing ?? running.label}…` : conv.busy ? 'Writing the answer…' : 'Working…',
        done: skipped
          ? `${formatNumber(done)} of ${formatNumber(steps.length)} steps done; ${formatNumber(skipped)} skipped at your request.`
          : `All ${count(steps.length, 'step')} finished.`,
        failed: run.error ?? 'The run stopped on an error.',
        stopped: 'You stopped the run. Nothing after that point ran.'
      }[run.state];
    }

    /** @returns {HTMLElement} What the agent may read, write, and never touch. */
    function scopeList() {
      return h('ul', { class: 'agent-chat__scopes' }, SCOPES.map((scope) => h('li', { class: 'agent-chat__scope', dataset: { access: scope.access === 'No access' ? 'none' : null } },
        icon(scope.icon, { size: 14 }),
        h('span', { class: 'agent-chat__scope-label' }, scope.label),
        h('span', { class: 'agent-chat__scope-access' }, scope.access))));
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
      if (run.state === 'running' && run.resumedAt) run.workMs += performance.now() - run.resumedAt;
      run.resumedAt = next === 'running' ? performance.now() : undefined;
      run.state = next;
      if (next !== 'running' && next !== 'waiting') run.finished = stamp(clock());
    }

    /**
     * Writes an answer into the thread a few words at a time, then calls `done`. Under reduced
     * motion it appears whole.
     * @param {Activity} own
     * @param {string} id The answer item, already in the conversation with no blocks.
     * @param {Block[]} blocks What it says once written.
     * @param {() => void} done
     * @returns {void}
     */
    function stream(own, id, blocks, done) {
      const { conv } = own;
      const answer = itemOf(conv, id);
      const units = streamUnits(blocks);
      let shown = 0;
      own.onstop = () => change(conv, id, { streaming: false, stopped: true });
      const finish = () => {
        if (activities.get(conv.id) !== own) return;
        cancel(own);
        // Finished early, the rest arrives at once.
        change(conv, id, shown < units.length ? { blocks, streaming: false } : { streaming: false });
        done();
      };
      own.flush = finish;
      if (prefersReducedMotion(root)) {
        wait(own, 500, finish);
        return;
      }
      wait(own, 450, () => {
        own.interval = window.setInterval(() => {
          for (const unit of units.slice(shown, shown + 2)) {
            applyUnit(answer.blocks, unit);
            if (conv !== current()) continue;
            if ('text' in unit) thread.appendText(id, unit.text);
            else thread.appendBlock(id, unit.block);
          }
          shown += 2;
          if (shown >= units.length) finish();
        }, 55);
      });
    }

    /** @param {string} kind @returns {string} A new item id. */
    function nextId(kind) {
      state.seq += 1;
      return `${kind}-${state.seq}`;
    }

    /** Approve, on the card or with A: the run resumes and sends. @returns {void} */
    function approve() {
      const conv = current();
      const approval = pendingApproval(conv);
      if (!approval || preview) return;
      settle();
      const ids = /** @type {ReminderValues} */ (approval.values).recipients;
      const n = ids.length;
      change(conv, approval.id, { status: 'approved', answeredAt: stamp(clock()) });
      if (conv.plan) putStep(conv, conv.plan, { id: 'plan-send', status: 'running', doing: 'Sending the reminders' });
      setRun(conv, 'running');
      /** @type {TraceStep} */
      const call = {
        id: nextId('send'), kind: 'call', status: 'running', label: `Sending ${count(n, 'reminder')}`, doing: `Sending ${count(n, 'reminder')}`,
        tool: 'mail.send', args: JSON.stringify({ drafts: ids.map((id) => reminder(id).invoice), from: MAILBOX })
      };
      // The call comes after the approval, so it starts a trace of its own at the end.
      const traceId = nextId('work');
      put(conv, { id: traceId, type: 'trace', at: stamp(clock()), open: true, steps: [call] });
      const own = begin(conv, () => {
        putStep(conv, traceId, { ...call, status: 'stopped', label: 'Sending stopped', count: 'nothing sent', result: 'Stopped by you before the mail left the billing mailbox.' });
        if (conv.plan) putStep(conv, conv.plan, { id: 'plan-send', status: 'stopped' });
      });
      render();
      thread.announce(`Approved. Sending ${count(n, 'reminder')}.`);
      wait(own, 1400, () => {
        putStep(conv, traceId, { ...call, status: 'done', label: `Sent ${count(n, 'reminder')}`, count: `${formatNumber(n)} delivered`, ms: 1380,
          result: ids.map((id) => `${reminder(id).email}: delivered`).join('\n') });
        if (conv.plan) putStep(conv, conv.plan, { id: 'plan-send', status: 'done', ms: 1380 });
        conclude(own, approval);
      });
    }

    /**
     * Reject, on the card or with R, with the reason the card asked for. Nothing is sent; the run
     * finishes without that step.
     * @param {string} reason
     * @returns {void}
     */
    function reject(reason) {
      const conv = current();
      const approval = pendingApproval(conv);
      if (!approval || preview) return;
      settle();
      change(conv, approval.id, { status: 'rejected', rejectReason: reason || null, answeredAt: stamp(clock()) });
      if (conv.plan) putStep(conv, conv.plan, { id: 'plan-send', status: 'skipped' });
      setRun(conv, 'running');
      const own = begin(conv, () => {});
      render();
      conclude(own, approval);
      // Said after the answer has started, so the decision is what is heard.
      thread.announce('Rejected. Nothing will be sent.');
      later(context, () => refocus(), 0);
    }

    /**
     * Saves the edited reminders. The request is drawn again for the new recipients and email,
     * lists the values the reader changed, and keeps waiting for an answer.
     * @param {ReminderValues} values
     * @param {string[]} changed The fields this save changed.
     * @param {string[]|null} editedKeys Every field changed so far, this save included.
     * @returns {void}
     */
    function saveEdit(values, changed, editedKeys) {
      const conv = current();
      const approval = pendingApproval(conv);
      if (!approval || preview) return;
      const next = {
        recipients: OVERDUE.map((entry) => entry.company).filter((id) => values.recipients?.includes(id)),
        subject: String(values.subject ?? '').trim() || TEMPLATE.subject,
        body: String(values.body ?? '').trim() || TEMPLATE.body
      };
      if (next.recipients.length && changed.length) {
        change(conv, approval.id, { ...reminderRequest(next), values: next, editedKeys });
        thread.announce(`Updated: ${count(next.recipients.length, 'reminder')} to approve.`);
      }
      thread.getComponent(approval.id)?.focus({ preventScroll: true });
    }

    /**
     * Writes the closing answer after an approval or a question was answered, then ends the run.
     * @param {Activity} own
     * @param {any} approval The approval answered, when the answer is written from it.
     * @param {Block[]} [blocks] The answer itself, when it is not about an approval.
     * @returns {void}
     */
    function conclude(own, approval, blocks = closingAnswer(approval)) {
      const { conv } = own;
      const id = nextId('answer');
      put(conv, { id, type: 'answer', blocks: [], streaming: true, sources: conv.sources });
      render();
      stream(own, id, blocks, () => {
        const run = conv.run;
        if (run) run.tokens = [run.tokens[0] + 5_540, run.tokens[1] + 872];
        finishActivity(conv);
        setRun(conv, 'done');
        conv.updated = stamp(clock());
        refresh(conv);
      });
    }

    /**
     * A surface the agent asked with has its reply. Submitted, the agent drafts the credit note
     * with the values and says what it did; cancelled, it drafts nothing. A surface destroyed
     * unanswered — the reader looked at another conversation — is no answer: it is asked again when
     * the conversation is shown.
     * @param {any} item The surface item, with its reply.
     * @param {import('../../src/components/surface/text.js').SurfaceReply} answer
     * @returns {void}
     */
    function answered(item, answer) {
      if (preview || context.signal.aborted || answer.action === 'dismiss') return;
      const conv = conversations.find((entry) => entry.items.some((own) => own.id === item.id && own.type === 'surface'));
      const asked = conv ? itemOf(conv, item.id) : null;
      if (!conv || !asked || asked.reply) return;
      asked.reply = structuredClone(answer);
      settle();
      setRun(conv, 'running');
      if (answer.action !== 'submit') {
        const own = begin(conv, () => {});
        render();
        conclude(own, null, [{ type: 'p', text: 'Understood — I drafted nothing. Tell me the invoice and the amount whenever you’re ready.' }]);
        return;
      }
      const values = /** @type {{invoice: string, amount: number, reason?: string}} */ (answer.values);
      const entry = CREDIT_INVOICES.find((candidate) => candidate.invoice === values.invoice) ?? CREDIT_INVOICES[0];
      const amount = Math.min(Number(values.amount) || 0, entry.amount);
      const reason = String(values.reason ?? '').trim();
      /** @type {TraceStep} */
      const call = {
        id: nextId('credit'), kind: 'write', status: 'running', label: 'Drafting the credit note', doing: 'Drafting the credit note',
        tool: 'invoices.credit_notes.draft', args: JSON.stringify({ invoice: entry.invoice, amount, reason })
      };
      const traceId = nextId('work');
      put(conv, { id: traceId, type: 'trace', at: stamp(clock()), open: true, steps: [call] });
      const own = begin(conv, () => putStep(conv, traceId, { ...call, status: 'stopped', label: 'Drafting stopped', result: 'Stopped by you. Nothing was saved.' }));
      render();
      thread.announce('Answered. Drafting the credit note.');
      wait(own, 1200, () => {
        putStep(conv, traceId, { ...call, status: 'done', label: 'Drafted credit note GS-2026-0019', count: 'not booked', ms: 1150,
          result: `GS-2026-0019 against ${entry.invoice}: ${euro(amount)}. Saved as a draft.` });
        conclude(own, null, [
          { type: 'p', text: `I drafted credit note **GS-2026-0019** for Bruckner Logistik against ${entry.invoice} [1].` },
          { type: 'figures', rows: [['Invoice', `${entry.label}`, euro(entry.amount)], ['Credit', reason || 'No reason given', `−${euro(amount)}`], ['Still open', entry.invoice, euro(entry.amount - amount)]] },
          { type: 'p', text: `It is a draft: I can’t book it, so it waits in Invoices › Credit notes for someone in finance to check and book. Felix Bruckner’s note is answered once it is sent [2].` }
        ]);
      });
    }

    /**
     * Sends a message. While the run waits for an approval the agent says so; otherwise this
     * example answers honestly that only the reconciliation is scripted.
     * @param {string} text
     * @param {Array<{name: string, size: number}>} files
     * @returns {boolean} Whether it was sent.
     */
    function send(text, files) {
      const conv = current();
      if (conv.busy || preview) return false;
      if (!text && !files.length) {
        focusComposer();
        return false;
      }
      const at = stamp(clock());
      const first = !conv.items.length;
      put(conv, { id: nextId('user'), type: 'user', at, text, files: files.map((file) => ({ name: file.name, size: file.size })) });
      if (first) conv.title = text ? (text.length > 44 ? `${text.slice(0, 43).trimEnd()}…` : text) : 'Files for the agent';
      conv.updated = at;
      const waiting = conv.run?.state === 'waiting';
      if (!conv.run) startRun(conv);
      else reply(conv, waiting ? [conv.waiting ?? WAITING_REPLY] : EXAMPLE_REPLY);
      focusComposer();
      return true;
    }

    /** Mod+Enter outside the text sends what the composer holds. @returns {void} */
    function sendComposer() {
      if (send(composer.getValue().trim(), composer.getFiles())) composer.clear();
    }

    /**
     * A short answer that is not a run of its own.
     * @param {Conversation} conv
     * @param {string[]} paragraphs
     * @returns {void}
     */
    function reply(conv, paragraphs) {
      const id = nextId('answer');
      const own = begin(conv, () => {});
      put(conv, { id, type: 'answer', at: stamp(clock()), blocks: [], streaming: true });
      render();
      stream(own, id, paragraphs.map((text) => ({ type: 'p', text })), () => {
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
      conv.run = { state: 'running', started: stamp(clock()), workMs: 0, tokens: [2_310, 0], resumedAt: performance.now() };
      /** @type {TraceStep} */
      const call = {
        id: nextId('call'), kind: 'search', status: 'running', label: 'Looked for matching records', doing: 'Looking for matching records',
        at: stamp(clock()), tool: 'records.search', args: JSON.stringify({ query: conv.title })
      };
      const traceId = nextId('work');
      put(conv, { id: traceId, type: 'trace', at: stamp(clock()), open: true, steps: [call] });
      const own = begin(conv, () => putStep(conv, traceId, { ...call, status: 'stopped', label: 'Search stopped', result: 'Stopped by you.' }));
      render();
      wait(own, 1100, () => {
        putStep(conv, traceId, { ...call, status: 'done', count: 'example data only', ms: 1040,
          result: 'This example has no live data. The September reconciliation is its one scripted run.' });
        const id = nextId('answer');
        put(conv, { id, type: 'answer', blocks: [], streaming: true });
        refresh(conv);
        stream(own, id, EXAMPLE_REPLY.map((text) => ({ type: 'p', text })), () => {
          if (conv.run) conv.run.tokens = [conv.run.tokens[0] + 640, 214];
          finishActivity(conv);
          setRun(conv, 'done');
          refresh(conv);
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
      if (conv.run?.state === 'running') setRun(conv, 'stopped');
      if (quiet) return;
      render();
      thread.announce('Stopped.');
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

    /** @param {Conversation} conv Redraws, if that conversation is on screen. @returns {void} */
    function refresh(conv) {
      if (conv === current()) render();
      else renderHistory();
    }

    /* -------------------------------------------------------------- navigation -- */

    /**
     * Shows a conversation: its items in the thread, and its run.
     * @param {string} id
     * @returns {void}
     */
    function openConversation(id) {
      if (id === state.current) return;
      state.current = id;
      thread.setItems(current().items);
      render();
      thread.scrollToEnd();
    }

    /** N: an empty conversation, or the empty one already there. @returns {void} */
    function newConversation() {
      if (preview) return;
      let conv = conversations.find((entry) => !entry.items.length);
      if (!conv) {
        conv = { id: `new-${nextId('conv')}`, title: 'New conversation', updated: stamp(clock()), plan: null, items: [], sources: [], run: null };
        conversations.unshift(conv);
      }
      openConversation(conv.id);
      if (root.dataset.navOpen === 'true') shell.closeNav();
      focusComposer();
    }

    /** /: puts the cursor in the composer. @returns {void} */
    function focusComposer() {
      if (preview) return;
      composer.focus();
    }

    /** Narrow, the run is a drawer over the thread: it closes before the thread shows something. @returns {void} */
    function closeAside() {
      if (root.dataset.asideOpen === 'true') shell.toggleAside(false);
    }

    /** Moves focus to the approval or the question holding the run. @returns {void} */
    function focusApproval() {
      const question = lastQuestion(current());
      if (question) reveal(`item:${question.id}`);
    }

    /**
     * Shows something in the thread, closing the run drawer first: a call (`step:<id>`) opened
     * with the focus on it, or the approval (`item:<id>`) with the focus on the card, where A, E
     * and R answer it.
     * @param {string} target
     * @returns {void}
     */
    function reveal(target) {
      if (preview) return;
      closeAside();
      const card = target.startsWith('item:') ? thread.getComponent(target.slice(5)) : null;
      if (!card) {
        thread.reveal(target);
        return;
      }
      card.toElement().scrollIntoView({ block: 'nearest' });
      card.focus({ preventScroll: true });
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
        const question = lastQuestion(current());
        const card = question ? thread.getComponent(question.id) : null;
        if (card) card.focus({ preventScroll: true });
        else scroller.focus({ preventScroll: true });
      }, 0);
    }

    /** Copies the conversation as plain text. @returns {Promise<void>} */
    async function copyTranscript() {
      const conv = current();
      const lines = [conv.title, ''];
      for (const item of thread.getItems()) {
        const any = /** @type {any} */ (item);
        if (any.type === 'user') lines.push(`You: ${any.text}${any.files?.length ? ` [${any.files.map((file) => file.name).join(', ')}]` : ''}`);
        else if (any.type === 'text') lines.push(`${AGENT.name}: ${any.text}`);
        else if (any.type === 'trace') lines.push(...any.steps.map((step) => `  ${step.label}${step.count ? ` · ${step.count}` : ''}${step.status && step.status !== 'done' ? ` (${step.status})` : ''}`));
        else if (any.type === 'approval') lines.push(`  Approval: ${any.title} — ${any.status}${any.rejectReason ? ` (“${any.rejectReason}”)` : ''}`);
        else if (any.type === 'answer') lines.push(`${AGENT.name}: ${thread.getComponent(any.id)?.toText() ?? ''}`);
        else if (any.type === 'surface' && any.document) lines.push(any.reply ? surfaceText(any.document, any.reply).replace(/^/gm, '  ') : `  Question: ${any.document.title}`);
      }
      const copied = await copyToClipboard(lines.join('\n'));
      notify(copied ? 'Transcript copied.' : 'The transcript couldn’t be copied.', copied ? 'success' : 'error');
    }
  }
};
