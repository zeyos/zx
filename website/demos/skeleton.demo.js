import { Table, button, h, skeleton, skeletonTable, skeletonText } from '../../src/index.js';

export default {
  title: 'Skeleton',
  group: 'Layout',
  api: ['Skeleton', 'SkeletonText', 'SkeletonTable'],
  blurb: 'Placeholders shaped like the content that is coming, so the layout does not jump when '
    + 'it arrives. Every skeleton is aria-hidden — set aria-busy on the region instead.',

  examples: [
    {
      title: 'Text and blocks',
      blurb: 'skeletonText() stacks lines and shortens the last one, so the block reads as prose '
        + 'rather than as a filled rectangle. skeleton() is the single block behind it: give it a '
        + 'width and height, or equal sides and radius "full" for an avatar.',
      render: () => [
        h('div', { class: 'demo-field' }, h('span', {}, 'A paragraph'),
          skeletonText({ lines: 3, width: 320 })),
        h('div', { class: 'demo-field' }, h('span', {}, 'Heading plus body'),
          skeletonText({ lines: 3, heading: true, width: 320 })),
        h('div', { class: 'demo-field' }, h('span', {}, 'Single blocks'),
          h('div', { class: 'demo-row' },
            skeleton({ width: 40, height: 40, radius: 'full' }),
            skeleton({ width: 120, height: 32, radius: 'md' })))
      ]
    },
    {
      title: 'A card that has not loaded',
      blurb: 'Skeletons are worth more than a spinner exactly when the shape is already known. '
        + 'Compose them with the same layout the real content uses and nothing moves on arrival.',
      render: () => h('div', { class: 'demo-card', style: 'inline-size: 320px' },
        h('div', { class: 'demo-row' },
          skeleton({ width: 40, height: 40, radius: 'full' }),
          skeletonText({ lines: 2, width: 200 })),
        skeletonText({ lines: 3 })
      )
    },
    {
      title: 'Standing in for a table',
      blurb: 'skeletonTable() draws the grid a table will fill. It is deliberately not a <table>: '
        + 'there is no data to expose, and a table of empty cells is worse for a screen reader '
        + 'than no table at all. The region carries aria-busy while the placeholder is up.',
      render: ({ cleanup, log }) => {
        const host = h('div', { class: 'demo-card', style: 'inline-size: 100%' });
        let table = null;

        const showSkeleton = () => {
          table?.destroy();
          table = null;
          host.setAttribute('aria-busy', 'true');
          host.replaceChildren(skeletonTable({ rows: 4, columns: 4 }));
        };
        const showData = () => {
          host.removeAttribute('aria-busy');
          table = new Table(null, {
            columns: [
              { id: 'number', label: 'Invoice' },
              { id: 'customer', label: 'Customer' },
              { id: 'due', label: 'Due' },
              { id: 'total', label: 'Total', align: 'end' }
            ],
            data: [
              { number: 'INV-1042', customer: 'Nordwind GmbH', due: '2026-09-01', total: '1 240.00' },
              { number: 'INV-1043', customer: 'Halbe Systeme', due: '2026-09-04', total: '880.50' },
              { number: 'INV-1044', customer: 'Kestrel Ltd', due: '2026-09-11', total: '3 105.00' },
              { number: 'INV-1045', customer: 'Aurora AB', due: '2026-09-12', total: '640.00' }
            ]
          });
          host.replaceChildren(table.toElement());
          log('data arrived');
        };

        showSkeleton();
        const timer = setTimeout(showData, 1600);
        cleanup(() => {
          clearTimeout(timer);
          table?.destroy();
        });
        return [
          host,
          h('div', { class: 'demo-row' },
            button({ label: 'Load again', onclick: () => { showSkeleton(); setTimeout(showData, 1600); } }))
        ];
      }
    }
  ]
};
