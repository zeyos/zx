import { ApprovalCard, button, h } from '../../src/index.js';

// Who gets a reminder: one figures row per recipient, with the invoice, how late it is, and the
// amount. Blocks are drawn as text only, so an agent can write them directly.
function reminderRecipients() {
  return [
    {
      type: 'figures',
      rows: [
        { label: 'Mara Quinn · Brightwater Ltd', detail: 'INV-2041 · 14 days overdue', value: '€1,240.00' },
        { label: 'Jonas Berg · Northwind Studio', detail: 'INV-2038 · 21 days overdue', value: '€860.00' },
        { label: 'Ines Duarte · Kestrel & Co', detail: 'INV-2033 · 30 days overdue', value: '€2,415.50' }
      ]
    }
  ];
}

// The same request after the agent found a fourth overdue invoice.
function revisedRecipients() {
  const [figures] = reminderRecipients();
  return [{
    ...figures,
    rows: [...figures.rows, { label: 'Theo Lind · Harbour Supply', detail: 'INV-2029 · 35 days overdue', value: '€540.00' }]
  }];
}

// The email as the first recipient will get it, shown behind the disclosure.
function reminderEmail() {
  return [
    { type: 'p', text: '**Invoice INV-2041 is 14 days overdue**' },
    { type: 'p', text: 'Hello Mara,' },
    { type: 'p', text: 'Our invoice `INV-2041` for €1,240.00 was due on 20 October. Could you let us know when we can expect payment?' },
    { type: 'p', text: 'Kind regards, Accounts receivable' }
  ];
}

// The Edit form: one field per value the request carries.
const REMINDER_FIELDS = {
  subject: { type: 'text', label: 'Subject', required: true },
  body: {
    type: 'textarea',
    label: 'Message',
    description: 'Braces are filled in for each recipient: {name}, {invoice}, {amount}, {due}.',
    props: { rows: 7 }
  }
};

// The values the request starts from; `approve` reports them, edits included.
const REMINDER_VALUES = {
  subject: 'Invoice {invoice} is {days} days overdue',
  body: 'Hello {name},\n\nOur invoice {invoice} for {amount} was due on {due}. '
    + 'Could you let us know when we can expect payment?\n\nKind regards,\nAccounts receivable'
};

// The values the revised request carries: a firmer subject for invoices this late.
const REVISED_VALUES = {
  ...REMINDER_VALUES,
  subject: 'Second notice: invoice {invoice} is {days} days overdue'
};

// A request restored from a record: the person already changed the subject, and only the subject.
const EDITED_VALUES = { ...REMINDER_VALUES, subject: 'Reminder: invoice {invoice}' };

// What a delete would remove. Whether it needs a typed confirmation is the application's call,
// made from the tool the action runs — never something the model asks for.
function draftInvoices() {
  return [
    { type: 'p', text: 'Drafts **INV-2050** to **INV-2061**, created by the import on 28 October. None of them was sent.' },
    { type: 'callout', tone: 'warning', text: 'Deleted drafts can’t be restored.' }
  ];
}

