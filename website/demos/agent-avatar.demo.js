import { AgentAvatar, Avatar, button, h } from '../../src/index.js';

/** Agents as an agent registry returns them: a stable id, a display name, no picture. */
const AGENTS = [
  { id: 'agt-7f3a', name: 'Ledger' }, { id: 'agt-19c2', name: 'Atlas' },
  { id: 'agt-4d81', name: 'Juniper' }, { id: 'agt-b6e0', name: 'Quill' },
  { id: 'agt-2a57', name: 'Nova' }, { id: 'agt-c913', name: 'Scout' },
  { id: 'agt-58fd', name: 'Harbor' }, { id: 'agt-e07b', name: 'Mosaic' },
  { id: 'agt-91aa', name: 'Tally' }, { id: 'agt-3c6e', name: 'Echo' }
];

/** What an agent can be doing, with the word the component announces for each. */
const ACTIVITIES = ['idle', 'thinking', 'working', 'needs-you', 'blocked', 'offline'];

/** Sizes from a dense list row to an empty state. */
const SIZES = [16, 20, 'sm', 'md', 'lg', 56, 96];

export default {
  title: 'AgentAvatar',
  group: 'Agents',
  blurb: 'A generated face for an agent without a picture: a coloured shape, or a tinted tile, with '
    + 'eyes that take what the agent is doing. The same seed always draws the same face.',
  examples: [
    {
      title: 'Token: a shape from the agent\'s id',
      blurb: 'The default variant. The seed — the agent\'s stable id — picks the tone, one of eight '
        + 'silhouettes, the eye shape and the spacing, so renaming an agent keeps its face. label makes '
        + 'a standalone avatar an image with that name; beside the name, leave it decorative.',
      layout: 'stack',
      render: ({ cleanup }) => {
        const avatars = AGENTS.map((agent) => new AgentAvatar(null, { seed: agent.id, name: agent.name, size: 48 }));
        cleanup(() => avatars.forEach((avatar) => avatar.destroy()));
        return h('div', { class: 'demo-row' }, avatars.map((avatar, index) => h('div', { class: 'demo-field' },
          avatar.toElement(), h('span', { class: 'demo-caption' }, AGENTS[index].name))));
      }
    },
    {
      title: 'Glyph: eyes on the initials tile',
      blurb: 'variant: \'glyph\' draws the Avatar fallback tile — the tone\'s tint and ink — with eyes '
        + 'where the initials would be, and a seeded mark. Keyed by the same value, the face and the '
        + 'initials tile share a tone: here both are keyed by the name.',
      layout: 'stack',
      render: ({ cleanup }) => {
        const faces = AGENTS.map((agent) => new AgentAvatar(null, { name: agent.name, variant: 'glyph', size: 48 }));
        const tiles = AGENTS.map((agent) => new Avatar(null, { name: agent.name, shape: 'rounded', size: 48 }));
        cleanup(() => [...faces, ...tiles].forEach((avatar) => avatar.destroy()));
        return [
          h('div', { class: 'demo-row' }, faces.map((avatar) => avatar.toElement())),
          h('div', { class: 'demo-row' }, tiles.map((avatar) => avatar.toElement()))
        ];
      }
    },
    {
      title: 'Activity',
      blurb: 'The eyes take a static expression for each activity, so it reads with motion off; the dot '
        + 'and the word in the accessible name stay the primary signal. animate: true moves each avatar '
        + 'in the shared presence loop and lets its eyes blink, drift and scan — never under reduced '
        + 'motion.',
      layout: 'stack',
      render: ({ cleanup, log }) => {
        const row = (variant) => ACTIVITIES.map((activity) => new AgentAvatar(null, {
          seed: 'agt-58fd', name: 'Harbor', variant, size: 'lg', label: 'Harbor', activity, animate: true
        }));
        const tokens = row('token');
        const glyphs = row('glyph');
        const nova = new AgentAvatar(null, { seed: 'agt-2a57', name: 'Nova', size: 56, label: 'Nova', activity: 'idle', animate: true });
        cleanup(() => [...tokens, ...glyphs, nova].forEach((avatar) => avatar.destroy()));
        const field = (avatar) => h('div', { class: 'demo-field' }, avatar.toElement(),
          h('span', { class: 'demo-caption' }, avatar.toElement().getAttribute('aria-label')));
        const word = h('span', { class: 'demo-caption' }, nova.toElement().getAttribute('aria-label'));
        return [
          h('div', { class: 'demo-row' }, tokens.map(field)),
          h('div', { class: 'demo-row' }, glyphs.map(field)),
          h('div', { class: 'demo-row' },
            h('div', { class: 'demo-field' }, nova.toElement(), word),
            button({ label: 'Next activity', onclick: () => {
              const next = ACTIVITIES[(ACTIVITIES.indexOf(nova.getActivity() ?? 'idle') + 1) % ACTIVITIES.length];
              nova.setActivity(next);
              word.textContent = nova.toElement().getAttribute('aria-label');
              log(`Nova: ${next}`);
            } }))
        ];
      }
    },
    {
      title: 'Sizes',
      blurb: 'sm, md and lg are the Avatar presets, 24, 32 and 40px; a number is a pixel size. Small '
        + 'sizes draw less: a token loses its pupils below 20px, and at 24px and below both variants '
        + 'enlarge their eyes and a glyph drops its mark.',
      layout: 'stack',
      render: ({ cleanup }) => {
        const make = (variant) => SIZES.map((size) => new AgentAvatar(null, { seed: 'agt-4d81', name: 'Juniper', variant, size }));
        const all = [...make('token'), ...make('glyph')];
        cleanup(() => all.forEach((avatar) => avatar.destroy()));
        return [
          h('div', { class: 'demo-row' }, all.slice(0, SIZES.length).map((avatar) => avatar.toElement())),
          h('div', { class: 'demo-row' }, all.slice(SIZES.length).map((avatar) => avatar.toElement()))
        ];
      }
    },
    {
      title: 'Fixing a trait',
      blurb: 'tone, body and eyes fix one trait and derive the rest. getTraits() returns what the face '
        + 'is drawn from, so an application can store it — to settle two agents that came out alike, or '
        + 'to keep a look the team is used to.',
      layout: 'stack',
      render: ({ cleanup, log }) => {
        const derived = new AgentAvatar(null, { seed: 'agt-91aa', name: 'Tally', size: 56, label: 'Tally' });
        const fixed = new AgentAvatar(null, { seed: 'agt-91aa', name: 'Tally', size: 56, label: 'Tally', tone: 'teal', body: 'hexagon', eyes: 'square' });
        cleanup(() => [derived, fixed].forEach((avatar) => avatar.destroy()));
        return [
          h('div', { class: 'demo-row' },
            h('div', { class: 'demo-field' }, derived.toElement(), h('span', { class: 'demo-caption' }, 'Derived')),
            h('div', { class: 'demo-field' }, fixed.toElement(), h('span', { class: 'demo-caption' }, 'teal, hexagon, square eyes'))),
          h('div', { class: 'demo-row' },
            button({ label: 'Log the traits', onclick: () => log(JSON.stringify(fixed.getTraits())) }))
        ];
      }
    }
  ]
};
