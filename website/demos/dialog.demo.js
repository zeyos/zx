import { Dialog, h } from '../../src/index.js';

const sectionStyle = {
  display: 'grid',
  gap: 'var(--zx-space-4)',
  marginBlockEnd: 'var(--zx-space-6)',
  border: '1px solid var(--zx-color-border)',
  borderRadius: 'var(--zx-radius-lg)',
  background: 'var(--zx-color-bg-surface)',
  padding: 'var(--zx-space-5)'
};

const rowStyle = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 'var(--zx-space-3)'
};

export default {
  title: 'Dialog',
  group: 'Overlays',

  /**
   * Mounts structured dialog, views, and Promise-helper examples.
   * @param {HTMLElement} container Demo stage.
   * @returns {void}
   */
  mount(container) {
    const instances = [];
    const log = h('pre', {
      ariaLive: 'polite',
      style: { margin: '0', color: 'var(--zx-color-text-muted)', fontFamily: 'var(--zx-font-mono)' }
    }, 'Promise results appear here.');

    const sizes = ['sm', 'md', 'lg'].map((size) => {
      const dialog = new Dialog(null, {
        title: `${size.toUpperCase()} dialog`,
        size,
        content: `The ${size} preset demonstrates responsive maximum sizing.`,
        buttons: [{ label: 'Close', kind: 'primary', action: 'close', autofocus: true }]
      });
      instances.push(dialog);
      return { size, dialog };
    });

    const wizard = new Dialog(null, { title: 'Two-step wizard', size: 'sm' });
    wizard.addView('account', {
      title: 'Step 1 — Account',
      content: h('div', { style: { display: 'grid', gap: 'var(--zx-space-3)' } },
        h('p', { style: { margin: '0' } }, 'Choose the account details before continuing.'),
        h('label', {}, 'Account name ', h('input', { value: 'Acme GmbH' }))
      ),
      buttons: [
        { label: 'Cancel', action: 'cancel' },
        { label: 'Next', kind: 'primary', action: () => wizard.showView('review'), autofocus: true }
      ]
    });
    wizard.addView('review', {
      title: 'Step 2 — Review',
      content: h('p', { style: { margin: '0' } }, 'Review complete. Go back or finish the walkthrough.'),
      buttons: [
        { label: 'Back', action: () => wizard.showView('account') },
        { label: 'Finish', kind: 'primary', action: 'close', autofocus: true }
      ]
    });
    instances.push(wizard);

    const marker = h('div', {},
      section('Responsive sizes', h('div', { style: rowStyle }, sizes.map(({ size, dialog }) =>
        demoButton(`Open ${size}`, () => dialog.open())
      ))),
      section('Views walkthrough',
        h('p', { style: { margin: '0' } }, 'The wizard swaps body, title, and footer actions without nesting dialogs.'),
        demoButton('Start wizard', () => {
          wizard.showView('account');
          wizard.open();
        })
      ),
      section('Promise helpers',
        h('div', { style: rowStyle },
          demoButton('Alert', async () => {
            await Dialog.alert({ title: 'Saved', message: 'The record was saved.' });
            log.textContent = 'alert resolved';
          }),
          demoButton('Confirm', async () => {
            const result = await Dialog.confirm({ title: 'Continue?', message: 'Confirm a regular action.' });
            log.textContent = `confirm resolved: ${result}`;
          }),
          demoButton('Danger confirm', async () => {
            const result = await Dialog.confirm({
              title: 'Delete record?',
              message: 'This demonstrates the danger action treatment.',
              okLabel: 'Delete',
              danger: true
            });
            log.textContent = `danger confirm resolved: ${result}`;
          }),
          demoButton('Prompt', async () => {
            const result = await Dialog.prompt({
              title: 'Name this view',
              message: 'Enter a short name.',
              value: 'Quarterly report',
              placeholder: 'View name'
            });
            log.textContent = `prompt resolved: ${result === null ? 'null' : JSON.stringify(result)}`;
          })
        ),
        log
      )
    );
    container.append(marker);
    cleanupWhenRemoved(marker, () => instances.forEach((instance) => instance.destroy()));
  }
};

/** @param {string} title @param {...Node} children @returns {HTMLElement} */
function section(title, ...children) {
  return h('section', { style: sectionStyle },
    h('h2', { style: { margin: '0', fontSize: 'var(--zx-text-xl)' } }, title), children
  );
}

/** @param {string} label @param {() => void} onclick @returns {HTMLButtonElement} */
function demoButton(label, onclick) {
  return /** @type {HTMLButtonElement} */ (h('button', { class: 'zx-btn', type: 'button', onclick }, label));
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
