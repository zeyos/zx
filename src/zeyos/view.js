import { buildListQuery } from './query.js';
import { connect } from './connect.js';
import { normalizeZeyosListResult } from './select.js';
import { createSavedViewRegistry } from './saved-views.js';
import { buildZeyosTableConfig } from './table.js';

/** @typedef {import('../components/view/record-view.js').ViewField} ViewField */
/** @typedef {import('../components/view/record-view.js').ViewSort} ViewSort */
/** @typedef {import('./saved-views.js').SavedViewEntry} SavedViewEntry */
/** @typedef {import('./saved-views.js').SavedViewApplyResult} SavedViewApplyResult */

/**
 * @typedef {Object} ZeyosSavedViewsOptions
 * @property {Record<string,any>} [controller] Existing saved-view registry. It remains caller-owned.
 * @property {Record<string,any>} [registry] Alias for `controller`.
 * @property {Record<string,any>} [transport] Injected persistence transport used to construct a registry.
 * @property {{userId:string|number,workspaceId:string|number|null,resource?:string}} [scope]
 * Saved-view isolation scope; null workspace identifies ZeyOS's base workspace.
 * resource defaults to the bound ZeyOS resource.
 * @property {Record<string,unknown>} [options] Options passed to `createSavedViewRegistry`.
 * @property {'table'|'card'|'kanban'} [type] Presentation identity; normally derived from the View.
 */

/**
 * @typedef {Object} ZeyosViewOptions
 * @property {string[]} [fields] Curated ordered schema field allow-list.
 * @property {string[]} [exclude] Schema fields to omit.
 * @property {Record<string, string>} [labels] Per-field label overrides.
 * @property {Record<string, Partial<ViewField>>} [fieldOverrides] View descriptor overrides.
 * @property {string|((record:Record<string,unknown>)=>unknown)} [recordId='ID'] Record id accessor.
 * @property {number} [pageSize=50] Server page size.
 * @property {ViewSort|null} [sort=null] Initial server sort.
 * @property {Record<string, unknown>} [filters] Initial ZeyOS predicates.
 * @property {string} [search=''] Initial full-text query.
 * @property {string[]} [searchFields] Server full-text fields where supported.
 * @property {Record<string, unknown>} [viewOptions] Options passed to the concrete view.
 * @property {Element|string|null} [target=null] Concrete view target.
 * @property {string} [titleField] Card title field included in the projection.
 * @property {string} [subtitleField] Card subtitle field included in the projection.
 * @property {string|Function} [preview] Preview field or resolver.
 * @property {string|Function} [groupBy] Card grouping field or resolver.
 * @property {string|Function} [columnBy] Kanban column field or resolver.
 * @property {string|Function} [swimlaneBy] Kanban swim-lane field or resolver.
 * @property {false|Record<string,any>|ZeyosSavedViewsOptions|null} [savedViews] Existing registry or
 * injected transport/scope configuration for named saved views.
 * @property {(record:Record<string,unknown>,event:CustomEvent<Record<string,unknown>>)=>void} [onRecordClick]
 */

/**
 * @typedef {Object} ZeyosViewConfig
 * @property {Record<string, any>[]} fieldMeta Ordered normalized schema metadata.
 * @property {ViewField[]} fields Common view fields.
 * @property {Record<string, string>} projection Complete server projection.
 * @property {Record<string, any>} viewOptions Concrete view options.
 */

/**
 * @typedef {Object} ZeyosViewLoadOptions
 * @property {string} [search] Replacement full-text query.
 * @property {Record<string, unknown>} [filters] Replacement predicates.
 * @property {number} [page=0] Zero-based page; pages above zero append.
 */

/**
 * @typedef {Object} ZeyosViewLoadResult
 * @property {Record<string, unknown>[]} data Loaded records.
 * @property {number|null} count Server count when supplied.
 * @property {number} page Loaded page.
 * @property {boolean} hasMore Whether another page is available.
 * @property {Record<string, unknown>} query Request sent to the list operation.
 */

