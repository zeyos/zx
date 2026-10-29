import { Component } from '../../core/component.js';
import { breakpoints, onBreakpoint } from '../../core/breakpoint.js';
import { h, restoreTarget, snapshotTarget } from '../../core/dom.js';
import { formatCurrency, formatNumber, formatPercent } from '../../core/format.js';
import { icon } from '../../core/icons.js';
import { printf } from '../../core/i18n.js';
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
/** @typedef {'default'|'plain'} TableVariant */
/** @typedef {'text'|'number'|'select'|'date'|'checkbox'|'textarea'|'custom'} TableEditorType */
/** @typedef {'text'|'number'|'currency'|'percent'|'unit'} TableColumnType */
/** @typedef {{value: unknown, label: string}} TableEditorOption */

/**
 * @typedef {Object} TableHierarchyOptions
 * @property {string|((row: TableRow) => unknown)} parentId Row property or callback returning its
 * parent row id. Null and undefined identify a root row.
 * @property {string} [column] Column that receives indentation and the disclosure control; the
 * first column is used when omitted.
 * @property {boolean|unknown[]} [expanded=false] Initially expanded branches: all, none, or ids.
 */

/**
 * How one resolved row kind is presented. `rowKinds` is keyed by the kind coerced to a string, so
 * `{ 1: … }` and `{ '1': … }` name the same entry.
 * @typedef {Object} TableRowKind
 * @property {boolean} [span=false] Draw the row as a single cell across every rendered column — a
 * section heading rather than a record. The cell is a `<th scope="colgroup">`, not a `<td>`,
 * because it labels the columns of the rows beneath it and a screen reader walking the table
 * should meet it as a heading rather than as a value. A spanning row carries no selection
 * checkbox, is never editable, and is skipped by `rowReorder`; it still emits `rowclick` and still
 * participates in `getData()` and `updateRow()`.
 * @property {(row: TableRow, index: number) => Node|string|number|null|undefined} [render] Content
 * of the spanning cell. Omitted, the cell falls back to the row's raw value for the first visible
 * column, which is what a host otherwise writes by hand.
 * @property {string} [class] Space-separated classes added to the row, on top of `rowClass`. Zx
 * ships no section look: a billing section is not a kanban swimlane, so the tint, the weight and
 * the rule above it are the host's to decide.
 */

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
 * @property {string} label Visible header label. An empty label leaves the header blank — an
 * icon or actions column — and the header is then named by `ariaLabel`, or by the id.
 * @property {string} [ariaLabel] Accessible name of the column header, and the name the column
 * chooser and the cell editors use. Needed when `label` is empty or terse (`'#'`); include the
 * visible label's words in it when there is one.
 * @property {boolean} [sortable=false] Whether the header changes the active sort.
 * @property {string} [width='auto'] CSS width, `auto`, or an `fr` proportion. `fr` values are
 * converted into proportional percentages on `<col>` elements and enable `table-layout: fixed`;
 * this preserves a single aligned header/body table without measuring layout in JavaScript.
 * @property {'start'|'center'|'end'|'left'|'right'} [align='start'] Cell alignment.
 * @property {(row: TableRow, rowIndex: number) => Node|string|number|null|undefined} [render]
 * Cell renderer. Non-Node results are inserted as text.
 * @property {(row: TableRow) => unknown} [sortValue] Sort-value accessor.
 * @property {string} [headerTitle] Header tooltip.
 * @property {TableColumnType} [type='text'] Built-in display formatter used when `render` is absent.
 * @property {string|((row: TableRow) => string|null|undefined)} [locale] BCP 47 formatting locale.
 * @property {number|((row: TableRow) => number|null|undefined)} [decimals] Fraction digits.
 * @property {string|((row: TableRow) => string|null|undefined)} [currency] ISO 4217 code used by a
 * `currency` column.
 * @property {string|((row: TableRow) => string|null|undefined)} [unit] Suffix used by a `unit`
 * column. Row callbacks support mixed units in one transaction table.
 * @property {boolean} [popin=true] While stacked, whether this column becomes a labelled line.
 * `false` keeps it in the card's headline — the identifying columns usually want that.
 * @property {boolean|TableEditorType|((row: TableRow) => boolean|TableEditorType)} [editable=false]
 * Editor for this column while the table runs with `editMode`. `true` infers `'number'` for numeric
 * display types and `'text'` otherwise; a function is evaluated per row so individual rows stay
 * read-only.
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
 * @property {false|number} [growing=false] Number of rows to render at first, with a control that
 * appends the next batch on demand. A result set an ERP query returns happily — tens of thousands
 * of rows — costs more to lay out than anyone will ever scroll through.
 * @property {false|'sm'|'md'|'lg'|'xl'} [responsive=false] Width below which each row stacks into a
 * card of label/value pairs instead of scrolling sideways. Measured on the table's own container,
 * not the viewport, so a table inside a split pane stacks when *it* is narrow.
 * @property {number|string|null} [height=null] Scroll-region height in pixels or CSS units.
 * @property {string|Node|(() => Node|string)|null} [emptyText=null] What to show when there are no
 * rows; null resolves `table.empty`. A Node — an `emptyState()` with an action in it, say — is
 * placed as given, and a function is called on each render, which is what to use when the
 * placeholder holds live controls.
 * @property {((row: TableRow) => string)|null} [rowClass=null] Additional row class callback.
 * @property {string|((row: TableRow) => unknown)|null} [rowKind=null] Row property or callback
 * naming each row's kind — the `type` on a ZeyOS transaction line, where one value is a position
 * carrying quantities and amounts and another is a section heading that groups the positions under
 * it. `null`, the default, renders every row exactly as before.
 * @property {Record<string, TableRowKind>|null} [rowKinds=null] Presentation per kind, keyed by the
 * resolved kind coerced to a string. A kind with no entry here renders as an ordinary row. While
 * any row in the current data resolves to a `span` kind the header sort controls are withheld and
 * `setSort()` is inert: sorting a grouped table scatters the positions out of their sections, and
 * doing that silently is worse than not offering it. `sortMode: 'server'` still owns its own order.
 * @property {boolean} [zebra=true] Whether alternate rows use the zebra background.
 * @property {TableVariant} [variant='default'] Frame treatment. `'default'` draws the table's own
 * bordered box; `'plain'` is for a table inside a card or panel that already draws one — no outer
 * frame, no header band, no zebra, hairline row dividers. Reflected as `data-variant` on the root.
 * @property {TableEditMode} [editMode=false] Inline editing mode. `'cell'` edits one cell, `'row'`
 * opens every editable cell of the row together and commits them as a unit. Editing is completely
 * inert while this is `false`.
 * @property {'single'|'double'} [editTrigger='double'] Gesture that starts an editable cell.
 * @property {boolean} [rowReorder=false] Whether rows expose pointer/keyboard reorder handles.
 * @property {boolean} [columnVisibility=false] Whether a column visibility chooser is rendered.
 * @property {boolean} [columnReorder=false] Whether the column chooser also exposes accessible
 * earlier/later controls. Column headers never become draggable.
 * @property {string[]} [hiddenColumns=[]] Initially hidden column IDs; at least one stays visible.
 * @property {false|TableHierarchyOptions} [hierarchy=false] Flat parent references projected as an
 * expandable treegrid. Row data and mutation APIs remain flat.
 * @property {boolean} [interactive=false] Makes the table an APG grid — row focus, Enter firing
 * `rowclick` — even without selection, editing, or hierarchy, which already imply it. Attaching a
 * `rowclick` or `rowdblclick` listener through `on()` or an `on…` option sets it too; pass it when
 * the host listens for the bubbling `zx-rowclick` DOM event instead.
 * @property {string|null} [label=null] Accessible name of the table. A grid must have one; null
 * resolves the `table.label` message (English "Table") for a grid and leaves a plain table unnamed,
 * so name it after what it lists.
 * @property {string|null} [labelledBy=null] Id of an element that names the grid — the heading
 * above it, say. Wins over `label`.
 * @property {(event: CustomEvent<TableRowClickDetail>) => void} [onrowclick]
 * @property {(event: CustomEvent<TableRowClickDetail>) => void} [onrowdblclick]
 * @property {(event: CustomEvent<TableSortDetail>) => void} [onsort]
 * @property {(event: CustomEvent<TableSelectionDetail>) => void} [onselectionchange]
 * @property {(event: CustomEvent<TableDataDetail>) => void} [ondatachange]
 * @property {(event: CustomEvent<{stacked: boolean}>) => void} [onstackedchange] Fired when the
 * table crosses its `responsive` width in either direction.
 * @property {(event: CustomEvent<{rendered: number, total: number}>) => void} [ongrow] Fired after
 * more rows are rendered.
 * @property {(event: CustomEvent<TableEditStartDetail>) => void} [oneditstart]
 * @property {(event: CustomEvent<TableEditCommitDetail>) => void} [oneditcommit]
 * @property {(event: CustomEvent<TableEditCancelDetail>) => void} [oneditcancel]
 * @property {(event: CustomEvent<TableEditInvalidDetail>) => void} [oneditinvalid]
 * @property {(event: CustomEvent<TableRowToggleDetail>) => void} [onrowtoggle]
 * @property {(event: CustomEvent<TableRowMoveDetail>) => void} [onrowmove]
 * @property {(event: CustomEvent<{visible:string[],hidden:string[]}>) => void} [oncolumnvisibilitychange]
 * @property {(event: CustomEvent<{order:string[]}>) => void} [oncolumnorderchange]
 */

/**
 * @typedef {Object} TableRowClickDetail
 * @property {TableRow} row
 * @property {unknown} id
 * @property {number} index
 * @property {Event} event
 */

/** @typedef {{id: string|null, dir: TableSortDirection|null}} TableSortDetail */
/** @typedef {{rows: TableRow[], ids: unknown[]}} TableSelectionDetail */
/** @typedef {{rows: TableRow[]}} TableDataDetail */
/** @typedef {{row: TableRow, id: unknown, expanded: boolean}} TableRowToggleDetail */
/** @typedef {{row:TableRow,id:unknown,target:TableRow,targetId:unknown,position:'before'|'after'}} TableRowMoveDetail */

/**
 * Visible hierarchy metadata returned by `projectHierarchyRows`.
 * @typedef {Object} TableHierarchyEntry
 * @property {TableRow} row
 * @property {unknown} id
 * @property {number} index Index in the flat input data.
 * @property {number} depth Zero-based visual depth.
 * @property {boolean} hasChildren
 * @property {unknown} parentId Canonical parent id, or null for a root.
 */

