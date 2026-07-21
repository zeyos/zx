import { button, h, Message } from '../../src/index.js';

export default {
  title: 'Message',
  group: 'Overlays',

  /**
   * Mounts toast, progress, queue, and inline-message examples.
   * @param {HTMLElement} container Demo stage.
   * @returns {void}
   */
  mount(container) {
    const marker = h('div');
    const log = output('Trigger a toast or progress message.');
    const handles = new Set();
    let progress = null;
    let progressTimer = null;
    const inlineHost = h('div');
    const inline = new Message(inlineHost, { timeout: 0 });

    /** @param {string} kind @returns {void} */
    function showKind(kind) {
      const method = kind === 'error' ? Message.error : Message[kind];
      const handle = method.call(Message, `${capitalize(kind)} message from the floating region.`);
      handles.add(handle);
      log.textContent = `${kind} toast shown`;
    }

    /** @returns {void} */
    function showProgress() {
      if (progressTimer !== null) clearInterval(progressTimer);
      progress = Message.progress('Preparing export…');
      let pct = 0;
      progressTimer = setInterval(() => {
        pct += 10;
        progress.update(pct, `Preparing export… ${pct}%`);
        if (pct < 100) return;
        clearInterval(progressTimer);
        progressTimer = null;
        progress.done();
        log.textContent = 'Progress completed';
      }, 180);
    }

    /** @returns {void} */
    function showBurst() {
      for (let index = 1; index <= 8; index += 1) {
        handles.add(Message.info(`Queued toast ${index}`, { timeout: 6000 }));
      }
      log.textContent = 'Burst queued: five visible, three waiting';
    }

    marker.append(
      section('Floating kinds', row(
        button({ label: 'Info', onclick: () => showKind('info') }),
        button({ label: 'Success', kind: 'primary', onclick: () => showKind('success') }),
        button({ label: 'Warning', onclick: () => showKind('warning') }),
        button({ label: 'Error', kind: 'danger', onclick: () => showKind('error') })
      )),
      section('Progress and queue', row(
        button({ label: 'Run progress', icon: 'reload', onclick: showProgress }),
        button({ label: 'Burst of 8', icon: 'list', onclick: showBurst })
      )),
      section('Inline message area',
        row(button({
          label: 'Show inline',
          onclick: () => inline.show('This message stays inside the component area.', {
            kind: 'success', timeout: 0
          })
        })),
        inlineHost
      ),
      log
    );
    container.append(marker);
    cleanupWhenRemoved(marker, () => {
      if (progressTimer !== null) clearInterval(progressTimer);
      progress?.done();
      for (const handle of handles) handle.close();
      inline.destroy();
    });
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

/** @param {string} value @returns {string} */
function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
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
