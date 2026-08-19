import { h, Search } from '../../src/index.js';

export default {
  title: 'Search',
  group: 'Inputs',
  blurb: 'A debounced search field with a clear button and a submit on Enter.',

  examples: [
    {
      title: 'Debounced and clearable',
      blurb: 'input fires once the reader stops typing, submit on Enter, and clear when the '
        + 'button or Escape empties the field. Watch the log: at 250 ms, keystrokes coalesce.',
      width: '360px',
      render: ({ cleanup, log }) => {
        const search = new Search(null, {
          placeholder: 'Search contacts',
          value: 'Ada',
          debounce: 250
        });
        search.on('input', ({ detail }) => log(`input “${detail.value}”`));
        search.on('submit', ({ detail }) => log(`submit “${detail.value}”`));
        search.on('clear', () => log('clear'));
        cleanup(() => search.destroy());
        return search.toElement();
      }
    },
    {
      title: 'Without the clear button',
      blurb: 'clearable: false keeps the field a plain input — the right shape when it filters a '
        + 'list that is never fully cleared. debounce: 0 reports every keystroke.',
      width: '360px',
      render: ({ cleanup, log }) => {
        const search = new Search(null, {
          placeholder: 'Search reference',
          clearable: false,
          debounce: 0
        });
        search.on('input', ({ detail }) => log(`input “${detail.value}”`));
        cleanup(() => search.destroy());
        return search.toElement();
      }
    },
    {
      title: 'Programmatic control',
      blurb: 'set() writes a value without firing input; clear() and focus() drive the field from '
        + 'a toolbar or a keyboard shortcut.',
      render: ({ cleanup }) => {
        const search = new Search(null, { placeholder: 'Search contacts' });
        cleanup(() => search.destroy());
        return [
          h('div', { style: { inlineSize: '260px' } }, search.toElement()),
          h('button', { type: 'button', onclick: () => search.set('Grace Hopper') }, 'set(…)'),
          h('button', { type: 'button', onclick: () => search.clear() }, 'clear()'),
          h('button', { type: 'button', onclick: () => search.focus() }, 'focus()')
        ];
      }
    }
  ]
};
