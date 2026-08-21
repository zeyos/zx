import { Component } from '../../core/component.js';
import { breakpoints, onBreakpoint } from '../../core/breakpoint.js';
import { h } from '../../core/dom.js';
import { uid } from '../../core/util.js';
import { Datebox } from '../datebox/datebox.js';
import { NumberField } from '../number-field/number-field.js';
import { Select } from '../select/select.js';
import { Toggle } from '../toggle/toggle.js';
import { sortRows } from './sort.js';

/** @typedef {Record<string, any>} TableRow */
/** @typedef {'asc'|'desc'} TableSortDirection */
/** @typedef {false|'single'|'multi'} TableSelectionMode */
/** @typedef {false|'cell'|'row'} TableEditMode */
/** @typedef {'text'|'number'|'select'|'date'|'checkbox'|'textarea'|'custom'} TableEditorType */
/** @typedef {{value: unknown, label: string}} TableEditorOption */

/**
 * Editing handle handed to a custom `column.editor`.
 * @typedef {Object} TableEditorApi
 * @property {unknown} value Value the cell holds when the editor opens.
 * @property {(value: unknown) => void} commit Commits the edit with the given value.
 * @property {() => void} cancel Cancels the edit and restores the cell.
 * @property {TableRow} row Row being edited.
 * @property {TableColumn} column Column being edited.
 */

/**
 * @typedef {Object} TableColumn
 * @property {string} id Row property and stable column identifier.
 * @property {string} label Visible header label.
 * @property {boolean} [sortable=false] Whether the header changes the active sort.
 * @property {string} [width='auto'] CSS width, `auto`, or an `fr` proportion. `fr` values are
 * converted into proportional percentages on `<col>` elements and enable `table-layout: fixed`;
 * this preserves a single aligned header/body table without measuring layout in JavaScript.
 * @property {'start'|'center'|'end'|'left'|'right'} [align='start'] Cell alignment.
 * @property {(row: TableRow, rowIndex: number) => Node|string|number|null|undefined} [render]
 * Cell renderer. Non-Node results are inserted as text.
 * @property {(row: TableRow) => unknown} [sortValue] Sort-value accessor.
 * @property {string} [headerTitle] Header tooltip.
 * @property {boolean} [popin=true] While stacked, whether this column becomes a labelled line.
 * `false` keeps it in the card's headline — the identifying columns usually want that.
 * @property {boolean|TableEditorType|((row: TableRow) => boolean|TableEditorType)} [editable=false]
 * Editor for this column while the table runs with `editMode`. `true` means `'text'`; a function is
 * evaluated per row so individual rows stay read-only.
 * @property {TableEditorOption[]|Record<string, string>|((row: TableRow) => TableEditorOption[]|Record<string, string>)} [options]
 * Choices for an `'select'` editor: `[{value, label}]`, a `{value: label}` map, or a row callback.
 * @property {Record<string, unknown>} [editorProps] Options forwarded to the underlying editor
 * component (NumberField, Select, Datebox, Toggle) or to the generated `<input>`/`<textarea>`.
 * @property {(row: TableRow, api: TableEditorApi) => Node|{toElement: () => Node, destroy?: () => void}} [editor]
 * Fully custom editor. Wins over `editable`, except that a per-row `editable` function returning
 * `false` still marks the cell read-only. A returned Zx component is destroyed with the edit.
 * @property {(raw: unknown, row: TableRow) => unknown} [parse] Converts the editor's raw output into
 * the value written back into the row.
 * @property {(value: unknown, row: TableRow) => string} [format] Renders the value as the initial
 * text of a `'text'` or `'textarea'` editor.
 * @property {(value: unknown, row: TableRow) => true|string} [validate] Commit guard. A returned
 * string marks the cell invalid, shows the message, and refuses the commit.
 */

/**
 * @typedef {Object} TableOptions
 * @property {TableColumn[]} [columns=[]] Column definitions.
 * @property {TableRow[]} [data=[]] Initial rows.
 * @property {string|((row: TableRow) => unknown)} [rowId='ID'] Row id accessor.
 * @property {{id: string, dir: TableSortDirection}|null} [sort=null] Initial sort.
 * @property {'local'|'server'} [sortMode='local'] Whether sorting reorders local rows.
 * @property {TableSelectionMode} [selectable=false] Row selection mode.
 * @property {boolean} [stickyHeader=true] Whether column headers stick while scrolling.
 * @property {false|'sm'|'md'|'lg'|'xl'} [responsive=false] Width below which each row stacks into a
 * card of label/value pairs instead of scrolling sideways. Measured on the table's own container,
 * not the viewport, so a table inside a split pane stacks when *it* is narrow.
 * @property {number|string|null} [height=null] Scroll-region height in pixels or CSS units.
 * @property {string|Node|(() => Node|string)|null} [emptyText=null] What to show when there are no
 * rows; null resolves `table.empty`. A Node — an `emptyState()` with an action in it, say — is
 * placed as given, and a function is called on each render, which is what to use when the
 * placeholder holds live controls.
 * @property {((row: TableRow) => string)|null} [rowClass=null] Additional row class callback.
 * @property {boolean} [zebra=true] Whether alternate rows use the zebra background.
 * @property {TableEditMode} [editMode=false] Inline editing mode. `'cell'` edits one cell, `'row'`
 * opens every editable cell of the row together and commits them as a unit. Editing is completely
 * inert while this is `false`.
 * @property {(event: CustomEvent<TableRowClickDetail>) => void} [onrowclick]
 * @property {(event: CustomEvent<TableRowClickDetail>) => void} [onrowdblclick]
 * @property {(event: CustomEvent<TableSortDetail>) => void} [onsort]
 * @property {(event: CustomEvent<TableSelectionDetail>) => void} [onselectionchange]
 * @property {(event: CustomEvent<TableDataDetail>) => void} [ondatachange]
 * @property {(event: CustomEvent<{stacked: boolean}>) => void} [onstackedchange] Fired when the
 * table crosses its `responsive` width in either direction.
 * @property {(event: CustomEvent<TableEditStartDetail>) => void} [oneditstart]
 * @property {(event: CustomEvent<TableEditCommitDetail>) => void} [oneditcommit]
 * @property {(event: CustomEvent<TableEditCancelDetail>) => void} [oneditcancel]
 * @property {(event: CustomEvent<TableEditInvalidDetail>) => void} [oneditinvalid]
 */

/**
 * @typedef {Object} TableRowClickDetail
 * @property {TableRow} row
 * @property {unknown} id
 * @property {number} index
 * @property {Event} event
 */

/** @typedef {{id: string, dir: TableSortDirection}} TableSortDetail */
/** @typedef {{rows: TableRow[], ids: unknown[]}} TableSelectionDetail */
/** @typedef {{rows: TableRow[]}} TableDataDetail */

/**
 * @typedef {Object} TableEditStartDetail
 * @property {TableRow} row Row being edited.
 * @property {unknown} id Row id.
 * @property {TableColumn|null} column Focused column.
 * @property {string} columnId Focused column id.
 * @property {unknown} value Value the editor opened with.
 */

/**
 * @typedef {Object} TableEditCommitDetail
 * @property {TableRow} row Row as it is before the commit.
 * @property {unknown} id Row id.
 * @property {TableColumn|null} column Focused column.
 * @property {string} columnId Focused column id.
 * @property {unknown} value Committed value of the focused column.
 * @property {unknown} previous Previous value of the focused column.
 * @property {Record<string, unknown>} changes Every changed cell of the row, keyed by column id.
 */

