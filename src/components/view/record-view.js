// @ts-check
import { Component } from '../../core/component.js';
import { h, restoreTarget, snapshotTarget } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { sortRows } from '../table/sort.js';

/** @typedef {Record<string, any>} ViewRecord */
/** @typedef {'asc'|'desc'} ViewSortDirection */
/** @typedef {false|'single'|'multi'} ViewSelectionMode */

/**
 * @typedef {Object} ViewField
 * @property {string} id Stable field identifier and default record property.
 * @property {string} label Human-readable field label.
 * @property {(record: ViewRecord, index: number) => unknown} [get] Value accessor.
 * @property {(record: ViewRecord, index: number, value: unknown) => Node|string|number|null|undefined} [render]
 * Text-safe renderer. A returned Node is adopted; every other value is inserted as text.
 * @property {(record: ViewRecord, index: number) => unknown} [sortValue] Local sort accessor.
 * @property {boolean} [sortable=false] Whether the field may become the active sort.
 * @property {boolean} [visible=true] Initial visibility when `hiddenFields` does not name the field.
 * @property {string} [type='text'] Semantic display type available to concrete views.
 * @property {boolean} [duplicate=false] Whether title/subtitle fields also appear in metadata.
 * @property {string} [width] Table-oriented width hint.
 * @property {'start'|'center'|'end'|'left'|'right'} [align] Alignment hint.
 * @property {Record<string, unknown>} [view] View-specific descriptor values.
 */

/**
 * @typedef {Object} ViewSort
 * @property {string} id Field id.
 * @property {ViewSortDirection} dir Sort direction.
 */

/**
 * @typedef {Object} RecordViewState
 * @property {1} version State schema version.
 * @property {string[]} fieldOrder Complete reconciled field order.
 * @property {string[]} hiddenFields Hidden field ids.
 * @property {ViewSort|null} sort Active sort.
 */

/**
 * @typedef {Object} RecordViewOptions
 * @property {ViewField[]} [fields=[]] Shared ordered field descriptors.
 * @property {ViewRecord[]} [data=[]] Initial records.
 * @property {string|((record: ViewRecord) => unknown)} [recordId='ID'] Record id accessor.
 * @property {ViewSort|null} [sort=null] Initial sort.
 * @property {'local'|'server'} [sortMode='local'] Whether Zx reorders local records.
 * @property {ViewSelectionMode} [selectable=false] Record selection behavior.
 * @property {unknown[]} [selection=[]] Initially selected record ids.
 * @property {string[]} [fieldOrder=[]] Field ids in preferred order.
 * @property {string[]} [hiddenFields=[]] Initially hidden field ids.
 * @property {boolean} [fieldControls=true] Whether concrete views show the shared field chooser.
 * @property {string|Node|(() => string|Node)|null} [emptyText=null] Empty-result content.
 * @property {(event: CustomEvent<Record<string, unknown>>) => void} [onrecordclick]
 * @property {(event: CustomEvent<Record<string, unknown>>) => void} [onrecorddblclick]
 * @property {(event: CustomEvent<{records:ViewRecord[]}>) => void} [ondatachange]
 * @property {(event: CustomEvent<{records:ViewRecord[],ids:unknown[]}>) => void} [onselectionchange]
 * @property {(event: CustomEvent<{id:string|null,dir:ViewSortDirection|null}>) => void} [onsortchange]
 * @property {(event: CustomEvent<{visible:string[],hidden:string[]}>) => void} [onfieldvisibilitychange]
 * @property {(event: CustomEvent<{order:string[]}>) => void} [onfieldorderchange]
 * @property {(event: CustomEvent<{state:RecordViewState,reason:string}>) => void} [onstatechange]
 */

