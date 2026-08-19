import { TagPicker, h } from '../../src/index.js';

const SKILLS = [
  { ID: 'js', name: 'JavaScript' }, { ID: 'ts', name: 'TypeScript' },
  { ID: 'css', name: 'CSS' }, { ID: 'html', name: 'HTML' },
  { ID: 'sql', name: 'SQL' }, { ID: 'php', name: 'PHP' },
  { ID: 'go', name: 'Go' }, { ID: 'rust', name: 'Rust' },
  { ID: 'python', name: 'Python' }, { ID: 'java', name: 'Java' }
];

const CUSTOMERS = [
  { ID: 1, name: 'Alpine Works GmbH', city: 'Innsbruck' },
  { ID: 2, name: 'Northstar Systems', city: 'Rotterdam' },
  { ID: 3, name: 'Atelier West', city: 'Lyon' },
  { ID: 4, name: 'Danube Systems AG', city: 'Linz' },
  { ID: 5, name: 'Helios Energie', city: 'Porto' },
  { ID: 6, name: 'Bruckner Logistik', city: 'Salzburg' },
  { ID: 7, name: 'Kestrel Analytics', city: 'Bristol' }
];

export default {
  title: 'Tag picker',
  group: 'Inputs',
  blurb: 'A multi-select combobox that keeps its selection visible as removable tags inside the '
    + 'control — for picking several values out of a large catalogue.',

  examples: [
    {
      title: 'Picking from a catalogue',
      blurb: 'Type to filter, Enter to pick, Backspace to remove the last tag. searchKeys widens '
        + 'the match beyond the label, and renderItem draws the option row.',
      layout: 'stack',
      width: '460px',
      render: ({ cleanup, log }) => {
        const picker = new TagPicker(null, {
          items: CUSTOMERS,
          searchKeys: ['name', 'city'],
          placeholder: 'Search by name or city',
          renderItem: (item) => h('span', {},
            item.name,
            h('span', { style: { color: 'var(--zx-color-text-muted)' } }, ` \u00b7 ${item.city}`)),
          onchange: ({ detail }) => log(`change [${detail.items.map((item) => item.name).join(', ')}]`)
        });
        cleanup(() => picker.destroy());
        return picker.toElement();
      }
    },
    {
      title: 'A capped selection',
      blurb: 'max is enforced in both directions: once three tags are set, the remaining options '
        + 'are marked aria-disabled rather than silently ignoring the click.',
      width: '460px',
      render: ({ cleanup, log }) => {
        const picker = new TagPicker(null, {
          items: CUSTOMERS,
          max: 3,
          placeholder: 'Up to three customers',
          onchange: ({ detail }) => log(`change [${detail.values.join(', ')}]`)
        });
        cleanup(() => picker.destroy());
        return picker.toElement();
      }
    },
    {
      title: 'Creating unknown values',
      blurb: 'allowCreate turns a query that matches nothing into a new tag, and emits create so '
        + 'the value can be persisted. This is the shape a free-form label field needs.',
      width: '460px',
      render: ({ cleanup, log }) => {
        const picker = new TagPicker(null, {
          items: [{ ID: 'urgent', name: 'Urgent' }, { ID: 'billing', name: 'Billing' }],
          values: ['urgent'],
          allowCreate: true,
          placeholder: 'Add or create a label',
          oncreate: ({ detail }) => log(`create \u201c${detail.item.name}\u201d`),
          onchange: ({ detail }) => log(`change [${detail.values.join(', ')}]`)
        });
        cleanup(() => picker.destroy());
        return picker.toElement();
      }
    },
    {
      title: 'Remote search',
      blurb: 'A filter function makes the options come from the server. minQuery holds the '
        + 'request back until there is enough to search for, and debounce waits out the typing.',
      width: '460px',
      render: ({ cleanup, log }) => {
        const picker = new TagPicker(null, {
          placeholder: 'Search customers\u2026',
          minQuery: 1,
          debounce: 250,
          filter: async (query) => {
            log(`query \u201c${query}\u201d\u2026`);
            await new Promise((resolve) => setTimeout(resolve, 220));
            return CUSTOMERS.filter((item) =>
              item.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
          },
          onchange: ({ detail }) => log(`change [${detail.values.join(', ')}]`)
        });
        cleanup(() => picker.destroy());
        return picker.toElement();
      }
    },
    {
      title: 'Read-only and the API',
      blurb: 'readonly keeps the tags visible but removes the input and the remove buttons. The '
        + 'value methods work either way.',
      layout: 'stack',
      width: '460px',
      render: ({ cleanup }) => {
        const locked = new TagPicker(null, { items: SKILLS, values: ['ts', 'go'], readonly: true });
        const editable = new TagPicker(null, { items: SKILLS, values: ['js', 'css'] });
        cleanup(() => [locked, editable].forEach((picker) => picker.destroy()));
        return [
          h('div', { class: 'demo-field' }, h('span', {}, 'Read-only'), locked.toElement()),
          h('div', { class: 'demo-field' }, h('span', {}, 'Editable'), editable.toElement()),
          h('div', { class: 'demo-row' },
            h('button', { type: 'button', onclick: () => editable.addValue('rust') }, "addValue('rust')"),
            h('button', { type: 'button', onclick: () => editable.removeValue('css') }, "removeValue('css')"),
            h('button', { type: 'button', onclick: () => editable.clear() }, 'clear()'))
        ];
      }
    }
  ]
};
