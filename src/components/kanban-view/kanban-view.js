// @ts-check
import { h, restoreTarget, snapshotTarget } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { uid } from '../../core/util.js';
import { createRecordCard, resolveRecordActions } from '../card-view/record-card.js';
import { RecordView, readViewField, viewRecordId } from '../view/record-view.js';

/** @typedef {Record<string, any>} KanbanRecord */
/** @typedef {import('../view/record-view.js').RecordViewOptions} RecordViewOptions */
/** @typedef {import('../card-view/record-card.js').RecordCardPreview} RecordCardPreview */
/** @typedef {import('../card-view/record-card.js').RecordCardLink} RecordCardLink */
/** @typedef {import('../card-view/record-card.js').RecordCardAction} RecordCardAction */
/** @typedef {string|((record: KanbanRecord, index: number) => unknown)|null} KanbanAccessor */
/** @typedef {string|((record: KanbanRecord, index: number) => unknown)|null} KanbanCardField */

/**
 * @typedef {Object} KanbanMovePoint
 * @property {string} column Column id.
 * @property {string|null} lane Swim-lane id, or null when lanes are disabled.
 * @property {number} index Zero-based position within the destination column and lane.
 */

/**
 * @typedef {Object} KanbanMoveContext
 * @property {unknown} id Record id.
 * @property {KanbanMovePoint} from Original position.
 * @property {KanbanMovePoint} to Proposed position.
 * @property {KanbanColumn} column Destination column.
 * @property {KanbanSwimlane|null} swimlane Destination lane.
 */

/**
 * @typedef {Object} KanbanColumn
 * @property {string} id Stable column id.
 * @property {string} label Visible column label.
 * @property {unknown} [value] Value written by local moves; defaults to `id`.
 * @property {number|null} [limit=null] Advisory work-in-progress limit.
 * @property {(record: KanbanRecord, context: KanbanMoveContext) => boolean} [accept] Eligibility
 * predicate. Returning false rejects the move before the cancelable event is emitted.
 */

/**
 * @typedef {Object} KanbanSwimlane
 * @property {string} id Stable lane id.
 * @property {string} label Visible lane label.
 * @property {unknown} [value] Value written by local moves; defaults to `id`.
 * @property {(record: KanbanRecord, context: KanbanMoveContext) => boolean} [accept] Eligibility
 * predicate. Returning false rejects the move before the cancelable event is emitted.
 */

/**
 * @typedef {Object} KanbanDestination
 * @property {string} [column] Destination column; omitted keeps the current column.
 * @property {string|null} [lane] Destination lane; omitted keeps the current lane.
 * @property {number} [index] Zero-based destination position; omitted appends.
 */

/**
 * @typedef {Object} KanbanViewState
 * @property {1} version State schema version.
 * @property {string[]} fieldOrder Shared field order.
 * @property {string[]} hiddenFields Shared hidden fields.
 * @property {{id:string,dir:'asc'|'desc'}|null} sort Shared sort.
 * @property {string[]} columnOrder Column order.
 * @property {string[]} swimlaneOrder Swim-lane order.
 * @property {string[]} collapsedColumns Collapsed column ids.
 * @property {string[]} collapsedSwimlanes Collapsed swim-lane ids.
 */

/**
 * @typedef {Object} KanbanViewOptions
 * @property {import('../view/record-view.js').ViewField[]} [fields=[]] Shared field descriptors.
 * @property {KanbanRecord[]} [data=[]] Records.
 * @property {string|((record:KanbanRecord)=>unknown)} [recordId='ID'] Stable record id accessor.
 * @property {{id:string,dir:'asc'|'desc'}|null} [sort=null] Shared initial sort.
 * @property {'local'|'server'} [sortMode='local'] Shared sort mode.
 * @property {false|'single'|'multi'} [selectable=false] Shared selection mode.
 * @property {unknown[]} [selection=[]] Initial record ids.
 * @property {string[]} [fieldOrder=[]] Shared field order.
 * @property {string[]} [hiddenFields=[]] Shared hidden fields.
 * @property {boolean} [fieldControls=true] Show shared field controls.
 * @property {string|Node|(() => string|Node)|null} [emptyText=null] Empty-board content.
 * @property {KanbanAccessor} [columnBy='status'] Column accessor.
 * @property {KanbanColumn[]|null} [columns=null] Explicit columns, or null to derive them.
 * @property {KanbanAccessor} [swimlaneBy=null] Optional swim-lane accessor.
 * @property {KanbanSwimlane[]|null} [swimlanes=null] Explicit lanes, or null to derive them.
 * @property {KanbanCardField} [titleField=null] Card title field or reader.
 * @property {KanbanCardField} [subtitleField=null] Card subtitle field or reader.
 * @property {string|((record:KanbanRecord,index:number)=>RecordCardPreview)|null} [preview=null] Preview field or reader.
 * @property {KanbanCardField} [previewAlt=null] Preview alternative-text field or reader.
 * @property {RecordCardLink|((record:KanbanRecord,index:number)=>RecordCardLink)|null} [link=null] Record-card primary link descriptor or reader.
 * @property {RecordCardAction[]|((record:KanbanRecord,index:number)=>RecordCardAction[])} [actions=[]] Card actions.
 * @property {'local'|'external'} [moveMode='local'] Whether accepted moves update local data.
 * @property {string[]} [columnOrder=[]] Preferred column order.
 * @property {string[]} [swimlaneOrder=[]] Preferred swim-lane order.
 * @property {string[]} [collapsedColumns=[]] Initially collapsed columns.
 * @property {string[]} [collapsedSwimlanes=[]] Initially collapsed lanes.
 * @property {boolean} [showCounts=true] Show record counts and WIP indicators.
 * @property {boolean} [showEmptyColumns=true] Keep configured empty columns visible.
 * @property {'outlined'|'raised'|'filled'} [variant='outlined'] Shared record-card treatment.
 * @property {string} [label='Kanban board'] Accessible board label.
 * @property {(event: CustomEvent<Record<string,unknown>>) => void} [onrecordmove]
 * @property {(event: CustomEvent<Record<string,unknown>>) => void} [onrecordaction]
 */

/** @typedef {{record:KanbanRecord,id:unknown,index:number,column:string,lane:string|null}} KanbanCardMeta */
/** @typedef {{column:string,lane:string|null,list:HTMLElement}} KanbanSectionMeta */
/** @typedef {{id:unknown,from:KanbanMovePoint,to:KanbanMovePoint}} KanbanKeyboardMove */

const INTERACTIVE = 'a, button, input, select, textarea, summary, [contenteditable="true"]';

/**
 * Configurable record board with semantic columns, optional swim lanes, and equivalent pointer and
 * keyboard movement. Local moves clone records; callback grouping remains fully usable for display
 * and external moves but cannot be written safely by local cross-axis moves.
 * @fires KanbanView#recordmove
 * @fires KanbanView#recordaction
 * @extends {RecordView}
 */
export class KanbanView extends RecordView {
  static cssName = 'kanban-view';

  /** @type {Readonly<KanbanViewOptions & RecordViewOptions>} */
  static defaults = {
    ...RecordView.defaults,
    columnBy: 'status',
    columns: null,
    swimlaneBy: null,
    swimlanes: null,
    titleField: null,
    subtitleField: null,
    preview: null,
    previewAlt: null,
    link: null,
    actions: [],
    moveMode: 'local',
    columnOrder: [],
    swimlaneOrder: [],
    collapsedColumns: [],
    collapsedSwimlanes: [],
    showCounts: true,
    showEmptyColumns: true,
    variant: 'outlined',
    label: 'Kanban board'
  };

  /**
   * Creates a Kanban record view.
   * @param {Element|string|null} [target=null] Existing root, selector, or null.
   * @param {KanbanViewOptions & RecordViewOptions} [options={}] Kanban and shared record-view options.
   */
  constructor(target = null, options = {}) {
    super(target, options);
  }

