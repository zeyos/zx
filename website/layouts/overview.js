/**
 * The overview composition: the column a record overview is made of — one toolbar (search, Filter,
 * Sort, View, the shape switch, and a live count), the filter strip of editable chips, the body
 * that holds one presentation of the records, and the pager — together with the two drawers it
 * opens: Filters (the `Filter` expression editor, on the same model as the chips) and View settings
 * (`ViewSettings`: fields, grouping, and the board's columns and swim lanes).
 *
 * The overview owns the behaviour; the layout owns the visuals. The overview filters, searches,
 * sorts, groups, and pages the records, switches and rebuilds the presentation, keeps View settings
 * bound to it, keeps the chips and the drawer on one filter, and applies the board's axis rule. The
 * layout draws each presentation in `createView()` — its renderers, card previews, board column
 * heads — and places `element` where it wants it, beside its own header, navigation, saved-view
 * tabs, or bulk bar.
 *
 *     const overview = createOverview(context, {
 *       root, label: 'Opportunity controls', fields: FIELDS, filterFields: FILTER_FIELDS,
 *       groups: AXES, defaultFilters, records, views: ['table', 'list', 'board'],
 *       createView: (shape, view) => shape === 'board'
 *         ? new KanbanView(null, { ...view.options, ...view.board.options, titleField: 'name' })
 *         : new TableView(null, { ...view.options, table: { ...view.table, label: 'Opportunities' } }),
 *       shortcuts: true
 *     });
 *     main.append(header, overview.element);
 *     overview.on('selectionchange', ({ detail }) => syncBulk(detail.ids));
 *
 * Styles: `overview.css`, under the `.overview` block (the drawers and the chip editor open outside
 * the layout and carry `overview__` classes). Wide, a layout lets its main pane make room for an
 * open drawer with one rule of its own, since only it knows which element that is: the overview
 * sets `data-overview-drawer` and `--overview-drawer-size` on `root` while a drawer is open.
 *
 *     @container shell (min-width: 1180px) {
 *       .crm[data-overview-drawer] .crm__main { margin-inline-end: min(var(--overview-drawer-size), 100vw); }
 *     }
 */
import {
  Checklist, Dropdown, Filter, ListToolbar, MenuButton, NumberField, Pagination, Select, Sheet, SortControl,
  ViewSettings, button, emptyState, formatDate, formatNumber, h, icon, uid
} from '../../src/index.js';
import { DATE, disposer, dot, later, layoutContext, renderScope, shortcuts } from './kit.js';
import {
  arityOf, astToFilters, conditionCount, filterExpression, filtersToAst, groupCount, groupsOf, mergeDrafts,
  nodeMatches, resolveBoardAxes, sortRecords, valueFor, withGroupRows, withoutDrafts
} from './overview-filters.js';

/**
 * @typedef {'table'|'list'|'cards'|'gallery'|'board'} OverviewShape
 */

/**
 * One field of the records: what the views show, what View settings arranges, and what sorts. Any
 * other `ViewField` property (`render`, `align`, `view: {table: {width}}`, …) is handed to the views
 * as given; `type`, `groupable`, `locked`, and `visible` are the overview's and are not.
 * @typedef {Object} OverviewField
 * @property {string} id Field id; also the record property unless `get` is given.
 * @property {string} label Field name.
 * @property {string} [type='text'] Type in the `ViewSettings` vocabulary (text, number, money, date,
 *   datetime, status, select, entity, tags, url, …): the glyph and type name in View settings.
 * @property {boolean} [groupable] `false` keeps the field out of View settings' grouping choices.
 * @property {boolean} [locked] Always shown and first in View settings — the record's title.
 * @property {boolean} [sortable] Offered by the Sort tool (and the table header).
 * @property {(record: Record<string, any>) => unknown} [get] Reads the value where the id is not
 *   the property. Used for filtering, grouping, searching, and sorting.
 * @property {(record: Record<string, any>) => unknown} [sortValue] What the field sorts by, where
 *   that is not its value (a stage's position, an owner's name).
 * @property {(record: Record<string, any>) => Node|string} [render] Cell renderer, for the views.
 */

/**
 * One field the filter can test, in the shape the `Filter` editor takes. The chips and the drawer
 * share it.
 * @typedef {Object} OverviewFilterField
 * @property {string} id Field id; also the record property unless `get` is given.
 * @property {string} label Field name on the chip and in the editor.
 * @property {'text'|'number'|'money'|'date'|'enum'|'tags'|string} type `Filter` field type.
 * @property {string} icon Glyph on the chip, in the add menu, and in the drawer's field picker.
 * @property {string[]} operators Core `filterOperators` ids, the first the default.
 * @property {string} [defaultOperator] Operator a new chip or row starts on.
 * @property {Array<{value: string|number|boolean, label: string, short?: string}>} [choices] Fixed
 *   choices; `short` is how a chip lists several.
 * @property {(record: Record<string, any>) => unknown} [get] Reads the value where the id is not
 *   the property.
 * @property {(value: unknown) => string} [format] How a chip prints a value. Omitted: a choice's
 *   label, a grouped number for money and numbers, a date, quoted text.
 * @property {{unit?: string, min?: number, max?: number, step?: number, group?: boolean}} [input]
 *   The chip editor's number field, for `money` and `number`.
 */

/**
 * A field the records group by, which is also an axis the board can use for its columns or lanes.
 * @typedef {Object} OverviewGroupAxis
 * @property {string} label Name on the View tool's badge ("Stage").
 * @property {Array<{id: string, label: string, tone?: string|null}>} buckets Its values in order;
 *   `tone` is a status dot kind (`neutral`, `info`, `success`, …) for group headings and columns.
 */

/**
 * The filter model: the chips (`conditions`, joined by `logic`), or a nested expression from the
 * drawer (`advanced`, a `FilterAst`) that replaces them.
 * @typedef {{logic: 'and'|'or', conditions: Array<{id?: string, field: string, operator: string, value: any}>, advanced: any}} OverviewFilters
 */

/**
 * Everything the overview hands `createView()`: spread `options` into the view's own options, add
 * the visuals. `options` carries the fields (overview properties stripped), an empty `data`, the
 * record id, the sort (`sortMode: 'server'` — the overview sorts), the per-shape hidden fields,
 * `fieldControls: false` (View settings arranges the fields), the empty state, and the sort,
 * selection, and record-click listeners. A board overrides `sortMode` to `'local'` if it sorts
 * cards itself.
 * @typedef {Object} OverviewViewContext
 * @property {OverviewShape} shape Shape to build.
 * @property {Record<string, any>} options Options every view takes.
 * @property {Record<string, any>} table For `TableView`'s `table` option: the group heading rows
 *   (`rowKind`, `rowKinds`). Spread it and add the table's own settings.
 * @property {((record: Record<string, any>) => string)|null} groupBy For `CardView`'s `groupBy`:
 *   the heading of a record's group ("Stage · 16"), or null while ungrouped.
 * @property {OverviewBoardContext|null} board For a board: its axes and listeners.
 * @property {() => Record<string, any>[]} records Every filtered record, sorted, across pages — for
 *   column totals and the like. Read it when drawing, not when building.
 * @property {OverviewState} state The state the view is built for.
 * @property {Overview} api The overview.
 */

/**
 * @typedef {Object} OverviewBoardContext
 * @property {string} columnBy Column field.
 * @property {string|null} swimlaneBy Lane field — the grouping — or null.
 * @property {boolean} showEmptyColumns Whether columns without cards stay.
 * @property {OverviewGroupAxis} columnAxis The column field's axis.
 * @property {OverviewGroupAxis|null} laneAxis The lane field's axis.
 * @property {Record<string, any>} options For `KanbanView`: `columnBy`, `columns`, `swimlaneBy`,
 *   `swimlanes`, `showEmptyColumns`, `moveMode: 'external'`, and an `onrecordmove` that writes the
 *   move into the records (through the field's own property), refreshes, and fires `recordmove`.
 */

/**
 * The overview's state, JSON-safe; `getState()` returns it and `setState()` takes any part of it.
 * @typedef {Object} OverviewState
 * @property {OverviewShape} view Current shape.
 * @property {string} query Search text.
 * @property {{id: string, dir: 'asc'|'desc'}} sort Sort.
 * @property {string|null} group Grouping field, or null. On the board it is also the swim lanes.
 * @property {{columnBy: string|null, showEmptyColumns: boolean}} board The board's columns.
 * @property {number} page Current page, from 1.
 * @property {number} pageSize Records per page.
 * @property {OverviewFilters} filters Filter model.
 */

