import {
  Field as ZxField,
  Fieldset as ZxFieldset,
  FieldUpload as ZxFieldUpload,
  Form as ZxForm,
  MultiValueEditor as ZxMultiValueEditor,
  ValueList as ZxValueList
} from '../../index.js';
import { GxWrapper } from '../base.js';
import { legacyContent, targetElement, textLabel } from './helpers.js';
import {
  translateChecklistOptions, translateDateboxFormat, translateFieldOptions, translateSelectOptions
} from './options.js';

/** Legacy bootstrap form. */
export class Form extends GxWrapper {
  static legacyName = 'gx.bootstrap.Form';

  /** @param {Element|string|null} display @param {Record<string, any>} [options={}] */
  constructor(display, options = {}) {
    super(options, { fields: {}, horizontal: ['col-md-3', 'col-md-9'], columns: false });
    const component = new ZxForm(display, { fieldsets: [], actions: normalizeActions(options.actions) });
    this._fieldsets = [];
    this._attach(component, {
      events: {
        submit: { type: 'submit', args: (detail) => [detail.values, this] },
        change: { type: 'change', args: (detail) => [detail.id, detail.value, this] },
        invalid: { type: 'invalid', args: (detail) => [detail.errors, this] }
      },
      ui: { body: () => component._body, actions: () => component._actions }
    });
    if (options.fields && typeof options.fields === 'object') {
      this.addFieldset({ fields: options.fields, title: options.title, horizontal: options.horizontal, columns: options.columns });
    }
  }

  /** @param {Fieldset|Record<string, any>} fieldset @returns {Fieldset} */
  addFieldset(fieldset) {
    const wrapper = fieldset instanceof Fieldset ? fieldset : new Fieldset(null, {
      horizontal: this.options.horizontal, columns: this.options.columns, ...fieldset
    });
    this._fieldsets.push(wrapper);
    this._zx.addFieldset(wrapper._zx);
    return wrapper;
  }
  /** @param {unknown} content @returns {this} */
  addActions(content) {
    const actions = normalizeActions(content);
    if (actions.length) this._zx.setActions(actions);
    else {
      const values = Array.isArray(content) ? content : [content];
      for (const value of values) {
        const node = legacyContent(value);
        if (node?.nodeType === 1) this._zx._actions.prepend(node);
      }
      this._zx._actions.hidden = false;
    }
    return this;
  }
  /** @param {string} id @returns {unknown} */ getValue(id) { return this.getField(id)?.getValue() ?? null; }
  /** @returns {Record<string, unknown>} */ getValues() { return Object.assign({}, ...this._fieldsets.map((fieldset) => fieldset.getValues())); }
  /** @param {string} id @returns {Field|null} */ getField(id) { for (const fieldset of this._fieldsets) { const field = fieldset.getField(id); if (field) return field; } return null; }
  /** @returns {Fieldset[]} */ getFieldsets() { return this._fieldsets.slice(); }
  /** @param {string} id @param {unknown} value @returns {this} */ setValue(id, value) { this.getField(id)?.setValue(value); return this; }
  /** @param {Record<string, unknown>} values @returns {this} */ setValues(values) { for (const fieldset of this._fieldsets) fieldset.setValues(values); return this; }
  /** @param {Record<string, unknown>} [highlights={}] @param {string} [type='error'] @returns {number} */ setHighlights(highlights = {}, type = 'error') { return this._fieldsets.reduce((count, fieldset) => count + fieldset.setHighlights(highlights, type), 0); }
  /** @param {Record<string, unknown>} [highlights={}] @param {string} [type='error'] @returns {number} */ setHintHighlights(highlights = {}, type = 'error') { return this.setHighlights(highlights, type); }
  /** @returns {this} */ reset() { for (const fieldset of this._fieldsets) fieldset.reset().setHighlights(); return this; }
}

/** Legacy bootstrap fieldset. */
export class Fieldset extends GxWrapper {
  static legacyName = 'gx.bootstrap.Fieldset';

  /** @param {Element|string|null} display @param {Record<string, any>} [options={}] */
  constructor(display, options = {}) {
    super(options, { fields: {}, title: null, columns: 1 });
    const columns = Number(options.columns) || 1;
    const component = new ZxFieldset(display, { title: options.title ?? '', columns: Math.max(1, Math.min(3, columns)), fields: {} });
    this._fields = {};
    this._attach(component, { ui: { columns: () => component._grid } });
    if (options.fields && typeof options.fields === 'object') this.addFields(options.fields);
  }

