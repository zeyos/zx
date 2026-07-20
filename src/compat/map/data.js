import {
  Checklist as ZxChecklist,
  DataFilter as ZxDataFilter,
  Http,
  Permission as ZxPermission,
  Table as ZxTable
} from '../../index.js';
import { GxWrapper } from '../base.js';
import { LEGACY_EVENT_ARGS, translateChecklistOptions, translateTableOptions } from './options.js';

/** Shared Checklist wrapper. */
class ChecklistBase extends GxWrapper {
  static legacyName = 'gx.zeyos.Checklist';

  /** @param {Element|string|null} display @param {Record<string, any>} [options={}] */
  constructor(display, options = {}) {
    super(options, { data: [], listValue: 'ID', listFormat: 'name', listActive: 'on' });
    const translated = translateChecklistOptions(options);
    translated.items = Array.isArray(options.data) ? options.data : (Array.isArray(options.items) ? options.items : []);
    translated.load = options.url ? () => this._load(options.url, options.requestData) : null;
    const component = new ZxChecklist(display, translated);
    this._http = null;
    this._attach(component, {
      events: {
        complete: { type: 'loaded', args: (detail) => [detail.items] },
        change: { type: 'change', args: (detail) => [detail.values] }
      },
      ui: { frame: 'root', table: 'list', tbody: 'list', search: 'search' },
      setters: { data: 'setData' }
    });
  }

  /** @returns {unknown[]} */
  getValues(key) {
    const values = this._zx.getValues();
    return key == null ? values : values.map((value) => value?.[key]).filter((value) => value != null);
  }
  /** @param {unknown[]} values @returns {unknown[]} */
  setValues(values) { this._zx.setValues(values ?? []); return values; }
  /** @returns {this} */
  reset() { this._zx.uncheckAll(); return this; }
  /** @param {string} query @returns {this} */
  search(query) { this._zx.search(query); return this; }
  /** @param {unknown[]} rows @returns {this} */
  setData(rows) { this._zx.setItems(Array.isArray(rows) ? rows : []); return this; }
  /** @param {string} [url] @param {Record<string, unknown>} [data] @returns {Promise<this>} */
  async load(url = this.options.url, data = this.options.requestData) {
    const rows = await this._load(url, data);
    this._zx.setItems(rows);
    this.fireEvent('complete', [rows]);
    return this;
  }
  /** Bootstrap alias. @param {string} [url] @param {Record<string, unknown>} [data] @param {Function} [callback] @returns {Promise<this>} */
  async loadFromURL(url, data, callback) { const result = await this.load(url, data); callback?.(this); return result; }

  /** @param {string} url @param {Record<string, unknown>} data @returns {Promise<unknown[]>} */
  async _load(url, data) {
    this._http ??= new Http({ headers: this.options.requestHeader ?? {} });
    try {
      const method = String(this.options.method ?? 'GET').toUpperCase();
      let result = await this._http.request(String(url ?? ''), method === 'GET'
        ? { method, query: data ?? {} }
        : { method, data: data ?? {} });
      if (typeof this.options.decodeResponse === 'function') result = this.options.decodeResponse(result);
      return Array.isArray(result) ? result : [];
    } catch (error) {
      this.fireEvent('failure', [error]);
      throw error;
    }
  }
}

/** Legacy ZeyOS checklist. */
export class Checklist extends ChecklistBase { static legacyName = 'gx.zeyos.Checklist'; }
/** Legacy bootstrap checklist. */
export class BootstrapChecklist extends ChecklistBase { static legacyName = 'gx.bootstrap.Checklist'; }

/** Legacy permission selector. */
export class Permission extends GxWrapper {
  static legacyName = 'gx.zeyos.Permission';

  /** @param {Element|string|null} display @param {Record<string, any>} [options={}] */
  constructor(display, options = {}) {
    super(options, { value: true, groups: [] });
    const component = new ZxPermission(display, {
      value: options.value ?? true,
      groups: options.groups ?? options.data ?? [],
      groupsValueKey: options.groupsValueKey ?? options.elementIndex ?? 'ID',
      groupsLabelKey: options.groupsLabelKey ?? options.elementLabel ?? 'name'
    });
    this._attach(component, { events: { change: { type: 'change', args: (detail) => [detail.value] } }, setters: { value: 'set' } });
  }
  /** @returns {unknown} */ get() { return this._zx.get(); }
  /** @param {unknown} value @param {boolean} [silent=false] @returns {this} */ set(value, silent = false) { this._zx.set(value, { silent }); return this; }
}

