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
  blurb: 'A hierarchy following the APG tree pattern: arrow-key navigation, expand and collapse, '
    + 'typeahead, lazy children, and optional tri-state checkboxes.',

  /**
   * Mounts a navigation tree, a checkbox tree, and a filtered tree.
   * @param {HTMLElement} container Demo stage.
   * @returns {void}
   */
  mount(container) {
    const log = output('Click a node, or use ↑ ↓ ← → and start typing to jump.');

    const navigation = new TreeView(null, {
      items: catalogue(),
      expanded: ['sales', 'quotes'],
      selected: ['q-draft'],
      height: 300,
      load: async (node) => {
        // Lazy branches ask for their children the first time they open.
        await new Promise((resolve) => setTimeout(resolve, 350));
        return [
          { ID: `${node.ID}-2024`, name: '2024' },
          { ID: `${node.ID}-2025`, name: '2025' },
          { ID: `${node.ID}-2026`, name: '2026' }
        ];
      },
      onselect: (event) => write(log, `selected → ${event.detail.node.name}`),
      onexpand: (event) => write(log, `expanded → ${event.detail.node.name}`),
      oncollapse: (event) => write(log, `collapsed → ${event.detail.node.name}`),
      onactivate: (event) => write(log, `activated → ${event.detail.node.name}`)
    });

    const permissions = new TreeView(null, {
      items: catalogue().slice(0, 3),
      expanded: ['sales', 'billing'],
      checkboxes: true,
      selection: false,
      checked: ['leads', 'invoices'],
      icons: false,
      height: 300,
      oncheck: (event) => write(log, `checked → [${event.detail.ids.join(', ')}]`)
    });

    const filtered = new TreeView(null, { items: catalogue(), height: 260 });
    const search = new Search(null, {
      placeholder: 'Filter the tree',
      oninput: (event) => filtered.setFilter(event.detail.value),
      onclear: () => filtered.setFilter('')
    });

    container.append(
      section('Navigation tree',
        panel(navigation.toElement()),
        note('“Archive” is marked `hasChildren` without any children, so it shows a twisty and '
          + 'calls `load(node)` the first time it opens. Enter activates a node, `*` expands every '
          + 'sibling, and typing jumps to the next matching row.'),
        row(
          h('button', { class: 'zx-btn', type: 'button', onclick: () => navigation.expandAll() },
            'expandAll()'),
          h('button', { class: 'zx-btn', type: 'button', onclick: () => navigation.collapseAll() },
            'collapseAll()'),
          h('button', {
            class: 'zx-btn',
            type: 'button',
            onclick: () => navigation.focusNode('wh-vie')
          }, "focusNode('wh-vie')")
        )),
      section('Tri-state checkboxes',
        panel(permissions.toElement()),
        note('Checking a branch checks its whole sub-tree; a branch shows the mixed state whenever '
          + 'only some descendants are checked. `getChecked({ leavesOnly: true })` returns just the '
          + 'leaves, which is usually what a permission payload wants.')),
      section('Filtering',
        search.toElement(),
        panel(filtered.toElement()),
        note('`setFilter()` keeps every ancestor that leads to a match and opens the surviving '
          + 'branches, so matches are never hidden behind a collapsed parent.')),
      log
    );
  }
};

/** @param {Node} content @returns {HTMLElement} */
function panel(content) {
  return h('div', { style: {
    maxInlineSize: '420px', border: '1px solid var(--zx-color-border)',
    borderRadius: 'var(--zx-radius-lg)', background: 'var(--zx-color-bg-page)',
    padding: 'var(--zx-space-2)'
  } }, content);
}

/** @param {...Node} children @returns {HTMLElement} */
function row(...children) {
  return h('div', { style: {
    display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--zx-space-3)'
  } }, children);
}

/** @param {string} title @param {...Node} children @returns {HTMLElement} */
function section(title, ...children) {
  return h('section', { style: {
    display: 'grid', gap: 'var(--zx-space-4)', marginBlockEnd: 'var(--zx-space-6)',
    border: '1px solid var(--zx-color-border)', borderRadius: 'var(--zx-radius-lg)',
    background: 'var(--zx-color-bg-surface)', padding: 'var(--zx-space-5)'
  } }, h('h2', { style: { margin: '0', fontSize: 'var(--zx-text-xl)' } }, title), children);
}

/** @param {string} text @returns {HTMLElement} */
function note(text) {
  return h('p', { style: {
    margin: '0', maxInlineSize: '78ch', color: 'var(--zx-color-text-muted)', lineHeight: '1.7'
  } }, text);
}

/** @param {string} text @returns {HTMLOutputElement} */
function output(text) {
  return /** @type {HTMLOutputElement} */ (h('output', {
    ariaLive: 'polite', style: { display: 'block', color: 'var(--zx-color-text-muted)' }
  }, text));
}

/** @param {HTMLElement} log @param {string} text @returns {void} */
function write(log, text) {
  log.textContent = text;
}
