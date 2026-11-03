import { AgentThread, button, h, prefersReducedMotion } from '../../src/index.js';

// Who takes part: the person reading (`me`) and the agent. An agent's `via` names the model it
// answers through.
const AUTHORS = {
  me: { name: 'Hanna Weber', kind: 'person' },
  finance: { name: 'Finance agent', kind: 'agent', tone: 'violet', via: 'Large, EU-hosted', activity: 'needs-you' }
};

// A conversation is plain JSON — the same items an agent run produces and an application stores.
function reconcileConversation() {
  return [
    { id: 'ask', type: 'user', at: '2026-10-08T10:27', text: 'Reconcile last month’s open invoices and draft reminders for anything overdue.', files: [{ name: 'Dunning policy 2026.pdf', size: 188_416 }] },
    { id: 'intro', type: 'text', author: 'finance', at: '2026-10-08T10:27', text: 'I’ll check September against the bank feed and the customer notes, then draft reminders. Nothing goes out without your approval.' },
    { id: 'work', type: 'trace', author: 'finance', steps: [
      { id: 'policy', kind: 'read', label: 'Read Dunning policy 2026.pdf', count: '4 pages', ms: 600, tool: 'files.read', args: '{"file": "Dunning policy 2026.pdf"}', result: 'First reminder 14 days after the due date.' },
      { id: 'invoices', kind: 'query', label: 'Queried invoices', count: '42 rows', ms: 800, tool: 'invoices.search', args: '{"issued": "2026-09-01..2026-09-30"}', result: '42 invoices, 13 open' },
      { id: 'bank-1', kind: 'call', label: 'Fetched bank payments', status: 'failed', count: 'timed out', ms: 10_000, tool: 'bank.transactions', error: 'The bank feed did not answer within 10 s.' },
      { id: 'bank-2', kind: 'call', label: 'Fetched bank payments', retryOf: 'bank-1', count: '57 transactions', ms: 2100, tool: 'bank.transactions', result: '31 match a September invoice' }
    ] },
    { id: 'answer', type: 'answer', author: 'finance', at: '2026-10-08T10:28', blocks: [
      { type: 'p', text: 'September has 42 invoices. Two that still look open were paid on 30 September but aren’t booked yet [1][2].' },
      { type: 'figures', rows: [['More than 14 days late', '3 invoices', '€19,375.50'], ['Paid, not booked', '2 invoices', '€8,240.00']] }
    ], sources: [
      { id: 'inv', title: 'Invoices · September 2026', kind: 'call', site: 'Invoices', call: 'invoices' },
      { id: 'bank', title: 'Bank payments · 1 Sep – 7 Oct', kind: 'call', site: 'Bank feed', call: 'bank-2' }
    ] },
    { id: 'approval', type: 'approval', author: 'finance', at: '2026-10-08T10:28', title: 'Send 3 reminder emails?', status: 'pending',
      description: 'Sent mail can’t be recalled.',
      details: [{ type: 'list', items: ['Helios Energie · RE-2026-0121 · €4,860.00', 'Bruckner Logistik · RE-2026-0126 · €12,340.00', 'Northstar Freight · RE-2026-0129 · €2,175.50'] }],
      preview: { label: 'Show the email', blocks: [{ type: 'quote', text: 'Dear Ms Albers,\n\nOur invoice RE-2026-0121 for €4,860.00 was due on 15 September …' }] } }
  ];
}

// What the agent writes when it is asked again, streamed in chunks.
const FOLLOW_UP = 'Bruckner Logistik has paid late **9 times out of 14** this year [1], so I would '
  + 'send their reminder today.\n\nThe other two usually pay within a week of a first reminder.';

export default {
  title: 'Agent thread',
  group: 'Agents',
  api: ['AgentThread'],
  blurb: 'A conversation with agents: messages, streamed answers, the steps a run took, and the approvals that hold it.',
  examples: [
    {
      title: 'A run that waits for approval',
      blurb: 'A citation highlights its source; a source opens the tool call it came from. A, E, and '
        + 'R answer the approval while it has focus. PageDown and PageUp move between items.',
      layout: 'stack',
      width: '720px',
      render: ({ cleanup, log }) => {
        const thread = new AgentThread(null, {
          items: reconcileConversation(),
          authors: AUTHORS,
          answerActions: ['copy', 'regenerate', 'branch', 'rate'],
          onaction: ({ detail }) => log(`${detail.action}${detail.value != null ? ` ${detail.value}` : ''}`),
          onapprove: () => log('approved'),
          onreject: ({ detail }) => log(`rejected: ${detail.reason || 'no reason'}`),
          oncite: ({ detail }) => log(`cite ${detail.n}`)
        });
        cleanup(() => thread.destroy());
        return h('div', { class: 'demo-card', style: { maxBlockSize: '36rem', overflowY: 'auto' } }, thread.toElement());
      }
    },
    {
      title: 'Streaming an answer',
      blurb: 'The application feeds the thread: upsert() adds items, appendText() streams into an '
        + 'answer, and patch() finishes it. The end stays in view while you read the end; scroll up '
        + 'and "Jump to latest" appears instead.',
      layout: 'stack',
      width: '720px',
      render: ({ cleanup, log }) => {
        const thread = new AgentThread(null, { authors: AUTHORS });
        let timer = 0;
        let turn = 0;
        const ask = () => {
          clearTimeout(timer);
          turn += 1;
          const answer = `reply-${turn}`;
          thread.upsert({ id: `ask-${turn}`, type: 'user', text: 'Which reminder should go out first?' });
          thread.upsert({ id: answer, type: 'answer', author: 'finance', blocks: [], streaming: true, sources: [
            { id: 'paid', title: 'Paid invoices · January to September', kind: 'record', site: 'Invoices' }
          ] });
          const finish = () => {
            thread.patch(answer, { streaming: false });
            log('answered');
          };
          if (prefersReducedMotion(thread.toElement())) {
            thread.appendText(answer, FOLLOW_UP);
            finish();
            return;
          }
          let index = 0;
          const tick = () => {
            thread.appendText(answer, FOLLOW_UP.slice(index, index + 5));
            index += 5;
            if (index < FOLLOW_UP.length) timer = window.setTimeout(tick, 35);
            else finish();
          };
          tick();
        };
        cleanup(() => {
          clearTimeout(timer);
          thread.destroy();
        });
        return [
          h('div', { class: 'demo-card', style: { maxBlockSize: '24rem', overflowY: 'auto' } }, thread.toElement()),
          h('div', { class: 'demo-row' }, button({ label: 'Ask the agent', kind: 'primary', onclick: ask }))
        ];
      }
    }
  ]
};