/**
 * @typedef {Object} TableHierarchyNode
 * @property {TableRow} row
 * @property {unknown} id
 * @property {number} index
 * @property {TableHierarchyNode|null} parent
 * @property {TableHierarchyNode[]} children
 */

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
 *
 * An interactive table — one that is `selectable`, has `editMode` or `hierarchy`, sets
 * `interactive: true`, or has a `rowclick`/`rowdblclick` listener attached through `on()` or an
 * `on…` option — follows the WAI-ARIA APG Grid pattern (`role="grid"`), or the Treegrid pattern
 * (`role="treegrid"`) with `hierarchy`. Any other table keeps plain `<table>` semantics and no
 * keyboard model of its own. In a grid the rows are one Tab stop with a roving `tabindex`. Rows
 * take focus by default; a table with `editMode` moves focus between cells instead, which the root
 * reflects as `data-focus="row"|"cell"`. ArrowUp/ArrowDown move between rows, ArrowLeft/ArrowRight
 * between cells (cell focus) or expand, collapse, and walk the tree (treegrid), Home/End and
 * Ctrl+Home/End jump to the ends, PageUp/PageDown move by a visible page (10 rows when the table
 * does not scroll). Enter activates the row exactly as a click does (`rowclick`), Space toggles the
 * row's selection when `selectable` (and activates otherwise), Shift+Arrow extends a `multi`
 * selection, and Ctrl/Cmd+A selects every rendered row. The focused row survives `setData`, sorting,
 * expansion, and `updateRow`. Column headers keep their sort buttons in the Tab order.
 * @fires Table#rowclick
 * @fires Table#rowdblclick
 * @fires Table#sort
 * @fires Table#selectionchange
 * @fires Table#datachange
 * @fires Table#editstart
 * @fires Table#editcommit
 * @fires Table#editcancel
 * @fires Table#editinvalid
 * @fires Table#rowtoggle
 * @fires Table#stackedchange
 * @fires Table#grow
 * @fires Table#rowmove
 * @fires Table#columnvisibilitychange
 * @fires Table#columnorderchange
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
    growing: false,
    height: null,
    emptyText: null,
    rowClass: null,
    rowKind: null,
    rowKinds: null,
    zebra: true,
    variant: 'default',
    editMode: false,
    editTrigger: 'double',
    hierarchy: false,
    interactive: false,
    label: null,
    labelledBy: null,
    rowReorder: false,
    columnVisibility: false,
    columnReorder: false,
    hiddenColumns: []
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
    const created = this.el === null;
    const root = /** @type {HTMLElement} */ (this.el ?? h('div'));
    // Claimed here, not left to the base constructor: `_watchWidth()` below observes `this.el`,
    // and until this assignment it is null for a component creating its own root.
    this.el = root;
    this._createdRoot = created;
    this._original = created ? null : snapshotTarget(root);
    this._columns = normalizeTableColumns(this.options.columns);
    this._data = Array.isArray(this.options.data) ? [...this.options.data] : [];
    // Row kinds resolve before the first sort: `_sortData()` refuses to run while the data holds a
    // spanning row, and the initial `sort` option reaches it before anything is rendered.
    this._rowKind = normalizeRowKind(this.options.rowKind);
    this._rowKinds = normalizeRowKinds(this.options.rowKinds);
    this._spanning = this._hasSpanningRow();
    this._sortWarned = false;
    this._selected = new Set();
    this._selectionAnchorId = null;
    this._sort = normalizeSort(this.options.sort, this._columns);
    this._rowMeta = new WeakMap();
    this._rowNames = new WeakMap();
    this._rowElements = new Map();
    this._restored = false;
    // Editing state. `_edit` is null unless a cell or row is currently open for editing; every
    // other member below is only ever touched while `_editMode !== false`.
    this._editMode = normalizeEditMode(this.options.editMode);
    this._editTrigger = this.options.editTrigger === 'single' ? 'single' : 'double';
    this._edit = null;
    this._editMessage = null;
    this._stacked = false;
    this._width = null;
    this._growStep = growStep(this.options.growing);
    this._rendered = this._growStep ?? Infinity;
    this._more = null;
    // Keyboard focus. `_current` is the row (and, with cell focus, the column) holding the grid's
    // single Tab stop; it is kept by id so the stop survives every re-render of the body.
    this._focusMode = this._editMode === false ? 'row' : 'cell';
    // `_clickListened` is set by `addEventListener()`, which the base constructor runs for `on…`
    // options before this method; it is deliberately not reset here.
    this._interactive = Boolean(this.options.interactive || this.options.selectable
      || this._editMode !== false || normalizeHierarchy(this.options.hierarchy, this._columns)
      || this._clickListened);
    this._current = null;
    this._rovingEl = null;
    this._extendBase = null;
    this._hierarchy = normalizeHierarchy(this.options.hierarchy, this._columns);
    this._hiddenColumns = new Set((Array.isArray(this.options.hiddenColumns) ? this.options.hiddenColumns : [])
      .map(String).filter((id) => this._columns.some((column) => column.id === id)));
    if (this._hiddenColumns.size >= this._columns.length && this._columns[0]) this._hiddenColumns.delete(this._columns[0].id);
    this._dragId = null;
    this._grabbedId = null;
    this._columnControlIds = new Map();
    this._columnStatus = null;
    this._expanded = initialExpanded(this._hierarchy?.expanded);

    if (this._sort && this.options.sortMode === 'local') this._sortData();
    if (this._hierarchy?.expanded === true) {
      for (const id of hierarchyBranchIds(this._data, this.options.rowId, this._hierarchy.parentId)) {
        this._expanded.add(id);
      }
    }
    this._reconcileExpanded();

    if (normalizeTableVariant(this.options.variant) === 'plain') root.dataset.variant = 'plain';

    this._table = h('table', { class: 'zx-table__table' });
    this._syncGridRole();
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
    this._rowMoveMessage = this.options.rowReorder ? h('div', {
      class: 'zx-table__reorder-status', role: 'status', ariaLive: 'polite'
    }) : null;
    if (this.options.height != null) {
      this._scroll.style.blockSize = typeof this.options.height === 'number' ?
        `${this.options.height}px` : String(this.options.height);
    }
    this._columnControls = this.options.columnVisibility || this.options.columnReorder
      ? this._createColumnControls() : null;
    if (this._editMode === false) {
      root.replaceChildren(...[this._columnControls, this._scroll, this._rowMoveMessage].filter(Boolean));
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
      root.replaceChildren(...[this._columnControls, this._scroll, this._editMessage, this._rowMoveMessage].filter(Boolean));
    }

    this._renderColumns();
    this._renderHeader();
    this._renderBody();
    this._watchWidth();
    this.listen(this._tbody, 'click', (event) => this._handleBodyClick(event));
    this.listen(this._tbody, 'dblclick', (event) => this._handleBodyDoubleClick(event));
    if (this.options.rowReorder) {
      this.listen(this._tbody, 'dragstart', (event) => this._handleRowDragStart(/** @type {DragEvent} */ (event)));
      this.listen(this._tbody, 'dragover', (event) => this._handleRowDragOver(/** @type {DragEvent} */ (event)));
      this.listen(this._tbody, 'drop', (event) => this._handleRowDrop(/** @type {DragEvent} */ (event)));
      this.listen(this._tbody, 'dragend', () => this._clearRowDrag());
      this.listen(this._tbody, 'keydown', (event) => this._handleRowHandleKeydown(/** @type {KeyboardEvent} */ (event)));
    }
    if (this._columnControls) {
      this.listen(this._columnControls, 'change', (event) => {
        const input = /** @type {HTMLInputElement|null} */ (event.target);
        if (input?.classList.contains('zx-table__column-toggle')) this.setColumnVisible(input.value, input.checked);
      });
      this.listen(this._columnControls, 'click', (event) => this._handleColumnControlClick(event));
      this.listen(this._columnControls, 'keydown', (event) =>
        this._handleColumnControlKeydown(/** @type {KeyboardEvent} */ (event)));
    }
    if (this._editMode !== false) {
      this.listen(this._tbody, 'keydown', (event) => this._handleEditKeydown(/** @type {KeyboardEvent} */ (event)));
      this.listen(document, 'pointerdown', (event) => this._handleDocumentPointerDown(event), { capture: true });
    }
    // Registered after the editing and reorder handlers, which claim their keys first and mark them
    // with preventDefault().
    this.listen(this._tbody, 'keydown', (event) => this._handleGridKeydown(/** @type {KeyboardEvent} */ (event)));
    this.listen(this._tbody, 'focusin', (event) => this._handleFocusIn(event));
    return root;
  }

  /**
   * Toggles a loading state. While loading, the body is dimmed, an indeterminate progress bar is
   * shown, and `aria-busy` is set — a lightweight enterprise-table busy and skeleton pattern.
   * Call `setLoading(false)` (or `setData`) when done.
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
    // New data means a new result set; whatever the reader had grown to belonged to the old one.
    this._rendered = this._growStep ?? Infinity;
    this.setLoading(false);
    assertRows(rows);
    this._data = [...rows];
    if (this._sort && this.options.sortMode === 'local') this._sortData();
    this._reconcileExpanded();
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
    this._reconcileExpanded();
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
    this._reconcileExpanded();
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
    this._reconcileExpanded();
    const selectionChanged = this._selected.delete(id);
    if (Object.is(this._selectionAnchorId, id)) this._selectionAnchorId = null;
    this._extendBase = null;
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

  /**
   * Returns a shallow copy of the current rows in display order.
   * @returns {TableRow[]} Current table rows.
   */
  getData() {
    return [...this._data];
  }

  /**
   * Returns shallow-cloned column descriptors in their current display order.
   * @returns {TableColumn[]} Current columns.
   */
  getColumns() {
    return this._columns.map((column) => ({ ...column }));
  }

  /**
   * Replaces all column descriptors. Hidden state and the active sort follow retained stable IDs;
   * an edit is canceled before cells are rebuilt.
   * @param {TableColumn[]} columns New column descriptors.
   * @param {{silent?:boolean}} [options={}] Event behavior.
   * @returns {this}
   * @fires Table#columnvisibilitychange
   * @fires Table#columnorderchange
   * @fires Table#editcancel
   */
  setColumns(columns, options = {}) {
    const next = normalizeTableColumns(columns);
    const previousOrder = this.getColumnOrder();
    const previousHidden = this.getHiddenColumns();
    const previousSort = this.getSort();
    this._abortEdit({ focus: false });
    this._columns = next;
    this._hiddenColumns = new Set(previousHidden.filter((id) =>
      next.some((column) => column.id === id)));
    if (this._hiddenColumns.size >= next.length && next[0]) this._hiddenColumns.delete(next[0].id);
    this._sort = normalizeSort(previousSort, next);
    this._hierarchy = normalizeHierarchy(this.options.hierarchy, next);
    this._reconcileExpanded();
    this._renderColumns();
    this._renderHeader();
    this._renderBody();
    this._renderColumnControls();
    if (!options.silent) {
      if (!sameArray(previousOrder, this.getColumnOrder())) {
        this.emit('columnorderchange', { order: this.getColumnOrder() });
      }
      if (!sameArray(previousHidden, this.getHiddenColumns())) {
        this.emit('columnvisibilitychange', {
          visible: this.getVisibleColumns(), hidden: this.getHiddenColumns()
        });
      }
    }
    return this;
  }

  /** Returns every stable column ID in current display order. @returns {string[]} */
  getColumnOrder() {
    return this._columns.map((column) => column.id);
  }

  /**
   * Reconciles a partial or stale preferred order with every current column.
   * @param {string[]} order Preferred stable IDs.
   * @param {{silent?:boolean}} [options={}] Event behavior.
   * @returns {this}
   * @fires Table#columnorderchange
   * @fires Table#editcancel
   */
  setColumnOrder(order, options = {}) {
    const nextOrder = reconcileTableColumnOrder(this._columns, order);
    if (sameArray(nextOrder, this.getColumnOrder())) return this;
    const focus = this._activeColumnControl();
    const byId = new Map(this._columns.map((column) => [column.id, column]));
    this._abortEdit({ focus: false });
    this._columns = nextOrder.map((id) => /** @type {TableColumn} */ (byId.get(id)));
    this._hierarchy = normalizeHierarchy(this.options.hierarchy, this._columns);
    this._renderColumns();
    this._renderHeader();
    this._renderBody();
    this._renderColumnControls(focus);
    if (!options.silent) this.emit('columnorderchange', { order: this.getColumnOrder() });
    return this;
  }

  /**
   * Moves one column to an edge of another column. Unknown IDs are a safe no-op.
   * @param {string} id Moving stable ID.
   * @param {string} targetId Target stable ID.
   * @param {'before'|'after'} [position='before'] Target edge.
   * @param {{silent?:boolean}} [options={}] Event behavior.
   * @returns {this}
   */
  moveColumn(id, targetId, position = 'before', options = {}) {
    if (position !== 'before' && position !== 'after') {
      throw new TypeError('Table column position must be "before" or "after"');
    }
    const next = moveTableColumn(this.getColumnOrder(), String(id), String(targetId), position);
    if (sameArray(next, this.getColumnOrder())) return this;
    this.setColumnOrder(next, options);
    if (this._columnStatus) {
      const column = this._columns.find((candidate) => candidate.id === String(id));
      const index = this.getColumnOrder().indexOf(String(id));
      if (column && index >= 0) {
        this._columnStatus.textContent = `Moved ${tableColumnName(column)} to position ${index + 1} of ${this._columns.length}.`;
      }
    }
    return this;
  }

  /** Returns visible column IDs in caller order. @returns {string[]} */
  getVisibleColumns() {
    return this._visibleColumns().map((column) => column.id);
  }

  /** Returns hidden column IDs in caller order. @returns {string[]} */
  getHiddenColumns() {
    return this._columns.filter((column) => this._hiddenColumns.has(column.id)).map((column) => column.id);
  }

  /**
   * Shows or hides one column. The final visible column cannot be hidden.
   * @param {string} id Column ID.
   * @param {boolean} [visible=true] Desired visibility.
   * @param {{silent?:boolean}} [options={}] Event behavior.
   * @returns {this}
   */
  setColumnVisible(id, visible = true, options = {}) {
    const columnId = String(id);
    const column = this._columns.find((candidate) => candidate.id === columnId);
    if (!column) throw new RangeError(`Unknown table column: ${columnId}`);
    const restoreFocus = this._activeColumnControl();
    if (!visible && !this._hiddenColumns.has(columnId) && this._visibleColumns().length <= 1) {
      this._renderColumnControls(restoreFocus);
      return this;
    }
    const changed = visible ? this._hiddenColumns.delete(columnId) : !this._hiddenColumns.has(columnId);
    if (!visible && changed) this._hiddenColumns.add(columnId);
    if (!changed) return this;
    this._renderColumns();
    this._renderHeader();
    this._renderBody();
    this._renderColumnControls(restoreFocus);
    if (!options.silent) this.emit('columnvisibilitychange', {
      visible: this.getVisibleColumns(), hidden: this.getHiddenColumns()
    });
    return this;
  }

  /** Toggles one column. @param {string} id @param {{silent?:boolean}} [options={}] @returns {this} */
  toggleColumn(id, options = {}) {
    return this.setColumnVisible(id, this._hiddenColumns.has(String(id)), options);
  }

  /**
   * Reorders one row relative to another and emits a cancelable `rowmove` before committing.
   * Hierarchical rows may only move among siblings; an active local sort disables manual order.
   * @param {unknown} id Moving row ID.
   * @param {unknown} targetId Target row ID.
   * @param {'before'|'after'} [position='before'] Target edge.
   * @returns {this}
   */
  moveRow(id, targetId, position = 'before') {
    if (!this.options.rowReorder || this._sort && this.options.sortMode === 'local') return this;
    const row = this.getRow(id);
    const target = this.getRow(targetId);
    if (!row || !target || Object.is(id, targetId)) return this;
    // A section heading has no handle to grab; refuse the programmatic route for the same reason.
    if (this._isSpanningRow(row)) return this;
    const next = reorderTableRows(this._data, this.options.rowId, id, targetId, position, this._hierarchy?.parentId);
    if (!next) return this;
    const event = this.emit('rowmove', { row, id, target, targetId, position });
    if (event.defaultPrevented) return this;
    this._data = next;
    this._renderBody();
    if (this._rowMoveMessage) {
      const siblings = this._siblingIds(id);
      const index = siblings.findIndex((candidate) => Object.is(candidate, id));
      this._rowMoveMessage.textContent = `Moved row to position ${index + 1} of ${siblings.length}.`;
    }
    this._emitDataChange();
    queueMicrotask(() => this._rowHandle(id)?.focus());
    return this;
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
    this._expanded.clear();
    this._selected.clear();
    this._selectionAnchorId = null;
    this._extendBase = null;
    this._renderBody();
    if (selectionChanged) this._emitSelectionChange();
    this._emitDataChange();
    return this;
  }

  /**
   * Activates a column sort. Local mode stably reorders data; server mode only updates the
   * header state and emits the request event.
   *
   * Inert while the data holds a spanning row: a sort would scatter the positions out of the
   * sections that group them, in either sort mode. The header withholds its controls for the same
   * reason, so nothing on screen invites the call.
   * @param {string} id Column id.
   * @param {TableSortDirection} [dir] Direction; omitted toggles the current column.
   * @param {{silent?: boolean}} [options={}] Event options.
   * @returns {this}
   * @fires Table#sort
   * @fires Table#editcancel
   */
  setSort(id, dir, options = {}) {
    if (this._spanning) {
      if (!this._sortWarned) {
        this._sortWarned = true;
        console.warn('[zx.Table] setSort() is inert while the data contains spanning rowKinds rows: '
          + 'sorting would scatter the rows out of the sections that group them.');
      }
      return this;
    }
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

  /** Returns a defensive copy of the active sort. @returns {{id:string,dir:TableSortDirection}|null} */
  getSort() {
    return this._sort ? { ...this._sort } : null;
  }

  /**
   * Clears the active sort indicator without attempting to reconstruct the caller's original row
   * order. The current display order becomes the unsorted order until data is replaced.
   * @param {{silent?:boolean}} [options={}] Event behavior.
   * @returns {this}
   * @fires Table#sort
   * @fires Table#editcancel
   */
  clearSort(options = {}) {
    if (!this._sort) return this;
    this._abortEdit({ focus: false });
    this._sort = null;
    this._syncSortHeader();
    if (!options.silent) this.emit('sort', { id: null, dir: null });
    return this;
  }

  /**
   * Returns selected rows in current display order.
   * @returns {TableRow[]} Selected rows.
   */
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
    const valid = this._selectableIds();
    const next = new Set();
    if (this.options.selectable !== false) {
      for (const id of ids) {
        if (valid.has(id)) next.add(id);
        if (this.options.selectable === 'single' && next.size > 0) break;
      }
    }
    this._extendBase = null;
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
    this._extendBase = null;
    this._syncSelection();
    this._emitSelectionChange();
    return this;
  }

  /**
   * Toggles one hierarchy branch. A leaf or an id absent from the table is a no-op.
   * @param {unknown} id Row id.
   * @param {{silent?: boolean}} [options={}] Event behavior.
   * @returns {this}
   * @fires Table#rowtoggle
   */
  toggleRow(id, options = {}) {
    return this._expanded.has(id) ? this.collapseRow(id, options) : this.expandRow(id, options);
  }

  /**
   * Expands one hierarchy branch.
   * @param {unknown} id Row id.
   * @param {{silent?: boolean}} [options={}] Event behavior.
   * @returns {this}
   * @fires Table#rowtoggle
   */
  expandRow(id, options = {}) {
    return this._setRowExpanded(id, true, options);
  }

  /**
   * Collapses one hierarchy branch without discarding its descendants or their expansion state.
   * @param {unknown} id Row id.
   * @param {{silent?: boolean}} [options={}] Event behavior.
   * @returns {this}
   * @fires Table#rowtoggle
   */
  collapseRow(id, options = {}) {
    return this._setRowExpanded(id, false, options);
  }

  /**
   * Expands every row that currently has children.
   * @param {{silent?: boolean}} [options={}] Event behavior. When not silent, one `rowtoggle`
   * event is emitted per branch whose state changed.
   * @returns {this}
   */
  expandAll(options = {}) {
    if (!this._hierarchy) return this;
    const branchIds = hierarchyBranchIds(this._data, this.options.rowId, this._hierarchy.parentId);
    const changed = branchIds.filter((id) => !this._expanded.has(id));
    for (const id of changed) this._expanded.add(id);
    if (changed.length) this._renderBody();
    if (!options.silent) {
      for (const id of changed) this._emitRowToggle(id, true);
    }
    return this;
  }

  /**
   * Collapses every hierarchy branch.
   * @param {{silent?: boolean}} [options={}] Event behavior.
   * @returns {this}
   */
  collapseAll(options = {}) {
    if (!this._hierarchy || this._expanded.size === 0) return this;
    const changed = [...this._expanded];
    this._expanded.clear();
    this._renderBody();
    if (!options.silent) {
      for (const id of changed) this._emitRowToggle(id, false);
    }
    return this;
  }

  /**
   * Returns expanded branch ids in current flat-data order.
   * @returns {unknown[]} Expanded branch ids.
   */
  getExpanded() {
    return this._data.map((row) => this._idFor(row)).filter((id) => this._expanded.has(id));
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
    const requested = this._columns.find((candidate) => candidate.id === columnId);
    if (!requested) return this;
    const current = this._data.find((candidate) => Object.is(this._idFor(candidate), rowId));
    if (current === undefined) return this;
    // A spanning row renders no column cells at all, so there is nothing to open an editor over.
    if (this._isSpanningRow(current)) return this;
    const column = this._editMode === 'row' && this._hiddenColumns.has(requested.id)
      ? this._visibleColumns().find((candidate) => resolveEditable(candidate, current) !== false) ?? null
      : requested;
    if (!column || resolveEditable(column, current) === false) return this;
    const activeColumnId = column.id;

    if (this._edit) {
      if (Object.is(this._edit.id, rowId) && this._edit.cells.has(activeColumnId)) {
        this._edit.columnId = activeColumnId;
        this._focusEditor(activeColumnId);
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
      ? this._visibleColumns().filter((candidate) => resolveEditable(candidate, row) !== false)
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

    this._edit = { id: rowId, columnId: activeColumnId, row, cells, tr };
    tr.dataset.editing = 'true';
    this.emit('editstart', { row, id: rowId, column, columnId: activeColumnId, value: row?.[activeColumnId] });
    this._focusEditor(activeColumnId);
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

  /**
   * Reports whether a cell or row is currently open for editing.
   * @returns {boolean} Whether an edit is open.
   */
  isEditing() {
    return this._edit !== null;
  }

  /**
   * Returns the row id and focused column id for the open edit.
   * @returns {{id: unknown, columnId: string}|null} Editing location, or null.
   */
  getEditing() {
    return this._edit ? { id: this._edit.id, columnId: this._edit.columnId } : null;
  }

  /**
   * The rows currently rendered — all of them unless `growing` is on.
   * @returns {TableRow[]}
   */
  _visibleData() {
    return this._visibleEntries().map((entry) => entry.row);
  }

  /** @returns {TableHierarchyEntry[]} Rows visible after hierarchy expansion, before growing. */
  _projectedData() {
    if (!this._hierarchy) {
      return this._data.map((row, index) => ({
        row, id: this._idFor(row), index, depth: 0, hasChildren: false, parentId: null
      }));
    }
    return projectHierarchyRows(
      this._data, this.options.rowId, this._hierarchy.parentId, this._expanded
    );
  }

  /** @returns {TableHierarchyEntry[]} Rows that currently have DOM entries. */
  _visibleEntries() {
    const projected = this._projectedData();
    return this._rendered === Infinity ? projected : projected.slice(0, this._rendered);
  }

  /**
   * Renders the next batch of rows.
   * @param {number} [count] How many to add; defaults to the configured batch size.
   * @returns {this}
   * @fires Table#grow
   */
  growBy(count) {
    if (!this._growStep) return this;
    const step = Number(count) > 0 ? Math.trunc(Number(count)) : this._growStep;
    const before = this._rendered;
    const total = this._projectedData().length;
    this._rendered = Math.min(total, this._rendered + step);
    if (this._rendered === before) return this;
    this._renderBody();
    this.emit('grow', { rendered: this._rendered, total });
    return this;
  }

  /**
   * Renders every remaining row.
   * @returns {this}
   * @fires Table#grow
   */
  showAll() {
    return this.growBy(this._projectedData().length);
  }

  /**
   * How many rows are currently rendered.
   * @returns {number}
   */
  getRenderedCount() {
    return Math.min(this._rendered, this._projectedData().length);
  }

  /**
   * Keeps the "show more" control in step with what is rendered.
   *
   * The control sits outside the table rather than in a `<tfoot>` row spanning every column: it is
   * a command, not data, and a button inside the grid would be reachable by the row navigation
   * keys as though it were a cell.
   * @returns {void}
   */
  _syncGrowing() {
    if (!this._growStep) return;
    const remaining = this._projectedData().length - this.getRenderedCount();
    if (remaining <= 0) {
      this._more?.remove();
      this._more = null;
      return;
    }
    const label = this._message('table.more', 'Show %1 more', [remaining]);
    if (!this._more) {
      this._more = h('button', {
        class: 'zx-table__more',
        type: 'button',
        onclick: () => this.growBy()
      });
      this.el.append(this._more);
    }
    this._more.textContent = label;
    // Announced as a count rather than a bare "show more", so the size of what is left is audible.
    this._more.setAttribute('aria-label', label);
  }

  /**
   * Resolves a localized message, falling back to a built-in template.
   * @param {string} key Message key.
   * @param {string} fallback Template used when the host has no translation.
   * @param {unknown[]} args Positional interpolation values.
   * @returns {string}
   */
  _message(key, fallback, args) {
    const message = this.msg(key, ...args);
    return message === key ? printf(fallback, args) : message;
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
   * Registers a listener, and turns the table into a grid when the listener is for a row click:
   * a host that reacts to the row needs the row reachable by keyboard.
   * @param {string} type Event name.
   * @param {EventListenerOrEventListenerObject|null} listener Listener.
   * @param {boolean|AddEventListenerOptions} [options] Listener options.
   * @returns {void}
   */
  addEventListener(type, listener, options) {
    super.addEventListener(type, listener, options);
    if (!listener || type !== 'rowclick' && type !== 'rowdblclick') return;
    this._clickListened = true;
    if (this._table && !this._interactive) {
      this._interactive = true;
      this._syncGridRole();
      this._renderBody();
    }
  }

  /** @returns {'grid'|'treegrid'|null} Role of the `<table>`, or null for plain table semantics. */
  _gridRole() {
    if (!this._interactive) return null;
    return this._hierarchy ? 'treegrid' : 'grid';
  }

  /** Writes the grid role, name, and focus mode — or their absence — onto the table. @returns {void} */
  _syncGridRole() {
    const table = this._table;
    const role = this._gridRole();
    if (role) table.setAttribute('role', role);
    else table.removeAttribute('role');
    if (this.options.labelledBy) {
      table.setAttribute('aria-labelledby', String(this.options.labelledBy));
    } else if (this.options.label != null || role) {
      table.setAttribute('aria-label', this.options.label ?? this._message('table.label', 'Table', []));
    }
    if (role && this.options.selectable === 'multi') table.setAttribute('aria-multiselectable', 'true');
    if (role) this.el.dataset.focus = this._focusMode;
    else delete this.el.dataset.focus;
  }

  /**
   * States the table roles explicitly while stacked, and removes them again on the way out.
   *
   * Stacking works by changing `display` on the table elements, and a table whose display is not
   * `table` loses its implicit ARIA roles — leaving a screen reader with a pile of generic blocks
   * where a table used to be. The roles are only asserted while the layout has taken them away;
   * a grid keeps its explicit grid or treegrid role in either mode.
   * @param {boolean} stacked Whether the roles should be present.
   * @returns {void}
   */
  _applyStackedRoles(stacked) {
    const grid = this._gridRole();
    if (grid) this._table.setAttribute('role', grid);
    else if (stacked) this._table.setAttribute('role', 'table');
    else this._table.removeAttribute('role');
    for (const element of [this._thead, this._tbody]) {
      if (stacked) element.setAttribute('role', 'rowgroup');
      else element.removeAttribute('role');
    }
    for (const [selector, role] of [['tr', 'row'], ['td', grid ? 'gridcell' : 'cell'], ['th', 'columnheader']]) {
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
    if (!this._restored && !this._createdRoot) {
      restoreTarget(this.el, this._original);
      this._restored = true;
    }
    super.destroy();
  }

  /** @returns {TableColumn[]} */
  _visibleColumns() {
    return this._columns.filter((column) => !this._hiddenColumns.has(column.id));
  }

  /**
   * Whether a row draws as one cell across the table instead of as a record.
   * @param {TableRow} row Row to classify.
   * @returns {boolean}
   */
  _isSpanningRow(row) {
    if (this._rowKind === null || this._rowKinds === null) return false;
    return isSpanningRow(row, this._rowKind, this._rowKinds);
  }

  /**
   * Whether any row in the current data — not only the rendered prefix — spans. This is what
   * withholds the sort controls, and the reader must not be offered a control that the next
   * `growBy()` would have to take away again.
   * @returns {boolean}
   */
  _hasSpanningRow() {
    return hasSpanningRow(this._data, this._rowKind, this._rowKinds);
  }

  /**
   * How many cells one row occupies: every visible column plus the structural columns the table
   * renders beside them. Shared by the spanning cell and the empty-state cell so the two can never
   * disagree about the table's width.
   * @returns {number}
   */
  _spanColspan() {
    return tableSpanColspan(this._visibleColumns().length, {
      selectable: this.options.selectable,
      rowReorder: this.options.rowReorder
    });
  }

  /** @returns {TableRow[]} Rendered rows that can carry a selection; spanning rows cannot. */
  _selectableData() {
    const visible = this._visibleData();
    return this._rowKind === null ? visible : visible.filter((row) => !this._isSpanningRow(row));
  }

  /** @returns {HTMLElement} */
  _createColumnControls() {
    const list = h('div', { class: 'zx-table__column-list' });
    this._columnList = list;
    this._columnStatus = h('div', {
      class: 'zx-table__column-status', role: 'status', ariaLive: 'polite'
    });
    const details = h('details', { class: 'zx-table__column-controls' },
      h('summary', { class: 'zx-btn', dataset: { size: 'sm' } }, icon('fields'),
        this._message('table.columns', 'Columns', [])),
      list);
    this._renderColumnControls();
    return details;
  }

  /**
   * @param {{id:string,action:string}|null} [focusControl=null] Control that keeps focus.
   * @returns {void}
   */
  _renderColumnControls(focusControl = null) {
    if (!this._columnList) return;
    const visible = this._visibleColumns();
    const controls = this._columns.map((column, index) => {
      const checked = !this._hiddenColumns.has(column.id);
      let controlId = this._columnControlIds.get(column.id);
      if (!controlId) {
        controlId = uid('zx-table-column');
        this._columnControlIds.set(column.id, controlId);
      }
      const toggle = this.options.columnVisibility ? h('input', {
        id: controlId,
        class: 'zx-table__column-toggle', type: 'checkbox', value: column.id, checked,
        disabled: checked && visible.length === 1,
        dataset: { columnId: column.id, columnAction: 'toggle' }
      }) : null;
      // The chooser lists every column by name, a blank-headed one included.
      const name = tableColumnName(column);
      const label = toggle
        ? h('label', { for: controlId }, toggle, h('span', {}, name))
        : h('span', { class: 'zx-table__column-label' }, name);
      const order = this.options.columnReorder ? h('span', {
        class: 'zx-table__column-order', role: 'group',
        ariaLabel: this._message('table.moveColumn', 'Move %1', [name])
      },
      h('button', {
        class: 'zx-table__column-move', type: 'button', disabled: index === 0,
        ariaLabel: `Move ${name} earlier`,
        dataset: { columnId: column.id, columnAction: 'up' }
      }, icon('chevron-up', { size: 11 })),
      h('button', {
        class: 'zx-table__column-move', type: 'button', disabled: index === this._columns.length - 1,
        ariaLabel: `Move ${name} later`,
        dataset: { columnId: column.id, columnAction: 'down' }
      }, icon('chevron-down', { size: 11 }))) : null;
      return h('div', { class: 'zx-table__column-option', dataset: { columnId: column.id } }, label, order);
    });
    this._columnList.replaceChildren(...controls, this._columnStatus);
    if (focusControl !== null) {
      let control = [...this._columnList.querySelectorAll('[data-column-action]')]
        .find((candidate) => {
          const element = /** @type {HTMLElement} */ (candidate);
          return element.dataset.columnId === focusControl.id
            && element.dataset.columnAction === focusControl.action;
        });
      if (/** @type {HTMLButtonElement|HTMLInputElement|undefined} */ (control)?.disabled) {
        control = [...this._columnList.querySelectorAll('.zx-table__column-move[data-column-action]')]
          .find((candidate) => {
            const element = /** @type {HTMLButtonElement|HTMLInputElement} */ (candidate);
            return element.dataset.columnId === focusControl.id && !element.disabled;
          }) ?? [...this._columnList.querySelectorAll('[data-column-action]')]
            .find((candidate) => {
              const element = /** @type {HTMLButtonElement|HTMLInputElement} */ (candidate);
              return element.dataset.columnId === focusControl.id && !element.disabled;
            });
      }
      queueMicrotask(() => {
        if (control?.isConnected) /** @type {HTMLElement} */ (control).focus();
      });
    }
  }

  /** @returns {{id:string,action:string}|null} */
  _activeColumnControl() {
    const active = typeof document === 'undefined' ? null : /** @type {HTMLElement|null} */ (document.activeElement);
    if (!active || !this._columnList?.contains(active)) return null;
    const id = active.dataset.columnId;
    const action = active.dataset.columnAction;
    return id && action ? { id, action } : null;
  }

  /** @param {Event} event @returns {void} */
  _handleColumnControlClick(event) {
    const button = /** @type {Element|null} */ (event.target)?.closest?.('.zx-table__column-move');
    if (!button || !this._columnList?.contains(button)) return;
    const id = /** @type {HTMLElement} */ (button).dataset.columnId;
    const action = /** @type {HTMLElement} */ (button).dataset.columnAction;
    const index = this.getColumnOrder().indexOf(String(id));
    if (action === 'up' && index > 0) this.moveColumn(String(id), this._columns[index - 1].id, 'before');
    if (action === 'down' && index >= 0 && index < this._columns.length - 1) {
      this.moveColumn(String(id), this._columns[index + 1].id, 'after');
    }
  }

  /**
   * Adds Arrow/Home/End movement to the reorder buttons; Enter and Space retain native button
   * activation. Focus follows the stable column id across the cancel-safe row/header rebuild.
   * @param {KeyboardEvent} event Keyboard event.
   * @returns {void}
   */
  _handleColumnControlKeydown(event) {
    const control = /** @type {Element|null} */ (event.target)?.closest?.('.zx-table__column-move');
    if (!control || !this._columnList?.contains(control)) return;
    const id = String(/** @type {HTMLElement} */ (control).dataset.columnId);
    const order = this.getColumnOrder();
    const index = order.indexOf(id);
    if (index < 0) return;
    if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      event.preventDefault();
      if (index > 0) this.moveColumn(id, order[index - 1], 'before');
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      event.preventDefault();
      if (index < order.length - 1) this.moveColumn(id, order[index + 1], 'after');
    } else if (event.key === 'Home') {
      event.preventDefault();
      if (index > 0) this.moveColumn(id, order[0], 'before');
    } else if (event.key === 'End') {
      event.preventDefault();
      if (index < order.length - 1) this.moveColumn(id, order.at(-1), 'after');
    }
  }

  /** @param {DragEvent} event @returns {void} */
  _handleRowDragStart(event) {
    const handle = /** @type {Element|null} */ (event.target)?.closest?.('.zx-table__row-handle');
    const rowElement = handle?.closest('tr[data-row]');
    const meta = rowElement ? this._rowMeta.get(rowElement) : null;
    if (!handle || !meta || this._sort && this.options.sortMode === 'local') {
      event.preventDefault();
      return;
    }
    this._dragId = meta.id;
    rowElement.dataset.dragging = 'true';
    // Native drag needs a payload in some engines, but internal movement already uses `_dragId`.
    // Keep the transferable marker opaque so record identifiers never leave the table.
    event.dataTransfer?.setData('text/plain', 'zx-table-row');
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  /** @param {DragEvent} event @returns {void} */
  _handleRowDragOver(event) {
    if (this._dragId == null) return;
    const rowElement = /** @type {Element|null} */ (event.target)?.closest?.('tr[data-row]');
    const meta = rowElement ? this._rowMeta.get(rowElement) : null;
    if (!meta || Object.is(meta.id, this._dragId) || !this._canMoveTogether(this._dragId, meta.id)) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    this._clearDropMarkers();
    const rectangle = rowElement.getBoundingClientRect();
    rowElement.dataset.drop = event.clientY >= rectangle.top + rectangle.height / 2 ? 'after' : 'before';
  }

  /** @param {DragEvent} event @returns {void} */
  _handleRowDrop(event) {
    if (this._dragId == null) return;
    const rowElement = /** @type {Element|null} */ (event.target)?.closest?.('tr[data-row]');
    const meta = rowElement ? this._rowMeta.get(rowElement) : null;
    const position = rowElement?.dataset.drop === 'after' ? 'after' : 'before';
    if (meta && this._canMoveTogether(this._dragId, meta.id)) {
      event.preventDefault();
      this.moveRow(this._dragId, meta.id, position);
    }
    this._clearRowDrag();
  }

  /** @param {KeyboardEvent} event @returns {void} */
  _handleRowHandleKeydown(event) {
    const handle = /** @type {Element|null} */ (event.target)?.closest?.('.zx-table__row-handle');
    const rowElement = handle?.closest('tr[data-row]');
    const meta = rowElement ? this._rowMeta.get(rowElement) : null;
    if (!handle || !meta) return;
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      this._grabbedId = Object.is(this._grabbedId, meta.id) ? null : meta.id;
      handle.setAttribute('aria-pressed', String(this._grabbedId != null));
      // Row movement has its own visually hidden live region. Reusing the visible validation
      // message would make a successful drop look like a red editing error on editable grids.
      const status = this._rowMoveMessage ?? this._editMessage;
      if (status) status.textContent = this._grabbedId == null
        ? 'Row dropped' : 'Row grabbed. Use the arrow keys to move it.';
      return;
    }
    if (event.key === 'Escape' && this._grabbedId != null) {
      event.preventDefault();
      this._grabbedId = null;
      handle.setAttribute('aria-pressed', 'false');
      return;
    }
    if (!Object.is(this._grabbedId, meta.id) || !['ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    const siblings = this._siblingIds(meta.id);
    const index = siblings.findIndex((id) => Object.is(id, meta.id));
    const targetId = siblings[index + (event.key === 'ArrowUp' ? -1 : 1)];
    if (targetId !== undefined) this.moveRow(meta.id, targetId, event.key === 'ArrowUp' ? 'before' : 'after');
  }

  /** @param {unknown} id @returns {unknown[]} */
  _siblingIds(id) {
    const row = this.getRow(id);
    if (!row) return [];
    const parent = this._hierarchy ? readRowValue(this._hierarchy.parentId, row) : null;
    return this._data.filter((candidate) => !this._hierarchy
      || sameHierarchyParent(readRowValue(this._hierarchy.parentId, candidate), parent))
      .map((candidate) => this._idFor(candidate));
  }

  /** @param {unknown} left @param {unknown} right @returns {boolean} */
  _canMoveTogether(left, right) {
    if (!this._hierarchy) return true;
    const a = this.getRow(left);
    const b = this.getRow(right);
    return Boolean(a && b && sameHierarchyParent(
      readRowValue(this._hierarchy.parentId, a), readRowValue(this._hierarchy.parentId, b)));
  }

  /** @param {unknown} id @returns {HTMLElement|null} */
  _rowHandle(id) {
    return /** @type {HTMLElement|null} */ (this._rowElements.get(id)?.[0]?.querySelector('.zx-table__row-handle') ?? null);
  }

  /** @returns {void} */
  _clearDropMarkers() {
    for (const row of this._tbody.querySelectorAll('tr[data-drop]')) delete row.dataset.drop;
  }

  /** @returns {void} */
  _clearRowDrag() {
    for (const row of this._tbody.querySelectorAll('tr[data-dragging]')) delete row.dataset.dragging;
    this._clearDropMarkers();
    this._dragId = null;
  }

  /** @returns {string|null} */
  _hierarchyColumn() {
    if (!this._hierarchy) return null;
    return this._visibleColumns().some((column) => column.id === this._hierarchy.column)
      ? this._hierarchy.column : this._visibleColumns()[0]?.id ?? null;
  }

  /** @returns {void} */
  _renderColumns() {
    const fragment = document.createDocumentFragment();
    if (this.options.rowReorder) fragment.append(h('col', { class: 'zx-table__reorder-column' }));
    if (this.options.selectable === 'multi') {
      fragment.append(h('col', { class: 'zx-table__selection-column' }));
    }
    const columns = this._visibleColumns();
    const fractions = columns.map((column) => parseFraction(column.width));
    const total = fractions.reduce((sum, value) => sum + value, 0);
    this._table.dataset.layout = total > 0 ? 'fixed' : 'auto';
    columns.forEach((column, index) => {
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
    if (this._growStep) row.setAttribute('aria-rowindex', '1');
    if (this.options.rowReorder) row.append(h('th', {
      class: 'zx-table__reorder-header', scope: 'col', ariaLabel: 'Row order'
    }));
    if (this.options.selectable === 'multi') {
      this._selectAll = h('input', {
        class: 'zx-table__checkbox zx-table__select-all',
        type: 'checkbox',
        ariaLabel: this._message('table.selectAll', 'Select all rows', [])
      });
      const selectionHeader = h('th', {
        class: 'zx-table__selection-header',
        scope: 'col'
      }, this._selectAll);
      row.append(selectionHeader);
      this.listen(this._selectAll, 'click', () => {
        /*
         * The rendered rows, not every row in the data. With `growing` on, selecting a hundred
         * records because the reader ticked a box above the ten they can see is a trap — the next
         * click is usually a bulk action. `showAll()` first if you mean all of them.
         */
        if (this._selectAll.checked) {
          for (const dataRow of this._selectableData()) this._selected.add(this._idFor(dataRow));
        } else {
          for (const dataRow of this._selectableData()) this._selected.delete(this._idFor(dataRow));
        }
        this._selectionAnchorId = null;
        this._extendBase = null;
        this._syncSelection();
        this._emitSelectionChange();
      });
    } else {
      this._selectAll = null;
    }

    this._headers = new Map();
    // What this header was built from, so `_renderBody()` can tell whether it is still the right one.
    this._headerSpanning = this._spanning;
    for (const column of this._visibleColumns()) {
      // `data-column` on the header and on every body cell, in every mode, so a read-only table
      // can be styled per column as readily as an editable one.
      const th = h('th', { scope: 'col', dataset: { column: column.id } });
      const align = column.align ?? (isNumericColumn(column) ? 'end' : null);
      if (align) th.dataset.align = align;
      if (column.headerTitle) th.title = column.headerTitle;
      // A blank header (an icon or actions column) still needs a name, or every cell beneath it
      // is announced with an empty column header.
      const name = tableHeaderName(column);
      if (name !== null) th.setAttribute('aria-label', name);
      // Withheld, not disabled: a header that invites a sort the component will refuse is worse
      // than a header that never offered one. The label still reads exactly the same.
      if (column.sortable && !this._spanning) {
        const button = h('button', {
          class: 'zx-table__sort-button',
          type: 'button',
          ariaLabel: name ?? undefined
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
    // Read before anything is torn down: whether focus is in the body, and on which part of a row,
    // decides where it lands again once the rows are rebuilt.
    const focus = this._captureFocus();
    // Every data mutation funnels through here, so this is the single place that guarantees no
    // editor component outlives the rows it was rendered into.
    this._abortEdit({ focus: false });
    // A range anchored on the old order would select the wrong rows in the new one: Shift+Arrow and
    // Shift+click start over after a sort, new data, or a change in what is expanded.
    this._extendBase = null;
    this._selectionAnchorId = null;
    /*
     * And the single place that notices the data gaining or losing its sections. The header owns
     * the sort controls, so it has to be rebuilt when the answer flips — otherwise a table that was
     * given grouped data after construction keeps offering a sort it will now refuse, and one whose
     * sections were filtered away never gets its sort back.
     *
     * Compared against what the *header* was built from, not against `_spanning`: `_sortData()`
     * runs first on every data mutation and has already brought `_spanning` up to date, so
     * comparing against it would find no change and leave the stale header in place.
     */
    this._spanning = this._hasSpanningRow();
    if (this._headers && this._spanning !== this._headerSpanning) this._renderHeader();
    const fragment = document.createDocumentFragment();
    this._rowMeta = new WeakMap();
    this._rowNames = new WeakMap();
    this._rowElements = new Map();
    this._rovingEl = null;
    const projected = this._projectedData();
    this._hierarchyMeta = new Map(projected.map((entry) => [entry.id, entry]));
    if (this._data.length === 0) {
      fragment.append(h('tr', { class: 'zx-table__empty-row' },
        h('td', { class: 'zx-table__empty', colspan: this._spanColspan() }, this._emptyContent())
      ));
    } else {
      // Indices stay absolute: a row's index is its place in the data, not in what is on screen.
      this._visibleEntries().forEach((entry, visibleIndex) => {
        fragment.append(this._createRow(entry.row, entry.index, { ...entry, visibleIndex }));
      });
    }
    this._tbody.replaceChildren(fragment);
    this._table.setAttribute('aria-colcount', String(this._visibleColumns().length
      + (this.options.selectable === 'multi' ? 1 : 0) + (this.options.rowReorder ? 1 : 0)));
    /*
     * With `growing` on, the DOM holds a prefix of the data — so without this a screen reader
     * announces "row 3 of 10" for a table of ten thousand. The header counts as a row.
     */
    if (this._growStep) this._table.setAttribute('aria-rowcount', String(projected.length + 1));
    this._syncSelectAll();
    this._syncGrowing();
    if (this._stacked) this._applyStackedRoles(true);
    this._syncRoving(focus);
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

  /**
   * @param {TableRow} row
   * @param {number} index
   * @param {TableHierarchyEntry & {visibleIndex: number}} tree
   * @returns {HTMLTableRowElement}
   */
  _createRow(row, index, tree) {
    const id = this._idFor(row);
    const tr = /** @type {HTMLTableRowElement} */ (h('tr', { dataset: { row: '' } }));
    // Only a prefix is in the DOM while growing, so each visible row states where it really is.
    if (this._growStep) tr.setAttribute('aria-rowindex', String(tree.visibleIndex + 2));
    const rowClass = typeof this.options.rowClass === 'function' ? this.options.rowClass(row) : '';
    if (rowClass) tr.classList.add(...String(rowClass).split(/\s+/).filter(Boolean));
    const kind = this._rowKind === null ? null : resolveRowKind(row, this._rowKind);
    const kindSpec = kind === null ? null : resolveRowKindSpec(this._rowKinds, kind);
    const spanning = Boolean(kindSpec?.span);
    if (kind !== null) tr.dataset.rowKind = kind;
    if (kindSpec?.class) tr.classList.add(...String(kindSpec.class).split(/\s+/).filter(Boolean));
    // A spanning row is a heading, not a record: `aria-selected="false"` would announce it as one
    // more selectable row that simply is not selected.
    if (this.options.selectable !== false && !spanning) {
      tr.setAttribute('aria-selected', String(this._selected.has(id)));
    }
    if (this._hierarchy) {
      tr.setAttribute('aria-level', String(tree.depth + 1));
      if (tree.hasChildren) tr.setAttribute('aria-expanded', String(this._expanded.has(id)));
    }
    // Rows take the roving focus in row mode, and in a cell-focus treegrid too, where ArrowLeft
    // from the first cell lands on the row so the branch can be expanded or collapsed.
    if (this._interactive && (this._focusMode === 'row' || this._hierarchy)) tr.tabIndex = -1;
    this._rowMeta.set(tr, { row, id, index, visibleIndex: tree.visibleIndex });
    const elements = this._rowElements.get(id) ?? [];
    elements.push(tr);
    this._rowElements.set(id, elements);

    if (spanning) {
      tr.dataset.span = 'true';
      /*
       * One cell, `<th scope="colgroup">`, covering the reorder and selection columns as well as
       * the data ones: the row labels the columns of the records beneath it, so it belongs in the
       * accessibility tree as a heading and not as a value — and a second, narrower cell beside it
       * would put a blank column back into exactly the layout this removes.
       */
      const cell = /** @type {HTMLTableCellElement} */ (h('th', {
        class: 'zx-table__section-cell', scope: 'colgroup', colspan: this._spanColspan()
      }));
      const content = spanRowContent(row, kindSpec, this._visibleColumns(), index);
      if (content && typeof content === 'object' && typeof content.nodeType === 'number') {
        cell.append(content);
      } else if (content != null) cell.append(document.createTextNode(String(content)));
      if (this._focusMode === 'cell') cell.tabIndex = -1;
      tr.append(cell);
      return tr;
    }

    if (this.options.rowReorder) {
      const handle = h('button', {
        class: 'zx-table__row-handle', type: 'button', draggable: true,
        dataset: { rowHandle: '' },
        ariaPressed: String(Object.is(this._grabbedId, id)),
        disabled: Boolean(this._sort && this.options.sortMode === 'local'),
        title: this._sort && this.options.sortMode === 'local' ? 'Clear sorting to reorder rows' : null
      }, icon('drag', { size: 14 }));
      tr.append(h('td', { class: 'zx-table__reorder-cell' }, handle));
    }

    if (this.options.selectable === 'multi') {
      // Out of the Tab order: Space on the focused row does what the checkbox does, and thirty
      // checkboxes would otherwise be thirty Tab stops in front of whatever follows the table.
      const checkbox = h('input', {
        class: 'zx-table__checkbox zx-table__row-checkbox',
        type: 'checkbox',
        tabIndex: -1,
        checked: this._selected.has(id)
      });
      tr.append(h('td', { class: 'zx-table__selection-cell' }, checkbox));
    }

    this._visibleColumns().forEach((column) => {
      const cell = /** @type {HTMLTableCellElement} */ (h('td'));
      const align = column.align ?? (isNumericColumn(column) ? 'end' : null);
      if (align) cell.dataset.align = align;
      // Written unconditionally: `responsive` can be switched on after the rows exist, and a
      // stacked cell has no column header above it to say what its value means.
      cell.dataset.label = column.label;
      cell.dataset.column = column.id;
      if (column.popin === false) cell.dataset.popin = 'false';
      if (this._focusMode === 'cell') cell.tabIndex = -1;
      if (this._editMode !== false && resolveEditable(column, row) !== false) cell.dataset.editable = 'true';
      this._renderCellContent(cell, column, row, index, tree);
      tr.append(cell);
    });
    this._rowNames.set(tr, tableRowLabel([...tr.cells].map((cell) => cell.textContent)));
    this._labelRowControls(tr);
    return tr;
  }

  /**
   * Names a row's own controls after the row's content rather than its position: "Select Acme
   * GmbH", not "Select row 3", which tells a screen reader user nothing and changes on every sort.
   * The position is the fallback for a row without any text.
   * @param {HTMLTableRowElement} tr Rendered row.
   * @returns {void}
   */
  _labelRowControls(tr) {
    const meta = this._rowMeta.get(tr);
    if (!meta) return;
    const name = this._rowNames.get(tr) ?? this._message('table.row', 'row %1', [meta.index + 1]);
    const checkbox = tr.querySelector('.zx-table__row-checkbox');
    checkbox?.setAttribute('aria-label', this._message('table.selectRow', 'Select %1', [name]));
    tr.querySelector('.zx-table__row-handle')
      ?.setAttribute('aria-label', this._message('table.moveRow', 'Move %1', [name]));
    const toggle = tr.querySelector('.zx-table__tree-toggle');
    if (toggle) {
      const expanded = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-label', expanded
        ? this._message('table.collapseRow', 'Collapse %1', [name])
        : this._message('table.expandRow', 'Expand %1', [name]));
    }
  }

  /**
   * Fills a cell with the column's rendered value, replacing anything already in it.
   * @param {HTMLTableCellElement} cell Target cell.
   * @param {TableColumn} column Column definition.
   * @param {TableRow} row Row data.
   * @param {number} index Row index.
   * @param {TableHierarchyEntry} [tree] Hierarchy metadata for the row.
   * @returns {void}
   */
  _renderCellContent(cell, column, row, index, tree = this._hierarchyMeta?.get(this._idFor(row))) {
    const value = formatTableCell(column, row, index);
    const content = h('span', { class: 'zx-table__cell-content' });
    if (value && typeof value === 'object' && typeof value.nodeType === 'number') content.append(value);
    else if (value != null) content.append(document.createTextNode(String(value)));

    if (!this._hierarchy || column.id !== this._hierarchyColumn() || !tree) {
      cell.replaceChildren(...content.childNodes);
      return;
    }

    const branch = h('span', { class: 'zx-table__tree-cell' });
    branch.style.setProperty('--zx-table-depth', String(tree.depth));
    if (tree.hasChildren) {
      const expanded = this._expanded.has(tree.id);
      // Out of the Tab order like the row checkbox: ArrowRight and ArrowLeft on the row expand
      // and collapse it. The pointer still has the button.
      branch.append(h('button', {
        class: 'zx-table__tree-toggle',
        type: 'button',
        tabIndex: -1,
        ariaExpanded: String(expanded)
      }, icon(expanded ? 'chevron-down' : 'chevron-right', { size: 14 })));
    } else {
      branch.append(h('span', { class: 'zx-table__tree-spacer', ariaHidden: 'true' }));
    }
    branch.append(content);
    cell.replaceChildren(branch);
    // A cell re-rendered after an edit rebuilds its disclosure, which needs its name again.
    if (cell.parentElement) this._labelRowControls(/** @type {HTMLTableRowElement} */ (cell.parentElement));
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
    if (target.closest('.zx-table__row-handle')) return;
    // Read the row metadata first: committing re-renders the body and detaches `rowElement`.
    if (this._edit) {
      this.commitEdit();
      // Validation or a preventDefault() persistence guard keeps the editor authoritative.
      if (this._edit) return;
    }

    const disclosure = target.closest('.zx-table__tree-toggle');
    if (disclosure) {
      this.toggleRow(meta.id);
      return;
    }

    const checkbox = target.closest('.zx-table__row-checkbox');
    if (checkbox && this.options.selectable === 'multi') {
      this._toggleMultiSelection(meta, /** @type {HTMLInputElement} */ (checkbox).checked, event.shiftKey);
      return;
    }

    // Only an editable table holds a click on a control inside a cell back from the row: there the
    // click could otherwise open an editor. A read-only table activates the row as it always has.
    if (this._editMode !== false && isInteractiveCellContent(target)) return;

    if (this._editMode !== false && this._editTrigger === 'single') {
      const cell = target?.closest('td[data-editable="true"]');
      if (cell && this._tbody.contains(cell)) {
        this.startEdit(meta.id, String(cell.dataset.column));
        return;
      }
    }

    this._activateRow(meta, event);
  }

  /**
   * Activates a row: the click path, shared by Enter on a focused row or cell.
   * @param {{row: TableRow, id: unknown, index: number, visibleIndex?: number}} meta Row metadata.
   * @param {Event} event Originating click or keydown.
   * @returns {void}
   * @fires Table#rowclick
   * @fires Table#selectionchange
   */
  _activateRow(meta, event) {
    this.emit('rowclick', { ...meta, event });
    // The click still reaches the host — collapsing a section is a reasonable thing to hang off it —
    // but it does not select the heading, which carries no checkbox in `multi` either.
    if (this.options.selectable === 'single' && !this._selected.has(meta.id)
      && !this._isSpanningRow(meta.row)) {
      this._selected = new Set([meta.id]);
      this._selectionAnchorId = meta.id;
      this._extendBase = null;
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
    if (this._editMode !== false && isInteractiveCellContent(target)) return;
    if (this._editMode !== false && this._editTrigger === 'double') {
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
      const locale = resolveColumnOption(column.locale, row);
      const decimals = resolveColumnDecimals(column, row);
      const suffix = column.type === 'currency'
        ? resolveColumnOption(column.currency, row)
        : column.type === 'unit' ? resolveColumnOption(column.unit, row) : null;
      const inferred = {
        ...(locale != null && !Object.prototype.hasOwnProperty.call(props, 'locale') ? { locale } : {}),
        ...(decimals != null && !Object.prototype.hasOwnProperty.call(props, 'precision')
          ? { precision: decimals }
          : {}),
        ...(suffix != null && !Object.prototype.hasOwnProperty.call(props, 'unit') ? { unit: String(suffix) } : {})
      };
      const field = new NumberField(null, { ...inferred, ...props, value: value ?? null });
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
      ariaLabel: props.ariaLabel ?? `${tableColumnName(column)} row ${index + 1}`,
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
    // Opening a text, number, or date editor selects its content, so typing replaces the old value
    // ("6" over "1.00" gives 6, not 1.006). Selected after focus: NumberField rewrites its text on
    // focus, from the grouped display to a plain re-parseable number.
    if (editorSelectsOnEntry(entry.type) && typeof control.select === 'function') control.select();
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
    const columns = this._visibleColumns();
    const columnCount = columns.length;
    if (rowIndex < 0 || columnCount === 0) return null;
    const visible = this._visibleData();
    const startingId = this._idFor(this._data[rowIndex]);
    let row = visible.findIndex((candidate) => Object.is(this._idFor(candidate), startingId));
    if (row < 0) return null;
    let column = columns.findIndex((candidate) => candidate.id === columnId);
    const limit = visible.length * columnCount + columnCount;
    for (let step = 0; step < limit; step += 1) {
      column += direction;
      if (column >= columnCount) {
        row += 1;
        column = 0;
      } else if (column < 0) {
        row -= 1;
        column = columnCount - 1;
      }
      if (row < 0 || row >= visible.length) return null;
      const candidateRow = visible[row];
      const candidateColumn = columns[column];
      // Tab walks past a section heading rather than stopping on a row that has no cells to edit.
      if (this._isSpanningRow(candidateRow)) continue;
      if (resolveEditable(candidateColumn, candidateRow) !== false) {
        return {
          id: this._idFor(candidateRow),
          columnId: candidateColumn.id,
          index: this._data.indexOf(candidateRow)
        };
      }
    }
    return null;
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

  /** @returns {HTMLTableRowElement[]} Rendered body rows in display order, section rows included. */
  _navRows() {
    return /** @type {HTMLTableRowElement[]} */ ([...this._tbody.children]
      .filter((row) => row.hasAttribute('data-row')));
  }

  /**
   * Cells that take focus while the table moves focus by cell: the data cells, or the single cell of
   * a section row. The selection and reorder cells are not among them; their controls have keys of
   * their own on the row.
   * @param {HTMLTableRowElement} tr Body row.
   * @returns {HTMLTableCellElement[]}
   */
  _navCells(tr) {
    return /** @type {HTMLTableCellElement[]} */ ([...tr.cells].filter((cell) =>
      cell.hasAttribute('data-column') || cell.classList.contains('zx-table__section-cell')));
  }

  /**
   * The cell of a row that matches the current column: by id, else by position, so a section row
   * (one cell) or a hidden column still lands somewhere sensible.
   * @param {HTMLTableRowElement} tr Body row.
   * @returns {HTMLElement}
   */
  _cellFor(tr) {
    const cells = this._navCells(tr);
    if (cells.length === 0) return tr;
    const columnId = this._current?.columnId;
    const byId = columnId == null ? null : cells.find((cell) => cell.dataset.column === columnId);
    return byId ?? cells[Math.min(Math.max(this._current?.columnIndex ?? 0, 0), cells.length - 1)];
  }

  /** @param {HTMLTableRowElement} tr @returns {HTMLElement} Element of a row that holds the Tab stop. */
  _rovingTarget(tr) {
    if (this._focusMode === 'row' || this._hierarchy && this._current?.onRow) return tr;
    return this._cellFor(tr);
  }

  /** @param {HTMLElement} element New roving Tab stop. @returns {void} */
  _setRoving(element) {
    if (this._rovingEl && this._rovingEl !== element) this._rovingEl.tabIndex = -1;
    element.tabIndex = 0;
    this._rovingEl = element;
  }

  /**
   * Records which part of a row holds focus before the body is rebuilt.
   * @returns {{part: 'row'|'cell'|'checkbox'|'toggle'|'handle'}|null} Null when focus is elsewhere.
   */
  _captureFocus() {
    const active = typeof document === 'undefined' ? null : document.activeElement;
    // The frame holds focus while the table is empty; the first row takes it back.
    if (active && active === this._scroll && this._scroll.hasAttribute('data-empty-focus')) return { part: 'row' };
    if (!active || !this._tbody?.contains(active)) return null;
    const tr = active.closest('tr[data-row]');
    if (!tr) return null;
    if (active === tr) return { part: 'row' };
    if (active.closest('.zx-table__row-checkbox')) return { part: 'checkbox' };
    if (active.closest('.zx-table__tree-toggle')) return { part: 'toggle' };
    if (active.closest('.zx-table__row-handle')) return { part: 'handle' };
    return { part: this._focusMode === 'cell' ? 'cell' : 'row' };
  }

  /**
   * Puts the Tab stop back on the current row after a render — the same row by id; else, when a
   * collapsed ancestor hid it, that ancestor; else the row now at its old position — and gives it
   * focus again only when the body had focus before. The focus is restored without scrolling: a
   * table refreshed by polling must not pull the page back to itself.
   * @param {{part: string}|null} focus What `_captureFocus()` found before the render.
   * @returns {void}
   */
  _syncRoving(focus) {
    if (!this._interactive) return;
    const rows = this._navRows();
    this._syncEmptyFocus(rows.length === 0 && focus !== null);
    if (rows.length === 0) return;
    let tr = this._current ? this._rowElements.get(this._current.id)?.[0] : undefined;
    if (!tr && this._current && this._hierarchy) {
      tr = this._renderedAncestor(this._current.id);
      if (tr) {
        const meta = this._rowMeta.get(tr);
        this._current = { ...this._current, id: meta.id, visibleIndex: meta.visibleIndex, onRow: true };
      }
    }
    if (!tr) {
      tr = rows[Math.min(Math.max(this._current?.visibleIndex ?? 0, 0), rows.length - 1)];
      if (this._current) {
        const meta = this._rowMeta.get(tr);
        this._current = { ...this._current, id: meta.id, visibleIndex: meta.visibleIndex };
      }
    }
    const element = this._rovingTarget(tr);
    this._setRoving(element);
    if (!focus) return;
    const control = {
      checkbox: '.zx-table__row-checkbox', toggle: '.zx-table__tree-toggle', handle: '.zx-table__row-handle:not(:disabled)'
    }[focus.part];
    const target = control ? /** @type {HTMLElement|null} */ (tr.querySelector(control)) ?? element : element;
    target.focus({ preventScroll: true });
  }

  /**
   * The nearest ancestor of a row that is rendered — where focus goes when collapsing a branch
   * hid the focused row.
   * @param {unknown} id Row id.
   * @returns {HTMLTableRowElement|undefined}
   */
  _renderedAncestor(id) {
    if (!this._hierarchy) return undefined;
    const seen = new Set();
    let row = this.getRow(id);
    while (row) {
      const parentId = readRowValue(this._hierarchy.parentId, row);
      if (parentId == null || seen.has(parentId)) return undefined;
      seen.add(parentId);
      const element = this._rowElements.get(parentId)?.[0];
      if (element) return element;
      row = this.getRow(parentId);
    }
    return undefined;
  }

  /**
   * While the table has no rows to focus, its frame takes focus instead of letting it fall to the
   * document — and gives the Tab order its old shape back once rows return.
   * @param {boolean} hold Whether focus was in the body and there is now no row for it.
   * @returns {void}
   */
  _syncEmptyFocus(hold) {
    const frame = this._scroll;
    if (hold) {
      if (!frame.hasAttribute('tabindex')) {
        frame.tabIndex = -1;
        frame.setAttribute('data-empty-focus', '');
      }
      frame.focus({ preventScroll: true });
    } else if (frame.hasAttribute('data-empty-focus')) {
      frame.removeAttribute('tabindex');
      frame.removeAttribute('data-empty-focus');
    }
  }

  /** @param {Event} event @returns {void} */
  _handleFocusIn(event) {
    if (!this._interactive) return;
    const target = /** @type {Element|null} */ (event.target?.nodeType === 1 ? event.target : null);
    const tr = /** @type {HTMLTableRowElement|null} */ (target?.closest('tr[data-row]') ?? null);
    if (!tr || tr.parentElement !== this._tbody) return;
    const meta = this._rowMeta.get(tr);
    if (!meta) return;
    const current = {
      id: meta.id,
      visibleIndex: meta.visibleIndex,
      columnId: this._current?.columnId ?? null,
      columnIndex: this._current?.columnIndex ?? 0,
      onRow: false
    };
    let element = /** @type {HTMLElement} */ (tr);
    if (this._focusMode === 'cell') {
      const cells = this._navCells(tr);
      const cell = cells.find((candidate) => candidate === target || candidate.contains(target)) ?? null;
      if (target === tr && this._hierarchy) {
        current.onRow = true;
      } else if (cell) {
        element = cell;
        // A section's single cell keeps the column the reader came from, so moving on past the
        // section returns to it.
        if (cell.dataset.column) {
          current.columnId = cell.dataset.column;
          current.columnIndex = cells.indexOf(cell);
        }
      } else {
        this._current = current;
        element = this._cellFor(tr);
      }
    }
    this._current = current;
    this._setRoving(element);
  }

  /**
   * The APG grid and treegrid keyboard model on the focused row or cell. The row's own checkbox and
   * disclosure answer the navigation keys too, so a pointer user who clicked one can carry on by
   * keyboard; anything else inside a cell — a link, a button, an open editor — keeps its keys.
   * @param {KeyboardEvent} event Keydown event.
   * @returns {void}
   * @fires Table#rowclick
   * @fires Table#selectionchange
   * @fires Table#rowtoggle
   */
  _handleGridKeydown(event) {
    if (!this._interactive || event.defaultPrevented || event.altKey) return;
    const target = /** @type {HTMLElement|null} */ (event.target?.nodeType === 1 ? event.target : null);
    if (!target || this._edit && isInsideEditor(target)) return;
    const tr = /** @type {HTMLTableRowElement|null} */ (target.closest('tr[data-row]'));
    if (!tr || tr.parentElement !== this._tbody) return;
    const meta = this._rowMeta.get(tr);
    if (!meta) return;
    const cellMode = this._focusMode === 'cell';
    const cells = cellMode ? this._navCells(tr) : [];
    const onRow = target === tr;
    const onCell = cells.includes(/** @type {HTMLTableCellElement} */ (target));
    const ownControl = target.matches('.zx-table__row-checkbox, .zx-table__tree-toggle');
    if (!onRow && !onCell && !ownControl) return;
    const key = event.key;
    const mod = event.ctrlKey || event.metaKey;

    if (mod && (key === 'a' || key === 'A')) {
      if (this.options.selectable !== 'multi') return;
      event.preventDefault();
      this._selectAllRendered();
      return;
    }
    if ((key === 'Enter' || key === ' ') && !ownControl) {
      if (mod) return;
      event.preventDefault();
      if (key === ' ' && this.options.selectable !== false && !this._isSpanningRow(meta.row)) {
        this._toggleRowSelection(meta);
      } else {
        this._activateRow(meta, event);
      }
      return;
    }
    if (this._hierarchy && (key === 'ArrowLeft' || key === 'ArrowRight') && !mod) {
      const entry = this._hierarchyMeta?.get(meta.id);
      if (!entry) return;
      event.preventDefault();
      const action = treegridArrowAction(key, {
        focus: onCell ? 'cell' : 'row',
        cells: cellMode,
        column: onCell ? cells.indexOf(/** @type {HTMLTableCellElement} */ (target)) : 0,
        columns: cells.length,
        hasChildren: entry.hasChildren,
        expanded: this._expanded.has(meta.id),
        hasParent: entry.parentId != null
      });
      if (action) this._applyTreeAction(action, tr, meta, entry.parentId);
      return;
    }

    const rows = this._navRows();
    const rowIndex = rows.indexOf(tr);
    const byCell = cellMode && !onRow;
    const column = onCell ? cells.indexOf(/** @type {HTMLTableCellElement} */ (target))
      : Math.max(0, cells.indexOf(/** @type {HTMLTableCellElement} */ (this._cellFor(tr))));
    const next = tableGridTarget({ row: rowIndex, column }, key, {
      rows: rows.length, columns: byCell ? cells.length : 1, page: this._pageSize(rows), ctrl: mod, cells: byCell
    });
    if (!next) return;
    event.preventDefault();
    const targetRow = rows[next.row];
    if (!byCell) {
      targetRow.focus();
    } else if (next.row === rowIndex || key === 'Home' || key === 'End') {
      // A horizontal move, or a jump to a corner: pick the cell by position in the target row.
      const targetCells = this._navCells(targetRow);
      const last = next.column >= cells.length - 1 && key !== 'Home';
      targetCells[last ? targetCells.length - 1 : Math.min(next.column, targetCells.length - 1)]?.focus();
    } else {
      this._cellFor(targetRow).focus();
    }
    if (event.shiftKey && this.options.selectable === 'multi' && next.row !== rowIndex) {
      this._extendSelection(meta, this._rowMeta.get(targetRow));
    }
  }

  /**
   * Carries out one treegrid arrow-key action on a row.
   * @param {{action: string, column?: number}} action What `treegridArrowAction()` decided.
   * @param {HTMLTableRowElement} tr Focused row.
   * @param {{id: unknown}} meta Row metadata.
   * @param {unknown} parentId Parent row id, or null at the root.
   * @returns {void}
   * @fires Table#rowtoggle
   */
  _applyTreeAction(action, tr, meta, parentId) {
    if (action.action === 'expand') this.expandRow(meta.id);
    else if (action.action === 'collapse') this.collapseRow(meta.id);
    else if (action.action === 'parent') this._rowElements.get(parentId)?.[0]?.focus();
    else if (action.action === 'child') {
      const rows = this._navRows();
      rows[rows.indexOf(tr) + 1]?.focus();
    } else if (action.action === 'row') tr.focus();
    else if (action.action === 'cell') this._navCells(tr)[action.column ?? 0]?.focus();
  }

  /**
   * How many rows PageUp and PageDown move: what fits in the scroll region when the table scrolls
   * on its own, else ten.
   * @param {HTMLTableRowElement[]} rows Rendered rows.
   * @returns {number}
   */
  _pageSize(rows) {
    const scroller = this._scroll;
    if (!scroller || !rows[0] || scroller.scrollHeight <= scroller.clientHeight + 1) return 10;
    const header = this.options.stickyHeader ? this._thead.getBoundingClientRect().height : 0;
    return tablePageSize(scroller.clientHeight - header, rows[0].getBoundingClientRect().height);
  }

  /**
   * Space on a row: toggles it in `multi`, and in `single` selects it or clears the selection.
   * @param {{row: TableRow, id: unknown, index: number, visibleIndex?: number}} meta Row metadata.
   * @returns {void}
   * @fires Table#selectionchange
   */
  _toggleRowSelection(meta) {
    const selected = this._selected.has(meta.id);
    if (this.options.selectable === 'multi') {
      this._toggleMultiSelection(meta, !selected, false);
      return;
    }
    this._selected = selected ? new Set() : new Set([meta.id]);
    this._selectionAnchorId = meta.id;
    this._extendBase = null;
    this._syncSelection();
    this._emitSelectionChange();
  }

  /**
   * Ctrl/Cmd+A: selects every rendered row that can hold a selection, as the header checkbox does.
   * @returns {void}
   * @fires Table#selectionchange
   */
  _selectAllRendered() {
    const next = new Set(this._selected);
    for (const row of this._selectableData()) next.add(this._idFor(row));
    this._extendBase = null;
    if (sameSet(next, this._selected)) return;
    this._selected = next;
    this._syncSelection();
    this._emitSelectionChange();
  }

  /**
   * Shift+Arrow: selects the rows between the anchor and the row focus moved to, on top of what was
   * selected before the extension began — moving back shrinks the range again.
   * @param {{id: unknown}} from Row focus moved from.
   * @param {{id: unknown}|undefined} to Row focus moved to.
   * @returns {void}
   * @fires Table#selectionchange
   */
  _extendSelection(from, to) {
    if (!to) return;
    const visible = this._visibleData();
    const indexOf = (id) => visible.findIndex((row) => Object.is(this._idFor(row), id));
    if (this._extendBase === null) {
      this._extendBase = new Set(this._selected);
      if (indexOf(this._selectionAnchorId) < 0) this._selectionAnchorId = from.id;
    }
    const anchor = indexOf(this._selectionAnchorId);
    const end = indexOf(to.id);
    if (anchor < 0 || end < 0) return;
    const next = new Set(this._extendBase);
    for (let index = Math.min(anchor, end); index <= Math.max(anchor, end); index += 1) {
      if (!this._isSpanningRow(visible[index])) next.add(this._idFor(visible[index]));
    }
    if (sameSet(next, this._selected)) return;
    this._selected = next;
    this._syncSelection();
    this._emitSelectionChange();
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

  /** @param {{row: TableRow, id: unknown, index: number, visibleIndex?: number}} meta @param {boolean} checked @param {boolean} shiftKey @returns {void} */
  _toggleMultiSelection(meta, checked, shiftKey) {
    const visible = this._visibleData();
    const anchorIndex = visible.findIndex((row) => Object.is(this._idFor(row), this._selectionAnchorId));
    if (shiftKey && anchorIndex >= 0) {
      const currentIndex = meta.visibleIndex ?? visible.findIndex((row) => Object.is(this._idFor(row), meta.id));
      const start = Math.min(anchorIndex, currentIndex);
      const end = Math.max(anchorIndex, currentIndex);
      for (let index = start; index <= end; index += 1) {
        // Indices stay against the rendered rows so `visibleIndex` still lines up; a section caught
        // inside the range is stepped over rather than selected.
        if (this._isSpanningRow(visible[index])) continue;
        const id = this._idFor(visible[index]);
        if (checked) this._selected.add(id);
        else this._selected.delete(id);
      }
    } else if (checked) {
      this._selected.add(meta.id);
    } else {
      this._selected.delete(meta.id);
    }
    this._selectionAnchorId = meta.id;
    this._extendBase = null;
    this._syncSelection();
    this._emitSelectionChange();
  }

  /** @returns {void} */
  _syncSelection() {
    for (const [id, rows] of this._rowElements) {
      const selected = this._selected.has(id);
      for (const row of rows) {
        // A spanning row never claimed `aria-selected`; writing it here would tell a screen reader
        // the heading is a selectable record that happens to be unselected.
        if (row.hasAttribute('data-span')) continue;
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
    // Measured against what is rendered, so the box reflects the rows the reader can actually see —
    // and only the ones that can be ticked, so a section heading never holds the box indeterminate.
    const visible = this._selectableData();
    const selectedRows = visible.reduce(
      (count, row) => count + Number(this._selected.has(this._idFor(row))),
      0
    );
    this._selectAll.disabled = visible.length === 0;
    this._selectAll.checked = visible.length > 0 && selectedRows === visible.length;
    this._selectAll.indeterminate = selectedRows > 0 && selectedRows < visible.length;
  }

  /** @returns {void} */
  _syncSortHeader() {
    if (!this._headers) return;
    for (const [id, header] of this._headers) {
      // A withheld control must not leave `aria-sort` behind: with the sort inert the attribute
      // would announce an order the rows are not actually in.
      if (!this._spanning && this._sort?.id === id) {
        header.setAttribute('aria-sort', this._sort.dir === 'asc' ? 'ascending' : 'descending');
      } else header.removeAttribute('aria-sort');
    }
  }

  /** @returns {void} */
  _sortData() {
    // Recomputed here and not only in `_renderBody()`: every data mutation sorts before it renders,
    // so data that has just gained a section must be seen as grouped before the sort would run.
    this._spanning = this._hasSpanningRow();
    if (!this._sort || this._spanning) return;
    const column = this._columns.find((candidate) => candidate.id === this._sort.id);
    if (!column) return;
    const getValue = typeof column.sortValue === 'function' ? column.sortValue : (row) => row?.[column.id];
    this._data = this._hierarchy
      ? sortHierarchyRows(this._data, this.options.rowId, this._hierarchy.parentId, getValue, this._sort.dir)
      : sortRows(this._data, getValue, this._sort.dir);
  }

  /** @param {unknown} id @param {boolean} expanded @param {{silent?: boolean}} options @returns {this} */
  _setRowExpanded(id, expanded, options) {
    if (!this._hierarchy) return this;
    const branchIds = hierarchyBranchIds(this._data, this.options.rowId, this._hierarchy.parentId);
    if (!branchIds.some((candidate) => Object.is(candidate, id))) return this;
    if (this._expanded.has(id) === expanded) return this;
    if (expanded) this._expanded.add(id);
    else this._expanded.delete(id);
    this._renderBody();
    if (!options.silent) this._emitRowToggle(id, expanded);
    return this;
  }

  /** @param {unknown} id @param {boolean} expanded @returns {void} */
  _emitRowToggle(id, expanded) {
    const row = this.getRow(id);
    if (row) this.emit('rowtoggle', { row, id, expanded });
  }

  /** Keeps the reader's current expansion state limited to branches still present in the data. */
  _reconcileExpanded() {
    if (!this._hierarchy) {
      this._expanded.clear();
      return;
    }
    const branches = hierarchyBranchIds(this._data, this.options.rowId, this._hierarchy.parentId);
    const valid = new Set(branches);
    for (const id of this._expanded) if (!valid.has(id)) this._expanded.delete(id);
  }

  /** @returns {Set<unknown>} Ids of every row in the data that may hold a selection. */
  _selectableIds() {
    const ids = new Set();
    for (const row of this._data) {
      if (!this._isSpanningRow(row)) ids.add(this._idFor(row));
    }
    return ids;
  }

  /** @returns {boolean} Whether selection changed. */
  _pruneSelection() {
    const valid = this._selectableIds();
    const previousSize = this._selected.size;
    for (const id of this._selected) if (!valid.has(id)) this._selected.delete(id);
    if (!valid.has(this._selectionAnchorId)) this._selectionAnchorId = null;
    this._extendBase = null;
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
/** @event Table#rowtoggle @type {CustomEvent<TableRowToggleDetail>} */
/** @event Table#stackedchange @type {CustomEvent<{stacked: boolean}>} */
/** @event Table#grow @type {CustomEvent<{rendered: number, total: number}>} */
/** @event Table#rowmove @type {CustomEvent<TableRowMoveDetail>} */
/** @event Table#columnvisibilitychange @type {CustomEvent<{visible:string[],hidden:string[]}>} */
/** @event Table#columnorderchange @type {CustomEvent<{order:string[]}>} */

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
 * Where a navigation key moves focus in the table body: the arithmetic of the APG grid keyboard
 * model, kept apart from the DOM. Positions are zero-based and every move is clamped — focus never
 * wraps, as the APG asks of a grid.
 *
 * With `cells` false (row focus) only the vertical keys move: ArrowUp/ArrowDown by one row,
 * PageUp/PageDown by `page`, Home/End (with or without Ctrl) to the first or last row. With `cells`
 * true ArrowLeft/ArrowRight move one cell, Home/End go to the first or last cell of the row, and
 * Ctrl+Home/Ctrl+End to the first cell of the first row or the last cell of the last row.
 * @param {{row: number, column?: number}} position Current position.
 * @param {string} key `KeyboardEvent.key`.
 * @param {{rows: number, columns?: number, page?: number, ctrl?: boolean, cells?: boolean}} grid
 * Row and column counts, the page size, whether Ctrl/Cmd is held, and whether focus is on cells.
 * @returns {{row: number, column: number}|null} New position, or null when the key is not a move.
 */
export function tableGridTarget(position, key, grid) {
  const rows = Math.trunc(Number(grid?.rows) || 0);
  if (rows <= 0) return null;
  const columns = Math.max(1, Math.trunc(Number(grid?.columns) || 1));
  const page = Math.max(1, Math.trunc(Number(grid?.page) || 10));
  const clamp = (value, max) => Math.min(Math.max(Math.trunc(Number(value) || 0), 0), max);
  const row = clamp(position?.row, rows - 1);
  const column = clamp(position?.column, columns - 1);
  const cells = Boolean(grid?.cells);
  const ctrl = Boolean(grid?.ctrl);
  switch (key) {
    case 'ArrowUp': return { row: Math.max(0, row - 1), column };
    case 'ArrowDown': return { row: Math.min(rows - 1, row + 1), column };
    case 'PageUp': return { row: Math.max(0, row - page), column };
    case 'PageDown': return { row: Math.min(rows - 1, row + page), column };
    case 'ArrowLeft': return cells ? { row, column: Math.max(0, column - 1) } : null;
    case 'ArrowRight': return cells ? { row, column: Math.min(columns - 1, column + 1) } : null;
    case 'Home':
      if (!cells) return { row: 0, column };
      return ctrl ? { row: 0, column: 0 } : { row, column: 0 };
    case 'End':
      if (!cells) return { row: rows - 1, column };
      return ctrl ? { row: rows - 1, column: columns - 1 } : { row, column: columns - 1 };
    default: return null;
  }
}

/**
 * How many rows a PageUp or PageDown moves: the rows that fit in the visible height, less one so
 * the row focus leaves stays in view as context. Falls back when either height is unknown.
 * @param {number} viewport Visible height of the scroll region, below any sticky header.
 * @param {number} rowHeight Height of one row.
 * @param {number} [fallback=10] Rows to move when the heights are unusable.
 * @returns {number} At least 1.
 */
export function tablePageSize(viewport, rowHeight, fallback = 10) {
  const visible = Number(viewport);
  const height = Number(rowHeight);
  if (!(visible > 0) || !(height > 0)) return Math.max(1, Math.trunc(fallback) || 10);
  return Math.max(1, Math.floor(visible / height) - 1);
}

/**
 * ArrowLeft and ArrowRight in a treegrid, after the APG Treegrid pattern.
 *
 * Row focus (`focus: 'row'`): ArrowRight expands a collapsed branch; on an expanded branch it moves
 * into the first child — or, when cells take focus too (`cells`), onto the row's first cell, which
 * is also where it goes from a leaf. ArrowLeft collapses an expanded branch and otherwise moves to
 * the parent row. Cell focus: ArrowRight moves one cell right; ArrowLeft one cell left, and from the
 * first cell onto the row itself, where the branch can be expanded or collapsed.
 * @param {'ArrowLeft'|'ArrowRight'|string} key `KeyboardEvent.key`.
 * @param {{focus: 'row'|'cell', cells?: boolean, column?: number, columns?: number,
 *   hasChildren?: boolean, expanded?: boolean, hasParent?: boolean}} state Focused row and cell.
 * @returns {{action: 'expand'|'collapse'|'child'|'parent'|'row'|'cell', column?: number}|null}
 * What to do, or null when focus stays where it is.
 */
export function treegridArrowAction(key, state) {
  const right = key === 'ArrowRight';
  if (!right && key !== 'ArrowLeft') return null;
  if (state?.focus === 'cell') {
    const column = Math.max(0, Math.trunc(Number(state.column) || 0));
    const columns = Math.max(1, Math.trunc(Number(state.columns) || 1));
    if (right) return column < columns - 1 ? { action: 'cell', column: column + 1 } : null;
    return column > 0 ? { action: 'cell', column: column - 1 } : { action: 'row' };
  }
  const branch = Boolean(state?.hasChildren);
  const expanded = branch && Boolean(state?.expanded);
  if (right) {
    if (branch && !expanded) return { action: 'expand' };
    if (state?.cells) return { action: 'cell', column: 0 };
    return expanded ? { action: 'child' } : null;
  }
  if (expanded) return { action: 'collapse' };
  return state?.hasParent ? { action: 'parent' } : null;
}

/**
 * The name a row goes by in the labels of its own controls ("Select …", "Expand …"): the text of
 * its first cell that has any, whitespace collapsed and long text cut short. Null when no cell has
 * text, which is when the caller falls back to the row's position.
 * @param {Array<string|null|undefined>} texts Text of the row's cells, in display order.
 * @param {number} [max=80] Longest name returned before it is cut with an ellipsis.
 * @returns {string|null}
 */
export function tableRowLabel(texts, max = 80) {
  for (const text of Array.isArray(texts) ? texts : []) {
    const name = String(text ?? '').replace(/\s+/g, ' ').trim();
    if (name) return name.length > max ? `${name.slice(0, Math.max(1, max - 1)).trimEnd()}…` : name;
  }
  return null;
}

/**
 * Resolves a row's kind through the `rowKind` accessor and coerces it to the string `rowKinds` is
 * keyed by.
 *
 * Only `null` and `undefined` mean "no kind". `0` and `''` are kinds like any other: a ZeyOS
 * transaction line uses `0` for a position and `1` for a section, so a falsy test here would render
 * every position as though the table had never been told about kinds at all.
 * @param {TableRow} row Row to classify.
 * @param {string|((row: TableRow) => unknown)|null|undefined} rowKind Field name or accessor.
 * @returns {string|null} The kind as a string, or null when there is none.
 */
export function resolveRowKind(row, rowKind) {
  if (rowKind == null || rowKind === '') return null;
  const raw = typeof rowKind === 'function' ? rowKind(row) : row?.[rowKind];
  return raw == null ? null : String(raw);
}

/**
 * Looks one resolved kind up in the `rowKinds` map.
 *
 * Own properties only: a kind read out of server data could just as easily be `toString` or
 * `constructor`, and inherited members of `Object.prototype` are not configuration.
 * @param {Record<string, TableRowKind>|null|undefined} rowKinds Kind map.
 * @param {string|null} kind Resolved kind.
 * @returns {TableRowKind|null} Matching entry, or null.
 */
export function resolveRowKindSpec(rowKinds, kind) {
  if (kind === null || rowKinds == null || typeof rowKinds !== 'object') return null;
  if (!Object.prototype.hasOwnProperty.call(rowKinds, kind)) return null;
  const spec = rowKinds[kind];
  return spec && typeof spec === 'object' ? spec : null;
}

/**
 * Whether a row draws as one spanning cell under the given configuration.
 * @param {TableRow} row Row to classify.
 * @param {string|((row: TableRow) => unknown)|null|undefined} rowKind Field name or accessor.
 * @param {Record<string, TableRowKind>|null|undefined} rowKinds Kind map.
 * @returns {boolean}
 */
export function isSpanningRow(row, rowKind, rowKinds) {
  return Boolean(resolveRowKindSpec(rowKinds, resolveRowKind(row, rowKind))?.span);
}

/**
 * Whether a data set holds a row that spans — the question that decides whether `Table` offers its
 * sort controls at all.
 *
 * Asked of the whole data rather than of the rendered prefix: with `growing` on, a sort control
 * that disappeared the moment the reader pressed "show 20 more" would be worse than one that was
 * never there. Asked again on every data change, so a filter that removes the last section gives
 * the sort back.
 * @param {TableRow[]} rows Rows to scan.
 * @param {string|((row: TableRow) => unknown)|null|undefined} rowKind Field name or accessor.
 * @param {Record<string, TableRowKind>|null|undefined} rowKinds Kind map.
 * @returns {boolean}
 */
export function hasSpanningRow(rows, rowKind, rowKinds) {
  if (!Array.isArray(rows) || rowKind == null || rowKinds == null) return false;
  return rows.some((row) => isSpanningRow(row, rowKind, rowKinds));
}

/**
 * How many cells one table row occupies.
 *
 * `selectable: 'multi'` and `rowReorder` each render a `<col>` and a leading cell of their own, and
 * a spanning cell that ignored them would leave the row one or two columns short — the table would
 * still lay out, silently and wrongly. `selectable: 'single'` adds no column: the whole row is the
 * control there.
 * @param {number} columnCount Number of visible data columns.
 * @param {{selectable?: TableSelectionMode, rowReorder?: boolean}} [structure={}] Structural columns.
 * @returns {number} Colspan covering every rendered cell, never below 1.
 */
export function tableSpanColspan(columnCount, structure = {}) {
  const columns = Number.isFinite(Number(columnCount)) ? Math.max(0, Math.trunc(Number(columnCount))) : 0;
  const extras = (structure.selectable === 'multi' ? 1 : 0) + (structure.rowReorder ? 1 : 0);
  return Math.max(1, columns + extras);
}

/**
 * Content for a spanning row's single cell.
 *
 * Without a `render` the cell shows the row's raw value for the first visible column — the same
 * thing a host writes by hand today. Deliberately raw rather than routed through the column's own
 * renderer or display type: that renderer was written for a record, and running it against a
 * heading that carries no quantities or amounts is how a section row ends up showing `0,00 €`.
 * @param {TableRow} row Row being rendered.
 * @param {TableRowKind|null|undefined} spec Resolved kind presentation.
 * @param {TableColumn[]} visibleColumns Columns currently rendered, in display order.
 * @param {number} [index=0] Flat row index.
 * @returns {Node|string|number|null|undefined} Cell content.
 */
export function spanRowContent(row, spec, visibleColumns, index = 0) {
  if (typeof spec?.render === 'function') return spec.render(row, index);
  const first = visibleColumns?.[0];
  return first ? row?.[first.id] : null;
}

/**
 * Applies a column's built-in display type. A custom renderer always wins and may still return a
 * Node; all built-in results are strings so `_renderCellContent` can insert them as text.
 * @param {TableColumn} column Column definition.
 * @param {TableRow} row Source row.
 * @param {number} [index=0] Flat row index.
 * @returns {Node|string|number|null|undefined} Rendered cell value.
 */
export function formatTableCell(column, row, index = 0) {
  if (typeof column?.render === 'function') return column.render(row, index);
  const value = row?.[column?.id];
  const type = column?.type ?? 'text';
  if (type === 'text') return value;

  const locale = resolveColumnOption(column.locale, row);
  const decimals = resolveColumnDecimals(column, row);
  const options = {
    ...(locale != null ? { locale: String(locale) } : {}),
    ...(decimals != null ? { decimals } : {})
  };
  if (type === 'number') return formatNumber(value, options);
  if (type === 'currency') {
    const currency = resolveColumnOption(column.currency, row);
    return formatCurrency(value, currency == null ? null : String(currency), options);
  }
  if (type === 'percent') return formatPercent(value, options);
  if (type === 'unit') {
    const number = formatNumber(value, options);
    const unit = resolveColumnOption(column.unit, row);
    return number && unit != null && String(unit) !== '' ? `${number}\u00a0${unit}` : number;
  }
  return value;
}

/**
 * Projects flat parent references into the currently visible stable depth-first order. Orphans
 * become roots. A cycle is broken at its first source row, so every row is emitted once and the
 * traversal can never recurse forever.
 * @param {TableRow[]} rows Flat source rows.
 * @param {string|((row: TableRow) => unknown)} rowId Row id accessor.
 * @param {string|((row: TableRow) => unknown)} parentId Parent id accessor.
 * @param {Set<unknown>|unknown[]} [expanded=[]] Expanded branch ids.
 * @returns {TableHierarchyEntry[]} Visible hierarchy entries.
 */
export function projectHierarchyRows(rows, rowId, parentId, expanded = []) {
  const forest = hierarchyForest(rows, rowId, parentId);
  const open = expanded instanceof Set ? expanded : new Set(expanded);
  /** @type {TableHierarchyEntry[]} */
  const result = [];
  const stack = forest.roots.slice().reverse().map((node) => ({ node, depth: 0 }));
  while (stack.length) {
    const { node, depth } = stack.pop();
    result.push({
      row: node.row,
      id: node.id,
      index: node.index,
      depth,
      hasChildren: node.children.length > 0,
      parentId: node.parent?.id ?? null
    });
    if (!open.has(node.id)) continue;
    for (let index = node.children.length - 1; index >= 0; index -= 1) {
      stack.push({ node: node.children[index], depth: depth + 1 });
    }
  }
  return result;
}

/**
 * Sorts roots and each sibling set independently, returning all rows in depth-first order. Parent
 * and child rows never cross levels merely because their cell values compare differently.
 * @param {TableRow[]} rows Flat source rows.
 * @param {string|((row: TableRow) => unknown)} rowId Row id accessor.
 * @param {string|((row: TableRow) => unknown)} parentId Parent id accessor.
 * @param {(row: TableRow) => unknown} getValue Sort accessor.
 * @param {TableSortDirection} direction Sort direction.
 * @returns {TableRow[]} Sorted flat rows.
 */
export function sortHierarchyRows(rows, rowId, parentId, getValue, direction) {
  const forest = hierarchyForest(rows, rowId, parentId);
  const sorted = (nodes) => sortRows(nodes, (node) => getValue(node.row), direction);
  const result = [];
  const stack = sorted(forest.roots).reverse();
  while (stack.length) {
    const node = stack.pop();
    result.push(node.row);
    const children = sorted(node.children);
    for (let index = children.length - 1; index >= 0; index -= 1) stack.push(children[index]);
  }
  return result;
}

/**
 * Returns a reordered copy, or null when IDs are missing or hierarchical rows are not siblings.
 * Moving a parent changes its sibling order; hierarchy projection keeps its descendant subtree
 * attached as a unit because parent references are never rewritten.
 * @param {TableRow[]} rows
 * @param {string|((row:TableRow)=>unknown)} rowId
 * @param {unknown} id
 * @param {unknown} targetId
 * @param {'before'|'after'} [position='before']
 * @param {string|((row:TableRow)=>unknown)|null} [parentId=null]
 * @returns {TableRow[]|null}
 */
export function reorderTableRows(rows, rowId, id, targetId, position = 'before', parentId = null) {
  if (!Array.isArray(rows) || Object.is(id, targetId)) return null;
  const from = rows.findIndex((row) => Object.is(readRowValue(rowId, row), id));
  const target = rows.findIndex((row) => Object.is(readRowValue(rowId, row), targetId));
  if (from < 0 || target < 0) return null;
  if (parentId && !sameHierarchyParent(
    readRowValue(parentId, rows[from]), readRowValue(parentId, rows[target]))) return null;
  if (parentId) {
    const forest = hierarchyForest(rows, rowId, parentId);
    const movingNode = forest.nodes[from];
    const targetNode = forest.nodes[target];
    if (!movingNode || !targetNode || movingNode.parent !== targetNode.parent) return null;

    /** @param {TableHierarchyNode} root @returns {TableHierarchyNode[]} */
    const branchNodes = (root) => {
      const result = [];
      const stack = [root];
      while (stack.length) {
        const node = /** @type {TableHierarchyNode} */ (stack.pop());
        result.push(node);
        for (let index = node.children.length - 1; index >= 0; index -= 1) stack.push(node.children[index]);
      }
      return result;
    };
    const moving = new Set(branchNodes(movingNode).map((node) => node.index));
    const targetBranch = new Set(branchNodes(targetNode).map((node) => node.index));
    const block = rows.filter((_row, index) => moving.has(index));
    const remaining = rows.filter((_row, index) => !moving.has(index));
    const remainingSourceIndexes = rows.map((_row, index) => index).filter((index) => !moving.has(index));
    let insertion = remainingSourceIndexes.findIndex((index) => index === target);
    if (position === 'after') {
      const targetPositions = remainingSourceIndexes
        .map((sourceIndex, index) => targetBranch.has(sourceIndex) ? index : -1)
        .filter((index) => index >= 0);
      insertion = Math.max(...targetPositions) + 1;
    }
    if (insertion < 0) return null;
    remaining.splice(insertion, 0, ...block);
    return remaining;
  }
  const next = [...rows];
  const [moving] = next.splice(from, 1);
  const adjustedTarget = next.findIndex((row) => Object.is(readRowValue(rowId, row), targetId));
  next.splice(adjustedTarget + (position === 'after' ? 1 : 0), 0, moving);
  return next;
}

/**
 * Resolves the editor type of a column for one row.
 *
 * `column.editor` wins over `column.editable`, except that a per-row `editable` function returning
 * `false` still marks the cell read-only. `editable: true` infers `'number'` for number, currency,
 * percent, and unit columns and `'text'` otherwise; unknown type names are treated as not editable.
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
  if (declared === true) return isNumericColumn(column) ? 'number' : 'text';
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

/** @param {unknown} option @param {TableRow} row @returns {unknown} */
function resolveColumnOption(option, row) {
  return typeof option === 'function' ? option(row) : option;
}

/**
 * Normalizes an explicit fraction-digit value while preserving a nullish callback result as
 * "unspecified" so Intl and NumberField can use their normal currency/value defaults.
 * @param {TableColumn} column
 * @param {TableRow} row
 * @returns {number|null}
 */
function resolveColumnDecimals(column, row) {
  const value = resolveColumnOption(column?.decimals, row);
  if (value == null) return null;
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.trunc(number)) : null;
}

/** @param {TableColumn} column @returns {boolean} */
function isNumericColumn(column) {
  return ['number', 'currency', 'percent', 'unit'].includes(column?.type);
}

/**
 * Builds a canonical forest without mutating source rows. The first row encountered in a cycle is
 * promoted to a root; source order therefore makes malformed data deterministic.
 * @param {TableRow[]} rows
 * @param {string|((row: TableRow) => unknown)} rowId
 * @param {string|((row: TableRow) => unknown)} parentId
 * @returns {{roots: TableHierarchyNode[], nodes: TableHierarchyNode[]}}
 */
function hierarchyForest(rows, rowId, parentId) {
  /** @type {TableHierarchyNode[]} */
  const nodes = (Array.isArray(rows) ? rows : []).map((row, index) => ({
    row,
    id: readRowValue(rowId, row),
    index,
    parent: null,
    children: []
  }));
  const byId = new Map();
  for (const node of nodes) if (!byId.has(node.id)) byId.set(node.id, node);

  /** @type {Map<TableHierarchyNode, TableHierarchyNode|null>} */
  const parentOf = new Map();
  for (const node of nodes) {
    const parentValue = readRowValue(parentId, node.row);
    const parent = parentValue == null ? null : byId.get(parentValue) ?? null;
    parentOf.set(node, parent === node ? null : parent);
  }

  // Parent references form a functional graph. Breaking the repeated node's edge turns every
  // connected component into a finite tree while keeping all non-cyclic parent links intact.
  for (const node of nodes) {
    const seen = new Set([node]);
    let cursor = parentOf.get(node) ?? null;
    while (cursor) {
      if (seen.has(cursor)) {
        parentOf.set(cursor, null);
        break;
      }
      seen.add(cursor);
      cursor = parentOf.get(cursor) ?? null;
    }
  }

  const roots = [];
  for (const node of nodes) {
    node.parent = parentOf.get(node) ?? null;
    if (node.parent) node.parent.children.push(node);
    else roots.push(node);
  }
  return { roots, nodes };
}

/**
 * @param {TableRow[]} rows
 * @param {string|((row: TableRow) => unknown)} rowId
 * @param {string|((row: TableRow) => unknown)} parentId
 * @returns {unknown[]}
 */
function hierarchyBranchIds(rows, rowId, parentId) {
  return hierarchyForest(rows, rowId, parentId).nodes
    .filter((node) => node.children.length > 0)
    .map((node) => node.id);
}

/** @param {string|((row: TableRow) => unknown)} accessor @param {TableRow} row @returns {unknown} */
function readRowValue(accessor, row) {
  return typeof accessor === 'function' ? accessor(row) : row?.[accessor];
}

/**
 * Null and undefined both identify the hierarchy root; other IDs retain exact identity.
 * @param {unknown} left
 * @param {unknown} right
 * @returns {boolean}
 */
function sameHierarchyParent(left, right) {
  return left == null && right == null || Object.is(left, right);
}

/**
 * @param {unknown} option
 * @param {TableColumn[]} columns
 * @returns {(TableHierarchyOptions & {column: string})|null}
 */
function normalizeHierarchy(option, columns) {
  if (!option || typeof option !== 'object') return null;
  const parentId = option.parentId;
  if (typeof parentId !== 'string' && typeof parentId !== 'function') return null;
  const requested = typeof option.column === 'string' ? option.column : null;
  const column = columns.some((candidate) => candidate.id === requested)
    ? requested
    : columns[0]?.id;
  if (!column) return null;
  return { ...option, parentId, column };
}

/**
 * Normalizes the `rowKind` accessor. Anything that is not a non-empty field name or a callback is
 * `null`, which is the switch that keeps every existing table on exactly its old rendering path.
 * @param {unknown} option Configured accessor.
 * @returns {string|((row: TableRow) => unknown)|null}
 */
function normalizeRowKind(option) {
  if (typeof option === 'function') return /** @type {(row: TableRow) => unknown} */ (option);
  return typeof option === 'string' && option !== '' ? option : null;
}

/**
 * Normalizes the `rowKinds` map. An array, a function or a primitive is not a keyed map and is
 * discarded rather than half-read.
 * @param {unknown} option Configured kind map.
 * @returns {Record<string, TableRowKind>|null}
 */
function normalizeRowKinds(option) {
  if (!option || typeof option !== 'object' || Array.isArray(option)) return null;
  return /** @type {Record<string, TableRowKind>} */ (option);
}

/** @param {unknown} option @returns {Set<unknown>} */
function initialExpanded(option) {
  return new Set(Array.isArray(option) ? option : []);
}

/**
 * Resolves the `variant` option to one the stylesheet knows; anything else is the default frame.
 * @param {unknown} value Requested variant.
 * @returns {TableVariant}
 */
export function normalizeTableVariant(value) {
  return value === 'plain' ? 'plain' : 'default';
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

/** @param {Element|null} target @returns {boolean} */
function isInteractiveCellContent(target) {
  const cell = target?.closest?.('td[data-column]');
  const interactive = target?.closest?.([
    'a[href]', 'button', 'input', 'select', 'textarea', 'summary', '[contenteditable="true"]',
    '[role="button"]', '[role="link"]', '[tabindex]:not([tabindex="-1"])', '[data-zx-table-no-edit]'
  ].join(','));
  return Boolean(cell && interactive && interactive !== cell && cell.contains(interactive));
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

/**
 * Validates and shallow-clones table columns so stable-id APIs never mutate caller descriptors.
 * @param {unknown} columns Column descriptors.
 * @returns {TableColumn[]} Normalized descriptors.
 */
export function normalizeTableColumns(columns) {
  if (!Array.isArray(columns)) throw new TypeError('Table columns must be an array');
  const seen = new Set();
  return columns.map((column, index) => {
    if (!column || typeof column !== 'object' || Array.isArray(column)) {
      throw new TypeError(`Table column at index ${index} must be an object`);
    }
    const id = String(column.id ?? '').trim();
    if (!id) throw new TypeError(`Table column at index ${index} requires an id`);
    if (seen.has(id)) throw new TypeError(`Duplicate table column: ${id}`);
    seen.add(id);
    return { ...column, id, label: String(column.label ?? id) };
  });
}

/**
 * The name a column goes by wherever it is named rather than shown: its `ariaLabel`, else its
 * visible label, else its id. The column chooser lists columns by it and cell editors are labelled
 * with it, so a column with a blank header still has a name in both.
 * @param {Partial<TableColumn>|null|undefined} column Column descriptor.
 * @returns {string} Non-empty name, unless the column has no id either.
 */
export function tableColumnName(column) {
  for (const candidate of [column?.ariaLabel, column?.label]) {
    const text = candidate == null ? '' : String(candidate).trim();
    if (text) return text;
  }
  return String(column?.id ?? '');
}

/**
 * The accessible name a column header needs on top of its content, or null when its visible label
 * already names it. That is the `ariaLabel` when one is given, and the column id when the label is
 * blank — an icon or actions column — so no header is announced as an empty column.
 * @param {Partial<TableColumn>|null|undefined} column Column descriptor.
 * @returns {string|null} Name to set as `aria-label`, or null.
 */
export function tableHeaderName(column) {
  const label = column?.label == null ? '' : String(column.label).trim();
  const explicit = column?.ariaLabel == null ? '' : String(column.ariaLabel).trim();
  if (explicit) return explicit;
  return label ? null : tableColumnName(column) || null;
}

/**
 * Whether opening an editor of this type selects its content, so the first keystroke replaces the
 * value instead of being appended to it. True for the single-line text, number, and date editors;
 * a textarea keeps its caret, and a select, checkbox, or custom editor keeps its own focus
 * behaviour.
 * @param {TableEditorType|string} type Resolved editor type.
 * @returns {boolean}
 */
export function editorSelectsOnEntry(type) {
  return type === 'text' || type === 'number' || type === 'date';
}

/**
 * Reconciles saved or partial column IDs with every current column.
 * @param {TableColumn[]} columns Current columns.
 * @param {unknown} order Preferred IDs.
 * @returns {string[]} Complete stable order.
 */
export function reconcileTableColumnOrder(columns, order) {
  const available = columns.map((column) => column.id);
  const allowed = new Set(available);
  const preferred = Array.isArray(order) ? order.map(String) : [];
  const included = new Set();
  const result = [];
  for (const id of preferred) {
    if (allowed.has(id) && !included.has(id)) {
      included.add(id);
      result.push(id);
    }
  }
  for (const id of available) if (!included.has(id)) result.push(id);
  return result;
}

/**
 * Moves one stable column ID without changing the supplied order.
 * @param {string[]} order Current IDs.
 * @param {string} id Moving ID.
 * @param {string} targetId Target ID.
 * @param {'before'|'after'} [position='before'] Target edge.
 * @returns {string[]} Reordered copy, or an unchanged copy for unknown/same IDs.
 */
export function moveTableColumn(order, id, targetId, position = 'before') {
  const next = [...order];
  const from = next.indexOf(id);
  const target = next.indexOf(targetId);
  if (from < 0 || target < 0 || from === target) return next;
  next.splice(from, 1);
  const insertion = next.indexOf(targetId) + (position === 'after' ? 1 : 0);
  next.splice(insertion, 0, id);
  return next;
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

/** @param {unknown[]} left @param {unknown[]} right @returns {boolean} */
function sameArray(left, right) {
  return left.length === right.length && left.every((value, index) => Object.is(value, right[index]));
}

/**
 * Normalizes the `growing` option into a batch size.
 * @param {unknown} growing Option value.
 * @returns {number|null} Batch size, or null when the table renders everything at once.
 */
function growStep(growing) {
  const step = Math.trunc(Number(growing));
  return Number.isFinite(step) && step > 0 ? step : null;
}
