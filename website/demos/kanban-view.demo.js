import { KanbanView, button, h } from '../../src/index.js';

// One projection can feed TableView, CardView, or KanbanView. Presentation-only preview fields may
// stay hidden while title, group, and board fields remain available to their resolvers.
function opportunityFields() {
  const money = new Intl.NumberFormat('en', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
  return [
    { id: 'opportunity', label: 'Opportunity', sortable: true },
    { id: 'account', label: 'Account', sortable: true },
    { id: 'stage', label: 'Stage', sortable: true },
    { id: 'owner', label: 'Owner', sortable: true },
    {
      id: 'value', label: 'Value', sortable: true, type: 'money',
      render: (_record, _index, value) => money.format(Number(value) || 0),
      sortValue: (record) => record.value
    },
    { id: 'updated', label: 'Updated', sortable: true },
    { id: 'preview', label: 'Preview', visible: false }
  ];
}

// The same realistic opportunities used by CardView include long text, a failed preview, and
// records without media so board cards prove the shared renderer rather than a Kanban-only shape.
function opportunities() {
  return [
    { ID: 101, opportunity: 'Northwind European workspace renewal', account: 'Northwind GmbH', stage: 'Qualified', owner: 'Ada Lovelace', value: 48000, updated: 'Today, 09:42', preview: './assets/zeyos-mark.svg' },
    { ID: 102, opportunity: 'Aurora fleet analytics', account: 'Aurora AB', stage: 'Proposal', owner: 'Grace Hopper', value: 73500, updated: 'Yesterday', preview: './assets/missing-opportunity-preview.webp' },
    { ID: 103, opportunity: 'Contoso service rollout', account: 'Contoso Ltd.', stage: 'Proposal', owner: 'Ada Lovelace', value: 29800, updated: '22 Aug', preview: null },
    { ID: 104, opportunity: 'Fabrikam office automation', account: 'Fabrikam AG', stage: 'Negotiation', owner: 'Grace Hopper', value: 112000, updated: '21 Aug', preview: './assets/zx-mark.svg' },
    { ID: 105, opportunity: 'Alpine logistics platform', account: 'Alpine Logistics', stage: 'Negotiation', owner: 'Ada Lovelace', value: 95000, updated: '18 Aug', preview: null },
    { ID: 106, opportunity: 'Tailspin support extension', account: 'Tailspin Toys', stage: 'Won', owner: 'Grace Hopper', value: 18000, updated: '12 Aug', preview: null }
  ];
}

const STAGES = [
  { id: 'Qualified', label: 'Qualified', limit: 3 },
  { id: 'Proposal', label: 'Proposal', limit: 2 },
  {
    id: 'Negotiation', label: 'Negotiation', limit: 1,
    accept: (record) => Number(record.value) >= 25000
  },
  { id: 'Won', label: 'Won' }
];

const OWNERS = [
  { id: 'Ada Lovelace', label: 'Ada Lovelace' },
  { id: 'Grace Hopper', label: 'Grace Hopper' }
];

function viewOptions(log) {
  return {
    fields: opportunityFields(),
    data: opportunities(),
    recordId: 'ID',
    columnBy: 'stage',
    columns: STAGES,
    swimlaneBy: 'owner',
    swimlanes: OWNERS,
    titleField: 'opportunity',
    subtitleField: 'account',
    preview: 'preview',
    previewAlt: (record) => `${record.account} preview`,
    link: (record) => `#opportunity-${record.ID}`,
    actions: [{ id: 'open', label: 'Open', icon: 'eye' }],
    selectable: 'multi',
    hiddenFields: ['stage', 'owner', 'preview'],
    moveMode: 'local',
    showCounts: true,
    showEmptyColumns: true,
    onrecordclick: ({ detail }) => log(`activate #${detail.id}: ${detail.record.opportunity}`),
    onrecordaction: ({ detail }) => log(`${detail.action.id} #${detail.id}`),
    onselectionchange: ({ detail }) => log(`selected: ${detail.ids.join(', ') || 'none'}`),
    onrecordmove: ({ detail }) => log(`move #${detail.id}: ${detail.from.column}/${detail.from.lane} → ${detail.to.column}/${detail.to.lane} @ ${detail.to.index}${detail.limitExceeded ? ' (over WIP)' : ''}`),
    onstatechange: ({ detail }) => log(`state (${detail.reason}): ${JSON.stringify(detail.state)}`)
  };
}

export default {
  title: 'Kanban view',
  group: 'Data',
  api: ['KanbanView', 'RecordView'],
  blurb: 'A semantic opportunity board sharing fields, cards, sort, selection, and serializable '
    + 'configuration with the other record views.',

  examples: [
    {
      title: 'Opportunity board with swim lanes',
      blurb: 'Counts and advisory WIP limits remain visible across configured columns and owner '
        + 'lanes. Drag the move handle, or focus it and press Enter/Space to grab, arrows to choose '
        + 'a target, Alt+Up/Down to change owner, and Enter/Space again to drop.',
      layout: 'stack',
      render: ({ cleanup, log }) => {
        const view = new KanbanView(null, viewOptions(log));
        cleanup(() => view.destroy());
        return view.toElement();
      }
    },
    {
      title: 'Saved board configuration',
      blurb: 'Column and lane order plus collapsed sections join the common JSON-safe state. '
        + 'Selection, records, and movement history are deliberately excluded.',
      layout: 'stack',
      render: ({ cleanup, log }) => {
        let saved = null;
        const view = new KanbanView(null, { ...viewOptions(log), preview: null, actions: [] });
        cleanup(() => view.destroy());
        return [
          view.toElement(),
          h('div', { class: 'demo-row' },
            button({
              label: 'Save state',
              onclick: () => {
                saved = view.getViewState();
                log(`saved ${JSON.stringify(saved)}`);
              }
            }),
            button({
              label: 'Change board',
              onclick: () => view.setColumnOrder(['Won', 'Negotiation', 'Proposal', 'Qualified'])
                .setColumnCollapsed('Qualified', true)
                .setSwimlaneCollapsed('Grace Hopper', true)
                .setFieldVisible('updated', false)
            }),
            button({
              label: 'Restore state',
              onclick: () => saved ? view.setViewState(saved) : log('Save a state first')
            }))
        ];
      }
    }
  ]
};
