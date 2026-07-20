/**
 * Pure option and event translations shared by the gx compatibility wrappers.
 * Keeping these helpers DOM-free makes the migration contract directly testable in Node.
 * @module gx-compat-options
 */

/** @type {Readonly<Record<string, string>>} */
export const SELECT_OPTION_MAP = Object.freeze({
  data: 'items',
  elementIndex: 'valueKey',
  elementLabel: 'labelKey',
  elementSelect: 'renderValue',
  allowEmpty: 'clearable',
  resetable: 'clearable',
  searchfields: 'searchKeys',
  height: 'listHeight'
});

/** @type {Readonly<Record<string, string>>} */
export const CHECKLIST_OPTION_MAP = Object.freeze({
  data: 'items',
  listValue: 'valueKey',
  listFormat: 'labelKey',
  listActive: 'checkedKey',
  defaultState: 'defaultChecked'
});

/** @type {Readonly<Record<string, string>>} */
export const TABLE_OPTION_MAP = Object.freeze({
  cols: 'columns'
});

/** @type {Readonly<Record<string, string>>} */
export const FORM_OPTION_MAP = Object.freeze({
  horizontal: 'layout',
  default: 'value'
});

/** @type {Readonly<Record<string, string>>} */
export const FIELD_TYPE_MAP = Object.freeze({
  string: 'text',
  integer: 'int',
  gxselect: 'zxselect',
  date: 'date',
  month: 'month',
  time: 'time',
  optionlist: 'optionlist',
  html: 'html',
  multivalueeditor: 'multivalueeditor',
  checklist: 'checklist'
});

/**
 * Renames known keys while retaining unrelated options.
 * @param {Record<string, any>|null|undefined} source Legacy options.
 * @param {Readonly<Record<string, string>>} mapping Rename table.
 * @returns {Record<string, any>} Translated copy.
 */
export function renameOptions(source, mapping) {
  const translated = {};
  if (!source || typeof source !== 'object') return translated;
  for (const [key, value] of Object.entries(source)) {
    if (/^on[A-Z]/.test(key)) continue;
    translated[mapping[key] ?? key] = value;
  }
  return translated;
}

/**
 * Converts legacy Select options to their Zx equivalents.
 * @param {Record<string, any>} [options={}] Legacy Select options.
 * @returns {Record<string, any>} Zx Select options.
 */
export function translateSelectOptions(options = {}) {
  const translated = renameOptions(options, SELECT_OPTION_MAP);
  if (Object.hasOwn(options, 'data')) translated.items = Array.isArray(options.data) ? options.data.slice() : [];
  if (Object.hasOwn(options, 'allowEmpty') || Object.hasOwn(options, 'resetable')) {
    translated.clearable = Boolean(options.allowEmpty || options.resetable);
  }
  if (options.msg && typeof options.msg === 'object' && options.msg.noSelection != null) {
    translated.placeholder = String(options.msg.noSelection);
  }
  if (Object.hasOwn(options, 'height')) translated.listHeight = numericSize(options.height, 280);
  delete translated.elementDefault;
  delete translated.parseDefault;
  delete translated.queryParam;
  delete translated.requestData;
  delete translated.requestHeader;
  delete translated.url;
  delete translated.method;
  delete translated.entity;
  delete translated.limit;
  return translated;
}

/**
 * Converts legacy Checklist options to Zx Checklist options.
 * @param {Record<string, any>} [options={}] Legacy Checklist options.
 * @returns {Record<string, any>} Zx Checklist options.
 */
export function translateChecklistOptions(options = {}) {
  const translated = renameOptions(options, CHECKLIST_OPTION_MAP);
  if (typeof options.getItemValue === 'function') translated.valueKey = options.getItemValue;
  if (Object.hasOwn(options, 'height')) translated.height = numericSize(options.height, 280);
  delete translated.url;
  delete translated.method;
  delete translated.requestData;
  delete translated.decodeResponse;
  delete translated.width;
  delete translated.onClick;
  return translated;
}

/**
 * Converts the legacy Datebox token array to the kernel format string.
 * Existing percent-token format strings pass through unchanged.
 * @param {unknown} format Legacy array or format string.
 * @returns {string} Kernel date format.
 */
export function translateDateboxFormat(format) {
  if (typeof format === 'string') return format.replaceAll('&nbsp;', ' ');
  const parts = Array.isArray(format) ? format : ['d', '.', 'M', '.', 'y'];
  const tokens = {
    d: '%d', m: '%m', M: '%m', y: '%Y', h: '%H', i: '%M', s: '%S'
  };
  return parts.map((part) => tokens[part] ?? String(part).replaceAll('&nbsp;', ' ')).join('');
}

/**
 * Resolves the legacy one-based `show` option to a tab name.
 * @param {Array<{name?: unknown}>} frames Legacy frame list.
 * @param {unknown} show Name or one-based numeric index.
 * @returns {string|null} Resolved name.
 */
export function resolveTabName(frames, show) {
  if (typeof show === 'string') return show;
  if (typeof show !== 'number' || !Number.isFinite(show)) return null;
  const frame = frames[Math.trunc(show) - 1];
  return frame?.name == null ? null : String(frame.name);
}

/**
 * Converts legacy Tabbox options without normalizing DOM content.
 * @param {Record<string, any>} [options={}] Legacy Tabbox options.
 * @returns {{tabs: Array<Record<string, any>>, active: string|null, height: unknown}}
 */