/**
 * Presentation-neutral state and controls shared by record collection views. Concrete view classes
 * initialize this base from their `render()` method and implement `_refreshView()`.
 * @fires RecordView#datachange
 * @fires RecordView#selectionchange
 * @fires RecordView#sortchange
 * @fires RecordView#fieldvisibilitychange
 * @fires RecordView#fieldorderchange
 * @fires RecordView#statechange
 * @extends {Component<RecordViewOptions>}
 */
export class RecordView extends Component {
  static cssName = 'record-view';

  /** @type {Readonly<RecordViewOptions>} */
  static defaults = {
    fields: [],
    data: [],
    recordId: 'ID',
    sort: null,
    sortMode: 'local',
    selectable: false,
    selection: [],
    fieldOrder: [],
    hiddenFields: [],
    fieldControls: true,
    emptyText: null
  };

  /**
   * Creates the abstract base as a minimal record view. Concrete views normally call this through
   * their own explicitly typed constructors.
   * @param {Element|string|null} [target=null] Existing root, selector, or null.
   * @param {RecordViewOptions} [options={}] Shared view options.
   */
  constructor(target = null, options = {}) {
    super(target, options);
  }

  /** @returns {HTMLElement} Minimal base root. */
  render() {
    const created = !this.el;
    const root = /** @type {HTMLElement} */ (this.el ?? h('div'));
    this._recordViewOriginal = created ? null : snapshotTarget(root);
    this._recordViewDestroyed = false;
    this._initRecordView(root);
    return root;
  }

  /** Cleans up a directly instantiated base view and restores an enhanced target. @returns {void} */
  destroy() {
    if (this._recordViewDestroyed) return;
    this._recordViewDestroyed = true;
    const root = this.el;
    const snapshot = this._recordViewOriginal;
    super.destroy();
    if (snapshot && root) restoreTarget(root, snapshot);
  }

  /**
   * Initializes shared state during a concrete view's `render()` call.
   * @protected
   * @param {HTMLElement} root Concrete view root.
   * @returns {void}
   */
  _initRecordView(root) {
    this.el = root;
    root.classList.add('zx-record-view');
    this._viewFields = normalizeViewFields(this.options.fields);
    this._viewFieldOrder = reconcileFieldOrder(this._viewFields, this.options.fieldOrder);
    this._viewHidden = normalizeHiddenFields(this._viewFields, this.options.hiddenFields, true);
    this._viewData = normalizeViewRecords(this.options.data);
    this._viewSort = normalizeViewSort(this.options.sort, this._viewFields);
    this._viewSelected = new Set();
    this._viewSelectionAnchor = null;
    this._viewFieldControls = null;
    this._viewFieldList = null;
    this._viewInitialized = true;
    if (this._viewSort && this.options.sortMode === 'local') this._sortViewData();
    this._setInitialSelection(this.options.selection);
  }

  /**
   * Replaces every record and clears selections whose ids disappeared.
   * @param {ViewRecord[]} records New records.
   * @returns {this}
   */
  setData(records) {
    this._viewData = normalizeViewRecords(records);
    if (this._viewSort && this.options.sortMode === 'local') this._sortViewData();
    const selectionChanged = this._pruneViewSelection();
    this.setLoading(false);
    this._refreshView('data');
    if (selectionChanged) this._emitViewSelection();
    this.emit('datachange', { records: this.getData() });
    return this;
  }

  /**
   * Appends records without mutating the supplied array.
   * @param {ViewRecord[]} records Records to append.
   * @returns {this}
   */
  addData(records) {
    this._viewData.push(...normalizeViewRecords(records));
    if (this._viewSort && this.options.sortMode === 'local') this._sortViewData();
    this._refreshView('data');
    this.emit('datachange', { records: this.getData() });
    return this;
  }

