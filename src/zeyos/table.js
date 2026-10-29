import { Table } from '../index.js';
import { connect } from './connect.js';
import { buildListQuery } from './query.js';
import { fieldToZxColumn, resolveFields } from './schema.js';
import { normalizeZeyosListResult } from './select.js';

/** @typedef {import('../components/table/table.js').TableOptions} TableOptions */

/**
 * @typedef {Object} ZeyosTableOptions
 * @property {string[]} [fields] Curated ordered field allow-list.
 * @property {Record<string, string>} [labels] Per-field label overrides.
 * @property {Record<string, string>} [formats] Per-field semantic format overrides, such as
 * `{ duedate: 'date' }` for a Unix-second field that holds a calendar day.
 * @property {string} [timeZone] IANA time zone of the ZeyOS instance. Date-only columns show the
 * calendar day their stored midnight names in this zone; defaults to the runtime's own zone.
 * @property {string|((row: Record<string, unknown>) => unknown)} [rowId='ID'] Row id accessor.
 * @property {number} [pageSize=50] Server page size, a positive integer. `load({pageSize})` changes
 * it later — what a `Pagination` page-size select does.
 * @property {{id: string, dir: 'asc'|'desc'}|null} [sort=null] Initial server sort.
 * @property {Record<string, unknown>} [filters] Initial ZeyOS predicates.
 * @property {string} [search=''] Initial full-text query.
 * @property {false|'single'|'multi'} [selectable=false] Row selection mode.
 * @property {number|string|null} [height=null] Table scroll-region height.
 * @property {(row: Record<string, unknown>, event: CustomEvent<Record<string, unknown>>) => void} [onRowClick] Row activation callback.
 * @property {TableOptions['variant']} [variant='default'] Table frame treatment; `'plain'` for a
 * table inside a pane or card that already draws the box.
 * @property {boolean} [zebra=true] Whether alternate rows use the zebra background.
 * @property {boolean} [stickyHeader=true] Whether column headers stick while scrolling.
 * @property {TableOptions['responsive']} [responsive=false] Width below which rows stack.
 * @property {TableOptions['growing']} [growing=false] Rows rendered at first from a loaded page.
 * @property {TableOptions['emptyText']} [emptyText=null] What the table shows with no rows.
 * @property {TableOptions['rowClass']} [rowClass=null] Additional row class callback.
 * @property {TableOptions['rowKind']} [rowKind=null] Row property or callback naming each row's kind.
 * @property {TableOptions['rowKinds']} [rowKinds=null] Presentation per row kind.
 * @property {boolean} [columnVisibility=false] Whether a column visibility chooser is rendered.
 * @property {boolean} [columnReorder=false] Whether the column chooser exposes reorder controls.
 * @property {string[]} [hiddenColumns=[]] Initially hidden column ids.
 * @property {TableOptions['onrowclick']} [onrowclick] Table `rowclick` listener, beside `onRowClick`.
 * @property {TableOptions['onrowdblclick']} [onrowdblclick] Table `rowdblclick` listener.
 * @property {TableOptions['onsort']} [onsort] Table `sort` listener; the binding reloads either way.
 * @property {TableOptions['onselectionchange']} [onselectionchange] Table `selectionchange` listener.
 * @property {TableOptions['ondatachange']} [ondatachange] Table `datachange` listener.
 * @property {TableOptions['onstackedchange']} [onstackedchange] Table `stackedchange` listener.
 * @property {TableOptions['ongrow']} [ongrow] Table `grow` listener.
 * @property {TableOptions['oncolumnvisibilitychange']} [oncolumnvisibilitychange] Table `columnvisibilitychange` listener.
 * @property {TableOptions['oncolumnorderchange']} [oncolumnorderchange] Table `columnorderchange` listener.
 */

/**
 * Table options a binding passes through unchanged: presentation and listeners. The binding owns
 * `columns`, `data`, and `sortMode`; editing, row reordering, and `hierarchy` are left out because
 * they rearrange or change rows the server pages and never persists.
 */
const TABLE_OPTION_KEYS = [
  'variant', 'zebra', 'stickyHeader', 'responsive', 'growing', 'emptyText', 'rowClass', 'rowKind',
  'rowKinds', 'columnVisibility', 'columnReorder', 'hiddenColumns', 'onrowdblclick', 'onsort',
  'onselectionchange', 'ondatachange', 'onstackedchange', 'ongrow', 'oncolumnvisibilitychange',
  'oncolumnorderchange'
];

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
 * @property {number} [page=0] Zero-based page, a non-negative integer. Pages above zero append
 * rows unless `replace` is set.
 * @property {boolean} [replace] Replace the rows with this page instead of appending it — what a
 * numbered pager needs. Page zero always replaces.
 * @property {number} [pageSize] New page size for this and every later load; the request offset is
 * `page * pageSize`.
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
 * @property {number} pageSize Current server page size.
 * @property {boolean} hasMore Whether another page is available.
 * @property {() => void} destroy Destroys the generated table. A request still in flight is
 * ignored when it resolves, and later loads reject.
 */

