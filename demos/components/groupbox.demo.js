import { Groupbox, h } from '../../src/index.js';

export default {
  title: 'Groupbox',
  group: 'Layout',

  /**
   * Mounts open and closed native-details groupboxes.
   * @param {HTMLElement} container Demo stage.
   * @returns {void}
   */
  mount(container) {
    const marker = h('div');
    const log = output('Use the summaries or API controls.');
    const open = new Groupbox(null, { title: 'Account details', open: true });
    open.setContent(h('p', { style: { margin: '0' } },
      'This section starts open and its title and content can be replaced at runtime.'));
    const closed = new Groupbox(null, { title: 'Advanced settings', open: false });
    closed.setContent(h('div', {},
      h('label', {}, 'Reference ', h('input', { value: 'ZX-2048' })),
      h('p', { style: { color: 'var(--zx-color-text-muted)' } }, 'Native details semantics preserve keyboard behavior.')
    ));
    const components = [open, closed];
    components.forEach((component) => {
      component.on('open', () => { log.textContent = `${component.refs.title.textContent}: open`; });
      component.on('close', () => { log.textContent = `${component.refs.title.textContent}: close`; });
    });
    marker.append(
      section('Sections', open.toElement(), closed.toElement()),
      section('Programmatic API', row(
        h('button', { type: 'button', onclick: () => open.toggle() }, 'Toggle first'),
        h('button', { type: 'button', onclick: () => closed.open() }, 'Open second'),
        h('button', { type: 'button', onclick: () => open.setTitle('Renamed account details') },
          'Rename first')
      )),
      log
    );
    container.append(marker);
    cleanupWhenRemoved(marker, () => components.forEach((component) => component.destroy()));
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
