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

  /**
   * Mounts a plain trail, a collapsed trail, and a Finder driving a Breadcrumb.
   * @param {HTMLElement} container Demo stage.
   * @returns {void}
   */
  mount(container) {
    const log = output('Pick an ancestor — the last crumb is the page you are on, so it is inert.');

    // 1 — a plain trail. Crumbs without an href are buttons the application resolves itself.
    const trail = new Breadcrumb(null, {
      items: DEEP.slice(0, 4),
      onselect: (event) => write(log, `select: ${event.detail.name} (index ${event.detail.index})`)
    });

    // 2 — the same trail with a cap on how many levels are shown inline.
    const collapsed = new Breadcrumb(null, {
      items: DEEP,
      maxVisible: 3,
      separator: 'slash',
      onselect: (event) => write(log, `collapsed select: ${event.detail.item.label}`)
    });

    // 3 — a Finder driving a Breadcrumb, which is the whole point of the pairing.
    const finder = new Finder(null, {
      items: library(),
      rootLabel: 'Library',
      height: 240,
      path: ['projects', 'p-warehouse']
    });
    const path = new Breadcrumb(null, { rootIcon: 'folder' });

    /** @param {{name: string}[]} nodes @returns {void} */
    const showPath = (nodes) => path.setItems([
      { name: '#root', label: 'Library' },
      ...nodes.map((node) => ({ name: String(node.ID), label: node.name }))
    ]);

    finder.on('change', (event) => showPath(event.detail.nodes));
    path.on('select', (event) => {
      // Everything after the chosen crumb is dropped; crumb 0 is the synthetic root.
      void finder.setPath(path.getItems().slice(1, event.detail.index + 1).map((item) => item.name));
    });
    // The constructor applies `path` silently, so the trail needs its first paint here.
    showPath(finder.getNodes());

    const marker = h('div', {},
      section('Ancestor trail',
        note('The last item is the page you are on: plain text marked aria-current="page", never '
          + 'interactive. Every other item is a button, or a real <a> when it carries an href — '
          + 'the component reports the choice and lets the browser follow the link.'),
        trail.toElement(),
        row(
          h('button', {
            class: 'zx-btn',
            type: 'button',
            onclick: () => {
              trail.push({ name: `level-${trail.getItems().length}`, label: 'Deeper level' });
              write(log, `push → ${trail.getItems().length} items`);
            }
          }, 'push(…)'),
          h('button', {
            class: 'zx-btn',
            type: 'button',
            onclick: () => write(log, `pop → ${trail.pop()?.label ?? 'nothing left'}`)
          }, 'pop()'),
          h('button', {
            class: 'zx-btn',
            type: 'button',
            onclick: () => {
              if (!trail.getItems().some((item) => item.name === 'sales')) {
                trail.setItems(DEEP.slice(0, 4));
              }
              trail.truncateTo('sales');
              write(log, 'truncateTo("sales")');
            }
          }, 'truncateTo("sales")'))),
      section('Collapsed levels',
        note('maxVisible: 3 keeps the first and the last item and folds everything between them '
          + 'into an ellipsis menu, so a deep trail never wraps a toolbar. separator: "slash" '
          + 'swaps the chevron for a rule.'),
        collapsed.toElement()),
      section('Driven by a Finder',
        note('A Finder emits change {path, nodes, node}; feeding nodes into setItems() is the '
          + 'whole integration. Selecting a crumb maps back the other way, calling setPath() with '
          + 'the names up to the chosen level.'),
        path.toElement(),
        finder.toElement()),
      log);

    container.append(marker);
    cleanupWhenRemoved(marker, () => {
      trail.destroy();
      collapsed.destroy();
      path.destroy();
      finder.destroy();
    });
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

/** @param {Node} marker @param {() => void} cleanup @returns {void} */
function cleanupWhenRemoved(marker, cleanup) {
  const observer = new MutationObserver(() => {
    if (marker.isConnected) return;
    cleanup();
    observer.disconnect();
  });
  observer.observe(document.body, { childList: true, subtree: true });
}
