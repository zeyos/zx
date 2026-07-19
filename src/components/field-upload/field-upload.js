import { Component } from '../../core/component.js';
import { h } from '../../core/dom.js';
import { uid } from '../../core/util.js';

/**
 * @typedef {Object} UploadTransport
 * @property {(url: string, options: UploadTransportOptions) => Promise<unknown>} [upload] Upload method used by stubs.
 * @property {(url: string, options: Record<string, unknown>) => Promise<unknown>} [request] Http-compatible request method.
 */

/**
 * @typedef {Object} UploadTransportOptions
 * @property {File[]} files Selected files.
 * @property {string} paramName Multipart field name.
 * @property {Record<string, unknown>} params Extra form values.
 * @property {Record<string, string>} headers Request headers.
 * @property {AbortSignal} signal Abort signal.
 * @property {(percent: number) => void} onProgress Progress callback.
 */

/**
 * @typedef {Object} FieldUploadOptions
 * @property {string} [url=''] Upload endpoint.
 * @property {string} [paramName='upload'] Multipart file field name.
 * @property {Record<string, unknown>} [params={}] Extra multipart values.
 * @property {Record<string, string>} [headers={}] Request headers.
 * @property {boolean} [multiple=false] Allow multiple files.
 * @property {string|null} [accept=null] Native accept filter.
 * @property {number|null} [maxSize=null] Maximum size per file in bytes.
 * @property {boolean} [autoUpload=true] Upload immediately after selection.
 * @property {boolean} [preview=true] Show a preview for the first selected image.
 * @property {UploadTransport|null} [http=null] Injected Http-compatible or stub upload transport.
 */

/**
 * Accessible click/drop upload area. Native requests intentionally use XMLHttpRequest because
 * browser fetch upload streams still do not expose portable upload progress events.
 * @fires FieldUpload#select
 * @fires FieldUpload#progress
 * @fires FieldUpload#success
 * @fires FieldUpload#error
 * @fires FieldUpload#abort
 */
export class FieldUpload extends Component {
  static cssName = 'field-upload';

  /** @type {FieldUploadOptions} */
  static defaults = {
    url: '',
    paramName: 'upload',
    params: {},
    headers: {},
    multiple: false,
    accept: null,
    maxSize: null,
    autoUpload: true,
    preview: true,
    http: null
  };

  /** @returns {HTMLElement} */
  render() {
    const root = /** @type {HTMLElement} */ (this.el ?? h('div'));
    this.el = root;
    this._ownedNodes = [];
    this._files = [];
    this._disabled = false;
    this._running = false;
    this._runId = 0;
    this._xhr = null;
    this._transportController = null;
    this._previewUrl = null;
    this._initialState = root.getAttribute('data-state');
    this._initialDisabled = root.getAttribute('data-disabled');
    const inputId = uid('zx-upload');
    this._input = h('input', {
      class: 'zx-field-upload__input',
      id: inputId,
      type: 'file',
      multiple: Boolean(this.options.multiple),
      accept: this.options.accept ?? undefined,
      tabIndex: -1
    });
    this._dropzone = h('button', {
      class: 'zx-field-upload__dropzone',
      type: 'button',
      ariaControls: inputId,
      ariaLabel: this.options.multiple ? 'Choose files or drop them here' : 'Choose a file or drop it here'
    },
    h('span', { class: 'zx-field-upload__prompt' }, this.options.multiple ? 'Drop files here or choose files' : 'Drop a file here or choose a file'),
    h('span', { class: 'zx-field-upload__hint' }, uploadHint(this.options)));
    this._preview = h('div', { class: 'zx-field-upload__preview' });
    this._progress = h('progress', {
      class: 'zx-field-upload__progress',
      max: 100,
      value: 0,
      ariaLabel: 'Upload progress'
    });
    this._progressText = h('span', { class: 'zx-field-upload__progress-text' }, '0%');
    this._abort = h('button', {
      class: 'zx-btn zx-field-upload__abort',
      type: 'button'
    }, 'Abort');
    this._progressWrap = h('div', {
      class: 'zx-field-upload__progress-wrap',
      hidden: true
    }, this._progress, this._progressText, this._abort);
    this._status = h('div', {
      class: 'zx-field-upload__status',
      role: 'status',
      ariaLive: 'polite'
    });
    this._ownedNodes.push(this._input, this._dropzone, this._preview, this._progressWrap, this._status);
    root.append(...this._ownedNodes);

    this.listen(this._dropzone, 'click', () => {
      if (!this._disabled && !this._running) this._input.click();
    });
    this.listen(this._input, 'change', () => this._selectFiles(this._input.files));
    this.listen(this._dropzone, 'dragenter', (event) => this._handleDragOver(event));
    this.listen(this._dropzone, 'dragover', (event) => this._handleDragOver(event));
    this.listen(this._dropzone, 'dragleave', (event) => {
      if (!(event.relatedTarget instanceof Node) || !this._dropzone.contains(event.relatedTarget)) this._setState('idle');
    });
    this.listen(this._dropzone, 'drop', (event) => {
      event.preventDefault();
      if (this._disabled || this._running) return;
      this._setState('idle');
      this._selectFiles(event.dataTransfer?.files ?? []);
    });
    this.listen(this._abort, 'click', () => this.abort());
    this.setDisabled(false);
    return root;
  }

