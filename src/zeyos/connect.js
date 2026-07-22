import { Message, setLanguage } from '../index.js';

/**
 * @typedef {Object} ConnectOptions
 * @property {(error: unknown, context?: {operation?: string, resource?: string}) => unknown} [onError] Error reporter.
 * @property {string} [locale] BCP 47 locale applied to Zx i18n/date formatting.
 */
/**
 * @typedef {Object} ZeyosFacade
 * @property {Record<string, any>} client Injected client instance.
 * @property {(resource: string, params?: Record<string, unknown>) => Promise<unknown>} list List a resource.
 * @property {(resource: string, idOrParams: unknown, params?: Record<string, unknown>) => Promise<unknown>} get Fetch one record.
 * @property {(resource: string, data: Record<string, unknown>) => Promise<unknown>} create Create one record.
 * @property {(resource: string, idOrInput: unknown, data?: Record<string, unknown>) => Promise<unknown>} update Update one record.
 * @property {(error: unknown, context?: {operation?: string, resource?: string}) => unknown} reportError Report an API error.
 */

/**
 * Connects an existing injected `@zeyos/client` instance to Zx infrastructure. This function never
 * creates or imports the client package. It applies a supplied/derivable locale and returns thin
 * operation helpers that report and rethrow failures.
 * @param {Record<string, any>} client Injected ZeyOS client instance.
 * @param {ConnectOptions} [options={}] Wiring options.
 * @returns {ZeyosFacade} Bound facade.
 */
export function connect(client, { onError, locale } = {}) {
  if (!client || typeof client !== 'object' || !client.api || typeof client.api !== 'object') {
    throw new TypeError('connect() requires a ZeyOS client with an api namespace');
  }
  if (onError != null && typeof onError !== 'function') throw new TypeError('onError must be a function');

  const language = locale ?? deriveLocale(client);
  if (language) setLanguage(String(language));

  const reportError = (error, context) => {
    if (onError) return onError(error, context);
    return Message.error(errorMessage(error));
  };

  const invoke = async (action, resource, input) => {
    const operation = operationFor(client, action, resource);
    try {
      return await client.api[operation](input);
    } catch (error) {
      try { reportError(error, { operation, resource }); } catch { /* Preserve the API failure. */ }
      throw error;
    }
  };

  return {
    client,
    list: (resource, params = {}) => invoke('list', resource, params),
    get: (resource, idOrParams, params = {}) => invoke('get', resource,
      isRecord(idOrParams) ? idOrParams : { ID: idOrParams, ...params }),
    create: (resource, data) => invoke('create', resource, data),
    update: (resource, idOrInput, data) => invoke('update', resource,
      data === undefined && isRecord(idOrInput) ? idOrInput : { ID: idOrInput, body: data ?? {} }),
    reportError
  };
}

/** @param {Record<string, any>} client @returns {unknown} */
function deriveLocale(client) {
  return client.locale ?? client.language ?? client.config?.locale ?? client.metadata?.locale ?? null;
}

/** @param {Record<string, any>} client @param {'list'|'get'|'create'|'update'} action @param {string} resource @returns {string} */
function operationFor(client, action, resource) {
  const name = String(resource ?? '').trim();
  if (!name) throw new TypeError('ZeyOS resource must not be empty');
  const resourceOperations = typeof client.schema?.operations === 'function'
    ? client.schema.operations(name)
    : [];
  if (Array.isArray(resourceOperations) && resourceOperations.length) {
    const exactResourceMatches = resourceOperations
      .filter((operation) => typeof operation === 'string' && operation.toLowerCase().startsWith(action))
      .sort((left, right) => left.length - right.length);
    if (exactResourceMatches.length) return exactResourceMatches[0];
  }
  const known = Array.isArray(resourceOperations) && resourceOperations.length
    ? resourceOperations
    : (typeof client.schema?.operationIds === 'function'
      ? client.schema.operationIds()
      : Object.keys(client.api));
  if (known.includes(name) && name.toLowerCase().startsWith(action)) return name;

  const normalizedResource = normalizeResource(name);
  const singular = singularize(normalizedResource);
  const matches = known.filter((operation) => {
    if (typeof operation !== 'string' || !operation.toLowerCase().startsWith(action)) return false;
    const suffix = normalizeResource(operation.slice(action.length));
    return suffix === normalizedResource || suffix === singular || singularize(suffix) === singular;
  });
  if (matches.length) return matches.sort((left, right) => left.length - right.length)[0];

  const candidates = action === 'list'
    ? [`list${pascalCase(name)}`]
    : [`${action}${pascalCase(singularizeName(name))}`, `${action}${pascalCase(name)}`];
  const apiKeys = new Set(Object.keys(client.api));
  const fallback = candidates.find((candidate) => apiKeys.has(candidate));
  if (fallback) return fallback;
  throw new RangeError(`No ${action} operation found for ZeyOS resource "${name}"`);
}

/** @param {unknown} value @returns {boolean} */
function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/** @param {unknown} error @returns {string} */
function errorMessage(error) {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === 'object' && typeof error.message === 'string') return error.message;
  return String(error ?? 'ZeyOS request failed');
}

/** @param {string} value @returns {string} */
function normalizeResource(value) {
  return String(value).replace(/[^a-z\d]/gi, '').toLowerCase();
}

/** @param {string} value @returns {string} */
function singularize(value) {
  if (value.endsWith('ies')) return `${value.slice(0, -3)}y`;
  if (value.endsWith('sses')) return value.slice(0, -2);
  if (value.endsWith('s') && !value.endsWith('ss')) return value.slice(0, -1);
  return value;
}

/** @param {string} value @returns {string} */
function singularizeName(value) {
  const source = String(value);
  if (/ies$/i.test(source)) return `${source.slice(0, -3)}y`;
  if (/s$/i.test(source) && !/ss$/i.test(source)) return source.slice(0, -1);
  return source;
}

/** @param {string} value @returns {string} */
function pascalCase(value) {
  return String(value).split(/[^a-z\d]+/i).filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join('');
}