/**
 * @typedef {Object} TableEditCancelDetail
 * @property {TableRow} row Row that was being edited.
 * @property {unknown} id Row id.
 * @property {TableColumn|null} column Focused column.
 * @property {string} columnId Focused column id.
 */

/**
 * @typedef {Object} TableEditInvalidDetail
 * @property {TableRow} row Row being edited.
 * @property {unknown} id Row id.
 * @property {TableColumn|null} column Rejected column.
 * @property {string} columnId Rejected column id.
 * @property {unknown} value Rejected value.
 * @property {string} message Validation message.
 */

/**
 * Internal per-cell editor bookkeeping.
 * @typedef {Object} TableEditorEntry
 * @property {TableColumn} column Edited column.
 * @property {TableEditorType} type Resolved editor type.
 * @property {HTMLTableCellElement} td Edited cell.
 * @property {HTMLElement} host Element the editor lives in.
 * @property {HTMLElement|null} control Focusable control inside the editor.
 * @property {{destroy: () => void}|null} component Zx component instance, when the editor uses one.
 * @property {() => unknown} read Reads the editor's current value.
 * @property {() => void} destroy Destroys the editor and removes its DOM.
 */

/** Editor types accepted by `column.editable`. */
const EDITOR_TYPES = new Set(['text', 'number', 'select', 'date', 'checkbox', 'textarea']);
/** Selector used to find the focusable control inside a custom editor. */
const FOCUSABLE = 'input, textarea, select, button, [tabindex]:not([tabindex="-1"])';

/**
 * Semantic, sortable data table with optional single or checkbox-based multi-selection and
 * opt-in inline cell or row editing.
 * @fires Table#rowclick
 * @fires Table#rowdblclick
 * @fires Table#sort
 * @fires Table#selectionchange
 * @fires Table#datachange
 * @fires Table#editstart
 * @fires Table#editcommit
 * @fires Table#editcancel
 * @fires Table#editinvalid
 * @extends {Component<TableOptions>}
 */
export class Table extends Component {
  static cssName = 'table';

  /** @type {TableOptions} */
  static defaults = {
    columns: [],
    data: [],
    rowId: 'ID',
    sort: null,
    sortMode: 'local',
    selectable: false,
    stickyHeader: true,
    responsive: false,
    height: null,
    emptyText: null,
    rowClass: null,
    zebra: true,
    editMode: false
  };

  /**
   * Creates a table around a target or creates a new root when target is null.
   * @param {Element|string|null} target Existing root, selector, or null.
   * @param {TableOptions} [options={}] Table options.
   */
  constructor(target, options = {}) {
    super(target, options);
  }

  /** @returns {HTMLElement} Table root. */
  render() {
    const root = /** @type {HTMLElement} */ (this.el ?? h('div'));
    // Claimed here, not left to the base constructor: `_watchWidth()` below observes `this.el`,
    // and until this assignment it is null for a component creating its own root.
    this.el = root;
    this._originalChildren = this.el ? Array.from(this.el.childNodes) : null;
    this._columns = Array.isArray(this.options.columns) ? this.options.columns.map((column) => ({ ...column })) : [];
    this._data = Array.isArray(this.options.data) ? [...this.options.data] : [];
    this._selected = new Set();
    this._selectionAnchorId = null;
    this._sort = normalizeSort(this.options.sort, this._columns);
    this._rowMeta = new WeakMap();
    this._rowElements = new Map();
    this._restored = false;
    // Editing state. `_edit` is null unless a cell or row is currently open for editing; every
    // other member below is only ever touched while `_editMode !== false`.
    this._editMode = normalizeEditMode(this.options.editMode);
    this._edit = null;
    this._editMessage = null;
    this._stacked = false;
    this._width = null;
    this._rovingKey = null;
    this._rovingCell = null;
    this._rovingMatched = false;

    if (this._sort && this.options.sortMode === 'local') this._sortData();

    this._table = h('table', { class: 'zx-table__table' });
    this._colgroup = h('colgroup', { class: 'zx-table__columns' });
    this._thead = h('thead', { class: 'zx-table__head' });
    this._tbody = h('tbody', { class: 'zx-table__body' });
    this._table.append(this._colgroup, this._thead, this._tbody);

    this._scroll = h('div', {
      class: 'zx-table__scroll',
      dataset: {
        stickyHeader: String(Boolean(this.options.stickyHeader)),
        zebra: String(Boolean(this.options.zebra))
      }
    }, this._table);
    if (this.options.height != null) {
      this._scroll.style.blockSize = typeof this.options.height === 'number' ?
        `${this.options.height}px` : String(this.options.height);
    }
    if (this._editMode === false) {
      root.replaceChildren(this._scroll);
    } else {
      root.dataset.editMode = this._editMode;
      // Always present and empty rather than hidden: a live region that is revealed together with
      // its text is frequently missed by screen readers.
      this._editMessage = h('div', {
        class: 'zx-table__message',
        id: uid('zx-table-message'),
        role: 'status',
        ariaLive: 'polite'
      });
      root.replaceChildren(this._scroll, this._editMessage);
    }

    this._renderColumns();
    this._renderHeader();
    this._renderBody();
    this._watchWidth();
    this.listen(this._tbody, 'click', (event) => this._handleBodyClick(event));
    this.listen(this._tbody, 'dblclick', (event) => this._handleBodyDoubleClick(event));
    if (this._editMode !== false) {
      this.listen(this._tbody, 'keydown', (event) => this._handleEditKeydown(/** @type {KeyboardEvent} */ (event)));
      this.listen(this._tbody, 'focusin', (event) => this._handleEditFocusIn(event));
      this.listen(document, 'pointerdown', (event) => this._handleDocumentPointerDown(event), { capture: true });
    }
    return root;
  }

  /**
   * Toggles a loading state. While loading, the body is dimmed, an indeterminate progress bar is
   * shown, and `aria-busy` is set — a lightweight take on the busy/skeleton pattern used by
   * enterprise tables (SAP UI5, Salesforce SLDS). Call `setLoading(false)` (or `setData`) when done.
   * @param {boolean} [loading=true] Whether the table is loading.
   * @returns {this}
   */
  setLoading(loading = true) {
    if (loading) this.el.dataset.loading = 'true';
    else delete this.el.dataset.loading;
    this.el.setAttribute('aria-busy', String(Boolean(loading)));
    return this;
  }

  /**
   * Replaces all rows.
   * @param {TableRow[]} rows New rows.
   * @returns {this}
   * @fires Table#datachange
   * @fires Table#editcancel
   */
  setData(rows) {
    this.setLoading(false);
    assertRows(rows);
    this._data = [...rows];
    if (this._sort && this.options.sortMode === 'local') this._sortData();
    const selectionChanged = this._pruneSelection();
    this._renderBody();
    if (selectionChanged) this._emitSelectionChange();
    this._emitDataChange();
    return this;
  }

  /**
   * Appends rows to the current data.
   * @param {TableRow[]} rows Rows to append.
   * @returns {this}
   * @fires Table#datachange
   * @fires Table#editcancel
   */
  addData(rows) {
    assertRows(rows);
    this._data.push(...rows);
    if (this._sort && this.options.sortMode === 'local') this._sortData();
    this._renderBody();
    this._emitDataChange();
    return this;
  }

  /**
   * Replaces the row identified by its current id.
   * @param {unknown} id Existing row id.
   * @param {TableRow} row Replacement row.
   * @returns {this}
   * @fires Table#datachange
   * @fires Table#editcancel
   */
  updateRow(id, row) {
    const index = this._data.findIndex((candidate) => Object.is(this._idFor(candidate), id));
    if (index < 0) return this;
    const wasSelected = this._selected.delete(id);
    this._data[index] = row;
    if (wasSelected) this._selected.add(this._idFor(row));
    if (this._sort && this.options.sortMode === 'local') this._sortData();
    this._renderBody();
    if (wasSelected && !Object.is(id, this._idFor(row))) this._emitSelectionChange();
    this._emitDataChange();
    return this;
  }