  /** @returns {HTMLElement} Board root. */
  render() {
    const existing = Boolean(this.el);
    const root = /** @type {HTMLElement} */ (this.el ?? h('div'));
    const options = this._kanbanOptions();
    this._kanbanSnapshot = existing ? snapshotTarget(root) : null;
    this._kanbanDestroyed = false;
    try {
      this._initRecordView(root);
      this._kanbanColumns = options.columns === null
        ? null : normalizeKanbanDescriptors(options.columns, 'column');
      this._kanbanSwimlanes = options.swimlanes === null
        ? null : normalizeKanbanDescriptors(options.swimlanes, 'swimlane');
      this._kanbanColumnOrder = normalizeOrder(options.columnOrder);
      this._kanbanSwimlaneOrder = normalizeOrder(options.swimlaneOrder);
      this._collapsedColumns = new Set(normalizeOrder(options.collapsedColumns));
      this._collapsedSwimlanes = new Set(normalizeOrder(options.collapsedSwimlanes));
      this._keyboardMove = /** @type {KanbanKeyboardMove|null} */ (null);
      this._dragId = null;
      this._dragDestination = /** @type {KanbanMovePoint|null} */ (null);
      this._announcementToken = 0;
      this._cardMeta = new WeakMap();
      this._sectionMeta = new WeakMap();
      this._cardsById = new Map();

      this._toolbar = h('div', { class: 'zx-record-view__toolbar zx-kanban-view__toolbar' });
      if (options.fieldControls) this._toolbar.append(this._createViewFieldControls());
      this._board = h('div', {
        class: 'zx-kanban-view__board', role: 'region', ariaLabel: options.label
      });
      this._live = h('div', {
        class: 'zx-kanban-view__live', role: 'status', ariaLive: 'polite', ariaAtomic: 'true'
      });
      root.replaceChildren(this._toolbar, this._board, this._live);

      this.listen(this._board, 'click', (event) => this._handleBoardClick(/** @type {MouseEvent} */ (event)));
      this.listen(this._board, 'dblclick', (event) => this._handleBoardDoubleClick(/** @type {MouseEvent} */ (event)));
      this.listen(this._board, 'keydown', (event) => this._handleBoardKeydown(/** @type {KeyboardEvent} */ (event)));
      this.listen(this._board, 'error', (event) => this._handlePreviewError(event), { capture: true });
      this.listen(this._board, 'dragstart', (event) => this._handleDragStart(/** @type {DragEvent} */ (event)));
      this.listen(this._board, 'dragover', (event) => this._handleDragOver(/** @type {DragEvent} */ (event)));
      this.listen(this._board, 'drop', (event) => this._handleDrop(/** @type {DragEvent} */ (event)));
      this.listen(this._board, 'dragend', () => this._clearDrag());
      this._refreshView('init');
      return root;
    } catch (error) {
      if (this._kanbanSnapshot) restoreTarget(root, this._kanbanSnapshot);
      throw error;
    }
  }

  /** Returns resolved columns in visual order. @returns {KanbanColumn[]} */
  getColumns() {
    return this._resolvedColumns().map((column) => ({ ...column }));
  }

  /**
   * Replaces configured columns. Pass null to derive them from current data.
   * @param {KanbanColumn[]|null} columns Columns.
   * @returns {this}
   */
  setColumns(columns) {
    this._kanbanColumns = columns === null ? null : normalizeKanbanDescriptors(columns, 'column');
    const descriptors = this._rawColumns();
    this._kanbanColumnOrder = reconcileKanbanPreference(
      descriptors, this._kanbanColumnOrder, this._kanbanColumns === null);
    if (this._kanbanColumns !== null) {
      const ids = new Set(descriptors.map((column) => column.id));
      this._collapsedColumns = new Set([...this._collapsedColumns].filter((id) => ids.has(id)));
    }
    this._refreshView('columns');
    this._emitKanbanState('columns');
    return this;
  }

  /** Returns resolved lane descriptors in visual order. @returns {KanbanSwimlane[]} */
  getSwimlanes() {
    return this._resolvedSwimlanes().map((lane) => ({ ...lane }));
  }

  /**
   * Replaces configured lanes. Pass null to derive them from current data.
   * @param {KanbanSwimlane[]|null} lanes Lanes.
   * @returns {this}
   */
  setSwimlanes(lanes) {
    this._kanbanSwimlanes = lanes === null ? null : normalizeKanbanDescriptors(lanes, 'swimlane');
    const descriptors = this._rawSwimlanes();
    const preserveUnknown = this._kanbanSwimlanes === null && this._kanbanOptions().swimlaneBy != null;
    this._kanbanSwimlaneOrder = reconcileKanbanPreference(
      descriptors, this._kanbanSwimlaneOrder, preserveUnknown);
    if (!preserveUnknown) {
      const ids = new Set(descriptors.map((lane) => lane.id));
      this._collapsedSwimlanes = new Set([...this._collapsedSwimlanes].filter((id) => ids.has(id)));
    }
    this._refreshView('swimlanes');
    this._emitKanbanState('swimlanes');
    return this;
  }

  /** Returns the current resolved column order. @returns {string[]} */
  getColumnOrder() {
    return this._resolvedColumns().map((column) => column.id);
  }

  /**
   * Reconciles and applies a preferred column order.
   * @param {string[]} order Preferred ids.
   * @param {{silent?:boolean}} [options={}] Event behavior.
   * @returns {this}
   */
  setColumnOrder(order, options = {}) {
    const descriptors = this._rawColumns();
    const current = this.getColumnOrder();
    const next = reconcileKanbanOrder(descriptors, order);
    if (sameArray(next, current)) return this;
    this._kanbanColumnOrder = mergeKanbanResolvedOrder(
      this._kanbanColumnOrder, descriptors, next, this._kanbanColumns === null);
    this._refreshView('columnorder');
    if (!options.silent) this._emitKanbanState('columnorder');
    return this;
  }

  /**
   * Moves a column relative to another.
   * @param {string} id Moving id.
   * @param {string} targetId Target id.
   * @param {'before'|'after'} [position='before'] Target edge.
   * @returns {this}
   */
  moveColumn(id, targetId, position = 'before') {
    return this.setColumnOrder(moveOrderedId(this.getColumnOrder(), id, targetId, position));
  }

  /** Returns the current resolved lane order. @returns {string[]} */
  getSwimlaneOrder() {
    return this._resolvedSwimlanes().map((lane) => lane.id);
  }

  /**
   * Reconciles and applies a preferred lane order.
   * @param {string[]} order Preferred ids.
   * @param {{silent?:boolean}} [options={}] Event behavior.
   * @returns {this}
   */
  setSwimlaneOrder(order, options = {}) {
    const descriptors = this._rawSwimlanes();
    const current = this.getSwimlaneOrder();
    const next = reconcileKanbanOrder(descriptors, order);
    if (sameArray(next, current)) return this;
    const preserveUnknown = this._kanbanSwimlanes === null && this._kanbanOptions().swimlaneBy != null;
    this._kanbanSwimlaneOrder = mergeKanbanResolvedOrder(
      this._kanbanSwimlaneOrder, descriptors, next, preserveUnknown);
    this._refreshView('swimlaneorder');
    if (!options.silent) this._emitKanbanState('swimlaneorder');
    return this;
  }

  /**
   * Moves a lane relative to another.
   * @param {string} id Moving id.
   * @param {string} targetId Target id.
   * @param {'before'|'after'} [position='before'] Target edge.
   * @returns {this}
   */
  moveSwimlane(id, targetId, position = 'before') {
    return this.setSwimlaneOrder(moveOrderedId(this.getSwimlaneOrder(), id, targetId, position));
  }

  /** Returns collapsed column ids. @returns {string[]} */
  getCollapsedColumns() {
    return this.getColumnOrder().filter((id) => this._collapsedColumns.has(id));
  }

