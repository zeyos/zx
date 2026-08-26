// @ts-check
import { h, restoreTarget, snapshotTarget } from '../../core/dom.js';
import { formatTableCell, Table } from '../table/table.js';
import { RecordView, readViewField } from '../view/record-view.js';

/** @typedef {Record<string, any>} TableViewRecord */
/** @typedef {import('../view/record-view.js').ViewField} ViewField */
/** @typedef {import('../view/record-view.js').ViewSort} ViewSort */
/** @typedef {import('../table/table.js').TableColumn} TableColumn */
/** @typedef {import('../table/table.js').TableOptions} TableOptions */

/**
 * @typedef {Object} TableViewOptions
 * @property {ViewField[]} [fields=[]] Shared ordered field descriptors. These win over `table.columns`.
 * @property {TableViewRecord[]} [data=[]] Initial records. These win over `table.data`.
 * @property {string|((record:TableViewRecord)=>unknown)} [recordId='ID'] Stable record id accessor.
 * @property {ViewSort|null} [sort=null] Initial shared sort.
 * @property {'local'|'server'} [sortMode='local'] Local or server-controlled sorting.
 * @property {false|'single'|'multi'} [selectable=false] Shared selection behavior.
 * @property {unknown[]} [selection=[]] Initially selected record ids.
 * @property {string[]} [fieldOrder=[]] Preferred stable field order.
 * @property {string[]} [hiddenFields=[]] Initially hidden field ids.
 * @property {boolean} [fieldControls=true] Show the accessible visibility and reorder disclosure.
 * @property {string|Node|(()=>string|Node)|null} [emptyText=null] Empty-result content.
 * @property {TableOptions} [table={}] Advanced low-level Table options. Shared options win where
 * their contracts overlap; all other options and callbacks are forwarded unchanged.
 * @property {(event:CustomEvent<Record<string,unknown>>)=>void} [onrecordclick]
 * @property {(event:CustomEvent<Record<string,unknown>>)=>void} [onrecorddblclick]
 * @property {(event:CustomEvent<{records:TableViewRecord[]}> )=>void} [ondatachange]
 * @property {(event:CustomEvent<{records:TableViewRecord[],ids:unknown[]}> )=>void} [onselectionchange]
 * @property {(event:CustomEvent<{id:string|null,dir:'asc'|'desc'|null}>)=>void} [onsortchange]
 * @property {(event:CustomEvent<{visible:string[],hidden:string[]}> )=>void} [onfieldvisibilitychange]
 * @property {(event:CustomEvent<{order:string[]}> )=>void} [onfieldorderchange]
 * @property {(event:CustomEvent<Record<string,unknown>>)=>void} [onstatechange]
 */

/**
 * Record-oriented table view. Shared record state stays in RecordView while the composed `table`
 * instance retains Table's editing, hierarchy, growth, movement, responsive, and loading behavior.
 * @fires TableView#recordclick
 * @fires TableView#recorddblclick
 * @fires TableView#datachange
 * @fires TableView#selectionchange
 * @fires TableView#sortchange
 * @fires TableView#fieldvisibilitychange
 * @fires TableView#fieldorderchange
 * @fires TableView#statechange
 * @extends {RecordView}
 */
export class TableView extends RecordView {
  static cssName = 'table-view';

  /** @type {Readonly<TableViewOptions>} */
  static defaults = { table: {} };

  /**
   * Creates or enhances a record table view.
   * @param {Element|string|null} [target=null] Existing root, selector, or null.
   * @param {TableViewOptions} [options={}] Shared and table-specific options.
   */
  constructor(target = null, options = {}) {
    super(target, options);
  }

