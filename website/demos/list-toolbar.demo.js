import { TableView, h } from '../../src/index.js';
import { ListToolbar } from '../../src/components/list-toolbar/list-toolbar.js';

const FIELDS = [
  { id: 'subject', label: 'Subject', sortable: true },
  { id: 'customer', label: 'Customer', sortable: true },
  { id: 'status', label: 'Status', width: '8rem' },
  { id: 'updated', label: 'Updated', width: '9rem' }
];

/**
 * The rows a ticket list would be handed. The toolbar owns no data: it reports what the reader
 * asked for and the application answers with a list.
 * @returns {Record<string, unknown>[]}
 */
function tickets() {
  return [
    { ID: 1, subject: 'Invoice layout breaks in print', customer: 'Alpine Works', status: 'Open', updated: '2026-09-18' },
    { ID: 2, subject: 'Import stops at row 4000', customer: 'Danube Systems', status: 'Waiting', updated: '2026-09-17' },
    { ID: 3, subject: 'Second address book missing', customer: 'Kestrel Retail', status: 'Open', updated: '2026-09-17' },
    { ID: 4, subject: 'Price list rounds to two places', customer: 'Nordvik Marine', status: 'Resolved', updated: '2026-09-15' },
    { ID: 5, subject: 'Tax key wrong on credit notes', customer: 'Salzach Bau', status: 'Open', updated: '2026-09-14' },
    { ID: 6, subject: 'Mobile login loops', customer: 'Vela Logistik', status: 'Waiting', updated: '2026-09-12' }
  ];
}

/**
 * Filters the rows the way a client-side list would. A server-backed list sends the query instead
 * and calls setCount() with what came back.
 * @param {Record<string, unknown>[]} rows All rows.
 * @param {string} query Search term.
 * @returns {Record<string, unknown>[]}
 */
function matching(rows, query) {
  const needle = query.trim().toLowerCase();
  if (!needle) return rows;
  return rows.filter((row) => `${row.subject} ${row.customer}`.toLowerCase().includes(needle));
}

export default {
  title: 'List toolbar',
  group: 'Data',
  api: ['ListToolbar'],
  blurb: 'The bar above a record view: one search field, a live result count, the tools that '
    + 'change what the list shows, and the shape switch.',

  examples: [
    {
      title: 'Above a table view',
      blurb: 'The toolbar reports and the application answers: search gives a debounced query, a '
        + 'tool gives its id and, for a toggle, its new pressed state, and the shape switch gives '
        + 'the view the reader picked. bind() is sugar on top — it recognises a record view by '
        + 'its state surface and moves that view’s field chooser up into the bar.',
      layout: 'stack',
      render: ({ cleanup, log }) => {
        const rows = tickets();
        const view = new TableView(null, { fields: FIELDS, data: rows, recordId: 'ID' });
        const toolbar = new ListToolbar(null, {
          search: { placeholder: 'Search tickets…', debounce: 350 },
          count: rows.length,
          countText: (count) => `${count} of ${rows.length} tickets`,
          views: ['auto', 'cards', 'table'],
          tools: [
            { id: 'filters', icon: 'filter', label: 'Filters', badge: 2, pressed: true },
            { id: 'refresh', icon: 'reload', label: 'Refresh' }
          ],
          onsearch: ({ detail }) => {
            const found = matching(rows, detail.value);
            view.setData(found);
            toolbar.setCount(found.length);
            log(`search "${detail.value}" → ${found.length}`);
          },
          onaction: ({ detail }) => {
            if (detail.id === 'refresh') toolbar.setCount(null);
            log(`action ${detail.id}${detail.pressed === null ? '' : ` · pressed ${detail.pressed}`}`);
          },
          onviewchange: ({ detail }) => log(`viewchange ${detail.previous} → ${detail.view}`)
        });
        toolbar.bind(view);
        cleanup(() => [toolbar, view].forEach((component) => component.destroy()));
        return [toolbar.toElement(), view.toElement()];
      }
    },
    {
      title: 'The badge is part of the name',
      blurb: 'A tool showing 2 announces as “Filters (2)”: the number is composed into the '
        + 'button’s accessible name and the badge itself is aria-hidden, so a screen reader '
        + 'reads it once, as part of the control. Once filters live behind a panel, that badge is '
        + 'the only thing on screen saying why the list is showing four rows out of twenty.',
      layout: 'stack',
      render: ({ cleanup, log }) => {
        const toolbar = new ListToolbar(null, {
          search: false,
          tools: [
            { id: 'filters', icon: 'filter', label: 'Filters', badge: 2, pressed: true },
            { id: 'columns', icon: 'fields', label: 'Columns', badge: '5/6' }
          ],
          onaction: ({ detail }) => log(`${detail.id} announces as `
            + `"${toolbar.getTool(detail.id).getAttribute('aria-label')}"`)
        });
        const announce = (id) => log(`${id} announces as `
          + `"${toolbar.getTool(id).getAttribute('aria-label')}"`);
        cleanup(() => toolbar.destroy());
        return [
          toolbar.toElement(),
          h('div', { class: 'demo-row' },
            h('button', {
              type: 'button',
              onclick: () => {
                toolbar.setBadge('filters', 3);
                announce('filters');
              }
            }, 'setBadge(\'filters\', 3)'),
            h('button', {
              type: 'button',
              onclick: () => {
                toolbar.setBadge('filters', null);
                announce('filters');
              }
            }, 'setBadge(\'filters\', null)'))
        ];
      }
    },
    {
      title: 'A count that clears',
      blurb: 'The count line is a live region, so a new number is announced where the reader is. '
        + 'setCount(null) empties it: the previous number describes the previous filters, and a '
        + 'stale count during a load is worse than none.',
      layout: 'stack',
      render: ({ cleanup, log }) => {
        const toolbar = new ListToolbar(null, { search: false, count: 20 });
        cleanup(() => toolbar.destroy());
        return [
          toolbar.toElement(),
          h('div', { class: 'demo-row' },
            h('button', {
              type: 'button',
              onclick: () => {
                toolbar.setCount(null);
                log('setCount(null) → the line is empty while the request is in flight');
              }
            }, 'setCount(null)'),
            h('button', {
              type: 'button',
              onclick: () => {
                toolbar.setCount(4);
                log('setCount(4)');
              }
            }, 'setCount(4)'),
            h('button', {
              type: 'button',
              onclick: () => {
                toolbar.setCount(0);
                log('setCount(0) — no rows is a count like any other');
              }
            }, 'setCount(0)'))
        ];
      }
    }
  ]
};
