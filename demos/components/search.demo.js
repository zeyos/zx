import { h, Search } from '../../src/index.js';

export default {
  title: 'Search',
  group: 'Inputs',

  /**
   * Mounts clearable and persistent search fields with event output.
   * @param {HTMLElement} container Demo stage.
   * @returns {void}
   */
  mount(container) {
    const marker = h('div');
    const log = output('Type to see debounced input events.');
    const clearable = new Search(null, {
      placeholder: 'Search contacts', value: 'Ada', debounce: 250
    });
    const persistent = new Search(null, {
      placeholder: 'Search reference', clearable: false, debounce: 0
    });
    const components = [clearable, persistent];
    components.forEach((component, index) => {
      component.on('input', (event) => {
        log.textContent = `Search ${index + 1} input: “${event.detail.value}”`;
      });
      component.on('submit', (event) => {
        log.textContent = `Search ${index + 1} submit: “${event.detail.value}”`;
      });
      component.on('clear', () => { log.textContent = `Search ${index + 1} cleared`; });
    });
    marker.append(
      section('Variants', row(clearable.toElement(), persistent.toElement())),
      section('Programmatic API', row(
        h('button', { type: 'button', onclick: () => clearable.set('Grace Hopper') }, 'Set value'),
        h('button', { type: 'button', onclick: () => clearable.clear() }, 'Clear'),
        h('button', { type: 'button', onclick: () => persistent.focus() }, 'Focus second')
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
    display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--zx-space-4)'
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
