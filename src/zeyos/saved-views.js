// @ts-check

/** Current persisted saved-view document version. */
export const SAVED_VIEWS_VERSION = 1;

/** @typedef {'table'|'card'|'kanban'} SavedViewType */
/** @typedef {'reject'|'replace'} SavedViewDuplicatePolicy */

/**
 * @typedef {Object} SavedViewScope
 * @property {string} userId Authenticated user identifier.
 * @property {string|null} workspaceId Workspace/fork identifier; null identifies the base workspace.
 * @property {string} resource ZeyOS resource/view identifier.
 */

/**
 * @typedef {Object} SavedViewEntry
 * @property {string} id Stable saved-view identifier.
 * @property {string} name User-facing unique name.
 * @property {SavedViewType} type Presentation type.
 * @property {Record<string,unknown>} state Versioned RecordView configuration.
 * @property {Record<string,unknown>} filters JSON-safe query/filter configuration.
 * @property {string} search Full-text query.
 * @property {string} createdAt ISO-8601 creation timestamp.
 * @property {string} updatedAt ISO-8601 update timestamp.
 */

/**
 * @typedef {Object} SavedViewDocument
 * @property {1} version Persisted document schema version.
 * @property {SavedViewScope} scope Scope duplicated in the document to detect transport mix-ups.
 * @property {string|null} defaultId Default saved-view id.
 * @property {SavedViewEntry[]} views Deterministically ordered saved views.
 */

/**
 * @typedef {Object} SavedViewTransport
 * @property {(scope:SavedViewScope)=>unknown|Promise<unknown>} load Loads the one document for scope.
 * @property {(scope:SavedViewScope,document:SavedViewDocument)=>unknown|Promise<unknown>} save
 * Atomically replaces the one document for scope.
 * @property {(scope:SavedViewScope)=>unknown|Promise<unknown>} [remove] Removes the scope document.
 */

/**
 * @typedef {Object} SavedViewRegistryOptions
 * @property {SavedViewDuplicatePolicy} [duplicateNames='reject'] Duplicate-name policy.
 * @property {()=>string|Date|number} [clock] Timestamp source; defaults to the current time.
 * @property {(context:{scope:SavedViewScope,name:string,type:SavedViewType,createdAt:string})=>string} [idFactory]
 * Stable-id factory. A deterministic dependency-free id is used when omitted.
 * @property {Record<number,(document:Record<string,unknown>)=>Record<string,unknown>>} [migrations]
 * Optional migrations keyed by their source version. Version 0 has a built-in migration.
 */

/**
 * @typedef {Object} SavedViewInput
 * @property {string} [id] Stable id for an update or import.
 * @property {string} name Unique display name.
 * @property {SavedViewType} [type] Presentation type; required for a new view.
 * @property {Record<string,unknown>} [state] RecordView state; required for a new view.
 * @property {Record<string,unknown>} [filters] Query/filter state.
 * @property {string} [search=''] Full-text query.
 */

/**
 * @typedef {Object} SavedViewApplyResult
 * @property {'applied'|'missing'|'type-mismatch'} status Result status.
 * @property {boolean} applied Whether state was applied.
 * @property {SavedViewEntry|null} entry Resolved saved entry.
 * @property {SavedViewType} [expectedType] Saved presentation required by the entry on a mismatch.
 * @property {SavedViewType} [currentType] Current/requested renderer presentation on a mismatch.
 */

const TYPES = new Set(['table', 'card', 'kanban']);
const EPOCH = '1970-01-01T00:00:00.000Z';
const FORBIDDEN_JSON_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const FORBIDDEN_STATE_KEYS = new Set([
  'cursor', 'data', 'offset', 'page', 'pagination', 'records', 'rows', 'selection', 'selectedRecords'
]);

/** Duplicate saved-view name. */
export class SavedViewDuplicateNameError extends Error {
  /** @param {string} name Duplicate display name. */
  constructor(name) {
    super(`A saved view named "${name}" already exists`);
    this.name = 'SavedViewDuplicateNameError';
  }
}