  /**
   * Removes the row with the given id.
   * @param {unknown} id Row id.
   * @returns {this}
   * @fires Table#selectionchange
   * @fires Table#datachange
   * @fires Table#editcancel
   */
  removeRow(id) {
    const index = this._data.findIndex((candidate) => Object.is(this._idFor(candidate), id));
    if (index < 0) return this;
    this._data.splice(index, 1);
    const selectionChanged = this._selected.delete(id);
    if (Object.is(this._selectionAnchorId, id)) this._selectionAnchorId = null;
    this._renderBody();
    if (selectionChanged) this._emitSelectionChange();
    this._emitDataChange();
    return this;
  }

  /**
   * Returns a row by id.
   * @param {unknown} id Row id.
   * @returns {TableRow|null} Matching row or null.
   */
  getRow(id) {
    return this._data.find((row) => Object.is(this._idFor(row), id)) ?? null;
  }

  /** @returns {TableRow[]} Shallow copy of current rows in display order. */
  getData() {
    return [...this._data];
  }

  /**
   * Removes all rows.
   * @returns {this}
   * @fires Table#selectionchange
   * @fires Table#datachange
   * @fires Table#editcancel
   */
  empty() {
    const selectionChanged = this._selected.size > 0;
    this._data = [];
    this._selected.clear();
    this._selectionAnchorId = null;
    this._renderBody();
    if (selectionChanged) this._emitSelectionChange();
    this._emitDataChange();
    return this;
  }

  /**
   * Activates a column sort. Local mode stably reorders data; server mode only updates the
   * header state and emits the request event.
   * @param {string} id Column id.
   * @param {TableSortDirection} [dir] Direction; omitted toggles the current column.
   * @param {{silent?: boolean}} [options={}] Event options.
   * @returns {this}
   * @fires Table#sort
   * @fires Table#editcancel
   */
  setSort(id, dir, options = {}) {
    // Server mode never re-renders the body, so the open editor is dropped here rather than in
    // `_renderBody()`.
    this._abortEdit({ focus: false });
    const column = this._columns.find((candidate) => candidate.id === id);
    if (!column) throw new RangeError(`Unknown table column: ${id}`);
    const direction = dir ?? (this._sort?.id === id && this._sort.dir === 'asc' ? 'desc' : 'asc');
    if (direction !== 'asc' && direction !== 'desc') {
      throw new TypeError('Table sort direction must be "asc" or "desc"');
    }
    this._sort = { id, dir: direction };
    if (this.options.sortMode === 'local') {
      this._sortData();
      this._renderBody();
    }
    this._syncSortHeader();
    if (!options.silent) this.emit('sort', { id, dir: direction });
    return this;
  }

  /** @returns {TableRow[]} Selected rows in current display order. */
  getSelection() {
    return this._data.filter((row) => this._selected.has(this._idFor(row)));
  }

  /**
   * Replaces selected ids, ignoring ids absent from the current data.
   * @param {unknown[]} ids Row ids.
   * @returns {this}
   * @fires Table#selectionchange
   */
  setSelection(ids) {
    if (!Array.isArray(ids)) throw new TypeError('Table selection must be an array of row ids');
    const valid = new Set(this._data.map((row) => this._idFor(row)));
    const next = new Set();
    if (this.options.selectable !== false) {
      for (const id of ids) {
        if (valid.has(id)) next.add(id);
        if (this.options.selectable === 'single' && next.size > 0) break;
      }
    }
    if (sameSet(this._selected, next)) return this;
    this._selected = next;
    this._syncSelection();
    this._emitSelectionChange();
    return this;
  }

  /**
   * Clears all selected rows.
   * @returns {this}
   * @fires Table#selectionchange
   */
  clearSelection() {
    if (this._selected.size === 0) return this;
    this._selected.clear();
    this._selectionAnchorId = null;
    this._syncSelection();
    this._emitSelectionChange();
    return this;
  }

  /**
   * Opens the editor for a cell. No-op unless the table runs with `editMode` and the column
   * resolves to an editable type for that row. In `'row'` mode every editable cell of the row is
   * opened and `columnId` only decides which editor receives focus. Any other open edit is
   * committed first.
   * @param {unknown} rowId Row id.
   * @param {string} columnId Column id.
   * @returns {this}
   * @fires Table#editstart
   */
  startEdit(rowId, columnId) {
    if (this._editMode === false) return this;
    const column = this._columns.find((candidate) => candidate.id === columnId);
    if (!column) return this;
    const current = this._data.find((candidate) => Object.is(this._idFor(candidate), rowId));
    if (current === undefined || resolveEditable(column, current) === false) return this;

    if (this._edit) {
      if (Object.is(this._edit.id, rowId) && this._edit.cells.has(columnId)) {
        this._edit.columnId = columnId;
        this._focusEditor(columnId);
        return this;
      }
      this.commitEdit();
      // A rejected or prevented commit keeps the previous editor open and wins over the new one.
      if (this._edit) return this;
    }

    // Resolve the row again: the commit above may have rewritten and re-sorted the data.
    const index = this._data.findIndex((candidate) => Object.is(this._idFor(candidate), rowId));
    if (index < 0) return this;
    const row = this._data[index];
    const tr = this._rowElements.get(rowId)?.[0];
    if (!tr) return this;
    const targets = this._editMode === 'row'
      ? this._columns.filter((candidate) => resolveEditable(candidate, row) !== false)
      : [column];
    /** @type {Map<string, TableEditorEntry>} */
    const cells = new Map();
    for (const target of targets) {
      const td = cellIn(tr, target.id);
      if (!td) continue;
      const entry = this._createEditor(td, target, row, index);
      if (entry) cells.set(target.id, entry);
    }
    if (cells.size === 0) return this;

    this._edit = { id: rowId, columnId, row, cells, tr };
    tr.dataset.editing = 'true';
    this.emit('editstart', { row, id: rowId, column, columnId, value: row?.[columnId] });
    this._focusEditor(columnId);
    return this;
  }

  /**
   * Commits the open edit. Validation runs first: the first column whose `validate` rejects marks
   * its cell invalid, emits `editinvalid`, and leaves the editor open. A listener may
   * `preventDefault()` the `editcommit` event — e.g. while a server round-trip is pending — which
   * also keeps the editor open. Otherwise every changed cell is written back through `updateRow()`,
   * so `datachange` fires exactly as it does for a programmatic row update.
   * @returns {this}
   * @fires Table#editcommit
   * @fires Table#editinvalid
   * @fires Table#datachange
   */
  commitEdit() {
    const edit = this._edit;
    if (!edit) return this;
    const row = this.getRow(edit.id) ?? edit.row;
    /** @type {Record<string, unknown>} */
    const values = {};
    for (const [columnId, entry] of edit.cells) values[columnId] = entry.read();

    const editedColumns = this._columns.filter((column) => edit.cells.has(column.id));
    const failure = firstValidationError(values, editedColumns, row, this._msgOr('table.invalid', 'Invalid value'));
    if (failure) {
      this._markInvalid(failure.columnId, failure.message);
      edit.columnId = failure.columnId;
      this.emit('editinvalid', {
        row,
        id: edit.id,
        column: this._columns.find((column) => column.id === failure.columnId) ?? null,
        columnId: failure.columnId,
        value: values[failure.columnId],
        message: failure.message
      });
      this._focusEditor(failure.columnId);
      return this;
    }
    this._clearInvalid();

    const changes = diffChanges(row, values);
    const columnId = edit.columnId;
    const event = this.emit('editcommit', {
      row,
      id: edit.id,
      column: this._columns.find((column) => column.id === columnId) ?? null,
      columnId,
      value: values[columnId],
      previous: row?.[columnId],
      changes
    });
    if (event.defaultPrevented) return this;

    const restoreFocus = this._editHasFocus();
    const updated = { ...row, ...changes };
    this._teardownEdit();
    if (Object.keys(changes).length > 0) this.updateRow(edit.id, updated);
    // Read the id back off the updated row: editing the id column itself moves the row's identity.
    if (restoreFocus) this._focusCell(this._idFor(updated), columnId);
    return this;
  }