  /**
   * Replaces the record currently identified by `id`.
   * @param {unknown} id Existing record id.
   * @param {ViewRecord} record Replacement record.
   * @returns {this}
   */
  updateRecord(id, record) {
    assertViewRecord(record);
    const index = this._viewData.findIndex((candidate) => Object.is(this._viewRecordId(candidate), id));
    if (index < 0) return this;
    const selected = this._viewSelected.delete(id);
    this._viewData[index] = record;
    const nextId = this._viewRecordId(record);
    if (selected) this._viewSelected.add(nextId);
    if (this._viewSort && this.options.sortMode === 'local') this._sortViewData();
    this._refreshView('data');
    if (selected && !Object.is(id, nextId)) this._emitViewSelection();
    this.emit('datachange', { records: this.getData() });
    return this;
  }

  /**
   * Removes one record by id.
   * @param {unknown} id Record id.
   * @returns {this}
   */
  removeRecord(id) {
    const index = this._viewData.findIndex((record) => Object.is(this._viewRecordId(record), id));
    if (index < 0) return this;
    this._viewData.splice(index, 1);
    const selectionChanged = this._viewSelected.delete(id);
    if (Object.is(this._viewSelectionAnchor, id)) this._viewSelectionAnchor = null;
    this._refreshView('data');
    if (selectionChanged) this._emitViewSelection();
    this.emit('datachange', { records: this.getData() });
    return this;
  }

  /** Returns a record by id. @param {unknown} id Record id. @returns {ViewRecord|null} */
  getRecord(id) {
    return this._viewData.find((record) => Object.is(this._viewRecordId(record), id)) ?? null;
  }

  /** Returns a shallow copy in current display order. @returns {ViewRecord[]} */
  getData() {
    return [...this._viewData];
  }

  /**
   * Replaces field descriptors while reconciling order, visibility, and sort by stable id.
   * @param {ViewField[]} fields Next fields.
   * @returns {this}
   */
  setFields(fields) {
    const previousOrder = this.getFieldOrder();
    const previousHidden = this.getHiddenFields();
    this._viewFields = normalizeViewFields(fields);
    this._viewFieldOrder = reconcileFieldOrder(this._viewFields, previousOrder);
    this._viewHidden = normalizeHiddenFields(this._viewFields, previousHidden);
    this._viewSort = normalizeViewSort(this._viewSort, this._viewFields);
    if (this._viewSort && this.options.sortMode === 'local') this._sortViewData();
    this._refreshView('fields');
    this._renderViewFieldControls();
    this._emitViewState('fields');
    return this;
  }

  /** Returns cloned field descriptors in configured order. @returns {ViewField[]} */
  getFields() {
    const fields = new Map(this._viewFields.map((field) => [field.id, field]));
    return this._viewFieldOrder.map((id) => ({ ...fields.get(id) }));
  }

  /** Returns visible cloned descriptors in configured order. @returns {ViewField[]} */
  getVisibleFields() {
    return this.getFields().filter((field) => !this._viewHidden.has(field.id));
  }

  /** Returns hidden field ids in configured order. @returns {string[]} */
  getHiddenFields() {
    return this._viewFieldOrder.filter((id) => this._viewHidden.has(id));
  }

  /** Returns the complete field id order. @returns {string[]} */
  getFieldOrder() {
    return [...this._viewFieldOrder];
  }

  /**
   * Shows or hides one field. The final visible field cannot be hidden.
   * @param {string} id Field id.
   * @param {boolean} [visible=true] Desired visibility.
   * @param {{silent?:boolean}} [options={}] Event behavior.
   * @returns {this}
   */
  setFieldVisible(id, visible = true, options = {}) {
    const fieldId = String(id);
    if (!this._viewFields.some((field) => field.id === fieldId)) {
      throw new RangeError(`Unknown view field: ${fieldId}`);
    }
    if (!visible && !this._viewHidden.has(fieldId) && this.getVisibleFields().length <= 1) {
      this._renderViewFieldControls(fieldId);
      return this;
    }
    const changed = visible ? this._viewHidden.delete(fieldId) : !this._viewHidden.has(fieldId);
    if (!visible && changed) this._viewHidden.add(fieldId);
    if (!changed) return this;
    this._refreshView('fields');
    this._renderViewFieldControls(fieldId);
    if (!options.silent) {
      this.emit('fieldvisibilitychange', {
        visible: this.getVisibleFields().map((field) => field.id),
        hidden: this.getHiddenFields()
      });
      this._emitViewState('fieldvisibility');
    }
    return this;
  }