/** A transport returned a document belonging to another scope. */
export class SavedViewScopeMismatchError extends Error {
  /** @param {SavedViewScope} expected Expected scope. @param {SavedViewScope} actual Stored scope. */
  constructor(expected, actual) {
    super(`Saved-view scope mismatch: expected ${scopeKey(expected)}, received ${scopeKey(actual)}`);
    this.name = 'SavedViewScopeMismatchError';
    this.expected = { ...expected };
    this.actual = { ...actual };
  }
}

/**
 * Dependency-free named saved-view registry with an injected, scope-atomic transport.
 */
export class SavedViewRegistry {
  /**
   * @param {SavedViewTransport} transport Persistence adapter.
   * @param {SavedViewScope} scope User/workspace/resource scope.
   * @param {SavedViewRegistryOptions} [options={}] Registry policy and deterministic test hooks.
   */
  constructor(transport, scope, options = {}) {
    if (!transport || typeof transport.load !== 'function' || typeof transport.save !== 'function') {
      throw new TypeError('SavedViewRegistry transport requires load() and save()');
    }
    this.transport = transport;
    this.scope = normalizeSavedViewScope(scope);
    this.options = normalizeRegistryOptions(options);
    this._document = emptySavedViewDocument(this.scope);
    this._loaded = false;
    this._loading = null;
    this._loadSequence = 0;
    this._mutation = Promise.resolve();
    this._destroyed = false;
  }

  /** Loads the scope once and returns this registry. @returns {Promise<this>} */
  async ready() {
    return this.load();
  }

  /**
   * Loads and normalizes the persisted document. Repeated calls use the in-memory snapshot unless
   * `force` is true.
   * @param {{force?:boolean}} [options={}] Load behavior.
   * @returns {Promise<this>}
   */
  async load(options = {}) {
    this._assertActive();
    if (this._loaded && !options.force) return this;
    if (this._loading && !options.force) {
      await this._loading;
      return this;
    }
    const sequence = ++this._loadSequence;
    const load = Promise.resolve(this.transport.load({ ...this.scope })).then((value) => {
      this._assertActive();
      if (sequence !== this._loadSequence) return;
      const document = normalizeSavedViewDocument(value, this.scope, this.options);
      this._document = document;
      this._loaded = true;
    });
    this._loading = load;
    try {
      await load;
    } finally {
      if (this._loading === load) this._loading = null;
    }
    return this;
  }

  /** Returns all entries in deterministic name/id order. @returns {Promise<SavedViewEntry[]>} */
  async list() {
    await this.ready();
    return this._document.views.map(cloneSavedViewEntry);
  }

  /** Resolves an entry by exact id or normalized name. @param {string} idOrName @returns {Promise<SavedViewEntry|null>} */
  async get(idOrName) {
    await this.ready();
    const entry = resolveEntry(this._document, idOrName);
    return entry ? cloneSavedViewEntry(entry) : null;
  }

  /** Returns the default entry, or null. @returns {Promise<SavedViewEntry|null>} */
  async getDefault() {
    await this.ready();
    const entry = this._document.views.find((view) => view.id === this._document.defaultId) ?? null;
    return entry ? cloneSavedViewEntry(entry) : null;
  }