/**
 * @typedef {Object} OverviewOptions
 * @property {OverviewField[]} fields The records' fields, in default order.
 * @property {Partial<Record<OverviewShape, string[]>>} [visible] Field ids each shape shows at first.
 * @property {(shape: OverviewShape) => string[]} [visibleBy] Same, as a function; wins over `visible`.
 * @property {string} [titleField] Field drawn as the record's title outside the table, so View
 *   settings leaves it out there (in the table it is a column, best `locked`).
 * @property {OverviewFilterField[]} filterFields What the filter can test.
 * @property {OverviewFilters} [defaultFilters] Starting filter; none by default.
 * @property {Record<string, OverviewGroupAxis>} [groups] Fields the records group by — also the
 *   board's axes. The order is the board's preference when the axes must move.
 * @property {Record<string, any>[]} [records] Starting records; see `setData()`.
 * @property {string} [recordId='ID'] Record id property.
 * @property {(shape: OverviewShape, view: OverviewViewContext) => any} createView Builds one
 *   presentation: a `TableView`, `CardView`, or `KanbanView` (any `RecordView`). Called on every
 *   switch, regrouping, and board change; the overview destroys the previous one.
 * @property {OverviewShape[]} [views] Shapes the switch offers, in order (keys 1–n choose them).
 * @property {OverviewShape} [view] Starting shape; the first of `views` by default.
 * @property {string|null} [group=null] Starting grouping.
 * @property {{columnBy?: string, showEmptyColumns?: boolean}} [board] The board's starting columns;
 *   the first of `groups` by default.
 * @property {{id: string, dir: 'asc'|'desc'}} [sort] Starting sort.
 * @property {number} [pageSize=25] Records per page.
 * @property {number[]} [pageSizes=[25, 50, 100]] Page sizes the pager offers.
 * @property {string} [label='Record controls'] Accessible name of the toolbar.
 * @property {{placeholder?: string, label?: string, text?: (record: Record<string, any>) => string}} [search]
 *   The search field: placeholder, the name of its search landmark, and the text a record is found
 *   by (its filter fields' values and choice labels by default).
 * @property {(count: number) => string} [countText] The toolbar's live count line ("12 records").
 * @property {{title?: string, description?: string}} [empty] The empty state's words.
 * @property {import('../../src/components/list-toolbar/list-toolbar.js').ListToolbarTool[]} [tools]
 *   More toolbar tools, after Filter, Sort, and View; each handles its own `onclick`.
 * @property {{size?: number, viewSize?: number}} [drawers] Widths of the Filters (400) and View
 *   settings (380) drawers. A phone-width window gives either all of its width.
 * @property {HTMLElement|null} [root=null] The layout's root: the theme scope of the drawers, where
 *   `data-overview-drawer` goes, and where the shortcuts bind.
 * @property {boolean} [shortcuts=false] Binds 1–n (shapes), F (Filters), Shift+F (Add filter),
 *   V (View settings), / (search), and Escape (close a drawer) on `root`. Not in preview.
 */

/**
 * @typedef {Object} Overview
 * @property {HTMLElement} element The column: toolbar, filter strip, body, footer. The layout
 *   places it; it may append overlays of its own (a bulk bar) to it.
 * @property {ListToolbar} toolbar The toolbar component (`toolbar.toElement()` is in `element`).
 * @property {HTMLElement} chips The filter strip.
 * @property {HTMLElement} body The scrolling body holding the presentation; `data-shape` names it.
 * @property {HTMLElement} footer The pager row; hidden on the board.
 * @property {(records: Record<string, any>[]) => void} setData Replaces the records and refreshes.
 *   A layout that changes records in place calls `refresh()` instead.
 * @property {() => void} refresh Re-reads the records into the current page.
 * @property {() => OverviewState} getState The current state, JSON-safe: what a saved view stores.
 * @property {(partial: Partial<OverviewState>) => void} setState Applies a saved view or preset.
 * @property {(shape: OverviewShape) => void} setView Switches the shape, as the switch does (`viewchange`).
 * @property {(field: string|null) => void} setGroup On the board, by the axis rule.
 * @property {(model: OverviewFilters) => void} setFilters Replaces the filter (`filterschange`, reason `set`).
 * @property {() => void} openFilters Opens the Filters drawer.
 * @property {() => void} focusAddFilter Shows the strip and focuses "Add filter".
 * @property {() => void} openViewSettings Opens the View settings drawer.
 * @property {() => void} closeDrawers Closes whichever drawer is open.
 * @property {(change: {group?: string|null, columnBy?: string, showEmptyColumns?: boolean}) => void} setBoardAxes
 *   Changes the board's columns or lanes by the axis rule (`resolveBoardAxes()`).
 * @property {() => any} getView The current presentation.
 * @property {() => Record<string, any>[]} getRecords Every record.
 * @property {() => Record<string, any>[]} getFiltered The filtered, sorted records across pages.
 * @property {() => string[]} getSelection Selected record ids, group headings left out.
 * @property {() => void} clearSelection Clears the presentation's selection.
 * @property {(type: OverviewEvent, listener: (event: CustomEvent) => void) => () => void} on
 *   Listens; returns the function that stops listening.
 */

/**
 * Events, through `on()`: `viewchange {view, previous}`, `filterschange {filters, reason}` (reason
 * `chip`, `remove`, `logic`, `drawer`, `clear`, or `set`), `groupchange {group}`, `pagechange
 * {page, pageSize}`, `selectionchange {ids}` (also after every refresh, as a page change can drop a
 * selection), `recordclick {record}` (never a group heading), `recordmove {ids, to}` after a card
 * moved on the board, and `render {records}` just before the view is handed a page — the moment to
 * destroy components a renderer made for the previous one (a `renderScope().reset()`).
 * @typedef {'viewchange'|'filterschange'|'groupchange'|'pagechange'|'selectionchange'|'recordclick'|'recordmove'|'render'} OverviewEvent
 */

/** Every shape, in the switch's default order. */
const SHAPES = /** @type {OverviewShape[]} */ (['table', 'list', 'cards', 'gallery', 'board']);

/**
 * How a chip reads each operator. Symbols keep a chip short; the words beside them are what a
 * screen reader hears, and what the editor's operator menu offers.
 */
const OPERATOR_TEXT = {
  eq: ['is'], neq: ['is not'], anyOf: ['is any of'], noneOf: ['is none of'],
  gte: ['≥', 'is at least'], lte: ['≤', 'is at most'], gt: ['>', 'is more than'], lt: ['<', 'is less than'],
  between: ['between', 'is between'], notBetween: ['not between', 'is not between'],
  before: ['before', 'is before'], after: ['after', 'is after'],
  onOrBefore: ['on or before', 'is on or before'], onOrAfter: ['on or after', 'is on or after'], on: ['on', 'is on'],
  notOn: ['not on', 'is not on'], contains: ['contains'], notContains: ['does not contain'], startsWith: ['starts with'],
  endsWith: ['ends with'], containsAny: ['has any of'], containsAll: ['has all of'], containsNone: ['has none of'],
  isEmpty: ['is empty'], isNotEmpty: ['is not empty']
};

/**
 * A group heading for the table's group rows, or anywhere else: its status dot, its name, and its
 * count ("16", "4 of 16").
 * @param {{label: string, tone?: string|null, count: string|number}} group
 * @returns {HTMLElement}
 */
function groupHeading({ label, tone = null, count }) {
  return h('span', { class: 'overview__group' },
    tone ? dot(tone) : null,
    h('span', { class: 'overview__group-label' }, label),
    h('span', { class: 'overview__count' }, String(count)));
}

/**
 * A board column's head: its status dot, its name, its count, and a total at the end. In a board
 * with lanes every lane repeats the columns, so the lane's name, read but not shown, tells the
 * column regions apart.
 * @param {{label: string, tone?: string|null, count: number, total?: string|null, lane?: string|null}} column
 * @returns {HTMLElement}
 */
function columnHeader({ label, tone = null, count, total = null, lane = null }) {
  return h('span', { class: 'overview__column-head' },
    tone ? dot(tone) : null,
    h('span', { class: 'overview__column-label' }, label),
    lane ? h('span', { class: 'visually-hidden' }, `, ${lane}`) : null,
    h('span', { class: 'overview__count' }, String(count)),
    total == null ? null : h('span', { class: 'overview__column-total' }, total));
}


/**
 * Builds the overview composition. See the module header for what it owns and what the layout
 * draws; the typedefs above document every option, the returned API, and the events.
 *
 * The parts below share one `core`: the options, the state, the components, and the functions
 * each part contributes, so that a part calls another's through it (`core.refresh()`).
 * @param {import('./kit.js').LayoutContext} context Layout context: preview, signal, cleanup.
 * @param {OverviewOptions} options
 * @returns {Overview}
 */