/**
 * @typedef {Object} ZeyosSavedViewCapture
 * @property {string} [id] Existing saved-view id.
 * @property {string} name Saved-view name.
 * @property {'table'|'card'|'kanban'} type Concrete presentation.
 * @property {Record<string,unknown>} state JSON-safe component view state.
 * @property {Record<string,unknown>} filters Current server filters.
 * @property {string} search Current full-text query.
 */

/**
 * @typedef {Object} ZeyosSaveViewOptions
 * @property {string} [id] Existing saved-view id to replace.
 * @property {string} name Saved-view name.
 * @property {'reject'|'replace'} [onDuplicate] Duplicate-name behavior.
 * @property {boolean} [setDefault=false] Make the saved entry the default.
 */

/**
 * @typedef {Object} ZeyosApplyViewOptions
 * @property {boolean} [load=true] Reload the first server page after an applied view.
 */

/**
 * @typedef {Object} ZeyosViewBinding
 * @property {Record<string, any>} view Generated RecordView-compatible instance.
 * @property {(options?:ZeyosViewLoadOptions)=>Promise<ZeyosViewLoadResult>} load Loads a page.
 * @property {(search:string)=>Promise<ZeyosViewLoadResult>} setSearch Replaces search and reloads.
 * @property {(filters:Record<string,unknown>)=>Promise<ZeyosViewLoadResult>} setFilters Replaces filters and reloads.
 * @property {()=>Promise<ZeyosViewLoadResult>} loadMore Loads the next page when available.
 * @property {number|null} count Current server count.
 * @property {number} page Current zero-based page.
 * @property {boolean} hasMore Whether another page is available.
 * @property {Record<string,any>|null} savedViews Saved-view registry when configured.
 * @property {Promise<SavedViewApplyResult|null>} ready Default restoration completed before loads.
 * @property {(options?:ZeyosApplyViewOptions)=>Promise<SavedViewApplyResult|null>} restoreDefault Restores the current default.
 * @property {(details:{id?:string,name:string})=>ZeyosSavedViewCapture} captureView Captures current query/view state without persistence.
 * @property {(details:ZeyosSaveViewOptions)=>Promise<SavedViewEntry>} saveView Captures and persists the current view.
 * @property {(idOrName:string,options?:ZeyosApplyViewOptions)=>Promise<SavedViewApplyResult>} applyView Applies a compatible named view.
 * @property {()=>void} destroy Destroys the generated view.
 */

/** View-specific top-level conveniences copied into the concrete component options. */
const VIEW_KEYS = [
  'titleField', 'subtitleField', 'preview', 'previewAlt', 'link', 'actions', 'groupBy', 'groupOrder',
  'columnBy', 'columns', 'swimlaneBy', 'swimlanes', 'moveMode', 'columnOrder', 'swimlaneOrder',
  'collapsedColumns', 'collapsedSwimlanes', 'showCounts', 'showEmptyColumns', 'hiddenFields',
  'fieldOrder', 'fieldControls', 'selectable', 'selection', 'emptyText'
];

/**
 * Produces common view fields and a complete ZeyOS projection without touching the DOM. It reuses
 * the established table schema conversion so entity labels, enums, amounts, currencies, and Unix
 * dates render identically in TableView, CardView, and KanbanView.
 * @param {Record<string, any>} client Injected ZeyOS client.
 * @param {string} resource Schema resource.
 * @param {ZeyosViewOptions} [opts={}] Schema and view options.
 * @returns {ZeyosViewConfig} DOM-free configuration.
 */
