import {
  AgentAvatar, AgentThread, BlockView, ChartJsAdapter, Composer, MenuButton, PromptStarters, SourceList, Surface, Tabbox, badge,
  button, emptyState, formatCurrency, formatDate, formatNumber, h, prefersReducedMotion, skeletonText, surfaceText,
  uid, watchMotion
} from '../../src/index.js';
import {
  DATE, adaptiveShell, disposer, iconButton, kbd, later, layoutContext, loadChartJs, paneHeader,
  renderScope, shortcutSheet, shortcuts, suiteNav
} from './kit.js';
import { ME, NOW, ORGANISATION, company, person } from './fixtures.js';

/** The agent this screen talks to. */
const AGENT = {
  name: 'Finance agent',
  description: 'Answers with charts, tables and forms it composes. Open any answer beside the conversation to see its JSON and the reply it produced.'
};
const MAILBOX = `billing@${ORGANISATION.domain}`;

/**
 * The agent's face: a generated AgentAvatar, seeded by a stable id so a rename keeps it, in the
 * agent's tone, with the soft material where it is drawn large enough.
 */
const AGENT_FACE = { seed: 'agt-finance', tone: 'violet', material: 'soft' };

/** Who takes part: the person reading, and the agent. A surface's `author` names one of them. */
const AUTHORS = {
  me: { name: person(ME)?.name ?? 'You', kind: 'person' },
  finance: { name: AGENT.name, kind: 'agent', tone: 'violet', face: AGENT_FACE }
};

/** October week by week, in euros: invoiced, collected, and September's invoices for comparison. */
const OCTOBER = {
  weeks: ['1–4 Oct', '5–11 Oct', '12–18 Oct', '19–25 Oct', '26–31 Oct'],
  invoiced: [52400, 61800, 58900, 71300, 42000],
  collected: [44100, 50200, 55600, 57400, 34680],
  september: [47100, 55800, 50300, 60400, 42100]
};

/** September invoices more than 14 days past their due date. */
const OVERDUE = [
  { invoice: 'RE-2026-0121', company: 'helios', amount: 4860 },
  { invoice: 'RE-2026-0126', company: 'bruckner', amount: 12340 },
  { invoice: 'RE-2026-0129', company: 'northstar', amount: 2175.5 }
];

/** Bruckner's two open invoices, either of which the damaged pallets may concern. */
const CREDIT_INVOICES = [
  { invoice: 'RE-2026-0126', label: 'Freight Munich–Lyon', amount: 12340 },
  { invoice: 'RE-2026-0134', label: 'Pallet hire', amount: 3980 }
];

/** What the agent would change on Helios Energie, each row naming the record it touches. */
const HELIOS_CHANGES = [
  { id: 'name', field: 'name', label: 'Name', before: 'Helios Energie SARL', after: 'Helios Energie', ref: { $ref: 'company', id: 'helios' } },
  { id: 'vat', field: 'vatId', label: 'VAT ID', before: 'FR 12 345678901', after: 'FR 40 303265045', ref: { $ref: 'company', id: 'helios' } },
  { id: 'terms', field: 'paymentTerms', label: 'Terms', before: '30 days', after: '14 days', ref: { $ref: 'company', id: 'helios' } },
  { id: 'owner', field: 'owner', label: 'Owner', before: 'Tobias Kern', after: 'Nadine Roth', ref: { $ref: 'person', id: 'nadine' } }
];

/** Reminder drafts older than 90 days that were never sent. */
const OLD_DRAFTS = [
  'RE-2026-0042 · Alpine Works GmbH · drafted 2 June',
  'RE-2026-0051 · Kestrel Analytics · drafted 11 June',
  'RE-2026-0058 · Meridian Health · drafted 20 June',
  'RE-2026-0063 · Danube Systems AG · drafted 3 July'
];

/** The webhook address the snippet listens on. */
const WEBHOOK = `https://hooks.${ORGANISATION.domain}/billing/invoice-paid`;

/** The handler the webhook snippet shows. */
const WEBHOOK_CODE = [
  '// Called when a customer pays an invoice.',
  'export async function onInvoicePaid(request) {',
  '  const event = await request.json();',
  '  if (event.type !== "invoice.paid") return new Response(null, { status: 204 });',
  '  await ledger.book(event.invoice, event.amount);',
  '  return new Response(null, { status: 200 });',
  '}'
].join('\n');

/* -------------------------------------------------------------- surfaces -- */

/*
 * Every answer is a `surface/1` document, streamed as operation lines: `begin`, then nodes, data
 * and actions, then `end`. Each constant below is one surface as the agent writes it.
 */

/** 1 · "How did October go?" Three figures, a bar chart, and a text written on with `append`. */
const OCTOBER_LINES = [
  { zx: 'surface/1', op: 'begin', surface: 'october', intent: 'show', title: 'October at a glance', author: 'finance', root: ['figures', 'weeks', 'summary'] },
  { op: 'node', surface: 'october', id: 'figures', type: 'columns', count: 3, children: ['invoiced', 'collected', 'overdue'] },
  { op: 'node', surface: 'october', id: 'invoiced', type: 'stat', label: 'Invoiced', value: 286400, format: 'currency', currency: 'EUR', delta: 30700, caption: 'vs. September' },
  { op: 'node', surface: 'october', id: 'collected', type: 'stat', label: 'Collected', value: 241980, format: 'currency', currency: 'EUR', caption: '84% of what was invoiced' },
  { op: 'node', surface: 'october', id: 'overdue', type: 'stat', label: 'Overdue', value: 19375.5, format: 'currency', currency: 'EUR', caption: '3 invoices, over 14 days' },
  {
    op: 'node', surface: 'october', id: 'weeks', type: 'chart', kind: 'bar', label: 'Invoiced and collected per week',
    description: 'Collections trail invoicing by about a week.',
    data: { labels: OCTOBER.weeks, datasets: [{ label: 'Invoiced', data: OCTOBER.invoiced }, { label: 'Collected', data: OCTOBER.collected }] }
  },
  { op: 'node', surface: 'october', id: 'summary', type: 'text', text: 'October closed with **€286,400.00** invoiced,' },
  { op: 'append', surface: 'october', id: 'summary', text: ' 12% more than September [1].' },
  { op: 'append', surface: 'october', id: 'summary', text: ' Collections kept pace: **€241,980.00** arrived [2].' },
  { op: 'append', surface: 'october', id: 'summary', text: ' Three September invoices are still more than 14 days overdue [1].' },
  { op: 'end', surface: 'october', sources: [{ n: 1, title: 'Invoices · October 2026' }, { n: 2, title: 'Bank payments · October 2026' }] }
];

/** 2 · "Chase the overdue invoices" A review: rows to pick, bound to data, and a send the policy confirms. */
const REMINDER_LINES = [
  { zx: 'surface/1', op: 'begin', surface: 'reminders', intent: 'review', title: 'Send first reminders?', author: 'finance', root: ['why', 'invoices', 'options'] },
  { op: 'node', surface: 'reminders', id: 'why', type: 'text', text: 'Three September invoices are more than **14 days** overdue. Pick the ones to chase [1].' },
  {
    op: 'node', surface: 'reminders', id: 'invoices', type: 'table', name: 'invoices', label: 'Overdue invoices', selectable: 'multi', rowId: 'invoice',
    rows: { $data: '/overdue' },
    columns: [
      { id: 'invoice', label: 'Invoice' },
      { id: 'customer', label: 'Customer' },
      { id: 'amount', label: 'Amount', align: 'end', format: 'currency', currency: 'EUR' }
    ]
  },
  {
    op: 'node', surface: 'reminders', id: 'options', type: 'fields',
    schema: {
      type: 'object', required: ['template', 'sendOn'],
      properties: {
        template: {
          type: 'string', title: 'Template', default: 'reminder-1',
          oneOf: [{ const: 'reminder-1', title: 'First reminder' }, { const: 'reminder-2', title: 'Second reminder, €5.00 fee' }]
        },
        sendOn: { type: 'string', format: 'date', title: 'Send on', default: '2026-10-09' }
      }
    }
  },
  {
    op: 'data', surface: 'reminders', path: '/overdue',
    value: OVERDUE.map((row) => ({ invoice: row.invoice, customer: { $ref: 'company', id: row.company }, amount: row.amount }))
  },
  {
    op: 'actions', surface: 'reminders', items: [
      { id: 'send', label: 'Send reminders', kind: 'primary', tool: 'mail.send' },
      { id: 'later', label: 'Not now' }
    ]
  },
  { op: 'end', surface: 'reminders', sources: [{ n: 1, title: 'Invoices · September 2026' }] }
];