  /**
   * Creates or updates one named entry and persists the whole scope in one transport write.
   * @param {SavedViewInput} input Saved-view values.
   * @param {{onDuplicate?:SavedViewDuplicatePolicy,setDefault?:boolean}} [options={}] Write policy.
   * @returns {Promise<SavedViewEntry>} Saved entry.
   */
  async save(input, options = {}) {
    return this._mutate(async (document) => {
      const name = normalizeName(input?.name);
      const policy = normalizeDuplicatePolicy(options.onDuplicate ?? this.options.duplicateNames);
      const requestedId = input?.id == null ? null : normalizeId(input.id);
      const byId = requestedId ? document.views.find((entry) => entry.id === requestedId) ?? null : null;
      const byName = document.views.find((entry) => nameKey(entry.name) === nameKey(name)) ?? null;
      if (byId && byName && byId !== byName && policy === 'reject') {
        throw new SavedViewDuplicateNameError(name);
      }
      if (!byId && byName && policy === 'reject') throw new SavedViewDuplicateNameError(name);
      const existing = byId ?? (policy === 'replace' ? byName : null);
      const replaced = policy === 'replace' && byId && byName !== byId ? byName : null;
      const now = this._now();
      const type = normalizeType(input?.type ?? existing?.type);
      const state = Object.prototype.hasOwnProperty.call(input ?? {}, 'state')
        ? normalizeRecordViewState(input.state) : existing ? cloneJsonObject(existing.state, 'Saved view state') : null;
      if (!state) throw new TypeError('A new saved view requires state');
      const filters = Object.prototype.hasOwnProperty.call(input ?? {}, 'filters')
        ? normalizeFilters(input.filters) : existing ? cloneJsonObject(existing.filters, 'Saved view filters') : {};
      const search = Object.prototype.hasOwnProperty.call(input ?? {}, 'search')
        ? normalizeSearch(input.search) : existing?.search ?? '';
      const createdAt = existing?.createdAt ?? now;
      const id = existing?.id ?? requestedId ?? this._createId(document, { name, type, createdAt });
      const entry = { id, name, type, state, filters, search, createdAt, updatedAt: now };
      const views = document.views.filter((candidate) => candidate !== existing
        && candidate !== replaced && candidate.id !== id);
      views.push(entry);
      document.views = sortEntries(views);
      if (replaced && document.defaultId === replaced.id) document.defaultId = id;
      if (options.setDefault) document.defaultId = id;
      return { changed: true, result: entry };
    });
  }

  /**
   * Renames an entry without changing its stable id or creation time.
   * @param {string} idOrName Entry id or name.
   * @param {string} name New display name.
   * @param {{onDuplicate?:SavedViewDuplicatePolicy}} [options={}] Duplicate policy.
   * @returns {Promise<SavedViewEntry|null>} Updated entry, or null when absent.
   */
  async rename(idOrName, name, options = {}) {
    return this._mutate(async (document) => {
      const entry = resolveEntry(document, idOrName);
      if (!entry) return { changed: false, result: null };
      const nextName = normalizeName(name);
      if (entry.name === nextName) return { changed: false, result: entry };
      const duplicate = document.views.find((candidate) => candidate !== entry
        && nameKey(candidate.name) === nameKey(nextName)) ?? null;
      const policy = normalizeDuplicatePolicy(options.onDuplicate ?? this.options.duplicateNames);
      if (duplicate && policy === 'reject') throw new SavedViewDuplicateNameError(nextName);
      if (duplicate) {
        document.views = document.views.filter((candidate) => candidate !== duplicate);
        if (document.defaultId === duplicate.id) document.defaultId = entry.id;
      }
      entry.name = nextName;
      entry.updatedAt = this._now();
      document.views = sortEntries(document.views);
      return { changed: true, result: entry };
    });
  }

  /**
   * Removes one named entry. The optional transport `remove(scope)` is used when the document
   * becomes empty; otherwise the empty document is saved normally.
   * @param {string} idOrName Entry id or name.
   * @returns {Promise<boolean>} Whether an entry was removed.
   */
  async remove(idOrName) {
    return this._mutate(async (document) => {
      const entry = resolveEntry(document, idOrName);
      if (!entry) return { changed: false, result: false };
      document.views = document.views.filter((candidate) => candidate !== entry);
      if (document.defaultId === entry.id) document.defaultId = null;
      return { changed: true, removeDocument: document.views.length === 0, result: true };
    });
  }

  /**
   * Sets or clears the default view.
   * @param {string|null} idOrName Entry id/name or null.
   * @returns {Promise<SavedViewEntry|null>} New default, or null when cleared/absent.
   */
  async setDefault(idOrName) {
    return this._mutate(async (document) => {
      if (idOrName == null) {
        if (document.defaultId === null) return { changed: false, result: null };
        document.defaultId = null;
        return { changed: true, result: null };
      }
      const entry = resolveEntry(document, idOrName);
      if (!entry) return { changed: false, result: null };
      if (document.defaultId === entry.id) return { changed: false, result: entry };
      document.defaultId = entry.id;
      return { changed: true, result: entry };
    });
  }

