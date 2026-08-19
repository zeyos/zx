import { DataFilter, Table, h } from '../../src/index.js';

const sectionStyle = {
  display: 'grid',
  gap: 'var(--zx-space-4)',
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

export default {
  title: 'DataFilter',
  group: 'Data',
  blurb: 'The filter bar above a list: typed filter descriptors in, the matching rows out.',

  examples: [
    {
      title: 'Filtering a table',
      blurb: 'A select filter derives its options from the data, so the list never offers a value '
        + 'that matches nothing. A text filter matches AND across the fields you name, and a '
        + 'custom filter contributes any element plus the predicate that goes with it \u2014 which is '
        + 'how a range, a date, or a remote lookup joins the bar.',
      layout: 'stack',
      render: ({ cleanup, log }) => {
        const data = makeRows();
        const table = new Table(null, {
          rowId: 'id',
          data,
          emptyText: 'No rows match the active filters.',
          columns: [
            { id: 'id', label: 'ID', sortable: true, width: '80px' },
            { id: 'name', label: 'Name', sortable: true, width: '2fr' },
            { id: 'category', label: 'Category', sortable: true, width: '1fr' },
            { id: 'amount', label: 'Amount', sortable: true, width: '1fr', align: 'right', render: (row) => `${row.amount.toFixed(2)} \u20ac` },
            { id: 'notes', label: 'Notes', width: '2fr' }
          ]
        });

        const minimum = h('input', {
          type: 'number', min: '0', step: '50',
          placeholder: 'Any amount', ariaLabel: 'Minimum amount'
        });

        const filter = new DataFilter(null, {
          data,
          clearLabel: 'Clear filters',
          filters: [
            { type: 'select', id: 'category', label: 'Category', field: 'category', emptyLabel: 'All categories' },
            { type: 'text', id: 'query', label: 'Fulltext', fields: ['name', 'notes'], placeholder: 'Name and notes' },
            {
              type: 'custom',
              id: 'minimum',
              label: 'Minimum amount',
              element: minimum,
              predicate: (row, value) => row.amount >= Number(value)
            }
          ],
          onfilter: ({ detail }) => {
            table.setData(detail.rows);
            log(`${detail.rows.length} rows \u00b7 ${JSON.stringify(detail.state)}`);
          }
        });
        filter.apply();
        cleanup(() => [filter, table].forEach((component) => component.destroy()));
        return [
          filter.toElement(),
          h('div', { class: 'demo-row' },
            h('button', { type: 'button', onclick: () => log(JSON.stringify(filter.getState())) }, 'getState()'),
            h('button', {
              type: 'button',
              onclick: () => filter.setState({ category: 'Services', query: 'account', minimum: '300' })
            }, 'setState(\u2026)')),
          table.toElement()
        ];
      }
    }
  ]
};

/** @returns {Array<Record<string, any>>} */
function makeRows() {
  const categories = ['Hardware', 'Services', 'Office'];
  const notes = ['Annual account renewal', 'Priority delivery requested', 'Includes installation'];
  return Array.from({ length: 30 }, (_, index) => ({
    id: index + 1,
    name: `Customer ${String(index + 1).padStart(2, '0')}`,
    category: categories[index % categories.length],
    amount: (index * 137) % 1600 + 75,
    notes: notes[index % notes.length]
  }));
}