  /**
   * Uploads supplied files, or the current selection when omitted.
   * @param {File[]|FileList|null} [files=null] Optional files to select and upload.
   * @returns {Promise<unknown|null>} Transport response, or null when no upload starts.
   */
  async upload(files = null) {
    if (files !== null && !this._setFiles(files)) return null;
    if (this._disabled || this._running || this._files.length === 0) return null;
    this._running = true;
    this._runId += 1;
    const runId = this._runId;
    this._setState('uploading');
    this._progressWrap.hidden = false;
    this._abort.hidden = false;
    this._setProgress(0);
    this._status.textContent = 'Uploading…';

    try {
      const response = this.options.http ? await this._uploadInjected() : await this._uploadXhr();
      if (runId !== this._runId) return null;
      this._running = false;
      this._xhr = null;
      this._transportController = null;
      this._abort.hidden = true;
      this._setProgress(100);
      this._setState('success');
      this._status.textContent = 'Upload complete.';
      this.emit('success', { response });
      return response;
    } catch (caught) {
      if (runId !== this._runId) return null;
      const error = caught instanceof Error ? caught : new Error(String(caught));
      if (error.name === 'AbortError') {
        this._finishAbort();
        return null;
      }
      this._running = false;
      this._xhr = null;
      this._transportController = null;
      this._abort.hidden = true;
      this._setState('error');
      this._status.textContent = error.message;
      this.emit('error', { error });
      return null;
    }
  }

  /**
   * Aborts the active upload.
   * @returns {this}
   * @fires FieldUpload#abort
   */
  abort() {
    if (!this._running) return this;
    this._xhr?.abort();
    this._transportController?.abort();
    this._finishAbort();
    return this;
  }

  /**
   * Clears selection, preview, progress, and status.
   * @returns {this}
   */
  clear() {
    if (this._running) this.abort();
    this._files = [];
    this._input.value = '';
    this._revokePreview();
    this._preview.replaceChildren();
    this._progress.value = 0;
    this._progressText.textContent = '0%';
    this._progressWrap.hidden = true;
    this._status.textContent = '';
    this._setState('idle');
    return this;
  }

  /**
   * Enables or disables file selection and dropping.
   * @param {boolean} disabled Disabled state.
   * @returns {this}
   */
  setDisabled(disabled) {
    this._disabled = Boolean(disabled);
    this._input.disabled = this._disabled;
    this._dropzone.disabled = this._disabled;
    this.el.dataset.disabled = String(this._disabled);
    return this;
  }

