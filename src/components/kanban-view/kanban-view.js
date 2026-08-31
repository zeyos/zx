// @ts-check
import { h, restoreTarget, snapshotTarget } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { printf } from '../../core/i18n.js';
import { uid } from '../../core/util.js';
import { badge } from '../badge/badge.js';
import { createRecordCard, resolveRecordActions } from '../card-view/record-card.js';
import { ContextMenu } from '../context-menu/context-menu.js';
import { RecordView, readViewField, viewRecordId } from '../view/record-view.js';
import {
  absoluteKanbanIndex, allowsKanbanTransition, clampKanbanIndex, createKanbanHistory,
  evaluateKanbanMove, kanbanSearchTerms, locateKanbanRecord, matchesKanbanSearch, normalizeAxisId,
  normalizeKanbanRules, readKanbanAccessor, reorderKanbanRecords, resolveKanbanRules
} from './kanban-policy.js';

/** @typedef {Record<string, any>} KanbanRecord */
/** @typedef {import('../view/record-view.js').RecordViewOptions} RecordViewOptions */
/** @typedef {import('../card-view/record-card.js').RecordCardPreview} RecordCardPreview */
/** @typedef {import('../card-view/record-card.js').RecordCardLink} RecordCardLink */
/** @typedef {import('../card-view/record-card.js').RecordCardAction} RecordCardAction */
/** @typedef {import('../menu-button/menu-button.js').MenuItem} MenuItem */
/** @typedef {import('./kanban-policy.js').KanbanRule} KanbanRule */
/** @typedef {import('./kanban-policy.js').KanbanRejectReason} KanbanRejectReason */
/** @typedef {import('./kanban-policy.js').KanbanMoveEvaluation} KanbanMoveEvaluation */
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
 * @property {number|null} [limit=null] Work-in-progress limit across every lane.
 * @property {Record<string, number>} [laneLimits] Per-lane limits inside this column.
 * @property {'warn'|'block'} [wipPolicy] Overrides the board `wipPolicy` for this column.
 * @property {string[]|null} [from=null] Origin column ids allowed to move in. `null`, an absent
 * value, or `['*']` admits any origin; a move that stays in the column is never restricted.
 * @property {(record: KanbanRecord, context: KanbanMoveContext) => boolean} [accept] Eligibility
 * predicate. Returning false rejects the move before the cancelable event is emitted.
 */

/**
 * @typedef {Object} KanbanSwimlane
 * @property {string} id Stable lane id.
 * @property {string} label Visible lane label.
 * @property {unknown} [value] Value written by local moves; defaults to `id`.
 * @property {number|null} [limit=null] Work-in-progress limit across every column in the lane.
 * @property {string[]|null} [from=null] Origin lane ids allowed to move in.
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
 * @typedef {Object} KanbanCardContext
 * @property {KanbanRecord} record Record being rendered.
 * @property {unknown} id Record id.
 * @property {number} index Display index in the current record order.
 * @property {string} column Column id.
 * @property {string|null} lane Lane id, or null when lanes are disabled.
 * @property {KanbanRule[]} rules Rules matching this record, in configured order.
 * @property {boolean} selected Whether the record is selected.
 */

/**
 * @typedef {Object} KanbanHeaderContext
 * @property {KanbanColumn} [column] Column being rendered.
 * @property {KanbanSwimlane|null} [swimlane] Lane being rendered, or the lane a column belongs to.
 * @property {number} count Records rendered in this section.
 * @property {number} total Records this section holds before search and filters.
 * @property {number} columnTotal Records in the whole column, across lanes.
 * @property {number|null} limit Applicable work-in-progress limit.
 * @property {'none'|'within'|'limit'|'exceeded'} wip Capacity state.
 * @property {boolean} collapsed Whether the section is collapsed.
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
 * @property {'card'|'handle'} [dragFrom='card'] Whether the whole card or only its handle starts a
 * pointer drag. Touch drags from the card body require a long press so the board still scrolls.
 * @property {boolean} [multiMove=true] Move the whole selection when a selected card is picked up.
 * @property {boolean} [autoScroll=true] Scroll the board and columns while dragging near an edge.
 * @property {'warn'|'block'} [wipPolicy='warn'] Whether exceeding a limit warns or refuses.
 * @property {KanbanRule[]} [rules=[]] Ordered visual card rules.
 * @property {string} [search=''] Board search text.
 * @property {string[]|null} [searchFields=null] Field ids searched; null searches visible fields
 * plus the title and subtitle sources.
 * @property {((record:KanbanRecord,index:number)=>boolean)|null} [filter=null] Extra card predicate.
 * @property {boolean} [searchControl=false] Render the built-in board search control.
 * @property {boolean} [history=true] Record committed local moves for undo and redo.
 * @property {number} [historyLimit=50] Maximum remembered move steps.
 * @property {boolean} [historyControls=false] Render built-in undo and redo controls.
 * @property {string|null} [columnHeight=null] CSS length turning each column into a scroll region.
 * @property {boolean|((column:KanbanColumn,swimlane:KanbanSwimlane|null)=>boolean)} [allowAdd=false]
 * Render a per-column add control that emits `recordadd`.
 * @property {boolean|MenuItem[]|((context:KanbanCardContext)=>MenuItem[])} [contextMenu=false]
 * Card context menu. `true` offers move commands; an array or function appends application items.
 * @property {((context:KanbanCardContext)=>Node|null|undefined)|null} [renderCard=null] Replaces card content.
 * @property {((context:KanbanHeaderContext)=>Node|null|undefined)|null} [renderColumnHeader=null] Replaces column header content.
 * @property {((context:KanbanHeaderContext)=>Node|null|undefined)|null} [renderSwimlaneHeader=null] Replaces lane header content.
 * @property {((context:KanbanHeaderContext)=>Node|null|undefined)|null} [renderColumnEmpty=null] Empty-column placeholder.
 * @property {((context:{records:KanbanRecord[],ids:unknown[],count:number})=>Node|null|undefined)|null} [renderDragPreview=null] Replaces the floating drag preview.
 * @property {Record<string,string>} [labels={}] Overrides for every visible and announced string.
 * @property {string[]} [columnOrder=[]] Preferred column order.
 * @property {string[]} [swimlaneOrder=[]] Preferred swim-lane order.
 * @property {string[]} [collapsedColumns=[]] Initially collapsed columns.
 * @property {string[]} [collapsedSwimlanes=[]] Initially collapsed lanes.
 * @property {boolean} [showCounts=true] Show record counts and WIP indicators.
 * @property {boolean} [showEmptyColumns=true] Keep configured empty columns visible.
 * @property {'outlined'|'raised'|'filled'} [variant='outlined'] Shared record-card treatment.
 * @property {string} [label='Kanban board'] Accessible board label.
 * @property {(event: CustomEvent<Record<string,unknown>>) => void} [onrecordmove]
 * @property {(event: CustomEvent<Record<string,unknown>>) => void} [onmovereject]
 * @property {(event: CustomEvent<Record<string,unknown>>) => void} [onrecordaction]
 * @property {(event: CustomEvent<Record<string,unknown>>) => void} [onrecordadd]
 * @property {(event: CustomEvent<{search:string}>) => void} [onsearchchange]
 * @property {(event: CustomEvent<{canUndo:boolean,canRedo:boolean,depth:{undo:number,redo:number}}>) => void} [onhistorychange]
 */

/** @typedef {{record:KanbanRecord,id:unknown,index:number,column:string,lane:string|null}} KanbanCardMeta */
/** @typedef {{column:string,lane:string|null,list:HTMLElement}} KanbanSectionMeta */
/** @typedef {{ids:unknown[],from:KanbanMovePoint,to:KanbanMovePoint}} KanbanKeyboardMove */

const INTERACTIVE = 'a, button, input, select, textarea, summary, [contenteditable="true"]';

/** Distance a pointer must travel before a press becomes a drag rather than a click. */
const DRAG_THRESHOLD = 4;

/** Delay before a touch press on a card body becomes a drag instead of a scroll. */
const TOUCH_HOLD = 350;

/** Keystrokes are coalesced for this long before the built-in search control rebuilds the board. */
const SEARCH_DEBOUNCE = 120;

/** Distance from a scroll edge at which a drag starts auto-scrolling, and the speed it uses. */
const SCROLL_EDGE = 56;
const SCROLL_SPEED = 18;

/**
 * Every user-visible and announced string, so a host can translate the board without patching it.
 * Values run through `printf`, so named placeholders may be reordered or dropped by a translation.
 */
