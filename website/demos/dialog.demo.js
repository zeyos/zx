import { Dialog, button, h } from '../../src/index.js';

export default {
  title: 'Dialog',
  group: 'Overlays',
  blurb: 'A modal built on native <dialog>: focus trapping, Escape, and the top layer come from '
    + 'the platform. Views swap a dialog’s contents in place; the static helpers return promises.',

  examples: [
    {
      title: 'Responsive sizes',
      blurb: 'sm, md, and lg cap the width against the viewport rather than fixing it, so a '
        + 'dialog fits a phone without a second layout. A button descriptor with action: "close" '
        + 'needs no handler of its own.',
      render: ({ cleanup }) => {
        const dialogs = ['sm', 'md', 'lg'].map((size) => new Dialog(null, {
          title: `${size.toUpperCase()} dialog`,
          size,
          content: `The ${size} preset demonstrates responsive maximum sizing.`,
          buttons: [{ label: 'Close', kind: 'primary', action: 'close', autofocus: true }]
        }));
        cleanup(() => dialogs.forEach((dialog) => dialog.destroy()));
        return dialogs.map((dialog, index) =>
          button({ label: `Open ${['sm', 'md', 'lg'][index]}`, onclick: () => dialog.open() }));
      }
    },
    {
      title: 'A wizard built from views',
      blurb: 'addView() registers a named body, title, and button row; showView() swaps between '
        + 'them inside the one dialog. Nesting dialogs to make a wizard is what this avoids.',
      render: ({ cleanup }) => {
        const wizard = new Dialog(null, { title: 'Two-step wizard', size: 'sm' });
        wizard.addView('account', {
          title: 'Step 1 — Account',
          content: h('label', { class: 'demo-field' },
            h('span', {}, 'Account name'), h('input', { value: 'Acme GmbH' })),
          buttons: [
            { label: 'Cancel', action: 'cancel' },
            { label: 'Next', kind: 'primary', action: () => wizard.showView('review'), autofocus: true }
          ]
        });
        wizard.addView('review', {
          title: 'Step 2 — Review',
          content: h('p', { style: { margin: '0' } }, 'Review complete. Go back or finish.'),
          buttons: [
            { label: 'Back', action: () => wizard.showView('account') },
            { label: 'Finish', kind: 'primary', action: 'close', autofocus: true }
          ]
        });
        cleanup(() => wizard.destroy());
        return button({
          label: 'Start wizard',
          kind: 'primary',
          onclick: () => {
            wizard.showView('account');
            wizard.open();
          }
        });
      }
    },
    {
      title: 'Promise helpers',
      blurb: 'alert, confirm, and prompt replace the blocking browser primitives with awaitable '
        + 'dialogs that match the rest of the application. confirm resolves to a boolean, prompt '
        + 'to the string or null when dismissed.',
      render: ({ log }) => [
        button({
          label: 'alert',
          onclick: async () => {
            await Dialog.alert({ title: 'Saved', message: 'The record was saved.' });
            log('alert resolved');
          }
        }),
        button({
          label: 'confirm',
          onclick: async () => log(`confirm → ${await Dialog.confirm({
            title: 'Continue?',
            message: 'Confirm a regular action.'
          })}`)
        }),
        button({
          label: 'danger confirm',
          kind: 'danger',
          onclick: async () => log(`confirm → ${await Dialog.confirm({
            title: 'Delete record?',
            message: 'This demonstrates the danger action treatment.',
            okLabel: 'Delete',
            danger: true
          })}`)
        }),
        button({
          label: 'prompt',
          onclick: async () => log(`prompt → ${JSON.stringify(await Dialog.prompt({
            title: 'Name this view',
            message: 'Enter a short name.',
            value: 'Quarterly report',
            placeholder: 'View name'
          }))}`)
        })
      ]
    }
  ]
};
