import { Panel, h } from '../../src/index.js';

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
      footer: h('small', {}, 'Last reviewed a few moments ago')
    });
    const panels = [account, details, status, approval];
    panels.forEach((panel) => {
      panel.on('open', () => { log.textContent = `${panel.refs.title.textContent}: open`; });
      panel.on('close', () => { log.textContent = `${panel.refs.title.textContent}: close`; });
    });

    const marker = h('div', {},
      section('Panel variants', stack(...panels.map((panel) => panel.toElement()))),
      section('Programmatic API', row(
        h('button', { type: 'button', onclick: () => account.toggle() }, 'Toggle account'),
        h('button', { type: 'button', onclick: () => details.open() }, 'Open details'),
        h('button', {
          type: 'button',
          onclick: () => approval.setFooter('Footer replaced through setFooter()')
        }, 'Replace footer')
      ), log)
    );
    container.append(marker);
    cleanupWhenRemoved(marker, () => panels.forEach((panel) => panel.destroy()));
  }
};

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