  /** @returns {HTMLElement} Table view root. */
  render() {
    const created = this.el === null;
    const root = /** @type {HTMLElement} */ (this.el ?? h('div'));
    this.el = root;
    this._createdTableViewRoot = created;
    this._tableViewOriginal = created ? null : snapshotTarget(root);
    this._tableViewRestored = false;
    this._tableSyncDepth = 0;
    this._tableViewDestroyed = false;
    this._tableHost = h('div', { class: 'zx-table-view__table' });
    this._initRecordView(root);

    try {
      root.replaceChildren(this._tableHost);
      const viewOptions = /** @type {Readonly<TableViewOptions>} */ (this.options);
      const options = tableOptionsForView(viewOptions.table, {
        fields: this.getFields(),
        data: this.getData(),
        recordId: this.options.recordId,
        sort: this.getSort(),
        sortMode: this.options.sortMode,
        selectable: this.options.selectable,
        hiddenFields: this.getHiddenFields(),
        fieldControls: this.options.fieldControls,
        emptyText: this.options.emptyText
      });
      this.table = new Table(this._tableHost, options);
      // Seed selection before bridging events so construction stays silent like RecordView itself.
      this.table.setSelection(this.getSelectionIds());
      this._bridgeTableEvents();
      return root;
    } catch (error) {
      this.table?.destroy();
      if (!created) restoreTarget(root, this._tableViewOriginal);
      throw error;
    }
  }

  /** Returns the composed Table for advanced methods and Table-specific events. @returns {Table} */
  getTable() {
    return this.table;
  }

  /** @protected @param {string} reason Shared refresh reason. @returns {void} */
  _refreshView(reason) {
    if (!this.table || this._tableSyncDepth > 0) return;
    this._withTableSync(() => {
      if (reason === 'fields' || reason === 'state') {
        this.table.setColumns(fieldsToTableColumns(this.getFields()), { silent: true });
        this._syncTableFieldState();
      }
      if (reason === 'data' || reason === 'fields' || reason === 'sort' || reason === 'state') {
        this.table.setData(this.getData());
      }
      if (reason === 'sort' || reason === 'fields' || reason === 'state') {
        const sort = this.getSort();
        if (sort) this.table.setSort(sort.id, sort.dir, { silent: true });
        else this.table.clearSort({ silent: true });
      }
      if (reason === 'selection' || reason === 'data' || reason === 'state') {
        this.table.setSelection(this.getSelectionIds());
      }
      if (reason === 'loading') {
        this.table.setLoading(/** @type {HTMLElement} */ (this.el).dataset.loading === 'true');
      }
    });
  }

  /** Destroys the inner Table and restores an enhanced target exactly once. @returns {void} */
  destroy() {
    if (this._tableViewDestroyed) return;
    this._tableViewDestroyed = true;
    this.table?.destroy();
    if (!this._tableViewRestored && !this._createdTableViewRoot) {
      restoreTarget(this.el, this._tableViewOriginal);
      this._tableViewRestored = true;
    }
    super.destroy();
  }

  /** @private @param {()=>void} callback Guarded synchronization. @returns {void} */
  _withTableSync(callback) {
    this._tableSyncDepth += 1;
    try {
      callback();
    } finally {
      this._tableSyncDepth -= 1;
    }
  }

  /** @private @returns {void} */
  _syncTableFieldState() {
    const hidden = new Set(this.getHiddenFields());
    // Show before hiding so Table's one-visible-column invariant never blocks a valid transition.
    for (const id of this.getFieldOrder()) {
      if (!hidden.has(id)) this.table.setColumnVisible(id, true, { silent: true });
    }
    for (const id of this.getFieldOrder()) {
      if (hidden.has(id)) this.table.setColumnVisible(id, false, { silent: true });
    }
  }

  /** @private @returns {void} */
  _bridgeTableEvents() {
    // Table and RecordView intentionally share these event names but not their detail keys. Keep
    // the inner DOM events available on the Table root without leaking a second, row-shaped event
    // through the TableView root; the bridged record-shaped event is emitted there once below.
    this.listen(this._tableHost, 'zx-datachange', (event) => event.stopPropagation());
    this.listen(this._tableHost, 'zx-selectionchange', (event) => event.stopPropagation());
    this.listen(this.table, 'rowclick', (event) => {
      const detail = /** @type {CustomEvent<Record<string,unknown>>} */ (event).detail;
      this.emit('recordclick', { ...detail, record: detail.row });
    });
    this.listen(this.table, 'rowdblclick', (event) => {
      const detail = /** @type {CustomEvent<Record<string,unknown>>} */ (event).detail;
      this.emit('recorddblclick', { ...detail, record: detail.row });
    });
    this.listen(this.table, 'sort', (event) => this._tableSortChanged(
      /** @type {CustomEvent<{id:string|null,dir:'asc'|'desc'|null}>} */ (event).detail));
    this.listen(this.table, 'selectionchange', (event) => this._tableSelectionChanged(
      /** @type {CustomEvent<{rows:TableViewRecord[],ids:unknown[]}>} */ (event).detail));
    this.listen(this.table, 'datachange', () => this._tableDataChanged());
    this.listen(this.table, 'columnvisibilitychange', (event) => this._tableVisibilityChanged(
      /** @type {CustomEvent<{visible:string[],hidden:string[]}>} */ (event).detail));
    this.listen(this.table, 'columnorderchange', (event) => this._tableOrderChanged(
      /** @type {CustomEvent<{order:string[]}>} */ (event).detail));
  }