  /**
   * Captures `view.getViewState()`, persists it through `save()`, and returns the saved entry.
   * Records and selection are never read from the view.
   * @param {{getViewState:()=>Record<string,unknown>}} view RecordView-compatible instance.
   * @param {Omit<SavedViewInput,'state'>} input Entry metadata/query state.
   * @param {{onDuplicate?:SavedViewDuplicatePolicy,setDefault?:boolean}} [options={}] Write policy.
   * @returns {Promise<SavedViewEntry>} Captured entry.
   */
  async capture(view, input, options = {}) {
    if (!view || typeof view.getViewState !== 'function') {
      throw new TypeError('capture() requires a view with getViewState()');
    }
    return this.save({ ...input, state: view.getViewState() }, options);
  }

  /**
   * Applies one entry to a RecordView-compatible target. An expected type mismatch is reported
   * without touching the target. Query state is handed to one optional combined callback so a
   * server-backed binding can perform one reload rather than separate filter/search reloads.
   * @param {string} idOrName Entry id or name.
   * @param {{setViewState:(state:Record<string,unknown>)=>unknown}} view RecordView target.
   * @param {{type?:SavedViewType,onQuery?:(query:{filters:Record<string,unknown>,search:string,entry:SavedViewEntry})=>unknown|Promise<unknown>}} [options={}] Apply behavior.
   * @returns {Promise<SavedViewApplyResult>} Explicit apply result.
   */
  async apply(idOrName, view, options = {}) {
    const entry = await this.get(idOrName);
    if (!entry) return { status: 'missing', applied: false, entry: null };
    if (options.type != null) {
      const currentType = normalizeType(options.type);
      if (entry.type !== currentType) {
        return {
          status: 'type-mismatch', applied: false, entry,
          expectedType: entry.type, currentType
        };
      }
    }
    if (!view || typeof view.setViewState !== 'function') {
      throw new TypeError('apply() requires a view with setViewState()');
    }
    if (options.onQuery != null && typeof options.onQuery !== 'function') {
      throw new TypeError('apply() onQuery must be a function');
    }
    view.setViewState(cloneJsonObject(entry.state, 'Saved view state'));
    if (options.onQuery) {
      await options.onQuery({
        filters: cloneJsonObject(entry.filters, 'Saved view filters'),
        search: entry.search,
        entry: cloneSavedViewEntry(entry)
      });
    }
    return { status: 'applied', applied: true, entry };
  }

  /** Prevents later operations; it never removes persisted user data. @returns {void} */
  destroy() {
    this._destroyed = true;
    this._loadSequence += 1;
    this._loading = null;
  }

  /** @private @returns {void} */
  _assertActive() {
    if (this._destroyed) throw new Error('SavedViewRegistry has been destroyed');
  }

  /** @private @returns {string} */
  _now() {
    const source = this.options.clock();
    const date = source instanceof Date ? source : new Date(source);
    if (!Number.isFinite(date.getTime())) throw new TypeError('Saved-view clock returned an invalid timestamp');
    return date.toISOString();
  }

  /**
   * @private
   * @param {SavedViewDocument} document
   * @param {{name:string,type:SavedViewType,createdAt:string}} values
   * @returns {string}
   */
  _createId(document, values) {
    const proposed = this.options.idFactory
      ? this.options.idFactory({ scope: { ...this.scope }, ...values })
      : `view-${hashString(`${scopeKey(this.scope)}\u0000${values.name}\u0000${values.type}\u0000${values.createdAt}`)}`;
    const base = normalizeId(proposed);
    const ids = new Set(document.views.map((entry) => entry.id));
    if (!ids.has(base)) return base;
    let suffix = 2;
    while (ids.has(`${base}-${suffix}`)) suffix += 1;
    return `${base}-${suffix}`;
  }

  /**
   * Serializes mutations inside one registry so concurrent calls cannot overwrite each other.
   * @private
   * @template T
   * @param {(document:SavedViewDocument)=>Promise<{changed:boolean,result:T,removeDocument?:boolean}>} mutate
   * @returns {Promise<T>}
   */
  _mutate(mutate) {
    this._assertActive();
    const run = this._mutation.catch(() => {}).then(async () => {
      await this.ready();
      const next = cloneSavedViewDocument(this._document);
      const mutation = await mutate(next);
      this._assertActive();
      if (!mutation.changed) return cloneResult(mutation.result);
      const normalized = normalizeSavedViewDocument(next, this.scope, this.options);
      // A write is authoritative over any transport read that was already in flight.
      this._loadSequence += 1;
      if (mutation.removeDocument && typeof this.transport.remove === 'function') {
        await this.transport.remove({ ...this.scope });
        this._assertActive();
        this._loadSequence += 1;
        this._document = emptySavedViewDocument(this.scope);
      } else {
        await this.transport.save({ ...this.scope }, cloneSavedViewDocument(normalized));
        this._assertActive();
        this._loadSequence += 1;
        this._document = normalized;
      }
      return cloneResult(mutation.result);
    });
    this._mutation = run.then(() => undefined, () => undefined);
    return run;
  }
}