  /** Toggles one field. @param {string} id Field id. @param {{silent?:boolean}} [options={}] @returns {this} */
  toggleField(id, options = {}) {
    return this.setFieldVisible(id, this._viewHidden.has(String(id)), options);
  }

  /**
   * Moves one field relative to another.
   * @param {string} id Moving field id.
   * @param {string} targetId Target field id.
   * @param {'before'|'after'} [position='before'] Target edge.
   * @param {{silent?:boolean}} [options={}] Event behavior.
   * @returns {this}
   */
  moveField(id, targetId, position = 'before', options = {}) {
    const next = moveViewField(this._viewFieldOrder, String(id), String(targetId), position);
    if (arraysEqual(next, this._viewFieldOrder)) return this;
    return this.setFieldOrder(next, options);
  }

  /**
   * Reconciles a preferred field order with every current field.
   * @param {string[]} order Preferred ids.
   * @param {{silent?:boolean}} [options={}] Event behavior.
   * @returns {this}
   */
  setFieldOrder(order, options = {}) {
    const next = reconcileFieldOrder(this._viewFields, order);
    if (arraysEqual(next, this._viewFieldOrder)) return this;
    this._viewFieldOrder = next;
    this._refreshView('fields');
    this._renderViewFieldControls();
    if (!options.silent) {
      this.emit('fieldorderchange', { order: this.getFieldOrder() });
      this._emitViewState('fieldorder');
    }
    return this;
  }

  /**
   * Changes or clears the active sort.
   * @param {string|null} id Sort field, or null to clear.
   * @param {ViewSortDirection} [dir='asc'] Direction.
   * @param {{silent?:boolean}} [options={}] Event behavior.
   * @returns {this}
   */
  setSort(id, dir = 'asc', options = {}) {
    const next = id == null ? null : normalizeViewSort({ id: String(id), dir }, this._viewFields);
    if (id != null && !next) throw new RangeError(`Unknown or unsortable view field: ${id}`);
    if (sameSort(next, this._viewSort)) return this;
    this._viewSort = next;
    if (next && this.options.sortMode === 'local') this._sortViewData();
    this._refreshView('sort');
    if (!options.silent) {
      this.emit('sortchange', next ? { ...next } : { id: null, dir: null });
      this._emitViewState('sort');
    }
    return this;
  }

  /** Returns a copy of the active sort. @returns {ViewSort|null} */
  getSort() {
    return this._viewSort ? { ...this._viewSort } : null;
  }

  /** Returns selected records in display order. @returns {ViewRecord[]} */
  getSelection() {
    return this._viewData.filter((record) => this._viewSelected.has(this._viewRecordId(record)));
  }

  /** Returns selected record ids in display order. @returns {unknown[]} */
  getSelectionIds() {
    return this.getSelection().map((record) => this._viewRecordId(record));
  }

  /**
   * Replaces selection from record ids.
   * @param {unknown[]} ids Record ids.
   * @param {{silent?:boolean}} [options={}] Event behavior.
   * @returns {this}
   */
  setSelection(ids, options = {}) {
    const requested = new Set(Array.isArray(ids) ? ids : []);
    const available = this._viewData.map((record) => this._viewRecordId(record));
    let next = available.filter((id) => requested.has(id));
    if (this.options.selectable === false) next = [];
    if (this.options.selectable === 'single') next = next.slice(0, 1);
    if (setEqual(this._viewSelected, new Set(next))) return this;
    this._viewSelected = new Set(next);
    this._viewSelectionAnchor = next.at(-1) ?? null;
    this._refreshView('selection');
    if (!options.silent) this._emitViewSelection();
    return this;
  }