/** Shared full Table wrapper. */
class TableBase extends GxWrapper {
  static legacyName = 'gx.zeyos.Table';

  /** @param {Element|string|null} display @param {Record<string, any>} [options={}] */
  constructor(display, options = {}) {
    super(options, { cols: [], data: [] });
    const source = { ...options };
    if (typeof options.structure === 'function') source.structure = (row, index) => options.structure(row, index, this);
    const translated = translateTableOptions(source, adaptCell);
    const component = new ZxTable(display, translated);
    this._cols = Array.isArray(options.cols) ? options.cols.map((column) => ({ ...column })) : [];
    this._filter = translated.sort ? this._legacyColumn(translated.sort.id) : null;
    if (this._filter) this._filter.mode = translated.sort.dir;
    this._attach(component, {
      events: {
        click: { type: 'rowclick', args: (detail) => LEGACY_EVENT_ARGS.tableClick(detail) },
        dblclick: { type: 'rowdblclick', args: (detail) => LEGACY_EVENT_ARGS.tableClick(detail) },
        filter: { type: 'sort', args: (detail) => {
          const column = this._legacyColumn(detail.id); column.mode = detail.dir; this._filter = column;
          return [column, detail.dir];
        } },
        complete: { type: 'datachange', args: (detail) => [detail.rows] }
      },
      ui: { table: () => component._table, tbody: () => component._tbody, thead: () => component._thead, tableDiv: () => component._scroll },
      setters: { data: 'setData', height: 'setHeight' }
    });
  }

  /** @param {unknown[]} data @returns {this} */ setData(data) { this._zx.setData(Array.isArray(data) ? data : []); return this; }
  /** @param {unknown[]|unknown} data @returns {this} */ addData(data) { this._zx.addData(Array.isArray(data) ? data : [data]); return this; }
  /** @returns {this} */ empty() { this._zx.empty(); return this; }
  /** @param {Record<string, any>|string} column @param {'asc'|'desc'} [mode] @param {boolean} [noEvent=false] @returns {this} */
  setSort(column, mode, noEvent = false) {
    const id = typeof column === 'object' ? String(column.id) : String(column);
    this._zx.setSort(id, mode, { silent: Boolean(noEvent) });
    this._filter = this._legacyColumn(id); this._filter.mode = this._zx._sort?.dir ?? mode ?? 'asc';
    return this;
  }
  /** @returns {Record<string, any>|false} */ getFilter() { return this._filter ?? false; }
  /** @returns {unknown[]} */ getData() { return this._zx.getData(); }
  /** @param {unknown} height @returns {this} */ setHeight(height) { const value = typeof height === 'number' ? `${height}px` : String(height); this._zx._scroll.style.blockSize = value; return this; }
  /** @param {string} id @returns {Record<string, any>} */ _legacyColumn(id) { return this._cols.find((column) => String(column.id) === String(id)) ?? { id }; }
}

/** Legacy ZeyOS table. */
export class Table extends TableBase { static legacyName = 'gx.zeyos.Table'; }
/** Legacy bootstrap table. */
export class BootstrapTable extends TableBase { static legacyName = 'gx.bootstrap.Table'; }

/** Legacy SimpleTable data facade. */
export class SimpleTable extends GxWrapper {
  static legacyName = 'gx.ui.SimpleTable';

  /** @param {Element|string|Record<string, any>|null} display @param {Record<string, any>} [options={}] */
  constructor(display, options = {}) {
    if (display && typeof display === 'object' && !display.nodeType && !Array.isArray(display)) {
      options = display; display = null;
    }
    super(options, { cols: [], data: [] });
    const source = { ...options, rowId: (row) => row };
    if (typeof options.structure === 'function') source.structure = (row, index) => options.structure(row, index, this);
    const component = new ZxTable(/** @type {Element|string|null} */ (display), translateTableOptions(source, adaptCell));
    this._attach(component, {
      events: { click: { type: 'rowclick', args: (detail) => [detail.row, detail.index] } },
      ui: { table: () => component._table, tbody: () => component._tbody, thead: () => component._thead }
    });
  }

