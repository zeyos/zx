import { Table } from '../index.js';
import { connect } from './connect.js';
import { buildListQuery } from './query.js';
import { fieldToZxColumn, resolveFields } from './schema.js';
import { normalizeZeyosListResult } from './select.js';

/**
 * @typedef {Object} ZeyosTableOptions
 * @property {string[]} [fields] Curated ordered field allow-list.
 * @property {Record<string, string>} [labels] Per-field label overrides.
 * @property {string|((row: Record<string, unknown>) => unknown)} [rowId='ID'] Row id accessor.
 * @property {number} [pageSize=50] Server page size.
 * @property {{id: string, dir: 'asc'|'desc'}|null} [sort=null] Initial server sort.
 * @property {Record<string, unknown>} [filters] Initial ZeyOS predicates.
 * @property {string} [search=''] Initial full-text query.
 * @property {false|'single'|'multi'} [selectable=false] Row selection mode.
 * @property {number|string|null} [height=null] Table scroll-region height.
 * @property {(row: Record<string, unknown>, event: CustomEvent<Record<string, unknown>>) => void} [onRowClick] Row activation callback.
 */

/**
 * @typedef {Object} ZeyosTableConfig
 * @property {Record<string, any>[]} fieldMeta Ordered normalized schema metadata.
 * @property {Record<string, any>[]} columns Generated Zx columns.
 * @property {Record<string, string>} projection API projection including row ids/entity labels.
 * @property {Record<string, any>} tableOptions Plain Zx Table options.
 */

/**
 * @typedef {Object} ZeyosTableLoadOptions
 * @property {string} [search] Replacement full-text query.
 * @property {Record<string, unknown>} [filters] Replacement ZeyOS predicates.
 * @property {number} [page=0] Zero-based page; pages above zero append rows.
 */

/**
 * @typedef {Object} ZeyosTableLoadResult
 * @property {Record<string, unknown>[]} data Loaded page rows.
 * @property {number|null} count Server count when supplied.
 * @property {number} page Loaded zero-based page.
 * @property {boolean} hasMore Whether another page is available.
 * @property {Record<string, unknown>} query Request passed to the list operation.
 */

/**
 * @typedef {Object} ZeyosTableBinding
 * @property {Table} table Generated Zx table.
 * @property {(options?: ZeyosTableLoadOptions) => Promise<ZeyosTableLoadResult>} load Loads/reloads a server page.
 * @property {(search: string) => Promise<ZeyosTableLoadResult>} setSearch Replaces search and reloads page zero.
 * @property {(filters: Record<string, unknown>) => Promise<ZeyosTableLoadResult>} setFilters Replaces predicates and reloads page zero.
 * @property {() => Promise<ZeyosTableLoadResult>} loadMore Appends the next page when available.
 * @property {number|null} count Current server count.
 * @property {number} page Current zero-based page.
 * @property {boolean} hasMore Whether another page is available.
 * @property {() => void} destroy Destroys the generated table.
 */

/**
 * Builds the DOM-free schema-derived columns and Table options used by {@link zeyosTable}. Entity
 * projections include an `<field>_label` alias from a real label field on the referenced resource.
 * Amount fields use each row's real `currency` value for display while retaining the WP14 typed
 * column strategy and right alignment.
 * @param {Record<string, any>} client Injected ZeyOS client instance.
 * @param {string} resource Resource name such as `transactions`.
 * @param {ZeyosTableOptions} [opts={}] Schema, table, and initial query options.
 * @returns {ZeyosTableConfig} Plain columns, projection, and Table options.
 */
export function buildZeyosTableConfig(client, resource, opts = {}) {
  const fieldMeta = resolveFields(client, resource, {
    fields: opts.fields,
    labels: opts.labels
  });
  const projection = {};
  const columns = fieldMeta.map((sourceMeta) => {
    const meta = { ...sourceMeta };
    const referencedResource = referencedResourceFor(meta);
    if (referencedResource) {
      const labelKey = inferLabelKey(client, referencedResource);
      meta.labelField = `${meta.id}_label`;
      projection[meta.labelField] = `${meta.id}.${labelKey}`;
    }
    projection[meta.id] = meta.id;

    const monetary = isMonetaryField(meta);
    const column = fieldToZxColumn(monetary ? { ...meta, format: 'money' } : meta);
    if (monetary) {
      column.render = (row) => formatCurrency(row?.[meta.id], row?.currency);
      if (schemaHasField(client, resource, 'currency')) projection.currency = 'currency';
    }
    return column;
  });

  const rowId = opts.rowId ?? 'ID';
  if (typeof rowId === 'string' && !Object.prototype.hasOwnProperty.call(projection, rowId)) {
    projection[rowId] = rowId;
  }
  return {
    fieldMeta,
    columns,
    projection,
    tableOptions: {
      columns,
      data: [],
      rowId,
      sort: opts.sort ?? null,
      sortMode: 'server',
      selectable: opts.selectable ?? false,
      height: opts.height ?? null,
      onrowclick: typeof opts.onRowClick === 'function'
        ? (event) => opts.onRowClick(event.detail.row, event)
        : undefined
    }
  };
}

/**
 * Generates a server-backed Zx Table. Sorting automatically reloads page zero. `load({page: 0})`
 * replaces data, higher pages append it, and `loadMore()` uses `limit`/`offset` plus the returned
 * count. DataFilter callers can map state with `dataFilterStateToFilters` before `setFilters()`.
 * @param {Record<string, any>} client Injected ZeyOS client instance.
 * @param {string} resource Resource name such as `transactions`.
 * @param {ZeyosTableOptions} [opts={}] Schema, table, and initial query options.
 * @returns {ZeyosTableBinding} Generated table and server-state methods/getters.
 */
