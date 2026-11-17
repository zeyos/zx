import { AgentAvatar, Avatar, button, h, Message, Toggle } from '../../src/index.js';

/** Who asks for the approval in the "An action" example. */
const REQUESTER = { name: 'Mara Lind' };

/** The agent that asks in the same example, keyed by its stable id so a rename keeps its face. */
const AGENT = { seed: 'agt-finance', name: 'Finance agent', tone: 'violet', material: 'soft' };

/** What the stack examples post, in turn: a kind, the text, and sometimes a highlight. */
const STACK_MESSAGES = [
  { kind: 'success', text: 'Invoice INV-1042 sent to Halden & Co.' },
  { kind: 'info', text: 'Three new comments on the Q3 forecast.' },
  { kind: 'warning', text: 'The mail server is slow to answer; the outbox will retry.', highlight: 'border' },
  { kind: 'error', text: 'Could not save the delivery address.', highlight: 'animated' },
  { kind: 'success', text: 'Project Aurora moved to Review.' }
];

/** Where a floating region can sit: the block edge, then the inline position; alone, centred. */
const PLACEMENTS = ['top-start', 'top', 'top-end', 'bottom-start', 'bottom', 'bottom-end'];

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
      title: 'Highlight',
      blurb: 'A message is a plain card; its kind shows in the icon. highlight makes one stand out: '
        + '"border" (or true) draws the border in the kind colour, and "animated" sends a light '
        + 'round it — a still kind-coloured border when the reader asks for reduced motion.',
      render: ({ cleanup, log }) => {
        const handles = new Set();
        cleanup(() => handles.forEach((handle) => handle.close()));
        return [
          button({
            label: 'Plain',
            onclick: () => handles.add(Message.info('Three new comments on the Q3 forecast.'))
          }),
          button({
            label: 'Border',
            onclick: () => {
              handles.add(Message.warning('Two fields need attention.', { highlight: 'border' }));
              log('highlight: border');
            }
          }),
          button({
            label: 'Animated',
            onclick: () => {
              handles.add(Message.error('Could not save the delivery address.', {
                highlight: 'animated',
                timeout: 8000
              }));
              log('highlight: animated');
            }
          })
        ];
      }
    },
    {
      title: 'A floating stack',
      blurb: 'Floating messages pile into one stack: the newest in front, two more peeking out '
        + 'behind it. The stack opens while the pointer is over it or focus is inside it — Tab '
        + 'reaches it through its buttons — and a press on it, a tap included, keeps it open until '
        + 'a press outside it or Escape. While it is open no message in it times out. At the foot '
        + 'the stack piles upwards. Message.setStack(false) lists the messages one below another '
        + 'instead, at once and for every placement.',
      render: ({ cleanup, log }) => {
        const handles = new Set();
        const before = Message.getStack();
        let next = 0;
        const stacking = new Toggle(null, {
          label: 'Stack floating messages',
          checked: before,
          onchange: (event) => log(`Message.setStack(${Message.setStack(event.detail.checked)})`)
        });
        cleanup(() => {
          handles.forEach((handle) => handle.close());
          stacking.destroy();
          Message.setStack(before);
        });
        const post = () => {
          const { kind, text, highlight } = STACK_MESSAGES[next % STACK_MESSAGES.length];
          next += 1;
          handles.add(Message.show(text, { kind, highlight, timeout: 8000 }));
        };
        return [
          stacking.el,
          button({ label: 'Add a message', kind: 'primary', onclick: post }),
          button({
            label: 'Add four',
            onclick: () => {
              for (let index = 0; index < 4; index += 1) post();
              log('four messages stacked');
            }
          })
        ];
      }
    },
    {
      title: 'An inline stack',
      blurb: 'stack: true does the same for an inline area: the messages pile up in its place, and '
        + 'opening the stack pushes the content after it down. expand() opens it and keeps it open, '
        + 'collapse() folds it again, and each change fires expand or collapse. expanded: true '
        + 'keeps it open for good.',
      layout: 'stack',
      render: ({ cleanup, log }) => {
        const host = h('div');
        const stack = new Message(host, { stack: true, timeout: 0 });
        stack.on('expand', () => log('expand'));
        stack.on('collapse', () => log('collapse'));
        cleanup(() => stack.destroy());
        let next = 0;
        const post = () => {
          const { kind, text, highlight } = STACK_MESSAGES[next % STACK_MESSAGES.length];
          next += 1;
          stack.show(text, { kind, highlight });
        };
        post();
        post();
        post();
        return [
          h('div', { class: 'demo-row' },
            button({ label: 'Add a message', kind: 'primary', onclick: post }),
            button({ label: 'expand()', onclick: () => stack.expand() }),
            button({ label: 'collapse()', onclick: () => stack.collapse() })),
          host,
          h('p', { class: 'demo-caption' }, 'The form continues below the stack.')
        ];
      }
    },
    {
      title: 'Placement',
      blurb: 'placement puts a floating message at one of six places: top or bottom, then start, '
        + 'end, or — with neither — the centre. start and end follow the writing direction. '
        + 'Messages of one placement share a region, which carries it as data-placement; '
        + 'Message.setPlacement() changes the default from top-end for calls that name none. '
        + '--zx-message-offset, set on the theme scope or :root, is the distance from the viewport '
        + 'edge. At 640px and narrower every placement spans the foot of the screen.',
      render: ({ cleanup, log }) => {
        const handles = new Set();
        cleanup(() => handles.forEach((handle) => handle.close()));
        return PLACEMENTS.map((placement) => button({
          label: placement,
          onclick: () => {
            handles.add(Message.info(`Shown at ${placement}.`, { placement }));
            log(`toast at ${placement}`);
          }
        }));
      }
    },
    {
      title: 'An action',
      blurb: 'action: { label, onclick, kind } puts one small button in the message. Activating it '
        + 'runs onclick and closes the message; kind: "primary" or "danger" overrides the secondary '
        + 'default. A message with an action stays at least eight seconds and never times out while '
        + 'the pointer is over it or focus is inside it — Tab reaches the button from the message. '
        + 'leading shows a node, here an Avatar or an AgentAvatar, in place of the kind icon; it is '
        + 'decorative, so the text names who asks.',
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
          }),
          button({
            label: 'An agent asks',
            onclick: () => {
              const avatar = new AgentAvatar(null, { ...AGENT, size: 'sm', activity: 'needs-you', indicator: false });
              avatars.add(avatar);
              handles.add(Message.show(`${AGENT.name} needs your approval to send 3 payment reminders.`, {
                leading: avatar,
                timeout: 0,
                action: { label: 'Review', kind: 'primary', onclick: () => log('review the reminders') }
              }));
            }
          })
        ];
      }
    },
    {
      title: 'Progress',
      blurb: 'Message.progress() returns a handle with update(percent, text) and done(). It never '
        + 'times out on its own — the work that opened it decides when it is finished. Here it '
        + 'carries the animated highlight while the work runs.',
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
            handle = Message.progress('Preparing export…', { highlight: 'animated' });
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
      blurb: 'A region holds five messages at a time, three of them in sight while its stack is '
        + 'collapsed. A burst of eight queues the rest and promotes them as the others expire, so a '
        + 'loop of notifications never buries the screen.',
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
            log('burst queued: five in the region, three waiting');
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
