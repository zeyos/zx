import { EntityRef, h } from '../../src/index.js';

// Identity, navigation, and permitted actions arrive from the host. EntityRef only presents them.
function customerReference(log) {
  return {
    id: 'customer-1042',
    title: 'Northwind GmbH',
    subtitle: 'Strategic customer',
    icon: 'folder',
    link: { href: '#customer-1042' },
    metadata: [
      { label: 'Owner', value: 'Ada Lovelace' },
      { label: 'Region', value: 'DACH' }
    ],
    actions: [
      { id: 'open', label: 'Open', icon: 'eye' },
      { id: 'more', title: 'More customer actions', icon: 'dots' }
    ],
    onactivate: (event) => {
      event.preventDefault();
      log(`navigate ${event.detail.href}`);
    },
    onaction: ({ detail }) => log(`${detail.id} ${detail.entity.title}`)
  };
}

export default {
  title: 'Entity reference',
  group: 'Data',
  api: ['EntityRef'],
  blurb: 'Dense linked or static record identity with labelled metadata and host-injected actions.',
  examples: [
    {
      title: 'Linked customer with actions',
      blurb: 'The primary destination stays a native link. Routing and authorization are injected; '
        + 'canceling activate lets a client router take over without losing link semantics.',
      width: '620px',
      render: ({ cleanup, log }) => {
        const reference = new EntityRef(null, customerReference(log));
        cleanup(() => reference.destroy());
        return reference.toElement();
      }
    },
    {
      title: 'Static identities and sizes',
      blurb: 'The same primitive fits a dense table cell or a roomier activity header. Missing links '
        + 'produce plain text rather than a button-shaped imitation.',
      layout: 'stack',
      render: ({ cleanup }) => {
        const references = [
          new EntityRef(null, { title: 'Ada Lovelace', subtitle: 'Account owner', icon: 'star', size: 'sm' }),
          new EntityRef(null, {
            title: 'Project Aurora', subtitle: 'Implementation project', icon: 'folder', size: 'md',
            metadata: [{ label: 'Status', value: 'Active', showLabel: false }]
          }),
          new EntityRef(null, {
            title: 'A deliberately long entity name that may wrap in a narrow detail pane',
            subtitle: h('span', {}, 'Organisation · Vienna'), icon: 'folder', size: 'lg', wrap: true
          })
        ];
        cleanup(() => references.forEach((reference) => reference.destroy()));
        return references.map((reference) => reference.toElement());
      }
    }
  ]
};