  /**
   * Closes the open edit without writing anything back and returns focus to the cell.
   * @returns {this}
   * @fires Table#editcancel
   */
  cancelEdit() {
    this._abortEdit({ focus: true });
    return this;
  }

  /** @returns {boolean} Whether a cell or row is currently open for editing. */
  isEditing() {
    return this._edit !== null;
  }

  /** @returns {{id: unknown, columnId: string}|null} Row id and focused column id, or null. */
  getEditing() {
    return this._edit ? { id: this._edit.id, columnId: this._edit.columnId } : null;
  }

  /**
   * Watches the table's own width and stacks the rows below `responsive`.
   *
   * The width comes from `onBreakpoint` observing this element rather than the window, which is the
   * whole point of the option: a table inside a split pane or a modal has no idea how wide the
   * viewport is, and a media query would stack it on a phone while leaving it unreadable in a
   * 320px pane on a desktop.
   * @returns {void}
   */
  _watchWidth() {
    this._width?.destroy();
    this._width = null;
    const threshold = this.options.responsive;
    if (!threshold || !(threshold in breakpoints)) return;
    this._width = onBreakpoint(
      (_name, width) => this._setStacked(width > 0 && width < breakpoints[threshold]),
      { target: this.el }
    );
  }

  /**
   * Enters or leaves stacked mode.
   * @param {boolean} stacked Whether rows should stack.
   * @returns {void}
   * @fires Table#stackedchange
   */
  _setStacked(stacked) {
    if (this._stacked === stacked) return;
    this._stacked = stacked;
    this.el.toggleAttribute('data-stacked', stacked);
    this._applyStackedRoles(stacked);
    this.emit('stackedchange', { stacked });
  }

  /**
   * States the table roles explicitly while stacked, and removes them again on the way out.
   *
   * Stacking works by changing `display` on the table elements, and a table whose display is not
   * `table` loses its implicit ARIA roles — leaving a screen reader with a pile of generic blocks
   * where a table used to be. The roles are only asserted while the layout has taken them away.
   * @param {boolean} stacked Whether the roles should be present.
   * @returns {void}
   */
  _applyStackedRoles(stacked) {
    /** @type {Array<[Element|null, string]>} */
    const parts = [[this._table, 'table'], [this._thead, 'rowgroup'], [this._tbody, 'rowgroup']];
    for (const [element, role] of parts) {
      if (!element) continue;
      if (stacked) element.setAttribute('role', role);
      else element.removeAttribute('role');
    }
    for (const [selector, role] of [['tr', 'row'], ['td', 'cell'], ['th', 'columnheader']]) {
      for (const element of this._table.querySelectorAll(selector)) {
        if (stacked) element.setAttribute('role', role);
        else element.removeAttribute('role');
      }
    }
  }

  /**
   * Reports whether the rows are currently stacked.
   * @returns {boolean}
   */
  isStacked() {
    return Boolean(this._stacked);
  }

  /** Restores an enhanced target and releases all component listeners. @returns {void} */
  destroy() {
    this._teardownEdit();
    this._width?.destroy();
    this._width = null;
    if (this.el) delete this.el.dataset.editMode;
    if (!this._restored && this._originalChildren) {
      this.el.replaceChildren(...this._originalChildren);
      this._restored = true;
    }
    super.destroy();
  }

  /** @returns {void} */
  _renderColumns() {
    const fragment = document.createDocumentFragment();
    if (this.options.selectable === 'multi') {
      fragment.append(h('col', { class: 'zx-table__selection-column' }));
    }
    const fractions = this._columns.map((column) => parseFraction(column.width));
    const total = fractions.reduce((sum, value) => sum + value, 0);
    this._table.dataset.layout = total > 0 ? 'fixed' : 'auto';
    this._columns.forEach((column, index) => {
      const col = h('col');
      if (fractions[index] > 0) col.style.width = `${fractions[index] / total * 100}%`;
      else if (column.width && column.width !== 'auto') col.style.width = String(column.width);
      fragment.append(col);
    });
    this._colgroup.replaceChildren(fragment);
  }

  /** @returns {void} */
  _renderHeader() {
    const row = h('tr', { class: 'zx-table__header-row' });
    if (this.options.selectable === 'multi') {
      this._selectAll = h('input', {
        class: 'zx-table__checkbox zx-table__select-all',
        type: 'checkbox',
        ariaLabel: 'Select all rows'
      });
      const selectionHeader = h('th', {
        class: 'zx-table__selection-header',
        scope: 'col'
      }, this._selectAll);
      row.append(selectionHeader);
      this.listen(this._selectAll, 'click', () => {
        if (this._selectAll.checked) {
          for (const dataRow of this._data) this._selected.add(this._idFor(dataRow));
        } else {
          this._selected.clear();
        }
        this._selectionAnchorId = null;
        this._syncSelection();
        this._emitSelectionChange();
      });
    } else {
      this._selectAll = null;
    }

    this._headers = new Map();
    for (const column of this._columns) {
      const th = h('th', { scope: 'col' });
      if (column.align) th.dataset.align = column.align;
      if (column.headerTitle) th.title = column.headerTitle;
      if (column.sortable) {
        const button = h('button', {
          class: 'zx-table__sort-button',
          type: 'button'
        }, h('span', { class: 'zx-table__header-label' }, column.label));
        this.listen(button, 'click', () => {
          const direction = this._sort?.id === column.id && this._sort.dir === 'asc' ? 'desc' : 'asc';
          this.setSort(column.id, direction);
        });
        th.append(button);
      } else {
        th.append(h('span', { class: 'zx-table__header-label' }, column.label));
      }
      this._headers.set(column.id, th);
      row.append(th);
    }
    this._thead.replaceChildren(row);
    this._syncSortHeader();
  }

  /** @returns {void} @fires Table#editcancel */
  _renderBody() {
    // Every data mutation funnels through here, so this is the single place that guarantees no
    // editor component outlives the rows it was rendered into.
    this._abortEdit({ focus: false });
    const fragment = document.createDocumentFragment();
    this._rowMeta = new WeakMap();
    this._rowElements = new Map();
    this._rovingCell = null;
    this._rovingMatched = false;
    if (this._data.length === 0) {
      fragment.append(h('tr', { class: 'zx-table__empty-row' },
        h('td', {
          class: 'zx-table__empty',
          colspan: this._columns.length + (this.options.selectable === 'multi' ? 1 : 0)
        }, this._emptyContent())
      ));
    } else {
      this._data.forEach((row, index) => fragment.append(this._createRow(row, index)));
    }
    this._tbody.replaceChildren(fragment);
    this._syncSelectAll();
    if (this._stacked) this._applyStackedRoles(true);
  }

