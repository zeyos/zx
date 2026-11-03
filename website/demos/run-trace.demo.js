import { RunTrace, button, h } from '../../src/index.js';

// Who took the steps: the keys each step's `actor` and a hand-off's `to` name.
const AUTHORS = {
  finance: { name: 'Finance agent', kind: 'agent', tone: 'violet' },
  collections: { name: 'Collections agent', kind: 'agent', tone: 'teal' }
};

// What the invoice query returned: long enough to be cut, with a button for the rest.
function overdueInvoices() {
  const customers = ['Harbor Logistics GmbH', 'Nordlicht Bakery', 'Kessler & Partner', 'Alpine Rentals',
    'Greenfield Studio', 'Mosaik Interiors', 'Lindqvist Freight'];
  return JSON.stringify(customers.map((customer, index) => ({
    invoice: `RE-01${21 + index}`,
    customer,
    amount: Number((480 + index * 365.5).toFixed(2)),
    currency: 'EUR',
    dueDate: `2026-09-${String(10 + index).padStart(2, '0')}`,
    reminders: index % 3
  })), null, 2);
}

// A finished dunning run: what it searched, read, and queried, one call that failed and the retry
// that worked, the bank feed it matched, and the hand-off to the agent that writes the reminders.
function dunningRun() {
  return [
    { id: 'notes', kind: 'search', label: 'Searched customer notes', detail: 'Matched "payment plan" and "dispute" in 9 notes.', ms: 1_400, sources: 9, actor: 'finance' },
    { id: 'policy', kind: 'read', label: 'Read the dunning policy', count: '4 pages', ms: 2_100, actor: 'finance' },
    {
      id: 'invoices', kind: 'query', label: 'Queried overdue invoices', status: 'failed', tool: 'invoices.query',
      args: '{"status":"overdue","olderThanDays":30}', error: 'The ledger did not answer within 10 s.', ms: 10_000, actor: 'finance'
    },
    {
      id: 'invoices-2', kind: 'query', label: 'Queried overdue invoices', retryOf: 'invoices', tool: 'invoices.query',
      args: '{"status":"overdue","olderThanDays":30,"limit":50}', result: overdueInvoices(), count: '7 invoices', ms: 1_800, actor: 'finance'
    },
    {
      id: 'bank', kind: 'call', label: 'Matched the bank feed', tool: 'bank.match',
      args: '{"account":"OPS-01","from":"2026-10-01"}', result: '{"matched":5,"unmatched":["RE-0124","RE-0127"]}', count: '2 unmatched', ms: 3_200, actor: 'finance'
    },
    { id: 'handoff', kind: 'handoff', label: 'Passed on 5 overdue invoices', actor: 'finance', to: 'collections', detail: 'Two customers have a payment plan, so their reminders wait.' },
    { id: 'plan', kind: 'think', label: 'Planned the reminders', ms: 21_000, actor: 'collections' },
    { id: 'draft', kind: 'write', label: 'Drafted 5 reminders', ms: 2_700, actor: 'collections' }
  ];
}

// The people and agents in the plan below. A person's avatar is round, an agent's a rounded square.
const TEAM = {
  hanna: { name: 'Hanna Weber', kind: 'person', tone: 'amber' },
  finance: { name: 'Finance agent', kind: 'agent', tone: 'violet' },
  collections: { name: 'Collections agent', kind: 'agent', tone: 'teal' }
};

// The demo's world is fixed on 14 October 2026: its clock starts at 10:30:59 and runs in real time.
const WORLD_NOW = new Date('2026-10-14T10:30:59');

// A plan: what Hanna asked for, the tasks the agents set themselves, the hand-offs between them and
// to her, her decision on the way, and links (refs) to the records and files each task touched.
// One task is running, two wait their turn.
function closePlan() {
  return [
    { id: 'ask', kind: 'ask', label: 'Close September and chase what is overdue', actor: 'hanna', at: '2026-10-14T09:58:12' },
    {
      id: 'bank', kind: 'task', label: 'Match the bank feed', count: '58 of 60 matched', actor: 'finance',
      at: '2026-10-14T10:02:40', ms: 48_000, tokens: 1_240,
      refs: [{ id: 'OPS-01', label: 'Account OPS-01', icon: 'table', entity: 'account' }]
    },
    {
      id: 'overdue', kind: 'task', label: 'Collect the overdue invoices', count: '7 invoices', actor: 'finance',
      at: '2026-10-14T10:03:31', ms: 12_400, tokens: 912,
      detail: 'Two customers have a payment plan; their invoices stay out of this round.',
      refs: [{ id: 'overdue-september.csv', label: 'overdue-september.csv', icon: 'file', entity: 'file' }]
    },
    { id: 'pass', kind: 'handoff', label: 'Passed on 5 invoices', actor: 'finance', to: 'collections', at: '2026-10-14T10:04:02' },
    { id: 'approval', kind: 'handoff', label: 'Asked to approve the wording', actor: 'collections', to: 'hanna', at: '2026-10-14T10:05:10', tokens: 640 },
    { id: 'wording', kind: 'decision', label: 'Approved the reminder wording', actor: 'hanna', at: '2026-10-14T10:29:47' },
    {
      id: 'send', kind: 'task', label: 'Send 5 reminders', doing: 'Sending 5 reminders', status: 'running', actor: 'collections',
      at: '2026-10-14T10:30:18',
      refs: [{ id: 'reminders', label: 'Reminder drafts', icon: 'mail', entity: 'document' }]
    },
    { id: 'fees', kind: 'task', label: 'Book the late fees', status: 'queued', actor: 'collections' },
    { id: 'report', kind: 'task', label: 'Report to Hanna', status: 'queued', actor: 'finance' }
  ];
}

