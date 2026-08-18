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
          icon: 'list',
          content: panelContent('Overview', 'Arrow keys move focus without selecting another tab.')
        },
        {
          name: 'records',
          title: 'Closable records',
          icon: 'file',
          closable: true,
          content: panelContent('Records', 'Focus this tab and press Delete to close it.')
        },
        {
          name: 'audit',
          title: 'Lazy audit',
          icon: 'eye',
          content: () => {
            log.textContent = 'lazy build: audit content created';
            return panelContent('Audit', 'This node was created only on first activation.');
          }
        },
        {
          name: 'disabled',
          title: 'Disabled',
          icon: 'lock',
          disabled: true,
          content: panelContent('Disabled', 'This content cannot be selected until enabled.')
        }
      ],
      active: 'overview'
    });

    // The same component with the compact appearance, for switching a view inside a panel.
    const segmented = new Tabbox(null, {
      variant: 'segmented',
      tabs: [
        { name: 'chart', title: 'Chart', icon: 'filter', content: panelContent('Chart', 'A segmented row reads as one control, so it suits a card header or toolbar.') },
        { name: 'table', title: 'Table', icon: 'list', content: panelContent('Table', 'Same component, same keyboard map — only the tab row is styled differently.') },
        { name: 'raw', title: 'Raw', icon: 'code', content: panelContent('Raw', 'Set variant: "segmented" to opt in; the default stays the line variant.') }
      ]
    });
    let badge = 2;
    const badgeButton = /** @type {HTMLButtonElement} */ (h('button', {
      type: 'button',
      onclick: () => {
        badge += 1;
        tabbox.setBadge('records', String(badge));
        log.textContent = `records badge: ${badge}`;
      }
    }, 'Update badge'));
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
      if (event.detail.name === 'records') badgeButton.disabled = true;
    });

    const marker = h('div', {},
      h('section', { style: {
        display: 'grid', gap: 'var(--zx-space-4)', marginBlockEnd: 'var(--zx-space-6)'
      } },
      h('div', { style: {
        display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--zx-space-3)'
      } },
      badgeButton,
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
      log),
      h('section', { style: {
        display: 'grid', gap: 'var(--zx-space-4)', justifyItems: 'start'
      } },
      h('h2', { style: { margin: '0', fontSize: 'var(--zx-text-xl)' } }, 'Segmented variant'),
      h('p', { style: { margin: '0', maxInlineSize: '78ch', color: 'var(--zx-color-text-muted)' } },
        'variant: "segmented" swaps the full-width underlined row for a pill group on a muted '
        + 'fill, with the active tab raised onto a control surface.'),
      segmented.toElement())
    );
    container.append(marker);
    cleanupWhenRemoved(marker, () => {
      tabbox.destroy();
      segmented.destroy();
    });
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
