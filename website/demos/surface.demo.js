import { BlockView, CodeEditor, Surface, button, elicit, elicitationHandler, grid, h, prefersReducedMotion, surfaceText } from '../../src/index.js';
import { inlineSplitter } from '../../src/components/surface/stream.js';

// A review an agent composed, as the operation lines it streams: three overdue invoices to pick
// from, and the template to send. The rows are data, bound by JSON Pointer; records are named by
// entity and id, and the application resolves them.
const REMINDER_LINES = [
  { zx: 'surface/1', op: 'begin', surface: 'reminders', intent: 'review', title: 'Send 3 first reminders?', author: 'finance', root: ['why', 'list', 'opts'] },
  { op: 'node', surface: 'reminders', id: 'why', type: 'text', text: 'Three invoices are more than **14 days** overdue.' },
  {
    op: 'node', surface: 'reminders', id: 'list', type: 'table', name: 'invoices', selectable: 'multi', rowId: 'invoice',
    rows: { $data: '/overdue' },
    columns: [
      { id: 'invoice', label: 'Invoice' },
      { id: 'customer', label: 'Customer' },
      { id: 'amount', label: 'Amount', align: 'end', format: 'currency', currency: 'EUR' }
    ]
  },
  {
    op: 'node', surface: 'reminders', id: 'opts', type: 'fields',
    schema: {
      type: 'object', required: ['template'],
      properties: {
        template: {
          type: 'string', title: 'Template',
          oneOf: [{ const: 'reminder-1', title: 'First reminder' }, { const: 'reminder-2', title: 'Second reminder, €5.00 fee' }]
        },
        sendOn: { type: 'string', format: 'date', title: 'Send on' }
      }
    }
  },
  {
    op: 'data', surface: 'reminders', path: '/overdue', value: [
      { invoice: 'RE-2026-0121', customer: { $ref: 'company', id: 'helios' }, amount: 4860 },
      { invoice: 'RE-2026-0127', customer: { $ref: 'company', id: 'nordlicht' }, amount: 1275.5 },
      { invoice: 'RE-2026-0130', customer: { $ref: 'company', id: 'brun' }, amount: 620 }
    ]
  },
  {
    op: 'actions', surface: 'reminders', items: [
      { id: 'send', label: 'Send reminders', kind: 'primary', tool: 'mail.send' },
      { id: 'later', label: 'Not now' }
    ]
  },
  { op: 'end', surface: 'reminders' }
];

// An ask form for the values the agent is missing before it can book a visit.
function visitForm() {
  return {
    zx: 'surface/1',
    surface: 'visit',
    intent: 'ask',
    title: 'When should the technician come?',
    author: 'service',
    root: ['intro', 'form'],
    nodes: [
      { id: 'intro', type: 'text', text: 'The heat pump at Helios Energie needs its yearly check. I need a day and a contact on site.' },
      {
        id: 'form', type: 'fields',
        schema: {
          type: 'object', required: ['day', 'contact'],
          properties: {
            day: { type: 'string', format: 'date', title: 'Day' },
            slot: { type: 'string', title: 'Time of day', enum: ['morning', 'afternoon'], default: 'morning' },
            contact: { type: 'string', format: 'email', title: 'Contact on site' },
            access: { type: 'boolean', title: 'The site needs a visitor badge' }
          }
        }
      }
    ]
  };
}

// A choice between three ways to ship a split order.
function shippingChoice() {
  return {
    zx: 'surface/1',
    surface: 'ship',
    intent: 'choose',
    title: 'How should order SO-4471 ship?',
    author: 'orders',
    root: ['pick'],
    nodes: [{
      id: 'pick', type: 'choice', name: 'plan', label: 'Shipping plan',
      choices: [
        { value: 'one', label: 'One shipment', description: 'Everything on 14 November' },
        { value: 'two', label: 'Two shipments', description: 'What is in stock now, the rest on 14 November' },
        { value: 'pickup', label: 'Pickup', description: 'From the Lyon depot, tomorrow' }
      ]
    }]
  };
}