export function zeyosTable(client, resource, opts = {}) {
  const config = buildZeyosTableConfig(client, resource, opts);
  const facade = connect(client);
  const table = new Table(null, config.tableOptions);
  const pageSize = normalizePageSize(opts.pageSize);
  let currentSort = opts.sort ?? null;
  let currentFilters = copyFilters(opts.filters ?? {});
  let currentSearch = String(opts.search ?? '');
  let currentPage = 0;
  let totalCount = null;
  let more = false;
  let requestSequence = 0;

  const load = async (options = {}) => {
    if (Object.prototype.hasOwnProperty.call(options, 'search')) currentSearch = String(options.search ?? '');
    if (Object.prototype.hasOwnProperty.call(options, 'filters')) currentFilters = copyFilters(options.filters ?? {});
    const page = normalizePage(options.page ?? 0);
    const query = buildListQuery({
      fields: config.projection,
      sort: currentSort,
      filters: currentFilters,
      search: currentSearch,
      limit: pageSize,
      offset: page * pageSize,
      count: true
    });
    const sequence = ++requestSequence;
    table.setLoading(true);
    try {
      const normalized = normalizeZeyosListResult(client, await facade.list(resource, query));
      const count = normalized.count ?? null;
      const hasMore = count == null
        ? normalized.data.length === pageSize
        : (page * pageSize + normalized.data.length) < count;
      if (sequence === requestSequence) {
        currentPage = page;
        totalCount = count;
        more = hasMore;
        if (page === 0) table.setData(normalized.data);
        else table.addData(normalized.data);
      }
      return { data: normalized.data, count, page, hasMore, query };
    } finally {
      if (sequence === requestSequence) table.setLoading(false);
    }
  };

  const binding = {
    table,
    load,
    setSearch: (search) => load({ search, page: 0 }),
    setFilters: (filters) => load({ filters, page: 0 }),
    loadMore: () => more ? load({ page: currentPage + 1 }) : Promise.resolve({
      data: [],
      count: totalCount,
      page: currentPage,
      hasMore: false,
      query: buildListQuery({
        fields: config.projection,
        sort: currentSort,
        filters: currentFilters,
        search: currentSearch,
        limit: pageSize,
        offset: currentPage * pageSize,
        count: true
      })
    }),
    get count() { return totalCount; },
    get page() { return currentPage; },
    get hasMore() { return more; },
    destroy: () => table.destroy()
  };

  table.on('sort', (event) => {
    const id = event.detail?.id;
    currentSort = id == null ? null
      : { id: String(id), dir: event.detail.dir === 'desc' ? 'desc' : 'asc' };
    void load({ page: 0 }).catch(() => { /* The connection facade already reported the failure. */ });
  });
  return binding;
}

/** @param {Record<string, any>} meta @returns {string|null} */
function referencedResourceFor(meta) {
  for (const value of [meta.entity, meta.fk, meta.relation, meta.reference, meta.references]) {
    if (typeof value === 'string' && value) return value;
    if (value && typeof value === 'object') {
      const resource = value.resource ?? value.target ?? value.table ?? value.entity;
      if (typeof resource === 'string' && resource) return resource;
    }
  }
  return null;
}

/** @param {Record<string, any>} client @param {string} resource @returns {string} */
function inferLabelKey(client, resource) {
  const fields = client?.schema?.fields?.(resource);
  const names = Array.isArray(fields) ? fields.map(String) : Object.keys(fields ?? {});
  for (const candidate of ['name', 'lastname', 'customernum', 'transactionnum', 'number', 'title', 'ID']) {
    if (names.includes(candidate)) return candidate;
  }
  return names[0] ?? 'ID';
}

/** @param {Record<string, any>} meta @returns {boolean} */
function isMonetaryField(meta) {
  const format = String(meta.format ?? '').toLowerCase();
  return /money|currency|price/.test(format) || /(?:amount|price)$/.test(String(meta.id).toLowerCase());
}

/** @param {unknown} value @param {unknown} currency @returns {string} */
function formatCurrency(value, currency) {
  if (value == null || value === '') return '';
  const number = Number(value);
  if (!Number.isFinite(number)) return '';
  const code = typeof currency === 'string' && /^[A-Z]{3}$/.test(currency) ? currency : null;
  try {
    return new Intl.NumberFormat(undefined, code ? { style: 'currency', currency: code } : {}).format(number);
  } catch {
    return new Intl.NumberFormat().format(number);
  }
}

/** @param {Record<string, any>} client @param {string} resource @param {string} id @returns {boolean} */
function schemaHasField(client, resource, id) {
  const fields = client?.schema?.fields?.(resource);
  if (Array.isArray(fields)) return fields.includes(id);
  return Boolean(fields && typeof fields === 'object' && Object.prototype.hasOwnProperty.call(fields, id));
}

/** @param {unknown} value @returns {number} */
function normalizePageSize(value) {
  const number = Number(value ?? 50);
  return Number.isInteger(number) && number > 0 ? number : 50;
}

/** @param {unknown} value @returns {number} */
function normalizePage(value) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) throw new RangeError('ZeyOS table page must be a non-negative integer');
  return number;
}

/** @param {Record<string, unknown>} filters @returns {Record<string, unknown>} */
function copyFilters(filters) {
  if (!filters || typeof filters !== 'object' || Array.isArray(filters)) {
    throw new TypeError('ZeyOS table filters must be an object');
  }
  return { ...filters };
}