/**
 * The surface a server pager renders into: a Zx `Table`, or any RecordView.
 * @typedef {Object} ServerPagerTarget
 * @property {(rows: Record<string, unknown>[]) => unknown} setData Replaces the rows.
 * @property {(rows: Record<string, unknown>[]) => unknown} addData Appends rows.
 * @property {(loading: boolean) => unknown} setLoading Shows or hides the loading state.
 */

/**
 * @typedef {Object} ServerPagerOptions
 * @property {Record<string, any>} client Injected ZeyOS client (for result normalization).
 * @property {{list: (resource: string, query: Record<string, unknown>) => Promise<unknown>}} facade
 * Connection facade from `connect(client)`.
 * @property {string} resource Resource name.
 * @property {Record<string, string>} projection API projection.
 * @property {ServerPagerTarget} target Component the rows go to.
 * @property {unknown} [pageSize=50] Initial page size; must be a positive integer.
 * @property {{id: string, dir: 'asc'|'desc'}|null} [sort=null] Initial sort.
 * @property {unknown} [filters={}] Initial predicates; must be a plain object.
 * @property {unknown} [search=''] Initial full-text query.
 * @property {string[]} [searchFields] UI search-field metadata passed to `buildListQuery`.
 * @property {string} [label='ZeyOS binding'] Name used in error messages.
 */

/**
 * @typedef {Object} ServerPager
 * @property {(options?: ZeyosTableLoadOptions) => Promise<ZeyosTableLoadResult>} load Loads a page.
 * @property {(options?: ZeyosTableLoadOptions) => {page: number, pageSize: number, filters: Record<string, unknown>, search: string}} check
 * Validates load options without applying them; throws what `load()` would reject with.
 * @property {() => Promise<ZeyosTableLoadResult>} loadMore Appends the next page when available,
 * else resolves without a request.
 * @property {(sort: {id: string, dir: 'asc'|'desc'}|null) => void} setSort Replaces the sort used
 * by the next load.
 * @property {(state: {filters?: unknown, search?: unknown}) => void} setQuery Replaces filters and
 * search without loading.
 * @property {() => void} reset Forgets the loaded page, count, and `hasMore`.
 * @property {() => void} destroy Stops rendering: in-flight responses are ignored, later loads reject.
 * @property {boolean} destroyed Whether `destroy()` ran.
 * @property {number|null} count Current server count.
 * @property {number} page Current zero-based page.
 * @property {number} pageSize Current page size.
 * @property {boolean} hasMore Whether another page is available.
 * @property {{id: string, dir: 'asc'|'desc'}|null} sort Current sort.
 * @property {Record<string, unknown>} filters Copy of the current predicates.
 * @property {string} search Current full-text query.
 */

/**
 * Builds the DOM-free schema-derived columns and Table options used by {@link zeyosTable}. Entity
 * projections include an `<field>_label` alias from a real label field on the referenced resource.
 * Amount fields use each row's real `currency` value for display while retaining the WP14 typed
 * column strategy and right alignment. Enum columns show labels, date-only columns calendar days in
 * `timeZone`, and Table presentation options and listeners pass through to `tableOptions`.
 * @param {Record<string, any>} client Injected ZeyOS client instance.
 * @param {string} resource Resource name such as `transactions`.
 * @param {ZeyosTableOptions} [opts={}] Schema, table, and initial query options.
 * @returns {ZeyosTableConfig} Plain columns, projection, and Table options.
 */
