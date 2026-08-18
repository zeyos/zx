import { CheckButton, h } from '../../src/index.js';

export default {
  title: 'CheckButton',
  group: 'Inputs',

  /**
   * Mounts interactive CheckButton states and event output.
   * @param {HTMLElement} container Demo stage.
   * @returns {void}
   */
  mount(container) {
    const marker = h('div');
    const log = output('Toggle a check button with click, Space, or Enter.');
    const components = [
      new CheckButton(null, { label: 'Pinned' }),
      new CheckButton(null, { label: ['Enabled', 'Disabled'], checked: true }),
      new CheckButton(null, { label: 'No icon', icon: false }),
      new CheckButton(null, { label: 'Unavailable', disabled: true }),
      new CheckButton(null, { label: 'Locked on', checked: true, disabled: true })
    ];
    components.forEach((component, index) => {
      component.on('change', (event) => {
        log.textContent = `Button ${index + 1}: checked=${event.detail.checked}`;
      });
    });
    marker.append(
      section('States', row(...components.map((component) => component.toElement())),
        note('The check indicator has a glyph in both states — an empty box when off, a check when '
          + 'on — so an unpressed or disabled button still reads as a two-state control. Pass '
          + '`icon: false` for a plain label button.')),
      section('Programmatic API', row(
        h('button', { type: 'button', onclick: () => components[0].set(true) }, 'Set first on'),
        h('button', { type: 'button', onclick: () => components[0].setLabel(['On now', 'Off now']) },
          'Change labels'),
        h('button', { type: 'button', onclick: () => components[3].enable() }, 'Enable disabled')
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

/** @param {string} text @returns {HTMLElement} */
function note(text) {
  return h('p', { style: {
    margin: '0', maxInlineSize: '78ch', color: 'var(--zx-color-text-muted)', lineHeight: '1.7'
  } }, text);
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