/**
 * Factory useful to adapters that do not need to subclass the registry.
 * @param {SavedViewTransport} transport Persistence adapter.
 * @param {SavedViewScope} scope Scope.
 * @param {SavedViewRegistryOptions} [options={}] Options.
 * @returns {SavedViewRegistry}
 */
export function createSavedViewRegistry(transport, scope, options = {}) {
  return new SavedViewRegistry(transport, scope, options);
}

/**
 * Validates and canonicalizes a transport scope. String/number identifiers are intentionally
 * accepted so a ZeyOS fork id can bridge directly to `workspaceId`; null is the base fork.
 * @param {SavedViewScope|Record<string,unknown>} scope Scope.
 * @returns {SavedViewScope} Normalized scope.
 */
export function normalizeSavedViewScope(scope) {
  if (!scope || typeof scope !== 'object' || Array.isArray(scope)) {
    throw new TypeError('Saved-view scope must be an object');
  }
  return {
    userId: requiredScopePart(scope.userId, 'userId'),
    workspaceId: nullableWorkspacePart(scope.workspaceId),
    resource: requiredScopePart(scope.resource, 'resource')
  };
}

/**
 * Migrates and normalizes a persisted document without touching transport state.
 * @param {unknown} value Persisted value, null, or a legacy version-0 value.
 * @param {SavedViewScope} scope Expected scope.
 * @param {SavedViewRegistryOptions} [options={}] Migration hooks.
 * @returns {SavedViewDocument} Current normalized document.
 */
export function normalizeSavedViewDocument(value, scope, options = {}) {
  const normalizedScope = normalizeSavedViewScope(scope);
  if (value == null) return emptySavedViewDocument(normalizedScope);
  const migrated = migrateSavedViewDocument(value, options.migrations);
  if (migrated.scope != null) {
    const actualScope = normalizeSavedViewScope(/** @type {Record<string,unknown>} */ (migrated.scope));
    if (scopeKey(actualScope) !== scopeKey(normalizedScope)) {
      throw new SavedViewScopeMismatchError(normalizedScope, actualScope);
    }
  }
  const rawViews = Array.isArray(migrated.views) ? migrated.views : [];
  /** @type {SavedViewEntry[]} */
  const candidates = rawViews.map((entry, index) => normalizePersistedEntry(entry, index, normalizedScope));
  const deduplicated = deduplicateEntries(candidates);
  const aliases = deduplicated.aliases;
  const views = sortEntries(deduplicated.views);
  const requestedDefault = migrated.defaultId == null ? null : String(migrated.defaultId);
  const defaultId = views.some((entry) => entry.id === requestedDefault)
    ? requestedDefault : aliases.get(requestedDefault) ?? null;
  return {
    version: SAVED_VIEWS_VERSION,
    scope: normalizedScope,
    defaultId: views.some((entry) => entry.id === defaultId) ? defaultId : null,
    views
  };
}

/**
 * Migrates old documents to the current structural version. Version 0 accepts an array or an
 * object using `savedViews`/`entries`, `presentation`, `viewState`, `filter`, and `defaultView`.
 * @param {unknown} value Persisted value.
 * @param {Record<number,(document:Record<string,unknown>)=>Record<string,unknown>>} [migrations={}]
 * Additional migrations keyed by source version.
 * @returns {Record<string,unknown>} Migrated current-version document.
 */
