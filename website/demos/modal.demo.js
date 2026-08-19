import { Dialog, Modal, button, h } from '../../src/index.js';

/**
 * @param {string} title
 * @param {string} text
 * @param {() => void} close
 * @returns {HTMLElement}
 */
function card(title, text, close) {
  return h('div', { style: { display: 'grid', gap: 'var(--zx-space-4)' } },
    h('h2', { style: { margin: '0' } }, title),
    h('p', { style: { margin: '0' } }, text),
    button({ label: 'Close', onclick: close }));
}

export default {
  title: 'Modal',
  group: 'Overlays',
  blurb: 'A bare top-layer surface you fill yourself — Dialog’s unopinionated sibling, for '
    + 'overlays that supply their own chrome.',

  examples: [
    {
      title: 'Dismissal',
      blurb: 'Escape closes a modal by default. lightDismiss: true adds the backdrop click, and '
        + 'closable: false blocks Escape for a modal that must be resolved deliberately — the two '
        + 'are configured separately, so "backdrop yes, Escape no" is expressible.',
      render: ({ cleanup, log }) => {
        const basic = new Modal(null, { width: 460 });
        basic.setContent(card('Basic modal', 'Escape closes this modal.', () => basic.close('button')));

        const light = new Modal(null, { width: 460, lightDismiss: true });
        light.setContent(card('Light dismiss',
          'Click the shaded backdrop, press Escape, or use the button.', () => light.close('button')));

        const locked = new Modal(null, { width: 460, closable: false, lightDismiss: true });
        locked.setContent(card('Non-closable',
          'Escape is blocked; backdrop dismissal is still on.', () => locked.close('explicit button')));

        const modals = { basic, 'light-dismiss': light, 'non-closable': locked };
        for (const [name, modal] of Object.entries(modals)) {
          modal.on('open', () => log(`${name}: open`));
          modal.on('close', ({ detail }) => log(`${name}: close (${detail.result ?? 'dismissed'})`));
        }
        cleanup(() => Object.values(modals).forEach((modal) => modal.destroy()));
        return Object.entries(modals).map(([name, modal]) =>
          button({ label: `Open ${name}`, onclick: () => modal.open() }));
      }
    },
    {
      title: 'Stacked overlays',
      blurb: 'Both Modal and Dialog live in the browser’s top layer, so they stack by open order '
        + 'without any z-index bookkeeping — and Escape unwinds them one at a time, closing the '
        + 'confirmation before the modal underneath it.',
      render: ({ cleanup, log }) => {
        const modal = new Modal(null, { width: 500 });
        modal.setContent(h('div', { style: { display: 'grid', gap: 'var(--zx-space-4)' } },
          h('h2', { style: { margin: '0' } }, 'Nested top-layer overlays'),
          h('p', { style: { margin: '0' } },
            'Open a Dialog.confirm above this modal. Escape closes only the confirmation first.'),
          h('div', { class: 'demo-row' },
            button({
              label: 'Open confirmation',
              kind: 'primary',
              onclick: async () => log(`confirm → ${await Dialog.confirm({
                title: 'Nested confirmation',
                message: 'This dialog is stacked above the still-open modal.'
              })}`)
            }),
            button({ label: 'Close modal', onclick: () => modal.close() }))));
        cleanup(() => modal.destroy());
        return button({ label: 'Open parent modal', kind: 'primary', onclick: () => modal.open() });
      }
    }
  ]
};
