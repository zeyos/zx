import {
  AgentThread, RunStatus, button, connectAgUi, formatCurrency, h, prefersReducedMotion, renderBlocks, skeletonText
} from '../../src/index.js';

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

// Three recorded AG-UI 1.0 runs, as an application receives them parsed from its event stream.
// A plain answer after two tool calls, with reasoning and state updates.
function plainRun() {
  return [
    { type: 'RUN_STARTED', threadId: 'thread_7f3a2c', runId: 'run_a1', protocolVersion: '1.0', timestamp: 1793698200140 },
    { type: 'STATE_SNAPSHOT', snapshot: { customer: null, lookups: 0 }, timestamp: 1793698200280 },
    { type: 'REASONING_START', messageId: 'rs_a1', timestamp: 1793698200420 },
    { type: 'REASONING_MESSAGE_START', messageId: 'rm_a1', role: 'reasoning', timestamp: 1793698200560 },
    { type: 'REASONING_MESSAGE_CONTENT', messageId: 'rm_a1', delta: "The user wants Helios Energie's open balance. ", timestamp: 1793698200700 },
    { type: 'REASONING_MESSAGE_CONTENT', messageId: 'rm_a1', delta: 'Look up the company, then list its unpaid invoices.', timestamp: 1793698200840 },
    { type: 'REASONING_MESSAGE_END', messageId: 'rm_a1', timestamp: 1793698200980 },
    { type: 'REASONING_END', messageId: 'rs_a1', timestamp: 1793698201120 },
    { type: 'STEP_STARTED', stepName: 'lookup', timestamp: 1793698201260 },
    { type: 'TOOL_CALL_START', toolCallId: 'call_a1', toolCallName: 'find_company', parentMessageId: 'msg_a1', timestamp: 1793698201400 },
    { type: 'TOOL_CALL_ARGS', toolCallId: 'call_a1', delta: '{"query":"He', timestamp: 1793698201540 },
    { type: 'TOOL_CALL_ARGS', toolCallId: 'call_a1', delta: 'lios Energie', timestamp: 1793698201680 },
    { type: 'TOOL_CALL_ARGS', toolCallId: 'call_a1', delta: '"}', timestamp: 1793698201820 },
    { type: 'TOOL_CALL_END', toolCallId: 'call_a1', timestamp: 1793698201960 },
    { type: 'TOOL_CALL_RESULT', messageId: 'tool_a1', toolCallId: 'call_a1', role: 'tool', content: '{"id":"helios","name":"Helios Energie","city":"Lyon","country":"France"}', timestamp: 1793698202100 },
    { type: 'STATE_DELTA', delta: [{ op: 'replace', path: '/customer', value: 'helios' }, { op: 'replace', path: '/lookups', value: 1 }], timestamp: 1793698202240 },
    { type: 'TOOL_CALL_START', toolCallId: 'call_a2', toolCallName: 'list_invoices', parentMessageId: 'msg_a1', timestamp: 1793698202380 },
    { type: 'TOOL_CALL_ARGS', toolCallId: 'call_a2', delta: '{"company":"he', timestamp: 1793698202520 },
    { type: 'TOOL_CALL_ARGS', toolCallId: 'call_a2', delta: 'lios","status"', timestamp: 1793698202660 },
    { type: 'TOOL_CALL_ARGS', toolCallId: 'call_a2', delta: ':"unpaid"}', timestamp: 1793698202800 },
    { type: 'TOOL_CALL_END', toolCallId: 'call_a2', timestamp: 1793698202940 },
    { type: 'TOOL_CALL_RESULT', messageId: 'tool_a2', toolCallId: 'call_a2', role: 'tool', content: '{"invoices":[{"invoice":"RE-2026-0121","amount":4860,"due":"2026-10-12"},{"invoice":"RE-2026-0134","amount":1275.5,"due":"2026-10-28"}],"total":6135.5,"currency":"EUR"}', timestamp: 1793698203080 },
    { type: 'STATE_DELTA', delta: [{ op: 'replace', path: '/lookups', value: 2 }], timestamp: 1793698203220 },
    { type: 'STEP_FINISHED', stepName: 'lookup', timestamp: 1793698203360 },
    { type: 'TEXT_MESSAGE_START', messageId: 'msg_a2', role: 'assistant', timestamp: 1793698203500 },
    { type: 'TEXT_MESSAGE_CONTENT', messageId: 'msg_a2', delta: 'Helios En', timestamp: 1793698203640 },
    { type: 'TEXT_MESSAGE_CONTENT', messageId: 'msg_a2', delta: 'ergie has **2 ', timestamp: 1793698203780 },
    { type: 'TEXT_MESSAGE_CONTENT', messageId: 'msg_a2', delta: 'unpaid invoices** tota', timestamp: 1793698203920 },
    { type: 'TEXT_MESSAGE_CONTENT', messageId: 'msg_a2', delta: 'lling €6,135.50:\n\n- RE-2026-01', timestamp: 1793698204060 },
    { type: 'TEXT_MESSAGE_CONTENT', messageId: 'msg_a2', delta: '21 — €4,860.00, due 12 Oc', timestamp: 1793698204200 },
    { type: 'TEXT_MESSAGE_CONTENT', messageId: 'msg_a2', delta: 't\n- RE-2026-0134 — €1,275.50, d', timestamp: 1793698204340 },
    { type: 'TEXT_MESSAGE_CONTENT', messageId: 'msg_a2', delta: 'ue 28 Oct\n\nThe first is more than 14 day', timestamp: 1793698204480 },
    { type: 'TEXT_MESSAGE_CONTENT', messageId: 'msg_a2', delta: 's overdue.', timestamp: 1793698204620 },
    { type: 'TEXT_MESSAGE_END', messageId: 'msg_a2', timestamp: 1793698204760 },
    { type: 'RUN_FINISHED', threadId: 'thread_7f3a2c', runId: 'run_a1', outcome: { type: 'success' }, timestamp: 1793698204900 }
  ];
}

