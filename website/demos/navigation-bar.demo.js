import { NavigationBar, h } from '../../src/index.js';

const items = [
  { name: 'home', title: 'Home' },
  { name: 'inbox', title: 'Inbox', badge: '4' },
  { name: 'contacts', title: 'Contacts' },
  { name: 'projects', title: 'Projects', badge: '12' },
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
    }
  ]
};
