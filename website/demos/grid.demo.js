import { Grid, h } from '../../src/index.js';

function billingRows() {
  return [
    { id: 'project', parent: null, kind: 'group', item: 'Berlin office refit', total: 1737.5, currency: 'EUR' },
    { id: 'services', parent: 'project', kind: 'group', item: 'Services', total: 617.5, currency: 'EUR' },
    { id: 'planning', parent: 'services', kind: 'line', item: 'Planning and coordination', quantity: 6.5, unit: 'hours', unitPrice: 95, total: 617.5, currency: 'EUR' },
    { id: 'hardware', parent: 'project', kind: 'group', item: 'Hardware', total: 1120, currency: 'EUR' },
    { id: 'sensors', parent: 'hardware', kind: 'line', item: 'Occupancy sensors', quantity: 10, unit: 'pcs', unitPrice: 84.5, total: 845, currency: 'USD' },
    { id: 'controllers', parent: 'hardware', kind: 'line', item: 'Desk controllers', quantity: 2, unit: 'pcs', unitPrice: 137.5, total: 275, currency: 'EUR' }
  ];
}

export default {
  title: 'Grid',
  group: 'Data',
  api: ['Grid', 'BillingItems', 'Table'],
  blurb: 'A public Table specialization for domain presets; it inherits sorting, selection, hierarchy, typed formatting, and editing without forking them.',
  examples: [
    {
      id: 'billing-items',
      title: 'Grid.BillingItems()',
      preset: true,
      blurb: 'Conventional editable billing fields, mixed currencies and units, and flat parent references. Taxes, rounding policy, persistence, and server validation stay application-owned.',
      render: ({ cleanup, log }) => {
        const grid = Grid.BillingItems(null, {
          data: billingRows(),
          units: { hours: 'Hours', pcs: 'Pieces' },
          currencies: { EUR: 'EUR', USD: 'USD' },
          oneditcommit: ({ detail }) => log(`editcommit ${detail.id}: ${JSON.stringify(detail.changes)}`),
          onrowtoggle: ({ detail }) => log(`${detail.expanded ? 'expanded' : 'collapsed'} ${detail.id}`)
        });
        cleanup(() => grid.destroy());
        return [grid.toElement(), h('p', { class: 'demo-caption' }, 'Single-click an editable cell. Drag the row handle (or use Space and arrow keys) to reorder siblings; use Columns to show or hide fields.')];
      }
    },
    {
      title: 'Generic Grid',
      blurb: 'new Grid() is a Table-compatible constructor for applications that want their own reusable preset without changing the underlying data component.',
      render: ({ cleanup }) => {
        const grid = new Grid(null, {
          rowId: 'id',
          columns: [{ id: 'id', label: 'ID' }, { id: 'name', label: 'Name' }],
          data: [{ id: 1, name: 'Nordwind GmbH' }, { id: 2, name: 'Aurora AB' }]
        });
        cleanup(() => grid.destroy());
        return grid.toElement();
      }
    }
  ]
};
