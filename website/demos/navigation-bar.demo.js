import { NavigationBar, h } from '../../src/index.js';

const items = [
  { name: 'home', title: 'Home' },
  { name: 'inbox', title: 'Inbox', badge: '4' },
  { name: 'contacts', title: 'Contacts' },
  { name: 'projects', title: 'Projects', badge: '12' },
  { name: 'reports', title: 'Reports' },
  { name: 'settings', title: 'Settings' }
];

export default {
  title: 'Navigation bar',
  group: 'Layout',

  /**
   * Mounts full-width and narrow MenuButton-overflow navigation bars.
   * @param {HTMLElement} container Demo stage.
   * @returns {void}
   */
  mount(container) {
    const log = output('No navigation event yet.');
    let inboxBadge = 4;
    const actions = [
      {
        label: 'Create',
        kind: 'primary',
        size: 'sm',
        onclick: () => { log.textContent = 'action: create'; }
      },
      {
        label: 'Help',
        kind: 'ghost',
        size: 'sm',
        onclick: () => { log.textContent = 'action: help'; }
      }
    ];
    const full = new NavigationBar(null, {
      title: 'ZeyOS',
      items,
      active: 'home',
      actions
    });
    const narrow = new NavigationBar(null, {
      title: 'ZeyOS',
      items,
      active: 'inbox',
      actions: [{
        label: 'Add',
        kind: 'primary',
        size: 'sm',
        onclick: () => { log.textContent = 'narrow action: add'; }
      }]
    });
    for (const navigation of [full, narrow]) {
      navigation.on('change', (event) => {
        log.textContent = `change: ${event.detail.name}`;
      });
    }

    const marker = h('div', {},
      section('Application navigation',
        full.toElement(),
        h('div', { style: {
          display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--zx-space-3)'
        } },
        h('button', {
          type: 'button',
          onclick: () => {
            inboxBadge += 1;
            full.setBadge('inbox', String(inboxBadge));
          }
        }, 'Increment inbox badge'),
        log)
      ),
      section('Narrow-container overflow',
        h('p', { style: { margin: '0', color: 'var(--zx-color-text-muted)' } },
          'At 360px the six navigation items move into the More menu; the brand and action stay visible.'),
        h('div', { style: { inlineSize: '360px', maxInlineSize: '100%' } }, narrow)
      )
    );
    container.append(marker);
    cleanupWhenRemoved(marker, () => {
      full.destroy();
      narrow.destroy();
    });
  }
};

/** @param {string} title @param {...Node} children @returns {HTMLElement} */
function section(title, ...children) {
  return h('section', { style: {
    display: 'grid', gap: 'var(--zx-space-4)', marginBlockEnd: 'var(--zx-space-7)'
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