function createOverview(context, options) {
  context = layoutContext(context);
  const { fields, filterFields, groups: axes = {} } = options;
  const shapes = /** @type {OverviewShape[]} */ ((options.views?.length ? options.views : SHAPES).filter((shape) => SHAPES.includes(shape)));
  const axisIds = Object.keys(axes);
  const events = new EventTarget();
  const view = shapes.includes(/** @type {OverviewShape} */ (options.view)) ? /** @type {OverviewShape} */ (options.view) : shapes[0];
  /** @type {Record<string, any>} */
  const core = {
    context,
    options,
    keep: disposer(context),
    emit: (type, detail) => events.dispatchEvent(new CustomEvent(type, { detail })),
    fields,
    filterFields,
    axes,
    axisIds,
    shapes,
    sizes: { filters: options.drawers?.size ?? 400, view: options.drawers?.viewSize ?? 380 },
    recordId: options.recordId ?? 'ID',
    root: options.root ?? null,
    fieldById: new Map(fields.map((field) => [field.id, field])),
    filterFieldById: new Map(filterFields.map((field) => [field.id, field])),
    // Components drawn for one presentation, one chip editor, one value control, and View settings.
    scopes: {
      view: renderScope(context), editor: renderScope(context), value: renderScope(context), settings: renderScope(context)
    },
    /**
     * Everything that decides what the overview shows; `group` is `'none'` inside, as the board's
     * axis rule writes it, and null outside.
     */
    state: {
      view,
      query: '',
      sort: { ...(options.sort ?? { id: fields.find((field) => field.sortable)?.id ?? fields[0].id, dir: 'asc' }) },
      group: options.group && axes[options.group] ? options.group : 'none',
      board: {
        columnBy: options.board?.columnBy && axes[options.board.columnBy] ? options.board.columnBy : axisIds[0] ?? null,
        showEmptyColumns: options.board?.showEmptyColumns !== false
      },
      page: 1,
      pageSize: options.pageSize ?? 25,
      filtersOpen: false,
      filters: normalizeFilters(options.defaultFilters)
    },
    /** @type {Record<string, any>[]} Every record. */
    records: Array.isArray(options.records) ? options.records : [],
    /** @type {Record<string, any>[]} The filtered and sorted records, before paging. */
    filtered: [],
    /** @type {{field: string, operator: string, value: any}|null} A chip being added, not yet applied. */
    draft: null,
    /**
     * The open chip editor. `condition` is the model entry it edits — found again by identity when
     * it applies, since chips can be added or removed while it is open — or null for a new chip.
     * @type {{anchor: HTMLElement, dropdown: Dropdown, condition: Record<string, any>|null, committed: boolean}|null}
     */
    editing: null,
    /** @type {Map<string, string>} The heading of each card group on the current page. */
    groupTitles: new Map(),
    /** @type {Record<string, {fieldOrder: string[], hiddenFields: string[]}>} Per shape, across switches. */
    fieldStates: {},
    /** @type {any} The current presentation, and the shape it was built for. */
    view: null,
    viewShape: view,
    /** @type {{sheet: Sheet, editor: Filter}|null} The filter drawer, built when it first opens. */
    filterDrawer: null,
    /**
     * The View settings drawer, built when it first opens. `settings` is rebuilt when the board
     * comes or goes, since its Board section is there only for the board.
     * @type {{sheet: Sheet, host: HTMLElement, settings: ViewSettings|null, board: boolean}|null}
     */
    viewDrawer: null,
    /** @type {Map<Sheet, number>} Every drawer built so far, with its width; one is open at a time. */
    drawers: new Map(),
    /**
     * Where each open drawer was opened from, and the tool it belongs to: closing returns the focus
     * to the opener, or to the tool when the opener is gone.
     * @type {Map<Sheet, {opener: Element|null, tool: HTMLElement}>}
     */
    openers: new Map()
  };

  overviewReaders(core);
  overviewToolbar(core);
  overviewFilterStrip(core);
  overviewChipEditor(core);
  overviewDrawers(core);
  overviewViewSettings(core);
  overviewBody(core);
  const { state } = core;

  /** @returns {OverviewState} */
  function getState() {
    return {
      view: state.view,
      query: state.query,
      sort: { ...state.sort },
      group: state.group === 'none' ? null : state.group,
      board: { ...state.board },
      page: state.page,
      pageSize: state.pageSize,
      filters: structuredClone(state.filters)
    };
  }
  core.getState = getState;

  /**
   * Applies part of a state — a saved view, a preset: the search, sort, grouping, board, page
   * size, shape, and filter, each where given.
   * @param {Partial<OverviewState>} partial
   * @returns {void}
   */
  function setState(partial) {
    const next = partial ?? {};
    const previousGroup = state.group;
    if (typeof next.query === 'string') { state.query = next.query; core.toolbar.setSearch(next.query, { silent: true }); }
    if (next.sort) { state.sort = { ...next.sort }; core.sorter.setValue(state.sort, { silent: true }); }
    if (Object.hasOwn(next, 'group')) state.group = next.group && axes[next.group] ? next.group : 'none';
    if (next.board) {
      if (next.board.columnBy && axes[next.board.columnBy]) state.board.columnBy = next.board.columnBy;
      if (typeof next.board.showEmptyColumns === 'boolean') state.board.showEmptyColumns = next.board.showEmptyColumns;
    }
    if (next.pageSize) state.pageSize = next.pageSize;
    if (next.page) state.page = next.page;
    core.syncGroup();
    const shape = next.view && shapes.includes(next.view) && next.view !== state.view ? next.view : null;
    // The switch announces the new shape and rebuilds it; otherwise the grouping or the board may
    // still have changed under the current one.
    if (shape) core.toolbar.setView(shape);
    else if (Object.hasOwn(next, 'group') || next.board) core.mountView();
    if (state.group !== previousGroup) core.emit('groupchange', { group: state.group === 'none' ? null : state.group });
    if (next.filters) {
      state.filters = normalizeFilters(next.filters);
      core.draft = null;
      core.applyFilters({ reason: 'set' });
    } else core.refresh({ resetPage: Boolean(next.query !== undefined || next.sort) });
  }

  /** @type {Overview} */
  const api = {
    element: core.element,
    toolbar: core.toolbar,
    chips: core.filterBar,
    body: core.body,
    footer: core.footer,
    setData(list) {
      core.records = Array.isArray(list) ? list : [];
      core.refresh();
    },
    refresh: () => core.refresh(),
    getState,
    setState,
    setView(shape) {
      if (shapes.includes(shape)) core.toolbar.setView(shape);
    },
    setGroup: (field) => core.setGroup(field),
    setFilters(model) {
      state.filters = normalizeFilters(model);
      core.draft = null;
      core.applyFilters({ reason: 'set' });
    },
    openFilters: () => core.openFilterDrawer(),
    focusAddFilter: () => core.focusAddFilter(),
    openViewSettings: () => core.openViewDrawer(),
    closeDrawers: () => { core.closeDrawers(); },
    setBoardAxes: (change) => core.setBoardAxes(change),
    getView: () => core.view,
    getRecords: () => core.records,
    getFiltered: () => core.filtered,
    getSelection: () => core.getSelection(),
    clearSelection: () => core.view?.clearSelection(),
    on(type, listener) {
      const handler = /** @type {EventListener} */ (listener);
      events.addEventListener(type, handler, { signal: context.signal });
      return () => events.removeEventListener(type, handler);
    }
  };
  core.api = api;

  if (options.shortcuts && core.root) {
    shortcuts(core.root, {
      // F opens the drawer; Shift+F the strip's "Add filter" menu button.
      f: (event) => (event.shiftKey ? core.focusAddFilter() : core.openFilterDrawer()),
      v: () => core.openViewDrawer(),
      // The drawers are non-modal, so Escape also closes one from the list beside it.
      Escape: () => (core.closeDrawers() ? undefined : false),
      '/': () => core.toolbar.focusSearch(),
      ...Object.fromEntries(shapes.map((shape, index) => [String(index + 1), () => core.toolbar.setView(shape)]))
    }, context);
  }

  core.syncGroup();
  core.renderChips();
  core.mountView();
  return api;
}

/**
 * Reading the records and the filter: a field's value, what it sorts by, the text a record is
 * found by, and how a chip prints a condition.
 * @param {Record<string, any>} core
 * @returns {void}
 */
function overviewReaders(core) {
  const { options, filterFields, fieldById, filterFieldById } = core;

  /** @param {Record<string, any>} record @param {string} id @returns {any} A field's value. */
  core.valueOf = (record, id) => {
    const get = filterFieldById.get(id)?.get ?? fieldById.get(id)?.get;
    return get ? get(record) : record[id];
  };

  /** @param {Record<string, any>} record @param {string} id @returns {any} What a field sorts by. */
  core.sortValueOf = (record, id) => {
    const sortValue = fieldById.get(id)?.sortValue;
    return sortValue ? sortValue(record) : core.valueOf(record, id);
  };

  /** @param {string} id @returns {OverviewFilterField} */
  core.filterField = (id) => filterFieldById.get(id) ?? filterFields[0];

  /**
   * The text a record is found by: the layout's, or its filter fields' values, with a choice's
   * label for its value.
   * @param {Record<string, any>} record
   * @returns {string}
   */
  core.searchText = (record) => {
    if (options.search?.text) return options.search.text(record);
    return filterFields.flatMap((field) => {
      const value = core.valueOf(record, field.id);
      const values = Array.isArray(value) ? value : [value];
      return values.map((entry) => field.choices?.find((choice) => choice.value === entry)?.label ?? entry);
    }).filter((entry) => entry != null).join(' ');
  };

  /**
   * A value as a chip prints it: the field's own format, a choice's label, a grouped number, a
   * date, quoted text.
   * @param {OverviewFilterField} field
   * @param {unknown} value
   * @param {{short?: boolean}} [format]
   * @returns {string}
   */
  function formatValue(field, value, { short = false } = {}) {
    if (value == null || value === '') return '…';
    if (field.format) return field.format(value);
    if (field.choices) {
      const choice = field.choices.find((entry) => entry.value === value);
      return (short ? choice?.short : null) ?? choice?.label ?? String(value);
    }
    if (field.type === 'money' || field.type === 'number') return formatNumber(Number(value));
    if (field.type === 'date') return formatDate(new Date(`${String(value).slice(0, 10)}T12:00:00`), DATE.year);
    return `“${value}”`;
  }

  /**
   * @param {{field: string, operator: string, value: any}} condition
   * @returns {string} The value part of a chip: "Proposal", "50,000", "Nadine, Tobias".
   */
  core.describeValue = ({ field, operator, value }) => {
    const definition = core.filterField(field);
    const arity = arityOf(operator);
    if (arity === 'none') return '';
    if (arity === 'pair') return `${formatValue(definition, value?.[0])} – ${formatValue(definition, value?.[1])}`;
    if (arity === 'many') {
      const labels = (Array.isArray(value) ? value : []).map((entry) => formatValue(definition, entry, { short: true }));
      if (labels.length === 0) return '…';
      return labels.length > 2 ? `${labels.slice(0, 2).join(', ')} +${labels.length - 2}` : labels.join(', ');
    }
    return formatValue(definition, value);
  };

  /** @param {{field: string, operator: string, value: any}} condition @returns {string} "Stage is Proposal". */
  core.describeCondition = (condition) => {
    const [, words = OPERATOR_TEXT[condition.operator]?.[0] ?? condition.operator] = OPERATOR_TEXT[condition.operator] ?? [];
    return [core.filterField(condition.field).label, words, core.describeValue(condition)].filter(Boolean).join(' ');
  };
}

