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
    }
  ]
};
