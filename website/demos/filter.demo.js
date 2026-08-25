import {
  Filter, filterCondition, filterGroup, h
} from '../../src/index.js';

const PEOPLE = [
  { value: '18', label: 'Nordwind GmbH' },
  { value: '31', label: 'Marta Hoffmann' },
  { value: '44', label: 'Aurora Systems' }
];

function initialFilter() {
  return {
    version: 1,
    root: filterGroup('and', [
      filterCondition({ field: 'status', operator: 'anyOf', value: ['open', 'overdue'] }),
      filterGroup('or', [
        filterCondition({ field: 'amount', operator: 'gte', value: 1000 }),
        filterCondition({ field: 'due', operator: 'before', value: '2026-09-01' })
      ])
    ])
  };
}

const FIELDS = [
  {
    id: 'status', label: 'Status', type: 'status',
    choices: [
      { value: 'draft', label: 'Draft' }, { value: 'open', label: 'Open' },
      { value: 'overdue', label: 'Overdue' }, { value: 'paid', label: 'Paid' }
    ]
  },
  { id: 'amount', label: 'Gross amount', type: 'money' },
  { id: 'due', label: 'Due date', type: 'date' },
  {
    id: 'account', label: 'Account', type: 'entity', debounce: 80,
    loadChoices: async ({ query, signal }) => {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, 120);
        signal.addEventListener('abort', () => { clearTimeout(timer); reject(signal.reason); }, { once: true });
      });
      const needle = query.toLocaleLowerCase();
      return PEOPLE.filter((item) => item.label.toLocaleLowerCase().includes(needle));
    }
  },
  { id: 'reference', label: 'Reference', type: 'text' },
  { id: 'tags', label: 'Tags', type: 'tags' }
];

export default {
  title: 'Filter',
  group: 'Data',
  api: ['Filter'],
  blurb: 'A backend-neutral, nested filter authoring component. It emits a versioned JSON-safe expression AST; application adapters remain responsible for compiling and executing it.',
  examples: [
    {
      title: 'Dynamic transaction filter',
      blurb: 'Choose typed fields and only compatible operators appear. Groups preserve explicit AND/OR logic, Apply emits only a valid defensive copy, and asynchronous entity suggestions receive an AbortSignal.',
      render: ({ cleanup, log }) => {
        const filter = new Filter(null, {
          fields: FIELDS,
          value: initialFilter(),
          maxDepth: 3,
          maxConditions: 20,
          onapply: ({ detail }) => log(`apply ${JSON.stringify(detail.value)}`),
          oninvalid: ({ detail }) => log(`invalid ${detail.errors.map((error) => error.message).join('; ')}`)
        });
        cleanup(() => filter.destroy());
        return filter.toElement();
      }
    },
    {
      title: 'Read-only saved filter',
      blurb: 'The same AST can be rendered without mutation controls for a saved view, audit record, or permissions summary.',
      render: ({ cleanup }) => {
        const filter = new Filter(null, { fields: FIELDS, value: initialFilter(), readonly: true });
        cleanup(() => filter.destroy());
        return h('div', { style: { inlineSize: '100%' } }, filter.toElement());
      }
    }
  ]
};