// Three questions; the first answer decides whether the second asks for a time slot or a depot.
function returnQuestionnaire() {
  return {
    zx: 'surface/1',
    surface: 'return',
    intent: 'questionnaire',
    title: 'Return the damaged pallet',
    author: 'orders',
    root: ['steps'],
    nodes: [{
      id: 'steps', type: 'questionnaire',
      steps: [
        {
          name: 'how', prompt: 'How will the pallet come back?', required: true,
          choices: [{ value: 'collect', label: 'Collect it from us' }, { value: 'dropoff', label: 'We bring it to a depot' }],
          next: [{ if: { field: 'how', op: 'eq', value: 'dropoff' }, goto: 'depot' }, { goto: 'slot' }]
        },
        {
          name: 'slot', prompt: 'When can it be collected?', required: true,
          when: { field: 'how', op: 'eq', value: 'collect' },
          choices: [{ value: 'am', label: 'Monday morning' }, { value: 'pm', label: 'Monday afternoon' }],
          next: 'notify'
        },
        {
          name: 'depot', prompt: 'Which depot?', required: true,
          when: { field: 'how', op: 'eq', value: 'dropoff' },
          choices: [{ value: 'lyon', label: 'Lyon' }, { value: 'basel', label: 'Basel' }],
          next: 'notify'
        },
        {
          name: 'notify', prompt: 'Who gets the return label?',
          input: { label: 'Email' },
          validate: [{ required: true, message: 'Say where to send the label' }, { format: 'email', message: 'That is not an email address' }]
        }
      ]
    }]
  };
}

// An ask form whose IBAN field is shown only while the person pays by transfer.
function paymentForm() {
  return {
    zx: 'surface/1',
    surface: 'pay',
    intent: 'ask',
    title: 'How will the customer pay?',
    author: 'orders',
    root: ['form'],
    nodes: [{
      id: 'form', type: 'fields',
      schema: {
        type: 'object', required: ['method'],
        properties: {
          method: {
            type: 'string', title: 'Payment',
            oneOf: [{ const: 'card', title: 'Card' }, { const: 'transfer', title: 'Bank transfer' }]
          },
          iban: { type: 'string', title: 'IBAN', maxLength: 34, 'x-zx': { visible: { field: 'method', op: 'eq', value: 'transfer' } } },
          note: { type: 'string', title: 'Note for the invoice', 'x-zx': { field: 'textarea' } }
        }
      }
    }]
  };
}

// A surface with mistakes in it. The root is one id rather than a list and a pointer lacks its
// leading slash (both repaired), a node type does not exist, a link is not https, and an action
// has no label.
function brokenSummary() {
  return {
    zx: 'surface/1',
    surface: 'broken',
    intent: 'show',
    title: 'Payments this week',
    author: 'finance',
    root: 'body',
    nodes: [
      { id: 'body', type: 'stack', gap: 'md', children: ['intro', 'received', 'clip', 'portal'] },
      { id: 'intro', type: 'text', text: '<b>Markup</b> in model text stays text.' },
      { id: 'received', type: 'stat', label: 'Received', value: { $data: 'received' }, format: 'currency', currency: 'EUR' },
      { id: 'clip', type: 'video', asset: 'weekly-recap' },
      { id: 'portal', type: 'link', text: 'Payment portal', href: 'javascript:void(0)' }
    ],
    data: { received: 18240 },
    actions: [{ id: 'ok' }]
  };
}

// An answer as the model writes it: prose, then operation lines inside a zx-surface fence, then
// more prose.
const INLINE_ANSWER = [
  'Atelier Brun has paid **€620.00** of its open balance; one invoice is still open.\n\n',
  '```zx-surface\n',
  '{"zx":"surface/1","op":"begin","surface":"brun","intent":"show","title":"Atelier Brun · balance","author":"finance","root":["cols"]}\n',
  '{"op":"node","surface":"brun","id":"cols","type":"columns","count":2,"children":["paid","open"]}\n',
  '{"op":"node","surface":"brun","id":"paid","type":"stat","label":"Paid","value":620,"format":"currency","currency":"EUR"}\n',
  '{"op":"node","surface":"brun","id":"open","type":"stat","label":"Open","value":1480,"format":"currency","currency":"EUR","caption":"RE-2026-0142"}\n',
  '{"op":"end","surface":"brun"}\n',
  '```\n',
  'Shall I send a first reminder for the open invoice?'
].join('');