export function buildZeyosViewConfig(client, resource, opts = {}) {
  const requested = requestedViewFields(client, resource, opts);
  const table = buildZeyosTableConfig(client, resource, {
    fields: requested,
    labels: opts.labels,
    rowId: opts.recordId ?? 'ID',
    sort: opts.sort ?? null
  });
  const overrides = opts.fieldOverrides && typeof opts.fieldOverrides === 'object'
    ? opts.fieldOverrides : {};
  const explicitlyVisible = Array.isArray(opts.fields) ? new Set(opts.fields.map(String)) : null;
  const fields = table.columns.map((column) => ({
    ...column,
    ...(explicitlyVisible && !explicitlyVisible.has(column.id) ? { visible: false } : {}),
    ...(overrides[column.id] ?? {}),
    id: column.id
  }));
  const projection = { ...table.projection };

  // A view resolver may name a schema field outside the visible field allow-list. The server still
  // has to return it for grouping/media. Direct projections are safe even for compatible client
  // schemas whose field metadata omitted a virtual field.
  for (const id of supplementalFieldIds(opts)) {
    if (!Object.prototype.hasOwnProperty.call(projection, id)) projection[id] = id;
  }
  const viewOptions = { ...(opts.viewOptions ?? {}) };
  for (const key of VIEW_KEYS) {
    if (Object.prototype.hasOwnProperty.call(opts, key)) viewOptions[key] = opts[key];
  }
  Object.assign(viewOptions, {
    fields,
    data: [],
    recordId: opts.recordId ?? 'ID',
    sort: opts.sort ?? null,
    sortMode: 'server'
  });
  if (typeof opts.onRecordClick === 'function') {
    viewOptions.onrecordclick = (event) => opts.onRecordClick(event.detail.record, event);
  }
  return { fieldMeta: table.fieldMeta, fields, projection, viewOptions };
}

/**
 * Creates and binds any RecordView-compatible constructor to server paging. The caller supplies the
 * constructor, so this adapter has no dependency on one concrete presentation and remains simple
 * to unit test or wrap from a framework.
 * @param {Record<string, any>} client Injected ZeyOS client.
 * @param {string} resource Schema resource.
 * @param {new(target:Element|string|null,options:Record<string,unknown>)=>Record<string,any>} View Concrete view class.
 * @param {ZeyosViewOptions} [opts={}] Binding options.
 * @returns {ZeyosViewBinding} View and server-state methods.
 */
