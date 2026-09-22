import { SortControl } from '../../src/index.js';

const FIELDS = [
  { id: 'name', label: 'Name' },
  { id: 'created', label: 'Created' },
  { id: 'amount', label: 'Amount' }
];

export default {
  title: 'Sort Control', group: 'Data', api: ['SortControl'],
  blurb: 'A searchable field selector with an adjacent direction toggle.',
  examples: [{
    title: 'Searchable sorting',
    blurb: 'Type to find a field. Click the arrow, or focus it and press Space or Enter, to reverse direction. Changing the field keeps the current direction; a single change event carries both values.',
    render: ({ cleanup, log }) => {
      const sort = new SortControl(null, {
        fields: FIELDS, value: { id: 'name', dir: 'asc' }, label: 'Sort records by',
        onchange: ({ detail }) => log(JSON.stringify(detail.value))
      });
      cleanup(() => sort.destroy());
      return sort.el;
    }
  }]
};