  /** @param {FileList|File[]|ArrayLike<File>} files @returns {void} */
  _selectFiles(files) {
    if (!this._setFiles(files)) return;
    this._input.value = '';
    if (this.options.autoUpload) void this.upload();
  }

  /** @param {FileList|File[]|ArrayLike<File>} files @returns {boolean} */
  _setFiles(files) {
    if (this._disabled || this._running) return false;
    const selected = Array.from(files ?? []);
    const normalized = this.options.multiple ? selected : selected.slice(0, 1);
    if (normalized.length === 0) return false;
    const invalid = normalized.find((file) => !matchesAccept(file, this.options.accept));
    if (invalid) {
      this._selectionError(new Error(`${invalid.name} is not an accepted file type.`));
      return false;
    }
    const oversized = this.options.maxSize == null ? null : normalized.find((file) => file.size > Number(this.options.maxSize));
    if (oversized) {
      this._selectionError(new Error(`${oversized.name} exceeds the maximum file size.`));
      return false;
    }
    this._files = normalized;
    this._renderPreview();
    this._status.textContent = normalized.map((file) => file.name).join(', ');
    this._setState('selected');
    this.emit('select', { files: this._files.slice() });
    return true;
  }

  /** @param {DragEvent} event @returns {void} */
  _handleDragOver(event) {
    event.preventDefault();
    if (!this._disabled && !this._running) this._setState('dragover');
  }

  /** @returns {Promise<unknown>} */
  _uploadInjected() {
    const transport = this.options.http;
    this._transportController = new AbortController();
    const uploadOptions = {
      files: this._files.slice(),
      paramName: String(this.options.paramName),
      params: { ...this.options.params },
      headers: { ...this.options.headers },
      signal: this._transportController.signal,
      onProgress: (percent) => this._setProgress(percent)
    };
    if (typeof transport.upload === 'function') return transport.upload(String(this.options.url), uploadOptions);
    if (typeof transport.request === 'function') {
      return transport.request(String(this.options.url), {
        method: 'POST',
        data: uploadOptions.params,
        files: uploadOptions.files,
        headers: uploadOptions.headers,
        signal: uploadOptions.signal,
        onProgress: uploadOptions.onProgress,
        paramName: uploadOptions.paramName
      });
    }
    return Promise.reject(new TypeError('Injected upload transport requires upload() or request()'));
  }

