import { Avatar, button, h, Message } from '../../src/index.js';

/** Who asks for the approval in the "An action" example. */
const REQUESTER = { name: 'Mara Lind' };

export default {
  title: 'Message',
  group: 'Overlays',
  blurb: 'Transient notifications: a floating region for toasts, a progress handle for long work, '
    + 'and an inline area for messages that belong to one part of the screen.',

  examples: [
    {
      title: 'Floating kinds',
      blurb: 'The static helpers post into a shared region at the corner of the viewport and '
        + 'return a handle you can close early. Each kind carries its own colour and icon.',
      render: ({ cleanup, log }) => {
        const handles = new Set();
        const show = (kind) => {
          handles.add(Message[kind](`${kind} message from the floating region.`));
          log(`${kind} toast shown`);
        };
        cleanup(() => handles.forEach((handle) => handle.close()));
        return [
          button({ label: 'Info', onclick: () => show('info') }),
          button({ label: 'Success', kind: 'primary', onclick: () => show('success') }),
          button({ label: 'Warning', onclick: () => show('warning') }),
          button({ label: 'Error', kind: 'danger', onclick: () => show('error') })
        ];
      }
    },
    {
      title: 'An action',
      blurb: 'action: { label, onclick, kind } puts one small button in the message. Activating it '
        + 'runs onclick and closes the message; kind: "primary" or "danger" overrides the secondary '
        + 'default. A message with an action stays at least eight seconds and never times out while '
        + 'the pointer is over it or focus is inside it — Tab reaches the button from the message. '
        + 'leading shows a node, here an Avatar, in place of the kind icon; it is decorative, so '
        + 'the text names the person.',
      render: ({ cleanup, log }) => {
        const handles = new Set();
        const avatars = new Set();
        cleanup(() => {
          handles.forEach((handle) => handle.close());
          avatars.forEach((avatar) => avatar.destroy());
        });
        return [
          button({
            label: 'Archive invoice',
            onclick: () => handles.add(Message.success('Invoice INV-1042 archived.', {
              action: { label: 'Undo', onclick: () => log('undo archive') }
            }))
          }),
          button({
            label: 'Ask for approval',
            onclick: () => {
              const avatar = new Avatar(null, { name: REQUESTER.name, size: 'sm' });
              avatars.add(avatar);
              handles.add(Message.show(`${REQUESTER.name} asks you to approve the release.`, {
                leading: avatar,
                timeout: 0,
                action: { label: 'Approve', kind: 'primary', onclick: () => log('release approved') }
              }));
            }
          })
        ];
      }
    },
    {
      title: 'Progress',
      blurb: 'Message.progress() returns a handle with update(percent, text) and done(). It never '
        + 'times out on its own — the work that opened it decides when it is finished.',
      render: ({ cleanup, log }) => {
        let timer = null;
        let handle = null;
        cleanup(() => {
          clearInterval(timer);
          handle?.done();
        });
        return button({
          label: 'Run progress',
          icon: 'reload',
          onclick: () => {
            clearInterval(timer);
            handle = Message.progress('Preparing export…');
            let percent = 0;
            timer = setInterval(() => {
              percent += 10;
              handle.update(percent, `Preparing export… ${percent}%`);
              if (percent < 100) return;
              clearInterval(timer);
              handle.done();
              log('progress completed');
            }, 180);
          }
        });
      }
    },
    {
      title: 'The queue',
      blurb: 'The region shows five toasts at a time. A burst of eight queues the rest and '
        + 'promotes them as the visible ones expire, so a loop of notifications never buries the '
        + 'screen.',
      render: ({ cleanup, log }) => {
        const handles = new Set();
        cleanup(() => handles.forEach((handle) => handle.close()));
        return button({
          label: 'Burst of 8',
          icon: 'list',
          onclick: () => {
            for (let index = 1; index <= 8; index += 1) {
              handles.add(Message.info(`Queued toast ${index}`, { timeout: 6000 }));
            }
            log('burst queued: five visible, three waiting');
          }
        });
      }
    },
    {
      title: 'A region per theme scope',
      blurb: 'scope places a toast in the floating region of that element’s nearest theme scope '
        + '(.zx-scope, data-zx-theme, or data-zx-preset), so it inherits what that scope sets. A '
        + 'region exists only while it has toasts: it is removed when the last one closes, and '
        + 'Message.disposeRegion(scope) removes it at once — for a view being torn down while its '
        + 'toasts are still showing.',
      layout: 'stack',
      render: ({ cleanup, log }) => {
        const panel = h('div', {
          class: 'demo-card zx-scope',
          style: 'display: flex; gap: var(--zx-space-2); padding: var(--zx-space-4)'
        });
        cleanup(() => Message.disposeRegion(panel));
        panel.append(
          button({
            label: 'Toast in this panel',
            onclick: () => Message.success('Saved in the panel’s region.', { scope: panel, timeout: 8000 })
          }),
          button({
            label: 'Dispose the region',
            onclick: () => log(`region removed: ${Message.disposeRegion(panel)}`)
          })
        );
        return panel;
      }
    },
    {
      title: 'Inline message area',
      blurb: 'Constructed against a host element, a Message writes into that element instead of '
        + 'the floating region — the right shape for a message that belongs to one form or panel. '
        + 'timeout: 0 makes it stay until it is replaced or closed, and an action works here as it '
        + 'does in a toast.',
      layout: 'stack',
      render: ({ cleanup, log }) => {
        const host = h('div');
        const message = new Message(host, { timeout: 0 });
        cleanup(() => message.destroy());
        return [
          h('div', { style: 'display: flex; flex-wrap: wrap; gap: var(--zx-space-2)' },
            button({
              label: 'Show inline',
              onclick: () => message.show('This message stays inside the component area.', {
                kind: 'success',
                timeout: 0
              })
            }),
            button({
              label: 'Show with an action',
              onclick: () => message.show('The connection to the mail server was lost.', {
                kind: 'warning',
                action: { label: 'Retry', onclick: () => log('retry connection') }
              })
            })),
          host
        ];
      }
    }
  ]
};