  /** Clears selection. @param {{silent?:boolean}} [options={}] @returns {this} */
  clearSelection(options = {}) {
    return this.setSelection([], options);
  }

  /**
   * Toggles a record selection, with optional multi-select range behavior.
   * @param {unknown} id Record id.
   * @param {{selected?:boolean,range?:boolean}} [options={}] Toggle behavior.
   * @returns {this}
   */
  toggleSelection(id, options = {}) {
    if (this.options.selectable === false || !this.getRecord(id)) return this;
    const selected = options.selected ?? !this._viewSelected.has(id);
    if (this.options.selectable === 'single') {
      this._viewSelected = selected ? new Set([id]) : new Set();
    } else if (options.range && this._viewSelectionAnchor != null) {
      const ids = this._viewData.map((record) => this._viewRecordId(record));
      const start = ids.findIndex((candidate) => Object.is(candidate, this._viewSelectionAnchor));
      const end = ids.findIndex((candidate) => Object.is(candidate, id));
      if (start >= 0 && end >= 0) {
        for (const candidate of ids.slice(Math.min(start, end), Math.max(start, end) + 1)) {
          if (selected) this._viewSelected.add(candidate);
          else this._viewSelected.delete(candidate);
        }
      }
    } else if (selected) {
      this._viewSelected.add(id);
    } else {
      this._viewSelected.delete(id);
    }
    this._viewSelectionAnchor = id;
    this._refreshView('selection');
    this._emitViewSelection();
    return this;
  }

  /**
   * Marks the whole view busy without imposing a loading presentation.
   * @param {boolean} [loading=true] Busy state.
   * @returns {this}
   */
  setLoading(loading = true) {
    if (loading) this.el.setAttribute('data-loading', 'true');
    else this.el.removeAttribute('data-loading');
    this.el.setAttribute('aria-busy', String(Boolean(loading)));
    this._refreshView('loading');
    return this;
  }

  /** Returns JSON-safe, persistence-neutral view configuration. @returns {RecordViewState} */
  getViewState() {
    return {
      version: 1,
      fieldOrder: this.getFieldOrder(),
      hiddenFields: this.getHiddenFields(),
      sort: this.getSort()
    };
  }

  /**
   * Restores common configuration. Unknown fields are ignored and newly introduced fields append.
   * @param {Partial<RecordViewState>|null} state Saved state.
   * @param {{silent?:boolean}} [options={}] Event behavior.
   * @returns {this}
   */
  setViewState(state, options = {}) {
    const normalized = normalizeViewState(state, this._viewFields);
    this._viewFieldOrder = normalized.fieldOrder;
    this._viewHidden = new Set(normalized.hiddenFields);
    this._viewSort = normalized.sort;
    if (this._viewSort && this.options.sortMode === 'local') this._sortViewData();
    this._refreshView('state');
    this._renderViewFieldControls();
    if (!options.silent) this._emitViewState('restore');
    return this;
  }

  /**
   * Builds the shared show/hide and ordering disclosure for a concrete view toolbar.
   * @protected
   * @param {string} [label='Fields'] Trigger label.
   * @returns {HTMLElement} Disclosure element.
   */
  _createViewFieldControls(label = 'Fields') {
    const list = h('div', { class: 'zx-record-view__field-list' });
    const details = h('details', { class: 'zx-record-view__field-controls' },
      h('summary', { class: 'zx-button zx-button--sm' }, icon('fields', { size: 13 }), label),
      list);
    this._viewFieldControls = details;
    this._viewFieldList = list;
    this._renderViewFieldControls();
    this.listen(list, 'change', (event) => {
      const input = /** @type {HTMLInputElement|null} */ (event.target);
      if (input?.classList.contains('zx-record-view__field-toggle')) {
        this.setFieldVisible(input.value, input.checked);
      }
    });
    this.listen(list, 'click', (event) => {
      const button = /** @type {Element|null} */ (event.target)?.closest?.('[data-view-field-action]');
      if (!button) return;
      const id = /** @type {HTMLElement} */ (button).dataset.fieldId;
      const action = /** @type {HTMLElement} */ (button).dataset.viewFieldAction;
      const index = this._viewFieldOrder.indexOf(String(id));
      if (action === 'up' && index > 0) this.moveField(String(id), this._viewFieldOrder[index - 1], 'before');
      if (action === 'down' && index >= 0 && index < this._viewFieldOrder.length - 1) {
        this.moveField(String(id), this._viewFieldOrder[index + 1], 'after');
      }
    });
    return details;
  }