// A form-mode request, as an MCP server sends it: a message and a flat JSON Schema of primitive
// and multiple-choice properties, with defaults the form pre-fills.
const DELIVERY_REQUEST = {
  message: 'Delivery details for order SO-4471',
  requestedSchema: {
    type: 'object',
    required: ['date', 'dock'],
    properties: {
      date: { type: 'string', format: 'date', title: 'Delivery date' },
      dock: { type: 'string', title: 'Dock', oneOf: [{ const: 'north', title: 'North gate' }, { const: 'south', title: 'South gate' }] },
      pallets: { type: 'integer', title: 'Pallets', minimum: 1, maximum: 24, default: 4 },
      services: { type: 'array', title: 'Services', items: { anyOf: [{ const: 'tail-lift', title: 'Tail lift' }, { const: 'notify', title: 'Call ahead' }] } },
      reference: { type: 'string', title: 'Your reference', maxLength: 40 }
    }
  }
};

// What an MCP server answers a tools/call with when it needs the person first: an input_required
// result whose inputRequests ask in form mode and in URL mode. The client answers every entry and
// calls the tool again with inputResponses under the same keys, echoing requestState unchanged.
const INPUT_REQUIRED = {
  resultType: 'input_required',
  inputRequests: {
    delivery: { method: 'elicitation/create', params: DELIVERY_REQUEST },
    bank: {
      method: 'elicitation/create',
      params: { mode: 'url', message: 'Connect the customer’s bank account to set up the direct debit.', url: 'https://example.com/?connect=bank' }
    }
  },
  requestState: 'eyJvcmRlciI6IlNPLTQ0NzEifQ'
};

// What the playground starts with: operation lines for a confirmation. A whole document works too.
const PLAYGROUND_START = [
  '{"zx":"surface/1","op":"begin","surface":"archive","intent":"confirm","title":"Archive 12 paid invoices?","author":"finance","root":["what"]}',
  '{"op":"node","surface":"archive","id":"what","type":"text","text":"They were paid in **August** and are no longer needed in the open list."}',
  '{"op":"end","surface":"archive"}'
].join('\n');

// Who composes surfaces, and the records the application can name.
const AUTHORS = {
  finance: { name: 'Finance agent' }, orders: { name: 'Orders agent' }, service: { name: 'Service agent' }
};
const COMPANIES = { helios: 'Helios Energie', nordlicht: 'Nordlicht Logistik', brun: 'Atelier Brun' };

// How a surface resolves `{"$ref": "company", "id": …}`: only companies, and only known ones.
const RESOLVE = {
  entities: ['company'],
  ref: (ref) => (COMPANIES[ref.id] ? { id: ref.id, title: COMPANIES[ref.id], icon: 'building' } : null)
};