/** 3 · "Draft a credit note" A form: a field shown only for "Something else", a slider, a date. */
const CREDIT_NOTE_LINES = [
  { zx: 'surface/1', op: 'begin', surface: 'credit-note', intent: 'ask', title: 'Credit note for Bruckner Logistik', author: 'finance', root: ['why', 'form'] },
  { op: 'node', surface: 'credit-note', id: 'why', type: 'text', text: 'Felix Bruckner reports two damaged pallets but names no invoice or amount. Tell me what the credit note should say.' },
  {
    op: 'node', surface: 'credit-note', id: 'form', type: 'fields',
    schema: {
      type: 'object', required: ['invoice', 'reason', 'explain', 'issueOn'],
      properties: {
        invoice: {
          type: 'string', title: 'Invoice', default: CREDIT_INVOICES[0].invoice,
          oneOf: CREDIT_INVOICES.map((entry) => ({ const: entry.invoice, title: `${entry.invoice} · ${entry.label} · ${formatCurrency(entry.amount, 'EUR')}` }))
        },
        reason: {
          type: 'string', title: 'Reason', default: 'damaged', 'x-zx': { field: 'optionlist' },
          oneOf: [
            { const: 'damaged', title: 'Goods damaged in transit' },
            { const: 'price', title: 'A lower price was agreed' },
            { const: 'other', title: 'Something else' }
          ]
        },
        explain: {
          type: 'string', title: 'What happened', maxLength: 300,
          'x-zx': { field: 'textarea', visible: { field: 'reason', op: 'eq', value: 'other' } }
        },
        share: {
          type: 'integer', title: 'Credit, as a share of the invoice (%)', minimum: 5, maximum: 100, default: 15,
          'x-zx': { field: 'slider' }
        },
        issueOn: { type: 'string', format: 'date', title: 'Issue on' }
      }
    }
  },
  { op: 'end', surface: 'credit-note' }
];

/** 4 · "Tidy up Helios' record" A review of proposed changes, each row naming its record. */
const HELIOS_LINES = [
  { zx: 'surface/1', op: 'begin', surface: 'helios-record', intent: 'review', title: 'Tidy up Helios Energie', author: 'finance', root: ['why', 'changes'] },
  { op: 'node', surface: 'helios-record', id: 'why', type: 'text', text: 'Four details disagree with Helios’ last invoices and their signed order [1]. Tick the changes to apply.' },
  { op: 'node', surface: 'helios-record', id: 'changes', type: 'diff', name: 'accepted', label: 'Proposed changes', rows: HELIOS_CHANGES },
  { op: 'end', surface: 'helios-record', sources: [{ n: 1, title: 'Invoices and order · Helios Energie' }] }
];

/** 5 · "Set up the dunning run" Questions one at a time: a branch, checked answers, and a review. */
const DUNNING_LINES = [
  { zx: 'surface/1', op: 'begin', surface: 'dunning-run', intent: 'questionnaire', title: 'Set up the dunning run', author: 'finance', root: ['steps'] },
  {
    op: 'node', surface: 'dunning-run', id: 'steps', type: 'questionnaire', review: true,
    steps: [
      {
        name: 'scope', prompt: 'Which overdue invoices should the run look at?', required: true,
        choices: [
          { value: 'all', label: 'Every overdue invoice' },
          { value: 'large', label: 'Only larger amounts', description: 'From an amount you choose' }
        ],
        next: [{ if: { field: 'scope', op: 'eq', value: 'large' }, goto: 'threshold' }, { goto: 'stage' }]
      },
      {
        name: 'threshold', prompt: 'From which amount, in euros?', when: { field: 'scope', op: 'eq', value: 'large' },
        input: { label: 'Amount in euros', placeholder: '1000' },
        validate: [{ required: true, message: 'Give an amount.' }, { minimum: 100, message: 'Below €100.00 a reminder costs more than it brings in.' }],
        next: 'stage'
      },
      {
        name: 'stage', prompt: 'Which reminder should it send?', required: true,
        choices: [
          { value: 'first', label: 'First reminder', description: '14 days after the due date' },
          { value: 'second', label: 'Second reminder', description: '28 days after, with a €5.00 fee' }
        ]
      },
      {
        name: 'notify', prompt: 'Who gets the summary after each run?', input: { label: 'Email' },
        validate: [{ required: true, message: 'Say who gets the summary.' }, { format: 'email', message: 'That is not an email address.' }]
      }
    ]
  },
  { op: 'end', surface: 'dunning-run' }
];

/** 6 · "Show that as a trend" A choice with icons; the answer redraws October as a line chart. */
const TREND_LINES = [
  { zx: 'surface/1', op: 'begin', surface: 'trend-choice', intent: 'choose', title: 'Which trend should I draw?', author: 'finance', root: ['pick'] },
  {
    op: 'node', surface: 'trend-choice', id: 'pick', type: 'choice', name: 'series', label: 'Show October as',
    choices: [
      { value: 'weekly', label: 'Week by week', description: 'Invoiced and collected, as lines', icon: 'chart-line' },
      { value: 'running', label: 'Running total', description: 'How the month added up', icon: 'arrow-trend-up' },
      { value: 'september', label: 'Against September', description: 'Invoiced per week, both months', icon: 'chart-column' }
    ]
  },
  { op: 'end', surface: 'trend-choice' }
];

/** 7 · "Delete the old drafts" A confirmation whose danger action the policy makes you type. */
const DRAFTS_LINES = [
  { zx: 'surface/1', op: 'begin', surface: 'old-drafts', intent: 'confirm', title: 'Delete 4 old reminder drafts?', author: 'finance', root: ['why', 'drafts'] },
  { op: 'node', surface: 'old-drafts', id: 'why', type: 'text', text: `These drafts in ${MAILBOX} are older than 90 days and were never sent.` },
  { op: 'node', surface: 'old-drafts', id: 'drafts', type: 'list', items: OLD_DRAFTS },
  {
    op: 'actions', surface: 'old-drafts', items: [
      { id: 'delete', label: 'Delete 4 drafts', kind: 'danger', tool: 'drafts.delete', description: 'Deleted drafts can’t be restored.' }
    ]
  },
  { op: 'end', surface: 'old-drafts' }
];

/**
 * 8 · "Give me the webhook snippet" The first attempt: the address comes as a `copyfield`, a node
 * type no catalog has. The application drops it and reports why.
 */
const WEBHOOK_LINES = [
  { zx: 'surface/1', op: 'begin', surface: 'webhook', intent: 'show', title: 'Webhook for paid invoices', author: 'finance', root: ['intro', 'address', 'code', 'check'] },
  { op: 'node', surface: 'webhook', id: 'intro', type: 'text', text: 'Register this address for the `invoice.paid` event, then handle the calls like this.' },
  { op: 'node', surface: 'webhook', id: 'address', type: 'copyfield', label: 'Webhook address', value: WEBHOOK },
  { op: 'node', surface: 'webhook', id: 'code', type: 'code', language: 'js', code: WEBHOOK_CODE },
  { op: 'node', surface: 'webhook', id: 'check', type: 'callout', tone: 'warning', title: 'Check the signature first', text: 'Book nothing until the `X-Signature` header matches the shared secret.' },
  { op: 'end', surface: 'webhook' }
];

/**
 * The corrected surface, sent after the agent read the report: the address is a `code` node now,
 * which the catalog has and which comes with a copy button.
 */
const WEBHOOK_FIXED_LINES = [
  { zx: 'surface/1', op: 'begin', surface: 'webhook', intent: 'show', title: 'Webhook for paid invoices', author: 'finance', root: ['intro', 'address', 'code', 'check'] },
  { op: 'node', surface: 'webhook', id: 'intro', type: 'text', text: 'Register this address for the `invoice.paid` event, then handle the calls like this.' },
  { op: 'node', surface: 'webhook', id: 'address', type: 'code', language: 'url', code: WEBHOOK },
  { op: 'node', surface: 'webhook', id: 'code', type: 'code', language: 'js', code: WEBHOOK_CODE },
  { op: 'node', surface: 'webhook', id: 'check', type: 'callout', tone: 'warning', title: 'Check the signature first', text: 'Book nothing until the `X-Signature` header matches the shared secret.' },
  { op: 'end', surface: 'webhook' }
];

