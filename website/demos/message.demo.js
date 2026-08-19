import { button, h, Message } from '../../src/index.js';

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
      title: 'Inline message area',
      blurb: 'Constructed against a host element, a Message writes into that element instead of '
        + 'the floating region — the right shape for a message that belongs to one form or panel. '
        + 'timeout: 0 makes it stay until it is replaced or closed.',
      layout: 'stack',
      render: ({ cleanup }) => {
        const host = h('div');
        const message = new Message(host, { timeout: 0 });
        cleanup(() => message.destroy());
        return [
          button({
            label: 'Show inline',
            onclick: () => message.show('This message stays inside the component area.', {
              kind: 'success',
              timeout: 0
            })
          }),
          host
        ];
      }
    }
  ]
};