  /**
   * Expands or collapses one column across every lane.
   * @param {string} id Column id.
   * @param {boolean} [collapsed=true] Desired state.
   * @param {{silent?:boolean}} [options={}] Event behavior.
   * @returns {this}
   */
  setColumnCollapsed(id, collapsed = true, options = {}) {
    const columnId = String(id);
    if (!this.getColumnOrder().includes(columnId)) throw new RangeError(`Unknown Kanban column: ${columnId}`);
    const changed = collapsed ? !this._collapsedColumns.has(columnId) : this._collapsedColumns.has(columnId);
    if (!changed) return this;
    if (collapsed) this._collapsedColumns.add(columnId);
    else this._collapsedColumns.delete(columnId);
    this._refreshView('columncollapse');
    if (!options.silent) this._emitKanbanState('columncollapse');
    return this;
  }

  /** Toggles a column. @param {string} id Column id. @returns {this} */
  toggleColumn(id) {
    return this.setColumnCollapsed(id, !this._collapsedColumns.has(String(id)));
  }

  /** Returns collapsed lane ids. @returns {string[]} */
  getCollapsedSwimlanes() {
    return this.getSwimlaneOrder().filter((id) => this._collapsedSwimlanes.has(id));
  }

  /**
   * Expands or collapses one lane.
   * @param {string} id Lane id.
   * @param {boolean} [collapsed=true] Desired state.
   * @param {{silent?:boolean}} [options={}] Event behavior.
   * @returns {this}
   */
  setSwimlaneCollapsed(id, collapsed = true, options = {}) {
    const laneId = String(id);
    if (!this.getSwimlaneOrder().includes(laneId)) throw new RangeError(`Unknown Kanban lane: ${laneId}`);
    const changed = collapsed ? !this._collapsedSwimlanes.has(laneId) : this._collapsedSwimlanes.has(laneId);
    if (!changed) return this;
    if (collapsed) this._collapsedSwimlanes.add(laneId);
    else this._collapsedSwimlanes.delete(laneId);
    this._refreshView('swimlanecollapse');
    if (!options.silent) this._emitKanbanState('swimlanecollapse');
    return this;
  }

  /** Toggles a lane. @param {string} id Lane id. @returns {this} */
  toggleSwimlane(id) {
    return this.setSwimlaneCollapsed(id, !this._collapsedSwimlanes.has(String(id)));
  }

  /**
   * Proposes and, in local mode, commits a record move. Destination acceptance is checked before
   * a cancelable `recordmove` event. WIP limits are reported but remain advisory.
   * @param {unknown} id Record id.
   * @param {KanbanDestination} destination Destination.
   * @returns {this}
   * @fires KanbanView#recordmove
   * @fires RecordView#datachange
   */
  moveRecord(id, destination) {
    const options = this._kanbanOptions();
    const record = this.getRecord(id);
    const from = this._recordLocation(id);
    if (!record || !from || !destination || typeof destination !== 'object') return this;
    const columns = this._resolvedColumns();
    const lanes = this._resolvedSwimlanes();
    const columnId = destination.column == null ? from.column : String(destination.column);
    const laneId = options.swimlaneBy == null
      ? null : destination.lane === undefined ? from.lane : normalizeAxisId(destination.lane);
    const column = columns.find((candidate) => candidate.id === columnId);
    const lane = options.swimlaneBy == null
      ? null : lanes.find((candidate) => candidate.id === laneId);
    if (!column || options.swimlaneBy != null && !lane) {
      this._announce('Move rejected: the destination is not available.');
      return this;
    }
    const destinationCount = this._recordsIn(columnId, laneId)
      .filter((candidate) => !Object.is(this._viewRecordId(candidate.record), id)).length;
    const destinationColumnCount = this._viewData.filter((candidate, candidateIndex) =>
      normalizeAxisId(this._readAxis(options.columnBy, candidate, candidateIndex)) === columnId
      && !Object.is(this._viewRecordId(candidate), id)).length;
    const index = normalizeMoveIndex(destination.index, destinationCount);
    const to = { column: columnId, lane: laneId, index };
    if (sameMovePoint(from, to)) return this;
    const context = { id, from: { ...from }, to: { ...to }, column: { ...column }, swimlane: lane ? { ...lane } : null };
    if (column.accept && column.accept(record, context) === false
      || lane?.accept && lane.accept(record, context) === false) {
      this._announce(`Move rejected for ${this._recordName(record, from.index)}.`);
      return this;
    }

    let movedRecord = record;
    if (options.moveMode === 'local') {
      movedRecord = this._localMovedRecord(record, from, to, column, lane);
      if (!movedRecord) {
        this._announce('Move rejected: callback grouping requires external move mode.');
        return this;
      }
    }
    const next = reorderKanbanData(this._viewData, id, movedRecord, {
      recordId: options.recordId,
      columnBy: (candidate, candidateIndex) => this._readAxis(options.columnBy, candidate, candidateIndex),
      swimlaneBy: options.swimlaneBy == null ? null
        : (candidate, candidateIndex) => this._readAxis(options.swimlaneBy, candidate, candidateIndex),
      destination: to
    });
    if (!next) {
      this._announce('Move rejected: the destination could not be resolved.');
      return this;
    }
    const finalCount = destinationColumnCount + 1;
    const limitExceeded = column.limit != null && finalCount > column.limit;
    const limitAnnouncement = column.limit == null ? ''
      : limitExceeded ? ` Work-in-progress limit ${column.limit} exceeded.`
        : finalCount === column.limit ? ` Work-in-progress limit ${column.limit} reached.` : '';
    const moveEvent = this.emit('recordmove', {
      record, id, from: { ...from }, to: { ...next.to }, column: { ...column },
      swimlane: lane ? { ...lane } : null, limitExceeded
    }, { honorDomCancellation: true });
    if (moveEvent.defaultPrevented) {
      this._announce(`Move canceled for ${this._recordName(record, from.index)}.`);
      return this;
    }
    if (options.moveMode === 'external') {
      this._announce(`Move requested for ${this._recordName(record, from.index)} to ${this._targetName(next.to)}.${limitAnnouncement}`);
      return this;
    }
    this._viewData = next.records;
    // A manual bucket position and a local sort cannot both be authoritative. Clear the local sort
    // on an accepted local move so the visible order and serialized state remain truthful.
    if (options.sortMode === 'local' && this.getSort()) this.setSort(null);
    else this._refreshView('move');
    this.emit('datachange', { records: this.getData() });
    this._announce(`Moved ${this._recordName(movedRecord, next.to.index)} to ${this._targetName(next.to)}.${limitAnnouncement}`);
    queueMicrotask(() => this._moveHandle(id)?.focus());
    return this;
  }

  /** Returns common plus board-specific serializable configuration. @returns {KanbanViewState} */
  getViewState() {
    // Resolve once so newly derived axes join the preference without discarding saved axes that are
    // temporarily absent from an empty or partial result set.
    this.getColumnOrder();
    this.getSwimlaneOrder();
    const derivedColumns = this._kanbanColumns === null;
    const derivedSwimlanes = this._kanbanSwimlanes === null && this._kanbanOptions().swimlaneBy != null;
    return {
      ...super.getViewState(),
      columnOrder: derivedColumns ? [...this._kanbanColumnOrder] : this.getColumnOrder(),
      swimlaneOrder: derivedSwimlanes ? [...this._kanbanSwimlaneOrder] : this.getSwimlaneOrder(),
      collapsedColumns: derivedColumns ? [...this._collapsedColumns] : this.getCollapsedColumns(),
      collapsedSwimlanes: derivedSwimlanes
        ? [...this._collapsedSwimlanes] : this.getCollapsedSwimlanes()
    };
  }

