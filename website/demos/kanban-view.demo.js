import { KanbanView, badge, button, h, icon } from '../../src/index.js';

// One projection can feed TableView, CardView, or KanbanView. Presentation-only preview fields may
// stay hidden while title, group, and board fields remain available to their resolvers.
function opportunityFields() {
  const money = new Intl.NumberFormat('en', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
  return [
    { id: 'opportunity', label: 'Opportunity', sortable: true },
    {
      id: 'account', label: 'Account', sortable: true,
      view: { card: { slot: 'eyebrow-start' } }
    },
    { id: 'stage', label: 'Stage', sortable: true },
    { id: 'owner', label: 'Owner', sortable: true },
    {
      id: 'value', label: 'Value', sortable: true, type: 'money',
      render: (_record, _index, value) => money.format(Number(value) || 0),
      sortValue: (record) => record.value
    },
    {
      id: 'updated', label: 'Updated', sortable: true,
      view: { card: { slot: 'eyebrow-end' } },
      render: (_record, _index, value) => h('span', {}, icon('calendar', { size: 11 }), String(value))
    },
    {
      id: 'status', label: 'Delivery status',
      view: { card: { slot: 'title-prefix' } },
      render: (_record, _index, value) => badge({
        dot: true,
        kind: value === 'At risk' ? 'danger' : value === 'Needs review' ? 'warning' : 'success',
        size: 'sm',
        title: String(value)
      })
    },
    { id: 'preview', label: 'Preview', visible: false }
  ];
}

// The same realistic opportunities used by CardView include long text, a failed preview, and
// records without media so board cards prove the shared renderer rather than a Kanban-only shape.
function opportunities() {
  return [
    { ID: 101, opportunity: 'Northwind European workspace renewal', account: 'Northwind GmbH', stage: 'Qualified', owner: 'Ada Lovelace', value: 48000, updated: 'Today, 09:42', status: 'On track', preview: './assets/zeyos-mark.svg' },
    { ID: 102, opportunity: 'Aurora fleet analytics', account: 'Aurora AB', stage: 'Proposal', owner: 'Grace Hopper', value: 73500, updated: 'Yesterday', status: 'Needs review', preview: './assets/missing-opportunity-preview.webp' },
    { ID: 103, opportunity: 'Contoso service rollout', account: 'Contoso Ltd.', stage: 'Proposal', owner: 'Ada Lovelace', value: 29800, updated: '22 Aug', status: 'On track', preview: null },
    { ID: 104, opportunity: 'Fabrikam office automation', account: 'Fabrikam AG', stage: 'Negotiation', owner: 'Grace Hopper', value: 112000, updated: '21 Aug', status: 'At risk', preview: './assets/zx-mark.svg' },
    { ID: 105, opportunity: 'Alpine logistics platform', account: 'Alpine Logistics', stage: 'Negotiation', owner: 'Ada Lovelace', value: 95000, updated: '18 Aug', status: 'On track', preview: null },
    { ID: 106, opportunity: 'Tailspin support extension', account: 'Tailspin Toys', stage: 'Won', owner: 'Grace Hopper', value: 18000, updated: '12 Aug', status: 'Complete', preview: null }
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

// A workflow board adds the policy the pipeline actually runs on: `from` is the transition
// allow-list of columns a card may arrive from, `limit` is capacity, and `laneLimits` refines that
// capacity per lane. With `wipPolicy: 'block'` a violation refuses the move instead of warning.
const WORKFLOW_STAGES = [
  { id: 'Qualified', label: 'Qualified', limit: 3 },
  { id: 'Proposal', label: 'Proposal', limit: 3, from: ['Qualified', 'Negotiation'] },
  {
    id: 'Negotiation', label: 'Negotiation', limit: 2, from: ['Proposal'],
    laneLimits: { 'Ada Lovelace': 1, 'Grace Hopper': 1 },
    accept: (record) => Number(record.value) >= 25000
  },
  { id: 'Won', label: 'Won', from: ['Negotiation'] }
];

const OWNERS = [
  { id: 'Ada Lovelace', label: 'Ada Lovelace' },
  { id: 'Grace Hopper', label: 'Grace Hopper' }
];

// Ordered card rules are pure presentation. The first match paints the card's inline marker; every
// match with a label adds a badge, and each rule's description joins the card's accessible
// description so the colour is never the only signal.
const RULES = [
  {
    id: 'at-risk',
    when: (record) => record.status === 'At risk',
    tone: 'danger',
    label: 'At risk',
    description: 'Flagged at risk'
  },
  {
    id: 'major',
    when: (record) => Number(record.value) >= 90000,
    tone: 'warning',
    label: 'Major deal',
    description: 'Above the ninety thousand euro review threshold'
  },
  {
    id: 'review',
    when: (record) => record.status === 'Needs review',
    tone: 'info',
    label: 'Needs review',
    description: 'Waiting on review'
  }
];

function viewOptions(log, {
  swimlanes = false,
  showPreviews = false,
  showSubtitle = false,
  showValue = false,
  selectable = false
} = {}) {
  return {
    fields: opportunityFields(),
    data: opportunities(),
    recordId: 'ID',
    columnBy: 'stage',
    columns: STAGES,
    ...(swimlanes ? { swimlaneBy: 'owner', swimlanes: OWNERS } : {}),
    titleField: 'opportunity',
    subtitleField: showSubtitle ? 'account' : null,
    preview: showPreviews ? 'preview' : null,
    previewAlt: (record) => `${record.account} preview`,
    link: (record) => `#opportunity-${record.ID}`,
    actions: [{ id: 'open', label: 'Open', icon: 'eye' }],
    selectable,
    hiddenFields: ['stage', 'owner', 'preview', ...(showValue ? [] : ['value'])],
    moveMode: 'local',
    showCounts: true,
    showEmptyColumns: true,
    onrecordclick: ({ detail }) => log(`activate #${detail.id}: ${detail.record.opportunity}`),
    onrecordaction: ({ detail }) => log(`${detail.action.id} #${detail.id}`),
    onselectionchange: ({ detail }) => log(`selected: ${detail.ids.join(', ') || 'none'}`),
    onrecordmove: ({ detail }) => log(`move ${detail.ids.join(', ')}: ${detail.from.column}/${detail.from.lane} → ${detail.to.column}/${detail.to.lane} @ ${detail.to.index}${detail.limitExceeded ? ' (over WIP)' : ''}`),
    onmovereject: ({ detail }) => log(`rejected (${detail.reason}): ${detail.message}`),
    onstatechange: ({ detail }) => log(`state (${detail.reason}): ${JSON.stringify(detail.state)}`)
  };
}

export default {
  title: 'Kanban view',
  group: 'Data',
  api: ['KanbanView', 'RecordView'],
  blurb: 'A semantic opportunity board sharing fields, cards, sort, selection, and serializable '
    + 'configuration with the other record views. Cards move by pointer, touch, keyboard, context '
    + 'menu, or public API through one policy and one commit path.',

  examples: [
    {
      title: 'Compact opportunity pipeline',
      blurb: 'A quiet account/date eyebrow and status-led title keep the default board scannable. '
        + 'Drag a card with the mouse, press and hold on a touch screen, or press Enter/Space on '
        + 'its move handle to grab, arrows to choose a target, then Enter/Space to drop.',
      layout: 'stack',
      render: ({ cleanup, log }) => {
        const view = new KanbanView(null, viewOptions(log));
        cleanup(() => view.destroy());
        return view.toElement();
      }
    },
    {
      title: 'Workflow policy, rules, and history',
      blurb: 'Transitions, capacity, and eligibility are checked before the cancelable move event, '
        + 'so a refused move writes nothing and says why. Ordered card rules mark the cards a '
        + 'reviewer should see first, and every committed local move is undoable. Try dragging '
        + 'a card straight from Qualified to Won — the board will refuse it.',
      layout: 'stack',
      render: ({ cleanup, log }) => {
        const view = new KanbanView(null, {
          ...viewOptions(log, { showValue: true }),
          columns: WORKFLOW_STAGES,
          wipPolicy: 'block',
          rules: RULES,
          searchControl: true,
          historyControls: true,
          allowAdd: true,
          contextMenu: true,
          columnHeight: '22rem',
          onrecordadd: ({ detail }) => log(`add to ${detail.columnId}`),
          onsearchchange: ({ detail }) => log(`search: ${detail.search || '(none)'}`),
          onhistorychange: ({ detail }) => log(`history: ${detail.depth.undo} undo, ${detail.depth.redo} redo`)
        });
        cleanup(() => view.destroy());
        return view.toElement();
      }
    },
    {
      title: 'Swim lanes, multi-card moves, and saved state',
      blurb: 'Optional thumbnails, subtitles, metadata, selection, actions, swim lanes, and '
        + 'JSON-safe configuration remain available without making every board card carry that '
        + 'weight. Selecting several cards and moving one moves them all as a single step.',
      layout: 'stack',
      render: ({ cleanup, log }) => {
        let saved = null;
        const view = new KanbanView(null, viewOptions(log, {
          swimlanes: true,
          showPreviews: true,
          showSubtitle: true,
          showValue: true,
          selectable: 'multi'
        }));
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
            }),
            button({
              label: 'Move selection to Won',
              onclick: () => {
                const ids = view.getSelectionIds();
                if (ids.length) view.moveRecords(ids, { column: 'Won' });
                else log('Select one or more cards first');
              }
            }),
            button({ label: 'Undo', onclick: () => view.undo() }),
            button({ label: 'Redo', onclick: () => view.redo() }))
        ];
      }
    },
    {
      title: 'Replaced presentation',
      blurb: 'Render hooks replace card content, workflow headers, lane headers, empty states, and '
        + 'the drag preview while the board keeps the managed shell: the list item, its selection '
        + 'control, action group, move handle, drop targets, and collapse control never change.',
      layout: 'stack',
      render: ({ cleanup, log }) => {
        const money = new Intl.NumberFormat('en', {
          style: 'currency', currency: 'EUR', maximumFractionDigits: 0
        });
        const view = new KanbanView(null, {
          ...viewOptions(log),
          fieldControls: false,
          renderCard: ({ record }) => h('div', {},
            h('p', { class: 'zx-record-card__title' }, record.opportunity),
            h('p', { class: 'zx-record-card__subtitle' },
              `${record.account} · ${money.format(record.value)}`)),
          renderColumnHeader: ({ column, count }) => h('span', {
            class: 'zx-kanban-view__column-label'
          }, icon('list', { size: 12 }), ` ${column.label} `,
          badge({ label: String(count), kind: 'neutral', size: 'sm' })),
          renderColumnEmpty: ({ column }) => h('span', {}, `Nothing in ${column.label} yet`),
          renderDragPreview: ({ records, count }) => h('span', {},
            icon('drag', { size: 11 }),
            count > 1 ? ` ${count} opportunities` : ` ${records[0].opportunity}`)
        });
        cleanup(() => view.destroy());
        return view.toElement();
      }
    }
  ]
};