  /** @param {Record<string, any>} fields @returns {this} */ addFields(fields) { for (const [id, source] of Object.entries(fields ?? {})) this.addFieldItem(id, source); return this; }
  /** @param {string} id @param {unknown} field @returns {Field|unknown} */
  addFieldItem(id, field) {
    if (this.hasField(id)) throw new Error(`Field "${id}" already exists.`);
    let wrapper = field;
    if (!(field instanceof Field)) {
      if (field?.type != null) wrapper = new Field({ ...field, id });
      else if (field?.field != null) wrapper = new Field({ ...field, id, type: field.type ?? 'custom' });
      else if (field?.nodeType || field?._zx) wrapper = new Field({ id, label: id, type: 'custom', field });
      else wrapper = new Field({ ...(field ?? {}), id });
    }
    this._fields[id] = wrapper;
    this._zx.addField(id, wrapper instanceof Field ? wrapper._zx : wrapper?._zx ?? wrapper);
    return wrapper;
  }
  /** @param {string} id @param {string|Function|Element} type @param {Record<string, any>} [options={}] @returns {Field} */
  addField(id, type, options = {}) { return /** @type {Field} */ (this.addFieldItem(id, new Field({ ...options, id, type }))); }
  /** @returns {this} */ clear() { this._zx.clear(); this._fields = {}; return this; }
  /** @param {string} id @returns {boolean} */ hasField(id) { return Object.hasOwn(this._fields, id); }
  /** @param {string} id @returns {Field|null} */ getField(id) { return this._fields[id] ?? null; }
  /** @returns {Record<string, Field>} */ getFields() { return { ...this._fields }; }
  /** @param {string} id @returns {unknown} */ getValue(id) { return this._fields[id]?.getValue?.() ?? null; }
  /** @returns {Record<string, unknown>} */ getValues() { const values = {}; for (const [id, field] of Object.entries(this._fields)) if (!id.startsWith('__')) values[id] = field.getValue?.(); return values; }
  /** @param {string} id @param {unknown} value @returns {this} */ setValue(id, value) { this._fields[id]?.setValue?.(value); return this; }
  /** @param {Record<string, unknown>} values @returns {this} */ setValues(values) { for (const [id, value] of Object.entries(values ?? {})) this.setValue(id, value); return this; }
  /** @returns {this} */ reset() { for (const field of Object.values(this._fields)) field.reset?.(); return this; }
  /** @param {string} id @returns {this} */ focus(id) { this._fields[id]?.focus?.(); return this; }
  /** @param {Record<string, unknown>} [highlights={}] @param {string} [type='error'] @returns {number} */
  setHighlights(highlights = {}, type = 'error') {
    let count = 0;
    for (const [id, field] of Object.entries(this._fields)) {
      const highlight = highlights?.[id];
      if (highlight && typeof highlight === 'object') { field.setHighlight(highlight.label, highlight.type ?? type); count += 1; }
      else if (highlight) { field.setHighlight(highlight, type); count += 1; }
      else field.setHighlight();
    }
    return count;
  }
  /** @param {Record<string, unknown>} [highlights={}] @param {string} [type='error'] @returns {number} */ setHintHighlights(highlights = {}, type = 'error') { return this.setHighlights(highlights, type); }
}

/** Legacy bootstrap single field. */
export class Field extends GxWrapper {
  static legacyName = 'gx.bootstrap.Field';

  /** @param {Record<string, any>} [options={}] */
  constructor(options = {}) {
    super(options, { label: '', type: 'text', description: '', default: null });
    const translated = translateLegacyField(options);
    const component = new ZxField(null, translated);
    this._type = translated.type;
    this._attach(component, {
      events: { setValue: { type: 'change', args: (detail) => [detail.value] }, change: { type: 'change', args: (detail) => [detail.value] } },
      ui: {
        label: () => component.el.querySelector('.zx-field__label'),
        field: () => component.getInput(),
        controlwrapper: () => component.el.querySelector('.zx-field__control'),
        highlight: () => component.el.querySelector('.zx-field__highlight'),
        description: () => component.el.querySelector('.zx-field__description'),
        hint: () => component.el.querySelector('.zx-field__control')
      },
      setters: { value: 'setValue', default: 'setValue', disabled: 'setDisabled' }
    });
  }
  /** @param {string} label @returns {this} */ setLabel(label) { const element = this.display('label'); if (element) element.textContent = textLabel(label); return this; }
  /** @param {string} help @returns {this} */ setHelp(help) { const element = this.display('description'); if (element) element.textContent = String(help ?? ''); return this; }
  /** @returns {unknown} */ getValue() { return this._zx.getValue(); }
  /** @param {unknown} value @returns {this} */ setValue(value) { this._zx.setValue(value); return this; }
  /** @param {boolean} disabled @returns {this} */ setDisabled(disabled) { this._zx.setDisabled(disabled); return this; }
  /** @param {unknown} label @param {string} [type='warning'] @returns {this} */
  setHighlight(label, type = 'warning') { if (!label) this._zx.clearHighlight(); else this._zx.setHighlight(String(label), highlightKind(type)); return this; }
  /** @param {unknown} label @param {string} [type='warning'] @returns {this} */ setHintHighlight(label, type = 'warning') { return this.setHighlight(label, type); }
  /** @returns {this} */ reset() { this._zx.reset(); return this; }
  /** @returns {this} */ focus() { this._zx.focus(); return this; }
}

