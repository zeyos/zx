import { MultiValueEditor } from '../../src/index.js';

export default {
  title: 'Multi-value editor',
  group: 'Forms',
  blurb: 'A stack of rows for an ordered list of values, each row with its own remove and reorder '
    + 'controls — for a field that repeats.',

  examples: [
    {
      title: 'Free text',
      blurb: 'Every row is an input. Drag a row by its handle or press the arrow buttons to move '
        + 'it, and the value order is the order you get back, which is the difference between this '
        + 'and a tag picker.',
      width: '420px',
      render: ({ cleanup, log }) => {
        const editor = new MultiValueEditor(null, {
          values: ['First line', 'Second line', 'Third line'],
          addLabel: 'Add note',
          onchange: ({ detail }) => log(JSON.stringify(detail.values))
        });
        cleanup(() => editor.destroy());
        return editor.toElement();
      }
    },
    {
      title: 'Constrained options',
      blurb: 'Passing options turns each row into a select over a {value: label} map, while the '
        + 'row controls stay the same.',
      width: '420px',
      render: ({ cleanup, log }) => {
        const editor = new MultiValueEditor(null, {
          values: ['email', 'phone'],
          options: { email: 'Email', phone: 'Phone', meeting: 'Meeting', post: 'Post' },
          addLabel: 'Add contact method',
          onchange: ({ detail }) => log(JSON.stringify(detail.values))
        });
        cleanup(() => editor.destroy());
        return editor.toElement();
      }
    },
    {
      title: 'Choosing the reorder affordance',
      blurb: 'reorder picks what a row offers: both (the default), drag for the handle alone, '
        + 'buttons for the arrows alone, or none for a list that keeps its order. The handle is a '
        + 'keyboard control too — focus it and press the arrow keys, Home or End — so '
        + 'drag-only rows still reorder without a pointer.',
      width: '420px',
      layout: 'stack',
      render: ({ cleanup, log }) => {
        const editors = ['drag', 'buttons', 'none'].map((reorder) => {
          const editor = new MultiValueEditor(null, {
            values: [`${reorder} — one`, `${reorder} — two`],
            reorder,
            addLabel: `Add to ${reorder}`,
            onchange: ({ detail }) => log(`${reorder}: ${JSON.stringify(detail.values)}`)
          });
          cleanup(() => editor.destroy());
          return editor.toElement();
        });
        return editors;
      }
    }
  ]
};
