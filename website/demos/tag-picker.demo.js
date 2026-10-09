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

const LABELS = [
  { ID: 'urgent', name: 'Urgent', icon: 'warning', color: '#f04639' },
  { ID: 'billing', name: 'Billing', icon: 'file', color: '#535494' },
  { ID: 'customer', name: 'Customer', icon: 'folder', color: '#bc3885' },
  { ID: 'follow-up', name: 'Follow up', icon: 'clock', color: '#f67f00' },
  { ID: 'approved', name: 'Approved', icon: 'check', color: '#008853' }
];

/** Labels are categories, so each takes a tone from the categorical palette, never a status colour. */
const TOPICS = [
  { ID: 'bug', name: 'Bug', tone: 'red' },
  { ID: 'feature', name: 'Feature', tone: 'violet' },
  { ID: 'improvement', name: 'Improvement', tone: 'blue' },
  { ID: 'performance', name: 'Performance', tone: 'amber' },
  { ID: 'customer', name: 'Customer', tone: 'teal' },
  { ID: 'docs', name: 'Docs', tone: 'slate' }
];

export default {
  title: 'Tag picker',
  group: 'Inputs',
  blurb: 'A multi-select combobox that keeps its selection visible as removable tags inside the '
    + 'control — for picking several values out of a large catalogue.',

  examples: [
    {
      title: 'Colored tags with icons',
      blurb: 'iconKey and colorKey apply the same identity to selected tags and option rows. '
        + 'Custom renderTag or renderItem callbacks still take precedence when a product needs '
        + 'a different visual vocabulary.',
      width: '460px',
      render: ({ cleanup, log }) => {
        const picker = new TagPicker(null, {
          items: LABELS,
          values: ['urgent', 'billing', 'approved'],
          placeholder: 'Add a label',
          onchange: ({ detail }) => log(`labels [${detail.values.join(', ')}]`)
        });
        cleanup(() => picker.destroy());
        return picker.toElement();
      }
    },
    {
      title: 'Categorical tones',
      blurb: 'toneKey (default "tone") names a tone from the Badge palette — blue, teal, green, '
        + 'amber, orange, red, pink, violet, slate — and the tag takes its fill and ink, so a label '
        + 'reads as the same colour here as in a Badge. A tone wins over a colour; colorKey also '
        + 'takes a token reference such as var(--zx-color-tone-blue-fg).',
      width: '460px',
      render: ({ cleanup, log }) => {
        const picker = new TagPicker(null, {
          items: TOPICS,
          values: ['bug', 'customer', 'docs'],
          placeholder: 'Add a label',
          onchange: ({ detail }) => log(`labels [${detail.values.join(', ')}]`)
        });
        cleanup(() => picker.destroy());
        return picker.toElement();
      }
    },
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
      blurb: 'readonly shows only the tags: no input, no chevron, no remove buttons, and no empty '
        + 'row under a full line of tags. The value methods work either way.',
      layout: 'stack',
      width: '460px',
      render: ({ cleanup }) => {
        const locked = new TagPicker(null, {
          items: TOPICS, values: ['bug', 'feature', 'improvement', 'performance', 'customer'], readonly: true
        });
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