  /**
   * What to put in the empty row.
   *
   * An empty table is a screen in its own right — the place to say why there is nothing and what to
   * do about it — so this takes a node as readily as a string. A function is re-called on every
   * render, which matters when the placeholder contains a button: reusing one node would move the
   * same element between renders and quietly share its listeners.
   * @returns {Node|string}
   */
  _emptyContent() {
    const empty = this.options.emptyText;
    if (empty == null) return this.msg('table.empty');
    return typeof empty === 'function' ? empty() : empty;
  }

  /** @param {TableRow} row @param {number} index @returns {HTMLTableRowElement} */
  _createRow(row, index) {
    const id = this._idFor(row);
    const tr = /** @type {HTMLTableRowElement} */ (h('tr', { dataset: { row: '' } }));
    const rowClass = typeof this.options.rowClass === 'function' ? this.options.rowClass(row) : '';
    if (rowClass) tr.classList.add(...String(rowClass).split(/\s+/).filter(Boolean));
    if (this.options.selectable !== false) tr.setAttribute('aria-selected', String(this._selected.has(id)));
    this._rowMeta.set(tr, { row, id, index });
    const elements = this._rowElements.get(id) ?? [];
    elements.push(tr);
    this._rowElements.set(id, elements);

    if (this.options.selectable === 'multi') {
      const checkbox = h('input', {
        class: 'zx-table__checkbox zx-table__row-checkbox',
        type: 'checkbox',
        checked: this._selected.has(id),
        ariaLabel: `Select row ${index + 1}`
      });
      tr.append(h('td', { class: 'zx-table__selection-cell' }, checkbox));
    }

    this._columns.forEach((column) => {
      const cell = /** @type {HTMLTableCellElement} */ (h('td'));
      if (column.align) cell.dataset.align = column.align;
      // Written unconditionally: `responsive` can be switched on after the rows exist, and a
      // stacked cell has no column header above it to say what its value means.
      cell.dataset.label = column.label;
      if (column.popin === false) cell.dataset.popin = 'false';
      if (this._editMode !== false) {
        cell.dataset.column = column.id;
        if (resolveEditable(column, row) !== false) {
          cell.dataset.editable = 'true';
          cell.tabIndex = -1;
          this._offerRovingCell(cell, id, column.id);
        }
      }
      this._renderCellContent(cell, column, row, index);
      tr.append(cell);
    });
    return tr;
  }

  /**
   * Fills a cell with the column's rendered value, replacing anything already in it.
   * @param {HTMLTableCellElement} cell Target cell.
   * @param {TableColumn} column Column definition.
   * @param {TableRow} row Row data.
   * @param {number} index Row index.
   * @returns {void}
   */
  _renderCellContent(cell, column, row, index) {
    const value = typeof column.render === 'function' ? column.render(row, index) : row?.[column.id];
    if (value && typeof value === 'object' && typeof value.nodeType === 'number') cell.replaceChildren(value);
    else if (value != null) cell.replaceChildren(document.createTextNode(String(value)));
    else cell.replaceChildren();
  }

  /** @param {MouseEvent} event @returns {void} */
  _handleBodyClick(event) {
    const target = /** @type {Element|null} */ (event.target?.nodeType === 1 ? event.target : event.target?.parentElement);
    // Interacting with an open editor is never a row activation.
    if (this._edit && isInsideEditor(target)) return;
    const rowElement = target?.closest('tr[data-row]');
    if (!rowElement || !this._tbody.contains(rowElement)) return;
    const meta = this._rowMeta.get(rowElement);
    if (!meta) return;
    // Read the row metadata first: committing re-renders the body and detaches `rowElement`.
    if (this._edit) this.commitEdit();

    const checkbox = target.closest('.zx-table__row-checkbox');
    if (checkbox && this.options.selectable === 'multi') {
      this._toggleMultiSelection(meta, /** @type {HTMLInputElement} */ (checkbox).checked, event.shiftKey);
      return;
    }

    this.emit('rowclick', { ...meta, event });
    if (this.options.selectable === 'single' && !this._selected.has(meta.id)) {
      this._selected = new Set([meta.id]);
      this._selectionAnchorId = meta.id;
      this._syncSelection();
      this._emitSelectionChange();
    }
  }

  /** @param {MouseEvent} event @returns {void} @fires Table#editstart */
  _handleBodyDoubleClick(event) {
    const target = /** @type {Element|null} */ (event.target?.nodeType === 1 ? event.target : event.target?.parentElement);
    if (target?.closest('.zx-table__row-checkbox')) return;
    if (this._edit && isInsideEditor(target)) return;
    const rowElement = target?.closest('tr[data-row]');
    if (!rowElement || !this._tbody.contains(rowElement)) return;
    const meta = this._rowMeta.get(rowElement);
    if (!meta) return;
    if (this._editMode !== false) {
      const cell = target?.closest('td[data-editable="true"]');
      if (cell && this._tbody.contains(cell)) {
        // A double-click that opens an editor is an edit gesture, not a row activation.
        this.startEdit(meta.id, String(cell.dataset.column));
        return;
      }
    }
    this.emit('rowdblclick', { ...meta, event });
  }

  /**
   * Builds the editor for one cell and mounts it over the cell's content.
   * @param {HTMLTableCellElement} td Cell to edit.
   * @param {TableColumn} column Column definition.
   * @param {TableRow} row Row being edited.
   * @param {number} index Row index.
   * @returns {TableEditorEntry|null} Editor entry, or null when the column is read-only.
   */
  _createEditor(td, column, row, index) {
    const type = resolveEditable(column, row);
    if (type === false) return null;
    const value = row?.[column.id];
    const props = column.editorProps && typeof column.editorProps === 'object' ? column.editorProps : {};
    // The rendered content stays in the cell but invisible, so the column keeps its intrinsic width
    // while the editor — which is taken out of flow — can never change the row height.
    const shadow = h('span', { class: 'zx-table__cell-shadow', ariaHidden: 'true' });
    shadow.append(...td.childNodes);
    const host = h('div', { class: 'zx-table__editor', dataset: { editor: type } });
    td.replaceChildren(shadow, host);
    td.dataset.editing = 'true';

    /** @type {TableEditorEntry} */
    const entry = {
      column,
      type,
      td,
      host,
      control: null,
      component: null,
      read: () => value,
      destroy() {
        this.component?.destroy();
        this.host.remove();
      }
    };

    if (type === 'custom') {
      entry.custom = value;
      entry.read = () => parseCellValue(column, entry.custom, row);
      /** @type {TableEditorApi} */
      const api = {
        value,
        row,
        column,
        commit: (next) => {
          entry.custom = next;
          this.commitEdit();
        },
        cancel: () => this.cancelEdit()
      };
      const node = column.editor(row, api);
      // A custom editor may return a Node or a Zx component; a component is adopted so that it is
      // destroyed with the edit instead of outliving the row it was rendered into.
      if (node && typeof node.toElement === 'function') {
        if (typeof node.destroy === 'function') entry.component = node;
        host.append(node.toElement());
      } else if (node) {
        host.append(node);
      }
      entry.control = /** @type {HTMLElement|null} */ (host.querySelector(FOCUSABLE)) ?? host;
      return entry;
    }
    if (type === 'number') {
      const field = new NumberField(null, { ...props, value: value ?? null });
      host.append(field.el);
      entry.component = field;
      entry.control = field.getInput();
      entry.read = () => {
        // The field only parses its text on blur or Enter; a commit triggered by Tab or by a click
        // outside must not discard what the user has typed.
        field.set(field.getInput().value, { silent: true });
        return parseCellValue(column, field.get(), row);
      };
      return entry;
    }
    if (type === 'select') {
      const items = normalizeEditorOptions(column.options, row);
      // Fall back to a loose match so `{value: label}` maps (whose keys are always strings) still
      // open on the right option for a numeric row value.
      const match = items.find((item) => Object.is(item.value, value))
        ?? items.find((item) => String(item.value) === String(value ?? ''));
      const select = new Select(null, {
        ...props, items, valueKey: 'value', labelKey: 'label', value: match ? match.value : null
      });
      host.append(select.el);
      entry.component = select;
      entry.control = /** @type {HTMLElement} */ (select.refs.input);
      entry.read = () => parseCellValue(column, select.value, row);
      return entry;
    }
    if (type === 'date') {
      const datebox = new Datebox(null, { ...props, value: value ?? null });
      host.append(datebox.el);
      entry.component = datebox;
      const dateInput = /** @type {HTMLInputElement} */ (datebox.refs.input);
      entry.control = dateInput;
      entry.read = () => {
        // Same as the number editor: push the typed text through the box's own parser, but keep
        // the previous date when it cannot be read rather than clearing the cell.
        const text = String(dateInput.value ?? '').trim();
        const previous = datebox.get();
        if (text === '') return parseCellValue(column, null, row);
        datebox.set(text, { silent: true });
        if (datebox.get() === null) datebox.set(previous, { silent: true });
        return parseCellValue(column, datebox.get(), row);
      };
      return entry;
    }
    if (type === 'checkbox') {
      const toggle = new Toggle(null, { ...props, checked: Boolean(value) });
      host.append(toggle.el);
      entry.component = toggle;
      entry.control = /** @type {HTMLElement} */ (toggle.el);
      entry.read = () => parseCellValue(column, toggle.get(), row);
      return entry;
    }

    const textarea = type === 'textarea';
    const input = /** @type {HTMLInputElement|HTMLTextAreaElement} */ (h(textarea ? 'textarea' : 'input', {
      ...props,
      class: textarea ? 'zx-table__editor-input zx-table__editor-textarea' : 'zx-table__editor-input',
      ...(textarea ? {} : { type: 'text' }),
      ariaLabel: props.ariaLabel ?? `${column.label} row ${index + 1}`,
      value: formatCellValue(column, value, row)
    }));
    host.append(input);
    entry.control = input;
    entry.read = () => parseCellValue(column, input.value, row);
    return entry;
  }

