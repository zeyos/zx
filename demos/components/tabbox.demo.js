import { Tabbox, h } from '../../src/index.js';

export default {
  title: 'Tabbox',
  group: 'Layout',

  /**
   * Mounts manual-activation tabs with disabled, closable, lazy, badge, and veto states.
   * @param {HTMLElement} container Demo stage.
   * @returns {void}
   */
  mount(container) {
    const log = output('No tab event yet. The lazy tab has not been built.');
    const veto = /** @type {HTMLInputElement} */ (h('input', { type: 'checkbox' }));
    const tabbox = new Tabbox(null, {
      tabs: [
        {
          name: 'overview',
          title: 'Overview',
          content: panelContent('Overview', 'Arrow keys move focus without selecting another tab.')
        },
        {
          name: 'records',
          title: 'Closable records',
          closable: true,
          content: panelContent('Records', 'Focus this tab and press Delete to close it.')
        },
        {
          name: 'audit',
          title: 'Lazy audit',
          content: () => {
            log.textContent = 'lazy build: audit content created';
            return panelContent('Audit', 'This node was created only on first activation.');
          }
        },
        {
          name: 'disabled',
          title: 'Disabled',
          disabled: true,
          content: panelContent('Disabled', 'This content cannot be selected until enabled.')
        }
      ],
      active: 'overview'
    });
    let badge = 2;
    tabbox.setBadge('records', String(badge));
    tabbox.on('change', (event) => {
      if (veto.checked) {
        event.preventDefault();
        log.textContent = `vetoed change: ${event.detail.previous} → ${event.detail.name}`;
        return;
      }
      log.textContent = `change: ${event.detail.previous} → ${event.detail.name}`;
    });
    tabbox.on('close', (event) => {
      log.textContent = `close: ${event.detail.name}`;
    });

    const marker = h('div', {},
      h('section', { style: {
        display: 'grid', gap: 'var(--zx-space-4)', marginBlockEnd: 'var(--zx-space-6)'
      } },
      h('div', { style: {
        display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--zx-space-3)'
      } },
      h('button', {
        type: 'button',
        onclick: () => {
          badge += 1;
          tabbox.setBadge('records', String(badge));
          log.textContent = `records badge: ${badge}`;
        }
      }, 'Update badge'),
      h('button', {
        type: 'button',
        onclick: () => tabbox.enableTab('disabled')
      }, 'Enable disabled tab'),
      h('label', { style: {
        display: 'inline-flex', alignItems: 'center', gap: 'var(--zx-space-2)'
      } }, veto, 'Veto tab changes')),
      tabbox.toElement(),
      h('p', { style: { margin: '0', color: 'var(--zx-color-text-muted)' } },
        'Keyboard: Left/Right, Home/End, Enter/Space, and Delete on the closable tab.'),
      log)
    );
    container.append(marker);
    cleanupWhenRemoved(marker, () => tabbox.destroy());
  }
};

/** @param {string} title @param {string} text @returns {HTMLElement} */
function panelContent(title, text) {
  return h('div', {},
    h('h3', { style: { marginBlockStart: '0' } }, title),
    h('p', { style: { marginBlockEnd: '0' } }, text)
  );
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
