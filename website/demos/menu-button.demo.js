import { MenuButton, h } from '../../src/index.js';

const sectionStyle = {
  display: 'grid',
  gap: 'var(--zx-space-4)',
  border: '1px solid var(--zx-color-border)',
  borderRadius: 'var(--zx-radius-lg)',
  background: 'var(--zx-color-bg-surface)',
  padding: 'var(--zx-space-5)'
};

export default {
  title: 'Menu button',
  group: 'Overlays',

  /**
   * Mounts an action menu and keyboard walkthrough.
   * @param {HTMLElement} container Demo stage.
   * @returns {void}
   */
  mount(container) {
    const log = h('pre', {
      ariaLive: 'polite',
      style: { margin: '0', color: 'var(--zx-color-text-muted)', fontFamily: 'var(--zx-font-mono)' }
    }, 'No menu event yet.');
    const menu = new MenuButton(null, {
      label: 'Record actions',
      icon: 'dots',
      items: [
        { label: 'View record', icon: 'eye', value: 'view' },
        { label: 'Reload data', icon: 'reload', value: 'reload' },
        '-',
        { label: 'Export unavailable', icon: 'upload', value: 'export', disabled: true },
        '-',
        { label: 'Delete record', icon: 'trash', value: 'delete', danger: true }
      ]
    });
    menu.on('open', () => { log.textContent = 'open'; });
    menu.on('close', () => { log.textContent += '\nclose'; });
    menu.on('select', (event) => {
      log.textContent = `select: ${String(event.detail.value)} (${event.detail.item.label})`;
    });

    const marker = h('div', {},
      h('section', { style: sectionStyle },
        h('h2', { style: { margin: '0', fontSize: 'var(--zx-text-xl)' } }, 'Action menu'),
        h('div', {}, menu),
        h('div', {
          style: {
            borderInlineStart: '3px solid var(--zx-color-accent)',
            background: 'var(--zx-color-bg-selected)',
            padding: 'var(--zx-space-4)'
          }
        },
        h('strong', {}, 'Keyboard walkthrough'),
        h('p', { style: { marginBlockEnd: '0' } },
          'Focus the trigger. Arrow Down, Enter, or Space opens at the first item; Arrow Up opens at the last. '
          + 'Inside the menu use wrapping arrows, Home/End, typeahead letters, Enter/Space, Escape, or Tab.'
        )),
        log
      )
    );
    container.append(marker);
    cleanupWhenRemoved(marker, () => menu.destroy());
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