export default {
  title: 'Surface',
  group: 'Agents',
  api: ['Surface'],
  blurb: 'Interface an agent composes as JSON — a rich answer, or a dialog asking the person '
    + 'something — validated and drawn with the library’s own components. It ends in exactly one '
    + 'reply, and stays as the read-only record of the answer.',
  examples: [
    {
      title: 'A streamed review',
      blurb: 'The review arrives line by line through `write()`. What has arrived is drawn at once, '
        + 'and the actions wait for the surface’s `end`. The application’s `policy` decides what '
        + 'each action needs: sending mail asks for a confirmation first. Under reduced motion, '
        + 'Replay writes every line at once.',
      layout: 'stack',
      width: '640px',
      render: ({ cleanup, log }) => {
        const host = h('div');
        let surface = null;
        let timer = 0;
        const play = () => {
          clearTimeout(timer);
          surface?.destroy();
          surface = new Surface(null, {
            authors: AUTHORS,
            resolve: RESOLVE,
            policy: (action) => (action.tool === 'mail.send' ? 'confirm' : 'allow'),
            onreply: ({ detail }) => log(`reply: ${detail.reply.action} ${JSON.stringify(detail.reply.values)}`),
            onerror: ({ detail }) => log(`errors: ${detail.errors.map((error) => error.message).join('; ')}`)
          });
          host.replaceChildren(surface.toElement());
          const lines = REMINDER_LINES.map((line) => `${JSON.stringify(line)}\n`);
          if (prefersReducedMotion(host.isConnected ? host : null)) {
            surface.write(lines.join(''));
            return;
          }
          const target = surface;
          let index = 0;
          const next = () => {
            target.write(lines[index]);
            index += 1;
            if (index < lines.length) timer = window.setTimeout(next, 450);
          };
          timer = window.setTimeout(next, 150);
        };
        play();
        cleanup(() => {
          clearTimeout(timer);
          surface?.destroy();
        });
        return [host, h('div', { class: 'demo-row' }, button({ label: 'Replay', icon: 'rotate-right', onclick: play }))];
      }
    },
    {
      title: 'Asking for missing values',
      blurb: 'An `ask` surface is a form: Submit checks the values against the schema and replies '
        + 'with them; Cancel and Escape reply too. Answered, it becomes a receipt.',
      layout: 'stack',
      width: '640px',
      render: ({ cleanup, log }) => {
        const host = h('div');
        let surface = null;
        const ask = () => {
          surface?.destroy();
          surface = new Surface(null, {
            document: visitForm(),
            authors: AUTHORS,
            onreply: ({ detail }) => log(`reply: ${detail.reply.action} ${JSON.stringify(detail.reply.values)}`)
          });
          host.replaceChildren(surface.toElement());
        };
        ask();
        cleanup(() => surface?.destroy());
        return [host, h('div', { class: 'demo-row' }, button({ label: 'Ask again', onclick: ask }))];
      }
    },
    {
      title: 'A choice',
      blurb: 'A `choose` surface offers its options as one group; the reply carries the picked value '
        + 'under the choice’s `name`.',
      layout: 'stack',
      width: '640px',
      render: ({ cleanup, log }) => {
        const host = h('div');
        let surface = null;
        const ask = () => {
          surface?.destroy();
          surface = new Surface(null, {
            document: shippingChoice(),
            authors: AUTHORS,
            onreply: ({ detail }) => log(`reply: ${detail.reply.action} ${JSON.stringify(detail.reply.values)}`)
          });
          host.replaceChildren(surface.toElement());
        };
        ask();
        cleanup(() => surface?.destroy());
        return [host, h('div', { class: 'demo-row' }, button({ label: 'Ask again', onclick: ask }))];
      }
    },
    {
      title: 'A questionnaire with a branch',
      blurb: 'Steps with declarative `when` and `next`: collecting asks for a time, a drop-off asks '
        + 'for a depot, and both end at the email, checked by its `validate` rules. The reply is '
        + '`{answers, path}`.',
      layout: 'stack',
      width: '640px',
      render: ({ cleanup, log }) => {
        const host = h('div');
        let surface = null;
        const ask = () => {
          surface?.destroy();
          surface = new Surface(null, {
            document: returnQuestionnaire(),
            authors: AUTHORS,
            onreply: ({ detail }) => log(`reply: ${detail.reply.action} ${JSON.stringify(detail.reply.values)}`)
          });
          host.replaceChildren(surface.toElement());
        };
        ask();
        cleanup(() => surface?.destroy());
        return [host, h('div', { class: 'demo-row' }, button({ label: 'Start again', onclick: ask }))];
      }
    },
    {
      title: 'A conditional field',
      blurb: 'The IBAN appears only while Bank transfer is chosen. Hidden, it keeps what was typed '
        + 'and stays out of the reply. The receipt is also available as text through `surfaceText()`.',
      layout: 'stack',
      width: '640px',
      render: ({ cleanup, log }) => {
        const host = h('div');
        let surface = null;
        const mount = () => {
          surface?.destroy();
          const document = paymentForm();
          surface = new Surface(null, {
            document,
            authors: AUTHORS,
            onchange: ({ detail }) => log(`change: ${detail.name} = ${JSON.stringify(detail.value)}`),
            onreply: ({ detail }) => log(surfaceText(document, detail.reply))
          });
          host.replaceChildren(surface.toElement());
        };
        mount();
        cleanup(() => surface?.destroy());
        return [host, h('div', { class: 'demo-row' }, button({ label: 'Ask again', onclick: mount }))];
      }
    },
    {
      title: 'Tolerant rendering, strict reporting',
      blurb: 'What is invalid is dropped, an unknown or broken node is a quiet fallback, and every '
        + 'problem is listed in `getErrors()` — the shape an application returns to the agent so it '
        + 'can correct itself. Repairs are reported with `repaired: true`.',
      layout: 'stack',
      width: '640px',
      render: ({ cleanup }) => {
        const surface = new Surface(null, { document: brokenSummary(), authors: AUTHORS });
        cleanup(() => surface.destroy());
        const errors = h('ul', { class: 'demo-stack', style: { gap: 'var(--zx-space-1)', margin: 0, paddingInlineStart: 'var(--zx-space-5)' } },
          surface.getErrors().map((error) => h('li', { class: 'demo-caption' },
            `${error.repaired ? 'repaired' : error.code}${error.path ? ` ${error.path}` : ''}: ${error.message}`)));
        return [surface.toElement(), h('p', { class: 'demo-caption' }, 'errors[]'), errors];
      }
    },
    {
      title: 'A surface inside an answer',
      blurb: '`inlineSplitter()` separates a model’s answer text from the operation lines inside a '
        + '```zx-surface fence, without holding the prose back: prose streams into a BlockView, '
        + 'the lines into a Surface between them.',
      layout: 'stack',
      width: '640px',
      render: ({ cleanup, log }) => {
        const host = h('div', { class: 'demo-stack' });
        const parts = [];
        let timer = 0;
        const play = () => {
          clearTimeout(timer);
          for (const part of parts.splice(0)) part.destroy();
          host.replaceChildren();
          let prose = null;
          let surface = null;
          const splitter = inlineSplitter({
            ontext: (text) => {
              if (!prose) {
                prose = new BlockView(null, { streaming: true });
                parts.push(prose);
                host.append(prose.toElement());
                surface = null;
              }
              prose.appendText(text);
            },
            online: (line) => {
              if (!surface) {
                prose?.end();
                prose = null;
                surface = new Surface(null, { authors: AUTHORS, onreply: ({ detail }) => log(`reply: ${detail.reply.action}`) });
                parts.push(surface);
                host.append(surface.toElement());
              }
              surface.write(`${line}\n`);
            },
            onerror: (error) => log(`error: ${error.message}`)
          });
          const finish = () => {
            splitter.end();
            prose?.end();
          };
          if (prefersReducedMotion(host.isConnected ? host : null)) {
            splitter.write(INLINE_ANSWER);
            finish();
            return;
          }
          let index = 0;
          const next = () => {
            splitter.write(INLINE_ANSWER.slice(index, index + 12));
            index += 12;
            if (index < INLINE_ANSWER.length) timer = window.setTimeout(next, 30);
            else finish();
          };
          next();
        };
        play();
        cleanup(() => {
          clearTimeout(timer);
          for (const part of parts) part.destroy();
        });
        return [host, h('div', { class: 'demo-row' }, button({ label: 'Replay', icon: 'rotate-right', onclick: play }))];
      }
    },
    {
      title: 'elicit()',
      blurb: 'An MCP form-mode request — a message and a restricted JSON Schema — asked in a Dialog. '
        + 'It resolves `accept` with the checked values, `decline`, or `cancel` on Escape.',
      layout: 'row',
      render: ({ log }) => button({
        label: 'Ask for delivery details',
        kind: 'primary',
        onclick: async () => {
          const result = await elicit(DELIVERY_REQUEST, { author: 'orders', authors: AUTHORS });
          log(`${result.action}${result.content ? ` ${JSON.stringify(result.content)}` : ''}`);
        }
      })
    },
    {
      title: 'An MCP client’s elicitation',
      blurb: '`elicitationHandler()` answers the `params` of an MCP `elicitation/create` request, '
        + 'and says which server asks. Form mode asks through `elicit()`. URL mode names the page’s '
        + 'host and full address before anything opens; Open page opens it in a new tab, without '
        + 'opener or referrer. The log shows each result and the `inputResponses` the client sends back.',
      layout: 'row',
      render: ({ log }) => {
        const answer = elicitationHandler({ serverName: 'Orders server' });
        const ask = async (key) => {
          const { params } = INPUT_REQUIRED.inputRequests[key];
          try {
            const result = await answer(params);
            log(`${key}: ${JSON.stringify(result)}`);
            log(`retry tools/call with ${JSON.stringify({ inputResponses: { [key]: result }, requestState: INPUT_REQUIRED.requestState })}`);
          } catch (error) {
            // An unsupported request: the client answers the server with an error instead.
            log(`${key}: error ${error.message}`);
          }
        };
        return [
          button({ label: 'Form mode', kind: 'primary', onclick: () => ask('delivery') }),
          button({ label: 'URL mode', onclick: () => ask('bank') })
        ];
      }
    },
    {
      title: 'Playground',
      blurb: 'Paste operation lines, one per line, or a whole document. It is drawn as you type, '
        + 'with the problems it reported; answer it to see the reply and its `surfaceText()`.',
      layout: 'stack',
      render: ({ cleanup, log }) => {
        const view = h('div');
        const errors = h('pre', { class: 'demo-caption', style: { whiteSpace: 'pre-wrap', margin: 0 } });
        const reply = h('pre', { class: 'demo-caption', style: { whiteSpace: 'pre-wrap', margin: 0 } });
        const receipt = h('pre', { class: 'demo-caption', style: { whiteSpace: 'pre-wrap', margin: 0 } });
        let surface = null;
        let timer = 0;

        const showErrors = (own) => {
          if (surface !== own) return;
          const problems = own.getErrors();
          errors.textContent = problems.length
            ? problems.map((error) => `${error.repaired ? 'repaired' : error.code}${error.path ? ` ${error.path}` : ''}: ${error.message}`).join('\n')
            : 'none';
        };

        const draw = (text) => {
          const old = surface;
          surface = null;
          old?.destroy();
          reply.textContent = '—';
          receipt.textContent = '—';
          let document = null;
          try {
            const parsed = JSON.parse(text);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && !('op' in parsed)) document = parsed;
          } catch {
            // Not one JSON value: read it as operation lines, which report their own problems.
          }
          const own = new Surface(null, {
            document,
            authors: AUTHORS,
            resolve: RESOLVE,
            onreply: ({ detail }) => {
              if (surface !== own) return;
              reply.textContent = JSON.stringify(detail.reply, null, 2);
              receipt.textContent = surfaceText(own.toDocument() ?? {}, detail.reply);
              log(`reply: ${detail.reply.action}`);
            }
          });
          surface = own;
          own.on('error', () => showErrors(own));
          if (!document) own.write(text).end();
          view.replaceChildren(own.toElement());
          showErrors(own);
        };

        const editor = new CodeEditor(null, {
          value: PLAYGROUND_START,
          language: 'json',
          label: 'Surface operations or document',
          rows: 16,
          wrap: 'soft',
          oninput: ({ detail }) => {
            clearTimeout(timer);
            timer = window.setTimeout(() => draw(detail.value), 300);
          }
        });
        draw(PLAYGROUND_START);
        cleanup(() => {
          clearTimeout(timer);
          editor.destroy();
          const old = surface;
          surface = null;
          old?.destroy();
        });
        const label = (text) => h('span', { class: 'demo-caption' }, text);
        return grid({ columns: 2, min: '18rem', align: 'start' },
          editor.toElement(),
          h('div', { class: 'demo-stack' },
            view,
            h('div', { class: 'demo-field' }, label('errors[]'), errors),
            h('div', { class: 'demo-field' }, label('reply'), reply),
            h('div', { class: 'demo-field' }, label('surfaceText(document, reply)'), receipt)));
      }
    }
  ]
};
