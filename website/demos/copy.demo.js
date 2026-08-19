import { CopyInput, copyButton, h } from '../../src/index.js';

export default {
  title: 'Copy',
  group: 'Inputs',
  api: ['CopyButton', 'CopyInput'],
  blurb: 'Copying a value, and saying so. A clipboard write is silent, so both of these confirm '
    + 'the copy in place — and stay quiet when the browser refuses it.',

  examples: [
    {
      title: 'Copy button',
      blurb: 'Pass text a string, or a function when the value can change — the function is read '
        + 'at click time, so the copy is never stale. The glyph becomes a tick and a live region '
        + 'speaks the confirmation, then both revert. A refused write leaves the button untouched '
        + 'and reports false to oncopy, rather than claiming a copy that did not happen.',
      render: ({ log }) => {
        let counter = 0;
        return [
          h('div', { class: 'demo-field' }, h('span', {}, 'Icon only'),
            copyButton({ text: 'INV-1042', oncopy: (text, ok) => log(`${text} → ${ok}`) })),
          h('div', { class: 'demo-field' }, h('span', {}, 'With a label'),
            copyButton({ label: 'Copy invoice number', text: 'INV-1042' })),
          h('div', { class: 'demo-field' }, h('span', {}, 'A value that changes'),
            copyButton({
              label: 'Copy the next number',
              text: () => `INV-${1042 + (counter += 1)}`,
              oncopy: (text) => log(`copied ${text}`)
            }))
        ];
      }
    },
    {
      title: 'Copy input',
      blurb: 'The value stays visible and selectable — read-only, not disabled — so Ctrl+C works '
        + 'too; focusing the box selects the whole value. Use it for the things people copy out of '
        + 'a record: an endpoint, a reference, a share link.',
      render: ({ cleanup, log }) => {
        const endpoint = new CopyInput(null, {
          label: 'API endpoint',
          value: 'https://api.example.com/v1/transactions'
        });
        const reference = new CopyInput(null, {
          label: 'Payment reference', value: 'DE89 3704 0044 0532 0130 00', size: 'sm'
        });
        endpoint.on('copy', ({ detail }) => log(`copied ${detail.value} (${detail.copied})`));

        const inputs = [endpoint, reference];
        cleanup(() => inputs.forEach((input) => input.destroy()));
        return h('div', { class: 'demo-stack', style: 'inline-size: 380px' },
          ...inputs.map((input) => input.toElement()));
      }
    }
  ]
};
