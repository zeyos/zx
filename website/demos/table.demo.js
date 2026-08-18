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
   * Mounts sortable, selectable, editable, server-sort, sticky-header, and 5,000-row examples.
   * @param {HTMLElement} container Demo stage.
   * @returns {void}
   */
  mount(container) {
    const data = makeRows(30);
    const components = [];
    const marker = h('div', {},
      staticExample(data, components),
      cellEditExample(components),
      rowEditExample(components),
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
function cellEditExample(components) {
  const log = eventLog();
  const table = new Table(null, {
    columns: editableColumns(),
    data: makeEditableRows(),
    rowId: 'id',
    editMode: 'cell',
    ...editLogHandlers(log)
  });
  components.push(table);

  const focusCell = h('button', {
    type: 'button',
    onclick: () => table.startEdit(2, 'name')
  }, 'startEdit(2, "name")');
  const cancel = h('button', { type: 'button', onclick: () => table.cancelEdit() }, 'cancelEdit()');

  return section('Cell editing',
    h('p', {}, 'Double-click a cell, or focus one and press Enter or F2. Enter commits, Escape ' +
      'cancels, Tab commits and walks to the next editable cell. "Notes" refuses to be empty, and ' +
      '"ID" is read-only.'),
    table.toElement(),
    h('div', { style: rowStyle }, focusCell, cancel),
    log.element
  );
}

/** @param {Table[]} components @returns {HTMLElement} */
function rowEditExample(components) {
  const log = eventLog();
  let reject = false;
  const table = new Table(null, {
    columns: editableColumns(),
    data: makeEditableRows(),
    rowId: 'id',
    editMode: 'row',
    ...editLogHandlers(log),
    // A server-backed table rejects a commit exactly like this: keep the editor open and decide
    // once the round-trip answered.
    oneditcommit: (event) => {
      log.push(`editcommit ${describeChanges(event.detail.changes)}${reject ? ' — rejected' : ''}`);
      if (reject) event.preventDefault();
    }
  });
  components.push(table);

  const rejectToggle = h('input', {
    type: 'checkbox',
    onchange: (event) => { reject = event.target.checked; }
  });

  return section('Row editing',
    h('p', {}, 'Editing one cell opens every editable cell of the row; they commit or cancel as a ' +
      'unit and `editcommit` carries one `changes` map for the whole row.'),
    table.toElement(),
    h('div', { style: rowStyle },
      h('button', { type: 'button', onclick: () => table.startEdit(1, 'name') }, 'startEdit(1, "name")'),
      h('button', { type: 'button', onclick: () => table.commitEdit() }, 'commitEdit()'),
      h('button', { type: 'button', onclick: () => table.cancelEdit() }, 'cancelEdit()'),
      h('label', { style: { display: 'flex', alignItems: 'center', gap: 'var(--zx-space-2)' } },
        rejectToggle, 'Reject commits (simulated server)')
    ),
    log.element
  );
}

/**
 * Builds a small rolling event log.
 * @returns {{element: HTMLElement, push: (line: string) => void}}
 */
function eventLog() {
  const element = h('output', { style: logStyle, ariaLive: 'polite' }, 'No editing events yet.');
  const lines = [];
  return {
    element,
    push(line) {
      lines.unshift(line);
      lines.length = Math.min(lines.length, 6);
      element.textContent = lines.join('\n');
    }
  };
}

/**
 * Wires every editing event onto a log.
 * @param {{push: (line: string) => void}} log Event log.
 * @returns {Record<string, (event: CustomEvent<any>) => void>} Table option handlers.
 */
function editLogHandlers(log) {
  return {
    oneditstart: (event) => log.push(`editstart #${event.detail.id} ${event.detail.columnId}`),
    oneditcommit: (event) => log.push(`editcommit ${describeChanges(event.detail.changes)}`),
    oneditcancel: (event) => log.push(`editcancel #${event.detail.id} ${event.detail.columnId}`),
    oneditinvalid: (event) => log.push(`editinvalid ${event.detail.columnId}: ${event.detail.message}`)
  };
}

/** @param {Record<string, unknown>} changes @returns {string} */
function describeChanges(changes) {
  const entries = Object.entries(changes);
  if (entries.length === 0) return '(no change)';
  return entries.map(([id, value]) => `${id}=${formatLogValue(value)}`).join(', ');
}

/** @param {unknown} value @returns {string} */
function formatLogValue(value) {
  if (value instanceof Date) return formatDateCompact(value);
  return String(value);
}

/** @returns {Array<Record<string, any>>} */
function editableColumns() {
  return [
    { id: 'id', label: 'ID', width: '70px', align: 'right' },
    { id: 'name', label: 'Customer', width: '1.6fr', editable: true },
    {
      id: 'quantity',
      label: 'Qty',
      width: '80px',
      align: 'right',
      editable: 'number',
      editorProps: { min: 0, max: 999, step: 1 }
    },
    {
      id: 'category',
      label: 'Category',
      width: '1.2fr',
      editable: 'select',
      options: [
        { value: 'Hardware', label: 'Hardware' },
        { value: 'Services', label: 'Services' },
        { value: 'Office', label: 'Office' }
      ]
    },
    {
      id: 'due',
      label: 'Due',
      width: '1.1fr',
      editable: 'date',
      render: (row) => (row.due ? formatDateCompact(row.due) : '—')
    },
    {
      id: 'active',
      label: 'Active',
      width: '90px',
      align: 'center',
      editable: 'checkbox',
      render: (row) => (row.active ? 'Yes' : 'No')
    },
    {
      id: 'notes',
      label: 'Notes',
      width: '1.4fr',
      editable: true,
      validate: (value) => (String(value ?? '').trim() === '' ? 'Notes cannot be empty.' : true)
    }
  ];
}

/** @returns {Array<Record<string, any>>} */
function makeEditableRows() {
  const categories = ['Hardware', 'Services', 'Office'];
  return Array.from({ length: 6 }, (_, index) => ({
    id: index + 1,
    name: `Customer ${String(index + 1).padStart(4, '0')}`,
    quantity: (index * 7) % 40 + 1,
    category: categories[index % categories.length],
    due: new Date(2026, index % 12, index * 3 % 27 + 1),
    active: index % 3 !== 0,
    notes: 'Annual account renewal'
  }));
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
