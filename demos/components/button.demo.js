import { button, buttonGroup, h } from '../../src/index.js';

const kinds = ['default', 'primary', 'danger', 'ghost'];

export default {
  title: 'Button',
  group: 'Inputs',

  /**
   * Mounts button kinds, sizes, groups, icons, and disabled states.
   * @param {HTMLElement} container Demo stage.
   * @returns {void}
   */
  mount(container) {
    const log = output('Choose a button.');
    const kindsRow = row();
    for (const kind of kinds) {
      kindsRow.append(button({
        label: capitalize(kind),
        kind,
        icon: kind === 'primary' ? 'plus' : null,
        onclick: () => write(log, `${kind} clicked`)
      }));
    }

    const sizesRow = row(
      button({ label: 'Medium', size: 'md', icon: 'settings', onclick: () => write(log, 'md clicked') }),
      button({ label: 'Small', size: 'sm', icon: 'filter', onclick: () => write(log, 'sm clicked') }),
      button({ icon: 'reload', title: 'Reload', onclick: () => write(log, 'icon button clicked') }),
      button({ label: 'Disabled', disabled: true })
    );
    const group = buttonGroup([
      button({ label: 'List', size: 'sm' }),
      button({ label: 'Grid', size: 'sm', kind: 'primary' }),
      button({ label: 'Map', size: 'sm' })
    ]);

    container.append(
      section('Kinds', kindsRow),
      section('Sizes and states', sizesRow),
      section('Joined group', group),
      log
    );
  }
};

/** @param {...Node} children @returns {HTMLElement} */
function row(...children) {
  return h('div', { style: {
    display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--zx-space-3)'
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

/** @param {HTMLElement} log @param {string} text @returns {void} */
function write(log, text) {
  log.textContent = text;
}

/** @param {string} value @returns {string} */
function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