export function zeyosView(client, resource, View, opts = {}) {
  if (typeof View !== 'function') throw new TypeError('zeyosView() requires a view constructor');
  const config = buildZeyosViewConfig(client, resource, opts);
  const view = new View(opts.target ?? null, config.viewOptions);
  for (const method of ['setData', 'addData', 'setLoading', 'on', 'destroy']) {
    if (typeof view?.[method] !== 'function') {
      try { view?.destroy?.(); } catch { /* Preserve the contract error. */ }
      throw new TypeError(`zeyosView() constructor must provide ${method}()`);
    }
  }
  const facade = connect(client);
  const pageSize = normalizePageSize(opts.pageSize);
  let saved;
  try {
    saved = resolveSavedViews(opts.savedViews, View, resource);
  } catch (error) {
    view.destroy();
    throw error;
  }
  const savedViews = saved?.registry ?? null;
  const presentation = saved?.type ?? presentationType(View);
  if (savedViews) {
    for (const method of ['getViewState', 'setViewState']) {
      if (typeof view?.[method] !== 'function') {
        if (saved?.owned) savedViews.destroy?.();
        view.destroy();
        throw new TypeError(`zeyosView() saved views require ${method}()`);
      }
    }
  }
  let currentSort = opts.sort ?? null;
  let currentFilters = copyFilters(opts.filters ?? {});
  let currentSearch = String(opts.search ?? '');
  let currentPage = 0;
  let totalCount = null;
  let more = false;
  let requestSequence = 0;
  let destroyed = false;

  const performLoad = async (options = {}) => {
    if (destroyed) throw new Error('ZeyOS view binding has been destroyed');
    if (Object.prototype.hasOwnProperty.call(options, 'search')) currentSearch = String(options.search ?? '');
    if (Object.prototype.hasOwnProperty.call(options, 'filters')) currentFilters = copyFilters(options.filters ?? {});
    const page = normalizePage(options.page ?? 0);
    const query = buildListQuery({
      fields: config.projection,
      sort: currentSort,
      filters: currentFilters,
      search: currentSearch,
      searchFields: opts.searchFields,
      limit: pageSize,
      offset: page * pageSize,
      count: true
    });
    const sequence = ++requestSequence;
    view.setLoading(true);
    try {
      const normalized = normalizeZeyosListResult(client, await facade.list(resource, query));
      const count = normalized.count ?? null;
      const hasMore = count == null
        ? normalized.data.length === pageSize
        : page * pageSize + normalized.data.length < count;
      if (!destroyed && sequence === requestSequence) {
        currentPage = page;
        totalCount = count;
        more = hasMore;
        if (page === 0) view.setData(normalized.data);
        else view.addData(normalized.data);
      }
      return { data: normalized.data, count, page, hasMore, query };
    } finally {
      if (!destroyed && sequence === requestSequence) view.setLoading(false);
    }
  };

  /** @param {string} idOrName @param {{load?:boolean}} [options={}] @returns {Promise<SavedViewApplyResult>} */
  const applySaved = async (idOrName, options = {}) => {
    if (!savedViews || !presentation) throw new Error('This ZeyOS view binding has no saved-view registry');
    if (destroyed) throw new Error('ZeyOS view binding has been destroyed');
    const result = await savedViews.apply(idOrName, view, {
      type: presentation,
      onQuery: async ({ filters, search }) => {
        if (destroyed) return;
        currentFilters = copyFilters(filters ?? {});
        currentSearch = String(search ?? '');
      }
    });
    if (!result.applied || destroyed) return result;
    currentSort = appliedViewSort(view, result.entry);
    currentPage = 0;
    totalCount = null;
    more = false;
    if (options.load !== false) await performLoad({ page: 0 });
    return result;
  };

  /** @param {{load?:boolean}} [options={}] @returns {Promise<SavedViewApplyResult|null>} */
  const restoreDefaultInternal = async (options = {}) => {
    if (!savedViews) return null;
    await readySavedViews(savedViews);
    if (destroyed) throw new Error('ZeyOS view binding has been destroyed');
    const entry = await savedViews.getDefault();
    if (!entry) return /** @type {SavedViewApplyResult} */ ({
      status: 'missing', applied: false, entry: null
    });
    return applySaved(entry.id, options);
  };

  /** Default application starts immediately and every server load below awaits it. */
  const ready = savedViews ? restoreDefaultInternal({ load: false }) : Promise.resolve(null);
  let initialized = !savedViews;
  let retryingInitialization = null;
  // The promise remains rejectable to callers/load(), while this observer prevents an ignored
  // optional saved-view configuration from becoming a process-level unhandled rejection.
  void ready.then(() => { initialized = true; }, () => {});

  /**
   * Later operations retry a failed initial registry/default restoration instead of remaining
   * poisoned by the intentionally observable first `ready` rejection.
   * @param {{load?:boolean}} [options={load:false}] Retry apply behavior.
   * @returns {Promise<SavedViewApplyResult|null>}
   */
  const ensureInitialized = async (options = { load: false }) => {
    if (initialized) return null;
    try {
      const result = await ready;
      initialized = true;
      return result;
    } catch {
      // The first failure remains available through binding.ready; this operation gets a retry.
    }
    if (!retryingInitialization) {
      const retry = restoreDefaultInternal(options).then((result) => {
        initialized = true;
        return result;
      });
      const pending = retry.finally(() => {
        if (retryingInitialization === pending) retryingInitialization = null;
      });
      retryingInitialization = pending;
    }
    return retryingInitialization;
  };

  const load = async (options = {}) => {
    await ensureInitialized({ load: false });
    return performLoad(options);
  };

  const captureView = (details) => {
    if (!presentation || typeof view.getViewState !== 'function') {
      throw new Error('This view does not expose serializable saved-view state');
    }
    const source = details && typeof details === 'object' ? details : {};
    return {
      ...(source.id == null ? {} : { id: String(source.id) }),
      name: String(source.name ?? ''),
      type: presentation,
      state: view.getViewState(),
      filters: copyFilters(currentFilters),
      search: currentSearch
    };
  };

  const saveView = async (details) => {
    if (!savedViews || !presentation) throw new Error('This ZeyOS view binding has no saved-view registry');
    await ensureInitialized({ load: false });
    if (destroyed) throw new Error('ZeyOS view binding has been destroyed');
    const capture = captureView(details);
    const entry = await savedViews.capture(view, {
      ...(capture.id == null ? {} : { id: capture.id }),
      name: capture.name,
      type: presentation,
      filters: capture.filters,
      search: capture.search
    }, { onDuplicate: details?.onDuplicate, setDefault: Boolean(details?.setDefault) });
    return entry;
  };

  const applyView = async (idOrName, options = {}) => {
    await ensureInitialized({ load: false });
    return applySaved(idOrName, options);
  };

  const restoreDefault = async (options = {}) => {
    if (!initialized) return ensureInitialized(options);
    return restoreDefaultInternal(options);
  };

  const sortHandler = (event) => {
    const id = event.detail?.id;
    currentSort = id == null ? null : { id: String(id), dir: event.detail.dir === 'desc' ? 'desc' : 'asc' };
    void load({ page: 0 }).catch(() => { /* connect() already reported the API failure. */ });
  };

  const binding = {
    view,
    load,
    setSearch: (search) => load({ search, page: 0 }),
    setFilters: (filters) => load({ filters, page: 0 }),
    loadMore: async () => {
      await ensureInitialized({ load: false });
      return more ? performLoad({ page: currentPage + 1 }) : {
        data: [],
        count: totalCount,
        page: currentPage,
        hasMore: false,
        query: buildListQuery({
          fields: config.projection,
          sort: currentSort,
          filters: currentFilters,
          search: currentSearch,
          searchFields: opts.searchFields,
          limit: pageSize,
          offset: currentPage * pageSize,
          count: true
        })
      };
    },
    get count() { return totalCount; },
    get page() { return currentPage; },
    get hasMore() { return more; },
    savedViews,
    ready,
    restoreDefault,
    captureView,
    saveView,
    applyView,
    destroy: () => {
      if (destroyed) return;
      destroyed = true;
      requestSequence += 1;
      if (typeof view.off === 'function') view.off('sortchange', sortHandler);
      else view.removeEventListener?.('sortchange', sortHandler);
      if (saved?.owned) savedViews?.destroy?.();
      view.destroy();
    }
  };
  view.on('sortchange', sortHandler);
  return binding;
}

