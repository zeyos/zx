import { ValueList, h } from '../../src/index.js';

export default {
  title: 'Value list',
  group: 'Forms',

  /**
   * Mounts validated, sortable email chips with mouse and keyboard instructions.
   * @param {HTMLElement} container Demo stage.
   * @returns {void}
   */
  mount(container) {
    const log = h('pre', {
      ariaLive: 'polite',
      style: { margin: '0', color: 'var(--zx-color-text-muted)', whiteSpace: 'pre-wrap' }
    });
    const values = new ValueList(null, {
      values: ['ada@example.test', 'grace@example.test'],
      placeholder: 'person@example.test',
      validate: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || 'Enter a complete email address.',
      onchange: (event) => { log.textContent = `change: ${event.detail.values.join(', ')}`; },
      onadd: (event) => { log.textContent = `added: ${event.detail.value}`; },
      onremove: (event) => { log.textContent = `removed: ${event.detail.value}`; }
    });
    const marker = h('section', {
      style: {
        display: 'grid',
        gap: 'var(--zx-space-4)',
        padding: 'var(--zx-space-5)',
        border: '1px solid var(--zx-color-border)',
        borderRadius: 'var(--zx-radius-lg)',
        background: 'var(--zx-color-bg-surface)'
      }
    },
    h('h2', {}, 'Notification recipients'),
    h('p', {}, 'Enter adds a chip; Backspace removes the last chip when the input is empty. Drag chips, or focus one and press Ctrl+Left/Right to reorder. Delete removes a focused chip.'),
    values,
    h('div', { style: { display: 'flex', gap: 'var(--zx-space-2)' } },
      h('button', { class: 'zx-btn', type: 'button', onclick: () => values.disable() }, 'Disable'),
      h('button', { class: 'zx-btn', type: 'button', onclick: () => values.enable().focus() }, 'Enable')
    ),
    log);
    container.append(marker);
    cleanupWhenRemoved(marker, () => values.destroy());
  }
};

/** @param {Node} marker @param {() => void} cleanup @returns {void} */
function cleanupWhenRemoved(marker, cleanup) {
  const observer = new MutationObserver(() => {
    if (marker.isConnected) return;
    cleanup();
    observer.disconnect();
  });
  observer.observe(document.body, { childList: true, subtree: true });
}