export function translateTabboxOptions(options = {}) {
  const frames = Array.isArray(options.frames) ? options.frames : [];
  return {
    tabs: frames.map((frame) => ({
      name: String(frame.name ?? ''),
      title: String(frame.title ?? ''),
      content: frame.content,
      closable: Boolean(frame.closable),
      disabled: Boolean(frame.disabled)
    })),
    active: resolveTabName(frames, options.show ?? 1),
    height: options.height ?? null
  };
}

/**
 * Converts a legacy table column list and its initial filter state.
 * A cell adapter can turn legacy cell objects into DOM nodes in browser wrappers.
 * @param {Record<string, any>} [options={}] Legacy Table options.
 * @param {(cell: unknown) => unknown} [adaptCell=defaultCellAdapter] Cell adapter.
 * @returns {Record<string, any>} Zx Table options.
 */
export function translateTableOptions(options = {}, adaptCell = defaultCellAdapter) {
  const cols = Array.isArray(options.cols) ? options.cols : [];
  const structure = typeof options.structure === 'function' ? options.structure : (row) => cols.map((col) => row?.[col.id]);
  const cache = new WeakMap();
  const getCells = (row, index) => {
    if (row && typeof row === 'object') {
      const cached = cache.get(row);
      if (cached?.index === index) return cached.cells;
    }
    const result = structure(row, index);
    const cells = Array.isArray(result) ? result : (Array.isArray(result?.row) ? result.row : []);
    if (row && typeof row === 'object') cache.set(row, { index, cells });
    return cells;
  };
  const columns = cols.map((column, columnIndex) => ({
    id: String(column.id ?? columnIndex),
    label: String(column.label ?? ''),
    width: column.width ?? 'auto',
    align: normalizeAlignment(column.align ?? column['text-align']),
    sortable: column.filter != null || column.filterable !== false,
    render: (row, rowIndex) => adaptCell(getCells(row, rowIndex)[columnIndex])
  }));
  const sorted = cols.find((column) => column.filter != null);
  return {
    columns,
    data: Array.isArray(options.data) ? options.data.slice() : [],
    sort: sorted ? { id: String(sorted.id), dir: sortDirection(sorted.mode ?? sorted.filter) } : null,
    sortMode: 'server',
    selectable: options.selectable === true ? 'single' : (['single', 'multi'].includes(options.selectable) ? options.selectable : false),
    height: options.height ?? null,
    stickyHeader: options.scroll !== false,
    rowId: typeof options.rowId === 'function' || typeof options.rowId === 'string' ? options.rowId : legacyRowId
  };
}

/**
 * Converts a legacy field descriptor to Zx Field options.
 * Component-specific `props` are completed by the browser wrapper.
 * @param {Record<string, any>} [options={}] Legacy field descriptor.
 * @returns {Record<string, any>} Zx Field options.
 */
export function translateFieldOptions(options = {}) {
  const type = FIELD_TYPE_MAP[String(options.type ?? 'text').toLowerCase()] ?? String(options.type ?? 'text').toLowerCase();
  const translated = {
    id: options.id ?? null,
    type,
    label: options.label ?? '',
    description: options.description ?? '',
    value: Object.hasOwn(options, 'value') ? options.value : options.default,
    placeholder: options.placeholder ?? '',
    required: Boolean(options.required),
    disabled: Boolean(options.disabled),
    options: options.options ?? null,
    layout: options.horizontal === false ? 'stack' : (options.horizontal ? 'inline' : 'stack'),
    props: {}
  };
  if (type === 'html') translated.value = options.content ?? translated.value;
  return translated;
}

/**
 * Positional legacy event arguments for the mappings exercised by wrappers.
 * @type {Readonly<Record<string, (detail: Record<string, any>, wrapper: unknown, event?: Event) => unknown[]>>}
 */
export const LEGACY_EVENT_ARGS = Object.freeze({
  select: (detail, wrapper) => [detail.item ?? null, wrapper],
  noselect: (_detail, wrapper) => [null, wrapper],
  tableClick: (detail) => [detail.row, detail.event?.target?.closest?.('tr') ?? null, detail.event],
  tableFilter: (detail, wrapper) => [wrapper?._legacyColumn?.(detail.id) ?? { id: detail.id }, detail.dir],
  tabChange: (detail) => [detail.name]
});

/** @param {unknown} value @param {number} fallback @returns {number} */
function numericSize(value, fallback) {
  const number = typeof value === 'string' ? Number.parseFloat(value) : Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : fallback;
}

/** @param {unknown} align @returns {'start'|'center'|'end'|'left'|'right'} */
function normalizeAlignment(align) {
  const value = String(align ?? 'start');
  return ['center', 'end', 'left', 'right'].includes(value) ? value : 'start';
}

/** @param {unknown} direction @returns {'asc'|'desc'} */
function sortDirection(direction) {
  return direction === 'desc' ? 'desc' : 'asc';
}

/** @param {unknown} cell @returns {unknown} */
function defaultCellAdapter(cell) {
  if (cell && typeof cell === 'object' && !Array.isArray(cell) && Object.hasOwn(cell, 'label')) return cell.label;
  return cell;
}

/** @param {Record<string, any>} row @returns {unknown} */
function legacyRowId(row) {
  return row?.ID ?? row?.id ?? row;
}
