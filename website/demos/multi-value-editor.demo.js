import { MultiValueEditor, h } from '../../src/index.js';

export default {
  title: 'Multi-value editor',
  group: 'Forms',

  /**
   * Mounts free-text and constrained ordered value editors.
   * @param {HTMLElement} container Demo stage.
   * @returns {void}
   */
  mount(container) {
    const freeLog = logElement();
    const optionLog = logElement();
    const free = new MultiValueEditor(null, {
      values: ['First line', 'Second line'],
      addLabel: 'Add note',
      onchange: (event) => { freeLog.textContent = JSON.stringify(event.detail.values); }
    });
    const constrained = new MultiValueEditor(null, {
      values: ['email', 'phone'],
      options: { email: 'Email', phone: 'Phone', meeting: 'Meeting', post: 'Post' },
      addLabel: 'Add contact method',
      onchange: (event) => { optionLog.textContent = JSON.stringify(event.detail.values); }
    });
    const marker = h('div', {
      style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(17rem, 1fr))', gap: 'var(--zx-space-5)' }
    },
    demoCard('Free text', 'Edit values, reorder with arrows, and remove any row.', free, freeLog),
    demoCard('Allowed options', 'The same row controls work with constrained select values.', constrained, optionLog));
    container.append(marker);
    cleanupWhenRemoved(marker, () => {
      free.destroy();
      constrained.destroy();
    });
  }
};

/** @param {string} title @param {string} description @param {MultiValueEditor} editor @param {HTMLElement} log @returns {HTMLElement} */
function demoCard(title, description, editor, log) {
  return h('section', {
    style: {
      display: 'grid',
      alignContent: 'start',
      gap: 'var(--zx-space-3)',
      padding: 'var(--zx-space-5)',
      border: '1px solid var(--zx-color-border)',
      borderRadius: 'var(--zx-radius-lg)',
      background: 'var(--zx-color-bg-surface)'
    }
  }, h('h2', {}, title), h('p', {}, description), editor, log);
}

/** @returns {HTMLElement} */
function logElement() {
  return h('output', { ariaLive: 'polite', style: { color: 'var(--zx-color-text-muted)' } }, 'No changes yet.');
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
