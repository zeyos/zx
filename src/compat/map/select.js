import { Http, Select as ZxSelect, zeyosService } from '../../index.js';
import { GxWrapper } from '../base.js';
import { LEGACY_EVENT_ARGS, translateSelectOptions } from './options.js';

/** Shared Select facade; concrete subclasses choose filtering and warning identity. */
class SelectBase extends GxWrapper {
  static legacyName = 'gx.zeyos.Select';
  static filterMode = false;

  /** @param {Element|string|null} display @param {Record<string, any>} [options={}] */
  constructor(display, options = {}) {
    super(options, { data: [], elementIndex: 'ID', elementLabel: 'name', elementSelect: 'name', value: null });
    const translated = translateSelectOptions(options);
    translated.items = initialItems(options);
    translated.valueKey = valueReader(options.elementIndex ?? 'ID');
    translated.labelKey = labelReader(options.elementLabel ?? 'name');
    translated.renderItem = typeof options.elementLabel === 'function' ? options.elementLabel : null;
    translated.renderValue = selectionReader(options.elementSelect ?? options.elementLabel ?? 'name');
    translated.value = options.value ?? null;
    translated.filter = this.constructor.filterMode === 'local' ? 'local' :
      (['async', 'rest'].includes(this.constructor.filterMode) ? (query) => this._load(query) : false);
    translated.debounce = options.debounce ?? 200;
    const component = this.constructor.filterMode === 'priority'
      ? ZxSelect.priority(display, translated)
      : new ZxSelect(display, translated);
    this._attach(component, {
      events: {
        select: {
          type: 'change', filter: (detail) => detail.item != null,
          args: (detail) => LEGACY_EVENT_ARGS.select(detail, this)
        },
        noselect: {
          type: 'change', filter: (detail) => detail.item == null,
          args: (detail) => LEGACY_EVENT_ARGS.noselect(detail, this)
        },
        show: { type: 'open', args: () => [this] },
        hide: { type: 'close', args: () => [this] },
        requestSuccess: { type: 'loaded', args: (detail) => [detail.items] }
      },
      ui: { fieldset: 'control', textbox: 'input', dropdown: 'list', icon: 'toggle' },
      setters: { data: 'setData', value: 'setId', disabled: (value) => value ? this.disable() : this.enable() }
    });
    this._http = null;
    this.data = translated.items;
  }

  /** @param {unknown} selection @param {boolean} [noEvents=false] @returns {this} */
  set(selection, noEvents = false) { this._zx.set(selection, { silent: Boolean(noEvents) }); return this; }
  /** @param {unknown} id @param {boolean} [noEvents=false] @returns {this} */
  setId(id, noEvents = false) {
    const item = this.data?.find((candidate) => readValue(candidate, this.options.elementIndex ?? 'ID') == id);
    this._zx.set(item ?? id, { silent: Boolean(noEvents) }); return this;
  }
  /** @param {unknown} [item] @returns {unknown} */
  getId(item) { return item == null ? this._zx.value : readValue(item, this.options.elementIndex ?? 'ID'); }
  /** @returns {unknown} */
  getValue() { return this._zx.value; }
  /** @returns {unknown} */
  getSelected() { return this._zx.selected; }
  /** @param {unknown[]} data @returns {this} */
  setData(data) { this.data = Array.isArray(data) ? data.slice() : []; this._zx.setItems(this.data); return this; }
  /** @returns {Element[]} */
  getRows() { return Array.from(this.display('dropdown')?.querySelectorAll?.('[role="option"]') ?? []); }
  /** @param {boolean} [noEvents=false] @returns {this} */
  reset(noEvents = false) { this._zx.set(null, { silent: Boolean(noEvents) }); return this; }
  /** @returns {this} */
  enable() { this._zx.enable(); return this; }
  /** @returns {this} */
  disable() { this._zx.disable(); return this; }
  /** @returns {this} */
  show() { this._zx.open(); return this; }
  /** @returns {this} */
  hide() { this._zx.close(); return this; }
  /** @returns {boolean} */
  isOpen() { return this.toElement().getAttribute('data-state') === 'open'; }
  /** @returns {this} */
  search() { this._zx.open(); return this; }
  /** @returns {this} */
  showLoader() { return this; }
  /** @returns {this} */
  hideLoader() { return this; }

  /** @param {string} query @returns {Promise<unknown[]>} */
  async _load(query) {
    try {
      const result = this.constructor.filterMode === 'rest'
        ? await this._loadRest(query)
        : await this._loadUrl(query);
      const rows = Array.isArray(result) ? result : [];
      this.data = rows;
      return rows;
    } catch (error) {
      this.fireEvent('requestFailure', [error]);
      throw error;
    }
  }

