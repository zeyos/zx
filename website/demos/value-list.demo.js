import { ValueList, h } from '../../src/index.js';

export default {
  title: 'Value list',
  group: 'Forms',
  blurb: 'A chip editor for a list of strings, with per-value validation and drag or keyboard '
    + 'reordering.',

  examples: [
    {
      title: 'Validated email recipients',
      blurb: 'Enter adds a chip and Backspace removes the last one when the input is empty. '
        + 'validate returns true or a message, and a rejected value stays in the input so it can '
        + 'be corrected rather than retyped.',
      layout: 'stack',
      width: '520px',
      render: ({ cleanup, log }) => {
        const values = new ValueList(null, {
          values: ['ada@example.test', 'grace@example.test'],
          placeholder: 'person@example.test',
          validate: (value) =>
            /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || 'Enter a complete email address.',
          onadd: ({ detail }) => log(`add ${detail.value}`),
          onremove: ({ detail }) => log(`remove ${detail.value}`),
          onchange: ({ detail }) => log(`change [${detail.values.join(', ')}]`)
        });
        cleanup(() => values.destroy());
        return values.toElement();
      }
    },
    {
      title: 'Reordering and the API',
      blurb: 'Drag a chip, or focus one and press Ctrl+Left or Ctrl+Right to move it; Delete '
        + 'removes a focused chip. disable() and enable() switch the whole control.',
      layout: 'stack',
      width: '520px',
      render: ({ cleanup }) => {
        const values = new ValueList(null, {
          values: ['first', 'second', 'third', 'fourth']
        });
        cleanup(() => values.destroy());
        return [
          values.toElement(),
          h('div', { class: 'demo-row' },
            h('button', { type: 'button', onclick: () => values.disable() }, 'disable()'),
            h('button', { type: 'button', onclick: () => values.enable().focus() }, 'enable().focus()'))
        ];
      }
    }
  ]
};
