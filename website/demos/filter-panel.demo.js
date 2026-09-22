import { FilterPanel, Sheet, button, h } from '../../src/index.js';

/**
 * The field map a ZeyOS ticket list publishes with its first page — the panel is built from this
 * and nothing else.
 * @returns {Record<string, import('../../src/components/filter-panel/filter-panel.js').FilterPanelField>}
 */
function ticketFilters() {
  return {
    subject: { type: 'text', label: 'Subject', placeholder: 'Subject or ticket number' },
    status: {
      type: 'select',
      label: 'Status',
      options: [
        { value: 0, label: 'Draft' },
        { value: 1, label: 'Open' },
        { value: 2, label: 'Waiting' },
        { value: 3, label: 'Closed' }
      ]
    },
    assignee: { type: 'select', label: 'Assignee', options: agents() },
    created: { type: 'date:range', label: 'Created' },
    due: { type: 'date', label: 'Due on' },
    amount: { type: 'float:range', label: 'Amount', min: 0, max: 10000 },
    priority: { type: 'int', label: 'Priority', min: 0, max: 9 },
    geofence: { type: 'polygon', label: 'Geofence' }
  };
}

/**
 * Twelve values, which is what pushes the select past the threshold where its checklist earns a
 * search box.
 * @returns {{ID: number, name: string}[]}
 */
function agents() {
  return [
    { ID: 1, name: 'Ada Bauer' }, { ID: 2, name: 'Bea Cortez' }, { ID: 3, name: 'Cem Demir' },
    { ID: 4, name: 'Dora Ellis' }, { ID: 5, name: 'Emil Frey' }, { ID: 6, name: 'Fiona Gauss' },
    { ID: 7, name: 'Georg Haas' }, { ID: 8, name: 'Hana Ito' }, { ID: 9, name: 'Iris Jung' },
    { ID: 10, name: 'Jonas Klein' }, { ID: 11, name: 'Kira Lang' }, { ID: 12, name: 'Leo März' }
  ];
}

export default {
  title: 'FilterPanel',
  group: 'Data',
  blurb: 'The filter form a data-driven list needs: field metadata in, a query object out. '
    + 'DataFilter filters rows already in the browser and Filter builds an operator AST; this one '
    + 'renders whatever a list endpoint published and hands back what that endpoint expects.',

  examples: [
    {
      title: 'Filters from a list response',
      blurb: 'Every control comes from the field map, including the one the panel cannot render: '
        + 'an unknown type is a labelled placeholder naming it, never a silent omission. A select '
        + 'is multi-valued, because "open or waiting" is the common request, and it gets a search '
        + 'box only once there are enough options to need one. Draft mode is the default: the '
        + 'panel collects edits and emits apply once, which is what keeps a list from reloading '
        + 'under the panel being read. clear() is the exception that commits — emptying the '
        + 'controls and leaving the list filtered would show no filters over filtered records. '
        + 'reset() is the one that only restores the controls, which is what a Cancel wants.',
      layout: 'stack',
      width: '420px',
      render: ({ cleanup, log }) => {
        const panel = new FilterPanel(null, {
          fields: ticketFilters(),
          order: ['status', 'subject', 'assignee', 'created', 'amount', 'priority', 'due', 'geofence'],
          value: { status: [1, 2], amount: { from: 0 } },
          serialize: 'seconds',
          onchange: ({ detail }) => log(`change ${detail.field ?? '(all)'}`),
          onapply: ({ detail }) => {
            log(`apply ${JSON.stringify(detail.value)}`);
            sheet.close();
          }
        });
        const sheet = new Sheet(null, {
          side: 'end',
          title: 'Filter tickets',
          size: 380,
          content: panel.toElement(),
          buttons: [{ label: 'Cancel', action: 'close' }]
        });
        cleanup(() => [sheet, panel].forEach((component) => component.destroy()));
        return [
          h('div', { class: 'demo-row' },
            button({ label: 'Filter tickets', kind: 'primary', onclick: () => sheet.open() }),
            button({ label: 'getValue()', onclick: () => log(JSON.stringify(panel.getValue())) }),
            button({
              label: 'setValue(…)',
              onclick: () => panel.setValue({ status: [3], created: { to: '2026-03-31' }, priority: 0 })
            }),
            button({ label: 'clear()', onclick: () => panel.clear() }),
            button({ label: 'reset()', onclick: () => panel.reset() }))
        ];
      }
    },
    {
      title: 'Applying on every edit',
      blurb: 'mode: "live" drops the Apply button and applies each committed edit instead. Worth '
        + 'it when the rows are already in the browser; against an API it costs a request per '
        + 'edit, which is why draft is the default rather than this.',
      layout: 'stack',
      width: '420px',
      render: ({ cleanup, log }) => {
        const panel = new FilterPanel(null, {
          mode: 'live',
          fields: {
            query: { type: 'text', label: 'Search', placeholder: 'Any word' },
            stock: { type: 'int:range', label: 'In stock', min: 0, max: 999 }
          },
          onapply: ({ detail }) => log(`apply ${JSON.stringify(detail.value)}`)
        });
        cleanup(() => panel.destroy());
        return [panel.toElement()];
      }
    },
    {
      title: 'An instance that configures no filters',
      blurb: 'An empty field map is the ordinary case for a settings section nobody has filtered '
        + 'yet, so it renders emptyText and says so rather than reading as a broken panel.',
      layout: 'stack',
      width: '420px',
      render: ({ cleanup }) => {
        const panel = new FilterPanel(null, {
          fields: {},
          emptyText: 'This list publishes no filters.'
        });
        cleanup(() => panel.destroy());
        return [panel.toElement()];
      }
    }
  ]
};
