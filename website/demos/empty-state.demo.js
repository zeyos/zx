import { Panel, button, emptyState, h } from '../../src/index.js';

export default {
  title: 'EmptyState',
  group: 'Layout',

  /**
   * Mounts the size and alignment variants, action forms, and a panel-hosted empty state.
   * @param {HTMLElement} container Demo stage.
   * @returns {void}
   */
  mount(container) {
    const log = output('Press an action to see which empty state it came from.');

    const panel = new Panel(null, {
      title: 'Attachments',
      content: emptyState({
        icon: 'upload',
        size: 'sm',
        title: 'No attachments',
        description: 'Drop a file here or upload one from your computer.',
        actions: [
          { label: 'Upload file', icon: 'upload', kind: 'primary', size: 'sm',
            onclick: () => { log.textContent = 'Panel empty state: upload'; } }
        ]
      })
    });

    const marker = h('div', {},
      section('Sizes',
        note('`emptyState()` returns a plain element you drop wherever the content would have '
          + 'been — a table body, a panel, a whole page. Its headline is a paragraph, not a '
          + 'heading, so nesting one never disturbs the page outline.'),
        frame(emptyState({
          title: 'No invoices yet',
          description: 'Invoices you create or import appear here. Nothing has been recorded for '
            + 'this account in the selected period.'
        })),
        frame(emptyState({
          size: 'sm',
          icon: 'search',
          title: 'No matches',
          description: 'No record matches the current filter.'
        }))),

      section('Alignment',
        note('`align: "start"` suits a narrow column or a panel body, where centred text reads as '
          + 'a mistake. Everything else stays the same.'),
        grid(
          frame(emptyState({
            align: 'start',
            icon: 'folder-open',
            title: 'Empty folder',
            description: 'Move a document here to get started.'
          })),
          frame(emptyState({
            align: 'start',
            size: 'sm',
            icon: 'tag',
            title: 'No labels',
            description: 'Labels group records across modules.'
          })))),

      section('With and without actions',
        note('`actions` takes button descriptors, ready-made Elements, or both. Leave it out for '
          + 'a purely informational placeholder, and drop the icon with `icon: null` where the '
          + 'surrounding layout already carries one.'),
        frame(emptyState({
          icon: 'plus',
          title: 'Start your first project',
          description: 'A project collects tasks, documents, and time entries in one place.',
          actions: [
            { label: 'New project', icon: 'plus', kind: 'primary',
              onclick: () => { log.textContent = 'Projects: new project'; } },
            { label: 'Import', icon: 'upload',
              onclick: () => { log.textContent = 'Projects: import'; } },
            button({
              label: 'Read the guide',
              kind: 'ghost',
              onclick: () => { log.textContent = 'Projects: guide (an Element action)'; }
            })
          ]
        })),
        frame(emptyState({
          icon: null,
          size: 'sm',
          align: 'start',
          title: 'Nothing to approve',
          description: 'Approvals assigned to you will show up here.'
        })),
        log),

      section('Inside a panel',
        note('Sized down and left-aligned, an empty state fills a panel body without competing '
          + 'with the panel title.'),
        h('div', { style: { maxInlineSize: '420px' } }, panel.toElement()))
    );

    container.append(marker);
    cleanupWhenRemoved(marker, () => panel.destroy());
  }
};

/** @param {Node} child @returns {HTMLElement} */
function frame(child) {
  return h('div', {
    style: {
      border: '1px dashed var(--zx-color-border)', borderRadius: 'var(--zx-radius-lg)',
      background: 'var(--zx-color-bg-surface)'
    }
  }, child);
}

/** @param {...Node} children @returns {HTMLElement} */
function grid(...children) {
  return h('div', {
    style: {
      display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
      gap: 'var(--zx-space-4)'
    }
  }, children);
}

/** @param {string} title @param {...Node} children @returns {HTMLElement} */
function section(title, ...children) {
  return h('section', {
    style: {
      display: 'grid', gap: 'var(--zx-space-4)', marginBlockEnd: 'var(--zx-space-6)',
      border: '1px solid var(--zx-color-border)', borderRadius: 'var(--zx-radius-lg)',
      background: 'var(--zx-color-bg-page)', padding: 'var(--zx-space-5)'
    }
  }, h('h2', { style: { margin: '0', fontSize: 'var(--zx-text-xl)' } }, title), children);
}

/** @param {string} text @returns {HTMLElement} */
function note(text) {
  return h('p', {
    style: {
      margin: '0', maxInlineSize: '78ch', color: 'var(--zx-color-text-muted)', lineHeight: '1.7'
    }
  }, text);
}

/** @param {string} text @returns {HTMLOutputElement} */
function output(text) {
  return /** @type {HTMLOutputElement} */ (h('output', {
    ariaLive: 'polite', style: { display: 'block', color: 'var(--zx-color-text-muted)' }
  }, text));
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
