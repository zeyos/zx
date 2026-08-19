import { Search, TreeView, h } from '../../src/index.js';

/** @returns {import('../../src/components/tree/hierarchy.js').TreeNode[]} */
function catalogue() {
  return [
    {
      ID: 'sales',
      name: 'Sales',
      children: [
        { ID: 'leads', name: 'Leads', badge: 24 },
        {
          ID: 'quotes',
          name: 'Quotations',
          children: [
            { ID: 'q-draft', name: 'Drafts', badge: 3 },
            { ID: 'q-sent', name: 'Sent' },
            { ID: 'q-won', name: 'Won' }
          ]
        },
        { ID: 'orders', name: 'Orders', badge: 11 }
      ]
    },
    {
      ID: 'billing',
      name: 'Billing',
      children: [
        { ID: 'invoices', name: 'Invoices', badge: 67 },
        { ID: 'credits', name: 'Credit notes' },
        { ID: 'dunning', name: 'Dunning' }
      ]
    },
    {
      ID: 'inventory',
      name: 'Inventory',
      children: [
        { ID: 'articles', name: 'Articles' },
        { ID: 'warehouses', name: 'Warehouses', children: [
          { ID: 'wh-lnz', name: 'Linz' },
          { ID: 'wh-vie', name: 'Vienna' }
        ] }
      ]
    },
    { ID: 'archive', name: 'Archive (loads on demand)', hasChildren: true }
  ];
}

export default {
  title: 'Tree view',
  group: 'Data',
  api: ['TreeView'],
  blurb: 'A hierarchy following the APG tree pattern: arrow-key navigation, expand and collapse, '
    + 'typeahead, lazy children, and optional tri-state checkboxes.',

  examples: [
    {
      title: 'Navigation tree',
      blurb: '\u201cArchive\u201d is marked hasChildren without any children, so it shows a twisty and '
        + 'calls load(node) the first time it opens. Enter activates a node, * expands every '
        + 'sibling, and typing jumps to the next matching row.',
      layout: 'stack',
      render: ({ cleanup, log }) => {
        const tree = new TreeView(null, {
          items: catalogue(),
          expanded: ['sales', 'quotes'],
          selected: ['q-draft'],
          height: 300,
          load: async (node) => {
            await new Promise((resolve) => setTimeout(resolve, 350));
            return [2024, 2025, 2026].map((year) => ({ ID: `${node.ID}-${year}`, name: String(year) }));
          },
          onselect: ({ detail }) => log(`select \u2192 ${detail.node.name}`),
          onexpand: ({ detail }) => log(`expand \u2192 ${detail.node.name}`),
          onactivate: ({ detail }) => log(`activate \u2192 ${detail.node.name}`)
        });
        cleanup(() => tree.destroy());
        return [
          tree.toElement(),
          h('div', { class: 'demo-row' },
            h('button', { type: 'button', onclick: () => tree.expandAll() }, 'expandAll()'),
            h('button', { type: 'button', onclick: () => tree.collapseAll() }, 'collapseAll()'),
            h('button', { type: 'button', onclick: () => tree.focusNode('wh-vie') }, "focusNode('wh-vie')"))
        ];
      }
    },
    {
      title: 'Tri-state checkboxes',
      blurb: 'Checking a branch checks its whole sub-tree, and a branch shows the mixed state '
        + 'whenever only some descendants are checked. getChecked({leavesOnly: true}) returns just '
        + 'the leaves, which is usually what a permission payload wants.',
      render: ({ cleanup, log }) => {
        const tree = new TreeView(null, {
          items: catalogue().slice(0, 3),
          expanded: ['sales', 'billing'],
          checkboxes: true,
          selection: false,
          checked: ['leads', 'invoices'],
          icons: false,
          height: 300,
          oncheck: ({ detail }) => log(`check \u2192 [${detail.ids.join(', ')}]`)
        });
        cleanup(() => tree.destroy());
        return tree.toElement();
      }
    },
    {
      title: 'Filtering',
      blurb: 'setFilter() keeps every ancestor that leads to a match and opens the surviving '
        + 'branches, so a match is never hidden behind a collapsed parent.',
      layout: 'stack',
      render: ({ cleanup }) => {
        const tree = new TreeView(null, { items: catalogue(), height: 260 });
        const search = new Search(null, {
          placeholder: 'Filter the tree',
          oninput: ({ detail }) => tree.setFilter(detail.value),
          onclear: () => tree.setFilter('')
        });
        cleanup(() => [tree, search].forEach((component) => component.destroy()));
        return [search.toElement(), tree.toElement()];
      }
    }
  ]
};
