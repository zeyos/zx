import { button, emptyState, Table, badge, h } from '../../src/index.js';

const amountFormatter = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'EUR' });

/** @param {number} amount @returns {string} */
function money(amount) {
  return amountFormatter.format(amount);
}

/** @param {Date} date @returns {string} */
function isoDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** @param {number} count @param {number} [offset] @returns {Array<Record<string, any>>} */
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
function editableColumns() {
  return [
    { id: 'id', label: 'ID', width: '70px', align: 'right' },
    { id: 'name', label: 'Customer', width: '1.6fr', editable: true },
    {
      id: 'quantity', label: 'Qty', width: '80px', align: 'right',
      editable: 'number', editorProps: { min: 0, max: 999, step: 1 }
    },
    {
      id: 'category', label: 'Category', width: '1.2fr', editable: 'select',
      options: [
        { value: 'Hardware', label: 'Hardware' },
        { value: 'Services', label: 'Services' },
        { value: 'Office', label: 'Office' }
      ]
    },
    {
      id: 'due', label: 'Due', width: '1.1fr', editable: 'date',
      render: (row) => (row.due ? isoDate(row.due) : '—')
    },
    {
      id: 'active', label: 'Active', width: '90px', align: 'center',
      editable: 'checkbox', render: (row) => (row.active ? 'Yes' : 'No')
    },
    {
      id: 'notes', label: 'Notes', width: '1.4fr', editable: true,
      validate: (value) => (String(value ?? '').trim() === '' ? 'Notes cannot be empty.' : true)
    }
  ];
}