  /** @private @param {{id:string|null,dir:'asc'|'desc'|null}} detail Sort detail. @returns {void} */
  _tableSortChanged(detail) {
    if (this._tableSyncDepth > 0) return;
    const next = /** @type {ViewSort|null} */ (detail.id == null ? null
      : { id: String(detail.id), dir: detail.dir === 'desc' ? 'desc' : 'asc' });
    if (sameSort(next, this._viewSort)) return;
    this._viewSort = next;
    if (this.options.sortMode === 'local') this._viewData = this.table.getData();
    this.emit('sortchange', next ? { ...next } : { id: null, dir: null });
    this._emitTableViewState('sort');
  }

  /** @private @param {{rows:TableViewRecord[],ids:unknown[]}} detail Selection detail. @returns {void} */
  _tableSelectionChanged(detail) {
    if (this._tableSyncDepth > 0) return;
    const next = new Set(detail.ids);
    if (sameSet(next, this._viewSelected)) return;
    this._viewSelected = next;
    this._viewSelectionAnchor = detail.ids.at(-1) ?? null;
    this._emitTableViewSelection();
  }

  /** @private @returns {void} */
  _tableDataChanged() {
    if (this._tableSyncDepth > 0) return;
    this._viewData = this.table.getData();
    const valid = new Set(this._viewData.map((record) => this._viewRecordId(record)));
    const nextSelection = new Set([...this._viewSelected].filter((id) => valid.has(id)));
    const selectionChanged = !sameSet(nextSelection, this._viewSelected);
    this._viewSelected = nextSelection;
    if (this._viewSelectionAnchor != null && !valid.has(this._viewSelectionAnchor)) {
      this._viewSelectionAnchor = null;
    }
    if (selectionChanged) this._emitTableViewSelection();
    this.emit('datachange', { records: this.getData() });
  }

  /** @private @param {{visible:string[],hidden:string[]}} detail Visibility detail. @returns {void} */
  _tableVisibilityChanged(detail) {
    if (this._tableSyncDepth > 0) return;
    const allowed = new Set(this.getFieldOrder());
    const next = new Set(detail.hidden.filter((id) => allowed.has(id)));
    if (sameSet(next, this._viewHidden)) return;
    this._viewHidden = next;
    this.emit('fieldvisibilitychange', {
      visible: this.getVisibleFields().map((field) => field.id), hidden: this.getHiddenFields()
    });
    this._emitTableViewState('fieldvisibility');
  }

  /** @private @param {{order:string[]}} detail Order detail. @returns {void} */
  _tableOrderChanged(detail) {
    if (this._tableSyncDepth > 0) return;
    const allowed = new Set(this.getFieldOrder());
    const next = [...new Set(detail.order.filter((id) => allowed.has(id))),
      ...this.getFieldOrder().filter((id) => !detail.order.includes(id))];
    if (sameArray(next, this._viewFieldOrder)) return;
    this._viewFieldOrder = next;
    this.emit('fieldorderchange', { order: this.getFieldOrder() });
    this._emitTableViewState('fieldorder');
  }

  /** @private @returns {void} */
  _emitTableViewSelection() {
    this.emit('selectionchange', { records: this.getSelection(), ids: this.getSelectionIds() });
  }

  /** @private @param {string} reason State-change reason. @returns {void} */
  _emitTableViewState(reason) {
    this.emit('statechange', { state: this.getViewState(), reason });
  }
}