/**
 * The toolbar: search, Filter, Sort (its menu), View, the layout's extra tools, the shape switch,
 * and the live count.
 * @param {Record<string, any>} core
 * @returns {void}
 */
function overviewToolbar(core) {
  const { options, state, keep, fields } = core;
  const toolbar = keep(new ListToolbar(null, {
    label: options.label ?? 'Record controls',
    search: { placeholder: options.search?.placeholder ?? 'Search…', debounce: 150 },
    tools: [
      { id: 'filter', icon: 'filter', label: 'Filter' },
      { id: 'sort', icon: 'arrow-down-wide-short', label: 'Sort' },
      // "View", not "Fields": the drawer arranges the fields, groups the records, and lays out
      // the board — everything about how this view shows them.
      { id: 'view', icon: 'sliders', label: 'View' },
      ...(options.tools ?? [])
    ],
    views: core.shapes,
    view: state.view,
    countText: options.countText ?? ((count) => `${formatNumber(count)} ${count === 1 ? 'record' : 'records'}`),
    onsearch: ({ detail }) => { state.query = detail.value; core.refresh({ resetPage: true }); },
    onaction: ({ detail }) => {
      if (detail.id === 'filter') core.toggleFilterDrawer();
      else if (detail.id === 'view') core.toggleViewDrawer();
    },
    onviewchange: ({ detail }) => {
      state.view = detail.view;
      core.mountView();
      core.emit('viewchange', { view: detail.view, previous: detail.previous });
    }
  }));
  core.toolbar = toolbar;
  core.filterTool = /** @type {HTMLButtonElement} */ (toolbar.getTool('filter'));
  core.viewTool = /** @type {HTMLButtonElement} */ (toolbar.getTool('view'));
  // The two drawer tools are disclosures: they say they open a dialog, whether it is open, and,
  // once it exists, which one it is (see `syncDrawerState()`).
  for (const [tool, key] of /** @type {Array<[HTMLElement, string]>} */ ([[core.filterTool, 'F'], [core.viewTool, 'V']])) {
    tool.setAttribute('aria-keyshortcuts', key);
    tool.setAttribute('aria-haspopup', 'dialog');
    tool.setAttribute('aria-expanded', 'false');
  }
  if (options.search?.label) toolbar.toElement().querySelector('[role="search"]')?.setAttribute('aria-label', options.search.label);
  core.sorter = keep(new SortControl(null, {
    fields: fields.filter((field) => field.sortable).map(({ id, label }) => ({ id, label })),
    value: state.sort,
    onchange: ({ detail }) => { state.sort = detail.value; core.refresh({ resetPage: true }); core.syncViewSort(); }
  }));
  keep(new Dropdown(toolbar.getTool('sort'), {
    content: h('div', { class: 'overview__menu' }, core.sorter.toElement()), placement: 'bottom-end'
  }));

  /** Mirrors the grouping in the View tool's badge: the grouping's name, or none. @returns {void} */
  core.syncGroup = () => {
    toolbar.setBadge('view', core.axes[state.group]?.label ?? null);
  };
}

/**
 * The filter strip: Match all/any, the chips, "Add filter", and "Clear all"; and applying a
 * change of filter from anywhere.
 * @param {Record<string, any>} core
 * @returns {void}
 */
function overviewFilterStrip(core) {
  const { context, state, keep, filterFields } = core;
  const conjunction = h('div', { class: 'overview__match' },
    h('span', { class: 'overview__match-label' }, 'Match'),
    h('div', { class: 'segmented', role: 'radiogroup', ariaLabel: 'Match conditions', onkeydown: matchKeys },
      ['and', 'or'].map((logic) => h('button', {
        type: 'button', class: 'segmented__item', role: 'radio', dataset: { logic },
        onclick: () => setLogic(/** @type {'and'|'or'} */ (logic))
      }, logic === 'and' ? 'all' : 'any'))));
  const chipList = h('ul', { class: 'overview__chips', ariaLabel: 'Active filters' });
  const addMenu = keep(new MenuButton(null, {
    label: 'Add filter',
    icon: 'plus',
    kind: 'ghost',
    items: addItems(),
    onselect: ({ detail }) => {
      // The menu hands focus back to its button as it closes; the editor opens after that.
      if (detail.value === 'advanced') later(context, () => core.openFilterDrawer(), 0);
      else later(context, () => core.startDraft(String(detail.value)), 0);
    }
  }));
  const addButton = /** @type {HTMLButtonElement} */ (addMenu.getTrigger());
  addButton.classList.add('overview__add');
  addButton.setAttribute('aria-keyshortcuts', 'Shift+F');
  const clearButton = button({ label: 'Clear all', kind: 'ghost', size: 'sm', onclick: () => clearFilters() });
  clearButton.classList.add('overview__clear');
  const filterBar = h('div', { class: 'overview__filters', role: 'group', ariaLabel: 'Filters' },
    conjunction, chipList, addMenu.toElement(), clearButton);
  Object.assign(core, { chipList, filterBar });

  /** @returns {Record<string, any>[]} The add menu: every field, then the filter drawer. */
  function addItems() {
    if (state.filters.advanced) return [{ label: 'Edit advanced filter…', value: 'advanced', icon: 'sliders' }];
    return [
      ...filterFields.map((field) => ({ label: field.label, value: field.id, icon: field.icon })),
      '-',
      { label: 'Advanced…', value: 'advanced', icon: 'sliders' }
    ];
  }

  /** Draws the chips, the conjunction, and the strip's visibility from the model. @returns {void} */
  core.renderChips = () => {
    // The chips are about to change under an open editor: it closes rather than edit a stale chip.
    core.editing?.dropdown.close();
    const { conditions, advanced, logic } = state.filters;
    const active = advanced ? 1 : conditions.length;
    const chips = advanced
      ? [advancedChip(advanced)]
      : conditions.map((condition, index) => chip(condition, index));
    if (core.draft) chips.push(chip(core.draft, null));
    chipList.replaceChildren(...chips);
    conjunction.hidden = Boolean(advanced) || conditions.length + (core.draft ? 1 : 0) < 2;
    for (const radio of conjunction.querySelectorAll('[role="radio"]')) {
      const checked = radio.getAttribute('data-logic') === logic;
      radio.setAttribute('aria-checked', String(checked));
      radio.setAttribute('tabindex', checked ? '0' : '-1');
    }
    clearButton.hidden = active === 0;
    filterBar.hidden = active === 0 && !state.filtersOpen && !core.draft;
    // The badge counts conditions, nested ones included: "Advanced filter (3 conditions)" is 3.
    core.toolbar.setBadge('filter', (advanced ? conditionCount(advanced.root) : conditions.length) || null);
    core.syncDrawerState();
    addMenu.setItems(addItems());
  };

  /**
   * One condition as a chip: the field, the operator, and the value as one button that opens its
   * editor, and a remove button beside it.
   * @param {{field: string, operator: string, value: any}} condition
   * @param {number|null} index Its place in the model; null for the chip being added.
   * @returns {HTMLLIElement}
   */
  function chip(condition, index) {
    const field = core.filterField(condition.field);
    const [symbol, words = symbol] = OPERATOR_TEXT[condition.operator] ?? [condition.operator];
    const value = core.describeValue(condition);
    const main = h('button', {
      type: 'button', class: 'overview__chip-main', ariaHaspopup: 'dialog', ariaExpanded: 'false',
      dataset: { index: index === null ? 'draft' : String(index) },
      onclick: (event) => core.toggleEditor(/** @type {HTMLElement} */ (event.currentTarget), index)
    },
    icon(field.icon, { size: 13 }),
    h('span', { class: 'overview__chip-field' }, field.label),
    h('span', { class: 'overview__chip-operator' }, symbol === words ? words
      : [h('span', { ariaHidden: 'true' }, symbol), h('span', { class: 'visually-hidden' }, words)]),
    value ? h('span', { class: 'overview__chip-value' }, value) : null);
    return /** @type {HTMLLIElement} */ (h('li', { class: 'overview__chip', dataset: { draft: index === null ? 'true' : null } },
      main,
      index === null ? null : h('button', {
        type: 'button', class: 'overview__chip-remove', ariaLabel: `Remove filter: ${core.describeCondition(condition)}`,
        title: 'Remove filter', onclick: () => core.removeCondition(index)
      }, icon('xmark', { size: 12 }))));
  }

  /** @param {any} ast @returns {HTMLLIElement} The chip that stands for a nested expression. */
  function advancedChip(ast) {
    const count = conditionCount(ast.root);
    return /** @type {HTMLLIElement} */ (h('li', { class: 'overview__chip' },
      h('button', {
        type: 'button', class: 'overview__chip-main', ariaHaspopup: 'dialog', dataset: { advanced: 'true' },
        ariaExpanded: String(core.isDrawerOpen(core.filterDrawer)), onclick: () => core.toggleFilterDrawer()
      },
      icon('sliders', { size: 13 }),
      h('span', { class: 'overview__chip-field' }, 'Advanced filter'),
      h('span', { class: 'overview__chip-value' }, `${count} ${count === 1 ? 'condition' : 'conditions'}`)),
      h('button', {
        type: 'button', class: 'overview__chip-remove', ariaLabel: 'Remove the advanced filter', title: 'Remove filter',
        onclick: () => { state.filters.advanced = null; core.applyFilters({ reason: 'remove' }); core.focusAdd(); }
      }, icon('xmark', { size: 12 }))));
  }

  /** Shows the strip and puts the focus on "Add filter"; Shift+F. @returns {void} */
  core.focusAddFilter = () => {
    state.filtersOpen = true;
    core.renderChips();
    core.focusAdd();
  };

  /** @returns {void} */
  core.focusAdd = () => {
    if (!context.preview) addButton.focus();
  };

  /** @param {'and'|'or'} logic @returns {void} */
  function setLogic(logic) {
    state.filters.logic = logic;
    core.applyFilters({ reason: 'logic' });
    /** @type {HTMLElement|null} */ (conjunction.querySelector(`[data-logic="${logic}"]`))?.focus();
  }

  /** @param {KeyboardEvent} event @returns {void} The arrow keys move between all and any. */
  function matchKeys(event) {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    setLogic(state.filters.logic === 'and' ? 'or' : 'and');
  }

  /** @param {number} index @returns {void} Removes a chip; the focus moves to its neighbour. */
  core.removeCondition = (index) => {
    state.filters.conditions.splice(index, 1);
    // The strip stays open, so the focus has "Add filter" to go to when the last chip goes.
    state.filtersOpen = true;
    core.applyFilters({ reason: 'remove' });
    const next = chipList.querySelectorAll('.overview__chip-main')[Math.min(index, state.filters.conditions.length - 1)];
    if (next instanceof HTMLElement && !context.preview) next.focus();
    else core.focusAdd();
  };

  /**
   * Removes every condition and the search. From the strip, it stays open on "Add filter"; from
   * the drawer, the focus stays in the drawer, on its own "Add filter".
   * @param {{from?: 'bar'|'drawer'}} [clear]
   * @returns {void}
   */
  function clearFilters({ from = 'bar' } = {}) {
    state.filters.conditions = [];
    state.filters.advanced = null;
    state.filtersOpen = true;
    state.query = '';
    core.toolbar.setSearch('', { silent: true });
    core.applyFilters({ keepDrafts: false, reason: 'clear' });
    if (from === 'drawer') core.filterDrawer?.editor.focus();
    else core.focusAdd();
  }
  core.clearFilters = clearFilters;

  /**
   * Redraws the chips and re-reads the records from the first page. A change made anywhere but
   * the drawer is handed to the drawer too, while it is open, so it never shows a stale filter —
   * keeping the rows it holds unfinished, so a chip removed in the strip does not take a row the
   * reader is still writing with it. Clearing everything drops those too. The drawer's own
   * changes are not handed back, which would redraw it under the reader's cursor.
   * @param {{fromDrawer?: boolean, keepDrafts?: boolean, reason?: string}} [apply]
   * @returns {void}
   */
  core.applyFilters = ({ fromDrawer = false, keepDrafts = true, reason = 'set' } = {}) => {
    core.renderChips();
    core.refresh({ resetPage: true });
    const drawer = core.filterDrawer;
    if (!fromDrawer && drawer && core.isDrawerOpen(drawer)) {
      const committed = filtersToAst(state.filters);
      drawer.editor.setValue(keepDrafts ? mergeDrafts(committed, drawer.editor.getValue()) : committed, { silent: true });
    }
    core.emit('filterschange', { filters: structuredClone(state.filters), reason });
  };
}