export function migrateSavedViewDocument(value, migrations = {}) {
  let document = Array.isArray(value) ? { version: 0, savedViews: value }
    : cloneJsonObject(value, 'Saved-view document');
  let version = normalizeDocumentVersion(document.version);
  if (version > SAVED_VIEWS_VERSION) {
    throw new RangeError(`Unsupported saved-view document version: ${version}`);
  }
  while (version < SAVED_VIEWS_VERSION) {
    const migrate = migrations?.[version] ?? (version === 0 ? migrateVersionZero : null);
    if (typeof migrate !== 'function') {
      throw new RangeError(`Missing saved-view migration from version ${version}`);
    }
    document = cloneJsonObject(migrate(cloneJsonObject(document, 'Saved-view document')),
      `Saved-view migration ${version}`);
    const nextVersion = normalizeDocumentVersion(document.version);
    if (nextVersion <= version) {
      throw new RangeError(`Saved-view migration ${version} did not advance the version`);
    }
    version = nextVersion;
  }
  return document;
}

/** @param {Record<string,unknown>} document @returns {Record<string,unknown>} */
function migrateVersionZero(document) {
  const source = Array.isArray(document.savedViews) ? document.savedViews
    : Array.isArray(document.entries) ? document.entries
      : Array.isArray(document.views) ? document.views : [];
  const views = source.map((value) => {
    const entry = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    return {
      id: entry.id ?? null,
      name: entry.name ?? entry.label ?? '',
      type: entry.type ?? entry.presentation ?? entry.view ?? '',
      state: entry.state ?? entry.viewState ?? {},
      filters: entry.filters ?? entry.filter ?? {},
      search: entry.search ?? entry.query ?? '',
      createdAt: entry.createdAt ?? entry.created ?? null,
      updatedAt: entry.updatedAt ?? entry.updated ?? null
    };
  });
  return {
    version: 1,
    scope: document.scope ?? null,
    defaultId: document.defaultId ?? document.defaultView ?? document.default ?? null,
    views
  };
}

/** @param {unknown} value @param {number} index @param {SavedViewScope} scope @returns {SavedViewEntry} */
function normalizePersistedEntry(value, index, scope) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`Saved view at index ${index} must be an object`);
  }
  const entry = /** @type {Record<string,unknown>} */ (value);
  const name = normalizeName(entry.name);
  const type = normalizeType(entry.type);
  const state = normalizeRecordViewState(entry.state ?? {});
  const filters = normalizeFilters(entry.filters ?? {});
  const search = normalizeSearch(entry.search);
  const createdAt = normalizeTimestamp(entry.createdAt);
  const requestedUpdated = normalizeTimestamp(entry.updatedAt ?? createdAt);
  const updatedAt = requestedUpdated < createdAt ? createdAt : requestedUpdated;
  const id = entry.id == null || String(entry.id).trim() === ''
    ? `legacy-${hashString(`${scopeKey(scope)}\u0000${name}\u0000${type}\u0000${index}`)}`
    : normalizeId(entry.id);
  return { id, name, type, state, filters, search, createdAt, updatedAt };
}

/**
 * Resolves duplicate/corrupt persisted entries deterministically: newest update wins, then the
 * lexicographically smaller stable id. Losing default ids are aliased to the retained entry.
 * @param {SavedViewEntry[]} entries
 * @returns {{views:SavedViewEntry[],aliases:Map<string,string>}}
 */
function deduplicateEntries(entries) {
  const ranked = [...entries].sort((left, right) => compareText(right.updatedAt, left.updatedAt)
    || compareText(left.id, right.id));
  const ids = new Set();
  const names = new Set();
  const aliases = new Map();
  const views = [];
  for (const entry of ranked) {
    const duplicate = views.find((candidate) => candidate.id === entry.id
      || nameKey(candidate.name) === nameKey(entry.name));
    if (ids.has(entry.id) || names.has(nameKey(entry.name))) {
      if (duplicate) aliases.set(entry.id, duplicate.id);
      continue;
    }
    ids.add(entry.id);
    names.add(nameKey(entry.name));
    views.push(entry);
  }
  return { views, aliases };
}

