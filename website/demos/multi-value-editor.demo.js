import { MultiValueEditor } from '../../src/index.js';

export default {
  title: 'Multi-value editor',
  group: 'Forms',
  blurb: 'A stack of rows for an ordered list of values, each row with its own remove and reorder '
    + 'controls \u2014 for a field that repeats.',

  examples: [
    {
      title: 'Free text',
      blurb: 'Every row is an input. The arrows move a row within the list and the value order is '
        + 'the order you get back, which is the difference between this and a tag picker.',
      width: '420px',
      render: ({ cleanup, log }) => {
        const editor = new MultiValueEditor(null, {
          values: ['First line', 'Second line'],
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
    }
  ]
};
