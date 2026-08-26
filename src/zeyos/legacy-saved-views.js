/**
 * @typedef {Object} SavedViewScope
 * @property {string|number} userId Client identity used by the controller; never sent to the legacy endpoint.
 * @property {string|number|null} workspaceId ZeyOS fork/workspace id.
 * @property {string} resource ZeyOS resource whose record views are being saved.
 */

/**
 * @typedef {Object} LegacySavedViewTransportOptions
 * @property {string} [recordName='__zx_record_views_v1__'] Reserved `userfields.name` value.
 * @property {string} [viewPrefix='zx.record-views:'] Namespace prepended to `userfields.view`.
 * @property {string} [module=''] Legacy UMI/module value.
 */

/**
 * Converts the callback form of `PG.load` into the promise request consumed by
 * `createLegacySavedViewTransport`. Pass a bound method (`PG.load.bind(PG)`) so legacy receivers
 * that depend on `this` remain intact.
 * @param {(params:Record<string,unknown>,onLoad:(data:unknown)=>void,onCatch:(message:unknown,type?:unknown,info?:unknown)=>boolean)=>unknown} load Legacy loader.
 * @returns {(params:Record<string,unknown>)=>Promise<unknown>}
 */
export function legacySavedViewRequest(load) {
  if (typeof load !== 'function') throw new TypeError('Legacy saved-view loader must be a function');
  return (params) => new Promise((resolve, reject) => {
    load(params, resolve, (message, type, info) => {
      const error = new Error(String(message ?? 'ZeyOS saved-view request failed'));
      Object.assign(error, { type, info });
      reject(error);
      return true;
    });
  });
}

/**
 * Adapts ZeyOS's existing `fields`, `fields_save`, and `fields_remove` endpoints to the atomic
 * document transport used by saved record views. The endpoint derives the user from the
 * authenticated session; accepting `userId` in the scope prevents accidental controller reuse but
 * deliberately does not turn a client-supplied identity into an authorization input.
 *
 * `request` is injected because Zx supports both the legacy `PG.load` bridge and modern hosts. It
 * receives the familiar plain endpoint parameters and returns a promise for the decoded response.
 *
 * @param {(params:Record<string,unknown>)=>Promise<unknown>} request Promise-based legacy request bridge.
 * @param {LegacySavedViewTransportOptions} [options={}] Endpoint namespace options.
 * @returns {{load:(scope:SavedViewScope)=>Promise<Record<string,unknown>|null>,save:(scope:SavedViewScope,document:Record<string,unknown>)=>Promise<Record<string,unknown>>,remove:(scope:SavedViewScope)=>Promise<void>}}
 */
export function createLegacySavedViewTransport(request, options = {}) {
  if (typeof request !== 'function') throw new TypeError('Saved-view request must be a function');
  const recordName = normalizeNonEmpty(options.recordName, '__zx_record_views_v1__', 'recordName');
  const viewPrefix = normalizeNonEmpty(options.viewPrefix, 'zx.record-views:', 'viewPrefix');
  const module = options.module == null ? '' : String(options.module);

  const paramsFor = (scope, page) => {
    const normalized = normalizeScope(scope);
    return {
      umi: module,
      page,
      fork: normalized.workspaceId,
      view: `${viewPrefix}${normalized.resource}`
    };
  };

  return {
    async load(scope) {
      const response = await request(paramsFor(scope, 'fields'));
      const value = findReservedDocument(response, recordName);
      if (value == null || value === '') return null;
      if (typeof value === 'string') {
        try {
          const parsed = JSON.parse(value);
          return isRecord(parsed) ? parsed : null;
        } catch {
          return null;
        }
      }
      return isRecord(value) ? cloneJson(value) : null;
    },

    async save(scope, document) {
      if (!isRecord(document)) throw new TypeError('Saved-view document must be an object');
      const copy = cloneJson(document);
      await request({
        ...paramsFor(scope, 'fields_save'),
        name: recordName,
        data: JSON.stringify(copy)
      });
      return copy;
    },

    async remove(scope) {
      await request({
        ...paramsFor(scope, 'fields_remove'),
        name: recordName
      });
    }
  };
}

/** @param {unknown} scope @returns {{userId:string,workspaceId:string|number|null,resource:string}} */
function normalizeScope(scope) {
  if (!isRecord(scope)) throw new TypeError('Saved-view scope must be an object');
  if (scope.userId == null || String(scope.userId).trim() === '') {
    throw new TypeError('Saved-view scope requires userId');
  }
  const resource = String(scope.resource ?? '').trim();
  if (!resource) throw new TypeError('Saved-view scope requires resource');
  const workspaceId = scope.workspaceId == null || scope.workspaceId === '' ? null : scope.workspaceId;
  return { userId: String(scope.userId), workspaceId, resource };
}

/** @param {unknown} response @param {string} recordName @returns {unknown} */
function findReservedDocument(response, recordName) {
  if (!Array.isArray(response) || !Array.isArray(response[0]) || !Array.isArray(response[1])) {
    return null;
  }
  const index = response[0].findIndex((name) => String(name) === recordName);
  return index < 0 ? null : response[1][index];
}

/** @param {unknown} value @param {string} fallback @param {string} label @returns {string} */
function normalizeNonEmpty(value, fallback, label) {
  const normalized = value == null ? fallback : String(value).trim();
  if (!normalized) throw new TypeError(`${label} must not be empty`);
  return normalized;
}

/** @param {unknown} value @returns {value is Record<string,unknown>} */
function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/** @param {Record<string,unknown>} value @returns {Record<string,unknown>} */
function cloneJson(value) {
  assertJsonValue(value, new Set());
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    throw new TypeError('Saved-view document must be JSON-serializable');
  }
}

/** @param {unknown} value @param {Set<object>} ancestors @returns {void} */
function assertJsonValue(value, ancestors) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number' && Number.isFinite(value)) return;
  if (typeof value !== 'object') throw new TypeError('Saved-view document must be JSON-serializable');
  if (ancestors.has(value)) throw new TypeError('Saved-view document must be JSON-serializable');
  if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) {
    throw new TypeError('Saved-view document must be JSON-serializable');
  }
  ancestors.add(value);
  const entries = Array.isArray(value) ? value : Object.values(value);
  for (const entry of entries) assertJsonValue(entry, ancestors);
  ancestors.delete(value);
}