/**
 * The chip editor: a small dialog anchored to a chip — the operator, a value control that suits
 * the field and the operator, and Apply and Remove (Cancel for a chip being added).
 * @param {Record<string, any>} core
 * @returns {void}
 */
function overviewChipEditor(core) {
  const { context, state, scopes } = core;

  /** @param {string} fieldId @returns {void} Adds a chip for a field and opens its editor. */
  core.startDraft = (fieldId) => {
    const field = core.filterField(fieldId);
    const operator = field.defaultOperator ?? field.operators[0];
    core.editing?.dropdown.close();
    core.draft = { field: field.id, operator, value: valueFor(operator) };
    state.filtersOpen = true;
    core.renderChips();
    const anchor = core.chipList.querySelector('[data-index="draft"]');
    if (anchor instanceof HTMLElement) openEditor(anchor, null);
  };

  /**
   * Opens a chip's editor, or closes it when it is already open on that chip.
   * @param {HTMLElement} anchor
   * @param {number|null} index
   * @returns {void}
   */
  core.toggleEditor = (anchor, index) => {
    if (core.editing?.anchor === anchor && core.editing.dropdown.isOpen()) core.editing.dropdown.close();
    else openEditor(anchor, index);
  };

  /**
   * @param {HTMLElement} anchor The chip's button.
   * @param {number|null} index The condition's place in the model; null for the chip being added.
   * @returns {void}
   */
  function openEditor(anchor, index) {
    if (context.preview) return;
    core.editing?.dropdown.close();
    scopes.editor.reset();
    scopes.value.reset();
    const source = index === null ? core.draft : state.filters.conditions[index];
    if (!source) return;
    const target = index === null ? null : source;
    const field = core.filterField(source.field);
    let operator = source.operator;
    let value = structuredClone(source.value);
    const valueHost = h('div', { class: 'overview__editor-value' });
    const error = h('p', { class: 'overview__editor-error', role: 'alert', hidden: true });
    const operatorSelect = scopes.editor.own(new Select(null, {
      label: `${field.label} condition`,
      items: field.operators.map((id) => ({ ID: id, name: OPERATOR_TEXT[id]?.[1] ?? OPERATOR_TEXT[id]?.[0] ?? id })),
      value: operator,
      onchange: ({ detail }) => {
        operator = String(detail.value ?? field.operators[0]);
        value = valueFor(operator, value);
        drawValue();
      }
    }));
    const submit = button({ label: 'Apply', kind: 'primary', size: 'sm' });
    submit.type = 'submit';
    const form = h('form', {
      class: 'overview__editor',
      onsubmit: (event) => { event.preventDefault(); commit(); },
      // Tabbing out of the editor closes it; a click outside already does.
      onfocusout: (event) => {
        const next = event.relatedTarget;
        if (next instanceof Node && !dropdown.getPanel().contains(next)) dropdown.close();
      }
    },
    h('p', { class: 'overview__editor-title' }, icon(field.icon, { size: 14 }), field.label),
    operatorSelect.toElement(),
    valueHost,
    error,
    h('div', { class: 'overview__editor-actions' },
      button({ label: index === null ? 'Cancel' : 'Remove', kind: 'ghost', size: 'sm', onclick: () => {
        dropdown.close();
        const at = target ? state.filters.conditions.indexOf(target) : -1;
        if (at >= 0) core.removeCondition(at);
      } }),
      h('span', { class: 'shell__spacer' }),
      submit));
    const dropdown = scopes.editor.own(new Dropdown(anchor, {
      content: form,
      openOn: 'manual',
      placement: 'bottom-start',
      onclose: () => afterEditorClose()
    }));
    const panel = dropdown.getPanel();
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', `Filter by ${field.label.toLowerCase()}`);
    core.editing = { anchor, dropdown, condition: target, committed: false };
    drawValue();
    dropdown.open();
    queueMicrotask(() => operatorSelect.focus());

    /** Replaces the value control with one for the current operator. @returns {void} */
    function drawValue() {
      scopes.value.reset();
      error.hidden = true;
      valueHost.replaceChildren(...valueControls(field, operator, value, (next) => { value = next; }));
    }

    /** Applies the condition when it is complete; says what is missing otherwise. @returns {void} */
    function commit() {
      const next = { field: field.id, operator, value: arityOf(operator) === 'none' ? null : value };
      if (!isComplete(next)) {
        error.textContent = arityOf(operator) === 'pair' ? 'Enter both values.' : 'Choose a value.';
        error.hidden = false;
        return;
      }
      if (core.editing) core.editing.committed = true;
      // The condition is found by identity: chips added or removed meanwhile do not shift it.
      const conditions = state.filters.conditions;
      let position = target ? conditions.indexOf(target) : -1;
      // It keeps the id the drawer knows it by, so an open drawer redraws the same row.
      if (position >= 0) conditions[position] = target?.id ? { id: target.id, ...next } : next;
      else position = conditions.push(next) - 1;
      if (index === null) core.draft = null;
      dropdown.close();
      core.applyFilters({ reason: 'chip' });
      const applied = core.chipList.querySelector(`[data-index="${position}"]`);
      if (applied instanceof HTMLElement) applied.focus();
    }
  }

  /** @param {{operator: string, value: unknown}} condition @returns {boolean} Whether it can be applied. */
  function isComplete({ operator, value }) {
    const arity = arityOf(operator);
    const present = (entry) => entry !== null && entry !== undefined && entry !== '';
    if (arity === 'none') return true;
    if (arity === 'many') return Array.isArray(value) && value.length > 0;
    if (arity === 'pair') return Array.isArray(value) && value.length === 2 && value.every(present);
    return present(value);
  }

  /** Drops an unapplied new chip when its editor closes, and keeps the focus in the strip. @returns {void} */
  function afterEditorClose() {
    const closing = core.editing;
    core.editing = null;
    if (!closing || closing.committed || closing.condition !== null) return;
    core.draft = null;
    core.renderChips();
    // Escape restores the focus to the anchor, which is gone; "Add filter" takes it instead.
    queueMicrotask(() => {
      const active = document.activeElement;
      if (!active || active === document.body || !active.isConnected || closing.dropdown.getPanel().contains(active)) core.focusAdd();
    });
  }

  /**
   * The controls that edit a condition's value: none, one, or a pair, each suited to the field —
   * a text field, a choice, a list of checkboxes, a number, or a date.
   * @param {OverviewFilterField} field
   * @param {string} operator
   * @param {any} value
   * @param {(next: any) => void} set
   * @returns {Node[]}
   */
  function valueControls(field, operator, value, set) {
    const arity = arityOf(operator);
    if (arity === 'none') return [h('p', { class: 'overview__editor-note' }, 'No value needed.')];
    if (arity === 'many') {
      const choices = field.choices ?? [];
      const checklist = scopes.value.own(new Checklist(null, {
        items: choices.map((choice) => ({ ID: choice.value, name: choice.label, on: value.includes(choice.value) })),
        search: choices.length > 8,
        height: 220,
        hideLabel: true,
        msg: { 'checklist.label': field.label },
        onchange: ({ detail }) => set([...detail.values])
      }));
      return [checklist.toElement()];
    }
    if (arity === 'pair') {
      const pair = Array.isArray(value) ? [...value] : [null, null];
      const end = (position) => single(field, pair[position], (next) => { pair[position] = next; set([...pair]); },
        position === 0 ? `${field.label} from` : `${field.label} to`);
      return [h('div', { class: 'overview__editor-pair' }, end(0), h('span', { class: 'meta' }, 'and'), end(1))];
    }
    return [single(field, value, set, `${field.label} value`)];
  }

  /**
   * One value control.
   * @param {OverviewFilterField} field
   * @param {any} value
   * @param {(next: any) => void} set
   * @param {string} label Accessible name.
   * @returns {Node}
   */
  function single(field, value, set, label) {
    if (field.choices) {
      return scopes.value.own(new Select(null, {
        label, placeholder: 'Choose…', items: field.choices.map((choice) => ({ ID: choice.value, name: choice.label })),
        value, onchange: ({ detail }) => set(detail.value ?? null)
      })).toElement();
    }
    if (field.type === 'money' || field.type === 'number') {
      const { unit, min, max, step, group } = field.input ?? {};
      return scopes.value.own(new NumberField(null, {
        label, value, min: min ?? null, max: max ?? null, step: step ?? 1, unit: unit ?? '', group: group ?? field.type === 'money',
        onchange: ({ detail }) => set(detail.value), oninput: ({ detail }) => set(detail.value)
      })).toElement();
    }
    return h('input', {
      type: field.type === 'date' ? 'date' : 'text', class: 'overview__editor-input', value: value ?? '',
      ariaLabel: label, placeholder: field.type === 'date' ? null : 'Type a value',
      oninput: (event) => set(/** @type {HTMLInputElement} */ (event.target).value || null)
    });
  }
}

