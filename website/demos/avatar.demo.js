import { Avatar, button, h } from '../../src/index.js';

/** A team as a directory returns it: names only, no pictures. */
const TEAM = ['Ada Lovelace', 'Grace Hopper', 'Katherine Johnson', 'Alan Turing', 'Barbara Liskov',
  'Donald Knuth', 'Margaret Hamilton', 'Radia Perlman'];

/** A team of agents, each doing something different. The word beside each says what. */
const AGENTS = [
  { name: 'Finance agent', initials: 'F', tone: 'teal', activity: 'needs-you' },
  { name: 'Research agent', initials: 'R', tone: 'violet', activity: 'thinking' },
  { name: 'Mail agent', initials: 'M', tone: 'blue', activity: 'working' },
  { name: 'Ledger agent', initials: 'L', tone: 'amber', activity: 'blocked' },
  { name: 'Archive agent', initials: 'A', tone: 'green', activity: 'idle' },
  { name: 'Import agent', initials: 'I', tone: 'slate', activity: 'offline' }
];

/** One agent, drawn twice on the same screen: once in a roster, once in an inspector. */
const RESEARCH_AGENT = { name: 'Research agent', initials: 'R', tone: 'violet', shape: 'rounded', activity: 'thinking' };

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
      title: 'Agent activity',
      blurb: 'activity draws what an agent is doing as a dot that differs in shape as well as tone: '
        + 'solid for working, thinking and needs-you, a square for blocked, a hollow ring for idle, a '
        + 'dashed ring for offline. Its word joins the accessible name; show it beside the avatar '
        + 'too. animate: true moves each avatar with its activity in one shared loop that stops off '
        + 'screen, while the page is hidden, and under reduced motion.',
      layout: 'stack',
      render: ({ cleanup, log }) => {
        const avatars = AGENTS.map((agent) => new Avatar(null, {
          name: agent.name, initials: agent.initials, tone: agent.tone, shape: 'rounded', size: 'lg',
          label: agent.name, activity: agent.activity, animate: true
        }));
        cleanup(() => avatars.forEach((avatar) => avatar.destroy()));
        const words = avatars.map((avatar) => h('span', { class: 'demo-caption' },
          avatar.toElement().getAttribute('aria-label')));
        const cycle = ['working', 'thinking', 'needs-you', 'idle'];
        return [
          h('div', { class: 'demo-row' }, avatars.map((avatar, index) => h('div', { class: 'demo-field' },
            avatar.toElement(), words[index]))),
          h('div', { class: 'demo-row' },
            button({ label: 'Change the mail agent', onclick: () => {
              const mail = avatars[2];
              const next = cycle[(cycle.indexOf(mail.getActivity() ?? 'idle') + 1) % cycle.length];
              mail.setActivity(next);
              words[2].textContent = mail.toElement().getAttribute('aria-label');
              log(`Mail agent: ${next}`);
            } }))
        ];
      }
    },
    {
      title: 'One agent in two places',
      blurb: 'An agent shown twice on one screen — in a roster and in an inspector — moves in step, '
        + 'because its phase comes from its name. phase sets where in the cycle each avatar moves, as '
        + 'a fraction from 0 to 1: 0.5 is half a cycle apart. set({phase}) changes it while it runs.',
      layout: 'stack',
      render: ({ cleanup, log }) => {
        const roster = new Avatar(null, { ...RESEARCH_AGENT, size: 'md', animate: true, phase: 0 });
        const inspector = new Avatar(null, { ...RESEARCH_AGENT, size: 'lg', animate: true, phase: 0.5 });
        cleanup(() => [roster, inspector].forEach((avatar) => avatar.destroy()));
        const caption = h('span', { class: 'demo-caption' }, 'Inspector, phase 0.5');
        let phase = 0.5;
        return [
          h('div', { class: 'demo-row' },
            h('div', { class: 'demo-field' }, roster.toElement(), h('span', { class: 'demo-caption' }, 'Roster, phase 0')),
            h('div', { class: 'demo-field' }, inspector.toElement(), caption)),
          h('div', { class: 'demo-row' },
            button({ label: 'Toggle the inspector phase', onclick: () => {
              phase = phase === 0 ? 0.5 : 0;
              inspector.set({ phase });
              caption.textContent = `Inspector, phase ${phase}`;
              log(`inspector phase ${phase}`);
            } }))
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