/** @param {Record<string,any>} client @param {string} resource @param {ZeyosViewOptions} opts @returns {string[]|undefined} */
function requestedViewFields(client, resource, opts) {
  if (!Array.isArray(opts.fields) && !Array.isArray(opts.exclude)) return undefined;
  const excluded = new Set(Array.isArray(opts.exclude) ? opts.exclude.map(String) : []);
  const listed = Array.isArray(opts.fields) ? opts.fields.map(String) : schemaFieldIds(client, resource);
  return [...new Set([...listed, ...supplementalFieldIds(opts)])]
    .filter((id) => !excluded.has(id));
}

/** @param {Record<string,any>} client @param {string} resource @returns {string[]} */
function schemaFieldIds(client, resource) {
  const collection = client?.schema?.fields?.(resource);
  if (Array.isArray(collection)) return collection.map((entry) => typeof entry === 'string'
    ? entry : String(entry?.id ?? entry?.name ?? entry?.field ?? '')).filter(Boolean);
  return collection && typeof collection === 'object' ? Object.keys(collection) : [];
}

/** @param {ZeyosViewOptions} opts @returns {string[]} */
function supplementalFieldIds(opts) {
  const ids = [];
  for (const key of ['titleField', 'subtitleField', 'preview', 'groupBy', 'columnBy', 'swimlaneBy']) {
    const value = opts[key];
    if (typeof value === 'string' && value.trim()) ids.push(value.trim());
  }
  return [...new Set(ids)];
}