  /**
   * Restores common and Kanban configuration. State from another record view is accepted safely.
   * @param {Partial<KanbanViewState>|null} state Saved state.
   * @param {{silent?:boolean}} [options={}] Event behavior.
   * @returns {this}
   */
  setViewState(state, options = {}) {
    const source = state && typeof state === 'object' ? state : {};
    super.setViewState(source, { silent: true });
    const columns = this._rawColumns();
    const lanes = this._rawSwimlanes();
    const derivedColumns = this._kanbanColumns === null;
    const derivedSwimlanes = this._kanbanSwimlanes === null && this._kanbanOptions().swimlaneBy != null;
    this._kanbanColumnOrder = reconcileKanbanPreference(columns,
      Array.isArray(source.columnOrder) ? source.columnOrder : this._kanbanColumnOrder,
      derivedColumns);
    this._kanbanSwimlaneOrder = reconcileKanbanPreference(lanes,
      Array.isArray(source.swimlaneOrder) ? source.swimlaneOrder : this._kanbanSwimlaneOrder,
      derivedSwimlanes);
    const columnIds = new Set(columns.map((column) => column.id));
    const laneIds = new Set(lanes.map((lane) => lane.id));
    if (Array.isArray(source.collapsedColumns)) {
      const collapsed = normalizeOrder(source.collapsedColumns);
      this._collapsedColumns = new Set(derivedColumns ? collapsed : collapsed.filter((id) => columnIds.has(id)));
    }
    if (Array.isArray(source.collapsedSwimlanes)) {
      const collapsed = normalizeOrder(source.collapsedSwimlanes);
      this._collapsedSwimlanes = new Set(derivedSwimlanes ? collapsed : collapsed.filter((id) => laneIds.has(id)));
    }
    this._refreshView('state');
    if (!options.silent) this._emitKanbanState('restore');
    return this;
  }

  /** Restores enhanced targets after base lifecycle cleanup. @returns {void} */
  destroy() {
    if (this._kanbanDestroyed) return;
    this._kanbanDestroyed = true;
    const root = this.el;
    const snapshot = this._kanbanSnapshot;
    super.destroy();
    if (snapshot && root) restoreTarget(root, snapshot);
  }

  /** @protected @param {string} _reason Refresh reason. @returns {void} */
  _refreshView(_reason) {
    if (!this._board) return;
    if (_reason === 'selection') {
      this._syncCardSelection();
      return;
    }
    if (_reason === 'loading') return;
    const options = this._kanbanOptions();
    const activeElement = document.activeElement;
    const activeMeta = this._metaForTarget(document.activeElement);
    const restoreHandle = Boolean(document.activeElement?.classList?.contains('zx-kanban-view__move-handle'));
    const activeCollapse = activeElement instanceof Element
      ? activeElement.closest('[data-kanban-collapse]') : null;
    const activeSection = activeCollapse?.closest('.zx-kanban-view__column');
    const activeCollapseFocus = activeCollapse && this._board.contains(activeCollapse) ? {
      axis: /** @type {'column'|'swimlane'} */ (/** @type {HTMLElement} */ (activeCollapse).dataset.kanbanCollapse),
      id: String(/** @type {HTMLElement} */ (activeCollapse).dataset.kanbanId),
      lane: activeSection ? this._sectionMeta.get(activeSection)?.lane ?? null : null
    } : null;
    const columns = this._resolvedColumns();
    const lanes = this._resolvedSwimlanes();
    this._cardMeta = new WeakMap();
    this._sectionMeta = new WeakMap();
    this._cardsById = new Map();
    const content = [];
    if (options.swimlaneBy == null) {
      content.push(this._renderColumns(columns, null, false));
    } else {
      lanes.forEach((lane) => content.push(this._renderLane(lane, columns)));
    }
    const shownCards = this._cardsById.size;
    if (shownCards === 0 && !this._viewData.length) content.push(this._emptyContent());
    this._board.replaceChildren(...content);
    if (this._keyboardMove && !this.getRecord(this._keyboardMove.id)) this._keyboardMove = null;
    this._syncKeyboardTarget();
    if (activeCollapseFocus || activeMeta) queueMicrotask(() => {
      if (activeCollapseFocus) {
        this._collapseControl(activeCollapseFocus.axis, activeCollapseFocus.id,
          activeCollapseFocus.lane)?.focus();
        return;
      }
      if (!activeMeta) return;
      if (activeMeta.lane != null && this._collapsedSwimlanes.has(activeMeta.lane)) {
        this._collapseControl('swimlane', activeMeta.lane)?.focus();
        return;
      }
      if (this._collapsedColumns.has(activeMeta.column)) {
        this._collapseControl('column', activeMeta.column, activeMeta.lane)?.focus();
        return;
      }
      const card = this._cardsById.get(activeMeta.id);
      const target = restoreHandle ? card?.querySelector('.zx-kanban-view__move-handle') : card;
      if (target?.isConnected) /** @type {HTMLElement} */ (target).focus();
    });
  }

  /** @param {KanbanSwimlane} lane @param {KanbanColumn[]} columns @returns {HTMLElement} */
  _renderLane(lane, columns) {
    const options = this._kanbanOptions();
    const collapsed = this._collapsedSwimlanes.has(lane.id);
    const headingId = uid('zx-kanban-lane');
    const bodyId = uid('zx-kanban-lane-body');
    const count = this._viewData.filter((record, index) =>
      normalizeAxisId(this._readAxis(options.swimlaneBy, record, index)) === lane.id).length;
    const toggle = h('button', {
      class: 'zx-kanban-view__collapse', type: 'button', ariaExpanded: String(!collapsed),
      ariaControls: bodyId, ariaLabel: `${collapsed ? 'Expand' : 'Collapse'} swim lane ${lane.label}`,
      dataset: { kanbanCollapse: 'swimlane', kanbanId: lane.id }
    }, icon(collapsed ? 'chevron-right' : 'chevron-down', { size: 13 }));
    const heading = h('h2', { class: 'zx-kanban-view__lane-heading', id: headingId },
      toggle, h('span', {}, lane.label), options.showCounts
        ? h('span', { class: 'zx-kanban-view__count', ariaLabel: `${count} records` }, String(count)) : null);
    const body = this._renderColumns(columns, lane, true);
    body.id = bodyId;
    body.hidden = collapsed;
    return h('section', {
      class: 'zx-kanban-view__lane', ariaLabelledby: headingId, dataset: { collapsed: String(collapsed) }
    }, heading, body);
  }

  /** @param {KanbanColumn[]} columns @param {KanbanSwimlane|null} lane @param {boolean} hasLanes @returns {HTMLElement} */
  _renderColumns(columns, lane, hasLanes) {
    const options = this._kanbanOptions();
    const host = h('div', { class: 'zx-kanban-view__columns' });
    for (const column of columns) {
      const entries = this._recordsIn(column.id, lane?.id ?? null);
      if (!options.showEmptyColumns && entries.length === 0) continue;
      host.append(this._renderColumn(column, lane, entries, hasLanes));
    }
    return host;
  }

  /**
   * @param {KanbanColumn} column
   * @param {KanbanSwimlane|null} lane
   * @param {{record:KanbanRecord,index:number}[]} entries
   * @param {boolean} hasLanes
   * @returns {HTMLElement}
   */
  _renderColumn(column, lane, entries, hasLanes) {
    const options = this._kanbanOptions();
    const collapsed = this._collapsedColumns.has(column.id);
    const headingId = uid('zx-kanban-column');
    const listId = uid('zx-kanban-column-list');
    const columnCount = this._viewData.filter((record, index) =>
      normalizeAxisId(this._readAxis(options.columnBy, record, index)) === column.id).length;
    const wip = column.limit == null ? 'none'
      : columnCount > column.limit ? 'exceeded' : columnCount === column.limit ? 'limit' : 'within';
    const toggle = h('button', {
      class: 'zx-kanban-view__collapse', type: 'button', ariaExpanded: String(!collapsed),
      ariaControls: listId, ariaLabel: `${collapsed ? 'Expand' : 'Collapse'} column ${column.label}`,
      dataset: { kanbanCollapse: 'column', kanbanId: column.id }
    }, icon(collapsed ? 'chevron-right' : 'chevron-down', { size: 13 }));
    const indicator = options.showCounts || column.limit != null ? h('span', {
      class: 'zx-kanban-view__count',
      ariaLabel: column.limit == null ? `${entries.length} records`
        : hasLanes ? `${entries.length} records in this lane, ${columnCount} of work-in-progress limit ${column.limit} in the column`
          : `${columnCount} records, work-in-progress limit ${column.limit}`
    }, column.limit == null ? String(entries.length)
      : hasLanes ? `${entries.length} · ${columnCount} / ${column.limit}` : `${columnCount} / ${column.limit}`) : null;
    const heading = h(hasLanes ? 'h3' : 'h2', {
      class: 'zx-kanban-view__column-heading', id: headingId
    }, toggle, h('span', { class: 'zx-kanban-view__column-label' }, column.label), indicator);
    const list = h('ul', {
      class: 'zx-kanban-view__cards', id: listId, ariaLabel: `${column.label}${lane ? `, ${lane.label}` : ''}`
    });
    entries.forEach((entry) => list.append(this._renderCard(entry.record, entry.index, column.id, lane?.id ?? null, hasLanes)));
    list.hidden = collapsed;
    const section = h('section', {
      class: 'zx-kanban-view__column', ariaLabelledby: headingId,
      dataset: { column: column.id, collapsed: String(collapsed), wip }
    }, heading, list);
    this._sectionMeta.set(section, { column: column.id, lane: lane?.id ?? null, list });
    return section;
  }

