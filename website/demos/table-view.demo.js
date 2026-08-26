import { badge, button, h, TableView } from '../../src/index.js';

// The same record shape can be passed unchanged to TableView, CardView, or KanbanView.
function opportunityRecords() {
  return [
    { id: 'opp-1042', customer: 'Nordwind GmbH', summary: 'Vienna office rollout', owner: 'Lea Berger', stage: 'Qualified', value: 48600, due: '2026-09-12', progress: 35 },
    { id: 'opp-1048', customer: 'Aurora AB', summary: 'Fleet service renewal', owner: 'Milan Petrović', stage: 'Proposal', value: 28400, due: '2026-09-04', progress: 70 },
    { id: 'opp-1051', customer: 'Lumen Works', summary: 'Warehouse automation', owner: 'Lea Berger', stage: 'Discovery', value: 73200, due: '2026-10-18', progress: 20 },
    { id: 'opp-1057', customer: 'Alpenglow AG', summary: 'Support contract', owner: 'Samira Okafor', stage: 'Negotiation', value: 19800, due: '2026-08-30', progress: 88 },
    { id: 'opp-1063', customer: 'Copper & Pine', summary: 'Retail analytics pilot', owner: 'Milan Petrović', stage: 'Proposal', value: 35600, due: '2026-09-28', progress: 55 },
    { id: 'opp-1069', customer: 'Studio Nør', summary: 'Collaboration workspace', owner: 'Samira Okafor', stage: 'Discovery', value: 24100, due: '2026-10-08', progress: 12 }
  ];
}

// Shared fields carry common access/render/sort behavior; view.table adds Table-only capabilities.
function opportunityFields() {
  return [
    { id: 'customer', label: 'Customer', sortable: true, view: { table: { width: '1.4fr', popin: false } } },
    { id: 'summary', label: 'Opportunity', sortable: true, view: { table: { width: '2fr', editable: true } } },
    { id: 'owner', label: 'Owner', sortable: true, view: { table: { width: '1.2fr' } } },
    {
      id: 'stage', label: 'Stage', sortable: true, view: { table: { width: '1fr' } },
      render: (_record, _index, value) => badge({
        label: String(value),
        kind: value === 'Negotiation' ? 'warning' : value === 'Proposal' ? 'info' : 'neutral'
      })
    },
    {
      id: 'value', label: 'Value', sortable: true,
      view: { table: { width: '1fr', type: 'currency', currency: 'EUR', decimals: 0, align: 'end', editable: 'number' } }
    },
    { id: 'due', label: 'Due', sortable: true, view: { table: { width: '1fr', editable: 'date' } } },
    {
      id: 'progress', label: 'Progress', sortable: true, visible: false,
      view: { table: { width: '1fr', type: 'percent', decimals: 0 } },
      get: (record) => record.progress / 100
    }
  ];
}

export default {
  title: 'Table view',
  group: 'Data',
  api: ['TableView', 'RecordView', 'Table'],
  blurb: 'A schema-friendly record view that composes the full Table: one field contract drives sorting, selection, editable cells, visibility, and stable column order.',
  examples: [
    {
      title: 'Operational records and a saved view state',
      blurb: 'Open Columns to show, hide, or reorder fields with buttons or arrow keys. State contains configuration only—records and rendered values are never persisted.',
      layout: 'stack',
      render: ({ cleanup, log }) => {
        let savedState = null;
        const view = new TableView(null, {
          fields: opportunityFields(),
          data: opportunityRecords(),
          recordId: 'id',
          selectable: 'multi',
          sort: { id: 'due', dir: 'asc' },
          hiddenFields: ['progress'],
          table: {
            stickyHeader: true,
            height: 320,
            responsive: 'sm',
            editMode: 'cell',
            editTrigger: 'single',
            zebra: true,
            oneditcommit: ({ detail }) => log(`editcommit ${detail.id}: ${JSON.stringify(detail.changes)}`)
          },
          onrecordclick: ({ detail }) => log(`recordclick ${detail.id}: ${detail.record.customer}`),
          onsortchange: ({ detail }) => log(`sortchange ${detail.id ?? 'none'} ${detail.dir ?? ''}`),
          onselectionchange: ({ detail }) => log(`selectionchange [${detail.ids.join(', ')}]`),
          onfieldvisibilitychange: ({ detail }) => log(`visible [${detail.visible.join(', ')}]`),
          onfieldorderchange: ({ detail }) => log(`order [${detail.order.join(', ')}]`),
          onstatechange: ({ detail }) => log(`statechange ${detail.reason}`)
        });
        cleanup(() => view.destroy());

        return [
          view.toElement(),
          h('div', { class: 'demo-row' },
            button({
              label: 'Save state',
              onclick: () => {
                savedState = view.getViewState();
                log(`saved ${JSON.stringify(savedState)}`);
              }
            }),
            button({
              label: 'Change layout',
              onclick: () => {
                view.setFieldVisible('owner', false);
                view.moveField('value', 'customer', 'before');
                view.setSort('value', 'desc');
              }
            }),
            button({
              label: 'Restore saved state',
              onclick: () => savedState ? view.setViewState(savedState) : log('Save a state first')
            }),
            button({
              label: 'Low-level Table API',
              onclick: () => log(`Table columns: ${view.getTable().getColumnOrder().join(' → ')}`)
            })),
          h('p', { class: 'demo-caption' }, 'Click an editable cell to change it. On narrow containers the composed Table uses its responsive stacked presentation.')
        ];
      }
    }
  ]
};
