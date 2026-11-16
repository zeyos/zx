import { ActivityItem, FileItem, h } from '../../src/index.js';

export default {
  title: 'Activity item',
  group: 'Data',
  api: ['ActivityItem', 'FileItem'],
  blurb: 'One chronological record with actor identity, timestamp, metadata, attachments, content, and host actions.',
  examples: [
    {
      title: 'Comment with attachment',
      blurb: 'Every content slot is text-safe or caller-owned DOM. Server HTML is never interpreted, '
        + 'and posting, reactions, permissions, and persistence stay outside the component.',
      width: '680px',
      render: ({ cleanup, log }) => {
        const attachment = new FileItem(null, {
          id: 'file-17', name: 'signed-contract.pdf', size: 842137, mime: 'application/pdf',
          link: '#signed-contract'
        });
        const activity = new ActivityItem(null, {
          id: 'activity-17',
          actor: 'Ada Lovelace',
          avatar: { name: 'Ada Lovelace', status: 'online', statusLabel: 'Online' },
          title: 'uploaded a signed contract',
          content: h('p', {}, 'The countersigned document is now available to the project team.'),
          timestamp: '2026-08-31T09:30:00Z',
          timeLabel: 'Today, 09:30',
          metadata: ['Customer', 'Contracts'],
          attachments: [attachment.toElement()],
          actions: [
            { id: 'like', label: 'Like', icon: 'heart', onselect: () => log('liked') },
            { id: 'reply', label: 'Reply', icon: 'plus', onselect: () => log('reply') }
          ]
        });
        cleanup(() => { activity.destroy(); attachment.destroy(); });
        return activity.toElement();
      }
    },
    {
      title: 'An agent as the actor',
      blurb: 'face on the avatar descriptor draws the actor as its generated AgentAvatar — '
        + '{seed, tone, body, eyes, material}, or true to derive it from the name. activity puts the '
        + 'agent\'s state on the face and the dot.',
      width: '680px',
      render: ({ cleanup, log }) => {
        const activity = new ActivityItem(null, {
          id: 'activity-18',
          actor: 'Ledger',
          avatar: { name: 'Ledger', face: { seed: 'agt-ledger', material: 'soft' }, activity: 'needs-you' },
          title: 'matched 238 of 240 freight invoices',
          content: h('p', {}, 'Two invoices differ from the ledger and wait for your review.'),
          timestamp: '2026-08-31T10:02:00Z',
          timeLabel: 'Today, 10:02',
          metadata: ['Finance', 'Reconciliation'],
          actions: [{ id: 'review', label: 'Review', icon: 'check', onselect: () => log('review') }]
        });
        cleanup(() => activity.destroy());
        return activity.toElement();
      }
    }
  ]
};