/* ---------------------------------------------------- answers to replies -- */

/**
 * @typedef {import('../../src/components/surface/validate.js').SurfaceError} SurfaceError
 * @typedef {import('../../src/components/surface/text.js').SurfaceReply} SurfaceReply
 * @typedef {Record<string, any>} Op One operation line, as the agent writes it.
 * @typedef {{lines?: Op[], text?: string}} Answer What the agent does with a reply: stream another
 *   surface, or say one plain sentence.
 * @typedef {{id: string, prompt: string, what: string, icon: string, match: RegExp, lines: Op[],
 *   answer?: (reply: SurfaceReply) => Answer|null}} Scenario
 */

/** @param {number} amount @returns {string} */
function euro(amount) {
  return formatCurrency(amount, 'EUR');
}

/** @param {unknown} value `YYYY-MM-DD`. @returns {string} "9 October 2026". */
function longDate(value) {
  const text = String(value ?? '');
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? formatDate(new Date(`${text}T00:00`), DATE.long) : text;
}

/**
 * The short `show` surface that closes a request: a badge, figures, and a callout.
 * @param {string} id
 * @param {{title: string, badge: [string, string], rows: Array<{label: string, value: string, detail?: string}>,
 *   note: string, tone?: string}} parts
 * @returns {Op[]}
 */
function resultLines(id, { title, badge: [label, kind], rows, note, tone = 'info' }) {
  const root = rows.length ? ['state', 'figures', 'note'] : ['state', 'note'];
  return [
    { zx: 'surface/1', op: 'begin', surface: id, intent: 'show', title, author: 'finance', root },
    { op: 'node', surface: id, id: 'state', type: 'badge', label, kind },
    ...(rows.length ? [{ op: 'node', surface: id, id: 'figures', type: 'figures', rows }] : []),
    { op: 'node', surface: id, id: 'note', type: 'callout', tone, text: note },
    { op: 'end', surface: id }
  ];
}

/** 2 · The reminders, sent or not. @param {SurfaceReply} reply @returns {Answer} */
function reminderAnswer(reply) {
  const picked = OVERDUE.filter((row) => Array.isArray(reply.values.invoices) && reply.values.invoices.includes(row.invoice));
  if (reply.action !== 'send' || !picked.length) {
    return {
      lines: resultLines('reminders-result', {
        title: 'No reminders sent', badge: ['Not sent', 'neutral'], rows: [],
        note: reply.action === 'send' ? 'No invoice was picked, so nothing went out.' : `The drafts stay in ${MAILBOX} until you ask again.`
      })
    };
  }
  const template = reply.values.template === 'reminder-2' ? 'Second reminder, €5.00 fee' : 'First reminder';
  return {
    lines: resultLines('reminders-result', {
      title: `${picked.length === 1 ? 'Reminder' : 'Reminders'} scheduled`, badge: ['Scheduled', 'success'],
      rows: [
        ...picked.map((row) => ({ label: company(row.company)?.name ?? row.company, detail: row.invoice, value: euro(row.amount) })),
        { label: 'Template', value: template },
        { label: 'Send on', value: longDate(reply.values.sendOn) }
      ],
      note: `They go out from ${MAILBOX}, and replies arrive there.`
    })
  };
}

/** 3 · The credit note, drafted or not. @param {SurfaceReply} reply @returns {Answer} */
function creditAnswer(reply) {
  if (reply.action !== 'submit') {
    return { lines: resultLines('credit-note-result', { title: 'No credit note', badge: ['Not drafted', 'neutral'], rows: [], note: 'I drafted nothing. Ask again when you know the amount.' }) };
  }
  const values = reply.values;
  const entry = CREDIT_INVOICES.find((candidate) => candidate.invoice === values.invoice) ?? CREDIT_INVOICES[0];
  const share = Number(values.share) || 0;
  const reasons = { damaged: 'Goods damaged in transit', price: 'A lower price was agreed' };
  return {
    lines: resultLines('credit-note-result', {
      title: 'Credit note GS-2026-0019 drafted', badge: ['Draft', 'info'],
      rows: [
        { label: 'Against', detail: entry.label, value: entry.invoice },
        { label: 'Reason', value: reasons[values.reason] ?? String(values.explain ?? 'Something else') },
        { label: 'Credit', detail: `${formatNumber(share)}% of ${euro(entry.amount)}`, value: `−${euro(entry.amount * share / 100)}` },
        { label: 'Issue on', value: longDate(values.issueOn) }
      ],
      note: 'It waits in Invoices › Credit notes until someone in finance books it.'
    })
  };
}

/** 4 · The record, changed or left. @param {SurfaceReply} reply @returns {Answer} */
function heliosAnswer(reply) {
  const accepted = HELIOS_CHANGES.filter((row) => reply.action === 'approve' && Array.isArray(reply.values.accepted) && reply.values.accepted.includes(row.id));
  const kept = HELIOS_CHANGES.length - accepted.length;
  if (!accepted.length) {
    return { lines: resultLines('helios-record-result', { title: 'Helios Energie unchanged', badge: ['Unchanged', 'neutral'], rows: [], note: 'I changed nothing on the record.' }) };
  }
  return {
    lines: resultLines('helios-record-result', {
      title: 'Helios Energie updated', badge: ['Updated', 'success'],
      rows: accepted.map((row) => ({ label: row.label, detail: `was ${row.before}`, value: row.after })),
      note: kept ? `${kept} ${kept === 1 ? 'detail stays' : 'details stay'} as ${kept === 1 ? 'it was' : 'they were'}, as you chose.` : 'Every change is applied.'
    })
  };
}

/** 5 · The dunning run, scheduled or not. @param {SurfaceReply} reply @returns {Answer} */
function dunningAnswer(reply) {
  if (reply.action !== 'submit') {
    return { lines: resultLines('dunning-run-result', { title: 'No dunning run', badge: ['Not set up', 'neutral'], rows: [], note: 'Nothing is scheduled. Overdue invoices wait for you.' }) };
  }
  const answers = /** @type {Record<string, unknown>} */ (reply.values.answers ?? {});
  const threshold = Number(answers.threshold);
  return {
    lines: resultLines('dunning-run-result', {
      title: 'Dunning run scheduled', badge: ['Every Monday', 'success'],
      rows: [
        { label: 'Invoices', value: answers.scope === 'large' && Number.isFinite(threshold) ? `Overdue, from ${euro(threshold)}` : 'Every overdue invoice' },
        { label: 'Sends', value: answers.stage === 'second' ? 'Second reminder, €5.00 fee' : 'First reminder' },
        { label: 'Summary to', value: String(answers.notify ?? '') }
      ],
      note: 'The first run is on Monday, 12 October at 06:00. Each one asks you before mail goes out.'
    })
  };
}

/**
 * 6 · October again, as the trend picked: the same surface id, so a new version of the first
 * artifact, titled for what it now shows.
 * @param {SurfaceReply} reply
 * @returns {Answer}
 */