export default {
  title: 'Approval card',
  group: 'Agents',
  api: ['ApprovalCard'],
  blurb: 'A request that holds an agent’s run until a person answers it: what will happen, a '
    + 'preview of what it produces, and Approve, Edit, and Reject. Answered, it stays as the record '
    + 'of who decided what, and when.',
  examples: [
    {
      title: 'Payment reminders',
      blurb: 'Details and the preview are blocks; the Edit form is built from `fields`. Every '
        + 'answer is a preventable event the application carries out. With focus inside the card, '
        + 'A approves, E edits, and R rejects.',
      layout: 'stack',
      width: '640px',
      render: ({ cleanup, log }) => {
        const card = new ApprovalCard(null, {
          title: 'Send 3 payment reminders?',
          description: 'Sent mail can’t be recalled.',
          icon: 'mail',
          details: reminderRecipients(),
          preview: { label: 'Show the email', content: reminderEmail() },
          fields: REMINDER_FIELDS,
          values: REMINDER_VALUES,
          onapprove: ({ detail }) => log(`approve: “${detail.values.subject}”`),
          onedit: ({ detail }) => log(`edit: changed ${detail.changed.join(', ') || 'nothing'}`),
          onreject: ({ detail }) => log(`reject: ${detail.reason || 'no reason given'}`)
        });
        cleanup(() => card.destroy());
        return [
          card.toElement(),
          h('div', { class: 'demo-row' },
            button({ label: 'Focus the card', onclick: () => card.focus() }),
            button({ label: 'Ask again', onclick: () => card.setStatus('pending') }),
            button({ label: 'Let it expire', onclick: () => card.setStatus('expired') }))
        ];
      }
    },
    {
      title: 'Typed confirmation',
      blurb: 'With `confirmText`, Approve first asks for that text in a confirmation dialog, and '
        + 'only a confirmed approval goes through. `reason: \'required\'` holds Reject until the '
        + 'person says why.',
      layout: 'stack',
      width: '640px',
      render: ({ cleanup, log }) => {
        const card = new ApprovalCard(null, {
          title: 'Delete 12 draft invoices?',
          description: 'The drafts and their line items are removed for everyone.',
          icon: 'trash',
          tone: 'red',
          details: draftInvoices(),
          confirmText: 'delete 12',
          reason: 'required',
          onapprove: () => log('approve'),
          onreject: ({ detail }) => log(`reject: ${detail.reason}`)
        });
        cleanup(() => card.destroy());
        return card.toElement();
      }
    },
    {
      title: 'Update in place',
      blurb: 'When the agent revises a request that is still waiting, `update()` changes what '
        + 'changed — here the title, the recipients, and the values — and leaves the rest alone, '
        + 'focus included. Revise moves focus into the card; Tab to Approve before the revision '
        + 'lands two seconds later, and focus stays on it.',
      layout: 'stack',
      width: '640px',
      render: ({ cleanup, log }) => {
        let revised = false;
        let timer = 0;
        const card = new ApprovalCard(null, {
          title: 'Send 3 payment reminders?',
          icon: 'mail',
          details: reminderRecipients(),
          fields: REMINDER_FIELDS,
          values: REMINDER_VALUES,
          onapprove: ({ detail }) => log(`approve: “${detail.values.subject}”`)
        });
        const revise = () => {
          card.focus();
          window.clearTimeout(timer);
          timer = window.setTimeout(() => {
            revised = !revised;
            card.update(revised
              ? { title: 'Send 4 payment reminders?', details: revisedRecipients(), values: REVISED_VALUES }
              : { title: 'Send 3 payment reminders?', details: reminderRecipients(), values: REMINDER_VALUES });
            const kept = card.toElement().contains(document.activeElement);
            log(`update: ${revised ? 4 : 3} recipients, focus ${kept ? 'kept in the card' : 'outside the card'}`);
          }, 2000);
        };
        cleanup(() => {
          window.clearTimeout(timer);
          card.destroy();
        });
        return [
          card.toElement(),
          h('div', { class: 'demo-row' }, button({ label: 'Revise in 2 seconds', onclick: revise }))
        ];
      }
    },
    {
      title: 'Edited values',
      blurb: '`editedKeys` names the values the person changed, so only those are listed under '
        + '“Edited by you”; `edited: true` alone lists every field. Each saved edit reports the '
        + 'fields it changed in `changed`, and the card keeps the union of edits so far, which the '
        + 'event carries as `editedKeys`.',
      layout: 'stack',
      width: '640px',
      render: ({ cleanup, log }) => {
        const card = new ApprovalCard(null, {
          title: 'Send 3 payment reminders?',
          icon: 'mail',
          details: reminderRecipients(),
          fields: REMINDER_FIELDS,
          values: EDITED_VALUES,
          edited: true,
          editedKeys: ['subject'],
          onedit: ({ detail }) => log(`edit: changed ${detail.changed.join(', ') || 'nothing'}; `
            + `edited so far ${detail.editedKeys?.join(', ') ?? 'every field'}`)
        });
        cleanup(() => card.destroy());
        return card.toElement();
      }
    },
    {
      title: 'Answered requests',
      blurb: 'An answered card is the record: no actions, a verdict line with who answered and '
        + 'when, the edited values, and the reason a rejection was given. `now` is the clock the '
        + 'verdict reads the time against — the time alone on the same day, the date as well '
        + 'before it — fixed here to the afternoon of 3 November.',
      layout: 'stack',
      width: '640px',
      render: ({ cleanup }) => {
        const now = () => new Date(2026, 10, 3, 16, 0);
        const approved = new ApprovalCard(null, {
          title: 'Send 3 payment reminders?',
          icon: 'mail',
          status: 'approved',
          answeredBy: 'Ada Lovelace',
          answeredAt: '2026-11-03T10:31',
          now,
          details: reminderRecipients(),
          fields: REMINDER_FIELDS,
          values: EDITED_VALUES,
          editedKeys: ['subject']
        });
        const rejected = new ApprovalCard(null, {
          title: 'Delete 12 draft invoices?',
          icon: 'trash',
          tone: 'red',
          status: 'rejected',
          answeredBy: 'Grace Hopper',
          answeredAt: '2026-11-02T16:05',
          now,
          rejectReason: 'Keep them until the import is checked; two of them are real orders.'
        });
        cleanup(() => {
          approved.destroy();
          rejected.destroy();
        });
        return [approved.toElement(), rejected.toElement()];
      }
    }
  ]
};
