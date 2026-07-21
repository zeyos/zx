import { h, Permission } from '../../src/index.js';

const sectionStyle = {
  display: 'grid',
  gap: 'var(--zx-space-3)',
  border: '1px solid var(--zx-color-border)',
  borderRadius: 'var(--zx-radius-lg)',
  background: 'var(--zx-color-bg-surface)',
  padding: 'var(--zx-space-5)'
};

export default {
  title: 'Permission',
  group: 'Forms',

  /**
   * Mounts a permission picker bound to fake groups.
   * @param {HTMLElement} container Demo stage.
   * @returns {void}
   */
  mount(container) {
    const host = h('div');
    const log = h('output', {
      ariaLive: 'polite',
      style: { color: 'var(--zx-color-text-muted)' }
    }, 'Current value: public');
    const permission = new Permission(host, {
      value: true,
      groups: [
        { ID: 101, name: 'Executive team' },
        { ID: 102, name: 'Finance' },
        { ID: 103, name: 'Project Phoenix' },
        { ID: 104, name: 'Vienna office' }
      ],
      onchange: (event) => {
        log.textContent = `Current value: ${String(event.detail.value)}`;
      }
    });

    const marker = h('section', { style: sectionStyle },
      h('h2', { style: { margin: '0', fontSize: 'var(--zx-text-lg)' } }, 'Record access'),
      h('p', { style: { margin: '0', color: 'var(--zx-color-text-muted)' } },
        'Choose public, private, or grant access to one group.'
      ),
      host,
      log
    );
    container.append(marker);

    const observer = new MutationObserver(() => {
      if (marker.isConnected) return;
      permission.destroy();
      observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }
};