function trendAnswer(reply) {
  if (reply.action !== 'submit') return { text: 'Understood — October stays a bar chart.' };
  const series = String(reply.values.series ?? 'weekly');
  const running = (values) => values.map((_, index) => values.slice(0, index + 1).reduce((sum, value) => sum + value, 0));
  const chart = {
    weekly: { title: 'October week by week', label: 'Invoiced and collected per week', data: { labels: OCTOBER.weeks, datasets: [{ label: 'Invoiced', data: OCTOBER.invoiced }, { label: 'Collected', data: OCTOBER.collected }] } },
    running: { title: 'October as a running total', label: 'Running total through October', data: { labels: OCTOBER.weeks, datasets: [{ label: 'Invoiced', data: running(OCTOBER.invoiced) }, { label: 'Collected', data: running(OCTOBER.collected) }] } },
    september: { title: 'October against September', label: 'Invoiced per week, October against September', data: { labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5'], datasets: [{ label: 'October', data: OCTOBER.invoiced }, { label: 'September', data: OCTOBER.september }] } }
  }[series] ?? null;
  if (!chart) return { text: 'I can’t draw that one.' };
  return {
    lines: OCTOBER_LINES.map((line) => (line.op === 'begin' ? { ...line, title: chart.title }
      : line.id === 'weeks' ? { ...line, kind: 'line', label: chart.label, description: 'Redrawn as a line, as you asked.', data: chart.data }
        : line))
  };
}

/** 7 · The drafts, deleted or kept. @param {SurfaceReply} reply @returns {Answer} */
function draftsAnswer(reply) {
  if (reply.action !== 'delete') {
    return { lines: resultLines('old-drafts-result', { title: 'Nothing deleted', badge: ['Kept', 'neutral'], rows: [], note: `The 4 drafts are still in ${MAILBOX} › Drafts.` }) };
  }
  return {
    lines: resultLines('old-drafts-result', {
      title: '4 drafts deleted', badge: ['Deleted', 'success'],
      rows: [{ label: 'Deleted', value: '4 reminder drafts' }, { label: 'Confirmed by', value: reply.confirmation === 'typed' ? 'Typing the words' : 'A click' }],
      note: 'The invoices themselves are untouched.'
    })
  };
}

/** The requests this example scripts, in the order it offers them. */
/** @type {Scenario[]} */
const SCENARIOS = [
  { id: 'october', prompt: 'How did October go?', what: 'Figures, a chart and cited text', icon: 'chart-column', match: /october|how did|month/i, lines: OCTOBER_LINES },
  { id: 'reminders', prompt: 'Chase the overdue invoices', what: 'Rows to pick, sent after a confirmation', icon: 'envelope', match: /overdue|chase|remind/i, lines: REMINDER_LINES, answer: reminderAnswer },
  { id: 'credit', prompt: 'Draft a credit note', what: 'A form with a field that appears when needed', icon: 'receipt', match: /credit/i, lines: CREDIT_NOTE_LINES, answer: creditAnswer },
  { id: 'helios', prompt: 'Tidy up Helios’ record', what: 'Proposed changes to accept or reject', icon: 'building', match: /tidy|helios/i, lines: HELIOS_LINES, answer: heliosAnswer },
  { id: 'dunning', prompt: 'Set up the dunning run', what: 'Questions one at a time, with a review', icon: 'list-check', match: /dunning/i, lines: DUNNING_LINES, answer: dunningAnswer },
  { id: 'trend', prompt: 'Show that as a trend', what: 'A choice, then a new version of the chart', icon: 'arrow-trend-up', match: /trend|line chart/i, lines: TREND_LINES, answer: trendAnswer },
  { id: 'drafts', prompt: 'Delete the old drafts', what: 'A confirmation you have to type', icon: 'trash-can', match: /delete|drafts/i, lines: DRAFTS_LINES, answer: draftsAnswer },
  { id: 'webhook', prompt: 'Give me the webhook snippet', what: 'Code, after the agent corrects itself', icon: 'code', match: /webhook|snippet/i, lines: WEBHOOK_LINES }
];

/** What follows each request in the suggestions, before the ones not asked yet. */
const FOLLOW_UPS = {
  october: ['reminders', 'trend', 'credit'],
  reminders: ['drafts', 'dunning', 'helios'],
  credit: ['helios', 'webhook', 'dunning'],
  helios: ['dunning', 'webhook', 'drafts'],
  dunning: ['drafts', 'webhook', 'trend'],
  trend: ['reminders', 'credit', 'webhook'],
  drafts: ['webhook', 'helios', 'credit'],
  webhook: ['october', 'trend', 'reminders']
};

/**
 * What the application decides each action needs before it replies. Sending mail takes a click
 * in a confirmation; deleting drafts takes the words typed. A surface can't lower either.
 * @param {{tool?: string}} action
 * @returns {import('../../src/components/surface/surface.js').PolicyDecision}
 */
function policy(action) {
  if (action.tool === 'mail.send') return { level: 'confirm', message: `The reminders go out from ${MAILBOX}. Sent mail can’t be recalled.` };
  if (action.tool === 'drafts.delete') return { level: 'type-to-confirm', confirmText: 'delete 4 drafts', message: 'Deleted drafts can’t be restored.' };
  return 'allow';
}

/** The records a surface may name, and how each is drawn. Links are never opened here. */
const RESOLVE = {
  entities: ['company', 'person'],
  /** @param {{$ref: string, id: string}} ref */
  ref(ref) {
    if (ref.$ref === 'company') {
      const found = company(ref.id);
      return found ? { id: found.id, title: found.name, icon: 'building' } : null;
    }
    const found = person(ref.id);
    return found ? { id: found.id, title: found.name, icon: 'user' } : null;
  },
  link: () => false
};

/** The control under every surface in the thread. */
const OPEN_IN_PANEL = { id: 'panel', label: 'Open in panel', icon: 'panel-right' };

/** How long the agent takes: before it answers, between lines, between appended words. */
const PACE = { think: 650, line: 300, append: 160, work: 800 };

/** The keyboard reference the `?` key opens. */
const SHORTCUTS = [
  ['Conversation', [['Write a message', '/'], ['Send', 'Enter'], ['Stop the answer', 'Esc']]],
  ['Artifact panel', [['Previous version', '['], ['Next version', ']'], ['Show or hide the panel', 'Mod+I']]],
  ['View', [['Navigation', 'Mod+B'], ['Keyboard shortcuts', '?']]]
];

/** What the agent says to a request it has no script for. */
const UNKNOWN_REPLY = 'This example scripts eight requests, and that isn’t one of them. Try one of these:';

/**
 * One version of an artifact: the surface that drew it in the thread, and what became of it.
 * @typedef {{artifact: string, item: string, seq: number, title: string, intent: string,
 *   scenario: Scenario|null, written: number, ended: boolean, reply: SurfaceReply|null,
 *   errors: SurfaceError[], retired?: boolean, document?: SurfaceDocument|null}} Version A version
 *   `retired` was replaced in the thread by a newer one under the same item; `document` keeps what
 *   it was.
 * @typedef {import('../../src/components/surface/validate.js').SurfaceDocument} SurfaceDocument
 * @typedef {{cancels: Set<() => void>, flush: (() => void)|null, onstop: () => void}} Activity
 *   What the agent is doing, and how Stop ends it.
 */

/** @param {Date} date @returns {string} The fixtures' timestamp format, to the second. */
function stamp(date) {
  return formatDate(date, '%Y-%m-%dT%H:%M:%S');
}

/** @param {string} value @returns {string} The clock time, "10:28". */
function clockTime(value) {
  return formatDate(new Date(value), DATE.time);
}

export default {
  title: 'Agent canvas',
  category: 'Pattern',
  blurb: 'A scripted agent whose every answer is a surface it composes as JSON — figures and a chart, a review, forms, a questionnaire, a confirmation — with an artifact panel showing each one’s JSON, versions, and the reply it produced.',
  components: [
    'AgentAvatar', 'AgentThread', 'Surface', 'Composer', 'PromptStarters', 'Tabbox', 'SourceList', 'Chart', 'ChartJsAdapter',
    'Table', 'Questionnaire', 'Dialog', 'MenuButton', 'AppSidebar', 'ModuleBar', 'AccountMenu'
  ],

  /**
   * Mounts the conversation: the thread of surfaces with suggestions and a composer under it, and
   * the artifact panel beside it.
   * @param {HTMLElement} container Gallery stage.
   * @param {import('./kit.js').LayoutContext} [context]
   * @returns {void}
   */
  mount(container, context) {
    context = layoutContext(context);
    const keep = disposer(context);
    const { preview } = context;

    /** The conversation's own state; the thread draws its items. */
    const state = {
      seq: 0,
      title: SCENARIOS[0].prompt,
      /** @type {Set<string>} Scenarios asked in this conversation. */
      asked: new Set(),
      /** @type {Activity|null} */
      activity: null,
      /** @type {Scenario|null} The request the agent last answered, for its follow-ups. */
      last: null,
      /** @type {string|null} The reader's message the agent is answering. */
      turn: null
    };
    /** @type {Map<string, Version[]>} Every artifact's versions, by surface id, oldest first. */
    const artifacts = new Map();
    /** What the panel shows: an artifact's version, and whether it follows the newest surface. */
    const view = { artifact: /** @type {string|null} */ (null), index: 0, following: true };
    const mountedAt = performance.now();
    const clock = () => new Date(NOW.getTime() + (preview ? 0 : performance.now() - mountedAt));
    /** @type {AgentThread|null} The thread, once the chart engine has loaded or failed to. */
    let thread = null;
    /** @type {ChartJsAdapter|null} */
    let chartAdapter = null;

    /* --------------------------------------------------------------- navigation -- */

    const artifactList = h('ul', { class: 'canvas__artifacts', role: 'list' });
    const nav = suiteNav(context, {
      module: 'assistant',
      header: button({ label: 'New conversation', icon: 'pen-to-square', onclick: () => newConversation() }),
      content: h('div', { class: 'canvas__index' },
        h('h2', { class: 'canvas__agent' },
          keep(new AgentAvatar(null, { ...AGENT_FACE, name: AGENT.name, size: 'sm' })).toElement(), AGENT.name),
        h('h3', { class: 'list-group' }, 'Artifacts'),
        artifactList)
    });
    const root = h('div', { class: 'canvas shell' }, nav.column);
    const shell = adaptiveShell(root, context, {
      navLabel: 'Show navigation', asideLabel: 'Show the artifact panel', keys: true
    });

    /* ------------------------------------------------------------------- thread -- */

    const more = keep(new MenuButton(iconButton('ellipsis', 'Conversation actions'), {
      kind: 'ghost', placement: 'bottom-end',
      items: [
        { label: 'New conversation', icon: 'pen-to-square', onselect: () => newConversation() },
        { label: 'Keyboard shortcuts', icon: 'keyboard', adornment: kbd('?'), onselect: () => openShortcuts() }
      ]
    }));
    const header = paneHeader({ leading: shell.navToggle(), title: '', actions: [more.toElement(), shell.asideToggle()] });
    const heading = /** @type {HTMLElement} */ (header.querySelector('.shell__title'));
    const scroller = h('div', { class: 'shell__body canvas__thread', role: 'region', 'aria-label': 'Messages', tabindex: '0' });
    const starters = keep(new PromptStarters(null, {
      label: 'Requests this agent knows',
      items: SCENARIOS.map((scenario) => ({ id: scenario.id, title: scenario.prompt, text: scenario.prompt, description: scenario.what, icon: scenario.icon })),
      onpick: ({ detail }) => send(detail.item.text, { focus: true })
    }));
    const welcome = h('div', { class: 'canvas__welcome' },
      keep(new AgentAvatar(null, { ...AGENT_FACE, name: AGENT.name, size: 56 })).toElement(),
      h('h3', { class: 'canvas__welcome-title' }, 'What should the finance agent show you?'),
      h('p', { class: 'canvas__welcome-text' }, AGENT.description),
      starters.toElement());
    const column = h('div', { class: 'canvas__column' }, welcome);
    scroller.append(column);
    const followUps = h('div', { class: 'canvas__follow-ups', role: 'group', 'aria-label': 'Suggested requests' });
    const composer = keep(new Composer(null, {
      placeholder: 'Ask for figures, a chart, a form…',
      note: 'Every answer is a surface. Open one in the panel to see its JSON and its reply.'
    }));
    const main = h('section', { class: 'shell__main canvas__main', 'aria-label': 'Conversation' },
      header, scroller,
      h('div', { class: 'canvas__dock' }, followUps, h('div', { class: 'canvas__composer' }, composer.toElement())));

    /* -------------------------------------------------------------- the panel -- */

    const panelTitle = h('span', {}, 'Artifacts');
    const panelHeader = paneHeader({
      title: panelTitle,
      actions: iconButton('xmark', 'Close the panel', () => shell.toggleInspector())
    });
    const intent = h('span', { class: 'canvas__intent' });
    const versionLabel = h('span', { class: 'canvas__version' });
    const previous = iconButton('chevron-left', 'Previous version', () => stepVersion(-1), { shortcut: { label: '[', keys: '[' } });
    const next = iconButton('chevron-right', 'Next version', () => stepVersion(1), { shortcut: { label: ']', keys: ']' } });
    const versions = h('div', { class: 'shell__toolbar canvas__versions' },
      intent, h('span', { class: 'shell__spacer' }),
      h('div', { class: 'canvas__stepper', role: 'group', 'aria-label': 'Versions' }, previous, versionLabel, next));
    const previewPane = h('div', { class: 'canvas__pane' });
    const jsonPane = h('div', { class: 'canvas__pane' });
    const replyPane = h('div', { class: 'canvas__pane' });
    const tabs = keep(new Tabbox(null, {
      label: 'Artifact views', variant: 'line',
      tabs: [
        { name: 'preview', title: 'Preview', content: previewPane },
        { name: 'json', title: 'JSON', content: jsonPane },
        { name: 'reply', title: 'Reply', content: replyPane }
      ]
    }));
    tabs.toElement().classList.add('shell__tabs', 'canvas__tabs');
    const noArtifact = h('div', { class: 'shell__body canvas__empty' }, emptyState({
      icon: 'layer-group', title: 'No artifact yet', size: 'sm',
      description: 'Every answer the agent gives is a surface. Open one here to see it beside its JSON and the reply it produced.'
    }));
    const aside = h('aside', { class: 'shell__aside canvas__panel', 'aria-label': 'Artifact panel' },
      panelHeader, versions, tabs.toElement(), noArtifact);
    const panelParts = renderScope(context);

    root.append(main, aside);
    const openShortcuts = shortcutSheet(context, SHORTCUTS, { onclose: () => refocus() });

    /* ------------------------------------------------------------------- keys -- */

    shortcuts(root, {
      '/': () => focusComposer(),
      Escape: () => (state.activity ? stop() : false),
      '[': () => stepVersion(-1),
      ']': () => stepVersion(1),
      '?': () => openShortcuts()
    }, context);
    composer.on('send', (event) => {
      event.preventDefault();
      if (send(event.detail.text)) composer.clear();
    });
    composer.on('stop', () => stop());
    more.on('close', () => refocus());
    // Motion that starts in script stops with the reader's preference: a surface still arriving
    // arrives whole.
    watchMotion(root, (reduced) => {
      if (reduced) state.activity?.flush?.();
    }, { signal: context.signal });

    container.append(root);
    render();

    // Charts need their engine before the first surface draws; without it they show their data
    // tables, which is the documented fallback. A thumbnail draws its charts still.
    loadChartJs()
      .then((engine) => new ChartJsAdapter(engine, preview ? { animation: false } : {}), () => null)
      .then((adapter) => {
        if (context.signal.aborted) return;
        chartAdapter = adapter;
        start();
      });

    /* ------------------------------------------------------------------ start -- */

    /** Draws the conversation as it starts: October already answered. @returns {void} */
    function start() {
      thread = keep(new AgentThread(null, {
        authors: AUTHORS,
        label: 'Conversation with the finance agent',
        scroller,
        // The thread keeps the end in view while the agent writes, surfaces streamed into it
        // included; a thumbnail stays at the question.
        followOutput: !preview,
        // Receipts say when a surface was answered on the 24-hour clock the rest of the suite uses.
        locale: 'en-GB',
        answerActions: ['copy'],
        surfaceOptions: { policy, resolve: RESOLVE, chartAdapter },
        now: clock,
        formatTime: clockTime
      }));
      column.append(thread.toElement());
      // A surface's answer comes back to the layout, which hands it to the agent.
      thread.on('reply', (event) => answered(event.detail.item, event.detail.reply));
      thread.on('open', (event) => {
        if (event.detail.ref.id === OPEN_IN_PANEL.id) openInPanel(String(event.detail.item.id));
      });
      // The first request, answered whole before the reader arrives.
      const first = SCENARIOS[0];
      putUser(first.prompt);
      state.asked.add(first.id);
      state.last = first;
      const version = drawSurface(first.lines, first);
      writeAll(version, first.lines);
      settleSurface(version);
      render();
      // The thumbnail shows the question and the top of its answer; the live screen, the end.
      if (!preview) thread.scrollToEnd();
    }

    /* ---------------------------------------------------------------- queries -- */

    /** @returns {Version|null} The version the panel shows. */
    function shown() {
      const list = view.artifact ? artifacts.get(view.artifact) : null;
      return list?.[view.index] ?? null;
    }

    /**
     * @param {string} item Thread item id.
     * @returns {Version|null} The version the item draws now, or the one it drew before.
     */
    function versionOf(item) {
      const all = [...artifacts.values()].flat().filter((version) => version.item === item);
      return all.find((version) => !version.retired) ?? all.at(-1) ?? null;
    }

    /** @param {Version} version @returns {SurfaceDocument|null} The surface as it stands, or stood. */
    function documentOf(version) {
      return version.retired ? version.document ?? null : thread?.surface(version.item)?.toDocument() ?? null;
    }

    /** @returns {Version|null} An asking surface the reader hasn't answered yet. */
    function pending() {
      for (const list of artifacts.values()) {
        const found = list.find((version) => version.ended && !version.reply && !version.retired && version.intent !== 'show');
        if (found) return found;
      }
      return null;
    }

    /** @param {string} kind @returns {string} */
    function nextId(kind) {
      state.seq += 1;
      return `${kind}-${state.seq}`;
    }

    /* -------------------------------------------------------------- rendering -- */

    /** Redraws what follows the conversation's state. @returns {void} */
    function render() {
      const busy = Boolean(state.activity);
      const empty = Boolean(thread) && !thread?.getItems().length;
      heading.textContent = empty ? 'New conversation' : state.title;
      welcome.hidden = !empty;
      composer.setBusy(busy);
      composer.setHint(busy ? 'Writing · Esc stops it' : pending() ? 'The agent waits for your answer above' : '');
      renderFollowUps();
      renderIndex();
      renderPanel();
    }

    /**
     * The suggestions under the thread: what follows the last request, then what hasn't been
     * asked. Hidden while the agent writes, in an empty conversation, which offers starters, and
     * while a question waits for its answer: a suggestion starts another task, and would end a
     * half-filled surface without a word. Writing in the composer still does, on purpose.
     * @returns {void}
     */
    function renderFollowUps() {
      followUps.hidden = Boolean(state.activity) || !thread?.getItems().length || Boolean(pending());
      if (followUps.hidden) return;
      const order = [...(state.last ? FOLLOW_UPS[state.last.id] : []), ...SCENARIOS.map((scenario) => scenario.id)];
      const fresh = [...new Set(order)].filter((id) => !state.asked.has(id));
      const ids = (fresh.length ? fresh : FOLLOW_UPS[state.last?.id ?? 'webhook']).slice(0, 3);
      followUps.replaceChildren(...ids.map((id) => {
        const scenario = /** @type {Scenario} */ (SCENARIOS.find((entry) => entry.id === id));
        return button({ label: scenario.prompt, size: 'sm', icon: scenario.icon, onclick: () => send(scenario.prompt, { focus: true }) });
      }));
    }

    /** The artifacts in the navigation, the one with the newest version first. @returns {void} */
    function renderIndex() {
      const active = document.activeElement;
      const key = active instanceof HTMLElement && artifactList.contains(active) ? active.dataset.artifact : null;
      const order = [...artifacts.entries()].sort(([, a], [, b]) => (b.at(-1)?.seq ?? 0) - (a.at(-1)?.seq ?? 0));
      const rows = order.map(([id, list]) => {
        const latest = /** @type {Version} */ (list.at(-1));
        return h('li', {}, h('button', {
          type: 'button', class: 'list-row canvas__artifact', dataset: { artifact: id },
          'aria-current': view.artifact === id ? 'true' : null,
          onclick: () => pickArtifact(id)
        },
        h('span', { class: 'list-row__title' }, latest.title),
        h('span', { class: 'list-row__meta' }, `${latest.intent} · ${list.length === 1 ? '1 version' : `${list.length} versions`}`)));
      });
      artifactList.replaceChildren(...rows);
      if (!rows.length) artifactList.append(h('li', { class: 'canvas__none' }, 'Answers appear here as the agent gives them.'));
      if (key) /** @type {HTMLElement|null} */ (artifactList.querySelector(`[data-artifact="${CSS.escape(key)}"]`))?.focus({ preventScroll: true });
    }

    /**
     * The panel: the version's title, where it stands among its versions, and the three views.
     * Views are rebuilt only when what they show has changed.
     * @returns {void}
     */
    function renderPanel() {
      const version = shown();
      tabs.toElement().hidden = !version;
      versions.hidden = !version;
      noArtifact.hidden = Boolean(version);
      if (!version) {
        panelTitle.textContent = 'Artifacts';
        delete aside.dataset.drawn;
        panelParts.reset();
        previewPane.replaceChildren();
        jsonPane.replaceChildren();
        replyPane.replaceChildren();
        return;
      }
      const list = /** @type {Version[]} */ (artifacts.get(version.artifact));
      const latest = view.index === list.length - 1;
      panelTitle.textContent = version.title;
      intent.replaceChildren(badge({ label: version.intent, kind: 'accent' }), h('code', { class: 'canvas__surface-id', title: version.artifact }, version.artifact));
      versionLabel.textContent = `v${view.index + 1} of ${list.length}${latest ? ' · Latest' : ''}`;
      previous.setAttribute('aria-disabled', String(view.index === 0));
      next.setAttribute('aria-disabled', String(latest));
      const signature = JSON.stringify([version.seq, version.written, version.ended, Boolean(version.reply), version.errors.length]);
      if (aside.dataset.drawn === signature) return;
      aside.dataset.drawn = signature;
      const focusPane = [previewPane, jsonPane, replyPane].find((pane) => pane.contains(document.activeElement));
      panelParts.reset();
      previewPane.replaceChildren(...previewOf(version));
      jsonPane.replaceChildren(...jsonOf(version));
      replyPane.replaceChildren(...replyOf(version));
      // A control that was redrawn under the focus hands it to its tab panel, never to the page.
      if (focusPane && !preview) /** @type {HTMLElement|null} */ (focusPane.parentElement)?.focus({ preventScroll: true });
    }

    /**
     * Preview: a second, read-only Surface for a `show` surface and for an answered one, drawn as
     * its receipt. A question still open is answered in the conversation only.
     * @param {Version} version
     * @returns {Node[]}
     */
    function previewOf(version) {
      const document = documentOf(version);
      if (!version.ended && !version.reply) {
        return [h('p', { class: 'canvas__note' }, 'Arriving…'), skeletonText({ lines: 4 })];
      }
      if (!document) return [h('p', { class: 'canvas__note' }, 'Stopped before anything arrived.')];
      if (document.intent !== 'show' && !version.reply) {
        return [emptyState({
          icon: 'hourglass-half', title: 'Waiting for your answer in the conversation', size: 'sm',
          description: 'A question is answered in one place only. Once you answer it, its receipt shows here.',
          actions: [{ label: 'Go to the question', onclick: () => revealItem(version.item) }]
        })];
      }
      // The panel's header shows the title, so the copy draws none; it is named apart from the
      // surface in the thread, which is a region of the same title.
      const name = h('span', { class: 'visually-hidden', id: uid('canvas-preview') }, `Preview of ${version.title}`);
      const copy = panelParts.own(new Surface(null, {
        document, reply: version.reply, authors: AUTHORS, resolve: RESOLVE, chartAdapter, labelledBy: name.id, locale: 'en-GB'
      }));
      const parts = [name, copy.toElement()];
      if (document.sources?.length) {
        const sources = panelParts.own(new SourceList(null, {
          label: 'Sources', layout: 'list',
          sources: document.sources.map((source) => ({ id: `source-${source.n}`, title: source.title ?? `Source ${source.n}`, kind: 'record' }))
        }));
        parts.push(sources.toElement());
      }
      return parts;
    }

    /**
     * JSON: the surface as the application validated it, and what it reported to the agent.
     * @param {Version} version
     * @returns {Node[]}
     */
    function jsonOf(version) {
      const document = documentOf(version);
      const parts = [];
      // What the application refused comes first: it is what the agent was sent back.
      if (version.errors.length) {
        parts.push(
          h('h3', { class: 'canvas__subhead' }, `Reported to the agent · ${version.errors.length} ${version.errors.length === 1 ? 'problem' : 'problems'}`),
          h('ul', { class: 'canvas__problems' }, version.errors.map((error) => h('li', {},
            h('span', { class: 'canvas__problem-code' }, `${error.code}${error.path ? ` ${error.path}` : ''}`),
            h('span', {}, error.message)))));
      }
      parts.push(
        h('p', { class: 'canvas__note' }, version.ended ? 'The surface as the application validated it, from toDocument().'
          : version.reply ? 'Stopped before its end: what had arrived, as validated.' : 'The surface as validated so far. It is still arriving.'),
        code(JSON.stringify(document, null, 2)));
      return parts;
    }

    /**
     * Reply: the `reply/1` object and its plain-text receipt, or why there is none.
     * @param {Version} version
     * @returns {Node[]}
     */
    function replyOf(version) {
      const reply = version.reply;
      if (!reply) {
        return [emptyState({
          icon: 'reply', title: 'No reply yet', size: 'sm',
          description: version.intent === 'show'
            ? 'A show surface replies only when it is closed.'
            : 'The surface waits for your answer in the conversation.'
        })];
      }
      const document = documentOf(version);
      return [
        h('h3', { class: 'canvas__subhead' }, 'reply/1'),
        code(JSON.stringify(reply, null, 2)),
        h('h3', { class: 'canvas__subhead' }, 'As text, from surfaceText()'),
        h('pre', { class: 'canvas__text' }, document ? surfaceText(document, reply) : reply.action)
      ];
    }

    /**
     * JSON as a copyable code block whose long lines wrap under their own indent, so the panel
     * never scrolls sideways.
     * @param {string} text
     * @returns {HTMLElement}
     */
    function code(text) {
      return panelParts.own(new BlockView(null, { blocks: [{ type: 'code', language: 'json', code: text, lines: true }] })).toElement();
    }

    /* ------------------------------------------------------------- the panel -- */

    /**
     * Shows a version in the panel.
     * @param {string} artifact
     * @param {number} index
     * @param {{pick?: boolean}} [options] `pick`: the reader chose it, so the panel stops following.
     * @returns {void}
     */
    function showArtifact(artifact, index, { pick = false } = {}) {
      const list = artifacts.get(artifact);
      if (!list) return;
      view.artifact = artifact;
      view.index = Math.max(0, Math.min(list.length - 1, index));
      if (pick) view.following = false;
      renderIndex();
      renderPanel();
    }

    /** `[` and `]`: the previous or next version of the artifact shown. @param {-1|1} step @returns {void} */
    function stepVersion(step) {
      const list = view.artifact ? artifacts.get(view.artifact) : null;
      if (!list || preview) return;
      const index = view.index + step;
      if (index < 0 || index >= list.length) return;
      showArtifact(view.artifact, index, { pick: true });
      thread?.announce(versionLabel.textContent ?? '');
    }

    /**
     * "Open in panel" under a surface: its version, and the panel brought into view.
     * @param {string} item
     * @returns {void}
     */
    function openInPanel(item) {
      const version = versionOf(item);
      if (!version || preview) return;
      const list = /** @type {Version[]} */ (artifacts.get(version.artifact));
      showArtifact(version.artifact, list.indexOf(version), { pick: true });
      revealPanel(version);
    }

    /**
     * An artifact chosen in the navigation: its newest version, and the panel brought into view as
     * "Open in panel" brings it.
     * @param {string} artifact
     * @returns {void}
     */
    function pickArtifact(artifact) {
      const list = artifacts.get(artifact);
      if (!list) return;
      showArtifact(artifact, list.length - 1, { pick: true });
      if (!preview) revealPanel(/** @type {Version} */ (list.at(-1)));
    }

    /**
     * Brings the panel into view the way the width allows. A panel closed at full width comes back
     * and focus stays where the reader chose, so the change is announced; below 1180px its drawer
     * opens and takes focus, the navigation's drawer closing first so that closing the panel
     * returns focus to the conversation's header rather than to a hidden list.
     * @param {Version} version What the panel now shows.
     * @returns {void}
     */
    function revealPanel(version) {
      if (!aside.checkVisibility() && root.dataset.asideCollapsed === 'true') shell.collapse('aside', false);
      if (aside.checkVisibility()) {
        thread?.announce(`${version.title} is open in the panel.`);
        return;
      }
      shell.closeNav();
      shell.toggleAside(true);
    }

    /* --------------------------------------------------------- the conversation -- */

    /** @param {string} text @returns {string} The message's item id. */
    function putUser(text) {
      const id = nextId('user');
      thread?.upsert({ id, type: 'user', at: stamp(clock()), text });
      state.turn = id;
      return id;
    }

    /**
     * Adds a surface item to the thread, to be written into, and records it as the newest version
     * of its artifact. The panel follows it unless the reader picked another.
     * A `replace`d version gives up its place in the thread: the item takes a new token, so the
     * thread supersedes the surface it drew — which replies once, as every surface does — and the
     * old version keeps its document for the panel.
     * @param {Op[]} lines
     * @param {Scenario|null} scenario The request whose answer handles its reply.
     * @param {{replace?: Version}} [options]
     * @returns {Version}
     */
    function drawSurface(lines, scenario, { replace } = {}) {
      const head = lines[0];
      const item = replace?.item ?? nextId('surface');
      if (replace) {
        replace.document = thread?.surface(replace.item)?.toDocument() ?? null;
        replace.retired = true;
      }
      thread?.upsert({
        id: item, type: 'surface', author: 'finance', at: stamp(clock()), refs: [OPEN_IN_PANEL],
        token: replace ? nextId(String(head.surface)) : null
      });
      /** @type {Version} */
      const version = {
        artifact: String(head.surface), item, seq: state.seq, title: String(head.title ?? head.surface), intent: String(head.intent),
        scenario, written: 0, ended: false, reply: null, errors: []
      };
      const list = artifacts.get(version.artifact) ?? [];
      list.push(version);
      artifacts.set(version.artifact, list);
      thread?.surface(item)?.on('error', () => {
        version.errors = thread?.surface(item)?.getErrors() ?? [];
      });
      if (view.following || !view.artifact) {
        view.artifact = version.artifact;
        view.index = list.length - 1;
      }
      return version;
    }

    /** @param {Version} version @param {Op[]} lines Writes every line at once. @returns {void} */
    function writeAll(version, lines) {
      thread?.surface(version.item)?.write(lines.map((line) => `${JSON.stringify(line)}\n`).join(''));
    }

    /** A surface has all its lines: what it reported is final. @param {Version} version @returns {void} */
    function settleSurface(version) {
      const surface = thread?.surface(version.item);
      version.ended = true;
      version.errors = surface?.getErrors() ?? [];
    }

    /**
     * Streams a surface into the thread a line at a time, then calls `done`. Appended text comes
     * faster than whole nodes. Under reduced motion the surface arrives whole.
     * @param {Activity} own
     * @param {Op[]} lines
     * @param {Scenario|null} scenario
     * @param {(version: Version) => void} done
     * @param {{replace?: Version}} [options] A version the new one takes the place of.
     * @returns {void}
     */
    function stream(own, lines, scenario, done, options = {}) {
      const version = drawSurface(lines, scenario, options);
      render();
      let index = 0;
      let finished = false;
      /** @type {(() => void)|null} Cancels the step or finish this stream waits to run. */
      let queued = null;
      /** @param {number} ms @param {() => void} fn */
      const queue = (ms, fn) => {
        queued = wait(own, ms, () => {
          queued = null;
          fn();
        });
      };
      const write = (chunk) => {
        thread?.surface(version.item)?.write(chunk);
        version.written += 1;
        renderPanel();
      };
      // Runs once per stream, however it ends — the last line, or a flush when the reader asks for
      // less motion — and takes the step still waiting with it: `done` may go on with the same
      // activity (the webhook's correction does), where a stray step would write past the end and
      // finish a second time.
      const finish = () => {
        if (finished || state.activity !== own) return;
        finished = true;
        queued?.();
        queued = null;
        if (own.flush === finish) own.flush = null;
        if (index < lines.length) write(lines.slice(index).map((line) => `${JSON.stringify(line)}\n`).join(''));
        index = lines.length;
        settleSurface(version);
        renderPanel();
        done(version);
      };
      own.flush = finish;
      // Stop cancels the surface where it stands: it replies, and its receipt says so.
      own.onstop = () => thread?.surface(version.item)?.cancel('stopped');
      if (prefersReducedMotion(root)) {
        queue(PACE.line, finish);
        return;
      }
      const step = () => {
        if (finished || index >= lines.length) return;
        write(`${JSON.stringify(lines[index])}\n`);
        index += 1;
        if (index >= lines.length) finish();
        else queue(lines[index].op === 'append' ? PACE.append : PACE.line, step);
      };
      queue(PACE.line, step);
    }

    /**
     * Starts something the agent does; Stop ends it.
     * @param {() => void} [onstop] What Stop leaves behind.
     * @returns {Activity}
     */
    function begin(onstop = () => {}) {
      endActivity();
      /** @type {Activity} */
      const own = { cancels: new Set(), flush: null, onstop };
      state.activity = own;
      render();
      return own;
    }

    /**
     * @param {Activity} own
     * @param {number} ms
     * @param {() => void} fn Runs after `ms` unless the activity has ended by then.
     * @returns {() => void} Cancels it.
     */
    function wait(own, ms, fn) {
      const cancel = later(context, () => {
        own.cancels.delete(cancel);
        if (state.activity === own) fn();
      }, ms);
      own.cancels.add(cancel);
      return () => {
        own.cancels.delete(cancel);
        cancel();
      };
    }

    /** Ends what the agent does, normally. @returns {void} */
    function endActivity() {
      const own = state.activity;
      if (!own) return;
      for (const cancel of own.cancels) cancel();
      state.activity = null;
    }

    /** The agent's turn is over: the suggestions and the panel catch up. @returns {void} */
    function endTurn() {
      endActivity();
      render();
    }

    /** Esc or Stop: ends what the agent is doing, keeping what it already wrote. @returns {void} */
    function stop() {
      const own = state.activity;
      if (!own) return;
      endActivity();
      own.onstop();
      render();
      thread?.announce('Stopped.');
    }

    /**
     * Sends a message. A scripted request is answered with its surface; anything else with one
     * plain reply naming the requests the example knows. An open question is superseded first:
     * every surface ends in exactly one reply.
     * @param {string} text
     * @param {{focus?: boolean}} [options] `focus`: a suggestion was pressed, and has gone.
     * @returns {boolean} Whether it was sent.
     */
    function send(text, { focus = false } = {}) {
      const message = String(text ?? '').trim();
      if (!thread || preview || state.activity) return false;
      if (!message) {
        focusComposer();
        return false;
      }
      const open = pending();
      if (open) thread.surface(open.item)?.supersede();
      if (!thread.getItems().length) state.title = message.length > 44 ? `${message.slice(0, 43).trimEnd()}…` : message;
      putUser(message);
      // What the reader sends is what they look at next, wherever they had scrolled to.
      thread.scrollToEnd();
      view.following = true;
      const scenario = SCENARIOS.find((entry) => entry.match.test(message)) ?? null;
      const own = begin();
      if (focus) scroller.focus({ preventScroll: true });
      if (!scenario) {
        wait(own, PACE.think, () => {
          thread?.upsert({
            id: nextId('answer'), type: 'answer', author: 'finance', at: stamp(clock()),
            blocks: [{ type: 'p', text: UNKNOWN_REPLY }, { type: 'list', ordered: false, items: SCENARIOS.map((entry) => entry.prompt) }]
          });
          endTurn();
        });
        return true;
      }
      state.asked.add(scenario.id);
      state.last = scenario;
      wait(own, PACE.think, () => stream(own, scenario.lines, scenario, (version) => {
        if (scenario.id === 'webhook') correct(own, version);
        else endTurn();
      }));
      return true;
    }

    /**
     * 8 · The application refused part of the webhook surface. The agent reads the report — a
     * failed call in its trace, the problems as it received them — and sends the surface again,
     * which takes the first one's place; the panel keeps both as versions.
     * @param {Activity} own
     * @param {Version} attempt
     * @returns {void}
     */
    function correct(own, attempt) {
      const traceId = nextId('trace');
      const failed = {
        id: nextId('call'), kind: 'call', tool: 'show_surface', status: 'failed', label: 'Showed the webhook snippet',
        count: `${attempt.errors.length} ${attempt.errors.length === 1 ? 'problem' : 'problems'}`,
        error: JSON.stringify({ errors: attempt.errors }, null, 2)
      };
      const retry = {
        id: nextId('call'), kind: 'call', tool: 'show_surface', retryOf: failed.id, status: 'running',
        label: 'Showed the corrected snippet', doing: 'Correcting the surface'
      };
      // The report goes above the surface it is about, which the corrected one then replaces.
      thread?.upsert({ id: traceId, type: 'trace', author: 'finance', at: stamp(clock()), open: true, steps: [failed, retry] }, { after: state.turn });
      const stopped = () => thread?.patch(traceId, { steps: [failed, { ...retry, status: 'stopped', label: 'Correction stopped' }] });
      own.onstop = stopped;
      wait(own, PACE.work, () => {
        stream(own, WEBHOOK_FIXED_LINES, null, (version) => {
          const fixed = version.errors.length
            ? { ...retry, status: 'failed', count: `${version.errors.length} problems` }
            : { ...retry, status: 'done', count: 'no problems' };
          thread?.patch(traceId, { steps: [failed, fixed] });
          endTurn();
        }, { replace: attempt });
        // Stopped while the corrected surface arrives, both the surface and the call say so.
        const cancel = own.onstop;
        own.onstop = () => {
          cancel();
          stopped();
        };
      });
    }

    /**
     * A surface replied. Answered, the agent works on the values and closes the request with a
     * short surface of its own; stopped, superseded or destroyed, it was no answer.
     * @param {any} item
     * @param {SurfaceReply} reply
     * @returns {void}
     */
    function answered(item, reply) {
      if (preview || context.signal.aborted) return;
      const version = versionOf(String(item.id));
      if (!version || version.reply) return;
      version.reply = structuredClone(reply);
      render();
      const scenario = version.scenario;
      if (!scenario?.answer || ['stopped', 'superseded', 'destroyed'].includes(String(reply.reason ?? ''))) return;
      const answer = scenario.answer(reply);
      if (!answer) return;
      const own = begin();
      // The answer is what the reader looks at next: the thread follows it again.
      thread?.scrollToEnd();
      thread?.announce('Answered. The agent is working on it.');
      wait(own, PACE.work, () => {
        if (answer.lines) {
          stream(own, answer.lines, null, () => endTurn());
          return;
        }
        thread?.upsert({ id: nextId('text'), type: 'text', author: 'finance', at: stamp(clock()), text: answer.text ?? '' });
        endTurn();
      });
    }

    /** Starts an empty conversation, which offers the requests as starters. @returns {void} */
    function newConversation() {
      if (preview || !thread) return;
      const own = state.activity;
      endActivity();
      own?.onstop();
      thread.setItems([]);
      artifacts.clear();
      Object.assign(view, { artifact: null, index: 0, following: true });
      Object.assign(state, { title: 'New conversation', last: null });
      state.asked.clear();
      render();
      scroller.scrollTop = 0;
      if (root.dataset.navOpen === 'true') shell.closeNav();
      focusComposer();
    }

    /* ------------------------------------------------------------------ focus -- */

    /** /: puts the cursor in the composer. @returns {void} */
    function focusComposer() {
      if (!preview) composer.focus();
    }

    /** "Go to the question": closes the panel's drawer and moves to the surface. @param {string} item @returns {void} */
    function revealItem(item) {
      if (preview) return;
      if (root.dataset.asideOpen === 'true') shell.toggleAside(false);
      const surface = thread?.surface(item);
      surface?.toElement().scrollIntoView({ block: 'nearest' });
      surface?.focus();
    }

    /**
     * Shortcuts listen on this layout, so focus never stays on the page body when a menu or dialog
     * closes over a control that is gone: it goes to the conversation.
     * @returns {void}
     */
    function refocus() {
      later(context, () => {
        const active = document.activeElement;
        if (active && active !== document.body && active.isConnected && root.contains(active)) return;
        scroller.focus({ preventScroll: true });
      }, 0);
    }
  }
};
