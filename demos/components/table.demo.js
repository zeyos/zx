import { Table, h } from '../../src/index.js';

const sectionStyle = {
  display: 'grid',
  gap: 'var(--zx-space-3)',
  marginBlockEnd: 'var(--zx-space-8)',
  border: '1px solid var(--zx-color-border)',
  borderRadius: 'var(--zx-radius-lg)',
  background: 'var(--zx-color-bg-surface)',
  padding: 'var(--zx-space-5)'
};

const rowStyle = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: 'var(--zx-space-3)'
};

const logStyle = {
  margin: '0',
  color: 'var(--zx-color-text-muted)',
  fontFamily: 'var(--zx-font-mono)',
  whiteSpace: 'pre-wrap'
};

const amountFormatter = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'EUR' });

export default {
  title: 'Table',
  group: 'Data',

  /**
   * Mounts sortable, selectable, server-sort, sticky-header, and 5,000-row examples.
   * @param {HTMLElement} container Demo stage.
   * @returns {void}
   */
  mount(container) {
    const data = makeRows(30);
    const components = [];
    const marker = h('div', {},
      staticExample(data, components),
      performanceExample(components),
      serverSortExample(data, components),
      stickyExample(data, components)
    );
    container.append(marker);

    const observer = new MutationObserver(() => {
      if (marker.isConnected) return;
      components.forEach((component) => component.destroy());
      observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }
};

/** @param {Array<Record<string, any>>} data @param {Table[]} components @returns {HTMLElement} */
function staticExample(data, components) {
  const selectionLog = h('output', { style: logStyle, ariaLive: 'polite' }, 'No rows selected.');
  const rowLog = h('output', { style: logStyle, ariaLive: 'polite' }, 'Click a row to see its event.');
  const table = new Table(null, {
    columns: fullColumns(),
    data,
    rowId: 'id',
    selectable: 'multi',
    sort: { id: 'name', dir: 'asc' },
    onselectionchange: (event) => {
      selectionLog.textContent = event.detail.ids.length ?
        `Selected: ${event.detail.ids.join(', ')}` : 'No rows selected.';
    },
    onrowclick: (event) => {
      rowLog.textContent = `rowclick: #${event.detail.id} ${event.detail.row.name} (index ${event.detail.index})`;
    }
  });
  components.push(table);
  return section('30 rows: local sort, custom cells, and multi-select',
    h('p', {}, 'Sort dates, numbers, or names. Check a row, then Shift+click another checkbox for a range.'),
    table.toElement(),
    selectionLog,
    rowLog
  );
}

/** @param {Table[]} components @returns {HTMLElement} */
function performanceExample(components) {
  const readout = h('output', { style: logStyle, ariaLive: 'polite' });
  const table = new Table(null, {
    columns: [
      { id: 'id', label: 'ID', sortable: true, width: '90px', align: 'right' },
      { id: 'name', label: 'Name', sortable: true, width: '2fr' },
      { id: 'amount', label: 'Amount', sortable: true, width: '1fr', align: 'right', render: (row) => formatAmount(row.amount) },
      { id: 'date', label: 'Date', sortable: true, width: '1fr', render: (row) => formatDateCompact(row.date) }
    ],
    data: [],
    rowId: 'id',
    height: 340,
    sort: { id: 'id', dir: 'asc' }
  });
  components.push(table);
  let generation = 0;

  /** @returns {void} */
  function regenerate() {
    generation += 1;
    const rows = makeRows(5000, generation * 5000);
    const started = performance.now();
    table.setData(rows);
    const elapsed = performance.now() - started;
    readout.textContent = `Rendered 5,000 rows in ${elapsed.toFixed(1)} ms`;
  }

  const button = h('button', { type: 'button', onclick: regenerate }, 'Regenerate 5,000 rows');
  regenerate();
  return section('5,000-row render and sort',
    h('div', { style: rowStyle }, button, readout),
    table.toElement()
  );
}

/** @param {Array<Record<string, any>>} data @param {Table[]} components @returns {HTMLElement} */
function serverSortExample(data, components) {
  const log = h('output', { style: logStyle, ariaLive: 'polite' }, 'Header clicks emit only; row order stays unchanged.');
  const table = new Table(null, {
    columns: [
      { id: 'id', label: 'ID', sortable: true, width: '90px' },
      { id: 'name', label: 'Name', sortable: true, width: '2fr' },
      { id: 'amount', label: 'Amount', sortable: true, width: '1fr', align: 'right', render: (row) => formatAmount(row.amount) }
    ],
    data: data.slice(0, 8),
    rowId: 'id',
    sortMode: 'server',
    onsort: (event) => {
      log.textContent = `Server request would use: ${event.detail.id} ${event.detail.dir}`;
    }
  });
  components.push(table);
  return section('Server-sort mode', table.toElement(), log);
}

/** @param {Array<Record<string, any>>} data @param {Table[]} components @returns {HTMLElement} */
function stickyExample(data, components) {
  const table = new Table(null, {
    columns: [
      { id: 'id', label: 'ID', width: '100px' },
      { id: 'name', label: 'Long customer name', width: '260px' },
      { id: 'category', label: 'Category', width: '180px' },
      { id: 'amount', label: 'Amount', width: '180px', align: 'right', render: (row) => formatAmount(row.amount) },
      { id: 'notes', label: 'Notes', width: '360px' }
    ],
    data,
    rowId: 'id',
    height: 230,
    stickyHeader: true
  });
  components.push(table);
  return section('Height-constrained sticky header',
    h('p', {}, 'Scroll vertically and horizontally; the header remains part of the same table.'),
    table.toElement()
  );
}

/** @returns {Array<Record<string, any>>} */
function makeRows(count, offset = 0) {
  const categories = ['Hardware', 'Services', 'Office'];
  const statuses = ['Paid', 'Open', 'Late'];
  const notes = ['Annual account renewal', 'Priority delivery requested', 'Includes installation'];
  return Array.from({ length: count }, (_, index) => {
    const number = offset + index + 1;
    return {
      id: number,
      name: `Customer ${String(number).padStart(4, '0')}`,
      category: categories[number % categories.length],
      amount: (number * 73) % 2400 + 49.5,
      date: new Date(2026, number % 12, number % 27 + 1),
      status: statuses[number % statuses.length],
      notes: notes[number % notes.length]
    };
  });
}

/** @returns {Array<Record<string, any>>} */
function fullColumns() {
  return [
    { id: 'id', label: 'ID', sortable: true, width: '80px', align: 'right' },
    { id: 'name', label: 'Name', sortable: true, width: '2fr' },
    { id: 'category', label: 'Category', sortable: true, width: '1fr' },
    { id: 'amount', label: 'Amount', sortable: true, width: '1fr', align: 'right', render: (row) => formatAmount(row.amount) },
    { id: 'date', label: 'Date', sortable: true, width: '1fr', render: (row) => row.date.toLocaleDateString() },
    { id: 'status', label: 'Status', sortable: true, width: '1fr', render: (row) => statusChip(row.status) }
  ];
}

/** @param {string} status @returns {HTMLElement} */
function statusChip(status) {
  const palette = status === 'Paid' ?
    ['var(--zx-color-success-bg)', 'var(--zx-color-success)'] :
    status === 'Late' ?
      ['var(--zx-color-danger-bg)', 'var(--zx-color-danger)'] :
      ['var(--zx-color-warning-bg)', 'var(--zx-color-warning)'];
  return h('span', {
    style: {
      display: 'inline-block',
      borderRadius: 'var(--zx-radius-full)',
      background: palette[0],
      color: palette[1],
      padding: 'var(--zx-space-1) var(--zx-space-2)',
      fontSize: 'var(--zx-text-sm)',
      fontWeight: '650'
    }
  }, status);
}

/** @param {number} amount @returns {string} */
function formatAmount(amount) {
  return amountFormatter.format(amount);
}

/** @param {Date} date @returns {string} */
function formatDateCompact(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** @param {string} title @param {...Node} children @returns {HTMLElement} */
function section(title, ...children) {
  return h('section', { style: sectionStyle }, h('h2', { style: { margin: '0' } }, title), children);
}
