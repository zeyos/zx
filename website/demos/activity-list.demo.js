import { ActivityList, button, h } from '../../src/index.js';

// Source order is the display order. The host can choose newest-first or oldest-first paging.
function activityRecords() {
  return [
    { id: 3, day: 'Today', actor: 'Ada Lovelace', avatar: { name: 'Ada Lovelace' }, title: 'moved the opportunity to Negotiation', timeLabel: '10:18', metadata: ['Sales', 'Opportunity'] },
    { id: 2, day: 'Today', actor: 'Grace Hopper', avatar: { name: 'Grace Hopper' }, title: 'added a customer note', content: 'Procurement expects the revised offer this week.', timeLabel: '09:42', actions: [{ id: 'reply', label: 'Reply', icon: 'plus' }] },
    { id: 1, day: 'Yesterday', actor: 'Linus Torvalds', avatar: { name: 'Linus Torvalds' }, title: 'created the opportunity', timeLabel: '16:03' }
  ];
}

// A dashboard card's feed: who did what, where, and when — no bodies, no actions.
function recentChanges() {
  return [
    { id: 'c3', actor: 'Ada Lovelace', avatar: { name: 'Ada Lovelace' }, title: 'replaced the power supply in rack R03', timeLabel: '12 min', metadata: ['Frankfurt', 'Maintenance'] },
    { id: 'c2', actor: 'Grace Hopper', avatar: { name: 'Grace Hopper' }, title: 'raised the uplink to 10 Gb/s', timeLabel: '1 h', metadata: ['Berlin'] },
    { id: 'c1', actor: 'Linus Torvalds', avatar: { name: 'Linus Torvalds' }, title: 'retired two switches', timeLabel: 'Yesterday', state: 'pending', metadata: ['Amsterdam'] },
    // An agent's entry: `face` draws it as its generated AgentAvatar.
    { id: 'c0', actor: 'Warden', avatar: { name: 'Warden', face: { seed: 'agt-warden' } }, title: 'verified last night’s backups', timeLabel: 'Yesterday', metadata: ['All sites'] }
  ];
}

// A team where people and agents work side by side. An agent's avatar carries `face` — its
// generated AgentAvatar, seeded by its id — and `activity`, what it is doing now.
function teamFeed() {
  return [
    { id: 't4', day: 'Today', actor: 'Ledger', avatar: { name: 'Ledger', face: { seed: 'agt-ledger', material: 'soft' }, activity: 'needs-you' },
      title: 'matched 238 of 240 freight invoices', content: 'Two invoices differ from the ledger and wait for your review.',
      timeLabel: '10:24', metadata: ['Finance', 'Reconciliation'], actions: [{ id: 'review', label: 'Review', icon: 'check' }] },
    { id: 't3', day: 'Today', actor: 'Ada Lovelace', avatar: { name: 'Ada Lovelace' }, title: 'approved the September close', timeLabel: '10:02', metadata: ['Finance'] },
    { id: 't2', day: 'Today', actor: 'Scout', avatar: { name: 'Scout', face: { seed: 'agt-scout', material: 'soft' }, activity: 'working' },
      title: 'is auditing 14 supplier contracts', timeLabel: '09:40', metadata: ['Purchasing'] },
    { id: 't1', day: 'Yesterday', actor: 'Quill', avatar: { name: 'Quill', face: { seed: 'agt-quill', material: 'soft' }, activity: 'offline' },
      title: 'published the 4.2 release notes', timeLabel: '17:12', metadata: ['Product'] }
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
    },
    {
      title: 'People and agents in one feed',
      blurb: 'An agent\'s entry carries face on its avatar: the actor is drawn as its generated '
        + 'AgentAvatar, and activity puts what it is doing on the face and the dot. People keep '
        + 'their initials, so the two read apart at a glance.',
      layout: 'stack',
      width: '700px',
      render: ({ cleanup, log }) => {
        let next = 5;
        const list = new ActivityList(null, {
          items: teamFeed(),
          groupBy: 'day',
          label: 'Team activity',
          ondatachange: ({ detail }) => log(`${detail.items.length} activities`)
        });
        cleanup(() => list.destroy());
        return [
          list.toElement(),
          h('div', { class: 'demo-row' },
            button({ label: 'Scout finishes', onclick: () => list.prependItems({
              id: `t${next++}`, day: 'Today', actor: 'Scout',
              avatar: { name: 'Scout', face: { seed: 'agt-scout', material: 'soft' }, activity: 'idle' },
              title: 'finished the supplier audit', content: 'Three contracts renew in October without a price review.',
              timeLabel: 'Just now', metadata: ['Purchasing']
            }) }))
        ];
      }
    },
    {
      title: 'Compact, in a narrow card',
      blurb: 'The compact variant keeps every entry on one line at any width: who and what read as '
        + 'one sentence, the time stays at the trailing end instead of dropping under the title, '
        + 'the avatar is small, and metadata follows as a muted second line. Use it for a summary '
        + 'card narrower than 30rem.',
      layout: 'stack',
      width: '360px',
      render: ({ cleanup }) => {
        const list = new ActivityList(null, {
          items: recentChanges(),
          variant: 'compact',
          label: 'Recent changes'
        });
        cleanup(() => list.destroy());
        return h('div', { class: 'demo-card' }, list.toElement());
      }
    }
  ]
};
