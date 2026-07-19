import { FieldUpload, h } from '../../src/index.js';

export default {
  title: 'Field upload',
  group: 'Forms',

  /**
   * Mounts an offline upload simulation with preview, progress, abort, and error paths.
   * @param {HTMLElement} container Demo stage.
   * @returns {void}
   */
  mount(container) {
    const log = h('pre', {
      ariaLive: 'polite',
      style: { margin: '0', color: 'var(--zx-color-text-muted)', whiteSpace: 'pre-wrap' }
    }, 'Choose an image or run a simulation.');
    const uploader = new FieldUpload(null, {
      url: '/offline-demo-upload',
      accept: 'image/*',
      maxSize: 1024 * 1024,
      preview: true,
      autoUpload: true,
      http: new StubHttp(),
      onselect: (event) => { log.textContent = `selected: ${event.detail.files.map((file) => file.name).join(', ')}`; },
      onprogress: (event) => { log.textContent = `progress: ${Math.round(event.detail.percent)}%`; },
      onsuccess: (event) => { log.textContent = `success: ${JSON.stringify(event.detail.response)}`; },
      onerror: (event) => { log.textContent = `error: ${event.detail.error.message}`; },
      onabort: () => { log.textContent = 'abort'; }
    });
    const controls = h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 'var(--zx-space-2)' } },
      h('button', {
        class: 'zx-btn', type: 'button', onclick: () => { void uploader.upload([demoImage('contact.svg')]); }
      }, 'Simulate success'),
      h('button', {
        class: 'zx-btn', type: 'button', onclick: () => { void uploader.upload([demoImage('error.svg')]); }
      }, 'Simulate server error'),
      h('button', { class: 'zx-btn', type: 'button', onclick: () => uploader.abort() }, 'Abort active'),
      h('button', { class: 'zx-btn', type: 'button', onclick: () => uploader.clear() }, 'Clear'));
    const marker = h('section', {
      style: {
        display: 'grid',
        gap: 'var(--zx-space-4)',
        padding: 'var(--zx-space-5)',
        border: '1px solid var(--zx-color-border)',
        borderRadius: 'var(--zx-radius-lg)',
        background: 'var(--zx-color-bg-surface)'
      }
    },
    h('p', {}, 'The injected offline transport reports deterministic progress. The generated SVG exercises the image preview without a network endpoint.'),
    uploader,
    controls,
    log);
    container.append(marker);
    cleanupWhenRemoved(marker, () => uploader.destroy());
  }
};

/** Offline upload transport matching FieldUpload's injected transport contract. */
class StubHttp {
  /**
   * Simulates an upload.
   * @param {string} _url Ignored demo URL.
   * @param {import('../../src/components/field-upload/field-upload.js').UploadTransportOptions} options Upload options.
   * @returns {Promise<Record<string, unknown>>}
   */
  upload(_url, options) {
    return new Promise((resolve, reject) => {
      let percent = 0;
      const timer = setInterval(() => {
        percent += 10;
        options.onProgress(percent);
        if (percent < 100) return;
        clearInterval(timer);
        const file = options.files[0];
        if (file.name.includes('error')) reject(new Error('Simulated server rejection.'));
        else resolve({ ok: true, file: file.name, bytes: file.size });
      }, 100);
      options.signal.addEventListener('abort', () => {
        clearInterval(timer);
        reject(new DOMException('Upload aborted', 'AbortError'));
      }, { once: true });
    });
  }
}

/** @param {string} name @returns {File} */
function demoImage(name) {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="140" viewBox="0 0 240 140">' +
    '<rect width="240" height="140" rx="16" fill="#e8f5ec"/>' +
    '<circle cx="120" cy="54" r="28" fill="#008040"/>' +
    '<path d="M60 128c8-30 30-45 60-45s52 15 60 45" fill="#008040"/>' +
    '</svg>';
  return new File([svg], name, { type: 'image/svg+xml' });
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
