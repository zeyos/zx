import { FieldUpload, h } from '../../src/index.js';

export default {
  title: 'Field upload',
  group: 'Forms',
  blurb: 'A file field with a preview, a progress bar, and an injectable transport \u2014 which is what '
    + 'lets this page demonstrate every path without a server.',

  examples: [
    {
      title: 'Upload, progress, and failure',
      blurb: 'http takes any object with an upload(url, options) method, so the transport is a '
        + 'parameter rather than a hard dependency. The stub here reports deterministic progress '
        + 'and rejects any file whose name contains \u201cerror\u201d, which exercises the failure path '
        + 'offline. maxSize and accept are checked before a byte is sent.',
      layout: 'stack',
      width: '520px',
      render: ({ cleanup, log }) => {
        const uploader = new FieldUpload(null, {
          url: '/offline-demo-upload',
          accept: 'image/*',
          maxSize: 1024 * 1024,
          preview: true,
          autoUpload: true,
          http: new StubHttp(),
          onselect: ({ detail }) => log(`select ${detail.files.map((file) => file.name).join(', ')}`),
          onprogress: ({ detail }) => log(`progress ${Math.round(detail.percent)}%`),
          onsuccess: ({ detail }) => log(`success ${JSON.stringify(detail.response)}`),
          onerror: ({ detail }) => log(`error ${detail.error.message}`),
          onabort: () => log('abort')
        });
        cleanup(() => uploader.destroy());
        return [
          uploader.toElement(),
          h('div', { class: 'demo-row' },
            h('button', { type: 'button', onclick: () => void uploader.upload([demoImage('contact.svg')]) },
              'Simulate success'),
            h('button', { type: 'button', onclick: () => void uploader.upload([demoImage('error.svg')]) },
              'Simulate server error'),
            h('button', { type: 'button', onclick: () => uploader.abort() }, 'abort()'),
            h('button', { type: 'button', onclick: () => uploader.clear() }, 'clear()'))
        ];
      }
    }
  ]
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