  /** @param {KanbanRecord} record @param {number} index @param {string} column @param {string|null} lane @param {boolean} hasLanes @returns {HTMLLIElement} */
  _renderCard(record, index, column, lane, hasLanes) {
    const options = this._kanbanOptions();
    const id = this._viewRecordId(record);
    const grabbed = Boolean(this._keyboardMove && Object.is(this._keyboardMove.id, id));
    const handle = h('button', {
      class: 'zx-kanban-view__move-handle', type: 'button', draggable: true,
      ariaPressed: String(grabbed), ariaLabel: `Move ${this._recordName(record, index)}`
    }, icon('drag', { size: 13 }));
    const card = createRecordCard(record, index, {
      fields: this.getFields(),
      visibleFields: this.getVisibleFields(),
      titleField: options.titleField,
      subtitleField: options.subtitleField,
      preview: options.preview ?? undefined,
      previewAlt: options.previewAlt,
      link: options.link ?? undefined,
      actions: options.actions,
      selectable: options.selectable,
      selected: this._isViewSelected(id),
      variant: options.variant,
      headingLevel: hasLanes ? 4 : 3,
      controls: [handle]
    });
    card.tabIndex = 0;
    if (grabbed) card.dataset.grabbed = 'true';
    const meta = { record, id, index, column, lane };
    this._cardMeta.set(card, meta);
    this._cardsById.set(id, card);
    return card;
  }

  /** @returns {HTMLElement} */
  _emptyContent() {
    const supplied = typeof this.options.emptyText === 'function' ? this.options.emptyText() : this.options.emptyText;
    const content = supplied ?? 'No records';
    return h('div', { class: 'zx-kanban-view__empty', role: 'status' },
      content && typeof content === 'object' && 'nodeType' in content ? /** @type {Node} */ (content) : String(content));
  }

  /** @returns {KanbanColumn[]} */
  _rawColumns() {
    const options = this._kanbanOptions();
    return this._kanbanColumns === null
      ? deriveKanbanDescriptors(this._viewData, (record, index) => this._readAxis(options.columnBy, record, index))
      : this._kanbanColumns.map((column) => ({ ...column }));
  }

  /** @returns {KanbanColumn[]} */
  _resolvedColumns() {
    const columns = this._rawColumns();
    this._kanbanColumnOrder = reconcileKanbanPreference(
      columns, this._kanbanColumnOrder, this._kanbanColumns === null);
    return orderDescriptors(columns, this._kanbanColumnOrder);
  }

  /** @returns {KanbanSwimlane[]} */
  _rawSwimlanes() {
    const options = this._kanbanOptions();
    if (options.swimlaneBy == null) return [];
    return this._kanbanSwimlanes === null
      ? deriveKanbanDescriptors(this._viewData, (record, index) => this._readAxis(options.swimlaneBy, record, index))
      : this._kanbanSwimlanes.map((lane) => ({ ...lane }));
  }

  /** @returns {KanbanSwimlane[]} */
  _resolvedSwimlanes() {
    const lanes = this._rawSwimlanes();
    const preserveUnknown = this._kanbanSwimlanes === null && this._kanbanOptions().swimlaneBy != null;
    this._kanbanSwimlaneOrder = reconcileKanbanPreference(
      lanes, this._kanbanSwimlaneOrder, preserveUnknown);
    return orderDescriptors(lanes, this._kanbanSwimlaneOrder);
  }

  /** @param {KanbanAccessor} accessor @param {KanbanRecord} record @param {number} index @returns {unknown} */
  _readAxis(accessor, record, index) {
    if (typeof accessor === 'function') return accessor(record, index);
    if (accessor == null) return null;
    const field = this.getFields().find((candidate) => candidate.id === accessor);
    return field ? readViewField(field, record, index) : record?.[accessor];
  }

  /** @param {string} column @param {string|null} lane @returns {{record:KanbanRecord,index:number}[]} */
  _recordsIn(column, lane) {
    const options = this._kanbanOptions();
    const result = [];
    this._viewData.forEach((record, index) => {
      if (normalizeAxisId(this._readAxis(options.columnBy, record, index)) !== column) return;
      if (options.swimlaneBy != null
        && normalizeAxisId(this._readAxis(options.swimlaneBy, record, index)) !== lane) return;
      result.push({ record, index });
    });
    return result;
  }

  /** @param {unknown} id @returns {KanbanMovePoint|null} */
  _recordLocation(id) {
    const options = this._kanbanOptions();
    const index = this._viewData.findIndex((record) => Object.is(this._viewRecordId(record), id));
    if (index < 0) return null;
    const record = this._viewData[index];
    const column = normalizeAxisId(this._readAxis(options.columnBy, record, index));
    const lane = options.swimlaneBy == null
      ? null : normalizeAxisId(this._readAxis(options.swimlaneBy, record, index));
    const within = this._recordsIn(column, lane)
      .findIndex((entry) => Object.is(this._viewRecordId(entry.record), id));
    return { column, lane, index: within };
  }

  /**
   * @param {KanbanRecord} record @param {KanbanMovePoint} from @param {KanbanMovePoint} to
   * @param {KanbanColumn} column @param {KanbanSwimlane|null} lane @returns {KanbanRecord|null}
   */
  _localMovedRecord(record, from, to, column, lane) {
    const options = this._kanbanOptions();
    const clone = { ...record };
    if (from.column !== to.column) {
      if (typeof options.columnBy !== 'string') return null;
      clone[options.columnBy] = Object.prototype.hasOwnProperty.call(column, 'value') ? column.value : column.id;
    }
    if (from.lane !== to.lane) {
      if (typeof options.swimlaneBy !== 'string' || !lane) return null;
      clone[options.swimlaneBy] = Object.prototype.hasOwnProperty.call(lane, 'value') ? lane.value : lane.id;
    }
    const currentIndex = this._viewData.indexOf(record);
    if (normalizeAxisId(this._readAxis(options.columnBy, clone, currentIndex)) !== to.column) return null;
    if (options.swimlaneBy != null
      && normalizeAxisId(this._readAxis(options.swimlaneBy, clone, currentIndex)) !== to.lane) return null;
    return clone;
  }