const DEFAULT_LABELS = Object.freeze({
  fields: 'Fields',
  search: 'Search board',
  searchPlaceholder: 'Search cards',
  clearSearch: 'Clear search',
  searchSummary: '%count% of %total% cards match.',
  undo: 'Undo',
  redo: 'Redo',
  add: 'Add card',
  addTo: 'Add card to %target%',
  move: 'Move %name%',
  moveMultiple: 'Move %count% selected cards',
  collapseColumn: 'Collapse column %label%',
  expandColumn: 'Expand column %label%',
  collapseLane: 'Collapse swim lane %label%',
  expandLane: 'Expand swim lane %label%',
  count: '%count% records',
  countFiltered: '%count% of %total% records',
  countLimit: '%count% records, work-in-progress limit %limit%',
  countLimitInLane: '%count% records in this lane, %total% of work-in-progress limit %limit% in the column',
  empty: 'No records',
  columnEmpty: '',
  selected: 'Selected',
  notSelected: 'Not selected',
  noMatches: 'No cards match the current search.',
  record: 'record',
  grabbed: 'Grabbed %name%. Use left and right for columns, up and down for position, and Alt plus up or down for swim lanes.',
  grabbedMultiple: 'Grabbed %count% cards. Use left and right for columns, up and down for position, and Alt plus up or down for swim lanes.',
  target: 'Target %target%, position %position% of %total%.',
  moved: 'Moved %name% to %target%.%wip%',
  movedMultiple: 'Moved %count% cards to %target%.%wip%',
  moveRequested: 'Move requested for %name% to %target%.%wip%',
  moveCanceled: 'Move canceled for %name%.',
  moveCanceledPlain: 'Move canceled.',
  limitReached: ' Work-in-progress limit %limit% reached.',
  limitExceeded: ' Work-in-progress limit %limit% exceeded.',
  rejectAccept: 'Move rejected: %target% does not accept %name%.',
  rejectTransition: 'Move rejected: %target% does not accept cards from %origin%.',
  rejectWip: 'Move rejected: %target% is at its work-in-progress limit of %limit%.',
  rejectDestination: 'Move rejected: the destination is not available.',
  rejectGrouping: 'Move rejected: callback grouping requires external move mode.',
  undone: 'Move undone.',
  redone: 'Move redone.',
  nothingToUndo: 'Nothing to undo.',
  nothingToRedo: 'Nothing to redo.',
  menuMoveTo: 'Move to %target%',
  menuMoveToLane: 'Move to lane %target%',
  dragPreview: '%count% cards'
});

