import { Finder, h } from '../../src/index.js';

/** @returns {import('../../src/components/tree/hierarchy.js').TreeNode[]} */
function library() {
  return [
    {
      ID: 'contracts',
      name: 'Contracts',
      children: [
        {
          ID: 'contracts-2026',
          name: '2026',
          children: [
            { ID: 'c-alpine', name: 'Alpine Works — MSA.pdf', size: '184 kB', owner: 'N. Roth', changed: '12 Jul 2026' },
            { ID: 'c-danube', name: 'Danube Systems — SLA.pdf', size: '96 kB', owner: 'T. Kern', changed: '4 Jul 2026' }
          ]
        },
        {
          ID: 'contracts-2025',
          name: '2025',
          children: [
            { ID: 'c-kestrel', name: 'Kestrel — Reseller.pdf', size: '212 kB', owner: 'O. Blythe', changed: '19 Nov 2025' }
          ]
        }
      ]
    },
    {
      ID: 'projects',
      name: 'Projects',
      children: [
        {
          ID: 'p-warehouse',
          name: 'Warehouse rollout',
          children: [
            { ID: 'p-spec', name: 'Specification.md', size: '38 kB', owner: 'T. Kern', changed: '2 Aug 2026' },
            { ID: 'p-plan', name: 'Migration plan.xlsx', size: '74 kB', owner: 'I. Bauer', changed: '28 Jul 2026' },
            { ID: 'p-assets', name: 'Assets', children: [
              { ID: 'p-logo', name: 'floorplan.svg', size: '12 kB', owner: 'C. Fournier', changed: '9 Jun 2026' }
            ] }
          ]
        },
        { ID: 'p-portal', name: 'Customer portal', children: [
          { ID: 'p-brief', name: 'Brief.docx', size: '22 kB', owner: 'M. Silva', changed: '30 Jun 2026' }
        ] }
      ]
    },
    { ID: 'reports', name: 'Reports (loads on demand)', hasChildren: true },
    { ID: 'readme', name: 'README.md', size: '3 kB', owner: 'System', changed: '1 Jan 2026' }
  ];
}

export default {
  title: 'Finder',
  group: 'Data',
  blurb: 'A Miller-columns browser: every column lists the children of the row picked to its left, '
    + 'the way a file browser\u2019s column view works.',

  examples: [
    {
      title: 'Document browser with a preview',
      blurb: 'Pick a folder, then press \u2192 to step into it and \u2190 to go back. preview draws the '
        + 'trailing pane for a leaf, and load fetches a branch\u2019s children the first time it is '
        + 'opened \u2014 \u201cReports\u201d is lazy here.',
      render: ({ cleanup, log }) => {
        const finder = new Finder(null, {
          items: library(),
          path: ['projects', 'p-warehouse'],
          rootLabel: 'Library',
          height: 340,
          load: async (node) => {
            await new Promise((resolve) => setTimeout(resolve, 300));
            return [
              { ID: `${node.ID}-q1`, name: 'Q1 summary.pdf', size: '48 kB', owner: 'Finance', changed: '2 Apr 2026' },
              { ID: `${node.ID}-q2`, name: 'Q2 summary.pdf', size: '51 kB', owner: 'Finance', changed: '3 Jul 2026' }
            ];
          },
          preview: (node) => h('div', { style: { display: 'grid', gap: 'var(--zx-space-3)' } },
            h('strong', { style: { fontSize: 'var(--zx-text-lg)' } }, node.name),
            h('dl', { class: 'summary-list' },
              h('dt', {}, 'Size'), h('dd', {}, node.size ?? '\u2014'),
              h('dt', {}, 'Owner'), h('dd', {}, node.owner ?? '\u2014'),
              h('dt', {}, 'Changed'), h('dd', {}, node.changed ?? '\u2014'))),
          onchange: ({ detail }) => log(`path \u2192 [${detail.path.join(', ')}]`),
          onactivate: ({ detail }) => log(`activate \u2192 ${detail.node.name}`)
        });
        cleanup(() => finder.destroy());
        return finder.toElement();
      }
    },
    {
      title: 'Compact columns',
      blurb: 'columnWidth narrows the columns and icons: false drops the glyphs \u2014 the shape for '
        + 'a picker inside a dialog, where the Finder is a control rather than the page.',
      render: ({ cleanup }) => {
        const finder = new Finder(null, {
          items: library(),
          columnWidth: 170,
          height: 240,
          icons: false,
          rootLabel: 'Modules'
        });
        cleanup(() => finder.destroy());
        return finder.toElement();
      }
    }
  ]
};