  /**
   * Moves focus into one of the open editors.
   * @param {string} columnId Column id.
   * @returns {void}
   */
  _focusEditor(columnId) {
    const entry = this._edit?.cells.get(columnId);
    const control = entry?.control;
    if (!control || typeof control.focus !== 'function') return;
    control.focus();
    // Opening a text editor selects its content, so typing replaces the old value.
    if (entry.type === 'text' && typeof control.select === 'function') control.select();
  }

  /**
   * Moves focus back onto a cell.
   * @param {unknown} id Row id.
   * @param {string} columnId Column id.
   * @returns {void}
   */
  _focusCell(id, columnId) {
    const tr = this._rowElements.get(id)?.[0];
    const td = tr ? cellIn(tr, columnId) : null;
    td?.focus();
  }

  /** Destroys every open editor and restores the cells they covered. @returns {void} */
  _teardownEdit() {
    const edit = this._edit;
    if (!edit) return;
    this._edit = null;
    const index = this._data.findIndex((candidate) => Object.is(this._idFor(candidate), edit.id));
    const row = index < 0 ? edit.row : this._data[index];
    for (const entry of edit.cells.values()) {
      entry.destroy();
      delete entry.td.dataset.editing;
      delete entry.td.dataset.invalid;
      this._renderCellContent(entry.td, entry.column, row, index < 0 ? 0 : index);
    }
    edit.cells.clear();
    delete edit.tr.dataset.editing;
    this._clearInvalid();
  }

  /**
   * Cancels the open edit, optionally returning focus to its cell.
   * @param {{focus?: boolean}} [options={}] Whether focus returns to the edited cell.
   * @returns {void}
   * @fires Table#editcancel
   */
  _abortEdit({ focus = true } = {}) {
    const edit = this._edit;
    if (!edit) return;
    const restoreFocus = focus && this._editHasFocus();
    const row = this.getRow(edit.id) ?? edit.row;
    const column = this._columns.find((candidate) => candidate.id === edit.columnId) ?? null;
    this._teardownEdit();
    if (restoreFocus) this._focusCell(edit.id, edit.columnId);
    this.emit('editcancel', { row, id: edit.id, column, columnId: edit.columnId });
  }

  /** @returns {boolean} Whether focus currently sits inside this table. */
  _editHasFocus() {
    const active = document.activeElement;
    return Boolean(active && this.el?.contains(active));
  }

  /**
   * Marks one edited cell invalid and announces the message.
   * @param {string} columnId Rejected column id.
   * @param {string} message Validation message.
   * @returns {void}
   */
  _markInvalid(columnId, message) {
    this._clearInvalid();
    const entry = this._edit?.cells.get(columnId);
    if (!entry) return;
    entry.td.dataset.invalid = 'true';
    entry.control?.setAttribute('aria-invalid', 'true');
    if (!this._editMessage) return;
    entry.control?.setAttribute('aria-describedby', this._editMessage.id);
    this._editMessage.textContent = message;
  }

  /** Clears the invalid marks and the validation message. @returns {void} */
  _clearInvalid() {
    if (this._edit) {
      for (const entry of this._edit.cells.values()) {
        delete entry.td.dataset.invalid;
        entry.control?.removeAttribute('aria-invalid');
        entry.control?.removeAttribute('aria-describedby');
      }
    }
    if (this._editMessage) this._editMessage.textContent = '';
  }

  /**
   * Handles Enter/F2 on a focused cell and Escape/Enter/Tab inside an open editor.
   * @param {KeyboardEvent} event Keydown event.
   * @returns {void}
   */
  _handleEditKeydown(event) {
    const target = /** @type {Element|null} */ (event.target?.nodeType === 1 ? event.target : event.target?.parentElement);
    if (!target) return;

    if (this._edit && isInsideEditor(target)) {
      // An open combobox list or calendar owns these keys until it closes again.
      if (deferToEditor(target)) return;
      if (event.key === 'Escape') {
        if (event.defaultPrevented) return;
        event.preventDefault();
        this.cancelEdit();
        return;
      }
      if (event.key === 'Enter') {
        if (target.localName === 'textarea' && event.shiftKey) return;
        event.preventDefault();
        this.commitEdit();
        return;
      }
      if (event.key === 'Tab') this._moveEdit(event);
      return;
    }

    if (event.key !== 'Enter' && event.key !== 'F2') return;
    const cell = target.closest('td[data-editable="true"]');
    if (!cell || !this._tbody.contains(cell)) return;
    const meta = this._rowMeta.get(cell.parentElement);
    if (!meta) return;
    event.preventDefault();
    this.startEdit(meta.id, String(cell.dataset.column));
  }

  /**
   * Commits the current editor and moves the edit one editable cell forward or backward.
   * @param {KeyboardEvent} event Tab keydown.
   * @returns {void}
   */
  _moveEdit(event) {
    const edit = this._edit;
    if (!edit) return;
    const direction = event.shiftKey ? -1 : 1;
    const index = this._data.findIndex((candidate) => Object.is(this._idFor(candidate), edit.id));
    const next = this._nextEditableCell(index, edit.columnId, direction);

    if (next && Object.is(next.id, edit.id) && edit.cells.has(next.columnId)) {
      // Row mode: the neighbouring editor is already open, so this is a plain focus move.
      event.preventDefault();
      edit.columnId = next.columnId;
      this._focusEditor(next.columnId);
      return;
    }
    if (!next) {
      // Past the last editable cell: commit, then let the browser move focus out of the table.
      this.commitEdit();
      if (this._edit) event.preventDefault();
      return;
    }
    event.preventDefault();
    this.commitEdit();
    if (!this._edit) this.startEdit(next.id, next.columnId);
  }