// A tool call that waits for approval: the first run ends with an interrupt, the second
// carries on once the application sends the decision back.
function approvalRun() {
  return [
    { type: 'RUN_STARTED', threadId: 'thread_7f3a2c', runId: 'run_b1', protocolVersion: '1.0', timestamp: 1793698205040 },
    { type: 'TEXT_MESSAGE_START', messageId: 'msg_b1', role: 'assistant', timestamp: 1793698205180 },
    { type: 'TEXT_MESSAGE_CONTENT', messageId: 'msg_b1', delta: "I'll send the fir", timestamp: 1793698205320 },
    { type: 'TEXT_MESSAGE_CONTENT', messageId: 'msg_b1', delta: 'st reminder for RE-2026', timestamp: 1793698205460 },
    { type: 'TEXT_MESSAGE_CONTENT', messageId: 'msg_b1', delta: '-0121 to Élise Martin.', timestamp: 1793698205600 },
    { type: 'TEXT_MESSAGE_END', messageId: 'msg_b1', timestamp: 1793698205740 },
    { type: 'TOOL_CALL_START', toolCallId: 'call_b1', toolCallName: 'send_reminder', parentMessageId: 'msg_b1', timestamp: 1793698205880 },
    { type: 'TOOL_CALL_ARGS', toolCallId: 'call_b1', delta: '{"invoice":"RE-2026-', timestamp: 1793698206020 },
    { type: 'TOOL_CALL_ARGS', toolCallId: 'call_b1', delta: '0121","template":"re', timestamp: 1793698206160 },
    { type: 'TOOL_CALL_ARGS', toolCallId: 'call_b1', delta: 'minder-1","to":"e.ma', timestamp: 1793698206300 },
    { type: 'TOOL_CALL_ARGS', toolCallId: 'call_b1', delta: 'rtin@helios.example"', timestamp: 1793698206440 },
    { type: 'TOOL_CALL_ARGS', toolCallId: 'call_b1', delta: '}', timestamp: 1793698206580 },
    { type: 'TOOL_CALL_END', toolCallId: 'call_b1', timestamp: 1793698206720 },
    { type: 'RUN_FINISHED', threadId: 'thread_7f3a2c', runId: 'run_b1', outcome: { type: 'interrupt', interrupts: [{ id: 'int_b1', reason: 'tool_call', toolCallId: 'call_b1', message: 'Send the first reminder for RE-2026-0121 to e.martin@helios.example?', responseSchema: { type: 'object', properties: { approved: { type: 'boolean' } }, required: ['approved'] } }] }, timestamp: 1793698206860 },
    { type: 'RUN_STARTED', threadId: 'thread_7f3a2c', runId: 'run_b2', protocolVersion: '1.0', timestamp: 1793698207000 },
    { type: 'TOOL_CALL_RESULT', messageId: 'tool_b1', toolCallId: 'call_b1', role: 'tool', content: '{"sent":true,"messageId":"mail-88213"}', timestamp: 1793698207140 },
    { type: 'TEXT_MESSAGE_START', messageId: 'msg_b2', role: 'assistant', timestamp: 1793698207280 },
    { type: 'TEXT_MESSAGE_CONTENT', messageId: 'msg_b2', delta: 'Done — the reminder ', timestamp: 1793698207420 },
    { type: 'TEXT_MESSAGE_CONTENT', messageId: 'msg_b2', delta: 'is on its way to Élise Martin.', timestamp: 1793698207560 },
    { type: 'TEXT_MESSAGE_END', messageId: 'msg_b2', timestamp: 1793698207700 },
    { type: 'RUN_FINISHED', threadId: 'thread_7f3a2c', runId: 'run_b2', outcome: { type: 'success' }, timestamp: 1793698207840 }
  ];
}