  /** Concrete renderers override this hook. @protected @param {string} _reason Refresh reason. @returns {void} */
  _refreshView(_reason) {}

  /** Reads one record's stable id. @protected @param {ViewRecord} record Record. @returns {unknown} */
  _viewRecordId(record) {
    return viewRecordId(record, this.options.recordId);
  }

  /** Returns whether a record is selected. @protected @param {unknown} id Record id. @returns {boolean} */
  _isViewSelected(id) {
    return this._viewSelected.has(id);
  }

  /** Sorts the internal record copy. @private @returns {void} */
  _sortViewData() {
    if (!this._viewSort) return;
    this._viewData = sortViewRecords(this._viewData, this._viewFields, this._viewSort);
  }

  /** @private @param {unknown[]} selection @returns {void} */
  _setInitialSelection(selection) {
    const requested = new Set(Array.isArray(selection) ? selection : []);
    const available = this._viewData.map((record) => this._viewRecordId(record));
    let selected = available.filter((id) => requested.has(id));
    if (this.options.selectable === false) selected = [];
    if (this.options.selectable === 'single') selected = selected.slice(0, 1);
    this._viewSelected = new Set(selected);
    this._viewSelectionAnchor = selected.at(-1) ?? null;
  }

  /** @private @returns {boolean} */
  _pruneViewSelection() {
    const available = new Set(this._viewData.map((record) => this._viewRecordId(record)));
    const next = new Set([...this._viewSelected].filter((id) => available.has(id)));
    const changed = !setEqual(next, this._viewSelected);
    this._viewSelected = next;
    if (this._viewSelectionAnchor != null && !available.has(this._viewSelectionAnchor)) {
      this._viewSelectionAnchor = null;
    }
    return changed;
  }

  /** @private @returns {void} */
  _emitViewSelection() {
    this.emit('selectionchange', { records: this.getSelection(), ids: this.getSelectionIds() });
  }

  /** @private @param {string} reason @returns {void} */
  _emitViewState(reason) {
    this.emit('statechange', { state: this.getViewState(), reason });
  }

  /** @private @param {string|null} [focusId=null] @returns {void} */
  _renderViewFieldControls(focusId = null) {
    if (!this._viewFieldList) return;
    const fields = this.getFields();
    const visible = fields.filter((field) => !this._viewHidden.has(field.id));
    this._viewFieldControls.hidden = fields.length === 0;
    const controls = fields.map((field, index) => {
      const toggle = h('input', {
        class: 'zx-record-view__field-toggle',
        type: 'checkbox',
        value: field.id,
        checked: !this._viewHidden.has(field.id),
        disabled: !this._viewHidden.has(field.id) && visible.length === 1
      });
      const up = h('button', {
        class: 'zx-record-view__field-move',
        type: 'button',
        ariaLabel: `Move ${field.label} up`,
        disabled: index === 0,
        dataset: { viewFieldAction: 'up', fieldId: field.id }
      }, icon('chevron-up', { size: 11 }));
      const down = h('button', {
        class: 'zx-record-view__field-move',
        type: 'button',
        ariaLabel: `Move ${field.label} down`,
        disabled: index === fields.length - 1,
        dataset: { viewFieldAction: 'down', fieldId: field.id }
      }, icon('chevron-down', { size: 11 }));
      return h('div', { class: 'zx-record-view__field-option' },
        h('label', {}, toggle, h('span', {}, field.label)),
        h('span', { class: 'zx-record-view__field-order' }, up, down));
    });
    this._viewFieldList.replaceChildren(...controls);
    if (focusId != null) {
      const match = [...this._viewFieldList.querySelectorAll('.zx-record-view__field-toggle')]
        .find((control) => /** @type {HTMLInputElement} */ (control).value === focusId);
      queueMicrotask(() => {
        if (match?.isConnected) /** @type {HTMLElement} */ (match).focus();
      });
    }
  }
}