  /**
   * Finds the next editable cell, wrapping from the end of a row into the next row.
   * @param {number} rowIndex Row index to start from.
   * @param {string} columnId Column id to start from.
   * @param {number} direction `1` forward, `-1` backward.
   * @returns {{id: unknown, columnId: string, index: number}|null} Next cell, or null at the end.
   */
  _nextEditableCell(rowIndex, columnId, direction) {
    const columnCount = this._columns.length;
    if (rowIndex < 0 || columnCount === 0) return null;
    let row = rowIndex;
    let column = this._columns.findIndex((candidate) => candidate.id === columnId);
    const limit = this._data.length * columnCount + columnCount;
    for (let step = 0; step < limit; step += 1) {
      column += direction;
      if (column >= columnCount) {
        row += 1;
        column = 0;
      } else if (column < 0) {
        row -= 1;
        column = columnCount - 1;
      }
      if (row < 0 || row >= this._data.length) return null;
      const candidateRow = this._data[row];
      const candidateColumn = this._columns[column];
      if (resolveEditable(candidateColumn, candidateRow) !== false) {
        return { id: this._idFor(candidateRow), columnId: candidateColumn.id, index: row };
      }
    }
    return null;
  }

  /** @param {Event} event @returns {void} */
  _handleEditFocusIn(event) {
    const target = /** @type {Element|null} */ (event.target?.nodeType === 1 ? event.target : null);
    const cell = target?.closest('td[data-editable="true"]');
    if (!cell || !this._tbody.contains(cell)) return;
    const meta = this._rowMeta.get(cell.parentElement);
    if (!meta) return;
    this._setRovingCell(/** @type {HTMLTableCellElement} */ (cell), meta.id, String(cell.dataset.column));
  }

  /** @param {Event} event @returns {void} @fires Table#editcommit */
  _handleDocumentPointerDown(event) {
    if (!this._edit) return;
    const target = /** @type {Element|null} */ (event.target?.nodeType === 1 ? event.target : event.target?.parentElement);
    if (target && isInsideEditor(target)) return;
    // Pointer events inside the body are resolved by the click handler, which commits there and
    // still reports `rowclick`.
    if (target && this._tbody.contains(target)) return;
    this.commitEdit();
  }

  /**
   * Keeps exactly one editable cell in the tab order, preferring the last focused one.
   * @param {HTMLTableCellElement} cell Newly rendered editable cell.
   * @param {unknown} id Row id.
   * @param {string} columnId Column id.
   * @returns {void}
   */
  _offerRovingCell(cell, id, columnId) {
    if (this._rovingMatched) return;
    const preferred = this._rovingKey !== null
      && Object.is(this._rovingKey.id, id) && this._rovingKey.columnId === columnId;
    if (!preferred && this._rovingCell) return;
    if (preferred && this._rovingCell) this._rovingCell.tabIndex = -1;
    cell.tabIndex = 0;
    this._rovingCell = cell;
    this._rovingMatched = preferred;
  }

  /** @param {HTMLTableCellElement} cell @param {unknown} id @param {string} columnId @returns {void} */
  _setRovingCell(cell, id, columnId) {
    if (this._rovingCell && this._rovingCell !== cell) this._rovingCell.tabIndex = -1;
    cell.tabIndex = 0;
    this._rovingCell = cell;
    this._rovingMatched = true;
    this._rovingKey = { id, columnId };
  }

  /**
   * Resolves a message key with an English fallback for hosts without a translator.
   * @param {string} key Message key.
   * @param {string} fallback Text used when the key is untranslated.
   * @returns {string}
   */
  _msgOr(key, fallback) {
    const message = this.msg(key);
    return message === key ? fallback : message;
  }

  /** @param {{row: TableRow, id: unknown, index: number}} meta @param {boolean} checked @param {boolean} shiftKey @returns {void} */
  _toggleMultiSelection(meta, checked, shiftKey) {
    const anchorIndex = this._data.findIndex((row) => Object.is(this._idFor(row), this._selectionAnchorId));
    if (shiftKey && anchorIndex >= 0) {
      const start = Math.min(anchorIndex, meta.index);
      const end = Math.max(anchorIndex, meta.index);
      for (let index = start; index <= end; index += 1) {
        const id = this._idFor(this._data[index]);
        if (checked) this._selected.add(id);
        else this._selected.delete(id);
      }
    } else if (checked) {
      this._selected.add(meta.id);
    } else {
      this._selected.delete(meta.id);
    }
    this._selectionAnchorId = meta.id;
    this._syncSelection();
    this._emitSelectionChange();
  }

  /** @returns {void} */
  _syncSelection() {
    for (const [id, rows] of this._rowElements) {
      const selected = this._selected.has(id);
      for (const row of rows) {
        row.setAttribute('aria-selected', String(selected));
        const checkbox = row.querySelector('.zx-table__row-checkbox');
        if (checkbox) checkbox.checked = selected;
      }
    }
    this._syncSelectAll();
  }

  /** @returns {void} */
  _syncSelectAll() {
    if (!this._selectAll) return;
    const selectedRows = this._data.reduce((count, row) => count + Number(this._selected.has(this._idFor(row))), 0);
    this._selectAll.disabled = this._data.length === 0;
    this._selectAll.checked = this._data.length > 0 && selectedRows === this._data.length;
    this._selectAll.indeterminate = selectedRows > 0 && selectedRows < this._data.length;
  }

  /** @returns {void} */
  _syncSortHeader() {
    if (!this._headers) return;
    for (const [id, header] of this._headers) {
      if (this._sort?.id === id) header.setAttribute('aria-sort', this._sort.dir === 'asc' ? 'ascending' : 'descending');
      else header.removeAttribute('aria-sort');
    }
  }

  /** @returns {void} */
  _sortData() {
    if (!this._sort) return;
    const column = this._columns.find((candidate) => candidate.id === this._sort.id);
    if (!column) return;
    const getValue = typeof column.sortValue === 'function' ? column.sortValue : (row) => row?.[column.id];
    this._data = sortRows(this._data, getValue, this._sort.dir);
  }

  /** @returns {boolean} Whether selection changed. */
  _pruneSelection() {
    const valid = new Set(this._data.map((row) => this._idFor(row)));
    const previousSize = this._selected.size;
    for (const id of this._selected) if (!valid.has(id)) this._selected.delete(id);
    if (!valid.has(this._selectionAnchorId)) this._selectionAnchorId = null;
    return previousSize !== this._selected.size;
  }

  /** @param {TableRow} row @returns {unknown} */
  _idFor(row) {
    return typeof this.options.rowId === 'function' ? this.options.rowId(row) : row?.[this.options.rowId];
  }

  /** @returns {void} @fires Table#selectionchange */
  _emitSelectionChange() {
    const rows = this.getSelection();
    this.emit('selectionchange', { rows, ids: rows.map((row) => this._idFor(row)) });
  }

  /** @returns {void} @fires Table#datachange */
  _emitDataChange() {
    this.emit('datachange', { rows: this.getData() });
  }
}

/**
 * Row activation event.
 * @event Table#rowclick
 * @type {CustomEvent<TableRowClickDetail>}
 */

/**
 * Row double-activation event.
 * @event Table#rowdblclick
 * @type {CustomEvent<TableRowClickDetail>}
 */