/**
 * Configurable record board with semantic columns, optional swim lanes, and equivalent pointer,
 * touch, keyboard, context-menu, and programmatic movement. Local moves clone records; callback
 * grouping remains fully usable for display and external moves but cannot be written safely by
 * local cross-axis moves.
 * @fires KanbanView#recordmove
 * @fires KanbanView#movereject
 * @fires KanbanView#recordaction
 * @fires KanbanView#recordadd
 * @fires KanbanView#searchchange
 * @fires KanbanView#historychange
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
    dragFrom: 'card',
    multiMove: true,
    autoScroll: true,
    wipPolicy: 'warn',
    rules: [],
    search: '',
    searchFields: null,
    filter: null,
    searchControl: false,
    history: true,
    historyLimit: 50,
    historyControls: false,
    columnHeight: null,
    allowAdd: false,
    contextMenu: false,
    renderCard: null,
    renderColumnHeader: null,
    renderSwimlaneHeader: null,
    renderColumnEmpty: null,
    renderDragPreview: null,
    labels: {},
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
      this._kanbanRules = normalizeKanbanRules(options.rules);
      this._kanbanSearch = options.search == null ? '' : String(options.search);
      this._kanbanFilter = typeof options.filter === 'function' ? options.filter : null;
      this._kanbanHistory = createKanbanHistory(options.historyLimit);
      this._keyboardMove = /** @type {KanbanKeyboardMove|null} */ (null);
      this._dragIds = /** @type {unknown[]} */ ([]);
      this._dragDestination = /** @type {KanbanMovePoint|null} */ (null);
      this._pointerStart = /** @type {{x:number,y:number,id:number,ids:unknown[],touch:boolean}|null} */ (null);
      this._pointerHold = 0;
      this._dragFrame = 0;
      this._dragPreview = /** @type {HTMLElement|null} */ (null);
      this._dragPointer = /** @type {number|null} */ (null);
      this._dragCaptured = false;
      this._searchTimer = 0;
      this._dragPoint = { x: 0, y: 0 };
      this._suppressClick = false;
      this._announcementToken = 0;
      this._cardMeta = new WeakMap();
      this._sectionMeta = new WeakMap();
      this._cardsById = new Map();
      this._visibleIds = new Set();
      this._kanbanMenu = /** @type {ContextMenu|null} */ (null);
      this._searchInput = /** @type {HTMLInputElement|null} */ (null);
      this._undoButton = /** @type {HTMLButtonElement|null} */ (null);
      this._redoButton = /** @type {HTMLButtonElement|null} */ (null);

      this._toolbar = h('div', { class: 'zx-record-view__toolbar zx-kanban-view__toolbar' });
      if (options.fieldControls) this._toolbar.append(this._createViewFieldControls(this._text('fields')));
      if (options.searchControl) this._toolbar.append(this._createSearchControl());
      if (options.historyControls) this._toolbar.append(this._createHistoryControls());
      this._board = h('div', {
        class: 'zx-kanban-view__board', role: 'region', ariaLabel: options.label
      });
      this._live = h('div', {
        class: 'zx-kanban-view__live', role: 'status', ariaLive: 'polite', ariaAtomic: 'true'
      });
      root.replaceChildren(this._toolbar, this._board, this._live);
      if (options.columnHeight) {
        root.style.setProperty('--zx-kanban-column-height', String(options.columnHeight));
        root.dataset.columnScroll = 'true';
      }

      this.listen(this._board, 'click', (event) => this._handleBoardClick(/** @type {MouseEvent} */ (event)));
      this.listen(this._board, 'dblclick', (event) => this._handleBoardDoubleClick(/** @type {MouseEvent} */ (event)));
      this.listen(this._board, 'keydown', (event) => this._handleBoardKeydown(/** @type {KeyboardEvent} */ (event)));
      this.listen(this._board, 'error', (event) => this._handlePreviewError(event), { capture: true });
      this.listen(this._board, 'pointerdown', (event) => this._handlePointerDown(/** @type {PointerEvent} */ (event)));
      this.listen(this._board, 'pointermove', (event) => this._handlePointerMove(/** @type {PointerEvent} */ (event)));
      this.listen(this._board, 'pointerup', (event) => this._handlePointerUp(/** @type {PointerEvent} */ (event)));
      this.listen(this._board, 'pointercancel', () => this._clearDrag());
      // Native drag would fight the pointer path and cannot serve touch at all; suppress the
      // browser's own text and image dragging so only one movement model is ever in flight.
      this.listen(this._board, 'dragstart', (event) => event.preventDefault());
      this._refreshView('init');
      if (options.contextMenu) this._createContextMenu();
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
   * Proposes and, in local mode, commits a record move. Equivalent to `moveRecords([id], …)`.
   * @param {unknown} id Record id.
   * @param {KanbanDestination} destination Destination.
   * @returns {this}
   * @fires KanbanView#recordmove
   * @fires KanbanView#movereject
   * @fires RecordView#datachange
   */
  moveRecord(id, destination) {
    return this.moveRecords([id], destination);
  }

  /**
   * Proposes and, in local mode, commits an atomic move of one or more records. Destination
   * eligibility, transition rules, and work-in-progress policy are all checked before a single
   * cancelable `recordmove` event; the move commits completely or not at all, and the moving
   * records keep their relative order at the destination.
   * @param {unknown[]} ids Record ids, in any order.
   * @param {KanbanDestination} destination Destination.
   * @returns {this}
   * @fires KanbanView#recordmove
   * @fires KanbanView#movereject
   * @fires RecordView#datachange
   */
  moveRecords(ids, destination) {
    const options = this._kanbanOptions();
    if (!Array.isArray(ids) || !destination || typeof destination !== 'object') return this;
    const moving = this._orderedIds(ids);
    if (!moving.length) return this;
    const records = moving.map((id) => /** @type {KanbanRecord} */ (this.getRecord(id)));
    const origins = moving.map((id) => /** @type {KanbanMovePoint} */ (this._recordLocation(id)));
    const from = origins[0];
    const columns = this._resolvedColumns();
    const lanes = this._resolvedSwimlanes();
    const columnId = destination.column == null ? from.column : String(destination.column);
    const laneId = options.swimlaneBy == null
      ? null : destination.lane === undefined ? from.lane : normalizeAxisId(destination.lane);
    const column = columns.find((candidate) => candidate.id === columnId);
    const lane = options.swimlaneBy == null
      ? null : lanes.find((candidate) => candidate.id === laneId) ?? null;
    if (!column || options.swimlaneBy != null && !lane) {
      this._rejectMove('destination', { ids: moving, records, from, to: null, column: null, swimlane: null });
      return this;
    }

    const excluded = new Set(moving);
    const cellCount = this._recordsIn(columnId, laneId)
      .filter((entry) => !excluded.has(this._viewRecordId(entry.record))).length;
    const index = clampKanbanIndex(destination.index, cellCount);
    const to = { column: columnId, lane: laneId, index };
    if (moving.length === 1 && sameMovePoint(from, to)) return this;
    const context = {
      id: moving[0], from: { ...from }, to: { ...to },
      column: { ...column }, swimlane: lane ? { ...lane } : null
    };
    const evaluation = this._evaluateMove(records, origins, column, lane, to, context, excluded);
    if (!evaluation.allowed) {
      this._rejectMove(/** @type {KanbanRejectReason} */ (evaluation.reason), {
        ids: moving, records, from, to, column, swimlane: lane, evaluation
      });
      return this;
    }

    const entries = [];
    for (let position = 0; position < moving.length; position += 1) {
      const record = records[position];
      const moved = options.moveMode === 'local'
        ? this._localMovedRecord(record, origins[position], to, column, lane) : record;
      if (!moved) {
        this._rejectMove('grouping', { ids: moving, records, from, to, column, swimlane: lane });
        return this;
      }
      entries.push({ id: moving[position], record: moved });
    }
    const next = reorderKanbanRecords(this._viewData, entries, {
      recordId: options.recordId,
      columnBy: (candidate, candidateIndex) => this._readAxis(options.columnBy, candidate, candidateIndex),
      swimlaneBy: options.swimlaneBy == null ? null
        : (candidate, candidateIndex) => this._readAxis(options.swimlaneBy, candidate, candidateIndex),
      destination: to
    });
    if (!next) {
      this._rejectMove('destination', { ids: moving, records, from, to, column, swimlane: lane });
      return this;
    }

    const wip = this._wipAnnouncement(evaluation);
    const moveEvent = this.emit('recordmove', {
      record: records[0], id: moving[0], records: [...records], ids: [...moving],
      moves: next.moves.map((move) => ({ id: move.id, from: { ...move.from } })),
      from: { ...from }, to: { ...next.to }, column: { ...column },
      swimlane: lane ? { ...lane } : null, limitExceeded: evaluation.limitExceeded
    }, { honorDomCancellation: true });
    if (moveEvent.defaultPrevented) {
      this._announce(this._text('moveCanceled', { name: this._movingName(records) }));
      return this;
    }
    if (options.moveMode === 'external') {
      this._announce(this._text('moveRequested', {
        name: this._movingName(records), target: this._targetName(next.to), wip
      }));
      return this;
    }
    this._commitLocalRecords(next.records);
    this._announce(moving.length > 1
      ? this._text('movedMultiple', { count: moving.length, target: this._targetName(next.to), wip })
      : this._text('moved', {
        name: this._recordName(entries[0].record, next.to.index), target: this._targetName(next.to), wip
      }));
    queueMicrotask(() => this._moveHandle(moving[0])?.focus());
    return this;
  }

  /** Whether a committed local move can be reverted. @returns {boolean} */
  canUndo() {
    return this._kanbanOptions().history !== false && this._kanbanHistory.canUndo();
  }

  /** Whether a reverted local move can be reapplied. @returns {boolean} */
  canRedo() {
    return this._kanbanOptions().history !== false && this._kanbanHistory.canRedo();
  }

  /**
   * Reverts the last committed local move, restoring the exact record order and selection.
   * @returns {this}
   * @fires RecordView#datachange
   * @fires KanbanView#historychange
   */
  undo() {
    return this._travelHistory('undo');
  }

  /**
   * Reapplies the last reverted local move.
   * @returns {this}
   * @fires RecordView#datachange
   * @fires KanbanView#historychange
   */
  redo() {
    return this._travelHistory('redo');
  }

  /** Empties both history stacks. @returns {this} @fires KanbanView#historychange */
  clearHistory() {
    this._kanbanHistory.clear();
    this._syncHistoryControls();
    this._emitHistory();
    return this;
  }

  /** Returns the current board search text. @returns {string} */
  getSearch() {
    return this._kanbanSearch;
  }

  /**
   * Narrows visible cards to those matching a search. Hidden records keep their position in the
   * data, so a card dropped between two visible cards still lands between them.
   * @param {string} search Search text.
   * @param {{silent?:boolean}} [options={}] Event behavior.
   * @returns {this}
   * @fires KanbanView#searchchange
   */
  setSearch(search, options = {}) {
    const next = search == null ? '' : String(search);
    if (next === this._kanbanSearch) return this;
    this._kanbanSearch = next;
    if (this._searchInput && this._searchInput.value !== next) this._searchInput.value = next;
    this._refreshView('search');
    if (!options.silent) this.emit('searchchange', { search: next });
    return this;
  }

  /**
   * Replaces the extra card predicate. Pass null to clear it.
   * @param {((record:KanbanRecord,index:number)=>boolean)|null} filter Predicate.
   * @returns {this}
   */
  setFilter(filter) {
    if (filter != null && typeof filter !== 'function') {
      throw new TypeError('Kanban filter must be a function or null');
    }
    this._kanbanFilter = filter ?? null;
    this._refreshView('filter');
    return this;
  }

  /** Returns the records currently rendered, in board order. @returns {KanbanRecord[]} */
  getVisibleRecords() {
    return this._viewData.filter((record) => this._visibleIds.has(this._viewRecordId(record)));
  }

  /**
   * Replaces every record. History is dropped because its snapshots describe records the host has
   * just replaced, and reinstating them would resurrect data the application no longer owns.
   * @param {KanbanRecord[]} records New records.
   * @returns {this}
   */
  setData(records) {
    this._resetHistory();
    return super.setData(records);
  }

  /** @param {KanbanRecord[]} records Records to append. @returns {this} */
  addData(records) {
    this._resetHistory();
    return super.addData(records);
  }

  /** @param {unknown} id Existing record id. @param {KanbanRecord} record Replacement. @returns {this} */
  updateRecord(id, record) {
    this._resetHistory();
    return super.updateRecord(id, record);
  }

  /** @param {unknown} id Record id. @returns {this} */
  removeRecord(id) {
    this._resetHistory();
    return super.removeRecord(id);
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
    this._clearDrag();
    clearTimeout(this._pointerHold);
    clearTimeout(this._searchTimer);
    this._kanbanMenu?.destroy();
    this._kanbanMenu = null;
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
    this._resolveVisibility();
    const content = [];
    if (options.swimlaneBy == null) {
      content.push(this._renderColumns(columns, null, false));
    } else {
      lanes.forEach((lane) => content.push(this._renderLane(lane, columns)));
    }
    if (!this._viewData.length) content.push(this._emptyContent(this._text('empty')));
    else if (!this._visibleIds.size) content.push(this._emptyContent(this._text('noMatches')));
    this._board.replaceChildren(...content);
    if (this._keyboardMove) {
      this._keyboardMove.ids = this._keyboardMove.ids.filter((id) => this.getRecord(id));
      if (!this._keyboardMove.ids.length) this._keyboardMove = null;
    }
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
    const entries = this._viewData.filter((record, index) =>
      normalizeAxisId(this._readAxis(options.swimlaneBy, record, index)) === lane.id);
    const total = entries.length;
    const count = entries.filter((record) => this._visibleIds.has(this._viewRecordId(record))).length;
    const toggle = h('button', {
      class: 'zx-kanban-view__collapse', type: 'button', ariaExpanded: String(!collapsed),
      ariaControls: bodyId, ariaLabel: this._text(collapsed ? 'expandLane' : 'collapseLane', { label: lane.label }),
      dataset: { kanbanCollapse: 'swimlane', kanbanId: lane.id }
    }, icon(collapsed ? 'chevron-right' : 'chevron-down', { size: 13 }));
    const limit = lane.limit ?? null;
    const wip = wipState(total, limit);
    const custom = this._renderHook('renderSwimlaneHeader', {
      swimlane: { ...lane }, count, total, columnTotal: total, limit, wip, collapsed
    });
    const heading = h('h2', { class: 'zx-kanban-view__lane-heading', id: headingId }, toggle,
      custom ?? [h('span', {}, lane.label),
        options.showCounts || limit != null ? this._countIndicator(count, total, limit) : null]);
    const body = this._renderColumns(columns, lane, true);
    body.id = bodyId;
    body.hidden = collapsed;
    return h('section', {
      class: 'zx-kanban-view__lane', ariaLabelledby: headingId,
      dataset: { collapsed: String(collapsed), wip }
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
    const columnEntries = this._viewData.filter((record, index) =>
      normalizeAxisId(this._readAxis(options.columnBy, record, index)) === column.id);
    const columnTotal = columnEntries.length;
    const visible = entries.filter((entry) => this._visibleIds.has(this._viewRecordId(entry.record)));
    const laneLimit = lane ? readColumnLaneLimit(column, lane.id) : null;
    const limit = laneLimit ?? column.limit ?? null;
    const wip = wipState(laneLimit == null ? columnTotal : entries.length, limit);
    const toggle = h('button', {
      class: 'zx-kanban-view__collapse', type: 'button', ariaExpanded: String(!collapsed),
      ariaControls: listId, ariaLabel: this._text(collapsed ? 'expandColumn' : 'collapseColumn', { label: column.label }),
      dataset: { kanbanCollapse: 'column', kanbanId: column.id }
    }, icon(collapsed ? 'chevron-right' : 'chevron-down', { size: 13 }));
    const custom = this._renderHook('renderColumnHeader', {
      column: { ...column }, swimlane: lane ? { ...lane } : null,
      count: visible.length, total: entries.length, columnTotal, limit, wip, collapsed
    });
    const indicator = options.showCounts || limit != null
      ? this._columnIndicator(visible.length, entries.length, columnTotal, limit, hasLanes && laneLimit == null)
      : null;
    const heading = h(hasLanes ? 'h3' : 'h2', {
      class: 'zx-kanban-view__column-heading', id: headingId
    }, toggle, custom ?? [h('span', { class: 'zx-kanban-view__column-label' }, column.label), indicator]);
    const list = h('ul', {
      class: 'zx-kanban-view__cards', id: listId, ariaLabel: `${column.label}${lane ? `, ${lane.label}` : ''}`
    });
    visible.forEach((entry) =>
      list.append(this._renderCard(entry.record, entry.index, column.id, lane?.id ?? null, hasLanes)));
    if (!visible.length) {
      const placeholder = this._renderHook('renderColumnEmpty', {
        column: { ...column }, swimlane: lane ? { ...lane } : null,
        count: 0, total: entries.length, columnTotal, limit, wip, collapsed
      }) ?? this._placeholderText();
      if (placeholder) list.append(h('li', { class: 'zx-kanban-view__column-empty', role: 'presentation' }, placeholder));
    }
    list.hidden = collapsed;
    const add = this._allowsAdd(column, lane) ? h('button', {
      class: 'zx-kanban-view__add', type: 'button',
      ariaLabel: this._text('addTo', { target: `${column.label}${lane ? `, ${lane.label}` : ''}` }),
      dataset: { kanbanAdd: column.id, kanbanLane: lane?.id ?? '' }
    }, icon('plus', { size: 13 }), h('span', {}, this._text('add'))) : null;
    if (add) add.hidden = collapsed;
    const section = h('section', {
      class: 'zx-kanban-view__column', ariaLabelledby: headingId,
      dataset: { column: column.id, collapsed: String(collapsed), wip }
    }, heading, list, add);
    this._sectionMeta.set(section, { column: column.id, lane: lane?.id ?? null, list });
    return section;
  }

  /** @param {KanbanRecord} record @param {number} index @param {string} column @param {string|null} lane @param {boolean} hasLanes @returns {HTMLLIElement} */
  _renderCard(record, index, column, lane, hasLanes) {
    const options = this._kanbanOptions();
    const id = this._viewRecordId(record);
    const grabbed = Boolean(this._keyboardMove?.ids.some((candidate) => Object.is(candidate, id)));
    const rules = resolveKanbanRules(this._kanbanRules, record, { index, column, lane });
    const multiple = grabbed && this._keyboardMove ? this._keyboardMove.ids.length : 1;
    const handle = h('button', {
      class: 'zx-kanban-view__move-handle', type: 'button',
      ariaPressed: String(grabbed),
      ariaLabel: multiple > 1
        ? this._text('moveMultiple', { count: multiple })
        : this._text('move', { name: this._recordName(record, index) })
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
    this._applyCardContent(card, { record, id, index, column, lane, rules, selected: this._isViewSelected(id) });
    this._applyCardRules(card, rules);
    this._applyCardDescription(card, id);
    const meta = { record, id, index, column, lane };
    this._cardMeta.set(card, meta);
    this._cardsById.set(id, card);
    return card;
  }

  /**
   * Hands card content to `renderCard` while keeping the managed shell: the list item, its
   * selection control, the action group, and the move handle are never given away, because they
   * carry the drop, focus, and movement semantics the board is responsible for.
   * @param {HTMLElement} card Card built from the shared anatomy.
   * @param {KanbanCardContext} context Card context.
   * @returns {void}
   */
  _applyCardContent(card, context) {
    const custom = this._renderHook('renderCard', context);
    if (!custom) return;
    const body = card.querySelector('.zx-record-card__body');
    const titles = card.querySelector('.zx-record-card__titles');
    if (!body || !titles) return;
    titles.replaceChildren(custom);
    body.querySelector('.zx-record-card__eyebrow')?.remove();
    body.querySelector('.zx-record-card__metadata')?.remove();
    // The generated heading carried the accessible name; a replaced body must supply its own.
    card.removeAttribute('aria-labelledby');
    card.setAttribute('aria-label', this._recordName(context.record, context.index));
    card.dataset.customCard = 'true';
  }

  /**
   * Applies ordered card rules. The first match owns the marker tone; every match with a label adds
   * a badge, and rule descriptions join the accessible description so the marker is never the only
   * carrier of the meaning.
   * @param {HTMLElement} card Card element.
   * @param {KanbanRule[]} rules Matching rules.
   * @returns {void}
   */
  _applyCardRules(card, rules) {
    if (!rules.length) return;
    card.dataset.rule = rules.map((rule) => rule.id).join(' ');
    card.dataset.ruleTone = rules[0].tone;
    const badges = rules.filter((rule) => rule.label);
    if (badges.length) {
      const list = h('p', { class: 'zx-kanban-view__rules' }, badges.map((rule) => badge({
        label: rule.label, icon: rule.icon ?? undefined, kind: rule.tone, size: 'sm', variant: 'soft'
      })));
      card.querySelector('.zx-record-card__body')?.append(list);
    }
    const descriptions = rules.map((rule) => rule.description).filter(Boolean).join('. ');
    if (descriptions) card.dataset.ruleDescription = descriptions;
  }

  /**
   * Composes one card's accessible description from its selection state and its rules, so that
   * refreshing selection cannot quietly drop what a rule contributed.
   * @param {HTMLElement} card Card element.
   * @param {unknown} id Record id.
   * @returns {void}
   */
  _applyCardDescription(card, id) {
    const parts = [];
    if (this.options.selectable) {
      parts.push(this._text(this._isViewSelected(id) ? 'selected' : 'notSelected'));
    }
    if (card.dataset.ruleDescription) parts.push(card.dataset.ruleDescription);
    if (parts.length) card.setAttribute('aria-description', parts.join('. '));
    else card.removeAttribute('aria-description');
  }

  /** @param {string} text Board-level empty message. @returns {HTMLElement} */
  _emptyContent(text) {
    const supplied = typeof this.options.emptyText === 'function' ? this.options.emptyText() : this.options.emptyText;
    const content = supplied ?? text;
    return h('div', { class: 'zx-kanban-view__empty', role: 'status' },
      content && typeof content === 'object' && 'nodeType' in content ? /** @type {Node} */ (content) : String(content));
  }

  /** @returns {string} Per-column placeholder text, or an empty string for none. */
  _placeholderText() {
    return this._text('columnEmpty');
  }

  /**
   * @param {number} count Visible records.
   * @param {number} total Records before search and filters.
   * @param {number|null} limit Applicable limit.
   * @returns {HTMLElement}
   */
  _countIndicator(count, total, limit) {
    const filtered = count !== total;
    return h('span', {
      class: 'zx-kanban-view__count',
      ariaLabel: limit != null ? this._text('countLimit', { count: total, limit })
        : filtered ? this._text('countFiltered', { count, total }) : this._text('count', { count })
    }, limit != null ? `${total} / ${limit}`
      : filtered ? `${count} / ${total}` : String(count));
  }

  /**
   * @param {number} count Visible records in this column and lane.
   * @param {number} total Records in this column and lane before search and filters.
   * @param {number} columnTotal Records across the whole column.
   * @param {number|null} limit Applicable limit.
   * @param {boolean} columnScoped Whether the limit counts the column rather than this lane.
   * @returns {HTMLElement}
   */
  _columnIndicator(count, total, columnTotal, limit, columnScoped) {
    const filtered = count !== total;
    const label = limit == null
      ? filtered ? this._text('countFiltered', { count, total }) : this._text('count', { count })
      : columnScoped
        ? this._text('countLimitInLane', { count: total, total: columnTotal, limit })
        : this._text('countLimit', { count: total, limit });
    // A limit measures real capacity, so it is always shown against the unfiltered count; only the
    // limitless indicator reports how much of the column a search is currently hiding.
    const text = limit == null
      ? filtered ? `${count} / ${total}` : String(count)
      : columnScoped ? `${total} · ${columnTotal} / ${limit}` : `${total} / ${limit}`;
    return h('span', { class: 'zx-kanban-view__count', ariaLabel: label }, text);
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
    return locateKanbanRecord(this._viewData, index, {
      recordId: options.recordId,
      columnBy: (record, recordIndex) => this._readAxis(options.columnBy, record, recordIndex),
      swimlaneBy: options.swimlaneBy == null ? null
        : (record, recordIndex) => this._readAxis(options.swimlaneBy, record, recordIndex)
    });
  }

  /**
   * Recomputes which records survive the search and the filter predicate.
   * @returns {void}
   */
  _resolveVisibility() {
    const terms = kanbanSearchTerms(this._kanbanSearch);
    const filter = this._kanbanFilter;
    // Field descriptors are cloned on every read, so they are resolved once for the whole pass
    // rather than per record — a search runs on every keystroke.
    const sources = terms.length ? this._searchSources() : null;
    this._visibleIds = new Set();
    this._viewData.forEach((record, index) => {
      if (filter && filter(record, index) !== true) return;
      if (sources && !matchesKanbanSearch(this._searchableText(record, index, sources), terms)) return;
      this._visibleIds.add(this._viewRecordId(record));
    });
  }

  /**
   * Resolves what a search looks at, once. `searchFields` names them explicitly; otherwise the
   * visible fields are searched, plus the title and subtitle sources — a card is findable by the
   * name it shows even when that field is hidden from the metadata list.
   * @returns {{fields:import('../view/record-view.js').ViewField[],readers:((record:KanbanRecord,index:number)=>unknown)[]}}
   */
  _searchSources() {
    const options = this._kanbanOptions();
    const configured = Array.isArray(options.searchFields) ? options.searchFields.map(String) : null;
    const all = this.getFields();
    if (configured) return { fields: all.filter((field) => configured.includes(field.id)), readers: [] };
    const fields = this.getVisibleFields();
    const known = new Set(fields.map((field) => field.id));
    const readers = [];
    for (const source of [options.titleField, options.subtitleField]) {
      if (source == null) continue;
      if (typeof source === 'function') {
        readers.push(source);
        continue;
      }
      if (known.has(source)) continue;
      const field = all.find((candidate) => candidate.id === source);
      if (field) fields.push(field);
      else readers.push((record) => record?.[source]);
    }
    return { fields, readers };
  }

  /**
   * Builds the text one record is searched through. Field `render` output is deliberately ignored:
   * it may be a DOM node, and matching what a formatter produced rather than what the record holds
   * would make the same query behave differently in two views over the same data.
   * @param {KanbanRecord} record Record.
   * @param {number} index Display index.
   * @param {{fields:import('../view/record-view.js').ViewField[],readers:((record:KanbanRecord,index:number)=>unknown)[]}} sources Resolved sources.
   * @returns {string} Searchable text.
   */
  _searchableText(record, index, sources) {
    const parts = sources.fields.map((field) => stringifyValue(readViewField(field, record, index)));
    for (const reader of sources.readers) parts.push(stringifyValue(reader(record, index)));
    return parts.filter(Boolean).join(' ');
  }

  /**
   * Translates a position among rendered cards into a position among all records in one bucket.
   * @param {string} column Column id.
   * @param {string|null} lane Lane id.
   * @param {number} visibleIndex Position among visible cards.
   * @param {Set<unknown>} excluded Ids being moved, which the visible list already omits.
   * @returns {number} Absolute position.
   */
  _absoluteIndex(column, lane, visibleIndex, excluded) {
    const entries = this._recordsIn(column, lane)
      .filter((entry) => !excluded.has(this._viewRecordId(entry.record)));
    return absoluteKanbanIndex(
      entries.map((entry) => this._visibleIds.has(this._viewRecordId(entry.record))), visibleIndex);
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

  /**
   * Runs transition, eligibility, and capacity policy for a whole move. Every distinct origin is
   * checked, so a multi-card move drawn from two columns cannot slip past a transition rule that
   * only the second origin violates.
   * @param {KanbanRecord[]} records Moving records.
   * @param {KanbanMovePoint[]} origins Their origins.
   * @param {KanbanColumn} column Destination column.
   * @param {KanbanSwimlane|null} lane Destination lane.
   * @param {KanbanMovePoint} to Destination point.
   * @param {KanbanMoveContext} context Predicate context.
   * @param {Set<unknown>} excluded Moving ids, excluded from destination counts.
   * @returns {KanbanMoveEvaluation} Decision.
   */
  _evaluateMove(records, origins, column, lane, to, context, excluded) {
    const options = this._kanbanOptions();
    for (const origin of origins) {
      const blocked = allowsKanbanTransition(column, lane, origin);
      if (blocked) {
        return {
          allowed: false, reason: blocked, limit: null, count: 0,
          limitExceeded: false, limitReached: false,
          policy: column.wipPolicy ?? (options.wipPolicy === 'block' ? 'block' : 'warn')
        };
      }
    }
    const excludes = (record) => !excluded.has(this._viewRecordId(record));
    const columnCount = this._viewData.filter((record, index) =>
      normalizeAxisId(this._readAxis(options.columnBy, record, index)) === to.column && excludes(record)).length;
    const laneCount = options.swimlaneBy == null ? 0 : this._viewData.filter((record, index) =>
      normalizeAxisId(this._readAxis(options.swimlaneBy, record, index)) === to.lane && excludes(record)).length;
    const cellCount = this._recordsIn(to.column, to.lane).filter((entry) => excludes(entry.record)).length;
    return evaluateKanbanMove({
      records, column, swimlane: lane, context, from: origins[0],
      columnCount, laneCount, cellCount, policy: options.wipPolicy === 'block' ? 'block' : 'warn'
    });
  }

  /**
   * Announces and reports a refused move. Nothing is written and no `recordmove` is emitted, so a
   * listener can neither observe nor undo a move that never happened.
   * @param {KanbanRejectReason} reason Refusal reason.
   * @param {{ids:unknown[],records:KanbanRecord[],from:KanbanMovePoint|null,to:KanbanMovePoint|null,column:KanbanColumn|null,swimlane:KanbanSwimlane|null,evaluation?:KanbanMoveEvaluation}} detail Context.
   * @returns {void}
   * @fires KanbanView#movereject
   */
  _rejectMove(reason, detail) {
    const target = detail.to ? this._targetName(detail.to) : '';
    const name = this._movingName(detail.records);
    const message = reason === 'destination' ? this._text('rejectDestination')
      : reason === 'grouping' ? this._text('rejectGrouping')
        : reason === 'transition' || reason === 'lane-transition'
          ? this._text('rejectTransition', { target, origin: detail.from ? this._targetName(detail.from) : '' })
          : reason === 'wip' || reason === 'lane-wip'
            ? this._text('rejectWip', { target, limit: detail.evaluation?.limit ?? '' })
            : this._text('rejectAccept', { target, name });
    this._announce(message);
    this.emit('movereject', {
      reason, ids: [...detail.ids], records: [...detail.records],
      record: detail.records[0] ?? null, id: detail.ids[0],
      from: detail.from ? { ...detail.from } : null, to: detail.to ? { ...detail.to } : null,
      column: detail.column ? { ...detail.column } : null,
      swimlane: detail.swimlane ? { ...detail.swimlane } : null,
      limit: detail.evaluation?.limit ?? null, count: detail.evaluation?.count ?? 0, message
    });
  }

  /**
   * Installs a committed local record order, remembering the previous one for undo.
   * @param {KanbanRecord[]} records Next record order.
   * @returns {void}
   */
  _commitLocalRecords(records) {
    const options = this._kanbanOptions();
    if (options.history !== false) {
      this._kanbanHistory.push({ records: [...this._viewData], selection: this.getSelectionIds() });
      this._syncHistoryControls();
    }
    this._viewData = records;
    // A manual bucket position and a local sort cannot both be authoritative. Clear the local sort
    // on an accepted local move so the visible order and serialized state remain truthful.
    if (options.sortMode === 'local' && this.getSort()) this.setSort(null);
    else this._refreshView('move');
    this.emit('datachange', { records: this.getData() });
    if (options.history !== false) this._emitHistory();
  }

  /**
   * @param {'undo'|'redo'} direction Travel direction.
   * @returns {this}
   */
  _travelHistory(direction) {
    if (this._kanbanOptions().history === false) return this;
    const current = { records: [...this._viewData], selection: this.getSelectionIds() };
    const entry = direction === 'undo'
      ? this._kanbanHistory.undo(current) : this._kanbanHistory.redo(current);
    if (!entry) {
      this._announce(this._text(direction === 'undo' ? 'nothingToUndo' : 'nothingToRedo'));
      return this;
    }
    this._viewData = [...entry.records];
    this._refreshView(direction);
    this.setSelection(entry.selection);
    this._syncHistoryControls();
    this.emit('datachange', { records: this.getData() });
    this._emitHistory();
    this._announce(this._text(direction === 'undo' ? 'undone' : 'redone'));
    return this;
  }

  /** Drops both stacks without announcing, for host-driven data replacement. @returns {void} */
  _resetHistory() {
    if (!this._kanbanHistory) return;
    const had = this._kanbanHistory.canUndo() || this._kanbanHistory.canRedo();
    this._kanbanHistory.clear();
    this._syncHistoryControls();
    if (had) this._emitHistory();
  }

  /** @returns {void} */
  _emitHistory() {
    this.emit('historychange', {
      canUndo: this.canUndo(), canRedo: this.canRedo(), depth: this._kanbanHistory.depth()
    });
  }

  /** @returns {void} */
  _syncHistoryControls() {
    if (this._undoButton) this._undoButton.disabled = !this.canUndo();
    if (this._redoButton) this._redoButton.disabled = !this.canRedo();
  }

  /** @returns {HTMLElement} Built-in search control. */
  _createSearchControl() {
    const input = /** @type {HTMLInputElement} */ (h('input', {
      class: 'zx-kanban-view__search-input', type: 'search',
      value: this._kanbanSearch, ariaLabel: this._text('search'),
      placeholder: this._text('searchPlaceholder')
    }));
    this._searchInput = input;
    // Every keystroke would otherwise rebuild every card. The public setSearch stays immediate.
    this.listen(input, 'input', () => {
      clearTimeout(this._searchTimer);
      this._searchTimer = setTimeout(() => {
        this._searchTimer = 0;
        if (!this._kanbanDestroyed) this.setSearch(input.value);
      }, SEARCH_DEBOUNCE);
    });
    this.listen(input, 'keydown', (event) => {
      if (/** @type {KeyboardEvent} */ (event).key !== 'Escape' || !input.value) return;
      event.stopPropagation();
      clearTimeout(this._searchTimer);
      this._searchTimer = 0;
      this.setSearch('');
    });
    return h('div', { class: 'zx-kanban-view__search' }, icon('search', { size: 13 }), input);
  }

  /** @returns {HTMLElement} Built-in history controls. */
  _createHistoryControls() {
    this._undoButton = /** @type {HTMLButtonElement} */ (h('button', {
      class: 'zx-button zx-button--sm', type: 'button', disabled: true,
      dataset: { kanbanHistory: 'undo' }
    }, this._text('undo')));
    this._redoButton = /** @type {HTMLButtonElement} */ (h('button', {
      class: 'zx-button zx-button--sm', type: 'button', disabled: true,
      dataset: { kanbanHistory: 'redo' }
    }, this._text('redo')));
    const group = h('div', { class: 'zx-kanban-view__history', role: 'group' },
      this._undoButton, this._redoButton);
    this.listen(group, 'click', (event) => {
      const control = /** @type {Element|null} */ (event.target)?.closest?.('[data-kanban-history]');
      if (!control) return;
      if (/** @type {HTMLElement} */ (control).dataset.kanbanHistory === 'undo') this.undo();
      else this.redo();
    });
    return group;
  }

  /** Attaches the card context menu. @returns {void} */
  _createContextMenu() {
    this._kanbanMenu = new ContextMenu(this._board, {
      selector: '.zx-record-card',
      items: (context) => this._menuItems(context),
      onselect: ({ detail }) => this._handleMenuSelect(detail)
    });
  }

  /**
   * Builds the menu for one card: every destination the same policy path would accept, plus any
   * application items. Destinations the board would refuse are shown disabled rather than hidden,
   * so a rule is discoverable instead of silently removing a command.
   * @param {Element|null} context Card element the menu opened on.
   * @returns {(MenuItem|'-')[]} Menu entries.
   */
  _menuItems(context) {
    const meta = context ? this._cardMeta.get(context) : null;
    if (!meta) return [];
    const options = this._kanbanOptions();
    const ids = this._movingIds(meta.id);
    /** @type {(MenuItem|'-')[]} */
    const items = [];
    for (const column of this._resolvedColumns()) {
      if (column.id === meta.column) continue;
      items.push({
        label: this._text('menuMoveTo', { target: column.label }),
        value: { kind: 'column', id: column.id, ids },
        disabled: !this._canMove(ids, { column: column.id })
      });
    }
    if (options.swimlaneBy != null) {
      for (const lane of this._resolvedSwimlanes()) {
        if (lane.id === meta.lane) continue;
        items.push({
          label: this._text('menuMoveToLane', { target: lane.label }),
          value: { kind: 'lane', id: lane.id, ids },
          disabled: !this._canMove(ids, { lane: lane.id })
        });
      }
    }
    const extra = typeof options.contextMenu === 'function'
      ? options.contextMenu({
        record: meta.record, id: meta.id, index: meta.index, column: meta.column, lane: meta.lane,
        rules: resolveKanbanRules(this._kanbanRules, meta.record, meta), selected: this._isViewSelected(meta.id)
      })
      : Array.isArray(options.contextMenu) ? options.contextMenu : [];
    if (Array.isArray(extra) && extra.length) items.push('-', ...extra);
    return items;
  }

  /**
   * @param {{value:unknown,item:MenuItem,context:Element|null}} detail Selection detail.
   * @returns {void}
   */
  _handleMenuSelect(detail) {
    const value = /** @type {{kind?:string,id?:string,ids?:unknown[]}|null} */ (detail.value);
    if (!value || typeof value !== 'object' || !value.kind || !Array.isArray(value.ids)) return;
    this.moveRecords(value.ids, value.kind === 'lane' ? { lane: value.id } : { column: value.id });
  }

  /**
   * Dry-runs the policy path for a destination without emitting or committing anything.
   * @param {unknown[]} ids Moving ids.
   * @param {KanbanDestination} destination Destination.
   * @returns {boolean} Whether the move would be allowed.
   */
  _canMove(ids, destination) {
    const options = this._kanbanOptions();
    const moving = this._orderedIds(ids);
    if (!moving.length) return false;
    const records = moving.map((id) => /** @type {KanbanRecord} */ (this.getRecord(id)));
    const origins = moving.map((id) => /** @type {KanbanMovePoint} */ (this._recordLocation(id)));
    const from = origins[0];
    const columnId = destination.column == null ? from.column : String(destination.column);
    const laneId = options.swimlaneBy == null
      ? null : destination.lane === undefined ? from.lane : normalizeAxisId(destination.lane);
    const column = this._resolvedColumns().find((candidate) => candidate.id === columnId);
    const lane = options.swimlaneBy == null
      ? null : this._resolvedSwimlanes().find((candidate) => candidate.id === laneId) ?? null;
    if (!column || options.swimlaneBy != null && !lane) return false;
    const excluded = new Set(moving);
    const to = { column: columnId, lane: laneId, index: 0 };
    const context = {
      id: moving[0], from: { ...from }, to: { ...to },
      column: { ...column }, swimlane: lane ? { ...lane } : null
    };
    return this._evaluateMove(records, origins, column, lane, to, context, excluded).allowed;
  }

  /**
   * Resolves the ids one gesture moves: the whole selection when the grabbed card belongs to it,
   * otherwise just that card. Picking up an unselected card never drags the selection along.
   * @param {unknown} id Grabbed record id.
   * @returns {unknown[]} Ids to move, in board order.
   */
  _movingIds(id) {
    const options = this._kanbanOptions();
    if (options.multiMove === false || options.selectable !== 'multi' || !this._isViewSelected(id)) return [id];
    const selection = this.getSelectionIds();
    return selection.length > 1 ? selection : [id];
  }

  /** @param {unknown[]} ids Requested ids. @returns {unknown[]} Existing ids in board order. */
  _orderedIds(ids) {
    const requested = new Set(ids);
    return this._viewData
      .map((record) => this._viewRecordId(record))
      .filter((id) => requested.has(id));
  }

  /** @param {MouseEvent} event @returns {void} */
  _handleBoardClick(event) {
    if (this._suppressClick) {
      this._suppressClick = false;
      return;
    }
    const target = elementTarget(event);
    const collapse = target?.closest('[data-kanban-collapse]');
    if (collapse) {
      const element = /** @type {HTMLElement} */ (collapse);
      if (element.dataset.kanbanCollapse === 'column') this.toggleColumn(String(element.dataset.kanbanId));
      else this.toggleSwimlane(String(element.dataset.kanbanId));
      return;
    }
    const add = target?.closest('[data-kanban-add]');
    if (add) {
      const element = /** @type {HTMLElement} */ (add);
      const columnId = String(element.dataset.kanbanAdd);
      const laneId = element.dataset.kanbanLane || null;
      this.emit('recordadd', {
        column: this._resolvedColumns().find((candidate) => candidate.id === columnId) ?? null,
        swimlane: laneId == null ? null
          : this._resolvedSwimlanes().find((candidate) => candidate.id === laneId) ?? null,
        columnId, laneId, event
      });
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
    if (this._dragIds.length && event.key === 'Escape') {
      event.preventDefault();
      this._clearDrag();
      this._announce(this._text('moveCanceledPlain'));
      return;
    }
    const target = elementTarget(event);
    if (this._handleHistoryKeydown(event, target)) return;
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

  /**
   * @param {KeyboardEvent} event Keyboard event.
   * @param {Element|null} target Event target.
   * @returns {boolean} Whether the event was handled as a history command.
   */
  _handleHistoryKeydown(event, target) {
    if (this._kanbanOptions().history === false || !(event.ctrlKey || event.metaKey)) return false;
    // Text entry owns its own undo stack; never take Ctrl+Z away from a field on the board.
    if (target?.closest('input, textarea, [contenteditable="true"]')) return false;
    // A key the board cannot act on belongs to the browser or the application, not to an
    // announcement saying there was nothing to do.
    const key = event.key.toLowerCase();
    if (key === 'z' && !event.shiftKey && this.canUndo()) {
      event.preventDefault();
      this.undo();
      return true;
    }
    if ((key === 'y' || key === 'z' && event.shiftKey) && this.canRedo()) {
      event.preventDefault();
      this.redo();
      return true;
    }
    return false;
  }

  /** @param {KeyboardEvent} event @param {HTMLElement} handle @param {KanbanCardMeta} meta @returns {void} */
  _handleMoveKeydown(event, handle, meta) {
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      if (this._keyboardMove?.ids.some((candidate) => Object.is(candidate, meta.id))) {
        const move = this._keyboardMove;
        this._keyboardMove = null;
        handle.setAttribute('aria-pressed', 'false');
        const card = /** @type {HTMLElement|null} */ (handle.closest('.zx-record-card'));
        if (card) delete card.dataset.grabbed;
        this._syncKeyboardTarget();
        this._commitInteractionMove(move.ids, move.to);
      } else {
        const from = this._recordLocation(meta.id);
        if (!from) return;
        const ids = this._movingIds(meta.id);
        const start = { ...from, index: this._visibleIndex(meta.id) };
        this._keyboardMove = { ids, from: { ...from }, to: start };
        handle.setAttribute('aria-pressed', 'true');
        const card = handle.closest('.zx-record-card');
        if (card) /** @type {HTMLElement} */ (card).dataset.grabbed = 'true';
        this._syncKeyboardTarget();
        this._announce(ids.length > 1
          ? this._text('grabbedMultiple', { count: ids.length })
          : this._text('grabbed', { name: this._recordName(meta.record, meta.index) }));
      }
      return;
    }
    if (event.key === 'Escape' && this._keyboardMove) {
      event.preventDefault();
      const records = this._keyboardMove.ids.map((id) => this.getRecord(id)).filter(Boolean);
      this._keyboardMove = null;
      handle.setAttribute('aria-pressed', 'false');
      const card = /** @type {HTMLElement|null} */ (handle.closest('.zx-record-card'));
      if (card) delete card.dataset.grabbed;
      this._syncKeyboardTarget();
      this._announce(records.length
        ? this._text('moveCanceled', { name: this._movingName(/** @type {KanbanRecord[]} */ (records)) })
        : this._text('moveCanceledPlain'));
      return;
    }
    if (!this._keyboardMove || !this._keyboardMove.ids.some((candidate) => Object.is(candidate, meta.id))
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
    const targetCount = this._visibleCount(move.to.column, move.to.lane, new Set(move.ids));
    move.to.index = clampKanbanIndex(move.to.index, targetCount);
    this._syncKeyboardTarget();
    this._announce(this._text('target', {
      target: this._targetName(move.to), position: move.to.index + 1, total: targetCount + 1
    }));
  }

  /** @param {Event} event @returns {void} */
  _handlePreviewError(event) {
    const image = /** @type {HTMLImageElement|null} */ (elementTarget(event)?.closest('img[data-record-preview]'));
    if (!image) return;
    const preview = /** @type {HTMLElement|null} */ (image.closest('.zx-record-card__preview'));
    if (preview) preview.dataset.failed = 'true';
    image.hidden = true;
  }

  /**
   * Records a candidate drag. Nothing moves yet: a press that never travels stays a click, and a
   * touch on the card body stays a scroll until the long press elapses.
   * @param {PointerEvent} event Pointer event.
   * @returns {void}
   */
  _handlePointerDown(event) {
    this._suppressClick = false;
    if (event.button != null && event.button !== 0) return;
    const target = elementTarget(event);
    const handle = target?.closest('.zx-kanban-view__move-handle');
    const meta = this._metaForTarget(handle ?? target);
    if (!meta) return;
    if (!handle) {
      if (this._kanbanOptions().dragFrom !== 'card') return;
      if (target?.closest(INTERACTIVE) || target?.closest('.zx-record-card__selection')) return;
    }
    const ids = this._movingIds(meta.id);
    this._pointerStart = {
      x: event.clientX, y: event.clientY, id: event.pointerId, ids,
      touch: event.pointerType === 'touch'
    };
    this._dragPoint = { x: event.clientX, y: event.clientY };
    clearTimeout(this._pointerHold);
    if (event.pointerType !== 'touch' || handle) return;
    // A finger resting on a card must be allowed to scroll the board; only a deliberate hold that
    // never travels — so the browser has not begun panning — turns into a drag.
    this._pointerHold = setTimeout(() => this._beginDrag(this._dragPoint.x, this._dragPoint.y), TOUCH_HOLD);
  }

  /** @param {PointerEvent} event @returns {void} */
  _handlePointerMove(event) {
    const start = this._pointerStart;
    if (!this._dragIds.length) {
      if (!start || event.pointerId !== start.id) return;
      const distance = Math.hypot(event.clientX - start.x, event.clientY - start.y);
      this._dragPoint = { x: event.clientX, y: event.clientY };
      if (distance <= DRAG_THRESHOLD) return;
      if (start.touch && this._pointerHold) {
        // The finger travelled before the hold elapsed: this is a scroll, not a drag.
        clearTimeout(this._pointerHold);
        this._pointerHold = 0;
        this._pointerStart = null;
        return;
      }
      this._beginDrag(event.clientX, event.clientY);
      if (!this._dragIds.length) return;
    }
    // A second finger landing on the board must not steer a drag it did not start.
    if (this._dragPointer != null && event.pointerId !== this._dragPointer) return;
    event.preventDefault();
    this._dragPoint = { x: event.clientX, y: event.clientY };
    this._positionDragPreview();
    this._updateDropTarget(event.clientX, event.clientY);
  }

  /** @param {PointerEvent} event @returns {void} */
  _handlePointerUp(event) {
    if (this._dragIds.length && this._dragPointer != null && event.pointerId !== this._dragPointer) return;
    clearTimeout(this._pointerHold);
    this._pointerHold = 0;
    this._pointerStart = null;
    if (!this._dragIds.length) return;
    event.preventDefault();
    const ids = [...this._dragIds];
    const destination = this._dragDestination ? { ...this._dragDestination } : null;
    this._clearDrag();
    this._suppressClick = true;
    if (destination) this._commitInteractionMove(ids, destination);
  }

  /**
   * Starts a pointer drag: the floating preview appears, the board stops selecting text, and the
   * auto-scroll loop begins.
   * @param {number} x Pointer client x.
   * @param {number} y Pointer client y.
   * @returns {void}
   */
  _beginDrag(x, y) {
    const start = this._pointerStart;
    if (!start || this._dragIds.length) return;
    this._pointerHold = 0;
    this._dragIds = start.ids.filter((id) => this.getRecord(id));
    if (!this._dragIds.length) return;
    this._dragPoint = { x, y };
    this._board.dataset.dragging = 'true';
    for (const id of this._dragIds) {
      const card = this._cardsById.get(id);
      if (card) card.dataset.dragging = 'true';
    }
    this._dragPointer = start.id;
    try {
      this._board.setPointerCapture(start.id);
      this._dragCaptured = true;
    } catch {
      // Capture is an enhancement; the drag still tracks through board-level pointer events.
    }
    globalThis.getSelection?.()?.removeAllRanges();
    this._dragPreview = this._createDragPreview();
    this.el.append(this._dragPreview);
    this._positionDragPreview();
    this._updateDropTarget(x, y);
    if (this._kanbanOptions().autoScroll !== false) this._scheduleAutoScroll();
  }

  /** @returns {HTMLElement} Floating drag preview. */
  _createDragPreview() {
    const records = this._dragIds.map((id) => /** @type {KanbanRecord} */ (this.getRecord(id)));
    const custom = this._renderHook('renderDragPreview', {
      records, ids: [...this._dragIds], count: this._dragIds.length
    });
    const content = custom ?? (this._dragIds.length > 1
      ? this._text('dragPreview', { count: this._dragIds.length })
      : this._movingName(records));
    return h('div', {
      class: 'zx-kanban-view__drag-preview', ariaHidden: 'true',
      dataset: { count: String(this._dragIds.length) }
    }, content);
  }

  /** @returns {void} */
  _positionDragPreview() {
    if (!this._dragPreview) return;
    this._dragPreview.style.transform =
      `translate3d(${Math.round(this._dragPoint.x)}px, ${Math.round(this._dragPoint.y)}px, 0)`;
  }

  /**
   * Resolves and marks the drop destination under the pointer. Pointer capture retargets events to
   * the board, so the element under the pointer is looked up rather than read off the event.
   * @param {number} x Pointer client x.
   * @param {number} y Pointer client y.
   * @returns {void}
   */
  _updateDropTarget(x, y) {
    const element = document.elementFromPoint(x, y);
    const section = element?.closest('.zx-kanban-view__column');
    const sectionMeta = section && this._board.contains(section) ? this._sectionMeta.get(section) : null;
    this._clearDropMarkers();
    if (!sectionMeta || this._collapsedColumns.has(sectionMeta.column)) {
      this._dragDestination = null;
      return;
    }
    // The insertion point is derived from card geometry rather than from whatever element the
    // pointer happens to be over, so hovering a card already in flight, a gap, or the empty-column
    // placeholder all resolve to the same well-defined slot.
    const cards = this._draggableCards(sectionMeta.list);
    const index = cards.findIndex((card) => {
      const rectangle = card.getBoundingClientRect();
      return y < rectangle.top + rectangle.height / 2;
    });
    const position = index < 0 ? cards.length : index;
    if (cards[position]) cards[position].dataset.drop = 'before';
    else if (cards.length) cards[cards.length - 1].dataset.drop = 'after';
    else sectionMeta.list.dataset.drop = 'append';
    this._dragDestination = { column: sectionMeta.column, lane: sectionMeta.lane, index: position };
  }

  /** @returns {void} */
  _scheduleAutoScroll() {
    if (this._dragFrame) return;
    this._dragFrame = requestAnimationFrame(() => {
      this._dragFrame = 0;
      if (!this._dragIds.length) return;
      this._autoScroll();
      this._scheduleAutoScroll();
    });
  }

  /** Scrolls the board horizontally and the hovered column vertically near their edges. @returns {void} */
  _autoScroll() {
    const { x, y } = this._dragPoint;
    const board = this._board.getBoundingClientRect();
    if (x < board.left + SCROLL_EDGE) this._board.scrollLeft -= SCROLL_SPEED;
    else if (x > board.right - SCROLL_EDGE) this._board.scrollLeft += SCROLL_SPEED;
    const list = document.elementFromPoint(x, y)?.closest('.zx-kanban-view__cards');
    if (!list || !this._board.contains(list) || list.scrollHeight <= list.clientHeight) return;
    const bounds = list.getBoundingClientRect();
    if (y < bounds.top + SCROLL_EDGE) list.scrollTop -= SCROLL_SPEED;
    else if (y > bounds.bottom - SCROLL_EDGE) list.scrollTop += SCROLL_SPEED;
  }

  /**
   * Commits a move whose index came from rendered cards. Search and filters hide records without
   * removing them, so the visible position is translated back before anything is proposed.
   * @param {unknown[]} ids Moving ids.
   * @param {KanbanMovePoint} point Destination in visible-card space.
   * @returns {void}
   */
  _commitInteractionMove(ids, point) {
    const excluded = new Set(ids);
    this.moveRecords(ids, {
      column: point.column,
      lane: point.lane,
      index: this._absoluteIndex(point.column, point.lane, point.index, excluded)
    });
  }

  /** @returns {void} */
  _clearDrag() {
    if (this._dragFrame) cancelAnimationFrame(this._dragFrame);
    this._dragFrame = 0;
    clearTimeout(this._pointerHold);
    this._pointerHold = 0;
    this._pointerStart = null;
    this._dragPreview?.remove();
    this._dragPreview = null;
    this._dragIds = [];
    this._dragDestination = null;
    if (this._board) {
      if (this._dragCaptured && this._dragPointer != null) {
        try {
          this._board.releasePointerCapture(this._dragPointer);
        } catch {
          // The capture is already gone, which is exactly the state this wanted.
        }
      }
      this._clearDropMarkers();
      delete this._board.dataset.dragging;
      for (const card of this._board.querySelectorAll('[data-dragging]')) delete /** @type {HTMLElement} */ (card).dataset.dragging;
    }
    this._dragPointer = null;
    this._dragCaptured = false;
  }

  /** @returns {void} */
  _clearDropMarkers() {
    for (const element of this._board.querySelectorAll('[data-drop]')) delete /** @type {HTMLElement} */ (element).dataset.drop;
  }

  /** @param {HTMLElement} list Card list. @returns {HTMLElement[]} Cards excluding the ones in flight. */
  _draggableCards(list) {
    const moving = new Set(this._dragIds.length ? this._dragIds : this._keyboardMove?.ids ?? []);
    return /** @type {HTMLElement[]} */ ([...list.querySelectorAll(':scope > .zx-record-card')]
      .filter((card) => !hasId(moving, this._cardMeta.get(card)?.id)));
  }

  /** @param {string} column @param {string|null} lane @param {Set<unknown>} excluded @returns {number} */
  _visibleCount(column, lane, excluded) {
    return this._recordsIn(column, lane).filter((entry) => {
      const id = this._viewRecordId(entry.record);
      return !hasId(excluded, id) && this._visibleIds.has(id);
    }).length;
  }

  /** @param {unknown} id Record id. @returns {number} Position among visible cards in its bucket. */
  _visibleIndex(id) {
    const location = this._recordLocation(id);
    if (!location) return 0;
    const visible = this._recordsIn(location.column, location.lane)
      .filter((entry) => this._visibleIds.has(this._viewRecordId(entry.record)));
    const position = visible.findIndex((entry) => Object.is(this._viewRecordId(entry.record), id));
    return position < 0 ? visible.length : position;
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
    const cards = this._draggableCards(sectionMeta.list);
    const target = cards[move.to.index];
    if (target) target.dataset.keyboardTarget = 'before';
    else sectionMeta.list.dataset.keyboardTarget = 'append';
  }

  /** @returns {void} */
  _syncCardSelection() {
    for (const [id, card] of this._cardsById) {
      const selected = this._isViewSelected(id);
      card.dataset.selected = String(selected);
      this._applyCardDescription(card, id);
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

  /**
   * Runs one presentation hook, ignoring anything that is not a node so a hook cannot smuggle
   * markup in as a string.
   * @param {'renderCard'|'renderColumnHeader'|'renderSwimlaneHeader'|'renderColumnEmpty'|'renderDragPreview'} name Hook name.
   * @param {any} context Hook context.
   * @returns {Node|null} Node to adopt, or null for the default presentation.
   */
  _renderHook(name, context) {
    const hook = this._kanbanOptions()[name];
    if (typeof hook !== 'function') return null;
    const result = hook(context);
    return result && typeof result === 'object' && 'nodeType' in result ? /** @type {Node} */ (result) : null;
  }

  /** @param {KanbanColumn} column @param {KanbanSwimlane|null} lane @returns {boolean} */
  _allowsAdd(column, lane) {
    const allow = this._kanbanOptions().allowAdd;
    if (typeof allow === 'function') return allow(column, lane) === true;
    return allow === true;
  }

  /** @param {KanbanRecord} record @param {number} index @returns {string} */
  _recordName(record, index) {
    const source = this._kanbanOptions().titleField;
    const value = typeof source === 'function' ? source(record, index) : typeof source === 'string'
      ? this._readAxis(source, record, index) : this._viewRecordId(record);
    if (value && typeof value === 'object' && 'nodeType' in value) {
      return /** @type {Node} */ (value).textContent?.trim() || this._text('record');
    }
    return String(value ?? this._text('record'));
  }

  /** @param {KanbanRecord[]} records Moving records. @returns {string} */
  _movingName(records) {
    if (!records.length) return this._text('record');
    if (records.length === 1) return this._recordName(records[0], this._viewData.indexOf(records[0]));
    return this._text('dragPreview', { count: records.length });
  }

  /** @param {KanbanMovePoint} point @returns {string} */
  _targetName(point) {
    const column = this._resolvedColumns().find((candidate) => candidate.id === point.column);
    const lane = point.lane == null ? null
      : this._resolvedSwimlanes().find((candidate) => candidate.id === point.lane);
    return `${column?.label ?? point.column}${lane ? `, ${lane.label}` : ''}`;
  }

  /** @param {KanbanMoveEvaluation} evaluation Capacity report. @returns {string} */
  _wipAnnouncement(evaluation) {
    if (evaluation.limit == null) return '';
    if (evaluation.limitExceeded) return this._text('limitExceeded', { limit: evaluation.limit });
    return evaluation.limitReached ? this._text('limitReached', { limit: evaluation.limit }) : '';
  }

  /**
   * Resolves one localizable string.
   * @param {keyof typeof DEFAULT_LABELS|string} key Label key.
   * @param {Record<string, unknown>} [args] Placeholder values.
   * @returns {string} Resolved text.
   */
  _text(key, args) {
    const overrides = this._kanbanOptions().labels;
    const source = overrides && typeof overrides === 'object' && key in overrides
      ? overrides[key] : /** @type {Record<string,string>} */ (DEFAULT_LABELS)[key];
    return printf(source == null ? String(key) : String(source), args);
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
    if (source.from != null && !Array.isArray(source.from)) {
      throw new TypeError(`Kanban ${axis} ${id} from must be an array or null`);
    }
    seen.add(id);
    const normalized = /** @type {Record<string, any>} */ ({
      ...source,
      id,
      label: String(source.label ?? axisLabel(source.id)),
      limit: normalizeLimit(source.limit),
      from: Array.isArray(source.from) ? source.from.map(String) : null,
      ...(Object.prototype.hasOwnProperty.call(source, 'value') ? {} : { value: source.id })
    });
    if (axis === 'column') {
      const laneLimits = normalizeLaneLimits(source.laneLimits);
      if (laneLimits) normalized.laneLimits = laneLimits;
      if (source.wipPolicy === 'block' || source.wipPolicy === 'warn') {
        normalized.wipPolicy = source.wipPolicy;
      }
    } else {
      delete normalized.laneLimits;
      delete normalized.wipPolicy;
    }
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
 * Reorders records around one already-cloned moved record. Retained as the single-record form of
 * `reorderKanbanRecords`; the input array and every input record remain untouched.
 * @param {KanbanRecord[]} records Records.
 * @param {unknown} id Moving record id.
 * @param {KanbanRecord} movedRecord Cloned record carrying its destination axis values.
 * @param {{recordId:string|((record:KanbanRecord)=>unknown),columnBy:KanbanAccessor,swimlaneBy:KanbanAccessor,destination:KanbanMovePoint}} options Accessors and destination.
 * @returns {{records:KanbanRecord[],from:KanbanMovePoint,to:KanbanMovePoint}|null}
 */
export function reorderKanbanData(records, id, movedRecord, options) {
  if (!movedRecord || typeof movedRecord !== 'object') return null;
  const result = reorderKanbanRecords(records, [{ id, record: movedRecord }], options);
  return result ? { records: result.records, from: result.moves[0].from, to: result.to } : null;
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

/** @param {unknown} value @returns {Record<string, number>|undefined} */
function normalizeLaneLimits(value) {
  if (value == null) return undefined;
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('Kanban column laneLimits must be an object');
  }
  /** @type {Record<string, number>} */
  const result = {};
  for (const [lane, limit] of Object.entries(/** @type {Record<string, unknown>} */ (value))) {
    const normalized = normalizeLimit(limit);
    if (normalized != null) result[lane] = normalized;
  }
  return result;
}

/** @param {KanbanColumn} column @param {string} lane @returns {number|null} */
function readColumnLaneLimit(column, lane) {
  const limits = column.laneLimits;
  if (!limits || typeof limits !== 'object') return null;
  const value = limits[lane];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** @param {number} count @param {number|null} limit @returns {'none'|'within'|'limit'|'exceeded'} */
function wipState(count, limit) {
  if (limit == null) return 'none';
  return count > limit ? 'exceeded' : count === limit ? 'limit' : 'within';
}

/** @param {unknown} value @returns {string[]} */
function normalizeOrder(value) {
  return Array.isArray(value) ? [...new Set(value.map(String))] : [];
}

/** @param {unknown} value @returns {string} */
function stringifyValue(value) {
  if (value == null) return '';
  if (typeof value === 'object') return 'nodeType' in value
    ? String(/** @type {Node} */ (value).textContent ?? '') : '';
  return String(value);
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

/** @param {Set<unknown>|unknown[]} haystack @param {unknown} needle @returns {boolean} */
function hasId(haystack, needle) {
  for (const candidate of haystack) if (Object.is(candidate, needle)) return true;
  return false;
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
 * Record movement event emitted before a local commit or external request. `record`, `id`, and
 * `from` describe the primary record; `records`, `ids`, and `moves` describe the whole atomic move.
 * @event KanbanView#recordmove
 * @type {CustomEvent<{record:KanbanRecord,id:unknown,records:KanbanRecord[],ids:unknown[],moves:{id:unknown,from:KanbanMovePoint}[],from:KanbanMovePoint,to:KanbanMovePoint,column:KanbanColumn,swimlane:KanbanSwimlane|null,limitExceeded:boolean}>}
 */

/**
 * Refused movement event. Nothing was written and no `recordmove` was emitted.
 * @event KanbanView#movereject
 * @type {CustomEvent<{reason:KanbanRejectReason,ids:unknown[],records:KanbanRecord[],from:KanbanMovePoint|null,to:KanbanMovePoint|null,column:KanbanColumn|null,swimlane:KanbanSwimlane|null,limit:number|null,count:number,message:string}>}
 */

/**
 * Secondary card action event.
 * @event KanbanView#recordaction
 * @type {CustomEvent<{record:KanbanRecord,id:unknown,action:unknown,actionId:string|undefined,event:Event}>}
 */

/**
 * Request to create a record in one column and lane. The board never creates records itself.
 * @event KanbanView#recordadd
 * @type {CustomEvent<{column:KanbanColumn|null,swimlane:KanbanSwimlane|null,columnId:string,laneId:string|null,event:Event}>}
 */

/**
 * Board search change from the built-in control.
 * @event KanbanView#searchchange
 * @type {CustomEvent<{search:string}>}
 */

/**
 * Undo and redo availability after a committed, reverted, or discarded local move.
 * @event KanbanView#historychange
 * @type {CustomEvent<{canUndo:boolean,canRedo:boolean,depth:{undo:number,redo:number}}>}
 */
