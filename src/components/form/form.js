import { Component } from '../../core/component.js';
import { h } from '../../core/dom.js';
import { icon as createIcon } from '../../core/icons.js';
import { Fieldset } from '../fieldset/fieldset.js';
import { coerceFloat, coerceInteger } from '../field/field.js';

/**
 * @typedef {Object} FormAction
 * @property {string} [id] Action identifier.
 * @property {string} [label] Button text.
 * @property {string|null} [icon=null] Kernel icon name.
 * @property {'default'|'primary'|'danger'|'ghost'} [kind='default'] Visual intent.
 * @property {'md'|'sm'} [size='md'] Button size.
 * @property {'button'|'submit'|'reset'} [type='button'] Native button type.
 * @property {boolean} [disabled=false] Disabled state.
 * @property {string} [title] Native button title.
 * @property {(event: MouseEvent, form: Form) => void} [onClick] Click callback.
 */

/**
 * @typedef {Object} FormOptions
 * @property {Array<Fieldset|import('../fieldset/fieldset.js').FieldsetOptions>} [fieldsets=[]] Initial fieldsets.
 * @property {FormAction[]} [actions=[]] Form action descriptors.
 * @property {boolean} [novalidate=true] Native `novalidate` state.
 * @property {(event: CustomEvent<{values: Record<string, unknown>}>) => void} [onsubmit] Submit listener.
 * @property {(event: CustomEvent<{errors: Record<string, string>}>) => void} [oninvalid] Invalid listener.
 * @property {(event: CustomEvent<{id: string, value: unknown}>) => void} [onchange] Field change listener.
 */

/**
 * Real form element coordinating fieldsets, validation, and actions.
 * @fires Form#submit
 * @fires Form#invalid
 * @fires Form#change
 * @extends {Component<FormOptions>}
 */
export class Form extends Component {
  static cssName = 'form';

  /** @type {FormOptions & {msg: Record<string, string>}} */
  static defaults = {
    fieldsets: [],
    actions: [],
    novalidate: true,
    msg: {
      'form.required': 'This field is required.',
      'form.int': 'Enter a whole number.',
      'form.float': 'Enter a valid number.'
    }
  };

  /** @returns {HTMLElement} */
  render() {
    const root = /** @type {HTMLElement} */ (this.el ?? h('form'));
    this._fieldsets = [];
    this._ownedFieldsets = new Set();
    this._origins = new Map();
    this._ownedNodes = [];
    this._novalidateAttribute = root.getAttribute('novalidate');
    root.toggleAttribute('novalidate', Boolean(this.options.novalidate));

    this._body = h('div', { class: 'zx-form__body' });
    this._actions = h('div', { class: 'zx-form__actions' });
    this._ownedNodes.push(this._body, this._actions);
    root.append(this._body, this._actions);

    this.listen(root, 'submit', (event) => {
      event.preventDefault();
      this.submit();
    });
    this.listen(root, 'reset', (event) => {
      event.preventDefault();
      this.reset();
    });
    this.listen(this._actions, 'click', (event) => this._handleAction(event));

    const fieldsets = Array.isArray(this.options.fieldsets) ? this.options.fieldsets : [];
    for (const fieldset of fieldsets) this.addFieldset(fieldset);
    this.setActions(Array.isArray(this.options.actions) ? this.options.actions : []);
    return root;
  }

  /**
   * Adds an existing fieldset or constructs one from options.
   * @param {Fieldset|import('../fieldset/fieldset.js').FieldsetOptions} fieldset Fieldset source.
   * @returns {Fieldset}
   */
  addFieldset(fieldset) {
    const owned = !(fieldset instanceof Fieldset);
    const instance = owned ? new Fieldset(null, fieldset ?? {}) : fieldset;
    if (this._fieldsets.includes(instance)) return instance;
    if (owned) this._ownedFieldsets.add(instance);
    else this._origins.set(instance, { parent: instance.el.parentNode, next: instance.el.nextSibling });
    this._fieldsets.push(instance);
    this._body.append(instance.el);
    this.listen(instance.el, 'zx-change', (event) => {
      const target = event.target;
      const id = target instanceof Element ? target.dataset.fieldId : null;
      if (id) this.emit('change', { id, value: instance.getValue(id) });
    });
    return instance;
  }

  /**
   * Replaces the rendered action buttons.
   * @param {FormAction[]} list Button descriptors.
   * @returns {this}
   */
  setActions(list) {
    this._actionDescriptors = Array.isArray(list) ? list.map((action) => ({ ...action })) : [];
    this._actions.replaceChildren(...this._actionDescriptors.map((action, index) => {
      const label = String(action.label ?? action.id ?? 'Action');
      return h('button', {
        class: 'zx-btn',
        type: ['submit', 'reset'].includes(action.type) ? action.type : 'button',
        disabled: Boolean(action.disabled),
        title: action.title,
        ariaLabel: !label && action.title ? action.title : undefined,
        dataset: {
          actionIndex: index,
          kind: ['primary', 'danger', 'ghost'].includes(action.kind) ? action.kind : 'default',
          size: action.size === 'sm' ? 'sm' : 'md'
        }
      }, action.icon ? createIcon(action.icon, { size: 16 }) : null,
      label ? h('span', { class: 'zx-btn__label' }, label) : null);
    }));
    this._actions.hidden = this._actionDescriptors.length === 0;
    return this;
  }

