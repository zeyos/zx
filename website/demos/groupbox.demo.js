import { Groupbox, h } from '../../src/index.js';

export default {
  title: 'Groupbox',
  group: 'Layout',
  blurb: 'A collapsible section built on native <details>, so the keyboard and find-in-page '
    + 'behaviour comes from the platform.',

  examples: [
    {
      title: 'Open and closed sections',
      blurb: 'open sets the initial state. Because this is a real <details>, the summary is '
        + 'focusable, Enter and Space toggle it, and browser find-in-page can open it.',
      layout: 'stack',
      render: ({ cleanup, log }) => {
        const account = new Groupbox(null, { title: 'Account details', open: true });
        account.setContent(h('p', { style: { margin: '0' } },
          'This section starts open. Its title and content can both be replaced at runtime.'));

        const advanced = new Groupbox(null, { title: 'Advanced settings', open: false });
        advanced.setContent(h('label', { class: 'demo-field' },
          h('span', {}, 'Reference'), h('input', { value: 'ZX-2048' })));

        for (const groupbox of [account, advanced]) {
          groupbox.on('open', () => log(`${groupbox.refs.title.textContent}: open`));
          groupbox.on('close', () => log(`${groupbox.refs.title.textContent}: close`));
        }
        cleanup(() => [account, advanced].forEach((groupbox) => groupbox.destroy()));
        return [account.toElement(), advanced.toElement()];
      }
    },
    {
      title: 'Programmatic control',
      blurb: 'toggle(), open(), and setTitle() drive a section from outside — from a "collapse '
        + 'all" control, for instance.',
      layout: 'stack',
      render: ({ cleanup }) => {
        const groupbox = new Groupbox(null, { title: 'Account details', open: true });
        groupbox.setContent(h('p', { style: { margin: '0' } }, 'Section content.'));
        cleanup(() => groupbox.destroy());
        return [
          groupbox.toElement(),
          h('div', { class: 'demo-row' },
            h('button', { type: 'button', onclick: () => groupbox.toggle() }, 'toggle()'),
            h('button', { type: 'button', onclick: () => groupbox.open() }, 'open()'),
            h('button', {
              type: 'button',
              onclick: () => groupbox.setTitle('Renamed account details')
            }, 'setTitle(…)'))
        ];
      }
    }
  ]
};