/** Legacy bootstrap chip list. */
export class ValueList extends GxWrapper {
  static legacyName = 'gx.bootstrap.ValueList';

  /** @param {Element|string|null} display @param {Record<string, any>} [options={}] */
  constructor(display, options = {}) {
    super(options, { deletable: true });
    const component = new ZxValueList(display, { values: options.values ?? options.default ?? [], deletable: options.deletable !== false });
    this._attach(component, { events: { change: { type: 'change', args: (detail) => [detail.values] }, click: { type: 'add', args: (detail) => [detail.value] } }, ui: { textbox: () => component._input, list: () => component._list } });
  }
  /** @param {unknown} value @returns {boolean} */ addValue(value) { return this._zx.addValue(value); }
  /** @returns {unknown[]} */ getValues() { return this._zx.getValues(); }
  /** @param {unknown[]} values @returns {this} */ setValues(values) { this._zx.setValues(values ?? []); return this; }
  /** @returns {this} */ enable() { this._zx.enable(); return this; }
  /** @returns {this} */ disable() { this._zx.disable(); return this; }
  /** @returns {this} */ focus() { this._zx.focus(); return this; }
}

/** Legacy JSON-string multi-value editor. */
export class MultiValueEditor extends GxWrapper {
  static legacyName = 'gx.bootstrap.MultiValueEditor';

  /** @param {Element|string|null} display @param {Record<string, any>} [options={}] */
  constructor(display, options = {}) {
    super(options, { options: false, default: false });
    const values = parseValues(options.default || options.values || options.options);
    const component = new ZxMultiValueEditor(display, { values, options: null });
    this._attach(component, { events: { change: { type: 'change', args: (detail) => [JSON.stringify(detail.values)] } }, ui: { optionsbox: () => component._rows, btnAdd: () => component._add } });
  }
  /** @returns {string} */ getValue() { return JSON.stringify(this._zx.getValues()); }
  /** @param {string|unknown[]} value @returns {this} */ setValue(value) { this._zx.setValues(parseValues(value)); return this; }
}

/** Legacy bootstrap upload field. */
export class FieldUpload extends GxWrapper {
  static legacyName = 'gx.bootstrap.FieldUpload';

  /** @param {Record<string, any>} [options={}] */
  constructor(options = {}) {
    super(options, { inputname: 'upload', uploadurl: './index.php', params: {}, imageurl: '' });
    const component = new ZxFieldUpload(null, {
      url: options.uploadurl ?? options.url ?? './index.php', paramName: options.inputname ?? options.paramName ?? 'upload',
      params: options.params ?? {}, accept: options.accept ?? null, multiple: Boolean(options.multiple),
      autoUpload: options.autoUpload !== false, http: options.http ?? null
    });
    this._value = null;
    this._attach(component, {
      events: {
        success: { type: 'success', args: (detail) => { this._handleResponse(detail.response); return [detail.response]; } },
        failure: { type: 'error', args: (detail) => { options.showError?.(this, detail.error); return [detail.error]; } },
        progress: { type: 'progress', args: (detail) => [detail.percent] }
      },
      ui: { select: () => component._input, placeholder: () => component._preview, progress: () => component._progress }
    });
    if (options.default) this.setValue(options.default);
    if (options.disabled) this.setDisabled(true);
  }
  /** @param {unknown} source @returns {this} */ setValue(source) { this._value = source; this.setImage(source); return this; }
  /** @returns {null} */ getValue() { return null; }
  /** @param {unknown} source @returns {this} */
  setImage(source) { this._zx._preview.replaceChildren(); if (source) { const image = document.createElement('img'); image.src = String(this.options.imageurl ?? '') + String(source); image.alt = ''; this._zx._preview.append(image); } return this; }
  /** @param {boolean} disabled @returns {this} */ setDisabled(disabled) { this._zx.setDisabled(disabled); return this; }
  /** @returns {this} */ reset() { this._zx.clear(); return this; }
  /** @param {unknown} response @returns {void} */
  _handleResponse(response) {
    if (typeof this.options.parseResponse === 'function') this.options.parseResponse(this, response, (value) => { if (value != null) this.setValue(value); });
  }
}

