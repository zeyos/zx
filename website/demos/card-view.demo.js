import { CardView, button, h } from '../../src/index.js';

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

// Realistic pipeline records, including long content, a valid local preview, a failed image, and
// records without media so the fallback and no-preview anatomies are both visible.
function opportunities() {
  return [
    { ID: 101, opportunity: 'Northwind European workspace renewal', account: 'Northwind GmbH', stage: 'Qualified', owner: 'Ada Lovelace', value: 48000, updated: 'Today, 09:42', preview: './favicon.svg' },
    { ID: 102, opportunity: 'Aurora fleet analytics', account: 'Aurora AB', stage: 'Proposal', owner: 'Grace Hopper', value: 73500, updated: 'Yesterday', preview: './assets/missing-opportunity-preview.webp' },
    { ID: 103, opportunity: 'Contoso service rollout', account: 'Contoso Ltd.', stage: 'Proposal', owner: 'Ada Lovelace', value: 29800, updated: '22 Aug', preview: null },
    { ID: 104, opportunity: 'Fabrikam office automation', account: 'Fabrikam AG', stage: 'Negotiation', owner: 'Grace Hopper', value: 112000, updated: '21 Aug', preview: './favicon.svg' },
    { ID: 105, opportunity: 'Alpine logistics platform', account: 'Alpine Logistics', stage: 'Negotiation', owner: 'Ada Lovelace', value: 95000, updated: '18 Aug', preview: null },
    { ID: 106, opportunity: 'Tailspin support extension', account: 'Tailspin Toys', stage: 'Won', owner: 'Grace Hopper', value: 18000, updated: '12 Aug', preview: null }
  ];
}

function viewOptions(log) {
  return {
    fields: opportunityFields(),
    data: opportunities(),
    recordId: 'ID',
    titleField: 'opportunity',
    subtitleField: 'account',
    preview: 'preview',
    previewAlt: (record) => `${record.account} preview`,
    link: (record) => `#opportunity-${record.ID}`,
    actions: [
      { id: 'open', label: 'Open', icon: 'eye' },
      { id: 'archive', title: 'Archive opportunity', icon: 'folder' }
    ],
    groupBy: 'stage',
    groupOrder: ['Qualified', 'Proposal', 'Negotiation', 'Won', 'On hold'],
    selectable: 'multi',
    sort: { id: 'value', dir: 'desc' },
    minCardWidth: '17rem',
    maxColumns: 3,
    variant: 'outlined',
    onrecordclick: ({ detail }) => log(`activate #${detail.id}: ${detail.record.opportunity}`),
    onrecordaction: ({ detail }) => log(`${detail.action.id} #${detail.id}`),
    onselectionchange: ({ detail }) => log(`selected: ${detail.ids.join(', ') || 'none'}`),
    onsortchange: ({ detail }) => log(`sort: ${detail.id ?? 'none'} ${detail.dir ?? ''}`.trim()),
    onstatechange: ({ detail }) => log(`state (${detail.reason}): ${JSON.stringify(detail.state)}`)
  };
}

export default {
  title: 'Card view',
  group: 'Data',
  api: ['CardView', 'RecordView'],
  blurb: 'A responsive record collection sharing fields, sort, selection, visibility, order, and '
    + 'serializable state with TableView and KanbanView.',

  examples: [
    {
      title: 'Grouped opportunity cards',
      blurb: 'A native title link, secondary actions, preview fallback, labelled metadata, an '
        + 'explicit empty group, and multi-selection remain separate interactive targets. Focus a '
        + 'card and press Enter to activate it; Space toggles selection.',
      layout: 'stack',
      render: ({ cleanup, log }) => {
        const view = new CardView(null, viewOptions(log));
        cleanup(() => view.destroy());
        return view.toElement();
      }
    },
    {
      title: 'Shared saved-state round trip',
      blurb: 'Only JSON-safe view configuration is saved. Records and rendered values never enter '
        + 'the snapshot, and a state from another record view can be restored without an adapter.',
      layout: 'stack',
      render: ({ cleanup, log }) => {
        let saved = null;
        const view = new CardView(null, {
          ...viewOptions(log),
          groupBy: null,
          maxColumns: 2,
          preview: null,
          actions: [],
          selection: [102]
        });
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
              label: 'Change view',
              onclick: () => view.setFieldVisible('owner', false)
                .setFieldOrder(['value', 'opportunity', 'account', 'stage', 'owner', 'updated', 'preview'])
                .setSort('opportunity', 'asc')
            }),
            button({
              label: 'Restore state',
              onclick: () => saved ? view.setViewState(saved) : log('Save a state first')
            }))
        ];
      }
    },
    {
      title: 'Loading and empty results',
      blurb: 'Loading reserves the card layout with skeletons. Replacing the result with an empty '
        + 'array reveals application-owned empty content without destroying the view.',
      layout: 'stack',
      render: ({ cleanup, log }) => {
        const view = new CardView(null, {
          ...viewOptions(log),
          groupBy: null,
          loadingCount: 3,
          emptyText: 'No opportunities match the current filters.'
        });
        cleanup(() => view.destroy());
        return [
          view.toElement(),
          h('div', { class: 'demo-row' },
            button({ label: 'Show loading', onclick: () => view.setLoading(true) }),
            button({ label: 'Show records', onclick: () => view.setData(opportunities()) }),
            button({ label: 'Show empty', onclick: () => view.setData([]) }))
        ];
      }
    }
  ]
};
