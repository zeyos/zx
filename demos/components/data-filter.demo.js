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

  /**
   * Mounts a select, fulltext, and custom filter wired to a 30-row table.
   * @param {HTMLElement} container Demo stage.
   * @returns {void}
   */
  mount(container) {
    const data = makeRows();
    const minimum = h('input', {
      type: 'number',
      min: '0',
      step: '50',
      placeholder: 'Any amount',
      ariaLabel: 'Minimum amount'
    });
    const table = new Table(null, {
      columns: [
        { id: 'id', label: 'ID', sortable: true, width: '80px' },
        { id: 'name', label: 'Name', sortable: true, width: '2fr' },
        { id: 'category', label: 'Category', sortable: true, width: '1fr' },
        { id: 'amount', label: 'Amount', sortable: true, width: '1fr', align: 'right', render: (row) => `${row.amount.toFixed(2)} €` },
        { id: 'notes', label: 'Notes', width: '2fr' }
      ],
      data,
      rowId: 'id',
      emptyText: 'No rows match the active filters.'
    });
    const eventLog = h('output', {
      ariaLive: 'polite',
      style: { color: 'var(--zx-color-text-muted)', fontFamily: 'var(--zx-font-mono)' }
    }, '30 rows');
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
      onfilter: (event) => {
        table.setData(event.detail.rows);
        eventLog.textContent = `${event.detail.rows.length} rows · ${JSON.stringify(event.detail.state)}`;
      }
    });

    const stateLog = h('output', {
      ariaLive: 'polite',
      style: { color: 'var(--zx-color-text-muted)', fontFamily: 'var(--zx-font-mono)' }
    }, 'Use Get state or Set example state.');
    const getState = h('button', {
      type: 'button',
      onclick: () => { stateLog.textContent = JSON.stringify(filter.getState()); }
    }, 'Get state');
    const setState = h('button', {
      type: 'button',
      onclick: () => filter.setState({ category: 'Services', query: 'account', minimum: '300' })
    }, 'Set example state');

    const marker = h('section', { style: sectionStyle },
      h('h2', { style: { margin: '0' } }, 'Filter a 30-row Table'),
      h('p', {}, 'The select options are derived from the data. Fulltext terms use AND matching across name and notes.'),
      filter.toElement(),
      h('div', { style: rowStyle }, getState, setState, eventLog),
      stateLog,
      table.toElement()
    );
    container.append(marker);
    filter.apply();

    const observer = new MutationObserver(() => {
      if (marker.isConnected) return;
      filter.destroy();
      table.destroy();
      observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }
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
