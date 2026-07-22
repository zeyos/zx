import { Select } from '../index.js';
import { connect } from './connect.js';
import { buildListQuery } from './query.js';

/**
 * @typedef {Object} ZeyosSelectOptions
 * @property {string[]|Record<string, string>} [fields] Resource fields or aliased projections.
 * @property {string|((item: Record<string, unknown>) => string)} [labelKey] Display-label field or reader.
 * @property {string|((item: Record<string, unknown>) => unknown)} [valueKey='ID'] Value field or reader.
 * @property {string[]} [searchFields] Indexed text fields described to the query builder.
 * @property {number} [limit=50] Maximum rows returned for one query.
 * @property {Record<string, unknown>} [filters] Persistent ZeyOS field predicates.
 * @property {unknown} [value=null] Initially selected id or record.
 * @property {Record<string, unknown>[]} [items=[]] Optional seed records.
 * @property {((item: Record<string, unknown>) => Node|string)|null} [renderItem=null] Option renderer.
 * @property {((item: Record<string, unknown>) => string)|null} [renderValue=null] Selected-value renderer.
 * @property {boolean} [disabled=false] Whether interaction is disabled.
 * @property {string} [placeholder=''] Empty control text.
 * @property {boolean} [clearable=false] Whether selection may be cleared.
 * @property {number} [minQuery=0] Minimum async query length.
 * @property {number} [debounce=200] Async query delay in milliseconds.
 * @property {number} [listHeight=280] Maximum option-list height in pixels.
 * @property {string|((item: Record<string, unknown>) => unknown)|null} [groupKey=null] Optional group reader.
 * @property {Record<string, string>|Record<string, Record<string, string>>} [msg] Local messages.
 * @property {(event: CustomEvent<Record<string, unknown>>) => void} [onchange] Change listener.
 * @property {(event: CustomEvent<Record<string, unknown>>) => void} [onopen] Open listener.
 * @property {(event: CustomEvent<Record<string, unknown>>) => void} [onclose] Close listener.
 * @property {(event: CustomEvent<Record<string, unknown>>) => void} [onquery] Query listener.
 * @property {(event: CustomEvent<Record<string, unknown>>) => void} [onloaded] Loaded listener.
 */

/**
 * @typedef {Object} ZeyosListResult
 * @property {Record<string, unknown>[]} data Normalized records.
 * @property {number} [count] Optional server-side count.
 */

/**
 * Builds the DOM-free Zx Select options used by {@link zeyosSelect}. The generated async filter
 * sends full-text input as `query`, keeps predicates under `filters` (plural), and normalizes both
 * array and `{data,count}` responses.
 * @param {Record<string, any>} client Injected ZeyOS client instance.
 * @param {string} resource Resource name such as `accounts`.
 * @param {ZeyosSelectOptions} [opts={}] Query and Select options.
 * @returns {Record<string, any>} Plain Zx Select options.
 */
export function buildZeyosSelectConfig(client, resource, opts = {}) {
  const {
    fields,
    labelKey = inferLabelKey(client, resource),
    valueKey = 'ID',
    searchFields = inferSearchFields(client, resource),
    limit = 50,
    filters = {},
    value = null,
    ...selectOpts
  } = opts;
  const facade = connect(client);
  const projection = fields ?? defaultProjection(valueKey, labelKey, searchFields);

  return {
    ...selectOpts,
    valueKey,
    labelKey,
    value,
    filter: async (search) => {
      const result = await facade.list(resource, buildListQuery({
        search,
        filters,
        fields: projection,
        searchFields,
        limit
      }));
      return normalizeZeyosListResult(client, result).data;
    }
  };
}

/**
 * Creates an async Zx Select backed by the injected client's generated list operation. A non-null
 * initial id is hydrated through the resource get operation; await `select.ready` when code must
 * wait for that label before presenting the control.
 * @param {Record<string, any>} client Injected ZeyOS client instance.
 * @param {string} resource Resource name such as `accounts`.
 * @param {ZeyosSelectOptions} [opts={}] Query and Select options.
 * @returns {Select & {ready: Promise<Select>}} Configured Select with an initial-value readiness promise.
 */