// A run as it happens: each step arrives running, with the line it shows meanwhile, and is
// upserted again under the same id once it is done.
function liveRun() {
  return [
    { id: 'live-1', kind: 'search', label: 'Searched the bank feed', doing: 'Searching the bank feed', ms: 1_100, sources: 3 },
    { id: 'live-2', kind: 'query', label: 'Read invoice RE-0121', doing: 'Reading invoice RE-0121', tool: 'invoices.get', args: '{"id":"RE-0121"}', result: '{"amount":4860,"currency":"EUR","status":"open"}', ms: 600 },
    { id: 'live-3', kind: 'write', label: 'Booked the payment', doing: 'Booking the payment', ms: 900 }
  ];
}

export default {
  title: 'Run trace',
  group: 'Agents',
  api: ['RunTrace'],
  blurb: 'What an agent did during a run: a one-line summary that opens into a timeline of its '
    + 'steps, each tool call opening to its arguments and result.',

  examples: [
    {
      title: 'A finished run',
      blurb: 'The summary counts tool calls, sources, and retries. A failed call and its retry stay '
        + 'together, a hand-off shows both agents, and a result longer than maxResult is cut with '
        + 'a Show all button. reveal(id) opens the trace at one step and puts focus on it.',
      layout: 'stack',
      width: '640px',
      render: ({ cleanup, log }) => {
        const trace = new RunTrace(null, { steps: dunningRun(), authors: AUTHORS, maxResult: 600 });
        trace.on('toggle', ({ detail }) => log(`toggle ${detail.id ?? 'summary'} → ${detail.open ? 'open' : 'closed'}`));
        trace.on('reveal', ({ detail }) => log(`reveal ${detail.id}`));
        cleanup(() => trace.destroy());
        return [
          trace.toElement(),
          h('div', { class: 'demo-row' },
            button({ label: 'Reveal the retry', onclick: () => trace.reveal('invoices-2') }),
            button({ label: 'Collapse', onclick: () => trace.collapse() }))
        ];
      }
    },
    {
      title: 'A live run',
      blurb: 'The application upserts each step as it starts and again as it ends; only that step '
        + 'is redrawn. While a step runs the summary reads Working… with what it is doing, and the '
        + 'step carries aria-current="step".',
      layout: 'stack',
      width: '640px',
      render: ({ cleanup, log }) => {
        const script = liveRun();
        let index = 0;
        let running = false;
        const trace = new RunTrace(null, { open: true });
        cleanup(() => trace.destroy());
        const next = () => {
          if (index >= script.length) {
            index = 0;
            trace.setSteps([]);
            log('reset');
            return;
          }
          const step = script[index];
          trace.upsert(running ? step : { ...step, status: 'running' });
          log(`${step.id} → ${running ? 'done' : 'running'}`);
          if (running) index += 1;
          running = !running;
        };
        next();
        return [trace.toElement(), h('div', { class: 'demo-row' }, button({ label: 'Next', kind: 'primary', onclick: next }))];
      }
    },
    {
      title: 'A plan',
      blurb: 'Task steps under a label of the plan\'s own, with the asks and decisions of the people '
        + 'in it. Each row names who took the step, when, and the tokens it used; its links (refs) '
        + 'emit open, and selectable makes every row a button that emits select. With ticking the '
        + 'running task counts its time against the now() clock; a blocked task turns the summary '
        + 'to Blocked.',
      layout: 'stack',
      width: '640px',
      render: ({ cleanup, log }) => {
        const opened = Date.now();
        const steps = closePlan();
        const trace = new RunTrace(null, {
          steps,
          authors: TEAM,
          label: 'Close September · 2 of 5 tasks done',
          open: true,
          selectable: true,
          ticking: true,
          now: () => new Date(WORLD_NOW.getTime() + (Date.now() - opened))
        });
        trace.on('select', ({ detail }) => log(`select ${detail.id}`));
        trace.on('open', ({ detail }) => log(`open ${detail.ref.entity} ${detail.ref.id} (from ${detail.step.id})`));
        cleanup(() => trace.destroy());
        const sending = steps.find((step) => step.id === 'send');
        return [
          trace.toElement(),
          h('div', { class: 'demo-row' },
            button({
              label: 'Block the reminders',
              onclick: () => trace.upsert({ ...sending, status: 'blocked', detail: 'The mail server refused the connection.' })
            }),
            button({ label: 'Resume', onclick: () => trace.upsert(sending) }),
            button({
              label: 'Finish the task',
              onclick: () => {
                trace.upsert({ ...sending, status: 'done', ms: 52_000, tokens: 2_310 });
                trace.setLabel('Close September · 3 of 5 tasks done');
              }
            }))
        ];
      }
    }
  ]
};