/** @event Table#sort @type {CustomEvent<TableSortDetail>} */
/** @event Table#selectionchange @type {CustomEvent<TableSelectionDetail>} */
/** @event Table#datachange @type {CustomEvent<TableDataDetail>} */

/**
 * Editor opened for a cell (or, in row mode, for the row).
 * @event Table#editstart
 * @type {CustomEvent<TableEditStartDetail>}
 */

/**
 * Values are about to be written back. Cancelable: `preventDefault()` keeps the editor open, which
 * lets a server round-trip reject the change.
 * @event Table#editcommit
 * @type {CustomEvent<TableEditCommitDetail>}
 */

/**
 * Editing ended without writing anything back — Escape, `cancelEdit()`, or a data refresh
 * (`setData`, `setSort`, …) that replaced the edited rows.
 * @event Table#editcancel
 * @type {CustomEvent<TableEditCancelDetail>}
 */

/**
 * A column's `validate` rejected the commit.
 * @event Table#editinvalid
 * @type {CustomEvent<TableEditInvalidDetail>}
 */

/**
 * Resolves the editor type of a column for one row.
 *
 * `column.editor` wins over `column.editable`, except that a per-row `editable` function returning
 * `false` still marks the cell read-only. `editable: true` means `'text'`; unknown type names are
 * treated as not editable.
 * @param {TableColumn} column Column definition.
 * @param {TableRow} row Row the cell belongs to.
 * @returns {TableEditorType|false} Editor type, or false when the cell is read-only.
 */
export function resolveEditable(column, row) {
  if (!column || typeof column !== 'object') return false;
  if (typeof column.editor === 'function') {
    if (typeof column.editable === 'function' && column.editable(row) === false) return false;
    return 'custom';
  }
  const declared = typeof column.editable === 'function' ? column.editable(row) : column.editable;
  if (declared === true) return 'text';
  if (typeof declared === 'string' && EDITOR_TYPES.has(declared)) return /** @type {TableEditorType} */ (declared);
  return false;
}

/**
 * Normalizes `column.options` into `[{value, label}]`. Object maps always yield string values,
 * because object keys are strings; use the array form to keep other value types.
 * @param {TableEditorOption[]|Record<string, string>|((row: TableRow) => unknown)|undefined} source Option source.
 * @param {TableRow} row Row the options are resolved for.
 * @returns {TableEditorOption[]} Normalized options.
 */
export function normalizeEditorOptions(source, row) {
  const raw = typeof source === 'function' ? source(row) : source;
  if (Array.isArray(raw)) {
    return raw.map((item) => (item !== null && typeof item === 'object'
      ? { value: item.value, label: String(item.label ?? item.value ?? '') }
      : { value: item, label: String(item ?? '') }));
  }
  if (raw !== null && typeof raw === 'object') {
    return Object.entries(raw).map(([value, label]) => ({ value, label: String(label ?? '') }));
  }
  return [];
}

/**
 * Renders a value as the initial text of a text or textarea editor.
 * @param {TableColumn} column Column definition.
 * @param {unknown} value Cell value.
 * @param {TableRow} row Row the cell belongs to.
 * @returns {string} Editor text.
 */
export function formatCellValue(column, value, row) {
  if (typeof column?.format === 'function') {
    const formatted = column.format(value, row);
    return formatted == null ? '' : String(formatted);
  }
  return value == null ? '' : String(value);
}

/**
 * Converts an editor's raw output into the value written back into the row.
 * @param {TableColumn} column Column definition.
 * @param {unknown} raw Editor output.
 * @param {TableRow} row Row the cell belongs to.
 * @returns {unknown} Value for the row.
 */
export function parseCellValue(column, raw, row) {
  return typeof column?.parse === 'function' ? column.parse(raw, row) : raw;
}

/**
 * Compares two cell values, treating equal-timestamp dates as unchanged.
 * @param {unknown} left First value.
 * @param {unknown} right Second value.
 * @returns {boolean} Whether the values are equal.
 */
export function valuesEqual(left, right) {
  if (Object.is(left, right)) return true;
  if (left instanceof Date && right instanceof Date) return left.getTime() === right.getTime();
  return false;
}

/**
 * Diffs edited values against a row and returns only what actually changed. This is the `changes`
 * map carried by `editcommit`; in row mode it holds every changed cell of the row.
 * @param {TableRow} row Row before the commit.
 * @param {Record<string, unknown>} values Edited values keyed by column id.
 * @returns {Record<string, unknown>} Changed values keyed by column id.
 */
export function diffChanges(row, values) {
  /** @type {Record<string, unknown>} */
  const changes = {};
  for (const [columnId, value] of Object.entries(values ?? {})) {
    if (!valuesEqual(row?.[columnId], value)) changes[columnId] = value;
  }
  return changes;
}

/**
 * Runs the columns' `validate` callbacks in column order and stops at the first rejection, so a
 * later validator never runs once one has failed.
 * @param {Record<string, unknown>} values Edited values keyed by column id.
 * @param {TableColumn[]} columns Columns to validate, in order.
 * @param {TableRow} row Row being edited.
 * @param {string} [fallbackMessage='Invalid value'] Message used when a validator returns `false`.
 * @returns {{columnId: string, message: string}|null} First rejection, or null when all pass.
 */
export function firstValidationError(values, columns, row, fallbackMessage = 'Invalid value') {
  for (const column of columns ?? []) {
    if (typeof column?.validate !== 'function') continue;
    if (!Object.prototype.hasOwnProperty.call(values ?? {}, column.id)) continue;
    const result = column.validate(values[column.id], row);
    if (typeof result === 'string') return { columnId: column.id, message: result };
    if (result === false) return { columnId: column.id, message: fallbackMessage };
  }
  return null;
}

/** @param {unknown} mode @returns {TableEditMode} */
function normalizeEditMode(mode) {
  if (mode === 'cell' || mode === 'row') return mode;
  return mode === true ? 'cell' : false;
}

/** @param {Element|null} target @returns {boolean} */
function isInsideEditor(target) {
  return Boolean(target?.closest?.('.zx-table__editor'));
}

/**
 * Whether a child component still owns Escape/Enter/Tab because one of its overlays is open.
 * @param {Element} target Key event target.
 * @returns {boolean}
 */
function deferToEditor(target) {
  if (target.closest('[popover]')) return true;
  return target.getAttribute?.('aria-expanded') === 'true';
}

/** @param {HTMLTableRowElement} tr @param {string} columnId @returns {HTMLTableCellElement|null} */
function cellIn(tr, columnId) {
  for (const cell of tr.cells) {
    if (cell.dataset.column === columnId) return /** @type {HTMLTableCellElement} */ (cell);
  }
  return null;
}

/** @param {unknown} sort @param {TableColumn[]} columns @returns {{id: string, dir: TableSortDirection}|null} */
function normalizeSort(sort, columns) {
  if (!sort || typeof sort !== 'object') return null;
  if (!columns.some((column) => column.id === sort.id)) return null;
  return { id: sort.id, dir: sort.dir === 'desc' ? 'desc' : 'asc' };
}

/** @param {unknown} width @returns {number} */
function parseFraction(width) {
  if (typeof width !== 'string') return 0;
  const match = /^(\d*\.?\d+)fr$/.exec(width.trim());
  return match ? Math.max(0, Number(match[1])) : 0;
}

/** @param {unknown} rows @returns {asserts rows is TableRow[]} */
function assertRows(rows) {
  if (!Array.isArray(rows)) throw new TypeError('Table data must be an array');
}

/** @param {Set<unknown>} left @param {Set<unknown>} right @returns {boolean} */
function sameSet(left, right) {
  return left.size === right.size && [...left].every((value) => right.has(value));
}