/**
 * Validates and clones field descriptors.
 * @param {ViewField[]} fields Fields.
 * @returns {ViewField[]} Normalized fields.
 */
export function normalizeViewFields(fields) {
  if (!Array.isArray(fields)) throw new TypeError('Record view fields must be an array');
  const seen = new Set();
  return fields.map((field, index) => {
    if (!field || typeof field !== 'object' || Array.isArray(field)) {
      throw new TypeError(`Record view field at index ${index} must be an object`);
    }
    const id = String(field.id ?? '').trim();
    if (!id) throw new TypeError(`Record view field at index ${index} requires an id`);
    if (seen.has(id)) throw new TypeError(`Duplicate record view field: ${id}`);
    seen.add(id);
    return {
      ...field,
      id,
      label: String(field.label ?? humanizeViewField(id)),
      sortable: Boolean(field.sortable),
      type: String(field.type ?? 'text')
    };
  });
}

/**
 * Reconciles a partial or stale order with all current fields.
 * @param {ViewField[]} fields Current fields.
 * @param {unknown} order Preferred ids.
 * @returns {string[]} Complete order.
 */
export function reconcileFieldOrder(fields, order) {
  const available = fields.map((field) => field.id);
  const allowed = new Set(available);
  const preferred = Array.isArray(order) ? order.map(String) : [];
  return [...new Set(preferred.filter((id) => allowed.has(id))),
    ...available.filter((id) => !preferred.includes(id))];
}

/**
 * Moves one id in an immutable order.
 * @param {string[]} order Current order.
 * @param {string} id Moving id.
 * @param {string} targetId Target id.
 * @param {'before'|'after'} [position='before'] Target edge.
 * @returns {string[]} Next order, or an unchanged copy for invalid moves.
 */
export function moveViewField(order, id, targetId, position = 'before') {
  const next = [...order];
  const from = next.indexOf(id);
  const target = next.indexOf(targetId);
  if (from < 0 || target < 0 || from === target) return next;
  next.splice(from, 1);
  let insertion = next.indexOf(targetId) + (position === 'after' ? 1 : 0);
  insertion = Math.max(0, Math.min(next.length, insertion));
  next.splice(insertion, 0, id);
  return next;
}

/**
 * Reads one field through its accessor or record property.
 * @param {ViewField} field Field.
 * @param {ViewRecord} record Record.
 * @param {number} [index=0] Display index.
 * @returns {unknown} Field value.
 */
export function readViewField(field, record, index = 0) {
  return typeof field.get === 'function' ? field.get(record, index) : record?.[field.id];
}

/**
 * Resolves display content without parsing HTML.
 * @param {ViewField} field Field.
 * @param {ViewRecord} record Record.
 * @param {number} [index=0] Display index.
 * @returns {Node|string|number|null|undefined} Rendered content.
 */
export function renderViewField(field, record, index = 0) {
  const value = readViewField(field, record, index);
  return typeof field.render === 'function' ? field.render(record, index, value) : value == null ? '' : String(value);
}

