/**
 * @typedef {Object} HttpOptions
 * @property {string} [base=''] URL prefix.
 * @property {Record<string, string>} [headers={}] Default request headers.
 * @property {((error: Error, context: {path: string, options: RequestOptions}) => void)|null} [onError=null]
 * @property {number} [timeout=30000] Timeout in milliseconds; zero disables it.
 */

/**
 * @typedef {Object} RequestOptions
 * @property {string} [method='GET'] HTTP method.
 * @property {unknown} [data=null] JSON or form data.
 * @property {File|FileList|File[]} [files=null] Files that switch the body to FormData.
 * @property {string|URLSearchParams|Record<string, unknown>} [query=null] Query parameters.
 * @property {Record<string, string>} [headers={}] Per-request headers.
 */

/** Dependency-free JSON fetch wrapper with legacy ZeyOS envelope handling. */
export class Http {
  /** @type {string} */
  base;
  /** @type {Readonly<Record<string, string>>} */
  headers;
  /** @type {HttpOptions['onError']} */
  onError;
  /** @type {number} */
  timeout;

  /**
   * @param {HttpOptions} [options={}] Client defaults.
   */
  constructor({ base = '', headers = {}, onError = null, timeout = 30000 } = {}) {
    this.base = String(base);
    this.headers = Object.freeze({ ...headers });
    this.onError = onError;
    this.timeout = Number(timeout);
  }

  /**
   * Performs a request and returns its parsed JSON payload or legacy `result` value.
   * @param {string} path Path relative to the configured base.
   * @param {RequestOptions} [options={}] Request settings.
   * @returns {Promise<any>}
   */
  async request(path, options = {}) {
    const {
      method = 'GET', data = null, files = null, query = null, headers = {}
    } = options;
    const controller = new AbortController();
    const timeoutId = this.timeout > 0 ? setTimeout(() => controller.abort(), this.timeout) : null;
    const requestHeaders = new Headers(this.headers);
    for (const [name, value] of Object.entries(headers)) requestHeaders.set(name, value);
    requestHeaders.set('Accept', requestHeaders.get('Accept') ?? 'application/json');

    let body;
    if (files !== null) {
      body = createFormData(data, files);
      requestHeaders.delete('Content-Type');
    } else if (data !== null && method.toUpperCase() !== 'GET' && method.toUpperCase() !== 'HEAD') {
      body = JSON.stringify(data);
      requestHeaders.set('Content-Type', requestHeaders.get('Content-Type') ?? 'application/json');
    }

    const url = appendQuery(this.base + path, query);
    try {
      const response = await fetch(url, {
        method: method.toUpperCase(),
        headers: requestHeaders,
        body,
        signal: controller.signal
      });
      const text = await response.text();
      let json = null;
      if (text !== '') {
        try {
          json = JSON.parse(text);
        } catch (cause) {
          const error = new Error('Invalid JSON response', { cause });
          error.response = response;
          throw error;
        }
      }

      if (!response.ok) {
        try {
          parseResult(json);
        } catch (error) {
          error.response = response;
          throw error;
        }
        const error = new Error(`HTTP ${response.status} ${response.statusText}`.trim());
        error.response = response;
        throw error;
      }
      return parseResult(json);
    } catch (caught) {
      const error = caught instanceof Error ? caught : new Error(String(caught));
      if (this.onError) {
        try {
          this.onError(error, { path, options });
        } catch {
          // Observer failures do not hide the request failure.
        }
      }
      throw error;
    } finally {
      if (timeoutId !== null) clearTimeout(timeoutId);
    }
  }

  /**
   * Sends a GET request with query parameters.
   * @param {string} path Request path.
   * @param {RequestOptions['query']} [query=null] Query parameters.
   * @returns {Promise<any>}
   */
  get(path, query = null) {
    return this.request(path, { method: 'GET', query });
  }

  /**
   * Sends a POST request with a JSON body.
   * @param {string} path Request path.
   * @param {unknown} [data=null] Request data.
   * @returns {Promise<any>}
   */
  post(path, data = null) {
    return this.request(path, { method: 'POST', data });
  }

  /**
   * Sends a PUT request with a JSON body.
   * @param {string} path Request path.
   * @param {unknown} [data=null] Request data.
   * @returns {Promise<any>}
   */
  put(path, data = null) {
    return this.request(path, { method: 'PUT', data });
  }

  /**
   * Sends a DELETE request with a JSON body.
   * @param {string} path Request path.
   * @param {unknown} [data=null] Request data.
   * @returns {Promise<any>}
   */
  delete(path, data = null) {
    return this.request(path, { method: 'DELETE', data });
  }
}

/**
 * Creates an Http client for a ZeyOS remote-call service.
 * @param {string} service Service name.
 * @param {string} [accesskey=''] Optional service access key.
 * @param {HttpOptions & {apiBase?: string}} [options={}] Client and API-base options.
 * @returns {Http}
 */
export function zeyosService(service, accesskey = '', options = {}) {
  const { apiBase = '../remotecall/', ...httpOptions } = options;
  const base = `${apiBase}${service}${accesskey ? `:${accesskey}` : ''}/`;
  return new Http({ ...httpOptions, base });
}

/**
 * Unwraps a legacy `{result}` response or throws a legacy `{error}` response.
 * JSON values without either envelope key pass through unchanged.
 * @param {any} json Parsed JSON value.
 * @returns {any}
 */
export function parseResult(json) {
  if (json && typeof json === 'object') {
    if (Object.prototype.hasOwnProperty.call(json, 'error') && json.error != null) {
      const message = typeof json.error === 'string' ? json.error : JSON.stringify(json.error);
      throw new Error(message || 'Server error');
    }
    if (Object.prototype.hasOwnProperty.call(json, 'result')) return json.result;
  }
  return json;
}

/**
 * @param {string} url
 * @param {RequestOptions['query']} query
 * @returns {string}
 */
function appendQuery(url, query) {
  if (query == null) return url;
  let encoded;
  if (typeof query === 'string') encoded = query.replace(/^\?/, '');
  else if (query instanceof URLSearchParams) encoded = query.toString();
  else {
    const parameters = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) appendParameter(parameters, key, value);
    encoded = parameters.toString();
  }
  if (!encoded) return url;
  return url + (url.includes('?') ? '&' : '?') + encoded;
}

/** @param {URLSearchParams} parameters @param {string} key @param {unknown} value @returns {void} */
function appendParameter(parameters, key, value) {
  if (value == null) return;
  if (Array.isArray(value)) {
    for (const item of value) appendParameter(parameters, key, item);
  } else {
    parameters.append(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
  }
}

/** @param {unknown} data @param {File|FileList|File[]} files @returns {FormData} */
function createFormData(data, files) {
  const form = new FormData();
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    for (const [key, value] of Object.entries(data)) appendFormValue(form, key, value);
  } else if (data != null) {
    form.append('data', typeof data === 'string' ? data : JSON.stringify(data));
  }

  const list = isFileList(files) || Array.isArray(files) ? Array.from(files) : [files];
  for (const file of list) form.append('files', file);
  return form;
}

/** @param {FormData} form @param {string} key @param {unknown} value @returns {void} */
function appendFormValue(form, key, value) {
  if (value == null) return;
  if (Array.isArray(value)) {
    for (const item of value) appendFormValue(form, key, item);
  } else {
    const isBlob = typeof Blob === 'function' && value instanceof Blob;
    form.append(key, typeof value === 'object' && !isBlob ? JSON.stringify(value) : value);
  }
}

/** @param {unknown} value @returns {value is FileList} */
function isFileList(value) {
  return typeof FileList === 'function' && value instanceof FileList;
}
