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
    + 'the way a file browser’s column view works.',

  /**
   * Mounts a document browser with a preview pane and a compact variant.
   * @param {HTMLElement} container Demo stage.
   * @returns {void}
   */
  mount(container) {
    const log = output('Pick a folder, then press → to step into it and ← to go back.');
    const breadcrumb = h('p', { style: {
      margin: '0', color: 'var(--zx-color-text-muted)', fontSize: 'var(--zx-text-sm)'
    } }, 'No selection');

    /** @param {{name: string}[]} nodes @returns {void} */
    const showBreadcrumb = (nodes) => {
      breadcrumb.textContent = nodes.length === 0
        ? 'No selection'
        : nodes.map((node) => node.name).join('  ›  ');
    };

    const browser = new Finder(null, {
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
          h('dt', {}, 'Size'), h('dd', {}, node.size ?? '—'),
          h('dt', {}, 'Owner'), h('dd', {}, node.owner ?? '—'),
          h('dt', {}, 'Changed'), h('dd', {}, node.changed ?? '—'))),
      onchange: (event) => {
        showBreadcrumb(event.detail.nodes);
        write(log, `path → [${event.detail.path.join(', ')}]`);
      },
      onactivate: (event) => write(log, `opened → ${event.detail.node.name}`)
    });

    const compact = new Finder(null, {
      items: library(),
      columnWidth: 170,
      height: 240,
      icons: false,
      rootLabel: 'Modules'
    });

    // The constructor applies `path` silently, so the breadcrumb needs its first paint here.
    showBreadcrumb(browser.getNodes());

    container.append(
      section('Document browser',
        breadcrumb,
        browser.toElement(),
        note('Selecting a leaf renders the preview pane on the right. “Reports” has no children '
          + 'until it is opened, at which point `load(node)` fills its column.'),
        row(
          h('button', {
            class: 'zx-btn',
            type: 'button',
            onclick: () => void browser.reveal('p-logo')
          }, "reveal('p-logo')"),
          h('button', {
            class: 'zx-btn',
            type: 'button',
            onclick: () => void browser.setPath(['contracts', 'contracts-2026', 'c-alpine'])
          }, 'setPath(…)'),
          h('button', { class: 'zx-btn', type: 'button', onclick: () => browser.focus() }, 'focus()')
        )),
      section('Compact, no preview',
        compact.toElement(),
        note('Without a `preview` renderer the component is just the columns, which suits a '
          + 'module or category picker embedded in a form.')),
      section('Keyboard',
        note('↑ and ↓ move inside a column. → steps into the selected branch and lands on its '
          + 'first row; ← returns to the parent column and truncates the path. Home and End jump '
          + 'to the ends of the active column, Enter opens a leaf, and typing jumps to the next '
          + 'matching row. There is one tab stop for the whole component.')),
      log
    );
  }
};

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
