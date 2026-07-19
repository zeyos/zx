import { Dialog, Modal, h } from '../../src/index.js';

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
  title: 'Modal',
  group: 'Overlays',

  /**
   * Mounts modal dismissal and stacking examples.
   * @param {HTMLElement} container Demo stage.
   * @returns {void}
   */
  mount(container) {
    const instances = [];
    const log = eventLog('Open or close a modal to see its events.');

    let basic;
    basic = new Modal(null, {
      width: 460,
      content: modalCard('Basic modal', 'Escape closes this modal.', () => basic.close('button'))
    });
    wireModalLog(basic, log, 'basic');
    instances.push(basic);

    let lightDismiss;
    lightDismiss = new Modal(null, {
      width: 460,
      lightDismiss: true,
      content: modalCard(
        'Light dismiss',
        'Click the shaded backdrop, press Escape, or use the button.',
        () => lightDismiss.close('button')
      )
    });
    wireModalLog(lightDismiss, log, 'light-dismiss');
    instances.push(lightDismiss);

    let locked;
    locked = new Modal(null, {
      width: 460,
      closable: false,
      lightDismiss: true,
      content: modalCard(
        'Non-closable',
        'Escape is blocked. Backdrop dismissal remains separately configurable.',
        () => locked.close('explicit button')
      )
    });
    wireModalLog(locked, log, 'non-closable');
    instances.push(locked);

    let nested;
    const nestedStatus = h('output', { ariaLive: 'polite' }, 'No confirmation result yet.');
    nested = new Modal(null, {
      width: 500,
      content: h('div', { style: { display: 'grid', gap: 'var(--zx-space-4)' } },
        h('h2', { style: { margin: '0' } }, 'Nested top-layer overlays'),
        h('p', { style: { margin: '0' } },
          'Open a Dialog.confirm above this Modal. Escape closes only the confirmation first.'
        ),
        h('div', { style: rowStyle },
          h('button', {
            class: 'zx-btn',
            type: 'button',
            onclick: async () => {
              const result = await Dialog.confirm({
                title: 'Nested confirmation',
                message: 'This dialog is stacked above the still-open modal.'
              });
              nestedStatus.textContent = `Confirmation resolved: ${result}`;
            }
          }, 'Open confirmation'),
          h('button', { class: 'zx-btn', type: 'button', onclick: () => nested.close() }, 'Close modal')
        ),
        nestedStatus
      )
    });
    wireModalLog(nested, log, 'nested');
    instances.push(nested);

    const marker = h('div', {},
      section('Dismissal variants',
        h('div', { style: rowStyle },
          demoButton('Open basic modal', () => basic.open()),
          demoButton('Open light-dismiss modal', () => lightDismiss.open()),
          demoButton('Open non-closable modal', () => locked.open())
        )
      ),
      section('Nested overlays', demoButton('Open parent modal', () => nested.open())),
      section('Event log', log)
    );
    container.append(marker);
    cleanupWhenRemoved(marker, () => instances.forEach((instance) => instance.destroy()));
  }
};

/** @param {string} title @param {string} text @param {() => void} close @returns {HTMLElement} */
function modalCard(title, text, close) {
  return h('div', { style: { display: 'grid', gap: 'var(--zx-space-4)' } },
    h('h2', { style: { margin: '0' } }, title),
    h('p', { style: { margin: '0' } }, text),
    h('div', { style: rowStyle }, demoButton('Close', close))
  );
}

/** @param {Modal} modal @param {HTMLElement} log @param {string} name @returns {void} */
function wireModalLog(modal, log, name) {
  modal.on('open', () => { log.textContent = `${name}: open`; });
  modal.on('cancel', () => { log.textContent = `${name}: cancel requested`; });
  modal.on('close', (event) => {
    log.textContent = `${name}: close (${String(event.detail.result)})`;
  });
}

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

/** @param {string} text @returns {HTMLElement} */
function eventLog(text) {
  return h('pre', {
    ariaLive: 'polite',
    style: { margin: '0', color: 'var(--zx-color-text-muted)', fontFamily: 'var(--zx-font-mono)' }
  }, text);
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
