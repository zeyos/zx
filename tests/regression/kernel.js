import assert from 'node:assert/strict';

export const cases = [
  {
    name: 'roving groups restore detached items and remember a new insertion baseline',
    async run({ page }) {
      const result = await page.evaluate(async () => {
        const { h, rovingTabindex } = window.zx;
        const first = h('button', { tabindex: 5 }, 'First');
        const second = h('button', {}, 'Second');
        const root = h('div', {}, first, second);
        document.body.append(root);
        const group = rovingTabindex(root, 'button');
        first.remove();
        await new Promise(requestAnimationFrame);
        const detached = first.getAttribute('tabindex');
        first.setAttribute('tabindex', '7');
        root.append(first);
        await new Promise(requestAnimationFrame);
        first.hidden = true;
        await new Promise(requestAnimationFrame);
        first.hidden = false;
        await new Promise(requestAnimationFrame);
        group.focusLast();
        const focused = document.activeElement === first;
        group.destroy(); group.destroy();
        const restored = [first.getAttribute('tabindex'), second.getAttribute('tabindex')];
        root.remove();
        return { detached, focused, restored };
      });
      assert.deepEqual(result, { detached: '5', focused: true, restored: ['7', null] });
    }
  },
  {
    name: 'roving removal and reinsertion in one task retains the new baseline',
    async run({ page }) {
      const result = await page.evaluate(async () => {
        const root = zx.h('div', {}, zx.h('button', { tabindex: 3 }, 'First'), zx.h('button', { tabindex: 4 }, 'Second'));
        document.body.append(root);
        const second = root.lastElementChild;
        const group = zx.rovingTabindex(root, 'button');
        second.remove(); second.setAttribute('tabindex', '7'); root.append(second);
        await Promise.resolve(); group.destroy();
        const afterObserver = second.getAttribute('tabindex'); root.remove();

        const next = zx.h('div', {}, zx.h('button', { tabindex: 5 }, 'Third'));
        document.body.append(next);
        const third = next.firstElementChild; const immediate = zx.rovingTabindex(next, 'button');
        third.remove(); third.setAttribute('tabindex', '8'); next.append(third); immediate.focusLast(); immediate.destroy();
        const beforeObserver = third.getAttribute('tabindex'); next.remove();

        const detachedRoot = zx.h('div', {}, zx.h('button', { tabindex: 6 }, 'Detached'));
        document.body.append(detachedRoot);
        const detached = detachedRoot.firstElementChild; const detachedGroup = zx.rovingTabindex(detachedRoot, 'button');
        detached.remove(); await Promise.resolve(); const original = detached.getAttribute('tabindex');
        detachedGroup.destroy(); detachedRoot.remove();
        return { afterObserver, beforeObserver, original };
      });
      assert.deepEqual(result, { afterObserver: '7', beforeObserver: '8', original: '6' });
    }
  },
  {
    name: 'Http-backed uploads preserve client settings, multipart fields and progress',
    async run({ page }) {
      await mockXhr(page);
      const result = await page.evaluate(async () => {
        const progress = [], errors = [], successes = [];
        const http = new zx.Http({ base: '/api/', timeout: 4321, headers: { Authorization: 'test', 'X-Mode': 'base' }, onError: (error) => errors.push(error.message) });
        const upload = new zx.FieldUpload(null, { url: 'upload', http, paramName: 'attachment', params: { tag: ['a', 'b'] }, headers: { 'X-Mode': 'local', 'Content-Type': 'wrong' }, onprogress: (event) => progress.push(event.detail.percent), onsuccess: (event) => successes.push(event.detail.response) });
        document.body.append(upload.el);
        const promise = upload.upload([new File(['contents'], 'sample.txt')]);
        const xhr = window.requests[0];
        if (!xhr) { upload.abort(); upload.destroy(); return { missingXhr: true }; }
        xhr.upload.dispatchEvent(new ProgressEvent('progress', { lengthComputable: true, loaded: 3, total: 4 }));
        const body = [...xhr.body].map(([key, value]) => [key, value instanceof File ? value.name : value]);
        xhr.complete(200, '{"result":{"saved":true},"error":false}');
        const response = await promise;
        const result = { url: xhr.url, method: xhr.method, timeout: xhr.timeout, headers: Object.fromEntries(xhr.headers), body, progress, response, successes, errors };
        upload.destroy();
        return result;
      });
      assert.equal(result.missingXhr, undefined, 'the built-in Http must use a progress-capable upload transport');
      assert.equal(result.url, '/api/upload');
      assert.equal(result.method, 'POST');
      assert.equal(result.timeout, 4321);
      assert.deepEqual(result.headers, { accept: 'application/json', authorization: 'test', 'x-mode': 'local' });
      assert.deepEqual(result.body, [['attachment', 'sample.txt'], ['tag', 'a'], ['tag', 'b']]);
      assert.deepEqual(result.progress, [0, 75, 100]);
      assert.deepEqual(result.response, { saved: true });
      assert.deepEqual(result.successes, [{ saved: true }]);
      assert.deepEqual(result.errors, []);
    }
  },
  {
    name: 'upload aborts and timeouts cannot become late successes',
    async run({ page }) {
      await mockXhr(page);
      const result = await page.evaluate(async () => {
        const errors = [], successes = [], progress = [];
        let aborts = 0;
        const http = new zx.Http({ onError: (error, context) => errors.push([error.name, context.path]) });
        const upload = new zx.FieldUpload(null, { url: '/upload', http, onabort: () => aborts++, onsuccess: () => successes.push(true), onprogress: (event) => progress.push(event.detail.percent) });
        document.body.append(upload.el);
        const promise = upload.upload([new File(['x'], 'x.txt')]);
        const xhr = window.requests[0];
        upload.abort();
        if (!xhr) { upload.destroy(); return { missingXhr: true }; }
        xhr.complete(200, '{"result":"late"}');
        xhr.upload.dispatchEvent(new ProgressEvent('progress', { lengthComputable: true, loaded: 1, total: 1 }));
        const canceled = await promise;
        const next = upload.upload();
        window.requests[1].dispatchEvent(new Event('timeout'));
        const timedOut = await next;
        const result = { canceled, timedOut, aborts, successes, progress, errors, state: upload.el.dataset.state, aborted: xhr.aborted };
        upload.destroy();
        return result;
      });
      assert.deepEqual(result, { canceled: null, timedOut: null, aborts: 1, successes: [], progress: [0, 0], errors: [['AbortError', '/upload'], ['TimeoutError', '/upload']], state: 'error', aborted: true });
    }
  },
  {
    name: 'Http upload failures report once and custom transports retain cancellation',
    async run({ page }) {
      await mockXhr(page);
      const result = await page.evaluate(async () => {
        const reported = [], componentErrors = [];
        const upload = new zx.FieldUpload(null, { url: '/upload', http: new zx.Http({ onError: (error) => reported.push(error.message) }), onerror: (event) => componentErrors.push(event.detail.error.message) });
        document.body.append(upload.el);
        for (const [status, body] of [[400, '{"error":"Denied"}'], [200, 'invalid']]) {
          const promise = upload.upload([new File(['x'], 'x.txt')]);
          const xhr = window.requests.at(-1);
          if (!xhr) { upload.abort(); upload.destroy(); return { missingXhr: true }; }
          xhr.complete(status, body);
          await promise;
        }
        upload.destroy();
        let options, resolve;
        const progress = [], successes = [];
        const custom = new zx.FieldUpload(null, { url: '/custom', paramName: 'document', http: { upload(url, opts) { options = opts; return new Promise((done) => { resolve = done; }); } }, onprogress: (event) => progress.push(event.detail.percent), onsuccess: () => successes.push(true) });
        document.body.append(custom.el);
        const promise = custom.upload([new File(['x'], 'x.txt')]);
        options.onProgress(20);
        custom.abort();
        options.onProgress(90);
        resolve('late');
        const response = await promise;
        const result = { reported, componentErrors, progress, successes, response, aborted: options.signal.aborted, paramName: options.paramName };
        custom.destroy();
        return result;
      });
      assert.deepEqual(result, { reported: ['Denied', 'Invalid JSON response'], componentErrors: ['Denied', 'Invalid JSON response'], progress: [0, 20], successes: [], response: null, aborted: true, paramName: 'document' });
    }
  }
];

/** Controllable local transport: no request leaves the browser fixture. */
async function mockXhr(page) {
  await page.evaluate(() => {
    window.requests = [];
    window.XMLHttpRequest = class extends EventTarget {
      constructor() { super(); this.upload = new EventTarget(); this.headers = new Headers(); window.requests.push(this); }
      open(method, url) { this.method = method; this.url = url; }
      setRequestHeader(name, value) { this.headers.set(name, value); }
      send(body) { this.body = body; }
      abort() { this.aborted = true; this.dispatchEvent(new Event('abort')); }
      complete(status, text) { this.status = status; this.responseText = text; this.dispatchEvent(new Event('load')); }
    };
    window.fetch = () => new Promise(() => {});
  });
}