  /** @param {MouseEvent} event @returns {void} */
  _handleBoardClick(event) {
    const target = elementTarget(event);
    const collapse = target?.closest('[data-kanban-collapse]');
    if (collapse) {
      const element = /** @type {HTMLElement} */ (collapse);
      if (element.dataset.kanbanCollapse === 'column') this.toggleColumn(String(element.dataset.kanbanId));
      else this.toggleSwimlane(String(element.dataset.kanbanId));
      return;
    }
    const meta = this._metaForTarget(target);
    if (!meta) return;
    const selection = /** @type {HTMLInputElement|null} */ (target?.closest('input[data-record-selection]'));
    if (selection) {
      this.toggleSelection(meta.id, { selected: selection.checked, range: event.shiftKey });
      return;
    }
    const actionControl = target?.closest('[data-record-action]');
    if (actionControl) {
      const actionId = /** @type {HTMLElement} */ (actionControl).dataset.recordAction;
      const action = resolveRecordActions(meta.record, meta.index, this._kanbanOptions().actions)
        .find((candidate) => candidate.id === actionId);
      if (!action || action.disabled) {
        event.preventDefault();
        return;
      }
      if (typeof action.onclick === 'function') action.onclick(meta.record, meta.index, event);
      const emitted = this.emit('recordaction', {
        record: meta.record, id: meta.id, index: meta.index, action: { ...action }, event
      });
      if (emitted.defaultPrevented) event.preventDefault();
      return;
    }
    if (target?.closest('.zx-kanban-view__move-handle, .zx-record-card__selection, [data-record-select]')) return;
    if (target?.closest(INTERACTIVE) || hasTextSelection()) return;
    this.emit('recordclick', { ...meta, event });
    if (this.options.selectable === 'single' && !this._isViewSelected(meta.id)) {
      this.setSelection([meta.id]);
    }
  }

  /** @param {MouseEvent} event @returns {void} */
  _handleBoardDoubleClick(event) {
    const target = elementTarget(event);
    const meta = this._metaForTarget(target);
    if (!meta || target?.closest(INTERACTIVE) || hasTextSelection()) return;
    this.emit('recorddblclick', { ...meta, event });
  }

  /** @param {KeyboardEvent} event @returns {void} */
  _handleBoardKeydown(event) {
    const target = elementTarget(event);
    const handle = target?.closest('.zx-kanban-view__move-handle');
    const meta = this._metaForTarget(handle);
    if (handle && meta) {
      this._handleMoveKeydown(event, /** @type {HTMLElement} */ (handle), meta);
      return;
    }
    const card = target?.closest('.zx-record-card');
    const cardMeta = card ? this._cardMeta.get(card) : null;
    if (!cardMeta || target !== card) return;
    if (event.key === 'Enter') {
      event.preventDefault();
      this.emit('recordclick', { ...cardMeta, event });
      if (this.options.selectable === 'single') this.setSelection([cardMeta.id]);
    } else if (event.key === ' ' && this.options.selectable !== false) {
      event.preventDefault();
      this.toggleSelection(cardMeta.id);
    }
  }

  /** @param {KeyboardEvent} event @param {HTMLElement} handle @param {KanbanCardMeta} meta @returns {void} */
  _handleMoveKeydown(event, handle, meta) {
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      if (this._keyboardMove && Object.is(this._keyboardMove.id, meta.id)) {
        const destination = { ...this._keyboardMove.to };
        this._keyboardMove = null;
        handle.setAttribute('aria-pressed', 'false');
        const card = /** @type {HTMLElement|null} */ (handle.closest('.zx-record-card'));
        if (card) delete card.dataset.grabbed;
        this._syncKeyboardTarget();
        this.moveRecord(meta.id, destination);
      } else {
        const from = this._recordLocation(meta.id);
        if (!from) return;
        this._keyboardMove = { id: meta.id, from: { ...from }, to: { ...from } };
        handle.setAttribute('aria-pressed', 'true');
        const card = handle.closest('.zx-record-card');
        if (card) /** @type {HTMLElement} */ (card).dataset.grabbed = 'true';
        this._syncKeyboardTarget();
        this._announce(`Grabbed ${this._recordName(meta.record, meta.index)}. Use left and right for columns, up and down for position, and Alt plus up or down for swim lanes.`);
      }
      return;
    }
    if (event.key === 'Escape' && this._keyboardMove) {
      event.preventDefault();
      const record = this.getRecord(this._keyboardMove.id);
      this._keyboardMove = null;
      handle.setAttribute('aria-pressed', 'false');
      const card = /** @type {HTMLElement|null} */ (handle.closest('.zx-record-card'));
      if (card) delete card.dataset.grabbed;
      this._syncKeyboardTarget();
      this._announce(`Move canceled${record ? ` for ${this._recordName(record, meta.index)}` : ''}.`);
      return;
    }
    if (!this._keyboardMove || !Object.is(this._keyboardMove.id, meta.id)
      || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    const move = this._keyboardMove;
    const laneModifier = event.altKey || event.ctrlKey || event.metaKey;
    if ((event.key === 'ArrowLeft' || event.key === 'ArrowRight') && !laneModifier) {
      const columns = this.getColumnOrder();
      const current = columns.indexOf(move.to.column);
      const next = columns[current + (event.key === 'ArrowLeft' ? -1 : 1)];
      if (next != null) move.to.column = next;
    } else if ((event.key === 'ArrowUp' || event.key === 'ArrowDown')
      && laneModifier && this._kanbanOptions().swimlaneBy != null) {
      const lanes = this.getSwimlaneOrder();
      const current = lanes.indexOf(String(move.to.lane));
      const next = lanes[current + (event.key === 'ArrowUp' ? -1 : 1)];
      if (next != null) move.to.lane = next;
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      move.to.index += event.key === 'ArrowUp' ? -1 : 1;
    }
    const targetCount = this._recordsIn(move.to.column, move.to.lane)
      .filter((entry) => !Object.is(this._viewRecordId(entry.record), move.id)).length;
    move.to.index = normalizeMoveIndex(move.to.index, targetCount);
    this._syncKeyboardTarget();
    this._announce(`Target ${this._targetName(move.to)}, position ${move.to.index + 1} of ${targetCount + 1}.`);
  }

  /** @param {Event} event @returns {void} */
  _handlePreviewError(event) {
    const image = /** @type {HTMLImageElement|null} */ (elementTarget(event)?.closest('img[data-record-preview]'));
    if (!image) return;
    const preview = /** @type {HTMLElement|null} */ (image.closest('.zx-record-card__preview'));
    if (preview) preview.dataset.failed = 'true';
    image.hidden = true;
  }