/** @param {unknown} value @returns {number} */
function normalizePageSize(value) {
  const number = Number(value ?? 50);
  return Number.isFinite(number) ? Math.max(1, Math.floor(number)) : 50;
}

/** @param {unknown} value @returns {number} */
function normalizePage(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : 0;
}

/** @param {unknown} value @returns {Record<string, unknown>} */
function copyFilters(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? { ...value } : {};
}

/**
 * Resolves a supplied registry or constructs one from an injected transport and scope.
 * @param {ZeyosViewOptions['savedViews']} value Saved-view option.
 * @param {Function & {cssName?:string}} View Concrete view constructor.
 * @param {string} resource ZeyOS resource.
 * @returns {{registry:Record<string,any>,type:'table'|'card'|'kanban',owned:boolean}|null}
 */
function resolveSavedViews(value, View, resource) {
  if (value == null || value === false) return null;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('savedViews must be a registry or transport/scope configuration');
  }
  const source = /** @type {Record<string,any>} */ (value);
  const configured = source.controller ?? source.registry;
  const direct = isSavedViewRegistry(source) ? source : isSavedViewRegistry(configured) ? configured : null;
  const type = normalizePresentationType(source.type ?? presentationType(View));
  if (!type) throw new TypeError('savedViews requires a table, card, or kanban presentation type');
  if (direct) return { registry: direct, type, owned: false };
  if (!source.transport || !source.scope || typeof source.scope !== 'object') {
    throw new TypeError('savedViews requires a controller or injected transport and scope');
  }
  const scope = { ...source.scope, resource: source.scope.resource ?? resource };
  return {
    registry: createSavedViewRegistry(source.transport, scope, source.options ?? {}),
    type,
    owned: true
  };
}

/** @param {unknown} value @returns {boolean} */
function isSavedViewRegistry(value) {
  return Boolean(value && typeof value === 'object'
    && typeof /** @type {Record<string,any>} */ (value).apply === 'function'
    && typeof /** @type {Record<string,any>} */ (value).capture === 'function'
    && typeof /** @type {Record<string,any>} */ (value).getDefault === 'function');
}

/** @param {Function & {cssName?:string}} View @returns {'table'|'card'|'kanban'|null} */
function presentationType(View) {
  const cssName = String(View.cssName ?? '').toLowerCase().replace(/-view$/, '');
  if (['table', 'card', 'kanban'].includes(cssName)) {
    return /** @type {'table'|'card'|'kanban'} */ (cssName);
  }
  const name = String(View.name ?? '').toLowerCase().replace(/view$/, '');
  return ['table', 'card', 'kanban'].includes(name)
    ? /** @type {'table'|'card'|'kanban'} */ (name) : null;
}

/** @param {unknown} value @returns {'table'|'card'|'kanban'|null} */
function normalizePresentationType(value) {
  const type = String(value ?? '').toLowerCase();
  return ['table', 'card', 'kanban'].includes(type)
    ? /** @type {'table'|'card'|'kanban'} */ (type) : null;
}

/** @param {Record<string,any>} registry @returns {Promise<void>} */
async function readySavedViews(registry) {
  if (typeof registry.ready === 'function') await registry.ready();
  else if (typeof registry.load === 'function') await registry.load();
}

/**
 * Reads the sort after `setViewState()` so unknown saved fields rejected by RecordView do not leak
 * into the server query. The entry is only a fallback for compatible facade implementations.
 * @param {Record<string,any>} view Applied view.
 * @param {SavedViewEntry|null|undefined} entry Saved entry.
 * @returns {ViewSort|null}
 */
function appliedViewSort(view, entry) {
  const sort = typeof view.getSort === 'function' ? view.getSort()
    : typeof view.getViewState === 'function' ? view.getViewState()?.sort : entry?.state?.sort;
  if (!sort || typeof sort !== 'object' || Array.isArray(sort) || sort.id == null) return null;
  return { id: String(sort.id), dir: sort.dir === 'desc' ? 'desc' : 'asc' };
}