export function buildZeyosTableConfig(client, resource, opts = {}) {
  const fieldMeta = resolveFields(client, resource, {
    fields: opts.fields,
    labels: opts.labels,
    formats: opts.formats,
    timeZone: opts.timeZone
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
  const passed = {};
  for (const key of TABLE_OPTION_KEYS) {
    if (opts[key] !== undefined) passed[key] = opts[key];
  }
  return {
    fieldMeta,
    columns,
    projection,
    tableOptions: {
      ...passed,
      columns,
      data: [],
      rowId,
      sort: opts.sort ?? null,
      sortMode: 'server',
      selectable: opts.selectable ?? false,
      height: opts.height ?? null,
      onrowclick: rowClickListener(opts)
    }
  };
}

/**
 * Generates a server-backed Zx Table. Sorting automatically reloads page zero. Paging is
 * zero-based: `load({page: 0})` replaces data, higher pages append it — load-more paging, which
 * `loadMore()` drives from `limit`/`offset` plus the returned count — and `replace: true` replaces
 * at any page, which is what a numbered `Pagination` needs. `Pagination` is one-based, so its
 * `change` maps as `load({page: detail.page - 1, pageSize: detail.pageSize, replace: true})`, the
 * request offset being `(page - 1) * pageSize`; feed `result.count` back with `setTotal()`.
 * DataFilter callers can map state with `dataFilterStateToFilters` before `setFilters()`.
 * Paging is shared with `zeyosView()` through {@link createServerPager}: the same validation, and
 * a response that resolves after `destroy()` never touches the destroyed table.
 * Table presentation options (`variant`, `zebra`, `stickyHeader`, `responsive`, `emptyText`, …) and
 * listeners are passed through to the generated Table.
 * @param {Record<string, any>} client Injected ZeyOS client instance.
 * @param {string} resource Resource name such as `transactions`.
 * @param {ZeyosTableOptions} [opts={}] Schema, table, and initial query options.
 * @returns {ZeyosTableBinding} Generated table and server-state methods/getters.
 */
export function zeyosTable(client, resource, opts = {}) {
  const config = buildZeyosTableConfig(client, resource, opts);
  const facade = connect(client);
  const table = new Table(null, config.tableOptions);
  let pager;
  try {
    pager = createServerPager({
      client, facade, resource, projection: config.projection, target: table,
      pageSize: opts.pageSize, sort: opts.sort ?? null, filters: opts.filters ?? {}, search: opts.search,
      label: 'ZeyOS table'
    });
  } catch (error) {
    table.destroy();
    throw error;
  }

  const binding = {
    table,
    load: pager.load,
    setSearch: (search) => pager.load({ search, page: 0 }),
    setFilters: (filters) => pager.load({ filters, page: 0 }),
    loadMore: pager.loadMore,
    get count() { return pager.count; },
    get page() { return pager.page; },
    get pageSize() { return pager.pageSize; },
    get hasMore() { return pager.hasMore; },
    destroy: () => {
      if (pager.destroyed) return;
      pager.destroy();
      table.destroy();
    }
  };

  table.on('sort', (event) => {
    if (pager.destroyed) return;
    const id = event.detail?.id;
    pager.setSort(id == null ? null : { id: String(id), dir: event.detail.dir === 'desc' ? 'desc' : 'asc' });
    void pager.load({ page: 0 }).catch(() => { /* The connection facade already reported the failure. */ });
  });
  return binding;
}

/**
 * The one server-paging loader behind {@link zeyosTable} and `zeyosView`, so the two bindings
 * cannot drift apart. It builds the list request (`limit = pageSize`, `offset = page * pageSize`,
 * always with `count`), renders the response into its target — page zero or `replace` replaces
 * the rows, a higher page appends them — and keeps `count`, `page`, and `hasMore`.
 *
 * Only the newest request may render: an older one that resolves late is returned to its caller
 * but never touches the target. After `destroy()` nothing renders at all — a response that arrives
 * afterwards is ignored, the loading state is left alone — and further loads reject.
 *
 * Validation is strict and the same for both bindings: a page must be a non-negative integer and a
 * page size a positive integer (`RangeError`), filters a plain object (`TypeError`). Every argument
 * of a call is checked before any of it is applied, so a rejected call changes nothing.
 * @param {ServerPagerOptions} options Pager configuration.
 * @returns {ServerPager}
 */
export function createServerPager(options) {
  const { client, facade, resource, projection, target, searchFields } = options;
  const label = String(options.label ?? 'ZeyOS binding');
  let pageSize = normalizePageSize(options.pageSize, label);
  let sort = options.sort ?? null;
  let filters = copyFilters(options.filters ?? {}, label);
  let search = String(options.search ?? '');
  let page = 0;
  let count = null;
  let more = false;
  let sequence = 0;
  let destroyed = false;

  const query = (forPage) => buildListQuery({
    fields: projection, sort, filters, search, searchFields,
    limit: pageSize, offset: forPage * pageSize, count: true
  });

  /**
   * Validates a load request without applying any of it.
   * @param {ZeyosTableLoadOptions} [request={}] Load options.
   * @returns {{page: number, pageSize: number, filters: Record<string, unknown>, search: string}}
   */
  const check = (request = {}) => {
    const source = request && typeof request === 'object' ? request : {};
    const has = (key) => Object.prototype.hasOwnProperty.call(source, key);
    return {
      page: normalizePage(source.page ?? 0, label),
      pageSize: has('pageSize') && source.pageSize !== undefined
        ? normalizePageSize(source.pageSize, label) : pageSize,
      filters: has('filters') ? copyFilters(source.filters ?? {}, label) : filters,
      search: has('search') ? String(source.search ?? '') : search
    };
  };

  /** @param {ZeyosTableLoadOptions} [request={}] @returns {Promise<ZeyosTableLoadResult>} */
  const load = async (request = {}) => {
    if (destroyed) throw new Error(`${label} binding has been destroyed`);
    // Every argument is validated before any state changes, so a call that rejects leaves the
    // binding exactly as it was: no page size or search half-applied ahead of a bad filter.
    const next = check(request);
    const nextPage = next.page;
    pageSize = next.pageSize;
    filters = next.filters;
    search = next.search;
    const replace = nextPage === 0 || request.replace === true;
    const sent = query(nextPage);
    const mine = ++sequence;
    target.setLoading(true);
    try {
      const normalized = normalizeZeyosListResult(client, await facade.list(resource, sent));
      const total = normalized.count ?? null;
      const hasMore = total == null
        ? normalized.data.length === pageSize
        : nextPage * pageSize + normalized.data.length < total;
      if (!destroyed && mine === sequence) {
        page = nextPage;
        count = total;
        more = hasMore;
        if (replace) target.setData(normalized.data);
        else target.addData(normalized.data);
      }
      return { data: normalized.data, count: total, page: nextPage, hasMore, query: sent };
    } finally {
      if (!destroyed && mine === sequence) target.setLoading(false);
    }
  };

  return {
    load,
    check,
    loadMore: () => more ? load({ page: page + 1 }) : (destroyed
      ? Promise.reject(new Error(`${label} binding has been destroyed`))
      : Promise.resolve({ data: [], count, page, hasMore: false, query: query(page) })),
    setSort: (next) => { sort = next ?? null; },
    setQuery: (state = {}) => {
      const nextFilters = Object.prototype.hasOwnProperty.call(state, 'filters')
        ? copyFilters(state.filters ?? {}, label) : filters;
      if (Object.prototype.hasOwnProperty.call(state, 'search')) search = String(state.search ?? '');
      filters = nextFilters;
    },
    reset: () => { page = 0; count = null; more = false; },
    destroy: () => {
      if (destroyed) return;
      destroyed = true;
      sequence += 1;
    },
    get destroyed() { return destroyed; },
    get count() { return count; },
    get page() { return page; },
    get pageSize() { return pageSize; },
    get hasMore() { return more; },
    get sort() { return sort; },
    get filters() { return { ...filters }; },
    get search() { return search; }
  };
}

/**
 * Combines the Table-style `onrowclick` listener with the binding's row-first `onRowClick`.
 * @param {ZeyosTableOptions} opts
 * @returns {((event: CustomEvent<Record<string, any>>) => void)|undefined}
 */
function rowClickListener(opts) {
  const listener = typeof opts.onrowclick === 'function' ? opts.onrowclick : null;
  const callback = typeof opts.onRowClick === 'function' ? opts.onRowClick : null;
  if (!listener && !callback) return undefined;
  return (event) => {
    listener?.(event);
    callback?.(event.detail.row, event);
  };
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

/** Default server page size shared by `zeyosTable()` and `zeyosView()`. */
export const DEFAULT_SERVER_PAGE_SIZE = 50;

/** @param {unknown} value @param {string} [label='ZeyOS table'] @returns {number} */
function normalizePageSize(value, label = 'ZeyOS table') {
  if (value === undefined || value === null) return DEFAULT_SERVER_PAGE_SIZE;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) throw new RangeError(`${label} page size must be a positive integer`);
  return number;
}

/** @param {unknown} value @param {string} [label='ZeyOS table'] @returns {number} */
function normalizePage(value, label = 'ZeyOS table') {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) throw new RangeError(`${label} page must be a non-negative integer`);
  return number;
}

/** @param {unknown} filters @param {string} [label='ZeyOS table'] @returns {Record<string, unknown>} */
function copyFilters(filters, label = 'ZeyOS table') {
  if (!filters || typeof filters !== 'object' || Array.isArray(filters)) {
    throw new TypeError(`${label} filters must be an object`);
  }
  return { .../** @type {Record<string, unknown>} */ (filters) };
}