export function zeyosSelect(client, resource, opts = {}) {
  const config = buildZeyosSelectConfig(client, resource, opts);
  const requestedValue = opts.value ?? null;
  const select = /** @type {Select & {ready: Promise<Select>}} */ (new Select(null, config));
  select.ready = hydrateInitialValue(select, client, resource, requestedValue);
  return select;
}

/**
 * Normalizes list output without importing the client package. If the injected client exposes its
 * own `normalizeListResult`, that implementation wins; otherwise arrays and `.data` are handled
 * locally and numeric string counts are accepted.
 * @param {Record<string, any>} client Injected ZeyOS client instance.
 * @param {unknown} result Generated list-operation result.
 * @returns {ZeyosListResult} Normalized rows and optional count.
 */
export function normalizeZeyosListResult(client, result) {
  if (typeof client?.normalizeListResult === 'function') {
    return normalizeLocalListResult(client.normalizeListResult(result));
  }
  return normalizeLocalListResult(result);
}

/** @param {unknown} result @returns {ZeyosListResult} */
function normalizeLocalListResult(result) {
  if (Array.isArray(result)) return { data: result };
  if (!result || typeof result !== 'object') return { data: [] };
  const data = Array.isArray(result.data) ? result.data : [];
  const count = result.count == null || result.count === '' ? null : Number(result.count);
  return Number.isFinite(count) ? { data, count } : { data };
}

/** @param {Select} select @param {Record<string, any>} client @param {string} resource @param {unknown} value @returns {Promise<Select>} */
async function hydrateInitialValue(select, client, resource, value) {
  if (value == null) return select;
  const record = value && typeof value === 'object'
    ? value
    : await connect(client).get(resource, value);
  const normalized = normalizeRecord(record);
  select.setItems([normalized]);
  select.set(normalized, { silent: true });
  return select;
}

/** @param {unknown} result @returns {Record<string, unknown>} */
function normalizeRecord(result) {
  if (result && typeof result === 'object' && !Array.isArray(result)) {
    const nested = result.data;
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) return nested;
    return result;
  }
  throw new TypeError('ZeyOS get operation did not return a record');
}

/** @param {unknown} valueKey @param {unknown} labelKey @param {string[]} searchFields @returns {string[]|undefined} */
function defaultProjection(valueKey, labelKey, searchFields) {
  const keys = [valueKey, labelKey, ...searchFields].filter((key) => typeof key === 'string' && key);
  return keys.length ? [...new Set(keys)] : undefined;
}

/** @param {Record<string, any>} client @param {string} resource @returns {string} */
function inferLabelKey(client, resource) {
  const names = schemaFieldNames(client, resource);
  for (const candidate of ['name', 'lastname', 'customernum', 'transactionnum', 'number', 'title', 'ID']) {
    if (names.includes(candidate)) return candidate;
  }
  return names[0] ?? 'ID';
}

/** @param {Record<string, any>} client @param {string} resource @returns {string[]} */
function inferSearchFields(client, resource) {
  const fields = client?.schema?.describe?.(resource)?.fields;
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) return [];
  return Object.entries(fields).flatMap(([id, meta]) => {
    if (!meta || typeof meta !== 'object') return [];
    const type = String(meta.type ?? '').toLowerCase();
    return meta.indexed && /text|character|varchar/.test(type) ? [id] : [];
  });
}

/** @param {Record<string, any>} client @param {string} resource @returns {string[]} */
function schemaFieldNames(client, resource) {
  const fields = client?.schema?.fields?.(resource);
  if (Array.isArray(fields)) return fields.map(String);
  if (fields && typeof fields === 'object') return Object.keys(fields);
  const described = client?.schema?.describe?.(resource)?.fields;
  return described && typeof described === 'object' ? Object.keys(described) : [];
}