  /** @param {string} query @returns {Promise<unknown>} */
  _loadUrl(query) {
    this._http ??= new Http({ headers: this.options.requestHeader ?? {} });
    const requestData = { ...(this.options.requestData ?? {}) };
    const queryData = typeof this.options.queryParam === 'function'
      ? this.options.queryParam(query, requestData)
      : { ...requestData, [this.options.queryParam ?? 'query']: query };
    const method = String(this.options.method ?? 'GET').toUpperCase();
    return this._http.request(String(this.options.url ?? './'), method === 'GET'
      ? { method, query: queryData }
      : { method, data: queryData });
  }

  /** @param {string} query @returns {Promise<unknown>} */
  _loadRest(query) {
    this._http ??= zeyosService(String(this.options.entity ?? ''), String(this.options.accesskey ?? ''), {
      apiBase: this.options.apiBase ?? '../remotecall/'
    });
    return this._http.get('', { ...(this.options.requestData ?? {}), search: query, limit: this.options.limit ?? 50 });
  }
}

/** Legacy ZeyOS select. */
export class Select extends SelectBase { static legacyName = 'gx.zeyos.Select'; }
/** Legacy ZeyOS locally filterable select. */
export class SelectFilter extends SelectBase { static legacyName = 'gx.zeyos.SelectFilter'; static filterMode = 'local'; }
/** Legacy ZeyOS HTTP-backed select. */
export class SelectDyn extends SelectBase { static legacyName = 'gx.zeyos.SelectDyn'; static filterMode = 'async'; }
/** Legacy ZeyOS priority select. */
export class SelectPrio extends SelectBase { static legacyName = 'gx.zeyos.SelectPrio'; static filterMode = 'priority'; }

/** Legacy bootstrap select. */
export class BootstrapSelect extends SelectBase { static legacyName = 'gx.bootstrap.Select'; }
/** Legacy bootstrap locally filterable select. */
export class BootstrapSelectFilter extends SelectBase { static legacyName = 'gx.bootstrap.SelectFilter'; static filterMode = 'local'; }
/** Legacy bootstrap HTTP-backed select. */
export class BootstrapSelectDyn extends SelectBase { static legacyName = 'gx.bootstrap.SelectDyn'; static filterMode = 'async'; }
/** Legacy bootstrap REST-backed select. */
export class SelectDynREST extends SelectBase {
  static legacyName = 'gx.bootstrap.SelectDynREST';
  static filterMode = 'rest';

  /** Loads and selects a REST item by ID when it is not already cached. @param {unknown} id @returns {Promise<void>} */
  async setEntityId(id) {
    const cached = this.data?.find((item) => Object.is(readValue(item, this.options.elementIndex ?? 'ID'), id));
    if (cached) { this.set(cached); return; }
    if (id == null || id === '') return;
    try {
      this._http ??= zeyosService(String(this.options.entity ?? ''), String(this.options.accesskey ?? ''), {
        apiBase: this.options.apiBase ?? '../remotecall/'
      });
      const item = await this._http.get(String(id));
      if (item) this.set(item);
    } catch (error) {
      this.fireEvent('requestFailure', [error]);
      throw error;
    }
  }
}
/** Legacy bootstrap priority select. */
export class BootstrapSelectPrio extends SelectBase { static legacyName = 'gx.bootstrap.SelectPrio'; static filterMode = 'priority'; }

/** @param {Record<string, any>} options @returns {unknown[]} */
function initialItems(options) {
  const items = Array.isArray(options.data) ? options.data.slice() : [];
  return options.elementDefault == null ? items : [options.elementDefault, ...items];
}

/** @param {string|Function} reader @returns {string|Function} */
function valueReader(reader) {
  return typeof reader === 'function' ? reader : String(reader);
}

/** @param {string|Function} reader @returns {string|Function} */
function labelReader(reader) {
  if (typeof reader !== 'function') return String(reader);
  return (item) => renderedText(reader(item));
}

/** @param {string|Function} reader @returns {(item: unknown) => string} */
function selectionReader(reader) {
  return (item) => renderedText(readValue(item, reader));
}

/** @param {unknown} item @param {string|Function} reader @returns {unknown} */
function readValue(item, reader) {
  return typeof reader === 'function' ? reader(item) : item?.[reader];
}

/** @param {unknown} value @returns {string} */
function renderedText(value) {
  if (value?.nodeType) return value.textContent ?? '';
  return String(value ?? '');
}
