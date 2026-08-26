import { Avatar, h } from '../../src/index.js';

export default {
  title: 'Avatar',
  group: 'Layout',
  blurb: 'A stable-size user image with deterministic initials fallback and an optional text-described presence indicator.',
  examples: [
    {
      title: 'Initials, sizes, and presence',
      blurb: 'Image failure never changes geometry. Decorative avatars leave naming to adjacent identity text; standalone avatars can receive label.',
      layout: 'row',
      render: ({ cleanup }) => {
        const avatars = [
          new Avatar(null, { name: 'Ada Lovelace', size: 'sm', status: 'online', statusLabel: 'Online' }),
          new Avatar(null, { name: 'Grace Hopper', size: 'md', status: 'away', statusLabel: 'Away' }),
          new Avatar(null, { name: 'Katherine Johnson', size: 'lg', shape: 'rounded', label: 'Katherine Johnson' })
        ];
        cleanup(() => avatars.forEach((avatar) => avatar.destroy()));
        return avatars.map((avatar) => h('div', { class: 'demo-field' }, avatar.toElement()));
      }
    },
    {
      title: 'Image error fallback',
      blurb: 'An unavailable source falls back to initials inside the same fixed wrapper.',
      render: ({ cleanup }) => {
        const avatar = new Avatar(null, { name: 'Peter Zey', src: '/missing-avatar-for-demo.png', size: 56 });
        cleanup(() => avatar.destroy());
        return avatar.toElement();
      }
    }
  ]
};
