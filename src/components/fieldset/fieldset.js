import { Component } from '../../core/component.js';
import { h } from '../../core/dom.js';
import { isElement } from '../../core/util.js';
import { Field } from '../field/field.js';

/**
 * @typedef {Object} FieldsetOptions
 * @property {string} [title=''] Legend text.
 * @property {1|2|3} [columns=1] Grid column count.
 * @property {Record<string, FieldOptions|Field|Element|Component>} [fields={}] Initial fields.
 */

/** @typedef {import('../field/field.js').FieldOptions} FieldOptions */

/**
 * Native fieldset that owns and coordinates labelled fields.
 * @extends {Component<FieldsetOptions>}
 */
export class Fieldset extends Component {
  static cssName = 'fieldset';

  /** @type {FieldsetOptions} */
  static defaults = { title: '', columns: 1, fields: {} };

  /** @returns {HTMLElement} */
  render() {
    const root = /** @type {HTMLElement} */ (this.el ?? h('fieldset'));
    this._fields = new Map();
    this._ownedFields = new Set();
    this._origins = new Map();
    this._fieldIdAttributes = new Map();
    this._ownedNodes = [];
    this._columnAttribute = root.getAttribute('data-columns');
    const columns = [1, 2, 3].includes(Number(this.options.columns)) ? Number(this.options.columns) : 1;
    root.dataset.columns = String(columns);

    if (this.options.title) {
      const legend = h('legend', { class: 'zx-fieldset__legend' }, String(this.options.title));
      this._ownedNodes.push(legend);
      root.append(legend);
    }
    this._grid = h('div', { class: 'zx-fieldset__grid' });
    this._ownedNodes.push(this._grid);
    root.append(this._grid);

    const fields = this.options.fields && typeof this.options.fields === 'object' ? this.options.fields : {};
    for (const [id, field] of Object.entries(fields)) this.addField(id, field);
    return root;
  }

  /**
   * Adds a field from options, an existing field, an element, or a component.
   * @param {string} id Logical field identifier.
   * @param {FieldOptions|Field|Element|Component} field Field source.
   * @returns {Field}
   */
  addField(id, field) {
    const key = String(id);
    if (this._fields.has(key)) throw new Error(`Field "${key}" already exists`);
    let instance;
    let owned = false;
    if (field instanceof Field) {
      instance = field;
    } else if (isElement(field) || field instanceof Component) {
      const source = field;
      instance = new Field(null, {
        id: key,
        type: 'custom',
        label: key,
        value: readExternalValue(source),
        disabled: readExternalDisabled(source),
        adapter: () => externalAdapter(source)
      });
      owned = true;
    } else {
      const options = field && typeof field === 'object' ? field : {};
      instance = new Field(null, { ...options, id: options.id ?? key });
      owned = true;
    }

    if (!owned) {
      this._origins.set(instance, { parent: instance.el.parentNode, next: instance.el.nextSibling });
    } else {
      this._ownedFields.add(instance);
    }
    this._fields.set(key, instance);
    this._fieldIdAttributes.set(instance, instance.el.getAttribute('data-field-id'));
    instance.el.dataset.fieldId = key;
    this._grid.append(instance.el);
    return instance;
  }

  /**
   * Returns a field by logical identifier.
   * @param {string} id Field identifier.
   * @returns {Field|null}
   */
  getField(id) {
    return this._fields.get(String(id)) ?? null;
  }

  /**
   * Reports whether a field exists.
   * @param {string} id Field identifier.
   * @returns {boolean}
   */
  hasField(id) {
    return this._fields.has(String(id));
  }

  /**
   * Returns the fields keyed by logical identifier.
   * @returns {Record<string, Field>}
   */
  getFields() {
    return Object.fromEntries(this._fields);
  }

  /**
   * Returns all field values.
   * @returns {Record<string, unknown>}
   */
  getValues() {
    const values = {};
    for (const [id, field] of this._fields) values[id] = field.getValue();
    return values;
  }

  /**
   * Sets matching field values.
   * @param {Record<string, unknown>} values Values keyed by field identifier.
   * @param {{silent?: boolean}} [options={}] Set `silent` to suppress field change events.
   * @returns {this}
   */
  setValues(values, { silent = false } = {}) {
    if (!values || typeof values !== 'object') return this;
    for (const [id, value] of Object.entries(values)) {
      this._fields.get(id)?.setValue(value, { silent });
    }
    return this;
  }

  /**
   * Returns one field value.
   * @param {string} id Field identifier.
   * @returns {unknown}
   */
  getValue(id) {
    return this._fields.get(String(id))?.getValue() ?? null;
  }

  /**
   * Sets one field value.
   * @param {string} id Field identifier.
   * @param {unknown} value New value.
   * @returns {this}
   */
  setValue(id, value) {
    this._fields.get(String(id))?.setValue(value);
    return this;
  }

