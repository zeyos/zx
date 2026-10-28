import { Component } from '../../core/component.js';
import { h } from '../../core/dom.js';
import { isElement, uid } from '../../core/util.js';
import { Field } from '../field/field.js';
import { externalAdapter, readExternalDisabled, readExternalReadonly, readExternalValue } from './external-adapter.js';

/**
 * @typedef {Object} FieldsetOptions
 * @property {string} [title=''] Legend text.
 * @property {1|2|3} [columns=1] Grid column count.
 * @property {Record<string, FieldOptions|Field|Element|Component>} [fields={}] Initial fields.
 * @property {string|null} [idPrefix=null] Prefix of the DOM ids generated for the fields, as
 *   `<idPrefix>-<key>`. Null generates one per instance, so the same fieldset mounted twice
 *   never repeats an id and a field key never collides with an element id elsewhere on the page.
 */

/** @typedef {import('../field/field.js').FieldOptions} FieldOptions */

/**
 * Native fieldset that owns and coordinates labelled fields.
 * @extends {Component<FieldsetOptions>}
 */
export class Fieldset extends Component {
  static cssName = 'fieldset';

  /** @type {FieldsetOptions} */
  static defaults = { title: '', columns: 1, fields: {}, idPrefix: null };

  /** @returns {HTMLElement} */
  render() {
    const root = /** @type {HTMLElement} */ (this.el ?? h('fieldset'));
    this._fields = new Map();
    this._ownedFields = new Set();
    this._origins = new Map();
    this._fieldIdAttributes = new Map();
    this._ownedNodes = [];
    this._idPrefix = this.options.idPrefix ? String(this.options.idPrefix) : uid('zx-fieldset');
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
   * Adds a field from options, an existing field, an element, or a component. The key becomes the
   * field's `name` and its `data-field-id`; the control's DOM id is `<idPrefix>-<key>`, unless the
   * field options give an `id` of their own that differs from the key.
   *
   * An element or a component that is not a registered field type is wrapped in a `custom` field
   * that reads and writes it through its own API — `getValue`/`setValue`, `get`/`set`,
   * `getValues`/`setValues`, `isChecked`/`setChecked`, or a `value` property — disables it
   * through `setDisabled(bool)` or `enable()`/`disable()`, and makes it read-only through
   * `setReadonly(bool)`, falling back to the element's native properties only when the component
   * has none of these. The component's own `change` becomes the field's `change`, once per edit.
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
        id: this._controlId(key),
        name: key,
        type: 'custom',
        label: key,
        value: readExternalValue(source),
        disabled: readExternalDisabled(source),
        readonly: readExternalReadonly(source),
        adapter: (owner) => externalAdapter(source, owner)
      });
      owned = true;
    } else {
      const options = field && typeof field === 'object' ? field : {};
      // An `id` equal to the key is the key restated (schema descriptors carry both), not a
      // request for that DOM id.
      const explicit = options.id != null && String(options.id) !== '' && String(options.id) !== key;
      instance = new Field(null, {
        ...options,
        id: explicit ? String(options.id) : this._controlId(key),
        name: options.name ?? key
      });
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

  /**
   * The DOM id generated for a field key: unique per instance unless `idPrefix` was given.
   * @param {string} key Field key.
   * @returns {string}
   */
  _controlId(key) {
    return `${this._idPrefix}-${key.trim().replace(/\s+/g, '-')}`;
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
