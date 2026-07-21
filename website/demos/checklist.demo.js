import { Checklist, h } from '../../src/index.js';

const sectionStyle = {
  display: 'grid',
  gap: 'var(--zx-space-3)',
  border: '1px solid var(--zx-color-border)',
  borderRadius: 'var(--zx-radius-lg)',
  background: 'var(--zx-color-bg-surface)',
  padding: 'var(--zx-space-5)'
};

export default {
  title: 'Checklist',
  group: 'Inputs',

  /**
   * Mounts static and asynchronously loaded checklists.
   * @param {HTMLElement} container Demo stage.
   * @returns {void}
   */
  mount(container) {
    const components = [];
    const staticLog = output('No changes yet.');
    const staticHost = h('div');
    const checklist = new Checklist(staticHost, {
      items: departments(),
      onchange: (event) => {
        staticLog.textContent = `Checked IDs: ${event.detail.values.join(', ') || 'none'}`;
      }
    });
    components.push(checklist);
    const staticControls = h('div', { style: controlRow() },
      h('button', { type: 'button', onclick: () => checklist.checkAll() }, 'Select all'),
      h('button', { type: 'button', onclick: () => checklist.uncheckAll() }, 'Clear all')
    );

    const asyncLog = output('Load the remote checklist.');
    const asyncHost = h('div');
    const remote = new Checklist(asyncHost, {
      items: [],
      load: async () => {
        await new Promise((resolve) => setTimeout(resolve, 450));
        return departments().map((item, index) => ({ ...item, on: index === 1 }));
      },
      onchange: (event) => {
        asyncLog.textContent = `Checked IDs: ${event.detail.values.join(', ') || 'none'}`;
      },
      onloaded: (event) => {
        asyncLog.textContent = `Loaded ${event.detail.items.length} groups.`;
      }
    });
    components.push(remote);
    const reload = h('button', {
      type: 'button',
      onclick: () => remote.reload()
    }, 'Reload async list');

    const marker = h('div', { style: { display: 'grid', gap: 'var(--zx-space-5)' } },
      section('Static searchable list', staticControls, staticHost, staticLog),
      section('Async load', reload, asyncHost, asyncLog)
    );
    container.append(marker);

    const observer = new MutationObserver(() => {
      if (marker.isConnected) return;
      components.forEach((component) => component.destroy());
      observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }
};

/** @returns {Array<{ID: number, name: string, on?: boolean}>} */
function departments() {
  return [
    { ID: 10, name: 'Administration', on: true },
    { ID: 20, name: 'Customer Service' },
    { ID: 30, name: 'Finance' },
    { ID: 40, name: 'Operations' },
    { ID: 50, name: 'Product Development' },
    { ID: 60, name: 'Sales' },
    { ID: 70, name: 'Warehouse' }
  ];
}

/** @param {string} title @param {...Node} children @returns {HTMLElement} */
function section(title, ...children) {
  return h('section', { style: sectionStyle },
    h('h2', { style: { margin: '0', fontSize: 'var(--zx-text-lg)' } }, title),
    children
  );
}

/** @param {string} text @returns {HTMLOutputElement} */
function output(text) {
  return /** @type {HTMLOutputElement} */ (h('output', {
    ariaLive: 'polite',
    style: { color: 'var(--zx-color-text-muted)' }
  }, text));
}

/** @returns {Record<string, string>} */
function controlRow() {
  return {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 'var(--zx-space-2)'
  };
}