  /** @param {DragEvent} event @returns {void} */
  _handleDragStart(event) {
    const handle = elementTarget(event)?.closest('.zx-kanban-view__move-handle');
    const meta = this._metaForTarget(handle);
    if (!handle || !meta) {
      event.preventDefault();
      return;
    }
    this._dragId = meta.id;
    const card = handle.closest('.zx-record-card');
    if (card) /** @type {HTMLElement} */ (card).dataset.dragging = 'true';
    event.dataTransfer?.setData('text/plain', 'zx-kanban-record');
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  /** @param {DragEvent} event @returns {void} */
  _handleDragOver(event) {
    if (this._dragId == null) return;
    const section = elementTarget(event)?.closest('.zx-kanban-view__column');
    const sectionMeta = section ? this._sectionMeta.get(section) : null;
    if (!sectionMeta) return;
    event.preventDefault();
    const destination = this._pointerDestination(event, sectionMeta);
    this._dragDestination = destination;
    this._clearDropMarkers();
    const card = elementTarget(event)?.closest('.zx-record-card');
    const cardMeta = card ? this._cardMeta.get(card) : null;
    if (card && cardMeta && !Object.is(cardMeta.id, this._dragId)) {
      const rectangle = card.getBoundingClientRect();
      /** @type {HTMLElement} */ (card).dataset.drop = event.clientY >= rectangle.top + rectangle.height / 2
        ? 'after' : 'before';
    } else {
      sectionMeta.list.dataset.drop = 'append';
    }
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
  }

  /** @param {DragEvent} event @returns {void} */
  _handleDrop(event) {
    if (this._dragId == null || !this._dragDestination) return;
    event.preventDefault();
    const id = this._dragId;
    const destination = { ...this._dragDestination };
    this._clearDrag();
    this.moveRecord(id, destination);
  }

  /** @param {DragEvent} event @param {KanbanSectionMeta} section @returns {KanbanMovePoint} */
  _pointerDestination(event, section) {
    const cards = [...section.list.querySelectorAll(':scope > .zx-record-card')]
      .filter((card) => !Object.is(this._cardMeta.get(card)?.id, this._dragId));
    const target = elementTarget(event)?.closest('.zx-record-card');
    const targetMeta = target ? this._cardMeta.get(target) : null;
    if (target && targetMeta && Object.is(targetMeta.id, this._dragId)) {
      const from = this._recordLocation(this._dragId);
      return { column: section.column, lane: section.lane, index: from?.index ?? cards.length };
    }
    const targetIndex = target ? cards.indexOf(target) : -1;
    if (targetIndex < 0) return { column: section.column, lane: section.lane, index: cards.length };
    const rectangle = target.getBoundingClientRect();
    return {
      column: section.column, lane: section.lane,
      index: targetIndex + (event.clientY >= rectangle.top + rectangle.height / 2 ? 1 : 0)
    };
  }

  /** @returns {void} */
  _clearDrag() {
    this._clearDropMarkers();
    for (const card of this._board.querySelectorAll('[data-dragging]')) delete /** @type {HTMLElement} */ (card).dataset.dragging;
    this._dragId = null;
    this._dragDestination = null;
  }

  /** @returns {void} */
  _clearDropMarkers() {
    for (const element of this._board.querySelectorAll('[data-drop]')) delete /** @type {HTMLElement} */ (element).dataset.drop;
  }

  /** @returns {void} */
  _syncKeyboardTarget() {
    for (const element of this._board.querySelectorAll('[data-keyboard-target]')) {
      delete /** @type {HTMLElement} */ (element).dataset.keyboardTarget;
    }
    const move = this._keyboardMove;
    if (!move) return;
    const section = [...this._board.querySelectorAll('.zx-kanban-view__column')]
      .find((candidate) => {
        const meta = this._sectionMeta.get(candidate);
        return meta?.column === move.to.column && meta?.lane === move.to.lane;
      });
    const sectionMeta = section ? this._sectionMeta.get(section) : null;
    if (!sectionMeta) return;
    const cards = [...sectionMeta.list.querySelectorAll(':scope > .zx-record-card')]
      .filter((card) => !Object.is(this._cardMeta.get(card)?.id, move.id));
    const target = cards[move.to.index];
    if (target) /** @type {HTMLElement} */ (target).dataset.keyboardTarget = 'before';
    else sectionMeta.list.dataset.keyboardTarget = 'append';
  }

  /** @returns {void} */
  _syncCardSelection() {
    for (const [id, card] of this._cardsById) {
      const selected = this._isViewSelected(id);
      card.dataset.selected = String(selected);
      if (this.options.selectable) card.setAttribute('aria-description', selected ? 'Selected' : 'Not selected');
      const input = /** @type {HTMLInputElement|null} */ (card.querySelector('[data-record-selection]'));
      if (input) input.checked = selected;
    }
  }

  /** @param {EventTarget|null} target @returns {KanbanCardMeta|null} */
  _metaForTarget(target) {
    const card = elementTarget({ target })?.closest('.zx-record-card');
    return card ? this._cardMeta.get(card) ?? null : null;
  }

  /** @param {unknown} id @returns {HTMLElement|null} */
  _moveHandle(id) {
    return /** @type {HTMLElement|null} */ (this._cardsById.get(id)?.querySelector('.zx-kanban-view__move-handle') ?? null);
  }

  /**
   * Resolves a collapse control after a board refresh, retaining the same lane copy for columns.
   * @param {'column'|'swimlane'} axis Collapse axis.
   * @param {string} id Descriptor id.
   * @param {string|null} [lane=null] Column copy's lane.
   * @returns {HTMLElement|null}
   */
  _collapseControl(axis, id, lane = null) {
    return /** @type {HTMLElement|null} */ ([...this._board.querySelectorAll('[data-kanban-collapse]')]
      .find((candidate) => {
        const control = /** @type {HTMLElement} */ (candidate);
        if (control.dataset.kanbanCollapse !== axis || control.dataset.kanbanId !== id) return false;
        if (axis !== 'column') return true;
        const section = control.closest('.zx-kanban-view__column');
        return section ? this._sectionMeta.get(section)?.lane === lane : false;
      }) ?? null);
  }

  /** @param {KanbanRecord} record @param {number} index @returns {string} */
  _recordName(record, index) {
    const source = this._kanbanOptions().titleField;
    const value = typeof source === 'function' ? source(record, index) : typeof source === 'string'
      ? this._readAxis(source, record, index) : this._viewRecordId(record);
    if (value && typeof value === 'object' && 'nodeType' in value) {
      return /** @type {Node} */ (value).textContent?.trim() || 'record';
    }
    return String(value ?? 'record');
  }

  /** @param {KanbanMovePoint} point @returns {string} */
  _targetName(point) {
    const column = this._resolvedColumns().find((candidate) => candidate.id === point.column);
    const lane = point.lane == null ? null
      : this._resolvedSwimlanes().find((candidate) => candidate.id === point.lane);
    return `${column?.label ?? point.column}${lane ? `, ${lane.label}` : ''}`;
  }

  /** @param {string} message @returns {void} */
  _announce(message) {
    const token = ++this._announcementToken;
    this._live.textContent = '';
    queueMicrotask(() => {
      if (token === this._announcementToken && this._live?.isConnected) this._live.textContent = message;
    });
  }

  /** @param {string} reason @returns {void} */
  _emitKanbanState(reason) {
    this.emit('statechange', { state: this.getViewState(), reason });
  }

  /** @returns {Readonly<KanbanViewOptions & RecordViewOptions>} */
  _kanbanOptions() {
    return /** @type {Readonly<KanbanViewOptions & RecordViewOptions>} */ (this.options);
  }
}

/**
 * Validates and clones configured column or lane descriptors.
 * @param {unknown} descriptors Descriptors.
 * @param {'column'|'swimlane'} [axis='column'] Descriptor kind.
 * @returns {KanbanColumn[]}
 */
export function normalizeKanbanDescriptors(descriptors, axis = 'column') {
  if (!Array.isArray(descriptors)) throw new TypeError(`Kanban ${axis}s must be an array or null`);
  const seen = new Set();
  return /** @type {KanbanColumn[]} */ (descriptors.map((descriptor, index) => {
    if (!descriptor || typeof descriptor !== 'object' || Array.isArray(descriptor)) {
      throw new TypeError(`Kanban ${axis} at index ${index} must be an object`);
    }
    const source = /** @type {Record<string, any>} */ (descriptor);
    const id = String(source.id ?? '').trim();
    if (!id && source.id !== '') throw new TypeError(`Kanban ${axis} at index ${index} requires an id`);
    if (seen.has(id)) throw new TypeError(`Duplicate Kanban ${axis}: ${id}`);
    if (source.accept != null && typeof source.accept !== 'function') {
      throw new TypeError(`Kanban ${axis} ${id} accept must be a function`);
    }
    seen.add(id);
    const normalized = /** @type {Record<string, any>} */ ({
      ...source,
      id,
      label: String(source.label ?? axisLabel(source.id)),
      ...(Object.prototype.hasOwnProperty.call(source, 'value') ? {} : { value: source.id })
    });
    if (axis === 'column') normalized.limit = normalizeLimit(source.limit);
    else delete normalized.limit;
    return normalized;
  }));
}

/**
 * Derives stable descriptors from distinct accessor values in first-seen order.
 * @param {KanbanRecord[]} records Records.
 * @param {KanbanAccessor} accessor Grouping accessor.
 * @returns {KanbanColumn[]}
 */
export function deriveKanbanDescriptors(records, accessor) {
  const result = [];
  const seen = new Set();
  records.forEach((record, index) => {
    const value = readKanbanAccessor(record, index, accessor);
    const id = normalizeAxisId(value);
    if (seen.has(id)) return;
    seen.add(id);
    result.push({ id, label: axisLabel(value), value, limit: null });
  });
  return result;
}

/**
 * Reconciles a stale or partial order with available descriptors.
 * @param {{id:string}[]} descriptors Available descriptors.
 * @param {unknown} order Preferred order.
 * @returns {string[]}
 */
export function reconcileKanbanOrder(descriptors, order) {
  const available = descriptors.map((descriptor) => descriptor.id);
  const allowed = new Set(available);
  const preferred = normalizeOrder(order).filter((id) => allowed.has(id));
  return [...new Set(preferred), ...available.filter((id) => !preferred.includes(id))];
}

/**
 * Reconciles the visible descriptor order while optionally retaining preferences for derived axes
 * that are absent from the current result set. This lets saved state be applied before an async
 * query supplies the records from which columns or lanes are derived.
 * @param {{id:string}[]} descriptors Available descriptors.
 * @param {unknown} order Preferred order.
 * @param {boolean} [preserveUnknown=false] Retain temporarily unavailable ids.
 * @returns {string[]}
 */
export function reconcileKanbanPreference(descriptors, order, preserveUnknown = false) {
  if (!preserveUnknown) return reconcileKanbanOrder(descriptors, order);
  const preferred = normalizeOrder(order);
  const available = descriptors.map((descriptor) => descriptor.id);
  return [...preferred, ...available.filter((id) => !preferred.includes(id))];
}

/**
 * Reorders records around an already-cloned moved record. The input array and every input record
 * remain untouched; destination index is relative to records in that one column/lane.
 * @param {KanbanRecord[]} records Records.
 * @param {unknown} id Moving record id.
 * @param {KanbanRecord} movedRecord Cloned record carrying its destination axis values.
 * @param {{recordId:string|((record:KanbanRecord)=>unknown),columnBy:KanbanAccessor,swimlaneBy:KanbanAccessor,destination:KanbanMovePoint}} options Accessors and destination.
 * @returns {{records:KanbanRecord[],from:KanbanMovePoint,to:KanbanMovePoint}|null}
 */
export function reorderKanbanData(records, id, movedRecord, options) {
  if (!Array.isArray(records) || !movedRecord || typeof movedRecord !== 'object') return null;
  const sourceIndex = records.findIndex((record) => Object.is(viewRecordId(record, options.recordId), id));
  if (sourceIndex < 0) return null;
  const source = records[sourceIndex];
  const sourceColumn = normalizeAxisId(readKanbanAccessor(source, sourceIndex, options.columnBy));
  const sourceLane = options.swimlaneBy == null ? null
    : normalizeAxisId(readKanbanAccessor(source, sourceIndex, options.swimlaneBy));
  const sourceGroup = records.filter((record, index) =>
    normalizeAxisId(readKanbanAccessor(record, index, options.columnBy)) === sourceColumn
    && (options.swimlaneBy == null
      || normalizeAxisId(readKanbanAccessor(record, index, options.swimlaneBy)) === sourceLane));
  const from = {
    column: sourceColumn, lane: sourceLane,
    index: sourceGroup.findIndex((record) => Object.is(viewRecordId(record, options.recordId), id))
  };
  const next = records.filter((_, index) => index !== sourceIndex);
  const destinationRecords = next.filter((record, index) =>
    normalizeAxisId(readKanbanAccessor(record, index, options.columnBy)) === options.destination.column
    && (options.swimlaneBy == null
      || normalizeAxisId(readKanbanAccessor(record, index, options.swimlaneBy)) === options.destination.lane));
  const targetIndex = normalizeMoveIndex(options.destination.index, destinationRecords.length);
  let insertion = next.length;
  if (destinationRecords[targetIndex]) insertion = next.indexOf(destinationRecords[targetIndex]);
  else if (destinationRecords.length) insertion = next.indexOf(destinationRecords.at(-1)) + 1;
  next.splice(insertion, 0, movedRecord);
  return {
    records: next,
    from,
    to: { column: options.destination.column, lane: options.swimlaneBy == null ? null : options.destination.lane, index: targetIndex }
  };
}

/** @param {KanbanRecord} record @param {number} index @param {KanbanAccessor} accessor @returns {unknown} */
function readKanbanAccessor(record, index, accessor) {
  return typeof accessor === 'function' ? accessor(record, index) : accessor == null ? null : record?.[accessor];
}

/** @param {unknown} value @returns {string} */
function normalizeAxisId(value) {
  return value == null ? '' : String(value);
}

/** @param {unknown} value @returns {string} */
function axisLabel(value) {
  if (value == null || String(value).trim() === '') return 'Unassigned';
  return String(value);
}

/** @param {unknown} value @returns {number|null} */
function normalizeLimit(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw new TypeError('Kanban column limit must be a non-negative number');
  return Math.floor(number);
}

/** @param {unknown} value @param {number} maximum @returns {number} */
function normalizeMoveIndex(value, maximum) {
  if (value == null || !Number.isFinite(Number(value))) return maximum;
  return Math.max(0, Math.min(maximum, Math.trunc(Number(value))));
}

/** @param {unknown} value @returns {string[]} */
function normalizeOrder(value) {
  return Array.isArray(value) ? [...new Set(value.map(String))] : [];
}

/** @template {{id:string}} T @param {T[]} descriptors @param {string[]} order @returns {T[]} */
function orderDescriptors(descriptors, order) {
  const byId = new Map(descriptors.map((descriptor) => [descriptor.id, descriptor]));
  return order.map((id) => byId.get(id)).filter(Boolean);
}

/** @param {string[]} order @param {string} id @param {string} targetId @param {'before'|'after'} position @returns {string[]} */
function moveOrderedId(order, id, targetId, position) {
  const next = [...order];
  const from = next.indexOf(String(id));
  if (from < 0 || !next.includes(String(targetId)) || String(id) === String(targetId)) return next;
  next.splice(from, 1);
  const target = next.indexOf(String(targetId));
  next.splice(target + (position === 'after' ? 1 : 0), 0, String(id));
  return next;
}

/**
 * Replaces only the currently resolved axis positions inside a retained preference. Temporarily
 * absent derived ids keep their relative slots until later data makes them available again.
 * @param {string[]} preference Full retained preference.
 * @param {{id:string}[]} descriptors Currently available descriptors.
 * @param {string[]} resolvedOrder Next order for available descriptors.
 * @param {boolean} preserveUnknown Whether unavailable ids should be retained.
 * @returns {string[]}
 */
function mergeKanbanResolvedOrder(preference, descriptors, resolvedOrder, preserveUnknown) {
  if (!preserveUnknown) return [...resolvedOrder];
  const available = new Set(descriptors.map((descriptor) => descriptor.id));
  const replacements = [...resolvedOrder];
  let cursor = 0;
  const merged = normalizeOrder(preference).flatMap((id) => {
    if (!available.has(id)) return [id];
    return cursor < replacements.length ? [replacements[cursor++]] : [];
  });
  merged.push(...replacements.slice(cursor));
  return normalizeOrder(merged);
}

/** @param {KanbanMovePoint} left @param {KanbanMovePoint} right @returns {boolean} */
function sameMovePoint(left, right) {
  return left.column === right.column && left.lane === right.lane && left.index === right.index;
}

/** @param {unknown[]} left @param {unknown[]} right @returns {boolean} */
function sameArray(left, right) {
  return left.length === right.length && left.every((value, index) => Object.is(value, right[index]));
}

/** @param {{target?:EventTarget|null}|Event} event @returns {Element|null} */
function elementTarget(event) {
  const target = event.target;
  if (!target) return null;
  return target instanceof Element ? target : /** @type {Node} */ (target).parentElement;
}

/** @returns {boolean} */
function hasTextSelection() {
  const selection = globalThis.getSelection?.();
  return Boolean(selection && !selection.isCollapsed && String(selection).trim());
}

/**
 * Record movement event emitted before a local commit or external request.
 * @event KanbanView#recordmove
 * @type {CustomEvent<{record:KanbanRecord,id:unknown,from:KanbanMovePoint,to:KanbanMovePoint,column:KanbanColumn,swimlane:KanbanSwimlane|null,limitExceeded:boolean}>}
 */

/**
 * Secondary card action event.
 * @event KanbanView#recordaction
 * @type {CustomEvent<{record:KanbanRecord,id:unknown,action:unknown,actionId:string|undefined,event:Event}>}
 */
