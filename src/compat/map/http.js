import { Http, zeyosService } from '../../index.js';
import { GxWrapper } from '../base.js';

/** Legacy generic HTTP client. */
export class Client extends GxWrapper {
  static legacyName = 'gx.zeyos.Client';

  /** @param {Record<string, any>} [options={}] */
  constructor(options = {}) {
    super(options, { url: './remotecall.php' });
    this._http = new Http({ base: String(options.url ?? './remotecall.php'), headers: options.headers ?? {}, timeout: options.timeout ?? 30000 });
  }
  /** @param {string} path @param {unknown} data @param {Function|Record<string, Function>} [callback] @param {string} [resulttype] @returns {Promise<unknown>} */
  post(path, data, callback, resulttype) { return this.request(data, 'POST', callback, resulttype, path); }
  /** @param {string} path @param {unknown} data @param {Function|Record<string, Function>} [callback] @param {string} [resulttype] @returns {Promise<unknown>} */
  get(path, data, callback, resulttype) { return this.request(data, 'GET', callback, resulttype, path); }
  /** @param {unknown} data @param {string} [method='GET'] @param {Function|Record<string, Function>} [callback] @param {string} [resulttype] @param {string} [path=''] @returns {Promise<unknown>} */
  async request(data, method = 'GET', callback, resulttype, path = '') {
    registerCallbackEvents(this, callback);
    this.fireEvent('request');
    try {
      const normalizedMethod = String(method).toUpperCase();
      const result = await this._http.request(String(path ?? ''), normalizedMethod === 'GET'
        ? { method: normalizedMethod, query: data }
        : { method: normalizedMethod, data });
      if (resulttype && legacyType(result) !== resulttype) throw new TypeError(`Invalid server response: expected ${resulttype}`);
      if (typeof callback === 'function') callback.call(this, result);
      this.fireEvent('success', [result]);
      return result;
    } catch (error) {
      this.fireEvent('failure', [error]);
      throw error;
    } finally {
      this.fireEvent('complete');
    }
  }
}

/** Legacy ZeyOS REST request client. */
export class Request extends GxWrapper {
  static legacyName = 'gx.zeyos.Request';

  /** @param {Record<string, any>} [options={}] */
  constructor(options = {}) {
    super(options, { service: false, accesskey: false });
    this._files = null;
    this.setService(options.service ?? '', options.accesskey ?? '');
    if (typeof options.showError === 'function') this.showError = options.showError;
  }
  /** @param {string} service @param {string} [accesskey=''] @returns {this} */
  setService(service, accesskey = '') {
    this.options.service = service;
    this.options.accesskey = accesskey;
    this.baseUrl = `${this.options.apiBase ?? '../remotecall/'}${service}${accesskey ? `:${accesskey}` : ''}/`;
    this._http = zeyosService(String(service), String(accesskey), {
      apiBase: this.options.apiBase ?? '../remotecall/', headers: this.options.headers ?? {}, timeout: this.options.timeout ?? 30000
    });
    return this;
  }
  /** @param {string} path @param {unknown} data @param {Function} [callback] @param {string} [method='GET'] @returns {Promise<unknown>} */
  async send(path, data, callback, method = 'GET') {
    this.fireEvent('request');
    try {
      const verb = String(method ?? 'GET').toUpperCase();
      const request = { method: verb };
      if (verb === 'GET') request.query = data;
      else request.data = data;
      if (this._files) request.files = this._files;
      const result = await this._http.request(String(path ?? ''), request);
      this._files = null;
      this.fireEvent('success', [result]);
      callback?.call(this, result, '200 OK');
      return result;
    } catch (caught) {
      this._files = null;
      const error = caught instanceof Error ? caught : new Error(String(caught));
      this.fireEvent('failure', [error]);
      this.fireEvent('error', [error.message, error.response ?? null, error.response?.headers ?? null]);
      this.fireEvent('exception', [error, null]);
      this.showError?.(error.message);
      throw error;
    } finally {
      this.fireEvent('complete');
    }
  }
  /** @param {string} path @param {unknown} data @param {Function} [callback] @returns {Promise<unknown>} */ post(path, data, callback) { return this.send(path, data, callback, 'POST'); }
  /** @param {string} path @param {unknown} data @param {Function} [callback] @returns {Promise<unknown>} */ get(path, data, callback) { return this.send(path, data, callback, 'GET'); }
  /** @param {string} path @param {unknown} data @param {Function} [callback] @returns {Promise<unknown>} */ put(path, data, callback) { return this.send(path, data, callback, 'PUT'); }
  /** @param {string} path @param {unknown} data @param {Function} [callback] @returns {Promise<unknown>} */ delete(path, data, callback) { return this.send(path, data, callback, 'DELETE'); }
  /** @param {string} path @param {unknown} data @param {File[]|FileList|Element[]} files @param {Function} [callback] @returns {Promise<unknown>} */
  upload(path, data, files, callback) { this._files = normalizeFiles(files); return this.send(path, data, callback, 'POST'); }
  /** @param {string} path @returns {Window|null} */ openLink(path) { return window.open(this.baseUrl + String(path ?? ''), '_blank'); }
  /** @param {string} error @returns {void} */ showError(error) { console.error(error); }
}

/** @param {GxWrapper} wrapper @param {Function|Record<string, Function>|undefined} callbacks @returns {void} */
function registerCallbackEvents(wrapper, callbacks) {
  if (!callbacks || typeof callbacks !== 'object') return;
  for (const [type, callback] of Object.entries(callbacks)) wrapper.addEvent(type, callback);
}

/** @param {unknown} value @returns {string} */
function legacyType(value) {
  if (Array.isArray(value)) return 'array';
  if (value === null) return 'null';
  return typeof value === 'object' ? 'object' : typeof value;
}

/** @param {File[]|FileList|Element[]|unknown} files @returns {File[]} */
function normalizeFiles(files) {
  const values = files == null ? [] : Array.from(files);
  return values.flatMap((value) => {
    if (typeof File !== 'undefined' && value instanceof File) return [value];
    if (value?.files) return Array.from(value.files);
    return [];
  });
}