/**
 * Maps common fields to Table columns without mutating descriptors. Shared get/render/sortValue
 * semantics win; `field.view.table` may provide the remaining advanced TableColumn properties.
 * @param {ViewField[]} fields Shared fields in display order.
 * @returns {TableColumn[]} Table columns.
 */
export function fieldsToTableColumns(fields) {
  return fields.map((field) => {
    const table = /** @type {Record<string,any>} */ (field.view && typeof field.view === 'object'
      && field.view.table && typeof field.view.table === 'object'
      ? field.view.table : {});
    const column = /** @type {TableColumn & Record<string,unknown>} */ ({ ...field, ...table,
      id: field.id, label: field.label, sortable: Boolean(field.sortable) });
    delete column.get;
    delete column.visible;
    delete column.duplicate;
    delete column.view;
    if (typeof field.render === 'function') {
      column.render = (record, index) => field.render(record, index, readViewField(field, record, index));
    } else if (typeof table.render !== 'function' && typeof field.get === 'function') {
      const formatter = { ...column };
      delete formatter.render;
      column.render = (record, index) => formatTableCell(formatter,
        { ...record, [field.id]: readViewField(field, record, index) }, index);
    }
    if (typeof field.sortValue === 'function') {
      column.sortValue = (record) => field.sortValue(record, 0);
    } else if (typeof table.sortValue !== 'function' && typeof field.get === 'function') {
      column.sortValue = (record) => readViewField(field, record, 0);
    }
    return column;
  });
}

/**
 * Builds the composed Table configuration. Shared options deliberately overwrite overlapping
 * low-level options; every advanced option remains untouched.
 * @param {TableOptions|undefined} table Advanced Table options.
 * @param {{fields:ViewField[],data:TableViewRecord[],recordId:string|((record:TableViewRecord)=>unknown),sort:ViewSort|null,sortMode:'local'|'server',selectable:false|'single'|'multi',hiddenFields:string[],fieldControls:boolean,emptyText:string|Node|(()=>string|Node)|null}} shared Shared state.
 * @returns {TableOptions} Table configuration.
 */
export function tableOptionsForView(table, shared) {
  return {
    ...(table && typeof table === 'object' ? table : {}),
    columns: fieldsToTableColumns(shared.fields),
    data: [...shared.data],
    rowId: shared.recordId,
    sort: shared.sort ? { ...shared.sort } : null,
    sortMode: shared.sortMode,
    selectable: shared.selectable,
    hiddenColumns: [...shared.hiddenFields],
    columnVisibility: Boolean(shared.fieldControls),
    columnReorder: Boolean(shared.fieldControls),
    emptyText: shared.emptyText
  };
}

/** @event TableView#recordclick @type {CustomEvent<Record<string,unknown>>} */
/** @event TableView#recorddblclick @type {CustomEvent<Record<string,unknown>>} */
/** @event TableView#datachange @type {CustomEvent<{records:TableViewRecord[]}>} */
/** @event TableView#selectionchange @type {CustomEvent<{records:TableViewRecord[],ids:unknown[]}>} */
/** @event TableView#sortchange @type {CustomEvent<{id:string|null,dir:'asc'|'desc'|null}>} */
/** @event TableView#fieldvisibilitychange @type {CustomEvent<{visible:string[],hidden:string[]}>} */
/** @event TableView#fieldorderchange @type {CustomEvent<{order:string[]}>} */
/** @event TableView#statechange @type {CustomEvent<Record<string,unknown>>} */

/** @param {ViewSort|null} left @param {ViewSort|null} right @returns {boolean} */
function sameSort(left, right) {
  return left === null && right === null
    || Boolean(left && right && left.id === right.id && left.dir === right.dir);
}

/** @param {Set<unknown>} left @param {Set<unknown>} right @returns {boolean} */
function sameSet(left, right) {
  return left.size === right.size && [...left].every((value) => right.has(value));
}

/** @param {unknown[]} left @param {unknown[]} right @returns {boolean} */
function sameArray(left, right) {
  return left.length === right.length && left.every((value, index) => Object.is(value, right[index]));
}
