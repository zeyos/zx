import { Component } from '../../core/component.js';
import { h } from '../../core/dom.js';
import { sortRows } from './sort.js';

/** @typedef {Record<string, any>} TableRow */
/** @typedef {'asc'|'desc'} TableSortDirection */
/** @typedef {false|'single'|'multi'} TableSelectionMode */

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
 * @property {number|string|null} [height=null] Scroll-region height in pixels or CSS units.
 * @property {string|null} [emptyText=null] Empty message; null resolves `table.empty`.
 * @property {((row: TableRow) => string)|null} [rowClass=null] Additional row class callback.
 * @property {boolean} [zebra=true] Whether alternate rows use the zebra background.
 * @property {(event: CustomEvent<TableRowClickDetail>) => void} [onrowclick]
 * @property {(event: CustomEvent<TableRowClickDetail>) => void} [onrowdblclick]
 * @property {(event: CustomEvent<TableSortDetail>) => void} [onsort]
 * @property {(event: CustomEvent<TableSelectionDetail>) => void} [onselectionchange]
 * @property {(event: CustomEvent<TableDataDetail>) => void} [ondatachange]
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
 * Semantic, sortable data table with optional single or checkbox-based multi-selection.
 * @fires Table#rowclick
 * @fires Table#rowdblclick
 * @fires Table#sort
 * @fires Table#selectionchange
 * @fires Table#datachange
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
    height: null,
    emptyText: null,
    rowClass: null,
    zebra: true
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
    this._originalChildren = this.el ? Array.from(this.el.childNodes) : null;
    this._columns = Array.isArray(this.options.columns) ? this.options.columns.map((column) => ({ ...column })) : [];
    this._data = Array.isArray(this.options.data) ? [...this.options.data] : [];
    this._selected = new Set();
    this._selectionAnchorId = null;
    this._sort = normalizeSort(this.options.sort, this._columns);
    this._rowMeta = new WeakMap();
    this._rowElements = new Map();
    this._restored = false;

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
    root.replaceChildren(this._scroll);

    this._renderColumns();
    this._renderHeader();
    this._renderBody();
    this.listen(this._tbody, 'click', (event) => this._handleBodyClick(event));
    this.listen(this._tbody, 'dblclick', (event) => this._handleBodyDoubleClick(event));
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
   */
  setSort(id, dir, options = {}) {
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

  /** Restores an enhanced target and releases all component listeners. @returns {void} */
  destroy() {
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

  /** @returns {void} */
  _renderBody() {
    const fragment = document.createDocumentFragment();
    this._rowMeta = new WeakMap();
    this._rowElements = new Map();
    if (this._data.length === 0) {
      const text = this.options.emptyText == null ? this.msg('table.empty') : String(this.options.emptyText);
      fragment.append(h('tr', { class: 'zx-table__empty-row' },
        h('td', { class: 'zx-table__empty', colspan: this._columns.length + (this.options.selectable === 'multi' ? 1 : 0) }, text)
      ));
    } else {
      this._data.forEach((row, index) => fragment.append(this._createRow(row, index)));
    }
    this._tbody.replaceChildren(fragment);
    this._syncSelectAll();
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
      const cell = h('td');
      if (column.align) cell.dataset.align = column.align;
      const value = typeof column.render === 'function' ? column.render(row, index) : row?.[column.id];
      if (value && typeof value === 'object' && typeof value.nodeType === 'number') cell.append(value);
      else if (value != null) cell.append(document.createTextNode(String(value)));
      tr.append(cell);
    });
    return tr;
  }

  /** @param {MouseEvent} event @returns {void} */
  _handleBodyClick(event) {
    const target = /** @type {Element|null} */ (event.target?.nodeType === 1 ? event.target : event.target?.parentElement);
    const rowElement = target?.closest('tr[data-row]');
    if (!rowElement || !this._tbody.contains(rowElement)) return;
    const meta = this._rowMeta.get(rowElement);
    if (!meta) return;

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

  /** @param {MouseEvent} event @returns {void} */
  _handleBodyDoubleClick(event) {
    const target = /** @type {Element|null} */ (event.target?.nodeType === 1 ? event.target : event.target?.parentElement);
    if (target?.closest('.zx-table__row-checkbox')) return;
    const rowElement = target?.closest('tr[data-row]');
    if (!rowElement || !this._tbody.contains(rowElement)) return;
    const meta = this._rowMeta.get(rowElement);
    if (meta) this.emit('rowdblclick', { ...meta, event });
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
