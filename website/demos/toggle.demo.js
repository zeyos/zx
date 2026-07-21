import { h, Toggle } from '../../src/index.js';

export default {
  title: 'Toggle',
  group: 'Inputs',

  /**
   * Mounts switch states, values, and event output.
   * @param {HTMLElement} container Demo stage.
   * @returns {void}
   */
  mount(container) {
    const marker = h('div');
    const log = output('Toggle a switch with click, Space, or Enter.');
    const components = [
      new Toggle(null, { label: 'Notifications', value: 'notifications' }),
      new Toggle(null, { label: 'Automatic sync', checked: true, value: 'sync' }),
      new Toggle(null, { label: 'Unavailable', disabled: true })
    ];
    components.forEach((component) => {
      component.on('change', (event) => {
        log.textContent = `checked=${event.detail.checked}, value=${String(event.detail.value)}`;
      });
    });
    marker.append(
      section('States', row(...components.map((component) => component.toElement()))),
      section('Programmatic API', row(
        h('button', { type: 'button', onclick: () => components[0].toggle() }, 'Toggle first'),
        h('button', { type: 'button', onclick: () => components[2].enable() }, 'Enable disabled'),
        h('button', {
          type: 'button',
          onclick: () => { log.textContent = `First getValue(): ${String(components[0].getValue())}`; }
        }, 'Read value')
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