// A call drawn as the application’s own tile, an `ask_user` surface the person answers, and an
// answer with a surface fenced into its text.
function surfaceRun() {
  return [
    { type: 'RUN_STARTED', threadId: 'thread_7f3a2c', runId: 'run_c1', protocolVersion: '1.0', timestamp: 1793698207980 },
    { type: 'TOOL_CALL_START', toolCallId: 'call_c1', toolCallName: 'show_company', parentMessageId: 'msg_c1', timestamp: 1793698208120 },
    { type: 'TOOL_CALL_ARGS', toolCallId: 'call_c1', delta: '{"id":"h', timestamp: 1793698208260 },
    { type: 'TOOL_CALL_ARGS', toolCallId: 'call_c1', delta: 'elios"}', timestamp: 1793698208400 },
    { type: 'TOOL_CALL_END', toolCallId: 'call_c1', timestamp: 1793698208540 },
    { type: 'TOOL_CALL_RESULT', messageId: 'tool_c1', toolCallId: 'call_c1', role: 'tool', content: '{"id":"helios","name":"Helios Energie","city":"Lyon","country":"France","industry":"Energy","contact":"Élise Martin","openBalance":6135.5,"currency":"EUR"}', timestamp: 1793698208680 },
    { type: 'TOOL_CALL_START', toolCallId: 'call_c2', toolCallName: 'ask_user', parentMessageId: 'msg_c1', timestamp: 1793698208820 },
    { type: 'TOOL_CALL_ARGS', toolCallId: 'call_c2', delta: '{"zx":"surface/1","surface":"s1","intent":"ask",', timestamp: 1793698208960 },
    { type: 'TOOL_CALL_ARGS', toolCallId: 'call_c2', delta: '"title":"Which reminder should Helios Energie ge', timestamp: 1793698209100 },
    { type: 'TOOL_CALL_ARGS', toolCallId: 'call_c2', delta: 't?","author":"finance","root":["why","opts"],"no', timestamp: 1793698209240 },
    { type: 'TOOL_CALL_ARGS', toolCallId: 'call_c2', delta: 'des":[{"id":"why","type":"text","text":"RE-2026-', timestamp: 1793698209380 },
    { type: 'TOOL_CALL_ARGS', toolCallId: 'call_c2', delta: '0121 is **24 days** overdue."},{"id":"opts","typ', timestamp: 1793698209520 },
    { type: 'TOOL_CALL_ARGS', toolCallId: 'call_c2', delta: 'e":"fields","schema":{"type":"', timestamp: 1793698209660 },
    { type: 'TOOL_CALL_ARGS', toolCallId: 'call_c2', delta: 'object","required":["template"],"properties":{"t', timestamp: 1793698209800 },
    { type: 'TOOL_CALL_ARGS', toolCallId: 'call_c2', delta: 'emplate":{"type":"string","title":"Template","on', timestamp: 1793698209940 },
    { type: 'TOOL_CALL_ARGS', toolCallId: 'call_c2', delta: 'eOf":[{"const":"reminder-1","title":"First remin', timestamp: 1793698210080 },
    { type: 'TOOL_CALL_ARGS', toolCallId: 'call_c2', delta: 'der"},{"const":"reminder-2","title":"Second remi', timestamp: 1793698210220 },
    { type: 'TOOL_CALL_ARGS', toolCallId: 'call_c2', delta: 'nder, €5.00 fee"}]},"sendOn":{"type":"string","f', timestamp: 1793698210360 },
    { type: 'TOOL_CALL_ARGS', toolCallId: 'call_c2', delta: 'ormat":"date","title":"Send on"}}}}]}', timestamp: 1793698210500 },
    { type: 'TOOL_CALL_END', toolCallId: 'call_c2', timestamp: 1793698210640 },
    { type: 'RUN_FINISHED', threadId: 'thread_7f3a2c', runId: 'run_c1', outcome: { type: 'success', pendingToolCallIds: ['call_c2'] }, timestamp: 1793698210780 },
    { type: 'RUN_STARTED', threadId: 'thread_7f3a2c', runId: 'run_c2', protocolVersion: '1.0', timestamp: 1793698210920 },
    { type: 'TEXT_MESSAGE_START', messageId: 'msg_c2', role: 'assistant', timestamp: 1793698211060 },
    { type: 'TEXT_MESSAGE_CONTENT', messageId: 'msg_c2', delta: 'Scheduled. Here is', timestamp: 1793698211200 },
    { type: 'TEXT_MESSAGE_CONTENT', messageId: 'msg_c2', delta: ' the summary:\n\n```zx', timestamp: 1793698211340 },
    { type: 'TEXT_MESSAGE_CONTENT', messageId: 'msg_c2', delta: '-surface\n', timestamp: 1793698211480 },
    { type: 'TEXT_MESSAGE_CONTENT', messageId: 'msg_c2', delta: '{"zx":"surface/1","op":"begin","surface":"s1","intent":"show","title":"Reminder scheduled","author":"finance","root":["sum","when"]}\n{"op":"n', timestamp: 1793698211620 },
    { type: 'TEXT_MESSAGE_CONTENT', messageId: 'msg_c2', delta: 'ode","surface":"s1","id":"sum","type":"stat","label":"Amount', timestamp: 1793698211760 },
    { type: 'TEXT_MESSAGE_CONTENT', messageId: 'msg_c2', delta: ' reminded","value":4860,"format":"currency","currency":"EUR"}\n{"op":"node","surface":"s1","id":"when","type":"text","text":"First reminder goes out on **5 Nov 2026**."}\n{"op":"end","surface":"s1"}\n`', timestamp: 1793698211900 },
    { type: 'TEXT_MESSAGE_CONTENT', messageId: 'msg_c2', delta: '``\n\n', timestamp: 1793698212040 },
    { type: 'TEXT_MESSAGE_CONTENT', messageId: 'msg_c2', delta: "I'll check for payment a week later.", timestamp: 1793698212180 },
    { type: 'TEXT_MESSAGE_END', messageId: 'msg_c2', timestamp: 1793698212320 },
    { type: 'RUN_FINISHED', threadId: 'thread_7f3a2c', runId: 'run_c2', outcome: { type: 'success' }, timestamp: 1793698212460 }
  ];
}