/**
 * The drawers: the shared non-modal end Sheet, opening one with the focus on its first control,
 * the focus going back to the opener, the tools' disclosure state, and the Filters drawer.
 * @param {Record<string, any>} core
 * @returns {void}
 */
function overviewDrawers(core) {
  const { context, state, keep, drawers, openers } = core;

  /**
   * A drawer on the end edge that leaves the overview usable beside it: non-modal, so the list
   * keeps scrolling, selecting, and updating while it is open, and without light dismiss, so
   * working in the list does not close it. It has a title, the close button, and Dialog-style
   * footer buttons. Only one drawer is open at a time; the one opening closes the others.
   * @param {{title: string, content: Node, size: number,
   *   buttons: import('../../src/components/dialog/dialog.js').DialogButton[]}} drawer
   *   `size` is the width; a phone-width window gives the drawer all of it.
   * @returns {Sheet}
   */
  core.sideDrawer = ({ title, content, buttons, size }) => {
    const sheet = keep(new Sheet(null, {
      // On a phone the drawer takes the whole width (see the stylesheet), not all but a sliver.
      side: 'end', size: `var(--overview-drawer-narrow, ${size}px)`, modal: false, lightDismiss: false, closeButton: true,
      title, content, buttons, scope: core.root ?? core.element,
      onopen: () => core.syncDrawerState(),
      onclose: () => { core.syncDrawerState(); returnFocus(sheet); }
    }));
    sheet.el.classList.add('overview__drawer');
    sheet.el.id ||= uid('overview-drawer');
    // Non-modal, the page stays in the accessibility tree beside the drawer, and the dialog's
    // <header> would read as a second banner next to the page's own; it is only a title row.
    sheet.el.querySelector('.zx-dialog__header')?.setAttribute('role', 'none');
    drawers.set(sheet, size);
    return sheet;
  };

  /**
   * Opens a drawer built by `sideDrawer()`, closing any other, with the focus on its first
   * control. The element that had the focus is remembered as the opener.
   * @param {Sheet} sheet
   * @param {HTMLElement} tool The toolbar tool it belongs to, where the focus goes back to when
   *   the opener is gone.
   * @param {() => void} focusFirst Puts the focus on the control the drawer starts on.
   * @returns {void}
   */
  core.showDrawer = (sheet, tool, focusFirst) => {
    for (const other of drawers.keys()) if (other !== sheet && other.isOpen()) other.close();
    if (!sheet.isOpen()) {
      const active = document.activeElement;
      openers.set(sheet, { opener: active && active !== document.body ? active : null, tool });
      sheet.open();
    }
    // After the sheet's own initial focus, which lands on its first focusable — the close button.
    queueMicrotask(() => focusFirst());
  };

  /**
   * Puts the focus back after a drawer closed. Where the reader is outside the drawer — in the
   * list, or on the tool that closed it — the focus stays there. From inside the drawer it goes
   * to the opener: the tool, the advanced chip (found again: the chips are redrawn as filters
   * apply), "Add filter", or the list a shortcut was pressed in; when that is gone, to the tool.
   * Runs from the close event, before the sheet's own restore, so it reads where the focus was.
   * @param {Sheet} sheet
   * @returns {void}
   */
  function returnFocus(sheet) {
    const record = openers.get(sheet);
    openers.delete(sheet);
    if (!record || context.signal.aborted) return;
    const here = document.activeElement;
    const outside = here && here !== document.body && here.isConnected && !sheet.el.contains(here)
      && here !== record.opener;
    const advanced = record.opener instanceof HTMLElement && record.opener.dataset.advanced
      ? core.chipList.querySelector('[data-advanced]') : null;
    const target = outside ? here
      : record.opener?.isConnected ? record.opener : advanced ?? record.tool;
    // After the sheet's own restore, which would otherwise have the last word.
    queueMicrotask(() => {
      if (target instanceof HTMLElement && target.isConnected) target.focus({ preventScroll: true });
    });
  }

  /** @param {{sheet: Sheet}|null} drawer @returns {boolean} Whether it exists and is open. */
  core.isDrawerOpen = (drawer) => Boolean(drawer?.sheet.isOpen());

  /** Mirrors the open drawer on the tools that open it, the advanced chip, and the root. @returns {void} */
  core.syncDrawerState = () => {
    const open = core.isDrawerOpen(core.filterDrawer);
    const shown = [...drawers.keys()].find((sheet) => sheet.isOpen());
    // The room the layout makes for it, wide (see the module header).
    for (const host of [core.root, core.element].filter(Boolean)) {
      host.toggleAttribute('data-overview-drawer', Boolean(shown));
      if (shown) host.style.setProperty('--overview-drawer-size', `${drawers.get(shown)}px`);
    }
    for (const [tool, drawer] of /** @type {Array<[HTMLElement, {sheet: Sheet}|null]>} */ ([[core.filterTool, core.filterDrawer], [core.viewTool, core.viewDrawer]])) {
      tool.setAttribute('aria-expanded', String(core.isDrawerOpen(drawer)));
      if (drawer) tool.setAttribute('aria-controls', drawer.sheet.el.id);
    }
    const advanced = core.chipList.querySelector('[data-advanced]');
    advanced?.setAttribute('aria-expanded', String(open));
    if (advanced && core.filterDrawer) advanced.setAttribute('aria-controls', core.filterDrawer.sheet.el.id);
  };

  /** Closes whichever drawer is open. @returns {boolean} Whether one was. */
  core.closeDrawers = () => {
    const open = [...drawers.keys()].find((sheet) => sheet.isOpen());
    open?.close();
    return Boolean(open);
  };

  /**
   * The filter drawer: the `Filter` expression editor on the same model as the chips. It applies
   * live — every valid state of the expression filters the list as it is made, an unfinished row
   * waits without holding back the others — and a root group of plain conditions becomes chips.
   * @returns {{sheet: Sheet, editor: Filter}}
   */
  function ensureFilterDrawer() {
    if (core.filterDrawer) return core.filterDrawer;
    const editor = keep(new Filter(null, {
      // A new row starts on the operator a new chip starts on.
      fields: core.filterFields.map(({ id, label, type, icon: glyph, operators, defaultOperator, choices }) => ({
        id, label, type, icon: glyph, operators, defaultOperator: defaultOperator ?? operators[0], choices
      })),
      value: filtersToAst(state.filters),
      layout: 'compact',
      searchable: true,
      maxDepth: 2,
      autoApply: true,
      showApply: false,
      showRootActions: false,
      onapply: ({ detail }) => applyFromDrawer(detail.value),
      // An unfinished row makes the whole expression invalid, so no apply arrives; the rows
      // around it still filter, and the unfinished one waits in the drawer.
      onchange: ({ detail }) => { if (!detail.valid) applyFromDrawer(withoutDrafts(detail.value)); }
    }));

    /** @param {any} ast The drawer's expression, finished rows only. @returns {void} */
    function applyFromDrawer(ast) {
      const next = astToFilters(ast);
      // A field's change event repeats the value its input events already applied — on the
      // way out of the drawer, to a chip — and redrawing the chips then would move the chip
      // from under the pointer before the click lands.
      if (JSON.stringify(filtersToAst(next)) === JSON.stringify(filtersToAst(state.filters))) return;
      Object.assign(state.filters, next);
      core.draft = null;
      core.applyFilters({ fromDrawer: true, reason: 'drawer' });
    }
    const sheet = core.sideDrawer({
      title: 'Filters',
      size: core.sizes.filters,
      content: h('div', { class: 'overview__drawer-body' },
        h('p', { class: 'overview__drawer-hint' },
          'Changes apply as you make them. Use groups to mix “all” and “any”; a filter without groups shows as chips.'),
        editor.toElement()),
      buttons: [
        { label: 'Clear all', kind: 'ghost', action: () => core.clearFilters({ from: 'drawer' }) },
        { label: 'Done', kind: 'primary', action: 'close' }
      ]
    });
    core.filterDrawer = { sheet, editor };
    return core.filterDrawer;
  }

  /**
   * Opens the filter drawer on the current filter, the focus on its first control. F, the Filter
   * tool, the advanced chip, and "Advanced…" in the add menu.
   * @returns {void}
   */
  core.openFilterDrawer = () => {
    if (context.preview) return;
    const drawer = ensureFilterDrawer();
    if (!drawer.sheet.isOpen()) drawer.editor.setValue(filtersToAst(state.filters), { silent: true });
    core.showDrawer(drawer.sheet, core.filterTool, () => /** @type {HTMLElement|null} */ (drawer.editor.el.querySelector(
      'select:not([disabled]), input:not([disabled]), button:not([disabled])'))?.focus());
  };

  /** The Filter tool: opens the drawer, or closes it when it is open. @returns {void} */
  core.toggleFilterDrawer = () => {
    if (core.isDrawerOpen(core.filterDrawer)) core.filterDrawer?.sheet.close();
    else core.openFilterDrawer();
    core.syncDrawerState();
  };
}