  /** @returns {Promise<unknown>} */
  _uploadXhr() {
    if (typeof XMLHttpRequest !== 'function') return Promise.reject(new Error('XMLHttpRequest is not available'));
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      this._xhr = xhr;
      xhr.open('POST', String(this.options.url));
      for (const [name, value] of Object.entries(this.options.headers ?? {})) xhr.setRequestHeader(name, String(value));
      this.listen(xhr.upload, 'progress', (event) => {
        if (event.lengthComputable) this._setProgress((event.loaded / event.total) * 100);
      });
      this.listen(xhr, 'load', () => {
        if (xhr.status < 200 || xhr.status >= 300) {
          reject(new Error(`Upload failed with HTTP ${xhr.status}`));
          return;
        }
        resolve(parseResponse(xhr.responseText));
      });
      this.listen(xhr, 'error', () => reject(new Error('Upload request failed')));
      this.listen(xhr, 'abort', () => reject(abortError()));
      xhr.send(createFormData(this._files, String(this.options.paramName), this.options.params));
    });
  }

  /** @param {number} percent @returns {void} */
  _setProgress(percent) {
    const value = Math.max(0, Math.min(100, Number(percent) || 0));
    this._progress.value = value;
    this._progressText.textContent = `${Math.round(value)}%`;
    this.emit('progress', { percent: value });
  }

  /** @returns {void} */
  _finishAbort() {
    if (!this._running) return;
    this._runId += 1;
    this._running = false;
    this._xhr = null;
    this._transportController = null;
    this._abort.hidden = true;
    this._setState('idle');
    this._status.textContent = 'Upload aborted.';
    this.emit('abort', {});
  }

  /** @param {Error} error @returns {void} */
  _selectionError(error) {
    this._setState('error');
    this._status.textContent = error.message;
    this.emit('error', { error });
  }

  /** @returns {void} */
  _renderPreview() {
    this._revokePreview();
    this._preview.replaceChildren();
    const file = this._files[0];
    if (!this.options.preview || !file?.type?.startsWith('image/') || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return;
    this._previewUrl = URL.createObjectURL(file);
    this._preview.append(h('img', {
      class: 'zx-field-upload__image',
      src: this._previewUrl,
      alt: `Preview of ${file.name}`
    }));
  }

  /** @returns {void} */
  _revokePreview() {
    if (this._previewUrl && typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(this._previewUrl);
    this._previewUrl = null;
  }

  /** @param {string} state @returns {void} */
  _setState(state) {
    if (state === 'idle') this.el.removeAttribute('data-state');
    else this.el.dataset.state = state;
  }

  /** @returns {void} */
  destroy() {
    if (this._running) this.abort();
    this._revokePreview();
    for (const node of this._ownedNodes ?? []) node.remove();
    if (this._initialState === null) this.el.removeAttribute('data-state');
    else this.el.setAttribute('data-state', this._initialState);
    if (this._initialDisabled === null) this.el.removeAttribute('data-disabled');
    else this.el.setAttribute('data-disabled', this._initialDisabled);
    super.destroy();
  }
}

/** @param {FieldUploadOptions} options @returns {string} */
function uploadHint(options) {
  const parts = [];
  if (options.accept) parts.push(String(options.accept));
  if (options.maxSize != null) parts.push(`up to ${formatBytes(Number(options.maxSize))}`);
  return parts.join(' · ') || 'Choose from this device';
}

/** @param {number} bytes @returns {string} */
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}

/** @param {File} file @param {string|null|undefined} accept @returns {boolean} */
function matchesAccept(file, accept) {
  if (!accept) return true;
  const type = String(file.type ?? '').toLowerCase();
  return String(accept).split(',').map((value) => value.trim().toLowerCase()).filter(Boolean).some((rule) => {
    if (rule.startsWith('.')) return file.name.toLowerCase().endsWith(rule);
    if (rule.endsWith('/*')) return type.startsWith(rule.slice(0, -1));
    return type === rule;
  });
}

/** @param {File[]} files @param {string} paramName @param {Record<string, unknown>} params @returns {FormData} */
function createFormData(files, paramName, params) {
  const form = new FormData();
  for (const file of files) form.append(paramName, file);
  for (const [name, value] of Object.entries(params ?? {})) appendFormValue(form, name, value);
  return form;
}

/** @param {FormData} form @param {string} name @param {unknown} value @returns {void} */
function appendFormValue(form, name, value) {
  if (value == null) return;
  if (Array.isArray(value)) {
    for (const item of value) appendFormValue(form, name, item);
    return;
  }
  const isBlob = typeof Blob === 'function' && value instanceof Blob;
  if (isBlob) form.append(name, value);
  else form.append(name, typeof value === 'object' ? JSON.stringify(value) : String(value));
}

/** @param {string} text @returns {unknown} */
function parseResponse(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/** @returns {Error} */
function abortError() {
  if (typeof DOMException === 'function') return new DOMException('Upload aborted', 'AbortError');
  const error = new Error('Upload aborted');
  error.name = 'AbortError';
  return error;
}

/**
 * Files selected event.
 * @event FieldUpload#select
 * @type {CustomEvent<{files: File[]}>
 */

/**
 * Upload progress event.
 * @event FieldUpload#progress
 * @type {CustomEvent<{percent: number}>
 */

/**
 * Upload success event.
 * @event FieldUpload#success
 * @type {CustomEvent<{response: unknown}>
 */

/**
 * Upload failure event.
 * @event FieldUpload#error
 * @type {CustomEvent<{error: Error}>
 */

/**
 * Upload aborted event.
 * @event FieldUpload#abort
 * @type {CustomEvent<Record<string, never>>}
 */
