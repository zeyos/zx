import { Breadcrumb, Finder, h } from '../../src/index.js';

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
            { ID: 'c-alpine', name: 'Alpine Works — MSA.pdf' },
            { ID: 'c-danube', name: 'Danube Systems — SLA.pdf' }
          ]
        },
        { ID: 'contracts-2025', name: '2025', children: [{ ID: 'c-kestrel', name: 'Kestrel — Reseller.pdf' }] }
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
            { ID: 'p-spec', name: 'Specification.md' },
            { ID: 'p-assets', name: 'Assets', children: [{ ID: 'p-plan', name: 'floorplan.svg' }] }
          ]
        },
        { ID: 'p-portal', name: 'Customer portal', children: [{ ID: 'p-brief', name: 'Brief.docx' }] }
      ]
    },
    { ID: 'readme', name: 'README.md' }
  ];
}

const DEEP = [
  { name: 'home', label: 'ZeyOS', icon: 'folder' },
  { name: 'sales', label: 'Sales' },
  { name: 'accounts', label: 'Accounts' },
  { name: 'alpine', label: 'Alpine Works GmbH' },
  { name: 'quotations', label: 'Quotations' },
  { name: 'q-2026-118', label: 'QU-2026-118' }
];

export default {
  title: 'Breadcrumb',
  group: 'Layout',
  blurb: 'The trail of ancestors above the current page, with the middle levels collapsing into '
    + 'an ellipsis menu when there is no room for all of them.',

  examples: [
    {
      title: 'Ancestor trail',
      blurb: 'The last item is the page you are on: plain text marked aria-current="page", never '
        + 'interactive. Every other item is a button, or a real <a> when it carries an href \u2014 the '
        + 'component reports the choice and lets the browser follow the link.',
      layout: 'stack',
      render: ({ cleanup, log }) => {
        const trail = new Breadcrumb(null, {
          items: DEEP.slice(0, 4),
          onselect: ({ detail }) => log(`select: ${detail.name} (index ${detail.index})`)
        });
        cleanup(() => trail.destroy());
        return [
          trail.toElement(),
          h('div', { class: 'demo-row' },
            h('button', {
              type: 'button',
              onclick: () => {
                trail.push({ name: `level-${trail.getItems().length}`, label: 'Deeper level' });
                log(`push \u2192 ${trail.getItems().length} items`);
              }
            }, 'push(\u2026)'),
            h('button', {
              type: 'button',
              onclick: () => log(`pop \u2192 ${trail.pop()?.label ?? 'nothing left'}`)
            }, 'pop()'))
        ];
      }
    },
    {
      title: 'Collapsing the middle',
      blurb: 'maxVisible caps how many levels are shown inline; the rest move into an ellipsis '
        + 'menu, so the first and last crumbs \u2014 the two that orient a reader \u2014 always survive. '
        + 'separator: "slash" swaps the chevron for a slash.',
      render: ({ cleanup, log }) => {
        const trail = new Breadcrumb(null, {
          items: DEEP,
          maxVisible: 3,
          separator: 'slash',
          onselect: ({ detail }) => log(`select: ${detail.item.label}`)
        });
        cleanup(() => trail.destroy());
        return trail.toElement();
      }
    },
    {
      title: 'Driven by a Finder',
      blurb: 'This is the pairing the component exists for: the Finder reports its path, the '
        + 'Breadcrumb shows it, and choosing a crumb sets the path back. Crumb 0 is a synthetic '
        + 'root, so the slice starts at 1.',
      layout: 'stack',
      render: ({ cleanup, log }) => {
        const finder = new Finder(null, {
          items: library(),
          rootLabel: 'Library',
          height: 240,
          path: ['projects', 'p-warehouse']
        });
        const path = new Breadcrumb(null, { rootIcon: 'folder' });

        const showPath = (nodes) => path.setItems([
          { name: '#root', label: 'Library' },
          ...nodes.map((node) => ({ name: String(node.ID), label: node.name }))
        ]);
        finder.on('change', ({ detail }) => showPath(detail.nodes));
        path.on('select', ({ detail }) => {
          void finder.setPath(path.getItems().slice(1, detail.index + 1).map((item) => item.name));
          log(`crumb \u2192 ${detail.item.label}`);
        });
        showPath(finder.getNodes());

        cleanup(() => [finder, path].forEach((component) => component.destroy()));
        return [path.toElement(), finder.toElement()];
      }
    }
  ]
};