/**
 * Grouping and the board, and the View settings drawer that sets them: the board's axis rule,
 * View settings built for the current shape and kept bound to the presentation.
 * @param {Record<string, any>} core
 * @returns {void}
 */
function overviewViewSettings(core) {
  const { context, state, axes, axisIds, scopes } = core;

  /**
   * Applies a change of grouping or columns made on the board, by the rule in
   * `resolveBoardAxes()`: the lanes are the grouping, and the axes swap rather than collide.
   * @param {{group?: string, columnBy?: string}} change
   * @returns {void}
   */
  core.applyBoardAxes = (change) => {
    if (!state.board.columnBy) return;
    const next = resolveBoardAxes({ columnBy: state.board.columnBy, group: state.group }, change, axisIds);
    state.board.columnBy = next.columnBy;
    state.group = next.group;
  };

  /**
   * The swim lanes the board shows: the grouping. The board keeps the two apart (see
   * `applyBoardAxes()`), so this only guards against a state that was never resolved.
   * @returns {string|null}
   */
  core.laneOf = () => (state.group !== 'none' && state.group !== state.board.columnBy ? state.group : null);

  /** @returns {{columnBy: string|null, swimlaneBy: string|null, showEmptyColumns: boolean}} The board as View settings shows it. */
  const boardSettings = () => ({ columnBy: state.board.columnBy, swimlaneBy: core.laneOf(), showEmptyColumns: state.board.showEmptyColumns });

  /**
   * Groups the records; on the board, by the axis rule — the lanes are the grouping.
   * @param {string|null} field
   * @returns {void}
   */
  core.setGroup = (field) => {
    const group = field && axes[field] ? field : 'none';
    if (state.view === 'board') core.applyBoardAxes({ group });
    else state.group = group;
    state.page = 1;
    core.syncGroup();
    core.mountView();
    core.emit('groupchange', { group: state.group === 'none' ? null : state.group });
  };

  /**
   * Changes the board's columns, lanes, or empty columns, by the axis rule.
   * @param {{group?: string|null, columnBy?: string, showEmptyColumns?: boolean}} change
   * @returns {void}
   */
  core.setBoardAxes = (change) => {
    const previous = state.group;
    if (typeof change.showEmptyColumns === 'boolean') state.board.showEmptyColumns = change.showEmptyColumns;
    if (change.columnBy && change.columnBy !== state.board.columnBy && axes[change.columnBy]) core.applyBoardAxes({ columnBy: change.columnBy });
    else if (Object.hasOwn(change, 'group') && (change.group ?? 'none') !== state.group) core.applyBoardAxes({ group: change.group ?? 'none' });
    core.syncGroup();
    core.mountView();
    if (state.group !== previous) core.emit('groupchange', { group: state.group === 'none' ? null : state.group });
  };

  /**
   * Builds the View settings for the current shape into the drawer: the fields with their types,
   * Group by, and — on the board only — the board's columns, swim lanes, and empty columns. Order
   * and visibility go straight to the bound view; grouping and the board are applied here, by
   * rebuilding the presentation.
   * @returns {ViewSettings}
   */
  function buildViewSettings() {
    const board = state.view === 'board' && axisIds.length > 0;
    scopes.settings.reset();
    // Outside the table the title field is drawn as the record's title, not as a field to show
    // or hide, so it stays out of the list there.
    const listed = core.fields.filter(({ id }) => state.view === 'table' || id !== core.options.titleField);
    return scopes.settings.own(new ViewSettings(null, {
      fields: listed.map(({ id, label, type, groupable, locked }) => ({
        id, label, type: type ?? 'text', ...(groupable === undefined ? {} : { groupable }), ...(locked ? { locked } : {})
      })),
      groupBy: state.group === 'none' ? null : state.group,
      grouping: axisIds.length ? { fields: axisIds } : false,
      board: board ? boardSettings() : false,
      sections: board ? ['fields', 'grouping', 'board'] : ['fields', 'grouping'],
      label: 'View settings',
      // On the board, swim lanes ARE the grouping, and columns never use the grouping's field:
      // `resolveBoardAxes()` (overview-filters.js) states the rule for every case.
      ongroupchange: ({ detail }) => core.setGroup(detail.field ?? null),
      onboardchange: ({ detail }) => {
        const { columnBy, swimlaneBy, showEmptyColumns } = detail.board;
        core.setBoardAxes({
          showEmptyColumns,
          ...(columnBy && columnBy !== state.board.columnBy ? { columnBy } : { group: swimlaneBy ?? null })
        });
      }
    }));
  }

  /**
   * Points View settings at the presentation just built: a new one when the board came or went,
   * the same one otherwise, given the grouping and board and bound to the new view.
   * @returns {void}
   */
  core.syncViewSettings = () => {
    const drawer = core.viewDrawer;
    if (!drawer || !core.view) return;
    const board = state.view === 'board';
    if (!drawer.settings || drawer.board !== board) {
      drawer.settings = buildViewSettings();
      drawer.board = board;
      drawer.host.replaceChildren(drawer.settings.toElement());
    } else {
      drawer.settings.setState({ groupBy: state.group === 'none' ? null : state.group,
        ...(board ? { board: boardSettings() } : {}) }, { silent: true });
    }
    drawer.settings.bind(core.view, board ? { board: boardSettings() } : {});
    // Search draws an unnamed search landmark; beside the toolbar's, each needs its own name.
    drawer.settings.el.querySelector('[role="search"]')?.setAttribute('aria-label', 'Fields');
  };

  /** @returns {{sheet: Sheet, host: HTMLElement, settings: ViewSettings|null, board: boolean}} */
  function ensureViewDrawer() {
    if (core.viewDrawer) return core.viewDrawer;
    const host = h('div', { class: 'overview__drawer-body' });
    const sheet = core.sideDrawer({
      title: 'View settings',
      content: host,
      size: core.sizes.view,
      buttons: [{ label: 'Done', kind: 'primary', action: 'close' }]
    });
    core.viewDrawer = { sheet, host, settings: null, board: false };
    core.syncViewSettings();
    return core.viewDrawer;
  }

  /** Opens View settings for the current shape; V and the View tool. @returns {void} */
  core.openViewDrawer = () => {
    if (context.preview) return;
    const drawer = ensureViewDrawer();
    core.showDrawer(drawer.sheet, core.viewTool, () => drawer.settings?.focus());
  };

  /** The View tool: opens View settings, or closes it when it is open. @returns {void} */
  core.toggleViewDrawer = () => {
    if (core.isDrawerOpen(core.viewDrawer)) core.viewDrawer?.sheet.close();
    else core.openViewDrawer();
    core.syncDrawerState();
  };
}