  /**
   * Returns all values merged in fieldset order.
   * @returns {Record<string, unknown>}
   */
  getValues() {
    return Object.assign({}, ...this._fieldsets.map((fieldset) => fieldset.getValues()));
  }

  /**
   * Sets matching values across all fieldsets.
   * @param {Record<string, unknown>} values Values keyed by field identifier.
   * @param {{silent?: boolean}} [options={}] Set `silent` to suppress field change events.
   * @returns {this}
   */
  setValues(values, { silent = false } = {}) {
    for (const fieldset of this._fieldsets) fieldset.setValues(values, { silent });
    return this;
  }

  /**
   * Returns the first matching field.
   * @param {string} id Field identifier.
   * @returns {import('../field/field.js').Field|null}
   */
  getField(id) {
    for (const fieldset of this._fieldsets) {
      const field = fieldset.getField(id);
      if (field) return field;
    }
    return null;
  }

  /**
   * Sets one matching field value.
   * @param {string} id Field identifier.
   * @param {unknown} value New value.
   * @returns {this}
   */
  setValue(id, value) {
    this.getField(id)?.setValue(value);
    return this;
  }

  /**
   * Returns one matching field value.
   * @param {string} id Field identifier.
   * @returns {unknown}
   */
  getValue(id) {
    return this.getField(id)?.getValue() ?? null;
  }

  /**
   * Resets all fieldsets and highlights.
   * @returns {this}
   */
  reset() {
    for (const fieldset of this._fieldsets) fieldset.reset().clearHighlights();
    return this;
  }

  /**
   * Applies field highlights across all fieldsets.
   * @param {Record<string, string>} highlights Messages keyed by field identifier.
   * @param {'danger'|'warning'|'success'} [kind='danger'] Highlight kind.
   * @returns {number}
   */
  setHighlights(highlights, kind = 'danger') {
    return this._fieldsets.reduce((count, fieldset) => count + fieldset.setHighlights(highlights, kind), 0);
  }

  /**
   * Clears all field highlights.
   * @returns {this}
   */
  clearHighlights() {
    for (const fieldset of this._fieldsets) fieldset.clearHighlights();
    return this;
  }

  /**
   * Validates and emits a preventable submit event.
   * @returns {boolean} True when valid and not prevented.
   * @fires Form#submit
   * @fires Form#invalid
   */
  submit() {
    const errors = {};
    let firstInvalid = null;
    for (const fieldset of this._fieldsets) {
      for (const [id, field] of Object.entries(fieldset.getFields())) {
        const value = field.getValue();
        let message = '';
        if (field.options.required && isEmpty(value)) {
          message = this.msg('form.required');
        } else if (!isEmpty(value) && field.options.type === 'int') {
          const result = coerceInteger(value);
          if (!result.valid) message = this.msg('form.int');
          else field.setValue(result.value, { silent: true });
        } else if (!isEmpty(value) && field.options.type === 'float') {
          const result = coerceFloat(value);
          if (!result.valid) message = this.msg('form.float');
          else field.setValue(result.value, { silent: true });
        }
        if (message) {
          errors[id] = message;
          field.setHighlight(message, 'danger');
          firstInvalid ??= field;
        } else {
          field.clearHighlight();
        }
      }
    }

    if (Object.keys(errors).length) {
      this.emit('invalid', { errors });
      firstInvalid?.focus();
      return false;
    }
    const event = this.emit('submit', { values: this.getValues() });
    return !event.defaultPrevented;
  }

  /** @param {Event} event @returns {void} */
  _handleAction(event) {
    const button = event.target instanceof Element ? event.target.closest('[data-action-index]') : null;
    if (!button || !this._actions.contains(button)) return;
    const action = this._actionDescriptors[Number(button.dataset.actionIndex)];
    const callback = action?.onClick ?? action?.onclick ?? action?.handler;
    if (typeof callback === 'function') callback(event, this);
  }

  /** @returns {void} */
  destroy() {
    for (const fieldset of this._fieldsets ?? []) {
      if (this._ownedFieldsets.has(fieldset)) fieldset.destroy();
      else {
        const origin = this._origins.get(fieldset);
        if (origin?.parent) origin.parent.insertBefore(
          fieldset.el,
          origin.next?.parentNode === origin.parent ? origin.next : null
        );
        else fieldset.el.remove();
      }
    }
    this._fieldsets = [];
    for (const node of this._ownedNodes ?? []) node.remove();
    if (this._novalidateAttribute === null) this.el.removeAttribute('novalidate');
    else this.el.setAttribute('novalidate', this._novalidateAttribute);
    super.destroy();
  }
}

/** @param {unknown} value @returns {boolean} */
function isEmpty(value) {
  return value == null || value === '' || value === false || (Array.isArray(value) && value.length === 0);
}

/**
 * Successful form submission event.
 * @event Form#submit
 * @type {CustomEvent<{values: Record<string, unknown>}>}
 */

/**
 * Form validation failure event.
 * @event Form#invalid
 * @type {CustomEvent<{errors: Record<string, string>}>}
 */

/**
 * Delegated field value change event.
 * @event Form#change
 * @type {CustomEvent<{id: string, value: unknown}>}
 */