/**
 * Stably sorts a cloned record array by one shared field descriptor.
 * @param {ViewRecord[]} records Records.
 * @param {ViewField[]} fields Fields.
 * @param {ViewSort|null} sort Sort.
 * @returns {ViewRecord[]} Sorted copy.
 */
export function sortViewRecords(records, fields, sort) {
  if (!sort) return [...records];
  const field = fields.find((candidate) => candidate.id === sort.id);
  if (!field) return [...records];
  const indexes = new WeakMap(records.map((record, index) => [record, index]));
  return sortRows(records, (record) => typeof field.sortValue === 'function'
    ? field.sortValue(record, indexes.get(record) ?? 0)
    : readViewField(field, record, indexes.get(record) ?? 0), sort.dir);
}

/**
 * Normalizes saved common state against current fields.
 * @param {Partial<RecordViewState>|null|undefined} state Saved state.
 * @param {ViewField[]} fields Current normalized fields.
 * @returns {RecordViewState} Reconciled state.
 */
export function normalizeViewState(state, fields) {
  const source = state && typeof state === 'object' ? state : {};
  return {
    version: 1,
    fieldOrder: reconcileFieldOrder(fields, source.fieldOrder),
    hiddenFields: [...normalizeHiddenFields(fields, source.hiddenFields)],
    sort: normalizeViewSort(source.sort, fields)
  };
}

/** Reads a stable record id. @param {ViewRecord} record @param {string|((record:ViewRecord)=>unknown)} accessor @returns {unknown} */
export function viewRecordId(record, accessor) {
  return typeof accessor === 'function' ? accessor(record) : record?.[String(accessor ?? 'ID')];
}

/** @param {ViewSort|null|undefined} sort @param {ViewField[]} fields @returns {ViewSort|null} */
function normalizeViewSort(sort, fields) {
  if (!sort || typeof sort !== 'object') return null;
  const id = String(sort.id ?? '');
  const field = fields.find((candidate) => candidate.id === id);
  if (!field || !field.sortable) return null;
  return { id, dir: sort.dir === 'desc' ? 'desc' : 'asc' };
}

/** @param {ViewField[]} fields @param {unknown} hidden @param {boolean} [includeDefaults=false] @returns {Set<string>} */
function normalizeHiddenFields(fields, hidden, includeDefaults = false) {
  const fieldIds = new Set(fields.map((field) => field.id));
  const result = new Set(Array.isArray(hidden) ? hidden.map(String).filter((id) => fieldIds.has(id)) : []);
  if (includeDefaults) for (const field of fields) if (field.visible === false) result.add(field.id);
  if (result.size >= fields.length && fields[0]) result.delete(fields[0].id);
  return result;
}

/** @param {unknown} records @returns {ViewRecord[]} */
function normalizeViewRecords(records) {
  if (!Array.isArray(records)) throw new TypeError('Record view data must be an array');
  records.forEach(assertViewRecord);
  return [...records];
}

/** @param {unknown} record @returns {asserts record is ViewRecord} */
function assertViewRecord(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    throw new TypeError('Record view data entries must be objects');
  }
}

/** @param {unknown} value @returns {string} */
function humanizeViewField(value) {
  const source = String(value).split('.').at(-1) ?? '';
  if (source === 'ID') return 'ID';
  const text = source.replace(/([a-z\d])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : source;
}

/** @param {ViewSort|null} left @param {ViewSort|null} right @returns {boolean} */
function sameSort(left, right) {
  return left === null && right === null || Boolean(left && right && left.id === right.id && left.dir === right.dir);
}

/** @param {unknown[]} left @param {unknown[]} right @returns {boolean} */
function arraysEqual(left, right) {
  return left.length === right.length && left.every((value, index) => Object.is(value, right[index]));
}

/** @param {Set<unknown>} left @param {Set<unknown>} right @returns {boolean} */
function setEqual(left, right) {
  return left.size === right.size && [...left].every((value) => right.has(value));
}