/**
 * The body and the pager, and the presentation in the body: building it for a shape, feeding it
 * the filtered, sorted, grouped page, moving cards on the board, and reading the selection.
 * @param {Record<string, any>} core
 * @returns {void}
 */
function overviewBody(core) {
  const { context, options, state, keep, fields, axes, scopes } = core;
  const body = h('div', { class: 'shell__body overview__body', tabindex: '-1' });
  const pager = keep(new Pagination(null, {
    pageSize: state.pageSize,
    pageSizes: options.pageSizes ?? [25, 50, 100],
    total: 0,
    onchange: ({ detail }) => {
      state.page = detail.page;
      state.pageSize = detail.pageSize;
      core.refresh();
      if (!context.preview) body.scrollTop = 0;
      core.emit('pagechange', { page: state.page, pageSize: state.pageSize });
    }
  }));
  const footer = h('div', { class: 'shell__footer overview__footer' }, pager.toElement());
  const element = h('div', { class: 'overview' },
    h('div', { class: 'overview__toolbar' }, core.toolbar.toElement()), core.filterBar, body, footer);
  Object.assign(core, { body, footer, element, pager });

  /** The fields as the views take them: the overview's own properties left out. */
  const viewFields = fields.map(({ type, groupable, locked, visible, get, ...rest }) => rest);

  /** @param {OverviewShape} shape @returns {string[]} The fields a shape shows at first. */
  const visibleFor = (shape) => (options.visibleBy ? options.visibleBy(shape) : options.visible?.[shape] ?? fields.map((field) => field.id));

  /** @returns {import('./overview-filters.js').OverviewGroup[]} The grouping's groups in order; none while ungrouped. */
  const groups = () => groupsOf(state.group === 'none' ? null : state.group, axes, core.valueOf);

  /** @param {Record<string, any>} record @returns {ReturnType<typeof groups>[number]|undefined} Its group. */
  const groupOf = (record) => groups().find((group) => group.match(record));

  /**
   * What `createView()` gets for one shape.
   * @param {OverviewShape} shape
   * @returns {OverviewViewContext}
   */
  function viewContext(shape) {
    const visible = visibleFor(shape);
    const hiddenFields = fields.map((field) => field.id).filter((id) => !visible.includes(id));
    const columnBy = state.board.columnBy;
    const lanes = core.laneOf();
    const bucketsOf = (axis) => axis.buckets.map(({ id, label }) => ({ id, label }));
    return {
      shape,
      options: {
        fields: viewFields, data: [], recordId: core.recordId, sort: state.sort, sortMode: 'server', hiddenFields,
        fieldControls: false,
        emptyText: () => emptyState({
          icon: 'filter', size: 'sm', title: options.empty?.title ?? 'No records match',
          description: options.empty?.description ?? 'Change the search or the filters to see more.',
          actions: [{ label: 'Clear filters', onclick: () => core.clearFilters() }]
        }),
        onsortchange: ({ detail }) => {
          if (!detail.id) return;
          state.sort = { id: detail.id, dir: detail.dir ?? 'asc' };
          core.sorter.setValue(state.sort, { silent: true });
          core.refresh({ resetPage: true });
        },
        onselectionchange: () => core.emit('selectionchange', { ids: getSelection() }),
        onrecordclick: ({ detail }) => {
          if (detail.record && detail.record.kind !== 'group') core.emit('recordclick', { record: detail.record });
        }
      },
      table: {
        rowKind: 'kind',
        rowKinds: { group: { span: true, class: 'overview__group-row', render: (row) => groupHeading(row) } }
      },
      // The records arrive sorted by group, so the groups follow in that order and only the groups
      // on the page appear. Each heading says how many of the group's records the page holds.
      groupBy: state.group === 'none' ? null : (record) => core.groupTitles.get(groupOf(record)?.id) ?? '',
      board: shape === 'board' && columnBy ? {
        columnBy,
        swimlaneBy: lanes,
        showEmptyColumns: state.board.showEmptyColumns,
        columnAxis: axes[columnBy],
        laneAxis: lanes ? axes[lanes] : null,
        options: {
          columnBy,
          columns: bucketsOf(axes[columnBy]),
          swimlaneBy: lanes,
          swimlanes: lanes ? bucketsOf(axes[lanes]) : null,
          showEmptyColumns: state.board.showEmptyColumns,
          moveMode: 'external',
          onrecordmove: ({ detail }) => moveRecords(detail, columnBy, lanes)
        }
      } : null,
      records: () => core.filtered,
      state: core.getState(),
      api: core.api
    };
  }

  /**
   * A card moved on the board: its column's field, and its lane's when there are lanes, take the
   * place it was dropped in.
   * @param {{ids: string[], to: {column: string, lane?: string|null}}} detail
   * @param {string} columnBy
   * @param {string|null} lanes
   * @returns {void}
   */
  function moveRecords(detail, columnBy, lanes) {
    for (const id of detail.ids) {
      const record = core.records.find((entry) => String(entry[core.recordId]) === String(id));
      if (!record) continue;
      record[columnBy] = detail.to.column;
      if (detail.to.lane && lanes) record[lanes] = detail.to.lane;
    }
    core.refresh();
    core.emit('recordmove', { ids: [...detail.ids], to: { ...detail.to } });
  }

  /**
   * Builds the presentation the switch shows and feeds it the current slice. Field order and
   * visibility are kept per shape, so switching back finds them as they were left.
   * @returns {void}
   */
  core.mountView = () => {
    const previous = core.view;
    if (previous) core.fieldStates[core.viewShape] = { fieldOrder: previous.getFieldOrder(), hiddenFields: previous.getHiddenFields() };
    core.editing?.dropdown.close();
    // View settings lets go of the view before it is destroyed, and takes the new one below.
    core.viewDrawer?.settings?.unbind();
    scopes.view.reset();
    // Entering the board with the grouping on the column field resolves like choosing it there.
    if (state.view === 'board') core.applyBoardAxes({});
    core.syncGroup();
    core.viewShape = state.view;
    core.view = scopes.view.own(options.createView(state.view, viewContext(state.view)));
    const kept = core.fieldStates[state.view];
    if (kept) core.view.setViewState({ fieldOrder: kept.fieldOrder, hiddenFields: kept.hiddenFields }, { silent: true });
    body.dataset.shape = state.view;
    body.replaceChildren(core.view.toElement());
    footer.hidden = state.view === 'board';
    core.refresh();
    core.syncViewSettings();
  };

  /**
   * Re-reads the records: filter, search, sort, then the page the pager points at. The board gets
   * every match; the table gets a heading row before each group.
   * @param {{resetPage?: boolean}} [read]
   * @returns {void}
   */
  core.refresh = ({ resetPage = false } = {}) => {
    const needle = state.query.trim().toLowerCase();
    const expression = filterExpression(state.filters);
    const match = { read: core.valueOf, type: (id) => core.filterFieldById.get(id)?.type };
    const grouped = groups();
    const found = core.records.filter((record) => nodeMatches(record, expression, match)
      && (!needle || core.searchText(record).toLowerCase().includes(needle)));
    // The board groups by its own columns.
    core.filtered = sortRecords(found, state.sort, { groups: state.view === 'board' ? [] : grouped, value: core.sortValueOf });
    if (resetPage) state.page = 1;
    core.toolbar.setCount(core.filtered.length);
    pager.setState({ total: core.filtered.length, pageSize: state.pageSize, page: state.page }, { silent: true });
    const { page, offset } = pager.getState();
    state.page = page;
    const slice = state.view === 'board' ? core.filtered : core.filtered.slice(offset, offset + state.pageSize);
    if (!core.view) return;
    core.groupTitles = new Map(grouped.map((group) => [group.id, `${group.label} · ${groupCount(group, slice, core.filtered)}`]));
    // Before the view draws the page: a layout drops the components its renderers made for the last.
    core.emit('render', { records: slice });
    core.view.setData(state.view === 'table' ? withGroupRows(slice, grouped, core.filtered) : slice);
    core.syncViewSort();
    core.emit('selectionchange', { ids: getSelection() });
  };

  /** Points the table header's sort indicator at the current sort. @returns {void} */
  core.syncViewSort = () => {
    // A grouped table has no header sort (its headings would scatter); the Sort menu still sorts.
    const grouped = state.view === 'table' && state.group !== 'none';
    if (core.view && !grouped && state.view !== 'board') core.view.setSort(state.sort.id, state.sort.dir, { silent: true });
  };

  /** @returns {string[]} The selected records' ids, group headings left out. */
  function getSelection() {
    if (!core.view || state.view === 'board') return [];
    return core.view.getSelectionIds().map(String).filter((id) => !id.startsWith('group:'));
  }
  core.getSelection = getSelection;
}

/**
 * A filter model with every part present, copied.
 * @param {Partial<OverviewFilters>|null|undefined} model
 * @returns {OverviewFilters}
 */
function normalizeFilters(model) {
  return {
    logic: model?.logic === 'or' ? 'or' : 'and',
    conditions: structuredClone(model?.conditions ?? []),
    advanced: model?.advanced ? structuredClone(model.advanced) : null
  };
}

export { OPERATOR_TEXT, SHAPES, columnHeader, createOverview, groupHeading };