  /**
   * Restores every field to its initial value.
   * @returns {this}
   */
  reset() {
    for (const field of this._fields.values()) field.reset();
    return this;
  }

  /**
   * Removes every field from this fieldset.
   * @returns {this}
   */
  clear() {
    for (const field of [...this._fields.values()]) this._releaseField(field);
    this._fields.clear();
    return this;
  }

  /**
   * Focuses one field.
   * @param {string} id Field identifier.
   * @returns {this}
   */
  focus(id) {
    this._fields.get(String(id))?.focus();
    return this;
  }

  /**
   * Applies messages to matching fields and clears unspecified highlights.
   * @param {Record<string, string>} highlights Messages keyed by field identifier.
   * @param {'danger'|'warning'|'success'} [kind='danger'] Highlight kind.
   * @returns {number}
   */
  setHighlights(highlights = {}, kind = 'danger') {
    let count = 0;
    for (const [id, field] of this._fields) {
      const message = highlights?.[id];
      if (message) {
        field.setHighlight(String(message), kind);
        count += 1;
      } else {
        field.clearHighlight();
      }
    }
    return count;
  }

  /**
   * Clears every field highlight.
   * @returns {this}
   */
  clearHighlights() {
    for (const field of this._fields.values()) field.clearHighlight();
    return this;
  }

  /** @param {Field} field @returns {void} */
  _releaseField(field) {
    const fieldId = this._fieldIdAttributes.get(field);
    if (fieldId === null || fieldId === undefined) field.el.removeAttribute('data-field-id');
    else field.el.setAttribute('data-field-id', fieldId);
    this._fieldIdAttributes.delete(field);
    if (this._ownedFields.has(field)) {
      field.destroy();
      this._ownedFields.delete(field);
      return;
    }
    const origin = this._origins.get(field);
    if (origin?.parent) origin.parent.insertBefore(
      field.el,
      origin.next?.parentNode === origin.parent ? origin.next : null
    );
    else field.el.remove();
    this._origins.delete(field);
  }

  /** @returns {void} */
  destroy() {
    this.clear();
    for (const node of this._ownedNodes ?? []) node.remove();
    if (this._columnAttribute === null) this.el.removeAttribute('data-columns');
    else this.el.setAttribute('data-columns', this._columnAttribute);
    super.destroy();
  }
}

/** @param {Element|Component} source @returns {import('../field/field.js').FieldAdapter} */
function externalAdapter(source) {
  const el = isElement(source) ? source : source.toElement();
  const parent = el.parentNode;
  const next = el.nextSibling;
  const attributes = new Map(['id', 'aria-labelledby', 'aria-describedby', 'aria-disabled', 'aria-invalid']
    .map((name) => [name, el.getAttribute(name)]));
  const originalDisabled = 'disabled' in el ? el.disabled : undefined;
  const originalValue = 'value' in el ? el.value : undefined;
  return {
    el,
    get: () => {
      if (typeof source.getValue === 'function') return source.getValue();
      if (typeof source.getValues === 'function') return source.getValues();
      if ('value' in el) return el.value;
      return null;
    },
    set: (value, options) => {
      if (typeof source.setValue === 'function') source.setValue(value, options);
      else if (typeof source.setValues === 'function' && value && typeof value === 'object') source.setValues(value, options);
      else if ('value' in el) el.value = value == null ? '' : value;
    },
    focus: () => {
      if (typeof source.focus === 'function') source.focus();
      else if (typeof el.focus === 'function') el.focus();
    },
    setDisabled: (disabled) => {
      if (typeof source.setDisabled === 'function') source.setDisabled(disabled);
      else if ('disabled' in el) el.disabled = disabled;
      else el.setAttribute('aria-disabled', String(disabled));
    },
    destroy: () => {
      for (const [name, value] of attributes) {
        if (value === null) el.removeAttribute(name);
        else el.setAttribute(name, value);
      }
      if (originalDisabled !== undefined) el.disabled = originalDisabled;
      if (originalValue !== undefined) el.value = originalValue;
      if (parent) parent.insertBefore(el, next?.parentNode === parent ? next : null);
      else el.remove();
    }
  };
}

/** @param {Element|Component} source @returns {unknown} */
function readExternalValue(source) {
  const el = isElement(source) ? source : source.toElement();
  if (typeof source.getValue === 'function') return source.getValue();
  if (typeof source.getValues === 'function') return source.getValues();
  return 'value' in el ? el.value : null;
}

/** @param {Element|Component} source @returns {boolean} */
function readExternalDisabled(source) {
  const el = isElement(source) ? source : source.toElement();
  return 'disabled' in el ? Boolean(el.disabled) : el.getAttribute('aria-disabled') === 'true';
}
