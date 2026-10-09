import { Avatar, h } from '../../src/index.js';

/** A team as a directory returns it: names only, no pictures. */
const TEAM = ['Ada Lovelace', 'Grace Hopper', 'Katherine Johnson', 'Alan Turing', 'Barbara Liskov',
  'Donald Knuth', 'Margaret Hamilton', 'Radia Perlman'];

export default {
  title: 'Avatar',
  group: 'Layout',
  blurb: 'A stable-size user image with a deterministic fallback — initials on a tone picked from the name — and an optional text-described presence indicator.',
  examples: [
    {
      title: 'Initials, sizes, and presence',
      blurb: 'sm, md and lg are 24, 32 and 40px. Image failure never changes geometry. Decorative avatars leave naming to adjacent identity text; standalone avatars can receive label.',
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
      title: 'A tone from the name',
      blurb: 'Without a picture the fallback takes one of the categorical tones, chosen by a stable '
        + 'hash of the name, so the same person has the same colour on every screen. tone sets one '
        + 'explicitly; slate, the neutral, is what an avatar with no name gets. Below 24px there is '
        + 'room for one initial, not two.',
      layout: 'stack',
      render: ({ cleanup }) => {
        const team = TEAM.map((name) => new Avatar(null, { name, label: name }));
        const fixed = [
          new Avatar(null, { name: 'Unassigned', tone: 'slate', label: 'Unassigned' }),
          new Avatar(null, { name: 'Support team', initials: 'S', tone: 'violet', shape: 'rounded', label: 'Support team' })
        ];
        const small = TEAM.slice(0, 4).map((name) => new Avatar(null, { name, size: 20 }));
        const all = [...team, ...fixed, ...small];
        cleanup(() => all.forEach((avatar) => avatar.destroy()));
        return [
          h('div', { class: 'demo-row' }, team.map((avatar) => avatar.toElement())),
          h('div', { class: 'demo-row' }, fixed.map((avatar) => avatar.toElement())),
          h('div', { class: 'demo-row' }, small.map((avatar) => avatar.toElement()))
        ];
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