/** @param {SavedViewRegistryOptions} options @returns {Required<Pick<SavedViewRegistryOptions,'duplicateNames'|'clock'>> & SavedViewRegistryOptions} */
function normalizeRegistryOptions(options) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    throw new TypeError('Saved-view registry options must be an object');
  }
  if (options.clock != null && typeof options.clock !== 'function') {
    throw new TypeError('Saved-view clock must be a function');
  }
  if (options.idFactory != null && typeof options.idFactory !== 'function') {
    throw new TypeError('Saved-view idFactory must be a function');
  }
  return {
    ...options,
    duplicateNames: normalizeDuplicatePolicy(options.duplicateNames ?? 'reject'),
    clock: options.clock ?? (() => new Date())
  };
}

/** @param {SavedViewScope} scope @returns {SavedViewDocument} */
function emptySavedViewDocument(scope) {
  return { version: SAVED_VIEWS_VERSION, scope: { ...scope }, defaultId: null, views: [] };
}

/** @param {SavedViewDocument} document @returns {SavedViewDocument} */
function cloneSavedViewDocument(document) {
  return {
    version: SAVED_VIEWS_VERSION,
    scope: { ...document.scope },
    defaultId: document.defaultId,
    views: document.views.map(cloneSavedViewEntry)
  };
}

/** @param {SavedViewEntry} entry @returns {SavedViewEntry} */
function cloneSavedViewEntry(entry) {
  return {
    ...entry,
    state: cloneJsonObject(entry.state, 'Saved view state'),
    filters: cloneJsonObject(entry.filters, 'Saved view filters')
  };
}

/** @template T @param {T} value @returns {T} */
function cloneResult(value) {
  if (isSavedViewEntryLike(value)) {
    return /** @type {T} */ (cloneSavedViewEntry(/** @type {SavedViewEntry} */ (value)));
  }
  return value;
}

/** @param {SavedViewDocument} document @param {string} idOrName @returns {SavedViewEntry|null} */
function resolveEntry(document, idOrName) {
  if (typeof idOrName !== 'string') return null;
  const value = idOrName.trim();
  if (!value) return null;
  return document.views.find((entry) => entry.id === value)
    ?? document.views.find((entry) => nameKey(entry.name) === nameKey(value)) ?? null;
}

/** @param {SavedViewEntry[]} entries @returns {SavedViewEntry[]} */
function sortEntries(entries) {
  return [...entries].sort((left, right) => compareText(nameKey(left.name), nameKey(right.name))
    || compareText(left.name, right.name) || compareText(left.id, right.id));
}

/** @param {unknown} value @returns {SavedViewType} */
function normalizeType(value) {
  if (typeof value !== 'string') {
    throw new TypeError('Saved view type must be "table", "card", or "kanban"');
  }
  const type = value.trim().toLowerCase();
  if (!TYPES.has(type)) throw new TypeError('Saved view type must be "table", "card", or "kanban"');
  return /** @type {SavedViewType} */ (type);
}

/** @param {unknown} value @returns {string} */
function normalizeName(value) {
  if (typeof value !== 'string') throw new TypeError('Saved view name must be a string');
  const name = value.normalize('NFKC').trim().replace(/\s+/g, ' ');
  if (!name) throw new TypeError('Saved view name cannot be empty');
  if (name.length > 160) throw new RangeError('Saved view name cannot exceed 160 characters');
  return name;
}

/** @param {string} value @returns {string} */
function nameKey(value) {
  return value.normalize('NFKC').toLocaleLowerCase('en-US');
}

/** @param {unknown} value @returns {string} */
function normalizeId(value) {
  if (typeof value !== 'string') throw new TypeError('Saved view id must be a string');
  const id = value.normalize('NFKC').trim();
  if (!id) throw new TypeError('Saved view id cannot be empty');
  if (id.length > 180) throw new RangeError('Saved view id cannot exceed 180 characters');
  return id;
}

/** @param {unknown} value @returns {SavedViewDuplicatePolicy} */
function normalizeDuplicatePolicy(value) {
  if (value !== 'reject' && value !== 'replace') {
    throw new TypeError('Duplicate saved-view policy must be "reject" or "replace"');
  }
  return value;
}

/** @param {unknown} value @returns {Record<string,unknown>} */
function normalizeRecordViewState(value) {
  const state = cloneJsonObject(value, 'Saved view state');
  const version = Number(state.version);
  if (!Number.isInteger(version) || version < 1) {
    throw new TypeError('Saved view state requires a positive integer version');
  }
  state.version = version;
  for (const key of FORBIDDEN_STATE_KEYS) {
    if (Object.prototype.hasOwnProperty.call(state, key)) {
      throw new TypeError(`Saved view state cannot serialize ${key}`);
    }
  }
  return state;
}