/** @returns {Array<Record<string, any>>} */
function editableRows() {
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

/** @returns {Array<Record<string, any>>} */
function transactionRows() {
  return [
    {
      id: 'project', parent: null, item: 'Berlin office refit', kind: 'group',
      quantity: null, unit: '', unitPrice: null, total: 3654.8, currency: 'EUR'
    },
    {
      id: 'services', parent: 'project', item: 'Installation services', kind: 'group',
      quantity: null, unit: '', unitPrice: null, total: 1722.5, currency: 'EUR'
    },
    {
      id: 'planning', parent: 'services', item: 'Planning and coordination', kind: 'line',
      quantity: 6.5, unit: 'hours', unitPrice: 95, total: 617.5, currency: 'EUR'
    },
    {
      id: 'install', parent: 'services', item: 'On-site installation', kind: 'line',
      quantity: 13, unit: 'hours', unitPrice: 85, total: 1105, currency: 'EUR'
    },
    {
      id: 'hardware', parent: 'project', item: 'Hardware', kind: 'group',
      quantity: null, unit: '', unitPrice: null, total: 1932.3, currency: 'EUR'
    },
    {
      id: 'desks', parent: 'hardware', item: 'Standing desk controllers', kind: 'line',
      quantity: 4, unit: 'pcs', unitPrice: 288.2, total: 1152.8, currency: 'EUR'
    },
    {
      id: 'sensors', parent: 'hardware', item: 'Occupancy sensors', kind: 'line',
      quantity: 10, unit: 'pcs', unitPrice: 84.5, total: 845, currency: 'USD'
    }
  ];
}

/** @param {Record<string, unknown>} changes @returns {string} */
function describeChanges(changes) {
  const entries = Object.entries(changes);
  if (entries.length === 0) return '(no change)';
  return entries.map(([id, value]) =>
    `${id}=${value instanceof Date ? isoDate(value) : String(value)}`).join(', ');
}

export default {
  title: 'Table',
  group: 'Data',
  blurb: 'A sortable, selectable, editable data table with a sticky header for dense records, '
    + 'transactions, and operational workflows.',

  examples: [
    {
      title: 'Sorting, custom cells, and multi-select',
      blurb: 'Column widths take fr units to fill the container or px to scroll horizontally. '
        + 'render draws a cell from the row, selectable: "multi" adds the tri-state header '
        + 'checkbox, and Shift+click on a second checkbox selects the range between them.',
      layout: 'stack',
      render: ({ cleanup, log }) => {
        const table = new Table(null, {
          rowId: 'id',
          data: makeRows(30),
          selectable: 'multi',
          sort: { id: 'name', dir: 'asc' },
          columns: [
            { id: 'id', label: 'ID', sortable: true, width: '80px', align: 'right' },
            { id: 'name', label: 'Name', sortable: true, width: '2fr' },
            { id: 'category', label: 'Category', sortable: true, width: '1fr' },
            { id: 'amount', label: 'Amount', sortable: true, width: '1fr', align: 'right', render: (row) => money(row.amount) },
            { id: 'date', label: 'Date', sortable: true, width: '1fr', render: (row) => isoDate(row.date) },
            {
              id: 'status', label: 'Status', sortable: true, width: '1fr',
              render: (row) => badge({
                label: row.status,
                kind: row.status === 'Paid' ? 'success' : row.status === 'Late' ? 'danger' : 'warning'
              })
            }
          ],
          onselectionchange: ({ detail }) => log(`selectionchange ids=[${detail.ids.join(', ')}]`),
          onrowclick: ({ detail }) => log(`rowclick #${detail.id} ${detail.row.name}`)
        });
        cleanup(() => table.destroy());
        return table.toElement();
      }
    },
    {
      title: 'Editable transaction lines',
      blurb: 'Typed columns keep values numeric in row data while formatting each row’s currency '
        + 'and unit. hierarchy projects the flat parent references as expandable line items; '
        + 'double-click Quantity or Unit price to edit, then commit with Enter or Tab.',
      layout: 'stack',
      render: ({ cleanup, log }) => {
        const table = new Table(null, {
          rowId: 'id',
          data: transactionRows(),
          hierarchy: { parentId: 'parent', column: 'item', expanded: true },
          editMode: 'cell',
          sort: { id: 'item', dir: 'asc' },
          columns: [
            { id: 'item', label: 'Item', width: '2fr', sortable: true },
            {
              id: 'quantity', label: 'Quantity', width: '1fr', type: 'unit',
              unit: (row) => row.unit,
              decimals: (row) => row.unit === 'hours' ? 2 : 0,
              editable: (row) => row.kind === 'line' ? 'number' : false,
              editorProps: { min: 0, step: 0.25 },
              validate: (value) => Number(value) > 0 ? true : 'Quantity must be greater than zero.'
            },
            {
              id: 'unitPrice', label: 'Unit price', width: '1fr', type: 'currency', decimals: 2,
              currency: (row) => row.currency,
              editable: (row) => row.kind === 'line' ? 'number' : false,
              editorProps: { min: 0, step: 0.01 },
              validate: (value) => Number(value) >= 0 ? true : 'Unit price cannot be negative.'
            },
            {
              id: 'total', label: 'Line total', width: '1fr', type: 'currency', decimals: 2,
              currency: (row) => row.currency
            }
          ],
          oneditcommit: ({ detail }) => {
            const quantity = detail.changes.quantity ?? detail.row.quantity;
            const unitPrice = detail.changes.unitPrice ?? detail.row.unitPrice;
            if (detail.row.kind === 'line') detail.changes.total = Number(quantity) * Number(unitPrice);
            log(`editcommit ${detail.id}: ${describeChanges(detail.changes)}`);
          },
          onrowtoggle: ({ detail }) => log(`${detail.expanded ? 'expanded' : 'collapsed'} ${detail.id}`)
        });
        cleanup(() => table.destroy());
        return [
          table.toElement(),
          h('div', { class: 'demo-row' },
            h('button', { type: 'button', onclick: () => table.expandAll() }, 'expandAll()'),
            h('button', { type: 'button', onclick: () => table.collapseAll() }, 'collapseAll()'))
        ];
      }
    },
    {
      title: 'Cell editing',
      blurb: 'editMode: "cell" opens one cell at a time. Double-click, or focus a cell and press '
        + 'Enter or F2; Enter commits, Escape cancels, Tab commits and walks to the next editable '
        + 'cell. Notes refuses to be empty through its validate, and ID has no editable flag at '
        + 'all, so it stays read-only.',
      layout: 'stack',
      render: ({ cleanup, log }) => {
        const table = new Table(null, {
          rowId: 'id',
          columns: editableColumns(),
          data: editableRows(),
          editMode: 'cell',
          oneditstart: ({ detail }) => log(`editstart #${detail.id} ${detail.columnId}`),
          oneditcommit: ({ detail }) => log(`editcommit ${describeChanges(detail.changes)}`),
          oneditcancel: ({ detail }) => log(`editcancel #${detail.id} ${detail.columnId}`),
          oneditinvalid: ({ detail }) => log(`editinvalid ${detail.columnId}: ${detail.message}`)
        });
        cleanup(() => table.destroy());
        return [
          table.toElement(),
          h('div', { class: 'demo-row' },
            h('button', { type: 'button', onclick: () => table.startEdit(2, 'name') }, 'startEdit(2, "name")'),
            h('button', { type: 'button', onclick: () => table.cancelEdit() }, 'cancelEdit()'))
        ];
      }
    },
    {
      title: 'Row editing and rejected commits',
      blurb: 'editMode: "row" opens every editable cell of a row at once; they commit or cancel '
        + 'as a unit and editcommit carries one changes map for the whole row. The event is '
        + 'cancelable — tick the box and preventDefault() keeps the editor open, which is exactly '
        + 'how a server-backed table waits for its round-trip.',
      layout: 'stack',
      render: ({ cleanup, log }) => {
        let reject = false;
        const table = new Table(null, {
          rowId: 'id',
          columns: editableColumns(),
          data: editableRows(),
          editMode: 'row',
          oneditstart: ({ detail }) => log(`editstart #${detail.id} ${detail.columnId}`),
          oneditcommit: (event) => {
            log(`editcommit ${describeChanges(event.detail.changes)}${reject ? ' — rejected' : ''}`);
            if (reject) event.preventDefault();
          }
        });
        cleanup(() => table.destroy());
        return [
          table.toElement(),
          h('div', { class: 'demo-row' },
            h('button', { type: 'button', onclick: () => table.startEdit(1, 'name') }, 'startEdit(1, "name")'),
            h('button', { type: 'button', onclick: () => table.commitEdit() }, 'commitEdit()'),
            h('button', { type: 'button', onclick: () => table.cancelEdit() }, 'cancelEdit()'),
            h('label', { class: 'demo-row' },
              h('input', {
                type: 'checkbox',
                onchange: (event) => { reject = event.target.checked; }
              }),
              'Reject commits (simulated server)'))
        ];
      }
    },
    {
      title: 'Five thousand rows',
      blurb: 'setData() replaces the whole body in one pass. The readout is the measured time for '
        + 'this browser — sorting the same table stays interactive because the sort happens on the '
        + 'data, not the DOM.',
      layout: 'stack',
      render: ({ cleanup, log }) => {
        const table = new Table(null, {
          rowId: 'id',
          data: [],
          height: 340,
          sort: { id: 'id', dir: 'asc' },
          columns: [
            { id: 'id', label: 'ID', sortable: true, width: '90px', align: 'right' },
            { id: 'name', label: 'Name', sortable: true, width: '2fr' },
            { id: 'amount', label: 'Amount', sortable: true, width: '1fr', align: 'right', render: (row) => money(row.amount) },
            { id: 'date', label: 'Date', sortable: true, width: '1fr', render: (row) => isoDate(row.date) }
          ]
        });
        let generation = 0;
        const regenerate = () => {
          generation += 1;
          const rows = makeRows(5000, generation * 5000);
          const started = performance.now();
          table.setData(rows);
          log(`setData(5,000 rows) in ${(performance.now() - started).toFixed(1)} ms`);
        };
        regenerate();
        cleanup(() => table.destroy());
        return [
          h('button', { type: 'button', onclick: regenerate }, 'Regenerate 5,000 rows'),
          table.toElement()
        ];
      }
    },
    {
      title: 'Server-side sorting',
      blurb: 'sortMode: "server" leaves the rows exactly as given and only emits sort, so the '
        + 'header stays the control while your query does the ordering. The header still shows '
        + 'the current direction.',
      layout: 'stack',
      render: ({ cleanup, log }) => {
        const table = new Table(null, {
          rowId: 'id',
          data: makeRows(8),
          sortMode: 'server',
          columns: [
            { id: 'id', label: 'ID', sortable: true, width: '90px' },
            { id: 'name', label: 'Name', sortable: true, width: '2fr' },
            { id: 'amount', label: 'Amount', sortable: true, width: '1fr', align: 'right', render: (row) => money(row.amount) }
          ],
          onsort: ({ detail }) => log(`sort → your query would use ${detail.id} ${detail.dir}`)
        });
        cleanup(() => table.destroy());
        return table.toElement();
      }
    },
    {
      title: 'Sticky header in a bounded height',
      blurb: 'height bounds the scroller and stickyHeader keeps the header row visible inside it. '
        + 'Because every width here is in px the body scrolls horizontally too, and the header '
        + 'stays part of the same table rather than a second one aligned by hand.',
      render: ({ cleanup }) => {
        const table = new Table(null, {
          rowId: 'id',
          data: makeRows(30),
          height: 230,
          stickyHeader: true,
          columns: [
            { id: 'id', label: 'ID', width: '100px' },
            { id: 'name', label: 'Long customer name', width: '260px' },
            { id: 'category', label: 'Category', width: '180px' },
            { id: 'amount', label: 'Amount', width: '180px', align: 'right', render: (row) => money(row.amount) },
            { id: 'notes', label: 'Notes', width: '360px' }
          ]
        });
        cleanup(() => table.destroy());
        return table.toElement();
      }
    },
    {
      title: 'Stacking in a narrow container',
      blurb: 'Drag the box narrower. Below `responsive` each row becomes a card of label/value '
        + 'pairs instead of a horizontal scrollbar with the data hidden behind it. The width is '
        + 'the table\u2019s own container, not the viewport, so this triggers inside a narrow split '
        + 'pane on a wide screen — which is where a dense ERP table actually becomes unreadable. '
        + 'Columns marked `popin: false` lead the card instead of becoming another labelled line.',
      render: ({ cleanup, log }) => {
        const table = new Table(null, {
          responsive: 'md',
          columns: [
            { id: 'number', label: 'Invoice', popin: false },
            { id: 'customer', label: 'Customer' },
            { id: 'due', label: 'Due' },
            { id: 'status', label: 'Status' },
            { id: 'total', label: 'Total', align: 'end' }
          ],
          data: [
            { ID: 1, number: 'INV-1042', customer: 'Nordwind GmbH', due: '2026-09-01', status: 'Open', total: '1 240.00' },
            { ID: 2, number: 'INV-1043', customer: 'Halbe Systeme', due: '2026-09-04', status: 'Paid', total: '880.50' },
            { ID: 3, number: 'INV-1044', customer: 'Kestrel Ltd', due: '2026-09-11', status: 'Overdue', total: '3 105.00' }
          ],
          onstackedchange: ({ detail }) => log(`stacked → ${detail.stacked}`)
        });
        cleanup(() => table.destroy());
        return h('div', { class: 'demo-resizable' }, table.toElement());
      }
    },
    {
      title: 'Growing a large result set',
      blurb: 'growing renders a first batch and offers the next on demand. A query that returns ten '
        + 'thousand rows costs more to lay out than anyone will ever scroll through, and the control '
        + 'names the number remaining rather than saying "show more". setData starts the batch over, '
        + 'because a new result set is not the old one grown.',
      render: ({ cleanup, log }) => {
        const rows = Array.from({ length: 420 }, (_, index) => ({
          ID: index + 1,
          number: `INV-${2000 + index}`,
          customer: ['Nordwind GmbH', 'Halbe Systeme', 'Kestrel Ltd', 'Aurora AB'][index % 4],
          total: ((index % 37) * 84.5 + 120).toFixed(2)
        }));
        const table = new Table(null, {
          growing: 20,
          height: 320,
          columns: [
            { id: 'number', label: 'Invoice', sortable: true },
            { id: 'customer', label: 'Customer', sortable: true },
            { id: 'total', label: 'Total', align: 'end' }
          ],
          data: rows,
          ongrow: ({ detail }) => log(`showing ${detail.rendered} of ${detail.total}`)
        });
        cleanup(() => table.destroy());
        return [
          table.toElement(),
          h('div', { class: 'demo-row' },
            button({ label: 'Show everything', onclick: () => table.showAll() }),
            button({ label: 'Reset', onclick: () => table.setData(rows) }))
        ];
      }
    },
    {
      title: 'An empty table that says something',
      blurb: 'emptyText takes a node, or a function returning one, so the empty state can carry an '
        + 'icon, an explanation, and the action that resolves it — the thing someone actually needs '
        + 'when a filtered list comes back with nothing in it.',
      render: ({ cleanup, log }) => {
        const table = new Table(null, {
          columns: [
            { id: 'number', label: 'Invoice' },
            { id: 'customer', label: 'Customer' },
            { id: 'total', label: 'Total', align: 'end' }
          ],
          data: [],
          emptyText: () => emptyState({
            icon: 'filter',
            title: 'No invoices match this filter',
            description: 'Every invoice was excluded by the current date range.',
            size: 'sm',
            actions: [{ label: 'Clear filters', kind: 'primary', onclick: () => log('filters cleared') }]
          })
        });
        cleanup(() => table.destroy());
        return table.toElement();
      }
    }
  ]
};
