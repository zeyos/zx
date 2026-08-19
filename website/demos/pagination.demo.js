import { Pagination, Table, h, paginationRange } from '../../src/index.js';

const COMPANIES = ['Alpine Works', 'Danube Systems', 'Kestrel Retail', 'Nordvik Marine',
  'Salzach Bau', 'Tramontane', 'Vela Logistik', 'Wienerwald Energie'];
const STATES = ['open', 'paid', 'overdue'];
const currency = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'EUR' });

/**
 * Builds a deterministic pretend result set — the rows a server would hand back page by page.
 * @param {number} count Number of rows.
 * @returns {Record<string, unknown>[]}
 */
function invoices(count) {
  return Array.from({ length: count }, (_row, index) => ({
    ID: index + 1,
    number: `IN-2026-${String(index + 1).padStart(4, '0')}`,
    company: COMPANIES[index % COMPANIES.length],
    state: STATES[index % STATES.length],
    amount: 180 + ((index * 137) % 9000)
  }));
}

const COLUMNS = [
  { id: 'number', label: 'Invoice', width: '9rem' },
  { id: 'company', label: 'Customer' },
  { id: 'state', label: 'State', width: '7rem' },
  {
    id: 'amount',
    label: 'Amount',
    width: '9rem',
    align: 'end',
    render: (row) => currency.format(Number(row.amount))
  }
];

export default {
  title: 'Pagination',
  group: 'Data',
  blurb: 'The footer bar of a server-backed list: a page window that never changes width, a '
    + 'page-size select, a row summary, and an append-style Load more mode.',

  examples: [
    {
      title: 'Paging a table',
      blurb: 'The pager owns no data — it reports which slice the reader asked for. page is '
        + '1-based and offset the zero-based first row, which is exactly what a list query wants '
        + 'next to pageSize. Changing the page size returns to page 1.',
      layout: 'stack',
      render: ({ cleanup, log }) => {
        const rows = invoices(312);
        const table = new Table(null, { columns: COLUMNS, data: [], height: 260, zebra: true });
        const pager = new Pagination(null, {
          total: rows.length,
          pageSize: 25,
          pageSizes: [10, 25, 50],
          onchange: ({ detail }) => {
            table.setData(rows.slice(detail.offset, detail.offset + detail.pageSize));
            log(`change page ${detail.page}/${detail.pages} \u00b7 offset ${detail.offset} `
              + `\u00b7 pageSize ${detail.pageSize}`);
          }
        });
        const state = pager.getState();
        table.setData(rows.slice(state.offset, state.offset + state.pageSize));
        cleanup(() => [table, pager].forEach((component) => component.destroy()));
        return [table.toElement(), pager.toElement()];
      }
    },
    {
      title: 'Load more',
      blurb: 'mode: "loadmore" replaces the page window with a single button, and each change is '
        + 'one more page to append rather than a replacement — the shape an infinite feed needs, '
        + 'and what zeyosTable().loadMore() drives.',
      layout: 'stack',
      render: ({ cleanup, log }) => {
        const rows = invoices(312);
        const table = new Table(null, { columns: COLUMNS, data: rows.slice(0, 10), height: 200 });
        const more = new Pagination(null, {
          mode: 'loadmore',
          total: rows.length,
          pageSize: 10,
          showPageSize: false,
          onchange: ({ detail }) => {
            table.addData(rows.slice(detail.offset, detail.offset + detail.pageSize));
            log(`load more: page ${detail.page} \u00b7 offset ${detail.offset}`);
          }
        });
        cleanup(() => [table, more].forEach((component) => component.destroy()));
        return [table.toElement(), more.toElement()];
      }
    },
    {
      title: 'Reacting to a changed total',
      blurb: 'setTotal() re-clamps the current page instead of leaving it pointing past the end '
        + 'of the data. setState(\u2026, {silent: true}) restores a state without emitting, for when '
        + 'the caller already has the rows.',
      layout: 'stack',
      render: ({ cleanup, log }) => {
        const rows = invoices(312);
        const table = new Table(null, { columns: COLUMNS, data: [], height: 200, zebra: true });
        const pager = new Pagination(null, { total: rows.length, pageSize: 25 });
        const show = () => {
          const { offset, pageSize } = pager.getState();
          table.setData(rows.slice(offset, offset + pageSize));
        };
        pager.on('change', show);
        show();
        cleanup(() => [table, pager].forEach((component) => component.destroy()));
        return [
          table.toElement(),
          pager.toElement(),
          h('div', { class: 'demo-row' },
            h('button', {
              type: 'button',
              onclick: () => {
                pager.setTotal(40);
                show();
                log(`setTotal(40) \u2192 page ${pager.getState().page}`);
              }
            }, 'setTotal(40)'),
            h('button', {
              type: 'button',
              onclick: () => {
                pager.setState({ total: rows.length, page: 1 }, { silent: true });
                show();
                log('setState({total: 312, page: 1}, {silent: true})');
              }
            }, 'restore 312 rows'))
        ];
      }
    },
    {
      title: 'The page window',
      blurb: 'paginationRange() is the exported helper behind the button row. It always returns '
        + 'the same number of entries, with "\u2026" standing in for the pages it skipped, so the bar '
        + 'never changes width as the reader moves through it.',
      render: () => h('pre', {
        style: {
          margin: '0', overflowX: 'auto', inlineSize: '100%',
          fontFamily: 'var(--zx-font-mono)', fontSize: 'var(--zx-text-xs)', lineHeight: '1.8'
        }
      }, [
        { page: 1, pages: 12 },
        { page: 6, pages: 12 },
        { page: 12, pages: 12 },
        { page: 3, pages: 4 }
      ].map((sample) => `paginationRange(${JSON.stringify(sample)})\n  \u2192 [`
        + `${paginationRange(sample).map((entry) => typeof entry === 'number' ? entry : `'${entry}'`).join(', ')}]\n`).join(''))
    }
  ]
};
