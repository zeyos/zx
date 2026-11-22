import { AGENT_BODIES, AGENT_EXPRESSIONS, AGENT_EYES, AgentAvatar, button, h } from '../../src/index.js';

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

/** The mouth styles; `none` is never derived, only chosen. */
const MOUTHS = ['smile', 'grin', 'cat', 'none'];

export default {
  title: 'AgentAvatar',
  group: 'Agents',
  blurb: 'A generated face for an agent without a picture: a coloured geometric shape with a face that '
    + 'takes what the agent is doing. The same seed always draws the same face.',
  examples: [
    {
      title: 'A face from the agent\'s id',
      blurb: 'The seed — the agent\'s stable id — picks the tone, the silhouette, the eyes and their '
        + 'spacing, the mouth and whether it blushes, so renaming an agent keeps its face. label makes a '
        + 'standalone avatar an image with that name; beside the name, leave it decorative.',
      layout: 'stack',
      render: ({ cleanup }) => {
        const avatars = AGENTS.map((agent) => new AgentAvatar(null, { seed: agent.id, name: agent.name, size: 48 }));
        cleanup(() => avatars.forEach((avatar) => avatar.destroy()));
        return h('div', { class: 'demo-row' }, avatars.map((avatar, index) => h('div', { class: 'demo-field' },
          avatar.toElement(), h('span', { class: 'demo-caption' }, AGENTS[index].name))));
      }
    },
    {
      title: 'Fourteen silhouettes',
      blurb: 'body fixes the silhouette; without it the seed picks one of these. Polygons round '
        + 'their corners, so every shape reads as friendly at 16px.',
      layout: 'stack',
      render: ({ cleanup }) => {
        const avatars = AGENT_BODIES.map((body) => new AgentAvatar(null, { seed: 'agt-e07b', name: 'Mosaic', body, size: 48 }));
        cleanup(() => avatars.forEach((avatar) => avatar.destroy()));
        return h('div', { class: 'demo-row' }, avatars.map((avatar, index) => h('div', { class: 'demo-field' },
          avatar.toElement(), h('span', { class: 'demo-caption' }, AGENT_BODIES[index]))));
      }
    },
    {
      title: 'Six eye shapes',
      blurb: 'eyes fixes the eye shape. round, oval and square are white with pupils that look where '
        + 'the agent is looking; dot, capsule and pixel are their solid siblings, in the same order.',
      layout: 'stack',
      render: ({ cleanup }) => {
        const avatars = AGENT_EYES.map((eyes) => new AgentAvatar(null, { seed: 'agt-91aa', name: 'Tally', eyes, size: 56 }));
        cleanup(() => avatars.forEach((avatar) => avatar.destroy()));
        return h('div', { class: 'demo-row' }, avatars.map((avatar, index) => h('div', { class: 'demo-field' },
          avatar.toElement(), h('span', { class: 'demo-caption' }, AGENT_EYES[index]))));
      }
    },
    {
      title: 'Mouths and cheeks',
      blurb: 'mouth is smile, grin or cat; none draws eyes only, the face without a mouth. cheeks adds a '
        + 'soft blush while the face is calm, happy or listening.',
      layout: 'stack',
      render: ({ cleanup }) => {
        const make = (cheeks) => MOUTHS.map((mouth) => new AgentAvatar(null, {
          seed: 'agt-c913', name: 'Scout', eyes: 'capsule', mouth, cheeks, size: 56
        }));
        const plain = make(false);
        const blushing = make(true);
        cleanup(() => [...plain, ...blushing].forEach((avatar) => avatar.destroy()));
        const field = (avatar, index) => h('div', { class: 'demo-field' },
          avatar.toElement(), h('span', { class: 'demo-caption' }, MOUTHS[index]));
        return [
          h('div', { class: 'demo-row' }, h('span', { class: 'demo-caption' }, 'cheeks: false'), plain.map(field)),
          h('div', { class: 'demo-row' }, h('span', { class: 'demo-caption' }, 'cheeks: true'), blushing.map(field))
        ];
      }
    },
    {
      title: 'Expressions',
      blurb: 'Each activity has an expression: calm, thinking, focused (working), alert (needs you), '
        + 'worried (blocked) and asleep (offline). expression shows another on purpose — happy when a run '
        + 'finishes or a person arrives, listening while they type to the agent. The dot and the accessible '
        + 'name still follow the activity.',
      layout: 'stack',
      render: ({ cleanup, log }) => {
        const avatars = AGENT_EXPRESSIONS.map((expression) => new AgentAvatar(null, {
          seed: 'agt-7f3a', name: 'Ledger', expression, size: 56
        }));
        const quill = new AgentAvatar(null, { seed: 'agt-b6e0', name: 'Quill', size: 56, label: 'Quill', activity: 'working', animate: true });
        cleanup(() => [...avatars, quill].forEach((avatar) => avatar.destroy()));
        return [
          h('div', { class: 'demo-row' }, avatars.map((avatar, index) => h('div', { class: 'demo-field' },
            avatar.toElement(), h('span', { class: 'demo-caption' }, AGENT_EXPRESSIONS[index])))),
          h('div', { class: 'demo-row' },
            quill.toElement(),
            button({ label: 'Finish the run', onclick: () => {
              quill.set({ activity: 'idle', expression: 'happy' });
              log('Quill: idle, happy');
            } }),
            button({ label: 'Type to Quill', onclick: () => {
              quill.set({ activity: 'idle', expression: 'listening' });
              log('Quill: idle, listening');
            } }),
            button({ label: 'Back to work', onclick: () => {
              quill.set({ activity: 'working', expression: null });
              log('Quill: working');
            } }))
        ];
      }
    },
    {
      title: 'Activity',
      blurb: 'The face takes a static expression for each activity, so it reads with motion off; the dot '
        + 'and the word in the accessible name stay the primary signal. animate: true moves each avatar '
        + 'in the shared presence loop and lets its eyes blink, drift and scan — never under reduced '
        + 'motion.',
      layout: 'stack',
      render: ({ cleanup, log }) => {
        const row = (body) => ACTIVITIES.map((activity) => new AgentAvatar(null, {
          seed: 'agt-58fd', name: 'Harbor', body, size: 'lg', label: 'Harbor', activity, animate: true
        }));
        const smooth = row('circle');
        const angular = row('cross');
        const nova = new AgentAvatar(null, { seed: 'agt-2a57', name: 'Nova', size: 56, label: 'Nova', activity: 'idle', animate: true });
        cleanup(() => [...smooth, ...angular, nova].forEach((avatar) => avatar.destroy()));
        const field = (avatar) => h('div', { class: 'demo-field' }, avatar.toElement(),
          h('span', { class: 'demo-caption' }, avatar.toElement().getAttribute('aria-label')));
        const word = h('span', { class: 'demo-caption' }, nova.toElement().getAttribute('aria-label'));
        return [
          h('div', { class: 'demo-row' }, smooth.map(field)),
          h('div', { class: 'demo-row' }, angular.map(field)),
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
        + 'sizes draw less: the mouth and the pupils go below 20px, the blush below 28px, and at 24px and '
        + 'below the eyes grow.',
      layout: 'stack',
      render: ({ cleanup }) => {
        const make = (body) => SIZES.map((size) => new AgentAvatar(null, { seed: 'agt-4d81', name: 'Juniper', body, size }));
        const smooth = make('squircle');
        const angular = make('pentagon');
        cleanup(() => [...smooth, ...angular].forEach((avatar) => avatar.destroy()));
        return [
          h('div', { class: 'demo-row' }, smooth.map((avatar) => avatar.toElement())),
          h('div', { class: 'demo-row' }, angular.map((avatar) => avatar.toElement()))
        ];
      }
    },
    {
      title: 'Soft material',
      blurb: 'material: \'soft\' paints the body with a quiet vertical ramp — a touch lighter at the '
        + 'top, deeper at the foot, the plain tone across the eyes, so they keep their contrast. It is '
        + 'an application-wide choice rather than a per-agent trait, and a soft avatar is drawn flat '
        + 'below 28px, when offline, in print and in forced colours.',
      layout: 'stack',
      render: ({ cleanup }) => {
        const make = (material) => AGENTS.slice(0, 6).map((agent) => new AgentAvatar(null, { seed: agent.id, name: agent.name, material, size: 64 }));
        const flat = make('flat');
        const soft = make('soft');
        cleanup(() => [...flat, ...soft].forEach((avatar) => avatar.destroy()));
        return [
          h('div', { class: 'demo-row' }, h('span', { class: 'demo-caption' }, 'flat'), flat.map((avatar) => avatar.toElement())),
          h('div', { class: 'demo-row' }, h('span', { class: 'demo-caption' }, 'soft'), soft.map((avatar) => avatar.toElement()))
        ];
      }
    },
    {
      title: 'Fixing a trait',
      blurb: 'tone, body, eyes, spacing, mouth and cheeks fix one trait and derive the rest. getTraits() '
        + 'returns what the face is drawn from, so an application can store it — to settle two agents that '
        + 'came out alike, or to keep a look the team is used to.',
      layout: 'stack',
      render: ({ cleanup, log }) => {
        const derived = new AgentAvatar(null, { seed: 'agt-91aa', name: 'Tally', size: 56, label: 'Tally' });
        const fixed = new AgentAvatar(null, {
          seed: 'agt-91aa', name: 'Tally', size: 56, label: 'Tally', tone: 'teal', body: 'hexagon', eyes: 'square', mouth: 'cat'
        });
        cleanup(() => [derived, fixed].forEach((avatar) => avatar.destroy()));
        return [
          h('div', { class: 'demo-row' },
            h('div', { class: 'demo-field' }, derived.toElement(), h('span', { class: 'demo-caption' }, 'Derived')),
            h('div', { class: 'demo-field' }, fixed.toElement(), h('span', { class: 'demo-caption' }, 'teal, hexagon, square eyes, cat mouth'))),
          h('div', { class: 'demo-row' },
            button({ label: 'Log the traits', onclick: () => log(JSON.stringify(fixed.getTraits())) }))
        ];
      }
    }
  ]
};
