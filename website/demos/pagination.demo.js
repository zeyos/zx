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

  /**
   * Mounts a Table paged by a Pagination, a Load more variant, and the page-window maths.
   * @param {HTMLElement} container Demo stage.
   * @returns {void}
   */
  mount(container) {
    const log = output('Page through the table — every control emits one change event.');
    const rows = invoices(312);

    // 1 — a real Table paged client-side. A server-backed list does the same thing, except that
    //     `offset` and `pageSize` go into the request instead of into slice().
    const table = new Table(null, { columns: COLUMNS, data: [], height: 260, zebra: true });
    const pager = new Pagination(null, {
      total: rows.length,
      pageSize: 25,
      pageSizes: [10, 25, 50],
      onchange: (event) => {
        showPage(event.detail);
        write(log, `change: page ${event.detail.page}/${event.detail.pages} · `
          + `offset ${event.detail.offset} · pageSize ${event.detail.pageSize}`);
      }
    });

    /** @param {{offset: number, pageSize: number}} state Slice to render. @returns {void} */
    function showPage({ offset, pageSize }) {
      table.setData(rows.slice(offset, offset + pageSize));
    }
    showPage(pager.getState());

    // 2 — the same component in append mode, the shape zeyosTable().loadMore() expects.
    const feed = new Table(null, { columns: COLUMNS, data: rows.slice(0, 10), height: 200 });
    const more = new Pagination(null, {
      mode: 'loadmore',
      total: rows.length,
      pageSize: 10,
      showPageSize: false,
      onchange: (event) => {
        // In loadmore mode each change is one more page to append, never a replacement.
        feed.addData(rows.slice(event.detail.offset, event.detail.offset + event.detail.pageSize));
        write(log, `load more: page ${event.detail.page} · offset ${event.detail.offset}`);
      }
    });

    const marker = h('div', {},
      section('Paging a table',
        note('The pager owns no data: it reports which slice the user asked for. page is 1-based, '
          + 'offset is the zero-based first row — exactly what a list query wants next to '
          + 'pageSize. Changing the page size returns to page 1.'),
        table.toElement(),
        pager.toElement(),
        row(
          h('button', {
            class: 'zx-btn',
            type: 'button',
            onclick: () => {
              // Shrinking the total under the user's feet re-clamps the page instead of pointing
              // past the end of the data.
              pager.setTotal(40);
              showPage(pager.getState());
              write(log, `setTotal(40) → page ${pager.getState().page}`);
            }
          }, 'setTotal(40)'),
          h('button', {
            class: 'zx-btn',
            type: 'button',
            onclick: () => {
              pager.setState({ total: rows.length, page: 1 }, { silent: true });
              showPage(pager.getState());
              write(log, 'setState({total: 312, page: 1}, {silent: true})');
            }
          }, 'restore 312 rows'),
          h('button', {
            class: 'zx-btn',
            type: 'button',
            onclick: () => {
              pager.disable();
              write(log, 'disabled — enable() puts every control back');
            }
          }, 'disable()'),
          h('button', {
            class: 'zx-btn',
            type: 'button',
            onclick: () => {
              pager.enable();
              write(log, 'enabled');
            }
          }, 'enable()'))),
      section('Load more',
        note('mode: "loadmore" swaps the numbered pager for one button and a cumulative summary, '
          + 'for feeds that append rather than replace. The button disables itself on the last '
          + 'page, the way zeyosTable()’s hasMore does.'),
        feed.toElement(),
        more.toElement()),
      section('The page window',
        note('paginationRange() is exported next to the component so the window can be reasoned '
          + 'about — and unit-tested — without a DOM. Its width is fixed at '
          + 'boundaries * 2 + siblings * 2 + 3, so the row never jitters as the user walks it.'),
        windowTable()),
      log);

    container.append(marker);
    cleanupWhenRemoved(marker, () => {
      pager.destroy();
      more.destroy();
      table.destroy();
      feed.destroy();
    });
  }
};

/** @returns {HTMLElement} A printed sample of the pure range function. */
function windowTable() {
  const samples = [
    { page: 1, pages: 10, siblings: 1, boundaries: 1 },
    { page: 5, pages: 10, siblings: 1, boundaries: 1 },
    { page: 10, pages: 10, siblings: 1, boundaries: 1 },
    { page: 10, pages: 40, siblings: 2, boundaries: 2 },
    { page: 5, pages: 10, siblings: 0, boundaries: 1 }
  ];
  return h('pre', { style: {
    margin: '0', overflowX: 'auto', border: '1px solid var(--zx-color-border)',
    borderRadius: 'var(--zx-radius-lg)', background: 'var(--zx-color-bg-muted)',
    padding: 'var(--zx-space-4)', fontFamily: 'var(--zx-font-mono)',
    fontSize: 'var(--zx-text-xs)', lineHeight: '1.8'
  } }, samples.map((sample) => `paginationRange(${JSON.stringify(sample)})\n  → `
    + `[${paginationRange(sample).map((entry) => typeof entry === 'number' ? entry : `'${entry}'`).join(', ')}]\n`
  ).join(''));
}

/** @param {...Node} children @returns {HTMLElement} */
function row(...children) {
  return h('div', { style: {
    display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--zx-space-3)'
  } }, children);
}

/** @param {string} title @param {...Node} children @returns {HTMLElement} */
function section(title, ...children) {
  return h('section', { style: {
    display: 'grid', gap: 'var(--zx-space-4)', marginBlockEnd: 'var(--zx-space-6)',
    border: '1px solid var(--zx-color-border)', borderRadius: 'var(--zx-radius-lg)',
    background: 'var(--zx-color-bg-surface)', padding: 'var(--zx-space-5)'
  } }, h('h2', { style: { margin: '0', fontSize: 'var(--zx-text-xl)' } }, title), children);
}

/** @param {string} text @returns {HTMLElement} */
function note(text) {
  return h('p', { style: {
    margin: '0', maxInlineSize: '78ch', color: 'var(--zx-color-text-muted)', lineHeight: '1.7'
  } }, text);
}

/** @param {string} text @returns {HTMLOutputElement} */
function output(text) {
  return /** @type {HTMLOutputElement} */ (h('output', {
    ariaLive: 'polite', style: { display: 'block', color: 'var(--zx-color-text-muted)' }
  }, text));
}

/** @param {HTMLElement} log @param {string} text @returns {void} */
function write(log, text) {
  log.textContent = text;
}

/** @param {Node} marker @param {() => void} cleanup @returns {void} */
function cleanupWhenRemoved(marker, cleanup) {
  const observer = new MutationObserver(() => {
    if (marker.isConnected) return;
    cleanup();
    observer.disconnect();
  });
  observer.observe(document.body, { childList: true, subtree: true });
}