/** @param {unknown} value @returns {Record<string,unknown>} */
function normalizeFilters(value) {
  return cloneJsonObject(value ?? {}, 'Saved view filters');
}

/** @param {unknown} value @returns {string} */
function normalizeSearch(value) {
  if (value == null) return '';
  if (typeof value !== 'string') throw new TypeError('Saved view search must be a string');
  return value;
}

/** @param {unknown} value @param {string} label @returns {Record<string,unknown>} */
function cloneJsonObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be a plain object`);
  }
  return /** @type {Record<string,unknown>} */ (cloneJsonValue(value, label, new WeakSet()));
}

/** @param {unknown} value @param {string} label @param {WeakSet<object>} seen @returns {unknown} */
function cloneJsonValue(value, label, seen) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError(`${label} cannot contain non-finite numbers`);
    return value;
  }
  if (typeof value !== 'object') throw new TypeError(`${label} must be JSON-safe`);
  if (typeof /** @type {{nodeType?:unknown}} */ (value).nodeType === 'number') {
    throw new TypeError(`${label} cannot contain DOM nodes`);
  }
  if (seen.has(value)) throw new TypeError(`${label} cannot contain cycles`);
  seen.add(value);
  try {
    if (Array.isArray(value)) return value.map((item) => cloneJsonValue(item, label, seen));
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError(`${label} can contain only plain objects and arrays`);
    }
    /** @type {Record<string,unknown>} */
    const result = {};
    const object = /** @type {Record<string,unknown>} */ (value);
    if (Object.getOwnPropertySymbols(value).length > 0) {
      throw new TypeError(`${label} cannot contain symbols`);
    }
    for (const key of Object.keys(value).sort()) {
      if (FORBIDDEN_JSON_KEYS.has(key)) {
        throw new TypeError(`${label} cannot contain prototype-pollution keys`);
      }
      const descriptor = Object.getOwnPropertyDescriptor(object, key);
      if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
        throw new TypeError(`${label} cannot contain property accessors`);
      }
      result[key] = cloneJsonValue(descriptor.value, label, seen);
    }
    return result;
  } finally {
    seen.delete(value);
  }
}

/** @param {unknown} value @returns {string} */
function normalizeTimestamp(value) {
  if (value == null || value === '') return EPOCH;
  const date = new Date(/** @type {string|number|Date} */ (value));
  return Number.isFinite(date.getTime()) ? date.toISOString() : EPOCH;
}

/** @param {unknown} value @returns {number} */
function normalizeDocumentVersion(value) {
  if (value == null) return 0;
  const version = Number(value);
  if (!Number.isInteger(version) || version < 0) throw new TypeError('Saved-view document version must be a non-negative integer');
  return version;
}

/** @param {unknown} value @param {string} key @returns {string} */
function requiredScopePart(value, key) {
  if (typeof value !== 'string' && typeof value !== 'number') {
    throw new TypeError(`Saved-view scope ${key} must be a string or number`);
  }
  const text = String(value).normalize('NFKC').trim();
  if (!text) throw new TypeError(`Saved-view scope ${key} cannot be empty`);
  return text;
}

/** @param {unknown} value @returns {string|null} */
function nullableWorkspacePart(value) {
  if (value === null) return null;
  return requiredScopePart(value, 'workspaceId');
}

/** @param {SavedViewScope} scope @returns {string} */
function scopeKey(scope) {
  const workspace = scope.workspaceId === null ? '\u0001' : `\u0002${scope.workspaceId}`;
  return `${scope.userId}\u0000${workspace}\u0000${scope.resource}`;
}

/** @param {string} left @param {string} right @returns {number} */
function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

/** @param {unknown} value @returns {value is SavedViewEntry} */
function isSavedViewEntryLike(value) {
  return Boolean(value && typeof value === 'object' && 'id' in value && typeof value.id === 'string');
}

/** Small deterministic FNV-1a hash encoded for readable ids. @param {string} value @returns {string} */
function hashString(value) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}