// The application’s own tile for `show_company` calls: a record card drawn as text from the
// call’s result, a skeleton until the result is there.
function companyCard(item) {
  const company = item.company;
  if (!company) return skeletonText({ lines: 3 });
  return h('div', { class: 'demo-card' }, renderBlocks([
    { type: 'heading', text: String(company.name ?? '') },
    { type: 'figures', rows: [
      ['City', '', `${company.city ?? ''}, ${company.country ?? ''}`],
      ['Contact', '', String(company.contact ?? '')],
      ['Open balance', '', formatCurrency(company.openBalance, company.currency)]
    ] }
  ], { headingLevel: 4 }));
}

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
    },
    {
      title: 'Connecting an AG-UI event stream',
      blurb: 'connectAgUi() draws parsed AG-UI 1.0 events in a thread: answers, trace steps, an '
        + 'approval, the application’s own tile, and surfaces. It sends nothing; the log shows the '
        + 'input the application would start the next run with. Approve the reminder or answer the '
        + 'question, and the recorded next run plays.',
      layout: 'stack',
      width: '720px',
      render: ({ cleanup, log }) => {
        if (!AgentThread.has('company-card')) AgentThread.register('company-card', companyCard);
        const status = new RunStatus(null, { compact: true });
        const thread = new AgentThread(null, { authors: AUTHORS, answerActions: ['copy'] });
        let adapter = null;
        let timer = 0;

        const replay = (recorded) => {
          clearTimeout(timer);
          adapter?.destroy();
          thread.setItems([]);
          // A run that waits for the person ends there; the recorded next run plays once the
          // application has sent the answer back.
          const second = recorded.findIndex((event, index) => index > 0 && event.type === 'RUN_STARTED');
          let later = second > 0 ? recorded.slice(second) : [];
          const interrupts = new Map();
          adapter = connectAgUi(thread, {
            agent: 'finance',
            runStatus: status,
            inlineSurfaces: true,
            requiresApproval: (call) => call.name === 'send_reminder',
            tools: {
              show_company: (call) => (call.args
                ? { type: 'company-card', company: call.status === 'done' ? JSON.parse(String(call.result)) : null }
                : null)
            },
            ontoolresult: (id, result) => {
              const input = interrupts.has(id)
                ? { resume: [{ interruptId: interrupts.get(id), status: 'resolved', payload: result }] }
                : { messages: [{ role: 'tool', toolCallId: id, content: JSON.stringify(result) }] };
              log(`next run input: ${JSON.stringify(input)}`);
              if (later.length && (result.approved === true || result.action === 'submit')) {
                play(later);
                later = [];
              }
            },
            onstate: (state) => log(`state: ${JSON.stringify(state)}`),
            onerror: (problem) => log(`${problem.code}: ${problem.message}`)
          });
          const send = (event) => {
            if (event.type === 'RUN_FINISHED' && event.outcome?.type === 'interrupt') {
              for (const interrupt of event.outcome.interrupts) interrupts.set(interrupt.toolCallId, interrupt.id);
            }
            adapter.handle(event);
          };
          const play = (events) => {
            if (prefersReducedMotion(thread.toElement())) {
              events.forEach(send);
              return;
            }
            let index = 0;
            const next = () => {
              send(events[index]);
              index += 1;
              if (index < events.length) timer = window.setTimeout(next, 60);
            };
            next();
          };
          play(second > 0 ? recorded.slice(0, second) : recorded);
        };

        cleanup(() => {
          clearTimeout(timer);
          adapter?.destroy();
          thread.destroy();
          status.destroy();
        });
        return [
          h('div', { class: 'demo-row' },
            button({ label: 'Plain answer', onclick: () => replay(plainRun()) }),
            button({ label: 'Approval', onclick: () => replay(approvalRun()) }),
            button({ label: 'Tile and surfaces', onclick: () => replay(surfaceRun()) })),
          status.toElement(),
          h('div', { class: 'demo-card', style: { maxBlockSize: '32rem', overflowY: 'auto' } }, thread.toElement())
        ];
      }
    }
  ]
};
