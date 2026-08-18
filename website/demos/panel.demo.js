import { MasterPanel, Panel, button, h } from '../../src/index.js';

export default {
  title: 'Panel',
  group: 'Layout',

  /**
   * Mounts collapsible, fixed, and footer panel variants.
   * @param {HTMLElement} container Demo stage.
   * @returns {void}
   */
  mount(container) {
    const log = output('Use a panel header or the API controls.');
    const account = new Panel(null, {
      title: 'Account summary',
      content: h('p', { style: { margin: '0' } },
        'This raised surface starts open and emits open and close events.')
    });
    const details = new Panel(null, {
      title: 'Optional details',
      content: h('p', { style: { margin: '0' } }, 'This panel starts collapsed.'),
      open: false
    });
    const status = new Panel(null, {
      title: 'System status',
      content: h('p', { style: { margin: '0' } }, 'All background jobs are healthy.'),
      collapsible: false
    });
    const approval = new Panel(null, {
      title: 'Approval',
      content: h('p', { style: { margin: '0' } }, 'Review the record before continuing.'),
      footer: h('small', {}, 'Last reviewed a few moments ago'),
      footerButtons: [
        { label: 'Reject', kind: 'danger', size: 'sm', onclick: () => { log.textContent = 'Approval: rejected'; } },
        { label: 'Approve', kind: 'primary', size: 'sm', onclick: () => { log.textContent = 'Approval: approved'; } }
      ]
    });
    // Header and footer actions live beside the collapse control, not inside it.
    const attachments = new Panel(null, {
      title: 'Attachments',
      content: h('p', { style: { margin: '0' } },
        'Header actions sit at the trailing edge of the header row. Clicking one does not '
        + 'collapse the panel — only the title area toggles.'),
      buttons: [
        { icon: 'reload', size: 'sm', kind: 'ghost', title: 'Refresh', onclick: () => { log.textContent = 'Attachments: refresh'; } },
        { label: 'Upload', icon: 'upload', size: 'sm', onclick: () => { log.textContent = 'Attachments: upload'; } }
      ],
      footer: h('small', {}, '3 files · 1.2 MB'),
      footerButtons: [
        { label: 'Download all', size: 'sm', onclick: () => { log.textContent = 'Attachments: download all'; } }
      ]
    });
    const panels = [account, details, status, approval, attachments];
    panels.forEach((panel) => {
      panel.on('open', () => { log.textContent = `${panel.refs.title.textContent}: open`; });
      panel.on('close', () => { log.textContent = `${panel.refs.title.textContent}: close`; });
    });

    const moduleLog = output('MasterPanel header actions report here.');
    const masterPanels = [
      masterPanel('Projects', 'projects', moduleLog),
      masterPanel('Billing', 'billing', moduleLog),
      masterPanel('Calendar', 'calendar', moduleLog)
    ];
    const marker = h('div', {},
      section('Panel variants', stack(...panels.map((panel) => panel.toElement()))),
      section('Programmatic API', row(
        h('button', { type: 'button', onclick: () => account.toggle() }, 'Toggle account'),
        h('button', { type: 'button', onclick: () => details.open() }, 'Open details'),
        h('button', {
          type: 'button',
          onclick: () => approval.setFooter('Footer replaced through setFooter()')
        }, 'Replace footer'),
        h('button', {
          type: 'button',
          onclick: () => attachments.setButtons([
            { label: 'Done', kind: 'primary', size: 'sm', onclick: () => { log.textContent = 'Attachments: done'; } }
          ])
        }, 'Replace header buttons')
      ), log),
      section('Full-height MasterPanel',
        h('p', { style: { margin: '0', color: 'var(--zx-color-text-muted)' } },
          'Each example has a different module accent. Its header and footer remain fixed while the body scrolls.'),
        h('div', { style: {
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 'var(--zx-space-4)'
        } }, masterPanels.map((panel) => h('div', {
          style: { minInlineSize: '0', blockSize: '360px' }
        }, panel))),
        moduleLog
      )
    );
    container.append(marker);
    cleanupWhenRemoved(marker, () => {
      panels.forEach((panel) => panel.destroy());
      masterPanels.forEach((panel) => panel.destroy());
    });
  }
};

/** @param {string} title @param {string} moduleName @param {HTMLOutputElement} log @returns {MasterPanel} */
function masterPanel(title, moduleName, log) {
  const extraAction = button({
    label: 'Export',
    size: 'sm',
    onclick: () => { log.textContent = `${title}: export`; }
  });
  return new MasterPanel(null, {
    title,
    module: moduleName,
    content: h('div', {}, Array.from({ length: 12 }, (_, index) => h('p', {},
      `${title} record ${index + 1}: scroll this content while watching the bars.`
    ))),
    buttons: [
      {
        label: 'Add',
        kind: 'primary',
        size: 'sm',
        onclick: () => { log.textContent = `${title}: add`; }
      },
      extraAction
    ],
    footer: `${title}: 12 records`
  });
}

/** @param {...Node} children @returns {HTMLElement} */
function stack(...children) {
  return h('div', { style: { display: 'grid', gap: 'var(--zx-space-4)' } }, children);
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
    display: 'grid', gap: 'var(--zx-space-4)', marginBlockEnd: 'var(--zx-space-6)'
  } }, h('h2', { style: { margin: '0', fontSize: 'var(--zx-text-xl)' } }, title), children);
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