  /** @param {unknown[]} data @returns {this} */ setData(data) { this._zx.setData(Array.isArray(data) ? data : []); return this; }
  /** @param {unknown[]} data @returns {this} */ addData(data) { this._zx.addData(Array.isArray(data) ? data : [data]); return this; }
  /** @param {unknown} row @param {number} [index] @returns {HTMLTableRowElement|null} */
  createRow(row, index = this._zx.getData().length) {
    const data = this._zx.getData(); data.splice(Math.max(0, index), 0, row); this._zx.setData(data);
    return this.display('tbody')?.querySelectorAll?.('tr[data-row]')?.[index] ?? null;
  }
  /** @param {unknown} row @param {number} [index] @returns {HTMLTableRowElement|null} */ addRow(row, index) { return this.createRow(row, index); }
  /** @param {unknown} row @param {number} index @returns {HTMLTableRowElement|null} */
  updateRow(row, index) { const data = this._zx.getData(); if (index >= 0 && index < data.length) data[index] = row; this._zx.setData(data); return this.display('tbody')?.querySelectorAll?.('tr[data-row]')?.[index] ?? null; }
  /** @param {number} index @returns {this} */ removeRow(index) { const data = this._zx.getData(); data.splice(index, 1); this._zx.setData(data); return this; }
  /** @returns {unknown[]} */ getRows() { return this._zx.getData(); }
  /** @returns {this} */ empty() { this._zx.empty(); return this; }
}

/** Legacy bootstrap client-side filter bar. */
export class DataFilter extends GxWrapper {
  static legacyName = 'gx.bootstrap.DataFilter';

  /** @param {Element|string|null} display @param {Record<string, any>} [options={}] */
  constructor(display, options = {}) {
    super(options);
    const component = new ZxDataFilter(display, { data: [], filters: [], autoApply: true });
    this.origin = [];
    this.filtered = [];
    this.filter = [];
    this._attach(component, {
      events: { filtered: { type: 'filter', args: (detail) => { this.filtered = detail.rows; return [detail.rows]; } } },
      ui: { clear: () => component._controls, clearBtn: () => component._clearButton }
    });
  }
  /** @param {string} identifier @param {string} label @param {string|string[]|Function} fields @param {unknown} [_width] @param {Function} [method] @returns {this} */
  addSelectFilter(identifier, label, fields, _width, method) {
    const definition = { type: 'select', id: String(identifier), label: String(label), fields: Array.isArray(fields) ? fields : [fields] };
    this.filter.push({ identifier, fields: definition.fields, method: method ?? this.selectFilter, type: 'Select' });
    this._zx.addFilter(definition); return this;
  }
  /** @param {string} identifier @param {string|string[]|Function} fields @param {string} label @param {unknown} [_width] @param {Function} [method] @returns {this} */
  addFulltextFilter(identifier, fields, label, _width, method) {
    const definition = { type: 'text', id: String(identifier), label: String(label ?? ''), placeholder: String(label ?? ''), fields: Array.isArray(fields) ? fields : [fields] };
    this.filter.push({ identifier, fields: definition.fields, method: method ?? this.fulltextFilter, type: 'Fulltext' });
    this._zx.addFilter(definition); return this;
  }
  /** @param {Element} element @returns {this} */ addCustomElement(element) { this.toElement().insertBefore(element, this._zx._controls); return this; }
  /** @param {unknown[]} data @returns {this} */ initData(data) { this.origin = Array.isArray(data) ? data : []; this._zx.setData(this.origin); return this; }
  /** @returns {unknown[]} */ doFilter() { this.filtered = this._zx.apply(); return this.filtered; }
  /** @returns {this} */ clearFilter() { this._zx.clear(); return this; }
  /** @param {string} identifier @returns {Record<string, any>|null} */ getFilter(identifier) { return this.filter.find((entry) => entry.identifier == identifier) ?? null; }
  /** @param {unknown} filterValue @param {unknown} fieldValue @returns {boolean} */ fulltextFilter(filterValue, fieldValue) { return new RegExp(String(filterValue), 'i').test(String(fieldValue ?? '')); }
  /** @param {unknown} filterValue @param {unknown} fieldValue @returns {boolean} */ selectFilter(filterValue, fieldValue) { return filterValue == fieldValue; }
}

/** @param {unknown} cell @returns {unknown} */
function adaptCell(cell) {
  if (cell?.nodeType) return cell;
  if (!cell || typeof cell !== 'object' || Array.isArray(cell)) return cell;
  const element = document.createElement('span');
  const label = cell.label;
  if (label?.nodeType) element.append(label);
  else if (label != null) element.append(document.createTextNode(String(label)));
  if (cell.className) element.classList.add(...String(cell.className).split(/\s+/).filter(Boolean));
  for (const [name, value] of Object.entries(cell)) {
    if (['label', 'className', 'styles'].includes(name) || /^on/i.test(name) || value == null) continue;
    if (['title', 'colspan', 'rowspan'].includes(name.toLowerCase())) element.setAttribute(name, String(value));
  }
  return element;
}
