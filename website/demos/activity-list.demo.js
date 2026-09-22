import { ActivityList, button, h } from '../../src/index.js';

// Source order is the display order. The host can choose newest-first or oldest-first paging.
function activityRecords() {
  return [
    { id: 3, day: 'Today', actor: 'Ada Lovelace', avatar: { name: 'Ada Lovelace' }, title: 'moved the opportunity to Negotiation', timeLabel: '10:18', metadata: ['Sales', 'Opportunity'] },
    { id: 2, day: 'Today', actor: 'Grace Hopper', avatar: { name: 'Grace Hopper' }, title: 'added a customer note', content: 'Procurement expects the revised offer this week.', timeLabel: '09:42', actions: [{ id: 'reply', label: 'Reply', icon: 'plus' }] },
    { id: 1, day: 'Yesterday', actor: 'Linus Torvalds', avatar: { name: 'Linus Torvalds' }, title: 'created the opportunity', timeLabel: '16:03' }
  ];
}

export default {
  title: 'Activity list',
  group: 'Data',
  api: ['ActivityList', 'ActivityItem'],
  blurb: 'A chronological ordered collection with stable grouping, incremental updates, and loading/empty states.',
  examples: [
    {
      title: 'Grouped record activity',
      blurb: 'Grouping preserves first-seen source order. Prepend and append methods support live '
        + 'updates and pagination without silently re-sorting server results.',
      layout: 'stack',
      width: '700px',
      render: ({ cleanup, log }) => {
        let nextId = 4;
        const list = new ActivityList(null, {
          items: activityRecords(),
          groupBy: 'day',
          groupLabel: (day, items) => `${day} · ${items.length}`,
          ondatachange: ({ detail }) => log(`${detail.items.length} activities`)
        });
        cleanup(() => list.destroy());
        return [
          list.toElement(),
          h('div', { class: 'demo-row' },
            button({ label: 'Prepend live update', onclick: () => list.prependItems({
              id: nextId++, day: 'Today', actor: 'Katherine Johnson',
              avatar: { name: 'Katherine Johnson' }, title: 'updated the forecast', timeLabel: 'Just now'
            }) }),
            button({ label: 'Load older', onclick: () => list.setLoading(true) }),
            button({ label: 'Finish loading', onclick: () => list.setLoading(false) }),
            button({ label: 'Show empty', kind: 'danger', onclick: () => list.setItems([]) }))
        ];
      }
    }
  ]
};
