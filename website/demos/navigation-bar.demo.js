import { NavigationBar, h } from '../../src/index.js';

const items = [
  { name: 'home', title: 'Home' },
  { name: 'inbox', title: 'Inbox', badge: '4' },
  { name: 'contacts', title: 'Contacts' },
  { name: 'projects', title: 'Projects', badge: '12' },
  { name: 'reports', title: 'Reports' },
  { name: 'settings', title: 'Settings' }
];

/* A phone bottom bar earns its space with short titles: four of these fit at 375px. */
const destinations = [
  { name: 'home', title: 'Home' },
  { name: 'inbox', title: 'Inbox', badge: '4' },
  { name: 'tasks', title: 'Tasks' },
  { name: 'more', title: 'Team' },
  { name: 'reports', title: 'Reports' },
  { name: 'settings', title: 'Settings' }
];

export default {
  title: 'Navigation bar',
  group: 'Layout',
  blurb: 'The application header: a brand, one row of destinations with badges, and the actions '
    + 'that stay reachable at every width.',

  examples: [
    {
      title: 'Application navigation',
      blurb: 'items are destinations, actions are the buttons that sit at the trailing edge. '
        + 'setBadge() updates a count without rebuilding the bar.',
      layout: 'stack',
      render: ({ cleanup, log }) => {
        let unread = 4;
        const navigation = new NavigationBar(null, {
          title: 'ZeyOS',
          items,
          active: 'home',
          actions: [
            { label: 'Create', kind: 'primary', size: 'sm', onclick: () => log('action: create') },
            { label: 'Help', kind: 'ghost', size: 'sm', onclick: () => log('action: help') }
          ]
        });
        navigation.on('change', ({ detail }) => log(`change: ${detail.name}`));
        cleanup(() => navigation.destroy());
        return [
          navigation.toElement(),
          h('button', {
            type: 'button',
            onclick: () => navigation.setBadge('inbox', String(++unread))
          }, 'setBadge("inbox", …)')
        ];
      }
    },
    {
      title: 'Narrow-container overflow',
      blurb: 'At 360px the six destinations move into a More menu, while the brand and the primary '
        + 'action stay visible. The bar measures its own container, not the viewport, so it '
        + 'behaves the same inside a split view.',
      layout: 'stack',
      render: ({ cleanup, log }) => {
        const navigation = new NavigationBar(null, {
          title: 'ZeyOS',
          items,
          active: 'inbox',
          actions: [{ label: 'Add', kind: 'primary', size: 'sm', onclick: () => log('action: add') }]
        });
        navigation.on('change', ({ detail }) => log(`change: ${detail.name}`));
        cleanup(() => navigation.destroy());
        return h('div', { style: { inlineSize: '360px', maxInlineSize: '100%' } }, navigation.toElement());
      }
    },
    {
      title: 'Keeping the first items in the bar',
      blurb: 'minVisible says how many destinations never collapse, counted from the start. Here '
        + 'the first four stay in the row at 420px and the rest move into the More menu — the '
        + 'arrangement a phone bottom bar needs, where collapsing everything would leave the '
        + 'application with one button. Narrower than the four of them fit, the labels truncate '
        + 'rather than the row spilling out of the bar.',
      layout: 'stack',
      render: ({ cleanup, log }) => {
        const navigation = new NavigationBar(null, {
          items: destinations,
          active: 'home',
          minVisible: 4
        });
        navigation.on('change', ({ detail }) => log(`change: ${detail.name}`));
        cleanup(() => navigation.destroy());
        return h('div', { style: { inlineSize: '420px', maxInlineSize: '100%' } }, navigation.toElement());
      }
    },
    {
      title: 'Never collapsing',
      blurb: 'overflow: false keeps every destination in the bar at every width and never shows '
        + 'the More button — this stage is the same width as the one the first example collapses '
        + 'in. Narrower than the destinations fit, their labels truncate. overflowBelow: false '
        + 'says the same thing; give it a length to move the threshold rather than remove it, as '
        + 'in overflowBelow: "30rem", which collapses later than the default 44rem.',
      layout: 'stack',
      render: ({ cleanup, log }) => {
        const navigation = new NavigationBar(null, {
          items: destinations,
          active: 'inbox',
          overflow: false
        });
        navigation.on('change', ({ detail }) => log(`change: ${detail.name}`));
        cleanup(() => navigation.destroy());
        return navigation.toElement();
      }
    }
  ]
};