/** @param {Record<string, any>} options @returns {Record<string, any>} */
function translateLegacyField(options) {
  const translated = translateFieldOptions(options);
  const nested = options.options && typeof options.options === 'object' && !Array.isArray(options.options) ? options.options : {};
  if (options.field != null || (typeof options.type !== 'string' && options.type != null)) {
    const source = options.field ?? options.type;
    const instance = typeof source === 'function' ? new source(null, Object.keys(nested).length ? nested : options) : source;
    translated.type = 'custom';
    translated.adapter = () => externalAdapter(instance);
    return translated;
  }
  if (translated.type === 'zxselect') {
    translated.props = translateSelectOptions({ ...nested, ...options });
    translated.props.items = Array.isArray(options.data) ? options.data : (nested.data ?? []);
    translated.props.valueKey = options.elementIndex ?? nested.elementIndex ?? 'ID';
    translated.props.labelKey = options.elementLabel ?? nested.elementLabel ?? 'name';
  } else if (translated.type === 'checklist') {
    translated.props = translateChecklistOptions(Object.keys(nested).length ? nested : options);
    translated.props.items = nested.data ?? options.data ?? [];
  } else if (translated.type === 'date' || translated.type === 'datetime') {
    const source = Object.keys(nested).length ? nested : options;
    translated.props = { format: translateDateboxFormat(source.format ?? '%d.%m.%Y'), time: translated.type === 'datetime' };
    translated.value = normalizeFormDate(translated.value ?? source.date);
  } else if (translated.type === 'month') {
    translated.props = { ...nested };
    translated.value = normalizeFormDate(translated.value ?? nested.date ?? options.date);
  } else if (translated.type === 'time') {
    const source = Object.keys(nested).length ? nested : options;
    translated.props = { unit: source.unit ?? 'minutes', seconds: source.seconds !== false, signed: Boolean(source.prefix) };
    translated.value = translated.value ?? source.time ?? 0;
  } else if (translated.type === 'html') {
    translated.value = legacyContent(options.content ?? translated.value);
  }
  return translated;
}

/** @param {unknown} source @returns {import('../../components/field/field.js').FieldAdapter} */
function externalAdapter(source) {
  const element = source?._zx?.toElement?.() ?? source?.toElement?.() ?? source;
  if (!element?.nodeType) throw new TypeError('Custom legacy field must provide a DOM element');
  return {
    el: element,
    get: () => source?.getValue?.() ?? source?.getValues?.() ?? source?.get?.() ?? ('value' in element ? element.value : null),
    set: (value) => {
      if (typeof source?.setValue === 'function') source.setValue(value);
      else if (typeof source?.setValues === 'function') source.setValues(value);
      else if (typeof source?.set === 'function') source.set(value);
      else if ('value' in element) element.value = value == null ? '' : String(value);
    },
    focus: () => source?.focus?.() ?? element.focus?.(),
    setDisabled: (disabled) => {
      if (typeof source?.setDisabled === 'function') source.setDisabled(disabled);
      else if (disabled) source?.disable?.(); else source?.enable?.();
      if ('disabled' in element) element.disabled = disabled;
    }
  };
}

/** @param {unknown} actions @returns {Array<Record<string, any>>} */
function normalizeActions(actions) {
  const list = Array.isArray(actions) ? actions : (actions && typeof actions === 'object' && !actions.nodeType ? Object.values(actions) : []);
  return list.filter((action) => action && typeof action === 'object' && !action.nodeType && !action.tag).map((action, index) => ({
    id: action.id ?? String(index), label: action.label ?? action.text ?? '', icon: action.icon ?? null,
    kind: actionKind(action.kind ?? action.type ?? (action.primary ? 'primary' : 'default')),
    type: action.submit ? 'submit' : (action.type === 'reset' ? 'reset' : 'button'),
    onClick: action.onClick ?? action.onclick ?? action.click
  }));
}

/** @param {unknown} type @returns {'danger'|'warning'|'success'|'default'} */
function highlightKind(type) {
  const value = String(type ?? '').toLowerCase();
  if (value === 'error' || value === 'danger') return 'danger';
  if (value === 'success' || value === 'primary') return 'success';
  if (value === 'warning') return 'warning';
  return 'default';
}

/** @param {unknown} kind @returns {'default'|'primary'|'danger'|'ghost'} */
function actionKind(kind) {
  const value = String(kind ?? '').toLowerCase();
  if (value === 'error' || value === 'danger') return 'danger';
  if (value === 'primary' || value === 'success') return 'primary';
  if (value === 'ghost' || value === 'link') return 'ghost';
  return 'default';
}

/** @param {unknown} value @returns {unknown[]} */
function parseValues(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  try { const parsed = JSON.parse(String(value)); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
}

/** @param {unknown} value @returns {unknown} */
function normalizeFormDate(value) {
  if (value instanceof Date || value == null) return value;
  if (typeof value === 'number') return new Date(value * (Math.abs(value) < 1e12 ? 1000 : 1));
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}
